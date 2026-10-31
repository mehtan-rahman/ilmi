// @vitest-environment jsdom
// Milestone 46, the editor's open items: a card item moved in its list by
// Tab, ⇧Tab and ⌥⇧↑↓ like any item; ⏎ before a card item staying in the
// list; a card made inside a list landing as its next item; a heading in a
// list item folding its children; ⇧⏎ in a table cell as `<br>`. Every case
// checks the Markdown written back, and that the file read again is what
// the editor holds.

import { EditorState, NodeSelection, TextSelection, type Command } from 'prosemirror-state';
import { describe, expect, it } from 'vitest';
import { parse, serialize, type Card } from '../../format/index.js';
import {
  allSections, continueBlock, flatText, foldKey, foldedKeys, foldsHiding, fromDoc, indentBlock, insertCardItem, makeState, moveItem, outdentBlock,
  readTable, schema, toDoc, writeTable, cellBreak, blocksEqual, type FoldMeta,
} from '../index.js';
import { nodeToRaw, rawToNode } from '../raw.js';

const live = { frozen: () => false, pos: null };
const ed = (md: string): EditorState => makeState(parse(md).doc.blocks, live);

function md(state: EditorState): string {
  const blocks = fromDoc(state.doc);
  const r = parse('');
  r.doc.blocks = blocks;
  const out = serialize(r.doc);
  expect(parse(out).doc.blocks).toEqual(blocks);
  expect(fromDoc(toDoc(parse(out).doc.blocks))).toEqual(blocks);
  return out.replace(/\n$/, '');
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
const caret = (s: EditorState, needle: string, offset = 0) => s.apply(s.tr.setSelection(TextSelection.create(s.doc, at(s, needle, offset))));

/** The card atom whose text starts with `text`, node-selected. */
function pick(s: EditorState, text: string): EditorState {
  let pos = -1;
  s.doc.forEach((n, p) => { if (n.type === schema.nodes.card && (n.attrs.card as Card).text.startsWith(text)) pos = p; });
  if (pos < 0) throw new Error(`no card "${text}"`);
  return s.apply(s.tr.setSelection(NodeSelection.create(s.doc, pos)));
}

function run(s: EditorState, cmd: Command): EditorState {
  let next = s;
  expect(cmd(s, (tr) => { next = s.apply(tr); })).toBe(true);
  return next;
}

const selectedCard = (s: EditorState) => (s.selection instanceof NodeSelection ? (s.selection.node.attrs.card as Card).text : null);

describe('a card item moves in its list like any item', () => {
  const list = '- forces\n- $F = ma$ :: Newton II\n- energy\n- $E = T + V$ :: the Hamiltonian, when the constraints are fixed';

  it('Tab sets a card item under the item before it, ⇧Tab brings it back, the card kept selected', () => {
    let s = pick(ed(list), '$F = ma$');
    s = run(s, indentBlock);
    expect(md(s)).toBe('- forces\n  - $F = ma$ :: Newton II\n- energy\n- $E = T + V$ :: the Hamiltonian, when the constraints are fixed');
    expect(selectedCard(s)).toBe('$F = ma$ :: Newton II');
    s = run(s, outdentBlock);
    expect(md(s)).toBe(list);
    expect(selectedCard(s)).toBe('$F = ma$ :: Newton II');
  });

  it('⌥⇧↑ and ⌥⇧↓ trade a card item with its sibling, numbers kept in order', () => {
    const numbered = '1. one\n2. a :: b\n3. three\n4. c :: d';
    let s = pick(ed(numbered), 'a :: b');
    s = run(s, moveItem(-1));
    expect(md(s)).toBe('1. a :: b\n2. one\n3. three\n4. c :: d');
    expect(selectedCard(s)).toBe('a :: b');
    s = run(s, moveItem(1));
    s = run(s, moveItem(1));
    expect(md(s)).toBe('1. one\n2. three\n3. a :: b\n4. c :: d');
    // the file written and read back is what the editor holds, though a card moved first lost its join and the second gained one
    // (the window's run 1: a key-order difference made the reader rebuild from the file, and the selection went)
    const ids = '- a :: b ^ca\n  <!-- sr due=2026-11-02 st=review s=4 d=5 r=2 l=0 ivl=4 -->\n- c :: d ^cc';
    const moved = run(pick(ed(ids), 'c :: d'), moveItem(-1));
    const r = parse('');
    r.doc.blocks = fromDoc(moved.doc);
    const back = parse(serialize(r.doc)).doc.blocks;
    expect(JSON.stringify(fromDoc(moved.doc))).not.toBe(JSON.stringify(back));
    expect(blocksEqual(fromDoc(moved.doc), back)).toBe(true);
    expect(selectedCard(moved)).toBe('c :: d');
    // the last sibling stays, the key still taken
    s = run(pick(s, 'c :: d'), moveItem(1));
    expect(md(s)).toBe('1. one\n2. three\n3. a :: b\n4. c :: d');
  });

  it('a plain item takes the card items under it along, by Tab and by ⌥⇧↓', () => {
    const tree = '- a\n- b\n  - b1 :: card under b\n  - b2\n- c';
    let s = caret(ed(tree), 'b', 1);
    s = run(s, indentBlock);
    expect(md(s)).toBe('- a\n  - b\n    - b1 :: card under b\n    - b2\n- c');
    expect(s.selection.$from.parent.textContent).toBe('b');
    s = run(s, outdentBlock);
    s = run(s, moveItem(1));
    expect(md(s)).toBe('- a\n- c\n- b\n  - b1 :: card under b\n  - b2');
    expect(s.selection.$from.parent.textContent).toBe('b');
  });

  it('a card item with its schedule line keeps it under the item at its new column', () => {
    const src = '- a\n- f :: g\n  <!-- sr due=2026-11-02 st=review s=4 d=5 r=2 l=0 ivl=4 -->';
    const s = run(pick(ed(src), 'f :: g'), indentBlock);
    expect(md(s)).toBe('- a\n  - f :: g\n    <!-- sr due=2026-11-02 st=review s=4 d=5 r=2 l=0 ivl=4 -->');
  });
});

describe('⏎ on a plain item just before a card item', () => {
  it('makes the next item in the same list, the card renumbered after it', () => {
    let s = caret(ed('1. one\n   more\n2. a :: b\n3. three'), 'more', 4);
    s = run(s, continueBlock);
    s = s.apply(s.tr.insertText('two'));
    expect(md(s)).toBe('1. one\n   more\n2. two\n3. a :: b\n4. three');
    const back = parse(md(s)).doc.blocks;
    expect(back.map((b) => b.kind)).toEqual(['raw', 'card', 'raw']);
    expect(back.filter((b) => b.kind !== 'card' || b.joined).length).toBe(3);
  });
});

describe('a card made from a selection in a list', () => {
  it('lands as the next item after the item and its children, at its indentation', () => {
    const s = ed('Lecture notes.\n\n- the action\n  - J = ∮ p dq\n- the golden rule');
    const r = insertCardItem(s, at(s, 'the action', 3), { kind: 'card', text: 'the action variable :: $J = \\oint p\\,dq$' })!;
    const next = s.apply(r.tr);
    expect(md(next)).toBe('Lecture notes.\n\n- the action\n  - J = ∮ p dq\n- the action variable :: $J = \\oint p\\,dq$\n- the golden rule');
    expect((next.doc.nodeAt(r.pos)!.attrs.card as Card).item).toBe('- ');
    // made again after that one: after the card item
    const again = next.apply(insertCardItem(next, r.pos, { kind: 'card', text: 'adiabatic :: slow' })!.tr);
    expect(md(again)).toContain('- the action variable :: $J = \\oint p\\,dq$\n- adiabatic :: slow\n- the golden rule');
  });

  it('a numbered item: the next number, the ones after moved on', () => {
    const s = ed('1. first\n2. second');
    const next = s.apply(insertCardItem(s, at(s, 'first', 1), { kind: 'card', text: 'q :: a' })!.tr);
    expect(md(next)).toBe('1. first\n2. q :: a\n3. second');
  });

  it('a nested item: the card nested with it', () => {
    const s = ed('- a\n  - b\n- c');
    const next = s.apply(insertCardItem(s, at(s, 'b'), { kind: 'card', text: 'q :: a' })!.tr);
    expect(md(next)).toBe('- a\n  - b\n  - q :: a\n- c');
  });

  it('outside a list: nothing', () => {
    const s = ed('a paragraph');
    expect(insertCardItem(s, at(s, 'para'), { kind: 'card', text: 'q :: a' })).toBeNull();
  });
});

describe('a heading inside a list item folds its children', () => {
  const src = '- ## mechanics\n  - Newton\n  - $F = ma$ :: Newton II\n  - Lagrange\n- ## waves\n  - d\'Alembert';

  it('has a section over its children, through the card item and the pieces after it', () => {
    const s = ed(src);
    const secs = allSections(s.doc);
    expect(secs.map((x) => [x.key, x.blocks, x.cards])).toEqual([['- 2 mechanics', 3, 1], ['- 2 waves', 1, 0]]);
  });

  it('folds by decoration only: the file unchanged, the children hidden, kept by key, opened by the caret', () => {
    let s = ed(src);
    const mech = allSections(s.doc)[0]!;
    s = s.apply(s.tr.setMeta(foldKey, { toggle: mech.pos } satisfies FoldMeta));
    expect(foldedKeys(s)).toEqual(['- 2 mechanics']);
    expect(md(s)).toBe(src);
    expect(foldsHiding(s, at(s, 'Lagrange'))).toHaveLength(1);
    expect(foldsHiding(s, at(s, 'waves'))).toHaveLength(0);
    const decos = foldKey.getState(s)!.decos.find();
    expect(decos.filter((d) => (d.spec as { key?: string }).key?.startsWith('fold-more')).length).toBe(1);
    // the caret into a hidden child opens it
    s = caret(s, 'Lagrange');
    expect(foldedKeys(s)).toEqual([]);
    // restored by key on a fresh state
    let t = ed(src);
    t = t.apply(t.tr.setMeta(foldKey, { keys: ['- 2 waves'] } satisfies FoldMeta));
    expect(foldsHiding(t, at(t, 'Alembert'))).toHaveLength(1);
  });
});

describe('⇧⏎ in a table cell is a line break, written as <br>', () => {
  const table = '| term | meaning |\n| --- | --- |\n| kāna | was<br>to be |';

  it('reads `<br>` as a break in the cell, and writes the table back as it was', () => {
    const node = rawToNode(table)!;
    expect(node.type.name).toBe('table');
    expect(node.child(1).child(1).textContent).toBe('was\nto be');
    expect(nodeToRaw(node)).toBe(table);
  });

  it('⇧⏎ in a cell breaks the line; the file gets `<br>`, and reads back to the same cells', () => {
    let s = caret(ed(table), 'kāna', 4);
    s = run(s, cellBreak);
    s = s.apply(s.tr.insertText('verb'));
    expect(md(s)).toBe('| term | meaning |\n| --- | --- |\n| kāna<br>verb | was<br>to be |');
    expect(readTable(writeTable({ align: [null], head: ['a'], rows: [['x\ny']] }))!.rows).toEqual([['x<br>y']]);
  });

  it('outside a table ⇧⏎ is not the cell\'s', () => {
    const s = caret(ed('plain'), 'plain');
    expect(cellBreak(s, () => {})).toBe(false);
  });
});
