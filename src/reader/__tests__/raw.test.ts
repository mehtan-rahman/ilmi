// @vitest-environment jsdom
// The lossless pair: every raw block in the corpus, in the fixture book's
// chapters, and in the clipped pages goes through `rawToNode` and comes back
// byte for byte, or stays an atom; the shapes each way; the markers.

import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join, relative } from 'node:path';
import { describe, expect, it } from 'vitest';
import { parse } from '../../format/index.js';
import { clipPage, mapBook, type Epub } from '../../import/index.js';
import { allowLongSelectors } from '../../import/__tests__/long-selectors.js';
import { fromDoc, itemLines, markerNumber, nextMarker, nodeToRaw, numbered, rawToNode, schema, toDoc } from '../index.js';

allowLongSelectors();

const ROOT = join(import.meta.dirname, '../../..');
const CORPUS = join(ROOT, 'src/format/__tests__/corpus');
const EPUB = join(ROOT, 'src/import/__tests__/epub/three-chapters.json');
const PAGES = join(ROOT, 'src/import/__tests__/pages');

function walk(dir: string): string[] {
  const out: string[] = [];
  for (const name of readdirSync(dir).sort()) {
    const p = join(dir, name);
    if (statSync(p).isDirectory()) out.push(...walk(p));
    else if (name.endsWith('.md')) out.push(p);
  }
  return out;
}

const rawBlocks = (text: string): string[] => parse(text).doc.blocks.flatMap((b) => (b.kind === 'raw' ? [b.text] : []));

const sources: { label: string; raws: string[] }[] = [];
for (const p of walk(CORPUS)) sources.push({ label: relative(ROOT, p), raws: rawBlocks(readFileSync(p, 'utf8')) });
for (const ch of mapBook(JSON.parse(readFileSync(EPUB, 'utf8')) as Epub).chapters) sources.push({ label: `epub: ${ch.title}`, raws: rawBlocks(`${ch.text}\n`) });
for (const name of readdirSync(PAGES).sort()) {
  const r = clipPage(readFileSync(join(PAGES, name), 'utf8'), 'https://example.org/x');
  if (r) sources.push({ label: `page: ${name}`, raws: rawBlocks(`${r.text}\n`) });
}

describe('raw blocks through the pair', () => {
  it('covers the corpus, the book, and the pages', () => {
    expect(sources.flatMap((s) => s.raws).length).toBeGreaterThan(40);
    expect(sources.some((s) => s.label.startsWith('epub') && s.raws.length > 0)).toBe(true);
    expect(sources.some((s) => s.label.startsWith('page') && s.raws.length > 0)).toBe(true);
  });

  for (const s of sources) {
    if (!s.raws.length) continue;
    it(`${s.label}: every raw block comes back byte for byte, or stays an atom`, () => {
      for (const text of s.raws) {
        const node = rawToNode(text);
        if (node) expect(nodeToRaw(node), text).toBe(text);
        expect(fromDoc(toDoc([{ kind: 'raw', text }])), text).toEqual([{ kind: 'raw', text }]);
      }
    });
  }

  it('edits code, lists, quotes, and tables as themselves; rules, HTML, comments, and indented code stay atoms', () => {
    const kinds = new Map<string, number>();
    for (const t of sources.flatMap((s) => s.raws)) {
      const k = rawToNode(t)?.type.name ?? 'raw';
      kinds.set(k, (kinds.get(k) ?? 0) + 1);
    }
    expect(kinds.get('list')).toBeGreaterThanOrEqual(6);
    expect(kinds.get('quote')).toBeGreaterThanOrEqual(4);
    expect(kinds.get('code_block')).toBeGreaterThanOrEqual(5);
    expect(kinds.get('table')).toBeGreaterThanOrEqual(1);
    expect(kinds.get('raw')).toBeGreaterThanOrEqual(10);
    expect(rawToNode('| a | b |\n|---|---|\n| 1 | 2 |')?.type).toBe(schema.nodes.table);
    // a pipe table needs its delimiter row
    expect(rawToNode('| a | b |\n| 1 | 2 |')).toBeNull();
    expect(rawToNode('***')).toBeNull();
    expect(rawToNode('- - -')).toBeNull();
    expect(rawToNode('<div>\nx\n</div>')).toBeNull();
    expect(rawToNode('<!-- a comment -->')).toBeNull();
    expect(rawToNode('    indented\n    code')).toBeNull();
    // nothing between the fences: nothing to edit
    expect(rawToNode('```\n```')).toBeNull();
    expect(rawToNode('```js')).toBeNull();
  });

  it('reads a fence with its info string and close, an unterminated one to the end, a tilde or longer fence', () => {
    const n = rawToNode('```js title\nlet a;\n\nlet b;\n```')!;
    expect(n.type).toBe(schema.nodes.code_block);
    expect(n.attrs).toEqual({ fence: '```js title', close: '```', joined: false });
    expect(n.textContent).toBe('let a;\n\nlet b;');
    const open = rawToNode('~~~\nno close\n')!;
    expect(open.attrs).toEqual({ fence: '~~~', close: null, joined: false });
    expect(open.textContent).toBe('no close\n');
    expect(nodeToRaw(open)).toBe('~~~\nno close\n');
    // one empty line between the fences is kept as one
    expect(nodeToRaw(rawToNode('```\n\n```')!)).toBe('```\n\n```');
    expect(rawToNode('````md\n```\ninner\n```\n````')!.textContent).toBe('```\ninner\n```');
    expect(rawToNode('  ```\n  x\n  ```')!.attrs).toEqual({ fence: '  ```', close: '  ```', joined: false });
    // a backtick in a backtick fence's info string is not a fence
    expect(rawToNode('``` a`b\nx\n```')).toBeNull();
  });

  it('reads items with their own indentation, marker, task box, and continuation lines', () => {
    const list = rawToNode('- a\n  continued\n  - nested\n1) one\n* [ ] todo\n+ [x] done\n-')!;
    expect(list.type).toBe(schema.nodes.list);
    const items: unknown[] = [];
    list.forEach((it) => items.push([it.attrs.indent, it.attrs.marker, it.attrs.task, it.textContent]));
    expect(items).toEqual([['', '- ', null, 'a\ncontinued'], ['  ', '- ', null, 'nested'], ['', '1) ', null, 'one'], ['', '* ', ' ', 'todo'], ['', '+ ', 'x', 'done'], ['', '-', null, '']]);
    // a continuation line short of the content column, or reaching it with a tab: the block stays an atom
    expect(rawToNode('- a\n lazy')).toBeNull();
    expect(rawToNode('- a\n\tcontinued')).toBeNull();
    // `[ ]` with nothing after it is text, not a box
    expect(rawToNode('- [ ]')!.firstChild!.attrs.task).toBeNull();
    // math in an item is a chip and comes back as written
    const math = rawToNode('- so $x^2$ here')!;
    expect(math.firstChild!.childCount).toBe(3);
    expect(nodeToRaw(math)).toBe('- so $x^2$ here');
    expect(itemLines(math.firstChild!)).toBe('- so $x^2$ here');
  });

  it('reads a quote line by line, the prefix as written, a lazy line with none', () => {
    const q = rawToNode('> a\n>\n>  b\nlazy\n  > c')!;
    expect(q.type).toBe(schema.nodes.quote);
    const lines: unknown[] = [];
    q.forEach((l) => lines.push([l.attrs.prefix, l.textContent]));
    expect(lines).toEqual([['> ', 'a'], ['>', ''], ['> ', ' b'], ['', 'lazy'], ['  > ', 'c']]);
  });

  it('numbers a marker on and leaves a bullet alone', () => {
    expect(nextMarker('- ')).toBe('- ');
    expect(nextMarker('1. ')).toBe('2. ');
    expect(nextMarker('9)\t')).toBe('10)\t');
    expect(numbered('3. ', 7)).toBe('7. ');
    expect(markerNumber('* ')).toBeNull();
    expect(markerNumber('12) ')).toBe(12);
  });
});
