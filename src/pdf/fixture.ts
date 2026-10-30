// A small book as a PDF, for the tests and the `open` smoke (milestone 46):
// US-letter pages of Helvetica text, a chapter's first page titled larger,
// and an outline with one entry per chapter pointing at its first page, so
// pdf.js finds the chapters as a real book's bookmarks would give them.
// ASCII only, no dates, no ids, no Node: it runs in the webview as well.

export interface FixtureChapter {
  title: string;
  /** Each page's lines; the chapter's first page opens with its title. */
  pages: string[][];
}

const esc = (s: string) => s.replace(/[\\()]/g, (c) => `\\${c}`);

/** One page's content stream: the first line at 20pt when it is a chapter's opening, the rest at 12pt with a 16pt leading. */
function content(lines: string[], opening: boolean): string {
  const out: string[] = [];
  let rest = lines;
  if (opening && lines.length) {
    out.push(`BT /F1 20 Tf 72 700 Td (${esc(lines[0]!)}) Tj ET`);
    rest = lines.slice(1);
  }
  out.push(`BT /F1 12 Tf 16 TL 72 ${opening ? 660 : 700} Td`);
  rest.forEach((l, i) => out.push(`${i ? 'T* ' : ''}(${esc(l)}) Tj`));
  out.push('ET');
  return out.join('\n');
}

/** The whole file, as bytes. */
export function makeBookPdf(chapters: readonly FixtureChapter[], title = ''): Uint8Array {
  const objects: string[] = [];
  const add = (body: string) => { objects.push(body); return objects.length; };
  const catalog = add('');
  const tree = add('');
  const outlines = add('');
  const font = add('<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica /Encoding /WinAnsiEncoding >>');
  const kids: number[] = [];
  const firsts: number[] = [];
  for (const ch of chapters) {
    ch.pages.forEach((lines, i) => {
      const stream = content(i === 0 ? [ch.title, ...lines] : lines, i === 0);
      const contents = add(`<< /Length ${stream.length} >>\nstream\n${stream}\nendstream`);
      const page = add(`<< /Type /Page /Parent ${tree} 0 R /Contents ${contents} 0 R /Resources << /Font << /F1 ${font} 0 R >> >> >>`);
      kids.push(page);
      if (i === 0) firsts.push(page);
    });
  }
  const items = chapters.map(() => add(''));
  chapters.forEach((ch, i) => {
    const links = [i > 0 ? `/Prev ${items[i - 1]} 0 R` : '', i + 1 < items.length ? `/Next ${items[i + 1]} 0 R` : ''].filter(Boolean).join(' ');
    objects[items[i]! - 1] = `<< /Title (${esc(ch.title)}) /Parent ${outlines} 0 R ${links} /Dest [${firsts[i]} 0 R /XYZ 0 792 0] >>`;
  });
  const info = title ? add(`<< /Title (${esc(title)}) >>`) : 0;
  objects[catalog - 1] = `<< /Type /Catalog /Pages ${tree} 0 R /Outlines ${outlines} 0 R /PageMode /UseOutlines >>`;
  objects[tree - 1] = `<< /Type /Pages /Kids [${kids.map((k) => `${k} 0 R`).join(' ')}] /Count ${kids.length} /MediaBox [0 0 612 792] >>`;
  objects[outlines - 1] = items.length
    ? `<< /Type /Outlines /First ${items[0]} 0 R /Last ${items[items.length - 1]} 0 R /Count ${items.length} >>`
    : '<< /Type /Outlines /Count 0 >>';

  let out = '%PDF-1.4\n';
  const offsets: number[] = [];
  objects.forEach((body, i) => {
    offsets.push(out.length);
    out += `${i + 1} 0 obj\n${body}\nendobj\n`;
  });
  const xref = out.length;
  out += `xref\n0 ${objects.length + 1}\n0000000000 65535 f \n`;
  for (const o of offsets) out += `${String(o).padStart(10, '0')} 00000 n \n`;
  out += `trailer\n<< /Size ${objects.length + 1} /Root ${catalog} 0 R${info ? ` /Info ${info} 0 R` : ''} >>\nstartxref\n${xref}\n%%EOF\n`;
  return new TextEncoder().encode(out);
}
