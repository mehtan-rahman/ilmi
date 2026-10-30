// Cards in list items (FORMAT.md §5.2) and step lines on a card's back
// (§5): what the parser cuts out of a list, what the serializer writes
// back, and that a malformed item degrades to the list's text, never
// taking prose with it.

import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { cardFields, parse, serialize, type Block, type Card } from '../index.js';

const read = (rel: string) => readFileSync(join(import.meta.dirname, 'corpus', rel), 'utf8');
const cardsOf = (blocks: Block[]) => blocks.filter((b): b is Card => b.kind === 'card');
const fixed = (text: string) => {
  const first = parse(text);
  const out = serialize(first.doc);
  expect(parse(out).doc).toEqual(first.doc);
  expect(serialize(parse(out).doc)).toBe(out);
  return { ...first, out };
};

describe('cards in list items', () => {
  it('reads the corpus file: bullets, numbered items, nested items, a cloze, a multi-line q&a', () => {
    const { doc, diagnostics, out } = fixed(read('mangled/list-cards.md'));
    const cards = cardsOf(doc.blocks);
    expect(cards.map((c) => [c.item ?? null, c.text.split('\n')[0]])).toEqual([
      ['- ', 'dof :: 3N − k'],
      ['- ', 'holonomic :: constraint is $f(q,t) = 0$'],
      ['  - ', 'nested :: a card under it'],
      ['* ', 'star :: a bullet'],
      ['+ ', 'plus ::: both ways'],
      ['2. ', "Kepler's second law: equal {{c1::areas}} in equal {{c2::times}}"],
      ['3) ', 'why does the orbit close?'],
      ['- ', 'a card item that wraps :: onto'],
      ['- ', 'derive the partition function of a two-level system'],
      [null, 'derive $\\langle E \\rangle$ for the two-level system'],
    ]);
    // the id, the schedules, a cloze's group lines
    expect(cards[1]).toMatchObject({ id: 'li-holo', sched: { due: '2026-11-01', reps: 2 } });
    expect(cards[2]!.sched).toEqual({ due: '2026-11-02' });
    expect(cards[5]!.blanks).toEqual({ 1: { due: '2026-11-04' }, 2: { due: '2026-11-03' } });
    // forms: each detected on the item's text, the content column taken off
    expect(cards.map((c) => cardFields(c.text)?.form)).toEqual(['qa', 'qa', 'qa', 'qa', 'bidir', 'cloze', 'qa', 'qa', 'qa', 'qa']);
    expect(cardFields(cards[6]!.text)).toEqual({ form: 'qa', front: 'why does the orbit close?', back: 'because the effective potential goes as $1/r$' });
    expect(cardFields(cards[7]!.text)).toEqual({ form: 'qa', front: 'a card item that wraps', back: 'onto\na second line at the content column' });
    // the orphan under a plain item is the only problem
    expect(diagnostics).toEqual([{ line: 35, message: 'orphan sr line' }]);
    // written back: the annotations at the content column, in canonical order; the list in one piece
    expect(out).toContain('- holonomic :: constraint is $f(q,t) = 0$ ^li-holo\n  <!-- sr due=2026-11-01 st=review s=4 d=5 r=2 l=0 ivl=4 -->\n- not a card, just an item\n');
    expect(out).toContain('  - nested :: a card under it\n    <!-- sr due=2026-11-02 -->\n  - nested plain\n');
    expect(out).toContain("2. Kepler's second law: equal {{c1::areas}} in equal {{c2::times}}\n   <!-- sr c1 due=2026-11-04 -->\n   <!-- sr c2 due=2026-11-03 -->\n3) why");
  });

  it('leaves raw what it cannot put back: a lazy line, a task, five spaces, a fence, an orphan', () => {
    const { doc } = parse(read('mangled/list-cards.md'));
    const raws = doc.blocks.filter((b) => b.kind === 'raw').map((b) => b.text);
    expect(raws).toContain('- a lazy line breaks it :: so it is\nno card\n- [ ] a task :: is never a card\n-     five spaces :: is code inside the item');
    expect(raws).toContain('- an item that is no card\n  <!-- sr due=2026-01-01 -->');
    expect(raws).toContain('- code in an item\n  ```\n  - x :: y\n  ```');
  });

  it('marks every piece after a list\'s first as joined, and writes the list as one', () => {
    const text = '- a\n- b :: c\n- d\n';
    const { doc } = parse(text);
    expect(doc.blocks).toEqual([
      { kind: 'raw', text: '- a' },
      { kind: 'card', text: 'b :: c', item: '- ', joined: true },
      { kind: 'raw', text: '- d', joined: true },
    ]);
    expect(serialize(doc)).toBe(text);
    // two lists stay two
    expect(serialize(parse('- a :: b\n\n- c :: d\n').doc)).toBe('- a :: b\n\n- c :: d\n');
    expect(parse('- a :: b\n\n- c :: d\n').doc.blocks.map((b) => (b as Card).joined ?? false)).toEqual([false, false]);
  });

  it('writes a review as one line under the item, at its content column', () => {
    const { doc } = parse('notes\n\n10. ten :: X\n    second line\n- after\n');
    const card = doc.blocks[1] as Card;
    expect(card).toEqual({ kind: 'card', text: 'ten :: X\nsecond line', item: '10. ' });
    card.id = 'c-ten';
    card.sched = { due: '2026-11-05', state: 'review', reps: 1 };
    expect(serialize(doc)).toBe('notes\n\n10. ten :: X\n    second line ^c-ten\n    <!-- sr due=2026-11-05 st=review r=1 -->\n- after\n');
    expect(fixed(serialize(doc)).doc).toEqual(doc);
  });

  it('a nested item ends a card; its children are items of their own', () => {
    const { doc } = parse('- parent :: P\n  - child :: C\n  - plain child\n');
    expect(doc.blocks).toEqual([
      { kind: 'card', text: 'parent :: P', item: '- ' },
      { kind: 'card', text: 'child :: C', item: '  - ', joined: true },
      { kind: 'raw', text: '  - plain child', joined: true },
    ]);
  });

  it('after a `?` line in an item, items set in are the back\'s steps', () => {
    const text = '- derive it\n  ?\n  1. one\n  2. two\n- next\n';
    const { doc } = parse(text);
    expect(doc.blocks[0]).toEqual({ kind: 'card', text: 'derive it\n?\n1. one\n2. two', item: '- ' });
    expect(cardFields((doc.blocks[0] as Card).text)).toEqual({ form: 'qa', front: 'derive it', back: '1. one\n2. two' });
    expect(serialize(doc)).toBe(text);
  });

  it('a line that ends a paragraph ends the card, and stays in the list\'s text', () => {
    const { doc } = parse('- a :: b\n# not a heading here\n');
    expect(doc.blocks).toEqual([
      { kind: 'card', text: 'a :: b', item: '- ' },
      { kind: 'raw', text: '# not a heading here', joined: true },
    ]);
    expect(serialize(doc)).toBe('- a :: b\n# not a heading here\n');
  });

  it('a thematic break is not a list, and an item card reads only with spaces', () => {
    expect(parse('- - -\n').doc.blocks).toEqual([{ kind: 'raw', text: '- - -' }]);
    expect(parse('-\ta :: b\n').doc.blocks).toEqual([{ kind: 'raw', text: '-\ta :: b' }]);
    expect(parse('- a :: b\n\tmore\n').doc.blocks).toEqual([{ kind: 'raw', text: '- a :: b\n\tmore' }]);
  });

  it('a join broken by an edit is written with a blank line, never glued to prose', () => {
    const { doc } = parse('- a\n- b :: c\n- d\n');
    // the list's first piece deleted, a paragraph put before what is left
    doc.blocks.splice(0, 1, { kind: 'paragraph', text: 'prose' });
    expect(serialize(doc)).toBe('prose\n\n- b :: c\n- d\n');
    // the card deleted: the two raw pieces are one list again
    const two = parse('- a\n- b :: c\n2. d\n').doc;
    two.blocks.splice(1, 1);
    expect(serialize(two)).toBe('- a\n2. d\n');
    expect(parse(serialize(two)).doc.blocks).toEqual([{ kind: 'raw', text: '- a\n2. d' }]);
    // a card item first in the body with no list before it
    expect(serialize({ blocks: [{ kind: 'card', text: 'x :: y', item: '- ', joined: true }] })).toBe('- x :: y\n');
  });

  it('the sample\'s first cards, in a list, are cards', () => {
    const lag = readFileSync(join(import.meta.dirname, '../../../samples/double-major/courses/fall-2025/phys-301-classical-mechanics/lagrangian-mechanics.md'), 'utf8');
    const cards = cardsOf(parse(lag).doc.blocks).filter((c) => c.item !== undefined);
    expect(cards.map((c) => c.text)).toContain('dof :: 3N − k');
  });
});

describe('steps on a card\'s back', () => {
  it('a paragraph with a `?` line keeps the list after it as its back', () => {
    const { doc, out } = fixed(read('mangled/list-cards.md'));
    const last = doc.blocks[doc.blocks.length - 1] as Card;
    expect(last.kind).toBe('card');
    expect(cardFields(last.text)).toEqual({
      form: 'qa',
      front: 'derive $\\langle E \\rangle$ for the two-level system',
      back: '1. $\\langle E \\rangle = -\\partial_\\beta \\ln Z$\n2. $= \\epsilon / (e^{\\beta\\epsilon} + 1)$',
    });
    expect(out.endsWith('?\n1. $\\langle E \\rangle = -\\partial_\\beta \\ln Z$\n2. $= \\epsilon / (e^{\\beta\\epsilon} + 1)$\n')).toBe(true);
  });

  it('before the separator an item still ends the paragraph', () => {
    expect(parse('prose\n1. a list\n').doc.blocks.map((b) => b.kind)).toEqual(['paragraph', 'raw']);
    expect(parse('front\n?\n- one\n- two\n<!-- sr due=2026-11-01 -->\n').doc.blocks).toEqual([
      { kind: 'card', text: 'front\n?\n- one\n- two', sched: { due: '2026-11-01' } },
    ]);
  });
});
