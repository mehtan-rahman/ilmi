// The reading loop: a source enrolled with `read:` comes back on a growing
// interval until it is marked done. Never graded. Mirrors the prototype's
// `readAdvance`: read on multiplies the interval by 1.6, postpone is tomorrow,
// done drops the field.

import { meta, setField, type Doc, type ReadSchedule } from '../format/index.js';
import { addDays, dayOf } from './dates.js';

export type ReadAction = 'on' | 'postpone' | 'done';

const GROWTH = 1.6;

/** One pass made; `pos` moves the marker forward, never back. */
export function readOn(r: ReadSchedule, now: Date, pos?: number): ReadSchedule {
  const ivl = Math.max(1, Math.round((r.ivl ?? 1) * GROWTH));
  const out: ReadSchedule = { ...r, due: addDays(dayOf(now), ivl), ivl, reps: (r.reps ?? 0) + 1 };
  if (pos !== undefined) out.pos = Math.max(r.pos ?? 0, pos);
  return out;
}

/** Not now: back tomorrow. Not a pass. */
export function postpone(r: ReadSchedule, now: Date): ReadSchedule {
  return { ...r, due: addDays(dayOf(now), 1) };
}

/** Apply an action to a document's `read` field in place. Throws if it is not enrolled. */
export function advanceRead(doc: Doc, action: ReadAction, now: Date, pos?: number): ReadSchedule | null {
  const r = meta(doc).read;
  if (!r) throw new Error('not enrolled in reading');
  const next = action === 'done' ? null : action === 'on' ? readOn(r, now, pos) : postpone(r, now);
  setField(doc, 'read', next);
  return next;
}
