// Sync by git (milestone 53): the open vault is a repository, and this is
// the policy over the Rust commands (`src-tauri/src/sync.rs`). A commit
// after each batch of writes (a quiet five seconds after the last, at most
// one a minute), its message naming what changed; a pull on open, on
// focus, every two minutes; a push after a session, on close, and a minute
// after any commit. Two versions of one file meet in `src/sync/merge.ts`,
// by the format's rules. The remote and its token live with the tweaks,
// outside the vault, per vault path; offline is quiet.

import { invoke } from '@tauri-apps/api/core';
import { describeChanges, mergeFile, type Change, type Kept } from '../sync/index.js';
import type { Vault, VaultEvent } from '../vault/index.js';
import { notify } from './land.js';
import { activeTab } from './panes.js';
import { useApp } from './store.js';
import { note, openNode } from './vault.js';

/** The remote and its token, per vault path, in the webview's storage. */
export interface SyncSettings {
  url: string;
  token: string;
}

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
    for (const [k, v] of Object.entries(o)) if (v && typeof v === 'object') out[k] = { url: typeof v.url === 'string' ? v.url : '', token: typeof v.token === 'string' ? v.token : '' };
    return out;
  } catch {
    return {};
  }
}

/** The settings for vault `root`; empty when none were set. */
export function settingsOf(root: string): SyncSettings {
  return loadAll()[root] ?? { url: '', token: '' };
}

/** Remember the settings for vault `root` (the open vault's reach the store). */
export function saveSettings(root: string, s: SyncSettings): void {
  const all = loadAll();
  if (s.url || s.token) all[root] = s; else delete all[root];
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

// ── the controller ───────────────────────────────────────────────

let root: string | null = null;
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

const patch = (p: Partial<SyncState>) => useApp.setState((s) => ({ sync: { ...s.sync, ...p } }));

/** Run `fn` after whatever git work is under way; nothing interleaves. */
function serial<T>(fn: () => Promise<T>): Promise<T> {
  const run = chain.then(fn, fn);
  chain = run.catch(() => {});
  return run;
}

const isNetwork = (e: unknown) => {
  const m = e instanceof Error ? e.message : String(e);
  return /resolve|connect|timed out|network|unreachable|failed to|could not|unexpected|SSL|TLS|authentication|401|403|404|no such file|not found/i.test(m);
};

async function status(at: string): Promise<Status> {
  return invoke<Status>('sync_status', { root: at });
}

/** Read the repository's state into the store. */
export async function refreshSync(): Promise<SyncState> {
  const at = root;
  if (!at) return SYNC_OFF;
  const st = await status(at);
  if (root !== at) return SYNC_OFF;
  patch({ repo: st.repo, on: st.repo && st.remote !== null, toPush: st.ahead + (st.dirty.length ? 1 : 0) });
  return useApp.getState().sync;
}

function scheduleStatus(ms = 300): void {
  if (statusTimer) clearTimeout(statusTimer);
  statusTimer = setTimeout(() => { statusTimer = null; void refreshSync().catch(() => {}); }, ms);
}

/** A commit of what is written, when something is: its message names the changes. Resolves to the commit's id, or null. */
async function commitNow(at: string): Promise<string | null> {
  const changes = await invoke<Change[]>('sync_changes', { root: at });
  if (changes.length === 0) return null;
  const id = await invoke<string | null>('sync_commit', { root: at, message: describeChanges(changes) });
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

const nameOf = (path: string): string => useApp.getState().docs[path]?.title ?? path.replace(/^.*\//, '').replace(/\.md$/, '');

/** Fetch and merge: what the other side changed lands in the working tree (the watcher reloads it); two versions of one file meet by the format's rules. */
async function pullNow(at: string): Promise<void> {
  if (!useApp.getState().sync.on) return;
  patch({ busy: 'pulling' });
  try {
    await commitNow(at);
    try {
      await invoke<Status>('sync_fetch', { root: at, token: settings().token || null });
    } catch (e) {
      if (!isNetwork(e)) throw e;
      patch({ offline: true });
      return;
    }
    patch({ offline: false, at: Date.now() });
    lastPull = Date.now();
    const m = await invoke<Merge>('sync_merge', { root: at });
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
      await invoke<string>('sync_resolve', { root: at, theirs: m.theirs, message, files });
    }
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
    scheduleStatus(0);
  }
}

async function pushNow(at: string, retry = true): Promise<void> {
  if (!useApp.getState().sync.on) return;
  patch({ busy: 'pushing' });
  try {
    await commitNow(at);
    const st = await status(at);
    if (st.ahead === 0 && !st.dirty.length) { patch({ offline: false }); return; }
    try {
      await invoke<Status>('sync_push', { root: at, token: settings().token || null });
      patch({ offline: false, at: Date.now() });
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
    scheduleStatus(0);
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

function onVaultEvent(ev: VaultEvent): void {
  // the repository's own files move on every command; nothing of ours
  if (ev.kind === 'hidden' && ev.paths.every((p) => p.startsWith('.git/') || p === '.git')) return;
  touched();
}

/** The vault opened: its settings, its state, a pull, and the timers. */
export async function startSync(vault: Vault): Promise<void> {
  stopSync();
  root = vault.root;
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
    pullTimer = setInterval(() => { void pull().catch((e: unknown) => console.error('sync pull', e)); }, PULL_EVERY_MS);
    await pull().catch((e: unknown) => console.error('sync pull', e));
  }
}

/** The vault is closing: the timers stop; what is written is committed and pushed, best effort. */
export function stopSync(): void {
  const at = root;
  const on = useApp.getState().sync.on;
  root = null;
  unsubscribe?.();
  unsubscribe = null;
  for (const t of [commitTimer, pushTimer, statusTimer]) if (t) clearTimeout(t);
  commitTimer = pushTimer = statusTimer = null;
  if (pullTimer) clearInterval(pullTimer);
  pullTimer = null;
  useApp.setState({ sync: SYNC_OFF, syncSettings: { url: '', token: '' } });
  if (at && on) {
    void serial(async () => {
      await commitNow(at);
      await invoke('sync_push', { root: at, token: settingsOf(at).token || null });
    }).catch(() => { /* offline: next time */ });
  }
}

/**
 * `connect`: the open vault becomes a repository with `url` as its remote
 * (a repository already is used as it is, its remote pointed there),
 * everything committed, the remote brought in, and ours pushed.
 */
export async function connect(url: string, token: string): Promise<void> {
  const at = root;
  if (!at) throw new Error('no vault open');
  const clean = url.trim();
  if (!clean) throw new Error('no remote');
  saveSettings(at, { url: clean, token });
  await serial(async () => {
    await invoke('sync_init', { root: at, remote: clean });
    await refreshSync();
    await commitNow(at);
    await pullNow(at);
    await pushNow(at);
  });
  if (root === at && !pullTimer) pullTimer = setInterval(() => { void pull().catch((e: unknown) => console.error('sync pull', e)); }, PULL_EVERY_MS);
  const s = useApp.getState().sync;
  note(s.offline ? 'connected · offline' : 'connected');
}

/** Point the open vault's remote elsewhere (the tweaks' field); the token with it. */
export async function setRemote(url: string, token: string): Promise<void> {
  const at = root;
  if (!at) return;
  saveSettings(at, { url: url.trim(), token });
  if (useApp.getState().sync.repo && url.trim()) await invoke('sync_set_remote', { root: at, url: url.trim() });
  await refreshSync();
}

/** `clone…`: the remote into `dest`, an empty folder; the settings go with it. Resolves to the path to open. */
export async function cloneInto(url: string, token: string, dest: string): Promise<string> {
  const clean = url.trim();
  if (!clean) throw new Error('no remote');
  await invoke('sync_clone', { url: clean, token: token || null, dest });
  saveSettings(dest, { url: clean, token });
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
