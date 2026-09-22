import { promises as fsp } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { meta, parse, setField } from '../../format/index.js';
import { nodeFs } from '../node-fs.js';
import { Vault, documents, extractName, type TreeNode, type VaultEvent } from '../index.js';
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

  it('writes a source with no front-matter, and a deck with its type', async () => {
    const src = await vault.createDoc('papers', 'source');
    expect(src).toBe('papers/untitled.md');
    const text = await readDisk(src);
    expect(text).toBe('');
    const parsed = parse(text);
    expect(parsed.diagnostics).toEqual([]);
    expect(meta(parsed.doc).type).toBe('source');

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

describe('extract', () => {
  it('names the child from the passage', () => {
    expect(extractName('Atomicity sounds easy — and is, in fact, the hardest discipline.')).toBe('Atomicity sounds easy and is');
    expect(extractName('one two')).toBe('one two');
    expect(extractName('… — !')).toBe('untitled extract');
    expect(extractName("it's a name/with: slashes")).toBe("it's a name with slashes");
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
    expect(meta(ex.doc)).toMatchObject({ type: 'extract', imported: '2026-05-27', read: { due: '2026-05-27', ivl: 1, reps: 0, pos: 0, pri: 3 } });
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
    expect(rest.filter((l, i) => l !== la[i])).toEqual(['read: due=2026-06-01 ivl=9 reps=4 pos=6 pri=3']);
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
    expect(meta((await vault.read(james)).doc).read).toEqual({ due: '2026-05-27', ivl: 1, reps: 0, pos: 0 });
    expect(meta((await vault.read('books/james-pluralistic-ch4.md')).doc).read).toBeUndefined();
  });

  it('extracts from an extract, and refuses nothing or a missing parent', async () => {
    const grandchild = await vault.extract(EX1, { text: 'Every bundle is a future failure', blocks: [0], today: '2026-05-27' });
    expect(grandchild).toBe('papers/wozniak-1990/woz-ex1/Every bundle is a future.md');
    expect(await isDir('papers/wozniak-1990/woz-ex1')).toBe(true);
    expect((await vault.read(EX1)).doc.blocks[0]).toMatchObject({ extracts: ['Every bundle is a future'] });
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
    expect(vault.tree.map((n) => n.name)).toEqual(['books', 'essays', 'fleeting', 'german']);
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
    expect(text.split('\n').slice(0, 4)).toEqual(['---', 'frozen: true', 'imported: 2026-09-22', '---']);
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
    expect(disk).toBe('---\ntags: [x]\ntitle: Old title\nfrozen: true\nimported: 2026-09-22\n---\n\nbody\n');
    expect(meta(parse(disk).doc).read).toBeUndefined();
  });

  it('refuses empty text and a missing folder', async () => {
    await expect(vault.importDoc('papers', { title: 'x', text: '  \n ' })).rejects.toThrow('nothing to import');
    await expect(vault.importDoc('nowhere', { title: 'x', text: 'body' })).rejects.toThrow('no such folder');
  });
});
