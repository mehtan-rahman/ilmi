// The paper of a written notebook's sheet (milestones 82, 85): blank, ruled,
// a grid, dots. A sheet is Letter or A4, upright or on its side, and its
// paper is said in the sheet's points, so it is the same at any zoom. A
// notebook's page setup (`paperOf`: its front-matter's `paper-rule`,
// `paper-margin`, `paper-top`, `paper-size`, `paper-turn`, `pageless`) says
// how far apart the rules, lines or dots are, where a margin rule stands,
// how far down the first rule is, and whether the sheets run on as one: then
// the ruling of each carries on from the one before, as if they were one
// long sheet. On the pages the paper is an inline SVG (`Pdf.tsx`): the rules
// one path of hairlines that stay a pixel wide however far the page is
// zoomed, the dots a path of round dashes that grow with it as the dots of a
// real page would. In a note, where a clip of a sheet is drawn
// (`bookPdf.ts`), the same paper is drawn onto the clip's canvas; in a PDF of
// the pages the same measures are drawn again (`native/ink.m`). White paper,
// the rules a pale blue-grey, light enough to write over, the margin a pale
// red; dark paper and e-ink turn it as they turn a PDF's page (`pdf.css`).

import type { PaperKind, WrittenMeta } from '../format/index.js';

/** A Letter sheet upright, in points: what a notebook's sheets are unless its page setup says otherwise. */
export const PAPER_W = 612;
export const PAPER_H = 792;
/** An A4 sheet upright, in points. */
export const A4_W = 595;
export const A4_H = 842;
/** The paper itself, and what is ruled on it. */
export const PAPER_WHITE = '#ffffff';
export const PAPER_RULE = '#c3cfdd';
/** The dots are small, so a little heavier than a rule to read as lightly. */
export const PAPER_DOT = '#a9b7c8';
/** The margin rule of a ruled sheet. */
export const PAPER_MARGIN = '#e7b9b9';

/** Ruled: a line every 24 points, the first an inch down, unless the page setup says otherwise. */
export const RULE_STEP = 24;
export const RULE_TOP = 72;
/** A grid's squares and a dotted page's pitch, unless the page setup says otherwise. */
export const GRID_STEP = 20;
/** Where a margin rule stands when it is first turned on: an inch and a quarter in. */
export const MARGIN_AT = 90;
/** A dot's width, in points. */
const DOT = 1.5;
/** A millimetre, in points. */
export const MM = 72 / 25.4;

/** A sheet's paper, with everything said: what it is ruled with, its size, the ruling's measures, and where it begins on the long sheet a pageless notebook is. */
export interface PaperSpec {
  kind: PaperKind;
  /** The sheet, in points. */
  w: number;
  h: number;
  /** How far apart the rules, the grid's lines or the dots are. */
  rule: number;
  /** Where the margin rule stands from the left edge; null for none. A ruled sheet's alone. */
  margin: number | null;
  /** How far down the first rule is. A ruled sheet's alone. */
  top: number;
  /** The sheets run on as one: this one begins `at` points down it, and its ruling carries on from the one before. */
  run: boolean;
  at: number;
}

/** The size of a notebook's sheets, in points. */
export function sheetSize(w: Pick<WrittenMeta, 'size' | 'turn'> | undefined): { w: number; h: number } {
  const [a, b] = w?.size === 'a4' ? [A4_W, A4_H] : [PAPER_W, PAPER_H];
  return w?.turn === 'landscape' ? { w: b, h: a } : { w: a, h: b };
}

/** How far apart a paper's rules are when its page setup does not say. */
export const ruleOf = (kind: PaperKind): number => (kind === 'ruled' ? RULE_STEP : GRID_STEP);

/** The paper of a notebook's sheet, the `index`th of its sheets (from 0): the page setup its front-matter gives, and what stands in where it gives none. */
export function paperOf(w: Pick<WrittenMeta, 'paper' | 'rule' | 'margin' | 'top' | 'size' | 'turn' | 'pageless'>, index = 0): PaperSpec {
  const size = sheetSize(w);
  return {
    kind: w.paper, ...size,
    rule: w.rule ?? ruleOf(w.paper),
    margin: w.paper === 'ruled' ? w.margin ?? null : null,
    top: w.top ?? RULE_TOP,
    run: !!w.pageless,
    at: w.pageless ? index * size.h : 0,
  };
}

/** A paper by its kind alone: a Letter sheet with the measures a new notebook has. */
const plain = (kind: PaperKind): PaperSpec => ({ kind, w: PAPER_W, h: PAPER_H, rule: ruleOf(kind), margin: null, top: RULE_TOP, run: false, at: 0 });
const specOf = (p: PaperKind | PaperSpec): PaperSpec => (typeof p === 'string' ? plain(p) : p);

/**
 * The lines of a paper, in the sheet's points: horizontal ones by their `y`,
 * vertical ones by their `x`, the margin rule's `x`, and where the dots are.
 * A grid and a dotted page are centred on the sheet; a ruled sheet's last
 * rule leaves a line's room at its foot. Where the sheets run on as one, the
 * ruling is the long sheet's: each line where it falls on this piece of it.
 */
export function paperLines(p: PaperKind | PaperSpec): { rows: number[]; cols: number[]; margin: number | null; dots: { xs: number[]; ys: number[] } | null } {
  const { kind, w, h, rule, margin, top, run, at } = specOf(p);
  const step = Math.max(2, rule);
  const steps = (from: number, to: number): number[] => {
    const out: number[] = [];
    for (let v = from; v <= to + 1e-6; v += step) out.push(Math.round(v * 1000) / 1000);
    return out;
  };
  /** The long sheet's lines from `first` on, that fall on this piece of it. */
  const running = (first: number): number[] => {
    const k = Math.max(0, Math.ceil((at - first) / step - 1e-9));
    const out: number[] = [];
    for (let v = first + k * step - at; v < h - 1e-6; v += step) out.push(Math.round(v * 1000) / 1000);
    return out;
  };
  const offX = (w % step) / 2;
  const offY = (h % step) / 2;
  if (kind === 'ruled') return { rows: run ? running(top) : steps(top, h - step), cols: [], margin: margin !== null && margin > 0 && margin < w ? margin : null, dots: null };
  if (kind === 'grid') return { rows: run ? running(offY) : steps(offY, h - offY), cols: steps(offX, w - offX), margin: null, dots: null };
  if (kind === 'dotted') return { rows: [], cols: [], margin: null, dots: { xs: steps(offX + step, w - offX - step), ys: run ? running(offY + step) : steps(offY + step, h - offY - step) } };
  return { rows: [], cols: [], margin: null, dots: null };
}

/**
 * A paper as the paths of an SVG whose view box is the sheet in points:
 * `rules` every line (drawn with a stroke that does not scale; with `on`, each
 * on whole pixels of the screen), `margin` the
 * margin rule, `dots` a row of zero-length dashes `pitch` apart for each row
 * of dots (drawn `width` wide with round caps). Empty where the paper has
 * none.
 */
export function paperPaths(p: PaperKind | PaperSpec, on?: { px: number; w: number }): { rules: string; margin: string; dots: string; pitch: number; width: number; w: number; h: number } {
  const spec = specOf(p);
  const { rows, cols, margin, dots } = paperLines(spec);
  // drawn `on.px` pixels of the screen to the point with a stroke `on.w` of them wide, a line covers whole pixels: its
  // middle is moved (by under half a pixel) to where its edges fall between two (86)
  const at = (v: number): number => (on && on.px > 0 ? Math.round(((Math.round(v * on.px - on.w / 2) + on.w / 2) / on.px) * 10000) / 10000 : v);
  const rules = [...rows.map((y) => `M0 ${at(y)}H${spec.w}`), ...cols.map((x) => `M${at(x)} 0V${spec.h}`)].join('');
  const row = dots && dots.xs.length ? dots.ys.map((y) => `M${dots.xs[0]} ${y}H${dots.xs[dots.xs.length - 1]! + 0.01}`).join('') : '';
  return { rules, margin: margin === null ? '' : `M${at(margin)} 0V${spec.h}`, dots: row, pitch: Math.max(2, spec.rule), width: DOT, w: spec.w, h: spec.h };
}

/** How many pixels of the screen wide a rule is drawn, the paper `px` of them to the point: half a point, never under one. */
export const ruleWidth = (px: number): number => Math.max(1, Math.round(px * 0.5));

/**
 * The paper drawn onto a canvas: the part of the sheet at `x`, `y`, `w` by
 * `h` points, `k` canvas pixels to the point, from the canvas's top left.
 * The rules are a pixel wide and lie on whole pixels.
 */
export function drawPaper(ctx: CanvasRenderingContext2D, p: PaperKind | PaperSpec, part: { x: number; y: number; w: number; h: number }, k: number): void {
  const spec = specOf(p);
  const W = part.w * k;
  const H = part.h * k;
  // off the sheet's edge (the room kept round a clip) is the desk's: left as it is
  const left = Math.max(0, -part.x) * k;
  const top = Math.max(0, -part.y) * k;
  const right = Math.min(W, (spec.w - part.x) * k);
  const bottom = Math.min(H, (spec.h - part.y) * k);
  if (right <= left || bottom <= top) return;
  ctx.fillStyle = PAPER_WHITE;
  ctx.fillRect(left, top, right - left, bottom - top);
  const { rows, cols, margin, dots } = paperLines(spec);
  ctx.fillStyle = PAPER_RULE;
  for (const y of rows) {
    const at = Math.round((y - part.y) * k);
    if (at >= top && at < bottom) ctx.fillRect(left, at, right - left, 1);
  }
  for (const x of cols) {
    const at = Math.round((x - part.x) * k);
    if (at >= left && at < right) ctx.fillRect(at, top, 1, bottom - top);
  }
  if (margin !== null) {
    const at = Math.round((margin - part.x) * k);
    ctx.fillStyle = PAPER_MARGIN;
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
