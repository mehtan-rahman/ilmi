// The review log: `.ilmi/reviews/<yyyy-mm>.jsonl`, one JSON object per line,
// one line per grade. App-private and never required (FORMAT.md §1, *the
// review log*): the `sr` line keeps a card's latest state, the log keeps
// how it got there, for the numbers. Written append-only and read
// forgivingly, so a log synced between devices survives what sync does to
// it: two devices appending to one month's file, a conflict copy beside it
// (every `.jsonl` in the directory is read), a line seen twice (collapsed),
// a line torn by a crash or written by a newer app (skipped).

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
}

const STATES: readonly SrState[] = ['new', 'learning', 'review', 'relearning'];
const INSTANT = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}Z$/;
const KEY = /^(c[1-9]\d*|r)$/;

/** The month file a review lands in. */
export const reviewFile = (at: string): string => `${REVIEWS_DIR}/${at.slice(0, 7)}.jsonl`;

/** What makes two lines the same review: the same card graded the same way at the same second. */
export const reviewKey = (r: Review): string => `${r.at} ${r.card} ${r.key ?? ''} ${r.g}`;

/** One line, no newline, keys in a fixed order. */
export function formatReview(r: Review): string {
  const o: Record<string, unknown> = { at: r.at, doc: r.doc, card: r.card };
  if (r.key !== undefined) o.key = r.key;
  Object.assign(o, { g: r.g, st: r.st, elapsed: r.elapsed, ivl: r.ivl, next: r.next });
  if (r.s !== undefined) o.s = r.s;
  if (r.d !== undefined) o.d = r.d;
  if (r.ms !== undefined) o.ms = r.ms;
  if (r.src !== undefined) o.src = r.src;
  return JSON.stringify(o);
}

const num = (v: unknown, min = 0): v is number => typeof v === 'number' && Number.isFinite(v) && v >= min;

/** A line as a review, or null when it is not one. Unknown keys are ignored. */
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

/** Several files' reviews as one log: duplicates collapsed (the first kept), oldest first. */
export function mergeReviews(lists: Iterable<readonly Review[]>): Review[] {
  const seen = new Set<string>();
  const out: Review[] = [];
  for (const list of lists) {
    for (const r of list) {
      const k = reviewKey(r);
      if (seen.has(k)) continue;
      seen.add(k);
      out.push(r);
    }
  }
  // a stable sort: one second's reviews keep the order they were read in
  return out.sort((a, b) => (a.at < b.at ? -1 : a.at > b.at ? 1 : 0));
}
