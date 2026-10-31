// A PDF book as a notebook (milestone 46): the pair with `tabs: true` and a
// chapter per tab, each `pdf: ../book.pdf` with its `pages`; the chapters'
// pages found through the path; a rename of the book and a move of a
// chapter keep the path resolving; a chapter's removal leaves the book's
// file. Over a temporary copy of the corpus vault.

import { promises as fsp } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { meta } from '../../format/index.js';
import { makeBookPdf } from '../../pdf/fixture.js';
import { nodeFs } from '../node-fs.js';
import { Vault, normRel, relFrom, type TreeNode } from '../index.js';

const CORPUS = new URL('../../format/__tests__/corpus/vault/', import.meta.url).pathname;

let root: string;
let vault: Vault;

beforeEach(async () => {
  root = await fsp.mkdtemp(join(tmpdir(), 'ilmi-book-'));
  await fsp.cp(CORPUS, root, { recursive: true });
  vault = await Vault.open(nodeFs, root);
});
afterEach(async () => {
  vault.close();
  await fsp.rm(root, { recursive: true, force: true });
});

const exists = async (rel: string) => !!(await nodeFs.stat(join(root, rel)));
const readDisk = (rel: string) => fsp.readFile(join(root, rel), 'utf8');
const kids = (nodes: TreeNode[], path: string): string[] => {
  for (const n of nodes) {
    if (n.path === path) return (n.kind === 'folder' ? n.children : n.children ?? []).map((c) => c.path);
    const hit = kids(n.kind === 'folder' ? n.children : n.children ?? [], path);
    if (hit.length) return hit;
  }
  return [];
};

const CHAPTERS = [
  { title: 'Ensembles', first: 1, last: 2, text: 'A system in contact with a reservoir.' },
  { title: 'The partition function', first: 3, last: 5, text: 'Z sums the Boltzmann factors.' },
];

describe('paths', () => {
  it('resolves `..` inside the vault and writes one path relative to another', () => {
    expect(normRel('books/stat/../stat.pdf')).toBe('books/stat.pdf');
    expect(normRel('a/./b//c')).toBe('a/b/c');
    expect(normRel('../x')).toBeNull();
    expect(relFrom('books/stat', 'books/stat.pdf')).toBe('../stat.pdf');
    expect(relFrom('papers', 'books/stat.pdf')).toBe('../books/stat.pdf');
    expect(relFrom('', 'books/stat.pdf')).toBe('books/stat.pdf');
    expect(relFrom('books', 'books/stat.pdf')).toBe('stat.pdf');
  });
});

describe('a PDF book as a notebook', () => {
  const land = () => vault.importPdfBook('books', { title: 'Statistical physics', bytes: makeBookPdf([]), text: 'all of it', today: '2026-10-30', chapters: CHAPTERS });

  it('lands the book with tabs and the chapters as its children, each its pages of the one file', async () => {
    const { book, paths } = await land();
    expect(book).toBe('books/Statistical physics.md');
    expect(paths).toEqual(['books/Statistical physics/01 Ensembles.md', 'books/Statistical physics/02 The partition function.md']);
    expect(await readDisk(book)).toBe('---\ntype: source\nfrozen: true\nimported: 2026-10-30\npdf: Statistical physics.pdf\ntabs: true\n---\n\n1. Ensembles\n2. The partition function\n');
    expect(await readDisk(paths[1]!)).toBe('---\ntype: source\nfrozen: true\nimported: 2026-10-30\ntitle: The partition function\npdf: ../Statistical physics.pdf\npages: 3-5\n---\n\n## text\n\nZ sums the Boltzmann factors.\n');
    expect(await exists('books/Statistical physics.pdf')).toBe(true);
    // one PDF, every chapter's pages are it
    expect(await vault.pagesOf(book)).toBe('books/Statistical physics.pdf');
    expect(await vault.pagesOf(paths[0]!)).toBe('books/Statistical physics.pdf');
    expect(kids(vault.tree, book)).toEqual(paths);
    expect((await vault.read(paths[0]!)).diagnostics).toEqual([]);
  });

  it('a rename of the book: its file and the chapters\' paths follow', async () => {
    const { book } = await land();
    const to = await vault.rename(book, 'stat phys');
    expect(await exists('books/stat phys.pdf')).toBe(true);
    const ch = 'books/stat phys/02 The partition function.md';
    expect(meta((await vault.read(ch)).doc).pdf).toBe('../stat phys.pdf');
    expect(meta((await vault.read(ch)).doc).pages).toEqual({ first: 3, last: 5 });
    expect(await vault.pagesOf(ch)).toBe('books/stat phys.pdf');
    expect(meta((await vault.read(to)).doc).pdf).toBe('stat phys.pdf');
  });

  it('a chapter moved out keeps naming the book\'s file; removed, it leaves the file', async () => {
    const { paths } = await land();
    const moved = await vault.move(paths[0]!, 'papers');
    expect(meta((await vault.read(moved)).doc).pdf).toBe('../books/Statistical physics.pdf');
    expect(await vault.pagesOf(moved)).toBe('books/Statistical physics.pdf');
    await vault.remove(moved);
    await vault.remove(paths[1]!);
    expect(await exists('books/Statistical physics.pdf')).toBe(true);
  });

  it('the whole book moved: the paths inside it still hold', async () => {
    const { book, paths } = await land();
    const to = await vault.move(book, 'papers');
    const ch = paths[1]!.replace('books/', 'papers/');
    expect(meta((await vault.read(ch)).doc).pdf).toBe('../Statistical physics.pdf');
    expect(await vault.pagesOf(ch)).toBe('papers/Statistical physics.pdf');
    expect(await vault.pagesOf(to)).toBe('papers/Statistical physics.pdf');
  });
});
