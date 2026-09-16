// Card syntax: cloze blanks, q&a and bidirectional forms. FORMAT.md §5.
// Pure functions over a card's verbatim text; nothing here is stored.

import type { CardForm } from './model.js';

// ── math spans (opaque to blank scanning) ────────────────────────

const isSpace = (c: string | undefined) => c === undefined || c === ' ' || c === '\t' || c === '\n';
const isDigit = (c: string | undefined) => c !== undefined && c >= '0' && c <= '9';

/** If a math span opens at `i`, return the index just past it; else -1. */
export function mathSpanEnd(text: string, i: number): number {
  if (text[i] !== '$') return -1;
  if (text[i + 1] === '$') {
    // display math: $$ … $$, may span lines, inner non-empty
    const close = text.indexOf('$$', i + 2);
    if (close < 0 || close === i + 2) return -1;
    return close + 2;
  }
  // inline math, Pandoc rules: opener followed by non-space, closer preceded
  // by non-space and not followed by a digit, no line break inside.
  if (isSpace(text[i + 1])) return -1;
  for (let j = i + 1; j < text.length; j++) {
    const c = text[j];
    if (c === '\n') return -1;
    if (c === '$' && !isSpace(text[j - 1]) && !isDigit(text[j + 1])) return j + 1;
  }
  return -1;
}

// ── cloze blanks ─────────────────────────────────────────────────

export interface Blank {
  /** Group number, or null for an unnumbered blank. */
  n: number | null;
  answer: string;
  /** The whole `{{…}}` as written. */
  raw: string;
}

export type ClozePart = string | Blank;

const GROUP = /^c?(\d+)::([\s\S]*)$/;

/** Find the `}}` that closes a blank opened at `open`, skipping math. */
function blankEnd(text: string, open: number): number {
  let j = open + 2;
  while (j < text.length) {
    if (text[j] === '$') {
      const e = mathSpanEnd(text, j);
      if (e > 0) { j = e; continue; }
    }
    if (text[j] === '}' && text[j + 1] === '}') return j;
    j++;
  }
  return -1;
}

/** Split text into literal runs and blanks. */
export function clozeParts(text: string): ClozePart[] {
  const parts: ClozePart[] = [];
  let lit = '';
  let i = 0;
  while (i < text.length) {
    const c = text[i];
    if (c === '$') {
      const e = mathSpanEnd(text, i);
      if (e > 0) { lit += text.slice(i, e); i = e; continue; }
    }
    if (c === '{' && text[i + 1] === '{') {
      const close = blankEnd(text, i);
      if (close > 0) {
        const inner = text.slice(i + 2, close);
        if (inner.trim()) {
          if (lit) { parts.push(lit); lit = ''; }
          const m = GROUP.exec(inner);
          parts.push(m ? { n: Number(m[1]), answer: m[2]!, raw: text.slice(i, close + 2) }
                       : { n: null, answer: inner, raw: text.slice(i, close + 2) });
          i = close + 2;
          continue;
        }
      }
    }
    lit += c;
    i++;
  }
  if (lit) parts.push(lit);
  return parts;
}

export function blanks(text: string): Blank[] {
  return clozeParts(text).filter((p): p is Blank => typeof p !== 'string');
}

/** Numbered groups in order of first appearance. */
export function clozeGroups(text: string): number[] {
  const seen: number[] = [];
  for (const b of blanks(text)) if (b.n !== null && !seen.includes(b.n)) seen.push(b.n);
  return seen;
}

/** Lowest positive group number not used in the text. */
export function nextGroup(text: string): number {
  const used = clozeGroups(text);
  let n = 1;
  while (used.includes(n)) n++;
  return n;
}

// ── forms ────────────────────────────────────────────────────────

const BIDIR_INLINE = /(^|\s):::(\s|$)/;
const QA_INLINE = /(^|\s)::(\s|$)/;

/** Index of a line that is exactly `sep`, with lines on both sides, or -1. */
function sepLine(lines: string[], sep: string): number {
  for (let i = 1; i < lines.length - 1; i++) if (lines[i]!.trim() === sep) return i;
  return -1;
}

function inlineSplit(text: string, re: RegExp): [string, string] | null {
  const m = re.exec(text);
  if (!m) return null;
  const front = text.slice(0, m.index).trim();
  const back = text.slice(m.index + m[0].length).trim();
  return front && back ? [front, back] : null;
}

/** Which card form the text has, or null if it is prose. */
export function cardForm(text: string): CardForm | null {
  if (blanks(text).length) return 'cloze';
  const lines = text.split('\n');
  if (sepLine(lines, '?') >= 0) return 'qa';
  if (sepLine(lines, '??') >= 0) return 'bidir';
  if (inlineSplit(text, BIDIR_INLINE)) return 'bidir';
  if (inlineSplit(text, QA_INLINE)) return 'qa';
  return null;
}

export type CardFields =
  | { form: 'cloze'; parts: ClozePart[] }
  | { form: 'qa'; front: string; back: string }
  | { form: 'bidir'; left: string; right: string };

/** The card's content, split by its form. Null for prose. */
export function cardFields(text: string): CardFields | null {
  const form = cardForm(text);
  if (!form) return null;
  if (form === 'cloze') return { form, parts: clozeParts(text) };
  const lines = text.split('\n');
  const sep = form === 'qa' ? '?' : '??';
  const at = sepLine(lines, sep);
  let pair: [string, string] | null;
  if (at >= 0) pair = [lines.slice(0, at).join('\n').trim(), lines.slice(at + 1).join('\n').trim()];
  else pair = inlineSplit(text, form === 'qa' ? QA_INLINE : BIDIR_INLINE);
  const [a, b] = pair!;
  return form === 'qa' ? { form, front: a, back: b } : { form, left: a, right: b };
}
