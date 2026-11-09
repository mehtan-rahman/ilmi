// @vitest-environment jsdom
// Git sync's controller (`src/app/sync.ts`, milestones 53 and 54) as a
// statechart, and the real controller checked against it over every
// interleaving of its events to a depth. The Rust side is a fake: a
// repository per collection that counts its commits not on the remote,
// whose fetch and push wait for the test to answer them (well, by the
// network failing, or by an error that is not the network's); the nudge
// is a callback the test calls; the timers are vitest's. Two collections,
// so that one opened while the other's work is still queued shows whose
// strip and whose token that work uses.
//
// The chart, `CHART` below. Its states: `closed`, and an open collection
// that is `idle`, `pulling` or `pushing` (a push that failed tries once
// more after a pull: `retry`, then `again`). Beside them, what the strip
// says of the last time the remote was reached (offline or not). The
// state is read off what the fake holds (which fetch or push waits, and
// for which collection); the chart says what the strip must say then.

import { afterEach, describe, expect, it, vi } from 'vitest';
import type { SyncState } from '../sync.js';

const h = vi.hoisted(() => {
  interface Repo { ahead: number; dirty: boolean }
  /** A fetch or a push the test has not answered. */
  interface Wait { id: number; op: 'fetch' | 'push'; repo: string; token: string | null; epoch: number; open: boolean; final: boolean; res: (v: unknown) => void; rej: (e: unknown) => void }
  const state = {
    repos: new Map<string, Repo>(),
    /** Written in a collection and not in its repository's folder yet. */
    unwritten: new Set<string>(),
    waits: [] as Wait[],
    nudge: null as null | (() => void),
    leave: null as null | (() => Promise<boolean>),
    ids: 0,
    /** The test's count of opens, and the collection open: what a fetch or a push is asked under. */
    epoch: 0,
    root: null as string | null,
    /** The command before this one: a push after a status is the controller's; one after a commit or the changes is a close's last. */
    last: '',
  };
  const repoOf = (r: string): Repo => {
    let x = state.repos.get(r);
    if (!x) state.repos.set(r, (x = { ahead: 0, dirty: false }));
    return x;
  };
  const invoke = async (cmd: string, a: { root?: string; token?: string | null } = {}): Promise<unknown> => {
    const r = a.root ?? '';
    const last = state.last;
    state.last = cmd;
    switch (cmd) {
      case 'sync_status': { const x = repoOf(r); return { repo: true, remote: 'https://example.com/notes.git', branch: 'main', dirty: x.dirty ? ['a.md'] : [], ahead: x.ahead, behind: 0 }; }
      case 'sync_changes': return repoOf(r).dirty ? [{ path: 'a.md', before: 'a', after: 'b', binary: false }] : [];
      case 'sync_commit': { const x = repoOf(r); x.dirty = false; x.ahead += 1; return `c${++state.ids}`; }
      case 'sync_merge': return { kind: 'none', theirs: null, pulled: [], conflicts: [] };
      case 'sync_fetch':
      case 'sync_push':
        return new Promise((res, rej) => {
          state.waits.push({ id: ++state.ids, op: cmd === 'sync_fetch' ? 'fetch' : 'push', repo: r, token: a.token ?? null, epoch: state.epoch, open: r === `${state.root}/repo`, final: cmd === 'sync_push' && last !== 'sync_status', res, rej });
        });
      default: return null;
    }
  };
  const reset = (): void => { state.repos.clear(); state.unwritten.clear(); state.waits = []; state.nudge = null; state.leave = null; state.ids = 0; state.epoch = 0; state.root = null; state.last = ''; };
  return { state, invoke, reset, repoOf };
});

vi.mock('@tauri-apps/api/core', () => ({ invoke: h.invoke }));
vi.mock('../../vault/index.js', async (orig) => ({
  ...(await orig<typeof import('../../vault/index.js')>()),
  // the folder made to hold what the collection holds: what was written there is a change to commit
  mirrorFolder: async (_fs: unknown, at: string) => { if (h.state.unwritten.delete(at)) h.repoOf(`${at}/repo`).dirty = true; },
  takeFiles: async () => {},
  importFolder: async () => {},
}));
vi.mock('../../vault/tauri-store.js', () => ({ createCollection: async () => '', deleteCollection: async () => {}, listCollections: async () => ({ home: '', names: [] }) }));
vi.mock('../collections.js', () => ({ collectionFs: () => ({}), diskFs: {}, freeName: (n: string) => n }));
vi.mock('../land.js', () => ({ notify: () => {} }));
vi.mock('../vault.js', () => ({ note: () => {}, openNode: () => {} }));
vi.mock('../storage.js', () => ({ forgetStorage: () => {} }));
vi.mock('../away.js', () => ({ onLeave: (f: () => Promise<boolean>) => { h.state.leave = f; }, leaveForced: () => false }));
vi.mock('../platform.js', () => ({ vaultKey: (r: string) => r, nameFromRemote: () => 'notes', onePane: () => false }));
vi.mock('../nudge.js', () => ({
  NUDGE_SERVER: 'https://ntfy.sh',
  ago: (ms: number) => `${Math.round(ms / 1000)} s ago`,
  publishNudge: async () => true,
  subscribeNudge: (_s: string, _u: string, on: () => void) => { h.state.nudge = on; return { stop: () => { if (h.state.nudge === on) h.state.nudge = null; } }; },
}));

const A = '/collections/a';
const B = '/collections/b';
const TOKEN: Record<string, string> = { [A]: 'token-a', [B]: 'token-b' };
const QUIET_MS = 5_000;
const PUSH_AFTER_MS = 60_000;
const PULL_EVERY_MS = 120_000;
const NET = 'failed to connect to example.com; class=Net (12)';
const REJECTED = 'cannot push non-fastforwardable reference';
const BROKEN = 'object 0badf00d is corrupt';

// ── the chart ─────────────────────────────────────────────────────

type Phase = 'closed' | 'idle' | 'pulling' | 'pushing';
/** A push's tries: the first; the pull after it failed; the push once more after that pull. */
type Try = 'first' | 'retry' | 'again';
interface M { root: string | null; offline: boolean; tries: Try }
type Answer = 'ok' | 'net' | 'error';
type Ev =
  | { e: 'open'; at: string } | { e: 'close' } | { e: 'write' } | { e: 'tick'; ms: number }
  | { e: 'focus' } | { e: 'nudge' } | { e: 'leave' }
  | { e: 'answer'; how: Answer };

/** What waits on the remote, as the fake has it: which way, and whether it is the open collection's. */
interface Env { wait: { op: 'fetch' | 'push'; mine: boolean; earlier: boolean } | null }
const phaseOf = (m: M, env: Env): Phase => (m.root === null ? 'closed' : env.wait?.mine ? (env.wait.op === 'fetch' ? 'pulling' : 'pushing') : 'idle');

interface Transition { from: Phase[]; on: Ev['e']; guard?: (m: M, ev: Ev, env: Env) => boolean; to: (m: M, ev: Ev, env: Env) => M; says: string }
const how = (ev: Ev): Answer | null => (ev.e === 'answer' ? ev.how : null);

/**
 * The statechart, as data. The events that only ask for work (a write, a
 * timer, a focus, a nudge, a leave) change nothing here: the work is
 * queued, and the state follows from what waits on the remote. What the
 * chart keeps is the strip's offline, which follows the last answer from
 * the remote of the open collection, and a push's tries.
 */
const CHART: Transition[] = [
  { from: ['closed', 'idle', 'pulling', 'pushing'], on: 'open', to: (_m, ev) => ({ root: (ev as { at: string }).at, offline: false, tries: 'first' }), says: 'open: its status, a pull, the timers' },
  { from: ['idle', 'pulling', 'pushing'], on: 'close', to: () => ({ root: null, offline: false, tries: 'first' }), says: 'closed: the timers stop; a last push of what is written' },
  { from: ['pulling'], on: 'answer', guard: (_m, ev) => how(ev) === 'ok', to: (m) => ({ ...m, offline: false, tries: m.tries === 'retry' ? 'again' : 'first' }), says: 'idle (or the push once more)' },
  { from: ['pulling'], on: 'answer', guard: (_m, ev) => how(ev) === 'net', to: (m) => ({ ...m, offline: true, tries: 'first' }), says: 'idle, offline' },
  { from: ['pulling'], on: 'answer', guard: (_m, ev) => how(ev) === 'error', to: (m) => ({ ...m, tries: 'first' }), says: 'idle; the error logged' },
  { from: ['pushing'], on: 'answer', guard: (_m, ev) => how(ev) === 'ok', to: (m) => ({ ...m, offline: false, tries: 'first' }), says: 'idle, pushed; the nudge sent' },
  { from: ['pushing'], on: 'answer', guard: (m) => m.tries === 'first', to: (m) => ({ ...m, tries: 'retry' }), says: 'pulling: behind the remote, perhaps' },
  { from: ['pushing'], on: 'answer', guard: (_m, ev) => how(ev) === 'net', to: (m) => ({ ...m, offline: true, tries: 'first' }), says: 'idle, offline' },
  { from: ['pushing'], on: 'answer', guard: (_m, ev) => how(ev) === 'error', to: (m) => ({ ...m, tries: 'first' }), says: 'idle; the error logged' },
];

function step(m: M, ev: Ev, env: Env): M {
  const p = phaseOf(m, env);
  const t = CHART.find((t) => t.on === ev.e && t.from.includes(p) && (!t.guard || t.guard(m, ev, env)));
  return t ? t.to(m, ev, env) : m;
}

const M0: M = { root: null, offline: false, tries: 'first' };

// ── the real controller under the chart ───────────────────────────

type Sync = typeof import('../sync.js');
type Store = typeof import('../store.js');
interface FakeVault { root: string; fs: unknown; subscribe(fn: (ev: unknown) => void): () => void; changed(): Promise<void>; write(): void }
interface Run { sync: Sync; store: Store; m: M; vaults: Record<string, FakeVault>; removers: (() => void)[] }

function fakeVault(root: string): FakeVault {
  const subs = new Set<(ev: unknown) => void>();
  return {
    root,
    fs: {},
    subscribe(fn) { subs.add(fn); return () => { subs.delete(fn); }; },
    async changed() {},
    write() { h.state.unwritten.add(root); for (const f of [...subs]) f({ kind: 'doc', paths: ['a.md'] }); },
  };
}

const flush = async (): Promise<void> => { for (let i = 0; i < 6; i++) await new Promise<void>((r) => setImmediate(r)); };

async function boot(): Promise<Run> {
  vi.resetModules();
  h.reset();
  vi.setSystemTime(Date.parse('2026-11-09T09:00:00Z'));
  const removers: (() => void)[] = [];
  for (const target of [window, document] as EventTarget[]) {
    const add = target.addEventListener.bind(target);
    const spy = vi.spyOn(target, 'addEventListener').mockImplementation((type: string, fn: EventListenerOrEventListenerObject | null, o?: boolean | AddEventListenerOptions) => {
      add(type, fn, o);
      removers.push(() => target.removeEventListener(type, fn, o));
    });
    removers.push(() => spy.mockRestore());
  }
  const all: Record<string, unknown> = {};
  for (const r of [A, B]) all[r] = { url: 'https://example.com/notes.git', token: TOKEN[r], server: 'https://ntfy.example' };
  localStorage.setItem('ilmi.sync', JSON.stringify(all));
  const sync = await import('../sync.js');
  const store = await import('../store.js');
  return { sync, store, m: M0, vaults: { [A]: fakeVault(A), [B]: fakeVault(B) }, removers };
}

const ownerOf = (repo: string): string => repo.replace(/\/repo$/, '');
const env = (r: Run): Env => {
  const w = h.state.waits[0];
  return { wait: w ? { op: w.op, mine: ownerOf(w.repo) === r.m.root && !w.final, earlier: w.epoch !== h.state.epoch } : null };
};

function enabled(r: Run): Ev[] {
  const out: Ev[] = [{ e: 'open', at: A }, { e: 'open', at: B }];
  if (r.m.root) out.push({ e: 'close' }, { e: 'write' }, { e: 'focus' }, { e: 'nudge' }, { e: 'leave' });
  out.push({ e: 'tick', ms: QUIET_MS }, { e: 'tick', ms: PUSH_AFTER_MS }, { e: 'tick', ms: PULL_EVERY_MS });
  if (h.state.waits.length) out.push({ e: 'answer', how: 'ok' }, { e: 'answer', how: 'net' }, { e: 'answer', how: 'error' });
  return out;
}

async function apply(r: Run, ev: Ev): Promise<void> {
  const next = step(r.m, ev, env(r));
  if (ev.e === 'open') h.state.epoch += 1;
  h.state.root = next.root;
  switch (ev.e) {
    // as `openVault` and `closeVault` do
    case 'open': void r.sync.startSync(r.vaults[ev.at] as never).catch(() => {}); break;
    case 'close': r.sync.stopSync(); break;
    case 'write': r.vaults[r.m.root!]!.write(); break;
    case 'tick': vi.advanceTimersByTime(ev.ms); break;
    case 'focus': window.dispatchEvent(new Event('focus')); break;
    case 'nudge': h.state.nudge?.(); break;
    case 'leave': void h.state.leave?.().catch(() => {}); break;
    case 'answer': {
      const w = h.state.waits.shift()!;
      if (ev.how === 'ok') {
        if (w.op === 'push') h.repoOf(w.repo).ahead = 0;
        w.res({ repo: true, remote: 'x', branch: 'main', dirty: [], ahead: 0, behind: 0 });
      } else w.rej(new Error(ev.how === 'net' ? NET : w.op === 'push' ? REJECTED : BROKEN));
      break;
    }
  }
  r.m = next;
  await flush();
}

/** The chart's invariants, held against the real controller. */
function check(r: Run, path: string): void {
  const at = `after ${path}`;
  const m = r.m;
  const sync: SyncState = r.store.useApp.getState().sync;
  // one git operation at a time
  expect(h.state.waits.length, `${at}: on the remote at once`).toBeLessThanOrEqual(1);
  const w = h.state.waits[0];
  if (w) {
    // a collection's work goes with its own token, whichever collection is open by then
    expect(w.token, `${at}: the token of a ${w.op} to ${w.repo}`).toBe(TOKEN[ownerOf(w.repo)]);
    // a collection no longer open is not pulled: only its last push goes
    if (!w.open) expect(w.final ? 'last push' : w.op, `${at}: what goes to a collection not open`).toBe('last push');
  }
  const p = phaseOf(m, env(r));
  if (p === 'closed') expect(sync.on, `${at}: strip on`).toBe(false);
  else {
    expect(sync.on, `${at}: strip on`).toBe(true);
    // (the work of an earlier opening of this same collection may say so or not: the strip started again)
    if (!(env(r).wait?.mine && env(r).wait?.earlier)) expect(sync.busy, `${at}: strip busy`).toBe(p === 'pulling' ? 'pulling' : p === 'pushing' ? 'pushing' : null);
    expect(sync.offline, `${at}: strip offline`).toBe(m.offline);
    // the pull timer runs while a collection syncs
    expect(vi.getTimerCount(), `${at}: timers`).toBeGreaterThanOrEqual(1);
  }
  // nothing left ticking once closed and quiet
  if (p === 'closed' && !w) expect(vi.getTimerCount(), `${at}: timers when closed`).toBe(0);
}

/** Every answer good and the timers run out until nothing waits: every commit is on the remote, and nothing written is left out of one. */
async function drain(r: Run, path: string): Promise<void> {
  const settle = async (): Promise<void> => {
    for (let i = 0; i < 4; i++) {
      while (h.state.waits.length) await apply(r, { e: 'answer', how: 'ok' });
      if (!r.m.root) break;
      for (const ms of [QUIET_MS, PULL_EVERY_MS, PUSH_AFTER_MS]) {
        await apply(r, { e: 'tick', ms });
        while (h.state.waits.length) await apply(r, { e: 'answer', how: 'ok' });
      }
    }
  };
  await settle();
  check(r, `${path} · drained`);
  for (const [repo, x] of h.state.repos) expect(x.dirty, `${path} · drained: ${repo} written and not committed`).toBe(false);
  expect([...h.state.unwritten], `${path} · drained: written and never in a repository`).toEqual([]);
  // a collection closed keeps what its last push could not send: its next open sends it (its pull reaches the remote, and a push follows)
  for (const [repo, x] of [...h.state.repos]) {
    if (x.ahead === 0) continue;
    if (ownerOf(repo) !== r.m.root) await apply(r, { e: 'open', at: ownerOf(repo) });
    await settle();
    expect(x.ahead, `${path} · drained: commits of ${repo} not on the remote`).toBe(0);
  }
}

const name = (ev: Ev): string => ev.e + ('ms' in ev ? `(${ev.ms / 1000}s)` : 'at' in ev ? `(${ev.at === A ? 'a' : 'b'})` : 'how' in ev ? `(${ev.how})` : '');

function key(r: Run): string {
  const m = r.m;
  const w = h.state.waits.map((x) => `${x.op}:${ownerOf(x.repo) === m.root ? 'mine' : ownerOf(x.repo)}`).join(',');
  const repos = [...h.state.repos].map(([k, x]) => `${k}:${Math.min(x.ahead, 2)}${x.dirty ? 'd' : ''}`).sort().join(',');
  const s = r.store.useApp.getState().sync;
  return JSON.stringify([m, w, repos, [...h.state.unwritten].sort(), s.busy, s.offline, s.on, vi.getTimerCount()]);
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
/** The run's work let finish, so none of it lands in the next run's fake. */
async function teardown(r: Run): Promise<void> {
  r.sync.stopSync();
  vi.clearAllTimers();
  await flush();
  for (let w = h.state.waits.shift(); w; w = h.state.waits.shift()) { w.res({ repo: true, remote: 'x', branch: 'main', dirty: [], ahead: 0, behind: 0 }); await flush(); }
  vi.clearAllTimers();
  for (const f of r.removers) f();
}

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
      if (seen.has(k)) { await teardown(r); continue; }
      seen.add(k);
      const evs = enabled(r);
      if (d === depth) await drain(r, path.map(name).join(' → '));
      await teardown(r);
      if (d < depth) for (const ev of evs) next.push([...path, ev]);
    }
    frontier = next;
  }
  return { states: seen.size, paths };
}

const fake = () => vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout', 'setInterval', 'clearInterval', 'Date'] });

describe('git sync, against its chart', () => {
  afterEach(() => { vi.useRealTimers(); vi.restoreAllMocks(); localStorage.clear(); });

  // Four events take a collection through its open's pull, a write and its commit, a push failed and its retry, or a
  // second collection opened while the first's work waits (three events found the strip of one showing the other's
  // answer); the drain after each path adds the timers' work and reopens a collection that has commits left. Five
  // events pass too (ILMI_MODEL_DEPTH=5) but take a minute; the paths below that need five are kept as they are.
  it('every interleaving of opens of two collections, closes, writes, timers, focus, nudges, leaving, and answers from the remote, to four events', async () => {
    fake();
    const { states, paths } = await explore(Number(process.env.ILMI_MODEL_DEPTH ?? 4));
    if (process.env.ILMI_MODEL_DEPTH) console.log(`git chart: ${states} states, ${paths} paths`);
    expect(states).toBeGreaterThan(100);
  }, 600_000);

  describe('what the chart found', () => {
    it('a push queued for one collection runs after another opened: with its own token, or not at all', async () => {
      fake();
      // a's pull waits on the remote; a leave queues a push behind it; b opens
      const r = await replay([{ e: 'open', at: A }, { e: 'write' }, { e: 'leave' }, { e: 'open', at: B }, { e: 'answer', how: 'ok' }]);
      await drain(r, 'drained');
      await teardown(r);
    });

    it('commits that waited for the network go out once a pull reaches the remote', async () => {
      fake();
      const r = await replay([{ e: 'open', at: A }, { e: 'answer', how: 'ok' }, { e: 'write' }, { e: 'tick', ms: QUIET_MS }, { e: 'tick', ms: PUSH_AFTER_MS }, { e: 'answer', how: 'net' }, { e: 'answer', how: 'net' }]);
      expect(h.repoOf(`${A}/repo`).ahead).toBe(1);
      await apply(r, { e: 'tick', ms: PULL_EVERY_MS });
      await apply(r, { e: 'answer', how: 'ok' });
      check(r, 'the pull back');
      // a minute on (the pull timer's next comes first)
      await apply(r, { e: 'tick', ms: PUSH_AFTER_MS });
      const ops: string[] = [];
      while (h.state.waits.length) { ops.push(h.state.waits[0]!.op); await apply(r, { e: 'answer', how: 'ok' }); }
      expect(ops).toContain('push');
      expect(h.repoOf(`${A}/repo`).ahead).toBe(0);
      await teardown(r);
    });

    it('leaving with commits a failed push left sends them', async () => {
      fake();
      const r = await replay([{ e: 'open', at: A }, { e: 'answer', how: 'ok' }, { e: 'write' }, { e: 'tick', ms: QUIET_MS }, { e: 'tick', ms: PUSH_AFTER_MS }, { e: 'answer', how: 'net' }, { e: 'answer', how: 'net' }, { e: 'leave' }]);
      expect(h.state.waits[0]?.op).toBe('push');
      await teardown(r);
    });
  });
});
