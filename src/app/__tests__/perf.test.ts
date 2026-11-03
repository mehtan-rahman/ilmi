// @vitest-environment jsdom
// Milestone 40's measurements over the sample collection: the collection's
// open (walk, read, parse, the queue), the queue's build, a long note's
// editor state, the cost of one keystroke there (the transaction with every
// plugin's decorations, and the write's `fromDoc` + `serialize`), the deck
// browser drawn over the vocab deck and over the whole collection, a row
// clicked there, and the tree with every row open. jsdom draws no pixels,
// so these are the script's costs, not paint. Each logs `perf: …` and holds
// a loose bound (what a person would feel, with room for a slow machine and
// the rest of the suite running beside it); milestone 40's notes have the
// numbers from a run alone.

import { appendFileSync, promises as fsp } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { act, createElement } from 'react';
import { createRoot } from 'react-dom/client';
import { EditorView } from 'prosemirror-view';
import { TextSelection } from 'prosemirror-state';
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';
import { meta as metaOf, parse, serialize, type Doc } from '../../format/index.js';
import { fromDoc, makeState } from '../../reader/index.js';
import { docItems, isDue, sortQueue, type QueueItem } from '../../schedule/index.js';
import { nodeFs } from '../../vault/node-fs.js';
import { Vault } from '../../vault/index.js';
import { folderPaths } from '../names.js';
import { treeRows } from '../treeModel.js';
import { useApp, type DocInfo } from '../store.js';

const SAMPLE = join(import.meta.dirname, '../../../samples/double-major');
const LONG = 'courses/fall-2026/phys-412-quantum-ii/nondegenerate-perturbation-theory.md';
const VOCAB = 'arabic/vocabulary.md';

let vault: Vault;
const bodies = new Map<string, Doc>();
vi.mock('../vault.js', async (orig) => {
  const real = await orig<typeof import('../vault.js')>();
  return {
    ...real,
    currentVault: () => vault,
    docsOf: (paths: readonly string[]) => paths.filter((p) => bodies.has(p)).map((p) => [p, bodies.get(p)!] as [string, Doc]),
  };
});
const { Lens } = await import('../Lenses.js');
const { Tree } = await import('../Tree.js');
(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

const ms = (t0: number) => Math.round((performance.now() - t0) * 10) / 10;
// the lines go to the console, and to `ILMI_PERF_OUT` when set (a passing test's console is not shown)
const log = (what: string, n: number) => {
  console.log(`perf: ${what} ${n} ms`);
  if (process.env.ILMI_PERF_OUT) appendFileSync(process.env.ILMI_PERF_OUT, `${what}: ${n} ms\n`);
  return n;
};
(globalThis as { ResizeObserver?: unknown }).ResizeObserver ??= class { observe() {} unobserve() {} disconnect() {} };

let dir: string;
const now = new Date('2026-10-30T09:00:00');

function infoOf(doc: Doc, items: QueueItem[]): DocInfo {
  const m = metaOf(doc);
  const due = new Set<number>();
  for (const i of items) if (i.kind === 'card' && isDue(i, now)) due.add(i.block);
  const out: DocInfo = { type: m.type, frozen: m.frozen, cards: doc.blocks.filter((b) => b.kind === 'card').length, due: due.size };
  if (m.title !== undefined) out.title = m.title;
  if (m.read) out.read = m.read;
  if (m.write) out.write = m.write;
  if (m.tabs) out.tabs = true;
  return out;
}

// The budgets are for the development machine (an Apple Silicon Mac); a shared
// CI runner is slower by an unknown factor, so there they would only be noise.
describe.skipIf(!!process.env.CI)('the sample, measured', () => {
  beforeAll(async () => {
    dir = await fsp.mkdtemp(join(tmpdir(), 'ilmi-perf-'));
    await fsp.cp(SAMPLE, dir, { recursive: true });
  });
  afterAll(async () => {
    vault?.close();
    await fsp.rm(dir, { recursive: true, force: true });
  });

  it('opens the collection: walk, read, parse every file, the queue', async () => {
    const t0 = performance.now();
    vault = await Vault.open(nodeFs, dir);
    const docs: Record<string, DocInfo> = {};
    const items: QueueItem[] = [];
    for (const p of vault.documents()) {
      const doc = (await vault.read(p)).doc;
      bodies.set(p, doc);
      const own = docItems(p, doc, now);
      items.push(...own);
      docs[p] = infoOf(doc, own);
    }
    sortQueue(items, now);
    const open = log('collection open', ms(t0));
    useApp.setState({ vault: dir, tree: vault.tree, files: vault.documents(), docs, order: vault.order, deckViews: {}, selectedCard: null, reveal: null, folds: {}, railFolded: {} });
    expect(open).toBeLessThan(3000);
    expect(Object.values(docs).reduce((n, d) => n + d.cards, 0)).toBeGreaterThan(700);
  });

  it("builds the queue", () => {
    const runs: number[] = [];
    for (let k = 0; k < 5; k++) {
      const t0 = performance.now();
      const out: QueueItem[] = [];
      for (const [p, doc] of bodies) out.push(...docItems(p, doc, now));
      sortQueue(out, now);
      runs.push(ms(t0));
    }
    expect(log('queue build', Math.min(...runs))).toBeLessThan(300);
  });

  it('a long note: its editor state, and one keystroke', () => {
    const doc = bodies.get(LONG)!;
    const t0 = performance.now();
    const state = makeState(doc.blocks, { frozen: () => false, pos: null });
    const mount = document.createElement('div');
    document.body.appendChild(mount);
    const view = new EditorView(mount, { state });
    log('long note state + view (no node views)', ms(t0));
    // the caret at the end of the third paragraph
    let at = 0;
    let n = 0;
    view.state.doc.forEach((node, off) => { if (node.type.name === 'paragraph' && ++n === 3) at = off + node.nodeSize - 1; });
    view.dispatch(view.state.tr.setSelection(TextSelection.create(view.state.doc, at)));
    const keys: number[] = [];
    const writes: number[] = [];
    const head = parse('').doc;
    for (let k = 0; k < 40; k++) {
      const t1 = performance.now();
      view.dispatch(view.state.tr.insertText('x'));
      keys.push(performance.now() - t1);
      const t2 = performance.now();
      head.blocks = fromDoc(view.state.doc);
      serialize(head);
      writes.push(performance.now() - t2);
    }
    const avg = (a: number[]) => Math.round((a.reduce((x, y) => x + y, 0) / a.length) * 10) / 10;
    const key = log('keystroke (transaction + decorations + DOM)', avg(keys));
    const write = log('keystroke write (fromDoc + serialize)', avg(writes));
    view.destroy();
    mount.remove();
    expect(key + write).toBeLessThan(50 * 4);
  });

  const draw = async (id: string): Promise<{ host: HTMLElement; took: number; unmount: () => void }> => {
    const host = document.createElement('div');
    host.className = 'pane-body';
    document.body.appendChild(host);
    const r = createRoot(host);
    const t0 = performance.now();
    await act(async () => { r.render(createElement(Lens, { id, active: true, onOpen: () => {} })); });
    return { host, took: ms(t0), unmount: () => { act(() => r.unmount()); host.remove(); } };
  };

  it('opens the long note in the reader', async () => {
    const d = await draw(LONG);
    // the reader reads its file and builds the page after the first render
    const t0 = performance.now();
    for (let k = 0; k < 100 && !d.host.querySelector('.draft-doc'); k++) await act(async () => { await new Promise((r) => setTimeout(r, 5)); });
    expect(d.host.querySelector('.draft-doc')).not.toBeNull();
    const took = log('long note in the reader', Math.round(d.took + ms(t0)));
    d.unmount();
    expect(took).toBeLessThan(1500);
  });

  it('the deck browser over the vocab deck and over everything, and a row clicked', async () => {
    const v = await draw(VOCAB);
    expect(v.host.querySelectorAll('.deck-row').length).toBe(178);
    log('deck browser, vocab (178)', v.took);
    const row = v.host.querySelectorAll<HTMLElement>('.deck-row')[3]!;
    const t0 = performance.now();
    await act(async () => { row.dispatchEvent(new MouseEvent('click', { bubbles: true })); });
    log('deck browser, vocab, a row clicked', ms(t0));
    v.unmount();

    const all = await draw('');
    const btn = Array.from(all.host.querySelectorAll<HTMLElement>('.fv-view button')).find((b) => b.textContent === 'cards')!;
    const t1 = performance.now();
    await act(async () => { btn.dispatchEvent(new MouseEvent('click', { bubbles: true })); });
    const took = log('deck browser, every card (first rows drawn)', ms(t1));
    // the rest are drawn in chunks on timers
    for (let k = 0; k < 200 && all.host.querySelectorAll('.deck-row').length < 700; k++) await act(async () => { await new Promise((r) => setTimeout(r, 0)); });
    log('deck browser, every card (all drawn)', ms(t1));
    const rows = all.host.querySelectorAll<HTMLElement>('.deck-row');
    expect(rows.length).toBeGreaterThan(700);
    const t2 = performance.now();
    await act(async () => { rows[10]!.dispatchEvent(new MouseEvent('click', { bubbles: true })); });
    log('deck browser, every card, a row clicked', ms(t2));
    all.unmount();
    // loose: the whole suite runs beside it (alone, about 240 ms)
    expect(took).toBeLessThan(3000);
  });

  it('the tree with every row open', async () => {
    const open: Record<string, true> = {};
    for (const p of folderPaths(vault.tree)) open[p] = true;
    for (const p of vault.documents()) open[p] = true;
    const t0 = performance.now();
    const rows = treeRows(vault.tree, open, vault.order);
    log(`tree rows (${rows.length})`, ms(t0));
    useApp.setState({ open });
    const host = document.createElement('div');
    document.body.appendChild(host);
    const r = createRoot(host);
    const t1 = performance.now();
    await act(async () => { r.render(createElement(Tree, { activeId: undefined, onOpen: () => {} })); });
    const took = log('tree drawn, every row open', ms(t1));
    expect(host.querySelectorAll('.row').length).toBeGreaterThan(70);
    act(() => r.unmount());
    host.remove();
    expect(took).toBeLessThan(1000);
  });
});
