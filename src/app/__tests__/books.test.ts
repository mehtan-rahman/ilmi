// Milestone 49: the sample's two books beside their notes. The Lindqvist
// chapters and the reader's passage 12 are their pages (design/books/
// lindqvist.pdf and reader-book.pdf, copied beside the parents) with the
// person's notes as the body: each extract document became a boxed section
// of its chapter's notes, its text and cards kept, its schedule on the
// heading's line; the chapter's own cards sit in dismissed sections boxed
// over their passages and named as the page names them; no extract is left
// under the converted chapters, and the day's queue holds the sections
// among the rest.

import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { getDocument } from 'pdfjs-dist/legacy/build/pdf.mjs';
import { boxesAt, meta, parse, parseBox, parseBoxes, type Heading } from '../../format/index.js';
import { pageItems, sectionName, type PageItem } from '../../pdf/index.js';
import { docItems, isDue, sortQueue, type QueueItem, type SectionItem } from '../../schedule/index.js';
import { standing } from '../items.js';

const SAMPLE = join(import.meta.dirname, '../../../samples/double-major');
const BOOKS = join(import.meta.dirname, '../../../design/books');
const LQ = 'library/lindqvist-statistical-physics';
const P12 = 'library/classical-prose-reader/12-the-grammarian-and-the-bedouin.md';
const CHAPTERS = ['ch-2-microstates-and-entropy', 'ch-3-the-canonical-ensemble', 'ch-4-ideal-quantum-gases'];
const NOW = new Date('2026-11-02T12:00:00Z');

const read = (p: string) => readFileSync(join(SAMPLE, p), 'utf8');
const docOf = (p: string) => parse(read(p)).doc;
const headings = (p: string) => docOf(p).blocks.filter((b): b is Heading => b.kind === 'heading' && b.level === 2);

async function pdfItems(file: string): Promise<{ pages: number; at: (n: number) => PageItem[] | undefined }> {
  const doc = await getDocument({ data: new Uint8Array(readFileSync(file)), verbosity: 0 }).promise;
  const out = new Map<number, PageItem[]>();
  for (let n = 1; n <= doc.numPages; n++) {
    const page = await doc.getPage(n);
    const v = page.getViewport({ scale: 1 });
    out.set(n, pageItems((await page.getTextContent()).items, v.width, v.height));
  }
  return { pages: doc.numPages, at: (n) => out.get(n) };
}

describe('the Lindqvist chapters as books beside notes', async () => {
  const book = await pdfItems(join(SAMPLE, 'library/lindqvist-statistical-physics.pdf'));

  it('the PDF beside the parent is design/books/lindqvist.pdf, chapters 2–4 at pp. 17–34 of a 34-page book', () => {
    expect(readFileSync(join(SAMPLE, 'library/lindqvist-statistical-physics.pdf')).equals(readFileSync(join(BOOKS, 'lindqvist.pdf')))).toBe(true);
    expect(book.pages).toBe(34);
    expect(book.at(23)!.some((i) => i.s.trim() === 'The Canonical Ensemble')).toBe(true);
  });

  it.each(CHAPTERS)('%s: its pages in the book, its body the notes, no book text, no frozen', (ch) => {
    const m = meta(docOf(`${LQ}/${ch}.md`));
    expect(m.pdf).toBe('../lindqvist-statistical-physics.pdf');
    expect(m.pages).toBeTruthy();
    expect(m.frozen).toBe(false);
    expect(m.read?.pos).toBeGreaterThanOrEqual(m.pages!.first);
    expect(m.read?.pos).toBeLessThanOrEqual(m.pages!.last);
    expect(m.read?.y).toBeGreaterThan(0);
    const blocks = docOf(`${LQ}/${ch}.md`).blocks;
    expect(blocks.some((b) => b.kind === 'heading' && b.level === 1)).toBe(false);
    expect(blocks.some((b) => b.kind === 'heading' && !b.read)).toBe(false);
    expect(blocks.filter((b) => b.kind === 'raw' && b.text.startsWith('<!-- extract'))).toEqual([]);
  });

  it('every section is boxed on the chapter\'s own pages, in book order, the heading first', () => {
    for (const ch of CHAPTERS) {
      const m = meta(docOf(`${LQ}/${ch}.md`));
      let last = 0;
      for (const h of headings(`${LQ}/${ch}.md`)) {
        const boxes = parseBoxes(h.read?.boxes ?? '');
        expect(boxes, h.text).not.toBeNull();
        for (const b of boxes!) { expect(b.page).toBeGreaterThanOrEqual(m.pages!.first); expect(b.page).toBeLessThanOrEqual(m.pages!.last); }
        expect(boxesAt(boxes!), h.text).toBeGreaterThan(last);
        last = boxesAt(boxes!);
      }
    }
  });

  it('a dismissed section (the chapter\'s own card over its passage) is named as the page names it', () => {
    const named: string[] = [];
    for (const ch of CHAPTERS) {
      const first = meta(docOf(`${LQ}/${ch}.md`)).pages!.first;
      for (const h of headings(`${LQ}/${ch}.md`)) {
        if (h.read?.due !== undefined) continue;
        named.push(`${h.text} = ${sectionName(book.at, first, parseBoxes(h.read!.boxes!)!).name}`);
      }
    }
    expect(named).toEqual(named.map((n) => { const [a] = n.split(' = '); return `${a} = ${a}`; }));
    expect(named).toHaveLength(6);
  });

  it('the extracts\' text and cards moved in with their ids and schedules; no extract document is left', () => {
    const text = CHAPTERS.map((ch) => read(`${LQ}/${ch}.md`)).join('\n');
    for (const id of ['lq-ex-sharp-width', 'lq-ex-nfact-count', 'lq-ex-boltz-system-omega', 'lq-ex-boltz-small', 'lq-ex-expand-limit', 'lq-ex-equip-fraction', 'lq-ex-schottky-cond', 'lq-ex-schottky-cosh', 'lq-ex-st-negative', 'lq2-einstein-omega', 'lq2-peak-width', 'lq2-def-T', 'lq2-mixing', 'lq3-fluct-scaling', 'lq3-F-lnZ', 'lq3-equip-cond', 'lq3-dulong-petit', 'lq4-nQ']) {
      expect(text, id).toContain(`^${id}\n`);
    }
    expect(text).toContain('<!-- sr due=2026-11-19 st=review s=26.1 d=4.1 r=3 l=0 ivl=26 last=2026-10-24T09:52:00Z g=4 -->');
    expect(text).toContain('My gloss: the thing that\'s surprising');
    const sch = headings(`${LQ}/ch-3-the-canonical-ensemble.md`).find((h) => h.text === 'the Schottky anomaly')!;
    expect(sch.read).toMatchObject({ made: '2026-10-06', due: '2026-10-30', ivl: 5, reps: 2 });
    for (const ch of CHAPTERS) expect(readdirSync(join(SAMPLE, LQ)).includes(ch)).toBe(false);
  });
});

describe('the reader\'s passage 12 as a book beside notes', async () => {
  const reader = await pdfItems(join(SAMPLE, 'library/classical-prose-reader.pdf'));

  it('the PDF beside the parent is design/books/reader-book.pdf: the passage at pp. 129–134', () => {
    expect(readFileSync(join(SAMPLE, 'library/classical-prose-reader.pdf')).equals(readFileSync(join(BOOKS, 'reader-book.pdf')))).toBe(true);
    expect(reader.pages).toBe(134);
    expect(meta(docOf(P12))).toMatchObject({ pdf: '../classical-prose-reader.pdf', pages: { first: 129, last: 134 }, frozen: false });
    expect(reader.at(129)!.some((i) => i.s.includes('Glossary'))).toBe(true);
  });

  it('its extracts are sections boxed on p. 129, clipped where their text was; the commentary\'s cards under their pages\' clips', () => {
    const hs = headings(P12);
    expect(hs.map((h) => h.text)).toEqual(['dukkān, sirḥān, ʿuthmān (passage 12, ¶3)', 'analogy follows speech (passage 12, ¶4)', 'p. 131', 'p. 132', 'p. 133']);
    for (const h of hs.slice(0, 2)) {
      const boxes = parseBoxes(h.read?.boxes ?? '')!;
      expect(boxes).toHaveLength(1);
      expect(boxes[0]!.page).toBe(129);
      expect(sectionName(reader.at, 129, boxes).named).toBe(false);
    }
    const blocks = docOf(P12).blocks;
    const clips = blocks.flatMap((b) => (b.kind === 'raw' && /^<!-- box /.test(b.text) ? [b.text.slice(9, -4)] : []));
    expect(clips).toHaveLength(8);
    for (const c of clips) { const b = parseBox(c)!; expect(b, c).not.toBeNull(); expect(b.page).toBeGreaterThanOrEqual(129); expect(b.page).toBeLessThanOrEqual(133); }
    const i = blocks.findIndex((b) => b.kind === 'heading' && b.text.startsWith('dukkān'));
    expect(blocks[i + 1]).toMatchObject({ kind: 'raw', text: `<!-- box ${hs[0]!.read!.boxes} -->` });
    expect(blocks.some((b) => b.kind === 'heading' && b.level === 3 && b.text === 'parsing')).toBe(true);
    const text = read(P12);
    for (const id of ['rd-salatin', 'rd-faalil-diptote', 'rd-ayujmau', 'rd-tabian', 'rd-samaa-qiyas', 'rd-arabi-sifa', 'rd-five-nouns', 'rd-lam-juhud', 'rd-halla', 'rd-uthmanun', 'rd-ma-laka-sakitan', 'rd-uthmana-dipt']) expect(text, id).toContain(`^${id}\n`);
    expect(text).not.toContain('قِيلَ: خَرَجَ نَحْوِيٌّ');
    expect(statSync(join(SAMPLE, 'library/classical-prose-reader/11-the-judge-and-the-two-litigants')).isDirectory()).toBe(true);
    expect(() => statSync(join(SAMPLE, 'library/classical-prose-reader/12-the-grammarian-and-the-bedouin'))).toThrow();
  });
});

describe('the day\'s queue over the sample, 2026-11-02', () => {
  const docs = (dir: string, under = ''): string[] => readdirSync(join(SAMPLE, dir, under), { withFileTypes: true }).flatMap((e) => (e.isDirectory() ? docs(dir, join(under, e.name)) : e.name.endsWith('.md') ? [join(dir, under, e.name)] : []));
  const items: QueueItem[] = [];
  for (const p of [...docs('library'), ...docs('courses')]) items.push(...docItems(p, docOf(p), NOW));
  const queue = sortQueue(items.filter((i) => isDue(i, NOW)), NOW);
  const sections = queue.filter((i): i is SectionItem => i.kind === 'section');

  it('holds the books\' sections among the reading and the cards, each saying where it stands', () => {
    const boxed = sections.filter((s) => s.path.startsWith(LQ) || s.path === P12).map((s) => `${s.heading.slice(0, 24)} · ${standing(s, NOW)}`);
    expect(boxed).toContain('the N! only works when s · written, 1 card · back for the 4th time');
    expect(boxed).toContain('why the Boltzmann factor · written, 2 cards · back for the 4th time');
    expect(boxed).toContain('analogy follows speech ( · written, 3 cards · back for the 3rd time');
    expect(boxed.some((b) => b.startsWith('dukkān'))).toBe(false);
    expect(queue.some((i) => i.kind === 'read' && i.path === `${LQ}/ch-3-the-canonical-ensemble.md`)).toBe(true);
    const kinds = queue.map((i) => i.kind);
    const first = kinds.indexOf('section');
    expect(kinds.slice(0, first)).toContain('card');
    expect(kinds.slice(first)).toContain('read');
    // the dismissed ones are out
    expect(sections.some((s) => s.heading.startsWith('3.4 · the Helmholtz'))).toBe(false);
  });
});
