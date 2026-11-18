// The paper of a written notebook's sheet (milestones 82, 85): blank, ruled,
// a grid, dots. A sheet is Letter or A4, upright or on its side, and its
// paper is said in the sheet's points, so it is the same at any zoom. A
// notebook's page setup (`paperOf`: its front-matter's `paper-rule`,
// `paper-left`, `paper-right`, `paper-top`, `paper-bottom`,
// `paper-margin-line`, `paper-margin-color`, `paper-size`, `paper-turn`,
// `pageless`) says how far apart the rules, lines or dots are, how far in
// from each edge the ruling begins and ends (its margins, milestone 88),
// whether a line is drawn down a margin and in what colour, and whether the
// sheets run on as one: then the ruling of each carries on from the one
// before, and they are one long sheet, as long as what is written on it and
// a little more (`runLength`). On the pages the paper is an inline SVG
// (`Pdf.tsx`): the rules
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
 * shows. The margin line is a pale red unless a colour is chosen for it
 * (`marginColor`, milestone 88), which is drawn as a chosen line colour is.
 * Ink is drawn the dark way (black and white swapped as PencilKit's dark
 * appearance has them, lightening what it lies on) exactly when `dark`.
 */
export function paperLook(spec: { color?: string | null | undefined; line?: string | null | undefined; marginColor?: string | null | undefined } | null | undefined, theme: 'light' | 'dark' | 'eink'): PaperLook {
  const color = paperHex(spec?.color);
  const line = paperHex(spec?.line);
  const edge = paperHex(spec?.marginColor);
  if (color) {
    const dark = isDarkColor(color);
    return { paper: color, rule: line ?? (dark ? PAPER_RULE_DARK : PAPER_RULE), dot: line ?? (dark ? PAPER_DOT_DARK : PAPER_DOT), margin: edge ?? (dark ? PAPER_MARGIN_DARK : PAPER_MARGIN), dark };
  }
  if (theme === 'dark') return { paper: PAPER_DARK, rule: line ? turned(line) : PAPER_RULE_DARK, dot: line ? turned(line) : PAPER_DOT_DARK, margin: edge ? turned(edge) : PAPER_MARGIN_DARK, dark: true };
  if (theme === 'eink') return { paper: PAPER_WHITE, rule: line ?? PAPER_RULE_EINK, dot: line ?? PAPER_RULE_EINK, margin: edge ?? PAPER_MARGIN_EINK, dark: false };
  return { paper: PAPER_WHITE, rule: line ?? PAPER_RULE, dot: line ?? PAPER_DOT, margin: edge ?? PAPER_MARGIN, dark: false };
}

/** Ruled: a line every 24 points, the first an inch down, unless the page setup says otherwise. */
export const RULE_STEP = 24;
export const RULE_TOP = 72;
/** A grid's squares and a dotted page's pitch, unless the page setup says otherwise. */
export const GRID_STEP = 20;
/** A millimetre, in points. */
export const MM = 72 / 25.4;
/** A new notebook's margins (milestone 88): ruled paper's rules begin and end 12 mm in from the sides; a grid and dots keep 8 mm clear all round. */
export const RULED_INSET = Math.round(12 * MM * 100) / 100;
export const GRID_INSET = Math.round(8 * MM * 100) / 100;
/** The margin a margin line turned on stands at when the sheet has none there. */
export const MARGIN_AT = RULED_INSET;
/** How much bare paper a pageless notebook keeps under the lowest thing written on it, in points: eight rules of a new notebook's. */
export const RUN_ALLOW = 192;
/** A dot's width, in points. */
const DOT = 1.5;
/** The margin line's colours offered by name, after the pale red it has when none is chosen. */
export const MARGIN_COLORS: readonly { name: string; value: string }[] = [
  { name: 'blue-grey', value: PAPER_RULE },
  { name: 'grey', value: '#c9cdd2' },
  { name: 'blue', value: '#b5d2f2' },
  { name: 'green', value: '#bcdcc0' },
];

/** The margins a new notebook of a paper starts with, where this device keeps no page setup of its own: each as the front-matter says it. */
export function newInsets(kind: PaperKind): { left: number | null; right: number | null; top: number | null; bottom: number | null } {
  if (kind === 'ruled') return { left: RULED_INSET, right: RULED_INSET, top: null, bottom: null };
  if (kind === 'blank') return { left: null, right: null, top: null, bottom: null };
  return { left: GRID_INSET, right: GRID_INSET, top: GRID_INSET, bottom: GRID_INSET };
}

/** A sheet's paper, with everything said: what it is ruled with, its size, the ruling's measures, and where it begins on the long sheet a pageless notebook is. */
export interface PaperSpec {
  kind: PaperKind;
  /** The sheet, in points. */
  w: number;
  h: number;
  /** How far apart the rules, the grid's lines or the dots are. */
  rule: number;
  /** The margins (milestone 88): how far in from the left edge and from the right the ruling begins and ends; 0 for none. */
  left: number;
  right: number;
  /** How far down a ruled sheet the first rule is; the room a grid or dots keep at the head. */
  top: number;
  /** The room under a ruled page's last rule; what a grid or dots keep at the foot. A page's: a pageless notebook's ruling runs on. */
  bottom: number;
  /** Where a line is drawn down the sheet, each from the left edge: at a margin (`paper-margin-line`), or where 85's `paper-margin` says. */
  lines: number[];
  /** The sheets run on as one: this one begins `at` points down it, and its ruling carries on from the one before. */
  run: boolean;
  at: number;
  /** The paper's colour, `#rrggbb`; null where it follows the theme (`paperLook`). */
  color: string | null;
  /** The colour of its rules, grid lines and dots, `#rrggbb`; null for the paper's own. */
  line: string | null;
  /** The margin line's colour, `#rrggbb`; null for the pale red it has. */
  marginColor: string | null;
}

/** The size of a notebook's sheets, in points. */
export function sheetSize(w: Pick<WrittenMeta, 'size' | 'turn'> | undefined): { w: number; h: number } {
  const [a, b] = w?.size === 'a4' ? [A4_W, A4_H] : [PAPER_W, PAPER_H];
  return w?.turn === 'landscape' ? { w: b, h: a } : { w: a, h: b };
}

/** How far apart a paper's rules are when its page setup does not say. */
export const ruleOf = (kind: PaperKind): number => (kind === 'ruled' ? RULE_STEP : GRID_STEP);

const round3 = (v: number): number => Math.round(v * 1000) / 1000;

/**
 * The paper of a notebook's sheet, the `index`th of its sheets (from 0): the
 * page setup its front-matter gives, and what stands in where it gives none.
 * A file with none of 88's fields reads as it did: no margins, a ruled
 * sheet's first rule an inch down and a rule's room at its foot, a grid and
 * dots to the sheet's edges, and 85's `paper-margin` a line with the rules
 * run on under it.
 */
export function paperOf(w: Pick<WrittenMeta, 'paper' | 'rule' | 'margin' | 'marginRight' | 'left' | 'right' | 'marginLine' | 'marginColor' | 'top' | 'bottom' | 'size' | 'turn' | 'pageless' | 'color' | 'line'>, index = 0): PaperSpec {
  const size = sheetSize(w);
  const rule = w.rule ?? ruleOf(w.paper);
  let left = Math.max(0, w.left ?? 0);
  let right = Math.max(0, w.right ?? 0);
  // (margins that leave no room for a rule's spacing between them are none)
  if (left + right > size.w - Math.max(2, rule)) { left = 0; right = 0; }
  const lines: number[] = [];
  const put = (x: number) => { if (x > 0 && x < size.w && !lines.some((v) => Math.abs(v - x) < 0.5)) lines.push(round3(x)); };
  if (w.margin !== undefined) put(w.margin);
  if ((w.marginLine === 'left' || w.marginLine === 'both') && left > 0) put(left);
  if ((w.marginLine === 'right' || w.marginLine === 'both') && right > 0) put(size.w - right);
  if (w.marginRight !== undefined && (!lines.length || size.w - w.marginRight > Math.min(...lines))) put(size.w - w.marginRight);
  return {
    kind: w.paper, ...size, rule, left, right,
    top: w.paper === 'ruled' ? w.top ?? RULE_TOP : w.paper === 'blank' ? 0 : w.top ?? 0,
    bottom: w.paper === 'ruled' ? w.bottom ?? rule : w.paper === 'blank' ? 0 : w.bottom ?? 0,
    lines: lines.sort((a, b) => a - b),
    run: !!w.pageless,
    at: w.pageless ? index * size.h : 0,
    color: paperHex(w.color),
    line: paperHex(w.line),
    marginColor: paperHex(w.marginColor),
  };
}

/** A paper by its kind alone: a Letter sheet as one was before there were margins. */
const plain = (kind: PaperKind): PaperSpec => ({ kind, w: PAPER_W, h: PAPER_H, rule: ruleOf(kind), left: 0, right: 0, top: kind === 'ruled' ? RULE_TOP : 0, bottom: kind === 'ruled' ? RULE_STEP : 0, lines: [], run: false, at: 0, color: null, line: null, marginColor: null });
const specOf = (p: PaperKind | PaperSpec): PaperSpec => (typeof p === 'string' ? plain(p) : p);

/** Where a pageless notebook's ruling begins down its long sheet, and what a grid that runs to the sheet's edges keeps clear at each (none once it has room at its head). */
function runPhase(p: PaperSpec): { step: number; first: number; edge: number } {
  if (p.kind === 'blank') return { step: RULE_STEP, first: 0, edge: 0 };
  const step = Math.max(2, p.rule);
  if (p.kind === 'ruled') return { step, first: p.top % step, edge: 0 };
  const edge = p.top > 0 ? 0 : (p.h % step) / 2;
  return { step, first: p.top > 0 ? p.top % step : edge, edge };
}

/**
 * How long a pageless notebook's one sheet is drawn, in points from its top
 * (milestone 88): down to `foot`, the lowest thing written on it, and
 * `RUN_ALLOW` of bare paper more, and from there to the next whole rule,
 * grid square or dot pitch down its ruling (blank paper counts in a new
 * notebook's rules), so it grows a line at a time and its foot never cuts a
 * line's room in two. What fits on one sheet is one sheet, whole. The same
 * on every device, from what is written alone: nothing of it is kept.
 */
export function runLength(p: PaperSpec, foot: number): number {
  const need = (Number.isFinite(foot) ? Math.max(0, foot) : 0) + RUN_ALLOW;
  // (what fits on one sheet is one sheet, whole)
  if (need <= p.h) return p.h;
  const { step, first, edge } = runPhase(p);
  return round3(first + Math.ceil((need - first - edge) / step - 1e-9) * step + edge);
}

/** What `paperLines` says of a paper. */
export interface PaperLines {
  /** Horizontal lines by their `y`, each drawn from `rowSpan[0]` to `rowSpan[1]` across the sheet. */
  rows: number[];
  rowSpan: [number, number];
  /** Vertical lines by their `x`, each drawn from `colSpan[0]` to `colSpan[1]` down it. */
  cols: number[];
  colSpan: [number, number];
  /** The margin lines' `x`, each the sheet's whole height. */
  margins: number[];
  dots: { xs: number[]; ys: number[] } | null;
}

/**
 * The lines of a paper, in the sheet's points. The ruling lies between the
 * margins (milestone 88): a ruled sheet's rules begin `left` in and end
 * `right` from the right edge, the first `top` down and none nearer the foot
 * than `bottom`; a grid and dots are centred in what the four leave, a grid
 * closed at the margins it has (its lines end on its outermost lines), dots
 * on every crossing. With no margin at an edge the ruling is as it was
 * before there were any: rules and a grid's lines to the sheet's edge, dots
 * a pitch short of it. The margin lines run the sheet's whole height. Where
 * the sheets run on as one, the ruling is the long sheet's: each line where
 * it falls on this piece of it, with no foot.
 */
export function paperLines(p: PaperKind | PaperSpec): PaperLines {
  const { kind, w, h, rule, left, right, top, bottom, run, at, lines } = specOf(p);
  const step = Math.max(2, rule);
  const steps = (from: number, to: number): number[] => {
    const out: number[] = [];
    for (let v = from; v <= to + 1e-6; v += step) out.push(round3(v));
    return out;
  };
  /** The long sheet's lines from `first` on, that fall on this piece of it. */
  const running = (first: number): number[] => {
    const k = Math.max(0, Math.ceil((at - first) / step - 1e-9));
    const out: number[] = [];
    for (let v = first + k * step - at; v < h - 1e-6; v += step) out.push(round3(v));
    return out;
  };
  const [x0, x1] = [left, round3(w - right)];
  const none: PaperLines = { rows: [], rowSpan: [x0, x1], cols: [], colSpan: [0, h], margins: lines, dots: null };
  if (kind === 'blank') return none;
  if (kind === 'ruled') return { ...none, rows: run ? running(top) : steps(top, h - bottom) };
  // a grid, and dots on its crossings: centred in what the margins leave
  const head = top > 0;
  const foot = !run && bottom > 0;
  const offX = ((x1 - x0) % step) / 2;
  const xs = steps(x0 + offX, x1 - offX);
  let ys: number[];
  if (run) ys = running(head ? top : (h % step) / 2);
  else { const [y0, y1] = [top, h - bottom]; const offY = ((y1 - y0) % step) / 2; ys = steps(y0 + offY, y1 - offY); }
  // each line ends on the grid's outermost line at an edge that has a margin, and runs to the sheet's edge at one that
  // has none (the head of a long sheet's grid is where its first line is; below, its lines run through)
  const colSpan: [number, number] = run ? [head && at < top ? round3(top - at) : 0, h] : [head && ys.length ? ys[0]! : 0, foot && ys.length ? ys[ys.length - 1]! : h];
  const rowSpan: [number, number] = [left > 0 && xs.length ? xs[0]! : 0, right > 0 && xs.length ? xs[xs.length - 1]! : w];
  if (kind === 'grid') return { rows: ys, rowSpan, cols: xs, colSpan, margins: lines, dots: null };
  // dots: at an edge with no margin, none on the outermost crossings there (as before 88)
  const dx = xs.slice(left > 0 ? 0 : 1, right > 0 ? xs.length : -1);
  const dy = run ? (head ? ys : running((h % step) / 2 + step)) : ys.slice(head ? 0 : 1, foot ? ys.length : -1);
  return { ...none, rowSpan, colSpan, dots: { xs: dx, ys: dy } };
}

/**
 * A paper as the paths of an SVG whose view box is the sheet in points:
 * `rules` every line (drawn with a stroke that does not scale; with `on`, each
 * on whole pixels of the screen), `margin` the margin lines, `dots` a row of
 * zero-length dashes `pitch` apart for each row of dots (drawn `width` wide
 * with round caps). Empty where the paper has none.
 */
export function paperPaths(p: PaperKind | PaperSpec, on?: { px: number; w: number }): { rules: string; margin: string; dots: string; pitch: number; width: number; w: number; h: number } {
  const spec = specOf(p);
  const { rows, rowSpan, cols, colSpan, margins, dots } = paperLines(spec);
  // drawn `on.px` pixels of the screen to the point with a stroke `on.w` of them wide, a line covers whole pixels: its
  // middle is moved (by under half a pixel) to where its edges fall between two (86)
  const at = (v: number): number => (on && on.px > 0 ? Math.round(((Math.round(v * on.px - on.w / 2) + on.w / 2) / on.px) * 10000) / 10000 : v);
  const rules = [...rows.map((y) => `M${rowSpan[0]} ${at(y)}H${rowSpan[1]}`), ...cols.map((x) => `M${at(x)} ${colSpan[0]}V${colSpan[1]}`)].join('');
  const row = dots && dots.xs.length ? dots.ys.map((y) => `M${dots.xs[0]} ${y}H${dots.xs[dots.xs.length - 1]! + 0.01}`).join('') : '';
  return { rules, margin: margins.map((x) => `M${at(x)} 0V${spec.h}`).join(''), dots: row, pitch: Math.max(2, spec.rule), width: DOT, w: spec.w, h: spec.h };
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
  const { rows, rowSpan, cols, colSpan, margins, dots } = paperLines(spec);
  // (each line only as far as it runs on the sheet, and only what of that is on the canvas)
  const [rx0, rx1] = [Math.max(left, Math.round((rowSpan[0] - part.x) * k)), Math.min(right, Math.round((rowSpan[1] - part.x) * k))];
  const [cy0, cy1] = [Math.max(top, Math.round((colSpan[0] - part.y) * k)), Math.min(bottom, Math.round((colSpan[1] - part.y) * k))];
  ctx.fillStyle = ruleColor;
  if (rx1 > rx0) for (const y of rows) {
    const at = Math.round((y - part.y) * k);
    if (at >= top && at < bottom) ctx.fillRect(rx0, at, rx1 - rx0, 1);
  }
  if (cy1 > cy0) for (const x of cols) {
    const at = Math.round((x - part.x) * k);
    if (at >= left && at < right) ctx.fillRect(at, cy0, 1, cy1 - cy0);
  }
  if (dots) {
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
  }
  if (!margins.length) return;
  ctx.fillStyle = marginColor;
  for (const x of margins) {
    const at = Math.round((x - part.x) * k);
    if (at >= left && at < right) ctx.fillRect(at, top, 1, bottom - top);
  }
}
