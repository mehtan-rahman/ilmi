// The ink a typed note holds (milestones 69, 82). A note takes no new
// handwriting: the Pencil on its text is a finger, and writing has its own
// kind of note (a written notebook, `written.ts`). What a note already holds
// stays as it was made: the note is a surface (`ink.ts`) whose areas are
// sheets, each lying where its paragraph lies, drawn as its picture, written
// in and erased in place with the tools (`InkBar.tsx`), grown at its foot,
// kept, merged, and gone with its line once every stroke is erased.
//
// How an area stands: a picture is cut to what its strokes cover, so a
// canvas hangs from its area by `dy` (the drawing's top against the
// area's) and the picture is laid where its strokes lie, the area starting
// at its picture's own top.

import type { EditorView } from 'prosemirror-view';
import { imagesKey } from '../reader/index.js';
import { inkKey, inkLines, type InkBox, type InkMeta } from '../reader/inkArea.js';
import { INK_EXT, type InkStroke } from '../vault/index.js';
import { afterScene, b64, cropOf, covered, fillSheet, hasCanvas, inContent, keep, pageOf, portOf, restSheet, sceneSoon, storeOf, type HostSpec, type Paper, type PenEvent, type SheetSpec, type Surface } from './ink.js';
import { invoke } from '@tauri-apps/api/core';

/** How much an area grows by when the writing nears its foot, px. */
export const AREA_STEP = 160;
/** The room left under what is written in an area read from the store, px: enough to put the Pencil down in. */
const AREA_ROOM = 40;
/** How far past the screen areas have a canvas ready, px. */
const NEAR = 900;

interface Area {
  /** Its sheet: its page's path. */
  sheet: string;
  /** Its `.pkdrawing`, vault-relative. */
  page: string;
  /** Its drawing's top against the area's top, px; and what is drawn to a px. */
  dy: number;
  zoom: number;
  height: number;
  crop: { x: number; y: number; w: number; h: number } | null;
  live: boolean;
  /** Told what the store holds. */
  filled: boolean;
  /** Written on since it was last shown as a picture: a count. */
  rev: number;
}

export interface NoteInk {
  /** What the plugin draws: an area by its line's source. */
  boxes: Map<string, InkBox>;
  /** The view is there. */
  attach(view: EditorView): void;
  /** The document or its pictures changed: the areas looked at again. */
  changed(): void;
  /** Strokes changed in the store: each area's read again. */
  reread(): void;
  destroy(): void;
}

let hosts = 0;

const editing = (view: EditorView): boolean => view.editable;

/** The note at `path` as a surface. `holds` hears whether it has an ink area, whenever that changes: the tools are shown over one that has. */
export function noteInk(path: string, addSurface: (s: Surface) => () => void, holds?: (has: boolean) => void): NoteInk {
  const id = `note:${++hosts}:${path}`;
  const boxes = new Map<string, InkBox>();
  const areas = new Map<string, Area>();
  let has = false;
  let view: EditorView | null = null;
  let off: (() => void) | null = null;
  let scroller: HTMLElement | null = null;
  let observer: ResizeObserver | null = null;
  const onScroll = (): void => sceneSoon();

  const redraw = (): void => {
    if (!view || view.isDestroyed) return;
    view.dispatch(view.state.tr.setMeta(inkKey, 'redraw' satisfies InkMeta).setMeta('addToHistory', false));
    sceneSoon();
  };
  /** How wide the column is. */
  const width = (): number => view?.dom.getBoundingClientRect().width ?? 0;

  const draw = (src: string, a: Area): void => {
    const c = a.crop;
    const left = c ? c.x * a.zoom : 0;
    const top = c ? c.y * a.zoom + a.dy : 0;
    boxes.set(src, { height: a.height, left, top, width: c ? c.w * a.zoom : 0, live: a.live });
  };

  /** What an area's drawing covers, read from the store. */
  const measure = async (src: string): Promise<void> => {
    const at = storeOf();
    const page = pageOf(path, src);
    if (!at || !page || !page.endsWith(INK_EXT) || (await at.fs.stat(at.abs(page))) === null) return;
    const bytes = await at.fs.readBytes(at.abs(page));
    const bounds = await invoke<[number, number, number, number] | null>('ink_bounds', { drawing: b64(bytes) });
    if (!bounds) return;
    const crop = cropOf(bounds);
    const zoom = Math.min(1, width() / Math.max(width(), crop.x + crop.w) || 1);
    const was = areas.get(src);
    if (was) {
      was.crop = crop;
      was.height = Math.max(was.height, crop.y * was.zoom + was.dy + crop.h * was.zoom + AREA_ROOM);
      draw(src, was);
    } else {
      const a: Area = { sheet: page, page, dy: -crop.y * zoom, zoom, height: crop.h * zoom + AREA_ROOM, crop, live: false, filled: false, rev: 0 };
      areas.set(src, a);
      draw(src, a);
    }
    redraw();
  };

  const domOf = (pos: number): HTMLElement | null => {
    const el = view?.nodeDOM(pos);
    return el instanceof HTMLElement ? el : null;
  };

  const sheetOf = (a: Area, src: string): SheetSpec | null => {
    const line = view ? inkLines(view.state.doc).find((l) => l.src === src) : undefined;
    const el = line ? domOf(line.pos) : null;
    if (!el || !scroller || !el.getClientRects().length) return null;
    const r = inContent(scroller, el);
    return { id: a.sheet, frame: { x: r.x, y: r.y + a.dy, w: r.w, h: Math.max(a.height - a.dy, 0) + scroller.clientHeight }, hit: { x: r.x, y: r.y, w: r.w, h: r.h }, zoom: a.zoom };
  };

  const surface: Surface = {
    host(): HostSpec | null {
      if (!view || view.isDestroyed) return null;
      scroller ??= view.dom.closest<HTMLElement>('.pane-body');
      if (scroller && !observer && typeof ResizeObserver !== 'undefined') {
        observer = new ResizeObserver(() => sceneSoon());
        observer.observe(scroller);
        observer.observe(view.dom);
        scroller.addEventListener('scroll', onScroll, { passive: true });
      }
      if (!scroller || !scroller.getClientRects().length) return null;
      // under the tools, which stay at the pane's top over a note that holds ink
      const { view: box, port, top, height } = portOf(scroller, scroller.querySelector('.inkbar'));
      if (port.w <= 0 || port.h <= 0 || covered(scroller, port)) return { id, view: box, port: { ...port, h: 0 }, top, height, open: null, sheets: [] };
      const wrote = editing(view);
      const low = top - NEAR;
      const high = top + box.h + NEAR;
      const sheets: SheetSpec[] = [];
      for (const [src, a] of areas) {
        const s = sheetOf(a, src);
        if (s && s.hit.y + s.hit.h >= low && s.hit.y <= high && wrote) sheets.push(s);
      }
      for (const s of sheets) afterScene(() => void fill(s.id));
      // off every area the Pencil is a finger: nothing opens
      return { id, view: box, port, top, height, open: null, sheets };
    },
    paper(sheet: string): Paper | null {
      const at = storeOf();
      if (!at) return null;
      const a = [...areas.values()].find((x) => x.sheet === sheet);
      if (!a) return null;
      const abs = at.abs(a.page);
      return { name: a.page, read: async () => (await at.fs.ink(abs)) ?? [], write: (s) => at.fs.setInk(abs, s) };
    },
    made(sheet: string): void {
      for (const a of areas.values()) if (a.sheet === sheet) { a.filled = false; void fill(sheet); }
    },
    began(e: PenEvent): void {
      if (!view) return;
      for (const [src, a] of areas) if (a.sheet === e.sheet) { a.live = true; a.rev++; draw(src, a); }
      redraw();
    },
    grew(e: PenEvent): void {
      for (const [src, a] of areas) if (a.sheet === e.sheet) { a.height += AREA_STEP; draw(src, a); redraw(); }
    },
    async kept(sheet: string, strokes: InkStroke[], drawing: string): Promise<void> {
      const bounds = await invoke<[number, number, number, number] | null>('ink_bounds', { drawing });
      const crop = bounds ? cropOf(bounds) : null;
      for (const [src, a] of areas) {
        if (a.sheet !== sheet) continue;
        if (!strokes.length) {
          // every stroke erased: no line
          areas.delete(src);
          boxes.delete(src);
          await unplace(src);
          const at = storeOf();
          if (at) await at.fs.remove(at.abs(a.page));
          void restSheet(sheet);
          return;
        }
        a.crop = crop;
        if (crop) a.height = Math.max(a.height, crop.y * a.zoom + a.dy + crop.h * a.zoom + 12);
        draw(src, a);
        reload(src);
        void shown(src, a);
        return;
      }
    },
  };

  const unplace = async (src: string): Promise<void> => {
    if (!view || view.isDestroyed) return;
    const l = inkLines(view.state.doc).find((x) => x.src === src);
    if (l) view.dispatch(view.state.tr.delete(l.pos, l.pos + l.size));
    sceneSoon();
  };

  const reload = (src: string): void => {
    if (!view || view.isDestroyed) return;
    view.dispatch(view.state.tr.setMeta(imagesKey, { again: src }));
  };

  /** The picture is there: the canvas over it goes, unless the Pencil came back. */
  const shown = async (src: string, a: Area): Promise<void> => {
    const rev = a.rev;
    const t0 = Date.now();
    await new Promise((r) => setTimeout(r, 60));
    while (Date.now() - t0 < 3000) {
      const img = view?.dom.querySelector<HTMLImageElement>(`img.md-img[data-src="${CSS.escape(src)}"]`);
      if (img?.complete && img.naturalWidth > 0 && Math.abs(img.naturalWidth / 2 - (a.crop?.w ?? 0)) < 2) break;
      await new Promise((r) => setTimeout(r, 40));
    }
    if (a.rev !== rev) return;
    a.live = false;
    draw(src, a);
    redraw();
    await new Promise((r) => setTimeout(r, 34));
    if (a.rev === rev) await restSheet(a.sheet);
  };

  /** A sheet's canvas told what the store holds, once. */
  const fill = async (sheet: string): Promise<void> => {
    const a = [...areas.values()].find((x) => x.sheet === sheet);
    const at = storeOf();
    const paper = surface.paper(sheet);
    if (!a || a.filled || !at || !paper) return;
    a.filled = true;
    await fillSheet(sheet, paper, () => at.fs.readBytes(at.abs(a.page))).catch((e: unknown) => { a.filled = false; console.error(e); });
  };

  return {
    boxes,
    attach(v: EditorView): void {
      view = v;
      if (!hasCanvas()) return;
      scroller = null;
      observer?.disconnect();
      observer = null;
      off ??= addSurface(surface);
      this.changed();
    },
    changed(): void {
      if (!view || view.isDestroyed || !hasCanvas()) return;
      const lines = inkLines(view.state.doc);
      if (has !== lines.length > 0) { has = lines.length > 0; holds?.(has); }
      for (const { src } of lines) if (!areas.has(src)) void measure(src).catch(console.error);
      sceneSoon();
    },
    reread(): void {
      if (!view || view.isDestroyed) return;
      for (const [src, a] of areas) {
        a.filled = false;
        void measure(src).catch(console.error);
      }
      sceneSoon();
    },
    destroy(): void {
      // what was being written is kept
      const leaving = [...areas.values()].filter((a) => a.live).map((a) => a.sheet);
      const gone = off;
      off = null;
      observer?.disconnect();
      scroller?.removeEventListener('scroll', onScroll);
      view = null;
      void Promise.all(leaving.map(keep)).finally(() => gone?.());
    },
  };
}
