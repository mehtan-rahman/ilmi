// @vitest-environment jsdom
// The reader's DOM: node views over a real EditorView, without the window.

import { EditorView } from 'prosemirror-view';
import { promises as fsp } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import { blanks, parse, type Blank, type Card } from '../../format/index.js';
import { makeState } from '../../reader/index.js';
import { insideMath, withBlank } from '../Composer.js';
import { dueLabel } from '../items.js';
import { answerHTML, cardHTML, clozeHTML, nodeViews, type BlankState } from '../Reader.js';

const CORPUS = join(dirname(fileURLToPath(import.meta.url)), '../../format/__tests__/corpus/vault/papers');
const WOZ = join(CORPUS, 'wozniak-1990.md');
const MAXWELL = join(CORPUS, 'maxwell.md');

function mount(blocks: ReturnType<typeof parse>['doc']['blocks'], frozen = false): EditorView {
  const state = makeState(blocks, { frozen: () => frozen, pos: 3 });
  return new EditorView(document.body.appendChild(document.createElement('div')), {
    state, nodeViews, editable: () => !frozen, attributes: { class: 'draft-doc' },
  });
}

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
    expect(view.dom.querySelector('pre.raw')?.textContent).toBe('- a list');
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
