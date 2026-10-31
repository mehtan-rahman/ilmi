// Linked cards (milestone 45, FORMAT.md §6.2 *links*): two cards that test
// one fact, kept both, scheduled as one. `link=<id>` on a card's bare line
// names the other; the two bare lines hold the same state, a grade of one
// is written to both, and only one of them is in a day's queue. Pure.

import { cardForm, type Card, type CardSchedule, type Doc } from '../format/index.js';
import { addDays, dayOf, dayStart, whenToDate } from './dates.js';
import { cardGroups, type CardItem, type QueueItem } from './queue.js';

/**
 * Whether a card is scheduled by its bare line alone, so a link can join it:
 * a q&a, a both-ways card (its front to back; the reverse stays its own), or
 * a cloze of one blank with no line of its own for it.
 */
export function bareLined(card: Card): boolean {
  const form = cardForm(card.text);
  if (form === 'qa' || form === 'bidir') return true;
  if (form !== 'cloze') return false;
  const groups = cardGroups(card.text);
  if (groups.length !== 1) return false;
  const g = groups[0]!;
  return !('n' in g) || card.blanks?.[g.n] === undefined;
}

/** The scheduler's attributes: what a link shares and a merge carries. The rest (`pri`, `sus`, `link`, unknown ones) stays the card's. */
const STATE_KEYS = ['due', 'state', 'stability', 'difficulty', 'reps', 'lapses', 'steps', 'ivl', 'last', 'grade'] as const;

/**
 * `to` with `from`'s state: every scheduler attribute from `from` (none, for
 * a new card), what is the card's own kept from `to`. Undefined when nothing
 * is left (a new card with nothing of its own).
 */
export function withState(from: CardSchedule | undefined, to: CardSchedule | undefined): CardSchedule | undefined {
  const out: CardSchedule = {};
  for (const k of STATE_KEYS) if (from?.[k] !== undefined) (out as Record<string, unknown>)[k] = from[k];
  if (to?.pri !== undefined) out.pri = to.pri;
  if (to?.suspended) out.suspended = true;
  if (to?.link !== undefined) out.link = to.link;
  if (to?.extra?.length) out.extra = to.extra;
  return Object.keys(out).length ? out : undefined;
}

/** How far along a schedule is: its stability, then its reviews, then its last review. A new card is the weakest. */
function strength(s: CardSchedule | undefined): [number, number, number] {
  if (!s || !s.reps) return [-1, 0, 0];
  return [s.stability ?? 0, s.reps, s.last ? whenToDate(s.last).getTime() : 0];
}

/** The stronger of two schedules (the first on a tie): what a link starts both cards from, what a merge keeps. */
export function stronger(a: CardSchedule | undefined, b: CardSchedule | undefined): CardSchedule | undefined {
  const [x, y] = [strength(a), strength(b)];
  for (let i = 0; i < 3; i++) if (x[i] !== y[i]) return x[i]! > y[i]! ? a : b;
  return a;
}

// ── the queue ────────────────────────────────────────────────────

/** A card with an id, where it is: what a link's other side is found by. */
export interface LinkedCard {
  path: string;
  block: number;
  card: Card;
}

/**
 * Every card with an id over `docs`, by id. Ids are the vault's to keep
 * unique; when two documents hold the same id, the first in path order
 * stands for it (FORMAT.md §6.2, links), the first in the file within one.
 */
export function cardsById(docs: Iterable<[string, Doc]>): Map<string, LinkedCard> {
  const out = new Map<string, LinkedCard>();
  for (const [path, doc] of docs) {
    doc.blocks.forEach((b, block) => {
      if (b.kind !== 'card' || b.id === undefined) return;
      const was = out.get(b.id);
      if (!was || path < was.path) out.set(b.id, { path, block, card: b });
    });
  }
  return out;
}

/** The other side of a card's link, when it is there, is not the card itself, and can be joined (`bareLined`). */
export function partnerOf(card: Card, byId: ReadonlyMap<string, LinkedCard>): LinkedCard | undefined {
  const id = card.sched?.link;
  if (id === undefined || id === card.id || !bareLined(card)) return undefined;
  const other = byId.get(id);
  return other && bareLined(other.card) ? other : undefined;
}

/**
 * The other side of a card's link from either end: the card its own
 * `link=` names, else a card whose `link=` names it (one side alone holds a
 * link, FORMAT.md §6.2).
 */
export function linkedWith(card: Card, docs: Iterable<[string, Doc]>, byId: ReadonlyMap<string, LinkedCard> = cardsById(docs)): LinkedCard | undefined {
  const own = partnerOf(card, byId);
  if (own || card.id === undefined || !bareLined(card)) return own;
  for (const [path, doc] of docs) {
    const block = doc.blocks.findIndex((b) => b.kind === 'card' && b !== card && b.sched?.link === card.id && bareLined(b));
    if (block >= 0) return { path, block, card: doc.blocks[block] as Card };
  }
  return undefined;
}

const seenToday = (s: CardSchedule | undefined, now: Date): boolean =>
  !!s?.last && dayOf(whenToDate(s.last)) === dayOf(now);

/** Which of two items the queue shows first: lower priority, then sooner due, then path and place. */
function before(a: CardItem, b: CardItem): boolean {
  if (a.pri !== b.pri) return a.pri < b.pri;
  if (a.dueAt.getTime() !== b.dueAt.getTime()) return a.dueAt < b.dueAt;
  if (a.path !== b.path) return a.path < b.path;
  return a.block <= b.block;
}

/**
 * Only one of a linked pair in a day's queue. In place, before sorting,
 * over items that may hold one side or both:
 *
 * - both sides here and due: the one the queue shows first stays, the other
 *   is buried until the next day;
 * - one side reviewed today and the other not: the other is buried (it is
 *   here or not; its partner may be in another deck);
 * - both reviewed today: asked for, nothing held back.
 *
 * Nothing is written; `buried` and `dueAt` say it, as for a both-ways
 * card's directions. `byId` is every card in the collection (`cardsById`),
 * so a partner outside `items` still counts once it was reviewed today.
 */
export function buryLinked(items: QueueItem[], byId: ReadonlyMap<string, LinkedCard>, now: Date): void {
  const tomorrow = dayStart(addDays(dayOf(now), 1));
  const bury = (i: CardItem) => { if (i.dueAt <= now) { i.buried = true; i.dueAt = tomorrow; } };
  // the item that asks each card's bare line (a both-ways card's forward), by id; a link from either side holds
  const here = new Map<string, CardItem>();
  for (const i of items) if (i.kind === 'card' && i.id !== undefined && i.dir !== 'r' && !here.has(i.id)) here.set(i.id, i);
  const done = new Set<string>();
  for (const item of items) {
    if (item.kind !== 'card' || item.link === undefined || item.id === undefined || here.get(item.id) !== item) continue;
    const id = item.id;
    if (done.has(id)) continue;
    done.add(id);
    const me = byId.get(id);
    const other = me ? partnerOf(me.card, byId) : undefined;
    if (!other || other.card.id === undefined) continue;
    done.add(other.card.id);
    const mine = seenToday(item.sched, now);
    const theirs = seenToday(other.card.sched, now);
    const twin = here.get(other.card.id);
    if (mine !== theirs) {
      if (theirs) bury(item);
      else if (twin) bury(twin);
      continue;
    }
    if (mine || !twin) continue;
    if (item.dueAt <= now && twin.dueAt <= now) bury(before(item, twin) ? twin : item);
  }
}

/**
 * A grade's state written to the other side of a link: its bare line takes
 * `next`'s scheduler attributes and keeps its own `pri`, `sus` and `link`.
 * In place; meant to run inside `vault.update` on the partner's file.
 * Resolves to whether the card was found.
 */
export function copyToPartner(doc: Doc, partnerId: string, next: CardSchedule): boolean {
  const card = doc.blocks.find((b): b is Card => b.kind === 'card' && b.id === partnerId);
  if (!card || !bareLined(card)) return false;
  const s = withState(next, card.sched);
  if (s) card.sched = s;
  else delete card.sched;
  return true;
}
