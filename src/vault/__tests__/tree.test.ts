import { promises as fsp } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { meta, parse, setField } from '../../format/index.js';
import { nodeFs } from '../node-fs.js';
import { Vault, addToPage, documents, extractName, pageOf, pageOfBlock, pageSection, type TreeNode, type VaultEvent } from '../index.js';
import { childDirOf, cleanName, fileName, nameOf, rekey, within } from '../paths.js';

const CORPUS = fileURLToPath(new URL('../../format/__tests__/corpus/vault/', import.meta.url));
const WOZ = 'papers/wozniak-1990.md';
const EX1 = 'papers/wozniak-1990/woz-ex1.md';

let root: string;
let vault: Vault;
let events: VaultEvent[];

beforeEach(async () => {
  root = await fsp.mkdtemp(join(tmpdir(), 'ilmi-tree-'));
  await fsp.cp(CORPUS, root, { recursive: true });
  vault = await Vault.open(nodeFs, root);
  events = [];
  vault.subscribe((ev) => events.push(ev));
});

afterEach(async () => {
  vault.close();
  await fsp.rm(root, { recursive: true, force: true });
});

const exists = async (rel: string) => !!(await nodeFs.stat(join(root, rel)));
const isDir = async (rel: string) => (await nodeFs.stat(join(root, rel)))?.isDir === true;
const readDisk = (rel: string) => fsp.readFile(join(root, rel), 'utf8');

function find(nodes: TreeNode[], path: string): TreeNode | undefined {
  for (const n of nodes) {
    if (n.path === path) return n;
    const kids = n.kind === 'folder' ? n.children : n.children ?? [];
    const hit = find(kids, path);
    if (hit) return hit;
  }
  return undefined;
}

const treeEvents = () => events.filter((e) => e.kind === 'tree').length;

describe('paths', () => {
  it('re-keys a path under a moved document or folder', () => {
    expect(rekey(WOZ, WOZ, 'books/woz.md')).toBe('books/woz.md');
    expect(rekey(EX1, WOZ, 'books/woz.md')).toBe('books/woz/woz-ex1.md');
    expect(rekey('papers/crick-1995.md', WOZ, 'books/woz.md')).toBeNull();
    expect(rekey('papers/archive/sutton-2019.md', 'papers', 'old')).toBe('old/archive/sutton-2019.md');
    expect(rekey('papers-2/x.md', 'papers', 'old')).toBeNull();
    // a document's children directory is re-keyed with it: a tab on its folder lens, its order
    expect(rekey('papers/wozniak-1990', WOZ, 'books/woz.md')).toBe('books/woz');
  });

  it('knows names, children directories, and containment', () => {
    expect(nameOf(WOZ)).toBe('wozniak-1990');
    expect(nameOf('papers')).toBe('papers');
    expect(childDirOf(WOZ)).toBe('papers/wozniak-1990');
    expect(within('papers/archive', 'papers')).toBe(true);
    expect(within('papers', 'papers/archive')).toBe(false);
    expect(within('anything', '')).toBe(true);
  });

  it('accepts plain names and refuses separators, hidden names, and extensions', () => {
    expect(cleanName('  spaced composition ')).toBe('spaced composition');
    expect(cleanName('german · A1')).toBe('german · A1');
    for (const bad of ['', '   ', 'a/b', 'a\\b', '.ilmi', '..', 'x.md', 'a:b']) expect(cleanName(bad)).toBeNull();
  });

  it('makes a file name out of any title', () => {
    expect(fileName('Spaced repetition and the economics of attention')).toBe('Spaced repetition and the economics of attention');
    expect(fileName('Attention: a  study / part 2')).toBe('Attention a study part 2');
    expect(fileName('  .hidden.md ')).toBe('hidden');
    expect(fileName('')).toBe('untitled');
    expect(fileName('..')).toBe('untitled');
    expect(fileName('x'.repeat(100))).toHaveLength(80);
  });
});

describe('create', () => {
  it('makes a folder at the root, then numbers the next one', async () => {
    expect(await vault.createFolder('')).toBe('untitled folder');
    expect(await vault.createFolder('')).toBe('untitled folder 2');
    expect(await isDir('untitled folder')).toBe(true);
    expect(await isDir('untitled folder 2')).toBe(true);
    expect(find(vault.tree, 'untitled folder 2')?.kind).toBe('folder');
    expect(treeEvents()).toBe(2);
  });

  it('makes a folder inside a folder, and inside a document by creating its children directory', async () => {
    expect(await vault.createFolder('papers/archive', 'old')).toBe('papers/archive/old');
    expect(await vault.createFolder('papers/crick-1995', 'notes')).toBe('papers/crick-1995/notes');
    expect(await isDir('papers/crick-1995/notes')).toBe(true);
    const crick = find(vault.tree, 'papers/crick-1995.md');
    expect(crick?.kind === 'doc' && crick.children?.map((c) => c.path)).toEqual(['papers/crick-1995/notes']);
  });

  it('refuses a folder inside a missing directory or a bad name', async () => {
    await expect(vault.createFolder('nowhere')).rejects.toThrow('no such folder');
    await expect(vault.createFolder('', 'a/b')).rejects.toThrow('not a folder name');
    await expect(vault.createFolder('', '.hidden')).rejects.toThrow();
  });

  it('writes a note with no front-matter, and a source and a deck with their types', async () => {
    const note = await vault.createDoc('papers', 'note');
    expect(note).toBe('papers/untitled.md');
    const text = await readDisk(note);
    expect(text).toBe('');
    const parsed = parse(text);
    expect(parsed.diagnostics).toEqual([]);
    expect(meta(parsed.doc).type).toBe('note');
    const src = await vault.createDoc('papers', 'source');
    expect(src).toBe('papers/untitled 2.md');
    expect(await readDisk(src)).toBe('---\ntype: source\n---\n');

    const deck = await vault.createDoc('', 'deck');
    expect(deck).toBe('untitled deck.md');
    expect(await readDisk(deck)).toBe('---\ntype: deck\n---\n');
    expect(find(vault.tree, deck)).toMatchObject({ kind: 'doc', name: 'untitled deck' });
  });

  it('starts a draft in spaced composition today', async () => {
    const path = await vault.createDoc('essays', 'draft', undefined, '2026-05-27');
    expect(path).toBe('essays/untitled draft.md');
    expect(await readDisk(path)).toBe('---\ntype: draft\nstarted: 2026-05-27\nwrite: due=2026-05-27 ivl=1 reps=0\n---\n');
    const { doc, diagnostics } = parse(await readDisk(path));
    expect(diagnostics).toEqual([]);
    expect(meta(doc).write).toEqual({ due: '2026-05-27', ivl: 1, reps: 0 });
  });

  it('numbers a document whose name is taken by a document or a folder', async () => {
    expect(await vault.createDoc('', 'source', 'german')).toBe('german 2.md');
    expect(await vault.createDoc('', 'source', 'papers')).toBe('papers 2.md');
    expect(await vault.createFolder('', 'german')).toBe('german 3');
  });

  it('makes an extract inside a document by creating its children directory', async () => {
    const path = await vault.createDoc('papers/crick-1995', 'extract', 'crick-ex1');
    expect(path).toBe('papers/crick-1995/crick-ex1.md');
    expect(await readDisk(path)).toBe('---\ntype: extract\n---\n');
    expect(documents(vault.tree)).toContain(path);
  });
});

describe('a passage marked in a text source (milestone 50)', () => {
  it('becomes a section of the source\'s note, enrolled, with a from line; the source keeps only its marker', async () => {
    await vault.update(WOZ, (d) => { const r = meta(d).read!; setField(d, 'read', { ...r, pos: 2 }); });
    const before = await vault.read(WOZ);
    const text = 'The twenty rules are the residue\n\nAtomicity is the unglamorous one';
    const made = await vault.section(WOZ, { text, blocks: [5, 6], today: '2026-05-27' });
    // at priority 80 the section first comes back on the cadence of every third day
    expect(made).toEqual({ note: 'papers/wozniak-1990/notes.md', index: 0, text: 'the twenty rules are the residue', ivl: 3 });
    const note = parse(await readDisk(made.note));
    expect(note.diagnostics).toEqual([]);
    expect(meta(note.doc)).toMatchObject({ type: 'note', title: 'wozniak-1990 — notes' });
    expect(note.doc.blocks).toEqual([
      { kind: 'heading', level: 2, text: 'the twenty rules are the residue', read: { made: '2026-05-27', due: '2026-05-30', ivl: 3, pri: 80 } },
      { kind: 'paragraph', text: 'from: wozniak-1990' },
      { kind: 'paragraph', text: 'The twenty rules are the residue' },
      { kind: 'paragraph', text: 'Atomicity is the unglamorous one' },
    ]);
    // the source: no backref, no highlight, the marker past the passage
    const parent = parse(await readDisk(WOZ)).doc;
    expect(parent.blocks).toEqual(before.doc.blocks);
    expect(meta(parent).read).toEqual({ ...meta(before.doc).read, pos: 6 });
    expect(documents(vault.tree)).toContain(made.note);
    // a second passage goes under the first; a name taken is numbered
    const again = await vault.section(WOZ, { text: 'The twenty rules are the residue', blocks: [5], today: '2026-05-28' });
    expect(again).toEqual({ note: made.note, index: 4, text: 'the twenty rules are the residue · 2', ivl: 3 });
    const two = parse(await readDisk(made.note)).doc;
    expect(two.blocks.filter((b) => b.kind === 'heading').map((b) => b.text)).toEqual(['the twenty rules are the residue', 'the twenty rules are the residue · 2']);
    expect(meta(parse(await readDisk(WOZ)).doc).read?.pos).toBe(6);
  });

  it('folds an extract document into the note as a section: its schedule on the line, its cards kept, the file and the backrefs gone', async () => {
    const child = await vault.extract(WOZ, { text: 'Atomicity is the unglamorous one', blocks: [6], today: '2026-05-20' });
    await vault.update(child, (d) => {
      setField(d, 'read', { due: '2026-06-02', ivl: 9, reps: 2, pos: 1 });
      d.blocks.push({ kind: 'paragraph', text: 'my gloss' }, { kind: 'card', text: 'atomic :: one fact per card', id: 'ex-atomic', sched: { due: '2026-06-01', st: 'review', ivl: 4 } } as never);
    });
    expect((await vault.read(WOZ)).doc.blocks[6]).toMatchObject({ extracts: ['atomicity is the unglamorous one'] });
    const made = await vault.absorbExtract(child);
    expect(made.note).toBe('papers/wozniak-1990/notes.md');
    const note = parse(await readDisk(made.note)).doc;
    const at = note.blocks.findIndex((b) => b.kind === 'heading' && b.text === made.text);
    expect(made.text).toBe('atomicity is the unglamorous one');
    expect(note.blocks[at]).toMatchObject({ kind: 'heading', level: 2, read: { made: '2026-05-20', due: '2026-06-02', ivl: 9, reps: 2, pri: 80 } });
    expect(note.blocks.slice(at + 1)).toMatchObject([
      { kind: 'paragraph', text: 'from: wozniak-1990' },
      { kind: 'paragraph', text: 'Atomicity is the unglamorous one' },
      { kind: 'paragraph', text: 'my gloss' },
      { kind: 'card', text: 'atomic :: one fact per card', id: 'ex-atomic' },
    ]);
    expect(await exists(child)).toBe(false);
    expect((await vault.read(WOZ)).doc.blocks[6]).not.toHaveProperty('extracts');
    expect(documents(vault.tree)).not.toContain(child);
  });
});

describe('extract', () => {
  it('names the child from the passage', () => {
    // 40: the first clause's words, lower case, at most six, never ending on a small word
    expect(extractName('Atomicity sounds easy — and is, in fact, the hardest discipline.')).toBe('atomicity sounds easy');
    expect(extractName('one two')).toBe('one two');
    expect(extractName('… — !')).toBe('untitled extract');
    expect(extractName("it's a name/with: slashes")).toBe("it's a name");
    expect(extractName('Typed from the green notebook, pp. 1–19. Lindgren follows the standard order.')).toBe('typed from the green notebook');
    expect(extractName('The problem: we know the spectrum of some $H^0$ exactly,')).toBe('the problem');
    expect(extractName('When the **perturbation** is small compared with the level spacing we expand')).toBe('when the perturbation is small compared');
    expect(extractName('The second-order energy shift of the ground state is always negative')).toBe('the second-order energy shift');
    expect(extractName('$E = mc^2$, a famous one')).toBe('a famous one');
    expect(extractName('كَانَ وَأَخَوَاتُهَا تَرْفَعُ الْمُبْتَدَأَ وَتَنْصِبُ الْخَبَرَ')).toBe('كَانَ وَأَخَوَاتُهَا تَرْفَعُ الْمُبْتَدَأَ وَتَنْصِبُ الْخَبَرَ');
  });

  it('carves a child with its own reading schedule, backrefs on the touched paragraphs, the marker past them', async () => {
    const before = await vault.read(WOZ);
    await vault.update(WOZ, (d) => { const r = meta(d).read!; setField(d, 'read', { ...r, pos: 2 }); });
    const lowered = (await vault.read(WOZ)).text;
    // blocks 4..6: the §2 heading and its two paragraphs
    const text = 'twenty rules of formulating knowledge\n\nThe twenty rules are the residue\n\nAtomicity is the unglamorous one';
    const child = await vault.extract(WOZ, { text, blocks: [4, 5, 6], today: '2026-05-27' });
    expect(child).toBe('papers/wozniak-1990/twenty rules of formulating knowledge.md');
    expect(await exists(child)).toBe(true);
    const ex = parse(await readDisk(child));
    expect(ex.diagnostics).toEqual([]);
    // its first interval is the cadence of its priority: every third day at 80
    expect(meta(ex.doc)).toMatchObject({ type: 'extract', imported: '2026-05-27', pri: 80, read: { due: '2026-05-27', ivl: 3, reps: 0, pos: 0 } });
    expect(meta(ex.doc).read?.pri).toBeUndefined();
    expect(ex.doc.blocks).toEqual([
      { kind: 'paragraph', text: 'twenty rules of formulating knowledge' },
      { kind: 'paragraph', text: 'The twenty rules are the residue' },
      { kind: 'paragraph', text: 'Atomicity is the unglamorous one' },
    ]);
    // the parent: one backref line under each paragraph, none under the heading, and the read line
    const after = await readDisk(WOZ);
    const la = lowered.split('\n');
    const lb = after.split('\n');
    expect(lb.length).toBe(la.length + 2);
    const ref = '<!-- extract twenty rules of formulating knowledge -->';
    expect(lb.filter((l) => l === ref)).toHaveLength(2);
    const parent = parse(after).doc;
    expect(parent.blocks[4]).toEqual(before.doc.blocks[4]);
    expect(parent.blocks[5]).toEqual({ ...before.doc.blocks[5], extracts: [ref.slice(13, -4)] });
    expect(parent.blocks[6]).toEqual({ ...before.doc.blocks[6], extracts: [ref.slice(13, -4)] });
    expect(meta(parent).read).toEqual({ ...meta(before.doc).read, pos: 6 });
    const rest = lb.filter((l) => l !== ref);
    expect(rest.filter((l, i) => l !== la[i])).toEqual(['read: due=2026-06-01 ivl=9 reps=4 pos=6']);
    // the tree has it, under the parent, and said so
    expect(documents(vault.tree)).toContain(child);
    const node = find(vault.tree, WOZ);
    expect(node?.kind === 'doc' && node.children?.some((c) => c.path === child)).toBe(true);
    expect(treeEvents()).toBe(1);
  });

  it('never moves the marker back, tags a card too, and numbers a taken name', async () => {
    const before = await vault.read(WOZ);
    const first = await vault.extract(WOZ, { text: 'a card', blocks: [3], today: '2026-05-27' });
    expect(first).toBe('papers/wozniak-1990/a card.md');
    const second = await vault.extract(WOZ, { text: 'a card', blocks: [3], today: '2026-05-27' });
    expect(second).toBe('papers/wozniak-1990/a card 2.md');
    const parent = await vault.read(WOZ);
    expect(parent.doc.blocks[3]).toEqual({ ...before.doc.blocks[3], extracts: ['a card', 'a card 2'] });
    expect(meta(parent.doc).read?.pos).toBe(12);
    // a parent not enrolled in reading: the child still is, with no priority, and the parent has no marker to move
    const james = await vault.extract('books/james-pluralistic-ch4.md', { text: 'x y', blocks: [0], name: 'given', today: '2026-05-27' });
    expect(james).toBe('books/james-pluralistic-ch4/given.md');
    expect(meta((await vault.read(james)).doc).read).toEqual({ due: '2026-05-27', ivl: 2, reps: 0, pos: 0 });
    expect(meta((await vault.read('books/james-pluralistic-ch4.md')).doc).read).toBeUndefined();
  });

  it('extracts from a note revisited without giving it a marker', async () => {
    const note = 'fleeting/office-hours.md';
    const before = await readDisk(note);
    const child = await vault.extract(note, { text: 'Start from the symmetry, not the algebra.', blocks: [1], today: '2026-05-27' });
    expect(child).toBe('fleeting/office-hours/start from the symmetry.md');
    const after = await readDisk(note);
    // the backref is the only change: the read line keeps no pos
    expect(after.split('\n').find((l) => l.startsWith('read:'))).toBe('read: due=2026-06-02 ivl=4 reps=1');
    expect(after.replace('\n<!-- extract start from the symmetry -->', '')).toBe(before);
  });

  it('extracts from an extract, and refuses nothing or a missing parent', async () => {
    const grandchild = await vault.extract(EX1, { text: 'Every bundle is a future failure', blocks: [0], today: '2026-05-27' });
    expect(grandchild).toBe('papers/wozniak-1990/woz-ex1/every bundle is a future failure.md');
    expect(await isDir('papers/wozniak-1990/woz-ex1')).toBe(true);
    expect((await vault.read(EX1)).doc.blocks[0]).toMatchObject({ extracts: ['every bundle is a future failure'] });
    await expect(vault.extract(WOZ, { text: '  ', blocks: [] })).rejects.toThrow('nothing to extract');
    await expect(vault.extract('papers/none.md', { text: 'x', blocks: [] })).rejects.toThrow('no such document');
    await expect(vault.extract('papers', { text: 'x', blocks: [] })).rejects.toThrow('no such document');
  });
});

describe('rename', () => {
  it('moves a document and its children directory, and re-keys the cache', async () => {
    const before = await vault.read(WOZ);
    const ex = await vault.read(EX1);
    const to = await vault.rename(WOZ, 'wozniak 1990 (rev)');
    expect(to).toBe('papers/wozniak 1990 (rev).md');
    expect(await exists(WOZ)).toBe(false);
    expect(await exists('papers/wozniak-1990')).toBe(false);
    expect(await exists(to)).toBe(true);
    expect(await exists('papers/wozniak 1990 (rev)/woz-ex1.md')).toBe(true);
    expect(await readDisk(to)).toBe(before.text);

    const node = find(vault.tree, to);
    expect(node?.kind === 'doc' && node.children?.map((c) => c.path)).toEqual(['papers/wozniak 1990 (rev)/woz-ex1.md']);
    expect(find(vault.tree, WOZ)).toBeUndefined();

    const after = await vault.read(to);
    expect(after.doc).toBe(before.doc);
    expect(after.path).toBe(to);
    expect((await vault.read('papers/wozniak 1990 (rev)/woz-ex1.md')).doc).toBe(ex.doc);
    expect(events).toContainEqual({ kind: 'moved', from: WOZ, to });
    expect(treeEvents()).toBe(1);
  });

  it('renaming an extract points its parent backrefs at the new name, one line each', async () => {
    const before = await readDisk(WOZ);
    expect(before).toContain('<!-- extract woz-ex1 -->');
    const to = await vault.rename(EX1, 'woz-first');
    expect(to).toBe('papers/wozniak-1990/woz-first.md');
    const after = await readDisk(WOZ);
    const la = before.split('\n');
    const lb = after.split('\n');
    expect(lb.length).toBe(la.length);
    const changed = la.flatMap((line, i) => (line === lb[i] ? [] : [i + 1]));
    expect(changed.length).toBe(1);
    expect(lb[changed[0]! - 1]).toBe('<!-- extract woz-first -->');
    expect(after).not.toContain('woz-ex1');
  });

  it('renames a folder and everything under it follows', async () => {
    const woz = await vault.read(WOZ);
    expect(await vault.rename('papers', 'articles')).toBe('articles');
    expect(await isDir('articles/archive')).toBe(true);
    expect(await exists('papers')).toBe(false);
    expect(documents(vault.tree)).toContain('articles/archive/sutton-2019.md');
    expect(documents(vault.tree)).toContain('articles/wozniak-1990/woz-ex1.md');
    expect((await vault.read('articles/wozniak-1990.md')).doc).toBe(woz.doc);
    expect(events).toContainEqual({ kind: 'moved', from: 'papers', to: 'articles' });
  });

  it('is a no-op for the same name, and refuses a taken or bad name', async () => {
    expect(await vault.rename(WOZ, 'wozniak-1990')).toBe(WOZ);
    expect(treeEvents()).toBe(0);
    await expect(vault.rename('papers/crick-1995.md', 'wozniak-1990')).rejects.toThrow('already exists');
    await expect(vault.rename('papers/crick-1995.md', 'archive')).rejects.toThrow('already exists');
    await expect(vault.rename('papers/archive', 'crick-1995')).rejects.toThrow('already exists');
    await expect(vault.rename(WOZ, '')).rejects.toThrow('not a name');
    await expect(vault.rename(WOZ, 'a/b')).rejects.toThrow('not a name');
    expect(await exists('papers/crick-1995.md')).toBe(true);
    expect(await exists('papers/archive')).toBe(true);
  });
});

describe('move', () => {
  it('moves a document with its children into a folder', async () => {
    const to = await vault.move(WOZ, 'books');
    expect(to).toBe('books/wozniak-1990.md');
    expect(await exists('books/wozniak-1990/woz-ex1.md')).toBe(true);
    expect(await exists('papers/wozniak-1990')).toBe(false);
    expect(documents(vault.tree)).toContain('books/wozniak-1990/woz-ex1.md');
    expect(events).toContainEqual({ kind: 'moved', from: WOZ, to });
  });

  it('moves a folder to the root and a document into a document', async () => {
    expect(await vault.move('papers/archive', '')).toBe('archive');
    expect(await isDir('archive')).toBe(true);
    expect(documents(vault.tree)).toContain('archive/sutton-2019.md');

    expect(await vault.move('german.md', 'papers/crick-1995')).toBe('papers/crick-1995/german.md');
    const crick = find(vault.tree, 'papers/crick-1995.md');
    expect(crick?.kind === 'doc' && crick.children?.map((c) => c.path)).toEqual(['papers/crick-1995/german.md']);
  });

  it('refuses its own subtree, a taken name, and a missing target; same place is a no-op', async () => {
    await expect(vault.move('papers', 'papers/archive')).rejects.toThrow('into itself');
    await expect(vault.move('papers', 'papers')).rejects.toThrow('into itself');
    await expect(vault.move(WOZ, 'papers/wozniak-1990')).rejects.toThrow('into itself');
    await expect(vault.move('papers', 'nowhere')).rejects.toThrow('no such folder');
    await fsp.writeFile(join(root, 'books/crick-1995.md'), 'x\n');
    await expect(vault.move('papers/crick-1995.md', 'books')).rejects.toThrow('already exists');
    expect(await vault.move(WOZ, 'papers')).toBe(WOZ);
    expect(treeEvents()).toBe(0);
  });
});

describe('remove', () => {
  it('deletes a document with its children directory and forgets them', async () => {
    await vault.read(WOZ);
    await vault.read(EX1);
    await vault.remove(WOZ);
    expect(await exists(WOZ)).toBe(false);
    expect(await exists('papers/wozniak-1990')).toBe(false);
    expect(documents(vault.tree)).not.toContain(WOZ);
    expect(events.filter((e) => e.kind === 'gone').map((e) => e.kind === 'gone' && e.path).sort()).toEqual([WOZ, EX1]);
    expect(treeEvents()).toBe(1);
  });

  it('deletes a folder', async () => {
    await vault.remove('papers');
    expect(await exists('papers')).toBe(false);
    expect(vault.tree.map((n) => n.name)).toEqual(['books', 'courses', 'essays', 'fleeting', 'german']);
  });
});

describe('watch', () => {
  it('does not report its own rename twice', async () => {
    await vault.watch();
    await vault.rename(WOZ, 'woz');
    await new Promise((r) => setTimeout(r, 250));
    await vault.changed([]);
    expect(treeEvents()).toBe(1);
  });
});

describe('state', () => {
  it('keeps the sidebar next to the open folders', async () => {
    await vault.saveState({ folders: ['papers'] });
    await vault.saveState({ sidebar: { width: 260, hidden: false } });
    expect(await vault.loadState()).toEqual({ folders: ['papers'], sidebar: { width: 260, hidden: false } });
  });
});

describe('import', () => {
  const SAMPLE = `Spaced repetition and the economics of attention

Every review you schedule is a small wager against forgetting. The wager has a cost — the minutes spent — and a payoff that compounds.

## A heading in the text

A good system spends your attention the way a careful gardener spends water: not evenly, but where the curve is about to cross the floor.`;

  it('lands a frozen, unread source named after its title', async () => {
    const path = await vault.importDoc('papers', { title: 'Spaced repetition and the economics of attention', text: SAMPLE, today: '2026-09-22' });
    expect(path).toBe('papers/Spaced repetition and the economics of attention.md');
    const text = await readDisk(path);
    expect(text.split('\n').slice(0, 5)).toEqual(['---', 'type: source', 'frozen: true', 'imported: 2026-09-22', '---']);
    const { doc, diagnostics } = parse(text);
    expect(diagnostics).toEqual([]);
    const m = meta(doc);
    expect(m.type).toBe('source');
    expect(m.frozen).toBe(true);
    expect(m.title).toBeUndefined();
    expect(m.read).toBeUndefined();
    expect(m.write).toBeUndefined();
    expect(doc.blocks.map((b) => b.kind)).toEqual(['paragraph', 'paragraph', 'heading', 'paragraph']);
    expect(find(vault.tree, path)?.kind).toBe('doc');
    expect(events.filter((e) => e.kind === 'tree')).toHaveLength(1);
  });

  it('writes the title as a field when the file name cannot carry it, and numbers a taken name', async () => {
    const a = await vault.importDoc('', { title: 'Notes: part 1 / 2', text: 'body', today: '2026-09-22' });
    expect(a).toBe('Notes part 1 2.md');
    expect(meta(parse(await readDisk(a)).doc).title).toBe('Notes: part 1 / 2');
    const b = await vault.importDoc('', { title: 'Notes part 1 2', text: 'body', today: '2026-09-22' });
    expect(b).toBe('Notes part 1 2 2.md');
    expect(meta(parse(await readDisk(b)).doc).title).toBe('Notes part 1 2');
    const c = await vault.importDoc('', { title: '   ', text: 'body' });
    expect(c).toBe('untitled.md');
  });

  it('keeps front-matter the text brought along, but not an enrolment', async () => {
    const text = '---\ntags: [x]\nread: due=2026-01-01 ivl=3\ntitle: Old title\n---\n\nbody\n';
    const path = await vault.importDoc('books', { title: 'Old title', text, today: '2026-09-22' });
    const disk = await readDisk(path);
    expect(disk).toBe('---\ntags: [x]\ntitle: Old title\ntype: source\nfrozen: true\nimported: 2026-09-22\n---\n\nbody\n');
    expect(meta(parse(disk).doc).read).toBeUndefined();
  });

  it('refuses empty text and a missing folder', async () => {
    await expect(vault.importDoc('papers', { title: 'x', text: '  \n ' })).rejects.toThrow('nothing to import');
    await expect(vault.importDoc('nowhere', { title: 'x', text: 'body' })).rejects.toThrow('no such folder');
  });
});

describe('pages', () => {
  const PAIR = 'papers/two-pages.md';
  const PDF = 'papers/two-pages.pdf';
  const bytes = () => fsp.readFile(join(root, PDF));

  it('finds a document\'s pages by stem, by its field, and not at all', async () => {
    expect(await vault.pagesOf(PAIR)).toBe(PDF);
    expect(await vault.pagesOf(WOZ)).toBeNull();
    expect(await vault.pagesOf('papers')).toBeNull();
    // the field wins when it names a file that exists; a missing one falls back to the stem
    await fsp.copyFile(join(root, PDF), join(root, 'papers/other.pdf'));
    await vault.update(PAIR, (d) => setField(d, 'pdf', 'other.pdf'));
    expect(await vault.pagesOf(PAIR)).toBe('papers/other.pdf');
    await vault.update(PAIR, (d) => setField(d, 'pdf', 'nowhere.pdf'));
    expect(await vault.pagesOf(PAIR)).toBe(PDF);
    await vault.update(PAIR, (d) => setField(d, 'pdf', '../../etc/passwd'));
    expect(await vault.pagesOf(PAIR)).toBe(PDF);
    // a field on a document with nothing beside it, naming a file that is there
    await vault.update(WOZ, (d) => setField(d, 'pdf', 'other.pdf'));
    expect(await vault.pagesOf(WOZ)).toBe('papers/other.pdf');
  });

  it('a new document never adopts a stray PDF', async () => {
    await fsp.copyFile(join(root, PDF), join(root, 'papers/stray.pdf'));
    expect(await vault.createDoc('papers', 'source', 'stray')).toBe('papers/stray 2.md');
  });

  it('carves an extract from a page: page on the child, the passage and its backref under the page heading in the parent', async () => {
    const before = (await vault.read(PAIR)).text;
    const child = await vault.extract(PAIR, { text: 'Nothing is ever written into this file.', blocks: [], page: 2, today: '2026-05-27' });
    expect(child).toBe('papers/two-pages/nothing is ever written into.md');
    expect(await readDisk(child)).toBe('---\ntype: extract\nimported: 2026-05-27\npri: 50\nread: due=2026-05-27 ivl=2 reps=0 pos=0 page=2\n---\n\nNothing is ever written into this file.\n');
    const after = (await vault.read(PAIR)).text;
    // the parent's `## p. 2` section grew by the paragraph and its backref; the marker stayed
    expect(after.split('\n').length).toBe(before.split('\n').length + 3);
    expect(after).toContain('with each pass ^ctp-spaced\n<!-- sr c1');
    expect(after).toContain('g=4 -->\n\nNothing is ever written into this file.\n<!-- extract nothing is ever written into -->\n');
    expect(meta((await vault.read(PAIR)).doc).read?.pos).toBe(1);
    // a page with no heading yet gets one, in page order
    await vault.extract(PAIR, { text: 'a passage from page four', blocks: [], page: 4, today: '2026-05-27' });
    await vault.extract(PAIR, { text: 'a passage from page three', blocks: [], page: 3, today: '2026-05-27' });
    const headings = (await vault.read(PAIR)).doc.blocks.filter((b) => b.kind === 'heading').map((b) => b.text);
    expect(headings).toEqual(['p. 1', 'p. 2', 'p. 3', 'p. 4']);
    expect((await vault.read(PAIR)).diagnostics).toEqual([]);
  });

  it('imports a PDF as the pair: the file copied, the document naming it, the text under a heading', async () => {
    const data = new Uint8Array(await bytes());
    const path = await vault.importPdf('books', { title: 'A dropped paper', bytes: data, text: 'Two pages\n\nThe first line.\n\nThe second.', today: '2026-09-22' });
    expect(path).toBe('books/A dropped paper.md');
    expect(await readDisk(path)).toBe('---\ntype: source\nfrozen: true\nimported: 2026-09-22\npdf: A dropped paper.pdf\n---\n\n## text\n\nTwo pages\n\nThe first line.\n\nThe second.\n');
    expect(Buffer.from(await fsp.readFile(join(root, 'books/A dropped paper.pdf'))).equals(Buffer.from(data))).toBe(true);
    expect(await vault.pagesOf(path)).toBe('books/A dropped paper.pdf');
    expect(find(vault.tree, path)).toMatchObject({ kind: 'doc', pdf: 'books/A dropped paper.pdf' });
    // no text: no body; a taken name is numbered for both files; nothing to copy is refused
    const scan = await vault.importPdf('books', { title: 'A dropped paper', bytes: data, text: '  ', today: '2026-09-22' });
    expect(scan).toBe('books/A dropped paper 2.md');
    expect(await readDisk(scan)).toBe('---\ntype: source\nfrozen: true\nimported: 2026-09-22\npdf: A dropped paper 2.pdf\ntitle: A dropped paper\n---\n');
    expect(await exists('books/A dropped paper 2.pdf')).toBe(true);
    await expect(vault.importPdf('books', { title: 'x', bytes: new Uint8Array(), text: '' })).rejects.toThrow('nothing to import');
  });

  it('renames and removes the pages with the document', async () => {
    const to = await vault.rename(PAIR, 'two pages (rev)');
    expect(to).toBe('papers/two pages (rev).md');
    expect(await exists(PDF)).toBe(false);
    expect(await exists('papers/two pages (rev).pdf')).toBe(true);
    expect(await exists('papers/two pages (rev)/the ruler in the margin.md')).toBe(true);
    // the field named the old stem, so it follows; one line changed
    expect(meta((await vault.read(to)).doc).pdf).toBe('two pages (rev).pdf');
    expect(await vault.pagesOf(to)).toBe('papers/two pages (rev).pdf');
    const moved = await vault.move(to, 'books');
    expect(await exists('books/two pages (rev).pdf')).toBe(true);
    expect(await vault.pagesOf(moved)).toBe('books/two pages (rev).pdf');
    await vault.remove(moved);
    expect(await exists('books/two pages (rev).pdf')).toBe(false);
    expect(await exists('books/two pages (rev)')).toBe(false);
  });

  it('a PDF arriving beside a document attaches it on the next walk', async () => {
    expect(find(vault.tree, 'papers/crick-1995.md')).not.toHaveProperty('pdf');
    await fsp.copyFile(join(root, PDF), join(root, 'papers/crick-1995.pdf'));
    await vault.changed(['papers/crick-1995.pdf']);
    expect(find(vault.tree, 'papers/crick-1995.md')).toMatchObject({ pdf: 'papers/crick-1995.pdf' });
    expect(await vault.pagesOf('papers/crick-1995.md')).toBe('papers/crick-1995.pdf');
  });
});

describe('page sections', () => {
  it('knows which page a block sits under, and where a block lands on a page', () => {
    const { doc } = parse('intro\n\n## p. 2\n\ntwo\n\n### sub\n\ndeeper\n\n## notes\n\nloose\n\n## p. 5\n\nfive\n');
    expect(doc.blocks.map((_, i) => pageOfBlock(doc, i))).toEqual([null, 2, 2, 2, 2, null, null, 5, 5]);
    expect(pageOf(doc.blocks[1])).toBe(2);
    expect(pageOf(doc.blocks[5])).toBeNull();
    expect(pageOf({ kind: 'heading', level: 1, text: 'p. 2' })).toBeNull();
    expect(pageSection(doc, 2)).toEqual([1, 5]);
    expect(pageSection(doc, 5)).toEqual([7, 9]);
    expect(pageSection(doc, 3)).toBeNull();
    // onto an existing page: at the end of its section; onto a new one: a heading in page order, else at the end
    expect(addToPage(doc, 2, { kind: 'paragraph', text: 'more two' })).toBe(5);
    expect(addToPage(doc, 3, { kind: 'paragraph', text: 'three' })).toBe(9);
    expect(addToPage(doc, 9, { kind: 'paragraph', text: 'nine' })).toBe(13);
    expect(doc.blocks.map((b) => (b.kind === 'heading' ? `#${b.text}` : b.text))).toEqual([
      'intro', '#p. 2', 'two', '#sub', 'deeper', 'more two', '#notes', 'loose', '#p. 3', 'three', '#p. 5', 'five', '#p. 9', 'nine',
    ]);
  });
});
