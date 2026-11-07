// Writes the corpus's PDFs: `vault/papers/two-pages.pdf`, two US-letter pages
// of Helvetica text, nobody's paper, and `vault/books/alone.pdf`, three pages
// that stand on their own with no `.md` of their name (milestone 70), both
// made here so they can be regenerated and so the tests can hold the files
// on disk to these bytes. The text is written
// with text operators and a standard Type1 font, so pdf.js (and any reader)
// gets a real text layer out of it. No dates, no ids: the bytes never change.
//
//   npm run fixture:pdf

import { writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

/** The lines of each page, in reading order; the first line of each is set larger. */
export const PAGES: string[][] = [
  [
    'Two pages',
    'The lens opens a PDF beside its Markdown and reads it in place.',
    'A selection on a page is a selection of text, so an extract or a card',
    'can be carved from it the way it is carved from a paragraph.',
    'The ruler in the margin marks the page you are on.',
    'Figure 1 shows the margin, and [1] names the method.',
  ],
  [
    'The second page',
    'Spaced practice beats massed practice, and the gap should grow',
    'with each pass.',
    'A card made here lands under a heading that names the page.',
    'Nothing is ever written into this file.',
    'Figure 1. A ruler drawn in the margin of a page.',
    'References',
    '[1] Nobody. A paper that does not exist. 2026.',
  ],
];

/** The pages of the PDF on its own: a short chapter, so a passage boxed in it can be named from its heading. */
export const ALONE: string[][] = [
  [
    '1 The ruler',
    'A PDF may stand in a collection on its own, with no note of its name.',
    'Its pages are read in place, and its reading state is kept apart.',
    'A note is attached to it by naming the file, and need not be named after it.',
  ],
  [
    '2 The gap',
    'The gap between passes grows with each pass made on time.',
    'A passage boxed on this page becomes a section of the attached note.',
  ],
  [
    '3 The end',
    'Nothing is ever written into this file.',
  ],
];

const esc = (s: string) => s.replace(/[\\()]/g, (c) => `\\${c}`);

/** One page's content stream: the first line at 20pt, the rest at 12pt with a 16pt leading. */
function content(lines: string[]): string {
  const [title, ...rest] = lines;
  const out = [`BT /F1 20 Tf 72 700 Td (${esc(title ?? '')}) Tj ET`, 'BT /F1 12 Tf 16 TL 72 660 Td'];
  rest.forEach((l, i) => out.push(`${i ? 'T* ' : ''}(${esc(l)}) Tj`));
  out.push('ET');
  return out.join('\n');
}

/** The whole file, as bytes. Latin-1: the text above is ASCII. */
export function makePdf(pages: string[][] = PAGES): Uint8Array {
  const objects: string[] = [];
  const add = (body: string) => { objects.push(body); return objects.length; };
  const catalog = add('');
  const tree = add('');
  const font = add('<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica /Encoding /WinAnsiEncoding >>');
  const kids: number[] = [];
  for (const lines of pages) {
    const stream = content(lines);
    const contents = add(`<< /Length ${Buffer.byteLength(stream, 'latin1')} >>\nstream\n${stream}\nendstream`);
    kids.push(add(`<< /Type /Page /Parent ${tree} 0 R /Contents ${contents} 0 R /Resources << /Font << /F1 ${font} 0 R >> >> >>`));
  }
  objects[catalog - 1] = `<< /Type /Catalog /Pages ${tree} 0 R >>`;
  objects[tree - 1] = `<< /Type /Pages /Kids [${kids.map((k) => `${k} 0 R`).join(' ')}] /Count ${kids.length} /MediaBox [0 0 612 792] >>`;

  let out = '%PDF-1.4\n%\xe2\xe3\xcf\xd3\n';
  const offsets: number[] = [];
  objects.forEach((body, i) => {
    offsets.push(Buffer.byteLength(out, 'latin1'));
    out += `${i + 1} 0 obj\n${body}\nendobj\n`;
  });
  const xref = Buffer.byteLength(out, 'latin1');
  out += `xref\n0 ${objects.length + 1}\n0000000000 65535 f \n`;
  for (const o of offsets) out += `${String(o).padStart(10, '0')} 00000 n \n`;
  out += `trailer\n<< /Size ${objects.length + 1} /Root ${catalog} 0 R >>\nstartxref\n${xref}\n%%EOF\n`;
  return new Uint8Array(Buffer.from(out, 'latin1'));
}

export const PDF_PATH = fileURLToPath(new URL('./vault/papers/two-pages.pdf', import.meta.url));
export const ALONE_PATH = fileURLToPath(new URL('./vault/books/alone.pdf', import.meta.url));

if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) {
  writeFileSync(PDF_PATH, makePdf());
  console.log(`${PDF_PATH}: ${makePdf().length} bytes, ${PAGES.length} pages`);
  writeFileSync(ALONE_PATH, makePdf(ALONE));
  console.log(`${ALONE_PATH}: ${makePdf(ALONE).length} bytes, ${ALONE.length} pages`);
}
