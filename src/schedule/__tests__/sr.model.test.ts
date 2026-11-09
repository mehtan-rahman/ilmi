// The scheduler as a state machine, checked exhaustively: a card's `sr`
// line is the state, a grade at some moment the event. From a new card
// (one carrying a priority, a link and `sus=1`, which a grade must keep),
// every sequence of six grades, each given at the card's due time or a day
// early, is walked, the line written to the file and read back after each
// (the file is the state: FORMAT.md §6.2), and after every step:
//
//   new        --again|hard|good--> learning      --easy--> review
//   learning   --again|hard--> learning   --good--> learning|review (the last step)   --easy--> review
//   review     --again--> relearning      --hard|good|easy--> review
//   relearning --again|hard--> relearning --good|easy--> review
//
// and never back to new; reps one more, lapses one more exactly on a review
// forgotten; `last` the grade's moment, `due` not before it, `g` the grade;
// what is not the scheduler's carried over; the grade's hints (`preview`)
// the schedules the grades write, their dues in grade order; a pass on a
// review (hard and up) never lowers the stability, and good or easy given
// on time sends the card further out than it was.
//
// Six grades of four at two moments is 8^6 sequences (about 300 000 states,
// each graded once since the walk shares prefixes): past the learning
// steps (two), the relearning step (one), and a lapse and its way back, so
// every edge above is taken from every state, and from states reached by
// both an early and an on-time road.

import { describe, expect, it } from 'vitest';
import { parse, serialize, type Card, type CardSchedule, type SrState } from '../../format/index.js';
import { GRADES, grade, preview, whenToDate, type Grade } from '../index.js';

const EDGES: Record<SrState, Record<Grade, SrState[]>> = {
  new: { 1: ['learning'], 2: ['learning'], 3: ['learning'], 4: ['review'] },
  learning: { 1: ['learning'], 2: ['learning'], 3: ['learning', 'review'], 4: ['review'] },
  review: { 1: ['relearning'], 2: ['review'], 3: ['review'], 4: ['review'] },
  relearning: { 1: ['relearning'], 2: ['relearning'], 3: ['review'], 4: ['review'] },
};

type When = 'due' | 'early';
const EVENTS: [Grade, When][] = GRADES.flatMap((g) => (['due', 'early'] as const).map((w) => [g, w] as [Grade, When]));
const DEPTH = 6;
const DAY = 86_400_000;
const START = new Date('2026-03-02T09:00:00Z');
const CARRIED: CardSchedule = { pri: 7, link: 'c-other', suspended: true };

/** When the event grades the card: at its due time (now, if it is past), or a day before it (not before its last review). */
function momentOf(s: CardSchedule, when: When, now: Date): Date {
  const due = s.due ? whenToDate(s.due) : now;
  const at = when === 'due' ? due : new Date(due.getTime() - DAY);
  const last = s.last ? whenToDate(s.last).getTime() + 1000 : now.getTime();
  return new Date(Math.max(at.getTime(), last, now.getTime()));
}

/** The line written to the file and read back, as the next grade sees it. */
function roundTrip(s: CardSchedule): CardSchedule {
  const doc = { blocks: [{ kind: 'card', text: 'q :: a', id: 'c-model', sched: s } as Card] };
  const back = parse(serialize(doc)).doc.blocks[0] as Card;
  return back.sched!;
}

const secondOf = (d: Date) => Math.floor(d.getTime() / 1000) * 1000;

function check(prev: CardSchedule, g: Grade, at: Date, next: CardSchedule, path: string): void {
  const from = prev.state ?? 'new';
  const ok = EDGES[from][g];
  if (!ok.includes(next.state!)) throw new Error(`${path}: ${from} --${g}--> ${next.state}, not one of ${ok.join('|')}`);
  expect(next.reps, path).toBe((prev.reps ?? 0) + 1);
  expect(next.lapses, path).toBe((prev.lapses ?? 0) + (from === 'review' && g === 1 ? 1 : 0));
  expect(whenToDate(next.last!).getTime(), path).toBe(secondOf(at));
  expect(whenToDate(next.due!).getTime(), path).toBeGreaterThanOrEqual(secondOf(at));
  expect(next.grade, path).toBe(g);
  expect([next.pri, next.link, next.suspended], path).toEqual([7, 'c-other', true]);
  if (from === 'review' && g >= 2) expect(next.stability!, path).toBeGreaterThanOrEqual(prev.stability! - 1e-9);
  if (from === 'review' && g >= 3 && at >= whenToDate(prev.due!)) expect(whenToDate(next.due!).getTime(), path).toBeGreaterThan(whenToDate(prev.due!).getTime());
}

describe('the scheduler, every grade sequence', () => {
  it(`${DEPTH} grades deep, at the due time or a day early: only the legal edges, the line read back as written`, () => {
    let states = 0;
    const seen = new Set<string>();
    const walk = (s: CardSchedule, now: Date, path: string, depth: number) => {
      if (depth === DEPTH) return;
      for (const [g, when] of EVENTS) {
        const at = momentOf(s, when, now);
        const next = grade(s, g, at);
        const p = `${path} ${g}${when === 'early' ? 'e' : ''}`;
        check(s, g, at, next, p);
        // the hints are what the grades write
        if (depth < 4) {
          const hints = preview(s, at);
          expect(hints[g], p).toEqual(next);
          const dues = GRADES.map((h) => whenToDate(hints[h].due!).getTime());
          expect([...dues].sort((a, b) => a - b), `${p}: the hints' dues in grade order`).toEqual(dues);
        }
        const read = roundTrip(next);
        expect(read, `${p}: the line read back`).toEqual(next);
        seen.add(`${s.state ?? 'new'}>${g}>${next.state}`);
        states++;
        walk(read, at, p, depth + 1);
      }
    };
    walk(CARRIED, START, '', 0);
    expect(states).toBe((8 ** (DEPTH + 1) - 8) / 7);
    // every edge the table allows is taken somewhere
    const want = Object.entries(EDGES).flatMap(([f, by]) => Object.entries(by).flatMap(([g, tos]) => tos.map((t) => `${f}>${g}>${t}`)));
    expect([...seen].sort()).toEqual(want.sort());
  }, 120_000);
});
