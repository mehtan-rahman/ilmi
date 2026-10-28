// @vitest-environment jsdom
// Studying one deck: a session over a deck, a folder, and a selection, with
// and without `include not due`, suspended cards left out; and `studyDeck`
// opening the session tab with the deck's name, or saying there is nothing.

import { promises as fsp } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { Doc } from '../../format/index.js';
import { gradeItem, type CardItem } from '../../schedule/index.js';
import { nodeFs } from '../../vault/node-fs.js';
import { Vault } from '../../vault/index.js';
import { applyBulk, deckRows, docsUnder } from '../deck.js';
import { SESSION } from '../names.js';
import { useApp, type DocInfo } from '../store.js';
import { studyHeader, studyItems } from '../study.js';

const CORPUS = join(import.meta.dirname, '../../format/__tests__/corpus/vault');
const DECK = 'german.md';
const PSET = 'courses/linear-algebra/problem-set-1.md';
const NOW = new Date('2026-05-27T12:00:00');

let root: string;
let vault: Vault;

beforeEach(async () => {
  root = await fsp.mkdtemp(join(tmpdir(), 'ilmi-study-'));
  await fsp.cp(CORPUS, root, { recursive: true });
  vault = await Vault.open(nodeFs, root);
});

afterEach(async () => {
  vault.close();
  await fsp.rm(root, { recursive: true, force: true });
});

const loaded = async (paths: string[]): Promise<[string, Doc][]> => Promise.all(paths.map(async (p) => [p, (await vault.read(p, true)).doc] as [string, Doc]));
const under = (id: string) => docsUnder(vault.tree, id, vault.order, vault.documents());
const key = (i: CardItem) => `${i.id ?? i.text.slice(0, 12)}${i.group && 'n' in i.group ? `/c${i.group.n}` : ''}`;

describe('a deck', () => {
  it('due only: the cards due now, in the queue order', async () => {
    const items = studyItems(await loaded(under(DECK)), NOW);
    // the queue's order: what is due by priority, then due
    expect(items.map(key)).toEqual(['cv-luecke', 'cv-vorsatz', 'cv-wdh', 'ein Wort ohn']);
    expect(items.every((i) => i.kind === 'card')).toBe(true);
  });

  it('include not due: every card, the new ones last', async () => {
    const items = studyItems(await loaded(under(DECK)), NOW, { cram: true });
    expect(items.map(key)).toEqual(['cv-luecke', 'cv-vorsatz', 'cv-wdh', 'cv-vergessen', 'cv-gedacht', 'cv-cloze', 'ein Wort ohn']);
  });

  it('suspended cards are left out, due or not', async () => {
    const rows = deckRows(await loaded([DECK]), NOW).filter((r) => r.id === 'cv-vorsatz' || r.id === 'cv-gedacht');
    await applyBulk(vault, rows, { kind: 'suspend' });
    const docs = await loaded(under(DECK));
    expect(studyItems(docs, NOW).map(key)).toEqual(['cv-luecke', 'cv-wdh', 'ein Wort ohn']);
    expect(studyItems(docs, NOW, { cram: true }).map(key)).toEqual(['cv-luecke', 'cv-wdh', 'cv-vergessen', 'cv-cloze', 'ein Wort ohn']);
  });

  it('an early review in a cram is graded as usual', async () => {
    const [early] = studyItems(await loaded(under(DECK)), NOW, { cram: true }).filter((i) => i.id === 'cv-gedacht');
    await vault.update(DECK, (d) => { gradeItem(d, early!, 3, NOW); });
    const c = (await vault.read(DECK, true)).doc.blocks.find((b) => b.kind === 'card' && b.id === 'cv-gedacht');
    // due 9 June, reviewed a day after its last: a review all the same, its interval grown less than on time
    expect(c && c.kind === 'card' && c.sched).toMatchObject({ state: 'review', reps: 8, grade: 3 });
    expect(c && c.kind === 'card' && c.sched?.last).toBe(NOW.toISOString().replace(/\.\d+Z$/, 'Z'));
  });
});

describe('a folder', () => {
  it('every card under it; one blank suspended leaves the other in', async () => {
    const docs = await loaded(under('courses'));
    expect(studyItems(docs, NOW)).toEqual([]);
    expect(studyItems(docs, NOW, { cram: true }).map(key)).toEqual(['la-span', 'la-indep/c1', 'la-rank/c1']);
    const sept = new Date('2026-09-20T12:00:00');
    expect(studyItems(docs, sept).map(key)).toEqual(['la-span', 'la-indep/c1']);
    // the whole collection from the root
    const all = studyItems(await loaded(under('')), NOW);
    expect(all.length).toBe(13);
    expect(new Set(all.map((i) => i.path)).size).toBeGreaterThan(2);
  });
});

describe('a selection', () => {
  it('only the cards chosen, due or crammed', async () => {
    const docs = await loaded(under(''));
    const rows = deckRows(docs, NOW).filter((r) => ['cv-wdh', 'cv-gedacht', 'la-span'].includes(r.id ?? ''));
    const only = new Set(rows.map((r) => r.key));
    expect(studyItems(docs, NOW, { only }).map(key)).toEqual(['cv-wdh']);
    expect(studyItems(docs, NOW, { only, cram: true }).map(key)).toEqual(['cv-wdh', 'cv-gedacht', 'la-span']);
  });
});

// ── opening it ───────────────────────────────────────────────────

const bodies = new Map<string, Doc>();
const opened: string[] = [];

vi.mock('../vault.js', async (orig) => {
  const real = await orig<typeof import('../vault.js')>();
  return {
    ...real,
    docsOf: (paths: readonly string[]) => paths.filter((p) => bodies.has(p)).map((p) => [p, bodies.get(p)!] as [string, Doc]),
    openNode: (id: string) => { opened.push(id); },
  };
});

const { studyDeck } = await import('../deckOps.js');

describe('studyDeck', () => {
  beforeEach(async () => {
    const docs: Record<string, DocInfo> = {};
    for (const [p, d] of await loaded(vault.documents())) {
      bodies.set(p, d);
      docs[p] = { type: p === DECK ? 'deck' : 'source', frozen: false, cards: d.blocks.filter((b) => b.kind === 'card').length, due: 0, ...(p === DECK ? { title: 'german · A1' } : {}) };
    }
    useApp.setState({ tree: vault.tree, files: vault.documents(), docs, order: {}, session: null, notice: null, vault: root });
    opened.length = 0;
  });
  afterEach(() => bodies.clear());

  it('opens the session over the deck, named, counting down', () => {
    const n = studyDeck(DECK, { cram: true });
    expect(n).toBe(7);
    const s = useApp.getState().session!;
    expect(s.deck).toEqual({ id: DECK, title: 'german · A1' });
    expect(s.items).toHaveLength(7);
    expect(opened).toEqual([SESSION]);
    expect(studyHeader(s.deck!.title, s.items.length - 2)).toBe('german · A1 · 5 left');
  });

  it('with nothing due, a notice and no session', () => {
    // a folder with no cards in it at all
    const course = 'courses/linear-algebra/unit-2';
    expect(studyDeck(course)).toBe(0);
    expect(useApp.getState().session).toBeNull();
    expect(useApp.getState().notice?.line).toBe('nothing due · unit-2');
    expect(opened).toEqual([]);
  });
});
