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
/** What the native side says a drawing covers (`ink_bounds`: x, y, w, h in the sheet's points), and the drawings it was asked of. */
let bounds: (drawing: string) => [number, number, number, number] | null = () => null;
const bounded: string[] = [];
vi.mock('@tauri-apps/api/core', async (orig) => {
  const real = await orig<typeof import('@tauri-apps/api/core')>();
  return { ...real, invoke: (cmd: string, args?: Record<string, unknown>) => (cmd === 'ink_bounds' ? (async () => { const d = atob(args!.drawing as string); bounded.push(d); return bounds(d); })() : real.invoke(cmd, args)) };
});

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

  it('a sheet put in after another, and one moved to another place', () => {
    expect(written.sheetsWith([1, 3, 7], 8, 3)).toEqual([1, 3, 8, 7]);
    expect(written.sheetsWith([1, 3, 7], 8, 7)).toEqual([1, 3, 7, 8]);
    expect(written.sheetsWith([1, 3, 7], 8, 1)).toEqual([1, 8, 3, 7]);
    // after one that is not there: at the end
    expect(written.sheetsWith([1, 3, 7], 8, 2)).toEqual([1, 3, 7, 8]);
    expect(written.sheetsWith([], 1, 1)).toEqual([1]);
    // moved: the place is counted from 1, among them all
    expect(written.sheetsMoved([1, 3, 7, 8], 8, 1)).toEqual([8, 1, 3, 7]);
    expect(written.sheetsMoved([1, 3, 7, 8], 1, 3)).toEqual([3, 7, 1, 8]);
    expect(written.sheetsMoved([1, 3, 7, 8], 1, 4)).toEqual([3, 7, 8, 1]);
    expect(written.sheetsMoved([1, 3, 7, 8], 3, 2)).toEqual([1, 3, 7, 8]);
    // past either end it is the end
    expect(written.sheetsMoved([1, 3, 7], 3, 0)).toEqual([3, 1, 7]);
    expect(written.sheetsMoved([1, 3, 7], 3, 99)).toEqual([1, 7, 3]);
    // one that is not there moves nothing; what is given is never changed
    const given = [1, 3, 7];
    expect(written.sheetsMoved(given, 2, 1)).toEqual([1, 3, 7]);
    expect(written.sheetsMoved(given, 2, 1)).not.toBe(given);
    written.sheetsWith(given, 8, 1);
    written.sheetsMoved(given, 7, 1);
    expect(given).toEqual([1, 3, 7]);
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

describe('a notebook\'s pages put in order', () => {
  let nb: string;
  let id: string;
  const sheets = async () => (await front(nb)).written!.sheets;

  it('a page added after another takes the next number and lies after it; after one that is not there, at the end', async () => {
    nb = await written.createWritten('', 'ordered');
    await written.whenKnown(nb);
    id = (await front(nb)).written!.id;
    expect(await written.addSheet(nb)).toBe(2);
    expect(await written.addSheet(nb)).toBe(3);
    expect(await written.addSheetAfter(nb, 1)).toBe(4);
    expect(await sheets()).toEqual([1, 4, 2, 3]);
    expect(await written.addSheetAfter(nb, 3)).toBe(5);
    expect(await sheets()).toEqual([1, 4, 2, 3, 5]);
    expect(await written.addSheetAfter(nb, 9)).toBe(6);
    expect(await sheets()).toEqual([1, 4, 2, 3, 5, 6]);
    expect(await text(nb)).toBe(`---\nwritten: ${id}\npaper: ruled\nsheets: 1 4 2 3 5 6\n---\n`);
    await until(() => docs()[nb]?.written?.sheets.join() === '1,4,2,3,5,6', 'the index has them in that order');
    const plain = await text('plain.md');
    await expect(written.addSheetAfter('plain.md', 1)).rejects.toThrow('not written notes');
    expect(await text('plain.md')).toBe(plain);
  });

  it('a page made again lies right after itself under a number of its own, with a copy of the strokes', async () => {
    await mem.setPageInk(id, 4, [stroke(1), stroke(2)]);
    told = 0;
    expect(await written.duplicateSheet(nb, 4)).toBe(7);
    expect(await sheets()).toEqual([1, 4, 7, 2, 3, 5, 6]);
    expect(await mem.pageInk(id, 7)).toEqual(await mem.pageInk(id, 4));
    expect((await mem.pageInk(id, 7)).map((s) => s.stroke).sort()).toEqual(['s1', 's2']);
    await until(() => told === 1, 'the sync is told of the strokes');
    // each is its own from then on
    await mem.setPageInk(id, 7, [stroke(1)]);
    expect(await mem.pageInk(id, 4)).toHaveLength(2);
    // a bare page made again is one more bare page, and the sync hears of no strokes
    told = 0;
    expect(await written.duplicateSheet(nb, 6)).toBe(8);
    expect(await sheets()).toEqual([1, 4, 7, 2, 3, 5, 6, 8]);
    expect(await mem.pageInk(id, 8)).toEqual([]);
    expect(await mem.inkedPages(id)).toEqual([4, 7]);
    await new Promise((r) => setTimeout(r, 20));
    expect(told).toBe(0);
    // one that is not there, and a note that is no notebook: nothing
    await expect(written.duplicateSheet(nb, 99)).rejects.toThrow('no sheet 99');
    await expect(written.duplicateSheet('plain.md', 1)).rejects.toThrow('not written notes');
    expect(await sheets()).toEqual([1, 4, 7, 2, 3, 5, 6, 8]);
  });

  it('a passage kept on a page stays the first one\'s when the page is made again', async () => {
    const kept = await passages.keepPassage(nb, [{ page: 4, x: 0.1, y: 0.2, w: 0.5, h: 0.1 }]);
    const made = await written.duplicateSheet(nb, 4);
    expect(made).toBe(9);
    expect(Object.keys(parseMarks(await text(marksPath(id))))).toEqual([`s-${kept!.boxes}`]);
    expect((await mem.pageInk(id, 9)).map((s) => s.stroke).sort()).toEqual(['s1', 's2']);
    await passages.putPassage(id, kept!.boxes, null);
    await written.removeSheet(nb, 9);
    expect(await sheets()).toEqual([1, 4, 7, 2, 3, 5, 6, 8]);
  });

  it('a page moved changes nothing but where it lies', async () => {
    const was = await mem.pageInk(id, 4);
    await written.moveSheet(nb, 8, 1);
    expect(await sheets()).toEqual([8, 1, 4, 7, 2, 3, 5, 6]);
    await written.moveSheet(nb, 4, 8);
    expect(await sheets()).toEqual([8, 1, 7, 2, 3, 5, 6, 4]);
    await written.moveSheet(nb, 4, 3);
    expect(await sheets()).toEqual([8, 1, 4, 7, 2, 3, 5, 6]);
    expect(await mem.pageInk(id, 4)).toEqual(was);
    expect(await mem.inkedPages(id)).toEqual([4, 7]);
    await until(() => docs()[nb]?.written?.sheets.join() === '8,1,4,7,2,3,5,6', 'the index has the order');
    // to where it lies already, and a sheet that is not there: the file is not written
    const before = await text(nb);
    await written.moveSheet(nb, 4, 3);
    await written.moveSheet(nb, 99, 1);
    expect(await text(nb)).toBe(before);
    await expect(written.moveSheet('plain.md', 1, 2)).rejects.toThrow('not written notes');
  });
});

describe('a notebook\'s page setup', () => {
  let nb: string;
  let id: string;
  const NEW = { paper: 'ruled', rule: null, margin: null, marginRight: null, top: null, bottom: null, size: null, turn: null, pageless: false, color: null, line: null } as const;
  const head = (lines: string[]) => ['---', `written: ${id}`, ...lines, '---', ''].join('\n');

  it('is what its file says, and nothing where the file says nothing', async () => {
    nb = await written.createWritten('', 'set up');
    await written.whenKnown(nb);
    id = (await front(nb)).written!.id;
    expect(written.setupOf((await front(nb)).written!)).toEqual(NEW);
    expect(written.setupOf({ id, paper: 'grid', sheets: [1], rule: 30, margin: 90, top: 100, size: 'a4', turn: 'landscape', pageless: true })).toEqual({ paper: 'grid', rule: 30, margin: 90, marginRight: null, top: 100, bottom: null, size: 'a4', turn: 'landscape', pageless: true, color: null, line: null });
    // a margin at the right and the room at the foot, each as the file has it
    expect(written.setupOf({ id, paper: 'ruled', sheets: [1], marginRight: 72, bottom: 40 })).toEqual({ ...NEW, marginRight: 72, bottom: 40 });
    expect(written.setupOf({ id, paper: 'ruled', sheets: [1], margin: 90, marginRight: 72, top: 100, bottom: 0 })).toEqual({ ...NEW, margin: 90, marginRight: 72, top: 100, bottom: 0 });
    expect(written.setupOf({ id, paper: 'ruled', sheets: [1], color: '#fbf6e9', line: '#c9cdd2' })).toEqual({ ...NEW, color: '#fbf6e9', line: '#c9cdd2' });
  });

  it('changed, the file says only what was chosen: a measure the paper has anyway is not written', async () => {
    await written.setSetup(nb, { rule: 18 });
    expect(await text(nb)).toBe(head(['paper: ruled', 'sheets: 1', 'paper-rule: 18']));
    // the rest of it is as it was
    await written.setSetup(nb, { margin: 90, top: 100 });
    expect((await front(nb)).written).toEqual({ id, paper: 'ruled', sheets: [1], rule: 18, margin: 90, top: 100 });
    await until(() => docs()[nb]?.written?.margin === 90, 'the index has the setup');
    // wide again, an inch down: what a ruled sheet has anyway
    await written.setSetup(nb, { rule: 24, top: 72 });
    expect((await front(nb)).written).toEqual({ id, paper: 'ruled', sheets: [1], margin: 90 });
    await written.setSetup(nb, { size: 'a4', turn: 'landscape', pageless: true });
    expect((await front(nb)).written).toEqual({ id, paper: 'ruled', sheets: [1], margin: 90, size: 'a4', turn: 'landscape', pageless: true });
    await written.setSetup(nb, { size: null, turn: null, pageless: false, margin: null });
    expect(await text(nb)).toBe(head(['paper: ruled', 'sheets: 1']));
  });

  it('a paper colour and a line colour are written as chosen, in lowercase, and taken away again; one that is no colour is none', async () => {
    await written.setSetup(nb, { color: '#FBF6E9' });
    expect(await text(nb)).toBe(head(['paper: ruled', 'sheets: 1', 'paper-color: #fbf6e9']));
    await written.setSetup(nb, { line: '#c9cdd2' });
    expect(await text(nb)).toBe(head(['paper: ruled', 'sheets: 1', 'paper-color: #fbf6e9', 'paper-line: #c9cdd2']));
    expect((await front(nb)).written).toEqual({ id, paper: 'ruled', sheets: [1], color: '#fbf6e9', line: '#c9cdd2' });
    // a change to something else leaves them
    await written.setSetup(nb, { rule: 18 });
    expect((await front(nb)).written).toEqual({ id, paper: 'ruled', sheets: [1], rule: 18, color: '#fbf6e9', line: '#c9cdd2' });
    // on blank paper the line's colour is kept for when it is ruled again
    await written.setSetup(nb, { paper: 'blank' });
    expect((await front(nb)).written).toEqual({ id, paper: 'blank', sheets: [1], color: '#fbf6e9', line: '#c9cdd2' });
    await written.setSetup(nb, { paper: 'ruled', rule: null, color: 'cream', line: '#fff' });
    expect(await text(nb)).toBe(head(['paper: ruled', 'sheets: 1']));
    await written.setSetup(nb, { color: '#1c1c1e', line: '#b5d2f2' });
    await written.setSetup(nb, { color: null, line: null });
    expect(await text(nb)).toBe(head(['paper: ruled', 'sheets: 1']));
  });

  it('the room at the top is a ruled sheet\'s alone, a margin any paper\'s; a grid\'s spacing is its own; blank paper has none', async () => {
    await written.setSetup(nb, { rule: 30, margin: 90, top: 100 });
    await written.setSetup(nb, { paper: 'grid' });
    expect((await front(nb)).written).toEqual({ id, paper: 'grid', sheets: [1], rule: 30, margin: 90 });
    // a grid's own pitch is not written
    await written.setSetup(nb, { rule: 20 });
    expect(await text(nb)).toBe(head(['paper: grid', 'sheets: 1', 'paper-margin: 90']));
    await written.setSetup(nb, { paper: 'dotted', rule: 28.35, margin: 100 });
    expect((await front(nb)).written).toEqual({ id, paper: 'dotted', sheets: [1], rule: 28.35, margin: 100 });
    // blank paper keeps its margin rule, and nothing of a spacing
    await written.setSetup(nb, { paper: 'blank' });
    expect(await text(nb)).toBe(head(['paper: blank', 'sheets: 1', 'paper-margin: 100']));
    await written.setSetup(nb, { paper: 'ruled' });
    expect(await text(nb)).toBe(head(['paper: ruled', 'sheets: 1', 'paper-margin: 100']));
    await written.setSetup(nb, { margin: null });
    expect(await text(nb)).toBe(head(['paper: ruled', 'sheets: 1']));
  });

  it('a margin rule at the right is written beside the left one\'s, on any paper, and each is taken away alone', async () => {
    await written.setSetup(nb, { marginRight: 72 });
    expect(await text(nb)).toBe(head(['paper: ruled', 'sheets: 1', 'paper-margin-right: 72']));
    expect((await front(nb)).written).toEqual({ id, paper: 'ruled', sheets: [1], marginRight: 72 });
    await until(() => docs()[nb]?.written?.marginRight === 72, 'the index has the right margin');
    await written.setSetup(nb, { margin: 90 });
    expect((await front(nb)).written).toEqual({ id, paper: 'ruled', sheets: [1], margin: 90, marginRight: 72 });
    expect(written.setupOf((await front(nb)).written!)).toEqual({ ...NEW, margin: 90, marginRight: 72 });
    for (const paper of ['grid', 'dotted', 'blank'] as const) {
      await written.setSetup(nb, { paper });
      expect((await front(nb)).written, paper).toEqual({ id, paper, sheets: [1], margin: 90, marginRight: 72 });
    }
    // the left one gone, the right one stands; and the other way round
    await written.setSetup(nb, { margin: null });
    expect((await front(nb)).written).toEqual({ id, paper: 'blank', sheets: [1], marginRight: 72 });
    await written.setSetup(nb, { margin: 60, marginRight: null });
    expect((await front(nb)).written).toEqual({ id, paper: 'blank', sheets: [1], margin: 60 });
    await written.setSetup(nb, NEW);
    expect(await text(nb)).toBe(head(['paper: ruled', 'sheets: 1']));
  });

  it('the room at a sheet\'s foot is a ruled sheet\'s alone, and not written when it is a rule\'s, which a sheet has anyway', async () => {
    await written.setSetup(nb, { bottom: 60 });
    expect(await text(nb)).toBe(head(['paper: ruled', 'sheets: 1', 'paper-bottom: 60']));
    expect((await front(nb)).written).toEqual({ id, paper: 'ruled', sheets: [1], bottom: 60 });
    expect(written.setupOf((await front(nb)).written!)).toEqual({ ...NEW, bottom: 60 });
    // none at all is said
    await written.setSetup(nb, { bottom: 0 });
    expect((await front(nb)).written).toEqual({ id, paper: 'ruled', sheets: [1], bottom: 0 });
    // a rule's room: a new notebook's 24 points
    await written.setSetup(nb, { bottom: 24 });
    expect(await text(nb)).toBe(head(['paper: ruled', 'sheets: 1']));
    // with another spacing it is that spacing that is not written
    await written.setSetup(nb, { rule: 30, bottom: 24 });
    expect((await front(nb)).written).toEqual({ id, paper: 'ruled', sheets: [1], rule: 30, bottom: 24 });
    await written.setSetup(nb, { bottom: 30 });
    expect((await front(nb)).written).toEqual({ id, paper: 'ruled', sheets: [1], rule: 30 });
    // on a grid, dots or blank paper there is none
    await written.setSetup(nb, { rule: null, bottom: 60, top: 100 });
    for (const paper of ['grid', 'dotted', 'blank'] as const) {
      await written.setSetup(nb, { paper, bottom: 60 });
      expect((await front(nb)).written, paper).toEqual({ id, paper, sheets: [1] });
    }
    await written.setSetup(nb, NEW);
    expect(await text(nb)).toBe(head(['paper: ruled', 'sheets: 1']));
  });

  it('a measure is held to what it may be, to a hundredth of a point', async () => {
    await written.setSetup(nb, { rule: 3, margin: 5, marginRight: 5, top: 999, bottom: 999 });
    expect((await front(nb)).written).toMatchObject({ rule: 8, margin: 18, marginRight: 18, top: 300, bottom: 300 });
    await written.setSetup(nb, { rule: 500, margin: 500, marginRight: 500, top: -4, bottom: -4 });
    expect((await front(nb)).written).toMatchObject({ rule: 72, margin: 300, marginRight: 300, top: 0, bottom: 0 });
    await written.setSetup(nb, { rule: 19.8444, margin: 77.777, marginRight: 55.554, top: Number.NaN, bottom: Number.NaN });
    expect((await front(nb)).written).toEqual({ id, paper: 'ruled', sheets: [1], rule: 19.84, margin: 77.78, marginRight: 55.55 });
    await written.setSetup(nb, { marginRight: Number.POSITIVE_INFINITY, bottom: 33.336 });
    expect((await front(nb)).written).toEqual({ id, paper: 'ruled', sheets: [1], rule: 19.84, margin: 77.78, bottom: 33.34 });
    await written.setSetup(nb, NEW);
    expect(await text(nb)).toBe(head(['paper: ruled', 'sheets: 1']));
  });

  it('what is written stays where it is, and the sheets as they were; a note that is no notebook is not touched', async () => {
    await written.addSheet(nb);
    await mem.setPageInk(id, 2, [stroke(1)]);
    await written.setSetup(nb, { paper: 'grid', size: 'a4', pageless: true });
    expect((await front(nb)).written!.sheets).toEqual([1, 2]);
    expect((await mem.pageInk(id, 2)).map((s) => s.stroke)).toEqual(['s1']);
    await written.setSetup(nb, NEW);
    const plain = await text('plain.md');
    await expect(written.setSetup('plain.md', { paper: 'grid' })).rejects.toThrow('not written notes');
    expect(await text('plain.md')).toBe(plain);
  });

  it('the setup kept for this device\'s new notebooks is read back, and what it says wrongly is as a new notebook has it', () => {
    expect(written.parseSetup(null)).toBeNull();
    expect(written.parseSetup('')).toBeNull();
    expect(written.parseSetup('not json')).toBeNull();
    expect(written.parseSetup('null')).toBeNull();
    expect(written.parseSetup('3')).toBeNull();
    const kept = { paper: 'dotted', rule: 28.35, margin: 90, marginRight: 72, top: 100, bottom: 40, size: 'a4', turn: 'landscape', pageless: true, color: '#fbf6e9', line: '#c9cdd2' };
    expect(written.parseSetup(JSON.stringify(kept))).toEqual(kept);
    expect(written.parseSetup('{}')).toEqual(NEW);
    expect(written.parseSetup(JSON.stringify({ paper: 'lined', rule: 2, margin: 'wide', marginRight: 'wide', top: 999, bottom: 999, size: 'letter', turn: 'portrait', pageless: 'yes', color: 'cream', line: 7 }))).toEqual(NEW);
    // one kept before there was a right margin or a foot's room has neither
    expect(written.parseSetup(JSON.stringify({ paper: 'ruled', rule: 18, margin: 90, top: 100 }))).toEqual({ ...NEW, rule: 18, margin: 90, top: 100 });
    // each held to what it may be: a right margin from 18 points to 300, the room at the foot from none to 300
    const one = (t: Record<string, unknown>) => { const got = written.parseSetup(JSON.stringify(t))!; return [got.marginRight, got.bottom]; };
    expect([one({ marginRight: 18, bottom: 0 }), one({ marginRight: 300, bottom: 300 }), one({ marginRight: 17.9, bottom: -1 }), one({ marginRight: 300.1, bottom: 301 }), one({ marginRight: null, bottom: '24' })]).toEqual([[18, 0], [300, 300], [null, null], [null, null], [null, null]]);
    // a colour kept in capitals is the colour
    expect(written.parseSetup(JSON.stringify({ color: '#FBF6E9', line: '#C9CDD2' }))).toEqual({ ...NEW, color: '#fbf6e9', line: '#c9cdd2' });
  });

  it('`use for new notebooks`: a notebook made on this device from then on starts with it; with none kept, ruled Letter', async () => {
    expect(written.SETUP_KEY).toBe('ilmi.paper');
    localStorage.removeItem(written.SETUP_KEY);
    expect(written.defaultSetup()).toBeNull();
    try {
      written.keepSetup({ ...NEW, paper: 'grid', rule: 28.35, size: 'a4' });
      expect(JSON.parse(localStorage.getItem(written.SETUP_KEY)!)).toEqual({ ...NEW, paper: 'grid', rule: 28.35, size: 'a4' });
      expect(written.defaultSetup()).toEqual({ ...NEW, paper: 'grid', rule: 28.35, size: 'a4' });
      const made = await written.createWritten('', 'started so');
      const m = (await front(made)).written!;
      expect(m).toEqual({ id: m.id, paper: 'grid', sheets: [1], rule: 28.35, size: 'a4' });
      // the notebook it was kept from is not changed by it, nor is one there already
      expect((await front(nb)).written).toEqual({ id, paper: 'ruled', sheets: [1, 2] });
      await removeNode(made);
    } finally {
      localStorage.removeItem(written.SETUP_KEY);
    }
    // its colours go with it
    try {
      written.keepSetup({ ...NEW, color: '#1c1c1e', line: '#b5d2f2' });
      const dark = await written.createWritten('', 'started dark');
      const d = (await front(dark)).written!;
      expect(d).toEqual({ id: d.id, paper: 'ruled', sheets: [1], color: '#1c1c1e', line: '#b5d2f2' });
      await removeNode(dark);
    } finally {
      localStorage.removeItem(written.SETUP_KEY);
    }
    // and its margins, the room at its foot
    try {
      written.keepSetup({ ...NEW, margin: 90, marginRight: 72, bottom: 40 });
      expect(written.defaultSetup()).toEqual({ ...NEW, margin: 90, marginRight: 72, bottom: 40 });
      const edged = await written.createWritten('', 'started with margins');
      const e = (await front(edged)).written!;
      expect(e).toEqual({ id: e.id, paper: 'ruled', sheets: [1], margin: 90, marginRight: 72, bottom: 40 });
      await removeNode(edged);
    } finally {
      localStorage.removeItem(written.SETUP_KEY);
    }
    const plainly = await written.createWritten('', 'started plainly');
    const m = (await front(plainly)).written!;
    expect(m).toEqual({ id: m.id, paper: 'ruled', sheets: [1] });
    await removeNode(plainly);
  });
});

describe('how far down a pageless notebook\'s long sheet its writing reaches', () => {
  const FOOT = 'f'.repeat(32);
  const H = 792;
  /** What each stroke covers on its own sheet: the drawing's bounds are those of its strokes together. */
  let boxes: Record<string, [number, number, number, number]> = {};
  const over = (drawing: string): [number, number, number, number] | null => {
    const got = drawing.split('\n').slice(1).map((l) => boxes[l.split(' ')[0]!]).filter((b) => b !== undefined);
    if (!got.length) return null;
    const [x0, y0, x1, y1] = [Math.min(...got.map((b) => b[0])), Math.min(...got.map((b) => b[1])), Math.max(...got.map((b) => b[0] + b[2])), Math.max(...got.map((b) => b[1] + b[3]))];
    return [x0, y0, x1 - x0, y1 - y0];
  };
  const clear = async () => { for (const n of [1, 2, 3, 5, 9]) await mem.setPageInk(FOOT, n, []); bounded.length = 0; boxes = {}; bounds = over; };

  it('is nothing with nothing written, and the drawing is not asked about', async () => {
    await clear();
    expect(await written.inkFoot(FOOT, [1, 2, 3], H)).toBe(0);
    expect(await written.inkFoot(FOOT, [], H)).toBe(0);
    expect(bounded).toEqual([]);
  });

  it('is the foot of what is written on a sheet, as far down the long sheet as that sheet begins: by its place among the sheets, not its number', async () => {
    await clear();
    await mem.setPageInk(FOOT, 1, [stroke(1), stroke(2)]);
    boxes = { s1: [40, 100, 200, 30], s2: [60, 300, 100, 150] };
    expect(await written.inkFoot(FOOT, [1], H)).toBe(450);
    expect(await written.inkFoot(FOOT, [1, 2, 3], H)).toBe(450);
    // the same sheet third of five: two sheets down
    expect(await written.inkFoot(FOOT, [5, 9, 1, 2, 3], H)).toBe(2 * H + 450);
    // an A4 sheet is longer
    expect(await written.inkFoot(FOOT, [5, 1], 842)).toBe(842 + 450);
    // what is asked about is the sheet's drawing, whole
    expect(bounded.every((d) => d.startsWith('drawing\ns1 ') && d.includes('\ns2 '))).toBe(true);
    // a sheet that is none of the notebook's is not looked at
    bounded.length = 0;
    expect(await written.inkFoot(FOOT, [2, 3], H)).toBe(0);
    expect(bounded).toEqual([]);
  });

  it('a stroke kept on one sheet may run on over the next: the last two sheets written on are looked at, and no more', async () => {
    await clear();
    await mem.setPageInk(FOOT, 1, [stroke(1)]);
    await mem.setPageInk(FOOT, 2, [stroke(2)]);
    await mem.setPageInk(FOOT, 3, [stroke(3)]);
    // sheet 2's stroke begins low on it and ends 300 points down sheet 3; sheet 3's own is near its head
    boxes = { s1: [0, 0, 10, 5000], s2: [40, 700, 100, 392], s3: [40, 20, 100, 60] };
    expect(await written.inkFoot(FOOT, [1, 2, 3], H)).toBe(H + 1092);
    expect(bounded.map((d) => d.split('\n')[1]!.split(' ')[0])).toEqual(['s3', 's2']);
    // bare sheets after them are passed over
    bounded.length = 0;
    expect(await written.inkFoot(FOOT, [1, 2, 3, 5, 9], H)).toBe(H + 1092);
    expect(bounded.length).toBe(2);
    // the lower of the two, whichever it is
    boxes = { ...boxes, s3: [40, 20, 100, 500] };
    expect(await written.inkFoot(FOOT, [1, 2, 3], H)).toBe(2 * H + 520);
    // in the order of the sheets as they lie
    expect(await written.inkFoot(FOOT, [3, 2, 1], H)).toBe(2 * H + 5000);
  });

  it('a drawing that covers nothing, or cannot be asked about, counts for nothing', async () => {
    await clear();
    await mem.setPageInk(FOOT, 1, [stroke(1)]);
    await mem.setPageInk(FOOT, 2, [stroke(2)]);
    boxes = { s1: [0, 100, 10, 100] };
    // sheet 2's drawing has no bounds: sheet 1's stand
    expect(await written.inkFoot(FOOT, [1, 2], H)).toBe(200);
    bounds = (d) => { if (d.includes('\ns2 ')) throw new Error('no canvas'); return over(d); };
    expect(await written.inkFoot(FOOT, [1, 2], H)).toBe(200);
    bounds = () => null;
    expect(await written.inkFoot(FOOT, [1, 2], H)).toBe(0);
    await clear();
    bounds = () => null;
  });
});

describe('a sheet lost from a pageless notebook\'s list in a merge', () => {
  it('is listed again when strokes are kept under a number past the highest listed, lowest first; pages are left alone', async () => {
    const path = await written.createWritten('', 'healed');
    const m = (await front(path)).written!;
    // nothing past the list: as it is
    expect(await written.healSheets(path, m.id, m.sheets)).toEqual([1]);
    await mem.setPageInk(m.id, 3, [stroke(31)]);
    await mem.setPageInk(m.id, 2, [stroke(21)]);
    // a notebook of pages keeps its list: only a pageless one grows by sheets of its own accord
    expect(await written.healSheets(path, m.id, m.sheets)).toEqual([1]);
    expect((await front(path)).written!.sheets).toEqual([1]);
    await written.setSetup(path, { pageless: true });
    expect(await written.healSheets(path, m.id, [1])).toEqual([1, 2, 3]);
    expect((await front(path)).written!.sheets).toEqual([1, 2, 3]);
    // and once they are listed there is nothing to do
    expect(await written.healSheets(path, m.id, [1, 2, 3])).toEqual([1, 2, 3]);
    await mem.setPageInk(m.id, 2, []);
    await mem.setPageInk(m.id, 3, []);
    await removeNode(path);
  });
});
