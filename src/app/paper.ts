// The paper of a written notebook's sheet (milestones 82, 85): blank, ruled,
// a grid, dots. A sheet is Letter or A4, upright or on its side, and its
// paper is said in the sheet's points, so it is the same at any zoom. A
// notebook's page setup (`paperOf`: its front-matter's `paper-rule`,
// `paper-margin`, `paper-margin-right`, `paper-top`, `paper-bottom`,
// `paper-size`, `paper-turn`, `pageless`) says how far apart the rules, lines
// or dots are, where a margin rule stands at the left and at the right, how
// far down the first rule is and how much room the last leaves, and whether
// the sheets run on as one: then the ruling of each carries on from the one
// before, and they are one long sheet, as long as what is written on it and
// a little more (`runLength`, milestone 88). On the pages the paper is an inline SVG (`Pdf.tsx`): the rules
// one path of hairlines that stay a pixel wide however far the page is
// zoomed, the dots a path of round dashes that grow with it as the dots of a
// real page would. In a note, where a clip of a sheet is drawn
// (`bookPdf.ts`), the same paper is drawn onto the clip's canvas; in a PDF of
// the pages the same measures are drawn again (`native/ink.m`). White paper,
// the rules a pale blue-grey, light enough to write over, the margin a pale
// red, unless the page setup says a colour for the paper (`paper-color`) or
// for what is ruled on it (`paper-line`; milestone 87). `paperLook` says the
// colours a sheet is drawn with, final, in a theme: paper with no colour of
// its own follows the theme (dark paper as a dark theme turns a PDF's page),
// a chosen colour is used as chosen in every theme, and ink is drawn the
// dark way exactly on paper that is dark.

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
/** A sheet's margin rules. */
export const PAPER_MARGIN = '#e7b9b9';

/**
 * Paper that follows a dark theme: what CSS `invert(0.92) hue-rotate(180deg)`
 * (how a dark theme turns a PDF's page, `pdf.css`) makes of white, of
 * `PAPER_RULE`, of `PAPER_DOT` and of `PAPER_MARGIN` (`turned`).
 */
export const PAPER_DARK = '#141414';
export const PAPER_RULE_DARK = '#353f4b';
export const PAPER_DOT_DARK = '#485462';
export const PAPER_MARGIN_DARK = '#653f3f';
/** E-ink: white paper, its rules and dots a grey that prints, the margin rule the grey its red comes to. */
export const PAPER_RULE_EINK = '#8f8f8f';
export const PAPER_MARGIN_EINK = '#c9c9c9';

/** The paper colours offered by name in `page setup`. */
export const PAPER_COLORS: readonly { name: string; value: string }[] = [
  { name: 'white', value: '#ffffff' },
  { name: 'cream', value: '#fbf6e9' },
  { name: 'yellow', value: '#fff6c8' },
  { name: 'grey', value: '#eceef0' },
  { name: 'dark', value: '#1c1c1e' },
];
/** The line colours offered by name: the first is what a sheet has when none is chosen. */
export const LINE_COLORS: readonly { name: string; value: string }[] = [
  { name: 'blue-grey', value: PAPER_RULE },
  { name: 'grey', value: '#c9cdd2' },
  { name: 'blue', value: '#b5d2f2' },
  { name: 'red', value: '#f0c2c2' },
  { name: 'green', value: '#bcdcc0' },
];

const HEX = /^#[0-9a-f]{6}$/;
/** A colour as a page setup keeps it: `#rrggbb` in lowercase; null for anything else. */
export const paperHex = (c: unknown): string | null => (typeof c === 'string' && HEX.test(c.toLowerCase()) ? c.toLowerCase() : null);
const rgb = (hex: string): [number, number, number] => [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16) / 255) as [number, number, number];
const hexOf = (c: readonly number[]): string => `#${c.map((v) => Math.round(Math.min(1, Math.max(0, v)) * 255).toString(16).padStart(2, '0')).join('')}`;

/** A colour as a dark theme turns it: what CSS `invert(0.92) hue-rotate(180deg)` makes of it. Light comes out dark with its hue kept. */
export function turned(hex: string): string {
  const [r, g, b] = rgb(paperHex(hex) ?? '#ffffff').map((v) => 0.92 - 0.84 * v) as [number, number, number];
  // the hue turned half way round: the filter's matrix at 180 degrees
  return hexOf([-0.574 * r + 1.43 * g + 0.144 * b, 0.426 * r + 0.43 * g + 0.144 * b, 0.426 * r + 1.43 * g - 0.856 * b]);
}

/** Whether a colour is dark enough that ink on it is drawn the dark way: relative luminance under 0.4. */
export function isDarkColor(hex: string): boolean {
  const c = paperHex(hex);
  if (!c) return false;
  const [r, g, b] = rgb(c).map((v) => (v <= 0.04045 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4)) as [number, number, number];
  return 0.2126 * r + 0.7152 * g + 0.0722 * b < 0.4;
}

/** The colours a sheet is drawn with, final sRGB `#rrggbb` values needing no CSS filter. `dark`: the paper is dark, so ink on it is drawn the dark way (see below). */
export interface PaperLook { paper: string; rule: string; dot: string; margin: string; dark: boolean }

/**
 * The colours of a sheet in a theme. With no colour of its own the paper
 * follows the theme: white in the light one, dark in the dark one (what the
 * theme makes of a PDF's white page), white with grey rules on e-ink. A
 * chosen paper colour is the paper in every theme. A chosen line colour is
 * the rules', the grid's lines' and the dots', as chosen; on paper that
 * follows a dark theme it is turned as that paper's own rules are, so it
 * shows. The margin rule keeps its own colour, turned on dark paper. Ink is
 * drawn the dark way (black and white swapped as PencilKit's dark
 * appearance has them, lightening what it lies on) exactly when `dark`.
 */
export function paperLook(spec: { color?: string | null | undefined; line?: string | null | undefined } | null | undefined, theme: 'light' | 'dark' | 'eink'): PaperLook {
  const color = paperHex(spec?.color);
  const line = paperHex(spec?.line);
  if (color) {
    const dark = isDarkColor(color);
    return { paper: color, rule: line ?? (dark ? PAPER_RULE_DARK : PAPER_RULE), dot: line ?? (dark ? PAPER_DOT_DARK : PAPER_DOT), margin: dark ? PAPER_MARGIN_DARK : PAPER_MARGIN, dark };
  }
  if (theme === 'dark') return { paper: PAPER_DARK, rule: line ? turned(line) : PAPER_RULE_DARK, dot: line ? turned(line) : PAPER_DOT_DARK, margin: PAPER_MARGIN_DARK, dark: true };
  if (theme === 'eink') return { paper: PAPER_WHITE, rule: line ?? PAPER_RULE_EINK, dot: line ?? PAPER_RULE_EINK, margin: PAPER_MARGIN_EINK, dark: false };
  return { paper: PAPER_WHITE, rule: line ?? PAPER_RULE, dot: line ?? PAPER_DOT, margin: PAPER_MARGIN, dark: false };
}

/** Ruled: a line every 24 points, the first an inch down, unless the page setup says otherwise. */
export const RULE_STEP = 24;
export const RULE_TOP = 72;
/** A grid's squares and a dotted page's pitch, unless the page setup says otherwise. */
export const GRID_STEP = 20;
/** Where a margin rule stands when it is first turned on: an inch and a quarter in from its edge. */
export const MARGIN_AT = 90;
/** How much bare paper a pageless notebook keeps under the lowest thing written on it, in points: eight rules of a new notebook's. */
export const RUN_ALLOW = 192;
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
  /** Where the left margin rule stands from the left edge; null for none. */
  margin: number | null;
  /** Where the right margin rule stands from the right edge; null for none. */
  marginRight: number | null;
  /** How far down the first rule is. A ruled sheet's alone. */
  top: number;
  /** How much room is left under the last rule; null for a rule's. A ruled sheet's alone, and a page's (a pageless notebook's rules run on). */
  bottom: number | null;
  /** The sheets run on as one: this one begins `at` points down it, and its ruling carries on from the one before. */
  run: boolean;
  at: number;
  /** The paper's colour, `#rrggbb`; null where it follows the theme (`paperLook`). */
  color: string | null;
  /** The colour of its rules, grid lines and dots, `#rrggbb`; null for the paper's own. */
  line: string | null;
}

/** The size of a notebook's sheets, in points. */
export function sheetSize(w: Pick<WrittenMeta, 'size' | 'turn'> | undefined): { w: number; h: number } {
  const [a, b] = w?.size === 'a4' ? [A4_W, A4_H] : [PAPER_W, PAPER_H];
  return w?.turn === 'landscape' ? { w: b, h: a } : { w: a, h: b };
}

/** How far apart a paper's rules are when its page setup does not say. */
export const ruleOf = (kind: PaperKind): number => (kind === 'ruled' ? RULE_STEP : GRID_STEP);

/** The paper of a notebook's sheet, the `index`th of its sheets (from 0): the page setup its front-matter gives, and what stands in where it gives none. */
export function paperOf(w: Pick<WrittenMeta, 'paper' | 'rule' | 'margin' | 'marginRight' | 'top' | 'bottom' | 'size' | 'turn' | 'pageless' | 'color' | 'line'>, index = 0): PaperSpec {
  const size = sheetSize(w);
  return {
    kind: w.paper, ...size,
    rule: w.rule ?? ruleOf(w.paper),
    margin: w.margin ?? null,
    marginRight: w.marginRight ?? null,
    top: w.top ?? RULE_TOP,
    bottom: w.paper === 'ruled' ? w.bottom ?? null : null,
    run: !!w.pageless,
    at: w.pageless ? index * size.h : 0,
    color: paperHex(w.color),
    line: paperHex(w.line),
  };
}

/** A paper by its kind alone: a Letter sheet with the measures a new notebook has. */
const plain = (kind: PaperKind): PaperSpec => ({ kind, w: PAPER_W, h: PAPER_H, rule: ruleOf(kind), margin: null, marginRight: null, top: RULE_TOP, bottom: null, run: false, at: 0, color: null, line: null });
const specOf = (p: PaperKind | PaperSpec): PaperSpec => (typeof p === 'string' ? plain(p) : p);

/**
 * How long a pageless notebook's one sheet is drawn, in points from its top
 * (milestone 88): down to `foot`, the lowest thing written on it, and
 * `RUN_ALLOW` of bare paper more, never under one sheet, and ending a whole
 * number of rules, grid squares or dot pitches down its ruling (blank paper
 * counts in a new notebook's rules), so it grows a line at a time and its
 * foot never cuts a line's room in two. The same on every device, from what
 * is written alone: nothing of it is kept.
 */
export function runLength(p: PaperSpec, foot: number): number {
  const need = (Number.isFinite(foot) ? Math.max(0, foot) : 0) + RUN_ALLOW;
  // (what fits on one sheet is one sheet, whole)
  if (need <= p.h) return p.h;
  const step = p.kind === 'blank' ? RULE_STEP : Math.max(2, p.rule);
  // where the ruling begins, and what a centred grid keeps clear at an edge
  const edge = p.kind === 'grid' || p.kind === 'dotted' ? (p.h % step) / 2 : 0;
  const first = p.kind === 'ruled' ? p.top % step : edge;
  return Math.round((first + Math.ceil((need - first - edge) / step - 1e-9) * step + edge) * 1000) / 1000;
}

/**
 * The lines of a paper, in the sheet's points: horizontal ones by their `y`,
 * vertical ones by their `x`, the margin rules' `x` (`margin` the left one's,
 * `marginRight` the right one's, each from the sheet's left edge), and where
 * the dots are. A grid and a dotted page are centred on the sheet; a ruled
 * sheet's last rule leaves a line's room at its foot, or what its page setup
 * says. The rules, the grid and the dots run the sheet's whole width, under
 * the margin rules, as on paper. Where the sheets run on as one, the ruling
 * is the long sheet's: each line where it falls on this piece of it.
 */
export function paperLines(p: PaperKind | PaperSpec): { rows: number[]; cols: number[]; margin: number | null; marginRight: number | null; dots: { xs: number[]; ys: number[] } | null } {
  const { kind, w, h, rule, top, run, at, bottom } = specOf(p);
  const spec = specOf(p);
  const margin = spec.margin !== null && spec.margin > 0 && spec.margin < w ? spec.margin : null;
  const right = spec.marginRight !== null && spec.marginRight > 0 && spec.marginRight < w ? Math.round((w - spec.marginRight) * 1000) / 1000 : null;
  const marginRight = right !== null && (margin === null || right > margin) ? right : null;
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
  if (kind === 'ruled') return { rows: run ? running(top) : steps(top, h - (bottom ?? step)), cols: [], margin, marginRight, dots: null };
  if (kind === 'grid') return { rows: run ? running(offY) : steps(offY, h - offY), cols: steps(offX, w - offX), margin, marginRight, dots: null };
  if (kind === 'dotted') return { rows: [], cols: [], margin, marginRight, dots: { xs: steps(offX + step, w - offX - step), ys: run ? running(offY + step) : steps(offY + step, h - offY - step) } };
  return { rows: [], cols: [], margin, marginRight, dots: null };
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
  const { rows, cols, margin, marginRight, dots } = paperLines(spec);
  // drawn `on.px` pixels of the screen to the point with a stroke `on.w` of them wide, a line covers whole pixels: its
  // middle is moved (by under half a pixel) to where its edges fall between two (86)
  const at = (v: number): number => (on && on.px > 0 ? Math.round(((Math.round(v * on.px - on.w / 2) + on.w / 2) / on.px) * 10000) / 10000 : v);
  const rules = [...rows.map((y) => `M0 ${at(y)}H${spec.w}`), ...cols.map((x) => `M${at(x)} 0V${spec.h}`)].join('');
  const row = dots && dots.xs.length ? dots.ys.map((y) => `M${dots.xs[0]} ${y}H${dots.xs[dots.xs.length - 1]! + 0.01}`).join('') : '';
  return { rules, margin: [margin, marginRight].filter((x): x is number => x !== null).map((x) => `M${at(x)} 0V${spec.h}`).join(''), dots: row, pitch: Math.max(2, spec.rule), width: DOT, w: spec.w, h: spec.h };
}

/** How many pixels of the screen wide a rule is drawn, the paper `px` of them to the point: half a point, never under one. */
export const ruleWidth = (px: number): number => Math.max(1, Math.round(px * 0.5));

/**
 * The paper drawn onto a canvas: the part of the sheet at `x`, `y`, `w` by
 * `h` points, `k` canvas pixels to the point, from the canvas's top left.
 * The rules are a pixel wide and lie on whole pixels. With the colours of
 * `look`; without one, the paper's own in the light theme.
 */
export function drawPaper(ctx: CanvasRenderingContext2D, p: PaperKind | PaperSpec, part: { x: number; y: number; w: number; h: number }, k: number, look?: PaperLook): void {
  const spec = specOf(p);
  const { paper, rule: ruleColor, dot: dotColor, margin: marginColor } = look ?? paperLook(spec, 'light');
  const W = part.w * k;
  const H = part.h * k;
  // off the sheet's edge (the room kept round a clip) is the desk's: left as it is
  const left = Math.max(0, -part.x) * k;
  const top = Math.max(0, -part.y) * k;
  const right = Math.min(W, (spec.w - part.x) * k);
  const bottom = Math.min(H, (spec.h - part.y) * k);
  if (right <= left || bottom <= top) return;
  ctx.fillStyle = paper;
  ctx.fillRect(left, top, right - left, bottom - top);
  const { rows, cols, margin, marginRight, dots } = paperLines(spec);
  ctx.fillStyle = ruleColor;
  for (const y of rows) {
    const at = Math.round((y - part.y) * k);
    if (at >= top && at < bottom) ctx.fillRect(left, at, right - left, 1);
  }
  for (const x of cols) {
    const at = Math.round((x - part.x) * k);
    if (at >= left && at < right) ctx.fillRect(at, top, 1, bottom - top);
  }
  const dotted = () => {
    if (!dots) return;
    ctx.fillStyle = dotColor;
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
  };
  dotted();
  ctx.fillStyle = marginColor;
  for (const x of [margin, marginRight]) {
    if (x === null) continue;
    const at = Math.round((x - part.x) * k);
    if (at >= left && at < right) ctx.fillRect(at, top, 1, bottom - top);
  }
}
