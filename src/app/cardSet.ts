// The card view's set (`CardPane.tsx`) and the tree's card rows (`Tree.tsx`),
// pure: a document's cards in document order, where a card stands among them
// (by its id first, then its block), a step through them, and the one line a
// card shows in the tree (its front).

import { cardFields, clozeParts, type Card, type Doc } from '../format/index.js';

/** One card of a document: its block, its id when it has one, its text. */
export interface CardLine {
  block: number;
  id?: string;
  text: string;
}

/** A document's cards in document order. */
export function cardSet(doc: Doc | null | undefined): CardLine[] {
  if (!doc) return [];
  const out: CardLine[] = [];
  doc.blocks.forEach((b, block) => {
    if (b.kind !== 'card') return;
    out.push(b.id === undefined ? { block, text: b.text } : { block, id: b.id, text: b.text });
  });
  return out;
}

/**
 * Where `at` stands in `set`: the card with its id, else the card at its
 * block, else the nearest card after that block (the one before when none
 * is after), 0 with nothing to go by; -1 when the set is empty.
 */
export function cardIndex(set: readonly CardLine[], at: { block: number; id?: string } | undefined): number {
  if (!set.length) return -1;
  if (!at) return 0;
  if (at.id !== undefined) {
    const i = set.findIndex((c) => c.id === at.id);
    if (i >= 0) return i;
  }
  const i = set.findIndex((c) => c.block >= at.block);
  return i >= 0 ? i : set.length - 1;
}

/** `i` moved by `d` within a set of `n`, held at its ends. */
export const stepIn = (i: number, d: number, n: number): number => (n <= 0 ? -1 : Math.max(0, Math.min(n - 1, i + d)));

/** `3 / 12`. */
export const countOf = (i: number, n: number): string => (n <= 0 ? '0 / 0' : `${i + 1} / ${n}`);

/**
 * The one line a card shows in the tree: its front (a cloze's text, its
 * blanks filled in), whitespace run together, cut to `max` characters with
 * an ellipsis. Math stays as its TeX.
 */
export function frontLine(text: string, max = 80): string {
  const f = cardFields(text);
  let front: string;
  if (!f) front = text;
  else if (f.form === 'qa') front = f.front;
  else if (f.form === 'bidir') front = f.left;
  else front = clozeParts(text).map((p) => (typeof p === 'string' ? p : p.answer)).join('');
  const one = front.replace(/\s+/g, ' ').trim();
  return one.length > max ? `${one.slice(0, max - 1).trimEnd()}…` : one;
}

/** The card a line names, as the document now holds it. */
export function cardOf(doc: Doc | null | undefined, line: CardLine | undefined): Card | null {
  if (!doc || !line) return null;
  const at = doc.blocks[line.block];
  return at?.kind === 'card' ? at : null;
}
