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

import { act, createElement } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { parseBoxes, type PaperKind } from '../../format/index.js';
import { Vault, storeFs, type InkStroke, type StoreFs } from '../../vault/index.js';
import { memDrawing, memPagePicture, memSplit, memStore } from '../../vault/mem-store.js';
import { passageMarksOf } from '../../pdf/index.js';
import { emptyPanes, openTab } from '../panes.js';
import { PAPER_DOT, PAPER_MARGIN, PAPER_RULE, PAPER_WHITE, drawPaper, paperLines, paperOf, paperPaths, ruleWidth, sheetSize } from '../paper.js';
import { useApp, type DocInfo } from '../store.js';

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
/** What else the canvases were asked: to take a stroke back, to stretch with the pages. */
const asks: { cmd: string; args: Record<string, unknown> }[] = [];
vi.mock('@tauri-apps/api/core', () => ({
  invoke: async (cmd: string, args: Record<string, unknown>) => {
    if (cmd === 'ink_undo' || cmd === 'ink_redo' || cmd === 'ink_pinch') { asks.push({ cmd, args }); return cmd === 'ink_pinch' ? null : { undo: false, redo: false }; }
    if (cmd === 'ink_scene') { scenes.push(args.scene as (typeof scenes)[number]); return null; }
    if (cmd === 'ink_fill') return { took: true };
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
  return rectOf.call(this);
};
HTMLElement.prototype.getClientRects = function (this: HTMLElement) { return [this.getBoundingClientRect()] as unknown as DOMRectList; };
/** The pane's width as the lens measures it (`.reader-wrap`'s); 0, as jsdom has it, draws a page a pixel to the point whatever the zoom. */
let pane = 0;
Object.defineProperty(HTMLElement.prototype, 'clientWidth', { configurable: true, get(this: HTMLElement) { return this.classList.contains('reader-wrap') ? pane : 0; } });

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
const mount = async (id: string, sheets = [1, 2, 3], paper: PaperKind = 'ruled', mobile = false) => {
  useApp.setState({ docs: docsWith(sheets, paper), mobile, phone: false, panes: openTab(emptyPanes(), id), notice: null, bookZooms: {} });
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

describe('the paper as a notebook\'s page setup says it', () => {
  it('a sheet is Letter upright unless it says A4, or on its side', () => {
    expect(sheetSize(undefined)).toEqual({ w: 612, h: 792 });
    expect(sheetSize({})).toEqual({ w: 612, h: 792 });
    expect(sheetSize({ size: 'a4' })).toEqual({ w: 595, h: 842 });
    expect(sheetSize({ turn: 'landscape' })).toEqual({ w: 792, h: 612 });
    expect(sheetSize({ size: 'a4', turn: 'landscape' })).toEqual({ w: 842, h: 595 });
  });

  it('with nothing said it is the paper a new notebook has; what is said stands in for that', () => {
    expect(paperOf({ paper: 'ruled' })).toEqual({ kind: 'ruled', w: 612, h: 792, rule: 24, margin: null, top: 72, run: false, at: 0 });
    expect(paperOf({ paper: 'grid' })).toMatchObject({ kind: 'grid', rule: 20, margin: null });
    expect(paperOf({ paper: 'dotted' }).rule).toBe(20);
    for (const kind of ['blank', 'ruled', 'grid', 'dotted'] as const) {
      expect(paperLines(paperOf({ paper: kind }))).toEqual(paperLines(kind));
      expect(paperPaths(paperOf({ paper: kind }))).toEqual(paperPaths(kind));
    }
    expect(paperOf({ paper: 'ruled', rule: 30, margin: 90, top: 100, size: 'a4', turn: 'landscape' })).toEqual({ kind: 'ruled', w: 842, h: 595, rule: 30, margin: 90, top: 100, run: false, at: 0 });
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

describe('a written notebook under the Pencil', () => {
  const lastHost = () => scenes.at(-1)!.hosts[0]!;

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

  it('with the tools tucked away the bar is one row again, and the sheets are still the Pencil\'s', async () => {
    // (sheets no other test here has: a scene said before is not said again)
    await mount(NB, [2, 3], 'ruled', true);
    await wait(20);
    await act(async () => { useInkTools.setState((t) => ({ kept: { ...t.kept, shown: false } })); });
    await wait(20);
    const meta = q<HTMLElement>('.meta.pdf-tools')!;
    expect(q('.inkbar')).toBeNull();
    expect(meta.dataset.ink).toBeUndefined();
    expect(q<HTMLElement>('.pdf-view')!.dataset.tools).toBeUndefined();
    expect(Array.from(meta.children).map((c) => c.className)).toEqual(['pt-row']);
    expect(q('.meta [data-tool="ink-tools"]')).not.toBeNull();
    expect(q('.pt-readonly')).toBeNull();
    expect(lastHost().sheets.map((s) => s.id)).toEqual([sheetId(2), sheetId(3)]);
    // shown again, the row is back
    await act(async () => { useInkTools.setState((t) => ({ kept: { ...t.kept, shown: true } })); });
    expect(q<HTMLElement>('.meta > .inkbar')!.dataset.for).toBe(NB);
  });

  it('its sheets are told to the canvases under their own numbers, and what is written at place 2 is sheet 3\'s', async () => {
    await mount(NB, [1, 3], 'ruled', true);
    await wait(20);
    expect(lastHost().id).toBe(`pages:${NB}`);
    expect(lastHost().sheets.map((s) => s.id)).toEqual([sheetId(1), sheetId(3)]);
    expect(lastHost().sheets[1]!.frame.y).toBe(H + GAP);
    await pencil({ kind: 'begin', sheet: sheetId(3), host: `pages:${NB}`, x: 60, y: H + GAP + 100 });
    await pencil({ kind: 'end', sheet: sheetId(3) });
    drawn = [stroke(1), stroke(2)];
    await pencil({ kind: 'quiet', sheet: sheetId(3) });
    await wait(60);
    expect((await fs.pageInk(ID, 3)).map((s) => s.stroke)).toEqual(['s1', 's2']);
    expect(await fs.pageInk(ID, 2)).toEqual([]);
    expect(await fs.inkedPages(ID)).toEqual([3]);
    const img = q<HTMLImageElement>('img.page-ink[data-page="2"]')!;
    expect(img.dataset.sheet).toBe('3');
    expect([img.style.top, img.style.height]).toEqual([pageEl(2).style.top, pageEl(2).style.height]);
    // begun high on the last page, nothing was added
    expect(asked.addSheet).toBe(0);
  });

  it('a pageless notebook\'s sheet is written on past its foot, so a stroke runs on over the next; its own is where the Pencil adds to it', async () => {
    useApp.setState({ docs: docsWith([1, 2, 8]) });
    await mount(NB, [1, 2, 8], 'ruled', true);
    await wait(20);
    expect(lastHost().sheets.map((s) => [s.frame.h, s.hit!.h])).toEqual([[H, H], [H, H], [H, H]]);
    await act(async () => { useApp.setState((s) => ({ docs: { ...s.docs, [NB]: { ...s.docs[NB]!, written: { ...written(), pageless: true } } } })); });
    await wait(40);
    expect(lastHost().sheets.map((s) => s.id)).toEqual([sheetId(1), sheetId(2), sheetId(8)]);
    expect(lastHost().sheets.map((s) => [s.frame.h, s.hit!.h])).toEqual([[H * 1.5, H], [H * 1.5, H], [H * 1.5, H]]);
  });

  it('a stroke begun in the lower third of the last page adds the next, once for that page', async () => {
    await mount(NB, [1, 2], 'ruled', true);
    await wait(20);
    const low = (place: number) => top(place) + H * 0.7;
    // low on a page that is not the last: nothing
    await pencil({ kind: 'begin', sheet: sheetId(1), host: `pages:${NB}`, x: 60, y: low(1) });
    // high on the last: nothing
    await pencil({ kind: 'begin', sheet: sheetId(2), host: `pages:${NB}`, x: 60, y: top(2) + H * 0.5 });
    await wait(20);
    expect(asked.addSheet).toBe(0);
    await pencil({ kind: 'begin', sheet: sheetId(2), host: `pages:${NB}`, x: 60, y: low(2) });
    await wait(30);
    expect(asked.addSheet).toBe(1);
    expect(sheetsShown()).toEqual([1, 2, 3]);
    // the same page again, no longer the last: nothing more
    await pencil({ kind: 'begin', sheet: sheetId(2), host: `pages:${NB}`, x: 60, y: low(2) });
    await wait(30);
    expect(asked.addSheet).toBe(1);
    // the new last page, in its turn
    await wait(20);
    expect(lastHost().sheets.map((s) => s.id)).toEqual([sheetId(1), sheetId(2), sheetId(3)]);
    await pencil({ kind: 'begin', sheet: sheetId(3), host: `pages:${NB}`, x: 60, y: low(3) });
    await wait(30);
    expect(asked.addSheet).toBe(2);
    expect(sheetsShown()).toEqual([1, 2, 3, 4]);
  });
});

describe('two and three fingers on the pages', () => {
  const HOST = `pages:${NB}`;
  const pagesEl = () => q<HTMLElement>('.pdf-pages')!;
  const view = () => q<HTMLElement>('.pdf-view')!;
  const pct = () => q('.meta [data-tool="zoom-fit"]')!.textContent;
  /** The book's zoom as it is kept: nothing kept is fit. */
  const zoomOf = () => useApp.getState().bookZooms[NB] ?? 1;
  /** How the pages are stretched while the fingers are down: across, down, and by how much. */
  const stretch = () => (pagesEl().style.transform.match(/-?[\d.]+/g) ?? []).map((v) => Math.round(Number(v) * 1000) / 1000);
  /** What lies under a place on the screen, which jsdom cannot say: a page, unless a test says otherwise. */
  let under: () => Element | null = () => pageEl(1);
  beforeEach(() => { under = () => pageEl(1); document.elementFromPoint = () => under(); });
  afterEach(() => { delete (document as { elementFromPoint?: unknown }).elementFromPoint; pane = 0; });

  it('two down and up at once take the last stroke back, three put it back; off the pages, or under something over them, nothing', async () => {
    await mount(NB, [1, 2, 4], 'ruled', true);
    await wait(20);
    await pencil({ kind: 'fingers', n: 2, x: 300, y: 400 });
    await pencil({ kind: 'fingers', n: 3, x: 300, y: 400 });
    await pencil({ kind: 'fingers', n: 4, x: 300, y: 400 });
    await wait(10);
    expect(asks.map((a) => a.cmd)).toEqual(['ink_undo', 'ink_redo', 'ink_redo']);
    asks.length = 0;
    // off the scroller (it is 612 by 900 here)
    await pencil({ kind: 'fingers', n: 2, x: 700, y: 400 });
    await pencil({ kind: 'fingers', n: 2, x: 300, y: 950 });
    // on the overview, on the lasso's menu, on something that is no part of the pages
    for (const cls of ['page-grid', 'ink-menu']) {
      const over = q('.book-pages')!.appendChild(document.createElement('div'));
      over.className = cls;
      under = () => over;
      await pencil({ kind: 'fingers', n: 2, x: 300, y: 400 });
      over.remove();
    }
    under = () => document.body;
    await pencil({ kind: 'fingers', n: 2, x: 300, y: 400 });
    under = () => null;
    await pencil({ kind: 'fingers', n: 3, x: 300, y: 400 });
    await wait(10);
    expect(asks).toEqual([]);
  });

  it('a pinch stretches the pages and the canvases alike about the place between the fingers, and leaves the pages at that size', async () => {
    pane = 700;
    await mount(NB, [1, 2, 5], 'ruled', true);
    await wait(20);
    const fitted = parseFloat(pageEl(1).style.width);
    expect(fitted).toBeGreaterThan(0);
    expect([pct(), zoomOf()]).toEqual(['100%', 1]);
    await pencil({ kind: 'pinch', phase: 'begin', k: 1, x: 300, y: 400 });
    expect(view().dataset.pinch).toBe('1');
    expect(pagesEl().style.transform).toBe('');
    await pencil({ kind: 'pinch', phase: 'change', k: 1.37, x: 300, y: 400 });
    // only stretched while the fingers are down: nothing is laid out, the zoom is as it was, and the bar says what it would be
    expect(stretch()).toEqual([-111, -148, 1.37]);
    expect(pagesEl().style.transformOrigin).toBe('0 0');
    expect([parseFloat(pageEl(1).style.width), zoomOf(), pct()]).toEqual([fitted, 1, '137%']);
    expect(asks.at(-1)!.cmd).toBe('ink_pinch');
    const told = asks.at(-1)!.args.pinch as { host: string; k: number; dx: number; dy: number };
    expect([told.host, told.k]).toEqual([HOST, 1.37]);
    expect(told.dx).toBeCloseTo(-111);
    expect(told.dy).toBeCloseTo(-148);
    // the fingers moved together: the place taken is under them still
    await pencil({ kind: 'pinch', phase: 'change', k: 1.37, x: 320, y: 380 });
    expect(stretch()).toEqual([-91, -168, 1.37]);
    await pencil({ kind: 'pinch', phase: 'end', k: 1.37, x: 320, y: 380 });
    await wait(30);
    // let go anywhere between the least and the most: that is the zoom, and the pages are laid out at it
    expect(view().dataset.pinch).toBeUndefined();
    expect(zoomOf()).toBe(1.37);
    expect(pct()).toBe('137%');
    expect(view().dataset.zoom).toBe('1.37');
    expect(parseFloat(pageEl(1).style.width)).toBeCloseTo(fitted * 1.37);
    expect(pagesEl().style.transform).toBe('');
    // a step from there is the next one past it
    await click(q('.meta [data-tool="zoom-in"]')!);
    expect(zoomOf()).toBe(1.5);
  });

  it('a pinch gives a little past either end and is held to it when let go; all but fit is fit; one broken off changes nothing', async () => {
    pane = 700;
    await mount(NB, [1, 2, 6], 'ruled', true);
    await wait(20);
    await pencil({ kind: 'pinch', phase: 'begin', k: 1, x: 300, y: 400 });
    await pencil({ kind: 'pinch', phase: 'change', k: 10, x: 300, y: 400 });
    expect(stretch()[2]).toBe(4.8);
    expect(pct()).toBe('400%');
    await pencil({ kind: 'pinch', phase: 'end', k: 10, x: 300, y: 400 });
    await wait(30);
    expect(zoomOf()).toBe(4);
    // from four times, closed nearly all the way: the least
    await pencil({ kind: 'pinch', phase: 'begin', k: 1, x: 300, y: 400 });
    await pencil({ kind: 'pinch', phase: 'change', k: 0.01, x: 300, y: 400 });
    expect(pct()).toBe('50%');
    await pencil({ kind: 'pinch', phase: 'end', k: 0.01, x: 300, y: 400 });
    await wait(30);
    expect(zoomOf()).toBe(0.5);
    // to within a hair of fit: fit
    await pencil({ kind: 'pinch', phase: 'begin', k: 1, x: 300, y: 400 });
    await pencil({ kind: 'pinch', phase: 'change', k: 2.04, x: 300, y: 400 });
    await pencil({ kind: 'pinch', phase: 'end', k: 2.04, x: 300, y: 400 });
    await wait(30);
    expect(zoomOf()).toBe(1);
    // broken off: the pages are as they were, and the canvases are told to lie as they lay
    asks.length = 0;
    await pencil({ kind: 'pinch', phase: 'begin', k: 1, x: 300, y: 400 });
    await pencil({ kind: 'pinch', phase: 'change', k: 2, x: 300, y: 400 });
    expect(stretch()[2]).toBe(2);
    await pencil({ kind: 'pinch', phase: 'cancel', k: 2, x: 300, y: 400 });
    await wait(20);
    expect(pagesEl().style.transform).toBe('');
    expect(view().dataset.pinch).toBeUndefined();
    expect([zoomOf(), pct()]).toEqual([1, '100%']);
    expect(asks.at(-1)).toEqual({ cmd: 'ink_pinch', args: { pinch: { host: HOST } } });
    // one begun off the pages is not theirs
    asks.length = 0;
    await pencil({ kind: 'pinch', phase: 'begin', k: 1, x: 700, y: 400 });
    await pencil({ kind: 'pinch', phase: 'change', k: 2, x: 700, y: 400 });
    await pencil({ kind: 'pinch', phase: 'end', k: 2, x: 700, y: 400 });
    expect(view().dataset.pinch).toBeUndefined();
    expect([zoomOf(), asks]).toEqual([1, []]);
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
});

describe('a clip of a written page, in a note', () => {
  type Call = [string, ...unknown[]];
  const calls: Call[] = [];
  const ctx = {
    fillStyle: '',
    fillRect(...a: number[]) { calls.push(['fillRect', this.fillStyle, ...a]); },
    drawImage(img: { said?: string }, ...a: number[]) { calls.push(['drawImage', img.said, ...a.map((n) => Math.round(n * 10) / 10)]); },
    beginPath() {}, arc() {}, fill() {},
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

  it('of a sheet that is gone says so', async () => {
    const el = crop('2:0.100:0.100:0.500:0.300');
    real.fillCrops(host, NB);
    await settled(el);
    expect(el.dataset.drawn).toBe('gone');
    expect(el.querySelector('canvas')).toBeNull();
  });
});
