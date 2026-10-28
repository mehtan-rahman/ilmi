// The plugin runtime: reads `.ilmi/plugins.json` and `.ilmi/plugins/<id>/`,
// runs each enabled bundle with a `require` that serves nothing, hands
// `activate` a handle scoped to the plugin, and collects everything the
// plugin registers so it can all be removed when the plugin is turned off,
// the vault closes, or its files change on disk. A throw anywhere in a
// plugin is caught, shown as a notice naming the plugin, and deactivates
// that plugin for the session; the others are untouched. Pure over a
// `Vault` and a `Bridge`, so it runs in vitest without the app.

import { cardFields, meta, parse, serialize, setField, type Doc as FDoc, type FieldKey } from '../format/index.js';
import { baseOf, dirOf, isDoc, nameOf, type Vault, type VaultEvent } from '../vault/index.js';
import type * as A from './api.js';

export const API: A.ApiVersion = 1;
export const PLUGINS_DIR = '.ilmi/plugins';
export const ENABLED_FILE = '.ilmi/plugins.json';
export const MANIFEST = 'plugin.json';
export const MAIN = 'main.js';
export const STYLE = 'style.css';
export const DATA = 'data.json';
/** The files a plugin folder is made of; anything else in a package is dropped. */
export const PLUGIN_FILES = [MANIFEST, MAIN, STYLE, DATA] as const;
/** The cue's own verbs; an action cannot take their keys. */
export const RESERVED_ACTION_KEYS = ['e', 'm'];
const ID_RE = /^[a-z0-9][a-z0-9-]*$/;
/** How long after the last change to a plugin's files it is reloaded. */
const RELOAD_DELAY = 400;
/** How long the runtime's own writes are ignored when the watcher echoes them. */
const QUIET_MS = 2500;

/** What the app provides to the runtime: notices, surfaces, the queue, the session, the lenses, the network. */
export interface Bridge {
  version: string;
  notice(text: string): void;
  fetch(url: string, init?: RequestInit): Promise<Response>;
  today(): A.QueueElement[];
  onQueue(fn: () => void): A.Dispose;
  current(): A.QueueElement | null;
  activeLens(): A.Lens | null;
  openLens(path: string): void;
  popover(rect: A.Rect, el: HTMLElement): A.Popover;
  modal(el: HTMLElement): A.Popover;
  /** A plugin's `style.css` on the page; the disposer takes it off. */
  addStyle(id: string, css: string): A.Dispose;
}

export type PluginState = 'on' | 'off' | 'failed' | 'refused' | 'broken';

/** One row of the tweaks section. */
export interface PluginRow {
  id: string;
  name: string;
  version: string;
  author?: string;
  description?: string;
  /** In `plugins.json`. */
  enabled: boolean;
  /** `on` running; `off` not; `failed` threw this session; `refused` written for another API; `broken` unreadable manifest. */
  state: PluginState;
  error?: string;
  hasSettings: boolean;
}

export type SettingControl =
  | { kind: 'text'; key: string; label: string; placeholder?: string }
  | { kind: 'toggle'; key: string; label: string }
  | { kind: 'choice'; key: string; label: string; options: readonly string[] }
  | { kind: 'note'; text: string };

/** A palette entry for a plugin's command. */
export interface PluginCommand {
  /** `plugin:<id>:<command>`. */
  id: string;
  title: string;
  /** The plugin's name. */
  plugin: string;
  key?: string;
}

export interface PluginAction {
  id: string;
  name: string;
  key?: string;
}

export type InstallResult =
  | { status: 'added'; id: string; name: string }
  | { status: 'refused'; reason: string }
  | { status: 'taken'; id: string; name: string; version: string }
  | { status: 'replace'; id: string; name: string; have: string; incoming: string };

export const COMMAND_PREFIX = 'plugin:';

interface Found {
  id: string;
  manifest: A.PluginManifest | null;
  manifestText: string;
  error?: string;
}

interface Reg<T> {
  plugin: string;
  spec: T;
}

interface Instance {
  id: string;
  manifest: A.PluginManifest;
  manifestText: string;
  mainText: string;
  styleText: string | null;
  disposers: A.Dispose[];
  data: A.StoreData;
  dataListeners: Set<(data: A.StoreData) => void>;
  settingsBuilders: ((s: A.Settings) => void)[];
}

type EventName = 'grade' | 'read-on' | 'worked-on' | 'lens.open' | 'lens.selection' | 'queue';

const message = (e: unknown): string => (e instanceof Error ? e.message : String(e));

/** The manifest, or why it is not one. `folder` is the directory's name; the id must match it. */
export function parseManifest(text: string, folder?: string): { manifest: A.PluginManifest } | { error: string } {
  let raw: unknown;
  try {
    raw = JSON.parse(text);
  } catch {
    return { error: 'plugin.json is not JSON' };
  }
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return { error: 'plugin.json is not an object' };
  const m = raw as Record<string, unknown>;
  if (typeof m.id !== 'string' || !ID_RE.test(m.id)) return { error: 'plugin.json needs an id of lowercase letters, digits, and hyphens' };
  if (folder !== undefined && m.id !== folder) return { error: `plugin.json says ${m.id}, the folder is ${folder}` };
  if (typeof m.name !== 'string' || !m.name.trim()) return { error: 'plugin.json needs a name' };
  if (typeof m.version !== 'string' || !m.version.trim()) return { error: 'plugin.json needs a version' };
  const api = typeof m.api === 'string' ? Number(m.api) : m.api;
  if (typeof api !== 'number' || !Number.isInteger(api)) return { error: 'plugin.json needs an api version' };
  const manifest: A.PluginManifest = { id: m.id, name: m.name.trim(), version: m.version.trim(), api: api as A.ApiVersion };
  if (typeof m.description === 'string') manifest.description = m.description;
  if (typeof m.author === 'string') manifest.author = m.author;
  if (typeof m.repo === 'string') manifest.repo = m.repo;
  return { manifest };
}

/** A vault-relative path a plugin named: no leading slash, no `..`, `/` separators. Throws when it would leave the vault. */
export function cleanPluginPath(p: string): string {
  const parts = p.replace(/\\/g, '/').split('/').filter((s) => s && s !== '.');
  if (parts.some((s) => s === '..')) throw new Error(`${p}: outside the vault`);
  return parts.join('/');
}

export class PluginHost {
  private found = new Map<string, Found>();
  private enabled = new Set<string>();
  private instances = new Map<string, Instance>();
  private states = new Map<string, { state: PluginState; error?: string }>();
  private commands = new Map<string, Reg<A.CommandSpec>>();
  private actions = new Map<string, Reg<A.SelectionActionSpec>>();
  private blockHooks: (Reg<A.BlockHook> & { key: string })[] = [];
  private hookSeq = 0;
  private hooked = new WeakMap<HTMLElement, Map<string, string>>();
  private events = new Map<EventName, Reg<(...a: never[]) => unknown>[]>();
  private listeners = new Set<() => void>();
  private off: A.Dispose | null = null;
  private offQueue: A.Dispose | null = null;
  private quiet = new Map<string, number>();
  private reloads = new Map<string, ReturnType<typeof setTimeout>>();
  private enabledTimer: ReturnType<typeof setTimeout> | null = null;
  private selection: A.Selection | null = null;
  /** Bumped on any change the UI should draw. */
  version = 0;

  constructor(readonly vault: Vault, readonly bridge: Bridge) {}

  // ── lifecycle ───────────────────────────────────────────────────

  /** Read the enable list and the folders, start what is on, and follow the files from here. */
  async start(): Promise<void> {
    this.enabled = new Set(await this.readEnabled());
    await this.scan();
    for (const id of this.found.keys()) if (this.enabled.has(id)) await this.activate(id);
    this.off = this.vault.subscribe((ev) => this.onVault(ev));
    this.offQueue = this.bridge.onQueue(() => this.emit('queue'));
    this.bump();
  }

  /** The vault closes: every plugin is deactivated, nothing is written. */
  stop(): void {
    for (const id of [...this.instances.keys()]) this.teardown(id);
    for (const t of this.reloads.values()) clearTimeout(t);
    this.reloads.clear();
    if (this.enabledTimer) clearTimeout(this.enabledTimer);
    this.off?.();
    this.off = null;
    this.offQueue?.();
    this.offQueue = null;
    this.bump();
  }

  subscribe(fn: () => void): A.Dispose {
    this.listeners.add(fn);
    return () => this.listeners.delete(fn);
  }

  private bump(): void {
    this.version++;
    for (const fn of this.listeners) fn();
  }

  // ── the folders ─────────────────────────────────────────────────

  private abs(rel: string): string {
    return this.vault.abs(rel);
  }

  private folderOf(id: string): string {
    return `${PLUGINS_DIR}/${id}`;
  }

  private async readText(rel: string): Promise<string | null> {
    const abs = this.abs(rel);
    const st = await this.vault.fs.stat(abs);
    if (!st || st.isDir) return null;
    return this.vault.fs.readText(abs);
  }

  /** Write one of the runtime's own files, and ignore the watcher's echo of it. */
  private async writeOwn(rel: string, text: string): Promise<void> {
    this.quiet.set(rel, Date.now() + QUIET_MS);
    await this.vault.fs.mkdir(this.abs(dirOf(rel)));
    await this.vault.fs.writeText(this.abs(rel), text);
  }

  private async readEnabled(): Promise<string[]> {
    try {
      const text = await this.readText(ENABLED_FILE);
      if (text === null) return [];
      const raw: unknown = JSON.parse(text);
      return Array.isArray(raw) ? raw.filter((x): x is string => typeof x === 'string' && ID_RE.test(x)) : [];
    } catch {
      return [];
    }
  }

  private saveEnabled(): Promise<void> {
    return this.writeOwn(ENABLED_FILE, `${JSON.stringify([...this.enabled], null, 2)}\n`);
  }

  private async scanOne(id: string): Promise<Found | null> {
    const st = await this.vault.fs.stat(this.abs(this.folderOf(id)));
    if (!st?.isDir) return null;
    const text = await this.readText(`${this.folderOf(id)}/${MANIFEST}`);
    if (text === null) return { id, manifest: null, manifestText: '', error: 'no plugin.json' };
    const r = parseManifest(text, id);
    return 'error' in r ? { id, manifest: null, manifestText: text, error: r.error } : { id, manifest: r.manifest, manifestText: text };
  }

  private async scan(): Promise<void> {
    const dir = this.abs(PLUGINS_DIR);
    const st = await this.vault.fs.stat(dir);
    const next = new Map<string, Found>();
    if (st?.isDir) {
      for (const e of await this.vault.fs.readDir(dir)) {
        if (!e.isDir || e.name.startsWith('.')) continue;
        const f = await this.scanOne(e.name);
        if (f) next.set(e.name, f);
      }
    }
    this.found = next;
  }

  // ── what the UI reads ───────────────────────────────────────────

  rows(): PluginRow[] {
    const out: PluginRow[] = [];
    for (const f of [...this.found.values()].sort((a, b) => a.id.localeCompare(b.id))) {
      const inst = this.instances.get(f.id);
      const st = this.states.get(f.id);
      const row: PluginRow = {
        id: f.id,
        name: f.manifest?.name ?? f.id,
        version: f.manifest?.version ?? '',
        enabled: this.enabled.has(f.id),
        state: f.manifest ? st?.state ?? 'off' : 'broken',
        hasSettings: !!inst && inst.settingsBuilders.length > 0,
      };
      if (f.manifest?.author !== undefined) row.author = f.manifest.author;
      if (f.manifest?.description !== undefined) row.description = f.manifest.description;
      const error = f.error ?? st?.error;
      if (error !== undefined) row.error = error;
      out.push(row);
    }
    return out;
  }

  private nameOf(id: string): string {
    return this.found.get(id)?.manifest?.name ?? id;
  }

  // ── on and off ──────────────────────────────────────────────────

  async setEnabled(id: string, on: boolean): Promise<void> {
    if (on) this.enabled.add(id);
    else this.enabled.delete(id);
    await this.saveEnabled();
    if (on) await this.activate(id);
    else this.deactivate(id);
    this.bump();
  }

  /** Re-read a plugin's files and start it again, for its author. */
  async reload(id: string): Promise<void> {
    this.deactivate(id);
    const f = await this.scanOne(id);
    if (f) this.found.set(id, f);
    else this.found.delete(id);
    if (f && this.enabled.has(id)) await this.activate(id);
    if (f) this.bridge.notice(`reloaded · ${this.nameOf(id)}`);
    this.bump();
  }

  private async activate(id: string): Promise<void> {
    if (this.instances.has(id)) return;
    const f = this.found.get(id);
    if (!f?.manifest) return;
    if (f.manifest.api !== API) {
      this.states.set(id, { state: 'refused', error: `written for api ${f.manifest.api}, this is api ${API}` });
      this.bridge.notice(`${f.manifest.name} was written for api ${f.manifest.api}, this is api ${API}`);
      this.bump();
      return;
    }
    const folder = this.folderOf(id);
    const mainText = await this.readText(`${folder}/${MAIN}`);
    if (mainText === null) {
      this.states.set(id, { state: 'failed', error: 'no main.js' });
      this.bridge.notice(`${f.manifest.name}: no main.js`);
      this.bump();
      return;
    }
    const styleText = await this.readText(`${folder}/${STYLE}`);
    const inst: Instance = {
      id,
      manifest: f.manifest,
      manifestText: f.manifestText,
      mainText,
      styleText,
      disposers: [],
      data: await this.readData(id),
      dataListeners: new Set(),
      settingsBuilders: [],
    };
    this.instances.set(id, inst);
    this.states.set(id, { state: 'on' });
    try {
      const mod = this.load(mainText);
      if (typeof mod.activate !== 'function') throw new Error('main.js exports no activate');
      if (styleText) inst.disposers.push(this.bridge.addStyle(id, styleText));
      const ret = await mod.activate(this.handle(inst));
      if (typeof ret === 'function' && this.instances.get(id) === inst) inst.disposers.push(ret);
    } catch (e) {
      this.fail(id, e);
      return;
    }
    this.bump();
  }

  /** Run a bundle as CommonJS. `require` serves nothing: a plugin bundles what it needs. */
  private load(code: string): Partial<A.PluginModule> {
    const module: { exports: Record<string, unknown> } = { exports: {} };
    const require = (name: string): never => {
      throw new Error(`require('${name}'): plugins bundle their dependencies`);
    };
    // eslint-disable-next-line @typescript-eslint/no-implied-eval
    const run = new Function('module', 'exports', 'require', `${code}\n`) as (m: typeof module, e: typeof module.exports, r: typeof require) => void;
    run(module, module.exports, require);
    const ex = module.exports;
    const def = ex.default;
    if (typeof ex.activate !== 'function' && def && typeof def === 'object' && typeof (def as Record<string, unknown>).activate === 'function') return def as Partial<A.PluginModule>;
    return ex as Partial<A.PluginModule>;
  }

  private deactivate(id: string): void {
    if (!this.instances.has(id)) return;
    this.teardown(id);
    this.states.set(id, { state: 'off' });
    this.bump();
  }

  /** Run the disposers and drop every registration; the state is the caller's to set. */
  private teardown(id: string): void {
    const inst = this.instances.get(id);
    if (!inst) return;
    this.instances.delete(id);
    for (const d of inst.disposers.reverse()) {
      try {
        d();
      } catch (e) {
        console.error(`plugin ${id}:`, e);
      }
    }
    for (const [k, r] of [...this.commands]) if (r.plugin === id) this.commands.delete(k);
    for (const [k, r] of [...this.actions]) if (r.plugin === id) this.actions.delete(k);
    this.blockHooks = this.blockHooks.filter((h) => h.plugin !== id);
    for (const [name, list] of this.events) this.events.set(name, list.filter((r) => r.plugin !== id));
    this.states.set(id, { state: 'off' });
  }

  /** A throw in `id`: logged, noticed, and the plugin is off for the session. */
  private fail(id: string, e: unknown): void {
    const msg = message(e);
    console.error(`plugin ${id}:`, e);
    this.teardown(id);
    this.states.set(id, { state: 'failed', error: msg });
    this.bridge.notice(`${this.nameOf(id)}: ${msg}`);
    this.bump();
  }

  /** Wrap a plugin's callback so a throw, sync or async, fails the plugin instead of the app. */
  private guard<T extends unknown[]>(id: string, fn: (...a: T) => unknown): (...a: T) => void {
    return (...a) => {
      if (!this.instances.has(id)) return;
      try {
        const r = fn(...a);
        if (r instanceof Promise) r.catch((err: unknown) => this.fail(id, err));
      } catch (err) {
        this.fail(id, err);
      }
    };
  }

  // ── registrations, as the UI reads them ────────────────────────

  pluginCommands(): PluginCommand[] {
    const out: PluginCommand[] = [];
    for (const [id, r] of this.commands) {
      const c: PluginCommand = { id, title: r.spec.name, plugin: this.nameOf(r.plugin) };
      if (r.spec.key !== undefined) c.key = r.spec.key;
      out.push(c);
    }
    return out;
  }

  /** True when `id` is a plugin's command; it runs. */
  runCommand(id: string): boolean {
    const r = this.commands.get(id);
    if (!r) return false;
    this.guard(r.plugin, r.spec.run.bind(r.spec))();
    return true;
  }

  /** The verbs for a selection, in registration order; `when` decides. */
  actionsFor(sel: A.Selection): PluginAction[] {
    const out: PluginAction[] = [];
    for (const [id, r] of [...this.actions]) {
      let show = true;
      if (r.spec.when) {
        try {
          show = !!r.spec.when(sel);
        } catch (e) {
          this.fail(r.plugin, e);
          continue;
        }
      }
      if (!show) continue;
      const a: PluginAction = { id, name: r.spec.name };
      if (r.spec.key !== undefined) a.key = r.spec.key;
      out.push(a);
    }
    return out;
  }

  runAction(id: string, sel: A.Selection): boolean {
    const r = this.actions.get(id);
    if (!r) return false;
    this.guard(r.plugin, r.spec.run.bind(r.spec))(sel);
    return true;
  }

  /** The command whose `key` is `key`, by its id. */
  commandByKey(match: (key: string) => boolean): string | null {
    for (const [id, r] of this.commands) if (r.spec.key !== undefined && match(r.spec.key)) return id;
    return null;
  }

  actionByKey(match: (key: string) => boolean, sel: A.Selection): string | null {
    for (const a of this.actionsFor(sel)) if (a.key !== undefined && match(a.key)) return a.id;
    return null;
  }

  /** Every hook, on a drawn block; a hook runs once per element until its text changes. */
  runBlockHooks(el: HTMLElement, ctx: A.BlockContext): void {
    if (!this.blockHooks.length) return;
    let seen = this.hooked.get(el);
    if (!seen) {
      seen = new Map();
      this.hooked.set(el, seen);
    }
    const text = el.textContent ?? '';
    for (const h of [...this.blockHooks]) {
      if (seen.get(h.key) === text) continue;
      seen.set(h.key, text);
      this.guard(h.plugin, h.spec)(el, ctx);
    }
  }

  hasBlockHooks(): boolean {
    return this.blockHooks.length > 0;
  }

  /** The lens's selection, as the reader or the PDF lens reports it. */
  setSelection(sel: A.Selection | null): void {
    const same = sel === this.selection || (!!sel && !!this.selection && sel.text === this.selection.text && sel.path === this.selection.path && sel.rect.top === this.selection.rect.top && sel.rect.left === this.selection.rect.left);
    this.selection = sel;
    if (!same) this.emit('lens.selection', sel);
  }

  currentSelection(): A.Selection | null {
    return this.selection;
  }

  /** An event from the app, to every plugin listening. */
  emit(name: 'grade', ev: A.GradeEvent): void;
  emit(name: 'read-on' | 'worked-on', ev: { element: A.QueueElement }): void;
  emit(name: 'lens.open', lens: A.Lens): void;
  emit(name: 'lens.selection', sel: A.Selection | null): void;
  emit(name: 'queue'): void;
  emit(name: EventName, ...args: unknown[]): void {
    for (const r of [...(this.events.get(name) ?? [])]) this.guard(r.plugin, r.spec as (...a: unknown[]) => unknown)(...args);
  }

  private on(id: string, name: EventName, fn: (...a: never[]) => unknown): A.Dispose {
    const reg: Reg<(...a: never[]) => unknown> = { plugin: id, spec: fn };
    this.events.set(name, [...(this.events.get(name) ?? []), reg]);
    return () => this.events.set(name, (this.events.get(name) ?? []).filter((r) => r !== reg));
  }

  // ── settings and data ───────────────────────────────────────────

  private dataPath(id: string): string {
    return `${this.folderOf(id)}/${DATA}`;
  }

  private async readData(id: string): Promise<A.StoreData> {
    try {
      const text = await this.readText(this.dataPath(id));
      if (text === null) return {};
      const raw: unknown = JSON.parse(text);
      return raw && typeof raw === 'object' && !Array.isArray(raw) ? (raw as A.StoreData) : {};
    } catch {
      return {};
    }
  }

  private async saveData(inst: Instance, data: A.StoreData): Promise<void> {
    inst.data = data;
    await this.writeOwn(this.dataPath(inst.id), `${JSON.stringify(data, null, 2)}\n`);
    this.notifyData(inst);
  }

  private notifyData(inst: Instance): void {
    for (const fn of [...inst.dataListeners]) this.guard(inst.id, fn)(inst.data);
    this.bump();
  }

  /** The controls under a plugin's row, built now. */
  settingsOf(id: string): SettingControl[] {
    const inst = this.instances.get(id);
    if (!inst) return [];
    const out: SettingControl[] = [];
    const s: A.Settings = {
      text: (key, label, opts) => out.push(opts?.placeholder !== undefined ? { kind: 'text', key, label, placeholder: opts.placeholder } : { kind: 'text', key, label }),
      toggle: (key, label) => out.push({ kind: 'toggle', key, label }),
      choice: (key, label, options) => out.push({ kind: 'choice', key, label, options }),
      note: (text) => out.push({ kind: 'note', text }),
    };
    for (const build of [...inst.settingsBuilders]) {
      try {
        build(s);
      } catch (e) {
        this.fail(id, e);
        return [];
      }
    }
    return out;
  }

  settingValue(id: string, key: string): unknown {
    return this.instances.get(id)?.data[key];
  }

  /** A control changed: the value lands in `data.json` and the plugin hears of it. */
  async setSetting(id: string, key: string, value: unknown): Promise<void> {
    const inst = this.instances.get(id);
    if (!inst) return;
    const next = { ...inst.data };
    if (value === undefined || value === '') delete next[key];
    else next[key] = value;
    await this.saveData(inst, next);
  }

  // ── adding one from a file ──────────────────────────────────────

  /**
   * Land a package (`plugin.json`, `main.js`, and optionally `style.css`,
   * `data.json`, by name) in `.ilmi/plugins/<id>/` and turn it on. A
   * missing manifest or bundle is refused; an id already here is refused
   * when the version is the same, and offered as a replacement when it
   * differs, unless `replace` is set.
   */
  async install(files: Map<string, string>, opts: { replace?: boolean } = {}): Promise<InstallResult> {
    const manifestText = files.get(MANIFEST);
    if (manifestText === undefined) return this.refuse('no plugin.json in that');
    const r = parseManifest(manifestText);
    if ('error' in r) return this.refuse(r.error);
    if (!files.has(MAIN)) return this.refuse('no main.js in that');
    const { manifest } = r;
    const have = this.found.get(manifest.id)?.manifest;
    if (have && !opts.replace) {
      if (have.version === manifest.version) {
        this.bridge.notice(`${manifest.name} ${manifest.version} is already here`);
        return { status: 'taken', id: manifest.id, name: manifest.name, version: manifest.version };
      }
      return { status: 'replace', id: manifest.id, name: manifest.name, have: have.version, incoming: manifest.version };
    }
    this.deactivate(manifest.id);
    const folder = this.folderOf(manifest.id);
    for (const name of PLUGIN_FILES) {
      const text = files.get(name);
      if (text !== undefined) await this.writeOwn(`${folder}/${name}`, text);
      else if (name === STYLE) await this.vault.fs.remove(this.abs(`${folder}/${name}`)).catch(() => {});
    }
    const f = await this.scanOne(manifest.id);
    if (f) this.found.set(manifest.id, f);
    this.enabled.add(manifest.id);
    await this.saveEnabled();
    await this.activate(manifest.id);
    this.bridge.notice(`added · ${manifest.name}`);
    this.bump();
    return { status: 'added', id: manifest.id, name: manifest.name };
  }

  private refuse(reason: string): InstallResult {
    this.bridge.notice(reason);
    return { status: 'refused', reason };
  }

  // ── the files on disk ───────────────────────────────────────────

  private onVault(ev: VaultEvent): void {
    if (ev.kind !== 'hidden') return;
    const now = Date.now();
    for (const rel of ev.paths) {
      const until = this.quiet.get(rel);
      if (until !== undefined) {
        if (now < until) continue;
        this.quiet.delete(rel);
      }
      if (rel === ENABLED_FILE) {
        if (this.enabledTimer) clearTimeout(this.enabledTimer);
        this.enabledTimer = setTimeout(() => { this.enabledTimer = null; void this.reconcileEnabled(); }, RELOAD_DELAY);
        continue;
      }
      if (rel === PLUGINS_DIR) {
        this.schedule('', () => this.reconcileFolders());
        continue;
      }
      if (!rel.startsWith(`${PLUGINS_DIR}/`)) continue;
      const [id, ...rest] = rel.slice(PLUGINS_DIR.length + 1).split('/');
      if (!id) continue;
      if (rest.join('/') === DATA) this.schedule(`${id}/${DATA}`, () => this.reloadData(id));
      else this.schedule(id, () => this.checkReload(id));
    }
  }

  private schedule(key: string, fn: () => Promise<void>): void {
    const prev = this.reloads.get(key);
    if (prev) clearTimeout(prev);
    this.reloads.set(key, setTimeout(() => {
      this.reloads.delete(key);
      fn().catch((e: unknown) => console.error(e));
    }, RELOAD_DELAY));
  }

  /** `plugins.json` changed on disk: what it turns on or off follows. */
  private async reconcileEnabled(): Promise<void> {
    const next = new Set(await this.readEnabled());
    const was = this.enabled;
    this.enabled = next;
    for (const id of next) if (!was.has(id)) await this.activate(id);
    for (const id of was) if (!next.has(id)) this.deactivate(id);
    this.bump();
  }

  /** The plugins directory itself changed: folders may have come or gone. */
  private async reconcileFolders(): Promise<void> {
    const before = new Set(this.found.keys());
    await this.scan();
    for (const id of before) if (!this.found.has(id)) this.gone(id);
    for (const id of this.found.keys()) if (!before.has(id) && this.enabled.has(id)) await this.activate(id);
    this.bump();
  }

  private gone(id: string): void {
    const name = this.nameOf(id);
    this.teardown(id);
    this.found.delete(id);
    this.states.delete(id);
    this.bridge.notice(`removed · ${name}`);
  }

  /** A plugin's files changed on disk: reloaded when it is running and anything differs. */
  private async checkReload(id: string): Promise<void> {
    const f = await this.scanOne(id);
    if (!f) {
      if (this.found.has(id)) this.gone(id);
      this.bump();
      return;
    }
    const inst = this.instances.get(id);
    this.found.set(id, f);
    if (inst) {
      const folder = this.folderOf(id);
      const main = await this.readText(`${folder}/${MAIN}`);
      const style = await this.readText(`${folder}/${STYLE}`);
      if (f.manifestText === inst.manifestText && main === inst.mainText && style === inst.styleText) return;
      this.teardown(id);
      await this.activate(id);
      if (this.instances.has(id)) this.bridge.notice(`reloaded · ${this.nameOf(id)}`);
    } else if (this.enabled.has(id) && f.manifest && this.states.get(id)?.state !== 'failed') {
      await this.activate(id);
    }
    this.bump();
  }

  private async reloadData(id: string): Promise<void> {
    const inst = this.instances.get(id);
    if (!inst) return;
    const data = await this.readData(id);
    if (JSON.stringify(data) === JSON.stringify(inst.data)) return;
    inst.data = data;
    this.notifyData(inst);
  }

  // ── the handle ──────────────────────────────────────────────────

  private handle(inst: Instance): A.Ilmi {
    const id = inst.id;
    const keep = (d: A.Dispose): A.Dispose => {
      let done = false;
      const once = () => { if (!done) { done = true; d(); } };
      inst.disposers.push(once);
      return once;
    };
    const vault = this.vault;
    const live = () => {
      if (this.instances.get(id) !== inst) throw new Error(`${inst.manifest.name} is off`);
    };
    const docOf = async (path: string): Promise<FDoc> => structuredClone((await vault.read(cleanPluginPath(path))).doc);
    const ensureDoc = async (path: string): Promise<string> => {
      const rel = cleanPluginPath(path);
      if (!isDoc(rel)) throw new Error(`${rel}: not a document`);
      if (await vault.fs.stat(vault.abs(rel))) return rel;
      // the folders on the way are made too (`words/arabic.md` in a vault without `words/`)
      let dir = '';
      for (const seg of dirOf(rel).split('/').filter(Boolean)) dir = await vault.folderIn(dir, seg);
      return vault.createDoc(dir, 'deck', nameOf(rel));
    };

    const vaultApi: A.VaultApi = {
      name: baseOf(vault.root) || 'vault',
      list: () => vault.documents(),
      read: async (path) => {
        const rel = cleanPluginPath(path);
        const text = await this.readText(rel);
        if (text === null) throw new Error(`${rel}: no such file`);
        return text;
      },
      write: async (path, text) => {
        const rel = cleanPluginPath(path);
        if (isDoc(rel) && (await vault.fs.stat(vault.abs(rel)))) {
          await vault.update(rel, (doc) => {
            const next = parse(text).doc;
            delete doc.frontmatter;
            if (next.frontmatter) doc.frontmatter = next.frontmatter;
            doc.blocks = next.blocks;
          });
          return;
        }
        await vault.fs.mkdir(vault.abs(dirOf(rel)));
        await vault.fs.writeText(vault.abs(rel), text);
        if (isDoc(rel)) await vault.changed([rel]);
      },
      create: async (path, text) => {
        const rel = cleanPluginPath(path);
        if (await vault.fs.stat(vault.abs(rel))) throw new Error(`${rel}: already there`);
        if (isDoc(rel)) {
          const made = await vault.createDoc(dirOf(rel), 'source', nameOf(rel));
          const next = parse(text).doc;
          await vault.update(made, (doc) => {
            delete doc.frontmatter;
            if (next.frontmatter) doc.frontmatter = next.frontmatter;
            doc.blocks = next.blocks;
          });
          return made;
        }
        await vault.fs.mkdir(vault.abs(dirOf(rel)));
        await vault.fs.writeText(vault.abs(rel), text);
        return rel;
      },
      remove: async (path) => {
        const rel = cleanPluginPath(path);
        if (isDoc(rel) || vault.documents().some((d) => d.startsWith(`${rel}/`))) await vault.remove(rel);
        else await vault.fs.remove(vault.abs(rel));
      },
      rename: (path, name) => vault.rename(cleanPluginPath(path), name),
      watch: (fn) => keep(vault.subscribe((ev) => {
        if (ev.kind === 'hidden' || ev.kind === 'order') return;
        const out: A.VaultEvent = ev.kind === 'tree' ? { kind: 'tree' } : ev.kind === 'moved' ? { kind: 'moved', from: ev.from, to: ev.to } : { kind: ev.kind, path: ev.path };
        this.guard(id, fn)(out);
      })),
      doc: (path) => docOf(path) as Promise<A.Doc>,
      update: async (path, fn) => {
        await vault.update(cleanPluginPath(path), (doc) => fn(doc as unknown as A.Doc));
      },
      addCard: async (deck, text, opts) => {
        const body = text.trim();
        if (!cardFields(body)) throw new Error(`not a card: ${body.slice(0, 40)}`);
        const rel = await ensureDoc(deck.endsWith('.md') ? deck : `${deck}.md`);
        const loaded = await vault.update(rel, (doc) => {
          doc.blocks.push(opts?.sched ? { kind: 'card', text: body, sched: { ...opts.sched } } : { kind: 'card', text: body });
        });
        return loaded.doc.blocks.length - 1;
      },
      addSource: (folder, spec) => vault.importDoc(cleanPluginPath(folder), { title: spec.title, text: spec.text }),
    };

    const format: A.Format = {
      parse: (text) => parse(text) as unknown as ReturnType<A.Format['parse']>,
      serialize: (doc) => serialize(doc as unknown as FDoc),
      cardForm: (text) => cardFields(text)?.form ?? null,
      cardFields: (text) => cardFields(text) as A.CardFields | null,
      setField: (doc, key, value) => setField(doc as unknown as FDoc, key as FieldKey, value as never),
      meta: (doc) => meta(doc as unknown as FDoc),
    };

    const store: A.StoreApi = {
      load: async () => {
        inst.data = await this.readData(id);
        return { ...inst.data };
      },
      save: async (data) => {
        live();
        await this.saveData(inst, { ...data });
      },
      get: <T,>(key: string) => inst.data[key] as T | undefined,
      on: (_event, fn) => {
        inst.dataListeners.add(fn);
        return keep(() => inst.dataListeners.delete(fn));
      },
    };

    const ui: A.UiApi = {
      notice: (text) => this.bridge.notice(text),
      popover: (rect, el) => {
        live();
        const p = this.bridge.popover(rect, el);
        const off = keep(() => p.close());
        return { el: p.el, close: off };
      },
      modal: (el) => {
        live();
        const p = this.bridge.modal(el);
        const off = keep(() => p.close());
        return { el: p.el, close: off };
      },
      settings: (build) => {
        live();
        inst.settingsBuilders.push(build);
        this.bump();
        return keep(() => {
          inst.settingsBuilders = inst.settingsBuilders.filter((b) => b !== build);
          this.bump();
        });
      },
    };

    const lens: A.LensApi = {
      active: () => this.bridge.activeLens(),
      open: (path) => this.bridge.openLens(cleanPluginPath(path)),
      on: ((event: 'open' | 'selection', fn: (...a: never[]) => unknown) => keep(this.on(id, event === 'open' ? 'lens.open' : 'lens.selection', fn))) as A.LensApi['on'],
    };

    const session: A.SessionApi = {
      current: () => this.bridge.current(),
      on: ((event: 'grade' | 'read-on' | 'worked-on', fn: (...a: never[]) => unknown) => keep(this.on(id, event, fn))) as A.SessionApi['on'],
    };

    const queue: A.QueueApi = {
      today: () => this.bridge.today(),
      on: (_event, fn) => keep(this.on(id, 'queue', fn)),
    };

    return {
      version: this.bridge.version,
      api: API,
      manifest: { ...inst.manifest },
      commands: {
        add: (spec) => {
          live();
          if (!spec.id || typeof spec.run !== 'function') throw new Error('a command needs an id and run');
          const key = `${COMMAND_PREFIX}${id}:${spec.id}`;
          this.commands.set(key, { plugin: id, spec });
          this.bump();
          return keep(() => { this.commands.delete(key); this.bump(); });
        },
      },
      selection: {
        addAction: (spec) => {
          live();
          if (!spec.id || typeof spec.run !== 'function') throw new Error('an action needs an id and run');
          if (spec.key !== undefined && RESERVED_ACTION_KEYS.includes(spec.key.toLowerCase())) throw new Error(`the key ${spec.key} belongs to the cue`);
          const key = `${id}:${spec.id}`;
          this.actions.set(key, { plugin: id, spec });
          this.bump();
          return keep(() => { this.actions.delete(key); this.bump(); });
        },
      },
      render: {
        onBlock: (fn) => {
          live();
          const h = { plugin: id, spec: fn, key: `${id}:${++this.hookSeq}` };
          this.blockHooks.push(h);
          this.bump();
          return keep(() => { this.blockHooks = this.blockHooks.filter((x) => x !== h); this.bump(); });
        },
      },
      vault: vaultApi,
      queue,
      session,
      lens,
      ui,
      net: { fetch: (url, init) => this.bridge.fetch(url, init) },
      store,
      format,
      onDeactivate: (fn) => keep(fn),
    };
  }
}

/** The files of a plugin folder on disk, by name, for `install` from a picked directory. */
export async function readPluginFolder(fs: Vault['fs'], dir: string): Promise<Map<string, string>> {
  const out = new Map<string, string>();
  for (const name of PLUGIN_FILES) {
    const abs = `${dir.replace(/\/$/, '')}/${name}`;
    const st = await fs.stat(abs);
    if (st && !st.isDir) out.set(name, await fs.readText(abs));
  }
  return out;
}
