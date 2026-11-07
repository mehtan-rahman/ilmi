// Ink (milestones 58, 67, 69).
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
// Where the Pencil lands it writes (milestone 69). The canvases are
// PencilKit's, lying over the web view on an iPad (the `tauri-plugin-ink`
// crate) with nothing to open: the Pencil's first touch is a stroke before
// this page has heard of it. What the page does here is say where things
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
// The pure part (a page's name, the line a note gets, the place between
// two blocks, a picture's place, a merge) is tested; the canvases are an
// iPad's and are checked there (`ILMI_SMOKE=ink`, `ILMI_SMOKE=pageink`).

import { invoke } from '@tauri-apps/api/core';
import { INK_EXT, type InkStroke, type StoreFs } from '../vault/index.js';
import { imagePath, isRemote } from './images.js';
import { useApp } from './store.js';
import { currentVault } from './vault.js';

/** What a page of ink's picture is called in the note. */
export const INK_ALT = 'working';

const PAGE = /^ink-(\d+)\.(?:png|pkdrawing)$/;

/** The next page's name among a document's files: `ink-01`, `ink-02`, …, one past the highest there is. */
export function nextPage(names: readonly string[]): string {
  let top = 0;
  for (const n of names) {
    const m = PAGE.exec(n);
    if (m) top = Math.max(top, Number(m[1]));
  }
  return `ink-${String(top + 1).padStart(2, '0')}`;
}

/** Where the files of the document at `path` land: the directory of its name (FORMAT.md §1). */
export const filesDir = (path: string): string => path.replace(/\.md$/, '');

/** The image's source as the note at `path` writes it: relative, through the directory of the note's name. */
export function inkSrc(path: string, page: string): string {
  const stem = filesDir(path).split('/').pop() ?? '';
  return `${encodeURIComponent(stem)}/${page}.png`;
}

/** The line a note gets for a page. */
export const inkLine = (path: string, page: string): string => `![${INK_ALT}](${inkSrc(path, page)})`;

/** The drawing beside the picture an image `src` in the document at `path` names, vault-relative; null when it names no PNG in the vault. */
export function pageOf(path: string, src: string): string | null {
  const rel = isRemote(src) ? null : imagePath(path, src);
  return rel && /\.png$/i.test(rel) ? `${rel.slice(0, -4)}${INK_EXT}` : null;
}

/** Where a new area opens: the place between two blocks nearest `y`, of the `edges` there are (each block's top, and the last one's foot). */
export function nearestEdge(edges: readonly number[], y: number): number {
  let best = 0;
  for (let i = 1; i < edges.length; i++) if (Math.abs(edges[i]! - y) < Math.abs(edges[best]! - y)) best = i;
  return best;
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
}

/** A scroller on the page and what lies in it. */
export interface HostSpec {
  id: string;
  /** The scroller, on the page: its scroll view is found by this. */
  view: Box;
  /** What of it ink shows in and the Pencil writes in. */
  port: Box;
  top: number;
  /** How tall its content is. */
  height: number;
  /** Where a Pencil off every sheet opens a new one, in its content. */
  open: Box | null;
  sheets: SheetSpec[];
}

/** What the native side says the Pencil did. */
export interface PenEvent {
  kind: 'begin' | 'grow' | 'end' | 'quiet';
  sheet: string;
  host?: string;
  /** A sheet that held nothing and that the page has not heard of: a new area. */
  fresh?: boolean;
  x?: number;
  y?: number;
  /** Where its canvas's top lies, in the scroller's content. */
  top?: number;
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

/** A sheet's canvas holds what `paper` does, unless it does already. The native side keeps what it has while it is being written on. */
export async function fillSheet(sheet: string, paper: Paper, drawing: () => Promise<Uint8Array>): Promise<void> {
  const strokes = await paper.read();
  const was = bases.get(sheet);
  if (was && was.size === strokes.length && strokes.every((s) => was.has(s.stroke))) return;
  const took = await invoke<{ took: boolean }>('ink_fill', { sheet, drawing: strokes.length ? b64(await drawing()) : null });
  if (took.took) bases.set(sheet, new Set(strokes.map((s) => s.stroke)));
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

async function sendScene(): Promise<void> {
  const hosts = [...surfaces].map((s) => s.host()).filter((h): h is HostSpec => h !== null);
  const dark = document.documentElement.dataset.theme === 'dark';
  const text = JSON.stringify({ hosts, dark });
  if (text !== said) {
    said = text;
    const got = await invoke<{ made: string[] } | null>('ink_scene', { scene: { hosts, dark } });
    // a canvas made anew (come back into the near screens) holds nothing yet
    for (const id of got?.made ?? []) {
      bases.delete(id);
      for (const s of surfaces) s.made?.(id);
    }
  }
  for (const f of afters.splice(0)) f();
}

/** `f` once the scene being made has reached the canvases: a sheet in it is there to be told something. */
export const afterScene = (f: () => void): void => { afters.push(f); sceneSoon(); };

/** The layout changed: the canvases are told, once it has settled for this turn. */
export function sceneSoon(): void {
  if (timer !== null || !hasCanvas()) return;
  timer = setTimeout(() => { timer = null; void sendScene().catch(console.error); }, 0);
}

function heard(e: PenEvent): void {
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
  (window as unknown as { __ink?: (e: PenEvent) => void }).__ink = heard;
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
    if (at && !scroller.contains(at)) return true;
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
export function portOf(scroller: HTMLElement, under?: Element | null): { view: Box; port: Box; top: number; height: number } {
  const view = boxOf(scroller.getBoundingClientRect());
  const cut = under ? Math.max(0, under.getBoundingClientRect().bottom - view.y) : 0;
  return { view, port: { ...view, y: view.y + cut, h: view.h - cut }, top: scroller.scrollTop, height: scroller.scrollHeight };
}

/** The tools and the scroll are the native side's; a page's layout changing is the page's to say: everything said anew when the app changes around it. */
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
