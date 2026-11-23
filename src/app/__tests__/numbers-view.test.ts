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
  // the sample's reviews end in november 2026: the clock held there, so the weeks shown hold them whatever day the test runs
  vi.useFakeTimers({ toFake: ['Date'] });
  vi.setSystemTime(new Date('2026-11-20T12:00:00Z'));
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
  vi.useRealTimers();
  vault.close();
  await fsp.rm(dir, { recursive: true, force: true });
});

const texts = (sel: string) => Array.from(host.querySelectorAll(sel)).map((e) => e.textContent ?? '');

describe('numbers', () => {
  it('the vocab deck: cards · numbers, a year of days and the days ahead as cells, the rest as tables', async () => {
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
    // a year of days behind, Monday-first weeks as columns, a cell a day; the days ahead in the same cells
    const past = host.querySelector('.nb-heat[data-of="past"]')!;
    expect(past.querySelectorAll('.nb-grid > *')).toHaveLength(53 * 7);
    const cells = Array.from(past.querySelectorAll<HTMLElement>('button.nb-cell'));
    expect(cells.length).toBeGreaterThan(300);
    expect(cells.every((c) => /^[0-4]$/.test(c.dataset.l!) && /^\d{4}-\d\d-\d\d$/.test(c.dataset.day!))).toBe(true);
    // each says its date and counts, to the pointer and to a reader
    const busy = cells.filter((c) => Number(c.dataset.n) > 0);
    expect(busy.length).toBeGreaterThan(100);
    expect(busy[0]!.title).toMatch(/^[a-z]{3}, [a-z]{3} \d+ · \d+ reviews?/);
    expect(busy[0]!.getAttribute('aria-label')).toBe(busy[0]!.title);
    // one stop for Tab, the arrows walk from it
    expect(cells.filter((c) => c.tabIndex === 0)).toHaveLength(1);
    expect(host.querySelectorAll('.nb-heat[data-of="ahead"] .nb-grid > *')).toHaveLength(26 * 7);
    expect(host.querySelectorAll('.nb-days[data-of="ahead"] tbody tr')).toHaveLength(4);
    // the lines beside it
    const sums = Object.fromEntries(Array.from(host.querySelectorAll<HTMLElement>('.nb-sum [data-sum]')).map((e) => [e.dataset.sum, e.querySelector('dd')!.textContent!]));
    expect(sums.studied).toMatch(/^\d+ of \d+ days$/);
    expect(sums.best).toMatch(/^[a-z]{3} \d+, \d+ reviews$/);
    expect(sums.run).toMatch(/^\d+ days?, longest \d+$/);
    expect(sums.retention).toMatch(/^\d+% of [\d,]+ reviews$/);
    expect(sums.answers).toMatch(/^again \d+%, hard \d+%, good \d+%, easy \d+%$/);
    expect(sums.today).toMatch(/^\d+/);
    expect(texts('.nb-periods tbody th')).toEqual(['this week', 'this month', 'this year']);
    // a day pressed lists its reviews, a row a card, each with the grades it got; pressed again it closes
    const top = busy.reduce((a, b) => (Number(b.dataset.n) > Number(a.dataset.n) ? b : a));
    await act(async () => { top.click(); });
    const panel = host.querySelector<HTMLElement>('.nb-day[data-of="past"]')!;
    expect(panel.dataset.day).toBe(top.dataset.day);
    expect(panel.querySelector('.nb-day-head')!.textContent).toContain(`${top.dataset.n} review`);
    const rows = Array.from(panel.querySelectorAll('.nb-rows li'));
    expect(rows.length).toBeGreaterThan(0);
    expect(rows.every((r) => /^(again|hard|good|easy)(, (again|hard|good|easy))*$/.test(r.querySelector('.nb-note')!.textContent!))).toBe(true);
    expect(host.querySelector('button.nb-cell[data-on="1"]')).toBe(host.querySelector(`.nb-heat[data-of="past"] [data-day="${top.dataset.day}"]`));
    // the arrows move the focus a day and a week
    const grid = past.querySelector<HTMLElement>('.nb-grid')!;
    const at = host.querySelector<HTMLElement>(`.nb-heat[data-of="past"] [data-day="${top.dataset.day}"]`)!;
    at.focus();
    await act(async () => { at.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowLeft', bubbles: true, cancelable: true })); });
    expect(grid.contains(document.activeElement)).toBe(true);
    expect((document.activeElement as HTMLElement).dataset.day).not.toBe(top.dataset.day);
    expect(host.querySelector('.nb-hot')!.textContent).toMatch(/^[a-z]{3}, [a-z]{3} \d+ · /);
    await act(async () => { host.querySelector<HTMLElement>(`.nb-heat[data-of="past"] [data-day="${top.dataset.day}"]`)!.click(); });
    expect(host.querySelector('.nb-day')).toBeNull();
    // a day ahead lists what comes due on it
    const due = Array.from(host.querySelectorAll<HTMLElement>('.nb-heat[data-of="ahead"] button.nb-cell')).find((c) => Number(c.dataset.n) > 0)!;
    await act(async () => { due.click(); });
    expect(host.querySelectorAll('.nb-day[data-of="ahead"] .nb-rows li').length).toBe(Math.min(100, Number(due.dataset.n)));
    await act(async () => { due.click(); });
    // retention by week and by age, as percentages
    expect(texts('.nb-rates .nb-rate').some((t) => /^\d+%$/.test(t))).toBe(true);
    expect(texts('.nb-spread tbody th')).toEqual(['stability', 'difficulty']);
    expect(host.querySelector('[data-sec="time"]')!.textContent).toMatch(/\d+ s a review/);
    // cells and type: no canvas, no svg chart, no stat tiles
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
    expect(host.querySelectorAll('.nb-days tbody tr').length).toBe(4);
    expect(host.querySelectorAll('.nb-heat')).toHaveLength(2);
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

describe('the reading layer', () => {
  const click = async (el: Element) => { await act(async () => { (el as HTMLElement).click(); }); };
  const layer = () => texts('.nb-layer button[data-on="1"]');

  it('cards · reading over the year: off by default, its own grid and lines, the cards\' figures not shown twice and not added to', async () => {
    useApp.setState({ lensViews: { [VOCAB]: 'numbers' }, readings: [], numbersLayer: 'cards' });
    await mount(createElement(Lens, { id: VOCAB, active: true, onOpen: () => {} }));
    expect(texts('.nb-layer button')).toEqual(['cards', 'reading']);
    expect(layer()).toEqual(['cards']);
    const reviews = host.querySelector('[data-sec="past"] .nb-sum')!.textContent;
    expect(host.querySelector('[data-sec="reading"]')).toBeNull();
    await click(host.querySelector('.nb-layer button[data-layer="reading"]')!);
    expect(layer()).toEqual(['reading']);
    expect(useApp.getState().numbersLayer).toBe('reading');
    // nothing logged yet: the toggle is there, the grid is today alone and says so
    expect(host.querySelector('[data-sec="past"]')).toBeNull();
    const sec = host.querySelector('[data-sec="reading"]')!;
    expect(sec.querySelector('.nb-hot')!.textContent).toBe('no reading logged yet');
    expect(sec.querySelectorAll('button.nb-cell')).toHaveLength(1);
    expect(sec.querySelector('[data-sum="made"] dd')!.textContent).toBe('nothing yet');
    // the forecast and the rest are the cards', as they were
    expect(host.querySelector('[data-sec="ahead"]')).not.toBeNull();
    expect(host.querySelector('.nb-line')!.textContent).toMatch(/^178 cards/);
    await click(host.querySelector('.nb-layer button[data-layer="cards"]')!);
    expect(host.querySelector('[data-sec="past"] .nb-sum')!.textContent).toBe(reviews);
    unmount();
  });

  it('a folder of documents without cards has its reading: a day says what was read and made, pressed it lists them, a row opens its document at the section', async () => {
    // a document with no cards and nothing under it, as its own lens
    const bare = Object.keys(docs).find((p) => docs[p]!.cards === 0 && !Object.keys(docs).some((q) => q.startsWith(`${p.replace(/\.md$/, '')}/`)) && bodies.get(p)!.blocks.some((b) => b.kind === 'heading'))!;
    const heading = bodies.get(bare)!.blocks.find((b) => b.kind === 'heading')!;
    const sec = heading.kind === 'heading' ? heading.text : '';
    const now = new Date();
    const iso = (h: number) => `${new Date(now.getFullYear(), now.getMonth(), now.getDate(), h).toISOString().slice(0, 19)}Z`;
    const day = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
    useApp.setState({
      lensViews: { [bare]: 'numbers' }, numbersLayer: 'cards', panes: emptyPanes(), reveal: null,
      readings: [
        { at: iso(0), doc: bare, read: 'pass', to: 3 },
        { at: iso(0).replace(':00Z', ':20Z'), doc: bare, read: 'section', sec },
        { at: iso(0).replace(':00Z', ':40Z'), doc: bare, read: 'later' },
        // another document's reading is not this lens's
        { at: iso(0).replace(':00Z', ':50Z'), doc: VOCAB, read: 'pass' },
      ],
    });
    const { NumbersView } = await import('../NumbersLens.js');
    await mount(createElement(NumbersView, { home: bare }));
    expect(host.querySelector('.empty')).toBeNull();
    expect(host.querySelector('.nb-counts')!.textContent).toBe('no cards');
    expect(layer()).toEqual(['reading']);
    expect(host.querySelector<HTMLButtonElement>('.nb-layer button[data-layer="cards"]')!.disabled).toBe(true);
    expect(host.querySelector('[data-sec="ahead"]')).toBeNull();
    const cell = host.querySelector<HTMLElement>(`[data-sec="reading"] button.nb-cell[data-day="${day}"]`)!;
    expect(cell.dataset.n).toBe('2');
    expect(cell.title).toMatch(/^[a-z]{3}, [a-z]{3} \d+ · 1 read, 1 made$/);
    expect(host.querySelector('[data-sum="read"] dd')!.textContent).toMatch(/^1 of 1 day, logged since /);
    expect(host.querySelector('[data-sum="passes"] dd')!.textContent).toBe('1 time');
    expect(host.querySelector('[data-sum="made"] dd')!.textContent).toBe('1 section');
    expect(texts('.nb-periods[data-of="reading"] tr[data-period="this week"] td')).toEqual(['1', '0', '1', '']);
    await click(cell);
    const rows = Array.from(host.querySelectorAll<HTMLElement>('.nb-day[data-of="reading"] .nb-rows li'));
    expect(rows.map((r) => [r.dataset.read, r.querySelector('.nb-note')!.textContent, r.querySelector('.nb-where')?.textContent ?? null])).toEqual([['pass', 'read on', null], ['section', 'section', sec], ['later', 'later', null]]);
    await click(rows[1]!.querySelector('button')!);
    expect(useApp.getState().reveal).toMatchObject({ path: bare, heading: sec });
    const panes = useApp.getState().panes;
    expect(panes.panes.flatMap((p) => p.tabs.map((t) => t.id))).toContain(bare);
    unmount();
    useApp.setState({ readings: [], numbersLayer: 'cards', reveal: null });
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
    expect(texts('[data-opt="leechAction"] .opt-action button')).toEqual(['suspended', 'marked']);
    expect(block().querySelector('[data-opt="leechAction"] .opt-action button[data-active="1"]')!.textContent).toBe('marked');
    // a card reviewed today may be due again today unless a document says otherwise
    expect(texts('[data-opt="sameDay"] .opt-action button')).toEqual(['today', 'tomorrow']);
    expect(block().querySelector('[data-opt="sameDay"] .opt-action button[data-active="1"]')!.textContent).toBe('today');
    unmount();
  });
});
