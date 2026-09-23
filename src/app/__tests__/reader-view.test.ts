// @vitest-environment jsdom
// The reader's DOM: node views over a real EditorView, without the window.

import { EditorView } from 'prosemirror-view';
import { promises as fsp } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import { parse, type Card } from '../../format/index.js';
import { makeState } from '../../reader/index.js';
import { dueLabel } from '../items.js';
import { cardHTML, nodeViews } from '../Reader.js';

const WOZ = join(dirname(fileURLToPath(import.meta.url)), '../../format/__tests__/corpus/vault/papers/wozniak-1990.md');

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
