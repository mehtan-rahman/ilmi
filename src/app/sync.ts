// Sync by git (milestone 53): the open collection has a repository, and
// this is the policy over the Rust commands (`src-tauri/src/sync.rs`).
// Since milestone 59 a collection is a database, so the repository is a
// folder beside it (`<collection>/repo`) kept as an export of it: before a
// commit the folder is made to hold what the collection holds
// (`mirrorFolder`), and after a pull the files that changed are taken back
// in (`takeFiles`). Git goes when the CRDT engine has passed the same
// checks on a device (milestone 66). A commit
// after each batch of writes (a quiet five seconds after the last, at most
// one a minute), its message naming what changed; a pull on open, on
// focus, every two minutes; a push after a session, on close, and a minute
// after any commit. Two versions of one file meet in `src/sync/merge.ts`,
// by the format's rules. The remote and its token live with the tweaks,
// outside the vault, per vault path; offline is quiet. After every push
// the nudge (`nudge.ts`, milestone 54) tells the other devices, and a
// nudge from one of them is a pull at once; the timer stays for what the
// nudge misses.

import { invoke } from '@tauri-apps/api/core';
import { describeChanges, mergeFile, type Change, type Kept } from '../sync/index.js';
import { mirrorFolder, importFolder, takeFiles, type Vault, type VaultEvent } from '../vault/index.js';
import { createCollection, deleteCollection, listCollections } from '../vault/tauri-store.js';
import { collectionFs, diskFs, freeName } from './collections.js';
import { notify } from './land.js';
import { activeTab } from './panes.js';
import { useApp } from './store.js';
import { titleOf } from './names.js';
import { ago, NUDGE_SERVER, publishNudge, subscribeNudge, type Subscription } from './nudge.js';
import { nameFromRemote, vaultKey } from './platform.js';
import { note, openNode } from './vault.js';

/** The remote, its token, and the nudge's server, per vault path, in the webview's storage. */
export interface SyncSettings {
  url: string;
  token: string;
  /** The ntfy server the nudge goes over; empty, and the timer is all there is. */
  server: string;
}

export const NO_SETTINGS: SyncSettings = { url: '', token: '', server: NUDGE_SERVER };

export interface SyncState {
  /** The vault is a repository with a remote: sync runs. */
  on: boolean;
  /** The vault is a repository (with or without a remote). */
  repo: boolean;
  busy: 'pulling' | 'pushing' | null;
  /** The last fetch or push did not reach the remote; commits accumulate. */
  offline: boolean;
  /** Commits not on the remote yet, plus one while something is written but not committed. */
  toPush: number;
  /** Blocks the last merges kept both ways, until their files are opened. */
  conflicts: Kept[];
  /** When the remote was last reached, ms since the epoch; null before. */
  at: number | null;
}

export const SYNC_OFF: SyncState = { on: false, repo: false, busy: null, offline: false, toPush: 0, conflicts: [], at: null };

// the cadence, in ms
export const QUIET_MS = 5_000;
export const COMMIT_GAP_MS = 60_000;
export const PULL_EVERY_MS = 120_000;
export const PUSH_AFTER_MS = 60_000;
/** A pull on focus not within this of the last. */
export const FOCUS_GAP_MS = 15_000;

const SETTINGS_KEY = 'ilmi.sync';

interface Status { repo: boolean; remote: string | null; branch: string | null; dirty: string[]; ahead: number; behind: number }
interface Conflict { path: string; base: string | null; ours: string | null; theirs: string | null; binary: boolean }
interface Merge { kind: 'none' | 'fast' | 'merged' | 'conflicts'; theirs: string | null; pulled: string[]; conflicts: Conflict[] }

function loadAll(): Record<string, SyncSettings> {
  try {
    const raw = globalThis.localStorage?.getItem(SETTINGS_KEY);
    const o = raw ? (JSON.parse(raw) as Record<string, Partial<SyncSettings>>) : {};
    const out: Record<string, SyncSettings> = {};
    for (const [k, v] of Object.entries(o)) if (v && typeof v === 'object') out[k] = { url: typeof v.url === 'string' ? v.url : '', token: typeof v.token === 'string' ? v.token : '', server: typeof v.server === 'string' ? v.server : NUDGE_SERVER };
    return out;
  } catch {
    return {};
  }
}

/** The settings for vault `root`; empty when none were set. Kept by `vaultKey`: the path, or on iOS the vault's place in Documents. */
export function settingsOf(root: string): SyncSettings {
  return loadAll()[vaultKey(root)] ?? { ...NO_SETTINGS };
}

/** Remember the settings for vault `root` (the open vault's reach the store). */
export function saveSettings(root: string, s: SyncSettings): void {
  const all = loadAll();
  const key = vaultKey(root);
  if (s.url || s.token || s.server !== NUDGE_SERVER) all[key] = s; else delete all[key];
  try { globalThis.localStorage?.setItem(SETTINGS_KEY, JSON.stringify(all)); } catch { /* the session keeps them */ }
  if (useApp.getState().vault === root) useApp.setState({ syncSettings: s });
}

/** The strip's word, or null when sync is off. */
export function syncWord(s: SyncState): string | null {
  if (!s.on) return null;
  if (s.conflicts.length) return `${s.conflicts.length} conflict${s.conflicts.length === 1 ? '' : 's'}`;
  if (s.busy === 'pulling') return 'pulling…';
  if (s.busy === 'pushing') return 'pushing…';
  if (s.offline) return 'offline';
  if (s.toPush) return `${s.toPush} to push`;
  return 'synced';
}

/** Beside `synced`: how long ago the remote was last reached (`2 s ago`), the nudge's latency made visible; null otherwise. */
export function syncAge(s: SyncState, now = Date.now()): string | null {
  return syncWord(s) === 'synced' && s.at !== null ? ago(now - s.at) : null;
}

// ── the controller ───────────────────────────────────────────────

let root: string | null = null;
/** The open collection, whose files the repository's folder mirrors. */
let open: Vault | null = null;
/** The folder may not hold what the collection holds: true from the open (the last session's writes may not have reached it) and after any write. */
let stale = true;
/** Something was written in this session and is not in the folder yet: the strip counts it as it would a file not committed. */
let unwritten = false;
/** A pull's files are being taken in: what the vault says of them is not a write of ours. */
let taking = false;
/** Hidden paths a pull just wrote into the collection, whose echo from the store's watcher is still to come. */
const taken = new Set<string>();
/** The app's view state: in the collection, never in a commit (the repository's `.gitignore`). */
const STATE_FILE = '.ilmi/state.json';
let unsubscribe: (() => void) | null = null;
let lastCommit = 0;
let lastPull = 0;
let lastWrite = 0;
let commitTimer: ReturnType<typeof setTimeout> | null = null;
let pushTimer: ReturnType<typeof setTimeout> | null = null;
let pullTimer: ReturnType<typeof setInterval> | null = null;
let statusTimer: ReturnType<typeof setTimeout> | null = null;
/** One git operation at a time: the queue of what is asked for. */
let chain: Promise<unknown> = Promise.resolve();
let listening = false;
/** The nudge's stream, while the vault has a remote and a server. */
let nudge: Subscription | null = null;
/** A pull the nudge asked for, not started yet: another nudge adds nothing. */
let nudgeQueued = false;
/** The pull timer runs unless the smoke turns it off to show the nudge alone does the work. */
let timers = true;

const patch = (p: Partial<SyncState>) => useApp.setState((s) => ({ sync: { ...s.sync, ...p } }));

/** Run `fn` after whatever git work is under way; nothing interleaves. */
function serial<T>(fn: () => Promise<T>): Promise<T> {
  const run = chain.then(fn, fn);
  chain = run.catch(() => {});
  return run;
}

/** A fetch or push that failed at the transport: libgit2's `Net`, `Ssl` and `Http` classes (`unsupported URL protocol; class=Net (12)`), or the words such failures use. */
const isNetwork = (e: unknown) => {
  const m = e instanceof Error ? e.message : String(e);
  return /class=(Net|Ssl|Http) \(/.test(m)
    || /resolve|connect|timed out|network|unreachable|failed to|could not|unexpected|SSL|TLS|authentication|401|403|404|no such file|not found/i.test(m);
};

/** The repository of the collection at `at`: a folder beside its database, an export of it. */
export const repoOf = (at: string): string => `${at.replace(/\/+$/, '')}/repo`;

async function status(at: string): Promise<Status> {
  return invoke<Status>('sync_status', { root: repoOf(at) });
}

/** The repository's folder made to hold what the collection holds, when something was written since. */
async function writeOut(at: string): Promise<void> {
  const vault = open;
  if (!vault || vault.root !== at || !stale) return;
  stale = false;
  unwritten = false;
  try {
    await invoke('allow_vault', { path: repoOf(at) });
    await mirrorFolder(vault.fs, at, diskFs, repoOf(at));
  } catch (e) {
    stale = true;
    unwritten = true;
    throw e;
  }
}

/** The files a pull changed, from the repository's folder into the collection; the vault told. */
async function takeIn(at: string, paths: readonly string[]): Promise<void> {
  const vault = open;
  if (!vault || vault.root !== at || !paths.length) return;
  taking = true;
  try {
    for (const p of paths) if (p.split('/').some((seg) => seg.startsWith('.'))) taken.add(p);
    await takeFiles(diskFs, repoOf(at), vault.fs, at, paths);
    await vault.changed([...paths]);
  } finally {
    taking = false;
  }
}

/** Read the repository's state into the store. */
export async function refreshSync(): Promise<SyncState> {
  const at = root;
  if (!at) return SYNC_OFF;
  const st = await status(at);
  if (root !== at) return SYNC_OFF;
  // what is written and not yet in the folder counts as it would once there
  patch({ repo: st.repo, on: st.repo && st.remote !== null, toPush: st.ahead + (st.dirty.length || (st.repo && unwritten) ? 1 : 0) });
  return useApp.getState().sync;
}

function scheduleStatus(ms = 300): void {
  if (statusTimer) clearTimeout(statusTimer);
  statusTimer = setTimeout(() => { statusTimer = null; void refreshSync().catch(() => {}); }, ms);
}

/** A commit of what is written, when something is: its message names the changes. Resolves to the commit's id, or null. */
async function commitNow(at: string): Promise<string | null> {
  await writeOut(at);
  const changes = await invoke<Change[]>('sync_changes', { root: repoOf(at) });
  if (changes.length === 0) return null;
  const id = await invoke<string | null>('sync_commit', { root: repoOf(at), message: describeChanges(changes) });
  lastCommit = Date.now();
  if (id) schedulePush();
  return id;
}

/** Something was written: a commit comes after a quiet spell, at most one a minute. */
function touched(): void {
  lastWrite = Date.now();
  scheduleStatus();
  if (commitTimer) clearTimeout(commitTimer);
  const due = Math.max(lastWrite + QUIET_MS, lastCommit + COMMIT_GAP_MS);
  commitTimer = setTimeout(() => {
    commitTimer = null;
    if (Date.now() - lastWrite < QUIET_MS) { touched(); return; }
    const at = root;
    if (!at || !useApp.getState().sync.on) return;
    void serial(() => commitNow(at)).then(() => scheduleStatus(0)).catch((e: unknown) => console.error('sync commit', e));
  }, Math.max(0, due - Date.now()));
}

function schedulePush(ms = PUSH_AFTER_MS): void {
  if (pushTimer) clearTimeout(pushTimer);
  pushTimer = setTimeout(() => { pushTimer = null; void push().catch(() => {}); }, ms);
}

/** The settings of the open vault, as the store has them. */
const settings = (): SyncSettings => useApp.getState().syncSettings;

/** The document on the active tab, if a document. */
function openDoc(): string | null {
  const id = activeTab(useApp.getState().panes)?.id ?? '';
  return id.endsWith('.md') ? id : null;
}

/** A document as the tree names it: its title, else its file name as a name. */
const nameOf = (path: string): string => { const s = useApp.getState(); return titleOf(path, s.docs, s.vault); };

/** Fetch and merge: what the other side changed lands in the repository's folder and is taken into the collection; two versions of one file meet by the format's rules. */
async function pullNow(at: string): Promise<void> {
  if (!useApp.getState().sync.on) return;
  patch({ busy: 'pulling' });
  try {
    await commitNow(at);
    try {
      await invoke<Status>('sync_fetch', { root: repoOf(at), token: settings().token || null });
    } catch (e) {
      if (!isNetwork(e)) throw e;
      patch({ offline: true });
      return;
    }
    patch({ offline: false, at: Date.now() });
    lastPull = Date.now();
    const m = await invoke<Merge>('sync_merge', { root: repoOf(at) });
    const changed = [...m.pulled];
    const kept: Kept[] = [];
    if (m.kind === 'conflicts' && m.theirs) {
      const files: { path: string; text: string | null }[] = [];
      for (const c of m.conflicts) {
        const r = mergeFile(c.path, { base: c.base, ours: c.ours, theirs: c.theirs, binary: c.binary });
        kept.push(...r.kept);
        if (r.action === 'write') { files.push({ path: c.path, text: r.text }); changed.push(c.path); }
        else if (r.action === 'remove') { files.push({ path: c.path, text: null }); changed.push(c.path); }
      }
      const where = kept.map((k) => `${nameOf(k.path)} § ${k.heading}`);
      const message = kept.length ? `merge from origin: both versions kept in ${[...new Set(where)].join(', ')}` : 'merge from origin';
      await invoke<string>('sync_resolve', { root: repoOf(at), theirs: m.theirs, message, files });
    }
    await takeIn(at, [...new Set(changed)]);
    if (root !== at) return;
    if (kept.length) {
      patch({ conflicts: [...useApp.getState().sync.conflicts, ...kept] });
      const k = kept[0]!;
      notify(`both versions kept · ${nameOf(k.path)} § ${k.heading}${kept.length > 1 ? ` and ${kept.length - 1} more` : ''}`, k.path);
    } else if (changed.length) {
      const open = openDoc();
      if (open && changed.includes(open)) notify(`pulled · ${nameOf(open)} changed`);
      else note(`pulled · ${changed.length} file${changed.length === 1 ? '' : 's'}`);
    }
  } finally {
    if (root === at) patch({ busy: null });
    await refreshSync().catch(() => {});
  }
}

async function pushNow(at: string, retry = true): Promise<void> {
  if (!useApp.getState().sync.on) return;
  patch({ busy: 'pushing' });
  try {
    await commitNow(at);
    const st = await status(at);
    // nothing to send says nothing about the remote: `offline` stands as the pull left it
    if (st.ahead === 0 && !st.dirty.length) return;
    try {
      await invoke<Status>('sync_push', { root: repoOf(at), token: settings().token || null });
      patch({ offline: false, at: Date.now() });
      void publishNudge(settings().server, settings().url);
    } catch (e) {
      // behind the remote: bring it in, then once more
      if (retry) {
        patch({ busy: null });
        await pullNow(at);
        if (useApp.getState().sync.offline) return;
        await pushNow(at, false);
        return;
      }
      if (!isNetwork(e)) throw e;
      patch({ offline: true });
    }
  } finally {
    if (root === at) patch({ busy: null });
    await refreshSync().catch(() => {});
  }
}

/** Pull now (a focus, the timer, the smoke). */
export function pull(): Promise<void> {
  const at = root;
  if (!at) return Promise.resolve();
  return serial(() => pullNow(at));
}

/** Push now, after a commit of what is written. */
export function push(): Promise<void> {
  const at = root;
  if (!at) return Promise.resolve();
  if (pushTimer) { clearTimeout(pushTimer); pushTimer = null; }
  return serial(() => pushNow(at));
}

/** Commit, pull, push, in that order: the smoke's step and a session's end. */
export async function syncNow(): Promise<void> {
  const at = root;
  if (!at) return;
  await serial(async () => { await pullNow(at); await pushNow(at); });
}

/** A session ended: a push, soon. */
export function sessionEnded(): void {
  if (!root || !useApp.getState().sync.on) return;
  schedulePush(QUIET_MS);
}

function onFocus(): void {
  if (!root || !useApp.getState().sync.on) return;
  if (Date.now() - lastPull < FOCUS_GAP_MS) return;
  void pull().catch((e: unknown) => console.error('sync pull', e));
}

/** A nudge arrived (or the stream came back): one pull, however many arrive while it waits its turn. */
function onNudge(): void {
  if (!root || !useApp.getState().sync.on || nudgeQueued) return;
  nudgeQueued = true;
  const at = root;
  void serial(() => { nudgeQueued = false; return pullNow(at); }).catch((e: unknown) => console.error('sync nudge', e));
}

/** Listen on the remote's topic, when the vault syncs and a server is set; the stream before, if any, closes. */
function startNudge(): void {
  stopNudge();
  const s = settings();
  if (!root || !useApp.getState().sync.on || !s.server.trim() || !s.url.trim()) return;
  nudge = subscribeNudge(s.server, s.url, onNudge, { onError: (e) => console.warn('nudge', e) });
}

function stopNudge(): void {
  nudge?.stop();
  nudge = null;
  nudgeQueued = false;
}

function startPullTimer(): void {
  if (pullTimer || !timers) return;
  pullTimer = setInterval(() => { void pull().catch((e: unknown) => console.error('sync pull', e)); }, PULL_EVERY_MS);
}

/** Dev only (the nudge smoke): the pull timer off, so a change crossing is the nudge's doing. */
export function setPullTimer(on: boolean): void {
  timers = on;
  if (!on && pullTimer) { clearInterval(pullTimer); pullTimer = null; }
  if (on && root && useApp.getState().sync.on) startPullTimer();
}

function onVaultEvent(ev: VaultEvent): void {
  // a pull's own files, as the vault reports them and as the store's watcher echoes them a moment later
  if (taking) return;
  if (ev.kind === 'hidden') {
    const ours = ev.paths.filter((p) => !taken.delete(p) && p !== STATE_FILE);
    if (!ours.length) return;
  }
  stale = true;
  unwritten = true;
  touched();
}

/** The vault opened: its settings, its state, a pull, and the timers. */
export async function startSync(vault: Vault): Promise<void> {
  stopSync();
  root = vault.root;
  open = vault;
  stale = true;
  unwritten = false;
  taken.clear();
  const s = settingsOf(vault.root);
  useApp.setState({ sync: SYNC_OFF, syncSettings: s });
  unsubscribe = vault.subscribe(onVaultEvent);
  if (!listening) {
    listening = true;
    window.addEventListener('focus', onFocus);
    document.addEventListener('visibilitychange', () => { if (document.visibilityState === 'visible') onFocus(); });
  }
  const st = await refreshSync();
  if (root !== vault.root) return;
  if (st.on) {
    startPullTimer();
    startNudge();
    await pull().catch((e: unknown) => console.error('sync pull', e));
  }
}

/** The vault is closing: the timers stop; what is written is committed and pushed, best effort. */
export function stopSync(): void {
  const at = root;
  const on = useApp.getState().sync.on;
  const closing = open;
  root = null;
  open = null;
  stopNudge();
  unsubscribe?.();
  unsubscribe = null;
  for (const t of [commitTimer, pushTimer, statusTimer]) if (t) clearTimeout(t);
  commitTimer = pushTimer = statusTimer = null;
  if (pullTimer) clearInterval(pullTimer);
  pullTimer = null;
  useApp.setState({ sync: SYNC_OFF, syncSettings: { ...NO_SETTINGS } });
  if (at && on) {
    const s = settingsOf(at);
    void serial(async () => {
      // the collection is closing: its last writes go out through it once more
      if (closing && stale) {
        await invoke('allow_vault', { path: repoOf(at) });
        await mirrorFolder(closing.fs, at, diskFs, repoOf(at));
      }
      const changes = await invoke<Change[]>('sync_changes', { root: repoOf(at) });
      if (changes.length) await invoke<string | null>('sync_commit', { root: repoOf(at), message: describeChanges(changes) });
      await invoke('sync_push', { root: repoOf(at), token: s.token || null });
      await publishNudge(s.server, s.url);
    }).catch(() => { /* offline: next time */ });
  }
}

/**
 * `connect`: the open collection gets a repository (the folder beside its
 * database, written out from it) with `url` as its remote (a repository
 * already there is used as it is, its remote pointed there), everything
 * committed, the remote brought in, and ours pushed. The app's
 * `.gitignore` made with the repository is taken into the collection.
 */
export async function connect(url: string, token: string): Promise<void> {
  const at = root;
  if (!at) throw new Error('no vault open');
  const clean = url.trim();
  if (!clean) throw new Error('no remote');
  saveSettings(at, { ...settings(), url: clean, token });
  await serial(async () => {
    stale = true;
    await writeOut(at);
    await invoke('sync_init', { root: repoOf(at), remote: clean });
    await takeIn(at, ['.gitignore']);
    await refreshSync();
    await commitNow(at);
    await pullNow(at);
    await pushNow(at);
  });
  if (root === at) { startPullTimer(); startNudge(); }
  const s = useApp.getState().sync;
  note(s.offline ? 'connected · offline' : 'connected');
}

/** Point the open vault's remote elsewhere (the tweaks' field); the token with it. */
export async function setRemote(url: string, token: string): Promise<void> {
  const at = root;
  if (!at) return;
  saveSettings(at, { ...settings(), url: url.trim(), token });
  if (useApp.getState().sync.repo && url.trim()) await invoke('sync_set_remote', { root: repoOf(at), url: url.trim() });
  await refreshSync();
  if (root === at) startNudge();
}

/** The nudge's server (the tweaks' field): empty turns the nudge off; the stream follows the change. */
export function setNudgeServer(server: string): void {
  const at = root;
  if (!at) return;
  saveSettings(at, { ...settings(), server: server.trim() });
  startNudge();
}

/**
 * `clone…`, and the iPad's `connect`: the remote as a new collection named
 * for it (`name` when given; `name 2` when taken), cloned into the folder
 * beside the database and imported from there; the settings go with it.
 * Resolves to the collection's root, to open. A collection whose clone
 * fails is removed again.
 */
export async function cloneCollection(url: string, token: string, name?: string): Promise<string> {
  const clean = url.trim();
  if (!clean) throw new Error('no remote');
  const { names } = await listCollections();
  const dest = await createCollection(freeName(name ?? nameFromRemote(clean), names));
  try {
    await invoke('sync_clone', { url: clean, token: token || null, dest: repoOf(dest) });
    await invoke('allow_vault', { path: repoOf(dest) });
    await importFolder(diskFs, repoOf(dest), collectionFs(dest), dest);
  } catch (e) {
    await deleteCollection(dest).catch(() => { /* the clone's error is the one to show */ });
    throw e;
  }
  saveSettings(dest, { ...settingsOf(dest), url: clean, token });
  return dest;
}

/** The strip's `N conflicts`: the files open, and the count clears. */
export function openConflicts(): void {
  const { conflicts } = useApp.getState().sync;
  for (const p of [...new Set(conflicts.map((k) => k.path))]) openNode(p);
  patch({ conflicts: [] });
}

/** A bare repository at `path`: the smoke's host. */
export const initBare = (path: string): Promise<void> => invoke('sync_init_bare', { path });

/** Test-only: the times the policy keys on, moved back so a timer fires now. */
export function resetSyncClock(): void {
  lastCommit = 0;
  lastPull = 0;
}
