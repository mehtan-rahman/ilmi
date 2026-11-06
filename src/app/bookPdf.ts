// A document's pages, shared: the book's pages on the left and the crops
// drawn in its notes on the right (a section's boxes shown inline, a clip)
// read one loaded PDF. Each holder takes it and lets it go; the last to let
// go destroys it a little later, so a pane switching lenses does not load
// it twice. Crops are drawn from a page rendered at the crop's own scale.

import { parseBox, type Box } from '../format/index.js';
import { pageItems, type PageItem } from '../pdf/index.js';
import type { StoreFs } from '../vault/index.js';
import { loadPdf, loadPdfPieces, type PDFDocumentProxy } from './pdfjs.js';
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
    return pageItems((await pg.getTextContent()).items, v.width, v.height);
  })();
  h?.items.set(page, p);
  return p;
}

/** How many pixels a point of a page written on is drawn at, for the canvas's paper. */
const PAPER_SCALE = 2.5;

/** Page `page` of `pdf` as the canvas's paper (milestone 67): its picture as a JPEG in base64, and its size in points. */
export async function pagePaper(pdf: PDFDocumentProxy, page: number): Promise<{ image: string; width: number; height: number }> {
  const pg = await pdf.getPage(page);
  const v1 = pg.getViewport({ scale: 1 });
  const vp = pg.getViewport({ scale: PAPER_SCALE });
  const full = document.createElement('canvas');
  full.width = Math.ceil(vp.width);
  full.height = Math.ceil(vp.height);
  // a JPEG has no see-through: the paper is white under what the page draws
  const cx = full.getContext('2d');
  if (cx) { cx.fillStyle = '#fff'; cx.fillRect(0, 0, full.width, full.height); }
  await pg.render({ canvas: full, viewport: vp, intent: 'print' }).promise;
  return { image: full.toDataURL('image/jpeg', 0.85).replace(/^data:image\/jpeg;base64,/, ''), width: v1.width, height: v1.height };
}

/** How large a crop may be drawn against the page's own size. */
const MAX_SCALE = 2.5;
/** Room kept around a crop, in PDF units. */
const PAD = 4;

/** Draw `box` of the PDF at `rel` into `el`, `width` css px wide. */
export async function drawCrop(el: HTMLElement, rel: string, box: Box, width: number): Promise<void> {
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
