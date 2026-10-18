// A page's text as paragraphs, from the items pdf.js extracts: the fallback
// body an imported PDF gets under `## text`, and what search looks through.
// Lines end where pdf.js says they do; a paragraph ends where the gap to
// the next line is wider than a line, or the type size changes. Pure over
// `TextBit`s; the lens maps pdf.js's `TextItem`s onto them.

export interface TextBit {
  str: string;
  /** pdf.js's `hasEOL`: a line ends after this item. */
  eol: boolean;
  /** Baseline, in PDF units from the page's bottom. */
  y: number;
  /** The type size, in PDF units; 0 for an empty item. */
  height: number;
}

interface Line {
  text: string;
  y: number;
  height: number;
}

const collapse = (s: string) => s.replace(/\s+/g, ' ').trim();

/** The lines of a page, each with its baseline and the largest type size on it. */
export function linesOf(bits: TextBit[]): Line[] {
  const lines: Line[] = [];
  let cur: Line | null = null;
  for (const b of bits) {
    if (b.str) {
      if (!cur) cur = { text: '', y: b.y, height: b.height };
      cur.text += b.str;
      cur.height = Math.max(cur.height, b.height);
    }
    if (b.eol && cur) {
      lines.push({ ...cur, text: collapse(cur.text) });
      cur = null;
    }
  }
  if (cur) lines.push({ ...cur, text: collapse(cur.text) });
  return lines.filter((l) => l.text);
}

/** Join two lines of one paragraph: a word broken with a hyphen is mended. */
function joinLines(a: string, b: string): string {
  if (/[A-Za-z]-$/.test(a) && /^[a-z]/.test(b)) return a.slice(0, -1) + b;
  return `${a} ${b}`;
}

/**
 * The page's paragraphs, blank-line separated, as the format reads them:
 * a new paragraph starts after a vertical gap wider than 1.4 lines or at a
 * change of type size by more than a quarter.
 */
export function pageText(bits: TextBit[]): string {
  const lines = linesOf(bits);
  const paras: string[] = [];
  let cur = '';
  let prev: Line | null = null;
  for (const l of lines) {
    if (prev && cur) {
      const lead = Math.max(prev.height, l.height, 1);
      const gap = Math.abs(prev.y - l.y);
      const sizeChanged = Math.abs(prev.height - l.height) > 0.25 * lead;
      if (gap > 1.4 * lead || sizeChanged) {
        paras.push(cur);
        cur = '';
      }
    }
    cur = cur ? joinLines(cur, l.text) : l.text;
    prev = l;
  }
  if (cur) paras.push(cur);
  return paras.join('\n\n');
}

/** A whole document's text: the pages' paragraphs in order, nothing marking the page breaks. */
export function documentText(pages: string[]): string {
  return pages.filter((p) => p.trim()).join('\n\n');
}

/** How many words a text holds. */
export function wordCount(text: string): number {
  const t = text.trim();
  return t ? t.split(/\s+/).length : 0;
}
