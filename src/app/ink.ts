// Ink (milestone 58): a page of working under the section being read.
//
// A page of ink is its strokes, rows in the store by page
// (`src/vault/store.ts`, `setInk`). The note names its picture as it names
// any image, `![working](name/ink-01.png)`, and the drawing sits beside the
// picture under the same name, `name/ink-01.pkdrawing`; both are made from
// the strokes when they are read, here and on every other device, so
// neither is kept or merged, and an export writes them as files.
//
// The canvas is PencilKit's, over the web view, on an iPad (the
// `tauri-plugin-ink` crate). It is opened with the drawing the page reads
// as and gives back the drawing it holds: while it is open, once it has
// been left alone a moment, and when it closes. The Rust side takes that
// apart into strokes, each with a name that outlives a save, and the page
// is told which it holds now: the new ones are added, the ones gone are
// taken away, the rest are left as they are.
//
// Ink on a book's page (milestone 67). The same canvas, opened over the
// page's own picture and fitted to it, so a stroke lies where it was
// written on the page; the Pencil's touch on a page is what opens it
// (`Pdf.tsx`, `touch.ts`). Those strokes are found by the PDF's hash and
// the page's number, not by a row (`setPageInk`): nothing is written into
// the PDF, and no note names them. Every device lays the picture made of
// them over the page.
//
// The pure part (a page's name, the line a note gets, where it goes) is
// tested; the canvas is an iPad's and is checked there (`ILMI_SMOKE=ink`,
// `ILMI_SMOKE=pageink`).

import { invoke } from '@tauri-apps/api/core';
import { sectionSpan } from '../schedule/index.js';
import type { Block, Doc } from '../format/index.js';
import { INK_EXT, type InkStroke, type StoreFs } from '../vault/index.js';
import { imagePath, isRemote } from './images.js';
import type { PopItem } from './popMenu.js';
import { headingOf, writeDoc } from './sections.js';
import { useApp, type CaretHeading } from './store.js';
import { currentVault } from './vault.js';

/** What a page of ink's picture is called in the note. */
export const INK_ALT = 'working';
/** How long the canvas is left alone before the page is kept, and how often it is looked at. */
export const QUIET_MS = 2500;
const PEEK_MS = 1200;

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

/** `line` put in as a block of its own at the end of the section under `at`; with no heading, at the document's end. */
export function insertUnder(doc: Doc, at: { nth: number; text: string } | null, line: string): void {
  const block: Block = { kind: 'paragraph', text: line };
  const h = at ? headingOf(doc, at) : null;
  if (!h) { doc.blocks.push(block); return; }
  doc.blocks.splice(sectionSpan(doc.blocks, h.index).end, 0, block);
}

/** Whether there is a canvas to draw on: an iPad's. */
export const hasCanvas = (): boolean => useApp.getState().mobile;

/** Whether `draw` is offered on the document at `path`: where there is a canvas, on a page that can be written. */
export const canDraw = (path: string): boolean => hasCanvas() && useApp.getState().docs[path]?.frozen !== true;

const storeOf = (): { fs: StoreFs; abs(rel: string): string } | null => {
  const vault = currentVault();
  return vault && 'setInk' in vault.fs ? { fs: vault.fs as StoreFs, abs: (rel) => vault.abs(rel) } : null;
};

function b64(bytes: Uint8Array): string {
  let s = '';
  for (let i = 0; i < bytes.length; i += 0x8000) s += String.fromCharCode(...bytes.subarray(i, i + 0x8000));
  return btoa(s);
}

interface Canvas {
  strokes: number;
  drawing: string | null;
  open: boolean;
}

/** A book's page as the canvas is given it: its picture in base64 and its size in points. */
export interface Paper {
  image: string;
  width: number;
  height: number;
}

/** What the canvas is open on: where its strokes are read from and kept. */
interface Sheet {
  /** What the checks call it. */
  name: string;
  /** The drawing it holds now, in base64; null when it holds nothing yet. */
  start(): Promise<string | null>;
  /** It holds these strokes from now on. */
  keep(strokes: InkStroke[]): Promise<{ added: number; removed: number }>;
  /** After each keep by the canvas. */
  kept?(): void;
  paper?: Paper;
}

let open = false;
/** Whether the canvas is open. */
export const drawing = (): boolean => open;

/** What a page weighed when it was last kept: how many strokes, their bytes as rows, the drawing's as PencilKit writes it whole. For the checks and the notes. */
export let lastKept: { page: string; strokes: number; rows: number; drawing: number; added: number; removed: number } | null = null;

/** Strokes kept on `sheet` from the drawing the canvas (or a check) gives: taken apart on the Rust side, the difference written, the sync told. */
async function keepOn(sheet: Sheet, data: string, split?: InkStroke[]): Promise<{ strokes: number; added: number; removed: number }> {
  const strokes = split ?? (await invoke<InkStroke[]>('ink_split', { drawing: data }));
  const { added, removed } = await sheet.keep(strokes);
  lastKept = { page: sheet.name, strokes: strokes.length, rows: strokes.reduce((n, s) => n + Math.floor((s.data.length * 3) / 4), 0), drawing: Math.floor((data.length * 3) / 4), added, removed };
  // strokes are no document's write: the sync is told of them here
  if (added || removed) void import('./crdt.js').then((m) => m.crdtWrote(), () => {});
  return { strokes: strokes.length, added, removed };
}

/** The canvas over `sheet`, until `done`: kept when it goes quiet and when it closes. `first` runs once, when something is first kept on a sheet that held nothing. Resolves to whether anything was kept. */
async function run(sheet: Sheet, first?: () => Promise<unknown>): Promise<boolean> {
  if (open) return false;
  open = true;
  // the caret a tap left in the page would bring the keyboard back when the canvas goes
  (document.activeElement as HTMLElement | null)?.blur?.();
  let wrote = false;
  try {
    const start = await sheet.start();
    const had = start !== null;
    const keep = async (data: string): Promise<void> => {
      const strokes = await invoke<InkStroke[]>('ink_split', { drawing: data });
      // a new page nothing was drawn on is no page
      if (!strokes.length && !had && !wrote) return;
      await keepOn(sheet, data, strokes);
      if (!wrote) { wrote = true; if (!had) await first?.(); }
      sheet.kept?.();
    };
    // a finger draws only where a dev run's check asks: a simulator has no Pencil
    const finger = (await invoke<string | null>('dev_env', { name: 'ILMI_SMOKE' }).catch(() => null)) !== null;
    let live = true;
    /** The canvas closed: the look that was waiting its turn does not keep the close waiting. */
    let wake = (): void => {};
    const closed = invoke<Canvas>('ink_open', { drawing: start, finger, ...(sheet.paper ? { paper: sheet.paper.image, width: sheet.paper.width, height: sheet.paper.height } : {}) });
    // kept when it goes quiet, not a stroke at a time
    const watch = (async () => {
      while (live) {
        await new Promise<void>((r) => { const t = setTimeout(r, PEEK_MS); wake = () => { clearTimeout(t); r(); }; });
        if (!live) return;
        const now = await invoke<Canvas>('ink_peek', { quietMs: QUIET_MS }).catch(() => null);
        if (now?.drawing) await keep(now.drawing).catch((e: unknown) => console.error(e));
      }
    })();
    try {
      const end = await closed;
      live = false;
      wake();
      await watch;
      if (end.drawing) await keep(end.drawing);
    } finally {
      live = false;
      wake();
    }
    return wrote;
  } finally {
    open = false;
  }
}

/**
 * The canvas over the page at vault-relative `page` (its `.pkdrawing`),
 * until `done`. `first` runs once, when the page is first kept with a
 * stroke on it: a new page's line goes into its note then, so a canvas
 * closed clean leaves nothing. Resolves to whether anything was kept.
 */
export async function canvas(page: string, first?: () => Promise<unknown>): Promise<boolean> {
  const at = storeOf();
  if (!at || open) return false;
  const abs = at.abs(page);
  return run({
    name: page,
    start: async () => ((await at.fs.stat(abs)) !== null ? b64(await at.fs.readBytes(abs)) : null),
    keep: (strokes) => at.fs.setInk(abs, strokes),
    kept: () => useApp.setState((s) => ({ inkRev: s.inkRev + 1 })),
  }, first);
}

/** A book's page as a sheet: page `page` of the PDF whose SHA-256 is `hash`. */
const pageSheet = (fs: StoreFs, hash: string, page: number, paper?: Paper): Sheet => ({
  name: `${hash.slice(0, 12)} p. ${page}`,
  start: async () => ((await fs.pageInk(hash, page)).length ? b64(await fs.pageInkFile(hash, page, 'drawing')) : null),
  keep: (strokes) => fs.setPageInk(hash, page, strokes),
  ...(paper ? { paper } : {}),
});

/**
 * The canvas over a book's page (milestone 67): page `page` of the PDF
 * whose SHA-256 is `hash`, its picture `paper` under the strokes, until
 * `done`. What is written is that page's strokes, on every row that
 * names the PDF and on every device. Resolves to whether anything was
 * kept.
 */
export async function writeOn(hash: string, page: number, paper: Paper): Promise<boolean> {
  const at = storeOf();
  if (!at || open || !hasCanvas()) return false;
  return run(pageSheet(at.fs, hash, page, paper));
}

/** A drawing's strokes kept as a book's page's: what the canvas does when it goes quiet, for whoever holds a drawing without one (a dev run's check on a Mac). */
export async function keepPage(hash: string, page: number, drawing: string): Promise<{ strokes: number; added: number; removed: number }> {
  const at = storeOf();
  if (!at) throw new Error('no collection to keep it in');
  return keepOn(pageSheet(at.fs, hash, page), drawing);
}

/** A new page of working under the heading `at` of the document at `path` (with none, at its end): the canvas, and once something is drawn the page's line in the note. */
export async function draw(path: string, at: { nth: number; text: string } | null): Promise<boolean> {
  const s = storeOf();
  if (!s) return false;
  const dir = filesDir(path);
  const names = await s.fs.readDir(s.abs(dir)).then((list) => list.map((e) => e.name), () => [] as string[]);
  const page = nextPage(names);
  return canvas(`${dir}/${page}${INK_EXT}`, () => writeDoc(path, (doc) => insertUnder(doc, at, inkLine(path, page))));
}

/** The canvas again on the page an image `src` of the document at `path` shows, when it is a page of ink. Resolves to whether it was one. */
export async function redraw(path: string, src: string): Promise<boolean> {
  const s = storeOf();
  const page = pageOf(path, src);
  if (!s || !page || !hasCanvas() || (await s.fs.stat(s.abs(page))) === null) return false;
  await canvas(page);
  return true;
}

/** `draw`, for a heading's menu. */
export function drawAction(at: CaretHeading): PopItem {
  return { label: 'draw', glyph: '✎', act: 'draw', run: () => void draw(at.path, { nth: at.nth, text: at.text }).catch(console.error) };
}

let unwatch: (() => void) | null = null;

/** From here on a page of ink changed in the open collection (drawn on here, or by a merge) has the readers showing its picture look again. */
export async function watchInk(): Promise<void> {
  unwatch?.();
  unwatch = null;
  const vault = currentVault();
  if (!vault || !('setInk' in vault.fs)) return;
  unwatch = await vault.fs.watch(vault.root, (paths) => {
    if (paths.some((p) => p.endsWith(INK_EXT))) useApp.setState((s) => ({ inkRev: s.inkRev + 1 }));
  });
}
