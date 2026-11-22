// A written notebook's pages as a surface of the system's own (milestone 87).
//
// On an iPad a notebook's pages are not this page's: they are one native
// scroll view laid over the web view where the reader's pages would be
// (`src-tauri/ink/ios/Sources/Surface.swift`), so the scroll and the zoom
// are the system's. What the page does here is say where that is and what it
// holds (`sendSurface`: one rectangle, the sheets, the paper and its
// colours, the passages' boxes, and where the page has laid something over
// it), only when one of those changes, never for a scroll; ask it to go to a
// page or a zoom; and hear what it says (`onSurface` in `ink.ts`).
//
// The surface lies over the web view, so whatever the page draws over the
// pages (a menu, page setup, the overview, a notice, the box's bar) is a
// hole in it (`holesOver`): the surface is cut away there and takes no touch.

import { invoke } from '@tauri-apps/api/core';
import { OVER, type Box } from './ink.js';
import type { PaperLook, PaperSpec } from './paper.js';

/** A place on a notebook's pages: a page by its place (from 1), how far down it, and what of the pages' width is at the middle of the view. */
export interface SurfacePlace { page: number; y: number; x?: number | null }

/** A passage's box as the surface draws it: on a page by its place, in fractions of it; `tag` what stands beside its first box. */
export interface SurfaceMark { key: string; page: number; x: number; y: number; w: number; h: number; tag?: string; cur?: boolean; dis?: boolean; flash?: boolean; pending?: boolean; no?: number }

/** A hole in a surface: `rides` when it lies on the pages and goes while they move; `wide` when it is something not known to be laid over pages (a sheet with its shade, a pane slid over): the surface then stands aside whole (`veiled`). */
export interface SurfaceHole { x: number; y: number; w: number; h: number; r?: number; rides?: boolean; wide?: boolean }

export interface SurfaceSpec {
  id: string;
  /** Where it lies on the page. */
  at: Box;
  /** The notebook's id. */
  key: string;
  sheets: number[];
  paper: { kind: string; w: number; h: number; rule: number; left: number; right: number; top: number; bottom: number; lines: number[]; run: boolean };
  /** A pageless notebook's: how far down its one long sheet the lowest thing written on it reaches, in points, as the store has it (the surface draws the sheet that long and a little more, and longer as it is written on: milestone 88). */
  foot?: number;
  look: PaperLook & { desk: string; accent: string; fg: string; line: string; tag: string };
  pad: { top: number; side: number; bottom: number };
  zoom: number;
  open: SurfacePlace | null;
  marks: SurfaceMark[];
  holes: SurfaceHole[];
  add: boolean;
  tagRoom: number;
  /** The surface is not shown and takes no touch: the page shows a picture of it in its place, under what it has laid over the whole of it. */
  veiled?: boolean;
}

const said = new Map<string, string>();

/** The surface is told where it lies and what it holds, when that is not what it was last told. */
export function sendSurface(spec: SurfaceSpec): void {
  const text = JSON.stringify(spec);
  if (said.get(spec.id) === text) return;
  said.set(spec.id, text);
  void invoke('ink_surface', { surface: spec }).catch((e: unknown) => { said.delete(spec.id); console.error(e); });
}

/** The surface goes. */
export function dropSurface(id: string): void {
  said.delete(id);
  void invoke('ink_surface', { surface: { id } }).catch(() => {});
}

export const surfaceGo = (id: string, place: SurfacePlace, animated = false): Promise<void> =>
  invoke<void>('ink_surface_do', { ask: { id, op: 'go', place: { page: place.page, y: place.y, ...(place.x !== null && place.x !== undefined ? { x: place.x } : {}) }, animated } }).catch(console.error);

export const surfaceZoom = (id: string, zoom: number, animated = true): Promise<void> =>
  invoke<void>('ink_surface_do', { ask: { id, op: 'zoom', zoom, animated } }).catch(console.error);

/** A picture of the surface as it is shown now (a JPEG, as a `data:` address), for the page to show in its place while something lies over the whole of it; null where there is none. */
export const surfacePicture = (id: string): Promise<string | null> =>
  invoke<{ data?: string } | null>('ink_surface_do', { ask: { id, op: 'picture' } }).then((got) => (got?.data ? `data:image/jpeg;base64,${got.data}` : null), () => null);

/** A dev run's: once every picture on the surface is made. */
export const surfaceSettle = (id: string): Promise<void> => invoke<void>('ink_surface_do', { ask: { id, op: 'settle' } }).catch(() => {});

/** The paper of a notebook as the surface is told it. */
export const paperArgs = (p: PaperSpec): SurfaceSpec['paper'] => ({ kind: p.kind, w: p.w, h: p.h, rule: p.rule, left: p.left, right: p.right, top: p.top, bottom: p.bottom, lines: p.lines, run: p.run });

/** A colour of the page's styles as `#rrggbb`: whatever the style says, read through a canvas. */
let probe: CanvasRenderingContext2D | null | undefined;
export function hexOf(css: string, fallback: string): string {
  if (probe === undefined) {
    try { probe = document.createElement('canvas').getContext('2d', { willReadFrequently: true }); } catch { probe = null; }
  }
  if (!probe || !css) return fallback;
  try {
    probe.clearRect(0, 0, 1, 1);
    probe.fillStyle = '#000';
    probe.fillStyle = css;
    probe.fillRect(0, 0, 1, 1);
    const d = probe.getImageData(0, 0, 1, 1).data;
    return `#${[d[0]!, d[1]!, d[2]!].map((v) => v.toString(16).padStart(2, '0')).join('')}`;
  } catch { return fallback; }
}

/** What stands over the pages and rides on them: gone while they move. */
const RIDES = '.ink-menu, .pend';

/**
 * What of the page lies over `el` (the place the surface is): each thing's
 * rectangle, a hole in the surface. Everything of the page that is drawn
 * over it is found by asking what is at a grid of places over `el`: whatever
 * is there that is not `el` or inside it is over it, the outermost thing
 * that does not also hold `el`. What lies inside `el` and is marked
 * (`data-ink-over`, the lasso's menu, a box's bar) is a hole too.
 */
export function holesOver(el: HTMLElement): SurfaceHole[] {
  const r = el.getBoundingClientRect();
  if (r.width <= 0 || r.height <= 0 || typeof document.elementFromPoint !== 'function') return [];
  const found = new Set<Element>();
  const wide = new Set<Element>();
  for (const k of Array.from(el.querySelectorAll('[data-ink-over], .ink-menu, .pend'))) found.add(k);
  // (and what is known to be laid over pages wherever it is: a small thing may fall between the places asked)
  for (const k of Array.from(document.querySelectorAll(OVER))) if (!k.contains(el)) found.add(k);
  const nx = Math.max(2, Math.min(14, Math.round(r.width / 56)));
  const ny = Math.max(2, Math.min(18, Math.round(r.height / 56)));
  for (let i = 0; i <= nx; i++) {
    for (let j = 0; j <= ny; j++) {
      const x = Math.min(r.right - 1, r.left + 1 + (i * (r.width - 2)) / nx);
      const y = Math.min(r.bottom - 1, r.top + 1 + (j * (r.height - 2)) / ny);
      let at = document.elementFromPoint(x, y);
      if (!at || at === el || el.contains(at)) continue;
      // what is known to be laid over pages is itself the hole; else the outermost thing there that does not hold the pages
      const known = at.closest(OVER);
      if (known && !known.contains(el)) { found.add(known); continue; }
      while (at.parentElement && !at.parentElement.contains(el)) at = at.parentElement;
      found.add(at);
      // (laid over much of the pages, a shade or a sheet sliding in: the surface stands aside under it, a picture of
      // itself in its place; a small thing is a hole like any other)
      const ab = at.getBoundingClientRect();
      const over = Math.max(0, Math.min(ab.right, r.right) - Math.max(ab.left, r.left)) * Math.max(0, Math.min(ab.bottom, r.bottom) - Math.max(ab.top, r.top));
      if (over >= r.width * r.height * 0.2) wide.add(at);
    }
  }
  const out: SurfaceHole[] = [];
  for (const k of found) {
    const b = k.getBoundingClientRect();
    const x0 = Math.max(b.left, r.left), y0 = Math.max(b.top, r.top), x1 = Math.min(b.right, r.right), y1 = Math.min(b.bottom, r.bottom);
    if (x1 - x0 <= 0 || y1 - y0 <= 0) continue;
    const radius = parseFloat(getComputedStyle(k).borderTopLeftRadius) || 0;
    out.push({ x: Math.round(x0 * 100) / 100, y: Math.round(y0 * 100) / 100, w: Math.round((x1 - x0) * 100) / 100, h: Math.round((y1 - y0) * 100) / 100, ...(radius > 0 ? { r: Math.min(radius, 24) } : {}), ...(k.matches(RIDES) ? { rides: true } : {}), ...(wide.has(k) ? { wide: true } : {}) });
  }
  return out.sort((a, b) => a.y - b.y || a.x - b.x);
}
