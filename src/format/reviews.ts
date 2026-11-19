// The review log: `.ilmi/reviews/<yyyy-mm>.jsonl`, one JSON object per line,
// one line per grade. App-private and never required (FORMAT.md §1, *the
// review log*): the `sr` line keeps a card's latest state, the log keeps
// how it got there, for the numbers. Written append-only and read
// forgivingly, so a log synced between devices survives what sync does to
// it: two devices appending to one month's file, a conflict copy beside it
// (every `.jsonl` in the directory is read), a line seen twice (collapsed),
// a line torn by a crash or written by a newer app (skipped).
//
// The same files hold what was read (FORMAT.md §1, *a reading line*): a
// line with `read` and no `card`, one per pass on a source, a section or a
// draft, per postponement, per dismissal, per extract or section made. A
// reader of reviews skips it as a line it does not know; `parseReadings`
// reads those and skips the reviews.

import type { SrState } from './model.js';

export const REVIEWS_DIR = '.ilmi/reviews';

/** One grade. Optional fields are absent, never undefined. */
export interface Review {
  /** When, a UTC instant to the second. */
  at: string;
  /** The card's document, vault-relative, when it was graded. */
  doc: string;
  /** The card's `^id`. */
  card: string;
  /** The schedule graded: `cN` a cloze group, `r` a both-ways card's reverse; absent, the bare line. */
  key?: string;
  /** again hard good easy. */
  g: 1 | 2 | 3 | 4;
  /** The state before the grade. */
  st: SrState;
  /** Days since the review before; 0 for a new card. */
  elapsed: number;
  /** The interval before, in days. */
  ivl: number;
  /** The interval after, in days; 0 while in learning steps. */
  next: number;
  /** Stability and difficulty after. */
  s?: number;
  d?: number;
  /** Time spent on the card, in milliseconds, when known. */
  ms?: number;
  /** Where the line came from when not a session here: `anki` for an imported revlog. */
  src?: string;
  /** A grade given again in the session it was given in: the `at` of the line it replaces (the same `card` and `key`, an earlier instant). */
  over?: string;
  /**
   * What only the moment of the grade knows, each absent on a line written before it was kept (and on an imported one):
   * `tz` the device's offset from UTC then, in minutes east (60 in Paris in winter), so the local day and hour the
   * review fell in can be told; `time` the time on the card as measured, in milliseconds, only when `ms` was capped
   * below it; `form` the card's form then; `did` the document's own id then (the first twelve characters of its row's:
   * the same through a rename or a move, where `doc` is not); `n` which grade of its session it was, from 1; `ret`
   * the retention it was studied at, when not 0.9; `by` the scheduler in use, when not the built in; `step` the
   * learning step it stood on before, when it was in its steps.
   */
  tz?: number;
  time?: number;
  form?: 'cloze' | 'qa' | 'bidir';
  did?: string;
  n?: number;
  ret?: number;
  by?: string;
  step?: number;
  /** Keys of the line this app does not know (a newer app's), kept as they were and written back after the known ones. */
  extra?: Record<string, unknown>;
}

const FORMS = ['cloze', 'qa', 'bidir'] as const;
/** The keys of a grade's line, in the order they are written. */
const KNOWN = new Set(['at', 'doc', 'card', 'key', 'g', 'st', 'elapsed', 'ivl', 'next', 's', 'd', 'ms', 'src', 'over', 'tz', 'time', 'form', 'did', 'n', 'ret', 'by', 'step']);
const int = (v: unknown, min: number, max: number): v is number => typeof v === 'number' && Number.isInteger(v) && v >= min && v <= max;

const STATES: readonly SrState[] = ['new', 'learning', 'review', 'relearning'];
const INSTANT = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}Z$/;
const KEY = /^(c[1-9]\d*|r)$/;

/** The month file a review lands in. */
export const reviewFile = (at: string): string => `${REVIEWS_DIR}/${at.slice(0, 7)}.jsonl`;

/** What makes two lines the same review: the same card graded the same way at the same second. */
export const reviewKey = (r: Review): string => `${r.at} ${r.card} ${r.key ?? ''} ${r.g}`;

/** Whether `r` takes the place of `x`: a grade given again of the line `x` graded, at the instant `r.over` names. */
export const replaces = (r: Review, x: Review): boolean => r.over === x.at && r.card === x.card && r.key === x.key;

/** The instant a grade given again is logged at: its own, but always after the line it replaces, so a line never replaces one of its own second. */
export const overAt = (at: string, over: string): string => (at > over ? at : `${new Date(Date.parse(over) + 1000).toISOString().slice(0, 19)}Z`);

/** One line, no newline, keys in a fixed order. */
export function formatReview(r: Review): string {
  const o: Record<string, unknown> = { at: r.at, doc: r.doc, card: r.card };
  if (r.key !== undefined) o.key = r.key;
  Object.assign(o, { g: r.g, st: r.st, elapsed: r.elapsed, ivl: r.ivl, next: r.next });
  if (r.s !== undefined) o.s = r.s;
  if (r.d !== undefined) o.d = r.d;
  if (r.ms !== undefined) o.ms = r.ms;
  if (r.src !== undefined) o.src = r.src;
  if (r.over !== undefined) o.over = r.over;
  for (const k of ['tz', 'time', 'form', 'did', 'n', 'ret', 'by', 'step'] as const) if (r[k] !== undefined) o[k] = r[k];
  if (r.extra) for (const [k, v] of Object.entries(r.extra)) if (!KNOWN.has(k) && k !== 'read' && v !== undefined) o[k] = v;
  return JSON.stringify(o);
}

const num = (v: unknown, min = 0): v is number => typeof v === 'number' && Number.isFinite(v) && v >= min;

/** A line as a review, or null when it is not one. Unknown keys are kept (`extra`) and otherwise ignored. */
function readLine(line: string): Review | null {
  let o: unknown;
  try { o = JSON.parse(line); } catch { return null; }
  if (!o || typeof o !== 'object' || Array.isArray(o)) return null;
  const x = o as Record<string, unknown>;
  if (typeof x.at !== 'string' || !INSTANT.test(x.at)) return null;
  if (typeof x.doc !== 'string' || typeof x.card !== 'string' || !x.card) return null;
  if (x.key !== undefined && (typeof x.key !== 'string' || !KEY.test(x.key))) return null;
  if (x.g !== 1 && x.g !== 2 && x.g !== 3 && x.g !== 4) return null;
  if (!STATES.includes(x.st as SrState)) return null;
  if (!num(x.elapsed) || !num(x.ivl) || !num(x.next)) return null;
  const r: Review = { at: x.at, doc: x.doc, card: x.card, g: x.g, st: x.st as SrState, elapsed: x.elapsed, ivl: x.ivl, next: x.next };
  if (typeof x.key === 'string') r.key = x.key;
  if (num(x.s)) r.s = x.s;
  if (num(x.d)) r.d = x.d;
  if (num(x.ms)) r.ms = x.ms;
  if (typeof x.src === 'string') r.src = x.src;
  if (typeof x.over === 'string' && INSTANT.test(x.over) && x.over < x.at) r.over = x.over;
  // what the moment knew: each read when it is what it should be, else left out (never a reason to drop the line)
  if (int(x.tz, -840, 840)) r.tz = x.tz;
  if (num(x.time)) r.time = x.time;
  if (FORMS.includes(x.form as (typeof FORMS)[number])) r.form = x.form as (typeof FORMS)[number];
  if (typeof x.did === 'string' && /^[0-9a-z-]{1,40}$/.test(x.did)) r.did = x.did;
  if (int(x.n, 1, 1e6)) r.n = x.n;
  if (typeof x.ret === 'number' && x.ret > 0 && x.ret < 1) r.ret = x.ret;
  if (typeof x.by === 'string' && /^[a-z0-9][a-z0-9-]{0,63}$/.test(x.by)) r.by = x.by;
  if (int(x.step, 0, 1e4)) r.step = x.step;
  let extra: Record<string, unknown> | null = null;
  for (const k of Object.keys(x)) if (!KNOWN.has(k) && k !== 'read') (extra ??= {})[k] = x[k];
  if (extra) r.extra = extra;
  return r;
}

/** Every review a file holds, in file order; lines that are not reviews are skipped. */
export function parseReviews(text: string): Review[] {
  const out: Review[] = [];
  for (const line of text.split(/\r\n|\n|\r/)) {
    if (!line.trim()) continue;
    const r = readLine(line.trim());
    if (r) out.push(r);
  }
  return out;
}

/** Several files' reviews as one log: duplicates collapsed (the first kept), a line a grade given again replaces left out, oldest first. */
export function mergeReviews(lists: Iterable<readonly Review[]>): Review[] {
  const seen = new Set<string>();
  let out: Review[] = [];
  for (const list of lists) {
    for (const r of list) {
      const k = reviewKey(r);
      if (seen.has(k)) continue;
      seen.add(k);
      out.push(r);
    }
  }
  // whichever file each is in, and in whatever order: a replacing line is always the later instant, so no two replace each other
  const over = new Set(out.flatMap((r) => (r.over === undefined ? [] : [`${r.over} ${r.card} ${r.key ?? ''}`])));
  if (over.size) out = out.filter((x) => !over.has(`${x.at} ${x.card} ${x.key ?? ''}`));
  // a stable sort: one second's reviews keep the order they were read in
  return out.sort((a, b) => (a.at < b.at ? -1 : a.at > b.at ? 1 : 0));
}

// --- what was read ---------------------------------------------------------

/** What was done: read on (`pass`), postponed, dismissed or finished (`done`), an extract or a section made of it. */
export type ReadKind = 'pass' | 'later' | 'done' | 'extract' | 'section';

/** One reading event. Optional fields are absent, never undefined. */
export interface Reading {
  /** When, a UTC instant to the second. */
  at: string;
  /** The document read, vault-relative, when it was; for a section, the document its heading is in. */
  doc: string;
  read: ReadKind;
  /** The section's heading text, when it was a section's (or the section made). */
  sec?: string;
  /** Where it was read to (a block of a text, a page of a book), when known. */
  to?: number;
  /** Time spent on it, in milliseconds, when known. */
  ms?: number;
}

/** A reading taken back (a notice's undo): the line of `doc` (and `sec`) at the instant `of` does not count. */
export interface ReadingUndo {
  at: string;
  doc: string;
  read: 'undo';
  sec?: string;
  of: string;
}

export type ReadingLine = Reading | ReadingUndo;

const READ_KINDS: readonly ReadKind[] = ['pass', 'later', 'done', 'extract', 'section'];

/** What makes two lines the same reading: the same thing done to the same document (and section) at the same second. */
export const readingKey = (r: ReadingLine): string => `${r.at} ${r.read} ${r.doc}\n${r.sec ?? ''}${r.read === 'undo' ? `\n${r.of}` : ''}`;

/** What an undo names, and what a reading is named by. */
const undoKey = (at: string, doc: string, sec: string | undefined): string => `${at} ${doc}\n${sec ?? ''}`;

/** One line, no newline, keys in a fixed order. */
export function formatReading(r: ReadingLine): string {
  const o: Record<string, unknown> = { at: r.at, doc: r.doc, read: r.read };
  if (r.sec !== undefined) o.sec = r.sec;
  if (r.read === 'undo') o.of = r.of;
  else {
    if (r.to !== undefined) o.to = r.to;
    if (r.ms !== undefined) o.ms = r.ms;
  }
  return JSON.stringify(o);
}

/** A line as a reading (or one taken back), or null when it is not one. Unknown keys are ignored; a `read` word not known is not one. */
function readReading(line: string): ReadingLine | null {
  let o: unknown;
  try { o = JSON.parse(line); } catch { return null; }
  if (!o || typeof o !== 'object' || Array.isArray(o)) return null;
  const x = o as Record<string, unknown>;
  if (typeof x.at !== 'string' || !INSTANT.test(x.at)) return null;
  if (typeof x.doc !== 'string' || !x.doc) return null;
  if (x.sec !== undefined && (typeof x.sec !== 'string' || !x.sec)) return null;
  if (x.read === 'undo') {
    if (typeof x.of !== 'string' || !INSTANT.test(x.of)) return null;
    const u: ReadingUndo = { at: x.at, doc: x.doc, read: 'undo', of: x.of };
    if (typeof x.sec === 'string') u.sec = x.sec;
    return u;
  }
  if (!READ_KINDS.includes(x.read as ReadKind)) return null;
  const r: Reading = { at: x.at, doc: x.doc, read: x.read as ReadKind };
  if (typeof x.sec === 'string') r.sec = x.sec;
  if (num(x.to)) r.to = x.to;
  if (num(x.ms)) r.ms = x.ms;
  return r;
}

/** Every reading line a file holds, in file order; reviews and lines that are not readings are skipped. */
export function parseReadings(text: string): ReadingLine[] {
  return parseLog(text).filter(isReading);
}

/** Whether a line of the log is a reading's (or one taken back), not a grade's. */
export const isReading = (x: Review | ReadingLine): x is ReadingLine => 'read' in x;

/** Every line of a file that is a review or a reading, in file order: what a store keeps of it. A line that reads as a review is one. */
export function parseLog(text: string): (Review | ReadingLine)[] {
  const out: (Review | ReadingLine)[] = [];
  for (const raw of text.split(/\r\n|\n|\r/)) {
    const line = raw.trim();
    if (!line) continue;
    const r = readLine(line) ?? readReading(line);
    if (r) out.push(r);
  }
  return out;
}

/** A line of the log as it is written, whichever it is. */
export const formatLogLine = (x: Review | ReadingLine): string => (isReading(x) ? formatReading(x) : formatReview(x));

/** Several files' readings as one log: duplicates collapsed, a line taken back left out (and the line that took it back), oldest first. */
export function mergeReadings(lists: Iterable<readonly ReadingLine[]>): Reading[] {
  const seen = new Set<string>();
  const undone = new Set<string>();
  const out: Reading[] = [];
  for (const list of lists) {
    for (const r of list) {
      const k = readingKey(r);
      if (seen.has(k)) continue;
      seen.add(k);
      if (r.read === 'undo') undone.add(undoKey(r.of, r.doc, r.sec));
      else out.push(r);
    }
  }
  const kept = undone.size ? out.filter((x) => !undone.has(undoKey(x.at, x.doc, x.sec))) : out;
  return kept.sort((a, b) => (a.at < b.at ? -1 : a.at > b.at ? 1 : 0));
}
