// Sections that come back: a heading's `<!-- read … -->` line (FORMAT.md
// §6.5) enrolls the heading and everything under it, up to the next heading
// of its level or higher. It comes back on the reading loop's growing
// interval: next counts a pass (`readOn`), later does not (`postpone`),
// dismiss ends it, its notes and cards left where they are. Pure; the
// queue makes an item of each (`queue.ts`), the app writes through
// `vault.update`.

import { READ_AF, sectionDismissed, type Block, type Doc, type Heading, type SectionSchedule } from '../format/index.js';
import { addDays, dayOf } from './dates.js';
import { grow } from './growth.js';
import { postpone, readOn, type ReadAction } from './read.js';

/** How far out a section first comes back, and comes back again when brought back. */
export const SECTION_IVL = 3;

/** The blocks of the section under the heading at `index`: from it to the next heading of its level or higher. */
export function sectionSpan(blocks: readonly Block[], index: number): { start: number; end: number } {
  const h = blocks[index];
  if (h?.kind !== 'heading') return { start: index, end: index };
  let end = index + 1;
  while (end < blocks.length) {
    const b = blocks[end]!;
    if (b.kind === 'heading' && b.level <= h.level) break;
    end++;
  }
  return { start: index, end };
}

/**
 * What is under a section's heading: whether anything is written there
 * (prose, a list, a subheading's text; the heading itself not counted),
 * and its cards.
 */
export function sectionState(blocks: readonly Block[], index: number): { written: boolean; cards: number } {
  const { start, end } = sectionSpan(blocks, index);
  let written = false;
  let cards = 0;
  for (let i = start + 1; i < end; i++) {
    const b = blocks[i]!;
    if (b.kind === 'card') cards++;
    else if (b.kind !== 'heading' && b.text.trim()) written = true;
  }
  return { written, cards };
}

/** The heading the caret is under: the nearest at or above `index`, or -1. */
export function headingAt(blocks: readonly Block[], index: number): number {
  for (let i = Math.min(index, blocks.length - 1); i >= 0; i--) if (blocks[i]!.kind === 'heading') return i;
  return -1;
}

/** In the queue: its line has a `due`, or is a bare one written by hand; a dismissed line is not. */
export const sectionInQueue = (s: SectionSchedule | undefined): s is SectionSchedule => !!s && !sectionDismissed(s);

/** Enroll: made today, back in three days. A line already there is left as it is. */
export function enrolSection(h: Heading, now: Date): SectionSchedule {
  const cur = h.read;
  if (cur && !sectionDismissed(cur)) return cur;
  const day = dayOf(now);
  const next: SectionSchedule = { ...cur, made: cur?.made ?? day, due: addDays(day, SECTION_IVL), ivl: SECTION_IVL };
  h.read = next;
  return next;
}

/**
 * Dismissed: `due`, `ivl`, `reps` and `af` dropped. The line stays only
 * when it has `boxes` (the passage's place on the page); otherwise it
 * goes. Null when it goes.
 */
export function dismissed(s: SectionSchedule): SectionSchedule | null {
  const { due: _d, ivl: _i, reps: _r, af: _a, ...rest } = s;
  return rest.boxes !== undefined ? rest : null;
}

/** Brought back: a fresh due in three days, the rest of the line (`reps` with it) kept. */
export function broughtBack(s: SectionSchedule | undefined, now: Date): SectionSchedule {
  const day = dayOf(now);
  return { ...s, made: s?.made ?? day, due: addDays(day, SECTION_IVL), ivl: SECTION_IVL };
}

/** One of the session's three: next (a pass), later (not counted), dismiss. Null when the line goes. */
export function advanceSchedule(s: SectionSchedule, action: ReadAction, now: Date): SectionSchedule | null {
  if (action === 'done') return dismissed(s);
  return action === 'on' ? readOn(s, now) : postpone(s, now);
}

/** How many days next would send it out: `back in Nd`. */
export const nextGap = (s: SectionSchedule): number => grow(s.ivl, s.af ?? READ_AF);

/**
 * The section's heading in `doc`: at `index` when it is still that
 * heading, else the first heading with its text. Null when it is gone.
 */
export function findHeading(doc: Doc, index: number, text: string): Heading | null {
  const at = doc.blocks[index];
  if (at?.kind === 'heading' && at.text === text) return at;
  return doc.blocks.find((b): b is Heading => b.kind === 'heading' && b.text === text) ?? null;
}

/**
 * Apply an action to the section's line in place, meant to run inside
 * `vault.update`: only that line changes. Throws when the heading is gone
 * or not enrolled.
 */
export function advanceSection(doc: Doc, index: number, text: string, action: ReadAction, now: Date): SectionSchedule | null {
  const h = findHeading(doc, index, text);
  if (!h?.read) throw new Error(`section "${text}" is not enrolled`);
  const next = advanceSchedule(h.read, action, now);
  if (next) h.read = next;
  else delete h.read;
  return next;
}
