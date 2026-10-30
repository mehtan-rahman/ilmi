// Which way a block reads. Obsidian's rule: a block takes the direction of
// its first strong character (a letter); a block with none (empty, digits,
// a formula alone) takes the direction of the block before it, so a new
// line typed after Arabic stays right to left. What is isolated left to
// right (math, inline code, a link's address, card markup and `^id`)
// never decides it. A decoration, never written to the file.
//
// Pure: strings in, directions and ranges out. The editor's plugin
// (plugins.ts) and the read-only drawings (Reader.tsx, Session, the deck
// browser, the queue) call these.

import { mathSpanEnd, type Blank, type CardSeg, type MathSeg } from '../format/index.js';
import { flatRanges, inlineRanges } from './inline.js';

export type Dir = 'ltr' | 'rtl';

/** Letters of the scripts written right to left. */
const RTL_LETTER = /[\p{scx=Arabic}\p{scx=Hebrew}\p{scx=Syriac}\p{scx=Thaana}\p{scx=Nko}\p{scx=Samaritan}\p{scx=Mandaic}\p{scx=Adlam}]/u;
const LETTER = /\p{L}/u;

/** A combining mark: the ḥarakāt, the shadda, the dagger alif, and every other `\p{M}`. */
const MARK = /\p{M}/u;

export interface Span {
  from: number;
  to: number;
}

/**
 * The ranges of `text` that are set left to right on their own, whatever
 * the block's direction: math (`$…$`, `$$…$$`), inline code, a link's or an
 * image's address. In the drawing each is `dir="ltr"` with
 * `unicode-bidi: isolate`; here they are what the direction rule skips.
 */
export function isolatedSpans(text: string): Span[] {
  const out: Span[] = [];
  let blanked = '';
  let last = 0;
  for (let i = 0; i < text.length; i++) {
    if (text[i] !== '$') continue;
    const e = mathSpanEnd(text, i);
    if (e < 0) continue;
    out.push({ from: i, to: e });
    blanked += text.slice(last, i) + ' '.repeat(e - i);
    last = e;
    i = e - 1;
  }
  blanked += text.slice(last);
  for (const r of flatRanges(inlineRanges(blanked))) {
    if (r.kind === 'code') out.push({ from: r.from, to: r.to });
    // `](address)`: past the text, to the range's end
    else if ((r.kind === 'link' || r.kind === 'image') && r.href) out.push({ from: r.inner.to, to: r.to });
  }
  return out.sort((a, b) => a.from - b.from);
}

/**
 * Card markup and anchors that must read in order inside a right-to-left
 * line: a blank's `{{c1::` and its `}}`, a ` :: ` or ` ::: ` between faces,
 * and a trailing ` ^id`. Isolated left to right when drawn; skipped by the
 * direction rule (`c1` is not the sentence's first letter).
 */
export function markupSpans(text: string): Span[] {
  const out: Span[] = [];
  for (const m of text.matchAll(/\{\{(?:c?\d+::)?|\}\}|(?<= ):{2,3}(?= )|(?<=^|\s)\^[A-Za-z0-9][\w-]*(?=\s*$)/g)) {
    out.push({ from: m.index, to: m.index + m[0].length });
  }
  // a bare `{{` with no group opens nothing the eye needs isolated
  return out.filter((s) => text.slice(s.from, s.to) !== '{{');
}

/** The direction of a letter, null for anything else (digits, punctuation, marks, spaces). */
export function charDir(ch: string): Dir | null {
  if (!LETTER.test(ch)) return null;
  return RTL_LETTER.test(ch) ? 'rtl' : 'ltr';
}

/** Is `i` inside one of the spans (sorted by `from`)? Returns the span's end, or -1. */
function within(spans: Span[], i: number): number {
  for (const s of spans) {
    if (s.from > i) break;
    if (i < s.to) return s.to;
  }
  return -1;
}

/** HTML comments (a schedule line, an extract's backref): never prose. */
const COMMENT = /<!--[\s\S]*?-->/g;
/** A bare address: read left to right and skipped. */
const URL = /\b(?:https?|ilmi|file):\/\/\S+/g;

/**
 * The direction of `text`'s first strong character, outside what is
 * isolated (`isolatedSpans`, `markupSpans`, comments, bare addresses);
 * null when it has none.
 */
export function strongDir(text: string): Dir | null {
  const skip = [...isolatedSpans(text), ...markupSpans(text)];
  for (const re of [COMMENT, URL]) for (const m of text.matchAll(re)) skip.push({ from: m.index, to: m.index + m[0].length });
  skip.sort((a, b) => a.from - b.from);
  for (let i = 0; i < text.length;) {
    const end = within(skip, i);
    if (end >= 0) { i = end; continue; }
    const cp = text.codePointAt(i)!;
    const ch = String.fromCodePoint(cp);
    const d = charDir(ch);
    if (d) return d;
    i += ch.length;
  }
  return null;
}

/** `text`'s direction, `fallback` when it has no strong character. */
export const textDir = (text: string, fallback: Dir = 'ltr'): Dir => strongDir(text) ?? fallback;

/**
 * The direction of each block in order. A string is a block's text: its
 * first strong character decides, and with none it takes the block before
 * it (`start` for the first). `null` is a block set left to right on its
 * own (fenced code, an HTML block): `ltr`, and the blocks after it inherit
 * past it as if it were not there.
 */
export function blockDirs(texts: readonly (string | null)[], start: Dir = 'ltr'): Dir[] {
  let cur = start;
  return texts.map((t) => {
    if (t === null) return 'ltr';
    cur = strongDir(t) ?? cur;
    return cur;
  });
}

/** For an HTML string: ` dir="rtl"`, ` dir="ltr"`, or nothing when `text` has no strong character (it inherits). */
export function dirAttr(text: string): string {
  const d = strongDir(text);
  return d ? ` dir="${d}"` : '';
}

// ── a blank that is only marks ───────────────────────────────────

/** Is `answer` only combining marks (a case ending: `ٍ`, `ُ`), with at least one? */
export function marksOnly(answer: string): boolean {
  if (!answer) return false;
  for (const ch of answer) if (!MARK.test(ch)) return false;
  return true;
}

/**
 * Split `text` before its last letter and the marks on it: `[before,
 * base]`. The base is what a marks-only blank sits on, drawn inside the
 * blank so the blank shows on its letter. `base` is `''` when the text
 * does not end in a letter.
 */
export function baseSplit(text: string): [string, string] {
  let i = text.length;
  while (i > 0 && MARK.test(text[i - 1]!)) i--;
  if (i === 0) return [text, ''];
  // the letter itself, a surrogate pair taken whole
  const lo = text.charCodeAt(i - 1);
  const start = lo >= 0xdc00 && lo <= 0xdfff && i >= 2 ? i - 2 : i - 1;
  if (!LETTER.test(text.slice(start, i))) return [text, ''];
  return [text.slice(0, start), text.slice(start)];
}

/** A blank whose answer is only marks, with the letter it sits on taken out of the text before it. */
export type BasedBlank = Blank & { base?: string };
export type BasedSeg = string | BasedBlank | MathSeg;

/**
 * A card's segments with each marks-only blank given its `base`: the
 * letter (and any marks already on it) at the end of the text before the
 * blank, taken out of that text. Drawn, the blank holds its base, so the
 * hidden blank is the bare letter and the revealed one the letter with
 * its mark, never an empty chip. A blank with nothing to sit on is left as
 * it was.
 */
export function withBases(segs: readonly CardSeg[]): BasedSeg[] {
  const out: BasedSeg[] = [];
  for (const seg of segs) {
    const prev = out[out.length - 1];
    if (typeof seg !== 'string' && !('span' in seg) && !seg.math && marksOnly(seg.answer) && typeof prev === 'string') {
      const [before, base] = baseSplit(prev);
      if (base) {
        if (before) out[out.length - 1] = before;
        else out.pop();
        out.push({ ...seg, base });
        continue;
      }
    }
    out.push(seg);
  }
  return out;
}
