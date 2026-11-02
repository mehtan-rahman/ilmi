// A passage boxed on a book's pages, named from the page itself (milestone
// 48): the nearest numbered heading at or above its first box (`3.3 ·
// average values`), then the equation numbers inside its boxes (`(3.12)`,
// `(3.13–3.15)`); a page with no numbered heading names it `p. N`. pdf.js
// reads an Arabic page's text out of order, so a passage there is clipped,
// never named from its text (`named` is false). Pure: the lens hands in
// each page's text items, placed as fractions of the page.

import type { Box } from '../format/index.js';

/** A text item on a page: its string, its left edge and baseline as fractions of the page from the top-left, its type size in PDF units. */
export interface PageItem {
  s: string;
  x: number;
  y: number;
  h: number;
}

const HEADING_NO = /^\d+(?:\.\d+)+$/;
const EQ_NO = /^\((\d+(?:\.\d+)*[a-z]?)\)$/;
/** How much of the first box's top a heading may sit inside and still be the passage's own. */
const INTO = 0.3;
/** Two items on one line: their baselines this close, as a fraction of the page. */
const LINE = 0.004;

/** The body's type size on a page: the size most of its characters are set in. */
function bodySize(items: readonly PageItem[]): number {
  const weight = new Map<number, number>();
  for (const it of items) {
    const k = Math.round(it.h * 10) / 10;
    weight.set(k, (weight.get(k) ?? 0) + it.s.trim().length);
  }
  let best = 0;
  let size = 0;
  for (const [k, w] of weight) if (w > best) { best = w; size = k; }
  return size;
}

/** The nearest numbered heading at or above `at` on `items` (larger than the body), with the rest of its line. */
function headingOn(items: readonly PageItem[], limit: number): string | null {
  const body = bodySize(items);
  const hs = items.filter((it) => HEADING_NO.test(it.s.trim()) && it.h > body + 0.5 && it.y <= limit);
  if (!hs.length) return null;
  const h = hs.reduce((a, b) => (b.y > a.y ? b : a));
  const rest = items
    .filter((it) => it !== h && Math.abs(it.y - h.y) < LINE && it.x > h.x)
    .sort((a, b) => a.x - b.x)
    .map((it) => it.s.trim())
    .filter(Boolean)
    .join(' ')
    .replace(/\s+/g, ' ');
  const words = rest ? `${rest.charAt(0).toLocaleLowerCase()}${rest.slice(1)}` : '';
  return words ? `${h.s.trim()} · ${words}` : h.s.trim();
}

/** The equation numbers set inside the boxes, in order, each once. */
export function equationsIn(itemsOf: (page: number) => readonly PageItem[] | undefined, boxes: readonly Box[]): string[] {
  const out: string[] = [];
  for (const b of boxes) {
    const here = (itemsOf(b.page) ?? [])
      .filter((it) => EQ_NO.test(it.s.trim()) && it.y >= b.y && it.y <= b.y + b.h + 0.01)
      .sort((p, q) => p.y - q.y);
    for (const it of here) {
      const n = EQ_NO.exec(it.s.trim())![1]!;
      if (!out.includes(n)) out.push(n);
    }
  }
  return out;
}

/**
 * The passage's name, and whether the book named it (a numbered heading was
 * found); `first` is the document's first page, below which nothing is read.
 */
export function sectionName(itemsOf: (page: number) => readonly PageItem[] | undefined, first: number, boxes: readonly Box[]): { name: string; named: boolean } {
  const b0 = boxes[0];
  if (!b0) return { name: '', named: false };
  let head: string | null = null;
  for (let n = b0.page; n >= first && head === null; n--) {
    const items = itemsOf(n);
    if (!items) continue;
    head = headingOn(items, n === b0.page ? b0.y + b0.h * INTO : Infinity);
  }
  const eqs = equationsIn(itemsOf, boxes);
  const nos = eqs.length ? ` (${eqs.length > 1 ? `${eqs[0]}–${eqs[eqs.length - 1]}` : eqs[0]})` : '';
  return { name: `${head ?? `p. ${b0.page}`}${nos}`, named: head !== null };
}

/** A text selection's line rectangles on one page (fractions of the page) as the one box around them, a little room kept. */
export function boxAround(page: number, rects: readonly { x: number; y: number; w: number; h: number }[], pad = 0.004): Box | null {
  const rs = rects.filter((r) => r.w > 0 && r.h > 0);
  if (!rs.length) return null;
  const clamp = (n: number) => Math.min(1, Math.max(0, n));
  const x = clamp(Math.min(...rs.map((r) => r.x)) - pad);
  const y = clamp(Math.min(...rs.map((r) => r.y)) - pad);
  const r = clamp(Math.max(...rs.map((q) => q.x + q.w)) + pad);
  const b = clamp(Math.max(...rs.map((q) => q.y + q.h)) + pad);
  return { page, x, y, w: r - x, h: b - y };
}

/** pdf.js's text items (`getTextContent`) on a page of `width` × `height` PDF units, as the naming reads them. */
export function pageItems(items: readonly unknown[], width: number, height: number): PageItem[] {
  const out: PageItem[] = [];
  for (const it of items) {
    const t = it as { str?: unknown; transform?: unknown; height?: unknown };
    if (typeof t.str !== 'string' || !t.str.trim() || !Array.isArray(t.transform)) continue;
    const tr = t.transform as number[];
    out.push({ s: t.str, x: (tr[4] ?? 0) / width, y: (height - (tr[5] ?? 0)) / height, h: typeof t.height === 'number' ? t.height : 0 });
  }
  return out;
}
