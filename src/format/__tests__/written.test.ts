// FORMAT.md §3 *Written notes* (milestone 82): `written` (a notebook's id,
// 32 lower-case hex), `paper` and `sheets`. Read, written canonically, kept
// raw with a diagnostic when they do not parse; `paper` and `sheets` mean
// nothing without `written`. The corpus file `mangled/written.md` shows
// each case. Milestone 85: a notebook's page setup (`paper-rule`,
// `paper-margin`, `paper-top` in points, `paper-size`, `paper-turn`,
// `pageless`), there only where the file says it.

import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { PAPERS, formatPoints, formatSheets, isWrittenId, meta, parse, parsePoints, parseSheets, serialize, setField } from '../index.js';

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

  it('a length of the page setup is points to a hundredth, within what it may be', () => {
    expect(parsePoints('24', [8, 72])).toBe(24);
    expect(parsePoints('24.5', [8, 72])).toBe(24.5);
    expect(parsePoints('30.25', [8, 72])).toBe(30.25);
    expect(parsePoints('8', [8, 72])).toBe(8);
    expect(parsePoints('72', [8, 72])).toBe(72);
    expect(parsePoints('0', [0, 300])).toBe(0);
    for (const bad of ['', '7.99', '72.01', '24.555', '-24', '+24', '24pt', '2e1', '.5', '24.', 'x', '1000', ' 24']) expect(parsePoints(bad, [8, 72]), bad).toBeNull();
    expect([24, 24.5, 30.1, 24.555, 24.004, 100].map(formatPoints)).toEqual(['24', '24.5', '30.1', '24.56', '24', '100']);
  });

  it('a notebook\'s page setup is read where the file says it, and is byte-stable', () => {
    const text = `---\nwritten: ${ID}\npaper: ruled\nsheets: 1 2\npaper-rule: 30\npaper-margin: 90\npaper-top: 100.5\npaper-size: a4\npaper-turn: landscape\npageless: true\n---\n`;
    const { doc, diagnostics } = parse(text);
    expect(diagnostics).toEqual([]);
    expect(meta(doc).written).toEqual({ id: ID, paper: 'ruled', sheets: [1, 2], rule: 30, margin: 90, top: 100.5, size: 'a4', turn: 'landscape', pageless: true });
    expect(serialize(doc)).toBe(text);
    // each alone: the rest are not there at all
    expect(meta(parse(`---\nwritten: ${ID}\npaper-margin: 72\n---\n`).doc).written).toEqual({ id: ID, paper: 'blank', sheets: [1], margin: 72 });
    expect(meta(parse(`---\nwritten: ${ID}\npageless: true\n---\n`).doc).written).toEqual({ id: ID, paper: 'blank', sheets: [1], pageless: true });
    // a length is written without zeros it does not need
    expect(serialize(parse(`---\nwritten: ${ID}\npaper-rule: 30.0\npaper-top: 0\n---\n`).doc)).toBe(`---\nwritten: ${ID}\npaper-rule: 30\npaper-top: 0\n---\n`);
  });

  it('a page setup the file says wrongly is kept raw with a diagnostic each, and is as if it were not there', () => {
    const text = `---\nwritten: ${ID}\npaper: ruled\nsheets: 1 2\npaper-rule: 2\npaper-rule: 30\npaper-margin: 400\npaper-top: x\npaper-size: letter\npaper-turn: portrait\npageless: false\npageless:\n---\n`;
    const { doc, diagnostics } = parse(text);
    expect(diagnostics.map((d) => d.message)).toEqual([
      'bad value for "paper-rule"', 'bad value for "paper-margin"', 'bad value for "paper-top"', 'bad value for "paper-size"', 'bad value for "paper-turn"', 'bad value for "pageless"', '"pageless" needs a value',
    ]);
    expect(meta(doc).written).toEqual({ id: ID, paper: 'ruled', sheets: [1, 2], rule: 30 });
    expect(serialize(doc)).toBe(text);
  });

  it('a page setup means nothing without written, and is kept', () => {
    const text = '---\npaper-rule: 30\npaper-size: a4\npageless: true\n---\n\nA note.\n';
    const { doc, diagnostics } = parse(text);
    expect(diagnostics).toEqual([]);
    expect(meta(doc).written).toBeUndefined();
    expect(serialize(doc)).toBe(text);
  });

  it('a paper colour and a line colour are six hex digits, written in lowercase after the rest of the page setup', () => {
    const text = `---\nwritten: ${ID}\npaper: ruled\nsheets: 1 2\npaper-rule: 30\npageless: true\npaper-color: #fbf6e9\npaper-line: #c9cdd2\n---\n`;
    const { doc, diagnostics } = parse(text);
    expect(diagnostics).toEqual([]);
    expect(meta(doc).written).toEqual({ id: ID, paper: 'ruled', sheets: [1, 2], rule: 30, pageless: true, color: '#fbf6e9', line: '#c9cdd2' });
    expect(serialize(doc)).toBe(text);
    // each alone; absent, there is none
    expect(meta(parse(`---\nwritten: ${ID}\npaper-color: #1c1c1e\n---\n`).doc).written).toEqual({ id: ID, paper: 'blank', sheets: [1], color: '#1c1c1e' });
    expect(meta(parse(`---\nwritten: ${ID}\npaper-line: #b5d2f2\n---\n`).doc).written).toEqual({ id: ID, paper: 'blank', sheets: [1], line: '#b5d2f2' });
    expect(meta(parse(`---\nwritten: ${ID}\n---\n`).doc).written).toEqual({ id: ID, paper: 'blank', sheets: [1] });
    // capitals are read, and written in lowercase
    const caps = parse(`---\nwritten: ${ID}\npaper-color: #FBF6E9\n---\n`).doc;
    expect(meta(caps).written!.color).toBe('#fbf6e9');
    expect(serialize(caps)).toBe(`---\nwritten: ${ID}\npaper-color: #fbf6e9\n---\n`);
    // set on a notebook with none, they go after what is there
    const fresh = parse(`---\nwritten: ${ID}\npaper: grid\nsheets: 1\n---\n`).doc;
    setField(fresh, 'pageless', true);
    setField(fresh, 'paper-color', '#fbf6e9');
    setField(fresh, 'paper-line', '#c9cdd2');
    expect(serialize(fresh)).toBe(`---\nwritten: ${ID}\npaper: grid\nsheets: 1\npageless: true\npaper-color: #fbf6e9\npaper-line: #c9cdd2\n---\n`);
    setField(fresh, 'paper-color', null);
    setField(fresh, 'paper-line', null);
    expect(meta(fresh).written).toEqual({ id: ID, paper: 'grid', sheets: [1], pageless: true });
    // without written they mean nothing, and are kept
    const note = '---\npaper-color: #fbf6e9\n---\n\nA note.\n';
    expect(meta(parse(note).doc).written).toBeUndefined();
    expect(serialize(parse(note).doc)).toBe(note);
  });

  it('a colour the file says wrongly is kept raw with a diagnostic, and the paper is as if it said none', () => {
    for (const bad of ['fbf6e9', '#fff', '#fbf6e9aa', 'cream', '#gggggg', 'rgb(1, 2, 3)', '# fbf6e9']) {
      const text = `---\nwritten: ${ID}\npaper: ruled\npaper-color: ${bad}\npaper-line: ${bad}\n---\n`;
      const { doc, diagnostics } = parse(text);
      expect(diagnostics.map((d) => d.message), bad).toEqual(['bad value for "paper-color"', 'bad value for "paper-line"']);
      expect(meta(doc).written, bad).toEqual({ id: ID, paper: 'ruled', sheets: [1] });
      expect(serialize(doc), bad).toBe(text);
    }
  });

  it('a page setup is set, changed and cleared in place', () => {
    const { doc } = parse(`---\nwritten: ${ID}\npaper: ruled\nsheets: 1\n---\n`);
    setField(doc, 'paper-rule', 30);
    setField(doc, 'paper-margin', 90);
    setField(doc, 'paper-top', 100);
    setField(doc, 'paper-size', 'a4');
    setField(doc, 'paper-turn', 'landscape');
    setField(doc, 'pageless', true);
    const text = `---\nwritten: ${ID}\npaper: ruled\nsheets: 1\npaper-rule: 30\npaper-margin: 90\npaper-top: 100\npaper-size: a4\npaper-turn: landscape\npageless: true\n---\n`;
    expect(serialize(doc)).toBe(text);
    expect(meta(doc).written).toEqual({ id: ID, paper: 'ruled', sheets: [1], rule: 30, margin: 90, top: 100, size: 'a4', turn: 'landscape', pageless: true });
    setField(doc, 'paper-rule', 18.5);
    expect(serialize(doc)).toContain('paper-rule: 18.5\n');
    for (const key of ['paper-rule', 'paper-margin', 'paper-top', 'paper-size', 'paper-turn', 'pageless'] as const) setField(doc, key, null);
    expect(serialize(doc)).toBe(`---\nwritten: ${ID}\npaper: ruled\nsheets: 1\n---\n`);
    expect(meta(doc).written).toEqual({ id: ID, paper: 'ruled', sheets: [1] });
  });
});
