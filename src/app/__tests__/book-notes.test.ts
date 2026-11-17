// @vitest-environment jsdom
// Milestone 81, several notes on one PDF: every note that names a PDF in its
// `pdf` field is one of its notes (`notesOf`), in path order; `open notes`
// opens them all as tabs of the pane beside the pages, the one used last in
// front, and `hide notes` closes them; `+` beside the word picks or makes
// one more, which opens as a further tab in front; `m` clips into the note
// in front beside the pages, else the one used last; a chapter of a book is
// its own notes first, as before, with the notes attached to its PDF as
// further tabs; a boxed section of any of the notes (written before
// milestone 81) is drawn on the pages.

import { promises as fsp } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { act, createElement } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { nodeFs } from '../../vault/node-fs.js';
import { Vault } from '../../vault/index.js';
import { useApp, type DocInfo } from '../store.js';
import { emptyPanes, openTab, selectTab } from '../panes.js';
import { notesId, notesOf, notesPair, notesTabsOf } from '../names.js';
import { attach } from '../vault.js';


const CH3 = 'library/lindqvist/ch-3.md';
const BOOKPDF = 'library/lindqvist.pdf';
const PDF = 'library/alone.pdf';
const A = 'library/a-note.md';
const B = 'library/b-note.md';
const C = 'notes/c-note.md';
const ON_BOOK = 'notes/on-lindqvist.md';
const CHAPTER = ['---', 'type: source', 'pdf: ../lindqvist.pdf', 'pages: 41-42', '---', '', 'Notes.', ''].join('\n');
const noteText = (pdf: string | null, line: string) => ['---', 'type: note', ...(pdf ? [`pdf: ${pdf}`] : []), '---', '', line, ''].join('\n');
const W = 600;
const H = 800;

let vault: Vault;
let dir: string;

vi.mock('../vault.js', async (orig) => {
  const real = await orig<typeof import('../vault.js')>();
  return { ...real, currentVault: () => vault };
});
const page = { getViewport: ({ scale }: { scale: number }) => ({ width: W * scale, height: H * scale }), render: () => ({ promise: Promise.resolve() }), streamTextContent: () => null };
vi.mock('../bookPdf.js', () => ({
  fillCrops: () => {},
  acquirePdf: () => ({ promise: Promise.resolve({ numPages: 44, getPage: async () => page }), release() {} }),
  itemsOf: async () => [],
  pagePaper: async () => ({ image: '', width: W, height: H }),
}));
vi.mock('../pdfjs.js', () => ({ TextLayer: class { render() { return Promise.resolve(); } }, pageBits: async () => [{ str: 'text' }] }));
const { Pdf } = await import('../Pdf.js');
const { addNote, attachCancelled, attachNote, noteFor, notesOpen, openNotes } = await import('../book.js');
const { setCaretPlace } = await import('../sections.js');
(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
globalThis.ResizeObserver ??= class { observe() {} unobserve() {} disconnect() {} } as unknown as typeof ResizeObserver;
globalThis.IntersectionObserver ??= class { observe() {} unobserve() {} disconnect() {} } as unknown as typeof IntersectionObserver;
Element.prototype.scrollIntoView ??= function () {};
Element.prototype.scrollTo ??= function () {};
Object.defineProperty(window, 'innerWidth', { value: 1600, configurable: true });
const rectOf = HTMLElement.prototype.getBoundingClientRect;
HTMLElement.prototype.getBoundingClientRect = function (this: HTMLElement) {
  if (this.classList.contains('pdf-page')) return new DOMRect(0, (Number(this.dataset.page) - 1) * (H + 18), W, H);
  return rectOf.call(this);
};

let host: HTMLDivElement | null = null;
let root: Root | null = null;
const wait = (ms: number) => act(async () => { await new Promise((r) => setTimeout(r, ms)); });
const q = <T extends Element>(sel: string) => host!.querySelector<T>(sel);
const qa = <T extends Element>(sel: string) => Array.from(host!.querySelectorAll<T>(sel));
const fire = async (target: EventTarget, e: Event) => { await act(async () => { target.dispatchEvent(e); }); return e; };
const click = (el: Element) => fire(el, new MouseEvent('click', { bubbles: true, cancelable: true, button: 0 }));
const word = () => q<HTMLButtonElement>('.meta .notes-toggle')!;
const plus = () => q<HTMLButtonElement>('.meta .notes-add');
/** The panes: the ids of each pane's tabs, which tab of each is in front, and which pane is active. */
const panesNow = () => ({ active: useApp.getState().panes.active, tabs: useApp.getState().panes.panes.map((p) => p.tabs.map((t) => t.id)), front: useApp.getState().panes.panes.map((p) => p.tabs[p.active]?.id) });
const box = async (n: number) => {
  const el = q<HTMLElement>(`.pdf-page[data-page="${n}"]`)!;
  const ptr = (type: string, x: number, y: number) => new PointerEvent(type, { bubbles: true, cancelable: true, pointerId: 3, pointerType: 'mouse', isPrimary: true, button: 0, clientX: x, clientY: y + (n - 1) * (H + 18) });
  await fire(el, ptr('pointerdown', 60, 80));
  await fire(el, new MouseEvent('mousedown', { bubbles: true, cancelable: true, button: 0, detail: 1, clientX: 60, clientY: 80 }));
  await fire(window, ptr('pointermove', 200, 200));
  await fire(window, ptr('pointerup', 360, 320));
};
const pressM = async () => { await fire(window, new KeyboardEvent('keydown', { key: 'm', bubbles: true, cancelable: true })); await wait(300); };
const CLIP = '<!-- box 2:0.100:0.100:0.500:0.300 -->';
const note = (pdf?: string): DocInfo => ({ type: 'note', frozen: false, cards: 0, due: 0, ...(pdf ? { pdf } : {}) });
/** The app's docs as the tree's walk and `attach` leave them: two notes on the PDF alone, one on the book, one on nothing. */
const docsBase = (): Record<string, DocInfo> => attach({
  [CH3]: { type: 'source', frozen: false, cards: 0, due: 0, pdf: BOOKPDF, pages: { first: 41, last: 42 } },
  [BOOKPDF]: { type: 'source', frozen: false, cards: 0, due: 0, pdf: BOOKPDF },
  [PDF]: { type: 'source', frozen: false, cards: 0, due: 0, pdf: PDF },
  [A]: note(PDF),
  [B]: note(PDF),
  [C]: note(),
  [ON_BOOK]: note(BOOKPDF),
});

beforeAll(async () => {
  dir = await fsp.mkdtemp(join(tmpdir(), 'ilmi-book-notes-'));
  await fsp.mkdir(join(dir, 'library/lindqvist'), { recursive: true });
  await fsp.mkdir(join(dir, 'notes'), { recursive: true });
  await fsp.writeFile(join(dir, CH3), CHAPTER);
  await fsp.writeFile(join(dir, A), noteText('alone.pdf', 'First.'));
  await fsp.writeFile(join(dir, B), noteText('alone.pdf', 'Second.'));
  await fsp.writeFile(join(dir, C), noteText(null, 'Third.'));
  await fsp.writeFile(join(dir, ON_BOOK), noteText('../library/lindqvist.pdf', 'On the book.'));
  await fsp.writeFile(join(dir, BOOKPDF), '%PDF-1.7\n');
  await fsp.writeFile(join(dir, PDF), '%PDF-1.7\n');
  vault = await Vault.open(nodeFs, dir);
  Object.assign(vault.fs, { blobAt: (abs: string) => (abs.endsWith('alone.pdf') ? 'cd'.repeat(32) : 'ab'.repeat(32)), pageInk: async () => [], inkedPages: async () => [], onPageInk: () => () => {} });
});
afterAll(async () => {
  vault.close();
  await fsp.rm(dir, { recursive: true, force: true });
});
const mount = async (id: string) => {
  host = document.body.appendChild(document.createElement('div'));
  root = createRoot(host);
  await act(async () => { root!.render(createElement(Pdf, { id })); });
  await wait(40);
};
const open = async (id: string) => {
  useApp.setState({ vault: dir, tree: vault.tree, files: vault.documents(), docs: docsBase(), inlineBoxes: {}, bookFocus: null, reveal: null, mobile: false, phone: false, notice: null, paletteOpen: false, noteAttach: null, panes: openTab(emptyPanes(), id) });
  await mount(id);
};
afterEach(() => {
  if (root) act(() => root!.unmount());
  host?.remove();
  root = null;
  host = null;
});

describe('the notes on a PDF', () => {
  it('are every note that names it, in path order; a chapter is its own notes first, then its PDF\'s; one detached drops out', () => {
    const docs = docsBase();
    expect(docs[PDF]).toMatchObject({ note: A, notes: [A, B] });
    expect(notesOf(PDF, docs)).toEqual([A, B]);
    expect(notesTabsOf(PDF, docs)).toEqual([A, B]);
    expect(notesOf(CH3, docs)).toEqual([CH3, ON_BOOK]);
    expect(notesTabsOf(CH3, docs)).toEqual([notesId(CH3), ON_BOOK]);
    expect(notesOf(A, docs)).toEqual([A]);
    expect(notesOf(C, docs)).toEqual([]);
    // said again over the same docs, nothing is made anew
    expect(attach(docs)).toBe(docs);
    // B no longer names the PDF (its `of` goes as its field did): one note is left; then none
    const { of: _b, ...bare } = docs[B]!;
    const one = attach({ ...docs, [B]: bare });
    expect(one[PDF]).toMatchObject({ note: A, notes: [A] });
    const { [A]: _a, ...rest } = one;
    const none = attach(rest);
    expect(none[PDF]?.note).toBeUndefined();
    expect(none[PDF]?.notes).toBeUndefined();
    expect(notesOf(PDF, none)).toEqual([]);
  });

  it('an iPad keeps the pane beside the pages whichever of the notes is in front there', () => {
    const docs = docsBase();
    const two = (x: string, y: string) => ({ active: 0, panes: [{ tabs: [{ key: 1, id: x }], active: 0 }, { tabs: [{ key: 2, id: y }], active: 0 }] });
    expect(notesPair(two(PDF, A), docs)).toBe(true);
    expect(notesPair(two(PDF, B), docs)).toBe(true);
    expect(notesPair(two(B, PDF), docs)).toBe(true);
    expect(notesPair(two(PDF, C), docs)).toBe(false);
    expect(notesPair(two(CH3, notesId(CH3)), docs)).toBe(true);
    expect(notesPair(two(CH3, ON_BOOK), docs)).toBe(true);
    expect(notesPair(two(CH3, A), docs)).toBe(false);
  });
});

describe('several notes beside the pages', () => {
  beforeEach(() => open(PDF));

  it('`open notes` opens them all as tabs of the pane beside, the first in front when none was used; `hide notes` closes them all', async () => {
    expect(word().textContent).toBe('open notes');
    await click(word());
    await wait(20);
    expect(panesNow()).toEqual({ active: 0, tabs: [[PDF], [A, B]], front: [PDF, A] });
    expect(notesOpen(PDF)).toBe(true);
    expect(word().textContent).toBe('hide notes');
    expect(q('.book')?.getAttribute('data-notes')).toBe('1');
    await click(word());
    await wait(20);
    expect(panesNow()).toEqual({ active: 0, tabs: [[PDF]], front: [PDF] });
    expect(word().textContent).toBe('open notes');
  });

  it('the one used last is in front the next time, and the notes still count as open with the other in front', async () => {
    await click(word());
    await wait(20);
    // the second note's tab pressed, then the pages again
    await act(async () => { useApp.setState((s) => ({ panes: selectTab(s.panes, 1, 1) })); });
    await act(async () => { useApp.setState((s) => ({ panes: selectTab(s.panes, 0, 0) })); });
    expect(panesNow().front).toEqual([PDF, B]);
    expect(notesOpen(PDF)).toBe(true);
    expect(word().textContent).toBe('hide notes');
    expect(noteFor(PDF)).toBe(B);
    await click(word());
    await wait(20);
    expect(panesNow().tabs).toEqual([[PDF]]);
    expect(noteFor(PDF)).toBe(B);
    await click(word());
    await wait(20);
    expect(panesNow()).toEqual({ active: 0, tabs: [[PDF], [A, B]], front: [PDF, B] });
  });

  it('a note open beside already stays where it is: the others join it, nothing is opened twice', async () => {
    await act(async () => { await openNotes(PDF, B); });
    expect(panesNow()).toEqual({ active: 0, tabs: [[PDF], [A, B]], front: [PDF, B] });
    await act(async () => { await openNotes(PDF, A); });
    expect(panesNow()).toEqual({ active: 0, tabs: [[PDF], [A, B]], front: [PDF, A] });
  });

  it('a phone has one page: the note used last, in place of the pages, and no `+`', async () => {
    await act(async () => { useApp.setState({ phone: true, mobile: true }); });
    expect(plus()).toBeNull();
    await act(async () => { await openNotes(PDF, B); });
    expect(panesNow()).toEqual({ active: 0, tabs: [[B]], front: [B] });
    await act(async () => { useApp.setState({ phone: false, mobile: false }); });
  });

  it('`+` beside the word asks for one more note as the first was asked for; picked, it is a further tab, in front', async () => {
    expect(plus()?.title).toBe('new note');
    expect(plus()?.querySelector('kbd, .kbd')).toBeNull();
    await click(plus()!);
    await wait(20);
    expect(useApp.getState().paletteOpen).toBe(true);
    expect(useApp.getState().noteAttach).toEqual({ pdf: PDF, step: 'pick' });
    expect(panesNow().tabs).toEqual([[PDF]]);
    // closed with nothing picked: nothing opens, nothing is attached
    await act(async () => { attachCancelled(); useApp.setState({ paletteOpen: false, noteAttach: null }); });
    await wait(20);
    expect(panesNow().tabs).toEqual([[PDF]]);
    expect(useApp.getState().docs[PDF]?.notes).toEqual([A, B]);
    // asked again and a note picked
    const before = await fsp.readFile(join(dir, C), 'utf8');
    const added = addNote(PDF);
    await wait(20);
    const done = attachNote(PDF, C);
    await wait(50);
    await act(async () => { useApp.setState((s) => ({ docs: attach({ ...s.docs, [C]: { ...s.docs[C]!, pdf: PDF } }), paletteOpen: false, noteAttach: null })); });
    await done;
    await act(async () => { expect(await added).toBe(C); });
    await wait(50);
    expect(await fsp.readFile(join(dir, C), 'utf8')).toBe(before.replace('type: note\n', 'type: note\npdf: ../library/alone.pdf\n'));
    expect(useApp.getState().docs[PDF]?.notes).toEqual([A, B, C]);
    expect(panesNow()).toEqual({ active: 0, tabs: [[PDF], [A, B, C]], front: [PDF, C] });
    await fsp.writeFile(join(dir, C), before);
    await vault.read(C, true);
  });

  it('a PDF with no note yet has no `+`: `create notes` is the way to the first', async () => {
    await act(async () => { useApp.setState((s) => { const { [A]: _a, [B]: _b, ...rest } = s.docs; return { docs: attach(rest) }; }); });
    expect(word().textContent).toBe('create notes');
    expect(plus()).toBeNull();
  });

  it('`m` clips into the note in front beside the pages; with the notes closed, into the one used last', async () => {
    await act(async () => { await openNotes(PDF, B); });
    await box(2);
    await pressM();
    expect(await fsp.readFile(join(dir, B), 'utf8')).toBe(`${noteText('alone.pdf', 'Second.')}\n${CLIP}\n`);
    expect(await fsp.readFile(join(dir, A), 'utf8')).toBe(noteText('alone.pdf', 'First.'));
    expect(useApp.getState().reveal).toMatchObject({ path: B, write: true });
    expect(panesNow().front).toEqual([PDF, B]);
    // the first note brought to the front: the next clip is its
    await act(async () => { useApp.setState((s) => ({ panes: selectTab(selectTab(s.panes, 1, 0), 0, 0) })); });
    await box(2);
    await pressM();
    expect(await fsp.readFile(join(dir, A), 'utf8')).toBe(`${noteText('alone.pdf', 'First.')}\n${CLIP}\n`);
    // closed: the one used last (the first) takes it, and opens in front
    await click(word());
    await wait(20);
    expect(panesNow().tabs).toEqual([[PDF]]);
    await box(2);
    await pressM();
    expect(await fsp.readFile(join(dir, A), 'utf8')).toBe(`${noteText('alone.pdf', 'First.')}\n${CLIP}\n\n${CLIP}\n`);
    expect(await fsp.readFile(join(dir, B), 'utf8')).toBe(`${noteText('alone.pdf', 'Second.')}\n${CLIP}\n`);
    expect(panesNow()).toEqual({ active: 0, tabs: [[PDF], [A, B]], front: [PDF, A] });
    await vault.update(A, (d) => { d.blocks.splice(1); });
    await vault.update(B, (d) => { d.blocks.splice(1); });
  });

  it('a boxed section written before milestone 81 is drawn from whichever note holds it, and its name goes to that note', async () => {
    await vault.update(B, (d) => { d.blocks.push({ kind: 'heading', level: 2, text: 'p. 2', read: { made: '2026-10-30', due: '2026-11-02', ivl: 3, boxes: '2:0.100:0.100:0.500:0.300' } }); });
    await wait(100);
    expect(qa<HTMLElement>('.pbox:not(.pending)').map((b) => b.dataset.section)).toEqual(['p. 2']);
    await fire(q<HTMLElement>('.ptag, .pgut')!, new MouseEvent('mousedown', { bubbles: true, cancelable: true, button: 0 }));
    await wait(20);
    expect(useApp.getState().reveal).toMatchObject({ path: B, heading: 'p. 2' });
    expect(panesNow()).toEqual({ active: 0, tabs: [[PDF], [A, B]], front: [PDF, B] });
    await vault.update(B, (d) => { d.blocks.splice(1); });
  });
});

describe('a chapter of a book', () => {
  beforeEach(() => open(CH3));

  it('is its own notes first, in front, with the notes attached to its PDF as further tabs; `+` attaches to the PDF', async () => {
    expect(word().textContent).toBe('open notes');
    await click(word());
    await wait(20);
    expect(panesNow()).toEqual({ active: 0, tabs: [[CH3], [notesId(CH3), ON_BOOK]], front: [CH3, notesId(CH3)] });
    await click(word());
    await wait(20);
    expect(panesNow().tabs).toEqual([[CH3]]);
    await click(plus()!);
    await wait(20);
    expect(useApp.getState().noteAttach).toEqual({ pdf: BOOKPDF, step: 'pick' });
    await act(async () => { attachCancelled(); useApp.setState({ paletteOpen: false, noteAttach: null }); });
  });

  it('with no note attached to its PDF it is exactly as it was: one `:notes/` tab; and `m` clips into the chapter itself', async () => {
    await act(async () => { useApp.setState((s) => { const { [ON_BOOK]: _n, ...rest } = s.docs; return { docs: attach(rest) }; }); });
    await click(word());
    await wait(20);
    expect(panesNow()).toEqual({ active: 0, tabs: [[CH3], [notesId(CH3)]], front: [CH3, notesId(CH3)] });
    await box(41);
    await pressM();
    expect(await fsp.readFile(join(dir, CH3), 'utf8')).toBe(`${CHAPTER}\n<!-- box 41:0.100:0.100:0.500:0.300 -->\n`);
    await vault.update(CH3, (d) => { d.blocks.splice(1); });
  });

  it('a chapter whose PDF is no document of its own has no `+`', async () => {
    await act(async () => { useApp.setState((s) => { const { [BOOKPDF]: _p, [ON_BOOK]: _n, ...rest } = s.docs; return { docs: attach(rest) }; }); });
    expect(word().textContent).toBe('open notes');
    expect(plus()).toBeNull();
  });
});
