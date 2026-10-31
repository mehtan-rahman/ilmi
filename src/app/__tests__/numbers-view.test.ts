// @vitest-environment jsdom
// Milestone 42 drawn: the vocab deck's and a course notebook's numbers from
// the sample's seeded review log, set as type in tables (no charts, no
// tiles), the lens's `items · cards · numbers`; and the inspector's options
// where they apply, each with where it comes from.

import { promises as fsp } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { act, createElement } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';
import { meta as metaOf, parse, serialize, setField, type Doc } from '../../format/index.js';
import { resolveOptions } from '../../schedule/index.js';
import { nodeFs } from '../../vault/node-fs.js';
import { Vault } from '../../vault/index.js';
import { emptyPanes, openTab } from '../panes.js';
import { useApp, type DocInfo } from '../store.js';

const SAMPLE = join(import.meta.dirname, '../../../samples/double-major');
const VOCAB = 'arabic/vocabulary.md';
const QM = 'courses/fall-2026/phys-412-quantum-ii';

let vault: Vault;
let dir: string;
const bodies = new Map<string, Doc>();
const docs: Record<string, DocInfo> = {};

vi.mock('../vault.js', async (orig) => {
  const real = await orig<typeof import('../vault.js')>();
  return {
    ...real,
    currentVault: () => vault,
    docsOf: (paths: readonly string[]) => paths.filter((p) => bodies.has(p)).map((p) => [p, bodies.get(p)!] as [string, Doc]),
    optionsAt: (p: string) => resolveOptions(p, (q) => (bodies.has(q) ? metaOf(bodies.get(q)!) : undefined)),
  };
});
const { Lens } = await import('../Lenses.js');
const { Inspector } = await import('../Inspector.js');
(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
(globalThis as { ResizeObserver?: unknown }).ResizeObserver ??= class { observe() {} unobserve() {} disconnect() {} };
Element.prototype.scrollIntoView ??= function scrollIntoView() {};

let host: HTMLDivElement;
let root: Root;
async function mount(el: React.ReactElement, cls = 'pane-body') {
  host = document.body.appendChild(document.createElement('div'));
  host.className = cls;
  root = createRoot(host);
  await act(async () => { root.render(el); });
}
function unmount() { act(() => root.unmount()); host.remove(); }

beforeAll(async () => {
  dir = await fsp.mkdtemp(join(tmpdir(), 'ilmi-numbers-'));
  await fsp.cp(SAMPLE, dir, { recursive: true });
  vault = await Vault.open(nodeFs, dir);
  for (const p of vault.documents()) {
    const doc = (await vault.read(p)).doc;
    bodies.set(p, doc);
    const m = metaOf(doc);
    docs[p] = { type: m.type, frozen: m.frozen, cards: doc.blocks.filter((b) => b.kind === 'card').length, due: 0 };
    if (m.title !== undefined) docs[p]!.title = m.title;
    if (m.tabs) docs[p]!.tabs = true;
  }
  const reviews = await vault.loadReviews();
  useApp.setState({ vault: dir, tree: vault.tree, files: vault.documents(), docs, order: vault.order, queue: [], reviews, lensViews: {}, deckViews: {}, selectedCard: null, reveal: null, folds: {}, railFolded: {} });
});
afterAll(async () => {
  vault.close();
  await fsp.rm(dir, { recursive: true, force: true });
});

const texts = (sel: string) => Array.from(host.querySelectorAll(sel)).map((e) => e.textContent ?? '');

describe('numbers', () => {
  it('the vocab deck: cards · numbers, the history from the log as tables, nothing drawn', async () => {
    useApp.setState({ lensViews: { [VOCAB]: 'numbers' } });
    await mount(createElement(Lens, { id: VOCAB, active: true, onOpen: () => {} }));
    expect(texts('.fv-view button')).toEqual(['cards', 'numbers']);
    expect(host.querySelector('.fv-view button[data-on="1"]')!.textContent).toBe('numbers');
    expect(host.querySelector('.deck-list, .deck-row')).toBeNull();
    const line = host.querySelector('.nb-line')!.textContent!;
    expect(line).toMatch(/^178 cards, \d+ never seen/);
    // the counts are of cards and add up
    const [, all, fresh, sus] = /^(\d+) cards, (\d+) never seen(?:, (\d+) suspended)?/.exec(line)!;
    expect(Number(fresh) + Number(sus ?? 0)).toBeLessThanOrEqual(Number(all));
    expect(line).toContain('logged since 2025-09-');
    // four weeks back and four ahead, Monday first, a total each
    expect(host.querySelectorAll('.nb-days[data-of="past"] tbody tr')).toHaveLength(4);
    expect(host.querySelectorAll('.nb-days[data-of="ahead"] tbody tr')).toHaveLength(4);
    expect(texts('.nb-days[data-of="past"] thead th').slice(1)).toEqual(['m', 't', 'w', 't', 'f', 's', 's', 'week']);
    const pastTotal = texts('.nb-days[data-of="past"] .nb-total').slice(1).map(Number).reduce((a, b) => a + b, 0);
    expect(pastTotal).toBeGreaterThan(50);
    // retention by week and by age, as percentages
    expect(texts('.nb-rates .nb-rate').some((t) => /^\d+%$/.test(t))).toBe(true);
    expect(texts('.nb-spread tbody th')).toEqual(['stability', 'difficulty']);
    expect(host.querySelector('[data-sec="time"]')!.textContent).toMatch(/\d+ s a review/);
    // the brief's bans: no canvas, no svg chart, no stat tiles
    expect(host.querySelector('canvas, svg:not(.katex svg)')).toBeNull();
    unmount();
  });

  it('a course notebook: its children as a folder lens, items · cards · numbers, the notebook\'s own cards counted', async () => {
    useApp.setState({ lensViews: { [QM]: 'numbers' } });
    await mount(createElement(Lens, { id: QM, active: true, onOpen: () => {} }));
    expect(texts('.fv-view button')).toEqual(['items', 'cards', 'numbers']);
    const n = Number(/^(\d+) cards/.exec(host.querySelector('.nb-counts')!.textContent!)![1]);
    const under = vault.documents().filter((p) => p === `${QM}.md` || p.startsWith(`${QM}/`)).reduce((k, p) => k + docs[p]!.cards, 0);
    expect(n).toBe(under);
    expect(host.querySelectorAll('.nb-days tbody tr').length).toBe(8);
    unmount();
  });

  it('failed most: the leeches listed with their lapses, from half the threshold up', async () => {
    await mount(createElement(Lens, { id: '', active: true, onOpen: () => {} }));
    await act(async () => { useApp.setState({ lensViews: { '': 'numbers' } }); });
    const rows = Array.from(host.querySelectorAll<HTMLElement>('.nb-leeches li'));
    expect(rows.length).toBeGreaterThan(3);
    const lapses = rows.map((r) => Number(r.querySelector('.nb-lapses')!.textContent));
    expect(lapses).toEqual([...lapses].sort((a, b) => b - a));
    expect(Math.min(...lapses)).toBeGreaterThanOrEqual(4);
    // each names its card: the front drawn (formulas by KaTeX, Arabic in its direction) and where it lives
    for (const r of rows) {
      expect(r.querySelector('.nb-front')!.textContent!.trim().length).toBeGreaterThan(0);
      expect(r.querySelector('.nb-where')!.textContent!.trim().length).toBeGreaterThan(0);
    }
    expect(rows.some((r) => r.querySelector('.nb-front[dir="rtl"]') || r.querySelector('.nb-front .katex'))).toBe(true);
    unmount();
  });
});

describe('a failed-most row', () => {
  it('opens its card in the deck: the lens turns to its cards, the card selected', async () => {
    useApp.setState({ lensViews: { [VOCAB]: 'numbers' }, panes: openTab(emptyPanes(), VOCAB) });
    await mount(createElement(Lens, { id: VOCAB, active: true, onOpen: () => {} }));
    const row = host.querySelector<HTMLElement>('.nb-leeches li')!;
    const block = Number(row.dataset.block);
    await act(async () => { row.querySelector('button')!.click(); });
    for (let k = 0; k < 50 && useApp.getState().selectedCard?.index !== block; k++) await act(async () => { await new Promise((r) => setTimeout(r, 10)); });
    expect(useApp.getState().lensViews[VOCAB]).toBe('cards');
    expect(useApp.getState().selectedCard).toEqual({ path: VOCAB, index: block });
    expect(host.querySelector('.deck-row')).not.toBeNull();
    unmount();
  });
});

describe('the inspector\'s options', () => {
  it('on a notebook, set there; on a page under it, inherited and said where from; on a deck elsewhere, the defaults', async () => {
    // the notebook sets two options in its front-matter
    const nb = `${QM}.md`;
    const doc = bodies.get(nb)!;
    setField(doc, 'new-per-day', 5);
    setField(doc, 'leech', 4);
    bodies.set(nb, parse(serialize(doc)).doc);
    useApp.setState({ panes: openTab(emptyPanes(), nb), selectedCard: null, docs: { ...docs } });
    await mount(createElement(Inspector), 'shell');
    const block = () => Array.from(host.querySelectorAll<HTMLElement>('.insp .block')).find((b) => b.querySelector('h6')?.textContent === 'options')!;
    expect(block()).toBeTruthy();
    expect(block().querySelector<HTMLInputElement>('[data-opt="newPerDay"] input')!.value).toBe('5');
    expect(block().querySelector('.opt-from')).toBeNull();
    unmount();

    const page = `${QM}/wkb-approximation.md`;
    useApp.setState({ panes: openTab(emptyPanes(), page) });
    await mount(createElement(Inspector), 'shell');
    const field = block().querySelector<HTMLInputElement>('[data-opt="newPerDay"] input')!;
    expect([field.value, field.placeholder]).toEqual(['', '5']);
    expect(block().querySelector('[data-opt="newPerDay"] .opt-from')!.textContent).toBe('from quantum II');
    expect(block().querySelector<HTMLInputElement>('[data-opt="retention"] input')!.placeholder).toBe('0.9');
    expect(block().querySelector('[data-opt="retention"] .opt-from')).toBeNull();
    unmount();

    useApp.setState({ panes: openTab(emptyPanes(), VOCAB) });
    await mount(createElement(Inspector), 'shell');
    expect(block().querySelector<HTMLInputElement>('[data-opt="newPerDay"] input')!.placeholder).toBe('20');
    expect(block().querySelector<HTMLInputElement>('[data-opt="reviewsPerDay"] input')!.placeholder).toBe('none');
    expect(texts('.opt-action button')).toEqual(['suspended', 'marked']);
    expect(block().querySelector('.opt-action button[data-active="1"]')!.textContent).toBe('marked');
    unmount();
  });
});
