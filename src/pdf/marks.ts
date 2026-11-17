// What you leave on a book's pages (milestone 77, after sioyek's reader;
// read, not copied): bookmarks, marks by a letter, highlights, portals, and
// the ruler under a line. The pure side: the lists the lens, the palette and
// the inspector draw, a selection's rectangles as a highlight's quads, the
// highlight under a point, the portal a place has read past, a page's lines
// as bands for the ruler. The file they are kept in is `src/vault/marks.ts`;
// the lens is `src/app/Pdf.tsx`.

import type { Box } from '../format/index.js';
import type { Bookmark, Highlight, LetterMark, Mark, Marks, PassageMark, Portal, Quad } from '../vault/marks.js';
import { boxAround } from './name.js';

const r4 = (n: number): number => Math.round(n * 10000) / 10000;
const clamp = (n: number): number => Math.min(1, Math.max(0, n));

/** A place on a page as an entry keeps it: the page, and how far down it to four decimals. */
export const placeOf = (page: number, y: number): { page: number; y: number } => ({ page, y: r4(clamp(y)) });

/** A key for a new entry: its kind's letter and twelve hex digits. */
export function newMarkId(kind: 'b' | 'h' | 'p', random: () => number = Math.random): string {
  let s = '';
  for (let i = 0; i < 12; i++) s += Math.floor(random() * 16).toString(16);
  return `${kind}-${s}`;
}
/** A letter's mark has the letter for its key: set again, it moves. */
export const letterId = (letter: string): string => `m-${letter}`;
/** A capital is the collection's, a lowercase letter the book's. */
export const isCollectionMark = (letter: string): boolean => /^[A-Z]$/.test(letter);

const inOrder = <T extends Mark>(a: [string, T], b: [string, T]): number => a[1].page - b[1].page || a[1].y - b[1].y || a[1].at - b[1].at || (a[0] < b[0] ? -1 : 1);
const ofKind = <T extends Mark>(marks: Marks, kind: T['kind']): [string, T][] => (Object.entries(marks).filter(([, m]) => m.kind === kind) as [string, T][]).sort(inOrder);

/** A book's bookmarks, in the book's order. */
export const bookmarksOf = (marks: Marks): [string, Bookmark][] => ofKind<Bookmark>(marks, 'bookmark');
export const highlightsOf = (marks: Marks): [string, Highlight][] => ofKind<Highlight>(marks, 'highlight');
/** A book's passages (boxes that come back, FORMAT.md §6.5), in the book's order. */
export const passageMarksOf = (marks: Marks): [string, PassageMark][] => ofKind<PassageMark>(marks, 'passage');
export const portalsOf = (marks: Marks): [string, Portal][] => ofKind<Portal>(marks, 'portal');
/** A book's marks by letter, in the letters' order (capitals first). */
export const lettersOf = (marks: Marks): [string, LetterMark][] => ofKind<LetterMark>(marks, 'mark').sort((a, b) => (a[1].letter < b[1].letter ? -1 : a[1].letter > b[1].letter ? 1 : 0));

/** The collection's mark for a capital: of every book's, the one set last. `all` is each PDF's marks by its hash. */
export function collectionMark(all: Iterable<[hash: string, marks: Marks]>, letter: string): { hash: string; mark: LetterMark } | null {
  let best: { hash: string; mark: LetterMark } | null = null;
  for (const [hash, marks] of all) {
    const m = marks[letterId(letter)];
    if (m?.kind !== 'mark' || m.letter !== letter) continue;
    if (!best || m.at > best.mark.at || (m.at === best.mark.at && hash > best.hash)) best = { hash, mark: m };
  }
  return best;
}

/** Every book's capital marks, one a letter (the one set last), in the letters' order. */
export function collectionMarks(all: Iterable<[hash: string, marks: Marks]>): { hash: string; mark: LetterMark }[] {
  const list = [...all];
  const letters = new Set<string>();
  for (const [, marks] of list) for (const m of Object.values(marks)) if (m.kind === 'mark' && isCollectionMark(m.letter)) letters.add(m.letter);
  return [...letters].sort().map((l) => collectionMark(list, l)!).filter(Boolean);
}

// ── highlights ──

interface FracRect { x: number; y: number; w: number; h: number }

/**
 * A selection's rectangles on one page (fractions of it, as the web view
 * gives them: one a run of text, some twice) as a quad a line: rectangles
 * that share most of their height are one line, from the leftmost to the
 * rightmost of them.
 */
export function lineQuads(page: number, rects: readonly FracRect[]): Quad[] {
  const rs = rects.filter((r) => r.w > 0 && r.h > 0).sort((a, b) => a.y + a.h / 2 - (b.y + b.h / 2) || a.x - b.x);
  const lines: { x: number; y: number; r: number; b: number }[] = [];
  for (const r of rs) {
    const mid = r.y + r.h / 2;
    const line = lines.find((l) => mid > l.y && mid < l.b && Math.min(l.b, r.y + r.h) - Math.max(l.y, r.y) > 0.5 * Math.min(l.b - l.y, r.h));
    if (line) {
      line.x = Math.min(line.x, r.x);
      line.r = Math.max(line.r, r.x + r.w);
      line.y = Math.min(line.y, r.y);
      line.b = Math.max(line.b, r.y + r.h);
    } else lines.push({ x: r.x, y: r.y, r: r.x + r.w, b: r.y + r.h });
  }
  return lines.sort((a, b) => a.y - b.y || a.x - b.x).map((l): Quad => [page, r4(clamp(l.x)), r4(clamp(l.y)), r4(clamp(l.r) - clamp(l.x)), r4(clamp(l.b) - clamp(l.y))]);
}

const inQuad = (q: Quad, page: number, x: number, y: number): boolean => q[0] === page && x >= q[1] && x <= q[1] + q[3] && y >= q[2] && y <= q[2] + q[4];

/** The highlight under a point of a page (fractions of it): its key, the one made last when two overlap; null for none. */
export function highlightAt(marks: Marks, page: number, x: number, y: number): string | null {
  let best: [string, Highlight] | null = null;
  for (const e of highlightsOf(marks)) if (e[1].quads.some((q) => inQuad(q, page, x, y)) && (!best || e[1].at >= best[1].at)) best = e;
  return best ? best[0] : null;
}

/** The highlight these quads lie inside (each one's middle in it): what `h` on a selection within a highlight clears. */
export function highlightHolding(marks: Marks, quads: readonly Quad[]): string | null {
  if (!quads.length) return null;
  let best: [string, Highlight] | null = null;
  for (const e of highlightsOf(marks)) {
    if (quads.every((q) => e[1].quads.some((h) => inQuad(h, q[0], q[1] + q[3] / 2, q[2] + q[4] / 2))) && (!best || e[1].at >= best[1].at)) best = e;
  }
  return best ? best[0] : null;
}

/** A highlight's quads as a section's boxes: the one box around them on each page, in the pages' order. */
export function quadBoxes(quads: readonly Quad[]): Box[] {
  const by = new Map<number, FracRect[]>();
  for (const q of quads) by.set(q[0], [...(by.get(q[0]) ?? []), { x: q[1], y: q[2], w: q[3], h: q[4] }]);
  return [...by].sort((a, b) => a[0] - b[0]).map(([n, rs]) => boxAround(n, rs)).filter((b): b is Box => b !== null);
}

/** A highlight as an entry: its quads in reading order, its place the first of them. Null with no quads. */
export function highlightOf(quads: readonly Quad[], text: string, ink: number, at: number): Highlight | null {
  const qs = [...quads].sort((a, b) => a[0] - b[0] || a[2] - b[2] || a[1] - b[1]);
  const q0 = qs[0];
  return q0 ? { kind: 'highlight', page: q0[0], y: q0[2], quads: qs, text: text.replace(/\s+/g, ' ').trim(), ink, at } : null;
}

// ── portals ──

/** The portal a place has read past: of those whose source is at or above it, the nearest. */
export function portalAbove(portals: readonly [string, Portal][], at: { page: number; y: number }): [string, Portal] | null {
  let best: [string, Portal] | null = null;
  for (const p of portals) {
    const m = p[1];
    if (m.page > at.page || (m.page === at.page && m.y > at.y)) continue;
    if (!best || m.page > best[1].page || (m.page === best[1].page && m.y >= best[1].y)) best = p;
  }
  return best;
}

// ── the ruler ──

/** A line of a page as the ruler holds it: from `top` to `bottom`, fractions of the page from its top. */
export interface LineBand { top: number; bottom: number }

/**
 * A page's lines (`linesOf`: each a baseline up from the page's bottom and
 * a type size, in PDF units) as bands down a page `height` units high, from
 * the top: a band is the line's ascent and descent. Runs set on one
 * baseline (two columns, a line pdf.js ends twice) are one band.
 */
export function lineBands(lines: readonly { y: number; height: number }[], height: number): LineBand[] {
  if (!(height > 0)) return [];
  const bands = lines
    .filter((l) => l.height > 0)
    .map((l) => ({ top: clamp(1 - (l.y + 0.8 * l.height) / height), bottom: clamp(1 - (l.y - 0.25 * l.height) / height) }))
    .filter((b) => b.bottom > b.top)
    .sort((a, b) => a.top - b.top || a.bottom - b.bottom);
  const out: LineBand[] = [];
  for (const b of bands) {
    const prev = out[out.length - 1];
    // the same line again: most of the shorter of the two inside the other
    if (prev && Math.min(prev.bottom, b.bottom) - Math.max(prev.top, b.top) > 0.6 * Math.min(prev.bottom - prev.top, b.bottom - b.top)) {
      prev.top = Math.min(prev.top, b.top);
      prev.bottom = Math.max(prev.bottom, b.bottom);
    } else out.push({ ...b });
  }
  return out.map((b) => ({ top: r4(b.top), bottom: r4(b.bottom) }));
}

/** The band nearest `y` down the page (its middle); -1 on a page with no lines. */
export function bandNear(bands: readonly LineBand[], y: number): number {
  let best = -1;
  let gap = Infinity;
  bands.forEach((b, i) => {
    const d = y >= b.top && y <= b.bottom ? 0 : Math.abs((b.top + b.bottom) / 2 - y);
    if (d < gap) { gap = d; best = i; }
  });
  return best;
}

/**
 * The line after (`dir` 1) or before (-1) line `line` of `page`: the next on
 * the page, else the first of the next page that has lines (the last of the
 * one before), no further than `first` and `last`. Null at the book's end.
 */
export async function stepLine(at: { page: number; line: number }, dir: 1 | -1, countOn: (page: number) => Promise<number>, first: number, last: number): Promise<{ page: number; line: number } | null> {
  const here = await countOn(at.page);
  const next = at.line + dir;
  if (next >= 0 && next < here) return { page: at.page, line: next };
  for (let n = at.page + dir; n >= first && n <= last; n += dir) {
    const k = await countOn(n);
    if (k > 0) return { page: n, line: dir > 0 ? 0 : k - 1 };
  }
  return null;
}
