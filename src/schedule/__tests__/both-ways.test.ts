// Milestone 44: a both-ways card is asked in two directions, each with its
// own `sr` line (bare: front to back; `sr r`: back to front), and the two are
// siblings, not shown on the same day. The tests walk days.

import { describe, expect, it } from 'vitest';
import { parse, serialize, type Card, type Doc } from '../../format/index.js';
import { addDays, dayOf, docItems, gradeItem, isDue, sameItem, type CardItem } from '../index.js';

/** Local noon on a day, so the day is the same in any zone the tests run in. */
const at = (day: string, hour = 12) => new Date(`${day}T${String(hour).padStart(2, '0')}:00:00`);

const items = (doc: Doc, now: Date) => docItems('deck.md', doc, now).filter((i): i is CardItem => i.kind === 'card');
const fwd = (doc: Doc, now: Date) => items(doc, now).find((i) => i.dir === 'f')!;
const rev = (doc: Doc, now: Date) => items(doc, now).find((i) => i.dir === 'r')!;
const lines = (doc: Doc) => serialize(doc).split('\n');

// an old both-ways card: one bare line, a year of history, as the sample's vocab deck has them
const OLD = 'كَرَمٌ ::: generosity (k-r-m) ^voc-karam\n<!-- sr due=2026-10-29 st=review s=166.7 d=2.69 r=13 l=0 ivl=152 last=2026-05-30T19:21:05Z g=3 -->\n';

describe('both ways, scheduled apart', () => {
  it('a both-ways card is two items, one per direction; a q&a and a cloze stay as they were', () => {
    const { doc } = parse(`${OLD}\na :: b\n\n{{c1::x}} {{c2::y}}\n`);
    const all = docItems('deck.md', doc, at('2026-11-02'));
    expect(all.map((i) => i.kind === 'card' && [i.form, i.dir ?? null])).toEqual([
      ['bidir', 'f'], ['bidir', 'r'], ['qa', null], ['cloze', null], ['cloze', null],
    ]);
    const [f, r] = all as CardItem[];
    expect(sameItem(f!, r!)).toBe(false);
    expect(sameItem(r!, { ...r! })).toBe(true);
  });

  it('a migrated card keeps its history as the forward; the reverse starts new, due now', () => {
    const { doc } = parse(OLD);
    const now = at('2026-11-02');
    const f = fwd(doc, now);
    const r = rev(doc, now);
    expect(f.sched).toMatchObject({ reps: 13, stability: 166.7, due: '2026-10-29' });
    expect(r.sched).toBeUndefined();
    expect(r.due).toBeUndefined();
    // both due: the forward (due first) is shown, the reverse buried till tomorrow
    expect([isDue(f, now), isDue(r, now), r.buried]).toEqual([true, false, true]);
    expect(dayOf(r.dueAt)).toBe('2026-11-03');
    // nothing written for the migration: the file is as it was
    expect(serialize(doc)).toBe(OLD);
  });

  it('grading one direction rewrites its own line and leaves the other alone, day by day', () => {
    const { doc } = parse(OLD);
    const before = lines(doc);
    // day 1: the forward is up and graded; the reverse is held back
    const d1 = at('2026-11-02', 9);
    gradeItem(doc, fwd(doc, d1), 3, d1);
    const after1 = lines(doc);
    expect(after1.length).toBe(before.length);
    expect(after1[0]).toBe(before[0]);
    expect(after1[1]).not.toBe(before[1]);
    expect(after1[1]).toMatch(/^<!-- sr due=\S+ st=review .* r=14 l=0 /);
    expect((doc.blocks[0] as Card).reverse).toBeUndefined();
    // later that day: the forward is not due and the reverse is buried, since its sibling was reviewed today
    const d1late = at('2026-11-02', 20);
    expect(items(doc, d1late).filter((i) => isDue(i, d1late))).toEqual([]);
    expect(rev(doc, d1late).buried).toBe(true);
    // day 2: the reverse comes up, new; graded, it gains an `sr r` line, the forward's line untouched
    const d2 = at('2026-11-03');
    const r2 = rev(doc, d2);
    expect([isDue(r2, d2), r2.buried]).toEqual([true, undefined]);
    gradeItem(doc, r2, 3, d2);
    const after2 = lines(doc);
    expect(after2[1]).toBe(after1[1]);
    expect(after2[2]).toMatch(/^<!-- sr r due=\S+ st=(learning|review) .*r=1 l=0 /);
    expect(after2.length).toBe(after1.length + 1);
    // the reverse through its learning steps; each grade rewrites line 3 alone
    let day = '2026-11-03';
    for (let k = 0; k < 6; k++) {
      day = addDays(day, 1 + k * 2);
      const now = at(day);
      const r = rev(doc, now);
      if (!isDue(r, now)) continue;
      const was = lines(doc);
      gradeItem(doc, r, 3, now);
      const is = lines(doc);
      expect(is.filter((l, i) => l !== was[i])).toEqual([is[2]]);
    }
    expect((doc.blocks[0] as Card).sched).toMatchObject({ reps: 14, stability: expect.any(Number) });
    expect((doc.blocks[0] as Card).reverse!.reps).toBeGreaterThan(1);
  });

  it('siblings: both due, the one due first; one reviewed today buries the other; cram is not held back here', () => {
    const both = parse('a ::: b ^x\n<!-- sr due=2026-11-01 st=review s=3 r=2 last=2026-10-29T10:00:00Z -->\n<!-- sr r due=2026-10-31 st=review s=2 r=2 last=2026-10-29T10:00:00Z -->\n').doc;
    const now = at('2026-11-02');
    // the reverse was due first: it is shown, the forward buried
    expect([isDue(fwd(both, now), now), isDue(rev(both, now), now), fwd(both, now).buried]).toEqual([false, true, true]);
    // a tie goes to the forward
    const tie = parse('a ::: b\n<!-- sr due=2026-11-01 -->\n<!-- sr r due=2026-11-01 -->\n').doc;
    expect([isDue(fwd(tie, now), now), rev(tie, now).buried]).toEqual([true, true]);
    // both new: the forward first
    const fresh = parse('a ::: b\n').doc;
    expect([isDue(fwd(fresh, now), now), isDue(rev(fresh, now), now)]).toEqual([true, false]);
    // one reviewed today, the other due: buried; the reviewed one itself, back in learning, still comes up
    const seen = parse('a ::: b\n<!-- sr due=2026-11-02T13:00:00Z st=relearning s=1 r=5 l=1 last=2026-11-02T10:00:00Z g=1 -->\n<!-- sr r due=2026-10-30 st=review s=4 r=3 -->\n').doc;
    const later = at('2026-11-02', 15);
    expect([isDue(fwd(seen, later), later), rev(seen, later).buried]).toEqual([true, true]);
    // both reviewed today (crammed): neither is held back
    const crammed = parse('a ::: b\n<!-- sr due=2026-11-02T13:00:00Z st=learning r=1 last=2026-11-02T10:00:00Z -->\n<!-- sr r due=2026-11-02T13:00:00Z st=learning r=1 last=2026-11-02T10:05:00Z -->\n').doc;
    expect(items(crammed, later).filter((i) => isDue(i, later)).length).toBe(2);
  });

  it('each direction its own priority and suspension; the bare line\'s `sus` holds both', () => {
    const { doc } = parse('---\npri: 60\n---\n\na ::: b\n<!-- sr pri=30 -->\n<!-- sr r pri=10 -->\n\nc ::: d\n<!-- sr pri=30 -->\n\ne ::: f\n<!-- sr r sus=1 -->\n\ng ::: h\n<!-- sr sus=1 -->\n');
    const all = items(doc, at('2026-11-02'));
    expect(all.map((i) => `${i.text[0]}${i.dir}:${i.pri}`)).toEqual(['af:30', 'ar:10', 'cf:30', 'cr:30', 'ef:60']);
  });

  it('grading the reverse carries its own priority and leaves the forward line as it was', () => {
    const { doc } = parse('a ::: b ^x\n<!-- sr due=2026-11-01 st=review s=3 r=2 -->\n<!-- sr r pri=10 -->\n');
    const now = at('2026-11-05');
    gradeItem(doc, rev(doc, now), 4, now);
    expect((doc.blocks[0] as Card).reverse).toMatchObject({ pri: 10, reps: 1, grade: 4 });
    expect((doc.blocks[0] as Card).sched).toEqual({ due: '2026-11-01', state: 'review', stability: 3, reps: 2 });
  });
});
