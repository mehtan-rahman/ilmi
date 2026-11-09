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
//  · rest       a folded row opens after `SPRING_MS` (the surface's `spring`), a bare
//               document takes `into` after `INTO_DWELL` on its middle; both on timers,
//               so a still pointer that sends no more dragovers still gets them
//  · edges      the surface's scroller scrolls near its top and bottom
//  · Esc        cancels: nothing is drawn and the drop does nothing
//  · leaving    a row for another row keeps the mark until the next
//               dragover, so crossing a row's text never flickers

import type { CSSProperties, DragEvent, PointerEvent as RPointerEvent } from 'react';
import { create } from 'zustand';
import { INTO_DWELL, SPRING_MS, dropAt, edgeScroll, sameDrop, type Drop, type Pointer, type RowGeom } from './dnd.js';
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
// rest before `into`), where on it the pointer was last, and whether Esc
// cancelled the drag. The rest is kept by timers, not only by dragover: a
// pointer that stays still may send no more dragovers (39, from 38's window
// check, where a 600 ms rest on a bare document's middle still dropped after
// it), and a covered WebKit window holds animation frames back, so nothing
// here waits on one.
interface Hover {
  key: string;
  since: number;
  mid: number | null;
  /** The last dragover's pointer on the row, and the row's geometry and surface then. */
  g: RowGeom;
  s: Surface;
  p: Pointer;
  folded: boolean;
}
let hover: Hover | null = null;
let cancelled = false;
let sprung = new Set<string>();
let restTimer: ReturnType<typeof setTimeout> | null = null;
let springTimer: ReturnType<typeof setTimeout> | null = null;

const clearTimers = () => {
  if (restTimer) clearTimeout(restTimer);
  if (springTimer) clearTimeout(springTimer);
  restTimer = springTimer = null;
};

/** The pointer has rested on the middle of `h`'s row long enough to nest there. */
const restedOn = (h: Hover | null, now: number): boolean => h !== null && h.mid !== null && now - h.mid >= INTO_DWELL;

/** The drop the row under a resting pointer takes now (the rest counted), drawn. */
function redrawRested(): void {
  const { dragging, drop } = useDrag.getState();
  if (!hover || dragging === null || cancelled) return;
  const next = dropAt(hover.g, hover.p, dragging, restedOn(hover, Date.now()));
  if (next && !sameDrop(drop, next)) useDrag.setState({ drop: next });
}

function springNow(): void {
  if (!hover || cancelled || !hover.folded || !hover.s.spring || sprung.has(hover.g.path)) return;
  sprung.add(hover.g.path);
  hover.s.spring(hover.g.path);
}

const onEsc = (e: KeyboardEvent) => {
  if (e.key !== 'Escape' || useDrag.getState().dragging === null) return;
  cancelled = true;
  clearTimers();
  useDrag.setState({ drop: null });
  // a mouse drag ends here; its letting go then does nothing
  if (press?.started) { e.preventDefault(); e.stopPropagation(); ghost?.remove(); ghost = null; delete document.documentElement.dataset.nodeDrag; }
};

/** Start dragging `path` (also for a smoke or a test that drives the drag without a DataTransfer). */
export function beginDrag(path: string): void {
  cancelled = false;
  hover = null;
  clearTimers();
  sprung = new Set();
  useDrag.setState({ dragging: path, drop: null });
  window.addEventListener('keydown', onEsc, true);
}

/** The drag is over: dropped, ended, or cancelled. */
export function endDrag(): void {
  hover = null;
  clearTimers();
  window.removeEventListener('keydown', onEsc, true);
  if (useDrag.getState().dragging !== null || useDrag.getState().drop !== null) useDrag.setState({ dragging: null, drop: null });
}

/** Esc pressed during the drag (the native drag cancels itself; this makes sure the drop does nothing). */
export function cancelDrag(): void {
  cancelled = true;
  useDrag.setState({ drop: null });
}

/** One drawn row as the drag last saw it: its geometry, its surface, whether it is folded. */
interface Live { g: RowGeom; s: Surface; folded: boolean }

/** Every drawn row by its `data-drop-row` key, as of its last render: a mouse drag finds the row under the pointer here. */
const live = new Map<string, Live>();

/**
 * The pointer over row `el` (`at`, as last drawn) at `x, y`: the hover kept,
 * the timers set, the edge scrolled, the drop drawn. Returns the drop, or null
 * when refused. A DragEvent's dragover and a mouse drag's move both come here.
 */
function overRow(el: HTMLElement, key: string, at: Live, x: number, y0: number): Drop | null {
  const { g, s, folded } = at;
  const { dragging, drop } = useDrag.getState();
  if (dragging === null) return null;
  const now = Date.now();
  const r = el.getBoundingClientRect();
  const y = y0 - r.top;
  const h = r.height || 1;
  const inMid = y >= h / 4 && y < (h * 3) / 4;
  const p: Pointer = { x: x - r.left, y, h, pad: s.pad, indent: s.indent };
  if (!hover || hover.key !== key) {
    clearTimers();
    hover = { key, since: now, mid: inMid ? now : null, g, s, p, folded };
    // a folded row rested on opens, whether or not more dragovers come
    if (folded && s.spring && !sprung.has(g.path)) springTimer = setTimeout(springNow, SPRING_MS);
  } else {
    hover.g = g;
    hover.s = s;
    hover.p = p;
    hover.folded = folded;
    if (!inMid) hover.mid = null;
    else if (hover.mid === null) hover.mid = now;
  }
  if (hover.mid === null && restTimer) { clearTimeout(restTimer); restTimer = null; }
  const rested = restedOn(hover, now);
  // the rest before `into` on a bare document: drawn when it is up, whether or not more dragovers come
  if (g.nest === 'dwell' && hover.mid !== null && !rested && !restTimer) {
    restTimer = setTimeout(() => { restTimer = null; redrawRested(); }, INTO_DWELL - (now - hover.mid));
  }
  if (folded && s.spring && !sprung.has(g.path) && now - hover.since >= SPRING_MS) springNow();
  // near the scroller's edges, scroll
  const box = s.scroller ? el.closest<HTMLElement>(s.scroller) : null;
  if (box) {
    const b = box.getBoundingClientRect();
    const dy = edgeScroll(y0, b.top, b.bottom);
    if (dy) box.scrollTop += dy;
  }
  const next = cancelled ? null : dropAt(g, p, dragging, rested);
  if (!next) {
    if (drop) useDrag.setState({ drop: null });
    return null;
  }
  if (!sameDrop(drop, next)) useDrag.setState({ drop: next });
  return next;
}

/** The pointer left every row: nothing is drawn until it is over one again. */
function offRows(): void {
  if (hover) { hover = null; clearTimers(); }
  if (useDrag.getState().drop) useDrag.setState({ drop: null });
}

/** Let go over row `key`: the node is placed where the mark said (or nests, after a rest on a bare document's middle). */
function dropOnRow(key: string, g: RowGeom, s: Surface): void {
  const { dragging } = useDrag.getState();
  let { drop } = useDrag.getState();
  // a drop after a rest on this row's middle nests, even when no timer or dragover has drawn it yet
  if (!cancelled && dragging !== null && hover?.key === key && g.nest === 'dwell' && restedOn(hover, Date.now())) {
    drop = dropAt(hover.g, hover.p, dragging, true) ?? drop;
  }
  if (!cancelled && dragging !== null && drop) {
    const d = drop;
    placeNode(dragging, d.target, d.mode).then((to) => s.landed?.(d, to)).catch((err) => console.error(err));
  }
  endDrag();
}

// ── the mouse's drag ─────────────────────────────────────────────
// On the Mac the window's native drop target is Tauri's, for files from the
// Finder: it takes every drag that enters the web view and never hands it to
// the page (wry's `draggingUpdated` returns before WebKit's), so a row's HTML
// drag got no dragover and no drop, and the row under it was lit as a file's
// landing. A mouse drag is therefore the pointer's own: press, move past
// `SLOP`, the row under the pointer found by hit-testing, let go. A touch
// screen keeps the system's drag (a long press lifts a `draggable` row).

/** How far the mouse moves with the button down before a press is a drag. */
export const SLOP = 5;
/** How often a still pointer is read again (the edge scroll, as a dragover's cadence would). */
const TICK_MS = 50;

/** Whether this screen drags rows the system's way: a touch screen's long press. */
const nativeDrag = (): boolean => typeof matchMedia === 'function' && matchMedia('(pointer: coarse)').matches;

interface Press { path: string; label: string; x: number; y: number; started: boolean; lastX: number; lastY: number }
let press: Press | null = null;
let ghost: HTMLElement | null = null;
let ticker: ReturnType<typeof setInterval> | null = null;

/** The row under a point, as the drag last drew it (the ghost lets the pointer through). */
function rowUnder(x: number, y: number): { el: HTMLElement; key: string; at: Live } | null {
  const el = document.elementFromPoint(x, y)?.closest<HTMLElement>('[data-drop-row]') ?? null;
  const key = el?.dataset.dropRow;
  const at = key !== undefined ? live.get(key) : undefined;
  return el && key !== undefined && at ? { el, key, at } : null;
}

function moveTo(x: number, y: number): void {
  if (!press?.started) return;
  press.lastX = x;
  press.lastY = y;
  if (ghost) ghost.style.transform = `translate(${x + 12}px, ${y + 10}px)`;
  if (cancelled) return;
  const hit = rowUnder(x, y);
  const ok = hit ? overRow(hit.el, hit.key, hit.at, x, y) !== null : false;
  if (!hit) offRows();
  document.documentElement.dataset.nodeDrag = ok ? 'move' : 'none';
}

function startPointerDrag(p: Press): void {
  p.started = true;
  beginDrag(p.path);
  window.getSelection?.()?.removeAllRanges();
  document.documentElement.dataset.nodeDrag = 'none';
  ghost = document.createElement('div');
  ghost.className = 'drag-ghost';
  ghost.textContent = p.label;
  document.body.appendChild(ghost);
  ticker = setInterval(() => { if (press?.started) moveTo(press.lastX, press.lastY); }, TICK_MS);
}

function finishPointer(): void {
  window.removeEventListener('pointermove', onMove, true);
  window.removeEventListener('pointerup', onUp, true);
  window.removeEventListener('pointercancel', onCancel, true);
  if (ticker) clearInterval(ticker);
  ticker = null;
  ghost?.remove();
  ghost = null;
  delete document.documentElement.dataset.nodeDrag;
  press = null;
}

const onMove = (e: PointerEvent) => {
  if (!press) return;
  if (!press.started) {
    if (Math.hypot(e.clientX - press.x, e.clientY - press.y) < SLOP) return;
    startPointerDrag(press);
  }
  e.preventDefault();
  moveTo(e.clientX, e.clientY);
};

/** The click a press makes on its row after a drag is not a click on the row. */
const swallowClick = (e: MouseEvent) => { e.preventDefault(); e.stopPropagation(); };

const onUp = (e: PointerEvent) => {
  const p = press;
  if (p?.started) {
    window.addEventListener('click', swallowClick, { capture: true, once: true });
    setTimeout(() => window.removeEventListener('click', swallowClick, true), 0);
    if (!cancelled) moveTo(e.clientX, e.clientY);
    const hit = cancelled ? null : rowUnder(e.clientX, e.clientY);
    finishPointer();
    if (hit) dropOnRow(hit.key, hit.at.g, hit.at.s);
    else endDrag();
    return;
  }
  finishPointer();
};

const onCancel = () => {
  const started = press?.started;
  finishPointer();
  if (started) endDrag();
};

/** A mouse pressed on a row that can be dragged: watched until it moves past `SLOP` (a drag) or lets go (a click). */
function armPointer(path: string, label: string, x: number, y: number): void {
  finishPointer();
  press = { path, label, x, y, started: false, lastX: x, lastY: y };
  window.addEventListener('pointermove', onMove, true);
  window.addEventListener('pointerup', onUp, true);
  window.addEventListener('pointercancel', onCancel, true);
}

/** The props a row on `s` takes to be dragged and dropped on. `folded`: it has something under it and is closed (the spring opens it). */
export function rowDrag(g: RowGeom, s: Surface, opts: { draggable: boolean; folded?: boolean }) {
  const key = g.key ?? g.path;
  const folded = !!opts.folded;
  live.set(key, { g, s, folded });
  return {
    'data-drop-row': key,
    draggable: opts.draggable && nativeDrag(),
    onPointerDown: (e: RPointerEvent<HTMLElement>) => {
      if (!opts.draggable || e.button !== 0 || e.pointerType === 'touch') return;
      const t = e.target as Element | null;
      if (t?.closest('input, textarea, [contenteditable="true"], .row-acts, .side-add')) return;
      const label = e.currentTarget.querySelector('.name')?.textContent?.trim() || g.path;
      armPointer(g.path, label, e.clientX, e.clientY);
    },
    // the system's drag (a touch screen's, and the smokes', which send DragEvents)
    onDragStart: (e: DragEvent) => {
      if (!opts.draggable) return;
      e.stopPropagation();
      finishPointer();
      beginDrag(g.path);
      try {
        e.dataTransfer.effectAllowed = 'move';
        e.dataTransfer.setData('text/plain', g.path);
      } catch { /* not every host allows it */ }
    },
    onDragOver: (e: DragEvent) => {
      if (useDrag.getState().dragging === null) return;
      const next = overRow(e.currentTarget as HTMLElement, key, { g, s, folded }, e.clientX, e.clientY);
      if (!next) {
        try { e.dataTransfer.dropEffect = 'none'; } catch { /* read-only in some hosts */ }
        return;
      }
      e.preventDefault();
      try { e.dataTransfer.dropEffect = 'move'; } catch { /* read-only in some hosts */ }
    },
    onDragLeave: (e: DragEvent) => {
      const to = e.relatedTarget as Element | null;
      // into the row's own text, or onto another row: the next dragover redraws
      if (to && (e.currentTarget.contains(to) || to.closest?.('[data-drop-row]'))) return;
      if (hover?.key === key) { hover = null; clearTimers(); }
      if (useDrag.getState().drop?.row === key) useDrag.setState({ drop: null });
    },
    onDrop: (e: DragEvent) => {
      e.preventDefault();
      e.stopPropagation();
      dropOnRow(key, g, s);
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
