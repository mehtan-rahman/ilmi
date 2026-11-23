// Plugins in the app: the one runtime over the open vault, the bridge that
// gives it the app's notices, surfaces, queue, session, lenses, and
// network, the key map for what plugins register, and the small functions
// the lenses call to hand a selection or a drawn block to the plugins.
// `runtime.ts` is the pure side; this file is the only one that knows the
// store and Tauri. The scheduler slot (`scheduler.ts`) is started here with
// the plugins, since a plugin may fill it: the collection's choice read
// from `.ilmi/scheduler.json`, the scores laid over the queue as it is
// built (`laySlot`), and a card's `back in` words for the session.

import { invoke } from '@tauri-apps/api/core';
import { open as pickPath } from '@tauri-apps/plugin-dialog';
import { fetch as httpFetch } from '@tauri-apps/plugin-http';
import { useEffect, useState, useSyncExternalStore } from 'react';
import { appNow } from '../app/clock.js';
import { dueToday, gapLabel, gapOfDue } from '../app/items.js';
import { cardsPath, kindOf, tabKindOf } from '../app/names.js';
import { activeTab } from '../app/panes.js';
import { useApp } from '../app/store.js';
import { note, openNode, optionsAt, refreshQueue } from '../app/vault.js';
import type { Card, CardSchedule, Review } from '../format/index.js';
import { FSRS7_ID, applyScores, dayOf, isDay, preview, schedCardOf, type CardItem, type Grade, type QueueItem, type ReadItem, type SchedCard, type Scheduler, type SectionItem, type WriteItem } from '../schedule/index.js';
import { tauriFs } from '../vault/tauri-fs.js';
import type { Vault } from '../vault/index.js';
import type * as A from './api.js';
import { contextOf, keyMatches, parseKey } from './context.js';
import { PluginHost, readPluginFolder, type Bridge, type InstallResult } from './runtime.js';
import { SCHEDULER_FILE, SchedulerSlot, chosenIn, formatSchedulerFile, parseSchedulerFile } from './scheduler.js';
import { fsrs7, readFsrs7 } from './fsrs7.js';
import { addStyle, closeSurfaces, showModal, showPopover } from './surfaces.js';
import './plugins.css';
import conf from '../../src-tauri/tauri.conf.json';

export type { Ilmi, Selection as PluginSelection, BlockContext } from './api.js';
export { PluginHost, type PluginRow, type PluginCommand, type PluginAction, type SettingControl, type InstallResult, COMMAND_PREFIX } from './runtime.js';
export { BUILT_IN, SchedulerSlot, type SchedulerRow } from './scheduler.js';
export { fitOffer, fitToReviews, fsrs7Fit, fsrs7Fitting } from './fsrs7.js';

/** The app's version, as `ilmi.version`: `src-tauri/tauri.conf.json`'s, the one every platform's build takes. */
export const APP_VERSION: string = conf.version;

let host: PluginHost | null = null;
let slot: SchedulerSlot | null = null;
let offSlot: (() => void)[] = [];
let offHost: (() => void) | null = null;
let offLens: (() => void) | null = null;
let tick = 0;
const uiListeners = new Set<() => void>();

const bumpUi = () => {
  tick++;
  for (const fn of uiListeners) fn();
};

/** The runtime for the open vault, or null. */
export function pluginHost(): PluginHost | null {
  return host;
}

/** The runtime, re-rendering the caller whenever plugins or their registrations change. */
export function usePlugins(): PluginHost | null {
  useSyncExternalStore(
    (fn) => { uiListeners.add(fn); return () => uiListeners.delete(fn); },
    () => tick,
  );
  return host;
}

function toElement(item: QueueItem): A.QueueElement {
  // a section that comes back is reading to a plugin, its heading's block named
  const out: A.QueueElement = { kind: item.kind === 'section' ? 'read' : item.kind, path: item.path, due: item.dueAt.toISOString(), pri: item.pri };
  // a passage is in no document's blocks
  if (item.kind === 'section' && !item.passage) out.block = item.block;
  if (item.kind === 'card') {
    out.block = item.block;
    out.text = item.text;
  }
  return out;
}

function lensOf(): A.Lens | null {
  const s = useApp.getState();
  const id = activeTab(s.panes)?.id;
  if (id === undefined) return null;
  // the card view is its document's to a plugin: the lens kinds are the API's (`api.ts`)
  const cards = cardsPath(id);
  if (cards !== null) return { path: cards, kind: kindOf(cards, s.docs) };
  return { path: id, kind: tabKindOf(id, s.docs) as A.LensKind };
}

const bridge: Bridge = {
  version: APP_VERSION,
  notice: (text) => note(text),
  fetch: (url, init) => httpFetch(url, init),
  today: () => {
    const s = useApp.getState();
    return dueToday(s.queue, new Date(), s.budget).map(toElement);
  },
  onQueue: (fn) => useApp.subscribe((s, p) => { if (s.queue !== p.queue) fn(); }),
  current: () => {
    const el = useApp.getState().sessionEl;
    return el ? toElement(el.item) : null;
  },
  activeLens: lensOf,
  openLens: (path) => openNode(path),
  popover: showPopover,
  modal: showModal,
  addStyle,
};

const inField = (t: EventTarget | null) => {
  const el = t as HTMLElement | null;
  const tag = el?.tagName?.toLowerCase();
  return tag === 'input' || tag === 'textarea' || tag === 'select' || !!el?.isContentEditable;
};

/** Keys plugins bound: an action's while a selection is up, else a command's. The cue's own `e` and `m` never reach here. */
function onKey(e: KeyboardEvent): void {
  if (!host || e.defaultPrevented || inField(e.target)) return;
  if (document.activeElement?.closest('.plug-pop, .plug-modal')) return;
  const match = (spec: string) => {
    const k = parseKey(spec);
    return !!k && keyMatches(k, e);
  };
  const sel = host.currentSelection();
  if (sel && !e.metaKey && !e.ctrlKey && !e.altKey) {
    const a = host.actionByKey(match, sel);
    if (a) {
      e.preventDefault();
      host.runAction(a, sel);
      for (const fn of actionListeners) fn();
      return;
    }
  }
  const c = host.commandByKey(match);
  if (c) {
    e.preventDefault();
    host.runCommand(c);
  }
}

let keysOn = false;
const actionListeners = new Set<() => void>();

/** A lens hears when a plugin's verb ran from its key, to put its cue away as a click on the verb does. */
export function onPluginAction(fn: () => void): () => void {
  actionListeners.add(fn);
  return () => { actionListeners.delete(fn); };
}

/** Start the runtime over `vault`: the enable list is read, what is on runs. Called by `openVault`. */
export async function startPlugins(vault: Vault): Promise<PluginHost> {
  stopPlugins();
  const s = await startSlot(vault);
  const h = new PluginHost(vault, { ...bridge, scheduler: { register: (plugin, spec) => s.register(plugin, spec as unknown as Scheduler), history: () => s.history() }, cache: cacheOf(vault), pickFile });
  host = h;
  offHost = h.subscribe(bumpUi);
  let lastLens = lensOf()?.path;
  offLens = useApp.subscribe((s) => {
    const id = activeTab(s.panes)?.id;
    if (id === lastLens) return;
    lastLens = id;
    const lens = lensOf();
    if (lens && host === h) h.emit('lens.open', lens);
  });
  if (!keysOn) {
    window.addEventListener('keydown', onKey);
    keysOn = true;
  }
  await h.start();
  // what is on has registered: a choice that is still not here is said, once
  if (slot === s) s.settle();
  bumpUi();
  return h;
}

/** The vault closes: every plugin is deactivated. */
export function stopPlugins(): void {
  if (!host) {
    stopSlot();
    return;
  }
  closeSurfaces();
  host.stop();
  stopSlot();
  offHost?.();
  offLens?.();
  offHost = null;
  offLens = null;
  host = null;
  bumpUi();
}

// ── the scheduler slot ──────────────────────────────────────────

async function readSchedulerFile(vault: Vault): Promise<Record<string, unknown>> {
  try {
    const abs = vault.abs(SCHEDULER_FILE);
    const st = await vault.fs.stat(abs);
    return parseSchedulerFile(st && !st.isDir ? await vault.fs.readText(abs) : null);
  } catch {
    return {};
  }
}

/** `.ilmi/scheduler.json` as the open collection has it, for whoever keeps something there (the choice here, a fit's weights). */
export async function schedulerFile(): Promise<Record<string, unknown>> {
  return slotVault ? readSchedulerFile(slotVault) : {};
}

/** Change `.ilmi/scheduler.json`: `change` gets what it holds and gives what it should; unknown keys stay. */
export async function writeSchedulerFile(change: (data: Record<string, unknown>) => Record<string, unknown>): Promise<void> {
  const vault = slotVault;
  if (!vault) return;
  const next = change({ ...(await readSchedulerFile(vault)) });
  await vault.fs.mkdir(vault.abs('.ilmi'));
  await vault.fs.writeText(vault.abs(SCHEDULER_FILE), formatSchedulerFile(next));
}

let slotVault: Vault | null = null;

async function startSlot(vault: Vault): Promise<SchedulerSlot> {
  const s = new SchedulerSlot({
    notice: (text) => note(text),
    // never inside the queue's own build, or a store update
    changed: () => queueMicrotask(() => { if (slot === s) refreshQueue(); }),
    now: appNow,
    fail: (owner, e) => host?.failed(owner, e),
  });
  slot = s;
  slotVault = vault;
  offSlot.push(s.subscribe(bumpUi));
  const read = async (settle: boolean) => {
    const data = await readSchedulerFile(vault);
    if (slot !== s) return;
    // FSRS-7's weights, fitted here or on another device: it answers by them from now
    if (readFsrs7(data)) s.restart(FSRS7_ID);
    s.choose(chosenIn(data));
    // a choice synced in may come with its plugin: said missing only if it still is, a little later
    if (settle) setTimeout(() => { if (slot === s) s.settle(); }, 1500);
  };
  await read(false);
  // what the app carries beside the plugins': FSRS-7 (`schedule/fsrs7.ts`)
  s.register(null, fsrs7);
  offSlot.push(vault.subscribe((ev) => { if (ev.kind === 'hidden' && ev.paths.includes(SCHEDULER_FILE)) void read(true); }));
  return s;
}

function stopSlot(): void {
  for (const off of offSlot) off();
  offSlot = [];
  slot?.stop();
  slot = null;
  slotVault = null;
}

/** A plugin's cache on this device (`cache.rs`): under the app's data directory, by the collection's folder name, or (`device`) by none. */
function cacheOf(vault: Vault): NonNullable<Bridge['cache']> {
  const enc = encodeURIComponent;
  // no collection named is the device's own
  const of = (device?: boolean) => (device ? null : vault.root);
  return {
    get: async (plugin, key, device) => {
      // a byte before what was kept says that something was
      const got = new Uint8Array(await invoke<ArrayBuffer>('plugin_cache_get', { collection: of(device), plugin, key }));
      return got.length ? got.slice(1) : null;
    },
    put: (plugin, key, bytes, device) => invoke<void>('plugin_cache_put', bytes, { headers: { ...(device ? {} : { collection: enc(vault.root) }), plugin: enc(plugin), key: enc(key) } }),
    remove: (plugin, key, device) => invoke<void>('plugin_cache_remove', { collection: of(device), plugin, key }),
  };
}

/** One file from the system's picker, read by path on the Rust side as a dropped one is. */
async function pickFile(opts?: { extensions?: readonly string[] }): Promise<A.PickedFile | null> {
  const ext = opts?.extensions?.map((e) => e.replace(/^\./, '')).filter(Boolean) ?? [];
  const path = await pickPath({ directory: false, multiple: false, ...(ext.length ? { filters: [{ name: ext.join(' '), extensions: ext }] } : {}) });
  if (typeof path !== 'string') return null;
  const bytes = new Uint8Array(await invoke<ArrayBuffer>('read_dropped_bytes', { path }));
  let name = path.slice(path.lastIndexOf('/') + 1);
  try { name = decodeURIComponent(name); } catch { /* as it is */ }
  return { name, bytes };
}

/** The slot of the open collection, or null. */
export function schedulerSlot(): SchedulerSlot | null {
  return slot;
}

/** The slot, re-rendering the caller when its schedulers or the choice change. */
export function useScheduler(): SchedulerSlot | null {
  usePlugins();
  return slot;
}

/** The collection's choice made here: kept in `.ilmi/scheduler.json`, so every device means the same one. */
export async function chooseScheduler(id: string | null): Promise<void> {
  if (!slot) return;
  slot.choose(id, true);
  await writeSchedulerFile((data) => {
    if (id === null) delete data.scheduler;
    else data.scheduler = id;
    return data;
  }).catch((e: unknown) => note(`could not keep that: ${e instanceof Error ? e.message : String(e)}`));
}

/** Whether another scheduler than the built in is in use: the queue then lays its scores over its own copies of the cards. */
export function slotInUse(): boolean {
  return !!slot?.active();
}

/**
 * The scheduler in use over a queue being built, in place (`items` are the
 * caller's copies): it is told the log as it is, asked about these cards
 * for next time, and what it has said so far is laid over them
 * (`applyScores`). Nothing waits: cards it has not scored yet are the built
 * in's. False when nothing was laid. `ask` false: a part of the queue (a
 * deck's session), laid with what the whole queue's asking has brought.
 */
export function laySlot(items: QueueItem[], log: readonly Review[], now: Date, ask = true): boolean {
  const s = slot;
  if (!s) return false;
  try {
    s.setLog(log);
    if (!s.active()) return false;
    const retentionOf = (path: string) => optionsAt(path).opts.retention;
    const sameDayOf = (path: string) => optionsAt(path).opts.sameDay;
    const index = s.histories();
    const cards: SchedCard[] = [];
    const by = new Map<QueueItem, SchedCard>();
    for (const i of items) {
      const c = schedCardOf(i, index, retentionOf(i.path));
      if (c) { cards.push(c); by.set(i, c); }
    }
    if (ask) s.request(cards);
    if (!s.scored()) return false;
    return applyScores(items, (i) => { const c = by.get(i); return c && s.scoreOf(c.id, c.key, i.sched.last); }, retentionOf, now, sameDayOf) > 0;
  } catch (e) {
    console.error('scheduler', e);
    return false;
  }
}

/**
 * Schedule lines (the numbers' `Line`s) with the day the scheduler in use
 * brings each back in place of the built in's, where it says one: what is
 * ahead (the forecast) then counts its days. The lines themselves where
 * the built in is in use.
 */
export function slotDues<T extends { path: string; card: { id?: string }; key?: string; sched?: CardSchedule }>(lines: T[], now: Date): T[] {
  const s = slot;
  if (!s?.active() || !s.scored()) return lines;
  const today = dayOf(now);
  return lines.map((l) => {
    if (l.card.id === undefined || !l.sched) return l;
    const score = s.scoreOf(l.card.id, l.key, l.sched.last);
    if (!score) return l;
    const due = score.recall !== undefined && score.recall <= optionsAt(l.path).opts.retention ? today : score.due;
    return due === undefined ? l : { ...l, sched: { ...l.sched, due } };
  });
}

const GRADES: readonly Grade[] = [1, 2, 3, 4];

/**
 * The four buttons' `back in` words for a session's card when another
 * scheduler than the built in has it: what its `preview` says, nothing
 * while that is on its way or where it has none (never the built in's
 * days under another's dates). A grade that puts the card into its
 * learning steps says the step, whoever schedules: the steps are the
 * app's, and the card is back in the session by them. Undefined when the
 * card is the built in's: no scheduler in use, a new card, one in its
 * steps, one it has no word on.
 */
export function useSlotGaps(item: CardItem, sched: CardSchedule | undefined, now: Date): Record<Grade, string> | undefined {
  const s = useScheduler();
  const card = s?.active() && sched ? schedCardOf({ ...item, sched }, s.histories(), optionsAt(item.path).opts.retention) : null;
  const key = card && s!.scoreOf(card.id, card.key, sched?.last) ? `${s!.version}\n${card.id}\n${card.key ?? ''}\n${sched?.last ?? ''}` : null;
  const [got, setGot] = useState<{ key: string; dues: Record<Grade, string> | null } | null>(null);
  useEffect(() => {
    if (!key || !card || !s) return;
    let live = true;
    void s.preview(card).then((dues) => { if (live) setGot({ key, dues }); });
    return () => { live = false; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key]);
  if (!key || !card) return undefined;
  const dues = got?.key === key ? got.dues : null;
  const steps = preview(sched, now, { request_retention: card.retention });
  const out = {} as Record<Grade, string>;
  for (const g of GRADES) {
    const step = steps[g];
    out[g] = step.due && !isDay(step.due) ? gapLabel(step, now) : dues ? gapOfDue(dues[g], now) : '';
  }
  return out;
}

// ── what the lenses hand over ───────────────────────────────────

/** What a lens knows about its selection; `blockText` is the block or line it sits in, for the context. */
export interface LensSelection {
  path: string;
  text: string;
  rect: A.Rect;
  block: number | null;
  blockText?: string;
  page?: number;
}

/** The plugins' view of a lens selection, with the sentence around it. */
export function toPluginSelection(s: LensSelection): A.Selection {
  const r = s.rect;
  const out: A.Selection = {
    text: s.text,
    path: s.path,
    block: s.block,
    rect: { top: r.top, left: r.left, bottom: r.bottom, right: r.right, width: r.width, height: r.height },
    context: contextOf(s.blockText ?? '', s.text),
  };
  if (s.page !== undefined) out.page = s.page;
  return out;
}

/** The reader or the PDF lens reports its selection, or that there is none. */
export function publishSelection(sel: A.Selection | null): void {
  host?.setSelection(sel);
}

/** A block was drawn: every plugin's `onBlock` sees it. */
export function runBlockHooks(el: HTMLElement, ctx: A.BlockContext): void {
  host?.runBlockHooks(el, ctx);
}

/** True when some plugin wants drawn blocks; the lenses skip the walk otherwise. */
export function wantsBlocks(): boolean {
  return !!host?.hasBlockHooks();
}

/** A card was graded in the session. */
export function emitGrade(item: CardItem, grade: Grade, card: Card | null): void {
  host?.emit('grade', { element: toElement(item), grade, card: card as A.Card | null });
}

/** A topic was read on, or a draft worked on. */
export function emitDocAction(item: ReadItem | WriteItem | SectionItem): void {
  host?.emit(item.kind === 'write' ? 'worked-on' : 'read-on', { element: toElement(item) });
}

// ── the palette ─────────────────────────────────────────────────

/** Plugin commands as the palette lists them. */
export function pluginCommands(): { id: string; title: string }[] {
  return host?.pluginCommands().map((c) => ({ id: c.id, title: c.title })) ?? [];
}

export function runPluginCommand(id: string): boolean {
  return host?.runCommand(id) ?? false;
}

// ── adding one from a file ──────────────────────────────────────

interface ZipRead { files: { name: string; text: string }[] }

/** The files of a `.zip` (read on the Rust side) or a folder, by name. */
export async function readPluginPackage(path: string): Promise<Map<string, string>> {
  if (/\.zip$/i.test(path)) {
    const r = await invoke<ZipRead>('read_plugin_zip', { path });
    return new Map(r.files.map((f) => [f.name, f.text]));
  }
  // a picked folder is in the fs scope already; a dropped one is widened here, as a vault is
  await invoke('allow_vault', { path });
  return readPluginFolder(tauriFs, path);
}

/** Land the package at `path`; the result says whether a `replace` is on offer. */
export async function addPluginFromPath(path: string, opts: { replace?: boolean } = {}): Promise<InstallResult | null> {
  if (!host) return null;
  try {
    const files = await readPluginPackage(path);
    return await host.install(files, opts);
  } catch (e) {
    note(`could not read that: ${e instanceof Error ? e.message : String(e)}`);
    return null;
  }
}

/** Dev only: the smoke drops a package through here, since the OS drop and the picker cannot be faked. */
export const pluginHooks: { addFromPath?: (path: string) => Promise<void> } = {};
