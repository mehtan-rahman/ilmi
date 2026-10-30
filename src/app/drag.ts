// The one drag of a node, shared by the sidebar's tree, a notebook's tab
// rail, and the folder lens, so a row dragged from one lands on any of
// them. Where a drop lands is `dnd.ts`; this module holds the drag (what is
// being dragged, the drop drawn now) and hands a surface the handlers for
// each of its rows.
//
//  · dragover   the drop under the pointer (25 / 50 / 25, an open parent's
//               first child, how far out below a last child, `into` on a
//               bare document only after a rest), drawn on that row; a
//               refused drop draws nothing and the cursor says no
//  · rest       a folded row opens after `SPRING_MS` (the surface's `spring`)
//  · edges      the surface's scroller scrolls near its top and bottom
//  · Esc        cancels: nothing is drawn and the drop does nothing
//  · leaving    a row for another row keeps the mark until the next
//               dragover, so crossing a row's text never flickers

import type { CSSProperties, DragEvent } from 'react';
import { create } from 'zustand';
import { INTO_DWELL, SPRING_MS, dropAt, edgeScroll, sameDrop, type Drop, type RowGeom } from './dnd.js';
import { placeNode } from './vault.js';

export interface DragState {
  /** The node being dragged, or null. */
  dragging: string | null;
  /** Where it would land now, drawn on `drop.row`. */
  drop: Drop | null;
}

export const useDrag = create<DragState>(() => ({ dragging: null, drop: null }));

/** What a surface tells the drag about how its rows are drawn. */
export interface Surface {
  /** px from a row's left edge to depth 0's content, and per level of depth. */
  pad: number;
  indent: number;
  /** The scroller that scrolls near its edges during a drag (a selector for `closest`). */
  scroller?: string;
  /** A folded row with something under it was rested on: open it. */
  spring?(path: string): void;
  /** A drop landed (after `placeNode` was asked). */
  landed?(drop: Drop, to: string): void;
}

// the row the pointer is resting on and since when (for the spring and the
// rest before `into`), and whether Esc cancelled the drag
let hover: { key: string; since: number; mid: number | null } | null = null;
let cancelled = false;
let sprung = new Set<string>();

const onEsc = (e: KeyboardEvent) => {
  if (e.key !== 'Escape' || useDrag.getState().dragging === null) return;
  cancelled = true;
  useDrag.setState({ drop: null });
};

/** Start dragging `path` (also for a smoke or a test that drives the drag without a DataTransfer). */
export function beginDrag(path: string): void {
  cancelled = false;
  hover = null;
  sprung = new Set();
  useDrag.setState({ dragging: path, drop: null });
  window.addEventListener('keydown', onEsc, true);
}

/** The drag is over: dropped, ended, or cancelled. */
export function endDrag(): void {
  hover = null;
  window.removeEventListener('keydown', onEsc, true);
  if (useDrag.getState().dragging !== null || useDrag.getState().drop !== null) useDrag.setState({ dragging: null, drop: null });
}

/** Esc pressed during the drag (the native drag cancels itself; this makes sure the drop does nothing). */
export function cancelDrag(): void {
  cancelled = true;
  useDrag.setState({ drop: null });
}

/** The props a row on `s` takes to be dragged and dropped on. `folded`: it has something under it and is closed (the spring opens it). */
export function rowDrag(g: RowGeom, s: Surface, opts: { draggable: boolean; folded?: boolean }) {
  const key = g.key ?? g.path;
  return {
    'data-drop-row': key,
    draggable: opts.draggable,
    onDragStart: (e: DragEvent) => {
      if (!opts.draggable) return;
      e.stopPropagation();
      beginDrag(g.path);
      try {
        e.dataTransfer.effectAllowed = 'move';
        e.dataTransfer.setData('text/plain', g.path);
      } catch { /* not every host allows it */ }
    },
    onDragOver: (e: DragEvent) => {
      const { dragging, drop } = useDrag.getState();
      if (dragging === null) return;
      const now = Date.now();
      const r = e.currentTarget.getBoundingClientRect();
      const y = e.clientY - r.top;
      const h = r.height || 1;
      const inMid = y >= h / 4 && y < (h * 3) / 4;
      if (!hover || hover.key !== key) hover = { key, since: now, mid: inMid ? now : null };
      else if (!inMid) hover.mid = null;
      else if (hover.mid === null) hover.mid = now;
      const rested = hover.mid !== null && now - hover.mid >= INTO_DWELL;
      // a folded row rested on opens
      if (opts.folded && s.spring && !sprung.has(g.path) && now - hover.since >= SPRING_MS) {
        sprung.add(g.path);
        s.spring(g.path);
      }
      // near the scroller's edges, scroll
      const box = s.scroller ? (e.currentTarget as HTMLElement).closest<HTMLElement>(s.scroller) : null;
      if (box) {
        const b = box.getBoundingClientRect();
        const dy = edgeScroll(e.clientY, b.top, b.bottom);
        if (dy) box.scrollTop += dy;
      }
      const next = cancelled ? null : dropAt(g, { x: e.clientX - r.left, y, h, pad: s.pad, indent: s.indent }, dragging, rested);
      if (!next) {
        try { e.dataTransfer.dropEffect = 'none'; } catch { /* read-only in some hosts */ }
        if (drop) useDrag.setState({ drop: null });
        return;
      }
      e.preventDefault();
      try { e.dataTransfer.dropEffect = 'move'; } catch { /* read-only in some hosts */ }
      if (!sameDrop(drop, next)) useDrag.setState({ drop: next });
    },
    onDragLeave: (e: DragEvent) => {
      const to = e.relatedTarget as Element | null;
      // into the row's own text, or onto another row: the next dragover redraws
      if (to && (e.currentTarget.contains(to) || to.closest?.('[data-drop-row]'))) return;
      if (useDrag.getState().drop?.row === key) useDrag.setState({ drop: null });
    },
    onDrop: (e: DragEvent) => {
      e.preventDefault();
      e.stopPropagation();
      const { dragging, drop } = useDrag.getState();
      if (!cancelled && dragging !== null && drop) {
        placeNode(dragging, drop.target, drop.mode).then((to) => s.landed?.(drop, to)).catch((err) => console.error(err));
      }
      endDrag();
    },
    onDragEnd: () => endDrag(),
  };
}

/** How row `key` on `s` is drawn now: the drop's mark (a line indented to its landing depth, or a box), and dimmed while it is the one dragged. */
export function rowMark(st: DragState, key: string, path: string, s: Surface): { className: string; style: CSSProperties } {
  const cls: string[] = [];
  let style: CSSProperties = {};
  if (st.dragging === path) cls.push('dragging');
  const d = st.drop;
  if (d && d.row === key) {
    cls.push(d.draw === 'box' ? 'drop-into' : d.draw === 'top' ? 'drop-top' : 'drop-bottom');
    if (d.draw !== 'box') style = { '--drop-x': `${s.pad + d.depth * s.indent}px` } as CSSProperties;
  }
  return { className: cls.join(' '), style };
}
