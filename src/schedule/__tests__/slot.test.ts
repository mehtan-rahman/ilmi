// The scheduler slot's pure side: which of the queue's cards another
// scheduler is asked about and under which key the log has them, a score
// laid over the queue (due by recall against the target, or by a date; a
// stale one and a card with no word left to the built in), the day's order
// by recall with reading where it was, and that the exams, the siblings and
// the day's allowance still hold over it.

import { describe, expect, it } from 'vitest';
import { meta, parse, type Doc, type Review } from '../../format/index.js';
import {
  CURVE_GRID, addDays, applyScores, canonicalLog, crossing, dayOf, docItems, dueOf, examLeft, examQueue, examsAt, indexLog, isDue, logKeyOf, meterQueue, recallOf, resolveOptions,
  schedCardOf, scoreKey, slotKeys, slotted, sortQueue, itemKey,
  type CardItem, type QueueItem, type Score,
} from '../index.js';

const NOW = new Date('2026-11-10T12:00:00');
const TODAY = dayOf(NOW);
const sr = (id: string, due: string, extra = '') => `^${id}\n<!-- sr due=${due} st=review s=20 d=5 r=5 l=0 ivl=20 last=2026-10-20T09:00:00Z${extra} -->`;

const DECK = `---
type: deck
---

one :: 1 ${sr('a', '2026-11-08')}

two :: 2 ${sr('b', '2026-11-20')}

three :: 3 ${sr('c', '2026-11-09')}

fresh :: never seen

steps :: in them ^s
<!-- sr due=2026-11-10T11:55:00Z st=learning s=1 d=5 r=1 l=0 ivl=0 last=2026-11-10T11:45:00Z -->

left ::: right ^lr
<!-- sr due=2026-11-07 st=review s=9 d=5 r=3 l=0 ivl=9 last=2026-10-29T09:00:00Z -->
<!-- sr r due=2026-11-09 st=review s=9 d=5 r=3 l=0 ivl=9 last=2026-10-31T09:00:00Z -->

the {{c1::first}} and the {{c2::second}} ^cz
<!-- sr c1 due=2026-11-09 st=review s=9 d=5 r=3 l=0 ivl=9 last=2026-10-31T09:00:00Z -->
`;

const items = (text = DECK, path = 'deck.md', now = NOW): QueueItem[] => docItems(path, parse(text).doc, now);
const cards = (list: QueueItem[]): CardItem[] => list.filter((i): i is CardItem => i.kind === 'card');
const byId = (list: QueueItem[], id: string, pick: (i: CardItem) => boolean = () => true): CardItem => cards(list).find((i) => i.id === id && pick(i))!;
const review = (card: string, at: string, g: Review['g'], key?: string): Review => ({ at, doc: 'deck.md', card, g, st: 'review', elapsed: 1, ivl: 1, next: 2, ...(key ? { key } : {}) });
/** Scores by line, each for the line as it is. */
const scorer = (list: QueueItem[], by: Record<string, Partial<Score>>) => (i: CardItem & { id: string }): Score | undefined => {
  const k = `${i.id}${i.dir === 'r' ? '/r' : i.group && 'n' in i.group && i.groups > 1 ? `/c${i.group.n}` : ''}`;
  const s = by[k];
  return s ? { last: i.sched?.last, ...s } : undefined;
};

describe('which cards a scheduler is asked about', () => {
  it('a card with a review, out of its steps; never a new one or one minutes from due', () => {
    const list = items();
    expect(cards(list).filter(slotted).map((i) => `${i.id}${i.dir === 'r' ? '/r' : ''}${i.group && 'n' in i.group ? `/c${i.group.n}` : ''}`)).toEqual(['a', 'b', 'c', 'lr', 'lr/r', 'cz/c1']);
  });

  it('under the key the log names its line by', () => {
    const list = items();
    const none = () => false;
    expect(logKeyOf(byId(list, 'a'), none)).toBeUndefined();
    expect(logKeyOf(byId(list, 'lr', (i) => i.dir === 'f'), none)).toBeUndefined();
    expect(logKeyOf(byId(list, 'lr', (i) => i.dir === 'r'), none)).toBe('r');
    expect(logKeyOf(byId(list, 'cz', (i) => !!i.group && 'n' in i.group && i.group.n === 1), none)).toBe('c1');
    // a card of one group is its bare line, unless the log has it under the group it once was
    const one = cards(items('the {{c1::only}} one ^o\n<!-- sr c1 due=2026-11-09 st=review s=9 d=5 r=3 l=0 ivl=9 last=2026-10-31T09:00:00Z -->\n'))[0]!;
    expect(logKeyOf(one, none)).toBeUndefined();
    expect(logKeyOf(one, (k) => k === 'c1')).toBe('c1');
    expect(logKeyOf(one, () => true)).toBeUndefined();
  });

  it('with its own history, its target, and the built in\'s state', () => {
    const log = [review('a', '2026-10-20T09:00:00Z', 3), review('lr', '2026-10-31T09:00:00Z', 3, 'r'), review('a', '2026-10-01T09:00:00Z', 4), review('lr', '2026-10-29T09:00:00Z', 2)];
    const index = indexLog(log);
    const list = items();
    const a = schedCardOf(byId(list, 'a'), index, 0.85)!;
    expect(a).toMatchObject({ path: 'deck.md', id: 'a', retention: 0.85, fsrs: { stability: 20, last: '2026-10-20T09:00:00Z' } });
    expect('key' in a).toBe(false);
    expect(a.history.map((r) => r.at)).toEqual(['2026-10-01T09:00:00Z', '2026-10-20T09:00:00Z']);
    const r = schedCardOf(byId(list, 'lr', (i) => i.dir === 'r'), index, 0.9)!;
    expect(r.key).toBe('r');
    expect(r.history.map((x) => x.g)).toEqual([3]);
    expect(schedCardOf(byId(list, 'b'), index, 0.9)!.history).toEqual([]);
    expect(schedCardOf(cards(list).find((i) => i.text.startsWith('fresh'))!, index, 0.9)).toBeNull();
    expect(schedCardOf(byId(list, 's'), index, 0.9)).toBeNull();
  });

  it('the log is handed over in one order whatever order it came in', () => {
    const a = review('a', '2026-10-20T09:00:00Z', 3);
    const b = review('b', '2026-10-20T09:00:00Z', 3);
    const c = review('a', '2026-10-19T09:00:00Z', 1);
    expect(canonicalLog([b, a, c])).toEqual([c, a, b]);
    expect(canonicalLog([a, c, b])).toEqual([c, a, b]);
    expect(scoreKey('a', undefined)).not.toBe(scoreKey('a', 'r'));
  });
});

describe('what a scheduler gave, read', () => {
  it('a due is a date, an instant or a day; anything else is none', () => {
    expect(dueOf('2026-12-01')).toBe('2026-12-01');
    expect(dueOf(new Date('2026-12-01T10:00:30.500Z'))).toBe('2026-12-01T10:00:30Z');
    expect(dueOf('2026-12-01T10:00:30.000Z')).toBe('2026-12-01T10:00:30Z');
    expect(dueOf('soon')).toBeNull();
    expect(dueOf(new Date(NaN))).toBeNull();
    expect(dueOf(12)).toBeNull();
    expect(dueOf(undefined)).toBeNull();
  });

  it('a recall is a number from 0 to 1; anything else is no word', () => {
    expect([0, 0.5, 1].map(recallOf)).toEqual([0, 0.5, 1]);
    expect([null, undefined, NaN, -0.1, 1.2, '0.5'].map(recallOf)).toEqual([null, null, null, null, null, null]);
  });

  it('a falling curve reaches its target between two days of the grid', () => {
    const curve = (d: number) => 0.5 ** (d / 40);
    expect(crossing(CURVE_GRID, CURVE_GRID.map(curve), 0.9)).toEqual([6, 7]);
    expect(crossing(CURVE_GRID, CURVE_GRID.map((d) => 0.5 ** (d / 400)), 0.9)).toEqual([50, 62]);
    // there already on the first day; never there
    expect(crossing([1, 2], [0.5, 0.4], 0.9)).toEqual([0, 1]);
    expect(crossing([1, 2], [0.99, 0.98], 0.9)).toBeNull();
  });
});

describe('scores over the queue', () => {
  const ret = () => 0.9;

  it('by recall a card is due at or under its target, whatever day the built in gave it', () => {
    const list = items();
    // a: the built in says overdue, recall says not yet; b: the built in says in ten days, recall says now
    const n = applyScores(list, scorer(list, { a: { recall: 0.95 }, b: { recall: 0.9 }, c: { recall: 0.4 } }), ret, NOW);
    expect(n).toBe(3);
    const [a, b, c] = ['a', 'b', 'c'].map((id) => byId(list, id));
    expect(isDue(a!, NOW)).toBe(false);
    expect(a!.due).toBe(addDays(TODAY, 1));
    expect(a!.slot).toEqual({ recall: 0.95, ratio: 0.95 / 0.9, due: addDays(TODAY, 1) });
    expect(isDue(b!, NOW)).toBe(true);
    expect(b!.due).toBe(TODAY);
    expect(b!.slot).toMatchObject({ recall: 0.9, ratio: 1, reaches: TODAY });
    expect(isDue(c!, NOW)).toBe(true);
    // what it was not asked about, and the new card, are as the built in has them
    expect(isDue(byId(list, 's'), NOW)).toBe(true);
    expect(cards(list).find((i) => i.text.startsWith('fresh'))!.slot).toBeUndefined();
  });

  it('not due, it is ahead on the day its curve gave, else on the built in\'s day', () => {
    const list = items();
    applyScores(list, scorer(list, { a: { recall: 0.95, due: '2026-11-14' }, b: { recall: 0.99 } }), ret, NOW);
    expect(byId(list, 'a')).toMatchObject({ due: '2026-11-14', slot: { reaches: '2026-11-14' } });
    expect(byId(list, 'b').due).toBe('2026-11-20');
    expect(byId(list, 'b').slot!.reaches).toBeUndefined();
  });

  it('same-day: false holds a card reviewed today until tomorrow; true, and the default, ask it again today', () => {
    // a, b, c reviewed this morning; the scheduler says all three are under the target again
    const DECK_TODAY = DECK.replaceAll('last=2026-10-20T09:00:00Z', 'last=2026-11-10T09:00:00Z');
    const scores = (i: CardItem & { id: string; sched: { last?: string } }): Score | undefined =>
      ['a', 'b'].includes(i.id) ? { last: i.sched.last!, recall: 0.5 } : i.id === 'c' ? { last: i.sched.last!, due: '2026-11-10T13:00:00Z' } : undefined;
    for (const [sameDay, due] of [[undefined, true], [true, true], [false, false]] as const) {
      const list = items(DECK_TODAY);
      applyScores(list, scores, ret, NOW, sameDay === undefined ? undefined : () => sameDay);
      for (const id of ['a', 'b', 'c']) expect([id, sameDay, isDue(byId(list, id), NOW)]).toEqual([id, sameDay, due]);
      if (!due) {
        expect(byId(list, 'a')).toMatchObject({ due: addDays(TODAY, 1), slot: { recall: 0.5, reaches: addDays(TODAY, 1) } });
        expect(byId(list, 'c')).toMatchObject({ due: addDays(TODAY, 1), slot: { reaches: addDays(TODAY, 1) } });
      }
    }
    // reviewed before today, it is due today as recall says, whatever the option
    const list = items();
    applyScores(list, scorer(list, { a: { recall: 0.5 } }), ret, NOW, () => false);
    expect(isDue(byId(list, 'a'), NOW)).toBe(true);
    // a date past today is kept as it is
    const later = items(DECK_TODAY);
    applyScores(later, (i) => (i.id === 'a' ? { last: i.sched.last!, due: '2026-11-14' } : undefined), ret, NOW, () => false);
    expect(byId(later, 'a').due).toBe('2026-11-14');
  });

  it('the target is the one the card is studied at', () => {
    const list = [...items(DECK, 'hard/deck.md'), ...items(DECK, 'easy/deck.md')];
    const at = (p: string) => (p.startsWith('hard') ? 0.95 : 0.8);
    applyScores(list, () => ({ last: '2026-10-20T09:00:00Z', recall: 0.9 }), at, NOW);
    const a = cards(list).filter((i) => i.id === 'a');
    expect(a.map((i) => isDue(i, NOW))).toEqual([true, false]);
    expect(a.map((i) => i.slot!.ratio)).toEqual([0.9 / 0.95, 0.9 / 0.8]);
  });

  it('a score from before the card\'s last review, and a card with no word, are the built in\'s', () => {
    const list = items();
    const before = JSON.stringify(list);
    const n = applyScores(list, (i) => (i.id === 'a' ? { last: '2026-10-01T09:00:00Z', recall: 0.1 } : i.id === 'b' ? { last: i.sched.last } : undefined), ret, NOW);
    expect(n).toBe(0);
    expect(JSON.stringify(list)).toBe(before);
  });

  it('by a date a card is due then', () => {
    const list = items();
    applyScores(list, scorer(list, { a: { due: '2026-11-30' }, b: { due: '2026-11-10T08:00:00Z' } }), ret, NOW);
    expect(byId(list, 'a')).toMatchObject({ due: '2026-11-30', slot: { due: '2026-11-30', reaches: '2026-11-30' } });
    expect(isDue(byId(list, 'a'), NOW)).toBe(false);
    expect(isDue(byId(list, 'b'), NOW)).toBe(true);
    expect(byId(list, 'b').slot!.ratio).toBeUndefined();
  });

  it('the two directions of a card are still one a day, by the days it gives', () => {
    // as built: both due, the reverse (due later) held back
    const list = items();
    const [f, r] = [byId(list, 'lr', (i) => i.dir === 'f'), byId(list, 'lr', (i) => i.dir === 'r')];
    expect([isDue(f, NOW), !!r.buried]).toEqual([true, true]);
    // the forward is not due by recall: the reverse is no longer held back
    applyScores(list, scorer(list, { lr: { recall: 0.99 }, 'lr/r': { recall: 0.5 } }), ret, NOW);
    expect([isDue(f, NOW), isDue(r, NOW), !!r.buried]).toEqual([false, true, false]);
    // both due by recall: one of them is held back again
    const again = items();
    applyScores(again, scorer(again, { lr: { recall: 0.5 }, 'lr/r': { recall: 0.5 } }), ret, NOW);
    const pair = cards(again).filter((i) => i.id === 'lr');
    expect(pair.filter((i) => isDue(i, NOW)).length).toBe(1);
    expect(pair.filter((i) => i.buried).length).toBe(1);
  });

  it('the day\'s order: its cards by recall against the target, in the places cards had; reading where it was', () => {
    const text = `---\nread: due=2026-11-01\n---\n\nprose to read\n\n${['a', 'b', 'c', 'd', 'e'].map((id) => `${id} :: ${id} ${sr(id, '2026-11-08')}`).join('\n\n')}\n`;
    const natural = sortQueue(items(text, 'mixed.md'), NOW);
    const where = natural.map((i) => i.kind);
    const list = items(text, 'mixed.md');
    const recall: Record<string, number> = { a: 0.7, b: 0.3, c: 0.89, d: 0.5, e: 0.1 };
    applyScores(list, (i) => ({ last: i.sched.last, recall: recall[i.id]! }), ret, NOW);
    const places = slotKeys(list, NOW);
    sortQueue(list, NOW, (i, day) => places.get(i) ?? itemKey(i, day));
    expect(list.map((i) => i.kind)).toEqual(where);
    expect(cards(list).map((i) => i.id)).toEqual(['e', 'b', 'd', 'a', 'c']);
    // with no card scored the order is the built in's own
    expect(slotKeys(natural, NOW).size).toBe(0);
  });

  it('the day\'s allowance and an exam hold over it as they do over the built in', () => {
    const text = `---\ntype: deck\nreviews-per-day: 2\nexam: 2026-12-10\n---\n\n${['a', 'b', 'c', 'd'].map((id) => `${id} :: ${id} ${sr(id, '2026-11-08')}`).join('\n\n')}\n`;
    const doc: Doc = parse(text).doc;
    const metaOf = (p: string) => (p === 'deck.md' ? meta(doc) : undefined);
    const list = docItems('deck.md', doc, NOW);
    const recall: Record<string, number> = { a: 0.7, b: 0.3, c: 0.95, d: 0.5 };
    applyScores(list, (i) => ({ last: i.sched.last, recall: recall[i.id]!, ...(i.id === 'c' ? { due: '2026-12-20' } : {}) }), ret, NOW);
    examQueue(list, NOW, (p) => examsAt(p, metaOf));
    const places = slotKeys(list, NOW);
    meterQueue(list, NOW, { optionsOf: (p) => resolveOptions(p, metaOf), keyOf: (i, day) => places.get(i) ?? itemKey(i, day) });
    const due = cards(list).filter((i) => isDue(i, NOW));
    // the two lowest by recall are the day's two reviews; the third is held as a review over the cap is
    expect(due.map((i) => i.id)).toEqual(['b', 'd']);
    expect(byId(list, 'a').held).toBe('reviews');
    // and the exam counts what is due again by its day: the three due now, not the one whose curve says after it
    const exam = meta(doc).exams![0]!;
    expect(examLeft(list, exam, () => true, () => 0.9)).toMatchObject({ cards: 4, unready: 3 });
  });
});
