// The reading loop: a source enrolled with `read:` comes back until it is
// marked done. Never graded. Mirrors the prototype's `readAdvance`, re-tuned
// in milestone 51: while a source has reading left it comes back on its
// cadence (`cadence(pri)`: every day, every other day, every third day) and
// does not grow; a note revisited, an extract, a section, or a source read
// to its end grows by the line's `af` (1.6 when absent) from the time
// elapsed since the pass before; postpone multiplies the stored interval by
// a smaller factor; done drops the field. A note's pass (a revisit) keeps no
// `pos`: it starts over at the top, or at a heading, each time, since the
// note's own edits would move it.

import { PRI_DEFAULT, READ_AF, meta, setField, type Doc, type Exam, type ReadSchedule } from '../format/index.js';
import { addDays, dayOf } from './dates.js';
import { pacedInterval, perPassOf } from './exams.js';
import { cadence, grownAt, postponed } from './growth.js';

/**
 * `postpone` is the person's (`p`: not now); `backlog` is the app's, the
 * day's leftover pushed on by `postpone the rest` or the day-start tweak. A
 * source with reading left is only held over to tomorrow by the backlog, its
 * cadence kept, since the person did not choose to skip it; anything else is
 * postponed the same way either way.
 */
export type ReadAction = 'on' | 'postpone' | 'done' | 'backlog';

/**
 * Under an exam ahead (`exams.ts`): the exam, and the document's prose
 * blocks (`total`), or null when what is left is not counted (a note
 * revisited, a document read by its pages).
 */
export interface Pace { exam: Exam; total: number | null }

/**
 * One pass made (a section's too, FORMAT.md §6.5: its line has no `pos`);
 * `pos` moves the marker forward, never back. The next interval grows from
 * the elapsed time (`grownAt`), or is `onCadence` days when given: a source
 * with reading left comes back on its cadence and does not grow. Under an
 * exam the next pass comes no later than the pacing says (`pacedInterval`):
 * the interval written is the shorter, so the line's due less its interval
 * is still the day of the pass.
 */
export function readOn<T extends ReadSchedule>(r: T, now: Date, pos?: number, pace?: Pace, onCadence?: number): T & { due: string; ivl: number; reps: number } {
  let ivl = onCadence ?? grownAt(r, now, r.af ?? READ_AF);
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

/** Held over: due tomorrow, the interval (a source's cadence) kept, no pass counted. */
export function heldOver<T extends ReadSchedule>(r: T, now: Date): T & { due: string } {
  return { ...r, due: addDays(dayOf(now), 1) };
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

/** The priority a document's reading is paced by: its `pri` field, else the one left on its `read` line, else the default. */
export const readPri = (m: { pri?: number; read?: { pri?: number } }): number => m.pri ?? m.read?.pri ?? PRI_DEFAULT;

/**
 * Whether a document has reading left after a pass that moves its marker
 * to `at`: a source whose marker is short of its prose, or any document
 * read by its pages. A note revisited and an extract come back as sections
 * do, growing; they never have reading left.
 */
export function readingLeft(m: { type?: string; pdf?: string }, at: number | undefined, total: number): boolean {
  if (m.type === 'note' || m.type === 'extract') return false;
  return m.pdf !== undefined || (at ?? 0) < total;
}

/**
 * Apply an action to a document's `read` field in place. Throws if it is
 * not enrolled. On a note, `pos` is never kept. `exam`: the exam ahead the
 * document is studied toward, which paces a pass. On a document with pages
 * `pos` is a page and `y` how far down it (FORMAT.md §3), the point moved
 * forward only. A source with reading left after the pass lands on its
 * cadence; anything else grows from the elapsed time. The backlog holds a
 * source with reading left over to tomorrow (`heldOver`); the rest it
 * postpones.
 */
export function advanceRead(doc: Doc, action: ReadAction, now: Date, pos?: number, exam?: Exam, y?: number): ReadSchedule | null {
  const m = meta(doc);
  if (!m.read) throw new Error('not enrolled in reading');
  const note = m.type === 'note';
  let r = m.read;
  if (note && r.pos !== undefined) { const { pos: _, ...rest } = r; r = rest; }
  const total = doc.blocks.filter((b) => b.kind !== 'card').length;
  const pace: Pace | undefined = exam && { exam, total: note || m.pdf !== undefined ? null : total };
  const marker = note || y !== undefined ? undefined : pos;
  const after = marker !== undefined ? Math.max(r.pos ?? 0, marker) : r.pos;
  const onCadence = readingLeft(m, after, total) ? cadence(readPri(m)) : undefined;
  let next: ReadSchedule | null = action === 'done' ? null
    : action === 'on' ? readOn(r, now, marker, pace, onCadence)
    : action === 'backlog' && onCadence !== undefined ? heldOver(r, now)
    : postpone(r, now);
  if (next && action === 'on' && !note && pos !== undefined && y !== undefined) {
    const { pos: _p, y: _y, ...rest } = next;
    next = { ...rest, ...pointOn(r, pos, y) };
  }
  setField(doc, 'read', next);
  return next;
}
