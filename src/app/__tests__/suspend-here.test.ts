// @vitest-environment jsdom
// Suspending the card in front of you: `s` in a session (the card out of the
// queue, ungraded, the session on to the next, undone from the notice), `s`
// in the card view (a toggle), and the inspector's button. All through the
// deck's `bulkCards`. Over the sample as it ships, on 2026-11-02.

import { promises as fsp } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { act, createElement } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterAll, afterEach, beforeAll, describe, expect, it, vi } from 'vitest';
import { meta as metaOf, type Doc } from '../../format/index.js';
import { docItems, sortQueue, type CardItem, type QueueItem } from '../../schedule/index.js';
import { nodeFs } from '../../vault/node-fs.js';
import { Vault } from '../../vault/index.js';
import { emptyPanes, openTab } from '../panes.js';
import { useApp, type DocInfo } from '../store.js';

const SAMPLE = join(import.meta.dirname, '../../../samples/double-major');
const clock = vi.hoisted(() => ({ t: new Date('2026-11-02T09:00:00').getTime() }));
const START = clock.t;
const logged = vi.hoisted(() => ({ n: 0 }));
let vault: Vault;
let dir: string;
let all: QueueItem[] = [];
const docs: Record<string, DocInfo> = {};
const bodies = new Map<string, Doc>();

// jsdom draws no boxes: ProseMirror's scroll to the caret asks a range for its rects
for (const proto of [Node.prototype, Range.prototype] as unknown as { getClientRects?: () => DOMRect[]; getBoundingClientRect?: () => DOMRect }[]) {
  proto.getClientRects ??= () => [];
  proto.getBoundingClientRect ??= () => new DOMRect();
}

vi.mock('../clock.js', () => ({ appNow: () => new Date(clock.t), setClockDay: () => {} }));
vi.mock('../vault.js', async (orig) => {
  const real = await orig<typeof import('../vault.js')>();
  return {
    ...real,
    currentVault: () => vault,
    docsOf: (paths: readonly string[]) => paths.filter((p) => bodies.has(p)).map((p) => [p, bodies.get(p)!] as [string, Doc]),
    recordReview: async () => { logged.n += 1; },
    stageReview: async () => { logged.n += 1; },
    note: () => {},
  };
});
const { Session } = await import('../Session.js');
const { Lens } = await import('../Lenses.js');
const { Inspector } = await import('../Inspector.js');
const { cardsId } = await import('../names.js');
const { undoNotice } = await import('../land.js');
(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
(globalThis as { ResizeObserver?: unknown }).ResizeObserver ??= class { observe() {} unobserve() {} disconnect() {} };
Element.prototype.scrollIntoView ??= function scrollIntoView() {};

beforeAll(async () => {
  dir = await fsp.mkdtemp(join(tmpdir(), 'ilmi-suspend-here-'));
  await fsp.cp(SAMPLE, dir, { recursive: true });
  vault = await Vault.open(nodeFs, dir);
  const now = new Date(START);
  for (const p of vault.documents()) {
    const doc = (await vault.read(p)).doc;
    bodies.set(p, doc);
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
async function mount(el: React.ReactElement, cls = 'pane-body') {
  host = document.body.appendChild(document.createElement('div'));
  host.className = cls;
  root = createRoot(host);
  await act(async () => { root!.render(el); });
}
function unmount() { if (root) { act(() => root!.unmount()); host.remove(); root = null; } }
afterEach(() => { unmount(); logged.n = 0; });

const base = (tab: string) => useApp.setState({
  vault: dir, tree: vault.tree, files: vault.documents(), docs: { ...docs }, order: vault.order, reveal: null, examFilter: null, log: [], budget: 0,
  learnNew: false, phone: false, session: null, queue: [], notice: null, selectedCard: null, cardAt: {}, panes: openTab(emptyPanes(), tab),
});
const key = (k: string, more: KeyboardEventInit = {}) => act(async () => { window.dispatchEvent(new KeyboardEvent('keydown', { key: k, bubbles: true, cancelable: true, ...more })); });
const settle = (ms = 30) => act(async () => { await new Promise((r) => setTimeout(r, ms)); });
const disk = (path: string) => fsp.readFile(join(dir, path), 'utf8');
const changed = async (path: string, was: string) => {
  for (let k = 0; k < 200; k++) {
    const now = await disk(path);
    if (now !== was) return now;
    await settle(5);
  }
  return was;
};
/** The card's bare `sr` line carries `sus=1`. */
const suspendedOnDisk = async (item: { path: string; id?: string }) => {
  const doc = (await vault.read(item.path, true)).doc;
  const c = doc.blocks.find((b) => b.kind === 'card' && b.id === item.id);
  return c?.kind === 'card' ? !!c.sched?.suspended : null;
};
/** The vault's write reported to the card view: the body read again, `docs` moved. */
const refresh = async (path: string) => {
  bodies.set(path, (await vault.read(path, true)).doc);
  await act(async () => { useApp.setState((s) => ({ docs: { ...s.docs } })); });
};
/** `after` is `before` with one more `sus=1` and nothing else: no grade, no other line touched. */
const onlySuspended = (after: string, before: string) =>
  after.replaceAll(' sus=1', '') === before.replaceAll(' sus=1', '') && after.split(' sus=1').length === before.split(' sus=1').length + 1;
const count = () => host.querySelector('.sess-count')?.textContent;
/** Cards reviewed before, due, one line each, with an id. */
const reviewed = (): CardItem[] => all.filter((i): i is CardItem => i.kind === 'card' && !!i.sched?.reps && i.groups === 1 && i.dir !== 'r' && i.id !== undefined && i.dueAt.getTime() <= START);

describe('s in a session', () => {
  it('suspends the card on show without grading it, moves on, and the notice undoes it', async () => {
    base(':session');
    const [a, b] = reviewed();
    const before = await disk(a!.path);
    useApp.setState({ session: { seq: 201, items: [a!, b!] } });
    await mount(createElement(Session, { active: true, onOpen: () => {} }));
    expect(count()).toBe('1 / 2');
    await key('s');
    expect(count()).toBe('2 / 2');
    const after = await changed(a!.path, before);
    expect(await suspendedOnDisk(a!)).toBe(true);
    // nothing but the suspension: one `sus=1`, no grade, no log line
    expect(onlySuspended(after, before)).toBe(true);
    expect(logged.n).toBe(0);
    await settle();
    expect(useApp.getState().notice).toMatchObject({ line: 'suspended · 1 card', undo: true });
    await act(async () => { await undoNotice(); });
    expect(await disk(a!.path)).toBe(before);
    // the session stays where it went
    expect(count()).toBe('2 / 2');
  });

  it('on a revealed card too; gone back to, it says suspended, takes no grade, space is next, and s brings it back', async () => {
    base(':session');
    const [, , a, b] = reviewed();
    const before = await disk(a!.path);
    useApp.setState({ session: { seq: 202, items: [a!, b!] } });
    await mount(createElement(Session, { active: true, onOpen: () => {} }));
    await key(' ');
    expect(host.querySelector<HTMLElement>('.recall-wrap .card')?.dataset.revealed).toBe('1');
    await key('s');
    const after = await changed(a!.path, before);
    expect(count()).toBe('2 / 2');
    await key('[');
    await settle();
    expect(count()).toBe('1 / 2');
    expect(host.querySelector('.card-meta .cm-due')?.textContent).toBe('suspended');
    expect(Array.from(host.querySelectorAll('.grades button')).map((x) => x.getAttribute('data-act'))).toEqual(['pass']);
    await key('3');
    await settle();
    expect(count()).toBe('1 / 2');
    expect(await disk(a!.path)).toBe(after);
    await key(' ');
    expect(count()).toBe('2 / 2');
    expect(logged.n).toBe(0);
    // back again: s unsuspends, and the card stays up to be graded
    await key('[');
    await settle();
    await key('s');
    expect(await changed(a!.path, after)).toBe(before);
    await settle();
    expect(count()).toBe('1 / 2');
    expect(host.querySelectorAll('.grades button')).toHaveLength(4);
    expect(useApp.getState().notice).toMatchObject({ line: 'unsuspended · 1 card', undo: true });
  });

  it('a held key does nothing, and a topic takes no s', async () => {
    base(':session');
    const [, , , , a, b] = reviewed();
    const before = await disk(a!.path);
    useApp.setState({ session: { seq: 203, items: [a!, b!] } });
    await mount(createElement(Session, { active: true, onOpen: () => {} }));
    await key('s', { repeat: true });
    await settle(60);
    expect(count()).toBe('1 / 2');
    expect(await disk(a!.path)).toBe(before);
    unmount();

    const sec = all.find((i) => i.kind === 'section' && i.dueAt.getTime() <= START)!;
    expect(sec).toBeDefined();
    const was = await disk(sec.path);
    useApp.setState({ notice: null, session: { seq: 204, items: [sec, a!] } });
    await mount(createElement(Session, { active: true, onOpen: () => {} }));
    await key('s');
    await settle(60);
    expect(host.querySelector('.sb-count')?.textContent).toBe('1 / 2');
    expect(await disk(sec.path)).toBe(was);
    expect(useApp.getState().notice).toBeNull();
  });
});

describe('s in the card view, and the inspector', () => {
  const pick = () => {
    const c = reviewed().find((i) => docs[i.path]?.type === 'deck') ?? reviewed()[5]!;
    return c;
  };

  it('s toggles suspended on the card on show; the strip says so; the notice undoes it', async () => {
    const c = pick();
    base(cardsId(c.path));
    await refresh(c.path);
    const before = await disk(c.path);
    useApp.setState({ cardAt: { [c.path]: { block: c.block, id: c.id! } } });
    await mount(createElement(Lens, { id: cardsId(c.path), active: true, onOpen: () => {} }));
    const due = () => host.querySelector('.card-view .card-meta .cm-due')?.textContent;
    expect(due()).not.toBe('suspended');
    const standing = host.querySelector('.cv-count')?.textContent;
    await key('s');
    const after = await changed(c.path, before);
    expect(onlySuspended(after, before)).toBe(true);
    expect(await suspendedOnDisk(c)).toBe(true);
    await refresh(c.path);
    expect(due()).toBe('suspended');
    expect(host.querySelector('.cv-count')?.textContent).toBe(standing);
    expect(useApp.getState().notice).toMatchObject({ line: 'suspended · 1 card', undo: true });
    // again: back in the queue
    await key('s');
    expect(await changed(c.path, after)).toBe(before);
    await refresh(c.path);
    expect(due()).not.toBe('suspended');
    expect(useApp.getState().notice).toMatchObject({ line: 'unsuspended · 1 card', undo: true });
    // the undo of an unsuspend suspends again
    await act(async () => { await undoNotice(); });
    expect(await disk(c.path)).toBe(after);
    await refresh(c.path);
    await key('s');
    expect(await changed(c.path, after)).toBe(before);
    expect(logged.n).toBe(0);
  });

  it('the inspector says suspended and its button beside reset suspends and unsuspends', async () => {
    const c = pick();
    base(cardsId(c.path));
    await refresh(c.path);
    const before = await disk(c.path);
    useApp.setState({ selectedCard: { path: c.path, index: c.block } });
    await mount(createElement(Inspector), 'shell');
    await settle();
    const row = () => Array.from(host.querySelectorAll<HTMLElement>('.insp .frozen-row')).find((r) => r.querySelector('[data-act="suspend"], [data-act="unsuspend"]'))!;
    expect(row()).toBeTruthy();
    expect(row().querySelector('.fr-state')?.textContent).toBe('scheduled');
    expect(Array.from(row().querySelectorAll('button')).map((x) => x.textContent)).toEqual(['reset', 'suspend']);
    await act(async () => { row().querySelector<HTMLButtonElement>('[data-act="suspend"]')!.click(); });
    const after = await changed(c.path, before);
    expect(onlySuspended(after, before)).toBe(true);
    await settle();
    expect(row().querySelector('.fr-state')?.textContent).toBe('suspended');
    expect(Array.from(row().querySelectorAll('button')).map((x) => x.textContent)).toEqual(['reset', 'unsuspend']);
    expect(useApp.getState().notice).toMatchObject({ line: 'suspended · 1 card', undo: true });
    await act(async () => { row().querySelector<HTMLButtonElement>('[data-act="unsuspend"]')!.click(); });
    expect(await changed(c.path, after)).toBe(before);
    await settle();
    expect(row().querySelector('.fr-state')?.textContent).toBe('scheduled');
  });
});
