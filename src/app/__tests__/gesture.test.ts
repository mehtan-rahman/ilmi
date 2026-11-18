import { describe, expect, it } from 'vitest';
import { EDGE, FLING, PULL, ROW_COMMIT, SETTLE_MAX, SETTLE_MIN, SLOP, axisOf, edgeMeans, pullArmed, rowAt, rowCommits, rowEnds, rubber, settleEase, settleMs, settlesOpen, velocityOf } from '../gesture.js';

describe('a touch becomes a drag', () => {
  it('rests inside its slop', () => {
    expect(axisOf(0, 0)).toBeNull();
    expect(axisOf(SLOP - 1, SLOP - 1)).toBeNull();
    expect(axisOf(-(SLOP - 1), 3)).toBeNull();
  });
  it('is sideways only when plainly so', () => {
    expect(axisOf(SLOP, 0)).toBe('x');
    expect(axisOf(-30, 10)).toBe('x');
    // a diagonal is the list's scroll, not a swipe
    expect(axisOf(20, 20)).toBe('y');
    expect(axisOf(12, 11)).toBe('y');
    expect(axisOf(2, SLOP)).toBe('y');
    expect(axisOf(-3, -40)).toBe('y');
  });
  it('the edge is a finger wide at most', () => {
    expect(EDGE).toBeGreaterThanOrEqual(16);
    expect(EDGE).toBeLessThanOrEqual(32);
  });
});

describe('the speed a finger lets go at', () => {
  it('is over the last samples only', () => {
    const s = [{ t: 0, at: 0 }, { t: 100, at: 10 }, { t: 116, at: 26 }, { t: 132, at: 42 }];
    expect(velocityOf(s, 132)).toBeCloseTo(1, 5);
  });
  it('is none for a finger that rested before it lifted', () => {
    const s = [{ t: 0, at: 0 }, { t: 16, at: 40 }, { t: 32, at: 80 }];
    expect(velocityOf(s, 400)).toBe(0);
    expect(velocityOf([{ t: 0, at: 5 }], 0)).toBe(0);
    expect(velocityOf([], 0)).toBe(0);
  });
  it('is signed', () => {
    expect(velocityOf([{ t: 0, at: 100 }, { t: 20, at: 80 }], 20)).toBe(-1);
  });
});

describe('what is let go settles', () => {
  it('by where it is when it is slow', () => {
    expect(settlesOpen(0.6, 0)).toBe(true);
    expect(settlesOpen(0.5, 0)).toBe(true);
    expect(settlesOpen(0.4, 0)).toBe(false);
    expect(settlesOpen(0.4, FLING * 0.9)).toBe(false);
    expect(settlesOpen(0.6, -FLING * 0.9)).toBe(true);
  });
  it('by its direction when it is flung', () => {
    expect(settlesOpen(0.1, FLING * 1.1)).toBe(true);
    expect(settlesOpen(0.9, -FLING * 1.1)).toBe(false);
  });
  it('in a time within its bounds, shorter the faster it was going', () => {
    expect(settleMs(0, 0)).toBe(0);
    expect(settleMs(0.5, 3)).toBe(0);
    expect(settleMs(20, 0)).toBe(SETTLE_MIN);
    expect(settleMs(-390, 0)).toBe(SETTLE_MAX);
    expect(settleMs(300, 0.3)).toBe(SETTLE_MAX);
    const slow = settleMs(200, 1);
    const fast = settleMs(200, 2.5);
    expect(fast).toBeLessThan(slow);
    expect(fast).toBeGreaterThanOrEqual(SETTLE_MIN);
    // leftward as well as rightward
    expect(settleMs(-200, -1)).toBe(slow);
  });
  it('leaving at the speed it was let go at', () => {
    // from rest: a curve that starts flat
    expect(settleEase(100, 0, 200)).toBe('cubic-bezier(0.25, 0.000, 0.2, 1)');
    // against where it is going: from rest too
    expect(settleEase(100, -1, 200)).toBe('cubic-bezier(0.25, 0.000, 0.2, 1)');
    // 100 px in 200 ms let go at 1 px/ms: twice the mean speed at the start
    expect(settleEase(100, 1, 200)).toBe('cubic-bezier(0.25, 0.500, 0.2, 1)');
    expect(settleEase(-100, -1, 200)).toBe('cubic-bezier(0.25, 0.500, 0.2, 1)');
    // never more than three times it
    expect(settleEase(10, 5, 200)).toBe('cubic-bezier(0.25, 0.750, 0.2, 1)');
    expect(settleEase(0, 1, 0)).toBe('cubic-bezier(0.25, 0.000, 0.2, 1)');
  });
});

describe('a pull past the end', () => {
  it('follows less and less and never passes its limit', () => {
    expect(rubber(0, 24)).toBe(0);
    expect(rubber(-5, 24)).toBe(0);
    const a = rubber(10, 24);
    const b = rubber(20, 24);
    expect(a).toBeGreaterThan(0);
    expect(a).toBeLessThan(10);
    expect(b - a).toBeLessThan(a);
    expect(rubber(10_000, 24)).toBeLessThan(24);
  });
});

describe('a row swiped', () => {
  const W = 370;
  const ACTS = 184;
  it('goes left with the finger and hardly at all right of its rest', () => {
    expect(rowAt(0, -80)).toBe(-80);
    expect(rowAt(-184, -40)).toBe(-224);
    expect(rowAt(-184, 100)).toBe(-84);
    expect(rowAt(0, 0)).toBe(0);
    expect(rowAt(0, 200)).toBeLessThan(24);
    expect(rowAt(0, 200)).toBeGreaterThan(0);
  });
  it('acts when it is most of the way across', () => {
    expect(rowCommits(-W * ROW_COMMIT, W)).toBe(true);
    expect(rowCommits(-W * ROW_COMMIT + 1, W)).toBe(false);
    expect(rowCommits(-300, 0)).toBe(false);
    expect(rowEnds(-W * 0.7, 0, W, ACTS)).toBe('act');
    // however it was moving when it was let go there
    expect(rowEnds(-W * 0.7, 2, W, ACTS)).toBe('act');
  });
  it('else rests open on its actions or shuts, by where it is and how fast', () => {
    expect(rowEnds(-ACTS / 2, 0, W, ACTS)).toBe('open');
    expect(rowEnds(-ACTS / 2 + 1, 0, W, ACTS)).toBe('shut');
    expect(rowEnds(-20, -FLING * 1.5, W, ACTS)).toBe('open');
    expect(rowEnds(-170, FLING * 1.5, W, ACTS)).toBe('shut');
    expect(rowEnds(0, 0, W, ACTS)).toBe('shut');
  });
});

describe('a list pulled down', () => {
  it('is armed at its threshold', () => {
    expect(pullArmed(PULL - 1)).toBe(false);
    expect(pullArmed(PULL)).toBe(true);
    expect(pullArmed(0)).toBe(false);
    expect(pullArmed(-10)).toBe(false);
  });
});

describe('the left edge', () => {
  it('goes back from a phone\'s page opened from the day', () => {
    expect(edgeMeans(true, true, false)).toBe('back');
  });
  it('brings the sidebar in on the day, on a page opened from the tree, and on an iPad', () => {
    expect(edgeMeans(true, false, false)).toBe('sheet');
    expect(edgeMeans(true, true, true)).toBe('sheet');
    expect(edgeMeans(false, true, false)).toBe('sheet');
    expect(edgeMeans(false, false, false)).toBe('sheet');
  });
});
