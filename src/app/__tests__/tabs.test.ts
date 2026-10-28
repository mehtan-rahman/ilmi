// @vitest-environment jsdom
// Document tabs (milestone 31): a document with `tabs: true` draws its
// children as a rail beside its page. The pure side (which notebook a page
// is in, the rail's rows in their order with subtabs folded and open, the
// step order, the pane's label, the palette's trail), the rail in the DOM
// inside the canvas (a click showing the child with the rail kept, one pane
// tab for the notebook, the step keys, the fold, `+ tab`, a drag), a page
// opened from the queue landing on its tab, and `addTab` over a real vault
// (a draft child, last in the directory's order).

import { promises as fsp } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { act, createElement } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { meta as fieldsOf } from '../../format/index.js';
import { nodeFs } from '../../vault/node-fs.js';
import { Vault, type TreeNode } from '../../vault/index.js';
import { buildIndex } from '../chrome.js';
import { activeTab, emptyPanes, openTab } from '../panes.js';
import { useApp, type DocInfo } from '../store.js';
import { addTab, notebookOf, notebookPages, notebookTrail, railRows, stepPage, tabAncestors, tabLabel } from '../tabs.js';

const calls: string[] = [];

vi.mock('../vault.js', async (orig) => {
  const real = await orig<typeof import('../vault.js')>();
  return {
    ...real,
    createTab: vi.fn(async (dir: string, type: string, name?: string) => { calls.push(`tab ${dir}|${type}|${name ?? ''}`); return `${dir}/${name ?? 'x'}.md`; }),
    placeNode: vi.fn(async (path: string, target: string, mode: string) => { calls.push(`place ${path} ${mode} ${target}`); return path; }),
    renameNode: vi.fn(async (path: string, name: string) => { calls.push(`rename ${path}|${name}`); return path; }),
  };
});

// the reader's own page is not what is under test here: a stand-in names the page it was given
vi.mock('../Reader.js', async () => {
  const { createElement: h } = await import('react');
  return { Reader: ({ id }: { id: string }) => h('div', { className: 'mock-reader' }, id) };
});

const { Canvas } = await import('../Canvas.js');
const { openCard, openNode } = await import('../vault.js');

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

const NB = 'courses/linear-algebra.md';
const KIDS = 'courses/linear-algebra';
const PSET = `${KIDS}/problem-set-1.md`;
const VECTORS = `${KIDS}/vectors.md`;
const UNIT = `${KIDS}/unit-2`;
const EIGEN = `${KIDS}/unit-2/eigenvalues.md`;

const TREE: TreeNode[] = [
  {
    kind: 'folder', name: 'courses', path: 'courses', children: [
      {
        kind: 'doc', name: 'linear-algebra', path: NB, children: [
          { kind: 'folder', name: 'unit-2', path: UNIT, children: [{ kind: 'doc', name: 'eigenvalues', path: EIGEN }] },
          { kind: 'doc', name: 'problem-set-1', path: PSET },
          { kind: 'doc', name: 'vectors', path: VECTORS },
        ],
      },
    ],
  },
  { kind: 'doc', name: 'german', path: 'german.md' },
];

const info = (type: DocInfo['type'], extra: Partial<DocInfo> = {}): DocInfo => ({ type, frozen: false, cards: 0, due: 0, ...extra });
const DOCS: Record<string, DocInfo> = {
  [NB]: info('source', { title: 'linear algebra', tabs: true }),
  [PSET]: info('deck', { title: 'problem set 1', cards: 2 }),
  [VECTORS]: info('draft'),
  [EIGEN]: info('source'),
  'german.md': info('deck'),
};
const ORDER = { [KIDS]: ['vectors.md', 'problem-set-1.md', 'unit-2/'] };

describe('the notebook a page is in', () => {
  it('is the document with tabs, for itself and everything under it, the outermost when two nest', () => {
    expect(notebookOf(NB, DOCS)).toBe(NB);
    expect(notebookOf(VECTORS, DOCS)).toBe(NB);
    expect(notebookOf(UNIT, DOCS)).toBe(NB);
    expect(notebookOf(EIGEN, DOCS)).toBe(NB);
    // the children directory as a folder lens is not a page, nor is anything outside
    expect(notebookOf(KIDS, DOCS)).toBeNull();
    expect(notebookOf('german.md', DOCS)).toBeNull();
    expect(notebookOf(VECTORS, { ...DOCS, [NB]: info('source') })).toBeNull();
    expect(notebookOf(EIGEN, { ...DOCS, [`${KIDS}/unit-2.md`]: info('source', { tabs: true }) })).toBe(NB);
  });

  it('labels the pane tab `notebook › page`, the notebook alone by its title', () => {
    expect(tabLabel(NB, DOCS, '/v')).toBe('linear algebra');
    expect(tabLabel(UNIT, DOCS, '/v')).toBe('linear algebra › unit-2');
    expect(tabLabel(PSET, DOCS, '/v')).toBe('linear algebra › problem set 1');
    expect(tabLabel('german.md', DOCS, '/v')).toBe('german');
  });
});

describe('the rail', () => {
  it('lists the notebook first, then its tabs in their order, subtabs folded until opened', () => {
    const rows = (open: Record<string, true>) => railRows(TREE, NB, ORDER, open).map((r) => `${'  '.repeat(r.depth)}${r.overview ? 'overview' : r.path.slice(KIDS.length + 1)}${r.has ? (open[r.path] ? ' ▾' : ' ▸') : ''}`);
    expect(rows({})).toEqual(['overview', 'vectors.md', 'problem-set-1.md', 'unit-2 ▸']);
    expect(rows({ [UNIT]: true })).toEqual(['overview', 'vectors.md', 'problem-set-1.md', 'unit-2 ▾', '  unit-2/eigenvalues.md']);
    // without an order, the walk's: folders first, then by name
    expect(railRows(TREE, NB, {}, {}).map((r) => r.path)).toEqual([NB, UNIT, PSET, VECTORS]);
    expect(railRows(TREE, NB, ORDER, {})[0]).toMatchObject({ overview: true, depth: 0 });
  });

  it('steps through every page, subtabs included, and opens the tabs above a page', () => {
    const pages = notebookPages(TREE, NB, ORDER);
    expect(pages).toEqual([NB, VECTORS, PSET, UNIT, EIGEN]);
    expect(stepPage(pages, NB, 1)).toBe(VECTORS);
    expect(stepPage(pages, UNIT, 1)).toBe(EIGEN);
    expect(stepPage(pages, EIGEN, 1)).toBeNull();
    expect(stepPage(pages, NB, -1)).toBeNull();
    expect(stepPage(pages, VECTORS, -1)).toBe(NB);
    expect(tabAncestors(TREE, NB, EIGEN)).toEqual([UNIT]);
    expect(tabAncestors(TREE, NB, VECTORS)).toEqual([]);
  });

  it('indexes a tab in the palette under its notebook', () => {
    expect(notebookTrail(TREE, EIGEN, DOCS, null)).toBe('linear algebra › unit-2');
    expect(notebookTrail(TREE, NB, DOCS, null)).toBeNull();
    const index = buildIndex(TREE, DOCS, [], []);
    expect(index.find((e) => e.key === `p:${EIGEN}`)).toMatchObject({ sub: 'linear algebra › unit-2', target: { open: EIGEN } });
    expect(index.find((e) => e.key === `p:${PSET}`)).toMatchObject({ sub: 'linear algebra' });
    expect(index.find((e) => e.key === 'p:german.md')).toMatchObject({ sub: 'deck' });
  });
});

describe('one pane tab for a notebook', () => {
  it('shows a page in the tab its notebook has, the key kept; anything else opens as before', () => {
    let s = openTab(emptyPanes(), NB);
    const key = activeTab(s)!.key;
    const same = (id: string) => notebookOf(id, DOCS) === NB;
    s = openTab(s, PSET, {}, same);
    expect(s.panes[0]!.tabs.map((t) => t.id)).toEqual([PSET]);
    expect(activeTab(s)!.key).toBe(key);
    s = openTab(s, 'german.md', { newTab: true });
    s = openTab(s, EIGEN, {}, same);
    expect(s.panes[0]!.tabs.map((t) => t.id)).toEqual([EIGEN, 'german.md']);
    expect(s.panes[0]!.active).toBe(0);
  });
});

// ── the rail in the canvas ──────────────────────────────────────

let root: Root;
let host: HTMLDivElement;

const rail = () => host.querySelector<HTMLElement>('.tab-rail');
const railNames = () => Array.from(host.querySelectorAll<HTMLElement>('.rail-row')).map((r) => `${r.dataset.active === '1' ? '*' : ''}${r.querySelector('.name')?.textContent ?? ''}`);
const rowOf = (path: string) => host.querySelector<HTMLElement>(`.rail-row[data-path="${path}"]`)!;
const tabTitles = () => Array.from(host.querySelectorAll<HTMLElement>('.tabbar .tab .title')).map((t) => t.textContent);
const page = () => activeTab(useApp.getState().panes)!.id;
const mouse = (el: Element, type: string, init: MouseEventInit = {}) => {
  act(() => { el.dispatchEvent(new MouseEvent(type, { bubbles: true, cancelable: true, ...init })); });
};
const key = (init: KeyboardEventInit) => { act(() => { window.dispatchEvent(new KeyboardEvent('keydown', { bubbles: true, cancelable: true, ...init })); }); };

describe('the rail in the canvas', () => {
  beforeEach(() => {
    calls.length = 0;
    useApp.setState({ vault: '/v', tree: TREE, docs: DOCS, order: ORDER, open: { '': true }, railFolded: {}, panes: openTab(emptyPanes(), NB), reveal: null, paletteOpen: false, tweaksOpen: false });
    host = document.createElement('div');
    document.body.appendChild(host);
    root = createRoot(host);
    act(() => { root.render(createElement(Canvas)); });
  });

  afterEach(() => {
    act(() => { root.unmount(); });
    host.remove();
  });

  it('draws the notebook and its tabs in their order beside the page, one pane tab labelled by it', () => {
    expect(rail()).not.toBeNull();
    expect(railNames()).toEqual(['*linear algebra', 'vectors', 'problem set 1', 'unit-2']);
    expect(rowOf(UNIT).querySelector('.chev')!.textContent).toBe('▸');
    expect(tabTitles()).toEqual(['linear algebra']);
  });

  it('a click shows the child in the same pane, the rail kept, the pane tab reading `notebook › tab`', () => {
    const before = rail();
    mouse(rowOf(PSET), 'click');
    expect(page()).toBe(PSET);
    expect(rail()).toBe(before);
    expect(railNames()).toEqual(['linear algebra', 'vectors', '*problem set 1', 'unit-2']);
    expect(tabTitles()).toEqual(['linear algebra › problem set 1']);
    expect(useApp.getState().panes.panes[0]!.tabs).toHaveLength(1);
    // the deck tab's own lens is in the page
    expect(host.querySelector('.nb-page')).not.toBeNull();
  });

  it('opens and folds a subtab by its chevron, and opens the tabs above a page shown from elsewhere', () => {
    mouse(rowOf(UNIT).querySelector('.chev')!, 'click');
    expect(railNames()).toEqual(['*linear algebra', 'vectors', 'problem set 1', 'unit-2', 'eigenvalues']);
    expect(rowOf(EIGEN).style.paddingLeft).toBe('20px');
    mouse(rowOf(UNIT).querySelector('.chev')!, 'click');
    expect(railNames()).toEqual(['*linear algebra', 'vectors', 'problem set 1', 'unit-2']);
    act(() => { openNode(EIGEN); });
    expect(railNames()).toEqual(['linear algebra', 'vectors', 'problem set 1', 'unit-2', '*eigenvalues']);
  });

  it('a page opened from the queue lands on its tab in the notebook already open', () => {
    const key0 = activeTab(useApp.getState().panes)!.key;
    act(() => { openCard(PSET, 3, 'pa-1'); });
    expect(page()).toBe(PSET);
    expect(activeTab(useApp.getState().panes)!.key).toBe(key0);
    expect(useApp.getState().reveal).toEqual({ path: PSET, index: 3, id: 'pa-1' });
    expect(tabTitles()).toEqual(['linear algebra › problem set 1']);
    // with the notebook not open, the page opens in a tab of its own, the rail beside it
    act(() => { useApp.setState({ panes: openTab(emptyPanes(), 'german.md') }); });
    act(() => { openNode(VECTORS); });
    expect(tabTitles()).toEqual(['linear algebra › vectors']);
    expect(railNames()).toEqual(['linear algebra', '*vectors', 'problem set 1', 'unit-2']);
  });

  it('⌘⌥↓ and ⌘⌥↑ step to the next and previous tab, subtabs counted', () => {
    key({ key: 'ArrowDown', metaKey: true, altKey: true });
    expect(page()).toBe(VECTORS);
    key({ key: 'ArrowDown', metaKey: true, altKey: true });
    key({ key: 'ArrowDown', metaKey: true, altKey: true });
    expect(page()).toBe(UNIT);
    key({ key: 'ArrowDown', metaKey: true, altKey: true });
    expect(page()).toBe(EIGEN);
    expect(railNames()).toContain('*eigenvalues');
    key({ key: 'ArrowDown', metaKey: true, altKey: true });
    expect(page()).toBe(EIGEN);
    key({ key: 'ArrowUp', metaKey: true, altKey: true });
    expect(page()).toBe(UNIT);
  });

  it('⌘⇧[ and the handle fold the rail to a strip and back, per notebook', () => {
    key({ key: '{', code: 'BracketLeft', metaKey: true, shiftKey: true });
    expect(useApp.getState().railFolded).toEqual({ [NB]: true });
    expect(rail()!.classList.contains('folded')).toBe(true);
    expect(host.querySelectorAll('.rail-row')).toHaveLength(0);
    mouse(host.querySelector('.rail-fold')!, 'click');
    expect(useApp.getState().railFolded).toEqual({});
    expect(railNames()).toHaveLength(4);
    mouse(host.querySelector('.rail-fold')!, 'click');
    expect(useApp.getState().railFolded).toEqual({ [NB]: true });
  });

  it('+ tab makes a draft named untitled in the notebook\'s children; + offers the other kinds and a file', () => {
    mouse(host.querySelector('.rail-add')!, 'click');
    expect(calls).toEqual([`tab ${KIDS}|draft|untitled`]);
    mouse(host.querySelector('.rail-more')!, 'click');
    const entries = Array.from(host.querySelectorAll<HTMLElement>('.rail-menu .ci')).map((e) => e.textContent?.slice(1));
    expect(entries).toEqual(['source', 'deck', 'draft', 'import a file…']);
    mouse(host.querySelectorAll<HTMLElement>('.rail-menu .ci')[1]!, 'click');
    expect(calls[1]).toBe(`tab ${KIDS}|deck|`);
  });

  it('a row takes the node menu with add subtab, and the overview\'s has show as tree', () => {
    mouse(rowOf(VECTORS), 'contextmenu', { clientX: 20, clientY: 40 });
    const entries = () => Array.from(host.querySelectorAll<HTMLElement>('.ctx-menu .ci')).map((e) => e.textContent?.replace(/^./, '').replace(/F2$|▸$/, ''));
    expect(entries()).toContain('add subtab');
    expect(entries()).toContain('show as tabs');
    mouse(Array.from(host.querySelectorAll<HTMLElement>('.ctx-menu .ci')).find((e) => e.textContent?.endsWith('add subtab'))!, 'click');
    expect(calls).toEqual([`tab ${KIDS}/vectors|draft|untitled`]);
    mouse(rowOf(NB), 'contextmenu', { clientX: 20, clientY: 40 });
    expect(entries()).toContain('show as tree');
  });

  it('a drag on a row\'s thirds reorders, on its middle nests; the overview takes only into', () => {
    const drag = (from: string, to: string, y: number) => {
      const target = rowOf(to);
      target.getBoundingClientRect = () => ({ top: 0, height: 30, bottom: 30, left: 0, right: 100, width: 100, x: 0, y: 0, toJSON() {} });
      const ev = (type: string) => { const e = new Event(type, { bubbles: true, cancelable: true }) as Event & { clientY: number; dataTransfer: unknown }; Object.assign(e, { clientY: y, dataTransfer: { setData() {}, effectAllowed: '' } }); return e; };
      act(() => { rowOf(from).dispatchEvent(ev('dragstart')); });
      act(() => { target.dispatchEvent(ev('dragover')); });
      act(() => { target.dispatchEvent(ev('drop')); });
    };
    drag(UNIT, VECTORS, 2);
    drag(VECTORS, PSET, 28);
    drag(PSET, UNIT, 15);
    drag(VECTORS, NB, 2);
    expect(calls).toEqual([`place ${UNIT} before ${VECTORS}`, `place ${VECTORS} after ${PSET}`, `place ${PSET} into ${UNIT}`, `place ${VECTORS} into ${NB}`]);
    expect(rowOf(NB).draggable).toBe(false);
  });
});

// ── a new tab over a real vault ─────────────────────────────────

const CORPUS = join(import.meta.dirname, '../../format/__tests__/corpus/vault');

describe('addTab', () => {
  let dir: string;
  let vault: Vault;
  beforeEach(async () => {
    dir = await fsp.mkdtemp(join(tmpdir(), 'ilmi-tabs-'));
    await fsp.cp(CORPUS, dir, { recursive: true });
    vault = await Vault.open(nodeFs, dir);
  });
  afterEach(async () => {
    vault.close();
    await fsp.rm(dir, { recursive: true, force: true });
  });

  it('makes a draft child named untitled, last in the order, the order written as shown', async () => {
    const shown = () => railRows(vault.tree, NB, vault.order, {}).slice(1).map((r) => r.path.slice(KIDS.length + 1));
    expect(shown()).toEqual(['unit-2', 'problem-set-1.md', 'vectors.md']);
    const path = await addTab(vault, KIDS, 'draft', 'untitled');
    expect(path).toBe(`${KIDS}/untitled.md`);
    expect(fieldsOf((await vault.read(path)).doc).type).toBe('draft');
    expect(shown()).toEqual(['unit-2', 'problem-set-1.md', 'vectors.md', 'untitled.md']);
    expect(JSON.parse(await fsp.readFile(join(dir, '.ilmi/order.json'), 'utf8'))).toEqual({ [KIDS]: ['unit-2/', 'problem-set-1.md', 'vectors.md', 'untitled.md'] });
    // a second lands after it, a reorder kept
    await vault.place(`${KIDS}/vectors.md`, `${KIDS}/unit-2`, 'before');
    const again = await addTab(vault, KIDS, 'draft', 'untitled');
    expect(again).not.toBe(path);
    expect(shown()).toEqual(['vectors.md', 'unit-2', 'problem-set-1.md', 'untitled.md', again.slice(KIDS.length + 1)]);
    // a subtab: inside a tab, its children directory made on demand
    const sub = await addTab(vault, `${KIDS}/vectors`, 'draft', 'untitled');
    expect(sub).toBe(`${KIDS}/vectors/untitled.md`);
    expect(railRows(vault.tree, NB, vault.order, { [`${KIDS}/vectors.md`]: true }).map((r) => r.path)).toContain(sub);
  });

  it('the corpus course is a notebook', async () => {
    expect(fieldsOf((await vault.read(NB)).doc).tabs).toBe(true);
  });
});
