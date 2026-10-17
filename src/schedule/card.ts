// Card grading: `CardSchedule` ↔ ts-fsrs `Card`, and `grade`. FORMAT.md §6.2
// gives the attribute mapping. Stability and difficulty are stored at full
// precision (the format writes the shortest round-trip decimal), so a card
// read back from disk is the card ts-fsrs would have held; rounding them to
// two decimals drifted intervals by up to 8% over forty reviews. Fuzz is off
// so the same input always schedules the same way.

import { fsrs, generatorParameters, Rating, State, type Card as FsrsCard, type FSRSParameters, type Grade as FsrsGrade } from 'ts-fsrs';
import type { CardSchedule, SrState } from '../format/index.js';
import { dayOf, daysBetween, instantOf, whenToDate } from './dates.js';

/** again · hard · good · easy */
export type Grade = 1 | 2 | 3 | 4;

export const GRADES: readonly Grade[] = [1, 2, 3, 4];

/** Index is the ts-fsrs `State` enum value. */
const STATES: readonly SrState[] = ['new', 'learning', 'review', 'relearning'];

export function toFsrs(s: CardSchedule | undefined, now: Date): FsrsCard {
  const last = s?.last ? whenToDate(s.last) : undefined;
  const card: FsrsCard = {
    due: s?.due ? whenToDate(s.due) : now,
    state: STATES.indexOf(s?.state ?? 'new') as State,
    stability: s?.stability ?? 0,
    difficulty: s?.difficulty ?? 0,
    reps: s?.reps ?? 0,
    lapses: s?.lapses ?? 0,
    learning_steps: s?.steps ?? 0,
    scheduled_days: s?.ivl ?? 0,
    elapsed_days: last ? daysBetween(last, now) : 0,
  };
  if (last) card.last_review = last;
  return card;
}

/**
 * Back to the format. `due` is a day once the card is scheduled a day or more
 * out, an instant while it is in learning steps measured in minutes. What is
 * not the scheduler's (`pri`, unknown attributes) is carried over from `prev`.
 */
export function fromFsrs(c: FsrsCard, grade: Grade, prev?: Pick<CardSchedule, 'pri' | 'extra'>): CardSchedule {
  const out: CardSchedule = {
    due: c.scheduled_days >= 1 ? dayOf(c.due) : instantOf(c.due),
    state: STATES[c.state] ?? 'new',
    stability: c.stability,
    difficulty: c.difficulty,
    reps: c.reps,
    lapses: c.lapses,
  };
  if (c.learning_steps > 0) out.steps = c.learning_steps;
  out.ivl = c.scheduled_days;
  if (c.last_review) out.last = instantOf(c.last_review);
  out.grade = grade;
  if (prev?.pri !== undefined) out.pri = prev.pri;
  if (prev?.extra?.length) out.extra = prev.extra;
  return out;
}

const scheduler = (params?: Partial<FSRSParameters>) => fsrs(generatorParameters(params));

/** The schedule after grading `s` (absent = a new card) at `now`. */
export function grade(s: CardSchedule | undefined, rating: Grade, now: Date, params?: Partial<FSRSParameters>): CardSchedule {
  const { card } = scheduler(params).next(toFsrs(s, now), now, rating as FsrsGrade);
  return fromFsrs(card, rating, s);
}

/** What each grade would schedule, for hints. */
export function preview(s: CardSchedule | undefined, now: Date, params?: Partial<FSRSParameters>): Record<Grade, CardSchedule> {
  const log = scheduler(params).repeat(toFsrs(s, now), now);
  const out = {} as Record<Grade, CardSchedule>;
  for (const g of GRADES) out[g] = fromFsrs(log[g as Rating.Again].card, g, s);
  return out;
}
