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
import { LINE_COLORS, PAPER_COLORS, PAPER_DOT, PAPER_MARGIN, PAPER_RULE, PAPER_WHITE, drawPaper, isDarkColor, paperLines, paperLook, paperOf, paperPaths, ruleWidth, sheetSize, turned } from '../paper.js';
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
/** How often a PDF was asked for. */
let acquired = 0;
const pdfPage = { getViewport: ({ scale }: { scale: number }) => ({ width: W * scale, height: H * scale }), render: () => ({ promise: Promise.resolve() }), streamTextContent: () => null };
vi.mock('../bookPdf.js', () => ({
  fillCrops: () => {},
  acquirePdf: () => { acquired += 1; return { promise: Promise.resolve({ numPages: 2, getPage: async () => pdfPage }), release() {} }; },
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
    setSetup: async (path: string, to: Partial<import('../written.js').Setup>) => {
      asked.setup.push(to);
      change(path, (w) => {
        const next = { ...real.setupOf(w), ...to };
        const out: Written = { id: w.id, sheets: w.sheets, paper: next.paper };
        if (next.rule !== null) out.rule = next.rule;
        if (next.margin !== null) out.margin = next.margin;
        if (next.top !== null) out.top = next.top;
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
    const grid = paperLines('grid');
    expect([grid.rows[0], grid.rows[1], grid.rows.at(-1), grid.rows.length]).toEqual([6, 26, 786, 40]);
    expect([grid.cols[0], grid.cols.at(-1), grid.cols.length]).toEqual([6, 606, 31]);
    const dots = paperLines('dotted').dots!;
    expect([dots.xs[0], dots.xs.at(-1), dots.ys[0], dots.ys.at(-1)]).toEqual([26, 586, 26, 766]);
    expect(paperLines('blank')).toEqual({ rows: [], cols: [], margin: null, dots: null });
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
    drawPaper(ctx as unknown as CanvasRenderingContext2D, paperOf({ paper: 'dotted', line: '#f0c2c2' }), { x: 0, y: 0, w: 60, h: 60 }, 1, paperLook({ line: '#f0c2c2' }, 'eink'));
    expect(ctx.fillStyle).toBe('#f0c2c2');
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
    expect(paperOf({ paper: 'ruled' })).toEqual({ kind: 'ruled', w: 612, h: 792, rule: 24, margin: null, top: 72, run: false, at: 0, color: null, line: null });
    expect(paperOf({ paper: 'grid' })).toMatchObject({ kind: 'grid', rule: 20, margin: null });
    expect(paperOf({ paper: 'dotted' }).rule).toBe(20);
    for (const kind of ['blank', 'ruled', 'grid', 'dotted'] as const) {
      expect(paperLines(paperOf({ paper: kind }))).toEqual(paperLines(kind));
      expect(paperPaths(paperOf({ paper: kind }))).toEqual(paperPaths(kind));
    }
    expect(paperOf({ paper: 'ruled', rule: 30, margin: 90, top: 100, size: 'a4', turn: 'landscape' })).toEqual({ kind: 'ruled', w: 842, h: 595, rule: 30, margin: 90, top: 100, run: false, at: 0, color: null, line: null });
    // a margin rule is a ruled sheet's alone
    expect(paperOf({ paper: 'grid', margin: 90 }).margin).toBeNull();
    expect(paperOf({ paper: 'dotted', margin: 90 }).margin).toBeNull();
    // sheets that run on as one: each begins where the one before ended
    expect([0, 1, 2].map((i) => paperOf({ paper: 'ruled', pageless: true }, i))).toMatchObject([{ run: true, at: 0 }, { run: true, at: 792 }, { run: true, at: 1584 }]);
    expect(paperOf({ paper: 'ruled', pageless: true, size: 'a4' }, 2).at).toBe(1684);
    expect(paperOf({ paper: 'ruled' }, 2)).toMatchObject({ run: false, at: 0 });
  });

  it('the rules are as far apart as it says, from as far down as it says, with a margin rule where it says', () => {
    const lines = paperLines(paperOf({ paper: 'ruled', rule: 30, top: 100, margin: 90 }));
    expect([lines.rows[0], lines.rows[1], lines.rows.at(-1), lines.rows.length]).toEqual([100, 130, 760, 23]);
    expect(lines.margin).toBe(90);
    expect(lines.cols).toEqual([]);
    const paths = paperPaths(paperOf({ paper: 'ruled', rule: 30, top: 100, margin: 90 }));
    expect(paths.rules.startsWith('M0 100H612M0 130H612')).toBe(true);
    expect(paths).toMatchObject({ margin: 'M90 0V792', dots: '', w: 612, h: 792 });
    expect(paperPaths('ruled').margin).toBe('');
    // a margin off the sheet is none
    expect(paperLines(paperOf({ paper: 'ruled', margin: 700 })).margin).toBeNull();
    expect(paperLines(paperOf({ paper: 'ruled', margin: 700, turn: 'landscape' })).margin).toBe(700);
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
    expect(q('img.page-ink[data-page="1"]')).not.toBeNull();
    expect(q('img.page-ink[data-page="5"]')).toBeNull();
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
    const marks = () => [pageEl(1).dataset.inkDark, pageEl(2).dataset.inkDark, q<HTMLElement>('.pdf-ink')!.dataset.inkDark, q<HTMLElement>('img.page-ink')!.dataset.inkDark].map((v) => v ?? null);
    const paper = () => [q('svg.paper .paper-sheet')!.getAttribute('fill'), q('svg.paper .paper-rule')!.getAttribute('stroke')];
    const setup = (more: Record<string, unknown>) => act(async () => { useApp.setState((s) => ({ docs: { ...s.docs, [NB]: { ...s.docs[NB]!, written: { id: ID, paper: 'ruled', sheets: [1, 2], ...more } } } })); });
    // a notebook's layer and pictures are known as paper's, so the theme's rule for a PDF's pages leaves them be
    expect([q<HTMLElement>('.pdf-ink')!.dataset.paper, q<HTMLElement>('img.page-ink')!.dataset.paper]).toEqual(['ruled', 'ruled']);
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
      ['more-pages', 'all pages'], ['more-setup', 'page setup'], ['more-share', 'export as pdf'],
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
    // ruled again, narrower, with a margin: every sheet is ruled so
    await click(q('[data-ps="paper-ruled"]')!);
    await click(q('[data-ps="stop-narrow"]')!);
    await click(q('[data-ps="margin"]')!);
    await wait(150);
    expect(written()).toMatchObject({ paper: 'ruled', rule: 18, margin: 90 });
    expect(qa('.pdf-page > svg.paper').map((s) => s.getAttribute('data-rule'))).toEqual(['18', '18', '18']);
    expect(q('.pdf-page > svg.paper .paper-rule')!.getAttribute('d')!.startsWith('M0 72.5H612M0 90.5H612')).toBe(true);
    expect(q('.pdf-page > svg.paper .paper-rule')!.getAttribute('d')).toBe(paperPaths(paperOf(written()), ON).rules);
    expect(qa('.pdf-page > svg.paper .paper-margin').map((m) => m.getAttribute('d'))).toEqual(['M90.5 0V792', 'M90.5 0V792', 'M90.5 0V792']);
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
    expect(menuRows().map((r) => r.dataset.act)).toEqual(['more-setup', 'more-share']);
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
    expect(q<HTMLImageElement>('img.page-ink[data-page="2"]')!.dataset.sheet).toBe('5');
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
    expect(q<HTMLImageElement>('img.page-ink[data-page="1"]')!.dataset.sheet).toBe('2');
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
    expect(q('img.page-ink[data-page="1"]')).not.toBeNull();
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

  it('on a Mac it is shown and cannot be written on: the bar says so, once, and has no tools', async () => {
    await fs.setPageInk(ID, 3, [stroke(7)]);
    await mount(NB, [1, 3]);
    expect(q('.meta .pt-readonly')!.textContent).toBe('written on an ipad');
    expect(qa('.pt-readonly').length).toBe(1);
    expect(q('.inkbar')).toBeNull();
    expect(q<HTMLElement>('.meta')!.dataset.ink).toBeUndefined();
    expect(scenes).toEqual([]);
    // what was written elsewhere is a picture over the paper, found by the sheet's number
    const img = q<HTMLImageElement>('img.page-ink[data-page="2"]')!;
    expect(img.dataset.sheet).toBe('3');
    await wait(20);
    expect(pictures.get(img.src)).toBe(new TextDecoder().decode(memPagePicture([stroke(7)], W, H)));
    expect(q('img.page-ink[data-page="1"]')).toBeNull();
    // and no button to bring tools back: there are none
    expect(q('.meta [data-tool="ink-tools"]')).toBeNull();
  });

  it('what is written on a page is asked for as fine as the screen shows it: finer on a denser one', async () => {
    await fs.setPageInk(ID, 1, [stroke(7)]);
    const real = fs.pageInkFile.bind(fs);
    const asks: unknown[][] = [];
    fs.pageInkFile = (...a: Parameters<StoreFs['pageInkFile']>) => { asks.push(a); return real(...a); };
    try {
      await mount(NB, [1, 2]);
      const img = () => q<HTMLImageElement>('img.page-ink[data-page="1"]')!;
      // a point a pixel here: the coarsest
      expect(img().dataset.fine).toBe('1');
      expect(asks).toEqual([[ID, 1, 'picture', W, H, 1]]);
      // two pixels to the point: twice as fine
      act(() => root?.unmount());
      host.remove();
      asks.length = 0;
      Object.defineProperty(window, 'devicePixelRatio', { value: 2, configurable: true });
      await mount(NB, [1, 2]);
      expect(img().dataset.fine).toBe('2');
      expect(asks).toEqual([[ID, 1, 'picture', W, H, 2]]);
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
    expect(spec().paper).toEqual({ kind: 'ruled', w: W, h: H, rule: 24, margin: null, top: 72, run: false });
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
    expect(fills()).toEqual([{ sheet: sheetId(1), drawing: b64(memDrawing([stroke(1)])), show: true }, { sheet: sheetId(3), drawing: null, show: true }]);
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
    expect(fills()).toEqual([{ sheet: sheetId(3), drawing: b64(memDrawing([stroke(2), stroke(3), stroke(4)])), show: true }]);
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

  it('on an iPad are this page\'s still: no surface is asked for', async () => {
    await mount(PDF, [1, 2, 3], 'ruled', true);
    await wait(40);
    expect(told).toEqual([]);
    expect(q('.note-surface')).toBeNull();
    expect([q<HTMLElement>('.pdf-view')!.dataset.surface, q('.reader-wrap')!.getAttribute('data-native')]).toEqual([undefined, null]);
    expect(qa('.pdf-pages > .pdf-page').length).toBe(2);
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
