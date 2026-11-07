// @vitest-environment jsdom
// Milestone 46, the open items as the app draws them: a card's step lines
// as lines in the reader's card view; a heading in a list item drawn as one
// with its chevron; ⇧⏎ in a table cell from the keyboard; the outline's
// folded headings found by the reader's own keys; formulas in the
// palette's card rows; no line under display math in WebKit.

import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { EditorView } from 'prosemirror-view';
import { NodeSelection, TextSelection } from 'prosemirror-state';
import { describe, expect, it } from 'vitest';
import { parse, serialize, type Block } from '../../format/index.js';
import { flatText, foldKey, fromDoc, makeState, sections, textOf, type FoldMeta } from '../../reader/index.js';
import { textEntry } from '../chrome.js';
import { cardHTML, handleClickOn, linesHTML, nodeViews, withSelectionOf } from '../Reader.js';
import { foldedHeadings, headingKeys } from '../tabs.js';

const SAMPLE = join(import.meta.dirname, '../../../samples/double-major');

function mount(blocks: Block[]): EditorView {
  const state = makeState(blocks, { frozen: () => false, pos: null });
  return new EditorView(document.body.appendChild(document.createElement('div')), { state, nodeViews, editable: () => true, attributes: { class: 'draft-doc' }, handleClickOn });
}

const STEPS = 'derive ⟨E⟩ for the two-level system\n?\n1. $\\langle E \\rangle = -\\partial_\\beta \\ln Z$\n2. $= \\epsilon / (e^{\\beta\\epsilon} + 1)$';

describe('a card\'s step lines in the reader', () => {
  it('draws each line of a face on its own, a formula over lines kept whole', () => {
    expect(linesHTML('one\ntwo')).toBe('one<br>two');
    // a display formula written over three lines is one formula, not three lines
    expect(linesHTML('so\n$$\na = b\n$$\nend').split('<br>')).toHaveLength(3);
    const html = cardHTML({ kind: 'card', text: STEPS });
    const back = html.slice(html.indexOf('cs-a'));
    expect(back.split('<br>')).toHaveLength(2);
  });

  it('the card view shows the steps as two lines under the question', () => {
    const view = mount(parse(`${STEPS}\n`).doc.blocks);
    const a = view.dom.querySelector('.card-span .cs-a')!;
    expect(a.querySelectorAll('br')).toHaveLength(1);
    expect(a.textContent).toContain('1. ');
    expect(a.textContent).toContain('2. ');
    view.destroy();
  });
});

describe('a selected card through a rebuild from the file', () => {
  it('the caret keeps its place in its block when typed formulas become chips (49)', () => {
    const live = { frozen: () => false, pos: null };
    const prev0 = makeState(parse('abc\n\n## the next heading, long enough to land in\n').doc.blocks, live);
    const end = prev0.doc.child(0).nodeSize - 1;
    const typed = prev0.apply(prev0.tr.insertText(' $x+y$ and $\\int f$ end', end));
    const prev = typed.apply(typed.tr.setSelection(TextSelection.create(typed.doc, typed.doc.child(0).nodeSize - 1)));
    expect(prev.doc.child(0).childCount).toBe(1);
    const file = parse('').doc;
    file.blocks = fromDoc(prev.doc);
    const next = makeState(parse(serialize(file)).doc.blocks, live);
    expect(next.doc.child(0).childCount).toBeGreaterThan(1);
    const got = withSelectionOf(prev, next);
    const $h = got.doc.resolve(got.selection.head);
    expect($h.parent).toBe(got.doc.child(0));
    expect($h.parentOffset).toBe(got.doc.child(0).content.size);
    // in the middle of the text, after a chip: the same offset in the verbatim text
    const mid = prev.apply(prev.tr.setSelection(TextSelection.create(prev.doc, 1 + 'abc $x+y$ and'.length)));
    const $m = withSelectionOf(mid, next).doc.resolve(withSelectionOf(mid, next).selection.head);
    expect(textOf(next.doc.child(0).cut(0, $m.parentOffset))).toBe('abc $x+y$ and');
  });

  it('a line that became a card in the rebuilt document leaves the caret right after the card', () => {
    const live = { frozen: () => false, pos: null };
    const prev0 = makeState(parse('## a heading\n\nabc\n\n## the next heading\n').doc.blocks, live);
    const end = prev0.doc.child(1).nodeSize + prev0.doc.child(0).nodeSize - 1;
    const typed = prev0.apply(prev0.tr.insertText(' {{c1::$x$}} done', end).insertText('3. ', prev0.doc.child(0).nodeSize + 1));
    const prev = typed.apply(typed.tr.setSelection(TextSelection.create(typed.doc, typed.doc.child(0).nodeSize + typed.doc.child(1).nodeSize - 1)));
    const file = parse('').doc;
    file.blocks = fromDoc(prev.doc);
    const next = makeState(parse(serialize(file)).doc.blocks, live);
    expect(next.doc.child(1).type.name).toBe('card');
    expect((next.doc.child(1).attrs.card as { item?: string }).item).toBe('3. ');
    const got = withSelectionOf(prev, next);
    expect(got.selection instanceof NodeSelection && got.selection.node.type.name === 'card').toBe(true);
    expect(got.selection.from).toBe(got.doc.child(0).nodeSize);
  });

  it('stays selected: the same card by id, after it moved', () => {
    const live = { frozen: () => false, pos: null };
    const before = makeState(parse('- a :: b ^ca\n- c :: d ^cc\n').doc.blocks, live);
    let at = -1;
    before.doc.forEach((n, p) => { if (n.type.name === 'card' && (n.attrs.card as { id?: string }).id === 'cc') at = p; });
    const prev = before.apply(before.tr.setSelection(NodeSelection.create(before.doc, at)));
    const next = withSelectionOf(prev, makeState(parse('- c :: d ^cc\n- a :: b ^ca\n').doc.blocks, live));
    expect(next.selection instanceof NodeSelection && (next.selection.node.attrs.card as { id?: string }).id).toBe('cc');
  });
});

describe('a heading inside a list item', () => {
  it('is drawn as a heading with a chevron, and folds its children by a press', () => {
    const src = '- ## mechanics\n  - Newton\n  - $F = ma$ :: Newton II\n- ## waves\n  - d\'Alembert\n';
    const view = mount(parse(src).doc.blocks);
    const head = view.dom.querySelector<HTMLElement>('.dd-li.li-h')!;
    expect(head.dataset.level).toBe('2');
    const chev = head.querySelector<HTMLElement>('.fold-chev')!;
    expect(chev.dataset.folded).toBe('0');
    chev.dispatchEvent(new MouseEvent('mousedown', { bubbles: true, cancelable: true }));
    const hidden = Array.from(view.dom.querySelectorAll<HTMLElement>('.fold-hidden'));
    expect(hidden).toHaveLength(2);
    expect(hidden[0]!.textContent).toContain('Newton');
    expect(hidden[1]!.classList.contains('card-span')).toBe(true);
    expect(view.dom.querySelectorAll('.fold-hidden .dd-li, .dd-li.fold-hidden').length).toBe(1);
    expect(view.dom.querySelector('.dd-li.li-h.fold-head .fold-more')?.getAttribute('data-label')).toBe('… 1 card');
    // drawn again after an edit elsewhere: the classes stay
    let end = -1;
    view.state.doc.descendants((n, p) => { if (n.isTextblock && flatText(n) === "d'Alembert") end = p + n.nodeSize - 1; });
    view.dispatch(view.state.tr.insertText('!', end));
    expect(view.dom.querySelector('.dd-li.li-h.fold-head')).not.toBeNull();
    expect(serialize({ blocks: fromDoc(view.state.doc) })).toBe(src.replace("d'Alembert", "d'Alembert!"));
    view.destroy();
  });
});

describe('⇧⏎ in a table cell from the keyboard', () => {
  it('breaks the line in the cell and writes `<br>`', () => {
    const src = '| term | meaning |\n| --- | --- |\n| kāna | was |\n';
    const view = mount(parse(src).doc.blocks);
    let at = -1;
    view.state.doc.descendants((n, p) => { if (n.type.name === 'table_cell' && n.textContent === 'kāna') at = p + n.nodeSize - 1; });
    view.dispatch(view.state.tr.setSelection(TextSelection.create(view.state.doc, at)));
    view.dom.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', shiftKey: true, bubbles: true, cancelable: true }));
    view.dispatch(view.state.tr.insertText('verb'));
    expect(serialize({ blocks: fromDoc(view.state.doc) })).toBe('| term | meaning |\n| --- | --- |\n| kāna<br>verb | was |\n');
    view.destroy();
  });

  it('text typed after the break and read from the DOM keeps the break (WebKit types into the text node; the window\'s run 2)', async () => {
    const src = '| term | meaning |\n| --- | --- |\n| kāna | was |\n';
    const view = mount(parse(src).doc.blocks);
    let at = -1;
    view.state.doc.descendants((n, p) => { if (n.type.name === 'table_cell' && n.textContent === 'kāna') at = p + n.nodeSize - 1; });
    view.dispatch(view.state.tr.setSelection(TextSelection.create(view.state.doc, at)));
    view.dom.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', shiftKey: true, bubbles: true, cancelable: true }));
    // the browser, not ProseMirror, puts the typed letters into the cell's text node; ProseMirror reads them back from the DOM
    const td = Array.from(view.dom.querySelectorAll('td')).find((c) => c.textContent?.startsWith('kāna'))!;
    const walker = document.createTreeWalker(td, NodeFilter.SHOW_TEXT);
    const node = walker.nextNode() as Text;
    expect(node.data).toBe('kāna\n');
    node.data = 'kāna\nverb';
    (view as unknown as { domObserver: { flush(): void } }).domObserver.flush();
    expect(serialize({ blocks: fromDoc(view.state.doc) })).toBe('| term | meaning |\n| --- | --- |\n| kāna<br>verb | was |\n');
    view.destroy();
  });
});

describe('the outline marks folded headings', () => {
  it('keys the headings as the reader\'s folds do, repeats numbered, over a sample note', () => {
    const text = readFileSync(join(SAMPLE, 'courses/fall-2025/phys-301-classical-mechanics/lagrangian-mechanics.md'), 'utf8');
    const blocks = parse(text).doc.blocks;
    const state = makeState(blocks, { frozen: () => false, pos: null });
    expect(headingKeys(blocks)).toEqual(sections(state.doc).map((s) => s.key));
    // fold the second heading in the reader: the outline's set names it, by its index among the headings
    const sec = sections(state.doc).filter((s) => s.blocks > 0)[1]!;
    const folded = state.apply(state.tr.setMeta(foldKey, { toggle: sec.pos } satisfies FoldMeta));
    const keys = sections(folded.doc).filter((s) => foldKey.getState(folded)!.folded.includes(s.pos)).map((s) => s.key);
    const set = foldedHeadings(blocks, keys);
    expect([...set]).toEqual([sections(state.doc).findIndex((x) => x.pos === sec.pos)]);
    expect(foldedHeadings(blocks, undefined).size).toBe(0);
    const twice = parse('## a\n\nx\n\n## a\n\ny\n').doc.blocks;
    expect(headingKeys(twice)).toEqual(['2 a', '2 a (2)']);
    expect([...foldedHeadings(twice, ['2 a (2)'])]).toEqual([1]);
  });
});

describe('formulas in the palette', () => {
  it('a card row carries its whole name with the formula, drawn by KaTeX; search reads the plain title', () => {
    const entry = (text: string) => textEntry({ path: 'n.md', block: 0, kind: 'card', card: null, text }, 'x', {});
    const first = entry('the action $J = \\oint p\\,dq$ :: adiabatic invariant');
    expect(first.math).toBe('the action $J = \\oint p\\,dq$');
    expect(first.title).not.toContain('$');
    expect(entry('plain :: words').math).toBeUndefined();
    // the whole name is drawn: the row's width cuts it, not the title (the window's run 3)
    const long = entry('time evolution of a phase-space function $f(q,p,t)$ in Poisson-bracket form :: $\\dfrac{df}{dt} = \\{f,H\\}$');
    expect(long.title).not.toContain('Poisson-bracket form');
    expect(long.math).toContain('$f(q,p,t)$');
  });
});

describe('display math in WebKit', () => {
  it('hides the separator image ProseMirror puts after a non-editable formula, as it hides the break', () => {
    const css = readFileSync(join(import.meta.dirname, '../reader.css'), 'utf8');
    expect(css).toMatch(/\.math\.display ~ img\.ProseMirror-separator \{ display: none; \}/);
    expect(css).toMatch(/\.math\.display:has\(~ img\.ProseMirror-separator\)/);
  });
});
