// Where a passage is on a document's pages (FORMAT.md §6.5 `boxes`, §6.6
// a clip): rectangles on the PDF's pages, each `page:x:y:w:h`, the page
// numbered as the PDF numbers it (from 1), the rest fractions of the page
// from its top-left corner, written to three decimals. A section's `boxes`
// holds one or more, `,` between; a clip line `<!-- box … -->` holds one.

/** One rectangle on a page: the page (from 1), then its left, top, width and height as fractions of the page. */
export interface Box {
  page: number;
  x: number;
  y: number;
  w: number;
  h: number;
}

const FRAC = /^(?:0(?:\.\d+)?|1(?:\.0+)?|\.\d+)$/;
const PAGE = /^[1-9]\d*$/;
/** How far past the page's edge a box may reach, for the rounding of three decimals. */
const SLACK = 0.0015;

/** A fraction to three decimals, as written. */
export const frac3 = (n: number): string => (Math.round(Math.min(1, Math.max(0, n)) * 1000) / 1000).toFixed(3);

/** One `page:x:y:w:h`, or null when it is not in the grammar (a page from 1; fractions 0–1; some width and height; inside the page). */
export function parseBox(s: string): Box | null {
  const p = s.split(':');
  if (p.length !== 5 || !PAGE.test(p[0]!) || !p.slice(1).every((v) => FRAC.test(v))) return null;
  const [x, y, w, h] = p.slice(1).map(Number) as [number, number, number, number];
  if (w <= 0 || h <= 0 || x + w > 1 + SLACK || y + h > 1 + SLACK) return null;
  return { page: Number(p[0]), x, y, w, h };
}

export function formatBox(b: Box): string {
  return `${b.page}:${frac3(b.x)}:${frac3(b.y)}:${frac3(b.w)}:${frac3(b.h)}`;
}

/** A section's `boxes`: one or more boxes, `,` between; null when any is not in the grammar. */
export function parseBoxes(s: string): Box[] | null {
  if (!s) return null;
  const out: Box[] = [];
  for (const part of s.split(',')) {
    const b = parseBox(part);
    if (!b) return null;
    out.push(b);
  }
  return out;
}

export function formatBoxes(boxes: readonly Box[]): string {
  return boxes.map(formatBox).join(',');
}

/** `boxes` as written canonically (three decimals), or the text as it was when it is not in the grammar. */
export function normalizeBoxes(s: string): string {
  const b = parseBoxes(s);
  return b ? formatBoxes(b) : s;
}

/** Where a passage starts, for book order: its first box's page, then how far down it. */
export const boxesAt = (boxes: readonly Box[]): number => (boxes.length ? boxes[0]!.page + boxes[0]!.y : Infinity);

/** Where a passage ends: its last box's page and the fraction down that page its bottom is. */
export function boxesEnd(boxes: readonly Box[]): { page: number; y: number } | null {
  const b = boxes[boxes.length - 1];
  return b ? { page: b.page, y: Math.min(1, b.y + b.h) } : null;
}

/** The pages a passage is on, in order, each once. */
export const boxesPages = (boxes: readonly Box[]): number[] => [...new Set(boxes.map((b) => b.page))];

/** A passage's pages as words: `p. 41`, `pp. 41–42`. */
export function pagesLabel(boxes: readonly Box[]): string {
  const ps = boxesPages(boxes);
  if (!ps.length) return '';
  return ps.length === 1 ? `p. ${ps[0]}` : `pp. ${ps[0]}–${ps[ps.length - 1]}`;
}

const CLIP = /^<!--[ \t]+box[ \t]+(\S+)[ \t]*-->$/;

/** A clip line (FORMAT.md §6.6), a raw block of its own: `<!-- box 129:0.120:0.368:0.770:0.088 -->`. Null for any other text. */
export function parseClip(text: string): Box | null {
  const m = CLIP.exec(text.trim());
  return m ? parseBox(m[1]!) : null;
}

export function formatClip(b: Box): string {
  return `<!-- box ${formatBox(b)} -->`;
}
