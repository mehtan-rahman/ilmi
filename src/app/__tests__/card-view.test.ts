// @vitest-environment jsdom
// The card view (milestone 72): a document's cards in document order, where
// a card stands among them and a step through them; the tree's card rows
// under a document (directly, or under `n cards` when it has children),
// passed over by the moves; a face's table edited as a table and written
// back as its pipe lines (untouched, byte for byte); and the view drawn,
// a face edited and saved, the form switch asking before it drops a
// reviewed schedule, `]` saving first and moving on, the id and the `sr`
// lines kept.

import { promises as fsp, readFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { TextSelection } from 'prosemirror-state';
import { act, createElement } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cardFields, parse, type Doc } from '../../format/index.js';
import { makeState, schema } from '../../reader/index.js';
import { Vault, type TreeNode } from '../../vault/index.js';
import { nodeFs } from '../../vault/node-fs.js';
import { cardIndex, cardSet, countOf, frontLine, stepIn } from '../cardSet.js';
import { faceFieldBlocks, faceFieldText, faceViews } from '../FaceField.js';
import { useApp, type DocInfo } from '../store.js';
import { cardRowPath, cardsRowPath, keyPlace, treeKey, treeRows, type TreeRow } from '../treeModel.js';

const CORPUS = join(import.meta.dirname, '../../format/__tests__/corpus');
const DECK = 'german.md';

// jsdom draws no boxes: ProseMirror's scroll to the caret asks a range for its rects
for (const proto of [Node.prototype, Range.prototype] as unknown as { getClientRects?: () => DOMRect[]; getBoundingClientRect?: () => DOMRect }[]) {
  proto.getClientRects ??= () => [];
  proto.getBoundingClientRect ??= () => new DOMRect();
}

describe('the set', () => {
  const doc = parse('# h\n\na :: b ^x\n\nprose\n\n{{c1::c}} d\n\ne ::: f ^y\n').doc;

  it('a document\'s cards in document order, each by its block and id', () => {
    expect(cardSet(doc)).toEqual([
      { block: 1, id: 'x', text: 'a :: b' }, { block: 3, text: '{{c1::c}} d' }, { block: 4, id: 'y', text: 'e ::: f' },
    ]);
    expect(cardSet(null)).toEqual([]);
  });

  it('where a card stands: by its id first, then its block, else the nearest after (the last when none is)', () => {
    const set = cardSet(doc);
    expect(cardIndex(set, undefined)).toBe(0);
    expect(cardIndex(set, { block: 3 })).toBe(1);
    // the card moved: its id finds it
    expect(cardIndex(set, { block: 0, id: 'y' })).toBe(2);
    expect(cardIndex(set, { block: 2 })).toBe(1);
    expect(cardIndex(set, { block: 9 })).toBe(2);
    expect(cardIndex([], { block: 1 })).toBe(-1);
  });

  it('a step held at the ends, and the count', () => {
    expect([stepIn(0, -1, 3), stepIn(0, 1, 3), stepIn(2, 1, 3), stepIn(0, 1, 0)]).toEqual([0, 1, 2, -1]);
    expect([countOf(2, 12), countOf(-1, 0)]).toEqual(['3 / 12', '0 / 0']);
  });

  it('a card\'s line in the tree: its front, a cloze filled in, one line, cut short', () => {
    expect(frontLine('what is $\\pi$?\n?\n3.14')).toBe('what is $\\pi$?');
    expect(frontLine('the {{c1::rank}} of {{c2::A}}')).toBe('the rank of A');
    expect(frontLine('der Vorsatz ::: resolution')).toBe('der Vorsatz');
    expect(frontLine(`${'word '.repeat(30)}:: x`, 20)).toBe('word word word word…');
  });
});

describe('the tree\'s card rows', () => {
  const TREE: TreeNode[] = [
    { kind: 'doc', name: 'course.md', path: 'course.md', children: [{ kind: 'doc', name: 'unit.md', path: 'course/unit.md' }] },
    { kind: 'doc', name: 'deck.md', path: 'deck.md' },
    { kind: 'doc', name: 'plain.md', path: 'plain.md' },
  ];
  const CARDS: Record<string, { block: number; id?: string; text: string }[]> = {
    'course.md': [{ block: 2, text: 'q :: a' }],
    'deck.md': [{ block: 0, id: 'a', text: 'eins ::: one' }, { block: 1, text: 'zwei ::: two' }],
  };
  const rows = (open: Record<string, true>) => treeRows(TREE, open, {}, undefined, (d) => CARDS[d] ?? []);
  const show = (rs: TreeRow[]) => rs.map((r) => `${'  '.repeat(r.depth)}${r.card ? `card ${r.card.block}` : r.cards ? `${r.cards.n} cards` : r.path || '/'}${r.has ? (r.open ? ' ▾' : ' ▸') : ''}`);

  it('a document with cards can open; closed by default; its cards after its children, under `n cards` when it has children', () => {
    expect(show(rows({ '': true }))).toEqual(['/ ▾', '  course.md ▸', '  deck.md ▸', '  plain.md']);
    expect(show(rows({ '': true, 'deck.md': true }))).toEqual(['/ ▾', '  course.md ▸', '  deck.md ▾', '    card 0', '    card 1', '  plain.md']);
    expect(show(rows({ '': true, 'course.md': true }))).toEqual(['/ ▾', '  course.md ▾', '    course/unit.md', '    1 cards ▸', '  deck.md ▸', '  plain.md']);
    const all = rows({ '': true, 'course.md': true, [cardsRowPath('course.md')]: true });
    expect(show(all).slice(1, 5)).toEqual(['  course.md ▾', '    course/unit.md', '    1 cards ▾', '      card 2']);
    expect(all.find((r) => r.card)?.path).toBe(cardRowPath('course.md', 2));
    expect(rows({ '': true, 'deck.md': true }).find((r) => r.card?.id === 'a')?.card).toEqual({ doc: 'deck.md', block: 0, id: 'a', text: 'eins ::: one' });
  });

  it('the keys walk the card rows; a card is not renamed, deleted, or moved, and a move passes over them', () => {
    const rs = rows({ '': true, 'deck.md': true });
    const c0 = cardRowPath('deck.md', 0);
    expect(treeKey(rs, 'deck.md', { key: 'ArrowDown' })).toEqual({ kind: 'focus', path: c0 });
    expect(treeKey(rs, 'deck.md', { key: 'ArrowRight' })).toEqual({ kind: 'focus', path: c0 });
    expect(treeKey(rs, c0, { key: 'ArrowLeft' })).toEqual({ kind: 'focus', path: 'deck.md' });
    expect(treeKey(rs, c0, { key: 'Enter' })).toEqual({ kind: 'activate', path: c0 });
    expect(treeKey(rs, c0, { key: 'F2' })).toBeNull();
    expect(treeKey(rs, c0, { key: 'Backspace', metaKey: true })).toBeNull();
    expect(treeKey(rs, c0, { key: 'ArrowUp', metaKey: true, altKey: true })).toBeNull();
    // plain.md moved up goes before deck.md, not among its cards
    expect(keyPlace(rs, 'plain.md', 'up')).toEqual({ target: 'deck.md', mode: 'before' });
  });
});

describe('a face\'s table', () => {
  const sarf = parse(readFileSync(join(CORPUS, 'faces/sarf.md'), 'utf8')).doc;
  const backs = sarf.blocks.flatMap((b) => {
    if (b.kind !== 'card') return [];
    const f = cardFields(b.text);
    return f?.form === 'qa' ? [f.back] : f?.form === 'bidir' ? [f.right] : [];
  });
  const field = (text: string, tables = true) => makeState(faceFieldBlocks(text, tables), { frozen: () => false, pos: null });

  it('opens as a table, and an untouched face writes back byte for byte', () => {
    expect(backs.length).toBeGreaterThanOrEqual(2);
    for (const back of backs) {
      const s = field(back);
      expect(faceFieldText(s.doc)).toBe(back);
    }
    const s = field(backs[0]!);
    expect(s.doc.firstChild?.type).toBe(schema.nodes.table);
    // a face of prose around a table, and one with none
    for (const t of ['before\n| a | b |\n|---|---|\n| 1 | 2 |\nafter', 'one line', 'two\nlines', '']) expect(faceFieldText(field(t).doc)).toBe(t);
    // a cloze's face holds no table: its pipe lines stay its text
    const cloze = field('{{c1::a}}\n| x |', false);
    expect(cloze.doc.firstChild?.type).toBe(schema.nodes.paragraph);
    expect(faceFieldText(cloze.doc)).toBe('{{c1::a}}\n| x |');
  });

  it('a cell edited writes the face as valid pipe lines, read back as a card with the same table', () => {
    let s = field(backs[0]!);
    let at = -1;
    s.doc.descendants((n, pos) => { if (at < 0 && n.type === schema.nodes.table_cell && n.textContent === 'كَتَبَا') at = pos + 1 + n.content.size; return at < 0; });
    s = s.apply(s.tr.setSelection(TextSelection.create(s.doc, at)));
    s = s.apply(s.tr.insertText('!'));
    const out = faceFieldText(s.doc);
    expect(out.split('\n')).toEqual(['|  | singular | dual | plural |', '| --- | --- | --- | --- |', '| m | كَتَبَ | كَتَبَا! | كَتَبُوا |', '| f | كَتَبَتْ | كَتَبَتَا | كَتَبْنَ |']);
    const card = parse(`the past\n?\n${out}\n`).doc.blocks[0]!;
    expect(card.kind).toBe('card');
    expect(card.kind === 'card' && cardFields(card.text)?.form).toBe('qa');
  });
});

// ── the view, drawn ──────────────────────────────────────────────

let root: string;
let vault: Vault;
const bodies = new Map<string, Doc>();

vi.mock('../vault.js', async (orig) => {
  const real = await orig<typeof import('../vault.js')>();
  return {
    ...real,
    currentVault: () => vault,
    docsOf: (paths: readonly string[]) => paths.filter((p) => bodies.has(p)).map((p) => [p, bodies.get(p)!] as [string, Doc]),
    note: () => {},
  };
});

const { Lens } = await import('../Lenses.js');
const { cardsId } = await import('../names.js');
(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

beforeEach(async () => {
  root = await fsp.mkdtemp(join(tmpdir(), 'ilmi-cardview-'));
  await fsp.cp(join(CORPUS, 'vault'), root, { recursive: true });
  vault = await Vault.open(nodeFs, root);
});
afterEach(async () => {
  vault.close();
  await fsp.rm(root, { recursive: true, force: true });
});

describe('the card view', () => {
  let host: HTMLDivElement;
  let r: Root;
  const disk = () => fsp.readFile(join(root, DECK), 'utf8');
  /** The vault's write reported: the body read again, `docs` moved, as the app's events do. */
  const refresh = async () => {
    bodies.set(DECK, (await vault.read(DECK, true)).doc);
    await act(async () => { useApp.setState((s) => ({ docs: { ...s.docs } })); });
  };
  const settle = async () => { await act(async () => { await new Promise((res) => setTimeout(res, 30)); }); await refresh(); };

  beforeEach(async () => {
    bodies.set(DECK, (await vault.read(DECK)).doc);
    const docs: Record<string, DocInfo> = { [DECK]: { type: 'deck', frozen: false, cards: 7, due: 0 } };
    useApp.setState({ docs, files: [DECK], vault: root, cardAt: { [DECK]: { block: 0, id: 'cv-vorsatz' } }, selectedCard: null, reveal: null });
    host = document.createElement('div');
    host.className = 'pane-body';
    document.body.appendChild(host);
    r = createRoot(host);
    await act(async () => { r.render(createElement(Lens, { id: cardsId(DECK), active: true, onOpen: () => {} })); });
  });
  afterEach(() => { act(() => r.unmount()); host.remove(); bodies.clear(); });

  const faces = () => Array.from(host.querySelectorAll<HTMLElement>('.card-view .card .face'));
  const viewOf = (face: HTMLElement) => faceViews.get(face.querySelector('.face-host')!)!;
  const key = (k: string, el: EventTarget = window, init: KeyboardEventInit = {}) => act(() => { el.dispatchEvent(new KeyboardEvent('keydown', { key: k, bubbles: true, cancelable: true, ...init })); });

  it('shows the card in the two boxes, live, the count and the schedule under them', () => {
    expect(host.querySelector('.cv-count')?.textContent).toBe('1 / 7');
    expect(faces().map((f) => f.textContent)).toEqual(['der Vorsatz', 'resolution; intention']);
    expect(faces().every((f) => f.querySelector('.ProseMirror[contenteditable="true"]'))).toBe(true);
    expect(host.querySelector('.card-meta .cm-forms [data-active="1"]')?.textContent).toBe('bidir');
    expect(host.querySelector('.card-meta')?.textContent).toContain('6 reviews');
    expect(useApp.getState().selectedCard).toEqual({ path: DECK, index: 0 });
  });

  it('a face edited and ⌘⏎: one write, the card\'s line only, its id and both sr lines kept', async () => {
    const before = await disk();
    const back = faces()[1]!;
    const v = viewOf(back);
    await act(() => { v.dispatch(v.state.tr.insertText('; purpose', v.state.doc.content.size - 1)); });
    expect(host.querySelector('.card-edit')?.getAttribute('data-dirty')).toBe('1');
    await key('Enter', back.querySelector('.ProseMirror')!, { metaKey: true });
    await settle();
    const after = await disk();
    expect(after).toBe(before.replace('der Vorsatz ::: resolution; intention ^cv-vorsatz', 'der Vorsatz ::: resolution; intention; purpose ^cv-vorsatz'));
    expect(host.querySelector('.card-edit')?.getAttribute('data-dirty')).toBe('0');
  });

  it('Escape puts the faces back; nothing is written', async () => {
    const before = await disk();
    const front = faces()[0]!;
    const v = viewOf(front);
    await act(() => { v.dispatch(v.state.tr.insertText('X', 1)); });
    expect(faces()[0]!.textContent).toBe('Xder Vorsatz');
    await key('Escape', front.querySelector('.ProseMirror')!);
    expect(faces()[0]!.textContent).toBe('der Vorsatz');
    await settle();
    expect(await disk()).toBe(before);
  });

  it('the form switch to q&a asks before it drops the reviewed reverse; `]` waits; ⌘⏎ saves anyway; then `]` moves on', async () => {
    const qa = Array.from(host.querySelectorAll<HTMLElement>('.cm-forms button')).find((b) => b.textContent === 'q&a')!;
    await act(() => { qa.click(); });
    await key(']');
    expect(host.querySelector('.cm-ask')?.textContent).toBe('drops the schedule of the reverse (2 reviews)');
    expect(host.querySelector('.cv-count')?.textContent).toBe('1 / 7');
    await key('Enter', host.querySelector('.card-edit .ProseMirror')!, { metaKey: true });
    await settle();
    const after = await disk();
    expect(after).toContain('der Vorsatz :: resolution; intention ^cv-vorsatz\n<!-- sr due=2026-05-27 st=review s=3 d=5 r=4 l=1 ivl=3 last=2026-05-24T07:30:00Z g=2 -->\n\ndie Wiederholung');
    await key(']');
    expect(host.querySelector('.cv-count')?.textContent).toBe('2 / 7');
    expect(faces().map((f) => f.textContent)).toEqual(['die Wiederholung', 'repetition; review']);
  });

  it('`]` saves an edit in hand before it moves', async () => {
    const v = viewOf(faces()[1]!);
    await act(() => { v.dispatch(v.state.tr.insertText(' (n.)', v.state.doc.content.size - 1)); });
    await key(']');
    expect(host.querySelector('.cv-count')?.textContent).toBe('2 / 7');
    await settle();
    expect(await disk()).toContain('der Vorsatz ::: resolution; intention (n.) ^cv-vorsatz\n<!-- sr due=2026-05-27');
    await key('[');
    expect(host.querySelector('.cv-count')?.textContent).toBe('1 / 7');
    expect(faces()[1]!.textContent).toBe('resolution; intention (n.)');
  });
});
