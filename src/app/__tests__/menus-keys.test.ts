// @vitest-environment jsdom
// Every menu from the keyboard (`menuKeys` in `popMenu.ts`): the menu takes
// the focus and gives it back, ↓ ↑ Home End move over the items that can be
// run, ⏎ and space run one, → opens `move to…` and ← or Escape leaves it,
// a letter jumps; nothing typed with a menu open reaches the page behind it
// (`menuOpen`, which the canvas counts as covered); ⇧F10 and the Menu key
// open a row's menu in the tree and the folder lens. And the controls that
// were bare spans are buttons that look the same, and the queue's narrow
// layout goes by its pane.

import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { act, createElement } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { TreeNode } from '../../vault/index.js';
import { closePopMenu, menuItems, popMenu, popMenuOpen, type PopItem } from '../popMenu.js';
import { emptyPanes, openTab } from '../panes.js';
import { useApp } from '../store.js';
import { isMenuKey } from '../treeModel.js';

const calls: string[] = [];

vi.mock('../vault.js', async (orig) => {
  const real = await orig<typeof import('../vault.js')>();
  return {
    ...real,
    moveNode: vi.fn(async (path: string, dir: string) => { calls.push(`move ${path} → ${dir}`); return path; }),
    duplicateNode: vi.fn(async (path: string) => { calls.push(`duplicate ${path}`); return path; }),
    openNode: vi.fn((path: string) => { calls.push(`open ${path}`); }),
  };
});
vi.mock('../remove.js', () => ({ deleteNode: vi.fn(async (path: string) => { calls.push(`remove ${path}`); }) }));

// the canvas's lens, as a mark of whether it is given the keys
vi.mock('../Lenses.js', async (orig) => {
  const real = await orig<typeof import('../Lenses.js')>();
  return { ...real, Lens: ({ id, active }: { id: string; active: boolean }) => createElement('div', { className: 'lens-mark', 'data-id': id, 'data-on': active ? '1' : '0' }) };
});

const { Tree } = await import('../Tree.js');
const { Canvas } = await import('../Canvas.js');
const { Notebook } = await import('../Rail.js');
const { Lens: FolderLens } = await vi.importActual<typeof import('../Lenses.js')>('../Lenses.js');

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

const TREE: TreeNode[] = [
  { kind: 'folder', name: 'papers', path: 'papers', children: [{ kind: 'doc', name: 'wozniak-1990.md', path: 'papers/wozniak-1990.md' }] },
  { kind: 'folder', name: 'sources', path: 'sources', children: [] },
  { kind: 'doc', name: 'notes.md', path: 'notes.md' },
];

let root: Root | null = null;
let host: HTMLDivElement;

function mount(el: React.ReactElement, cls = 'side'): void {
  host = document.createElement('div');
  host.className = cls;
  document.body.appendChild(host);
  root = createRoot(host);
  act(() => { root!.render(el); });
}

/** A key as the window gets it: pressed on whatever has the focus. True when nothing took it. */
function key(k: string, init: KeyboardEventInit = {}): boolean {
  let free = true;
  act(() => { free = (document.activeElement ?? document.body).dispatchEvent(new KeyboardEvent('keydown', { key: k, bubbles: true, cancelable: true, ...init })); });
  return free;
}
const tick = async () => { await act(async () => { await new Promise((r) => setTimeout(r, 0)); }); };
const menu = () => document.querySelector<HTMLElement>('.ctx-menu');
/** The lit item's words, its glyph and key left out. */
const lit = () => {
  const a = document.activeElement as HTMLElement | null;
  if (!a?.classList.contains('ci')) return null;
  const words = a.cloneNode(true) as HTMLElement;
  words.querySelectorAll('.cg, .ck').forEach((x) => x.remove());
  return words.textContent;
};
const fire = (el: Element, type: string, init: MouseEventInit = {}) => { act(() => { el.dispatchEvent(new MouseEvent(type, { bubbles: true, cancelable: true, ...init })); }); };
const AT = { left: 10, top: 10, bottom: 20 };

beforeEach(() => {
  calls.length = 0;
  // a press before each: a menu opened next is the pointer's, until a key says otherwise
  window.dispatchEvent(new MouseEvent('mousedown'));
  useApp.setState({ vault: '/v', tree: TREE, docs: { 'papers/wozniak-1990.md': { type: 'source', frozen: true, cards: 0, due: 0 }, 'notes.md': { type: 'draft', frozen: false, cards: 0, due: 0 } }, open: { '': true, papers: true }, order: {}, panes: emptyPanes(), menuOpen: false });
});

afterEach(() => {
  closePopMenu();
  if (root) act(() => { root!.unmount(); });
  root = null;
  host?.remove();
  document.body.querySelectorAll('.ctx-menu, button.was').forEach((e) => e.remove());
});

// ── the keys ──────────────────────────────────────────────────────

describe('a menu\'s keys', () => {
  const ran: string[] = [];
  const ITEMS: PopItem[] = [
    { label: 'row above', act: 'a', run: () => ran.push('row above') },
    { label: 'row below', act: 'b', run: () => ran.push('row below') },
    { label: '-' },
    { label: 'centre', act: 'c', run: () => ran.push('centre') },
    { label: 'delete row', act: 'd', danger: true, run: () => ran.push(`delete row, focus on ${(document.activeElement as HTMLElement | null)?.className}`) },
  ];
  let was: HTMLButtonElement;
  beforeEach(() => {
    ran.length = 0;
    was = document.body.appendChild(document.createElement('button'));
    was.className = 'was';
    was.focus();
  });

  it('is a menu of menu items, none a Tab stop, its dividers no stops at all', () => {
    const el = popMenu(AT, ITEMS);
    expect(el.getAttribute('role')).toBe('menu');
    const rows = Array.from(el.querySelectorAll<HTMLElement>('.ci'));
    expect(rows.map((r) => [r.getAttribute('role'), r.tabIndex])).toEqual(rows.map(() => ['menuitem', -1]));
    expect(el.querySelector('.cd')!.getAttribute('role')).toBe('separator');
    expect(menuItems(el)).toHaveLength(4);
  });

  it('takes the focus as it opens: the menu itself from the pointer, its first item from the keys; Escape gives it back', () => {
    const el = popMenu(AT, ITEMS);
    expect(document.activeElement).toBe(el);
    expect(useApp.getState().menuOpen).toBe(true);
    expect(key('Escape')).toBe(false);
    expect(popMenuOpen()).toBeNull();
    expect(document.activeElement).toBe(was);
    expect(useApp.getState().menuOpen).toBe(false);
    // a key was the last thing pressed: the next menu lights its first item
    popMenu(AT, ITEMS);
    expect(lit()).toBe('row above');
  });

  it('↓ ↑ go round the ends over the dividers, Home and End to the ends, a letter to the next item starting with it', () => {
    popMenu(AT, ITEMS);
    key('ArrowDown');
    expect(lit()).toBe('row above');
    key('ArrowDown'); key('ArrowDown');
    expect(lit()).toBe('centre');
    key('ArrowDown'); key('ArrowDown');
    expect(lit()).toBe('row above');
    key('ArrowUp');
    expect(lit()).toBe('delete row');
    key('Home');
    expect(lit()).toBe('row above');
    key('End');
    expect(lit()).toBe('delete row');
    key('r');
    expect(lit()).toBe('row above');
    key('r');
    expect(lit()).toBe('row below');
    key('r');
    expect(lit()).toBe('row above');
    key('C');
    expect(lit()).toBe('centre');
    key('z');
    expect(lit()).toBe('centre');
  });

  it('⏎ and space run the lit item, the focus back where it was by then; with none lit they run nothing', () => {
    popMenu(AT, ITEMS);
    document.querySelector<HTMLElement>('.ctx-menu')!.focus();
    key('Enter');
    expect(ran).toEqual([]);
    expect(popMenuOpen()).not.toBeNull();
    key('End');
    key('Enter');
    expect(ran).toEqual(['delete row, focus on was']);
    expect(popMenuOpen()).toBeNull();
    popMenu(AT, ITEMS);
    key('ArrowDown'); key(' ');
    expect(ran[1]).toBe('row below');
  });

  it('an item that is off is no stop', () => {
    const el = popMenu(AT, ITEMS);
    el.querySelector<HTMLElement>('[data-act="b"]')!.setAttribute('aria-disabled', 'true');
    el.querySelector<HTMLElement>('[data-act="c"]')!.classList.add('none');
    key('Home'); key('ArrowDown');
    expect(lit()).toBe('delete row');
  });

  it('no key reaches the page behind an open menu, a chord neither; with it closed they do again', () => {
    const got: string[] = [];
    const page = (e: KeyboardEvent) => { got.push(e.key); };
    window.addEventListener('keydown', page);
    document.addEventListener('keydown', page, true);
    popMenu(AT, ITEMS);
    for (const k of [' ', '1', '4', 'Backspace', 'j', 'F2', 'ArrowDown']) key(k);
    key('Backspace', { metaKey: true });
    key('a', { metaKey: true });
    expect(got).toEqual([]);
    closePopMenu();
    key('j');
    expect(got).toEqual(['j', 'j']);
    window.removeEventListener('keydown', page);
    document.removeEventListener('keydown', page, true);
  });

  it('the pointer and the keys light one row between them', () => {
    const el = popMenu(AT, ITEMS);
    key('ArrowDown');
    fire(el.querySelector('[data-act="c"]')!, 'mousemove');
    expect(lit()).toBe('centre');
    key('ArrowDown');
    expect(lit()).toBe('delete row');
    act(() => { el.dispatchEvent(new MouseEvent('mouseleave')); });
    expect(document.activeElement).toBe(el);
  });

  it('a menu drawn by a view of its own (a deck row\'s) has the same keys, and lets them go when it is gone', async () => {
    const el = document.body.appendChild(document.createElement('div'));
    el.className = 'ctx-menu';
    const picked: string[] = [];
    for (const name of ['edit', 'suspend']) {
      const it = el.appendChild(document.createElement('div'));
      it.className = 'ci';
      it.textContent = name;
      it.addEventListener('click', () => picked.push(name));
    }
    // found once the press that opened it is over
    fire(document.body, 'contextmenu');
    await tick();
    expect(document.activeElement).toBe(el);
    key('ArrowDown');
    expect(useApp.getState().menuOpen).toBe(true);
    expect(lit()).toBe('edit');
    key('s');
    key('Enter');
    expect(picked).toEqual(['suspend']);
    // Escape is its owner's to close it by: let through
    expect(key('Escape')).toBe(true);
    el.remove();
    await tick();
    expect(useApp.getState().menuOpen).toBe(false);
    expect(document.activeElement).toBe(was);
  });
});

// ── the tree ──────────────────────────────────────────────────────

describe('a row\'s menu from the keys', () => {
  const box = () => host.querySelector<HTMLElement>('.tree')!;
  const row = (p: string) => host.querySelector<HTMLElement>(`.trow[data-path="${p}"]:not(.placeholder)`)!;
  const selected = () => Array.from(host.querySelectorAll<HTMLElement>('.trow[data-selected="1"]')).map((r) => r.dataset.path);
  const open = (path: string, k: KeyboardEventInit = { key: 'F10', shiftKey: true }) => {
    mount(createElement(Tree, { activeId: undefined, onOpen: () => {} }));
    fire(row(path), 'mousedown');
    box().focus();
    key(k.key!, k);
  };

  it('⇧F10 and the Menu key are the menu\'s key; F10 alone and ⌘⇧F10 are not', () => {
    expect(isMenuKey({ key: 'F10', shiftKey: true })).toBe(true);
    expect(isMenuKey({ key: 'ContextMenu' })).toBe(true);
    expect(isMenuKey({ key: 'F10' })).toBe(false);
    expect(isMenuKey({ key: 'F10', shiftKey: true, metaKey: true })).toBe(false);
  });

  it('⇧F10 on the selected row opens its menu, the first item lit; Escape closes it and the tree has the keys again', () => {
    open('notes.md');
    expect(menu()).not.toBeNull();
    expect(lit()).toBe('new note');
    expect(useApp.getState().menuOpen).toBe(true);
    // the menu's keys are not the tree's: the selection stays, nothing is deleted or renamed
    key('ArrowDown'); key('ArrowDown');
    key('Backspace', { metaKey: true });
    key('F2');
    expect(selected()).toEqual(['notes.md']);
    expect(calls).toEqual([]);
    expect(host.querySelector('input.rename')).toBeNull();
    // two down from `new note`: past `new written notes` (milestone 82)
    expect(lit()).toBe('new source');
    key('Escape');
    expect(menu()).toBeNull();
    expect(document.activeElement).toBe(box());
    expect(useApp.getState().menuOpen).toBe(false);
    key('ArrowUp');
    expect(selected()).toEqual(['sources']);
  });

  it('the Menu key does the same; on the collection\'s own row it is the root\'s menu', () => {
    open('', { key: 'ContextMenu' });
    expect(lit()).toBe('new note');
    expect(Array.from(menu()!.querySelectorAll('.ci')).some((i) => i.textContent?.includes('rename'))).toBe(false);
  });

  it('→ on `move to…` opens its list, the filter typed in at once; Escape or ← leaves it for that row; ⏎ in the list moves', async () => {
    open('notes.md');
    key('m');
    expect(lit()).toBe('move to…');
    // → on any other row does nothing
    key('ArrowUp'); key('ArrowRight');
    expect(menu()!.querySelector('.sub-scroll')).toBeNull();
    key('ArrowDown'); key('ArrowRight');
    const field = () => menu()!.querySelector<HTMLInputElement>('.move-filter');
    expect(document.activeElement).toBe(field());
    key('Escape');
    await tick();
    expect(menu()!.querySelector('.sub-scroll')).toBeNull();
    expect(lit()).toBe('move to…');
    key('Enter');
    expect(document.activeElement).toBe(field());
    key('ArrowLeft');
    await tick();
    expect(lit()).toBe('move to…');
    key('ArrowRight');
    // the list's own keys are the field's: ↓ picks, ⏎ moves
    key('ArrowDown'); key('Enter');
    await tick();
    expect(calls).toEqual(['move notes.md → papers/wozniak-1990']);
    expect(menu()).toBeNull();
    // opened from the keys, it leaves the keys on the tree
    expect(document.activeElement).toBe(box());
  });

  it('an item run from a menu the pointer opened gives the keys to the page, as before', () => {
    mount(createElement(Tree, { activeId: undefined, onOpen: () => {} }));
    box().focus();
    fire(row('notes.md'), 'contextmenu', { clientX: 40, clientY: 40 });
    expect(document.activeElement).toBe(menu());
    fire(Array.from(menu()!.querySelectorAll('.ci')).find((i) => i.textContent?.includes('duplicate'))!, 'click');
    expect(calls).toEqual(['duplicate notes.md']);
    expect(document.activeElement).toBe(document.body);
  });

  it('a rename under way keeps its keys when a menu opens over it; Escape ends both', () => {
    mount(createElement(Tree, { activeId: undefined, onOpen: () => {} }));
    fire(row('notes.md'), 'dblclick');
    const field = host.querySelector<HTMLInputElement>('input.rename')!;
    expect(document.activeElement).toBe(field);
    fire(row('sources'), 'contextmenu', { clientX: 40, clientY: 40 });
    expect(menu()).not.toBeNull();
    expect(document.activeElement).toBe(field);
    expect(key('a')).toBe(true);
    key('Escape');
    expect(menu()).toBeNull();
    expect(host.querySelector('input.rename')).toBeNull();
  });

  it('a row\'s `+` and `···` are buttons with a name, and the tree stays the one Tab stop', () => {
    mount(createElement(Tree, { activeId: undefined, onOpen: () => {} }));
    const acts = Array.from(row('papers').querySelectorAll<HTMLElement>('.ra'));
    expect(acts.map((a) => [a.tagName, a.getAttribute('type'), a.getAttribute('aria-label'), a.tabIndex])).toEqual([
      ['BUTTON', 'button', 'add under papers', -1],
      ['BUTTON', 'button', 'more', -1],
    ]);
    fire(acts[1]!, 'click');
    expect(menu()).not.toBeNull();
  });
});

describe('the folder lens', () => {
  it('a row is reached by Tab: ⇧F10 opens its menu at it, Escape gives the row the focus back, ⏎ opens it', () => {
    const opened: string[] = [];
    mount(createElement(FolderLens, { id: 'papers', active: true, onOpen: (p: string) => { opened.push(p); } }), 'pane-body');
    const li = host.querySelector<HTMLElement>('.fv-row[data-path="papers/wozniak-1990.md"]')!;
    expect(li.tabIndex).toBe(0);
    li.focus();
    key('F10', { shiftKey: true });
    expect(menu()).not.toBeNull();
    expect(lit()).toBe('new note');
    key('Escape');
    expect(menu()).toBeNull();
    expect(document.activeElement).toBe(li);
    key('Enter');
    expect(opened).toEqual(['papers/wozniak-1990.md']);
  });
});

describe('the tab rail', () => {
  it('⇧F10 on the selected tab opens its menu, as a right-click does; its `+` and `···` are buttons with a name', () => {
    const NB: TreeNode[] = [{ kind: 'doc', name: 'course.md', path: 'course.md', children: [{ kind: 'doc', name: 'week 1.md', path: 'course/week 1.md' }, { kind: 'doc', name: 'cards.md', path: 'course/cards.md' }] }];
    useApp.setState({ tree: NB, docs: { 'course.md': { type: 'note', frozen: false, cards: 0, due: 0, tabs: true }, 'course/week 1.md': { type: 'deck', frozen: false, cards: 0, due: 0 }, 'course/cards.md': { type: 'deck', frozen: false, cards: 0, due: 0 } } });
    mount(createElement(Notebook, { nb: 'course.md', page: 'course/cards.md', active: true, onOpen: () => {}, children: null }), 'pane-body');
    const rail = host.querySelector<HTMLElement>('.rail-rows')!;
    const tab = host.querySelector<HTMLElement>('.rail-row[data-path="course/week 1.md"]')!;
    expect(Array.from(tab.querySelectorAll<HTMLElement>('.ra')).map((a) => [a.tagName, a.getAttribute('aria-label'), a.tabIndex])).toEqual([['BUTTON', 'add after week 1', -1], ['BUTTON', 'more', -1]]);
    fire(tab, 'mousedown');
    rail.focus();
    key('F10', { shiftKey: true });
    expect(menu()).not.toBeNull();
    expect(lit()).toBe('new note');
    key('ArrowDown');
    expect(host.querySelector('.rail-row[data-selected="1"]')?.getAttribute('data-path')).toBe('course/week 1.md');
    key('Escape');
    expect(menu()).toBeNull();
    expect(document.activeElement).toBe(rail);
    // the `▾` beside `+ add tab`: a menu with the same keys
    act(() => { host.querySelector<HTMLElement>('.rail-more')!.click(); });
    expect(lit()).toBe('note');
    key('End');
    expect(lit()).toBe('import a file…');
    key('Escape');
    expect(menu()).toBeNull();
  });
});

// ── the canvas ────────────────────────────────────────────────────

describe('the canvas', () => {
  const lensOn = () => Array.from(host.querySelectorAll<HTMLElement>('.lens-mark')).map((l) => `${l.dataset.id} ${l.dataset.on}`);

  it('an open menu covers the page: its lens is not given the keys until the menu closes', () => {
    useApp.setState({ panes: openTab(emptyPanes(), 'notes.md') });
    mount(createElement(Canvas), 'app');
    expect(lensOn()).toEqual(['notes.md 1']);
    act(() => { popMenu(AT, [{ label: 'cut' }]); });
    expect(lensOn()).toEqual(['notes.md 0']);
    act(() => { closePopMenu(); });
    expect(lensOn()).toEqual(['notes.md 1']);
  });

  it('a tab\'s close and the pane\'s controls are buttons with a name: the pane\'s reached by Tab, the tab\'s not (⌘W)', () => {
    useApp.setState({ panes: openTab(openTab(emptyPanes(), 'notes.md'), 'papers/wozniak-1990.md', { cmdClick: true, shiftClick: true }) });
    mount(createElement(Canvas), 'app');
    const bar = host.querySelector<HTMLElement>('.tabbar')!;
    const close = bar.querySelector<HTMLElement>('.tab .close')!;
    expect([close.tagName, close.getAttribute('type'), close.getAttribute('aria-label'), close.tabIndex]).toEqual(['BUTTON', 'button', 'close tab', -1]);
    const ctl = Array.from(bar.querySelectorAll<HTMLElement>('.ctl'));
    expect(ctl.map((c) => [c.tagName, c.getAttribute('type'), c.getAttribute('aria-label'), c.tabIndex])).toEqual([
      ['BUTTON', 'button', 'split pane', 0],
      ['BUTTON', 'button', 'close pane', 0],
    ]);
    // they do what they did
    fire(ctl[1]!, 'click');
    expect(useApp.getState().panes.panes).toHaveLength(1);
  });
});

// ── the look ──────────────────────────────────────────────────────

describe('the look', () => {
  const css = (file: string) => readFileSync(join(import.meta.dirname, '..', file), 'utf8');
  const rule = (sheet: string, selector: string) => {
    const at = sheet.indexOf(`\n${selector} {`);
    expect(at, selector).toBeGreaterThanOrEqual(0);
    return sheet.slice(at, sheet.indexOf('}', at));
  };

  it('a button in a span\'s place is drawn as the span was: no chrome of its own, the font and the colour its place\'s', () => {
    const app = css('app.css');
    for (const sel of ['.tabbar .tab .close', '.tabbar .ctl', '.tree .row .ra, .tab-rail .rail-row .ra']) {
      const r = rule(app, sel);
      for (const reset of [/\bappearance:\s*none/, /-webkit-appearance:\s*none/, /\bborder:\s*0;/, /\bbackground:\s*none/, /\bfont:\s*inherit/, /\bpadding:\s*0;/, /\bmargin:\s*0;/, /\btext-align:\s*inherit/]) expect(r, sel).toMatch(reset);
      // its own colour, set by the rule as before (a button's default is not the text's)
      expect(r, sel).toMatch(/\n\s*color:/);
    }
    // the pane control's one line is set after the reset, not wiped by it
    const ctl = rule(app, '.tabbar .ctl');
    expect(ctl.indexOf('border: 0;')).toBeLessThan(ctl.indexOf('border-right:'));
  });

  it('the row the keys are on is lit as the one under the pointer', () => {
    const app = css('app.css');
    expect(app).toContain('.ctx-menu .ci:hover, .ctx-menu .ci:focus {');
    expect(app).toContain('.ctx-menu .ci.danger:hover, .ctx-menu .ci.danger:focus {');
    expect(app).toMatch(/\.ctx-menu:focus, \.ctx-menu \.ci:focus \{ outline: none; \}/);
  });

  it('the queue\'s narrow layout goes by its pane: the pane\'s body is the container, the rule a container\'s at the same width', () => {
    expect(rule(css('app.css'), '.pane-body')).toMatch(/container-type:\s*inline-size/);
    const queue = css('queue.css');
    expect(queue).toMatch(/@container \(max-width: 720px\) \{\s*\.qlist li \{/);
    expect(queue).not.toMatch(/@media \(max-width: 720px\)/);
    // a phone's rows are laid out by rules of their own, which ask nothing of the window's width
    expect(css('phone.css')).not.toMatch(/@media[^{]*max-width[^{]*\{\s*[^}]*qlist/);
  });
});
