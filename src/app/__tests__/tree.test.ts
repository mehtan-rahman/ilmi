// @vitest-environment jsdom
// The sidebar's context menu, in the DOM: the root's menu from the empty
// space of the sidebar, a row's own from the row, `move to…` on a click and
// not on hover, `◂ move to…` back, Escape and an outside press closing it,
// and the menu kept inside the window at the bottom edge.

import { act, createElement } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import type { TreeNode } from '../../vault/index.js';
import { useApp } from '../store.js';
import { Tree } from '../Tree.js';

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
const row = (path: string) => Array.from(side.querySelectorAll<HTMLElement>('.trow')).find((r) => r.querySelector('.name')?.textContent === path.split('/').pop()?.replace(/\.md$/, ''))!;

beforeEach(() => {
  useApp.setState({ vault: '/v', tree: TREE, docs: { 'papers/wozniak-1990.md': { type: 'source', frozen: true, cards: 0, due: 0 }, 'notes.md': { type: 'draft', frozen: false, cards: 0, due: 0 } }, open: { '': true, papers: true } });
  mount();
});

afterEach(() => {
  act(() => { root.unmount(); });
  side.remove();
});

describe('the sidebar menu', () => {
  it('opens the root\'s menu from the sidebar\'s empty space and its heading, new items landing at the root', () => {
    expect(side.querySelectorAll('.trow')).toHaveLength(5);
    expect(menu()).toBeNull();
    const ev = new MouseEvent('contextmenu', { bubbles: true, cancelable: true, clientX: 40, clientY: 300 });
    act(() => { side.dispatchEvent(ev); });
    expect(ev.defaultPrevented).toBe(true);
    expect(menu()).not.toBeNull();
    expect(entries()).toEqual(['new source', 'new folder', 'new deck', 'new draft', 'add a source']);
    expect(menu()!.style.left).toBe('40px');
    key('Escape');
    expect(menu()).toBeNull();
    mouse(side.querySelector('h6')!, 'contextmenu', { clientX: 10, clientY: 10 });
    expect(entries()).toEqual(['new source', 'new folder', 'new deck', 'new draft', 'add a source']);
  });

  it('keeps a row\'s own menu, with rename, move to…, and delete', () => {
    mouse(row('papers/wozniak-1990.md'), 'contextmenu', { clientX: 60, clientY: 80 });
    expect(entries()).toEqual(['new source', 'new folder', 'new deck', 'new draft', 'add a source', 'rename', 'move to…', 'delete source']);
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
    expect(Array.from(sub()!.querySelectorAll('.ci')).map((e) => e.textContent)).toEqual(['/papers', '/sources']);
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
