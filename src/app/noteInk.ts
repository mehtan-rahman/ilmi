// A note written on where the Pencil lands (milestone 69). The note is a
// surface (`ink.ts`): its areas are sheets, each lying where its paragraph
// lies, and the whole of its column is where a Pencil off every area opens
// a new one. That stroke is already on a canvas when this hears of it. The
// place between the blocks nearest it opens around the stroke, the text
// moving away from under the Pencil and the canvas not moving at all: a
// gap in the flow until the writing is first kept, when the note gets its
// line and the gap becomes the area.
//
// How an area stands: a picture is cut to what its strokes cover, so a
// canvas hangs from its area by `dy` (the drawing's top against the
// area's) and the picture is laid where its strokes lie. An area read from
// the store starts at its picture's own top; one opened here stays where
// the first stroke put it for as long as the note is open.

import type { EditorView } from 'prosemirror-view';
import type { Node as PMNode } from 'prosemirror-model';
import { fromDoc, imagesKey } from '../reader/index.js';
import { inkKey, inkLines, type InkBox, type InkGap, type InkMeta } from '../reader/inkArea.js';
import { INK_EXT, type InkStroke } from '../vault/index.js';
import { afterScene, b64, cropOf, covered, fillSheet, filesDir, hasCanvas, inContent, inkLine, inkSrc, keep, nearestEdge, nextPage, pageOf, portOf, restSheet, sceneSoon, storeOf, type HostSpec, type Paper, type PenEvent, type SheetSpec, type Surface } from './ink.js';
import { invoke } from '@tauri-apps/api/core';
import { writeDoc } from './sections.js';

/** How tall a new area opens, and how much it grows by when the writing nears its foot, px. */
export const AREA_START = 180;
export const AREA_STEP = 160;
/** The room left under what is written in an area read from the store, px: enough to put the Pencil down in. */
const AREA_ROOM = 40;
/** How far above a new area's top the Pencil may be and still be taken to be in it, px: what lies between two blocks. */
const PEN_ROOM = 24;
/** How far past the screen areas have a canvas ready, px. */
const NEAR = 900;

interface Area {
  /** Its sheet: its page's path, or the name the canvas had when it was new. */
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

/** The note at `path` as a surface. `shown` says whether its pane is on the screen. */
export function noteInk(path: string, addSurface: (s: Surface) => () => void): NoteInk {
  const id = `note:${++hosts}:${path}`;
  const boxes = new Map<string, InkBox>();
  const areas = new Map<string, Area>();
  /** A new area, before it has a line: what it will be. */
  let fresh: { sheet: string; dy: number; height: number; index: number | null } | null = null;
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
  /** The gap as it was last said: a note built anew over a write of someone else's has none. */
  let held: InkGap | null = null;
  const setGap = (gap: InkGap | null): void => {
    held = gap;
    view?.dispatch(view.state.tr.setMeta(inkKey, { gap } satisfies InkMeta).setMeta('addToHistory', false));
  };
  const gapNow = (): InkGap | null => (view ? inkKey.getState(view.state)?.gap ?? null : null);

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

  /** The top of each block on the screen, and the last one's foot, in the scroller's content, with the place in the document of each. */
  const edges = (): { y: number; pos: number }[] => {
    const out: { y: number; pos: number }[] = [];
    if (!view || !scroller) return out;
    let foot: { y: number; pos: number } | null = null;
    const doc: PMNode = view.state.doc;
    doc.forEach((node, pos) => {
      const el = domOf(pos);
      if (!el || !el.getClientRects().length) return;
      const r = inContent(scroller!, el);
      if (r.h <= 0) return;
      // between two blocks: halfway across what lies between the one's foot and the next one's top
      out.push({ y: foot ? (foot.y + r.y) / 2 : r.y, pos });
      foot = { y: r.y + r.h, pos: pos + node.nodeSize };
    });
    if (foot) out.push(foot);
    return out;
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
      const { view: box, port, top, height } = portOf(scroller);
      if (port.w <= 0 || port.h <= 0 || covered(scroller, port)) return { id, view: box, port: { ...port, h: 0 }, top, height, open: null, sheets: [] };
      const col = inContent(scroller, view.dom);
      const wrote = editing(view);
      const low = top - NEAR;
      const high = top + box.h + NEAR;
      const sheets: SheetSpec[] = [];
      for (const [src, a] of areas) {
        const s = sheetOf(a, src);
        if (s && s.hit.y + s.hit.h >= low && s.hit.y <= high && wrote) sheets.push(s);
      }
      const gap = gapNow();
      if (gap && fresh) {
        const el = view.dom.querySelector<HTMLElement>(`.ink-gap[data-sheet="${gap.id}"]`);
        if (el) {
          const r = inContent(scroller, el);
          sheets.push({ id: gap.id, frame: { x: col.x, y: r.y + fresh.dy, w: col.w, h: Math.max(gap.height - fresh.dy, 0) + scroller.clientHeight }, hit: { x: col.x, y: r.y, w: col.w, h: gap.height }, zoom: 1 });
        }
      }
      for (const s of sheets) if (s.id !== gap?.id) afterScene(() => void fill(s.id));
      // the column, down to the foot of the scroller's content
      const open = wrote ? { x: col.x, y: col.y, w: col.w, h: Math.max(col.h, scroller.scrollHeight - col.y) } : null;
      return { id, view: box, port, top, height, open, sheets };
    },
    paper(sheet: string): Paper | null {
      const at = storeOf();
      if (!at) return null;
      const a = [...areas.values()].find((x) => x.sheet === sheet);
      if (a) {
        const abs = at.abs(a.page);
        return { name: a.page, read: async () => (await at.fs.ink(abs)) ?? [], write: (s) => at.fs.setInk(abs, s) };
      }
      if (fresh?.sheet !== sheet) return null;
      // a page's name is taken when it is first kept
      let abs: string | null = null;
      return {
        name: sheet,
        read: async () => [],
        write: async (strokes) => {
          if (!strokes.length) return { added: 0, removed: 0 };
          const dir = filesDir(path);
          const names = await at.fs.readDir(at.abs(dir)).then((l) => l.map((e) => e.name), () => [] as string[]);
          const name = nextPage(names);
          abs = at.abs(`${dir}/${name}${INK_EXT}`);
          const done = await at.fs.setInk(abs, strokes);
          named.set(sheet, name);
          return done;
        },
      };
    },
    made(sheet: string): void {
      for (const a of areas.values()) if (a.sheet === sheet) { a.filled = false; void fill(sheet); }
    },
    began(e: PenEvent): void {
      if (!view) return;
      if (!e.fresh) {
        for (const [src, a] of areas) if (a.sheet === e.sheet) { a.live = true; a.rev++; draw(src, a); }
        redraw();
        return;
      }
      if (document.activeElement instanceof HTMLElement) document.activeElement.blur();
      open(e);
    },
    grew(e: PenEvent): void {
      const gap = gapNow();
      if (gap?.id === e.sheet) { setGap({ ...gap, height: gap.height + AREA_STEP }); sceneSoon(); return; }
      for (const [src, a] of areas) if (a.sheet === e.sheet) { a.height += AREA_STEP; draw(src, a); redraw(); }
    },
    async kept(sheet: string, strokes: InkStroke[], drawing: string): Promise<void> {
      const gap = gapNow();
      const bounds = await invoke<[number, number, number, number] | null>('ink_bounds', { drawing });
      const crop = bounds ? cropOf(bounds) : null;
      if (fresh?.sheet === sheet) {
        const was = fresh;
        const name = named.get(sheet);
        fresh = null;
        if (!name || !strokes.length || !crop) { if (gap) setGap(null); void restSheet(sheet); return; }
        named.delete(sheet);
        const src = inkSrc(path, name);
        const a: Area = { sheet, page: `${filesDir(path)}/${name}${INK_EXT}`, dy: was.dy, zoom: 1, height: gap?.height ?? was.height, crop, live: true, filled: true, rev: 0 };
        areas.set(src, a);
        draw(src, a);
        await place(name, gap, was.index);
        void shown(src, a);
        return;
      }
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

  /** Names a page was given when first kept, by sheet. */
  const named = new Map<string, string>();

  /** A new area opens round the stroke that is going on, its canvas staying where it is on the screen. */
  const open = (e: PenEvent): void => {
    if (!view || !scroller) return;
    const list = edges();
    if (!list.length) return;
    const top = e.top ?? e.y ?? 0;
    const was = scroller.scrollTop;
    const at = list[nearestEdge(list.map((l) => l.y), e.y ?? 0)]!;
    fresh = { sheet: e.sheet, dy: 0, height: AREA_START, index: null };
    const height = AREA_START + Math.max(0, top - at.y);
    setGap({ id: e.sheet, pos: at.pos, height });
    const el = view.dom.querySelector<HTMLElement>(`.ink-gap[data-sheet="${e.sheet}"]`);
    if (el) {
      const y = inContent(scroller, el).y;
      // the place is well under the Pencil, which came down on a block: the note moves up, and the Pencil is in the area.
      // Between two blocks it is in the gap already, and nothing above it moves
      const under = y - (e.y ?? 0);
      if (under > PEN_ROOM) scroller.scrollTop += under + 10;
      fresh.dy = top + scroller.scrollTop - was - inContent(scroller, el).y;
    }
    sceneSoon();
  };

  /** The line goes in where the gap is, in the same step as the gap goes. */
  const place = async (name: string, gap: InkGap | null, index: number | null): Promise<void> => {
    const line = inkLine(path, name);
    if (view && !view.isDestroyed && gap) {
      const p = view.state.schema.nodes.paragraph!.create(null, view.state.schema.text(line));
      view.dispatch(view.state.tr.insert(gap.pos, p).setMeta(inkKey, { gap: null } satisfies InkMeta));
      sceneSoon();
      return;
    }
    await writeDoc(path, (d) => { d.blocks.splice(Math.min(index ?? d.blocks.length, d.blocks.length), 0, { kind: 'paragraph', text: line }); });
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
      if (held && !gapNow() && fresh) setGap(held);
      for (const { src } of inkLines(view.state.doc)) if (!areas.has(src)) void measure(src).catch(console.error);
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
      // what was being written is kept: a new area's line goes in where its gap was, through the vault
      const gap = gapNow();
      if (view && gap && fresh) fresh.index = fromDoc(view.state.doc.cut(0, gap.pos)).length;
      const leaving = [...(fresh ? [fresh.sheet] : []), ...[...areas.values()].filter((a) => a.live).map((a) => a.sheet)];
      const gone = off;
      off = null;
      observer?.disconnect();
      scroller?.removeEventListener('scroll', onScroll);
      view = null;
      void Promise.all(leaving.map(keep)).finally(() => gone?.());
    },
  };
}
