// What a finger's drag means, as numbers (no page here: `edge.ts`,
// `rowSwipe.ts` and `pull.ts` move things by what these say). A touch is a
// drag once it has left its slop, along the axis it left it by; what is let
// go settles open or closed by where it is and how fast it was going; a
// row's swipe is closed, open on its actions, or far enough to act; a pull
// is armed past its threshold.

/** How far a touch travels before it is a drag, px. */
export const SLOP = 10;
/** A touch that starts this near the left edge is the edge's. */
export const EDGE = 24;
/** Faster than this when let go and the direction decides, px/ms. */
export const FLING = 0.35;
/** A settle's shortest and longest, ms. */
export const SETTLE_MIN = 160;
export const SETTLE_MAX = 320;
/** How far the page under a pushed one stands to the left, of its width. */
export const UNDER = 0.22;

export type Axis = 'x' | 'y';

/** The axis a touch has left its slop by, or null while it rests. Sideways only when it is plainly so. */
export function axisOf(dx: number, dy: number, slop = SLOP): Axis | null {
  const ax = Math.abs(dx);
  const ay = Math.abs(dy);
  if (ax < slop && ay < slop) return null;
  return ax > ay * 1.2 ? 'x' : 'y';
}

/**
 * What a rightward drag from the left edge does: on a phone's page that was opened from the day (`pushed`, and not
 * `fromTree`) it goes back to the day; anywhere else (the day itself, a page opened from the tree, an iPad upright)
 * it brings the sidebar's sheet in.
 */
export function edgeMeans(phone: boolean, pushed: boolean, fromTree: boolean): 'back' | 'sheet' {
  return phone && pushed && !fromTree ? 'back' : 'sheet';
}

/** What of an element says whether it is scrolled: itself and what holds it. */
export interface Scrolled { scrollLeft: number; parentElement: Scrolled | null }

/**
 * Whether what is under a touch is scrolled sideways: `el` or anything that holds it, up to and with `within`, stands
 * off its left end (a page of a book zoomed in and moved along, a wide table). A finger drawn rightward there is
 * moving that back toward its start: it is a pan, not the edge's swipe.
 */
export function scrolledSideways(el: Scrolled | null, within: Scrolled | null): boolean {
  for (let n = el; n; n = n.parentElement) {
    if (n.scrollLeft > 0) return true;
    if (n === within) break;
  }
  return false;
}

export interface Sample { t: number; at: number }

/** The speed over the last `span` ms of samples, px/ms, signed. A finger that rested before lifting has none. */
export function velocityOf(samples: readonly Sample[], now: number, span = 90): number {
  const recent = samples.filter((s) => now - s.t <= span);
  if (recent.length < 2) return 0;
  const a = recent[0]!;
  const b = recent[recent.length - 1]!;
  return b.t === a.t ? 0 : (b.at - a.at) / (b.t - a.t);
}

/** Whether what is let go at `p` of the way open (0 shut, 1 open), moving at `v` toward open (px/ms), ends open. */
export function settlesOpen(p: number, v: number, fling = FLING): boolean {
  if (v > fling) return true;
  if (v < -fling) return false;
  return p >= 0.5;
}

/** How long the rest of the way takes: by the speed it was let go at, within the settle's bounds. */
export function settleMs(distance: number, v: number): number {
  const d = Math.abs(distance);
  if (d < 1) return 0;
  const speed = Math.max(Math.abs(v), 0.9);
  return Math.round(Math.min(SETTLE_MAX, Math.max(SETTLE_MIN, (d / speed) * 1.5)));
}

/**
 * The ease a settle runs by: it leaves at the speed the finger let go at (so nothing jumps as it is let go: a
 * finger that rested starts it from rest, a flick carries on), and comes to its end softly. `v` is the speed
 * toward where it is going, px/ms; against it, or none, starts from rest.
 */
export function settleEase(distance: number, v: number, ms: number): string {
  const d = Math.abs(distance);
  const slope = d < 1 || ms <= 0 ? 0 : Math.min(3, Math.max(0, (v * Math.sign(distance) * ms) / d));
  return `cubic-bezier(0.25, ${(0.25 * slope).toFixed(3)}, 0.2, 1)`;
}

/** A pull past where a thing ends: it follows less and less, never past `max`. */
export function rubber(d: number, max: number): number {
  if (d <= 0) return 0;
  return max * (1 - 1 / (d / max * 0.9 + 1));
}

// ── a row's swipe ────────────────────────────────────────────────

/** A swipe this far across the row acts, of its width. */
export const ROW_COMMIT = 0.55;

/** Where a row sits for a finger `dx` from where it began (`base` its offset then): leftward freely, rightward past its rest hardly at all. */
export function rowAt(base: number, dx: number): number {
  const x = base + dx;
  return x <= 0 ? x : rubber(x, 24);
}

/** Whether a row at `x` (≤ 0) is far enough to act when let go. */
export const rowCommits = (x: number, width: number): boolean => width > 0 && -x >= width * ROW_COMMIT;

export type RowEnd = 'shut' | 'open' | 'act';

/** Where a row let go at `x` moving at `v` (px/ms, leftward negative) ends: shut, open on its actions (`acts` px wide), or acting. */
export function rowEnds(x: number, v: number, width: number, acts: number): RowEnd {
  if (rowCommits(x, width)) return 'act';
  if (v < -FLING) return 'open';
  if (v > FLING) return 'shut';
  return -x >= acts / 2 ? 'open' : 'shut';
}

// ── a pull at the top of a list ──────────────────────────────────

/** A list pulled this far down past its top asks for a sync when let go, px. */
export const PULL = 64;

/** Whether a list `over` px past its top is armed. */
export const pullArmed = (over: number): boolean => over >= PULL;
