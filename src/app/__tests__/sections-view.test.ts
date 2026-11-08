// @vitest-environment jsdom
// Milestone 47 drawn, over the sample as it ships, on 2026-11-02 by the
// app's clock: the day's queue holds the typed-up derivation among the
// cards and the reading, by priority, its row saying where it stands; the
// queue's head says what the marks mean; the inspector's section part
// dismisses it (the heading's line goes, its cards stay due) and the
// heading offers to come back again; a dismissed section with boxes is
// brought back with a fresh due.

import { promises as fsp } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { act, createElement } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';
import { meta as metaOf, type Doc, type Heading } from '../../format/index.js';
import { docItems, sortQueue, type QueueItem } from '../../schedule/index.js';
import { nodeFs } from '../../vault/node-fs.js';
import { Vault } from '../../vault/index.js';
import { appNow, setClockDay } from '../clock.js';
import { useApp, type DocInfo } from '../store.js';

const SAMPLE = join(import.meta.dirname, '../../../samples/double-major');
const CANON = 'courses/fall-2026/phys-415-stat-mech/canonical-ensemble.md';
const DERIV = 'pset 4 #5, typed up from paper — two-level entropy straight from the Gibbs formula';

let vault: Vault;
let dir: string;
const docs: Record<string, DocInfo> = {};

vi.mock('../vault.js', async (orig) => {
  const real = await orig<typeof import('../vault.js')>();
  return { ...real, currentVault: () => vault };
});
const { Queue } = await import('../Queue.js');
const { SectionBlock } = await import('../Inspector.js');
(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

let host: HTMLDivElement;
let root: Root;
async function mount(el: React.ReactElement) {
  host = document.body.appendChild(document.createElement('div'));
  root = createRoot(host);
  await act(async () => { root.render(el); });
}
function unmount() { act(() => root.unmount()); host.remove(); }

async function build(): Promise<QueueItem[]> {
  const items: QueueItem[] = [];
  for (const p of vault.documents()) items.push(...docItems(p, (await vault.read(p)).doc, appNow()));
  return sortQueue(items, appNow());
}
const canon = async (): Promise<Doc> => (await vault.read(CANON)).doc;
const text = async () => fsp.readFile(join(dir, CANON), 'utf8');

beforeAll(async () => {
  setClockDay('2026-11-02');
  dir = await fsp.mkdtemp(join(tmpdir(), 'ilmi-sections-'));
  await fsp.cp(SAMPLE, dir, { recursive: true });
  vault = await Vault.open(nodeFs, dir);
  for (const p of vault.documents()) {
    const doc = (await vault.read(p)).doc;
    const m = metaOf(doc);
    docs[p] = { type: m.type, frozen: m.frozen, cards: doc.blocks.filter((b) => b.kind === 'card').length, due: 0 };
    if (m.title !== undefined) docs[p]!.title = m.title;
  }
  useApp.setState({ vault: dir, tree: vault.tree, files: vault.documents(), docs, order: vault.order, queue: await build(), examFilter: null, log: [], budget: 0 });
});
afterAll(async () => {
  setClockDay(null);
  vault.close();
  await fsp.rm(dir, { recursive: true, force: true });
});

describe('the day\'s queue', () => {
  it('says its count and order in one line, no legend of marks', async () => {
    await mount(createElement(Queue, { scope: 'today', active: false }));
    const n = host.querySelectorAll('.qlist li:not(.fold)').length;
    expect(host.querySelector('.queue .legend')?.textContent).toBe(`${n} due, in priority order`);
    // one line, never split by kind
    expect(host.querySelector('.queue .summary')).toBeNull();
    unmount();
  });

  it('interleaves the derivation with reading and cards, its row saying where it stands', async () => {
    await mount(createElement(Queue, { scope: 'today', active: false }));
    const rows = Array.from(host.querySelectorAll<HTMLElement>('.qlist li:not(.fold)'));
    const kinds = rows.map((r) => r.dataset.el);
    const at = rows.findIndex((r) => r.dataset.el === 'section' && r.textContent?.includes('pset 4 #5'));
    expect(at).toBeGreaterThan(0);
    const row = rows[at]!;
    expect(row.querySelector('.mark')?.textContent).toBe('§');
    expect(row.querySelector('.sec-title')?.textContent).toContain('pset 4 #5, typed up from paper');
    expect(row.querySelector('.ref-line')?.textContent).toBe('written, no cards yet · first time back');
    expect(row.querySelector('.kindtag')?.textContent).toBe('section');
    // not grouped by kind: cards before it and after it
    expect(kinds.slice(0, at)).toContain('card');
    expect(kinds.slice(at + 1)).toContain('card');
    // a book reads on from where it is, a note revisited says where it stands as a section does
    const marks = rows.map((r) => r.querySelector('.mark')?.textContent);
    expect(marks).toContain('“');
    unmount();
  });

  it('the section with cards is not due: it waits upcoming, back for the 3rd time', async () => {
    await mount(createElement(Queue, { scope: 'upcoming', active: false }));
    const row = Array.from(host.querySelectorAll<HTMLElement>('.qlist li[data-el="section"]')).find((r) => r.textContent?.includes('lecture 13'));
    expect(row?.querySelector('.ref-line')?.textContent).toBe('written, 4 cards · back for the 3rd time');
    expect(row?.querySelector('.due')?.textContent).toBe('in 7d');
    unmount();
  });
});

describe('the inspector\'s section part', () => {
  it('shows where it stands and when it is next; dismiss takes the line, its cards stay due; come back puts it back', async () => {
    const before = await text();
    const doc = await canon();
    const nth = doc.blocks.filter((b) => b.kind === 'heading' && b.text.trim()).findIndex((b) => (b as Heading).text === 'lecture 13 — two-level system, Schottky anomaly (Fri 10/2, Mon 10/5)');
    const at = { path: CANON, nth, text: 'lecture 13 — two-level system, Schottky anomaly (Fri 10/2, Mon 10/5)' };
    await mount(createElement(SectionBlock, { path: CANON, doc, at, now: appNow() }));
    const row = (k: string) => Array.from(host.querySelectorAll('.kvr')).find((r) => r.querySelector('dt')?.textContent === k)?.querySelector('dd')?.textContent;
    expect(row('stands')).toBe('written, 4 cards · back for the 3rd time');
    expect(row('next')).toBe('in 7d');
    const button = host.querySelector<HTMLButtonElement>('.sec-block button')!;
    expect(button.textContent).toBe('dismiss');
    await act(async () => { button.click(); });
    await vi.waitFor(async () => expect(await text()).not.toBe(before));
    const after = await text();
    expect(before.replace('<!-- read made=2026-10-19 due=2026-11-09 ivl=8 reps=2 -->\n', '')).toBe(after);
    unmount();
    // its cards are where they were, still scheduled
    const items = docItems(CANON, await canon(), appNow());
    expect(items.some((i) => i.kind === 'section' && i.heading.startsWith('lecture 13'))).toBe(false);
    expect(items.filter((i) => i.kind === 'card').length).toBe(docItems(CANON, (await import('../../format/index.js')).parse(before).doc, appNow()).filter((i) => i.kind === 'card').length);
    await mount(createElement(SectionBlock, { path: CANON, doc: await canon(), at, now: appNow() }));
    const again = host.querySelector<HTMLButtonElement>('.sec-block button')!;
    expect(again.textContent).toBe('come back');
    await act(async () => { again.click(); });
    await vi.waitFor(async () => expect(await text()).toContain('(Fri 10/2, Mon 10/5)\n<!-- read made=2026-11-02 due=2026-11-04 ivl=2 -->\n'));
    unmount();
  });

  it('move to… takes the section, its line and its cards to the end of another note (milestone 50)', async () => {
    const { moveSection } = await import('../sections.js');
    const MICRO = 'courses/fall-2026/phys-415-stat-mech/microcanonical-ensemble.md';
    const doc = await canon();
    const h = doc.blocks.find((b): b is Heading => b.kind === 'heading' && b.text.startsWith('lecture 13'))!;
    const at = { path: CANON, nth: -1, text: h.text };
    const span = (() => { let end = doc.blocks.indexOf(h) + 1; while (end < doc.blocks.length && !(doc.blocks[end]!.kind === 'heading' && (doc.blocks[end] as Heading).level <= h.level)) end++; return doc.blocks.slice(doc.blocks.indexOf(h), end); })();
    expect(span.filter((b) => b.kind === 'card')).toHaveLength(4);
    const targetBefore = (await vault.read(MICRO)).doc.blocks.length;
    // the part offers it second, after the state's own action
    await mount(createElement(SectionBlock, { path: CANON, doc, at, now: appNow() }));
    const buttons = Array.from(host.querySelectorAll<HTMLButtonElement>('.sec-block button'));
    expect(buttons.map((b) => b.textContent)).toEqual(['dismiss', 'move to…']);
    await act(async () => { buttons[1]!.click(); });
    expect(useApp.getState().sectionMove).toEqual(at);
    expect(useApp.getState().paletteOpen).toBe(true);
    useApp.setState({ paletteOpen: false, sectionMove: null });
    unmount();
    const index = await moveSection(at, MICRO);
    expect(index).toBe(targetBefore);
    const target = (await vault.read(MICRO)).doc;
    expect(target.blocks.slice(targetBefore)).toEqual(span);
    const left = await canon();
    expect(left.blocks.some((b) => b.kind === 'heading' && b.text === h.text)).toBe(false);
    expect(left.blocks.length).toBe(doc.blocks.length - span.length);
    // the cards travelled: the same ids, the same lines
    const ids = (d: Doc) => d.blocks.flatMap((b) => (b.kind === 'card' && b.id ? [b.id] : []));
    for (const id of ids({ blocks: span } as Doc)) { expect(ids(target)).toContain(id); expect(ids(left)).not.toContain(id); }
  });

  it('a dismissed section with boxes reads dismissed, and bring back gives it a fresh due', async () => {
    await vault.update(CANON, (d) => {
      const h = d.blocks.find((b): b is Heading => b.kind === 'heading' && b.text.startsWith('lecture 12'))!;
      h.read = { made: '2026-10-20', boxes: '41:0.120:0.122:0.770:0.145' };
    });
    const doc = await canon();
    const h = doc.blocks.find((b): b is Heading => b.kind === 'heading' && b.text.startsWith('lecture 12'))!;
    await mount(createElement(SectionBlock, { path: CANON, doc, at: { path: CANON, nth: -1, text: h.text }, now: appNow() }));
    const row = (k: string) => Array.from(host.querySelectorAll('.kvr')).find((r) => r.querySelector('dt')?.textContent === k)?.querySelector('dd')?.textContent;
    expect(row('stands')).toBe('written, 4 cards · dismissed');
    expect(row('next')).toBe('never: dismissed');
    const button = host.querySelector<HTMLButtonElement>('.sec-block button')!;
    expect(button.textContent).toBe('bring back');
    await act(async () => { button.click(); });
    await vi.waitFor(async () => expect(await text()).toContain('<!-- read made=2026-10-20 due=2026-11-04 ivl=2 boxes=41:0.120:0.122:0.770:0.145 -->'));
    unmount();
  });
});

describe('the inspector\'s interval field (milestone 51)', () => {
  it('writes ivl and due = today + ivl on the section\'s line, nothing else', async () => {
    const doc = await canon();
    // lecture 12 as the test above left it: brought back on its cadence, its boxes kept (lecture 13 was moved away)
    const h = doc.blocks.find((b): b is Heading => b.kind === 'heading' && b.text.startsWith('lecture 12'))!;
    expect(h.read).toEqual({ made: '2026-10-20', due: '2026-11-04', ivl: 2, boxes: '41:0.120:0.122:0.770:0.145' });
    await mount(createElement(SectionBlock, { path: CANON, doc, at: { path: CANON, nth: -1, text: h.text }, now: appNow() }));
    const field = host.querySelector<HTMLInputElement>('.ivl-field')!;
    expect(field.value).toBe('2');
    await act(async () => {
      Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value')!.set!.call(field, '100');
      field.dispatchEvent(new Event('input', { bubbles: true }));
      field.dispatchEvent(new FocusEvent('focusout', { bubbles: true }));
    });
    // come back in 100 days: the rest of the line stands
    await vi.waitFor(async () => expect(await text()).toContain('<!-- read made=2026-10-20 due=2027-02-10 ivl=100 boxes=41:0.120:0.122:0.770:0.145 -->\n'));
    unmount();
  });
});
