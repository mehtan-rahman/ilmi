// @vitest-environment jsdom
// A book's pages zoomed (`Pdf.tsx`): ⌘= ⌘− ⌘0 over the pages step the book's
// zoom and leave the text size alone; everything on the pages is laid out by
// the one scale. The real lens over a three-page stand-in, pdf.js mocked (the
// harness of `sweep-intake.test.ts`); jsdom lays nothing out, so the pane's
// width is given and the sizes are read from the styles the lens sets.

import { act, createElement } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, describe, expect, it, vi } from 'vitest';

vi.mock('@tauri-apps/plugin-dialog', () => ({ open: async () => null }));
const fakePage = (n: number) => ({
  n,
  getViewport: ({ scale }: { scale: number }) => ({ width: 600 * scale, height: 800 * scale }),
  render: () => ({ promise: Promise.resolve() }),
  streamTextContent: () => ({ n }),
  getTextContent: async () => ({ items: [] }),
});
const fakePdf = { numPages: 3, getPage: async (n: number) => fakePage(n) };
vi.mock('../pdfjs.js', () => ({
  pdfText: async () => ({ pages: 1, text: '', title: '', chapters: [] }),
  TextLayer: class {
    constructor(private o: { textContentSource: { n: number }; container: HTMLElement }) {}
    async render() { const sp = document.createElement('span'); sp.textContent = `entropy on page ${this.o.textContentSource.n}`; this.o.container.append(sp); }
  },
  pageBits: async (page: { n: number }) => [{ str: `entropy on page ${page.n}`, eol: true, y: 700, height: 10 }],
  loadPdf: () => ({}), loadPdfPieces: () => ({}),
}));
vi.mock('../bookPdf.js', () => ({
  acquirePdf: () => ({ promise: Promise.resolve(fakePdf), release() {} }),
  itemsOf: async () => [], fillCrops: () => {}, drawCrop: async () => {}, WHOLE_MAX: 1,
}));
vi.mock('../vault.js', async (orig) => ({ ...(await orig<typeof import('../vault.js')>()), currentVault: () => null }));

const { Pdf, ZOOMS, ZOOM_MAX, ZOOM_MIN, inkScale, onPixel, pageGap, pageTops, pagesWidth, zoomHeld, zoomStep } = await import('../Pdf.js');
const { useApp } = await import('../store.js');
globalThis.ResizeObserver ??= class { observe() {} unobserve() {} disconnect() {} } as unknown as typeof ResizeObserver;
globalThis.IntersectionObserver ??= class { observe() {} unobserve() {} disconnect() {} } as unknown as typeof IntersectionObserver;
Element.prototype.scrollIntoView ??= function () {};
(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

/** The pane's width, as the lens measures it (`.reader-wrap`'s). */
let pane = 800;
Object.defineProperty(HTMLElement.prototype, 'clientWidth', { configurable: true, get(this: HTMLElement) { return this.classList.contains('reader-wrap') ? pane : 0; } });

let host: HTMLDivElement;
let mounted = false;
let root: Root;
let seq = 0;
let BOOK = '';
const settle = () => act(async () => { await new Promise((r) => setTimeout(r, 10)); });
/** A book of its own a test (a zoom is kept by the book's id), three 600 × 800 pages. */
async function mountBook(id = `library/zoom-${++seq}.pdf`, active = true) {
  BOOK = id;
  useApp.setState({ vault: '/v', tree: [], zoom: 1, docs: { [id]: { type: 'source', frozen: true, cards: 0, due: 0, pdf: id } } as never });
  host = document.body.appendChild(document.createElement('div'));
  root = createRoot(host);
  mounted = true;
  await act(async () => { root.render(createElement(Pdf, { id, active })); });
  await settle();
}
const unmount = () => { if (!mounted) return; mounted = false; act(() => root.unmount()); host.remove(); };
afterEach(() => { unmount(); pane = 800; });

/** A key with ⌘ held, on `target`; the event comes back, to see who took it. */
async function cmd(key: string, target: EventTarget = document.body, more: KeyboardEventInit = {}) {
  const ev = new KeyboardEvent('keydown', { key, metaKey: true, bubbles: true, cancelable: true, ...more });
  await act(async () => { target.dispatchEvent(ev); });
  await settle();
  return ev;
}
const px = (el: Element | null, prop: 'width' | 'height' | 'top' | 'left') => parseFloat((el as HTMLElement).style[prop]);
const page = (n: number) => host.querySelector<HTMLElement>(`.pdf-page[data-page="${n}"]`)!;
const token = () => host.querySelector('.pdf-view .meta .right')!.textContent;
/** The zoom as the bar says it, between its − and +. */
const pct = () => host.querySelector('.pdf-view .meta [data-tool="zoom-fit"]')!.textContent;
const view = () => host.querySelector<HTMLElement>('.pdf-view')!;

describe('the steps', () => {
  it('go from 50% through fit to 400% and stop at both ends', () => {
    expect(ZOOMS).toEqual([0.5, 0.75, 1, 1.25, 1.5, 2, 2.5, 3, 4]);
    expect([ZOOM_MIN, ZOOM_MAX]).toEqual([0.5, 4]);
    let z = 1;
    const seen: number[] = [];
    for (let i = 0; i < 8; i++) { z = zoomStep(z, 1); seen.push(z); }
    expect(seen).toEqual([1.25, 1.5, 2, 2.5, 3, 4, 4, 4]);
    expect(zoomStep(1, -1)).toBe(0.75);
    expect(zoomStep(0.75, -1)).toBe(0.5);
    expect(zoomStep(0.5, -1)).toBe(0.5);
    expect(zoomStep(2, -1)).toBe(1.5);
    expect(zoomStep(2.5, 0)).toBe(1);
  });

  it('from wherever a pinch left the pages, a step is the next one past it that way', () => {
    expect(zoomStep(1.37, 1)).toBe(1.5);
    expect(zoomStep(1.37, -1)).toBe(1.25);
    expect(zoomStep(0.62, 1)).toBe(0.75);
    expect(zoomStep(0.62, -1)).toBe(0.5);
    expect(zoomStep(3.4, 1)).toBe(4);
    expect(zoomStep(3.4, -1)).toBe(3);
    // a hair off a step is that step: the next is a whole one on
    expect(zoomStep(1.498, 1)).toBe(2);
    expect(zoomStep(1.502, -1)).toBe(1.25);
    expect(zoomStep(1.37, 0)).toBe(1);
  });

  it('a pinch leaves any zoom between the least and the most, to a hundredth, and all but fit is fit', () => {
    expect(zoomHeld(1.3724)).toBe(1.37);
    expect(zoomHeld(2.999)).toBe(3);
    expect(zoomHeld(0.2)).toBe(0.5);
    expect(zoomHeld(9)).toBe(4);
    expect(zoomHeld(1.02)).toBe(1);
    expect(zoomHeld(0.98)).toBe(1);
    expect(zoomHeld(1.04)).toBe(1.04);
    expect(zoomHeld(0.96)).toBe(0.96);
  });

  it('what is written is drawn as fine as the screen shows it, a step at a time, and never past what a picture can hold', () => {
    // a Letter sheet: a point a pixel, then as the pages are zoomed into and the screen is denser
    expect(inkScale(612, 792, 1, 1)).toBe(1);
    expect(inkScale(612, 792, 1, 2)).toBe(2);
    expect(inkScale(612, 792, 1.2, 1)).toBe(1.5);
    expect(inkScale(612, 792, 1.3, 2)).toBe(3);
    expect(inkScale(612, 792, 2, 2)).toBe(4);
    expect(inkScale(612, 792, 2.5, 2)).toBe(6);
    expect(inkScale(612, 792, 4, 2)).toBe(6);
    // smaller than a point a pixel it is still one
    expect(inkScale(612, 792, 0.4, 1)).toBe(1);
    // a sheet so large that the finer picture would be too many pixels stays coarser
    expect(inkScale(2000, 3000, 4, 2)).toBe(1.5);
    expect(inkScale(5000, 5000, 4, 2)).toBe(1);
  });
});

describe('the pages on the screen\'s pixels', () => {
  /** `v` px is a whole number of a screen's pixels, `dpr` to the px. */
  const whole = (v: number, dpr: number) => Math.abs(v * dpr - Math.round(v * dpr)) < 1e-6;

  it('a length is brought to the nearest whole pixel of the screen, a px, a half or a third of one', () => {
    expect(onPixel(1333.3333, 1)).toBe(1333);
    expect(onPixel(1333.3333, 2)).toBe(1333.5);
    expect(onPixel(1333.3333, 3)).toBeCloseTo(1333 + 1 / 3, 9);
    expect(onPixel(10.2, 2)).toBe(10);
    expect(onPixel(10.3, 2)).toBe(10.5);
    expect(onPixel(10.75, 2)).toBe(11);
    // what is on one already is as it was
    for (const v of [0, 18, 612, 800.5]) expect(onPixel(v, 2)).toBe(v);
    expect(onPixel(800.5, 1)).toBe(801);
  });

  it('wider than the pane, or as wide, the pages are the fit times the zoom on whole pixels', () => {
    expect(pagesWidth(800, 800, 1, 2)).toBe(800);
    expect(pagesWidth(800, 800, 1.25, 1)).toBe(1000);
    expect(pagesWidth(833, 833, 1.37, 1)).toBe(1141);
    expect(pagesWidth(833, 833, 1.37, 2)).toBe(1141);
    expect(pagesWidth(833, 833, 1.37, 3)).toBeCloseTo(1141 + 1 / 3, 9);
    expect(pagesWidth(1032.5, 1032.5, 1.33, 2)).toBe(1373);
    for (const dpr of [1, 2, 3]) for (const z of [1, 1.04, 1.37, 2.5, 4]) expect(whole(pagesWidth(1032.5, 1032.5, z, dpr), dpr)).toBe(true);
  });

  it('narrower than the pane and centred in it, they leave as many whole pixels either side', () => {
    // a pane 1024 across, pages at 73%: 747.52 wide would begin 138.24 in, between two pixels
    for (const dpr of [2, 3]) {
      for (const [colW, z] of [[1024, 0.73], [1032, 0.5], [1366, 0.96], [834, 0.61], [1023.5, 0.77]] as const) {
        const w = pagesWidth(colW, colW, z, dpr);
        const side = (colW - w) / 2;
        expect(whole(side, dpr)).toBe(true);
        expect(w).toBeLessThan(colW);
        // by under a pixel either side
        expect(Math.abs(w - colW * z)).toBeLessThanOrEqual(1 / dpr + 1e-9);
      }
    }
    expect(pagesWidth(1024, 1024, 0.73, 2)).toBe(747.52 + 2 * (138.24 - 138));
    expect(pagesWidth(1024, 1024, 0.73, 3)).toBeCloseTo(1024 - 2 * (138 + 1 / 3), 9);
    expect(pagesWidth(800, 800, 0.75, 1)).toBe(600);
    // a pane wider than a page is ever fitted to: the fit is narrower than it at 100%
    expect(pagesWidth(1400, 1500.5, 1, 2)).toBe(1500.5 - 2 * 50.5);
  });

  it('with no pane measured yet they are the fit times the zoom, as it comes', () => {
    expect(pagesWidth(120, 0, 1, 2)).toBe(120);
    expect(pagesWidth(120, 0, 1.37, 2)).toBe(120 * 1.37);
    expect(pagesWidth(120, 0, 1.37, 3)).toBe(120 * 1.37);
  });

  it('the room between two pages grows with the zoom, on whole pixels, and is never none', () => {
    expect(ZOOMS.map((z) => pageGap(z, 1))).toEqual([9, 14, 18, 23, 27, 36, 45, 54, 72]);
    expect(ZOOMS.map((z) => pageGap(z, 2))).toEqual([9, 13.5, 18, 22.5, 27, 36, 45, 54, 72]);
    expect(pageGap(1.37, 1)).toBe(25);
    expect(pageGap(1.37, 2)).toBe(24.5);
    expect(pageGap(1.37, 3)).toBeCloseTo(24 + 2 / 3, 9);
    expect(pageGap(0.01, 1)).toBe(1);
    expect(pageGap(0.01, 2)).toBe(0.5);
    expect(pageGap(0, 3)).toBeCloseTo(1 / 3, 9);
  });

  it('each page is as tall as whole pixels, the next one that and the room between further down; nothing under the last', () => {
    const sizes = [{ w: 600, h: 800 }, { w: 600, h: 400 }, { w: 600, h: 800 }];
    // 1000 across: 1333⅓ and 666⅔ tall, drawn 1333 and 667
    expect(pageTops(sizes, 1000 / 600, 23, 1)).toEqual({ at: [0, 0, 1333 + 23, 1333 + 23 + 667 + 23], total: 1333 + 23 + 667 + 23 + 1333 });
    expect(pageTops(sizes, 1000 / 600, 22.5, 2)).toEqual({ at: [0, 0, 1333.5 + 22.5, 1333.5 + 22.5 + 666.5 + 22.5], total: 1333.5 + 22.5 + 666.5 + 22.5 + 1333.5 });
    for (const dpr of [1, 2, 3]) {
      const scale = 1141 / 612;
      const t = pageTops([{ w: 612, h: 792 }, { w: 612, h: 792 }, { w: 595, h: 842 }, { w: 612, h: 792 }], scale, pageGap(1.37, dpr), dpr);
      for (const y of [...t.at, t.total]) expect(whole(y, dpr)).toBe(true);
      expect(t.at[2]! - t.at[1]!).toBeCloseTo(onPixel(792 * scale, dpr) + pageGap(1.37, dpr), 9);
      expect(t.total - t.at[4]!).toBeCloseTo(onPixel(792 * scale, dpr), 9);
    }
    // sheets that run on as one: nothing between them
    expect(pageTops([{ w: 612, h: 792 }, { w: 612, h: 792 }], 1, 0, 2)).toEqual({ at: [0, 0, 792], total: 1584 });
    expect(pageTops([{ w: 612, h: 792 }], 1, 18, 1)).toEqual({ at: [0, 0], total: 792 });
    expect(pageTops([], 1, 18, 1)).toEqual({ at: [0], total: 0 });
  });
});

describe("a book's pages zoomed", () => {
  it('fit is the pane; ⌘= draws the pages larger a step at a time, ⌘− smaller, ⌘0 fitted again', async () => {
    await mountBook();
    expect(px(page(1), 'width')).toBeCloseTo(800);
    expect(view().dataset.zoom).toBe('1');
    await cmd('=');
    expect(px(page(1), 'width')).toBeCloseTo(1000);
    // (a page is as tall as whole pixels of the screen, one to the px here: 1333, not 1333⅓)
    expect(px(page(1), 'height')).toBe(onPixel(1000 * 800 / 600, 1));
    expect(px(page(1), 'height')).toBe(1333);
    await cmd('=');
    expect(px(page(1), 'width')).toBeCloseTo(1200);
    expect(view().dataset.zoom).toBe('1.5');
    await cmd('-');
    expect(px(page(1), 'width')).toBeCloseTo(1000);
    await cmd('+', document.body, { shiftKey: true });
    await cmd('0');
    expect(px(page(1), 'width')).toBeCloseTo(800);
    // under fit the pages are smaller than the pane, down to half
    await cmd('-');
    expect(px(page(1), 'width')).toBeCloseTo(600);
    await cmd('-');
    await cmd('-');
    expect(px(page(1), 'width')).toBeCloseTo(400);
  });

  it('the keys are the pages\' and the text size is left alone', async () => {
    await mountBook();
    useApp.setState({ zoom: 1.1 });
    const ev = await cmd('=');
    expect(ev.defaultPrevented).toBe(true);
    expect((await cmd('0')).defaultPrevented).toBe(true);
    expect(useApp.getState().zoom).toBe(1.1);
  });

  it('with the caret in a field, or the book not in the pane in front, the keys are not taken', async () => {
    await mountBook();
    const field = host.appendChild(document.createElement('input'));
    expect((await cmd('=', field)).defaultPrevented).toBe(false);
    expect(px(page(1), 'width')).toBeCloseTo(800);
    unmount();
    await mountBook(undefined, false);
    expect((await cmd('=')).defaultPrevented).toBe(false);
    expect(px(page(1), 'width')).toBeCloseTo(800);
  });

  it('a ⌘0 something else took (a paragraph in the notes) is not the pages\'', async () => {
    await mountBook();
    await cmd('=');
    const ev = new KeyboardEvent('keydown', { key: '0', metaKey: true, bubbles: true, cancelable: true });
    ev.preventDefault();
    await act(async () => { document.body.dispatchEvent(ev); });
    expect(px(page(1), 'width')).toBeCloseTo(1000);
  });

  it('the bar says the page and, between − and +, the zoom; a press on the zoom fits the pages again', async () => {
    await mountBook();
    expect([token(), pct()]).toEqual(['p. 1 / 3', '100%']);
    await cmd('=');
    await cmd('=');
    expect([token(), pct()]).toEqual(['p. 1 / 3', '150%']);
    await act(async () => { host.querySelector<HTMLElement>('.pdf-view .meta [data-tool="zoom-fit"]')!.click(); });
    expect(pct()).toBe('100%');
    await act(async () => { host.querySelector<HTMLElement>('.pdf-view .meta [data-tool="zoom-out"]')!.click(); });
    expect(pct()).toBe('75%');
    await cmd('0');
    expect(pct()).toBe('100%');
  });

  it('the pages below move down with the ones above, and the column is as wide as a page', async () => {
    await mountBook();
    const gap = px(page(2), 'top') - px(page(1), 'height');
    expect(gap).toBe(pageGap(1, 1));
    await cmd('=');
    await cmd('=');
    await cmd('=');
    expect(px(page(1), 'height')).toBe(onPixel(2 * 800 * 800 / 600, 1));
    // the room between two pages grows with them (86): a zoom is the same picture larger
    expect(px(page(2), 'top') - px(page(1), 'height')).toBe(2 * gap);
    expect(px(page(3), 'top')).toBe(2 * (px(page(1), 'height') + 2 * gap));
    expect([1, 2, 3].map((n) => px(page(n), 'top'))).toEqual(pageTops([1, 2, 3].map(() => ({ w: 600, h: 800 })), 1600 / 600, pageGap(2, 1), 1).at.slice(1));
    expect(px(host.querySelector('.pdf-pages'), 'width')).toBeCloseTo(1600);
  });

  it('wider than the pane the pages start at its left and the words over them keep the pane\'s width', async () => {
    await mountBook();
    const wrap = host.querySelector<HTMLElement>('.reader-wrap')!;
    expect(wrap.dataset.wide).toBeUndefined();
    await cmd('=');
    expect(wrap.dataset.wide).toBe('1');
    expect(view().style.getPropertyValue('--fit-w')).toBe('800px');
  });

  it('in a wide pane the pages fill it, and zoomed out they are narrower than the pane and stay centred', async () => {
    pane = 1400;
    await mountBook();
    // fitted: the pane's width, the pages across the window
    expect(px(page(1), 'width')).toBeCloseTo(1400);
    await cmd('-');
    expect(px(page(1), 'width')).toBeCloseTo(1050);
    expect(host.querySelector<HTMLElement>('.reader-wrap')!.dataset.wide).toBeUndefined();
    await cmd('0');
    await cmd('=');
    expect(host.querySelector<HTMLElement>('.reader-wrap')!.dataset.wide).toBe('1');
  });

  it('zoom is of the fit there is: a narrower pane (the note beside) and the same zoom', async () => {
    pane = 500;
    await mountBook();
    await cmd('=');
    await cmd('=');
    expect(px(page(1), 'width')).toBeCloseTo(750);
    expect(pct()).toBe('150%');
  });

  it('a box drawn at a zoom has the page coordinates it has at fit, and is drawn where it was drawn', async () => {
    const draw = async () => {
      // a page laid out where its styles say; the press and the release in its coordinates
      const el = page(1);
      const w = px(el, 'width');
      const h = px(el, 'height');
      el.getBoundingClientRect = () => ({ left: 0, top: 0, right: w, bottom: h, width: w, height: h, x: 0, y: 0, toJSON() {} });
      const at = (type: string, fx: number, fy: number) => {
        const ev = new MouseEvent(type, { bubbles: true, cancelable: true, clientX: fx * w, clientY: fy * h, button: 0 });
        Object.defineProperties(ev, { pointerId: { value: 1 }, pointerType: { value: 'mouse' }, isPrimary: { value: true } });
        return ev;
      };
      await act(async () => { el.dispatchEvent(at('pointerdown', 0.25, 0.25)); });
      await act(async () => { window.dispatchEvent(at('pointermove', 0.5, 0.375)); });
      await act(async () => { window.dispatchEvent(at('pointerup', 0.75, 0.5)); });
      const box = host.querySelector<HTMLElement>('.pbox.pending:not(.ghost)')!;
      return { w, h, box };
    };
    await mountBook();
    const fit = await draw();
    const fitFrac = [px(fit.box, 'left') / fit.w, px(fit.box, 'top') / fit.h, px(fit.box, 'width') / fit.w, px(fit.box, 'height') / fit.h];
    expect(fitFrac.map((v) => +v.toFixed(4))).toEqual([0.25, 0.25, 0.5, 0.25]);
    // the box drawn at fit grows with the page
    await cmd('=');
    await cmd('=');
    await cmd('=');
    const grown = host.querySelector<HTMLElement>('.pbox.pending:not(.ghost)')!;
    expect(px(grown, 'left')).toBeCloseTo(0.25 * 1600);
    expect(px(grown, 'width')).toBeCloseTo(0.5 * 1600);
    // (of the page as it is drawn, on whole pixels: 2133 tall)
    expect(px(grown, 'top')).toBeCloseTo(0.25 * onPixel(1600 * 800 / 600, 1));
    unmount();
    // drawn at 200% on another book: the same fractions of the page
    await mountBook();
    await cmd('=');
    await cmd('=');
    await cmd('=');
    const z = await draw();
    expect(z.w).toBeCloseTo(1600);
    expect([px(z.box, 'left') / z.w, px(z.box, 'top') / z.h, px(z.box, 'width') / z.w, px(z.box, 'height') / z.h].map((v) => +v.toFixed(4))).toEqual([0.25, 0.25, 0.5, 0.25]);
  });

  it('the text layer is laid out at the zoomed scale (the search\'s highlights lie on it)', async () => {
    await mountBook();
    await act(async () => { host.querySelector('.book-pages')!.dispatchEvent(new Event('scroll')); });
    await settle();
    expect(page(1).style.getPropertyValue('--total-scale-factor')).toBe(String(800 / 600));
    await cmd('=');
    await cmd('=');
    await act(async () => { host.querySelector('.book-pages')!.dispatchEvent(new Event('scroll')); });
    await settle();
    expect(page(1).style.getPropertyValue('--total-scale-factor')).toBe(String(1200 / 600));
    // the canvas fills the page's box, which is the zoomed page on whole pixels, a pixel of it to each of the screen's (86)
    const canvas = page(1).querySelector<HTMLCanvasElement>('canvas')!;
    expect([canvas.style.width, canvas.style.height]).toEqual(['100%', '100%']);
    expect([page(1).style.width, page(1).style.height]).toEqual(['1200px', '1600px']);
    expect([canvas.width, canvas.height]).toEqual([1200, 1600]);
  });

  it('a pinch steps once a gesture, however many events it sends', async () => {
    await mountBook();
    const sc = host.querySelector<HTMLElement>('.book-pages')!;
    const wheel = async (deltaY: number, at: number, ctrlKey = true) => {
      const ev = new WheelEvent('wheel', { deltaY, ctrlKey, bubbles: true, cancelable: true });
      Object.defineProperty(ev, 'timeStamp', { value: at });
      await act(async () => { sc.dispatchEvent(ev); });
      return ev;
    };
    // fingers apart: a burst of events, one step
    expect((await wheel(-4, 1000)).defaultPrevented).toBe(true);
    for (let i = 1; i < 12; i++) await wheel(-6, 1000 + i * 16);
    expect(px(page(1), 'width')).toBeCloseTo(1000);
    // a second gesture, the other way
    await wheel(5, 3000);
    await wheel(5, 3016);
    expect(px(page(1), 'width')).toBeCloseTo(800);
    // a plain scroll is the scroll
    expect((await wheel(-40, 5000, false)).defaultPrevented).toBe(false);
    expect(px(page(1), 'width')).toBeCloseTo(800);
  });

  it('is the book\'s own, and kept when its tab is shown again', async () => {
    await mountBook('library/zoom-kept.pdf');
    await cmd('=');
    await cmd('=');
    unmount();
    await mountBook('library/zoom-other.pdf');
    expect(px(page(1), 'width')).toBeCloseTo(800);
    unmount();
    await mountBook('library/zoom-kept.pdf');
    expect(px(page(1), 'width')).toBeCloseTo(1200);
    expect([token(), pct()]).toEqual(['p. 1 / 3', '150%']);
    expect(BOOK).toBe('library/zoom-kept.pdf');
  });

  it('after a zoom by the keys the same place is at the middle of the view, down and across', async () => {
    await mountBook();
    const sc = host.querySelector<HTMLElement>('.book-pages')!;
    const col = host.querySelector<HTMLElement>('.pdf-pages')!;
    // lay the scroller and the column out from the styles the lens sets: a view 800 × 600 at (0, 0), the pages from 100px down
    sc.getBoundingClientRect = () => ({ left: 0, top: 0, right: 800, bottom: 600, width: 800, height: 600, x: 0, y: 0, toJSON() {} });
    const rectOf = (el: HTMLElement, top: number) => () => {
      const w = px(el, 'width'); const h = px(el, 'height');
      const l = -sc.scrollLeft; const t = 100 + top - sc.scrollTop;
      return { left: l, top: t, right: l + w, bottom: t + h, width: w, height: h, x: l, y: t, toJSON() {} };
    };
    col.getBoundingClientRect = () => rectOf(col, 0)();
    for (const n of [1, 2, 3]) { const el = page(n); el.getBoundingClientRect = () => rectOf(el, px(el, 'top') || 0)(); }
    // half way down page 2 under the place the view keeps (60px down)
    const p2 = px(page(2), 'top'); const h2 = px(page(2), 'height');
    await act(async () => { sc.scrollTop = 100 + p2 + h2 / 2 - 60; sc.dispatchEvent(new Event('scroll')); });
    // the middle of the view under the words over the pages: half way between 60px down and its foot
    const cy = (60 + 600) / 2;
    const r0 = page(2).getBoundingClientRect();
    const f = (cy - r0.top) / r0.height;
    await cmd('=');
    await cmd('=');
    await cmd('=');
    const r = page(2).getBoundingClientRect();
    expect(r.height).toBeGreaterThan(r0.height * 1.9);
    expect((cy - r.top) / r.height).toBeCloseTo(f, 3);
    // the middle of the pages across is at the middle of the view
    const c = col.getBoundingClientRect();
    expect((400 - c.left) / c.width).toBeCloseTo(0.5, 3);
    expect(sc.scrollLeft).toBeCloseTo(400);
  });
});
