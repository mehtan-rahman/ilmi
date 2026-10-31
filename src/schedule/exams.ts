// Exams (FORMAT.md §3, *exams*): `exam: 2026-11-18 midterm 2` on a document
// and everything under it is studied toward that day. Inherited as 42's
// options are (`ownersOf`), except that exams add up: a deck under a course
// is studied toward its own quiz and the course's final. Pure.
//
// While an exam is ahead (its day after today):
// - **cards**: a review FSRS would put after the exam is brought into its
//   last week instead (`EXAM_WINDOW` days, the day before the exam the
//   last), each card to a day of its own in that week by its id, so the
//   week is not a wall. Only the interval is cut: stability and difficulty
//   are FSRS's own, so a card seen early is scheduled by FSRS as any early
//   review is. A card already seen in the last week is left alone: it has
//   been seen in the last days. The cap is applied when a card is graded
//   (`capForExam`, written) and in the queue for a line written before the
//   exam was set (`examQueue`, derived, nothing written). New cards under
//   the exam are introduced early enough to be reviewed a few times: the
//   day's default allowance grows so the rest are in by `NEW_LEAD` days
//   before (`meterQueue`); a `new-per-day` someone set is kept as set.
// - **reading**: a source or extract with reading left is paced to be
//   finished `READ_LEAD` days before: its next pass brought forward, so the
//   passes left (at the blocks a pass has read so far) are spaced evenly
//   over the days left (`pacedInterval`). Passes advance; nothing grades. A
//   note revisited, or a document read by its pages, has no count of what is
//   left: its next pass is brought to the finish day unless it was made in
//   the last week.
// The day after the exam none of this applies; intervals grow as before.

import { forgetting_curve, generatorParameters } from 'ts-fsrs';
import type { CardSchedule, Exam, Meta } from '../format/index.js';
import { ownersOf } from './options.js';
import { addDays, dayOf, dayStart, whenToDate } from './dates.js';
import { burySiblings, type CardItem, type QueueItem } from './queue.js';

/** The last days before an exam a review is brought into. */
export const EXAM_WINDOW = 7;
/** Reading under an exam is finished this many days before it. */
export const READ_LEAD = 3;
/** New cards under an exam are in by this many days before it, so each is reviewed a few times. */
export const NEW_LEAD = 7;
/** Blocks a pass is taken to read before any pass has said. */
export const PASS_BLOCKS = 4;

/** An exam where it applies: the document that sets it. */
export interface ExamAt extends Exam {
  from: string;
}

/** One exam's key: the document that sets it and its day. */
export const examKey = (e: ExamAt): string => `${e.from}@${e.day}`;

/** Every exam that applies at `path` (a document or a folder): those set on it and on every document above it, by day. */
export function examsAt(path: string, metaOf: (p: string) => Meta | undefined): ExamAt[] {
  const out: ExamAt[] = [];
  const seen = new Set<string>();
  for (const o of ownersOf(path, (p) => metaOf(p) !== undefined)) {
    for (const e of metaOf(o)?.exams ?? []) {
      // the same exam set twice (a deck repeating its course's date) is one, the nearer
      const k = `${e.day} ${e.label ?? ''}`;
      if (seen.has(k)) continue;
      seen.add(k);
      out.push({ ...e, from: o });
    }
  }
  return out.sort((a, b) => (a.day < b.day ? -1 : a.day > b.day ? 1 : 0));
}

/** The exam studied toward at `now`: the first whose day is after today. */
export const activeExam = (exams: readonly ExamAt[], now: Date): ExamAt | undefined => {
  const today = dayOf(now);
  return exams.find((e) => e.day > today);
};

/** The next exam to show: the first on or after today (on its day it is today's). */
export const upcomingExam = (exams: readonly ExamAt[], now: Date): ExamAt | undefined => {
  const today = dayOf(now);
  return exams.find((e) => e.day >= today);
};

/** Whole days from one local day to another. */
export const daysFrom = (from: string, to: string): number => Math.round((dayStart(to).getTime() - dayStart(from).getTime()) / 86_400_000);

/** The first day of an exam's last week, and its last day of study (the day before). */
export const examWindow = (e: Exam): { start: string; last: string } => ({ start: addDays(e.day, -EXAM_WINDOW), last: addDays(e.day, -1) });

/** FNV-1a over a string: a card's own day in the window, the same every time. */
function hash(s: string): number {
  let h = 0x811c9dc5;
  for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 0x01000193); }
  return h >>> 0;
}

/** The day in the exam's last week that a card (by its key: id, and `cN` or `r`) is brought to. */
export const windowDay = (e: Exam, key: string): string => addDays(e.day, -1 - (hash(key) % EXAM_WINDOW));

/** A card line's key for the spread: its id and the line (`c2`, `r`), as the review log names it. */
export function lineKey(id: string | undefined, text: string, group?: CardItem['group'], dir?: CardItem['dir']): string {
  const line = dir === 'r' ? 'r' : group && 'n' in group ? `c${group.n}` : group ? `b${group.blank}` : '';
  return `${id ?? text}${line ? `:${line}` : ''}`;
}

/**
 * The schedule a grade at `now` writes under an exam: FSRS's, unless it
 * puts the card after the exam's last day of study while the card has not
 * been seen in the last week; then due on its day in the window, the
 * interval to match, stability and difficulty as FSRS left them.
 */
export function capForExam(next: CardSchedule, now: Date, exam: Exam, key: string): CardSchedule {
  if (!next.ivl || next.ivl < 1 || !next.due) return next;
  const today = dayOf(now);
  const { start, last } = examWindow(exam);
  if (today >= start) return next;
  const due = dayOf(whenToDate(next.due));
  if (due <= last) return next;
  const day = windowDay(exam, key);
  return { ...next, due: day, ivl: daysFrom(today, day) };
}

/**
 * Days to a reading's next pass under an exam, from the day of the pass
 * (`from`): the passes left (`left` blocks at `perPass` a pass) spaced over
 * the days to the finish, `READ_LEAD` before the exam; a day at a time once
 * that is past. `left` null: a note revisited or a document read by its
 * pages, one pass toward the exam, brought to the finish day unless made in
 * the last week. Null: no pacing (nothing left, or the exam's last day).
 */
export function pacedInterval(from: string, exam: Exam, left: number | null, perPass: number): number | null {
  const finish = addDays(exam.day, -READ_LEAD);
  if (left === null) return from < examWindow(exam).start ? daysFrom(from, finish) : null;
  if (left <= 0) return null;
  const d = daysFrom(from, finish);
  if (d <= 0) return from < addDays(exam.day, -1) ? 1 : null;
  const passes = Math.ceil(left / Math.max(1, perPass));
  return Math.max(1, Math.floor(d / passes));
}

/** Blocks a pass reads, from the passes made so far. */
export const perPassOf = (pos: number | undefined, reps: number | undefined): number =>
  pos && reps ? pos / reps : PASS_BLOCKS;

/**
 * The queue under exams, in place: each item under an exam ahead carries
 * it (`exam`); a review FSRS put after it and not seen in its last week is
 * due on its day in the window instead (`pulled`, the stored due); a
 * reading paced (`pulled` too). Nothing is written. Run before metering.
 */
export function examQueue(items: QueueItem[], now: Date, examsOf: (path: string) => readonly ExamAt[]): QueueItem[] {
  const today = dayOf(now);
  const pairs = new Map<string, CardItem[]>();
  for (const i of items) {
    const exam = activeExam(examsOf(i.path), now);
    if (!exam) continue;
    i.exam = exam;
    if (i.kind === 'card') {
      if (i.dir) { const k = `${i.path}#${i.block}`; pairs.set(k, [...(pairs.get(k) ?? []), i]); }
      const s = i.sched;
      if (i.buried || !s || s.state !== 'review' || !s.due) continue;
      const { start, last } = examWindow(exam);
      const due = dayOf(whenToDate(s.due));
      if (due <= last || (s.last && dayOf(whenToDate(s.last)) >= start)) continue;
      const day = windowDay(exam, lineKey(i.id, i.text, i.group, i.dir));
      i.pulled = s.due;
      i.dueAt = dayStart(day > today ? day : today);
    } else if (i.kind === 'read') {
      const s = i.sched;
      if (!s.due) continue;
      const due = dayOf(whenToDate(s.due));
      // the pass the line was written at: its due less its interval
      const from = s.ivl !== undefined ? addDays(due, -s.ivl) : today;
      const left = i.note || i.pdf ? null : i.total - i.pos;
      const ivl = pacedInterval(from, exam, left, perPassOf(s.pos, s.reps));
      if (ivl === null) continue;
      const day = addDays(from, ivl);
      if (day >= due) continue;
      i.pulled = s.due;
      i.dueAt = dayStart(day);
    }
  }
  // a direction brought forward may now meet its sibling on one day
  for (const pair of pairs.values()) if (pair.length === 2 && pair.some((i) => i.pulled)) burySiblings(pair, now);
  return items;
}

// ── what is left before it ───────────────────────────────────────

const W = generatorParameters().w;

/** A card's recall on the exam's day from what its line holds: 0 for one never reviewed. */
export function recallAt(s: CardSchedule | undefined, day: string): number {
  if (!s?.reps || !s.stability || !s.last || s.state === 'new') return 0;
  const elapsed = Math.max(0, daysFrom(dayOf(whenToDate(s.last)), day));
  return forgetting_curve(W, elapsed, s.stability);
}

export interface ExamLeft {
  /** Card items under it. */
  cards: number;
  /** Of them, not yet stable past it: new, or recall on the day below `retention` if not reviewed again. */
  unready: number;
  /** Sources and extracts with reading left, and the blocks left in them. */
  sources: number;
  blocks: number;
  /** Notes revisited and documents read by pages not passed over in the last week. */
  passes: number;
}

/** What is left before an exam over the queue's items under it (`under`). `retentionOf` is the recall each card is scheduled for. */
export function examLeft(items: readonly QueueItem[], exam: Exam, under: (path: string) => boolean, retentionOf: (path: string) => number): ExamLeft {
  const out: ExamLeft = { cards: 0, unready: 0, sources: 0, blocks: 0, passes: 0 };
  const { start } = examWindow(exam);
  for (const i of items) {
    if (!under(i.path)) continue;
    if (i.kind === 'card') {
      out.cards++;
      if (recallAt(i.sched, exam.day) < retentionOf(i.path)) out.unready++;
    } else if (i.kind === 'read') {
      if (i.note || i.pdf) {
        const from = i.sched.due && i.sched.ivl !== undefined ? addDays(dayOf(whenToDate(i.sched.due)), -i.sched.ivl) : undefined;
        if (!from || from < start) out.passes++;
      } else if (i.total - i.pos > 0) { out.sources++; out.blocks += i.total - i.pos; }
    }
  }
  return out;
}
