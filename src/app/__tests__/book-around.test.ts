// @vitest-environment jsdom
// Getting around a book (milestone 76, `Pdf.tsx`): the trail of places (⌫ ⇧⌫),
// the PDF's own links, the contents in the palette, a reference peeked at
// without selecting it, the hints' letters, `n` and `N`, a selection looked
// up. The real lens over a five-page stand-in with an outline, links and
// text items, pdf.js mocked (the harness of `book-zoom.test.ts`); jsdom lays
// nothing out, so the scroller and the pages are given the rectangles their
// styles and the scroll say.

import { act, createElement } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, describe, expect, it, vi } from 'vitest';

vi.mock('@tauri-apps/plugin-dialog', () => ({ open: async () => null }));
const opened: string[] = [];
vi.mock('@tauri-apps/plugin-opener', () => ({ openUrl: async (url: string) => { opened.push(url); } }));

/** The stand-in: what its pages say, link to and are outlined as. `outline: false` is a PDF with none. */
const book = { outline: true, annotated: [] as number[] };
const linesOn = (n: number): string[] => [`entropy on page ${n}`, ...(n === 1 ? ['as (3.12) shows'] : n === 2 ? ['S = k ln W (3.12)'] : [])];
const annotsOn = (n: number): unknown[] => (n === 1 ? [
  // an inside link (a named destination: page 3, half way down), and a web one
  { subtype: 'Link', rect: [60, 700, 180, 720], dest: 'sec2' },
  { subtype: 'Link', rect: [300, 400, 420, 412], url: 'https://example.org/paper' },
] : n === 2 ? [{ subtype: 'Link', rect: [60, 700, 180, 720], dest: [4, { name: 'Fit' }] }] : []);
const fakePage = (n: number) => ({
  n,
  getViewport: ({ scale }: { scale: number }) => ({ width: 600 * scale, height: 800 * scale }),
  render: () => ({ promise: Promise.resolve() }),
  streamTextContent: () => ({ n }),
  getAnnotations: async () => { book.annotated.push(n); return annotsOn(n); },
  // `as (3.12) shows` at x = 60, its baseline 600 up the page, 5pt a character
  getTextContent: async () => ({ items: n === 1 ? [{ str: 'as (3.12) shows', transform: [10, 0, 0, 10, 60, 600], width: 75, height: 10 }] : [] }),
});
const fakePdf = {
  numPages: 5,
  getPage: async (n: number) => fakePage(n),
  getOutline: async () => (book.outline ? [
    { title: '1 Heat', dest: [0, { name: 'XYZ' }, 0, 800, null], items: [{ title: '1.1 Work', dest: [1, { name: 'XYZ' }, 0, 400, null], items: [] }] },
    { title: '2 Entropy', dest: 'sec2', items: [] },
    { title: '3 Ensembles', dest: [4, { name: 'Fit' }], items: [] },
  ] : null),
  getDestination: async (name: string) => (name === 'sec2' ? [{ num: 2 }, { name: 'XYZ' }, 0, 400, null] : null),
  getPageIndex: async (ref: { num: number }) => ref.num,
};
vi.mock('../pdfjs.js', () => ({
  pdfText: async () => ({ pages: 1, text: '', title: '', chapters: [] }),
  TextLayer: class {
    constructor(private o: { textContentSource: { n: number }; container: HTMLElement }) {}
    async render() { for (const l of linesOn(this.o.textContentSource.n)) { const sp = document.createElement('span'); sp.textContent = l; this.o.container.append(sp); } }
  },
  pageBits: async (page: { n: number }) => linesOn(page.n).map((str, i) => ({ str, eol: true, y: 700 - 20 * i, height: 10 })),
  loadPdf: () => ({}), loadPdfPieces: () => ({}),
}));
vi.mock('../bookPdf.js', () => ({
  acquirePdf: () => ({ promise: Promise.resolve(fakePdf), release() {} }),
  itemsOf: async () => [], fillCrops: () => {}, drawCrop: async () => {}, WHOLE_MAX: 1,
}));
vi.mock('../vault.js', async (orig) => ({ ...(await orig<typeof import('../vault.js')>()), currentVault: () => null }));

const { Pdf, onPixel } = await import('../Pdf.js');
const { Palette } = await import('../Palette.js');
const { useApp } = await import('../store.js');
const { lensOf, trailOf, takeContents, bookInFront } = await import('../book.js');
const { closePopMenu } = await import('../popMenu.js');
const { hintsFor, contentsRows, searchContents } = await import('../chrome.js');
globalThis.ResizeObserver ??= class { observe() {} unobserve() {} disconnect() {} } as unknown as typeof ResizeObserver;
globalThis.IntersectionObserver ??= class { observe() {} unobserve() {} disconnect() {} } as unknown as typeof IntersectionObserver;
Element.prototype.scrollIntoView ??= function () {};
(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
Object.defineProperty(HTMLElement.prototype, 'clientWidth', { configurable: true, get(this: HTMLElement) { return this.classList.contains('reader-wrap') ? 800 : 0; } });

let host: HTMLDivElement;
let root: Root;
let mounted = false;
let seq = 0;
let BOOK = '';
const settle = () => act(async () => { await new Promise((r) => setTimeout(r, 10)); });
const px = (el: Element | null, prop: 'width' | 'height' | 'top') => parseFloat((el as HTMLElement).style[prop]) || 0;
const page = (n: number) => host.querySelector<HTMLElement>(`.pdf-page[data-page="${n}"]`)!;
const view = () => host.querySelector<HTMLElement>('.pdf-view')!;
const sc = () => host.querySelector<HTMLElement>('.book-pages')!;
const scrolled = async (top?: number) => { await act(async () => { if (top !== undefined) sc().scrollTop = top; sc().dispatchEvent(new Event('scroll')); }); await settle(); };

/** The scroller a view 800 × 600 at the window's corner, the pages from 100px down it, each where its styles and the scroll put it. */
function layout() {
  const s = sc();
  const col = host.querySelector<HTMLElement>('.pdf-pages')!;
  s.getBoundingClientRect = () => ({ left: 0, top: 0, right: 800, bottom: 600, width: 800, height: 600, x: 0, y: 0, toJSON() {} });
  const rectOf = (el: HTMLElement, top: () => number) => () => {
    const w = px(el, 'width'); const h = px(el, 'height');
    const l = -s.scrollLeft; const t = 100 + top() - s.scrollTop;
    return { left: l, top: t, right: l + w, bottom: t + h, width: w, height: h, x: l, y: t, toJSON() {} };
  };
  col.getBoundingClientRect = rectOf(col, () => 0);
  for (const el of host.querySelectorAll<HTMLElement>('.pdf-page')) el.getBoundingClientRect = rectOf(el, () => px(el, 'top'));
}

/** A book of its own a test (a trail is kept by the book's id): five 600 × 800 pages, or `pages` of them as a chapter. */
async function mountBook(pages?: { first: number; last: number }, id = `library/around-${++seq}.pdf`) {
  BOOK = id;
  book.annotated.length = 0;
  useApp.setState({ vault: '/v', tree: [], paletteOpen: false, notice: null, docs: { [id]: { type: 'source', frozen: true, cards: 0, due: 0, pdf: id, ...(pages ? { pages } : {}) } } as never });
  host = document.body.appendChild(document.createElement('div'));
  root = createRoot(host);
  mounted = true;
  await act(async () => { root.render(createElement(Pdf, { id, active: true })); });
  await settle();
  layout();
  // the pages near the view are drawn, their links read
  await scrolled();
}
afterEach(() => {
  if (mounted) { mounted = false; act(() => root.unmount()); host.remove(); }
  closePopMenu();
  window.getSelection()?.removeAllRanges();
  opened.length = 0;
  book.outline = true;
  useApp.setState({ paletteOpen: false });
  takeContents();
});

const key = async (k: string, more: KeyboardEventInit = {}, target: EventTarget = document.body) => {
  const ev = new KeyboardEvent('keydown', { key: k, bubbles: true, cancelable: true, ...more });
  await act(async () => { target.dispatchEvent(ev); });
  await settle();
  return ev;
};
/** A mouse event at a point of page `n` (fractions of it), sent to the page as the web view would. */
const at = (type: string, n: number, fx: number, fy: number, more: MouseEventInit = {}, pointerType = 'mouse') => {
  const r = page(n).getBoundingClientRect();
  const ev = new MouseEvent(type, { bubbles: true, cancelable: true, clientX: r.left + fx * r.width, clientY: r.top + fy * r.height, button: 0, ...more });
  Object.defineProperties(ev, { pointerId: { value: 1 }, pointerType: { value: pointerType }, isPrimary: { value: true } });
  return ev;
};
const click = async (n: number, fx: number, fy: number, more: MouseEventInit = {}) => { await act(async () => { page(n).dispatchEvent(at('click', n, fx, fy, more)); }); await settle(); };
const typeIn = async (el: HTMLInputElement, text: string) => {
  await act(async () => {
    Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value')!.set!.call(el, text);
    el.dispatchEvent(new Event('input', { bubbles: true }));
  });
  await settle();
};
const back = () => Number(view().dataset.back);
const fwd = () => Number(view().dataset.fwd);
/** A page's height in the pane: 600 × 800 fitted to 800 across, on whole pixels of the screen (one to the px here: 1067, not 1066⅔; 86). */
const H = onPixel(800 * 800 / 600, 1);
/** The scroll that puts `y` of page `n` under the top of the view, `room` px left over it. */
const scrollFor = (n: number, y: number, room = 0) => 100 + px(page(n), 'top') + y * H - 60 - room;
// on page 1: the inside link, the web link, and the word `(3.12)`
const LINK = [0.2, 0.11] as const;
const WEB = [0.6, 0.49] as const;
const REF = [0.15, 0.243] as const;

describe('the PDF\'s own links', () => {
  it('lie over the pages drawn, scaled with them, and are read only for the pages drawn', async () => {
    await mountBook();
    const drawn = [...host.querySelectorAll<HTMLElement>('.plink')];
    expect(drawn.map((l) => [l.dataset.page, l.dataset.kind])).toEqual([['1', 'inside'], ['1', 'web'], ['2', 'inside']]);
    expect(px(drawn[0]!, 'width')).toBeCloseTo(0.2 * 800);
    expect(px(drawn[0]!, 'top')).toBeCloseTo(0.1 * H);
    expect(drawn[1]!.dataset.href).toBe('https://example.org/paper');
    await key('=', { metaKey: true });
    await scrolled();
    expect(px(host.querySelector('.plink'), 'width')).toBeCloseTo(0.2 * 1000);
    // a page's links are read as it is drawn, once: not again when it is drawn at another scale
    // (jsdom lays nothing out, so every page counts as near the view when the book opens)
    expect([...book.annotated].sort()).toEqual([1, 2, 3, 4, 5]);
  });

  it('a press on an inside link is a jump to what it names, with the way back', async () => {
    await mountBook();
    await scrolled(500);
    expect(back()).toBe(0);
    await click(1, ...LINK);
    // page 3, half way down, a line under the words over the pages
    expect(sc().scrollTop).toBeCloseTo(scrollFor(3, 0.5, 16));
    await scrolled();
    expect(view().dataset.topPage).toBe('3');
    expect(back()).toBe(1);
    expect(trailOf(BOOK).back[0]).toEqual({ page: 1, y: expect.closeTo((60 - (100 - 500)) / H, 5), x: null });
  });

  it('a web link opens in the system\'s browser and the pages stay', async () => {
    await mountBook();
    await click(1, ...WEB);
    expect(opened).toEqual(['https://example.org/paper']);
    expect(sc().scrollTop).toBe(0);
    expect(back()).toBe(0);
  });

  it('a press that moved is not the link\'s: a box drawn from a link is a box', async () => {
    await mountBook();
    await act(async () => { page(1).dispatchEvent(at('pointerdown', 1, ...LINK)); });
    await act(async () => { window.dispatchEvent(at('pointermove', 1, 0.4, 0.2)); });
    await act(async () => { window.dispatchEvent(at('pointerup', 1, 0.6, 0.3)); });
    await click(1, 0.6, 0.3);
    expect(host.querySelector('.pbox.pending:not(.ghost)')).not.toBeNull();
    expect(back()).toBe(0);
    expect(sc().scrollTop).toBe(0);
    // the press that does not move, after a pointer down in the same place, is
    await key('Escape');
    await act(async () => { page(1).dispatchEvent(at('pointerdown', 1, ...LINK)); });
    await act(async () => { window.dispatchEvent(at('pointerup', 1, ...LINK)); });
    await click(1, ...LINK);
    expect(back()).toBe(1);
  });

  it('a finger\'s press follows it; a finger\'s hold is the box\'s', async () => {
    await mountBook();
    const touch = (type: string, t: number) => { const ev = at(type, 1, ...LINK, {}, 'touch'); Object.defineProperty(ev, 'timeStamp', { value: t }); return ev; };
    await act(async () => { page(1).dispatchEvent(touch('pointerdown', 1000)); });
    await act(async () => { page(1).dispatchEvent(touch('click', 1900)); });
    await settle();
    expect(back()).toBe(0);
    await act(async () => { page(1).dispatchEvent(touch('pointerdown', 3000)); });
    await act(async () => { window.dispatchEvent(touch('pointerup', 3080)); });
    await act(async () => { page(1).dispatchEvent(touch('click', 3090)); });
    await settle();
    expect(back()).toBe(1);
  });

  it('with ⌥ the destination is peeked at, not gone to; a press in the peek goes there', async () => {
    await mountBook();
    await click(1, ...LINK, { altKey: true });
    const peek = host.querySelector<HTMLElement>('.pdf-peek')!;
    expect(peek.dataset.page).toBe('3');
    expect(sc().scrollTop).toBe(0);
    expect(back()).toBe(0);
    await act(async () => { peek.click(); });
    await settle();
    expect(host.querySelector('.pdf-peek')).toBeNull();
    expect(sc().scrollTop).toBeCloseTo(scrollFor(3, 0.5, 16));
    expect(back()).toBe(1);
  });

  it('on a chapter a link out of its pages is said, not followed', async () => {
    await mountBook({ first: 2, last: 3 });
    expect(host.querySelectorAll('.pdf-page').length).toBe(2);
    // page 2's link names page 5
    await click(2, ...LINK);
    expect(useApp.getState().notice?.line).toBe('p. 5 is not among these pages');
    expect(back()).toBe(0);
  });
});

describe('back and forth', () => {
  it('⌫ goes back to the place exactly, ⇧⌫ forward again; a scroll by hand keeps the forward list until a jump', async () => {
    await mountBook();
    await scrolled(437);
    await click(1, ...LINK);
    const there = sc().scrollTop;
    await scrolled();
    const ev = await key('Backspace');
    expect(ev.defaultPrevented).toBe(true);
    expect(sc().scrollTop).toBeCloseTo(437);
    expect([back(), fwd()]).toEqual([0, 1]);
    await scrolled();
    // nowhere further back: the key is not taken
    expect((await key('Backspace')).defaultPrevented).toBe(false);
    // scrolled on by hand: forward is still there
    await scrolled(900);
    expect(fwd()).toBe(1);
    await key('Backspace', { shiftKey: true });
    expect(sc().scrollTop).toBeCloseTo(there);
    expect([back(), fwd()]).toEqual([1, 0]);
    await scrolled();
    // back again lands where the hand had scrolled to
    await key('Backspace');
    expect(sc().scrollTop).toBeCloseTo(900);
    expect(fwd()).toBe(1);
    await scrolled();
    // a new jump: nothing to go forward to
    await scrolled(100);
    await click(1, ...LINK);
    expect([back(), fwd()]).toEqual([1, 0]);
  });

  it('holds zoomed: the place is the page\'s, whatever the scale', async () => {
    await mountBook();
    await scrolled(437);
    await click(1, ...LINK);
    await scrolled();
    await key('=', { metaKey: true });
    await key('=', { metaKey: true });
    await scrolled();
    await key('Backspace');
    const r = page(1).getBoundingClientRect();
    expect((60 - r.top) / r.height).toBeCloseTo((60 - (100 - 437)) / H, 4);
  });

  it('with the caret in a field, the palette open, or a menu up, ⌫ is not the pages\'', async () => {
    await mountBook();
    await click(1, ...LINK);
    await scrolled();
    const field = host.appendChild(document.createElement('input'));
    expect((await key('Backspace', {}, field)).defaultPrevented).toBe(false);
    useApp.setState({ paletteOpen: true });
    expect((await key('Backspace')).defaultPrevented).toBe(false);
    useApp.setState({ paletteOpen: false });
    // a menu up (it may take the key itself: the pages do not go back for it)
    const menu = document.body.appendChild(document.createElement('div'));
    menu.className = 'ctx-menu';
    try { await key('Backspace'); } finally { menu.remove(); }
    expect(back()).toBe(1);
    expect((await key('Backspace')).defaultPrevented).toBe(true);
    expect(back()).toBe(0);
  });

  it('`g` to a page and a search\'s first hit are jumps; the steps through the hits are not', async () => {
    await mountBook();
    await key('g');
    const go = host.querySelector<HTMLInputElement>('.pdf-bar input[type="number"]')!;
    await typeIn(go, '4');
    await key('Enter', {}, go);
    expect(back()).toBe(1);
    await scrolled(300);
    await key('/');
    const field = host.querySelector<HTMLInputElement>('.pdf-bar input')!;
    await typeIn(field, 'entropy');
    await key('Enter', {}, field);
    expect(back()).toBe(2);
    await key('Enter', {}, field);
    await key('Enter', {}, field);
    expect(back()).toBe(2);
  });

  it('the strip says `⌫ back` only while there is somewhere to go back to', async () => {
    const hints = (b: boolean) => hintsFor({ kind: 'source', el: null, scope: null, canEnrol: false, pages: true, back: b }).map(([k]) => k);
    expect(hints(false)).not.toContain('⌫');
    expect(hints(true)).toContain('⌫');
    expect(hintsFor({ kind: 'source', el: null, scope: null, canEnrol: false, back: true }).map(([k]) => k)).not.toContain('⌫');
    await mountBook();
    expect(bookInFront()).toBe(BOOK);
    expect(trailOf(BOOK).back.length).toBe(0);
    await click(1, ...LINK);
    expect(trailOf(BOOK).back.length).toBe(1);
  });
});

describe('`n` and `N`', () => {
  it('step the search\'s hits once the caret has left its field, until esc', async () => {
    await mountBook();
    await key('/');
    const field = host.querySelector<HTMLInputElement>('.pdf-bar input')!;
    await typeIn(field, 'entropy');
    await key('Enter', {}, field);
    const n = () => host.querySelector('.pb-n')?.textContent;
    expect(n()).toBe('p. 1, 1 / 5');
    // in the field the letters are typed
    expect((await key('n', {}, field)).defaultPrevented).toBe(false);
    expect(n()).toBe('p. 1, 1 / 5');
    await act(async () => { field.blur(); });
    expect((await key('n')).defaultPrevented).toBe(true);
    expect(n()).toBe('p. 2, 2 / 5');
    await key('n');
    expect(n()).toBe('p. 3, 3 / 5');
    await key('N', { shiftKey: true });
    expect(n()).toBe('p. 2, 2 / 5');
    await key('Escape');
    expect(host.querySelector('.pdf-bar')).toBeNull();
    expect((await key('n')).defaultPrevented).toBe(false);
  });
});

describe('a reference without selecting', () => {
  it('⌥-press on a word that names something shows where it points in the peek; esc closes it; ⏎ goes there', async () => {
    await mountBook();
    // a plain press on it does nothing
    await click(1, ...REF);
    expect(host.querySelector('.pdf-peek')).toBeNull();
    await click(1, ...REF, { altKey: true });
    const peek = host.querySelector<HTMLElement>('.pdf-peek')!;
    expect(peek.dataset.page).toBe('2');
    expect(peek.querySelector('.pk-hd')!.textContent).toContain('S = k ln W (3.12)');
    expect(sc().scrollTop).toBe(0);
    await key('Escape');
    expect(host.querySelector('.pdf-peek')).toBeNull();
    await click(1, ...REF, { altKey: true });
    await key('Enter');
    expect(host.querySelector('.pdf-peek')).toBeNull();
    // the line `S = k ln W (3.12)` on page 2: its top 690 of 800 up the page
    expect(sc().scrollTop).toBeCloseTo(scrollFor(2, 1 - 690 / 800, 16));
    expect(back()).toBe(1);
  });

  it('⌥-press beside it shows nothing', async () => {
    await mountBook();
    await click(1, 0.5, 0.243, { altKey: true });
    expect(host.querySelector('.pdf-peek')).toBeNull();
  });

  it('a right-click on it offers `peek` first', async () => {
    await mountBook();
    const ev = at('contextmenu', 1, ...REF, { button: 2 });
    await act(async () => { page(1).dispatchEvent(ev); });
    await settle();
    expect(ev.defaultPrevented).toBe(true);
    const rows = [...document.querySelectorAll<HTMLElement>('.ctx-menu [data-act]')];
    expect(rows.map((r) => r.dataset.act)).toEqual(['peek', 'follow']);
    expect(rows[0]!.textContent).toBe('peek');
    await act(async () => { rows[0]!.click(); });
    await settle();
    expect(host.querySelector<HTMLElement>('.pdf-peek')!.dataset.page).toBe('2');
  });

  it('a right-click on a link offers `peek` first, then going', async () => {
    await mountBook();
    await act(async () => { page(1).dispatchEvent(at('contextmenu', 1, ...LINK, { button: 2 })); });
    const rows = [...document.querySelectorAll<HTMLElement>('.ctx-menu [data-act]')];
    expect(rows.map((r) => r.textContent)).toEqual(['peek', 'go there']);
    await act(async () => { rows[0]!.click(); });
    await settle();
    expect(host.querySelector<HTMLElement>('.pdf-peek')!.dataset.page).toBe('3');
    expect(back()).toBe(0);
  });
});

describe('link hints', () => {
  const labels = () => [...host.querySelectorAll<HTMLElement>('.phint')].map((h) => [h.dataset.label, h.dataset.kind]);

  it('`f` letters every link and reference in view, in reading order; the letter typed follows it', async () => {
    await mountBook();
    await scrolled(100);
    expect((await key('f')).defaultPrevented).toBe(true);
    expect(labels()).toEqual([['a', 'link'], ['s', 'ref'], ['d', 'web']]);
    expect(host.querySelector<HTMLElement>('.phint')!.tagName).toBe('KBD');
    // the label lies at its target's corner
    expect(px(host.querySelector('.phint[data-label="s"]'), 'top')).toBeCloseTo((190 / 800) * H);
    await key('a');
    expect(labels()).toEqual([]);
    expect(sc().scrollTop).toBeCloseTo(scrollFor(3, 0.5, 16));
    expect(back()).toBe(1);
  });

  it('a web link\'s letter opens the browser; with ⇧ a letter peeks instead', async () => {
    await mountBook();
    await scrolled(100);
    await key('f');
    await key('d');
    expect(opened).toEqual(['https://example.org/paper']);
    await key('f');
    await key('S', { shiftKey: true });
    expect(host.querySelector<HTMLElement>('.pdf-peek')!.dataset.page).toBe('2');
    expect(sc().scrollTop).toBe(100);
    expect(back()).toBe(0);
  });

  it('esc or any other key lets the labels go, and the key does nothing else', async () => {
    await mountBook();
    await scrolled(100);
    await key('f');
    await key('Escape');
    expect(labels()).toEqual([]);
    await key('f');
    // ⇧ alone is on its way to a letter
    await key('Shift', { shiftKey: true });
    expect(labels().length).toBe(3);
    const ev = await key('t');
    expect(ev.defaultPrevented).toBe(true);
    expect(labels()).toEqual([]);
    expect(useApp.getState().paletteOpen).toBe(false);
    expect(back()).toBe(0);
  });

  it('only what is in view is lettered', async () => {
    await mountBook();
    // page 1's web link is under the view's bottom
    await key('f');
    expect(labels()).toEqual([['a', 'link'], ['s', 'ref']]);
  });
});

describe('the contents', () => {
  const rows = () => [...document.querySelectorAll<HTMLElement>('.palette-row')];
  let pal: Root | null = null;
  let palHost: HTMLDivElement | null = null;
  const drawPalette = async () => {
    palHost = document.body.appendChild(document.createElement('div'));
    pal = createRoot(palHost);
    await act(async () => { pal!.render(createElement(Palette)); });
    await settle();
  };
  afterEach(() => { if (pal) { act(() => pal!.unmount()); palHost!.remove(); pal = null; } });

  it('`t` opens the palette on the book\'s outline: indented, the page at the right, the entry in view marked', async () => {
    await mountBook();
    await scrolled(scrollFor(2, 0.7));
    expect((await key('t')).defaultPrevented).toBe(true);
    expect(useApp.getState().paletteOpen).toBe(true);
    await drawPalette();
    expect(rows().map((r) => [r.querySelector('.pt')!.textContent, r.dataset.depth, r.querySelector('.ptag')!.textContent, r.dataset.here])).toEqual([
      ['1 Heat', '0', 'p. 1', undefined],
      ['1.1 Work', '1', 'p. 2', '1'],
      ['2 Entropy', '0', 'p. 3', undefined],
      ['3 Ensembles', '0', 'p. 5', undefined],
    ]);
    expect(rows()[1]!.style.getPropertyValue('--depth')).toBe('1');
    // the entry in view is the one picked
    expect(rows()[1]!.dataset.sel).toBe('1');
    expect(document.querySelector<HTMLInputElement>('.palette-input input')!.placeholder).toContain('contents');
  });

  it('narrows as you type, by the palette\'s ranking; ⏎ goes there, a jump', async () => {
    await mountBook();
    await key('t');
    await drawPalette();
    const input = document.querySelector<HTMLInputElement>('.palette-input input')!;
    await typeIn(input, 'entr');
    expect(rows().map((r) => r.querySelector('.pt')!.textContent)).toEqual(['2 Entropy']);
    await key('Enter', {}, input);
    expect(useApp.getState().paletteOpen).toBe(false);
    expect(sc().scrollTop).toBeCloseTo(scrollFor(3, 0.5, 16));
    expect(back()).toBe(1);
  });

  it('the palette offers `contents · <book>` while a book is in front', async () => {
    await mountBook();
    useApp.setState({ paletteOpen: true });
    await drawPalette();
    const input = document.querySelector<HTMLInputElement>('.palette-input input')!;
    await typeIn(input, 'contents');
    const row = rows().find((r) => r.textContent?.includes('contents ·'))!;
    expect(row).toBeDefined();
    await act(async () => { row.click(); });
    await settle();
    expect(rows().length).toBe(4);
    expect(rows()[0]!.dataset.t).toBe('place');
  });

  it('on a chapter only the entries inside its pages', async () => {
    await mountBook({ first: 2, last: 3 });
    const c = await lensOf(BOOK)!.contents();
    expect(c.from).toBe('outline');
    expect(c.entries.map((e) => [e.title, e.depth, e.page])).toEqual([['1.1 Work', 1, 2], ['2 Entropy', 0, 3]]);
  });

  it('a pdf with no outline says so', async () => {
    book.outline = false;
    await mountBook();
    await key('t');
    await drawPalette();
    expect(rows()).toEqual([]);
    expect(document.querySelector('.palette-note')!.textContent).toBe('this pdf has no contents');
    expect(document.querySelectorAll('.palette-empty').length).toBe(1);
  });

  it('every entry is listed with nothing typed, past the palette\'s forty', () => {
    const many = contentsRows(Array.from({ length: 90 }, (_, i) => ({ title: `Section ${i + 1}`, depth: i % 3, page: i + 1 })), 7);
    expect(searchContents(many, '').length).toBe(90);
    expect(many[7]!.here).toBe(true);
    expect(many[8]!.here).toBeUndefined();
    expect(searchContents(many, 'section 42').map((r) => r.title)[0]).toBe('Section 42');
    expect(many[41]!.target).toEqual({ command: 'toc:41' });
  });
});

describe('look it up', () => {
  it('a selection\'s right-click offers the web and scholar, opened in the system\'s browser', async () => {
    const rp = Range.prototype as unknown as { getBoundingClientRect?: () => unknown; getClientRects?: () => unknown[] };
    const was = { rect: rp.getBoundingClientRect, rects: rp.getClientRects };
    rp.getBoundingClientRect = () => ({ top: 10, bottom: 20, left: 0, right: 40, width: 40, height: 10 });
    rp.getClientRects = () => [];
    try {
      await mountBook();
      const span = Array.from(host.querySelectorAll('.pdf-page[data-page="2"] .textLayer span')).find((x) => x.textContent?.includes('k ln W'))!;
      const r = document.createRange();
      r.setStart(span.firstChild!, 0);
      r.setEnd(span.firstChild!, 10);
      const select = () => act(async () => { const s = window.getSelection()!; s.removeAllRanges(); s.addRange(r); document.dispatchEvent(new Event('selectionchange')); });
      await select();
      // the two-button cue is as it was
      expect([...host.querySelectorAll('.sel-cue .cue-act')].map((b) => b.textContent)).toEqual(['passage e', 'card m']);
      await act(async () => { page(2).dispatchEvent(at('contextmenu', 2, 0.5, 0.5, { button: 2 })); });
      await settle();
      const acts = () => [...document.querySelectorAll<HTMLElement>('.ctx-menu [data-act]')];
      expect(acts().map((x) => x.dataset.act)).toEqual(['section', 'card', 'web', 'scholar']);
      expect(acts().map((x) => x.textContent).slice(2)).toEqual(['search the web', 'search scholar']);
      await act(async () => { acts()[2]!.click(); });
      expect(opened).toEqual(['https://duckduckgo.com/?q=S%20%3D%20k%20ln%20W']);
      await select();
      await act(async () => { page(2).dispatchEvent(at('contextmenu', 2, 0.5, 0.5, { button: 2 })); });
      await settle();
      await act(async () => { document.querySelector<HTMLElement>('.ctx-menu [data-act="scholar"]')!.click(); });
      expect(opened[1]).toBe('https://scholar.google.com/scholar?q=S%20%3D%20k%20ln%20W');
    } finally { if (was.rect) rp.getBoundingClientRect = was.rect; else delete rp.getBoundingClientRect; if (was.rects) rp.getClientRects = was.rects; else delete rp.getClientRects; }
  });

  it('a right-click on bare page, nothing selected, opens no menu', async () => {
    await mountBook();
    await act(async () => { page(1).dispatchEvent(at('contextmenu', 1, 0.5, 0.9, { button: 2 })); });
    await settle();
    expect(document.querySelector('.ctx-menu')).toBeNull();
  });
});
