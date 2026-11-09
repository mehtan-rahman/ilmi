// The reader's writes as a statechart, checked against the code by
// exhaustive exploration. One document, one page on it (the reader's
// effect: a `Writer`, the vault's events, a remount when its tab is
// retargeted), over a vault whose every touch of a `.md` file waits to be
// let through, so the explorer chooses how the writer's write, the
// watcher's report of an outside edit, a rename, a delete, and its undo
// interleave. The real `Writer` and the real `Vault` run; the page mirrors
// what `Reader.tsx` does with them, line for line.
//
// Bounds: two keystrokes, one outside edit, one watcher echo of our own
// write, one rename, one delete with its undo; every interleaving of their
// file operations. Each scenario names the events it allows; a state seen
// before (the disk, the page, the writer, the cache, every waiting
// operation by who waits on it) is not explored again. Every step checks
// the invariants and that the writer's change of state is a transition of
// the chart; every state is also run to quiescence and checked there.

import { AsyncLocalStorage } from 'node:async_hooks';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { parse, serialize, type Block } from '../../format/index.js';
import type { Fs, FsEntry, FsStat } from '../../vault/fs.js';
import { Vault, rekey, type Loaded, type Removed } from '../../vault/index.js';
import { WRITE_DELAY, Writer, written } from '../writer.js';

// ── the statechart ────────────────────────────────────────────────

/** The writer of the page as the chart sees it: an edit waiting for its pause, a write under way, both, or neither. */
export type WState = 'idle' | 'dirty' | 'writing' | 'writing+dirty';
export type WEvent = 'type' | 'fire' | 'land' | 'theirs' | 'own' | 'gone' | 'unmount';

export interface Transition { from: WState; event: WEvent; guard?: string; to: WState }

export const WRITES = {
  states: ['idle', 'dirty', 'writing', 'writing+dirty'] as WState[],
  events: ['type', 'fire', 'land', 'theirs', 'own', 'gone', 'unmount'] as WEvent[],
  transitions: [
    { from: 'idle', event: 'type', to: 'dirty' },
    { from: 'dirty', event: 'type', to: 'dirty' },
    { from: 'writing', event: 'type', to: 'writing+dirty' },
    { from: 'writing+dirty', event: 'type', to: 'writing+dirty' },
    { from: 'dirty', event: 'fire', to: 'writing' },
    { from: 'writing+dirty', event: 'fire', to: 'writing' },
    { from: 'writing', event: 'land', guard: 'last write under way', to: 'idle' },
    { from: 'writing', event: 'land', guard: 'another under way', to: 'writing' },
    { from: 'writing+dirty', event: 'land', guard: 'last write under way', to: 'dirty' },
    { from: 'writing+dirty', event: 'land', guard: 'another under way', to: 'writing+dirty' },
    // someone else's change: what was not written yet is dropped, and the person is told
    { from: 'idle', event: 'theirs', to: 'idle' },
    { from: 'dirty', event: 'theirs', guard: 'told', to: 'idle' },
    { from: 'writing', event: 'theirs', to: 'writing' },
    { from: 'writing+dirty', event: 'theirs', guard: 'told', to: 'writing' },
    // our own write read back changes nothing the writer holds
    ...(['idle', 'dirty', 'writing', 'writing+dirty'] as WState[]).map((s) => ({ from: s, event: 'own' as WEvent, to: s })),
    // the file went: nothing more is written for this page
    { from: 'idle', event: 'gone', to: 'idle' },
    { from: 'dirty', event: 'gone', to: 'idle' },
    { from: 'writing', event: 'gone', to: 'writing' },
    { from: 'writing+dirty', event: 'gone', to: 'writing' },
    // the page goes (its tab retargeted after a rename): what was typed is written first
    { from: 'idle', event: 'unmount', to: 'idle' },
    { from: 'dirty', event: 'unmount', to: 'writing' },
    { from: 'writing', event: 'unmount', to: 'writing' },
    { from: 'writing+dirty', event: 'unmount', to: 'writing' },
  ] as Transition[],
  invariants: [
    'one document: no `.md` on disk but at the path the document has now, none while it is deleted',
    'no write lands on a path that is not the document\'s at that moment',
    'at rest the file holds what the page shows',
    'at rest the last keystroke is on disk, unless an outside edit came after it',
    'an outside edit after the last keystroke is what the file holds at rest',
    'an edit dropped for an outside one is told',
    'undo of a delete puts back what the file held when it was deleted',
  ],
};

const allowed = (from: WState, event: WEvent, to: WState) => WRITES.transitions.some((t) => t.from === from && t.event === event && t.to === to);

// ── a vault whose `.md` operations wait to be let through ─────────

const ROOT = '/v';
const who = new AsyncLocalStorage<string>();

interface Waiting { op: string; by: string; go: () => void; check: boolean }

class GateFs implements Fs {
  readonly atomic = true;
  files = new Map<string, { bytes: Uint8Array; mtime: number }>();
  dirs = new Set<string>([ROOT]);
  clock = 1;
  gating = false;
  waiting: Waiting[] = [];
  /** Every `.md` write, as it lands: `path`. */
  writes: string[] = [];
  onWrite: (abs: string) => void = () => {};

  /** The path each party last statted, and the one it last wrote. */
  private checked = new Map<string, string>();
  private wrote = new Map<string, string>();

  /**
   * True while a party has checked a file's stamp and waits to write it. The vault checks the stamp,
   * writes, and stats for the new stamp; an outside change landing between those is a race no `Fs` call
   * can close (it would take a compare-and-swap write that returns its stamp), so the outside edit is
   * not offered then, and the stamp after a write is read with it. The vault's own parties (a rename, a
   * delete, the watcher's work) may still come between the check and the write: that is explored.
   */
  checking(): boolean {
    return this.waiting.some((w) => w.check);
  }

  private async gate(op: string, path: string): Promise<void> {
    if (!this.gating || !path.endsWith('.md')) return;
    const by = who.getStore() ?? '?';
    if (op === 'stat' && this.wrote.get(by) === path) { this.wrote.delete(by); return; }
    const check = op === 'write' && this.checked.get(by) === path;
    if (op === 'stat') this.checked.set(by, path);
    else this.checked.delete(by);
    if (op === 'write') this.wrote.set(by, path);
    await new Promise<void>((go) => this.waiting.push({ op: `${op} ${path.slice(ROOT.length + 1)}`, by, go, check }));
  }
  put(abs: string, text: string): void {
    this.files.set(abs, { bytes: new TextEncoder().encode(text), mtime: this.clock++ });
  }
  text(abs: string): string | null {
    const f = this.files.get(abs);
    return f ? new TextDecoder().decode(f.bytes) : null;
  }
  async readDir(path: string): Promise<FsEntry[]> {
    const out = new Map<string, FsEntry>();
    const pre = `${path}/`;
    for (const k of [...this.files.keys(), ...this.dirs]) {
      if (!k.startsWith(pre)) continue;
      const name = k.slice(pre.length).split('/')[0]!;
      const dir = this.dirs.has(pre + name);
      out.set(name, { name, isDir: dir, isFile: !dir });
    }
    return [...out.values()];
  }
  async stat(path: string): Promise<FsStat | null> {
    await this.gate('stat', path);
    const f = this.files.get(path);
    if (f) return { mtimeMs: f.mtime, size: f.bytes.length, isDir: false };
    return this.dirs.has(path) ? { mtimeMs: 0, size: 0, isDir: true } : null;
  }
  async readText(path: string): Promise<string> {
    await this.gate('read', path);
    const t = this.text(path);
    if (t === null) throw new Error(`${path}: no such file`);
    return t;
  }
  async writeText(path: string, text: string): Promise<void> {
    await this.gate('write', path);
    this.put(path, text);
    if (path.endsWith('.md')) { this.writes.push(path); this.onWrite(path); }
  }
  async readBytes(path: string): Promise<Uint8Array> {
    await this.gate('read', path);
    const f = this.files.get(path);
    if (!f) throw new Error(`${path}: no such file`);
    return f.bytes;
  }
  async writeBytes(path: string, bytes: Uint8Array): Promise<void> {
    await this.gate('write', path);
    this.files.set(path, { bytes, mtime: this.clock++ });
    if (path.endsWith('.md')) { this.writes.push(path); this.onWrite(path); }
  }
  async rename(from: string, to: string): Promise<void> {
    await this.gate('rename', from);
    const f = this.files.get(from);
    if (f) { this.files.delete(from); this.files.set(to, f); return; }
    if (!this.dirs.has(from)) throw new Error(`${from}: no such file`);
    for (const k of [...this.files.keys()]) if (k.startsWith(`${from}/`)) { this.files.set(to + k.slice(from.length), this.files.get(k)!); this.files.delete(k); }
    for (const k of [...this.dirs]) if (k === from || k.startsWith(`${from}/`)) { this.dirs.delete(k); this.dirs.add(to + k.slice(from.length)); }
  }
  async mkdir(path: string): Promise<void> {
    let p = path;
    while (p.length > ROOT.length) { this.dirs.add(p); p = p.slice(0, p.lastIndexOf('/')); }
  }
  async remove(path: string): Promise<void> {
    await this.gate('remove', path);
    this.files.delete(path);
    for (const k of [...this.files.keys()]) if (k.startsWith(`${path}/`)) this.files.delete(k);
    for (const k of [...this.dirs]) if (k === path || k.startsWith(`${path}/`)) this.dirs.delete(k);
  }
  async watch(): Promise<() => void> {
    return () => {};
  }
}

// ── the page: what `Reader.tsx`'s effect does with the writer ─────

const body = (text: string) => ({ blocks: [{ kind: 'paragraph', text }] as Block[] });
const shown = (blocks: Block[]) => blocks.map((b) => ('text' in b ? b.text : '')).join('|');

class Page {
  /** What the editor shows; null before the file is read, and after it went. */
  shows: string | null = null;
  gone = false;
  live = true;
  inflight = 0;
  readonly writer: Writer;
  private readonly off: () => void;

  constructor(private readonly w: World, readonly path: string) {
    const writer = new Writer(w.vault, path, (n) => w.told.push(n));
    this.writer = writer;
    // the chart's view of every write: counted from the call to its end
    const update = writer.update.bind(writer);
    writer.update = (mutate) => {
      this.inflight++;
      const p = update(mutate);
      const done = () => this.step('land', () => { this.inflight--; });
      p.then(done, done);
      return p;
    };
    w.vault.read(path).then((l) => { if (this.live) this.build(l); }, () => { if (this.live) this.gone = true; });
    this.off = w.vault.subscribe((ev) => {
      if (!this.live) return;
      if (ev.kind === 'doc' && ev.path === path) this.onDoc(ev.loaded);
      else if (ev.kind === 'moved') writer.follow(ev.from, ev.to);
      else if (ev.kind === 'gone' && ev.path === path) {
        this.step('gone', () => writer.cancel());
        this.shows = null;
        this.gone = true;
      }
    });
  }

  state(): WState {
    const dirty = (this.writer as unknown as { pending: unknown }).pending !== null;
    if (this.inflight > 0) return dirty ? 'writing+dirty' : 'writing';
    return dirty ? 'dirty' : 'idle';
  }

  /** Run `fn` as the chart's `event`, and check the writer moved along one of its transitions. */
  step(event: WEvent, fn: () => void): void {
    const from = this.state();
    const told = this.w.told.length;
    fn();
    const to = this.state();
    if (!allowed(from, event, to)) this.w.fail(`writer ${from} --${event}--> ${to} is not in the chart`);
    if (event === 'theirs' && (from === 'dirty' || from === 'writing+dirty') && this.w.told.length === told) this.w.fail(`an edit was dropped for an outside one (${from}), and nobody was told`);
  }

  build(l: Loaded): void {
    this.shows = shown(l.doc.blocks);
    this.writer.saw(l);
  }

  onDoc(l: Loaded): void {
    if (this.shows === null) { this.build(l); return; }
    let rebuild = false;
    const theirs = !(this.writer as unknown as { own: Map<string, number> }).own.has(l.text);
    this.step(theirs ? 'theirs' : 'own', () => { rebuild = this.writer.heard(l, () => body(this.shows!).blocks); });
    if (rebuild) this.build(l);
  }

  type(text: string): void {
    this.step('type', () => {
      this.shows = text;
      this.writer.version++;
      this.writer.schedule(() => body(this.shows!).blocks);
    });
  }

  unmount(): void {
    this.live = false;
    this.off();
    this.step('unmount', () => this.writer.flush());
    this.writer.close();
  }
}

// ── the world one sequence of events runs in ──────────────────────

type Ev = 'type' | 'fire' | 'ext' | 'echo' | 'rename' | 'remount' | 'delete' | 'undo' | `step ${string}`;

interface Scenario { name: string; allow: Partial<Record<'type' | 'ext' | 'echo' | 'rename' | 'delete' | 'undo', number>> }

class World {
  fs = new GateFs();
  vault!: Vault;
  page!: Page;
  /** Where the document is now, as the vault last said; null while deleted. */
  path: string | null = 'a.md';
  /** The tab's path: retargeted on `moved` at once, as the store does; the page follows on `remount`. */
  tab: string | null = 'a.md';
  used: Record<string, number> = {};
  typed = 0;
  /** The last keystroke's text, and whether an outside edit came after it. */
  last = 's0';
  extAfter = false;
  extText: string | null = null;
  /** An edit was waiting (unwritten) when an outside edit was heard. */
  told: string[] = [];
  removed: Removed | null = null;
  removing = false;
  restored = false;
  deletedText: string | null = null;
  errors: string[] = [];
  history: Ev[] = [];

  fail(msg: string): void {
    this.errors.push(`${msg}\n  after: ${this.history.join(', ')}`);
  }

  async open(): Promise<void> {
    this.fs.put(`${ROOT}/a.md`, serialize(body('s0')));
    this.vault = await Vault.open(this.fs, ROOT);
    this.vault.subscribe((ev) => {
      if (ev.kind === 'moved') {
        this.path = rekey(this.path ?? '', ev.from, ev.to) ?? this.path;
        this.tab = this.tab === null ? null : rekey(this.tab, ev.from, ev.to) ?? this.tab;
      }
      if (ev.kind === 'gone' && ev.path === this.tab) this.tab = null;
    });
    this.fs.onWrite = (abs) => {
      const rel = abs.slice(ROOT.length + 1);
      if (rel !== this.path && !(this.restoring && rel === this.removed?.path)) this.fail(`a write landed on ${rel}, which is not the document's (it is at ${this.path ?? 'nowhere'})`);
    };
    this.page = new Page(this, 'a.md');
    await settle();
    this.fs.gating = true;
  }

  restoring = false;
  toldAtType = 0;
  /** The last keystroke when the delete was asked for, written first; null when an outside edit came after it. */
  lastAtDelete: string | null = null;

  enabled(sc: Scenario): Ev[] {
    const out: Ev[] = [];
    const can = (k: keyof Scenario['allow']) => (this.used[k] ?? 0) < (sc.allow[k] ?? 0);
    const page = this.page;
    if (can('type') && page.live && page.shows !== null && !this.removing) out.push('type');
    if (vi.getTimerCount() > 0) out.push('fire');
    if (can('ext') && this.path !== null && !this.removing && !this.fs.checking()) out.push('ext');
    if (can('echo') && (this.fs.writes.length > 0 || this.used.rename)) out.push('echo');
    if (can('rename') && this.path === 'a.md' && !this.removing) out.push('rename');
    if (this.tab !== null && this.tab !== page.path && page.live) out.push('remount');
    if (can('delete') && this.path !== null && !this.removing && this.used.rename === undefined) out.push('delete');
    if (can('undo') && this.removed && !this.restored) out.push('undo');
    // one waiting operation per party (each goes one operation at a time): which goes next is the choice
    for (const by of new Set(this.fs.waiting.map((w) => w.by))) out.push(`step ${by}`);
    return out;
  }

  async run(ev: Ev): Promise<void> {
    this.history.push(ev);
    const base = ev.startsWith('step') ? 'step' : ev;
    if (base !== 'step' && base !== 'fire' && base !== 'remount') this.used[base] = (this.used[base] ?? 0) + 1;
    switch (base) {
      case 'type': {
        const text = `t${++this.typed}`;
        this.last = text;
        this.extAfter = false;
        this.toldAtType = this.told.length;
        who.run('writer', () => this.page.type(text));
        break;
      }
      case 'fire':
        who.run('writer', () => this.page.step('fire', () => vi.advanceTimersByTime(WRITE_DELAY)));
        break;
      case 'ext': {
        // someone else's editor writes the file, and the watcher reports it
        const text = 'x';
        this.fs.put(`${ROOT}/${this.path}`, serialize(body(text)));
        this.extText = text;
        this.extAfter = true;
        who.run('watcher', () => void this.vault.changed([`${ROOT}/${this.path}`]));
        break;
      }
      case 'echo':
        // the watcher's word of what was written, ours and the rename's: every name the document has had
        who.run('echo', () => void this.vault.changed([`${ROOT}/a.md`, `${ROOT}/b.md`]));
        break;
      case 'rename':
        who.run('rename', () => void this.vault.rename('a.md', 'b').catch((e: unknown) => this.fail(`rename failed: ${String(e)}`)));
        break;
      case 'remount': {
        // the tab now names the new path: React unmounts the page and mounts one on it
        const to = this.tab!;
        who.run('writer', () => this.page.unmount());
        who.run('page', () => { this.page = new Page(this, to); });
        break;
      }
      case 'delete': {
        // a person's delete, as `deleteNode` (remove.ts) makes it: what was typed is written, then the file goes
        this.removing = true;
        this.lastAtDelete = this.extAfter ? null : this.last;
        const at = this.path!;
        who.run('delete', () => {
          void written(at).then(() => this.vault.remove(at)).then((r) => {
            this.removed = r;
            this.path = null;
            const f = r.files.find((x) => x.path === r.path);
            this.deletedText = f ? new TextDecoder().decode(f.bytes) : null;
          }, (e: unknown) => this.fail(`delete failed: ${String(e)}`));
        });
        break;
      }
      case 'undo': {
        const r = this.removed!;
        this.restoring = true;
        who.run('undo', () => {
          void this.vault.restore(r).then(() => { this.restored = true; this.restoring = false; this.path = r.path; }, (e: unknown) => this.fail(`undo failed: ${String(e)}`));
        });
        break;
      }
      case 'step': {
        // a party with nothing waiting (a replayed schedule the code no longer allows) is passed over
        const i = this.fs.waiting.findIndex((w) => w.by === ev.slice(5));
        if (i >= 0) this.fs.waiting.splice(i, 1)[0]!.go();
        break;
      }
    }
    await settle();
    this.check();
  }

  /** The invariants that hold at every step. */
  check(): void {
    const mds = [...this.fs.files.keys()].filter((k) => k.endsWith('.md')).map((k) => k.slice(ROOT.length + 1));
    const allowedPaths = new Set<string>();
    if (this.path !== null) allowedPaths.add(this.path);
    if (this.restoring && this.removed) allowedPaths.add(this.removed.path);
    for (const m of mds) if (!allowedPaths.has(m)) this.fail(`${m} is on disk, but the document is at ${this.path ?? 'nowhere'}`);
  }

  /** Everything let through, every pause run out, the page on its tab: then the invariants of rest. */
  async quiesce(): Promise<void> {
    const drain = async () => {
      for (let guard = 0; guard < 200; guard++) {
        if (this.fs.waiting.length) { this.fs.waiting.shift()!.go(); await settle(); continue; }
        if (vi.getTimerCount() > 0) { vi.advanceTimersByTime(WRITE_DELAY); await settle(); continue; }
        if (this.tab !== null && this.tab !== this.page.path && this.page.live) { await this.run('remount'); continue; }
        break;
      }
    };
    await drain();
    // the watcher's word of every name, as it comes in the end, and what follows from it
    who.run('echo', () => void this.vault.changed([`${ROOT}/a.md`, `${ROOT}/b.md`]));
    await settle();
    await drain();
    this.check();
    const disk = this.path === null ? null : this.fs.text(`${ROOT}/${this.path}`);
    const onDisk = disk === null ? null : shown(parse(disk).doc.blocks);
    if (this.path === null) return;
    const lost = this.told.length > this.toldAtType;
    if (this.restored) {
      if (this.deletedText === null || shown(parse(this.deletedText).doc.blocks) !== onDisk) this.fail(`undo put back ${onDisk}, not what was deleted`);
      if (this.lastAtDelete !== null && !lost && onDisk !== this.lastAtDelete) this.fail(`undo put back ${onDisk}; the last keystroke, ${this.lastAtDelete}, was written before the delete`);
      return;
    }
    const page = this.page;
    if (page.gone || page.shows === null) { this.fail(`at rest the page shows nothing, and the file is at ${this.path}`); return; }
    if (page.shows !== onDisk) this.fail(`at rest the page shows ${page.shows}, the file holds ${onDisk}`);
    if (this.extAfter) {
      if (onDisk !== this.extText) this.fail(`an outside edit came after the last keystroke, and the file holds ${onDisk}, not it`);
    } else if (!lost && onDisk !== this.last) {
      this.fail(`the last keystroke was ${this.last}, the file holds ${onDisk}, and nobody was told`);
    }
  }

  /** Let everything still waiting run out, so this world's writers are let go before the next is made. */
  async dispose(): Promise<void> {
    this.page.live = false;
    this.page.writer.close();
    this.fs.gating = false;
    for (let i = 0; i < 50 && this.fs.waiting.length; i++) { for (const w of this.fs.waiting.splice(0)) w.go(); await settle(); }
    vi.clearAllTimers();
    await settle();
  }

  fingerprint(): string {
    const files = [...this.fs.files].filter(([k]) => k.endsWith('.md')).map(([k, f]) => `${k}=${new TextDecoder().decode(f.bytes)}@${f.mtime}`).sort();
    const cache = [...(this.vault as unknown as { cache: Map<string, Loaded> }).cache].map(([k, l]) => `${k}:${l.text}@${l.stamp?.mtimeMs}`).sort();
    const w = this.page.writer as unknown as { own: Map<string, number>; pending: unknown; version: number };
    return JSON.stringify([
      files, cache, this.fs.waiting.map((x) => `${x.by}:${x.op}`), this.page.path, this.page.shows, this.page.gone, this.page.inflight,
      [...w.own], w.pending !== null, w.version, vi.getTimerCount(), this.path, this.tab, this.used, this.last, this.extAfter,
      this.told.length, !!this.removed, this.removing, this.restored, this.restoring, this.errors.length > 0,
    ]);
  }
}

async function settle(): Promise<void> {
  for (let i = 0; i < 3; i++) await new Promise<void>((r) => setImmediate(r));
}

async function replay(seq: Ev[]): Promise<World> {
  vi.clearAllTimers();
  const w = new World();
  await w.open();
  for (const ev of seq) await w.run(ev);
  return w;
}

/** Every sequence of `sc`'s events, breadth first, a state seen before not explored again. Resolves to the states explored and the failures found. */
async function explore(sc: Scenario, cap = 20000): Promise<{ states: number; failures: string[] }> {
  const seen = new Set<string>();
  const failures = new Set<string>();
  let frontier: Ev[][] = [[]];
  let states = 0;
  while (frontier.length && states < cap) {
    const next: Ev[][] = [];
    for (const seq of frontier) {
      const w = await replay(seq);
      const fp = w.fingerprint();
      if (seen.has(fp)) { await w.dispose(); continue; }
      seen.add(fp);
      states++;
      for (const e of w.errors) failures.add(e);
      const evs = w.enabled(sc);
      for (const ev of evs) next.push([...seq, ev]);
      if (w.errors.length === 0) {
        await w.quiesce();
        for (const e of w.errors) failures.add(`at rest: ${e}`);
      }
      await w.dispose();
    }
    frontier = next;
  }
  // the shortest failure of each kind first
  const byKind = new Map<string, string>();
  for (const f of [...failures].sort((a, b) => a.length - b.length)) {
    const kind = f.split('\n')[0]!.replace(/t\d|[ab]\.md|s0|x/g, '_');
    if (!byKind.has(kind)) byKind.set(kind, f);
  }
  return { states, failures: [...byKind.values()] };
}

const SCENARIOS: Scenario[] = [
  { name: 'keystrokes and their writes', allow: { type: 3, echo: 1 } },
  { name: 'an outside edit racing the writes', allow: { type: 2, ext: 1, echo: 1 } },
  { name: 'a rename under the writes', allow: { type: 2, rename: 1, echo: 1 } },
  { name: 'a rename and an outside edit', allow: { type: 1, ext: 1, rename: 1, echo: 1 } },
  { name: 'a delete and its undo under the writes', allow: { type: 2, delete: 1, undo: 1 } },
  { name: 'a delete, an outside edit, and the undo', allow: { type: 1, ext: 1, delete: 1, undo: 1 } },
];

describe('the reader\'s writes, against their statechart', () => {
  beforeEach(() => {
    vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout'] });
    vi.spyOn(console, 'error').mockImplementation(() => {});
  });
  afterEach(() => {
    vi.useRealTimers();
    vi.restoreAllMocks();
  });

  it('every transition of the chart is between its states', () => {
    for (const t of WRITES.transitions) {
      expect(WRITES.states).toContain(t.from);
      expect(WRITES.states).toContain(t.to);
      expect(WRITES.events).toContain(t.event);
    }
  });

  for (const sc of SCENARIOS) {
    it(`${sc.name}: every interleaving keeps the invariants`, async () => {
      const { states, failures } = await explore(sc);
      if (process.env.MODEL_LOG) process.stdout.write(`${sc.name}: ${states} states\n`);
      expect(states).toBeGreaterThan(10);
      expect(failures).toEqual([]);
    }, 300_000);
  }
});

// ── what the exploration found, each its shortest schedule, replayed ──

describe('the schedules that broke the writes', () => {
  beforeEach(() => {
    vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout'] });
    vi.spyOn(console, 'error').mockImplementation(() => {});
  });
  afterEach(() => {
    vi.useRealTimers();
    vi.restoreAllMocks();
  });

  const md = (w: World) => [...w.fs.files.keys()].filter((k) => k.endsWith('.md')).map((k) => `${k.slice(ROOT.length + 1)}=${shown(parse(w.fs.text(k)!).doc.blocks)}`);
  const atRest = async (seq: Ev[]) => {
    const w = await replay(seq);
    await w.quiesce();
    return w;
  };

  it('a write under way when a rename moves the file does not make the old name again', async () => {
    // was: the write checked a.md, the rename moved it, the write landed on a.md: two files
    const w = await atRest(['type', 'fire', 'rename', 'step rename', 'step writer', 'step rename', 'step writer']);
    expect(w.errors).toEqual([]);
    expect(md(w)).toEqual(['b.md=t1']);
    await w.dispose();
  });

  it('a write asked for while a rename is under way lands on the new name', async () => {
    // was: the write went to a.md after it had gone, and what was typed was lost
    const w = await atRest(['type', 'rename', 'fire']);
    expect(w.errors).toEqual([]);
    expect(md(w)).toEqual(['b.md=t1']);
    await w.dispose();
  });

  it('what is typed before a rename, written as the page goes, lands on the new name', async () => {
    const w = await replay(['type', 'rename', 'step rename', 'step rename']);
    expect(w.tab).toBe('b.md');
    await w.run('remount');
    await w.quiesce();
    expect(w.errors).toEqual([]);
    expect(md(w)).toEqual(['b.md=t1']);
    await w.dispose();
  });

  it('an edit dropped for an outside one is told', async () => {
    const w = await atRest(['type', 'ext']);
    expect(w.errors).toEqual([]);
    expect(w.told).toEqual(['changed elsewhere · the last edit here was not kept']);
    expect(w.page.shows).toBe('x');
    await w.dispose();
  });

  it('a write that finds an outside edit under it gives way to it', async () => {
    // was: the write re-read the file, put its own body over the outside one, and nobody knew
    const w = await atRest(['type', 'fire', 'ext']);
    expect(w.errors).toEqual([]);
    expect(md(w)).toEqual(['a.md=x']);
    expect(w.page.shows).toBe('x');
    expect(w.told.length).toBe(1);
    await w.dispose();
  });

  it('a write waiting behind one that gave way gives way too', async () => {
    const w = await atRest(['type', 'fire', 'type', 'fire', 'ext']);
    expect(w.errors).toEqual([]);
    expect(md(w)).toEqual(['a.md=x']);
    expect(w.page.shows).toBe('x');
    await w.dispose();
  });

  it('undo of a delete puts back what was typed just before it', async () => {
    // was: the delete took the file before the write of the last keystroke, and undo put back the one before
    const w = await atRest(['type', 'delete']);
    expect(md(w)).toEqual([]);
    await w.run('undo');
    await w.quiesce();
    expect(w.errors).toEqual([]);
    expect(md(w)).toEqual(['a.md=t1']);
    await w.dispose();
  });
});
