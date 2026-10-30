// @vitest-environment jsdom
// Arabic beside English in the drawn page: each block's `dir` on the DOM
// over the sample's grammar note, prose passage and vocab deck; a formula
// in an Arabic sentence a left-to-right isolate; a case ending's blank on
// its letter in the reader, the session and the deck; the fonts declared.

import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { EditorView } from 'prosemirror-view';
import { describe, expect, it } from 'vitest';
import { parse, type Block, type Card } from '../../format/index.js';
import { makeState } from '../../reader/index.js';
import { blankAnswers, cardHTML, clozeHTML, faceDir, nodeViews, rawHTML, richHTML } from '../Reader.js';

const SAMPLE = join(import.meta.dirname, '../../../samples/double-major');
const blocksOf = (p: string): Block[] => parse(readFileSync(join(SAMPLE, p), 'utf8')).doc.blocks;

function mount(blocks: Block[]): EditorView {
  return new EditorView(document.body.appendChild(document.createElement('div')), {
    state: makeState(blocks, { frozen: () => true, pos: null }), nodeViews, editable: () => false, attributes: { class: 'draft-doc' },
  });
}

/** The top-level block whose text starts with `prefix`, as drawn. */
const blockEl = (view: EditorView, prefix: string): HTMLElement => {
  const el = Array.from(view.dom.children).find((c) => (c.textContent ?? '').trimStart().startsWith(prefix));
  if (!el) throw new Error(`no block starting ${prefix}`);
  return el as HTMLElement;
};

describe('the sample in the reader', () => {
  it('the grammar note: glossed examples and prose left to right, the Arabic verse right to left, every block decided', () => {
    const view = mount(blocksOf('courses/fall-2026/arab-401-advanced-grammar/conditional-sentences.md'));
    // opens in Arabic, mostly English: left to right, its Arabic run a run of its own
    expect(blockEl(view, 'إِنْ تَدْرُسْ تَنْجَحْ').dir).toBe('ltr');
    expect(blockEl(view, 'A conditional sentence').dir).toBe('ltr');
    expect(blockEl(view, 'مَنْ يَجْتَهِدْ').dir).toBe('ltr');
    expect(blockEl(view, 'اسْمِيَّةٌ طَلَبِيَّةٌ').dir).toBe('rtl');
    for (const el of Array.from(view.dom.children)) expect(['ltr', 'rtl'], el.outerHTML.slice(0, 80)).toContain((el as HTMLElement).dir);
    view.destroy();
  });

  it('the prose passage: the passage right to left, its glossary (mostly English) left to right', () => {
    const view = mount(blocksOf('library/classical-prose-reader/12-the-grammarian-and-the-bedouin.md'));
    expect(blockEl(view, 'Passage 12').dir).toBe('ltr');
    expect(blockEl(view, 'قِيلَ: خَرَجَ').dir).toBe('rtl');
    expect(blockEl(view, 'Level: Part II').dir).toBe('ltr');
    const items = Array.from(view.dom.querySelectorAll<HTMLElement>('.dd-li'));
    expect(items.length).toBeGreaterThan(5);
    expect(items[0]!.textContent).toContain('نَحْوِيّ');
    expect(items[0]!.dir).toBe('ltr');
    expect(items[0]!.closest<HTMLElement>('.dd-list')!.dir).toBe('ltr');
    view.destroy();
  });

  it('the vocab deck: each card by its majority script, each face its own way', () => {
    const view = mount(blocksOf('arabic/vocabulary.md'));
    const cards = Array.from(view.dom.querySelectorAll<HTMLElement>('.card-span'));
    expect(cards.length).toBeGreaterThan(20);
    // كَرَمٌ ::: generosity, nobility of character (k-r-m): mostly English
    expect(cards[0]!.dir).toBe('ltr');
    // a both-ways card: each face isolated its own way around the arrow
    const faces = cards[0]!.querySelectorAll('bdi');
    expect(Array.from(faces).map((f) => f.getAttribute('dir'))).toEqual(['rtl', 'ltr']);
    const fronts = cards.map((c) => c.querySelector('bdi')).filter((f): f is HTMLElement => f !== null);
    expect(fronts.filter((f) => f.getAttribute('dir') === 'rtl').length).toBeGreaterThan(fronts.length * 0.9);
    view.destroy();
  });

  it('a formula inside an Arabic sentence is a left-to-right chip in a right-to-left block', () => {
    const view = mount(parse('إِذَا كَانَ $x^2 = 4$ فَإِنَّ $x = \\pm 2$، وَهٰذَا وَاضِحٌ.\n').doc.blocks);
    const p = view.dom.firstElementChild as HTMLElement;
    expect(p.dir).toBe('rtl');
    const chips = Array.from(p.querySelectorAll<HTMLElement>('.math'));
    expect(chips).toHaveLength(2);
    for (const c of chips) expect(c.dir).toBe('ltr');
    view.destroy();
  });

  it('inline code and card markup typed in an Arabic line are left-to-right isolates', () => {
    const view = new EditorView(document.body.appendChild(document.createElement('div')), {
      state: makeState([{ kind: 'paragraph', text: 'اُكْتُبْ `ls -la` ثُمَّ {{c1::كَانَ' }], { frozen: () => false, pos: null }), nodeViews,
    });
    expect(view.dom.querySelector<HTMLElement>('.md-code')?.dir).toBe('ltr');
    expect(Array.from(view.dom.querySelectorAll<HTMLElement>('.bidi-iso')).map((e) => [e.textContent, e.dir])).toEqual([['{{c1::', 'ltr']]);
    view.destroy();
  });
});

describe('the read-only drawings', () => {
  it('a raw list and a table carry each item\'s and cell\'s way', () => {
    expect(rawHTML('- نَحْوِيّ — grammarian\n- كِتَابٌ\n- 2\n- word')!.html).toBe(
      '<ul dir="ltr"><li dir="ltr">نَحْوِيّ — grammarian</li><li dir="rtl">كِتَابٌ</li><li dir="rtl">2</li><li dir="ltr">word</li></ul>',
    );
    // an item with no letter first takes no way of its own; the list the first decided item's
    expect(rawHTML('- 1\n- كِتَابٌ')!.html).toBe('<ul dir="rtl"><li>1</li><li dir="rtl">كِتَابٌ</li></ul>');
    const t = rawHTML('| tool | meaning |\n| --- | --- |\n| مَنْ | whoever |')!.html;
    expect(t).toContain('<td dir="rtl">مَنْ</td>');
    expect(t).toContain('<th dir="ltr">tool</th>');
  });

  it('math in richHTML is an LTR isolate', () => {
    expect(richHTML('كَانَ $x$')).toContain('<span class="math" dir="ltr"');
  });

  it('a face takes its own way, none when it has no letter', () => {
    expect(faceDir('كَرَمٌ')).toBe('rtl');
    expect(faceDir('generosity')).toBe('ltr');
    expect(faceDir('42')).toBeUndefined();
    expect(cardHTML({ kind: 'card', text: 'what does ع-ل-م give? :: II عَلَّمَ to teach' })).toContain('<span class="cs-q" dir="ltr">');
  });
});

describe('a case ending blank sits on its letter', () => {
  const card = blocksOf('courses/fall-2026/arab-401-advanced-grammar/kana-and-its-sisters.md')
    .find((b): b is Card => b.kind === 'card' && b.text.startsWith('لَيْسَتِ الطَّالِبَاتُ غَائِبَات'))!;
  const cls = (s: string) => (s === 'hidden' ? 'cloze' : s === 'revealed' ? 'cloze revealed' : 'cloze ctx');

  it('hidden, the bare letter; revealed, the letter with its mark', () => {
    expect(card).toBeDefined();
    const hidden = clozeHTML(card.text, () => 'hidden', cls);
    expect(hidden).toContain('غَائِبَا<span class="cloze on-letter">ت</span>');
    expect(hidden).not.toContain('<span class="cloze"></span>');
    const shown = clozeHTML(card.text, () => 'revealed', cls);
    expect(shown).toContain('<span class="cloze revealed on-letter">تٍ</span>');
  });

  it('the answer face and the deck show the letter with the mark, not a lone mark', () => {
    expect(blankAnswers(card.text, () => true)).toEqual(['<span class="on-letter">تٍ</span>']);
    expect(cardHTML(card)).toContain('<span class="cz on-letter">تٍ</span>');
    // a letter answer is as before
    expect(blankAnswers('حَاضِرِ{{c1::ينَ}}', () => true)).toEqual(['ينَ']);
  });
});

describe('the fonts', () => {
  it('declares the Arabic faces from their Arabic files only, and puts them in the stacks', () => {
    const fonts = readFileSync(join(import.meta.dirname, '../fonts.css'), 'utf8');
    const urls = Array.from(fonts.matchAll(/url\("([^"]+)"\)/g)).map((m) => m[1]!);
    expect(urls.length).toBe(4);
    for (const u of urls) expect(u).toMatch(/-arabic-(?:wght|\d00)-normal\.woff2$/);
    expect(fonts.match(/unicode-range/g)).toHaveLength(4);
    const tokens = readFileSync(join(import.meta.dirname, '../tokens.css'), 'utf8');
    expect(tokens).toMatch(/--serif: "Source Serif 4 Variable", "Source Serif 4", "Ilmi Naskh"/);
    expect(tokens).toMatch(/--sans: "IBM Plex Sans", "Ilmi Plex Arabic"/);
  });
});
