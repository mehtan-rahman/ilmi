// FORMAT.md §3 *Written notes* (milestone 82): `written` (a notebook's id,
// 32 lower-case hex), `paper` and `sheets`. Read, written canonically, kept
// raw with a diagnostic when they do not parse; `paper` and `sheets` mean
// nothing without `written`. The corpus file `mangled/written.md` shows
// each case.

import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { PAPERS, formatSheets, isWrittenId, meta, parse, parseSheets, serialize, setField } from '../index.js';

const CORPUS = join(import.meta.dirname, 'corpus');
const ID = '5b0c7e1a9d3f4e26b8a1c0d2e4f60718';

describe('written notes', () => {
  it('an id is 32 lower-case hex digits', () => {
    expect(isWrittenId(ID)).toBe(true);
    for (const bad of ['', ID.toUpperCase(), ID.slice(1), `${ID}0`, `${ID.slice(0, 31)}g`, `${ID}${ID}`]) expect(isWrittenId(bad), bad).toBe(false);
  });

  it('sheets are whole numbers from 1, a space between, none twice', () => {
    expect(parseSheets('1')).toEqual([1]);
    expect(parseSheets('1 2 3')).toEqual([1, 2, 3]);
    expect(parseSheets(' 4\t2   9 ')).toEqual([4, 2, 9]);
    for (const bad of ['', '0', '1 0', '1 1', '2 3 2', '1,2', '1.5', '-1', 'one', '01', '1 2 x', '1234567']) expect(parseSheets(bad), bad).toBeNull();
    expect(formatSheets([4, 2, 9])).toBe('4 2 9');
  });

  it('a notebook as the app writes it reads back and is byte-stable', () => {
    const text = `---\nwritten: ${ID}\npaper: ruled\nsheets: 1 2 3\npdf: ../books/alone.pdf\n---\n`;
    const { doc, diagnostics } = parse(text);
    expect(diagnostics).toEqual([]);
    const m = meta(doc);
    expect(m.written).toEqual({ id: ID, paper: 'ruled', sheets: [1, 2, 3] });
    expect(m.type).toBe('note');
    expect(m.pdf).toBe('../books/alone.pdf');
    expect(doc.blocks).toEqual([]);
    expect(serialize(doc)).toBe(text);
  });

  it('every paper is read; absent it is blank, and absent sheets are one', () => {
    for (const paper of PAPERS) expect(meta(parse(`---\nwritten: ${ID}\npaper: ${paper}\n---\n`).doc).written?.paper).toBe(paper);
    expect(meta(parse(`---\nwritten: ${ID}\n---\n`).doc).written).toEqual({ id: ID, paper: 'blank', sheets: [1] });
  });

  it('paper and sheets mean nothing without written, and are kept', () => {
    const text = '---\npaper: grid\nsheets: 1 2\n---\n\nA note.\n';
    const { doc, diagnostics } = parse(text);
    expect(diagnostics).toEqual([]);
    expect(meta(doc).written).toBeUndefined();
    expect(serialize(doc)).toBe(text);
  });

  it('a bad id is a raw line with a diagnostic, and the document an ordinary note', () => {
    const text = '---\nwritten: yes\npaper: ruled\n---\n';
    const { doc, diagnostics } = parse(text);
    expect(diagnostics.map((d) => d.message)).toEqual(['bad value for "written"']);
    expect(meta(doc).written).toBeUndefined();
    expect(serialize(doc)).toBe(text);
  });

  it('the body of a notebook is kept as written', () => {
    const text = `---\nwritten: ${ID}\n---\n\nLeft here by hand.\n\nfront ::: back\n`;
    const { doc } = parse(text);
    expect(meta(doc).written?.id).toBe(ID);
    expect(serialize(doc)).toBe(text);
  });

  it('the corpus file: each field read, the bad lines kept raw with a diagnostic each, written back canonically', () => {
    const text = readFileSync(join(CORPUS, 'mangled/written.md'), 'utf8');
    const { doc, diagnostics } = parse(text);
    const m = meta(doc);
    expect(m.written).toEqual({ id: ID, paper: 'ruled', sheets: [1, 2, 5] });
    expect(m.pdf).toBe('../vault/papers/two-pages.pdf');
    expect(diagnostics.map((d) => d.message)).toEqual([
      'bad value for "written"', 'bad value for "written"',
      'bad value for "paper"', '"paper" needs a value',
      'bad value for "sheets"', 'bad value for "sheets"', 'bad value for "sheets"', 'bad value for "sheets"',
    ]);
    const out = serialize(doc);
    expect(out).toContain(`---\nwritten: ${ID}\nwritten: ${ID.toUpperCase()}\nwritten: 5b0c7e1a\npaper: ruled\npaper: lined\npaper:\nsheets: 1 2 5\nsheets: 1 2 2\nsheets: 0 1\nsheets: 1, 2\nsheets: one\npdf: ../vault/papers/two-pages.pdf\n---\n`);
    expect(serialize(parse(out).doc)).toBe(out);
    expect(out).toContain('sheets: 1 2 in the body is prose.');
  });

  it('set, changed, and cleared in place', () => {
    const { doc } = parse(`---\nwritten: ${ID}\npaper: ruled\nsheets: 1\n---\n`);
    setField(doc, 'sheets', [1, 2]);
    setField(doc, 'paper', 'dotted');
    expect(serialize(doc)).toBe(`---\nwritten: ${ID}\npaper: dotted\nsheets: 1 2\n---\n`);
    setField(doc, 'sheets', [2]);
    expect(serialize(doc)).toContain('sheets: 2\n');
    setField(doc, 'paper', null);
    setField(doc, 'sheets', null);
    expect(serialize(doc)).toBe(`---\nwritten: ${ID}\n---\n`);
    expect(meta(doc).written).toEqual({ id: ID, paper: 'blank', sheets: [1] });
  });
});
