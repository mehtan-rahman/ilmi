// @vitest-environment jsdom
// A book in EPUB: the fixture `three-chapters.json` (what the Rust side
// reads out of `three-chapters.epub`, both written by `npm run
// fixture:epub`) mapped to chapter sources that parse with no diagnostics,
// checked line for line; the cover skipped, the untitled chapter named from
// its heading, the figure mark in place, the folder's names in order; the
// reduction's own cases; and the files a vault writes from them.

import { promises as fsp } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';
import { meta, parse } from '../../format/index.js';
import { Vault } from '../../vault/index.js';
import { nodeFs } from '../../vault/node-fs.js';
import { mapBook, noBookDropped, position, readingLabel, reduceChapter, withoutTitleHeading, type Epub, type EpubItem } from '../epub.js';

const FIXTURES = join(import.meta.dirname, 'epub');
const book: Epub = JSON.parse(await fsp.readFile(join(FIXTURES, 'three-chapters.json'), 'utf8')) as Epub;

const page = (body: string) => `<?xml version="1.0" encoding="UTF-8"?><html xmlns="http://www.w3.org/1999/xhtml" xmlns:epub="http://www.idpf.org/2007/ops"><head><title>x</title></head><body>${body}</body></html>`;
const item = (html: string, over: Partial<EpubItem> = {}): EpubItem => ({ href: 'x.xhtml', html, title: null, nav: false, ...over });
const WORDS = Array.from({ length: 40 }, (_v, i) => `word${i}`).join(' ');

describe('the fixture', () => {
  it('is the three-chapter book the Rust test builds, beside its JSON', async () => {
    const bytes = await fsp.readFile(join(FIXTURES, 'three-chapters.epub'));
    expect(bytes.subarray(0, 2).toString('latin1')).toBe('PK');
    // the spec's first entry: `mimetype`, stored
    expect(bytes.subarray(30, 38).toString('latin1')).toBe('mimetype');
    expect(bytes.subarray(38, 58).toString('latin1')).toBe('application/epub+zip');
    expect(book.title).toBe('The Small Book');
    expect(book.creators).toEqual(['A. Author']);
    expect(book.language).toBe('en');
    expect(book.items.map((i) => [i.href, i.title, i.nav])).toEqual([
      ['cover.xhtml', null, false],
      ['nav.xhtml', null, true],
      ['ch1.xhtml', 'One: the premise', false],
      ['ch2.xhtml', null, false],
      ['ch3.xhtml', 'Three: the close', false],
    ]);
    expect(book.images).toEqual(['images/map.png', 'images/orn.png']);
  });
});

describe('reduceChapter', () => {
  it('keeps headings, emphasis, lists, and quotes; reduces links to their text', () => {
    const d = noBookDropped();
    const r = reduceChapter(page('<h1>A title</h1><p>Plain <em>em</em>, <strong>strong</strong>, <i> i </i>and <b>b</b>; <a href="y.xhtml">a link</a>.</p><ul><li>one</li><li>two</li></ul><blockquote><p>quoted</p></blockquote><h2>Sub</h2><p>after</p>'), d);
    expect(r.text).toBe('# A title\n\nPlain *em*, **strong**, *i* and **b**; a link.\n\n- one\n- two\n\n> quoted\n\n## Sub\n\nafter');
    expect(r.heading).toBe('A title');
    expect(d).toEqual(noBookDropped());
  });

  it('nests marks innermost first and leaves an empty emphasis alone', () => {
    const r = reduceChapter(page('<p><em>both <strong>ways</strong></em> and <em> </em>none</p>'), noBookDropped());
    expect(r.text).toBe('*both **ways*** and none');
  });

  it('drops footnote back-references, by type, by role, or by their glyph', () => {
    const d = noBookDropped();
    const r = reduceChapter(page('<p>Text<sup><a epub:type="noteref" href="#fn1">1</a></sup></p><aside epub:type="footnote" id="fn1"><p>A note. <a epub:type="backlink" href="#r1">↩</a> <a role="doc-backlink" href="#r1">back</a> <a href="#r1">↑</a> <a href="#r1">see above</a></p></aside>'), d);
    expect(r.text).toBe('Text1\n\nA note. see above');
  });

  it('marks an image with alt text as a figure and drops one without, counting both', () => {
    const d = noBookDropped();
    const r = reduceChapter(page('<p>Before.</p><figure><img src="a.png" alt=" A map "/><figcaption>Cap.</figcaption></figure><p>Mid <img src="b.png"/> text.</p><svg><title>An ornament</title><rect/></svg><p>After.</p>'), d);
    expect(r.text).toBe('Before.\n\n[figure: A map]\n\nCap.\n\nMid text.\n\n[figure: An ornament]\n\nAfter.');
    expect(d).toEqual({ images: 3, figures: 2, short: 0 });
    // the mark is an editorial mark, not an annotation: the format reads it as prose
    const { doc, diagnostics } = parse(`${r.text}\n`);
    expect(diagnostics).toEqual([]);
    expect(doc.blocks.map((b) => b.kind)).toEqual(['paragraph', 'paragraph', 'paragraph', 'paragraph', 'paragraph', 'paragraph']);
  });

  it('reads the first heading at any level, or none', () => {
    expect(reduceChapter(page('<p>x</p><h3>Deep</h3>'), noBookDropped()).heading).toBe('Deep');
    expect(reduceChapter(page('<p>x</p>'), noBookDropped()).heading).toBeNull();
    expect(reduceChapter(page('<h1>  </h1><p>x</p>'), noBookDropped()).heading).toBeNull();
  });
});

describe('withoutTitleHeading', () => {
  it('drops the first heading block when it reads as the title, whatever the case or punctuation', () => {
    expect(withoutTitleHeading('# One: the premise\n\nBody.', 'One: the premise')).toBe('Body.');
    expect(withoutTitleHeading('## ONE, THE PREMISE\n\nBody.', 'One: the premise')).toBe('Body.');
    expect(withoutTitleHeading('1\n\n# The premise\n\nBody.', 'The premise')).toBe('1\n\nBody.');
    expect(withoutTitleHeading('# Chapter 1: The premise\n\nBody.', 'Chapter 1')).toBe('# Chapter 1: The premise\n\nBody.');
    expect(withoutTitleHeading('A.\n\nB.\n\nC.\n\n# Late\n\nD.', 'Late')).toBe('A.\n\nB.\n\nC.\n\n# Late\n\nD.');
    expect(withoutTitleHeading('Body only.', 'Title')).toBe('Body only.');
  });
});

describe('mapBook', () => {
  const m = mapBook(book);

  it('lands the three chapters in order, the cover and the nav skipped, the names numbered', () => {
    expect(m.title).toBe('The Small Book');
    expect(m.creators).toEqual(['A. Author']);
    expect(m.chapters.map((c) => [c.n, c.name, c.title])).toEqual([
      [1, '01 One the premise', 'One: the premise'],
      [2, '02 Two the middle', 'Two: the middle'],
      [3, '03 Three the close', 'Three: the close'],
    ]);
    expect(m.dropped).toEqual({ images: 2, figures: 1, short: 1 });
    expect(m.words).toBe(m.chapters.reduce((n, c) => n + c.words, 0));
    expect(m.words).toBeGreaterThan(150);
    expect(m.minutes).toBe(1);
  });

  it('writes the first chapter: heading dropped, emphasis, list, quote, link text, no back-reference', () => {
    expect(m.chapters[0]!.text.split('\n')).toEqual([
      'Every review is a *small wager* against forgetting. The wager has a cost, the minutes spent, and a payoff that compounds: each recall pushes the next due date further out, so a few well-timed reviews buy years of retention for the price of an afternoon.1',
      '',
      'The **minimum information principle** says the same thing from the other side; see the close.',
      '',
      '- cost: the minutes',
      '- payoff: the years',
      '',
      '> Familiarity is cheap. Retrieval is the thing that lasts.',
      '',
      'A note on the wager, for the curious.',
    ]);
  });

  it('writes the second chapter, named from its heading, with the figure mark where the image stood', () => {
    expect(m.chapters[1]!.text.split('\n')).toEqual([
      'A good system spends your attention the way a careful gardener spends water: not evenly, but where the curve is about to cross the floor. Most learners review everything, constantly, and confuse the warm feeling of familiarity with the harder fact of retrieval.',
      '',
      '[figure: A map of the valley]',
      '',
      'The valley, surveyed.',
      '',
      'What follows is the middle of the argument, which is where most books lose their readers and most readers lose their place.',
    ]);
  });

  it('writes the third chapter: the anchored toc title, the bare image gone, a later heading kept', () => {
    expect(m.chapters[2]!.text.split('\n')).toEqual([
      'Atomicity sounds easy and is in fact the hardest discipline in the practice. A card that asks two things teaches neither; a card that asks one thing, in the fewest words that still make sense, is remembered for years.',
      '',
      'So the book closes where it opened: with the wager, now priced.',
      '',
      '### A last word',
      '',
      'Read on.',
    ]);
  });

  it('parses every chapter with no diagnostics', () => {
    for (const c of m.chapters) {
      const { doc, diagnostics } = parse(`${c.text}\n`);
      expect(diagnostics).toEqual([]);
      expect(doc.blocks.length).toBeGreaterThan(0);
    }
  });

  it('names a chapter with neither toc title nor heading by its position, and widens the number past 99', () => {
    const many: Epub = { title: '  A Long   Book ', creators: ['', ' Someone '], language: '', images: [], items: Array.from({ length: 101 }, (_v, i) => item(page(`<p>${WORDS} ${i}</p>`))) };
    const r = mapBook(many);
    expect(r.title).toBe('A Long Book');
    expect(r.creators).toEqual(['Someone']);
    expect(r.chapters).toHaveLength(101);
    expect(r.chapters[0]!.title).toBe('chapter 001');
    expect(r.chapters[0]!.name).toBe('001 chapter 001');
    expect(r.chapters[100]!.name).toBe('101 chapter 101');
    expect(position(7, 12)).toBe('07');
    expect(position(7, 100)).toBe('007');
  });

  it('skips the nav document and the short pages, counting the pages', () => {
    const r = mapBook({ ...book, items: [item(page(`<h1>Contents</h1><p>${WORDS}</p>`), { nav: true }), item(page('<p>Copyright 2026. All rights reserved.</p>')), item(page(`<p>${WORDS}</p>`), { title: 'Only' })] });
    expect(r.chapters.map((c) => c.name)).toEqual(['01 Only']);
    expect(r.dropped.short).toBe(1);
  });

  it('keeps a heading that is not the title, and a toc title over the heading', () => {
    const r = mapBook({ ...book, items: [item(page(`<h1>Chapter 1: The premise</h1><p>${WORDS}</p>`), { title: 'Chapter 1' })] });
    expect(r.chapters[0]!.title).toBe('Chapter 1');
    expect(r.chapters[0]!.text.startsWith('# Chapter 1: The premise\n\n')).toBe(true);
  });

  it('says the reading time in minutes under an hour, else in hours', () => {
    expect(readingLabel(0)).toBe('~1 min');
    expect(readingLabel(1)).toBe('~1 min');
    expect(readingLabel(45)).toBe('~45 min');
    expect(readingLabel(60)).toBe('~1 h');
    expect(readingLabel(100)).toBe('~1.5 h');
    expect(readingLabel(620)).toBe('~10.5 h');
  });
});

describe('into a vault', () => {
  const scratch: string[] = [];
  afterEach(async () => {
    for (const d of scratch.splice(0)) await fsp.rm(d, { recursive: true, force: true });
  });

  it('lands the book as a folder of frozen sources named in order, each titled', async () => {
    const dir = await fsp.mkdtemp(join(tmpdir(), 'ilmi-epub-'));
    scratch.push(dir);
    const vault = await Vault.open(nodeFs, dir);
    const m = mapBook(book);
    const folder = await vault.createFolder('', m.title);
    expect(folder).toBe('The Small Book');
    const paths: string[] = [];
    for (const c of m.chapters) paths.push(await vault.importDoc(folder, { title: c.title, name: c.name, text: c.text, today: '2026-10-18' }));
    expect(paths).toEqual(['The Small Book/01 One the premise.md', 'The Small Book/02 Two the middle.md', 'The Small Book/03 Three the close.md']);
    expect(vault.documents().filter((p) => p.startsWith('The Small Book/'))).toEqual(paths);
    const one = await vault.read(paths[0]!, true);
    expect(one.diagnostics).toEqual([]);
    expect(one.text.split('\n').slice(0, 6)).toEqual(['---', 'type: source', 'frozen: true', 'imported: 2026-10-18', 'title: "One: the premise"', '---']);
    expect(meta(one.doc)).toMatchObject({ frozen: true, title: 'One: the premise' });
    expect(meta(one.doc).read).toBeUndefined();
    expect(one.doc.blocks.map((b) => b.kind)).toEqual(['paragraph', 'paragraph', 'raw', 'raw', 'paragraph']);
    const two = await vault.read(paths[1]!, true);
    expect(two.text).toContain('\n[figure: A map of the valley]\n');
    // a second copy of the book gets its own folder
    expect(await vault.createFolder('', m.title)).toBe('The Small Book 2');
  });
});
