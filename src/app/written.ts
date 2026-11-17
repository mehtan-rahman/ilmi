// Written notes (milestone 82): a note whose pages are paper. A `.md` with a
// `written` field (FORMAT.md §3, *Written notes*) opens as its sheets in the
// `Pdf` lens, and its id stands wherever a PDF's SHA-256 does: its strokes
// are the store's page ink under `p.<id>.<sheet>`, its passages entries of
// `.ilmi/marks/<id>.json`. Here: making one, its sheets and its paper.

import { PAPERS, meta, pagesLabel, parseBoxes, setField, type Box, type PaperKind } from '../format/index.js';
import { passageMarksOf } from '../pdf/index.js';
import { isPdfPath, newId, passageId, type InkStroke, type PassageMark, type StoreFs } from '../vault/index.js';
import { askNote, loadMarks, openNotes, setMark } from './book.js';
import { isPagesPath, isWritten, pdfForNotes } from './names.js';
import { useApp, type DocInfo } from './store.js';
import { currentVault } from './vault.js';

export { PAPERS, type PaperKind, isPagesPath, isWritten };

/** Every sheet is portrait Letter, in points. */
export const SHEET_W = 612, SHEET_H = 792;

/** Where sheet `sheet` lies among a notebook's sheets, counted from 1 as the lens counts pages; null when it is not one of them. */
export function placeOfSheet(sheets: readonly number[], sheet: number): number | null {
  const at = sheets.indexOf(sheet);
  return at < 0 ? null : at + 1;
}

/** The sheet that lies at `place` (from 1) among a notebook's sheets; null past either end. */
export const sheetAt = (sheets: readonly number[], place: number): number | null => sheets[place - 1] ?? null;

/**
 * A passage's pages as words (`p. 2`, `pp. 2–3`), as the lens over the
 * document counts them: a PDF's boxes say the page; a notebook's name the
 * sheet by its own number, and are said by where the sheet lies now (a
 * sheet no longer there by its number).
 */
export function boxesLabel(info: DocInfo | undefined, boxes: readonly Box[]): string {
  const sheets = info?.written?.sheets;
  return pagesLabel(sheets ? boxes.map((b) => ({ ...b, page: placeOfSheet(sheets, b.page) ?? b.page })) : boxes);
}

/** The number a notebook's next sheet takes: one past the highest there. */
export const nextSheet = (sheets: readonly number[]): number => Math.max(0, ...sheets) + 1;

function need() {
  const vault = currentVault();
  if (!vault) throw new Error('no vault open');
  return vault;
}

/** The store's own ways to a page's strokes, when the collection is a store. */
function inkOf(): Pick<StoreFs, 'pageInk' | 'setPageInk'> | null {
  const fs = currentVault()?.fs as Partial<StoreFs> | undefined;
  return fs?.pageInk && fs.setPageInk ? (fs as StoreFs) : null;
}

/** Strokes are no document's write: the sync is told of them here, as `ink.ts` tells it of a canvas's. */
const wrote = (): void => { void import('./crdt.js').then((m) => m.crdtWrote(), () => {}); };

/** A new notebook named `name` in `dir`, one sheet, ruled; attached to `pdf` (vault-relative) when given. Its path. */
export function createWritten(dir: string, name: string, pdf?: string): Promise<string> {
  return need().createWritten(dir, name, newId(), pdf);
}

/** Until the app's docs show the notebook at `path` (the tree walked, the index told), so what opens next opens as its sheets. Resolves to `path`. */
export function whenKnown(path: string): Promise<string> {
  return new Promise((resolve) => {
    const done = () => { off(); clearTimeout(t); resolve(path); };
    const t = setTimeout(done, 3000);
    const off = useApp.subscribe((s) => { if (s.docs[path]?.written) done(); });
    if (useApp.getState().docs[path]?.written) done();
  });
}

/** One more sheet at the end. Its number. */
export async function addSheet(path: string): Promise<number> {
  let made = 0;
  await need().update(path, (doc) => {
    const w = meta(doc).written;
    if (!w) throw new Error(`${path}: not written notes`);
    made = nextSheet(w.sheets);
    setField(doc, 'sheets', [...w.sheets, made]);
  });
  return made;
}

/**
 * A sheet taken out, with its strokes and the passages on it (any of whose
 * boxes is on it). A notebook keeps at least one sheet: its last one taken
 * out leaves a fresh blank one, with the next number. Resolves to an undo
 * that puts the sheet back at its place, with its strokes and those
 * passages, and takes that fresh one away again.
 */
export async function removeSheet(path: string, sheet: number): Promise<() => Promise<void>> {
  const vault = need();
  const ink = inkOf();
  let id = '';
  let at = -1;
  let fresh: number | null = null;
  await vault.update(path, (doc) => {
    const w = meta(doc).written;
    if (!w) throw new Error(`${path}: not written notes`);
    id = w.id;
    at = w.sheets.indexOf(sheet);
    if (at < 0) throw new Error(`${path}: no sheet ${sheet}`);
    const rest = w.sheets.filter((n) => n !== sheet);
    fresh = rest.length ? null : nextSheet(w.sheets);
    setField(doc, 'sheets', fresh === null ? rest : [fresh]);
  });
  const strokes: InkStroke[] = ink ? await ink.pageInk(id, sheet) : [];
  if (ink && strokes.length) { await ink.setPageInk(id, sheet, []); wrote(); }
  const gone: PassageMark[] = passageMarksOf(await loadMarks(id)).map(([, m]) => m).filter((m) => (parseBoxes(m.boxes) ?? []).some((b) => b.page === sheet));
  for (const m of gone) await setMark(id, passageId(m.boxes), null);
  return async () => {
    // the fresh sheet that stood in for the last one goes, unless it has been written on since
    const blank = fresh === null || !ink || (await ink.pageInk(id, fresh)).length === 0;
    await vault.update(path, (doc) => {
      const w = meta(doc).written;
      if (!w || w.sheets.includes(sheet)) return;
      const rest = blank && fresh !== null && w.sheets.length === 1 && w.sheets[0] === fresh ? [] : [...w.sheets];
      rest.splice(Math.min(at, rest.length), 0, sheet);
      setField(doc, 'sheets', rest);
    });
    if (ink && strokes.length) {
      // with whatever has been written on a sheet of that number since
      const have = await ink.pageInk(id, sheet);
      const names = new Set(have.map((s) => s.stroke));
      await ink.setPageInk(id, sheet, [...have, ...strokes.filter((s) => !names.has(s.stroke))]);
      wrote();
    }
    for (const m of gone) await setMark(id, passageId(m.boxes), m);
  };
}

/** The notebook's paper. */
export async function setPaper(path: string, paper: PaperKind): Promise<void> {
  await need().update(path, (doc) => {
    if (!meta(doc).written) throw new Error(`${path}: not written notes`);
    setField(doc, 'paper', paper);
  });
}

/**
 * `+` in the bar over a PDF's pages: a written notebook for the pages' PDF,
 * named and placed by the same pick-a-folder flow `new note` uses, then open
 * beside the pages as one more tab. Null when cancelled, and over pages
 * whose PDF is no document of its own, or that are a notebook's sheets (a
 * notebook is no note of another).
 */
export async function addWritten(pagesId: string): Promise<string | null> {
  const pdf = pdfForNotes(pagesId, useApp.getState().docs);
  if (pdf === null || !isPdfPath(pdf)) return null;
  const note = await askNote(pdf, 'written');
  if (note === null) return null;
  await openNotes(pagesId, note);
  return note;
}
