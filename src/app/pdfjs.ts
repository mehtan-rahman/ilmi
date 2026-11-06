// pdf.js, as the lens and the intake use it: bundled by Vite, the worker as
// pdf.js ships it, no CDN. The pure side (a page's paragraphs from its
// items, finding a passage in a text layer) is src/pdf.

import * as pdfjs from 'pdfjs-dist';
import workerUrl from 'pdfjs-dist/build/pdf.worker.min.mjs?url';
import { chapterRanges, documentText, outlineEntries, pageText, type OutlinePdf, type TextBit } from '../pdf/index.js';

pdfjs.GlobalWorkerOptions.workerSrc = workerUrl;

// WebKit has no async iterator on ReadableStream, and pdf.js's getTextContent
// walks its stream with `for await`; the iterator is the reader, spelled out.
const streamProto = ReadableStream.prototype as unknown as Record<symbol, unknown>;
if (typeof ReadableStream !== 'undefined' && !(Symbol.asyncIterator in streamProto)) {
  streamProto[Symbol.asyncIterator] = async function* (this: ReadableStream) {
    const reader = this.getReader();
    try {
      for (;;) {
        const { done, value } = await reader.read();
        if (done) return;
        yield value;
      }
    } finally {
      reader.releaseLock();
    }
  };
}

export type { PDFDocumentProxy, PDFPageProxy } from 'pdfjs-dist';
export const { TextLayer } = pdfjs;

/** Open a PDF from its bytes. The bytes are copied first: pdf.js hands them to its worker and they are gone. */
export function loadPdf(bytes: Uint8Array): pdfjs.PDFDocumentLoadingTask {
  return pdfjs.getDocument({ data: bytes.slice(), verbosity: 0 });
}

/** A page's text items as the pure side reads them. */
export async function pageBits(page: pdfjs.PDFPageProxy): Promise<TextBit[]> {
  const content = await page.getTextContent();
  const out: TextBit[] = [];
  for (const it of content.items) {
    if (!('str' in it)) continue;
    out.push({ str: it.str, eol: it.hasEOL, y: it.transform[5] ?? 0, height: it.height });
  }
  return out;
}

/**
 * Open a PDF that is read a piece at a time (milestone 63): pdf.js asks
 * for the ranges it needs (the cross-reference table, then the pages
 * shown) and `read` answers each, so a book of hundreds of megabytes is
 * never held whole in the web view.
 */
export function loadPdfPieces(size: number, read: (begin: number, end: number) => Promise<Uint8Array>): pdfjs.PDFDocumentLoadingTask {
  const transport = new pdfjs.PDFDataRangeTransport(size, null);
  transport.requestDataRange = (begin: number, end: number) => {
    void read(begin, end).then((chunk) => transport.onDataRange(begin, chunk), (e: unknown) => { console.error('pdf range', e); transport.abort(); });
  };
  return pdfjs.getDocument({ range: transport, rangeChunkSize: PIECE, disableAutoFetch: true, disableStream: true, verbosity: 0 });
}
/** How much of a PDF is asked for at a time. */
const PIECE = 1 << 19;

export interface PdfText {
  pages: number;
  /** Every page's paragraphs, in order; empty for a scan. */
  text: string;
  /** The document's own title, when its metadata has one. */
  title: string;
  /** A book's chapters, from its outline: each one's pages and their text; empty when the outline gives fewer than two. */
  chapters: { title: string; first: number; last: number; text: string }[];
}

/** What the intake shows for a PDF, and the fallback body it lands with. */
export async function pdfText(bytes: Uint8Array): Promise<PdfText> {
  const task = loadPdf(bytes);
  try {
    const pdf = await task.promise;
    const pages: string[] = [];
    for (let n = 1; n <= pdf.numPages; n++) pages.push(pageText(await pageBits(await pdf.getPage(n))));
    let title = '';
    try {
      const info = (await pdf.getMetadata()).info as { Title?: unknown };
      if (typeof info.Title === 'string') title = info.Title.trim();
    } catch { /* no metadata: the file name serves */ }
    const chapters = chapterRanges(await outlineEntries(pdf as unknown as OutlinePdf), pdf.numPages)
      .map((c) => ({ ...c, text: documentText(pages.slice(c.first - 1, c.last)) }));
    return { pages: pdf.numPages, text: documentText(pages), title, chapters };
  } finally {
    await task.destroy();
  }
}
