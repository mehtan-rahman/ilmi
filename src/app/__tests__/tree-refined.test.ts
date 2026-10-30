// @vitest-environment jsdom
// The tree, refined (milestone 38), in the DOM: the keys with the tree
// focused (and not leaking to the window), the selected row drawn, the open
// document revealed, the hover `+` and `···`, the placeholder of an open
// empty folder taking a drop, a hoist and its crumb, one due number with
// the counts in the tooltip; and the one drag shared with the folder lens:
// a line indented to where a drop below a last child lands, the spring
// opening a folded row, Esc cancelling, a refused drop drawing nothing, and
// a row dragged from the tree landing on a folder lens row.

import { act, createElement } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { TreeNode } from '../../vault/index.js';
import { useDrag } from '../drag.js';
import { useApp } from '../store.js';

const calls: string[] = [];

vi.mock('../vault.js', async (orig) => {
  const real = await orig<typeof import('../vault.js')>();
  return {
    ...real,
    placeNode: vi.fn(async (path: string, target: string, mode: string) => { calls.push(`place ${path} ${mode} ${target}`); return path; }),
    removeNode: vi.fn(async (path: string) => { calls.push(`remove ${path}`); }),
    renameNode: vi.fn(async (path: string, name: string) => { calls.push(`rename ${path}|${name}`); return path; }),
  };
});

// every delete goes through `remove.ts` (the notice's undo); here it is only named
vi.mock('../remove.js', () => ({ deleteNode: vi.fn(async (path: string) => { calls.push(`remove ${path}`); }) }));

const { Tree } = await import('../Tree.js');
const { Crumbs, crumbTrail } = await import('../Crumbs.js');
const { activeTab } = await import('../panes.js');
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
  { kind: 'doc', name: 'vocab.md', path: 'vocab.md' },
];
const DOCS = {
  'courses/qm.md': { type: 'note' as const, title: 'quantum II', frozen: false, cards: 0, due: 0 },
  'courses/qm/pt.md': { type: 'note' as const, title: 'perturbation theory', frozen: false, cards: 6, due: 2 },
  'courses/qm/wkb.md': { type: 'note' as const, frozen: false, cards: 0, due: 0 },
  'courses/problem-sets/ps-5.md': { type: 'deck' as const, frozen: false, cards: 12, due: 0 },
  'vocab.md': { type: 'deck' as const, title: 'vocabulary', frozen: false, cards: 300, due: 41 },
};

let root: Root;
let side: HTMLDivElement;
let opened: string[];

function mount(activeId?: string, withLens?: string) {
  side = document.createElement('div');
  side.className = 'side';
  document.body.appendChild(side);
  root = createRoot(side);
  opened = [];
  const tree = createElement(Tree, { activeId, onOpen: (p: string) => { opened.push(p); } });
  act(() => {
    root.render(withLens === undefined ? tree : createElement('div', null, tree, createElement('div', { className: 'pane-body' }, createElement(Lens, { id: withLens, active: true, onOpen: () => {} }))));
  });
}

const trow = (path: string) => side.querySelector<HTMLElement>(`.trow[data-path="${path}"]:not(.placeholder)`)!;
const names = () => Array.from(side.querySelectorAll<HTMLElement>('.edit-tree .trow')).map((r) => `${r.classList.contains('placeholder') ? '(empty)' : r.querySelector('.name')?.textContent}${r.dataset.selected === '1' ? '*' : ''}`);
const box = () => side.querySelector<HTMLElement>('.edit-tree')!;
const press = (key: string, mods: KeyboardEventInit = {}) => {
  const ev = new KeyboardEvent('keydown', { key, bubbles: true, cancelable: true, ...mods });
  act(() => { box().dispatchEvent(ev); });
  return ev;
};
const fire = (el: Element, type: string, init: MouseEventInit = {}) => { act(() => { el.dispatchEvent(new MouseEvent(type, { bubbles: true, cancelable: true, ...init })); }); };
const flush = async () => { await act(async () => { await new Promise((r) => setTimeout(r, 0)); }); };

beforeEach(() => {
  calls.length = 0;
  useApp.setState({ vault: '/v/coll', tree: TREE, docs: DOCS, open: { '': true, courses: true, 'courses/qm.md': true }, order: {}, fileOver: null });
  useDrag.setState({ dragging: null, drop: null });
});

afterEach(() => {
  act(() => { root.unmount(); });
  side.remove();
  vi.restoreAllMocks();
});

describe('the keys', () => {
  it('↑ ↓ → ← move the selection, which is drawn; → opens a folded row and ← closes it', () => {
    mount();
    act(() => { box().focus(); });
    press('ArrowDown');
    expect(names()[0]).toBe('coll*');
    press('ArrowDown');
    press('ArrowDown');
    expect(trow('courses/qm.md').dataset.selected).toBe('1');
    expect(trow('courses/qm.md').getAttribute('aria-selected')).toBe('true');
    press('ArrowRight');
    expect(trow('courses/qm/pt.md').dataset.selected).toBe('1');
    press('ArrowLeft');
    press('ArrowLeft');
    expect(useApp.getState().open['courses/qm.md']).toBeUndefined();
    expect(trow('courses/qm.md').getAttribute('aria-expanded')).toBe('false');
    press('ArrowDown');
    press('ArrowRight');
    expect(useApp.getState().open['courses/problem-sets']).toBe(true);
    expect(box().getAttribute('role')).toBe('tree');
  });

  it('⏎ opens the row\'s node, a letter jumps to a name, and the keys never reach the window', () => {
    mount();
    const seen: string[] = [];
    const onWin = (e: KeyboardEvent) => seen.push(e.key);
    window.addEventListener('keydown', onWin);
    try {
      act(() => { box().focus(); });
      press('v');
      expect(trow('vocab.md').dataset.selected).toBe('1');
      press('Enter');
      expect(opened).toEqual(['vocab.md']);
      // letters typed quickly are one word; after a pause, a new one
      press('p');
      expect(trow('vocab.md').dataset.selected).toBe('1');
      const clock = vi.spyOn(Date, 'now').mockReturnValue(Date.now() + 1000);
      press('p');
      clock.mockRestore();
      expect(trow('courses/qm/pt.md').dataset.selected).toBe('1');
      expect(seen).toEqual([]);
    } finally { window.removeEventListener('keydown', onWin); }
  });

  it('⌥⌘↑↓←→ move the row among its siblings, out, and in, as the drop the vault takes', () => {
    mount();
    fire(trow('courses/qm/wkb.md'), 'mousedown');
    press('ArrowUp', { metaKey: true, altKey: true });
    press('ArrowLeft', { metaKey: true, altKey: true });
    press('ArrowRight', { metaKey: true, altKey: true });
    fire(trow('courses/problem-sets'), 'mousedown');
    press('ArrowRight', { metaKey: true, altKey: true });
    press('ArrowDown', { metaKey: true, altKey: true });
    expect(calls).toEqual([
      'place courses/qm/wkb.md before courses/qm/pt.md',
      'place courses/qm/wkb.md after courses/qm.md',
      'place courses/qm/wkb.md into courses/qm/pt.md',
      'place courses/problem-sets into courses/qm.md',
    ]);
  });

  it('F2 renames the row just selected, even pressed before a render (as a smoke sends it), and only from the tree', () => {
    mount('courses/qm/pt.md');
    // in the page (the window), F2 is not the tree's
    act(() => { window.dispatchEvent(new KeyboardEvent('keydown', { key: 'F2', bubbles: true, cancelable: true })); });
    expect(side.querySelector('input.rename')).toBeNull();
    // the press and the key in one go: the selection is read as of now, not as of the last render
    act(() => {
      trow('vocab.md').dispatchEvent(new MouseEvent('mousedown', { bubbles: true }));
      box().focus();
      box().dispatchEvent(new KeyboardEvent('keydown', { key: 'F2', bubbles: true, cancelable: true }));
    });
    expect(side.querySelector<HTMLInputElement>('input.rename')?.value).toBe('vocabulary');
    expect(side.querySelector('input.rename')?.closest('.trow')?.getAttribute('data-path')).toBe('vocab.md');
  });

  it('F2 with nothing selected renames the open document, its folded row opened to first', () => {
    useApp.setState({ open: { '': true } });
    mount();
    act(() => { root.render(createElement(Tree, { activeId: 'courses/qm/wkb.md', onOpen: () => {} })); });
    useApp.setState({ open: { '': true } });
    act(() => { box().focus(); });
    press('F2');
    expect(side.querySelector<HTMLInputElement>('input.rename')?.value).toBe('wkb');
  });

  it('⌘⌫ deletes; with something under the row it asks first, in the row, and a second ⌘⌫ deletes', async () => {
    mount();
    fire(trow('courses/qm.md'), 'mousedown');
    press('Backspace', { metaKey: true });
    expect(calls).toEqual([]);
    expect(trow('courses/qm.md').querySelector('.asking')?.textContent).toBe('delete with 2 inside? ⌘⌫');
    // any other key lets it go
    press('ArrowDown');
    expect(side.querySelector('.asking')).toBeNull();
    press('ArrowUp');
    press('Backspace', { metaKey: true });
    press('Backspace', { metaKey: true });
    fire(trow('vocab.md'), 'mousedown');
    press('Backspace', { metaKey: true });
    await flush();
    expect(calls).toEqual(['remove courses/qm.md', 'remove vocab.md']);
  });
});

describe('what is shown', () => {
  it('reveals the open document: the rows above it opened, it marked active', () => {
    useApp.setState({ open: { '': true } });
    mount('courses/problem-sets/ps-5.md');
    expect(useApp.getState().open).toMatchObject({ '': true, courses: true, 'courses/problem-sets': true });
    expect(trow('courses/problem-sets/ps-5.md').dataset.active).toBe('1');
    // the selection is not taken: the focus stays where it was
    expect(side.querySelector('.trow[data-selected="1"]')).toBeNull();
  });

  it('a slug reads as a name, a folder by its weight and mark; one due number, the counts in the tooltip', () => {
    mount();
    expect(trow('courses/problem-sets').querySelector('.name')?.textContent).toBe('problem sets');
    expect(trow('courses/problem-sets').dataset.kind).toBe('folder');
    expect(trow('courses/qm/pt.md').querySelector('.due')?.textContent).toBe('2');
    expect(trow('courses/qm/pt.md').title).toBe('6 cards, 2 due');
    expect(trow('vocab.md').querySelector('.due')?.textContent).toBe('41');
    // nothing due: no number at all, and no counts beside the name
    expect(trow('courses/qm/wkb.md').querySelector('.due, .meta')).toBeNull();
    expect(trow('courses/qm.md').title).toBe('2 items');
  });

  it('hover `+` opens the new menu inside the row, `···` the row\'s own menu', () => {
    mount();
    fire(trow('courses/qm.md').querySelector('.row-acts .add')!, 'click');
    const entries = () => Array.from(document.querySelectorAll<HTMLElement>('.ctx-menu .ci')).map((e) => e.textContent?.replace(/^./, '').replace(/F2$|▸$/, ''));
    expect(entries()).toEqual(['new note', 'new source', 'new deck', 'new draft', 'new folder', 'import a file…', 'add from text or a link']);
    expect(trow('courses/qm.md').dataset.selected).toBe('1');
    fire(document.body, 'mousedown');
    fire(trow('courses/qm.md').querySelector('.row-acts .more')!, 'click');
    expect(entries()).toContain('rename');
    expect(entries()).toContain('delete note');
  });

  it('an open empty folder shows one quiet row that takes a drop into the folder', () => {
    useApp.setState({ open: { '': true, empty: true } });
    mount();
    const ph = side.querySelector<HTMLElement>('.trow.placeholder')!;
    expect(ph.textContent).toBe('empty');
    expect(ph.dataset.path).toBe('empty');
    drop(trow('vocab.md'), ph, 12);
    expect(calls).toEqual(['place vocab.md into empty']);
  });

  it('⌥-click hoists a row: only what is under it, a crumb back out', () => {
    mount();
    fire(trow('courses/qm.md'), 'click', { altKey: true });
    expect(opened).toEqual([]);
    expect(names()).toEqual(['quantum II*', 'perturbation theory', 'wkb']);
    const crumbs = () => Array.from(side.querySelectorAll<HTMLElement>('.hoist-crumb .hc')).map((c) => c.textContent);
    expect(crumbs()).toEqual(['coll', 'courses', 'quantum II']);
    fire(side.querySelectorAll<HTMLElement>('.hoist-crumb .hc')[1]!, 'click');
    expect(names()[0]).toBe('courses');
    fire(side.querySelectorAll<HTMLElement>('.hoist-crumb .hc')[0]!, 'click');
    expect(side.querySelector('.hoist-crumb')).toBeNull();
    expect(names()[0]).toBe('coll');
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
const dt = () => ({ effectAllowed: '', dropEffect: '', setData: () => {}, getData: () => '', types: [] as string[] });
const dragEv = (type: string, x: number, y: number, related?: Element) => {
  const ev = new MouseEvent(type, { bubbles: true, cancelable: true, clientX: x, clientY: y, relatedTarget: related ?? null });
  Object.defineProperty(ev, 'dataTransfer', { value: dt() });
  return ev;
};
function drop(from: HTMLElement, to: HTMLElement, y: number, x = 200) {
  laidOut(() => {
    act(() => { from.dispatchEvent(dragEv('dragstart', x, y)); });
    act(() => { to.dispatchEvent(dragEv('dragover', x, y)); });
    act(() => { to.dispatchEvent(dragEv('drop', x, y)); });
    act(() => { from.dispatchEvent(dragEv('dragend', x, y)); });
  });
}

describe('the drag', () => {
  it('below a last child, the line is indented to where the drop lands, its x picking how far out', () => {
    mount();
    const wkb = trow('courses/qm/wkb.md');
    const over = (x: number) => laidOut(() => {
      act(() => { wkb.dispatchEvent(dragEv('dragover', x, 22)); });
      return `${wkb.className.match(/drop-\w+/)?.[0]} ${wkb.style.getPropertyValue('--drop-x')}`;
    });
    laidOut(() => { act(() => { trow('vocab.md').dispatchEvent(dragEv('dragstart', 0, 0)); }); });
    expect(over(200)).toBe('drop-bottom 36px');
    expect(over(30)).toBe('drop-bottom 26px');
    laidOut(() => { act(() => { wkb.dispatchEvent(dragEv('drop', 30, 22)); }); });
    expect(calls).toEqual(['place vocab.md after courses/qm.md']);
  });

  it('the dragged row is dimmed; an open parent\'s bottom quarter lands as its first child', () => {
    mount();
    laidOut(() => { act(() => { trow('vocab.md').dispatchEvent(dragEv('dragstart', 0, 0)); }); });
    expect(trow('vocab.md').classList.contains('dragging')).toBe(true);
    laidOut(() => { act(() => { trow('courses/qm.md').dispatchEvent(dragEv('dragover', 200, 22)); }); });
    expect(trow('courses/qm.md').style.getPropertyValue('--drop-x')).toBe('36px');
    laidOut(() => { act(() => { trow('courses/qm.md').dispatchEvent(dragEv('drop', 200, 22)); }); });
    expect(calls).toEqual(['place vocab.md before courses/qm/pt.md']);
    expect(trow('vocab.md').classList.contains('dragging')).toBe(false);
  });

  it('a refused drop draws nothing and is not accepted; crossing into a row\'s own text keeps the mark', () => {
    mount();
    laidOut(() => { act(() => { trow('courses').dispatchEvent(dragEv('dragstart', 0, 0)); }); });
    const ev = dragEv('dragover', 200, 12);
    laidOut(() => { act(() => { trow('courses/qm.md').dispatchEvent(ev); }); });
    expect(ev.defaultPrevented).toBe(false);
    expect(side.querySelector('[class*="drop-"]')).toBeNull();
    // a fair one, then the pointer onto the row's name: no flicker
    laidOut(() => { act(() => { trow('vocab.md').dispatchEvent(dragEv('dragover', 200, 2)); }); });
    expect(trow('vocab.md').classList.contains('drop-top')).toBe(true);
    act(() => { trow('vocab.md').dispatchEvent(dragEv('dragleave', 200, 2, trow('vocab.md').querySelector('.name')!)); });
    expect(trow('vocab.md').classList.contains('drop-top')).toBe(true);
    act(() => { trow('vocab.md').dispatchEvent(dragEv('dragleave', 200, 2, document.body)); });
    expect(trow('vocab.md').classList.contains('drop-top')).toBe(false);
  });

  it('a folded row opens after a rest of 500 ms; Esc cancels and the drop does nothing', () => {
    mount();
    const t0 = Date.now();
    const clock = vi.spyOn(Date, 'now').mockReturnValue(t0);
    laidOut(() => { act(() => { trow('vocab.md').dispatchEvent(dragEv('dragstart', 0, 0)); }); });
    laidOut(() => { act(() => { trow('courses/problem-sets').dispatchEvent(dragEv('dragover', 200, 12)); }); });
    expect(useApp.getState().open['courses/problem-sets']).toBeUndefined();
    clock.mockReturnValue(t0 + 520);
    laidOut(() => { act(() => { trow('courses/problem-sets').dispatchEvent(dragEv('dragover', 200, 12)); }); });
    expect(useApp.getState().open['courses/problem-sets']).toBe(true);
    expect(trow('courses/problem-sets').classList.contains('drop-into')).toBe(true);
    act(() => { window.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true })); });
    expect(side.querySelector('[class*="drop-"]')).toBeNull();
    laidOut(() => { act(() => { trow('courses/problem-sets').dispatchEvent(dragEv('dragover', 200, 12)); }); });
    laidOut(() => { act(() => { trow('courses/problem-sets').dispatchEvent(dragEv('drop', 200, 12)); }); });
    expect(calls).toEqual([]);
  });

  it('a row dragged from the tree lands on a folder lens row, and one from the lens on the tree: one drag', () => {
    mount(undefined, 'courses');
    const lensRow = (path: string) => side.querySelector<HTMLElement>(`.fv-row[data-path="${path}"]`)!;
    drop(trow('vocab.md'), lensRow('courses/problem-sets'), 12);
    drop(lensRow('courses/qm.md'), trow('vocab.md'), 2);
    expect(calls).toEqual(['place vocab.md into courses/problem-sets', 'place courses/qm.md before vocab.md']);
  });
});

describe('breadcrumbs', () => {
  it('name each row above a page, a document by its title, a folder by its name, each a link to it', () => {
    expect(crumbTrail('courses/qm/pt.md', DOCS)).toEqual([{ path: 'courses', label: 'courses' }, { path: 'courses/qm.md', label: 'quantum II' }]);
    expect(crumbTrail('vocab.md', DOCS)).toEqual([]);
    side = document.createElement('div');
    document.body.appendChild(side);
    root = createRoot(side);
    act(() => { root.render(createElement(Crumbs, { path: 'courses/problem-sets/ps-5.md' })); });
    const links = Array.from(side.querySelectorAll<HTMLElement>('.crumbs .cr'));
    expect(links.map((a) => a.textContent)).toEqual(['courses', 'problem sets']);
    fire(links[1]!, 'click');
    expect(activeTab(useApp.getState().panes)?.id).toBe('courses/problem-sets');
  });
});
