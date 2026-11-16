// A long list drawn through a window: only the rows near the view are in the
// DOM, in a box as tall as the whole list, so the scrollbar is true. Rows
// vary in height (a face wraps, holds a formula, a table, an image), so each
// row drawn is measured, and the rest stand at the running average of those
// measured; when a measurement corrects an estimate above the view, the
// scroll is moved by the same amount, so the row under the top of the view
// stays where it is. The model here knows nothing of the DOM; what it needs
// of it (the view's height, a row's height, the scroll) is read through
// `probe`, which a test replaces, since jsdom lays nothing out.

/** A list of up to this many rows is drawn whole: no window, as it was before windowing. */
export const WHOLE = 200;
/** Never more rows than this in the window, whatever the heights say (a row measured a pixel tall, a view a mile high). */
export const MAX_DRAWN = 400;
/** A row's height before any is measured: one line of a card's face and its padding. */
export const ROW_GUESS = 46;

/** Rows `start` up to, not including, `end`. */
export interface Win { start: number; end: number }

/** A place in the list that survives the heights changing: a row, and how far into it. */
export interface Anchor { index: number; into: number }

/**
 * The heights of a list's rows: those measured, the rest at an estimate,
 * the average of those measured (`guess` while none is). The estimate does
 * not follow the average row by row: every unmeasured row above the view
 * would shift with it, and the scroll would have to be moved at each
 * measurement; it is brought up to the average by `settle`, which the
 * caller does when that costs nothing (the first rows measured, the view at
 * the list's top). Offsets are prefix sums, built again only after a change.
 */
export class Heights {
  readonly count: number;
  private readonly h: Float64Array;
  private sums: Float64Array | null = null;
  private sum = 0;
  private n = 0;
  private est: number;

  /** `known(i)`: a height measured before for row `i` (the list read again, filtered, sorted), if any. */
  constructor(count: number, guess: number = ROW_GUESS, known?: (i: number) => number | undefined) {
    this.count = count;
    this.h = new Float64Array(count);
    if (known) {
      for (let i = 0; i < count; i++) {
        const v = known(i);
        if (v !== undefined && v > 0) { this.h[i] = v; this.sum += v; this.n++; }
      }
    }
    this.est = this.n ? this.sum / this.n : guess > 0 ? guess : ROW_GUESS;
  }

  /** What an unmeasured row is taken to be. */
  get estimate(): number { return this.est; }
  /** The average of the rows measured (the estimate while none is). */
  get average(): number { return this.n ? this.sum / this.n : this.est; }
  get measured(): number { return this.n; }

  /** The estimate brought up to the average of the rows measured. True when that moved it. */
  settle(): boolean {
    const avg = this.average;
    if (Math.abs(avg - this.est) < 0.01) return false;
    this.est = avg;
    this.sums = null;
    return true;
  }

  /** Row `i` measured at `px` (zero or less is no measurement: a row not laid out). True when that changed anything. */
  set(i: number, px: number): boolean {
    if (i < 0 || i >= this.count || !(px > 0)) return false;
    const was = this.h[i]!;
    if (Math.abs(was - px) < 0.5) return false;
    if (was > 0) this.sum -= was; else this.n++;
    this.sum += px;
    this.h[i] = px;
    this.sums = null;
    return true;
  }

  /** Every measurement let go (the list's width changed: every row wraps anew); the average so far stays as the guess. */
  clear(): void {
    this.est = this.average;
    this.h.fill(0);
    this.sum = 0;
    this.n = 0;
    this.sums = null;
  }

  height(i: number): number {
    const v = this.h[i];
    return v !== undefined && v > 0 ? v : this.estimate;
  }

  private prefix(): Float64Array {
    if (!this.sums) {
      const est = this.estimate;
      const s = new Float64Array(this.count + 1);
      for (let i = 0; i < this.count; i++) s[i + 1] = s[i]! + (this.h[i]! > 0 ? this.h[i]! : est);
      this.sums = s;
    }
    return this.sums;
  }

  /** The top of row `i` from the top of the list; `offset(count)` is the list's height. */
  offset(i: number): number {
    return this.prefix()[Math.max(0, Math.min(this.count, i))]!;
  }

  get total(): number { return this.offset(this.count); }

  /** The row that holds `y` (the first for a `y` above the list, the last for one below). */
  indexAt(y: number): number {
    const s = this.prefix();
    let lo = 0;
    let hi = this.count - 1;
    while (lo < hi) {
      const mid = (lo + hi + 1) >> 1;
      if (s[mid]! <= y) lo = mid; else hi = mid - 1;
    }
    return Math.max(0, lo);
  }
}

/**
 * The rows to draw with the view's top at `top` (from the list's top: negative
 * while what is above the list is still in view) and `viewport` tall: those
 * in view and `overscan` each side (a screen, by default).
 */
export function windowOf(h: Heights, top: number, viewport: number, overscan: number = viewport): Win {
  if (h.count <= WHOLE) return { start: 0, end: h.count };
  const lo = Math.min(top - overscan, h.total - viewport - 2 * overscan);
  let start = h.indexAt(Math.max(0, lo));
  let end = Math.min(h.count, h.indexAt(Math.max(0, top + viewport + overscan)) + 1);
  if (end - start > MAX_DRAWN) {
    // the rows in view first, the overscan given up
    const first = h.indexAt(Math.max(0, top));
    start = Math.max(start, Math.min(first, h.count - MAX_DRAWN));
    end = Math.min(end, start + MAX_DRAWN);
  }
  return { start, end };
}

/** `w` cut to the list as it is now (a list that shrank under its window). */
export function clampWin(h: Heights, w: Win): Win {
  if (h.count <= WHOLE) return w.start === 0 && w.end === h.count ? w : { start: 0, end: h.count };
  const end = Math.min(h.count, Math.max(0, w.end));
  const start = Math.max(0, Math.min(w.start, end));
  return start === w.start && end === w.end ? w : { start, end };
}

/**
 * Whether `w` still does for the view at `top`: the view and `margin` each
 * side are inside it (so a window is kept while the view moves within its
 * overscan, and drawn again only as the view nears its edge).
 */
export function holds(h: Heights, w: Win, top: number, viewport: number, margin: number = viewport / 2): boolean {
  if (h.count <= WHOLE) return w.start === 0 && w.end === h.count;
  if (w.start < 0 || w.end > h.count || w.start >= w.end || w.end - w.start > MAX_DRAWN) return false;
  const from = Math.max(0, Math.min(top - margin, h.total - viewport));
  const to = Math.min(h.total, Math.max(top + viewport + margin, 0));
  return h.offset(w.start) <= from && h.offset(w.end) >= to;
}

/** The row under `top` and how far into it `top` is; null when `top` is above the list (nothing above the view to move it). */
export function anchorAt(h: Heights, top: number): Anchor | null {
  if (!h.count || top <= 0) return null;
  const index = h.indexAt(top);
  return { index, into: top - h.offset(index) };
}

/** Where the view's top goes to hold `a` where it was (no further into the row than the row is tall). */
export function topOf(h: Heights, a: Anchor): number {
  const i = Math.max(0, Math.min(h.count - 1, a.index));
  return h.offset(i) + Math.max(0, Math.min(a.into, h.height(i)));
}

/**
 * The view's top that brings row `i` into view: by the least move (`nearest`:
 * no move when it is all in view already), or with the row in the middle.
 */
export function topFor(h: Heights, i: number, top: number, viewport: number, block: 'nearest' | 'center'): number {
  const y = h.offset(i);
  const ht = h.height(i);
  if (block === 'center') return y + ht / 2 - viewport / 2;
  if (y < top) return y;
  if (y + ht > top + viewport) return y + ht - viewport;
  return top;
}

/** What the window reads of the page. A test sets these: jsdom has no layout, every height in it is 0. */
export const probe = {
  /** The height of the scroller's view; a scroller not laid out is taken to be a window tall. */
  viewport: (pane: HTMLElement): number => pane.clientHeight || window.innerHeight || 800,
  /** A drawn row's height, 0 when it is not laid out. */
  height: (el: HTMLElement): number => el.getBoundingClientRect().height,
  /** The width the rows wrap in. */
  width: (el: HTMLElement): number => el.clientWidth,
  /** The list's top within the scroller's content: what is above the list (the study line, the bar). */
  listTop: (list: HTMLElement, pane: HTMLElement): number => list.getBoundingClientRect().top - pane.getBoundingClientRect().top + pane.scrollTop,
  scrollTop: (pane: HTMLElement): number => pane.scrollTop,
  scrollTo: (pane: HTMLElement, y: number): void => { pane.scrollTop = y; },
};
