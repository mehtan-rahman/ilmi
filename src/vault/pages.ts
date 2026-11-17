// Which page of a document's PDF a block of its notes belongs to (FORMAT.md
// §6.6). A clip carries its page in its box, and what is written under one
// is about it. Notes written before milestone 81 kept what came out of a
// page under a heading `## p. <n>`, and a boxed passage as a section under
// its own heading (§6.5): both still say the page of what is under them.
// Pure over a Doc.

import { parseBoxes, parseClip, type Block, type Doc } from '../format/index.js';

const PAGE = /^p\.\s*(\d+)$/;

/** The page a heading names (`## p. <n>`), or null for any other heading. */
export function pageOf(b: Block | undefined): number | null {
  if (b?.kind !== 'heading' || b.level !== 2) return null;
  const m = PAGE.exec(b.text.trim());
  const n = m ? Number(m[1]) : 0;
  return n >= 1 ? n : null;
}

/** The page a block is itself from: a clip's box, a boxed section's first box, a `## p. <n>` heading's number. Null for anything else. */
export function ownPage(b: Block | undefined): number | null {
  if (!b) return null;
  if (b.kind === 'raw') return parseClip(b.text)?.page ?? null;
  if (b.kind !== 'heading') return null;
  return pageOf(b) ?? (b.read?.boxes !== undefined ? parseBoxes(b.read.boxes)?.[0]?.page ?? null : null);
}

/**
 * The page the block at `index` belongs to: its own, else that of the
 * nearest clip, boxed section or `## p. <n>` heading above it.
 * Any other heading of the first two levels above the block ends the
 * search: what is under it is the person's own section, of no page.
 */
export function pageOfBlock(doc: Doc, index: number): number | null {
  for (let i = Math.min(index, doc.blocks.length - 1); i >= 0; i--) {
    const b = doc.blocks[i];
    const n = ownPage(b);
    if (n !== null) return n;
    if (b?.kind === 'heading' && b.level <= 2) return null;
  }
  return null;
}
