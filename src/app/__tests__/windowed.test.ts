// The window's model (windowed.ts): heights measured and estimated, the
// rows to draw for a view, when a window still does, the scroll held on the
// row under the top of the view as estimates are corrected, and where the
// view goes to bring a row in. No DOM.

import { describe, expect, it } from 'vitest';
import { Heights, MAX_DRAWN, ROW_GUESS, WHOLE, anchorAt, clampWin, holds, topFor, topOf, windowOf } from '../windowed.js';

describe('heights', () => {
  it('stand at the guess until rows are measured, then, once settled, at their average', () => {
    const h = new Heights(1000);
    expect([h.estimate, h.total, h.offset(10), h.measured]).toEqual([ROW_GUESS, 1000 * ROW_GUESS, 10 * ROW_GUESS, 0]);
    expect(h.settle()).toBe(false);
    expect(h.set(0, 40)).toBe(true);
    expect(h.set(1, 80)).toBe(true);
    // the estimate stays until it is settled: a measurement moves only its own row
    expect([h.estimate, h.average, h.total]).toEqual([ROW_GUESS, 60, 40 + 80 + 998 * ROW_GUESS]);
    expect(h.settle()).toBe(true);
    expect(h.settle()).toBe(false);
    expect(h.estimate).toBe(60);
    // two measured, 998 at the average
    expect(h.total).toBe(40 + 80 + 998 * 60);
    expect([h.offset(0), h.offset(1), h.offset(2), h.offset(3)]).toEqual([0, 40, 120, 180]);
    expect([h.height(0), h.height(1), h.height(2)]).toEqual([40, 80, 60]);
  });

  it('a measurement of nothing (a row not laid out) or of the same height changes nothing', () => {
    const h = new Heights(10);
    expect([h.set(3, 0), h.set(3, -1), h.set(3, Number.NaN), h.set(99, 40), h.set(-1, 40)]).toEqual([false, false, false, false, false]);
    expect(h.measured).toBe(0);
    expect(h.set(3, 50)).toBe(true);
    expect(h.set(3, 50.2)).toBe(false);
    expect(h.set(3, 70)).toBe(true);
    expect([h.measured, h.average]).toEqual([1, 70]);
  });

  it('finds the row at an offset, clamped to the list', () => {
    const h = new Heights(5);
    [10, 20, 30, 40, 50].forEach((px, i) => h.set(i, px));
    expect([-5, 0, 9.9, 10, 29, 30, 59, 60, 149, 150, 9999].map((y) => h.indexAt(y))).toEqual([0, 0, 0, 1, 1, 2, 2, 3, 4, 4, 4]);
    expect(new Heights(0).indexAt(10)).toBe(0);
    expect(new Heights(0).total).toBe(0);
  });

  it('is made again from heights known before, and lets them all go keeping the average', () => {
    const known = new Map([[2, 100], [4, 50]]);
    const h = new Heights(6, 30, (i) => known.get(i));
    expect([h.measured, h.estimate, h.offset(3)]).toEqual([2, 75, 75 + 75 + 100]);
    h.clear();
    expect([h.measured, h.estimate, h.total]).toEqual([0, 75, 6 * 75]);
    expect(new Heights(3, 0).estimate).toBe(ROW_GUESS);
  });
});

describe('the window', () => {
  const even = (count: number, px = 50) => { const h = new Heights(count, px); return h; };

  it('a short list is drawn whole', () => {
    const h = even(WHOLE);
    expect(windowOf(h, 5000, 600)).toEqual({ start: 0, end: WHOLE });
    expect(holds(h, { start: 0, end: WHOLE }, 99999, 600)).toBe(true);
    expect(holds(h, { start: 0, end: 50 }, 0, 600)).toBe(false);
    expect(clampWin(h, { start: 10, end: 20 })).toEqual({ start: 0, end: WHOLE });
  });

  it('holds the rows in view and a screen each side', () => {
    const h = even(100_000);
    // rows 200..211 in view, 12 more each side
    expect(windowOf(h, 10_000, 600)).toEqual({ start: 188, end: 225 });
    // at the top nothing above; above the list (its head still in view) the same rows
    expect(windowOf(h, 0, 600)).toEqual({ start: 0, end: 25 });
    expect(windowOf(h, -300, 600)).toEqual({ start: 0, end: 19 });
    // at the foot the window stays three screens deep
    const end = windowOf(h, h.total - 600, 600);
    expect(end).toEqual({ start: 100_000 - 36, end: 100_000 });
    // past the foot (a list that shrank under the view)
    expect(windowOf(h, h.total + 5000, 600).end).toBe(100_000);
  });

  it('never holds more than the cap, and keeps the view in what it holds', () => {
    const h = even(100_000, 1);
    const w = windowOf(h, 50_000, 900);
    expect(w.end - w.start).toBe(MAX_DRAWN);
    expect(w.start).toBeLessThanOrEqual(50_000);
    expect(w.end).toBeGreaterThan(50_000);
  });

  it('is kept while the view moves inside its overscan, and made again near its edge', () => {
    const h = even(100_000);
    const w = windowOf(h, 10_000, 600);
    expect(holds(h, w, 10_000, 600)).toBe(true);
    expect(holds(h, w, 10_250, 600)).toBe(true);
    expect(holds(h, w, 9_750, 600)).toBe(true);
    // half a screen of margin left on neither side
    expect(holds(h, w, 10_400, 600)).toBe(false);
    expect(holds(h, w, 9_600, 600)).toBe(false);
    // the list's own ends are edge enough
    expect(holds(h, windowOf(h, 0, 600), 0, 600)).toBe(true);
    expect(holds(h, windowOf(h, h.total - 600, 600), h.total - 600, 600)).toBe(true);
    // a window from a longer list
    expect(holds(even(300), { start: 250, end: 320 }, 12_000, 600)).toBe(false);
    expect(clampWin(even(300), { start: 250, end: 320 })).toEqual({ start: 250, end: 300 });
    expect(clampWin(even(300), { start: 400, end: 450 })).toEqual({ start: 300, end: 300 });
  });

  it('every view down a list of uneven rows is inside its window', () => {
    const h = new Heights(5000);
    for (let i = 0; i < 5000; i += 3) h.set(i, 30 + (i % 7) * 25);
    for (let top = -400; top < h.total; top += 777) {
      const w = windowOf(h, top, 700);
      expect(h.offset(w.start)).toBeLessThanOrEqual(Math.max(0, top));
      expect(h.offset(w.end)).toBeGreaterThanOrEqual(Math.min(h.total, top + 700));
      expect(w.end - w.start).toBeLessThanOrEqual(MAX_DRAWN);
      expect(holds(h, w, top, 700)).toBe(true);
    }
  });
});

describe('the scroll, held', () => {
  it('the row under the top of the view stays there when rows above it are measured taller', () => {
    const h = new Heights(10_000, 50);
    const top = 5_025;
    const a = anchorAt(h, top)!;
    expect(a).toEqual({ index: 100, into: 25 });
    // ten rows above the view come out twice the estimate; one below it too
    for (let i = 80; i < 90; i++) h.set(i, 100);
    h.set(120, 100);
    // the view goes down by what the rows above grew, and no more: the unmeasured stay where they were
    expect(topOf(h, a)).toBe(top + 500);
    expect(anchorAt(h, top + 500)).toEqual({ index: 100, into: 25 });
    // the estimate settled on the average: every unmeasured row above shifts, and the row is still held
    expect(h.settle()).toBe(true);
    const next = topOf(h, a);
    expect(next - h.offset(100)).toBe(25);
    expect(next).toBeGreaterThan(top + 500);
    expect(anchorAt(h, next)).toEqual({ index: 100, into: 25 });
  });

  it('no row to hold above the list; a row that shrank holds the view at its foot', () => {
    const h = new Heights(1000, 50);
    expect(anchorAt(h, 0)).toBeNull();
    expect(anchorAt(h, -40)).toBeNull();
    expect(anchorAt(new Heights(0), 100)).toBeNull();
    const a = anchorAt(h, 5_040)!;
    h.set(100, 20);
    expect(topOf(h, a) - h.offset(100)).toBe(20);
    // a list that lost rows under the anchor
    expect(topOf(new Heights(10, 50), { index: 500, into: 10 })).toBe(9 * 50 + 10);
  });

  it('brings a row in by the least move, or to the middle', () => {
    const h = new Heights(1000, 50);
    // in view already: no move
    expect(topFor(h, 105, 5_000, 600, 'nearest')).toBe(5_000);
    // above: its top to the view's top; below: its foot to the view's foot
    expect(topFor(h, 40, 5_000, 600, 'nearest')).toBe(2_000);
    expect(topFor(h, 300, 5_000, 600, 'nearest')).toBe(15_050 - 600);
    // half in view at the foot
    expect(topFor(h, 111, 5_000, 600, 'nearest')).toBe(5_600 - 600);
    expect(topFor(h, 300, 5_000, 600, 'center')).toBe(15_025 - 300);
  });
});
