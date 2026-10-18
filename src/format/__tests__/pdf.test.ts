// The corpus's PDF: the file on disk is the generator's output byte for
// byte, and pdf.js reads the words back out of it, so the text layer the
// lens selects on is real.

import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { getDocument } from 'pdfjs-dist/legacy/build/pdf.mjs';
import { PAGES, PDF_PATH, makePdf } from './corpus/make-pdf.js';

describe('the corpus PDF', () => {
  it('is the generator\'s output, byte for byte', () => {
    const disk = new Uint8Array(readFileSync(PDF_PATH));
    expect(disk.length).toBe(makePdf().length);
    expect(Buffer.from(disk).equals(Buffer.from(makePdf()))).toBe(true);
    expect(Buffer.from(disk.slice(0, 8)).toString('latin1')).toBe('%PDF-1.4');
  });

  it('has two pages whose text pdf.js extracts', async () => {
    const task = getDocument({ data: makePdf(), useSystemFonts: false, verbosity: 0 });
    const pdf = await task.promise;
    try {
      expect(pdf.numPages).toBe(2);
      for (let n = 1; n <= 2; n++) {
        const page = await pdf.getPage(n);
        const text = (await page.getTextContent()).items
          .map((it) => ('str' in it ? it.str : ''))
          .filter(Boolean);
        expect(text).toEqual(PAGES[n - 1]);
      }
    } finally {
      await task.destroy();
    }
  });
});
