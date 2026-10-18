// @vitest-environment jsdom
// The reader's DOM: node views over a real EditorView, without the window;
// Markdown drawn as Markdown over the sampler and an EPUB chapter.

import { NodeSelection } from 'prosemirror-state';
import { EditorView } from 'prosemirror-view';
import { promises as fsp } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import { blanks, parse, type Blank, type Block, type Card } from '../../format/index.js';
import { mapBook, type Epub } from '../../import/epub.js';
import { classifyRaw, frozenKey, imageOnly, inlineRanges, makeState, passage, splitBlocks, type ImageLoader } from '../../reader/index.js';
import { insideMath, withBlank } from '../Composer.js';
import { imagePath, isRemote, mimeOf } from '../images.js';
import { dueLabel } from '../items.js';
import { answerHTML, cardHTML, clozeHTML, nodeViews, rawHTML, richHTML, type BlankState } from '../Reader.js';

const CORPUS = join(dirname(fileURLToPath(import.meta.url)), '../../format/__tests__/corpus/vault/papers');
const WOZ = join(CORPUS, 'wozniak-1990.md');
const MAXWELL = join(CORPUS, 'maxwell.md');
const SAMPLER = join(CORPUS, '../fleeting/markdown-sampler.md');
const MARK = join(CORPUS, '../fleeting/markdown-sampler/mark.png');
const EPUB = join(dirname(fileURLToPath(import.meta.url)), '../../import/__tests__/epub/three-chapters.json');

function mount(blocks: Block[], frozen = false, images?: ImageLoader): EditorView {
  const state = makeState(blocks, { frozen: () => frozen, pos: 3, ...(images ? { images } : {}) });
  return new EditorView(document.body.appendChild(document.createElement('div')), {
    state, nodeViews, editable: () => !frozen, attributes: { class: 'draft-doc' },
  });
}

/** Lets the image loads land. */
const tick = () => new Promise((r) => setTimeout(r, 0));

describe('the surface', () => {
  it('renders every block of a corpus file, cards as atoms', async () => {
    const { doc } = parse(await fsp.readFile(WOZ, 'utf8'));
    const view = mount(doc.blocks, true);
    expect(view.dom.children).toHaveLength(doc.blocks.length);
    const cards = view.dom.querySelectorAll('.card-span');
    expect(cards).toHaveLength(doc.blocks.filter((b) => b.kind === 'card').length);
    for (const c of cards) expect(c.getAttribute('contenteditable')).toBe('false');
    expect(view.dom.querySelectorAll('.card-span .cz')).toHaveLength(5);
    expect(view.dom.querySelectorAll('.card-span .cs-q')).toHaveLength(4);
    expect(view.dom.querySelectorAll('h2.dd-h')).toHaveLength(4);
    expect(view.dom.querySelectorAll('.settled')).toHaveLength(2);
    expect(view.editable).toBe(false);
    expect(view.dom.getAttribute('contenteditable')).toBe('false');
    view.destroy();
  });

  it('renders math with KaTeX and lights editorial marks', () => {
    const view = mount([
      { kind: 'paragraph', text: 'so $x^2$ and [a note] and #TODO: fix' },
      { kind: 'card', text: 'the {{c1::area}} is $\\pi r^2$', sched: { due: '2026-01-01' } },
      { kind: 'raw', text: '- a list' },
    ]);
    const chips = view.dom.querySelectorAll('.math');
    expect(chips).toHaveLength(2);
    expect(chips[0]!.getAttribute('data-tex')).toBe('$x^2$');
    expect(chips[0]!.querySelector('.katex')).not.toBeNull();
    expect(chips[0]!.getAttribute('contenteditable')).toBe('false');
    expect(view.dom.querySelector('.ed-mark.note')?.textContent).toBe('[a note]');
    expect(view.dom.querySelector('.ed-mark.tag')?.textContent).toBe('#TODO:');
    expect(view.dom.querySelector('.card-span .cs-state')?.textContent).toMatch(/^overdue \d+d$/);
    // a raw list is drawn as a list, its source behind it
    expect(view.dom.querySelector('.raw.rendered ul li')?.textContent).toBe('a list');
    expect(view.dom.querySelector('.raw.rendered .raw-src')?.textContent).toBe('- a list');
    expect(view.dom.textContent).toContain('so ');
    view.destroy();
  });

  it('shows a card in its form', () => {
    const cloze: Card = { kind: 'card', text: 'a {{c1::b}} c' };
    expect(cardHTML(cloze)).toBe('a <span class="cz">b</span> c');
    expect(cardHTML({ kind: 'card', text: 'q :: a' })).toBe('<span class="cs-q">q</span><span class="cs-a">a</span>');
    expect(cardHTML({ kind: 'card', text: 'l ::: r' })).toBe('<span>l <span class="cs-arrow">⇄</span> r</span>');
    expect(cardHTML({ kind: 'card', text: '<b> :: &' })).toBe('<span class="cs-q">&lt;b&gt;</span><span class="cs-a">&amp;</span>');
  });

  it('labels when a card comes up', () => {
    const now = new Date(2026, 4, 27, 12);
    expect(dueLabel(undefined, now)).toBe('new');
    expect(dueLabel('2026-05-27', now)).toBe('today');
    expect(dueLabel('2026-05-28', now)).toBe('tomorrow');
    expect(dueLabel('2026-05-25', now)).toBe('overdue 2d');
    expect(dueLabel('2026-06-10', now)).toBe('+14d');
    expect(dueLabel('2026-08-27', now)).toBe('+3mo');
  });
});

describe('blanks inside math', () => {
  const cls = (s: BlankState) => (s === 'hidden' ? 'cloze' : s === 'revealed' ? 'cloze revealed' : 'cloze ctx');
  /** Group `n` in state `s`, every other group as context. */
  const group = (n: number, s: BlankState) => (b: Blank) => (b.n === n ? s : 'plain');
  const render = (html: string) => { const el = document.createElement('div'); el.innerHTML = html; return el; };
  /** Spans that carry a glyph of their own (KaTeX's zero-width joiners are not glyphs). */
  const glyphs = (root: Element) => Array.from(root.querySelectorAll('span')).filter((s) => Array.from(s.childNodes).some((n) => n.nodeType === 3 && /[^\s​]/.test(n.textContent!)));

  it('renders the maxwell formula once per state: hidden as a box, revealed on the accent, the other group plain', async () => {
    const { doc } = parse(await fsp.readFile(MAXWELL, 'utf8'));
    const field = doc.blocks.find((b): b is Card => b.kind === 'card' && b.id === 'cmx-field')!;

    // hidden: one chip, display mode, one box in the hidden colour over a phantom, the source nowhere
    const hidden = clozeHTML(field.text, group(1, 'hidden'), cls);
    const chip = render(hidden).querySelector<HTMLElement>('.math.display.blanks')!;
    expect(chip).not.toBeNull();
    expect(chip.dataset).toMatchObject({ blanks: '1', revealed: '0' });
    expect(chip.dataset.tex).toBeUndefined();
    expect(chip.querySelector('.katex-display .katex')).not.toBeNull();
    expect(chip.querySelector('.tex')).toBeNull();
    const boxes = chip.querySelectorAll<HTMLElement>('.colorbox');
    expect(boxes).toHaveLength(1);
    expect(boxes[0]!.getAttribute('style')).toContain('background-color:var(--fg-5)');
    expect(hidden).not.toContain('\\frac{\\rho}{\\epsilon_0}');
    expect(hidden).not.toContain('{{c1::');
    expect(hidden).not.toContain('katex-mathml');
    // what the phantom holds is transparent, every glyph of it
    for (const g of glyphs(chip.querySelector('.boxpad')!)) expect(g.getAttribute('style')).toContain('color:transparent');
    // the other group's line reads plain: its glyphs are there, outside any box
    expect(chip.textContent).toContain('∇');
    expect(chip.textContent).toContain('×');
    expect(chip.querySelectorAll('.cloze')).toHaveLength(0);

    // revealed: the answer on the accent, its glyphs shown, the source kept on the chip
    const revealed = clozeHTML(field.text, group(1, 'revealed'), cls);
    const chip2 = render(revealed).querySelector<HTMLElement>('.math.blanks')!;
    expect(chip2.dataset).toMatchObject({ blanks: '1', revealed: '1' });
    expect(chip2.dataset.tex).toContain('{{c1::\\frac{\\rho}{\\epsilon_0}}}');
    const box = chip2.querySelector<HTMLElement>('.colorbox')!;
    expect(box.getAttribute('style')).toContain('background-color:var(--accent-soft)');
    const pad = chip2.querySelector('.boxpad')!;
    expect(pad.textContent).toContain('ρ');
    expect(pad.textContent).toContain('ϵ');
    expect(pad.innerHTML).not.toContain('transparent');

    // the whole-line blank, c2, hidden: the alignment mark stays outside, so two boxes, and no answer glyph shows
    const line = clozeHTML(field.text, group(2, 'hidden'), cls);
    const chip3 = render(line).querySelector<HTMLElement>('.math.blanks')!;
    expect(chip3.querySelectorAll('.colorbox')).toHaveLength(2);
    expect(line).not.toContain('\\partial');
    for (const pad3 of chip3.querySelectorAll('.boxpad')) for (const g of glyphs(pad3)) expect(g.getAttribute('style')).toContain('color:transparent');
    // and c1, as context now, shows plain: the ρ is in the formula with no box around it
    expect(chip3.textContent).toContain('ρ');
    expect(chip3.dataset).toMatchObject({ blanks: '1', revealed: '0' });
  });

  it('shows a formula\'s blanks on the accent in the reader and the deck, the answer face as math', () => {
    const card: Card = { kind: 'card', text: 'so $y = {{c1::x^{2}}}$ and {{c2::t}}' };
    const html = cardHTML(card);
    expect(html).toContain('<span class="math blanks" data-blanks="1" data-revealed="1" data-tex="$y = {{c1::x^{2}}}$">');
    expect(html).toContain('<span class="cz">t</span>');
    expect(html).toContain('var(--accent-soft)');
    expect(html).not.toContain('var(--fg-5)');
    const view = mount([card]);
    expect(view.dom.querySelectorAll('.card-span .math.blanks')).toHaveLength(1);
    expect(view.dom.querySelectorAll('.card-span .cz')).toHaveLength(1);
    expect(view.dom.querySelector('.card-span .math.blanks .katex')).not.toBeNull();
    view.destroy();
    // the answer face: TeX as math, an align line through aligned, text as text
    const [b] = blanks(card.text);
    expect(answerHTML(b!)).toMatch(/^<span class="math"><span class="katex">/);
    expect(answerHTML(b!)).not.toContain('katex-error');
    const aligned = answerHTML({ n: 2, answer: '\\nabla \\times \\mathbf{E} &= -\\frac{\\partial \\mathbf{B}}{\\partial t}', raw: '', math: true }, true);
    expect(aligned).toContain('class="katex"');
    expect(aligned).not.toContain('katex-error');
    expect(answerHTML({ n: 1, answer: 'plain [a note]', raw: '{{c1::plain [a note]}}' })).toBe('plain <span class="ed-mark note">[a note]</span>');
  });

  it('falls back to the source as text when KaTeX refuses the TeX, the blank still hidden', () => {
    const bad = clozeHTML('$\\nosuch {{c1::x}}$ here', () => 'hidden', cls);
    const chip = render(bad).querySelector<HTMLElement>('.math.blanks')!;
    expect(chip.dataset).toMatchObject({ blanks: '1', revealed: '0' });
    expect(chip.querySelector('.katex')).toBeNull();
    expect(chip.querySelector('code.tex')?.innerHTML).toBe('\\nosuch <span class="cloze">x</span>');
    expect(bad.endsWith('</span> here')).toBe(true);
  });

  it('the composer writes the numbered form for a blank inside a formula', () => {
    const text = 'Gauss: $\\nabla \\cdot \\mathbf{E} = \\rho / \\epsilon_0$ and {{c1::more}}';
    const from = text.indexOf('\\rho');
    const to = text.indexOf('$', from);
    expect(insideMath(text, from, to)).toBe(true);
    expect(insideMath(text, 0, 5)).toBe(false);
    expect(insideMath(text, from, text.length)).toBe(false);
    const next = withBlank(text, from, to);
    expect(next).toEqual({ text: 'Gauss: $\\nabla \\cdot \\mathbf{E} = {{c2::\\rho / \\epsilon_0}}$ and {{c1::more}}', open: '{{c2::' });
    expect(blanks(next.text).map((b) => [b.n, b.answer, b.math ?? false])).toEqual([[2, '\\rho / \\epsilon_0', true], [1, 'more', false]]);
    expect(withBlank('a b c', 2, 3)).toEqual({ text: 'a {{b}} c', open: '{{' });
  });
});

describe('markdown drawn as markdown', () => {
  const sampler = async () => parse(await fsp.readFile(SAMPLER, 'utf8')).doc.blocks;
  const dataUrl = async () => `data:image/png;base64,${(await fsp.readFile(MARK)).toString('base64')}`;
  /** A loader answering the sampler's one image with the PNG as a data URL. */
  const loader = (url: string): ImageLoader => async (src) => (src === 'markdown-sampler/mark.png' ? { url } : 'broken');
  const textOf = (b: Block | undefined) => (b as { text: string }).text;

  it('draws each inline form over the source, the markers dimmed and the text unchanged', async () => {
    const blocks = await sampler();
    const view = mount(blocks, false, loader(await dataUrl()));
    await tick();
    const p = view.dom.querySelector<HTMLElement>('p.dd-p')!;
    expect(p.querySelector('.md-em')?.textContent).toBe('emphasis');
    expect(p.querySelector('.md-strong')?.textContent).toBe('strong');
    expect(p.querySelector('.md-code')?.textContent).toBe('a code span');
    const link = p.querySelector<HTMLElement>('.md-link')!;
    expect(link.textContent).toBe('link to the spec');
    expect(link.dataset.href).toBe('https://commonmark.org/');
    // ten markers: two each for emphasis, strong, and code, the brackets of the link and of the image
    const marks = Array.from(p.querySelectorAll('.md-mark')).map((m) => m.textContent);
    expect(marks).toEqual(['*', '*', '**', '**', '`', '`', '[', '](https://commonmark.org/)', '![', '](markdown-sampler/mark.png)']);
    expect(p.querySelectorAll('.md-mark.hidden')).toHaveLength(0);
    // the source is what the paragraph says, character for character
    expect(p.textContent).toBe(textOf(blocks[1]));
    // an image in the line: its alt lit, the picture drawn before it
    expect(p.querySelector('.md-alt')?.textContent).toBe('a small mark');
    const inlineImg = p.querySelector<HTMLImageElement>('img.md-img')!;
    expect(inlineImg.alt).toBe('a small mark');
    expect(inlineImg.getAttribute('src')).toMatch(/^data:image\/png;base64,/);
    view.destroy();
  });

  it('draws each block form inside its atom: the list a ul, the code a pre with the language, the table a table, the image an img', async () => {
    const blocks = await sampler();
    const view = mount(blocks, true, loader(await dataUrl()));
    await tick();
    const dom = view.dom;
    expect(dom.children).toHaveLength(blocks.length);
    expect(dom.querySelector('h2.dd-h')?.textContent).toBe('a sampler of markdown');
    const atoms = Array.from(dom.querySelectorAll<HTMLElement>('.raw.rendered'));
    expect(atoms.map((a) => a.dataset.kind)).toEqual(['list', 'list', 'quote', 'code', 'table']);
    for (const a of atoms) expect(a.getAttribute('contenteditable')).toBe('false');
    const ul = dom.querySelector('.raw-view ul')!;
    expect(Array.from(ul.querySelectorAll('li')).map((li) => li.textContent)).toEqual(['the first point', 'the second, with *emphasis*', 'the third, with `code`']);
    expect(ul.querySelector('li .md-em')?.textContent).toBe('emphasis');
    expect(ul.querySelector('li .md-code')?.textContent).toBe('code');
    const ol = dom.querySelector('.raw-view ol')!;
    expect(ol.getAttribute('start')).toBeNull();
    expect(Array.from(ol.querySelectorAll('li')).map((li) => li.textContent)).toEqual(['one', 'two', 'three']);
    const quote = dom.querySelector('.raw-view blockquote')!;
    expect(quote.querySelector('.md-strong')?.textContent).toBe('weight');
    expect(quote.querySelectorAll('p')).toHaveLength(1);
    expect(quote.textContent).toBe('A quotation set apart, with **weight** in it.\nIt runs to a second line.');
    const code = dom.querySelector('.raw-view pre code')!;
    expect(code.className).toBe('language-js');
    expect(code.textContent).toBe('const due = schedule(card, now);');
    const table = dom.querySelector('.raw-view table')!;
    expect(Array.from(table.querySelectorAll('th')).map((th) => [th.textContent, th.getAttribute('style')])).toEqual([
      ['form', 'text-align:left'], ['marker', 'text-align:center'], ['note', 'text-align:right'],
    ]);
    expect(Array.from(table.querySelectorAll('tbody tr')).map((tr) => Array.from(tr.querySelectorAll('td')).map((td) => td.textContent))).toEqual([
      ['cloze', 'braces', 'a blank'], ['question', 'a double colon', 'two sides'],
    ]);
    // every drawn block keeps its source behind it
    const raws = blocks.filter((b) => b.kind === 'raw');
    for (const [i, a] of atoms.entries()) expect(a.querySelector('.raw-src')?.textContent).toBe(textOf(raws[i]));
    // the image paragraph: the picture, the alt as its caption
    const fig = dom.querySelector<HTMLElement>('p.dd-img')!;
    expect(fig).not.toBeNull();
    const img = fig.querySelector<HTMLImageElement>('img.md-img')!;
    expect(img.alt).toBe('the mark, larger');
    expect(img.getAttribute('src')).toMatch(/^data:image\/png;base64,/);
    expect(fig.querySelector('.md-alt')?.textContent).toBe('the mark, larger');
    expect(fig.textContent).toBe('![the mark, larger](markdown-sampler/mark.png)');
    view.destroy();
  });

  it('hides the markers on a frozen document and shows them again when it thaws', async () => {
    let frozen = true;
    const blocks = await sampler();
    const state = makeState(blocks, { frozen: () => frozen, pos: null });
    const view = new EditorView(document.body.appendChild(document.createElement('div')), { state, nodeViews, editable: () => !frozen });
    // the prose paragraphs' markers; a drawn quote's `<p>` has its own, always hidden
    const marks = () => Array.from(view.dom.querySelectorAll('p.dd-p .md-mark'));
    expect(marks().length).toBe(12);
    expect(marks().every((m) => m.classList.contains('hidden'))).toBe(true);
    expect(view.dom.querySelector('p.dd-p')?.textContent).toBe(textOf(blocks[1]));
    frozen = false;
    view.dispatch(view.state.tr.setMeta(frozenKey, false));
    expect(marks().length).toBe(12);
    expect(marks().some((m) => m.classList.contains('hidden'))).toBe(false);
    view.destroy();
  });

  it('shows a drawn block\'s source while it is selected', async () => {
    const view = mount(await sampler(), false);
    const list = view.dom.querySelector<HTMLElement>('.raw.rendered[data-kind="list"]')!;
    expect(list.classList.contains('selected')).toBe(false);
    let pos = 0;
    for (let i = 0; i < 2; i++) pos += view.state.doc.child(i).nodeSize;
    view.dispatch(view.state.tr.setSelection(NodeSelection.create(view.state.doc, pos)));
    expect(list.classList.contains('selected')).toBe(true);
    expect(list.querySelector('.raw-src')?.textContent).toBe('- the first point\n- the second, with *emphasis*\n- the third, with `code`');
    view.destroy();
  });

  it('a broken image reads as its alt in mono; a remote one waits on the toggle', async () => {
    const load: ImageLoader = async (src) => (src.startsWith('https://') ? 'hidden' : 'broken');
    const view = mount([
      { kind: 'paragraph', text: '![gone](nowhere/x.png)' },
      { kind: 'paragraph', text: '![from the web](https://example.org/a.png)' },
      { kind: 'paragraph', text: 'in the line ![gone too](y.png) here' },
    ], true, load);
    await tick();
    const [a, b, c] = Array.from(view.dom.querySelectorAll<HTMLElement>('p'));
    expect(a!.classList.contains('dd-img')).toBe(true);
    expect(a!.classList.contains('broken')).toBe(true);
    expect(a!.querySelector('img')).toBeNull();
    expect(a!.querySelector('.md-alt.broken')?.textContent).toBe('gone');
    expect(a!.querySelector<HTMLElement>('.md-img-slot')?.dataset.state).toBe('broken');
    expect(b!.classList.contains('dd-img')).toBe(true);
    expect(b!.classList.contains('kept')).toBe(true);
    expect(b!.querySelector('img')).toBeNull();
    expect(b!.querySelector('.md-alt')?.classList.contains('broken')).toBe(false);
    expect(b!.querySelector<HTMLElement>('.md-img-slot')?.dataset.state).toBe('hidden');
    expect(c!.classList.contains('dd-img')).toBe(false);
    expect(c!.querySelector('.md-alt.broken')?.textContent).toBe('gone too');
    view.destroy();
  });

  it('draws a remote image when the loader lets it through, and marks it broken when it fails to load', async () => {
    const view = mount([{ kind: 'paragraph', text: '![web](https://example.org/a.png)' }], true, async (src) => ({ url: src }));
    await tick();
    const img = view.dom.querySelector<HTMLImageElement>('p.dd-img img.md-img')!;
    expect(img.getAttribute('src')).toBe('https://example.org/a.png');
    img.dispatchEvent(new Event('error'));
    expect(view.dom.querySelector('p')?.classList.contains('broken')).toBe(true);
    expect(view.dom.querySelector('img')).toBeNull();
    view.destroy();
  });

  it('maps a selection over an emphasised passage back to the source with its markers', () => {
    const text = 'this is *very* important, and `code` too';
    const view = mount([{ kind: 'paragraph', text }], true);
    const p = view.dom.querySelector('p')!;
    expect(p.querySelector('.md-em')?.textContent).toBe('very');
    // the DOM range from "is" through " important", across the decorated spans, as the reader reads a selection
    const from = text.indexOf('is *');
    const to = text.indexOf(' important') + ' important'.length;
    const a = view.domAtPos(1 + from);
    const b = view.domAtPos(1 + to);
    expect(a.node.nodeType).toBe(3);
    expect(b.node.nodeType).toBe(3);
    expect(a.node).not.toBe(b.node);
    const range = document.createRange();
    range.setStart(a.node, a.offset);
    range.setEnd(b.node, b.offset);
    expect(range.toString()).toBe('is *very* important');
    const start = view.posAtDOM(range.startContainer, range.startOffset);
    const end = view.posAtDOM(range.endContainer, range.endOffset);
    expect(passage(view.state.doc, start, end)).toEqual({ text: 'is *very* important', blocks: [0] });
    view.destroy();
  });

  it('draws an EPUB chapter from the fixture: emphasis, strong, the list, the quote', async () => {
    const book = JSON.parse(await fsp.readFile(EPUB, 'utf8')) as Epub;
    const chapter = mapBook(book).chapters[0]!;
    const { doc, diagnostics } = parse(`${chapter.text}\n`);
    expect(diagnostics).toEqual([]);
    const view = mount(doc.blocks, true);
    expect(view.dom.querySelector('.md-em')?.textContent).toBe('small wager');
    expect(view.dom.querySelector('.md-strong')?.textContent).toBe('minimum information principle');
    expect(view.dom.querySelectorAll('.md-mark.hidden')).toHaveLength(4);
    expect(Array.from(view.dom.querySelectorAll('.raw-view ul li')).map((li) => li.textContent)).toEqual(['cost: the minutes', 'payoff: the years']);
    expect(view.dom.querySelector('.raw-view blockquote')?.textContent).toBe('Familiarity is cheap. Retrieval is the thing that lasts.');
    view.destroy();
  });
});

describe('inline ranges', () => {
  const kinds = (text: string) => inlineRanges(text).map((r) => [r.kind, text.slice(r.from, r.to), text.slice(r.inner.from, r.inner.to)]);

  it('finds emphasis, strong, code, links, and images', () => {
    expect(kinds('a *b* **c** `d` [e](f) ![g](h)')).toEqual([
      ['em', '*b*', 'b'], ['strong', '**c**', 'c'], ['code', '`d`', 'd'], ['link', '[e](f)', 'e'], ['image', '![g](h)', 'g'],
    ]);
    expect(inlineRanges('[e](f)')[0]!.href).toBe('f');
    expect(kinds('_u_ and __w__')).toEqual([['em', '_u_', 'u'], ['strong', '__w__', 'w']]);
  });

  it('nests, innermost first as the EPUB reduction writes them', () => {
    const [r] = inlineRanges('*both **ways***');
    expect(r).toMatchObject({ kind: 'em', from: 0, to: 15 });
    expect(r!.children.map((c) => c.kind)).toEqual(['strong']);
    const [s] = inlineRanges('***all***');
    expect(s).toMatchObject({ kind: 'strong', from: 0, to: 9 });
    expect(s!.children.map((c) => [c.kind, c.from, c.to])).toEqual([['em', 2, 7]]);
    const [l] = inlineRanges('[see *this*](x)');
    expect(l!.children.map((c) => c.kind)).toEqual(['em']);
  });

  it('leaves arithmetic, intraword underscores, lone markers, and unbalanced runs alone', () => {
    expect(inlineRanges('5 * 3 * 2')).toEqual([]);
    expect(inlineRanges('snake_case_name here')).toEqual([]);
    expect(inlineRanges('a * b')).toEqual([]);
    expect(inlineRanges('*open and never closed')).toEqual([]);
    expect(inlineRanges('`one `` two')).toEqual([]);
    expect(kinds('``code with ` inside``')).toEqual([['code', '``code with ` inside``', 'code with ` inside']]);
    expect(inlineRanges('[not a link] and [also](not a link)')).toEqual([]);
    expect(inlineRanges('escaped \\*not\\* em')).toEqual([]);
  });

  it('knows a paragraph that is one image', () => {
    expect(imageOnly('![a](b.png)')).toMatchObject({ kind: 'image', href: 'b.png' });
    expect(imageOnly('  ![a](b.png)  ')).toMatchObject({ from: 2, to: 13 });
    expect(imageOnly('![a](b.png) and words')).toBeNull();
    expect(imageOnly('![a](b.png) ![c](d.png)')).toBeNull();
  });
});

describe('raw block shapes', () => {
  it('reads code, lists, quotes, tables, and rules; keeps the rest as source', () => {
    expect(classifyRaw('```ts x\nlet a;\n```')).toEqual({ kind: 'code', lang: 'ts', code: 'let a;' });
    expect(classifyRaw('~~~\nno close')).toEqual({ kind: 'code', lang: '', code: 'no close' });
    expect(classifyRaw('    four\n\tand tab')).toEqual({ kind: 'code', lang: '', code: 'four\nand tab' });
    expect(classifyRaw('3) later\n4) number')).toEqual({ kind: 'list', ordered: true, start: 3, items: [{ text: 'later' }, { text: 'number' }] });
    expect(classifyRaw('- a\n  continued\n  - nested\n- b')).toEqual({ kind: 'list', ordered: false, start: 1, items: [{ text: 'a\ncontinued\n- nested' }, { text: 'b' }] });
    expect(classifyRaw('> a\n>\n> b\nlazy')).toEqual({ kind: 'quote', text: 'a\n\nb\nlazy' });
    expect(classifyRaw('| a | b |\n|---|--:|\n| 1 | 2 | 3 |\n| x |')).toEqual({ kind: 'table', align: [null, 'right'], head: ['a', 'b'], rows: [['1', '2'], ['x', '']] });
    expect(classifyRaw('| a |\n| b |')).toEqual({ kind: 'other' });
    expect(classifyRaw('***')).toEqual({ kind: 'rule' });
    expect(classifyRaw('- - -')).toEqual({ kind: 'rule' });
    expect(classifyRaw('<div class="callout">\nhtml\n</div>')).toEqual({ kind: 'other' });
    expect(classifyRaw('<!--SR:!2026-01-01,4,270-->')).toEqual({ kind: 'other' });
    expect(splitBlocks('a\n\nb\n```\n\nc\n```\nd')).toEqual(['a', 'b', '```\n\nc\n```', 'd']);
    // a list runs to the blank line, as the format's raw block does; a heading is one line
    expect(splitBlocks('a\n- one\n- two\n> q\nlazy\n\n# h\ntext')).toEqual(['a', '- one\n- two\n> q\nlazy', '# h', 'text']);
  });

  it('renders the nested list, the quote\'s paragraphs, and leaves html as source', () => {
    expect(rawHTML('- a\n  - nested\n- b')!.html).toBe('<ul><li>a<ul><li>nested</li></ul></li><li>b</li></ul>');
    expect(rawHTML('> # head\n>\n> body *em*')!.html).toBe('<blockquote><h1>head</h1><p>body <span class="md-mark hidden">*</span><span class="md-em">em</span><span class="md-mark hidden">*</span></p></blockquote>');
    expect(rawHTML('- a\n\n  two paragraphs')!.html).toBe('<ul><li><p>a</p><p>two paragraphs</p></li></ul>');
    expect(rawHTML('```\n<b>&</b>\n```')!.html).toBe('<pre><code>&lt;b&gt;&amp;&lt;/b&gt;</code></pre>');
    expect(rawHTML('<div>x</div>')).toBeNull();
  });
});

describe('the read-only text: rows and faces', () => {
  it('draws inline markdown in richHTML, the markers kept but hidden', () => {
    expect(richHTML('a *b* and `c`')).toBe('a <span class="md-mark hidden">*</span><span class="md-em">b</span><span class="md-mark hidden">*</span> and <span class="md-mark hidden">`</span><span class="md-code">c</span><span class="md-mark hidden">`</span>');
    expect(richHTML('[t](https://x.y/?a=1&b=2)')).toBe('<span class="md-mark hidden">[</span><span class="md-link" data-href="https://x.y/?a=1&amp;b=2">t</span><span class="md-mark hidden">](https://x.y/?a=1&amp;b=2)</span>');
    // a note inside a link or a code span is not a note; a tag inside code is not a tag
    expect(richHTML('[a](b) [n] `#x:` #y:')).toBe('<span class="md-mark hidden">[</span><span class="md-link" data-href="b">a</span><span class="md-mark hidden">](b)</span> <span class="ed-mark note">[n]</span> <span class="md-mark hidden">`</span><span class="md-code">#x:</span><span class="md-mark hidden">`</span> <span class="ed-mark tag">#y:</span>');
    // math still chips, emphasis around it still reads
    expect(richHTML('so *x* is $y$')).toContain('<span class="math" data-tex="$y$">');
    expect(richHTML('so *x* is $y$')).toContain('<span class="md-em">x</span>');
  });

  it('a card with inline code reads right on the faces and in the deck', () => {
    const text = 'the {{c1::answer}} is `code`, and *so*';
    const cls = (s: BlankState) => (s === 'hidden' ? 'cloze' : s === 'revealed' ? 'cloze revealed' : 'cloze ctx');
    const hidden = clozeHTML(text, () => 'hidden', cls);
    expect(hidden).toBe('the <span class="cloze">answer</span> is <span class="md-mark hidden">`</span><span class="md-code">code</span><span class="md-mark hidden">`</span>, and <span class="md-mark hidden">*</span><span class="md-em">so</span><span class="md-mark hidden">*</span>');
    expect(cardHTML({ kind: 'card', text: '**bold** question :: `a` answer' })).toBe('<span class="cs-q"><span class="md-mark hidden">**</span><span class="md-strong">bold</span><span class="md-mark hidden">**</span> question</span><span class="cs-a"><span class="md-mark hidden">`</span><span class="md-code">a</span><span class="md-mark hidden">`</span> answer</span>');
    // the answer face of a blank holding emphasis
    expect(answerHTML({ n: 1, answer: '*em*', raw: '{{c1::*em*}}' })).toBe('<span class="md-mark hidden">*</span><span class="md-em">em</span><span class="md-mark hidden">*</span>');
  });
});

describe('image sources', () => {
  it('resolves a relative source against the document, from the root with a slash, and refuses a climb out', () => {
    expect(imagePath('fleeting/markdown-sampler.md', 'markdown-sampler/mark.png')).toBe('fleeting/markdown-sampler/mark.png');
    expect(imagePath('fleeting/a.md', './b/../c.png')).toBe('fleeting/c.png');
    expect(imagePath('fleeting/a.md', '../papers/x.png')).toBe('papers/x.png');
    expect(imagePath('a.md', '../x.png')).toBeNull();
    expect(imagePath('fleeting/a.md', '/x.png')).toBe('x.png');
    expect(imagePath('fleeting/a.md', 'a%20b.png?x=1#frag')).toBe('fleeting/a b.png');
    expect(imagePath('fleeting/a.md', '')).toBeNull();
  });

  it('tells a remote source from a vault one, and a type from a name', () => {
    expect(isRemote('https://x.y/a.png')).toBe(true);
    expect(isRemote('data:image/png;base64,AA==')).toBe(true);
    expect(isRemote('//cdn.x/a.png')).toBe(true);
    expect(isRemote('a/b.png')).toBe(false);
    expect(mimeOf('a.PNG')).toBe('image/png');
    expect(mimeOf('a.jpg')).toBe('image/jpeg');
    expect(mimeOf('a.svg')).toBe('image/svg+xml');
    expect(mimeOf('a.bin')).toBe('application/octet-stream');
  });
});
