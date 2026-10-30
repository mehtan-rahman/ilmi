// @vitest-environment jsdom
// The editor's rest in the DOM (milestone 41): a heading's chevron folds
// its section and the folded line opens it; a code block's language named
// in its corner and changed from the picker; a table's cells drawn as the
// editor's own, a row and a column added at the edges, the cell's menu
// deleting them; the outline's jump going to the active reader.

import { TextSelection } from 'prosemirror-state';
import { EditorView } from 'prosemirror-view';
import { afterEach, describe, expect, it } from 'vitest';
import { parse, serialize } from '../../format/index.js';
import { flatText, fromDoc, makeState } from '../../reader/index.js';
import { goToHeading, registerHeadings } from '../headings.js';
import { closePopMenu, popMenuOpen } from '../popMenu.js';
import { nodeViews } from '../Reader.js';

// jsdom draws no boxes: ProseMirror's scroll to the caret asks a range for its rects
for (const proto of [Node.prototype, Range.prototype] as unknown as { getClientRects?: () => DOMRect[]; getBoundingClientRect?: () => DOMRect }[]) {
  proto.getClientRects ??= () => [];
  proto.getBoundingClientRect ??= () => new DOMRect();
}

function mount(md: string, frozen = false, folds?: string[]): EditorView {
  const state = makeState(parse(md).doc.blocks, { frozen: () => frozen, pos: null, ...(folds ? { folds } : {}) });
  return new EditorView(document.body.appendChild(document.createElement('div')), { state, nodeViews, editable: () => !frozen, attributes: { class: 'draft-doc' } });
}

const press = (el: Element) => el.dispatchEvent(new MouseEvent('mousedown', { bubbles: true, cancelable: true }));

function written(view: EditorView): string {
  const r = parse('');
  r.doc.blocks = fromDoc(view.state.doc);
  return serialize(r.doc).replace(/\n$/, '');
}

function caretIn(view: EditorView, needle: string): void {
  let found = -1;
  view.state.doc.descendants((node, pos) => {
    if (found >= 0) return false;
    if (!node.isTextblock) return true;
    const i = flatText(node).indexOf(needle);
    if (i >= 0) found = pos + 1 + i;
    return false;
  });
  view.dispatch(view.state.tr.setSelection(TextSelection.create(view.state.doc, found)));
}

afterEach(() => {
  closePopMenu();
  document.body.innerHTML = '';
});

describe('folding in the page', () => {
  const NOTE = '## lecture 8\n\nThe Boltzmann factor.\n\nq :: a\n\n## lecture 9\n\nThe partition function.';

  it('the chevron folds the section and the folded line says what it holds and opens it', () => {
    const view = mount(NOTE);
    const chevs = view.dom.querySelectorAll<HTMLElement>('.dd-h .fold-chev');
    expect(chevs).toHaveLength(2);
    // the heading's text is its own: the chevron is drawn by CSS
    expect(view.dom.querySelector('.dd-h')!.textContent).toBe('lecture 8');
    press(chevs[0]!);
    expect(Array.from(view.dom.querySelectorAll('.fold-hidden')).map((e) => e.textContent?.slice(0, 14))).toHaveLength(2);
    expect(view.dom.querySelector('.dd-h.fold-head .fold-chev')?.getAttribute('data-folded')).toBe('1');
    const more = view.dom.querySelector<HTMLElement>('.fold-more')!;
    expect(more.dataset.label).toBe('… 1 card');
    // the file is untouched
    expect(written(view)).toBe(NOTE);
    press(more);
    expect(view.dom.querySelectorAll('.fold-hidden')).toHaveLength(0);
    view.destroy();
  });

  it('a card kept in a folded section keeps the class through its view\'s redraws', () => {
    const view = mount(NOTE, false, ['2 lecture 8']);
    const card = view.dom.querySelector<HTMLElement>('.card-span')!;
    expect(card.classList.contains('fold-hidden')).toBe(true);
    // a change elsewhere redraws the card's view; the decoration's class stays
    caretIn(view, 'The partition');
    view.dispatch(view.state.tr.insertText('So: '));
    expect(view.dom.querySelector('.card-span')!.classList.contains('fold-hidden')).toBe(true);
    view.destroy();
  });
});

describe('a code block\'s language', () => {
  it('is named in the corner and changed from the picker, which writes the fence', () => {
    const view = mount('```py\nprint(1)\n```');
    const label = view.dom.querySelector<HTMLElement>('pre.dd-code .code-lang')!;
    expect(label.dataset.label).toBe('py');
    expect(view.dom.querySelector('pre.dd-code')!.textContent).toBe('print(1)');
    expect(view.dom.querySelector('pre.dd-code .hljs-built_in')?.textContent).toBe('print');
    press(label);
    const menu = popMenuOpen()!;
    expect(menu.classList.contains('code-langs')).toBe(true);
    expect(Array.from(menu.querySelectorAll('.ci')).map((r) => r.textContent?.replace(/^✓/, ''))).toEqual(['python', 'julia', 'matlab', 'c', 'c++', 'rust', 'javascript', 'typescript', 'bash', 'latex', 'json', 'plain']);
    expect(menu.querySelector('.ci.on')?.getAttribute('data-act')).toBe('lang-python');
    menu.querySelector<HTMLElement>('[data-act="lang-julia"]')!.click();
    expect(popMenuOpen()).toBeNull();
    expect(written(view)).toBe('```julia\nprint(1)\n```');
    expect(view.dom.querySelector<HTMLElement>('pre.dd-code .code-lang')!.dataset.label).toBe('julia');
    view.destroy();
  });

  it('opens no picker on a frozen page', () => {
    const view = mount('```py\nprint(1)\n```', true);
    press(view.dom.querySelector('.code-lang')!);
    expect(popMenuOpen()).toBeNull();
    view.destroy();
  });
});

describe('a table in the page', () => {
  const TABLE = '| form | perfect |\n| --- | --- |\n| II | فَعَّلَ |';

  it('draws its cells as the editor\'s own, the Arabic one right to left', () => {
    const view = mount(TABLE);
    const rows = Array.from(view.dom.querySelectorAll('.dd-table tr'));
    expect(rows.map((r) => Array.from(r.querySelectorAll('td')).map((c) => [c.textContent, c.getAttribute('dir')]))).toEqual([
      [['form', 'ltr'], ['perfect', 'ltr']], [['II', 'ltr'], ['فَعَّلَ', 'rtl']],
    ]);
    expect(view.dom.querySelector('.dd-table')!.getAttribute('contenteditable')).toBeNull();
    view.destroy();
  });

  it('adds a row and a column at the edges, the caret in the new cell, typed and written', () => {
    const view = mount(TABLE);
    press(view.dom.querySelector('.tb-add-row')!);
    expect(written(view)).toBe('| form | perfect |\n| --- | --- |\n| II | فَعَّلَ |\n|  |  |');
    // an empty new cell holds no widget for typed text to fall into
    const td = view.dom.querySelectorAll('.dd-table tr')[2]!.querySelector('td')!;
    expect(td.classList.contains('tb-cur')).toBe(true);
    expect(td.querySelector('[contenteditable="false"]')).toBeNull();
    view.dispatch(view.state.tr.insertText('III'));
    expect(written(view)).toBe('| form | perfect |\n| --- | --- |\n| II | فَعَّلَ |\n| III |  |');
    view.dispatch(view.state.tr.delete(view.state.selection.from - 3, view.state.selection.from));
    press(view.dom.querySelector('.tb-add-col')!);
    expect(written(view)).toBe('| form | perfect |  |\n| --- | --- | --- |\n| II | فَعَّلَ |  |\n|  |  |  |');
    view.destroy();
  });

  it('the caret\'s cell has a menu that adds, aligns, and deletes', () => {
    const view = mount(TABLE);
    caretIn(view, 'II');
    const cur = view.dom.querySelector<HTMLElement>('td.tb-cur')!;
    expect(cur.textContent).toBe('II');
    // the handle is the table's own, outside the cells: nothing but text is in a cell
    expect(cur.querySelector('.tb-more')).toBeNull();
    const more = view.dom.querySelector<HTMLElement>('.dd-table > .tb-more')!;
    expect(more.hidden).toBe(false);
    expect([more.dataset.row, more.dataset.col]).toEqual(['1', '0']);
    press(more);
    const menu = popMenuOpen()!;
    expect(Array.from(menu.querySelectorAll('.ci')).map((r) => r.getAttribute('data-act'))).toEqual([
      'row-above', 'row-below', 'col-before', 'col-after', 'align-left', 'align-center', 'align-right', 'delete-row', 'delete-col',
    ]);
    menu.querySelector<HTMLElement>('[data-act="align-right"]')!.click();
    expect(written(view)).toBe('| form | perfect |\n| ---: | --- |\n| II | فَعَّلَ |');
    caretIn(view, 'II');
    press(view.dom.querySelector('.dd-table > .tb-more')!);
    popMenuOpen()!.querySelector<HTMLElement>('[data-act="delete-col"]')!.click();
    expect(written(view)).toBe('| perfect |\n| --- |\n| فَعَّلَ |');
    caretIn(view, 'فَعَّلَ');
    press(view.dom.querySelector('.dd-table > .tb-more')!);
    popMenuOpen()!.querySelector<HTMLElement>('[data-act="delete-row"]')!.click();
    expect(written(view)).toBe('| perfect |\n| --- |');
    view.destroy();
  });

  it('offers no controls on a frozen page', () => {
    const view = mount(TABLE, true);
    press(view.dom.querySelector('.tb-add-row')!);
    expect(written(view)).toBe(TABLE);
    view.destroy();
  });
});

describe('the outline\'s jump', () => {
  it('goes to the active reader of the page first, and says when none has it', () => {
    const got: string[] = [];
    const off1 = registerHeadings('a.md', (i) => { got.push(`back ${i}`); return true; }, () => false);
    const off2 = registerHeadings('a.md', (i) => { got.push(`front ${i}`); return true; }, () => true);
    expect(goToHeading('a.md', 2)).toBe(true);
    expect(got).toEqual(['front 2']);
    off2();
    expect(goToHeading('a.md', 1)).toBe(true);
    expect(got).toEqual(['front 2', 'back 1']);
    off1();
    expect(goToHeading('a.md', 0)).toBe(false);
  });
});
