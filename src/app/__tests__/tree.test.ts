// @vitest-environment jsdom
// The sidebar's context menu, in the DOM: the root's menu from the empty
// space of the sidebar, a row's own from the row, `move to…` on a click and
// not on hover, `◂ move to…` back, Escape and an outside press closing it,
// and the menu kept inside the window at the bottom edge.

import { act, createElement } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { TreeNode } from '../../vault/index.js';
import { moveTargets } from '../names.js';
import { useApp } from '../store.js';
import { Tree } from '../Tree.js';

const calls: string[] = [];

vi.mock('../vault.js', async (orig) => {
  const real = await orig<typeof import('../vault.js')>();
  return {
    ...real,
    placeNode: vi.fn(async (path: string, target: string, mode: string) => { calls.push(`place ${path} ${mode} ${target}`); return path; }),
    moveNode: vi.fn(async (path: string, dir: string) => { calls.push(`move ${path} → ${dir}`); return path; }),
  };
});

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

const TREE: TreeNode[] = [
  { kind: 'folder', name: 'papers', path: 'papers', children: [{ kind: 'doc', name: 'wozniak-1990.md', path: 'papers/wozniak-1990.md' }] },
  { kind: 'folder', name: 'sources', path: 'sources', children: [] },
  { kind: 'doc', name: 'notes.md', path: 'notes.md' },
];

let root: Root;
let side: HTMLDivElement;

/** The sidebar as App.tsx lays it out: the heading, the tree, and empty space under it. */
function mount() {
  side = document.createElement('div');
  side.className = 'side';
  document.body.appendChild(side);
  root = createRoot(side);
  act(() => {
    root.render(createElement('div', null, createElement('h6', null, 'workspace'), createElement(Tree, { activeId: undefined, onOpen: () => {} })));
  });
}

const menu = () => side.querySelector<HTMLElement>('.ctx-menu');
const entries = () => Array.from(side.querySelectorAll<HTMLElement>('.ctx-menu .ci')).map((e) => e.textContent?.replace(/^./, '').replace(/F2$|▸$/, '') ?? '');
const mouse = (el: Element | Window, type: string, init: MouseEventInit = {}) => {
  act(() => { el.dispatchEvent(new MouseEvent(type, { bubbles: true, cancelable: true, ...init })); });
};
const key = (k: string) => { act(() => { window.dispatchEvent(new KeyboardEvent('keydown', { key: k, bubbles: true })); }); };
const row = (path: string) => side.querySelector<HTMLElement>(`.trow[data-path="${path}"]:not(.placeholder)`)!;

beforeEach(() => {
  calls.length = 0;
  useApp.setState({ vault: '/v', tree: TREE, docs: { 'papers/wozniak-1990.md': { type: 'source', frozen: true, cards: 0, due: 0 }, 'notes.md': { type: 'draft', frozen: false, cards: 0, due: 0 } }, open: { '': true, papers: true } });
  mount();
});

afterEach(() => {
  act(() => { root.unmount(); });
  side.remove();
});

describe('the sidebar menu', () => {
  it('opens the root\'s menu from the sidebar\'s empty space and its heading, new items landing at the root', () => {
    // the root, papers and its source, sources, notes
    expect(side.querySelectorAll('.trow:not(.placeholder)')).toHaveLength(5);
    expect(menu()).toBeNull();
    const ev = new MouseEvent('contextmenu', { bubbles: true, cancelable: true, clientX: 40, clientY: 300 });
    act(() => { side.dispatchEvent(ev); });
    expect(ev.defaultPrevented).toBe(true);
    expect(menu()).not.toBeNull();
    expect(entries()).toEqual(['new note', 'new source', 'new deck', 'new draft', 'new folder', 'import a file…', 'add from text or a link']);
    expect(menu()!.style.left).toBe('40px');
    key('Escape');
    expect(menu()).toBeNull();
    mouse(side.querySelector('h6')!, 'contextmenu', { clientX: 10, clientY: 10 });
    expect(entries()).toEqual(['new note', 'new source', 'new deck', 'new draft', 'new folder', 'import a file…', 'add from text or a link']);
  });

  it('keeps a row\'s own menu, with rename, move to…, and delete', () => {
    mouse(row('papers/wozniak-1990.md'), 'contextmenu', { clientX: 60, clientY: 80 });
    expect(entries()).toEqual(['new note', 'new source', 'new deck', 'new draft', 'new folder', 'import a file…', 'add from text or a link', 'show as tabs', 'rename', 'duplicate', 'move to…', 'delete source']);
    expect(side.querySelectorAll('.ctx-menu')).toHaveLength(1);
  });

  it('opens move to… on a click, not on hover, and steps back from ◂ move to…', () => {
    mouse(row('notes.md'), 'contextmenu', { clientX: 60, clientY: 120 });
    const sub = () => side.querySelector('.ctx-menu .sub-scroll');
    const hasSub = () => side.querySelector<HTMLElement>('.ctx-menu .ci.has-sub')!;
    mouse(hasSub(), 'mouseover');
    mouse(hasSub(), 'mouseenter', { bubbles: false });
    expect(sub()).toBeNull();
    mouse(hasSub(), 'click');
    expect(sub()).not.toBeNull();
    expect(menu()).not.toBeNull();
    expect(Array.from(sub()!.querySelectorAll('.ci')).map((e) => e.textContent)).toEqual(['/papers', '“wozniak 1990', '/sources']);
    // the pointer leaving the list does not close it
    mouse(side.querySelector('.ctx-menu .sub-wrap')!, 'mouseleave', { bubbles: false });
    mouse(side.querySelector('.ctx-menu .sub-wrap')!, 'mouseout');
    expect(sub()).not.toBeNull();
    mouse(side.querySelector('.ctx-menu .ci.back')!, 'click');
    expect(sub()).toBeNull();
    expect(entries()).toContain('move to…');
  });

  it('closes on Escape and on a press outside, not on a press inside', () => {
    mouse(side, 'contextmenu', { clientX: 40, clientY: 300 });
    expect(menu()).not.toBeNull();
    mouse(menu()!.querySelector('.ci')!, 'mousedown');
    expect(menu()).not.toBeNull();
    mouse(document.body, 'mousedown');
    expect(menu()).toBeNull();
    mouse(row('notes.md'), 'contextmenu', { clientX: 60, clientY: 120 });
    mouse(side.querySelector('.ctx-menu .ci.has-sub')!, 'click');
    expect(side.querySelector('.ctx-menu .sub-scroll')).not.toBeNull();
    key('Escape');
    expect(menu()).toBeNull();
  });

  it('stays inside the window at the right and the bottom edges', () => {
    const was = { w: window.innerWidth, h: window.innerHeight };
    Object.defineProperty(window, 'innerWidth', { value: 400, configurable: true });
    Object.defineProperty(window, 'innerHeight', { value: 300, configurable: true });
    const tall = HTMLElement.prototype.getBoundingClientRect;
    // jsdom lays nothing out: the menu is given a height, placed where it was asked
    HTMLElement.prototype.getBoundingClientRect = function () {
      const top = parseFloat(this.style.top || '0');
      return { top, bottom: top + 180, height: 180, left: 0, right: 0, width: 0, x: 0, y: top, toJSON: () => ({}) } as DOMRect;
    };
    try {
      mouse(side, 'contextmenu', { clientX: 380, clientY: 250 });
      expect(menu()!.style.left).toBe('210px');
      expect(menu()!.style.top).toBe('114px');
    } finally {
      HTMLElement.prototype.getBoundingClientRect = tall;
      Object.defineProperty(window, 'innerWidth', { value: was.w, configurable: true });
      Object.defineProperty(window, 'innerHeight', { value: was.h, configurable: true });
    }
  });
});

// ── milestone 30: a drop on any row, and move to… over documents ──

describe('nesting in the tree', () => {
  /** jsdom lays nothing out: every row is 24 px tall from the top of the window. */
  const laidOut = <T,>(fn: () => T): T => {
    const was = HTMLElement.prototype.getBoundingClientRect;
    HTMLElement.prototype.getBoundingClientRect = function () {
      return { top: 0, bottom: 24, height: 24, left: 0, right: 200, width: 200, x: 0, y: 0, toJSON: () => ({}) } as DOMRect;
    };
    try { return fn(); } finally { HTMLElement.prototype.getBoundingClientRect = was; }
  };
  const dt = () => ({ effectAllowed: '', dropEffect: '', setData: () => {}, getData: () => '', types: [] as string[] });
  const dragEv = (type: string, y = 0) => {
    const ev = new MouseEvent(type, { bubbles: true, cancelable: true, clientX: 100, clientY: y });
    Object.defineProperty(ev, 'dataTransfer', { value: dt() });
    return ev;
  };
  /** A drag from one row onto another at `y`; `rest` holds the pointer there first (the rest before `into` on a bare document). */
  const dropOn = (from: HTMLElement, to: HTMLElement, y: number, rest = false) => laidOut(() => {
    act(() => { from.dispatchEvent(dragEv('dragstart')); });
    const t0 = Date.now();
    const clock = vi.spyOn(Date, 'now').mockReturnValue(t0);
    const over = dragEv('dragover', y);
    act(() => { to.dispatchEvent(over); });
    if (rest) {
      clock.mockReturnValue(t0 + 450);
      act(() => { to.dispatchEvent(dragEv('dragover', y)); });
    }
    clock.mockRestore();
    const cls = to.className;
    act(() => { to.dispatchEvent(dragEv('drop', y)); });
    act(() => { from.dispatchEvent(dragEv('dragend')); });
    return { prevented: over.defaultPrevented, cls };
  });

  it('a drop resting on the middle of a document row goes into it, its quarters before and after', () => {
    const notes = row('notes.md');
    const woz = row('papers/wozniak-1990.md');
    expect(dropOn(notes, woz, 12, true)).toEqual({ prevented: true, cls: expect.stringContaining('drop-into') });
    expect(dropOn(notes, woz, 3).cls).toContain('drop-top');
    // wozniak is the last under papers: its bottom quarter, the pointer at its own indent, lands after it
    expect(dropOn(notes, woz, 21).cls).toContain('drop-bottom');
    // a folder row the same, and the root row only takes into
    dropOn(woz, row('sources'), 12);
    dropOn(woz, side.querySelector<HTMLElement>('.trow[data-path=""]')!, 2);
    expect(calls).toEqual([
      'place notes.md into papers/wozniak-1990.md',
      'place notes.md before papers/wozniak-1990.md',
      'place notes.md after papers/wozniak-1990.md',
      'place papers/wozniak-1990.md into sources',
      'place papers/wozniak-1990.md into ',
    ]);
  });

  it('takes no drop of a node onto itself or into its own subtree', () => {
    const papers = row('papers');
    expect(dropOn(papers, row('papers/wozniak-1990.md'), 12).prevented).toBe(false);
    expect(dropOn(papers, papers, 12).prevented).toBe(false);
    expect(calls).toEqual([]);
  });

  it('draws a document\'s children in the order chosen, a folder\'s too', () => {
    act(() => {
      useApp.setState({
        tree: [{ kind: 'doc', name: 'course', path: 'course.md', children: [
          { kind: 'folder', name: 'unit 2', path: 'course/unit 2', children: [] },
          { kind: 'doc', name: 'set 1', path: 'course/set 1.md' },
          { kind: 'doc', name: 'unit 1', path: 'course/unit 1.md' },
        ] }, ...TREE],
        open: { '': true, 'course.md': true },
        order: { course: ['unit 1.md', 'unit 2/'], '': ['notes.md'] },
      });
    });
    const paths = Array.from(side.querySelectorAll<HTMLElement>('.trow')).map((r) => r.dataset.path);
    expect(paths).toEqual(['', 'notes.md', 'course.md', 'course/unit 1.md', 'course/unit 2', 'course/set 1.md', 'papers', 'sources']);
  });

  it('move to… lists documents as well as folders, nested and indented, leaving out the node and what is under it', () => {
    const tree: TreeNode[] = [
      { kind: 'doc', name: 'course', path: 'course.md', children: [
        { kind: 'doc', name: 'unit 1', path: 'course/unit 1.md', children: [{ kind: 'doc', name: 'ex', path: 'course/unit 1/ex.md' }] },
        { kind: 'folder', name: 'sets', path: 'course/sets', children: [] },
      ] },
      ...TREE,
    ];
    const at = (id: string) => moveTargets(tree, id).map((t) => `${'  '.repeat(t.depth)}${t.path || '/'} → ${t.dir || '/'}`);
    expect(at('notes.md')).toEqual([
      '  course.md → course',
      '    course/unit 1.md → course/unit 1',
      '      course/unit 1/ex.md → course/unit 1/ex',
      '    course/sets → course/sets',
      '  papers → papers',
      '    papers/wozniak-1990.md → papers/wozniak-1990',
      '  sources → sources',
    ]);
    // the course itself and its subtree are left out, and the root, where it is already
    expect(at('course.md')).toEqual(['  papers → papers', '    papers/wozniak-1990.md → papers/wozniak-1990', '  sources → sources', '  notes.md → notes']);
    // the place it is in already is left out: unit 1 is in the course
    expect(at('course/unit 1.md').map((s) => s.trim())).toEqual(['/ → /', 'course/sets → course/sets', 'papers → papers', 'papers/wozniak-1990.md → papers/wozniak-1990', 'sources → sources', 'notes.md → notes']);
    // in the menu: indented by depth, a click moving into the document's children directory
    mouse(row('notes.md'), 'contextmenu', { clientX: 60, clientY: 120 });
    mouse(side.querySelector('.ctx-menu .ci.has-sub')!, 'click');
    const items = Array.from(side.querySelectorAll<HTMLElement>('.ctx-menu .sub-scroll .ci'));
    expect(items.map((e) => [e.textContent, e.style.paddingLeft])).toEqual([['/papers', '22px'], ['“wozniak 1990', '34px'], ['/sources', '22px']]);
    mouse(items[1]!, 'click');
    expect(calls).toEqual(['move notes.md → papers/wozniak-1990']);
  });

  it('filters move to… as you type: the matches flat with where each is, ↓ and ⏎ to move', () => {
    mouse(row('notes.md'), 'contextmenu', { clientX: 60, clientY: 120 });
    mouse(side.querySelector('.ctx-menu .ci.has-sub')!, 'click');
    const field = side.querySelector<HTMLInputElement>('.ctx-menu .move-filter')!;
    expect(document.activeElement).toBe(field);
    const type = (v: string) => act(() => {
      Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value')!.set!.call(field, v);
      field.dispatchEvent(new Event('input', { bubbles: true }));
    });
    const shown = () => Array.from(side.querySelectorAll<HTMLElement>('.ctx-menu .sub-scroll .ci')).map((e) => e.textContent);
    type('s');
    expect(shown()).toEqual(['/papers', '/sources']);
    type('wozn');
    // flat, with the place it is in
    expect(shown()).toEqual(['“wozniak 1990papers']);
    type('zzz');
    expect(shown()).toEqual(['nothing called that']);
    type('s');
    act(() => { field.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowDown', bubbles: true })); });
    expect(side.querySelector('.ctx-menu .ci.picked')?.textContent).toBe('/sources');
    act(() => { field.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', bubbles: true })); });
    expect(calls).toEqual(['move notes.md → sources']);
    expect(side.querySelector('.ctx-menu')).toBeNull();
  });
});

describe('F2', () => {
  it('renames the selected row only while the tree has focus', () => {
    const box = side.querySelector<HTMLElement>('.edit-tree')!;
    mouse(row('notes.md'), 'mousedown');
    // the page has focus: F2 there is not the tree's
    (document.activeElement as HTMLElement | null)?.blur();
    key('F2');
    expect(side.querySelector('input.rename')).toBeNull();
    act(() => { box.focus(); });
    act(() => { box.dispatchEvent(new KeyboardEvent('keydown', { key: 'F2', bubbles: true, cancelable: true })); });
    expect(side.querySelector<HTMLInputElement>('input.rename')?.value).toBe('notes');
  });
});
