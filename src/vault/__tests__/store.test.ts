// The store under a vault (milestone 59): a collection's rows as an `Fs`,
// and a vault in and out of it as files. The corpus and the sample come
// back byte for byte; a document is one row whatever its path; nothing
// that is text is kept as a file. Over `mem-store.ts`, which keeps the
// rules of the Rust side's SQLite (`src-tauri/src/store.rs` has its own
// tests).

import { promises as fsp } from 'node:fs';
import { tmpdir } from 'node:os';
import { join as joinPath, relative as relPath } from 'node:path';
import { fileURLToPath } from 'node:url';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { parse } from '../../format/index.js';
import { Vault, exportFolder, importFolder, mirrorFolder, splitFront, storeFs, takeFiles, type Row, type StoreFs } from '../index.js';
import { memStore, type MemStore } from '../mem-store.js';
import { nodeFs } from '../node-fs.js';

const CORPUS = fileURLToPath(new URL('../../format/__tests__/corpus/vault', import.meta.url));
const SAMPLE = fileURLToPath(new URL('../../../samples/double-major', import.meta.url));
const ROOT = '/collections/test';

const scratch: string[] = [];
const tmp = async (tag: string): Promise<string> => {
  const dir = await fsp.mkdtemp(joinPath(tmpdir(), `ilmi-store-${tag}-`));
  scratch.push(dir);
  return dir;
};
afterEach(async () => {
  for (const dir of scratch.splice(0)) await fsp.rm(dir, { recursive: true, force: true });
});

/** Every file under `dir`, by its path from it, and every directory with a `/`. */
async function filesOf(dir: string): Promise<Map<string, Buffer | null>> {
  const out = new Map<string, Buffer | null>();
  const visit = async (at: string) => {
    for (const e of await fsp.readdir(at, { withFileTypes: true })) {
      const p = joinPath(at, e.name);
      if (e.name === '.DS_Store') continue;
      if (e.isDirectory()) {
        out.set(`${relPath(dir, p)}/`, null);
        await visit(p);
      } else out.set(relPath(dir, p), await fsp.readFile(p));
    }
  };
  await visit(dir);
  return out;
}

async function collection(from: string): Promise<{ store: MemStore; fs: StoreFs; files: number }> {
  const store = memStore();
  const fs = storeFs(store, ROOT);
  const files = await importFolder(nodeFs, from, fs, ROOT);
  return { store, fs, files };
}

const rowsByPath = async (store: MemStore): Promise<Map<string, Row>> => {
  const rows = await store.rows();
  const byId = new Map(rows.map((r) => [r.id, r]));
  const pathOf = (r: Row): string => {
    const name = r.kind === 'doc' ? `${r.name}.md` : r.name;
    const parent = r.parent === null ? null : byId.get(r.parent)!;
    // a document's children sit in the directory of its name
    return parent ? `${pathOf(parent).replace(/\.md$/, '')}/${name}` : name;
  };
  return new Map(rows.map((r) => [pathOf(r), r]));
};

describe('a document in two', () => {
  it('splits where the parser ends the front matter, and loses nothing', async () => {
    for (const dir of [CORPUS, SAMPLE]) {
      for (const [path, bytes] of await filesOf(dir)) {
        if (!path.endsWith('.md') || !bytes) continue;
        const whole = bytes.toString('utf8');
        const { front, text } = splitFront(whole);
        expect(front + text, path).toBe(whole);
        expect(parse(front).doc.frontmatter, path).toEqual(parse(whole).doc.frontmatter);
        if (front) expect(parse(text).doc.frontmatter, path).toBeUndefined();
      }
    }
  });

  it('keeps line endings, a BOM, and a `...` end as they are; an unclosed block is text', () => {
    expect(splitFront('---\ntype: deck\n---\nbody\n')).toEqual({ front: '---\ntype: deck\n---\n', text: 'body\n' });
    expect(splitFront('---\r\ntype: deck\r\n...\r\nbody\r\n')).toEqual({ front: '---\r\ntype: deck\r\n...\r\n', text: 'body\r\n' });
    expect(splitFront('﻿--- \ntitle: x\n---')).toEqual({ front: '﻿--- \ntitle: x\n---', text: '' });
    expect(splitFront('---\ntitle: x\nno end\n')).toEqual({ front: '', text: '---\ntitle: x\nno end\n' });
    expect(splitFront('prose\n---\nmore\n---\n')).toEqual({ front: '', text: 'prose\n---\nmore\n---\n' });
    expect(splitFront('')).toEqual({ front: '', text: '' });
  });
});

describe('in and out as files', () => {
  for (const [name, dir] of [['the corpus', CORPUS], ['the sample', SAMPLE]] as const) {
    it(`${name}, imported and exported, comes back byte for byte`, async () => {
      const { store, files } = await collection(dir);
      const before = await filesOf(dir);
      expect(files).toBe([...before.values()].filter((b) => b !== null).length);
      // exported from the rows as a collection opened afresh reads them
      const out = joinPath(await tmp('out'), 'export');
      expect(await exportFolder(storeFs(store, ROOT), ROOT, nodeFs, out)).toBe(files);
      const after = await filesOf(out);
      expect([...after.keys()].sort()).toEqual([...before.keys()].sort());
      for (const [path, bytes] of before) {
        if (bytes) expect(after.get(path)!.equals(bytes), path).toBe(true);
      }
    });
  }

  it('a document is a row by its name under its parent; text is in the rows and files are blobs', async () => {
    const { store } = await collection(CORPUS);
    const rows = await rowsByPath(store);
    const papers = rows.get('papers')!;
    const woz = rows.get('papers/wozniak-1990.md')!;
    expect(papers).toMatchObject({ kind: 'folder', parent: null, name: 'papers' });
    expect(woz).toMatchObject({ kind: 'doc', parent: papers.id, name: 'wozniak-1990', blob: null });
    // an extract is under its document, not under a folder of its name
    expect(rows.get('papers/wozniak-1990/woz-ex1.md')).toMatchObject({ kind: 'doc', parent: woz.id });
    expect([...rows.values()].filter((r) => r.kind === 'folder' && r.name === 'wozniak-1990')).toEqual([]);
    // every document's text is in its row; a PDF and an image are blobs; what is under `.ilmi/` is text in a row
    for (const [path, r] of rows) {
      if (r.kind === 'folder') continue;
      if (path.endsWith('.md') || path.startsWith('.ilmi/')) expect(r.blob, path).toBeNull();
      else expect(r.blob, path).toMatch(/^[0-9a-f]{64}$/);
    }
    expect(rows.get('papers/two-pages.pdf')).toMatchObject({ kind: 'file', parent: papers.id });
    expect(store.blobs.size).toBe([...rows.values()].filter((r) => r.blob !== null).length);
    expect(rows.get('.ilmi/plugins.json')).toMatchObject({ kind: 'file', blob: null });
    const whole = await fsp.readFile(joinPath(CORPUS, 'papers/wozniak-1990.md'), 'utf8');
    expect(await store.text(woz.id)).toBe(whole);
    expect(woz.size).toBe(Buffer.byteLength(whole));
  });

  it('skips a repository\'s folder, the Finder\'s file, and a half-written file', async () => {
    const dir = await tmp('skip');
    await fsp.mkdir(joinPath(dir, '.git/objects'), { recursive: true });
    await fsp.writeFile(joinPath(dir, '.git/HEAD'), 'ref: refs/heads/main\n');
    await fsp.writeFile(joinPath(dir, '.DS_Store'), 'x');
    await fsp.writeFile(joinPath(dir, 'a.md.ilmi-tmp'), 'half');
    await fsp.writeFile(joinPath(dir, 'a.md'), 'a\n');
    await fsp.writeFile(joinPath(dir, '.gitignore'), '.DS_Store\n');
    await fsp.mkdir(joinPath(dir, 'empty'));
    const { store, files } = await collection(dir);
    expect(files).toBe(2);
    expect([...(await rowsByPath(store)).keys()].sort()).toEqual(['.gitignore', 'a.md', 'empty']);
  });

  it('keeps bytes that are not text as they are, under a document\'s name too', async () => {
    const dir = await tmp('bytes');
    const latin = Buffer.from([0x63, 0x61, 0x66, 0xe9, 0x0a]);
    await fsp.writeFile(joinPath(dir, 'latin.md'), latin);
    await fsp.writeFile(joinPath(dir, 'bom.md'), Buffer.from('﻿---\ntitle: x\n---\nbody\r\n', 'utf8'));
    const { store, fs } = await collection(dir);
    const rows = await rowsByPath(store);
    expect(rows.get('latin.md')).toMatchObject({ kind: 'doc', size: 5 });
    expect(rows.get('latin.md')!.blob).not.toBeNull();
    expect(rows.get('bom.md')!.blob).toBeNull();
    expect(Buffer.from(await fs.readBytes(`${ROOT}/latin.md`)).equals(latin)).toBe(true);
    const out = joinPath(await tmp('bytes-out'), 'export');
    await exportFolder(fs, ROOT, nodeFs, out);
    expect((await fsp.readFile(joinPath(out, 'latin.md'))).equals(latin)).toBe(true);
    expect(await fsp.readFile(joinPath(out, 'bom.md'), 'utf8')).toBe('﻿---\ntitle: x\n---\nbody\r\n');
  });
});

describe('paths made from names and parents', () => {
  it('a rename is one row changing: the id, the text and the children stay', async () => {
    const { store, fs } = await collection(CORPUS);
    const vault = await Vault.open(fs, ROOT);
    const before = await rowsByPath(store);
    const woz = before.get('papers/wozniak-1990.md')!;
    const ex = before.get('papers/wozniak-1990/woz-ex1.md')!;
    const puts = store.calls.put;
    const to = await vault.rename('papers/wozniak-1990.md', 'woz');
    expect(to).toBe('papers/woz.md');
    expect(store.calls.put - puts).toBe(1);
    const after = await rowsByPath(store);
    expect(after.get('papers/woz.md')).toEqual({ ...woz, name: 'woz' });
    expect(after.get('papers/woz/woz-ex1.md')).toEqual(ex);
    expect(after.has('papers/wozniak-1990.md')).toBe(false);
    // a move is the same row under another parent
    const moved = await vault.move(to, 'books');
    expect(moved).toBe('books/woz.md');
    const books = (await rowsByPath(store)).get('books')!;
    expect((await rowsByPath(store)).get('books/woz.md')).toEqual({ ...woz, name: 'woz', parent: books.id });
    expect((await vault.read('books/woz/woz-ex1.md')).text).toBe(await fsp.readFile(joinPath(CORPUS, 'papers/wozniak-1990/woz-ex1.md'), 'utf8'));
  });

  it('a write keeps the row and moves its rev; reading goes to the store once', async () => {
    const { store, fs } = await collection(CORPUS);
    const vault = await Vault.open(fs, ROOT);
    const row = (await fs.rowAt(`${ROOT}/german.md`))!;
    const texts = store.calls.text;
    await vault.read('german.md');
    await vault.read('german.md');
    expect(store.calls.text - texts).toBe(1);
    const puts = store.calls.put;
    await vault.update('german.md', (doc) => { doc.blocks.push({ kind: 'paragraph', text: 'a line more' }); });
    // one write, in place: no temp file, no rename
    expect(store.calls.put - puts).toBe(1);
    const next = (await fs.rowAt(`${ROOT}/german.md`))!;
    expect(next.id).toBe(row.id);
    expect(next.rev).toBeGreaterThan(row.rev);
    expect(await store.text(row.id)).toContain('a line more');
  });

  it('a folder made before its document becomes the document; a document removed over children leaves a folder', async () => {
    const store = memStore();
    const fs = storeFs(store, ROOT);
    await fs.mkdir(`${ROOT}/notes/chapter`);
    await fs.writeText(`${ROOT}/notes/chapter/one.md`, 'one\n');
    await fs.writeText(`${ROOT}/notes/chapter.md`, '---\ntabs: true\n---\n');
    let rows = await rowsByPath(store);
    expect([...rows.keys()].sort()).toEqual(['notes', 'notes/chapter.md', 'notes/chapter/one.md']);
    const chapter = rows.get('notes/chapter.md')!;
    expect(rows.get('notes/chapter/one.md')!.parent).toBe(chapter.id);
    expect((await fs.readDir(`${ROOT}/notes`)).map((e) => `${e.name}${e.isDir ? '/' : ''}`).sort()).toEqual(['chapter.md', 'chapter/']);
    // the other order comes to the same
    await fs.writeText(`${ROOT}/notes/later.md`, 'later\n');
    await fs.mkdir(`${ROOT}/notes/later`);
    expect(await fs.stat(`${ROOT}/notes/later`)).toBeNull();
    await fs.writeText(`${ROOT}/notes/later/two.md`, 'two\n');
    expect((await fs.stat(`${ROOT}/notes/later`))?.isDir).toBe(true);
    // the document goes, its children stay as a folder under the same id
    await fs.remove(`${ROOT}/notes/chapter.md`);
    rows = await rowsByPath(store);
    expect(rows.get('notes/chapter')).toMatchObject({ id: chapter.id, kind: 'folder', size: 0 });
    expect(await fs.readText(`${ROOT}/notes/chapter/one.md`)).toBe('one\n');
    // and the children directory alone goes without the document
    await fs.remove(`${ROOT}/notes/later`);
    expect(await fs.readText(`${ROOT}/notes/later.md`)).toBe('later\n');
    expect(await fs.stat(`${ROOT}/notes/later`)).toBeNull();
  });

  it('a rename onto a file that is there replaces what it holds and keeps its id', async () => {
    const store = memStore();
    const fs = storeFs(store, ROOT);
    await fs.writeText(`${ROOT}/a.md`, 'old\n');
    const a = (await fs.rowAt(`${ROOT}/a.md`))!;
    await fs.writeText(`${ROOT}/a.md.ilmi-tmp`, '---\ntype: deck\n---\nnew\n');
    await fs.rename(`${ROOT}/a.md.ilmi-tmp`, `${ROOT}/a.md`);
    const rows = await rowsByPath(store);
    expect([...rows.keys()]).toEqual(['a.md']);
    expect(rows.get('a.md')!.id).toBe(a.id);
    expect(await fs.readText(`${ROOT}/a.md`)).toBe('---\ntype: deck\n---\nnew\n');
    expect(store.blobs.size).toBe(0);
    // a temp file renamed to a name that is free is the document
    await fs.writeText(`${ROOT}/b.md.ilmi-tmp`, 'b\n');
    await fs.rename(`${ROOT}/b.md.ilmi-tmp`, `${ROOT}/b.md`);
    expect((await fs.rowAt(`${ROOT}/b.md`))?.kind).toBe('doc');
    await expect(fs.rename(`${ROOT}/nothing.md`, `${ROOT}/c.md`)).rejects.toThrow('no such file');
    await expect(fs.writeText(`${ROOT}/no/such/dir.md`, 'x')).rejects.toThrow('no such directory');
  });

  it('refuses a folder moved into itself, and a file under a file', async () => {
    const { fs } = await collection(CORPUS);
    await expect(fs.rename(`${ROOT}/papers`, `${ROOT}/papers/archive/papers`)).rejects.toThrow('inside');
    await expect(fs.mkdir(`${ROOT}/papers/two-pages.pdf/x`)).rejects.toThrow('not a directory');
    await expect(fs.readDir(`${ROOT}/german.md`)).rejects.toThrow('no such directory');
    await expect(fs.readText(`${ROOT}/papers`)).rejects.toThrow('no such file');
    expect(await fs.stat('/elsewhere/german.md')).toBeNull();
  });

  it('reports its own writes to a watcher, a moment later, by path', async () => {
    const { fs } = await collection(CORPUS);
    const seen: string[][] = [];
    const stop = await fs.watch(ROOT, (paths) => seen.push(paths));
    await fs.writeText(`${ROOT}/new.md`, 'new\n');
    await fs.rename(`${ROOT}/new.md`, `${ROOT}/newer.md`);
    expect(seen).toEqual([]);
    await vi.waitFor(() => expect(seen.length).toBe(1));
    expect(seen[0]).toEqual([`${ROOT}/new.md`, `${ROOT}/newer.md`]);
    stop();
    await fs.remove(`${ROOT}/newer.md`);
    await new Promise((r) => setTimeout(r, 60));
    expect(seen.length).toBe(1);
  });
});

describe('a folder kept as the collection is', () => {
  it('writes what differs, removes what is gone, leaves `.git/`, and takes changed files back', async () => {
    const { fs } = await collection(CORPUS);
    const dir = joinPath(await tmp('mirror'), 'repo');
    await fsp.mkdir(joinPath(dir, '.git'), { recursive: true });
    await fsp.writeFile(joinPath(dir, '.git/HEAD'), 'ref: refs/heads/main\n');
    const first = await mirrorFolder(fs, ROOT, nodeFs, dir);
    const corpus = await filesOf(CORPUS);
    expect(first.sort()).toEqual([...corpus.keys()].filter((p) => !p.endsWith('/')).sort());
    // nothing changed: nothing written
    expect(await mirrorFolder(fs, ROOT, nodeFs, dir)).toEqual([]);
    // one document written, one removed, one stray file in the folder
    const vault = await Vault.open(fs, ROOT);
    await vault.update('german.md', (doc) => { doc.blocks.push({ kind: 'paragraph', text: 'a line more' }); });
    await vault.remove('papers/crick-1995.md');
    await fsp.writeFile(joinPath(dir, 'stray.md'), 'stray\n');
    expect((await mirrorFolder(fs, ROOT, nodeFs, dir)).sort()).toEqual(['german.md', 'papers/crick-1995.md', 'stray.md']);
    expect(await fsp.readFile(joinPath(dir, 'german.md'), 'utf8')).toContain('a line more');
    expect(await fsp.readFile(joinPath(dir, '.git/HEAD'), 'utf8')).toBe('ref: refs/heads/main\n');
    await expect(fsp.stat(joinPath(dir, 'stray.md'))).rejects.toThrow();
    // a pull changed two files and removed one
    await fsp.writeFile(joinPath(dir, 'german.md'), 'pulled\n');
    await fsp.mkdir(joinPath(dir, 'new/deep'), { recursive: true });
    await fsp.writeFile(joinPath(dir, 'new/deep/note.md'), 'note\n');
    await fsp.rm(joinPath(dir, 'essays/spaced-composition.md'));
    await takeFiles(nodeFs, dir, fs, ROOT, ['german.md', 'new/deep/note.md', 'essays/spaced-composition.md', '.git/HEAD']);
    await vault.changed(['german.md', 'new/deep/note.md', 'essays/spaced-composition.md']);
    expect((await vault.read('german.md')).text).toBe('pulled\n');
    expect(vault.documents()).toContain('new/deep/note.md');
    expect(vault.documents()).not.toContain('essays/spaced-composition.md');
    expect(await fs.stat(`${ROOT}/.git`)).toBeNull();
    expect(await mirrorFolder(fs, ROOT, nodeFs, dir)).toEqual([]);
  });
});
