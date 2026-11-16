// @vitest-environment jsdom
// The sweep of the queue, the session and the inspector (2026-11-15): each
// test says what should happen, and fails until it does. Over the sample as
// it ships, on 2026-11-02 by the app's clock.

import { promises as fsp } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { act, createElement } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterAll, afterEach, beforeAll, describe, expect, it, vi } from 'vitest';
import { meta as metaOf } from '../../format/index.js';
import { docItems, sortQueue, type CardItem, type ExamAt, type QueueItem, type SectionItem } from '../../schedule/index.js';
import { nodeFs } from '../../vault/node-fs.js';
import { Vault } from '../../vault/index.js';
import { emptyPanes, openTab } from '../panes.js';
import { useApp, type DocInfo } from '../store.js';

const SAMPLE = join(import.meta.dirname, '../../../samples/double-major');
const clock = vi.hoisted(() => ({ t: new Date('2026-11-02T09:00:00').getTime() }));
const START = clock.t;
let vault: Vault;
let dir: string;
let all: QueueItem[] = [];
const docs: Record<string, DocInfo> = {};

vi.mock('../clock.js', () => ({ appNow: () => new Date(clock.t), setClockDay: () => {} }));
vi.mock('../vault.js', async (orig) => {
  const real = await orig<typeof import('../vault.js')>();
  const { useApp: store } = await import('../store.js');
  return {
    ...real,
    currentVault: () => vault,
    recordReview: async () => {},
    note: () => {},
    // the real one rebuilds from the open collection; here, the same items looked at again
    refreshQueue: () => store.setState((s) => ({ queue: [...s.queue] })),
  };
});
const { Session } = await import('../Session.js');
const { Queue } = await import('../Queue.js');
(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
(globalThis as { ResizeObserver?: unknown }).ResizeObserver ??= class { observe() {} unobserve() {} disconnect() {} };
// jsdom has no scrollIntoView: what was asked into view is kept, for the queue's cursor
const seen: Element[] = [];
(Element.prototype as { scrollIntoView?: unknown }).scrollIntoView = function (this: Element) { seen.push(this); };

beforeAll(async () => {
  dir = await fsp.mkdtemp(join(tmpdir(), 'ilmi-sweep-queue-'));
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
async function mount(el: React.ReactElement) {
  host = document.body.appendChild(document.createElement('div'));
  host.className = 'pane-body';
  root = createRoot(host);
  await act(async () => { root!.render(el); });
}
function unmount() { if (root) { act(() => root!.unmount()); host.remove(); root = null; } }
afterEach(() => { unmount(); vi.useRealTimers(); clock.t = START; vi.restoreAllMocks(); });

const base = () => useApp.setState({
  vault: dir, tree: vault.tree, files: vault.documents(), docs, order: vault.order, reveal: null, examFilter: null, log: [], budget: 0,
  learnNew: false, phone: false, session: null, queue: [], panes: openTab(emptyPanes(), ':session'),
});
const key = (k: string, more: KeyboardEventInit = {}) => act(async () => { window.dispatchEvent(new KeyboardEvent('keydown', { key: k, bubbles: true, cancelable: true, ...more })); });
const settle = (ms = 30) => act(async () => { await new Promise((r) => setTimeout(r, ms)); });
const changed = async (path: string, was: string) => {
  for (let k = 0; k < 200; k++) {
    const now = await fsp.readFile(join(dir, path), 'utf8');
    if (now !== was) return now;
    await settle(5);
  }
  return was;
};
const count = () => host.querySelector('.sess-count')?.textContent;
const card = () => host.querySelector<HTMLElement>('.recall-wrap .card');
/** Cards reviewed before, due, one line each (no blank of several, no reverse), from different documents first. */
const reviewed = (): CardItem[] => all.filter((i): i is CardItem => i.kind === 'card' && !!i.sched?.reps && i.groups === 1 && i.dir !== 'r' && i.id !== undefined && i.dueAt.getTime() <= START);
const fresh = (): CardItem[] => all.filter((i): i is CardItem => i.kind === 'card' && !i.sched && i.form === 'qa');

describe('a session', () => {
  it('a key held down (auto-repeat) does not grade: space held on a question reveals it and stops', async () => {
    base();
    const [a, b] = reviewed();
    const before = await fsp.readFile(join(dir, a!.path), 'utf8');
    useApp.setState({ session: { seq: 101, items: [a!, b!] } });
    await mount(createElement(Session, { active: true, onOpen: () => {} }));
    await key(' ');
    expect(card()?.dataset.revealed).toBe('1');
    // the key still down: the system repeats it
    await key(' ', { repeat: true });
    await key(' ', { repeat: true });
    await settle();
    expect(count()).toBe('1 / 2');
    expect(await fsp.readFile(join(dir, a!.path), 'utf8')).toBe(before);
  });

  it('left for another tab and come back to, goes on from where it was: a card graded is not asked again', async () => {
    base();
    const [, , a, b] = reviewed();
    const before = await fsp.readFile(join(dir, a!.path), 'utf8');
    useApp.setState({ session: { seq: 102, items: [a!, b!] } });
    await mount(createElement(Session, { active: true, onOpen: () => {} }));
    await key(' ');
    await key('3');
    expect(await changed(a!.path, before)).not.toBe(before);
    expect(count()).toBe('2 / 2');
    // another tab shown in the pane, then the session's again: the lens is drawn anew (`Canvas.tsx` draws the active tab only)
    unmount();
    await mount(createElement(Session, { active: true, onOpen: () => {} }));
    expect(count()).toBe('2 / 2');
  });

  it('its end counts each card once, learnt and then tested or not', async () => {
    base();
    const [a, b] = fresh();
    useApp.setState({ learnNew: true, session: { seq: 103, items: [a!, b!] } });
    await mount(createElement(Session, { active: true, onOpen: () => {} }));
    const was = await fsp.readFile(join(dir, a!.path), 'utf8');
    await key(' ');               // a learnt
    await key(' ');               // b learnt
    await key(' '); await key('3'); // a tested
    await changed(a!.path, was);
    await key(' '); await key('3'); // b tested
    await settle();
    expect(host.querySelector('.session-end')?.textContent).toContain('2 elements');
  });

  it('a section passed with ⏎, gone back to with ‹ and passed again counts one pass', async () => {
    base();
    const sec = all.find((i): i is SectionItem => i.kind === 'section' && i.dueAt.getTime() <= START);
    const [a] = reviewed();
    expect(sec).toBeDefined();
    const repsOf = async () => {
      const doc = (await vault.read(sec!.path)).doc;
      const h = doc.blocks.find((b) => b.kind === 'heading' && b.text === sec!.heading);
      return h?.kind === 'heading' ? h.read?.reps ?? 0 : -1;
    };
    const was = await repsOf();
    useApp.setState({ session: { seq: 104, items: [sec!, a!] } });
    await mount(createElement(Session, { active: true, onOpen: () => {} }));
    await key('Enter');
    for (let k = 0; k < 100 && (await repsOf()) === was; k++) await settle(5);
    expect(await repsOf()).toBe(was + 1);
    await key('[');
    await key('Enter');
    await settle(100);
    expect(await repsOf()).toBe(was + 1);
  });
});

describe('the queue', () => {
  it('a card in its learning steps shows when it comes due, the queue left open', async () => {
    base();
    const [a] = reviewed();
    // graded again a moment ago: back in a minute
    const soon: CardItem = { ...a!, due: new Date(START + 60_000).toISOString().replace(/\.\d+Z$/, 'Z'), dueAt: new Date(START + 60_000) };
    vi.useFakeTimers();
    useApp.setState({ queue: [soon] });
    await mount(createElement(Queue, { scope: 'today', active: true }));
    expect(host.querySelectorAll('.qlist li:not(.fold)')).toHaveLength(0);
    clock.t = START + 5 * 60_000;
    await act(async () => { vi.advanceTimersByTime(5 * 60_000); });
    expect(host.querySelectorAll('.qlist li:not(.fold)')).toHaveLength(1);
  });

  it('j brings the row it moves to into view', async () => {
    base();
    seen.length = 0;
    useApp.setState({ queue: all });
    await mount(createElement(Queue, { scope: 'today', active: true }));
    await key('j');
    await key('j');
    const active = host.querySelector('.qlist li[data-active="1"]');
    expect(active).not.toBeNull();
    expect(seen.some((el) => el === active || active!.contains(el))).toBe(true);
  });

  it('narrowed to an exam, ⏎ enters what is shown: the session holds that exam\'s elements only', async () => {
    base();
    const due = all.filter((i) => i.dueAt.getTime() <= START);
    const paths = [...new Set(due.map((i) => i.path))];
    expect(paths.length).toBeGreaterThan(1);
    const exam: ExamAt = { day: '2026-11-20', label: 'midterm', from: paths[0]! };
    const queue = due.map((i) => (i.path === paths[0] ? { ...i, exam } : i));
    useApp.setState({ queue, examFilter: `${exam.from}@${exam.day}` });
    await mount(createElement(Queue, { scope: 'today', active: true }));
    const shown = host.querySelectorAll('.qlist li:not(.fold)').length;
    expect(shown).toBe(queue.filter((i) => i.exam).length);
    await key('Enter');
    const items = useApp.getState().session?.items ?? [];
    expect(items).toHaveLength(shown);
  });
});
