// The writing loop: a draft enrolled with `write:` resurfaces on a growing
// interval until it is marked done. Never graded. Mirrors the prototype's
// `writeAdvance`: worked on it multiplies the interval by 1.5, postpone is
// tomorrow, done keeps the line so the draft can be reopened.

import { meta, setField, type Doc, type WriteSchedule } from '../format/index.js';
import { addDays, dayOf } from './dates.js';

export type WriteAction = 'on' | 'postpone' | 'done';

const GROWTH = 1.5;

/** One pass made. Reopens a done draft. */
export function workedOn(w: WriteSchedule, now: Date): WriteSchedule {
  const ivl = Math.max(1, Math.round((w.ivl ?? 1) * GROWTH));
  return { ...w, due: addDays(dayOf(now), ivl), ivl, reps: (w.reps ?? 0) + 1, done: false };
}

/** Not now: back tomorrow. Not a pass. */
export function postpone(w: WriteSchedule, now: Date): WriteSchedule {
  return { ...w, due: addDays(dayOf(now), 1) };
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
