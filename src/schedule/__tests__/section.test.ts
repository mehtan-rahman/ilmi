// Milestone 47: sections that come back. The heading's line enrolled,
// passed (next), postponed (later), dismissed and brought back, each
// changing that one line; the queue sorting sections with reading and cards
// by priority and due, never by kind; a dismissed section out while its
// cards stay due.

import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { parse, serialize, type Heading } from '../../format/index.js';
import {
  SECTION_IVL, advanceSection, broughtBack, counts, dayOf, dismissed, docItems, enrolSection, headingAt, inScope, nextGap, overflow,
  queueItems, sameItem, sectionSpan, sectionState, type SectionItem,
} from '../index.js';

const NOW = new Date('2026-11-02T12:00:00Z');
const TODAY = dayOf(NOW);
const SAMPLE = join(import.meta.dirname, '../../../samples/double-major');
const CANON = 'courses/fall-2026/phys-415-stat-mech/canonical-ensemble.md';

const NOTE = `---
title: notes
pri: 40
---

# notes

## derivation
<!-- read made=2026-10-30 due=2026-11-02 ivl=3 -->

Typed up from paper.

### a step

More.

## with cards
<!-- read made=2026-10-19 due=2026-11-09 ivl=8 reps=2 pri=20 -->

term :: definition ^c1
<!-- sr due=2026-11-01 st=review s=3 d=5 r=2 l=0 ivl=4 last=2026-10-28T08:00:00Z g=3 -->

## nothing yet
<!-- read made=2026-11-02 due=2026-11-02 ivl=3 -->

## not enrolled

Text.
`;

/** Only the lines that differ between two texts. */
function changed(a: string, b: string): string[] {
  const x = a.split('\n');
  const y = b.split('\n');
  const out: string[] = [];
  for (let i = 0; i < Math.max(x.length, y.length); i++) if (x[i] !== y[i]) out.push(`${x[i] ?? ''} → ${y[i] ?? ''}`);
  return out;
}

describe('a section', () => {
  const { doc } = parse(NOTE);
  const at = (text: string) => doc.blocks.findIndex((b) => b.kind === 'heading' && b.text === text);

  it('spans its heading to the next heading of its level or higher, subheadings in it', () => {
    expect(sectionSpan(doc.blocks, at('derivation'))).toEqual({ start: at('derivation'), end: at('with cards') });
    expect(sectionSpan(doc.blocks, at('a step')).end).toBe(at('with cards'));
    expect(sectionSpan(doc.blocks, at('notes')).end).toBe(doc.blocks.length);
    expect(headingAt(doc.blocks, at('derivation') + 1)).toBe(at('derivation'));
    expect(headingAt(doc.blocks, 0)).toBe(0);
  });

  it('knows what is under it: written, and its cards', () => {
    expect(sectionState(doc.blocks, at('derivation'))).toEqual({ written: true, cards: 0 });
    expect(sectionState(doc.blocks, at('with cards'))).toEqual({ written: false, cards: 1 });
    expect(sectionState(doc.blocks, at('nothing yet'))).toEqual({ written: false, cards: 0 });
  });

  it('enrolls made today, back in three days; an enrolled line is left as it is', () => {
    const h: Heading = { kind: 'heading', level: 2, text: 'x' };
    expect(enrolSection(h, NOW)).toEqual({ made: TODAY, due: '2026-11-05', ivl: SECTION_IVL });
    const again = { ...h.read! };
    expect(enrolSection(h, new Date('2026-11-04T12:00:00Z'))).toEqual(again);
  });

  it('next grows the interval and counts the pass; later grows it less and does not count', () => {
    const s = { made: '2026-10-30', due: TODAY, ivl: 3 };
    const d = parse(`## x\n<!-- read made=2026-10-30 due=${TODAY} ivl=3 -->\n`).doc;
    expect(nextGap(s)).toBe(5);
    expect(advanceSection(d, 0, 'x', 'on', NOW)).toEqual({ made: '2026-10-30', due: '2026-11-07', ivl: 5, reps: 1 });
    expect(advanceSection(d, 0, 'x', 'postpone', NOW)).toEqual({ made: '2026-10-30', due: '2026-11-08', ivl: 6, reps: 1 });
  });

  it('dismissing drops due, ivl, reps and af; the line stays only with boxes', () => {
    expect(dismissed({ made: '2026-10-30', due: TODAY, ivl: 8, reps: 2, af: 2, pri: 30 })).toBeNull();
    expect(dismissed({ made: '2026-10-30', due: TODAY, ivl: 8, reps: 2, pri: 30, boxes: '41:0:0:1:1' })).toEqual({ made: '2026-10-30', pri: 30, boxes: '41:0:0:1:1' });
  });

  it('brought back: a fresh due in three days, the rest kept', () => {
    expect(broughtBack({ made: '2026-10-20', boxes: '41:0:0:1:1', pri: 30 }, NOW)).toEqual({ made: '2026-10-20', boxes: '41:0:0:1:1', pri: 30, due: '2026-11-05', ivl: 3 });
    expect(broughtBack({ made: '2026-10-20', reps: 4, due: '2026-12-01', ivl: 30 }, NOW)).toEqual({ made: '2026-10-20', reps: 4, due: '2026-11-05', ivl: 3 });
  });

  it('each of the three changes exactly the heading\'s line in the file', () => {
    for (const [action, line] of [
      ['on', '<!-- read made=2026-10-30 due=2026-11-07 ivl=5 reps=1 -->'],
      ['postpone', '<!-- read made=2026-10-30 due=2026-11-06 ivl=4 -->'],
    ] as const) {
      const d = parse(NOTE).doc;
      advanceSection(d, at('derivation'), 'derivation', action, NOW);
      expect(changed(NOTE, serialize(d))).toEqual([`<!-- read made=2026-10-30 due=2026-11-02 ivl=3 --> → ${line}`]);
    }
    const d = parse(NOTE).doc;
    advanceSection(d, at('derivation'), 'derivation', 'done', NOW);
    const out = serialize(d);
    expect(out).toBe(NOTE.replace('## derivation\n<!-- read made=2026-10-30 due=2026-11-02 ivl=3 -->\n', '## derivation\n'));
  });

  it('finds its heading by text when the blocks above it moved', () => {
    const d = parse(NOTE).doc;
    expect(advanceSection(d, 0, 'derivation', 'on', NOW)?.reps).toBe(1);
    expect(() => advanceSection(d, 0, 'not enrolled', 'on', NOW)).toThrow();
  });
});

describe('sections in the queue', () => {
  const items = docItems('notes.md', parse(NOTE).doc, NOW);
  const sections = items.filter((i): i is SectionItem => i.kind === 'section');

  it('one item per enrolled heading, with where it stands and its priority (its own, else the document\'s)', () => {
    expect(sections.map((s) => [s.heading, s.pri, s.written, s.cards, s.trail])).toEqual([
      ['derivation', 40, true, 0, ['notes', 'derivation']],
      ['with cards', 20, false, 1, ['notes', 'with cards']],
      ['nothing yet', 40, false, 0, ['notes', 'nothing yet']],
    ]);
  });

  it('counts as reading for the saved queries and the counts', () => {
    expect(sections.every((s) => inScope(s, 'reading', NOW))).toBe(true);
    expect(counts(items, NOW)).toMatchObject({ reading: 3, cards: 1, today: 3 });
  });

  it('is one element: the same heading, wherever it moved', () => {
    const moved = { ...sections[0]!, block: 99 };
    expect(sameItem(sections[0]!, moved)).toBe(true);
    expect(sameItem(sections[0]!, sections[1]!)).toBe(false);
  });

  it('interleaves with reading and cards by priority, then due, never grouped by kind', () => {
    const book = parse('---\ntype: source\npri: 30\nread: due=2026-11-01 ivl=2 reps=1 pos=3\n---\n\nOne.\n\nTwo.\n\nThree.\n\nFour.\n').doc;
    const deck = parse('---\ntype: deck\npri: 45\n---\n\nq :: a ^d1\n<!-- sr due=2026-11-02 st=review s=3 d=5 r=2 l=0 ivl=4 last=2026-10-29T08:00:00Z g=3 -->\n').doc;
    const q = queueItems([['notes.md', parse(NOTE).doc], ['book.md', book], ['deck.md', deck]], NOW);
    const due = q.filter((i) => i.dueAt <= NOW).map((i) => `${i.kind}:${i.pri}`);
    // the card due yesterday before the sections due today, at one priority
    expect(due).toEqual(['read:30', 'card:40', 'section:40', 'section:40', 'card:45']);
    // with cards (pri 20) is not due until the 9th: it waits below
    expect(q.find((i) => i.kind === 'section' && i.heading === 'with cards')!.dueAt > NOW).toBe(true);
  });

  it('a dismissed section leaves the queue; its cards stay due', () => {
    const d = parse(NOTE).doc;
    const i = d.blocks.findIndex((b) => b.kind === 'heading' && b.text === 'with cards');
    (d.blocks[i] as Heading).read = { due: TODAY, ivl: 3 };
    expect(docItems('notes.md', d, NOW).some((x) => x.kind === 'section' && x.heading === 'with cards')).toBe(true);
    advanceSection(d, i, 'with cards', 'done', NOW);
    const after = docItems('notes.md', d, NOW);
    expect(after.some((x) => x.kind === 'section' && x.heading === 'with cards')).toBe(false);
    expect(after.filter((x) => x.kind === 'card' && x.dueAt <= NOW)).toHaveLength(1);
    // with boxes the line stays, out of the queue
    (d.blocks[i] as Heading).read = { made: '2026-10-20', due: TODAY, boxes: '41:0:0:1:1' };
    advanceSection(d, i, 'with cards', 'done', NOW);
    expect((d.blocks[i] as Heading).read).toEqual({ made: '2026-10-20', boxes: '41:0:0:1:1' });
    expect(docItems('notes.md', d, NOW).some((x) => x.kind === 'section' && x.heading === 'with cards')).toBe(false);
  });

  it('below the fold, it is postponed with the reading and writing', () => {
    expect(overflow(items, NOW, 1).map((i) => i.kind)).toEqual(['section', 'section']);
  });
});

describe('the sample', () => {
  it('enrolls a typed-up derivation due today and a section with cards due later in canonical-ensemble', () => {
    const doc = parse(readFileSync(join(SAMPLE, CANON), 'utf8')).doc;
    const s = docItems(CANON, doc, NOW).filter((i): i is SectionItem => i.kind === 'section');
    expect(s.map((x) => [x.heading.slice(0, 30), x.written, x.cards, x.sched.reps ?? 0, x.dueAt <= NOW])).toEqual([
      ['pset 4 #5, typed up from paper', true, 0, 0, true],
      ['lecture 13 — two-level system,', true, 4, 2, false],
    ]);
  });
});
