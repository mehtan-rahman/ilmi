// @vitest-environment jsdom
// Milestone 82 in the `Pdf` lens, drawn in jsdom over a store in memory: a
// written notebook opens as its sheets in the column a PDF's pages are in,
// with no file and nothing asked of pdf.js; each sheet near the view is its
// paper (`paper.ts`), and a picture of what is written on it lies over it.
// In the column a page is its place, 1 to N; its strokes, a passage kept
// from it and a clip of it name the sheet's own number, which a page deleted
// before it does not change. `add page` adds one, and so does a stroke begun
// low on the last page; `more` has the paper and `delete this page`, which
// asks when the page holds something and can be undone. What a PDF's text
// gives is not there, and its keys do nothing. With no canvas the bar says
// `written on an ipad`; with one the tools are a second row of it, over a
// PDF's pages too. A clip of a sheet is drawn in a note as its paper and its
// ink (`bookPdf.ts`). What `written.ts` does to the file is the format's
// (`written.test.ts`): here it is stood in for, over the app's index.
// Milestone 85: `more` has `all pages`, the pages as a PDF, a page added
// after the one in view and that one made again; the bar has the pages'
// overview (`PageTools.tsx`, drawn over the pages) and, with the tools
// tucked away, the button that brings them back; a page's writing is asked
// for as fine as the screen shows it; the paper is the notebook's page setup
// (`page setup` in `more`: its ruling, a margin, A4 or on its side, or its
// sheets run on as one with nothing between them).
// Milestone 87: on an iPad a notebook's pages are not this page's but one
// surface of the system's own (`surface.ts`), laid over the place the pages
// would be: the lens says where it lies and what it holds (its sheets by
// their numbers, the paper, the passages' boxes), gives a sheet its strokes
// when the surface wants them, asks it to go to a page or a zoom, and hears
// what it says. The surface is stood in for here by what was asked of it. A
// Mac's and a phone's notebook, and a PDF's pages anywhere, are as before.

import { act, createElement } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { parseBoxes, type PaperKind } from '../../format/index.js';
import { Vault, storeFs, type InkStroke, type StoreFs } from '../../vault/index.js';
import { memDrawing, memPagePicture, memSplit, memStore } from '../../vault/mem-store.js';
import { passageMarksOf } from '../../pdf/index.js';
import { emptyPanes, openTab } from '../panes.js';
import { GRID_INSET, LINE_COLORS, MARGIN_AT, MARGIN_COLORS, PAPER_COLORS, PAPER_DOT, PAPER_MARGIN, PAPER_RULE, PAPER_WHITE, RULED_INSET, RUN_ALLOW, drawPaper, isDarkColor, newInsets, paperLines, paperLook, paperOf, paperPaths, ruleWidth, runLength, sheetSize, turned } from '../paper.js';
import { useApp, type DocInfo } from '../store.js';
import { paperArgs, type SurfaceSpec } from '../surface.js';

const ROOT = '/collections/paper';
const NB = 'notes/lecture.md';
const TYPED = 'notes/typed.md';
const PDF = 'library/alone.pdf';
const ID = '5b0c7e1a9d3f4e26b8a1c0d2e4f60718';
const W = 612;
const H = 792;
const GAP = 18;
const stroke = (n: number): InkStroke => ({ stroke: `s${n}`, at: 1000 + n, data: btoa(`stroke ${n}`) });
const b64 = (bytes: Uint8Array): string => btoa(String.fromCharCode(...bytes));
const nbText = (sheets: number[], paper = 'ruled') => ['---', `written: ${ID}`, `paper: ${paper}`, `sheets: ${sheets.join(' ')}`, '---', ''].join('\n');

let vault: Vault;
let fs: StoreFs;

const scenes: { hosts: { id: string; sheets: { id: string; frame: { y: number; h: number }; hit?: { y: number; h: number } }[] }[] }[] = [];
let drawn: InkStroke[] | null = null;
/** What else the canvases were asked: to take a stroke back, to stretch with the pages, to hold a sheet's strokes; and a notebook's surface, to go somewhere. */
const asks: { cmd: string; args: Record<string, unknown> }[] = [];
/** What a notebook's surface was told (87): where it lies and what it holds, or its name alone when it goes. */
const told: (SurfaceSpec | { id: string })[] = [];
vi.mock('@tauri-apps/api/core', () => ({
  invoke: async (cmd: string, args: Record<string, unknown>) => {
    if (cmd === 'ink_undo' || cmd === 'ink_redo' || cmd === 'ink_pinch') { asks.push({ cmd, args }); return cmd === 'ink_pinch' ? null : { undo: false, redo: false }; }
    if (cmd === 'ink_scene') { scenes.push(args.scene as (typeof scenes)[number]); return null; }
    if (cmd === 'ink_surface') { told.push(args.surface as SurfaceSpec); return null; }
    if (cmd === 'ink_surface_do') { asks.push({ cmd, args }); return null; }
    if (cmd === 'ink_fill') { asks.push({ cmd, args }); return { took: true }; }
    // (whether the page's process was taken from under it in this run of the app: the app's to say)
    if (cmd === 'page_fell') return pageFell;
    // (a stroke as the page draws it: an outline of its own, named by the store)
    if (cmd === 'ink_shapes') return JSON.stringify((args.strokes as string[]).map((_, i) => ({ n: `shape${i}`, k: 'p', d: 'M0 0L1 1L1 0z', c: '#1c1c1e' })));
    if (cmd === 'ink_take') { const d = drawn; drawn = null; return { strokes: d?.length ?? 0, drawing: d ? b64(memDrawing(d)) : null }; }
    if (cmd === 'ink_split') return memSplit(Uint8Array.from(atob(args.drawing as string), (c) => c.charCodeAt(0)));
    return null;
  },
}));
vi.mock('../vault.js', async (orig) => {
  const real = await orig<typeof import('../vault.js')>();
  return { ...real, currentVault: () => vault };
});
vi.mock('../crdt.js', () => ({ crdtWrote: () => {} }));
/** How often a PDF was asked for; and what asking for one fails with, when it is to fail. */
let acquired = 0;
let failWith: Error | null = null;
/** What the app says of the page's process having been taken from under it. */
let pageFell = false;
const pdfPage = { getViewport: ({ scale }: { scale: number }) => ({ width: W * scale, height: H * scale }), render: () => ({ promise: Promise.resolve() }), streamTextContent: () => null };
vi.mock('../bookPdf.js', () => ({
  fillCrops: () => {},
  acquirePdf: () => { acquired += 1; const promise = failWith ? Promise.reject(failWith) : Promise.resolve({ numPages: 2, getPage: async () => pdfPage }); promise.catch(() => {}); return { promise, release() {} }; },
  itemsOf: async () => [],
}));
vi.mock('../pdfjs.js', () => ({ TextLayer: class { render() { return Promise.resolve(); } }, pageBits: async () => [{ str: 'text' }], loadPdf: () => { throw new Error('no pdf.js here'); } }));
// the tools' row is the bar's (`ink-bar.test.ts`): here it is only where it is mounted
vi.mock('../InkBar.js', () => ({
  InkBar: ({ id }: { id: string }) => createElement('div', { className: 'inkbar', 'data-for': id }),
  // (the real one shows itself only while the row is tucked away)
  InkToggle: () => createElement('button', { type: 'button', className: 'pt-btn', 'data-tool': 'ink-tools' }),
}));
/** What the lens asked of the notebook's file, stood in for over the index. */
const asked = { addSheet: 0, removed: [] as number[], addWritten: [] as string[], after: [] as number[], again: [] as number[], setup: [] as unknown[] };
vi.mock('../written.js', async (orig) => {
  const real = await orig<typeof import('../written.js')>();
  type Written = NonNullable<DocInfo['written']>;
  const change = (path: string, to: (w: Written) => Written) => useApp.setState((s) => ({ docs: { ...s.docs, [path]: { ...s.docs[path]!, written: to(s.docs[path]!.written!) } } }));
  return {
    ...real,
    addSheet: async (path: string) => { asked.addSheet += 1; let n = 0; change(path, (w) => { n = Math.max(0, ...w.sheets) + 1; return { ...w, sheets: [...w.sheets, n] }; }); return n; },
    removeSheet: async (path: string, sheet: number) => {
      asked.removed.push(sheet);
      const was = useApp.getState().docs[path]!.written!;
      const ink = await fs.pageInk(was.id, sheet);
      await fs.setPageInk(was.id, sheet, []);
      change(path, (w) => ({ ...w, sheets: w.sheets.filter((x) => x !== sheet) }));
      return async () => { await fs.setPageInk(was.id, sheet, ink); change(path, () => was); };
    },
    setPaper: async (path: string, paper: PaperKind) => { change(path, (w) => ({ ...w, paper })); },
    setSetup: async (path: string, change_: Partial<import('../written.js').Setup> | ((now: import('../written.js').Setup) => Partial<import('../written.js').Setup>)) => {
      change(path, (w) => {
        const to = typeof change_ === 'function' ? change_(real.setupOf(w)) : change_;
        asked.setup.push(to);
        const next = { ...real.setupOf(w), ...to };
        const out: Written = { id: w.id, sheets: w.sheets, paper: next.paper };
        if (next.rule !== null) out.rule = next.rule;
        if (next.margin !== null) out.margin = next.margin;
        if (next.marginRight !== null) out.marginRight = next.marginRight;
        if (next.left) out.left = next.left;
        if (next.right) out.right = next.right;
        if (next.marginLine) out.marginLine = next.marginLine;
        if (next.marginColor) out.marginColor = next.marginColor;
        if (next.top !== null) out.top = next.top;
        if (next.bottom !== null) out.bottom = next.bottom;
        if (next.size) out.size = next.size;
        if (next.turn) out.turn = next.turn;
        if (next.pageless) out.pageless = true;
        return out;
      });
    },
    keepSetup: () => {},
    addSheetAfter: async (path: string, after: number) => { asked.after.push(after); let n = 0; change(path, (w) => { n = real.nextSheet(w.sheets); return { ...w, sheets: real.sheetsWith(w.sheets, n, after) }; }); return n; },
    duplicateSheet: async (path: string, sheet: number) => {
      asked.again.push(sheet);
      let n = 0;
      change(path, (w) => { n = real.nextSheet(w.sheets); return { ...w, sheets: real.sheetsWith(w.sheets, n, sheet) }; });
      await fs.setPageInk(useApp.getState().docs[path]!.written!.id, n, await fs.pageInk(useApp.getState().docs[path]!.written!.id, sheet));
      return n;
    },
    addWritten: async (id: string) => { asked.addWritten.push(id); return null; },
  };
});
const { Pdf } = await import('../Pdf.js');
const { undoNotice } = await import('../land.js');
const { keepPassage } = await import('../passages.js');
const { loadMarks, heldMarks } = await import('../book.js');
const { useInkTools } = await import('../inkTools.js');
(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
globalThis.ResizeObserver ??= class { observe() {} unobserve() {} disconnect() {} } as unknown as typeof ResizeObserver;
globalThis.IntersectionObserver ??= class { observe() {} unobserve() {} disconnect() {} } as unknown as typeof IntersectionObserver;
Element.prototype.scrollIntoView ??= function () {};
Element.prototype.scrollTo ??= function () {};
const pictures = new Map<string, string>();
let urls = 0;
URL.createObjectURL = ((b: Blob) => { const u = `blob:ink/${++urls}`; void b.text().then((t) => pictures.set(u, t)); return u; }) as typeof URL.createObjectURL;
URL.revokeObjectURL = () => {};
const rectOf = HTMLElement.prototype.getBoundingClientRect;
HTMLElement.prototype.getBoundingClientRect = function (this: HTMLElement) {
  if (this.classList.contains('pdf-page')) return new DOMRect(0, (Number(this.dataset.page) - 1) * (H + GAP), W, H);
  if (this.classList.contains('book-pages')) return new DOMRect(0, 0, W, 900);
  // where a notebook's surface lies on an iPad: under the bar
  if (this.classList.contains('note-surface')) return new DOMRect(0, 60, 700, 840);
  return rectOf.call(this);
};
HTMLElement.prototype.getClientRects = function (this: HTMLElement) { return [this.getBoundingClientRect()] as unknown as DOMRectList; };
/** The pane's width as the lens measures it (`.reader-wrap`'s); 0, as jsdom has it, draws a page a pixel to the point whatever the zoom. */
const pane = 0;
Object.defineProperty(HTMLElement.prototype, 'clientWidth', { configurable: true, get(this: HTMLElement) { return this.classList.contains('reader-wrap') ? pane : this.classList.contains('note-surface') ? 700 : 0; } });
Object.defineProperty(HTMLElement.prototype, 'clientHeight', { configurable: true, get(this: HTMLElement) { return this.classList.contains('note-surface') ? 840 : 0; } });

let host: HTMLDivElement;
let root: Root | null = null;
const wait = (ms: number) => act(async () => { await new Promise((r) => setTimeout(r, ms)); });
const q = <T extends Element>(sel: string) => host.querySelector<T>(sel);
const qa = <T extends Element>(sel: string) => Array.from(host.querySelectorAll<T>(sel));
const fire = async (target: EventTarget, e: Event) => { await act(async () => { target.dispatchEvent(e); }); return e; };
const click = (el: Element) => fire(el, new MouseEvent('click', { bubbles: true, cancelable: true, button: 0 }));
const key = (k: string) => fire(window, new KeyboardEvent('keydown', { key: k, bubbles: true, cancelable: true }));
const ptr = (type: string, x: number, y: number) => new PointerEvent(type, { bubbles: true, cancelable: true, pointerId: 3, pointerType: 'mouse', isPrimary: true, button: 0, clientX: x, clientY: y });
const pageEl = (n: number) => q<HTMLElement>(`.pdf-page[data-page="${n}"]`)!;
/** How a page's paper is drawn here: a pixel to the point (the pane is 0 wide, the screen's ratio 1), its rules a pixel wide, so each is moved half a pixel to cover a whole one (86). */
const ON = { px: 1, w: ruleWidth(1) };
const top = (n: number) => (n - 1) * (H + GAP);
/** A box dragged by the mouse on the page at place `n`. */
const box = async (n: number) => {
  await fire(pageEl(n), ptr('pointerdown', 61.2, top(n) + 79.2));
  await fire(window, ptr('pointermove', 200, top(n) + 200));
  await fire(window, ptr('pointerup', 61.2 + 306, top(n) + 79.2 + 237.6));
};
const places = () => qa<HTMLElement>('.pdf-page').map((p) => Number(p.dataset.page));
const sheetsShown = () => qa<HTMLElement>('.pdf-page').map((p) => Number(p.dataset.sheet));
const menuRows = () => Array.from(document.querySelectorAll<HTMLElement>('.pop-menu .ci'));
const menuRow = (act: string) => document.querySelector<HTMLElement>(`.pop-menu .ci[data-act="${act}"]`);
const more = () => q<HTMLButtonElement>('.meta [data-tool="more"]')!;
const written = () => useApp.getState().docs[NB]!.written!;
const pencil = (e: Record<string, unknown>) => act(async () => { (window as unknown as { __ink(e: unknown): void }).__ink(e); });
const sheetId = (n: number) => `p.${ID}.${n}`;
const marksNow = async () => { await loadMarks(ID); return passageMarksOf(heldMarks().get(ID) ?? {}).map(([, m]) => m.boxes); };

const docsWith = (sheets: number[], paper: PaperKind = 'ruled'): Record<string, DocInfo> => ({
  [NB]: { type: 'note', frozen: false, cards: 0, due: 0, pdf: NB, written: { id: ID, paper, sheets }, note: TYPED, notes: [TYPED] },
  [TYPED]: { type: 'note', frozen: false, cards: 0, due: 0, of: NB },
  [PDF]: { type: 'source', frozen: false, cards: 0, due: 0, pdf: PDF },
});
const mount = async (id: string, sheets = [1, 2, 3], paper: PaperKind = 'ruled', mobile = false, phone = false) => {
  useApp.setState({ docs: docsWith(sheets, paper), mobile, phone, panes: openTab(emptyPanes(), id), notice: null, bookZooms: {} });
  host = document.body.appendChild(document.createElement('div'));
  root = createRoot(host);
  await act(async () => { root!.render(createElement(Pdf, { id })); });
  await wait(40);
};

beforeAll(async () => {
  fs = storeFs(memStore(), ROOT);
  await fs.mkdir(`${ROOT}/notes`);
  await fs.mkdir(`${ROOT}/library`);
  await fs.writeText(`${ROOT}/${NB}`, nbText([1, 2, 3]));
  await fs.writeText(`${ROOT}/${TYPED}`, ['---', 'type: note', 'pdf: lecture.md', '---', '', 'Typed.', ''].join('\n'));
  await fs.writeBytes(`${ROOT}/${PDF}`, new Uint8Array([0x25, 0x50, 0x44, 0x46]));
  vault = await Vault.open(fs, ROOT);
  useApp.setState({ vault: ROOT, tree: vault.tree, files: vault.documents(), inlineBoxes: {}, bookFocus: null, reveal: null });
});
beforeEach(async () => {
  scenes.length = 0;
  drawn = null;
  acquired = 0;
  asked.addSheet = 0;
  asked.removed.length = 0;
  asked.addWritten.length = 0;
  asked.after.length = 0;
  asked.again.length = 0;
  asks.length = 0;
  told.length = 0;
  asked.setup.length = 0;
  useInkTools.setState((t) => ({ kept: { ...t.kept, shown: true } }));
  for (const n of [1, 2, 3, 4, 5]) await fs.setPageInk(ID, n, []);
});
afterEach(() => {
  act(() => root?.unmount());
  root = null;
  host?.remove();
  document.querySelector('.pop-menu')?.remove();
});

describe('the paper', () => {
  it('ruled is a line every 24 points from an inch down, a grid 20-point squares, dots their corners, blank nothing', () => {
    const ruled = paperLines('ruled');
    expect(ruled.rows[0]).toBe(72);
    expect(ruled.rows[1]! - ruled.rows[0]!).toBe(24);
    expect(ruled.rows.at(-1)).toBe(768);
    expect(ruled.cols).toEqual([]);
    // (each from edge to edge: a paper by its kind alone has no margins)
    expect([ruled.rowSpan, ruled.margins, ruled.dots]).toEqual([[0, 612], [], null]);
    const grid = paperLines('grid');
    expect([grid.rows[0], grid.rows[1], grid.rows.at(-1), grid.rows.length]).toEqual([6, 26, 786, 40]);
    expect([grid.cols[0], grid.cols.at(-1), grid.cols.length]).toEqual([6, 606, 31]);
    expect([grid.rowSpan, grid.colSpan]).toEqual([[0, 612], [0, 792]]);
    const dots = paperLines('dotted').dots!;
    expect([dots.xs[0], dots.xs.at(-1), dots.ys[0], dots.ys.at(-1)]).toEqual([26, 586, 26, 766]);
    expect(paperLines('dotted')).toMatchObject({ rows: [], cols: [], margins: [] });
    expect(paperLines('blank')).toEqual({ rows: [], rowSpan: [0, 612], cols: [], colSpan: [0, 792], margins: [], dots: null });
    // as paths of an SVG in points: the rules across the sheet, the dots a dashed row each
    expect(paperPaths('ruled').rules.startsWith('M0 72H612M0 96H612')).toBe(true);
    expect(paperPaths('ruled').dots).toBe('');
    expect(paperPaths('grid').rules).toContain('M6 0V792');
    expect(paperPaths('dotted')).toMatchObject({ rules: '', pitch: 20 });
    expect(paperPaths('dotted').dots.startsWith('M26 26H586')).toBe(true);
    expect(paperPaths('blank')).toMatchObject({ rules: '', dots: '' });
  });

  it('a rule is half a point wide in the screen\'s pixels, a whole number of them and never under one', () => {
    expect([0.5, 1, 2, 2.4836, 2.9].map(ruleWidth)).toEqual([1, 1, 1, 1, 1]);
    expect([3, 4, 4.9672, 5, 6, 7.4508].map(ruleWidth)).toEqual([2, 2, 2, 3, 3, 4]);
  });

  it('on a page its rules lie on the screen\'s pixels: each moved by under half of one to where its edges fall between two; told nothing of the screen it is as the sheet has it', () => {
    /** Every number of a path's `M`s: a rule's `y`, a grid line's `x`. */
    const ys = (d: string) => [...d.matchAll(/M0 ([\d.]+)H/g)].map((m) => Number(m[1]));
    const xs = (d: string) => [...d.matchAll(/M([\d.]+) 0V/g)].map((m) => Number(m[1]));
    const whole = (v: number) => Math.abs(v - Math.round(v)) < 1e-3;
    // an iPad Pro 13 at fit: 2.4836 pixels to the point, a rule one of them wide
    const px = 2.4836;
    for (const [paper, w] of [['ruled', 1], ['grid', 1], [paperOf({ paper: 'ruled', rule: 25, margin: 90, pageless: true }, 1), 1], ['grid', 2], ['ruled', 3]] as const) {
      const was = paperPaths(paper);
      const on = paperPaths(paper, { px, w });
      const [a, b] = [[...ys(was.rules), ...xs(was.rules), ...xs(was.margin)], [...ys(on.rules), ...xs(on.rules), ...xs(on.margin)]];
      expect(b.length).toBe(a.length);
      expect(b.length).toBeGreaterThan(20);
      for (const [i, v] of b.entries()) {
        // both its edges on whole pixels
        expect(whole(v * px - w / 2)).toBe(true);
        expect(whole(v * px + w / 2)).toBe(true);
        expect(Math.abs(v - a[i]!) * px).toBeLessThanOrEqual(0.5 + 1e-3);
      }
      // the sheet and the lines' far ends are as they were
      expect([on.w, on.h, on.pitch, on.width]).toEqual([was.w, was.h, was.pitch, was.width]);
      expect(on.rules.replace(/[\d.]+/g, '#')).toBe(was.rules.replace(/[\d.]+/g, '#'));
    }
    expect(paperPaths('ruled', { px, w: 1 }).rules.startsWith('M0 71.8715H612M0 96.03H612')).toBe(true);
    // a pixel to the point: half a pixel on; two to the point, a rule one wide: a quarter of a point
    expect(paperPaths('ruled', { px: 1, w: 1 }).rules.startsWith('M0 72.5H612M0 96.5H612')).toBe(true);
    expect(paperPaths('ruled', { px: 2, w: 1 }).rules.startsWith('M0 72.25H612M0 96.25H612')).toBe(true);
    // a rule two pixels wide stands on a whole one
    expect(paperPaths('ruled', { px: 4, w: 2 }).rules.startsWith('M0 72H612M0 96H612')).toBe(true);
    expect(paperPaths(paperOf({ paper: 'ruled', margin: 90 }), { px: 1, w: 1 }).margin).toBe('M90.5 0V792');
    // dots are not rules: where they were
    expect(paperPaths('dotted', { px, w: 1 })).toEqual(paperPaths('dotted'));
    // with nothing said of the screen, or nothing that is one: the sheet's own
    for (const kind of ['blank', 'ruled', 'grid', 'dotted'] as const) {
      expect(paperPaths(kind, undefined)).toEqual(paperPaths(kind));
      expect(paperPaths(kind, { px: 0, w: 1 })).toEqual(paperPaths(kind));
    }
    expect(paperPaths('ruled').rules.startsWith('M0 72H612M0 96H612')).toBe(true);
  });

  it('is drawn onto a canvas for a clip: white, then the part of its rules the clip holds, a pixel each', () => {
    const rects: [string, number, number, number, number][] = [];
    let arcs = 0;
    const ctx = { fillStyle: '', fillRect(x: number, y: number, w: number, h: number) { rects.push([this.fillStyle, x, y, w, h]); }, beginPath() {}, arc() { arcs += 1; }, fill() {} };
    drawPaper(ctx as unknown as CanvasRenderingContext2D, 'ruled', { x: 50, y: 60, w: 200, h: 100 }, 2);
    expect(rects[0]).toEqual([PAPER_WHITE, 0, 0, 400, 200]);
    // the rules at 72, 96, 120 and 144 points, two pixels to the point from 60
    expect(rects.slice(1)).toEqual([24, 72, 120, 168].map((y) => [PAPER_RULE, 0, y, 400, 1]));
    rects.length = 0;
    drawPaper(ctx as unknown as CanvasRenderingContext2D, 'dotted', { x: 0, y: 0, w: 60, h: 60 }, 1);
    expect(rects).toEqual([[PAPER_WHITE, 0, 0, 60, 60]]);
    expect(arcs).toBe(4);
    // (the dots are the last thing drawn: with no margin line, nothing is asked for in its colour)
    expect(ctx.fillStyle).toBe(PAPER_DOT);
    // off the sheet's edge nothing is painted
    rects.length = 0;
    drawPaper(ctx as unknown as CanvasRenderingContext2D, 'blank', { x: -4, y: -4, w: 104, h: 104 }, 1);
    expect(rects).toEqual([[PAPER_WHITE, 4, 4, 100, 100]]);
  });
});

describe('the colours a sheet is drawn with', () => {
  const DARK = { paper: '#141414', rule: '#353f4b', dot: '#485462', margin: '#653f3f', dark: true };
  const LIGHT = { paper: PAPER_WHITE, rule: PAPER_RULE, dot: PAPER_DOT, margin: PAPER_MARGIN, dark: false };
  const EINK = { paper: '#ffffff', rule: '#8f8f8f', dot: '#8f8f8f', margin: '#c9c9c9', dark: false };

  it('with none chosen the paper follows the theme: white, dark as a dark theme turns a page, grey rules on e-ink', () => {
    for (const none of [null, undefined, {}, { color: null, line: null }, paperOf({ paper: 'ruled' }), { color: 'cream', line: '#fff' }]) {
      expect(paperLook(none, 'light')).toEqual(LIGHT);
      expect(paperLook(none, 'dark')).toEqual(DARK);
      expect(paperLook(none, 'eink')).toEqual(EINK);
    }
    // the dark ones are what `invert(0.92) hue-rotate(180deg)` makes of the light ones
    expect([PAPER_WHITE, PAPER_RULE, PAPER_DOT, PAPER_MARGIN].map(turned)).toEqual([DARK.paper, DARK.rule, DARK.dot, DARK.margin]);
    expect([turned('#000000'), turned('#1c1c1e'), turned('not a colour')]).toEqual(['#ebebeb', '#d3d3d5', '#141414']);
  });

  it('a chosen paper colour is the paper in every theme, with its ruling as it reads on it', () => {
    for (const theme of ['light', 'dark', 'eink'] as const) {
      expect(paperLook({ color: '#fbf6e9' }, theme)).toEqual({ ...LIGHT, paper: '#fbf6e9' });
      expect(paperLook({ color: '#1c1c1e', line: null }, theme)).toEqual({ ...DARK, paper: '#1c1c1e' });
      // with a line chosen too, both are as chosen
      expect(paperLook({ color: '#fbf6e9', line: '#f0c2c2' }, theme)).toEqual({ ...LIGHT, paper: '#fbf6e9', rule: '#f0c2c2', dot: '#f0c2c2' });
      expect(paperLook({ color: '#1c1c1e', line: '#f0c2c2' }, theme)).toEqual({ ...DARK, paper: '#1c1c1e', rule: '#f0c2c2', dot: '#f0c2c2' });
      expect(paperLook({ color: '#FBF6E9' }, theme).paper).toBe('#fbf6e9');
    }
    expect(paperLook(paperOf({ paper: 'grid', color: '#fbf6e9', line: '#bcdcc0' }), 'dark')).toEqual({ ...LIGHT, paper: '#fbf6e9', rule: '#bcdcc0', dot: '#bcdcc0' });
  });

  it('a chosen line colour on paper that follows the theme is as chosen where that is light, and turned with the paper where it is dark', () => {
    expect(paperLook({ line: '#f0c2c2' }, 'light')).toEqual({ ...LIGHT, rule: '#f0c2c2', dot: '#f0c2c2' });
    expect(paperLook({ line: '#f0c2c2' }, 'eink')).toEqual({ ...EINK, rule: '#f0c2c2', dot: '#f0c2c2' });
    expect(paperLook({ line: '#f0c2c2' }, 'dark')).toEqual({ ...DARK, rule: turned('#f0c2c2'), dot: turned('#f0c2c2') });
    expect(isDarkColor(turned('#f0c2c2'))).toBe(true);
    // the paper's own, chosen, is what the dark paper has anyway
    expect(paperLook({ line: PAPER_RULE }, 'dark').rule).toBe(DARK.rule);
  });

  it('a margin line is a pale red unless a colour is chosen for it: as chosen on chosen paper and where the theme is light, turned with paper that follows a dark theme', () => {
    expect(paperLook({ marginColor: '#b5d2f2' }, 'light')).toEqual({ ...LIGHT, margin: '#b5d2f2' });
    expect(paperLook({ marginColor: '#b5d2f2' }, 'eink')).toEqual({ ...EINK, margin: '#b5d2f2' });
    expect(paperLook({ marginColor: '#b5d2f2' }, 'dark')).toEqual({ ...DARK, margin: turned('#b5d2f2') });
    expect(isDarkColor(turned('#b5d2f2'))).toBe(true);
    // the pale red itself, chosen, is what the dark paper has anyway
    expect(paperLook({ marginColor: PAPER_MARGIN }, 'dark').margin).toBe(DARK.margin);
    for (const theme of ['light', 'dark', 'eink'] as const) {
      // on paper of a chosen colour, light or dark, it is as chosen in every theme
      expect(paperLook({ color: '#fbf6e9', marginColor: '#b5d2f2' }, theme)).toEqual({ ...LIGHT, paper: '#fbf6e9', margin: '#b5d2f2' });
      expect(paperLook({ color: '#1c1c1e', marginColor: '#b5d2f2' }, theme)).toEqual({ ...DARK, paper: '#1c1c1e', margin: '#b5d2f2' });
      // with none chosen, chosen paper's is the pale red as it reads on it
      expect(paperLook({ color: '#fbf6e9', marginColor: null }, theme).margin).toBe(PAPER_MARGIN);
      expect(paperLook({ color: '#1c1c1e' }, theme).margin).toBe(DARK.margin);
    }
    // it is the margin line's alone, and the ruling's colour is not its
    expect(paperLook({ line: '#f0c2c2', marginColor: '#bcdcc0' }, 'light')).toEqual({ ...LIGHT, rule: '#f0c2c2', dot: '#f0c2c2', margin: '#bcdcc0' });
    expect(paperLook({ line: '#f0c2c2' }, 'light').margin).toBe(PAPER_MARGIN);
    // in capitals it is the colour; what is no colour is none chosen
    expect(paperLook({ marginColor: '#B5D2F2' }, 'light').margin).toBe('#b5d2f2');
    for (const bad of ['red', '#fff', '', undefined]) expect(paperLook({ marginColor: bad }, 'light'), String(bad)).toEqual(LIGHT);
    // as a notebook's page setup says it
    expect(paperOf({ paper: 'ruled', marginColor: '#B5D2F2' }).marginColor).toBe('#b5d2f2');
    expect(paperOf({ paper: 'ruled', marginColor: 'red' }).marginColor).toBeNull();
    expect(paperLook(paperOf({ paper: 'ruled', left: 34.02, marginLine: 'left', marginColor: '#b5d2f2' }), 'dark')).toEqual({ ...DARK, margin: turned('#b5d2f2') });
  });

  it('the margin line\'s colours offered by name: four after the pale red it has, each one of the ruling\'s', () => {
    expect(MARGIN_COLORS.map((c) => c.name)).toEqual(['blue-grey', 'grey', 'blue', 'green']);
    expect(MARGIN_COLORS.map((c) => c.value)).toEqual([PAPER_RULE, '#c9cdd2', '#b5d2f2', '#bcdcc0']);
    for (const c of MARGIN_COLORS) expect(LINE_COLORS, c.name).toContainEqual(c);
    // (red is what it has with none chosen: not offered again)
    expect(MARGIN_COLORS.some((c) => c.name === 'red' || c.value === PAPER_MARGIN)).toBe(false);
  });

  it('a colour is dark when its relative luminance is under 0.4: ink on it is drawn the dark way', () => {
    expect(['#000000', '#141414', '#1c1c1e', '#555555', '#0000ff', '#ff0000', '#808080', '#aaaaaa'].map(isDarkColor)).toEqual([true, true, true, true, true, true, true, false]);
    expect(['#ffffff', '#fbf6e9', '#fff6c8', '#eceef0', '#00ff00', '#ffff00', '#b0b0b0'].map(isDarkColor)).toEqual([false, false, false, false, false, false, false]);
    // (0.4 falls between these two greys)
    expect([isDarkColor('#a9a9a9'), isDarkColor('#ababab')]).toEqual([true, false]);
    expect([isDarkColor('black'), isDarkColor(''), isDarkColor('#1C1C1E')]).toEqual([false, false, true]);
  });

  it('the colours offered by name: five papers, five lines, the first line the paper\'s own', () => {
    expect(PAPER_COLORS.map((c) => c.name)).toEqual(['white', 'cream', 'yellow', 'grey', 'dark']);
    expect(LINE_COLORS.map((c) => c.name)).toEqual(['blue-grey', 'grey', 'blue', 'red', 'green']);
    expect([PAPER_COLORS[0]!.value, PAPER_COLORS[4]!.value, LINE_COLORS[0]!.value]).toEqual(['#ffffff', '#1c1c1e', PAPER_RULE]);
    for (const c of [...PAPER_COLORS, ...LINE_COLORS]) expect(c.value, c.name).toMatch(/^#[0-9a-f]{6}$/);
    expect(PAPER_COLORS.map((c) => isDarkColor(c.value))).toEqual([false, false, false, false, true]);
    expect(new Set(PAPER_COLORS.map((c) => c.value)).size + new Set(LINE_COLORS.map((c) => c.value)).size).toBe(10);
  });

  it('paper drawn onto a canvas is drawn with the colours it is given; with none, its own in the light theme', () => {
    const rects: [string, number, number, number, number][] = [];
    const ctx = { fillStyle: '', fillRect(x: number, y: number, w: number, h: number) { rects.push([this.fillStyle, x, y, w, h]); }, beginPath() {}, arc() {}, fill() {} };
    const spec = paperOf({ paper: 'ruled', margin: 90 });
    const part = { x: 50, y: 60, w: 200, h: 40 };
    drawPaper(ctx as unknown as CanvasRenderingContext2D, spec, part, 1, paperLook(spec, 'dark'));
    expect(rects).toEqual([['#141414', 0, 0, 200, 40], ['#353f4b', 0, 12, 200, 1], ['#353f4b', 0, 36, 200, 1], ['#653f3f', 40, 0, 1, 40]]);
    rects.length = 0;
    const cream = paperOf({ paper: 'ruled', margin: 90, color: '#fbf6e9', line: '#bcdcc0' });
    drawPaper(ctx as unknown as CanvasRenderingContext2D, cream, part, 1);
    expect(rects.map((r) => r[0])).toEqual(['#fbf6e9', '#bcdcc0', '#bcdcc0', PAPER_MARGIN]);
    rects.length = 0;
    drawPaper(ctx as unknown as CanvasRenderingContext2D, cream, part, 1, paperLook(cream, 'dark'));
    expect(rects.map((r) => r[0])).toEqual(['#fbf6e9', '#bcdcc0', '#bcdcc0', PAPER_MARGIN]);
    const dotted: string[] = [];
    const dots = { ...ctx, fill(this: { fillStyle: string }) { dotted.push(this.fillStyle); } };
    drawPaper(dots as unknown as CanvasRenderingContext2D, paperOf({ paper: 'dotted', line: '#f0c2c2' }), { x: 0, y: 0, w: 60, h: 60 }, 1, paperLook({ line: '#f0c2c2' }, 'eink'));
    expect(dotted).toEqual(['#f0c2c2', '#f0c2c2', '#f0c2c2', '#f0c2c2']);
    expect(paperOf({ paper: 'ruled', color: '#FBF6E9', line: 'red' })).toMatchObject({ color: '#fbf6e9', line: null });
  });
});

describe('the paper as a notebook\'s page setup says it', () => {
  it('a sheet is Letter upright unless it says A4, or on its side', () => {
    expect(sheetSize(undefined)).toEqual({ w: 612, h: 792 });
    expect(sheetSize({})).toEqual({ w: 612, h: 792 });
    expect(sheetSize({ size: 'a4' })).toEqual({ w: 595, h: 842 });
    expect(sheetSize({ turn: 'landscape' })).toEqual({ w: 792, h: 612 });
    expect(sheetSize({ size: 'a4', turn: 'landscape' })).toEqual({ w: 842, h: 595 });
  });

  it('with nothing said it is the paper a new notebook has; what is said stands in for that', () => {
    expect(paperOf({ paper: 'ruled' })).toEqual({ kind: 'ruled', w: 612, h: 792, rule: 24, left: 0, right: 0, top: 72, bottom: 24, lines: [], run: false, at: 0, color: null, line: null, marginColor: null });
    expect(paperOf({ paper: 'grid' })).toMatchObject({ kind: 'grid', rule: 20, left: 0, right: 0, top: 0, bottom: 0, lines: [] });
    expect(paperOf({ paper: 'dotted' }).rule).toBe(20);
    for (const kind of ['blank', 'ruled', 'grid', 'dotted'] as const) {
      expect(paperLines(paperOf({ paper: kind }))).toEqual(paperLines(kind));
      expect(paperPaths(paperOf({ paper: kind }))).toEqual(paperPaths(kind));
    }
    expect(paperOf({ paper: 'ruled', rule: 30, margin: 90, top: 100, size: 'a4', turn: 'landscape' })).toEqual({ kind: 'ruled', w: 842, h: 595, rule: 30, left: 0, right: 0, top: 100, bottom: 30, lines: [90], run: false, at: 0, color: null, line: null, marginColor: null });
    // 85's margin rule, at the left or the right, is a line where it says and no margin
    expect(paperOf({ paper: 'ruled', margin: 90, marginRight: 72, bottom: 40 })).toMatchObject({ lines: [90, 540], left: 0, right: 0, bottom: 40 });
    // on any paper; the room at the foot is a ruled sheet's, a grid's and dots', not blank paper's
    for (const paper of ['blank', 'grid', 'dotted'] as const) expect(paperOf({ paper, margin: 90, marginRight: 72, bottom: 40 }), paper).toMatchObject({ kind: paper, lines: [90, 540], left: 0, right: 0, top: 0, bottom: paper === 'blank' ? 0 : 40 });
    expect(paperOf({ paper: 'ruled', bottom: 0 }).bottom).toBe(0);
    // sheets that run on as one: each begins where the one before ended
    expect([0, 1, 2].map((i) => paperOf({ paper: 'ruled', pageless: true }, i))).toMatchObject([{ run: true, at: 0 }, { run: true, at: 792 }, { run: true, at: 1584 }]);
    expect(paperOf({ paper: 'ruled', pageless: true, size: 'a4' }, 2).at).toBe(1684);
    expect(paperOf({ paper: 'ruled' }, 2)).toMatchObject({ run: false, at: 0 });
  });

  it('the rules are as far apart as it says, from as far down as it says, with a margin rule where it says', () => {
    const lines = paperLines(paperOf({ paper: 'ruled', rule: 30, top: 100, margin: 90 }));
    expect([lines.rows[0], lines.rows[1], lines.rows.at(-1), lines.rows.length]).toEqual([100, 130, 760, 23]);
    expect(lines.margins).toEqual([90]);
    expect(lines.cols).toEqual([]);
    const paths = paperPaths(paperOf({ paper: 'ruled', rule: 30, top: 100, margin: 90 }));
    expect(paths.rules.startsWith('M0 100H612M0 130H612')).toBe(true);
    expect(paths).toMatchObject({ margin: 'M90 0V792', dots: '', w: 612, h: 792 });
    expect(paperPaths('ruled').margin).toBe('');
    // a margin off the sheet is none
    expect(paperLines(paperOf({ paper: 'ruled', margin: 700 })).margins).toEqual([]);
    expect(paperLines(paperOf({ paper: 'ruled', margin: 700, turn: 'landscape' })).margins).toEqual([700]);
  });

  it('a grid and dots are centred on the sheet whatever its size and their pitch', () => {
    const grid = paperLines(paperOf({ paper: 'grid', size: 'a4' }));
    expect([grid.cols[0], grid.cols.at(-1), grid.cols.length]).toEqual([7.5, 587.5, 30]);
    expect([grid.rows[0], grid.rows.at(-1), grid.rows.length]).toEqual([1, 841, 43]);
    const wide = paperLines(paperOf({ paper: 'grid', rule: 36 }));
    expect([wide.cols[0], wide.cols[1], wide.cols.at(-1)]).toEqual([0, 36, 612]);
    expect([wide.rows[0], wide.rows.at(-1)]).toEqual([0, 792]);
    const dots = paperLines(paperOf({ paper: 'dotted', size: 'a4', turn: 'landscape' })).dots!;
    expect([dots.xs[0], dots.xs.at(-1), dots.ys[0], dots.ys.at(-1)]).toEqual([21, 821, 27.5, 567.5]);
    expect(paperPaths(paperOf({ paper: 'dotted', rule: 30 })).pitch).toBe(30);
    expect(paperPaths(paperOf({ paper: 'grid', size: 'a4' })).rules).toContain('M7.5 0V842');
  });

  it('on sheets that run on as one the ruling carries on from the sheet before, as on one long sheet', () => {
    // the first sheet is ruled as any: from the top it says, a line's room at each line
    const first = paperLines(paperOf({ paper: 'ruled', rule: 25, pageless: true }, 0)).rows;
    expect([first[0], first[1], first.at(-1)]).toEqual([72, 97, 772]);
    // 772 and 25 are 797: five points down the second
    const second = paperLines(paperOf({ paper: 'ruled', rule: 25, pageless: true }, 1)).rows;
    expect([second[0], second[1], second.at(-1)]).toEqual([5, 30, 780]);
    const third = paperLines(paperOf({ paper: 'ruled', rule: 25, pageless: true }, 2)).rows;
    expect(third[0]).toBe(13);
    // with pages apart, every sheet is ruled alike
    expect(paperLines(paperOf({ paper: 'ruled', rule: 25 }, 1)).rows[0]).toBe(72);
    // a grid's rows and a dotted sheet's run on too; across, they are the sheet's
    const grid = paperLines(paperOf({ paper: 'grid', rule: 25, pageless: true }, 1));
    const alone = paperLines(paperOf({ paper: 'grid', rule: 25 }, 1));
    expect(grid.cols).toEqual(alone.cols);
    expect(alone.rows[0]).toBe(8.5);
    expect(grid.rows[0]).toBe(16.5);
    const dots = paperLines(paperOf({ paper: 'dotted', rule: 25, pageless: true }, 1)).dots!;
    expect(dots.ys[0]).toBe(16.5);
    expect(dots.xs).toEqual(paperLines(paperOf({ paper: 'dotted', rule: 25 }, 1)).dots!.xs);
  });

  it('across the sheets of a pageless notebook the lines are one ruling: from the last of a sheet to the first of the next is the rule, for rules, a grid and dots', () => {
    for (const sized of [{}, { size: 'a4' }] as const) {
      const size = 'size' in sized ? sized.size : 'letter';
      const h = sheetSize(sized).h;
      for (const rule of [18, 20.25, 24, 25, 28.35]) {
        for (const paper of ['ruled', 'grid', 'dotted'] as const) {
          const ys = (i: number) => { const l = paperLines(paperOf({ paper, rule, ...sized, pageless: true }, i)); return paper === 'dotted' ? l.dots!.ys : l.rows; };
          for (const i of [0, 1, 2, 3]) {
            const here = ys(i);
            const next = ys(i + 1);
            // on the sheet, evenly apart; and on over its foot
            expect(here.every((y) => y >= 0 && y < h), `${paper} ${rule} ${i}`).toBe(true);
            for (let j = 1; j < here.length; j++) expect(here[j]! - here[j - 1]!).toBeCloseTo(rule, 2);
            expect(next[0]! + h - here.at(-1)!, `${paper} ${rule} ${size} ${i}`).toBeCloseTo(rule, 2);
          }
        }
      }
    }
  });

  it('a clip of a sheet with a margin rule has it, in its own colour, a pixel wide', () => {
    const rects: [string, number, number, number, number][] = [];
    const ctx = { fillStyle: '', fillRect(x: number, y: number, w: number, h: number) { rects.push([this.fillStyle, x, y, w, h]); }, beginPath() {}, arc() {}, fill() {} };
    drawPaper(ctx as unknown as CanvasRenderingContext2D, paperOf({ paper: 'ruled', margin: 90 }), { x: 50, y: 60, w: 200, h: 100 }, 2);
    expect(rects[0]).toEqual([PAPER_WHITE, 0, 0, 400, 200]);
    expect(rects.filter((r) => r[0] === PAPER_RULE).length).toBe(4);
    expect(rects.at(-1)).toEqual([PAPER_MARGIN, 80, 0, 1, 200]);
    // a clip to the right of the margin has none
    rects.length = 0;
    drawPaper(ctx as unknown as CanvasRenderingContext2D, paperOf({ paper: 'ruled', margin: 90 }), { x: 100, y: 60, w: 200, h: 100 }, 2);
    expect(rects.some((r) => r[0] === PAPER_MARGIN)).toBe(false);
  });

  it('85\'s margin rule at the right is a line as far from the right edge as it says: told as its place from the left, on a sheet of any size', () => {
    expect(paperLines(paperOf({ paper: 'ruled', marginRight: 72 })).margins).toEqual([540]);
    expect(paperLines(paperOf({ paper: 'ruled', margin: 90, marginRight: 72 })).margins).toEqual([90, 540]);
    expect(paperLines(paperOf({ paper: 'ruled', marginRight: 72, size: 'a4' })).margins).toEqual([523]);
    expect(paperLines(paperOf({ paper: 'ruled', marginRight: 72, size: 'a4', turn: 'landscape' })).margins).toEqual([770]);
    expect(paperLines(paperOf({ paper: 'ruled', marginRight: 85.04 })).margins).toEqual([526.96]);
    // with none said there is none, on any paper
    for (const kind of ['blank', 'ruled', 'grid', 'dotted'] as const) expect(paperLines(kind).margins).toEqual([]);
    // it changes nothing of the ruling under it: the rules run the sheet's whole width
    expect(paperLines(paperOf({ paper: 'ruled', margin: 90, marginRight: 72 })).rows).toEqual(paperLines('ruled').rows);
    expect(paperLines(paperOf({ paper: 'ruled', margin: 90, marginRight: 72 })).rowSpan).toEqual([0, 612]);
    expect(paperPaths(paperOf({ paper: 'ruled', margin: 90, marginRight: 72 })).rules).toBe(paperPaths('ruled').rules);
    // both are one path, the left one first; one alone is that one
    expect(paperPaths(paperOf({ paper: 'ruled', margin: 90, marginRight: 72 })).margin).toBe('M90 0V792M540 0V792');
    expect(paperPaths(paperOf({ paper: 'ruled', marginRight: 72 })).margin).toBe('M540 0V792');
    expect(paperPaths(paperOf({ paper: 'ruled', margin: 90, marginRight: 72, size: 'a4' })).margin).toBe('M90 0V842M523 0V842');
    // on a page each lies on the screen's pixels, as a rule does
    expect(paperPaths(paperOf({ paper: 'ruled', margin: 90, marginRight: 72 }), { px: 1, w: 1 }).margin).toBe('M90.5 0V792M540.5 0V792');
  });

  it('85\'s right margin rule off the sheet, or not to the right of the left one, is none; the left one stands', () => {
    expect(paperLines(paperOf({ paper: 'ruled', marginRight: 700 })).margins).toEqual([]);
    expect(paperLines(paperOf({ paper: 'ruled', marginRight: 612 })).margins).toEqual([]);
    expect(paperLines(paperOf({ paper: 'ruled', marginRight: 700, turn: 'landscape' })).margins).toEqual([92]);
    // 300 from each edge of a Letter sheet: the right one stands 12 points to the right of the left one; of an A4 sheet, 5 to its left
    expect(paperLines(paperOf({ paper: 'ruled', margin: 300, marginRight: 300 })).margins).toEqual([300, 312]);
    expect(paperLines(paperOf({ paper: 'ruled', margin: 300, marginRight: 300, size: 'a4' })).margins).toEqual([300]);
    // on the same line as the left one
    expect(paperLines(paperOf({ paper: 'ruled', margin: 297.5, marginRight: 297.5, size: 'a4' })).margins).toEqual([297.5]);
    expect(paperPaths(paperOf({ paper: 'ruled', margin: 300, marginRight: 300, size: 'a4' })).margin).toBe('M300 0V842');
    // a left one off the sheet is none, and the right one stands alone
    expect(paperLines(paperOf({ paper: 'ruled', margin: 700, marginRight: 72 })).margins).toEqual([540]);
  });

  it('a grid, dots and blank paper have 85\'s margin rules too, over a ruling that is as it was without them', () => {
    for (const kind of ['blank', 'grid', 'dotted'] as const) {
      const with_ = paperLines(paperOf({ paper: kind, margin: 90, marginRight: 72 }));
      expect(with_, kind).toEqual({ ...paperLines(kind), margins: [90, 540] });
      const paths = paperPaths(paperOf({ paper: kind, margin: 90, marginRight: 72 }));
      expect(paths, kind).toEqual({ ...paperPaths(kind), margin: 'M90 0V792M540 0V792' });
      expect(paperPaths(kind).margin, kind).toBe('');
      expect(paperPaths(paperOf({ paper: kind, margin: 90 })).margin, kind).toBe('M90 0V792');
    }
    // on sheets that run on as one, every sheet has them
    for (const i of [0, 1, 2]) expect(paperLines(paperOf({ paper: 'dotted', margin: 90, marginRight: 72, pageless: true }, i)).margins).toEqual([90, 540]);
  });

  it('a ruled page\'s last rule leaves a rule\'s room at its foot, or as much as it says', () => {
    const last = (w: Parameters<typeof paperOf>[0]) => paperLines(paperOf(w)).rows.at(-1);
    expect(last({ paper: 'ruled' })).toBe(768);
    expect(last({ paper: 'ruled', bottom: 24 })).toBe(768);
    expect(last({ paper: 'ruled', bottom: 23.9 })).toBe(768);
    // a point more than a rule's room: one rule fewer
    expect(last({ paper: 'ruled', bottom: 25 })).toBe(744);
    expect(last({ paper: 'ruled', bottom: 100 })).toBe(672);
    expect(last({ paper: 'ruled', bottom: 300 })).toBe(480);
    // none: ruled to the foot
    expect(last({ paper: 'ruled', bottom: 0 })).toBe(792);
    expect(last({ paper: 'ruled', rule: 25, bottom: 0 })).toBe(772);
    // with nothing said it is the rule's own spacing
    expect(last({ paper: 'ruled', rule: 30 })).toBe(last({ paper: 'ruled', rule: 30, bottom: 30 }));
    expect(last({ paper: 'ruled', rule: 30, top: 100, bottom: 72 })).toBe(700);
    // the first rule and the spacing are as they were
    const rows = paperLines(paperOf({ paper: 'ruled', bottom: 100 })).rows;
    expect(rows).toEqual(paperLines('ruled').rows.slice(0, rows.length));
    expect(paperPaths(paperOf({ paper: 'ruled', bottom: 100 })).rules.endsWith('M0 672H612')).toBe(true);
    // more room than the sheet has under its first rule: no rule at all
    expect(paperLines(paperOf({ paper: 'ruled', top: 300, bottom: 300, turn: 'landscape' })).rows).toEqual([300]);
    expect(paperLines(paperOf({ paper: 'ruled', top: 300, bottom: 300, size: 'a4', turn: 'landscape' })).rows).toEqual([]);
    // blank paper has no such room, whatever is said (a grid's and dots' is theirs to keep: below)
    expect(paperLines(paperOf({ paper: 'blank', top: 100, bottom: 100 }))).toEqual(paperLines('blank'));
    // sheets that run on as one are ruled to their foot and on: the room is a page's
    for (const i of [0, 1, 2]) expect(paperLines(paperOf({ paper: 'ruled', rule: 25, bottom: 100, pageless: true }, i)).rows).toEqual(paperLines(paperOf({ paper: 'ruled', rule: 25, pageless: true }, i)).rows);
  });

  it('a clip has the margin rules it holds, each a pixel wide in the margin\'s colour, drawn over the rules and over the dots', () => {
    const rects: [string, number, number, number, number][] = [];
    const order: string[] = [];
    const ctx = { fillStyle: '', fillRect(x: number, y: number, w: number, h: number) { rects.push([this.fillStyle, x, y, w, h]); order.push('rect'); }, beginPath() {}, arc() {}, fill() { order.push('dot'); } };
    const draw = (w: Parameters<typeof paperOf>[0], part: { x: number; y: number; w: number; h: number }, k = 1) => { rects.length = 0; order.length = 0; drawPaper(ctx as unknown as CanvasRenderingContext2D, paperOf(w), part, k); return rects.filter((r) => r[0] === PAPER_MARGIN); };
    const whole = { x: 0, y: 0, w: 612, h: 792 };
    expect(draw({ paper: 'ruled', margin: 90, marginRight: 72 }, whole)).toEqual([[PAPER_MARGIN, 90, 0, 1, 792], [PAPER_MARGIN, 540, 0, 1, 792]]);
    // they are the last things drawn
    expect(rects.slice(-2).map((r) => r[0])).toEqual([PAPER_MARGIN, PAPER_MARGIN]);
    // two pixels to the point, a clip of the sheet's right half: the right one alone, where it falls in the clip
    expect(draw({ paper: 'ruled', margin: 90, marginRight: 72 }, { x: 400, y: 60, w: 200, h: 100 }, 2)).toEqual([[PAPER_MARGIN, 280, 0, 1, 200]]);
    expect(draw({ paper: 'ruled', margin: 90, marginRight: 72 }, { x: 100, y: 60, w: 200, h: 100 }, 2)).toEqual([]);
    // blank paper: the paper and its two rules, nothing else
    expect(draw({ paper: 'blank', margin: 90, marginRight: 72 }, whole).length).toBe(2);
    expect(rects.map((r) => r[0])).toEqual([PAPER_WHITE, PAPER_MARGIN, PAPER_MARGIN]);
    // a grid: its lines, then the rules
    expect(draw({ paper: 'grid', marginRight: 72 }, whole)).toEqual([[PAPER_MARGIN, 540, 0, 1, 792]]);
    expect(rects.filter((r) => r[0] === PAPER_RULE).length).toBe(40 + 31);
    expect(rects.at(-1)![0]).toBe(PAPER_MARGIN);
    // dots: every dot before the rules
    expect(draw({ paper: 'dotted', margin: 90, marginRight: 72 }, { x: 0, y: 0, w: 612, h: 60 })).toEqual([[PAPER_MARGIN, 90, 0, 1, 60], [PAPER_MARGIN, 540, 0, 1, 60]]);
    expect(order.filter((o) => o === 'dot').length).toBe(2 * 29);
    expect(order.lastIndexOf('dot')).toBeLessThan(order.length - 2);
    expect(order.slice(-2)).toEqual(['rect', 'rect']);
    // a ruled clip with room said at its foot has no rule in that room
    draw({ paper: 'ruled', bottom: 100 }, { x: 0, y: 650, w: 612, h: 142 });
    expect(rects.filter((r) => r[0] === PAPER_RULE).map((r) => r[2])).toEqual([22]);
  });
});

describe('the margins of a sheet', () => {
  /** A grid or dots with a margin of its own at each edge, on a Letter sheet: 20s between 40 and 582 across, 50 and 772 down, a point clear at each end. */
  const EDGED = { left: 40, right: 30, top: 50, bottom: 20 } as const;
  const every = (from: number, to: number, step: number) => Array.from({ length: Math.round((to - from) / step) + 1 }, (_, i) => from + i * step);

  it('a new notebook\'s: ruled paper\'s rules 12 mm in from each side, a grid and dots 8 mm clear all round, blank paper none; a line turned on stands at ruled paper\'s', () => {
    expect([RULED_INSET, GRID_INSET, MARGIN_AT]).toEqual([34.02, 22.68, 34.02]);
    expect(newInsets('ruled')).toEqual({ left: 34.02, right: 34.02, top: null, bottom: null });
    expect(newInsets('grid')).toEqual({ left: 22.68, right: 22.68, top: 22.68, bottom: 22.68 });
    expect(newInsets('dotted')).toEqual(newInsets('grid'));
    expect(newInsets('blank')).toEqual({ left: null, right: null, top: null, bottom: null });
  });

  it('are what the page setup says, each from its own edge; the head and the foot a ruled sheet\'s first rule and the room under its last, a grid\'s and dots\' room, blank paper\'s nothing', () => {
    expect(paperOf({ paper: 'ruled', left: 34.02, right: 34.02 })).toEqual({ kind: 'ruled', w: 612, h: 792, rule: 24, left: 34.02, right: 34.02, top: 72, bottom: 24, lines: [], run: false, at: 0, color: null, line: null, marginColor: null });
    expect(paperOf({ paper: 'ruled', left: 50 })).toMatchObject({ left: 50, right: 0 });
    expect(paperOf({ paper: 'ruled', right: 50 })).toMatchObject({ left: 0, right: 50 });
    expect(paperOf({ paper: 'ruled', rule: 30, left: 50, top: 100, bottom: 60 })).toMatchObject({ left: 50, right: 0, top: 100, bottom: 60 });
    // with no foot said a ruled sheet keeps a rule's room, whatever its spacing
    expect(paperOf({ paper: 'ruled', rule: 30 }).bottom).toBe(30);
    for (const paper of ['grid', 'dotted'] as const) {
      expect(paperOf({ paper, left: 22.68, right: 22.68, top: 22.68, bottom: 22.68 }), paper).toMatchObject({ kind: paper, left: 22.68, right: 22.68, top: 22.68, bottom: 22.68, lines: [] });
      expect(paperOf({ paper, top: 30 }), paper).toMatchObject({ left: 0, right: 0, top: 30, bottom: 0 });
      expect(paperOf({ paper, bottom: 30 }), paper).toMatchObject({ top: 0, bottom: 30 });
    }
    expect(paperOf({ paper: 'blank', left: 40, right: 20, top: 50, bottom: 50 })).toMatchObject({ left: 40, right: 20, top: 0, bottom: 0 });
    // a margin under none is none
    expect(paperOf({ paper: 'ruled', left: -5, right: -0.01 })).toMatchObject({ left: 0, right: 0 });
    // on every sheet of a pageless notebook alike
    for (const i of [0, 1, 2]) expect(paperOf({ paper: 'grid', ...EDGED, pageless: true }, i)).toMatchObject({ ...EDGED, run: true, at: i * 792 });
  });

  it('margins that leave no room for a rule\'s spacing between them are none, and no line is drawn at them', () => {
    // 300 at each side of a Letter sheet leaves 12 points: under a rule's 24
    expect(paperOf({ paper: 'ruled', left: 300, right: 300, marginLine: 'both' })).toMatchObject({ left: 0, right: 0, lines: [] });
    // on its side there is room
    expect(paperOf({ paper: 'ruled', left: 300, right: 300, marginLine: 'both', turn: 'landscape' })).toMatchObject({ left: 300, right: 300, lines: [300, 492] });
    // exactly a rule's spacing left is room; a hundredth under it is not
    expect(paperOf({ paper: 'ruled', left: 294, right: 294 })).toMatchObject({ left: 294, right: 294 });
    expect(paperOf({ paper: 'ruled', left: 294, right: 294.01 })).toMatchObject({ left: 0, right: 0 });
    // the spacing it says is the room it needs
    expect(paperOf({ paper: 'ruled', rule: 30, left: 294, right: 294 })).toMatchObject({ left: 0, right: 0 });
    expect(paperOf({ paper: 'grid', left: 296, right: 296 })).toMatchObject({ left: 296, right: 296 });
    expect(paperOf({ paper: 'grid', left: 296, right: 296.5 })).toMatchObject({ left: 0, right: 0 });
    // 85's margin rule beside them stands, with the rules run on under it as before
    expect(paperOf({ paper: 'ruled', left: 300, right: 300, margin: 90 })).toMatchObject({ left: 0, right: 0, lines: [90] });
    expect(paperLines(paperOf({ paper: 'ruled', left: 300, right: 300 }))).toEqual(paperLines('ruled'));
  });

  it('a line is drawn down a margin where the page setup asks for one and the sheet has that margin: told as its place from the left', () => {
    const lines = (w: Parameters<typeof paperOf>[0]) => paperOf(w).lines;
    expect(lines({ paper: 'ruled', left: 34.02, right: 34.02 })).toEqual([]);
    expect(lines({ paper: 'ruled', left: 34.02, right: 34.02, marginLine: 'left' })).toEqual([34.02]);
    expect(lines({ paper: 'ruled', left: 34.02, right: 34.02, marginLine: 'right' })).toEqual([577.98]);
    expect(lines({ paper: 'ruled', left: 34.02, right: 34.02, marginLine: 'both' })).toEqual([34.02, 577.98]);
    expect(lines({ paper: 'ruled', left: 34.02, right: 34.02, marginLine: 'both', size: 'a4' })).toEqual([34.02, 560.98]);
    expect(lines({ paper: 'ruled', left: 34.02, right: 34.02, marginLine: 'both', size: 'a4', turn: 'landscape' })).toEqual([34.02, 807.98]);
    // at a margin the sheet has none of, there is none
    expect(lines({ paper: 'ruled', marginLine: 'both' })).toEqual([]);
    expect(lines({ paper: 'ruled', left: 0, right: 0, marginLine: 'both' })).toEqual([]);
    expect(lines({ paper: 'ruled', left: 40, marginLine: 'both' })).toEqual([40]);
    expect(lines({ paper: 'ruled', right: 40, marginLine: 'both' })).toEqual([572]);
    expect(lines({ paper: 'ruled', right: 40, marginLine: 'left' })).toEqual([]);
    // on any paper, blank too
    for (const paper of ['blank', 'grid', 'dotted'] as const) expect(lines({ paper, left: 40, right: 30, marginLine: 'both' }), paper).toEqual([40, 582]);
    // beside 85's margin rule each stands, the leftmost first; where both would fall on one line it is one
    expect(lines({ paper: 'ruled', margin: 90, left: 34.02, marginLine: 'left' })).toEqual([34.02, 90]);
    expect(lines({ paper: 'ruled', margin: 34.3, left: 34.02, marginLine: 'left' })).toEqual([34.3]);
    // the paths of a page, and on the screen's pixels
    expect(paperPaths(paperOf({ paper: 'ruled', left: 34.02, right: 34.02, marginLine: 'both' })).margin).toBe('M34.02 0V792M577.98 0V792');
    expect(paperPaths(paperOf({ paper: 'ruled', left: 34.02, right: 34.02, marginLine: 'both' }), { px: 1, w: 1 }).margin).toBe('M34.5 0V792M577.5 0V792');
    expect(paperPaths(paperOf({ paper: 'ruled', left: 34.02, right: 34.02 })).margin).toBe('');
    expect(paperLines(paperOf({ paper: 'blank', left: 40, right: 30, marginLine: 'both' }))).toEqual({ rows: [], rowSpan: [40, 582], cols: [], colSpan: [0, 792], margins: [40, 582], dots: null });
  });

  it('a ruled sheet\'s rules begin at the left margin and end at the right one: the same rules, shorter', () => {
    const made = paperLines(paperOf({ paper: 'ruled', left: 34.02, right: 34.02 }));
    expect(made).toEqual({ ...paperLines('ruled'), rowSpan: [34.02, 577.98] });
    expect([made.rows[0], made.rows.at(-1), made.rows.length]).toEqual([72, 768, 30]);
    expect(paperLines(paperOf({ paper: 'ruled', left: 50 })).rowSpan).toEqual([50, 612]);
    expect(paperLines(paperOf({ paper: 'ruled', right: 50 })).rowSpan).toEqual([0, 562]);
    expect(paperLines(paperOf({ paper: 'ruled', left: 34.02, right: 34.02, size: 'a4' })).rowSpan).toEqual([34.02, 560.98]);
    // from as far down as it says to no nearer the foot than it says
    const set = paperLines(paperOf({ paper: 'ruled', rule: 30, left: 50, top: 100, bottom: 60 }));
    expect([set.rows[0], set.rows.at(-1), set.rows.length, set.rowSpan]).toEqual([100, 730, 22, [50, 612]]);
    // a line down the margin changes nothing of the rules
    expect(paperLines(paperOf({ paper: 'ruled', left: 34.02, right: 34.02, marginLine: 'both' }))).toEqual({ ...made, margins: [34.02, 577.98] });
    // as paths: each rule from the one margin to the other
    const paths = paperPaths(paperOf({ paper: 'ruled', left: 34.02, right: 34.02 }));
    expect(paths.rules.startsWith('M34.02 72H577.98M34.02 96H577.98')).toBe(true);
    expect(paths.rules.endsWith('M34.02 768H577.98')).toBe(true);
    expect(paths.rules).toBe(paperPaths('ruled').rules.replaceAll('M0 ', 'M34.02 ').replaceAll('H612', 'H577.98'));
    expect(paths).toMatchObject({ margin: '', dots: '', w: 612, h: 792 });
    // on the screen's pixels a rule's height is moved, and not where it begins and ends
    expect(paperPaths(paperOf({ paper: 'ruled', left: 34.02, right: 34.02 }), { px: 1, w: 1 }).rules.startsWith('M34.02 72.5H577.98M34.02 96.5H577.98')).toBe(true);
  });

  it('a grid is centred in what its four margins leave and closed there: its lines end on its outermost lines', () => {
    const grid = paperLines(paperOf({ paper: 'grid', ...EDGED }));
    expect(grid).toEqual({ rows: every(51, 771, 20), rowSpan: [41, 581], cols: every(41, 581, 20), colSpan: [51, 771], margins: [], dots: null });
    expect([grid.rows.length, grid.cols.length]).toEqual([37, 28]);
    // (as much clear inside the left margin as inside the right one, and so at the head and the foot)
    expect([grid.cols[0]! - 40, 582 - grid.cols.at(-1)!, grid.rows[0]! - 50, 772 - grid.rows.at(-1)!]).toEqual([1, 1, 1, 1]);
    // a new notebook's: 8 mm all round
    const made = paperLines(paperOf({ paper: 'grid', left: 22.68, right: 22.68, top: 22.68, bottom: 22.68 }));
    expect(made).toEqual({ rows: every(26, 766, 20), rowSpan: [26, 586], cols: every(26, 586, 20), colSpan: [26, 766], margins: [], dots: null });
    // another pitch, another sheet
    const a4 = paperLines(paperOf({ paper: 'grid', rule: 25, left: 30, right: 30, top: 30, bottom: 30, size: 'a4' }));
    expect([a4.cols[0], a4.cols.at(-1), a4.cols.length, a4.rowSpan]).toEqual([35, 560, 22, [35, 560]]);
    expect([a4.rows[0], a4.rows.at(-1), a4.rows.length, a4.colSpan]).toEqual([33.5, 808.5, 32, [33.5, 808.5]]);
    // as paths: every line of it between the outermost two the other way
    const paths = paperPaths(paperOf({ paper: 'grid', ...EDGED }));
    expect(paths.rules.startsWith('M41 51H581M41 71H581')).toBe(true);
    expect(paths.rules).toContain('M41 771H581M41 51V771M61 51V771');
    expect(paths.rules.endsWith('M581 51V771')).toBe(true);
    expect(paths.rules.match(/M/g)!.length).toBe(37 + 28);
    // on the screen's pixels a line is moved across itself, and its ends stay where they are
    const on = paperPaths(paperOf({ paper: 'grid', ...EDGED }), { px: 1, w: 1 }).rules;
    expect(on.startsWith('M41 51.5H581M41 71.5H581')).toBe(true);
    expect(on.endsWith('M581.5 51V771')).toBe(true);
    // lines down its margins are the sheet's whole height, where the margins are
    expect(paperPaths(paperOf({ paper: 'grid', ...EDGED, marginLine: 'both' })).margin).toBe('M40 0V792M582 0V792');
  });

  it('dots between margins are on every crossing of that grid', () => {
    const dotted = paperLines(paperOf({ paper: 'dotted', ...EDGED }));
    expect(dotted).toEqual({ rows: [], rowSpan: [41, 581], cols: [], colSpan: [51, 771], margins: [], dots: { xs: every(41, 581, 20), ys: every(51, 771, 20) } });
    const grid = paperLines(paperOf({ paper: 'grid', ...EDGED }));
    expect(dotted.dots).toEqual({ xs: grid.cols, ys: grid.rows });
    const made = paperLines(paperOf({ paper: 'dotted', left: 22.68, right: 22.68, top: 22.68, bottom: 22.68 }));
    expect(made.dots).toEqual({ xs: every(26, 586, 20), ys: every(26, 766, 20) });
    // as paths: a dashed row for each row of dots, from the first dot to the last
    const paths = paperPaths(paperOf({ paper: 'dotted', ...EDGED }));
    expect(paths).toMatchObject({ rules: '', margin: '', pitch: 20 });
    expect(paths.dots.startsWith('M41 51H581.01M41 71H581.01')).toBe(true);
    expect(paths.dots.match(/M/g)!.length).toBe(37);
  });

  it('with margins at the sides alone, or at the head and the foot alone, the other way is as it was: a grid\'s lines to the sheet\'s edge, dots a pitch short of it', () => {
    const plain = paperLines('grid');
    const sides = paperLines(paperOf({ paper: 'grid', left: 40, right: 30 }));
    expect(sides).toEqual({ rows: plain.rows, rowSpan: [41, 581], cols: every(41, 581, 20), colSpan: [0, 792], margins: [], dots: null });
    const ends = paperLines(paperOf({ paper: 'grid', top: 50, bottom: 20 }));
    expect(ends).toEqual({ rows: every(51, 771, 20), rowSpan: [0, 612], cols: plain.cols, colSpan: [51, 771], margins: [], dots: null });
    const dots = paperLines('dotted').dots!;
    expect(paperLines(paperOf({ paper: 'dotted', left: 40, right: 30 })).dots).toEqual({ xs: every(41, 581, 20), ys: dots.ys });
    expect(paperLines(paperOf({ paper: 'dotted', top: 50, bottom: 20 })).dots).toEqual({ xs: dots.xs, ys: every(51, 771, 20) });
  });

  it('a margin at one edge alone closes a grid at that edge alone: at the others its lines run to the sheet\'s edge', () => {
    const plain = paperLines('grid');
    // the left one: centred in what it leaves, 6 points clear of it and of the right edge
    expect(paperLines(paperOf({ paper: 'grid', left: 40 }))).toEqual({ rows: plain.rows, rowSpan: [46, 612], cols: every(46, 606, 20), colSpan: [0, 792], margins: [], dots: null });
    // the right one
    expect(paperLines(paperOf({ paper: 'grid', right: 30 }))).toEqual({ rows: plain.rows, rowSpan: [0, 581], cols: every(1, 581, 20), colSpan: [0, 792], margins: [], dots: null });
    // the foot's
    expect(paperLines(paperOf({ paper: 'grid', bottom: 100 }))).toEqual({ rows: every(6, 686, 20), rowSpan: [0, 612], cols: plain.cols, colSpan: [0, 686], margins: [], dots: null });
    // the head's
    expect(paperLines(paperOf({ paper: 'grid', top: 50 }))).toEqual({ rows: every(51, 791, 20), rowSpan: [0, 612], cols: plain.cols, colSpan: [51, 792], margins: [], dots: null });
    // two that meet at a corner: closed at that corner, open at the other
    expect(paperLines(paperOf({ paper: 'grid', left: 40, bottom: 100 }))).toMatchObject({ rowSpan: [46, 612], colSpan: [0, 686] });
    // as paths
    const left = paperPaths(paperOf({ paper: 'grid', left: 40 })).rules;
    expect(left.startsWith('M46 6H612M46 26H612')).toBe(true);
    expect(left.endsWith('M606 0V792')).toBe(true);
    const foot = paperPaths(paperOf({ paper: 'grid', bottom: 100 })).rules;
    expect(foot.startsWith('M0 6H612')).toBe(true);
    expect(foot).toContain('M0 686H612M6 0V686');
    expect(foot.endsWith('M606 0V686')).toBe(true);
    // on a clip: the lines down it end on the last line across
    const rects: [string, number, number, number, number][] = [];
    const ctx = { fillStyle: '', fillRect(x: number, y: number, w: number, h: number) { rects.push([this.fillStyle, x, y, w, h]); }, beginPath() {}, arc() {}, fill() {} };
    drawPaper(ctx as unknown as CanvasRenderingContext2D, paperOf({ paper: 'grid', bottom: 100 }), { x: 0, y: 0, w: 612, h: 792 }, 1);
    expect(rects.slice(1)).toEqual([...every(6, 686, 20).map((y) => [PAPER_RULE, 0, y, 612, 1]), ...every(6, 606, 20).map((x) => [PAPER_RULE, x, 0, 1, 686])]);
    // a long sheet's foot is no edge of it: its room is a page's, and closes nothing
    expect(paperLines(paperOf({ paper: 'grid', left: 40, bottom: 100, pageless: true }, 0))).toMatchObject({ rowSpan: [46, 612], colSpan: [0, 792] });
  });

  it('dots with a margin at one edge alone are on every crossing at that edge, and a pitch short of the others', () => {
    const plain = paperLines('dotted').dots!;
    // the left one: a dot on the grid's first line there, none on its last
    expect(paperLines(paperOf({ paper: 'dotted', left: 40 }))).toEqual({ rows: [], rowSpan: [46, 612], cols: [], colSpan: [0, 792], margins: [], dots: { xs: every(46, 586, 20), ys: plain.ys } });
    expect(paperLines(paperOf({ paper: 'dotted', right: 30 })).dots).toEqual({ xs: every(21, 581, 20), ys: plain.ys });
    // the foot's: down to the grid's last line, from a pitch under its first
    expect(paperLines(paperOf({ paper: 'dotted', bottom: 100 }))).toEqual({ rows: [], rowSpan: [0, 612], cols: [], colSpan: [0, 686], margins: [], dots: { xs: plain.xs, ys: every(26, 686, 20) } });
    expect(paperLines(paperOf({ paper: 'dotted', top: 50 })).dots).toEqual({ xs: plain.xs, ys: every(51, 771, 20) });
    expect(paperLines(paperOf({ paper: 'dotted', left: 40, bottom: 100 })).dots).toEqual({ xs: every(46, 586, 20), ys: every(26, 686, 20) });
    // they are the crossings of that grid, less the outermost at an edge with no margin
    for (const w of [{ left: 40 }, { right: 30 }, { top: 50 }, { bottom: 100 }, { left: 40, bottom: 100 }]) {
      const grid = paperLines(paperOf({ paper: 'grid', ...w }));
      const dots = paperLines(paperOf({ paper: 'dotted', ...w })).dots!;
      const [l, r, t, b] = ['left', 'right', 'top', 'bottom'].map((k) => k in w);
      expect(dots, JSON.stringify(w)).toEqual({ xs: grid.cols.slice(l ? 0 : 1, r ? undefined : -1), ys: grid.rows.slice(t ? 0 : 1, b ? undefined : -1) });
    }
    // as paths: each row from its first dot to its last
    expect(paperPaths(paperOf({ paper: 'dotted', left: 40 })).dots.startsWith('M46 26H586.01M46 46H586.01')).toBe(true);
    expect(paperPaths(paperOf({ paper: 'dotted', bottom: 100 })).dots.endsWith('M26 686H586.01')).toBe(true);
  });

  it('with no margins a grid and dots are exactly as they were before there were any', () => {
    expect(paperLines(paperOf({ paper: 'grid' }))).toEqual({ rows: every(6, 786, 20), rowSpan: [0, 612], cols: every(6, 606, 20), colSpan: [0, 792], margins: [], dots: null });
    expect(paperLines(paperOf({ paper: 'dotted' }))).toEqual({ rows: [], rowSpan: [0, 612], cols: [], colSpan: [0, 792], margins: [], dots: { xs: every(26, 586, 20), ys: every(26, 766, 20) } });
    expect(paperLines(paperOf({ paper: 'grid', left: 0, right: 0, top: 0, bottom: 0 }))).toEqual(paperLines('grid'));
    expect(paperLines(paperOf({ paper: 'dotted', left: 0, right: 0, top: 0, bottom: 0 }))).toEqual(paperLines('dotted'));
    expect(paperPaths(paperOf({ paper: 'grid' })).rules.startsWith('M0 6H612M0 26H612')).toBe(true);
    expect(paperPaths(paperOf({ paper: 'grid' })).rules.endsWith('M606 0V792')).toBe(true);
    expect(paperPaths(paperOf({ paper: 'dotted' })).dots.startsWith('M26 26H586.01M26 46H586.01')).toBe(true);
  });

  it('on sheets that run on as one the rules lie between the side margins on every sheet, the first as far down the long sheet as it says, with no foot', () => {
    const sheet = (i: number) => paperLines(paperOf({ paper: 'ruled', left: 34.02, right: 34.02, bottom: 100, pageless: true }, i));
    expect([sheet(0).rows[0], sheet(0).rows.at(-1), sheet(0).rowSpan]).toEqual([72, 768, [34.02, 577.98]]);
    expect([sheet(1).rows[0], sheet(1).rows.at(-1), sheet(1).rowSpan]).toEqual([0, 768, [34.02, 577.98]]);
    for (const i of [0, 1, 2]) expect(sheet(i).rows, String(i)).toEqual(paperLines(paperOf({ paper: 'ruled', pageless: true }, i)).rows);
    // a line down the margin is on every sheet
    for (const i of [0, 1, 2]) expect(paperLines(paperOf({ paper: 'ruled', left: 34.02, right: 34.02, marginLine: 'both', pageless: true }, i)).margins).toEqual([34.02, 577.98]);
  });

  it('a long sheet\'s grid begins at its head\'s room and is closed there; below, its lines run through from sheet to sheet, and its foot\'s room is a page\'s', () => {
    const sheet = (i: number, paper: 'grid' | 'dotted' = 'grid') => paperLines(paperOf({ paper, left: 40, right: 30, top: 30, bottom: 20, pageless: true }, i));
    // the first sheet: its first line 30 points down, the lines down it from there to its foot
    expect(sheet(0)).toEqual({ rows: every(30, 790, 20), rowSpan: [41, 581], cols: every(41, 581, 20), colSpan: [30, 792], margins: [], dots: null });
    // the next: 790 and 20 are 810, 18 points down it; its lines down the whole of it
    expect(sheet(1)).toEqual({ rows: every(18, 778, 20), rowSpan: [41, 581], cols: every(41, 581, 20), colSpan: [0, 792], margins: [], dots: null });
    expect([sheet(2).rows[0], sheet(2).colSpan]).toEqual([6, [0, 792]]);
    // dots on every crossing of it, from the head's room on
    expect(sheet(0, 'dotted')).toEqual({ rows: [], rowSpan: [41, 581], cols: [], colSpan: [30, 792], margins: [], dots: { xs: every(41, 581, 20), ys: every(30, 790, 20) } });
    expect(sheet(1, 'dotted').dots).toEqual({ xs: every(41, 581, 20), ys: every(18, 778, 20) });
    // a new notebook's grid, pageless: from 8 mm down, between 8 mm at each side
    const made = (i: number) => paperLines(paperOf({ paper: 'grid', left: 22.68, right: 22.68, top: 22.68, bottom: 22.68, pageless: true }, i));
    expect([made(0).rows[0], made(0).rows.at(-1), made(0).rows.length, made(0).colSpan, made(0).rowSpan]).toEqual([22.68, 782.68, 39, [22.68, 792], [26, 586]]);
    expect([made(1).rows[0], made(1).colSpan]).toEqual([10.68, [0, 792]]);
    // as paths: the first sheet's lines down it begin at the head's room
    expect(paperPaths(paperOf({ paper: 'grid', left: 40, right: 30, top: 30, pageless: true }, 0)).rules).toContain('M41 30V792');
    expect(paperPaths(paperOf({ paper: 'grid', left: 40, right: 30, top: 30, pageless: true }, 1)).rules).toContain('M41 0V792');
    // with no room at its head it is as it was: centred as a page's, its lines from the sheet's top, dots a pitch short of the head
    const bare = paperLines(paperOf({ paper: 'grid', left: 40, right: 30, pageless: true }, 0));
    expect([bare.rows[0], bare.colSpan, bare.rowSpan]).toEqual([6, [0, 792], [41, 581]]);
    expect(paperLines(paperOf({ paper: 'dotted', left: 40, right: 30, pageless: true }, 0)).dots!.ys[0]).toBe(26);
    for (const i of [0, 1, 2]) for (const paper of ['grid', 'dotted'] as const) expect(paperLines(paperOf({ paper, bottom: 20, pageless: true }, i)), `${paper} ${i}`).toEqual(paperLines(paperOf({ paper, pageless: true }, i)));
  });

  it('across the sheets of a pageless notebook with margins the lines are one ruling still, from the last of a sheet to the first of the next', () => {
    for (const rule of [18, 20, 25, 28.35]) {
      for (const paper of ['ruled', 'grid', 'dotted'] as const) {
        const ys = (i: number) => { const l = paperLines(paperOf({ paper, rule, left: 34.02, right: 22.68, top: 22.68, bottom: 22.68, pageless: true }, i)); return paper === 'dotted' ? l.dots!.ys : l.rows; };
        expect(ys(0)[0], `${paper} ${rule}`).toBe(22.68);
        for (const i of [0, 1, 2, 3]) {
          const here = ys(i);
          expect(here.every((y) => y >= 0 && y < 792), `${paper} ${rule} ${i}`).toBe(true);
          for (let j = 1; j < here.length; j++) expect(here[j]! - here[j - 1]!).toBeCloseTo(rule, 2);
          expect(ys(i + 1)[0]! + 792 - here.at(-1)!, `${paper} ${rule} ${i}`).toBeCloseTo(rule, 2);
        }
      }
    }
  });

  it('a clip has each rule only as far as it runs on the sheet: from the left margin, to the right one, and none in a margin', () => {
    const rects: [string, number, number, number, number][] = [];
    const ctx = { fillStyle: '', fillRect(x: number, y: number, w: number, h: number) { rects.push([this.fillStyle, x, y, w, h]); }, beginPath() {}, arc() {}, fill() {} };
    const draw = (w: Parameters<typeof paperOf>[0], part: { x: number; y: number; w: number; h: number }, k = 1) => { rects.length = 0; drawPaper(ctx as unknown as CanvasRenderingContext2D, paperOf(w), part, k); return rects.slice(1); };
    const made = { paper: 'ruled', left: 34.02, right: 34.02 } as const;
    // the whole sheet, a pixel to the point: every rule from 34 to 578
    expect(draw(made, { x: 0, y: 0, w: 612, h: 792 })).toEqual(every(72, 768, 24).map((y) => [PAPER_RULE, 34, y, 544, 1]));
    expect(rects[0]).toEqual([PAPER_WHITE, 0, 0, 612, 792]);
    // a clip between the margins has its rules from side to side, as before
    expect(draw(made, { x: 50, y: 60, w: 200, h: 100 }, 2)).toEqual([24, 72, 120, 168].map((y) => [PAPER_RULE, 0, y, 400, 1]));
    // one that holds the left margin: its rules begin where the margin ends, two pixels to the point
    expect(draw(made, { x: 0, y: 60, w: 100, h: 50 }, 2)).toEqual([[PAPER_RULE, 68, 24, 132, 1], [PAPER_RULE, 68, 72, 132, 1]]);
    // one that holds the right margin: they end there
    expect(draw(made, { x: 500, y: 60, w: 112, h: 50 })).toEqual([[PAPER_RULE, 0, 12, 78, 1], [PAPER_RULE, 0, 36, 78, 1]]);
    // one wholly in a margin: bare paper
    expect(draw(made, { x: 0, y: 60, w: 30, h: 50 })).toEqual([]);
    expect(rects).toEqual([[PAPER_WHITE, 0, 0, 30, 50]]);
    // a line down the margin is drawn after the rules, in the margin's colour: the pale red, or the one chosen
    expect(draw({ ...made, marginLine: 'both' }, { x: 0, y: 60, w: 612, h: 50 }).slice(-2)).toEqual([[PAPER_MARGIN, 34, 0, 1, 50], [PAPER_MARGIN, 578, 0, 1, 50]]);
    expect(draw({ ...made, marginLine: 'left', marginColor: '#b5d2f2' }, { x: 0, y: 60, w: 612, h: 50 }).slice(-1)).toEqual([['#b5d2f2', 34, 0, 1, 50]]);
    expect(draw({ ...made, marginLine: 'left' }, { x: 0, y: 60, w: 30, h: 50 })).toEqual([]);
  });

  it('a clip of a grid between margins has its lines from the one outermost line to the other; of dots, every one, drawn before a margin\'s line', () => {
    const rects: [string, number, number, number, number][] = [];
    const order: string[] = [];
    const ctx = { fillStyle: '', fillRect(x: number, y: number, w: number, h: number) { rects.push([this.fillStyle, x, y, w, h]); order.push('rect'); }, beginPath() {}, arc() {}, fill() { order.push('dot'); } };
    const draw = (w: Parameters<typeof paperOf>[0], part: { x: number; y: number; w: number; h: number }, k = 1) => { rects.length = 0; order.length = 0; drawPaper(ctx as unknown as CanvasRenderingContext2D, paperOf(w), part, k); return rects.slice(1); };
    const whole = { x: 0, y: 0, w: 612, h: 792 };
    expect(draw({ paper: 'grid', ...EDGED }, whole)).toEqual([...every(51, 771, 20).map((y) => [PAPER_RULE, 41, y, 540, 1]), ...every(41, 581, 20).map((x) => [PAPER_RULE, x, 51, 1, 720])]);
    // a clip of its top left corner, two pixels to the point: the lines begin at the corner
    expect(draw({ paper: 'grid', ...EDGED }, { x: 30, y: 40, w: 40, h: 40 }, 2)).toEqual([[PAPER_RULE, 22, 22, 58, 1], [PAPER_RULE, 22, 62, 58, 1], [PAPER_RULE, 22, 22, 1, 58], [PAPER_RULE, 62, 22, 1, 58]]);
    // with a line down both margins: the grid, then the two, the sheet's height
    expect(draw({ paper: 'grid', ...EDGED, marginLine: 'both' }, whole).slice(-2)).toEqual([[PAPER_MARGIN, 40, 0, 1, 792], [PAPER_MARGIN, 582, 0, 1, 792]]);
    expect(rects.filter((r) => r[0] === PAPER_RULE).length).toBe(37 + 28);
    // dots: the first row of them, each one, then the margin's lines
    expect(draw({ paper: 'dotted', ...EDGED, marginLine: 'both' }, { x: 0, y: 0, w: 612, h: 60 })).toEqual([[PAPER_MARGIN, 40, 0, 1, 60], [PAPER_MARGIN, 582, 0, 1, 60]]);
    expect(order.filter((o) => o === 'dot').length).toBe(28);
    expect(order.slice(-2)).toEqual(['rect', 'rect']);
    expect(order.lastIndexOf('dot')).toBe(order.length - 3);
    // with no line there is nothing after the dots
    draw({ paper: 'dotted', ...EDGED }, whole);
    expect(order.filter((o) => o === 'dot').length).toBe(28 * 37);
    expect(order.at(-1)).toBe('dot');
  });
});

describe('how long a pageless notebook\'s one sheet is drawn', () => {
  const run = (w: Omit<Parameters<typeof paperOf>[0], 'pageless'>) => paperOf({ ...w, pageless: true }, 0);
  /** Where a paper's ruling begins down the long sheet, and what a centred grid keeps clear at its foot. */
  const phase = (p: ReturnType<typeof paperOf>) => {
    const edge = p.kind === 'grid' || p.kind === 'dotted' ? (p.h % p.rule) / 2 : 0;
    return { first: p.kind === 'ruled' ? p.top % p.rule : edge, edge };
  };
  const PAPERS_RUN = [
    run({ paper: 'ruled' }), run({ paper: 'ruled', rule: 25, top: 10 }), run({ paper: 'ruled', rule: 18, top: 100, size: 'a4' }), run({ paper: 'ruled', rule: 28.35, top: 0 }),
    run({ paper: 'grid' }), run({ paper: 'grid', rule: 25 }), run({ paper: 'grid', rule: 14.17, size: 'a4' }),
    run({ paper: 'dotted' }), run({ paper: 'dotted', rule: 25, size: 'a4' }), run({ paper: 'blank' }), run({ paper: 'blank', size: 'a4' }),
  ];
  const name = (p: ReturnType<typeof paperOf>) => `${p.kind} ${p.rule} ${p.top} ${p.h}`;
  /** What a long sheet grows by: its ruling's spacing; blank paper's, a new notebook's rule. */
  const stepOf = (p: ReturnType<typeof paperOf>) => (p.kind === 'blank' ? 24 : p.rule);

  it('keeps eight of a new notebook\'s rules of bare paper under what is written', () => {
    expect(RUN_ALLOW).toBe(192);
    expect(RUN_ALLOW).toBe(8 * 24);
  });

  it('with nothing written, or little, it is one sheet: never shorter', () => {
    expect(runLength(run({ paper: 'ruled' }), 0)).toBe(792);
    expect(runLength(run({ paper: 'grid' }), 0)).toBe(792);
    expect(runLength(run({ paper: 'dotted' }), 0)).toBe(792);
    expect(runLength(run({ paper: 'ruled', size: 'a4' }), 0)).toBe(842);
    expect(runLength(run({ paper: 'blank' }), 0)).toBe(792);
    expect(runLength(run({ paper: 'ruled', rule: 25, top: 10 }), 0)).toBe(792);
    // written to 600 points down a Letter sheet, 192 more is its foot still
    expect([100, 400, 599, 600].map((f) => runLength(run({ paper: 'ruled' }), f))).toEqual([792, 792, 792, 792]);
    for (const p of PAPERS_RUN) {
      for (const foot of [0, 1, 300, p.h - RUN_ALLOW]) {
        // (what fits on one sheet is one sheet, whole, whatever its ruling)
        expect(runLength(p, foot), name(p)).toBe(p.h);
      }
    }
    // a foot that is no number, or under the sheet's head, is nothing written
    for (const bad of [Number.NaN, -5, -1e9, Number.POSITIVE_INFINITY, Number.NEGATIVE_INFINITY]) expect(runLength(run({ paper: 'ruled' }), bad), String(bad)).toBe(792);
  });

  it('is never shorter than what is written and 192 points more, and never a whole step longer than that asks', () => {
    for (const p of PAPERS_RUN) {
      for (let foot = 0; foot <= 4000; foot += 7.3) {
        const len = runLength(p, foot);
        const need = Math.max(p.h, foot + RUN_ALLOW);
        expect(len, `${name(p)} ${foot}`).toBeGreaterThanOrEqual(need - 1e-3);
        expect(len - need, `${name(p)} ${foot}`).toBeLessThan(stepOf(p) + 1e-3);
      }
    }
  });

  it('grows a line at a time as the foot moves down a point at a time: by nothing, or by one whole step of the ruling', () => {
    for (const p of PAPERS_RUN) {
      let was = runLength(p, 0);
      let grew = 0;
      for (let foot = 1; foot <= 2400; foot++) {
        const len = runLength(p, foot);
        const by = len - was;
        // (the first step, from one sheet whole onto the ruling, may be less than a step: never more)
        if (by !== 0) { if (was === p.h) { expect(by, `${name(p)} ${foot}`).toBeGreaterThan(0); expect(by, `${name(p)} ${foot}`).toBeLessThanOrEqual(stepOf(p) + 1e-3); } else expect(by, `${name(p)} ${foot}`).toBeCloseTo(stepOf(p), 2); grew += 1; }
        was = len;
      }
      // from one sheet to the foot at 2400 and 192 more: every step of it taken, one by one
      expect(grew, name(p)).toBeGreaterThan(1500 / stepOf(p));
    }
    // a new notebook's ruled sheet: a rule more for each 24 points written past 600
    expect([600, 601, 624, 625, 648, 649, 1000, 2000].map((f) => runLength(run({ paper: 'ruled' }), f))).toEqual([792, 816, 816, 840, 840, 864, 1200, 2208]);
  });

  it('ends a whole number of steps down the ruling: on a rule\'s line for ruled paper, the grid\'s edge room past a line for a grid and dots, a step from the head for blank', () => {
    for (const p of PAPERS_RUN) {
      const { first, edge } = phase(p);
      for (const foot of [p.h, 1234.5, 2000, 3999]) {
        const steps = (runLength(p, foot) - first - edge) / stepOf(p);
        expect(Math.abs(steps - Math.round(steps)), `${name(p)} ${foot}`).toBeLessThan(1e-3);
      }
    }
    // ruled from an inch down in 24s: every foot is a multiple of 24; from 10 down in 25s, 10 past one
    expect([601, 1000, 2000].map((f) => runLength(run({ paper: 'ruled' }), f) % 24)).toEqual([0, 0, 0]);
    expect([0, 601, 1000, 2000].map((f) => runLength(run({ paper: 'ruled', rule: 25, top: 10 }), f))).toEqual([792, 810, 1210, 2210]);
    // a grid of 20 on a Letter sheet is centred with 6 points clear at each edge: its foot is 6 past a line
    expect([601, 623, 1000, 2000].map((f) => runLength(run({ paper: 'grid' }), f))).toEqual([812, 832, 1192, 2192]);
    expect(paperLines(run({ paper: 'grid' })).rows[0]).toBe(6);
    // 25s on a Letter sheet: 8.5 clear; on A4 8.5 too, and one sheet is a whole number of them
    expect([0, 601, 1000].map((f) => runLength(run({ paper: 'grid', rule: 25 }), f))).toEqual([792, 817, 1192]);
    expect([0, 700, 1000].map((f) => runLength(run({ paper: 'dotted', rule: 25, size: 'a4' }), f))).toEqual([842, 892, 1192]);
    // dots end as a grid of their pitch does
    for (const foot of [0, 601, 1000, 2000]) expect(runLength(run({ paper: 'dotted' }), foot)).toBe(runLength(run({ paper: 'grid' }), foot));
    // blank paper counts from its head in a new notebook's rules: 24 points
    expect([0, 601, 625, 1000, 2000].map((f) => runLength(run({ paper: 'blank' }), f))).toEqual([792, 816, 840, 1200, 2208]);
  });

  it('a grid or dots with room at the head are counted from there: the sheet ends on a line of the grid, with no edge room past it', () => {
    // 8 mm down, in 20s: lines at 22.68, 42.68 and on; 793 points are asked, and the next line is at 802.68
    const made = run({ paper: 'grid', left: 22.68, right: 22.68, top: 22.68, bottom: 22.68 });
    expect([0, 600, 601, 610, 611, 1000, 2000].map((f) => runLength(made, f))).toEqual([792, 792, 802.68, 802.68, 822.68, 1202.68, 2202.68]);
    // with none at the head: centred, 6 points past a line
    expect([601, 1000, 2000].map((f) => runLength(run({ paper: 'grid' }), f))).toEqual([812, 1192, 2192]);
    // dots as a grid of their pitch
    for (const foot of [0, 601, 1000, 2000]) expect(runLength(run({ paper: 'dotted', top: 22.68 }), foot)).toBe(runLength(made, foot));
    // room at the head of more than a square: the lines are where they fall from it
    expect([601, 1000].map((f) => runLength(run({ paper: 'grid', top: 30 }), f))).toEqual([810, 1210]);
    expect([601, 1000].map((f) => runLength(run({ paper: 'grid', rule: 25, top: 60 }), f))).toEqual([810, 1210]);
    for (const p of [made, run({ paper: 'grid', top: 30 }), run({ paper: 'dotted', rule: 25, top: 60, size: 'a4' }), run({ paper: 'grid', rule: 14.17, top: 22.68 })]) {
      let was = runLength(p, 0);
      for (let foot = 1; foot <= 2400; foot += 3) {
        const len = runLength(p, foot);
        // never shorter than what is written and the bare paper under it, never a whole square longer
        expect(len, `${name(p)} ${foot}`).toBeGreaterThanOrEqual(Math.max(p.h, foot + RUN_ALLOW) - 1e-3);
        expect(len - Math.max(p.h, foot + RUN_ALLOW), `${name(p)} ${foot}`).toBeLessThan(p.rule + 1e-3);
        // past one sheet it ends a whole number of squares below the head's room
        if (len > p.h) { const steps = (len - p.top) / p.rule; expect(Math.abs(steps - Math.round(steps)), `${name(p)} ${foot}`).toBeLessThan(1e-3); }
        expect(len).toBeGreaterThanOrEqual(was);
        was = len;
      }
    }
    // the foot's room is a page's: a long sheet is as long with it as without
    expect(runLength(run({ paper: 'grid', top: 22.68, bottom: 100 }), 1000)).toBe(runLength(run({ paper: 'grid', top: 22.68 }), 1000));
    // the margins at the sides, a line down them and its colour change nothing of it
    for (const foot of [0, 700, 1900]) {
      expect(runLength(run({ paper: 'ruled', left: 34.02, right: 34.02, marginLine: 'both', marginColor: '#b5d2f2' }), foot)).toBe(runLength(run({ paper: 'ruled' }), foot));
      expect(runLength(run({ paper: 'grid', left: 40, right: 30 }), foot)).toBe(runLength(run({ paper: 'grid' }), foot));
    }
  });

  it('is the paper\'s and the foot\'s alone: the same for any sheet of the notebook, with or without margins or colours', () => {
    for (const foot of [0, 700, 1900]) {
      const len = runLength(run({ paper: 'ruled', rule: 25 }), foot);
      expect(runLength(paperOf({ paper: 'ruled', rule: 25, pageless: true }, 2), foot)).toBe(len);
      expect(runLength(paperOf({ paper: 'ruled', rule: 25, pageless: true, margin: 90, marginRight: 72, bottom: 100, color: '#fbf6e9', line: '#bcdcc0' }, 0), foot)).toBe(len);
    }
    // a spacing under two points is held to two, as the ruling is
    expect(runLength({ ...run({ paper: 'ruled' }), rule: 0 }, 601)).toBe(794);
  });
});

describe('a written notebook in the lens', () => {
  it('opens at once as its sheets of paper, with nothing asked of pdf.js', async () => {
    await mount(NB, [1, 2, 4]);
    expect(acquired).toBe(0);
    expect(q('.empty')).toBeNull();
    expect(places()).toEqual([1, 2, 3]);
    expect(sheetsShown()).toEqual([1, 2, 4]);
    expect(qa('.pdf-page > svg.paper').map((s) => s.getAttribute('data-paper'))).toEqual(['ruled', 'ruled', 'ruled']);
    expect(q('svg.paper')!.getAttribute('viewBox')).toBe('0 0 612 792');
    expect(q('svg.paper .paper-rule')!.getAttribute('vector-effect')).toBe('non-scaling-stroke');
    expect(q('.pdf-page canvas')).toBeNull();
    // every sheet Letter, the notebook's id where a PDF's hash is, the page in view of the last
    expect([pageEl(1).style.width, pageEl(1).style.height]).toEqual(['612px', '792px']);
    const view = q<HTMLElement>('.pdf-view')!;
    expect(view.dataset.hash).toBe(ID);
    expect(view.dataset.written).toBe('1');
    expect(q('.meta .pt-page')!.textContent).toBe('p. 1 / 3');
  });

  it('draws each paper, on every sheet near or far; what is written is pictured only on the sheets near the view', async () => {
    await fs.setPageInk(ID, 1, [stroke(1)]);
    await fs.setPageInk(ID, 5, [stroke(2)]);
    await mount(NB, [1, 2, 3, 4, 5], 'grid');
    expect(places()).toEqual([1, 2, 3, 4, 5]);
    // lines are cheap: a page scrolled to fast is never bare
    expect(qa<HTMLElement>('.pdf-page').map((p) => p.querySelector('svg.paper') !== null)).toEqual([true, true, true, true, true]);
    // the view is 900 tall: the fifth sheet is out of reach of it, and its writing waits until it comes near
    expect(q('svg.page-ink[data-page="1"]')).not.toBeNull();
    expect(q('.page-ink[data-page="5"]')).toBeNull();
    expect(q('img.page-ink')).toBeNull();
    expect(pageEl(5).dataset.paper).toBe('grid');
    // (a page's rules lie on the screen's pixels: half a pixel on from where the sheet has them)
    expect(q('svg.paper .paper-rule')!.getAttribute('d')).toBe(paperPaths('grid', ON).rules);
    expect(q('svg.paper .paper-rule')!.getAttribute('d')).toContain('M6.5 0V792');
    for (const kind of ['dotted', 'blank', 'ruled'] as const) {
      await act(async () => { useApp.setState((s) => ({ docs: { ...s.docs, [NB]: { ...s.docs[NB]!, written: { ...s.docs[NB]!.written!, paper: kind } } } })); });
      expect(q('svg.paper')!.getAttribute('data-paper')).toBe(kind);
      expect(q('svg.paper .paper-rule') !== null).toBe(kind === 'ruled');
      expect(q('svg.paper .paper-dot') !== null).toBe(kind === 'dotted');
    }
    expect(q('svg.paper .paper-dot')).toBeNull();
  });

  it('a sheet, its ink\'s layer and each picture say when the paper is dark, by the paper and not by the theme alone', async () => {
    await fs.setPageInk(ID, 1, [stroke(1)]);
    await mount(NB, [1, 2], 'ruled');
    const marks = () => [pageEl(1).dataset.inkDark, pageEl(2).dataset.inkDark, q<HTMLElement>('.pdf-ink')!.dataset.inkDark, q<SVGSVGElement>('svg.page-ink')!.dataset.inkDark].map((v) => v ?? null);
    const paper = () => [q('svg.paper .paper-sheet')!.getAttribute('fill'), q('svg.paper .paper-rule')!.getAttribute('stroke')];
    const setup = (more: Record<string, unknown>) => act(async () => { useApp.setState((s) => ({ docs: { ...s.docs, [NB]: { ...s.docs[NB]!, written: { id: ID, paper: 'ruled', sheets: [1, 2], ...more } } } })); });
    // a notebook's layer and pictures are known as paper's, so the theme's rule for a PDF's pages leaves them be
    expect([q<HTMLElement>('.pdf-ink')!.dataset.paper, q<SVGSVGElement>('svg.page-ink')!.dataset.paper]).toEqual(['ruled', 'ruled']);
    expect([marks(), paper()]).toEqual([[null, null, null, null], ['#ffffff', '#c3cfdd']]);
    try {
      // paper that follows a dark theme is dark
      await act(async () => { useApp.setState({ theme: 'dark' }); });
      expect([marks(), paper()]).toEqual([['1', '1', '1', '1'], ['#141414', '#353f4b']]);
      // a light paper chosen is light there too, its ink as written
      await setup({ color: '#fbf6e9', line: '#bcdcc0' });
      expect([marks(), paper()]).toEqual([[null, null, null, null], ['#fbf6e9', '#bcdcc0']]);
      await act(async () => { useApp.setState({ theme: 'light' }); });
      // a dark paper chosen is dark in the light theme
      await setup({ color: '#1c1c1e' });
      expect([marks(), paper()]).toEqual([['1', '1', '1', '1'], ['#1c1c1e', '#353f4b']]);
      await act(async () => { useApp.setState({ theme: 'eink' }); });
      expect(marks()).toEqual(['1', '1', '1', '1']);
      await setup({});
      expect([marks(), paper()]).toEqual([[null, null, null, null], ['#ffffff', '#8f8f8f']]);
    } finally {
      await act(async () => { useApp.setState({ theme: 'light' }); });
    }
  });

  it('has none of what a PDF\'s text gives, and those keys do nothing', async () => {
    await mount(NB);
    for (const tool of ['contents', 'search']) expect(q(`.meta [data-tool="${tool}"]`)).toBeNull();
    expect(q('.meta .enrol')).toBeNull();
    expect(q('.read-gutter, .read-bar')).toBeNull();
    // kept: the name, the notes' word and its +, the zoom, the page, more
    expect(q('.meta .pt-title')).not.toBeNull();
    expect(q('.meta .notes-toggle')!.textContent).toBe('open notes');
    expect(q<HTMLElement>('.meta .notes-add')!.title).toBe('new note');
    for (const tool of ['zoom-out', 'zoom-fit', 'zoom-in', 'page', 'more']) expect(q(`.meta [data-tool="${tool}"]`)).not.toBeNull();
    for (const k of ['/', 't', 'f', 'b', 'v', 'h', 'M', "'", 'P', 'r']) {
      const e = await key(k);
      expect([k, e.defaultPrevented]).toEqual([k, false]);
    }
    expect(q('.pdf-bar')).toBeNull();
    expect(q('.pdf-rule, .pdf-hints')).toBeNull();
    expect(useApp.getState().notice).toBeNull();
    // `g` still goes to a page, by its place
    await key('g');
    const field = q<HTMLInputElement>('.pdf-bar input[type="number"]')!;
    expect([field.min, field.max]).toEqual(['1', '3']);
    await key('Escape');
    // a box's bar has passage and card, and no highlight
    await box(1);
    expect(qa<HTMLElement>('.pend button').map((b) => b.dataset.k)).toEqual(['e', 'm', 'esc']);
  });

  it('`add page` under the last page adds one', async () => {
    await mount(NB);
    const add = q<HTMLButtonElement>('button.add-page')!;
    expect(add.textContent).toBe('add page');
    await click(add);
    await wait(20);
    expect(asked.addSheet).toBe(1);
    expect(written().sheets).toEqual([1, 2, 3, 4]);
    expect(places()).toEqual([1, 2, 3, 4]);
    expect(q('.meta .pt-page')!.textContent).toBe('p. 1 / 4');
  });

  it('`more` has the pages, the page setup and the pages as a PDF, then what is done to the page in view', async () => {
    await mount(NB);
    await click(more());
    expect(menuRows().map((r) => [r.dataset.act, r.textContent])).toEqual([
      ['more-tab', 'new tab'], ['more-pages', 'all pages'], ['more-setup', 'page setup'], ['more-share', 'export as pdf'],
      ['page-add-after', 'add page after this one'], ['page-duplicate', 'duplicate this page'], ['page-delete', 'delete this page'],
    ]);
    expect(menuRows().filter((r) => r.classList.contains('danger')).map((r) => r.dataset.act)).toEqual(['page-delete']);
    expect(more().title).toBe('pages, page setup, share');
  });

  it('`page setup` is a panel over the pages; the paper chosen there is the pages\' behind it', async () => {
    await mount(NB);
    await click(more());
    await click(menuRow('more-setup')!);
    await wait(20);
    const panel = q<HTMLElement>('.page-setup')!;
    expect(panel.closest('.book')).not.toBeNull();
    expect(qa<HTMLElement>('[data-ps^="paper-"]').map((b) => [b.dataset.ps, b.getAttribute('aria-pressed')])).toEqual([['paper-blank', 'false'], ['paper-ruled', 'true'], ['paper-grid', 'false'], ['paper-dotted', 'false']]);
    await click(q('[data-ps="paper-dotted"]')!);
    await wait(150);
    expect(written().paper).toBe('dotted');
    expect(q('.pdf-page > svg.paper')!.getAttribute('data-paper')).toBe('dotted');
    expect(pageEl(3).dataset.paper).toBe('dotted');
    // (dots keep a new notebook's room at the head and the foot; the file had no margins at its sides, and has none)
    expect(written()).toEqual({ id: ID, sheets: [1, 2, 3], paper: 'dotted', top: 22.68, bottom: 22.68 });
    // ruled again, narrower, with a line down its left margin, which brings the margin: every sheet is ruled so, from that margin on
    await click(q('[data-ps="paper-ruled"]')!);
    await click(q('[data-ps="stop-narrow"]')!);
    await click(q('[data-ps="mline-left"]')!);
    await wait(150);
    expect(written()).toEqual({ id: ID, sheets: [1, 2, 3], paper: 'ruled', rule: 18, left: 34.02, marginLine: 'left' });
    expect(qa('.pdf-page > svg.paper').map((s) => s.getAttribute('data-rule'))).toEqual(['18', '18', '18']);
    expect(q('.pdf-page > svg.paper .paper-rule')!.getAttribute('d')!.startsWith('M34.02 72.5H612M34.02 90.5H612')).toBe(true);
    expect(q('.pdf-page > svg.paper .paper-rule')!.getAttribute('d')).toBe(paperPaths(paperOf(written()), ON).rules);
    expect(qa('.pdf-page > svg.paper .paper-margin').map((m) => m.getAttribute('d'))).toEqual(['M34.5 0V792', 'M34.5 0V792', 'M34.5 0V792']);
    // still up: the panel is not a step
    expect(q('.page-setup')).not.toBeNull();
    await click(q('[data-ps="close"]')!);
    expect(q('.page-setup')).toBeNull();
    expect(asked.setup.length).toBeGreaterThan(0);
  });

  it('sheets of another size, or on their side, are that size in the column, their paper with them', async () => {
    await mount(NB);
    expect([pageEl(1).style.width, pageEl(1).style.height, pageEl(2).style.top]).toEqual(['612px', '792px', `${H + GAP}px`]);
    await act(async () => { useApp.setState((s) => ({ docs: { ...s.docs, [NB]: { ...s.docs[NB]!, written: { ...written(), size: 'a4' } } } })); });
    await wait(30);
    expect([pageEl(1).style.width, pageEl(1).style.height, pageEl(2).style.top]).toEqual(['595px', '842px', `${842 + GAP}px`]);
    expect(q('.pdf-page > svg.paper')!.getAttribute('viewBox')).toBe('0 0 595 842');
    await act(async () => { useApp.setState((s) => ({ docs: { ...s.docs, [NB]: { ...s.docs[NB]!, written: { ...written(), turn: 'landscape' } } } })); });
    await wait(30);
    expect([pageEl(3).style.width, pageEl(3).style.height]).toEqual(['842px', '595px']);
    expect(q('.pdf-page > svg.paper')!.getAttribute('viewBox')).toBe('0 0 842 595');
    expect(places()).toEqual([1, 2, 3]);
  });

  it('pageless, the sheets run on as one: nothing between them, the ruling carried on, and nothing that counts or changes pages', async () => {
    await mount(NB);
    await act(async () => { useApp.setState((s) => ({ docs: { ...s.docs, [NB]: { ...s.docs[NB]!, written: { ...written(), rule: 25, pageless: true } } } })); });
    await wait(30);
    expect(qa<HTMLElement>('.pdf-page').map((p) => p.style.top)).toEqual(['0px', `${H}px`, `${2 * H}px`]);
    expect(q<HTMLElement>('.pdf-view')!.dataset.layout).toBe('pageless');
    // the second sheet's first rule is where the first's would have come next
    expect(qa('.pdf-page > svg.paper .paper-rule').map((r) => r.getAttribute('d')!.split('H')[0])).toEqual(['M0 72.5', 'M0 5.5', 'M0 13.5']);
    expect(qa('.pdf-page > svg.paper .paper-rule').map((r) => r.getAttribute('d'))).toEqual([0, 1, 2].map((i) => paperPaths(paperOf(written(), i), ON).rules));
    expect(q('.add-page')).toBeNull();
    expect(q('.meta [data-tool="pages"]')).toBeNull();
    expect(q('.meta .pt-page')).toBeNull();
    await click(more());
    expect(menuRows().map((r) => r.dataset.act)).toEqual(['more-tab', 'more-setup', 'more-share']);
    await key('Escape');
    // pages again: apart, each ruled alike, and counted
    await act(async () => { useApp.setState((s) => ({ docs: { ...s.docs, [NB]: { ...s.docs[NB]!, written: { id: ID, paper: 'ruled', sheets: [1, 2, 3], rule: 25 } } } })); });
    await wait(30);
    expect(qa<HTMLElement>('.pdf-page').map((p) => p.style.top)).toEqual(['0px', `${H + GAP}px`, `${2 * (H + GAP)}px`]);
    expect(qa('.pdf-page > svg.paper .paper-rule').map((r) => r.getAttribute('d')!.split('H')[0])).toEqual(['M0 72.5', 'M0 72.5', 'M0 72.5']);
    expect(q('.add-page')).not.toBeNull();
    expect(q('.meta .pt-page')!.textContent).toBe('p. 1 / 3');
    expect(q<HTMLElement>('.pdf-view')!.dataset.layout).not.toBe('pageless');
    expect(q('.meta [data-tool="pages"]')).not.toBeNull();
  });

  it('`more` adds a page after the one in view, and makes that one again with what is written on it', async () => {
    await fs.setPageInk(ID, 1, [stroke(1), stroke(2)]);
    await mount(NB);
    await click(more());
    await click(menuRow('page-add-after')!);
    await wait(30);
    expect(asked.after).toEqual([1]);
    expect(sheetsShown()).toEqual([1, 4, 2, 3]);
    expect(q('.meta .pt-page')!.textContent).toBe('p. 1 / 4');
    await click(more());
    await click(menuRow('page-duplicate')!);
    await wait(40);
    expect(asked.again).toEqual([1]);
    expect(sheetsShown()).toEqual([1, 5, 4, 2, 3]);
    expect((await fs.pageInk(ID, 5)).map((s) => s.stroke)).toEqual(['s1', 's2']);
    // the copy is a page of its own in the column, with its own picture
    expect(q<SVGSVGElement>('svg.page-ink[data-page="2"]')!.dataset.sheet).toBe('5');
    expect(asked.addSheet).toBe(0);
  });

  it('the bar\'s pages button and `all pages` open the overview over the pages; a page pressed there is gone to, and it closes', async () => {
    await fs.setPageInk(ID, 3, [stroke(4)]);
    await mount(NB);
    const pages = () => q<HTMLButtonElement>('.meta [data-tool="pages"]')!;
    expect([pages().getAttribute('aria-label'), pages().title, pages().getAttribute('aria-pressed')]).toEqual(['all pages', 'all pages', 'false']);
    expect(q('.page-grid')).toBeNull();
    await click(pages());
    await wait(20);
    const grid = q<HTMLElement>('.page-grid')!;
    expect(grid.getAttribute('role')).toBe('dialog');
    expect(grid.dataset.written).toBe('1');
    // drawn in the book, over its pages, and no place for the Pencil
    expect(grid.closest('.book')).not.toBeNull();
    expect(grid.hasAttribute('data-ink-over')).toBe(true);
    expect(pages().getAttribute('aria-pressed')).toBe('true');
    expect(qa<HTMLElement>('[data-pg]').map((t) => [t.dataset.pg, t.dataset.sheet, t.dataset.current])).toEqual([['1', '1', '1'], ['2', '2', undefined], ['3', '3', undefined]]);
    expect(q('.pg-count')!.textContent).toBe('3');
    expect(qa<HTMLElement>('[data-pg-paper]').map((b) => [b.dataset.pgPaper, b.getAttribute('aria-pressed')])).toEqual([['blank', 'false'], ['ruled', 'true'], ['grid', 'false'], ['dotted', 'false']]);
    // pressed again it closes; `more` opens it too
    await click(pages());
    expect(q('.page-grid')).toBeNull();
    await click(more());
    await click(menuRow('more-pages')!);
    await wait(20);
    expect(q('.page-grid')).not.toBeNull();
    // the tile after the last page adds one
    await click(q('[data-pg-do="add"]')!);
    await wait(20);
    expect(asked.addSheet).toBe(1);
    expect(qa('[data-pg]').length).toBe(4);
    // a page's own `more` there deletes it as the bar's does: one with writing asks first
    await click(q('[data-pg="3"] [data-pg-do="more"]')!);
    expect(menuRows().map((r) => r.dataset.act)).toEqual(['pg-add-after', 'pg-duplicate', 'pg-delete']);
    await click(menuRow('pg-delete')!);
    await wait(20);
    expect(asked.removed).toEqual([]);
    expect(menuRow('page-delete-sure')!.textContent).toBe('delete page 3 with its writing?');
    await key('Escape');
    await click(q('[data-pg="2"] [data-pg-do="more"]')!);
    await click(menuRow('pg-delete')!);
    await wait(30);
    expect(asked.removed).toEqual([2]);
    expect(qa<HTMLElement>('[data-pg]').map((t) => t.dataset.sheet)).toEqual(['1', '3', '4']);
    // a page pressed: the overview goes
    await click(q('[data-pg="2"] .pg-go')!);
    await wait(20);
    expect(q('.page-grid')).toBeNull();
    expect(pages().getAttribute('aria-pressed')).toBe('false');
  });

  it('`delete this page` takes a bare page at once, asks for one that holds something, and the notice undoes it', async () => {
    await fs.setPageInk(ID, 2, [stroke(1)]);
    await mount(NB);
    // the page in view is the first, which holds nothing
    await click(more());
    await click(menuRow('page-delete')!);
    await wait(30);
    expect(asked.removed).toEqual([1]);
    expect(sheetsShown()).toEqual([2, 3]);
    expect(useApp.getState().notice).toMatchObject({ line: 'page 1 deleted', undo: true });
    await act(async () => { await undoNotice(); });
    await wait(30);
    expect(sheetsShown()).toEqual([1, 2, 3]);
    // sheet 2 is written on: with it in view the row asks, and a second press does it
    await act(async () => { useApp.setState((s) => ({ docs: { ...s.docs, [NB]: { ...s.docs[NB]!, written: { ...written(), sheets: [2, 3] } } } })); });
    await wait(30);
    expect(q<SVGSVGElement>('svg.page-ink[data-page="1"]')!.dataset.sheet).toBe('2');
    await click(more());
    await click(menuRow('page-delete')!);
    await wait(20);
    expect(asked.removed).toEqual([1]);
    const sure = menuRow('page-delete-sure')!;
    expect(sure.textContent).toBe('delete page 1 with its writing?');
    expect(sure.classList.contains('asking')).toBe(true);
    await click(sure);
    await wait(30);
    expect(asked.removed).toEqual([1, 2]);
    expect(sheetsShown()).toEqual([3]);
    expect(await fs.pageInk(ID, 2)).toEqual([]);
    // one page left: there is no deleting it
    await click(more());
    expect(menuRow('page-delete')).toBeNull();
    await key('Escape');
    // undone, the page and what was written on it are back
    await act(async () => { await undoNotice(); });
    await wait(40);
    expect(sheetsShown()).toEqual([2, 3]);
    expect((await fs.pageInk(ID, 2)).map((s) => s.stroke)).toEqual(['s1']);
    expect(q('svg.page-ink[data-page="1"]')).not.toBeNull();
  });

  it('a page that holds a passage asks too, and says so', async () => {
    await mount(NB);
    await act(async () => { await keepPassage(NB, [{ page: 1, x: 0.1, y: 0.1, w: 0.5, h: 0.3 }]); });
    await wait(30);
    await click(more());
    await click(menuRow('page-delete')!);
    expect(menuRow('page-delete-sure')!.textContent).toBe('delete page 1 with 1 passage?');
    expect(asked.removed).toEqual([]);
    await key('Escape');
    await act(async () => { const { putPassage } = await import('../passages.js'); for (const b of await marksNow()) await putPassage(ID, b, null); });
  });

  it('what leaves the column names the sheet, not the place: strokes, a passage kept, a passage read back', async () => {
    // a passage on sheet 2 and one on sheet 3, kept while both are there
    await mount(NB);
    await act(async () => { await keepPassage(NB, [{ page: 2, x: 0.2, y: 0.2, w: 0.3, h: 0.1 }]); await keepPassage(NB, [{ page: 3, x: 0.2, y: 0.5, w: 0.3, h: 0.1 }]); });
    await wait(40);
    expect(qa<HTMLElement>('.pbox[data-kept="1"]').map((b) => b.dataset.page)).toEqual(['2', '3']);
    // the middle page deleted: the page at place 2 is sheet 3
    await act(async () => { useApp.setState((s) => ({ docs: { ...s.docs, [NB]: { ...s.docs[NB]!, written: { ...written(), sheets: [1, 3] } } } })); });
    await wait(40);
    expect(places()).toEqual([1, 2]);
    expect(sheetsShown()).toEqual([1, 3]);
    // sheet 3's passage is drawn at place 2, tagged with that page; the one on the sheet that is gone is not drawn
    const kept = qa<HTMLElement>('.pbox[data-kept="1"]');
    expect(kept.map((b) => b.dataset.page)).toEqual(['2']);
    expect(parseBoxes(kept[0]!.dataset.section!)![0]!.page).toBe(3);
    expect(q<HTMLElement>('.pgut, .ptag')!.title || q<HTMLElement>('.ptag')?.textContent).toContain('p. 2');
    // a box drawn on the page at place 2, `e`: the passage names sheet 3
    await box(2);
    await key('e');
    await wait(60);
    const all = (await marksNow()).map((b) => parseBoxes(b)![0]!);
    expect(all.map((b) => b.page).sort()).toEqual([2, 3, 3]);
    expect(all.some((b) => b.page === 3 && Math.abs(b.x - 0.1) < 0.001 && Math.abs(b.y - 0.1) < 0.001)).toBe(true);
    expect(qa<HTMLElement>('.pbox[data-kept="1"]').map((b) => b.dataset.page)).toEqual(['2', '2']);
    // the file itself was not touched for it
    expect(await fs.readText(`${ROOT}/${NB}`)).toBe(nbText([1, 2, 3]));
    await act(async () => { const { putPassage } = await import('../passages.js'); for (const b of await marksNow()) await putPassage(ID, b, null); });
  });

  it('`m` clips the box into the typed note on the notebook, naming the sheet', async () => {
    await mount(NB, [1, 3]);
    await box(2);
    await key('m');
    await wait(300);
    expect(await fs.readText(`${ROOT}/${TYPED}`)).toContain('<!-- box 3:0.100:0.100:0.500:0.300 -->');
    expect(await fs.readText(`${ROOT}/${NB}`)).toBe(nbText([1, 2, 3]));
    expect(useApp.getState().notice?.line).toContain('clipped · p. 2');
    await vault.update(TYPED, (d) => { d.blocks.splice(1); });
  });

  it('a pdf the collection has not spoken of yet is opening; one it does not hold says it may still be arriving, and opens when it lands', async () => {
    const AWAY = 'library/still-coming.pdf';
    // a tab kept from last time, drawn before the collection has said what it holds
    useApp.setState({ docs: docsWith([1, 2]), mobile: false, phone: false, panes: openTab(emptyPanes(), AWAY), notice: null, bookZooms: {}, docsKnown: false });
    host = document.body.appendChild(document.createElement('div'));
    root = createRoot(host);
    await act(async () => { root!.render(createElement(Pdf, { id: AWAY })); });
    await wait(40);
    expect(q('.empty')?.textContent).toBe('opening');
    expect(host.textContent).not.toContain('no longer in the collection');
    // it has spoken, and has no such file
    await act(async () => { useApp.setState({ docsKnown: true }); });
    expect([q<HTMLElement>('.pdf-fail')?.dataset.why, q('.pf-said')?.textContent]).toEqual(['absent', 'this pdf is not in the collection']);
    expect(q('.pf-detail')?.textContent).toContain('still be arriving');
    // the file lands: the collection knows it, and it is its pages with nothing pressed
    await act(async () => { useApp.setState((st) => ({ docs: { ...st.docs, [AWAY]: { type: 'source', frozen: false, cards: 0, due: 0, pdf: AWAY } } })); });
    await wait(60);
    expect(q('.pdf-fail')).toBeNull();
    expect(qa('.pdf-page').length).toBe(2);
  });

  it('a pdf marked as opening when the page was taken down is not opened by itself again; `try again` opens it', async () => {
    // (the first the page asks the app in this file: it went down, with this file half open)
    pageFell = true;
    localStorage.setItem('ilmi.pdf.opening', PDF);
    try {
      const before = acquired;
      await mount(PDF);
      await wait(40);
      expect(acquired).toBe(before);
      expect([q<HTMLElement>('.pdf-fail')?.dataset.why, q('.pf-said')?.textContent]).toEqual(['fell', 'this pdf closed the page the last time it was opened']);
      await act(async () => { q<HTMLButtonElement>('.pf-again')!.click(); });
      await wait(60);
      expect(acquired).toBe(before + 1);
      expect(q('.pdf-fail')).toBeNull();
      expect(qa('.pdf-page').length).toBe(2);
    } finally {
      pageFell = false;
      localStorage.removeItem('ilmi.pdf.opening');
    }
  });

  it('a pdf being read has `later` and `dismiss` in its `more`; one that is not, neither', async () => {
    await mount(PDF);
    await click(more());
    expect(menuRow('more-pages')).not.toBeNull();
    expect([menuRow('more-later'), menuRow('more-dismiss')]).toEqual([null, null]);
    await act(async () => { document.body.dispatchEvent(new MouseEvent('mousedown', { bubbles: true })); });
    act(() => root?.unmount());
    host.remove();
    // enrolled to be read: the two are the first of its menu, in the session's words
    await mount(PDF);
    await act(async () => { useApp.setState((st) => ({ docs: { ...st.docs, [PDF]: { ...st.docs[PDF]!, read: { due: '2026-01-01', ivl: 2, reps: 1, pos: 1 } } } })); });
    await click(more());
    expect(menuRows().slice(0, 2).map((r) => [r.dataset.act, r.textContent])).toEqual([['more-later', 'later'], ['more-dismiss', 'dismiss']]);
    await act(async () => { document.body.dispatchEvent(new MouseEvent('mousedown', { bubbles: true })); });
  });

  it('a pdf that does not open says why, offers `try again`, and is tried again by itself when its bytes arrive', async () => {
    const err = vi.spyOn(console, 'error').mockImplementation(() => {});
    try {
      // its bytes are not on this device yet
      failWith = new Error('this file is not in the storage yet');
      await mount(PDF);
      await wait(40);
      const fail = q<HTMLElement>('.pdf-fail')!;
      expect(fail.dataset.why).toBe('away');
      expect([q('.pf-said')?.textContent, q('.pf-detail')?.textContent, q('.pf-again')?.textContent]).toEqual(['not on this device yet', 'still arriving from the device it was added on', 'try again']);
      expect(host.textContent).not.toContain('no longer in the collection');
      // pressed while it still cannot: asked for again, and says the same
      const before = acquired;
      await act(async () => { q<HTMLButtonElement>('.pf-again')!.click(); });
      await wait(60);
      expect(acquired).toBe(before + 1);
      expect(q('.pf-said')?.textContent).toBe('not on this device yet');
      // the file is listed as away, then lands: tried again with no press, and the pages are there
      await act(async () => { useApp.setState({ away: [PDF] }); });
      failWith = null;
      await act(async () => { useApp.setState({ away: [] }); });
      await act(async () => { await new Promise((r) => setTimeout(r, 750)); });
      await wait(60);
      expect(q('.pdf-fail')).toBeNull();
      expect(qa('.pdf-page').length).toBe(2);
      act(() => root?.unmount());
      host.remove();
      // a file that is here and does not read as a pdf
      failWith = Object.assign(new Error('Invalid PDF structure.'), { name: 'InvalidPDFException' });
      await mount(PDF);
      await wait(40);
      expect([q<HTMLElement>('.pdf-fail')?.dataset.why, q('.pf-said')?.textContent]).toEqual(['broken', 'this file does not read as a pdf']);
      expect(q('.pf-again')).not.toBeNull();
    } finally {
      failWith = null;
      useApp.setState({ away: [] });
      err.mockRestore();
    }
  });

  it('under a finger the rows over the pages are the pane\'s own, outside the scroller; on a Mac they stick in it as they did', async () => {
    // a phone: the pages are the page's own (no surface), and a scroller pulled past its edge takes what sticks in it along
    await mount(NB, [1, 2], 'ruled', true, true);
    const book = q<HTMLElement>('.book')!;
    const head = q<HTMLElement>('.book > .book-head');
    expect(head).not.toBeNull();
    expect(head!.querySelector(':scope > .meta')).not.toBeNull();
    expect(q('.book-pages .meta')).toBeNull();
    expect(qa('.meta').length).toBe(1);
    // the head comes after the scroller: the book's first view is still its pages'
    expect(Array.from(book.children).map((c) => c.className.split(' ').pop())).toEqual(['book-pages', 'book-head']);
    expect(book.querySelector('.pdf-view')!.closest('.book-pages')).not.toBeNull();
    // as wide as the pane by the pane's own layout: no width or margin of its own
    expect(q<HTMLElement>('.book-head > .meta')!.getAttribute('style')).toBeNull();
    act(() => root?.unmount());
    host.remove();
    // a Mac: as it was
    await mount(NB, [1, 2]);
    expect(q('.book-head')).toBeNull();
    expect(q('.book-pages .pdf-view > .meta')).not.toBeNull();
    expect(qa('.meta').length).toBe(1);
  });

  it('on a Mac it is shown and cannot be written on: the bar says so, once, and has no tools', async () => {
    await fs.setPageInk(ID, 3, [stroke(7)]);
    await mount(NB, [1, 3]);
    expect(q('.meta .pt-readonly')!.textContent).toBe('written on an ipad');
    expect(qa('.pt-readonly').length).toBe(1);
    expect(q('.inkbar')).toBeNull();
    expect(q<HTMLElement>('.meta')!.dataset.ink).toBeUndefined();
    expect(scenes).toEqual([]);
    // what was written elsewhere is drawn by the page over the paper, a path a stroke, found by the sheet's number
    const svg = q<SVGSVGElement>('svg.page-ink[data-page="2"]')!;
    expect(svg.dataset.sheet).toBe('3');
    expect(svg.getAttribute('viewBox')).toBe(`0 0 ${W} ${H}`);
    await wait(40);
    expect(Array.from(svg.querySelectorAll<SVGElement>('[data-n]')).map((x) => x.dataset.n)).toEqual(['s7']);
    expect(q('.page-ink[data-page="1"]')).toBeNull();
    expect(q('img.page-ink')).toBeNull();
    // and no button to bring tools back: there are none
    expect(q('.meta [data-tool="ink-tools"]')).toBeNull();
  });

  it('what is written on a page is drawn from its strokes, as fine as any screen: no picture of it is asked for, however dense the screen', async () => {
    await fs.setPageInk(ID, 1, [stroke(7)]);
    const real = fs.pageInkFile.bind(fs);
    const asks: unknown[][] = [];
    fs.pageInkFile = (...a: Parameters<StoreFs['pageInkFile']>) => { asks.push(a); return real(...a); };
    try {
      for (const dpr of [1, 3]) {
        Object.defineProperty(window, 'devicePixelRatio', { value: dpr, configurable: true });
        await mount(NB, [1, 2]);
        await wait(40);
        expect(Array.from(q<SVGSVGElement>('svg.page-ink[data-page="1"]')!.querySelectorAll<SVGElement>('[data-n]')).map((x) => x.dataset.n)).toEqual(['s7']);
        expect(q('img.page-ink')).toBeNull();
        expect(asks.filter((a) => a[2] === 'picture')).toEqual([]);
        act(() => root?.unmount());
        host.remove();
      }
    } finally {
      fs.pageInkFile = real;
      Object.defineProperty(window, 'devicePixelRatio', { value: 1, configurable: true });
    }
  });
});

/** The surface a notebook's pages are on an iPad (87): what it was last told, its name, and something said by it. */
const spec = () => told.filter((t): t is SurfaceSpec => 'sheets' in t).at(-1)!;
const sid = () => q<HTMLElement>('.pdf-view')!.dataset.surface!;
const says = (what: string, more: Record<string, unknown> = {}) => pencil({ kind: 'surface', id: sid(), what, ...more });
/** The sheets given their strokes, in the sheets' order; and what the surface was asked to do. */
const fills = () => asks.filter((a) => a.cmd === 'ink_fill').map((a) => a.args).sort((a, b) => String(a.sheet).localeCompare(String(b.sheet)));
const does = () => asks.filter((a) => a.cmd === 'ink_surface_do').map((a) => a.args.ask);
const unmount = () => { act(() => root?.unmount()); root = null; host.remove(); };
const forget = () => act(async () => { const { putPassage } = await import('../passages.js'); for (const b of await marksNow()) await putPassage(ID, b, null); });

describe('a written notebook under the Pencil', () => {
  it('has the tools as the bar\'s second row and no words about an ipad; a phone has neither', async () => {
    await mount(NB, [1, 2, 3], 'ruled', true);
    expect(q('.pt-readonly')).toBeNull();
    const meta = q<HTMLElement>('.meta.pdf-tools')!;
    expect(meta.dataset.ink).toBe('1');
    expect(Array.from(meta.children).map((c) => c.className)).toEqual(['pt-row', 'inkbar']);
    expect(q<HTMLElement>('.inkbar')!.dataset.for).toBe(NB);
    expect(q<HTMLElement>('.pdf-view')!.dataset.tools).toBe('1');
    // the button that brings the row back is the bar's first row's, before the pages' and the page
    expect(qa<HTMLElement>('.pt-row [data-tool]').map((b) => b.dataset.tool).filter((t) => ['ink-tools', 'pages', 'page', 'more'].includes(t!))).toEqual(['ink-tools', 'pages', 'page', 'more']);
    await act(async () => { useApp.setState({ phone: true }); });
    expect(q('.inkbar')).toBeNull();
    expect(q<HTMLElement>('.meta')!.dataset.ink).toBeUndefined();
    expect(q('.pt-readonly')).toBeNull();
    expect(q('.meta [data-tool="ink-tools"], .meta [data-tool="pages"]')).toBeNull();
  });

  it('with the tools tucked away the bar is one row again, and the pages are still the surface\'s', async () => {
    await mount(NB, [2, 3], 'ruled', true);
    await wait(20);
    const was = sid();
    expect(spec().id).toBe(was);
    await act(async () => { useInkTools.setState((t) => ({ kept: { ...t.kept, shown: false } })); });
    await wait(20);
    const meta = q<HTMLElement>('.meta.pdf-tools')!;
    expect(q('.inkbar')).toBeNull();
    expect(meta.dataset.ink).toBeUndefined();
    expect(q<HTMLElement>('.pdf-view')!.dataset.tools).toBeUndefined();
    expect(Array.from(meta.children).map((c) => c.className)).toEqual(['pt-row']);
    expect(q('.meta [data-tool="ink-tools"]')).not.toBeNull();
    expect(q('.pt-readonly')).toBeNull();
    // the same surface, holding the same sheets, and never told to go
    expect(sid()).toBe(was);
    expect(q('.reader-wrap')!.getAttribute('data-native')).toBe('1');
    expect(q('.note-surface')).not.toBeNull();
    expect([spec().id, spec().sheets]).toEqual([was, [2, 3]]);
    expect(told.every((t) => 'sheets' in t)).toBe(true);
    // shown again, the row is back
    await act(async () => { useInkTools.setState((t) => ({ kept: { ...t.kept, shown: true } })); });
    expect(q<HTMLElement>('.meta > .inkbar')!.dataset.for).toBe(NB);
  });

  it('its pages are one surface, told where it lies, its sheets under their own numbers and their paper; none of them is drawn here', async () => {
    await mount(NB, [1, 3], 'ruled', true);
    await wait(20);
    expect(q<HTMLElement>('.pdf-view')!.dataset.surface).toBe(spec().id);
    expect(spec()).toMatchObject({ at: { x: 0, y: 60, w: 700, h: 840 }, key: ID, sheets: [1, 3], zoom: 1, marks: [], holes: [], add: true });
    expect(spec().paper).toEqual(paperArgs(paperOf(written(), 0)));
    expect(spec().paper).toEqual({ kind: 'ruled', w: W, h: H, rule: 24, left: 0, right: 0, top: 72, bottom: 24, lines: [], run: false });
    // the place it lies over, and nothing of the pages themselves: no column, no paper, no picture of the writing, no `add page`
    expect(q('.doc-wrap > .note-surface')).not.toBeNull();
    expect(q('.pdf-pages, svg.paper, img.page-ink, button.add-page, .pdf-page')).toBeNull();
    // and no canvas is asked to lie over a page
    expect(scenes.flatMap((s) => s.hosts)).toEqual([]);
    // the bar is the lens's still
    expect(q('.meta .pt-page')!.textContent).toBe('p. 1 / 2');
    // a sheet added is told; what is told once is not told again
    const n = told.length;
    await act(async () => { useApp.setState((s) => ({ docs: { ...s.docs, [NB]: { ...s.docs[NB]!, written: { ...written(), sheets: [1, 3, 4] } } } })); });
    await wait(20);
    expect(spec().sheets).toEqual([1, 3, 4]);
    expect(told.length).toBe(n + 1);
    await act(async () => { useApp.setState({ notice: null }); });
    await wait(20);
    expect(told.length).toBe(n + 1);
  });

  it('a sheet the surface wants is given what the store holds, under its own number, and again when that changes; one it has not asked for is given nothing', async () => {
    await fs.setPageInk(ID, 1, [stroke(1)]);
    await mount(NB, [1, 3, 4], 'ruled', true);
    await wait(20);
    expect(fills()).toEqual([]);
    await says('want', { sheets: [sheetId(1), sheetId(3)] });
    await wait(40);
    // shown as it is given; a sheet that holds nothing is told so
    expect(fills()).toEqual([{ sheet: sheetId(1), drawing: b64(memDrawing([stroke(1)])), show: true, names: ['s1'] }, { sheet: sheetId(3), drawing: null, show: true, names: [] }]);
    // what is written at place 2 is sheet 3's, and what the surface gave is not given back to it
    asks.length = 0;
    drawn = [stroke(2), stroke(3)];
    await pencil({ kind: 'quiet', sheet: sheetId(3) });
    await wait(60);
    expect((await fs.pageInk(ID, 3)).map((s) => s.stroke)).toEqual(['s2', 's3']);
    expect(await fs.pageInk(ID, 2)).toEqual([]);
    expect(await fs.inkedPages(ID)).toEqual([1, 3]);
    expect(fills()).toEqual([]);
    // strokes that come from elsewhere (a merge): the sheet is given them
    await fs.setPageInk(ID, 3, [stroke(2), stroke(3), stroke(4)]);
    await wait(60);
    expect(fills()).toEqual([{ sheet: sheetId(3), drawing: b64(memDrawing([stroke(2), stroke(3), stroke(4)])), show: true, names: ['s2', 's3', 's4'] }]);
    // a sheet far from the view, never asked for
    asks.length = 0;
    await fs.setPageInk(ID, 4, [stroke(5)]);
    await wait(60);
    expect(fills()).toEqual([]);
    // wanted again (its picture was let go), it is given whatever was given before
    await says('want', { sheets: [sheetId(1), sheetId(4), 'p.another.1'] });
    await wait(40);
    expect(fills().map((f) => f.sheet)).toEqual([sheetId(1), sheetId(4)]);
    expect(asked.addSheet).toBe(0);
  });

  it('a pageless notebook\'s surface is told its sheets run on as one, with no page to add', async () => {
    await mount(NB, [1, 2, 8], 'ruled', true);
    await wait(20);
    expect([spec().paper.run, spec().add]).toEqual([false, true]);
    await act(async () => { useApp.setState((s) => ({ docs: { ...s.docs, [NB]: { ...s.docs[NB]!, written: { ...written(), pageless: true } } } })); });
    await wait(40);
    expect(spec().sheets).toEqual([1, 2, 8]);
    expect([spec().paper.run, spec().add]).toEqual([true, false]);
    expect(spec().paper).toEqual(paperArgs(paperOf(written(), 0)));
    expect(q<HTMLElement>('.pdf-view')!.dataset.layout).toBe('pageless');
    expect(q('.meta .pt-page, .meta [data-tool="pages"]')).toBeNull();
  });

  it('a stroke begun low on the last page adds the next, once for that page', async () => {
    await mount(NB, [1, 2], 'ruled', true);
    await wait(20);
    // low on a page that is not the last: nothing
    await says('grow', { sheet: 1 });
    await wait(20);
    expect(asked.addSheet).toBe(0);
    await says('grow', { sheet: 2 });
    await wait(30);
    expect(asked.addSheet).toBe(1);
    expect(spec().sheets).toEqual([1, 2, 3]);
    // the same page again, no longer the last: nothing more
    await says('grow', { sheet: 2 });
    await wait(30);
    expect(asked.addSheet).toBe(1);
    // the new last page, in its turn
    await says('grow', { sheet: 3 });
    await wait(30);
    expect(asked.addSheet).toBe(2);
    expect(spec().sheets).toEqual([1, 2, 3, 4]);
    expect(q('.meta .pt-page')!.textContent).toBe('p. 1 / 4');
  });
});

describe('what an iPad\'s notebook hears of its surface', () => {
  const view = () => q<HTMLElement>('.pdf-view')!;
  const pct = () => q('.meta .pt-pct')!.textContent;
  const page = () => q('.meta .pt-page')!.textContent;
  /** The book's zoom as it is kept: nothing kept is fit. */
  const zoomOf = () => useApp.getState().bookZooms[NB] ?? 1;
  const down = (el: Element) => fire(el, new MouseEvent('mousedown', { bubbles: true, cancelable: true, button: 0 }));
  const B = { page: 2, x: 0.1, y: 0.1, w: 0.5, h: 0.3 };
  /** Where the surface says the last box lies, on the page. */
  const AT = { x: 90, y: 200, w: 300, h: 180 };

  it('`add page` pressed there adds one; a box a held finger drew waits under its bar, which the pages moving hides and a tap lets go of', async () => {
    await mount(NB, [1, 3], 'ruled', true);
    await wait(20);
    await says('add');
    await wait(20);
    expect(asked.addSheet).toBe(1);
    expect(spec().sheets).toEqual([1, 3, 4]);
    // the box is the surface's to draw, as one not yet made into anything
    await says('boxing');
    await says('boxed', B);
    expect(spec().marks).toEqual([{ key: 'pending:0', ...B, pending: true }]);
    // its bar is drawn once the surface says where the box lies: passage and card, with no keys named
    expect(q('.pend')).toBeNull();
    await says('view', { page: 2, pages: 3, zoom: 1, top: 2, y: 0, pend: AT });
    const bar = () => q<HTMLElement>('.note-surface > .pend');
    expect(qa<HTMLElement>('.pend button').map((b) => [b.dataset.k, b.textContent])).toEqual([['e', 'passage'], ['m', 'card']]);
    expect(q('.pend kbd, .pend .kbd')).toBeNull();
    expect([bar()!.style.left, bar()!.style.top, bar()!.hasAttribute('data-ink-over')]).toEqual(['90px', '386px', true]);
    // a box near the foot has it above
    await says('view', { page: 2, pages: 3, zoom: 1, top: 2, y: 0, pend: { ...AT, y: 640 } });
    expect(bar()!.style.top).toBe('588px');
    // the pages move: gone until they rest
    await says('view', { page: 2, pages: 3, zoom: 1, top: 2, y: 0.1, pend: AT, moving: true });
    expect(bar()).toBeNull();
    expect(q<HTMLElement>('.note-surface')!.dataset.moving).toBe('1');
    await says('view', { page: 2, pages: 3, zoom: 1, top: 2, y: 0.1, pend: AT });
    expect(bar()).not.toBeNull();
    await says('moving');
    expect(bar()).toBeNull();
    await says('view', { page: 2, pages: 3, zoom: 1, top: 2, y: 0.1, pend: AT });
    // a second box: each is numbered, and the bar says how many
    await says('boxed', { ...B, y: 0.6, h: 0.2 });
    expect(spec().marks).toEqual([{ key: 'pending:0', ...B, pending: true, no: 1 }, { key: 'pending:1', ...B, y: 0.6, h: 0.2, pending: true, no: 2 }]);
    expect(q('.pend [data-k="e"]')!.textContent).toBe('passage · 2 boxes');
    // a tap on the pages lets go of them
    await says('tap');
    expect(spec().marks).toEqual([]);
    expect(bar()).toBeNull();
    expect(await marksNow()).toEqual([]);
  });

  it('`passage` on the box\'s bar keeps a passage that names the sheet, not the place; `card` clips the sheet into the typed note', async () => {
    await mount(NB, [1, 3], 'ruled', true);
    await wait(20);
    await says('boxed', B);
    await says('view', { page: 2, pages: 2, zoom: 1, top: 2, y: 0, pend: AT });
    await down(q('.pend [data-k="e"]')!);
    await wait(60);
    const kept = await marksNow();
    expect(kept.map((b) => parseBoxes(b)!.map((x) => x.page))).toEqual([[3]]);
    expect(parseBoxes(kept[0]!)![0]).toMatchObject({ page: 3, w: 0.5, h: 0.3 });
    // the box is the passage's now, drawn where its sheet lies, and lit
    expect(q('.pend')).toBeNull();
    expect(spec().marks).toEqual([{ key: kept[0], ...B, tag: '§ p. 2', cur: true }]);
    expect(useApp.getState().notice?.line).toContain('§ p. 2');
    await forget();
    await wait(30);
    expect(spec().marks).toEqual([]);
    // `card`
    await says('boxed', B);
    await says('view', { page: 2, pages: 2, zoom: 1, top: 2, y: 0, pend: AT });
    await down(q('.pend [data-k="m"]')!);
    await wait(300);
    expect(await fs.readText(`${ROOT}/${TYPED}`)).toContain('<!-- box 3:0.100:0.100:0.500:0.300 -->');
    expect(useApp.getState().notice?.line).toContain('clipped · p. 2');
    expect(spec().marks).toEqual([]);
    // the file itself was not touched for either
    expect(await fs.readText(`${ROOT}/${NB}`)).toBe(nbText([1, 2, 3]));
    await vault.update(TYPED, (d) => { d.blocks.splice(1); });
  });

  it('a passage kept is the surface\'s to draw, with its tag; the tag pressed there opens its menu here, and lights it', async () => {
    await mount(NB, [1, 3], 'ruled', true);
    await act(async () => { await keepPassage(NB, [{ page: 3, x: 0.2, y: 0.5, w: 0.3, h: 0.1 }]); await keepPassage(NB, [{ page: 2, x: 0.2, y: 0.2, w: 0.3, h: 0.1 }]); });
    await wait(40);
    // sheet 3's is drawn at place 2; the one on a sheet that is not there is not
    expect(spec().marks.length).toBe(1);
    const m = spec().marks[0]!;
    expect(m).toMatchObject({ page: 2, x: 0.2, y: 0.5, w: 0.3, h: 0.1 });
    expect(parseBoxes(m.key)![0]!.page).toBe(3);
    expect(m.tag).toBe('§ p. 2');
    expect([m.cur, m.pending, m.dis]).toEqual([undefined, undefined, undefined]);
    // a tag that is no passage's: nothing
    await says('tag', { key: 'pending:0', x: 400, y: 300, w: 60, h: 20 });
    expect(menuRows()).toEqual([]);
    await says('tag', { key: m.key, x: 400, y: 300, w: 60, h: 20 });
    expect(menuRows().map((r) => r.dataset.act)).toEqual(['passage-when', 'passage-dismiss', 'passage-remove']);
    expect(spec().marks[0]).toMatchObject({ key: m.key, cur: true });
    // dismissed from there, it is drawn so
    await click(menuRow('passage-dismiss')!);
    await wait(60);
    expect(spec().marks[0]).toMatchObject({ key: m.key, dis: true });
    await forget();
  });

  it('the page in view, the zoom and the place are what the surface says; the bar\'s steps and `g` are asked of it', async () => {
    await mount(NB, [1, 2, 5], 'ruled', true);
    await wait(20);
    expect([page(), pct(), zoomOf()]).toEqual(['p. 1 / 3', '100%', 1]);
    expect(q('.sheet-place')).toBeNull();
    // the pages move under two fingers: the bar says the page and what the zoom would be, and nothing is kept or asked
    await says('view', { page: 2, pages: 3, zoom: 1.37, top: 2, y: 0.25, x: 0.5, lay: [30, 18, 640, 828, 846] });
    expect([page(), pct(), zoomOf()]).toEqual(['p. 2 / 3', '137%', 1]);
    expect(view().dataset.page).toBe('2');
    // where each sheet lies under the surface is marked here, for what asks where a page is: nothing is drawn in it
    expect(qa<HTMLElement>('.note-surface > .pdf-page.sheet-place').map((p) => [p.dataset.page, p.dataset.sheet, p.style.left, p.style.top, p.style.width, p.style.height])).toEqual([
      ['1', '1', '30px', '18px', '640px', '828px'], ['2', '2', '30px', '864px', '640px', '828px'], ['3', '5', '30px', '1710px', '640px', '828px'],
    ]);
    expect(qa<HTMLElement>('.sheet-place').map((p) => [p.getAttribute('aria-hidden'), p.dataset.paper, p.childElementCount])).toEqual([['true', 'ruled', 0], ['true', 'ruled', 0], ['true', 'ruled', 0]]);
    await says('view', { page: 2, pages: 3, zoom: 1.37, top: 2, y: 0.5, x: 0.5, lay: [10, -400, 877, 1135, 1160] });
    expect(qa<HTMLElement>('.sheet-place').map((p) => p.style.top)).toEqual(['-400px', '760px', '1920px']);
    // let go: that is the zoom, kept, and the surface is not asked for what it said itself
    await says('zoomed', { zoom: 1.37 });
    await wait(20);
    expect([zoomOf(), pct(), view().dataset.zoom, spec().zoom]).toEqual([1.37, '137%', '1.37', 1.37]);
    expect(does()).toEqual([]);
    // a step from there is the next one past it, and that the surface is asked for
    await click(q('.meta [data-tool="zoom-in"]')!);
    await wait(20);
    expect(zoomOf()).toBe(1.5);
    expect(does()).toEqual([{ id: sid(), op: 'zoom', zoom: 1.5, animated: true }]);
    await says('zoomed', { zoom: 1.5 });
    await click(q('.meta [data-tool="zoom-fit"]')!);
    await wait(20);
    expect(does().slice(1)).toEqual([{ id: sid(), op: 'zoom', zoom: 1, animated: true }]);
    // `g` and a page: the surface goes to its top
    asks.length = 0;
    await key('g');
    const field = q<HTMLInputElement>('.pdf-bar input[type="number"]')!;
    expect([field.min, field.max]).toEqual(['1', '3']);
    field.value = '3';
    await fire(field, new KeyboardEvent('keydown', { key: 'Enter', bubbles: true, cancelable: true }));
    await wait(20);
    expect(does()).toEqual([{ id: sid(), op: 'go', place: { page: 3, y: 0 }, animated: false }]);
    // past the last page is the last
    await click(q('.meta [data-tool="page"]')!);
    const again = q<HTMLInputElement>('.pdf-bar input[type="number"]')!;
    again.value = '9';
    await fire(again, new KeyboardEvent('keydown', { key: 'Enter', bubbles: true, cancelable: true }));
    await wait(20);
    expect(does().at(-1)).toEqual({ id: sid(), op: 'go', place: { page: 3, y: 0 }, animated: false });
  });

  it('closed, the surface is told to go by its name alone; opened again it is another, told to open where the pages were left', async () => {
    await mount(NB, [1, 2, 5], 'ruled', true);
    await wait(20);
    const was = sid();
    await says('view', { page: 2, pages: 3, zoom: 1, top: 2, y: 0.25, x: 0.5 });
    await says('view', { page: 3, pages: 3, zoom: 1, top: 2, y: 0.75, x: 0.5 });
    unmount();
    expect(told.at(-1)).toEqual({ id: was });
    // what it says once gone is heard by no one
    await pencil({ kind: 'surface', id: was, what: 'add' });
    expect(asked.addSheet).toBe(0);
    told.length = 0;
    await mount(NB, [1, 2, 5], 'ruled', true);
    await wait(20);
    expect(sid()).not.toBe(was);
    expect(spec().id).toBe(sid());
    expect(spec().open).toEqual({ page: 2, y: 0.75, x: 0.5 });
    expect(told.some((t) => t.id === was)).toBe(false);
  });

  it('on a Mac and on a phone there is no surface: the pages are this page\'s, as they were', async () => {
    await mount(NB, [1, 2, 3]);
    await wait(20);
    const asBefore = () => [told.length, q('.note-surface'), view().dataset.surface, q('.reader-wrap')!.getAttribute('data-native'), places(), qa('.pdf-pages > .pdf-page > svg.paper').length];
    expect(asBefore()).toEqual([0, null, undefined, null, [1, 2, 3], 3]);
    expect(q('button.add-page')).not.toBeNull();
    unmount();
    await mount(NB, [1, 2, 3], 'ruled', true, true);
    await wait(20);
    expect(asBefore()).toEqual([0, null, undefined, null, [1, 2, 3], 3]);
    expect(q('button.add-page')).not.toBeNull();
    // an iPad's again (the window made wide): the surface is asked for, and the pages here go
    await act(async () => { useApp.setState({ phone: false }); });
    await wait(20);
    expect([spec().sheets, view().dataset.surface, q('.pdf-pages')]).toEqual([[1, 2, 3], spec().id, null]);
  });
});

describe('a PDF\'s pages', () => {
  it('are as they were: read by pdf.js, numbered by themselves, with no paper and nothing to add', async () => {
    await mount(PDF);
    expect(acquired).toBe(1);
    expect(places()).toEqual([1, 2]);
    expect(qa<HTMLElement>('.pdf-page').map((p) => [p.dataset.sheet, p.dataset.paper])).toEqual([[undefined, undefined], [undefined, undefined]]);
    expect(q('svg.paper, .add-page, .pt-readonly, .inkbar')).toBeNull();
    for (const tool of ['contents', 'search', 'more']) expect(q(`.meta [data-tool="${tool}"]`)).not.toBeNull();
    await click(more());
    expect(menuRows().map((r) => r.dataset.act)).toEqual(['more-pages', 'more-share', 'more-bookmark', 'more-portal-from', 'more-ruler', 'more-beside']);
    expect(menuRows().slice(0, 2).map((r) => r.textContent)).toEqual(['all pages', 'export as pdf']);
    // the overview: its pages as pdf.js draws them, with no paper to choose and nothing to add or change
    await click(menuRow('more-pages')!);
    await wait(20);
    const grid = q<HTMLElement>('.page-grid')!;
    expect(grid.dataset.written).toBeUndefined();
    expect(qa<HTMLElement>('[data-pg]').map((t) => [t.dataset.pg, t.dataset.sheet, t.dataset.current])).toEqual([['1', undefined, '1'], ['2', undefined, undefined]]);
    expect(qa('[data-pg] canvas').length).toBe(2);
    expect(q('.page-grid svg.paper, [data-pg-paper], [data-pg-do="add"], [data-pg-do="more"]')).toBeNull();
    await click(q('[data-pg-do="close"]')!);
    expect(q('.page-grid')).toBeNull();
    await box(1);
    expect(qa<HTMLElement>('.pend button').map((b) => b.dataset.k)).toEqual(['e', 'm', 'h', 'esc']);
  });

  it('`+` beside the notes\' word has `new note` and `new written notes`, which asks for a notebook on these pages', async () => {
    await mount(PDF);
    const plus = q<HTMLButtonElement>('.meta .notes-add')!;
    expect(plus.title).toBe('new notes');
    await click(plus);
    expect(menuRows().map((r) => [r.dataset.act, r.textContent])).toEqual([['new-note', 'new note'], ['new-written', 'new written notes']]);
    await click(menuRow('new-written')!);
    await wait(20);
    expect(asked.addWritten).toEqual([PDF]);
    expect(useApp.getState().paletteOpen).toBeFalsy();
  });

  it('on an iPad have the tools\' row too, once the file\'s hash is known', async () => {
    await mount(PDF, [1, 2, 3], 'ruled', true);
    await wait(40);
    const meta = q<HTMLElement>('.meta.pdf-tools')!;
    expect(meta.dataset.ink).toBe('1');
    expect(q<HTMLElement>('.meta > .inkbar')!.dataset.for).toBe(PDF);
    expect(q('.pt-readonly')).toBeNull();
  });

  it('on an iPad with book pages: web are this page\'s still: no surface is asked for', async () => {
    localStorage.setItem('ilmi.pdf.native', '0');
    try {
      await mount(PDF, [1, 2, 3], 'ruled', true);
      await wait(40);
      expect(told).toEqual([]);
      expect(q('.note-surface')).toBeNull();
      expect([q<HTMLElement>('.pdf-view')!.dataset.surface, q('.reader-wrap')!.getAttribute('data-native')]).toEqual([undefined, null]);
      expect(qa('.pdf-pages > .pdf-page').length).toBe(2);
      expect(asks.filter((a) => a.cmd === 'ink_surface_do')).toEqual([]);
    } finally {
      localStorage.removeItem('ilmi.pdf.native');
    }
  });

  it('on an iPad with nothing said are the native page view (the default since 2026-11-22), not a notebook\'s surface', async () => {
    localStorage.removeItem('ilmi.pdf.native');
    await mount(PDF, [1, 2, 3], 'ruled', true);
    await wait(40);
    expect(told).toEqual([]);
    expect(q('.pdf-surface')).not.toBeNull();
    expect([q<HTMLElement>('.pdf-view')!.dataset.surface, q('.reader-wrap')!.getAttribute('data-native')]).toEqual([undefined, '1']);
    expect(asks.filter((a) => a.cmd === 'ink_surface_do')).toEqual([]);
  });
});

describe('a clip of a written page, in a note', () => {
  type Call = [string, ...unknown[]];
  const calls: Call[] = [];
  const ctx = {
    fillStyle: '',
    fillRect(...a: number[]) { calls.push(['fillRect', this.fillStyle, ...a]); },
    drawImage(img: { said?: string }, ...a: number[]) { calls.push(['drawImage', img.said, ...a.map((n) => Math.round(n * 10) / 10)]); },
    beginPath() {}, arc() {}, fill() {},
    // (a clip on dark paper reads its ink's pixels to turn them: black, white, and nothing)
    globalCompositeOperation: 'source-over',
    getImageData() { return { data: new Uint8ClampedArray([0, 0, 0, 255, 255, 255, 255, 255, 0, 0, 0, 0]) }; },
    putImageData(img: { data: Uint8ClampedArray }) { calls.push(['putImageData', ...Array.from(img.data)]); },
  };
  let real: typeof import('../bookPdf.js');
  beforeAll(async () => {
    real = await vi.importActual<typeof import('../bookPdf.js')>('../bookPdf.js');
    HTMLCanvasElement.prototype.getContext = (() => ctx) as unknown as HTMLCanvasElement['getContext'];
    // the sheet's picture: twice the sheet's points across, known by what it was made from
    (globalThis as { createImageBitmap?: unknown }).createImageBitmap = async (b: Blob) => ({ width: 1224, height: 1584, said: await b.text() });
    Object.defineProperty(window, 'devicePixelRatio', { value: 2, configurable: true });
  });
  beforeEach(() => {
    calls.length = 0;
    useApp.setState({ docs: docsWith([1, 3]) });
    host = document.body.appendChild(document.createElement('div'));
    root = createRoot(host);
  });
  const crop = (boxText: string) => { const el = host.appendChild(document.createElement('div')); el.className = 'crop'; el.dataset.box = boxText; return el; };
  const settled = async (el: HTMLElement) => { for (let i = 0; i < 50 && (el.dataset.drawn ?? '0') === '0'; i++) await new Promise((r) => setTimeout(r, 10)); };

  it('is the paper of that part of the sheet and what is written there, and no PDF is opened for it', async () => {
    await fs.setPageInk(ID, 3, [stroke(4)]);
    const el = crop('3:0.100:0.100:0.500:0.300');
    const ask = fs.pageInkFile.bind(fs);
    const asked: unknown[][] = [];
    fs.pageInkFile = (...a: Parameters<StoreFs['pageInkFile']>) => { asked.push(a); return ask(...a); };
    try {
      real.fillCrops(host, NB);
      await settled(el);
    } finally {
      fs.pageInkFile = ask;
    }
    // the sheet's writing is asked for as fine as the clip is drawn: its own scale on this screen, in whole steps
    expect(asked).toEqual([[ID, 3, 'picture', W, H, Math.ceil(Math.min(2.5, 560 / (0.5 * W + 8)) * 2)]]);
    expect(el.dataset.drawn).toBe('1');
    expect(el.dataset.sheet).toBe('3');
    expect(el.dataset.inked).toBe('1');
    const canvas = el.querySelector('canvas')!;
    // 0.5 of the sheet and the room round it, at the note's width, two pixels to the css one
    const bw = 0.5 * W + 8;
    const k = Math.min(2.5, 560 / bw);
    expect(canvas.style.width).toBe(`${bw * k}px`);
    expect(canvas.width).toBe(Math.ceil(bw * k * 2));
    // the paper first: white, then the rules that cross the box (96 to 312 points)
    expect(calls[0]!.slice(0, 2)).toEqual(['fillRect', PAPER_WHITE]);
    const rules = calls.filter((c) => c[0] === 'fillRect' && c[1] === PAPER_RULE);
    expect(rules.length).toBe(10);
    expect(rules.every((c) => c[5] === 1)).toBe(true);
    // then the sheet's picture, the box's part of it: twice the points, from the box's corner less the room
    const ink = calls.at(-1)!;
    expect(ink.slice(0, 6)).toEqual(['drawImage', new TextDecoder().decode(memPagePicture([stroke(4)], W, H)), (0.1 * W - 4) * 2, (0.1 * H - 4) * 2, bw * 2, (0.3 * H + 8) * 2].map((v) => (typeof v === 'number' ? Math.round(v * 10) / 10 : v)));
    await expect(real.acquirePdf(NB).promise).rejects.toThrow('written notes');
  });

  it('is drawn again when that sheet\'s strokes change, and not for another sheet\'s', async () => {
    const el = crop('3:0.100:0.100:0.500:0.300');
    await real.drawCrop(el, NB, parseBoxes('3:0.100:0.100:0.500:0.300')![0]!, 400);
    expect(el.dataset.inked).toBe('0');
    expect(calls.some((c) => c[0] === 'drawImage')).toBe(false);
    const was = el.querySelector('canvas');
    await fs.setPageInk(ID, 1, [stroke(5)]);
    await new Promise((r) => setTimeout(r, 40));
    expect(el.querySelector('canvas')).toBe(was);
    await fs.setPageInk(ID, 3, [stroke(6)]);
    for (let i = 0; i < 50 && el.dataset.inked !== '1'; i++) await new Promise((r) => setTimeout(r, 10));
    expect(el.dataset.inked).toBe('1');
    expect(el.querySelector('canvas')).not.toBe(was);
    expect(calls.filter((c) => c[0] === 'drawImage').map((c) => c[1])).toEqual([new TextDecoder().decode(memPagePicture([stroke(6)], W, H))]);
  });

  it('is drawn in its paper\'s colours as the theme has them, its ink turned and lightening where the paper is dark; again when the theme changes', async () => {
    await fs.setPageInk(ID, 3, [stroke(4)]);
    const el = crop('3:0.100:0.100:0.500:0.300');
    const box = parseBoxes('3:0.100:0.100:0.500:0.300')![0]!;
    const picture = new TextDecoder().decode(memPagePicture([stroke(4)], W, H));
    const drawn = () => calls.filter((c) => c[0] === 'drawImage').map((c) => c[1]);
    try {
      useApp.setState({ theme: 'dark' });
      await real.drawCrop(el, NB, box, 400);
      expect(el.dataset.inkDark).toBe('1');
      expect([calls[0]!.slice(0, 2), calls.filter((c) => c[0] === 'fillRect' && c[1] === '#353f4b').length]).toEqual([['fillRect', '#141414'], 10]);
      // the picture's part is drawn aside, turned (black comes out near white, white near black, nothing stays nothing), and laid on
      expect(drawn()).toEqual([picture, undefined]);
      expect(calls.find((c) => c[0] === 'putImageData')).toEqual(['putImageData', 235, 235, 235, 255, 20, 20, 20, 255, 0, 0, 0, 0]);
      expect(ctx.globalCompositeOperation).toBe('source-over');
      // the theme changed: drawn again, light, the ink as written
      calls.length = 0;
      const was = el.querySelector('canvas');
      useApp.setState({ theme: 'light' });
      for (let i = 0; i < 50 && el.dataset.inkDark !== '0'; i++) await new Promise((r) => setTimeout(r, 10));
      expect(el.querySelector('canvas')).not.toBe(was);
      expect([calls[0]!.slice(0, 2), drawn(), calls.some((c) => c[0] === 'putImageData')]).toEqual([['fillRect', PAPER_WHITE], [picture], false]);
      // a chosen paper is itself whatever the theme: a light one in the dark theme has its ink as written
      useApp.setState({ docs: { ...useApp.getState().docs, [NB]: { ...useApp.getState().docs[NB]!, written: { ...useApp.getState().docs[NB]!.written!, color: '#fbf6e9', line: '#bcdcc0' } } }, theme: 'dark' });
      calls.length = 0;
      await real.drawCrop(el, NB, box, 400);
      expect([el.dataset.inkDark, calls[0]!.slice(0, 2), calls.filter((c) => c[0] === 'fillRect' && c[1] === '#bcdcc0').length, drawn()]).toEqual(['0', ['fillRect', '#fbf6e9'], 10, [picture]]);
    } finally {
      useApp.setState({ theme: 'light' });
    }
  });

  it('of a sheet that is gone says so', async () => {
    const el = crop('2:0.100:0.100:0.500:0.300');
    real.fillCrops(host, NB);
    await settled(el);
    expect(el.dataset.drawn).toBe('gone');
    expect(el.querySelector('canvas')).toBeNull();
  });
});
