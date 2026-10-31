// A PDF's chapters from its outline (milestone 46): the pure ranges, and
// pdf.js reading the outline of a generated book, each entry's page found.

import { describe, expect, it } from 'vitest';
import { getDocument } from 'pdfjs-dist/legacy/build/pdf.mjs';
import { chapterRanges, outlineEntries, type OutlinePdf } from '../index.js';
import { makeBookPdf } from '../fixture.js';

export const BOOK = [
  { title: 'Ensembles', pages: [['A system in contact with a reservoir.'], ['The canonical ensemble follows.']] },
  { title: 'The partition function', pages: [['Z sums the Boltzmann factors.'], ['Every average follows from Z.'], ['The free energy is -kT ln Z.']] },
  { title: 'Quantum statistics', pages: [['Bosons and fermions.']] },
];

describe('chapter ranges', () => {
  it('runs each chapter to the page before the next, the last to the end, in page order', () => {
    expect(chapterRanges([{ title: 'b', page: 4 }, { title: 'a', page: 1 }, { title: ' c\n d ', page: 7 }], 9)).toEqual([
      { title: 'a', first: 1, last: 3 },
      { title: 'b', first: 4, last: 6 },
      { title: 'c d', first: 7, last: 9 },
    ]);
  });

  it('drops entries with no page, out of the file, untitled, or on a page already taken; fewer than two is no book', () => {
    expect(chapterRanges([{ title: 'a', page: 2 }, { title: 'again', page: 2 }, { title: 'x', page: null }, { title: '', page: 3 }, { title: 'far', page: 99 }, { title: 'b', page: 5 }], 6)).toEqual([
      { title: 'a', first: 2, last: 4 },
      { title: 'b', first: 5, last: 6 },
    ]);
    expect(chapterRanges([{ title: 'only', page: 1 }], 5)).toEqual([]);
    expect(chapterRanges([], 5)).toEqual([]);
  });
});

describe('a generated book through pdf.js', () => {
  it('has its chapters\' pages and an outline whose entries name each chapter\'s first page', async () => {
    const task = getDocument({ data: makeBookPdf(BOOK, 'Statistical physics, briefly'), useSystemFonts: false, verbosity: 0 });
    const pdf = await task.promise;
    try {
      expect(pdf.numPages).toBe(6);
      const entries = await outlineEntries(pdf as unknown as OutlinePdf);
      expect(entries).toEqual([{ title: 'Ensembles', page: 1 }, { title: 'The partition function', page: 3 }, { title: 'Quantum statistics', page: 6 }]);
      expect(chapterRanges(entries, pdf.numPages)).toEqual([
        { title: 'Ensembles', first: 1, last: 2 },
        { title: 'The partition function', first: 3, last: 5 },
        { title: 'Quantum statistics', first: 6, last: 6 },
      ]);
      const page4 = (await (await pdf.getPage(4)).getTextContent()).items.map((it) => ('str' in it ? it.str : '')).join(' ');
      expect(page4).toContain('Every average follows from Z.');
      expect(((await pdf.getMetadata()).info as { Title?: string }).Title).toBe('Statistical physics, briefly');
    } finally {
      await task.destroy();
    }
  });

  it('a PDF with no outline has no chapters', async () => {
    const task = getDocument({ data: makeBookPdf([{ title: 'Alone', pages: [['one page']] }]), verbosity: 0 });
    const pdf = await task.promise;
    try {
      expect(chapterRanges(await outlineEntries(pdf as unknown as OutlinePdf), pdf.numPages)).toEqual([]);
    } finally {
      await task.destroy();
    }
  });
});
