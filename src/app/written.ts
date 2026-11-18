// Written notes (milestone 82): a note whose pages are paper. A `.md` with a
// `written` field (FORMAT.md §3, *Written notes*) opens as its sheets in the
// `Pdf` lens, and its id stands wherever a PDF's SHA-256 does: its strokes
// are the store's page ink under `p.<id>.<sheet>`, its passages entries of
// `.ilmi/marks/<id>.json`. Here: making one, its sheets (added at the end
// or after another, taken out, made again, moved: milestone 85) and its paper.

import { PAPERS, PAPER_MARGIN_RANGE, PAPER_RULE_RANGE, PAPER_TOP_RANGE, meta, pagesLabel, parseBoxes, setField, type Box, type PaperKind, type WrittenMeta } from '../format/index.js';
import { RULE_TOP, paperHex, ruleOf } from './paper.js';
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
export async function createWritten(dir: string, name: string, pdf?: string): Promise<string> {
  const path = await need().createWritten(dir, name, newId(), pdf);
  // with the page setup this device keeps for new notebooks, when it keeps one
  const mine = defaultSetup();
  if (mine) await setSetup(path, mine).catch(console.error);
  return path;
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

/** One more sheet after `after` (one of the notebook's sheets); at the end when that is not there. Its number. */
export async function addSheetAfter(path: string, after: number): Promise<number> {
  let made = 0;
  await need().update(path, (doc) => {
    const w = meta(doc).written;
    if (!w) throw new Error(`${path}: not written notes`);
    made = nextSheet(w.sheets);
    setField(doc, 'sheets', sheetsWith(w.sheets, made, after));
  });
  return made;
}

/** `sheets` with `made` put in after `after`; at the end when `after` is not among them. */
export function sheetsWith(sheets: readonly number[], made: number, after: number): number[] {
  const at = sheets.indexOf(after);
  const out = [...sheets];
  out.splice(at < 0 ? out.length : at + 1, 0, made);
  return out;
}

/** `sheets` with `sheet` moved to lie at `place` (from 1) among them; as they are when it is not one of them. */
export function sheetsMoved(sheets: readonly number[], sheet: number, place: number): number[] {
  if (!sheets.includes(sheet)) return [...sheets];
  const rest = sheets.filter((n) => n !== sheet);
  rest.splice(Math.max(0, Math.min(rest.length, place - 1)), 0, sheet);
  return rest;
}

/**
 * A sheet again, right after itself: a new sheet with a number of its own
 * and a copy of the strokes (the passages kept from the first stay the
 * first's). Its number.
 */
export async function duplicateSheet(path: string, sheet: number): Promise<number> {
  const ink = inkOf();
  let id = '';
  let made = 0;
  await need().update(path, (doc) => {
    const w = meta(doc).written;
    if (!w) throw new Error(`${path}: not written notes`);
    if (!w.sheets.includes(sheet)) throw new Error(`${path}: no sheet ${sheet}`);
    id = w.id;
    made = nextSheet(w.sheets);
    setField(doc, 'sheets', sheetsWith(w.sheets, made, sheet));
  });
  const strokes: InkStroke[] = ink ? await ink.pageInk(id, sheet) : [];
  if (ink && strokes.length) { await ink.setPageInk(id, made, strokes); wrote(); }
  return made;
}

/** A sheet moved to lie at `place` (from 1) among the notebook's sheets: nothing of it changes but where it lies. */
export async function moveSheet(path: string, sheet: number, place: number): Promise<void> {
  await need().update(path, (doc) => {
    const w = meta(doc).written;
    if (!w) throw new Error(`${path}: not written notes`);
    const next = sheetsMoved(w.sheets, sheet, place);
    if (next.join(' ') !== w.sheets.join(' ')) setField(doc, 'sheets', next);
  });
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

/** A notebook's page setup, as it is chosen: each as the front-matter has it, null for what it does not say. */
export interface Setup {
  paper: PaperKind;
  rule: number | null;
  margin: number | null;
  top: number | null;
  size: 'a4' | null;
  turn: 'landscape' | null;
  pageless: boolean;
  /** The paper's colour, `#rrggbb`; null where it follows the theme. */
  color: string | null;
  /** The colour of the rules, the grid's lines and the dots, `#rrggbb`; null for the paper's own. */
  line: string | null;
}

/** A notebook's page setup. */
export const setupOf = (w: WrittenMeta): Setup => ({ paper: w.paper, rule: w.rule ?? null, margin: w.margin ?? null, top: w.top ?? null, size: w.size ?? null, turn: w.turn ?? null, pageless: !!w.pageless, color: w.color ?? null, line: w.line ?? null });

/**
 * Some of a notebook's page setup changed (milestone 85). Only the paper
 * moves: what is written is kept in the sheet's points from its top left
 * and stays where it is, under a new ruling, on a sheet of another size, or
 * on sheets that run on as one. A measure that is what the paper has anyway
 * is not written: the file says only what was chosen.
 */
export async function setSetup(path: string, change: Partial<Setup>): Promise<void> {
  await need().update(path, (doc) => {
    const w = meta(doc).written;
    if (!w) throw new Error(`${path}: not written notes`);
    const next = { ...setupOf(w), ...change };
    const points = (v: number | null, range: readonly [number, number]): number | null => (v === null || !Number.isFinite(v) ? null : Math.round(Math.min(range[1], Math.max(range[0], v)) * 100) / 100);
    setField(doc, 'paper', next.paper);
    const rule = points(next.rule, PAPER_RULE_RANGE);
    setField(doc, 'paper-rule', next.paper === 'blank' || rule === null || rule === ruleOf(next.paper) ? null : rule);
    setField(doc, 'paper-margin', next.paper === 'ruled' ? points(next.margin, PAPER_MARGIN_RANGE) : null);
    const top = points(next.top, PAPER_TOP_RANGE);
    setField(doc, 'paper-top', next.paper !== 'ruled' || top === null || top === RULE_TOP ? null : top);
    setField(doc, 'paper-size', next.size);
    setField(doc, 'paper-turn', next.turn);
    setField(doc, 'pageless', next.pageless ? true : null);
    setField(doc, 'paper-color', paperHex(next.color));
    // (kept on blank paper too: it is there again when the paper is ruled again)
    setField(doc, 'paper-line', paperHex(next.line));
  });
}

/** Where this device keeps the page setup its new notebooks start with. */
export const SETUP_KEY = 'ilmi.paper';

/** A page setup read back from what was kept: anything it says wrongly is as a new notebook has it. */
export function parseSetup(raw: string | null | undefined): Setup | null {
  if (!raw) return null;
  try {
    const t = JSON.parse(raw) as Partial<Setup> | null;
    if (!t || typeof t !== 'object') return null;
    const n = (v: unknown, range: readonly [number, number]): number | null => (typeof v === 'number' && Number.isFinite(v) && v >= range[0] && v <= range[1] ? v : null);
    return {
      paper: PAPERS.includes(t.paper as PaperKind) ? (t.paper as PaperKind) : 'ruled',
      rule: n(t.rule, PAPER_RULE_RANGE), margin: n(t.margin, PAPER_MARGIN_RANGE), top: n(t.top, PAPER_TOP_RANGE),
      size: t.size === 'a4' ? 'a4' : null, turn: t.turn === 'landscape' ? 'landscape' : null, pageless: t.pageless === true,
      color: paperHex(t.color), line: paperHex(t.line),
    };
  } catch { return null; }
}

/** The page setup this device's new notebooks start with; null when none was kept (a ruled Letter sheet). */
export function defaultSetup(): Setup | null {
  try { return parseSetup(globalThis.localStorage?.getItem(SETUP_KEY)); } catch { return null; }
}

/** `use for new notebooks`: this page setup is what notebooks made on this device from now on start with. */
export function keepSetup(s: Setup): void {
  try { globalThis.localStorage?.setItem(SETUP_KEY, JSON.stringify(s)); } catch { /* no storage: nothing is kept */ }
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
