// Milestone 42: a lens's numbers from its sr lines and the review log, the
// log written append-only and read back the way sync leaves it, and a grade
// made into its log line.

import { promises as fsp } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';
import { parse, type CardSchedule, type Doc, type Review } from '../../format/index.js';
import { OPTION_DEFAULTS, addDays, dayOf, type Resolved } from '../../schedule/index.js';
import { Vault, type Fs } from '../../vault/index.js';
import { nodeFs } from '../../vault/node-fs.js';
import { REVIEW_MS_CAP, reviewOf } from '../grading.js';
import { FORECAST_WEEKS, HEAT_WEEKS, dayLabel, daysOf, heatOf, linesDue, linesOf, mondayOf, numbersOf, rateLabel, reviewsOn, reviewsUnder, spanLabel, summaryOf, weekLabel } from '../numbers.js';
import { readCount, readDayWords, readingDaysOf, readingNumbersOf, readingsOn, readingsUnder } from '../numbers.js';
import type { Reading } from '../../format/index.js';

const at = (day: string, hour = 12) => new Date(`${day}T${String(hour).padStart(2, '0')}:00:00`);
const NOW = at('2026-10-30');
const iso = (day: string, hour = 9) => at(day, hour).toISOString().replace(/\.\d{3}Z$/, 'Z');
const opts = (over: Partial<Resolved['opts']> = {}) => (): Resolved => ({ opts: { ...OPTION_DEFAULTS, ...over }, from: {} });

const DECK = `---
type: deck
---

a ::: b ^ab
<!-- sr due=2026-10-30 st=review s=12 d=4 r=6 l=1 ivl=12 last=2026-10-18T09:00:00Z g=3 -->

c :: d ^cd
<!-- sr due=2026-11-04 st=review s=40 d=7 r=9 l=5 ivl=40 last=2026-09-25T09:00:00Z g=3 -->

{{c1::e}} and {{c2::f}} ^ef
<!-- sr c1 due=2026-10-20 st=review s=3 d=8 r=4 l=2 ivl=3 last=2026-10-17T09:00:00Z g=1 -->
<!-- sr c2 due=2026-11-02 st=review s=6 d=6 r=2 l=0 ivl=6 last=2026-10-27T09:00:00Z g=3 -->

g :: h ^gh
<!-- sr due=2026-11-01 st=review s=9 d=5 r=8 l=8 ivl=9 last=2026-10-23T09:00:00Z g=3 sus=1 -->

new :: card
`;

const R = (day: string, card: string, g: Review['g'], st: Review['st'] = 'review', over: Partial<Review> = {}): Review =>
  ({ at: iso(day), doc: 'deck.md', card, g, st, elapsed: 3, ivl: 3, next: 5, ms: 6000, ...over });

describe('the numbers', () => {
  const doc = parse(DECK).doc;
  const lines = linesOf([['deck.md', doc]]);

  it('one line per schedule a review would rewrite: the reverse its own, each blank its own', () => {
    expect(lines.map((l) => `${l.card.id}${l.key ? ` ${l.key}` : ''}`)).toEqual(['ab', 'ab r', 'cd', 'ef c1', 'ef c2', 'gh', 'undefined']);
    expect(lines.filter((l) => l.suspended).map((l) => l.card.id)).toEqual(['gh']);
  });

  it('reviews a day for the past weeks from the log, nothing known before it began; coming due from the lines', () => {
    const log = [R('2026-10-27', 'ab', 3), R('2026-10-27', 'cd', 1), R('2026-10-29', 'ab', 3), R('2026-10-30', 'ef', 3)];
    const n = numbersOf(lines, log, NOW, opts(), '2026-10-12');
    expect(n.past.map((w) => w.start)).toEqual(['2026-10-05', '2026-10-12', '2026-10-19', '2026-10-26']);
    // before the log's first day a day is unknown, after today not yet
    expect(n.past[0]!.days.every((d) => d === null)).toBe(true);
    expect(n.past[1]!.days).toEqual([0, 0, 0, 0, 0, 0, 0]);
    expect(n.past[3]!.days).toEqual([0, 2, 0, 1, 1, null, null]);
    expect(n.past[3]!.total).toBe(4);
    // overdue counts today (c1 due 10-20, ab due today); the suspended card and the new one not at all
    expect(n.ahead[0]!.days).toEqual([null, null, null, null, 2, 0, 0]);
    expect(n.ahead[1]!.days.slice(0, 3)).toEqual([1, 0, 1]);
    expect(n.today).toEqual({ day: '2026-10-30', weekday: 4 });
    // cards, not lines: ab is seen (its forward) though its reverse is not, so one card never seen, the new one
    expect([n.cards, n.fresh, n.suspended]).toEqual([5, 1, 1]);
    expect(n.since).toBe('2026-10-12');
  });

  it('true retention: passed over due reviews of cards in review, by week and by how long the card has been studied', () => {
    const log = [
      R('2026-06-01', 'ab', 3, 'new'), R('2026-06-02', 'ab', 3, 'learning'),
      R('2026-10-20', 'ab', 3), R('2026-10-21', 'cd', 1), R('2026-10-27', 'ab', 3), R('2026-10-28', 'cd', 3), R('2026-10-29', 'ef', 1, 'relearning'),
      R('2026-10-28', 'ef', 3, 'new', { key: 'c2' }), R('2026-10-29', 'ef', 2, 'review', { key: 'c2' }),
    ];
    const n = numbersOf(lines, log, NOW, opts(), '2026-06-01');
    const last = n.byWeek.slice(-2);
    expect(last.map((w) => [w.label, w.passed, w.due])).toEqual([['2026-10-19', 1, 2], ['2026-10-26', 3, 3]]);
    expect(rateLabel(last[0]!)).toBe('50%');
    expect(rateLabel({ label: '', passed: 0, due: 0 })).toBe('–');
    // ab and cd: first seen 06-01 (cd only through ab? no: cd's own first is 10-21), so ab's are six months on, cd's and c2's the first month
    expect(n.byAge.map((a) => [a.label, a.passed, a.due])).toEqual([['first month', 2, 3], ['three to six months', 2, 2]]);
  });

  it('failed most: lapses from half the threshold up, the most first, a leech at it, each with its card', () => {
    const n = numbersOf(lines, [], NOW, opts({ leech: 6 }));
    expect(n.leeches.map((l) => [l.id, l.key ?? '', l.lapses, l.leech, l.suspended])).toEqual([['gh', '', 8, true, true], ['cd', '', 5, false, false]]);
    expect(n.leeches[0]!.block).toBe(doc.blocks.findIndex((b) => b.kind === 'card' && b.id === 'gh'));
    // the default threshold, 8: only half of it and up
    expect(numbersOf(lines, [], NOW, opts()).leeches.map((l) => l.id)).toEqual(['gh', 'cd']);
    expect(numbersOf(lines, [], NOW, opts({ leech: 12 })).leeches.map((l) => l.id)).toEqual(['gh']);
  });

  it('the spread of stability and difficulty over live graded lines; time a review when the log has it', () => {
    const n = numbersOf(lines, [R('2026-10-29', 'ab', 3, 'review', { ms: 4000 }), R('2026-10-29', 'cd', 3, 'review', { ms: 9000 }), R('2026-10-30', 'ef', 3)], NOW, opts(), '2026-10-01');
    expect(n.stability!.n).toBe(4);
    expect(n.stability!.at[2]).toBe(9);
    expect(n.difficulty!.at.map((x) => Math.round(x * 10) / 10)).toEqual([4.6, 5.5, 6.5, 7.3, 7.7]);
    expect(n.time).toEqual({ median: 6000, total: 19000, n: 3 });
    expect([spanLabel(6400), spanLabel(19 * 60_000), spanLabel(3.2 * 3_600_000)]).toEqual(['6 s', '19 min', '3.2 h']);
    // without a log: no history, the lines' numbers all the same
    const bare = numbersOf(lines, [], NOW, opts());
    expect([bare.since, bare.time, bare.past[3]!.days.every((d) => d === null)]).toEqual([undefined, null, true]);
    expect(bare.ahead[0]!.days[4]).toBe(2);
  });

  it('the lens\'s reviews: by its documents, or by a card id of its whose document is gone (moved with its file)', () => {
    const log = [R('2026-10-29', 'ab', 3), { ...R('2026-10-29', 'cd', 3), doc: 'old/deck.md' }, { ...R('2026-10-29', 'zz', 3), doc: 'other.md' }, { ...R('2026-10-29', 'ab', 3), doc: 'other.md' }];
    expect(reviewsUnder(log, lines, new Set(['deck.md', 'other.md'])).map((r) => `${r.doc} ${r.card}`)).toEqual(['deck.md ab', 'old/deck.md cd']);
  });

  it('weeks start on Monday and read as a month and day', () => {
    expect(mondayOf('2026-10-30')).toBe('2026-10-26');
    expect(mondayOf('2026-10-26')).toBe('2026-10-26');
    expect(mondayOf('2026-11-01')).toBe('2026-10-26');
    expect(weekLabel('2026-10-05')).toBe('oct 5');
  });
});

describe('the year of days', () => {
  const doc = parse(DECK).doc;
  const lines = linesOf([['deck.md', doc]]);
  const log = [
    R('2026-06-01', 'ab', 3, 'new', { ivl: 0, next: 0 }), R('2026-06-02', 'ab', 3, 'learning', { ivl: 0, next: 2 }),
    R('2026-10-20', 'ab', 3, 'review', { ivl: 12, next: 30 }), R('2026-10-21', 'cd', 1),
    R('2026-10-27', 'ab', 3), R('2026-10-27', 'cd', 2), R('2026-10-27', 'ef', 4, 'review', { key: 'c2', ms: 2000 }),
    R('2026-10-28', 'cd', 3), R('2026-10-29', 'ef', 1, 'relearning'), R('2026-10-30', 'ab', 3),
  ].sort((a, b) => (a.at < b.at ? -1 : 1));

  it('the log is counted by day once: reviews, time, the answers, what was due and passed, started and matured, and where the day lies in the log', () => {
    const c = daysOf(log);
    expect(c.days).toEqual(['2026-06-01', '2026-06-02', '2026-10-20', '2026-10-21', '2026-10-27', '2026-10-27', '2026-10-27', '2026-10-28', '2026-10-29', '2026-10-30']);
    expect(c.byDay.get('2026-10-27')).toEqual({ n: 3, ms: 14000, grades: [0, 1, 1, 1], due: 3, passed: 3, started: 0, matured: 0, from: 4, to: 7 });
    expect(c.byDay.get('2026-06-01')).toMatchObject({ n: 1, started: 1, due: 0 });
    // 12 days to 30: over the line of three weeks
    expect(c.byDay.get('2026-10-20')).toMatchObject({ matured: 1, due: 1, passed: 1 });
    expect(c.byDay.get('2026-10-21')).toMatchObject({ grades: [1, 0, 0, 0], due: 1, passed: 0 });
    expect(c.byDay.has('2026-10-22')).toBe(false);
    // a day's reviews are read from where the count says they lie
    expect(reviewsOn(log, c, '2026-10-27').map((r) => r.card)).toEqual(['ab', 'cd', 'ef']);
    expect(reviewsOn(log, c, '2026-10-22')).toEqual([]);
  });

  it('the heatmap: fifty-three weeks of Mondays ending this week, a cell a day, none before the log or after today, months named where they begin', () => {
    const n = numbersOf(lines, log, NOW, opts(), '2026-06-01');
    const h = n.heat!;
    expect(h.weeks).toHaveLength(HEAT_WEEKS);
    expect(h.weeks.at(-1)!.start).toBe('2026-10-26');
    expect(h.weeks[0]!.start).toBe('2025-10-27');
    expect(h.weeks.every((w) => w.days.length === 7 && mondayOf(w.start) === w.start)).toBe(true);
    // before the log began there is no day, nor after today
    expect(h.weeks[0]!.days.every((d) => d === null)).toBe(true);
    expect(h.weeks.at(-1)!.days.map((d) => d?.n ?? null)).toEqual([0, 3, 1, 1, 1, null, null]);
    expect(h.weeks.at(-1)!.days[1]).toEqual({ day: '2026-10-27', n: 3, level: 4 });
    const june1 = h.weeks.find((w) => w.start === '2026-06-01')!;
    expect(june1.days[0]).toEqual({ day: '2026-06-01', n: 1, level: 2 });
    expect(h.months.find((m) => h.weeks[m.week]!.start === '2026-06-01')?.label).toBe('jun');
    // one label a month, in order
    expect(h.months.map((m) => m.week)).toEqual([...h.months.map((m) => m.week)].sort((a, b) => a - b));
    expect(new Set(h.months.map((m) => h.weeks[m.week]!.start.slice(0, 7))).size).toBe(h.months.length);
  });

  it('the levels are set against the busy days, so one outlier leaves the rest their shades; nothing is level 0', () => {
    const counts: Record<string, number> = { '2026-10-05': 500 };
    for (let i = 6; i <= 25; i++) counts[`2026-10-${String(i).padStart(2, '0')}`] = 10 + i;
    const h = heatOf((d) => counts[d] ?? 0, '2026-10-05', 4);
    const cell = (d: string) => h.weeks.flatMap((w) => w.days).find((c) => c?.day === d)!;
    expect(cell('2026-10-05').level).toBe(4);
    expect(cell('2026-10-06').level).toBeLessThan(cell('2026-10-25').level);
    expect(cell('2026-10-25').level).toBe(4);
    expect(cell('2026-10-26').level).toBe(0);
    // the steps name the least count of each level
    expect(h.steps[0]).toBe(1);
    expect(h.steps).toEqual([...h.steps].sort((a, b) => a - b));
    const lone = heatOf((d) => (d === '2026-10-07' ? 1 : 0), '2026-10-05', 1);
    expect(lone.weeks[0]!.days[2]!.level).toBe(4);
  });

  it('the lines beside it: days studied of days in range, the best day, the runs, the answers, retention, and this week, month and year', () => {
    const c = daysOf(log);
    const s = summaryOf(log, c, '2026-06-01', '2026-10-30');
    expect([s.studied, s.days]).toEqual([8, 152]);
    expect(s.reviews).toBe(10);
    expect(s.best).toEqual({ day: '2026-10-27', n: 3 });
    // 10-27 … 10-30 in a row, today among them; the longest the same four
    expect([s.run, s.longest]).toEqual([4, 4]);
    expect(s.mix).toEqual([2, 1, 6, 1]);
    expect([s.rate.passed, s.rate.due]).toEqual([6, 7]);
    const [week, month, year] = s.periods;
    expect([week!.label, week!.from, week!.reviews, week!.ms]).toEqual(['this week', '2026-10-26', 6, 32000]);
    expect([month!.from, month!.reviews, month!.matured]).toEqual(['2026-10-01', 8, 1]);
    expect([year!.from, year!.reviews, year!.started]).toEqual(['2026-01-01', 10, 1]);
    // the reviews were at nine in the morning
    expect(s.byHour.map((p) => [p.label, p.due])).toEqual([['morning', 7]]);
    // a day without a review yet does not end the run: it stands through yesterday
    expect(summaryOf(log, c, '2026-06-01', '2026-10-31').run).toBe(4);
    expect(summaryOf(log, c, '2026-06-01', '2026-11-01').run).toBe(0);
    // the range a year at most, from the log's first day when that is later
    const n = numbersOf(lines, log, NOW, opts(), '2026-06-01');
    expect([n.summary!.from, n.summary!.to]).toEqual(['2026-06-01', '2026-10-30']);
    expect(numbersOf(lines, log, NOW, opts(), '2024-01-01').summary!.days).toBe(365);
    expect(numbersOf(lines, [], NOW, opts()).summary).toBeUndefined();
  });

  it('the days ahead in the same cells: what comes due a day, the overdue on today, and the lines of a day', () => {
    const n = numbersOf(lines, [], NOW, opts());
    expect(n.forecast.weeks).toHaveLength(FORECAST_WEEKS);
    expect(n.forecast.weeks[0]!.start).toBe('2026-10-26');
    expect(n.forecast.weeks[0]!.days.map((d) => d?.n ?? null)).toEqual([null, null, null, null, 2, 0, 0]);
    expect(n.forecast.weeks[1]!.days.slice(0, 3).map((d) => d!.n)).toEqual([1, 0, 1]);
    // c1 was due on the 20th: it is today's, and overdue
    expect(n.coming).toEqual({ today: 2, overdue: 1, tomorrow: 0, week: 4, month: 4, heaviest: { day: '2026-11-02', n: 1 } });
    expect(linesDue(lines, '2026-10-30', '2026-10-30').map((l) => `${l.card.id} ${l.key ?? ''}`)).toEqual(['ab ', 'ef c1']);
    expect(linesDue(lines, '2026-11-04', '2026-10-30').map((l) => l.card.id)).toEqual(['cd']);
    // the suspended card's day holds nothing
    expect(linesDue(lines, '2026-11-01', '2026-10-30')).toEqual([]);
    expect([dayLabel('2026-10-30'), dayLabel('2026-10-30', true)]).toEqual(['oct 30', 'fri, oct 30']);
  });

  it('a hundred thousand reviews are counted in one pass, quickly', () => {
    const big: Review[] = [];
    const t0 = Date.parse('2025-01-01T08:00:00Z');
    for (let i = 0; i < 120_000; i++) big.push({ at: `${new Date(t0 + i * 240_000).toISOString().slice(0, 19)}Z`, doc: 'deck.md', card: `c${i % 5000}`, g: ((i % 4) + 1) as Review['g'], st: 'review', elapsed: 3, ivl: 3, next: 5, ms: 5000 });
    const t = performance.now();
    const n = numbersOf(lines, big, new Date(t0 + 120_000 * 240_000), opts(), '2025-01-01');
    const took = performance.now() - t;
    expect(n.heat!.weeks.flatMap((w) => w.days).filter((c) => c && c.n > 0).length).toBeGreaterThan(300);
    expect(n.summary!.reviews).toBeGreaterThan(100_000);
    expect(took).toBeLessThan(1500);
  });
});

describe('a grade as its log line', () => {
  it('the state before, the days since, the intervals before and after, the time capped at a minute', () => {
    const prev: CardSchedule = { due: '2026-10-28', state: 'review', stability: 9.123456, difficulty: 5, reps: 4, lapses: 0, ivl: 9, last: '2026-10-19T09:00:00Z' };
    const next: CardSchedule = { due: '2026-11-25', state: 'review', stability: 26.987654321, difficulty: 4.91234567, reps: 5, lapses: 0, ivl: 26, last: '2026-10-30T09:30:00Z' };
    const now = new Date('2026-10-30T09:30:12.345Z');
    expect(reviewOf('deck.md', 'ab', 'r', 3, prev, next, now, 7100.4)).toEqual({
      at: '2026-10-30T09:30:12Z', doc: 'deck.md', card: 'ab', key: 'r', g: 3, st: 'review', elapsed: 11, ivl: 9, next: 26, s: 26.9877, d: 4.9123, ms: 7100,
    });
    const fresh = reviewOf('deck.md', 'cd', undefined, 1, undefined, { state: 'learning', ivl: 0, stability: 0.2, difficulty: 7 }, now, 5 * 60_000);
    expect(fresh).toMatchObject({ st: 'new', elapsed: 0, ivl: 0, next: 0, ms: REVIEW_MS_CAP });
    expect(fresh).not.toHaveProperty('key');
  });
});

describe('the review log on disk', () => {
  const scratch: string[] = [];
  afterEach(async () => {
    for (const d of scratch.splice(0)) await fsp.rm(d, { recursive: true, force: true });
  });
  const open = async (fs: Fs = nodeFs) => {
    const dir = await fsp.mkdtemp(join(tmpdir(), 'ilmi-reviews-'));
    scratch.push(dir);
    await fsp.writeFile(join(dir, 'deck.md'), DECK);
    return { dir, vault: await Vault.open(fs, dir) };
  };
  const today = dayOf(NOW);

  it('appends one line per grade to its month\'s file, never rewriting what is there', async () => {
    const { dir, vault } = await open();
    expect(await vault.loadReviews()).toEqual([]);
    await vault.appendReviews([R(today, 'ab', 3), R('2026-09-30', 'cd', 1)]);
    await vault.appendReviews([R(today, 'cd', 3)]);
    const oct = await fsp.readFile(join(dir, '.ilmi/reviews/2026-10.jsonl'), 'utf8');
    expect(oct.split('\n')).toHaveLength(3);
    expect(oct.endsWith('\n')).toBe(true);
    expect((await fsp.readFile(join(dir, '.ilmi/reviews/2026-09.jsonl'), 'utf8')).split('\n')).toHaveLength(2);
    expect((await vault.loadReviews()).map((r) => r.card)).toEqual(['cd', 'ab', 'cd']);
    // the deck itself is untouched
    expect(await fsp.readFile(join(dir, 'deck.md'), 'utf8')).toBe(DECK);
  });

  it('without append, reads and writes the month whole, a torn last line kept apart', async () => {
    const { appendText: _, ...plain } = nodeFs;
    const { dir, vault } = await open(plain);
    await fsp.mkdir(join(dir, '.ilmi/reviews'), { recursive: true });
    await fsp.writeFile(join(dir, '.ilmi/reviews/2026-10.jsonl'), '{"at":"2026-10-0');
    await vault.appendReviews([R(today, 'ab', 3)]);
    expect((await vault.loadReviews()).map((r) => r.card)).toEqual(['ab']);
  });

  it('reads two devices\' lines, a sync tool\'s conflict copy, and duplicates as one log', async () => {
    const { dir, vault } = await open();
    await vault.appendReviews([R(addDays(today, -1), 'ab', 3), R(today, 'cd', 3)]);
    // the other device's lines, appended to the same file, and its copy of an earlier line
    await fsp.appendFile(join(dir, '.ilmi/reviews/2026-10.jsonl'), `${JSON.stringify(R(today, 'ef', 2, 'review', { at: iso(today, 8) }))}\n`);
    await fsp.writeFile(join(dir, '.ilmi/reviews/2026-10.sync-conflict-20261030-AB12.jsonl'), `${JSON.stringify(R(addDays(today, -1), 'ab', 3))}\n{junk\n`);
    await fsp.writeFile(join(dir, '.ilmi/reviews/notes.txt'), 'not a log');
    const log = await vault.loadReviews();
    expect(log.map((r) => `${r.at.slice(0, 10)} ${r.card}`)).toEqual([`${addDays(today, -1)} ab`, `${today} ef`, `${today} cd`]);
  });
});

describe('the sample', () => {
  it('double-major\'s log agrees with its sr lines: every graded line\'s reviews counted, its last at the line\'s last', async () => {
    const root = join(import.meta.dirname, '../../../samples/double-major');
    const vault = await Vault.open(nodeFs, root);
    const log = await vault.loadReviews();
    expect(log.length).toBeGreaterThan(4000);
    const docs: [string, Doc][] = [];
    for (const p of vault.documents()) docs.push([p, (await vault.read(p)).doc]);
    const byLine = new Map<string, Review[]>();
    for (const r of log) { const k = `${r.doc}#${r.card}#${r.key ?? ''}`; byLine.set(k, [...(byLine.get(k) ?? []), r]); }
    let checked = 0;
    for (const l of linesOf(docs)) {
      if (!l.sched?.reps || !l.card.id) continue;
      const mine = byLine.get(`${l.path}#${l.card.id}#${l.key ?? ''}`) ?? [];
      expect(mine.length, `${l.path} ${l.card.id} ${l.key ?? ''}`).toBe(l.sched.reps);
      expect(mine.filter((r) => r.g === 1 && (r.st === 'review')).length, `${l.card.id} lapses`).toBe(l.sched.lapses ?? 0);
      expect(mine[mine.length - 1]!.at).toBe(l.sched.last!.length === 10 ? mine[mine.length - 1]!.at : l.sched.last);
      checked++;
    }
    expect(checked).toBeGreaterThan(600);
  });
});

describe('what was read, its own layer', () => {
  const at = (day: string, hm: string) => `${new Date(`${day}T${hm}:00`).toISOString().slice(0, 19)}Z`;
  const R = (day: string, hm: string, read: Reading['read'], doc: string, more: Partial<Reading> = {}): Reading => ({ at: at(day, hm), doc, read, ...more });
  const log: Reading[] = [
    R('2026-11-10', '08:00', 'pass', 'papers/a.md', { to: 4, ms: 300_000 }),
    R('2026-11-10', '08:10', 'extract', 'papers/a.md'),
    R('2026-11-10', '08:20', 'section', 'papers/a/notes.md', { sec: 'one' }),
    R('2026-11-10', '09:00', 'later', 'books/b.md'),
    R('2026-11-11', '09:00', 'done', 'books/b.md'),
    R('2026-11-12', '07:00', 'pass', 'books/b.md', { ms: 60_000 }),
    R('2026-11-12', '07:30', 'pass', 'papers/a/notes.md', { sec: 'one' }),
    R('2026-11-12', '23:30', 'pass', 'gone/c.md'),
  ];
  const NOW = new Date('2026-11-12T23:45:00');

  it('the readings under a lens: by its documents, and by its path for what is not one of them', () => {
    expect(readingsUnder(log, '', new Set()).length).toBe(8);
    expect(readingsUnder(log, 'papers', new Set(['papers/a.md', 'papers/a/notes.md'])).length).toBe(4);
    // a document's lens holds its children; a PDF on its own or a document gone is found by where it lay
    expect(readingsUnder(log, 'papers/a.md', new Set()).map((r) => r.read)).toEqual(['pass', 'extract', 'section', 'pass']);
    expect(readingsUnder(log, 'gone', new Set()).length).toBe(1);
    expect(readingsUnder(log, 'pap', new Set())).toEqual([]);
  });

  it('counted by day once: passes, what was made, the time; later and done are on the day and not in its shade', () => {
    const c = readingDaysOf(log);
    expect(c.byDay.get('2026-11-10')).toMatchObject({ passes: 1, extracts: 1, sections: 1, later: 1, done: 0, ms: 300_000 });
    expect([10, 11, 12].map((d) => readCount(c.byDay.get(`2026-11-${d}`)))).toEqual([3, 0, 3]);
    expect(readCount(undefined)).toBe(0);
    expect(readingsOn(log, c, '2026-11-12').map((r) => r.doc)).toEqual(['books/b.md', 'papers/a/notes.md', 'gone/c.md']);
    expect(readingsOn(log, c, '2026-11-09')).toEqual([]);
    expect(readDayWords(c.byDay.get('2026-11-10'))).toBe('1 read, 2 made');
    expect(readDayWords(c.byDay.get('2026-11-11'))).toBe('1 done');
    expect(readDayWords(c.byDay.get('2026-11-12'))).toBe('3 read');
    expect(readDayWords(undefined)).toBe('nothing read');
  });

  it('the same year of days: a day before the log began is no day, the lines are the reading\'s', () => {
    const n = readingNumbersOf(log, NOW, '2026-11-10');
    expect(n.heat.weeks).toHaveLength(HEAT_WEEKS);
    const cells = n.heat.weeks.flatMap((w) => w.days).filter((c) => c !== null);
    expect(cells.map((c) => [c.day, c.n])).toEqual([['2026-11-10', 3], ['2026-11-11', 0], ['2026-11-12', 3]]);
    expect(cells.map((c) => c.level)).toEqual([4, 0, 4]);
    expect(n.summary).toMatchObject({ from: '2026-11-10', to: '2026-11-12', days: 3, read: 2, passes: 4, extracts: 1, sections: 1, ms: 360_000, best: { day: '2026-11-10', n: 3 } });
    expect(n.summary.periods.map((p) => [p.label, p.from, p.passes, p.extracts, p.sections])).toEqual([
      ['this week', '2026-11-09', 4, 1, 1], ['this month', '2026-11-01', 4, 1, 1], ['this year', '2026-01-01', 4, 1, 1],
    ]);
    expect(n.since).toBe('2026-11-10');
    // a lens with nothing read, in a collection whose log began: its days are there, empty
    const none = readingNumbersOf([], NOW, '2026-11-10');
    expect(none.heat.weeks.flatMap((w) => w.days).filter((c) => c !== null).map((c) => c.n)).toEqual([0, 0, 0]);
    expect(none.summary).toMatchObject({ days: 3, read: 0, passes: 0, best: null });
    // nothing logged anywhere: today alone, and no day it is said to have begun
    const never = readingNumbersOf([], NOW);
    expect(never.since).toBeUndefined();
    expect(never.heat.weeks.flatMap((w) => w.days).filter((c) => c !== null).map((c) => c.day)).toEqual(['2026-11-12']);
    expect(never.summary.days).toBe(1);
  });
});
