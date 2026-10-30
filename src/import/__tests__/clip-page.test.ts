// @vitest-environment jsdom
// A page as the clipper writes it: Defuddle's article and metadata, the
// walker's Markdown line for line, the escapes that keep a page's prose from
// reading as a card, and the images landed beside the file.

import { promises as fsp } from 'node:fs';
import { readFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { cardForm, meta, parse } from '../../format/index.js';
import { Vault, imageExt } from '../../vault/index.js';
import { nodeFs } from '../../vault/node-fs.js';
import { clipPage, escapeProse, markdownOf, normalizeWhen } from '../index.js';
import { allowLongSelectors } from './long-selectors.js';

allowLongSelectors();

const page = (name: string) => readFileSync(join(import.meta.dirname, 'pages', name), 'utf8');
const dom = (html: string) => new DOMParser().parseFromString(html, 'text/html').body;
const md = (html: string, base?: string) => markdownOf(dom(html), base).text;

/** The file the page would land as, parsed: no diagnostics, no card. */
function readsClean(text: string) {
  const { doc, diagnostics } = parse(`${text}\n`);
  expect(diagnostics).toEqual([]);
  expect(doc.blocks.some((b) => b.kind === 'card')).toBe(false);
  return doc;
}

describe('clipPage', () => {
  it('an article: the fields from the page, the body as Markdown with the chrome gone, footnotes under notes', () => {
    const r = clipPage(page('article.html'), 'https://fieldnotes.example.org/posts/economics-of-attention')!;
    expect(r).toMatchObject({
      title: 'The economics of attention',
      url: 'https://fieldnotes.example.org/posts/economics-of-attention',
      site: 'Field Notes',
      author: 'Jane Doe',
      published: '2024-03-01T10:00:00Z',
      description: 'Every review is a small wager against forgetting.',
      via: 'defuddle',
    });
    expect(r.images).toEqual([
      { src: 'https://fieldnotes.example.org/img/forgetting-curve.png', alt: 'The forgetting curve' },
      { src: 'https://cdn.example.org/img/gardener.jpg', alt: 'A gardener watering' },
    ]);
    expect(r.text.split('\n')).toEqual([
      'Every review you schedule is a *small wager* against forgetting. The wager has a cost, the minutes spent, and a payoff that **compounds**: each successful recall pushes the next due date further out, so a few well-timed reviews buy years of retention for the price of an afternoon.[^1]',
      '',
      'The mistake most learners make is to treat the wager as free. They review everything, constantly, and confuse the warm feeling of familiarity with the harder fact of retrieval. See [the note on retrieval](https://fieldnotes.example.org/notes/retrieval) and the [spacing effect](https://en.wikipedia.org/wiki/Spacing_effect); the function is `schedule(card)`.',
      '',
      '## A schedule in code',
      '',
      '```python',
      'def next_interval(ivl, af):',
      '    return max(1, round(ivl * af))',
      '```',
      '',
      '## Grades',
      '',
      '| grade | meaning | interval |',
      '| --- | --- | --- |',
      '| 1 | again | 1 d |',
      '| 3 | good | ivl × af |',
      '| 4 | easy | ivl × af × 1.3 |',
      '',
      '![The forgetting curve](https://fieldnotes.example.org/img/forgetting-curve.png)',
      '',
      'The forgetting curve, redrawn.',
      '',
      'A good system spends your attention the way a careful gardener spends water: not evenly, but where the curve is about to cross the floor. The retention after $t$ days is $R = e^{-t/S}$.[^2]',
      '',
      '> Familiarity is cheap. Retrieval is the thing that lasts.',
      '',
      '![A gardener watering](https://cdn.example.org/img/gardener.jpg)',
      '',
      '## notes',
      '',
      '[^1]: The wager framing is from the SuperMemo literature.',
      '',
      '[^2]: Ebbinghaus, 1885, with *S* the stability.',
    ]);
    expect(r.words).toBe(221);
    const doc = readsClean(r.text);
    expect(doc.blocks.map((b) => b.kind)).toEqual([
      'paragraph', 'paragraph', 'heading', 'raw', 'heading', 'raw', 'paragraph', 'paragraph', 'paragraph', 'raw', 'paragraph', 'heading', 'paragraph', 'paragraph',
    ]);
    // nothing of the chrome made it: the nav, the byline, the related list, the footer, the title heading
    for (const s of ['archive', 'By Jane Doe', 'Another post', '© 2024', '# The economics of attention']) expect(r.text).not.toContain(s);
  });

  it('a page Defuddle finds nothing in: the fallback over the whole body, counted as such', () => {
    const r = clipPage(page('worksheet.html'), 'https://example.org/worksheets/4')!;
    expect(r).toMatchObject({ title: 'Worksheet 4: intervals', site: 'example.org', author: '', published: '', via: 'fallback' });
    expect(r.images).toEqual([]);
    expect(r.text.split('\n')).toEqual([
      'Work each problem on paper before you look at the answer. The first interval is one day; each pass multiplies it by the growth factor, rounded, never below one day.',
      '',
      'Problem one: an interval of 9 days and a growth factor of 1.6 give the next interval. Problem two: an interval of 1 day graded again stays at 1 day.',
      '',
      'Your answer',
    ]);
    readsClean(r.text);
    expect(clipPage('<html><body><nav><a href="/">home</a></nav></body></html>', 'https://example.org/')).toBeNull();
  });

  it('a page with card syntax in its prose: every mark escaped, the file reads with no card', () => {
    const r = clipPage(page('syntax.html'), 'https://devlog.example.net/templates-and-scopes')!;
    expect(r).toMatchObject({ title: 'Templates and scopes', site: 'Dev Log', via: 'defuddle' });
    const lines = r.text.split('\n');
    expect(lines[0]).toContain('slots as { {name}} and { { count }}');
    expect(lines[0]).toContain('std::vector');
    expect(lines[0]).not.toMatch(/\s::\s|\s:::\s|\{\{/);
    expect(lines.slice(2, 5)).toEqual([
      'A question mark can stand alone on a line of a poem:',
      '\\?',
      'and then the poem goes on, which is a thing poems do when a page is clipped.',
    ]);
    expect(lines[6]).toContain('opens with <!- - in HTML');
    const doc = readsClean(r.text);
    expect(doc.blocks.map((b) => b.kind)).toEqual(['paragraph', 'paragraph', 'paragraph', 'paragraph']);
    for (const b of doc.blocks) expect(cardForm(b.text)).toBeNull();
  });
});

describe('escapeProse', () => {
  it('takes the whitespace off a :: or :::, writes {{ apart, escapes a lone ?, a trailing ^id, and a comment', () => {
    expect(escapeProse('front :: back')).toBe('front::back');
    expect(escapeProse('left ::: right')).toBe('left:::right');
    expect(escapeProse('a line ::\nnext')).toBe('a line::next');
    expect(escapeProse(':: at the start')).toBe('::at the start');
    expect(escapeProse('std::vector stays')).toBe('std::vector stays');
    expect(escapeProse('{{c1::x}} and {{y}}')).toBe('{ {c1::x}} and { {y}}');
    expect(escapeProse('front\n?\nback')).toBe('front\n\\?\nback');
    expect(escapeProse('front\n??\nback')).toBe('front\n\\??\nback');
    expect(escapeProse('what? not alone')).toBe('what? not alone');
    expect(escapeProse('see the note ^n1')).toBe('see the note \\^n1');
    expect(escapeProse('two lines\n^n1')).toBe('two lines\n\\^n1');
    expect(escapeProse('a ^ alone')).toBe('a ^ alone');
    expect(escapeProse('<!-- sr due=2026-01-01 -->')).toBe('<!- - sr due=2026-01-01 -->');
    for (const s of ['front :: back', 'front\n?\nback', '{{c1::x}}', 'l ::: r']) expect(cardForm(escapeProse(s))).toBeNull();
  });

  it('writes \\(…\\) and \\[…\\] as $…$ and $$…$$', () => {
    expect(escapeProse('the area \\( \\int_0^1 x^2 \\) is a third')).toBe('the area $\\int_0^1 x^2$ is a third');
    expect(escapeProse('\\[ E = mc^2 \\]')).toBe('$$E = mc^2$$');
  });
});

describe('markdownOf', () => {
  it('inline marks: nested emphasis, code with backticks inside, strike, a quote, a link around them', () => {
    expect(md('<p>Some <em>em <strong>both</strong></em> and <b> padded </b>text, <code>a `tick`</code>, <del>gone</del>, <q>said</q>.</p>'))
      .toBe('Some *em **both*** and **padded** text, `` a `tick` ``, ~~gone~~, "said".');
    expect(md('<p>A <a href="/x (1).html">link <em>with</em> marks</a>, an <a href="#top">anchor</a>, a <a href="mailto:a@b.c">mail</a>, <a href="/e"></a>.</p>', 'https://ex.org/d/'))
      .toBe('A [link *with* marks](https://ex.org/x%20%281%29.html), an anchor, a mail, .');
  });

  it('blocks: an ordered list from its start, a table padded and with pipes escaped, fenced code from data-lang, display math, a quote of blocks', () => {
    expect(md('<ol start="3"><li>three<ul><li>three <em>a</em></li></ul></li><li>four</li></ol>')).toBe('3. three\n  - three *a*\n4. four');
    expect(md('<table><tr><td>a|b</td><td>c</td></tr><tr><td>1</td></tr></table>')).toBe('| a\\|b | c |\n| --- | --- |\n| 1 |  |');
    expect(md('<pre data-lang="rust">fn main() {}\n</pre>')).toBe('```rust\nfn main() {}\n```');
    expect(md('<pre><code>a\n````\nb</code></pre>')).toBe('`````\na\n````\nb\n`````');
    expect(md('<p>Inline <math data-latex="a \\neq 0"><mi>a</mi></math> and</p><math display="block"><annotation encoding="application/x-tex">x^2</annotation></math>'))
      .toBe('Inline $a \\neq 0$ and\n\n$$x^2$$');
    expect(md('<blockquote><p>one</p><ul><li>two</li></ul></blockquote>')).toBe('> one\n>\n> - two');
    expect(md('<h2>Heading <code>x</code></h2><hr><p>after</p>')).toBe('## Heading `x`\n\nafter');
  });

  it('images: an absolute or resolved src is listed once, a data: image is dropped, alt without brackets', () => {
    const r = markdownOf(dom('<p><img src="/a.png" alt="[one]"> and <img src="https://x.org/a.png" alt="again"> and <img src="data:image/png;base64,AAAA" alt="inline"></p>'), 'https://x.org/p/');
    expect(r.text).toBe('![one](https://x.org/a.png) and ![again](https://x.org/a.png) and');
    expect(r.images).toEqual([{ src: 'https://x.org/a.png', alt: 'one' }]);
  });

  it('footnotes: numbered by first reference, the list taken out of the flow, wikipedia\'s names too', () => {
    expect(md('<p>A<sup><a href="#fn-b">b</a></sup> and B<sup><a href="#fn-a">a</a></sup>.</p><section class="footnotes"><ol><li id="fn-a"><p>Note a <a href="#fnref-a" class="footnote-backref">↩</a></p></li><li id="fn-b"><p>Note b</p></li></ol></section>'))
      .toBe('A[^1] and B[^2].\n\n## notes\n\n[^1]: Note b\n\n[^2]: Note a');
    // the same with the links already resolved against the page, as Defuddle may hand them over
    expect(md('<p>A<sup><a href="https://x.org/p#fn:1">1</a></sup>.</p><div class="footnotes"><ol><li id="fn:1"><p>Note <a href="https://x.org/p#fnref:1">↩</a></p></li></ol></div>', 'https://x.org/p'))
      .toBe('A[^1].\n\n## notes\n\n[^1]: Note');
    expect(md('<p>Claim.<sup class="reference" id="cite_ref-1"><a href="#cite_note-1">[1]</a></sup></p><ol class="references"><li id="cite_note-1"><span class="mw-cite-backlink">^</span> <span class="reference-text">Source.</span></li></ol>'))
      .toBe('Claim.[^1]\n\n## notes\n\n[^1]: Source.');
    // a note nobody refers to is dropped with its list; a reference to no note keeps its number
    expect(md('<p>Lone<sup><a href="#fn:9">9</a></sup>.</p><div id="footnotes"><ol><li id="fn:1"><p>Unreferenced</p></li></ol></div>')).toBe('Lone[^1].');
  });

  it('skips scripts, forms\' controls, nav, and svg; keeps text in plain divs', () => {
    expect(md('<div>one<script>x()</script><nav>n</nav><svg><title>t</title></svg><button>b</button></div><div>two</div>')).toBe('one\n\ntwo');
  });
});

describe('normalizeWhen', () => {
  it('keeps a day or an instant, trims milliseconds, moves zones to UTC, reads a prose date as a day', () => {
    expect(normalizeWhen('2024-03-01')).toBe('2024-03-01');
    expect(normalizeWhen('2024-03-01T10:00:00Z')).toBe('2024-03-01T10:00:00Z');
    expect(normalizeWhen('2024-03-01T10:00:00.000Z')).toBe('2024-03-01T10:00:00Z');
    expect(normalizeWhen('2024-03-01T12:00:00+02:00')).toBe('2024-03-01T10:00:00Z');
    expect(normalizeWhen('March 1, 2024')).toBe('2024-03-01');
    expect(normalizeWhen('yesterday')).toBe('');
    expect(normalizeWhen('')).toBe('');
    expect(normalizeWhen(undefined)).toBe('');
  });
});

describe('landing', () => {
  let root = '';
  let vault: Vault;
  beforeAll(async () => {
    root = await fsp.mkdtemp(join(tmpdir(), 'ilmi-clip-'));
    vault = await Vault.open(nodeFs, root);
  });
  afterAll(async () => { await fsp.rm(root, { recursive: true, force: true }); });

  it('writes the fields the page gave, downloads the images beside the file, and leaves a failed one in place', async () => {
    const r = clipPage(page('article.html'), 'https://fieldnotes.example.org/posts/economics-of-attention')!;
    const path = await vault.importDoc('', { title: r.title, text: r.text, url: r.url, author: r.author, published: r.published, today: '2026-10-18' });
    expect(path).toBe('The economics of attention.md');
    const before = (await vault.read(path)).text;
    expect(before.split('\n').slice(0, 8)).toEqual([
      '---', 'type: source', 'frozen: true', 'imported: 2026-10-18', 'url: https://fieldnotes.example.org/posts/economics-of-attention', 'author: Jane Doe', 'published: 2024-03-01T10:00:00Z', '---',
    ]);
    const png = new Uint8Array([0x89, 0x50, 0x4e, 0x47, 0, 0, 0, 0]);
    const asked: string[] = [];
    const landed = await vault.attachImages(path, r.images.map((i) => i.src), async (url) => {
      asked.push(url);
      if (url.endsWith('forgetting-curve.png')) return { bytes: png, type: 'image/png' };
      return { bytes: new Uint8Array([1]), type: 'text/html; charset=utf-8' };
    });
    expect(asked).toEqual(r.images.map((i) => i.src));
    expect(landed).toEqual(['The%20economics%20of%20attention/img-01.png']); // percent-encoded, as Markdown reads a destination
    expect(new Uint8Array(await fsp.readFile(join(root, 'The economics of attention', 'img-01.png')))).toEqual(png);
    const after = await vault.read(path, true);
    expect(after.diagnostics).toEqual([]);
    expect(after.text).toContain('![The forgetting curve](The%20economics%20of%20attention/img-01.png)');
    expect(after.text).toContain('![A gardener watering](https://cdn.example.org/img/gardener.jpg)');
    // no `title` field: the file is named after the title, as any imported source
    expect(meta(after.doc)).toMatchObject({ frozen: true, url: r.url, author: 'Jane Doe', published: '2024-03-01T10:00:00Z' });
    expect(meta(after.doc).title).toBeUndefined();
    // the folder holds only the image, which the walk ignores: no child documents, the document list unchanged
    expect(vault.documents()).toEqual([path]);
    expect(vault.tree).toEqual([{ kind: 'doc', name: 'The economics of attention', path, children: [] }]);
    // a getter that throws, or nothing to land: no write at all
    const stamp = (await vault.read(path, true)).stamp;
    expect(await vault.attachImages(path, ['https://cdn.example.org/img/gardener.jpg'], async () => { throw new Error('offline'); })).toEqual([]);
    expect((await vault.read(path, true)).stamp).toEqual(stamp);
    await expect(vault.attachImages('nowhere.md', [], async () => null)).rejects.toThrow('no such document');
  });

  it('names the extension from the content type', () => {
    expect(imageExt('image/png')).toBe('png');
    expect(imageExt('image/jpeg; charset=binary')).toBe('jpg');
    expect(imageExt('IMAGE/WEBP')).toBe('webp');
    expect(imageExt('text/html')).toBeNull();
    expect(imageExt('')).toBeNull();
  });
});
