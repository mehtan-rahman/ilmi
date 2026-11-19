// @vitest-environment jsdom
// Several rows selected in the tree, in the DOM: ⇧-click a range and ⌘-click
// a row in or out (neither opens anything), ⇧↑ ⇧↓, ⌘A, Esc; the menu of
// several and what it does; ⌘⌫ on several, asked once and deleted as one; a
// drag of one taking them all, in order; a menu on a row outside the
// selection; a folder and a row inside it as the folder; and under a finger
// the menu's `select` and the line at the tree's head. The vault's writers
// are stubbed and named; the delete's one notice and one undo over a real
// vault is `remove.test.ts`'s.

import { act, createElement } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { TreeNode } from '../../vault/index.js';
import { SLOP, endDrag, useDrag } from '../drag.js';
import type { OpenOpts } from '../panes.js';
import { useApp } from '../store.js';

const calls: string[] = [];

vi.mock('../vault.js', async (orig) => {
  const real = await orig<typeof import('../vault.js')>();
  return {
    ...real,
    placeNode: vi.fn(async (path: string, target: string, mode: string) => { calls.push(`place ${path} ${mode} ${target}`); return path; }),
    moveNode: vi.fn(async (path: string, dir: string) => { calls.push(`move ${path} > ${dir}`); return path; }),
    duplicateNode: vi.fn(async (path: string) => { calls.push(`duplicate ${path}`); return path; }),
    renameNode: vi.fn(async (path: string, name: string) => { calls.push(`rename ${path}|${name}`); return path; }),
    openNode: vi.fn((path: string, opts: OpenOpts = {}) => { calls.push(`open ${path}${opts.newTab ? ' in a new tab' : ''}`); }),
    openNodeBeside: vi.fn((path: string) => { calls.push(`beside ${path}`); }),
  };
});

// every delete goes through `remove.ts`: one node's, or several as one
vi.mock('../remove.js', () => ({
  deleteNode: vi.fn(async (path: string) => { calls.push(`remove ${path}`); }),
  deleteNodes: vi.fn(async (paths: string[]) => { calls.push(`remove as one: ${paths.join(', ')}`); }),
}));

vi.mock('../deckOps.js', async (orig) => {
  const real = await orig<typeof import('../deckOps.js')>();
  return { ...real, studyNodes: vi.fn((ids: string[], back: string) => { calls.push(`study ${ids.join(', ')} from ${back}`); return 1; }) };
});

const { Tree } = await import('../Tree.js');
const { Lens } = await import('../Lenses.js');

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

const TREE: TreeNode[] = [
  { kind: 'folder', name: 'courses', path: 'courses', children: [
    { kind: 'doc', name: 'qm.md', path: 'courses/qm.md', children: [
      { kind: 'doc', name: 'pt.md', path: 'courses/qm/pt.md' },
      { kind: 'doc', name: 'wkb.md', path: 'courses/qm/wkb.md' },
    ] },
    { kind: 'folder', name: 'problem-sets', path: 'courses/problem-sets', children: [{ kind: 'doc', name: 'ps-5.md', path: 'courses/problem-sets/ps-5.md' }] },
  ] },
  { kind: 'folder', name: 'empty', path: 'empty', children: [] },
  { kind: 'doc', name: 'notes.md', path: 'notes.md' },
  { kind: 'doc', name: 'vocab.md', path: 'vocab.md' },
];
const DOCS = {
  'courses/qm.md': { type: 'note' as const, title: 'quantum II', frozen: false, cards: 0, due: 0 },
  'courses/qm/pt.md': { type: 'note' as const, title: 'perturbation theory', frozen: false, cards: 0, due: 0 },
  'courses/qm/wkb.md': { type: 'note' as const, frozen: false, cards: 0, due: 0 },
  'courses/problem-sets/ps-5.md': { type: 'note' as const, frozen: false, cards: 0, due: 0 },
  'notes.md': { type: 'note' as const, frozen: false, cards: 0, due: 0 },
  'vocab.md': { type: 'note' as const, title: 'vocabulary', frozen: false, cards: 0, due: 0 },
};
// the rows drawn: coll, courses, quantum II, perturbation theory, wkb, problem sets, empty, notes, vocabulary
const QM = 'courses/qm.md';
const PT = 'courses/qm/pt.md';
const WKB = 'courses/qm/wkb.md';
const PS = 'courses/problem-sets';

let root: Root;
let side: HTMLDivElement;
let opened: string[];

function mount(activeId?: string) {
  side = document.createElement('div');
  side.className = 'side';
  document.body.appendChild(side);
  root = createRoot(side);
  opened = [];
  act(() => {
    root.render(createElement(Tree, { activeId, onOpen: (p: string, o: OpenOpts) => { opened.push(`${p}${o.cmdClick && o.shiftClick ? ' beside' : o.cmdClick ? ' in a new tab' : ''}`); } }));
  });
}

const trow = (path: string) => side.querySelector<HTMLElement>(`.trow[data-path="${path}"]:not(.placeholder)`)!;
const box = () => side.querySelector<HTMLElement>('.edit-tree')!;
/** The paths of the rows drawn selected, top to bottom. */
const picked = () => Array.from(side.querySelectorAll<HTMLElement>('.edit-tree .trow[data-selected="1"]')).map((r) => r.dataset.path);
const fire = (el: Element, type: string, init: MouseEventInit = {}) => { act(() => { el.dispatchEvent(new MouseEvent(type, { bubbles: true, cancelable: true, ...init })); }); };
/** A click as the mouse makes one: the press, then the click. */
const click = (path: string, mods: MouseEventInit = {}) => { fire(trow(path), 'mousedown', mods); fire(trow(path), 'click', mods); };
const press = (key: string, mods: KeyboardEventInit = {}) => {
  const ev = new KeyboardEvent('keydown', { key, bubbles: true, cancelable: true, ...mods });
  act(() => { box().dispatchEvent(ev); });
  return ev;
};
const flush = async () => { await act(async () => { await new Promise((r) => setTimeout(r, 0)); }); };
const items = () => Array.from(document.querySelectorAll<HTMLElement>('.ctx-menu .ci'));
const entries = () => items().map((e) => e.textContent?.replace(/^./, '').replace(/▸$/, '') ?? '');
const run = (label: string) => fire(items().find((e) => e.textContent?.includes(label))!, 'click');
const rightClick = (path: string) => { fire(trow(path), 'mousedown', { button: 2 }); fire(trow(path), 'contextmenu', { clientX: 40, clientY: 40 }); };

beforeEach(() => {
  calls.length = 0;
  useApp.setState({ vault: '/v/coll', tree: TREE, docs: DOCS, open: { '': true, courses: true, [QM]: true }, order: {}, fileOver: null, mobile: false, phone: false });
  useDrag.setState({ dragging: null, drop: null }, true);
});

afterEach(() => {
  act(() => { root.unmount(); });
  side.remove();
  document.querySelectorAll('.ctx-menu, .drag-ghost').forEach((e) => e.remove());
  endDrag();
});

describe('picking several', () => {
  it('a click opens a row and selects it alone; the tree says it takes several', () => {
    mount();
    click(PT);
    expect(opened).toEqual([PT]);
    expect(picked()).toEqual([PT]);
    expect(box().getAttribute('aria-multiselectable')).toBe('true');
    expect(trow(PT).getAttribute('aria-selected')).toBe('true');
    expect(trow(WKB).getAttribute('aria-selected')).toBe('false');
  });

  it('⇧-click selects the rows from the row last clicked to this one, and opens nothing', () => {
    mount();
    click(PT);
    opened.length = 0;
    click('notes.md', { shiftKey: true });
    expect(picked()).toEqual([PT, WKB, PS, 'empty', 'notes.md']);
    expect(opened).toEqual([]);
    expect(picked().every((p) => trow(p!).getAttribute('aria-selected') === 'true')).toBe(true);
    // again, upward: a new range from the same anchor
    click('courses', { shiftKey: true });
    expect(picked()).toEqual(['courses', QM, PT]);
    expect(opened).toEqual([]);
  });

  it('⌘-click puts a row in or out and opens nothing: no tab is made; ctrl-click too where it is no right-click', () => {
    mount();
    click(PT);
    opened.length = 0;
    click('vocab.md', { metaKey: true });
    expect(picked()).toEqual([PT, 'vocab.md']);
    click('empty', { ctrlKey: true });
    expect(picked()).toEqual([PT, 'empty', 'vocab.md']);
    click(PT, { metaKey: true });
    expect(picked()).toEqual(['empty', 'vocab.md']);
    expect(opened).toEqual([]);
    // the row ⌘-clicked last is where the next range starts
    click('notes.md', { shiftKey: true });
    expect(picked()).toEqual(['empty', 'notes.md']);
  });

  it('⇧⌘-click still opens beside, and ⌥-click still hoists', () => {
    mount();
    click('vocab.md', { metaKey: true, shiftKey: true });
    expect(opened).toEqual(['vocab.md beside']);
    expect(picked()).toEqual(['vocab.md']);
    fire(trow(QM), 'click', { altKey: true });
    expect(box().dataset.hoist).toBe(QM);
  });

  it('on a Mac ctrl-click is the menu\'s: the click picks nothing and opens nothing', () => {
    const was = Object.getOwnPropertyDescriptor(Navigator.prototype, 'platform');
    Object.defineProperty(Navigator.prototype, 'platform', { configurable: true, get: () => 'MacIntel' });
    try {
      mount();
      click(PT);
      click('vocab.md', { metaKey: true });
      opened.length = 0;
      // on one of the selected rows: they stay selected for the menu that follows
      click(PT, { ctrlKey: true });
      expect(picked()).toEqual([PT, 'vocab.md']);
      expect(opened).toEqual([]);
    } finally {
      if (was) Object.defineProperty(Navigator.prototype, 'platform', was);
    }
  });

  it('a click on one of several selects it alone and opens it; the press alone leaves them, for a drag', () => {
    mount();
    click(PT);
    click(WKB, { shiftKey: true });
    fire(trow(PT), 'mousedown');
    expect(picked()).toEqual([PT, WKB]);
    fire(trow(PT), 'click');
    expect(picked()).toEqual([PT]);
    expect(opened).toEqual([PT, PT]);
  });

  it('⇧↓ ⇧↑ grow and shrink the selection from the anchor; a plain arrow is one row again', () => {
    mount();
    fire(trow(PT), 'mousedown');
    press('ArrowDown', { shiftKey: true });
    press('ArrowDown', { shiftKey: true });
    expect(picked()).toEqual([PT, WKB, PS]);
    press('ArrowUp', { shiftKey: true });
    expect(picked()).toEqual([PT, WKB]);
    press('ArrowUp', { shiftKey: true });
    press('ArrowUp', { shiftKey: true });
    expect(picked()).toEqual([QM, PT]);
    press('ArrowDown');
    expect(picked()).toEqual([PT]);
  });

  it('⇧↓ with nothing selected starts from the open document\'s row', () => {
    mount(WKB);
    act(() => { box().focus(); });
    press('ArrowDown', { shiftKey: true });
    expect(picked()).toEqual([WKB, PS]);
  });

  it('⌘A selects every row drawn but the collection\'s own, and is the tree\'s key; Esc is the one row again', () => {
    mount();
    fire(trow('notes.md'), 'mousedown');
    const ev = press('a', { metaKey: true });
    expect(ev.defaultPrevented).toBe(true);
    expect(picked()).toEqual(['courses', QM, PT, WKB, PS, 'empty', 'notes.md', 'vocab.md']);
    const esc = press('Escape');
    expect(esc.defaultPrevented).toBe(true);
    expect(picked()).toEqual(['notes.md']);
    // with one row Esc is not the tree's
    expect(press('Escape').defaultPrevented).toBe(false);
  });

  it('a row of several that is folded away, or that the vault takes, is selected no more', () => {
    mount();
    click(PT);
    click('notes.md', { metaKey: true });
    click('vocab.md', { metaKey: true });
    act(() => { useApp.setState({ open: { '': true, courses: true } }); });
    expect(picked()).toEqual(['notes.md', 'vocab.md']);
    act(() => { useApp.setState({ open: { '': true, courses: true, [QM]: true } }); });
    expect(picked()).toEqual(['notes.md', 'vocab.md']);
    // a pull that deletes one
    act(() => { useApp.setState({ tree: TREE.filter((n) => n.path !== 'notes.md') }); });
    expect(picked()).toEqual(['vocab.md']);
  });
});

describe('the menu of several', () => {
  it('holds only what several can take, in words, and no row\'s own entries', () => {
    mount();
    click(PT);
    click('vocab.md', { metaKey: true });
    click('empty', { metaKey: true });
    rightClick('vocab.md');
    expect(picked()).toEqual([PT, 'empty', 'vocab.md']);
    expect(entries()).toEqual(['open in new tabs', 'duplicate', 'move to…', 'delete 3 items']);
  });

  it('open in new tabs opens each; duplicate copies each; study is there when one of them has cards', async () => {
    useApp.setState({ docs: { ...DOCS, 'vocab.md': { ...DOCS['vocab.md'], type: 'deck', cards: 30, due: 4 } }, files: ['vocab.md'] });
    mount();
    click('notes.md');
    click('vocab.md', { metaKey: true });
    calls.length = 0;
    rightClick('notes.md');
    expect(entries()).toEqual(['open in new tabs', 'study', 'duplicate', 'move to…', 'delete 2 items']);
    run('open in new tabs');
    expect(calls).toEqual(['open notes.md in a new tab', 'open vocab.md in a new tab']);
    calls.length = 0;
    rightClick('notes.md');
    run('duplicate');
    await flush();
    expect(calls).toEqual(['duplicate notes.md', 'duplicate vocab.md']);
    calls.length = 0;
    rightClick('vocab.md');
    run('study');
    expect(calls).toEqual(['study notes.md, vocab.md from vocab.md']);
  });

  it('move to… lists no place among them or under one, and moves each in the order drawn', async () => {
    mount();
    click('vocab.md');
    click(QM, { metaKey: true });
    rightClick(QM);
    run('move to…');
    const targets = Array.from(document.querySelectorAll<HTMLElement>('.ctx-menu .sub-scroll .ci')).map((e) => e.dataset.path);
    expect(targets).toEqual(['', 'courses', PS, 'courses/problem-sets/ps-5.md', 'empty', 'notes.md']);
    fire(document.querySelector<HTMLElement>('.ctx-menu .sub-scroll .ci[data-path="empty"]')!, 'click');
    await flush();
    expect(calls).toEqual([`move ${QM} > empty`, 'move vocab.md > empty']);
  });

  it('delete n items asks once when anything is under them, then deletes them as one', async () => {
    mount();
    click(QM);
    click('vocab.md', { metaKey: true });
    rightClick(QM);
    run('delete 2 items');
    expect(calls).toEqual([]);
    expect(entries()).toContain('delete 2 items with 2 inside?');
    run('delete 2 items with 2 inside?');
    await flush();
    expect(calls).toEqual([`remove as one: ${QM}, vocab.md`]);
    expect(document.querySelector('.ctx-menu')).toBeNull();
  });

  it('a folder and a row inside it both selected are the folder', async () => {
    mount();
    click(QM);
    click(PT, { metaKey: true });
    click('vocab.md', { metaKey: true });
    rightClick(PT);
    expect(entries()).toEqual(['open in new tabs', 'duplicate', 'move to…', 'delete 2 items']);
    run('duplicate');
    await flush();
    expect(calls).toEqual([`duplicate ${QM}`, 'duplicate vocab.md']);
    // every row picked is opened, the one inside too
    calls.length = 0;
    rightClick(PT);
    run('open in new tabs');
    expect(calls).toEqual([`open ${QM} in a new tab`, `open ${PT} in a new tab`, 'open vocab.md in a new tab']);
  });

  it('on a row outside the selection it selects that row alone, and is that row\'s own menu', () => {
    mount();
    click(PT);
    click(WKB, { shiftKey: true });
    rightClick('vocab.md');
    expect(picked()).toEqual(['vocab.md']);
    expect(entries()).toContain('rename F2'.replace(' F2', 'F2'));
    expect(entries()).toContain('delete note');
    expect(entries()).not.toContain('open in new tabs');
  });

  it('the long press of a finger (no press before it) on a row outside the selection does the same', () => {
    mount();
    click(PT);
    click(WKB, { shiftKey: true });
    fire(trow('vocab.md'), 'contextmenu', { clientX: 40, clientY: 40 });
    expect(picked()).toEqual(['vocab.md']);
    expect(entries()).toContain('delete note');
  });

  it('the row\'s ··· is the selection\'s menu on one of several, and there is no + on those rows', () => {
    mount();
    click(PT);
    click(WKB, { shiftKey: true });
    expect(trow(PT).querySelector('.row-acts .add')).toBeNull();
    expect(trow('vocab.md').querySelector('.row-acts .add')).not.toBeNull();
    fire(trow(WKB).querySelector('.row-acts .more')!, 'click');
    expect(entries()).toEqual(['open in new tabs', 'duplicate', 'move to…', 'delete 2 items']);
  });

  it('⌘-click is not how a tree row gets a tab, so its menu names no click for it; the folder lens\'s still does', () => {
    mount();
    rightClick('vocab.md');
    const hint = (act: string) => document.querySelector<HTMLElement>(`.ctx-menu .ci[data-act="${act}"] .ck`)?.textContent ?? null;
    expect(hint('open-tab')).toBeNull();
    expect(hint('open-beside')).toBe('⇧⌘ click');
    run('open in new tab');
    expect(calls).toEqual(['open vocab.md in a new tab']);
    act(() => { root.unmount(); });
    side.remove();

    side = document.createElement('div');
    side.className = 'pane-body';
    document.body.appendChild(side);
    root = createRoot(side);
    act(() => { root.render(createElement(Lens, { id: 'courses', active: true, onOpen: () => {} })); });
    fire(side.querySelector<HTMLElement>(`.fv-row[data-path="${QM}"]`)!, 'contextmenu', { clientX: 300, clientY: 120 });
    expect(hint('open-tab')).toBe('⌘ click');
  });
});

describe('the keys on several', () => {
  it('⌘⌫ deletes them as one, with nothing under them at once', async () => {
    mount();
    click('notes.md');
    click('vocab.md', { shiftKey: true });
    press('Backspace', { metaKey: true });
    await flush();
    expect(calls).toEqual(['remove as one: notes.md, vocab.md']);
    // the row above what went is the one selected
    expect(picked()).toEqual(['empty']);
  });

  it('⌘⌫ asks once, in the row, when anything is under them; a second ⌘⌫ deletes the topmost of them', async () => {
    mount();
    click(QM);
    click(WKB, { metaKey: true });
    click('vocab.md', { metaKey: true });
    press('Backspace', { metaKey: true });
    expect(calls).toEqual([]);
    expect(side.querySelectorAll('.asking')).toHaveLength(1);
    expect(trow('vocab.md').querySelector('.asking')?.textContent).toBe('delete 2 items with 2 inside? ⌘⌫');
    press('Backspace', { metaKey: true });
    await flush();
    expect(calls).toEqual([`remove as one: ${QM}, vocab.md`]);
  });

  it('F2 names one row: with several it is nothing', () => {
    mount();
    click('notes.md');
    click('vocab.md', { shiftKey: true });
    press('F2');
    expect(side.querySelector('input.rename')).toBeNull();
  });
});

// ── the drag ────────────────────────────────────────────────────

/** jsdom lays nothing out: every element is 24 px tall at the window's top left. */
const laidOut = <T,>(fn: () => T): T => {
  const was = HTMLElement.prototype.getBoundingClientRect;
  HTMLElement.prototype.getBoundingClientRect = function () {
    return { top: 0, bottom: 24, height: 24, left: 0, right: 220, width: 220, x: 0, y: 0, toJSON: () => ({}) } as DOMRect;
  };
  try { return fn(); } finally { HTMLElement.prototype.getBoundingClientRect = was; }
};
const dragEv = (type: string, x: number, y: number) => {
  const ev = new MouseEvent(type, { bubbles: true, cancelable: true, clientX: x, clientY: y });
  Object.defineProperty(ev, 'dataTransfer', { value: { effectAllowed: '', dropEffect: '', setData: () => {}, getData: () => '', types: [] as string[] } });
  return ev;
};
/** Drag `from` and let go on `to`, `y` px down it (24 px tall: 2 its top quarter, 12 its middle, 22 its bottom quarter). */
function drop(from: HTMLElement, to: HTMLElement, y: number, x = 200) {
  laidOut(() => {
    act(() => { from.dispatchEvent(dragEv('dragstart', x, y)); });
    act(() => { to.dispatchEvent(dragEv('dragover', x, y)); });
    act(() => { to.dispatchEvent(dragEv('drop', x, y)); });
    act(() => { from.dispatchEvent(dragEv('dragend', x, y)); });
  });
}

describe('a drag of several', () => {
  it('one of them dragged takes them all, each row dimmed, landing before a row in the order drawn', async () => {
    mount();
    click('vocab.md');
    click('notes.md', { metaKey: true });
    laidOut(() => { act(() => { trow('vocab.md').dispatchEvent(dragEv('dragstart', 200, 2)); }); });
    expect(useDrag.getState().many).toEqual(['notes.md', 'vocab.md']);
    expect(trow('notes.md').classList.contains('dragging')).toBe(true);
    expect(trow('vocab.md').classList.contains('dragging')).toBe(true);
    laidOut(() => {
      act(() => { trow(QM).dispatchEvent(dragEv('dragover', 200, 2)); });
      act(() => { trow(QM).dispatchEvent(dragEv('drop', 200, 2)); });
    });
    await flush();
    expect(calls).toEqual([`place notes.md before ${QM}`, `place vocab.md before ${QM}`]);
    expect(useDrag.getState().many ?? null).toBeNull();
    // still the selection, where they went
    expect(picked()).toEqual(['notes.md', 'vocab.md']);
  });

  it('into a folder they are added in turn; after a row each lands after the one before it', async () => {
    mount();
    click('notes.md');
    click('vocab.md', { shiftKey: true });
    drop(trow('notes.md'), trow('empty'), 12);
    await flush();
    expect(calls).toEqual(['place notes.md into empty', 'place vocab.md into empty']);
    calls.length = 0;
    drop(trow('vocab.md'), trow(WKB), 22);
    await flush();
    expect(calls).toEqual([`place notes.md after ${WKB}`, `place vocab.md after notes.md`]);
  });

  it('is never dropped on one of them or under one: nothing drawn, nothing placed', async () => {
    mount();
    click(QM);
    click('vocab.md', { metaKey: true });
    // onto the other selected row, and into the selected document's own child
    drop(trow('vocab.md'), trow(QM), 12);
    drop(trow('vocab.md'), trow(PT), 2);
    await flush();
    expect(calls).toEqual([]);
  });

  it('a folder and a row inside it move as the folder; a row dragged that is not selected goes alone', async () => {
    mount();
    click(QM);
    click(PT, { metaKey: true });
    click('vocab.md', { metaKey: true });
    drop(trow(PT), trow('empty'), 12);
    await flush();
    expect(calls).toEqual([`place ${QM} into empty`, 'place vocab.md into empty']);
    calls.length = 0;
    drop(trow('notes.md'), trow('empty'), 12);
    await flush();
    expect(calls).toEqual(['place notes.md into empty']);
  });

  it('the mouse\'s drag carries `n items`', () => {
    mount();
    click('notes.md');
    click('vocab.md', { shiftKey: true });
    // jsdom lays nothing out: no row is under the pointer
    document.elementFromPoint = () => null;
    const row = trow('vocab.md');
    act(() => { row.dispatchEvent(Object.assign(new MouseEvent('pointerdown', { bubbles: true, cancelable: true, button: 0, clientX: 50, clientY: 12 }), { pointerType: 'mouse' })); });
    act(() => { window.dispatchEvent(Object.assign(new Event('pointermove', { bubbles: true, cancelable: true }), { clientX: 50, clientY: 12 + SLOP + 4, buttons: 1 })); });
    expect(useDrag.getState().many).toEqual(['notes.md', 'vocab.md']);
    expect(document.querySelector('.drag-ghost')?.textContent).toBe('2 items');
    act(() => { window.dispatchEvent(new Event('pointercancel')); });
    expect(document.querySelector('.drag-ghost')).toBeNull();
    // the selection is as it was: the press on one of several did not let the others go
    expect(picked()).toEqual(['notes.md', 'vocab.md']);
  });
});

describe('under a finger', () => {
  const hold = (path: string) => fire(trow(path), 'contextmenu', { clientX: 40, clientY: 40 });
  const bar = () => side.querySelector<HTMLElement>('.tree-select');
  const barText = () => Array.from(bar()!.children).map((c) => c.textContent);
  const tap = (path: string) => fire(trow(path), 'click');
  const barButton = (act: string) => bar()!.querySelector<HTMLButtonElement>(`[data-act="${act}"]`)!;

  it('the mouse\'s menu has no select: ⌘-click is how several are picked there', () => {
    mount();
    rightClick('vocab.md');
    expect(document.querySelector('.ctx-menu .ci[data-act="select"]')).toBeNull();
  });

  it('the row\'s menu has select after open in new tab and open beside; then a tap puts a row in or out and opens nothing', () => {
    useApp.setState({ mobile: true });
    mount();
    hold('vocab.md');
    expect(items().slice(0, 3).map((i) => i.dataset.act)).toEqual(['open-tab', 'open-beside', 'select']);
    run('select');
    expect(bar()).not.toBeNull();
    expect(barText()).toEqual(['1 selected', 'move to…', 'delete', 'done']);
    expect(picked()).toEqual(['vocab.md']);
    tap('notes.md');
    tap(PT);
    expect(picked()).toEqual([PT, 'notes.md', 'vocab.md']);
    expect(barText()[0]).toBe('3 selected');
    tap('vocab.md');
    expect(picked()).toEqual([PT, 'notes.md']);
    expect(opened).toEqual([]);
  });

  it('on a phone, which has no tabs to open in, select is the menu\'s first entry', () => {
    useApp.setState({ mobile: true, phone: true });
    mount();
    hold('vocab.md');
    expect(items()[0]!.dataset.act).toBe('select');
  });

  it('move to… moves what is picked; delete asks once in the line when anything is under them; done leaves', async () => {
    useApp.setState({ mobile: true });
    mount();
    hold('vocab.md');
    run('select');
    tap(QM);
    fire(barButton('move'), 'click');
    expect(document.querySelector('.ctx-menu .move-filter')).not.toBeNull();
    fire(document.querySelector<HTMLElement>('.ctx-menu .sub-scroll .ci[data-path="empty"]')!, 'click');
    await flush();
    expect(calls).toEqual([`move ${QM} > empty`, 'move vocab.md > empty']);
    calls.length = 0;
    expect(bar()).not.toBeNull();
    fire(barButton('delete'), 'click');
    expect(calls).toEqual([]);
    expect(barButton('delete').textContent).toBe('delete with 2 inside?');
    expect(side.querySelector('.trow .asking')).toBeNull();
    fire(barButton('delete'), 'click');
    await flush();
    expect(calls).toEqual([`remove as one: ${QM}, vocab.md`]);
    expect(barText()[0]).toBe('0 selected');
    expect(barButton('delete').disabled).toBe(true);
    fire(barButton('done'), 'click');
    expect(bar()).toBeNull();
    expect(picked()).toEqual([]);
    // a tap opens again
    tap('notes.md');
    expect(opened).toEqual(['notes.md']);
  });

  it('a row held while picking joins what is picked, and the menu is theirs', () => {
    useApp.setState({ mobile: true });
    mount();
    hold('vocab.md');
    run('select');
    hold('notes.md');
    expect(picked()).toEqual(['notes.md', 'vocab.md']);
    expect(entries()).toEqual(['open in new tabs', 'duplicate', 'move to…', 'delete 2 items']);
  });
});
