// Sections that come back: a heading's `<!-- read … -->` line (FORMAT.md
// §6.5) enrolls the heading and everything under it, up to the next heading
// of its level or higher. It first comes back on the cadence of its
// priority (`cadence`), then on the reading loop's growing interval, grown
// from the time elapsed: next counts a pass (`readOn`), later does not
// (`postpone`), dismiss ends it, its notes and cards left where they are.
// Pure; the queue makes an item of each (`queue.ts`), the app writes
// through `vault.update`.

import { PRI_DEFAULT, READ_AF, boxesAt, formatBoxes, meta, parseBoxes, sectionDismissed, type Block, type Box, type Doc, type Heading, type SectionSchedule } from '../format/index.js';
import { addDays, dayOf } from './dates.js';
import { cadence, grownAt } from './growth.js';
import { postpone, readOn, type ReadAction } from './read.js';

/** How far out a section first comes back, and comes back again when brought back: the cadence of its priority (the line's own, else the document's). */
export const firstGap = (pri: number | undefined): number => cadence(pri ?? PRI_DEFAULT);

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

/** Enroll: made today, back on its cadence (`pri` the document's; the line's own wins). A line already there is left as it is. */
export function enrolSection(h: Heading, now: Date, pri?: number): SectionSchedule {
  const cur = h.read;
  if (cur && !sectionDismissed(cur)) return cur;
  const day = dayOf(now);
  const ivl = firstGap(cur?.pri ?? pri);
  const next: SectionSchedule = { ...cur, made: cur?.made ?? day, due: addDays(day, ivl), ivl };
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

/** Brought back: a fresh due on its cadence, the rest of the line (`reps` with it) kept. */
export function broughtBack(s: SectionSchedule | undefined, now: Date, pri?: number): SectionSchedule {
  const day = dayOf(now);
  const ivl = firstGap(s?.pri ?? pri);
  return { ...s, made: s?.made ?? day, due: addDays(day, ivl), ivl };
}

/** One of the session's three: next (a pass), later (not counted), dismiss. Null when the line goes. */
export function advanceSchedule(s: SectionSchedule, action: ReadAction, now: Date): SectionSchedule | null {
  if (action === 'done') return dismissed(s);
  return action === 'on' ? readOn(s, now) : postpone(s, now);
}

/** How many days next would send it out at `now`: `back in Nd`, grown from the time elapsed. */
export const nextGap = (s: SectionSchedule, now: Date): number => grownAt(s, now, s.af ?? READ_AF);

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

// ── passages: sections tied to boxes on the document's pages (milestone 48) ──

/** A section whose line has boxes in the grammar: where it is in the blocks, its heading, its boxes. */
export interface Passage {
  index: number;
  heading: Heading;
  boxes: Box[];
}

/** Every passage of a document, in book order (by where its first box is); ties keep the file's order. */
export function passagesOf(blocks: readonly Block[]): Passage[] {
  const out: Passage[] = [];
  blocks.forEach((b, index) => {
    if (b.kind !== 'heading' || b.read?.boxes === undefined) return;
    const boxes = parseBoxes(b.read.boxes);
    if (boxes) out.push({ index, heading: b, boxes });
  });
  return out.sort((a, b) => boxesAt(a.boxes) - boxesAt(b.boxes) || a.index - b.index);
}

/**
 * Where a new passage's heading goes, in book order among the passages: just
 * before the first passage that starts later on the pages, else at the end.
 */
export function placeOf(blocks: readonly Block[], boxes: readonly Box[]): number {
  const at = boxesAt(boxes);
  let best = blocks.length;
  for (const p of passagesOf(blocks)) if (boxesAt(p.boxes) > at && p.index < best) best = p.index;
  return best;
}

/** A heading's text not already taken in the document: `name`, else `name · 2`, `name · 3`… */
export function freeName(blocks: readonly Block[], name: string): string {
  const taken = new Set(blocks.filter((b): b is Heading => b.kind === 'heading').map((b) => b.text));
  if (!taken.has(name)) return name;
  for (let n = 2; ; n++) if (!taken.has(`${name} · ${n}`)) return `${name} · ${n}`;
}

/**
 * Boxes on the pages become a section (FORMAT.md §6.5): a `##` heading named
 * `name`, its line `made=<today> due=<today+cadence> ivl=<cadence> boxes=…`
 * (the cadence of the document's priority), placed in book order. In
 * place, meant for `vault.update`; returns the heading's index, its text
 * (made unique) and its interval.
 */
export function addPassage(doc: Doc, name: string, boxes: readonly Box[], now: Date): { index: number; text: string; ivl: number } {
  const text = freeName(doc.blocks, name);
  const day = dayOf(now);
  const ivl = firstGap(meta(doc).pri);
  const h: Heading = { kind: 'heading', level: 2, text, read: { made: day, due: addDays(day, ivl), ivl, boxes: formatBoxes(boxes) } };
  const index = placeOf(doc.blocks, boxes);
  doc.blocks.splice(index, 0, h);
  return { index, text, ivl };
}
