// @vitest-environment jsdom
// The scheduler slot in the app, over a collection in memory with the real
// `vault.ts` and the real plugin runtime: with the built in in use the
// queue is the one made afresh from the files; with the sample scheduler
// chosen (`plugins/recall-sample`, from the corpus) the cards it scored are
// due and ordered by recall against their target while a new card, a card
// in its steps and the reading are where they were; the choice is kept in
// `.ilmi/scheduler.json`; a grade still writes the built in's state to the
// card's `sr` line and is never held up; the buttons say the scheduler's
// own words; and a collection whose choice is not on the device says so
// once and schedules with the built in.

import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { act, createElement } from 'react';
import { createRoot } from 'react-dom/client';
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';
import { formatReview, parse, parseReviews, type Card, type Review } from '../../format/index.js';
import { docItems, grade as builtIn, isDue, meterQueue, resolveOptions, type CardItem, type Grade, type QueueItem } from '../../schedule/index.js';
import { gapOfDue } from '../items.js';

const FIT = JSON.parse(readFileSync(join(import.meta.dirname, '../../schedule/__tests__/fsrs7-sample-fit.json'), 'utf8')) as { w: number[] };
const SAMPLE = join(import.meta.dirname, '../../format/__tests__/corpus/vault/.ilmi/plugins/recall-sample');
const ROOT = '/collections/slot';
const DECK = 'deck.md';

type StoreFs = import('../../vault/index.js').StoreFs;
let fs: StoreFs;
const clock = { t: new Date('2026-11-10T12:00:00Z').getTime() };
const now = () => new Date(clock.t);

vi.mock('../clock.js', () => ({ appNow: () => new Date(clock.t), setClockDay: () => {} }));
const fits = vi.hoisted(() => ({ asked: [] as { t: number; g: number }[][][], answer: null as unknown }));
vi.mock('@tauri-apps/api/core', () => ({
  invoke: async (cmd: string, args?: { cards?: { t: number; g: number }[][] }) => {
    if (cmd === 'platform') return { mobile: false, documents: null };
    if (cmd === 'fsrs_fit') { fits.asked.push(args!.cards!); return fits.answer; }
    return null;
  },
}));
vi.mock('../collections.js', async (orig) => ({ ...(await orig<typeof import('../collections.js')>()), collectionFs: () => fs }));
vi.mock('../crdt.js', async (orig) => ({ ...(await orig<typeof import('../crdt.js')>()), startCrdt: async () => true, stopCrdt: () => {} }));
vi.mock('../keep.js', async (orig) => ({ ...(await orig<typeof import('../keep.js')>()), startMirror: async () => {}, stopMirror: () => {}, keepDatedSoon: () => {}, stopDated: () => {} }));
vi.mock('@tauri-apps/plugin-log', async (orig) => ({ ...(await orig<typeof import('@tauri-apps/plugin-log')>()), info: async () => {} }));

const { memStore } = await import('../../vault/mem-store.js');
const { storeFs } = await import('../../vault/index.js');
const { closeVault, currentVault, openVault } = await import('../vault.js');
const { gradeCard } = await import('../grading.js');
const { chooseScheduler, fitOffer, fitToReviews, fsrs7Fit, schedulerSlot, stopPlugins, useSlotGaps } = await import('../../plugins/index.js');
const { useApp } = await import('../store.js');

const sr = (id: string, due: string, last: string) => `^${id}\n<!-- sr due=${due} st=review s=20 d=5 r=2 l=0 ivl=20 last=${last} -->`;
// a: passed twice, last four days ago: half-life 4d, recall 0.5 (the built in says not for ten days)
// b: passed twice, last six hours ago: recall 0.96, not due (the built in says overdue)
// c: failed last, two days ago: half-life 1d, recall 0.25 (the built in says not for two weeks)
// e: the file says reviewed, the log has no line of it: the sample has no word, and it is the built in's
const TEXT = `---
type: deck
read: due=2026-11-01
---

something to read first

a :: 1 ${sr('a', '2026-11-20', '2026-11-06T12:00:00Z')}

b :: 2 ${sr('b', '2026-11-01', '2026-11-10T06:00:00Z')}

c :: 3 ${sr('c', '2026-11-25', '2026-11-08T12:00:00Z')}

fresh :: never seen

steps :: in them ^s
<!-- sr due=2026-11-10T11:55:00Z st=learning s=1 d=5 r=1 l=0 ivl=0 last=2026-11-10T11:45:00Z -->

e :: 5, in the file but not in the log ${sr('e', '2026-11-02', '2026-10-13T12:00:00Z')}
`;
const rev = (card: string, at: string, g: Review['g']): Review => ({ at, doc: DECK, card, g, st: 'review', elapsed: 1, ivl: 1, next: 2 });
const LOG = [
  rev('a', '2026-11-01T12:00:00Z', 3), rev('a', '2026-11-06T12:00:00Z', 3),
  rev('b', '2026-11-05T06:00:00Z', 3), rev('b', '2026-11-10T06:00:00Z', 3),
  rev('c', '2026-11-03T12:00:00Z', 3), rev('c', '2026-11-08T12:00:00Z', 1),
];

const put = async (rel: string, text: string) => {
  const abs = `${ROOT}/${rel}`;
  await fs.mkdir(abs.slice(0, abs.lastIndexOf('/')));
  await fs.writeText(abs, text);
};
const queue = (): QueueItem[] => useApp.getState().queue;
const cards = (): CardItem[] => queue().filter((i): i is CardItem => i.kind === 'card');
const due = (): string[] => queue().filter((i) => isDue(i, now())).map((i) => (i.kind === 'card' ? i.id ?? i.text.split(' ')[0]! : i.kind));
const said = (): string[] => useApp.getState().log;
/** What the slot asked for is in, and the queue built over it. */
const settled = async () => {
  for (let i = 0; i < 3; i++) {
    await new Promise((r) => setTimeout(r, 0));
    await schedulerSlot()?.idle();
    await new Promise((r) => setTimeout(r, 0));
  }
};
/** The queue made afresh from the file by the built in alone. */
const afresh = async (): Promise<string[]> => {
  const doc = (await currentVault()!.read(DECK)).doc;
  const metaOf = () => undefined;
  const list = meterQueue(docItems(DECK, doc, now()), now(), { optionsOf: (p) => resolveOptions(p, metaOf) });
  return list.filter((i) => isDue(i, now())).map((i) => (i.kind === 'card' ? i.id ?? i.text.split(' ')[0]! : i.kind));
};

beforeAll(async () => {
  vi.spyOn(console, 'error').mockImplementation(() => {});
  fs = storeFs(memStore(), ROOT);
  await put(DECK, TEXT);
  await put('.ilmi/reviews/2026-11.jsonl', `${LOG.map(formatReview).join('\n')}\n`);
  for (const name of ['plugin.json', 'main.js']) await put(`.ilmi/plugins/recall-sample/${name}`, readFileSync(join(SAMPLE, name), 'utf8'));
  await put('.ilmi/plugins.json', '["recall-sample"]');
  await openVault(ROOT);
  await settled();
});
afterAll(() => { stopPlugins(); closeVault(); });

describe('the queue under the scheduler slot', () => {
  it('with the built in, the queue is the one made from the files; the sample is on the row, not in use', async () => {
    expect(schedulerSlot()!.rows()).toEqual([{ id: 'fsrs-7', name: 'fsrs-7', owner: null }, { id: 'recall-sample', name: 'recall sample', owner: 'recall-sample' }]);
    expect(schedulerSlot()!.active()).toBeNull();
    expect([...due()].sort()).toEqual([...(await afresh())].sort());
    expect(due()).toEqual(expect.arrayContaining(['b', 'e', 'fresh', 's', 'read']));
    expect(due()).not.toContain('a');
    expect(cards().every((i) => i.slot === undefined)).toBe(true);
    expect(said()).toEqual([]);
  });

  it('chosen, its cards are due by recall against their target, lowest first; what is not its is as it was', async () => {
    const before = due();
    await chooseScheduler('recall-sample');
    await settled();
    expect(JSON.parse(await fs.readText(`${ROOT}/.ilmi/scheduler.json`))).toEqual({ scheduler: 'recall-sample' });
    const by = Object.fromEntries(cards().map((i) => [i.id ?? 'fresh', i]));
    // a and c have fallen to a half and a quarter; b was reviewed this morning
    expect(by.a!.slot!.recall).toBeCloseTo(0.5);
    expect(by.c!.slot!.recall).toBeCloseTo(0.25);
    expect(by.b!.slot!.recall).toBeCloseTo(0.5 ** (0.25 / 4));
    expect([isDue(by.a!, now()), isDue(by.b!, now()), isDue(by.c!, now())]).toEqual([true, false, true]);
    // b is ahead on the day its curve reaches 0.9: 0.608 days after its review, so tomorrow
    expect(by.b!.due).toBe('2026-11-11');
    // of the cards it scored, the lower recall comes first
    const order = due();
    expect(order.indexOf('c')).toBeLessThan(order.indexOf('a'));
    // a card the log has no review of is left to the built in (the sample has no word), as the new card and the steps are
    expect(by.e!.slot).toBeUndefined();
    for (const id of ['e', 'fresh', 's', 'read']) expect(order).toContain(id);
    expect(before.filter((id) => !['a', 'b', 'c'].includes(id)).every((id) => order.includes(id))).toBe(true);
    expect(said()).toEqual([]);
  });

  it('the buttons say when the scheduler would bring the card back, not the built in\'s days', async () => {
    const a = cards().find((i) => i.id === 'a')!;
    let gaps: Record<Grade, string> | undefined;
    const Probe = () => { gaps = useSlotGaps(a, a.sched, now()); return null; };
    const el = document.createElement('div');
    const root = createRoot(el);
    (globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
    await act(async () => { root.render(createElement(Probe)); });
    await act(async () => { await settled(); });
    // hard, good, easy: a half-life of eight days, 1.2 days to 0.9. again puts the card in its steps, which are the app's
    expect(gaps).toEqual({ 1: '10m', 2: '1d', 3: '1d', 4: '1d' });
    // a card that is the built in's has no words from here
    const fresh = cards().find((i) => i.id === undefined)!;
    let none: Record<Grade, string> | undefined = { 1: 'x', 2: 'x', 3: 'x', 4: 'x' };
    const Other = () => { none = useSlotGaps(fresh, fresh.sched, now()); return null; };
    await act(async () => { root.render(createElement(Other)); });
    expect(none).toBeUndefined();
    await act(async () => { root.unmount(); });
    expect(gapOfDue('2026-11-10T12:07:00Z', now())).toBe('7m');
    expect(gapOfDue('2026-11-13', now())).toBe('3d');
    expect(gapOfDue('2027-03-10T12:00:00Z', now())).toBe('4mo');
  });

  it('a grade writes the built in\'s state to the card\'s line at once, and the scheduler hears of it after', async () => {
    const a = cards().find((i) => i.id === 'a')!;
    const from = a.sched!;
    clock.t += 60_000;
    await gradeCard(a, 3, now(), 1500);
    // the line is the built in's own, as if no scheduler were chosen
    const card = (await currentVault()!.read(DECK)).doc.blocks.find((b): b is Card => b.kind === 'card' && b.id === 'a')!;
    expect(card.sched).toEqual(builtIn(from, 3, now(), { request_retention: 0.9 }));
    expect(parse(await fs.readText(`${ROOT}/${DECK}`)).doc.blocks.find((b): b is Card => b.kind === 'card' && b.id === 'a')!.sched).toEqual(card.sched);
    // before the scheduler has said anything of the card as it now is, it is not due: the old score is not its
    expect(due()).not.toContain('a');
    await settled();
    const logged = parseReviews(await fs.readText(`${ROOT}/.ilmi/reviews/2026-11.jsonl`));
    expect(logged.filter((r) => r.card === 'a').length).toBe(3);
    const again = cards().find((i) => i.id === 'a')!;
    expect(again.slot!.recall).toBeCloseTo(1, 3);
    expect(isDue(again, now())).toBe(false);
    expect(due()).toContain('c');
  });

  it('back to the built in, the queue is the one made from the files again', async () => {
    await chooseScheduler(null);
    await settled();
    expect(JSON.parse(await fs.readText(`${ROOT}/.ilmi/scheduler.json`))).toEqual({});
    expect(cards().every((i) => i.slot === undefined)).toBe(true);
    expect([...due()].sort()).toEqual([...(await afresh())].sort());
  });

  it('fsrs-7, which the app carries: the cards whose history the log has whole are due by its recall, the rest by the built in', async () => {
    await chooseScheduler('fsrs-7');
    await settled();
    expect(schedulerSlot()!.active()?.id).toBe('fsrs-7');
    const by = Object.fromEntries(cards().map((i) => [i.id ?? 'fresh', i]));
    // the log has no first review (`st` new) of a, b or c, and none at all of e: no word on any, so the queue is the built in's
    expect(cards().every((i) => i.slot === undefined)).toBe(true);
    expect([...due()].sort()).toEqual([...(await afresh())].sort());
    // a card learnt here from its first review on is fsrs-7's once it is out of its steps
    const fresh = cards().find((i) => i.id === undefined)!;
    await gradeCard(fresh, 4, now(), 900);
    await settled();
    const learnt = cards().find((i) => i.text.startsWith('fresh'))!;
    expect(learnt.sched).toMatchObject({ state: 'review', reps: 1 });
    expect(learnt.slot!.recall).toBeCloseTo(1, 2);
    expect(isDue(learnt, now())).toBe(false);
    expect(by.a!.slot).toBeUndefined();
    expect(said()).toEqual([]);
  });

  it('fit to my reviews: not offered until the log has enough, then the weights are kept in the collection with what they came from', async () => {
    expect(fitOffer()).toEqual({ items: 0, enough: false });
    expect(await fitToReviews()).toBe(false);
    expect(fits.asked).toEqual([]);
    expect(said()[0]).toBe('fsrs-7 fits from 64 reviews of cards seen before; 0 so far');
    // a log with enough in it: seventy cards learnt and seen again
    const lines: Review[] = [];
    for (let i = 0; i < 70; i++) {
      lines.push({ ...rev(`k${i}`, `2026-10-01T08:00:${String(i % 60).padStart(2, '0')}Z`, 3), st: 'new' }, rev(`k${i}`, `2026-10-0${2 + (i % 7)}T08:00:00Z`, i % 5 ? 3 : 1));
    }
    stopPlugins();
    closeVault();
    await put('.ilmi/reviews/2026-10.jsonl', `${lines.map(formatReview).join('\n')}\n`);
    await openVault(ROOT);
    await settled();
    expect(fitOffer()).toEqual({ items: 70, enough: true });
    // the optimiser found too little in it: nothing is kept
    fits.answer = { w: FIT.w, items: 70, fitted: false };
    expect(await fitToReviews()).toBe(false);
    expect(fsrs7Fit()).toBeNull();
    expect(said()[0]).toBe('too little to fit from yet; fsrs-7 keeps the weights it had');
    // fitted: each card's reviews went over as seconds and grades, and the weights are in the file, to four decimals
    fits.answer = { w: FIT.w, items: 70, fitted: true };
    expect(await fitToReviews()).toBe(true);
    const sent = fits.asked[fits.asked.length - 1]!;
    expect(sent.length).toBe(71);
    expect(sent.find((c) => c.length === 2 && c[0]!.t === Date.parse('2026-10-01T08:00:00Z') / 1000)!.map((r) => r.g)).toEqual([3, 1]);
    const file = JSON.parse(await fs.readText(`${ROOT}/.ilmi/scheduler.json`)) as { scheduler: string; fsrs7: { w: number[]; reviews: number; fitted: string } };
    expect(file.scheduler).toBe('fsrs-7');
    expect(file.fsrs7).toEqual({ w: FIT.w.map((x) => Math.round(x * 1e4) / 1e4), reviews: 141, fitted: '2026-11-10' });
    expect(fsrs7Fit()).toEqual(file.fsrs7);
    expect(said()[0]).toBe('fsrs-7 fitted to 141 reviews');
    // and they are what it answers by after the collection is opened again
    stopPlugins();
    closeVault();
    await openVault(ROOT);
    await settled();
    expect(fsrs7Fit()).toEqual(file.fsrs7);
    expect(schedulerSlot()!.active()?.id).toBe('fsrs-7');
  });

  it('a collection whose choice is not on this device says so once, and the built in schedules', async () => {
    await chooseScheduler('recall-sample');
    await settled();
    stopPlugins();
    closeVault();
    await put('.ilmi/plugins.json', '[]');
    await openVault(ROOT);
    await settled();
    expect(said()[0]).toBe('scheduler recall-sample is not on this device; built in schedules here');
    expect(said().filter((l) => l.includes('not on this device')).length).toBe(1);
    expect([schedulerSlot()!.choice(), schedulerSlot()!.active(), schedulerSlot()!.standingIn()]).toEqual(['recall-sample', null, true]);
    expect(cards().every((i) => i.slot === undefined)).toBe(true);
    expect([...due()].sort()).toEqual([...(await afresh())].sort());
    // the choice is still the collection's: nothing here rewrote it, and choosing another kept the fit that was there
    const file = JSON.parse(await fs.readText(`${ROOT}/.ilmi/scheduler.json`)) as { scheduler: string; fsrs7: { reviews: number } };
    expect([file.scheduler, file.fsrs7.reviews]).toEqual(['recall-sample', 141]);
  });
});
