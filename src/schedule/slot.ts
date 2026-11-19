// The scheduler slot, its pure side: what another scheduler than the built
// in is (a plugin's, or one the app carries), which of the queue's cards it
// is asked about, and how what it says is laid over the queue. The built in
// (ts-fsrs, `card.ts`) is always underneath: every grade still writes its
// state to the card's `sr` line, so with no scheduler chosen, or one that is
// missing, slow, or throws, the queue is the built in's and nothing is lost.
//
// A scheduler says one of two things about a card: its chance of recall
// now (`recall`, the date-less kind: a card is due when that is at or
// under the retention it is studied at, and the lowest against its target
// comes first), or a date after a grade (`next`, the interval kind). It is
// asked only about cards with a review that are out of their learning
// steps: a new card, and one minutes from due in its steps, are the app's
// (the day's new cards, learnt once, asked again before the session ends).
// A card it has no word on (`null`) is the built in's too.
//
// Nothing here is stored: a score lives in memory (`plugins/scheduler.ts`),
// worked out again from the review log on every device that has the
// scheduler, which is why a card's history is handed over with it.

import type { CardSchedule, Review } from '../format/index.js';
import type { Grade } from './card.js';
import { addDays, dayOf, dayStart, instantOf, isDay, whenToDate } from './dates.js';
import { burySiblings, itemKey, type CardItem, type QueueItem } from './queue.js';

/** A card as a scheduler is handed it. */
export interface SchedCard {
  /** Its document, collection-relative. */
  path: string;
  /** Its `^id`: a card with a review has one. */
  id: string;
  /** The line asked, as the review log names it: `cN` a cloze group, `r` a both-ways card's reverse; absent, the bare line. */
  key?: string;
  /** Its block in the document, as the queue was built. */
  block: number;
  /** The retention it is studied at (`retention`, where it is set over the card; 0.9 where nowhere). */
  retention: number;
  /** Its own reviews, oldest first, as the log has them. */
  history: readonly Review[];
  /** The built in's state, as its `sr` line holds it now. */
  fsrs?: CardSchedule;
}

export interface SchedContext {
  now: Date;
}

/** When a card comes back: a `Date`, an instant, or a day (`2026-12-01`). */
export interface Outcome {
  due: Date | string;
}

/** What a scheduler is: `recall` or `next`, and whatever else of the rest it has. */
export interface Scheduler {
  /** Lowercase letters, digits and hyphens; what a collection remembers it by. */
  id: string;
  /** As the tweaks row lists it. */
  name: string;
  /** Each card's chance of recall now, 0 to 1, in the order given; `null` for a card it has no word on. */
  recall?(cards: readonly SchedCard[], ctx: SchedContext): readonly (number | null)[] | Promise<readonly (number | null)[]>;
  /**
   * When a card comes back after `grade`, given at `ctx.now`. Asked as of the card's last review: `card.history`
   * holds the reviews before it and `card.fsrs` is absent, so every device works out the same date from the log.
   */
  next?(card: SchedCard, grade: Grade, ctx: SchedContext): Outcome | null | Promise<Outcome | null>;
  /** What each of the four grades would do now, for the buttons' `back in` words; without it they say nothing. */
  preview?(card: SchedCard, ctx: SchedContext): Record<Grade, Outcome> | null | Promise<Record<Grade, Outcome> | null>;
  /** The card's chance of recall `days` from now, one for each: what is ahead reads this. Falling as the days go. */
  curve?(card: SchedCard, days: readonly number[], ctx: SchedContext): readonly number[] | Promise<readonly number[]>;
  /** The whole review log, oldest first: when the collection opens, and when the log changes other than by a review added at its end (a sync). */
  prepare?(history: readonly Review[], ctx: SchedContext): void | Promise<void>;
  /** One review added at the log's end. */
  observe?(review: Review, ctx: SchedContext): void | Promise<void>;
}

/** What a scheduler said of one line of a card. */
export interface Score {
  /** The line's last review when it was asked: a score from before a grade since is not the card's any more. */
  last: string | undefined;
  /** Its chance of recall when asked. */
  recall?: number;
  /** When it comes back: a day or an instant. With `recall`, the day its recall falls to its target (from `curve`). */
  due?: string;
}

/** What names a line of a card in the log: its card's id and the line's key. */
export const scoreKey = (id: string, key: string | undefined): string => `${id}\n${key ?? ''}`;

/** The log's reviews by line (`scoreKey`), each oldest first. */
export function indexLog(log: readonly Review[]): Map<string, Review[]> {
  const out = new Map<string, Review[]>();
  for (const r of log) {
    const k = scoreKey(r.card, r.key);
    const list = out.get(k);
    if (list) list.push(r);
    else out.set(k, [r]);
  }
  for (const list of out.values()) list.sort((a, b) => (a.at < b.at ? -1 : a.at > b.at ? 1 : 0));
  return out;
}

/** The log in the one order every device has it in: by instant, then card, line and grade. */
export function canonicalLog(log: readonly Review[]): Review[] {
  const k = (r: Review) => `${r.at} ${r.card} ${r.key ?? ''} ${r.g}`;
  return [...log].sort((a, b) => { const x = k(a), y = k(b); return x < y ? -1 : x > y ? 1 : 0; });
}

/**
 * Whether a queue's card is one a scheduler is asked about: it has an id
 * and a review, and is out of its steps (its line is due on a day, not at
 * an instant minutes on).
 */
export const slotted = (i: QueueItem): i is CardItem & { id: string; sched: CardSchedule } =>
  i.kind === 'card' && i.id !== undefined && !!i.sched?.reps && !!i.sched.due && isDay(i.sched.due);

/**
 * The key the log has an item's line under. A reverse is `r`; a group of a
 * card of several is `cN`; a card of one group is its bare line, unless it
 * kept a `cN` line from when it had more, which the log then names: of the
 * two the one with reviews is taken.
 */
export function logKeyOf(item: CardItem, has: (key: string | undefined) => boolean): string | undefined {
  if (item.dir === 'r') return 'r';
  if (!item.group || !('n' in item.group)) return undefined;
  const own = `c${item.group.n}`;
  if (item.groups > 1) return own;
  return !has(undefined) && has(own) ? own : undefined;
}

/** The queue's card as a scheduler is handed it; null when it is not one it is asked about. */
export function schedCardOf(item: QueueItem, index: ReadonlyMap<string, readonly Review[]>, retention: number): SchedCard | null {
  if (!slotted(item)) return null;
  const key = logKeyOf(item, (k) => index.has(scoreKey(item.id, k)));
  const card: SchedCard = { path: item.path, id: item.id, block: item.block, retention, history: index.get(scoreKey(item.id, key)) ?? [], fsrs: item.sched };
  if (key !== undefined) card.key = key;
  return card;
}

/** A due as the format writes one, from what a scheduler gave; null when it is neither a date nor one of the format's. */
export function dueOf(x: unknown): string | null {
  if (x instanceof Date) return Number.isFinite(x.getTime()) ? instantOf(x) : null;
  if (typeof x !== 'string') return null;
  if (/^\d{4}-\d{2}-\d{2}$/.test(x)) return Number.isFinite(dayStart(x).getTime()) ? x : null;
  const d = new Date(x);
  return Number.isFinite(d.getTime()) ? instantOf(d) : null;
}

/** A chance of recall as given: a number from 0 to 1, else null (no word on the card). */
export const recallOf = (x: unknown): number | null => (typeof x === 'number' && x >= 0 && x <= 1 ? x : null);

// ── what is ahead ────────────────────────────────────────────────

/** The days ahead a curve is first asked at: close together near, then wider, out to ten years. */
export const CURVE_GRID: readonly number[] = [1, 2, 3, 4, 5, 6, 7, 9, 11, 14, 17, 21, 26, 32, 40, 50, 62, 77, 96, 120, 150, 187, 234, 292, 365, 456, 570, 712, 890, 1112, 1390, 1737, 2171, 2714, 3650];

/**
 * Between which two days of `days` a falling curve first reaches `target`:
 * `[a, b]` with recall over it on day `a` and at or under it on day `b`
 * (`a` is 0 when the first day is already there); null when it never does.
 */
export function crossing(days: readonly number[], recall: readonly number[], target: number): [number, number] | null {
  for (let i = 0; i < days.length; i++) {
    const r = recall[i];
    if (typeof r === 'number' && r <= target) return [i === 0 ? 0 : days[i - 1]!, days[i]!];
  }
  return null;
}

/** The whole days strictly between `a` and `b`. */
export const between = (a: number, b: number): number[] => Array.from({ length: Math.max(0, b - a - 1) }, (_, i) => a + 1 + i);

// ── over the queue ───────────────────────────────────────────────

/**
 * Lay a scheduler's scores over the queue, in place (the items are the
 * caller's own copies). A card with a score for the line as it is now
 * (`Score.last`) is due as the score says: by `recall`, today when it is at
 * or under `retentionOf` its document, else on the day its curve says (the
 * built in's day where it has none, never before tomorrow); by a date,
 * then. It carries `slot`, and its `due` reads as the day it comes up. The
 * two directions of a card are held apart again where either changed
 * (`burySiblings`). Run before the exams and the day's allowance, which
 * hold as they do. Resolves to how many cards it changed.
 */
export function applyScores(items: QueueItem[], scoreOf: (item: CardItem & { id: string; sched: CardSchedule }) => Score | undefined, retentionOf: (path: string) => number, now: Date): number {
  const today = dayOf(now);
  const tomorrow = addDays(today, 1);
  const pairs = new Map<string, CardItem[]>();
  const touched = new Set<string>();
  let n = 0;
  for (const i of items) {
    if (i.kind !== 'card') continue;
    const pair = i.dir ? `${i.path}#${i.block}` : null;
    if (pair) pairs.set(pair, [...(pairs.get(pair) ?? []), i]);
    if (!slotted(i)) continue;
    const s = scoreOf(i);
    if (!s || s.last !== i.sched.last) continue;
    let due: string;
    if (s.recall !== undefined) {
      const target = retentionOf(i.path);
      if (s.recall <= target) due = today;
      else {
        // not due: the day its curve gives, else the built in's; never today
        const ahead = s.due !== undefined ? dayOf(whenToDate(s.due)) : dayOf(whenToDate(i.sched.due!));
        due = ahead > today ? ahead : tomorrow;
      }
      i.slot = { recall: s.recall, ratio: target > 0 ? s.recall / target : s.recall, due };
      if (s.recall <= target || s.due !== undefined) i.slot.reaches = due;
    } else if (s.due !== undefined) {
      due = s.due;
      i.slot = { due, reaches: dayOf(whenToDate(due)) };
    } else continue;
    // a sibling held back by the built in's days is held, or not, by these
    if (i.buried) delete i.buried;
    i.due = due;
    i.dueAt = whenToDate(due);
    if (pair) touched.add(pair);
    n++;
  }
  for (const k of touched) {
    const pair = pairs.get(k)!;
    for (const i of pair) {
      if (!i.buried) continue;
      delete i.buried;
      i.dueAt = i.due ? whenToDate(i.due) : now;
    }
    if (pair.length === 2) burySiblings(pair, now);
  }
  return n;
}

/**
 * The day's order under a date-less scheduler: the cards it scored that are
 * due keep, between them, the places cards have in the day's order (so
 * reading and writing sit among them as they did), and which card takes
 * which place goes by recall against its target, the lowest first. Gives
 * each such card's key for `sortQueue`; `natural` is the key it would have
 * had.
 */
export function slotKeys(items: readonly QueueItem[], now: Date, natural: (item: QueueItem, day: string) => number = itemKey): Map<QueueItem, number> {
  const day = dayOf(now);
  const t = now.getTime();
  const due = items.filter((i): i is CardItem => i.kind === 'card' && i.slot?.ratio !== undefined && i.dueAt.getTime() <= t);
  const rows = due.map((item, at) => ({ item, at, key: natural(item, day) }));
  const keys = rows.map((r) => r.key).sort((a, b) => a - b);
  rows.sort((a, b) => a.item.slot!.ratio! - b.item.slot!.ratio! || a.key - b.key || a.at - b.at);
  return new Map(rows.map((r, i) => [r.item, keys[i]!]));
}
