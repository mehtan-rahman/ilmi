// @vitest-environment jsdom
// Milestone 70, a book as it opens, drawn in jsdom over a stand-in for the
// PDF: its pages alone, the inspector not asked for, nothing beside them;
// `notes` among the words over the pages opens the note in the pane beside
// (the pane made) and, pressed again, closes it; ⌘\ does the same; what goes
// to a place in the note opens it beside the pages (a box made a section, a
// section's name beside its box); the inspector's toggle over a book leaves
// the saved state alone. And a PDF on its own: with no note, `notes` and `e`
// ask for one (the palette's picker), the boxes kept while it asks; a note
// picked is attached and opens beside the pages; cancelled, nothing is
// written.

import { promises as fsp } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { act, createElement } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { meta } from '../../format/index.js';
import { nodeFs } from '../../vault/node-fs.js';
import { Vault } from '../../vault/index.js';
import { useApp, type DocInfo } from '../store.js';
import { activeTab, emptyPanes, openTab } from '../panes.js';
import { notesId } from '../names.js';
import { attach } from '../vault.js';

const CH3 = 'library/lindqvist/ch-3.md';
const NOTE = 'library/a-note.md';
const PDF = 'library/alone.pdf';
const NOTES = ['---', 'type: source', 'pdf: ../lindqvist.pdf', 'pages: 41-42', '---', '', 'Notes.', ''].join('\n');
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
const { toggleInspector } = await import('../vault.js');
const { inspectorShown } = await import('../layout.js');
const { attachCancelled, attachNote, notesOpen, openNotes } = await import('../book.js');
(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
globalThis.ResizeObserver ??= class { observe() {} unobserve() {} disconnect() {} } as unknown as typeof ResizeObserver;
globalThis.IntersectionObserver ??= class { observe() {} unobserve() {} disconnect() {} } as unknown as typeof IntersectionObserver;
Element.prototype.scrollIntoView ??= function () {};
Element.prototype.scrollTo ??= function () {};
// wide enough that the room rule (`layout.ts`) leaves the inspector beside a note
Object.defineProperty(window, 'innerWidth', { value: 1600, configurable: true });
const rectOf = HTMLElement.prototype.getBoundingClientRect;
HTMLElement.prototype.getBoundingClientRect = function (this: HTMLElement) {
  if (this.classList.contains('pdf-page')) return new DOMRect(0, (Number(this.dataset.page) - 1) * (H + 18), W, H);
  return rectOf.call(this);
};

let host: HTMLDivElement;
let root: Root;
const wait = (ms: number) => act(async () => { await new Promise((r) => setTimeout(r, ms)); });
const q = <T extends Element>(sel: string) => host.querySelector<T>(sel);
const qa = <T extends Element>(sel: string) => Array.from(host.querySelectorAll<T>(sel));
const fire = async (target: EventTarget, e: Event) => { await act(async () => { target.dispatchEvent(e); }); return e; };
const click = (el: Element) => fire(el, new MouseEvent('click', { bubbles: true, cancelable: true, button: 0 }));
const cmdBackslash = () => fire(window, new KeyboardEvent('keydown', { key: '\\', metaKey: true, bubbles: true, cancelable: true }));
const word = () => q<HTMLButtonElement>('.meta .notes-toggle')!;
/** The panes: the ids of each pane's tabs, and which pane is active. */
const panesNow = () => ({ active: useApp.getState().panes.active, tabs: useApp.getState().panes.panes.map((p) => p.tabs.map((t) => t.id)) });
/** A box drawn by the mouse on page `n`. */
const box = async (n: number) => {
  const el = q<HTMLElement>(`.pdf-page[data-page="${n}"]`)!;
  const ptr = (type: string, x: number, y: number) => new PointerEvent(type, { bubbles: true, cancelable: true, pointerId: 3, pointerType: 'mouse', isPrimary: true, button: 0, clientX: x, clientY: y + (n - 1) * (H + 18) });
  await fire(el, ptr('pointerdown', 60, 80));
  await fire(el, new MouseEvent('mousedown', { bubbles: true, cancelable: true, button: 0, detail: 1, clientX: 60, clientY: 80 }));
  await fire(window, ptr('pointermove', 200, 200));
  await fire(window, ptr('pointerup', 360, 320));
};
const docsBase = (): Record<string, DocInfo> => ({
  [CH3]: { type: 'source', frozen: false, cards: 0, due: 0, pdf: 'library/lindqvist.pdf', pages: { first: 41, last: 42 } },
  [NOTE]: { type: 'note', frozen: false, cards: 0, due: 0 },
  [PDF]: { type: 'source', frozen: false, cards: 0, due: 0, pdf: PDF },
});

beforeAll(async () => {
  dir = await fsp.mkdtemp(join(tmpdir(), 'ilmi-book-open-'));
  await fsp.mkdir(join(dir, 'library/lindqvist'), { recursive: true });
  await fsp.writeFile(join(dir, CH3), NOTES);
  await fsp.writeFile(join(dir, NOTE), ['---', 'type: note', '---', '', 'A note.', ''].join('\n'));
  await fsp.writeFile(join(dir, 'library/lindqvist.pdf'), '%PDF-1.7\n');
  await fsp.writeFile(join(dir, PDF), '%PDF-1.7\n');
  vault = await Vault.open(nodeFs, dir);
});
afterAll(async () => {
  vault.close();
  await fsp.rm(dir, { recursive: true, force: true });
});
const mount = async (id: string) => {
  host = document.body.appendChild(document.createElement('div'));
  root = createRoot(host);
  await act(async () => { root.render(createElement(Pdf, { id })); });
  await wait(40);
};
beforeEach(async () => {
  // as another book left them: the inspector asked for over it, one pane with the book
  useApp.setState({ vault: dir, tree: vault.tree, files: vault.documents(), docs: docsBase(), inlineBoxes: {}, bookFocus: null, reveal: null, mobile: false, bookInsp: true, inspForced: false, inspector: { width: 280, open: true }, panes: openTab(emptyPanes(), CH3), paletteOpen: false, noteAttach: null });
  await mount(CH3);
  expect(qa<HTMLElement>('.pdf-page').map((p) => p.dataset.page)).toEqual(['41', '42']);
});
afterEach(() => {
  act(() => root.unmount());
  host.remove();
});

describe('a book as it opens', () => {
  it('is its pages: nothing beside them, the inspector not shown, the saved state as it was', () => {
    expect(q('.book')?.getAttribute('data-notes')).toBe('0');
    expect(q('.book-notes')).toBeNull();
    expect(q('.book-pages .pdf-page')).not.toBeNull();
    expect(useApp.getState().bookInsp).toBe(false);
    expect(inspectorShown(useApp.getState(), 1600)).toBe(false);
    expect(useApp.getState().inspector.open).toBe(true);
    expect(panesNow()).toEqual({ active: 0, tabs: [[CH3]] });
  });

  it('`notes` is among the words over the pages: it opens the note in the pane beside, the pages kept active, and closes it again', async () => {
    expect(word().textContent).toBe('notes');
    expect(word().closest('.meta')).not.toBeNull();
    expect(word().dataset.on).toBe('0');
    await click(word());
    await wait(20);
    // a document with pages is its own notes: its `:notes/` tab, in a second pane made for it
    expect(panesNow()).toEqual({ active: 0, tabs: [[CH3], [notesId(CH3)]] });
    expect(activeTab(useApp.getState().panes)?.id).toBe(CH3);
    expect(notesOpen(CH3)).toBe(true);
    expect(q('.book')?.getAttribute('data-notes')).toBe('1');
    expect(word().dataset.on).toBe('1');
    expect(word().getAttribute('aria-pressed')).toBe('true');
    await click(word());
    await wait(20);
    // closed: the pane left empty goes with it, and the pages are alone again
    expect(panesNow()).toEqual({ active: 0, tabs: [[CH3]] });
    expect(word().dataset.on).toBe('0');
    expect(q('.book')?.getAttribute('data-notes')).toBe('0');
  });

  it('⌘\\ opens the note beside and closes it, ahead of the split', async () => {
    const e = await cmdBackslash();
    await wait(20);
    expect(e.defaultPrevented).toBe(true);
    expect(panesNow()).toEqual({ active: 0, tabs: [[CH3], [notesId(CH3)]] });
    await cmdBackslash();
    await wait(20);
    expect(panesNow()).toEqual({ active: 0, tabs: [[CH3]] });
  });

  it('a note open behind another tab in the other pane is brought to the front there, not opened twice; a third pane is not made', async () => {
    useApp.setState({ panes: { panes: [{ tabs: [{ key: 1, id: CH3 }], active: 0 }, { tabs: [{ key: 2, id: NOTE }, { key: 3, id: notesId(CH3) }], active: 0 }], active: 0 } });
    expect(notesOpen(CH3)).toBe(true);
    await act(async () => { await openNotes(CH3); });
    expect(panesNow()).toEqual({ active: 0, tabs: [[CH3], [NOTE, notesId(CH3)]] });
    expect(useApp.getState().panes.panes[1]!.active).toBe(1);
    // `notes` then closes it, and the pane stays for the tab left in it
    await click(word());
    await wait(20);
    expect(panesNow()).toEqual({ active: 0, tabs: [[CH3], [NOTE]] });
  });

  it('a box made a section opens the note beside the pages with the section in it; ⏎ right after puts the caret there', async () => {
    await box(41);
    expect(qa('.pbox.pending:not(.ghost)').length).toBe(1);
    await fire(window, new KeyboardEvent('keydown', { key: 'e', bubbles: true, cancelable: true }));
    await wait(300);
    const text = await fsp.readFile(join(dir, CH3), 'utf8');
    expect(text).toMatch(/\n## p\. 41\n<!-- read made=\S+ due=\S+ ivl=\d+ boxes=41:0\.100:0\.100:0\.500:0\.300 -->/);
    expect(panesNow()).toEqual({ active: 0, tabs: [[CH3], [notesId(CH3)]] });
    expect(useApp.getState().reveal).toMatchObject({ path: CH3, heading: 'p. 41' });
    expect(useApp.getState().reveal).not.toHaveProperty('write');
    await fire(window, new KeyboardEvent('keydown', { key: 'Enter', bubbles: true, cancelable: true }));
    expect(useApp.getState().reveal).toMatchObject({ path: CH3, heading: 'p. 41', write: true });
    // the read point moved past the box, in the same document
    expect(meta((await vault.read(CH3, true)).doc).read).toBeUndefined();
    await cmdBackslash();
    await wait(20);
    expect(panesNow()).toEqual({ active: 0, tabs: [[CH3]] });
  });

  it('the inspector opens only by its toggle, for this book, the saved state left alone', async () => {
    await act(async () => { toggleInspector(); });
    expect(useApp.getState().bookInsp).toBe(true);
    expect(inspectorShown(useApp.getState(), 900)).toBe(true);
    expect(useApp.getState().inspector.open).toBe(true);
    await act(async () => { toggleInspector(); });
    expect(inspectorShown(useApp.getState(), 1600)).toBe(false);
    expect(useApp.getState().inspector.open).toBe(true);
    // another kind of document: as that document had it, and its toggle is the saved state's
    await act(async () => { useApp.setState({ panes: openTab(emptyPanes(), NOTE) }); });
    expect(inspectorShown(useApp.getState(), 1600)).toBe(true);
    await act(async () => { toggleInspector(); });
    expect(useApp.getState().inspector.open).toBe(false);
    expect(useApp.getState().bookInsp).toBe(false);
  });
});

describe('a PDF on its own', () => {
  beforeEach(async () => {
    act(() => root.unmount());
    host.remove();
    useApp.setState({ panes: openTab(emptyPanes(), PDF), bookInsp: true });
    await mount(PDF);
  });

  it('opens as its pages, no note and nothing beside them; with no note, `notes` asks for one', async () => {
    expect(qa<HTMLElement>('.pdf-page').length).toBe(44);
    expect(q('.book')?.getAttribute('data-notes')).toBe('0');
    expect(useApp.getState().bookInsp).toBe(false);
    expect(q('h1')?.textContent).toBe('alone');
    await click(word());
    await wait(20);
    // the picker: the palette, choosing a note for this PDF; no pane made yet
    expect(useApp.getState().paletteOpen).toBe(true);
    expect(useApp.getState().noteAttach).toEqual({ pdf: PDF, step: 'pick' });
    expect(panesNow()).toEqual({ active: 0, tabs: [[PDF]] });
    // closed with nothing picked: nothing opens
    await act(async () => { attachCancelled(); useApp.setState({ paletteOpen: false, noteAttach: null }); });
    await wait(20);
    expect(panesNow()).toEqual({ active: 0, tabs: [[PDF]] });
  });

  it('`e` on a box asks for a note first, the box kept while it asks; the note picked takes the section, and opens beside', async () => {
    await box(2);
    expect(qa('.pbox.pending:not(.ghost)').length).toBe(1);
    await fire(window, new KeyboardEvent('keydown', { key: 'e', bubbles: true, cancelable: true }));
    await wait(50);
    expect(useApp.getState().noteAttach).toEqual({ pdf: PDF, step: 'pick' });
    expect(qa('.pbox.pending:not(.ghost)').length).toBe(1);
    expect(await fsp.readFile(join(dir, NOTE), 'utf8')).not.toContain('## p. 2');
    // the pick: the note that is there names the PDF, and is its notes from now on
    const done = attachNote(PDF, NOTE);
    await wait(50);
    expect(meta((await vault.read(NOTE, true)).doc).pdf).toBe('alone.pdf');
    // (the app's docs follow the write; here they are set as `attach` would set them)
    await act(async () => { useApp.setState((s) => ({ docs: attach({ ...s.docs, [NOTE]: { ...s.docs[NOTE]!, pdf: PDF } }), paletteOpen: false, noteAttach: null })); });
    await done;
    await wait(300);
    expect(useApp.getState().docs[PDF]?.note).toBe(NOTE);
    expect(useApp.getState().docs[NOTE]).toMatchObject({ of: PDF });
    expect(useApp.getState().docs[NOTE]).not.toHaveProperty('pdf');
    const text = await fsp.readFile(join(dir, NOTE), 'utf8');
    expect(text).toMatch(/\n## p\. 2\n<!-- read made=\S+ due=\S+ ivl=\d+ boxes=2:0\.100:0\.100:0\.500:0\.300 -->/);
    // the note, a document of its own, is the tab beside the pages; the PDF's own line is untouched (no `read` to move)
    expect(panesNow()).toEqual({ active: 0, tabs: [[PDF], [NOTE]] });
    expect(useApp.getState().reveal).toMatchObject({ path: NOTE, heading: 'p. 2' });
    expect(qa('.pbox.pending:not(.ghost)').length).toBe(0);
    expect(q('.book')?.getAttribute('data-notes')).toBe('1');
    expect(word().dataset.on).toBe('1');
    // and from now on `notes` opens and closes that note
    await click(word());
    await wait(20);
    expect(panesNow()).toEqual({ active: 0, tabs: [[PDF]] });
    await click(word());
    await wait(20);
    expect(panesNow()).toEqual({ active: 0, tabs: [[PDF], [NOTE]] });
  });

  it('the section is drawn on the PDF\'s pages from the attached note, and its name beside the page goes to the note', async () => {
    useApp.setState((s) => ({ docs: attach({ ...s.docs, [NOTE]: { ...s.docs[NOTE]!, pdf: PDF } }) }));
    await wait(100);
    const boxes = qa<HTMLElement>('.pbox:not(.pending)');
    expect(boxes.map((b) => b.dataset.section)).toEqual(['p. 2']);
    const mark = q<HTMLElement>('.ptag, .pgut')!;
    await fire(mark, new MouseEvent('mousedown', { bubbles: true, cancelable: true, button: 0 }));
    await wait(20);
    expect(useApp.getState().reveal).toMatchObject({ path: NOTE, heading: 'p. 2' });
    expect(panesNow()).toEqual({ active: 0, tabs: [[PDF], [NOTE]] });
  });
});
