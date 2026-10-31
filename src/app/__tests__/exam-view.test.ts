// @vitest-environment jsdom
// Milestone 43 drawn, over the sample as it ships (quantum II: midterm 2 on
// the 18th, the final on 14 december), on 2026-10-30 by the app's clock:
// the queue says quietly which rows were brought before the midterm and can
// be narrowed to it; the notebook's top row and the inspector show the next
// exam and what is left before it.

import { promises as fsp } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { act, createElement } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';
import { meta as metaOf, type Doc, type Meta } from '../../format/index.js';
import { activeExam, docItems, examQueue, examsAt, meterQueue, resolveOptions, spentToday, type QueueItem } from '../../schedule/index.js';
import { nodeFs } from '../../vault/node-fs.js';
import { Vault } from '../../vault/index.js';
import { appNow, setClockDay } from '../clock.js';
import { useApp, type DocInfo } from '../store.js';

const SAMPLE = join(import.meta.dirname, '../../../samples/double-major');
const QM = 'courses/fall-2026/phys-412-quantum-ii';
const BOOK = `${QM}/halvorsen-ch-9-wkb.md`;

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
    openNode: (id: string) => { opened.push(id); },
  };
});
const { Queue } = await import('../Queue.js');
const { ExamBlock } = await import('../Inspector.js');
const { ExamTag } = await import('../ExamTag.js');
(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

let host: HTMLDivElement;
let root: Root;
async function mount(el: React.ReactElement) {
  host = document.body.appendChild(document.createElement('div'));
  root = createRoot(host);
  await act(async () => { root.render(el); });
}
function unmount() { act(() => root.unmount()); host.remove(); }
const texts = (sel: string) => Array.from(host.querySelectorAll(sel)).map((e) => e.textContent ?? '');

/** The queue as `buildQueue` makes it. */
function build(now: Date): QueueItem[] {
  const items: QueueItem[] = [];
  for (const [p, d] of bodies) items.push(...docItems(p, d, now));
  const examsOf = (p: string) => examsAt(p, meta);
  examQueue(items, now, examsOf);
  const optionsOf = (p: string) => resolveOptions(p, meta);
  const examOf = (p: string) => activeExam(examsOf(p), now);
  return meterQueue(items, now, { optionsOf, spent: spentToday([], now, optionsOf, examOf), examOf });
}

beforeAll(async () => {
  setClockDay('2026-10-30');
  dir = await fsp.mkdtemp(join(tmpdir(), 'ilmi-exam-'));
  await fsp.cp(SAMPLE, dir, { recursive: true });
  vault = await Vault.open(nodeFs, dir);
  for (const p of vault.documents()) {
    const doc = (await vault.read(p)).doc;
    bodies.set(p, doc);
    const m = metaOf(doc);
    docs[p] = { type: m.type, frozen: m.frozen, cards: doc.blocks.filter((b) => b.kind === 'card').length, due: 0 };
    if (m.title !== undefined) docs[p]!.title = m.title;
  }
  useApp.setState({ vault: dir, tree: vault.tree, files: vault.documents(), docs, order: vault.order, queue: build(appNow()), examFilter: null, log: [], budget: 0 });
});
afterAll(async () => {
  setClockDay(null);
  vault.close();
  await fsp.rm(dir, { recursive: true, force: true });
});

describe('exams in the queue', () => {
  it('upcoming: the rows brought before midterm 2 say so, the textbook among them in today\'s', async () => {
    await mount(createElement(Queue, { scope: 'upcoming', active: false }));
    const marks = texts('.qlist li .for-exam');
    expect(marks.length).toBeGreaterThan(10);
    expect(new Set(marks)).toEqual(new Set(['for midterm 2']));
    // a row brought forward shows the day it is brought to, not its stored due
    const row = host.querySelector('.qlist li .for-exam')!.closest('li')!;
    expect(row.querySelector('.due')?.textContent).toMatch(/^in (1[2-8])d$/);
    expect(texts('.exam-filter button')).toEqual(['midterm 2']);
    unmount();
    await mount(createElement(Queue, { scope: 'today', active: false }));
    const book = Array.from(host.querySelectorAll('.qlist li[data-el="read"]')).find((li) => li.textContent?.includes('ch. 9'));
    expect(book?.querySelector('.for-exam')?.textContent).toBe('for midterm 2');
    // brought forward, it is due today, not overdue from a day before
    expect(book?.querySelector('.due')?.textContent).toBe('today');
    unmount();
  });

  it('narrowed to the midterm: only what is studied toward it', async () => {
    await mount(createElement(Queue, { scope: 'upcoming', active: false }));
    const all = host.querySelectorAll('.qlist li:not(.fold)').length;
    await act(async () => { (host.querySelector('.exam-filter button') as HTMLButtonElement).click(); });
    expect(host.querySelector('.exam-filter button')?.getAttribute('data-active')).toBe('1');
    const n = host.querySelectorAll('.qlist li:not(.fold)').length;
    expect(n).toBeGreaterThan(0);
    expect(n).toBeLessThan(all);
    expect(Array.from(host.querySelectorAll('.qlist .qp-parent, .qlist .qp-doc')).some((e) => /stat|vocab/i.test(e.textContent ?? ''))).toBe(false);
    await act(async () => { (host.querySelector('.exam-filter button') as HTMLButtonElement).click(); });
    expect(host.querySelectorAll('.qlist li:not(.fold)').length).toBe(all);
    unmount();
  });
});

describe('exams in the top row and the inspector', () => {
  it('the notebook\'s top row: midterm 2 in 19d, what is left in its tooltip, a click narrowing what is ahead to it', async () => {
    await mount(createElement(ExamTag, { path: `${QM}.md` }));
    const tag = host.querySelector<HTMLButtonElement>('.exam-tag')!;
    expect(tag.textContent).toBe('midterm 2 in 19d');
    expect(tag.title).toMatch(/^wed 18 nov\ncards \d+ of \d+ not yet stable\nreading \d+ blocks left in 1 source/);
    await act(async () => { tag.click(); });
    expect(useApp.getState().examFilter).toBe(`${QM}.md@2026-11-18`);
    expect(opened.at(-1)).toBe(':queue/upcoming');
    useApp.setState({ examFilter: null });
    unmount();
    // a page under it shows nothing there: the exam is the notebook's
    await mount(createElement(ExamTag, { path: BOOK }));
    expect(host.querySelector('.exam-tag')).toBeNull();
    unmount();
  });

  it('the inspector: the next exam, what is left under the node, the final after it; a page says where it is set', async () => {
    await mount(createElement(ExamBlock, { path: `${QM}.md` }));
    const rows = texts('.exam-block .kvr');
    expect(rows[0]).toBe('midterm 2wed 18 nov, in 19d');
    expect(rows.find((r) => r.startsWith('cards'))).toMatch(/^cards\d+ of \d+ not yet stable$/);
    expect(rows.find((r) => r.startsWith('reading'))).toMatch(/^reading\d+ blocks left in 1 source, 1 to revisit$/);
    expect(rows.at(-1)).toBe('finalmon 14 dec');
    unmount();
    await mount(createElement(ExamBlock, { path: BOOK }));
    expect(host.querySelector('.exam-from')?.textContent).toBe(' from quantum II');
    expect(texts('.exam-block .kvr').find((r) => r.startsWith('reading'))).toMatch(/^reading\d+ blocks left in 1 source$/);
    unmount();
    // nothing for a node under no exam
    await mount(createElement(ExamBlock, { path: 'arabic/vocabulary.md' }));
    expect(host.querySelector('.exam-block')).toBeNull();
    unmount();
  });
});
