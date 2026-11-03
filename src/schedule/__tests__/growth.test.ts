// Milestone 51, the reading loop re-tuned: the cadence a source with
// reading left comes back on, growth from the time elapsed, the seeded
// Beta draw that orders a day, and the constants `design/sim/irsim.py`
// (the Python reference for the rules) shares with what ships.

import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { meta, parse, serialize } from '../../format/index.js';
import {
  KAPPA, POSTPONE_FACTOR, advanceRead, betaSample, cadence, cadenceWords, elapsedBase, gammaSample, grow, grownAt, hashSeed, mulberry32, postponed, readingLeft, sampleKey,
} from '../index.js';

const NOW = new Date('2026-11-03T12:00:00Z');
const CORPUS = join(import.meta.dirname, '../../format/__tests__/corpus');

describe('the cadence', () => {
  it('every day under 34, every other day to 66, every third day above', () => {
    expect([0, 10, 20, 33].map(cadence)).toEqual([1, 1, 1, 1]);
    expect([34, 50, 66].map(cadence)).toEqual([2, 2, 2]);
    expect([67, 80, 95, 100].map(cadence)).toEqual([3, 3, 3, 3]);
    expect([1, 2, 3].map(cadenceWords)).toEqual(['every day', 'every other day', 'every third day']);
  });

  it('the corpus source mid-read: a pass lands on its cadence and does not grow, its marker moved; postpone grows the stored interval', () => {
    const text = readFileSync(join(CORPUS, 'mangled/cadence.md'), 'utf8');
    const { doc, diagnostics } = parse(text);
    expect(diagnostics).toEqual([]);
    expect(meta(doc)).toMatchObject({ type: 'source', pri: 70, read: { due: '2026-11-03', ivl: 3, reps: 4, pos: 2 } });
    // at priority 70 the cadence is every third day; the interval was 3 and would have grown to 5
    expect(advanceRead(doc, 'on', NOW, 3)).toEqual({ due: '2026-11-06', ivl: 3, reps: 5, pos: 3 });
    expect(serialize(doc)).toContain('\nread: due=2026-11-06 ivl=3 reps=5 pos=3\n');
    // sixty days late it still lands on its cadence: the backlog does not stretch a source's return
    const late = parse(text).doc;
    expect(advanceRead(late, 'on', new Date('2027-01-02T12:00:00Z'), 3)).toEqual({ due: '2027-01-05', ivl: 3, reps: 5, pos: 3 });
    // read to its end, the last pass grows: the four prose blocks are read
    const done = parse(text).doc;
    expect(advanceRead(done, 'on', NOW, 4)).toEqual({ due: '2026-11-08', ivl: 5, reps: 5, pos: 4 });
    // later grows the stored interval by 1.2, at least a day
    const put = parse(text).doc;
    expect(advanceRead(put, 'postpone', NOW)).toEqual({ due: '2026-11-07', ivl: 4, reps: 4, pos: 2 });
  });

  it('what has reading left: a source short of its prose, any document with pages; never a note or an extract', () => {
    expect(readingLeft({ type: 'source' }, 2, 4)).toBe(true);
    expect(readingLeft({ type: 'source' }, 4, 4)).toBe(false);
    expect(readingLeft({ type: 'source' }, undefined, 4)).toBe(true);
    expect(readingLeft({ type: 'source', pdf: 'a.pdf' }, 400, 4)).toBe(true);
    expect(readingLeft({ type: 'note' }, 0, 4)).toBe(false);
    expect(readingLeft({ type: 'extract' }, 0, 4)).toBe(false);
  });
});

describe('growth from the time elapsed', () => {
  it('on time the base is the interval; late it is the days since the pass before', () => {
    expect(elapsedBase({ due: '2026-11-03', ivl: 3 }, NOW)).toBe(3);
    expect(elapsedBase({ due: '2026-11-02', ivl: 3 }, NOW)).toBe(4);
    expect(elapsedBase({ due: '2026-11-02', ivl: 3 }, new Date('2027-01-01T12:00:00Z'))).toBe(63);
    // early, or with nothing stored, the interval stands
    expect(elapsedBase({ due: '2026-11-10', ivl: 3 }, NOW)).toBe(3);
    expect(elapsedBase({ ivl: 3 }, NOW)).toBe(3);
    expect(elapsedBase({ due: '2026-11-03' }, NOW)).toBeUndefined();
    expect(elapsedBase({}, NOW)).toBeUndefined();
    // an instant due counts by its local day
    expect(elapsedBase({ due: '2026-11-02T08:00:00Z', ivl: 3 }, NOW)).toBe(4);
  });

  it('grows the base by the factor: sixty days late on ivl=3 lands at 101, not 5', () => {
    expect(grownAt({ due: '2026-11-03', ivl: 3 }, NOW, 1.6)).toBe(5);
    expect(grownAt({ due: '2026-11-02', ivl: 3 }, new Date('2027-01-01T12:00:00Z'), 1.6)).toBe(101);
    expect(grownAt({}, NOW, 1.6)).toBe(grow(undefined, 1.6));
  });
});

describe('the day\'s draw', () => {
  it('is seeded: the same key for the same seed, another for another seed or day', () => {
    expect(sampleKey('a.md\nh\n2026-11-03', 50)).toBe(sampleKey('a.md\nh\n2026-11-03', 50));
    expect(sampleKey('a.md\nh\n2026-11-03', 50)).not.toBe(sampleKey('a.md\nh\n2026-11-04', 50));
    expect(sampleKey('a.md\nh\n2026-11-03', 50)).not.toBe(sampleKey('b.md\nh\n2026-11-03', 50));
    expect(hashSeed('x')).toBe(hashSeed('x'));
    expect(hashSeed('x')).not.toBe(hashSeed('y'));
  });

  it('sits around the priority with the pseudo-count of 20: ±11 at 50, ±5 at 95, clamped at the ends', () => {
    const draws = (pri: number, n = 4000) => Array.from({ length: n }, (_, i) => sampleKey(`seed ${i}`, pri));
    const mean = (xs: number[]) => xs.reduce((a, b) => a + b, 0) / xs.length;
    const sd = (xs: number[]) => { const m = mean(xs); return Math.sqrt(mean(xs.map((x) => (x - m) ** 2))); };
    expect(KAPPA).toBe(20);
    const at50 = draws(50);
    expect(Math.abs(mean(at50) - 0.5)).toBeLessThan(0.01);
    expect(Math.abs(sd(at50) - Math.sqrt(0.25 / (KAPPA + 1)))).toBeLessThan(0.01);
    const at95 = draws(95);
    expect(Math.abs(mean(at95) - 0.95)).toBeLessThan(0.01);
    expect(Math.abs(sd(at95) - Math.sqrt((0.95 * 0.05) / (KAPPA + 1)))).toBeLessThan(0.01);
    // 0 and 100 are clamped to .01 and .99, so every draw is a number in [0, 1] (the ends only by rounding)
    for (const k of [...draws(0, 500), ...draws(100, 500)]) { expect(k).toBeGreaterThanOrEqual(0); expect(k).toBeLessThanOrEqual(1); }
    expect(mean(draws(0))).toBeLessThan(0.03);
    expect(mean(draws(100))).toBeGreaterThan(0.97);
    // a 10 sits well below a 90
    expect(Math.max(...draws(10, 500))).toBeLessThan(Math.min(...draws(90, 500)));
  });

  it('the samplers: mulberry32 in (0, 1), a gamma\'s mean its shape (shapes under one through the boost), a beta in (0, 1)', () => {
    const rand = mulberry32(7);
    const us = Array.from({ length: 1000 }, () => rand());
    expect(us.every((u) => u > 0 && u < 1)).toBe(true);
    expect(Math.abs(us.reduce((a, b) => a + b, 0) / us.length - 0.5)).toBeLessThan(0.05);
    for (const shape of [0.2, 0.5, 1, 2, 9]) {
      const r = mulberry32(shape * 1000);
      const xs = Array.from({ length: 4000 }, () => gammaSample(shape, r));
      expect(Math.abs(xs.reduce((a, b) => a + b, 0) / xs.length - shape) / shape, `shape ${shape}`).toBeLessThan(0.08);
    }
    const r = mulberry32(3);
    for (let i = 0; i < 200; i++) { const b = betaSample(2, 18, r); expect(b).toBeGreaterThan(0); expect(b).toBeLessThan(1); }
  });
});

describe('the backlog', () => {
  it('holds a source with reading left over to tomorrow, its cadence kept; the person\'s postpone still grows it', () => {
    const src = () => parse('---\ntype: source\nread: due=2026-10-20 ivl=3 reps=2 pos=4\n---\n\na\n\nb\n\nc\n\nd\n\ne\n\nf\n').doc;
    expect(advanceRead(src(), 'backlog', NOW)).toEqual({ due: '2026-11-04', ivl: 3, reps: 2, pos: 4 });
    expect(advanceRead(src(), 'postpone', NOW)).toEqual({ due: '2026-11-07', ivl: 4, reps: 2, pos: 4 });
  });
  it('postpones a note revisited either way', () => {
    const note = () => parse('---\nread: due=2026-10-20 ivl=10 reps=2\n---\n\na\n').doc;
    expect(advanceRead(note(), 'backlog', NOW)).toEqual({ due: '2026-11-15', ivl: 12, reps: 2 });
    expect(advanceRead(note(), 'postpone', NOW)).toEqual({ due: '2026-11-15', ivl: 12, reps: 2 });
  });
});

describe('the Python reference', () => {
  it('design/sim/irsim.py keeps the constants that ship: the growth, the postpone factor, the pseudo-count and the cadence', () => {
    const py = readFileSync(join(import.meta.dirname, '../../../design/sim/irsim.py'), 'utf8');
    expect(py).toMatch(/^AF = 1\.6$/m);
    expect(py).toMatch(/^POSTPONE = 1\.2$/m);
    expect(py).toMatch(new RegExp(`^KAPPA = ${KAPPA}\\b`, 'm'));
    expect(POSTPONE_FACTOR).toBe(1.2);
    expect(py).toContain('return 1 + min(2, int(3 * pri / 100))');
    expect(py).toContain('return max(round(ivl * POSTPONE), ivl + 1)');
    expect(py).toContain('base = max(it.ivl, day - it.last) if v.elapsed else it.ivl');
    expect(py).toContain('it.due = day + 1          # held over');
    // the same rule in both: grow, postpone, and the cadence over the whole scale
    for (let pri = 0; pri <= 100; pri++) expect(cadence(pri)).toBe(1 + Math.min(2, Math.trunc((3 * pri) / 100)));
    for (const ivl of [1, 2, 3, 5, 8, 13, 30]) {
      expect(grow(ivl, 1.6)).toBe(Math.max(1, Math.round(ivl * 1.6)));
      expect(postponed(ivl)).toBe(Math.max(Math.round(ivl * 1.2), ivl + 1));
    }
  });
});
