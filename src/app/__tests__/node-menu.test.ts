// @vitest-environment jsdom
// One context menu in the tree and the folder lens: the same entries for a
// row, the folder's own from the empty space, new items landing in the
// folder shown, rename inline in the row, and the sidebar's `+`. The vault's
// writers are stubbed; a new node joins the store's tree as the vault's
// event would add it.

import { act, createElement } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { TreeNode } from '../../vault/index.js';
import { useApp } from '../store.js';

const calls: string[] = [];

vi.mock('../vault.js', async (orig) => {
  const real = await orig<typeof import('../vault.js')>();
  return {
    ...real,
    createNode: vi.fn(async (dir: string, type: string) => {
      calls.push(`create ${dir}|${type}`);
      const path = type === 'folder' ? `${dir ? `${dir}/` : ''}new folder` : `${dir ? `${dir}/` : ''}new ${type}.md`;
      const node: TreeNode = type === 'folder' ? { kind: 'folder', name: 'new folder', path, children: [] } : { kind: 'doc', name: `new ${type}.md`, path };
      const add = (nodes: TreeNode[]): TreeNode[] => (dir === '' ? [...nodes, node] : nodes.map((n) => (
        n.kind === 'folder' && n.path === dir ? { ...n, children: [...n.children, node] }
          : n.kind === 'doc' && n.path === `${dir}.md` ? { ...n, children: [...(n.children ?? []), node] }
            : n.kind === 'folder' ? { ...n, children: add(n.children) } : n.children ? { ...n, children: add(n.children) } : n)));
      useApp.setState((s) => ({ tree: add(s.tree), docs: type === 'folder' ? s.docs : { ...s.docs, [path]: { type: type as 'deck', frozen: false, cards: 0, due: 0 } } }));
      return path;
    }),
    renameNode: vi.fn(async (path: string, name: string) => { calls.push(`rename ${path}|${name}`); return path; }),
    removeNode: vi.fn(async (path: string) => { calls.push(`remove ${path}`); }),
    openIntake: vi.fn((dir: string) => { calls.push(`intake ${dir}`); }),
    sortByName: vi.fn(async (dir: string) => { calls.push(`sort ${dir}`); }),
    openNode: vi.fn((path: string) => { calls.push(`open ${path}`); }),
  };
});

vi.mock('../land.js', async (orig) => {
  const real = await orig<typeof import('../land.js')>();
  return { ...real, importFiles: vi.fn(async (dir: string) => { calls.push(`import ${dir}`); return []; }) };
});

const { Tree } = await import('../Tree.js');
const { Lens } = await import('../Lenses.js');

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

const TREE: TreeNode[] = [
  { kind: 'folder', name: 'papers', path: 'papers', children: [{ kind: 'doc', name: 'wozniak-1990.md', path: 'papers/wozniak-1990.md' }, { kind: 'folder', name: 'old', path: 'papers/old', children: [] }] },
  { kind: 'folder', name: 'sources', path: 'sources', children: [] },
  { kind: 'doc', name: 'notes.md', path: 'notes.md' },
];

let root: Root;
let host: HTMLDivElement;

function mount(el: React.ReactElement, cls = 'side') {
  host = document.createElement('div');
  host.className = cls;
  document.body.appendChild(host);
  root = createRoot(host);
  act(() => { root.render(el); });
}

const flush = async () => { await act(async () => { await new Promise((r) => setTimeout(r, 0)); }); };
const entries = () => Array.from(document.querySelectorAll<HTMLElement>('.ctx-menu .ci')).map((e) => e.textContent?.replace(/^./, '').replace(/F2$|▸$/, '') ?? '');
const fire = (el: Element, type: string, init: MouseEventInit = {}) => { act(() => { el.dispatchEvent(new MouseEvent(type, { bubbles: true, cancelable: true, ...init })); }); };
const click = (label: string) => fire(Array.from(document.querySelectorAll<HTMLElement>('.ctx-menu .ci')).find((e) => e.textContent?.includes(label))!, 'click');
const ROW = ['new note', 'new source', 'new deck', 'new draft', 'new folder', 'import a file…', 'add from text or a link', 'show as tabs', 'rename', 'move to…', 'delete source'];
const FOLDER = ['new note', 'new source', 'new deck', 'new draft', 'new folder', 'import a file…', 'add from text or a link'];

beforeEach(() => {
  calls.length = 0;
  useApp.setState({ vault: '/v', tree: TREE, docs: { 'papers/wozniak-1990.md': { type: 'source', frozen: true, cards: 0, due: 0 }, 'notes.md': { type: 'draft', frozen: false, cards: 0, due: 0 } }, open: { '': true, papers: true }, fileOver: null });
});

afterEach(() => {
  act(() => { root.unmount(); });
  host.remove();
});

describe('one menu, in the tree and the folder lens', () => {
  it('a row\'s menu is the same in both', () => {
    mount(createElement(Tree, { activeId: undefined, onOpen: () => {} }));
    const trow = Array.from(host.querySelectorAll<HTMLElement>('.trow')).find((r) => r.dataset.path === 'papers/wozniak-1990.md')!;
    fire(trow, 'contextmenu', { clientX: 50, clientY: 50 });
    const inTree = entries();
    expect(inTree).toEqual(ROW);
    act(() => { root.unmount(); });
    host.remove();

    mount(createElement(Lens, { id: 'papers', active: true, onOpen: () => {} }), 'pane-body');
    const fv = host.querySelector<HTMLElement>('.fv-row[data-path="papers/wozniak-1990.md"]')!;
    fire(fv, 'contextmenu', { clientX: 300, clientY: 120 });
    expect(entries()).toEqual(inTree);
    expect(host.querySelectorAll('.ctx-menu')).toHaveLength(1);
  });

  it('the folder lens\'s empty space opens the folder\'s own menu; a new item lands in the folder and is renamed in its row', async () => {
    mount(createElement(Lens, { id: 'papers', active: true, onOpen: () => {} }), 'pane-body');
    const ev = new MouseEvent('contextmenu', { bubbles: true, cancelable: true, clientX: 300, clientY: 500 });
    act(() => { host.querySelector('.folder-view')!.dispatchEvent(ev); });
    expect(ev.defaultPrevented).toBe(true);
    // the menu the folder's own row has in the tree
    expect(entries()).toEqual([...FOLDER, 'rename', 'move to…', 'delete folder']);
    click('new deck');
    await flush();
    expect(calls).toEqual(['create papers|deck']);
    expect(host.querySelector('.ctx-menu')).toBeNull();
    const input = host.querySelector<HTMLInputElement>('.fv-row[data-path="papers/new deck.md"] input.fv-rename');
    expect(input).not.toBeNull();
    expect(input!.value).toBe('new deck');
  });

  it('the root\'s folder lens: its empty space has the root\'s menu, nothing to rename or delete', () => {
    mount(createElement(Lens, { id: '', active: true, onOpen: () => {} }), 'pane-body');
    fire(host.querySelector('.folder-view h1')!, 'contextmenu', { clientX: 300, clientY: 40 });
    expect(entries()).toEqual(FOLDER);
  });

  it('rename from a row\'s menu is inline in the folder lens\'s row', async () => {
    mount(createElement(Lens, { id: 'papers', active: true, onOpen: () => {} }), 'pane-body');
    fire(host.querySelector('.fv-row[data-path="papers/wozniak-1990.md"]')!, 'contextmenu', { clientX: 300, clientY: 120 });
    click('rename');
    const input = host.querySelector<HTMLInputElement>('.fv-row[data-path="papers/wozniak-1990.md"] input.fv-rename')!;
    expect(input.value).toBe('wozniak-1990');
    act(() => {
      Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value')!.set!.call(input, 'Wozniak 1990');
      input.dispatchEvent(new Event('input', { bubbles: true }));
    });
    act(() => { input.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', bubbles: true })); });
    await flush();
    expect(calls).toEqual(['rename papers/wozniak-1990.md|Wozniak 1990']);
    expect(host.querySelector('input.fv-rename')).toBeNull();
  });

  it('a subfolder row\'s menu sends new items, imports, and the intake into that folder', async () => {
    mount(createElement(Lens, { id: 'papers', active: true, onOpen: () => {} }), 'pane-body');
    const open = () => fire(host.querySelector('.fv-row[data-path="papers/old"]')!, 'contextmenu', { clientX: 300, clientY: 160 });
    open();
    expect(entries()).toEqual([...FOLDER, 'rename', 'move to…', 'delete folder']);
    click('import a file…');
    open();
    click('add from text or a link');
    open();
    click('new source');
    await flush();
    expect(calls).toEqual(['import papers/old', 'intake papers/old', 'create papers/old|source']);
  });

  it('`+ source` opens the intake for the folder; the other buttons make the item', async () => {
    mount(createElement(Lens, { id: 'papers', active: true, onOpen: () => {} }), 'pane-body');
    const btn = (label: string) => Array.from(host.querySelectorAll<HTMLButtonElement>('.fv-new button')).find((b) => b.textContent === label)!;
    act(() => { btn('+ source').click(); });
    act(() => { btn('+ draft').click(); });
    await flush();
    expect(calls).toEqual(['intake papers', 'create papers|draft']);
  });

  it('the tree\'s rows carry their path for a drop, and a row under an OS drag is lit', () => {
    mount(createElement(Tree, { activeId: undefined, onOpen: () => {} }));
    expect(Array.from(host.querySelectorAll<HTMLElement>('.trow')).map((r) => r.dataset.path)).toEqual(['', 'papers', 'papers/wozniak-1990.md', 'papers/old', 'sources', 'notes.md']);
    act(() => { useApp.setState({ fileOver: 'sources' }); });
    expect(host.querySelector('.trow[data-path="sources"]')!.className).toContain('drop-into');
    expect(host.querySelectorAll('.drop-into')).toHaveLength(1);
  });
});

describe('the sidebar\'s +', () => {
  it('opens the add menu for the root, or for the selected folder', async () => {
    mount(createElement(Tree, { activeId: undefined, onOpen: () => {} }));
    const plus = () => host.querySelector<HTMLElement>('.trow[data-path=""] .side-add')!;
    fire(plus(), 'click');
    expect(entries()).toEqual(['new note', 'new source', 'new deck', 'new draft', 'new folder', 'import a file…', 'add from text or a link']);
    click('import a file…');
    fire(host.querySelector('.trow[data-path="sources"]')!, 'mousedown');
    fire(plus(), 'click');
    click('new deck');
    await flush();
    // a document selected: back to the root
    fire(host.querySelector('.trow[data-path="notes.md"]')!, 'mousedown');
    fire(plus(), 'click');
    click('add from text or a link');
    expect(calls).toEqual(['import ', 'create sources|deck', 'intake ']);
  });
});

// ── milestone 30: inside a document ──

describe('inside a document', () => {
  const NESTED: TreeNode[] = [
    { kind: 'folder', name: 'papers', path: 'papers', children: [
      { kind: 'doc', name: 'wozniak-1990', path: 'papers/wozniak-1990.md', children: [
        { kind: 'doc', name: 'woz-ex1', path: 'papers/wozniak-1990/woz-ex1.md' },
        { kind: 'folder', name: 'figures', path: 'papers/wozniak-1990/figures', children: [{ kind: 'doc', name: 'fig', path: 'papers/wozniak-1990/figures/fig.md' }] },
      ] },
    ] },
    { kind: 'doc', name: 'notes', path: 'notes.md' },
  ];
  beforeEach(() => {
    useApp.setState({
      tree: NESTED,
      docs: { 'papers/wozniak-1990.md': { type: 'source', frozen: true, cards: 0, due: 0, title: 'Wozniak 1990' }, 'papers/wozniak-1990/woz-ex1.md': { type: 'extract', frozen: false, cards: 0, due: 0 }, 'papers/wozniak-1990/figures/fig.md': { type: 'source', frozen: false, cards: 0, due: 0 }, 'notes.md': { type: 'draft', frozen: false, cards: 0, due: 0 } },
      open: { '': true, papers: true },
      order: {},
    });
  });
  const trow = (path: string) => Array.from(host.querySelectorAll<HTMLElement>('.trow')).find((r) => r.dataset.path === path)!;

  it('a document row\'s menu makes new items, imports, and the intake inside the document', async () => {
    mount(createElement(Tree, { activeId: undefined, onOpen: () => {} }));
    const open = () => fire(trow('papers/wozniak-1990.md'), 'contextmenu', { clientX: 50, clientY: 50 });
    open();
    click('new deck');
    open();
    click('import a file…');
    open();
    click('add from text or a link');
    await flush();
    expect(calls).toEqual(['create papers/wozniak-1990|deck', 'import papers/wozniak-1990', 'intake papers/wozniak-1990']);
  });

  it('a document\'s children open as a folder lens: its rows, the document\'s own menu in the empty space, a new item landing inside', async () => {
    mount(createElement(Lens, { id: 'papers/wozniak-1990', active: true, onOpen: () => {} }), 'pane-body');
    expect(host.querySelector('.folder-view h1')?.textContent).toBe('Wozniak 1990');
    expect(host.querySelector('.folder-view .crumb')?.textContent).toBe('inside source');
    expect(Array.from(host.querySelectorAll<HTMLElement>('.fv-row')).map((r) => r.dataset.path)).toEqual(['papers/wozniak-1990/woz-ex1.md', 'papers/wozniak-1990/figures']);
    fire(host.querySelector('.folder-view')!, 'contextmenu', { clientX: 300, clientY: 500 });
    expect(entries()).toEqual(['new note', 'new source', 'new deck', 'new draft', 'new folder', 'import a file…', 'add from text or a link', 'show as tabs', 'rename', 'move to…', 'delete source']);
    click('new draft');
    await flush();
    expect(calls).toEqual(['create papers/wozniak-1990|draft']);
    expect(host.querySelector<HTMLInputElement>('.fv-row[data-path="papers/wozniak-1990/new draft.md"] input.fv-rename')).not.toBeNull();
  });

  it('lists in the order chosen, and offers sort by name only then', async () => {
    act(() => { useApp.setState({ order: { 'papers/wozniak-1990': ['figures/', 'woz-ex1.md'] } }); });
    mount(createElement(Lens, { id: 'papers/wozniak-1990', active: true, onOpen: () => {} }), 'pane-body');
    expect(Array.from(host.querySelectorAll<HTMLElement>('.fv-row')).map((r) => r.dataset.path)).toEqual(['papers/wozniak-1990/figures', 'papers/wozniak-1990/woz-ex1.md']);
    fire(host.querySelector('.folder-view')!, 'contextmenu', { clientX: 300, clientY: 500 });
    expect(entries()).toContain('sort by name');
    click('sort by name');
    await flush();
    expect(calls).toEqual(['sort papers/wozniak-1990']);
    // a folder with no order of its own has no such entry
    fire(host.querySelector('.fv-row[data-path="papers/wozniak-1990/figures"]')!, 'contextmenu', { clientX: 300, clientY: 100 });
    expect(entries()).not.toContain('sort by name');
  });

  it('deleting a document with children asks first and says how many; one without goes at once', async () => {
    mount(createElement(Tree, { activeId: undefined, onOpen: () => {} }));
    fire(trow('papers/wozniak-1990.md'), 'contextmenu', { clientX: 50, clientY: 50 });
    click('delete source');
    expect(host.querySelector('.ctx-menu')).not.toBeNull();
    expect(entries()).toContain('delete with 3 inside?');
    expect(calls).toEqual([]);
    click('delete with 3 inside?');
    await flush();
    expect(host.querySelector('.ctx-menu')).toBeNull();
    fire(trow('notes.md'), 'contextmenu', { clientX: 50, clientY: 50 });
    click('delete draft');
    await flush();
    expect(calls).toEqual(['remove papers/wozniak-1990.md', 'remove notes.md']);
  });
});
