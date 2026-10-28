// Studying one deck: a session over the cards under a deck, a folder, a
// document with children, or a selection. Pure; `studyDeck` in vault.ts
// opens it. Suspended cards are never here (`docItems` leaves them out).
//
// Due only: the cards due now, in the queue's order. `include not due`
// crams: every unsuspended card, the reviewed ones in the queue's order
// (due first, then the rest by due), the new ones last in deck order. A card graded
// early is graded as usual: FSRS reads the short elapsed time off `last`
// and grows stability less for it, so an early review costs nothing but
// the review.

import type { Doc } from '../format/index.js';
import { docItems, isDue, sortQueue, type CardItem } from '../schedule/index.js';

export interface StudyOptions {
  /** `include not due`: every unsuspended card, new ones last. */
  cram?: boolean;
  /** Only these cards, by `path#block` (a selection's keys). */
  only?: ReadonlySet<string>;
}

const isNew = (i: CardItem): boolean => !i.sched?.reps;

/** The session's items over `docs` (in deck order), as `opts` says. */
export function studyItems(docs: Iterable<[string, Doc]>, now: Date, opts: StudyOptions = {}): CardItem[] {
  const all: CardItem[] = [];
  for (const [path, doc] of docs) {
    for (const i of docItems(path, doc, now)) {
      if (i.kind === 'card' && (!opts.only || opts.only.has(`${i.path}#${i.block}`))) all.push(i);
    }
  }
  if (!opts.cram) return sortQueue(all.filter((i) => isDue(i, now)), now) as CardItem[];
  const fresh = all.filter(isNew);
  const rest = sortQueue(all.filter((i) => !fresh.includes(i)), now) as CardItem[];
  return [...rest, ...fresh];
}

/** `german · A1 · 12 left`: the session header over a deck. */
export const studyHeader = (title: string, left: number): string => `${title} · ${left} left`;
