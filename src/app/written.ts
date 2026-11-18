// Written notes (milestone 82): a note whose pages are paper. A `.md` with a
// `written` field (FORMAT.md §3, *Written notes*) opens as its sheets in the
// `Pdf` lens, and its id stands wherever a PDF's SHA-256 does: its strokes
// are the store's page ink under `p.<id>.<sheet>`, its passages entries of
// `.ilmi/marks/<id>.json`. Here: making one, its sheets (added at the end
// or after another, taken out, made again, moved: milestone 85) and its paper.

import { MARGIN_LINES, PAPERS, PAPER_INSET_RANGE, PAPER_MARGIN_RANGE, PAPER_RULE_RANGE, PAPER_TOP_RANGE, meta, pagesLabel, parseBoxes, setField, type Box, type MarginLine, type PaperKind, type WrittenMeta } from '../format/index.js';
import { invoke } from '@tauri-apps/api/core';
import { MARGIN_AT, RULE_TOP, newInsets, paperHex, ruleOf } from './paper.js';
import { passageMarksOf } from '../pdf/index.js';
import { childDirOf, childrenAt, entryOf, isDoc, isPdfPath, newId, ordered, passageId, type InkStroke, type PassageMark, type StoreFs } from '../vault/index.js';
import { askNote, loadMarks, openNotes, setMark } from './book.js';
import { isPagesPath, isWritten, pdfForNotes } from './names.js';
import { useApp, type DocInfo } from './store.js';
import { notebookOf } from './tabs.js';
import { currentVault, openNode, setTabs } from './vault.js';

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

/**
 * How far down a pageless notebook's one long sheet the lowest thing
 * written on it reaches, in points from its top (milestone 88): 0 with
 * nothing written. Each sheet is `h` of the long one, in the order of
 * `sheets`; what its strokes cover is asked of the drawing itself
 * (`ink_bounds`). The last two sheets written on are looked at: a stroke is
 * kept on the sheet its top lies on and runs on over the next at most.
 */
export async function inkFoot(id: string, sheets: readonly number[], h: number): Promise<number> {
  const fs = currentVault()?.fs as Partial<StoreFs> | undefined;
  if (!fs?.inkedPages || !fs.pageInkFile) return 0;
  const inked = new Set(await fs.inkedPages(id));
  let foot = 0;
  let seen = 0;
  for (let i = sheets.length - 1; i >= 0 && seen < 2; i--) {
    if (!inked.has(sheets[i]!)) continue;
    seen++;
    const bytes = await fs.pageInkFile(id, sheets[i]!, 'drawing');
    if (!bytes.length) continue;
    let text = '';
    for (let k = 0; k < bytes.length; k += 0x8000) text += String.fromCharCode(...bytes.subarray(k, k + 0x8000));
    const box = await invoke<[number, number, number, number] | null>('ink_bounds', { drawing: btoa(text) }).catch(() => null);
    if (box) foot = Math.max(foot, i * h + box[1] + box[3]);
  }
  return foot;
}

/**
 * A pageless notebook's sheets past the last one listed that hold strokes
 * are put back on the end of `sheets`, lowest first (milestone 88). Two
 * devices writing at once each add the long sheet's next sheet under the
 * same number, and the list is one field: where the shorter list won the
 * merge, the strokes written on the sheet it leaves out are still kept
 * under its number, and are shown again once it is listed. Resolves to the
 * sheets as they are after.
 */
export async function healSheets(path: string, id: string, sheets: readonly number[]): Promise<number[]> {
  const fs = currentVault()?.fs as Partial<StoreFs> | undefined;
  if (!fs?.inkedPages) return [...sheets];
  const top = Math.max(0, ...sheets);
  const stray = (await fs.inkedPages(id)).filter((n) => n > top).sort((a, b) => a - b);
  if (!stray.length) return [...sheets];
  let out = [...sheets];
  await need().update(path, (doc) => {
    const w = meta(doc).written;
    if (!w || !w.pageless) return;
    out = [...w.sheets, ...stray.filter((n) => !w.sheets.includes(n))];
    if (out.length !== w.sheets.length) setField(doc, 'sheets', out);
  });
  return out;
}

/** Strokes are no document's write: the sync is told of them here, as `ink.ts` tells it of a canvas's. */
const wrote = (): void => { void import('./crdt.js').then((m) => m.crdtWrote(), () => {}); };

/** A new notebook named `name` in `dir`, one sheet, ruled; attached to `pdf` (vault-relative) when given. Its path. */
export async function createWritten(dir: string, name: string, pdf?: string): Promise<string> {
  const path = await need().createWritten(dir, name, newId(), pdf);
  // with the page setup this device keeps for new notebooks, when it keeps one; else a new notebook's margins (88:
  // its rules begin and end a little in from the sides, where a file that says nothing has them edge to edge)
  const mine = defaultSetup();
  await setSetup(path, mine ?? newInsets('ruled')).catch(console.error);
  return path;
}

/**
 * `new tab`: a written notebook as a child of the document `parent`, last
 * among its children, with the page setup of the notebook `like` (the
 * parent's own when it is one; else what a new notebook has), named
 * `untitled` to be renamed in the rail. `parent` shows its children as tabs
 * from then on, unless it is itself a page of a notebook that does (the new
 * one is then a subtab there). Opened; its path.
 */
export async function newWrittenTab(parent: string, like: string = parent): Promise<string> {
  const vault = need();
  const docs = useApp.getState().docs;
  const dir = childDirOf(parent);
  const path = await vault.createWritten(dir, 'untitled', newId());
  const shown = ordered(childrenAt(vault.tree, dir) ?? [], vault.order[dir]).map((n) => entryOf(n.path)).filter((e) => e !== entryOf(path));
  await vault.setOrder(dir, [...shown, entryOf(path)]);
  const from = docs[like]?.written ?? docs[parent]?.written;
  await setSetup(path, from ? setupOf(from) : defaultSetup() ?? newInsets('ruled')).catch(console.error);
  if (isDoc(parent) && notebookOf(parent, docs) === null) await setTabs(parent, true);
  await whenKnown(path);
  openNode(path);
  useApp.setState({ railRename: path });
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
  /** 85's margin rule (a line that far from the left edge, the ruling run on under it) and its counterpart from the right: what an older file says, kept until its margins are set (`withMargins`). */
  margin: number | null;
  marginRight: number | null;
  /** The margins (milestone 88): how far in from the left and the right edge the ruling begins and ends; null for none. */
  left: number | null;
  right: number | null;
  /** At which margins a line is drawn; null for none. Its colour, `#rrggbb`; null for the pale red it has. */
  marginLine: MarginLine | null;
  marginColor: string | null;
  top: number | null;
  /** The room under a ruled page's last rule (null for a rule's), or at a grid's foot (null for none) (milestone 88). */
  bottom: number | null;
  size: 'a4' | null;
  turn: 'landscape' | null;
  pageless: boolean;
  /** The paper's colour, `#rrggbb`; null where it follows the theme. */
  color: string | null;
  /** The colour of the rules, the grid's lines and the dots, `#rrggbb`; null for the paper's own. */
  line: string | null;
}

/** A notebook's page setup. */
export const setupOf = (w: WrittenMeta): Setup => ({ paper: w.paper, rule: w.rule ?? null, margin: w.margin ?? null, marginRight: w.marginRight ?? null, left: w.left ?? null, right: w.right ?? null, marginLine: w.marginLine ?? null, marginColor: w.marginColor ?? null, top: w.top ?? null, bottom: w.bottom ?? null, size: w.size ?? null, turn: w.turn ?? null, pageless: !!w.pageless, color: w.color ?? null, line: w.line ?? null });

/**
 * Some of a notebook's page setup changed (milestone 85). Only the paper
 * moves: what is written is kept in the sheet's points from its top left
 * and stays where it is, under a new ruling, on a sheet of another size, or
 * on sheets that run on as one. A measure that is what the paper has anyway
 * is not written: the file says only what was chosen.
 */
export async function setSetup(path: string, change: Partial<Setup> | ((now: Setup) => Partial<Setup>)): Promise<void> {
  await need().update(path, (doc) => {
    const w = meta(doc).written;
    if (!w) throw new Error(`${path}: not written notes`);
    const next = { ...setupOf(w), ...(typeof change === 'function' ? change(setupOf(w)) : change) };
    const points = (v: number | null, range: readonly [number, number]): number | null => (v === null || !Number.isFinite(v) ? null : Math.round(Math.min(range[1], Math.max(range[0], v)) * 100) / 100);
    setField(doc, 'paper', next.paper);
    const rule = points(next.rule, PAPER_RULE_RANGE);
    setField(doc, 'paper-rule', next.paper === 'blank' || rule === null || rule === ruleOf(next.paper) ? null : rule);
    // (85's margin rule is kept as the file has it until the margins are set, which takes its place: `withMargins`)
    setField(doc, 'paper-margin', points(next.margin, PAPER_MARGIN_RANGE));
    setField(doc, 'paper-margin-right', points(next.marginRight, PAPER_MARGIN_RANGE));
    const inset = (v: number | null): number | null => { const n = points(v, PAPER_INSET_RANGE); return n === null || n === 0 ? null : n; };
    setField(doc, 'paper-left', inset(next.left));
    setField(doc, 'paper-right', inset(next.right));
    setField(doc, 'paper-margin-line', next.marginLine);
    // (kept with the line off: it is there again when the line is)
    setField(doc, 'paper-margin-color', paperHex(next.marginColor));
    // the head and the foot: a ruled sheet's first rule and the room under its last; a grid's and dots' room at each; blank paper has neither
    const top = points(next.top, PAPER_TOP_RANGE);
    const bottom = points(next.bottom, PAPER_TOP_RANGE);
    const ruled = next.paper === 'ruled';
    const squared = next.paper === 'grid' || next.paper === 'dotted';
    setField(doc, 'paper-top', top === null || (ruled ? top === RULE_TOP : squared ? top === 0 : true) ? null : top);
    setField(doc, 'paper-bottom', bottom === null || (ruled ? bottom === (rule ?? ruleOf(next.paper)) : squared ? bottom === 0 : true) ? null : bottom);
    setField(doc, 'paper-size', next.size);
    setField(doc, 'paper-turn', next.turn);
    setField(doc, 'pageless', next.pageless ? true : null);
    setField(doc, 'paper-color', paperHex(next.color));
    // (kept on blank paper too: it is there again when the paper is ruled again)
    setField(doc, 'paper-line', paperHex(next.line));
  });
}

/**
 * A page setup with its margins set (milestone 88). What an older file says
 * (85's `paper-margin`, a line with the rules run on under it, and its
 * counterpart from the right) becomes a margin that wide with a line at it:
 * from the first time a margin is set, the ruling lies between the margins.
 */
export function withMargins(s: Setup, change: Partial<Pick<Setup, 'left' | 'right' | 'marginLine' | 'marginColor'>>): Setup {
  let next = { ...s };
  if (s.margin !== null || s.marginRight !== null) {
    const line: MarginLine | null = s.marginLine ?? (s.margin !== null && s.marginRight !== null ? 'both' : s.margin !== null ? 'left' : 'right');
    next = { ...next, left: s.left ?? s.margin, right: s.right ?? s.marginRight, marginLine: line, margin: null, marginRight: null };
  }
  next = { ...next, ...change };
  // a margin set to none takes its line with it
  const without = (line: MarginLine | null, side: 'left' | 'right'): MarginLine | null => (line === 'both' ? (side === 'left' ? 'right' : 'left') : line === side ? null : line);
  if ('left' in change && !change.left && !('marginLine' in change)) next.marginLine = without(next.marginLine, 'left');
  if ('right' in change && !change.right && !('marginLine' in change)) next.marginLine = without(next.marginLine, 'right');
  // a line asked for at a margin the sheet has none of: the margin a new notebook has
  if ((next.marginLine === 'left' || next.marginLine === 'both') && !next.left) next.left = MARGIN_AT;
  if ((next.marginLine === 'right' || next.marginLine === 'both') && !next.right) next.right = MARGIN_AT;
  return next;
}

/**
 * A page setup on another paper: the margins that were the old paper's own
 * for a new notebook become the new paper's (ruled paper's sides, a grid's
 * and dots' room all round), and any that were set otherwise stay; the head
 * and the foot, which mean another thing on each paper, start as the new
 * paper's.
 */
export function onPaper(s: Setup, paper: PaperKind): Setup {
  if (paper === s.paper) return s;
  const [was, now] = [newInsets(s.paper), newInsets(paper)];
  // (a margin set to none stays none)
  const side = (v: number | null, old: number | null, fresh: number | null): number | null => (v !== null && v === old && paper !== 'blank' ? fresh : v);
  // (85's margin rule, where the file still has one, is left as it is)
  const legacy = s.margin !== null || s.marginRight !== null;
  return { ...s, paper, left: legacy ? s.left : side(s.left, was.left, now.left), right: legacy ? s.right : side(s.right, was.right, now.right), top: now.top, bottom: now.bottom };
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
      rule: n(t.rule, PAPER_RULE_RANGE), margin: n(t.margin, PAPER_MARGIN_RANGE), marginRight: n(t.marginRight, PAPER_MARGIN_RANGE), left: n(t.left, PAPER_INSET_RANGE), right: n(t.right, PAPER_INSET_RANGE),
      marginLine: MARGIN_LINES.includes(t.marginLine as MarginLine) ? (t.marginLine as MarginLine) : null, marginColor: paperHex(t.marginColor), top: n(t.top, PAPER_TOP_RANGE), bottom: n(t.bottom, PAPER_TOP_RANGE),
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

/** The notebook's paper: its margins go with it where they were the old paper's own (`onPaper`). */
export async function setPaper(path: string, paper: PaperKind): Promise<void> {
  await setSetup(path, (now) => onPaper(now, paper));
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
