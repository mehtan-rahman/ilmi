// The engine (milestone 61): a collection's changes merged by CRDT. Every
// write the store makes is told here first (`Recorder`, `src/vault/store.ts`)
// and recorded as a change in the same transaction; a sync reads the other
// devices' changes from a storage (`storage.ts`), merges them, and writes
// this device's own. The same changes in any order give the same
// collection, with no server and no common ancestor.
//
// Each kind of data merges by the kind that fits it:
// - A document's text (its body): a text CRDT, the library's own updates
//   (Loro; the choice and its numbers are in PLAN.md under 61). Two edits
//   to one paragraph merge by character, and the paragraph is listed
//   (`Kept`) for the notice.
// - A field (a row's name, its parent, its place, its kind, the file it
//   is; each line of a document's front matter; a pair said not the same):
//   a register, the later write by the clock (`clock.ts`).
// - A schedule: a register too, but the later review instant wins (53's
//   rule): its stamp leads with the schedule's `last`, or with the time it
//   was written when it has none, then the clock.
// - The review log: a set that only grows.
// - A row deleted on one device and changed on another keeps the change:
//   a delete names the changes it had seen, and only those.
// - PDFs and images are never merged: a row names one by its hash, and
//   the bytes go to the storage whole before the change that names them.
//
// What is kept (the store's `regs`, `crdt`, `outbox`, `sync_meta`): a
// register per field with the stamp that won it and its value; per
// document the library's state; the changes not yet written out; the
// device, its clock, and how far each other device has been read. The tree
// the app sees is what the registers and the texts make, written through
// the store's door whenever a merge changes them.
//
// A change is one JSON object: `g` a register (`k` its key, `v` its value,
// `c` its stamp), `x` a text update (`u`, with `vv` the version it was
// made at), `d` a delete (`e`: the changes to the row it had seen, by
// device), `r` a line of the review log. A write's changes travel
// together (`{ s, ops }`, `s` this device's count of them), and a file in
// the storage is a header line and then one such line a write.

import { parse, parseReviews, serialize } from '../format/index.js';
import { compose, type StateRow } from '../vault/lift.js';
import { newId, reviewRow, type Content, type DocContent, type Lift, type Place, type Recorder, type Reg, type ReviewRow, type Row, type RowKind, type StoreFs, type StoreOp, type ViewWrite } from '../vault/store.js';
import { clock, msOf, msPart, type Clock } from './clock.js';
import { blocks, diff3, type Kept } from './merge.js';
import type { Storage } from './storage.js';

/** The text library, as the engine uses it. */
export type Loro = Pick<typeof import('loro-crdt'), 'LoroDoc' | 'VersionVector'>;

type Op =
  | { t: 'g'; k: string; v: string | null; c: string }
  | { t: 'x'; id: string; u: string; vv: string }
  | { t: 'd'; id: string; e: Record<string, number> }
  | { t: 'r'; f: string; l: string };

interface Batch { s: number; ops: Op[] }
interface FileIn { device: string; n: number; seen: Record<string, number>; batches: Batch[] }
interface Plan { n: number; to: number; seen: Record<string, number> }

export interface Synced {
  /** Files of other devices merged, and files of this one written. */
  read: number;
  wrote: number;
  /** Paragraphs both this device and another had changed: merged by character, and worth a look. */
  kept: Kept[];
  /** Documents a merge changed, by path. */
  changed: string[];
}

export interface Engine {
  /** Whether the collection syncs: it has a device of its own. */
  on(): Promise<boolean>;
  /** This collection's device, once it has one. */
  device(): string | null;
  /**
   * The collection and a storage meet. An empty storage takes this
   * collection (`made`: everything it holds becomes its first changes); an
   * empty collection takes the storage's (`joined`: the next sync brings
   * it all); a collection already of this storage is `connected`. A
   * storage that holds another collection is refused.
   */
  connect(storage: Storage): Promise<'made' | 'joined' | 'connected'>;
  /** Read what the other devices wrote, merge it, write this device's own. */
  sync(storage: Storage): Promise<Synced>;
  /** How many writes made here are not in the storage yet. */
  waiting(): Promise<number>;
}

export interface EngineOptions {
  /** The text library, loaded when a collection that syncs first needs it. */
  loro: () => Promise<Loro>;
  now?: () => number;
  /** A new device's id: sixteen hex digits. */
  newDevice?: () => string;
}

/** The app's view state: this device's own, never a change. */
const STATE_FILE = '.ilmi/state.json';
const skip = (rel: string): boolean => rel === STATE_FILE || rel.endsWith('.ilmi-tmp');

/** About how much of the outbox goes into one file of the storage. */
const FILE_BYTES = 1_000_000;
const TEXT = 't';
const FORMAT = 'format';
const DEVICE_LEN = 16;
/** A clock's stamp is the last characters of a schedule's, which leads with its review instant. */
const CLOCK_LEN = 9 + 3 + DEVICE_LEN;

const utf8 = new TextEncoder();
const fromUtf8 = new TextDecoder();

function b64(bytes: Uint8Array): string {
  let s = '';
  for (let i = 0; i < bytes.length; i += 0x8000) s += String.fromCharCode(...bytes.subarray(i, i + 0x8000));
  return btoa(s);
}

function unb64(s: string): Uint8Array {
  const bin = atob(s);
  const out = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
  return out;
}

function randomDevice(): string {
  const b = new Uint8Array(DEVICE_LEN / 2);
  globalThis.crypto.getRandomValues(b);
  // the text library's peer is this number: its top bit left clear, so it reads the same signed or not
  b[0] = b[0]! & 0x7f;
  return [...b].map((x) => x.toString(16).padStart(2, '0')).join('');
}

/** The row a register belongs to; null for one that is the collection's (`~…`). */
const rowOf = (key: string): string | null => (key.startsWith('~') ? null : key.slice(0, key.indexOf('|')));

/** A document's body: its text after the front matter, without the blank line that parts them. */
export const bodyOf = (front: string, text: string): string => (front !== '' && text.startsWith('\n') ? text.slice(1) : text);
const bareOf = (front: string, body: string): string => front + (front !== '' && body !== '' ? '\n' : '') + body;

/** The lines of a front matter block, each with what it is found by: its key, or itself when it has none; a repeat `…\n2`. */
export function frontLines(front: string): { lid: string; line: string }[] {
  if (!front) return [];
  const lines = front.replace(/\n$/, '').split('\n').slice(1, -1);
  const seen = new Map<string, number>();
  return lines.map((line) => {
    const m = /^([A-Za-z0-9_-]+):/.exec(line);
    const base = m ? m[1]! : `#${line}`;
    const k = (seen.get(base) ?? 0) + 1;
    seen.set(base, k);
    return { lid: k === 1 ? base : `${base}\n${k}`, line };
  });
}

/** A schedule's stamp: its review instant (`last`), else when it was written, never earlier than the one it replaces; then the clock. */
function schedStamp(attrs: string | null, c: string, had?: string): string {
  let at = msOf(c);
  if (attrs !== null) {
    try {
      const last = (JSON.parse(attrs) as { last?: unknown }).last;
      if (typeof last === 'string') {
        const t = Date.parse(last.length === 10 ? `${last}T00:00:00Z` : last);
        if (Number.isFinite(t)) at = t;
      }
    } catch { /* attributes that do not read are stamped by when they were written */ }
  }
  if (had) at = Math.max(at, msOf(had));
  return msPart(at) + c;
}

const HEADING = /^#{1,6}\s+(.*?)\s*(?:\s#+)?\s*$/;

/** The headings over the blocks both `ours` and `theirs` changed from `base` (null for one with no heading above it). */
export function bothChanged(base: string, ours: string, theirs: string): (string | null)[] {
  const key = (b: string[]): string => b.join('\n');
  const ko = blocks(ours).map(key);
  const out: (string | null)[] = [];
  const lines: string[] = [];
  const same = (a: string[], b: string[]): boolean => a.length === b.length && a.every((x, i) => x === b[i]);
  for (const h of diff3(blocks(base).map(key), ko, blocks(theirs).map(key))) {
    if ('stable' in h) { lines.push(...h.stable.split('\n')); continue; }
    if (!same(h.ours, h.base) && !same(h.theirs, h.base) && !same(h.ours, h.theirs)) {
      let heading: string | null = null;
      for (let i = lines.length - 1; i >= 0 && heading === null; i--) {
        const m = HEADING.exec(lines[i]!);
        if (m && m[1]) heading = m[1];
      }
      out.push(heading);
    }
    for (const b of h.ours) lines.push(...b.split('\n'));
  }
  return out;
}

const CARD_ID = 'abcdefghijklmnopqrstuvwxyz0123456789';

/** The row's registers, by their key under it (`n`, `m|title`, `s|card|…`). */
type RowRegs = Map<string, Reg>;

interface View {
  id: string;
  /** It has a name, a kind and a place: something to show. */
  complete: boolean;
  /** Deleted, and every change to it had been seen by a delete. */
  dead: boolean;
  at: Place;
  regs: RowRegs;
}

function viewOf(id: string, regs: RowRegs): View {
  const v = (k: string): string | null => regs.get(k)?.value ?? null;
  const name = v('n');
  const kind = v('k');
  const p = regs.get('p');
  const e = JSON.parse(v('e') ?? '{}') as Record<string, number>;
  const d = regs.has('d') ? (JSON.parse(v('d') ?? '{}') as Record<string, number>) : null;
  const o = v('o');
  return {
    id,
    complete: name !== null && kind !== null && !!p && p.value !== null,
    dead: d !== null && Object.entries(e).every(([dev, n]) => (d[dev] ?? 0) >= n),
    at: { id, parent: p?.value ? p.value : null, name: name ?? '', place: o === null ? null : Number(o), kind: (kind ?? 'file') as RowKind },
    regs,
  };
}

/** A document's front matter block as its registers have it: the lines in their places. */
function frontOf(regs: RowRegs): string {
  const lines: { at: number; lid: string; line: string }[] = [];
  for (const [k, r] of regs) {
    if (!k.startsWith('m|') || k === 'm|' || r.value === null) continue;
    try {
      const [at, line] = JSON.parse(r.value) as [number, string];
      lines.push({ at, lid: k.slice(2), line });
    } catch { /* a register that does not read is no line */ }
  }
  if (!lines.length && (regs.get('m|')?.value ?? null) === null) return '';
  lines.sort((a, b) => a.at - b.at || (a.lid < b.lid ? -1 : a.lid > b.lid ? 1 : 0));
  return `---\n${lines.map((l) => `${l.line}\n`).join('')}---\n`;
}

/** A document's schedules as its registers have them. */
function schedulesOf(regs: RowRegs): StateRow[] {
  const out: StateRow[] = [];
  for (const [k, r] of regs) {
    if (!k.startsWith('s|') || r.value === null) continue;
    const rest = k.slice(2);
    const kind = rest.slice(0, rest.indexOf('|'));
    const tail = rest.slice(kind.length + 1);
    const cut = tail.lastIndexOf('|');
    try {
      out.push({ kind: kind as StateRow['kind'], item: tail.slice(0, cut), key: tail.slice(cut + 1), attrs: JSON.parse(r.value) as StateRow['attrs'] });
    } catch { /* as above */ }
  }
  return out;
}

/** The engine of the collection behind `fs`; from here on it is told of every write. */
export function engine(fs: StoreFs, opts: EngineOptions): Engine {
  const store = fs.store;
  const door = fs.door;
  const now = opts.now ?? (() => Date.now());

  let device: string | null = null;
  let collection: string | null = null;
  /** Everything the collection held when it met its storage is in the outbox. */
  let booted = false;
  let clk: Clock = clock('', now);
  /** This device's count of the writes it recorded, and how many of them are in the storage, in how many files. */
  let seq = 0;
  let sent = 0;
  let files = 0;
  let plan: Plan | null = null;
  /** The last file merged of each other device. */
  const cur = new Map<string, number>();

  const ready: Promise<void> = (async () => {
    const meta = new Map(await store.meta());
    device = meta.get('device') ?? null;
    collection = meta.get('collection') ?? null;
    booted = meta.get('booted') === '1';
    seq = Number(meta.get('seq') ?? 0);
    sent = Number(meta.get('sent') ?? 0);
    files = Number(meta.get('files') ?? 0);
    const p = meta.get('plan');
    plan = p ? (JSON.parse(p) as Plan) : null;
    for (const [k, v] of meta) if (k.startsWith('cur|')) cur.set(k.slice(4), Number(v));
    if (device) clk = clock(device, now, meta.get('hlc') ?? '');
  })();

  let lib: Promise<Loro> | null = null;
  const loro = (): Promise<Loro> => (lib ??= opts.loro());
  const peer = (): `${number}` => BigInt(`0x${device!}`).toString() as `${number}`;

  // ── recording ──────────────────────────────────────────────────

  interface Pending {
    ops: Op[];
    regs: Reg[];
    store: StoreOp[];
    /** Rows these changes are changes to. */
    rows: Set<string>;
    /** A schedule here is of a card with no id: it is not a change until the card has one. */
    unkeyed: boolean;
  }
  const begin = (): Pending => ({ ops: [], regs: [], store: [], rows: new Set(), unkeyed: false });

  /** What goes into the transaction for `p`: its registers, the texts, and the changes as one entry of the outbox. */
  const finish = async (p: Pending): Promise<StoreOp[]> => {
    if (!p.ops.length) return [];
    seq += 1;
    if (p.rows.size) {
      const have = new Map((await store.regs([...p.rows].map((id) => `${id}|e`))).map((r) => [r.key, r]));
      for (const id of p.rows) {
        const e = JSON.parse(have.get(`${id}|e`)?.value ?? '{}') as Record<string, number>;
        e[device!] = seq;
        p.regs.push({ key: `${id}|e`, stamp: '', value: JSON.stringify(e) });
      }
    }
    return [
      ...p.store,
      { op: 'regs', set: p.regs },
      { op: 'out', seq, data: JSON.stringify({ s: seq, ops: p.ops } satisfies Batch) },
      { op: 'meta', key: 'hlc', value: clk.last() },
      { op: 'meta', key: 'seq', value: String(seq) },
    ];
  };

  /** `body` as the document's text from here on: the library's update for it and its state after; null when it is the text already. */
  const textChange = async (id: string, body: string): Promise<{ update: string; vv: string; state: string } | null> => {
    const L = await loro();
    const state = await store.crdt(id);
    const doc = new L.LoroDoc();
    try {
      if (state) doc.import(unb64(state));
      doc.setPeerId(peer());
      const text = doc.getText(TEXT);
      if (text.toString() === body) return null;
      const from = doc.oplogVersion();
      if (body.length > 60_000) text.updateByLine(body);
      else text.update(body);
      doc.commit();
      return { update: b64(doc.export({ mode: 'update', from })), vv: b64(doc.oplogVersion().encode()), state: b64(doc.export({ mode: 'snapshot' })) };
    } finally {
      doc.free();
    }
  };

  /** A row written: what changed of it, as registers and changes, into `p`. */
  const recordPut = async (p: Pending, w: { at: Place; before: Row | undefined; content: Content | undefined; lift: Lift | undefined }): Promise<void> => {
    const { at, before, content, lift } = w;
    const id = at.id;
    const c = clk.tick();
    const reg = (k: string, v: string | null, stamp = c): void => {
      p.regs.push({ key: `${id}|${k}`, stamp, value: v });
      p.ops.push({ t: 'g', k: `${id}|${k}`, v, c: stamp });
      p.rows.add(id);
    };
    if (!before || before.name !== at.name) reg('n', at.name);
    if (!before || before.parent !== at.parent) reg('p', at.parent ?? '');
    if (!before || before.kind !== at.kind) reg('k', at.kind);
    if (before ? before.place !== at.place : at.place !== null) reg('o', at.place === null ? null : String(at.place));
    if (!content) return;
    const blob = content.blob ?? null;
    if (blob !== null) {
      if (before?.blob !== blob) reg('b', blob);
      return;
    }
    if (before && before.blob !== null) reg('b', null);
    if (at.kind === 'folder') return;
    if (at.kind === 'file' || !lift) {
      const text = (content.front ?? '') + (content.text ?? '');
      const was = before && before.blob === null && before.kind !== 'folder' ? await store.text(id) : null;
      if (was !== text) reg('t', text);
      return;
    }

    // a document: its front matter line by line, its body through the text library, its schedules each
    const front = content.front ?? '';
    const body = bodyOf(front, content.text ?? '');
    const old: DocContent | null = before && before.kind === 'doc' && before.blob === null ? await store.doc(id) : null;
    if (!old || old.front !== front) {
      const have = new Map<string, { at: number; line: string }>();
      let block = false;
      for (const r of old ? await store.regsUnder([`${id}|m|`]) : []) {
        if (r.value === null) continue;
        const lid = r.key.slice(id.length + 3);
        if (lid === '') { block = true; continue; }
        try { const [n, line] = JSON.parse(r.value) as [number, string]; have.set(lid, { at: n, line }); } catch { /* not a line */ }
      }
      const lines = frontLines(front);
      const here = new Set(lines.map((l) => l.lid));
      let prev = 0;
      lines.forEach((l, i) => {
        const h = have.get(l.lid);
        if (h && h.at > prev) {
          if (h.line !== l.line) reg(`m|${l.lid}`, JSON.stringify([h.at, l.line]));
          prev = h.at;
          return;
        }
        // new, or moved: between the line before it and the next that keeps its place
        let next: number | null = null;
        for (let j = i + 1; j < lines.length && next === null; j++) {
          const n = have.get(lines[j]!.lid);
          if (n && n.at > prev) next = n.at;
        }
        const place = next === null ? Math.floor(prev) + 1 : (prev + next) / 2;
        reg(`m|${l.lid}`, JSON.stringify([place, l.line]));
        prev = place;
      });
      for (const lid of have.keys()) if (!here.has(lid)) reg(`m|${lid}`, null);
      if ((front !== '') !== block) reg('m|', front !== '' ? '1' : null);
    }
    const moved = !old || bodyOf(old.front, old.text) !== body;
    if (moved && (old || body !== '')) {
      const u = await textChange(id, body);
      if (u) {
        p.ops.push({ t: 'x', id, u: u.update, vv: u.vv });
        p.store.push({ op: 'crdt', doc: id, state: u.state });
        p.rows.add(id);
      }
    }
    const keyed = lift.state.filter((s) => !(s.kind === 'card' && s.item.startsWith('#')));
    if (keyed.length < lift.state.length) p.unkeyed = true;
    const to = new Map(keyed.map((s) => [`s|${s.kind}|${s.item}|${s.key}`, s.attrs]));
    const changes: [string, string | null][] = [];
    const had = new Map<string, string>();
    if (moved && old) {
      // the text changed: every schedule the registers hold that the document no longer carries goes
      for (const r of await store.regsUnder([`${id}|s|`])) {
        const k = r.key.slice(id.length + 1);
        had.set(k, r.stamp);
        if (r.value !== null && !to.has(k)) changes.push([k, null]);
        if (r.value !== null && to.get(k) === r.value) to.delete(k);
      }
      for (const [k, a] of to) changes.push([k, a]);
    } else {
      const was = new Map((old?.state ?? []).map((s) => [`s|${s.kind}|${s.item}|${s.key}`, s.attrs]));
      for (const [k, a] of to) if (was.get(k) !== a) changes.push([k, a]);
      for (const k of was.keys()) if (!to.has(k) && !k.startsWith('s|card|#')) changes.push([k, null]);
      if (changes.length && old) for (const r of await store.regs(changes.map(([k]) => `${id}|${k}`))) had.set(r.key.slice(id.length + 1), r.stamp);
    }
    for (const [k, a] of changes) reg(k, a, schedStamp(a, c, had.get(k)));
    for (const r of lift.reviews ?? []) p.ops.push({ t: 'r', f: r.file, l: r.line });
  };

  const recorder: Recorder = {
    async put(w) {
      await ready;
      if (!device || skip(w.rel)) return [];
      const p = begin();
      await recordPut(p, w);
      return finish(p);
    },
    async remove(gone) {
      await ready;
      const rows = gone.filter((g) => !skip(g.rel)).map((g) => g.row);
      if (!device || !rows.length) return [];
      const p = begin();
      const have = new Map((await store.regs(rows.flatMap((r) => [`${r.id}|e`, `${r.id}|d`]))).map((r) => [r.key, r]));
      for (const r of rows) {
        const e = JSON.parse(have.get(`${r.id}|e`)?.value ?? '{}') as Record<string, number>;
        const d = JSON.parse(have.get(`${r.id}|d`)?.value ?? '{}') as Record<string, number>;
        for (const [dev, n] of Object.entries(e)) if ((d[dev] ?? 0) < n) d[dev] = n;
        p.regs.push({ key: `${r.id}|d`, stamp: '', value: JSON.stringify(d) });
        p.ops.push({ t: 'd', id: r.id, e });
      }
      return finish(p);
    },
    async places(changed) {
      await ready;
      if (!device || !changed.length) return [];
      const p = begin();
      const c = clk.tick();
      for (const [id, place] of changed) {
        const v = place === null ? null : String(place);
        p.regs.push({ key: `${id}|o`, stamp: c, value: v });
        p.ops.push({ t: 'g', k: `${id}|o`, v, c });
        p.rows.add(id);
      }
      return finish(p);
    },
    async reviews(rows) {
      await ready;
      if (!device || !rows.length) return [];
      const p = begin();
      for (const r of rows) p.ops.push({ t: 'r', f: r.file, l: r.line });
      return finish(p);
    },
    async same(added, removed) {
      await ready;
      if (!device || (!added.length && !removed.length)) return [];
      const p = begin();
      const c = clk.tick();
      for (const [pair, v] of [...added.map((k): [string, string | null] => [k, '1']), ...removed.map((k): [string, string | null] => [k, null])]) {
        p.regs.push({ key: `~q|${pair}`, stamp: c, value: v });
        p.ops.push({ t: 'g', k: `~q|${pair}`, v, c });
      }
      return finish(p);
    },
    async dead(id) {
      await ready;
      if (!device) return false;
      const regs: RowRegs = new Map((await store.regs([`${id}|e`, `${id}|d`])).map((r) => [r.key.slice(id.length + 1), r]));
      return viewOf(id, regs).dead;
    },
  };
  door.record(recorder);

  // ── a collection meets its storage ─────────────────────────────

  /** Everything the collection holds, as its first changes. The documents whose schedules wait for a card's id. */
  const bootstrap = async (): Promise<string[]> => {
    const loose: string[] = [];
    let ops: StoreOp[] = [];
    let n = 0;
    const flush = async (): Promise<void> => {
      if (ops.length) await store.batch(ops);
      ops = [];
    };
    const visit = async (parent: string | null): Promise<void> => {
      for (const row of door.childrenOf(parent).sort((a, b) => (a.id < b.id ? -1 : 1))) {
        const rel = door.pathOf(row);
        if (!skip(rel)) {
          const p = begin();
          let content: Content | undefined;
          let lift: Lift | undefined;
          if (row.kind !== 'folder') {
            if (row.blob !== null) content = { blob: row.blob };
            else if (row.kind === 'doc') {
              const d = await store.doc(row.id);
              content = { front: d.front, text: d.text };
              lift = { state: d.state, digest: '', original: null, size: 0 };
            } else content = { front: null, text: await store.text(row.id) };
          }
          await recordPut(p, { at: { id: row.id, parent: row.parent, name: row.name, place: row.place, kind: row.kind }, before: undefined, content, lift });
          if (p.unkeyed) loose.push(rel);
          ops.push(...(await finish(p)));
          if (++n % 40 === 0) await flush();
        }
        await visit(row.id);
      }
    };
    await visit(null);
    for (const [file] of await store.reviewFiles()) {
      const lines = await store.reviews(file);
      for (let i = 0; i < lines.length; i += 400) {
        const p = begin();
        for (const l of lines.slice(i, i + 400)) p.ops.push({ t: 'r', f: file, l });
        ops.push(...(await finish(p)));
      }
    }
    const pairs = await store.same();
    if (pairs.length) {
      const p = begin();
      const c = clk.tick();
      for (const pair of pairs) {
        p.regs.push({ key: `~q|${pair}`, stamp: c, value: '1' });
        p.ops.push({ t: 'g', k: `~q|${pair}`, v: '1', c });
      }
      ops.push(...(await finish(p)));
    }
    ops.push({ op: 'meta', key: 'booted', value: '1' });
    await flush();
    booted = true;
    return loose;
  };

  /** A card with a schedule and no `^id` is given one: a schedule is found by it on every device. */
  const mint = async (rel: string): Promise<void> => {
    const abs = door.abs(rel);
    const { doc } = parse(await fs.readText(abs));
    const used = new Set<string>();
    for (const b of doc.blocks) if ((b.kind === 'card' || b.kind === 'paragraph') && b.id) used.add(b.id);
    let made = false;
    for (const b of doc.blocks) {
      if (b.kind !== 'card' || b.id || !(b.sched || b.reverse || b.blanks)) continue;
      let id = '';
      do {
        id = 'c';
        for (let i = 0; i < 6; i++) id += CARD_ID[Math.floor(Math.random() * CARD_ID.length)];
      } while (used.has(id));
      used.add(id);
      b.id = id;
      made = true;
    }
    if (made) await fs.writeText(abs, serialize(doc));
  };

  const start = async (coll: string, joined: boolean): Promise<void> => {
    device = (opts.newDevice ?? randomDevice)();
    collection = coll;
    booted = joined;
    clk = clock(device, now);
    await store.batch([
      { op: 'meta', key: 'device', value: device },
      { op: 'meta', key: 'collection', value: coll },
      ...(joined ? [{ op: 'meta', key: 'booted', value: '1' } satisfies StoreOp] : []),
    ]);
  };

  // ── merging ────────────────────────────────────────────────────

  /** The updates of one file to one document's text, taken in: its body after, its state, and the headings over what both sides changed. */
  const mergeText = async (id: string, ops: Extract<Op, { t: 'x' }>[]): Promise<{ body: string; state: string | null; kept: (string | null)[] }> => {
    const state = await store.crdt(id);
    if (!state && !ops.length) return { body: '', state: null, kept: [] };
    const L = await loro();
    const doc = new L.LoroDoc();
    try {
      if (state) doc.import(unb64(state));
      const text = doc.getText(TEXT);
      if (!ops.length) return { body: text.toString(), state: null, kept: [] };
      const ours = text.toString();
      const mine = doc.oplogVersion();
      for (const o of ops) doc.import(unb64(o.u));
      const body = text.toString();
      let kept: (string | null)[] = [];
      if (state && body !== ours) {
        try {
          const theirs = L.VersionVector.decode(unb64(ops[ops.length - 1]!.vv));
          // neither had seen all of the other's: what both knew is the base the two are held against
          if (theirs.compare(mine) === undefined) {
            const a = mine.toJSON();
            const b = theirs.toJSON();
            const meet = new Map<`${number}`, number>();
            for (const [p, n] of a) { const m = Math.min(n, b.get(p) ?? 0); if (m > 0) meet.set(p, m); }
            const at = (vv: InstanceType<Loro['VersionVector']>): string => {
              const f = doc.forkAt(doc.vvToFrontiers(vv));
              try { return f.getText(TEXT).toString(); } finally { f.free(); }
            };
            kept = bothChanged(at(new L.VersionVector(meet)), ours, at(theirs));
          }
        } catch { /* a version that does not read lists nothing; the merge stands */ }
      }
      return { body, state: b64(doc.export({ mode: 'snapshot' })), kept };
    } finally {
      doc.free();
    }
  };

  const samePlace = (r: Row, at: Place): boolean => r.parent === at.parent && r.name === at.name && r.place === at.place && r.kind === at.kind;

  /** One file of another device, merged: its registers, its texts, and the tree as they make it, in one transaction. */
  const merge = async (file: FileIn, storage: Storage, out: { kept: Kept[]; changed: Set<string> }): Promise<void> => {
    // 1. the registers the file's changes name, as they are here
    const keys = new Set<string>();
    for (const b of file.batches) {
      for (const o of b.ops) {
        if (o.t === 'g') { keys.add(o.k); const id = rowOf(o.k); if (id) keys.add(`${id}|e`); }
        else if (o.t === 'x') keys.add(`${o.id}|e`);
        else if (o.t === 'd') keys.add(`${o.id}|d`);
      }
    }
    const have = new Map((await store.regs([...keys])).map((r) => [r.key, r]));
    const dirty = new Map<string, Reg>();
    const at = (k: string): Reg | undefined => dirty.get(k) ?? have.get(k);
    const texts = new Map<string, Extract<Op, { t: 'x' }>[]>();
    const lines = new Map<string, ReviewRow[]>();
    const touched = new Set<string>();
    /** A change to a row was read: a delete that had not seen it does not hold. */
    const bump = (id: string, s: number): void => {
      const k = `${id}|e`;
      const e = JSON.parse(at(k)?.value ?? '{}') as Record<string, number>;
      if ((e[file.device] ?? 0) < s) {
        e[file.device] = s;
        dirty.set(k, { key: k, stamp: '', value: JSON.stringify(e) });
      }
      touched.add(id);
    };
    for (const b of file.batches) {
      for (const o of b.ops) {
        if (o.t === 'g') {
          clk.see(o.c.slice(-CLOCK_LEN));
          const had = at(o.k);
          if (!had || o.c > had.stamp) dirty.set(o.k, { key: o.k, stamp: o.c, value: o.v });
          const id = rowOf(o.k);
          if (id) bump(id, b.s);
        } else if (o.t === 'x') {
          texts.set(o.id, [...(texts.get(o.id) ?? []), o]);
          bump(o.id, b.s);
        } else if (o.t === 'd') {
          const k = `${o.id}|d`;
          const was = at(k);
          const d = JSON.parse(was?.value ?? '{}') as Record<string, number>;
          let moved = !was;
          for (const [dev, n] of Object.entries(o.e)) if ((d[dev] ?? 0) < n) { d[dev] = n; moved = true; }
          if (moved) dirty.set(k, { key: k, stamp: '', value: JSON.stringify(d) });
          touched.add(o.id);
        } else {
          const r = parseReviews(o.l)[0];
          if (r) lines.set(o.f, [...(lines.get(o.f) ?? []), { ...reviewRow(o.f, r), line: o.l }]);
        }
      }
    }

    // 2. every touched row as its registers have it now
    const ids = [...touched];
    const regsOf = new Map<string, RowRegs>(ids.map((id) => [id, new Map()]));
    const changedOf = new Map<string, Set<string>>();
    if (ids.length) for (const r of await store.regsUnder(ids.map((id) => `${id}|`))) regsOf.get(rowOf(r.key)!)?.set(r.key.slice(r.key.indexOf('|') + 1), r);
    for (const r of dirty.values()) {
      const id = rowOf(r.key);
      if (!id) continue;
      const sub = r.key.slice(id.length + 1);
      regsOf.get(id)?.set(sub, r);
      changedOf.set(id, (changedOf.get(id) ?? new Set()).add(sub));
    }
    const views = new Map<string, View>(ids.map((id) => [id, viewOf(id, regsOf.get(id)!)]));
    const fetch = async (id: string): Promise<View> => {
      let v = views.get(id);
      if (!v) {
        const regs: RowRegs = new Map();
        for (const r of await store.regsUnder([`${id}|`])) regs.set(r.key.slice(id.length + 1), r);
        v = viewOf(id, regs);
        views.set(id, v);
      }
      return v;
    };

    // 3. what the tree shows after: a row that is not dead, and whatever such a row is under
    const show = new Map<string, View>();
    const keep = new Set<string>();
    for (const v of views.values()) if (v.complete && !v.dead) show.set(v.id, v);
    for (const v of [...show.values()]) {
      let child = v;
      for (let hops = 0; hops < 10_000; hops++) {
        const pid = child.at.parent;
        if (pid === null || show.has(pid)) break;
        if (door.row(pid)) {
          for (let r = door.row(pid); r; r = r.parent === null ? undefined : door.row(r.parent)) keep.add(r.id);
          break;
        }
        const pv = await fetch(pid);
        // a parent nothing is known of: the row is shown at the top until it is
        if (!pv.complete) { child.at = { ...child.at, parent: null }; break; }
        show.set(pid, pv);
        child = pv;
      }
    }
    // a move that would put a row under itself is not made: the row is shown at the top (62 settles moves)
    for (const v of show.values()) {
      let p = v.at.parent;
      for (let hops = 0; p !== null && hops < 10_000; hops++) {
        if (p === v.id) { v.at = { ...v.at, parent: null }; break; }
        p = show.has(p) ? show.get(p)!.at.parent : door.row(p)?.parent ?? null;
      }
    }
    const moves = (id: string, from: string): boolean => show.has(id) && show.get(id)!.at.parent !== from;
    const goes = (id: string): boolean => {
      if (show.has(id) || keep.has(id)) return false;
      const v = views.get(id);
      if (!v || (v.complete && !v.dead)) return false;
      return door.childrenOf(id).every((c) => moves(c.id, id) || goes(c.id));
    };
    const removes: string[] = [];
    const removed = new Set<string>();
    for (const id of ids) if (door.row(id) && goes(id)) { removes.push(id); removed.add(id); }
    // a deleted row kept for what was under it goes once nothing is
    for (const id of [...removes]) {
      for (let p = door.row(id)?.parent ?? null; p !== null; ) {
        const pid: string = p;
        const row = door.row(pid);
        if (!row || removed.has(pid) || show.has(pid) || keep.has(pid)) break;
        const left = door.childrenOf(pid).some((c) => !removed.has(c.id) && !moves(c.id, pid));
        const comes = [...show.values()].some((v) => v.at.parent === pid);
        if (left || comes || !(await fetch(pid)).dead) break;
        removes.push(pid);
        removed.add(pid);
        p = row.parent;
      }
    }

    // 4. the rows to write, a parent before what is under it
    const depth = (id: string, seen = new Set<string>()): number => {
      const p = show.get(id)!.at.parent;
      if (p === null || !show.has(p) || seen.has(id)) return 0;
      seen.add(id);
      return depth(p, seen) + 1;
    };
    const order = [...show.values()].map((v) => ({ v, d: depth(v.id) })).sort((a, b) => a.d - b.d || (a.v.id < b.v.id ? -1 : 1));
    const view: ViewWrite = { puts: [], removes, reviews: [...lines].map(([f, rows]) => ({ file: f, rows })), pairs: null };
    const crdts: StoreOp[] = [];
    const listed: { id: string; heading: string | null }[] = [];
    const wrote = new Set<string>();
    const needBlob = async (hash: string): Promise<void> => {
      if (await store.blobHas(hash)) return;
      const bytes = await storage.read(`blobs/${hash}`);
      if (!bytes) throw new Error(`a file is not in the storage yet (${hash.slice(0, 12)})`);
      await store.blobPut(bytes);
    };
    for (const { v } of order) {
      const id = v.id;
      const here = door.row(id);
      const subs = changedOf.get(id) ?? new Set<string>();
      const content = !here || texts.has(id) || [...subs].some((k) => k === 'k' || k === 'b' || k === 't' || k.startsWith('m|') || k.startsWith('s|'));
      if (!content) {
        if (!samePlace(here!, v.at)) view.puts.push({ at: v.at });
        continue;
      }
      const val = (k: string): string | null => v.regs.get(k)?.value ?? null;
      if (v.at.kind === 'folder') {
        if (!here || !samePlace(here, v.at)) view.puts.push(here && here.kind !== 'folder' ? { at: v.at, content: {} } : { at: v.at });
        continue;
      }
      const blob = val('b');
      if (blob !== null) {
        await needBlob(blob);
        view.puts.push({ at: v.at, content: { blob } });
        continue;
      }
      if (v.at.kind === 'file') {
        view.puts.push({ at: v.at, content: { front: null, text: val('t') ?? '' } });
        continue;
      }
      let body: string;
      if (texts.has(id) || !here || here.kind !== 'doc' || here.blob !== null) {
        const m = await mergeText(id, texts.get(id) ?? []);
        body = m.body;
        if (m.state) crdts.push({ op: 'crdt', doc: id, state: m.state });
        for (const heading of m.kept) listed.push({ id, heading });
      } else {
        const c = await store.doc(id);
        body = bodyOf(c.front, c.text);
      }
      view.puts.push({ at: v.at, file: compose(bareOf(frontOf(v.regs), body), schedulesOf(v.regs)) });
      wrote.add(id);
    }
    // a text changed under a row that is not shown is kept all the same
    for (const [id, ops] of texts) {
      if (show.has(id)) continue;
      const m = await mergeText(id, ops);
      if (m.state) crdts.push({ op: 'crdt', doc: id, state: m.state });
    }
    if ([...dirty.keys()].some((k) => k.startsWith('~q|'))) {
      const pairs = new Set(await store.same());
      for (const r of dirty.values()) {
        if (!r.key.startsWith('~q|')) continue;
        if (r.value === null) pairs.delete(r.key.slice(3));
        else pairs.add(r.key.slice(3));
      }
      view.pairs = [...pairs].sort();
    }

    await door.apply(view, [
      { op: 'regs', set: [...dirty.values()] },
      ...crdts,
      { op: 'meta', key: `cur|${file.device}`, value: String(file.n) },
      { op: 'meta', key: 'hlc', value: clk.last() },
    ]);
    cur.set(file.device, file.n);
    for (const id of wrote) { const r = door.row(id); if (r) out.changed.add(door.pathOf(r)); }
    for (const l of listed) {
      const r = door.row(l.id);
      if (!r) continue;
      let heading = l.heading;
      if (heading === null) {
        // no heading above it: the document's title, else its name
        const title = views.get(l.id)?.regs.get('m|title')?.value;
        try { if (title) heading = (JSON.parse(title) as [number, string])[1].replace(/^title:\s*/, '').replace(/^"(.*)"$/, '$1').replace(/^'(.*)'$/, '$1'); } catch { /* its name */ }
      }
      out.kept.push({ path: door.pathOf(r), heading: heading || r.name });
    }
  };

  // ── a sync ─────────────────────────────────────────────────────

  const parseFile = (dev: string, n: number, bytes: Uint8Array): FileIn => {
    const [head, ...rest] = fromUtf8.decode(bytes).split('\n');
    const h = JSON.parse(head ?? '') as { ilmi?: unknown; device?: unknown; n?: unknown; seen?: Record<string, number> };
    if (h.ilmi !== 1 || h.device !== dev || h.n !== n) throw new Error(`devices/${dev}/${n} is not what its name says`);
    return { device: dev, n, seen: h.seen ?? {}, batches: rest.filter((l) => l.trim()).map((l) => JSON.parse(l) as Batch) };
  };

  let busy: Promise<unknown> = Promise.resolve();
  const lock = <T>(fn: () => Promise<T>): Promise<T> => {
    const run = busy.then(fn, fn);
    busy = run.catch(() => {});
    return run;
  };

  const formatOf = (bytes: Uint8Array): { collection: string } => {
    let f: { ilmi?: unknown; version?: unknown; collection?: unknown } = {};
    try { f = JSON.parse(fromUtf8.decode(bytes)) as typeof f; } catch { /* not ours */ }
    if (f.ilmi !== 'sync' || typeof f.collection !== 'string') throw new Error('not a storage of ilmi\'s');
    if (f.version !== 1) throw new Error('this storage was written by a newer ilmi');
    return { collection: f.collection };
  };

  const pull = async (storage: Storage, out: { kept: Kept[]; changed: Set<string> }): Promise<number> => {
    const by = new Map<string, Set<number>>();
    for (const p of await storage.list('devices/')) {
      const m = /^devices\/([0-9a-f]+)\/(\d+)$/.exec(p);
      if (m) by.set(m[1]!, (by.get(m[1]!) ?? new Set()).add(Number(m[2])));
    }
    // a file of this device's that it does not know it wrote: this is an older copy of the collection
    for (const k of by.get(device!) ?? []) if (k > Math.max(files, plan?.n ?? 0)) throw new Error('this copy of the collection is older than what it has sent');
    const read = new Map<string, FileIn>();
    let merged = 0;
    for (let moved = true; moved; ) {
      moved = false;
      for (const [dev, has] of by) {
        if (dev === device) continue;
        const n = (cur.get(dev) ?? 0) + 1;
        if (!has.has(n)) continue;
        const path = `devices/${dev}/${n}`;
        let file = read.get(path);
        if (!file) {
          const bytes = await storage.read(path);
          if (!bytes) continue;
          file = parseFile(dev, n, bytes);
          read.set(path, file);
        }
        // merged once everything its writer had read is here: a parent before its child, a text's start before its edits
        const due = Object.entries(file.seen).every(([d, k]) => (d === device ? k <= files : (cur.get(d) ?? 0) >= k));
        if (!due) continue;
        const f = file;
        await door.run(() => merge(f, storage, out));
        read.delete(path);
        merged += 1;
        moved = true;
      }
    }
    return merged;
  };

  const push = async (storage: Storage): Promise<number> => {
    let wrote = 0;
    let blobs: Set<string> | null = null;
    for (;;) {
      // which changes the next file holds is settled, and kept, before it is written: written again, it is the same file
      const next = await door.run(async () => {
        if (plan) return plan;
        const rows = await store.outbox(sent, FILE_BYTES);
        if (!rows.length) return null;
        plan = { n: files + 1, to: rows[rows.length - 1]![0], seen: Object.fromEntries(cur) };
        await store.batch([{ op: 'meta', key: 'plan', value: JSON.stringify(plan) }]);
        return plan;
      });
      if (!next) break;
      const rows = (await store.outbox(sent, FILE_BYTES)).filter(([s]) => s <= next.to);
      for (const [, data] of rows) {
        for (const o of (JSON.parse(data) as Batch).ops) {
          if (o.t !== 'g' || o.v === null || o.k !== `${rowOf(o.k)}|b`) continue;
          blobs ??= new Set((await storage.list('blobs/')).map((p) => p.slice('blobs/'.length)));
          if (blobs.has(o.v)) continue;
          await storage.write(`blobs/${o.v}`, await store.blobGet(o.v));
          blobs.add(o.v);
        }
      }
      const head = JSON.stringify({ ilmi: 1, device, n: next.n, seen: next.seen });
      await storage.write(`devices/${device}/${next.n}`, utf8.encode(`${[head, ...rows.map(([, data]) => data)].join('\n')}\n`));
      await door.run(() => store.batch([
        { op: 'meta', key: 'sent', value: String(next.to) },
        { op: 'meta', key: 'files', value: String(next.n) },
        { op: 'meta', key: 'plan', value: null },
        { op: 'outDrop', upTo: next.to },
      ]));
      sent = next.to;
      files = next.n;
      plan = null;
      wrote += 1;
    }
    return wrote;
  };

  return {
    async on() {
      await ready;
      return device !== null;
    },
    device: () => device,
    connect: (storage) =>
      lock(async () => {
        await ready;
        const raw = await storage.read(FORMAT);
        const there = raw ? formatOf(raw) : null;
        const write = (coll: string): Promise<void> => storage.write(FORMAT, utf8.encode(`${JSON.stringify({ ilmi: 'sync', version: 1, collection: coll })}\n`));
        if (device) {
          if (there && there.collection !== collection) throw new Error('this storage holds another collection');
          // an empty storage cannot take a collection that has already written its changes to another: they are not here to read
          if (!there && (files > 0 || cur.size > 0)) throw new Error('this collection syncs with another storage');
          if (!there) await write(collection!);
          if (!booted) for (const rel of await door.run(bootstrap)) await mint(rel);
          return 'connected';
        }
        if (there) {
          if (door.rows().length) throw new Error('this storage holds another collection');
          await start(there.collection, true);
          return 'joined';
        }
        // an order that came in before the rows it orders is taken up by a read of it: the places are rows before they are changes
        await fs.readText(door.abs('.ilmi/order.json')).catch(() => '');
        const coll = newId();
        await start(coll, false);
        await write(coll);
        for (const rel of await door.run(bootstrap)) await mint(rel);
        return 'made';
      }),
    sync: (storage) =>
      lock(async () => {
        await ready;
        if (!device || !booted) throw new Error('the collection has no storage yet');
        const raw = await storage.read(FORMAT);
        if (!raw) throw new Error('the storage is not there');
        if (formatOf(raw).collection !== collection) throw new Error('this storage holds another collection');
        const out = { kept: [] as Kept[], changed: new Set<string>() };
        const read = await pull(storage, out);
        const wrote = await push(storage);
        return { read, wrote, kept: out.kept, changed: [...out.changed] };
      }),
    async waiting() {
      await ready;
      return store.outboxCount();
    },
  };
}
