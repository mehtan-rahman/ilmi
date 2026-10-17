// The writing loop: a draft enrolled with `write:` resurfaces on a growing
// interval until it is marked done. Never graded. Mirrors the prototype's
// `writeAdvance`: worked on it multiplies the interval by the line's `af`
// (1.5 when absent), postpone multiplies it by a smaller factor, done keeps
// the line so the draft can be reopened.

import { WRITE_AF, meta, setField, type Doc, type WriteSchedule } from '../format/index.js';
import { addDays, dayOf } from './dates.js';
import { grow, postponed } from './growth.js';

export type WriteAction = 'on' | 'postpone' | 'done';

/** One pass made. Reopens a done draft. */
export function workedOn(w: WriteSchedule, now: Date): WriteSchedule {
  const ivl = grow(w.ivl, w.af ?? WRITE_AF);
  return { ...w, due: addDays(dayOf(now), ivl), ivl, reps: (w.reps ?? 0) + 1, done: false };
}

/** Not now: the interval grows by `factor` (1.2 by default), never less than a day, and the pass is not counted. */
export function postpone(w: WriteSchedule, now: Date, factor?: number): WriteSchedule {
  const ivl = postponed(w.ivl, factor);
  return { ...w, due: addDays(dayOf(now), ivl), ivl };
}

/** Out of the queue; the line stays. */
export function done(w: WriteSchedule): WriteSchedule {
  return { ...w, done: true };
}

/** Apply an action to a document's `write` field in place. Throws if it is not enrolled. */
export function advanceWrite(doc: Doc, action: WriteAction, now: Date): WriteSchedule {
  const w = meta(doc).write;
  if (!w) throw new Error('not enrolled in writing');
  const next = action === 'done' ? done(w) : action === 'on' ? workedOn(w, now) : postpone(w, now);
  setField(doc, 'write', next);
  return next;
}
