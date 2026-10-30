// The reading loop: a source enrolled with `read:` comes back on a growing
// interval until it is marked done. Never graded. Mirrors the prototype's
// `readAdvance`: read on multiplies the interval by the line's `af` (1.6
// when absent), postpone multiplies it by a smaller factor, done drops the
// field. A note's pass (a revisit) keeps no `pos`: it starts over at the
// top, or at a heading, each time, since the note's own edits would move it.

import { READ_AF, meta, setField, type Doc, type ReadSchedule } from '../format/index.js';
import { addDays, dayOf } from './dates.js';
import { grow, postponed } from './growth.js';

export type ReadAction = 'on' | 'postpone' | 'done';

/** One pass made; `pos` moves the marker forward, never back. */
export function readOn(r: ReadSchedule, now: Date, pos?: number): ReadSchedule {
  const ivl = grow(r.ivl, r.af ?? READ_AF);
  const out: ReadSchedule = { ...r, due: addDays(dayOf(now), ivl), ivl, reps: (r.reps ?? 0) + 1 };
  if (pos !== undefined) out.pos = Math.max(r.pos ?? 0, pos);
  return out;
}

/** Not now: the interval grows by `factor` (1.2 by default), never less than a day, and the pass is not counted. */
export function postpone(r: ReadSchedule, now: Date, factor?: number): ReadSchedule {
  const ivl = postponed(r.ivl, factor);
  return { ...r, due: addDays(dayOf(now), ivl), ivl };
}

/** Apply an action to a document's `read` field in place. Throws if it is not enrolled. On a note, `pos` is never kept. */
export function advanceRead(doc: Doc, action: ReadAction, now: Date, pos?: number): ReadSchedule | null {
  const m = meta(doc);
  if (!m.read) throw new Error('not enrolled in reading');
  const note = m.type === 'note';
  let r = m.read;
  if (note && r.pos !== undefined) { const { pos: _, ...rest } = r; r = rest; }
  const next = action === 'done' ? null : action === 'on' ? readOn(r, now, note ? undefined : pos) : postpone(r, now);
  setField(doc, 'read', next);
  return next;
}
