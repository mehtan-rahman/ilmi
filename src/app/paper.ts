// The paper of a written notebook's sheet (milestone 82): blank, ruled, a
// grid, dots. Every sheet is portrait Letter, 612 by 792 points, and the
// paper is said in those points, so it is the same at any zoom. On the pages
// it is an inline SVG (`Pdf.tsx`): the rules one path of hairlines that stay
// a pixel wide however far the page is zoomed, the dots a path of round
// dashes that grow with it as the dots of a real page would. In a note, where
// a clip of a sheet is drawn (`bookPdf.ts`), the same paper is drawn onto the
// clip's canvas. White paper, the rules a pale blue-grey, light enough to
// write over; dark paper and e-ink turn it as they turn a PDF's page
// (`pdf.css`).

import type { PaperKind } from '../format/index.js';

/** A sheet, in points. */
export const PAPER_W = 612;
export const PAPER_H = 792;
/** The paper itself, and what is ruled on it. */
export const PAPER_WHITE = '#ffffff';
export const PAPER_RULE = '#c3cfdd';
/** The dots are small, so a little heavier than a rule to read as lightly. */
export const PAPER_DOT = '#a9b7c8';

/** Ruled: a line every 24 points, the first an inch down. */
const RULE_STEP = 24;
const RULE_TOP = 72;
/** A grid's squares and a dotted page's pitch. */
const GRID_STEP = 20;
/** The lattice is centred on the sheet: 612 and 792 are 12 over a whole number of squares. */
const GRID_OFF = 6;
/** A dot's width, in points. */
const DOT = 1.5;

/** The lines of a paper, in points: horizontal ones by their `y`, vertical ones by their `x`, and where the dots are. */
export function paperLines(kind: PaperKind): { rows: number[]; cols: number[]; dots: { xs: number[]; ys: number[] } | null } {
  const steps = (from: number, to: number, step: number): number[] => {
    const out: number[] = [];
    for (let v = from; v <= to + 1e-6; v += step) out.push(v);
    return out;
  };
  if (kind === 'ruled') return { rows: steps(RULE_TOP, PAPER_H - RULE_STEP, RULE_STEP), cols: [], dots: null };
  if (kind === 'grid') return { rows: steps(GRID_OFF, PAPER_H - GRID_OFF, GRID_STEP), cols: steps(GRID_OFF, PAPER_W - GRID_OFF, GRID_STEP), dots: null };
  if (kind === 'dotted') return { rows: [], cols: [], dots: { xs: steps(GRID_OFF + GRID_STEP, PAPER_W - GRID_OFF - GRID_STEP, GRID_STEP), ys: steps(GRID_OFF + GRID_STEP, PAPER_H - GRID_OFF - GRID_STEP, GRID_STEP) } };
  return { rows: [], cols: [], dots: null };
}

/**
 * A paper as the paths of an SVG whose view box is the sheet in points:
 * `rules` every line (drawn with a stroke that does not scale), `dots` a row
 * of zero-length dashes `pitch` apart for each row of dots (drawn `width`
 * wide with round caps). Empty where the paper has none.
 */
export function paperPaths(kind: PaperKind): { rules: string; dots: string; pitch: number; width: number } {
  const { rows, cols, dots } = paperLines(kind);
  const rules = [...rows.map((y) => `M0 ${y}H${PAPER_W}`), ...cols.map((x) => `M${x} 0V${PAPER_H}`)].join('');
  const row = dots ? dots.ys.map((y) => `M${dots.xs[0]} ${y}H${dots.xs[dots.xs.length - 1]! + 0.01}`).join('') : '';
  return { rules, dots: row, pitch: GRID_STEP, width: DOT };
}

/**
 * The paper drawn onto a canvas: the part of the sheet at `x`, `y`, `w` by
 * `h` points, `k` canvas pixels to the point, from the canvas's top left.
 * The rules are a pixel wide and lie on whole pixels.
 */
export function drawPaper(ctx: CanvasRenderingContext2D, kind: PaperKind, part: { x: number; y: number; w: number; h: number }, k: number): void {
  const W = part.w * k;
  const H = part.h * k;
  // off the sheet's edge (the room kept round a clip) is the desk's: left as it is
  const left = Math.max(0, -part.x) * k;
  const top = Math.max(0, -part.y) * k;
  const right = Math.min(W, (PAPER_W - part.x) * k);
  const bottom = Math.min(H, (PAPER_H - part.y) * k);
  if (right <= left || bottom <= top) return;
  ctx.fillStyle = PAPER_WHITE;
  ctx.fillRect(left, top, right - left, bottom - top);
  const { rows, cols, dots } = paperLines(kind);
  ctx.fillStyle = PAPER_RULE;
  for (const y of rows) {
    const at = Math.round((y - part.y) * k);
    if (at >= top && at < bottom) ctx.fillRect(left, at, right - left, 1);
  }
  for (const x of cols) {
    const at = Math.round((x - part.x) * k);
    if (at >= left && at < right) ctx.fillRect(at, top, 1, bottom - top);
  }
  if (!dots) return;
  ctx.fillStyle = PAPER_DOT;
  const r = Math.max(0.6, (DOT / 2) * k);
  for (const y of dots.ys) {
    const cy = (y - part.y) * k;
    if (cy < top - r || cy > bottom + r) continue;
    for (const x of dots.xs) {
      const cx = (x - part.x) * k;
      if (cx < left - r || cx > right + r) continue;
      ctx.beginPath();
      ctx.arc(cx, cy, r, 0, Math.PI * 2);
      ctx.fill();
    }
  }
}
