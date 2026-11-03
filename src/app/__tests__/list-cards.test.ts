// @vitest-environment jsdom
// Milestone 37: cards in list items in the live editor (drawn as items,
// typed as list text and read back as cards, written back in place), seen
// by the queue and a study session with the headings over them, graded
// with the sr line rewritten under the item; a new card after an item is
// the next item; the session's line above a card.

import { EditorView } from 'prosemirror-view';
import { TextSelection } from 'prosemirror-state';
import { describe, expect, it } from 'vitest';
import { parse, serialize, type Block, type Card } from '../../format/index.js';
import { docItems, gradeItem, type CardItem } from '../../schedule/index.js';
import { clipboardText, fromDoc, makeState, schema } from '../../reader/index.js';
import { insertCard } from '../cardEdit.js';
import { trailLabel, trailParts } from '../items.js';
import { handleClickOn, nodeViews } from '../Reader.js';
import type { DocInfo } from '../store.js';
import { studyItems } from '../study.js';

const NOTE = `---
title: stat mech
---

# stat mech

## canonical ensemble

### the partition function

Lecture 9, typed up.

- $Z$ :: $\\sum_s e^{-\\beta E_s}$
- free energy :: $F = -kT \\ln Z$
  <!-- sr due=2026-11-02 st=review s=4 d=5 r=2 l=0 ivl=4 -->
- not a card
  - nested :: a card under it
1. first step
2. the {{c1::Boltzmann}} factor
`;

const NOW = new Date('2026-10-30T12:00:00');

function mount(blocks: Block[]): EditorView {
  const state = makeState(blocks, { frozen: () => false, pos: null });
  return new EditorView(document.body.appendChild(document.createElement('div')), {
    state, nodeViews, editable: () => true, attributes: { class: 'draft-doc' }, handleClickOn,
  });
}

const cardsOf = (blocks: Block[]) => blocks.filter((b): b is Card => b.kind === 'card');

describe('cards in list items, in the reader', () => {
  it('draws a card item with its marker, set in, the list going on around it', () => {
    const { doc } = parse(NOTE);
    const view = mount(doc.blocks);
    const items = Array.from(view.dom.querySelectorAll<HTMLElement>('.card-span.in-item'));
    expect(items.map((c) => c.querySelector('.li-mark')?.textContent)).toEqual(['•', '•', '•', '2.']);
    expect(items.map((c) => c.style.getPropertyValue('--indent'))).toEqual(['0', '0', '2', '0']);
    expect(items[0]!.querySelector('.cs-item .cs-body .cs-q')).not.toBeNull();
    expect(items[0]!.getAttribute('contenteditable')).toBe('false');
    // the plain items are list nodes, the piece after a card keeps its join
    const lists = Array.from(view.dom.querySelectorAll('.dd-list'));
    expect(lists.map((l) => l.querySelector('.li-text')?.textContent)).toEqual(['not a card', 'first step']);
    // read back unchanged, and written as the file was
    expect(fromDoc(view.state.doc)).toEqual(doc.blocks);
    expect(serialize({ ...doc, blocks: fromDoc(view.state.doc) })).toBe(NOTE);
    view.destroy();
  });

  it('a card typed in a list item is list text to the editor and a card once the file is read back', () => {
    const { doc } = parse(NOTE);
    const view = mount(doc.blocks);
    // the caret at the end of "first step", ⏎, and a new item typed
    let at = -1;
    view.state.doc.descendants((n, pos) => { if (n.type === schema.nodes.list_item && n.textContent === 'first step') at = pos + n.nodeSize - 1; });
    view.dispatch(view.state.tr.setSelection(TextSelection.create(view.state.doc, at)));
    view.dom.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', bubbles: true, cancelable: true }));
    view.dispatch(view.state.tr.insertText('entropy :: $S = -k\\sum p \\ln p$'));
    const written = serialize({ ...doc, blocks: fromDoc(view.state.doc) });
    expect(written).toContain('1. first step\n2. entropy :: $S = -k\\sum p \\ln p$\n3. the {{c1::Boltzmann}} factor\n');
    // the file read back: the new item is a card, the item after it renumbered, still in one list
    const back = parse(written).doc;
    const cards = cardsOf(back.blocks);
    expect(cards.map((c) => [c.item, c.text])).toEqual([
      ['- ', '$Z$ :: $\\sum_s e^{-\\beta E_s}$'],
      ['- ', 'free energy :: $F = -kT \\ln Z$'],
      ['  - ', 'nested :: a card under it'],
      ['2. ', 'entropy :: $S = -k\\sum p \\ln p$'],
      ['3. ', 'the {{c1::Boltzmann}} factor'],
    ]);
    expect(serialize(back)).toBe(written);
    // the reader rebuilt from it draws the new card as a card item
    const again = mount(back.blocks);
    expect(Array.from(again.dom.querySelectorAll('.card-span.in-item .li-mark')).map((m) => m.textContent)).toEqual(['•', '•', '•', '2.', '3.']);
    view.destroy();
    again.destroy();
  });

  it('a copy of the list is the list as the file has it', () => {
    const { doc } = parse(NOTE);
    const view = mount(doc.blocks);
    const text = clipboardText(view.state.doc.slice(0, view.state.doc.content.size));
    expect(text).toBe(NOTE.slice(NOTE.indexOf('# stat mech'), -1));
    view.destroy();
  });
});

describe('the queue, a session, and a review', () => {
  it('lists card items with the headings over them, and a session studies them', () => {
    const { doc } = parse(NOTE);
    const items = docItems('courses/stat-mech.md', doc, NOW).filter((i): i is CardItem => i.kind === 'card');
    expect(items.map((i) => i.text.split(' ::')[0])).toEqual(['$Z$', 'free energy', 'nested', 'the {{c1::Boltzmann}} factor']);
    expect(items[0]!.trail).toEqual(['stat mech', 'canonical ensemble', 'the partition function']);
    expect(items[0]!.section).toBe('the partition function');
    // a session over the note: the due ones (the new three; free energy is due on the 2nd), in the day's order
    expect(studyItems([['courses/stat-mech.md', doc]], NOW).map((i) => i.text.split(' ::')[0])).toEqual(['the {{c1::Boltzmann}} factor', 'nested', '$Z$']);
  });

  it('a grade rewrites one line, under the item at its content column', () => {
    const { doc } = parse(NOTE);
    const item = docItems('courses/stat-mech.md', doc, NOW).find((i): i is CardItem => i.kind === 'card' && i.text.startsWith('nested'))!;
    gradeItem(doc, item, 3, NOW);
    const out = serialize(doc);
    const before = NOTE.split('\n');
    const after = out.split('\n');
    const at = after.indexOf('  - nested :: a card under it' + after.find((l) => l.startsWith('  - nested'))!.slice('  - nested :: a card under it'.length));
    expect(after[at]).toMatch(/^ {2}- nested :: a card under it \^c[a-z0-9]{6}$/);
    expect(after[at + 1]).toMatch(/^ {4}<!-- sr due=\S+ st=learning .*-->$/);
    // nothing else moved: one line gained, the id on the card's own line
    expect(after.length).toBe(before.length + 1);
    expect(after.filter((l, k) => k !== at && k !== at + 1)).toEqual(before.filter((l) => !l.startsWith('  - nested')));
    // read back, the same card with its schedule
    const back = cardsOf(parse(out).doc.blocks).find((c) => c.text.startsWith('nested'))!;
    expect(back.item).toBe('  - ');
    expect(back.sched?.reps).toBe(1);
  });

  it('a new card after a card item is the next item', () => {
    const { doc } = parse('- a :: b\n9. c :: d\n- e\n');
    const i = insertCard(doc, { path: 'x.md', block: 0, text: 'a :: b' }, 'f :: g');
    expect(i).toBe(1);
    const j = insertCard(doc, { path: 'x.md', block: 2, text: 'c :: d' }, 'h :: k');
    expect(serialize(doc)).toBe(j === 3 ? '- a :: b\n- f :: g\n9. c :: d\n10. h :: k\n- e\n' : '');
  });
});

describe('the session\'s line above a card', () => {
  const docs = { 'courses/stat-mech.md': { title: 'stat mech' } as DocInfo };
  const item = (trail: string[] | undefined): CardItem => ({
    kind: 'card', path: 'courses/stat-mech.md', block: 0, form: 'qa', text: 'a :: b', groups: 1, dueAt: NOW, pri: 50,
    ...(trail ? { trail, section: trail[trail.length - 1] } : {}),
  });

  it('names the document, then the headings over the card; a top heading repeating the name is left out', () => {
    expect(trailLabel(item(['Stat mech', 'canonical ensemble', 'the partition function']), docs)).toBe('stat mech › canonical ensemble › the partition function');
    expect(trailParts(item(['§2 — the premise']), docs)).toEqual(['stat mech', 'the premise']);
    expect(trailParts(item(undefined), docs)).toEqual(['stat mech']);
    expect(trailParts(item(['', 'lec 9']), { }).join(' › ')).toBe('stat-mech › lec 9');
  });
});
