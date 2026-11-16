// @vitest-environment jsdom
// The sweep of the intake, the book's pages, and sections: each test says what
// should happen, and fails until it does.

import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { act, createElement } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

interface Page { title: string; text: string; page?: unknown }
const fetches: { url: string; resolve(r: Page): void; reject(e: unknown): void }[] = [];
const writes = { fail: false, specs: [] as { title: string }[], decks: [] as string[] };
/** The Anki package a `.apkg` path reads as: the import's own two-deck fixture. */
const TWO_DECKS = JSON.parse(readFileSync(join(import.meta.dirname, '../../import/__tests__/anki/two-decks.json'), 'utf8')) as unknown;

vi.mock('@tauri-apps/plugin-dialog', () => ({ open: async () => null }));
/** The stand-in book: three pages, each with a line of text (the second with more); `slow` holds a page's text back until let go; `read` is the pages whose text was asked for. */
const book = { slow: null as Promise<void> | null, fail: false, read: [] as number[] };
const linesOn = (n: number): string[] => [
  `entropy on page ${n}`,
  ...(n === 1 ? ['as (3.12) shows'] : n === 2 ? ['heat is not work, heat is a transfer', 'S = k ln W (3.12)'] : []),
];
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
  // the text layer as pdf.js lays it: a span a line
  TextLayer: class {
    constructor(private o: { textContentSource: { n: number }; container: HTMLElement }) {}
    async render() { for (const l of linesOn(this.o.textContentSource.n)) { const sp = document.createElement('span'); sp.textContent = l; this.o.container.append(sp); } }
  },
  pageBits: async (page: { n: number }) => { book.read.push(page.n); if (book.slow) await book.slow; return linesOn(page.n).map((str, i) => ({ str, eol: true, y: 700 - 20 * i, height: 10 })); },
  loadPdf: () => ({}), loadPdfPieces: () => ({}),
}));
vi.mock('../bookPdf.js', () => ({
  acquirePdf: () => ({ promise: book.fail ? Promise.reject(new Error('Invalid PDF structure')) : Promise.resolve(fakePdf), release() {} }),
  itemsOf: async () => [], fillCrops: () => {}, drawCrop: async () => {}, WHOLE_MAX: 1,
}));
vi.mock('../fetch.js', () => ({
  PDF_EXT: /\.pdf$/i, APKG_EXT: /\.apkg$/i, EPUB_EXT: /\.epub$/i,
  fetchReadable: (url: string) => new Promise<Page>((resolve, reject) => { fetches.push({ url, resolve, reject }); }),
  fetchImage: async () => null,
  readAnkiPackage: async () => TWO_DECKS,
  readDropped: async () => { throw new Error('not a text file'); },
  readDroppedPdf: async () => { throw new Error('no'); },
  readEpub: async () => { throw new Error('no'); },
  pdfOf: async () => { throw new Error('no'); },
}));
vi.mock('../vault.js', async (orig) => {
  const real = await orig<typeof import('../vault.js')>();
  const importNode = async (_dir: string, spec: { title: string }) => {
    if (writes.fail) throw new Error('disk full');
    writes.specs.push(spec);
    return `${spec.title}.md`;
  };
  const importAnkiNode = async (_dir: string, decks: { name: string }[]) => { writes.decks.push(...decks.map((d) => d.name)); return decks.map((d) => `${d.name}.md`); };
  return { ...real, currentVault: () => null, importNode, importDeckNode: importNode, importAnkiNode };
});

const { Intake } = await import('../Intake.js');
const { Pdf } = await import('../Pdf.js');
globalThis.ResizeObserver ??= class { observe() {} unobserve() {} disconnect() {} } as unknown as typeof ResizeObserver;
globalThis.IntersectionObserver ??= class { observe() {} unobserve() {} disconnect() {} } as unknown as typeof IntersectionObserver;
Element.prototype.scrollIntoView ??= function () {};
const { useApp } = await import('../store.js');
(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

let host: HTMLDivElement;
let root: Root;
const settle = () => act(async () => { await new Promise((r) => setTimeout(r, 10)); });
const area = () => host.querySelector('textarea')!;
const titleField = () => host.querySelector<HTMLInputElement>('label.field input')!;

/** Type into a field the way React hears it. */
async function type(el: HTMLInputElement | HTMLTextAreaElement, value: string) {
  const proto = el instanceof HTMLTextAreaElement ? HTMLTextAreaElement.prototype : HTMLInputElement.prototype;
  await act(async () => {
    Object.getOwnPropertyDescriptor(proto, 'value')!.set!.call(el, value);
    el.dispatchEvent(new Event('input', { bubbles: true }));
  });
}
async function paste(text: string) {
  const ev = new Event('paste', { bubbles: true, cancelable: true });
  Object.defineProperty(ev, 'clipboardData', { value: { getData: () => text } });
  await act(async () => { area().dispatchEvent(ev); });
}
async function dropText(text: string) {
  const ev = new Event('drop', { bubbles: true, cancelable: true });
  Object.defineProperty(ev, 'dataTransfer', { value: { files: [], getData: () => text } });
  await act(async () => { host.querySelector('.intake-wrap')!.dispatchEvent(ev); });
}
async function click(label: string) {
  const b = Array.from(host.querySelectorAll('button')).find((x) => x.textContent?.includes(label))!;
  await act(async () => { b.click(); });
  await settle();
}
async function answer(url: string, r: Page | Error) {
  const f = fetches.find((x) => x.url === url)!;
  await act(async () => { if (r instanceof Error) f.reject(r); else f.resolve(r); });
  await settle();
}

const mountIntake = async () => {
  fetches.length = 0;
  writes.fail = false;
  writes.specs.length = 0;
  writes.decks.length = 0;
  useApp.setState({ vault: '/v', tree: [], docs: {}, intakeDir: '', intakeFiles: [] });
  host = document.body.appendChild(document.createElement('div'));
  root = createRoot(host);
  await act(async () => { root.render(createElement(Intake, { active: true, onOpen: () => {} })); });
};
afterEach(() => { act(() => root.unmount()); host.remove(); });

describe('the intake says what went wrong', () => {
  beforeEach(mountIntake);
  it('a write that fails says so, with the text still in the field', async () => {
    await type(area(), 'A thought worth keeping, typed here.');
    writes.fail = true;
    await click('place & leave it');
    expect(area().value).toContain('A thought worth keeping');
    expect(host.textContent).toContain('could not write the file');
  });

  it('a link dropped over text that does not answer says so', async () => {
    await type(area(), 'Some text already here.');
    await dropText('https://example.com/gone');
    await answer('https://example.com/gone', new Error('404'));
    expect(host.textContent).toContain('nothing readable at that link');
  });
});

describe('the intake keeps to what is in the field', () => {
  beforeEach(mountIntake);
  it('the title follows the second link once the first is cleared', async () => {
    await paste('https://example.com/a');
    await answer('https://example.com/a', { title: 'Page A', text: 'The first page, in a few words.' });
    expect(titleField().value).toBe('Page A');
    await type(area(), '');
    await paste('https://example.com/b');
    await answer('https://example.com/b', { title: 'Page B', text: 'The second page, in a few words.' });
    expect(area().value).toContain('second page');
    expect(titleField().value).toBe('Page B');
  });

  it('a link that answers late does not replace the one pasted after it', async () => {
    await paste('https://example.com/slow');
    await paste('https://example.com/fast');
    await answer('https://example.com/fast', { title: 'Fast', text: 'The page asked for last.' });
    await answer('https://example.com/slow', { title: 'Slow', text: 'The page asked for first.' });
    expect(area().value).toContain('asked for last');
  });

  it('text typed while a link is being fetched is not replaced by the page', async () => {
    await paste('https://example.com/slow');
    await type(area(), 'I gave up waiting and typed this.');
    await answer('https://example.com/slow', { title: 'Slow', text: 'The page, at last.' });
    expect(area().value).toBe('I gave up waiting and typed this.');
  });

  it('the title field can be emptied', async () => {
    await type(area(), 'First line of the note\n\nAnd the rest of it.');
    expect(titleField().value).toBe('First line of the note');
    await type(titleField(), '');
    expect(titleField().value).toBe('');
  });
});

describe('an anki package with several decks', () => {
  const rows = () => Array.from(host.querySelectorAll<HTMLButtonElement>('button.deck-pick'));
  const placeBtn = () => Array.from(host.querySelectorAll('button')).find((x) => x.textContent?.includes('place'))!;
  const drop = async () => {
    await mountIntake();
    await act(async () => { useApp.setState({ intakeFiles: ['/x/two.apkg'] }); });
    await settle();
  };

  it('lists each deck as a toggle, all on', async () => {
    await drop();
    expect(rows().map((r) => [r.querySelector('.dname')!.textContent, r.getAttribute('aria-pressed')])).toEqual([['Languages / German', 'true'], ['Science', 'true']]);
    expect(host.querySelector('.stats')!.textContent).toContain('4 cards in 2 decks');
  });

  it('a deck turned off is left out of the count and of what is placed', async () => {
    await drop();
    await act(async () => { rows()[1]!.click(); });
    expect(rows()[1]!.getAttribute('aria-pressed')).toBe('false');
    expect(host.querySelector('.stats')!.textContent).toContain('2 cards in 1 of 2 decks');
    await act(async () => { placeBtn().click(); });
    await settle();
    // the sub-deck alone: its parent has no deck of its own in the package, and its folder is made for it
    expect(writes.decks).toEqual(['Languages::German']);
  });

  it('turned on again it is placed; with none on there is nothing to place', async () => {
    await drop();
    await act(async () => { rows()[0]!.click(); });
    await act(async () => { rows()[1]!.click(); });
    expect(placeBtn().disabled).toBe(true);
    await act(async () => { placeBtn().click(); });
    await settle();
    expect(writes.decks).toEqual([]);
    await act(async () => { rows()[1]!.click(); });
    expect(placeBtn().disabled).toBe(false);
    await act(async () => { placeBtn().click(); });
    await settle();
    expect(writes.decks).toEqual(['Science']);
  });
});

const BOOK = 'library/stat.pdf';
async function mountBook() {
  book.slow = null;
  book.read.length = 0;
  useApp.setState({ vault: '/v', tree: [], docs: { [BOOK]: { type: 'source', frozen: true, cards: 0, due: 0, pdf: BOOK } } as never });
  host = document.body.appendChild(document.createElement('div'));
  root = createRoot(host);
  await act(async () => { root.render(createElement(Pdf, { id: BOOK, active: true })); });
  await settle();
}
const key = (k: string) => act(async () => { window.dispatchEvent(new KeyboardEvent('keydown', { key: k, bubbles: true, cancelable: true })); });
const findField = () => host.querySelector<HTMLInputElement>('.pdf-bar input')!;
const enter = (el: HTMLElement) => act(async () => { el.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', bubbles: true, cancelable: true })); });

describe("a book's pages", () => {
  it('opens on its pages', async () => {
    await mountBook();
    expect(host.querySelectorAll('.pdf-page').length).toBe(3);
  });

  it('search does not say none before it has looked', async () => {
    await mountBook();
    await key('/');
    await type(findField(), 'entropy');
    expect(host.querySelector('.pb-n')!.textContent).not.toBe('none');
    await enter(findField());
    await settle();
    expect(host.querySelector('.pb-n')!.textContent).toContain('1 / 3');
  });

  it('search counts hits, not pages, and steps hit by hit', async () => {
    await mountBook();
    await key('/');
    await type(findField(), 'HEAT');
    await enter(findField());
    await settle();
    const n = () => host.querySelector('.pb-n')!.textContent;
    expect(n()).toBe('p. 2, 1 / 2');
    await enter(findField());
    expect(n()).toBe('p. 2, 2 / 2');
    await enter(findField());
    expect(n()).toBe('p. 2, 1 / 2');
    await act(async () => { findField().dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', shiftKey: true, bubbles: true, cancelable: true })); });
    expect(n()).toBe('p. 2, 2 / 2');
    await type(findField(), 'page');
    await enter(findField());
    await settle();
    expect(n()).toBe('p. 1, 1 / 3');
    await type(findField(), 'enthalpy');
    await enter(findField());
    await settle();
    expect(n()).toBe('none');
  });

  it('search brings the hit into view, not the top of its page', async () => {
    // jsdom lays nothing out: the hit's range says where it is, and the scroll asked for is read
    const rp = Range.prototype as unknown as { getBoundingClientRect?: () => unknown };
    const ep = Element.prototype as unknown as { scrollTo(o: { top?: number }): void };
    const was = { rect: rp.getBoundingClientRect, scroll: ep.scrollTo };
    const asked: { text: string; top: number }[] = [];
    let cur = '';
    rp.getBoundingClientRect = function (this: Range) { cur = this.toString(); return { top: 2000, bottom: 2012, left: 0, right: 40, width: 40, height: 12 }; };
    ep.scrollTo = function (o) { if (o?.top !== undefined) asked.push({ text: cur, top: o.top }); };
    try {
      await mountBook();
      await key('/');
      await type(findField(), 'heat');
      await enter(findField());
      await settle();
      expect(asked).toEqual([{ text: 'heat', top: 2000 }]);
      await enter(findField());
      await settle();
      expect(asked.length).toBe(2);
    } finally { if (was.rect) rp.getBoundingClientRect = was.rect; else delete rp.getBoundingClientRect; ep.scrollTo = was.scroll; }
  });

  it('a reference is looked for outward from its page, and says so while it looks', async () => {
    const rp = Range.prototype as unknown as { getBoundingClientRect?: () => unknown; getClientRects?: () => unknown[] };
    const was = { rect: rp.getBoundingClientRect, rects: rp.getClientRects };
    rp.getBoundingClientRect = () => ({ top: 10, bottom: 20, left: 0, right: 40, width: 40, height: 10 });
    rp.getClientRects = () => [];
    try {
      await mountBook();
      // "(3.12)" selected on page 1
      const span = Array.from(host.querySelectorAll('.pdf-page[data-page="1"] .textLayer span')).find((x) => x.textContent?.includes('(3.12)'))!;
      const r = document.createRange();
      r.setStart(span.firstChild!, 3);
      r.setEnd(span.firstChild!, 9);
      await act(async () => { const s = window.getSelection()!; s.removeAllRanges(); s.addRange(r); document.dispatchEvent(new Event('selectionchange')); });
      let go!: () => void;
      book.slow = new Promise<void>((res) => { go = res; });
      book.read.length = 0;
      await key('Enter');
      expect(host.querySelector('.pdf-bar .pb-n')?.textContent).toBe('looking');
      await act(async () => { go(); });
      await settle();
      expect(host.querySelector('.pdf-bar')).toBeNull();
      expect(host.querySelector('.pdf-peek .pk-hd')!.textContent).toContain('p. 2');
      // the page past the target was never read
      expect(book.read).toEqual([1, 2]);
    } finally { if (was.rect) rp.getBoundingClientRect = was.rect; else delete rp.getBoundingClientRect; if (was.rects) rp.getClientRects = was.rects; else delete rp.getClientRects; window.getSelection()?.removeAllRanges(); }
  });

  it('what is typed while a search runs stays in the field', async () => {
    await mountBook();
    let go!: () => void;
    book.slow = new Promise<void>((r) => { go = r; });
    await key('/');
    await type(findField(), 'entr');
    await enter(findField());
    await type(findField(), 'entropy on page 2');
    await act(async () => { go(); });
    await settle();
    expect(findField().value).toBe('entropy on page 2');
  });

  it('says which page is in view', async () => {
    await mountBook();
    expect(host.querySelector('.pdf-view .meta')!.textContent).toMatch(/p\. 1|1 \/ 3|3 pages/);
  });

  it('a file that will not open is not called gone from the collection', async () => {
    book.fail = true;
    try {
      await mountBook();
      expect(host.textContent).not.toContain('no longer in the collection');
    } finally { book.fail = false; }
  });

  it('comes back to where it was left when its tab is shown again', async () => {
    // jsdom lays nothing out: scrollTo stands in as the property it sets
    const proto = Element.prototype as unknown as { scrollTo(o: { top?: number }): void };
    const was = proto.scrollTo;
    proto.scrollTo = function (this: Element, o) { if (o?.top !== undefined) this.scrollTop = o.top; };
    try {
      await mountBook();
      const sc = host.querySelector<HTMLElement>('.book-pages')!;
      await act(async () => { sc.scrollTop = 1234; sc.dispatchEvent(new Event('scroll')); });
      // another tab is shown in the pane (the lens unmounts), then this one again
      act(() => root.unmount());
      host.remove();
      await mountBook();
      expect(host.querySelector<HTMLElement>('.book-pages')!.scrollTop).toBe(1234);
    } finally { proto.scrollTo = was; }
  });
});
