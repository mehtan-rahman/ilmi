// @vitest-environment jsdom
// The intake's pure side: text helpers, and a page's readable text.

import { describe, expect, it } from 'vitest';
import { parse } from '../../format/index.js';
import { cleanText, deriveTitle, isUrl, readable, stats, textOf, titleFromFileName } from '../index.js';

const SAMPLE = `Spaced repetition and the economics of attention

Every review you schedule is a small wager against forgetting. The wager has a cost — the minutes spent — and a payoff that compounds: each successful recall pushes the next due date further out, so a few well-timed reviews buy years of retention for the price of an afternoon.

The mistake most learners make is to treat the wager as free. They review everything, constantly, and confuse the warm feeling of familiarity with the harder fact of retrieval. Familiarity is cheap. Retrieval is the thing that lasts, and it is only trained by the discomfort of nearly forgetting and then not quite forgetting.

A good system spends your attention the way a careful gardener spends water: not evenly, but where the curve is about to cross the floor.`;

describe('text', () => {
  it('cleans line endings and a byte-order mark', () => {
    expect(cleanText('﻿one\r\ntwo\rthree\n\n')).toBe('one\ntwo\nthree');
  });

  it('derives a title from the first line, heading marks stripped, capped', () => {
    expect(deriveTitle(SAMPLE)).toBe('Spaced repetition and the economics of attention');
    expect(deriveTitle('\n\n  ## A heading ##  \nbody')).toBe('A heading');
    expect(deriveTitle('x'.repeat(100))).toHaveLength(64);
    expect(deriveTitle('')).toBe('');
  });

  it('takes a file name without its extension', () => {
    expect(titleFromFileName('/tmp/notes/wozniak 1990.md')).toBe('wozniak 1990');
    expect(titleFromFileName('page.HTML')).toBe('page');
    expect(titleFromFileName('README')).toBe('README');
  });

  it('counts the sample as the prototype did', () => {
    expect(stats(SAMPLE)).toEqual({ words: 136, paragraphs: 4, minutes: 1 });
    expect(stats('  ')).toEqual({ words: 0, paragraphs: 0, minutes: 1 });
    expect(stats('a\n \nb').paragraphs).toBe(2);
  });

  it('knows an address from text', () => {
    expect(isUrl('https://example.com/a?b=c')).toBe(true);
    expect(isUrl('  http://x.y \n')).toBe(true);
    expect(isUrl('see https://example.com')).toBe(false);
    expect(isUrl('https://a.b\nhttps://c.d')).toBe(false);
    expect(isUrl('ftp://x')).toBe(false);
  });
});

describe('readable', () => {
  const page = (body: string, title = 'A page') => `<!doctype html><html><head><title>${title}</title></head><body>${body}</body></html>`;

  it('turns a page into blocks the format reads back as the same shapes', () => {
    const html = page(`
      <nav><a href="/">home</a></nav>
      <article>
        <h1>The title</h1>
        <p>First   paragraph, with <em>emphasis</em> and
           a line break<br>inside.</p>
        <h2>Section</h2>
        <p>Second paragraph.</p>
        <ul><li>one</li><li>two<ul><li>two point one</li></ul></li></ul>
        <blockquote><p>Quoted words.</p></blockquote>
        <pre><code>let x = 1;\nlet y = 2;</code></pre>
        <script>alert(1)</script>
        <table><tr><th>a</th><th>b</th></tr><tr><td>1</td><td>2</td></tr></table>
      </article>`);
    const out = textOf(new DOMParser().parseFromString(html, 'text/html').body);
    expect(out).toBe([
      '# The title',
      'First paragraph, with emphasis and a line break\ninside.',
      '## Section',
      'Second paragraph.',
      '- one\n- two\n  - two point one',
      '> Quoted words.',
      '```\nlet x = 1;\nlet y = 2;\n```',
      '| a | b |\n| 1 | 2 |',
    ].join('\n\n'));
    const { doc, diagnostics } = parse(out);
    expect(diagnostics).toEqual([]);
    expect(doc.blocks.map((b) => b.kind)).toEqual(['heading', 'paragraph', 'heading', 'paragraph', 'raw', 'raw', 'raw', 'raw']);
  });

  it('picks the article out of a page and its title', () => {
    const paras = Array.from({ length: 6 }, (_, i) => `<p>Paragraph ${i} of the article proper, long enough that a reader would count it as prose and not as chrome around the prose, which is what the sidebar is.</p>`).join('');
    const html = page(`<header><nav><ul><li><a href="/a">a</a></li><li><a href="/b">b</a></li></ul></nav></header>
      <main><article><h1>The economics of attention in spaced repetition</h1>${paras}</article></main>
      <aside><p>Related: <a href="/x">x</a></p></aside>
      <footer><p>© somebody</p></footer>`, 'The economics of attention in spaced repetition - Some Site');
    const r = readable(html, 'https://example.com/post');
    expect(r).not.toBeNull();
    expect(r!.title).toBe('The economics of attention in spaced repetition');
    expect(r!.text).toContain('Paragraph 0 of the article proper');
    expect(r!.text).toContain('Paragraph 5 of the article proper');
    expect(r!.text).not.toContain('© somebody');
    expect(r!.text.split('\n\n')).toHaveLength(6);
  });

  it('falls back to the whole body for a page too small to be an article, and refuses an empty one', () => {
    const r = readable(page('<p>Just a line.</p>'));
    expect(r).toEqual({ title: 'A page', text: 'Just a line.' });
    expect(readable(page('<div></div>'))).toBeNull();
  });
});
