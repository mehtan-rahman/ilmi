// @vitest-environment jsdom
// What you leave on a book's pages (milestone 77, `Pdf.tsx`, `book.ts`):
// bookmarks (`b`, the gutter's mark, the palette's lists), marks by a letter
// (⇧M x, ' x, a capital the collection's), highlights (`h`, 1–4, the menu),
// portals (⇧P … ⇧P, the margin's mark and its peek, the pane beside that
// follows), the ruler (`v`, j k, `r`). The real lens over a five-page
// stand-in, pdf.js mocked (the harness of `book-around.test.ts`), over a
// collection that is a map of files: the marks are read from and written to
// `.ilmi/marks/<the PDF's hash>.json`, so a chapter and its book share them.

import { act, createElement } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { parse, meta, type Doc } from '../../format/index.js';
import { marksPath, parseMarks, serializeMarks, type Marks } from '../../vault/marks.js';

vi.mock('@tauri-apps/plugin-dialog', () => ({ open: async () => null }));
vi.mock('@tauri-apps/plugin-opener', () => ({ openUrl: async () => {} }));

const linesOn = (n: number): string[] => [`entropy on page ${n}`, `a second line on page ${n}`, ...(n === 2 ? ['S = k ln W (3.12)'] : [])];
const fakePage = (n: number) => ({
  n,
  getViewport: ({ scale }: { scale: number }) => ({ width: 600 * scale, height: 800 * scale }),
  render: () => ({ promise: Promise.resolve() }),
  streamTextContent: () => ({ n }),
  getAnnotations: async () => [],
  getTextContent: async () => ({ items: [] }),
});
const fakePdf = { numPages: 5, getPage: async (n: number) => fakePage(n), getOutline: async () => null, getDestination: async () => null, getPageIndex: async () => 0 };
vi.mock('../pdfjs.js', () => ({
  pdfText: async () => ({ pages: 1, text: '', title: '', chapters: [] }),
  TextLayer: class {
    constructor(private o: { textContentSource: { n: number }; container: HTMLElement }) {}
    async render() { for (const l of linesOn(this.o.textContentSource.n)) { const sp = document.createElement('span'); sp.textContent = l; this.o.container.append(sp); } }
  },
  // a line every 20 units down from 700 up an 800-unit page, 10 units of type; page 4 has no text
  pageBits: async (page: { n: number }) => (page.n === 4 ? [] : linesOn(page.n).map((str, i) => ({ str, eol: true, y: 700 - 20 * i, height: 10 }))),
  loadPdf: () => ({}), loadPdfPieces: () => ({}),
}));
/** The numbered heading the pages name a place by, when a test gives one. */
const heading = { on: 0 };
vi.mock('../bookPdf.js', () => ({
  acquirePdf: () => ({ promise: Promise.resolve(fakePdf), release() {} }),
  itemsOf: async (_rel: string, _pdf: unknown, n: number) => (n === heading.on ? [{ s: '3.3', x: 0.1, y: 0.02, h: 14 }, { s: 'Average values', x: 0.2, y: 0.02, h: 14 }, { s: 'body text of the page, which sets the size', x: 0.1, y: 0.3, h: 10 }] : []),
  fillCrops: () => {}, drawCrop: async () => {}, WHOLE_MAX: 1,
}));

// the collection: files by path, and each PDF's hash
const HASH = 'ab'.repeat(32);
const OTHER = 'cd'.repeat(32);
const files = new Map<string, string>();
const hashes = new Map<string, string>();
const updates: { path: string; doc: Doc }[] = [];
const opened: string[] = [];
const fakeVault = {
  root: '/v',
  abs: (rel: string) => `/v/${rel}`,
  async update(path: string, mutate: (d: Doc) => void) {
    const { doc } = parse('---\ntype: source\nread: due=2026-01-01 ivl=1 reps=1 pos=1 y=0.500\n---\n');
    mutate(doc);
    updates.push({ path, doc });
    return null;
  },
  fs: {
    pageInk: async () => [],
    blobAt: (abs: string) => hashes.get(abs) ?? null,
    inkedPages: async () => [],
    onPageInk: () => () => {},
    stat: async (p: string) => (files.has(p) || [...files.keys()].some((k) => k.startsWith(`${p}/`)) ? { mtimeMs: 0, size: 0, isDir: !files.has(p) } : null),
    readText: async (p: string) => { const t = files.get(p); if (t === undefined) throw new Error(`no ${p}`); return t; },
    writeText: async (p: string, text: string) => { files.set(p, text); },
    mkdir: async () => {},
    readDir: async (dir: string) => [...files.keys()].filter((k) => k.startsWith(`${dir}/`)).map((k) => ({ name: k.slice(dir.length + 1), isDir: false, isFile: true })),
  },
};
let vaultNow: unknown = fakeVault;
vi.mock('../vault.js', async (orig) => ({ ...(await orig<typeof import('../vault.js')>()), currentVault: () => vaultNow, openNode: (id: string) => { opened.push(id); } }));

const { Pdf, onPixel } = await import('../Pdf.js');
const { Palette } = await import('../Palette.js');
const { useApp } = await import('../store.js');
const { trailOf, takePlace, togglePortalsBeside, followed, portalPending, setPortalPending, marksOf, loadMarks, markList, setMark } = await import('../book.js');
const { closePopMenu } = await import('../popMenu.js');
const { actOnPassage, passageItems } = await import('../passages.js');
const { allMarks } = await import('../book.js');
const { undoNotice } = await import('../land.js');
const { titleOf } = await import('../names.js');
const { placeRows } = await import('../chrome.js');
globalThis.ResizeObserver ??= class { observe() {} unobserve() {} disconnect() {} } as unknown as typeof ResizeObserver;
globalThis.IntersectionObserver ??= class { observe() {} unobserve() {} disconnect() {} } as unknown as typeof IntersectionObserver;
Element.prototype.scrollIntoView ??= function () {};
Element.prototype.scrollTo ??= function (this: Element, o?: ScrollToOptions) { if (o && typeof o === 'object' && o.top !== undefined) this.scrollTop = o.top; } as never;
(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
Object.defineProperty(HTMLElement.prototype, 'clientWidth', { configurable: true, get(this: HTMLElement) { return this.classList.contains('reader-wrap') ? 800 : 0; } });

interface Mounted { host: HTMLDivElement; root: Root }
const mounts: Mounted[] = [];
let host: HTMLDivElement;
let seq = 0;
let BOOK = '';
const settle = () => act(async () => { await new Promise((r) => setTimeout(r, 10)); });
const px = (el: Element | null, prop: 'width' | 'height' | 'top' | 'left') => parseFloat((el as HTMLElement).style[prop]) || 0;
const page = (n: number, h = host) => h.querySelector<HTMLElement>(`.pdf-page[data-page="${n}"]`)!;
const view = (h = host) => h.querySelector<HTMLElement>('.pdf-view')!;
const sc = (h = host) => h.querySelector<HTMLElement>('.book-pages')!;
const scrolled = async (top?: number, h = host) => { await act(async () => { if (top !== undefined) sc(h).scrollTop = top; sc(h).dispatchEvent(new Event('scroll')); }); await settle(); };
/** A page's height in the pane: 600 × 800 fitted to 800 across, on whole pixels of the screen (one to the px here: 1067, not 1066⅔; 86). */
const H = onPixel(800 * 800 / 600, 1);
/** The scroll that puts `y` of page `n` under the top of the view, `room` px left over it. */
const scrollFor = (n: number, y: number, room = 0, h = host) => 100 + px(page(n, h), 'top') + y * H - 60 - room;

/** The scroller a view 800 × 600 at the window's corner, the pages from 100px down it, each where its styles and the scroll put it. */
function layout(h: HTMLDivElement) {
  const s = sc(h);
  const col = h.querySelector<HTMLElement>('.pdf-pages')!;
  s.getBoundingClientRect = () => ({ left: 0, top: 0, right: 800, bottom: 600, width: 800, height: 600, x: 0, y: 0, toJSON() {} });
  const rectOf = (el: HTMLElement, top: () => number) => () => {
    const w = px(el, 'width'); const ht = px(el, 'height');
    const l = -s.scrollLeft; const t = 100 + top() - s.scrollTop;
    return { left: l, top: t, right: l + w, bottom: t + ht, width: w, height: ht, x: l, y: t, toJSON() {} };
  };
  col.getBoundingClientRect = rectOf(col, () => 0);
  for (const el of h.querySelectorAll<HTMLElement>('.pdf-page')) el.getBoundingClientRect = rectOf(el, () => px(el, 'top'));
}

/** A book of its own a test: five 600 × 800 pages, or `pages` of them as a chapter; its PDF's hash `hash`. */
async function mountBook(o: { pages?: { first: number; last: number }; id?: string; hash?: string; active?: boolean; reading?: boolean; keep?: boolean } = {}) {
  const id = o.id ?? `library/marks-${++seq}.pdf`;
  hashes.set(`/v/${id}`, o.hash ?? HASH);
  const info = { type: 'source', frozen: true, cards: 0, due: 0, pdf: id, ...(o.pages ? { pages: o.pages } : {}), ...(o.reading ? { read: { pos: 1, y: 0.5, due: '2026-01-01', ivl: 1 } } : {}) };
  useApp.setState({ vault: '/v', tree: [], paletteOpen: false, notice: null, docs: { ...(o.keep ? useApp.getState().docs : {}), [id]: info } as never });
  const h = document.body.appendChild(document.createElement('div'));
  const root = createRoot(h);
  mounts.push({ host: h, root });
  await act(async () => { root.render(createElement(Pdf, { id, active: o.active ?? true })); });
  await settle();
  layout(h);
  await scrolled(undefined, h);
  if (o.active ?? true) { host = h; BOOK = id; }
  return h;
}
afterEach(() => {
  for (const m of mounts.splice(0)) { act(() => m.root.unmount()); m.host.remove(); }
  closePopMenu();
  window.getSelection()?.removeAllRanges();
  files.clear();
  hashes.clear();
  updates.length = 0;
  opened.length = 0;
  heading.on = 0;
  setPortalPending(null);
  // another collection: nothing held of the last test's
  vaultNow = { ...fakeVault };
  useApp.setState({ paletteOpen: false, notice: null });
});

const key = async (k: string, more: KeyboardEventInit = {}, target: EventTarget = document.body) => {
  const ev = new KeyboardEvent('keydown', { key: k, bubbles: true, cancelable: true, ...more });
  await act(async () => { target.dispatchEvent(ev); });
  await settle();
  return ev;
};
const at = (type: string, n: number, fx: number, fy: number, more: MouseEventInit = {}) => {
  const r = page(n).getBoundingClientRect();
  const ev = new MouseEvent(type, { bubbles: true, cancelable: true, clientX: r.left + fx * r.width, clientY: r.top + fy * r.height, button: 0, ...more });
  Object.defineProperties(ev, { pointerId: { value: 1 }, pointerType: { value: 'mouse' }, isPrimary: { value: true } });
  return ev;
};
const click = async (n: number, fx: number, fy: number, more: MouseEventInit = {}) => { await act(async () => { page(n).dispatchEvent(at('click', n, fx, fy, more)); }); await settle(); };
const menu = async (n: number, fx: number, fy: number) => { await act(async () => { page(n).dispatchEvent(at('contextmenu', n, fx, fy, { button: 2 })); }); await settle(); return [...document.querySelectorAll<HTMLElement>('.ctx-menu [data-act]')]; };
const typeIn = async (el: HTMLInputElement, text: string) => {
  await act(async () => {
    Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value')!.set!.call(el, text);
    el.dispatchEvent(new Event('input', { bubbles: true }));
  });
  await settle();
};
const stored = (hash = HASH): Marks => parseMarks(files.get(`/v/${marksPath(hash)}`) ?? null);
const kinds = (hash = HASH) => Object.values(stored(hash)).map((m) => m.kind).sort();
const notice = () => useApp.getState().notice?.line ?? '';
const bar = () => host.querySelector<HTMLElement>('.pdf-bar');
const back = () => trailOf(BOOK).back.length;
const seed = (marks: Marks, hash = HASH) => files.set(`/v/${marksPath(hash)}`, serializeMarks(marks));

let pal: Root | null = null;
let palHost: HTMLDivElement | null = null;
const drawPalette = async () => {
  useApp.setState({ paletteOpen: true });
  palHost = document.body.appendChild(document.createElement('div'));
  pal = createRoot(palHost);
  await act(async () => { pal!.render(createElement(Palette)); });
  await settle();
};
afterEach(() => { if (pal) { act(() => pal!.unmount()); palHost!.remove(); pal = null; } });
const rows = () => [...document.querySelectorAll<HTMLElement>('.palette-row')];
const palInput = () => document.querySelector<HTMLInputElement>('.palette-input input')!;
/** The palette's command whose name starts so, run. */
const runCommand = async (name: string) => {
  await typeIn(palInput(), name);
  const row = rows().find((r) => r.querySelector('.pt')!.textContent!.startsWith(name))!;
  expect(row, name).toBeDefined();
  await act(async () => { row.click(); });
  await settle();
};

describe('bookmarks', () => {
  it('`b` names the place in view in the book\'s bar, ⏎ keeps it: in the file by the pdf\'s hash, a mark in the left gutter', async () => {
    await mountBook();
    await scrolled(scrollFor(2, 0.25));
    expect((await key('b')).defaultPrevented).toBe(true);
    const input = bar()!.querySelector<HTMLInputElement>('input.pb-name')!;
    // a page that names no heading: its page
    expect(input.value).toBe('p. 2');
    expect(document.activeElement).toBe(input);
    await typeIn(input, '  the second   law ');
    await key('Enter', {}, input);
    expect(bar()).toBeNull();
    const [id, m] = Object.entries(stored())[0]!;
    expect(id).toMatch(/^b-[0-9a-f]{12}$/);
    expect(m).toMatchObject({ kind: 'bookmark', name: 'the second law', page: 2, y: 0.25 });
    expect(files.get(`/v/${marksPath(HASH)}`)).toBe(serializeMarks(stored()));
    const mark = host.querySelector<HTMLElement>('.bmark')!;
    expect(mark.title).toBe('the second law');
    expect(mark.dataset.page).toBe('2');
    // in the gutter left of the page, at its place down the page
    expect(px(mark, 'left')).toBeLessThan(0);
    expect(px(mark, 'top')).toBeCloseTo(px(page(2), 'top') + 0.25 * H - 5);
    expect(view().dataset.bookmarks).toBe('1');
    expect(notice()).toContain('bookmark · the second law · p. 2');
  });

  it('is named after the nearest heading above the place; esc cancels, and nothing is kept', async () => {
    heading.on = 2;
    await mountBook();
    await scrolled(scrollFor(2, 0.4));
    await key('b');
    expect(bar()!.querySelector<HTMLInputElement>('input.pb-name')!.value).toBe('3.3 · average values');
    await key('Escape', {}, bar()!.querySelector('input')!);
    expect(bar()).toBeNull();
    expect(stored()).toEqual({});
    expect(host.querySelector('.bmark')).toBeNull();
  });

  it('the palette lists the book\'s, the page at the right; ⏎ goes there, a jump with the way back', async () => {
    seed({ 'b-2': { kind: 'bookmark', name: 'ensembles', page: 4, y: 0.5, at: 2 }, 'b-1': { kind: 'bookmark', name: 'heat', page: 1, y: 0.1, at: 1 } });
    await mountBook();
    expect(host.querySelectorAll('.bmark').length).toBe(2);
    await drawPalette();
    await runCommand('bookmarks ·');
    expect(rows().map((r) => [r.querySelector('.pt')!.textContent, r.querySelector('.ptag')!.textContent, r.dataset.t])).toEqual([['heat', 'p. 1', 'place'], ['ensembles', 'p. 4', 'place']]);
    expect(palInput().placeholder).toContain('bookmarks ·');
    await typeIn(palInput(), 'ens');
    expect(rows().map((r) => r.querySelector('.pt')!.textContent)).toEqual(['ensembles']);
    await key('Enter', {}, palInput());
    expect(useApp.getState().paletteOpen).toBe(false);
    expect(sc().scrollTop).toBeCloseTo(scrollFor(4, 0.5, 0));
    expect(back()).toBe(1);
  });

  it('`bookmarks` lists every book\'s, the book as the row\'s place; ⏎ on another book\'s opens it there', async () => {
    seed({ 'b-1': { kind: 'bookmark', name: 'heat', page: 1, y: 0.1, at: 1 } });
    seed({ 'b-9': { kind: 'bookmark', name: 'elsewhere', page: 3, y: 0.2, at: 1 } }, OTHER);
    seed({ 'b-7': { kind: 'bookmark', name: 'orphan', page: 1, y: 0, at: 1 } }, 'ef'.repeat(32));
    await mountBook({ id: 'library/other.pdf', hash: OTHER, active: false });
    await mountBook({ keep: true });
    await drawPalette();
    await runCommand('bookmarks');
    const titles = rows().map((r) => [r.querySelector('.pt')!.textContent, r.querySelector('.psub')!.textContent, r.querySelector('.ptag')!.textContent]);
    expect(titles).toContainEqual(['elsewhere', 'other', 'p. 3']);
    expect(titles).toContainEqual(['heat', titleOf(BOOK, useApp.getState().docs, '/v'), 'p. 1']);
    // a pdf deleted from the collection keeps its marks, by its hash
    expect(titles).toContainEqual(['orphan', 'no longer in the collection', 'p. 1']);
    await act(async () => { rows().find((r) => r.textContent!.includes('elsewhere'))!.click(); });
    await settle();
    expect(opened).toEqual(['library/other.pdf']);
    // the other book's lens is not in front: the place waits for it
    expect(takePlace('library/other.pdf')).toEqual({ page: 3, y: 0.2 });
  });

  it('a right-click on the gutter\'s mark removes it, with the notice\'s undo', async () => {
    seed({ 'b-1': { kind: 'bookmark', name: 'heat', page: 1, y: 0.1, at: 1 } });
    await mountBook();
    await act(async () => { host.querySelector('.bmark')!.dispatchEvent(new MouseEvent('contextmenu', { bubbles: true, cancelable: true, button: 2 })); });
    await act(async () => { document.querySelector<HTMLElement>('.ctx-menu [data-act="bookmark-remove"]')!.click(); });
    await settle();
    expect(host.querySelector('.bmark')).toBeNull();
    expect(stored()).toEqual({});
    expect(useApp.getState().notice).toMatchObject({ line: 'bookmark removed · heat', undo: true });
  });

  it('a chapter cut from the book shows the same marks: one outside its pages is listed, and said, not gone to', async () => {
    seed({ 'b-1': { kind: 'bookmark', name: 'in the chapter', page: 3, y: 0.1, at: 1 }, 'b-2': { kind: 'bookmark', name: 'past it', page: 5, y: 0.5, at: 2 } });
    await mountBook({ pages: { first: 2, last: 3 }, id: 'library/chapter-of-it.pdf' });
    expect([...host.querySelectorAll<HTMLElement>('.bmark')].map((m) => m.title)).toEqual(['in the chapter']);
    expect(view().dataset.bookmarks).toBe('2');
    await drawPalette();
    await runCommand('bookmarks ·');
    expect(rows().length).toBe(2);
    await act(async () => { rows()[1]!.click(); });
    await settle();
    expect(notice()).toBe('p. 5 is not among these pages');
    expect(sc().scrollTop).toBe(0);
    // a bookmark made in the chapter is the book's too: the same file
    await key('b');
    await key('Enter', {}, bar()!.querySelector('input')!);
    expect(Object.values(stored()).map((m) => m.page).sort()).toEqual([2, 3, 5]);
  });
});

describe('marks', () => {
  it('⇧M then a letter marks the place in view; `\'` then the letter goes to it, a jump; set again, it moves', async () => {
    await mountBook();
    await scrolled(scrollFor(3, 0.5));
    expect((await key('M', { shiftKey: true })).defaultPrevented).toBe(true);
    expect(bar()!.querySelector('[data-chord="set"]')!.textContent).toBe('mark…');
    expect((await key('a')).defaultPrevented).toBe(true);
    expect(bar()).toBeNull();
    expect(stored()['m-a']).toMatchObject({ kind: 'mark', letter: 'a', page: 3, y: 0.5 });
    expect(notice()).toBe('mark a · p. 3');
    await scrolled(0);
    await key("'");
    expect(bar()!.querySelector('[data-chord="go"]')!.textContent).toBe('go to mark…');
    await key('a');
    // a place kept comes back as it was: no room over it
    expect(sc().scrollTop).toBeCloseTo(scrollFor(3, 0.5, 0));
    expect(back()).toBe(1);
    await scrolled(scrollFor(1, 0.2));
    await key('M', { shiftKey: true });
    await key('a');
    expect(Object.keys(stored())).toEqual(['m-a']);
    expect(stored()['m-a']).toMatchObject({ page: 1, y: 0.2 });
  });

  it('any key that is no letter lets the wait go and does nothing else; no letter is taken while a field has the caret', async () => {
    await mountBook();
    await key('M', { shiftKey: true });
    // ⇧ on its way to a capital is not a key yet
    await key('Shift', { shiftKey: true });
    expect(bar()!.querySelector('[data-chord]')).not.toBeNull();
    const slash = await key('/');
    expect(slash.defaultPrevented).toBe(true);
    expect(bar()).toBeNull();
    expect(stored()).toEqual({});
    await key("'");
    await key('Escape');
    expect(bar()).toBeNull();
    await key("'");
    await key('z');
    expect(notice()).toBe('no mark z in this pdf');
    // with the caret in a field the keys are the field's
    const field = document.body.appendChild(document.createElement('input'));
    expect((await key('M', { shiftKey: true }, field)).defaultPrevented).toBe(false);
    expect(bar()).toBeNull();
    await key('M', { shiftKey: true });
    expect((await key('a', {}, field)).defaultPrevented).toBe(false);
    expect(bar()).toBeNull();
    expect(stored()).toEqual({});
    field.remove();
  });

  it('a capital is the collection\'s: set in one book, gone to from another, which opens that book there; the palette\'s `marks` lists them', async () => {
    seed({ 'm-Q': { kind: 'mark', letter: 'Q', page: 1, y: 0, at: 1 } }, OTHER);
    await mountBook({ id: 'library/first.pdf' });
    await scrolled(scrollFor(4, 0.3));
    await key('M', { shiftKey: true });
    await key('Q', { shiftKey: true });
    expect(stored()['m-Q']).toMatchObject({ letter: 'Q', page: 4, y: 0.3 });
    // the collection has one Q: the other book's is gone
    expect(stored(OTHER)).toEqual({});
    expect(notice()).toBe('mark Q · p. 4 · the collection\'s');
    // in the same book it is a jump
    await scrolled(0);
    await key("'");
    await key('Q', { shiftKey: true });
    expect(sc().scrollTop).toBeCloseTo(scrollFor(4, 0.3, 0));
    // from another book: the first is opened there
    for (const m of mounts.splice(0)) { act(() => m.root.unmount()); m.host.remove(); }
    await mountBook({ id: 'library/second.pdf', hash: OTHER, keep: true });
    await key("'");
    await key('Q', { shiftKey: true });
    expect(opened).toEqual(['library/first.pdf']);
    expect(takePlace('library/first.pdf')).toEqual({ page: 4, y: 0.3 });
    await key("'");
    await key('Z', { shiftKey: true });
    expect(notice()).toBe('no mark Z in the collection');
    const list = await markList('marks', null);
    expect(list.map((r) => [r.title, r.sub, r.page])).toEqual([['Q', 'first', 4]]);
    expect(placeRows(list)[0]).toMatchObject({ key: 'mk:0', tag: 'place', page: 4, target: { command: 'mk:0' } });
  });

  it('a book opened at a place goes there once its pages are there, the place it opened at the way back', async () => {
    const { openBookAt } = await import('../book.js');
    await mountBook({ id: 'library/opened.pdf' });
    await act(async () => { openBookAt('library/opened.pdf', { page: 3, y: 0.25 }); });
    await settle();
    expect(sc().scrollTop).toBeCloseTo(scrollFor(3, 0.25, 0));
    expect(back()).toBe(1);
    expect(takePlace('library/opened.pdf')).toBeNull();
  });
});

describe('highlights', () => {
  const rp = Range.prototype as unknown as { getBoundingClientRect?: () => unknown; getClientRects?: () => unknown[] };
  const was = { rect: rp.getBoundingClientRect, rects: rp.getClientRects };
  afterEach(() => { if (was.rect) rp.getBoundingClientRect = was.rect; else delete rp.getBoundingClientRect; if (was.rects) rp.getClientRects = was.rects; else delete rp.getClientRects; });
  /** Select words of page 2 whose lines are these rectangles (fractions of the page). */
  const select = async (lines: [x: number, y: number, w: number, h: number][], text = 'k ln W') => {
    const pr = page(2).getBoundingClientRect();
    const rects = lines.map(([x, y, w, h]) => ({ left: pr.left + x * pr.width, top: pr.top + y * pr.height, width: w * pr.width, height: h * pr.height, right: 0, bottom: 0 }));
    rp.getBoundingClientRect = () => ({ top: 10, bottom: 20, left: 0, right: 40, width: 40, height: 10 });
    rp.getClientRects = () => rects;
    const span = Array.from(host.querySelectorAll('.pdf-page[data-page="2"] .textLayer span')).find((x) => x.textContent?.includes(text))!;
    const r = document.createRange();
    r.setStart(span.firstChild!, span.textContent!.indexOf(text));
    r.setEnd(span.firstChild!, span.textContent!.indexOf(text) + text.length);
    await act(async () => { const s = window.getSelection()!; s.removeAllRanges(); s.addRange(r); document.dispatchEvent(new Event('selectionchange')); });
    await settle();
  };
  const TWO: [number, number, number, number][] = [[0.3, 0.2, 0.5, 0.02], [0.1, 0.23, 0.3, 0.02]];
  const hls = () => [...host.querySelectorAll<HTMLElement>('.hl')];

  it('`h` on a selection highlights it: a quad a line, in the page\'s own units, drawn where the lines are at any zoom', async () => {
    await mountBook();
    await select(TWO);
    expect((await key('h')).defaultPrevented).toBe(true);
    const [id, m] = Object.entries(stored())[0]!;
    expect(id).toMatch(/^h-/);
    expect(m).toMatchObject({ kind: 'highlight', page: 2, y: 0.2, text: 'k ln W', ink: 1, quads: [[2, 0.3, 0.2, 0.5, 0.02], [2, 0.1, 0.23, 0.3, 0.02]] });
    expect(hls().map((h) => [h.dataset.ink, h.dataset.page])).toEqual([['1', '2'], ['1', '2']]);
    expect(px(hls()[0]!, 'left')).toBeCloseTo(0.3 * 800);
    expect(px(hls()[0]!, 'top')).toBeCloseTo(px(page(2), 'top') + 0.2 * H);
    expect(px(hls()[0]!, 'width')).toBeCloseTo(0.5 * 800);
    // the selection is let go, and with it the cue
    expect(window.getSelection()!.isCollapsed).toBe(true);
    expect(notice()).toBe('highlighted · 1–4 choose its ink');
    // zoomed, the same fractions of a larger page
    await key('=', { metaKey: true });
    expect(px(hls()[0]!, 'left')).toBeCloseTo(0.3 * 1000);
    expect(px(hls()[0]!, 'width')).toBeCloseTo(0.5 * 1000);
  });

  it('1–4 choose its ink while the notice shows, and the next highlight is made in it; later they are not the highlight\'s', async () => {
    await mountBook();
    await select(TWO);
    await key('h');
    expect((await key('3')).defaultPrevented).toBe(true);
    expect(hls().map((h) => h.dataset.ink)).toEqual(['3', '3']);
    expect(Object.values(stored())[0]).toMatchObject({ ink: 3 });
    expect((await key('5')).defaultPrevented).toBe(false);
    // another notice in its place: the digits are no longer its
    await act(async () => { useApp.setState({ notice: { seq: 99999, line: 'something else', open: null, undo: false } }); });
    expect((await key('2')).defaultPrevented).toBe(false);
    expect(Object.values(stored())[0]).toMatchObject({ ink: 3 });
    await select([[0.1, 0.6, 0.2, 0.02]]);
    await key('h');
    expect(Object.values(stored()).map((m) => (m.kind === 'highlight' ? m.ink : 0)).sort()).toEqual([3, 3]);
    await key('1');
  });

  it('`h` with the selection, or the last press, inside one clears it, with the notice\'s undo', async () => {
    await mountBook();
    await select(TWO);
    await key('h');
    expect(hls().length).toBe(2);
    // a selection inside the first line of it
    await select([[0.4, 0.2, 0.1, 0.02]]);
    await key('h');
    expect(hls().length).toBe(0);
    expect(stored()).toEqual({});
    expect(useApp.getState().notice).toMatchObject({ line: 'highlight cleared · k ln W', undo: true });
    // undone, it is back as it was
    const { undoNotice } = await import('../land.js');
    await act(async () => { await undoNotice(); });
    await settle();
    expect(hls().length).toBe(2);
    expect(kinds()).toEqual(['highlight']);
    // a press in it, nothing selected, then h
    await act(async () => { window.getSelection()!.removeAllRanges(); document.dispatchEvent(new Event('selectionchange')); });
    await click(2, 0.2, 0.24);
    await key('h');
    expect(hls().length).toBe(0);
    // nothing selected and no highlight under the last press: said
    await click(2, 0.5, 0.9);
    await key('h');
    expect(notice()).toBe('select the words to highlight, then h');
  });

  it('a right-click on one offers passage, card, clear and the four inks', async () => {
    seed({ 'h-1': { kind: 'highlight', page: 2, y: 0.2, quads: [[2, 0.3, 0.2, 0.5, 0.02]], text: 'k ln W', ink: 1, at: 1 } });
    await mountBook();
    expect(hls().length).toBe(1);
    const acts = await menu(2, 0.5, 0.21);
    expect(acts.map((a) => a.dataset.act)).toEqual(['hl-section', 'hl-card', 'hl-clear', 'ink-1', 'ink-2', 'ink-3', 'ink-4']);
    expect(acts.map((a) => a.textContent)).toEqual(['passage', 'card', 'clear', '1 · band ✓', '2 · rule', '3 · dashed rule', '4 · dotted rule']);
    await act(async () => { acts[5]!.click(); });
    await settle();
    expect(hls()[0]!.dataset.ink).toBe('3');
    const again = await menu(2, 0.5, 0.21);
    await act(async () => { again[2]!.click(); });
    await settle();
    expect(hls().length).toBe(0);
    // beside it, on bare page: no menu
    expect(await menu(2, 0.5, 0.6)).toEqual([]);
  });

  it('the palette lists a book\'s by their text, searched as typed; ⏎ goes there', async () => {
    seed({
      'h-1': { kind: 'highlight', page: 2, y: 0.2, quads: [[2, 0.3, 0.2, 0.5, 0.02]], text: 'the entropy never decreases', ink: 1, at: 1 },
      'h-2': { kind: 'highlight', page: 4, y: 0.6, quads: [[4, 0.3, 0.6, 0.5, 0.02]], text: 'a canonical ensemble', ink: 2, at: 2 },
    });
    await mountBook();
    expect(view().dataset.highlights).toBe('2');
    await drawPalette();
    await runCommand('highlights ·');
    expect(rows().map((r) => [r.querySelector('.pt')!.textContent, r.querySelector('.ptag')!.textContent])).toEqual([['the entropy never decreases', 'p. 2'], ['a canonical ensemble', 'p. 4']]);
    await typeIn(palInput(), 'canon');
    expect(rows().length).toBe(1);
    await key('Enter', {}, palInput());
    expect(sc().scrollTop).toBeCloseTo(scrollFor(4, 0.6, 0));
    expect(back()).toBe(1);
  });

  it('a book with none says how one is made', async () => {
    await mountBook();
    await drawPalette();
    await runCommand('highlights ·');
    expect(rows().length).toBe(0);
    expect(document.querySelector('.palette-empty')!.textContent).toBe('no highlights in this pdf · h on a selection makes one');
  });
});

describe('portals', () => {
  it('the bar\'s more makes one without the keys: portal from this place, then, at the second, the row that names the first', async () => {
    await mountBook();
    await scrolled(scrollFor(1, 0.5));
    const more = () => act(async () => { host.querySelector<HTMLElement>('.pdf-view .meta [data-tool="more"]')!.click(); });
    const row = (a: string) => document.querySelector<HTMLElement>(`.ctx-menu [data-act="${a}"]`);
    await more();
    expect(row('more-portal-from')).not.toBeNull();
    expect(row('more-portal-to')).toBeNull();
    await act(async () => { row('more-portal-from')!.click(); });
    expect(portalPending()).toMatchObject({ hash: HASH, page: 1, y: 0.5 });
    await scrolled(scrollFor(4, 0.25));
    await more();
    expect(row('more-portal-to')!.textContent).toContain('p. 1 shows this place');
    expect(row('more-portal-cancel')).not.toBeNull();
    await act(async () => { row('more-portal-to')!.click(); await new Promise((r) => setTimeout(r, 20)); });
    expect(portalPending()).toBeNull();
    expect(Object.values(stored())[0]).toMatchObject({ kind: 'portal', page: 1, y: 0.5, to: { page: 4, y: 0.25 } });
  });

  it('⇧P at a place, then ⇧P where it should show, ties the first to the second; esc before the second lets it go', async () => {
    await mountBook();
    await scrolled(scrollFor(1, 0.5));
    expect((await key('P', { shiftKey: true })).defaultPrevented).toBe(true);
    expect(bar()!.querySelector('[data-portal="pending"]')!.textContent).toBe('portal: go to where it should show, ⇧P again');
    expect(portalPending()).toMatchObject({ hash: HASH, page: 1, y: 0.5 });
    await key('Escape');
    expect(portalPending()).toBeNull();
    expect(bar()).toBeNull();
    await key('P', { shiftKey: true });
    await scrolled(scrollFor(4, 0.25));
    await key('P', { shiftKey: true });
    expect(bar()).toBeNull();
    const [id, m] = Object.entries(stored())[0]!;
    expect(id).toMatch(/^p-/);
    expect(m).toEqual({ kind: 'portal', page: 1, y: 0.5, to: { page: 4, y: 0.25 }, at: expect.any(Number) });
    expect(notice()).toBe('portal · p. 1 shows p. 4');
    // its source: a small mark in the page's right margin
    const mark = host.querySelector<HTMLElement>('.pmark')!;
    expect(mark.dataset.to).toBe('4');
    expect(px(mark, 'left')).toBeCloseTo(800 - 16);
    expect(px(mark, 'top')).toBeCloseTo(px(page(1), 'top') + 0.5 * H - 7);
    expect(view().dataset.portals).toBe('1');
  });

  it('tied across two books: the source\'s file names the other pdf, and a press on the mark opens it there', async () => {
    await mountBook({ id: 'library/source.pdf' });
    await key('P', { shiftKey: true });
    for (const m of mounts.splice(0)) { act(() => m.root.unmount()); m.host.remove(); }
    await mountBook({ id: 'library/figures.pdf', hash: OTHER, keep: true });
    // the bar says the portal is half made here too
    expect(bar()!.querySelector('[data-portal="pending"]')).not.toBeNull();
    await scrolled(scrollFor(2, 0.5));
    await key('P', { shiftKey: true });
    expect(stored(OTHER)).toEqual({});
    expect(Object.values(stored())[0]).toMatchObject({ kind: 'portal', page: 1, to: { page: 2, y: 0.5, pdf: OTHER } });
    for (const m of mounts.splice(0)) { act(() => m.root.unmount()); m.host.remove(); }
    await mountBook({ id: 'library/source.pdf', keep: true });
    await act(async () => { host.querySelector<HTMLElement>('.pmark')!.click(); });
    await settle();
    expect(opened).toEqual(['library/figures.pdf']);
    expect(takePlace('library/figures.pdf')).toEqual({ page: 2, y: 0.5 });
  });

  it('with no pane beside, a press on the mark peeks at where it shows; ⏎ goes there, a jump', async () => {
    seed({ 'p-1': { kind: 'portal', page: 1, y: 0.5, to: { page: 4, y: 0.25 }, at: 1 } });
    await mountBook();
    await act(async () => { host.querySelector<HTMLElement>('.pmark')!.click(); });
    await settle();
    expect(host.querySelector<HTMLElement>('.pdf-peek')!.dataset.page).toBe('4');
    expect(sc().scrollTop).toBe(0);
    await key('Enter');
    expect(host.querySelector('.pdf-peek')).toBeNull();
    expect(sc().scrollTop).toBeCloseTo(scrollFor(4, 0.25, 16));
    expect(back()).toBe(1);
    // its menu removes it
    await act(async () => { host.querySelector('.pmark')!.dispatchEvent(new MouseEvent('contextmenu', { bubbles: true, cancelable: true, button: 2 })); });
    expect([...document.querySelectorAll<HTMLElement>('.ctx-menu [data-act]')].map((a) => a.dataset.act)).toEqual(['portal-go', 'portal-remove']);
    await act(async () => { document.querySelector<HTMLElement>('.ctx-menu [data-act="portal-remove"]')!.click(); });
    await settle();
    expect(host.querySelector('.pmark')).toBeNull();
    expect(useApp.getState().notice).toMatchObject({ line: 'portal removed · p. 1', undo: true });
  });

  it('`portals beside`: the book in the pane beside follows, shown each portal\'s destination as its source is read past; closed, nothing follows', async () => {
    seed({ 'p-1': { kind: 'portal', page: 2, y: 0.1, to: { page: 5, y: 0.5 }, at: 1 }, 'p-2': { kind: 'portal', page: 3, y: 0.5, to: { page: 1, y: 0.75 }, at: 2 } });
    const lead = await mountBook({ id: 'library/followed.pdf' });
    useApp.setState({ panes: { panes: [{ tabs: [{ key: 1, id: BOOK }], active: 0 }], active: 0 } as never });
    await drawPalette();
    await runCommand('portals beside ·');
    expect(useApp.getState().paletteOpen).toBe(false);
    // the pane beside is there, on the same book, the pane in front kept
    const panes = useApp.getState().panes;
    expect(panes.panes.map((p) => p.tabs.map((t) => t.id))).toEqual([[BOOK], [BOOK]]);
    expect(panes.active).toBe(0);
    expect(followed(BOOK)).toBe(false);
    const side = await mountBook({ id: BOOK, active: false, keep: true });
    expect(followed(BOOK)).toBe(true);
    expect(view(side).dataset.following).toBe('1');
    expect(view(lead).dataset.following).toBeUndefined();
    expect(side.querySelector('.meta .following')!.textContent).toBe('following portals');
    // above the first source: the pane beside stays where it is
    await scrolled(0, lead);
    expect(sc(side).scrollTop).toBe(0);
    expect(view(side).dataset.portal).toBeUndefined();
    // the place a third of the way down the view passes the first source (page 2, a tenth down)
    await scrolled(scrollFor(2, 0.1) + 60 - 200 + 5, lead);
    expect(view(side).dataset.portal).toBe('p-1');
    expect(sc(side).scrollTop).toBeCloseTo(scrollFor(5, 0.5, 16, side));
    // no jump is made of it, in either pane
    expect(back()).toBe(0);
    // reading on past the second: the nearest source above the place
    await scrolled(scrollFor(4, 0.1), lead);
    expect(view(side).dataset.portal).toBe('p-2');
    expect(sc(side).scrollTop).toBeCloseTo(scrollFor(1, 0.75, 16, side));
    // back up between the two: the first again
    await scrolled(scrollFor(2, 0.5), lead);
    expect(view(side).dataset.portal).toBe('p-1');
    // the pane beside scrolled by hand moves nothing in the first
    const top = sc(lead).scrollTop;
    await scrolled(300, side);
    expect(sc(lead).scrollTop).toBe(top);
    // a portal already read past when the pane beside opens is shown there at once, with no scroll in the first
    const closing = mounts.pop()!;
    act(() => closing.root.unmount());
    closing.host.remove();
    expect(followed(BOOK)).toBe(false);
    togglePortalsBeside(BOOK);
    const second = await mountBook({ id: BOOK, active: false, keep: true });
    // (where it scrolled to is not read here: the stand-in's pages have no rectangles until after they mount)
    expect(view(second).dataset.portal).toBe('p-1');
    // that pane closed: nothing follows
    const m = mounts.pop()!;
    act(() => m.root.unmount());
    m.host.remove();
    expect(followed(BOOK)).toBe(false);
    togglePortalsBeside(BOOK);
    togglePortalsBeside(BOOK);
  });
});

describe('the ruler', () => {
  const rule = () => host.querySelector<HTMLElement>('.pdf-rule');
  // page n's lines: baselines 700, 680 (and 660 on page 2) up an 800-unit page, 10 units of type
  const TOP = (i: number) => 1 - (700 - 20 * i + 8) / 800;
  const BOTTOM = (i: number) => 1 - (700 - 20 * i - 2.5) / 800;

  it('`v` puts a rule under the line nearest a third of the way down the view: a band over the line, at any zoom; `v` or esc lets it go', async () => {
    await mountBook();
    expect((await key('v')).defaultPrevented).toBe(true);
    // the view's third is 200px down: page 1 from 100px, its first line 11.5% down it
    expect(rule()!.dataset.page).toBe('1');
    expect(rule()!.dataset.line).toBe('0');
    expect(view().dataset.ruler).toBe('1:0');
    expect(px(rule(), 'top')).toBeCloseTo(TOP(0) * H, 0);
    expect(px(rule(), 'height')).toBeCloseTo((BOTTOM(0) - TOP(0)) * H, 0);
    expect(px(rule(), 'width')).toBeCloseTo(800);
    await key('=', { metaKey: true });
    expect(px(rule(), 'width')).toBeCloseTo(1000);
    expect(px(rule(), 'top')).toBeCloseTo(TOP(0) * H * 1.25, 0);
    await key('v');
    expect(rule()).toBeNull();
    await key('v');
    expect(rule()).not.toBeNull();
    expect((await key('Escape')).defaultPrevented).toBe(true);
    expect(rule()).toBeNull();
  });

  it('↓ and j move it a line down, ↑ and k a line up, the page scrolling so it stays a third of the way down; over a page\'s end onto the next with lines', async () => {
    await mountBook();
    // without the rule the keys are not the pages'
    expect((await key('j')).defaultPrevented).toBe(false);
    expect((await key('ArrowDown')).defaultPrevented).toBe(false);
    await key('v');
    expect((await key('j')).defaultPrevented).toBe(true);
    expect(view().dataset.ruler).toBe('1:1');
    // the line's top a third of the way down the view
    expect(sc().scrollTop).toBeCloseTo(100 + TOP(1) * H - 200, 0);
    await key('ArrowDown');
    expect(view().dataset.ruler).toBe('2:0');
    expect(sc().scrollTop).toBeCloseTo(100 + px(page(2), 'top') + TOP(0) * H - 200, 0);
    await key('k');
    expect(view().dataset.ruler).toBe('1:1');
    await key('ArrowUp');
    expect(view().dataset.ruler).toBe('1:0');
    // the book's first line: no further
    await key('k');
    expect(view().dataset.ruler).toBe('1:0');
    // page 4 has no text: from page 3's last line to page 5's first, and back
    await key('Escape');
    await scrolled(scrollFor(3, 0.5));
    await key('v');
    expect(view().dataset.ruler).toBe('3:1');
    await key('j');
    expect(view().dataset.ruler).toBe('5:0');
    await key('k');
    expect(view().dataset.ruler).toBe('3:1');
  });

  it('a press in a page\'s left margin holds the line beside it; a press elsewhere on the page does not', async () => {
    await mountBook();
    await click(2, 0.5, 0.14);
    expect(rule()).toBeNull();
    await click(2, 0.03, 0.142);
    expect(view().dataset.ruler).toBe('2:1');
    await click(2, 0.02, 0.9);
    expect(view().dataset.ruler).toBe('2:2');
  });

  it('`r` while it shows sets the read point to its line in a book being read; with no rule `r` is as it was', async () => {
    await mountBook({ reading: true });
    expect((await key('r')).defaultPrevented).toBe(false);
    expect(updates).toEqual([]);
    await scrolled(scrollFor(2, 0));
    await key('v');
    await key('j');
    expect(view().dataset.ruler).toBe('2:1');
    expect((await key('r')).defaultPrevented).toBe(true);
    expect(updates.length).toBe(1);
    expect(updates[0]!.path).toBe(BOOK);
    expect(meta(updates[0]!.doc).read).toMatchObject({ pos: 2, y: Math.round(BOTTOM(1) * 1000) / 1000, reps: 1 });
    expect(notice()).toBe('read to p. 2');
    // the rule stays where it is
    expect(view().dataset.ruler).toBe('2:1');
  });
});

describe('passages', () => {
  const BOXES = '2:0.100:0.200:0.500:0.100';
  const ID = `s-${BOXES}`;
  const day = (n: number) => { const d = new Date(Date.now() + n * 86400000); return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`; };
  const passage = (more: object = {}): Marks[string] => ({ kind: 'passage', page: 2, y: 0.2, at: 1, boxes: BOXES, made: day(-3), due: day(-1), ivl: 2, ...more });
  const pboxes = () => [...host.querySelectorAll<HTMLElement>('.pbox:not(.pending)')];
  const tag = () => host.querySelector<HTMLElement>('.ptag, .pgut')!;
  const press = async (el: HTMLElement) => { await act(async () => { el.dispatchEvent(new MouseEvent('mousedown', { bubbles: true, cancelable: true, button: 0, clientX: 10, clientY: 10 })); }); await settle(); return [...document.querySelectorAll<HTMLElement>('.ctx-menu [data-act]')]; };

  it('one kept with the PDF is drawn on its page, called by its page; dismissed, dashed', async () => {
    seed({ [ID]: passage(), 's-4:0.100:0.100:0.300:0.100': passage({ page: 4, y: 0.1, boxes: '4:0.100:0.100:0.300:0.100', due: undefined, ivl: undefined }) });
    await mountBook();
    expect(pboxes().map((b) => [b.dataset.section, b.dataset.page, b.dataset.kept, b.classList.contains('dis')])).toEqual([[BOXES, '2', '1', false], ['4:0.100:0.100:0.300:0.100', '4', '1', true]]);
  });

  it('a press on its tag says when it is next and offers dismiss and remove; dismissed, bring back; each undone from the notice', async () => {
    seed({ [ID]: passage() });
    await mountBook();
    const acts = await press(tag());
    expect(acts.map((a) => a.dataset.act)).toEqual(['passage-when', 'passage-dismiss', 'passage-remove']);
    expect(acts.map((a) => a.textContent)).toEqual(['due today', 'dismiss', 'remove']);
    await act(async () => { acts[1]!.click(); });
    await settle();
    expect(stored()[ID]).toEqual({ kind: 'passage', page: 2, y: 0.2, at: 1, boxes: BOXES, made: day(-3) });
    expect(pboxes()[0]!.classList.contains('dis')).toBe(true);
    expect(useApp.getState().notice).toMatchObject({ line: '§ p. 2 · dismissed', undo: true });
    await act(async () => { await undoNotice(); });
    await settle();
    expect(stored()[ID]).toMatchObject({ due: day(-1), ivl: 2 });
    // dismissed: bring back, on the cadence
    await act(async () => { await setMark(HASH, ID, passage({ due: undefined, ivl: undefined })); });
    await settle();
    const again = await press(tag());
    expect(again.map((a) => a.textContent)).toEqual(['dismissed', 'bring back', 'remove']);
    await act(async () => { again[1]!.click(); });
    await settle();
    expect(stored()[ID]).toMatchObject({ due: day(2), ivl: 2, made: day(-3) });
    // remove: gone from the file and the page, back with the undo
    const third = await press(tag());
    await act(async () => { third[2]!.click(); });
    await settle();
    expect(stored()[ID]).toBeUndefined();
    expect(pboxes().length).toBe(0);
    expect(useApp.getState().notice).toMatchObject({ line: '§ p. 2 · removed', undo: true });
    await act(async () => { await undoNotice(); });
    await settle();
    expect(stored()[ID]).toMatchObject({ kind: 'passage', boxes: BOXES });
    expect(pboxes().length).toBe(1);
  });

  it('] and [ step between them in book order, lighting each', async () => {
    seed({ [ID]: passage(), 's-4:0.100:0.100:0.300:0.100': passage({ page: 4, y: 0.1, boxes: '4:0.100:0.100:0.300:0.100' }) });
    await mountBook();
    const lit = () => pboxes().filter((b) => b.classList.contains('cur')).map((b) => b.dataset.section);
    expect(lit()).toEqual([]);
    await key(']');
    expect(lit()).toEqual([BOXES]);
    await key(']');
    expect(lit()).toEqual(['4:0.100:0.100:0.300:0.100']);
    await key('[');
    expect(lit()).toEqual([BOXES]);
    // nothing opened: a passage is on the pages alone
    expect(opened).toEqual([]);
    expect(useApp.getState().reveal ?? null).toBeNull();
  });

  it('the queue has an item for each that is due, of the document whose pages it is on; the session\'s three write its line among the marks', async () => {
    seed({ [ID]: passage(), 's-4:0.100:0.100:0.300:0.100': passage({ page: 4, y: 0.1, boxes: '4:0.100:0.100:0.300:0.100', due: undefined, ivl: undefined }) });
    await mountBook();
    await allMarks();
    const items = passageItems(new Date());
    expect(items.length).toBe(1);
    const item = items[0]!;
    expect(item).toMatchObject({ kind: 'section', path: BOOK, heading: 'p. 2', passage: { hash: HASH, boxes: BOXES }, block: -1 });
    // the same item object while nothing of it changed: the day's draw is by it
    expect(passageItems(new Date())[0]).toBe(item);
    if (item.kind !== 'section') throw new Error('not a section');
    const undo = await actOnPassage(item, 'on');
    expect(stored()[ID]).toMatchObject({ reps: 1, made: day(-3) });
    expect((stored()[ID] as { due: string }).due > day(0)).toBe(true);
    expect(passageItems(new Date())[0]).not.toBe(item);
    await undo!();
    expect(stored()[ID]).toEqual(passage());
    await actOnPassage(item, 'done');
    expect(stored()[ID]).toEqual({ kind: 'passage', page: 2, y: 0.2, at: 1, boxes: BOXES, made: day(-3) });
    expect(passageItems(new Date())).toEqual([]);
    // no document was written for any of it
    expect(updates).toEqual([]);
  });

  it('a passage whose pdf is no longer in the collection waits out of the queue, its line kept', async () => {
    seed({ [ID]: passage() }, OTHER);
    await mountBook();
    await allMarks();
    expect(passageItems(new Date())).toEqual([]);
    expect(stored(OTHER)[ID]).toEqual(passage());
  });

  it('the palette lists a book\'s by their pages and when they are next; ⏎ goes there and lights it', async () => {
    seed({ [ID]: passage(), 's-4:0.100:0.100:0.300:0.100': passage({ page: 4, y: 0.1, boxes: '4:0.100:0.100:0.300:0.100', due: day(4) }) });
    await mountBook();
    expect((await markList('passages', BOOK)).map((r) => [r.title, r.sub, r.page])).toEqual([['p. 2', 'due today', 2], ['p. 4', 'back in 4d', 4]]);
    await drawPalette();
    await runCommand('passages · ');
    expect(document.querySelector('.palette-list')!.getAttribute('data-places')).toBe('passages');
    const list = rows();
    expect(list.map((r) => r.querySelector('.pt')!.textContent)).toEqual(['p. 2', 'p. 4']);
    await act(async () => { list[1]!.click(); });
    await settle();
    expect(pboxes().filter((b) => b.classList.contains('cur')).map((b) => b.dataset.section)).toEqual(['4:0.100:0.100:0.300:0.100']);
  });
});

describe('where they are kept', () => {
  it('read once a pdf and held: a second look at the book reads no file, and a write is the whole file in the format\'s bytes', async () => {
    seed({ 'b-1': { kind: 'bookmark', name: 'heat', page: 1, y: 0.1, at: 1 } });
    const read = vi.spyOn(fakeVault.fs, 'readText');
    vaultNow = fakeVault;
    try {
      expect(marksOf(HASH)).toEqual({});
      const first = await loadMarks(HASH);
      expect(Object.keys(first)).toEqual(['b-1']);
      expect(marksOf(HASH)).toBe(first);
      await loadMarks(HASH);
      expect(read).toHaveBeenCalledTimes(1);
      await setMark(HASH, 'm-a', { kind: 'mark', letter: 'a', page: 2, y: 0.123456, at: 5 });
      expect(Object.keys(marksOf(HASH))).toEqual(['b-1', 'm-a']);
      expect(files.get(`/v/${marksPath(HASH)}`)).toBe(serializeMarks({ 'b-1': first['b-1']!, 'm-a': { kind: 'mark', letter: 'a', page: 2, y: 0.123456, at: 5 } }));
      await setMark(HASH, 'b-1', null);
      expect(kinds()).toEqual(['mark']);
    } finally { read.mockRestore(); }
  });

  it('an entry of the file that the app does not know is written back with the rest', async () => {
    files.set(`/v/${marksPath(HASH)}`, '{\n  "x-later": {\n    "kind": "squiggle",\n    "page": 3\n  }\n}\n');
    await mountBook();
    await key('M', { shiftKey: true });
    await key('a');
    const text = files.get(`/v/${marksPath(HASH)}`)!;
    expect(JSON.parse(text)).toMatchObject({ 'x-later': { kind: 'squiggle', page: 3 }, 'm-a': { kind: 'mark', letter: 'a' } });
    expect(Object.keys(JSON.parse(text) as object)).toEqual(['m-a', 'x-later']);
  });

  it('a pdf the collection has no hash for keeps no marks, and says so', async () => {
    const id = 'library/unhashed.pdf';
    await mountBook({ id });
    hashes.delete(`/v/${id}`);
    for (const m of mounts.splice(0)) { act(() => m.root.unmount()); m.host.remove(); }
    useApp.setState({ docs: { [id]: { type: 'source', frozen: true, cards: 0, due: 0, pdf: id } } as never });
    const h = document.body.appendChild(document.createElement('div'));
    const root = createRoot(h);
    mounts.push({ host: h, root });
    await act(async () => { root.render(createElement(Pdf, { id, active: true })); });
    await settle();
    host = h;
    layout(h);
    await key('b');
    expect(bar()).toBeNull();
    expect(notice()).toContain('marks are kept by the pdf\'s hash');
    expect(files.size).toBe(0);
  });
});
