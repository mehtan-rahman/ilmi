// Where a drag over a row lands: the one model for the sidebar's tree, a
// notebook's tab rail, and the folder lens (`drag.ts` holds the drag
// itself and hands each surface its rows' handlers). Pure, so the geometry
// is tested without a layout.
//
//  · a row's top quarter places before it, its bottom quarter after it, its
//    middle half nests inside it
//  · an open parent (its children drawn under it) has no "after": its
//    bottom quarter means its first child
//  · below the last row of a group, the pointer's horizontal position picks
//    how far out the node lands: under the row's own indent it stays at the
//    row's depth, left of it each indent is one level out
//  · a document with nothing under it takes `into` only after the pointer
//    rests on its middle (`INTO_DWELL`), so a reorder never nests by accident;
//    until then its middle splits into before and after at the half
//  · a drop on the node itself, or anywhere under it, is refused (null)
//
// A drop resolves to what `Vault.place` takes: a target row and before,
// after, or into. "First child" is `before` the first child; "after the
// ancestor three levels out" is `after` that ancestor.

import { childDirOf, within } from '../vault/index.js';

export type Zone = 'before' | 'into' | 'after';
export type Mode = 'before' | 'after' | 'into';

/** Rest on a folded row this long and it opens. */
export const SPRING_MS = 500;
/** Rest on the middle of a document with nothing under it this long and it takes `into`. */
export const INTO_DWELL = 400;
/** The edge band of a scroller that scrolls it during a drag, and the most it moves per event. */
export const EDGE = 40;
export const EDGE_STEP = 14;

/** The zone of a pointer `y` px down a row `h` px tall: 25 / 50 / 25. */
export function zoneAt(y: number, h: number): Zone {
  if (y < h / 4) return 'before';
  if (y >= (h * 3) / 4) return 'after';
  return 'into';
}

/** How a row may take `into`: a folder or a document with children at once, a bare document after a rest, the root (or a rail's overview) only `into`, a placeholder only `into`. */
export type Nest = 'now' | 'dwell' | 'never' | 'only';

/** What the model needs of one drawn row. */
export interface RowGeom {
  path: string;
  depth: number;
  nest: Nest;
  /** The element the row is drawn as, when it is not `path` (a placeholder row's). */
  key?: string;
  /** Its children are drawn under it: the path of the first one. */
  firstChild?: string;
  /** It is open with nothing under it but the placeholder: its bottom quarter nests. */
  intoBelow?: boolean;
  /**
   * The rows a drop below this one can land after, the row itself first and
   * then each ancestor it closes (it is the last thing drawn under them):
   * `tail[k]` sits at `depth - k`. Only a row that is the last of its group
   * has more than itself.
   */
  tail: string[];
}

/** Where a drop lands, and how to draw it: a line at `depth` above or below the row, or a box around it. */
export interface Drop {
  target: string;
  mode: Mode;
  /** The row the mark is drawn on (not always the target: an ancestor's "after" is drawn under its last descendant). */
  row: string;
  draw: 'top' | 'bottom' | 'box';
  /** The landing depth: the line's indent. */
  depth: number;
}

/** A drawn list of rows, top to bottom, each at its depth. */
export interface FlatRow {
  path: string;
  depth: number;
  nest: Nest;
  /** The quiet row an open, empty folder or document shows: `path` is its parent's, and a drop on it goes into the parent. */
  placeholder?: boolean;
  key?: string;
}

/**
 * The geometry of every row of a drawn list: which are open (the next row
 * is deeper), their first child, and what each last-of-its-group row closes.
 * `floor` is the shallowest depth a node may land at (rows shallower than
 * it, a tree's root row, take only `into`).
 */
export function geometry(rows: readonly FlatRow[], floor: number): RowGeom[] {
  const out: RowGeom[] = [];
  const stack: string[] = [];
  for (let i = 0; i < rows.length; i++) {
    const r = rows[i]!;
    stack.length = r.depth;
    stack[r.depth] = r.path;
    const next = rows[i + 1];
    const nd = next ? next.depth : floor;
    const g: RowGeom = { path: r.path, depth: r.depth, nest: r.nest, tail: [r.path], ...(r.key ? { key: r.key } : {}) };
    if (next?.placeholder && nd > r.depth) g.intoBelow = true;
    else if (next && nd > r.depth) g.firstChild = next.path;
    else for (let d = r.depth - 1; d >= Math.max(nd, floor); d--) if (stack[d] !== undefined) g.tail.push(stack[d]!);
    out.push(g);
  }
  return out;
}

/** The pointer over a row: `y` from its top, `h` its height, `x` from the surface's left, and the drawn indent. */
export interface Pointer {
  x: number;
  y: number;
  h: number;
  /** px from the surface's left to depth 0's content, and per level. */
  pad: number;
  indent: number;
}

/** No drop of `dragged` onto itself or under it. */
export function refused(dragged: string, target: string): boolean {
  return dragged === target || (dragged !== '' && within(target, childDirOf(dragged)));
}

/**
 * The drop for `dragged` over row `g` at pointer `p`; `rested` true once the
 * pointer has rested on the row's middle for `INTO_DWELL`. Null when
 * refused: nothing is drawn and the cursor says no.
 */
export function dropAt(g: RowGeom, p: Pointer, dragged: string, rested = false): Drop | null {
  const row = g.key ?? g.path;
  const box = (): Drop | null => (refused(dragged, g.path) ? null : { target: g.path, mode: 'into', row, draw: 'box', depth: g.depth + 1 });
  if (g.nest === 'only') return box();
  let zone = zoneAt(p.y, p.h);
  if (zone === 'into' && (g.nest === 'never' || (g.nest === 'dwell' && !rested))) zone = p.y < p.h / 2 ? 'before' : 'after';
  if (zone === 'into') return box();
  if (zone === 'before') return refused(dragged, g.path) ? null : { target: g.path, mode: 'before', row, draw: 'top', depth: g.depth };
  // after an open parent is its first child; an open parent with nothing in it takes the node inside
  if (g.intoBelow) return box();
  if (g.firstChild !== undefined) {
    if (refused(dragged, g.path)) return null;
    return { target: g.firstChild, mode: 'before', row, draw: 'bottom', depth: g.depth + 1 };
  }
  // below the last of a group: the pointer's x picks how far out
  // (no pointer x, as from a key or a host that gives none: the row's own depth)
  const want = Number.isFinite(p.x) ? Math.floor((p.x - p.pad) / p.indent) : g.depth;
  const out = Math.min(g.tail.length - 1, Math.max(0, g.depth - want));
  const target = g.tail[out]!;
  if (refused(dragged, target)) return null;
  return { target, mode: 'after', row, draw: 'bottom', depth: g.depth - out };
}

/** How far to scroll a scroller spanning `top`..`bottom` for a pointer at `y`: up near the top edge, down near the bottom, faster nearer. */
export function edgeScroll(y: number, top: number, bottom: number, edge = EDGE, step = EDGE_STEP): number {
  if (bottom - top < edge * 3) return 0;
  if (y < top + edge) return -Math.ceil(step * (1 - Math.max(0, y - top) / edge));
  if (y > bottom - edge) return Math.ceil(step * (1 - Math.max(0, bottom - y) / edge));
  return 0;
}

/** The same drop, for skipping a redraw. */
export const sameDrop = (a: Drop | null, b: Drop | null): boolean =>
  a === b || (!!a && !!b && a.target === b.target && a.mode === b.mode && a.row === b.row && a.draw === b.draw && a.depth === b.depth);
