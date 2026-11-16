// @vitest-environment jsdom
// The editor sweep of 2026-11-15: each case states the behaviour a daily user
// expects and fails until it is fixed. State-level, as editing.test.ts is.
import { EditorState, NodeSelection, TextSelection, type Command } from 'prosemirror-state';
import { EditorView } from 'prosemirror-view';
import { describe, expect, it } from 'vitest';
import { parse, serialize } from '../../format/index.js';
import { flatText, fromDoc, inlineRanges, makeState, pasteInto, toggleInline } from '../index.js';

const live = { frozen: () => false, pos: null };
const ed = (md: string): EditorState => makeState(parse(md).doc.blocks, live);
function out(state: EditorState): { text: string; stable: boolean } {
  const blocks = fromDoc(state.doc);
  const r = parse('');
  r.doc.blocks = blocks;
  const text = serialize(r.doc);
  let stable = true;
  try { expect(parse(text).doc.blocks).toEqual(blocks); } catch { stable = false; }
  return { text: text.replace(/\n$/, ''), stable };
}
function at(state: EditorState, needle: string, offset = 0): number {
  let found = -1;
  state.doc.descendants((node, pos) => {
    if (found >= 0) return false;
    if (!node.isTextblock) return true;
    const i = flatText(node).indexOf(needle);
    if (i >= 0) found = pos + 1 + i + offset;
    return false;
  });
  if (found < 0) throw new Error(`no "${needle}"`);
  return found;
}
function typer(md0: string, needle?: string, offset = 0) {
  const state = ed(md0);
  const view = new EditorView(document.body.appendChild(document.createElement('div')), { state });
  if (needle !== undefined) view.dispatch(view.state.tr.setSelection(TextSelection.create(view.state.doc, at(view.state, needle, offset))));
  const type = (text: string) => {
    for (const ch of text) {
      const { from, to } = view.state.selection;
      const handled = view.someProp('handleTextInput', (f) => f(view, from, to, ch, () => view.state.tr.insertText(ch, from, to)));
      if (!handled) view.dispatch(view.state.tr.insertText(ch, from, to));
    }
  };
  const key = (k: string, init: KeyboardEventInit = {}) => {
    const ev = new KeyboardEvent('keydown', { key: k, bubbles: true, cancelable: true, ...init });
    view.dom.dispatchEvent(ev);
    return ev.defaultPrevented;
  };
  return { view, type, key };
}
const run = (view: EditorView, cmd: Command) => cmd(view.state, view.dispatch);


import { clipboardText, findKey, replaceAll, continueBlock, joinBlock } from '../index.js';
import { undo } from 'prosemirror-history';


const cards = (state: EditorState): number => { let n = 0; state.doc.forEach((b) => { if (b.type.name === 'card') n++; }); return n; };

describe('editor sweep: cards are not lost to a stray key', () => {
  it('Backspace at the start of the paragraph after a card keeps the card', () => {
    const t = typer('intro\n\nwhat :: answer\n\nafter', 'after');
    t.key('Backspace');
    expect(cards(t.view.state)).toBe(1);
    expect(out(t.view.state).text).toContain('what :: answer');
  });

  it('Delete at the end of the paragraph before a card keeps the card', () => {
    const t = typer('intro\n\nwhat :: answer\n\nafter', 'intro', 5);
    t.key('Delete');
    expect(cards(t.view.state)).toBe(1);
  });

  it('a character typed (space, as in review) while a card is selected does not replace the card', () => {
    const t = typer('intro\n\nwhat :: answer\n\nafter', 'intro');
    let pos = -1;
    t.view.state.doc.forEach((n, p) => { if (n.type.name === 'card') pos = p; });
    t.view.dispatch(t.view.state.tr.setSelection(NodeSelection.create(t.view.state.doc, pos)));
    t.view.dom.dispatchEvent(new KeyboardEvent('keypress', { key: ' ', charCode: 32, keyCode: 32, bubbles: true, cancelable: true } as KeyboardEventInit));
    expect(cards(t.view.state)).toBe(1);
  });
});

describe('editor sweep: what is typed reads back as what the editor holds', () => {
  it('a closing fence typed in a code block, then ⏎, closes the block and goes on below it', () => {
    const t = typer('intro\n\nrest of the note', 'intro', 5);
    t.key('Enter');
    t.type('```');
    t.key('Enter');
    t.type('let a = 1');
    t.key('Enter');
    t.type('```');
    t.key('Enter');
    t.type('after');
    const o = out(t.view.state);
    expect(o.text).toBe('intro\n\n```\nlet a = 1\n```\n\nafter\n\nrest of the note');
    expect(o.stable).toBe(true);
  });

  it('⌘B or ⌘⇧X on an empty line, left for the autosave, is not read back as a rule or a fence over the rest of the note', () => {
    for (const kind of ['strong', 'strike'] as const) {
      const t = typer('first\n\nx\n\nlast para', 'x');
      t.view.dispatch(t.view.state.tr.delete(at(t.view.state, 'x'), at(t.view.state, 'x') + 1));
      run(t.view, toggleInline(kind));
      expect(out(t.view.state).stable, kind).toBe(true);
    }
  });

  it('a fence line typed and not yet entered, left for the autosave, does not take the rest of the note into a code block', () => {
    const t = typer('first\n\nx\n\nlast para', 'x');
    t.view.dispatch(t.view.state.tr.delete(at(t.view.state, 'x'), at(t.view.state, 'x') + 1));
    t.type('```');
    expect(out(t.view.state).stable).toBe(true);
  });

  it('`# ` typed at the start of a paragraph that has an id keeps the id', () => {
    const t = typer('some text ^abc\n\nnext', 'some');
    t.type('# ');
    expect(out(t.view.state).text).toContain('^abc');
  });

  it('Tab in a paragraph is taken by the editor (a tab at its start would read back as code)', () => {
    const t = typer('para', 'para');
    expect(t.key('Tab')).toBe(true);
  });

  it('`$` inside code spans makes no formula as it is typed', () => {
    const t = typer('x', 'x', 1);
    t.type(' run `$HOME` and `$PATH` now');
    let chips = 0;
    t.view.state.doc.descendants((n) => { if (n.type.name === 'math') chips++; });
    expect(chips).toBe(0);
  });
});

describe('editor sweep: lists', () => {
  it('list items pasted on an empty item join the list', () => {
    const t = typer('- a\n- b\n- c', 'c', 1);
    t.key('Enter');
    const tr = pasteInto(t.view.state, { html: '', text: '- x\n- y', plain: false });
    if (tr) t.view.dispatch(tr);
    expect(out(t.view.state).text).toBe('- a\n- b\n- c\n- x\n- y');
  });

  it('Delete held at the end of the paragraph before a list does not delete the whole list', () => {
    const t = typer('para\n\n- a\n- b', 'para', 4);
    t.key('Delete');
    t.key('Delete');
    expect(out(t.view.state).text).toContain('b');
  });
});

describe('editor sweep: links', () => {
  it('a bare address in the text is a link (drawn as one, ⌘-click opens it)', () => {
    const r = inlineRanges('see https://example.com/x now');
    expect(r.map((x) => x.kind)).toEqual(['link']);
    expect(r[0]?.href).toBe('https://example.com/x');
  });
});
