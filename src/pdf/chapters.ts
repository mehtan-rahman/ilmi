// A PDF's chapters, from its outline (milestone 46): the outline's top
// entries, each the page its destination names, become page ranges, so a
// book lands as a notebook with a chapter per tab (FORMAT.md §3 `pages`).
// pdf.js reads the outline (src/app/pdfjs.ts); this is the pure side.

/** A top-level outline entry: its title, and the page (from 1) its destination resolves to, null when it names none. */
export interface OutlineEntry {
  title: string;
  page: number | null;
}

/** A chapter: its title and the pages it runs over, both ends in it. */
export interface ChapterRange {
  title: string;
  first: number;
  last: number;
}

/**
 * The chapters a book's outline makes: its entries with a page, in page
 * order (a second entry on the same page is dropped), each running to the
 * page before the next one starts, the last to the end. Fewer than two is
 * no chapters: one entry, or none, is not a book to split. Pages before
 * the first chapter (a cover, the contents) stay with the book's own
 * document, which is every page.
 */
export function chapterRanges(entries: readonly OutlineEntry[], pages: number): ChapterRange[] {
  const kept: { title: string; page: number }[] = [];
  const seen = new Set<number>();
  const sorted = entries
    .map((e, i) => ({ title: e.title.replace(/\s+/g, ' ').trim(), page: e.page, i }))
    .filter((e): e is { title: string; page: number; i: number } => e.page !== null && Number.isInteger(e.page) && e.page >= 1 && e.page <= pages && e.title !== '')
    .sort((a, b) => a.page - b.page || a.i - b.i);
  for (const e of sorted) {
    if (seen.has(e.page)) continue;
    seen.add(e.page);
    kept.push({ title: e.title, page: e.page });
  }
  if (kept.length < 2) return [];
  return kept.map((e, i) => ({ title: e.title, first: e.page, last: i + 1 < kept.length ? kept[i + 1]!.page - 1 : pages }));
}

/** What `outlineEntries` needs of a pdf.js document. */
export interface OutlinePdf {
  getOutline(): Promise<readonly { title: string; dest: unknown }[] | null>;
  getDestination(id: string): Promise<unknown[] | null>;
  getPageIndex(ref: never): Promise<number>;
}

/** The outline's top entries with the page each names; an entry whose destination does not resolve has no page. */
export async function outlineEntries(pdf: OutlinePdf): Promise<OutlineEntry[]> {
  const items = (await pdf.getOutline().catch(() => null)) ?? [];
  const out: OutlineEntry[] = [];
  for (const it of items) {
    let page: number | null = null;
    try {
      const dest = typeof it.dest === 'string' ? await pdf.getDestination(it.dest) : it.dest;
      const ref = Array.isArray(dest) ? dest[0] : null;
      if (typeof ref === 'number') page = ref + 1;
      else if (ref && typeof ref === 'object') page = (await pdf.getPageIndex(ref as never)) + 1;
    } catch { /* a destination that names no page */ }
    out.push({ title: typeof it.title === 'string' ? it.title : '', page });
  }
  return out;
}
