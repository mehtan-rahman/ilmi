// Studying one deck: a session over the cards under a deck, a folder, a
// document with children, or a selection. Pure; `studyDeck` in vault.ts
// opens it. Suspended cards are never here (`docItems` leaves them out).
//
// Due only: the cards due now, in the queue's order, and after them the
// cards in their steps that come due later today. `include not due`
// crams: every unsuspended card, the reviewed ones in the queue's order
// (due first, then the rest by due), the new ones last in deck order. A card graded
// early is graded as usual: FSRS reads the short elapsed time off `last`
// and grows stability less for it, so an early review costs nothing but
// the review.

import type { Doc } from '../format/index.js';
import { buryLinked, cardsById, docItems, examQueue, isDue, itemKey as dayKey, slotKeys, sortQueue, stepsAhead, type CardItem, type ExamAt, type LinkedCard, type QueueItem } from '../schedule/index.js';

export interface StudyOptions {
  /** `include not due`: every unsuspended card, new ones last. */
  cram?: boolean;
  /** Only these cards, by `path#block` (a selection's keys). */
  only?: ReadonlySet<string>;
  /** Held over the day's allowance (the queue's `held`, `options.ts`): left out unless cramming. */
  held?: (i: CardItem) => boolean;
  /** The exams over a document: a review brought before one is due here as in the queue (`examQueue`). */
  exams?: (path: string) => readonly ExamAt[];
  /** Every card in the collection by id (`cardsById`), for a linked card's other side outside the deck; absent, the deck's own. */
  linked?: ReadonlyMap<string, LinkedCard>;
  /** Another scheduler's word laid over the cards, in place (`schedule/slot.ts`), before the exams and the links; absent, the built in's days. */
  lay?: (items: CardItem[], now: Date) => void;
}

/** A card item's place in the queue: its card and the line it asks. */
export const itemKey = (i: CardItem): string => `${i.path}#${i.id ?? i.block}#${i.dir ?? ''}#${i.group ? JSON.stringify(i.group) : ''}`;

const isNew = (i: CardItem): boolean => !i.sched?.reps;

/** The session's items over `docs` (in deck order), as `opts` says. */
export function studyItems(docs: Iterable<[string, Doc]>, now: Date, opts: StudyOptions = {}): CardItem[] {
  const all: CardItem[] = [];
  const list = [...docs];
  for (const [path, doc] of list) {
    for (const i of docItems(path, doc, now)) {
      if (i.kind === 'card' && (!opts.only || opts.only.has(`${i.path}#${i.block}`))) all.push(i);
    }
  }
  opts.lay?.(all, now);
  if (opts.exams) examQueue(all, now, opts.exams);
  // of two linked cards, one a day, unless cramming (asked for)
  if (!opts.cram) buryLinked(all, opts.linked ?? cardsById(list), now);
  // what is due, then the cards in their steps due later today: asked at the end, as a card graded into its steps here is
  if (!opts.cram) {
    const due = all.filter((i) => isDue(i, now) && !opts.held?.(i));
    // by recall where a date-less scheduler scored them (`slotKeys`); no card it scored, the day's order as it is
    const places = slotKeys(due, now);
    return [...(sortQueue(due, now, places.size ? (i: QueueItem, day: string) => places.get(i) ?? dayKey(i, day) : undefined) as CardItem[]), ...stepsAhead(all, now)];
  }
  const fresh = all.filter(isNew);
  const rest = sortQueue(all.filter((i) => !fresh.includes(i)), now) as CardItem[];
  return [...rest, ...fresh];
}

/** `german · A1 · 12 left`: the session header over a deck. */
export const studyHeader = (title: string, left: number): string => `${title} · ${left} left`;
