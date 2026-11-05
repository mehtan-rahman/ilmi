// Study options: new cards a day, a cap on reviews a day, the retention FSRS
// aims for, and what a leech is and does. Set on a document's front-matter
// (FORMAT.md §3, *options*) and inherited by everything under it (its cards,
// and its children directory all the way down) unless set lower; where
// nothing sets one, the default holds. Pure: the queue meters with
// `meterQueue`, the grader reads `retention` and the leech rule.
//
// A day's allowance is counted where the value is set: `new-per-day: 10` on
// a notebook is ten new cards a day across everything under it that does not
// set its own; a deck under it that sets `new-per-day: 3` has its own three.
// Where nothing sets it, each document is its own deck with the default.

import type { LeechAction, Meta } from '../format/index.js';
import { addDays, dayOf, dayStart, whenToDate } from './dates.js';
import { sortQueue, type CardItem, type QueueItem } from './queue.js';
import { NEW_LEAD, daysFrom, examKey, type ExamAt } from './exams.js';

export interface DeckOptions {
  /** New cards introduced a day. */
  newPerDay: number;
  /** Reviews a day; null, no cap. */
  reviewsPerDay: number | null;
  /** FSRS's request retention. */
  retention: number;
  /** Lapses that make a card a leech. */
  leech: number;
  leechAction: LeechAction;
}

export type OptionKey = keyof DeckOptions;
export const OPTION_KEYS: readonly OptionKey[] = ['newPerDay', 'reviewsPerDay', 'retention', 'leech', 'leechAction'];

/**
 * Twenty new cards a day per deck, as Anki has it: enough to meter the
 * vocab deck's 110 new reverses over a week without a setting, few enough
 * that a day of new cards stays a day's work. No review cap. 0.9 is FSRS's
 * own default. Eight lapses, Anki's, and a leech is only marked, never
 * suspended unasked.
 */
export const OPTION_DEFAULTS: DeckOptions = { newPerDay: 20, reviewsPerDay: null, retention: 0.9, leech: 8, leechAction: 'tag' };

const metaKey = { newPerDay: 'newPerDay', reviewsPerDay: 'reviewsPerDay', retention: 'retention', leech: 'leech', leechAction: 'leechAction' } as const satisfies Record<OptionKey, keyof Meta>;

export interface Resolved {
  opts: DeckOptions;
  /** The document each option comes from; absent, the default. */
  from: Partial<Record<OptionKey, string>>;
}

/**
 * The documents a node sits under, nearest first: a document itself, then
 * the owner of each directory above it (`a/b.md` owns `a/b/`). A folder's
 * own owner (`a/b` → `a/b.md`) counts first, since its lens is that
 * document's children. `isDoc` says which paths are documents.
 */
export function ownersOf(path: string, isDoc: (p: string) => boolean): string[] {
  const out: string[] = [];
  let dir: string;
  if (path.endsWith('.md')) {
    out.push(path);
    dir = path.includes('/') ? path.slice(0, path.lastIndexOf('/')) : '';
  } else dir = path;
  while (dir) {
    if (isDoc(`${dir}.md`)) out.push(`${dir}.md`);
    dir = dir.includes('/') ? dir.slice(0, dir.lastIndexOf('/')) : '';
  }
  return out;
}

/** The options that apply at `path` (a document or a folder), and where each comes from. */
export function resolveOptions(path: string, metaOf: (p: string) => Meta | undefined): Resolved {
  const opts: DeckOptions = { ...OPTION_DEFAULTS };
  const from: Resolved['from'] = {};
  const owners = ownersOf(path, (p) => metaOf(p) !== undefined);
  for (const k of OPTION_KEYS) {
    for (const o of owners) {
      const v = metaOf(o)?.[metaKey[k]];
      if (v === undefined) continue;
      (opts as unknown as Record<string, unknown>)[k] = v;
      from[k] = o;
      break;
    }
  }
  return { opts, from };
}

/** Where a document's allowance of `key` is counted: the document that sets it, else the document itself. */
export const allowanceOf = (path: string, r: Resolved, key: 'newPerDay' | 'reviewsPerDay'): string => r.from[key] ?? path;

// ── the day's allowance ──────────────────────────────────────────

/** A card item that is new: never graded. */
export const isNewItem = (i: CardItem): boolean => !i.sched?.reps && (i.sched?.state ?? 'new') === 'new';

/** A card item the reviews cap counts: one in review (learning steps are not capped, as in Anki). */
const isReviewItem = (i: CardItem): boolean => i.sched?.state === 'review';

export interface Spent {
  /** New cards introduced today, by allowance (`allowanceOf`). */
  fresh: Map<string, number>;
  /** Reviews done today, by allowance. */
  reviews: Map<string, number>;
  /** New cards introduced today under each exam ahead (`examKey`). */
  exams?: Map<string, number>;
}

export interface MeterContext {
  /** The options at a document. */
  optionsOf(path: string): Resolved;
  /** What today has used of each allowance already. */
  spent?: Spent;
  /** The exam ahead a document is studied toward (`exams.ts`), if any. */
  examOf?(path: string): ExamAt | undefined;
  /** A due item's key for the day, when the caller keeps them (`sortQueue`). */
  keyOf?(item: QueueItem, day: string): number;
}

/**
 * The new cards a day an exam asks for: what is left of them (today's
 * introduced counted back in) over the days until `NEW_LEAD` before it,
 * today included; past that, over the days still before it.
 */
export function examNewQuota(left: number, exam: ExamAt, now: Date): number {
  const today = dayOf(now);
  const cutoff = addDays(exam.day, -NEW_LEAD);
  const days = cutoff >= today ? daysFrom(today, cutoff) + 1 : Math.max(1, daysFrom(today, exam.day));
  return Math.ceil(left / days);
}

/**
 * Hold back what is over the day's allowance, in place, and sort again: the
 * new cards past `new-per-day` and the reviews past `reviews-per-day`, in
 * the queue's order (priority, then due), each counted where its option is
 * set. A held item has `held` and is due at the next day's start, as a
 * buried sibling is; nothing is written. Learning cards are never held.
 * Under an exam ahead, where `new-per-day` is the default (set nowhere),
 * a new card also comes in while the exam's quota for the day
 * (`examNewQuota`) is not spent.
 */
export function meterQueue(items: QueueItem[], now: Date, ctx: MeterContext): QueueItem[] {
  sortQueue(items, now, ctx.keyOf);
  const tomorrow = dayStart(addDays(dayOf(now), 1));
  const used = { fresh: new Map(ctx.spent?.fresh ?? []), reviews: new Map(ctx.spent?.reviews ?? []), exams: new Map(ctx.spent?.exams ?? []) };
  const cache = new Map<string, Resolved>();
  const opts = (path: string) => { let r = cache.get(path); if (!r) { r = ctx.optionsOf(path); cache.set(path, r); } return r; };
  // the exam a new card counts toward: one ahead, where nothing sets new-per-day
  const examFor = (i: CardItem): ExamAt | undefined => (ctx.examOf && opts(i.path).from.newPerDay === undefined ? ctx.examOf(i.path) : undefined);
  const quota = new Map<string, number>();
  if (ctx.examOf) {
    const left = new Map<string, { exam: ExamAt; n: number }>();
    for (const i of items) {
      if (i.kind !== 'card' || i.buried || i.dueAt > now || !isNewItem(i)) continue;
      const e = examFor(i);
      if (!e) continue;
      const k = examKey(e);
      left.set(k, { exam: e, n: (left.get(k)?.n ?? 0) + 1 });
    }
    for (const [k, { exam, n }] of left) quota.set(k, examNewQuota(n + (used.exams.get(k) ?? 0), exam, now));
  }
  let held = false;
  for (const i of items) {
    if (i.kind !== 'card' || i.buried || i.dueAt > now) continue;
    const fresh = isNewItem(i);
    if (!fresh && !isReviewItem(i)) continue;
    const r = opts(i.path);
    const key = fresh ? 'newPerDay' : 'reviewsPerDay';
    const limit = r.opts[key];
    if (limit === null) continue;
    const at = allowanceOf(i.path, r, key);
    const map = fresh ? used.fresh : used.reviews;
    const n = map.get(at) ?? 0;
    const e = fresh ? examFor(i) : undefined;
    const ek = e && examKey(e);
    const forExam = ek !== undefined && (used.exams.get(ek) ?? 0) < (quota.get(ek) ?? 0);
    if (n >= limit && !forExam) {
      i.held = fresh ? 'new' : 'reviews';
      i.dueAt = tomorrow;
      held = true;
    } else {
      map.set(at, n + 1);
      if (ek !== undefined) used.exams.set(ek, (used.exams.get(ek) ?? 0) + 1);
    }
  }
  return held ? sortQueue(items, now, ctx.keyOf) : items;
}

/** A review the allowance counts: what was graded, on which day, from which state. */
export interface SpentReview { doc: string; at: string; st: string }

/**
 * What today has used, from the review log (`format/reviews.ts`): each
 * first grade of a new card and each grade of a card in review, on `now`'s
 * local day, counted at its document's allowance.
 */
export function spentToday(reviews: Iterable<SpentReview>, now: Date, optionsOf: (path: string) => Resolved, examOf?: (path: string) => ExamAt | undefined): Spent {
  const today = dayOf(now);
  const out: Spent = { fresh: new Map(), reviews: new Map(), exams: new Map() };
  for (const r of reviews) {
    if (dayOf(whenToDate(r.at)) !== today) continue;
    const fresh = r.st === 'new';
    if (!fresh && r.st !== 'review') continue;
    const o = optionsOf(r.doc);
    const at = allowanceOf(r.doc, o, fresh ? 'newPerDay' : 'reviewsPerDay');
    const map = fresh ? out.fresh : out.reviews;
    map.set(at, (map.get(at) ?? 0) + 1);
    const e = fresh && o.from.newPerDay === undefined ? examOf?.(r.doc) : undefined;
    if (e) out.exams!.set(examKey(e), (out.exams!.get(examKey(e)) ?? 0) + 1);
  }
  return out;
}

// ── leeches ──────────────────────────────────────────────────────

/**
 * Whether a grade that took a card's lapses from `before` to `after` makes
 * it a leech now: at the threshold, and again at every half of it past
 * that, as Anki has it.
 */
export function becomesLeech(before: number, after: number, threshold: number): boolean {
  if (after <= before || after < threshold) return false;
  const step = Math.max(1, Math.ceil(threshold / 2));
  return (after - threshold) % step === 0;
}
