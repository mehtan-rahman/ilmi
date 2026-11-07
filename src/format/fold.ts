// The one fold (milestone 68): what the deck search, find in the page, the
// tree's type-ahead's neighbours and the search index all compare by.
// Compatibility decomposition, then every combining mark and the tatweel
// dropped, then lower case with the final sigma as a sigma: `Lucke` finds
// `Lücke`, an unvoweled Arabic word the voweled one, أ and إ and آ are ا.
//
// The index is folded here too, and only here: the Rust side stores what it
// is given and never folds, so there is no second rule to keep in step.
// `fold` takes a text whole, for speed; `foldMap` a character at a time, so a
// match maps back to what it stands for. They give the same string: the
// final sigma was the one rule of lower case that looks at a neighbour,
// and marks, the only characters decomposition reorders, are dropped.

import { cardFields } from './cloze.js';

const MARKS = /[\p{M}ـ]/gu;
const SIGMA = /ς/g;

/** Case, combining marks and the tatweel folded away. */
export function fold(s: string): string {
  return s.normalize('NFKD').replace(MARKS, '').toLowerCase().replace(SIGMA, 'σ');
}

/** `text` folded, with the offset in `text` of each folded character. */
export function foldMap(text: string): { folded: string; at: number[] } {
  let folded = '';
  const at: number[] = [];
  let off = 0;
  for (const c of text) {
    const f = fold(c);
    for (let k = 0; k < f.length; k++) at.push(off);
    folded += f;
    off += c.length;
  }
  return { folded, at };
}

const isMark = (c: string): boolean => /^[\p{M}ـ]$/u.test(c);

/** Every match of `query` in `text`, folded, as offsets into `text`; a match takes the marks right after it. */
export function findIn(text: string, query: string): { from: number; to: number }[] {
  const q = fold(query);
  if (!q.trim()) return [];
  const { folded, at } = foldMap(text);
  const out: { from: number; to: number }[] = [];
  for (let i = folded.indexOf(q); i >= 0; i = folded.indexOf(q, i + q.length)) {
    const from = at[i]!;
    const last = at[i + q.length - 1]!;
    let to = last + (text.codePointAt(last)! > 0xffff ? 2 : 1);
    while (to < text.length && isMark(text[to]!)) to++;
    // a fold that spread one character over several (a ligature) can end a match inside it
    if (out.length && from < out[out.length - 1]!.to) continue;
    out.push({ from, to });
  }
  return out;
}

/** The text a card's search looks through: both faces, a cloze's answers in place. */
export function faceText(text: string): string {
  const f = cardFields(text);
  if (!f) return text;
  if (f.form === 'cloze') return f.parts.map((p) => (typeof p === 'string' ? p : p.answer)).join('');
  return f.form === 'qa' ? `${f.front}\n${f.back}` : `${f.left}\n${f.right}`;
}
