// @vitest-environment jsdom
// Milestone 45 drawn and written: the deck browser's `similar` chip over the
// stat-mech course lists its pairs side by side with their schedules; a pair
// linked (both bare lines, one schedule), merged (one card kept with the
// stronger schedule, the other removed, the notice's undo putting it back),
// and said not the same (remembered in `.ilmi/same.json`, never listed
// again); the inspector's `also in` and `linked to` lines. Over a copy of
// samples/double-major.

import { promises as fsp } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { act, createElement } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';
import { meta as metaOf, type Card, type Doc } from '../../format/index.js';
import { nodeFs } from '../../vault/node-fs.js';
import { Vault } from '../../vault/index.js';
import { emptyPanes, openTab } from '../panes.js';
import { useApp, type DocInfo } from '../store.js';

const SAMPLE = join(import.meta.dirname, '../../../samples/double-major');
const COURSE = 'courses/fall-2026/phys-415-stat-mech';
const MICRO = `${COURSE}/microcanonical-ensemble.md`;
const CANON = `${COURSE}/canonical-ensemble.md`;
const CH2 = 'library/lindqvist-statistical-physics/ch-2-microstates-and-entropy.md';
const CH3 = 'library/lindqvist-statistical-physics/ch-3-the-canonical-ensemble.md';

let vault: Vault;
let dir: string;
const bodies = new Map<string, Doc>();
let docs: Record<string, DocInfo> = {};

vi.mock('../vault.js', async (orig) => {
  const real = await orig<typeof import('../vault.js')>();
  return {
    ...real,
    currentVault: () => vault,
    allDocs: () => [...bodies],
    docsOf: (paths: readonly string[]) => paths.filter((p) => bodies.has(p)).map((p) => [p, bodies.get(p)!] as [string, Doc]),
  };
});
const { DeckBrowser } = await import('../DeckBrowser.js');
const { Inspector } = await import('../Inspector.js');
const { undoNotice } = await import('../land.js');
(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
(globalThis as { ResizeObserver?: unknown }).ResizeObserver ??= class { observe() {} unobserve() {} disconnect() {} };
Element.prototype.scrollIntoView ??= function scrollIntoView() {};

/** Read every file again, as the vault's events would, and publish the docs anew. */
async function refresh() {
  docs = {};
  for (const p of vault.documents()) {
    const doc = (await vault.read(p, true)).doc;
    bodies.set(p, doc);
    const m = metaOf(doc);
    docs[p] = { type: m.type, frozen: m.frozen, cards: doc.blocks.filter((b) => b.kind === 'card').length, due: 0 };
    if (m.title !== undefined) docs[p]!.title = m.title;
  }
  await act(async () => { useApp.setState({ docs: { ...docs }, files: vault.documents(), tree: vault.tree }); });
}

let host: HTMLDivElement;
let root: Root;
async function mount(el: React.ReactElement) {
  host = document.body.appendChild(document.createElement('div'));
  host.className = 'pane-body deck-view';
  root = createRoot(host);
  await act(async () => { root.render(el); });
}
function unmount() { act(() => root.unmount()); host.remove(); }

beforeAll(async () => {
  dir = await fsp.mkdtemp(join(tmpdir(), 'ilmi-same-'));
  await fsp.cp(SAMPLE, dir, { recursive: true });
  vault = await Vault.open(nodeFs, dir);
  useApp.setState({ vault: dir, order: vault.order, queue: [], lensViews: {}, deckViews: {}, selectedCard: null, reveal: null, folds: {}, railFolded: {}, notSame: [], notice: null });
  await refresh();
});
afterAll(async () => {
  vault.close();
  await fsp.rm(dir, { recursive: true, force: true });
});

const pairEl = (a: string, b: string) =>
  host.querySelector<HTMLElement>(`.same-pair[data-a="${a}"][data-b="${b}"]`) ?? host.querySelector<HTMLElement>(`.same-pair[data-a="${b}"][data-b="${a}"]`);
const disk = (p: string) => fsp.readFile(join(dir, p), 'utf8');
const cardIn = (p: string, id: string) => bodies.get(p)!.blocks.find((b): b is Card => b.kind === 'card' && b.id === id);
const click = async (el: Element | null | undefined) => { expect(el).toBeTruthy(); await act(async () => { (el as HTMLElement).click(); }); };
/** Wait for the write a click started, then read the files again. */
const settle = async (until: () => Promise<boolean> | boolean) => {
  for (let k = 0; k < 100 && !(await until()); k++) await act(async () => { await new Promise((r) => setTimeout(r, 10)); });
  expect(await until()).toBe(true);
  await refresh();
};

describe('similar', () => {
  it('the stat-mech course\'s pairs, side by side with their schedules, best first', async () => {
    await mount(createElement(DeckBrowser, { home: COURSE, active: true }));
    await click(host.querySelector('.chip[data-chip="similar"]'));
    expect(host.querySelector('.chip[data-chip="similar"]')!.getAttribute('data-on')).toBe('1');
    expect(host.querySelector('.deck-row')).toBeNull();
    const pairs = Array.from(host.querySelectorAll<HTMLElement>('.same-pair'));
    expect(pairs.length).toBeGreaterThan(10);
    // the clearest first: the free energy typed twice
    expect([pairs[0]!.dataset.a, pairs[0]!.dataset.b].sort()).toEqual(['lq3-F-lnZ', 'sm-F-lnZ']);
    for (const [a, b] of [['sm-einstein-omega', 'lq2-einstein-omega'], ['sm-def-T', 'lq2-def-T'], ['sm-peak-width', 'lq2-peak-width'], ['sm-dv-equip', 'dr-equip'], ['sm-dv-fermi', 'dr-fermi']] as const) {
      expect(pairEl(a, b), `${a} ~ ${b}`).toBeTruthy();
    }
    // each side: its form, its file, its faces, its schedule, keep this
    const side = pairs[0]!.querySelector('.sp-side')!;
    expect(side.querySelector('.dr-form')!.textContent).toBe('cloze');
    expect(side.querySelector('.sp-path')!.textContent).toMatch(/canonical-ensemble|ch-3-the-canonical-ensemble/);
    expect(side.querySelector('.dr-front .katex')).toBeTruthy();
    expect(side.querySelector('.sp-sched')!.textContent).toMatch(/\d+ reviews?/);
    expect(side.querySelector('button[data-act="keep"]')!.textContent).toBe('keep this');
    expect(Array.from(pairs[0]!.querySelectorAll('.sp-acts button')).map((b) => b.textContent)).toEqual(['link', 'not the same']);
    // the search narrows the pairs
    await act(async () => {
      const input = host.querySelector<HTMLInputElement>('.db-search')!;
      const set = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value')!.set!;
      set.call(input, 'Einstein');
      input.dispatchEvent(new Event('input', { bubbles: true }));
    });
    expect(Array.from(host.querySelectorAll<HTMLElement>('.same-pair')).every((p) => /einstein/i.test(p.textContent ?? ''))).toBe(true);
    await act(async () => {
      const input = host.querySelector<HTMLInputElement>('.db-search')!;
      const set = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value')!.set!;
      set.call(input, '');
      input.dispatchEvent(new Event('input', { bubbles: true }));
    });
  });

  it('link: both bare lines name each other and take the stronger schedule; the pair leaves the list', async () => {
    const a0 = cardIn(MICRO, 'sm-def-T')!.sched!;
    const b0 = cardIn(CH2, 'lq2-def-T')!.sched!;
    const strong = (a0.stability ?? 0) >= (b0.stability ?? 0) ? a0 : b0;
    await click(pairEl('sm-def-T', 'lq2-def-T')!.querySelector('button[data-act="link"]'));
    await settle(async () => (await disk(CH2)).includes('link=sm-def-T'));
    expect(await disk(MICRO)).toContain('link=lq2-def-T');
    const [a, b] = [cardIn(MICRO, 'sm-def-T')!.sched!, cardIn(CH2, 'lq2-def-T')!.sched!];
    expect([a.due, a.stability, a.reps]).toEqual([strong.due, strong.stability, strong.reps]);
    expect([b.due, b.stability, b.reps]).toEqual([strong.due, strong.stability, strong.reps]);
    expect(useApp.getState().notice?.line).toBe('linked · 2 cards');
    expect(pairEl('sm-def-T', 'lq2-def-T')).toBeNull();
  });

  it('grading one counts for the other: the same state on both lines, each its own priority; and only one of them in the day\'s queue', async () => {
    const { gradeCard } = await import('../grading.js');
    const { docItems, queueItems, isDue } = await import('../../schedule/index.js');
    const now = new Date();
    // the day's queue over the collection: never both
    const due = queueItems(bodies, now).filter((i) => i.kind === 'card' && isDue(i, now) && (i.id === 'sm-def-T' || i.id === 'lq2-def-T'));
    expect(due.length).toBeLessThanOrEqual(1);
    const item = docItems(MICRO, bodies.get(MICRO)!, now).find((i) => i.kind === 'card' && i.id === 'sm-def-T')!;
    expect(item.kind === 'card' && item.link).toBe('lq2-def-T');
    const reps = cardIn(CH2, 'lq2-def-T')!.sched!.reps ?? 0;
    await gradeCard(item as import('../../schedule/index.js').CardItem, 3, now);
    await refresh();
    const [a, b] = [cardIn(MICRO, 'sm-def-T')!.sched!, cardIn(CH2, 'lq2-def-T')!.sched!];
    expect(b.reps).toBe(reps + 1);
    expect([b.due, b.stability, b.last, b.link]).toEqual([a.due, a.stability, a.last, 'sm-def-T']);
    // reviewed today: the other is buried, neither due again today
    expect(queueItems(bodies, now).filter((i) => i.kind === 'card' && isDue(i, now) && (i.id === 'sm-def-T' || i.id === 'lq2-def-T'))).toEqual([]);
  });

  it('merge: keep this, the stronger schedule carried, the other card removed; the notice\'s undo puts it back', async () => {
    const before = await disk(CH3);
    const keep0 = cardIn(CANON, 'sm-F-lnZ')!.sched;
    const drop0 = cardIn(CH3, 'lq3-F-lnZ')!.sched;
    const strong = (drop0?.stability ?? -1) > (keep0?.stability ?? -1) ? drop0 : keep0;
    const p = pairEl('sm-F-lnZ', 'lq3-F-lnZ')!;
    const keepSide = Array.from(p.querySelectorAll<HTMLElement>('.sp-side')).find((s) => s.dataset.key === 'sm-F-lnZ')!;
    await click(keepSide.querySelector('button[data-act="keep"]'));
    await settle(async () => !(await disk(CH3)).includes('^lq3-F-lnZ'));
    expect(cardIn(CH3, 'lq3-F-lnZ')).toBeUndefined();
    const kept = cardIn(CANON, 'sm-F-lnZ')!.sched!;
    expect([kept.due, kept.stability, kept.reps]).toEqual([strong?.due, strong?.stability, strong?.reps]);
    expect(useApp.getState().notice?.line).toBe('merged · 2 cards into 1');
    expect(pairEl('sm-F-lnZ', 'lq3-F-lnZ')).toBeNull();
    await act(async () => { await undoNotice(); });
    await settle(async () => (await disk(CH3)) === before);
    expect(cardIn(CH3, 'lq3-F-lnZ')).toBeTruthy();
    expect(pairEl('sm-F-lnZ', 'lq3-F-lnZ')).toBeTruthy();
  });

  it('not the same: remembered in .ilmi/same.json, never listed again; read back by a vault opened anew', async () => {
    const p = pairEl('sm-sigmaE', 'sm-dv-fluct')!;
    await click(p.querySelector('button[data-act="not-same"]'));
    await settle(async () => (await disk('.ilmi/same.json').catch(() => '')).includes('sm-dv-fluct|sm-sigmaE'));
    expect(JSON.parse(await disk('.ilmi/same.json'))).toEqual({ not: ['sm-dv-fluct|sm-sigmaE'] });
    expect(useApp.getState().notSame).toEqual(['sm-dv-fluct|sm-sigmaE']);
    expect(pairEl('sm-sigmaE', 'sm-dv-fluct')).toBeNull();
    const again = await Vault.open(nodeFs, dir);
    expect(await again.loadNotSame()).toEqual(['sm-dv-fluct|sm-sigmaE']);
    again.close();
    unmount();
  });

  it('the inspector: `also in` names the other card\'s document, `linked to` the linked one; each opens it', async () => {
    const peak = bodies.get(MICRO)!.blocks.findIndex((b) => b.kind === 'card' && b.id === 'sm-peak-width');
    const defT = bodies.get(MICRO)!.blocks.findIndex((b) => b.kind === 'card' && b.id === 'sm-def-T');
    useApp.setState({ panes: openTab(emptyPanes(), MICRO), selectedCard: { path: MICRO, index: peak } });
    await mount(createElement(Inspector));
    const row = (k: string) => Array.from(host.querySelectorAll('.kvr')).find((r) => r.querySelector('dt')?.textContent === k);
    expect(row('also in')!.querySelector('dd')!.textContent).toMatch(/^ch\. 2: microstates and entropy/);
    await act(async () => { useApp.setState({ selectedCard: { path: MICRO, index: defT } }); });
    expect(row('also in')).toBeUndefined();
    expect(row('linked to')!.querySelector('dd')!.textContent).toBe('ch. 2: microstates and entropyunlink');
    await click(row('linked to')!.querySelector('button[data-act="linked"]'));
    expect(useApp.getState().reveal).toMatchObject({ path: CH2, id: 'lq2-def-T' });
    // unlink: both lines lose the attribute
    await act(async () => { useApp.setState({ panes: openTab(emptyPanes(), MICRO), selectedCard: { path: MICRO, index: defT } }); });
    await click(row('linked to')!.querySelector('button[data-act="unlink"]'));
    await settle(async () => !(await disk(CH2)).includes('link=sm-def-T') && !(await disk(MICRO)).includes('link=lq2-def-T'));
    expect(useApp.getState().notice?.line).toBe('unlinked · 2 cards');
    unmount();
  });
});
