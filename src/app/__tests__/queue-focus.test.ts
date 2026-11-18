// @vitest-environment jsdom
// The day's focus: the one list narrowed to one thing to do (`all · recall ·
// read · write`), over the sample as it ships on 2026-10-30. The row and its
// counts, the legend, `f` round, ⏎ and a row pressed walking only that kind,
// with an exam's chip as well, nothing of a kind, the phone's bar, and the
// focus kept in `.ilmi/state.json`.

import { promises as fsp } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { act, createElement } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterAll, afterEach, beforeAll, describe, expect, it, vi } from 'vitest';
import { meta as metaOf, type Doc, type Meta } from '../../format/index.js';
import { activeExam, docItems, examKey, examQueue, examsAt, isDue, meterQueue, resolveOptions, spentToday, stepsAhead, type ExamAt, type QueueItem } from '../../schedule/index.js';
import { nodeFs } from '../../vault/node-fs.js';
import { Vault } from '../../vault/index.js';
import { appNow, setClockDay } from '../clock.js';
import { FOCUSES, cleanFocus, focusOf, nextFocus, walkOf } from '../items.js';
import { emptyPanes, openTab } from '../panes.js';
import { useApp, type DocInfo } from '../store.js';

const SAMPLE = join(import.meta.dirname, '../../../samples/double-major');

let vault: Vault;
let dir: string;
const bodies = new Map<string, Doc>();
const docs: Record<string, DocInfo> = {};
const meta = (p: string): Meta | undefined => (bodies.has(p) ? metaOf(bodies.get(p)!) : undefined);
const opened: string[] = [];

vi.mock('../vault.js', async (orig) => {
  const real = await orig<typeof import('../vault.js')>();
  return {
    ...real,
    currentVault: () => vault,
    optionsAt: (p: string) => resolveOptions(p, meta),
    examsAtPath: (p: string) => examsAt(p, meta),
    refreshQueue: () => {},
  };
});
// a collection opened as the app opens one, over a store in memory (the last test)
const ROOT = '/collections/focus';
let mem: import('../../vault/index.js').StoreFs;
vi.mock('../collections.js', async (orig) => ({ ...(await orig<typeof import('../collections.js')>()), collectionFs: () => mem }));
vi.mock('../crdt.js', async (orig) => ({ ...(await orig<typeof import('../crdt.js')>()), startCrdt: async () => true, stopCrdt: () => {} }));
vi.mock('../keep.js', async (orig) => ({ ...(await orig<typeof import('../keep.js')>()), startMirror: async () => {}, stopMirror: () => {}, keepDatedSoon: () => {}, stopDated: () => {} }));
vi.mock('@tauri-apps/plugin-log', async (orig) => ({ ...(await orig<typeof import('@tauri-apps/plugin-log')>()), info: async () => {} }));
vi.mock('../../plugins/index.js', async (orig) => ({ ...(await orig<typeof import('../../plugins/index.js')>()), startPlugins: async () => ({}), stopPlugins: () => {} }));
const { Queue } = await import('../Queue.js');
const { PhoneBar } = await import('../PhoneBar.js');
const { closeVault, openVault, setFocus, startSession } = await import('../vault.js');
const { memStore } = await import('../../vault/mem-store.js');
const { storeFs } = await import('../../vault/store.js');
(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

let host: HTMLDivElement;
let root: Root | null = null;
async function mount(el: React.ReactElement) {
  host = document.body.appendChild(document.createElement('div'));
  root = createRoot(host);
  await act(async () => { root!.render(el); });
}
function unmount() { if (root) { act(() => root!.unmount()); host.remove(); root = null; } }
const key = (k: string, more: KeyboardEventInit = {}) => act(async () => { window.dispatchEvent(new KeyboardEvent('keydown', { key: k, bubbles: true, cancelable: true, ...more })); });
const word = (f: string) => host.querySelector<HTMLButtonElement>(`.focus-row button[data-focus="${f}"]`)!;
const n = (f: string) => Number(word(f).querySelector('.focus-n')?.textContent);
const rows = () => Array.from(host.querySelectorAll<HTMLElement>('.qlist li:not(.fold)'));
const kinds = () => new Set(rows().map((li) => li.dataset.el));
const legend = () => host.querySelector('.legend')?.textContent;

let queue: QueueItem[] = [];
let due: QueueItem[] = [];
const of = (f: string) => due.filter((i) => focusOf(i) === f);
/** The cards in their steps due later in the day: a session over cards asks them at its end. */
const ahead = () => stepsAhead(queue, appNow());

function build(now: Date): QueueItem[] {
  const items: QueueItem[] = [];
  for (const [p, d] of bodies) items.push(...docItems(p, d, now));
  const examsOf = (p: string) => examsAt(p, meta);
  examQueue(items, now, examsOf);
  const optionsOf = (p: string) => resolveOptions(p, meta);
  const examOf = (p: string) => activeExam(examsOf(p), now);
  return meterQueue(items, now, { optionsOf, spent: spentToday([], now, optionsOf, examOf), examOf });
}

const base = () => useApp.setState({
  vault: dir, tree: vault.tree, files: vault.documents(), docs, order: vault.order, queue, examFilter: null, queueFocus: 'all', log: [], budget: 0,
  phone: false, session: null, sideSheet: false, panes: openTab(emptyPanes(), ':queue/today'),
});

beforeAll(async () => {
  setClockDay('2026-10-30');
  dir = await fsp.mkdtemp(join(tmpdir(), 'ilmi-focus-'));
  await fsp.cp(SAMPLE, dir, { recursive: true });
  vault = await Vault.open(nodeFs, dir);
  for (const p of vault.documents()) {
    const doc = (await vault.read(p)).doc;
    bodies.set(p, doc);
    const m = metaOf(doc);
    docs[p] = { type: m.type, frozen: m.frozen, cards: doc.blocks.filter((b) => b.kind === 'card').length, due: 0 };
    if (m.title !== undefined) docs[p]!.title = m.title;
  }
  queue = build(appNow());
  due = queue.filter((i) => isDue(i, appNow()));
});
afterEach(() => { unmount(); });
afterAll(async () => {
  setClockDay(null);
  vault.close();
  await fsp.rm(dir, { recursive: true, force: true });
});

describe('the focus, as a model', () => {
  it('a card is recalled, a source or a section read, a draft written; round by f', () => {
    expect(new Set(due.map(focusOf))).toEqual(new Set(['recall', 'read', 'write']));
    expect(due.filter((i) => i.kind === 'section').every((i) => focusOf(i) === 'read')).toBe(true);
    expect(FOCUSES.map((f) => nextFocus(f))).toEqual(['recall', 'read', 'write', 'all']);
    expect(FOCUSES.map((f) => nextFocus(f, -1))).toEqual(['write', 'all', 'recall', 'read']);
    expect([cleanFocus('recall'), cleanFocus('cards'), cleanFocus(undefined)]).toEqual(['recall', 'all', 'all']);
  });

  it('what is walked: the day above its fold; narrowed, everything due of that, in the same order', () => {
    const now = appNow();
    expect(walkOf(queue, now, 5, null, 'all')).toHaveLength(5);
    expect(walkOf(queue, now, 5, null, 'recall')).toEqual(of('recall'));
    // the tweak keeps a focus to the day's budget: what is above the fold, of that kind
    expect(walkOf(queue, now, 5, null, 'recall', true)).toEqual(walkOf(queue, now, 5, null, 'all').filter((i) => focusOf(i) === 'recall'));
    expect(walkOf(queue, now, 5, null, 'recall', true).length).toBeLessThanOrEqual(5);
    expect(walkOf(queue, now, 0, null, 'read')).toEqual(of('read'));
  });
});

describe('the focus in the queue', () => {
  it('the row: four words with their counts, all on; the legend as it was', async () => {
    base();
    await mount(createElement(Queue, { scope: 'today', active: true }));
    expect(Array.from(host.querySelectorAll('.focus-row button')).map((b) => b.textContent)).toEqual(
      [`all${due.length}`, `recall${of('recall').length}`, `read${of('read').length}`, `write${of('write').length}`]);
    expect(word('all').dataset.on).toBe('1');
    expect(legend()).toBe(`${due.length} due, in priority order`);
    expect(kinds().size).toBeGreaterThan(1);
  });

  it('a word pressed: that kind only, in the same order, the legend saying so, the counts kept', async () => {
    base();
    await mount(createElement(Queue, { scope: 'today', active: true }));
    const order = rows().filter((li) => li.dataset.el === 'card').map((li) => li.textContent);
    await act(async () => { word('recall').click(); });
    expect(useApp.getState().queueFocus).toBe('recall');
    expect(word('recall').dataset.on).toBe('1');
    expect(word('all').dataset.on).toBe('0');
    expect(kinds()).toEqual(new Set(['card']));
    expect(rows().map((li) => li.textContent)).toEqual(order);
    expect(legend()).toBe(`${of('recall').length} due, recall only, in priority order`);
    expect(n('all')).toBe(due.length);
    await act(async () => { word('read').click(); });
    expect(kinds()).toEqual(new Set(['read', 'section']));
    expect(legend()).toBe(`${of('read').length} due, read only, in priority order`);
    await act(async () => { word('all').click(); });
    expect(rows()).toHaveLength(due.length);
  });

  it('f goes round, ⇧F back; a key held does not run on', async () => {
    base();
    await mount(createElement(Queue, { scope: 'today', active: true }));
    const at = () => useApp.getState().queueFocus;
    await key('f'); expect(at()).toBe('recall');
    await key('f', { repeat: true }); expect(at()).toBe('recall');
    await key('f'); expect(at()).toBe('read');
    await key('f'); expect(at()).toBe('write');
    expect(kinds()).toEqual(new Set(['write']));
    await key('f'); expect(at()).toBe('all');
    await key('F', { shiftKey: true }); expect(at()).toBe('write');
    await key('F', { shiftKey: true }); expect(at()).toBe('read');
  });

  it('⏎ walks only that kind, from the top; a row pressed starts there, within the kind', async () => {
    base();
    useApp.setState({ queueFocus: 'recall' });
    await mount(createElement(Queue, { scope: 'today', active: true }));
    await key('Enter');
    let items = useApp.getState().session?.items ?? [];
    expect(items).toEqual([...of('recall'), ...ahead()]);
    useApp.setState({ session: null });
    await act(async () => { rows()[2]!.click(); });
    items = useApp.getState().session?.items ?? [];
    expect(items).toHaveLength(of('recall').length + ahead().length);
    expect(items[0]).toEqual(of('recall')[2]);
    expect(items.every((i) => i.kind === 'card')).toBe(true);
    unmount();
    // the button too
    useApp.setState({ session: null, queueFocus: 'write' });
    await mount(createElement(Queue, { scope: 'today', active: false }));
    await act(async () => { host.querySelector<HTMLButtonElement>('.enter-queue')!.click(); });
    expect(useApp.getState().session?.items).toEqual(of('write'));
  });

  it('with a budget: all folds the day, a focus shows everything of its kind with no fold, and ⏎ walks it', async () => {
    base();
    useApp.setState({ budget: 3 });
    await mount(createElement(Queue, { scope: 'today', active: true }));
    expect(host.querySelector('.qlist li.fold')).not.toBeNull();
    await key('f');
    expect(host.querySelector('.qlist li.fold')).toBeNull();
    expect(rows()).toHaveLength(of('recall').length);
    await key('Enter');
    expect(useApp.getState().session?.items).toHaveLength(of('recall').length + ahead().length);
  });

  it('with an exam\'s chip: the focus and the exam together, the counts of what the exam leaves', async () => {
    base();
    const paths = [...new Set(of('recall').map((i) => i.path))];
    const exam: ExamAt = { day: '2026-11-20', label: 'quiz', from: paths[0]! };
    const read = of('read')[0]!;
    const q = queue.map((i): QueueItem => { const { exam: _was, ...bare } = i; return i.path === paths[0] || i === read ? { ...i, exam } : (bare as QueueItem); });
    const toward = q.filter((i) => i.exam && isDue(i, appNow()));
    useApp.setState({ queue: q, examFilter: examKey(exam), queueFocus: 'recall' });
    await mount(createElement(Queue, { scope: 'today', active: true }));
    const cards = toward.filter((i) => i.kind === 'card');
    expect(cards.length).toBeGreaterThan(0);
    expect(cards.length).toBeLessThan(toward.length);
    expect(rows()).toHaveLength(cards.length);
    expect(n('all')).toBe(toward.length);
    expect(n('recall')).toBe(cards.length);
    // the chip stays to be taken off
    expect(host.querySelector('.exam-filter button')?.getAttribute('data-active')).toBe('1');
    await key('Enter');
    expect(useApp.getState().session?.items).toEqual([...cards, ...stepsAhead(q, appNow()).filter((i) => i.exam)]);
  });

  it('nothing of a kind: the word dimmed and still pressed, the line saying so, the row there to go back', async () => {
    base();
    useApp.setState({ queue: queue.filter((i) => i.kind !== 'write' || !isDue(i, appNow())) });
    await mount(createElement(Queue, { scope: 'today', active: true }));
    expect(word('write').dataset.none).toBe('1');
    expect(word('write').disabled).toBe(false);
    expect(word('recall').dataset.none).toBe('0');
    await act(async () => { word('write').click(); });
    expect(host.querySelector('.empty')?.textContent).toMatch(/^nothing to write today/);
    expect(host.querySelector('.enter-queue')).toBeNull();
    expect(legend()).toBe('0 due, write only, in priority order');
    await key('Enter');
    expect(useApp.getState().session).toBeNull();
    await act(async () => { word('all').click(); });
    expect(rows().length).toBeGreaterThan(0);
  });

  it('the other saved queries are whole: no row, the focus not applied', async () => {
    base();
    useApp.setState({ queueFocus: 'write' });
    await mount(createElement(Queue, { scope: 'cards', active: true }));
    expect(host.querySelector('.focus-row')).toBeNull();
    expect(kinds()).toEqual(new Set(['card']));
    await key('f');
    expect(useApp.getState().queueFocus).toBe('write');
  });
});

describe('the focus elsewhere', () => {
  it('the phone\'s bar enters the focus, its count beside it; nothing of it, it says today with the day\'s count', async () => {
    base();
    useApp.setState({ phone: true, queueFocus: 'recall' });
    await mount(createElement(PhoneBar));
    expect(host.querySelector('.pb-day')?.textContent).toBe(`enter queue${of('recall').length}`);
    await act(async () => { host.querySelector<HTMLButtonElement>('.pb-day')!.click(); });
    expect(useApp.getState().session?.items).toEqual([...of('recall'), ...ahead()]);
    unmount();
    useApp.setState({ session: null, queueFocus: 'write', panes: openTab(emptyPanes(), ':queue/today'), queue: queue.filter((i) => i.kind !== 'write') });
    await mount(createElement(PhoneBar));
    expect(host.querySelector('.pb-day')?.textContent).toBe(`today${due.length - of('write').length}`);
    await act(async () => { host.querySelector<HTMLButtonElement>('.pb-day')!.click(); });
    expect(useApp.getState().session).toBeNull();
  });

  it('startSession with a focus (the palette\'s enter): that kind only', () => {
    base();
    startSession({}, null, 'read');
    expect(useApp.getState().session?.items).toEqual(of('read'));
  });

  it('kept per collection in .ilmi/state.json: set, the collection opened again; another collection has its own', async () => {
    mem = storeFs(memStore(), ROOT);
    await mem.mkdir(ROOT);
    await mem.writeText(`${ROOT}/b.md`, '---\ntype: deck\n---\nq :: a\n');
    await openVault(ROOT);
    expect(useApp.getState().queueFocus).toBe('all');
    setFocus('recall');
    expect(useApp.getState().queueFocus).toBe('recall');
    // opened again: what waited to be saved is written first, and read back
    useApp.setState({ queueFocus: 'all' });
    await openVault(ROOT);
    expect(useApp.getState().queueFocus).toBe('recall');
    expect(JSON.parse(await mem.readText(`${ROOT}/.ilmi/state.json`)).focus).toBe('recall');
    // another collection: its own, everything
    const kept = mem;
    mem = storeFs(memStore(), '/collections/other');
    await mem.mkdir('/collections/other');
    await openVault('/collections/other');
    expect(useApp.getState().queueFocus).toBe('all');
    mem = kept;
    await openVault(ROOT);
    expect(useApp.getState().queueFocus).toBe('recall');
    closeVault();
  });
});
