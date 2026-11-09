// @vitest-environment jsdom
// The sidebar tree's gestures (`Tree.tsx`) as a statechart of four regions —
// the selection, an inline rename, a delete being asked, the open menu — and
// the real component checked against it over every sequence of events to a
// depth, and on long random walks.
//
// The world: the root, a folder `p` with `p/x.md` in it (so its delete asks
// first) that the vault can take away and give back meanwhile (a sync, another
// surface's move), a document `d.md` whose two cards are listed under it, and
// a document `n.md`. After every step the real tree must be the model's: which
// row is selected, where the rename field is and what it holds, which row
// asks, whether a menu is open, and what was asked of the vault (renames,
// deletes, keyboard moves). What is drawn is `treeRows` over the model's
// nodes (pure, tested on its own), and a keyboard move's landing `keyPlace`.

import { act, createElement } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, describe, expect, it, vi } from 'vitest';
import type { TreeNode } from '../../vault/index.js';
import { useApp } from '../store.js';
import { keyPlace, rowWithin, treeRows, type TreeRow } from '../treeModel.js';

const calls: string[] = [];
let gone = new Set<string>();
const nodes = (g: Set<string>): TreeNode[] => [
  ...(g.has('p') ? [] : [{ kind: 'folder' as const, name: 'p', path: 'p', children: g.has('p/x.md') ? [] : [{ kind: 'doc' as const, name: 'x.md', path: 'p/x.md' }] }]),
  ...(g.has('d.md') ? [] : [{ kind: 'doc' as const, name: 'd.md', path: 'd.md' }]),
  ...(g.has('n.md') ? [] : [{ kind: 'doc' as const, name: 'n.md', path: 'n.md' }]),
];

vi.mock('../vault.js', async (orig) => {
  const real = await orig<typeof import('../vault.js')>();
  return {
    ...real,
    renameNode: vi.fn(async (path: string, name: string) => { calls.push(`rename ${path} ${name}`); return path; }),
    placeNode: vi.fn(async (path: string, target: string, mode: string) => { calls.push(`place ${path} ${mode} ${target}`); return path; }),
    moveNode: vi.fn(async (path: string) => path),
    toggleOpen: vi.fn(),
    docsOf: (paths: readonly string[]) => paths.map((p) => [p, null]),
  };
});
vi.mock('../remove.js', () => ({
  deleteNode: vi.fn(async (path: string) => {
    calls.push(`delete ${path}`);
    gone.add(path);
    useApp.setState({ tree: nodes(gone) });
  }),
}));
const CARDS = [{ block: 0, text: 'q one' }, { block: 1, text: 'q two' }];
vi.mock('../cardSet.js', async (orig) => {
  const real = await orig<typeof import('../cardSet.js')>();
  return { ...real, cardSet: () => CARDS };
});

const { Tree } = await import('../Tree.js');
(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

const OPEN: Record<string, true> = { '': true, p: true, 'd.md': true };
const DOCS = { 'd.md': { type: 'note' as const, frozen: false, cards: 2, due: 0 }, 'n.md': { type: 'note' as const, frozen: false, cards: 0, due: 0 }, 'p/x.md': { type: 'note' as const, frozen: false, cards: 0, due: 0 } };

// ── the model ───────────────────────────────────────────────────

type Row = 'p' | 'p/x.md' | 'd.md' | 'n.md' | ':cards/d.md#0';
const PRESS: Row[] = ['p', 'p/x.md', 'd.md', 'n.md', ':cards/d.md#0'];
type Ev =
  | `press ${Row}` | 'dblclick p' | 'dblclick d.md' | 'type' | 'enter' | 'esc' | 'blur'
  | 'down' | 'delete' | 'f2' | 'move down' | 'menu n.md' | 'menu p' | 'press outside' | 'vault takes p' | 'vault gives p';
const EVENTS: Ev[] = [...PRESS.map((r) => `press ${r}` as Ev), 'dblclick p', 'dblclick d.md', 'type', 'enter', 'esc', 'blur', 'down', 'delete', 'f2', 'move down', 'menu n.md', 'menu p', 'press outside', 'vault takes p', 'vault gives p'];

interface M {
  sel: string | null;
  /** The rename under way: the node, and whether its name was typed over. */
  edit: { id: string; typed: boolean } | null;
  ask: string | null;
  menu: string | null;
  /** Deleted, and taken away by the vault (given back by it). */
  deleted: string[];
  away: boolean;
}
interface Out { calls: string[] }

const init = (): M => ({ sel: null, edit: null, ask: null, menu: null, deleted: [], away: false });
const goneOf = (m: M) => new Set([...m.deleted, ...(m.away ? ['p'] : [])]);
const rowsOf = (m: M): TreeRow[] => {
  const g = goneOf(m);
  return treeRows(nodes(g), OPEN, {}, undefined, (doc) => (doc === 'd.md' ? CARDS : []));
};
const real = (m: M) => rowsOf(m).filter((r) => !r.placeholder);
const drawn = (m: M, id: string) => real(m).some((r) => r.path === id);
const isNode = (m: M, id: string) => real(m).some((r) => r.path === id && !r.card && !r.cards);
const has = (m: M, id: string) => !goneOf(m).has(id) && !(id === 'p/x.md' && goneOf(m).has('p'));
const under = (m: M, id: string) => (id === 'p' && has(m, 'p/x.md') ? 1 : 0);
/** The rename field is drawn: a rename under way on a drawn row (the keys are its). */
const field = (m: M) => m.edit !== null && isNode(m, m.edit.id);
/** The row the keys act on: the selection while it is drawn (no tab is open here). */
const focus = (m: M) => (m.sel !== null && drawn(m, m.sel) ? m.sel : null);

/** A key the tree takes (the field does not have the focus): any but ⌘⌫ ends an ask. */
const treeKeyEnds = (m: M) => { m.ask = null; };

/** One transition of one region (or of all, `*`): on an event, when its guard holds. */
interface Tr { region: 'selection' | 'rename' | 'asking' | 'menu' | 'vault' | 'keys'; ev: (e: Ev) => boolean; name: string; guard?: [string, (m: M) => boolean]; act: (m: M, e: Ev, out: Out) => void }
const is = (...es: Ev[]) => (e: Ev) => es.includes(e);

export const CHART: Tr[] = [
  // a press on a row selects it and ends an ask; it reaches the window, which closes a menu
  { region: 'selection', name: 'press row', ev: (e) => e.startsWith('press ') && e !== 'press outside', guard: ['row drawn', () => true], act: (m, e) => { m.sel = e.slice(6); m.ask = null; m.menu = null; } },
  { region: 'menu', name: 'press outside', ev: is('press outside'), act: (m) => { m.menu = null; } },
  { region: 'menu', name: 'right-click row', ev: is('menu n.md', 'menu p'), act: (m, e) => { m.menu = e.slice(5); } },

  { region: 'rename', name: 'dblclick row', ev: is('dblclick p', 'dblclick d.md'), act: (m, e) => { m.edit = { id: e.slice(9), typed: false }; } },
  { region: 'rename', name: 'type', ev: is('type'), guard: ['field drawn', field], act: (m) => { m.edit!.typed = true; } },
  { region: 'rename', name: 'enter | blur (commit)', ev: is('enter', 'blur'), guard: ['field drawn', field], act: (m, _e, out) => {
    // once: the blur that Enter's moving the focus makes is not a second commit
    if (m.edit!.typed && has(m, m.edit!.id)) out.calls.push(`rename ${m.edit!.id} fresh`);
    m.edit = null;
  } },
  // Escape reaches the window wherever it is pressed, and closes a menu there
  { region: 'rename', name: 'esc (cancel)', ev: is('esc'), guard: ['field drawn', field], act: (m) => { m.edit = null; m.menu = null; } },
  { region: 'rename', name: 'keys go to the field', ev: is('down', 'delete', 'f2', 'move down'), guard: ['field drawn', field], act: () => {} },
  { region: 'rename', name: 'blur, type with no field', ev: is('type', 'blur'), guard: ['no field', (m) => !field(m)], act: () => {} },

  // the tree's keys, while the field is not drawn (a rename whose row went away holds none)
  { region: 'keys', name: 'enter | esc on the tree', ev: is('enter', 'esc'), guard: ['no field', (m) => !field(m)], act: (m, e) => { treeKeyEnds(m); if (e === 'esc') m.menu = null; } },
  { region: 'keys', name: '↓', ev: is('down'), guard: ['no field', (m) => !field(m)], act: (m) => {
    const rs = real(m);
    const i = rs.findIndex((r) => r.path === focus(m));
    m.sel = rs[Math.min(rs.length - 1, i + 1)]!.path;
    treeKeyEnds(m);
  } },
  { region: 'asking', name: '⌘⌫', ev: is('delete'), guard: ['no field', (m) => !field(m)], act: (m, _e, out) => {
    const id = focus(m);
    if (id === null || id === '' || !isNode(m, id)) { m.ask = null; return; }
    if (under(m, id) > 0 && m.ask !== id) { m.ask = id; return; }
    m.ask = null;
    const rs = real(m);
    const i = rs.findIndex((r) => r.path === id);
    // the next row not of it (nor its cards), else the one above
    m.sel = (rs.slice(i + 1).find((r) => !rowWithin(r, id)) ?? rs[i - 1])?.path ?? null;
    out.calls.push(`delete ${id}`);
    m.deleted.push(id);
    if (m.menu !== null && !has(m, m.menu)) m.menu = null;
    if (m.edit !== null && !has(m, m.edit.id)) m.edit = null;
  } },
  { region: 'rename', name: 'F2', ev: is('f2'), guard: ['no field', (m) => !field(m)], act: (m) => {
    const id = focus(m);
    if (id !== null && id !== '' && isNode(m, id)) m.edit = { id, typed: false };
    treeKeyEnds(m);
  } },
  { region: 'keys', name: '⌥⌘↓', ev: is('move down'), guard: ['no field', (m) => !field(m)], act: (m, _e, out) => {
    const id = focus(m);
    if (id !== null && id !== '' && isNode(m, id)) {
      const to = keyPlace(rowsOf(m), id, 'down');
      if (to) out.calls.push(`place ${id} ${to.mode} ${to.target}`);
    }
    treeKeyEnds(m);
  } },

  // the vault changes the tree under every region: what was of the node gone is closed, not hidden
  { region: 'vault', name: 'takes p (and p/x.md)', ev: is('vault takes p'), act: (m) => {
    m.away = true;
    if (m.menu !== null && !has(m, m.menu)) m.menu = null;
    if (m.ask !== null && !has(m, m.ask)) m.ask = null;
    // a rename of it ends, renaming nothing
    if (m.edit !== null && !has(m, m.edit.id)) m.edit = null;
  } },
  { region: 'vault', name: 'gives p back', ev: is('vault gives p'), act: (m) => { m.away = false; } },
];

const enabled = (m: M, e: Ev): boolean => {
  if (e.startsWith('press ') && e !== 'press outside') return drawn(m, e.slice(6));
  if (e === 'menu n.md') return drawn(m, 'n.md');
  if (e === 'dblclick d.md') return drawn(m, 'd.md');
  if (e === 'menu p' || e === 'dblclick p') return drawn(m, 'p');
  if (e === 'vault takes p') return !m.away && !m.deleted.includes('p');
  if (e === 'vault gives p') return m.away;
  return true;
};

function step(m0: M, e: Ev): { m: M; out: Out } {
  const m = structuredClone(m0);
  const out: Out = { calls: [] };
  const hits = CHART.filter((t) => t.ev(e) && (!t.guard || t.guard[1](m)));
  if (hits.length !== 1) throw new Error(`the chart has ${hits.length} transitions for --${e}--> in ${JSON.stringify(m)}`);
  hits[0]!.act(m, e, out);
  return { m, out };
}

// ── the real tree, driven ───────────────────────────────────────

let root: Root | null = null;
let side: HTMLDivElement;

function mount(): void {
  gone = new Set();
  calls.length = 0;
  useApp.setState({ vault: '/v', tree: nodes(gone), docs: DOCS, open: OPEN, order: {}, cardAt: {} });
  side = document.createElement('div');
  side.className = 'side';
  document.body.appendChild(side);
  root = createRoot(side);
  act(() => { root!.render(createElement(Tree, { activeId: undefined, onOpen: () => {} })); });
}
function unmount(): void {
  if (root) act(() => { root!.unmount(); });
  root = null;
  side?.remove();
}

const box = () => side.querySelector<HTMLElement>('.tree')!;
const rowEl = (p: string) => side.querySelector<HTMLElement>(`.trow[data-path="${CSS.escape(p)}"]:not(.placeholder)`)!;
const input = () => side.querySelector<HTMLInputElement>('input.rename');
/** Where a key goes: the field when it is drawn and focused, else the tree. */
const keyAt = () => (input() && document.activeElement === input() ? input()! : box());
const keyOf: Partial<Record<Ev, KeyboardEventInit>> = {
  enter: { key: 'Enter' }, esc: { key: 'Escape' }, down: { key: 'ArrowDown' }, delete: { key: 'Backspace', metaKey: true },
  f2: { key: 'F2' }, 'move down': { key: 'ArrowDown', metaKey: true, altKey: true },
};

// the vault's answers (a rename's, a move's new path) change nothing here, so a step is one synchronous act
function drive(e: Ev): void {
  act(() => {
    if (e === 'press outside') document.body.dispatchEvent(new MouseEvent('mousedown', { bubbles: true }));
    else if (e.startsWith('press ')) rowEl(e.slice(6)).dispatchEvent(new MouseEvent('mousedown', { bubbles: true }));
    else if (e.startsWith('dblclick ')) rowEl(e.slice(9)).dispatchEvent(new MouseEvent('dblclick', { bubbles: true }));
    else if (e.startsWith('menu ')) rowEl(e.slice(5)).dispatchEvent(new MouseEvent('contextmenu', { bubbles: true, cancelable: true, clientX: 10, clientY: 10 }));
    else if (e === 'type') {
      const f = input();
      if (f) {
        Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value')!.set!.call(f, 'fresh');
        f.dispatchEvent(new Event('input', { bubbles: true }));
      }
    } else if (e === 'blur') {
      if (input()) box().focus();
    } else if (e === 'vault takes p') { gone.add('p'); useApp.setState({ tree: nodes(gone) }); }
    else if (e === 'vault gives p') { gone.delete('p'); useApp.setState({ tree: nodes(gone) }); }
    else keyAt().dispatchEvent(new KeyboardEvent('keydown', { bubbles: true, cancelable: true, ...keyOf[e]! }));
  });
}

function differs(m: M, want: Out, got: string[]): string | null {
  const bad: string[] = [];
  const eq = (what: string, a: unknown, b: unknown) => { if (JSON.stringify(a) !== JSON.stringify(b)) bad.push(`${what}: real ${JSON.stringify(a)}, model ${JSON.stringify(b)}`); };
  eq('asked of the vault', got, want.calls);
  eq('selected', [...side.querySelectorAll<HTMLElement>('.trow[data-selected="1"]')].map((r) => r.dataset.path), m.sel !== null && drawn(m, m.sel) ? [m.sel] : []);
  const f = input();
  eq('rename field', f ? { on: f.closest<HTMLElement>('.trow')!.dataset.path, typed: f.value === 'fresh' } : null, field(m) ? { on: m.edit!.id, typed: m.edit!.typed } : null);
  eq('asking', [...side.querySelectorAll('.trow .asking')].map((a) => a.closest<HTMLElement>('.trow')!.dataset.path), m.ask !== null && drawn(m, m.ask) && under(m, m.ask) > 0 ? [m.ask] : []);
  eq('menu', side.querySelectorAll('.ctx-menu').length, m.menu !== null && has(m, m.menu) ? 1 : 0);
  return bad.length ? bad.join('; ') : null;
}

function replay(path: Ev[]): string | null {
  unmount();
  mount();
  let m = init();
  for (let i = 0; i < path.length; i++) {
    const e = path[i]!;
    const c0 = calls.length;
    drive(e);
    const next = step(m, e);
    m = next.m;
    const bad = differs(m, next.out, calls.slice(c0));
    if (bad) return `${path.slice(0, i + 1).join(', ')}\n  → ${bad}`;
  }
  return null;
}

afterEach(() => { unmount(); });

describe('the tree\'s gestures, as a statechart', () => {
  it('every sequence of events to depth 4 (each state once, every event from it): the real tree does what the chart says', async () => {
    // breadth first, each model state entered once by its shortest path and every
    // event tried from it; four deep reaches every pairing of the regions (a rename
    // and a menu on a row the vault then takes, an ask then a key) from a clean start:
    // some 330 states, 2 900 transitions
    const key = (m: M) => JSON.stringify(m);
    const seen = new Set<string>([key(init())]);
    let frontier: { m: M; path: Ev[] }[] = [{ m: init(), path: [] }];
    const fails: string[] = [];
    let tried = 0;
    for (let depth = 0; depth < 4 && fails.length < 5; depth++) {
      const next: typeof frontier = [];
      for (const { m, path } of frontier) {
        for (const e of EVENTS) {
          if (!enabled(m, e)) continue;
          const to = step(m, e).m;
          const p = [...path, e];
          tried++;
          const bad = replay(p);
          if (bad) { fails.push(bad); if (fails.length >= 5) break; continue; }
          const k = key(to);
          if (!seen.has(k)) { seen.add(k); next.push({ m: to, path: p }); }
        }
        if (fails.length >= 5) break;
      }
      frontier = next;
    }
    expect(fails, `${fails.length} of ${tried} transitions part from the chart (${seen.size} states)`).toEqual([]);
  }, 240_000);

  it('long walks: the regions do not leak into each other over many gestures', async () => {
    let seed = 7;
    const rnd = () => { seed = (seed * 1103515245 + 12345) % 2147483648; return seed / 2147483648; };
    const fails: string[] = [];
    for (let walk = 0; walk < 60 && fails.length < 3; walk++) {
      let m = init();
      const path: Ev[] = [];
      for (let i = 0; i < 30; i++) {
        const can = EVENTS.filter((e) => enabled(m, e));
        const e = can[Math.floor(rnd() * can.length)]!;
        path.push(e);
        m = step(m, e).m;
      }
      const bad = replay(path);
      if (bad) fails.push(bad);
    }
    expect(fails).toEqual([]);
  }, 240_000);
});

// found by the chart, each on its own
describe('the tree\'s gestures', () => {
  const run = (...es: Ev[]) => { mount(); for (const e of es) drive(e); };
  const selected = () => [...side.querySelectorAll<HTMLElement>('.trow[data-selected="1"]')].map((r) => r.dataset.path);

  it('a rename\'s Enter renames once (the blur its focus move makes is not a second rename)', () => {
    run('dblclick d.md', 'type', 'enter');
    expect(calls).toEqual(['rename d.md fresh']);
    expect(input()).toBeNull();
  });

  it('a rename\'s Escape renames nothing (the blur after it was committing what Escape dropped)', () => {
    run('dblclick d.md', 'type', 'esc');
    expect(calls).toEqual([]);
    expect(input()).toBeNull();
  });

  it('deleting a document with its cards listed selects the next row, not one of its cards\' rows', () => {
    run('press d.md', 'delete');
    expect(calls).toEqual(['delete d.md']);
    expect(selected()).toEqual(['n.md']);
  });

  it('a rename whose node the vault takes meanwhile ends, renaming nothing, and the keys are the tree\'s again', () => {
    run('dblclick p', 'type', 'vault takes p', 'press n.md', 'f2');
    expect(calls).toEqual([]);
    expect(input()?.closest<HTMLElement>('.trow')?.dataset.path).toBe('n.md');
  });

  it('a menu whose node the vault takes is closed, and does not come back with the node', () => {
    run('menu p', 'vault takes p');
    expect(side.querySelector('.ctx-menu')).toBeNull();
    drive('vault gives p');
    expect(side.querySelector('.ctx-menu')).toBeNull();
  });

  it('a delete asked about a node the vault takes is asked no more: a node back at its path asks again before it goes', () => {
    run('press p', 'delete');
    expect(side.querySelector('.trow[data-path="p"] .asking')).not.toBeNull();
    drive('vault takes p');
    drive('vault gives p');
    expect(side.querySelector('.asking')).toBeNull();
    // still selected: ⌘⌫ asks, it does not delete p and what is in it at once
    drive('delete');
    expect(calls).toEqual([]);
    expect(side.querySelector('.trow[data-path="p"] .asking')).not.toBeNull();
  });
});
