// A sample scheduler, to show the slot: a demo, not a memory model. Each
// review that was not `again` doubles a card's half-life from one day,
// `again` puts it back to one, and recall halves every half-life since the
// last review. It is the date-less kind: it says how likely each card is
// to be recalled now, and the app shows the ones at or under their target.
// Built to `plugins/dist/recall-sample/main.js` by `npm run plugins`.

import type { Grade, Ilmi, SchedulerCard, SchedulerOutcome } from '../ilmi.js';

const DAY = 86_400_000;

/** The days a card's recall takes to halve, from its reviews alone. */
export function halfLife(card: Pick<SchedulerCard, 'history'>, then?: Grade): number {
  let h = 1;
  for (const r of card.history) h = r.g === 1 ? 1 : h * 2;
  return then === undefined ? h : then === 1 ? 1 : h * 2;
}

/** A card's chance of recall at `at` (ms); null for one with no review in the log, which the built in keeps. */
export function recallAt(card: Pick<SchedulerCard, 'history'>, at: number): number | null {
  const last = card.history[card.history.length - 1];
  return last ? 0.5 ** (Math.max(0, at - Date.parse(last.at)) / DAY / halfLife(card)) : null;
}

export function activate(ilmi: Ilmi): void {
  ilmi.scheduler.register({
    id: 'recall-sample',
    name: 'recall sample',
    recall: (cards, { now }) => cards.map((c) => recallAt(c, now.getTime())),
    curve: (card, days, { now }) => days.map((d) => recallAt(card, now.getTime() + d * DAY) ?? 0),
    // after a grade recall is 1 and falls to the target in halfLife × log2(1 / target) days
    preview: (card, { now }) => {
      const back = (g: Grade): SchedulerOutcome => ({ due: new Date(now.getTime() + halfLife(card, g) * Math.log2(1 / card.retention) * DAY) });
      return { 1: back(1), 2: back(2), 3: back(3), 4: back(4) };
    },
  });
}
