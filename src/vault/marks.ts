// What is left on a book's pages (milestone 77): bookmarks, marks by a
// letter, highlights, portals, and (milestone 81) passages: boxes on the
// pages that come back in the day's queue by themselves, kept here and in
// no note. One file a PDF, `.ilmi/marks/<sha256>.json`
// (FORMAT.md §1), named by the PDF's SHA-256 as its ink is: it follows the
// file through a rename, a chapter cut from a book and the book share it,
// and it stays when the last document that names the PDF is deleted.
//
// The file is one object, an entry a key, the keys sorted at both levels,
// two spaces, a newline at the end: the same marks are the same bytes. An
// entry's place is its page (as the PDF numbers them, from 1) and how far
// down it (`y`, 0 the top, 1 the bottom), never pixels; a highlight's
// `quads` are `[page, x, y, w, h]`, fractions of the page from its top left,
// as a section's boxes are. Numbers are written to four decimals.
//
// Merging is the engine's (`src/sync/engine.ts`): each entry is a register
// (`~m|<sha256>|<id>`), so two devices that each add one end with both.
// This file is the pure side: reading, writing, and what changed between two.

import { normalizeBoxes, parseBoxes } from '../format/boxes.js';

export const MARKS_DIR = '.ilmi/marks';

/** Where a PDF's marks are kept, by its SHA-256. */
export const marksPath = (hash: string): string => `${MARKS_DIR}/${hash}.json`;

/** The PDF a marks file is of, by the file's path or its name; null for any other file. */
export function marksHashOf(pathOrName: string): string | null {
  const m = /(?:^|\/)([0-9a-f]{64})\.json$/.exec(pathOrName);
  return m && (pathOrName === m[0] || pathOrName === marksPath(m[1]!)) ? m[1]! : null;
}

interface Base {
  /** The page, as the PDF numbers them, from 1. */
  page: number;
  /** How far down the page, 0 to 1. */
  y: number;
  /** When it was made, ms since 1970: the order lists are in, and which of two collection marks of one letter stands. */
  at: number;
}
export interface Bookmark extends Base { kind: 'bookmark'; name: string }
/** A place by a letter: `a`–`z` the book's, `A`–`Z` the collection's. Its key is `m-<letter>`. */
export interface LetterMark extends Base { kind: 'mark'; letter: string }
/** `[page, x, y, w, h]`: a line's rectangle, fractions of its page. */
export type Quad = [page: number, x: number, y: number, w: number, h: number];
export interface Highlight extends Base { kind: 'highlight'; quads: Quad[]; text: string; ink: number }
/** A place tied to another: `to` in this PDF, or in the one `pdf` names by its SHA-256. */
export interface Portal extends Base { kind: 'portal'; to: { page: number; y: number; pdf?: string } }
/**
 * A passage (FORMAT.md §6.5): boxes on the pages that come back on the
 * reading loop until dismissed. `boxes` is what it is (`page:x:y:w:h`, `,`
 * between, as a section's); its key is `s-<boxes>`, so the same boxes are
 * one passage on every device. `page` and `y` are its first box's. The
 * rest is a section's line: no `due` is a passage dismissed.
 */
export interface PassageMark extends Base { kind: 'passage'; boxes: string; made?: string; due?: string; ivl?: number; reps?: number; af?: number; pri?: number }
export type Mark = Bookmark | LetterMark | Highlight | Portal | PassageMark;
/** A PDF's marks, by their keys. */
export type Marks = Record<string, Mark>;

/** How many inks a highlight has. */
export const INKS = 4;

/** A passage's key: its boxes, as written. */
export const passageId = (boxes: string): string => `s-${boxes}`;

const DAY = /^\d{4}-\d{2}-\d{2}$/;
const WHEN = /^\d{4}-\d{2}-\d{2}(?:T\d{2}:\d{2}(?::\d{2}(?:\.\d+)?)?Z)?$/;
const count = (v: unknown): v is number => typeof v === 'number' && Number.isInteger(v) && v >= 0;

const r4 = (n: number): number => Math.round(n * 10000) / 10000;
const unit = (v: unknown): v is number => typeof v === 'number' && Number.isFinite(v) && v >= -0.5 && v <= 1.5;
const pageNo = (v: unknown): v is number => typeof v === 'number' && Number.isInteger(v) && v >= 1;
const obj = (v: unknown): v is Record<string, unknown> => typeof v === 'object' && v !== null && !Array.isArray(v);

/** One entry as it is typed, or null for one that does not read (kept out of the lists, never out of the file's merge). */
export function markOf(v: unknown): Mark | null {
  if (!obj(v) || !pageNo(v.page) || !unit(v.y)) return null;
  const base = { page: v.page, y: r4(v.y), at: typeof v.at === 'number' && Number.isFinite(v.at) ? Math.round(v.at) : 0 };
  switch (v.kind) {
    case 'bookmark': return typeof v.name === 'string' ? { ...base, kind: 'bookmark', name: v.name } : null;
    case 'mark': return typeof v.letter === 'string' && /^[A-Za-z]$/.test(v.letter) ? { ...base, kind: 'mark', letter: v.letter } : null;
    case 'highlight': {
      if (!Array.isArray(v.quads) || typeof v.text !== 'string') return null;
      const quads: Quad[] = [];
      for (const q of v.quads as unknown[]) {
        if (!Array.isArray(q) || q.length !== 5 || !pageNo(q[0]) || !q.slice(1).every(unit)) return null;
        quads.push([q[0], r4(q[1] as number), r4(q[2] as number), r4(q[3] as number), r4(q[4] as number)]);
      }
      const ink = typeof v.ink === 'number' && Number.isInteger(v.ink) && v.ink >= 1 && v.ink <= INKS ? v.ink : 1;
      return quads.length ? { ...base, kind: 'highlight', quads, text: v.text, ink } : null;
    }
    case 'portal': {
      const to = v.to;
      if (!obj(to) || !pageNo(to.page) || !unit(to.y)) return null;
      const pdf = typeof to.pdf === 'string' && /^[0-9a-f]{64}$/.test(to.pdf) ? to.pdf : undefined;
      return { ...base, kind: 'portal', to: { page: to.page, y: r4(to.y), ...(pdf ? { pdf } : {}) } };
    }
    case 'passage': {
      if (typeof v.boxes !== 'string' || !parseBoxes(v.boxes)) return null;
      const out: PassageMark = { ...base, kind: 'passage', boxes: normalizeBoxes(v.boxes) };
      if (typeof v.made === 'string' && DAY.test(v.made)) out.made = v.made;
      if (typeof v.due === 'string' && WHEN.test(v.due)) out.due = v.due;
      if (count(v.ivl)) out.ivl = v.ivl;
      if (count(v.reps)) out.reps = v.reps;
      if (typeof v.af === 'number' && Number.isFinite(v.af) && v.af >= 1.1) out.af = v.af;
      if (count(v.pri) && v.pri <= 100) out.pri = v.pri;
      return out;
    }
    default: return null;
  }
}

/** A value with every object's keys in order, so the same value is the same text. */
function sorted(v: unknown): unknown {
  if (Array.isArray(v)) return v.map(sorted);
  if (!obj(v)) return v;
  const out: Record<string, unknown> = {};
  for (const k of Object.keys(v).sort()) out[k] = sorted(v[k]);
  return out;
}

/** The file as its entries, whatever they hold: what the merge reads. Null for a text that is not an object of objects. */
export function marksMap(text: string | null): Record<string, unknown> | null {
  try {
    const v: unknown = JSON.parse(text ?? '');
    return obj(v) && Object.values(v).every(obj) ? v : null;
  } catch { return null; }
}

/** One entry as a register holds it: its keys in order, no space. */
export const entryText = (entry: unknown): string => JSON.stringify(sorted(entry));

/** The file's text for these entries: keys sorted at every level, two spaces, a newline at the end. */
export function marksText(entries: Record<string, unknown>): string {
  return `${JSON.stringify(sorted(entries), null, 2)}\n`;
}

/** A PDF's marks from its file's text: the entries that read, as typed; a text that is no such file holds none. */
export function parseMarks(text: string | null): Marks {
  const out: Marks = {};
  for (const [k, v] of Object.entries(marksMap(text) ?? {})) {
    const m = markOf(v);
    if (m) out[k] = m;
  }
  return out;
}

/** The file's text for a PDF's marks; `rest` the entries of the file that did not read, kept as they were. */
export function serializeMarks(marks: Marks, rest: Record<string, unknown> = {}): string {
  return marksText({ ...rest, ...marks });
}

/** What changed from one file's entries to another's: each entry set, with its register's text, and each gone (null). */
export function marksDiff(was: Record<string, unknown>, now: Record<string, unknown>): [id: string, value: string | null][] {
  const out: [string, string | null][] = [];
  for (const id of Object.keys(now).sort()) {
    const v = entryText(now[id]);
    if (!(id in was) || entryText(was[id]) !== v) out.push([id, v]);
  }
  for (const id of Object.keys(was).sort()) if (!(id in now)) out.push([id, null]);
  return out;
}

/** The entries of a file with each register laid over them: one set is as the register has it, one taken away is gone. */
export function marksMerged(base: Record<string, unknown>, regs: Iterable<[id: string, value: string | null]>): Record<string, unknown> {
  const out: Record<string, unknown> = { ...base };
  for (const [id, value] of regs) {
    if (value === null) { delete out[id]; continue; }
    try { const v: unknown = JSON.parse(value); if (obj(v)) out[id] = v; } catch { /* a register that does not read changes nothing */ }
  }
  return out;
}
