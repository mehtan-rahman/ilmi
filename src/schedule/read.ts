// The reading loop: a source enrolled with `read:` comes back on a growing
// interval until it is marked done. Never graded. Mirrors the prototype's
// `readAdvance`: read on multiplies the interval by the line's `af` (1.6
// when absent), postpone multiplies it by a smaller factor, done drops the
// field. A note's pass (a revisit) keeps no `pos`: it starts over at the
// top, or at a heading, each time, since the note's own edits would move it.

import { READ_AF, meta, setField, type Doc, type Exam, type ReadSchedule } from '../format/index.js';
import { addDays, dayOf } from './dates.js';
import { pacedInterval, perPassOf } from './exams.js';
import { grow, postponed } from './growth.js';

export type ReadAction = 'on' | 'postpone' | 'done';

/**
 * Under an exam ahead (`exams.ts`): the exam, and the document's prose
 * blocks (`total`), or null when what is left is not counted (a note
 * revisited, a document read by its pages).
 */
export interface Pace { exam: Exam; total: number | null }

/**
 * One pass made (a section's too, FORMAT.md §6.5: its line has no `pos`); `pos` moves the marker forward, never back. Under an exam
 * the next pass comes no later than the pacing says (`pacedInterval`): the
 * interval written is the shorter, so the line's due less its interval is
 * still the day of the pass.
 */
export function readOn<T extends ReadSchedule>(r: T, now: Date, pos?: number, pace?: Pace): T & { due: string; ivl: number; reps: number } {
  let ivl = grow(r.ivl, r.af ?? READ_AF);
  const reps = (r.reps ?? 0) + 1;
  const at = pos !== undefined ? Math.max(r.pos ?? 0, pos) : r.pos;
  if (pace) {
    const left = pace.total === null ? null : pace.total - (at ?? 0);
    const paced = pacedInterval(dayOf(now), pace.exam, left, perPassOf(at, reps));
    if (paced !== null) ivl = Math.min(ivl, paced);
  }
  const out = { ...r, due: addDays(dayOf(now), ivl), ivl, reps };
  if (pos !== undefined) out.pos = at!;
  return out;
}

/** Not now: the interval grows by `factor` (1.2 by default), never less than a day, and the pass is not counted. */
export function postpone<T extends ReadSchedule>(r: T, now: Date, factor?: number): T & { due: string; ivl: number } {
  const ivl = postponed(r.ivl, factor);
  return { ...r, due: addDays(dayOf(now), ivl), ivl };
}

/**
 * The read point on a document with pages, moved forward only: page `pos`,
 * `y` down it (absent: its foot). A point before the one held leaves it.
 */
export function pointOn(r: { pos?: number; y?: number }, pos: number, y: number): { pos: number; y?: number } {
  const was = (r.pos ?? 0) + (r.y ?? 1);
  if (r.pos !== undefined && pos + y <= was) return r.y === undefined ? { pos: r.pos } : { pos: r.pos, y: r.y };
  return { pos, y };
}

/**
 * Apply an action to a document's `read` field in place. Throws if it is
 * not enrolled. On a note, `pos` is never kept. `exam`: the exam ahead the
 * document is studied toward, which paces a pass. On a document with pages
 * `pos` is a page and `y` how far down it (FORMAT.md §3), the point moved
 * forward only.
 */
export function advanceRead(doc: Doc, action: ReadAction, now: Date, pos?: number, exam?: Exam, y?: number): ReadSchedule | null {
  const m = meta(doc);
  if (!m.read) throw new Error('not enrolled in reading');
  const note = m.type === 'note';
  let r = m.read;
  if (note && r.pos !== undefined) { const { pos: _, ...rest } = r; r = rest; }
  const pace: Pace | undefined = exam && { exam, total: note || m.pdf !== undefined ? null : doc.blocks.filter((b) => b.kind !== 'card').length };
  let next: ReadSchedule | null = action === 'done' ? null : action === 'on' ? readOn(r, now, note || y !== undefined ? undefined : pos, pace) : postpone(r, now);
  if (next && action === 'on' && !note && pos !== undefined && y !== undefined) {
    const { pos: _p, y: _y, ...rest } = next;
    next = { ...rest, ...pointOn(r, pos, y) };
  }
  setField(doc, 'read', next);
  return next;
}
