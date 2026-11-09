// Plugins in the app: the one runtime over the open vault, the bridge that
// gives it the app's notices, surfaces, queue, session, lenses, and
// network, the key map for what plugins register, and the small functions
// the lenses call to hand a selection or a drawn block to the plugins.
// `runtime.ts` is the pure side; this file is the only one that knows the
// store and Tauri.

import { invoke } from '@tauri-apps/api/core';
import { fetch as httpFetch } from '@tauri-apps/plugin-http';
import { useSyncExternalStore } from 'react';
import { dueToday } from '../app/items.js';
import { cardsPath, kindOf, tabKindOf } from '../app/names.js';
import { activeTab } from '../app/panes.js';
import { useApp } from '../app/store.js';
import { note, openNode } from '../app/vault.js';
import type { Card } from '../format/index.js';
import type { CardItem, Grade, QueueItem, ReadItem, SectionItem, WriteItem } from '../schedule/index.js';
import { tauriFs } from '../vault/tauri-fs.js';
import type { Vault } from '../vault/index.js';
import type * as A from './api.js';
import { contextOf, keyMatches, parseKey } from './context.js';
import { PluginHost, readPluginFolder, type Bridge, type InstallResult } from './runtime.js';
import { addStyle, closeSurfaces, showModal, showPopover } from './surfaces.js';
import './plugins.css';

export type { Ilmi, Selection as PluginSelection, BlockContext } from './api.js';
export { PluginHost, type PluginRow, type PluginCommand, type PluginAction, type SettingControl, type InstallResult, COMMAND_PREFIX } from './runtime.js';

/** The app's version, as `ilmi.version`; `src-tauri/tauri.conf.json` has the same. */
export const APP_VERSION = '0.1.0';

let host: PluginHost | null = null;
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
  if (item.kind === 'section') out.block = item.block;
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
  const h = new PluginHost(vault, bridge);
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
  bumpUi();
  return h;
}

/** The vault closes: every plugin is deactivated. */
export function stopPlugins(): void {
  if (!host) return;
  closeSurfaces();
  host.stop();
  offHost?.();
  offLens?.();
  offHost = null;
  offLens = null;
  host = null;
  bumpUi();
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
