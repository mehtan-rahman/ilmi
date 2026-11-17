// Milestone 48: a note's boxed sections in book order, as notes written
// before milestone 81 have them; the read point (`pos`, `y`) moves forward
// only. Milestone 81: a passage kept with the PDF, in no note: its line,
// its item in the queue, what the session's three do to it.

import { describe, expect, it } from 'vitest';
import { meta, parse, serialize, type Heading } from '../../format/index.js';
import { advanceRead, advanceSchedule, docItems, inScope, isDue, itemSeed, newPassage, passageItem, passagesOf, pointOn, postponeOverflow, sameItem } from '../index.js';

const NOW = new Date('2026-11-02T10:00:00');
const NOTES = [
  '---', 'type: source', 'pdf: ../lindqvist.pdf', 'pages: 41-44', 'read: due=2026-11-02 ivl=2 reps=1 pos=41 y=0.500', '---', '',
  '## 3.2 · the partition function (3.9)', '<!-- read made=2026-10-20 due=2026-11-02 ivl=3 boxes=41:0.120:0.122:0.770:0.145 -->', '',
  'The sum is over states.', '',
  '## 3.3 · energy fluctuations (3.13–3.15)', '<!-- read made=2026-10-24 boxes=42:0.100:0.135:0.770:0.375 -->', '',
  '## my own heading', '',
  'Not a passage.', '',
].join('\n');

describe('passages in book order', () => {
  it('lists the boxed sections by where their first box is', () => {
    const { doc } = parse(NOTES);
    expect(passagesOf(doc.blocks).map((p) => [p.index, p.heading.text, p.boxes.length])).toEqual([
      [0, '3.2 · the partition function (3.9)', 1],
      [2, '3.3 · energy fluctuations (3.13–3.15)', 1],
    ]);
  });

});

describe('a passage kept with the PDF', () => {
  const BOXES = [{ page: 41, x: 0.12, y: 0.86, w: 0.77, h: 0.075 }, { page: 42, x: 0.1, y: 0.097, w: 0.77, h: 0.04 }];
  const HASH = 'ab'.repeat(32);

  it('is made today, back on the cadence of its priority, its boxes canonical', () => {
    expect(newPassage(BOXES, NOW)).toEqual({ made: '2026-11-02', due: '2026-11-04', ivl: 2, boxes: '41:0.120:0.860:0.770:0.075,42:0.100:0.097:0.770:0.040' });
    expect(newPassage(BOXES, NOW, 10).ivl).toBe(1);
    expect(newPassage(BOXES, NOW, 90).ivl).toBe(3);
  });

  it('is a section item of the document whose pages it is on, called by its pages and known by its boxes', () => {
    const sched = { ...newPassage(BOXES, NOW), due: '2026-11-02' };
    const item = passageItem('library/lindqvist/ch-3.md', HASH, sched, NOW, 30)!;
    expect(item).toMatchObject({ kind: 'section', path: 'library/lindqvist/ch-3.md', block: -1, heading: 'pp. 41–42', passage: { hash: HASH, boxes: sched.boxes }, pri: 30, written: false, cards: 0, due: '2026-11-02' });
    expect(inScope(item, 'reading', NOW)).toBe(true);
    expect(isDue(item, NOW)).toBe(true);
    // its own priority over the document's
    expect(passageItem('a.md', HASH, { ...sched, pri: 80 }, NOW, 30)!.pri).toBe(80);
    // dismissed (no due, its boxes kept): out of the queue
    expect(passageItem('a.md', HASH, { made: '2026-11-02', boxes: sched.boxes }, NOW)).toBeNull();
  });

  it('is the same item by its PDF and its boxes, whatever document shows it; another on the same page is another', () => {
    const sched = newPassage(BOXES, NOW);
    const a = passageItem('a.md', HASH, sched, NOW)!;
    const b = passageItem('a.md', HASH, { ...sched, due: '2026-11-09' }, NOW)!;
    const other = passageItem('a.md', HASH, newPassage([{ page: 41, x: 0.1, y: 0.2, w: 0.5, h: 0.1 }], NOW), NOW)!;
    expect(sameItem(a, b)).toBe(true);
    expect(sameItem(a, other)).toBe(false);
    expect(a.heading).toBe('pp. 41–42');
    expect(other.heading).toBe('p. 41');
    expect(itemSeed(a)).toBe(itemSeed(b));
    expect(itemSeed(a)).not.toBe(itemSeed(other));
    // a heading's section of the same words is not it
    const { doc } = parse('## pp. 41–42\n<!-- read due=2026-11-02 ivl=2 -->\n');
    const sec = docItems('a.md', doc, NOW).find((i) => i.kind === 'section')!;
    expect(sameItem(a, sec)).toBe(false);
  });

  it('next grows it and counts a pass, later does not count, dismiss leaves its boxes and what it was made', () => {
    const sched = { ...newPassage(BOXES, NOW), due: '2026-11-02' };
    const on = advanceSchedule(sched, 'on', NOW)!;
    expect(on).toMatchObject({ reps: 1, made: '2026-11-02', boxes: sched.boxes });
    expect(on.ivl!).toBeGreaterThan(2);
    const later = advanceSchedule(sched, 'postpone', NOW)!;
    expect(later.reps).toBeUndefined();
    expect(later.due! > '2026-11-02').toBe(true);
    expect(advanceSchedule(on, 'done', NOW)).toEqual({ made: '2026-11-02', boxes: sched.boxes });
  });

  it('in the backlog, is postponed by whoever keeps it, not through a file', async () => {
    const late = passageItem('a.md', HASH, { made: '2026-10-20', due: '2026-10-30', ivl: 2, boxes: '41:0.120:0.860:0.770:0.075' }, NOW)!;
    const asked: string[] = [];
    const vault = { update: async () => { throw new Error('a passage is in no file'); } };
    const done = await postponeOverflow(vault as never, [late], NOW, async (i) => { asked.push(i.passage!.boxes); });
    expect(done).toEqual([late]);
    expect(asked).toEqual(['41:0.120:0.860:0.770:0.075']);
  });
});

describe('the read point', () => {
  it('moves forward only, by page then down it; no y is the page\'s foot', () => {
    expect(pointOn({ pos: 41, y: 0.5 }, 42, 0.2)).toEqual({ pos: 42, y: 0.2 });
    expect(pointOn({ pos: 41, y: 0.5 }, 41, 0.7)).toEqual({ pos: 41, y: 0.7 });
    expect(pointOn({ pos: 41, y: 0.5 }, 41, 0.3)).toEqual({ pos: 41, y: 0.5 });
    expect(pointOn({ pos: 41 }, 41, 0.9)).toEqual({ pos: 41 });
    expect(pointOn({}, 41, 0.1)).toEqual({ pos: 41, y: 0.1 });
  });

  it('done for today records the point on the read line', () => {
    const { doc } = parse(NOTES);
    advanceRead(doc, 'on', NOW, 42, undefined, 0.74);
    expect(meta(doc).read).toMatchObject({ pos: 42, y: 0.74, reps: 2 });
    // a document read by its pages always has reading left: it comes back on its cadence
    expect(serialize(doc)).toContain('read: due=2026-11-04 ivl=2 reps=2 pos=42 y=0.740\n');
    const back = parse(NOTES).doc;
    advanceRead(back, 'on', NOW, 41, undefined, 0.2);
    expect(meta(back).read).toMatchObject({ pos: 41, y: 0.5 });
    expect((parse(NOTES).doc.blocks[0] as Heading).read?.boxes).toBe('41:0.120:0.122:0.770:0.145');
  });
});
