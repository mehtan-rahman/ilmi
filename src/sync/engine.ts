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
// - The tree (milestone 62) is what the registers make, by rules that
//   read nothing but the registers, so every device makes the same one:
//   a row's parent is the later move. Of moves that together would put a
//   row under itself, the latest is dropped: the device that finds the
//   loop writes that row's parent back to where it was moved from (the
//   top, when that is gone or would loop too), as a change stamped just
//   after the move it undoes, so each device that finds it writes the
//   same change and a move made since still wins. Of rows with one name
//   in one place, the one whose id sorts first has the name and the
//   others are shown as `name 2`, `name 3`: that is never written, the
//   row's name is still the one it was given, and it is shown by it
//   again when the other row is gone. A row shown otherwise than its
//   registers have it is `displaced`, and is looked at again on every
//   merge and every sync.
// - A row's place in its directory's order is a register too, a number
//   between its neighbours' (`src/vault/store.ts`, `setPlaces`), so two
//   orders of one directory merge row by row. A row that only kept its
//   place when an order was first written is stamped below every move
//   (`KEPT`): the other device's move of it wins, whenever it was made.
//
// What is kept (the store's `regs`, `crdt`, `outbox`, `sync_meta`): a
// register per field with the stamp that won it and its value; per
// document the library's state; the changes not yet written out; the
// device, its clock, and how far each other device has been read. The tree
// the app sees is what the registers and the texts make, written through
// the store's door whenever a merge changes them.
//
// A change is one JSON object: `g` a register (`k` its key, `v` its value,
// `c` its stamp; `a` when it is not a change a delete has to have seen for
// the row to go: a dropped move undone, a place a row only kept or lost
// when its directory's order was written), `x` a text update (`u`, with `vv` the version it was
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
  | { t: 'g'; k: string; v: string | null; c: string; a?: 1 }
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
/** Leads the stamp of a place a row only kept: it sorts below every stamp of a move. */
const KEPT = '!';
/** Ends the stamp of a dropped move undone: just after the move's own, before any made since. */
const UNDONE = '~';
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
  /** Where its registers put it and what they name it. */
  parent: string | null;
  name: string;
  /** What it is shown as: elsewhere for a move dropped, under another name where a row before it has this one. */
  at: Place;
  regs: RowRegs;
}

/** A place as its register holds it, for a row in `parent`: the number, when it is a place in that directory (`[2.5,"<parent>"]`; a bare number, written before 62, is a place wherever the row is). */
function placeIn(o: string | null, parent: string | null): number | null {
  if (o === null) return null;
  try {
    const v = JSON.parse(o) as unknown;
    if (typeof v === 'number') return Number.isFinite(v) ? v : null;
    if (Array.isArray(v) && typeof v[0] === 'number' && Number.isFinite(v[0])) return v[1] === (parent ?? '') ? v[0] : null;
  } catch { /* a register that does not read is no place */ }
  return null;
}

function viewOf(id: string, regs: RowRegs): View {
  const v = (k: string): string | null => regs.get(k)?.value ?? null;
  const name = v('n');
  const kind = v('k');
  const p = regs.get('p');
  const e = JSON.parse(v('e') ?? '{}') as Record<string, number>;
  const d = regs.has('d') ? (JSON.parse(v('d') ?? '{}') as Record<string, number>) : null;
  const parent = p?.value ? p.value : null;
  return {
    id,
    complete: name !== null && kind !== null && !!p && p.value !== null,
    dead: d !== null && Object.entries(e).every(([dev, n]) => (d[dev] ?? 0) >= n),
    parent,
    name: name ?? '',
    at: { id, parent, name: name ?? '', place: placeIn(v('o'), parent), kind: (kind ?? 'file') as RowKind },
    regs,
  };
}

/** `name` as the `k`th row of that name in one place is shown: `notes 2`, `figure 2.png`. */
function numbered(name: string, kind: RowKind, k: number): string {
  const dot = kind === 'file' ? name.lastIndexOf('.') : -1;
  return dot > 0 ? `${name.slice(0, dot)} ${k}${name.slice(dot)}` : `${name} ${k}`;
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
  /** Rows shown otherwise than their registers have them: a move dropped for the loop it would make, a name a row before it holds. */
  let displaced = new Set<string>();

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
    try { displaced = new Set(JSON.parse(meta.get('displaced') ?? '[]') as string[]); } catch { /* none */ }
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
    // a displaced row renamed or moved here: the write says where it is and what it is called from now on, as it was shown
    const settles = !!before && displaced.has(id) && (before.name !== at.name || before.parent !== at.parent);
    if (!before || before.name !== at.name || settles) reg('n', at.name);
    if (!before || before.parent !== at.parent || settles) {
      reg('p', at.parent ?? '');
      // where it was moved from: where it stays if the move is dropped
      if (before) reg('q', before.parent ?? '');
    }
    if (!before || before.kind !== at.kind) reg('k', at.kind);
    // a place is a place in one directory: a move writes it again, kept or none, so a place the row once had where it lands is not taken up again
    if (before ? before.place !== at.place || before.parent !== at.parent : at.place !== null) reg('o', at.place === null ? null : JSON.stringify([at.place, at.parent ?? '']));
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
      // a row that was a document before it was a folder (its children kept it) may still hold that document's lines
      for (const r of before ? await store.regsUnder([`${id}|m|`]) : []) {
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
    if (moved && before) {
      // the text changed, or the row is a document again: every schedule the registers hold that the document does not carry goes
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
      // a row that only kept its place yields to any move of it, unless a move is what it had: then this is the later one
      const kept = changed.filter(([, , k]) => k).map(([id]) => `${id}|o`);
      const had = new Map((kept.length ? await store.regs(kept) : []).map((r) => [r.key, r.stamp]));
      for (const [id, place, k] of changed) {
        const key = `${id}|o`;
        const was = had.get(key);
        const stamp = k && (was === undefined || was.startsWith(KEPT)) ? KEPT + c : c;
        const v = place === null ? null : JSON.stringify([place, door.row(id)?.parent ?? '']);
        p.regs.push({ key, stamp, value: v });
        // only a row given a place is a row someone moved: one that kept its place, or lost it with the list, is not kept from a delete by that
        if (k || place === null) p.ops.push({ t: 'g', k: key, v, c: stamp, a: 1 });
        else { p.ops.push({ t: 'g', k: key, v, c: stamp }); p.rows.add(id); }
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

  /**
   * One file of another device, merged: its registers, its texts, and the
   * tree as they make it, in one transaction. With no file, the rows shown
   * otherwise than their registers have them are looked at again: what was
   * written here since may have made room for one.
   */
  const merge = async (file: FileIn | null, storage: Storage, out: { kept: Kept[]; changed: Set<string> }): Promise<void> => {
    // 1. the registers the file's changes name, as they are here
    const batches = file?.batches ?? [];
    const keys = new Set<string>();
    for (const b of batches) {
      for (const o of b.ops) {
        if (o.t === 'g') { keys.add(o.k); const id = rowOf(o.k); if (id) keys.add(`${id}|e`); }
        else if (o.t === 'x') keys.add(`${o.id}|e`);
        else if (o.t === 'd') keys.add(`${o.id}|d`);
      }
    }
    const have = new Map((keys.size ? await store.regs([...keys]) : []).map((r) => [r.key, r]));
    const dirty = new Map<string, Reg>();
    const at = (k: string): Reg | undefined => dirty.get(k) ?? have.get(k);
    const texts = new Map<string, Extract<Op, { t: 'x' }>[]>();
    const lines = new Map<string, ReviewRow[]>();
    const touched = new Set<string>();
    /** A change to a row was read: a delete that had not seen it does not hold. */
    const bump = (id: string, s: number): void => {
      const k = `${id}|e`;
      const e = JSON.parse(at(k)?.value ?? '{}') as Record<string, number>;
      if ((e[file!.device] ?? 0) < s) {
        e[file!.device] = s;
        dirty.set(k, { key: k, stamp: '', value: JSON.stringify(e) });
      }
      touched.add(id);
    };
    for (const b of batches) {
      for (const o of b.ops) {
        if (o.t === 'g') {
          if (!o.c.endsWith(UNDONE)) clk.see(o.c.slice(-CLOCK_LEN));
          const had = at(o.k);
          // one stamp, two values: two devices undid one move, each as it saw the tree; the value decides
          if (!had || o.c > had.stamp || (o.c === had.stamp && (o.v ?? '') > (had.value ?? ''))) dirty.set(o.k, { key: o.k, stamp: o.c, value: o.v });
          const id = rowOf(o.k);
          if (id && o.a) touched.add(id);
          else if (id) bump(id, b.s);
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
    // a row shown otherwise than its registers have it is looked at again with every merge
    for (const id of displaced) touched.add(id);

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

    // 3. moves that together would put a row under itself. Every row's parent is read from its registers (a row
    // not read here is in the tree where they put it), so each device that holds these registers finds the same
    // loops and undoes the same move of each: the latest.
    /** Rows this merge did not read whose place in the tree it changes: shown elsewhere, or under another name. */
    const side = new Map<string, Place>();
    /** The rows shown otherwise than their registers have them, after this merge. */
    const off = new Set<string>();
    /** Dropped moves undone here: changes of this device's, for the others. */
    const undone: Op[] = [];
    const parentOf = (id: string): string | null | undefined => {
      const v = views.get(id);
      return v ? (v.complete ? v.parent : undefined) : door.row(id)?.parent;
    };
    // a row gone from the tree that a row read here is under is read too: it comes back with what is under it, and a loop may run through it
    for (const id of ids) {
      for (let pid = parentOf(id), hops = 0; pid != null && !views.has(pid) && !door.row(pid) && hops < 10_000; hops++) pid = (await fetch(pid)).complete ? views.get(pid)!.parent : null;
    }
    const loops: string[][] = [];
    const clear = new Set<string>();
    for (const start of [...views.keys()]) {
      const path: string[] = [];
      const on = new Set<string>();
      for (let id: string | null | undefined = start; id != null && !clear.has(id); id = parentOf(id)) {
        if (on.has(id)) { loops.push(path.slice(path.indexOf(id))); break; }
        path.push(id);
        on.add(id);
      }
      for (const id of path) clear.add(id);
    }
    if (loops.length) {
      const moveOf = async (id: string): Promise<{ id: string; stamp: string; from: string | null }> => {
        let regs: RowRegs | undefined = views.get(id)?.regs;
        if (!regs) {
          regs = new Map();
          for (const r of await store.regs([`${id}|p`, `${id}|q`])) regs.set(r.key.slice(id.length + 1), r);
        }
        const p = regs.get('p');
        const q = regs.get('q');
        // where the move was made from, when the same write said so
        return { id, stamp: p?.stamp ?? '', from: p && q && q.stamp === p.stamp && q.value ? q.value : null };
      };
      const later = (a: { id: string; stamp: string }, b: { id: string; stamp: string }): boolean => a.stamp > b.stamp || (a.stamp === b.stamp && a.id > b.id);
      const dropped: { id: string; stamp: string; from: string | null }[] = [];
      for (const loop of loops) {
        let last = await moveOf(loop[0]!);
        for (const id of loop.slice(1)) { const m = await moveOf(id); if (later(m, last)) last = m; }
        dropped.push(last);
      }
      dropped.sort((a, b) => (later(a, b) ? 1 : -1));
      const live = async (id: string): Promise<boolean> => {
        const v = views.get(id);
        if (v) return v.complete && !v.dead;
        if (!door.row(id)) return false;
        const regs: RowRegs = new Map((await store.regs([`${id}|e`, `${id}|d`])).map((r) => [r.key.slice(id.length + 1), r]));
        return !viewOf(id, regs).dead;
      };
      // the row of a dropped move goes back where it was moved from, when that is still there and not under the row; else to the top
      const to = new Map<string, string | null>(dropped.map((d) => [d.id, null]));
      for (const d of dropped) {
        if (d.from === null || !(await live(d.from))) continue;
        let ok = true;
        const seen = new Set<string>();
        for (let id: string | null | undefined = d.from; id != null; id = to.has(id) ? to.get(id) : parentOf(id)) {
          if (id === d.id || seen.has(id)) { ok = false; break; }
          seen.add(id);
        }
        if (ok) to.set(d.id, d.from);
      }
      for (const d of dropped) {
        const parent = to.get(d.id) ?? null;
        const reg: Reg = { key: `${d.id}|p`, stamp: d.stamp + UNDONE, value: parent ?? '' };
        dirty.set(reg.key, reg);
        undone.push({ t: 'g', k: reg.key, v: reg.value, c: reg.stamp, a: 1 });
        const v = views.get(d.id);
        if (v) {
          v.regs.set('p', reg);
          v.parent = parent;
          v.at = { ...v.at, parent, place: placeIn(v.regs.get('o')?.value ?? null, parent) };
        } else {
          const r = door.row(d.id);
          if (r) side.set(d.id, { id: r.id, parent, name: r.name, place: null, kind: r.kind });
        }
      }
    }

    // 3a. what the tree shows after: a row that is not dead, and a dead one while a row that is shown is under it
    // (a folder deleted on one device with a document changed under it on another stays for the document).
    const coming = new Map<string, string[]>();
    for (const v of views.values()) if (v.complete && v.parent !== null) coming.set(v.parent, [...(coming.get(v.parent) ?? []), v.id]);
    const held = new Map<string, boolean>();
    const holds = (id: string): boolean => {
      const known = held.get(id);
      if (known !== undefined) return known;
      // a ring of dead rows holds none of them
      held.set(id, false);
      let yes = false;
      for (const c of new Set([...door.childrenOf(id).map((r) => r.id), ...(coming.get(id) ?? [])])) {
        const v = views.get(c);
        const moved = side.get(c);
        // a row of the tree not read here is shown: it is under this one still
        if (!v ? !moved || moved.parent === id : v.complete && v.parent === id && (!v.dead || holds(c))) { yes = true; break; }
      }
      held.set(id, yes);
      return yes;
    };
    const show = new Map<string, View>();
    for (const v of views.values()) if (v.complete && (!v.dead || holds(v.id))) show.set(v.id, v);
    for (const v of [...show.values()]) {
      let child = v;
      for (let hops = 0; hops < 10_000; hops++) {
        const pid = child.at.parent;
        if (pid === null || show.has(pid) || door.row(pid)) break;
        const pv = await fetch(pid);
        // a parent nothing is known of: the row is shown at the top until it is
        if (!pv.complete) { child.at = { ...child.at, parent: null, place: null }; break; }
        show.set(pid, pv);
        child = pv;
      }
    }
    for (const v of show.values()) if (v.at.parent !== v.parent) off.add(v.id);

    // 3b. what goes: a dead row with nothing shown under it, and then whatever dead row was kept only for it
    const placeOf = (id: string): Place | undefined => show.get(id)?.at ?? side.get(id);
    const moves = (id: string, from: string): boolean => { const p = placeOf(id); return !!p && p.parent !== from; };
    const removes: string[] = [];
    const removed = new Set<string>();
    for (const id of ids) {
      const v = views.get(id)!;
      if (door.row(id) && !show.has(id) && v.complete && v.dead) { removes.push(id); removed.add(id); }
    }
    // the directories a row left: by going, or by a move
    const left = new Set<string>();
    for (const id of removes) { const r = door.row(id); if (r?.parent) left.add(r.parent); }
    for (const p of [...[...show.values()].map((v) => v.at), ...side.values()]) { const r = door.row(p.id); if (r?.parent && r.parent !== p.parent) left.add(r.parent); }
    for (const from of left) {
      for (let p: string | null = from; p !== null; ) {
        const pid: string = p;
        const row = door.row(pid);
        if (!row || removed.has(pid) || show.has(pid)) break;
        const stays = door.childrenOf(pid).some((c) => !removed.has(c.id) && !moves(c.id, pid));
        const comes = [...show.values()].some((v) => v.at.parent === pid) || [...side.values()].some((s) => s.parent === pid);
        if (stays || comes || !(await fetch(pid)).dead) break;
        removes.push(pid);
        removed.add(pid);
        p = row.parent;
      }
    }
    for (const id of removed) side.delete(id);

    // 3c. one name in one place: the row whose id sorts first has it, and the others are shown numbered. Looked at
    // in every directory a row came to, left, or was renamed in, and in every one that holds a displaced row.
    const dirs = new Set<string>();
    for (const v of show.values()) {
      const here = door.row(v.id);
      if (here && here.parent === v.at.parent && here.name === v.name) continue;
      if (here) dirs.add(here.parent ?? '');
      dirs.add(v.at.parent ?? '');
    }
    for (const [id, p] of side) { dirs.add(door.row(id)?.parent ?? ''); dirs.add(p.parent ?? ''); }
    for (const id of displaced) { const r = door.row(id); if (r && !removed.has(id)) dirs.add(r.parent ?? ''); }
    if (dirs.size) {
      const into = new Map<string, string[]>();
      for (const p of [...[...show.values()].map((v) => v.at), ...side.values()]) into.set(p.parent ?? '', [...(into.get(p.parent ?? '') ?? []), p.id]);
      const nameOf = (id: string): string => { const v = views.get(id); return v?.complete ? v.name : door.row(id)!.name; };
      for (const dir of dirs) {
        const members = new Set<string>(into.get(dir) ?? []);
        for (const r of door.childrenOf(dir === '' ? null : dir)) if (!removed.has(r.id) && !placeOf(r.id)) members.add(r.id);
        const named = [...members].map((id) => ({ id, name: nameOf(id) }));
        const first = new Map<string, string>();
        for (const m of named) { const f = first.get(m.name); if (f === undefined || m.id < f) first.set(m.name, m.id); }
        const taken = new Set(first.keys());
        const as = new Map<string, string>();
        for (const m of named.filter((x) => first.get(x.name) !== x.id).sort((x, y) => (x.name < y.name ? -1 : x.name > y.name ? 1 : x.id < y.id ? -1 : 1))) {
          const kind = show.get(m.id)?.at.kind ?? door.row(m.id)!.kind;
          let name = '';
          for (let k = 2; name === '' || taken.has(name); k++) name = numbered(m.name, kind, k);
          taken.add(name);
          as.set(m.id, name);
        }
        for (const m of named) {
          const name = as.get(m.id) ?? m.name;
          if (name !== m.name) off.add(m.id);
          const v = show.get(m.id);
          if (v) { v.at = { ...v.at, name }; continue; }
          const r = door.row(m.id)!;
          const s = side.get(m.id);
          if (s) side.set(m.id, { ...s, name });
          else if (r.name !== name) side.set(m.id, { id: r.id, parent: r.parent, name, place: r.place, kind: r.kind });
        }
      }
    }
    const still = [...off].sort();
    const shifted = still.length !== displaced.size || still.some((id) => !displaced.has(id));

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
    for (const [id, p] of side) { const r = door.row(id); if (r && !samePlace(r, p)) view.puts.push({ at: p }); }
    // a text changed under a row that is not shown, or is shown as a folder now, is kept all the same
    for (const [id, ops] of texts) {
      if (wrote.has(id)) continue;
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

    if (!file && !view.puts.length && !view.removes.length && !shifted) return;
    if (undone.length) seq += 1;
    await door.apply(view, [
      ...(dirty.size ? [{ op: 'regs', set: [...dirty.values()] } satisfies StoreOp] : []),
      ...crdts,
      ...(undone.length ? [{ op: 'out', seq, data: JSON.stringify({ s: seq, ops: undone } satisfies Batch) }, { op: 'meta', key: 'seq', value: String(seq) }] satisfies StoreOp[] : []),
      ...(shifted ? [{ op: 'meta', key: 'displaced', value: still.length ? JSON.stringify(still) : null } satisfies StoreOp] : []),
      ...(file ? [{ op: 'meta', key: `cur|${file.device}`, value: String(file.n) }, { op: 'meta', key: 'hlc', value: clk.last() }] satisfies StoreOp[] : []),
    ]);
    displaced = off;
    if (file) cur.set(file.device, file.n);
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
    // a write made here since the last merge may have made room for a row that is displaced
    if (displaced.size) await door.run(() => merge(null, storage, out));
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
