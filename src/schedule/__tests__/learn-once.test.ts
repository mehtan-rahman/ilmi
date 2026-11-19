// A card is shown to learn once, the first time any of it comes up: its other direction and its other blanks, which
// come on other days, are asked as tests.

import { describe, expect, it } from 'vitest';
import { parse, type Doc } from '../../format/index.js';
import { docItems, gradeItem, itemOwesLearning, learnItem, type CardItem } from '../index.js';

const at = (day: string) => new Date(`${day}T12:00:00`);
const items = (doc: Doc, now: Date) => docItems('deck.md', doc, now).filter((i): i is CardItem => i.kind === 'card');

describe('learnt once a card', () => {
  it('a both-ways card: learnt at one direction, the other is asked, not learnt again', () => {
    const { doc } = parse('كَرَمٌ ::: generosity\n');
    const day = at('2026-11-02');
    const [f, r] = items(doc, day);
    expect([itemOwesLearning(f!), itemOwesLearning(r!)]).toEqual([true, true]);
    learnItem(doc, f!, day);
    const next = items(doc, at('2026-11-03'));
    expect(next.find((i) => i.dir === 'f')!.sched?.seen).toBeDefined();
    expect(itemOwesLearning(next.find((i) => i.dir === 'r')!)).toBe(false);
  });

  it('a cloze of several blanks: one blank tested, the others are asked', () => {
    const { doc } = parse('{{c1::x}} and {{c2::y}} and {{c3::z}}\n');
    const day = at('2026-11-02');
    const all = items(doc, day);
    expect(all.every(itemOwesLearning)).toBe(true);
    gradeItem(doc, all[0]!, 3, day);
    const next = items(doc, at('2026-11-03'));
    expect(next.length).toBe(3);
    expect(next.map(itemOwesLearning)).toEqual([false, false, false]);
  });

  it('two cards do not answer for each other', () => {
    const { doc } = parse('a :: b\n\nc :: d\n');
    const day = at('2026-11-02');
    learnItem(doc, items(doc, day)[0]!, day);
    expect(items(doc, day).map(itemOwesLearning)).toEqual([false, true]);
  });
});
