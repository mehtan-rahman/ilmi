// Milestone 48: a passage boxed on the page is named from the page — the
// nearest numbered heading at or above its first box, and the equation
// numbers inside its boxes — read off design/books/ch3-book.pdf, the
// sample's Lindqvist ch. 3 set at pp. 41–44 of its book.

import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { getDocument } from 'pdfjs-dist/legacy/build/pdf.mjs';
import { boxAround, pageItems, sectionName, type PageItem } from '../index.js';

const BOOKS = join(__dirname, '../../../design/books');

async function itemsOf(file: string): Promise<Map<number, PageItem[]>> {
  const doc = await getDocument({ data: new Uint8Array(readFileSync(join(BOOKS, file))), verbosity: 0 }).promise;
  const out = new Map<number, PageItem[]>();
  for (let n = 1; n <= doc.numPages; n++) {
    const page = await doc.getPage(n);
    const v = page.getViewport({ scale: 1 });
    out.set(n, pageItems((await page.getTextContent()).items, v.width, v.height));
  }
  return out;
}

describe('a passage named from its page', async () => {
  const ch3 = await itemsOf('ch3-book.pdf');
  const at = (n: number) => ch3.get(n);

  it('a two-box passage across pp. 41–42: the heading above it, the equation inside', () => {
    const boxes = [{ page: 41, x: 0.12, y: 0.86, w: 0.77, h: 0.075 }, { page: 42, x: 0.1, y: 0.097, w: 0.77, h: 0.04 }];
    expect(sectionName(at, 41, boxes)).toEqual({ name: '3.3 · average values (3.12)', named: true });
  });

  it('a run of equation numbers reads first to last; a heading on an earlier page still names it', () => {
    expect(sectionName(at, 41, [{ page: 42, x: 0.1, y: 0.135, w: 0.77, h: 0.375 }]).name).toBe('3.3 · average values (3.13–3.15)');
  });

  it('a heading just inside the box\'s top is the passage\'s own', () => {
    expect(sectionName(at, 41, [{ page: 42, x: 0.1, y: 0.6, w: 0.77, h: 0.14 }]).name).toBe('3.4 · the Helmholtz free energy (3.16)');
  });

  it('nothing above it in the chapter: the page names it', () => {
    expect(sectionName(at, 41, [{ page: 41, x: 0.1, y: 0.02, w: 0.8, h: 0.05 }])).toEqual({ name: 'p. 41', named: false });
  });

  it('the Arabic page has no numbered heading: it is not named from its text', async () => {
    const reader = await itemsOf('reader.pdf');
    expect(sectionName((n) => reader.get(n), 1, [{ page: 1, x: 0.12, y: 0.368, w: 0.77, h: 0.088 }])).toEqual({ name: 'p. 1', named: false });
  });

  it('a selection\'s lines become the one box around them', () => {
    expect(boxAround(41, [{ x: 0.2, y: 0.3, w: 0.5, h: 0.02 }, { x: 0.13, y: 0.32, w: 0.7, h: 0.02 }], 0)).toEqual({ page: 41, x: 0.13, y: 0.3, w: expect.closeTo(0.7, 6), h: expect.closeTo(0.04, 6) });
    expect(boxAround(41, [])).toBeNull();
  });
});
