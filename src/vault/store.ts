// The store under a vault (milestone 59). A collection is a database, not a
// directory: every folder, document and file is a row with an id, its
// parent's id and its name (`src-tauri/src/store.rs` holds the tables). A
// document's text is Markdown as FORMAT.md has it; PDFs and images are
// files beside the database, named by their SHA-256.
//
// `Vault` stays pure over `Fs`, and `storeFs` is the `Fs` a store gives it:
// paths are made from names and parents, so `papers/maxwell.md` is the row
// named `maxwell` whose parent is the row named `papers`, and
// `papers/maxwell/` is what has that document for a parent. The app above
// (`vault.fs.readBytes(vault.abs(rel))`, the plugins' files under
// `.ilmi/`) does not change, and nothing reads a Markdown file from disk.
//
// What differs from a directory, said once:
// - A document and its children are one row and the rows under it. They
//   move together: renaming `a.md` takes `a/` with it. A children
//   directory exists (to `stat`) while it holds something.
// - Since milestone 60 a document's row holds its text without its state:
//   a write takes the file apart (`lift.ts`: the schedules into rows, an
//   index of its cards and headings beside them, all in one transaction)
//   and a read puts it together again, so the vault above still reads and
//   writes the file FORMAT.md describes. A write that changes only a
//   schedule leaves the text as it is.
// - Three files under `.ilmi/` are not rows at all but views of tables:
//   `order.json` is the rows' `place`, `reviews/*.jsonl` the review log,
//   `same.json` the pairs said not the same. Each reads back as the file
//   that was written, and is written as a file.
// - A folder made where a document of that name then lands (`a/` before
//   `a.md`, as a restore writes them) becomes that document; a document
//   removed while it has children leaves them as a folder.
// - Writes are whole (`atomic`), so the vault writes in place.
// - `watch` reports this `Fs`'s own writes, a moment later, as a directory
//   watcher reports an app's own; nothing else writes a collection yet.

import { formatReview, parseReviews, type Doc, type Review } from '../format/index.js';
import type { Fs, FsEntry, FsStat } from './fs.js';
import { join, relative } from './fs.js';
import { decompose, digest, recompose, stampOf, type Original, type StateRow } from './lift.js';
import { ORDER_FILE, cleanOrder, type Order } from './order.js';

export type RowKind = 'folder' | 'doc' | 'file';

/** A row of the tree, without its text. */
export interface Row {
  id: string;
  /** null at the top. */
  parent: string | null;
  /** A folder's name, a document's without `.md`, a file's whole. */
  name: string;
  /** Its position among its siblings when one was chosen (`.ilmi/order.json` is a view of these); null follows the placed ones, by name. */
  place: number | null;
  kind: RowKind;
  /** Bytes of what it holds: its text, or its blob. */
  size: number;
  /** Moves when its content is written; never on a rename or a move. */
  rev: number;
  /** The SHA-256 of the file it is, when it is kept beside the database. */
  blob: string | null;
}

export type Place = Pick<Row, 'id' | 'parent' | 'name' | 'place' | 'kind'>;

/** What a row holds: text (a document's front matter block and the rest), or a blob; `{}` is nothing. */
export interface Content {
  front?: string | null;
  text?: string | null;
  blob?: string | null;
}

/** A schedule as the store keeps it: `StateRow` with its attributes as JSON. */
export interface Sched {
  kind: string;
  item: string;
  key: string;
  attrs: string;
}

/** One line of the review log as a row: what it is found by, and the line itself as the log writes it. */
export interface ReviewRow {
  /** The file of `.ilmi/reviews/` it belongs to (`2026-10.jsonl`). */
  file: string;
  at: string;
  doc: string;
  card: string;
  key: string | null;
  g: number;
  line: string;
}

/** What goes with a document's text in the one transaction that writes it. */
export interface Lift {
  /** Its schedules: they replace the ones it had. */
  state: Sched[];
  /** The index's view of it, as JSON. */
  digest: string;
  /** The file as it came in, when the rows do not compose to it. */
  original: Original | null;
  /** The file's length in bytes, which is what the row's `size` says. */
  size: number;
  /** Lines for the review log: a grade's, written with the schedule it made. */
  reviews?: ReviewRow[];
}

/** A document as the store holds it. */
export interface DocContent {
  front: string;
  text: string;
  state: Sched[];
  original: Original | null;
}

/** The schema this code reads and writes; a collection below it is brought up when it opens (`storeFs`). */
export const STORE_VERSION = 2;

/** The rows and blobs of one collection. `tauri-store.ts` is the app's, `mem-store.ts` the tests'. */
export interface Store {
  /** The schema the collection was last written by. */
  version(): Promise<number>;
  setVersion(n: number): Promise<void>;
  /** Every row, without text. */
  rows(): Promise<Row[]>;
  /** A row's text: front matter block, then the rest. For a document, without its state. */
  text(id: string): Promise<string>;
  /** A document's text, its schedules, and the file it came in as when that is kept. */
  doc(id: string): Promise<DocContent>;
  /**
   * Write a row's place in the tree and, with `content`, what it holds.
   * Without it an existing row keeps its content and its `rev`. `lift`
   * goes with a document's text: its schedules, its index and its
   * original replaced in the same transaction; content without it clears
   * them. Text that comes out as it was is not written again: a grade
   * changes a schedule's row and the index, and the `rev`.
   */
  put(at: Place, content?: Content, lift?: Lift): Promise<Row>;
  /** Delete rows; what is under a deleted row goes with it. */
  remove(ids: string[]): Promise<void>;
  /** The order chosen: these rows' places, every other row's cleared. */
  places(set: [id: string, place: number][]): Promise<void>;
  /** The index, a page at a time by id: each document's digest. */
  digests(after: string | null, limit: number): Promise<[id: string, digest: Doc][]>;
  /** The review log's files and how many lines each holds. */
  reviewFiles(): Promise<[file: string, lines: number][]>;
  /** One file's lines in the order they were written; every line with `null`. */
  reviews(file: string | null): Promise<string[]>;
  /** Add lines to a file, or with `replace` make them all it holds. */
  reviewsPut(file: string, rows: ReviewRow[], replace: boolean): Promise<void>;
  /** The pairs said not the same. */
  same(): Promise<string[]>;
  samePut(pairs: string[]): Promise<void>;
  /** The files kept as they came in that are not documents: by their path under the collection. */
  originals(): Promise<[key: string, original: Original][]>;
  originalPut(key: string, original: Original | null): Promise<void>;
  blobPut(bytes: Uint8Array): Promise<{ hash: string; size: number }>;
  blobGet(hash: string): Promise<Uint8Array>;
}

/** A fresh row id: 128 random bits in hex. */
export function newId(): string {
  const b = new Uint8Array(16);
  if (globalThis.crypto?.getRandomValues) globalThis.crypto.getRandomValues(b);
  else for (let i = 0; i < b.length; i++) b[i] = Math.floor(Math.random() * 256);
  return [...b].map((x) => x.toString(16).padStart(2, '0')).join('');
}

/**
 * A document's text in two: its front matter block as written (the `---`
 * lines included, by the parser's rule for where it ends) and the rest.
 * `front + text` is the input, byte for byte.
 */
export function splitFront(input: string): { front: string; text: string } {
  const none = { front: '', text: input };
  const start = input.charCodeAt(0) === 0xfeff ? 1 : 0;
  const eol = (from: number): number => {
    const n = input.indexOf('\n', from);
    const r = input.indexOf('\r', from);
    if (r >= 0 && (n < 0 || r < n)) return r;
    return n;
  };
  const after = (at: number): number => (input[at] === '\r' && input[at + 1] === '\n' ? at + 2 : at + 1);
  let end = eol(start);
  if (end < 0 || !/^---[ \t]*$/.test(input.slice(start, end))) return none;
  for (let from = after(end); from <= input.length; ) {
    end = eol(from);
    const line = input.slice(from, end < 0 ? input.length : end);
    if (/^(---|\.\.\.)[ \t]*$/.test(line)) {
      const cut = end < 0 ? input.length : after(end);
      return { front: input.slice(0, cut), text: input.slice(cut) };
    }
    if (end < 0) break;
    from = after(end);
  }
  return none;
}

const docName = (seg: string): string | null => (seg.endsWith('.md') && seg.length > 3 ? seg.slice(0, -3) : null);
const fsName = (r: Row): string => (r.kind === 'doc' ? `${r.name}.md` : r.name);
const hidden = (rel: string): boolean => rel.split('/').some((s) => s.startsWith('.'));
/** The vault's temp name for a file being written (`vault.ts`): it is the file it will be. */
const TMP = '.ilmi-tmp';
const settled = (seg: string): string => (seg.endsWith(TMP) ? seg.slice(0, -TMP.length) : seg);

const encoder = new TextEncoder();
/** Strict: bytes that are not UTF-8 are not text, and a BOM is kept. */
const strict = new TextDecoder('utf-8', { fatal: true, ignoreBOM: true });
const lossy = new TextDecoder('utf-8', { ignoreBOM: true });

type At =
  | { kind: 'root' }
  /** The entry itself: a folder, a document (`x.md`), a file. */
  | { kind: 'row'; row: Row }
  /** A document's children directory (`x` for `x.md`). */
  | { kind: 'kids'; row: Row }
  /** Nothing there; `parent` is the row of the directory it would be in (null the top), undefined when that is missing too. */
  | { kind: 'none'; parent: Row | null | undefined; name: string };

/** The three files under `.ilmi/` that are views of tables, not rows. */
const SAME_PATH = '.ilmi/same.json';
const REVIEWS_PATH = '.ilmi/reviews';
type Virtual = { kind: 'order' } | { kind: 'same' } | { kind: 'reviews'; file: string };

function virtualOf(rel: string): Virtual | null {
  if (rel === ORDER_FILE) return { kind: 'order' };
  if (rel === SAME_PATH) return { kind: 'same' };
  if (rel.startsWith(`${REVIEWS_PATH}/`)) {
    const file = rel.slice(REVIEWS_PATH.length + 1);
    if (!file.includes('/') && file.endsWith('.jsonl')) return { kind: 'reviews', file };
  }
  return null;
}

/** A review as the log's row. */
export const reviewRow = (file: string, r: Review): ReviewRow => ({ file, at: r.at, doc: r.doc, card: r.card, key: r.key ?? null, g: r.g, line: formatReview(r) });

export interface StoreFs extends Fs {
  readonly store: Store;
  readonly atomic: true;
  /** The row a path names, when it names one: a folder, a document, a file. */
  rowAt(path: string): Promise<Row | null>;
  /** The index: every document's digest (`lift.ts`), by vault-relative path. Nothing is parsed. */
  digests(): Promise<Map<string, Doc>>;
  /** Told of each document as it is written: its path and its digest, or null when it is not text. Returns the unsubscribe. */
  onIndex(fn: (path: string, doc: Doc | null) => void): () => void;
  /** Lines for the review log that go into the same transaction as the next write of the document at `path` (vault-relative). */
  logWith(path: string, reviews: readonly Review[]): void;
  /** Whatever `logWith` left unwritten for `path` (no write followed), appended now. */
  flushLog(path: string): Promise<void>;
  /** How many lines the review log holds. */
  reviewCount(): Promise<number>;
}

const WATCH_DEBOUNCE_MS = 30;
const DIGEST_PAGE = 2000;

/** The `Fs` over `store` for the vault whose root path is `root` (the collection's own folder; nothing under it is read from disk). */
export function storeFs(store: Store, root: string): StoreFs {
  const rows = new Map<string, Row>();
  /** Children by parent id; the top's under `''`. */
  const kids = new Map<string, Set<string>>();
  const key = (parent: string | null): string => parent ?? '';

  const link = (r: Row): void => {
    const old = rows.get(r.id);
    if (old) kids.get(key(old.parent))?.delete(old.id);
    rows.set(r.id, r);
    let set = kids.get(key(r.parent));
    if (!set) kids.set(key(r.parent), (set = new Set()));
    set.add(r.id);
  };
  const unlink = (id: string): void => {
    const r = rows.get(id);
    if (!r) return;
    for (const c of [...(kids.get(id) ?? [])]) unlink(c);
    kids.delete(id);
    kids.get(key(r.parent))?.delete(id);
    rows.delete(id);
  };
  const childrenOf = (parent: string | null): Row[] => [...(kids.get(key(parent)) ?? [])].map((id) => rows.get(id)!);
  const hasKids = (r: Row): boolean => (kids.get(r.id)?.size ?? 0) > 0;
  const find = (parent: string | null, name: string): Row | undefined => childrenOf(parent).find((r) => fsName(r) === name);
  /** The row a path segment descends into: a folder of that name, or the document of that name (its children). */
  const dirRow = (parent: string | null, seg: string): Row | undefined =>
    childrenOf(parent).find((r) => r.name === seg && r.kind !== 'file');
  const under = (id: string | null, top: string): boolean => {
    for (let at = id; at !== null; at = rows.get(at)?.parent ?? null) if (at === top) return true;
    return false;
  };
  /** The directory a row's children are in, vault-relative: a folder's path, a document's without `.md`. */
  const dirPathOf = (r: Row): string => {
    const segs: string[] = [];
    for (let at: Row | undefined = r; at; at = at.parent === null ? undefined : rows.get(at.parent)) segs.unshift(at.name);
    return segs.join('/');
  };
  /** A row's own path, vault-relative. */
  const pathOf = (r: Row): string => {
    const dir = r.parent === null ? '' : dirPathOf(rows.get(r.parent)!);
    return dir ? `${dir}/${fsName(r)}` : fsName(r);
  };

  // ── the tables behind `.ilmi/` ─────────────────────────────────
  /** The pairs said not the same, as the table holds them. */
  let pairs: string[] = [];
  /** The review log's files, and how many lines each holds. */
  const logFiles = new Map<string, number>();
  /** The files kept as they came in, by vault-relative path. */
  const originals = new Map<string, Original>();

  const segsOf = (abs: string): string[] | null => {
    const rel = relative(root, abs);
    return rel === null ? null : rel.split('/').filter(Boolean);
  };

  const locate = (abs: string): At => {
    const segs = segsOf(abs);
    if (segs === null) return { kind: 'none', parent: undefined, name: abs };
    if (!segs.length) return { kind: 'root' };
    let cur: Row | null = null;
    for (const seg of segs.slice(0, -1)) {
      const next = dirRow(cur?.id ?? null, seg);
      if (!next) return { kind: 'none', parent: undefined, name: seg };
      cur = next;
    }
    const last = segs[segs.length - 1]!;
    const row = find(cur?.id ?? null, last);
    if (row) return { kind: 'row', row };
    const doc = childrenOf(cur?.id ?? null).find((r) => r.kind === 'doc' && r.name === last);
    if (doc) return { kind: 'kids', row: doc };
    return { kind: 'none', parent: cur, name: last };
  };

  // ── the watcher ────────────────────────────────────────────────
  const watchers = new Set<(paths: string[]) => void>();
  let queued = new Set<string>();
  let timer: ReturnType<typeof setTimeout> | null = null;
  const touched = (...paths: string[]): void => {
    if (!watchers.size) return;
    for (const p of paths) queued.add(p);
    timer ??= setTimeout(() => {
      timer = null;
      const out = [...queued];
      queued = new Set();
      for (const fn of [...watchers]) fn(out);
    }, WATCH_DEBOUNCE_MS);
  };

  const indexers = new Set<(path: string, doc: Doc | null) => void>();
  const indexed = (rel: string, doc: Doc | null): void => {
    for (const fn of [...indexers]) fn(rel, doc);
  };

  const put = async (at: Place, content?: Content, lift?: Lift): Promise<Row> => {
    const row = await store.put(at, content, lift);
    link(row);
    return row;
  };
  const drop = async (ids: string[]): Promise<void> => {
    if (!ids.length) return;
    await store.remove(ids);
    for (const id of ids) unlink(id);
  };
  const placeOf = (r: Row, patch: Partial<Place> = {}): Place => ({ id: r.id, parent: r.parent, name: r.name, place: r.place, kind: r.kind, ...patch });

  /** The folders of `segs`, made where they are missing. */
  const mkdirs = async (segs: string[], path: string): Promise<boolean> => {
    let cur: Row | null = null;
    let made = false;
    for (const seg of segs) {
      const next: Row | undefined = dirRow(cur?.id ?? null, seg);
      if (next) { cur = next; continue; }
      if (find(cur?.id ?? null, seg)) throw new Error(`${path}: not a directory`);
      cur = await put({ id: newId(), parent: cur?.id ?? null, name: seg, place: null, kind: 'folder' });
      made = true;
    }
    return made;
  };

  // ── a document in and out ──────────────────────────────────────
  /** Lines for the log waiting on a document's next write, by its path. */
  const pendingLog = new Map<string, Review[]>();
  const fileOf = (r: Review): string => `${r.at.slice(0, 7)}.jsonl`;

  /** What `data` is stored as at vault-relative `rel`: a document's text taken apart, a hidden file's text in its row, anything else a blob. */
  const contentFor = async (rel: string, isDoc: boolean, data: string | Uint8Array, asText = false): Promise<{ content: Content; lift?: Lift; doc?: Doc }> => {
    if (isDoc || asText || hidden(rel)) {
      let text: string | null = null;
      if (typeof data === 'string') text = data;
      else {
        try { text = strict.decode(data); } catch { text = null; }
      }
      if (text !== null && !isDoc) return { content: { front: null, text } };
      if (text !== null) {
        const d = decompose(text);
        const lift: Lift = {
          state: d.state.map((r) => ({ kind: r.kind, item: r.item, key: r.key, attrs: JSON.stringify(r.attrs) })),
          digest: d.digest,
          original: d.original,
          size: typeof data === 'string' ? encoder.encode(text).length : data.length,
        };
        return { content: splitFront(d.bare), lift, doc: d.doc };
      }
    }
    const bytes = typeof data === 'string' ? encoder.encode(data) : data;
    return { content: { blob: (await store.blobPut(bytes)).hash } };
  };

  /** A document's file: its text and its rows put together (`lift.ts`). */
  const docText = async (r: Row): Promise<string> => {
    const c = await store.doc(r.id);
    const state: StateRow[] = c.state.map((s) => ({ kind: s.kind as StateRow['kind'], item: s.item, key: s.key, attrs: JSON.parse(s.attrs) as StateRow['attrs'] }));
    return recompose(c.front + c.text, state, c.original);
  };
  const textOf = (r: Row): Promise<string> => (r.kind === 'doc' ? docText(r) : store.text(r.id));
  const bytesOf = async (r: Row): Promise<Uint8Array> => (r.blob !== null ? store.blobGet(r.blob) : encoder.encode(await textOf(r)));

  /** Write a row with what `data` is stored as; a document's index and the log lines waiting on it go in the same transaction. */
  const store_ = async (at: Place, rel: string, data: string | Uint8Array): Promise<Row> => {
    const { content, lift, doc } = await contentFor(rel, at.kind === 'doc', data);
    const waiting = lift ? pendingLog.get(rel) : undefined;
    if (lift && waiting?.length) lift.reviews = waiting.map((r) => reviewRow(fileOf(r), r));
    const row = await put(at, content, lift);
    if (lift?.reviews) {
      pendingLog.delete(rel);
      // the log's directory is there for whoever lists it
      await mkdirs(REVIEWS_PATH.split('/'), REVIEWS_PATH);
      for (const r of lift.reviews) {
        logFiles.set(r.file, (logFiles.get(r.file) ?? 0) + 1);
        originals.delete(`${REVIEWS_PATH}/${r.file}`);
        touched(join(root, `${REVIEWS_PATH}/${r.file}`));
      }
    }
    if (at.kind === 'doc') indexed(rel, doc ? digest(doc) : null);
    return row;
  };

  // ── `.ilmi/order.json`, `same.json`, `reviews/*.jsonl` ─────────
  const orderNow = (): string => {
    const out: Order = {};
    const dirs: [string, Row[]][] = [];
    for (const [parent, ids] of kids) {
      const placed = [...ids].map((id) => rows.get(id)!).filter((r) => r.place !== null && r.kind !== 'file');
      if (!placed.length) continue;
      dirs.push([parent === '' ? '' : dirPathOf(rows.get(parent)!), placed.sort((a, b) => a.place! - b.place! || (a.name < b.name ? -1 : 1))]);
    }
    for (const [dir, placed] of dirs.sort((a, b) => (a[0] < b[0] ? -1 : a[0] > b[0] ? 1 : 0))) out[dir] = placed.map((r) => (r.kind === 'doc' ? `${r.name}.md` : `${r.name}/`));
    return Object.keys(out).length ? `${JSON.stringify(out, null, 2)}\n` : '';
  };
  /** The places an order file asks for, of the rows it names that are here. */
  const placesOf = (text: string): [string, number][] => {
    let order: Order = {};
    try { order = cleanOrder(JSON.parse(text)); } catch { /* a file that does not read orders nothing */ }
    const out: [string, number][] = [];
    for (const [dir, names] of Object.entries(order)) {
      let parent: Row | null = null;
      let ok = true;
      for (const seg of dir.split('/').filter(Boolean)) {
        const next = dirRow(parent?.id ?? null, seg);
        if (!next) { ok = false; break; }
        parent = next;
      }
      if (!ok) continue;
      names.forEach((name, i) => {
        const row = name.endsWith('/')
          ? childrenOf(parent?.id ?? null).find((r) => r.kind === 'folder' && r.name === name.slice(0, -1))
          : name.endsWith('.md') ? childrenOf(parent?.id ?? null).find((r) => r.kind === 'doc' && r.name === name.slice(0, -3)) : undefined;
        if (row) out.push([row.id, i]);
      });
    }
    return out;
  };
  const setPlaces = async (set: [string, number][]): Promise<boolean> => {
    const want = new Map(set);
    let differs = false;
    for (const r of rows.values()) if ((want.get(r.id) ?? null) !== r.place) { differs = true; break; }
    if (!differs) return false;
    await store.places([...want]);
    for (const r of rows.values()) r.place = want.get(r.id) ?? null;
    return true;
  };
  const sameNow = (): string => (pairs.length ? `${JSON.stringify({ not: [...pairs].sort() }, null, 2)}\n` : '');
  const keep = async (rel: string, text: string, composed: string): Promise<void> => {
    const original = composed === text ? null : { text, stamp: stampOf(composed) };
    if (!original && !originals.has(rel)) return;
    await store.originalPut(rel, original);
    if (original) originals.set(rel, original); else originals.delete(rel);
  };

  /** A view's text, or null when there is no such file. */
  const virtualText = async (rel: string, v: Virtual): Promise<string | null> => {
    const was = originals.get(rel);
    if (v.kind === 'reviews') {
      // a log file kept as it came in is dropped by the first line added to it
      if (was) return was.text;
      if (!logFiles.get(v.file)) return null;
      return `${(await store.reviews(v.file)).join('\n')}\n`;
    }
    if (v.kind === 'order' && was && stampOf(orderNow()) === was.stamp) {
      // the file may have come in before the rows it orders: it is read again now that they may be here
      if (await setPlaces(placesOf(was.text))) await keep(rel, was.text, orderNow());
      return was.text;
    }
    const text = v.kind === 'order' ? orderNow() : sameNow();
    if (was && stampOf(text) === was.stamp) return was.text;
    return text || null;
  };

  const virtualWrite = async (rel: string, v: Virtual, data: string | Uint8Array): Promise<void> => {
    const text = typeof data === 'string' ? data : lossy.decode(data);
    if (v.kind === 'order') {
      await setPlaces(placesOf(text));
      await keep(rel, text, orderNow());
    } else if (v.kind === 'same') {
      let next: string[] = [];
      try {
        const not = (JSON.parse(text) as { not?: unknown } | null)?.not;
        if (Array.isArray(not)) next = [...new Set(not.filter((k): k is string => typeof k === 'string'))];
      } catch { /* a file that does not read names no pair */ }
      await store.samePut(next);
      pairs = next;
      await keep(rel, text, sameNow());
    } else {
      const list = parseReviews(text);
      await store.reviewsPut(v.file, list.map((r) => reviewRow(v.file, r)), true);
      if (list.length) logFiles.set(v.file, list.length); else logFiles.delete(v.file);
      await keep(rel, text, list.length ? `${list.map(formatReview).join('\n')}\n` : '');
    }
  };

  const virtualRemove = async (rel: string, v: Virtual): Promise<void> => {
    if (v.kind === 'order') await setPlaces([]);
    else if (v.kind === 'same') { await store.samePut([]); pairs = []; }
    else { await store.reviewsPut(v.file, [], true); logFiles.delete(v.file); }
    if (originals.has(rel)) { await store.originalPut(rel, null); originals.delete(rel); }
  };

  /** The views a directory lists beside its rows. */
  const virtualNames = async (rel: string): Promise<string[]> => {
    const out: string[] = [];
    if (rel === '.ilmi') {
      for (const p of [ORDER_FILE, SAME_PATH]) if ((await virtualText(p, virtualOf(p)!)) !== null) out.push(p.slice('.ilmi/'.length));
    } else if (rel === REVIEWS_PATH) {
      const names = new Set<string>([...logFiles].filter(([, n]) => n > 0).map(([f]) => f));
      for (const k of originals.keys()) if (k.startsWith(`${REVIEWS_PATH}/`)) names.add(k.slice(REVIEWS_PATH.length + 1));
      out.push(...names);
    }
    return out;
  };

  /**
   * A collection written before the state had tables: every document taken
   * apart, the three files under `.ilmi/` lifted. Each step leaves the
   * collection readable and can be made again, so one cut short is
   * finished by the next open: a document is read as its text and rows
   * together (one not yet taken apart has no rows), and a file's row goes
   * only once the tables hold it.
   */
  const upgrade = async (): Promise<void> => {
    for (const r of [...rows.values()]) {
      if (r.kind !== 'doc' || r.blob !== null) continue;
      const { content, lift } = await contentFor(pathOf(r), true, await docText(r));
      await put(placeOf(r), content, lift);
    }
    for (const r of [...rows.values()]) {
      if (r.kind !== 'file' || r.blob !== null) continue;
      const rel = pathOf(r);
      const v = virtualOf(rel);
      if (!v) continue;
      await virtualWrite(rel, v, await store.text(r.id));
      await drop([r.id]);
    }
  };

  const ready: Promise<void> = (async () => {
    for (const r of await store.rows()) link(r);
    const version = await store.version();
    if (version > STORE_VERSION) throw new Error('this collection was written by a newer ilmi');
    for (const [k, o] of await store.originals()) originals.set(k, o);
    for (const [f, n] of await store.reviewFiles()) logFiles.set(f, n);
    pairs = await store.same();
    if (version < STORE_VERSION) {
      await upgrade();
      await store.setVersion(STORE_VERSION);
    }
  })();

  // ── writes, one at a time ──────────────────────────────────────
  let chain: Promise<unknown> = ready.catch(() => {});
  const serial = <T>(fn: () => Promise<T>): Promise<T> => {
    const run = chain.then(() => ready).then(fn);
    chain = run.catch(() => {});
    return run;
  };

  /** The row at (`parent`, `seg`) holding `data`, new or taking the place of a folder of the document's name. */
  const create = async (parent: Row | null, seg: string, rel: string, data: string | Uint8Array): Promise<Row> => {
    const doc = docName(seg);
    const pid = parent?.id ?? null;
    if (doc !== null) {
      const folder = dirRow(pid, doc);
      // `a/` was there first: it is this document now, its children the document's
      if (folder?.kind === 'folder') return store_(placeOf(folder, { kind: 'doc' }), rel, data);
    }
    return store_({ id: newId(), parent: pid, name: doc ?? seg, place: null, kind: doc !== null ? 'doc' : 'file' }, rel, data);
  };

  const writeInner = async (abs: string, data: string | Uint8Array): Promise<void> => {
    const rel = relative(root, abs) ?? '';
    const at = locate(abs);
    const v = virtualOf(rel);
    if (v && at.kind !== 'row') {
      const text = typeof data === 'string' ? data : (() => { try { return strict.decode(data); } catch { return null; } })();
      // bytes that are not text stay a file of their own, as before
      if (text !== null) {
        await mkdirs(rel.split('/').slice(0, -1), abs);
        await virtualWrite(rel, v, text);
        return;
      }
    }
    if (at.kind === 'root' || at.kind === 'kids' || (at.kind === 'row' && at.row.kind === 'folder')) throw new Error(`${abs}: is a directory`);
    if (at.kind === 'row') {
      await store_(placeOf(at.row), rel, data);
    } else {
      if (at.parent === undefined) throw new Error(`${abs}: no such directory`);
      const seg = settled(at.name);
      // a temp name keeps its own name; it becomes the file on the rename
      if (seg === at.name) await create(at.parent, seg, rel, data);
      else {
        // a document on its way in is text, not yet taken apart
        const { content } = await contentFor(rel, false, data, docName(seg) !== null);
        await put({ id: newId(), parent: at.parent?.id ?? null, name: at.name, place: null, kind: 'file' }, content);
      }
    }
  };

  const write = (abs: string, data: string | Uint8Array): Promise<void> =>
    serial(async () => {
      await writeInner(abs, data);
      touched(abs);
    });

  /** A document's row gone: with children it stays as their folder. */
  const dropDoc = async (r: Row): Promise<void> => {
    if (hasKids(r)) await put(placeOf(r, { kind: 'folder' }), {});
    else await drop([r.id]);
  };

  const removeInner = async (path: string): Promise<void> => {
    const rel = relative(root, path) ?? '';
    const at = locate(path);
    const v = virtualOf(rel);
    if (v && at.kind !== 'row') { await virtualRemove(rel, v); return; }
    if (at.kind === 'none') return;
    if (at.kind === 'root') throw new Error(`${path}: the collection itself`);
    // the views under a directory go with it
    if (at.kind === 'row' && at.row.kind === 'folder' && (rel === '.ilmi' || rel === REVIEWS_PATH)) {
      for (const dir of rel === '.ilmi' ? ['.ilmi', REVIEWS_PATH] : [REVIEWS_PATH]) {
        for (const name of await virtualNames(dir)) await virtualRemove(`${dir}/${name}`, virtualOf(`${dir}/${name}`)!);
      }
    }
    if (at.kind === 'kids') await drop(childrenOf(at.row.id).map((r) => r.id));
    else if (at.row.kind === 'doc') await dropDoc(at.row);
    else await drop([at.row.id]);
  };

  const readInner = async (path: string): Promise<{ text: string } | { bytes: Uint8Array }> => {
    const rel = relative(root, path) ?? '';
    const at = locate(path);
    const v = virtualOf(rel);
    if (v && at.kind !== 'row') {
      const text = await virtualText(rel, v);
      if (text === null) throw new Error(`${path}: no such file`);
      return { text };
    }
    if (at.kind !== 'row' || at.row.kind === 'folder') throw new Error(`${path}: no such file`);
    return at.row.blob !== null ? { bytes: await store.blobGet(at.row.blob) } : { text: await textOf(at.row) };
  };

  return {
    store,
    atomic: true,

    async rowAt(path) {
      await ready;
      const at = locate(path);
      return at.kind === 'row' ? at.row : null;
    },

    async digests() {
      await ready;
      const out = new Map<string, Doc>();
      for (let after: string | null = null; ; ) {
        const page = await store.digests(after, DIGEST_PAGE);
        for (const [id, doc] of page) {
          const r = rows.get(id);
          if (r?.kind === 'doc') out.set(pathOf(r), doc);
        }
        if (page.length < DIGEST_PAGE) break;
        after = page[page.length - 1]![0];
      }
      return out;
    },

    onIndex(fn) {
      indexers.add(fn);
      return () => { indexers.delete(fn); };
    },

    logWith(path, reviews) {
      if (reviews.length) pendingLog.set(path, [...reviews]);
      else pendingLog.delete(path);
    },

    flushLog: (path) =>
      serial(async () => {
        const waiting = pendingLog.get(path);
        pendingLog.delete(path);
        if (!waiting?.length) return;
        const byFile = new Map<string, Review[]>();
        for (const r of waiting) byFile.set(fileOf(r), [...(byFile.get(fileOf(r)) ?? []), r]);
        await mkdirs(REVIEWS_PATH.split('/'), REVIEWS_PATH);
        for (const [file, list] of byFile) {
          await store.reviewsPut(file, list.map((r) => reviewRow(file, r)), false);
          logFiles.set(file, (logFiles.get(file) ?? 0) + list.length);
          originals.delete(`${REVIEWS_PATH}/${file}`);
          touched(join(root, `${REVIEWS_PATH}/${file}`));
        }
      }),

    async reviewCount() {
      await ready;
      let n = 0;
      for (const k of logFiles.values()) n += k;
      return n;
    },

    async readDir(path): Promise<FsEntry[]> {
      await ready;
      const at = locate(path);
      const parent = at.kind === 'root' ? null : at.kind === 'kids' ? at.row.id : at.kind === 'row' && at.row.kind === 'folder' ? at.row.id : undefined;
      if (parent === undefined) throw new Error(`${path}: no such directory`);
      const out: FsEntry[] = [];
      for (const r of childrenOf(parent)) {
        out.push({ name: fsName(r), isDir: r.kind === 'folder', isFile: r.kind !== 'folder' });
        if (r.kind === 'doc' && hasKids(r)) out.push({ name: r.name, isDir: true, isFile: false });
      }
      const have = new Set(out.map((e) => e.name));
      for (const name of await virtualNames(relative(root, path) ?? '')) if (!have.has(name)) out.push({ name, isDir: false, isFile: true });
      return out;
    },

    async stat(path): Promise<FsStat | null> {
      await ready;
      const at = locate(path);
      if (at.kind === 'root') return { mtimeMs: 0, size: 0, isDir: true };
      if (at.kind === 'kids') return hasKids(at.row) ? { mtimeMs: 0, size: 0, isDir: true } : null;
      if (at.kind === 'none') {
        const rel = relative(root, path) ?? '';
        const v = virtualOf(rel);
        if (!v) return null;
        // a view has no stamp of its own; nothing compares one
        if (v.kind === 'reviews') return logFiles.get(v.file) || originals.has(rel) ? { mtimeMs: 0, size: 0, isDir: false } : null;
        return (await virtualText(rel, v)) !== null ? { mtimeMs: 0, size: 0, isDir: false } : null;
      }
      if (at.row.kind === 'folder') return { mtimeMs: 0, size: 0, isDir: true };
      return { mtimeMs: at.row.rev, size: at.row.size, isDir: false };
    },

    async readText(path) {
      await ready;
      const got = await readInner(path);
      return 'text' in got ? got.text : lossy.decode(got.bytes);
    },

    async readBytes(path) {
      await ready;
      const got = await readInner(path);
      return 'text' in got ? encoder.encode(got.text) : got.bytes;
    },

    writeText: (path, text) => write(path, text),
    writeBytes: (path, bytes) => write(path, bytes),

    appendText: (path, text) =>
      serial(async () => {
        const rel = relative(root, path) ?? '';
        const v = virtualOf(rel);
        if (v?.kind === 'reviews' && locate(path).kind !== 'row') {
          // a file kept as it came in holds lines the rows may not: it is read as rows from here on
          const list = parseReviews(text);
          await mkdirs(rel.split('/').slice(0, -1), path);
          if (list.length) {
            await store.reviewsPut(v.file, list.map((r) => reviewRow(v.file, r)), false);
            logFiles.set(v.file, (logFiles.get(v.file) ?? 0) + list.length);
          }
          if (originals.has(rel)) { await store.originalPut(rel, null); originals.delete(rel); }
        } else {
          const at = locate(path);
          const was = at.kind === 'row' && at.row.kind !== 'folder' ? await textOf(at.row) : '';
          await writeInner(path, was && !was.endsWith('\n') ? `${was}\n${text}` : `${was}${text}`);
        }
        touched(path);
      }),

    mkdir: (path) =>
      serial(async () => {
        const segs = segsOf(path);
        if (segs === null) throw new Error(`${path}: outside the collection`);
        if (await mkdirs(segs, path)) touched(path);
      }),

    remove: (path) =>
      serial(async () => {
        await removeInner(path);
        touched(path);
      }),

    rename: (from, to) =>
      serial(async () => {
        if (from === to) return;
        // a view on either side: what one holds is written as the other
        const fromRel = relative(root, from) ?? '';
        const toRel = relative(root, to) ?? '';
        if ((virtualOf(fromRel) && locate(from).kind !== 'row') || (virtualOf(toRel) && locate(to).kind === 'none')) {
          const got = await readInner(from);
          await writeInner(to, 'text' in got ? got.text : got.bytes);
          await removeInner(from);
          touched(from, to);
          return;
        }
        const a = locate(from);
        if (a.kind === 'root' || a.kind === 'none') throw new Error(`${from}: no such file`);
        let b = locate(to);
        if (b.kind === 'root') throw new Error(`${to}: the collection itself`);
        if (b.kind === 'none' && b.parent === undefined) throw new Error(`${to}: no such directory`);
        const toSegs = segsOf(to)!;
        const seg = toSegs[toSegs.length - 1]!;
        // a document without children has no children directory: the name is free
        if (b.kind === 'kids' && !hasKids(b.row) && a.kind === 'row' && a.row.kind !== 'folder') b = { kind: 'none', parent: b.row.parent === null ? null : rows.get(b.row.parent)!, name: seg };

        /** Everything under `src` moved under `dest`. */
        const adopt = async (src: Row, dest: Row): Promise<void> => {
          if (under(dest.id, src.id)) throw new Error(`${to}: inside ${from}`);
          for (const c of childrenOf(src.id)) await put(placeOf(c, { parent: dest.id }));
        };

        if (a.kind === 'kids' || a.row.kind === 'folder') {
          // a directory: a folder's row, or what a document has under it
          const src = a.row;
          if (b.kind === 'row' && b.row.kind !== 'folder') throw new Error(`${to}: not a directory`);
          if ((b.kind === 'row' || b.kind === 'kids') && hasKids(b.row)) throw new Error(`${to}: already exists`);
          if (b.kind === 'none') {
            if (under(b.parent?.id ?? null, src.id)) throw new Error(`${to}: inside ${from}`);
            if (a.kind === 'row') await put(placeOf(src, { parent: b.parent?.id ?? null, name: seg }));
            else await adopt(src, await put({ id: newId(), parent: b.parent?.id ?? null, name: seg, place: null, kind: 'folder' }));
          } else {
            await adopt(src, b.row);
            if (a.kind === 'row') await drop([src.id]);
          }
        } else {
          const src = a.row;
          if (b.kind === 'row' && b.row.kind === 'folder') throw new Error(`${to}: is a directory`);
          if (b.kind === 'kids') throw new Error(`${to}: already exists`);
          if (b.kind === 'row') {
            // onto a file that is there: it holds what the source held, under its own id
            if (b.row.id === src.id) return;
            await store_(placeOf(b.row), toRel, await bytesOf(src));
            if (src.kind === 'doc') await dropDoc(src); else await drop([src.id]);
          } else {
            const parent = b.parent ?? null;
            if (under(parent?.id ?? null, src.id)) throw new Error(`${to}: inside ${from}`);
            const doc = docName(seg);
            const kind: RowKind = doc !== null ? 'doc' : 'file';
            const name = doc ?? seg;
            const folder = doc !== null ? dirRow(parent?.id ?? null, doc) : undefined;
            // the content changes shape only when the kind or the place asks: a move keeps the row's `rev`
            const reshape = src.kind !== kind || (src.blob === null && kind === 'file' && !hidden(toRel));
            if (src.kind === 'doc' && kind === 'file' && hasKids(src)) {
              // the children stay where they were, as a folder
              await store_({ id: newId(), parent: parent?.id ?? null, name, place: null, kind }, toRel, await bytesOf(src));
              await dropDoc(src);
            } else {
              const at = placeOf(src, { parent: parent?.id ?? null, name, kind });
              const moved = reshape ? await store_(at, toRel, await bytesOf(src)) : await put(at);
              // a folder of the document's name where it lands is the document's from now on
              if (folder?.kind === 'folder' && folder.id !== moved.id) {
                await adopt(folder, moved);
                await drop([folder.id]);
              }
            }
          }
        }
        touched(from, to);
      }),

    async watch(_path, onChange) {
      await ready;
      watchers.add(onChange);
      return () => {
        watchers.delete(onChange);
        if (!watchers.size && timer) { clearTimeout(timer); timer = null; queued = new Set(); }
      };
    },
  };
}
