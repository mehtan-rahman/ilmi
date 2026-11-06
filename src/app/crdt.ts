// The engine in the app (milestone 61): the open collection synced through
// a storage (`src/sync/engine.ts` merges, `src/sync/storage.ts` is the
// storage). This milestone has one storage, a folder, chosen by the dev
// environment (`ILMI_STORAGE=/path`); there is no row in the tweaks yet.
// With it set, a collection that opens is connected to the folder (an
// empty folder takes the collection, an empty collection takes the
// folder's) and synced: on open, three seconds after a write, when the
// window comes back, and every half minute. The strip says what 53's
// said; a paragraph both devices changed is merged by character, named in
// a notice, and counted in the strip until its file is opened. Git sync
// (`sync.ts`) is left alone and does not run for a collection that syncs
// this way.

import { invoke } from '@tauri-apps/api/core';
import { engine, folderStorage, type Engine, type Loro, type Storage, type Synced } from '../sync/index.js';
import type { Fs, StoreFs, Vault } from '../vault/index.js';
import { createCollection, deleteCollection, listCollections } from '../vault/tauri-store.js';
import { collectionFs, diskFs } from './collections.js';
import { notify } from './land.js';
import { titleOf } from './names.js';
import { activeTab } from './panes.js';
import { useApp } from './store.js';
import { SYNC_OFF } from './sync.js';
import { note } from './vault.js';

/** The text library, as the web view loads it: its WebAssembly fetched once, when a collection that syncs first writes or merges text. */
export async function loadLoro(): Promise<Loro> {
  const [{ default: url }, lib] = await Promise.all([import('loro-crdt/web/loro_wasm_bg.wasm?url'), import('loro-crdt/web')]);
  // the web build's default export starts the module from the address of its WebAssembly
  await (lib as unknown as { default: (from: { module_or_path: string }) => Promise<unknown> }).default({ module_or_path: url });
  return lib as unknown as Loro;
}

const engines = new WeakMap<Fs, Engine>();

/** The engine of a collection's `Fs`: made with it, so it is told of every write from the first. */
export function engineFor(fs: StoreFs): Engine {
  let e = engines.get(fs);
  if (!e) engines.set(fs, (e = engine(fs, { loro: loadLoro })));
  return e;
}

/** After a write, a sync this much later. */
export const WRITE_QUIET_MS = 3_000;
export const POLL_MS = 30_000;
const FOCUS_GAP_MS = 10_000;

/** Dev only: the folder the collections of this run sync through. */
export async function storageDir(): Promise<string | null> {
  if (!import.meta.env.DEV) return null;
  try {
    const dir = await invoke<string | null>('dev_env', { name: 'ILMI_STORAGE' });
    return dir ? dir.replace(/\/+$/, '') : null;
  } catch {
    return null;
  }
}

async function storageAt(dir: string): Promise<Storage> {
  await invoke('allow_vault', { path: dir });
  await diskFs.mkdir(dir);
  return folderStorage(diskFs, dir);
}

let open: { vault: Vault; eng: Engine; storage: Storage } | null = null;
let writeTimer: ReturnType<typeof setTimeout> | null = null;
let pollTimer: ReturnType<typeof setInterval> | null = null;
let unsubscribe: (() => void) | null = null;
let lastSync = 0;
let listening = false;
let timers = true;

const patch = (p: Partial<typeof SYNC_OFF>) => useApp.setState((s) => ({ sync: { ...s.sync, ...p } }));
const nameOf = (path: string): string => { const s = useApp.getState(); return titleOf(path, s.docs, s.vault); };

async function refresh(): Promise<void> {
  const at = open;
  if (!at) return;
  const waiting = await at.eng.waiting();
  if (open === at) patch({ on: true, toPush: waiting });
}

/** Sync now: what the other devices wrote is merged, what was written here goes out. Null when the open collection has no storage. */
export async function crdtNow(): Promise<Synced | null> {
  const at = open;
  if (!at) return null;
  if (writeTimer) { clearTimeout(writeTimer); writeTimer = null; }
  patch({ busy: 'pulling' });
  try {
    const r = await at.eng.sync(at.storage);
    lastSync = Date.now();
    if (open !== at) return r;
    patch({ offline: false, at: Date.now() });
    if (r.kept.length) {
      patch({ conflicts: [...useApp.getState().sync.conflicts, ...r.kept] });
      const k = r.kept[0]!;
      notify(`both edited · ${nameOf(k.path)} § ${k.heading}${r.kept.length > 1 ? ` and ${r.kept.length - 1} more` : ''}`, k.path);
    } else if (r.changed.length) {
      const id = activeTab(useApp.getState().panes)?.id ?? '';
      if (r.changed.includes(id)) notify(`pulled · ${nameOf(id)} changed`);
      else note(`pulled · ${r.changed.length} file${r.changed.length === 1 ? '' : 's'}`);
    }
    return r;
  } catch (e) {
    console.error('crdt sync', e);
    if (open === at) patch({ offline: true });
    throw e;
  } finally {
    if (open === at) patch({ busy: null });
    await refresh().catch(() => {});
  }
}

function onWrite(): void {
  void refresh().catch(() => {});
  if (!timers) return;
  if (writeTimer) clearTimeout(writeTimer);
  writeTimer = setTimeout(() => { writeTimer = null; void crdtNow().catch(() => {}); }, WRITE_QUIET_MS);
}

function onFocus(): void {
  if (!open || !timers || Date.now() - lastSync < FOCUS_GAP_MS) return;
  void crdtNow().catch(() => {});
}

/** Dev only (the smoke): the timers off, so a change crosses when a step says so. */
export function setCrdtTimers(on: boolean): void {
  timers = on;
  if (!on) {
    if (writeTimer) { clearTimeout(writeTimer); writeTimer = null; }
    if (pollTimer) { clearInterval(pollTimer); pollTimer = null; }
  } else if (open && !pollTimer) pollTimer = setInterval(() => { void crdtNow().catch(() => {}); }, POLL_MS);
}

/** Whether the open collection syncs through a storage. */
export const crdtOn = (): boolean => open !== null;

/**
 * The collection opened: when the run names a storage, the two meet and
 * sync, and the timers start. Resolves to whether they did; without a
 * storage nothing happens here and git sync may run.
 */
export async function startCrdt(vault: Vault): Promise<boolean> {
  stopCrdt();
  const dir = await storageDir();
  if (!dir || !('door' in vault.fs)) return false;
  const eng = engineFor(vault.fs as StoreFs);
  const storage = await storageAt(dir);
  const at = { vault, eng, storage };
  open = at;
  useApp.setState({ sync: { ...SYNC_OFF, on: true, busy: 'pushing' } });
  try {
    const how = await eng.connect(storage);
    if (open !== at) return true;
    if (how === 'made') note('storage made');
    unsubscribe = vault.subscribe(onWrite);
    if (!listening) {
      listening = true;
      window.addEventListener('focus', onFocus);
      document.addEventListener('visibilitychange', () => { if (document.visibilityState === 'visible') onFocus(); });
    }
    if (timers) pollTimer = setInterval(() => { void crdtNow().catch(() => {}); }, POLL_MS);
    await crdtNow();
  } catch (e) {
    console.error('crdt', e);
    if (open === at) { patch({ busy: null, offline: true }); note(e instanceof Error ? e.message : String(e)); }
  }
  return true;
}

/** The collection is closing: what was written goes out, best effort, and the timers stop. */
export function stopCrdt(): void {
  const at = open;
  open = null;
  unsubscribe?.();
  unsubscribe = null;
  if (writeTimer) clearTimeout(writeTimer);
  if (pollTimer) clearInterval(pollTimer);
  writeTimer = null;
  pollTimer = null;
  if (at) {
    useApp.setState({ sync: SYNC_OFF });
    void at.eng.sync(at.storage).catch(() => { /* the next open sends it */ });
  }
}

/**
 * A new collection called `name` made from what the storage at `dir`
 * holds: created empty, joined, and synced once. With `replace`, a
 * collection of that name goes first (a dev run's second copy). Resolves
 * to its root, to open; a collection whose join fails is removed again.
 */
export async function joinCollection(dir: string, name: string, replace = false): Promise<string> {
  const { home, names } = await listCollections();
  if (replace && names.includes(name)) await deleteCollection(`${home}/${name}`);
  const root = await createCollection(name);
  try {
    const eng = engineFor(collectionFs(root));
    const storage = await storageAt(dir);
    if ((await eng.connect(storage)) !== 'joined') throw new Error('the storage holds nothing to join');
    await eng.sync(storage);
  } catch (e) {
    await deleteCollection(root).catch(() => { /* the join's error is the one to show */ });
    throw e;
  }
  return root;
}
