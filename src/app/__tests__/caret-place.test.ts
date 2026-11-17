// @vitest-environment jsdom
// Where a clip from a book's pages goes in its note (milestone 81): just
// after the block the caret is in, counted in the file's blocks, which are
// not the editor's (an empty line there is no block of the file).

import { NodeSelection, TextSelection } from 'prosemirror-state';
import { describe, expect, it } from 'vitest';
import { parse } from '../../format/index.js';
import { makeState } from '../../reader/index.js';
import { placeAtCaret } from '../sections.js';
import { blocksToCaret } from '../Reader.js';

const NOTE = ['first words', '', '## my heading', '', 'under it', '', '<!-- box 41:0.100:0.100:0.500:0.300 -->', '', 'word ::: meaning', '', 'the end', ''].join('\n');
const state = () => makeState(parse(NOTE).doc.blocks, { frozen: () => false, pos: null });
/** The position at the start of top-level node `i`. */
const posOf = (s: ReturnType<typeof state>, i: number) => { let off = 0; for (let k = 0; k < i; k++) off += s.doc.child(k).nodeSize; return off; };

describe('the place after the caret', () => {
  it('is after the block the caret is in: a paragraph, a heading, the last block', () => {
    const s = state();
    const at = (i: number) => blocksToCaret(s.apply(s.tr.setSelection(TextSelection.create(s.doc, posOf(s, i) + 1))));
    expect(at(0)).toBe(1);
    expect(at(1)).toBe(2);
    expect(at(2)).toBe(3);
    expect(at(5)).toBe(6);
  });

  it('is after a block that is selected whole: a clip, a card', () => {
    const s = state();
    const on = (i: number) => blocksToCaret(s.apply(s.tr.setSelection(NodeSelection.create(s.doc, posOf(s, i)))));
    expect(on(3)).toBe(4);
    expect(on(4)).toBe(5);
  });

  it('in an empty line (no block of the file) is where that line is', () => {
    let s = state();
    // an empty paragraph after the clip, the caret in it: as `m` leaves it
    const after = posOf(s, 4);
    s = s.apply(s.tr.insert(after, s.schema.nodes.paragraph!.create()));
    s = s.apply(s.tr.setSelection(TextSelection.create(s.doc, after + 1)));
    expect(blocksToCaret(s)).toBe(4);
  });

  it('a note that is not open, or whose caret no one put anywhere, has no place: the end', () => {
    expect(placeAtCaret('not/open.md')).toBeUndefined();
  });
});
