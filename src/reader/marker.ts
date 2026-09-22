// The reading marker. `read.pos` counts prose blocks read from the top of
// the body, cards skipped (FORMAT.md §3). The rule in the margin runs from
// the first block to the bottom of the pos-th prose block; the blocks above
// that one are settled.

import { meta, setField, type Block, type Doc } from '../format/index.js';
import type { Node as PMNode } from 'prosemirror-model';

export const isProse = (b: Block): boolean => b.kind !== 'card';

/** Indices into `blocks` (or a document's children) of the prose blocks, in order. */
export function proseIndices(blocks: Block[]): number[];
export function proseIndices(doc: PMNode): number[];
export function proseIndices(src: Block[] | PMNode): number[] {
  const out: number[] = [];
  if (Array.isArray(src)) src.forEach((b, i) => { if (isProse(b)) out.push(i); });
  else src.forEach((n, _off, i) => { if (n.type.name !== 'card') out.push(i); });
  return out;
}

/** The child index of the block the marker sits under, or -1 when nothing is read. */
export function cursorIndex(prose: number[], pos: number): number {
  if (pos <= 0 || !prose.length) return -1;
  return prose[Math.min(pos, prose.length) - 1]!;
}

export interface Band {
  top: number;
  height: number;
}

/**
 * Which position a click in the gutter means, from the prose blocks' bands
 * in order: the last block the pointer has passed into by a little (22px or
 * half its height, whichever is less), else the first. Never 0: the marker
 * is set by pointing at something read.
 */
export function pickPos(bands: Band[], y: number): number {
  let pos = bands.length ? 1 : 0;
  bands.forEach((b, i) => {
    if (y >= b.top + Math.min(22, b.height / 2)) pos = i + 1;
  });
  return pos;
}

/** Set `read.pos` on a document enrolled in reading; a no-op otherwise. */
export function setReadPos(doc: Doc, pos: number): void {
  const m = meta(doc);
  if (!m.read) return;
  const total = doc.blocks.filter(isProse).length;
  setField(doc, 'read', { ...m.read, pos: Math.max(0, Math.min(total, Math.round(pos))) });
}
