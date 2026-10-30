// @vitest-environment jsdom
// Tabs, refined (milestone 39), and the three things 38's window check found.
// The pure side: extracts never tabs (one `n extracts` row under a tab), three
// levels at most, the keyboard's moves with the rail's limits, the outline of
// the active tab, where the `tabs` toggle shows, the rail's width, the fold
// key; the order an undone delete restores. The rail in the canvas: the
// outline under the active tab and a click scrolling to a heading, the rail
// from the keyboard, the hover `+` and `···`, the edge resize, the toggle.
// The drag's rest on timers (a still pointer sends no more dragovers), and a
// delete brought back by the vault, a duplicate placed after its original.

import { promises as fsp } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { act, createElement } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { meta as fieldsOf, parse } from '../../format/index.js';
import { nodeFs } from '../../vault/node-fs.js';
import { Vault, restoreOrder, type TreeNode } from '../../vault/index.js';
import { geometry } from '../dnd.js';
import { activeTab, emptyPanes, openTab } from '../panes.js';
import { useApp, type DocInfo } from '../store.js';
import { RAIL_DEFAULT, RAIL_MAX, RAIL_MIN, TAB_DEPTH, clampRail, notebookPages, outline, railKeyPlace, railRows, showsTabsToggle, tabLabel } from '../tabs.js';

const calls: string[] = [];

vi.mock('../vault.js', async (orig) => {
  const real = await orig<typeof import('../vault.js')>();
  return {
    ...real,
    createTab: vi.fn(async (dir: string, type: string, name?: string) => { calls.push(`tab ${dir}|${type}|${name ?? ''}`); return `${dir}/${name ?? 'x'}.md`; }),
    noteAfter: vi.fn(async (path: string) => { calls.push(`after ${path}`); return path; }),
    placeNode: vi.fn(async (path: string, target: string, mode: string) => { calls.push(`place ${path} ${mode} ${target}`); return path; }),
    renameNode: vi.fn(async (path: string, name: string) => { calls.push(`rename ${path}|${name}`); return path; }),
    setTabs: vi.fn(async (path: string, on: boolean) => { calls.push(`tabs ${path} ${on}`); }),
  };
});
vi.mock('../remove.js', () => ({ deleteNode: vi.fn(async (path: string) => { calls.push(`delete ${path}`); }) }));

// the page's headings, as the reader draws them (`.dd-h`, every level counted)
const BODY = '## the theorem\n\ntext\n\n#### a small one\n\n## warm-up **examples**\n\n### harmonic oscillator\n';
vi.mock('../useDoc.js', () => ({
  useDoc: (path: string | null) => (path?.endsWith('.md') ? { path, text: BODY, doc: parse(BODY).doc, diagnostics: [], stamp: null } : null),
}));
vi.mock('../Reader.js', async () => {
  const { createElement: h } = await import('react');
  const heads = ['the theorem', 'a small one', 'warm-up examples', 'harmonic oscillator'];
  return { Reader: ({ id }: { id: string }) => h('div', { className: 'mock-reader' }, id, ...heads.map((t) => h('h2', { key: t, className: 'dd-h' }, t))) };
});

const { Canvas } = await import('../Canvas.js');
const { TabsToggle } = await import('../TabsToggle.js');
const { isFoldKey } = await import('../Rail.js');
const { beginDrag, endDrag, rowDrag, useDrag } = await import('../drag.js');

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

// a course as a notebook: units, a chapter with extracts, problem sets three levels down
const NB = 'qm.md';
const K = 'qm';
const VAR = `${K}/variational.md`;
const WKB = `${K}/wkb.md`;
const PS = `${K}/problem-sets`;
const PS7 = `${PS}/ps-7.md`;
const PS7K = `${PS}/ps-7`;
const DEEP = `${PS7K}/part-a.md`;
const DEEPER = `${PS7K}/part-a/note.md`;
const EX1 = `${K}/wkb/ex-turning-points.md`;
const EX2 = `${K}/wkb/ex-connection.md`;
const OWN = `${K}/ex-own.md`;

const doc = (path: string, children?: TreeNode[]): TreeNode => ({ kind: 'doc', name: path.slice(path.lastIndexOf('/') + 1), path, ...(children ? { children } : {}) });
const TREE: TreeNode[] = [
  doc(NB, [
    doc(VAR),
    doc(WKB, [doc(EX1), doc(EX2)]),
    { kind: 'folder', name: 'problem-sets', path: PS, children: [doc(PS7, [doc(DEEP, [doc(DEEPER)])])] },
    doc(OWN),
  ]),
  doc('loose.md', [doc('loose/child.md')]),
];
const info = (type: DocInfo['type'], extra: Partial<DocInfo> = {}): DocInfo => ({ type, frozen: false, cards: 0, due: 0, ...extra });
const DOCS: Record<string, DocInfo> = {
  [NB]: info('note', { title: 'quantum II', tabs: true }),
  [VAR]: info('note'), [WKB]: info('source'), [PS7]: info('note'), [DEEP]: info('note'), [DEEPER]: info('note'),
  [EX1]: info('extract'), [EX2]: info('extract'), [OWN]: info('extract'),
  'loose.md': info('note'), 'loose/child.md': info('note'),
};
const ORDER = { [K]: ['variational.md', 'wkb.md', 'problem-sets/', 'ex-own.md'] };
const ALL_OPEN: Record<string, true> = { [WKB]: true, [PS]: true, [PS7]: true, [DEEP]: true };

describe('the rail\'s rows', () => {
  const shape = (open: Record<string, true>) => railRows(TREE, NB, ORDER, open, DOCS).map((r) => `${'  '.repeat(Math.max(0, r.depth - 1))}${r.overview ? 'overview' : r.extracts !== undefined ? `(${r.extracts} extracts)` : r.path.slice(r.path.lastIndexOf('/') + 1)}${r.has && !r.overview ? (r.open ? ' ▾' : ' ▸') : ''}`);

  it('never lists an extract as a tab: a tab\'s are one `n extracts` row under it, the notebook\'s own last', () => {
    expect(shape({})).toEqual(['overview', 'variational.md', 'wkb.md ▸', 'problem-sets ▸', '(1 extracts)']);
    expect(shape(ALL_OPEN)).toEqual([
      'overview', 'variational.md', 'wkb.md ▾', '  (2 extracts)', 'problem-sets ▾', '  ps-7.md ▾', '    part-a.md', '(1 extracts)',
    ]);
    const ex = railRows(TREE, NB, ORDER, ALL_OPEN, DOCS).find((r) => r.extracts === 2)!;
    // it opens the folder lens of the tab's children, and takes a drop into the tab
    expect(ex).toMatchObject({ path: `${K}/wkb`, parent: WKB, placeholder: true, nest: 'only' });
  });

  it('goes three levels deep at most: the deepest row has no chevron and never nests', () => {
    const rows = railRows(TREE, NB, ORDER, ALL_OPEN, DOCS);
    const deep = rows.find((r) => r.path === DEEP)!;
    expect(deep.depth).toBe(TAB_DEPTH);
    expect(deep).toMatchObject({ has: false, nest: 'never' });
    expect(rows.some((r) => r.path === DEEPER)).toBe(false);
    // the step order skips extracts and what is too deep to be a tab
    expect(notebookPages(TREE, NB, ORDER, DOCS)).toEqual([NB, VAR, WKB, PS, PS7, DEEP]);
  });

  it('moves from the keyboard as the tree does, within the rail\'s limits', () => {
    const rows = railRows(TREE, NB, ORDER, ALL_OPEN, DOCS);
    expect(railKeyPlace(rows, WKB, 'up')).toEqual({ target: VAR, mode: 'before' });
    expect(railKeyPlace(rows, WKB, 'down')).toEqual({ target: PS, mode: 'after' });
    expect(railKeyPlace(rows, WKB, 'in')).toEqual({ target: VAR, mode: 'into' });
    expect(railKeyPlace(rows, PS7, 'out')).toEqual({ target: PS, mode: 'after' });
    // never out of the notebook, never past the last tab into its extracts row, never into the deepest level
    expect(railKeyPlace(rows, VAR, 'out')).toBeNull();
    expect(railKeyPlace(rows, PS, 'down')).toBeNull();
    const flat = railRows([doc(NB, [doc(VAR), doc(WKB)])], NB, { [K]: ['variational.md', 'wkb.md'] }, {}, DOCS);
    expect(railKeyPlace(flat, WKB, 'in')).toEqual({ target: VAR, mode: 'into' });
    const atDeep = railRows([doc(NB, [doc(`${K}/a.md`, [doc(`${K}/a/b.md`, [doc(`${K}/a/b/c.md`), doc(`${K}/a/b/d.md`)])])])], NB, {}, { [`${K}/a.md`]: true, [`${K}/a/b.md`]: true }, {});
    expect(railKeyPlace(atDeep, `${K}/a/b/d.md`, 'in')).toBeNull();
  });

  it('draws a drop into a tab\'s extracts row as into the tab\'s children, and the overview only into', () => {
    const rows = railRows(TREE, NB, ORDER, ALL_OPEN, DOCS);
    const g = geometry(rows, 1);
    const wkb = g[rows.findIndex((r) => r.path === WKB)]!;
    expect(wkb.intoBelow).toBe(true);
    expect(g[0]!.nest).toBe('only');
  });
});

describe('the outline of the active tab', () => {
  it('lists headings of levels 1 to 3, each with its place among all the page\'s headings, markers off', () => {
    expect(outline(parse(BODY).doc.blocks)).toEqual([
      { index: 0, level: 2, text: 'the theorem' },
      { index: 2, level: 2, text: 'warm-up examples' },
      { index: 3, level: 3, text: 'harmonic oscillator' },
    ]);
    // `#TODO:` is a tag, not a heading
    expect(outline(parse('#TODO: read it\n\n## real\n').doc.blocks).map((h) => h.text)).toEqual(['real']);
  });
});

describe('the toggle, the width, the fold key, the label', () => {
  it('shows `tabs` on a document with children, not on a bare one or a page inside another notebook', () => {
    expect(showsTabsToggle(NB, TREE, DOCS)).toBe(true);
    expect(showsTabsToggle('loose.md', TREE, DOCS)).toBe(true);
    expect(showsTabsToggle(VAR, TREE, DOCS)).toBe(false);
    expect(showsTabsToggle(WKB, TREE, DOCS)).toBe(false);
    expect(showsTabsToggle(PS, TREE, DOCS)).toBe(false);
  });

  it('keeps the rail between its bounds, about 200 px by default', () => {
    expect(RAIL_DEFAULT).toBe(200);
    expect(clampRail(90)).toBe(RAIL_MIN);
    expect(clampRail(900)).toBe(RAIL_MAX);
    expect(clampRail(243.6)).toBe(244);
    expect(clampRail(Number.NaN)).toBe(RAIL_DEFAULT);
  });

  it('folds on ⌃⌘T by the key\'s place, not on ⌘⇧[', () => {
    const k = (init: Partial<KeyboardEvent>) => isFoldKey({ metaKey: false, ctrlKey: false, altKey: false, shiftKey: false, key: '', ...init } as KeyboardEvent);
    expect(k({ metaKey: true, ctrlKey: true, code: 'KeyT', key: 'ف' })).toBe(true);
    expect(k({ metaKey: true, shiftKey: true, code: 'BracketLeft', key: '{' })).toBe(false);
    expect(k({ metaKey: true, code: 'KeyT', key: 't' })).toBe(false);
  });

  it('labels a notebook\'s extracts lens `notebook › extracts`', () => {
    expect(tabLabel(K, DOCS, '/v')).toBe('quantum II › extracts');
    expect(tabLabel(WKB, DOCS, '/v')).toBe('quantum II › wkb');
  });
});

describe('an undone delete\'s order', () => {
  it('puts the entry back where it stood, and its own directories\' orders', () => {
    const was = { a: ['x.md', 'y.md', 'z.md'], 'a/y': ['k.md', 'j.md'] };
    expect(restoreOrder({ a: ['x.md', 'z.md'] }, was, 'a/y.md')).toEqual({ a: ['x.md', 'y.md', 'z.md'], 'a/y': ['k.md', 'j.md'] });
    // its neighbour above gone too: before the one below
    expect(restoreOrder({ a: ['z.md'] }, was, 'a/y.md')).toEqual({ a: ['y.md', 'z.md'], 'a/y': ['k.md', 'j.md'] });
    // a moved order keeps the moves, the entry after its old neighbour
    expect(restoreOrder({ a: ['z.md', 'x.md', 'w.md'] }, was, 'a/y.md').a).toEqual(['z.md', 'x.md', 'y.md', 'w.md']);
    // never listed: nothing to put back
    expect(restoreOrder({}, {}, 'b.md')).toEqual({});
  });
});

// ── the drag's rest, on timers ──────────────────────────────────

describe('the rest before into, kept by timers', () => {
  const surf = { pad: 6, indent: 10 };
  const geom = { path: 'b.md', depth: 1, nest: 'dwell' as const, tail: ['b.md'] };
  const el = { getBoundingClientRect: () => ({ top: 0, height: 24, left: 0 }), closest: () => null };
  const ev = (y: number) => ({ currentTarget: el, clientX: 100, clientY: y, dataTransfer: { dropEffect: '' }, preventDefault() {}, stopPropagation() {} }) as never;
  beforeEach(() => { calls.length = 0; vi.useFakeTimers(); });
  afterEach(() => { endDrag(); vi.useRealTimers(); });

  it('a still pointer on a bare document\'s middle nests after 400 ms with no more dragovers', async () => {
    const h = rowDrag(geom, surf, { draggable: true });
    beginDrag('a.md');
    act(() => { h.onDragOver(ev(12)); });
    expect(useDrag.getState().drop).toMatchObject({ mode: 'after', target: 'b.md' });
    act(() => { vi.advanceTimersByTime(420); });
    expect(useDrag.getState().drop).toMatchObject({ mode: 'into', target: 'b.md', draw: 'box' });
    act(() => { h.onDrop(ev(12)); });
    await vi.waitFor(() => expect(calls).toEqual(['place a.md into b.md']));
  });

  it('a drop after the rest nests even when the timer was held back', async () => {
    const h = rowDrag(geom, surf, { draggable: true });
    beginDrag('a.md');
    act(() => { h.onDragOver(ev(12)); });
    // the clock moves on, the timer does not fire (a covered window)
    vi.setSystemTime(Date.now() + 600);
    act(() => { h.onDrop(ev(12)); });
    await vi.waitFor(() => expect(calls).toEqual(['place a.md into b.md']));
  });

  it('moving off the middle before the rest is up keeps a reorder', async () => {
    const h = rowDrag(geom, surf, { draggable: true });
    beginDrag('a.md');
    act(() => { h.onDragOver(ev(12)); });
    act(() => { vi.advanceTimersByTime(200); });
    act(() => { h.onDragOver(ev(22)); });
    act(() => { vi.advanceTimersByTime(400); });
    expect(useDrag.getState().drop).toMatchObject({ mode: 'after' });
    act(() => { h.onDrop(ev(22)); });
    await vi.waitFor(() => expect(calls).toEqual(['place a.md after b.md']));
  });

  it('a folded row opens after 500 ms of rest with no more dragovers', () => {
    const spring = vi.fn();
    const h = rowDrag({ ...geom, nest: 'now' }, { ...surf, spring }, { draggable: true, folded: true });
    beginDrag('a.md');
    act(() => { h.onDragOver(ev(12)); });
    act(() => { vi.advanceTimersByTime(520); });
    expect(spring).toHaveBeenCalledWith('b.md');
  });
});

// ── the rail in the canvas ──────────────────────────────────────

let root: Root;
let host: HTMLDivElement;
const rowOf = (path: string) => host.querySelector<HTMLElement>(`.rail-row[data-path="${path}"]:not(.heading)`)!;
const page = () => activeTab(useApp.getState().panes)!.id;
const mouse = (el: Element, type: string, init: MouseEventInit = {}) => {
  act(() => { el.dispatchEvent(new MouseEvent(type, { bubbles: true, cancelable: true, ...init })); });
};
const keyOn = (el: Element, init: KeyboardEventInit) => {
  const e = new KeyboardEvent('keydown', { bubbles: true, cancelable: true, ...init });
  act(() => { el.dispatchEvent(e); });
  return e;
};
const box = () => host.querySelector<HTMLElement>('.rail-rows')!;
const names = () => Array.from(host.querySelectorAll<HTMLElement>('.rail-row')).map((r) => `${r.classList.contains('heading') ? '# ' : ''}${r.dataset.active === '1' ? '*' : ''}${r.dataset.selected === '1' ? '>' : ''}${r.querySelector('.name')?.textContent ?? ''}`);

describe('the rail in the canvas', () => {
  beforeEach(() => {
    calls.length = 0;
    useApp.setState({ vault: '/v', tree: TREE, docs: DOCS, order: ORDER, open: { '': true }, railFolded: {}, railWidth: 200, panes: openTab(emptyPanes(), VAR), reveal: null, paletteOpen: false, tweaksOpen: false });
    host = document.createElement('div');
    document.body.appendChild(host);
    root = createRoot(host);
    act(() => { root.render(createElement(Canvas)); });
  });
  afterEach(() => {
    act(() => { root.unmount(); });
    host.remove();
  });

  it('lists the active tab\'s headings under it; a click scrolls the page to one; a click on the tab hides them', () => {
    expect(names()).toEqual(['quantum II', '*variational', '# the theorem', '# warm-up examples', '# harmonic oscillator', 'wkb', 'problem sets', '1 extract']);
    const seen: string[] = [];
    const was = HTMLElement.prototype.scrollIntoView;
    HTMLElement.prototype.scrollIntoView = function (this: HTMLElement) { seen.push(this.textContent ?? ''); };
    try {
      mouse(host.querySelector('.rail-row.heading[data-heading="2"]')!, 'click');
    } finally { HTMLElement.prototype.scrollIntoView = was; }
    expect(seen).toContain('warm-up examples');
    mouse(rowOf(VAR), 'click');
    expect(names()).toEqual(['quantum II', '*variational', 'wkb', 'problem sets', '1 extract']);
    expect(page()).toBe(VAR);
  });

  it('the outline follows the open page: the overview\'s under it, then the tab\'s under the tab', () => {
    act(() => { useApp.setState({ panes: openTab(emptyPanes(), NB) }); });
    const owners = () => Array.from(new Set(Array.from(host.querySelectorAll<HTMLElement>('.rail-row.heading')).map((h) => h.dataset.of)));
    expect(owners()).toEqual([NB]);
    mouse(rowOf(VAR), 'click');
    expect(page()).toBe(VAR);
    expect(owners()).toEqual([VAR]);
  });

  it('a tab\'s extracts row opens their folder in the notebook, the rail kept', () => {
    mouse(rowOf(WKB).querySelector('.chev')!, 'click');
    expect(names()).toContain('2 extracts');
    mouse(rowOf(`${K}/wkb`), 'click');
    expect(page()).toBe(`${K}/wkb`);
    expect(host.querySelector('.tab-rail')).not.toBeNull();
    expect(rowOf(`${K}/wkb`).dataset.active).toBe('1');
  });

  it('is used from the keyboard: ↓ ⏎ F2, ⌥⌘↓ and ⌥⌘→ move and nest, and they stay in the rail', () => {
    mouse(rowOf(VAR), 'mousedown');
    keyOn(box(), { key: 'ArrowDown' });
    expect(names()).toContain('>wkb');
    keyOn(box(), { key: 'Enter' });
    expect(page()).toBe(WKB);
    keyOn(box(), { key: 'F2' });
    const field = host.querySelector<HTMLInputElement>('.tab-rail input.rename')!;
    expect(field.value).toBe('wkb');
    keyOn(field, { key: 'Escape' });
    expect(host.querySelector('.tab-rail input.rename')).toBeNull();
    // ⌥⌘↓ moves the row after the next one; the page is not stepped
    const moved = keyOn(box(), { key: 'ArrowDown', metaKey: true, altKey: true });
    expect(moved.defaultPrevented).toBe(true);
    expect(page()).toBe(WKB);
    keyOn(box(), { key: 'ArrowRight', metaKey: true, altKey: true });
    expect(calls).toEqual([`place ${WKB} after ${PS}`, `place ${WKB} into ${VAR}`]);
    // ⌘⌫ on a tab with something under it asks first, in the row
    keyOn(box(), { key: 'Backspace', metaKey: true });
    expect(host.querySelector('.tab-rail .asking')?.textContent).toBe('delete with 2 inside? ⌘⌫');
    keyOn(box(), { key: 'Backspace', metaKey: true });
    expect(calls[2]).toBe(`delete ${WKB}`);
  });

  it('hover `+` makes a note after the row; `···` is the tab\'s menu', () => {
    mouse(rowOf(WKB).querySelector('.row-acts .add')!, 'click');
    expect(calls).toEqual([`after ${WKB}`]);
    mouse(rowOf(WKB).querySelector('.row-acts .more')!, 'click');
    const entries = Array.from(host.querySelectorAll<HTMLElement>('.ctx-menu .ci')).map((e) => e.textContent?.replace(/^./, '').replace(/F2$|▸$/, ''));
    expect(entries).toEqual(['add subtab', 'rename', 'duplicate', 'move to…', 'delete']);
    // a tab with cards in it can be studied from its menu (milestone 37)
    act(() => { useApp.setState((st) => ({ docs: { ...st.docs, [VAR]: info('note', { cards: 3, due: 1 }) } })); });
    mouse(rowOf(VAR).querySelector('.row-acts .more')!, 'click');
    const withCards = Array.from(host.querySelectorAll<HTMLElement>('.ctx-menu .ci')).map((e) => e.textContent?.replace(/^./, '').replace(/F2$|▸$/, ''));
    expect(withCards).toEqual(['add subtab', 'study', 'rename', 'duplicate', 'move to…', 'delete']);
  });

  it('`+ add tab` is at the top and makes a note; the rail\'s edge drags its width, kept in the store', () => {
    expect(host.querySelector('.rail-head .rail-add')?.textContent).toBe('+ add tab');
    mouse(host.querySelector('.rail-head .rail-add')!, 'click');
    expect(calls).toEqual([`tab ${K}|note|untitled`]);
    const edge = host.querySelector<HTMLElement>('.rail-resize')!;
    act(() => { edge.dispatchEvent(new MouseEvent('pointerdown', { bubbles: true, clientX: 200 })); });
    act(() => { window.dispatchEvent(new MouseEvent('pointermove', { clientX: 262 })); });
    act(() => { window.dispatchEvent(new MouseEvent('pointerup', {})); });
    expect(useApp.getState().railWidth).toBe(262);
    expect(host.querySelector<HTMLElement>('.tab-rail')!.style.width).toBe('262px');
  });
});

describe('the `tabs` toggle', () => {
  afterEach(() => { act(() => { root.unmount(); }); host.remove(); });
  const show = (path: string, docs = DOCS) => {
    calls.length = 0;
    useApp.setState({ tree: TREE, docs });
    host = document.createElement('div');
    document.body.appendChild(host);
    root = createRoot(host);
    act(() => { root.render(createElement(TabsToggle, { path })); });
    return host.querySelector<HTMLButtonElement>('.tabs-toggle');
  };

  it('turns a document\'s children into tabs and back', () => {
    const b = show('loose.md')!;
    expect(b.textContent).toBe('tabs');
    expect(b.dataset.on).toBe('0');
    mouse(b, 'click');
    expect(calls).toEqual(['tabs loose.md true']);
  });

  it('is lit on a notebook, and not drawn on a bare document', () => {
    expect(show(NB)!.dataset.on).toBe('1');
    act(() => { root.unmount(); });
    host.remove();
    expect(show(VAR)).toBeNull();
  });
});

// ── over a real vault: a delete brought back, a duplicate ───────

const CORPUS = join(import.meta.dirname, '../../format/__tests__/corpus/vault');
const LA = 'courses/linear-algebra';

describe('the vault brings a delete back, and duplicates', () => {
  let dir: string;
  let vault: Vault;
  beforeEach(async () => {
    dir = await fsp.mkdtemp(join(tmpdir(), 'ilmi-tabs2-'));
    await fsp.cp(CORPUS, dir, { recursive: true });
    vault = await Vault.open(nodeFs, dir);
    await vault.setOrder(LA, ['vectors.md', 'unit-2/', 'problem-set-1.md']);
  });
  afterEach(async () => {
    vault.close();
    await fsp.rm(dir, { recursive: true, force: true });
  });

  it('restores a document with nothing under it, in its place in the order', async () => {
    const path = `${LA}/unit-2/eigenvalues.md`;
    const text = await fsp.readFile(join(dir, path), 'utf8');
    const gone = await vault.remove(path);
    expect(vault.documents()).not.toContain(path);
    await vault.restore(gone);
    expect(await fsp.readFile(join(dir, path), 'utf8')).toBe(text);
    expect(vault.documents()).toContain(path);
  });

  it('restores a tab with its children, its pages, and its order entry', async () => {
    await vault.createDoc(`${LA}/vectors`, 'note', 'basis');
    await fsp.writeFile(join(dir, `${LA}/vectors.pdf`), new Uint8Array([37, 80, 68, 70]));
    const gone = await vault.remove(`${LA}/vectors.md`);
    expect(vault.order[LA]).toEqual(['unit-2/', 'problem-set-1.md']);
    await vault.restore(gone);
    expect(vault.documents()).toEqual(expect.arrayContaining([`${LA}/vectors.md`, `${LA}/vectors/basis.md`]));
    expect([...(await fsp.readFile(join(dir, `${LA}/vectors.pdf`)))]).toEqual([37, 80, 68, 70]);
    expect(vault.order[LA]).toEqual(['vectors.md', 'unit-2/', 'problem-set-1.md']);
    await expect(vault.restore(gone)).rejects.toThrow('already exists');
  });

  it('duplicates a document with its children, right after it, its title marked', async () => {
    await vault.createDoc(`${LA}/vectors`, 'note', 'basis');
    const copy = await vault.duplicate(`${LA}/vectors.md`);
    expect(copy).toBe(`${LA}/vectors copy.md`);
    expect(vault.documents()).toContain(`${LA}/vectors copy/basis.md`);
    expect(vault.order[LA]).toEqual(['vectors.md', 'vectors copy.md', 'unit-2/', 'problem-set-1.md']);
    const t = fieldsOf((await vault.read(`${LA}/vectors.md`)).doc).title;
    expect(fieldsOf((await vault.read(copy)).doc).title).toBe(t === undefined ? undefined : `${t} copy`);
    expect(await vault.duplicate(`${LA}/vectors.md`)).toBe(`${LA}/vectors copy 2.md`);
  });
});
