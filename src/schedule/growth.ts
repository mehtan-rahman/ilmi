// Growth: how a reading or writing interval moves. SuperMemo's A-factor,
// kept on the `read` / `write` line as `af` (FORMAT.md §3). A pass
// multiplies the interval by it; a postpone multiplies by a smaller
// factor, and always lands later than the interval did. Since milestone 51
// a pass grows from the time elapsed, not the stored interval, a source
// with reading left comes back on a cadence set by its priority, and the
// day's order is a draw seeded by the item and the day. The Python
// reference for the rules is `design/sim/irsim.py`; its constants are these.

import { addDays, dayOf, dayStart, whenToDate } from './dates.js';

/** What `postpone` multiplies by when nothing says otherwise. */
export const POSTPONE_FACTOR = 1.2;

/** The interval after one pass: `ivl × af`, rounded, at least one day. */
export function grow(ivl: number | undefined, af: number): number {
  return Math.max(1, Math.round((ivl ?? 1) * af));
}

/**
 * What a pass grows from: the stored interval, or the days since the pass
 * before (the line's due less its interval), whichever is longer. On time
 * the two are the same; sixty days late on `ivl=3` grows from 63, not 3.
 */
export function elapsedBase(r: { ivl?: number; due?: string }, now: Date): number | undefined {
  if (r.due === undefined || r.ivl === undefined) return r.ivl;
  const before = addDays(dayOf(whenToDate(r.due)), -r.ivl);
  const days = Math.round((dayStart(dayOf(now)).getTime() - dayStart(before).getTime()) / 86_400_000);
  return Math.max(r.ivl, days);
}

/** The interval after one pass at `now`, grown from the elapsed time (`elapsedBase`). */
export const grownAt = (r: { ivl?: number; due?: string; af?: number }, now: Date, af: number): number => grow(elapsedBase(r, now), af);

/** The next `n` intervals from here, for a preview. */
export function nextIntervals(ivl: number | undefined, af: number, n = 3): number[] {
  const out: number[] = [];
  let cur = ivl;
  for (let i = 0; i < n; i++) { cur = grow(cur, af); out.push(cur); }
  return out;
}

/** The interval after a postpone: `ivl × factor`, rounded, and at least a day more than it was. */
export function postponed(ivl: number | undefined, factor = POSTPONE_FACTOR): number {
  const cur = ivl ?? 1;
  return Math.max(Math.round(cur * factor), cur + 1);
}

// ── the cadence ──────────────────────────────────────────────────

/**
 * How often a source with reading left comes back, in days, by its
 * priority: every day under 34, every other day to 66, every third day
 * above. A pass on such a source lands here and does not grow.
 */
export const cadence = (pri: number): number => 1 + Math.min(2, Math.floor((3 * pri) / 100));

/** The cadence in words, for a row: `every day`, `every other day`, `every third day`. */
export const cadenceWords = (days: number): string => (days <= 1 ? 'every day' : days === 2 ? 'every other day' : 'every third day');

// ── the day's draw ───────────────────────────────────────────────

/** The Beta sampler's pseudo-count: how tightly a draw sits around `pri/100`. ±11 points at 50, ±5 at 95. */
export const KAPPA = 20;

/** A 32-bit hash of a string (FNV-1a), the seed of a draw. */
export function hashSeed(s: string): number {
  let h = 0x811c9dc5;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 0x01000193);
  }
  return h >>> 0;
}

/** mulberry32: a small seeded generator of uniforms in (0, 1). */
export function mulberry32(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    const u = ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    // never exactly zero: the samplers take logs and roots of it
    return u === 0 ? 1e-12 : u;
  };
}

/** One standard normal from two uniforms (Box–Muller). */
function normal(rand: () => number): number {
  return Math.sqrt(-2 * Math.log(rand())) * Math.cos(2 * Math.PI * rand());
}

/** A Gamma(shape, 1) draw by Marsaglia and Tsang; a shape under one goes through shape + 1 and a uniform's root. */
export function gammaSample(shape: number, rand: () => number): number {
  if (shape < 1) return gammaSample(shape + 1, rand) * Math.pow(rand(), 1 / shape);
  const d = shape - 1 / 3;
  const c = 1 / Math.sqrt(9 * d);
  for (;;) {
    let x: number;
    let v: number;
    do { x = normal(rand); v = 1 + c * x; } while (v <= 0);
    v = v * v * v;
    const u = rand();
    if (u < 1 - 0.0331 * x * x * x * x) return d * v;
    if (Math.log(u) < 0.5 * x * x + d * (1 - v + Math.log(v))) return d * v;
  }
}

/** A Beta(a, b) draw: two gammas. */
export function betaSample(a: number, b: number, rand: () => number): number {
  const x = gammaSample(a, rand);
  const y = gammaSample(b, rand);
  return x / (x + y);
}

/**
 * The day's key of a due item: a Beta draw with mean `pri/100` (clamped
 * .01–.99) and pseudo-count `KAPPA`, seeded by `seed` (the item and the
 * day). Lower comes first. Stable within a day, reshuffled across days.
 */
export function sampleKey(seed: string, pri: number): number {
  const m = Math.min(0.99, Math.max(0.01, pri / 100));
  return betaSample(KAPPA * m, KAPPA * (1 - m), mulberry32(hashSeed(seed)));
}
