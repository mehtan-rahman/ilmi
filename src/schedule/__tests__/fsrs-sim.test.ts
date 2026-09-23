// Does our scheduler do what ts-fsrs does? Long review histories run through
// our path (grade → the on-disk line → parse → grade …) and through ts-fsrs
// on its own Card object, side by side, and must agree exactly at every step:
// the card read back from the file is the card ts-fsrs would have held. (When
// stability and difficulty were rounded to two decimals on the way to disk,
// intervals drifted from ts-fsrs's own in a third of steps, by up to 8%.)

import { createEmptyCard, fsrs, generatorParameters, type Card as FsrsCard, type Grade as FsrsGrade } from 'ts-fsrs';
import { promises as fsp } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import { parse, serialize, type Card, type CardSchedule } from '../../format/index.js';
import { nodeFs } from '../../vault/node-fs.js';
import { Vault } from '../../vault/index.js';
import { dayOf, grade, gradeItem, instantOf, preview, queue, toFsrs, whenToDate, type CardItem, type Grade } from '../index.js';

const CORPUS = fileURLToPath(new URL('../../format/__tests__/corpus/vault/', import.meta.url));
const T0 = new Date('2026-05-27T12:00:00Z');
const DAY = 86_400_000;

/** A small deterministic PRNG, so a failure is reproducible. */
function rng(seed: number): () => number {
  let s = seed >>> 0;
  return () => {
    s = (s + 0x6d2b79f5) >>> 0;
    let t = s;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** again 10%, hard 15%, good 60%, easy 15%: a plausible learner. */
const pickGrade = (r: number): Grade => (r < 0.1 ? 1 : r < 0.25 ? 2 : r < 0.85 ? 3 : 4);

/** Through the file: the schedule written as its `sr` line and read back. */
function roundTrip(s: CardSchedule): CardSchedule {
  const card: Card = { kind: 'card', text: 'a {{c1::b}}', id: 'x', sched: s };
  const { doc, diagnostics } = parse(serialize({ blocks: [card] }));
  if (diagnostics.length) throw new Error(diagnostics.map((d) => d.message).join('; '));
  const back = doc.blocks[0];
  if (back?.kind !== 'card' || !back.sched) throw new Error('lost the schedule');
  return back.sched;
}

const scheduler = fsrs(generatorParameters());

/** When the next review happens: at the due moment, plus up to two days of lateness (never early). */
function nextReview(due: Date, rand: () => number): Date {
  return new Date(due.getTime() + Math.floor(rand() * 3) * DAY + Math.floor(rand() * 8) * 3_600_000);
}

const STATE_NAMES = ['new', 'learning', 'review', 'relearning'];

/** One card's whole history, both ways; the number of steps compared. */
function simulate(seed: number, reviews: number): number {
  const rand = rng(seed);
  let ours: CardSchedule | undefined;
  let native: FsrsCard = createEmptyCard(T0);
  let now = T0;
  for (let i = 0; i < reviews; i++) {
    const g = pickGrade(rand());
    // ours: grade, write the line, read it back
    ours = roundTrip(grade(ours, g, now));
    const backToNative = toFsrs(ours, now);
    // ts-fsrs on its own card
    native = scheduler.next(native, now, g as FsrsGrade).card;

    const at = `seed ${seed} step ${i}`;
    expect(ours.state, at).toBe(STATE_NAMES[native.state]);
    expect(ours.reps, at).toBe(native.reps);
    expect(ours.lapses, at).toBe(native.lapses);
    expect(ours.stability, at).toBe(native.stability);
    expect(ours.difficulty, at).toBe(native.difficulty);
    expect(ours.ivl, at).toBe(native.scheduled_days);
    expect(ours.steps ?? 0, at).toBe(native.learning_steps);
    expect(ours.last, at).toBe(instantOf(now));
    if (native.scheduled_days >= 1) expect(ours.due, at).toBe(dayOf(native.due));
    else expect(ours.due, at).toBe(instantOf(native.due));
    // and reading the line back gives ts-fsrs the same card it would have had
    expect(backToNative.stability, at).toBe(native.stability);
    expect(backToNative.difficulty, at).toBe(native.difficulty);
    expect(backToNative.reps, at).toBe(native.reps);
    expect(backToNative.lapses, at).toBe(native.lapses);
    expect(backToNative.state, at).toBe(native.state);
    expect(backToNative.learning_steps, at).toBe(native.learning_steps);
    expect(backToNative.last_review?.getTime(), at).toBe(Math.floor(native.last_review!.getTime() / 1000) * 1000);
    // the file's next review starts from the same moment ts-fsrs's would
    expect(whenToDate(ours.due!).getTime() - native.due.getTime(), at).toBeLessThanOrEqual(0);

    now = nextReview(native.due, rand);
  }
  return reviews;
}

describe('fsrs, simulated', () => {
  it('agrees with ts-fsrs exactly at every step of 300 cards × 40 reviews, through the file each time', () => {
    let steps = 0;
    for (let seed = 1; seed <= 300; seed++) steps += simulate(seed, 40);
    expect(steps).toBe(12000);
  });

  it('keeps the algorithm\'s shape: steps for new cards, ordered intervals, lapses, retention near 0.9', () => {
    const fresh = preview(undefined, T0);
    expect(fresh[1].due).toBe(instantOf(new Date(T0.getTime() + 60_000)));
    expect(fresh[3].due).toBe(instantOf(new Date(T0.getTime() + 600_000)));
    expect(fresh[4].ivl).toBeGreaterThanOrEqual(1);
    expect(fresh[1].state).toBe('learning');
    expect(fresh[4].state).toBe('review');

    // a seasoned review card: again < hard < good < easy, again lapses into relearning
    const seasoned: CardSchedule = { due: '2026-05-27', state: 'review', stability: 22, difficulty: 3.8, reps: 9, lapses: 0, ivl: 22, last: '2026-05-05T08:00:00Z' };
    const p = preview(seasoned, T0);
    expect(p[1].state).toBe('relearning');
    expect(p[1].lapses).toBe(1);
    expect(p[1].ivl).toBe(0);
    expect(p[2].ivl).toBeLessThan(p[3].ivl!);
    expect(p[3].ivl).toBeLessThan(p[4].ivl!);
    expect(p[3].stability).toBeGreaterThan(seasoned.stability!);
    expect(p[2].difficulty).toBeGreaterThan(p[3].difficulty!);
    expect(p[3].difficulty).toBeGreaterThan(p[4].difficulty!);

    // retrievability at the scheduled due sits near the requested 0.9 (whole days round it)
    const rs: number[] = [];
    for (let seed = 1; seed <= 100; seed++) {
      const rand = rng(seed * 7919);
      let s: CardSchedule | undefined;
      let now = T0;
      for (let i = 0; i < 12; i++) {
        s = roundTrip(grade(s, pickGrade(rand()), now));
        now = nextReview(whenToDate(s.due!), rand);
      }
      if (s!.state === 'review' && (s!.ivl ?? 0) >= 3) {
        rs.push(scheduler.get_retrievability(toFsrs(s!, now), whenToDate(s!.due!), false));
      }
    }
    expect(rs.length).toBeGreaterThan(50);
    const mean = rs.reduce((a, b) => a + b, 0) / rs.length;
    console.log(`fsrs sim: retrievability at due over ${rs.length} review cards: mean ${mean.toFixed(3)}, min ${Math.min(...rs).toFixed(3)}, max ${Math.max(...rs).toFixed(3)}`);
    expect(mean).toBeGreaterThan(0.88);
    expect(mean).toBeLessThan(0.92);
    for (const r of rs) expect(r).toBeGreaterThan(0.85);
  });

  it('agrees with ts-fsrs through the vault: gradeItem on a corpus card, ten reviews, one line each', async () => {
    const root = await fsp.mkdtemp(join(tmpdir(), 'ilmi-fsrs-'));
    await fsp.cp(CORPUS, root, { recursive: true });
    const vault = await Vault.open(nodeFs, root);
    try {
      const path = 'papers/wozniak-1990.md';
      const first = (await queue(vault, T0)).find((i): i is CardItem => i.kind === 'card' && i.id === 'cw1-paths')!;
      let native: FsrsCard = toFsrs(first.sched, T0);
      let now = T0;
      const rand = rng(42);
      const grades: Grade[] = [3, 3, 1, 3, 2, 3, 4, 3, 1, 3];
      for (const g of grades) {
        const before = (await vault.read(path)).text.split('\n');
        const item = (await queue(vault, now)).find((i): i is CardItem => i.kind === 'card' && i.id === 'cw1-paths')!;
        await vault.update(path, (doc) => { gradeItem(doc, item, g, now); });
        const after = (await vault.read(path)).text.split('\n');
        expect(after.length).toBe(before.length);
        expect(after.filter((l, i) => l !== before[i])).toHaveLength(1);
        native = scheduler.next(native, now, g as FsrsGrade).card;
        const stored = (await vault.read(path)).doc.blocks.find((b) => b.kind === 'card' && b.id === 'cw1-paths');
        const s = stored?.kind === 'card' ? stored.sched! : undefined;
        expect(s).toBeDefined();
        expect(s!.stability).toBe(native.stability);
        expect(s!.difficulty).toBe(native.difficulty);
        expect(s!.reps).toBe(native.reps);
        expect(s!.lapses).toBe(native.lapses);
        expect(s!.ivl).toBe(native.scheduled_days);
        expect(s!.state).toBe(['new', 'learning', 'review', 'relearning'][native.state]);
        expect(native.scheduled_days >= 1 ? dayOf(native.due) : instantOf(native.due)).toBe(s!.due);
        now = nextReview(native.due, rand);
      }
    } finally {
      vault.close();
      await fsp.rm(root, { recursive: true, force: true });
    }
  });
});
