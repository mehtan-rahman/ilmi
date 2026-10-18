// A document with pages keeps what came out of them under one heading per
// page, `## p. <n>` (FORMAT.md §3, "Pages"). Pure over a Doc: where a page's
// section is, which page a block sits under, and how a block lands on a page.

import type { Block, Doc, Heading } from '../format/index.js';

const PAGE = /^p\.\s*(\d+)$/;

export const pageHeading = (n: number): Heading => ({ kind: 'heading', level: 2, text: `p. ${n}` });

/** The page a heading names, or null for any other heading. */
export function pageOf(b: Block | undefined): number | null {
  if (b?.kind !== 'heading' || b.level !== 2) return null;
  const m = PAGE.exec(b.text.trim());
  const n = m ? Number(m[1]) : 0;
  return n >= 1 ? n : null;
}

/** The page the block at `index` sits under: the nearest `## p. <n>` above it, else null. */
export function pageOfBlock(doc: Doc, index: number): number | null {
  for (let i = Math.min(index, doc.blocks.length - 1); i >= 0; i--) {
    const b = doc.blocks[i];
    if (b?.kind !== 'heading') continue;
    const n = pageOf(b);
    if (n !== null) return n;
    // any other heading above the block ends the page's section
    if (b.level <= 2) return null;
  }
  return null;
}

/** `[start, end)` of page `n`'s section, the heading included; null when the page has no heading yet. */
export function pageSection(doc: Doc, n: number): [number, number] | null {
  const start = doc.blocks.findIndex((b) => pageOf(b) === n);
  if (start < 0) return null;
  let end = start + 1;
  while (end < doc.blocks.length && !(doc.blocks[end]!.kind === 'heading' && (doc.blocks[end] as Heading).level <= 2)) end++;
  return [start, end];
}

/**
 * Put `block` at the end of page `n`'s section, adding the heading when the
 * page has none yet: before the first page heading with a higher number, else
 * at the end of the document. Resolves to the index the block landed at.
 */
export function addToPage(doc: Doc, n: number, block: Block): number {
  const section = pageSection(doc, n);
  if (section) {
    doc.blocks.splice(section[1], 0, block);
    return section[1];
  }
  let at = doc.blocks.length;
  for (let i = 0; i < doc.blocks.length; i++) {
    const p = pageOf(doc.blocks[i]);
    if (p !== null && p > n) { at = i; break; }
  }
  doc.blocks.splice(at, 0, pageHeading(n), block);
  return at + 1;
}
