// A grade from the session: the card's one line rewritten under the options
// that apply where it sits (the retention FSRS aims for, the leech rule),
// and the grade logged to `.ilmi/reviews/` for the numbers. The log is the
// app's, never required: a write that fails there leaves the card graded.

import type { CardSchedule, Review } from '../format/index.js';
import { daysBetween, gradeItem, instantOf, whenToDate, wasLeeched, type CardItem, type Grade } from '../schedule/index.js';
import type { Loaded } from '../vault/index.js';
import { activeExamAt, currentVault, note, optionsAt, recordReview } from './vault.js';

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

/**
 * Grade `item` with `g`: one line rewritten, the options where it sits
 * applied, a leech said in a notice (and suspended when its options say
 * so), and the grade logged. `ms` is the time spent on it, when known.
 */
export async function gradeCard(item: CardItem, g: Grade, now: Date, ms?: number): Promise<Loaded | null> {
  const vault = currentVault();
  if (!vault) return null;
  const { opts } = optionsAt(item.path);
  // studied toward an exam ahead: an interval past its last week is cut into it
  const exam = activeExamAt(item.path, now);
  let wrote: { id: string; key?: string; prev?: CardSchedule; next: CardSchedule } | null = null;
  const loaded = await vault.update(item.path, (doc) => {
    gradeItem(doc, item, g, now, {
      retention: opts.retention,
      leech: { threshold: opts.leech, action: opts.leechAction },
      ...(exam ? { exam } : {}),
      report: (r) => { wrote = r; },
    });
  });
  const w = wrote as { id: string; key?: string; prev?: CardSchedule; next: CardSchedule } | null;
  if (w) {
    if (wasLeeched(w.prev, w.next, opts.leech)) note(`leech · ${opts.leechAction === 'suspend' ? 'suspended' : `${w.next.lapses ?? 0} lapses`}`);
    await recordReview(reviewOf(item.path, w.id, w.key, g, w.prev, w.next, now, ms)).catch((e: unknown) => console.error('review log', e));
  }
  return loaded;
}
