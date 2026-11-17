// A document's pages, shared: the book's pages on the left and the crops
// drawn in its notes on the right (a section's boxes shown inline, a clip)
// read one loaded PDF. Each holder takes it and lets it go; the last to let
// go destroys it a little later, so a pane switching lenses does not load
// it twice. Crops are drawn from a page rendered at the crop's own scale.
//
// A note may be on a written notebook's sheets instead (milestone 82): there
// is no file to load, and a crop of a sheet is its paper (`paper.ts`) with
// what is written on that part of it, drawn again when the sheet's strokes
// change.

import { parseBox, type Box } from '../format/index.js';
import { pageItems, uprightItems, type PageItem } from '../pdf/index.js';
import type { StoreFs } from '../vault/index.js';
import { loadPdf, loadPdfPieces, type PDFDocumentProxy } from './pdfjs.js';
import { drawPaper, paperOf } from './paper.js';
import { useApp, type DocInfo } from './store.js';
import { currentVault } from './vault.js';

interface Held {
  promise: Promise<PDFDocumentProxy>;
  refs: number;
  timer: ReturnType<typeof setTimeout> | null;
  destroy(): void;
  items: Map<number, Promise<PageItem[]>>;
}

const held = new Map<string, Held>();
/** How long a PDF no one holds stays loaded. */
const LINGER = 20_000;
/** A PDF larger than this is read a piece at a time, as its pages are asked for; a smaller one whole. */
export const WHOLE_MAX = 16 * 1024 * 1024;

/** Take the PDF at vault-relative `rel`; `release` lets it go. */
export function acquirePdf(rel: string): { promise: Promise<PDFDocumentProxy>; release(): void } {
  let h = held.get(rel);
  if (!h) {
    const vault = currentVault();
    let task: ReturnType<typeof loadPdf> | null = null;
    const promise = (async () => {
      if (!vault) throw new Error('no collection open');
      // a written notebook's pages are paper: there is no PDF to read
      if (writtenAt(rel)) throw new Error(`${rel} is written notes, not a pdf`);
      // a file that is not on this device is fetched by either read
      const size = (await vault.fs.stat(vault.abs(rel)))?.size ?? 0;
      const pieces = size > WHOLE_MAX ? await (vault.fs as Partial<StoreFs>).pieces?.(vault.abs(rel)) : null;
      task = pieces ? loadPdfPieces(pieces.size, pieces.read) : loadPdf(await vault.fs.readBytes(vault.abs(rel)));
      return task.promise;
    })();
    const entry: Held = { promise, refs: 0, timer: null, items: new Map(), destroy: () => { void task?.destroy(); } };
    promise.catch(() => { if (held.get(rel) === entry) held.delete(rel); });
    held.set(rel, entry);
    h = entry;
  }
  const mine = h;
  mine.refs++;
  if (mine.timer) { clearTimeout(mine.timer); mine.timer = null; }
  let done = false;
  return {
    promise: mine.promise,
    release() {
      if (done) return;
      done = true;
      mine.refs--;
      if (mine.refs > 0) return;
      mine.timer = setTimeout(() => {
        if (mine.refs > 0 || held.get(rel) !== mine) return;
        held.delete(rel);
        mine.destroy();
      }, LINGER);
    },
  };
}

/** A page's text items, placed as fractions of the page (for naming a passage); read once per page. */
export function itemsOf(rel: string, pdf: PDFDocumentProxy, page: number): Promise<PageItem[]> {
  const h = held.get(rel);
  const cached = h?.items.get(page);
  if (cached) return cached;
  const p = (async () => {
    const pg = await pdf.getPage(page);
    const v = pg.getViewport({ scale: 1 });
    return pageItems(uprightItems((await pg.getTextContent()).items, v.transform, v.height), v.width, v.height);
  })();
  h?.items.set(page, p);
  return p;
}

/** How large a crop may be drawn against the page's own size. */
const MAX_SCALE = 2.5;
/** Room kept around a crop, in PDF units. */
const PAD = 4;

/** The written notebook at `rel`, when it is one. */
const writtenAt = (rel: string): DocInfo['written'] => useApp.getState().docs[rel]?.written;

/** A sheet's picture, read for drawing; null where the web view cannot (or it will not decode). */
async function pictureOf(bytes: Uint8Array): Promise<ImageBitmap | HTMLImageElement | null> {
  const blob = new Blob([bytes as BlobPart], { type: 'image/png' });
  if (typeof createImageBitmap === 'function') return createImageBitmap(blob).catch(() => null);
  if (typeof Image === 'undefined' || typeof URL.createObjectURL !== 'function') return null;
  const url = URL.createObjectURL(blob);
  const img = new Image();
  img.src = url;
  return img.decode().then(() => img, () => null).finally(() => URL.revokeObjectURL(url));
}

/** The crops of written sheets on the screen, each with what it was drawn from: drawn again when its sheet's strokes change. */
const sheetCrops = new Map<HTMLElement, { rel: string; id: string; box: Box; width: number }>();
/** The stores listened to for that. */
const heard = new WeakSet<object>();
/** Which drawing of a crop is the latest: one that finishes after a later one began is dropped. */
const turn = new WeakMap<HTMLElement, number>();

function watchSheets(fs: StoreFs): void {
  if (heard.has(fs)) return;
  heard.add(fs);
  fs.onPageInk((id, sheet) => {
    for (const [el, c] of sheetCrops) {
      if (!el.isConnected) { sheetCrops.delete(el); continue; }
      if (c.id === id && c.box.page === sheet) void drawCrop(el, c.rel, c.box, c.width);
    }
  });
}

/** Draw `box` of the written notebook `w` at `rel` into `el`: the paper under it, then what is written there. `box.page` is the sheet's own number. */
async function drawSheetCrop(el: HTMLElement, rel: string, w: NonNullable<DocInfo['written']>, box: Box, width: number): Promise<void> {
  const mine = (turn.get(el) ?? 0) + 1;
  turn.set(el, mine);
  try {
    if (!w.sheets.includes(box.page)) { sheetCrops.delete(el); el.dataset.drawn = 'gone'; return; }
    const vault = currentVault();
    const fs = vault && 'pageInkFile' in vault.fs ? (vault.fs as StoreFs) : null;
    // the sheet as the notebook's page setup has it: its size, and its paper where it lies among the sheets
    const spec = paperOf(w, Math.max(0, w.sheets.indexOf(box.page)));
    const PAPER_W = spec.w;
    const PAPER_H = spec.h;
    const bw = box.w * PAPER_W + 2 * PAD;
    const bh = box.h * PAPER_H + 2 * PAD;
    const k = Math.min(MAX_SCALE, width / bw);
    const dpr = window.devicePixelRatio || 1;
    const part = { x: box.x * PAPER_W - PAD, y: box.y * PAPER_H - PAD, w: bw, h: bh };
    // a sheet with nothing written on it is its paper alone
    const inked = fs ? (await fs.pageInk(w.id, box.page)).length > 0 : false;
    // what is written, as fine as the clip is drawn: sharp at the clip's own size
    const bytes = fs && inked ? await fs.pageInkFile(w.id, box.page, 'picture', PAPER_W, PAPER_H, Math.min(6, Math.max(2, Math.ceil(k * dpr)))) : new Uint8Array();
    const picture = bytes.length ? await pictureOf(bytes) : null;
    if (turn.get(el) !== mine) return;
    const out = document.createElement('canvas');
    out.width = Math.ceil(bw * k * dpr);
    out.height = Math.ceil(bh * k * dpr);
    out.style.width = `${bw * k}px`;
    out.style.height = `${bh * k}px`;
    const ctx = out.getContext('2d');
    if (ctx) {
      drawPaper(ctx, spec, part, k * dpr);
      // the picture is of the whole sheet, at whatever size it was made: the box's part of it
      if (picture) {
        const px = picture.width / PAPER_W;
        const py = picture.height / PAPER_H;
        ctx.drawImage(picture, part.x * px, part.y * py, part.w * px, part.h * py, 0, 0, out.width, out.height);
      }
    }
    el.replaceChildren(out);
    el.dataset.drawn = '1';
    el.dataset.sheet = String(box.page);
    el.dataset.inked = picture ? '1' : '0';
    // the note says the page as the notebook counts it now, not the sheet's own number
    const place = w.sheets.indexOf(box.page) + 1;
    el.title = `p. ${place}`;
    const cap = el.parentElement?.querySelector('.clip-cap');
    if (cap) cap.textContent = `p. ${place}`;
    if (fs) { sheetCrops.set(el, { rel, id: w.id, box, width }); watchSheets(fs); }
  } catch (e) {
    console.error(rel, e);
    if (turn.get(el) === mine) el.dataset.drawn = 'gone';
  }
}

/** Draw `box` of the pages at `rel` (a PDF, or a written notebook) into `el`, `width` css px wide. */
export async function drawCrop(el: HTMLElement, rel: string, box: Box, width: number): Promise<void> {
  const w = writtenAt(rel);
  if (w) return drawSheetCrop(el, rel, w, box, width);
  const h = acquirePdf(rel);
  try {
    const pdf = await h.promise;
    if (box.page < 1 || box.page > pdf.numPages) { el.dataset.drawn = 'gone'; return; }
    const page = await pdf.getPage(box.page);
    const v1 = page.getViewport({ scale: 1 });
    const bw = box.w * v1.width + 2 * PAD;
    const bh = box.h * v1.height + 2 * PAD;
    const k = Math.min(MAX_SCALE, width / bw);
    const dpr = window.devicePixelRatio || 1;
    const vp = page.getViewport({ scale: k * dpr });
    const full = document.createElement('canvas');
    full.width = Math.ceil(vp.width);
    full.height = Math.ceil(vp.height);
    // the print intent draws without animation frames, which WebKit holds back in a covered window
    await page.render({ canvas: full, viewport: vp, intent: 'print' }).promise;
    const out = document.createElement('canvas');
    out.width = Math.ceil(bw * k * dpr);
    out.height = Math.ceil(bh * k * dpr);
    out.style.width = `${bw * k}px`;
    out.style.height = `${bh * k}px`;
    const sx = (box.x * v1.width - PAD) * k * dpr;
    const sy = (box.y * v1.height - PAD) * k * dpr;
    out.getContext('2d')?.drawImage(full, sx, sy, out.width, out.height, 0, 0, out.width, out.height);
    el.replaceChildren(out);
    el.dataset.drawn = '1';
  } catch (e) {
    console.error(rel, e);
    el.dataset.drawn = 'gone';
  } finally {
    h.release();
  }
}

/** Draw every crop under `root` not drawn yet: `.crop[data-box]`, at its own width. */
export function fillCrops(root: HTMLElement, rel: string): void {
  for (const el of root.querySelectorAll<HTMLElement>('.crop[data-box]:not([data-drawn])')) {
    const box = parseBox(el.dataset.box ?? '');
    if (!box) { el.dataset.drawn = 'gone'; continue; }
    el.dataset.drawn = '0';
    const width = Math.max(120, Math.min(el.parentElement?.clientWidth || el.clientWidth || 560, 640));
    void drawCrop(el, rel, box, width);
  }
}
