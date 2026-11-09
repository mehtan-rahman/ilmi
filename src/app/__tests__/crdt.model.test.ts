// @vitest-environment jsdom
// The storage sync's controller (`src/app/crdt.ts`, milestones 61 and 63)
// as a statechart, and the real controller checked against it over every
// interleaving of its events to a depth. The engine under it is a fake
// whose syncs wait for the test to settle them, one at a time as the real
// engine's lock lets them run; the storage is made by a fake `storageFor`
// whose answers the test gives in any order; the timers are vitest's.
// After every event the strip, the timers and the syncs asked of the
// engine are held against the chart, and at the end of each path the
// syncs are let through until all is quiet: what was written is sent.
//
// The chart, `CHART` below, says what the controller should do. Its
// states: `closed` (no collection syncs through a storage), `starting`
// (the storage being made), `open` with no sync, one, or one and one more
// asked for (`run` 0, 1, 2), `broken` (the storage could not be made: the
// strip says offline, and it is tried again every half minute and on a
// focus, one try at a time, `trying`; one made opens it as a first start
// does), and `revoked` (a sync found the sign-in gone: nothing goes to the
// storage, no timer runs, and the strip says sign in again until a sign-in
// starts it afresh; what was written meanwhile goes with that one's sync).
// What it holds beside: whether the strip says offline, the write timer
// and the poll (the retry's timer while broken), how long since a sync
// reached the storage (a focus syncs only past ten seconds), and the
// writes the last sync to start had seen (a leave sends only when there
// are more).

import { afterEach, describe, expect, it, vi } from 'vitest';
import type { StorageSettings } from '../storage.js';
import type { SyncState } from '../sync.js';

const h = vi.hoisted(() => {
  /** A sync asked of the engine: which opening of the collection asked (`epoch`), whether it is the last one a close sends, and what it carries once it runs. */
  interface Job { id: number; epoch: number; final: boolean; granted: boolean; settled: boolean; carry: number; res: (v: unknown) => void; rej: (e: unknown) => void }
  /** A storage being made: `again` when its opening made one before (a broken start's try again). */
  interface Made { id: number; epoch: number; again: boolean; settled: boolean; res: (v: unknown) => void; rej: (e: unknown) => void }
  const state = {
    epoch: 0,
    jobs: [] as Job[],
    storages: [] as Made[],
    written: 0,
    sent: 0,
    chain: Promise.resolve() as Promise<unknown>,
    settings: new Map<string, unknown>(),
    current: null as unknown,
    leave: null as null | (() => Promise<boolean>),
    crdtOn: (() => false) as () => boolean,
    /** This run's store (a run's modules are its own). */
    app: null as unknown,
    said: [] as string[],
    started: 0,
    git: 0,
    ids: 0,
  };
  const reset = (): void => {
    state.epoch = 0; state.jobs = []; state.storages = []; state.written = 0; state.sent = 0; state.chain = Promise.resolve();
    state.settings.clear(); state.current = null; state.leave = null; state.said = []; state.git = 0; state.ids = 0;
  };
  const lock = <T>(fn: () => Promise<T>): Promise<T> => {
    const run = state.chain.then(fn, fn);
    state.chain = run.catch(() => {});
    return run;
  };
  const engine = () => ({
    on: async () => true,
    device: () => 'dddddddddddddddd',
    // a connect is the start of the first sync of an opening: counted with it until it has run
    connect: () => {
      const job: Job = { id: ++state.ids, epoch: state.epoch, final: false, granted: false, settled: false, carry: 0, res: () => {}, rej: () => {} };
      state.jobs.push(job);
      return lock(async () => { job.granted = true; job.settled = true; return 'connected' as const; });
    },
    sync: () => {
      const job: Job = { id: ++state.ids, epoch: state.epoch, final: !state.crdtOn(), granted: false, settled: false, carry: 0, res: () => {}, rej: () => {} };
      state.jobs.push(job);
      return lock(() => new Promise((res, rej) => { job.granted = true; job.carry = state.written; job.res = res; job.rej = rej; }));
    },
    waiting: async () => state.written - state.sent,
    away: async () => [],
    fetch: async () => true,
    fetchAll: async () => ({ fetched: 0, left: 0 }),
  });
  return { state, reset, engine };
});

vi.mock('@tauri-apps/api/core', () => ({ invoke: async () => null }));
vi.mock('@tauri-apps/api/window', () => ({ getCurrentWindow: () => ({ setFocus: async () => {} }) }));
vi.mock('@tauri-apps/api/webviewWindow', () => ({ getCurrentWebviewWindow: () => ({ listen: async () => () => {} }) }));
vi.mock('../../vault/tauri-store.js', () => ({ createCollection: async () => '', deleteCollection: async () => {}, listCollections: async () => ({ home: '', names: [] }) }));
vi.mock('../collections.js', () => ({ collectionFs: () => ({}), freeName: (n: string) => n }));
vi.mock('../land.js', () => ({ notify: (m: string) => { h.state.said.push(m); } }));
vi.mock('../vault.js', () => ({ currentVault: () => h.state.current, note: (m: string) => { h.state.said.push(m); } }));
vi.mock('../away.js', () => ({ onLeave: (f: () => Promise<boolean>) => { h.state.leave = f; }, leaveForced: () => false }));
// git's side, as far as the strip goes: each of them starts the strip from nothing
vi.mock('../sync.js', () => {
  const SYNC_OFF = { on: false, repo: false, busy: null, offline: false, toPush: 0, conflicts: [], at: null, progress: null };
  const off = (): void => { (h.state.app as { setState(p: object): void } | null)?.setState({ sync: SYNC_OFF }); };
  return {
    SYNC_OFF,
    startSync: async () => { h.state.git += 1; off(); },
    stopSync: off,
  };
});
vi.mock('../../sync/index.js', () => ({ SNAP_AFTER: 64, SNAP_WORTH: 16, engine: h.engine }));
vi.mock('../storage.js', () => {
  const NO_STORAGE = { on: false, kind: 'folder', folder: '', endpoint: '', bucket: '', key: '', secret: '', address: '', user: '', password: '', appKey: '', clientId: '', clientSecret: '', place: '', account: '', dev: '', keep: null };
  return {
    NO_STORAGE,
    storageOf: (root: string) => h.state.settings.get(root) ?? { ...NO_STORAGE },
    saveStorage: (root: string, s: unknown) => { h.state.settings.set(root, s); },
    storageReady: (s: { account: string; place: string }) => s.account !== '' && s.place !== '',
    keepOf: () => 'all',
    storageName: () => 'collection',
    devStorages: async () => ({}),
    signIn: async () => 'me@example.com',
    signOut: async () => {},
    storageFor: () => new Promise((res, rej) => { h.state.storages.push({ id: ++h.state.ids, epoch: h.state.epoch, again: h.state.storages.some((s) => s.epoch === h.state.epoch), settled: false, res, rej }); }),
  };
});

const ROOT = '/collections/a';
const READY = { on: true, kind: 'dropbox', folder: '', endpoint: '', bucket: '', key: '', secret: '', address: '', user: '', password: '', appKey: 'k', clientId: '', clientSecret: '', place: 'notes', account: 'me@example.com', dev: '', keep: null } satisfies StorageSettings;
const WRITE_QUIET_MS = 3_000;
const POLL_MS = 30_000;
const FOCUS_GAP_MS = 10_000;
const GONE = 'sign in again';

// ── the chart ─────────────────────────────────────────────────────

type Phase = 'closed' | 'starting' | 'open' | 'broken' | 'revoked';
interface M {
  phase: Phase;
  /** The opening of the collection the controller is on: the test's count of opens and sign-ins. */
  epoch: number;
  /** Syncs of this opening: none, one running, one running and one more asked for. */
  run: 0 | 1 | 2;
  offline: boolean;
  /** The write timer, ms to go; null when none. */
  armed: number | null;
  /** The poll, ms to go; while broken, the retry's timer. */
  poll: number;
  /** Broken, and its storage being made again. */
  trying: boolean;
  /** Since a sync last reached the storage, ms. */
  since: number;
  /** Writes the controller has been told of, and how many of them the last sync to start had seen (the one before it, for a sync that fails). */
  writes: number;
  mark: number;
  prev: number;
  /** The collection is signed in. */
  account: boolean;
}

/** The head of the engine's queue, as the environment has it: what a settle settles. */
interface Head { epoch: number; final: boolean }
type Ev =
  | { e: 'open' } | { e: 'close' } | { e: 'signIn' } | { e: 'signOut' }
  | { e: 'write' } | { e: 'tick'; ms: number } | { e: 'focus' } | { e: 'leave' }
  | { e: 'storageOk'; i: number } | { e: 'storageFail'; i: number }
  | { e: 'syncOk' } | { e: 'syncFail' } | { e: 'syncGone' };

interface Env { head: Head | null; storage: (i: number) => { epoch: number } | null }

/** A sync asked for: it runs when none does, else it is the one after, which every ask meanwhile shares. */
function ask(m: M): M {
  if (m.run === 0) return begin({ ...m, run: 1 });
  return { ...m, run: 2 };
}
/** A sync starts running: the write timer is spent, and it has seen every write so far. */
const begin = (m: M): M => ({ ...m, armed: null, prev: m.mark, mark: m.writes });
/** The running sync of this opening is done: the next, if one was asked for, starts. */
const done = (m: M, ok: boolean): M => {
  const n: M = { ...m, offline: !ok, mark: ok ? m.mark : m.prev, since: ok ? 0 : m.since };
  return n.run === 2 ? begin({ ...n, run: 1 }) : { ...n, run: 0 };
};
/** Time passes: the write timer and the poll fire when due. */
function tick(m: M, ms: number): M {
  let n: M = { ...m, since: Math.min(m.since + ms, 1e9) };
  // broken: the retry's timer, which tries unless a try is under way
  if (n.phase === 'broken') return n.poll > ms ? { ...n, poll: n.poll - ms } : { ...n, poll: n.poll + POLL_MS - ms, trying: true };
  if (n.phase !== 'open') return n;
  const write = n.armed !== null && n.armed <= ms;
  const poll = n.poll <= ms;
  n = { ...n, armed: n.armed === null ? null : write ? null : n.armed - ms, poll: poll ? n.poll + POLL_MS - ms : n.poll - ms };
  if (write) n = ask(n);
  if (poll) n = ask(n);
  return n;
}

interface Transition { from: Phase[]; on: Ev['e']; guard?: (m: M, ev: Ev, env: Env) => boolean; to: (m: M, ev: Ev, env: Env) => M; says: string }
const current = (m: M, _ev: Ev, env: Env) => env.head !== null && !env.head.final && env.head.epoch === m.epoch && m.phase === 'open';
const mine = (m: M, ev: Ev, env: Env) => 'i' in ev && env.storage(ev.i)?.epoch === m.epoch && (m.phase === 'starting' || (m.phase === 'broken' && m.trying));

/** The statechart, as data: the first transition whose phase, event and guard match is taken; an event none takes changes nothing. */
const CHART: Transition[] = [
  { from: ['closed', 'broken'], on: 'open', to: (m) => ({ ...m, phase: 'starting', epoch: m.epoch + 1, run: 0, offline: false, armed: null, trying: false, account: true }), says: 'starting' },
  // made at the open, or by a try again from broken (the strip offline until its first sync reaches it)
  { from: ['starting', 'broken'], on: 'storageOk', guard: mine, to: (m) => ask({ ...m, phase: 'open', poll: POLL_MS, trying: false }), says: 'open, its first sync running' },
  { from: ['starting'], on: 'storageFail', guard: mine, to: (m) => ({ ...m, phase: 'broken', offline: true, poll: POLL_MS }), says: 'broken, the retry timer set' },
  { from: ['broken'], on: 'storageFail', guard: mine, to: (m) => ({ ...m, trying: false }), says: 'still broken' },
  { from: ['broken'], on: 'focus', guard: (m) => !m.trying, to: (m) => ({ ...m, trying: true }), says: 'the storage tried again' },
  { from: ['starting', 'open', 'broken', 'revoked'], on: 'close', to: (m) => ({ ...m, phase: 'closed', run: 0, offline: false, armed: null, trying: false }), says: 'closed' },
  { from: ['starting', 'open', 'broken', 'revoked'], on: 'signIn', to: (m) => ({ ...m, phase: 'starting', epoch: m.epoch + 1, run: 0, offline: false, armed: null, trying: false, account: true }), says: 'starting again' },
  { from: ['starting', 'open', 'broken'], on: 'signOut', guard: (m) => m.account, to: (m) => ({ ...m, phase: 'closed', run: 0, offline: false, armed: null, trying: false, account: false }), says: 'closed (git may sync)' },
  { from: ['open'], on: 'write', to: (m) => ({ ...m, writes: m.writes + 1, armed: WRITE_QUIET_MS }), says: 'the write timer set' },
  { from: ['revoked'], on: 'write', to: (m) => ({ ...m, writes: m.writes + 1 }), says: 'kept in the engine, no timer' },
  { from: ['open'], on: 'focus', guard: (m) => m.since >= FOCUS_GAP_MS, to: ask, says: 'a sync asked for' },
  { from: ['open'], on: 'leave', guard: (m) => m.writes !== m.mark, to: ask, says: 'a sync asked for' },
  { from: ['closed', 'starting', 'open', 'broken', 'revoked'], on: 'tick', to: (m, ev) => tick(m, (ev as { ms: number }).ms), says: 'the timers fire when due' },
  { from: ['open'], on: 'syncOk', guard: current, to: (m) => done(m, true), says: 'synced; the next, if asked for' },
  { from: ['open'], on: 'syncFail', guard: current, to: (m) => done(m, false), says: 'offline; the next, if asked for' },
  { from: ['open'], on: 'syncGone', guard: current, to: (m) => ({ ...m, phase: 'revoked', run: 0, offline: true, armed: null, mark: m.prev, account: false }), says: 'revoked: no timer, and the one after it does not go' },
  // a sync of an earlier opening, or a close's last: only the clock it reached the storage by
  { from: ['closed', 'starting', 'open', 'broken', 'revoked'], on: 'syncOk', guard: (_m, _e, env) => env.head !== null && !env.head.final, to: (m) => ({ ...m, since: 0 }), says: 'nothing (an earlier sync done)' },
];

function step(m: M, ev: Ev, env: Env): M {
  const t = CHART.find((t) => t.on === ev.e && t.from.includes(m.phase) && (!t.guard || t.guard(m, ev, env)));
  return t ? t.to(m, ev, env) : m;
}

const M0: M = { phase: 'closed', epoch: 0, run: 0, offline: false, armed: null, poll: POLL_MS, trying: false, since: 1e9, writes: 0, mark: 0, prev: 0, account: true };

// ── the real controller under the chart ───────────────────────────

type Crdt = typeof import('../crdt.js');
type Git = typeof import('../sync.js');
type Store = typeof import('../store.js');

interface Run { crdt: Crdt; git: Git; store: Store; m: M; vault: FakeVault; removers: (() => void)[] }
interface FakeVault { root: string; fs: unknown; subscribe(fn: () => void): () => void; write(): void }

function fakeVault(): FakeVault {
  const subs = new Set<() => void>();
  const fs = { door: { fetcher: () => {} }, away: () => [] };
  return {
    root: ROOT,
    fs,
    subscribe(fn) { subs.add(fn); return () => { subs.delete(fn); }; },
    write() { h.state.written += 1; for (const f of [...subs]) f(); },
  };
}

const flush = async (): Promise<void> => { for (let i = 0; i < 4; i++) await new Promise<void>((r) => setImmediate(r)); };

async function boot(): Promise<Run> {
  vi.resetModules();
  h.reset();
  vi.setSystemTime(Date.parse('2026-11-09T09:00:00Z'));
  const removers: (() => void)[] = [];
  // the module listens on the window for focus: each run's listeners go with it
  for (const target of [window, document] as EventTarget[]) {
    const add = target.addEventListener.bind(target);
    const spy = vi.spyOn(target, 'addEventListener').mockImplementation((type: string, fn: EventListenerOrEventListenerObject | null, o?: boolean | AddEventListenerOptions) => {
      add(type, fn, o);
      removers.push(() => target.removeEventListener(type, fn, o));
    });
    removers.push(() => spy.mockRestore());
  }
  const crdt = await import('../crdt.js');
  const store = await import('../store.js');
  const git = await import('../sync.js');
  h.state.crdtOn = crdt.crdtOn;
  h.state.app = store.useApp;
  h.state.settings.set(ROOT, { ...READY });
  return { crdt, git, store, m: M0, vault: fakeVault(), removers };
}

function headOf(): (typeof h.state.jobs)[number] | null {
  return h.state.jobs.find((j) => j.granted && !j.settled) ?? null;
}
const env = (): Env => {
  const j = headOf();
  return { head: j ? { epoch: j.epoch, final: j.final } : null, storage: (i) => h.state.storages[i] ?? null };
};

/** The events that can happen now, by what the environment holds. */
function enabled(r: Run): Ev[] {
  const out: Ev[] = [];
  const { phase } = r.m;
  if (phase === 'closed') out.push({ e: 'open' });
  else out.push({ e: 'close' }, { e: 'signIn' });
  if (phase !== 'closed' && r.m.account) out.push({ e: 'signOut' });
  if (phase !== 'closed') out.push({ e: 'write' });
  out.push({ e: 'tick', ms: WRITE_QUIET_MS }, { e: 'tick', ms: POLL_MS }, { e: 'focus' }, { e: 'leave' });
  h.state.storages.forEach((s, i) => { if (!s.settled) out.push({ e: 'storageOk', i }, { e: 'storageFail', i }); });
  if (headOf()) out.push({ e: 'syncOk' }, { e: 'syncFail' }, { e: 'syncGone' });
  return out;
}

const SYNCED = { read: 0, wrote: 1, kept: [], changed: [], took: 0, snapped: false, dropped: 0 };

async function apply(r: Run, ev: Ev): Promise<void> {
  const before = env();
  const next = step(r.m, ev, before);
  const revoked = r.m.phase === 'revoked';
  const calls = h.state.jobs.length + h.state.storages.length;
  switch (ev.e) {
    case 'open':
      h.state.epoch += 1;
      h.state.settings.set(ROOT, { ...READY });
      h.state.current = r.vault;
      void r.crdt.startCrdt(r.vault as never);
      break;
    case 'close':
      // as `closeVault` does
      h.state.current = null;
      r.crdt.stopCrdt();
      r.git.stopSync();
      break;
    case 'signIn':
      h.state.epoch += 1;
      h.state.current = r.vault;
      void r.crdt.signInStorage();
      break;
    case 'signOut':
      void r.crdt.signOutStorage();
      break;
    case 'write':
      if (r.m.phase !== 'closed') r.vault.write();
      break;
    case 'tick':
      vi.advanceTimersByTime(ev.ms);
      break;
    case 'focus':
      window.dispatchEvent(new Event('focus'));
      break;
    case 'leave':
      // `away.ts` settles every send
      void h.state.leave?.().catch(() => {});
      break;
    case 'storageOk':
    case 'storageFail': {
      const s = h.state.storages[ev.i]!;
      s.settled = true;
      if (ev.e === 'storageOk') s.res({ list: async () => [], read: async () => null, write: async () => {}, remove: async () => {} });
      else s.rej(new Error('icloud drive is not here'));
      break;
    }
    case 'syncOk':
    case 'syncFail':
    case 'syncGone': {
      const j = headOf()!;
      j.settled = true;
      if (ev.e === 'syncOk') { h.state.sent = Math.max(h.state.sent, j.carry); j.res(SYNCED); }
      else j.rej(new Error(ev.e === 'syncGone' ? GONE : 'offline'));
      break;
    }
  }
  r.m = next;
  await flush();
  // revoked, nothing is asked of the storage (a close's last sync neither) until a sign-in starts afresh
  if (revoked && next.phase !== 'starting') expect(h.state.jobs.length + h.state.storages.length - calls, `${name(ev)} while revoked: calls to the storage`).toBe(0);
}

/** The chart's invariants, held against the real controller. */
function check(r: Run, path: string): void {
  const m = r.m;
  const sync: SyncState = r.store.useApp.getState().sync;
  const at = `after ${path}`;
  const live = h.state.jobs.filter((j) => !j.settled && !j.final && j.epoch === m.epoch && m.phase === 'open').length;
  // at most one sync of the open collection asked of the engine, and one exactly while the chart has one running
  expect(live, `${at}: syncs of the open collection in the engine`).toBe(m.run > 0 ? 1 : 0);
  // revoked, the collection is still the storage's (not one for the other sync to start on), waiting for a sign-in
  expect(r.crdt.crdtOn(), `${at}: crdtOn`).toBe(m.phase === 'open' || m.phase === 'revoked');
  // the timers: the poll and the write timer while open, the retry's while broken, none otherwise
  expect(vi.getTimerCount(), `${at}: timers`).toBe(m.phase === 'open' ? 1 + (m.armed !== null ? 1 : 0) : m.phase === 'broken' ? 1 : 0);
  // at most one storage being made for this opening: while it starts, and while broken and trying again
  if (m.phase !== 'closed') expect(h.state.storages.filter((s) => !s.settled && s.epoch === m.epoch).length, `${at}: storages being made`).toBe(m.phase === 'starting' || (m.phase === 'broken' && m.trying) ? 1 : 0);
  // the strip
  if (m.phase === 'closed') expect(sync.on, `${at}: strip on`).toBe(false);
  else {
    expect(sync.on, `${at}: strip on`).toBe(true);
    const busy = m.phase === 'starting' ? 'pushing' : m.phase === 'open' && m.run > 0 ? 'pulling' : null;
    expect(sync.busy, `${at}: strip busy`).toBe(busy);
    expect(sync.offline, `${at}: strip offline`).toBe(m.offline);
    expect(sync.gone === true, `${at}: strip says sign in again`).toBe(m.phase === 'revoked');
    if (m.phase === 'open' && m.run === 0) expect(sync.toPush, `${at}: strip to push`).toBe(h.state.written - h.state.sent);
  }
}

/** Every sync let through until nothing more is asked: what was written while open has gone to the storage, and the chart is at rest. */
async function drain(r: Run, path: string): Promise<void> {
  while (headOf()) await apply(r, { e: 'syncOk' });
  if (r.m.phase === 'open') await apply(r, { e: 'tick', ms: POLL_MS });
  while (headOf()) await apply(r, { e: 'syncOk' });
  check(r, `${path} · drained`);
  if (r.m.phase === 'open') {
    expect(r.m.run, `${path} · drained: running`).toBe(0);
    expect(h.state.written - h.state.sent, `${path} · drained: writes not sent`).toBe(0);
  }
}

const name = (ev: Ev): string => ev.e + ('ms' in ev ? `(${ev.ms / 1000}s)` : 'i' in ev ? `#${ev.i}` : '');

/** A canonical summary of a state: the chart's, and the environment's queue. Two paths that reach one are explored once. */
function key(r: Run): string {
  const m = r.m;
  const jobs = h.state.jobs.filter((j) => !j.settled).map((j) => `${j.final ? 'f' : j.epoch === m.epoch ? 'c' : 'o'}${j.granted ? '!' : ''}${j.carry === h.state.written ? '' : '<'}`).join(',');
  const st = h.state.storages.map((s, i) => (s.settled ? '' : `${i}${s.epoch === m.epoch ? 'c' : 'o'}${s.again ? 'r' : ''}`)).join(',');
  return JSON.stringify([m.phase, m.run, m.offline, m.armed, m.poll, m.trying, Math.min(m.since, FOCUS_GAP_MS), m.writes - m.mark, m.writes - m.prev, m.account, h.state.written - h.state.sent, jobs, st]);
}

async function replay(path: Ev[]): Promise<Run> {
  const r = await boot();
  const names: string[] = [];
  for (const ev of path) {
    await apply(r, ev);
    names.push(name(ev));
    check(r, names.join(' → '));
  }
  return r;
}
const teardown = (r: Run): void => { r.crdt.stopCrdt(); for (const f of r.removers) f(); vi.clearAllTimers(); };

/** Breadth first over the event paths from a closed collection, to `depth` events, a state reached twice explored once. */
async function explore(depth: number): Promise<{ states: number; paths: number }> {
  const seen = new Set<string>();
  let frontier: Ev[][] = [[]];
  let paths = 0;
  for (let d = 0; d <= depth; d++) {
    const next: Ev[][] = [];
    for (const path of frontier) {
      const r = await replay(path);
      paths += 1;
      const k = key(r);
      if (seen.has(k)) { teardown(r); continue; }
      seen.add(k);
      const evs = enabled(r);
      if (d === depth) await drain(r, path.map(name).join(' → '));
      teardown(r);
      if (d < depth) for (const ev of evs) next.push([...path, ev]);
    }
    frontier = next;
  }
  return { states: seen.size, paths };
}

describe('the storage sync, against its chart', () => {
  afterEach(() => { vi.useRealTimers(); vi.restoreAllMocks(); });

  // Six events reach every pairing the bugs below need (an open, its storage, a sync running, a second ask, a close or
  // a sign-in, the late answer) with room for a failure before or after; seven more than doubles the time for no new kind of state.
  it('every interleaving of opens, closes, sign-ins and outs, writes, timers, focus, leaving, and syncs settled well or not, to six events', async () => {
    vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout', 'setInterval', 'clearInterval', 'Date'] });
    const { states, paths } = await explore(Number(process.env.ILMI_MODEL_DEPTH ?? 6));
    if (process.env.ILMI_MODEL_DEPTH) console.log(`crdt chart: ${states} states, ${paths} paths`);
    expect(states).toBeGreaterThan(200);
  }, 600_000);

  describe('what the chart found', () => {
    const run = async (path: Ev[]): Promise<Run> => {
      vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout', 'setInterval', 'clearInterval', 'Date'] });
      return replay(path);
    };

    it('a poll while a sync runs is the one after it, not a second in the engine, and the strip says pulling until both are done', async () => {
      const r = await run([{ e: 'open' }, { e: 'storageOk', i: 0 }, { e: 'tick', ms: POLL_MS }, { e: 'tick', ms: POLL_MS }, { e: 'focus' }]);
      expect(h.state.jobs.filter((j) => !j.settled).length).toBe(1);
      await apply(r, { e: 'syncOk' });
      check(r, 'the first done');
      expect(r.store.useApp.getState().sync.busy).toBe('pulling');
      await apply(r, { e: 'syncOk' });
      check(r, 'the second done');
      expect(r.store.useApp.getState().sync.busy).toBe(null);
      // the connect, and two syncs for three asks
      expect(h.state.jobs.length).toBe(3);
      teardown(r);
    });

    it('a collection closed while its storage is being made does not start syncing when it comes', async () => {
      const r = await run([{ e: 'open' }, { e: 'close' }, { e: 'storageOk', i: 0 }]);
      expect(r.crdt.crdtOn()).toBe(false);
      expect(vi.getTimerCount()).toBe(0);
      expect(h.state.jobs.length).toBe(0);
      teardown(r);
    });

    it('a sign-in while the storage is being made: the first answer is let go, one poll runs', async () => {
      const r = await run([{ e: 'open' }, { e: 'signIn' }, { e: 'storageOk', i: 1 }, { e: 'storageOk', i: 0 }]);
      expect(vi.getTimerCount()).toBe(1);
      teardown(r);
    });

    // eight events deep: the second opening's connect waits behind the first's sync and the close's, and comes when a third is open
    it('an opening closed while its connect waits its turn does not sync after it', async () => {
      const r = await run([{ e: 'open' }, { e: 'storageOk', i: 0 }, { e: 'signIn' }, { e: 'storageOk', i: 1 }, { e: 'signIn' }, { e: 'storageOk', i: 2 }, { e: 'syncOk' }, { e: 'syncOk' }]);
      await drain(r, 'drained');
      teardown(r);
    });

    it('leaving after a sync that did not reach the storage sends what was written', async () => {
      const r = await run([{ e: 'open' }, { e: 'storageOk', i: 0 }, { e: 'syncOk' }, { e: 'write' }, { e: 'tick', ms: WRITE_QUIET_MS }, { e: 'syncFail' }, { e: 'leave' }]);
      expect(h.state.jobs.filter((j) => !j.settled).length).toBe(1);
      teardown(r);
    });
  });

  describe('a storage that could not be made, and a sign-in let go of', () => {
    const run = async (path: Ev[]): Promise<Run> => {
      vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout', 'setInterval', 'clearInterval', 'Date'] });
      return replay(path);
    };
    const word = async (r: Run): Promise<string | null> => (await vi.importActual<Git>('../sync.js')).syncWord(r.store.useApp.getState().sync);

    it('broken: tried again every half minute, one try at a time; one made opens it as a first start does, and what was written goes', async () => {
      const r = await run([{ e: 'open' }, { e: 'storageFail', i: 0 }, { e: 'write' }, { e: 'tick', ms: POLL_MS }, { e: 'tick', ms: POLL_MS }, { e: 'focus' }]);
      // the first try still under way: the timer and the focus since made no second
      expect(h.state.storages.length).toBe(2);
      expect(await word(r)).toBe('offline');
      await apply(r, { e: 'storageOk', i: 1 });
      check(r, 'made');
      expect(r.crdt.crdtOn()).toBe(true);
      // the poll, not the retry's timer
      expect(vi.getTimerCount()).toBe(1);
      await apply(r, { e: 'syncOk' });
      check(r, 'synced');
      expect(await word(r)).toBe('synced');
      expect(h.state.sent).toBe(h.state.written);
      teardown(r);
    });

    it('broken: a focus tries again at once, and a try that failed waits for the next', async () => {
      const r = await run([{ e: 'open' }, { e: 'storageFail', i: 0 }, { e: 'focus' }, { e: 'storageFail', i: 1 }]);
      expect(h.state.storages.length).toBe(2);
      expect(vi.getTimerCount()).toBe(1);
      await apply(r, { e: 'focus' });
      expect(h.state.storages.length).toBe(3);
      teardown(r);
    });

    it('broken: a try that comes after a close, or after a sign-in, is let go', async () => {
      const r = await run([{ e: 'open' }, { e: 'storageFail', i: 0 }, { e: 'focus' }, { e: 'close' }, { e: 'storageOk', i: 1 }]);
      expect(r.crdt.crdtOn()).toBe(false);
      expect(vi.getTimerCount()).toBe(0);
      expect(h.state.jobs.length).toBe(0);
      teardown(r);
      const s = await run([{ e: 'open' }, { e: 'storageFail', i: 0 }, { e: 'focus' }, { e: 'signIn' }, { e: 'storageOk', i: 1 }]);
      expect(s.crdt.crdtOn()).toBe(false);
      expect(h.state.jobs.length).toBe(0);
      await apply(s, { e: 'storageOk', i: 2 });
      check(s, 'the sign-in\'s made');
      expect(h.state.jobs.filter((j) => !j.settled).length).toBe(1);
      teardown(s);
    });

    it('revoked: nothing goes to the storage, no timer runs, the strip says sign in again; a sign-in sends what was written meanwhile', async () => {
      const r = await run([{ e: 'open' }, { e: 'storageOk', i: 0 }, { e: 'tick', ms: POLL_MS }, { e: 'syncGone' }]);
      expect(r.store.useApp.getState().sync.busy).toBe(null);
      expect(await word(r)).toBe('sign in again');
      expect(vi.getTimerCount()).toBe(0);
      const asked = h.state.jobs.length;
      for (const ev of [{ e: 'write' }, { e: 'tick', ms: WRITE_QUIET_MS }, { e: 'tick', ms: POLL_MS }, { e: 'tick', ms: POLL_MS }, { e: 'focus' }, { e: 'leave' }] as Ev[]) {
        await apply(r, ev);
        check(r, name(ev));
      }
      await expect(r.crdt.crdtNow()).rejects.toThrow(GONE);
      expect(h.state.jobs.length).toBe(asked);
      expect(await word(r)).toBe('sign in again');
      await apply(r, { e: 'signIn' });
      await apply(r, { e: 'storageOk', i: 1 });
      check(r, 'signed in again');
      while (headOf()) await apply(r, { e: 'syncOk' });
      check(r, 'synced');
      expect(await word(r)).toBe('synced');
      expect(h.state.sent).toBe(h.state.written);
      teardown(r);
    });
  });
});
