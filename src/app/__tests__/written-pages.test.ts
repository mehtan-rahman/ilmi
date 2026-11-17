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

import { act, createElement } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { parseBoxes, type PaperKind } from '../../format/index.js';
import { Vault, storeFs, type InkStroke, type StoreFs } from '../../vault/index.js';
import { memDrawing, memPagePicture, memSplit, memStore } from '../../vault/mem-store.js';
import { passageMarksOf } from '../../pdf/index.js';
import { emptyPanes, openTab } from '../panes.js';
import { PAPER_DOT, PAPER_RULE, PAPER_WHITE, drawPaper, paperLines, paperPaths } from '../paper.js';
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

const scenes: { hosts: { id: string; sheets: { id: string; frame: { y: number; h: number } }[] }[] }[] = [];
let drawn: InkStroke[] | null = null;
vi.mock('@tauri-apps/api/core', () => ({
  invoke: async (cmd: string, args: Record<string, unknown>) => {
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
vi.mock('../InkBar.js', () => ({ InkBar: ({ id }: { id: string }) => createElement('div', { className: 'inkbar', 'data-for': id }) }));
/** What the lens asked of the notebook's file, stood in for over the index. */
const asked = { addSheet: 0, removed: [] as number[], addWritten: [] as string[] };
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
    addWritten: async (id: string) => { asked.addWritten.push(id); return null; },
  };
});
const { Pdf } = await import('../Pdf.js');
const { undoNotice } = await import('../land.js');
const { keepPassage } = await import('../passages.js');
const { loadMarks, heldMarks } = await import('../book.js');
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
    expect(paperLines('blank')).toEqual({ rows: [], cols: [], dots: null });
    // as paths of an SVG in points: the rules across the sheet, the dots a dashed row each
    expect(paperPaths('ruled').rules.startsWith('M0 72H612M0 96H612')).toBe(true);
    expect(paperPaths('ruled').dots).toBe('');
    expect(paperPaths('grid').rules).toContain('M6 0V792');
    expect(paperPaths('dotted')).toMatchObject({ rules: '', pitch: 20 });
    expect(paperPaths('dotted').dots.startsWith('M26 26H586')).toBe(true);
    expect(paperPaths('blank')).toMatchObject({ rules: '', dots: '' });
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

  it('draws each paper, and only the sheets near the view', async () => {
    await mount(NB, [1, 2, 3, 4, 5], 'grid');
    expect(places()).toEqual([1, 2, 3, 4, 5]);
    // the view is 900 tall: three sheets lie within reach of it, the rest are bare until they come near
    expect(qa<HTMLElement>('.pdf-page').map((p) => p.querySelector('svg.paper') !== null)).toEqual([true, true, true, false, false]);
    expect(pageEl(5).dataset.paper).toBe('grid');
    expect(q('svg.paper .paper-rule')!.getAttribute('d')).toContain('M6 0V792');
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

  it('`more` has the four papers, the one it is on marked, and changes it', async () => {
    await mount(NB);
    await click(more());
    expect(menuRows().map((r) => [r.dataset.act, r.classList.contains('on')])).toEqual([['paper-blank', false], ['paper-ruled', true], ['paper-grid', false], ['paper-dotted', false], ['page-delete', false]]);
    expect(menuRows().map((r) => r.textContent)).toEqual(['blank paper', '✓ruled paper', 'grid paper', 'dotted paper', 'delete this page']);
    await click(menuRow('paper-dotted')!);
    await wait(20);
    expect(written().paper).toBe('dotted');
    expect(q('svg.paper')!.getAttribute('data-paper')).toBe('dotted');
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
    await act(async () => { useApp.setState({ phone: true }); });
    expect(q('.inkbar')).toBeNull();
    expect(q<HTMLElement>('.meta')!.dataset.ink).toBeUndefined();
    expect(q('.pt-readonly')).toBeNull();
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

describe('a PDF\'s pages', () => {
  it('are as they were: read by pdf.js, numbered by themselves, with no paper and nothing to add', async () => {
    await mount(PDF);
    expect(acquired).toBe(1);
    expect(places()).toEqual([1, 2]);
    expect(qa<HTMLElement>('.pdf-page').map((p) => [p.dataset.sheet, p.dataset.paper])).toEqual([[undefined, undefined], [undefined, undefined]]);
    expect(q('svg.paper, .add-page, .pt-readonly, .inkbar')).toBeNull();
    for (const tool of ['contents', 'search', 'more']) expect(q(`.meta [data-tool="${tool}"]`)).not.toBeNull();
    await click(more());
    expect(menuRows().map((r) => r.dataset.act)).toEqual(['more-bookmark', 'more-portal-from', 'more-ruler', 'more-beside']);
    await key('Escape');
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
    real.fillCrops(host, NB);
    await settled(el);
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
