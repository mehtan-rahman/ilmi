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
import { formatReview, parseReviews, setField, type Card, type Doc, type Review } from '../../format/index.js';
import { gradeItem, queueItems, type CardItem } from '../../schedule/index.js';
import { MIRROR_LIST, Vault, join, exportFolder, importFolder, mirrorDirIn, mirrorFolder, mirrorPass, splitFront, storeFs, takeFiles, type Row, type StoreFs } from '../index.js';
import { DIGEST_MARK } from '../lift.js';
import { memDrawing, memPicture, memSplit, memStore, type MemStore } from '../mem-store.js';
import { STORE_VERSION, isInk, type InkStroke } from '../store.js';
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
    // a document's row holds its text without its state (milestone 60); what is read is the file
    const whole = await fsp.readFile(joinPath(CORPUS, 'papers/wozniak-1990.md'), 'utf8');
    expect(whole).toContain('<!-- sr ');
    expect(await store.text(woz.id)).not.toContain('<!-- sr ');
    expect(await storeFs(store, ROOT).readText(`${ROOT}/papers/wozniak-1990.md`)).toBe(whole);
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
    const reads = store.calls.doc;
    await vault.read('german.md');
    await vault.read('german.md');
    expect(store.calls.doc - reads).toBe(1);
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

describe('state in rows', () => {
  const linesOf = (text: string, re: RegExp): string[] => text.split('\n').filter((l) => re.test(l));

  it('lifts every schedule out of the sample\'s text, and the text reads back whole', async () => {
    const { store, fs } = await collection(SAMPLE);
    const rows = await rowsByPath(store);
    let lifted = 0;
    for (const [path, r] of rows) {
      if (r.kind !== 'doc') continue;
      const file = await fsp.readFile(joinPath(SAMPLE, path), 'utf8');
      const held = store.tables.texts.get(r.id)!;
      const stored = held.front + held.text;
      // no card's line, no section's line, and nothing after `read:` or `write:` is left in the row's text
      expect(linesOf(stored, /^\s*<!-- (sr|read)\b/), path).toEqual([]);
      expect(linesOf(held.front, /^(read|write): ./), path).toEqual([]);
      const state = store.tables.state.get(r.id) ?? [];
      expect(state.length, path).toBe(linesOf(file, /^\s*<!-- (sr|read)\b/).length + linesOf(file, /^(read|write): ./).length);
      lifted += state.length;
      // the sample is as the app writes it: nothing needs keeping beside
      expect(store.tables.originals.has(r.id), path).toBe(false);
      expect(await fs.readText(`${ROOT}/${path}`), path).toBe(file);
    }
    expect(lifted).toBeGreaterThan(800);
    // a card's lines are keyed by its id and say when it is due
    const vocab = rows.get('arabic/vocabulary.md')!;
    const state = store.tables.state.get(vocab.id)!;
    const karam = state.filter((x) => x.item === 'voc-karam');
    expect(karam.map((x) => x.key)).toEqual(['']);
    expect(JSON.parse(karam[0]!.attrs)).toHaveProperty('due');
    // a cloze's groups are rows of their own under the card's id; a section's line is a row by its heading
    const all = [...store.tables.state.values()].flat();
    expect(all.some((x) => x.kind === 'card' && /^c\d+$/.test(x.key))).toBe(true);
    expect(all.filter((x) => x.kind === 'section').length).toBeGreaterThan(0);
  });

  it('a grade writes a schedule, the index and a line of the log in one transaction, and not the text', async () => {
    const { store, fs } = await collection(SAMPLE);
    const vault = await Vault.open(fs, ROOT);
    const path = 'arabic/vocabulary.md';
    const before = (await vault.read(path)).text;
    const now = new Date('2026-11-05T09:00:00Z');
    const item = queueItems([[path, (await vault.read(path)).doc]], now).find((i): i is CardItem => i.kind === 'card' && i.id === 'voc-karam' && i.dir !== 'r')!;
    const writes = store.tables.textWrites;
    const puts = store.calls.put;
    const logged = store.tables.reviews.length;
    const line: Review = { at: '2026-11-05T09:00:00Z', doc: path, card: 'voc-karam', g: 3, st: 'review', elapsed: 3, ivl: 3, next: 9 };
    fs.logWith(path, [line]);
    await vault.update(path, (doc) => { gradeItem(doc, item, 3, now); });
    await fs.flushLog(path);
    expect(store.calls.put - puts).toBe(1);
    expect(store.calls.reviewsPut).toBe(14);
    expect(store.tables.textWrites).toBe(writes);
    expect(store.tables.reviews.length).toBe(logged + 1);
    expect(store.tables.reviews.at(-1)).toMatchObject({ file: '2026-11.jsonl', card: 'voc-karam', line: formatReview(line) });
    // the file, read back, differs by the one line the grade rewrote
    const after = (await vault.read(path)).text;
    const a = before.split('\n');
    const b = after.split('\n');
    expect(b.length).toBe(a.length);
    const changed = a.flatMap((l, i) => (l === b[i] ? [] : [i]));
    expect(changed.length).toBe(1);
    expect(b[changed[0]!]).toMatch(/^<!-- sr due=\S+ st=review .* last=2026-11-05T09:00:00Z g=3 -->$/);
    // the index has the card as it is now, and the log reads back with the line at its end
    const digest = (await fs.digests()).get(path)!;
    const card = digest.blocks.find((x): x is Card => x.kind === 'card' && x.id === 'voc-karam')!;
    expect(card.sched?.last).toBe('2026-11-05T09:00:00Z');
    expect((await vault.loadReviews()).at(-1)).toEqual(line);
    expect(await fs.reviewCount()).toBe(logged + 1);
    expect((await fs.readDir(`${ROOT}/.ilmi/reviews`)).map((e) => e.name)).toContain('2026-11.jsonl');
  });

  it('the index holds a document\'s cards and headings whole and its prose as marks', async () => {
    const { fs } = await collection(SAMPLE);
    const digests = await fs.digests();
    const files = [...(await filesOf(SAMPLE)).keys()].filter((p) => p.endsWith('.md'));
    expect([...digests.keys()].sort()).toEqual(files.sort());
    const now = new Date('2026-11-05T09:00:00Z');
    for (const path of files) {
      const doc = parse(await fsp.readFile(joinPath(SAMPLE, path), 'utf8')).doc;
      const dig = digests.get(path)!;
      expect(dig.blocks.length, path).toBe(doc.blocks.length);
      dig.blocks.forEach((b, i) => {
        const real = doc.blocks[i]!;
        if (b.kind === 'card' || b.kind === 'heading') expect(b, path).toEqual(real);
        else expect(b.text === '' || b.text === DIGEST_MARK || real.text.startsWith(b.text), path).toBe(true);
      });
      // the queue reads the digest as it reads the document, down to a row's opening words
      const strip = (items: ReturnType<typeof queueItems>) => items.map((i) => ({ ...i, ...('next' in i && i.next ? { next: i.next.slice(0, 60) } : {}), ...('lead' in i && i.lead ? { lead: i.lead.slice(0, 60) } : {}) }));
      expect(strip(queueItems([[path, dig]], now)), path).toEqual(strip(queueItems([[path, doc]], now)));
    }
    // a write is told with the document's digest
    const seen: [string, Doc | null][] = [];
    const off = fs.onIndex((path, doc) => seen.push([path, doc]));
    await fs.writeText(`${ROOT}/fleeting/new.md`, 'q :: a\n\nprose that is not a card, and goes on past the point\n');
    off();
    await fs.writeText(`${ROOT}/fleeting/unseen.md`, 'x\n');
    expect(seen.map(([p]) => p)).toEqual(['fleeting/new.md']);
    expect(seen[0]![1]!.blocks.map((b) => b.kind)).toEqual(['card', 'paragraph']);
  });

  it('a file written by hand comes back as it was until its text or its state changes', async () => {
    const store = memStore();
    const fs = storeFs(store, ROOT);
    const hand = '---\r\nread:   due=2026-11-06  ivl=2\r\n---\r\n\r\nq :: a\r\n<!--   sr due=2026-11-07   st=review -->\r\n\r\n\r\nprose\r\n';
    await fs.writeText(`${ROOT}/hand.md`, hand);
    expect(await fs.readText(`${ROOT}/hand.md`)).toBe(hand);
    const row = (await fs.rowAt(`${ROOT}/hand.md`))!;
    expect(store.tables.originals.get(row.id)?.text).toBe(hand);
    expect(store.tables.state.get(row.id)!.length).toBe(2);
    // a second store over the same rows reads the same bytes
    expect(await storeFs(store, ROOT).readText(`${ROOT}/hand.md`)).toBe(hand);
    const vault = await Vault.open(fs, ROOT);
    await vault.update('hand.md', (doc) => setField(doc, 'read', { due: '2026-11-09', ivl: 3 }));
    // the app's first write is the one that normalizes it, as before
    expect(await fs.readText(`${ROOT}/hand.md`)).toBe('---\nread: due=2026-11-09 ivl=3\n---\n\nq :: a\n<!-- sr due=2026-11-07 st=review -->\n\nprose\n');
    expect(store.tables.originals.has(row.id)).toBe(false);
  });

  it('a card without an id is keyed by its place, and what cannot be lifted is kept whole', async () => {
    const store = memStore();
    const fs = storeFs(store, ROOT);
    const text = 'first :: card\n\nsecond :: card\n<!-- sr due=2026-11-07 -->\n';
    await fs.writeText(`${ROOT}/a.md`, text);
    const a = (await fs.rowAt(`${ROOT}/a.md`))!;
    expect(store.tables.state.get(a.id)).toEqual([{ kind: 'card', item: '#1', key: '', attrs: '{"due":"2026-11-07"}' }]);
    expect(await fs.readText(`${ROOT}/a.md`)).toBe(text);
    // two cards under one id: their lines have one key between them, so the text is kept as it is
    const twins = 'one :: a ^same\n<!-- sr due=2026-11-07 -->\n\ntwo :: b ^same\n<!-- sr due=2026-11-09 -->\n';
    await fs.writeText(`${ROOT}/b.md`, twins);
    const b = (await fs.rowAt(`${ROOT}/b.md`))!;
    expect(store.tables.state.has(b.id)).toBe(false);
    expect(await store.text(b.id)).toBe(twins);
    expect(await fs.readText(`${ROOT}/b.md`)).toBe(twins);
  });

  it('the order of a directory is the rows\' places, read and written as `.ilmi/order.json`', async () => {
    const { store, fs } = await collection(SAMPLE);
    const file = await fsp.readFile(joinPath(SAMPLE, '.ilmi/order.json'), 'utf8');
    // no row holds the file
    expect((await rowsByPath(store)).has('.ilmi/order.json')).toBe(false);
    expect((await fs.readDir(`${ROOT}/.ilmi`)).map((e) => e.name)).toContain('order.json');
    const vault = await Vault.open(fs, ROOT);
    expect(vault.order).toEqual(JSON.parse(file));
    const rows = await rowsByPath(store);
    // a place is a number that sorts a row among the others (milestone 62), not its index: the listed rows rise in the order listed
    const rise = (names: string[]): boolean => names.map((n) => rows.get(n)!.place!).every((x, i, all) => Number.isFinite(x) && (i === 0 || all[i - 1]! < x));
    expect(rise(['courses', 'library', 'arabic', 'physics', 'fleeting'])).toBe(true);
    expect(rise(['ch-2-microstates-and-entropy.md', 'ch-3-the-canonical-ensemble.md', 'ch-4-ideal-quantum-gases.md'].map((n) => `library/lindqvist-statistical-physics/${n}`))).toBe(true);
    // a row the list left where the default order had it keeps that number; only the rows the list moved get one between
    expect(['courses', 'library', 'physics'].map((n) => rows.get(n)!.place)).toEqual([1, 3, 4]);
    expect(rows.get('arabic')!.place).toBe(3.5);
    // as it came in, byte for byte, while the order is what it was
    expect(await fs.readText(`${ROOT}/.ilmi/order.json`)).toBe(file);
    // a rename keeps the row's place; the file follows
    const had = rows.get('physics/derivation-drills.md')!.place;
    const to = await vault.rename('physics/derivation-drills.md', 'drills');
    expect(vault.order['physics']).toEqual(['drills.md', 'constants-and-orders-of-magnitude.md']);
    expect((await fs.rowAt(`${ROOT}/${to}`))!.place).toBe(had);
    expect(JSON.parse(await fs.readText(`${ROOT}/.ilmi/order.json`))['physics']).toEqual(['drills.md', 'constants-and-orders-of-magnitude.md']);
    await vault.setOrder('physics', null);
    expect((await fs.rowAt(`${ROOT}/${to}`))!.place).toBeNull();
    expect(JSON.parse(await fs.readText(`${ROOT}/.ilmi/order.json`))).not.toHaveProperty('physics');
    // a collection opened afresh over the same rows has the same order
    const again = await Vault.open(storeFs(store, ROOT), ROOT);
    expect(again.order).toEqual(vault.order);
  });

  it('the review log is rows: a file of it reads back as written, and a line added drops what was not a review', async () => {
    const store = memStore();
    const fs = storeFs(store, ROOT);
    const vault = await Vault.open(fs, ROOT);
    const r = (at: string, card: string): Review => ({ at, doc: 'deck.md', card, g: 3, st: 'review', elapsed: 2, ivl: 2, next: 5, s: 5.25 });
    await vault.appendReviews([r('2026-10-30T08:00:00Z', 'a'), r('2026-11-01T08:00:00Z', 'b')]);
    await vault.appendReviews([r('2026-10-31T08:00:00Z', 'c')]);
    expect(store.tables.reviews.map((x) => [x.file, x.card])).toEqual([['2026-10.jsonl', 'a'], ['2026-11.jsonl', 'b'], ['2026-10.jsonl', 'c']]);
    expect((await rowsByPath(store)).has('.ilmi/reviews/2026-10.jsonl')).toBe(false);
    expect(await fs.readText(`${ROOT}/.ilmi/reviews/2026-10.jsonl`)).toBe(`${formatReview(r('2026-10-30T08:00:00Z', 'a'))}\n${formatReview(r('2026-10-31T08:00:00Z', 'c'))}\n`);
    expect((await vault.loadReviews()).map((x) => x.card)).toEqual(['a', 'c', 'b']);
    // a file with a torn line and a line twice, as a sync leaves one
    const hand = `${formatReview(r('2026-09-01T08:00:00Z', 'd'))}\n{"at":"2026-09-02T0\n${formatReview(r('2026-09-01T08:00:00Z', 'd'))}\n`;
    await fs.writeText(`${ROOT}/.ilmi/reviews/2026-09 (conflict).jsonl`, hand);
    expect(await fs.readText(`${ROOT}/.ilmi/reviews/2026-09 (conflict).jsonl`)).toBe(hand);
    expect((await fs.readDir(`${ROOT}/.ilmi/reviews`)).map((e) => e.name).sort()).toEqual(['2026-09 (conflict).jsonl', '2026-10.jsonl', '2026-11.jsonl']);
    expect((await vault.loadReviews()).map((x) => x.card)).toEqual(['d', 'a', 'c', 'b']);
    await fs.appendText!(`${ROOT}/.ilmi/reviews/2026-09 (conflict).jsonl`, `${formatReview(r('2026-09-03T08:00:00Z', 'e'))}\n`);
    expect(parseReviews(await fs.readText(`${ROOT}/.ilmi/reviews/2026-09 (conflict).jsonl`)).map((x) => x.card)).toEqual(['d', 'd', 'e']);
    await fs.remove(`${ROOT}/.ilmi/reviews/2026-10.jsonl`);
    expect(await fs.stat(`${ROOT}/.ilmi/reviews/2026-10.jsonl`)).toBeNull();
    expect((await vault.loadReviews()).map((x) => x.card)).toEqual(['d', 'e', 'b']);
  });

  it('the pairs said not the same are rows, read and written as `.ilmi/same.json`', async () => {
    const store = memStore();
    const fs = storeFs(store, ROOT);
    const vault = await Vault.open(fs, ROOT);
    expect(await vault.loadNotSame()).toEqual([]);
    expect(await fs.stat(`${ROOT}/.ilmi/same.json`)).toBeNull();
    await vault.saveNotSame(['b|c', 'a|b']);
    expect(await store.same()).toEqual(['a|b', 'b|c']);
    expect(await vault.loadNotSame()).toEqual(['a|b', 'b|c']);
    expect(await fs.readText(`${ROOT}/.ilmi/same.json`)).toBe('{\n  "not": [\n    "a|b",\n    "b|c"\n  ]\n}\n');
    expect((await rowsByPath(store)).has('.ilmi/same.json')).toBe(false);
    // none left: the file the app wrote is still the file
    await vault.saveNotSame([]);
    expect(await vault.loadNotSame()).toEqual([]);
    expect(await fs.readText(`${ROOT}/.ilmi/same.json`)).toBe('{\n  "not": []\n}\n');
  });

  it('a collection made before the tables is taken apart when it opens, and comes out as it went in', async () => {
    // as milestone 59 stored it: every file's text whole in its row
    const old = memStore(1);
    const put = async (parent: string | null, name: string, kind: 'folder' | 'doc' | 'file', id: string, text?: string) =>
      old.put({ id, parent, name, place: null, kind }, text === undefined ? undefined : kind === 'doc' ? splitFront(text) : { front: null, text });
    const deck = '---\ntype: deck\nread: due=2026-11-06 ivl=2\n---\n\nq :: a ^c1\n<!-- sr due=2026-11-07 st=review -->\n';
    const order = '{\n  "": [\n    "b.md",\n    "deck.md"\n  ]\n}\n';
    const log = `${formatReview({ at: '2026-10-30T08:00:00Z', doc: 'deck.md', card: 'c1', g: 3, st: 'new', elapsed: 0, ivl: 0, next: 1 })}\n`;
    await put(null, 'deck', 'doc', 'd', deck);
    await put(null, 'b', 'doc', 'b', 'plain\n');
    await put(null, '.ilmi', 'folder', 'i');
    await put('i', 'order.json', 'file', 'o', order);
    await put('i', 'state.json', 'file', 's', '{}\n');
    await put('i', 'reviews', 'folder', 'r');
    await put('r', '2026-10.jsonl', 'file', 'l', log);
    const fs = storeFs(old, ROOT);
    expect(await fs.readText(`${ROOT}/deck.md`)).toBe(deck);
    expect(await old.version()).toBe(STORE_VERSION);
    expect(await old.text('d')).not.toContain('<!-- sr');
    expect(old.tables.state.get('d')!.map((x) => x.kind).sort()).toEqual(['card', 'read']);
    expect((await fs.digests()).get('deck.md')!.blocks[0]).toMatchObject({ kind: 'card', id: 'c1', sched: { due: '2026-11-07' } });
    const rows = await rowsByPath(old);
    expect([...rows.keys()].sort()).toEqual(['.ilmi', '.ilmi/reviews', '.ilmi/state.json', 'b.md', 'deck.md']);
    expect([rows.get('b.md')!.place, rows.get('deck.md')!.place]).toEqual([0, 1]);
    expect(old.tables.reviews.length).toBe(1);
    const out = await tmp('upgraded');
    await exportFolder(fs, ROOT, nodeFs, out);
    const files = await filesOf(out);
    expect([...files.keys()].sort()).toEqual(['.ilmi/', '.ilmi/order.json', '.ilmi/reviews/', '.ilmi/reviews/2026-10.jsonl', '.ilmi/state.json', 'b.md', 'deck.md']);
    expect(files.get('deck.md')!.toString()).toBe(deck);
    expect(files.get('.ilmi/order.json')!.toString()).toBe(order);
    expect(files.get('.ilmi/reviews/2026-10.jsonl')!.toString()).toBe(log);
    // a collection from a newer ilmi is not opened
    await expect(storeFs(memStore(STORE_VERSION + 1), ROOT).readDir(ROOT)).rejects.toThrow('newer');
  });

  it('a collection of milestone 60 opens as it is: the engine\'s tables are the only thing it lacked', async () => {
    const was = memStore(2);
    const first = storeFs(was, ROOT);
    await importFolder(nodeFs, CORPUS, first, ROOT);
    await was.setVersion(2);
    const puts = was.calls.put;
    const fs = storeFs(was, ROOT);
    expect(await fs.readText(`${ROOT}/german.md`)).toBe(await fsp.readFile(joinPath(CORPUS, 'german.md'), 'utf8'));
    expect(await was.version()).toBe(STORE_VERSION);
    // nothing was taken apart again
    expect(was.calls.put).toBe(puts);
  });
});

describe('a mirror among a person\'s files', () => {
  it('writes what changed, removes only what it wrote, and reads nothing back', async () => {
    const { store, fs } = await collection(CORPUS);
    const vault = await Vault.open(fs, ROOT);
    const parent = await tmp('mirror');
    const dir = await mirrorDirIn(nodeFs, parent, 'notes');
    expect(dir).toBe(joinPath(parent, 'notes'));
    const first = await mirrorPass(fs, ROOT, nodeFs, dir);
    const corpus = await filesOf(CORPUS);
    const files = [...corpus.keys()].filter((p) => !p.endsWith('/'));
    expect(first.sort()).toEqual(files.sort());
    const out = await filesOf(dir);
    for (const p of files) expect(out.get(p)!.equals(corpus.get(p)!), p).toBe(true);
    expect(Object.keys(JSON.parse(out.get(MIRROR_LIST)!.toString()).files).sort()).toEqual(files.sort());
    // nothing changed: nothing is written, and no document is read to find that out
    const reads = store.calls.doc;
    expect(await mirrorPass(fs, ROOT, nodeFs, dir)).toEqual([]);
    expect(store.calls.doc).toBe(reads);
    // a person's own file in the folder, and one of theirs where a document will go
    await fsp.writeFile(joinPath(dir, 'mine.txt'), 'theirs\n');
    await vault.update('german.md', (doc) => { doc.blocks.push({ kind: 'paragraph', text: 'a line more' }); });
    const to = await vault.rename('papers/wozniak-1990.md', 'woz');
    await vault.remove('essays/spaced-composition.md');
    await vault.appendReviews([{ at: '2026-11-05T09:00:00Z', doc: 'german.md', card: 'x', g: 3, st: 'review', elapsed: 1, ivl: 1, next: 3 }]);
    const second = await mirrorPass(fs, ROOT, nodeFs, dir);
    expect(second).toContain('german.md');
    expect(second).toContain(to);
    expect(second).toContain('papers/wozniak-1990.md');
    expect(second).toContain('papers/woz/woz-ex1.md');
    expect(second).toContain('essays/spaced-composition.md');
    expect(second).toContain('.ilmi/reviews/2026-11.jsonl');
    const after = await filesOf(dir);
    expect(after.get('german.md')!.toString()).toContain('a line more');
    expect(after.has('papers/wozniak-1990.md')).toBe(false);
    expect(after.has('papers/wozniak-1990/')).toBe(false);
    expect(after.has('papers/woz/woz-ex1.md')).toBe(true);
    expect(after.has('essays/spaced-composition.md')).toBe(false);
    expect(after.get('mine.txt')!.toString()).toBe('theirs\n');
    // the folder is the collection again, beside what was theirs
    const want = await tmp('mirror-want');
    await exportFolder(fs, ROOT, nodeFs, want);
    const exported = await filesOf(want);
    for (const [p, bytes] of exported) if (bytes) expect(after.get(p)!.equals(bytes), p).toBe(true);
    expect([...after.keys()].filter((p) => !exported.has(p) && !p.endsWith('/')).sort()).toEqual([MIRROR_LIST, 'mine.txt']);
  });

  it('never takes a folder that holds something it did not write', async () => {
    const parent = await tmp('mirror-taken');
    await fsp.mkdir(joinPath(parent, 'notes'));
    await fsp.writeFile(joinPath(parent, 'notes/theirs.md'), 'x\n');
    await fsp.mkdir(joinPath(parent, 'notes 2'));
    await fsp.writeFile(joinPath(parent, 'notes 2', MIRROR_LIST), '{"files":{}}\n');
    await fsp.mkdir(joinPath(parent, 'empty'));
    expect(await mirrorDirIn(nodeFs, parent, 'notes')).toBe(joinPath(parent, 'notes 2'));
    expect(await mirrorDirIn(nodeFs, parent, 'empty')).toBe(joinPath(parent, 'empty'));
    expect(await mirrorDirIn(nodeFs, `${parent}/`, 'new')).toBe(joinPath(parent, 'new'));
  });
});

describe('files that are named and not here (milestone 63)', () => {
  it('an export and a mirror leave out what they are told to, and a file is read by the piece', async () => {
    const store = memStore();
    const fs = storeFs(store, ROOT);
    await importFolder(nodeFs, SAMPLE, fs, ROOT);
    const pdf = 'library/classical-prose-reader.pdf';
    const hash = fs.blobAt(join(ROOT, pdf));
    expect(hash).toMatch(/^[0-9a-f]{64}$/);
    expect(fs.blobAt(join(ROOT, 'arabic/vocabulary.md'))).toBeNull();
    expect(fs.away()).toEqual([]);
    expect(fs.isAway(join(ROOT, pdf))).toBe(false);
    // the dated export's way: every file but the ones kept beside the database, which it lists
    const left: Record<string, string> = {};
    const out = await tmp('leave');
    const wrote = await exportFolder(fs, ROOT, nodeFs, out, (path) => { const h = fs.blobAt(join(ROOT, path)); if (h) left[path] = h; return h !== null; });
    expect(Object.keys(left).sort()).toEqual(['library/classical-prose-reader.pdf', 'library/lindqvist-statistical-physics.pdf']);
    const sample = await filesOf(SAMPLE);
    const files = [...sample.keys()].filter((p) => !p.endsWith('/'));
    expect(wrote).toBe(files.length - 2);
    const got = await filesOf(out);
    expect(got.has(pdf)).toBe(false);
    expect(got.get('arabic/vocabulary.md')!.equals(sample.get('arabic/vocabulary.md')!)).toBe(true);
    // a mirror told to leave a file takes no notice of it, and writes it on the pass that is no longer told to
    const dir = joinPath(await tmp('mirror-leave'), 'm');
    const first = await mirrorPass(fs, ROOT, nodeFs, dir, (path) => path === pdf);
    expect(first).not.toContain(pdf);
    expect(first.length).toBe(files.length - 1);
    expect(await mirrorPass(fs, ROOT, nodeFs, dir)).toEqual([pdf]);
    // a piece of the file, as a reader of a big one asks for it
    const whole = sample.get(pdf)!;
    const pieces = await fs.pieces(join(ROOT, pdf));
    expect(pieces?.size).toBe(whole.length);
    expect(Buffer.from(await pieces!.read(100, 164)).equals(whole.subarray(100, 164))).toBe(true);
    expect(await fs.pieces(join(ROOT, 'arabic/vocabulary.md'))).toBeNull();
    // a store with no way to take a file from disk says so, and the file is written the usual way
    expect(await fs.take(join(ROOT, 'library/other.pdf'), '/somewhere/other.pdf')).toBe(false);
    // by its name alone: the same bytes under another path, none read
    const reads = store.calls.blobGet;
    await fs.writeRef!(join(ROOT, 'library/copy.pdf'), (await fs.ref!(join(ROOT, pdf)))!);
    expect(store.calls.blobGet).toBe(reads);
    expect(Buffer.from(await fs.readBytes(join(ROOT, 'library/copy.pdf'))).equals(whole)).toBe(true);
    expect(await fs.ref!(join(ROOT, 'arabic/vocabulary.md'))).toBeNull();
  });
});

describe('ink (milestone 58)', () => {
  const NOTE = 'fleeting/worked-example.md';
  const PAGE = 'fleeting/worked-example/ink-01.pkdrawing';
  const PICTURE = 'fleeting/worked-example/ink-01.png';
  const stroke = (n: number): InkStroke => ({ stroke: `s${n}`, at: 1000 + n, data: Buffer.from(`stroke ${n}`).toString('base64') });
  const names = async (fs: StoreFs, dir: string): Promise<string[]> => (await fs.readDir(join(ROOT, dir))).map((e) => e.name).sort();

  it('the corpus\'s page comes in as its two files and goes out as them, byte for byte', async () => {
    const { fs, store } = await collection(CORPUS);
    const rows = await rowsByPath(store);
    // a drawing that came in as a file is a file: nothing has to read PencilKit's bytes to keep it
    expect(rows.get(PAGE)!.blob).not.toBeNull();
    expect(isInk(rows.get(PAGE)!)).toBe(false);
    expect(await fs.ink(join(ROOT, PAGE))).toBeNull();
    const out = await tmp('ink-out');
    await exportFolder(fs, ROOT, nodeFs, out);
    const [want, got] = [await filesOf(CORPUS), await filesOf(out)];
    for (const p of [NOTE, PAGE, PICTURE]) expect(got.get(p)!.equals(want.get(p)!), p).toBe(true);
    // FORMAT.md §4: the note names the picture, and the drawing is beside it under the same name
    expect(parse(want.get(NOTE)!.toString('utf8')).doc.blocks.some((b) => b.kind === 'paragraph' && b.text === '![working](worked-example/ink-01.png)')).toBe(true);
  });

  it('a page drawn is a row and its strokes; the drawing and the picture are made when they are read', async () => {
    const { fs, store } = await collection(CORPUS);
    const page = join(ROOT, 'german/ink-01.pkdrawing');
    expect(await fs.setInk(page, [stroke(1), stroke(2)])).toEqual({ added: 2, removed: 0 });
    const row = (await rowsByPath(store)).get('german/ink-01.pkdrawing')!;
    expect(isInk(row)).toBe(true);
    expect(store.blobs.size).toBe((await collection(CORPUS)).store.blobs.size);
    // both files are there to whoever lists, stats or reads, and only one is a row
    expect(await names(fs, 'german')).toEqual(['ink-01.pkdrawing', 'ink-01.png']);
    expect((await store.rows()).filter((r) => r.parent === row.parent).map((r) => r.name)).toEqual(['ink-01.pkdrawing']);
    expect(await fs.stat(join(ROOT, 'german/ink-01.png'))).toMatchObject({ isDir: false });
    expect(await fs.readBytes(page)).toEqual(memDrawing([stroke(1), stroke(2)]));
    expect(await fs.readBytes(join(ROOT, 'german/ink-01.png'))).toEqual(memPicture([stroke(1), stroke(2)]));
    expect(await fs.ink(join(ROOT, 'german/ink-01.png'))).toEqual([stroke(1), stroke(2)]);
    // the canvas gives back what it holds: a stroke it had is left alone, a new one is added, one erased goes
    const again = memSplit(await fs.readBytes(page)).map((x) => ({ ...x, data: `${x.data}AA` }));
    const stamp = (await fs.stat(page))!;
    expect(await fs.setInk(page, again)).toEqual({ added: 0, removed: 0 });
    expect(await fs.stat(page)).toEqual(stamp);
    expect(await fs.setInk(page, [again[1]!, stroke(3)])).toEqual({ added: 1, removed: 1 });
    expect((await fs.ink(page))!.map((x) => x.stroke)).toEqual(['s2', 's3']);
    expect((await fs.ink(page))![0]!.data).toBe(stroke(2).data);
    expect((await fs.stat(page))!.mtimeMs).toBeGreaterThan(stamp.mtimeMs);
    // a picture written beside a page is not kept: the strokes make it
    await fs.writeBytes(join(ROOT, 'german/ink-01.png'), new Uint8Array([1, 2, 3]));
    expect(await fs.readBytes(join(ROOT, 'german/ink-01.png'))).toEqual(memPicture([stroke(2), stroke(3)]));
    // an export writes the two files; brought in again they are files, and the same bytes go out
    const out = await tmp('ink-export');
    await exportFolder(fs, ROOT, nodeFs, out);
    const got = await filesOf(out);
    expect(got.get('german/ink-01.pkdrawing')!.equals(Buffer.from(memDrawing([stroke(2), stroke(3)])))).toBe(true);
    expect(got.get('german/ink-01.png')!.equals(Buffer.from(memPicture([stroke(2), stroke(3)])))).toBe(true);
    const back = await collection(out);
    const out2 = await tmp('ink-export-2');
    await exportFolder(back.fs, ROOT, nodeFs, out2);
    const got2 = await filesOf(out2);
    expect([...got2.keys()].sort()).toEqual([...got.keys()].sort());
    for (const [p, b] of got) if (b) expect(got2.get(p)!.equals(b), p).toBe(true);
    // the page goes with its row, and its strokes with it
    await fs.remove(page);
    expect(await names(fs, 'german').catch(() => [])).toEqual([]);
    expect(await store.ink(row.id)).toEqual([]);
  });

  it('a drawing kept as a file becomes a page of strokes when it is drawn on, and moves with its note', async () => {
    const { fs, store } = await collection(CORPUS);
    const blobs = store.blobs.size;
    await fs.setInk(join(ROOT, PAGE), [stroke(1)]);
    const rows = await rowsByPath(store);
    expect(isInk(rows.get(PAGE)!)).toBe(true);
    // the picture that came in beside it is gone as a row: the one the strokes make is read in its place
    expect(rows.has(PICTURE)).toBe(false);
    expect(await fs.readBytes(join(ROOT, PICTURE))).toEqual(memPicture([stroke(1)]));
    expect(store.blobs.size).toBe(blobs);
    await fs.rename(join(ROOT, NOTE), join(ROOT, 'essays/worked.md'));
    expect(await names(fs, 'essays/worked')).toEqual(['ink-01.pkdrawing', 'ink-01.png']);
    expect(await fs.ink(join(ROOT, 'essays/worked/ink-01.pkdrawing'))).toEqual([stroke(1)]);
    // a file written over a page is that file from now on
    await fs.writeBytes(join(ROOT, 'essays/worked/ink-01.pkdrawing'), new Uint8Array([9, 9]));
    expect(await fs.ink(join(ROOT, 'essays/worked/ink-01.pkdrawing'))).toBeNull();
    expect(await fs.readBytes(join(ROOT, 'essays/worked/ink-01.pkdrawing'))).toEqual(new Uint8Array([9, 9]));
    // and the picture its strokes made is a file beside it
    expect(await names(fs, 'essays/worked')).toEqual(['ink-01.pkdrawing', 'ink-01.png']);
    expect((await rowsByPath(store)).get('essays/worked/ink-01.png')!.blob).not.toBeNull();
    expect(await fs.readBytes(join(ROOT, 'essays/worked/ink-01.png'))).toEqual(memPicture([stroke(1)]));
  });

  it('a note deleted with its page and put back has the drawing and its picture', async () => {
    const { fs } = await collection(CORPUS);
    await fs.setInk(join(ROOT, PAGE), [stroke(1), stroke(2)]);
    const vault = await Vault.open(fs, ROOT);
    const removed = await vault.remove(NOTE);
    expect(await fs.stat(join(ROOT, PAGE))).toBeNull();
    await vault.restore(removed);
    // put back as the two files an export would have written: the strokes are in the drawing
    expect(memSplit(await fs.readBytes(join(ROOT, PAGE))).map((x) => x.stroke)).toEqual(['s1', 's2']);
    expect(await fs.readBytes(join(ROOT, PICTURE))).toEqual(memPicture([stroke(1), stroke(2)]));
  });
});
