// @vitest-environment jsdom
// Editing like an editor (milestone 34): the formatting keys, the block
// rules as they are typed, lists moved and indented with their children,
// links. Every case checks the Markdown the editor writes back, and that
// the file read again is what the editor holds.

import { EditorState, TextSelection } from 'prosemirror-state';
import { EditorView } from 'prosemirror-view';
import { describe, expect, it } from 'vitest';
import { parse, serialize, type Block } from '../../format/index.js';
import {
  displayMathRule, fenceRule, flatText, fromDoc, indentBlock, inlineRanges, linkTarget, makeState, mathEditKey, moveItem, outdentBlock,
  pasteLink, pressed, schema, setHeading, setLink, toDoc, toggleInline, toggleList, toggleQuote, toggleTasks, continueBlock, type InlineToggle,
} from '../index.js';
import type { Command } from 'prosemirror-state';

const live = { frozen: () => false, pos: null };

/** The editor over a file's body. */
const ed = (md: string): EditorState => makeState(parse(md).doc.blocks, live);

/** The body the editor writes back; and the file read again is what the editor holds. */
function md(state: EditorState): string {
  const blocks = fromDoc(state.doc);
  const r = parse('');
  r.doc.blocks = blocks;
  const out = serialize(r.doc);
  expect(parse(out).doc.blocks).toEqual(blocks);
  expect(fromDoc(toDoc(parse(out).doc.blocks))).toEqual(blocks);
  return out.replace(/\n$/, '');
}

/** The position `offset` characters into the first textblock holding `needle`, at the needle's start. */
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

const caret = (state: EditorState, needle: string, offset = 0) => state.apply(state.tr.setSelection(TextSelection.create(state.doc, at(state, needle, offset))));
const select = (state: EditorState, needle: string) => state.apply(state.tr.setSelection(TextSelection.create(state.doc, at(state, needle), at(state, needle) + needle.length)));
const span = (state: EditorState, a: string, b: string) => state.apply(state.tr.setSelection(TextSelection.create(state.doc, at(state, a), at(state, b) + b.length)));

/** Run a command; it must take the state. */
function run(state: EditorState, cmd: Command): EditorState {
  let next = state;
  expect(cmd(state, (tr) => { next = state.apply(tr); })).toBe(true);
  return next;
}

const selected = (state: EditorState) => state.doc.textBetween(state.selection.from, state.selection.to);

describe('formatting keys write the markers', () => {
  it('⌘B, ⌘I, ⌘E, ⌘⇧X wrap the selection and keep it selected; again takes the markers out', () => {
    const cases: [InlineToggle, string][] = [['strong', '**'], ['em', '*'], ['code', '`'], ['strike', '~~']];
    for (const [kind, m] of cases) {
      let s = select(ed('a word here'), 'word');
      s = run(s, toggleInline(kind));
      expect(md(s)).toBe(`a ${m}word${m} here`);
      expect(selected(s)).toBe('word');
      expect(inlineRanges(flatText(s.doc.child(0))).map((r) => r.kind)).toEqual([kind]);
      s = run(s, toggleInline(kind));
      expect(md(s)).toBe('a word here');
      expect(selected(s)).toBe('word');
    }
  });

  it('a caret inside a range takes its markers out; a caret elsewhere gets an empty pair to type into', () => {
    let s = caret(ed('so **bold** it'), 'bold', 2);
    s = run(s, toggleInline('strong'));
    expect(md(s)).toBe('so bold it');
    s = caret(ed('plain'), 'plain', 5);
    s = run(s, toggleInline('em'));
    s = s.apply(s.tr.insertText('x'));
    expect(md(s)).toBe('plain*x*');
  });

  it('a selection with spaces at its ends wraps only the words; a code span over a backtick takes a longer run; ⌘I inside bold adds emphasis', () => {
    let s = select(ed('one two three'), ' two ');
    s = run(s, toggleInline('strong'));
    expect(md(s)).toBe('one **two** three');
    s = select(ed('use a`b here'), 'a`b');
    s = run(s, toggleInline('code'));
    expect(md(s)).toBe('use ``a`b`` here');
    s = run(select(ed('**bold words**'), 'words'), toggleInline('em'));
    expect(md(s)).toBe('**bold *words***');
  });

  it('across two paragraphs both parts are wrapped, and taken out again; math inside stays a chip', () => {
    let s = span(ed('first $x$ line\n\nsecond line'), 'first', 'second');
    s = run(s, toggleInline('strong'));
    expect(md(s)).toBe('**first $x$ line**\n\n**second** line');
    s = run(s, toggleInline('strong'));
    expect(md(s)).toBe('first $x$ line\n\nsecond line');
    expect(s.doc.child(0).child(1).type).toBe(schema.nodes.math);
  });

  it('in code nothing changes, and the key is still taken', () => {
    const s = caret(ed('```js\nlet a = 1;\n```'), 'let', 1);
    const after = run(s, toggleInline('strong'));
    expect(md(after)).toBe('```js\nlet a = 1;\n```');
  });
});

describe('links', () => {
  it('⌘K over a selection makes a link; in a link it edits the address; an empty address unlinks', () => {
    let s = select(ed('read the spec today'), 'the spec');
    const t = linkTarget(s)!;
    expect(t).toMatchObject({ href: null });
    s = s.apply(setLink(s, t, 'https://example.org/a b')!);
    expect(md(s)).toBe('read [the spec](https://example.org/a%20b) today');
    expect(selected(s)).toBe('the spec');
    s = caret(s, 'spec', 1);
    const there = linkTarget(s)!;
    expect(there.href).toBe('https://example.org/a%20b');
    s = s.apply(setLink(s, there, 'https://x.y')!);
    expect(md(s)).toBe('read [the spec](https://x.y) today');
    s = s.apply(setLink(s, linkTarget(caret(s, 'spec'))!, '')!);
    expect(md(s)).toBe('read the spec today');
    // a bare caret outside a link: nothing to link, so ⌘K is the palette's
    expect(linkTarget(caret(s, 'today'))).toBeNull();
  });

  it('a pasted address over a selection links it; other text, or no selection, pastes as text', () => {
    const s = select(ed('see the notes'), 'notes');
    expect(md(s.apply(pasteLink(s, ' https://a.b/c?d=1 ')!))).toBe('see the [notes](https://a.b/c?d=1)');
    expect(pasteLink(s, 'not a link')).toBeNull();
    expect(pasteLink(caret(s, 'notes'), 'https://a.b')).toBeNull();
  });
});

describe('block keys', () => {
  it('⌘1–⌘6 set the level, the same level again or ⌘0 goes back to a paragraph', () => {
    let s = caret(ed('Title'), 'Title');
    s = run(s, setHeading(2));
    expect(md(s)).toBe('## Title');
    s = run(s, setHeading(1));
    expect(md(s)).toBe('# Title');
    s = run(s, setHeading(1));
    expect(md(s)).toBe('Title');
    s = run(run(s, setHeading(6)), setHeading(0));
    expect(md(s)).toBe('Title');
    // a list item leaves its list as the heading
    s = run(caret(ed('- one\n- two\n- three'), 'two'), setHeading(3));
    expect(md(s)).toBe('- one\n\n### two\n\n- three');
    // a paragraph that names itself keeps its id: it stays a paragraph
    s = run(caret(ed('Kept here ^p-1'), 'Kept'), setHeading(2));
    expect(md(s)).toBe('Kept here ^p-1');
  });

  it('⌘⇧8, ⌘⇧7, ⌘⇧9 make paragraphs a list and take it away again; they change an item\'s kind; a list beside is joined', () => {
    let s = caret(ed('milk'), 'milk');
    s = run(s, toggleList('bullet'));
    expect(md(s)).toBe('- milk');
    expect(s.selection.$from.parent.type).toBe(schema.nodes.list_item);
    s = run(s, toggleList('task'));
    expect(md(s)).toBe('- [ ] milk');
    s = run(s, toggleList('ordered'));
    expect(md(s)).toBe('1. milk');
    s = run(s, toggleList('ordered'));
    expect(md(s)).toBe('milk');
    s = run(span(ed('one\n\ntwo\n\nthree'), 'one', 'three'), toggleList('ordered'));
    expect(md(s)).toBe('1. one\n2. two\n3. three');
    // the middle item back to a paragraph: the list split around it, the rest keeping their numbers
    s = run(caret(s, 'two'), toggleList('ordered'));
    expect(md(s)).toBe('1. one\n\ntwo\n\n3. three');
    s = run(caret(ed('- a\n\nb\n\n- c'), 'b'), toggleList('bullet'));
    expect(md(s)).toBe('- a\n- b\n- c');
  });

  it('⌘⇧. makes paragraphs a quote, a line per line and a `>` line between, and back', () => {
    let s = caret(ed('said so'), 'said');
    s = run(s, toggleQuote);
    expect(md(s)).toBe('> said so');
    s = run(s, toggleQuote);
    expect(md(s)).toBe('said so');
    s = run(span(ed('one\nmore\n\ntwo'), 'one', 'two'), toggleQuote);
    expect(md(s)).toBe('> one\n> more\n>\n> two');
    expect(s.selection.$from.parent.type).toBe(schema.nodes.quote_line);
    s = run(caret(s, 'two', 2), toggleQuote);
    expect(md(s)).toBe('one\nmore\n\ntwo');
    expect(s.selection.$from.parentOffset).toBe(2);
    expect(s.selection.$from.parent.textContent).toBe('two');
  });
});

/** A view to type into, the input rules seeing each character as the browser would hand it over. */
function typer(md0: string | Block[], needle?: string, offset = 0) {
  const state = typeof md0 === 'string' ? ed(md0) : makeState(md0, live);
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

describe('block rules, as typed', () => {
  it('`- `, `* `, `1. `, `[ ] `, `> ` at a paragraph\'s start make the block; the text after the caret goes with it', () => {
    const cases: [string, string, string][] = [['- ', '- x', 'list_item'], ['* ', '* x', 'list_item'], ['3) ', '3) x', 'list_item'], ['[ ] ', '- [ ] x', 'list_item'], ['[x] ', '- [x] x', 'list_item'], ['> ', '> x', 'quote_line']];
    for (const [typed, out, parent] of cases) {
      const t = typer('x', 'x');
      t.type(typed);
      expect(md(t.view.state)).toBe(out);
      expect(t.view.state.selection.$from.parent.type.name).toBe(parent);
      expect(t.view.state.selection.$from.parentOffset).toBe(0);
      t.view.destroy();
    }
    // inside text, nothing fires
    const t = typer('ab', 'b');
    t.type('- ');
    expect(md(t.view.state)).toBe('a- b');
    t.view.destroy();
  });

  it('`# ` makes a heading and Backspace takes it back, as the other rules', () => {
    const t = typer('x', 'x');
    t.type('## ');
    expect(md(t.view.state)).toBe('## x');
    t.key('Backspace');
    expect(fromDoc(t.view.state.doc)).toEqual([{ kind: 'paragraph', text: '## x' }]);
    t.view.destroy();
  });

  it('Backspace right after a rule puts the typed text back', () => {
    const t = typer('x', 'x');
    t.type('- ');
    expect(md(t.view.state)).toBe('- x');
    expect(t.key('Backspace')).toBe(true);
    // the paragraph as typed (written so, the file would read it as a list again)
    expect(fromDoc(t.view.state.doc)).toEqual([{ kind: 'paragraph', text: '- x' }]);
    expect(t.view.state.selection.from).toBe(3);
    t.view.destroy();
  });

  it('`- ` under a list joins it; then ⏎ continues it', () => {
    const t = typer('- a\n\nb', 'b');
    t.type('- ');
    expect(md(t.view.state)).toBe('- a\n- b');
    t.view.dispatch(t.view.state.tr.setSelection(TextSelection.create(t.view.state.doc, at(t.view.state, 'b', 1))));
    t.key('Enter');
    t.type('c');
    expect(md(t.view.state)).toBe('- a\n- b\n- c');
    t.view.destroy();
  });

  it('`---` alone makes a rule with a paragraph after it; Backspace brings the dashes back', () => {
    const t = typer('before\n\n', 'before', 6);
    t.key('Enter');
    t.type('---');
    expect(fromDoc(t.view.state.doc)).toEqual([{ kind: 'paragraph', text: 'before' }, { kind: 'raw', text: '---' }]);
    expect(t.view.state.selection.$from.parent.type).toBe(schema.nodes.paragraph);
    t.type('after');
    expect(md(t.view.state)).toBe('before\n\n---\n\nafter');
    const u = typer('x');
    u.view.dispatch(u.view.state.tr.delete(1, 2));
    u.type('---');
    expect(u.key('Backspace')).toBe(true);
    expect(fromDoc(u.view.state.doc)).toEqual([{ kind: 'paragraph', text: '---' }]);
    t.view.destroy();
    u.view.destroy();
  });

  it('a fence line then ⏎ makes a code block to type in; Backspace right after brings the line back', () => {
    const para = (text: string): Block[] => [{ kind: 'paragraph', text }];
    const t = typer(para('```py'), '```py', 5);
    expect(t.key('Enter')).toBe(true);
    expect(t.view.state.selection.$from.parent.type).toBe(schema.nodes.code_block);
    expect(md(t.view.state)).toBe('```py\n\n```');
    t.type('x = 1');
    expect(md(t.view.state)).toBe('```py\nx = 1\n```');
    const u = typer(para('~~~'), '~~~', 3);
    u.key('Enter');
    expect(u.key('Backspace')).toBe(true);
    expect(fromDoc(u.view.state.doc)).toEqual([{ kind: 'paragraph', text: '~~~' }]);
    expect(u.view.state.selection.from).toBe(4);
    // a fence in a paragraph with more text after the caret is a paragraph's ⏎
    const js = makeState(para('```js'), live);
    expect(fenceRule(js.apply(js.tr.setSelection(TextSelection.create(js.doc, 3))), undefined)).toBe(false);
    t.view.destroy();
    u.view.destroy();
  });

  it('`$$` then ⏎ makes a display formula with its editor open', () => {
    let s = caret(ed('$$'), '$$', 2);
    s = run(s, displayMathRule((tr, pos) => tr.setMeta(mathEditKey, pos)));
    const chip = s.doc.child(0).child(0);
    expect(chip.type).toBe(schema.nodes.math);
    expect(chip.attrs.raw).toBe('$$ $$');
    expect(mathEditKey.getState(s)).toBe(1);
    expect(md(s)).toBe('$$ $$');
    // the same through the key
    const t = typer('$$', '$$', 2);
    expect(t.key('Enter')).toBe(true);
    expect(mathEditKey.getState(t.view.state)).toBe(1);
    t.view.destroy();
  });
});

describe('lists move with their children', () => {
  it('as the smoke types one: `- `, ⏎, Tab, ⇧Tab, ⌥⇧↓/↑, ⏎ out of it; a numbered list typed after stays its own', () => {
    const t = typer('end', 'end', 3);
    t.key('Enter');
    t.type('- adiabatic invariants');
    t.key('Enter');
    t.type('the action J');
    t.key('Tab');
    t.key('Enter');
    t.type('area of the ellipse');
    t.key('Tab');
    t.key('Enter');
    t.key('Tab', { shiftKey: true });
    t.key('Tab', { shiftKey: true });
    t.type('the golden rule');
    expect(md(t.view.state)).toBe('end\n\n- adiabatic invariants\n  - the action J\n    - area of the ellipse\n- the golden rule');
    t.view.dispatch(t.view.state.tr.setSelection(TextSelection.create(t.view.state.doc, at(t.view.state, 'adiabatic', 3))));
    expect(t.key('ArrowDown', { code: 'ArrowDown', altKey: true, shiftKey: true })).toBe(true);
    expect(md(t.view.state)).toBe('end\n\n- the golden rule\n- adiabatic invariants\n  - the action J\n    - area of the ellipse');
    t.key('ArrowUp', { code: 'ArrowUp', altKey: true, shiftKey: true });
    expect(md(t.view.state)).toBe('end\n\n- adiabatic invariants\n  - the action J\n    - area of the ellipse\n- the golden rule');
    t.view.dispatch(t.view.state.tr.setSelection(TextSelection.create(t.view.state.doc, at(t.view.state, 'golden rule', 11))));
    t.key('Enter');
    t.key('Enter');
    t.type('1. first');
    t.key('Enter');
    t.type('second');
    expect(md(t.view.state)).toBe('end\n\n- adiabatic invariants\n  - the action J\n    - area of the ellipse\n- the golden rule\n\n1. first\n2. second');
    t.view.destroy();
  });


  const tree = '- a\n- b\n  - b1\n    - b2\n- c';

  it('Tab puts an item and its children under the sibling before it; ⇧Tab brings them back out', () => {
    let s = caret(ed(tree), 'b');
    s = run(s, indentBlock);
    expect(md(s)).toBe('- a\n  - b\n    - b1\n      - b2\n- c');
    s = run(s, outdentBlock);
    expect(md(s)).toBe(tree);
    // a numbered item arriving first under its parent starts at 1; the rest number on
    s = run(caret(ed('1. one\n2. two\n3. three'), 'two'), indentBlock);
    expect(md(s)).toBe('1. one\n   1. two\n2. three');
    s = run(s, outdentBlock);
    expect(md(s)).toBe('1. one\n2. two\n3. three');
  });

  it('⏎ on an empty item set in outdents it, then leaves the list', () => {
    let s = caret(ed('- a\n  - b'), 'b', 1);
    s = run(s, continueBlock);
    expect(md(s)).toBe('- a\n  - b\n  - ');
    s = run(s, continueBlock);
    expect(md(s)).toBe('- a\n  - b\n- ');
    s = run(s, continueBlock);
    expect(md(s)).toBe('- a\n  - b');
    expect(s.selection.$from.parent.type).toBe(schema.nodes.paragraph);
  });

  it('⌥⇧↓ and ⌥⇧↑ trade an item and its children with the sibling next to it; the caret goes along; numbers follow', () => {
    let s = caret(ed(tree), 'a', 1);
    s = run(s, moveItem(1));
    expect(md(s)).toBe('- b\n  - b1\n    - b2\n- a\n- c');
    expect(s.selection.$from.parent.textContent).toBe('a');
    expect(s.selection.$from.parentOffset).toBe(1);
    s = run(caret(s, 'b1'), moveItem(-1));
    // b1 has no sibling before it: nothing moves, the key is still taken
    expect(md(s)).toBe('- b\n  - b1\n    - b2\n- a\n- c');
    s = run(caret(s, 'c'), moveItem(-1));
    expect(md(s)).toBe('- b\n  - b1\n    - b2\n- c\n- a');
    s = run(caret(s, 'c'), moveItem(-1));
    expect(md(s)).toBe('- c\n- b\n  - b1\n    - b2\n- a');
    s = run(caret(ed('1. one\n2. two\n3. three'), 'three'), moveItem(-1));
    expect(md(s)).toBe('1. one\n2. three\n3. two');
    s = run(caret(ed('4. d\n5. e'), 'e'), moveItem(-1));
    expect(md(s)).toBe('4. e\n5. d');
    // outside a list it is not taken: the system extends the selection
    expect(moveItem(1)(caret(ed('para'), 'para'), undefined)).toBe(false);
  });

  it('⌘⏎ ticks the task boxes the selection touches, and clears them when all were ticked', () => {
    let s = span(ed('- [ ] a\n- [x] b\n- c'), 'a', 'c');
    s = run(s, toggleTasks);
    expect(md(s)).toBe('- [x] a\n- [x] b\n- c');
    s = run(s, toggleTasks);
    expect(md(s)).toBe('- [ ] a\n- [ ] b\n- c');
    expect(toggleTasks(caret(s, 'c'), undefined)).toBe(false);
  });
});

describe('the keys on the surface', () => {
  const mod = /Mac/.test(navigator.platform) ? { metaKey: true } : { ctrlKey: true };

  it('are matched where the key is, so an Arabic layout presses the same ones; a frozen page takes none', () => {
    const t = typer('a word', 'word');
    t.view.dispatch(t.view.state.tr.setSelection(TextSelection.create(t.view.state.doc, at(t.view.state, 'word'), at(t.view.state, 'word') + 4)));
    expect(t.key('لا', { code: 'KeyB', ...mod })).toBe(true);
    expect(md(t.view.state)).toBe('a **word**');
    expect(t.key('*', { code: 'Digit8', shiftKey: true, ...mod })).toBe(true);
    expect(md(t.view.state)).toBe('- a **word**');
    expect(t.key('2', { code: 'Digit2', ...mod })).toBe(true);
    expect(md(t.view.state)).toBe('## a **word**');
    expect(t.key('>', { code: 'Period', shiftKey: true, ...mod })).toBe(true);
    // ⌘⇧E is extract, not code: not one of these
    expect(t.key('E', { code: 'KeyE', shiftKey: true, ...mod })).toBe(false);
    // ⌥⇧↑ outside a list is the system's
    expect(t.key('ArrowUp', { code: 'ArrowUp', altKey: true, shiftKey: true })).toBe(false);
    t.view.destroy();
    const f = new EditorView(document.body.appendChild(document.createElement('div')), { state: makeState(parse('a word').doc.blocks, { frozen: () => true, pos: null }), editable: () => false });
    const ev = new KeyboardEvent('keydown', { key: 'b', code: 'KeyB', bubbles: true, cancelable: true, ...mod });
    f.dom.dispatchEvent(ev);
    expect(ev.defaultPrevented).toBe(false);
    f.destroy();
    expect(pressed({ code: 'KeyB', shiftKey: true, altKey: false, metaKey: !!(mod as { metaKey?: boolean }).metaKey, ctrlKey: !!(mod as { ctrlKey?: boolean }).ctrlKey }, { code: 'KeyB', mod: true })).toBe(false);
  });

  it('a pasted address over a selection links it', () => {
    const t = typer('see notes', 'notes');
    t.view.dispatch(t.view.state.tr.setSelection(TextSelection.create(t.view.state.doc, 5, 10)));
    const ev = new Event('paste', { bubbles: true, cancelable: true }) as Event & { clipboardData: unknown };
    ev.clipboardData = { getData: (type: string) => (type === 'text/plain' ? 'https://a.b' : ''), types: ['text/plain'], files: [] };
    t.view.dom.dispatchEvent(ev);
    expect(md(t.view.state)).toBe('see [notes](https://a.b)');
    t.view.destroy();
  });
});
