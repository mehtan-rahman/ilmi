// Milestone 48: boxes on the pages become a section, placed in book order
// among the passages; the read point (`pos`, `y`) moves forward only.

import { describe, expect, it } from 'vitest';
import { meta, parse, serialize, type Heading } from '../../format/index.js';
import { addPassage, advanceRead, freeName, passagesOf, placeOf, pointOn } from '../index.js';

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

  it('a new passage goes before the first that starts later, else at the end', () => {
    const { doc } = parse(NOTES);
    expect(placeOf(doc.blocks, [{ page: 41, x: 0.12, y: 0.86, w: 0.77, h: 0.075 }, { page: 42, x: 0.1, y: 0.097, w: 0.77, h: 0.04 }])).toBe(2);
    expect(placeOf(doc.blocks, [{ page: 41, x: 0, y: 0.01, w: 1, h: 0.05 }])).toBe(0);
    expect(placeOf(doc.blocks, [{ page: 43, x: 0, y: 0.2, w: 1, h: 0.1 }])).toBe(doc.blocks.length);
  });

  it('writes its heading and line, made today, back in three days, its boxes canonical', () => {
    const { doc } = parse(NOTES);
    const made = addPassage(doc, '3.3 · average values (3.12)', [{ page: 41, x: 0.12, y: 0.86, w: 0.77, h: 0.075 }, { page: 42, x: 0.1, y: 0.097, w: 0.77, h: 0.04 }], NOW);
    expect(made).toEqual({ index: 2, text: '3.3 · average values (3.12)' });
    expect(serialize(doc)).toContain('The sum is over states.\n\n## 3.3 · average values (3.12)\n<!-- read made=2026-11-02 due=2026-11-05 ivl=3 boxes=41:0.120:0.860:0.770:0.075,42:0.100:0.097:0.770:0.040 -->\n\n## 3.3 · energy fluctuations');
  });

  it('a name already taken gets a number', () => {
    const { doc } = parse(NOTES);
    expect(freeName(doc.blocks, 'my own heading')).toBe('my own heading · 2');
    expect(freeName(doc.blocks, 'p. 43')).toBe('p. 43');
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
    expect(serialize(doc)).toContain('read: due=2026-11-05 ivl=3 reps=2 pos=42 y=0.740\n');
    const back = parse(NOTES).doc;
    advanceRead(back, 'on', NOW, 41, undefined, 0.2);
    expect(meta(back).read).toMatchObject({ pos: 41, y: 0.5 });
    expect((parse(NOTES).doc.blocks[0] as Heading).read?.boxes).toBe('41:0.120:0.122:0.770:0.145');
  });
});
