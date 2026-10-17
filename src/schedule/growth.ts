// Growth: how a reading or writing interval moves. SuperMemo's A-factor,
// kept on the `read` / `write` line as `af` (FORMAT.md §3). A pass
// multiplies the interval by it; a postpone multiplies by a smaller
// factor, and always lands later than the interval did.

/** What `postpone` multiplies by when nothing says otherwise. */
export const POSTPONE_FACTOR = 1.2;

/** The interval after one pass: `ivl × af`, rounded, at least one day. */
export function grow(ivl: number | undefined, af: number): number {
  return Math.max(1, Math.round((ivl ?? 1) * af));
}

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
