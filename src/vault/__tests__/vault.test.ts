import { writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { meta, setField, type Card } from '../../format/index.js';
import { STORE, openDisk, type Disk } from './disk.js';
import { Vault, VaultConflict, childrenAt, cleanOrder, directories, documents, entryOf, followMove, forget, ordered, placeEntry, pruneOrder, walk, type TreeNode, type VaultEvent } from '../index.js';

const CORPUS = fileURLToPath(new URL('../../format/__tests__/corpus/vault/', import.meta.url));
const WOZ = 'papers/wozniak-1990.md';
const DECK = 'german.md';

// over a temporary directory, and again over a collection's store (`disk.ts`, `vault-store.test.ts`)
let disk: Disk;
let root: string;
let vault: Vault;

beforeEach(async () => {
  disk = await openDisk(CORPUS, 'vault');
  root = disk.root;
  vault = await Vault.open(disk.fs, root);
});

afterEach(async () => {
  vault.close();
  await disk.dispose();
});

const readDisk = (rel: string) => disk.read(rel);

/** Lines that differ between two texts of equal length. */
function changedLines(a: string, b: string): number[] {
  const la = a.split('\n');
  const lb = b.split('\n');
  expect(lb.length).toBe(la.length);
  return la.flatMap((line, i) => (line === lb[i] ? [] : [i + 1]));
}

function firstScheduledCard(blocks: { kind: string }[]): Card {
  const card = blocks.find((b): b is Card => b.kind === 'card' && 'sched' in b);
  if (!card) throw new Error('no scheduled card');
  return card;
}

function names(nodes: TreeNode[]): string[] {
  return nodes.map((n) => (n.kind === 'folder' ? `${n.name}/` : n.name));
}

describe('walk', () => {
  it('builds the tree FORMAT.md §1 describes', async () => {
    expect(names(vault.tree)).toEqual(['books/', 'courses/', 'essays/', 'fleeting/', 'papers/', 'german']);
    const papers = vault.tree.find((n) => n.name === 'papers');
    expect(papers?.kind).toBe('folder');
    if (papers?.kind !== 'folder') return;
    expect(names(papers.children)).toEqual(['archive/', 'crick-1995', 'maxwell', 'two-pages', 'wozniak-1990']);
    // the PDF beside two-pages.md is its pages, attached by stem; the file itself is not a document
    const pair = papers.children.find((n) => n.name === 'two-pages');
    expect(pair).toMatchObject({ kind: 'doc', path: 'papers/two-pages.md', pdf: 'papers/two-pages.pdf' });
    expect(pair?.kind === 'doc' && pair.children && names(pair.children)).toEqual(['the ruler in the margin']);
    expect(vault.documents()).not.toContain('papers/two-pages.pdf');
    const woz = papers.children.find((n) => n.name === 'wozniak-1990');
    expect(woz).toMatchObject({ kind: 'doc', path: WOZ });
    expect(woz?.kind === 'doc' && woz.children && names(woz.children)).toEqual(['woz-ex1']);
  });

  it('a PDF with no `.md` of its name is a document of its own: its pages, a note attached by `pdf`, its state in reading.json (milestone 70)', async () => {
    const books = vault.tree.find((n) => n.name === 'books');
    if (books?.kind !== 'folder') throw new Error('no books/');
    expect(names(books.children)).toEqual(['alone', 'james-pluralistic-ch4', 'notes-on-alone']);
    expect(books.children.find((n) => n.name === 'alone')).toEqual({ kind: 'doc', name: 'alone', path: 'books/alone.pdf', pdf: 'books/alone.pdf', bare: true });
    // listed apart from the `.md` documents, and its pages are itself
    expect(vault.documents()).not.toContain('books/alone.pdf');
    expect(vault.pdfs()).toEqual(['books/alone.pdf']);
    expect(await vault.pagesOf('books/alone.pdf')).toBe('books/alone.pdf');
    // it reads as a source whose pages are itself, with the state `.ilmi/reading.json` holds; nothing is read from the PDF
    const loaded = await vault.read('books/alone.pdf');
    expect(meta(loaded.doc)).toMatchObject({ type: 'source', pdf: 'alone.pdf', read: { due: '2026-06-02', ivl: 2, reps: 1, pos: 2, y: 0.25 } });
    expect(loaded.doc.blocks).toEqual([]);
    expect(vault.pdfState('books/alone.pdf')).toEqual({ read: 'due=2026-06-02 ivl=2 reps=1 pos=2 y=0.250' });
    // the note beside it is attached by naming the file, and is not named after it
    expect(meta((await vault.read('books/notes-on-alone.md')).doc).pdf).toBe('alone.pdf');
    expect(await vault.pagesOf('books/notes-on-alone.md')).toBe('books/alone.pdf');
  });

  it('a write to a PDF on its own goes to reading.json, never into the file; a rename and a delete take the state along (milestone 70)', async () => {
    const PDF = 'books/alone.pdf';
    const bytes = await vault.fs.readBytes(vault.abs(PDF));
    const events: string[] = [];
    const off = vault.subscribe((ev) => { if (ev.kind === 'doc') events.push(ev.path); });
    await vault.update(PDF, (doc) => { setField(doc, 'read', { due: '2026-06-09', ivl: 2, reps: 2, pos: 3, y: 0.5 }); setField(doc, 'pri', 30); });
    expect(events).toEqual([PDF]);
    expect(JSON.parse(await vault.fs.readText(vault.abs('.ilmi/reading.json')))).toEqual({ [PDF]: { read: 'due=2026-06-09 ivl=2 reps=2 pos=3 y=0.500', pri: 30 } });
    expect(Buffer.from(await vault.fs.readBytes(vault.abs(PDF))).equals(Buffer.from(bytes))).toBe(true);
    expect(meta((await vault.read(PDF)).doc)).toMatchObject({ pri: 30, read: { due: '2026-06-09', pos: 3, y: 0.5 } });
    // the body is not kept: a PDF has none
    await vault.update(PDF, (doc) => { doc.blocks.push({ kind: 'paragraph', text: 'x' }); });
    expect((await vault.read(PDF)).doc.blocks).toEqual([]);
    // renamed: the state follows, and the note that named it names the new file
    const to = await vault.rename(PDF, 'standing alone');
    expect(to).toBe('books/standing alone.pdf');
    expect(vault.pdfs()).toEqual([to]);
    expect(vault.pdfState(PDF)).toBeUndefined();
    expect(vault.pdfState(to)).toMatchObject({ pri: 30 });
    expect(meta((await vault.read('books/notes-on-alone.md')).doc).pdf).toBe('standing alone.pdf');
    // moved into a folder: the same
    const moved = await vault.move(to, 'papers/archive');
    expect(moved).toBe('papers/archive/standing alone.pdf');
    expect(meta((await vault.read('books/notes-on-alone.md')).doc).pdf).toBe('../papers/archive/standing alone.pdf');
    expect(await vault.pagesOf('books/notes-on-alone.md')).toBe(moved);
    // deleted: the file and its state go; restored, both are back
    const removed = await vault.remove(moved);
    expect(vault.pdfs()).toEqual([]);
    expect(await vault.fs.stat(vault.abs('.ilmi/reading.json'))).toBeNull();
    await vault.restore(removed);
    expect(vault.pdfs()).toEqual([moved]);
    expect(vault.pdfState(moved)).toMatchObject({ pri: 30 });
    // and back where the corpus has it, its state as the corpus has it
    await vault.move(moved, 'books');
    await vault.rename('books/standing alone.pdf', 'alone');
    await vault.update(PDF, (doc) => { setField(doc, 'read', { due: '2026-06-02', ivl: 2, reps: 1, pos: 2, y: 0.25 }); setField(doc, 'pri', null); });
    expect(meta((await vault.read('books/notes-on-alone.md')).doc).pdf).toBe('alone.pdf');
    off();
    // its place in its directory's order is kept by its file name, as a document's is
    await vault.setOrder('books', ['notes-on-alone.md', 'alone.pdf', 'james-pluralistic-ch4.md']);
    expect(vault.order['books']).toEqual(['notes-on-alone.md', 'alone.pdf', 'james-pluralistic-ch4.md']);
    expect(ordered(childrenAt(vault.tree, 'books')!, vault.order['books']).map((n) => n.name)).toEqual(['notes-on-alone', 'alone', 'james-pluralistic-ch4']);
    await vault.setOrder('books', null);
    expect(vault.order['books']).toBeUndefined();
  });

  it('ignores dot-directories and non-markdown files', async () => {
    await disk.mkdir('.obsidian');
    await disk.write('.obsidian/workspace.md', 'x\n');
    await disk.mkdir('.ilmi');
    await disk.write('.ilmi/state.json', '{}\n');
    await disk.write('notes.txt', 'x\n');
    await disk.write('papers/figure.png', '');
    const tree = await walk(disk.fs, root);
    expect(names(tree)).toEqual(['books/', 'courses/', 'essays/', 'fleeting/', 'papers/', 'german']);
    expect(documents(tree)).not.toContain('notes.txt');
  });

  it('lists every document in tree order', () => {
    expect(vault.documents()).toEqual([
      'books/james-pluralistic-ch4.md',
      'books/notes-on-alone.md',
      'courses/linear-algebra.md',
      'courses/linear-algebra/unit-2/eigenvalues.md',
      'courses/linear-algebra/problem-set-1.md',
      'courses/linear-algebra/vectors.md',
      'essays/marginalia.md',
      'essays/spaced-composition.md',
      'essays/talk-incremental.md',
      'fleeting/2026-05-26.md',
      'fleeting/2026-05-27.md',
      'fleeting/clipped-page.md',
      'fleeting/lecture-9.md',
      'fleeting/markdown-sampler.md',
      'fleeting/office-hours.md',
      'fleeting/worked-example.md',
      'papers/archive/sutton-2019.md',
      'papers/crick-1995.md',
      'papers/maxwell.md',
      'papers/two-pages.md',
      'papers/two-pages/the ruler in the margin.md',
      'papers/wozniak-1990.md',
      'papers/wozniak-1990/woz-ex1.md',
      'german.md',
    ]);
  });
});

describe('read', () => {
  it('parses a document and keeps its diagnostics', async () => {
    const loaded = await vault.read(WOZ);
    expect(meta(loaded.doc)).toMatchObject({ type: 'source', frozen: true });
    expect(loaded.diagnostics).toEqual([]);
    expect(loaded.stamp).not.toBeNull();

    await disk.write('broken.md', 'prose\n<!-- sr due=2026-01-01 -->\n');
    const broken = await vault.read('broken.md');
    expect(broken.diagnostics.length).toBeGreaterThan(0);
    expect(vault.diagnostics('broken.md')).toBe(broken.diagnostics);
  });

  it('serves the cache until told the file changed', async () => {
    const a = await vault.read(WOZ);
    expect(await vault.read(WOZ)).toBe(a);
    expect(await vault.read(WOZ, true)).not.toBe(a);
  });
});

describe('write', () => {
  it('changes one card schedule on disk by one line', async () => {
    const before = await readDisk(WOZ);
    await vault.update(WOZ, (doc) => {
      firstScheduledCard(doc.blocks).sched!.due = '2026-07-04';
    });
    const after = await readDisk(WOZ);
    expect(changedLines(before, after)).toEqual([16]);
    expect(after.split('\n')[15]).toBe(
      '<!-- sr due=2026-07-04 st=review s=22 d=3.8 r=9 l=0 ivl=22 last=2026-05-19T08:00:00Z g=3 -->',
    );
    expect(after.endsWith('\n')).toBe(true);
  });

  it('removes one card with its id and schedule, nothing else', async () => {
    const before = (await readDisk(DECK)).split('\n');
    const { doc } = await vault.read(DECK);
    const n = doc.blocks.filter((b) => b.kind === 'card').length;
    const i = doc.blocks.findIndex((b) => b.kind === 'card' && b.id === 'cv-gedacht');
    const written = await vault.removeCard(DECK, i, 'cv-gedacht');
    expect(written.doc.blocks.filter((b) => b.kind === 'card')).toHaveLength(n - 1);
    expect(written.doc.blocks.some((b) => b.kind === 'card' && b.id === 'cv-gedacht')).toBe(false);
    const after = await readDisk(DECK);
    expect(after).not.toContain('cv-gedacht');
    expect(after.split('\n')).toEqual(before.filter((l) => !l.includes('das Gedächtnis') && !l.includes('s=14 d=3.4')).filter((l, k, a) => !(l === '' && a[k - 1] === '')));
  });

  it('finds a moved card by id, and refuses a card that is not there', async () => {
    await vault.removeCard(DECK, 0, 'cv-gedacht');
    const { doc } = await vault.read(DECK);
    expect(doc.blocks.some((b) => b.kind === 'card' && b.id === 'cv-gedacht')).toBe(false);
    await expect(vault.removeCard(DECK, 0, 'cv-gedacht')).rejects.toThrow(/no such card/);
    await expect(vault.removeCard(DECK, 999)).rejects.toThrow(/no such card/);
  });

  it('finds an id-less card by its text when another card slid into its index', async () => {
    const text = 'ein Wort ohne Karte ::: a word without a card';
    const { doc } = await vault.read(DECK);
    const i = doc.blocks.findIndex((b) => b.kind === 'card' && b.text === text);
    expect(doc.blocks[i]).toEqual({ kind: 'card', text });
    // a card is added above it on disk before the vault hears of it
    const onDiskText = await readDisk(DECK);
    await disk.write(DECK, onDiskText.replace('vergessen ::: to forget ^', 'neu ::: new\n\nvergessen ::: to forget ^'));
    await expect(vault.removeCard(DECK, i, undefined, 'nothing like it')).rejects.toThrow(/no such card/);
    const written = await vault.removeCard(DECK, i, undefined, text);
    expect(written.doc.blocks.some((b) => b.kind === 'card' && b.text === text)).toBe(false);
    expect(written.doc.blocks.some((b) => b.kind === 'card' && b.id === 'cv-cloze')).toBe(true);
    expect((await readDisk(DECK)).split('\n')).toEqual(onDiskText.replace('vergessen ::: to forget ^', 'neu ::: new\n\nvergessen ::: to forget ^').split('\n').filter((l) => l !== text).slice(0, -1));
  });

  it('resets one card by dropping its sr line and nothing else', async () => {
    const before = (await readDisk(DECK)).split('\n');
    const { doc } = await vault.read(DECK);
    const i = doc.blocks.findIndex((b) => b.kind === 'card' && b.id === 'cv-gedacht');
    const written = await vault.resetCard(DECK, i, 'cv-gedacht');
    const card = written.doc.blocks[i];
    expect(card).toEqual({ kind: 'card', text: 'das Gedächtnis ::: memory', id: 'cv-gedacht' });
    // line 18 is the card's schedule; every other line stays put
    expect((await readDisk(DECK)).split('\n')).toEqual(before.filter((_, k) => k !== 17));
    // a second reset changes nothing and still resolves
    const again = await vault.resetCard(DECK, i, 'cv-gedacht');
    expect(again.text).toBe(written.text);
  });

  it('resets a cloze card with per-blank schedules', async () => {
    const before = (await readDisk(WOZ)).split('\n');
    const { doc } = await vault.read(WOZ);
    const i = doc.blocks.findIndex((b) => b.kind === 'card' && b.id === 'cw2-min');
    expect(doc.blocks[i]).toHaveProperty('blanks');
    const written = await vault.resetCard(WOZ, i, 'cw2-min');
    const card = written.doc.blocks[i];
    expect(card?.kind).toBe('card');
    expect(card).not.toHaveProperty('sched');
    expect(card).not.toHaveProperty('blanks');
    expect(card).toHaveProperty('id', 'cw2-min');
    // lines 25 and 26 are the c1 and c2 schedules
    expect((await readDisk(WOZ)).split('\n')).toEqual(before.filter((_, k) => k !== 24 && k !== 25));
  });

  it('keeps a card\'s own priority through a reset', async () => {
    const { doc } = await vault.read(WOZ);
    const i = doc.blocks.findIndex((b) => b.kind === 'card' && b.id === 'cw1-paths');
    await vault.update(WOZ, (d) => { const c = d.blocks[i]; if (c?.kind === 'card') c.sched = { ...c.sched, pri: 20 }; });
    expect(await readDisk(WOZ)).toContain(' g=3 pri=20 -->');
    const written = await vault.resetCard(WOZ, i, 'cw1-paths');
    expect(written.doc.blocks[i]).toEqual({ kind: 'card', text: expect.any(String), id: 'cw1-paths', sched: { pri: 20 } });
    expect((await readDisk(WOZ)).split('\n')).toContain('<!-- sr pri=20 -->');
  });

  it('moves a card to the end of another document with its schedule', async () => {
    const events: VaultEvent[] = [];
    vault.subscribe((ev) => events.push(ev));
    const srcBefore = (await readDisk(DECK)).split('\n');
    const destBefore = (await readDisk(WOZ)).split('\n');
    const { doc } = await vault.read(DECK);
    const i = doc.blocks.findIndex((b) => b.kind === 'card' && b.id === 'cv-vergessen');
    const card = doc.blocks[i];
    const dest = await vault.moveCard(DECK, i, WOZ, 'cv-vergessen');
    expect(dest.path).toBe(WOZ);
    expect(dest.doc.blocks[dest.doc.blocks.length - 1]).toEqual(card);
    // the card's two lines and the blank after them leave the source
    expect((await readDisk(DECK)).split('\n')).toEqual(srcBefore.filter((_, k) => k < 19 || k > 21));
    // and land after a blank line at the end of the destination
    expect((await readDisk(WOZ)).split('\n')).toEqual([...destBefore.slice(0, -1), '', srcBefore[19], srcBefore[20], '']);
    // destination first, then source, each through the normal event
    expect(events.map((e) => e.kind === 'doc' && e.path)).toEqual([WOZ, DECK]);
    expect(await vault.read(WOZ)).toBe(dest);
  });

  it('moves a card without its extract backrefs', async () => {
    await vault.update(WOZ, (doc) => {
      const card = firstScheduledCard(doc.blocks);
      card.extracts = ['woz-ex1'];
    });
    const { doc } = await vault.read(WOZ);
    const i = doc.blocks.findIndex((b) => b.kind === 'card' && b.id === 'cw1-paths');
    expect(doc.blocks[i]).toHaveProperty('extracts', ['woz-ex1']);
    const woz = (await readDisk(WOZ)).split('\n');
    const k = woz.findIndex((l) => l.endsWith('^cw1-paths'));
    expect(woz.slice(k + 1, k + 4).map((l) => l.slice(0, 12))).toEqual(['<!-- sr due=', '<!-- extract', '']);
    const dest = await vault.moveCard(WOZ, i, DECK, 'cw1-paths');
    const moved = dest.doc.blocks[dest.doc.blocks.length - 1];
    expect(moved).toMatchObject({ kind: 'card', id: 'cw1-paths' });
    expect(moved).toHaveProperty('sched');
    expect(moved).not.toHaveProperty('extracts');
    expect(dest.diagnostics).toEqual([]);
    // the card, its schedule, its backref, and the blank after them leave the source
    expect((await readDisk(WOZ)).split('\n')).toEqual(woz.filter((_, n) => n < k || n > k + 3));
    // and the card and its schedule, without the backref, end the destination
    expect((await readDisk(DECK)).split('\n').slice(-3)).toEqual([woz[k], woz[k + 1], '']);
  });

  it('moves the card as it is on disk, not as the cache last saw it', async () => {
    const { doc } = await vault.read(DECK);
    const i = doc.blocks.findIndex((b) => b.kind === 'card' && b.id === 'cv-vergessen');
    // an edit the watcher has not delivered yet
    const onDiskText = await readDisk(DECK);
    await disk.write(DECK, onDiskText.replace('vergessen ::: to forget ^', 'vergessen ::: to forget; to leave behind ^'));
    const dest = await vault.moveCard(DECK, i, WOZ, 'cv-vergessen');
    expect(dest.doc.blocks[dest.doc.blocks.length - 1]).toMatchObject({ kind: 'card', text: 'vergessen ::: to forget; to leave behind', id: 'cv-vergessen' });
    expect(await readDisk(WOZ)).toContain('vergessen ::: to forget; to leave behind ^cv-vergessen');
    expect(await readDisk(DECK)).not.toContain('vergessen');
  });

  // a write made inside an event, before the vault's next step: only a directory can be written without waiting
  it.skipIf(STORE)('leaves a card that changed between the two writes in the source, so it is in both files', async () => {
    const { doc } = await vault.read(DECK);
    const i = doc.blocks.findIndex((b) => b.kind === 'card' && b.id === 'cv-vergessen');
    const onDiskText = await readDisk(DECK);
    // the source changes the moment the destination is written
    const off = vault.subscribe((ev) => {
      if (ev.kind === 'doc' && ev.path === WOZ) writeFileSync(join(root, DECK), onDiskText.replace('vergessen ::: to forget ^', 'vergessen ::: to forget; to leave behind ^'));
    });
    await expect(vault.moveCard(DECK, i, WOZ, 'cv-vergessen')).rejects.toBeInstanceOf(VaultConflict);
    off();
    expect(await readDisk(DECK)).toContain('vergessen ::: to forget; to leave behind ^cv-vergessen');
    expect(await readDisk(WOZ)).toContain('vergessen ::: to forget ^cv-vergessen');
  });

  it('mints a fresh id when the destination already has one', async () => {
    const stranger = { kind: 'card' as const, text: 'to forget ::: oublier', id: 'cv-vergessen', sched: { due: '2026-08-01' } };
    await vault.update(WOZ, (doc) => {
      doc.blocks.push(structuredClone(stranger));
    });
    const { doc } = await vault.read(DECK);
    const i = doc.blocks.findIndex((b) => b.kind === 'card' && b.id === 'cv-vergessen');
    const dest = await vault.moveCard(DECK, i, WOZ, 'cv-vergessen');
    const blocks = dest.doc.blocks;
    expect(blocks[blocks.length - 2]).toEqual(stranger);
    const moved = blocks[blocks.length - 1];
    expect(moved).toMatchObject({ kind: 'card', text: 'vergessen ::: to forget', sched: { due: '2026-06-02', stability: 6 } });
    expect(moved?.kind === 'card' && moved.id).toMatch(/^c[a-z0-9]{6}$/);
    expect(blocks.filter((b) => b.kind === 'card' && b.id === 'cv-vergessen')).toHaveLength(1);
    expect(await readDisk(DECK)).not.toContain('cv-vergessen');
    // on disk the fresh id sits on the paragraph line, the schedule directly under it, after the stranger
    expect((await readDisk(WOZ)).split('\n').slice(-6)).toEqual([
      'to forget ::: oublier ^cv-vergessen',
      '<!-- sr due=2026-08-01 -->',
      '',
      `vergessen ::: to forget ^${moved?.kind === 'card' ? moved.id : ''}`,
      '<!-- sr due=2026-06-02 st=review s=6 d=4 r=5 l=0 ivl=6 last=2026-05-27T07:30:00Z g=3 -->',
      '',
    ]);
  });

  it('refuses to move a card to a missing document, or onto its own', async () => {
    const before = await readDisk(DECK);
    const { doc } = await vault.read(DECK);
    const i = doc.blocks.findIndex((b) => b.kind === 'card' && b.id === 'cv-vergessen');
    await expect(vault.moveCard(DECK, i, 'papers/nope.md', 'cv-vergessen')).rejects.toThrow(/no such document/);
    await expect(vault.moveCard(DECK, i, 'papers', 'cv-vergessen')).rejects.toThrow(/no such document/);
    await expect(vault.moveCard(DECK, i, DECK, 'cv-vergessen')).rejects.toThrow(/onto/);
    expect(await readDisk(DECK)).toBe(before);
    await expect(vault.moveCard(DECK, 999, WOZ)).rejects.toThrow(/no such card/);
    expect(await readDisk(WOZ)).not.toContain('cv-vergessen');
  });

  it('writes atomically and leaves no temp file', async () => {
    await vault.update(WOZ, (doc) => {
      firstScheduledCard(doc.blocks).sched!.due = '2026-07-04';
    });
    const files = await disk.names('papers');
    expect(files.filter((f) => f.includes('tmp'))).toEqual([]);
  });

  it('keeps both sides of a concurrent edit', async () => {
    await vault.read(WOZ);
    const original = await readDisk(WOZ);
    const edited = original.replace('## §1 — the premise', '## §1 — the premise, revised');
    expect(edited).not.toBe(original);
    await disk.write(WOZ, edited);

    await vault.update(WOZ, (doc) => {
      firstScheduledCard(doc.blocks).sched!.due = '2026-07-04';
    });
    const after = await readDisk(WOZ);
    expect(after).toContain('## §1 — the premise, revised');
    expect(after).toContain('<!-- sr due=2026-07-04 st=review');
    expect(changedLines(edited, after)).toEqual([16]);
  });

  it('refuses a whole-doc overwrite when the file moved', async () => {
    const { doc } = await vault.read(WOZ);
    await disk.append(WOZ, '\nlate addition\n');
    await expect(vault.write(WOZ, doc)).rejects.toBeInstanceOf(VaultConflict);
    expect(await readDisk(WOZ)).toContain('late addition');
  });

  it('does not mistake its own write for an external change', async () => {
    const events: VaultEvent[] = [];
    vault.subscribe((ev) => events.push(ev));
    const written = await vault.update(WOZ, (doc) => {
      firstScheduledCard(doc.blocks).sched!.due = '2026-07-04';
    });
    // the write itself is reported once; the watcher's echo of it is not
    expect(events).toEqual([{ kind: 'doc', path: WOZ, loaded: written }]);
    await vault.changed([join(root, WOZ), join(root, `${WOZ}.ilmi-tmp`)]);
    expect(events).toHaveLength(1);
    expect(await vault.read(WOZ)).toBe(written);
  });
});

describe('external changes', () => {
  it('re-reads a changed file and reports it', async () => {
    const events: VaultEvent[] = [];
    vault.subscribe((ev) => events.push(ev));
    const before = await vault.read(WOZ);
    await disk.write(WOZ, before.text.replace('the premise', 'the PREMISE'));
    await vault.changed([join(root, WOZ)]);
    expect(events.map((e) => e.kind)).toEqual(['doc']);
    const after = await vault.read(WOZ);
    expect(after).not.toBe(before);
    expect(after.text).toContain('the PREMISE');
  });

  it('re-walks when files appear or disappear', async () => {
    const events: VaultEvent[] = [];
    vault.subscribe((ev) => events.push(ev));
    await vault.read('german.md');
    await disk.write('papers/new-paper.md', '# new\n');
    await disk.rm('german.md');
    await vault.changed(['papers/new-paper.md', 'german.md']);
    expect(events.map((e) => e.kind).sort()).toEqual(['gone', 'tree']);
    expect(vault.documents()).toContain('papers/new-paper.md');
    expect(vault.documents()).not.toContain('german.md');
  });

  it('reports dot-directory paths as hidden, and ignores temp files and paths outside the vault', async () => {
    const events: VaultEvent[] = [];
    vault.subscribe((ev) => events.push(ev));
    await vault.changed([join(root, '.ilmi/state.json'), join(root, 'x.md.ilmi-tmp'), '/elsewhere/y.md']);
    expect(events).toEqual([{ kind: 'hidden', paths: ['.ilmi/state.json'] }]);
    expect(vault.documents()).not.toContain('.ilmi/state.json');
  });

  it('shows up through the real watcher', async () => {
    const events: VaultEvent[] = [];
    vault.subscribe((ev) => events.push(ev));
    await vault.read(WOZ);
    await vault.watch();
    await new Promise((r) => setTimeout(r, 100));
    const before = await readDisk(WOZ);
    await disk.write(WOZ, before.replace('the premise', 'the PREMISE'));
    await vi.waitFor(() => expect(events.some((e) => e.kind === 'doc')).toBe(true), { timeout: 3000 });
    expect((await vault.read(WOZ)).text).toContain('the PREMISE');
  });
});

describe('state', () => {
  it('is empty when absent or malformed', async () => {
    expect(await vault.loadState()).toEqual({});
    await disk.mkdir('.ilmi');
    await disk.write('.ilmi/state.json', '{not json');
    expect(await vault.loadState()).toEqual({});
  });

  it('merges and round-trips', async () => {
    await vault.saveState({ folders: ['papers'] });
    await vault.saveState({ tab: 'german.md' });
    await vault.saveState({ budget: 12 });
    expect(await vault.loadState()).toEqual({ folders: ['papers'], tab: 'german.md', budget: 12 });
    expect(JSON.parse(await readDisk('.ilmi/state.json'))).toEqual({ folders: ['papers'], tab: 'german.md', budget: 12 });
    expect(names(await walk(disk.fs, root))).not.toContain('.ilmi/');
  });
});

// ── milestone 30: anything under anything, in an order you choose ──

const COURSE = 'courses/linear-algebra.md';
const onDisk = (rel: string) => disk.exists(rel);
const dirOnDisk = (rel: string) => disk.isDir(rel);

function nodeAt(nodes: TreeNode[], path: string): TreeNode | undefined {
  for (const n of nodes) {
    if (n.path === path) return n;
    const hit = nodeAt(n.kind === 'folder' ? n.children : n.children ?? [], path);
    if (hit) return hit;
  }
  return undefined;
}

const kidsOf = (path: string): string[] => {
  const n = nodeAt(vault.tree, path);
  return names(n?.kind === 'folder' ? n.children : n?.children ?? []);
};

describe('nesting', () => {
  it('walks a document whose children are a deck, a draft, and a folder', async () => {
    expect(kidsOf(COURSE)).toEqual(['unit-2/', 'problem-set-1', 'vectors']);
    expect(kidsOf('courses/linear-algebra/unit-2')).toEqual(['eigenvalues']);
    expect(meta((await vault.read('courses/linear-algebra/problem-set-1.md')).doc).type).toBe('deck');
    expect(meta((await vault.read('courses/linear-algebra/vectors.md')).doc).type).toBe('draft');
    expect(meta((await vault.read(COURSE)).doc).title).toBe('linear algebra');
    expect(vault.documents().filter((d) => d.startsWith('courses/'))).toEqual([
      COURSE,
      'courses/linear-algebra/unit-2/eigenvalues.md',
      'courses/linear-algebra/problem-set-1.md',
      'courses/linear-algebra/vectors.md',
    ]);
  });

  it('moves a deck into a source, its children directory made on demand', async () => {
    const SRC = 'books/james-pluralistic-ch4.md';
    expect(await onDisk('books/james-pluralistic-ch4')).toBe(false);
    const to = await vault.move(DECK, 'books/james-pluralistic-ch4');
    expect(to).toBe('books/james-pluralistic-ch4/german.md');
    expect(await dirOnDisk('books/james-pluralistic-ch4')).toBe(true);
    expect(kidsOf(SRC)).toEqual(['german']);
    expect(meta((await vault.read(to)).doc).type).toBe('deck');
    // place `into` a row is the same move
    expect(await vault.place('papers/archive', 'essays/spaced-composition.md', 'into')).toBe('essays/spaced-composition/archive');
    expect(kidsOf('essays/spaced-composition.md')).toEqual(['archive/']);
    expect(kidsOf('essays/spaced-composition/archive')).toEqual(['sutton-2019']);
  });

  it('carries a document\'s children directory and its PDF, and a sibling its pdf field names', async () => {
    const to = await vault.move('papers/two-pages.md', 'courses/linear-algebra');
    expect(to).toBe('courses/linear-algebra/two-pages.md');
    expect(await onDisk('courses/linear-algebra/two-pages.pdf')).toBe(true);
    expect(await onDisk('courses/linear-algebra/two-pages/the ruler in the margin.md')).toBe(true);
    expect(await onDisk('papers/two-pages.pdf')).toBe(false);
    expect(await onDisk('papers/two-pages')).toBe(false);
    expect(await vault.pagesOf(to)).toBe('courses/linear-algebra/two-pages.pdf');
    // a field naming a file that is not the stem's: it goes along too
    await disk.write('papers/scan.pdf', '%PDF-1.4\n');
    await vault.update('papers/crick-1995.md', (d) => setField(d, 'pdf', 'scan.pdf'));
    const crick = await vault.move('papers/crick-1995.md', 'essays');
    expect(await onDisk('essays/scan.pdf')).toBe(true);
    expect(await onDisk('papers/scan.pdf')).toBe(false);
    expect(await vault.pagesOf(crick)).toBe('essays/scan.pdf');
  });

  it('removes a children directory a move leaves empty, and keeps an empty folder', async () => {
    await vault.move('papers/wozniak-1990/woz-ex1.md', '');
    expect(await onDisk('papers/wozniak-1990')).toBe(false);
    expect(nodeAt(vault.tree, WOZ)).toMatchObject({ kind: 'doc' });
    expect((nodeAt(vault.tree, WOZ) as { children?: unknown }).children).toBeUndefined();
    // the extract's backref in the parent is unchanged by where its file sits
    expect((await readDisk(WOZ)).includes('<!-- extract woz-ex1 -->')).toBe(true);
    await vault.move('papers/archive/sutton-2019.md', '');
    expect(await dirOnDisk('papers/archive')).toBe(true);
    // a children directory whose last child is deleted goes too; a plain folder emptied the same way stays
    await vault.remove('papers/two-pages/the ruler in the margin.md');
    expect(await onDisk('papers/two-pages')).toBe(false);
    expect(await onDisk('papers/two-pages.pdf')).toBe(true);
    await vault.remove('courses/linear-algebra/unit-2/eigenvalues.md');
    expect(await dirOnDisk('courses/linear-algebra/unit-2')).toBe(true);
  });

  it('refuses to move a document into its own children', async () => {
    await expect(vault.move(COURSE, 'courses/linear-algebra/unit-2')).rejects.toThrow(/into itself/);
    await expect(vault.move(COURSE, 'courses/linear-algebra')).rejects.toThrow(/into itself/);
  });
});

describe('order', () => {
  const orderOnDisk = async () => JSON.parse(await readDisk('.ilmi/order.json')) as Record<string, string[]>;
  const shown = (dir: string) => names(ordered(childrenAt(vault.tree, dir) ?? [], vault.order[dir]));

  it('has none until one is set, and lists by the walk', async () => {
    expect(vault.order).toEqual({});
    expect(await onDisk('.ilmi/order.json')).toBe(false);
    expect(shown('courses/linear-algebra')).toEqual(['unit-2/', 'problem-set-1', 'vectors']);
  });

  it('writes a directory\'s order, names not listed following in the walk\'s order', async () => {
    await vault.setOrder('courses/linear-algebra', ['vectors.md', 'problem-set-1.md']);
    expect(await orderOnDisk()).toEqual({ 'courses/linear-algebra': ['vectors.md', 'problem-set-1.md'] });
    expect(shown('courses/linear-algebra')).toEqual(['vectors', 'problem-set-1', 'unit-2/']);
    // a new child arrives unlisted and follows
    await vault.createDoc('courses/linear-algebra', 'draft', 'a first unit');
    expect(shown('courses/linear-algebra')).toEqual(['vectors', 'problem-set-1', 'unit-2/', 'a first unit']);
    // reopened, it is read back
    const again = await Vault.open(disk.fs, root);
    expect(again.order).toEqual({ 'courses/linear-algebra': ['vectors.md', 'problem-set-1.md'] });
  });

  it('places before and after a row, writing the whole order', async () => {
    const events: VaultEvent[] = [];
    vault.subscribe((e) => events.push(e));
    await vault.place('courses/linear-algebra/vectors.md', 'courses/linear-algebra/unit-2', 'before');
    expect(shown('courses/linear-algebra')).toEqual(['vectors', 'unit-2/', 'problem-set-1']);
    await vault.place('courses/linear-algebra/unit-2', 'courses/linear-algebra/problem-set-1.md', 'after');
    expect(shown('courses/linear-algebra')).toEqual(['vectors', 'problem-set-1', 'unit-2/']);
    expect(await orderOnDisk()).toEqual({ 'courses/linear-algebra': ['vectors.md', 'problem-set-1.md', 'unit-2/'] });
    expect(events.filter((e) => e.kind === 'order')).toHaveLength(2);
    // from another directory: moved there and placed
    const to = await vault.place(DECK, 'courses/linear-algebra/problem-set-1.md', 'before');
    expect(to).toBe('courses/linear-algebra/german.md');
    expect(shown('courses/linear-algebra')).toEqual(['vectors', 'german', 'problem-set-1', 'unit-2/']);
  });

  it('drops listed names that no longer exist on the next write', async () => {
    await disk.mkdir('.ilmi');
    await disk.write('.ilmi/order.json', JSON.stringify({ 'courses/linear-algebra': ['gone.md', 'vectors.md'], 'no/such/dir': ['x.md'], '': ['papers/', 'nothing/'] }));
    vault = await Vault.open(disk.fs, root);
    // read as it is: the stale names wait for a write
    expect(vault.order['no/such/dir']).toEqual(['x.md']);
    expect(shown('courses/linear-algebra')).toEqual(['vectors', 'unit-2/', 'problem-set-1']);
    await vault.setOrder('essays', ['talk-incremental.md']);
    expect(await orderOnDisk()).toEqual({ 'courses/linear-algebra': ['vectors.md'], '': ['papers/'], essays: ['talk-incremental.md'] });
  });

  it('follows a rename in place, the parent\'s rename re-keying its children\'s order', async () => {
    await vault.setOrder('courses/linear-algebra', ['vectors.md', 'unit-2/', 'problem-set-1.md']);
    await vault.setOrder('courses', ['linear-algebra.md']);
    await vault.rename('courses/linear-algebra/vectors.md', 'unit 1');
    expect(vault.order['courses/linear-algebra']).toEqual(['unit 1.md', 'unit-2/', 'problem-set-1.md']);
    await vault.rename(COURSE, 'linear algebra I');
    expect(await orderOnDisk()).toEqual({
      'courses/linear algebra I': ['unit 1.md', 'unit-2/', 'problem-set-1.md'],
      courses: ['linear algebra I.md'],
    });
    expect(shown('courses/linear algebra I')).toEqual(['unit 1', 'unit-2/', 'problem-set-1']);
    // a folder's rename follows too, and a move out of a directory leaves its list
    await vault.rename('courses/linear algebra I/unit-2', 'unit 2');
    expect(vault.order['courses/linear algebra I']).toEqual(['unit 1.md', 'unit 2/', 'problem-set-1.md']);
    await vault.move('courses/linear algebra I/unit 1.md', '');
    expect(vault.order['courses/linear algebra I']).toEqual(['unit 2/', 'problem-set-1.md']);
    // sort by name: the order gone
    await vault.setOrder('courses/linear algebra I', null);
    expect(await orderOnDisk()).toEqual({ courses: ['linear algebra I.md'] });
  });

  it('forgets a deleted node, and follows the file edited by hand', async () => {
    await vault.setOrder('courses/linear-algebra', ['vectors.md', 'unit-2/']);
    await vault.remove('courses/linear-algebra/vectors.md');
    expect(vault.order['courses/linear-algebra']).toEqual(['unit-2/']);
    const events: VaultEvent[] = [];
    vault.subscribe((e) => events.push(e));
    await disk.write('.ilmi/order.json', JSON.stringify({ '': ['german.md'] }));
    await vault.changed([join(root, '.ilmi/order.json')]);
    expect(vault.order).toEqual({ '': ['german.md'] });
    expect(events.find((e) => e.kind === 'order')).toEqual({ kind: 'order', order: { '': ['german.md'] } });
    expect(names(ordered(vault.tree, vault.order[''])).slice(0, 2)).toEqual(['german', 'books/']);
  });
});

describe('order, pure', () => {
  const T: TreeNode[] = [
    { kind: 'folder', name: 'a', path: 'a', children: [] },
    { kind: 'doc', name: 'b', path: 'b.md', children: [{ kind: 'doc', name: 'c', path: 'b/c.md' }] },
    { kind: 'doc', name: 'd', path: 'd.md' },
  ];

  it('names entries, orders, prunes, and places', () => {
    expect(entryOf('x/y.md')).toBe('y.md');
    expect(entryOf('x/y')).toBe('y/');
    expect(names(ordered(T, ['d.md', 'gone.md', 'a/']))).toEqual(['d', 'a/', 'b']);
    expect(names(ordered(T, undefined))).toEqual(['a/', 'b', 'd']);
    expect([...directories(T).keys()]).toEqual(['', 'a', 'b']);
    expect(pruneOrder({ '': ['d.md', 'x.md'], b: ['c.md'], zz: ['q.md'], a: ['none.md'] }, T)).toEqual({ '': ['d.md'], b: ['c.md'] });
    expect(placeEntry(['a/', 'b.md', 'd.md'], 'd.md', 'a/', 'before')).toEqual(['d.md', 'a/', 'b.md']);
    expect(placeEntry(['a/', 'b.md', 'd.md'], 'a/', 'b.md', 'after')).toEqual(['b.md', 'a/', 'd.md']);
    expect(placeEntry(['a/'], 'n.md', 'missing.md', 'after')).toEqual(['a/', 'n.md']);
    expect(cleanOrder({ a: ['x.md', 'x.md', 3, ''], b: 'no', c: [] })).toEqual({ a: ['x.md'] });
    expect(cleanOrder([1])).toEqual({});
  });

  it('follows a move and forgets a removal', () => {
    const o = { '': ['b.md', 'a/'], b: ['c.md'], 'b/c': ['e.md'] };
    expect(followMove(o, 'b.md', 'z.md')).toEqual({ '': ['z.md', 'a/'], z: ['c.md'], 'z/c': ['e.md'] });
    expect(followMove(o, 'b.md', 'a/b.md')).toEqual({ '': ['a/'], 'a/b': ['c.md'], 'a/b/c': ['e.md'] });
    expect(forget(o, 'b.md')).toEqual({ '': ['a/'] });
  });
});
