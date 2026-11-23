// @vitest-environment jsdom
// A card graded into its learning or relearning steps (again; a new card
// good: due at an instant, minutes on) comes back before the session ends
// (`Session.tsx`), as Anki's does: appended after what is left, asked before
// its instant when nothing else is, however often it takes; each asking a
// review of its own, with its own line in the log. Over the sample as it
// ships, on 2026-11-02 by the app's clock, which stands still here: every
// grade is given in one second.

import { promises as fsp } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { act, createElement } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { meta as metaOf, type Card, type Review } from '../../format/index.js';
import { docItems, sortQueue, type CardItem, type QueueItem } from '../../schedule/index.js';
import { nodeFs } from '../../vault/node-fs.js';
import { Vault } from '../../vault/index.js';
import { emptyPanes, openTab } from '../panes.js';
import { useApp, type DocInfo } from '../store.js';

const SAMPLE = join(import.meta.dirname, '../../../samples/double-major');
const START = new Date('2026-11-02T09:00:00').getTime();
let vault: Vault;
let dir: string;
let all: QueueItem[] = [];
const docs: Record<string, DocInfo> = {};
/** The review log's lines, as they were recorded. */
const logged: Review[] = [];

vi.mock('../clock.js', () => ({ appNow: () => new Date(START), setClockDay: () => {} }));
vi.mock('../vault.js', async (orig) => {
  const real = await orig<typeof import('../vault.js')>();
  const { useApp: store } = await import('../store.js');
  return {
    ...real,
    currentVault: () => vault,
    recordReview: async (r: Review) => { logged.push(r); },
    note: () => {},
    openNode: () => {},
    refreshQueue: () => store.setState((s) => ({ queue: [...s.queue] })),
  };
});
const { Session } = await import('../Session.js');
const { inSteps } = await import('../grading.js');
(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
(globalThis as { ResizeObserver?: unknown }).ResizeObserver ??= class { observe() {} unobserve() {} disconnect() {} };

beforeAll(async () => {
  dir = await fsp.mkdtemp(join(tmpdir(), 'ilmi-returns-'));
  await fsp.cp(SAMPLE, dir, { recursive: true });
  vault = await Vault.open(nodeFs, dir);
  const now = new Date(START);
  for (const p of vault.documents()) {
    const doc = (await vault.read(p)).doc;
    const m = metaOf(doc);
    docs[p] = { type: m.type, frozen: m.frozen, cards: doc.blocks.filter((b) => b.kind === 'card').length, due: 0 };
    if (m.title !== undefined) docs[p]!.title = m.title;
    all.push(...docItems(p, doc, now));
  }
  all = sortQueue(all, now);
});
afterAll(async () => { vault.close(); await fsp.rm(dir, { recursive: true, force: true }); });

let host: HTMLDivElement;
let root: Root | null = null;
async function mount() {
  host = document.body.appendChild(document.createElement('div'));
  host.className = 'pane-body';
  root = createRoot(host);
  await act(async () => { root!.render(createElement(Session, { active: true, onOpen: () => {} })); });
}
function unmount() { if (root) { act(() => root!.unmount()); host.remove(); root = null; } }
beforeEach(() => { logged.length = 0; });
afterEach(() => { unmount(); });

const key = (k: string) => act(async () => { window.dispatchEvent(new KeyboardEvent('keydown', { key: k, bubbles: true, cancelable: true })); });
const settle = (ms = 40) => act(async () => { await new Promise((r) => setTimeout(r, ms)); });
/** The question up, answered and graded `g`, and its write landed. */
const grade = async (g: 1 | 2 | 3 | 4) => { await key(' '); await key(String(g)); await settle(); };
const count = () => host.querySelector('.sess-count')?.textContent;
const end = () => host.querySelector('.session-end')?.textContent;
const front = () => host.querySelector('.recall-wrap .card .face.front')?.textContent;
const revealed = () => host.querySelector<HTMLElement>('.recall-wrap .card')?.dataset.revealed;
/** The card's line in its file, as it is now. */
const line = async (c: CardItem) => {
  const doc = (await vault.read(c.path)).doc;
  return doc.blocks.find((b): b is Card => b.kind === 'card' && b.id === c.id)?.sched;
};

/** Cards reviewed before, due, one line each, with an id: a different three for each test (a test's grades stay in the file). */
let used = 0;
const reviewed = (n: number): CardItem[] => {
  const list = all.filter((i): i is CardItem => i.kind === 'card' && i.sched?.state === 'review' && i.groups === 1 && i.dir !== 'r' && i.id !== undefined && !i.link && i.dueAt.getTime() <= START);
  const out = list.slice(used, used + n);
  used += n;
  if (out.length < n) throw new Error('the sample has no more reviewed cards due');
  return out;
};
let seq = 500;
const start = async (items: QueueItem[], more: { cram?: boolean; practice?: boolean } = {}) => {
  useApp.setState({
    vault: dir, tree: vault.tree, files: vault.documents(), docs, order: vault.order, reveal: null, examFilter: null, log: [], budget: 0,
    learnNew: false, phone: false, queue: [], panes: openTab(emptyPanes(), ':session'), session: { seq: ++seq, items, ...more },
  });
  await mount();
};

describe('a card graded again', () => {
  it('comes back once the rest has had its turn, before its instant, and good there ends the session', async () => {
    const [a, b, c] = reviewed(3);
    const reps = (await line(a!))!.reps!;
    await start([a!, b!, c!]);
    expect(count()).toBe('1 / 3');
    const asked = front();
    await grade(1);
    // one more to the total, when the grade brings it
    expect(count()).toBe('2 / 4');
    expect(inSteps(await line(a!))).toBe(true);
    await grade(3);
    await grade(3);
    // nothing else is left: asked now, minutes before it is due, its question up
    expect(count()).toBe('4 / 4');
    expect(front()).toBe(asked);
    expect(revealed()).toBe('0');
    expect(host.querySelector('.cm-given')).toBeNull();
    await grade(3);
    // each card once
    expect(end()).toContain('all done, 3 items');
    // two reviews of it, each its own line in the log, in the order given, though given in one second
    const now = await line(a!);
    expect(now).toMatchObject({ state: 'review', reps: reps + 2 });
    expect(inSteps(now)).toBe(false);
    const mine = logged.filter((r) => r.card === a!.id);
    expect(mine.map((r) => [r.g, r.st])).toEqual([[1, 'review'], [3, 'relearning']]);
    expect(mine[1]!.at > mine[0]!.at).toBe(true);
    expect(mine.every((r) => r.over === undefined)).toBe(true);
    expect(logged).toHaveLength(4);
  });

  it('again on its return brings it back once more, until a grade moves it out of today', async () => {
    const [a, b] = reviewed(2);
    const reps = (await line(a!))!.reps!;
    await start([a!, b!]);
    await grade(1);
    await grade(3);
    expect(count()).toBe('3 / 3');
    await grade(1);
    expect(count()).toBe('4 / 4');
    await grade(1);
    expect(count()).toBe('5 / 5');
    await grade(3);
    expect(end()).toContain('all done, 2 items');
    expect(await line(a!)).toMatchObject({ state: 'review', reps: reps + 4 });
    const mine = logged.filter((r) => r.card === a!.id);
    expect(mine.map((r) => r.g)).toEqual([1, 1, 1, 3]);
    // four lines, no two of one second: the log keeps them apart
    expect(new Set(mine.map((r) => r.at)).size).toBe(4);
  });

  it('the only card of a session comes back at once', async () => {
    const [a] = reviewed(1);
    await start([a!]);
    await grade(1);
    expect(end()).toBeUndefined();
    expect(count()).toBe('2 / 2');
    await grade(4);
    expect(end()).toContain('all done, 1 item');
  });

  it('‹ back to its return, a grade there takes that grade\'s place: one review, one line', async () => {
    const [a] = reviewed(1);
    const reps = (await line(a!))!.reps!;
    await start([a!]);
    await grade(1);
    await grade(1);
    expect(count()).toBe('3 / 3');
    await key('[');
    expect(count()).toBe('2 / 3');
    expect(host.querySelector('.cm-given')?.textContent).toBe('graded again');
    // good in its place: out of today, so the return that grade brought is not asked, nor counted
    await key('3');
    await settle();
    expect(end()).toContain('all done, 1 item');
    expect(await line(a!)).toMatchObject({ state: 'review', reps: reps + 2 });
    const mine = logged.filter((r) => r.card === a!.id);
    expect(mine.map((r) => r.g)).toEqual([1, 1, 3]);
    // the third says which line it replaces: the second, the return's first grade
    expect(mine[2]!.over).toBe(mine[1]!.at);
    expect(mine[1]!.over).toBeUndefined();
  });

  it('a grade given again out of its steps takes the return out of the count, and into them puts it back', async () => {
    const [a, b] = reviewed(2);
    const reps = (await line(a!))!.reps!;
    await start([a!, b!]);
    await grade(1);
    expect(count()).toBe('2 / 3');
    await key('[');
    await key('3');
    await settle();
    expect(count()).toBe('2 / 2');
    expect(useApp.getState().session!.items).toHaveLength(3);
    await key('[');
    await key('1');
    await settle();
    expect(count()).toBe('2 / 3');
    await key('[');
    await key('4');
    await settle();
    expect(count()).toBe('2 / 2');
    await grade(3);
    expect(end()).toContain('all done, 2 items');
    // graded once, with the last
    expect(await line(a!)).toMatchObject({ state: 'review', reps: reps + 1, grade: 4 });
  });

  it('an asking whose return was graded keeps its grade: no grades there, space is on', async () => {
    const [a, b] = reviewed(2);
    await start([a!, b!]);
    await grade(1);
    await key(']');
    expect(count()).toBe('3 / 3');
    await grade(1);
    expect(count()).toBe('4 / 4');
    await key('['); await key('['); await key('[');
    expect(count()).toBe('1 / 4');
    expect(host.querySelector('.cm-given')?.textContent).toBe('graded again');
    expect(host.querySelector('.grades[data-locked="1"] .gap')?.textContent).toBe('asked again since');
    const was = logged.length;
    await key('4');
    await settle();
    expect(count()).toBe('1 / 4');
    expect(logged).toHaveLength(was);
    await key(' ');
    expect(count()).toBe('2 / 4');
  });

  it('its tab left and come back to, the return is still to come', async () => {
    const [a, b] = reviewed(2);
    await start([a!, b!]);
    await grade(1);
    unmount();
    await mount();
    expect(count()).toBe('2 / 3');
    await grade(3);
    unmount();
    await mount();
    expect(count()).toBe('3 / 3');
    expect(revealed()).toBe('0');
    await grade(3);
    expect(end()).toContain('all done, 2 items');
  });
});

describe('a card that is waiting to come back', () => {
  it('deleted meanwhile: no longer in the collection, space skips it', async () => {
    const [a, b] = reviewed(2);
    await start([a!, b!]);
    await grade(1);
    await act(async () => { await vault.update(a!.path, (doc) => { doc.blocks = doc.blocks.filter((x) => !(x.kind === 'card' && x.id === a!.id)); }); });
    await grade(3);
    await settle();
    expect(count()).toBe('3 / 3');
    expect(host.querySelector('.recall-wrap > .empty')?.textContent).toBe('no longer in the collection');
    await key('1');
    expect(count()).toBe('3 / 3');
    await key(' ');
    expect(end()).toContain('all done');
  });

  it('suspended meanwhile: it says so, and space is on', async () => {
    const [a, b] = reviewed(2);
    await start([a!, b!]);
    await grade(1);
    await act(async () => { await vault.update(a!.path, (doc) => { const x = doc.blocks.find((y): y is Card => y.kind === 'card' && y.id === a!.id)!; x.sched = { ...x.sched!, suspended: true }; }); });
    await grade(3);
    await settle();
    expect(host.querySelector('.grades[data-suspended="1"]')).not.toBeNull();
    const was = logged.length;
    await key('3');
    await key(' ');
    await settle();
    expect(end()).toContain('all done');
    expect(logged).toHaveLength(was);
  });

  it('s on a return suspends it as on any card: not graded, on to the end', async () => {
    const [a] = reviewed(1);
    await start([a!]);
    await grade(1);
    expect(count()).toBe('2 / 2');
    await key('s');
    await settle(80);
    expect(end()).toContain('all done, 1 item');
    expect((await line(a!))?.suspended).toBe(true);
    expect(logged.filter((r) => r.card === a!.id)).toHaveLength(1);
  });
});

describe('what does not bring a card back', () => {
  it('a grade that moves it on by days', async () => {
    const [a, b] = reviewed(2);
    await start([a!, b!]);
    await grade(2);
    expect(count()).toBe('2 / 2');
    await grade(4);
    expect(end()).toContain('all done, 2 items');
  });

  it('a session studied ahead (a cram): again is written, and each card is asked once', async () => {
    const [a, b] = reviewed(2);
    await start([a!, b!], { cram: true });
    await grade(1);
    expect(count()).toBe('2 / 2');
    expect(inSteps(await line(a!))).toBe(true);
    await grade(1);
    expect(end()).toContain('all done, 2 items');
    expect(useApp.getState().session!.items).toHaveLength(2);
  });

  it('practice: nothing is written, the buttons say nothing of the schedule, and again asks the card once more until it is good', async () => {
    const [a, b] = reviewed(2);
    const before = [await line(a!), await line(b!)];
    await start([a!, b!], { practice: true });
    expect(host.querySelector('.cm-practice')?.textContent).toBe('practice · not scheduled');
    const asked = front();
    await grade(1);
    expect(count()).toBe('2 / 3');
    await grade(3);
    // the card missed, asked again; missed again, once more
    expect(front()).toBe(asked);
    await grade(1);
    expect(count()).toBe('4 / 4');
    await grade(4);
    expect(end()).toContain('all done, 2 items');
    expect([await line(a!), await line(b!)]).toEqual(before);
    expect(logged).toHaveLength(0);
  });
});
