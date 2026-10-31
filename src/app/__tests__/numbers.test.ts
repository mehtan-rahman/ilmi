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
import { linesOf, mondayOf, numbersOf, rateLabel, reviewsUnder, spanLabel, weekLabel } from '../numbers.js';

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
