// Ink (milestones 58, 67, 69, 82).
//
// A page of ink is its strokes, rows in the store by page
// (`src/vault/store.ts`, `setInk`). The note names its picture as it names
// any image, `![working](name/ink-01.png)`, and the drawing sits beside the
// picture under the same name, `name/ink-01.pkdrawing`; both are made from
// the strokes when they are read, here and on every other device, so
// neither is kept or merged, and an export writes them as files. A book's
// page is the same under the PDF's hash and the page's number
// (`setPageInk`): nothing is written into the PDF, and no note names it.
//
// Where the Pencil lands on a sheet it writes (milestone 69). The canvases
// are PencilKit's, lying over the web view on an iPad (the `tauri-plugin-ink`
// crate) with nothing to open: the Pencil's first touch is a stroke before
// this page has heard of it. The sheets are a book's pages, a written
// notebook's, and the ink areas a typed note already holds; a typed note's
// text takes no new writing (milestone 82), and the tools are ours
// (`inkTools.ts`, `InkBar.tsx`). What the page does here is say where things
// are. Each open note and book is a surface; a surface says how its
// scroller lies and where its sheets lie in that scroller's content, and
// `sceneSoon` sends that whenever the layout changes (never for a scroll:
// the native side watches the scroller itself). The native side says what
// the Pencil did through `window.__ink`: a stroke begun, grown near a
// sheet's foot, ended, and the writing gone quiet, at which the drawing is
// asked for, taken apart into strokes on the Rust side and kept: the new
// ones added, the ones gone taken away, the rest left as they are. Strokes
// a merge brought in meanwhile are kept (`mergeStrokes`).
//
// The pure part (the drawing a note's line names, a picture's place, a
// merge) is tested; the canvases are an
// iPad's and are checked there (`ILMI_SMOKE=ink`, `ILMI_SMOKE=pageink`).

import { invoke } from '@tauri-apps/api/core';
import { INK_EXT, type InkStroke, type StoreFs } from '../vault/index.js';
import { imagePath, isRemote } from './images.js';
import { canvasesReady, setOpen, toolsHeard } from './inkTools.js';
import { create } from 'zustand';
import { useApp } from './store.js';
import { currentVault } from './vault.js';

/** The drawing beside the picture an image `src` in the document at `path` names, vault-relative; null when it names no PNG in the vault. */
export function pageOf(path: string, src: string): string | null {
  const rel = isRemote(src) ? null : imagePath(path, src);
  return rel && /\.png$/i.test(rel) ? `${rel.slice(0, -4)}${INK_EXT}` : null;
}

/** What a page's picture is cut to, from what its strokes cover (`ilmi_ink_picture`: 12 points round them, in whole points). */
export function cropOf([x, y, w, h]: readonly [number, number, number, number]): { x: number; y: number; w: number; h: number } {
  const x0 = Math.floor(x - 12);
  const y0 = Math.floor(y - 12);
  return { x: x0, y: y0, w: Math.ceil(x + w + 12) - x0, h: Math.ceil(y + h + 12) - y0 };
}

/**
 * What a sheet holds once a canvas's strokes `now` are kept over the
 * store's `had`, the canvas having started from the names in `base`: what
 * it dropped is gone, what it made is added, and what a merge brought in
 * while it was being written on stays.
 */
export function mergeStrokes(had: readonly InkStroke[], base: ReadonlySet<string>, now: readonly InkStroke[]): InkStroke[] {
  const names = new Set(now.map((s) => s.stroke));
  const others = had.filter((s) => !names.has(s.stroke) && !base.has(s.stroke));
  return [...now, ...others].sort((a, b) => a.at - b.at);
}

/** Whether there is a canvas to write on: an iPad's. */
export const hasCanvas = (): boolean => useApp.getState().mobile;

export const storeOf = (): { fs: StoreFs; abs(rel: string): string } | null => {
  const vault = currentVault();
  return vault && 'setInk' in vault.fs ? { fs: vault.fs as StoreFs, abs: (rel) => vault.abs(rel) } : null;
};

export function b64(bytes: Uint8Array): string {
  let s = '';
  for (let i = 0; i < bytes.length; i += 0x8000) s += String.fromCharCode(...bytes.subarray(i, i + 0x8000));
  return btoa(s);
}

/** A rectangle in px. */
export interface Box { x: number; y: number; w: number; h: number }

/** A canvas where a surface wants it, in its scroller's content. */
export interface SheetSpec {
  id: string;
  frame: Box;
  /** Where the Pencil adds to this sheet. */
  hit: Box;
  /** Points of the screen to a point of the drawing. */
  zoom: number;
  /** How its ink lies on what is under it, where the canvas stays shown at rest (a page's): as the page's picture of it is blended. */
  blend?: 'multiply' | 'screen';
}

/** A scroller on the page and what lies in it. */
export interface HostSpec {
  id: string;
  /** The scroller, on the page: its scroll view is found by this. */
  view: Box;
  /** What of it ink shows in and the Pencil writes in. */
  port: Box;
  top: number;
  /** How far it is scrolled sideways (pages zoomed past their pane). */
  left?: number;
  /** How tall its content is. */
  height: number;
  /** Where a Pencil off every sheet would open a new one, in its content: nowhere (milestone 82), always null. */
  open: Box | null;
  sheets: SheetSpec[];
  /** The column of pages two fingers zoom, in the scroller's content, and the zoom it has and may have (milestone 86): the native side stretches it under the fingers itself. */
  pages?: Box;
  zoom?: { z: number; min: number; max: number };
}

/** What the native side says the Pencil did. */
export interface PenEvent {
  kind: 'begin' | 'grow' | 'end' | 'quiet';
  sheet: string;
  host?: string;
  x?: number;
  y?: number;
  /** Where its canvas's top lies, in the scroller's content. */
  top?: number;
}

/** What the native side says of the tools: what can be taken back, the colour wheel's colour as it turns, the Pencil tapped twice or squeezed. */
export type ToolEvent = { kind: 'history'; undo: boolean; redo: boolean } | { kind: 'color'; color: string } | { kind: 'pencil'; what: string; prefer: string };

/**
 * What the native side says of the lasso (milestone 85): what it holds and
 * where that lies in its host's content (`picked`), that it holds nothing or
 * is being moved (`unpicked`), that the Pencil rested under it where nothing
 * is held (`rest`: what was cut or copied can be put down there), and that a
 * stroke ended resting became a shape.
 */
export type LassoEvent =
  | { kind: 'picked'; sheet: string; host: string; count: number; clip: number; x: number; y: number; w: number; h: number }
  | { kind: 'unpicked'; moving?: boolean }
  | { kind: 'rest'; sheet: string; host: string; x: number; y: number; clip: number }
  | { kind: 'shape'; sheet: string; shape: string };

/**
 * What the native side says fingers did on the glass: two or three tapped at
 * once, one tapped twice on a host's pages (`double`), or two pinched (how
 * far spread against how they began, and the place between them, on the
 * page). A pinch it stretches itself is `native` (milestone 86): the pages
 * of `host` follow the fingers with no word from the page; `end` says where
 * the place they were taken by is (`x`, `y`) and what place of the column
 * that was (`lx`, `ly`, from its corner), and `settled` that the pages are
 * shown where the page asked (`settleSheets`).
 */
export type FingerEvent =
  | { kind: 'fingers'; n: number; x: number; y: number }
  | { kind: 'double'; host: string; x: number; y: number }
  | { kind: 'pinch'; phase: 'begin' | 'change' | 'end' | 'cancel' | 'settled'; k: number; x: number; y: number; native?: boolean; host?: string; lx?: number; ly?: number };

/**
 * What a notebook's surface says (milestone 87, `surface.ts`): the page in
 * view and the zoom as the pages move (`view`) and when a zoom ends
 * (`zoomed`), sheets come near whose strokes it wants (`want`), a stroke
 * begun low on the last sheet (`grow`), `add page` pressed (`add`), a box
 * drawn by a held finger (`boxed`), a passage's tag pressed (`tag`), a tap on
 * the pages (`tap`), the pages beginning to move (`moving`), and that
 * they were touched at all (`touch`: what closes at a press elsewhere closes).
 */
export interface SurfaceEvent {
  kind: 'surface';
  id: string;
  what: 'view' | 'zoomed' | 'want' | 'grow' | 'add' | 'boxed' | 'boxing' | 'tag' | 'tap' | 'moving' | 'touch';
  page?: number; pages?: number; zoom?: number; top?: number; x?: number; y?: number; w?: number; h?: number;
  moving?: boolean; pend?: Box; sheets?: string[]; sheet?: number; key?: string;
  /** Where the first sheet lies on the surface (left, top, width, height) and how far it is from one sheet's top to the next's, px. */
  lay?: number[];
}

const surfaceEars = new Map<string, (e: SurfaceEvent) => void>();
/** `f` hears what the surface named `id` says. Returns the undoing. */
export function onSurface(id: string, f: (e: SurfaceEvent) => void): () => void {
  (window as unknown as { __ink?: (e: Heard) => void }).__ink = heard;
  surfaceEars.set(id, f);
  return () => { if (surfaceEars.get(id) === f) surfaceEars.delete(id); };
}

type Heard = PenEvent | ToolEvent | LassoEvent | FingerEvent | SurfaceEvent;

const fingerEars = new Set<(e: FingerEvent) => void>();
/** `f` hears what two and three fingers do, wherever on the page: each lens takes what falls on it. Returns the undoing. */
export function onFingers(f: (e: FingerEvent) => void): () => void {
  if (!hasCanvas()) return () => {};
  (window as unknown as { __ink?: (e: PenEvent | ToolEvent | LassoEvent | FingerEvent) => void }).__ink = heard;
  fingerEars.add(f);
  return () => { fingerEars.delete(f); };
}

/** What the lasso holds, for the menu beside it; and where the Pencil rested with something to put down. */
export interface Lasso {
  picked: { sheet: string; host: string; count: number; clip: number; box: Box } | null;
  rest: { sheet: string; host: string; x: number; y: number } | null;
}
export const useLasso = create<Lasso>(() => ({ picked: null, rest: null }));

/** Something done with what the lasso holds: `cut`, `copy`, `duplicate`, `delete`, or `color` with a colour. */
export const lassoDo = (op: 'cut' | 'copy' | 'duplicate' | 'delete' | 'color', color?: string): Promise<void> =>
  invoke<{ selected: number; clip: number }>('ink_selection', { op, color: color ?? null }).then((got) => {
    const was = useLasso.getState().picked;
    if (was && got.selected > 0) useLasso.setState({ picked: { ...was, clip: got.clip } });
  }, console.error);

/** What was cut or copied put down where the Pencil rested. */
export function lassoPaste(): Promise<void> {
  const at = useLasso.getState().rest;
  useLasso.setState({ rest: null });
  return at ? invoke('ink_paste', { sheet: at.sheet, x: at.x, y: at.y }).then(() => {}, console.error) : Promise.resolve();
}

/**
 * Two fingers pinch a surface's pages (`Pdf.tsx`): its sheets are shown at
 * `k * p + (dx, dy)`, `p` in its scroller's content, until the next scene
 * lays them out; null puts them back as they lie.
 */
export function pinchSheets(host: string, at: { k: number; dx: number; dy: number } | null): void {
  if (!hasCanvas()) return;
  void invoke('ink_pinch', { pinch: at ? { host, ...at } : { host } }).catch(() => {});
}

/**
 * The pages of `host` eased to where they will lie once laid out at another
 * zoom (milestone 86): a point `l` of their column, from its corner as it
 * lies, shown at `corner + (tx, ty) + k * l`. The native side says `settled`
 * when they are there (at once when they already are).
 */
export function settleSheets(host: string, to: { k: number; tx: number; ty: number }, ms: number): void {
  if (!hasCanvas()) return;
  void invoke('ink_pinch', { pinch: { host, to: { k: to.k, tx: to.tx, ty: to.ty }, ms } }).catch(() => {});
}

let frozen = false;
let thaw: ReturnType<typeof setTimeout> | null = null;
/** While a zoom is being handed from the fingers to the layout no scene is sent: the canvases stay as they are shown until the pages are laid out, then are told once. */
export function holdScenes(on: boolean): void {
  frozen = on;
  if (thaw !== null) { clearTimeout(thaw); thaw = null; }
  // (never held for good)
  if (on) thaw = setTimeout(() => { thaw = null; frozen = false; sceneSoon(); }, 4000);
  else sceneSoon();
}

/** A sheet's strokes in the store. */
export interface Paper {
  /** What the checks call it. */
  name: string;
  read(): Promise<InkStroke[]>;
  /** It holds these strokes from now on. */
  write(strokes: InkStroke[]): Promise<{ added: number; removed: number }>;
}

/** An open note or book: what it says of itself, and what it hears. */
export interface Surface {
  host(): HostSpec | null;
  paper(sheet: string): Paper | null;
  /** The Pencil is on it, or near a sheet's foot. */
  began?(e: PenEvent): void;
  grew?(e: PenEvent): void;
  /** A canvas was made for this sheet: it is to be told what the store holds. */
  made?(sheet: string): void;
  /** Kept: `drawing` is what the canvas gave. The surface shows what it holds now, and then lets the canvas go (`rest`). */
  kept(sheet: string, strokes: InkStroke[], drawing: string): Promise<void>;
}

const surfaces = new Set<Surface>();
/** What each sheet's canvas started from: the names it was given or last gave back. */
const bases = new Map<string, Set<string>>();

/** What a page weighed when it was last kept: how many strokes, their bytes as rows, the drawing's as PencilKit writes it whole. For the checks and the notes. */
export let lastKept: { page: string; strokes: number; rows: number; drawing: number; added: number; removed: number } | null = null;

/** Strokes kept on `paper` from `data` (a drawing as PencilKit writes it): taken apart on the Rust side, the difference written, the sync told. */
async function keepOn(paper: Paper, data: string, id?: string): Promise<{ strokes: InkStroke[]; added: number; removed: number }> {
  const now = await invoke<InkStroke[]>('ink_split', { drawing: data });
  // a canvas not yet told what the store holds took nothing away from it
  const base = id ? bases.get(id) ?? new Set<string>() : undefined;
  const all = base ? mergeStrokes(await paper.read(), base, now) : now;
  const { added, removed } = await paper.write(all);
  if (id) bases.set(id, new Set(all.map((s) => s.stroke)));
  lastKept = { page: paper.name, strokes: all.length, rows: all.reduce((n, s) => n + Math.floor((s.data.length * 3) / 4), 0), drawing: Math.floor((data.length * 3) / 4), added, removed };
  // strokes are no document's write: the sync is told of them here
  if (added || removed) void import('./crdt.js').then((m) => m.crdtWrote(), () => {});
  return { strokes: all, added, removed };
}

/** A book's page as paper: page `page` of the PDF whose SHA-256 is `hash`. */
export const pagePaper = (fs: StoreFs, hash: string, page: number): Paper => ({
  name: `${hash.slice(0, 12)} p. ${page}`,
  read: () => fs.pageInk(hash, page),
  write: (strokes) => fs.setPageInk(hash, page, strokes),
});

/** A drawing's strokes kept as a book's page's: what a canvas gives when it goes quiet, for whoever holds a drawing without one (a dev run's check on a Mac). */
export async function keepPage(hash: string, page: number, drawing: string): Promise<{ strokes: number; added: number; removed: number }> {
  const at = storeOf();
  if (!at) throw new Error('no collection to keep it in');
  const { strokes, added, removed } = await keepOn(pagePaper(at.fs, hash, page), drawing);
  return { strokes: strokes.length, added, removed };
}

/**
 * A sheet's canvas holds what `paper` does, unless it does already. The
 * native side keeps what it has while it is being written on. With `show`
 * the canvas stays on the screen with it (a page's, milestone 85: what is
 * written is drawn from its strokes at rest as it is while written, sharp at
 * any size; a picture of it is what a device with no canvas shows). Resolves
 * to whether the canvas holds it now.
 */
export async function fillSheet(sheet: string, paper: Paper, drawing: () => Promise<Uint8Array>, show = false): Promise<boolean> {
  const strokes = await paper.read();
  const was = bases.get(sheet);
  if (was && was.size === strokes.length && strokes.every((s) => was.has(s.stroke))) return true;
  const took = await invoke<{ took: boolean }>('ink_fill', { sheet, drawing: strokes.length ? b64(await drawing()) : null, show });
  if (took.took) bases.set(sheet, new Set(strokes.map((s) => s.stroke)));
  return took.took;
}

/** The canvas goes until the Pencil's next touch: the page is showing its picture. */
export const restSheet = (sheet: string): Promise<void> => invoke<void>('ink_rest', { sheet }).catch(console.error);

/** One keep at a time on a sheet. */
const chains = new Map<string, Promise<unknown>>();

async function keepSheet(sheet: string): Promise<void> {
  for (const s of surfaces) {
    const paper = s.paper(sheet);
    if (!paper) continue;
    const got = await invoke<{ strokes: number; drawing: string | null }>('ink_take', { sheet });
    if (!got.drawing) return;
    const { strokes } = await keepOn(paper, got.drawing, sheet);
    await s.kept(sheet, strokes, got.drawing);
    return;
  }
}

/** The sheet's writing kept, after whatever keep is going on. */
export function keep(sheet: string): Promise<void> {
  const next = (chains.get(sheet) ?? Promise.resolve()).then(() => keepSheet(sheet)).catch(console.error);
  chains.set(sheet, next);
  return next;
}

/** Whether a keep is going on: for the checks. */
export const settled = async (): Promise<void> => { await Promise.all(chains.values()); };

let timer: ReturnType<typeof setTimeout> | null = null;
let said = '';

/** What waits for the canvases to be where the last scene put them. */
let afters: (() => void)[] = [];

/** What the page lays over the sheets: the canvases lie over the web view, and stand aside for these. */
export const OVER = '[data-ink-over], .pop-menu, .ctx-menu, .sel-cue, .pdf-peek, .pdf-bar, .palette-panel, .notice';

const layoutEars = new Set<() => void>();
/** `f` whenever the page's layout may have changed (what `sceneSoon` is called for): a notebook's surface looks again at where it lies. Returns the undoing. */
export function onLayout(f: () => void): () => void {
  layoutEars.add(f);
  return () => { layoutEars.delete(f); };
}

async function sendScene(): Promise<void> {
  for (const f of layoutEars) f();
  if (frozen) return;
  const hosts = [...surfaces].map((s) => s.host()).filter((h): h is HostSpec => h !== null);
  const dark = document.documentElement.dataset.theme === 'dark';
  // what the page lays over the sheets (a tool's settings, a menu, the lasso's): no place to write
  const holes: Box[] = Array.from(document.querySelectorAll(OVER)).map((el) => boxOf(el.getBoundingClientRect())).filter((b) => b.w > 0 && b.h > 0);
  const text = JSON.stringify({ hosts, dark, holes });
  if (text !== said) {
    said = text;
    const got = await invoke<{ made: string[] } | null>('ink_scene', { scene: { hosts, dark, holes } });
    // a canvas made anew (come back into the near screens) holds nothing yet
    for (const id of got?.made ?? []) {
      bases.delete(id);
      for (const s of surfaces) s.made?.(id);
    }
  }
  // the canvases are there from the first scene on: they are told the tool
  canvasesReady();
  for (const f of afters.splice(0)) f();
}

/** A sheet whose canvas or surface holds nothing the page knows of: the next `fillSheet` gives it what the store holds. */
export const forgetSheet = (sheet: string): void => { bases.delete(sheet); };

/** `f` once the scene being made has reached the canvases: a sheet in it is there to be told something. */
export const afterScene = (f: () => void): void => { afters.push(f); sceneSoon(); };

/** The layout changed: the canvases are told, once it has settled for this turn. */
export function sceneSoon(): void {
  if (timer !== null || !hasCanvas()) return;
  timer = setTimeout(() => { timer = null; void sendScene().catch(console.error); }, 0);
}

function heard(e: Heard): void {
  if (e.kind === 'surface') { surfaceEars.get(e.id)?.(e); return; }
  if (e.kind === 'fingers' || e.kind === 'pinch' || e.kind === 'double') { for (const f of fingerEars) f(e); return; }
  if (e.kind === 'history' || e.kind === 'color' || e.kind === 'pencil') { toolsHeard(e); return; }
  if (e.kind === 'picked') { useLasso.setState({ picked: { sheet: e.sheet, host: e.host, count: e.count, clip: e.clip, box: { x: e.x, y: e.y, w: e.w, h: e.h } }, rest: null }); sceneSoon(); return; }
  if (e.kind === 'unpicked') { if (useLasso.getState().picked) useLasso.setState({ picked: null }); return; }
  if (e.kind === 'rest') { useLasso.setState({ rest: e.clip > 0 ? { sheet: e.sheet, host: e.host, x: e.x ?? 0, y: e.y ?? 0 } : null }); return; }
  if (e.kind === 'shape') return;
  // the Pencil is down again: a place to put something down is no longer asked for
  if (e.kind === 'begin' && useLasso.getState().rest) useLasso.setState({ rest: null });
  // and a tool's settings left open close: the Pencil is writing
  if (e.kind === 'begin') setOpen(null);
  if (e.kind === 'quiet') { void keep(e.sheet); return; }
  for (const s of surfaces) {
    if (e.kind === 'begin' && e.host !== s.host()?.id) continue;
    if (e.kind === 'begin') s.began?.(e);
    else if (e.kind === 'grow') s.grew?.(e);
  }
}

/** From here on `s` is written on where the Pencil lands. Returns the undoing: what was written on it is kept first. */
export function addSurface(s: Surface): () => void {
  if (!hasCanvas()) return () => {};
  (window as unknown as { __ink?: (e: PenEvent | ToolEvent | LassoEvent | FingerEvent) => void }).__ink = heard;
  surfaces.add(s);
  sceneSoon();
  return () => { surfaces.delete(s); sceneSoon(); };
}

/** Whatever of `box` on the page something lies over, a menu or the tree's sheet, is no place to write: the corners and the middle are asked. */
export function covered(scroller: HTMLElement, box: Box): boolean {
  if (typeof document.elementFromPoint !== 'function') return false;
  const dx = Math.min(24, box.w / 4);
  const dy = Math.min(24, box.h / 4);
  for (const [x, y] of [[box.x + dx, box.y + dy], [box.x + box.w - dx, box.y + dy], [box.x + box.w / 2, box.y + box.h / 2], [box.x + dx, box.y + box.h - dy], [box.x + box.w - dx, box.y + box.h - dy]] as const) {
    const at = document.elementFromPoint(x, y);
    // (what the canvases stand aside for piece by piece, `OVER`, covers only itself)
    if (at && !scroller.contains(at) && !at.closest(OVER)) return true;
  }
  return false;
}

/** Where `el` lies in `scroller`'s content. */
export function inContent(scroller: HTMLElement, el: Element): Box {
  const s = scroller.getBoundingClientRect();
  const r = el.getBoundingClientRect();
  return { x: r.left - s.left + scroller.scrollLeft, y: r.top - s.top + scroller.scrollTop, w: r.width, h: r.height };
}

const boxOf = (r: DOMRect): Box => ({ x: r.left, y: r.top, w: r.width, h: r.height });

/** A scroller's own place, and its port under what stands at its top. */
export function portOf(scroller: HTMLElement, under?: Element | null): { view: Box; port: Box; top: number; left: number; height: number } {
  const view = boxOf(scroller.getBoundingClientRect());
  const cut = under ? Math.max(0, under.getBoundingClientRect().bottom - view.y) : 0;
  return { view, port: { ...view, y: view.y + cut, h: view.h - cut }, top: scroller.scrollTop, left: scroller.scrollLeft, height: scroller.scrollHeight };
}

/** The scroll is the native side's; a page's layout changing is the page's to say: everything said anew when the app changes around it. */
export function watchLayout(): () => void {
  if (!hasCanvas()) return () => {};
  const off = useApp.subscribe(() => sceneSoon());
  const mo = new MutationObserver(() => sceneSoon());
  mo.observe(document.body, { childList: true });
  const onResize = (): void => { said = ''; sceneSoon(); setTimeout(sceneSoon, 350); };
  const onHide = (): void => {
    if (document.visibilityState !== 'hidden') return;
    for (const id of bases.keys()) void keep(id);
  };
  window.addEventListener('resize', onResize);
  document.addEventListener('visibilitychange', onHide);
  return () => { off(); mo.disconnect(); window.removeEventListener('resize', onResize); document.removeEventListener('visibilitychange', onHide); };
}

let unwatch: (() => void) | null = null;

/** From here on a page of ink changed in the open collection (written on here, or by a merge) has the readers showing its picture look again. */
export async function watchInk(): Promise<void> {
  unwatch?.();
  unwatch = null;
  const vault = currentVault();
  if (!vault || !('setInk' in vault.fs)) return;
  unwatch = await vault.fs.watch(vault.root, (paths) => {
    if (paths.some((p) => p.endsWith(INK_EXT))) useApp.setState((s) => ({ inkRev: s.inkRev + 1 }));
  });
}
