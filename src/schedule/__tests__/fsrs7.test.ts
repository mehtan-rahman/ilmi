// FSRS-7 in the slot: a card's memory replayed from the review log in
// fractions of a day, no word on a card whose history the log does not
// have whole, recall and the curve and the buttons' outcomes agreeing with
// one another, the weights as they are kept and read back, and the log as
// the optimiser is sent it.
//
// Then the sample collection (`samples/double-major`: 774 schedule lines
// and a log of 5144 reviews), which is the migration's proof. Choosing
// FSRS-7 writes nothing: every `sr` line is as it was, every card it has no
// word on is due exactly when the built in says, a grade writes the built
// in's line whatever is chosen, and only the cards FSRS-7 itself scores
// are due by it. And the fit: the weights the Rust side fitted to that log
// (`fsrs7-sample-fit.json`, written by `npm run fixture:fit`) are read
// here as the app reads them, counted from the same items, and predict the
// log's own reviews better than the defaults do.

import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join, relative } from 'node:path';
import { describe, expect, it } from 'vitest';
import { FSRS7Algorithm, FSRS7_DEFAULT_WEIGHTS, FSRS7_MODEL_BOUNDS } from 'ts-fsrs-6/models/fsrs-7';
import { mergeReviews, parse, parseReviews, serialize, type Doc, type Review } from '../../format/index.js';
import {
  FSRS7_ID, FSRS7_MIN_ITEMS, applyScores, docItems, fitCards, fitItems, fitReviews, fsrs7FitIn, fsrs7Scheduler, fsrs7State, fsrs7Weights, grade, gradeItem, indexLog, isDue, schedCardOf, scoreKey,
  slotted, wholeFor, wholeHistory,
  type CardItem, type QueueItem, type SchedCard, type Score,
} from '../index.js';

const DAY = 86_400_000;
const SAMPLE = join(import.meta.dirname, '../../../samples/double-major');
const NOW = new Date('2026-11-02T09:00:00');
const ctx = { now: NOW };

const rev = (card: string, at: string, g: Review['g'], st: Review['st'] = 'review', key?: string): Review => ({ at, doc: 'deck.md', card, g, st, elapsed: 0, ivl: 0, next: 0, ...(key ? { key } : {}) });
const history = (): Review[] => [rev('x', '2026-09-01T08:00:00Z', 3, 'new'), rev('x', '2026-09-01T08:10:00Z', 3, 'learning'), rev('x', '2026-09-04T20:00:00Z', 3), rev('x', '2026-09-20T07:30:00Z', 2)];
const card = (h: Review[], more: Partial<SchedCard> = {}): SchedCard => ({ path: 'deck.md', id: 'x', block: 0, retention: 0.9, history: h, ...more });
const sync = <T,>(x: T | Promise<T>): T => x as T;

describe('a card\'s memory, from the log', () => {
  const algo = new FSRS7Algorithm(FSRS7_DEFAULT_WEIGHTS, FSRS7_MODEL_BOUNDS);

  it('is each review taken with the time since the one before, in fractions of a day', () => {
    const h = history();
    let s = algo.next_state(null, 0, 3);
    s = algo.next_state(s, 10 / 1440, 3);
    s = algo.next_state(s, 3.5 - 10 / 1440, 3);
    s = algo.next_state(s, 15 + 11.5 / 24, 2);
    expect(fsrs7State(algo, h)).toEqual({ ...s, at: Date.parse('2026-09-20T07:30:00Z') });
    // on from where it stood, a review added: the same memory
    const more = [...h, rev('x', '2026-10-10T09:00:00Z', 3)];
    expect(fsrs7State(algo, more, fsrs7State(algo, h), h.length)).toEqual(fsrs7State(algo, more));
    expect(fsrs7State(algo, [])).toBeNull();
  });

  it('is replayed from the card\'s first review, or its first since it was reset; without one the log does not have it whole', () => {
    const h = history();
    expect(wholeHistory(h)).toBe(h);
    expect(wholeHistory(h.slice(1))).toEqual([]);
    const reset = [...h, rev('x', '2026-10-01T08:00:00Z', 4, 'new'), rev('x', '2026-10-09T08:00:00Z', 3)];
    expect(wholeHistory(reset).map((r) => r.at)).toEqual(['2026-10-01T08:00:00Z', '2026-10-09T08:00:00Z']);
    // nor is it whole when the card's line was reviewed after the log's last word on it
    expect(wholeFor(card(h, { fsrs: { last: '2026-09-20T07:30:00Z' } }))).toBe(h);
    expect(wholeFor(card(h, { fsrs: { last: '2026-09-20T07:30:01Z' } }))).toBe(h);
    expect(wholeFor(card(h, { fsrs: { last: '2026-10-15T07:30:00Z' } }))).toEqual([]);
    expect(wholeFor(card(h))).toBe(h);
  });
});

describe('fsrs-7 as a scheduler', () => {
  it('is the date-less kind, under its own id', () => {
    const s = fsrs7Scheduler();
    expect([s.id, s.name, typeof s.recall, typeof s.curve, typeof s.preview, s.next]).toEqual([FSRS7_ID, 'fsrs-7', 'function', 'function', 'function', undefined]);
  });

  it('recall falls with the days, the curve is the same recall looked at ahead, and a card not whole in the log has no word', () => {
    const s = fsrs7Scheduler();
    const h = history();
    const x = card(h);
    const [now] = sync(s.recall!([x], ctx));
    expect(now).toBeGreaterThan(0);
    expect(now).toBeLessThan(1);
    const ahead = sync(s.curve!(x, [0, 1, 10, 100], ctx));
    expect(ahead[0]).toBe(now);
    expect(ahead[1]!).toBeLessThan(ahead[0]!);
    expect(ahead[3]!).toBeLessThan(ahead[2]!);
    const [later] = sync(s.recall!([x], { now: new Date(NOW.getTime() + 10 * DAY) }));
    expect(later).toBeCloseTo(ahead[2]!, 12);
    // a card the log starts in the middle of, a card with nothing in it, a card reviewed since
    expect(sync(s.recall!([card(h.slice(1)), card([]), card(h, { fsrs: { last: '2026-10-30T07:30:00Z' } })], ctx))).toEqual([null, null, null]);
    expect(sync(s.preview!(card(h.slice(1)), ctx))).toBeNull();
  });

  it('a button says when the card is next at its target: easier grades later, and recall there is the retention', () => {
    const s = fsrs7Scheduler();
    const h = history();
    for (const retention of [0.9, 0.8]) {
      const x = card(h, { retention });
      const out = sync(s.preview!(x, ctx))!;
      const back = [1, 2, 3, 4].map((g) => (out[g as 1].due as Date).getTime() - NOW.getTime());
      expect(back[0]!).toBeGreaterThan(0);
      expect(back[1]!).toBeGreaterThan(back[0]!);
      expect(back[2]!).toBeGreaterThan(back[1]!);
      expect(back[3]!).toBeGreaterThan(back[2]!);
      // graded good now, the card's recall on the day the button named is its target
      const after = card([...h, rev('x', NOW.toISOString().replace(/\.\d+Z$/, 'Z'), 3)], { retention });
      const [then] = sync(s.recall!([after], { now: new Date(NOW.getTime() + back[2]!) }));
      expect(then).toBeCloseTo(retention, 2);
    }
    // a lower target is a longer wait
    const far = (sync(s.preview!(card(h, { retention: 0.8 }), ctx))![3].due as Date).getTime();
    const near = (sync(s.preview!(card(h, { retention: 0.9 }), ctx))![3].due as Date).getTime();
    expect(far).toBeGreaterThan(near);
  });

  it('answers the same asked twice, after a review is added, and after the log changed under it', () => {
    const s = fsrs7Scheduler();
    const h = history();
    const first = sync(s.recall!([card(h)], ctx));
    expect(sync(s.recall!([card(h)], ctx))).toEqual(first);
    const more = [...h, rev('x', '2026-10-10T09:00:00Z', 3)];
    const fresh = sync(fsrs7Scheduler().recall!([card(more)], ctx));
    expect(sync(s.recall!([card(more)], ctx))).toEqual(fresh);
    // a sync brought an older review in: prepared again, it is replayed from the start
    const other = [h[0]!, rev('x', '2026-09-01T08:05:00Z', 1, 'learning'), ...more.slice(1)];
    void s.prepare!(other, ctx);
    expect(sync(s.recall!([card(other)], ctx))).toEqual(sync(fsrs7Scheduler().recall!([card(other)], ctx)));
    expect(sync(s.recall!([card(other)], ctx))).not.toEqual(fresh);
  });

  it('answers by the weights it is given, from when they change', () => {
    let w: number[] | null = null;
    const s = fsrs7Scheduler(() => w);
    const x = card(history());
    const byDefault = sync(s.recall!([x], ctx));
    w = FSRS7_DEFAULT_WEIGHTS.map((v, i) => (i === 2 ? v * 2 : v));
    expect(sync(s.recall!([x], ctx))).not.toEqual(byDefault);
    w = null;
    expect(sync(s.recall!([x], ctx))).toEqual(byDefault);
  });
});

describe('the weights, kept', () => {
  it('are 34 numbers the model can run on, to four decimals; anything else is the defaults', () => {
    expect(fsrs7Weights(FSRS7_DEFAULT_WEIGHTS)).toEqual(FSRS7_DEFAULT_WEIGHTS);
    expect(fsrs7Weights(FSRS7_DEFAULT_WEIGHTS.map((v) => v + 0.00001))).toEqual(FSRS7_DEFAULT_WEIGHTS);
    expect(fsrs7Weights(FSRS7_DEFAULT_WEIGHTS.slice(1))).toBeNull();
    expect(fsrs7Weights([...FSRS7_DEFAULT_WEIGHTS.slice(1), Number.NaN])).toBeNull();
    expect(fsrs7Weights([...FSRS7_DEFAULT_WEIGHTS.slice(1), '1'])).toBeNull();
    expect(fsrs7Weights('nothing')).toBeNull();
    // out of the model's bounds, they are brought within them
    const wild = fsrs7Weights(FSRS7_DEFAULT_WEIGHTS.map((v, i) => (i === 0 ? 1e9 : v)))!;
    expect(wild[0]).toBeLessThan(1e9);
  });

  it('are read from the collection\'s file with what they were fitted from', () => {
    expect(fsrs7FitIn({})).toBeNull();
    expect(fsrs7FitIn({ fsrs7: { w: [1, 2, 3] } })).toBeNull();
    expect(fsrs7FitIn({ scheduler: 'fsrs-7', fsrs7: { w: FSRS7_DEFAULT_WEIGHTS, reviews: 5144, fitted: '2026-11-19' } })).toEqual({ w: FSRS7_DEFAULT_WEIGHTS, reviews: 5144, fitted: '2026-11-19' });
    expect(fsrs7FitIn({ fsrs7: { w: FSRS7_DEFAULT_WEIGHTS, reviews: 'many', fitted: 'lately' } })).toEqual({ w: FSRS7_DEFAULT_WEIGHTS, reviews: 0, fitted: '' });
  });
});

describe('the log, as the optimiser is sent it', () => {
  it('each line of a card from its first review on, a reset line as a card each time, a line not whole left out', () => {
    const log = [
      rev('b', '2026-09-02T08:00:00Z', 3, 'new'), rev('a', '2026-09-01T08:00:00Z', 1, 'new'), rev('a', '2026-09-01T08:10:00Z', 3, 'learning'),
      rev('a', '2026-09-03T08:00:00Z', 3, 'new', 'r'), rev('b', '2026-09-05T08:00:00Z', 4), rev('b', '2026-09-20T08:00:00Z', 2, 'new'), rev('b', '2026-09-21T08:00:00Z', 3, 'learning'),
      rev('c', '2026-09-09T08:00:00Z', 3), rev('c', '2026-09-19T08:00:00Z', 3),
    ];
    const cards = fitCards(log);
    expect(cards.map((c) => c.map((r) => r.g))).toEqual([[1, 3], [3], [3, 4], [2, 3]]);
    expect(cards[0]![1]!.t - cards[0]![0]!.t).toBe(600);
    expect([fitItems(cards), fitReviews(cards)]).toEqual([3, 7]);
    // whatever order the log came in
    expect(fitCards([...log].reverse())).toEqual(cards);
    expect(scoreKey('a', 'r')).toBe('a\nr');
  });
});

// ── the sample collection ────────────────────────────────────────

function sampleDocs(): [string, Doc][] {
  const out: [string, Doc][] = [];
  const visit = (dir: string) => {
    for (const name of readdirSync(dir).sort()) {
      const p = join(dir, name);
      if (name.startsWith('.')) continue;
      if (statSync(p).isDirectory()) visit(p);
      else if (name.endsWith('.md')) out.push([relative(SAMPLE, p).split('\\').join('/'), parse(readFileSync(p, 'utf8')).doc]);
    }
  };
  visit(SAMPLE);
  return out;
}

function sampleLog(): Review[] {
  const dir = join(SAMPLE, '.ilmi/reviews');
  return mergeReviews(readdirSync(dir).filter((n) => n.endsWith('.jsonl')).sort().map((n) => parseReviews(readFileSync(join(dir, n), 'utf8'))));
}

const itemsOf = (docs: [string, Doc][]): QueueItem[] => docs.flatMap(([p, d]) => docItems(p, d, NOW));
const cardsOf = (list: QueueItem[]): CardItem[] => list.filter((i): i is CardItem => i.kind === 'card');

describe('the sample collection under fsrs-7', () => {
  const docs = sampleDocs();
  const log = sampleLog();
  const index = indexLog(log);
  const scheduler = fsrs7Scheduler();

  /** The queue's items with FSRS-7's scores laid over them, and which lines it scored. */
  function laid(over: ReadonlyMap<string, readonly Review[]> = index): { list: QueueItem[]; scored: Set<CardItem> } {
    const list = itemsOf(docs);
    const asked = new Map<QueueItem, SchedCard>();
    for (const i of list) { const c = schedCardOf(i, over, 0.9); if (c) asked.set(i, c); }
    const cards = [...asked.values()];
    const recall = sync(scheduler.recall!(cards, ctx));
    const scores = new Map<SchedCard, Score>();
    cards.forEach((c, n) => { const r = recall[n]; if (typeof r === 'number') scores.set(c, { last: c.fsrs?.last, recall: r }); });
    const scored = new Set<CardItem>();
    applyScores(list, (i) => { const s = scores.get(asked.get(i)!); if (s) scored.add(i); return s; }, () => 0.9, NOW);
    return { list, scored };
  }

  it('nothing is written: every document is byte for byte what it was', () => {
    const before = docs.map(([, d]) => serialize(d));
    laid();
    expect(docs.map(([, d]) => serialize(d))).toEqual(before);
  });

  it('the log has every reviewed card whole, and fsrs-7 scores them all; which are due today is where it differs', () => {
    const builtIn = cardsOf(itemsOf(docs));
    const { list, scored } = laid();
    const mine = cardsOf(list);
    const asked = mine.filter(slotted);
    expect(scored.size).toBe(asked.length);
    const due = (l: CardItem[]) => l.filter((i, n) => slotted(mine[n]!) && isDue(i, NOW)).length;
    console.log(`fsrs-7 over the sample: ${mine.length} lines, ${asked.length} with a review and out of their steps, all scored; due today ${due(builtIn)} by the built in, ${due(mine)} by fsrs-7's defaults`);
    // what it was not asked about (new cards, cards in their steps) is the built in's own unless it is the other direction of a card it scored
    const paired = new Set([...scored].filter((i) => i.dir).map((i) => `${i.path}#${i.block}`));
    mine.forEach((item, n) => { if (!scored.has(item) && !(item.dir && paired.has(`${item.path}#${item.block}`))) expect(item).toEqual(builtIn[n]); });
  });

  it('a card it has no word on is due exactly when the built in says; only the cards it scores are due by it', () => {
    const builtIn = cardsOf(itemsOf(docs));
    // the log as a collection would have it that began logging late for one notebook: its cards' first reviews are not there
    const late = indexLog(log.filter((r) => !(r.doc.startsWith('arabic/') && r.st === 'new')));
    const { list, scored } = laid(late);
    const mine = cardsOf(list);
    expect(mine.length).toBe(builtIn.length);
    let moved = 0;
    let siblings = 0;
    // the other direction of a both-ways card FSRS-7 scored: the two are one a day, by whatever days they have
    const paired = new Set([...scored].filter((i) => i.dir).map((i) => `${i.path}#${i.block}`));
    mine.forEach((item, n) => {
      const was = builtIn[n]!;
      if (scored.has(item)) {
        expect(item.slot?.recall).toBeGreaterThan(0);
        if (isDue(item, NOW) !== isDue(was, NOW)) moved++;
        return;
      }
      if (item.dir && paired.has(`${item.path}#${item.block}`)) {
        // held back for its sibling or let go by it, and nothing else of it changed
        const { buried: _a, dueAt: _b, ...rest } = item;
        const { buried: _c, dueAt: _d, ...restWas } = was;
        expect(rest).toEqual(restWas);
        if (!!item.buried !== !!was.buried) siblings++;
        return;
      }
      // not one of FSRS-7's: the item is the built in's own, to the field
      expect(item).toEqual(was);
    });
    const asked = mine.filter(slotted);
    const left = asked.filter((i) => !scored.has(i));
    console.log(`fsrs-7 over the sample with a late log: ${asked.length} asked about, ${scored.size} scored, ${left.length} left to the built in; ${moved} scored ones due on another side of today, ${siblings} other directions held back or let go with them`);
    expect(scored.size).toBeGreaterThan(0);
    expect(left.length).toBeGreaterThan(0);
    expect(left.every((i) => i.path.startsWith('arabic/') && i.slot === undefined)).toBe(true);
    expect([...scored].every((i) => !i.path.startsWith('arabic/'))).toBe(true);
  });

  it('a grade writes the built in\'s line whatever is chosen: the next due on the file is the one it was', () => {
    const { list } = laid();
    let n = 0;
    for (const [path, doc] of docs) {
      for (const item of cardsOf(list).filter((i) => i.path === path && i.id !== undefined)) {
        const copy = structuredClone(doc);
        const from = item.sched;
        const next = gradeItem(copy, item, 3, NOW, { retention: 0.9 });
        expect(next).toEqual(grade(from, 3, NOW, { request_retention: 0.9 }));
        n++;
      }
    }
    expect(n).toBeGreaterThan(700);
  });

  it('where the built in and fsrs-7 both know a card, they are not worlds apart', () => {
    // each line's memory replayed to its last review in the log, and the built in's stability then, as the log wrote it
    const algo = new FSRS7Algorithm(FSRS7_DEFAULT_WEIGHTS, FSRS7_MODEL_BOUNDS);
    const ratios: number[] = [];
    for (const h of index.values()) {
      const whole = wholeHistory(h);
      const last = whole[whole.length - 1];
      if (!last || last.s === undefined || last.next < 1) continue;
      const state = fsrs7State(algo, whole)!;
      // the days each gives the card until it is at 0.9
      ratios.push(algo.next_interval(state, 0.9) / last.s);
    }
    ratios.sort((a, b) => a - b);
    const median = ratios[Math.floor(ratios.length / 2)]!;
    console.log(`fsrs-7 against the built in, days to 0.9 over ${ratios.length} lines: median ratio ${median.toFixed(2)}, tenth ${ratios[Math.floor(ratios.length / 10)]!.toFixed(2)}, ninetieth ${ratios[Math.floor(ratios.length * 0.9)]!.toFixed(2)}`);
    expect(ratios.length).toBeGreaterThan(500);
    expect(median).toBeGreaterThan(0.25);
    expect(median).toBeLessThan(4);
  });
});

describe('the fit of the sample\'s log', () => {
  const fixture = JSON.parse(readFileSync(join(import.meta.dirname, 'fsrs7-sample-fit.json'), 'utf8')) as { w: number[]; items: number; reviews: number; cards: number };
  const log = sampleLog();
  const cards = fitCards(log);

  it('is made from the items both sides count the same', () => {
    expect([cards.length, fitReviews(cards), fitItems(cards)]).toEqual([fixture.cards, fixture.reviews, fixture.items]);
    expect(fixture.items).toBeGreaterThanOrEqual(FSRS7_MIN_ITEMS);
  });

  it('gives weights the model runs on here, which predict the log\'s own reviews better than the defaults', () => {
    const w = fsrs7Weights(fixture.w)!;
    expect(w).not.toBeNull();
    expect(w).not.toEqual(FSRS7_DEFAULT_WEIGHTS);
    /** The mean log loss of each review after a card's first, predicted from the reviews before it. */
    const loss = (weights: readonly number[]): number => {
      const algo = new FSRS7Algorithm(weights, FSRS7_MODEL_BOUNDS);
      let sum = 0;
      let n = 0;
      for (const c of cards) {
        let state = algo.next_state(null, 0, c[0]!.g);
        for (let i = 1; i < c.length; i++) {
          const t = Math.max(0, (c[i]!.t - c[i - 1]!.t) / 86_400);
          const p = Math.min(1 - 1e-6, Math.max(1e-6, algo.curve(t, state).retrievability));
          sum -= c[i]!.g > 1 ? Math.log(p) : Math.log(1 - p);
          n++;
          state = algo.next_state(state, t, c[i]!.g);
        }
      }
      return sum / n;
    };
    const [fitted, defaults] = [loss(w), loss(FSRS7_DEFAULT_WEIGHTS)];
    console.log(`fsrs-7 on the sample's ${fixture.items} items: log loss ${fitted.toFixed(4)} fitted, ${defaults.toFixed(4)} by the defaults`);
    expect(fitted).toBeLessThan(defaults);
  });
});
