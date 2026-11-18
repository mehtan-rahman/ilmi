// A grade from the session: the card's one line rewritten under the options
// that apply where it sits (the retention FSRS aims for, the leech rule),
// and the grade logged to `.ilmi/reviews/` for the numbers. The log is the
// app's, never required: a write that fails there leaves the card graded.

import { overAt, type CardSchedule, type Review } from '../format/index.js';
import { cardsById, copyToPartner, daysBetween, grade, gradeItem, instantOf, isDay, learnItem, linkedWith, whenToDate, wasLeeched, type CardItem, type Grade } from '../schedule/index.js';
import type { Loaded, StoreFs } from '../vault/index.js';
import { activeExamAt, allDocs, anyLinks, currentVault, dropReview, note, optionsAt, recordReview, stageReview } from './vault.js';

/** Time on a card past this is time away from it: a review counts this much at most, as Anki caps it. */
export const REVIEW_MS_CAP = 60_000;

const round = (n: number, places: number) => Math.round(n * 10 ** places) / 10 ** places;

/** The log's line for one grade. */
export function reviewOf(path: string, id: string, key: string | undefined, g: Grade, prev: CardSchedule | undefined, next: CardSchedule, now: Date, ms?: number): Review {
  const r: Review = {
    at: instantOf(now), doc: path, card: id, g, st: prev?.state ?? 'new',
    elapsed: prev?.last ? Math.max(0, Math.floor(daysBetween(whenToDate(prev.last), now))) : 0,
    ivl: prev?.ivl ?? 0, next: next.ivl ?? 0,
  };
  if (key !== undefined) r.key = key;
  if (next.stability !== undefined) r.s = round(next.stability, 4);
  if (next.difficulty !== undefined) r.d = round(next.difficulty, 4);
  if (ms !== undefined) r.ms = Math.min(REVIEW_MS_CAP, Math.max(0, Math.round(ms)));
  return r;
}

/** A schedule in its learning or relearning steps: due at an instant, minutes on, not on a day. Its card comes back before the session ends. */
export const inSteps = (s: CardSchedule | undefined): boolean => !!s?.due && !isDay(s.due) && !s.suspended;

/**
 * The schedule `gradeCard` will write for `g` given from `from`, told before it is written: whether the card stays
 * in its steps (`inSteps`), so the session knows at the grade whether it comes back. An exam's cut moves days only,
 * so it is left out; a leech set to suspend is suspended, and does not come back.
 */
export function gradeAhead(path: string, from: CardSchedule | undefined, g: Grade, now: Date): CardSchedule {
  const { opts } = optionsAt(path);
  const next = grade(from, g, now, opts.retention !== undefined ? { request_retention: opts.retention } : undefined);
  if (opts.leechAction === 'suspend' && wasLeeched(from, next, opts.leech)) next.suspended = true;
  return next;
}

/**
 * A card learnt (`got it`, the `learnNew` tweak): the line `item` asks says so (`seen`, FORMAT.md §6.2) and is
 * otherwise as it was, so the card is asked as a test, not shown to learn again, in this session or any after it,
 * here or on another device. A linked card's other side says it too: the two are one schedule. Nothing is logged:
 * it is not a review. `told` hears the card's id and the line's key as written (a card with no id has one now).
 * Resolves to the document; null with no collection open.
 */
export async function learnCard(item: CardItem, now: Date, told?: (wrote: { id: string; key?: string }) => void): Promise<Loaded | null> {
  const vault = currentVault();
  if (!vault) return null;
  let wrote: { id: string; key?: string; next: CardSchedule } | null = null;
  const loaded = await vault.update(item.path, (doc) => { wrote = learnItem(doc, item, now); });
  const w = wrote as { id: string; key?: string; next: CardSchedule } | null;
  if (!w) return loaded;
  told?.(w);
  if (w.key === undefined && anyLinks()) {
    const docs = allDocs();
    const byId = cardsById(docs);
    const me = byId.get(w.id);
    const other = me ? linkedWith(me.card, docs, byId) : undefined;
    if (other?.card.id !== undefined) {
      const id = other.card.id;
      await vault.update(other.path, (doc) => { copyToPartner(doc, id, w.next); }).catch((e: unknown) => console.error('link', e));
    }
  }
  return loaded;
}

/** A grade as it was written: what a grade given again in the session replaces (`gradeCard`'s `over`). */
export interface Graded {
  /** Its line in the log; a regrade's `over` names its `at`. */
  line: Review;
  /** The schedule line before it, and after. */
  prev?: CardSchedule;
  next: CardSchedule;
}

/**
 * Grade `item` with `g`: one line rewritten, the options where it sits
 * applied, a leech said in a notice (and suspended when its options say
 * so), and the grade logged. `ms` is the time spent on it, when known.
 * A linked card's grade is written to the other card's bare line too (its
 * state, not its priority or suspension), in its own file: the grade
 * counts for both (FORMAT.md §6.2, links). The log has one line, the
 * graded card's. `over`: the grade this one gives again (‹ back to a card
 * graded in the session): the line goes back to before it and is graded
 * from there, and the log's line replaces its line (FORMAT.md §1), so
 * the card counts once. `told` hears the grade as written. `after`: the
 * instant of the line the card's grade before this one in the session was
 * logged at (a card asked again): this one's is after it, so two grades of
 * one card in one second stay two lines (`reviewKey`).
 */
export async function gradeCard(item: CardItem, g: Grade, now: Date, ms?: number, over?: Graded | null, told?: (graded: Graded) => void, after?: string | null): Promise<Loaded | null> {
  const vault = currentVault();
  if (!vault) return null;
  const { opts } = optionsAt(item.path);
  // studied toward an exam ahead: an interval past its last week is cut into it
  const exam = activeExamAt(item.path, now);
  // over a store the grade's line goes into the log in the transaction that writes its schedule
  const store = 'logWith' in vault.fs ? (vault.fs as StoreFs) : null;
  let wrote: { id: string; key?: string; prev?: CardSchedule; next: CardSchedule } | null = null;
  let line: Review | null = null;
  const unstage = () => { if (line) dropReview(line); line = null; };
  const logLine = (r: { id: string; key?: string; prev?: CardSchedule; next: CardSchedule }): Review => {
    const l = reviewOf(item.path, r.id, r.key, g, r.prev, r.next, now, ms);
    // asked again: its line is after the one its last asking wrote
    if (after) l.at = overAt(l.at, after);
    // given again: the line replaces the one before it, logged after it
    if (over) Object.assign(l, { at: overAt(l.at, over.line.at), over: over.line.at });
    return l;
  };
  let loaded: Loaded;
  try {
    loaded = await vault.update(item.path, (doc) => {
      gradeItem(doc, item, g, now, {
        retention: opts.retention,
        leech: { threshold: opts.leech, action: opts.leechAction },
        ...(exam ? { exam } : {}),
        ...(over ? { over } : {}),
        report: (r) => {
          wrote = r;
          if (!store) return;
          // the update may run again on a file that moved: the line is the last run's
          unstage();
          line = logLine(r);
          stageReview(line);
          store.logWith(item.path, [line]);
        },
      });
    });
  } catch (e) {
    unstage();
    store?.logWith(item.path, []);
    throw e;
  }
  const w = wrote as { id: string; key?: string; prev?: CardSchedule; next: CardSchedule } | null;
  // the other side of a link takes the same state; a reverse's grade is the reverse's own
  if (w && w.key === undefined && anyLinks()) {
    const docs = allDocs();
    const byId = cardsById(docs);
    const me = byId.get(w.id);
    const other = me ? linkedWith(me.card, docs, byId) : undefined;
    const next = w.next;
    if (other?.card.id !== undefined) {
      const id = other.card.id;
      await vault.update(other.path, (doc) => { copyToPartner(doc, id, next); }).catch((e: unknown) => console.error('link', e));
    }
  }
  if (w) {
    if (wasLeeched(w.prev, w.next, opts.leech)) note(`leech · ${opts.leechAction === 'suspend' ? 'suspended' : `${w.next.lapses ?? 0} lapses`}`);
    const staged = line as Review | null;
    const logged = store && staged ? staged : logLine(w);
    told?.({ line: logged, ...(w.prev ? { prev: w.prev } : {}), next: w.next });
    if (store && staged) {
      await store.flushLog(item.path).catch((e: unknown) => console.error('review log', e));
      await recordReview(staged, true);
    } else {
      await recordReview(logged).catch((e: unknown) => console.error('review log', e));
    }
  }
  return loaded;
}
