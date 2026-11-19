// FSRS-7 as a scheduler in the slot (`slot.ts`), carried by the app beside
// the built in. The built in stays FSRS-6 (ts-fsrs 5, `card.ts`), whose
// state the `sr` lines hold; FSRS-7 cannot take that state over. ts-fsrs
// 6's migration notes say so: its memory has a second stability
// (`stabilityFast`) that is not to be invented, its weights are other
// weights, and a learned card is moved to it by replaying its whole review
// history. So that is what this does, and all it does: each card's FSRS-7
// memory is replayed from the review log, with elapsed time in fractions
// of a day as FSRS-7 counts it, and nothing of it is written anywhere. A
// card whose history is not whole in the log (the log starts after the
// card did) has no word from it and stays on the built in, as the notes
// ask.
//
// It is the date-less kind: `recall` is FSRS-7's retrievability now, a card
// is due when that is at or under its retention, and `preview` says when
// that will next be so after each grade. Its sub-day intervals therefore
// need no place in the format either. The weights are the model's defaults
// until `fit to my reviews` has fitted them to the collection's log
// (`fitCards`, then `fsrs_fit` on the Rust side), kept in
// `.ilmi/scheduler.json` so every device answers alike.

import { FSRS7Algorithm, FSRS7_DEFAULT_WEIGHTS, FSRS7_MODEL_BOUNDS, checkFSRS7Parameters, clipFSRS7Parameters, type FSRS7State } from 'ts-fsrs-6/models/fsrs-7';
import type { Review } from '../format/index.js';
import type { Grade } from './card.js';
import { scoreKey, type Outcome, type SchedCard, type Scheduler } from './slot.js';

export const FSRS7_ID = 'fsrs-7';
/** The optimiser trains from this many items (a review of a card that had one before it); with fewer it gives its defaults back (`fsrs` 7.0.0, `MIN_ITEMS_TO_TRAIN`). */
export const FSRS7_MIN_ITEMS = 64;
const DAY = 86_400_000;
const WEIGHTS = FSRS7_DEFAULT_WEIGHTS.length;

/** A card's FSRS-7 memory, and the instant (ms) of the review it stands at. */
export interface Fsrs7State extends FSRS7State {
  at: number;
}

/** What a fit left in `.ilmi/scheduler.json`, under `fsrs7`. */
export interface Fsrs7Fit {
  /** The 34 weights, to four decimals. */
  w: number[];
  /** How many reviews they were fitted from. */
  reviews: number;
  /** The day they were fitted. */
  fitted: string;
}

/** Weights FSRS-7 can run on, from whatever was kept: 34 numbers within the model's bounds, to four decimals; null for anything else (the defaults then stand). */
export function fsrs7Weights(w: unknown): number[] | null {
  if (!Array.isArray(w) || w.length !== WEIGHTS || !w.every((x) => typeof x === 'number' && Number.isFinite(x))) return null;
  try {
    const clipped = clipFSRS7Parameters((w as number[]).map((x) => Math.round(x * 1e4) / 1e4));
    checkFSRS7Parameters(clipped);
    return clipped.map((x) => Math.round(x * 1e4) / 1e4);
  } catch {
    return null;
  }
}

/** A fit as it was kept, or null when what is there is not one. */
export function fsrs7FitIn(data: Record<string, unknown>): Fsrs7Fit | null {
  const f = data.fsrs7;
  if (!f || typeof f !== 'object' || Array.isArray(f)) return null;
  const x = f as Record<string, unknown>;
  const w = fsrs7Weights(x.w);
  if (!w) return null;
  return { w, reviews: typeof x.reviews === 'number' && x.reviews >= 0 ? Math.floor(x.reviews) : 0, fitted: typeof x.fitted === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(x.fitted) ? x.fitted : '' };
}

/**
 * The reviews a line's memory is replayed from: from its last first review
 * (`st` new: the card's first, or its first after it was reset) on. Empty
 * when the log has none, which is a history that is not whole.
 */
export function wholeHistory(history: readonly Review[]): readonly Review[] {
  let from = -1;
  for (let i = history.length - 1; i >= 0; i--) if (history[i]!.st === 'new') { from = i; break; }
  return from < 0 ? [] : from === 0 ? history : history.slice(from);
}

/** How far the log's last review of a line may sit from the line's own `last` and still be that review (a grade given again is logged a second on). */
const SLACK = 5000;

/**
 * A card's reviews when the log has them whole: from its first review on
 * (`wholeHistory`), and up to the review its `sr` line was last written by
 * (a line reviewed since the log's last word on it has reviews the log
 * never saw). Empty otherwise: FSRS-7 has no word on the card.
 */
export function wholeFor(card: Pick<SchedCard, 'history' | 'fsrs'>): readonly Review[] {
  const history = wholeHistory(card.history);
  const last = history[history.length - 1];
  if (!last) return history;
  const line = card.fsrs?.last;
  return line !== undefined && Date.parse(last.at) < Date.parse(line) - SLACK ? [] : history;
}

/** A line's FSRS-7 memory after its reviews, each taken with the time since the one before in fractions of a day; null without a whole history. */
export function fsrs7State(algo: FSRS7Algorithm, history: readonly Review[], from: Fsrs7State | null = null, skip = 0): Fsrs7State | null {
  let state: FSRS7State | null = from;
  let at = from?.at ?? 0;
  for (let i = skip; i < history.length; i++) {
    const r = history[i]!;
    const t = Date.parse(r.at);
    state = algo.next_state(state, state ? Math.max(0, (t - at) / DAY) : 0, r.g);
    at = t;
  }
  return state ? { ...state, at } : null;
}

/** FSRS-7 over `weights()` (read each time it answers: a fit takes effect when the slot starts it again); null or nothing, the model's defaults. */
export function fsrs7Scheduler(weights: () => readonly number[] | null = () => null): Scheduler {
  let made: { w: readonly number[] | null; algo: FSRS7Algorithm } | null = null;
  // each line's memory as last replayed, with how much of its history that was
  let held = new Map<string, { n: number; first: string; state: Fsrs7State }>();
  const algo = (): FSRS7Algorithm => {
    const w = weights();
    if (!made || made.w !== w) {
      made = { w, algo: new FSRS7Algorithm(w ?? FSRS7_DEFAULT_WEIGHTS, FSRS7_MODEL_BOUNDS) };
      held = new Map();
    }
    return made.algo;
  };
  const stateOf = (card: SchedCard): Fsrs7State | null => {
    const a = algo();
    const history = wholeFor(card);
    if (!history.length) return null;
    const k = scoreKey(card.id, card.key);
    const was = held.get(k);
    // a review added since: on from where it stood
    const on = was && was.first === history[0]!.at && was.n <= history.length && Date.parse(history[was.n - 1]!.at) === was.state.at ? was : null;
    const state = on && on.n === history.length ? on.state : fsrs7State(a, history, on?.state ?? null, on?.n ?? 0);
    if (state) held.set(k, { n: history.length, first: history[0]!.at, state });
    return state;
  };
  const elapsed = (state: Fsrs7State, now: Date) => Math.max(0, (now.getTime() - state.at) / DAY);
  return {
    id: FSRS7_ID,
    name: 'fsrs-7',
    // the log changed some other way than by a review added: nothing held is sure to stand
    prepare: () => { held = new Map(); },
    recall: (cards, { now }) => {
      const a = algo();
      return cards.map((c) => {
        const s = stateOf(c);
        return s ? a.curve(elapsed(s, now), s).retrievability : null;
      });
    },
    curve: (card, days, { now }) => {
      const a = algo();
      const s = stateOf(card);
      if (!s) return days.map(() => 0);
      const t = elapsed(s, now);
      return days.map((d) => a.curve(t + d, s).retrievability);
    },
    preview: (card, { now }) => {
      const a = algo();
      const s = stateOf(card);
      if (!s) return null;
      const t = elapsed(s, now);
      const back = (g: Grade): Outcome => ({ due: new Date(now.getTime() + a.next_interval(a.next_state(s, t, g), card.retention) * DAY) });
      return { 1: back(1), 2: back(2), 3: back(3), 4: back(4) };
    },
  };
}

// ── fitting ──────────────────────────────────────────────────────

/** One grade as the optimiser is sent it: when, in seconds, and 1 to 4. */
export interface FitReview {
  t: number;
  g: Grade;
}

/**
 * The log as the optimiser is sent it: each line of a card with a whole
 * history as one card's reviews, oldest first; a line reset and learnt
 * again as one card each time; a line whose first review the log does not
 * have left out. In the one order every device has (by the line's key).
 */
export function fitCards(log: readonly Review[]): FitReview[][] {
  const lines = new Map<string, Review[]>();
  for (const r of log) {
    const k = scoreKey(r.card, r.key);
    const list = lines.get(k);
    if (list) list.push(r);
    else lines.set(k, [r]);
  }
  const out: FitReview[][] = [];
  for (const k of [...lines.keys()].sort()) {
    const list = lines.get(k)!.sort((a, b) => (a.at < b.at ? -1 : a.at > b.at ? 1 : 0));
    let run: FitReview[] | null = null;
    for (const r of list) {
      if (r.st === 'new') { if (run) out.push(run); run = []; }
      run?.push({ t: Date.parse(r.at) / 1000, g: r.g });
    }
    if (run) out.push(run);
  }
  return out;
}

/** How many items the optimiser has in them: every review after a card's first. */
export const fitItems = (cards: readonly (readonly FitReview[])[]): number => cards.reduce((n, c) => n + Math.max(0, c.length - 1), 0);

/** How many reviews are in them. */
export const fitReviews = (cards: readonly (readonly FitReview[])[]): number => cards.reduce((n, c) => n + c.length, 0);
