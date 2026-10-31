// Milestone 45: two linked cards (`link=<id>` on each bare line, FORMAT.md
// §6.2) share one schedule and are never both in one day's queue. The
// tests walk days over two files, as a course note and a textbook extract.

import { describe, expect, it } from 'vitest';
import { parse, serialize, type Card, type CardSchedule, type Doc } from '../../format/index.js';
import { bareLined, buryLinked, cardsById, copyToPartner, dayOf, docItems, gradeItem, isDue, linkedWith, queueItems, stronger, withState, type CardItem } from '../index.js';

/** Local noon on a day, so the day is the same in any zone the tests run in. */
const at = (day: string, hour = 12) => new Date(`${day}T${String(hour).padStart(2, '0')}:00:00`);

const NOTES = 'canonical.md';
const BOOK = 'lindqvist.md';
const note = (sched: string) => `$$\nF = {{c1::-kT \\ln Z}}\n$$ ^sm-F-lnZ\n<!-- sr ${sched} -->\n\nunlinked :: a card of its own ^sm-other\n<!-- sr due=2026-11-01 st=review s=9 r=3 ivl=9 last=2026-10-23T09:00:00Z g=3 -->\n`;
const book = (sched: string) => `$$\nF = {{c1::-kT\\ln Z}}\n$$ ^lq3-F-lnZ\n<!-- sr ${sched} -->\n`;

const LINKED_A = 'due=2026-11-02 st=review s=14 d=5 r=5 l=0 ivl=14 last=2026-10-19T09:00:00Z g=3 link=lq3-F-lnZ';
const LINKED_B = 'due=2026-11-02 st=review s=14 d=5 r=5 l=0 ivl=14 last=2026-10-19T09:00:00Z g=3 pri=20 link=sm-F-lnZ';

function vault(a = LINKED_A, b = LINKED_B): Map<string, Doc> {
  return new Map([[NOTES, parse(note(a)).doc], [BOOK, parse(book(b)).doc]]);
}

/** The day's card items over both files, sorted, linked pairs buried. */
const today = (v: Map<string, Doc>, now: Date) => queueItems(v, now).filter((i): i is CardItem => i.kind === 'card');
const dueToday = (v: Map<string, Doc>, now: Date) => today(v, now).filter((i) => isDue(i, now)).map((i) => i.id!).sort();
const card = (v: Map<string, Doc>, path: string, id: string) => v.get(path)!.blocks.find((b): b is Card => b.kind === 'card' && b.id === id)!;

/** A session's grade of `item`, and the grade written to its partner, as gradeCard does. */
function gradeLinked(v: Map<string, Doc>, item: CardItem, g: 1 | 2 | 3 | 4, now: Date): CardSchedule {
  const next = gradeItem(v.get(item.path)!, item, g, now);
  const other = linkedWith(card(v, item.path, item.id!), v);
  if (other) copyToPartner(v.get(other.path)!, other.card.id!, next);
  return next;
}

describe('linked cards', () => {
  it('carry the link on the item that asks the bare line: q&a, a cloze of one blank, a both-ways card\'s forward', () => {
    const { doc } = parse('a :: b ^a\n<!-- sr link=b -->\n\nx ::: y ^b\n<!-- sr link=a -->\n<!-- sr r link=a -->\n\n{{c1::m}} {{c2::n}} ^c\n<!-- sr link=a -->\n');
    const items = docItems('d.md', doc, at('2026-11-02')).filter((i): i is CardItem => i.kind === 'card');
    expect(items.map((i) => [i.id, i.dir ?? null, i.link ?? null])).toEqual([
      ['a', null, 'b'], ['b', 'f', 'a'], ['b', 'r', null], ['c', null, null], ['c', null, null],
    ]);
    const cards = doc.blocks.filter((b): b is Card => b.kind === 'card');
    expect(cards.map(bareLined)).toEqual([true, true, false]);
    // a cloze of one blank with a line of its own for it is not bare-lined
    expect(bareLined(parse('{{c1::x}} y ^q\n<!-- sr c1 due=2026-11-01 -->\n').doc.blocks[0] as Card)).toBe(false);
  });

  it('are never both in one day\'s queue: both due, the one the queue shows first stays and the other is buried', () => {
    const v = vault();
    const now = at('2026-11-02');
    const items = today(v, now);
    const a = items.find((i) => i.id === 'sm-F-lnZ')!;
    const b = items.find((i) => i.id === 'lq3-F-lnZ')!;
    // the book's card has priority 20, ahead of the notes' 50: it is shown, the note's buried till tomorrow
    expect([isDue(b, now), isDue(a, now), a.buried]).toEqual([true, false, true]);
    expect(dayOf(a.dueAt)).toBe('2026-11-03');
    expect(dueToday(v, now)).toEqual(['lq3-F-lnZ', 'sm-other']);
    // a tie on priority: the sooner due, then the path (the notes' file name sorts first)
    const tie = vault(LINKED_A, LINKED_B.replace(' pri=20', ''));
    expect(dueToday(tie, now)).toEqual(['sm-F-lnZ', 'sm-other']);
    const sooner = vault(LINKED_A, LINKED_B.replace(' pri=20', '').replace('due=2026-11-02', 'due=2026-10-31'));
    expect(dueToday(sooner, now)).toEqual(['lq3-F-lnZ', 'sm-other']);
    // nothing written: burying is the queue's
    expect(serialize(v.get(NOTES)!)).toBe(note(LINKED_A));
  });

  it('grading one writes the same state to the other, keeping its own priority; neither comes back that day, both move on together', () => {
    const v = vault();
    const d1 = at('2026-11-02', 9);
    const b = today(v, d1).find((i) => i.id === 'lq3-F-lnZ')!;
    const noteLines = serialize(v.get(NOTES)!).split('\n');
    const next = gradeLinked(v, b, 3, d1);
    const A = card(v, NOTES, 'sm-F-lnZ').sched!;
    const B = card(v, BOOK, 'lq3-F-lnZ').sched!;
    // the same schedule on both lines, each its own pri and link
    expect({ ...A, link: undefined, pri: undefined }).toEqual({ ...B, link: undefined, pri: undefined });
    expect([A.reps, A.due, A.link, A.pri, B.pri, B.link]).toEqual([6, next.due, 'lq3-F-lnZ', undefined, 20, 'sm-F-lnZ']);
    // one line rewritten in the notes, the rest of the file as it was
    const after = serialize(v.get(NOTES)!).split('\n');
    expect(after.filter((l, i) => l !== noteLines[i])).toEqual([`<!-- sr due=${next.due} st=review s=${A.stability} d=${A.difficulty} r=6 l=0 ivl=${A.ivl} last=${A.last} g=3 link=lq3-F-lnZ -->`]);
    // later that day: neither is due
    expect(dueToday(v, at('2026-11-02', 20))).toEqual(['sm-other']);
    // walk the days: whenever they come due, they come due together, and only one is shown
    let day = at('2026-11-03');
    let shown = 0;
    for (let n = 0; n < 120; n++, day = at(dayOf(new Date(day.getTime() + 86_400_000)))) {
      const due = today(v, day).filter((i) => isDue(i, day) && i.id !== 'sm-other');
      expect(due.length).toBeLessThanOrEqual(1);
      const up = due[0];
      if (!up) continue;
      shown++;
      gradeLinked(v, up, 3, day);
      expect(card(v, NOTES, 'sm-F-lnZ').sched!.due).toBe(card(v, BOOK, 'lq3-F-lnZ').sched!.due);
      expect(card(v, NOTES, 'sm-F-lnZ').sched!.reps).toBe(card(v, BOOK, 'lq3-F-lnZ').sched!.reps);
    }
    expect(shown).toBeGreaterThan(0);
    expect(card(v, BOOK, 'lq3-F-lnZ').sched!.pri).toBe(20);
  });

  it('one reviewed today buries the other, even when it is in a deck studied apart', () => {
    // the notes' card graded this morning by hand-edited lines that differ: the book's is still due
    const v = vault(LINKED_A.replace('last=2026-10-19T09:00:00Z', 'last=2026-11-02T08:00:00Z').replace('due=2026-11-02', 'due=2026-11-20'), LINKED_B);
    const now = at('2026-11-02', 14);
    expect(dueToday(v, now)).toEqual(['sm-other']);
    // a deck over the book alone, its partner known from the whole collection
    const items = docItems(BOOK, v.get(BOOK)!, now);
    buryLinked(items, cardsById(v), now);
    expect(items.filter((i) => isDue(i, now))).toEqual([]);
    // both reviewed today (a cram): nothing held back
    const both = vault(LINKED_A.replace('last=2026-10-19T09:00:00Z', 'last=2026-11-02T08:00:00Z'), LINKED_B.replace('last=2026-10-19T09:00:00Z', 'last=2026-11-02T08:30:00Z'));
    expect(dueToday(both, now)).toEqual(['lq3-F-lnZ', 'sm-F-lnZ', 'sm-other']);
  });

  it('a suspended side, a link to nowhere, a link to itself: the other card is studied alone', () => {
    const now = at('2026-11-02');
    expect(dueToday(vault(LINKED_A, `${LINKED_B} sus=1`), now)).toEqual(['sm-F-lnZ', 'sm-other']);
    expect(dueToday(vault(LINKED_A.replace('link=lq3-F-lnZ', 'link=nowhere'), LINKED_B.replace('link=sm-F-lnZ', 'link=lq3-F-lnZ')), now)).toEqual(['lq3-F-lnZ', 'sm-F-lnZ', 'sm-other']);
    // one side alone names the other: the link holds, and a grade of either side reaches the other
    const one = vault(LINKED_A, LINKED_B.replace(' link=sm-F-lnZ', ''));
    expect(dueToday(one, now)).toEqual(['lq3-F-lnZ', 'sm-other']);
    gradeLinked(one, today(one, now).find((i) => i.id === 'lq3-F-lnZ')!, 4, now);
    expect(card(one, NOTES, 'sm-F-lnZ').sched!.reps).toBe(6);
    expect(card(one, NOTES, 'sm-F-lnZ').sched!.link).toBe('lq3-F-lnZ');
    expect(card(one, BOOK, 'lq3-F-lnZ').sched!.link).toBeUndefined();
  });

  it('the stronger schedule, and a state copied with what is the card\'s own kept', () => {
    const weak: CardSchedule = { due: '2026-11-01', state: 'review', stability: 3, reps: 2 };
    const strong: CardSchedule = { due: '2026-12-01', state: 'review', stability: 40, reps: 9, pri: 10 };
    expect(stronger(weak, strong)).toBe(strong);
    expect(stronger(undefined, weak)).toBe(weak);
    expect(stronger(weak, undefined)).toBe(weak);
    expect(withState(strong, { pri: 70, suspended: true, link: 'x', extra: [['k', 'v']] })).toEqual({
      due: '2026-12-01', state: 'review', stability: 40, reps: 9, pri: 70, suspended: true, link: 'x', extra: [['k', 'v']],
    });
    expect(withState(undefined, { pri: 70, link: 'x' })).toEqual({ pri: 70, link: 'x' });
    expect(withState(undefined, undefined)).toBeUndefined();
  });
});
