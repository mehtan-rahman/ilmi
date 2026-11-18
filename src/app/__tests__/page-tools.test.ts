// @vitest-environment jsdom
// What stands over pages that are written on, besides the row of tools
// (milestone 85; `PageTools.tsx`, and the lasso's side of `ink.ts`), drawn in
// jsdom with the canvases stood in for: what the canvases say of the lasso
// (`window.__ink`) is what `useLasso` holds; the menu beside what it holds
// acts on it at once (`ink_selection`), offers the pen's colours, and is
// `paste` alone where the Pencil rested with something to put down
// (`ink_paste`); what two and three fingers do is passed to whoever listens
// and a pinch on to the canvases; the pages'
// overview has every page small with the one in view marked, a notebook's
// with its paper, a page's `more`, a tile that adds one, and pages moved by
// dragging; the pages as one PDF, shared on a device and saved on a Mac, each
// sheet as the notebook's page setup has it; and `page setup` itself, one
// panel whose every press is the notebook's paper a moment later.
// What `written.ts` does to the file is its own test's (`written.test.ts`):
// here it is only asked. The canvases are an iPad's (`ILMI_SMOKE=written`).

import { act, createElement } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { PaperKind } from '../../format/index.js';

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

const calls: { cmd: string; args: Record<string, unknown> }[] = [];
/** What the native side answers, by command. */
let answers: Record<string, (args: Record<string, unknown>) => unknown> = {};
vi.mock('@tauri-apps/api/core', () => ({
  invoke: async (cmd: string, args: Record<string, unknown>) => {
    if (cmd === 'dev_env') return null;
    calls.push({ cmd, args });
    if (cmd in answers) return answers[cmd]!(args);
    if (cmd === 'ink_scene') return { made: [] };
    if (cmd === 'ink_selection') return { selected: 0, clip: 0 };
    return null;
  },
}));
/** Where a Mac's dialog says to save; null is the dialog closed. */
let saveTo: string | null = null;
const saves: unknown[] = [];
vi.mock('@tauri-apps/plugin-dialog', () => ({ open: async () => null, save: async (o: unknown) => { saves.push(o); return saveTo; } }));

const ROOT = '/collections/paper';
const NB = 'notes/lecture.md';
const ID = '5b0c7e1a9d3f4e26b8a1c0d2e4f60718';
/** What the overview asked the store for a picture of. */
const pictured: unknown[][] = [];
/** The sheets the store holds writing for (`inkedPages`), and the drawings it was asked for (a pageless notebook's, for how far its writing reaches: 88). */
let inkedSheets: number[] = [];
const drawings: unknown[][] = [];
const store = {
  pageInk: async () => [],
  pageInkFile: async (...a: unknown[]) => {
    if (a[2] === 'drawing') { drawings.push(a); return new TextEncoder().encode(`drawing of ${String(a[1])}`); }
    pictured.push(a);
    return new TextEncoder().encode(`picture of ${String(a[1])}`);
  },
  inkedPages: async () => inkedSheets,
};
let open = true;
vi.mock('../vault.js', async (orig) => ({ ...(await orig<typeof import('../vault.js')>()), currentVault: () => (open ? { root: ROOT, fs: store } : null) }));
/** What was asked of the notebook's file. */
const asked: unknown[][] = [];
vi.mock('../written.js', async (orig) => ({
  ...(await orig<typeof import('../written.js')>()),
  addSheet: async (path: string) => { asked.push(['addSheet', path]); return 9; },
  addSheetAfter: async (path: string, after: number) => { asked.push(['addSheetAfter', path, after]); return 9; },
  duplicateSheet: async (path: string, sheet: number) => { asked.push(['duplicateSheet', path, sheet]); return 9; },
  moveSheet: async (path: string, sheet: number, place: number) => { asked.push(['moveSheet', path, sheet, place]); },
  setPaper: async (path: string, paper: PaperKind) => { asked.push(['setPaper', path, paper]); },
  setSetup: async (path: string, setup: unknown) => { asked.push(['setSetup', path, setup]); },
  keepSetup: (setup: unknown) => { asked.push(['keepSetup', setup]); },
}));

const { useApp } = await import('../store.js');
const ink = await import('../ink.js');
const { useLasso, lassoDo, lassoPaste, pinchSheets } = ink;
const { useInkTools, CUSTOM } = await import('../inkTools.js');
const { InkMenu, PageGrid, PageSetup, PaperSheet, STOPS, sharePages } = await import('../PageTools.js');
const { MM, paperOf } = await import('../paper.js');
const { hapticsAsked, hapticsAskedClear, setHapticSender } = await import('../haptics.js');

URL.createObjectURL = ((): string => `blob:ink/${pictured.length}`) as typeof URL.createObjectURL;
URL.revokeObjectURL = () => {};
Element.prototype.scrollIntoView ??= function () {};
// jsdom lays nothing out: the overview's pages lie in a row, 148 wide, 160 apart
let first = 1;
const rectOf = HTMLElement.prototype.getBoundingClientRect;
HTMLElement.prototype.getBoundingClientRect = function (this: HTMLElement) {
  if (this.classList.contains('pg-item') && this.dataset.pg) return new DOMRect((Number(this.dataset.pg) - first) * 160, 0, 148, 200);
  if (this.classList.contains('pg-more')) return new DOMRect(40, 210, 24, 24);
  return rectOf.call(this);
};

const wait = (ms = 5) => new Promise((r) => setTimeout(r, ms));
const said = (cmd: string) => calls.filter((c) => c.cmd === cmd).map((c) => c.args);
const pencil = (e: Record<string, unknown>) => act(async () => { (window as unknown as { __ink(e: unknown): void }).__ink(e); await wait(); });
const HOST = `pages:${NB}`;
const SHEET = `p.${ID}.3`;
const picked = (more: Record<string, unknown> = {}) => ({ kind: 'picked', sheet: SHEET, host: HOST, count: 2, clip: 0, x: 100, y: 300, w: 200, h: 80, ...more });

let host: HTMLDivElement;
let root: Root | null = null;
const mount = async (el: ReturnType<typeof createElement>) => {
  host = document.body.appendChild(document.createElement('div'));
  root = createRoot(host);
  await act(async () => { root!.render(el); await wait(); });
};
const click = (el: Element) => act(async () => { (el as HTMLElement).click(); await wait(); });
const menuRows = () => Array.from(document.querySelectorAll<HTMLElement>('.pop-menu .ci'));
const menuRow = (name: string) => document.querySelector<HTMLElement>(`.pop-menu .ci[data-act="${name}"]`)!;

beforeEach(async () => {
  calls.length = 0;
  answers = {};
  asked.length = 0;
  pictured.length = 0;
  drawings.length = 0;
  inkedSheets = [];
  saves.length = 0;
  saveTo = null;
  open = true;
  first = 1;
  useApp.setState({ mobile: true, phone: false, notice: null, theme: 'light' });
  useLasso.setState({ picked: null, rest: null });
  // (the canvases hear of this page from here on: `window.__ink` is there)
  ink.addSurface({ host: () => null, paper: () => null, kept: async () => {} });
  await wait();
  calls.length = 0;
});
afterEach(() => {
  if (root) act(() => root!.unmount());
  root = null;
  host?.remove();
  document.querySelector('.pop-menu')?.remove();
});

describe('the lasso, as the canvases say it', () => {
  it('what it holds and where is kept; held no longer, it is gone', async () => {
    expect(useLasso.getState()).toEqual({ picked: null, rest: null });
    await pencil(picked());
    expect(useLasso.getState().picked).toEqual({ sheet: SHEET, host: HOST, count: 2, clip: 0, box: { x: 100, y: 300, w: 200, h: 80 } });
    // moved: said again where it lies now
    await pencil(picked({ x: 140, y: 320, clip: 2 }));
    expect(useLasso.getState().picked).toMatchObject({ clip: 2, box: { x: 140, y: 320, w: 200, h: 80 } });
    await pencil({ kind: 'unpicked', moving: true });
    expect(useLasso.getState().picked).toBeNull();
    // said again with nothing held: nothing changes
    const was = useLasso.getState();
    await pencil({ kind: 'unpicked' });
    expect(useLasso.getState()).toBe(was);
  });

  it('where the Pencil rested is a place to paste only while something was cut or copied, and until the Pencil is down again', async () => {
    await pencil({ kind: 'rest', sheet: SHEET, host: HOST, x: 50, y: 400, clip: 0 });
    expect(useLasso.getState().rest).toBeNull();
    await pencil({ kind: 'rest', sheet: SHEET, host: HOST, x: 50, y: 400, clip: 2 });
    expect(useLasso.getState().rest).toEqual({ sheet: SHEET, host: HOST, x: 50, y: 400 });
    // a stroke begun: no longer asked for
    await pencil({ kind: 'begin', sheet: SHEET, host: HOST, x: 60, y: 60 });
    expect(useLasso.getState().rest).toBeNull();
    // something held: there is no place to paste beside it
    await pencil({ kind: 'rest', sheet: SHEET, host: HOST, x: 50, y: 400, clip: 2 });
    await pencil(picked());
    expect(useLasso.getState().rest).toBeNull();
    expect(useLasso.getState().picked).not.toBeNull();
    // rested again with nothing to put down: the place goes
    await pencil({ kind: 'unpicked' });
    await pencil({ kind: 'rest', sheet: SHEET, host: HOST, x: 50, y: 400, clip: 1 });
    await pencil({ kind: 'rest', sheet: SHEET, host: HOST, x: 70, y: 90, clip: 0 });
    expect(useLasso.getState().rest).toBeNull();
  });

  it('a stroke that became a shape changes nothing here', async () => {
    await pencil(picked());
    const was = useLasso.getState();
    calls.length = 0;
    await pencil({ kind: 'shape', sheet: SHEET, shape: 'rectangle' });
    expect(useLasso.getState()).toBe(was);
    expect(calls).toEqual([]);
  });

  it('something done with what is held is asked of the canvases, and what can be pasted afterwards is what they answer', async () => {
    await pencil(picked());
    calls.length = 0;
    answers.ink_selection = () => ({ selected: 2, clip: 2 });
    await lassoDo('copy');
    expect(calls).toEqual([{ cmd: 'ink_selection', args: { op: 'copy', color: null } }]);
    expect(useLasso.getState().picked).toMatchObject({ count: 2, clip: 2 });
    await lassoDo('color', '#aa0000');
    await lassoDo('duplicate');
    await lassoDo('cut');
    await lassoDo('delete');
    expect(said('ink_selection')).toEqual([{ op: 'copy', color: null }, { op: 'color', color: '#aa0000' }, { op: 'duplicate', color: null }, { op: 'cut', color: null }, { op: 'delete', color: null }]);
    // nothing left held by it: what is kept here is the canvases' to say (`unpicked`)
    const was = useLasso.getState().picked;
    answers.ink_selection = () => ({ selected: 0, clip: 5 });
    await lassoDo('delete');
    expect(useLasso.getState().picked).toBe(was);
    // with nothing held here, the answer is no one's; a failure is said and thrown at no one
    useLasso.setState({ picked: null });
    answers.ink_selection = () => ({ selected: 1, clip: 1 });
    await lassoDo('copy');
    expect(useLasso.getState().picked).toBeNull();
    answers.ink_selection = () => { throw new Error('no canvas'); };
    const err = vi.spyOn(console, 'error').mockImplementation(() => {});
    await expect(lassoDo('cut')).resolves.toBeUndefined();
    expect(err).toHaveBeenCalledTimes(1);
    err.mockRestore();
  });

  it('paste puts it down where the Pencil rested, once; with no place there is nothing to ask', async () => {
    await lassoPaste();
    expect(calls).toEqual([]);
    await pencil({ kind: 'rest', sheet: SHEET, host: HOST, x: 50, y: 400, clip: 2 });
    calls.length = 0;
    await lassoPaste();
    expect(calls).toEqual([{ cmd: 'ink_paste', args: { sheet: SHEET, x: 50, y: 400 } }]);
    expect(useLasso.getState().rest).toBeNull();
    await lassoPaste();
    expect(said('ink_paste').length).toBe(1);
  });

  it('what two and three fingers do on the glass is heard by every lens that listens, until it stops listening; nothing else hears it', async () => {
    const a: unknown[] = [];
    const b: unknown[] = [];
    const offA = ink.onFingers((e) => a.push(e));
    const offB = ink.onFingers((e) => b.push(e));
    const tap = { kind: 'fingers', n: 2, x: 300, y: 400 };
    const spread = { kind: 'pinch', phase: 'change', k: 1.4, x: 310, y: 420 };
    await pencil(picked());
    const was = useLasso.getState();
    calls.length = 0;
    await pencil(tap);
    await pencil(spread);
    expect(a).toEqual([tap, spread]);
    expect(b).toEqual([tap, spread]);
    // no stroke, no tool, nothing of the lasso's: and nothing asked of the canvases by it
    expect(useLasso.getState()).toBe(was);
    expect(calls).toEqual([]);
    offA();
    await pencil({ kind: 'fingers', n: 3, x: 1, y: 2 });
    expect(a.length).toBe(2);
    expect(b.at(-1)).toEqual({ kind: 'fingers', n: 3, x: 1, y: 2 });
    offB();
    // where there is no canvas there is nothing to listen to
    useApp.setState({ mobile: false });
    const c: unknown[] = [];
    ink.onFingers((e) => c.push(e))();
    ink.onFingers((e) => c.push(e));
    await pencil(tap);
    expect(c).toEqual([]);
  });

  it('two fingers\' pinch is passed to the canvases of that surface, and its end; nothing where there is no canvas', async () => {
    pinchSheets(HOST, { k: 1.5, dx: -40, dy: 12 });
    pinchSheets(HOST, null);
    await wait();
    expect(calls).toEqual([{ cmd: 'ink_pinch', args: { pinch: { host: HOST, k: 1.5, dx: -40, dy: 12 } } }, { cmd: 'ink_pinch', args: { pinch: { host: HOST } } }]);
    useApp.setState({ mobile: false });
    calls.length = 0;
    pinchSheets(HOST, { k: 2, dx: 0, dy: 0 });
    await wait();
    expect(calls).toEqual([]);
  });
});

describe('the lasso\'s menu', () => {
  let scroller: HTMLDivElement;
  const show = async (to: HTMLElement | null = scroller, at = HOST) => mount(createElement(InkMenu, { host: at, scroller: to }));
  const menu = () => document.querySelector<HTMLElement>('.ink-menu');
  const ops = () => Array.from(document.querySelectorAll<HTMLElement>('.ink-menu [data-ink-op]')).map((b) => b.dataset.inkOp);
  const op = (name: string) => document.querySelector<HTMLElement>(`.ink-menu [data-ink-op="${name}"]`)!;
  const colours = () => Array.from(document.querySelectorAll<HTMLElement>('.ink-menu [data-ink-colour]'));
  beforeEach(() => { scroller = document.body.appendChild(document.createElement('div')); scroller.className = 'book-pages'; });
  afterEach(() => { scroller.remove(); });

  it('is nowhere until the lasso holds something; then it lies in the scroller\'s content, over what is held', async () => {
    await show();
    expect(menu()).toBeNull();
    await pencil(picked());
    const m = menu()!;
    expect(m.parentElement).toBe(scroller);
    expect([m.getAttribute('role'), m.getAttribute('aria-label'), m.dataset.count, m.dataset.place]).toEqual(['menu', 'selection', '2', 'above']);
    // no place for the Pencil to write through
    expect(m.hasAttribute('data-ink-over')).toBe(true);
    // over the middle of what is held, a little above it
    expect([m.style.left, m.style.top]).toEqual(['200px', '286px']);
    expect(ops()).toEqual(['cut', 'copy', 'duplicate', 'delete', 'colour']);
    expect(Array.from(m.querySelectorAll('button')).map((b) => [b.textContent, b.getAttribute('role')])).toEqual([['cut', 'menuitem'], ['copy', 'menuitem'], ['duplicate', 'menuitem'], ['delete', 'menuitem'], ['colour', 'menuitem']]);
    expect(Array.from(m.querySelectorAll('.danger')).map((b) => b.textContent)).toEqual(['delete']);
    // what is held near the top of the view has it underneath
    await pencil(picked({ y: 100 }));
    expect([menu()!.dataset.place, menu()!.style.top]).toEqual(['below', '194px']);
    // scrolled down, the top of the view is further down the content
    scroller.scrollTop = 250;
    await pencil(picked({ y: 300, count: 1 }));
    expect([menu()!.dataset.place, menu()!.style.top, menu()!.dataset.count]).toEqual(['below', '394px', '1']);
    scroller.scrollTop = 0;
    await pencil({ kind: 'unpicked' });
    expect(menu()).toBeNull();
  });

  it('each word acts at once on what is held', async () => {
    await show();
    await pencil(picked());
    calls.length = 0;
    for (const name of ['cut', 'copy', 'duplicate', 'delete']) await click(op(name));
    expect(said('ink_selection')).toEqual(['cut', 'copy', 'duplicate', 'delete'].map((name) => ({ op: name, color: null })));
    // it stays until the canvases say nothing is held
    expect(menu()).not.toBeNull();
  });

  it('`colour` is the pen\'s colours, and the wheel\'s once it has one; one pressed colours what is held', async () => {
    await show();
    await pencil(picked());
    expect(op('colour').getAttribute('aria-haspopup')).toBe('true');
    await click(op('colour'));
    expect(ops()).toEqual([]);
    expect(colours().map((b) => [b.dataset.inkColour, b.getAttribute('aria-label')])).toEqual([['#1c1c1e', 'colour 1'], ['#1d4fb8', 'colour 2'], ['#c5281c', 'colour 3'], ['#1e7a46', 'colour 4']]);
    expect(colours()[1]!.querySelector('span')!.style.background).toBe('rgb(29, 79, 184)');
    calls.length = 0;
    await click(colours()[2]!);
    expect(said('ink_selection')).toEqual([{ op: 'color', color: '#c5281c' }]);
    // and the words are back
    expect(ops()).toEqual(['cut', 'copy', 'duplicate', 'delete', 'colour']);
    // a swatch replaced and a colour taken from the wheel: the colours are the pen's as they are now
    const was = useInkTools.getState().kept;
    await act(async () => { useInkTools.setState({ kept: { ...was, colors: { ...was.colors, pen: ['#884422', ...was.colors.pen.slice(1)] }, custom: { ...was.custom, pen: '#7a3fd1' } } }); });
    await click(op('colour'));
    expect(colours().map((b) => [b.dataset.inkColour, b.getAttribute('aria-label')])).toEqual([['#884422', 'colour 1'], ['#1d4fb8', 'colour 2'], ['#c5281c', 'colour 3'], ['#1e7a46', 'colour 4'], ['#7a3fd1', 'your colour']]);
    expect(CUSTOM).toBe(4);
    await click(colours()[4]!);
    expect(said('ink_selection').at(-1)).toEqual({ op: 'color', color: '#7a3fd1' });
    // let go with the colours showing, the next thing held starts at the words
    await click(op('colour'));
    await pencil({ kind: 'unpicked' });
    await pencil(picked());
    expect(ops()).toEqual(['cut', 'copy', 'duplicate', 'delete', 'colour']);
    await act(async () => { useInkTools.setState({ kept: was }); });
  });

  it('`paste` is there only where the Pencil rested with something to put down, and puts it down there', async () => {
    await show();
    await pencil(picked());
    expect(ops()).not.toContain('paste');
    await pencil({ kind: 'unpicked' });
    await pencil({ kind: 'rest', sheet: SHEET, host: HOST, x: 50, y: 400, clip: 0 });
    expect(menu()).toBeNull();
    await pencil({ kind: 'rest', sheet: SHEET, host: HOST, x: 50, y: 400, clip: 2 });
    expect([menu()!.getAttribute('aria-label'), menu()!.dataset.count, menu()!.dataset.place]).toEqual(['paste', undefined, 'above']);
    expect([menu()!.style.left, menu()!.style.top]).toEqual(['50px', '386px']);
    expect(ops()).toEqual(['paste']);
    calls.length = 0;
    await click(op('paste'));
    expect(said('ink_paste')).toEqual([{ sheet: SHEET, x: 50, y: 400 }]);
    expect(menu()).toBeNull();
    // near the top of the view it is under the place
    await pencil({ kind: 'rest', sheet: SHEET, host: HOST, x: 50, y: 60, clip: 2 });
    expect([menu()!.dataset.place, menu()!.style.top]).toEqual(['below', '90px']);
    // a press on it keeps it; a press anywhere else lets the place go
    await act(async () => { op('paste').dispatchEvent(new PointerEvent('pointerdown', { bubbles: true })); });
    expect(menu()).not.toBeNull();
    await act(async () => { document.body.dispatchEvent(new PointerEvent('pointerdown', { bubbles: true })); });
    expect(useLasso.getState().rest).toBeNull();
    expect(menu()).toBeNull();
    expect(said('ink_paste').length).toBe(1);
  });

  it('is the surface\'s whose pages hold it: another book beside has none, nor a lens with no scroller yet', async () => {
    await show(scroller, 'pages:library/other.pdf');
    await pencil(picked());
    expect(menu()).toBeNull();
    await pencil({ kind: 'unpicked' });
    await pencil({ kind: 'rest', sheet: SHEET, host: HOST, x: 50, y: 400, clip: 2 });
    expect(menu()).toBeNull();
    act(() => root!.unmount());
    host.remove();
    await show(null);
    await pencil(picked());
    expect(menu()).toBeNull();
  });

  it('the canvases are told where it lies, and that it is gone', async () => {
    scroller.getBoundingClientRect = () => new DOMRect(0, 0, 600, 800);
    await show();
    const holes = () => (said('ink_scene').at(-1)?.scene as { holes: unknown[] } | undefined)?.holes;
    await pencil(picked());
    menu()!.getBoundingClientRect = () => new DOMRect(120, 260, 240, 36);
    ink.sceneSoon();
    await act(async () => { await wait(); });
    expect(holes()).toEqual([{ x: 120, y: 260, w: 240, h: 36 }]);
    await pencil({ kind: 'unpicked' });
    await act(async () => { await wait(); });
    expect(holes()).toEqual([]);
  });
});

describe('the pages\' overview', () => {
  let into: HTMLDivElement;
  const went: number[] = [];
  const deleted: unknown[][] = [];
  let closed = 0;
  const sizes = (n: number) => Array.from({ length: n }, () => ({ w: 612, h: 792 }));
  const notebook = (sheets: number[], paper: PaperKind = 'ruled', more: Record<string, unknown> = {}) => createElement(PageGrid, {
    id: NB, into, written: { id: ID, paper, sheets }, hash: ID, base: 0, sizes: sizes(sheets.length), current: 2, inked: { 3: 1 }, pdf: null,
    onGo: (n: number) => { went.push(n); }, onDelete: (n: number, at: unknown) => { deleted.push([n, at]); }, onClose: () => { closed += 1; }, ...more,
  });
  const q = <T extends HTMLElement>(sel: string) => into.querySelector<T>(sel);
  const qa = <T extends HTMLElement>(sel: string) => Array.from(into.querySelectorAll<T>(sel));
  const item = (place: number) => q<HTMLElement>(`[data-pg="${place}"]`)!;
  const ptr = (type: string, x: number, y: number, pointerType = 'mouse') => new PointerEvent(type, { bubbles: true, cancelable: true, pointerId: 5, pointerType, isPrimary: true, button: 0, clientX: x, clientY: y });
  const fire = (el: Element, e: Event) => act(async () => { el.dispatchEvent(e); });
  beforeEach(() => {
    into = document.body.appendChild(document.createElement('div'));
    into.className = 'book';
    went.length = 0;
    deleted.length = 0;
    closed = 0;
  });
  afterEach(() => { into.remove(); });

  it('has every page of a notebook small, as its paper, numbered by its place, with the one in view marked', async () => {
    await mount(notebook([1, 3, 7], 'grid'));
    const grid = q<HTMLElement>('.page-grid')!;
    expect(grid.parentElement).toBe(into);
    expect([grid.getAttribute('role'), grid.getAttribute('aria-label'), grid.dataset.written, grid.dataset.lifting]).toEqual(['dialog', 'pages', '1', undefined]);
    // it lies over the pages: no place for the Pencil
    expect(grid.hasAttribute('data-ink-over')).toBe(true);
    expect([q('.pg-title')!.textContent, q('.pg-count')!.textContent]).toEqual(['pages', '3']);
    expect(qa('[data-pg]').map((t) => [t.dataset.pg, t.dataset.sheet, t.dataset.current])).toEqual([['1', '1', undefined], ['2', '3', '1'], ['3', '7', undefined]]);
    expect(qa('[data-pg] .pg-go').map((b) => [b.getAttribute('aria-label'), b.getAttribute('aria-current')])).toEqual([['page 1', null], ['page 2', 'page'], ['page 3', null]]);
    expect(qa('[data-pg] .pg-n').map((n) => n.textContent)).toEqual(['1', '2', '3']);
    // each a sheet of the notebook's paper, in the sheet's own shape, and nothing drawn by pdf.js
    expect(qa('[data-pg] svg.paper').map((s) => [s.getAttribute('data-paper'), s.getAttribute('viewBox')])).toEqual([['grid', '0 0 612 792'], ['grid', '0 0 612 792'], ['grid', '0 0 612 792']]);
    expect(qa<HTMLElement>('[data-pg] .pg-sheet').map((s) => s.style.aspectRatio)).toEqual(['612 / 792', '612 / 792', '612 / 792']);
    expect(q('[data-pg] canvas')).toBeNull();
    // every page has its `more`, and after the last there is one to add
    expect(qa('[data-pg-do="more"]').map((b) => [b.getAttribute('aria-label'), b.getAttribute('aria-haspopup')])).toEqual([['page 1: more', 'menu'], ['page 2: more', 'menu'], ['page 3: more', 'menu']]);
    expect(qa('.pg-add .pg-go').map((b) => [b.dataset.pgDo, b.getAttribute('aria-label')])).toEqual([['add', 'add page']]);
    expect(q('.pg-add .pg-n')!.textContent).toBe('add page');
  });

  it('what is written on a page lies over its paper: asked of the store by the sheet\'s own number, coarse, and only for the pages written on', async () => {
    await mount(notebook([1, 3, 7]));
    await act(async () => { await wait(20); });
    expect(pictured).toEqual([[ID, 3, 'picture', 612, 792, 1]]);
    expect(qa('[data-pg]').map((t) => t.querySelector('img.page-ink') !== null)).toEqual([false, true, false]);
    expect(item(2).querySelector<HTMLImageElement>('img.page-ink')!.src).toContain('blob:ink/');
    // its strokes changed: made again
    await act(async () => { root!.render(notebook([1, 3, 7], 'ruled', { inked: { 3: 2, 7: 1 } })); await wait(20); });
    expect(pictured.map((a) => a[1])).toEqual([3, 3, 7]);
    expect(qa('[data-pg]').map((t) => t.querySelector('img.page-ink') !== null)).toEqual([false, true, true]);
    // erased: the page is bare again
    await act(async () => { root!.render(notebook([1, 3, 7], 'ruled', { inked: { 7: 1 } })); await wait(20); });
    expect(qa('[data-pg]').map((t) => t.querySelector('img.page-ink') !== null)).toEqual([false, false, true]);
  });

  it('a page pressed is gone to; the close button and esc close it', async () => {
    await mount(notebook([1, 3, 7]));
    await click(item(3).querySelector('.pg-go')!);
    expect(went).toEqual([3]);
    const close = q<HTMLElement>('[data-pg-do="close"]')!;
    expect([close.getAttribute('aria-label'), close.title]).toEqual(['close', 'close']);
    await click(close);
    expect(closed).toBe(1);
    const esc = new KeyboardEvent('keydown', { key: 'Escape', bubbles: true, cancelable: true });
    let reached = false;
    const below = () => { reached = true; };
    window.addEventListener('keydown', below);
    await act(async () => { document.body.dispatchEvent(esc); });
    window.removeEventListener('keydown', below);
    expect(closed).toBe(2);
    // the key is the overview's: nothing under it hears it
    expect(reached).toBe(false);
    await act(async () => { document.body.dispatchEvent(new KeyboardEvent('keydown', { key: 'g', bubbles: true })); });
    expect(closed).toBe(2);
    expect(asked).toEqual([]);
  });

  it('the four papers are small sheets at its head, the notebook\'s pressed; another pressed is its paper from then on', async () => {
    await mount(notebook([1, 3, 7], 'dotted'));
    expect(q('.pg-papers')!.getAttribute('aria-label')).toBe('paper');
    expect(qa('[data-pg-paper]').map((b) => [b.dataset.pgPaper, b.getAttribute('aria-label'), b.title, b.getAttribute('aria-pressed')])).toEqual([
      ['blank', 'blank paper', 'blank paper', 'false'], ['ruled', 'ruled paper', 'ruled paper', 'false'], ['grid', 'grid paper', 'grid paper', 'false'], ['dotted', 'dotted paper', 'dotted paper', 'true'],
    ]);
    expect(qa('[data-pg-paper] svg.paper').map((s) => s.getAttribute('data-paper'))).toEqual(['blank', 'ruled', 'grid', 'dotted']);
    await click(q('[data-pg-paper="grid"]')!);
    expect(asked).toEqual([['setPaper', NB, 'grid']]);
    // the one it has, pressed: nothing to do
    await click(q('[data-pg-paper="dotted"]')!);
    expect(asked.length).toBe(1);
  });

  it('a sheet of paper is drawn in points, whatever size it is shown at: rules, a grid, dots, or nothing', async () => {
    await mount(createElement('div', null, ...(['blank', 'ruled', 'grid', 'dotted'] as const).map((kind) => createElement(PaperSheet, { key: kind, kind }))));
    const sheets = Array.from(host.querySelectorAll('svg.paper'));
    expect(sheets.map((s) => [s.getAttribute('data-paper'), s.getAttribute('viewBox'), s.getAttribute('preserveAspectRatio'), s.getAttribute('aria-hidden')])).toEqual((['blank', 'ruled', 'grid', 'dotted']).map((k) => [k, '0 0 612 792', 'none', 'true']));
    expect(sheets.map((s) => [s.querySelector('.paper-sheet') !== null, s.querySelector('.paper-rule') !== null, s.querySelector('.paper-dot') !== null])).toEqual([[true, false, false], [true, true, false], [true, true, false], [true, false, true]]);
    expect(sheets[1]!.querySelector('.paper-rule')!.getAttribute('vector-effect')).toBe('non-scaling-stroke');
  });

  it('the tile after the last page adds one at the end', async () => {
    await mount(notebook([1, 3, 7]));
    await click(q('[data-pg-do="add"]')!);
    expect(asked).toEqual([['addSheet', NB]]);
    expect(went).toEqual([]);
  });

  it('a page\'s `more` adds one after it, makes it again, or deletes it: by the sheet\'s own number, the deleting left to the lens', async () => {
    await mount(notebook([1, 3, 7]));
    await click(item(2).querySelector('[data-pg-do="more"]')!);
    expect(menuRows().map((r) => [r.dataset.act, r.textContent, r.classList.contains('danger')])).toEqual([['pg-add-after', 'add page after', false], ['pg-duplicate', 'duplicate', false], ['pg-delete', 'delete', true]]);
    expect(document.querySelector('.pop-menu')!.classList.contains('book-menu')).toBe(true);
    await click(menuRow('pg-add-after'));
    expect(asked).toEqual([['addSheetAfter', NB, 3]]);
    await click(item(3).querySelector('[data-pg-do="more"]')!);
    await click(menuRow('pg-duplicate'));
    expect(asked).toEqual([['addSheetAfter', NB, 3], ['duplicateSheet', NB, 7]]);
    // deleted by its place, as the lens counts pages, with where the menu hung (the lens asks there when the page holds something)
    await click(item(3).querySelector('[data-pg-do="more"]')!);
    await click(menuRow('pg-delete'));
    expect(deleted).toEqual([[3, { left: 40, top: 238, bottom: 238 }]]);
    // none of it went to a page
    expect(went).toEqual([]);
  });

  it('a page dragged by the mouse is lifted once it has moved, shows where it would land, and is moved there when let go', async () => {
    await mount(notebook([1, 3, 7]));
    const grid = () => q<HTMLElement>('.page-grid')!;
    // a few pixels are a press, not a drag
    await fire(item(1), ptr('pointerdown', 10, 10));
    await fire(item(1), ptr('pointermove', 13, 12));
    expect(grid().dataset.lifting).toBeUndefined();
    await fire(item(1), ptr('pointerup', 13, 12));
    await click(item(1).querySelector('.pg-go')!);
    expect(went).toEqual([1]);
    went.length = 0;
    // further: lifted, and it follows the pointer
    await fire(item(1), ptr('pointerdown', 10, 10));
    await fire(item(1), ptr('pointermove', 30, 20));
    expect(grid().dataset.lifting).toBe('1');
    expect(item(1).dataset.lifted).toBe('1');
    expect(item(1).style.transform).toBe('translate(20px, 10px) scale(1.04)');
    // over the first half of the third page: it would land before it
    await fire(item(1), ptr('pointermove', 330, 50));
    expect(qa('[data-drop="1"]').map((t) => t.dataset.pg)).toEqual(['3']);
    expect(item(1).style.transform).toBe('translate(320px, 40px) scale(1.04)');
    await fire(item(1), ptr('pointerup', 330, 50));
    expect(asked).toEqual([['moveSheet', NB, 1, 2]]);
    expect(grid().dataset.lifting).toBeUndefined();
    expect(item(1).dataset.lifted).toBeUndefined();
    expect(item(1).style.transform).toBe('');
    expect(qa('[data-drop="1"]')).toEqual([]);
    // the press that ends the drag goes nowhere
    await click(item(1).querySelector('.pg-go')!);
    expect(went).toEqual([]);
    // past the last page: after them all, shown on the tile that adds one
    await fire(item(1), ptr('pointerdown', 10, 10));
    await fire(item(1), ptr('pointermove', 450, 50));
    expect(q('.pg-add')!.dataset.drop).toBe('1');
    await fire(item(1), ptr('pointerup', 450, 50));
    expect(asked.at(-1)).toEqual(['moveSheet', NB, 1, 3]);
    // the last page to the front
    await fire(item(3), ptr('pointerdown', 330, 10));
    await fire(item(3), ptr('pointermove', 10, 50));
    expect(qa('[data-drop="1"]').map((t) => t.dataset.pg)).toEqual(['1']);
    await fire(item(3), ptr('pointerup', 10, 50));
    expect(asked.at(-1)).toEqual(['moveSheet', NB, 7, 1]);
    expect(asked.length).toBe(3);
  });

  it('let go where it lay, or the drag broken off, nothing is moved', async () => {
    await mount(notebook([1, 3, 7]));
    // before the page that follows it is where it lies already
    await fire(item(1), ptr('pointerdown', 10, 10));
    await fire(item(1), ptr('pointermove', 200, 50));
    expect(qa('[data-drop="1"]').map((t) => t.dataset.pg)).toEqual(['2']);
    await fire(item(1), ptr('pointerup', 200, 50));
    await fire(item(2), ptr('pointerdown', 170, 10));
    await fire(item(2), ptr('pointermove', 450, 50));
    await fire(item(2), ptr('pointercancel', 450, 50));
    expect(q<HTMLElement>('.page-grid')!.dataset.lifting).toBeUndefined();
    expect(asked).toEqual([]);
    // a press on a page's `more` lifts nothing
    await fire(item(1).querySelector('[data-pg-do="more"]')!, ptr('pointerdown', 10, 10));
    await fire(item(1), ptr('pointermove', 450, 50));
    expect(q<HTMLElement>('.page-grid')!.dataset.lifting).toBeUndefined();
  });

  it('under a finger a page is lifted only once the finger has rested on it, with a tick; a finger that moves first is scrolling', async () => {
    useApp.setState({ canHaptics: true, haptics: true });
    setHapticSender(async () => null);
    hapticsAskedClear();
    try {
      await mount(notebook([1, 3, 7]));
      const grid = () => q<HTMLElement>('.page-grid')!;
      await fire(item(1), ptr('pointerdown', 10, 10, 'touch'));
      await fire(item(1), ptr('pointermove', 12, 40, 'touch'));
      await act(async () => { await wait(380); });
      expect(grid().dataset.lifting).toBeUndefined();
      await fire(item(1), ptr('pointerup', 12, 40, 'touch'));
      expect(hapticsAsked()).toEqual([]);
      // rested first
      await fire(item(1), ptr('pointerdown', 10, 10, 'touch'));
      await act(async () => { await wait(200); });
      expect(grid().dataset.lifting).toBeUndefined();
      await act(async () => { await wait(180); });
      expect(grid().dataset.lifting).toBe('1');
      expect(item(1).dataset.lifted).toBe('1');
      expect(hapticsAsked()).toEqual(['tick']);
      // while a page is lifted the list does not scroll under the finger
      const scroll = new Event('touchmove', { bubbles: true, cancelable: true });
      await fire(item(1), scroll);
      expect(scroll.defaultPrevented).toBe(true);
      await fire(item(1), ptr('pointermove', 450, 50, 'touch'));
      await fire(item(1), ptr('pointerup', 450, 50, 'touch'));
      expect(asked).toEqual([['moveSheet', NB, 1, 3]]);
      const free = new Event('touchmove', { bubbles: true, cancelable: true });
      await fire(item(1), free);
      expect(free.defaultPrevented).toBe(false);
    } finally {
      setHapticSender(null);
      useApp.setState({ canHaptics: false });
    }
  });

  it('a notebook of one page has nothing to move', async () => {
    await mount(notebook([4], 'ruled', { current: 1 }));
    await fire(item(1), ptr('pointerdown', 10, 10));
    await fire(item(1), ptr('pointermove', 450, 50));
    expect(q<HTMLElement>('.page-grid')!.dataset.lifting).toBeUndefined();
    await fire(item(1), ptr('pointerup', 450, 50));
    expect(asked).toEqual([]);
    expect(item(1).dataset.current).toBe('1');
  });

  it('a PDF\'s pages are drawn by pdf.js under their own numbers, with what is written on them, and nothing to add, change or move', async () => {
    first = 41;
    const got: number[] = [];
    const scales: number[] = [];
    const page = { getViewport: ({ scale }: { scale: number }) => { scales.push(scale); return { width: 600 * scale, height: 800 * scale }; }, render: () => ({ promise: Promise.resolve() }) };
    const pdf = { numPages: 44, getPage: async (n: number) => { got.push(n); return page; } };
    await mount(createElement(PageGrid, {
      id: 'library/book/ch-3.md', into, written: undefined, hash: 'f'.repeat(64), base: 40, sizes: [{ w: 600, h: 800 }, { w: 600, h: 800 }], current: 42, inked: { 41: 1 }, pdf: pdf as never,
      onGo: (n: number) => { went.push(n); }, onDelete: () => { deleted.push([]); }, onClose: () => { closed += 1; },
    }));
    await act(async () => { await wait(20); });
    expect(q<HTMLElement>('.page-grid')!.dataset.written).toBeUndefined();
    expect(qa('[data-pg]').map((t) => [t.dataset.pg, t.dataset.sheet, t.dataset.current])).toEqual([['41', undefined, undefined], ['42', undefined, '1']]);
    expect(qa('[data-pg] .pg-n').map((n) => n.textContent)).toEqual(['41', '42']);
    expect(q('.pg-count')!.textContent).toBe('2');
    expect(got.sort()).toEqual([41, 42]);
    // drawn small: a thumb's width of pixels to the page's points
    expect(scales.every((s) => Math.abs(s - 148 / 600) < 1e-9)).toBe(true);
    expect(qa<HTMLCanvasElement>('[data-pg] canvas').map((c) => [c.width, c.height])).toEqual([[148, 197], [148, 197]]);
    expect(qa<HTMLElement>('[data-pg] .pg-sheet').map((s) => s.style.aspectRatio)).toEqual(['600 / 800', '600 / 800']);
    expect(pictured).toEqual([['f'.repeat(64), 41, 'picture', 600, 800, 1]]);
    expect(qa('[data-pg]').map((t) => t.querySelector('img.page-ink') !== null)).toEqual([true, false]);
    expect(q('svg.paper, .pg-papers, [data-pg-paper], [data-pg-do="add"], [data-pg-do="more"]')).toBeNull();
    // pressed, gone to; dragged, nothing
    await fire(item(41), ptr('pointerdown', 10, 10));
    await fire(item(41), ptr('pointermove', 300, 50));
    expect(q<HTMLElement>('.page-grid')!.dataset.lifting).toBeUndefined();
    await fire(item(41), ptr('pointerup', 300, 50));
    await click(item(41).querySelector('.pg-go')!);
    expect(went).toEqual([41]);
    expect(asked).toEqual([]);
  });
});

describe('the pages as a PDF', () => {
  const AT = { x: 700, y: 20, w: 30, h: 30 };
  const nb = { name: 'lecture', hash: ID, written: { id: ID, paper: 'grid' as const, sheets: [1, 3, 7] }, inked: new Set([3]) };
  /** A sheet as `pages_pdf` is told it, with nothing of a page setup said. */
  const sheet = (more: Record<string, unknown> = {}) => ({ w: 612, h: 792, paper: 'grid', rule: 20, margin: null, marginRight: null, top: 72, bottom: null, at: null, ink: null, above: null, color: null, line: null, dark: false, ...more });
  const HASH = 'f'.repeat(64);
  const book = { name: 'lindqvist', hash: HASH, pages: [{ page: 41, w: 600, h: 800 }, { page: 42, w: 595, h: 842 }], inked: new Set([42]) };

  it('on a device: a notebook\'s sheets as their paper with their ink, made and handed to the share sheet from where it was asked', async () => {
    answers.pages_pdf = () => '/var/share/lecture.pdf';
    expect(await sharePages(nb, AT)).toBe('/var/share/lecture.pdf');
    expect(saves).toEqual([]);
    expect(calls).toEqual([
      { cmd: 'pages_pdf', args: { root: ROOT, name: 'lecture', pdf: null, out: null, pages: [
        sheet(), sheet({ ink: `p.${ID}.3` }), sheet(),
      ] } },
      { cmd: 'ink_share', args: { path: '/var/share/lecture.pdf', at: AT } },
    ]);
    // the word that it was being made is gone once the sheet is up
    expect(useApp.getState().notice).toBeNull();
  });

  it('each sheet is told as the notebook\'s page setup has it: its size, its ruling, its margins, the room at its foot', async () => {
    answers.pages_pdf = () => '/var/share/lecture.pdf';
    await sharePages({ ...nb, written: { id: ID, paper: 'ruled', sheets: [1, 3], rule: 30, margin: 90, top: 100, size: 'a4', turn: 'landscape' } }, AT);
    expect((said('pages_pdf')[0]!.pages as unknown[])).toEqual([
      { w: 842, h: 595, paper: 'ruled', rule: 30, margin: 90, marginRight: null, top: 100, bottom: null, at: null, ink: null, above: null, color: null, line: null, dark: false },
      { w: 842, h: 595, paper: 'ruled', rule: 30, margin: 90, marginRight: null, top: 100, bottom: null, at: null, ink: `p.${ID}.3`, above: null, color: null, line: null, dark: false },
    ]);
    // a margin at the right as far from the right edge as the file says, and the room under the last rule
    calls.length = 0;
    await sharePages({ ...nb, written: { id: ID, paper: 'ruled', sheets: [1], margin: 90, marginRight: 72, bottom: 40 } }, AT);
    expect((said('pages_pdf')[0]!.pages as unknown[])).toEqual([{ ...sheet(), paper: 'ruled', rule: 24, margin: 90, marginRight: 72, bottom: 40 }]);
    // a grid, dots and blank paper have their margins and no such room
    for (const paper of ['grid', 'dotted', 'blank'] as const) {
      calls.length = 0;
      await sharePages({ ...nb, written: { id: ID, paper, sheets: [1], margin: 90, marginRight: 72, bottom: 40 } }, AT);
      expect((said('pages_pdf')[0]!.pages as unknown[]), paper).toEqual([{ ...sheet(), paper, margin: 90, marginRight: 72, bottom: null }]);
    }
    // nothing is asked of the store for a notebook of pages
    expect(drawings).toEqual([]);
    expect(said('ink_bounds')).toEqual([]);
  });

  it('each sheet is told its paper\'s colour and its ruling\'s where one is chosen, and whether its ink is drawn the dark way: by the paper, not the theme', async () => {
    answers.pages_pdf = () => '/var/share/lecture.pdf';
    const colours = async (written: Record<string, unknown>) => {
      calls.length = 0;
      await sharePages({ ...nb, written: { id: ID, paper: 'grid', sheets: [1], ...written } }, AT);
      const p = (said('pages_pdf')[0]!.pages as { color: unknown; line: unknown; dark: unknown }[])[0]!;
      return [p.color, p.line, p.dark];
    };
    expect(await colours({ color: '#fbf6e9', line: '#bcdcc0' })).toEqual(['#fbf6e9', '#bcdcc0', false]);
    expect(await colours({ color: '#1c1c1e' })).toEqual(['#1c1c1e', null, true]);
    expect(await colours({ line: '#f0c2c2' })).toEqual([null, '#f0c2c2', false]);
    // paper that follows the theme is white in a PDF, whatever the theme is here
    useApp.setState({ theme: 'dark' });
    try {
      expect(await colours({})).toEqual([null, null, false]);
      expect(await colours({ color: '#1c1c1e' })).toEqual(['#1c1c1e', null, true]);
    } finally { useApp.setState({ theme: 'light' }); }
    // a PDF's own pages say none of it
    calls.length = 0;
    await sharePages(book, AT);
    expect(Object.keys((said('pages_pdf')[0]!.pages as object[])[0]!).sort()).toEqual(['h', 'ink', 'source', 'w']);
  });

  /** What a sheet's drawing covers, by the sheet's number: `ink_bounds` answers it (x, y, w, h in the sheet's points). */
  const covers = (by: Record<number, [number, number, number, number]>) => { answers.ink_bounds = (a) => by[Number(atob(a.drawing as string).split(' ').at(-1))] ?? null; };
  const cut = () => (said('pages_pdf')[0]!.pages as { at: number; ink: string | null; above: string | null }[]).map((p) => [p.at, p.ink, p.above]);

  it('a notebook whose sheets run on as one is cut into its sheets: each says how far down the long sheet it begins, and what was written past the foot of the one before', async () => {
    answers.pages_pdf = () => '/var/share/lecture.pdf';
    inkedSheets = [1, 7];
    covers({ 1: [40, 80, 300, 500], 7: [40, 100, 300, 200] });
    await sharePages({ ...nb, written: { id: ID, paper: 'ruled', sheets: [1, 3, 7], pageless: true }, inked: new Set([1, 7]) }, AT);
    expect(cut()).toEqual([
      [0, `p.${ID}.1`, null],
      [792, null, `p.${ID}.1`],
      [1584, `p.${ID}.7`, null],
    ]);
    // how far its writing reaches was asked of the drawings themselves, by the sheets' own numbers
    expect(drawings.map((d) => d.slice(0, 3))).toEqual([[ID, 7, 'drawing'], [ID, 1, 'drawing']]);
    expect(said('ink_bounds').length).toBe(2);
  });

  it('it is cut to as many pages as what is written on it reaches, never the bare sheets under that; with nothing written, one', async () => {
    answers.pages_pdf = () => '/var/share/lecture.pdf';
    const pageless = (inked: number[], sheets = [1, 3, 7]) => { calls.length = 0; inkedSheets = inked; return sharePages({ ...nb, written: { id: ID, paper: 'ruled', sheets, pageless: true }, inked: new Set(inked) }, AT); };
    // written on the first sheet alone, to 580 points down it: one page of three
    covers({ 1: [40, 80, 300, 500] });
    await pageless([1]);
    expect(cut()).toEqual([[0, `p.${ID}.1`, null]]);
    // a stroke kept on the first sheet that runs on over the second: two pages, the second with what is over its head
    covers({ 1: [40, 700, 300, 400] });
    await pageless([1]);
    expect(cut()).toEqual([[0, `p.${ID}.1`, null], [792, null, `p.${ID}.1`]]);
    // to the very foot of the first sheet is one page still; a point past it, two
    covers({ 1: [40, 700, 300, 92] });
    await pageless([1]);
    expect(cut().length).toBe(1);
    covers({ 1: [40, 700, 300, 93] });
    await pageless([1]);
    expect(cut().length).toBe(2);
    // written on the second sheet: the first, bare, is a page above it
    covers({ 3: [40, 10, 300, 40] });
    await pageless([3]);
    expect(cut()).toEqual([[0, null, null], [792, `p.${ID}.3`, null]]);
    // nothing written: one bare page
    covers({});
    await pageless([]);
    expect(cut()).toEqual([[0, null, null]]);
    expect(said('ink_bounds')).toEqual([]);
    // never more pages than it has sheets
    covers({ 7: [40, 700, 300, 900] });
    await pageless([7]);
    expect(cut().map((p) => p[0])).toEqual([0, 792, 1584]);
    // an A4 notebook is cut by its own sheet's height
    covers({ 1: [40, 700, 300, 130] });
    calls.length = 0;
    inkedSheets = [1];
    await sharePages({ ...nb, written: { id: ID, paper: 'ruled', sheets: [1, 3, 7], pageless: true, size: 'a4' }, inked: new Set([1]) }, AT);
    expect(cut()).toEqual([[0, `p.${ID}.1`, null]]);
    // and what the Mac says it is making is the pages it is cut to
    useApp.setState({ mobile: false });
    saveTo = '/Users/me/Desktop/lecture.pdf';
    let during: string | undefined;
    answers.pages_pdf = (a) => { during = useApp.getState().notice?.line; return a.out; };
    covers({ 1: [40, 700, 300, 400] });
    await pageless([1]);
    expect(during).toBe('making a pdf of 2 pages');
  });

  it('a notebook of pages is every one of its sheets, written on or bare', async () => {
    answers.pages_pdf = () => '/var/share/lecture.pdf';
    inkedSheets = [1];
    covers({ 1: [40, 80, 300, 100] });
    await sharePages({ ...nb, written: { id: ID, paper: 'ruled', sheets: [1, 3, 7] }, inked: new Set([1]) }, AT);
    expect(cut()).toEqual([[null, `p.${ID}.1`, null], [null, null, null], [null, null, null]]);
    expect(said('ink_bounds')).toEqual([]);
  });

  it('a PDF\'s own pages are drawn from the file, each its size and its number in it, the ink over them', async () => {
    answers.pages_pdf = () => '/var/share/lindqvist.pdf';
    await sharePages(book, AT);
    expect(said('pages_pdf')).toEqual([{ root: ROOT, name: 'lindqvist', pdf: HASH, out: null, pages: [
      { w: 600, h: 800, source: 41, ink: null },
      { w: 595, h: 842, source: 42, ink: `p.${HASH}.42` },
    ] }]);
    expect(said('ink_share')).toEqual([{ path: '/var/share/lindqvist.pdf', at: AT }]);
  });

  it('on a Mac it is saved where the dialog says, and said; the dialog closed, nothing is made', async () => {
    useApp.setState({ mobile: false });
    expect(await sharePages(nb, AT)).toBeNull();
    expect(saves).toEqual([{ defaultPath: 'lecture.pdf', filters: [{ name: 'PDF', extensions: ['pdf'] }] }]);
    expect(calls).toEqual([]);
    expect(useApp.getState().notice).toBeNull();
    saveTo = '/Users/me/Desktop/lecture notes.pdf';
    let during: string | undefined;
    answers.pages_pdf = (a) => { during = useApp.getState().notice?.line; return a.out; };
    expect(await sharePages(nb, AT)).toBe(saveTo);
    expect(said('pages_pdf')[0]).toMatchObject({ root: ROOT, name: 'lecture', pdf: null, out: saveTo });
    expect(said('ink_share')).toEqual([]);
    expect(during).toBe('making a pdf of 3 pages');
    expect(useApp.getState().notice?.line).toBe('saved lecture notes.pdf');
    // one page is one page
    await sharePages({ ...nb, written: { id: ID, paper: 'ruled', sheets: [1] } }, AT);
    expect(during).toBe('making a pdf of 1 page');
  });

  it('with no pages, or no collection open, there is nothing to make; a failure is the caller\'s to say', async () => {
    expect(await sharePages({ ...nb, written: { id: ID, paper: 'ruled', sheets: [] } }, AT)).toBeNull();
    expect(await sharePages({ name: 'bare', hash: HASH, inked: new Set() }, AT)).toBeNull();
    open = false;
    expect(await sharePages(nb, AT)).toBeNull();
    open = true;
    expect(calls).toEqual([]);
    answers.pages_pdf = () => { throw new Error('disk full'); };
    await expect(sharePages(nb, AT)).rejects.toThrow('disk full');
    expect(said('ink_share')).toEqual([]);
  });
});

describe('page setup', () => {
  let into: HTMLDivElement;
  let closed = 0;
  const NEW = { paper: 'ruled', rule: null, margin: null, marginRight: null, top: null, bottom: null, size: null, turn: null, pageless: false, color: null, line: null };
  const panel = (written: Record<string, unknown> = {}) => createElement(PageSetup, { id: NB, into, written: { id: ID, paper: 'ruled' as PaperKind, sheets: [1, 2], ...written }, onClose: () => { closed += 1; } });
  const q = <T extends HTMLElement>(sel: string) => into.querySelector<T>(sel);
  const qa = <T extends HTMLElement>(sel: string) => Array.from(into.querySelectorAll<T>(sel));
  const ps = <T extends HTMLElement>(name: string) => q<T>(`[data-ps="${name}"]`)!;
  const pressed = (prefix: string) => qa(`[data-ps^="${prefix}-"][aria-pressed="true"]`).map((b) => b.dataset.ps);
  const slide = (name: string, v: number) => act(async () => {
    const el = ps<HTMLInputElement>(name);
    Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value')!.set!.call(el, String(v));
    el.dispatchEvent(new Event('input', { bubbles: true }));
  });
  /** A press, and the moment after which it is written. */
  const settle = () => act(async () => { await wait(130); });
  const setups = () => asked.filter((a) => a[0] === 'setSetup').map((a) => a[2]);
  beforeEach(() => { into = document.body.appendChild(document.createElement('div')); into.className = 'book'; closed = 0; });
  afterEach(() => { into.remove(); });

  it('is one panel over the pages with the notebook\'s paper, its spacing by name and by the millimetre, and how its sheets lie', async () => {
    await mount(panel());
    const p = q<HTMLElement>('.page-setup')!;
    expect(p.parentElement).toBe(into);
    expect([p.getAttribute('role'), p.getAttribute('aria-label'), q('.ps-title')!.textContent]).toEqual(['dialog', 'page setup', 'page setup']);
    // the Pencil does not write through it
    expect(p.hasAttribute('data-ink-over')).toBe(true);
    expect(qa('.ps-papers button').map((b) => [b.dataset.ps, b.textContent, b.getAttribute('aria-pressed')])).toEqual([['paper-blank', 'blank', 'false'], ['paper-ruled', 'ruled', 'true'], ['paper-grid', 'grid', 'false'], ['paper-dotted', 'dotted', 'false']]);
    expect(qa('.ps-papers svg.paper').map((s) => s.getAttribute('data-paper'))).toEqual(['blank', 'ruled', 'grid', 'dotted']);
    // a new notebook's ruling: wide, 24 points, an inch down, no margin rule
    const rule = ps<HTMLInputElement>('rule');
    expect([Number(rule.min), Number(rule.max), rule.value, rule.getAttribute('aria-label')]).toEqual([4 * MM, 14 * MM, '24', 'spacing']);
    expect(STOPS.ruled).toEqual([{ name: 'narrow', rule: 18 }, { name: 'college', rule: 20.25 }, { name: 'wide', rule: 24 }]);
    expect(qa('.ps-stop').map((b) => [b.dataset.ps, b.textContent, b.getAttribute('aria-pressed')])).toEqual([['stop-narrow', 'narrow', 'false'], ['stop-college', 'college', 'false'], ['stop-wide', 'wide', 'true']]);
    expect([ps('margin').getAttribute('role'), ps('margin').getAttribute('aria-checked'), ps('margin').textContent]).toEqual(['switch', 'false', 'left margin']);
    expect([ps('margin-right').getAttribute('role'), ps('margin-right').getAttribute('aria-checked'), ps('margin-right').textContent]).toEqual(['switch', 'false', 'right margin']);
    expect(q('[data-ps="margin-at"], [data-ps="margin-right-at"]')).toBeNull();
    expect([ps<HTMLInputElement>('top').value, ps('top').getAttribute('aria-label')]).toEqual(['72', 'top space']);
    // the room at the foot is a rule's until it is said
    expect([ps<HTMLInputElement>('bottom').value, ps('bottom').getAttribute('aria-label')]).toEqual(['24', 'bottom space']);
    expect(qa('.ps-v').map((v) => v.textContent)).toEqual(['8.5 mm', '25.4 mm', '8.5 mm']);
    expect([pressed('layout'), pressed('size'), pressed('turn')]).toEqual([['layout-pages'], ['size-letter'], ['turn-portrait']]);
    expect(qa('.ps-seg button').map((b) => b.textContent)).toEqual(['pages', 'pageless', 'letter', 'a4', 'portrait', 'landscape']);
    expect([ps('keep').textContent, ps('keep').getAttribute('aria-pressed')]).toEqual(['use for new notebooks', 'false']);
    // opened, nothing is written
    await settle();
    expect(asked).toEqual([]);
  });

  it('says what the notebook\'s file says: its spacing, its margin, its size', async () => {
    await mount(panel({ rule: 18, margin: 100, top: 50, size: 'a4', turn: 'landscape' }));
    expect(ps<HTMLInputElement>('rule').value).toBe('18');
    expect(pressed('stop')).toEqual(['stop-narrow']);
    expect(ps('margin').getAttribute('aria-checked')).toBe('true');
    expect([ps<HTMLInputElement>('margin-at').value, ps('margin-at').getAttribute('aria-label')]).toEqual(['100', 'left margin from the edge']);
    // the right one is its own: the file says none
    expect(ps('margin-right').getAttribute('aria-checked')).toBe('false');
    expect(q('[data-ps="margin-right-at"]')).toBeNull();
    expect(ps<HTMLInputElement>('top').value).toBe('50');
    // with no room said for the foot it is the spacing's
    expect(ps<HTMLInputElement>('bottom').value).toBe('18');
    expect([pressed('layout'), pressed('size'), pressed('turn')]).toEqual([['layout-pages'], ['size-a4'], ['turn-landscape']]);
    // a spacing that is none of the names lights none
    await act(async () => { root!.render(panel({ rule: 22 })); await wait(); });
    expect(pressed('stop')).toEqual([]);
    expect(qa('.ps-v')[0]!.textContent).toBe('7.8 mm');
    // changed under the panel by another hand (a sync): the panel says it
    await act(async () => { root!.render(panel({ paper: 'dotted', pageless: true })); await wait(); });
    expect(pressed('paper')).toEqual(['paper-dotted']);
    expect(pressed('layout')).toEqual(['layout-pageless']);
    expect(asked).toEqual([]);
  });

  it('each press is the notebook\'s paper a moment later, with all of the setup said', async () => {
    await mount(panel());
    await click(ps('stop-narrow'));
    expect(pressed('stop')).toEqual(['stop-narrow']);
    // not yet: a slider dragged writes when it rests
    expect(asked).toEqual([]);
    await settle();
    expect(asked).toEqual([['setSetup', NB, { ...NEW, rule: 18 }]]);
    await click(ps('margin'));
    expect(ps('margin').getAttribute('aria-checked')).toBe('true');
    // an inch and a quarter in, to start with
    expect(ps<HTMLInputElement>('margin-at').value).toBe('90');
    await settle();
    await slide('margin-at', 120);
    await settle();
    await slide('top', 40);
    await settle();
    await click(ps('size-a4'));
    await settle();
    await click(ps('turn-landscape'));
    await settle();
    expect(setups().slice(1)).toEqual([
      { ...NEW, rule: 18, margin: 90 },
      { ...NEW, rule: 18, margin: 120 },
      { ...NEW, rule: 18, margin: 120, top: 40 },
      { ...NEW, rule: 18, margin: 120, top: 40, size: 'a4' },
      { ...NEW, rule: 18, margin: 120, top: 40, size: 'a4', turn: 'landscape' },
    ]);
    // and back: letter, upright, no margin
    await click(ps('size-letter'));
    await click(ps('turn-portrait'));
    await click(ps('margin'));
    expect(q('[data-ps="margin-at"]')).toBeNull();
    await settle();
    expect(setups().at(-1)).toEqual({ ...NEW, rule: 18, top: 40 });
    expect(closed).toBe(0);
  });

  it('a slider dragged is written once, where it came to rest, to a hundredth of a point', async () => {
    await mount(panel());
    for (const v of [25, 26.5, 28.126, 30.004]) await slide('rule', v);
    expect(ps<HTMLInputElement>('rule').value).toBe('30');
    expect(qa('.ps-v')[0]!.textContent).toBe('10.6 mm');
    expect(asked).toEqual([]);
    await settle();
    expect(setups()).toEqual([{ ...NEW, rule: 30 }]);
  });

  it('a grid and dots have their spacing by size and no room at the top or the foot; blank paper has no spacing at all; each has its margins', async () => {
    await mount(panel({ margin: 90 }));
    await click(ps('paper-grid'));
    expect(pressed('paper')).toEqual(['paper-grid']);
    expect(q('[data-ps="top"], [data-ps="bottom"]')).toBeNull();
    expect([ps('margin').getAttribute('aria-checked'), ps<HTMLInputElement>('margin-at').value, ps('margin-right').getAttribute('aria-checked')]).toEqual(['true', '90', 'false']);
    expect(ps<HTMLInputElement>('rule').value).toBe('20');
    expect(qa('.ps-stop').map((b) => [b.dataset.ps, b.textContent, b.getAttribute('aria-pressed')])).toEqual([['stop-5mm', '5 mm', 'false'], ['stop-7mm', '7 mm', 'true'], ['stop-10mm', '10 mm', 'false']]);
    await click(ps('stop-10mm'));
    await settle();
    expect(setups().at(-1)).toEqual({ ...NEW, paper: 'grid', margin: 90, rule: 28.35 });
    expect(pressed('stop')).toEqual(['stop-10mm']);
    await click(ps('paper-dotted'));
    expect(qa('.ps-stop').map((b) => b.textContent)).toEqual(['5 mm', '7 mm', '10 mm']);
    await click(ps('paper-blank'));
    expect(q('[data-ps="rule"], .ps-stop, [data-ps="top"], [data-ps="bottom"]')).toBeNull();
    expect([ps('margin').getAttribute('aria-checked'), ps<HTMLInputElement>('margin-at').value, ps('margin-right').getAttribute('aria-checked')]).toEqual(['true', '90', 'false']);
    await settle();
    expect(setups().at(-1)).toMatchObject({ paper: 'blank', margin: 90 });
    // how its sheets lie is any paper's
    expect(pressed('layout')).toEqual(['layout-pages']);
  });

  it('a margin at the left and one at the right, each its own switch and its own distance from its own edge, on every paper', async () => {
    await mount(panel());
    for (const kind of ['ruled', 'grid', 'dotted', 'blank'] as const) {
      if (kind !== 'ruled') await click(ps(`paper-${kind}`));
      expect(qa('.ps-check[role="switch"]').map((b) => [b.dataset.ps, b.textContent, b.getAttribute('aria-checked')]), kind).toEqual([['margin', 'left margin', 'false'], ['margin-right', 'right margin', 'false']]);
    }
    await settle();
    await click(ps('paper-ruled'));
    await settle();
    asked.length = 0;
    // the right one alone: an inch and a quarter in from the right edge, to start with
    await click(ps('margin-right'));
    expect([ps('margin-right').getAttribute('aria-checked'), ps('margin').getAttribute('aria-checked')]).toEqual(['true', 'false']);
    const at = ps<HTMLInputElement>('margin-right-at');
    expect([at.value, at.getAttribute('aria-label'), Number(at.min), Number(at.max)]).toEqual(['90', 'right margin from the edge', 10 * MM, 60 * MM]);
    expect(q('[data-ps="margin-at"]')).toBeNull();
    expect(at.closest('.ps-row')!.querySelector('.ps-v')!.textContent).toBe('31.7 mm');
    await settle();
    expect(setups()).toEqual([{ ...NEW, marginRight: 90 }]);
    await slide('margin-right-at', 72.004);
    await settle();
    expect(setups().at(-1)).toEqual({ ...NEW, marginRight: 72 });
    // the left one beside it: each keeps its own
    await click(ps('margin'));
    await slide('margin-at', 120);
    await settle();
    expect(setups().at(-1)).toEqual({ ...NEW, margin: 120, marginRight: 72 });
    expect([ps<HTMLInputElement>('margin-at').value, ps<HTMLInputElement>('margin-right-at').value]).toEqual(['120', '72']);
    expect([ps('margin-at').getAttribute('aria-label'), ps('margin-right-at').getAttribute('aria-label')]).toEqual(['left margin from the edge', 'right margin from the edge']);
    // on another paper they are as they were, and written with it
    for (const kind of ['grid', 'dotted', 'blank'] as const) {
      await click(ps(`paper-${kind}`));
      expect([ps<HTMLInputElement>('margin-at').value, ps<HTMLInputElement>('margin-right-at').value], kind).toEqual(['120', '72']);
      await settle();
      expect(setups().at(-1), kind).toEqual({ ...NEW, paper: kind, margin: 120, marginRight: 72 });
    }
    // the left one off: the right one stands
    await click(ps('margin'));
    expect(q('[data-ps="margin-at"]')).toBeNull();
    expect(ps<HTMLInputElement>('margin-right-at').value).toBe('72');
    await settle();
    expect(setups().at(-1)).toEqual({ ...NEW, paper: 'blank', marginRight: 72 });
    await click(ps('margin-right'));
    await settle();
    expect(setups().at(-1)).toEqual({ ...NEW, paper: 'blank' });
    // `use for new notebooks` takes them with the rest
    await click(ps('margin-right'));
    await click(ps('keep'));
    expect(asked.filter((a) => a[0] === 'keepSetup')).toEqual([['keepSetup', { ...NEW, paper: 'blank', marginRight: 90 }]]);
  });

  it('says the right margin and the room at the foot the file says', async () => {
    await mount(panel({ margin: 100, marginRight: 60, bottom: 50 }));
    expect([ps('margin').getAttribute('aria-checked'), ps('margin-right').getAttribute('aria-checked')]).toEqual(['true', 'true']);
    expect([ps<HTMLInputElement>('margin-at').value, ps<HTMLInputElement>('margin-right-at').value, ps<HTMLInputElement>('bottom').value]).toEqual(['100', '60', '50']);
    expect(qa('.ps-v').map((v) => v.textContent)).toEqual(['8.5 mm', '35.3 mm', '21.2 mm', '25.4 mm', '17.6 mm']);
    // changed by another hand: the right one gone, no room at the foot at all
    await act(async () => { root!.render(panel({ margin: 100, bottom: 0 })); await wait(); });
    expect([ps('margin-right').getAttribute('aria-checked'), q('[data-ps="margin-right-at"]'), ps<HTMLInputElement>('bottom').value]).toEqual(['false', null, '0']);
    expect(asked).toEqual([]);
  });

  it('`bottom space` is the room under a ruled page\'s last rule: a rule\'s until it is dragged, then what it says', async () => {
    await mount(panel({ rule: 30 }));
    const bottom = ps<HTMLInputElement>('bottom');
    expect([bottom.type, Number(bottom.min), Number(bottom.max), bottom.value, bottom.getAttribute('aria-label')]).toEqual(['range', 0, 60 * MM, '30', 'bottom space']);
    expect(bottom.closest('.ps-row')!.querySelector('.ps-l')!.textContent).toBe('bottom space');
    // it comes after the top's
    expect(qa('.ps-row input[type="range"]').map((i) => i.dataset.ps)).toEqual(['rule', 'top', 'bottom']);
    // while none is said it goes with the spacing
    await click(ps('stop-narrow'));
    expect(ps<HTMLInputElement>('bottom').value).toBe('18');
    await settle();
    expect(setups()).toEqual([{ ...NEW, rule: 18 }]);
    for (const v of [40, 55.5, 60.006]) await slide('bottom', v);
    expect(ps<HTMLInputElement>('bottom').value).toBe('60.01');
    expect(ps('bottom').closest('.ps-row')!.querySelector('.ps-v')!.textContent).toBe('21.2 mm');
    await settle();
    expect(setups().slice(1)).toEqual([{ ...NEW, rule: 18, bottom: 60.01 }]);
    // said, it stays as the spacing changes
    await click(ps('stop-wide'));
    expect(ps<HTMLInputElement>('bottom').value).toBe('60.01');
    // none at all
    await slide('bottom', 0);
    await settle();
    expect(setups().at(-1)).toEqual({ ...NEW, rule: 24, bottom: 0 });
    // on a grid it is not shown, and is kept for when the paper is ruled again
    await click(ps('paper-grid'));
    expect(q('[data-ps="bottom"]')).toBeNull();
    await click(ps('paper-ruled'));
    expect(ps<HTMLInputElement>('bottom').value).toBe('0');
    // nor where the sheets run on as one
    await click(ps('layout-pageless'));
    expect(q('[data-ps="bottom"]')).toBeNull();
    expect(q('[data-ps="top"]')).not.toBeNull();
  });

  it('pageless: the sheets run on as one, and have no size or turn to choose', async () => {
    await mount(panel());
    await click(ps('layout-pageless'));
    expect(pressed('layout')).toEqual(['layout-pageless']);
    expect(q('[data-ps^="size-"], [data-ps^="turn-"]')).toBeNull();
    // its rules run on: there is no foot to leave room at, and the top's is the long sheet's
    expect(q('[data-ps="bottom"]')).toBeNull();
    expect(ps<HTMLInputElement>('top').value).toBe('72');
    await settle();
    expect(setups()).toEqual([{ ...NEW, pageless: true }]);
    await click(ps('layout-pages'));
    expect(qa('[data-ps^="size-"], [data-ps^="turn-"]').length).toBe(4);
    expect(ps<HTMLInputElement>('bottom').value).toBe('24');
    await settle();
    expect(setups().at(-1)).toEqual(NEW);
  });

  it('`use for new notebooks` keeps the setup as it is on the panel for this device, and says so until it is changed again', async () => {
    await mount(panel({ rule: 18 }));
    await click(ps('layout-pageless'));
    await click(ps('keep'));
    expect(asked.filter((a) => a[0] === 'keepSetup')).toEqual([['keepSetup', { ...NEW, rule: 18, pageless: true }]]);
    expect([ps('keep').textContent, ps('keep').getAttribute('aria-pressed')]).toEqual(['new notebooks start like this', 'true']);
    await click(ps('stop-wide'));
    expect([ps('keep').textContent, ps('keep').getAttribute('aria-pressed')]).toEqual(['use for new notebooks', 'false']);
    expect(asked.filter((a) => a[0] === 'keepSetup').length).toBe(1);
  });

  it('has a row for the paper\'s colour and one for the ruling\'s: none chosen, the ones offered by name, and the wheel\'s', async () => {
    await mount(panel());
    expect(qa('.ps-colours').map((r) => [r.dataset.psRow, r.querySelector('.ps-l')!.textContent, r.querySelector('.ps-cv')!.textContent])).toEqual([['color', 'paper colour', 'follows the theme'], ['line', 'line colour', 'default']]);
    expect(qa('[data-ps-row="color"] .ps-col').map((b) => [b.dataset.ps, b.getAttribute('aria-label'), b.getAttribute('aria-pressed')])).toEqual([
      ['color-none', 'follows the theme', 'true'], ['color-white', 'white', 'false'], ['color-cream', 'cream', 'false'], ['color-yellow', 'yellow', 'false'], ['color-grey', 'grey', 'false'], ['color-dark', 'dark', 'false'], ['color-wheel', 'colours', 'false'],
    ]);
    expect(qa('[data-ps-row="line"] .ps-col').map((b) => [b.dataset.ps, b.getAttribute('aria-label'), b.getAttribute('aria-pressed')])).toEqual([
      ['line-none', 'default', 'true'], ['line-blue-grey', 'blue-grey', 'false'], ['line-grey', 'grey', 'false'], ['line-blue', 'blue', 'false'], ['line-red', 'red', 'false'], ['line-green', 'green', 'false'], ['line-wheel', 'colours', 'false'],
    ]);
    expect(qa('.ps-colours [role="group"]').map((g) => g.getAttribute('aria-label'))).toEqual(['paper colour', 'line colour']);
    // every word of it lowercase
    for (const el of qa('.ps-colours .ps-l, .ps-colours .ps-cv')) expect(el.textContent).toBe(el.textContent!.toLowerCase());
    // blank paper has nothing ruled on it to colour
    await click(ps('paper-blank'));
    expect(qa('.ps-colours').map((r) => r.dataset.psRow)).toEqual(['color']);
  });

  it('a colour pressed is the notebook\'s at once; pressed again, or the first swatch, it is none again', async () => {
    await mount(panel());
    await click(ps('color-cream'));
    expect([pressed('color'), ps('color-said').textContent, ps('color-cream').getAttribute('aria-label')]).toEqual([['color-cream'], 'cream', 'cream, press again for follows the theme']);
    // the small sheets show it
    expect(qa('.ps-papers .paper-sheet').map((r) => r.getAttribute('fill'))).toEqual(['#fbf6e9', '#fbf6e9', '#fbf6e9', '#fbf6e9']);
    await settle();
    expect(setups()).toEqual([{ ...NEW, color: '#fbf6e9' }]);
    await click(ps('line-green'));
    await settle();
    expect(setups().at(-1)).toEqual({ ...NEW, color: '#fbf6e9', line: '#bcdcc0' });
    expect(q('.ps-papers [data-ps="paper-ruled"] .paper-rule')!.getAttribute('stroke')).toBe('#bcdcc0');
    // pressed again: none
    await click(ps('color-cream'));
    expect([pressed('color'), ps('color-said').textContent]).toEqual([['color-none'], 'follows the theme']);
    await settle();
    expect(setups().at(-1)).toEqual({ ...NEW, line: '#bcdcc0' });
    // the first swatch: none
    await click(ps('line-none'));
    expect([pressed('line'), ps('line-said').textContent]).toEqual([['line-none'], 'default']);
    await settle();
    expect(setups().at(-1)).toEqual(NEW);
    // `use for new notebooks` takes the colours with the rest
    await click(ps('color-dark'));
    await click(ps('line-blue'));
    await click(ps('keep'));
    expect(asked.filter((a) => a[0] === 'keepSetup')).toEqual([['keepSetup', { ...NEW, color: '#1c1c1e', line: '#b5d2f2' }]]);
  });

  it('says the colours the file says: one offered by its name, any other as the wheel\'s own', async () => {
    await mount(panel({ paper: 'grid', color: '#1c1c1e', line: '#123456' }));
    expect([pressed('color'), ps('color-said').textContent]).toEqual([['color-dark'], 'dark']);
    expect([pressed('line'), ps('line-said').textContent, ps('line-wheel').dataset.color]).toEqual([['line-wheel'], '#123456', '#123456']);
    // changed by another hand
    await act(async () => { root!.render(panel({ paper: 'grid', line: '#f0c2c2' })); await wait(); });
    expect([pressed('color'), pressed('line')]).toEqual([['color-none'], ['line-red']]);
    // the wheel keeps the colour it had, and a press on it chooses that again
    expect(ps('line-wheel').dataset.color).toBe('#123456');
    await click(ps('line-wheel'));
    await settle();
    expect(setups()).toEqual([{ ...NEW, paper: 'grid', line: '#123456' }]);
  });

  it('on a Mac the wheel is the browser\'s colour field, live; on a device the system\'s, from the swatch, with the colour in use', async () => {
    useApp.setState({ mobile: false });
    await mount(panel());
    const field = ps<HTMLInputElement>('color-input');
    expect([field.type, field.value, field.getAttribute('aria-label')]).toEqual(['color', '#ffffff', 'paper colour: colours']);
    let shown = 0;
    (field as unknown as { showPicker(): void }).showPicker = () => { shown += 1; };
    await click(ps('color-wheel'));
    expect([shown, said('ink_color')]).toEqual([1, []]);
    await slide('color-input', '#aabbcc' as unknown as number);
    expect([pressed('color'), ps('color-said').textContent]).toEqual([['color-wheel'], '#aabbcc']);
    await settle();
    expect(setups()).toEqual([{ ...NEW, color: '#aabbcc' }]);
    act(() => root!.unmount());
    root = null;
    asked.length = 0;
    useApp.setState({ mobile: true });
    try {
      await mount(panel({ color: '#fbf6e9' }));
      expect(q('[data-ps="color-input"]')).toBeNull();
      answers.ink_color = () => ({ color: '#DDEEFF' });
      await click(ps('line-wheel'));
      expect(said('ink_color')).toEqual([{ color: '#c3cfdd', at: { x: 0, y: 0, w: 0, h: 0 } }]);
      expect([pressed('line'), ps('line-said').textContent]).toEqual([['line-wheel'], '#ddeeff']);
      await settle();
      expect(setups()).toEqual([{ ...NEW, color: '#fbf6e9', line: '#ddeeff' }]);
      // closed with none chosen: as it was
      answers.ink_color = () => ({ color: null });
      await click(ps('line-wheel'));
      await settle();
      expect([said('ink_color').length, setups().length, pressed('line')]).toEqual([2, 1, ['line-wheel']]);
    } finally { useApp.setState({ mobile: true }); }
  });

  it('a sheet is drawn in its colours as the theme has them, and says when its ink is drawn the dark way', async () => {
    const look = () => { const s = host.querySelector('svg.paper')!; return [s.querySelector('.paper-sheet')!.getAttribute('fill'), s.querySelector('.paper-rule:not(.paper-margin)')!.getAttribute('stroke'), s.querySelector('.paper-margin')!.getAttribute('stroke'), s.getAttribute('data-ink-dark')]; };
    await mount(createElement(PaperSheet, { spec: paperOf({ paper: 'ruled', margin: 90 }) }));
    expect(look()).toEqual(['#ffffff', '#c3cfdd', '#e7b9b9', null]);
    // the theme changes under it
    await act(async () => { useApp.setState({ theme: 'dark' }); await wait(); });
    expect(look()).toEqual(['#141414', '#353f4b', '#653f3f', '1']);
    await act(async () => { useApp.setState({ theme: 'eink' }); await wait(); });
    expect(look()).toEqual(['#ffffff', '#8f8f8f', '#c9c9c9', null]);
    act(() => root!.unmount());
    host.remove();
    // a chosen paper is itself in every theme
    await act(async () => { useApp.setState({ theme: 'dark' }); });
    await mount(createElement(PaperSheet, { spec: paperOf({ paper: 'ruled', margin: 90, color: '#fbf6e9', line: '#bcdcc0' }) }));
    expect(look()).toEqual(['#fbf6e9', '#bcdcc0', '#e7b9b9', null]);
    act(() => root!.unmount());
    host.remove();
    await act(async () => { useApp.setState({ theme: 'light' }); });
    await mount(createElement(PaperSheet, { spec: paperOf({ paper: 'ruled', margin: 90, color: '#1c1c1e' }) }));
    expect(look()).toEqual(['#1c1c1e', '#353f4b', '#653f3f', '1']);
  });

  it('closes by its button, esc, or a press anywhere else; a change not yet written is written as it goes', async () => {
    await mount(panel());
    await click(ps('close'));
    expect(closed).toBe(1);
    const esc = new KeyboardEvent('keydown', { key: 'Escape', bubbles: true, cancelable: true });
    let reached = false;
    const below = () => { reached = true; };
    window.addEventListener('keydown', below);
    await act(async () => { document.body.dispatchEvent(esc); });
    window.removeEventListener('keydown', below);
    expect([closed, reached]).toEqual([2, false]);
    await act(async () => { ps('rule').dispatchEvent(new PointerEvent('pointerdown', { bubbles: true })); });
    expect(closed).toBe(2);
    await act(async () => { document.body.dispatchEvent(new PointerEvent('pointerdown', { bubbles: true })); });
    expect(closed).toBe(3);
    // taken away with a press a moment old
    await click(ps('paper-dotted'));
    expect(asked).toEqual([]);
    act(() => root!.unmount());
    root = null;
    await wait();
    expect(asked).toEqual([['setSetup', NB, { ...NEW, paper: 'dotted' }]]);
    await wait(130);
    expect(asked.length).toBe(1);
  });

  it('a sheet of paper is drawn as its setup says: its own size, its rules, its margin in its own colour', async () => {
    await mount(createElement(PaperSheet, { spec: paperOf({ paper: 'ruled', rule: 30, margin: 90, top: 100, size: 'a4', turn: 'landscape' }) }));
    const svg = host.querySelector('svg.paper')!;
    expect([svg.getAttribute('data-paper'), svg.getAttribute('data-rule'), svg.getAttribute('viewBox')]).toEqual(['ruled', '30', '0 0 842 595']);
    expect(svg.querySelector('.paper-sheet')!.getAttribute('width')).toBe('842');
    expect(svg.querySelector('.paper-rule:not(.paper-margin)')!.getAttribute('d')!.startsWith('M0 100H842M0 130H842')).toBe(true);
    const margin = svg.querySelector('.paper-margin')!;
    expect([margin.getAttribute('d'), margin.getAttribute('vector-effect')]).toEqual(['M90 0V595', 'non-scaling-stroke']);
    expect(margin.getAttribute('stroke')).not.toBe(svg.querySelector('.paper-rule:not(.paper-margin)')!.getAttribute('stroke'));
  });
});
