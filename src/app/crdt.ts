// The engine in the app (milestones 61 and 63): the open collection synced
// through a storage (`src/sync/engine.ts` merges, `src/sync/storage.ts`
// says what a storage is, `storage.ts` here makes the app's: a folder, an
// S3-compatible bucket, a WebDAV folder, Dropbox, Google Drive). Which one is the collection's
// setting (Tweaks › storage); a dev run may name one instead
// (`ILMI_STORAGE=/a/folder`, or `s3` or `webdav` for the loopback servers a
// debug build carries). A collection that has one is connected to it (an
// empty storage takes the collection, an empty collection takes the
// storage's) and synced: on open, three seconds after a write, when the
// window comes back, and every half minute. A storage that cannot be made
// at the open (a folder not mounted, no iCloud, no network) is tried again
// as often, and when the window comes back; a sign-in the service has let
// go of stops the syncing until it is signed in again. The strip says what 53's
// said; a paragraph both devices changed is merged by character, named in
// a notice, and counted in the strip until its file is opened. Git sync
// (`sync.ts`) does not run for a collection that syncs this way.
//
// The files (PDFs, images) are not part of a sync: a merge names them, and
// their bytes come after it on a device that keeps every file (`keep
// files`: all), or when one is opened on a device that keeps what it has
// opened. Either way they go between the storage and the collection on the
// Rust side; the strip shows how far one is (`pulling 40%`), and a book
// whose PDF is not here says so on its row (`away` in the store).

import { invoke } from '@tauri-apps/api/core';
import { getCurrentWindow } from '@tauri-apps/api/window';
import { SNAP_AFTER, SNAP_WORTH, engine, type Engine, type Loro, type Storage, type Synced } from '../sync/index.js';
import type { Fs, StoreFs, Vault } from '../vault/index.js';
import { createCollection, deleteCollection, listCollections } from '../vault/tauri-store.js';
import { collectionFs, freeName } from './collections.js';
import { notify } from './land.js';
import { titleOf } from './names.js';
import { activeTab } from './panes.js';
import { leaveForced, onLeave } from './away.js';
import { signOut, NO_STORAGE, devStorages, keepOf, saveStorage, signIn, storageFor, storageName, storageOf, storageReady, type Keep, type StorageSettings } from './storage.js';
import { useApp } from './store.js';
import { SYNC_OFF, startSync, stopSync } from './sync.js';
import { currentVault, note } from './vault.js';

/** The text library, as the web view loads it: its WebAssembly fetched once, when a collection that syncs first writes or merges text. */
export async function loadLoro(): Promise<Loro> {
  const [{ default: url }, lib] = await Promise.all([import('loro-crdt/web/loro_wasm_bg.wasm?url'), import('loro-crdt/web')]);
  // the web build's default export starts the module from the address of its WebAssembly
  await (lib as unknown as { default: (from: { module_or_path: string }) => Promise<unknown> }).default({ module_or_path: url });
  return lib as unknown as Loro;
}

const engines = new WeakMap<Fs, Engine>();

/** What the collection at `root` keeps of its files on this device. */
export const keepFor = (root: string): Keep => keepOf(storageOf(root));

/** Dev only (`ILMI_SNAP=4`): a snapshot after that many change files, read when it saves half as many, so a smoke sees one written. */
let devSnap: number | null = null;
if (import.meta.env.DEV) void invoke<string | null>('dev_env', { name: 'ILMI_SNAP' }).then((v) => { const n = Number(v); if (v && Number.isFinite(n) && n > 0) devSnap = n; }, () => {});

/** The engine of a collection's `Fs`: made with it, so it is told of every write from the first. */
export function engineFor(fs: StoreFs, root: string): Engine {
  let e = engines.get(fs);
  if (!e) engines.set(fs, (e = engine(fs, { loro: loadLoro, keep: () => keepFor(root), snapAfter: () => devSnap ?? SNAP_AFTER, snapWorth: () => (devSnap ? Math.max(2, Math.floor(devSnap / 2)) : SNAP_WORTH) })));
  return e;
}

/** After a write, a sync this much later. */
export const WRITE_QUIET_MS = 3_000;
export const POLL_MS = 30_000;
const FOCUS_GAP_MS = 10_000;

/** Dev only: the storage the collections of this run sync through, when the run names one: a folder's path, or `s3` or `webdav` for the loopback servers. */
export async function devStorage(): Promise<StorageSettings | null> {
  if (!import.meta.env.DEV) return null;
  try {
    const name = await invoke<string | null>('dev_env', { name: 'ILMI_STORAGE' });
    if (!name) return null;
    if (name === 's3' || name === 'webdav') return (await devStorages())[name];
    return { ...NO_STORAGE, on: true, kind: 'folder', folder: name.replace(/\/+$/, '') };
  } catch {
    return null;
  }
}

/** Dev only: the folder of this run's storage, when it is one. */
export async function storageDir(): Promise<string | null> {
  const s = await devStorage();
  return s?.kind === 'folder' ? s.folder : null;
}

/**
 * `met`: the collection and the storage have met (`connect`); until then each sync tries again, so a device that opens with no network meets its storage when there is one.
 * `run`: the sync under way, done or failed; `next`: the one asked for while it runs, which every ask meanwhile is. One sync at a time, then, however many
 * the poll, a write, the focus and a leave ask for while a storage is slow, and the strip says pulling until the last of them is done.
 * `gone`: the service let go of the sign-in; nothing goes to the storage until it is signed in again (a new opening), and what is written waits in the engine.
 */
interface Open { vault: Vault; eng: Engine; storage: Storage; met: boolean; syncing: boolean; run: Promise<void> | null; next: Promise<Synced | null> | null; gone: boolean }
let open: Open | null = null;
/** A start whose storage could not be made: tried again by the poll's timer and the focus, one try at a time (`trying`), until it is made or the collection closes. */
interface Broken { vault: Vault; fs: StoreFs; eng: Engine; settings: StorageSettings; mine: number; trying: boolean }
let broken: Broken | null = null;
/** Counts each start and stop: a start whose storage comes after the collection closed, or after a start since, lets it go. */
let opening = 0;
let writeTimer: ReturnType<typeof setTimeout> | null = null;
/** The poll while open; while broken, the try at the storage again. */
let pollTimer: ReturnType<typeof setInterval> | null = null;
let unsubscribe: (() => void) | null = null;
let lastSync = 0;
/** Writes seen, and how many of them the last sync to start had seen: a leave sends only when they differ. */
let writes = 0;
let sentWrites = 0;
let listening = false;
let timers = true;
/** The files being fetched after a sync, one run at a time. */
let fetching: Promise<unknown> | null = null;
/** What the Rust side says when a service has let go of a sign-in (`oauth.rs`, `GONE`). */
const SIGN_IN_AGAIN = 'sign in again';
/** Why the last `startCrdt` did not reach its storage; null when it did. */
let failed: string | null = null;

const patch = (p: Partial<typeof SYNC_OFF>) => useApp.setState((s) => ({ sync: { ...s.sync, ...p } }));
const nameOf = (path: string): string => { const s = useApp.getState(); return titleOf(path, s.docs, s.vault); };
const storeOf = (vault: Vault): StoreFs | null => ('door' in vault.fs ? (vault.fs as StoreFs) : null);

/** The files of the open collection that are not on this device, for the rows that say so. */
function publishAway(vault: Vault): void {
  if (currentVault() !== vault) return;
  const away = storeOf(vault)?.away() ?? [];
  const was = useApp.getState().away;
  if (away.length !== was.length || away.some((p, i) => p !== was[i])) useApp.setState({ away });
}

async function refresh(): Promise<void> {
  const at = open;
  if (!at) return;
  const waiting = await at.eng.waiting();
  if (open === at) patch({ on: true, toPush: waiting });
}

/** How far a file is on its way, from the Rust side: the strip's percent. */
async function listenProgress(): Promise<void> {
  const { getCurrentWebviewWindow } = await import('@tauri-apps/api/webviewWindow');
  await getCurrentWebviewWindow().listen<{ hash: string; done: number; total: number; up: boolean }>('blob-progress', (ev) => {
    if (!open) return;
    const { done, total, up } = ev.payload;
    patch({ progress: done >= total ? null : { up, part: total > 0 ? done / total : 0 } });
  });
}

/** The files this device keeps and does not hold yet, fetched one after another; the strip says how far each is. */
function fetchFiles(): Promise<unknown> {
  const at = open;
  if (!at || at.gone || keepFor(at.vault.root) !== 'all') return Promise.resolve();
  fetching ??= (async () => {
    try {
      if (!(await at.eng.away()).length) return;
      if (open === at) patch({ busy: 'pulling' });
      await at.eng.fetchAll(at.storage);
    } catch (e) {
      console.error('files', e);
    } finally {
      fetching = null;
      quiet(at);
      publishAway(at.vault);
    }
  })();
  return fetching;
}

/** The strip stops saying pulling once no sync runs or waits its turn, and no file is on its way. */
function quiet(at: Open): void {
  if (open === at && !at.syncing && !at.next && !fetching) patch({ busy: null, progress: null });
}

/** Every file this device keeps is here: what a sync left to fetch has come, or could not. */
export const filesSettled = (): Promise<unknown> => fetching ?? Promise.resolve();

/** Sync now: what the other devices wrote is merged, what was written here goes out. Null when the open collection has no storage. While a sync runs, the one after it, which has seen everything written before it was asked for. */
export function crdtNow(): Promise<Synced | null> {
  const at = open;
  if (!at) return Promise.resolve(null);
  if (at.gone) return Promise.reject(new Error(SIGN_IN_AGAIN));
  if (at.next) return at.next;
  if (!at.run) return runSync(at);
  const next = at.run.then(() => {
    at.next = null;
    if (open !== at) return null;
    // the one before it found the sign-in gone: this one does not go
    if (at.gone) { quiet(at); throw new Error(SIGN_IN_AGAIN); }
    return runSync(at);
  });
  at.next = next;
  return next;
}

function runSync(at: Open): Promise<Synced | null> {
  const run = syncOnce(at);
  const settled: Promise<void> = run.then(() => {}, () => {}).then(() => { if (at.run === settled) at.run = null; });
  at.run = settled;
  return run;
}

async function syncOnce(at: Open): Promise<Synced | null> {
  if (writeTimer) { clearTimeout(writeTimer); writeTimer = null; }
  const before = sentWrites;
  sentWrites = writes;
  at.syncing = true;
  patch({ busy: 'pulling' });
  try {
    if (!at.met) {
      const how = await at.eng.connect(at.storage);
      at.met = true;
      // closed while it waited its turn: the close's own sync sends what there is
      if (open !== at) return null;
      if (how === 'made') note('storage made');
    }
    // the files come after, on their own: a sync does not wait on a PDF
    const r = await at.eng.sync(at.storage, { files: false });
    lastSync = Date.now();
    if (open !== at) return r;
    patch({ offline: false, at: Date.now() });
    publishAway(at.vault);
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
    failed = e instanceof Error ? e.message : String(e);
    // what it had seen did not reach the storage: a leave sends it
    if (open === at) { patch({ offline: true }); sentWrites = before; }
    // the service let go of the sign-in (revoked, or Google's week for an app in testing): said once, and the row offers it again
    if (failed === SIGN_IN_AGAIN && storageOf(at.vault.root).account) {
      saveStorage(at.vault.root, { ...storageOf(at.vault.root), account: '' });
      if (open === at) notify(SIGN_IN_AGAIN);
    }
    // and nothing tries again until it is signed in: the timers stop, and the strip says sign in again
    if (failed === SIGN_IN_AGAIN && open === at) {
      at.gone = true;
      if (writeTimer) { clearTimeout(writeTimer); writeTimer = null; }
      if (pollTimer) { clearInterval(pollTimer); pollTimer = null; }
      patch({ gone: true });
    }
    throw e;
  } finally {
    at.syncing = false;
    quiet(at);
    await refresh().catch(() => {});
    if (open === at) void fetchFiles();
  }
}

function onWrite(): void {
  writes++;
  void refresh().catch(() => {});
  if (!timers || open?.gone) return;
  if (writeTimer) clearTimeout(writeTimer);
  writeTimer = setTimeout(() => { writeTimer = null; void crdtNow().catch(() => {}); }, WRITE_QUIET_MS);
}

/** A write the vault does not announce (a page of ink's strokes, milestone 58): synced as any write is, once it has been quiet. */
export function crdtWrote(): void {
  if (open) onWrite();
}

/** The app is left (`away.ts`): what was written since the last sync goes out now. Resolves to whether there was any. */
async function crdtLeave(): Promise<boolean> {
  if (!open || open.gone || (!timers && !leaveForced()) || writes === sentWrites) return false;
  await crdtNow();
  return true;
}

function onFocus(): void {
  if (!timers) return;
  if (broken) { void retry(); return; }
  if (!open || open.gone || Date.now() - lastSync < FOCUS_GAP_MS) return;
  void crdtNow().catch(() => {});
}

/** Dev only (the smoke): the timers off, so a change crosses when a step says so. */
export function setCrdtTimers(on: boolean): void {
  timers = on;
  if (!on) {
    if (writeTimer) { clearTimeout(writeTimer); writeTimer = null; }
    if (pollTimer) { clearInterval(pollTimer); pollTimer = null; }
  } else if (!pollTimer) {
    if (open && !open.gone) pollTimer = setInterval(poll, POLL_MS);
    else if (broken) pollTimer = setInterval(() => void retry(), POLL_MS);
  }
}

const poll = (): void => { void crdtNow().catch(() => {}); };

/** Whether the open collection syncs through a storage. */
export const crdtOn = (): boolean => open !== null;

/**
 * The collection opened: when it has a storage (its setting, or the one a
 * dev run names), the two meet and sync, and the timers start. Resolves
 * to whether they did; without a storage nothing happens here and git
 * sync may run. A collection closed or started again while its storage is
 * being made is left to whatever came since (true: not git's to start).
 */
export async function startCrdt(vault: Vault): Promise<boolean> {
  stopCrdt();
  const mine = opening;
  const fs = storeOf(vault);
  const own = storageOf(vault.root);
  useApp.setState({ storage: own, away: fs?.away() ?? [] });
  const settings = (await devStorage()) ?? (own.on && storageReady(own) ? own : null);
  if (mine !== opening) return true;
  if (!settings || !fs) return false;
  failed = null;
  const eng = engineFor(fs, vault.root);
  useApp.setState({ sync: { ...SYNC_OFF, on: true, busy: 'pushing' } });
  let storage: Storage;
  try {
    storage = await storageFor(settings, vault.root);
  } catch (e) {
    console.error('crdt', e);
    if (mine !== opening) return true;
    failed = e instanceof Error ? e.message : String(e);
    patch({ on: true, busy: null, offline: true });
    note(failed);
    // tried again with the poll's cadence, and when the window comes back
    broken = { vault, fs, eng, settings, mine, trying: false };
    void listen();
    if (timers) pollTimer = setInterval(() => void retry(), POLL_MS);
    return true;
  }
  if (mine !== opening) return true;
  await meet(vault, fs, eng, storage);
  return true;
}

/** The storage of a broken start, tried again: one try at a time; one made after the collection closed or started again is let go, and one made in time opens it as a first start would. The strip says offline until a sync reaches it. */
async function retry(): Promise<void> {
  const b = broken;
  if (!b || b.trying) return;
  b.trying = true;
  let storage: Storage;
  try {
    storage = await storageFor(b.settings, b.vault.root);
  } catch (e) {
    if (b.mine === opening) { b.trying = false; failed = e instanceof Error ? e.message : String(e); }
    return;
  }
  if (b.mine !== opening) return;
  broken = null;
  if (pollTimer) { clearInterval(pollTimer); pollTimer = null; }
  failed = null;
  await meet(b.vault, b.fs, b.eng, storage);
}

/** The window's focus and the leave, listened for once; resolves when the files' progress is listened for too, null when it was already. */
function listen(): Promise<void> | null {
  if (listening) return null;
  listening = true;
  window.addEventListener('focus', onFocus);
  document.addEventListener('visibilitychange', () => { if (document.visibilityState === 'visible') onFocus(); });
  onLeave(crdtLeave);
  return listenProgress().catch((e: unknown) => console.error('progress', e));
}

/** The storage made: the collection syncs through it from now on, and the two meet. */
async function meet(vault: Vault, fs: StoreFs, eng: Engine, storage: Storage): Promise<void> {
  const at: Open = { vault, eng, storage, met: false, syncing: false, run: null, next: null, gone: false };
  open = at;
  // a file that is not here is asked of the storage by whoever reads it: the PDF lens, an image in a note, an export
  fs.door.fetcher(async (hash) => {
    if (at.gone) throw new Error(SIGN_IN_AGAIN);
    if (open === at) patch({ busy: 'pulling' });
    try {
      await eng.fetch(storage, hash);
    } finally {
      quiet(at);
      publishAway(vault);
    }
  });
  const progress = listen();
  if (progress) {
    await progress;
    if (open !== at) return;
  }
  unsubscribe = vault.subscribe(onWrite);
  if (timers) pollTimer = setInterval(poll, POLL_MS);
  // the two meet, and sync; a storage that is not reached now is tried again by the timers
  await crdtNow().catch(() => { if (open === at) note(failed ?? 'offline'); });
}

/** The collection is closing: what was written goes out, best effort, and the timers stop. */
export function stopCrdt(): void {
  const at = open;
  open = null;
  broken = null;
  opening += 1;
  unsubscribe?.();
  unsubscribe = null;
  if (writeTimer) clearTimeout(writeTimer);
  if (pollTimer) clearInterval(pollTimer);
  writeTimer = null;
  pollTimer = null;
  if (at) {
    storeOf(at.vault)?.door.fetcher(null);
    useApp.setState({ sync: SYNC_OFF });
    // not to a service that let go of the sign-in: what is written waits in the engine for the next sign-in
    if (!at.gone) void at.eng.sync(at.storage, { files: false }).catch(() => { /* the next open sends it */ });
  }
}

/** What the last `joinCollection` read and merged: for a dev run's checks. */
export let lastJoin: Synced | null = null;

/**
 * A new collection called `name` made from what a storage holds: created
 * empty, joined, and synced once. `from` is the storage's settings, which
 * become the new collection's (what it keeps of the files is one of
 * them), or a dev run's folder. With `replace`, a collection of that name
 * goes first (a dev run's second copy). Resolves to its root, to open; a
 * collection whose join fails is removed again.
 */
export async function joinCollection(from: StorageSettings | string, name: string, replace = false): Promise<string> {
  const settings: StorageSettings = typeof from === 'string' ? { ...NO_STORAGE, on: true, kind: 'folder', folder: from } : { ...from, on: true };
  const { home, names } = await listCollections();
  if (replace && names.includes(name)) await deleteCollection(`${home}/${name}`);
  const root = await createCollection(replace ? name : freeName(name, names));
  // its settings are there before it syncs: what it keeps is one of them
  if (typeof from !== 'string') saveStorage(root, settings);
  try {
    const eng = engineFor(collectionFs(root), root);
    const storage = await storageFor(settings, root);
    if ((await eng.connect(storage)) !== 'joined') throw new Error('the storage holds nothing to join');
    // its files come once it is open, where the strip can say so
    lastJoin = await eng.sync(storage, { files: false });
  } catch (e) {
    if (typeof from !== 'string') saveStorage(root, { ...NO_STORAGE });
    await deleteCollection(root).catch(() => { /* the join's error is the one to show */ });
    throw e;
  }
  return root;
}

// ── Tweaks › storage ─────────────────────────────────────────────

/** A field of the open collection's storage, or what it keeps, set. */
export function setStorage(p: Partial<StorageSettings>): void {
  const vault = currentVault();
  if (!vault) return;
  const was = storageOf(vault.root);
  saveStorage(vault.root, { ...was, ...p });
  // a device that keeps every file from now on fetches the ones it does not hold
  if (p.keep === 'all' && open) void fetchFiles();
}

/** `connect`: the open collection syncs through the storage its settings name, from now on. An empty storage takes it; one that holds this collection is met. */
export async function connectStorage(): Promise<void> {
  const vault = currentVault();
  if (!vault) return;
  const s = storageOf(vault.root);
  if (!storageReady(s)) return;
  stopSync();
  saveStorage(vault.root, { ...s, on: true });
  await startCrdt(vault);
  if (failed !== null) {
    // it could not be reached, or holds another collection: the setting is left as it was
    const why = failed;
    stopCrdt();
    useApp.setState({ sync: SYNC_OFF });
    saveStorage(vault.root, { ...s, on: false });
    await startSync(vault);
    throw new Error(why);
  }
}

/** `sign in`: the browser sent to the service; the sign-in kept. A collection already syncing through it starts again with it. */
export async function signInStorage(): Promise<void> {
  const vault = currentVault();
  if (!vault) return;
  const account = await signIn(storageOf(vault.root));
  const s = { ...storageOf(vault.root), account };
  saveStorage(vault.root, s);
  getCurrentWindow().setFocus().catch(() => { /* the sign-in is kept all the same */ });
  if (s.on) {
    stopCrdt();
    await startCrdt(vault);
  }
}

/** `sign out`: the tokens forgotten on this device, and the collection no longer syncs through a service it cannot reach. What is there stays. */
export async function signOutStorage(): Promise<void> {
  const vault = currentVault();
  if (!vault) return;
  const s = storageOf(vault.root);
  if (!s.account) return;
  if (s.on) await storageOff();
  await signOut(s);
  saveStorage(vault.root, { ...storageOf(vault.root), account: '' });
}

/** `off`: the collection no longer syncs through its storage; what is there stays. */
export async function storageOff(): Promise<void> {
  const vault = currentVault();
  if (!vault) return;
  stopCrdt();
  saveStorage(vault.root, { ...storageOf(vault.root), on: false });
  await startSync(vault);
}

/** `join…`: what the storage in the open collection's settings holds, as a new collection of the storage's name with those settings. Resolves to its root, to open. */
export async function joinStorage(): Promise<string> {
  const vault = currentVault();
  if (!vault) throw new Error('no collection open');
  const s = storageOf(vault.root);
  return joinCollection(s, storageName(s));
}
