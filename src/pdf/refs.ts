// A reference under a point, without selecting it (milestone 76): the words
// on a page that name something elsewhere, `(3.12)`, `Fig. 4`, `Theorem 2`,
// `Section 3.2`, `§3.2`, `[17]`, `Eq. 5`, each with the box it lies in, read
// from pdf.js's text items. What a token points to is `jump.ts`'s to say
// (`refOf`, `seekTarget`): a token's text is what a selection of it would be.
// Pure; a token inside an item is placed by its share of the item's
// characters, which is near enough for a press and for a label.

/** A text item on a page: its string and its box, as fractions of the page from its top left; `em` is its type size as a fraction of the page's width. */
export interface TextBox {
  s: string;
  x: number;
  y: number;
  w: number;
  h: number;
  em: number;
}

/** pdf.js's text items (`getTextContent`) on a page of `width` × `height` PDF units, each with its box. */
export function textBoxes(items: readonly unknown[], width: number, height: number): TextBox[] {
  const out: TextBox[] = [];
  for (const it of items) {
    const t = it as { str?: unknown; transform?: unknown; width?: unknown; height?: unknown };
    if (typeof t.str !== 'string' || !t.str.trim() || !Array.isArray(t.transform)) continue;
    const tr = t.transform as number[];
    const size = typeof t.height === 'number' && t.height > 0 ? t.height : Math.abs(tr[3] ?? 0) || 10;
    const w = typeof t.width === 'number' ? t.width : 0;
    out.push({ s: t.str, x: (tr[4] ?? 0) / width, y: (height - (tr[5] ?? 0) - size) / height, w: w / width, h: size / height, em: size / width });
  }
  return out;
}

/** A reference on a page: its text, as a selection of it would read, and the box it lies in (fractions of the page). */
export interface RefToken {
  text: string;
  x: number;
  y: number;
  w: number;
  h: number;
}

interface Line {
  text: string;
  /** For each character of `text`: the box it came from and its place in that box's string; null for a space put between two boxes. */
  from: ({ box: number; at: number } | null)[];
}

/** The page's lines: boxes on one baseline, in the order pdf.js gives them, a space where two stand apart. */
function linesOf(boxes: readonly TextBox[]): Line[] {
  const lines: Line[] = [];
  let cur: Line | null = null;
  let prev: TextBox | null = null;
  boxes.forEach((b, i) => {
    const sameLine = prev !== null && Math.abs(b.y + b.h / 2 - (prev.y + prev.h / 2)) < Math.max(b.h, prev.h) * 0.6 && b.x >= prev.x - prev.em;
    if (!cur || !sameLine) { cur = { text: '', from: [] }; lines.push(cur); }
    else if (prev && b.x - (prev.x + prev.w) > 0.18 * Math.max(b.em, prev.em) && !/\s$/.test(cur.text) && !/^\s/.test(b.s)) { cur.text += ' '; cur.from.push(null); }
    for (let at = 0; at < b.s.length; at++) { cur.text += b.s[at]!; cur.from.push({ box: i, at }); }
    prev = b;
  });
  return lines;
}

const NUM = '\\d+(?:\\.\\d+)*';
/** A word that names a numbered thing, and its number. */
const NAMED = new RegExp(`(?<![\\p{L}\\d])(Figs?|Figures?|Tables?|Tab|Theorems?|Thm|Lemmas?|Propositions?|Prop|Corollary|Cor|Definitions?|Def|Examples?|Exercises?|Problems?|Algorithms?|Sections?|Sect?|Chapters?|Chap|Ch|[Ee]qs?|[Ee]qns?|[Ee]quations?)(\\.?)[ \\u00a0]?(\\(?)(${NUM})(?![\\d.]\\d)(\\)?)`, 'gu');
const SIGN = new RegExp(`§[ \\u00a0]?(${NUM})(?![\\d.]\\d)`, 'gu');
const PAREN = new RegExp(`\\((${NUM})\\)`, 'gu');
const CITE = /\[\s*\d+(?:\s*[,–-]\s*\d+)*\s*\]/gu;
const YEAR = /^(?:1[5-9]|20)\d\d$/;
const EQ_WORD = /^eq/i;

/** Every reference on the page, in reading order. A caption or a heading's own number (`Figure 4: …`, a numbered equation's label at its line's end, an entry of the bibliography) is not one. */
export function referenceTokens(boxes: readonly TextBox[]): RefToken[] {
  const out: RefToken[] = [];
  for (const line of linesOf(boxes)) {
    const found: { from: number; to: number; text: string }[] = [];
    const free = (from: number, to: number) => !found.some((f) => from < f.to && to > f.from);
    const opens = (from: number) => line.text.slice(0, from).trim() === '';
    const rest = (to: number) => line.text.slice(to).trim();
    for (const m of line.text.matchAll(NAMED)) {
      const from = m.index;
      const to = from + m[0].length;
      // a caption, a heading, a theorem's own: the line opens with it and ends there, or goes on with a period, colon or dash, or a title's capital
      if (opens(from) && /^(?:$|[.:—–-]|\p{Lu})/u.test(rest(to))) continue;
      const text = EQ_WORD.test(m[1]!) ? `(${m[4]})` : `${m[1]}${m[2]} ${m[4]}`;
      // a closing bracket with none opened is the sentence's (`(see Eq. 5)`), not the number's
      found.push({ from, to: m[5] && !m[3] ? to - 1 : to, text });
    }
    for (const m of line.text.matchAll(SIGN)) {
      const from = m.index;
      if (free(from, from + m[0].length)) found.push({ from, to: from + m[0].length, text: `§${m[1]}` });
    }
    for (const m of line.text.matchAll(PAREN)) {
      const from = m.index;
      const to = from + m[0].length;
      if (!free(from, to) || YEAR.test(m[1]!)) continue;
      // `f(2)`, `x(3)`: a bracket that follows a letter, a digit or a bracket is an argument
      if (from > 0 && /[\p{L}\d)\]]/u.test(line.text[from - 1]!)) continue;
      // an equation's own number: the last thing on its line, alone there or set apart from what it numbers
      if (rest(to) === '') {
        const first = line.from[from];
        const before = from > 0 ? line.from[from - 1] : null;
        const own = !!first && first.at === 0;
        const apart = opens(from) || (own && before === null) || (own && !!before && gapBefore(boxes, first.box) > 1.5 * boxes[first.box]!.em);
        if (apart) continue;
      }
      found.push({ from, to, text: `(${m[1]})` });
    }
    for (const m of line.text.matchAll(CITE)) {
      const from = m.index;
      const to = from + m[0].length;
      // an entry of the bibliography opens its line with its key
      if (!free(from, to) || (opens(from) && rest(to) !== '')) continue;
      found.push({ from, to, text: m[0].replace(/\s+/g, '') });
    }
    found.sort((a, b) => a.from - b.from);
    for (const f of found) {
      const box = boxOf(boxes, line, f.from, f.to);
      if (box) out.push({ text: f.text, ...box });
    }
  }
  return out;
}

/** The room between a box and the one before it on the page, as a fraction of the page's width. */
function gapBefore(boxes: readonly TextBox[], i: number): number {
  const b = boxes[i]!;
  const p = boxes[i - 1];
  return p ? b.x - (p.x + p.w) : Infinity;
}

/** The box around the characters `from` to `to` of a line: each end placed by its share of its item's characters. */
function boxOf(boxes: readonly TextBox[], line: Line, from: number, to: number): { x: number; y: number; w: number; h: number } | null {
  let x0 = Infinity;
  let x1 = -Infinity;
  let y0 = Infinity;
  let y1 = -Infinity;
  for (let i = from; i < to; i++) {
    const c = line.from[i];
    if (!c) continue;
    const b = boxes[c.box]!;
    const n = Math.max(1, b.s.length);
    x0 = Math.min(x0, b.x + (b.w * c.at) / n);
    x1 = Math.max(x1, b.x + (b.w * (c.at + 1)) / n);
    y0 = Math.min(y0, b.y);
    y1 = Math.max(y1, b.y + b.h);
  }
  if (!(x1 > x0) && !(y1 > y0)) return null;
  return { x: x0, y: y0, w: Math.max(0, x1 - x0), h: y1 - y0 };
}

/** The reference under a point of the page (fractions from its top left), a little room around each; null where there is none. */
export function referenceAt(boxes: readonly TextBox[], x: number, y: number): RefToken | null {
  return tokenAt(referenceTokens(boxes), x, y);
}

/** The token of `tokens` under a point. */
export function tokenAt(tokens: readonly RefToken[], x: number, y: number): RefToken | null {
  const px = 0.004;
  const py = 0.003;
  return tokens.find((t) => x >= t.x - px && x <= t.x + t.w + px && y >= t.y - py && y <= t.y + t.h + py) ?? null;
}
