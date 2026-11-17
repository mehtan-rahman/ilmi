// @vitest-environment jsdom
// Written notes (milestone 82; FORMAT.md §3): a note whose pages are paper,
// over a collection opened as the app opens one, on a store in memory. The
// index (`written`, `pdf` its own path, `of` / `notes` both ways), the names
// (`names.ts`) over a notebook, making one, its sheets and its paper
// (`written.ts`), its id where a PDF's hash stands (`pdfHashOf`), a passage
// kept on a sheet as the notebook's item in the queue, and an export that
// writes the strokes and the passages under the id, read again by an import.

import { promises as fsp } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';
import { meta, parse } from '../../format/index.js';
import { exportFolder, importFolder, marksHashOf, marksPath, parseMarks, type InkStroke, type StoreFs } from '../../vault/index.js';
import { nodeFs } from '../../vault/node-fs.js';
import { besideAt } from '../panes.js';
import { useApp, type DocInfo } from '../store.js';

const ROOT = '/collections/written';
let mem: StoreFs;
vi.mock('../collections.js', async (orig) => ({ ...(await orig<typeof import('../collections.js')>()), collectionFs: () => mem }));
vi.mock('../crdt.js', async (orig) => ({ ...(await orig<typeof import('../crdt.js')>()), startCrdt: async () => true, stopCrdt: () => {}, crdtWrote: () => { told += 1; } }));
vi.mock('../keep.js', async (orig) => ({ ...(await orig<typeof import('../keep.js')>()), startMirror: async () => {}, stopMirror: () => {}, keepDatedSoon: () => {}, stopDated: () => {} }));
vi.mock('@tauri-apps/plugin-log', async (orig) => ({ ...(await orig<typeof import('@tauri-apps/plugin-log')>()), info: async () => {} }));
vi.mock('../../plugins/index.js', async (orig) => ({ ...(await orig<typeof import('../../plugins/index.js')>()), startPlugins: async () => ({}), stopPlugins: () => {} }));
/** How often the sync was told of strokes. */
let told = 0;

const { attach, duplicateNode, moveNode, openVault, removeNode, renameNode } = await import('../vault.js');
const { memStore } = await import('../../vault/mem-store.js');
const { storeFs } = await import('../../vault/store.js');
const names = await import('../names.js');
const written = await import('../written.js');
const book = await import('../book.js');
const passages = await import('../passages.js');

const PDF = 'books/alone.pdf';
const OTHER = 'books/other.pdf';
const stroke = (n: number): InkStroke => ({ stroke: `s${n}`, at: 1000 + n, data: btoa(`stroke ${n}`) });
const docs = (): Record<string, DocInfo> => useApp.getState().docs;
const text = (path: string): Promise<string> => mem.readText(`${ROOT}/${path}`);
const front = async (path: string) => meta(parse(await text(path)).doc);

async function until(what: () => boolean, say: string): Promise<void> {
  for (let i = 0; i < 300; i++) { if (what()) return; await new Promise((r) => setTimeout(r, 10)); }
  throw new Error(`never: ${say}`);
}

let out: string;
beforeAll(async () => {
  out = await fsp.mkdtemp(join(tmpdir(), 'ilmi-written-'));
  mem = storeFs(memStore(), ROOT);
  await mem.mkdir(ROOT);
  await mem.mkdir(`${ROOT}/books`);
  await mem.writeBytes(`${ROOT}/${PDF}`, new TextEncoder().encode('%PDF-1.4 alone'));
  await mem.writeBytes(`${ROOT}/${OTHER}`, new TextEncoder().encode('%PDF-1.4 other'));
  await mem.writeText(`${ROOT}/books/typed.md`, '---\npdf: alone.pdf\n---\n\nTyped.\n');
  await mem.writeText(`${ROOT}/plain.md`, 'A note.\n');
  await openVault(ROOT);
  await until(() => docs()[PDF]?.notes?.length === 1, 'the collection is open');
});
afterAll(async () => {
  await fsp.rm(out, { recursive: true, force: true });
});

describe('the index, by hand', () => {
  const info = (more: Partial<DocInfo> = {}): DocInfo => ({ type: 'note', frozen: false, cards: 0, due: 0, ...more });
  const w = { id: 'a'.repeat(32), paper: 'ruled' as const, sheets: [1, 2] };

  it('a notebook that names a PDF on its own is among its notes, in path order with the typed ones, and still its own pages', () => {
    const got = attach({
      'b.pdf': info({ type: 'source', pdf: 'b.pdf' }),
      'a-typed.md': info({ pdf: 'b.pdf' }),
      'm-written.md': info({ written: w, pdf: 'm-written.md', of: 'b.pdf' }),
      'z-typed.md': info({ pdf: 'b.pdf' }),
    });
    expect(got['b.pdf']!.notes).toEqual(['a-typed.md', 'm-written.md', 'z-typed.md']);
    expect(got['b.pdf']!.note).toBe('a-typed.md');
    expect(got['m-written.md']).toMatchObject({ pdf: 'm-written.md', of: 'b.pdf' });
    expect(got['a-typed.md']).toMatchObject({ of: 'b.pdf' });
    expect(got['a-typed.md']!.pdf).toBeUndefined();
    // said again: the same
    expect(attach(got)).toBe(got);
  });

  it('a notebook naming what is no PDF on its own is attached to nothing', () => {
    const got = attach({
      'n.md': info({ written: w, pdf: 'n.md', of: 'gone.pdf' }),
      'm.md': info({ written: { ...w, id: 'b'.repeat(32) }, pdf: 'm.md', of: 'n.md' }),
    });
    expect(got['n.md']!.of).toBeUndefined();
    expect(got['m.md']!.of).toBeUndefined();
    expect(got['n.md']!.notes).toBeUndefined();
  });

  it('a typed note whose pdf names a notebook is attached to it, whatever its type; a source naming a PDF is still its pages', () => {
    const got = attach({
      'n.md': info({ written: w, pdf: 'n.md' }),
      'typed.md': info({ pdf: 'n.md' }),
      'src.md': info({ type: 'source', pdf: 'n.md' }),
      'b.pdf': info({ type: 'source', pdf: 'b.pdf' }),
      'ch.md': info({ type: 'source', pdf: 'b.pdf' }),
    });
    expect(got['typed.md']).toMatchObject({ of: 'n.md' });
    expect(got['typed.md']!.pdf).toBeUndefined();
    expect(got['src.md']).toMatchObject({ of: 'n.md' });
    expect(got['n.md']!.notes).toEqual(['src.md', 'typed.md']);
    expect(got['ch.md']!.pdf).toBe('b.pdf');
    expect(got['b.pdf']!.notes).toBeUndefined();
  });

  it('the names over a notebook', () => {
    const d = attach({
      'b.pdf': info({ type: 'source', pdf: 'b.pdf' }),
      'a-typed.md': info({ pdf: 'b.pdf' }),
      'n.md': info({ written: w, pdf: 'n.md', of: 'b.pdf' }),
      'on-n.md': info({ pdf: 'n.md' }),
      'alone.md': info({ written: { ...w, id: 'c'.repeat(32) }, pdf: 'alone.md' }),
      'plain.md': info(),
    });
    expect(written.isWritten('n.md', d)).toBe(true);
    expect(written.isWritten('plain.md', d)).toBe(false);
    expect(written.isWritten('b.pdf', d)).toBe(false);
    expect(['b.pdf', 'n.md', 'alone.md', 'plain.md', 'a-typed.md'].map((p) => written.isPagesPath(p, d))).toEqual([true, true, true, false, false]);
    // a notebook is a note, read by its own sheets, and has its own mark
    expect(names.kindOf('n.md', d)).toBe('note');
    expect(names.glyphOf('n.md', d)).toBe(names.WRITTEN_GLYPH);
    expect(names.glyphOf('plain.md', d)).toBe(names.GLYPH.note);
    expect(names.pagesOf('n.md', d)).toBe('n.md');
    expect(names.pagesOf('on-n.md', d)).toBe('n.md');
    // the PDF's notes: the typed one and the notebook, the notebook's tab itself (no `:notes/` tab)
    expect(names.notesOf('b.pdf', d)).toEqual(['a-typed.md', 'n.md']);
    expect(names.notesTabsOf('b.pdf', d)).toEqual(['a-typed.md', 'n.md']);
    expect(names.noteTabOf('n.md', d)).toBe('n.md');
    // the notebook's own notes
    expect(names.noteOf('n.md', d)).toBe('on-n.md');
    expect(names.notesOf('n.md', d)).toEqual(['on-n.md']);
    expect(names.notesTabOf('n.md', d)).toBe('on-n.md');
    expect(names.noteOf('alone.md', d)).toBeNull();
    expect(names.notesOf('alone.md', d)).toEqual([]);
    // a further note on a notebook's sheets names the notebook; on a PDF's pages, the PDF
    expect(names.pdfForNotes('n.md', d)).toBe('n.md');
    expect(names.pdfForNotes('b.pdf', d)).toBe('b.pdf');
    expect(names.pdfForNotes('plain.md', d)).toBeNull();
  });

  it('a sheet and where it lies', () => {
    expect(written.placeOfSheet([1, 3, 7], 3)).toBe(2);
    expect(written.placeOfSheet([1, 3, 7], 2)).toBeNull();
    expect(written.sheetAt([1, 3, 7], 3)).toBe(7);
    expect(written.sheetAt([1, 3, 7], 4)).toBeNull();
    expect(written.nextSheet([1, 3, 7])).toBe(8);
    expect(written.PAPERS).toEqual(['blank', 'ruled', 'grid', 'dotted']);
    expect([written.SHEET_W, written.SHEET_H]).toEqual([612, 792]);
  });
});

describe('a notebook in a collection', () => {
  let nb: string;
  let id: string;

  it('made: an id minted, ruled, one sheet, no body; known as its own pages', async () => {
    nb = await written.createWritten('', 'worked problems');
    expect(nb).toBe('worked problems.md');
    await written.whenKnown(nb);
    const m = await front(nb);
    id = m.written!.id;
    expect(id).toMatch(/^[0-9a-f]{32}$/);
    expect(await text(nb)).toBe(`---\nwritten: ${id}\npaper: ruled\nsheets: 1\n---\n`);
    expect(docs()[nb]).toMatchObject({ type: 'note', pdf: nb, written: { id, paper: 'ruled', sheets: [1] } });
    expect(docs()[nb]!.of).toBeUndefined();
    expect(book.pdfHashOf(nb)).toBe(id);
    // a second one has an id of its own
    const two = await written.createWritten('', 'worked problems');
    expect(two).toBe('worked problems 2.md');
    expect((await front(two)).written!.id).not.toBe(id);
    await removeNode(two);
  });

  it('sheets added, each one past the highest; the paper set', async () => {
    expect(await written.addSheet(nb)).toBe(2);
    expect(await written.addSheet(nb)).toBe(3);
    await written.setPaper(nb, 'grid');
    expect(await text(nb)).toBe(`---\nwritten: ${id}\npaper: grid\nsheets: 1 2 3\n---\n`);
    await until(() => docs()[nb]?.written?.sheets.length === 3 && docs()[nb]?.written?.paper === 'grid', 'the index has the sheets and the paper');
    await expect(written.addSheet('plain.md')).rejects.toThrow('not written notes');
    await expect(written.setPaper('plain.md', 'grid')).rejects.toThrow('not written notes');
    expect(await text('plain.md')).toBe('A note.\n');
  });

  it('a passage kept on a sheet is the notebook\'s, in the queue and in its list', async () => {
    const kept = await passages.keepPassage(nb, [{ page: 2, x: 0.1, y: 0.2, w: 0.5, h: 0.1 }]);
    expect(kept?.hash).toBe(id);
    const boxes = kept!.boxes;
    expect(passages.passageOf(id, boxes)).toMatchObject({ kind: 'passage', page: 2 });
    expect(passages.passageDoc(id, 2)).toBe(nb);
    expect(book.bookFor(id, 2)).toBe(nb);
    // among the marks, under the id
    expect(Object.keys(parseMarks(await text(marksPath(id))))).toEqual([`s-${boxes}`]);
    // due on its cadence: an item of the notebook then
    const later = new Date(Date.now() + 30 * 86400000);
    const items = passages.passageItems(later).filter((i) => i.path === nb);
    expect(items).toHaveLength(1);
    expect(items[0]).toMatchObject({ kind: 'section', path: nb, passage: { hash: id, boxes } });
    await until(() => useApp.getState().queue.some((i) => i.kind === 'section' && i.path === nb && i.passage?.boxes === boxes), 'the queue has the passage');
    expect(kept!.label).toBe('p. 2');
    expect(items[0]).toMatchObject({ heading: 'p. 2' });
    // the palette's `passages · <name>`
    expect((await book.markList('passages', nb)).map((r) => [r.title, r.page])).toEqual([['p. 2', 2]]);
    // a sheet before it taken out: it is named, listed and gone to by where its sheet lies now, its boxes as they were
    await written.removeSheet(nb, 1);
    await until(() => docs()[nb]?.written?.sheets.join() === '2,3', 'sheet 1 is out');
    expect((await book.markList('passages', nb)).map((r) => [r.title, r.page])).toEqual([['p. 1', 1]]);
    expect(passages.passageItems(later).filter((i) => i.path === nb).map((i) => i.kind === 'section' && [i.heading, i.passage?.boxes])).toEqual([['p. 1', boxes]]);
    book.goToMark(id, { page: 2, y: 0.2 });
    expect(book.takePlace(nb)).toEqual({ page: 1, y: 0.2 });
    // the same marks file is the notebook's by its name
    expect(marksHashOf(marksPath(id))).toBe(id);
  });

  it('a sheet taken out: its number, its strokes and its passages go; the undo puts all of it back at its place', async () => {
    await mem.setPageInk(id, 2, [stroke(1), stroke(2)]);
    await mem.setPageInk(id, 3, [stroke(3)]);
    const [key] = Object.keys(parseMarks(await text(marksPath(id))));
    told = 0;
    const undo = await written.removeSheet(nb, 2);
    expect((await front(nb)).written!.sheets).toEqual([3]);
    expect(await mem.pageInk(id, 2)).toEqual([]);
    expect((await mem.pageInk(id, 3)).map((s) => s.stroke)).toEqual(['s3']);
    expect(passages.passageItems(new Date(Date.now() + 30 * 86400000)).filter((i) => i.path === nb)).toEqual([]);
    await until(() => told === 1, 'the sync is told of the strokes');
    await undo();
    expect((await front(nb)).written!.sheets).toEqual([2, 3]);
    expect((await mem.pageInk(id, 2)).map((s) => s.stroke).sort()).toEqual(['s1', 's2']);
    expect(Object.keys(book.heldMarks().get(id) ?? {})).toEqual([key]);
    await until(() => told === 2, 'and of their coming back');
    await expect(written.removeSheet(nb, 9)).rejects.toThrow('no sheet 9');
  });

  it('the last sheet taken out leaves a fresh one with the next number; the undo takes that one away again', async () => {
    const undo3 = await written.removeSheet(nb, 3);
    const undo2 = await written.removeSheet(nb, 2);
    // one past the highest there: 2 was the only one
    expect((await front(nb)).written!.sheets).toEqual([3]);
    expect(await mem.pageInk(id, 2)).toEqual([]);
    expect(await mem.pageInk(id, 3)).toEqual([]);
    await undo2();
    expect((await front(nb)).written!.sheets).toEqual([2]);
    await undo3();
    expect((await front(nb)).written!.sheets).toEqual([2, 3]);
    expect((await mem.pageInk(id, 3)).map((s) => s.stroke)).toEqual(['s3']);
    // the fresh sheet written on meanwhile stays, and the one put back lies where it lay
    const undo = await written.removeSheet(nb, 3);
    const last = await written.removeSheet(nb, 2);
    expect((await front(nb)).written!.sheets).toEqual([3]);
    await mem.setPageInk(id, 3, [stroke(9)]);
    await last();
    expect((await front(nb)).written!.sheets).toEqual([2, 3]);
    // sheet 3 is there again under its number: what was on it joins what has been written since
    await undo();
    expect((await front(nb)).written!.sheets).toEqual([2, 3]);
    expect((await mem.pageInk(id, 3)).map((s) => s.stroke).sort()).toEqual(['s3', 's9']);
    await mem.setPageInk(id, 3, [stroke(3)]);
  });

  it('an export writes the strokes and the passages under the id; an import of that folder has them again', async () => {
    await until(() => docs()[nb]?.written?.sheets.join() === '2,3', 'the index is settled');
    await exportFolder(mem, ROOT, nodeFs, out);
    expect((await fsp.readdir(join(out, '.ilmi/ink', id))).sort()).toEqual(['2.pkdrawing', '3.pkdrawing']);
    const marks = parseMarks(await fsp.readFile(join(out, '.ilmi/marks', `${id}.json`), 'utf8'));
    expect(Object.values(marks).map((m) => m.kind)).toEqual(['passage']);
    expect(await fsp.readFile(join(out, nb), 'utf8')).toBe(`---\nwritten: ${id}\npaper: grid\nsheets: 2 3\n---\n`);
    const back = storeFs(memStore(), '/collections/back');
    await back.mkdir('/collections/back');
    await importFolder(nodeFs, out, back, '/collections/back');
    expect((await back.pageInk(id, 2)).map((s) => s.stroke).sort()).toEqual(['s1', 's2']);
    expect((await back.pageInk(id, 3)).map((s) => s.stroke)).toEqual(['s3']);
    expect(parseMarks(await back.readText(`/collections/back/${marksPath(id)}`))).toEqual(marks);
    expect(await back.readText(`/collections/back/${nb}`)).toBe(await text(nb));
    // opened, that collection has the notebook as its sheets and its passage in the queue
    const here = mem;
    mem = back;
    await openVault('/collections/back');
    await until(() => !!docs()[nb]?.written && useApp.getState().queue.some((i) => i.kind === 'section' && i.path === nb && i.passage?.hash === id), 'the passage is read from the marks under the id');
    expect(docs()[nb]).toMatchObject({ pdf: nb, written: { id, paper: 'grid', sheets: [2, 3] } });
    expect(docs()[PDF]!.notes).toEqual(['books/typed.md']);
    mem = here;
    await openVault(ROOT);
    await until(() => !!docs()[nb]?.written && useApp.getState().queue.some((i) => i.kind === 'section' && i.path === nb), 'the first collection is open again');
  });

  it('renamed and moved it keeps its id, so its strokes and passages; a duplicate is a notebook of its own with a copy of the strokes', async () => {
    const renamed = await renameNode(nb, 'problems');
    const moved = await moveNode(renamed, 'books');
    expect(moved).toBe('books/problems.md');
    await written.whenKnown(moved);
    expect(book.pdfHashOf(moved)).toBe(id);
    expect(passages.passageDoc(id, 2)).toBe(moved);
    const copy = await duplicateNode(moved);
    const cid = (await front(copy)).written!.id;
    expect(cid).toMatch(/^[0-9a-f]{32}$/);
    expect(cid).not.toBe(id);
    expect((await front(copy)).written!.sheets).toEqual([2, 3]);
    expect((await mem.pageInk(cid, 2)).map((s) => s.stroke).sort()).toEqual(['s1', 's2']);
    await mem.setPageInk(cid, 2, []);
    expect(await mem.pageInk(id, 2)).toHaveLength(2);
    await removeNode(copy);
    nb = moved;
  });

  it('deleted, its strokes and passages are left, and are its again when the file comes back', async () => {
    const was = await text(nb);
    await removeNode(nb);
    await until(() => !docs()[nb], 'it is gone');
    expect(await mem.pageInk(id, 2)).toHaveLength(2);
    expect(passages.passageDoc(id, 2)).toBeNull();
    expect(passages.passageItems(new Date(Date.now() + 30 * 86400000))).toEqual([]);
    await mem.writeText(`${ROOT}/${nb}`, was);
    await until(() => !!docs()[nb]?.written, 'it is back');
    expect(passages.passageDoc(id, 2)).toBe(nb);
  });
});

describe('a notebook and a PDF', () => {
  it('made for a PDF it names it, is one of its notes beside the typed one, and opens as its sheets beside the pages', async () => {
    useApp.setState({ phone: false });
    book.openBookAt(PDF, { page: 1, y: 0 });
    const asked = written.addWritten(PDF);
    expect(useApp.getState().noteAttach).toEqual({ pdf: PDF, step: 'pick', kind: 'written' });
    expect(useApp.getState().paletteOpen).toBe(true);
    // the palette: the name typed, then the folder picked
    await book.attachNewNote(PDF, 'alone written', 'books', 'written');
    const made = await asked;
    expect(made).toBe('books/alone written.md');
    const m = await front(made!);
    expect(await text(made!)).toBe(`---\nwritten: ${m.written!.id}\npaper: ruled\nsheets: 1\npdf: alone.pdf\n---\n`);
    expect(docs()[made!]).toMatchObject({ pdf: made, of: PDF, written: { sheets: [1] } });
    expect(docs()[PDF]!.notes).toEqual(['books/alone written.md', 'books/typed.md']);
    expect(names.notesTabsOf(PDF, docs())).toEqual(['books/alone written.md', 'books/typed.md']);
    // beside the pages, as the tab it is, in front
    const at = besideAt(useApp.getState().panes, made!);
    expect(at).not.toBeNull();
    const pane = useApp.getState().panes.panes[at!.pane]!;
    expect(pane.tabs[pane.active]!.id).toBe(made);
    expect(names.notesPair(useApp.getState().panes, docs())).toBe(true);
    // no reading state is kept for it
    const reading = (await mem.stat(`${ROOT}/.ilmi/reading.json`)) ? Object.keys(JSON.parse(await mem.readText(`${ROOT}/.ilmi/reading.json`)) as object) : [];
    expect(reading).not.toContain(made);
  });

  it('cancelled, nothing is made; over a notebook\'s sheets, or pages with no PDF of their own, nothing is asked', async () => {
    const asked = written.addWritten(PDF);
    book.attachCancelled();
    expect(await asked).toBeNull();
    useApp.setState({ paletteOpen: false, noteAttach: null });
    expect(await written.addWritten('books/alone written.md')).toBeNull();
    expect(await written.addWritten('plain.md')).toBeNull();
    expect(useApp.getState().noteAttach).toBeNull();
  });

  it('a typed note is attached to a notebook as to a PDF: picked, it names the notebook', async () => {
    const nb = 'books/alone written.md';
    const asked = book.addNote(nb);
    expect(useApp.getState().noteAttach).toEqual({ pdf: nb, step: 'pick' });
    await book.attachNote(nb, 'plain.md');
    expect(await asked).toBe('plain.md');
    expect(await text('plain.md')).toBe('---\npdf: books/alone written.md\n---\n\nA note.\n');
    expect(docs()['plain.md']).toMatchObject({ of: nb });
    expect(docs()['plain.md']!.pdf).toBeUndefined();
    expect(docs()[nb]).toMatchObject({ note: 'plain.md', notes: ['plain.md'], of: PDF, pdf: nb });
    expect(names.pagesOf('plain.md', docs())).toBe(nb);
    expect(book.noteFor(nb)).toBe('plain.md');
  });

  it('the notebook renamed or moved, the note attached to it names it where it is; the note moved, its field follows and the notebook stays', async () => {
    const nb = await renameNode('books/alone written.md', 'by hand');
    expect(nb).toBe('books/by hand.md');
    expect((await front('plain.md')).pdf).toBe('books/by hand.md');
    const up = await moveNode(nb, '');
    expect(up).toBe('by hand.md');
    expect((await front('plain.md')).pdf).toBe('by hand.md');
    // its own field still finds the PDF it is a note of
    expect((await front(up)).pdf).toBe('books/alone.pdf');
    const moved = await moveNode('plain.md', 'books');
    expect((await front(moved)).pdf).toBe('../by hand.md');
    expect(await mem.stat(`${ROOT}/by hand.md`)).not.toBeNull();
    await moveNode(moved, '');
    await moveNode(up, 'books');
    await renameNode('books/by hand.md', 'alone written');
    expect((await front('plain.md')).pdf).toBe('books/alone written.md');
    await until(() => docs()['plain.md']?.of === 'books/alone written.md' && docs()['books/alone written.md']?.of === PDF, 'the index has them where they were');
  });

  it('a notebook that is there is attached to a PDF by its field, and let go again', async () => {
    const nb = 'books/alone written.md';
    await book.attachNote(OTHER, nb);
    await until(() => docs()[nb]?.of === OTHER, 'it names the other PDF');
    expect(docs()[OTHER]!.notes).toEqual([nb]);
    expect(docs()[PDF]!.notes).toEqual(['books/typed.md']);
    expect(docs()[nb]!.pdf).toBe(nb);
    expect(docs()[nb]!.notes).toEqual(['plain.md']);
  });
});
