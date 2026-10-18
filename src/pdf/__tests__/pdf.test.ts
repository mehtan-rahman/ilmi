import { describe, expect, it } from 'vitest';
import { bibliographyStart, countIn, documentText, findAll, findText, jumpTarget, linesOf, pageText, refOf, stemShared, wordCount, type TextBit } from '../index.js';

const bit = (str: string, y: number, height = 12, eol = true): TextBit => ({ str, eol, y, height });

describe('finding a passage in a text layer', () => {
  const nodes = ['The ruler in the ', 'margin marks', ' the page you are on.', 'Nothing is', ' ever written.'];

  it('matches across nodes with whitespace ignored, and maps back to node offsets', () => {
    expect(findText(nodes, 'margin marks the page')).toEqual({ start: { node: 1, offset: 0 }, end: { node: 2, offset: 9 } });
    expect(findText(nodes, 'ruler\n in   the margin')).toEqual({ start: { node: 0, offset: 4 }, end: { node: 1, offset: 6 } });
    expect(findText(nodes, 'the page you are on. Nothing')).toEqual({ start: { node: 2, offset: 1 }, end: { node: 3, offset: 7 } });
    expect(findText(nodes, 'not there')).toBeNull();
    expect(findText(nodes, '  ')).toBeNull();
    expect(findText([], 'x')).toBeNull();
  });

  it('is case-sensitive unless told to fold, and finds every occurrence in order', () => {
    expect(findText(nodes, 'the ruler')).toBeNull();
    expect(findText(nodes, 'the ruler', true)).toEqual({ start: { node: 0, offset: 0 }, end: { node: 0, offset: 9 } });
    expect(findAll(nodes, 'the', true).map((f) => f.start)).toEqual([{ node: 0, offset: 0 }, { node: 0, offset: 13 }, { node: 2, offset: 1 }]);
    expect(findAll(['aaaa'], 'aa')).toHaveLength(2);
    expect(countIn('Spaced practice beats massed practice', 'practice')).toBe(2);
    expect(countIn('Spaced practice', 'PRACTICE')).toBe(1);
  });
});

describe('a page\'s text from pdf.js items', () => {
  it('joins items into lines and lines into paragraphs by the gaps between them', () => {
    const bits: TextBit[] = [
      bit('Two pages', 700, 20),
      bit('', 660, 0),
      bit('The lens opens a PDF beside its Markdown and reads it in place.', 660),
      bit('A selection on a page is a selection of text, so an extract or a card', 644),
      bit('can be carved from it.', 628),
      bit('A second para-', 600),
      bit('graph, after a gap.', 584),
      bit('Split ', 568, 12, false), bit('item', 568, 12, false), bit(' on one line.', 568),
    ];
    expect(linesOf(bits).map((l) => l.text)).toEqual([
      'Two pages', 'The lens opens a PDF beside its Markdown and reads it in place.',
      'A selection on a page is a selection of text, so an extract or a card', 'can be carved from it.',
      'A second para-', 'graph, after a gap.', 'Split item on one line.',
    ]);
    expect(pageText(bits)).toBe([
      'Two pages',
      'The lens opens a PDF beside its Markdown and reads it in place. A selection on a page is a selection of text, so an extract or a card can be carved from it.',
      'A second paragraph, after a gap. Split item on one line.',
    ].join('\n\n'));
  });

  it('handles the empty page, a trailing line without an EOL, and counts', () => {
    expect(pageText([])).toBe('');
    expect(pageText([bit('', 10, 0)])).toBe('');
    expect(pageText([bit('one', 100), bit('two', 84, 12, false)])).toBe('one two');
    expect(documentText(['a', '  ', 'b\n\nc'])).toBe('a\n\nb\n\nc');
    expect(wordCount('')).toBe(0);
    expect(wordCount(' one  two\nthree ')).toBe(3);
  });
});

describe('smart jump', () => {
  const pages: string[][] = [
    ['Two pages', 'Figure 1 shows the margin, and [1] names the method; see also (2) and Smith et al.', 'The ruler in the margin marks the page you are on.'],
    ['The second page', 'Figure 1. A ruler drawn in the margin of a page.', 'x = y + z (2)', 'References', '[1] Nobody. A paper that does not exist. 2026.', '[2] Smith, J. and Jones, K. Another that does not. 2019.'],
  ];

  it('reads a selection as a reference, or not', () => {
    expect(refOf('Figure 1')).toEqual({ kind: 'figure', type: 'Figure', n: '1' });
    expect(refOf('Fig. 3.2,')).toEqual({ kind: 'figure', type: 'Fig', n: '3.2' });
    expect(refOf('Table 4')).toEqual({ kind: 'figure', type: 'Table', n: '4' });
    expect(refOf('[12]')).toEqual({ kind: 'cite', key: '12' });
    expect(refOf('[12, 13]')).toEqual({ kind: 'cite', key: '12' });
    expect(refOf('(3)')).toEqual({ kind: 'equation', n: '3' });
    expect(refOf('Eq. 3')).toEqual({ kind: 'equation', n: '3' });
    expect(refOf('Smith et al.')).toEqual({ kind: 'author', name: 'Smith' });
    expect(refOf('Smith and Jones (2019)')).toEqual({ kind: 'author', name: 'Smith', year: '2019' });
    expect(refOf('Smith 2019')).toEqual({ kind: 'author', name: 'Smith', year: '2019' });
    for (const s of ['the ruler in the margin', '', 'a', '12', 'see Figure 1 for', 'in the margin.']) expect(refOf(s)).toBeNull();
  });

  it('finds captions, bibliography entries, and equations', () => {
    expect(jumpTarget(pages, refOf('Figure 1')!, 1)).toEqual({ page: 2, line: 1 });
    expect(jumpTarget(pages, refOf('Fig. 1')!, 1)).toEqual({ page: 2, line: 1 });
    expect(jumpTarget(pages, refOf('Figure 2')!, 1)).toBeNull();
    expect(jumpTarget(pages, refOf('[1]')!, 1)).toEqual({ page: 2, line: 4 });
    expect(jumpTarget(pages, refOf('[2]')!, 1)).toEqual({ page: 2, line: 5 });
    expect(jumpTarget(pages, refOf('[3]')!, 1)).toBeNull();
    expect(jumpTarget(pages, refOf('Smith et al.')!, 1)).toEqual({ page: 2, line: 5 });
    expect(jumpTarget(pages, refOf('Smith (2019)')!, 1)).toEqual({ page: 2, line: 5 });
    expect(jumpTarget(pages, refOf('Smith (2020)')!, 1)).toBeNull();
    expect(jumpTarget(pages, refOf('(2)')!, 1)).toEqual({ page: 2, line: 2 });
    expect(bibliographyStart(pages)).toBe(2);
    expect(bibliographyStart([['a'], ['b'], ['c'], ['d'], ['e']])).toBe(4);
    expect(stemShared('Fig', 'Figure')).toBe(3);
    expect(stemShared('Table', 'Figure')).toBe(0);
  });

  it('prefers the nearest page, and a caption with a period over a bare mention', () => {
    const many: string[][] = [['Figure 2 in passing'], ['Figure 2. The real caption.'], ['Figure 2. A second caption, further off.'], ['Figure 2 again']];
    expect(jumpTarget(many, refOf('Figure 2')!, 4)).toEqual({ page: 3, line: 0 });
    expect(jumpTarget(many, refOf('Figure 2')!, 1)).toEqual({ page: 2, line: 0 });
  });
});
