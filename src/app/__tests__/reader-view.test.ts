// @vitest-environment jsdom
// The reader's DOM: node views over a real EditorView, without the window;
// Markdown drawn as Markdown over the sampler and an EPUB chapter, the
// markers following the caret, a formula edited under its chip.

import { NodeSelection, TextSelection } from 'prosemirror-state';
import { EditorView, type DirectEditorProps } from 'prosemirror-view';
import { promises as fsp } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import { blanks, parse, type Blank, type Block, type Card } from '../../format/index.js';
import { mapBook, type Epub } from '../../import/epub.js';
import { classifyRaw, fromDoc, frozenKey, imageOnly, inlineRanges, makeState, mathEditKey, passage, revealBackward, schema, splitBlocks, toDoc, type ImageLoader } from '../../reader/index.js';
import { insideMath, withBlank } from '../Composer.js';
import { imagePath, isRemote, mimeOf } from '../images.js';
import { dueLabel } from '../items.js';
import { answerHTML, cardHTML, clozeHTML, handleClickOn, nodeViews, rawHTML, richHTML, selectionBox, type BlankState } from '../Reader.js';

const CORPUS = join(dirname(fileURLToPath(import.meta.url)), '../../format/__tests__/corpus/vault/papers');
const WOZ = join(CORPUS, 'wozniak-1990.md');
const MAXWELL = join(CORPUS, 'maxwell.md');
const SAMPLER = join(CORPUS, '../fleeting/markdown-sampler.md');
const MARK = join(CORPUS, '../fleeting/markdown-sampler/mark.png');
const EPUB = join(dirname(fileURLToPath(import.meta.url)), '../../import/__tests__/epub/three-chapters.json');

function mount(blocks: Block[], frozen = false, images?: ImageLoader, props: Partial<DirectEditorProps> = {}): EditorView {
  const state = makeState(blocks, { frozen: () => frozen, pos: 3, ...(images ? { images } : {}) });
  return new EditorView(document.body.appendChild(document.createElement('div')), {
    state, nodeViews, editable: () => !frozen, attributes: { class: 'draft-doc' }, handleClickOn, ...props,
  });
}

/** Put a collapsed caret at `pos`. */
const caretAt = (view: EditorView, pos: number) => view.dispatch(view.state.tr.setSelection(TextSelection.create(view.state.doc, pos)));
/** The markers showing in `el`, in order. */
const shown = (el: Element) => Array.from(el.querySelectorAll('.md-mark:not(.hidden)')).map((m) => m.textContent);
/** A key pressed on `el`; true when something took it. */
const key = (el: Element, key: string, init: KeyboardEventInit = {}) => {
  const ev = new KeyboardEvent('keydown', { key, bubbles: true, cancelable: true, ...init });
  el.dispatchEvent(ev);
  return ev.defaultPrevented;
};

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
    // a raw list is a list of its own, the marker drawn beside the text
    expect(view.dom.querySelector('.dd-list .dd-li .li-text')?.textContent).toBe('a list');
    expect(view.dom.querySelector('.dd-list .dd-li .li-mark')?.textContent).toBe('•');
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
    // ten markers: two each for emphasis, strong, and code, the brackets of the link and of the image; all hidden with the caret elsewhere
    const marks = Array.from(p.querySelectorAll('.md-mark')).map((m) => m.textContent);
    expect(marks).toEqual(['*', '*', '**', '**', '`', '`', '[', '](https://commonmark.org/)', '![', '](markdown-sampler/mark.png)']);
    expect(p.querySelectorAll('.md-mark.hidden')).toHaveLength(10);
    // the source is what the paragraph says, character for character
    expect(p.textContent).toBe(textOf(blocks[1]));
    // an image in the line: its alt lit, the picture drawn before it
    expect(p.querySelector('.md-alt')?.textContent).toBe('a small mark');
    const inlineImg = p.querySelector<HTMLImageElement>('img.md-img')!;
    expect(inlineImg.alt).toBe('a small mark');
    expect(inlineImg.getAttribute('src')).toMatch(/^data:image\/png;base64,/);
    view.destroy();
  });

  it('draws each block form: the list as items beside their markers, the code a pre with the language, the quote its lines, the table an atom, the image an img', async () => {
    const blocks = await sampler();
    const view = mount(blocks, true, loader(await dataUrl()));
    await tick();
    const dom = view.dom;
    expect(dom.children).toHaveLength(blocks.length);
    expect(dom.querySelector('h2.dd-h')?.textContent).toBe('a sampler of markdown');
    // only the table is still an atom
    const atoms = Array.from(dom.querySelectorAll<HTMLElement>('.raw.rendered'));
    expect(atoms.map((a) => a.dataset.kind)).toEqual(['table']);
    for (const a of atoms) expect(a.getAttribute('contenteditable')).toBe('false');
    const lists = Array.from(dom.querySelectorAll<HTMLElement>('.dd-list'));
    expect(lists).toHaveLength(2);
    const items = (l: HTMLElement) => Array.from(l.querySelectorAll<HTMLElement>('.dd-li'));
    expect(items(lists[0]!).map((li) => li.querySelector('.li-text')?.textContent)).toEqual(['the first point', 'the second, with *emphasis*', 'the third, with `code`']);
    expect(items(lists[0]!).map((li) => li.querySelector('.li-mark')?.textContent)).toEqual(['•', '•', '•']);
    expect(items(lists[0]!).map((li) => li.dataset.marker)).toEqual(['-', '-', '-']);
    expect(lists[0]!.querySelector('.dd-li .md-em')?.textContent).toBe('emphasis');
    expect(lists[0]!.querySelector('.dd-li .md-code')?.textContent).toBe('code');
    // an item's markers are hidden with the caret elsewhere, as a paragraph's are
    expect(lists[0]!.querySelectorAll('.md-mark')).toHaveLength(4);
    expect(lists[0]!.querySelectorAll('.md-mark.hidden')).toHaveLength(4);
    expect(items(lists[1]!).map((li) => li.querySelector('.li-mark')?.textContent)).toEqual(['1.', '2.', '3.']);
    expect(items(lists[1]!).map((li) => li.querySelector('.li-text')?.textContent)).toEqual(['one', 'two', 'three']);
    const quote = dom.querySelector('blockquote.dd-quote')!;
    expect(quote.querySelector('.md-strong')?.textContent).toBe('weight');
    expect(Array.from(quote.querySelectorAll('.dd-ql')).map((l) => l.textContent)).toEqual(['A quotation set apart, with **weight** in it.', 'It runs to a second line.']);
    const code = dom.querySelector<HTMLElement>('pre.dd-code')!;
    expect(code.dataset.lang).toBe('js');
    expect(code.querySelector('code')?.className).toBe('language-js');
    expect(code.textContent).toBe('const due = schedule(card, now);');
    expect(code.querySelectorAll('.md-mark, .math, .ed-mark')).toHaveLength(0);
    const table = dom.querySelector('.raw-view table')!;
    expect(Array.from(table.querySelectorAll('th')).map((th) => [th.textContent, th.getAttribute('style')])).toEqual([
      ['form', 'text-align:left'], ['marker', 'text-align:center'], ['note', 'text-align:right'],
    ]);
    expect(Array.from(table.querySelectorAll('tbody tr')).map((tr) => Array.from(tr.querySelectorAll('td')).map((td) => td.textContent))).toEqual([
      ['cloze', 'braces', 'a blank'], ['question', 'a double colon', 'two sides'],
    ]);
    // the drawn atom keeps its source behind it
    expect(atoms[0]!.querySelector('.raw-src')?.textContent).toBe(textOf(blocks.filter((b) => b.kind === 'raw')[4]));
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

  it('hides every marker with the caret elsewhere, frozen or thawed, and shows a range\'s around the caret on both', async () => {
    let frozen = true;
    const blocks = await sampler();
    const state = makeState(blocks, { frozen: () => frozen, pos: null });
    const view = new EditorView(document.body.appendChild(document.createElement('div')), { state, nodeViews, editable: () => !frozen });
    // the prose paragraphs' markers; a drawn quote's `<p>` has its own, always hidden
    const marks = () => Array.from(view.dom.querySelectorAll('p.dd-p .md-mark'));
    expect(marks().length).toBe(12);
    expect(marks().every((m) => m.classList.contains('hidden'))).toBe(true);
    const p = view.dom.querySelector<HTMLElement>('p.dd-p')!;
    expect(p.textContent).toBe(textOf(blocks[1]));
    // thawed, the caret still in the heading: nothing changes
    frozen = false;
    view.dispatch(view.state.tr.setMeta(frozenKey, false));
    expect(marks().length).toBe(12);
    expect(marks().every((m) => m.classList.contains('hidden'))).toBe(true);
    // the caret inside `**strong**`: that pair shows, the rest stay hidden
    const text = textOf(blocks[1]);
    const pStart = 1 + view.state.doc.child(0).nodeSize;
    caretAt(view, pStart + 1 + text.indexOf('strong') + 2);
    expect(shown(p)).toEqual(['**', '**']);
    expect(p.querySelectorAll('.md-mark.hidden')).toHaveLength(8);
    // frozen again with the caret there: the same
    frozen = true;
    view.dispatch(view.state.tr.setMeta(frozenKey, true));
    expect(shown(p)).toEqual(['**', '**']);
    view.destroy();
  });

  it('shows a drawn atom\'s source while it is selected', async () => {
    const view = mount(await sampler(), false);
    const table = view.dom.querySelector<HTMLElement>('.raw.rendered[data-kind="table"]')!;
    expect(table.classList.contains('selected')).toBe(false);
    let pos = 0;
    for (let i = 0; i < 6; i++) pos += view.state.doc.child(i).nodeSize;
    expect(view.state.doc.child(6).type).toBe(schema.nodes.raw);
    view.dispatch(view.state.tr.setSelection(NodeSelection.create(view.state.doc, pos)));
    expect(table.classList.contains('selected')).toBe(true);
    expect(table.querySelector('.raw-src')?.textContent).toBe('| form | marker | note |\n|:-----|:------:|-----:|\n| cloze | braces | a blank |\n| question | a double colon | two sides |');
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

  it('maps a selection over an emphasised passage back to the source with its markers, hidden as they are', () => {
    const text = 'this is *very* important, and `code` too';
    const view = mount([{ kind: 'paragraph', text }], true);
    const p = view.dom.querySelector('p')!;
    expect(p.querySelector('.md-em')?.textContent).toBe('very');
    expect(p.querySelectorAll('.md-mark.hidden')).toHaveLength(4);
    expect(shown(p)).toEqual([]);
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
    expect(Array.from(view.dom.querySelectorAll('.dd-li .li-text')).map((li) => li.textContent)).toEqual(['cost: the minutes', 'payoff: the years']);
    expect(view.dom.querySelector('blockquote.dd-quote')?.textContent).toBe('Familiarity is cheap. Retrieval is the thing that lasts.');
    view.destroy();
  });
});

describe('markers around the caret', () => {
  const text = 'one *em* and **st** and [l](h) end';
  const at = (needle: string, off = 0) => 1 + text.indexOf(needle) + off;

  it('shows only the range under the caret, and moves between two emphasised spans with it', () => {
    const view = mount([{ kind: 'paragraph', text }]);
    const p = view.dom.querySelector('p')!;
    expect(shown(p)).toEqual([]);
    caretAt(view, at('em', 1));
    expect(shown(p)).toEqual(['*', '*']);
    expect(p.textContent).toBe(text);
    caretAt(view, at('st', 1));
    expect(shown(p)).toEqual(['**', '**']);
    caretAt(view, at('l](h)'));
    expect(shown(p)).toEqual(['[', '](h)']);
    caretAt(view, at('and'));
    expect(shown(p)).toEqual([]);
    // a selection across both spans shows both pairs
    view.dispatch(view.state.tr.setSelection(TextSelection.create(view.state.doc, at('em'), at('st', 1))));
    expect(shown(p)).toEqual(['*', '*', '**', '**']);
    // moved to the edge just after a span, not typed there: still rendered
    caretAt(view, at('* and', 1));
    expect(shown(p)).toEqual([]);
    view.destroy();
  });

  it('redraws the paragraph that lost the caret and the one that gained it', () => {
    const view = mount([{ kind: 'paragraph', text: 'a *b* c' }, { kind: 'paragraph', text: 'd **e** f' }]);
    const [p1, p2] = Array.from(view.dom.querySelectorAll('p'));
    caretAt(view, 1 + 3);
    expect(shown(p1!)).toEqual(['*', '*']);
    expect(shown(p2!)).toEqual([]);
    const second = 1 + view.state.doc.child(0).nodeSize;
    caretAt(view, second + 1 + 4);
    expect(shown(p1!)).toEqual([]);
    expect(shown(p2!)).toEqual(['**', '**']);
    view.destroy();
  });

  it('a backspace into a hidden marker reveals it without deleting; a forward delete likewise', () => {
    const view = mount([{ kind: 'paragraph', text: 'so *em* x' }]);
    const p = view.dom.querySelector('p')!;
    caretAt(view, 1 + 'so *em*'.length);
    expect(shown(p)).toEqual([]);
    expect(key(view.dom, 'Backspace')).toBe(true);
    expect(p.textContent).toBe('so *em* x');
    expect(shown(p)).toEqual(['*', '*']);
    expect(view.state.selection.from).toBe(1 + 'so *em*'.length);
    // revealed, the next backspace is the browser's: a visible character goes
    expect(revealBackward(view.state)).toBe(false);
    expect(key(view.dom, 'Backspace')).toBe(false);
    // from the other side
    caretAt(view, 1 + 'so '.length);
    expect(shown(p)).toEqual([]);
    expect(key(view.dom, 'Delete')).toBe(true);
    expect(shown(p)).toEqual(['*', '*']);
    expect(p.textContent).toBe('so *em* x');
    // moving away lets the edge go
    caretAt(view, 1);
    expect(shown(p)).toEqual([]);
    view.destroy();
  });

  it('typing `*word*` lights as it closes, and settles once the caret moves on', () => {
    const view = mount([{ kind: 'paragraph', text: 'say ' }]);
    const p = view.dom.querySelector('p')!;
    caretAt(view, 1 + 4);
    for (const ch of '*word') view.dispatch(view.state.tr.insertText(ch));
    expect(p.querySelectorAll('.md-mark')).toHaveLength(0);
    view.dispatch(view.state.tr.insertText('*'));
    expect(shown(p)).toEqual(['*', '*']);
    expect(p.querySelector('.md-em')?.textContent).toBe('word');
    view.dispatch(view.state.tr.insertText(' '));
    expect(shown(p)).toEqual([]);
    expect(p.textContent).toBe('say *word* ');
    view.destroy();
  });
});

describe('a formula edited in place', () => {
  /** A view that counts the transactions that changed the document. */
  function counting(blocks: Block[], frozen = false): { view: EditorView; writes: () => number } {
    let n = 0;
    const view = mount(blocks, frozen, undefined, {
      dispatchTransaction(this: EditorView, tr) {
        if (tr.docChanged) n++;
        this.updateState(this.state.apply(tr));
      },
    });
    return { view, writes: () => n };
  }
  const click = (view: EditorView, pos: number) => handleClickOn(view, pos, view.state.doc.nodeAt(pos)!, pos, new MouseEvent('mouseup'), true);
  const field = (view: EditorView) => view.dom.querySelector<HTMLTextAreaElement>('.math .math-edit textarea');
  const type = (f: HTMLTextAreaElement, value: string) => { f.value = value; f.dispatchEvent(new Event('input', { bubbles: true })); };
  const raw = (view: EditorView, pos: number) => view.state.doc.nodeAt(pos)?.attrs.raw;

  it('opens on a click with the TeX between the dollars, re-renders as you type, writes once on ⏎', () => {
    const { view, writes } = counting([{ kind: 'paragraph', text: 'so $y = x^{2}$ here' }]);
    const pos = 1 + 3;
    expect(field(view)).toBeNull();
    expect(click(view, pos)).toBe(true);
    const chip = view.dom.querySelector<HTMLElement>('.math')!;
    expect(chip.classList.contains('editing')).toBe(true);
    expect(mathEditKey.getState(view.state)).toBe(pos);
    const f = field(view)!;
    expect(f.value).toBe('y = x^{2}');
    expect(document.activeElement).toBe(f);
    // typed: the chip shows the new TeX, the source stays the node's until it is written
    type(f, 'y = x^{3}');
    expect(chip.querySelector('.katex')?.textContent).toContain('3');
    expect(chip.querySelector('.katex')?.textContent).not.toContain('2');
    expect(chip.dataset.tex).toBe('$y = x^{2}$');
    expect(chip.querySelector('.err')?.textContent).toBe('');
    expect(writes()).toBe(0);
    // ⏎: one transaction, the chip as written, the caret after it
    expect(key(f, 'Enter')).toBe(true);
    expect(field(view)).toBeNull();
    expect(writes()).toBe(1);
    expect(raw(view, pos)).toBe('$y = x^{3}$');
    expect(chip.dataset.tex).toBe('$y = x^{3}$');
    expect(chip.classList.contains('editing')).toBe(false);
    expect(mathEditKey.getState(view.state)).toBeNull();
    expect(view.state.selection).toBeInstanceOf(TextSelection);
    expect(view.state.selection.from).toBe(pos + 1);
    expect(view.state.doc.child(0).textContent).toBe('so $y = x^{3}$ here');
    view.destroy();
  });

  it('writes nothing on Escape and puts the chip back as it was', () => {
    const { view, writes } = counting([{ kind: 'paragraph', text: 'so $y = x^{2}$ here' }]);
    const pos = 4;
    click(view, pos);
    const chip = view.dom.querySelector<HTMLElement>('.math')!;
    type(field(view)!, 'z');
    expect(chip.querySelector('.katex')?.textContent).toContain('z');
    expect(key(field(view)!, 'Escape')).toBe(true);
    expect(field(view)).toBeNull();
    expect(writes()).toBe(0);
    expect(raw(view, pos)).toBe('$y = x^{2}$');
    expect(chip.querySelector('.katex')?.textContent).not.toContain('z');
    expect(chip.querySelector('.katex')?.textContent).toContain('2');
    expect(mathEditKey.getState(view.state)).toBeNull();
    view.destroy();
  });

  it('says what KaTeX refused under the field and leaves the chip until the TeX parses', () => {
    const { view } = counting([{ kind: 'paragraph', text: 'so $y = x^{2}$ here' }]);
    click(view, 4);
    const chip = view.dom.querySelector<HTMLElement>('.math')!;
    const before = chip.querySelector('.katex')!.outerHTML;
    const f = field(view)!;
    type(f, '\\frac{1');
    const err = chip.querySelector('.math-edit .err')!;
    expect(err.textContent).toBe("Unexpected end of input in a macro argument, expected '}' at end of input");
    expect(chip.querySelector('.katex')!.outerHTML).toBe(before);
    type(f, '\\frac{1}{2}');
    expect(err.textContent).toBe('');
    expect(chip.querySelector('.katex .frac-line')).not.toBeNull();
    view.destroy();
  });

  it('opens on ⏎ with the chip selected, keeps `$$`, and breaks a line with ⇧⏎ only in display math', () => {
    const { view, writes } = counting([{ kind: 'paragraph', text: 'so $a$ and $$b = c$$' }]);
    const inlinePos = 4;
    const displayPos = 1 + 'so '.length + 1 + ' and '.length;
    expect(view.state.doc.nodeAt(displayPos)?.type).toBe(schema.nodes.math);
    view.dispatch(view.state.tr.setSelection(NodeSelection.create(view.state.doc, displayPos)));
    expect(key(view.dom, 'Enter')).toBe(true);
    const f = field(view)!;
    expect(f.value).toBe('b = c');
    expect(f.closest('.math')?.classList.contains('display')).toBe(true);
    // ⇧⏎ is the field's own in display math
    expect(key(f, 'Enter', { shiftKey: true })).toBe(false);
    type(f, 'b = c \\\\\\\\ d = e');
    key(f, 'Enter');
    expect(raw(view, displayPos)).toBe('$$b = c \\\\\\\\ d = e$$');
    expect(writes()).toBe(1);
    // the inline chip refuses the break: its span cannot hold one
    click(view, inlinePos);
    expect(key(field(view)!, 'Enter', { shiftKey: true })).toBe(true);
    key(field(view)!, 'Escape');
    view.destroy();
  });

  it('leaves to the side an arrow at the field\'s end points to, and writes on a click outside', () => {
    const { view, writes } = counting([{ kind: 'paragraph', text: 'so $y$ here' }]);
    const pos = 4;
    click(view, pos);
    let f = field(view)!;
    f.setSelectionRange(0, 0);
    expect(key(f, 'ArrowLeft')).toBe(true);
    expect(field(view)).toBeNull();
    expect(view.state.selection.from).toBe(pos);
    expect(writes()).toBe(0);
    click(view, pos);
    f = field(view)!;
    f.setSelectionRange(1, 1);
    key(f, 'ArrowRight');
    expect(view.state.selection.from).toBe(pos + 1);
    // in the middle, the arrows are the field's own
    click(view, pos);
    f = field(view)!;
    type(f, 'yz');
    f.setSelectionRange(1, 1);
    expect(key(f, 'ArrowLeft')).toBe(false);
    expect(field(view)).not.toBeNull();
    // a press elsewhere writes
    document.body.dispatchEvent(new MouseEvent('mousedown', { bubbles: true }));
    expect(field(view)).toBeNull();
    expect(raw(view, pos)).toBe('$yz$');
    expect(writes()).toBe(1);
    view.destroy();
  });

  it('an empty field removes the chip, a span the format cannot read becomes text, a frozen document opens nothing', () => {
    const { view, writes } = counting([{ kind: 'paragraph', text: 'so $y$ here' }]);
    const pos = 4;
    click(view, pos);
    type(field(view)!, ' a');
    key(field(view)!, 'Enter');
    expect(view.state.doc.child(0).childCount).toBe(1);
    expect(view.dom.querySelector('p')?.textContent).toBe('so $ a$ here');
    expect(view.state.selection.from).toBe(pos + '$ a$'.length);
    const blocks: Block[] = [{ kind: 'paragraph', text: 'so $y$ here' }];
    const again = counting(blocks);
    click(again.view, pos);
    type(field(again.view)!, '   ');
    key(field(again.view)!, 'Enter');
    expect(again.view.dom.querySelector('p')?.textContent).toBe('so  here');
    expect(again.view.state.selection.from).toBe(pos);
    expect(again.writes()).toBe(1);
    expect(writes()).toBe(1);
    const frozen = counting(blocks, true);
    expect(click(frozen.view, pos)).toBe(false);
    expect(field(frozen.view)).toBeNull();
    view.destroy();
    again.view.destroy();
    frozen.view.destroy();
  });
});

describe('live blocks', () => {
  const sampler = async () => parse(await fsp.readFile(SAMPLER, 'utf8')).doc.blocks;
  /** The position before the document's child `i`. */
  const startOf = (view: EditorView, i: number) => { let pos = 0; for (let k = 0; k < i; k++) pos += view.state.doc.child(k).nodeSize; return pos; };
  /** The position before item (or line) `j` of the block at child `i`. */
  const itemPos = (view: EditorView, i: number, j: number) => { const block = view.state.doc.child(i); let pos = startOf(view, i) + 1; for (let k = 0; k < j; k++) pos += block.child(k).nodeSize; return pos; };
  const itemStart = (view: EditorView, i: number, j: number) => itemPos(view, i, j) + 1;
  const itemEnd = (view: EditorView, i: number, j: number) => itemPos(view, i, j) + view.state.doc.child(i).child(j).nodeSize - 1;
  /** The raw text child `i` writes back as. */
  const raw = (view: EditorView, i: number) => (fromDoc(view.state.doc)[i] as { text: string }).text;
  const mod = /Mac/.test(navigator.platform) ? { metaKey: true } : { ctrlKey: true };

  it('a code block is typed into in place: ⏎ a newline, Tab two spaces, nothing drawn, ⌘⏎ out; the fence as it was', async () => {
    const view = mount(await sampler());
    const code = view.dom.querySelector<HTMLElement>('pre.dd-code')!;
    const i = 5;
    expect(view.state.doc.child(i).type).toBe(schema.nodes.code_block);
    const line = 'const due = schedule(card, now);';
    caretAt(view, startOf(view, i) + 1 + line.length);
    expect(key(view.dom, 'Enter')).toBe(true);
    view.dispatch(view.state.tr.insertText('return due;'));
    expect(code.textContent).toBe(`${line}\nreturn due;`);
    expect(raw(view, i)).toBe(`\`\`\`js\n${line}\nreturn due;\n\`\`\``);
    caretAt(view, startOf(view, i) + 1 + line.length + 1);
    expect(key(view.dom, 'Tab')).toBe(true);
    expect(raw(view, i)).toBe(`\`\`\`js\n${line}\n  return due;\n\`\`\``);
    // what is typed there is code: no marker, no chip, no mark, no heading
    view.dispatch(view.state.tr.insertText('*a* $b$ [c] '));
    expect(code.querySelectorAll('.md-mark, .md-em, .math, .ed-mark')).toHaveLength(0);
    caretAt(view, startOf(view, i) + 1);
    view.dispatch(view.state.tr.insertText('# '));
    expect(view.state.doc.child(i).type).toBe(schema.nodes.code_block);
    expect(raw(view, i)).toBe(`\`\`\`js\n# ${line}\n  *a* $b$ [c] return due;\n\`\`\``);
    // ⌘⏎ leaves: a paragraph after the block, the caret in it
    expect(key(view.dom, 'Enter', mod)).toBe(true);
    expect(view.state.doc.child(i + 1).type).toBe(schema.nodes.paragraph);
    expect(view.state.selection.$from.parent).toBe(view.state.doc.child(i + 1));
    // the file still reads the block as one fenced code block
    expect(parse(`${raw(view, i)}\n`).doc.blocks).toEqual([{ kind: 'raw', text: raw(view, i) }]);
    view.destroy();
  });

  it('⏎ at the end of an item makes the next with the numbers on, in the middle splits it, on an empty item leaves the list', async () => {
    const view = mount(await sampler());
    const i = 3;
    const list = view.dom.querySelectorAll<HTMLElement>('.dd-list')[1]!;
    const marks = () => Array.from(list.querySelectorAll('.li-mark')).map((m) => m.textContent);
    expect(raw(view, i)).toBe('1. one\n2. two\n3. three');
    caretAt(view, itemEnd(view, i, 2));
    expect(key(view.dom, 'Enter')).toBe(true);
    expect(marks()).toEqual(['1.', '2.', '3.', '4.']);
    expect(raw(view, i)).toBe('1. one\n2. two\n3. three\n4. ');
    expect(view.state.selection.from).toBe(itemStart(view, i, 3));
    view.dispatch(view.state.tr.insertText('four'));
    expect(raw(view, i)).toBe('1. one\n2. two\n3. three\n4. four');
    // in the middle of an item: the text after the caret goes to the new one, the ones after it are numbered on
    caretAt(view, itemStart(view, i, 1) + 1);
    key(view.dom, 'Enter');
    expect(raw(view, i)).toBe('1. one\n2. t\n3. wo\n4. three\n5. four');
    expect(marks()).toEqual(['1.', '2.', '3.', '4.', '5.']);
    // an empty last item: ⏎ leaves, a paragraph after the list with the caret in it
    caretAt(view, itemEnd(view, i, 4));
    key(view.dom, 'Enter');
    expect(raw(view, i)).toBe('1. one\n2. t\n3. wo\n4. three\n5. four\n6. ');
    key(view.dom, 'Enter');
    expect(raw(view, i)).toBe('1. one\n2. t\n3. wo\n4. three\n5. four');
    expect(view.state.doc.child(i + 1).type).toBe(schema.nodes.paragraph);
    expect(view.state.selection.$from.parent).toBe(view.state.doc.child(i + 1));
    view.dispatch(view.state.tr.insertText('after'));
    expect(fromDoc(view.state.doc)[i + 1]).toEqual({ kind: 'paragraph', text: 'after' });
    // a bullet list continues with its own bullet
    caretAt(view, itemEnd(view, 2, 2));
    key(view.dom, 'Enter');
    view.dispatch(view.state.tr.insertText('a fourth'));
    expect(raw(view, 2)).toBe('- the first point\n- the second, with *emphasis*\n- the third, with `code`\n- a fourth');
    // the item's markers follow the caret as a paragraph's do
    caretAt(view, itemStart(view, 2, 1) + 'the second, with *e'.length);
    expect(shown(view.dom.querySelectorAll('.dd-list')[0]!)).toEqual(['*', '*']);
    view.destroy();
  });

  it('a task box draws, toggles on a click and writes the character; a backspace at the start takes the box, then makes the item a paragraph, then puts it back', () => {
    const view = mount([{ kind: 'raw', text: '- [ ] milk\n- [x] bread\n- eggs' }]);
    const boxes = () => Array.from(view.dom.querySelectorAll<HTMLElement>('.li-task')).map((b) => b.dataset.checked);
    const click = (box: Element) => box.dispatchEvent(new MouseEvent('mousedown', { bubbles: true, cancelable: true }));
    expect(boxes()).toEqual(['0', '1']);
    expect(view.dom.querySelector('.dd-li .li-text')?.textContent).toBe('milk');
    click(view.dom.querySelector('.li-task')!);
    expect(boxes()).toEqual(['1', '1']);
    expect(raw(view, 0)).toBe('- [x] milk\n- [x] bread\n- eggs');
    click(view.dom.querySelectorAll('.li-task')[1]!);
    expect(raw(view, 0)).toBe('- [x] milk\n- [ ] bread\n- eggs');
    // ⏎ at the end of a task item: the next has an empty box
    caretAt(view, itemEnd(view, 0, 0));
    key(view.dom, 'Enter');
    expect(raw(view, 0)).toBe('- [x] milk\n- [ ] \n- [ ] bread\n- eggs');
    expect(boxes()).toEqual(['1', '0', '0']);
    // backspace at its start: the box goes, then the item is a paragraph between the halves, then it goes back on the item above
    expect(key(view.dom, 'Backspace')).toBe(true);
    expect(raw(view, 0)).toBe('- [x] milk\n- \n- [ ] bread\n- eggs');
    expect(key(view.dom, 'Backspace')).toBe(true);
    expect(view.state.doc.child(1).type).toBe(schema.nodes.paragraph);
    expect(fromDoc(view.state.doc)).toEqual([{ kind: 'raw', text: '- [x] milk' }, { kind: 'raw', text: '- [ ] bread\n- eggs' }]);
    expect(key(view.dom, 'Backspace')).toBe(true);
    expect(raw(view, 0)).toBe('- [x] milk\n- [ ] bread\n- eggs');
    expect(view.state.selection.from).toBe(itemEnd(view, 0, 0));
    // backspace twice at the start of the second item: its box, then a paragraph; a third puts its text on the first
    caretAt(view, itemStart(view, 0, 1));
    key(view.dom, 'Backspace');
    key(view.dom, 'Backspace');
    expect(fromDoc(view.state.doc)).toEqual([{ kind: 'raw', text: '- [x] milk' }, { kind: 'paragraph', text: 'bread' }, { kind: 'raw', text: '- eggs' }]);
    key(view.dom, 'Backspace');
    expect(raw(view, 0)).toBe('- [x] milkbread\n- eggs');
    // the first item of all: its box, then the item becomes a paragraph before the list
    caretAt(view, itemStart(view, 0, 0));
    key(view.dom, 'Backspace');
    expect(raw(view, 0)).toBe('- milkbread\n- eggs');
    key(view.dom, 'Backspace');
    expect(fromDoc(view.state.doc)).toEqual([{ kind: 'paragraph', text: 'milkbread' }, { kind: 'raw', text: '- eggs' }]);
    expect(view.state.selection.from).toBe(1);
    // a frozen document's box stays as it is
    const frozen = mount([{ kind: 'raw', text: '- [ ] a' }], true);
    click(frozen.dom.querySelector('.li-task')!);
    expect(raw(frozen, 0)).toBe('- [ ] a');
    // `[ ] ` typed at the start of an item becomes its box; elsewhere it is text
    const typed = mount([{ kind: 'raw', text: '- a\n- b' }]);
    const typeAt = (pos: number, text: string) => {
      typed.dispatch(typed.state.tr.insertText(text.slice(0, -1), pos));
      const at = pos + text.length - 1;
      const last = text.slice(-1);
      // the last character as typed: the input rules see it first, the browser puts it in otherwise
      const handled = typed.someProp('handleTextInput', (f) => f(typed, at, at, last, () => typed.state.tr.insertText(last, at)));
      if (!handled) typed.dispatch(typed.state.tr.insertText(last, at));
    };
    typeAt(itemStart(typed, 0, 1), '[x] ');
    expect(raw(typed, 0)).toBe('- a\n- [x] b');
    expect(typed.dom.querySelector<HTMLElement>('.li-task')?.dataset.checked).toBe('1');
    typeAt(itemEnd(typed, 0, 0), ' [ ] ');
    expect(raw(typed, 0)).toBe('- a [ ] \n- [x] b');
    view.destroy();
    frozen.destroy();
    typed.destroy();
  });

  it('Tab moves an item under the sibling before it, at that sibling\'s text column, and ⇧Tab back out; an item with no sibling before it stays', () => {
    const view = mount([{ kind: 'raw', text: '- a\n- b\n1. c' }]);
    const items = () => Array.from(view.dom.querySelectorAll<HTMLElement>('.dd-li'));
    caretAt(view, itemStart(view, 0, 1));
    expect(key(view.dom, 'Tab')).toBe(true);
    expect(raw(view, 0)).toBe('- a\n  - b\n1. c');
    expect(items()[1]!.style.getPropertyValue('--indent')).toBe('2');
    caretAt(view, itemStart(view, 0, 2));
    key(view.dom, 'Tab');
    expect(raw(view, 0)).toBe('- a\n  - b\n  1. c');
    key(view.dom, 'Tab');
    expect(raw(view, 0)).toBe('- a\n  - b\n    1. c');
    expect(items()[2]!.style.getPropertyValue('--indent')).toBe('4');
    // no sibling before it at its depth now: still taken, nothing changes
    expect(key(view.dom, 'Tab')).toBe(true);
    expect(raw(view, 0)).toBe('- a\n  - b\n    1. c');
    expect(key(view.dom, 'Tab', { shiftKey: true })).toBe(true);
    expect(raw(view, 0)).toBe('- a\n  - b\n  1. c');
    key(view.dom, 'Tab', { shiftKey: true });
    // nothing left to take: still handled, nothing changes
    expect(key(view.dom, 'Tab', { shiftKey: true })).toBe(true);
    expect(raw(view, 0)).toBe('- a\n  - b\n1. c');
    // the first item has no sibling before it: a selection from it indents nothing
    view.dispatch(view.state.tr.setSelection(TextSelection.create(view.state.doc, itemStart(view, 0, 0), itemEnd(view, 0, 1))));
    key(view.dom, 'Tab');
    expect(raw(view, 0)).toBe('- a\n  - b\n1. c');
    // in a paragraph, Tab is not taken
    const p = mount([{ kind: 'paragraph', text: 'plain' }]);
    caretAt(p, 1);
    expect(key(p.dom, 'Tab')).toBe(false);
    // the list the file reads back is the one the editor holds
    const text = raw(view, 0);
    expect(fromDoc(toDoc(parse(`${text}\n`).doc.blocks))).toEqual([{ kind: 'raw', text }]);
    view.destroy();
    p.destroy();
  });

  it('⏎ continues a quote with the same prefix, ⏎ on an empty line leaves it, a backspace at the first line\'s start steps out with the text', async () => {
    const view = mount(await sampler());
    const i = 4;
    const first = 'A quotation set apart, with **weight** in it.';
    expect(raw(view, i)).toBe(`> ${first}\n> It runs to a second line.`);
    caretAt(view, itemEnd(view, i, 1));
    expect(key(view.dom, 'Enter')).toBe(true);
    expect(view.dom.querySelectorAll('.dd-ql')).toHaveLength(3);
    expect(raw(view, i)).toBe(`> ${first}\n> It runs to a second line.\n> `);
    view.dispatch(view.state.tr.insertText('A third.'));
    key(view.dom, 'Enter');
    key(view.dom, 'Enter');
    expect(raw(view, i)).toBe(`> ${first}\n> It runs to a second line.\n> A third.`);
    expect(view.state.doc.child(i + 1).type).toBe(schema.nodes.paragraph);
    expect(view.state.selection.$from.parent).toBe(view.state.doc.child(i + 1));
    // the quote's markers follow the caret
    caretAt(view, itemStart(view, i, 0) + 'A quotation set apart, with **w'.length);
    expect(shown(view.dom.querySelector('.dd-quote')!)).toEqual(['**', '**']);
    // backspace at the start of the first line: a paragraph before the quote, the text intact
    caretAt(view, itemStart(view, i, 0));
    expect(key(view.dom, 'Backspace')).toBe(true);
    expect(fromDoc(view.state.doc).slice(i, i + 2)).toEqual([{ kind: 'paragraph', text: first }, { kind: 'raw', text: '> It runs to a second line.\n> A third.' }]);
    // an empty line in the middle: ⏎ splits the quote around a paragraph; a lazy line continues with the prefix before it
    const q = mount([{ kind: 'raw', text: '> a\n>\n> b\nlazy' }]);
    caretAt(q, itemEnd(q, 0, 3));
    key(q.dom, 'Enter');
    expect(raw(q, 0)).toBe('> a\n>\n> b\nlazy\n> ');
    key(q.dom, 'Backspace');
    caretAt(q, itemStart(q, 0, 1));
    key(q.dom, 'Enter');
    expect(q.state.doc.childCount).toBe(3);
    expect(q.state.doc.child(1).type).toBe(schema.nodes.paragraph);
    expect(fromDoc(q.state.doc)).toEqual([{ kind: 'raw', text: '> a' }, { kind: 'raw', text: '> b\nlazy' }]);
    view.destroy();
    q.destroy();
  });

  it('an extract from a list item or a quote line takes the text without its marker; across items, one paragraph each', async () => {
    const view = mount(await sampler(), true);
    const i = 2;
    // as the reader reads a selection: a DOM range over the item's text, mapped back
    const a = view.domAtPos(itemStart(view, i, 1));
    const b = view.domAtPos(itemEnd(view, i, 1));
    const range = document.createRange();
    range.setStart(a.node, a.offset);
    range.setEnd(b.node, b.offset);
    expect(range.toString()).toBe('the second, with *emphasis*');
    const start = view.posAtDOM(range.startContainer, range.startOffset);
    const end = view.posAtDOM(range.endContainer, range.endOffset);
    expect(passage(view.state.doc, start, end)).toEqual({ text: 'the second, with *emphasis*', blocks: [2] });
    expect(passage(view.state.doc, itemStart(view, i, 0) + 4, itemEnd(view, i, 2))).toEqual({ text: 'first point\n\nthe second, with *emphasis*\n\nthe third, with `code`', blocks: [2] });
    // from the paragraph before into the list: both, in order
    const p = (view.state.doc.child(1).textContent);
    expect(passage(view.state.doc, startOf(view, 1) + 1 + p.indexOf('set in'), itemEnd(view, i, 0))).toEqual({ text: 'set in the line.\n\nthe first point', blocks: [1, 2] });
    expect(passage(view.state.doc, itemStart(view, 4, 1), itemEnd(view, 4, 1))).toEqual({ text: 'It runs to a second line.', blocks: [4] });
    // the code block's text, as it is
    expect(passage(view.state.doc, startOf(view, 5) + 1, startOf(view, 5) + 1 + 9)).toEqual({ text: 'const due', blocks: [5] });
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

describe('the toolbar\'s place', () => {
  it('takes the selection from its first line\'s top to its last line\'s bottom, leaving out the empty rect of a line it only touches', () => {
    const r = (left: number, top: number, width: number, height: number) => new DOMRect(left, top, width, height);
    const range = {
      // an empty rect at the end of the line above, then two lines of text
      getClientRects: () => [r(700, 509, 0, 29), r(300, 542, 400, 29), r(100, 571, 200, 29)],
      getBoundingClientRect: () => r(100, 509, 600, 91),
    } as unknown as Range;
    const box = selectionBox(range);
    expect([box.left, box.top, box.bottom]).toEqual([300, 542, 600]);
  });
});
