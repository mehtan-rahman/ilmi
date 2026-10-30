// @vitest-environment jsdom
// Milestone 40, a pass over everything on the sample collection: formulas
// in chrome drawn or read as plain text, a title not drawn twice, the
// queue's path of titles, the day by course in the queue's inspector, the
// counts under a folder lens row, the room rule for the inspector, the
// crumb kept to its nearest levels, the folder lens's plain words, the
// forms in the user's words, the session card sized to a one-line cloze
// and answered in place, and the deck's inspector without the card list.

import { promises as fsp, readFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { act, createElement } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';
import { meta as metaOf, parse, type Doc } from '../../format/index.js';
import { docItems, inScope, isDue, sortQueue, type CardItem, type QueueItem } from '../../schedule/index.js';
import { nodeFs } from '../../vault/node-fs.js';
import { Vault, type TreeNode } from '../../vault/index.js';
import { bodyRepeatsTitle, breakdown, countWords, countsUnder, foldTitle, groupOf, hasMath, inlineMathHTML, pathParts, plainMath, shortTitle } from '../chromeText.js';
import { keptCrumbs } from '../Crumbs.js';
import { FORM_LABEL, dayLabel, dueWhen, kindTag } from '../items.js';
import { MEASURE_MIN, inspectorFits, inspectorShown, railsOf } from '../layout.js';
import { emptyPanes, openTab } from '../panes.js';
import { queueId } from '../names.js';
import { useApp, type DocInfo } from '../store.js';

const SAMPLE = join(import.meta.dirname, '../../../samples/double-major');
const NOW = new Date('2026-10-30T09:00:00');
const CH3 = 'library/lindqvist-statistical-physics/ch-3-the-canonical-ensemble.md';
const KANA = 'courses/fall-2026/arab-401-advanced-grammar/kana-and-its-sisters.md';
const PT = 'courses/fall-2026/phys-412-quantum-ii/nondegenerate-perturbation-theory.md';
const VOCAB = 'arabic/vocabulary.md';

let vault: Vault;
let dir: string;
const bodies = new Map<string, Doc>();
const docs: Record<string, DocInfo> = {};
let queue: QueueItem[] = [];

vi.mock('../vault.js', async (orig) => {
  const real = await orig<typeof import('../vault.js')>();
  return {
    ...real,
    currentVault: () => vault,
    docsOf: (paths: readonly string[]) => paths.filter((p) => bodies.has(p)).map((p) => [p, bodies.get(p)!] as [string, Doc]),
  };
});
const { Lens } = await import('../Lenses.js');
const { Inspector } = await import('../Inspector.js');
const { Session } = await import('../Session.js');
const { Queue } = await import('../Queue.js');
(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
(globalThis as { ResizeObserver?: unknown }).ResizeObserver ??= class { observe() {} unobserve() {} disconnect() {} };

beforeAll(async () => {
  dir = await fsp.mkdtemp(join(tmpdir(), 'ilmi-pass-'));
  await fsp.cp(SAMPLE, dir, { recursive: true });
  vault = await Vault.open(nodeFs, dir);
  for (const p of vault.documents()) {
    const doc = (await vault.read(p)).doc;
    bodies.set(p, doc);
    const own = docItems(p, doc, NOW);
    queue.push(...own);
    const m = metaOf(doc);
    const due = new Set<number>();
    for (const i of own) if (i.kind === 'card' && isDue(i, NOW)) due.add(i.block);
    docs[p] = { type: m.type, frozen: m.frozen, cards: doc.blocks.filter((b) => b.kind === 'card').length, due: due.size };
    if (m.title !== undefined) docs[p]!.title = m.title;
    if (m.read) docs[p]!.read = m.read;
    if (m.tabs) docs[p]!.tabs = true;
  }
  queue = sortQueue(queue, NOW);
  useApp.setState({ vault: dir, tree: vault.tree, files: vault.documents(), docs, order: vault.order, queue, deckViews: {}, selectedCard: null, reveal: null, folds: {}, railFolded: {}, budget: 0 });
});
afterAll(async () => {
  vault.close();
  await fsp.rm(dir, { recursive: true, force: true });
});

let host: HTMLDivElement;
let root: Root;
async function mount(el: React.ReactElement, cls = 'pane-body') {
  host = document.body.appendChild(document.createElement('div'));
  host.className = cls;
  root = createRoot(host);
  await act(async () => { root.render(el); });
}
function unmount() { act(() => root.unmount()); host.remove(); }
const settle = async (until: () => unknown) => {
  for (let k = 0; k < 100 && !until(); k++) await act(async () => { await new Promise((r) => setTimeout(r, 5)); });
};

/** Text nodes under `el` outside KaTeX's own markup. */
function textOutsideMath(el: Element): string {
  const out: string[] = [];
  const walk = document.createTreeWalker(el, NodeFilter.SHOW_TEXT);
  for (let n = walk.nextNode(); n; n = walk.nextNode()) if (!n.parentElement?.closest('.katex')) out.push(n.textContent ?? '');
  return out.join('');
}

describe('formulas in chrome', () => {
  it('draws `$…$` as KaTeX inline and reads it as plain text where only text goes', () => {
    expect(hasMath('lecture 9 — $Z$ does everything')).toBe(true);
    expect(hasMath('no formula, $5 and $6')).toBe(false);
    const html = inlineMathHTML('lecture 9 — $Z$ does everything');
    expect(html).toContain('class="katex"');
    expect(html).not.toContain('$');
    expect(html).not.toContain('katex-display');
    // a display formula in a line is drawn inline too
    expect(inlineMathHTML('$$\\frac{4|V_{fi}|^2}{\\hbar}$$')).not.toContain('katex-display');
    expect(plainMath('orthogonal to $|n^0\\rangle$')).toBe('orthogonal to |n^0⟩');
    expect(plainMath('lecture 9 — $Z$ does everything')).toBe('lecture 9 — Z does everything');
    expect(plainMath('$\\lambda = 1$ at the end')).toBe('λ = 1 at the end');
    expect(plainMath('words <b>only</b>')).toBe('words <b>only</b>');
    expect(inlineMathHTML('a <b> & c')).toBe('a &lt;b&gt; &amp; c');
  });
});

describe('a title and the body that opens with it', () => {
  it("folds a chapter's numbering, case and punctuation", () => {
    expect(foldTitle('ch. 3: the canonical ensemble')).toBe('ch 3 the canonical ensemble');
    expect(foldTitle('Chapter 3 — The Canonical Ensemble')).toBe('ch 3 the canonical ensemble');
    const h = (text: string, level = 1) => [{ kind: 'heading' as const, level, text }];
    expect(bodyRepeatsTitle('ch. 3: the canonical ensemble', h('Chapter 3 — The Canonical Ensemble'))).toBe(true);
    expect(bodyRepeatsTitle('the canonical ensemble', h('Chapter 3: The Canonical Ensemble', 2))).toBe(true);
    expect(bodyRepeatsTitle('ch. 3: the canonical ensemble', h('Chapter 3 — The Canonical Ensemble', 3))).toBe(false);
    expect(bodyRepeatsTitle('nondegenerate perturbation theory', h('setup', 2))).toBe(false);
    expect(bodyRepeatsTitle('x', [{ kind: 'paragraph', text: 'x' }])).toBe(false);
  });

  it('the Lindqvist chapter is titled once in the reader; a note whose body opens otherwise keeps its title', async () => {
    useApp.setState({ panes: openTab(emptyPanes(), CH3) });
    await mount(createElement(Lens, { id: CH3, active: true, onOpen: () => {} }));
    await settle(() => host.querySelector('.draft-doc h1, .draft-doc .dd-h'));
    expect(host.querySelector('.doc-view > h1')).toBeNull();
    expect(host.querySelector('.draft-doc')?.textContent).toContain('Chapter 3 — The Canonical Ensemble');
    unmount();
    await mount(createElement(Lens, { id: PT, active: true, onOpen: () => {} }));
    await settle(() => host.querySelector('.draft-doc'));
    expect(host.querySelector('.doc-view > h1')?.textContent).toBe('nondegenerate perturbation theory');
    unmount();
  });

  it("the reader's top row: no editable word, one short count, the crumb its nearest levels", async () => {
    await mount(createElement(Lens, { id: PT, active: true, onOpen: () => {} }));
    await settle(() => host.querySelector('.draft-doc'));
    const row = host.querySelector<HTMLElement>('.doc-view .meta')!;
    expect(row.textContent).not.toMatch(/editable|frozen/);
    const right = row.querySelector<HTMLElement>('.right')!;
    expect(right.textContent).toBe(`${docs[PT]!.due} due`);
    expect(right.title).toBe(`${docs[PT]!.cards} cards, ${docs[PT]!.due} due`);
    const crumbs = row.querySelector<HTMLElement>('.crumbs')!;
    expect(Array.from(crumbs.querySelectorAll('.cr')).map((c) => c.textContent)).toEqual(['…', 'fall 2026', 'quantum II']);
    expect(crumbs.title).toBe('courses / fall 2026 / quantum II');
    unmount();
  });
});

describe('the crumb', () => {
  it('keeps the nearest levels', () => {
    expect(keptCrumbs(['a', 'b', 'c', 'd'])).toEqual({ cut: true, shown: ['c', 'd'] });
    expect(keptCrumbs(['a', 'b'])).toEqual({ cut: false, shown: ['a', 'b'] });
  });
});

describe("the queue's rows", () => {
  it('a path of titles, not slugs: the course short, the document, the heading', () => {
    const kana = queue.find((i): i is CardItem => i.kind === 'card' && i.path === KANA && /order/.test(i.section ?? ''))!;
    expect(pathParts(kana, docs)).toEqual({ parent: 'arab 401', doc: 'kāna and its sisters', section: kana.section });
    expect(shortTitle('arab 401 · advanced grammar')).toBe('arab 401');
    expect(shortTitle('Lindqvist — Statistical Physics')).toBe('Lindqvist');
    expect(shortTitle('quantum II')).toBe('quantum II');
    const vocab = queue.find((i) => i.path === VOCAB)!;
    expect(pathParts(vocab, docs).parent).toBe('arabic');
  });

  it('draws one line per row with no slug paths, and the kinds as lowercase words', async () => {
    useApp.setState({ queueTitles: false });
    await mount(createElement(Queue, { scope: 'today', active: false }));
    const srcs = Array.from(host.querySelectorAll<HTMLElement>('.qlist .src'));
    expect(srcs.length).toBeGreaterThan(50);
    for (const s of srcs) {
      const path = s.querySelector('.qpath')!.textContent!;
      // no slug paths (a heading may hold a slash of its own: `news / misc`)
      expect(path).not.toMatch(/\b[a-z0-9]+(?:-[a-z0-9]+)+\//);
      expect(path).not.toMatch(/\.md\b/);
      expect(textOutsideMath(s)).not.toContain('$');
    }
    const tags = new Set(Array.from(host.querySelectorAll('.qlist .kindtag')).map((t) => t.textContent));
    for (const t of tags) expect(t).toBe(t!.toLowerCase());
    expect(tags.has('bidir')).toBe(false);
    expect([...tags]).toContain('both ways');
    unmount();
  });

  it("the queue's inspector: what is due now, by course, not the sidebar's counts again", async () => {
    useApp.setState({ panes: openTab(emptyPanes(), queueId('today')) });
    await mount(createElement(Inspector), 'shell');
    const rows = Array.from(host.querySelectorAll<HTMLElement>('.insp-groups li'));
    expect(rows.length).toBeGreaterThan(3);
    const names = rows.map((r) => r.querySelector('.cl-t')!.textContent);
    expect(names).toContain('quantum II');
    expect(names).not.toContain('upcoming');
    const n = rows.reduce((s, r) => s + Number(r.querySelector('.cl-due')!.textContent), 0);
    const now = new Date();
    expect(n).toBe(queue.filter((i) => inScope(i, 'today', now) && isDue(i, now)).length);
    unmount();
  });

  it('groups an item under the outermost document over it, else its top folder', () => {
    expect(groupOf(KANA, docs)).toBe('courses/fall-2026/arab-401-advanced-grammar.md');
    expect(groupOf(VOCAB, docs)).toBe('arabic');
    expect(groupOf('library/lindqvist-statistical-physics/ch-3-the-canonical-ensemble.md', docs)).toBe('library/lindqvist-statistical-physics.md');
    expect(groupOf('top.md', docs)).toBe('');
    const b = breakdown([queue[0]!, queue[0]!], docs, (p) => p);
    expect(b).toEqual([[groupOf(queue[0]!.path, docs), 2]]);
  });
});

describe('counts under a row', () => {
  it("a course counts every card under it, and says nothing when there are none", async () => {
    const find = (path: string, list: TreeNode[] = vault.tree): TreeNode | undefined => {
      for (const n of list) { if (n.path === path) return n; const k = find(path, n.children ?? []); if (k) return k; }
      return undefined;
    };
    const qm = countsUnder(find('courses/fall-2026/phys-412-quantum-ii.md')!, docs);
    expect(qm.cards).toBeGreaterThan(30);
    expect(countWords({ cards: 0, due: 0 })).toEqual({ cards: '', due: '' });
    expect(countWords({ cards: 1, due: 3 })).toEqual({ cards: '1 card', due: '3 due' });
    await mount(createElement(Lens, { id: 'courses/fall-2026', active: true, onOpen: () => {} }));
    const row = host.querySelector<HTMLElement>('.fv-row[data-path="courses/fall-2026/phys-412-quantum-ii.md"] .fv-meta')!;
    expect(row.textContent).toContain(`${qm.cards} cards`);
    expect(host.querySelector('.folder-view .crumb')?.textContent).toBe('folder');
    expect(Array.from(host.querySelectorAll('.fv-meta')).map((m) => m.textContent)).not.toContain('note');
    unmount();
  });

  it("the folder inspector: cards and due under it", async () => {
    useApp.setState({ panes: openTab(emptyPanes(), 'courses/fall-2026') });
    await mount(createElement(Inspector), 'shell');
    const kv = Object.fromEntries(Array.from(host.querySelectorAll('.kvr')).map((r) => [r.querySelector('dt')!.textContent, r.querySelector('dd')!.textContent]));
    expect(Number(kv.cards)).toBeGreaterThan(100);
    expect(kv.due).toBeDefined();
    expect(kv.notes).toBeUndefined();
    unmount();
  });

  it("an extracts folder says whose, in plain words", async () => {
    const owner = vault.documents().find((p) => vault.documents().some((q) => q.startsWith(`${p.slice(0, -3)}/`) && docs[q]?.type === 'extract')
      && vault.documents().filter((q) => q.startsWith(`${p.slice(0, -3)}/`) && q.split('/').length === p.split('/').length + 1).every((q) => docs[q]?.type === 'extract'))!;
    await mount(createElement(Lens, { id: owner.slice(0, -3), active: true, onOpen: () => {} }));
    expect(host.querySelector('.folder-view .crumb')?.textContent).toMatch(/^extracts of /);
    unmount();
  });
});

describe('the room rule', () => {
  it('the inspector yields before the measure does', () => {
    // sidebar 232, rail 200, inspector 280: 1320 holds a 560 measure, 1280 does not
    expect(inspectorFits(1320, 232, 280, [200])).toBe(true);
    expect(inspectorFits(1280, 232, 280, [200])).toBe(false);
    expect(inspectorFits(1280, 232, 280, [0])).toBe(true);
    expect(inspectorFits(1280, 232, 280, [0, 0])).toBe(false);
    expect(MEASURE_MIN).toBe(560);
    const base = { sidebar: { width: 232, hidden: false }, inspector: { width: 280, open: true }, inspForced: false, docs, railFolded: {} as Record<string, true>, railWidth: 200 };
    const nbPage = Object.keys(docs).find((p) => p.startsWith('courses/fall-2026/phys-412-quantum-ii/'))!;
    const panes = openTab(emptyPanes(), nbPage);
    expect(railsOf(panes, docs, {}, 200)).toEqual([200]);
    expect(inspectorShown({ ...base, panes }, 1280)).toBe(false);
    // the rail folded: room again
    expect(inspectorShown({ ...base, panes, railFolded: { 'courses/fall-2026/phys-412-quantum-ii.md': true } }, 1280)).toBe(true);
    // asked for: shown anyway; closed: never
    expect(inspectorShown({ ...base, panes, inspForced: true }, 1280)).toBe(true);
    expect(inspectorShown({ ...base, panes, inspector: { width: 280, open: false }, inspForced: true }, 1600)).toBe(false);
    expect(inspectorShown({ ...base, panes: openTab(emptyPanes(), queueId('today')) }, 1280)).toBe(true);
  });
});

describe('words', () => {
  it('the forms in the user\'s words, the due read as words, the day without a middot', () => {
    expect(FORM_LABEL.bidir).toBe('both ways');
    const bidir = queue.find((i) => i.kind === 'card' && i.form === 'bidir')!;
    expect(kindTag(bidir)).toBe('both ways');
    expect(dueWhen('2027-04-01', NOW)).toBe('in 5mo');
    expect(dueWhen('2026-10-27', NOW)).toBe('overdue 3d');
    expect(dueWhen('2026-10-30', NOW)).toBe('today');
    expect(dayLabel(NOW)).toBe('fri 30 oct');
  });
});

describe('the session card', () => {
  const css = readFileSync(join(import.meta.dirname, '../session.css'), 'utf8');

  it('has no blur, no shadow, no two empty halves', () => {
    expect(css).not.toMatch(/blur\(/);
    expect(css).not.toMatch(/grid-template-rows:\s*1fr 1fr/);
    expect(css).not.toMatch(/box-shadow/);
  });

  it('a one-line cloze: answered in place, nothing repeated under it', async () => {
    const cloze = queue.find((i): i is CardItem => i.kind === 'card' && i.form === 'cloze' && i.groups === 1 && !i.text.includes('$') && i.text.length < 120)!;
    useApp.setState({ session: { seq: 1, items: [cloze] }, panes: openTab(emptyPanes(), ':session') });
    await mount(createElement(Session, { active: true, onOpen: () => {} }));
    const card = host.querySelector<HTMLElement>('.recall-wrap .card')!;
    expect(card.querySelector('.face.back')).toBeNull();
    expect(card.querySelector('.face-hint')).not.toBeNull();
    expect(card.querySelector('.cloze:not(.ctx)')).not.toBeNull();
    await act(async () => { window.dispatchEvent(new KeyboardEvent('keydown', { key: ' ', bubbles: true })); });
    expect(card.dataset.revealed).toBe('1');
    expect(card.querySelector('.cloze.revealed')).not.toBeNull();
    expect(card.querySelector('.face.back, .cloze-answer')).toBeNull();
    expect(card.querySelector('.face-hint')).toBeNull();
    unmount();
  });

  it('a q&a: the answer only once revealed', async () => {
    const qa = queue.find((i): i is CardItem => i.kind === 'card' && i.form === 'qa')!;
    useApp.setState({ session: { seq: 2, items: [qa] } });
    await mount(createElement(Session, { active: true, onOpen: () => {} }));
    const card = host.querySelector<HTMLElement>('.recall-wrap .card')!;
    expect(card.querySelector('.face.back')).toBeNull();
    await act(async () => { window.dispatchEvent(new KeyboardEvent('keydown', { key: ' ', bubbles: true })); });
    expect(card.querySelector('.face.back .qa-a')).not.toBeNull();
    // the heading path above it: no raw TeX outside KaTeX
    expect(textOutsideMath(host.querySelector('.card-trail')!)).not.toContain('$');
    unmount();
  });
});

describe('the inspector', () => {
  it("a deck's: its facts and new-card forms, not the list the page already shows", async () => {
    useApp.setState({ panes: openTab(emptyPanes(), VOCAB), selectedCard: null });
    await mount(createElement(Inspector), 'shell');
    await settle(() => host.querySelector('.insp .block'));
    expect(host.querySelector('.insp-cards')).toBeNull();
    expect(Array.from(host.querySelectorAll('.deck-default button')).map((b) => b.textContent)).toEqual(['cloze', 'q&a', 'both ways']);
    unmount();
  });

  it("a note's card list and outline: formulas drawn, no raw `$` outside KaTeX", async () => {
    useApp.setState({ panes: openTab(emptyPanes(), PT), selectedCard: null });
    await mount(createElement(Inspector), 'shell');
    await settle(() => host.querySelector('.insp-cards'));
    const list = host.querySelector('.insp-cards')!;
    expect(list.querySelectorAll('.katex').length).toBeGreaterThan(0);
    expect(textOutsideMath(list)).not.toContain('$');
    const outline = host.querySelector('.insp-outline');
    if (outline) expect(textOutsideMath(outline)).not.toContain('$');
    expect(textOutsideMath(host.querySelector('.insp')!)).not.toMatch(/\$[^$\s]/);
    unmount();
  });
});

describe('the sample, parsed for the checks above', () => {
  it('the Lindqvist chapter opens with its own title', () => {
    const doc = parse(readFileSync(join(SAMPLE, CH3), 'utf8')).doc;
    expect(bodyRepeatsTitle(metaOf(doc).title!, doc.blocks)).toBe(true);
  });
});
