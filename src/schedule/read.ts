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
 * One pass made; `pos` moves the marker forward, never back. Under an exam
 * the next pass comes no later than the pacing says (`pacedInterval`): the
 * interval written is the shorter, so the line's due less its interval is
 * still the day of the pass.
 */
export function readOn(r: ReadSchedule, now: Date, pos?: number, pace?: Pace): ReadSchedule {
  let ivl = grow(r.ivl, r.af ?? READ_AF);
  const reps = (r.reps ?? 0) + 1;
  const at = pos !== undefined ? Math.max(r.pos ?? 0, pos) : r.pos;
  if (pace) {
    const left = pace.total === null ? null : pace.total - (at ?? 0);
    const paced = pacedInterval(dayOf(now), pace.exam, left, perPassOf(at, reps));
    if (paced !== null) ivl = Math.min(ivl, paced);
  }
  const out: ReadSchedule = { ...r, due: addDays(dayOf(now), ivl), ivl, reps };
  if (pos !== undefined) out.pos = at!;
  return out;
}

/** Not now: the interval grows by `factor` (1.2 by default), never less than a day, and the pass is not counted. */
export function postpone(r: ReadSchedule, now: Date, factor?: number): ReadSchedule {
  const ivl = postponed(r.ivl, factor);
  return { ...r, due: addDays(dayOf(now), ivl), ivl };
}

/**
 * Apply an action to a document's `read` field in place. Throws if it is
 * not enrolled. On a note, `pos` is never kept. `exam`: the exam ahead the
 * document is studied toward, which paces a pass.
 */
export function advanceRead(doc: Doc, action: ReadAction, now: Date, pos?: number, exam?: Exam): ReadSchedule | null {
  const m = meta(doc);
  if (!m.read) throw new Error('not enrolled in reading');
  const note = m.type === 'note';
  let r = m.read;
  if (note && r.pos !== undefined) { const { pos: _, ...rest } = r; r = rest; }
  const pace: Pace | undefined = exam && { exam, total: note || m.pdf !== undefined ? null : doc.blocks.filter((b) => b.kind !== 'card').length };
  const next = action === 'done' ? null : action === 'on' ? readOn(r, now, note ? undefined : pos, pace) : postpone(r, now);
  setField(doc, 'read', next);
  return next;
}
