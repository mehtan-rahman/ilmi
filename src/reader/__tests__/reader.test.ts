import { promises as fsp } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { NodeSelection, TextSelection } from 'prosemirror-state';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { meta, parse, serialize, type Block, type Card } from '../../format/index.js';
import { queue } from '../../schedule/index.js';
import { nodeFs } from '../../vault/node-fs.js';
import { Vault } from '../../vault/index.js';
import {
  blockAt, blocksEqual, cardDue, cardText, cursorIndex, editorialRanges, fromDoc, insertCard, makeState, markerKey,
  markerPos, mathEditKey, mathSplit, openMath, passage, pickPos, proseIndices, schema, setCardText, setReadPos, textOf, toDoc,
} from '../index.js';

const CORPUS = fileURLToPath(new URL('../../format/__tests__/corpus/vault/', import.meta.url));
const WOZ = 'papers/wozniak-1990.md';

const live = { frozen: () => false, pos: null };

async function corpusFiles(dir: string): Promise<string[]> {
  const out: string[] = [];
  for (const e of await fsp.readdir(dir, { withFileTypes: true })) {
    const p = join(dir, e.name);
    if (e.isDirectory()) out.push(...(await corpusFiles(p)));
    else if (e.name.endsWith('.md')) out.push(p);
  }
  return out;
}

/** Lines that differ between two texts of equal length, as [index, before, after]. */
function lineDiff(a: string, b: string): [number, string, string][] {
  const la = a.split('\n');
  const lb = b.split('\n');
  expect(lb.length).toBe(la.length);
  const out: [number, string, string][] = [];
  la.forEach((l, i) => { if (l !== lb[i]) out.push([i + 1, l, lb[i]!]); });
  return out;
}

/** Position just inside the child `index` of the document. */
const childStart = (doc: ReturnType<typeof toDoc>, index: number): number => {
  let at = 0;
  for (let i = 0; i < index; i++) at += doc.child(i).nodeSize;
  return at + 1;
};

describe('blocks ↔ document', () => {
  it('is a fixed point over the corpus', async () => {
    for (const file of await corpusFiles(CORPUS)) {
      const { doc } = parse(await fsp.readFile(file, 'utf8'));
      const back = fromDoc(toDoc(doc.blocks));
      expect(back, file).toEqual(doc.blocks);
      expect(blocksEqual(back, doc.blocks)).toBe(true);
    }
  });

  it('keeps math as chips and prose as text', () => {
    expect(mathSplit('so $x^{a^{b}}$ and $$\\int f$$ here')).toEqual([
      'so ', { math: '$x^{a^{b}}$' }, ' and ', { math: '$$\\int f$$' }, ' here',
    ]);
    expect(mathSplit('$5 and $10')).toEqual(['$5 and $10']);
    const doc = toDoc([{ kind: 'paragraph', text: 'so $x$ here' }]);
    const p = doc.child(0);
    expect(p.childCount).toBe(3);
    expect(p.child(1).type).toBe(schema.nodes.math);
    expect(textOf(p)).toBe('so $x$ here');
  });

  it('gives an empty body one paragraph and drops empty prose on the way back', () => {
    const doc = toDoc([]);
    expect(doc.childCount).toBe(1);
    expect(fromDoc(doc)).toEqual([]);
    const withBlank = toDoc([{ kind: 'paragraph', text: 'a' }, { kind: 'paragraph', text: '   ' }, { kind: 'heading', level: 2, text: 'b' }]);
    expect(fromDoc(withBlank)).toEqual([{ kind: 'paragraph', text: 'a' }, { kind: 'heading', level: 2, text: 'b' }]);
  });

  it('lets only the first half of a split paragraph keep the id', () => {
    const state = makeState([{ kind: 'paragraph', text: 'one two', id: 'p1', extracts: ['ex'] }], live);
    const tr = state.tr.split(1 + 3);
    const blocks = fromDoc(state.apply(tr).doc);
    expect(blocks).toEqual([
      { kind: 'paragraph', text: 'one', id: 'p1', extracts: ['ex'] },
      { kind: 'paragraph', text: ' two', extracts: ['ex'] },
    ]);
  });

  it('passes cards and raw blocks through untouched; a list is a list node and still comes back as written', () => {
    const blocks: Block[] = [
      { kind: 'raw', text: '<div>\nan html block\n</div>' },
      { kind: 'card', text: 'a :: b', id: 'c1', sched: { due: '2026-05-27', state: 'review', extra: [['x', '1']] } },
    ];
    const doc = toDoc(blocks);
    expect(doc.child(0).type).toBe(schema.nodes.raw);
    expect(doc.child(1).type).toBe(schema.nodes.card);
    const back = fromDoc(doc);
    expect(back).toEqual(blocks);
    expect(back[1]).not.toBe(blocks[1]);
    const raws = ['- a list\n- of things', '> quoted', '```\ncode\n```', '| a | b |\n|---|---|\n| 1 | 2 |'];
    const live = toDoc(raws.map((text) => ({ kind: 'raw', text })));
    expect([0, 1, 2, 3].map((i) => live.child(i).type)).toEqual([schema.nodes.list, schema.nodes.quote, schema.nodes.code_block, schema.nodes.table]);
    expect(fromDoc(live)).toEqual(raws.map((text) => ({ kind: 'raw', text })));
  });
});

describe('editing', () => {
  let root: string;
  let vault: Vault;

  beforeEach(async () => {
    root = await fsp.mkdtemp(join(tmpdir(), 'ilmi-reader-'));
    await fsp.cp(CORPUS, root, { recursive: true });
    vault = await Vault.open(nodeFs, root);
  });

  afterEach(async () => {
    vault.close();
    await fsp.rm(root, { recursive: true, force: true });
  });

  it('changes only the edited paragraph on disk', async () => {
    const before = await vault.read(WOZ);
    const state = makeState(before.doc.blocks, live);
    const i = before.doc.blocks.findIndex((b) => b.kind === 'paragraph' && b.text.startsWith('Cramming is mass'));
    expect(i).toBeGreaterThan(0);
    const at = childStart(state.doc, i) + 'Cramming'.length;
    const next = state.apply(state.tr.insertText(', they say,', at));
    const written = await vault.update(WOZ, (doc) => { doc.blocks = fromDoc(next.doc); });
    const diff = lineDiff(before.text, written.text);
    expect(diff).toHaveLength(1);
    expect(diff[0]![2]).toMatch(/^Cramming, they say, is mass repetition/);
    expect(await fsp.readFile(join(root, WOZ), 'utf8')).toBe(written.text);
    // and the file reads back as the same blocks the editor holds
    expect(written.doc.blocks).toEqual(fromDoc(next.doc));
  });

  it('refuses prose edits on a frozen document', async () => {
    const before = await vault.read(WOZ);
    expect(meta(before.doc).frozen).toBe(true);
    let frozen = true;
    const state = makeState(before.doc.blocks, { frozen: () => frozen, pos: null });
    const at = childStart(state.doc, 1) + 3;
    const tr = state.tr.insertText('XX', at);
    const refused = state.apply(tr);
    expect(refused.doc.eq(state.doc)).toBe(true);
    expect(fromDoc(refused.doc)).toEqual(before.doc.blocks);
    // the marker still moves on a frozen document
    const moved = state.apply(state.tr.setMeta(markerKey, 3));
    expect(markerPos(moved)).toBe(3);
    // thawed, the same edit lands
    frozen = false;
    expect(state.apply(state.tr.insertText('XX', at)).doc.eq(state.doc)).toBe(false);
  });

  it('turns a typed span into a chip once the caret leaves the block', () => {
    const state = makeState([{ kind: 'paragraph', text: 'first' }, { kind: 'paragraph', text: 'so $x$ here' }], live);
    // the chip from disk, replaced by its source with the caret in the block: stays literal
    const pos = childStart(state.doc, 1) + 3;
    const tr = state.tr.replaceWith(pos, pos + 1, schema.text('$x$'));
    const edited = state.apply(tr.setSelection(TextSelection.create(tr.doc, pos + 3)));
    expect(edited.doc.child(1).childCount).toBe(1);
    expect(textOf(edited.doc.child(1))).toBe('so $x$ here');
    expect(edited.doc.child(1).child(0).isText).toBe(true);
    // caret leaves: the chip re-forms
    const left = edited.apply(edited.tr.setSelection(TextSelection.create(edited.doc, 1)));
    expect(left.doc.child(1).childCount).toBe(3);
    expect(left.doc.child(1).child(1).type).toBe(schema.nodes.math);
    expect(fromDoc(left.doc)).toEqual(fromDoc(edited.doc));
  });

  it('opens a selected chip for editing and follows it through changes before it', () => {
    const state = makeState([{ kind: 'paragraph', text: 'first' }, { kind: 'paragraph', text: 'so $x$ here' }], live);
    const pos = childStart(state.doc, 1) + 3;
    expect(mathEditKey.getState(state)).toBeNull();
    // nothing selected: not a chip
    expect(openMath(state, undefined)).toBe(false);
    const withNode = state.apply(state.tr.setSelection(NodeSelection.create(state.doc, pos)));
    let opened = withNode;
    expect(openMath(withNode, (tr) => { opened = withNode.apply(tr); })).toBe(true);
    expect(mathEditKey.getState(opened)).toBe(pos);
    // text typed before it moves the chip; the position follows
    const shifted = opened.apply(opened.tr.insertText('ab', 1));
    expect(mathEditKey.getState(shifted)).toBe(pos + 2);
    expect(shifted.doc.nodeAt(pos + 2)?.type).toBe(schema.nodes.math);
    // the chip gone, nothing is being edited
    const gone = shifted.apply(shifted.tr.delete(pos + 2, pos + 3));
    expect(mathEditKey.getState(gone)).toBeNull();
    // closed by hand
    expect(mathEditKey.getState(opened.apply(opened.tr.setMeta(mathEditKey, null)))).toBeNull();
  });
});

describe('the marker', () => {
  let root: string;
  let vault: Vault;

  beforeEach(async () => {
    root = await fsp.mkdtemp(join(tmpdir(), 'ilmi-marker-'));
    await fsp.cp(CORPUS, root, { recursive: true });
    vault = await Vault.open(nodeFs, root);
  });

  afterEach(async () => {
    vault.close();
    await fsp.rm(root, { recursive: true, force: true });
  });

  it('counts prose blocks, cards skipped', () => {
    const blocks: Block[] = [
      { kind: 'heading', level: 2, text: 'h' },
      { kind: 'paragraph', text: 'a' },
      { kind: 'card', text: 'q :: a' },
      { kind: 'paragraph', text: 'b' },
    ];
    expect(proseIndices(blocks)).toEqual([0, 1, 3]);
    expect(proseIndices(toDoc(blocks))).toEqual([0, 1, 3]);
    expect(cursorIndex([0, 1, 3], 0)).toBe(-1);
    expect(cursorIndex([0, 1, 3], 2)).toBe(1);
    expect(cursorIndex([0, 1, 3], 3)).toBe(3);
    expect(cursorIndex([0, 1, 3], 9)).toBe(3);
  });

  it('snaps a pointer to the block it has reached', () => {
    const bands = [{ top: 0, height: 40 }, { top: 50, height: 100 }, { top: 160, height: 10 }];
    expect(pickPos(bands, -5)).toBe(1);
    expect(pickPos(bands, 30)).toBe(1);
    expect(pickPos(bands, 60)).toBe(1);
    expect(pickPos(bands, 72)).toBe(2);
    expect(pickPos(bands, 164)).toBe(2);
    expect(pickPos(bands, 166)).toBe(3);
    expect(pickPos([], 10)).toBe(0);
  });

  it('dims the blocks above the cursor block', () => {
    const state = makeState([
      { kind: 'heading', level: 2, text: 'h' },
      { kind: 'paragraph', text: 'a' },
      { kind: 'card', text: 'q :: a' },
      { kind: 'paragraph', text: 'b' },
    ], { frozen: () => false, pos: 3 });
    const decos = markerKey.getState(state)!.decos.find();
    expect(decos.map((d) => d.from)).toEqual([0, 3]);
    expect(markerKey.getState(state.apply(state.tr.setMeta(markerKey, 1)))!.decos.find()).toHaveLength(0);
  });

  it('writes pos as one line and keeps it across a reopen', async () => {
    const before = await vault.read(WOZ);
    expect(meta(before.doc).read?.pos).toBe(12);
    const written = await vault.update(WOZ, (doc) => setReadPos(doc, 5));
    const diff = lineDiff(before.text, written.text);
    expect(diff).toEqual([[6, 'read: due=2026-06-01 ivl=9 reps=4 pos=12', 'read: due=2026-06-01 ivl=9 reps=4 pos=5']]);
    vault.close();
    const again = await Vault.open(nodeFs, root);
    expect(meta((await again.read(WOZ)).doc).read?.pos).toBe(5);
    again.close();
  });

  it('clamps pos to the prose count and ignores unenrolled documents', () => {
    const { doc } = parse('---\nread: pos=1\n---\n\na\n\nb\n');
    setReadPos(doc, 99);
    expect(meta(doc).read?.pos).toBe(2);
    setReadPos(doc, -1);
    expect(meta(doc).read?.pos).toBe(0);
    const plain = parse('a\n').doc;
    setReadPos(plain, 1);
    expect(serialize(plain)).toBe('a\n');
  });
});

describe('cards and marks', () => {
  it('takes the earliest due over a card’s groups, new when any is unscheduled', () => {
    const base: Card = { kind: 'card', text: '{{c1::a}} {{c2::b}}' };
    expect(cardDue(base)).toBeUndefined();
    expect(cardDue({ ...base, sched: { due: '2026-06-01' } })).toBe('2026-06-01');
    expect(cardDue({ ...base, blanks: { 1: { due: '2026-06-01' }, 2: { due: '2026-05-27' } } })).toBe('2026-05-27');
    expect(cardDue({ ...base, blanks: { 1: { due: '2026-06-01' }, 2: {} } })).toBeUndefined();
    expect(cardDue({ ...base, sched: { due: '2026-05-20' }, blanks: { 1: { due: '2026-06-01' }, 2: {} } })).toBe('2026-05-20');
  });

  it('finds editorial marks and leaves the text alone', () => {
    expect(editorialRanges('plain [a note] and #TODO: fix, #tag too')).toEqual([
      { from: 6, to: 14, kind: 'note' },
      { from: 19, to: 25, kind: 'tag' },
      { from: 31, to: 35, kind: 'tag' },
    ]);
    expect(editorialRanges('no marks')).toEqual([]);
  });
});

describe('making cards', () => {
  it('writes each form the way the format reads it back', () => {
    expect(cardText({ form: 'cloze', text: ' the {{minimum}} principle ' })).toBe('the {{minimum}} principle');
    expect(cardText({ form: 'cloze', text: 'no blank here' })).toBeNull();
    expect(cardText({ form: 'cloze', text: 'empty {{  }} blank' })).toBeNull();
    expect(cardText({ form: 'cloze', text: '# a {{b}}' })).toBeNull();
    expect(cardText({ form: 'cloze', text: 'one {{a}}\n\n\ntwo' })).toBe('one {{a}}\ntwo');
    expect(cardText({ form: 'qa', front: 'what is cramming?', back: 'mass repetition' })).toBe('what is cramming? :: mass repetition');
    expect(cardText({ form: 'qa', front: 'q', back: 'a long\nanswer' })).toBe('q\n?\na long\nanswer');
    expect(cardText({ form: 'qa', front: 'is a :: b a card?', back: 'yes' })).toBe('is a :: b a card?\n?\nyes');
    expect(cardText({ form: 'qa', front: 'q', back: '  ' })).toBeNull();
    expect(cardText({ form: 'bidir', left: 'der Vorsatz', right: 'resolution' })).toBe('der Vorsatz ::: resolution');
    expect(cardText({ form: 'bidir', left: 'a', right: 'b\nc' })).toBe('a\n??\nb\nc');
    expect(cardText({ form: 'bidir', left: '', right: 'b' })).toBeNull();
    for (const t of ['the {{minimum}} principle', 'q\n?\na long\nanswer', 'der Vorsatz ::: resolution']) {
      expect(parse(t).doc.blocks).toEqual([{ kind: 'card', text: t }]);
    }
  });

  it('reads the passage a selection covers, cards skipped, math verbatim', () => {
    const blocks: Block[] = [
      { kind: 'heading', level: 2, text: 'the premise' },
      { kind: 'paragraph', text: 'so $x^2$ here', id: 'p1' },
      { kind: 'card', text: 'q :: a' },
      { kind: 'paragraph', text: 'and after' },
      { kind: 'paragraph', text: 'untouched' },
    ];
    const doc = toDoc(blocks);
    const from = childStart(doc, 0) + 4;
    const to = childStart(doc, 3) + 3;
    expect(passage(doc, from, to)).toEqual({ text: 'premise\n\nso $x^2$ here\n\nand', blocks: [0, 1, 3] });
    // ending exactly where a block starts does not touch it
    expect(passage(doc, childStart(doc, 1), childStart(doc, 3))).toEqual({ text: 'so $x^2$ here', blocks: [1] });
    expect(passage(doc, from, from)).toEqual({ text: '', blocks: [] });
    expect(blockAt(doc, childStart(doc, 3) + 2)).toBe(3);
    expect(blockAt(doc, childStart(doc, 3) - 1)).toBe(2);
    expect(blockAt(doc, 0)).toBe(0);
  });

  it('inserts a card after a block on a frozen document and appends without an anchor', () => {
    const state = makeState([{ kind: 'paragraph', text: 'a' }, { kind: 'paragraph', text: 'b' }], { frozen: () => true, pos: null });
    const card: Card = { kind: 'card', text: 'q :: a' };
    const after0 = state.apply(insertCard(state, card, 0));
    expect(fromDoc(after0.doc)).toEqual([{ kind: 'paragraph', text: 'a' }, card, { kind: 'paragraph', text: 'b' }]);
    const atEnd = state.apply(insertCard(state, card, null));
    expect(fromDoc(atEnd.doc)).toEqual([{ kind: 'paragraph', text: 'a' }, { kind: 'paragraph', text: 'b' }, card]);
    // prose is still refused
    expect(state.apply(state.tr.insertText('X', 1)).doc.eq(state.doc)).toBe(true);
  });

  it('changes a card’s text in place, keeping its id and schedules', () => {
    const card: Card = { kind: 'card', text: 'q :: a', id: 'c1', sched: { due: '2026-05-27', state: 'review' } };
    const state = makeState([{ kind: 'paragraph', text: 'a' }, card], { frozen: () => true, pos: null });
    const tr = setCardText(state, 1, 'q :: better');
    expect(tr).not.toBeNull();
    expect(fromDoc(state.apply(tr!).doc)[1]).toEqual({ ...card, text: 'q :: better' });
    expect(setCardText(state, 0, 'x')).toBeNull();
  });
});

describe('extracts and cards, end to end', () => {
  let root: string;
  let vault: Vault;
  const NOW = new Date('2026-05-27T12:00:00Z');

  beforeEach(async () => {
    root = await fsp.mkdtemp(join(tmpdir(), 'ilmi-carve-'));
    await fsp.cp(CORPUS, root, { recursive: true });
    vault = await Vault.open(nodeFs, root);
  });

  afterEach(async () => {
    vault.close();
    await fsp.rm(root, { recursive: true, force: true });
  });

  it('both flows produce files that parse cleanly and appear in the tree and the queue', async () => {
    const before = await vault.read(WOZ);
    expect(meta(before.doc).frozen).toBe(true);
    const state = makeState(before.doc.blocks, { frozen: () => true, pos: meta(before.doc).read?.pos ?? null });
    // a card, composed from the last paragraph, inserted after it
    const last = before.doc.blocks.length - 1;
    const text = cardText({ form: 'qa', front: 'what does cramming solve?', back: 'an exam tomorrow morning, and nothing that lasts' });
    expect(text).not.toBeNull();
    const at = childStart(state.doc, last) + 5;
    const next = state.apply(insertCard(state, { kind: 'card', text: text! }, blockAt(state.doc, at)));
    const withCard = await vault.update(WOZ, (doc) => { doc.blocks = fromDoc(next.doc); });
    expect(withCard.diagnostics).toEqual([]);
    expect(withCard.text.split('\n').length).toBe(before.text.split('\n').length + 2);
    expect(withCard.doc.blocks.at(-1)).toEqual({ kind: 'card', text });

    // an extract, from a selection over the §4 paragraph
    const doc = toDoc(withCard.doc.blocks);
    const sel = passage(doc, childStart(doc, last), childStart(doc, last) + 'Cramming is mass repetition compressed in time.'.length);
    expect(sel).toEqual({ text: 'Cramming is mass repetition compressed in time.', blocks: [last] });
    const child = await vault.extract(WOZ, { ...sel, today: '2026-05-27' });
    expect(child).toBe('papers/wozniak-1990/cramming is mass repetition compressed.md');

    // both files read back clean, from disk
    for (const path of [WOZ, child]) {
      const { doc: d, diagnostics } = parse(await fsp.readFile(join(root, path), 'utf8'));
      expect(diagnostics, path).toEqual([]);
      expect(serialize(d)).toBe((await vault.read(path, true)).text);
    }
    const parent = await vault.read(WOZ);
    expect(parent.doc.blocks[last]).toEqual({
      kind: 'paragraph',
      text: before.doc.blocks[last]!.text,
      extracts: ['cramming is mass repetition compressed'],
    });
    expect(meta(parent.doc).read?.pos).toBe(12);
    const ex = await vault.read(child);
    expect(meta(ex.doc)).toMatchObject({ type: 'extract', imported: '2026-05-27', pri: 80, read: { due: '2026-05-27', ivl: 1, reps: 0, pos: 0 } });
    expect(ex.doc.blocks).toEqual([{ kind: 'paragraph', text: sel.text }]);

    // in the tree
    expect(vault.documents()).toContain(child);
    const node = vault.tree.find((n) => n.path === 'papers')!;
    expect(node.kind).toBe('folder');
    const woz = (node.kind === 'folder' ? node.children : []).find((n) => n.path === WOZ);
    expect(woz?.kind === 'doc' && woz.children?.map((c) => c.path)).toEqual([child, 'papers/wozniak-1990/woz-ex1.md']);

    // in the queue, today
    const today = await queue(vault, NOW, 'today');
    expect(today.some((i) => i.kind === 'read' && i.path === child)).toBe(true);
    expect(today.some((i) => i.kind === 'card' && i.path === WOZ && i.text === text && i.due === undefined)).toBe(true);
  });
});
