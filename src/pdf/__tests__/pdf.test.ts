import { describe, expect, it } from 'vitest';
import { countIn, documentText, findAll, findText, linesOf, pageText, wordCount, type TextBit } from '../index.js';

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
