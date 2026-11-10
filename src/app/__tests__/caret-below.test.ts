// @vitest-environment jsdom
// A press in a note's empty room below its text puts the caret on the text's
// last line (`caretBelow` in Reader.tsx): the end of a closing paragraph, else
// a new empty paragraph that a save drops again when nothing is typed in it.

import { EditorState } from 'prosemirror-state';
import { EditorView } from 'prosemirror-view';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { parse } from '../../format/index.js';
import { fromDoc, toDoc } from '../../reader/convert.js';

vi.mock('../bookPdf.js', () => ({ fillCrops() {}, acquirePdf: () => ({ promise: new Promise(() => {}), release() {} }), itemsOf: async () => [] }));
const { caretBelow, caretToPress } = await import('../Reader.js');

let view: EditorView;
afterEach(() => { view.destroy(); });
const open = (md: string, editable = true) => {
  view = new EditorView(document.body.appendChild(document.createElement('div')), {
    state: EditorState.create({ doc: toDoc(parse(md).doc.blocks) }),
    editable: () => editable,
  });
  // the text ends 100px down the page
  view.dom.getBoundingClientRect = () => ({ top: 0, bottom: 100, left: 0, right: 600, width: 600, height: 100, x: 0, y: 0, toJSON() {} });
  return view;
};
const caret = () => view.state.selection.from;

describe('a press below the text', () => {
  it('an empty note: the caret in its one line', () => {
    open('');
    expect(caretBelow(view, 400)).toBe(true);
    expect(view.state.doc.childCount).toBe(1);
    expect(caret()).toBe(1);
  });

  it('a closing paragraph: the caret at its end, nothing added', () => {
    open('first\n\nthe last line\n');
    expect(caretBelow(view, 400)).toBe(true);
    expect(view.state.doc.childCount).toBe(2);
    expect(caret()).toBe(view.state.doc.content.size - 1);
    expect(view.state.doc.lastChild!.textContent).toBe('the last line');
  });

  it('a closing heading: a new empty line after it, which a save drops untyped', () => {
    open('# kāna\n');
    expect(caretBelow(view, 400)).toBe(true);
    expect(view.state.doc.childCount).toBe(2);
    expect(view.state.doc.lastChild!.type.name).toBe('paragraph');
    expect(caret()).toBe(view.state.doc.content.size - 1);
    expect(fromDoc(view.state.doc).map((b) => b.kind)).toEqual(['heading']);
  });

  it('a press on the text, or a page that cannot be edited: nothing', () => {
    open('# kāna\n');
    expect(caretBelow(view, 60)).toBe(false);
    view.destroy();
    open('# kāna\n', false);
    expect(caretBelow(view, 400)).toBe(false);
    expect(view.state.doc.childCount).toBe(1);
  });
});

describe('a press beside or above the text (`caretToPress`)', () => {
  it('above it: the caret at its start', () => {
    open('first\n\nsecond\n');
    view.dom.getBoundingClientRect = () => ({ top: 50, bottom: 100, left: 0, right: 600, width: 600, height: 50, x: 0, y: 50, toJSON() {} });
    expect(caretToPress(view, 300, 10)).toBe(true);
    expect(caret()).toBe(1);
  });

  it('beside a line: the place the editor finds nearest, the press held inside the text', () => {
    open('first\n\nsecond\n');
    const asked: { left: number; top: number }[] = [];
    view.posAtCoords = (c) => { asked.push(c); return { pos: 9, inside: -1 }; };
    expect(caretToPress(view, 900, 60)).toBe(true);
    expect(asked).toEqual([{ left: 599, top: 60 }]);
    expect(caret()).toBe(9);
  });

  it('below it: as `caretBelow`', () => {
    open('# kāna\n');
    expect(caretToPress(view, 300, 400)).toBe(true);
    expect(view.state.doc.childCount).toBe(2);
    expect(caret()).toBe(view.state.doc.content.size - 1);
  });
});
