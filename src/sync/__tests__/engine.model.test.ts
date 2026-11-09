// The engine's sync (milestone 61) under a storage that answers when the
// test says, and fails when it says: every interleaving of two copies'
// writes and syncs, each storage call answered well, failed before it
// did anything, or failed after it did (the answer lost on the way back),
// to a depth, one failure a path. After every answer the storage holds each change a copy
// counts as sent exactly once, and each copy's files are numbered without
// a gap; at the end of each path both copies sync until quiet and hold the
// same collection, every file either wrote in it.
//
// The chart is the engine's own, per copy: `idle`, and `syncing` through
// its steps (the format read, the listings, the files read, its own file
// written; then a snapshot, and deletes), each a storage call; a call that fails ends
// the sync (`idle`, the error to the caller) with what it had merged kept
// and the file it was writing planned again under the same name. A write
// is taken in any state. Two copies, so a listing may see the other's file
// before or after it is written.

import { describe, expect, it } from 'vitest';
import { join, storeFs, type StoreFs } from '../../vault/index.js';
import { memStore, type MemStore } from '../../vault/mem-store.js';
import { engine, type Engine, type EngineOptions } from '../engine.js';
import { memStorage, type MemStorage, type Storage } from '../storage.js';

const ROOT = '/collections/test';
const loro = () => import('loro-crdt');
const T0 = Date.parse('2026-11-09T09:00:00Z');

type Dev = 'a' | 'b';
type How = 'ok' | 'fail' | 'lost';
interface Call { verb: string; path: string; run: () => Promise<unknown>; res: (v: unknown) => void; rej: (e: unknown) => void }
interface Copy { dev: Dev; store: MemStore; fs: StoreFs; eng: Engine; at: { ms: number }; calls: Call[]; syncing: boolean; written: string[] }

/** A storage whose calls wait for the test. */
function gated(inner: Storage, calls: Call[]): Storage {
  const wait = (verb: string, path: string, run: () => Promise<unknown>) => new Promise<never>((res, rej) => { calls.push({ verb, path, run, res: res as (v: unknown) => void, rej }); });
  return {
    list: (p) => wait('list', p, () => inner.list(p)),
    read: (p) => wait('read', p, () => inner.read(p)),
    write: (p, b) => wait('write', p, () => inner.write(p, b)),
    remove: (p) => wait('remove', p, () => inner.remove(p)),
  };
}

interface World { storage: MemStorage; copies: Record<Dev, Copy>; gates: Record<Dev, Storage>; fails: number; n: number }

/** The engine's counts for a run: its own, or small ones so that snapshots are written and what they cover is deleted as it goes. */
let OPTS: Partial<EngineOptions> = {};
/** Whether a run deletes what snapshots cover: a copy's files are then numbered from wherever the deletes reached. */
const tidies = (): boolean => OPTS.snapKeepMs !== undefined;
/** Paths whose end held a snapshot, and one with a change file deleted: so a run says it went where it means to. */
const reached = { snapshot: 0, deleted: 0 };

async function copyOf(dev: Dev, n: number): Promise<Copy> {
  const store = memStore();
  const fs = storeFs(store, ROOT);
  const at = { ms: T0 };
  const eng = engine(fs, { loro, now: () => at.ms, newDevice: () => n.toString(16).padStart(16, '0'), ...OPTS });
  return { dev, store, fs, eng, at, calls: [], syncing: false, written: [] };
}

async function world(): Promise<World> {
  const storage = memStorage();
  const a = await copyOf('a', 1);
  await a.fs.writeText(join(ROOT, 'shared.md'), 'first\n');
  expect(await a.eng.connect(storage)).toBe('made');
  await a.eng.sync(storage);
  const b = await copyOf('b', 2);
  expect(await b.eng.connect(storage)).toBe('joined');
  await b.eng.sync(storage);
  return { storage, copies: { a, b }, gates: { a: gated(storage, a.calls), b: gated(storage, b.calls) }, fails: 0, n: 0 };
}

/** `reach`: a copy's calls answered well up to its next write, the reads and listings in one step (they change nothing in the storage). */
type Ev = { e: 'write' | 'edit' | 'sync' | 'reach'; dev: Dev } | { e: 'answer'; dev: Dev; how: How };
const flush = async (): Promise<void> => { for (let i = 0; i < 12; i++) await new Promise<void>((r) => setImmediate(r)); };

async function apply(w: World, ev: Ev): Promise<void> {
  const c = w.copies[ev.dev];
  c.at.ms += 1000;
  if (ev.e === 'write') {
    const name = `${ev.dev}${++w.n}.md`;
    c.written.push(name);
    await c.fs.writeText(join(ROOT, name), `${name}\n`);
  } else if (ev.e === 'edit') {
    await c.fs.writeText(join(ROOT, 'shared.md'), `${ev.dev} ${++w.n}\n`);
  } else if (ev.e === 'sync') {
    c.syncing = true;
    void c.eng.sync(w.gates[ev.dev], { files: false }).catch(() => {}).finally(() => { c.syncing = false; });
  } else if (ev.e === 'reach') {
    while (c.calls.length && c.calls[0]!.verb !== 'write') await apply(w, { e: 'answer', dev: ev.dev, how: 'ok' });
  } else if (ev.e === 'answer') {
    const call = c.calls.shift()!;
    if (ev.how === 'fail') { w.fails += 1; call.rej(new Error('offline')); }
    else {
      try {
        const v = await call.run();
        if (ev.how === 'lost') { w.fails += 1; call.rej(new Error('timed out')); } else call.res(v);
      } catch (e) { call.rej(e); }
    }
  }
  await flush();
}

const MAX_FAILS = 1;
function enabled(w: World): Ev[] {
  const out: Ev[] = [];
  for (const dev of ['a', 'b'] as Dev[]) {
    const c = w.copies[dev];
    out.push({ e: 'write', dev });
    if (!c.syncing) out.push({ e: 'sync', dev });
    if (c.calls.length) {
      out.push({ e: 'answer', dev, how: 'ok' });
      if (c.calls[0]!.verb !== 'write') out.push({ e: 'reach', dev });
      if (w.fails < MAX_FAILS) {
        out.push({ e: 'answer', dev, how: 'fail' });
        if (c.calls[0]!.verb === 'write') out.push({ e: 'answer', dev, how: 'lost' });
      }
    }
  }
  // one edit of the shared file a side: two writes to one register, the later wins on both
  if (w.n < 2) out.push({ e: 'edit', dev: 'a' }, { e: 'edit', dev: 'b' });
  return out;
}

const dec = new TextDecoder();
/** Each copy's own files in the storage: numbered from 1 without a gap, and each change a copy counts as sent in exactly one of them. */
function check(w: World, at: string): void {
  for (const c of Object.values(w.copies)) {
    const device = c.eng.device()!;
    const prefix = `devices/${device}/`;
    const nums = [...w.storage.files.keys()].filter((p) => p.startsWith(prefix)).map((p) => Number(p.slice(prefix.length))).sort((x, y) => x - y);
    const from = tidies() && nums.length ? nums[0]! : 1;
    expect(nums, `${at}: ${c.dev}'s files`).toEqual(nums.map((_, i) => i + from));
    const seen = new Map<number, number>();
    for (const n of nums) {
      const [, ...lines] = dec.decode(w.storage.files.get(`${prefix}${n}`)!).split('\n').filter((l) => l.trim());
      for (const l of lines) { const s = (JSON.parse(l) as { s: number }).s; seen.set(s, (seen.get(s) ?? 0) + 1); }
    }
    const sent = Number(c.store.tables.meta.get('sent') ?? 0);
    if (!tidies()) for (let s = 1; s <= sent; s++) expect(seen.get(s) ?? 0, `${at}: ${c.dev}'s change ${s}, sent, in the storage`).toBe(1);
    for (const [s, k] of seen) expect(k, `${at}: ${c.dev}'s change ${s} in the storage`).toBe(1);
    // what is not sent is still in the outbox
    for (const s of c.store.tables.outbox.keys()) expect(s > sent, `${at}: ${c.dev}'s outbox holds only what is not sent`).toBe(true);
  }
}

async function contents(c: Copy): Promise<Record<string, string>> {
  const out: Record<string, string> = {};
  for (const e of await c.fs.readDir(ROOT)) if (!e.isDir && e.name.endsWith('.md')) out[e.name] = await c.fs.readText(join(ROOT, e.name));
  return out;
}

/** Every call answered well and every sync done, then each copy synced until neither reads or writes: the two the same, with every file written. */
async function drain(w: World, at: string): Promise<void> {
  for (let i = 0; i < 100 && (w.copies.a.calls.length || w.copies.b.calls.length || w.copies.a.syncing || w.copies.b.syncing); i++) {
    for (const dev of ['a', 'b'] as Dev[]) while (w.copies[dev].calls.length) await apply(w, { e: 'answer', dev, how: 'ok' });
    await flush();
  }
  for (let round = 0; round < 6; round++) {
    let moved = 0;
    for (const c of Object.values(w.copies)) { const r = await c.eng.sync(w.storage, { files: false }); moved += r.read + r.wrote; }
    if (!moved) break;
  }
  check(w, `${at} · drained`);
  const paths = [...w.storage.files.keys()];
  if (paths.some((p) => p.endsWith('/head'))) reached.snapshot += 1;
  if (Object.values(w.copies).some((c) => !w.storage.files.has(`devices/${c.eng.device()}/1`))) reached.deleted += 1;
  const a = await contents(w.copies.a);
  const b = await contents(w.copies.b);
  expect(b, `${at} · drained: the two copies`).toEqual(a);
  for (const name of [...w.copies.a.written, ...w.copies.b.written]) expect(a[name], `${at} · drained: ${name}`).toBe(`${name}\n`);
  for (const c of Object.values(w.copies)) expect(await c.eng.waiting(), `${at} · drained: ${c.dev} waiting`).toBe(0);
}

const name = (ev: Ev): string => `${ev.e}(${ev.dev}${'how' in ev ? ` ${ev.how}` : ''})`;

function key(w: World): string {
  const files = [...w.storage.files].map(([p, b]) => `${p}:${b.length}`).sort().join(',');
  const side = (c: Copy) => [[...c.store.tables.meta].filter(([k]) => k !== 'hlc').sort().join(','), [...c.store.tables.outbox.keys()].join(','), c.syncing, c.calls.map((x) => `${x.verb} ${x.path}`).join(','), c.written.length];
  return JSON.stringify([files, side(w.copies.a), side(w.copies.b), w.fails, w.n]);
}

async function replay(path: Ev[]): Promise<World> {
  const w = await world();
  const names: string[] = [];
  for (const ev of path) {
    await apply(w, ev);
    names.push(name(ev));
    check(w, names.join(' → '));
  }
  return w;
}

async function explore(depth: number): Promise<number> {
  const seen = new Set<string>();
  let frontier: Ev[][] = [[]];
  for (let d = 0; d <= depth; d++) {
    const next: Ev[][] = [];
    for (const path of frontier) {
      const w = await replay(path);
      const k = key(w);
      if (seen.has(k)) continue;
      seen.add(k);
      if (d === depth) await drain(w, path.map(name).join(' → '));
      else for (const ev of enabled(w)) next.push([...path, ev]);
    }
    frontier = next;
  }
  return seen.size;
}

describe('the engine\'s sync, every interleaving', () => {
  // Five events hold a write, a sync, its reads done (`reach`), and its file's write failed or its answer lost, then
  // the next sync; or a write on each side and both syncs started with their calls interleaved one by one (a sync is
  // four calls: the format, two listings, its file). The drain answers the rest. Six events (ILMI_MODEL_DEPTH=6)
  // passed in two minutes without `reach`; a storage write that swallows its error is caught at five.
  it('of two copies\' writes and syncs, a storage call failed or its answer lost, to five events', async () => {
    const states = await explore(Number(process.env.ILMI_MODEL_DEPTH ?? 5));
    if (process.env.ILMI_MODEL_DEPTH) console.log(`engine: ${states} states`);
    expect(states).toBeGreaterThan(100);
  }, 600_000);

  // The same with a snapshot after two change files, read in place of one, and what it covers deleted three seconds
  // on (each event is a second): a listing may name a file that is gone when it is read, a snapshot be half written.
  // Four events (five pass, in half a minute): a run ends with a snapshot written, and with change files deleted.
  it('the same with snapshots written and what they cover deleted as it goes, to four events', async () => {
    OPTS = { snapAfter: 2, snapWorth: 1, snapKeepMs: 3_000 };
    try {
      const states = await explore(Number(process.env.ILMI_MODEL_DEPTH ?? 4));
      if (process.env.ILMI_MODEL_DEPTH) console.log(`engine with snapshots: ${states} states, ${reached.snapshot} ending with a snapshot, ${reached.deleted} with files deleted`);
      expect(states).toBeGreaterThan(100);
      expect(reached.snapshot).toBeGreaterThan(0);
      expect(reached.deleted).toBeGreaterThan(0);
    } finally {
      OPTS = {};
    }
  }, 600_000);

  it('a file written whose answer is lost is written again under its name, with the same changes, and nothing more', async () => {
    const w = await replay([{ e: 'write', dev: 'a' }, { e: 'sync', dev: 'a' }]);
    while (w.copies.a.calls[0]?.verb !== 'write') await apply(w, { e: 'answer', dev: 'a', how: 'ok' });
    await apply(w, { e: 'write', dev: 'a' });
    await apply(w, { e: 'answer', dev: 'a', how: 'lost' });
    check(w, 'lost');
    await drain(w, 'lost');
  });
});
