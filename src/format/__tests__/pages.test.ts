// FORMAT.md §3 `pages` (milestone 46): which pages of its PDF a document
// is, so a chapter of a book that landed as a notebook is its pages of the
// one file. Read, written canonically, kept raw with a diagnostic when it
// does not parse; the corpus file `mangled/pdf-pages.md` shows each case.

import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { meta, parse, parsePages, formatPages, serialize, setField } from '../index.js';

const CORPUS = join(import.meta.dirname, 'corpus');

describe('pages', () => {
  it('reads a range and one page; refuses what is not one', () => {
    expect(parsePages('12-40')).toEqual({ first: 12, last: 40 });
    expect(parsePages('12 – 40')).toEqual({ first: 12, last: 40 });
    expect(parsePages('7')).toEqual({ first: 7, last: 7 });
    for (const bad of ['0-3', '9-3', '', 'two', '3-', '-3', '1.5', '3-4-5']) expect(parsePages(bad), bad).toBeNull();
    expect(formatPages({ first: 12, last: 40 })).toBe('12-40');
    expect(formatPages({ first: 2, last: 2 })).toBe('2');
  });

  it('the corpus file: the field read, the bad lines kept raw with a diagnostic each, written back canonically', () => {
    const text = readFileSync(join(CORPUS, 'mangled/pdf-pages.md'), 'utf8');
    const { doc, diagnostics } = parse(text);
    const m = meta(doc);
    expect(m.pages).toEqual({ first: 2, last: 2 });
    expect(m.pdf).toBe('../vault/papers/two-pages.pdf');
    expect(diagnostics.map((d) => d.message)).toEqual(['bad value for "pages"', 'bad value for "pages"', '"pages" needs a value', 'bad value for "pages"']);
    const out = serialize(doc);
    expect(out).toContain('pdf: ../vault/papers/two-pages.pdf\npages: 2\npages: 0-1\npages: 9-3\npages:\npages: two\n');
    expect(serialize(parse(out).doc)).toBe(out);
    expect(out).toContain('pages: 3-4 in the body is prose.');
  });

  it('set, changed, and cleared in place', () => {
    const { doc } = parse('---\ntype: source\npdf: ../book.pdf\n---\n\n## text\n');
    setField(doc, 'pages', { first: 3, last: 11 });
    expect(serialize(doc)).toBe('---\ntype: source\npdf: ../book.pdf\npages: 3-11\n---\n\n## text\n');
    setField(doc, 'pages', { first: 3, last: 12 });
    expect(serialize(doc)).toContain('pages: 3-12\n');
    setField(doc, 'pages', null);
    expect(serialize(doc)).not.toContain('pages');
  });
});
