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

const { Pdf, ZOOMS, zoomStep } = await import('../Pdf.js');
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
  it('go from 50% through fit to 300% and stop at both ends', () => {
    expect(ZOOMS).toEqual([0.5, 0.75, 1, 1.25, 1.5, 2, 2.5, 3]);
    let z = 1;
    const seen: number[] = [];
    for (let i = 0; i < 7; i++) { z = zoomStep(z, 1); seen.push(z); }
    expect(seen).toEqual([1.25, 1.5, 2, 2.5, 3, 3, 3]);
    expect(zoomStep(1, -1)).toBe(0.75);
    expect(zoomStep(0.75, -1)).toBe(0.5);
    expect(zoomStep(0.5, -1)).toBe(0.5);
    expect(zoomStep(2, -1)).toBe(1.5);
    expect(zoomStep(2.5, 0)).toBe(1);
  });
});

describe("a book's pages zoomed", () => {
  it('fit is the pane; ⌘= draws the pages larger a step at a time, ⌘− smaller, ⌘0 fitted again', async () => {
    await mountBook();
    expect(px(page(1), 'width')).toBeCloseTo(800);
    expect(view().dataset.zoom).toBe('1');
    await cmd('=');
    expect(px(page(1), 'width')).toBeCloseTo(1000);
    expect(px(page(1), 'height')).toBeCloseTo(1000 * 800 / 600);
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
    await cmd('=');
    await cmd('=');
    await cmd('=');
    expect(px(page(1), 'height')).toBeCloseTo(2 * 800 * 800 / 600);
    expect(px(page(2), 'top') - px(page(1), 'height')).toBeCloseTo(gap);
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
    expect(px(grown, 'top')).toBeCloseTo(0.25 * 1600 * 800 / 600);
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
    expect(page(1).querySelector<HTMLElement>('canvas')!.style.width).toBe('1200px');
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

  it('after a zoom the same text is under the top of the view and the middle stays the middle', async () => {
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
    await cmd('=');
    await cmd('=');
    await cmd('=');
    const r = page(2).getBoundingClientRect();
    expect((60 - r.top) / r.height).toBeCloseTo(0.5, 3);
    // the middle of the pages across is at the middle of the view
    const c = col.getBoundingClientRect();
    expect((400 - c.left) / c.width).toBeCloseTo(0.5, 3);
    expect(sc.scrollLeft).toBeCloseTo(400);
  });
});
