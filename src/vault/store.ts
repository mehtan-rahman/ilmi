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
// - A place is a number that sorts a row among its siblings, not its
//   index (milestone 62): an order written moves only the rows that
//   changed their place among the others, each to a number between its
//   new neighbours, so two orders of one directory written on two devices
//   merge row by row.
// - A folder made where a document of that name then lands (`a/` before
//   `a.md`, as a restore writes them) becomes that document; a document
//   removed while it has children leaves them as a folder.
// - Writes are whole (`atomic`), so the vault writes in place.
// - `watch` reports this `Fs`'s own writes, a moment later, as a directory
//   watcher reports an app's own, and a merge's the same way.
// - Since milestone 61 a collection that syncs has an engine
//   (`src/sync/engine.ts`). It is told of each write before it is made
//   (`Recorder`) and gives back what goes into the same transaction: the
//   registers the write won, the change for the other devices. What other
//   devices changed comes in through `door`, as rows written and removed
//   in one transaction, the tree, the index and the watchers told.
// - A row under a dot-directory is named by its path (`hiddenId`): two
//   devices that each make `.ilmi/reviews` have made one row. Where two
//   rows have one name in one place (two devices each made `notes.md`),
//   the engine shows the one whose id sorts later as `notes 2` (milestone
//   62); until it has, the one whose id sorts first is the one a path
//   finds.
// - Since milestone 63 a file a row names need not be here: a collection
//   that keeps only what it has opened knows a PDF by its hash and size
//   until a read of it asks the storage for its bytes (`door.fetcher`).
//   `away` says which paths those are; `pieces` reads a big file a piece
//   at a time and `take` brings one in from disk, neither through the
//   renderer's memory; `ref` and `writeRef` move one by its name alone.
// - Since milestone 58 a page of ink is strokes, not a file: a row named
//   `ink-01.pkdrawing` that holds no blob, and its strokes rows of the
//   store's `ink`, each found by a name that outlives a save (`ink`,
//   `setInk`). Read as a file it is the drawing PencilKit makes of them,
//   and beside it, under the same name, is `ink-01.png`, the picture
//   made of them: no row, there while the page is. So a note's image and
//   an export read both files and neither is kept or merged. A
//   `.pkdrawing` that came in as a file (an import) is a file like any
//   other until it is drawn on.
// - Since milestone 67 a book's page may be written on. Those strokes are
//   found by the PDF's SHA-256 and the page's number in it (`pageKey`),
//   not by a row: they are the file's by what it is, on whatever row
//   names it. So nothing is written into the PDF, two rows that name one
//   PDF show one writing, and deleting a row takes no stroke: a book
//   deleted and put back, or brought in again, has what was written on
//   it (`pageInk`, `setPageInk`, `pageInkFile`, `inkedPages`). No path
//   names them and an export does not write them.
// - Since milestone 68 a document's text and its cards can be searched
//   (`search.ts`, `search`). The rows go with the document's write, so a
//   merge brings them as a local write does; they are found by the row's
//   id, so a rename leaves them; a delete takes them. They are this
//   device's: the engine is never told, and each device makes its own.
//   A collection from before them is walked a page at a time, the app
//   open meanwhile (`searchBuild`); it goes on from where it stopped.

import { formatReview, parse, parseReviews, serialize, type Doc, type Review } from '../format/index.js';
import type { Fs, FsEntry, FsStat } from './fs.js';
import { join, relative } from './fs.js';
import { decompose, digest, recompose, stampOf, type Decomposed, type Original, type StateRow } from './lift.js';
import { ORDER_FILE, cleanOrder, type Order } from './order.js';
import { searchQuery, searchRows, type SearchRow } from './search.js';
import { byName, isPdfPath } from './walk.js';

export type RowKind = 'folder' | 'doc' | 'file';

/** A row of the tree, without its text. */
export interface Row {
  id: string;
  /** null at the top. */
  parent: string | null;
  /** A folder's name, a document's without `.md`, a file's whole. */
  name: string;
  /** Where it sorts among its siblings when a place was chosen (`.ilmi/order.json` is a view of these): a number, not an index; null follows the placed ones, by name. */
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
  /** Its rows of the search index: they replace the ones it had when its text changed. */
  search?: SearchRow[];
}

/** A block the search index found, in the document whose row is `doc`. */
export interface SearchHit {
  doc: string;
  block: number;
  kind: SearchRow['kind'];
  card: string | null;
  text: string;
}

/** A block found, by the path of its document. */
export type TextHit = Omit<SearchHit, 'doc'> & { path: string };

/** A document as the store holds it. */
export interface DocContent {
  front: string;
  text: string;
  state: Sched[];
  original: Original | null;
}

/** The schema this code reads and writes; a collection below it is brought up when it opens (`storeFs`). 3 is the engine's tables (milestone 61), 4 the strokes' (milestone 58), 5 the search index's (milestone 68), all made by the Rust side as it opens. */
export const STORE_VERSION = 5;

/** One stroke of a page of ink (milestone 58): its name, when it was drawn (seconds since 1970: the order strokes lie in), and its bytes in base64 (a `PKDrawing` of it alone). */
export interface InkStroke {
  stroke: string;
  at: number;
  data: string;
}

/** What a page of ink's row is named by, and its picture beside it. */
export const INK_EXT = '.pkdrawing';
export const inkPicture = (name: string): string => `${name.slice(0, -INK_EXT.length)}.png`;
const inkOfPicture = (name: string): string | null => (name.endsWith('.png') ? `${name.slice(0, -4)}${INK_EXT}` : null);
/** A page of ink: a file's row of that name that holds no blob. Its strokes are the store's. */
export const isInk = (r: Pick<Row, 'kind' | 'blob' | 'name'>): boolean => r.kind === 'file' && r.blob === null && r.name.endsWith(INK_EXT);

/** What the strokes written on a book's page are found by (milestone 67): the PDF's SHA-256 and the page's number in that file. No row has such an id. */
export const BOOK_PAGE = 'p.';
export const pageKey = (hash: string, page: number): string => `${BOOK_PAGE}${hash}.${page}`;
/** Whether strokes found by `page` are a book's page's, and not a row's. */
export const isBookPage = (page: string): boolean => page.startsWith(BOOK_PAGE);
/** The PDF and the page a key names; null for anything else. */
export function bookPageOf(key: string): { hash: string; page: number } | null {
  const m = /^p\.([0-9a-f]+)\.(\d+)$/.exec(key);
  return m ? { hash: m[1]!, page: Number(m[2]) } : null;
}

/** A register (milestone 61): a field's value, and the stamp of the write that won it. */
export interface Reg {
  key: string;
  stamp: string;
  value: string | null;
}

/** One write of a batch: the store's own writes, and the engine's record of them. */
export type StoreOp =
  | { op: 'put'; at: Place; content?: Content; lift?: Lift }
  | { op: 'remove'; ids: string[] }
  | { op: 'places'; set: [id: string, place: number][] }
  /** `add` the lines, `replace` the file's with them, or `union`: a line the file holds is not added again. */
  | { op: 'reviews'; file: string; rows: ReviewRow[]; mode: 'add' | 'replace' | 'union' }
  | { op: 'same'; pairs: string[] }
  | { op: 'original'; key: string; original: Original | null }
  | { op: 'meta'; key: string; value: string | null }
  | { op: 'regs'; set: Reg[] }
  /** A document's text as the text library keeps it, in base64. */
  | { op: 'crdt'; doc: string; state: string | null }
  | { op: 'out'; seq: number; data: string }
  | { op: 'outDrop'; upTo: number }
  /** A blob a row of this batch names, by hash and size, whether or not its bytes are here. */
  | { op: 'expect'; hash: string; size: number }
  /** Strokes added to a page of ink and taken from it; the page's row comes back with the `put`s'. */
  | { op: 'ink'; page: string; add: InkStroke[]; remove: string[] }
  /** A document's rows of the search index, in place of the ones it has. */
  | { op: 'search'; doc: string; rows: SearchRow[] }
  /** The walk has been through every document up to `after`; null: through them all. */
  | { op: 'searchWalked'; after: string | null };

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
  /** The blocks holding `phrase` as written and then every one of `words` anywhere, folded both, `limit` at most. */
  search(phrase: string, words: string[], limit: number): Promise<SearchHit[]>;
  /** How far the walk of a collection from before the index has come. */
  searchState(): Promise<{ done: boolean; after: string | null }>;
  /** The documents after `after`, by id, each with its text without its state. */
  searchWalk(after: string | null, limit: number): Promise<[id: string, text: string][]>;
  /** The review log's files and how many lines each holds. */
  reviewFiles(): Promise<[file: string, lines: number][]>;
  /** One file's lines by their instant, then by the line itself (the same order on every device); every line with `null`. */
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
  /** Whether a blob's bytes are here: a row may name one that has not come from the storage yet. */
  blobHas(hash: string): Promise<boolean>;
  /** The blobs rows name whose bytes are not here, each with its size. */
  blobsAway(): Promise<[hash: string, size: number][]>;
  /** A page of ink's strokes, in the order they were drawn. */
  ink(page: string): Promise<InkStroke[]>;
  /** A drawing taken apart into its strokes, as a canvas's is (an import's `.ilmi/ink/`). */
  inkSplit(drawing: Uint8Array): Promise<InkStroke[]>;
  /** A page of ink as a file, made from its strokes: the drawing PencilKit opens, or a PNG of them (empty when there are none). */
  inkFile(page: string, what: 'drawing' | 'picture'): Promise<Uint8Array>;
  /** The pages that hold strokes and whose name starts with `prefix`, in order. */
  inkPages(prefix: string): Promise<string[]>;
  /** The writing on a book's page, made from its strokes: the drawing the canvas opens, or a PNG of the whole page, `w` by `h` points, on nothing. */
  inkPage(page: string, what: 'drawing' | 'picture', w: number, h: number): Promise<Uint8Array>;
  /** A file on disk taken in as a blob without its bytes passing through here. The app's only. */
  blobTake?(path: string): Promise<{ hash: string; size: number }>;
  /** The bytes of a blob from `begin` up to `end`. The app's only. */
  blobRange?(hash: string, begin: number, end: number): Promise<Uint8Array>;
  /** Several writes as one transaction: all, or none. The rows the `put`s wrote, as they are after it, in order. */
  batch(ops: StoreOp[]): Promise<Row[]>;
  /** The engine's own keys and values. */
  meta(): Promise<[key: string, value: string][]>;
  /** The registers of these keys that there are. */
  regs(keys: string[]): Promise<Reg[]>;
  /** Every register whose key starts with one of `prefixes`. */
  regsUnder(prefixes: string[]): Promise<Reg[]>;
  /** Every register after the key `after`, by key, `limit` at most: a snapshot reads them all. */
  regsPage(after: string | null, limit: number): Promise<Reg[]>;
  /** A document's text as the text library keeps it, in base64; null when it keeps none. */
  crdt(doc: string): Promise<string | null>;
  /** The changes waiting to be written to the storage, after `after`, in order: as many as fit in `bytes`, one at least. */
  outbox(after: number, bytes: number): Promise<[seq: number, data: string][]>;
  outboxCount(): Promise<number>;
}

/** What the engine is told of a write before it is made; what it answers goes into the write's transaction. Nothing, for a collection that does not sync. */
export interface Recorder {
  put(w: { at: Place; before: Row | undefined; rel: string; content: Content | undefined; lift: Lift | undefined; size?: number }): Promise<StoreOp[]>;
  remove(gone: { row: Row; rel: string }[]): Promise<StoreOp[]>;
  /** The rows an order written gave another place. `kept`: the row is where it was shown, and only now has a number for it. */
  places(changed: [id: string, place: number | null, kept: boolean][]): Promise<StoreOp[]>;
  reviews(rows: ReviewRow[]): Promise<StoreOp[]>;
  same(added: string[], removed: string[]): Promise<StoreOp[]>;
  /** Strokes added to the page at `rel` and taken from it; a book's page (`isBookPage`) is at no path, and `rel` is empty. */
  ink(page: string, rel: string, add: InkStroke[], remove: string[]): Promise<StoreOp[]>;
  /** Whether a row is deleted and shown only for what is under it: it goes when nothing is. */
  dead(id: string): Promise<boolean>;
}

/** What a merge writes to the tree. */
export interface ViewWrite {
  /** Rows as they are now, a parent before its children. `file` is a document's whole text, taken apart here; `content` what any other row holds; neither keeps what the row has. */
  puts: { at: Place; file?: string; content?: Content }[];
  removes: string[];
  /** Lines for the review log, by file: a line a file holds is not added again. */
  reviews: { file: string; rows: ReviewRow[] }[];
  /** The pairs said not the same, when they changed. */
  pairs: string[] | null;
  /** Blobs the rows above name whose bytes are not here: each by its hash and size. */
  expects?: [hash: string, size: number][];
  /** Strokes added to pages of ink and taken from them: pages that are rows once the `puts` are in, and books' pages, which are no rows. */
  ink?: { page: string; add: InkStroke[]; remove: string[] }[];
}

/** The engine's way into the store's `Fs`. */
export interface Door {
  /** Run `fn` in the store's one-at-a-time chain, so no write of the app's interleaves with it. */
  run<T>(fn: () => Promise<T>): Promise<T>;
  row(id: string): Row | undefined;
  rows(): Row[];
  childrenOf(id: string | null): Row[];
  pathOf(row: Row): string;
  /** The path the `Fs` knows a vault-relative one by. */
  abs(rel: string): string;
  /** A merge's rows and `extra` in one transaction; then the tree, the index and the watchers are told. Call inside `run`. */
  apply(view: ViewWrite, extra: StoreOp[]): Promise<void>;
  /** The engine is told of every write from here on. */
  record(recorder: Recorder | null): void;
  /** How a blob that is not here is brought from the storage, for a read that needs it. Rejects when it cannot be. */
  fetcher(fn: ((hash: string, size: number) => Promise<void>) | null): void;
  /** A blob's bytes have come: the rows that name it are files that can be read, and the watchers are told. */
  landed(hash: string): void;
}

/** The id of a row under a dot-directory: its path, so two devices that each make it have made one row. */
export function hiddenId(rel: string): string {
  return `h.${stampOf(rel)}`;
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

/** The positions of a longest run of `keys` that rises. */
export function rising(keys: readonly number[]): Set<number> {
  /** The position that ends the best run of each length, and the one before each position in its run. */
  const tails: number[] = [];
  const prev: number[] = keys.map(() => -1);
  for (let i = 0; i < keys.length; i++) {
    let lo = 0;
    let hi = tails.length;
    while (lo < hi) {
      const mid = (lo + hi) >> 1;
      if (keys[tails[mid]!]! < keys[i]!) lo = mid + 1; else hi = mid;
    }
    if (lo > 0) prev[i] = tails[lo - 1]!;
    tails[lo] = i;
  }
  const out = new Set<number>();
  for (let i = tails.length ? tails[tails.length - 1]! : -1; i >= 0; i = prev[i]!) out.add(i);
  return out;
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

/**
 * What is written on books' pages, as an export holds it (milestone 71):
 * `.ilmi/ink/<the PDF's SHA-256>/<page>.pkdrawing`. It is a view of the `ink`
 * table: nothing here is a row, and a drawing written here is taken apart
 * into strokes.
 */
const INK_FILES = '.ilmi/ink';
const inkFileOf = (rel: string): { hash: string; page?: number } | 'all' | null => {
  if (rel === INK_FILES) return 'all';
  const m = /^\.ilmi\/ink\/([0-9a-f]{64})(?:\/([1-9]\d*)\.pkdrawing)?$/.exec(rel);
  if (!m) return null;
  return m[2] === undefined ? { hash: m[1]! } : { hash: m[1]!, page: Number(m[2]) };
};

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
  /** The blocks of every document that hold `query`, folded: as written first, then every word of it anywhere. */
  search(query: string, limit?: number): Promise<TextHit[]>;
  /** The rows of a collection from before the index made, a page at a time, the app open meanwhile; `told` hears how much is done, 1 at the end, at once when nothing is left to do. Returns the stop; a stopped walk goes on from there at the next open. */
  searchBuild(told: (share: number) => void): () => void;
  /** The engine's way in (milestone 61). */
  readonly door: Door;
  /** The files whose bytes are not here (milestone 63), by vault-relative path. */
  away(): string[];
  /** Whether the file at `path` is one of them. */
  isAway(path: string): boolean;
  /** The SHA-256 of the file at `path` when it is kept beside the database, else null. */
  blobAt(path: string): string | null;
  /**
   * A big file read a piece at a time: its length, and a read of the bytes
   * from `begin` up to `end`. Null when the file is text, or the store
   * cannot read by the piece. A file that is not here is fetched first.
   */
  pieces(path: string): Promise<{ size: number; read(begin: number, end: number): Promise<Uint8Array> } | null>;
  /** The file on disk at `from` becomes the file at `path`, copied by the store without passing through here. False when the store cannot (it is then to be written the usual way). */
  take(path: string, from: string): Promise<boolean>;
  /** The strokes of the page of ink at `path` (its `.pkdrawing`, or the picture beside it); null when no page of strokes is there. */
  ink(path: string): Promise<InkStroke[] | null>;
  /**
   * The page of ink at `path` (a `.pkdrawing`) holds these strokes from
   * now on: the ones it lacks are added and the ones not among them
   * taken away, in one transaction; a stroke it has is left as it is. A
   * page that is not there is made, and a `.pkdrawing` kept as a file
   * becomes a page of strokes (the picture kept beside it goes: it is
   * made from the strokes now).
   */
  setInk(path: string, strokes: readonly InkStroke[]): Promise<{ added: number; removed: number }>;
  /** The strokes written on page `page` of the PDF whose SHA-256 is `hash` (milestone 67), in the order they were drawn. */
  pageInk(hash: string, page: number): Promise<InkStroke[]>;
  /** That page holds these strokes from now on: as `setInk`, the difference written in one transaction. Nothing is written into the PDF and no row is made. */
  setPageInk(hash: string, page: number, strokes: readonly InkStroke[]): Promise<{ added: number; removed: number }>;
  /** That page's writing, made from its strokes: the drawing the canvas opens, or a PNG of the whole page on nothing, the page `w` by `h` points. */
  pageInkFile(hash: string, page: number, what: 'drawing' | 'picture', w?: number, h?: number): Promise<Uint8Array>;
  /** The pages of that PDF that are written on, in order. */
  inkedPages(hash: string): Promise<number[]>;
  /** Whether a drawing is what the file at `path` under `.ilmi/ink/` holds, stroke for stroke: PencilKit's bytes differ on every save, so bytes cannot say. */
  sameInk(path: string, drawing: Uint8Array): Promise<boolean>;
  /** Told of each book's page whose strokes changed, here or by a merge. Returns the unsubscribe. */
  onPageInk(fn: (hash: string, page: number) => void): () => void;
}

const WATCH_DEBOUNCE_MS = 30;
const DIGEST_PAGE = 2000;
/** What a search asks for: more than a palette shows, so the best can be picked. */
const SEARCH_HITS = 100;
/** Documents the walk takes between two turns of the page: few enough that no write waits long behind it. */
const WALK_PAGE = 24;

/** The `Fs` over `store` for the vault whose root path is `root` (the collection's own folder; nothing under it is read from disk). */
export function storeFs(store: Store, root: string): StoreFs {
  const rows = new Map<string, Row>();
  /** Children by parent id; the top's under `''`. */
  const kids = new Map<string, Set<string>>();
  const key = (parent: string | null): string => parent ?? '';

  /** Blobs rows name whose bytes are not here, each with its size; and the size of each blob a row has named. */
  const awayBlobs = new Map<string, number>();
  const blobSizes = new Map<string, number>();
  let fetcher: ((hash: string, size: number) => Promise<void>) | null = null;
  /** One fetch a blob, however many reads ask. */
  const fetching = new Map<string, Promise<void>>();
  const need = async (hash: string): Promise<void> => {
    if (!awayBlobs.has(hash)) return;
    if (!fetcher) throw new Error('this file is not here');
    let run = fetching.get(hash);
    if (!run) {
      run = fetcher(hash, awayBlobs.get(hash) ?? 0).finally(() => { fetching.delete(hash); });
      fetching.set(hash, run);
    }
    await run;
    if (awayBlobs.has(hash)) throw new Error('this file is not in the storage yet');
  };

  const link = (r: Row): void => {
    if (r.blob !== null && r.size > 0) blobSizes.set(r.blob, r.size);
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
  /** Of rows with one name in one place, the one whose id sorts first: the same one on every device. */
  const first = (list: Row[]): Row | undefined => list.reduce<Row | undefined>((a, r) => (!a || r.id < a.id ? r : a), undefined);
  const find = (parent: string | null, name: string): Row | undefined => first(childrenOf(parent).filter((r) => fsName(r) === name));
  /** The row a path segment descends into: a folder of that name, or the document of that name (its children). */
  const dirRow = (parent: string | null, seg: string): Row | undefined =>
    first(childrenOf(parent).filter((r) => r.name === seg && r.kind !== 'file'));
  const under = (id: string | null, top: string): boolean => {
    // the hops are counted: rows that made a ring (the engine undoes the move that would close one) hang nothing
    for (let at = id, hops = 0; at !== null && hops < 10_000; at = rows.get(at)?.parent ?? null, hops++) if (at === top) return true;
    return false;
  };
  /** The directory a row's children are in, vault-relative: a folder's path, a document's without `.md`. */
  const dirPathOf = (r: Row): string => {
    const segs: string[] = [];
    for (let at: Row | undefined = r, hops = 0; at && hops < 10_000; at = at.parent === null ? undefined : rows.get(at.parent), hops++) segs.unshift(at.name);
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
    const doc = first(childrenOf(cur?.id ?? null).filter((r) => r.kind === 'doc' && r.name === last));
    if (doc) return { kind: 'kids', row: doc };
    return { kind: 'none', parent: cur, name: last };
  };

  /** The page of ink whose picture `abs` names: a path no row has, beside a page's `.pkdrawing`. */
  const pictureOf = (abs: string): Row | null => {
    const at = locate(abs);
    if (at.kind !== 'none' || at.parent === undefined) return null;
    const name = inkOfPicture(at.name);
    const page = name === null ? undefined : find(at.parent?.id ?? null, name);
    return page && isInk(page) ? page : null;
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

  /** Whoever shows a book's pages: told when the strokes on one change. */
  const pageWatchers = new Set<(hash: string, page: number) => void>();
  const wrote = (key: string): void => {
    const at = bookPageOf(key);
    if (at) for (const fn of [...pageWatchers]) fn(at.hash, at.page);
  };

  /** The engine, when the collection has one: told of each write, it answers with what goes into the same transaction. */
  let recorder: Recorder | null = null;
  const putOp = (at: Place, content?: Content, lift?: Lift): StoreOp => ({ op: 'put', at, ...(content ? { content } : {}), ...(lift ? { lift } : {}) });
  /** Where a row with this place is, vault-relative. */
  const relAt = (at: Place): string => {
    const parent = at.parent === null ? undefined : rows.get(at.parent);
    const dir = parent ? dirPathOf(parent) : '';
    const name = at.kind === 'doc' ? `${at.name}.md` : at.name;
    return dir ? `${dir}/${name}` : name;
  };
  /** A row deleted on another device and kept here for what was under it goes once nothing is, and so on up. */
  const tidy = async (from: string | null): Promise<void> => {
    for (let pid = from; pid !== null && recorder; ) {
      const p = rows.get(pid);
      if (!p || hasKids(p) || !(await recorder.dead(p.id))) return;
      const path = join(root, pathOf(p));
      await store.remove([p.id]);
      unlink(p.id);
      touched(path);
      pid = p.parent;
    }
  };
  const put = async (at: Place, content?: Content, lift?: Lift): Promise<Row> => {
    const before = rows.get(at.id);
    const size = content?.blob ? blobSizes.get(content.blob) : undefined;
    const extra = recorder ? await recorder.put({ at, before, rel: relAt(at), content, lift, ...(size !== undefined ? { size } : {}) }) : [];
    const row = extra.length ? (await store.batch([putOp(at, content, lift), ...extra]))[0]! : await store.put(at, content, lift);
    link(row);
    if (before && before.parent !== row.parent) await tidy(before.parent);
    return row;
  };
  const drop = async (ids: string[]): Promise<void> => {
    if (!ids.length) return;
    let extra: StoreOp[] = [];
    if (recorder) {
      const gone: { row: Row; rel: string }[] = [];
      const visit = (id: string): void => {
        const r = rows.get(id);
        if (!r) return;
        gone.push({ row: r, rel: pathOf(r) });
        for (const c of childrenOf(id)) visit(c.id);
      };
      for (const id of ids) visit(id);
      extra = await recorder.remove(gone);
    }
    if (extra.length) await store.batch([{ op: 'remove', ids }, ...extra]);
    else await store.remove(ids);
    const parents = new Set(ids.map((id) => rows.get(id)?.parent ?? null));
    for (const id of ids) unlink(id);
    for (const pid of parents) await tidy(pid);
  };
  /** A new row's id: random, or under a dot-directory the path's own, when no row has that yet. */
  const idFor = (rel: string): string => {
    if (!hidden(rel)) return newId();
    const id = hiddenId(rel);
    return rows.has(id) ? newId() : id;
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
      const rel: string = cur ? `${dirPathOf(cur)}/${seg}` : seg;
      cur = await put({ id: idFor(rel), parent: cur?.id ?? null, name: seg, place: null, kind: 'folder' });
      made = true;
    }
    return made;
  };

  // ── a document in and out ──────────────────────────────────────
  /** Lines for the log waiting on a document's next write, by its path. */
  const pendingLog = new Map<string, Review[]>();
  const fileOf = (r: Review): string => `${r.at.slice(0, 7)}.jsonl`;

  /** What goes with a document's text in its transaction. `original` and `size` differ between a write and a merge. */
  const liftOf = (d: Decomposed, original: Original | null, size: number): Lift => ({
    state: d.state.map((r) => ({ kind: r.kind, item: r.item, key: r.key, attrs: JSON.stringify(r.attrs) })),
    digest: d.digest,
    original,
    size,
    search: d.search,
  });

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
        return { content: splitFront(d.bare), lift: liftOf(d, d.original, typeof data === 'string' ? encoder.encode(text).length : data.length), doc: d.doc };
      }
    }
    const bytes = typeof data === 'string' ? encoder.encode(data) : data;
    const kept = await store.blobPut(bytes);
    blobSizes.set(kept.hash, kept.size);
    // bytes written here are here, whatever a merge had only named
    awayBlobs.delete(kept.hash);
    return { content: { blob: kept.hash } };
  };

  /** A document's file: its text and its rows put together (`lift.ts`). */
  const docText = async (r: Row): Promise<string> => {
    const c = await store.doc(r.id);
    const state: StateRow[] = c.state.map((s) => ({ kind: s.kind as StateRow['kind'], item: s.item, key: s.key, attrs: JSON.parse(s.attrs) as StateRow['attrs'] }));
    return recompose(c.front + c.text, state, c.original);
  };
  const textOf = (r: Row): Promise<string> => (r.kind === 'doc' ? docText(r) : store.text(r.id));
  const blobBytes = async (hash: string): Promise<Uint8Array> => { await need(hash); return store.blobGet(hash); };
  const bytesOf = async (r: Row): Promise<Uint8Array> => (r.blob !== null ? blobBytes(r.blob) : isInk(r) ? store.inkFile(r.id, 'drawing') : encoder.encode(await textOf(r)));

  /** Strokes added to a page and taken from it, the engine told, in one transaction. */
  /** A book's page holds these strokes from now on: the difference, in one transaction. */
  const pageInkWrite = async (hash: string, page: number, strokes: readonly InkStroke[]): Promise<{ added: number; removed: number }> => {
    const key = pageKey(hash, page);
    if (!bookPageOf(key)) throw new Error(`${hash} p. ${page}: not a page of a file`);
    const have = new Map((await store.ink(key)).map((s) => [s.stroke, s]));
    const want = new Set(strokes.map((s) => s.stroke));
    const add = strokes.filter((s) => !have.has(s.stroke));
    const remove = [...have.keys()].filter((k) => !want.has(k));
    if (add.length || remove.length) {
      const extra = recorder ? await recorder.ink(key, '', add, remove) : [];
      await store.batch([{ op: 'ink', page: key, add, remove }, ...extra]);
      wrote(key);
    }
    return { added: add.length, removed: remove.length };
  };

  const inkWrite = async (page: Row, add: InkStroke[], remove: string[]): Promise<void> => {
    if (!add.length && !remove.length) return;
    const extra = recorder ? await recorder.ink(page.id, pathOf(page), add, remove) : [];
    for (const r of await store.batch([{ op: 'ink', page: page.id, add, remove }, ...extra])) link(r);
  };

  /** Write a row with what `data` is stored as; a document's index and the log lines waiting on it go in the same transaction. */
  const store_ = async (at: Place, rel: string, data: string | Uint8Array | { blob: string }): Promise<Row> => {
    // a blob by its name alone: the bytes are the store's already
    if (typeof data === 'object' && 'blob' in data) return put(at, { blob: data.blob });
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
  /** Placed rows in their order: by place, and where two devices gave two rows one place, by name and then id. */
  const byPlace = (a: Row, b: Row): number => a.place! - b.place! || (a.name < b.name ? -1 : a.name > b.name ? 1 : a.id < b.id ? -1 : 1);
  const orderNow = (): string => {
    const out: Order = {};
    const dirs: [string, Row[]][] = [];
    for (const [parent, ids] of kids) {
      // a folder, a document, or a PDF on its own (a file row the tree shows, milestone 70); other files have no place in the tree
      const placed = [...ids].map((id) => rows.get(id)!).filter((r) => r.place !== null && (r.kind !== 'file' || isPdfPath(r.name)));
      if (!placed.length) continue;
      dirs.push([parent === '' ? '' : dirPathOf(rows.get(parent)!), placed.sort(byPlace)]);
    }
    for (const [dir, placed] of dirs.sort((a, b) => (a[0] < b[0] ? -1 : a[0] > b[0] ? 1 : 0))) out[dir] = placed.map((r) => (r.kind === 'doc' ? `${r.name}.md` : r.kind === 'file' ? r.name : `${r.name}/`));
    return Object.keys(out).length ? `${JSON.stringify(out, null, 2)}\n` : '';
  };
  /** The order a file asks for: by directory (its row's id, `''` the top), the rows it names that are here, as listed. */
  const placesOf = (text: string): Map<string, string[]> => {
    let order: Order = {};
    try { order = cleanOrder(JSON.parse(text)); } catch { /* a file that does not read orders nothing */ }
    const out = new Map<string, string[]>();
    for (const [dir, names] of Object.entries(order)) {
      let parent: Row | null = null;
      let ok = true;
      for (const seg of dir.split('/').filter(Boolean)) {
        const next = dirRow(parent?.id ?? null, seg);
        if (!next) { ok = false; break; }
        parent = next;
      }
      if (!ok) continue;
      const ids = out.get(key(parent?.id ?? null)) ?? [];
      for (const name of names) {
        const row = name.endsWith('/')
          ? childrenOf(parent?.id ?? null).find((r) => r.kind === 'folder' && r.name === name.slice(0, -1))
          : name.endsWith('.md') ? childrenOf(parent?.id ?? null).find((r) => r.kind === 'doc' && r.name === name.slice(0, -3))
            : isPdfPath(name) ? childrenOf(parent?.id ?? null).find((r) => r.kind === 'file' && r.name === name) : undefined;
        if (row && !ids.includes(row.id)) ids.push(row.id);
      }
      if (ids.length) out.set(key(parent?.id ?? null), ids);
    }
    return out;
  };
  /**
   * The order asked for, made the rows' places. A row keeps its place
   * when the rows around it in the list are the ones around it now: the
   * longest run of the list that is already in order stays, and each
   * other row gets a number between its new neighbours. A row with no
   * place yet has the one it is shown at (after the placed ones, in the
   * default order), so the first order written for a directory moves
   * only the row that was dragged, on every device alike.
   */
  const setPlaces = async (lists: Map<string, string[]>): Promise<boolean> => {
    const want = new Map<string, number>();
    const changed: [string, number | null, boolean][] = [];
    for (const [parent, ids] of lists) {
      const here = childrenOf(parent === '' ? null : parent).filter((r) => r.kind !== 'file' && !r.name.startsWith('.'));
      const placed = here.filter((r) => r.place !== null).sort(byPlace);
      const shown = new Map<string, number>(placed.map((r) => [r.id, r.place!]));
      const after = placed.length ? Math.floor(placed[placed.length - 1]!.place!) + 1 : 0;
      here.filter((r) => r.place === null).sort(byName).forEach((r, j) => shown.set(r.id, after + j));
      const keys = ids.map((id) => shown.get(id)!);
      const stay = rising(keys);
      const next = [...keys];
      for (let i = 0; i < ids.length; ) {
        if (stay.has(i)) { i += 1; continue; }
        let j = i;
        while (j < ids.length && !stay.has(j)) j += 1;
        const lo = i > 0 ? next[i - 1]! : null;
        const hi = j < ids.length ? keys[j]! : null;
        const m = j - i;
        for (let k = 0; k < m; k++) next[i + k] = lo !== null && hi !== null ? lo + ((hi - lo) * (k + 1)) / (m + 1) : hi !== null ? hi - (m - k) : lo !== null ? lo + k + 1 : k;
        i = j;
      }
      // no number left between two neighbours: the directory is numbered afresh
      const tight = next.some((n, i) => !Number.isFinite(n) || (i > 0 && n <= next[i - 1]!));
      ids.forEach((id, i) => {
        const to = tight ? i : next[i]!;
        want.set(id, to);
        if (rows.get(id)!.place !== to) changed.push([id, to, !tight && stay.has(i)]);
      });
    }
    for (const r of rows.values()) if (r.place !== null && !want.has(r.id)) changed.push([r.id, null, false]);
    if (!changed.length) return false;
    const extra = recorder ? await recorder.places(changed) : [];
    if (extra.length) await store.batch([{ op: 'places', set: [...want] }, ...extra]);
    else await store.places([...want]);
    for (const r of rows.values()) r.place = want.get(r.id) ?? null;
    return true;
  };
  /** Lines for the log, added to a file or (with `replace`) made all it holds; the engine told of the ones the file did not hold. */
  const logPut = async (file: string, list: ReviewRow[], replace: boolean): Promise<void> => {
    let extra: StoreOp[] = [];
    if (recorder && list.length) {
      const have = replace ? new Set(await store.reviews(file)) : null;
      extra = await recorder.reviews(have ? list.filter((r) => !have.has(r.line)) : list);
    }
    if (extra.length) await store.batch([{ op: 'reviews', file, rows: list, mode: replace ? 'replace' : 'add' }, ...extra]);
    else await store.reviewsPut(file, list, replace);
  };
  const samePut = async (next: string[]): Promise<void> => {
    const had = new Set(pairs);
    const now = new Set(next);
    const extra = recorder ? await recorder.same(next.filter((p) => !had.has(p)), pairs.filter((p) => !now.has(p))) : [];
    if (extra.length) await store.batch([{ op: 'same', pairs: next }, ...extra]);
    else await store.samePut(next);
    pairs = next;
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
      await samePut(next);
      await keep(rel, text, sameNow());
    } else {
      const list = parseReviews(text);
      await logPut(v.file, list.map((r) => reviewRow(v.file, r)), true);
      if (list.length) logFiles.set(v.file, list.length); else logFiles.delete(v.file);
      await keep(rel, text, list.length ? `${list.map(formatReview).join('\n')}\n` : '');
    }
  };

  const virtualRemove = async (rel: string, v: Virtual): Promise<void> => {
    if (v.kind === 'order') await setPlaces(new Map());
    else if (v.kind === 'same') await samePut([]);
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
    for (const [hash, size] of await store.blobsAway()) awayBlobs.set(hash, size);
    const version = await store.version();
    if (version > STORE_VERSION) throw new Error('this collection was written by a newer ilmi');
    for (const [k, o] of await store.originals()) originals.set(k, o);
    for (const [f, n] of await store.reviewFiles()) logFiles.set(f, n);
    pairs = await store.same();
    if (version < STORE_VERSION) {
      // below 2 the state is still in the text; 3 added tables the store makes as it opens
      if (version < 2) await upgrade();
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
  const create = async (parent: Row | null, seg: string, rel: string, data: string | Uint8Array | { blob: string }): Promise<Row> => {
    const doc = docName(seg);
    const pid = parent?.id ?? null;
    if (doc !== null) {
      const folder = dirRow(pid, doc);
      // `a/` was there first: it is this document now, its children the document's
      if (folder?.kind === 'folder') return store_(placeOf(folder, { kind: 'doc' }), rel, data);
    }
    return store_({ id: idFor(rel), parent: pid, name: doc ?? seg, place: null, kind: doc !== null ? 'doc' : 'file' }, rel, data);
  };

  const writeInner = async (abs: string, data: string | Uint8Array | { blob: string }): Promise<void> => {
    const rel = relative(root, abs) ?? '';
    const at = locate(abs);
    const v = virtualOf(rel);
    if (v && at.kind !== 'row' && !(typeof data === 'object' && 'blob' in data)) {
      const text = typeof data === 'string' ? data : (() => { try { return strict.decode(data); } catch { return null; } })();
      // bytes that are not text stay a file of their own, as before
      if (text !== null) {
        await mkdirs(rel.split('/').slice(0, -1), abs);
        await virtualWrite(rel, v, text);
        return;
      }
    }
    const pageFile = inkFileOf(rel);
    if (pageFile && pageFile !== 'all' && pageFile.page !== undefined && at.kind !== 'row') {
      await pageInkWrite(pageFile.hash, pageFile.page, await store.inkSplit(typeof data === 'string' ? encoder.encode(data) : data as Uint8Array));
      return;
    }
    if (at.kind === 'root' || at.kind === 'kids' || (at.kind === 'row' && at.row.kind === 'folder')) throw new Error(`${abs}: is a directory`);
    // a page's picture is made from its strokes: one written beside it is not kept
    if (pictureOf(abs)) return;
    if (at.kind === 'row') {
      if (isInk(at.row)) {
        // a file written over a page of strokes is that file from now on: the strokes go, and the picture they made stays beside it as a file
        const picture = join(root, inkPicture(rel));
        const made = await store.inkFile(at.row.id, 'picture');
        await inkWrite(at.row, [], (await store.ink(at.row.id)).map((s) => s.stroke));
        await store_(placeOf(at.row), rel, data);
        if (made.length && locate(picture).kind === 'none') await writeInner(picture, made);
        touched(picture);
        return;
      }
      await store_(placeOf(at.row), rel, data);
    } else {
      if (at.parent === undefined) throw new Error(`${abs}: no such directory`);
      const seg = settled(at.name);
      // a temp name keeps its own name; it becomes the file on the rename
      if (seg === at.name) await create(at.parent, seg, rel, data);
      else {
        // a document on its way in is text, not yet taken apart
        const { content } = typeof data === 'object' && 'blob' in data ? { content: { blob: data.blob } } : await contentFor(rel, false, data, docName(seg) !== null);
        await put({ id: newId(), parent: at.parent?.id ?? null, name: at.name, place: null, kind: 'file' }, content);
      }
    }
  };

  /** What `.ilmi/ink/` lists: the books written on, or the pages of one. */
  const inkEntries = async (view: { hash: string } | 'all'): Promise<FsEntry[]> => {
    const pages = (await store.inkPages(view === 'all' ? BOOK_PAGE : `${BOOK_PAGE}${view.hash}.`)).flatMap((k) => bookPageOf(k) ?? []);
    if (view === 'all') return [...new Set(pages.map((p) => p.hash))].sort().map((name) => ({ name, isDir: true, isFile: false }));
    return pages.sort((a, b) => a.page - b.page).map((p) => ({ name: `${p.page}${INK_EXT}`, isDir: false, isFile: true }));
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
    const pageFile = inkFileOf(rel);
    if (pageFile && pageFile !== 'all' && pageFile.page !== undefined && at.kind !== 'row') { await pageInkWrite(pageFile.hash, pageFile.page, []); return; }
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
    const pageFile = inkFileOf(rel);
    if (pageFile && pageFile !== 'all' && pageFile.page !== undefined && at.kind !== 'row') return { bytes: await store.inkPage(pageKey(pageFile.hash, pageFile.page), 'drawing', 0, 0) };
    const page = pictureOf(path);
    if (page) return { bytes: await store.inkFile(page.id, 'picture') };
    if (at.kind !== 'row' || at.row.kind === 'folder') throw new Error(`${path}: no such file`);
    if (isInk(at.row)) return { bytes: await store.inkFile(at.row.id, 'drawing') };
    return at.row.blob !== null ? { bytes: await blobBytes(at.row.blob) } : { text: await textOf(at.row) };
  };

  // ── the engine's way in ────────────────────────────────────────
  const door: Door = {
    run: (fn) => serial(fn),
    row: (id) => rows.get(id),
    rows: () => [...rows.values()],
    childrenOf: (id) => childrenOf(id),
    pathOf: (r) => pathOf(r),
    abs: (rel) => join(root, rel),
    record(r) { recorder = r; },
    fetcher(fn) { fetcher = fn; },
    landed(hash) {
      if (!awayBlobs.delete(hash)) return;
      for (const r of rows.values()) if (r.blob === hash) touched(join(root, pathOf(r)));
    },
    async apply(view, extra) {
      const ops: StoreOp[] = [];
      for (const [hash, size] of view.expects ?? []) ops.push({ op: 'expect', hash, size });
      const docs = new Map<string, Doc>();
      const was = new Map<string, Row>();
      for (const p of view.puts) {
        const old = rows.get(p.at.id);
        if (old) was.set(old.id, { ...old });
        if (p.file !== undefined) {
          const d = decompose(p.file);
          docs.set(p.at.id, d.doc);
          // what a merge makes is kept in canonical form: there is no file it came in as
          const size = encoder.encode(d.original ? serialize(d.doc) : p.file).length;
          ops.push(putOp(p.at, splitFront(d.bare), liftOf(d, null, size)));
        } else ops.push(putOp(p.at, p.content));
      }
      const gonePaths = [...was.values(), ...view.removes.flatMap((id) => rows.get(id) ?? [])].map((r) => join(root, pathOf(r)));
      if (view.removes.length) ops.push({ op: 'remove', ids: view.removes });
      for (const r of view.reviews) if (r.rows.length) ops.push({ op: 'reviews', file: r.file, rows: r.rows, mode: 'union' });
      if (view.pairs) ops.push({ op: 'same', pairs: view.pairs });
      for (const rel of [...(view.reviews.some((r) => r.rows.length) ? view.reviews.map((r) => `${REVIEWS_PATH}/${r.file}`) : []), ...(view.pairs ? [SAME_PATH] : [])]) {
        if (originals.has(rel)) { ops.push({ op: 'original', key: rel, original: null }); originals.delete(rel); }
      }
      for (const i of view.ink ?? []) ops.push({ op: 'ink', page: i.page, add: i.add, remove: i.remove });
      ops.push(...extra);
      if (!ops.length) return;
      const written = await store.batch(ops);
      for (const [hash, size] of view.expects ?? []) awayBlobs.set(hash, size);
      for (const r of written) link(r);
      for (const id of view.removes) unlink(id);
      let placed = false;
      for (const p of view.puts) {
        const r = rows.get(p.at.id);
        if (!r) continue;
        const rel = pathOf(r);
        if (r.kind === 'doc' && (p.file !== undefined || p.content)) indexed(rel, docs.has(r.id) ? digest(docs.get(r.id)!) : null);
        // the order's file names rows by their paths: it reads otherwise after a place, a name or a parent changed
        const old = was.get(r.id);
        if ((old?.place ?? null) !== r.place || (old && (old.name !== r.name || old.parent !== r.parent))) placed = true;
        touched(join(root, rel));
      }
      for (const i of view.ink ?? []) {
        if (isBookPage(i.page)) { wrote(i.page); continue; }
        const r = rows.get(i.page);
        if (!r) continue;
        const rel = pathOf(r);
        touched(join(root, rel), join(root, inkPicture(rel)));
      }
      touched(...gonePaths);
      if (placed || view.removes.length) touched(join(root, ORDER_FILE));
      if (view.pairs) { pairs = [...view.pairs]; touched(join(root, SAME_PATH)); }
      if (view.reviews.some((r) => r.rows.length)) {
        logFiles.clear();
        for (const [f, n] of await store.reviewFiles()) logFiles.set(f, n);
        // the log's directory is there for whoever lists it
        await mkdirs(REVIEWS_PATH.split('/'), REVIEWS_PATH);
        for (const r of view.reviews) touched(join(root, `${REVIEWS_PATH}/${r.file}`));
      }
    },
  };

  return {
    store,
    atomic: true,
    door,

    async rowAt(path) {
      await ready;
      const at = locate(path);
      return at.kind === 'row' ? at.row : null;
    },

    away() {
      if (!awayBlobs.size) return [];
      const out: string[] = [];
      for (const r of rows.values()) if (r.blob !== null && awayBlobs.has(r.blob)) out.push(pathOf(r));
      return out.sort();
    },

    isAway(path) {
      const at = locate(path);
      return at.kind === 'row' && at.row.blob !== null && awayBlobs.has(at.row.blob);
    },

    blobAt(path) {
      const at = locate(path);
      return at.kind === 'row' ? at.row.blob : null;
    },

    async pieces(path) {
      await ready;
      const at = locate(path);
      if (at.kind !== 'row' || at.row.blob === null || !store.blobRange) return null;
      const hash = at.row.blob;
      await need(hash);
      const range = store.blobRange.bind(store);
      return { size: blobSizes.get(hash) ?? at.row.size, read: (begin, end) => range(hash, begin, end) };
    },

    take: (path, from) =>
      serial(async () => {
        if (!store.blobTake) return false;
        const kept = await store.blobTake(from);
        blobSizes.set(kept.hash, kept.size);
        awayBlobs.delete(kept.hash);
        await writeInner(path, { blob: kept.hash });
        touched(path);
        return true;
      }),

    async ink(path) {
      await ready;
      const at = locate(path);
      const page = at.kind === 'row' ? (isInk(at.row) ? at.row : null) : pictureOf(path);
      return page ? store.ink(page.id) : null;
    },

    setInk: (path, strokes) =>
      serial(async () => {
        const rel = relative(root, path) ?? '';
        const segs = rel.split('/').filter(Boolean);
        const seg = segs[segs.length - 1] ?? '';
        if (!seg.endsWith(INK_EXT)) throw new Error(`${path}: not a page of ink`);
        let at = locate(path);
        if (at.kind === 'none' && at.parent === undefined) {
          await mkdirs(segs.slice(0, -1), path);
          at = locate(path);
        }
        if (at.kind !== 'row' && (at.kind !== 'none' || at.parent === undefined)) throw new Error(`${path}: not a page of ink`);
        let page: Row;
        if (at.kind === 'row') {
          if (at.row.kind !== 'file') throw new Error(`${path}: not a page of ink`);
          // a drawing kept as a file becomes a page of strokes
          page = isInk(at.row) ? at.row : await put(placeOf(at.row), { front: null, text: '' });
        } else page = await put({ id: newId(), parent: at.parent?.id ?? null, name: seg, place: null, kind: 'file' }, { front: null, text: '' });
        // a picture kept as a file beside it would hide the one the strokes make
        const kept = find(page.parent, inkPicture(page.name));
        if (kept && kept.kind === 'file') await drop([kept.id]);
        const have = new Map((await store.ink(page.id)).map((s) => [s.stroke, s]));
        const want = new Set(strokes.map((s) => s.stroke));
        const add = strokes.filter((s) => !have.has(s.stroke));
        const remove = [...have.keys()].filter((k) => !want.has(k));
        await inkWrite(page, add, remove);
        if (add.length || remove.length) touched(path, join(root, inkPicture(rel)));
        return { added: add.length, removed: remove.length };
      }),

    async pageInk(hash, page) {
      await ready;
      return store.ink(pageKey(hash, page));
    },

    setPageInk: (hash, page, strokes) => serial(() => pageInkWrite(hash, page, strokes)),

    async pageInkFile(hash, page, what, w = 0, h = 0) {
      await ready;
      return store.inkPage(pageKey(hash, page), what, w, h);
    },

    async sameInk(path, drawing) {
      await ready;
      const at = inkFileOf(relative(root, path) ?? '');
      if (!at || at === 'all' || at.page === undefined) return false;
      const have = (await store.ink(pageKey(at.hash, at.page))).map((s) => s.stroke);
      const there = await store.inkSplit(drawing).catch(() => null);
      return there !== null && there.length === have.length && there.every((s, i) => s.stroke === have[i]);
    },

    async inkedPages(hash) {
      await ready;
      const prefix = `${BOOK_PAGE}${hash}.`;
      return (await store.inkPages(prefix)).flatMap((k) => { const at = bookPageOf(k); return at ? [at.page] : []; }).sort((a, b) => a - b);
    },

    onPageInk(fn) {
      pageWatchers.add(fn);
      return () => { pageWatchers.delete(fn); };
    },

    ref: async (path) => {
      await ready;
      const at = locate(path);
      return at.kind === 'row' ? at.row.blob : null;
    },

    writeRef: (path, ref) =>
      serial(async () => {
        await writeInner(path, { blob: ref });
        touched(path);
      }),

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
          await logPut(file, list.map((r) => reviewRow(file, r)), false);
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

    async search(query, limit = SEARCH_HITS) {
      await ready;
      const { phrase, words } = searchQuery(query);
      if (!words.length) return [];
      return (await store.search(phrase, words, limit)).flatMap(({ doc, ...hit }) => {
        const r = rows.get(doc);
        if (r?.kind !== 'doc') return [];
        const path = pathOf(r);
        return hidden(path) ? [] : [{ ...hit, path }];
      });
    },

    searchBuild(told) {
      let stopped = false;
      void (async () => {
        await ready;
        let { done, after } = await store.searchState();
        const docs = [...rows.values()].filter((r) => r.kind === 'doc');
        let seen = after === null ? 0 : docs.filter((r) => r.id <= after!).length;
        while (!done && !stopped) {
          told(docs.length ? Math.min(0.99, seen / docs.length) : 0);
          // in the chain, so no write comes between what is read and what is written
          await serial(async () => {
            const page = await store.searchWalk(after, WALK_PAGE);
            const last = page[page.length - 1]?.[0] ?? after;
            done = page.length < WALK_PAGE;
            after = done ? null : last;
            seen += page.length;
            await store.batch([...page.map(([doc, text]): StoreOp => ({ op: 'search', doc, rows: searchRows(parse(text).doc) })), { op: 'searchWalked', after }]);
          });
          await new Promise((r) => setTimeout(r, 0));
        }
        if (done && !stopped) told(1);
      })().catch((e: unknown) => console.error('search index', e));
      return () => { stopped = true; };
    },

    async readDir(path): Promise<FsEntry[]> {
      await ready;
      const at = locate(path);
      const view = inkFileOf(relative(root, path) ?? '');
      if (view && at.kind !== 'row') return inkEntries(view);
      const parent = at.kind === 'root' ? null : at.kind === 'kids' ? at.row.id : at.kind === 'row' && at.row.kind === 'folder' ? at.row.id : undefined;
      if (parent === undefined) throw new Error(`${path}: no such directory`);
      const out: FsEntry[] = [];
      const listed = new Set<string>();
      // two rows with one name (made apart on two devices): the one a path finds is the one listed
      for (const r of childrenOf(parent).sort((a, b) => (a.id < b.id ? -1 : 1))) {
        if (listed.has(fsName(r))) continue;
        listed.add(fsName(r));
        out.push({ name: fsName(r), isDir: r.kind === 'folder', isFile: r.kind !== 'folder' });
        if (r.kind === 'doc' && hasKids(r) && !listed.has(r.name)) { listed.add(r.name); out.push({ name: r.name, isDir: true, isFile: false }); }
      }
      const have = new Set(out.map((e) => e.name));
      for (const name of await virtualNames(relative(root, path) ?? '')) if (!have.has(name)) out.push({ name, isDir: false, isFile: true });
      if (relative(root, path) === '.ilmi' && !have.has('ink') && (await inkEntries('all')).length) out.push({ name: 'ink', isDir: true, isFile: false });
      // a page of ink's picture beside it
      for (const r of childrenOf(parent)) {
        if (!isInk(r) || find(parent, r.name) !== r) continue;
        const name = inkPicture(r.name);
        if (!listed.has(name)) { listed.add(name); out.push({ name, isDir: false, isFile: true }); }
      }
      return out;
    },

    async stat(path): Promise<FsStat | null> {
      await ready;
      const at = locate(path);
      if (at.kind === 'root') return { mtimeMs: 0, size: 0, isDir: true };
      if (at.kind === 'kids') return hasKids(at.row) ? { mtimeMs: 0, size: 0, isDir: true } : null;
      if (at.kind === 'none') {
        const page = pictureOf(path);
        if (page) return { mtimeMs: page.rev, size: page.size, isDir: false };
        const rel = relative(root, path) ?? '';
        const view = inkFileOf(rel);
        if (view) {
          if (view === 'all' || view.page === undefined) return (await inkEntries(view)).length ? { mtimeMs: 0, size: 0, isDir: true } : null;
          return (await store.ink(pageKey(view.hash, view.page))).length ? { mtimeMs: 0, size: 0, isDir: false } : null;
        }
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
            await logPut(v.file, list.map((r) => reviewRow(v.file, r)), false);
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
        if (inkFileOf(segs.join('/'))) { await mkdirs(['.ilmi'], join(root, '.ilmi')); return; }
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
            if (a.kind === 'row') await put(placeOf(src, { parent: b.parent?.id ?? null, name: seg, place: (b.parent?.id ?? null) === src.parent ? src.place : null }));
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
            const reshape = src.kind !== kind || (src.blob === null && kind === 'file' && !hidden(toRel) && !(isInk(src) && name.endsWith(INK_EXT)));
            if (src.kind === 'doc' && kind === 'file' && hasKids(src)) {
              // the children stay where they were, as a folder
              await store_({ id: newId(), parent: parent?.id ?? null, name, place: null, kind }, toRel, await bytesOf(src));
              await dropDoc(src);
            } else {
              // a place is a place among the rows of one directory: it does not go along to another
              const at = placeOf(src, { parent: parent?.id ?? null, name, kind, place: (parent?.id ?? null) === src.parent ? src.place : null });
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
