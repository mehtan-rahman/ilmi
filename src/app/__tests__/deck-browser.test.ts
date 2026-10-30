// @vitest-environment jsdom
// The deck browser: the search (both faces, a cloze's answer, Arabic with
// and without its marks), each chip, each sort, the folder lens listing
// every card under it with its file's path, the selection by click, ⇧, ⌘,
// and ⌘A, and each bulk action writing each file once, undone from its
// snapshots. Pure functions over parsed files, the bulk actions over a
// copy of the corpus vault, and the lens drawn in jsdom.

import { promises as fsp, readFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { act, createElement } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { parse, type Card, type Doc } from '../../format/index.js';
import { nodeFs } from '../../vault/node-fs.js';
import { Vault } from '../../vault/index.js';
import {
  DEFAULT_VIEW, NO_SELECTION, applyBulk, bulkLine, changeCard, clickSelect, cleanView, countLabel, deckRows, docTargets, docsUnder, faceText,
  filterRows, fold, restore, selectAll, selectedRows, sortRows, type DeckRow, type DeckView,
} from '../deck.js';
import { useApp, type DocInfo } from '../store.js';

const CORPUS = join(import.meta.dirname, '../../format/__tests__/corpus/vault');
const DECK = 'german.md';
const PSET = 'courses/linear-algebra/problem-set-1.md';
const NOW = new Date('2026-05-27T12:00:00');
const SEPT = new Date('2026-10-01T12:00:00');

const docOf = (rel: string): Doc => parse(readFileSync(join(CORPUS, rel), 'utf8')).doc;
const name = (r: DeckRow) => r.id ?? r.text.slice(0, 12);
const names = (rows: DeckRow[]) => rows.map(name);
const view = (patch: Partial<DeckView> = {}): DeckView => ({ ...DEFAULT_VIEW, ...patch });

const german = () => deckRows([[DECK, docOf(DECK)]], NOW);

describe('rows', () => {
  it('a both-ways row carries each direction: the forward as the row, the reverse beside it', () => {
    const rows = german();
    const v = rows.find((r) => r.id === 'cv-vorsatz')!;
    expect([v.sched?.due, v.reverse?.sched?.due, v.reverse?.isDue, v.reverse?.suspended]).toEqual(['2026-05-27', '2026-05-29', false, false]);
    const g = rows.find((r) => r.id === 'cv-gedacht')!;
    // a card from before directions were apart: its history the forward's, its reverse new
    expect([g.sched?.reps, g.reverse?.sched, g.reverse?.isDue, g.isDue]).toEqual([7, undefined, true, true]);
    expect(rows.find((r) => r.id === 'cv-cloze')?.reverse).toBeUndefined();
    const one = deckRows([['x.md', parse('a ::: b\n<!-- sr due=2026-06-01 -->\n<!-- sr r due=2026-06-02 sus=1 -->\n').doc]], NOW)[0]!;
    expect([one.isDue, one.suspended, one.reverse?.suspended, one.reverse?.isDue]).toEqual([false, false, true, false]);
  });

  it('suspend, unsuspend and reset reach both directions; reset keeps each one\'s priority', () => {
    const { doc } = parse('a ::: b\n<!-- sr due=2026-06-01 st=review r=3 pri=20 -->\n<!-- sr r due=2026-06-02 st=review r=2 pri=10 sus=1 -->\n');
    const card = doc.blocks[0] as Card;
    changeCard(card, { kind: 'unsuspend' });
    expect(card.reverse).toEqual({ due: '2026-06-02', state: 'review', reps: 2, pri: 10 });
    changeCard(card, { kind: 'reset' });
    expect([card.sched, card.reverse]).toEqual([{ pri: 20 }, { pri: 10 }]);
    changeCard(card, { kind: 'suspend' });
    expect(card.sched).toEqual({ pri: 20, suspended: true });
  });


  it('one row per card, with its form, state, due, and suspension', () => {
    const rows = german();
    expect(names(rows)).toEqual(['cv-vorsatz', 'cv-wdh', 'cv-gedacht', 'cv-vergessen', 'cv-luecke', 'cv-cloze', 'ein Wort ohn']);
    expect(rows.map((r) => r.form)).toEqual(['bidir', 'bidir', 'bidir', 'bidir', 'bidir', 'cloze', 'bidir']);
    expect(rows.map((r) => r.state)).toEqual(['review', 'review', 'review', 'review', 'learning', 'review', 'new']);
    // a row is due when either direction is: a both-ways card's reverse with no line of its own is new, due now
    expect(rows.filter((r) => r.isDue).map(name)).toEqual(['cv-vorsatz', 'cv-wdh', 'cv-gedacht', 'cv-vergessen', 'cv-luecke', 'ein Wort ohn']);
    const ps = deckRows([[PSET, docOf(PSET)]], SEPT);
    // the q&a suspended whole; the cloze with one of two blanks suspended is not, and shows its other blank's schedule
    expect(ps.map((r) => [name(r), r.suspended])).toEqual([['la-span', false], ['la-indep', false], ['la-eigvec', true], ['la-rank', false]]);
    expect(ps.find((r) => r.id === 'la-eigvec')?.isDue).toBe(false);
    expect(ps.find((r) => r.id === 'la-rank')?.sched?.due).toBe('2026-09-22');
  });
});

describe('search', () => {
  it('looks through both faces', () => {
    const rows = german();
    expect(names(filterRows(rows, 'vorsatz', view()))).toEqual(['cv-vorsatz']);
    expect(names(filterRows(rows, 'intention', view()))).toEqual(['cv-vorsatz']);
    expect(names(filterRows(rows, 'to forget', view()))).toEqual(['cv-vergessen']);
    expect(filterRows(rows, 'nothing like it', view())).toEqual([]);
  });

  it("finds a cloze by its answer, the markup not in the way", () => {
    const rows = german();
    expect(names(filterRows(rows, 'verteilte', view()))).toEqual(['cv-cloze']);
    expect(names(filterRows(rows, 'verteilte wiederholung in', view()))).toEqual(['cv-cloze']);
    expect(filterRows(rows, 'c1::', view())).toEqual([]);
    expect(faceText('the {{c1::rank}} of $A$')).toBe('the rank of $A$');
  });

  it('folds case and accents', () => {
    const rows = german();
    expect(names(filterRows(rows, 'Lucke', view()))).toEqual(['cv-luecke']);
    expect(names(filterRows(rows, 'GEDACHTNIS', view()))).toEqual(['cv-gedacht']);
  });

  it('finds Arabic with and without its vowel marks', () => {
    const doc = parse('كَتَبَ ::: to write ^a1\n\nكتاب :: a book ^a2\n\nمَكْتَبَة :: a library ^a3\n').doc;
    const rows = deckRows([['arabic.md', doc]], NOW);
    expect(fold('كَتَبَ')).toBe('كتب');
    expect(names(filterRows(rows, 'كتب', view()))).toEqual(['a1', 'a3']);  // bare finds the voweled word (and the library it is inside)
    expect(names(filterRows(rows, 'كَتَبَ', view()))).toEqual(['a1', 'a3']); // voweled finds the same
    expect(names(filterRows(rows, 'كِتَاب', view()))).toEqual(['a2']);      // a voweled search finds the bare word
    expect(names(filterRows(rows, 'مكتبة', view()))).toEqual(['a3']);
    expect(names(filterRows(rows, 'كتـــاب', view()))).toEqual(['a2']);     // the tatweel is not a letter
  });
});

describe('chips', () => {
  const mixed = parse('a :: b ^q\n\n{{c1::x}} y ^z\n\nc ::: d ^bi\n').doc;

  it('by form, any of the chosen', () => {
    const rows = deckRows([['m.md', mixed]], NOW);
    expect(names(filterRows(rows, '', view({ forms: ['qa'] })))).toEqual(['q']);
    expect(names(filterRows(rows, '', view({ forms: ['cloze'] })))).toEqual(['z']);
    expect(names(filterRows(rows, '', view({ forms: ['bidir'] })))).toEqual(['bi']);
    expect(names(filterRows(rows, '', view({ forms: ['qa', 'bidir'] })))).toEqual(['q', 'bi']);
  });

  it('by state: new, learning, review, due, suspended', () => {
    const rows = german();
    expect(names(filterRows(rows, '', view({ states: ['new'] })))).toEqual(['ein Wort ohn']);
    expect(names(filterRows(rows, '', view({ states: ['learning'] })))).toEqual(['cv-luecke']);
    expect(names(filterRows(rows, '', view({ states: ['review'] })))).toEqual(['cv-vorsatz', 'cv-wdh', 'cv-gedacht', 'cv-vergessen', 'cv-cloze']);
    expect(names(filterRows(rows, '', view({ states: ['due'] })))).toEqual(['cv-vorsatz', 'cv-wdh', 'cv-gedacht', 'cv-vergessen', 'cv-luecke', 'ein Wort ohn']);
    expect(filterRows(rows, '', view({ states: ['suspended'] }))).toEqual([]);
    const ps = deckRows([[PSET, docOf(PSET)]], SEPT);
    expect(names(filterRows(ps, '', view({ states: ['suspended'] })))).toEqual(['la-eigvec']);
    // a suspended card is no review card
    expect(names(filterRows(ps, '', view({ states: ['review'] })))).toEqual(['la-span', 'la-indep', 'la-rank']);
    // chips of two kinds both hold, the search too
    expect(names(filterRows(rows, 'die', view({ forms: ['bidir'], states: ['due'] })))).toEqual(['cv-wdh', 'cv-luecke']);
  });

  it('the count and the remembered view', () => {
    const rows = german();
    expect(countLabel(filterRows(rows, '', view({ states: ['due'] })).length, rows.length)).toBe('6 of 7');
    expect(countLabel(7, 7)).toBe('7');
    expect(cleanView({ forms: ['qa', 'nope'], states: ['due', 1], sort: 'interval' })).toEqual({ forms: ['qa'], states: ['due'], sort: 'interval' });
    expect(cleanView('junk')).toEqual(DEFAULT_VIEW);
  });
});

describe('sorts', () => {
  it('each sort, ties in deck order', () => {
    const rows = german();
    const by = (s: DeckView['sort']) => names(sortRows(rows, s));
    expect(by('order')).toEqual(['cv-vorsatz', 'cv-wdh', 'cv-gedacht', 'cv-vergessen', 'cv-luecke', 'cv-cloze', 'ein Wort ohn']);
    // a both-ways row by the sooner of its directions: an unreviewed reverse is due now
    expect(by('due')).toEqual(['cv-luecke', 'cv-vorsatz', 'cv-wdh', 'cv-gedacht', 'cv-vergessen', 'ein Wort ohn', 'cv-cloze']);
    expect(by('interval')).toEqual(['cv-luecke', 'ein Wort ohn', 'cv-vorsatz', 'cv-vergessen', 'cv-wdh', 'cv-gedacht', 'cv-cloze']);
    expect(by('difficulty')).toEqual(['cv-luecke', 'cv-vorsatz', 'cv-vergessen', 'cv-wdh', 'cv-gedacht', 'cv-cloze', 'ein Wort ohn']);
    expect(by('lapses')).toEqual(['cv-luecke', 'cv-vorsatz', 'cv-wdh', 'cv-gedacht', 'cv-vergessen', 'cv-cloze', 'ein Wort ohn']);
    expect(by('last')).toEqual(['cv-cloze', 'cv-vergessen', 'cv-gedacht', 'cv-luecke', 'cv-vorsatz', 'cv-wdh', 'ein Wort ohn']);
    expect(by('created')).toEqual(['ein Wort ohn', 'cv-cloze', 'cv-luecke', 'cv-vergessen', 'cv-gedacht', 'cv-wdh', 'cv-vorsatz']);
    // a copy: the rows keep their order
    expect(names(rows)[0]).toBe('cv-vorsatz');
  });
});

describe('selection', () => {
  const shown = ['a', 'b', 'c', 'd', 'e'];
  it('click alone, ⇧ a range from the anchor, ⌘ toggles, ⌘A all shown', () => {
    let s = clickSelect(NO_SELECTION, 'b', {}, shown);
    expect(s).toEqual({ keys: ['b'], anchor: 'b' });
    s = clickSelect(s, 'd', { shift: true }, shown);
    expect(s).toEqual({ keys: ['b', 'c', 'd'], anchor: 'b' });
    // a range upward from the same anchor replaces it
    s = clickSelect(s, 'a', { shift: true }, shown);
    expect(s.keys).toEqual(['a', 'b']);
    s = clickSelect(s, 'e', { meta: true }, shown);
    expect(s).toEqual({ keys: ['a', 'b', 'e'], anchor: 'e' });
    s = clickSelect(s, 'a', { meta: true }, shown);
    expect(s.keys).toEqual(['b', 'e']);
    expect(clickSelect(s, 'c', {}, shown)).toEqual({ keys: ['c'], anchor: 'c' });
    // ⇧ with no anchor in view is a plain click
    expect(clickSelect({ keys: ['x'], anchor: 'x' }, 'c', { shift: true }, shown)).toEqual({ keys: ['c'], anchor: 'c' });
    expect(selectAll(shown)).toEqual({ keys: shown, anchor: 'a' });
    const rows = german();
    expect(names(selectedRows({ keys: [rows[4]!.key, rows[0]!.key, 'gone#9'], anchor: null }, rows))).toEqual(['cv-vorsatz', 'cv-luecke']);
  });
});

// ── over a vault ─────────────────────────────────────────────────

let root: string;
let vault: Vault;

beforeEach(async () => {
  root = await fsp.mkdtemp(join(tmpdir(), 'ilmi-decks-'));
  await fsp.cp(CORPUS, root, { recursive: true });
  vault = await Vault.open(nodeFs, root);
});

afterEach(async () => {
  vault.close();
  await fsp.rm(root, { recursive: true, force: true });
});

const readDisk = (rel: string) => fsp.readFile(join(root, rel), 'utf8');
const loaded = async (paths: string[]): Promise<[string, Doc][]> => Promise.all(paths.map(async (p) => [p, (await vault.read(p)).doc] as [string, Doc]));

/** Count the writes per file while `fn` runs. */
async function writes(fn: () => Promise<unknown>): Promise<Record<string, number>> {
  const out: Record<string, number> = {};
  const real = vault.update.bind(vault);
  const spy = vi.spyOn(vault, 'update').mockImplementation((path, mutate) => { out[path] = (out[path] ?? 0) + 1; return real(path, mutate); });
  try { await fn(); } finally { spy.mockRestore(); }
  return out;
}

describe('under a folder or a document', () => {
  it('lists every card under it, each with its file', async () => {
    const course = docsUnder(vault.tree, 'courses/linear-algebra.md', vault.order, vault.documents());
    expect(course).toEqual(['courses/linear-algebra.md', 'courses/linear-algebra/unit-2/eigenvalues.md', PSET, 'courses/linear-algebra/vectors.md']);
    // the children directory, and the folder above, hold the same documents
    expect(docsUnder(vault.tree, 'courses/linear-algebra', vault.order, vault.documents())).toEqual(course);
    expect(docsUnder(vault.tree, 'courses', vault.order, vault.documents())).toEqual(course);
    const rows = deckRows(await loaded(course), SEPT);
    expect(rows.map((r) => `${r.path}:${name(r)}`)).toEqual([`${PSET}:la-span`, `${PSET}:la-indep`, `${PSET}:la-eigvec`, `${PSET}:la-rank`]);
    // the root is the whole collection
    const all = docsUnder(vault.tree, '', vault.order, vault.documents());
    expect([...all].sort()).toEqual([...vault.documents()].sort());
    const every = deckRows(await loaded(all), NOW);
    expect(new Set(every.map((r) => r.path)).size).toBeGreaterThan(5);
    expect(every.filter((r) => r.path === DECK)).toHaveLength(7);
    // an order chosen for a directory is the order of its rows
    await vault.setOrder('courses/linear-algebra', ['vectors.md', 'problem-set-1.md']);
    expect(docsUnder(vault.tree, 'courses', vault.order, vault.documents())).toEqual(['courses/linear-algebra.md', 'courses/linear-algebra/vectors.md', PSET, 'courses/linear-algebra/unit-2/eigenvalues.md']);
    // `move to…` for cards: every document, nested
    const targets = docTargets(vault.tree, vault.order);
    expect(targets.find((t) => t.path === PSET)).toEqual({ path: PSET, depth: 2 });
    expect(targets.find((t) => t.path === DECK)).toEqual({ path: DECK, depth: 0 });
    expect(targets.every((t) => t.path.endsWith('.md'))).toBe(true);
  });
});

describe('bulk actions', () => {
  const refs = async (path: string, ids: string[]) => deckRows(await loaded([path]), NOW).filter((r) => r.id !== undefined && ids.includes(r.id));

  it('suspend and unsuspend: the bare line, one write, the queue follows', async () => {
    const before = await readDisk(DECK);
    const three = await refs(DECK, ['cv-vorsatz', 'cv-wdh', 'cv-cloze']);
    let snaps: Awaited<ReturnType<typeof applyBulk>> = [];
    expect(await writes(async () => { snaps = await applyBulk(vault, three, { kind: 'suspend' }); })).toEqual({ [DECK]: 1 });
    const text = await readDisk(DECK);
    expect(text).toContain('<!-- sr due=2026-05-27 st=review s=3 d=5 r=4 l=1 ivl=3 last=2026-05-24T07:30:00Z g=2 sus=1 -->');
    expect(text).toContain('<!-- sr due=2026-06-15 st=review s=18 d=3.4 r=3 l=0 ivl=18 last=2026-05-28T07:30:00Z g=3 sus=1 -->');
    expect(text.split('\n').filter((l) => l.includes('sus=1'))).toHaveLength(3);
    expect(text.split('\n').length).toBe(before.split('\n').length);
    expect(deckRows(await loaded([DECK]), NOW).filter((r) => r.suspended).map(name)).toEqual(['cv-vorsatz', 'cv-wdh', 'cv-cloze']);
    // undo: every file as it was
    await restore(vault, snaps);
    expect(await readDisk(DECK)).toBe(before);
    await applyBulk(vault, three, { kind: 'suspend' });
    expect(await writes(() => applyBulk(vault, three.slice(0, 2), { kind: 'unsuspend' }))).toEqual({ [DECK]: 1 });
    expect((await readDisk(DECK)).split('\n').filter((l) => l.includes('sus=1'))).toHaveLength(1);
    expect(bulkLine({ kind: 'suspend' }, 3)).toBe('suspended · 3 cards');
  });

  it('unsuspend clears a group line too', async () => {
    const [rank] = deckRows(await loaded([PSET]), SEPT).filter((r) => r.id === 'la-rank');
    await applyBulk(vault, [rank!], { kind: 'unsuspend' });
    const card = (await vault.read(PSET, true)).doc.blocks.find((b): b is Card => b.kind === 'card' && b.id === 'la-rank')!;
    expect(card.blanks?.[2]).toEqual({ due: '2026-09-22', state: 'review', stability: 12, difficulty: 4, reps: 2, lapses: 0, ivl: 12, last: '2026-09-10T09:00:00Z', grade: 3 });
  });

  it('delete: the cards and their lines, one write per file', async () => {
    const two = await refs(DECK, ['cv-wdh', 'cv-luecke']);
    const ps = deckRows(await loaded([PSET]), NOW).filter((r) => r.id === 'la-span');
    const before = await readDisk(DECK);
    let snaps: Awaited<ReturnType<typeof applyBulk>> = [];
    expect(await writes(async () => { snaps = await applyBulk(vault, [...two, ...ps], { kind: 'delete' }); })).toEqual({ [DECK]: 1, [PSET]: 1 });
    const text = await readDisk(DECK);
    expect(text).not.toContain('cv-wdh');
    expect(text).not.toContain('cv-luecke');
    expect(text.split('\n').length).toBe(before.split('\n').length - 6);
    expect(await readDisk(PSET)).not.toContain('la-span');
    await restore(vault, snaps);
    expect(await readDisk(DECK)).toBe(before);
    expect(await readDisk(PSET)).toContain('la-span');
  });

  it('reset: the schedule goes, the card and its own priority stay', async () => {
    await vault.update(DECK, (d) => { const c = d.blocks.find((b): b is Card => b.kind === 'card' && b.id === 'cv-gedacht')!; c.sched = { ...c.sched, pri: 20 }; });
    const two = await refs(DECK, ['cv-gedacht', 'cv-vergessen']);
    expect(await writes(() => applyBulk(vault, two, { kind: 'reset' }))).toEqual({ [DECK]: 1 });
    const text = await readDisk(DECK);
    expect(text).toContain('das Gedächtnis ::: memory ^cv-gedacht\n<!-- sr pri=20 -->\n');
    expect(text).toContain('vergessen ::: to forget ^cv-vergessen\n\n');
    expect(deckRows(await loaded([DECK]), NOW).filter((r) => r.state === 'new').map(name)).toEqual(['cv-gedacht', 'cv-vergessen', 'ein Wort ohn']);
  });

  it('priority: set on the bare line, cleared back to the document', async () => {
    const two = await refs(DECK, ['cv-vorsatz', 'cv-cloze']);
    expect(await writes(() => applyBulk(vault, two, { kind: 'pri', pri: 15 }))).toEqual({ [DECK]: 1 });
    let rows = deckRows(await loaded([DECK]), NOW);
    expect(rows.filter((r) => r.pri === 15).map(name)).toEqual(['cv-vorsatz', 'cv-cloze']);
    await applyBulk(vault, two.slice(0, 1), { kind: 'pri', pri: null });
    rows = deckRows(await loaded([DECK]), NOW);
    expect(rows.filter((r) => r.pri === 15).map(name)).toEqual(['cv-cloze']);
    expect(bulkLine({ kind: 'pri', pri: 15 }, 2)).toBe('priority 15 · 2 cards');
  });

  it('move: the destination once, then each source once; schedules and ids travel', async () => {
    const fromDeck = await refs(DECK, ['cv-vorsatz', 'cv-gedacht']);
    const fromPs = deckRows(await loaded([PSET]), NOW).filter((r) => r.id === 'la-indep');
    const to = 'courses/linear-algebra/vectors.md';
    const deckBefore = await readDisk(DECK);
    const toBefore = await readDisk(to);
    const order: string[] = [];
    const real = vault.update.bind(vault);
    const spy = vi.spyOn(vault, 'update').mockImplementation((p, m) => { order.push(p); return real(p, m); });
    const snaps = await applyBulk(vault, [...fromDeck, ...fromPs], { kind: 'move', to });
    spy.mockRestore();
    expect(order).toEqual([to, DECK, PSET]);
    const dest = await readDisk(to);
    expect(dest).toContain('der Vorsatz ::: resolution; intention ^cv-vorsatz\n<!-- sr due=2026-05-27 st=review s=3 d=5 r=4 l=1 ivl=3 last=2026-05-24T07:30:00Z g=2 -->');
    expect(dest).toContain('^la-indep\n<!-- sr c1 due=2026-09-18');
    expect(await readDisk(DECK)).not.toContain('cv-vorsatz');
    expect(await readDisk(PSET)).not.toContain('la-indep');
    // cards already in the destination stay where they are
    expect(await applyBulk(vault, deckRows(await loaded([to]), NOW), { kind: 'move', to })).toEqual([]);
    await restore(vault, snaps);
    expect(await readDisk(DECK)).toBe(deckBefore);
    expect(await readDisk(to)).toBe(toBefore);
  });

  it('a card that changed or went since it was listed is let be', async () => {
    const [row] = await refs(DECK, ['cv-wdh']);
    await vault.update(DECK, (d) => { d.blocks = d.blocks.filter((b) => !(b.kind === 'card' && b.id === 'cv-wdh')); });
    const before = await readDisk(DECK);
    await applyBulk(vault, [row!], { kind: 'suspend' });
    expect(await readDisk(DECK)).toBe(before);
  });
});

// ── the lens, drawn ──────────────────────────────────────────────

const bodies = new Map<string, Doc>();
const calls: string[] = [];

vi.mock('../vault.js', async (orig) => {
  const real = await orig<typeof import('../vault.js')>();
  return {
    ...real,
    docsOf: (paths: readonly string[]) => paths.filter((p) => bodies.has(p)).map((p) => [p, bodies.get(p)!] as [string, Doc]),
    setDeckView: (id: string, v: DeckView) => { calls.push(`view ${id} ${JSON.stringify(v)}`); useApp.setState((s) => ({ deckViews: { ...s.deckViews, [id]: v } })); },
    removeCard: async (path: string, index: number) => { calls.push(`remove ${path}#${index}`); },
  };
});

const { Lens } = await import('../Lenses.js');
(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

describe('the lens', () => {
  let host: HTMLDivElement;
  let r: Root;

  async function mount(id: string) {
    const files = vault.documents();
    const docs: Record<string, DocInfo> = {};
    for (const p of files) {
      const doc = (await vault.read(p)).doc;
      bodies.set(p, doc);
      const t = doc.frontmatter?.entries.find((e) => 'key' in e && e.key === 'type');
      docs[p] = { type: (t && 'value' in t ? t.value : 'source') as DocInfo['type'], frozen: false, cards: doc.blocks.filter((b) => b.kind === 'card').length, due: 0 };
    }
    useApp.setState({ tree: vault.tree, files, docs, order: vault.order, deckViews: {}, selectedCard: null, reveal: null, vault: root });
    host = document.createElement('div');
    host.className = 'pane-body';
    document.body.appendChild(host);
    r = createRoot(host);
    await act(async () => { r.render(createElement(Lens, { id, active: true, onOpen: () => {} })); });
  }
  afterEach(() => { act(() => r.unmount()); host.remove(); bodies.clear(); calls.length = 0; });

  const rowEls = () => Array.from(host.querySelectorAll<HTMLElement>('.deck-row'));
  const click = (el: Element, init: MouseEventInit = {}) => act(() => { el.dispatchEvent(new MouseEvent('click', { bubbles: true, cancelable: true, ...init })); });
  const selected = () => rowEls().filter((e) => e.classList.contains('selected')).map((e) => e.dataset.key);

  it("a folder's cards: every card under it, each with its file's path", async () => {
    await mount('courses');
    expect(rowEls()).toHaveLength(0);
    const btn = Array.from(host.querySelectorAll<HTMLElement>('.fv-view button')).find((b) => b.textContent === 'cards')!;
    await click(btn);
    expect(rowEls().map((e) => e.dataset.key)).toEqual([`${PSET}#0`, `${PSET}#1`, `${PSET}#2`, `${PSET}#3`]);
    expect(rowEls().map((e) => e.querySelector('.dr-path')?.textContent)).toEqual(Array(4).fill('courses/linear-algebra/problem-set-1'));
    expect(rowEls()[2]!.dataset.suspended).toBe('1');
    expect(rowEls()[2]!.querySelector('.dr-due')?.textContent).toBe('suspended');
    expect(host.querySelector('.deck-bar .db-count')?.textContent).toBe('4');
  });

  it('the deck: selection by click, ⇧, ⌘, ⌘A, the bar counting it', async () => {
    await mount(DECK);
    const keys = rowEls().map((e) => e.dataset.key!);
    expect(keys).toHaveLength(7);
    // one file: no path on the rows
    expect(host.querySelector('.dr-path')).toBeNull();
    await click(rowEls()[1]!);
    expect(selected()).toEqual([keys[1]]);
    expect(useApp.getState().selectedCard).toEqual({ path: DECK, index: 1 });
    await click(rowEls()[3]!, { shiftKey: true });
    expect(selected()).toEqual(keys.slice(1, 4));
    expect(host.querySelector('.db-sel')?.textContent).toBe('3 selected');
    await click(rowEls()[2]!, { metaKey: true });
    expect(selected()).toEqual([keys[1], keys[3]]);
    await act(() => { window.dispatchEvent(new KeyboardEvent('keydown', { key: 'a', metaKey: true, bubbles: true, cancelable: true })); });
    expect(selected()).toEqual(keys);
    expect(host.querySelector('.db-sel')?.textContent).toBe('7 selected');
    expect(Array.from(host.querySelectorAll('.db-actions button')).map((b) => b.textContent)).toEqual(['move to…', 'delete', 'suspend', 'reset', 'set priority', 'study these']);
  });

  it('the chips and the sort are remembered for the deck', async () => {
    await mount(DECK);
    await click(host.querySelector('.chip[data-chip="review"]')!);
    expect(rowEls()).toHaveLength(5);
    expect(host.querySelector('.deck-bar .db-count')?.textContent).toBe('5 of 7');
    const sort = host.querySelector<HTMLSelectElement>('.db-sort')!;
    await act(() => { sort.value = 'created'; sort.dispatchEvent(new Event('change', { bubbles: true })); });
    expect(calls.at(-1)).toBe(`view ${DECK} {"forms":[],"states":["review"],"sort":"created"}`);
    expect(rowEls()[0]!.dataset.key).toBe(`${DECK}#5`);
  });
});
