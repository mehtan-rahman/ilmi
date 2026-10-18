// Smart jump: a reference selected on a page, and where in the PDF it
// points. After sioyek's behaviour (read, not copied): a figure or table
// reference is a type word and a number, matched against a line that opens
// with a word of the same stem and that number; a bracketed citation or an
// author is matched against the bibliography, the pages from the last
// heading that says references or bibliography; an equation number in
// parentheses is matched against a line that ends in it. Pure over the
// pages' lines; the lens shows the hit in a peek without leaving the page.

export type Ref =
  | { kind: 'figure'; type: string; n: string }
  | { kind: 'cite'; key: string }
  | { kind: 'author'; name: string; year?: string }
  | { kind: 'equation'; n: string };

export interface Target {
  /** 1-based. */
  page: number;
  /** Index into that page's lines. */
  line: number;
}

const FIGURE = /^([A-Za-z]{3,})\.?\s+(\d+(?:\.\d+)*)[.,;:]?$/;
const CITE = /^\[\s*(\d+)(?:\s*[,–-]\s*\d+)*\s*\]$/;
const EQUATION = /^(?:\(\s*(\d+(?:\.\d+)*)\s*\)|(?:[Ee]q(?:uation)?\.?)\s+\(?(\d+(?:\.\d+)*)\)?)$/;
const AUTHOR = /^([A-Z][\p{L}'-]+)(?:\s+(?:et\s+al\.?|and\s+[A-Z][\p{L}'-]+|&\s+[A-Z][\p{L}'-]+))?,?\s*(?:\(?\s*(\d{4})[a-z]?\s*\)?)?[.,;:]?$/u;
const HEADING = /^\s*(?:\d+\.?\s*)?(references|bibliography|works cited|literature cited)\b/i;

/** What a selection names, or null when it is not a reference the lens can follow. */
export function refOf(text: string): Ref | null {
  const t = text.replace(/\s+/g, ' ').trim();
  if (!t || t.length > 60) return null;
  const eq = EQUATION.exec(t);
  if (eq) return { kind: 'equation', n: (eq[1] ?? eq[2])! };
  const cite = CITE.exec(t);
  if (cite) return { kind: 'cite', key: cite[1]! };
  const au = AUTHOR.exec(t);
  const author: Ref | null = au ? (au[2] === undefined ? { kind: 'author', name: au[1]! } : { kind: 'author', name: au[1]!, year: au[2] }) : null;
  const fig = FIGURE.exec(t);
  // `Smith 2019` is a name and a year, not the 2019th figure
  if (fig && !(author?.kind === 'author' && author.year !== undefined && /^(?:1[89]|20)\d\d$/.test(fig[2]!))) return { kind: 'figure', type: fig[1]!, n: fig[2]! };
  return author;
}

/** How many leading characters two words share, case folded: `Fig` and `Figure` share 3. */
export function stemShared(a: string, b: string): number {
  const x = a.toLowerCase();
  const y = b.toLowerCase();
  let i = 0;
  while (i < x.length && i < y.length && x[i] === y[i]) i++;
  return i;
}

const escapeRe = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

/** The first page of the bibliography: the last page with a references heading, else the last fifth of the document. */
export function bibliographyStart(pages: string[][]): number {
  for (let p = pages.length; p >= 1; p--) {
    if (pages[p - 1]!.some((l) => HEADING.test(l))) return p;
  }
  return Math.max(1, Math.ceil(pages.length * 0.8));
}

/** Candidates ranked: closest page to `from` wins, then the earlier line. */
function nearest(hits: Target[], from: number): Target | null {
  let best: Target | null = null;
  for (const h of hits) {
    if (!best || Math.abs(h.page - from) < Math.abs(best.page - from)) best = h;
  }
  return best;
}

/**
 * Where `ref` points in `pages` (each page its lines, in reading order),
 * seen from page `from`; null when nothing fits. A reference is never
 * matched to the line it was selected on: a caption line is one that opens
 * with the type and number, a citation one that opens with its key.
 */
export function jumpTarget(pages: string[][], ref: Ref, from: number): Target | null {
  const hits: Target[] = [];
  const each = (fn: (line: string, page: number, i: number) => boolean, fromPage = 1) => {
    for (let p = fromPage; p <= pages.length; p++) pages[p - 1]!.forEach((l, i) => { if (fn(l.trim(), p, i)) hits.push({ page: p, line: i }); });
  };
  switch (ref.kind) {
    case 'figure': {
      const num = escapeRe(ref.n);
      const open = new RegExp(`^([A-Za-z]{3,})\\.?\\s+${num}(?![\\d.]\\d)\\.?(?:\\s|$|[:.—–-])`);
      // a caption opens with the type and the number and goes on; the reference itself does not
      each((l) => {
        const m = open.exec(l);
        return !!m && stemShared(m[1]!, ref.type) >= 3 && l.length > m[0].length;
      });
      // a caption with a period or colon after the number outranks a bare mention
      const strong = hits.filter((h) => new RegExp(`^[A-Za-z]{3,}\\.?\\s+${num}\\s*[.:—–-]`).test(pages[h.page - 1]![h.line]!.trim()));
      return nearest(strong.length ? strong : hits, from);
    }
    case 'cite': {
      const key = escapeRe(ref.key);
      const entry = new RegExp(`^(?:\\[${key}\\]|${key}\\.)\\s*\\S`);
      each((l) => entry.test(l), bibliographyStart(pages));
      if (!hits.length) each((l) => entry.test(l));
      return hits.length ? nearest(hits, pages.length) : null;
    }
    case 'author': {
      const name = new RegExp(`^(?:\\[\\d+\\]\\s*|\\d+\\.\\s*)?${escapeRe(ref.name)}\\b`, 'i');
      each((l) => name.test(l) && (ref.year === undefined || l.includes(ref.year)), bibliographyStart(pages));
      if (!hits.length) each((l) => name.test(l) && (ref.year === undefined || l.includes(ref.year)));
      return hits.length ? nearest(hits, pages.length) : null;
    }
    case 'equation': {
      const tail = new RegExp(`\\(\\s*${escapeRe(ref.n)}\\s*\\)$`);
      each((l) => tail.test(l) && l.length > ref.n.length + 2);
      return nearest(hits, from);
    }
  }
}
