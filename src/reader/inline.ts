// Inline Markdown in prose: `*emphasis*`, `**strong**`, `~~struck~~`, `` `code` ``,
// `[text](href)`, and `![alt](src)`, found as ranges over the raw text so
// the reader can draw them as themselves without changing a character. The
// format leaves them literal (FORMAT.md §4); this only says where they are.
// CommonMark's flanking rules, reduced: an opener is followed by something
// that is not whitespace, a closer is preceded by one, and `_` does not
// open or close inside a word.

export type InlineKind = 'em' | 'strong' | 'strike' | 'code' | 'link' | 'image';

export interface InlineRange {
  /** The whole construct, markers included. */
  from: number;
  to: number;
  kind: InlineKind;
  /** What shows: the text between the markers (the alt of an image). */
  inner: { from: number; to: number };
  /** A link's address, an image's source. */
  href?: string;
  /** Emphasis, strong, code, and images inside a link's text or an emphasis. */
  children: InlineRange[];
}

const isSpace = (c: string | undefined) => c === undefined || /\s/.test(c);
const isWord = (c: string | undefined) => c !== undefined && /[\p{L}\p{N}_]/u.test(c);

interface Closer {
  ch: string;
  n: number;
}

interface Seq {
  ranges: InlineRange[];
  /** Where the closer begins, or `end` when it was not found. */
  at: number;
}

/** The length of the run of `ch` starting at `i`. */
function runLength(text: string, i: number, ch: string): number {
  let j = i;
  while (text[j] === ch) j++;
  return j - i;
}

/** The index just past the matching `]` for a `[` at `open`, or -1; one level of nested brackets allowed, escapes skipped. */
function bracketEnd(text: string, open: number, end: number): number {
  let depth = 0;
  for (let i = open; i < end; i++) {
    const c = text[i];
    if (c === '\\') { i++; continue; }
    if (c === '[') depth++;
    else if (c === ']') { depth--; if (depth === 0) return i + 1; }
  }
  return -1;
}

/** `(href)` starting at `i`: the index past the `)` and the address, or null. No whitespace or newline inside, parentheses balanced. */
function destination(text: string, i: number, end: number): { end: number; href: string } | null {
  if (text[i] !== '(') return null;
  let depth = 0;
  for (let j = i; j < end; j++) {
    const c = text[j]!;
    if (c === '\\') { j++; continue; }
    if (/\s/.test(c)) return null;
    if (c === '(') depth++;
    else if (c === ')') {
      depth--;
      if (depth === 0) {
        const href = text.slice(i + 1, j);
        return href ? { end: j + 1, href } : null;
      }
    }
  }
  return null;
}

/** A link or an image starting at `i` (`[` or `![`), or null. */
function bracketed(text: string, i: number, end: number): InlineRange | null {
  const image = text[i] === '!';
  const open = image ? i + 1 : i;
  if (text[open] !== '[') return null;
  const close = bracketEnd(text, open, end);
  if (close < 0) return null;
  const dest = destination(text, close, end);
  if (!dest) return null;
  const inner = { from: open + 1, to: close - 1 };
  const children = image ? [] : parseSeq(text, inner.from, inner.to).ranges;
  return { from: i, to: dest.end, kind: image ? 'image' : 'link', inner, href: dest.href, children };
}

/** A code span starting at the backtick run at `i`, or null when its run has no twin. */
function codeSpan(text: string, i: number, end: number): InlineRange | null {
  const n = runLength(text, i, '`');
  let j = i + n;
  while (j < end) {
    if (text[j] === '`') {
      const m = runLength(text, j, '`');
      if (m === n) return { from: i, to: j + n, kind: 'code', inner: { from: i + n, to: j }, children: [] };
      j += m;
    } else j++;
  }
  return null;
}

/** Can a run of `ch` at `i` open emphasis? */
function opens(text: string, i: number, n: number, ch: string): boolean {
  if (isSpace(text[i + n])) return false;
  if (ch === '_' && isWord(text[i - 1])) return false;
  return true;
}

/** Can a run of `ch` at `i` close emphasis of `n` marks? */
function closes(text: string, i: number, n: number, ch: string): boolean {
  if (isSpace(text[i - 1])) return false;
  if (ch === '_' && isWord(text[i + n])) return false;
  return true;
}

/**
 * Inline ranges from `start` to `end`, stopping at a `closer` when one is
 * sought and found; nested constructs are parsed by recursion, so a closer
 * inside a nested one belongs to it.
 */
function parseSeq(text: string, start: number, end: number, closer?: Closer): Seq {
  const ranges: InlineRange[] = [];
  let i = start;
  while (i < end) {
    const c = text[i]!;
    if (c === '\\') { i += 2; continue; }
    if (closer && c === closer.ch) {
      const n = runLength(text, i, c);
      if (n >= closer.n && closes(text, i, closer.n, c)) return { ranges, at: i };
    }
    if (c === '`') {
      const r = codeSpan(text, i, end);
      if (r) { ranges.push(r); i = r.to; continue; }
      i += runLength(text, i, '`');
      continue;
    }
    if (c === '[' || (c === '!' && text[i + 1] === '[')) {
      const r = bracketed(text, i, end);
      if (r) { ranges.push(r); i = r.to; continue; }
      i++;
      continue;
    }
    if (c === '~' && text[i + 1] === '~') {
      // GFM's strikethrough: two tildes each side, flanking as emphasis
      const n = runLength(text, i, c);
      if (n === 2 && opens(text, i, n, c)) {
        const inner = parseSeq(text, i + 2, end, { ch: c, n: 2 });
        if (inner.at < end) {
          ranges.push({ from: i, to: inner.at + 2, kind: 'strike', inner: { from: i + 2, to: inner.at }, children: inner.ranges });
          i = inner.at + 2;
          continue;
        }
      }
      i += n;
      continue;
    }
    if (c === '*' || c === '_') {
      const n = runLength(text, i, c);
      if (opens(text, i, n, c)) {
        if (n >= 2) {
          const inner = parseSeq(text, i + 2, end, { ch: c, n: 2 });
          if (inner.at < end) {
            ranges.push({ from: i, to: inner.at + 2, kind: 'strong', inner: { from: i + 2, to: inner.at }, children: inner.ranges });
            i = inner.at + 2;
            continue;
          }
        }
        const inner = parseSeq(text, i + 1, end, { ch: c, n: 1 });
        if (inner.at < end) {
          ranges.push({ from: i, to: inner.at + 1, kind: 'em', inner: { from: i + 1, to: inner.at }, children: inner.ranges });
          i = inner.at + 1;
          continue;
        }
      }
      i += n;
      continue;
    }
    i++;
  }
  return { ranges, at: end };
}

/** Every inline construct in `text`, outermost first, in order; nested ones under `children`. */
export function inlineRanges(text: string): InlineRange[] {
  return parseSeq(text, 0, text.length).ranges;
}

/** The marker spans of a range: the opening and closing marks, `![` and `](src)` for an image. */
export function markerRanges(r: InlineRange): { from: number; to: number }[] {
  return [{ from: r.from, to: r.inner.from }, { from: r.inner.to, to: r.to }].filter((m) => m.to > m.from);
}

/** Every range, nested ones included, in document order. */
export function flatRanges(ranges: InlineRange[]): InlineRange[] {
  const out: InlineRange[] = [];
  const visit = (list: InlineRange[]) => { for (const r of list) { out.push(r); visit(r.children); } };
  visit(ranges);
  return out;
}

/** True when `text` is one image and nothing else: an image paragraph. */
export function imageOnly(text: string): InlineRange | null {
  const t = text.trim();
  const lead = text.length - text.trimStart().length;
  const [r, ...rest] = inlineRanges(t);
  if (!r || rest.length || r.kind !== 'image' || r.from !== 0 || r.to !== t.length) return null;
  return { ...r, from: lead, to: lead + t.length, inner: { from: lead + r.inner.from, to: lead + r.inner.to } };
}

/** Where the `[note]` and `#tag:` marks are allowed: outside code, links, and images. */
export function literalSpans(ranges: InlineRange[]): { from: number; to: number }[] {
  return flatRanges(ranges).filter((r) => r.kind === 'code' || r.kind === 'link' || r.kind === 'image').map((r) => ({ from: r.from, to: r.to }));
}
