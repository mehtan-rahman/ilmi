// @vitest-environment jsdom
//
// The scheduler slot's runtime: what registers and what a collection has
// chosen, the choice that is not on this device said once, the log handed
// over (`prepare` whole and in one order, `observe` a review at a time), a
// queue's cards scored a little after they are asked about with the last
// scores kept meanwhile, both kinds (recall with a curve, a date after a
// grade), the buttons' outcomes, and the fall back to the built in when a
// scheduler throws, answers something else, or is slow. Then the same
// through a plugin: the sample scheduler from the corpus collection, a
// plugin written for api 1 beside it, a plugin whose scheduler throws, and
// the cache.

import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import type { Review } from '../../format/index.js';
import type { SchedCard, Scheduler } from '../../schedule/index.js';
import { PluginHost, type Bridge } from '../runtime.js';
import { SchedulerSlot, chosenIn, formatSchedulerFile, parseSchedulerFile, type SlotBridge } from '../scheduler.js';
import { ROOT, Vault, addPlugin, enable, fakeBridge, memFs, seed, sleep, type FakeBridge, type MemFs } from './memfs.js';

const NOW = new Date('2026-11-10T12:00:00Z');
const DAY = 86_400_000;

interface Rig extends SlotBridge {
  notices: string[];
  changes: number;
  at: Date;
  failures: [string, string][];
}

function rig(): Rig {
  const r: Rig = {
    notices: [],
    changes: 0,
    at: NOW,
    failures: [],
    notice: (t) => r.notices.push(t),
    changed: () => { r.changes++; },
    now: () => r.at,
  };
  return r;
}

const review = (card: string, at: string, g: Review['g'] = 3, key?: string): Review => ({ at, doc: 'deck.md', card, g, st: 'review', elapsed: 1, ivl: 1, next: 2, ...(key ? { key } : {}) });
const card = (id: string, history: Review[] = [], more: Partial<SchedCard> = {}): SchedCard => ({
  path: 'deck.md', id, block: 0, retention: 0.9, history,
  fsrs: { due: '2026-11-12', state: 'review', reps: history.length || 1, ...(history.length ? { last: history[history.length - 1]!.at } : {}) },
  ...more,
});
const fast = { debounce: 0, timeout: 60, prepareTimeout: 60 };

describe('who is here and who is chosen', () => {
  it('a scheduler needs an id, a name, and recall or next; one id is one scheduler', () => {
    const slot = new SchedulerSlot(rig());
    const ok: Scheduler = { id: 'half-life', name: 'half life', recall: () => [] };
    expect(() => slot.register(null, { ...ok, id: 'Half Life' })).toThrow(/an id of lowercase/);
    expect(() => slot.register(null, { ...ok, id: 'built-in' })).toThrow(/an id of lowercase/);
    expect(() => slot.register(null, { ...ok, name: ' ' })).toThrow(/a name/);
    expect(() => slot.register(null, { id: 'x', name: 'x' })).toThrow(/recall or next/);
    const off = slot.register('plug', ok);
    expect(() => slot.register(null, ok)).toThrow(/already here/);
    expect(slot.rows()).toEqual([{ id: 'half-life', name: 'half life', owner: 'plug' }]);
    off();
    off();
    expect(slot.rows()).toEqual([]);
    slot.register(null, { id: 'dates', name: 'dates', next: () => null });
    expect(slot.rows().map((r) => r.id)).toEqual(['dates']);
  });

  it('nothing chosen is the built in; the one chosen is in use once it is here', () => {
    const r = rig();
    const slot = new SchedulerSlot(r);
    slot.register(null, { id: 'a', name: 'a', recall: () => [] });
    expect([slot.choice(), slot.active(), slot.standingIn()]).toEqual([null, null, false]);
    slot.choose('a');
    expect(slot.active()?.id).toBe('a');
    slot.choose(null);
    expect([slot.active(), slot.standingIn()]).toEqual([null, false]);
    expect(r.notices).toEqual([]);
  });

  it('a choice that is not on this device is said once, and the built in schedules; it takes over when it comes', () => {
    const r = rig();
    const slot = new SchedulerSlot(r);
    slot.choose('neural');
    expect(r.notices).toEqual([]);
    slot.settle();
    slot.settle();
    expect(r.notices).toEqual(['scheduler neural is not on this device; built in schedules here']);
    expect([slot.active(), slot.standingIn(), slot.choice()]).toEqual([null, true, 'neural']);
    const before = r.changes;
    slot.register('plug', { id: 'neural', name: 'neural', recall: () => [] });
    expect(slot.active()?.id).toBe('neural');
    expect(slot.standingIn()).toBe(false);
    expect(r.changes).toBe(before + 1);
    slot.settle();
    expect(r.notices.length).toBe(1);
  });

  it('the choice is one key of a file that keeps what else it holds, its keys in order', () => {
    expect(chosenIn(parseSchedulerFile('{"scheduler":"fsrs-7","fsrs7":{"w":[1]}}'))).toBe('fsrs-7');
    expect(chosenIn(parseSchedulerFile('{"scheduler":"Not An Id"}'))).toBeNull();
    expect(chosenIn(parseSchedulerFile('not json'))).toBeNull();
    expect(chosenIn(parseSchedulerFile('[1]'))).toBeNull();
    expect(chosenIn(parseSchedulerFile(null))).toBeNull();
    expect(formatSchedulerFile({ scheduler: 'a', later: { b: 1 }, fsrs7: undefined })).toBe('{\n  "later": {\n    "b": 1\n  },\n  "scheduler": "a"\n}\n');
  });
});

describe('scores', () => {
  it('the cards the queue asked about are scored a little later, and the queue is told', async () => {
    const r = rig();
    const slot = new SchedulerSlot(r, fast);
    const asked: string[][] = [];
    const at: Date[] = [];
    slot.register(null, { id: 'a', name: 'a', recall: (cards, ctx) => { asked.push(cards.map((c) => c.id)); at.push(ctx.now); return cards.map((c) => (c.id === 'x' ? 0.5 : 0.97)); } });
    slot.choose('a');
    const cards = [card('x', [review('x', '2026-11-01T09:00:00Z')]), card('y', [review('y', '2026-11-02T09:00:00Z')])];
    slot.request(cards);
    expect(slot.scored()).toBe(false);
    const before = r.changes;
    await slot.idle();
    expect(asked).toEqual([['x', 'y']]);
    expect(at).toEqual([NOW]);
    expect(slot.scoreOf('x', undefined, '2026-11-01T09:00:00Z')).toEqual({ last: '2026-11-01T09:00:00Z', recall: 0.5 });
    expect(slot.scoreOf('y', undefined, '2026-11-02T09:00:00Z')?.recall).toBe(0.97);
    expect(r.changes).toBe(before + 1);
    // the queue built again over the same cards asks nothing; ten minutes on it does, and a flip in what is due tells the queue
    slot.request(cards);
    await slot.idle();
    expect(asked.length).toBe(1);
    r.at = new Date(NOW.getTime() + 11 * 60_000);
    slot.request(cards);
    await slot.idle();
    expect(asked.length).toBe(2);
    expect(r.changes).toBe(before + 1);
  });

  it('a score is the line\'s as it was asked: after a grade it is no score until the next comes', async () => {
    const slot = new SchedulerSlot(rig(), fast);
    slot.register(null, { id: 'a', name: 'a', recall: (cards) => cards.map(() => 0.5) });
    slot.choose('a');
    slot.request([card('x', [review('x', '2026-11-01T09:00:00Z')])]);
    await slot.idle();
    expect(slot.scoreOf('x', undefined, '2026-11-01T09:00:00Z')).toBeDefined();
    expect(slot.scoreOf('x', undefined, '2026-11-10T12:00:00Z')).toBeUndefined();
    expect(slot.scoreOf('x', 'r', '2026-11-01T09:00:00Z')).toBeUndefined();
  });

  it('the last scores are kept while new ones are on their way', async () => {
    const slot = new SchedulerSlot(rig(), { ...fast, timeout: 2000 });
    let wait = 0;
    slot.register(null, { id: 'a', name: 'a', recall: async (cards) => { await sleep(wait); return cards.map(() => (wait ? 0.2 : 0.8)); } });
    slot.choose('a');
    const x = card('x', [review('x', '2026-11-01T09:00:00Z')]);
    slot.request([x]);
    await slot.idle();
    wait = 60;
    slot.request([x, card('y', [review('y', '2026-11-02T09:00:00Z')])]);
    await sleep(20);
    expect(slot.scoreOf('x', undefined, x.fsrs!.last)?.recall).toBe(0.8);
    await slot.idle();
    expect(slot.scoreOf('x', undefined, x.fsrs!.last)?.recall).toBe(0.2);
  });

  it('no word on a card leaves it to the built in', async () => {
    const slot = new SchedulerSlot(rig(), fast);
    slot.register(null, { id: 'a', name: 'a', recall: () => [null, 0.4, Number.NaN] });
    slot.choose('a');
    slot.request([card('x', [review('x', '2026-11-01T09:00:00Z')]), card('y', [review('y', '2026-11-01T09:00:00Z')]), card('z', [review('z', '2026-11-01T09:00:00Z')])]);
    await slot.idle();
    expect(slot.scoreOf('x', undefined, '2026-11-01T09:00:00Z')).toBeUndefined();
    expect(slot.scoreOf('y', undefined, '2026-11-01T09:00:00Z')?.recall).toBe(0.4);
    expect(slot.scoreOf('z', undefined, '2026-11-01T09:00:00Z')).toBeUndefined();
  });

  it('with a curve, a card not due yet has the day its recall reaches its target', async () => {
    const slot = new SchedulerSlot(rig(), fast);
    const calls: number[] = [];
    const at = (c: SchedCard, t: number) => 0.5 ** ((t - Date.parse(c.history[c.history.length - 1]!.at)) / DAY / 400);
    slot.register(null, {
      id: 'a', name: 'a',
      recall: (cards, { now }) => cards.map((c) => at(c, now.getTime())),
      curve: (c, days, { now }) => { calls.push(days.length); return days.map((d) => at(c, now.getTime() + d * DAY)); },
    });
    slot.choose('a');
    // reviewed at noon ten days ago: recall is 0.9 after 60.8 days, so on the 51st whole day from now
    slot.request([card('x', [review('x', '2026-10-31T12:00:00Z')])]);
    await slot.idle();
    const s = slot.scoreOf('x', undefined, '2026-10-31T12:00:00Z')!;
    expect(s.recall).toBeCloseTo(0.5 ** (10 / 400));
    expect(s.due).toBe('2026-12-31');
    // the grid, then the days between the two it crossed between (50 and 62), halved: 56, 53, 51
    expect(calls).toEqual([35, 1, 1, 1]);
  });

  it('by a date: `next` as of the last review, from the reviews before it, once a review', async () => {
    const slot = new SchedulerSlot(rig(), fast);
    const seen: { history: number; grade: number; now: string; fsrs: boolean }[] = [];
    slot.register(null, {
      id: 'dates', name: 'dates',
      next: (c, grade, { now }) => {
        seen.push({ history: c.history.length, grade, now: now.toISOString(), fsrs: 'fsrs' in c });
        return grade === 1 ? null : { due: new Date(now.getTime() + (c.history.length + 1) * 10 * DAY) };
      },
    });
    slot.choose('dates');
    const x = card('x', [review('x', '2026-10-01T09:00:00Z', 3), review('x', '2026-11-01T09:00:00Z', 4)]);
    const y = card('y', [review('y', '2026-11-03T09:00:00Z', 1)]);
    const z = card('z');
    slot.request([x, y, z]);
    await slot.idle();
    expect(seen).toEqual([{ history: 1, grade: 4, now: '2026-11-01T09:00:00.000Z', fsrs: false }, { history: 0, grade: 1, now: '2026-11-03T09:00:00.000Z', fsrs: false }]);
    expect(slot.scoreOf('x', undefined, x.fsrs!.last)).toEqual({ last: x.fsrs!.last, due: '2026-11-21T09:00:00Z' });
    // no word on y (null), none to ask of z (the log has no review of it): the built in's
    expect(slot.scoreOf('y', undefined, y.fsrs!.last)).toBeUndefined();
    expect(slot.scoreOf('z', undefined, undefined)).toBeUndefined();
    // asked again of the same reviews, nothing is worked out twice
    slot.request([x, y]);
    await slot.idle();
    expect(seen.length).toBe(2);
  });

  it('the buttons\' outcomes are the scheduler\'s, or none', async () => {
    const slot = new SchedulerSlot(rig(), fast);
    const x = card('x', [review('x', '2026-11-01T09:00:00Z')]);
    expect(await slot.preview(x)).toBeNull();
    slot.register(null, { id: 'bare', name: 'bare', recall: () => [] });
    slot.register(null, {
      id: 'full', name: 'full', recall: () => [],
      preview: (c, { now }) => (c.id === 'x' ? { 1: { due: new Date(now.getTime() + 600_000) }, 2: { due: '2026-11-11' }, 3: { due: '2026-11-15' }, 4: { due: '2026-12-01T00:00:00Z' } } : null),
    });
    slot.choose('bare');
    expect(await slot.preview(x)).toBeNull();
    slot.choose('full');
    expect(await slot.preview(x)).toEqual({ 1: '2026-11-10T12:10:00Z', 2: '2026-11-11', 3: '2026-11-15', 4: '2026-12-01T00:00:00Z' });
    expect(await slot.preview(card('y'))).toBeNull();
  });
});

describe('the log', () => {
  it('prepared whole and in one order before anything is asked, then observed a review at a time', async () => {
    const slot = new SchedulerSlot(rig(), fast);
    const told: string[] = [];
    slot.register(null, {
      id: 'a', name: 'a',
      prepare: async (history) => { await sleep(15); told.push(`prepare ${history.map((r) => `${r.card}@${r.at.slice(8, 10)}`).join(' ')}`); },
      observe: (r) => { told.push(`observe ${r.card}@${r.at.slice(8, 10)}`); },
      recall: (cards) => { told.push(`recall ${cards.map((c) => `${c.id}:${c.history.length}`).join(' ')}`); return cards.map(() => 0.5); },
    });
    const a1 = review('a', '2026-11-02T09:00:00Z');
    const b1 = review('b', '2026-11-01T09:00:00Z');
    let log = [a1, b1];
    slot.setLog(log);
    slot.choose('a');
    const cardsNow = () => ['a', 'b'].map((id) => card(id, [...(slot.histories().get(`${id}\n`) ?? [])]));
    slot.request(cardsNow());
    await slot.idle();
    expect(told).toEqual(['prepare b@01 a@02', 'recall a:1 b:1']);
    // a review added at the end is observed; the card's history has it
    const a2 = review('a', '2026-11-10T11:00:00Z', 1);
    log = [...log, a2];
    slot.setLog(log);
    slot.request(cardsNow());
    await slot.idle();
    expect(told.slice(2)).toEqual(['observe a@10', 'recall a:2 b:1']);
    // a log that changed any other way (a sync brought an older review in) is prepared again
    const b0 = review('b', '2026-10-20T09:00:00Z');
    slot.setLog([b0, ...log]);
    slot.request(cardsNow());
    await slot.idle();
    expect(told.slice(4)).toEqual(['prepare b@20 b@01 a@02 a@10', 'recall a:2 b:2']);
  });

  it('the first log a scheduler in use is handed is prepared whole, not observed a review at a time', async () => {
    const slot = new SchedulerSlot(rig(), fast);
    const told: string[] = [];
    slot.register(null, { id: 'a', name: 'a', prepare: (h) => { told.push(`prepare ${h.length}`); }, observe: () => { told.push('observe'); }, recall: () => [] });
    slot.choose('a');
    slot.setLog([review('a', '2026-11-02T09:00:00Z'), review('b', '2026-11-03T09:00:00Z')]);
    await slot.idle();
    expect(told).toEqual(['prepare 0', 'prepare 2']);
    expect(slot.histories().size).toBe(2);
  });

  it('a log that moved on under the built in is the log a scheduler chosen later is prepared with', async () => {
    const slot = new SchedulerSlot(rig(), fast);
    let got = -1;
    slot.register(null, { id: 'a', name: 'a', prepare: (h) => { got = h.length; }, recall: () => [] });
    slot.setLog([review('a', '2026-11-02T09:00:00Z')]);
    slot.setLog([review('a', '2026-11-02T09:00:00Z'), review('a', '2026-11-03T09:00:00Z')]);
    expect(slot.histories().size).toBe(0);
    slot.choose('a');
    await slot.idle();
    expect(got).toBe(2);
    expect(slot.histories().get('a\n')?.length).toBe(2);
  });
});

describe('a scheduler that fails', () => {
  const x = card('x', [review('x', '2026-11-01T09:00:00Z')]);

  it('a throw: one notice naming it, its scores gone, the built in for the session', async () => {
    const r = rig();
    const slot = new SchedulerSlot(r, fast);
    let boom = false;
    slot.register(null, { id: 'a', name: 'half life', recall: (cards) => { if (boom) throw new Error('no model'); return cards.map(() => 0.5); } });
    slot.choose('a');
    slot.request([x]);
    await slot.idle();
    expect(slot.scored()).toBe(true);
    boom = true;
    r.at = new Date(NOW.getTime() + 20 * 60_000);
    const before = r.changes;
    slot.request([x]);
    await slot.idle();
    expect(r.notices).toEqual(['half life: no model; built in schedules for now']);
    expect([slot.active(), slot.standingIn(), slot.scored()]).toEqual([null, true, false]);
    expect(r.changes).toBe(before + 1);
    // asked again, nothing runs and nothing more is said
    slot.request([x]);
    slot.settle();
    await slot.idle();
    expect(r.notices.length).toBe(1);
    // chosen again by hand, it is tried again
    boom = false;
    slot.choose('a', true);
    slot.request([x]);
    await slot.idle();
    expect(slot.scoreOf('x', undefined, x.fsrs!.last)?.recall).toBe(0.5);
  });

  it('a slow one, one that answers for other cards than it was asked, a prepare that throws', async () => {
    for (const [spec, said] of [
      [{ recall: () => new Promise<number[]>(() => {}) }, /^slow: took over 0s; built in schedules for now$/],
      [{ recall: () => [0.5, 0.5] }, /^slow: recall answered 2 for 1 cards; built in schedules for now$/],
      [{ recall: () => [0.5], prepare: () => { throw new Error('bad weights'); } }, /^slow: bad weights; built in schedules for now$/],
      [{ recall: () => [0.99], curve: () => { throw new Error('no curve'); } }, /^slow: no curve; built in schedules for now$/],
      [{ next: async () => { throw new Error('no date'); } }, /^slow: no date; built in schedules for now$/],
    ] as [Partial<Scheduler>, RegExp][]) {
      const r = rig();
      const slot = new SchedulerSlot(r, fast);
      slot.register(null, { id: 'slow', name: 'slow', ...spec });
      slot.choose('slow');
      slot.request([x]);
      await slot.idle();
      expect(r.notices.length).toBe(1);
      expect(r.notices[0]).toMatch(said);
      expect(slot.active()).toBeNull();
      expect(slot.scored()).toBe(false);
    }
  });
});

// ── through a plugin ─────────────────────────────────────────────

describe('a plugin\'s scheduler', () => {
  let fs: MemFs;
  let vault: Vault;
  let bridge: FakeBridge & Bridge;
  let slot: SchedulerSlot;
  let host: PluginHost;
  let kept: Map<string, Uint8Array>;

  beforeEach(async () => {
    fs = memFs();
    await seed(fs, ['hello', 'recall-sample']);
    vault = await Vault.open(fs, ROOT);
    kept = new Map();
    const fake = fakeBridge();
    slot = new SchedulerSlot({ notice: fake.notice, changed: () => {}, now: () => NOW, fail: (owner, e) => host.failed(owner, e) }, fast);
    bridge = Object.assign(fake, {
      scheduler: { register: (plugin: string, spec: unknown) => slot.register(plugin, spec as Scheduler) },
      cache: {
        get: async (plugin: string, key: string) => kept.get(`${plugin}/${key}`) ?? null,
        put: async (plugin: string, key: string, bytes: Uint8Array) => { kept.set(`${plugin}/${key}`, bytes); },
        remove: async (plugin: string, key: string) => { kept.delete(`${plugin}/${key}`); },
      },
    });
    host = new PluginHost(vault, bridge);
  });

  afterEach(() => {
    host.stop();
    slot.stop();
    document.head.querySelectorAll('style[data-plugin]').forEach((el) => el.remove());
  });

  it('the sample registers through `ilmi.scheduler`, and scores by its half-lives once the collection chooses it', async () => {
    await enable(fs, ['hello', 'recall-sample']);
    await host.start();
    expect(bridge.notices).toEqual([]);
    expect(host.rows().map((r) => [r.id, r.state])).toEqual([['hello', 'on'], ['recall-sample', 'on']]);
    expect(slot.rows()).toEqual([{ id: 'recall-sample', name: 'recall sample', owner: 'recall-sample' }]);
    expect(slot.active()).toBeNull();
    slot.choose('recall-sample');
    // passed twice then: a half-life of four days; four days on, a half; failed last: one day, a sixteenth
    const x = card('x', [review('x', '2026-10-30T12:00:00Z', 3), review('x', '2026-11-06T12:00:00Z', 3)]);
    const y = card('y', [review('y', '2026-10-30T12:00:00Z', 3), review('y', '2026-11-06T12:00:00Z', 1)]);
    const z = card('z');
    slot.request([x, y, z]);
    await slot.idle();
    expect(slot.scoreOf('x', undefined, x.fsrs!.last)?.recall).toBeCloseTo(0.5);
    expect(slot.scoreOf('y', undefined, y.fsrs!.last)?.recall).toBeCloseTo(1 / 16);
    expect(slot.scoreOf('z', undefined, undefined)).toBeUndefined();
    // graded good now it would be back when recall is 0.9 again: eight days of half-life, 1.216 days
    const dues = (await slot.preview(x))!;
    expect(Date.parse(dues[3]) - NOW.getTime()).toBeCloseTo(8 * Math.log2(1 / 0.9) * DAY, -4);
    expect(Date.parse(dues[1]) - NOW.getTime()).toBeCloseTo(Math.log2(1 / 0.9) * DAY, -4);
    // turned off, it is out of the slot, and the built in schedules
    await host.setEnabled('recall-sample', false);
    expect(slot.rows()).toEqual([]);
    expect([slot.active(), slot.standingIn(), slot.scored()]).toEqual([null, true, false]);
  });

  it('a plugin written for api 1 runs as it did, and has the slot too', async () => {
    await addPlugin(fs, 'old', 'module.exports.activate = (ilmi) => { ilmi.scheduler.register({ id: "old-dates", name: "old dates", next: () => ({ due: "2026-12-01" }) }); ilmi.ui.notice("api " + ilmi.api + " for a manifest of " + ilmi.manifest.api); };');
    await enable(fs, ['old']);
    await host.start();
    expect(bridge.notices).toEqual(['api 2 for a manifest of 1']);
    expect(slot.rows().map((r) => r.id)).toEqual(['old-dates']);
  });

  it('a scheduler that throws is its plugin\'s failure: one notice naming it, the plugin off, the built in', async () => {
    await addPlugin(fs, 'bad', 'module.exports.activate = (ilmi) => { ilmi.scheduler.register({ id: "bad", name: "bad one", recall: () => { throw new Error("no weights"); } }); };');
    await enable(fs, ['bad']);
    await host.start();
    slot.choose('bad');
    slot.request([card('x', [review('x', '2026-11-01T09:00:00Z')])]);
    await slot.idle();
    expect(bridge.notices).toEqual(['bad: scheduler bad one: no weights; built in schedules for now']);
    expect(host.rows().find((r) => r.id === 'bad')).toMatchObject({ state: 'failed', enabled: true });
    expect([slot.rows(), slot.active(), slot.standingIn()]).toEqual([[], null, true]);
    slot.settle();
    expect(bridge.notices.length).toBe(1);
  });

  it('what is not a scheduler is refused as any other bad registration: the plugin fails', async () => {
    await addPlugin(fs, 'none', 'module.exports.activate = (ilmi) => { ilmi.scheduler.register({ id: "none", name: "none" }); };');
    await enable(fs, ['none']);
    await host.start();
    expect(bridge.notices).toEqual(['none: a scheduler needs recall or next']);
    expect(slot.rows()).toEqual([]);
  });

  it('a plugin keeps bytes on the device, by its own id', async () => {
    await addPlugin(fs, 'keeper', `module.exports.activate = async (ilmi) => {
      const was = await ilmi.cache.get('state.bin');
      await ilmi.cache.put('state.bin', new Uint8Array([1, 2, 3]));
      const now = await ilmi.cache.get('state.bin');
      await ilmi.cache.put('gone', new Uint8Array([9]));
      await ilmi.cache.remove('gone');
      ilmi.ui.notice(String(was) + ' then ' + Array.from(now).join(','));
      try { await ilmi.cache.put('text', 'abc'); } catch (e) { ilmi.ui.notice(e.message); }
    };`, { api: 2 });
    await enable(fs, ['keeper']);
    await host.start();
    expect(bridge.notices).toEqual(['null then 1,2,3', 'a cache keeps bytes (a Uint8Array)']);
    expect([...kept.keys()]).toEqual(['keeper/state.bin']);
    // and it is nowhere in the collection
    expect(await fs.has(`${ROOT}/.ilmi/plugins/keeper/state.bin`)).toBe(false);
  });
});
