// The PDF's own links and its outline (milestone 76). pdf.js reads a page's
// annotations and the document's outline (`src/app/pdfjs.ts`); this is the
// pure side: a link's rectangle as fractions of its page, a destination as a
// page and a height on it, the outline flattened with each entry's depth,
// cut to a chapter's pages, and the entry that holds a place.

/** A link on a page: where it lies (fractions of the page, from its top left) and where it goes. */
export interface PageLink {
  x: number;
  y: number;
  w: number;
  h: number;
  /** A web address (http, https, mailto), as pdf.js cleaned it. */
  url?: string;
  /** An inside destination: a name, or pdf.js's explicit array. */
  dest?: unknown;
  /** A named action: `NextPage`, `PrevPage`, `FirstPage`, `LastPage`. */
  action?: string;
}

const WEB = /^(?:https?:|mailto:)/i;

/**
 * A page's link annotations as hit areas. `toView` turns an annotation's
 * rectangle (PDF units) into the page's own at scale 1, from its top left
 * (pdf.js's `convertToViewportRectangle`, which knows a turned page); the
 * page is `width` × `height` there. A link that goes nowhere the lens can
 * follow, or has no area, is left out.
 */
export function pageLinks(annotations: readonly unknown[], toView: (rect: number[]) => number[], width: number, height: number): PageLink[] {
  const out: PageLink[] = [];
  for (const a of annotations) {
    const an = a as { subtype?: unknown; rect?: unknown; url?: unknown; dest?: unknown; action?: unknown };
    if (an.subtype !== 'Link' || !Array.isArray(an.rect) || an.rect.length < 4) continue;
    const r = toView(an.rect as number[]);
    const x = Math.min(r[0]!, r[2]!) / width;
    const y = Math.min(r[1]!, r[3]!) / height;
    const w = Math.abs(r[2]! - r[0]!) / width;
    const h = Math.abs(r[3]! - r[1]!) / height;
    if (!(w > 0) || !(h > 0)) continue;
    const at = { x, y, w, h };
    if (typeof an.url === 'string' && WEB.test(an.url)) out.push({ ...at, url: an.url });
    else if (typeof an.dest === 'string' || (Array.isArray(an.dest) && an.dest.length > 0)) out.push({ ...at, dest: an.dest });
    else if (typeof an.action === 'string' && an.action) out.push({ ...at, action: an.action });
  }
  return out;
}

/** A rectangle in PDF units on a page whose box is `view` (`[x0, y0, x1, y1]`, not turned), from its top left. */
export const flipRect = (view: readonly number[]) => (rect: number[]): number[] => [rect[0]! - view[0]!, view[3]! - rect[3]!, rect[2]! - view[0]!, view[3]! - rect[1]!];

/** The link under a point of the page (fractions), the smallest when two lie over each other. */
export function linkAt<T extends { x: number; y: number; w: number; h: number }>(links: readonly T[], x: number, y: number): T | null {
  let best: T | null = null;
  for (const l of links) {
    if (x < l.x || x > l.x + l.w || y < l.y || y > l.y + l.h) continue;
    if (!best || l.w * l.h < best.w * best.h) best = l;
  }
  return best;
}

/** What resolving a destination needs of a pdf.js document. */
export interface DestPdf {
  getDestination(id: string): Promise<unknown[] | null>;
  getPageIndex(ref: never): Promise<number>;
}

/** A destination: the page (from 1) and, when it names one, the height on the page it puts at the top, in PDF units from the page's bottom. */
export interface Dest {
  page: number;
  top: number | null;
}

/** Where a destination (a name, or an explicit array) goes; null when it names no page. */
export async function resolveDest(pdf: DestPdf, dest: unknown): Promise<Dest | null> {
  try {
    const d = typeof dest === 'string' ? await pdf.getDestination(dest) : dest;
    if (!Array.isArray(d) || !d.length) return null;
    const ref: unknown = d[0];
    let page: number;
    if (typeof ref === 'number' && Number.isInteger(ref)) page = ref + 1;
    else if (ref && typeof ref === 'object') page = (await pdf.getPageIndex(ref as never)) + 1;
    else return null;
    const kind = (d[1] as { name?: unknown } | undefined)?.name;
    const num = (v: unknown): number | null => (typeof v === 'number' && Number.isFinite(v) ? v : null);
    const top = kind === 'XYZ' ? num(d[3]) : kind === 'FitH' || kind === 'FitBH' ? num(d[2]) : kind === 'FitR' ? num(d[5]) : null;
    return { page, top };
  } catch {
    return null;
  }
}

/** A height in PDF units from a page's bottom as how far down the page it is, 0 to 1; a destination with none is the page's top. */
export function downPage(top: number | null, height: number): number {
  if (top === null || !(height > 0)) return 0;
  return Math.min(1, Math.max(0, 1 - top / height));
}

/** The page a named action goes to from `current`, in a book of pages `first` to `last`; null for one the lens does not follow. */
export function actionPage(action: string, current: number, first: number, last: number): number | null {
  switch (action) {
    case 'NextPage': return Math.min(last, current + 1);
    case 'PrevPage': return Math.max(first, current - 1);
    case 'FirstPage': return first;
    case 'LastPage': return last;
    default: return null;
  }
}

// ── the contents ──

/** An entry of the contents: its title, how deep in the outline it is, and the place it names (`y` how far down the page). */
export interface ContentsEntry {
  title: string;
  depth: number;
  page: number;
  y: number;
}

interface OutlineNode { title?: unknown; dest?: unknown; items?: unknown }

/** What `flatOutline` needs of a pdf.js document. */
export interface ContentsPdf extends DestPdf {
  getOutline(): Promise<readonly unknown[] | null>;
}

/**
 * The PDF's outline, every entry at every depth, in order, each with the
 * page its destination names; `heightOf` gives a page's height in PDF
 * units, for how far down the page the destination is. An entry that names
 * no page is left out (its children are kept, at their depth).
 */
export async function flatOutline(pdf: ContentsPdf, heightOf: (page: number) => number | Promise<number>): Promise<ContentsEntry[]> {
  const top = (await pdf.getOutline().catch(() => null)) ?? [];
  const out: ContentsEntry[] = [];
  const visit = async (nodes: readonly unknown[], depth: number): Promise<void> => {
    for (const raw of nodes) {
      const n = raw as OutlineNode;
      const title = typeof n.title === 'string' ? n.title.replace(/\s+/g, ' ').trim() : '';
      const d = await resolveDest(pdf, n.dest);
      if (d && title) out.push({ title, depth, page: d.page, y: downPage(d.top, d.top === null ? 0 : await heightOf(d.page)) });
      if (Array.isArray(n.items) && n.items.length) await visit(n.items, depth + 1);
    }
  };
  await visit(top, 0);
  return out;
}

/** The entries inside the pages `first` to `last` (a chapter cut from a book), the shallowest of them at depth 0. */
export function contentsWithin(entries: readonly ContentsEntry[], first: number, last: number): ContentsEntry[] {
  const kept = entries.filter((e) => e.page >= first && e.page <= last);
  const least = kept.reduce((m, e) => Math.min(m, e.depth), Infinity);
  return kept.map((e) => ({ ...e, depth: e.depth - least }));
}

/** Which entry holds the place: the last one, in the outline's order, that starts at or before it; -1 before the first. */
export function contentsHere(entries: readonly ContentsEntry[], page: number, y: number): number {
  let at = -1;
  // a little past the place: an entry gone to lands a line under the top of the view
  const eps = 0.03;
  entries.forEach((e, i) => { if (e.page < page || (e.page === page && e.y <= y + eps)) at = i; });
  return at;
}
