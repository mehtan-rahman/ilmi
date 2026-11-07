// What the search index holds of a document (milestone 68): a row a block,
// what is shown and that text folded. Made from the document alone, in
// `decompose`, so every way a document's text changes (a write, an upgrade,
// a merge through the door) brings its rows with it in its transaction; the
// walk of a collection from before the index makes the same rows from what
// is stored. `src-tauri/src/store.rs` keeps them, cut in three-letter pieces.

import { faceText, fold, type Doc } from '../format/index.js';
import { flatRanges, inlineRanges, markerRanges } from '../reader/inline.js';

/** One block as the index holds it. */
export interface SearchRow {
  /** The block's index in the document. */
  block: number;
  kind: 'heading' | 'card' | 'text';
  /** A card's `^id`, which finds it if it has moved. */
  card: string | null;
  /** `text` folded, every run of white space one space: all that is looked through. */
  hay: string;
  /** What a result shows: prose without its inline marks; a card as written. */
  text: string;
}

/** A query as the store looks for it: folded, as words, and the same words as one phrase. */
export function searchQuery(q: string): { phrase: string; words: string[] } {
  const words = fold(q).split(/\s+/).filter(Boolean);
  return { phrase: words.join(' '), words };
}

export const hayOf = (text: string): string => fold(text).replace(/\s+/g, ' ').trim();

/** `**strong**` as `strong`, a link as its text: what the page shows, so a phrase is found across a mark. */
export function plainText(text: string): string {
  if (!/[*_~`[]/.test(text)) return text;
  const cuts = flatRanges(inlineRanges(text)).flatMap(markerRanges).sort((a, b) => a.from - b.from);
  let out = '';
  let at = 0;
  for (const c of cuts) {
    if (c.from > at) out += text.slice(at, c.from);
    at = Math.max(at, c.to);
  }
  return out + text.slice(at);
}

/** A list, a quote or a table as read: line by line, its markers gone, a table's cells apart and its rule gone. */
export function plainLines(text: string): string {
  return text.split('\n')
    .map((l) => l.replace(/^\s*(?:[-*+]|\d+[.)]|>+)\s+/, '').replace(/^\s*\|\s*|\s*\|\s*$/g, '').replace(/\s*\|\s*/g, ' · '))
    .filter((l) => !/^[\s\-:·]*$/.test(l))
    .join('\n');
}

/** A document's rows. Comments (a box's line, a marker) are not text. */
export function searchRows(doc: Doc): SearchRow[] {
  const out: SearchRow[] = [];
  doc.blocks.forEach((b, block) => {
    if (b.kind === 'card') {
      const hay = hayOf(faceText(b.text));
      if (hay) out.push({ block, kind: 'card', card: b.id ?? null, hay, text: b.text });
      return;
    }
    if (b.kind === 'raw' && b.text.trimStart().startsWith('<!--')) return;
    const text = plainText(b.kind === 'raw' ? plainLines(b.text) : b.text);
    const hay = hayOf(text);
    if (hay) out.push({ block, kind: b.kind === 'heading' ? 'heading' : 'text', card: null, hay, text });
  });
  return out;
}
