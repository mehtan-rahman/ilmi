// Milestone 48: `boxes` on a section's line and a clip's `<!-- box … -->`
// are `page:x:y:w:h` (`,` between boxes), fractions to three decimals; `y`
// on the `read` line is how far down page `pos` the read point is.

import { describe, expect, it } from 'vitest';
import {
  formatBoxes, formatClip, normalizeBoxes, pagesLabel, parse, parseBox, parseBoxes, parseClip, serialize, boxesAt, boxesEnd, meta, type Heading,
} from '../index.js';

describe('boxes', () => {
  it('reads page:x:y:w:h with "," between, and writes three decimals', () => {
    expect(parseBoxes('41:0.120:0.745:0.770:0.190,42:0.1:0.097:0.77:0.04')).toEqual([
      { page: 41, x: 0.12, y: 0.745, w: 0.77, h: 0.19 },
      { page: 42, x: 0.1, y: 0.097, w: 0.77, h: 0.04 },
    ]);
    expect(formatBoxes([{ page: 41, x: 0.1204, y: 0.7456, w: 0.77, h: 0.19 }])).toBe('41:0.120:0.746:0.770:0.190');
    expect(normalizeBoxes('7:0:0:1:1')).toBe('7:0.000:0.000:1.000:1.000');
  });

  it('refuses what is not in the grammar', () => {
    for (const bad of ['', '0:0.1:0.1:0.5:0.5', '41:0.1:0.1:0.5', '41:0.1:0.1:0.5:0.5:1', '41:1.2:0:0.1:0.1', '41:0.5:0:0.6:0.1', '41:0.1:0.1:0:0.1', '41:-0.1:0:0.5:0.5', '41:0.1:0.1:0.5:0.5,', '41:0.1:0.1:0.5:0.5, 42:0:0:1:1', 'p41:0:0:1:1', '41:0.1:0.1:5e-1:0.5'])
      expect(parseBoxes(bad), bad).toBeNull();
    // a box that reaches the edge by its rounding is in the page
    expect(parseBox('1:0.500:0.000:0.501:1.000')).not.toBeNull();
  });

  it('on a section line: written canonically; kept as written, with a diagnostic, when not in the grammar', () => {
    const ok = parse('## x\n<!-- read made=2026-10-30 boxes=41:0.12:0.745:0.77:0.19,42:0.1:0.097:0.77:0.04 -->\n');
    expect(ok.diagnostics).toEqual([]);
    expect(serialize(ok.doc)).toBe('## x\n<!-- read made=2026-10-30 boxes=41:0.120:0.745:0.770:0.190,42:0.100:0.097:0.770:0.040 -->\n');
    const bad = parse('## x\n<!-- read made=2026-10-30 boxes=page41 -->\n');
    expect((bad.doc.blocks[0] as Heading).read?.boxes).toBe('page41');
    expect(bad.diagnostics.map((d) => d.message)).toEqual(['boxes not in the grammar (page:x:y:w:h, "," between): page41; kept as written']);
    expect(serialize(bad.doc)).toBe('## x\n<!-- read made=2026-10-30 boxes=page41 -->\n');
  });

  it('where a passage starts and ends, and its pages as words', () => {
    const b = parseBoxes('41:0.120:0.745:0.770:0.190,42:0.100:0.097:0.770:0.040')!;
    expect(boxesAt(b)).toBeCloseTo(41.745);
    expect(boxesEnd(b)).toEqual({ page: 42, y: expect.closeTo(0.137, 6) });
    expect(pagesLabel(b)).toBe('pp. 41–42');
    expect(pagesLabel(b.slice(0, 1))).toBe('p. 41');
  });
});

describe('a clip', () => {
  it('is a comment line of its own, a raw block, read and written as one box', () => {
    const text = '## p. 129\n\n<!-- box 129:0.120:0.368:0.770:0.088 -->\n\nدَكَاكِينُ ::: shops\n';
    const { doc, diagnostics } = parse(text);
    expect(diagnostics).toEqual([]);
    const raw = doc.blocks[1]!;
    expect(raw.kind).toBe('raw');
    expect(parseClip(raw.text)).toEqual({ page: 129, x: 0.12, y: 0.368, w: 0.77, h: 0.088 });
    expect(serialize(doc)).toBe(text);
    expect(formatClip({ page: 3, x: 0.1, y: 0.2, w: 0.3, h: 0.4 })).toBe('<!-- box 3:0.100:0.200:0.300:0.400 -->');
    expect(parseClip('<!-- box 3:0.1:0.2 -->')).toBeNull();
    expect(parseClip('<!-- extract 3 -->')).toBeNull();
  });
});

describe('y on the read line', () => {
  it('sits after pos, three decimals, 0 to 1', () => {
    const text = '---\ntype: source\nread: due=2026-11-02 ivl=2 reps=1 pos=42 y=0.74 page=3\n---\n';
    const { doc, diagnostics } = parse(text);
    expect(diagnostics).toEqual([]);
    expect(meta(doc).read).toMatchObject({ pos: 42, y: 0.74 });
    expect(serialize(doc)).toBe('---\ntype: source\nread: due=2026-11-02 ivl=2 reps=1 pos=42 y=0.740 page=3\n---\n');
    const bad = parse('---\nread: pos=42 y=1.5\n---\n');
    expect(meta(bad.doc).read).toEqual({ pos: 42 });
    expect(bad.diagnostics.map((d) => d.message)).toEqual(['bad value for "y": 1.5']);
  });
});
