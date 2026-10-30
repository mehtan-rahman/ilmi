// @vitest-environment jsdom
// The editor's rest (milestone 41): tables edited as tables and written
// back as the normalized pipe table, code coloured by its language and the
// language changed on the fence, headings folded as view state. Every
// edit checks the Markdown written back, and that the file read again is
// what the editor holds.

import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { EditorState, NodeSelection, TextSelection, type Command } from 'prosemirror-state';
import { describe, expect, it } from 'vitest';
import { parse, serialize } from '../../format/index.js';
import {
  addColumn, addRow, alignColumn, cellAt, cellDown, codeDecorations, codeLang, codeTokens, deleteColumn, deleteRow, directionDecorations, findKey, flatText, foldKey,
  foldedKeys, foldsHiding, fromDoc, makeState, nextCell, nodeToRaw, pasteInto, prevCell, rawToNode, readTable, rowBelow, schema, sections, setCodeLang, tableOf,
  toDoc, tokensOfHtml, withLang, writeTable, type FoldMeta,
} from '../index.js';

const ROOT = join(import.meta.dirname, '../../..');
const SAMPLE = join(ROOT, 'samples/double-major');
const live = { frozen: () => false, pos: null };

const ed = (md: string, folds?: string[]): EditorState => makeState(parse(md).doc.blocks, { ...live, ...(folds ? { folds } : {}) });

function md(state: EditorState): string {
  const blocks = fromDoc(state.doc);
  const r = parse('');
  r.doc.blocks = blocks;
  const out = serialize(r.doc);
  expect(parse(out).doc.blocks).toEqual(blocks);
  expect(fromDoc(toDoc(parse(out).doc.blocks))).toEqual(blocks);
  return out.replace(/\n$/, '');
}

function at(state: EditorState, needle: string, offset = 0): number {
  let found = -1;
  state.doc.descendants((node, pos) => {
    if (found >= 0) return false;
    if (!node.isTextblock) return true;
    const i = flatText(node).indexOf(needle);
    if (i >= 0) found = pos + 1 + i + offset;
    return false;
  });
  if (found < 0) throw new Error(`no "${needle}"`);
  return found;
}

const caret = (state: EditorState, needle: string, offset = 0) => state.apply(state.tr.setSelection(TextSelection.create(state.doc, at(state, needle, offset))));

function run(state: EditorState, cmd: Command): EditorState {
  let next = state;
  expect(cmd(state, (tr) => { next = state.apply(tr); })).toBe(true);
  return next;
}

const selected = (state: EditorState) => state.doc.textBetween(state.selection.from, state.selection.to);
const type = (state: EditorState, text: string) => state.apply(state.tr.insertText(text));

function walk(dir: string): string[] {
  const out: string[] = [];
  for (const name of readdirSync(dir).sort()) {
    const p = join(dir, name);
    if (statSync(p).isDirectory()) { if (!name.startsWith('.')) out.push(...walk(p)); } else if (name.endsWith('.md')) out.push(p);
  }
  return out;
}

const tables = [...walk(SAMPLE), ...walk(join(ROOT, 'src/format/__tests__/corpus'))]
  .flatMap((p) => parse(readFileSync(p, 'utf8')).doc.blocks.flatMap((b) => (b.kind === 'raw' && readTable(b.text) ? [{ p, text: b.text }] : [])));

const SIMPLE = 'Before.\n\n| a | b |\n| --- | ---: |\n| 1 | 2 |\n| 3 | 4 |\n\nAfter.';

describe('tables edited as tables', () => {
  it('every pipe table of the sample and the corpus is a table node, comes back byte for byte, and its normalized form reads back to the same cells', () => {
    expect(tables.length).toBeGreaterThanOrEqual(20);
    for (const { p, text } of tables) {
      const node = rawToNode(text);
      expect(node?.type, p).toBe(schema.nodes.table);
      expect(nodeToRaw(node!), p).toBe(text);
      const t = tableOf(node!);
      const norm = writeTable(t);
      expect(readTable(norm), p).toEqual(t);
      expect(writeTable(readTable(norm)!), p).toBe(norm);
    }
  });

  it('an edit to a cell of the sample\'s verb-forms table changes that line only', () => {
    const file = readFileSync(join(SAMPLE, 'courses/spring-2026/arab-302-morphology/verb-forms.md'), 'utf8');
    let s = makeState(parse(file).doc.blocks, live);
    s = caret(s, 'causative, intensive, denominative', 'causative, intensive, denominative'.length);
    s = type(s, ', estimative');
    const before = md(makeState(parse(file).doc.blocks, live)).split('\n');
    const after = md(s).split('\n');
    expect(after.length).toBe(before.length);
    const changed = after.flatMap((l, i) => (l === before[i] ? [] : [l]));
    expect(changed).toEqual(['| II | فَعَّلَ | يُفَعِّلُ | تَفْعِيل | مُفَعِّل | مُفَعَّل | causative, intensive, denominative, estimative |']);
  });

  it('a table written by hand comes back as written until a cell changes, then as the normalized pipe table, its alignment kept', () => {
    let s = ed('|a|b|\n|:-|-:|\n|1|2|');
    expect(md(s)).toBe('|a|b|\n|:-|-:|\n|1|2|');
    s = type(caret(s, '1', 1), 'x');
    expect(md(s)).toBe('| a | b |\n| :--- | ---: |\n| 1x | 2 |');
    // a pipe typed in a cell is escaped, and reads back as the same cell
    s = type(caret(s, '2', 1), ' | 3');
    expect(md(s)).toBe('| a | b |\n| :--- | ---: |\n| 1x | 2 \\| 3 |');
    expect(tableOf(rawToNode(md(s))!).rows).toEqual([['1x', '2 | 3']]);
  });

  it('Tab and ⇧Tab step across the cells with the text selected; Tab from the last cell adds a row', () => {
    let s = caret(ed(SIMPLE), 'a', 1);
    s = run(s, nextCell);
    expect(selected(s)).toBe('b');
    s = run(s, nextCell);
    expect(selected(s)).toBe('1');
    expect(cellAt(s)).toMatchObject({ row: 1, col: 0 });
    s = run(s, prevCell);
    expect(selected(s)).toBe('b');
    s = run(s, prevCell);
    s = run(s, prevCell);
    expect(selected(s)).toBe('a');
    s = caret(s, '4', 1);
    s = run(s, nextCell);
    expect(cellAt(s)).toMatchObject({ row: 3, col: 0, rows: 4 });
    s = type(s, '5');
    expect(md(s)).toBe('Before.\n\n| a | b |\n| --- | ---: |\n| 1 | 2 |\n| 3 | 4 |\n| 5 |  |\n\nAfter.');
    // outside a table Tab is the list's
    expect(nextCell(caret(s, 'After'), undefined)).toBe(false);
  });

  it('⏎ moves down a column; from the last row it leaves the table; ⌘⏎ adds a row under the caret\'s', () => {
    let s = caret(ed(SIMPLE), 'b', 1);
    s = run(s, cellDown);
    expect(cellAt(s)).toMatchObject({ row: 1, col: 1 });
    s = run(s, cellDown);
    expect(cellAt(s)).toMatchObject({ row: 2, col: 1 });
    s = run(s, cellDown);
    expect(cellAt(s)).toBeNull();
    expect(s.selection.$from.parent.textContent).toBe('After.');
    // a table last in the page: a paragraph is made after it
    let t = caret(ed('| a |\n| --- |\n| 1 |'), '1', 1);
    t = run(t, cellDown);
    expect(t.selection.$from.parent.type).toBe(schema.nodes.paragraph);
    expect(t.doc.childCount).toBe(2);
    s = run(caret(s, '1', 1), rowBelow);
    expect(cellAt(s)).toMatchObject({ row: 2, col: 0, rows: 4 });
    expect(md(s)).toContain('| 1 | 2 |\n|  |  |\n| 3 | 4 |');
  });

  it('a row and a column added at the edges and anywhere, deleted, a column aligned; the lines checked after each', () => {
    let s = ed(SIMPLE);
    const pos = () => s.doc.child(0).nodeSize;
    s = run(s, addRow(pos(), 3));
    expect(md(s)).toContain('| 3 | 4 |\n|  |  |\n\nAfter.');
    s = run(s, addColumn(pos(), 2));
    expect(md(s)).toBe('Before.\n\n| a | b |  |\n| --- | ---: | --- |\n| 1 | 2 |  |\n| 3 | 4 |  |\n|  |  |  |\n\nAfter.');
    expect(cellAt(s)).toMatchObject({ row: 0, col: 2 });
    s = type(s, 'c');
    s = run(s, alignColumn(pos(), 2, 'center'));
    expect(md(s).split('\n')[2]).toBe('| a | b | c |');
    expect(md(s).split('\n')[3]).toBe('| --- | ---: | :---: |');
    s = run(s, deleteRow(pos(), 3));
    expect(md(s)).toBe('Before.\n\n| a | b | c |\n| --- | ---: | :---: |\n| 1 | 2 |  |\n| 3 | 4 |  |\n\nAfter.');
    s = run(s, deleteColumn(pos(), 0));
    expect(md(s)).toBe('Before.\n\n| b | c |\n| ---: | :---: |\n| 2 |  |\n| 4 |  |\n\nAfter.');
    // the header deleted: the row under it is the header, the alignment stays with its column
    s = run(s, deleteRow(pos(), 0));
    expect(md(s)).toBe('Before.\n\n| 2 |  |\n| ---: | :---: |\n| 4 |  |\n\nAfter.');
    s = run(s, addColumn(pos(), 0));
    expect(md(s)).toContain('|  | 2 |  |\n| --- | ---: | :---: |');
    // the last column or row takes the table with it
    let one = ed('| a |\n| --- |\n| 1 |\n\nAfter.');
    one = run(one, deleteColumn(0, 0));
    expect(md(one)).toBe('After.');
  });

  it('a cell\'s direction follows 36\'s rule: Arabic cells right to left, the English header left to right, a cell with no letter the table\'s', () => {
    const s = ed('| form | perfect | n |\n| --- | --- | --- |\n| II | فَعَّلَ | 2 |');
    const dirs: string[] = [];
    directionDecorations(s.doc).find().forEach((d) => {
      const node = s.doc.nodeAt(d.from);
      if (node?.type === schema.nodes.table_cell) dirs.push(`${node.textContent}:${(d as unknown as { type: { attrs: { dir: string } } }).type.attrs.dir}`);
    });
    expect(dirs).toEqual(['form:ltr', 'perfect:ltr', 'n:ltr', 'II:ltr', 'فَعَّلَ:rtl', '2:ltr']);
  });

  it('a paste into a cell goes in as one line', () => {
    let s = caret(ed(SIMPLE), '1', 1);
    s = s.apply(pasteInto(s, { html: '', text: 'two\nlines', plain: false })!);
    expect(md(s)).toContain('| 1two lines | 2 |');
  });
});

describe('code coloured by its language', () => {
  it('reads the highlighter\'s HTML back into runs over the code\'s own text, entities counted as one', () => {
    expect(tokensOfHtml('<span class="hljs-keyword">if</span> a &lt; <span class="hljs-number">1</span>')).toEqual([
      { from: 0, to: 2, cls: 'hljs-keyword' }, { from: 7, to: 8, cls: 'hljs-number' },
    ]);
    const code = 'def f(x):\n    return x < 2 and "a&b"  # done';
    for (const t of codeTokens(code, 'py')) expect(t.to).toBeLessThanOrEqual(code.length);
    const words = codeTokens(code, 'py').map((t) => [code.slice(t.from, t.to), t.cls]);
    expect(words).toContainEqual(['def', 'hljs-keyword']);
    expect(words).toContainEqual(['"a&b"', 'hljs-string']);
    expect(words).toContainEqual(['# done', 'hljs-comment']);
  });

  it('bundles python, julia, matlab, c, c++, rust, js, ts, bash, latex and json, by their names and the usual short ones', () => {
    const samples: [string, string][] = [
      ['python', 'import numpy as np'], ['jl', 'function f(x)\n  return 2x\nend'], ['matlab', 'function y = f(x)\n  y = 2*x; % twice\nend'],
      ['c', 'int main(void) { return 0; }'], ['c++', 'template <class T> T id(T x) { return x; }'], ['rs', 'fn main() { let x = 1; }'],
      ['js', 'const a = 1;'], ['ts', 'let a: number = 1;'], ['sh', 'for f in *.md; do echo "$f"; done'], ['tex', '\\begin{equation} x \\end{equation}'],
      ['json', '{"a": 1}'],
    ];
    for (const [lang, code] of samples) expect(codeTokens(code, lang).length, lang).toBeGreaterThan(0);
    expect(codeLang('Python')).toBe('python');
    expect(codeLang('cpp')).toBe('cpp');
    expect(codeLang('haskell')).toBeNull();
    expect(codeTokens('main = print 1', 'haskell')).toEqual([]);
  });

  it('decorates a code block\'s text without changing it, and nothing else', () => {
    const s = ed('Prose with def in it.\n\n```python\ndef f():\n    return 1\n```\n\n```\ndef plain():\n```');
    const decos = codeDecorations(s.doc).find();
    expect(decos.length).toBeGreaterThan(0);
    const code = s.doc.child(1);
    const start = s.doc.child(0).nodeSize + 1;
    for (const d of decos) {
      expect(d.from).toBeGreaterThanOrEqual(start);
      expect(d.to).toBeLessThanOrEqual(start + code.content.size);
    }
    expect(md(s)).toBe('Prose with def in it.\n\n```python\ndef f():\n    return 1\n```\n\n```\ndef plain():\n```');
  });

  it('the picker writes the language on the fence, the rest of the info string kept', () => {
    expect(withLang('```py', 'julia')).toBe('```julia');
    expect(withLang('```', 'python')).toBe('```python');
    expect(withLang('~~~ py title="a"', 'rust')).toBe('~~~rust title="a"');
    expect(withLang('```py', '')).toBe('```');
    let s = ed('```py\nprint(1)\n```');
    s = run(s, setCodeLang(0, 'julia'));
    expect(md(s)).toBe('```julia\nprint(1)\n```');
    expect(codeDecorations(s.doc).find().length).toBeGreaterThan(0);
    s = run(s, setCodeLang(0, ''));
    expect(md(s)).toBe('```\nprint(1)\n```');
    expect(setCodeLang(0, 'x')(ed('Prose.'), undefined)).toBe(false);
  });
});

const NOTES = '# notes\n\nIntro.\n\n## one\n\nA.\n\nq :: a\n\n### one, deeper\n\nB.\n\n## two\n\nC.\n\n## one\n\nD.';

describe('headings folded', () => {
  it('a heading\'s section runs to the next heading of its level or above; a repeated heading has its own key', () => {
    const s = ed(NOTES);
    expect(sections(s.doc).map((x) => [x.key, x.blocks, x.cards])).toEqual([
      ['1 notes', 10, 1], ['2 one', 4, 1], ['3 one, deeper', 1, 0], ['2 two', 1, 0], ['2 one (2)', 1, 0],
    ]);
  });

  it('a fold hides its section by decoration only, is kept by key, and is never written', () => {
    let s = ed(NOTES);
    const one = sections(s.doc)[1]!;
    s = s.apply(s.tr.setMeta(foldKey, { toggle: one.pos } satisfies FoldMeta));
    expect(foldedKeys(s)).toEqual(['2 one']);
    const hidden = foldKey.getState(s)!.decos.find().filter((d) => (d as unknown as { type: { attrs?: { class?: string } } }).type.attrs?.class === 'fold-hidden');
    expect(hidden.map((d) => s.doc.nodeAt(d.from)!.textContent)).toEqual(['A.', 'q :: a', 'one, deeper', 'B.']);
    expect(md(s)).toBe(NOTES);
    // the same keys on a new state: the same fold; an unknown key is let go
    const again = ed(NOTES, ['2 one', '2 nowhere']);
    expect(foldKey.getState(again)!.folded).toEqual([one.pos]);
    s = s.apply(s.tr.setMeta(foldKey, { toggle: one.pos } satisfies FoldMeta));
    expect(foldedKeys(s)).toEqual([]);
  });

  it('a folded heading stays folded as its text or the page above it changes, and goes with the heading', () => {
    let s = ed(NOTES, ['2 one']);
    s = type(caret(s, 'one', 3), ' again');
    expect(foldedKeys(s)).toEqual(['2 one again']);
    s = type(caret(s, 'Intro', 0), 'An ');
    expect(foldedKeys(s)).toEqual(['2 one again']);
    const head = sections(s.doc)[1]!;
    s = s.apply(s.tr.delete(head.pos, head.from));
    expect(foldedKeys(s)).toEqual([]);
  });

  it('the caret, a card selected, or the current find match inside a folded section opens it', () => {
    let s = ed(NOTES, ['2 one', '2 two']);
    s = caret(s, 'B.');
    expect(foldedKeys(s)).toEqual(['2 two']);
    s = ed(NOTES, ['1 notes']);
    let card = -1;
    s.doc.forEach((n, pos) => { if (n.type === schema.nodes.card) card = pos; });
    s = s.apply(s.tr.setSelection(NodeSelection.create(s.doc, card)));
    expect(foldedKeys(s)).toEqual([]);
    s = ed(NOTES, ['2 two']);
    expect(foldsHiding(s, at(s, 'C.')).map((f) => f.key)).toEqual(['2 two']);
    s = s.apply(s.tr.setMeta(findKey, { query: 'C.', from: 0 }));
    expect(foldedKeys(s)).toEqual([]);
  });
});
