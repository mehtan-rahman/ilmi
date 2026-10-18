// Finding a stored passage on a page again. The text layer pdf.js builds is
// many small text nodes whose whitespace is a layout accident, and the text
// an extract stored came through a selection, so both are matched with
// their whitespace removed and the hit mapped back to node offsets. Pure;
// the lens turns the result into a DOM Range.

export interface TextPos {
  /** Index into the node list. */
  node: number;
  /** Character offset inside that node's text. */
  offset: number;
}

export interface Found {
  start: TextPos;
  /** Exclusive: the position just after the last matched character. */
  end: TextPos;
}

const WS = /\s/;

/** The nodes' text with every whitespace character dropped, and where each kept character came from. */
function squash(nodes: string[], fold: boolean): { text: string; at: TextPos[] } {
  let text = '';
  const at: TextPos[] = [];
  nodes.forEach((s, node) => {
    for (let offset = 0; offset < s.length; offset++) {
      const c = s[offset]!;
      if (WS.test(c)) continue;
      text += fold ? c.toLowerCase() : c;
      at.push({ node, offset });
    }
  });
  return { text, at };
}

const strip = (s: string, fold: boolean) => { const t = s.replace(/\s+/g, ''); return fold ? t.toLowerCase() : t; };

/**
 * Every place `needle` occurs in the nodes' text, whitespace ignored on both
 * sides, in order, non-overlapping. `fold` ignores case too, for search.
 * Nothing for an empty needle.
 */
export function findAll(nodes: string[], needle: string, fold = false): Found[] {
  const n = strip(needle, fold);
  if (!n) return [];
  const { text, at } = squash(nodes, fold);
  const out: Found[] = [];
  let from = 0;
  for (;;) {
    const i = text.indexOf(n, from);
    if (i < 0) break;
    const last = at[i + n.length - 1]!;
    out.push({ start: at[i]!, end: { node: last.node, offset: last.offset + 1 } });
    from = i + n.length;
  }
  return out;
}

/** The first occurrence, or null. */
export function findText(nodes: string[], needle: string, fold = false): Found | null {
  return findAll(nodes, needle, fold)[0] ?? null;
}

/** How many times `needle` occurs in a page's text, whitespace and case ignored. */
export function countIn(text: string, needle: string): number {
  return findAll([text], needle, true).length;
}
