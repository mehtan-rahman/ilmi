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
  /** What the blank hides, as plain text: a blank inside it reads as its own answer. */
  answer: string;
  /** The whole `{{…}}` as written. */
  raw: string;
  /** Set when the blank sits inside a math span: the answer is TeX. */
  math?: true;
  /** Where the blank opens in the card's text, and how long its opening is (`{{`, or `{{c3::`). */
  at: number;
  open: number;
  /** A blank that holds blanks: what is inside it, text and blanks in order. Absent when it holds none. */
  parts?: CardSeg[];
}

export type ClozePart = string | Blank;

/** A math span holding at least one blank: the span as written, and its inner TeX runs and blanks. */
export interface MathSeg {
  span: string;
  display: boolean;
  parts: ClozePart[];
}

/** A card's text as renderers want it: text, blanks in text, and formulas that hold blanks. */
export type CardSeg = string | Blank | MathSeg;

const GROUP = /^c?(\d+)::/;
/** Inside math only the numbered form opens a blank; `{{` alone is TeX (`\binom{n}{{k}}`). */
const MATH_OPEN = /\{\{c?(\d+)::/y;

/** A math span opened at `i` that ends by `hi`: the index just past it; else -1. */
function mathEndIn(text: string, i: number, hi: number): number {
  const e = mathSpanEnd(text, i);
  return e > 0 && e <= hi ? e : -1;
}

/**
 * Find the `}}` that closes a blank opened at `open`, before `hi`, skipping
 * math and the blanks inside it: a `{{` in the answer that itself closes
 * (with something in it) is a blank within the blank, and its `}}` is its
 * own. One that never closes is text, as it always was.
 */
function blankEnd(text: string, open: number, hi: number): number {
  let j = open + 2;
  while (j < hi) {
    if (text[j] === '$') {
      const e = mathEndIn(text, j, hi);
      if (e > 0) { j = e; continue; }
    }
    if (text[j] === '}' && text[j + 1] === '}' && j + 1 < hi) return j;
    if (text[j] === '{' && text[j + 1] === '{') {
      const inner = blankEnd(text, j, hi);
      if (inner > 0 && text.slice(j + 2, inner).trim()) { j = inner + 2; continue; }
    }
    j++;
  }
  return -1;
}

/**
 * A numbered blank opened at `open` inside math, closed by the `}}` that
 * balances the braces opened since `::` (so `{{c1::x^{2}}}` ends at the
 * last two). Null when the form is not numbered or nothing balances before
 * `limit`, the end of the formula.
 */
function mathBlank(text: string, open: number, limit: number): { n: number; start: number; close: number } | null {
  MATH_OPEN.lastIndex = open;
  const m = MATH_OPEN.exec(text);
  if (!m || m.index !== open) return null;
  const start = open + m[0].length;
  let depth = 0;
  for (let j = start; j < limit; j++) {
    const c = text[j];
    if (c === '\\') { j++; continue; }
    if (c === '{') depth++;
    else if (c === '}') {
      if (depth > 0) depth--;
      else return text[j + 1] === '}' && j + 1 < limit ? { n: Number(m[1]), start, close: j } : null;
    }
  }
  return null;
}

/** What segments read as with every blank's braces gone. */
const plainOf = (segs: readonly CardSeg[]): string => segs.map((s) => (typeof s === 'string' ? s : 'span' in s ? s.span.replace(/\{\{c?\d+::/g, '').replace(/\}\}/g, '') : s.answer)).join('');

/** The text from `lo` to `hi` as literal runs, blanks (a blank's own blanks inside it), and formulas holding blanks. */
function segments(text: string, lo: number, hi: number): CardSeg[] {
  const segs: CardSeg[] = [];
  let lit = '';
  const flush = () => { if (lit) { segs.push(lit); lit = ''; } };
  let i = lo;
  while (i < hi) {
    const c = text[i];
    if (c === '$') {
      const e = mathEndIn(text, i, hi);
      if (e > 0) {
        const display = text[i + 1] === '$';
        const d = display ? 2 : 1;
        const limit = e - d;
        const inner: ClozePart[] = [];
        let tex = '';
        let j = i + d;
        while (j < limit) {
          if (text[j] === '{' && text[j + 1] === '{') {
            const b = mathBlank(text, j, limit);
            if (b) {
              const answer = text.slice(b.start, b.close);
              if (answer.trim()) {
                if (tex) { inner.push(tex); tex = ''; }
                inner.push({ n: b.n, answer, raw: text.slice(j, b.close + 2), math: true, at: j, open: b.start - j });
                j = b.close + 2;
                continue;
              }
            }
          }
          tex += text[j];
          j++;
        }
        if (tex) inner.push(tex);
        if (inner.some((p) => typeof p !== 'string')) {
          flush();
          segs.push({ span: text.slice(i, e), display, parts: inner });
        } else lit += text.slice(i, e);
        i = e;
        continue;
      }
    }
    if (c === '{' && text[i + 1] === '{') {
      const close = blankEnd(text, i, hi);
      if (close > 0) {
        const inner = text.slice(i + 2, close);
        if (inner.trim()) {
          flush();
          const m = GROUP.exec(inner);
          const start = i + 2 + (m ? m[0].length : 0);
          const parts = segments(text, start, close);
          const nested = parts.some((p) => typeof p !== 'string');
          segs.push({ n: m ? Number(m[1]) : null, answer: nested ? plainOf(parts) : text.slice(start, close), raw: text.slice(i, close + 2), at: i, open: start - i, ...(nested ? { parts } : {}) });
          i = close + 2;
          continue;
        }
      }
    }
    lit += c;
    i++;
  }
  flush();
  return segs;
}

/** Split text into literal runs, blanks, and formulas holding blanks. A blank that holds blanks carries them in its `parts`. */
export function clozeSegments(text: string): CardSeg[] {
  return segments(text, 0, text.length);
}

/** Split text into literal runs and blanks; a formula's delimiters and TeX are literal runs around its blanks. The outermost blanks: one inside another is in that one's `parts`. */
export function clozeParts(text: string): ClozePart[] {
  const parts: ClozePart[] = [];
  let lit = '';
  const add = (p: ClozePart) => {
    if (typeof p === 'string') { lit += p; return; }
    if (lit) { parts.push(lit); lit = ''; }
    parts.push(p);
  };
  for (const seg of clozeSegments(text)) {
    if (typeof seg === 'string' || !('span' in seg)) { add(seg); continue; }
    const d = seg.display ? 2 : 1;
    add(seg.span.slice(0, d));
    for (const p of seg.parts) add(p);
    add(seg.span.slice(-d));
  }
  if (lit) parts.push(lit);
  return parts;
}

/** Every blank of segments, a blank before the blanks inside it: the order a blank's index counts in. */
export function blanksIn(segs: readonly CardSeg[]): Blank[] {
  const out: Blank[] = [];
  for (const s of segs) {
    if (typeof s === 'string') continue;
    if ('span' in s) { for (const p of s.parts) if (typeof p !== 'string') out.push(p); continue; }
    out.push(s);
    if (s.parts) out.push(...blanksIn(s.parts));
  }
  return out;
}

/** Every blank of the text, in order, one that holds others before them. */
export function blanks(text: string): Blank[] {
  return blanksIn(clozeSegments(text));
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
