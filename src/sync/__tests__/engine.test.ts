// The engine (milestone 61): collections over stores in memory, a storage
// in memory between them. Two copies made from the sample sync; a grade on
// each lands in the other; a card reworded on one and graded on the other
// is one card with both; one paragraph edited in two places merges by
// character and is listed; 53's merge cases restated for rows and text;
// and copies making random edits and syncing in random orders all end the
// same. Milestone 62, the tree: a rename against an edit, a move against a
// new child, two reorderings merged row by row, a move into its own
// descendant dropped alike everywhere, two rows of one name both shown;
// and the random test with renames, moves, reorders and deletes. Milestone
// 63: a copy that keeps the files it has opened holds no PDF until one is
// read; a file goes by the storage's own way where it has one; the change
// files fold into a snapshot, a new copy starts from it, and a copy that
// was away past the day its files were deleted takes it with what it had
// not sent; the random test with snapshots written and files deleted as
// it goes, and a copy that joins at the end. Milestone 58, ink: strokes
// two copies add to one page are all kept, each by its name, one erased
// is gone on both, a page deleted on one and drawn on on the other keeps
// the drawing; and the random test draws, erases and deletes pages.

import { promises as fsp } from 'node:fs';
import { tmpdir } from 'node:os';
import { join as joinPath } from 'node:path';
import { fileURLToPath } from 'node:url';
import { afterEach, describe, expect, it } from 'vitest';
import { formatReview, meta, parse, serialize, setField, type Card, type Doc, type Review } from '../../format/index.js';
import { Vault, importFolder, join, storeFs, type StoreFs } from '../../vault/index.js';
import { memPicture, memSplit, memStore, type MemStore } from '../../vault/mem-store.js';
import { nodeFs } from '../../vault/node-fs.js';
import { rising, type InkStroke } from '../../vault/store.js';
import { bothChanged, engine, frontLines, type Engine, type EngineOptions } from '../engine.js';
import { clock, msOf } from '../clock.js';
import { folderStorage, memStorage, type MemStorage, type Storage } from '../storage.js';

const SAMPLE = fileURLToPath(new URL('../../../samples/double-major', import.meta.url));
const CORPUS = fileURLToPath(new URL('../../format/__tests__/corpus/vault', import.meta.url));
const ROOT = '/collections/test';
const loro = () => import('loro-crdt');

interface Copy {
  name: string;
  store: MemStore;
  fs: StoreFs;
  eng: Engine;
  /** This copy's wall clock, in ms. */
  at: { ms: number };
  read(rel: string): Promise<string>;
  write(rel: string, text: string): Promise<void>;
  change(rel: string, fn: (doc: Doc) => void): Promise<void>;
  /** Every file it holds, by path: what an export would write. */
  files(): Promise<Map<string, string>>;
}

let made = 0;
const T0 = Date.parse('2026-11-05T09:00:00Z');

async function copy(name: string, from?: string, opts: Partial<EngineOptions> = {}): Promise<Copy> {
  const store = memStore();
  const fs = storeFs(store, ROOT);
  if (from) await importFolder(nodeFs, from, fs, ROOT);
  const at = { ms: T0 };
  const n = ++made;
  const eng = engine(fs, { loro, now: () => at.ms, newDevice: () => n.toString(16).padStart(16, '0'), ...opts });
  const read = (rel: string) => fs.readText(join(ROOT, rel));
  const write = (rel: string, text: string) => fs.writeText(join(ROOT, rel), text);
  return {
    name, store, fs, eng, at, read, write,
    async change(rel, fn) {
      const { doc } = parse(await read(rel));
      fn(doc);
      await write(rel, serialize(doc));
    },
    async files() {
      const out = new Map<string, string>();
      const visit = async (rel: string): Promise<void> => {
        for (const e of await fs.readDir(join(ROOT, rel))) {
          const path = rel ? `${rel}/${e.name}` : e.name;
          if (path === '.ilmi/state.json') continue;
          if (e.isDir) await visit(path);
          else out.set(path, Buffer.from(await fs.readBytes(join(ROOT, path))).toString('base64'));
        }
      };
      await visit('');
      return out;
    },
  };
}

const text = (b64: string | undefined): string => Buffer.from(b64 ?? '', 'base64').toString('utf8');

/** Every copy synced until none reads or writes anything more. */
async function settle(storage: MemStorage, copies: Copy[]): Promise<void> {
  for (let round = 0; round < 12; round++) {
    let moved = 0;
    for (const c of copies) {
      const r = await c.eng.sync(storage);
      moved += r.read + r.wrote + r.took;
    }
    if (!moved) return;
  }
  throw new Error('the copies never settled');
}

/** What differs between two copies' files, for a failure that says where. */
function differences(a: Map<string, string>, b: Map<string, string>): string[] {
  const out: string[] = [];
  for (const k of new Set([...a.keys(), ...b.keys()])) {
    if (a.get(k) === b.get(k)) continue;
    if (!a.has(k)) out.push(`${k}: only in the second`);
    else if (!b.has(k)) out.push(`${k}: only in the first`);
    else out.push(`${k}:\n--- first\n${text(a.get(k)).slice(0, 1500)}\n--- second\n${text(b.get(k)).slice(0, 1500)}`);
  }
  return out;
}

const cardOf = (doc: Doc, id: string): Card => {
  const c = doc.blocks.find((b): b is Card => b.kind === 'card' && b.id === id);
  if (!c) throw new Error(`no card ${id}`);
  return c;
};
const iso = (ms: number): string => new Date(ms).toISOString().replace(/\.\d+Z$/, 'Z');
/** A grade as the app writes one: the card's line with a later `last`, and a line of the log. */
async function grade(c: Copy, rel: string, id: string, g: number): Promise<void> {
  const last = iso(c.at.ms);
  const review: Review = { at: last, doc: rel, card: id, g, st: 'review', elapsed: 1, ivl: 1, next: 3, s: 3.2, d: 5, ms: 2000 } as Review;
  c.fs.logWith(rel, [review]);
  await c.change(rel, (doc) => {
    const card = cardOf(doc, id);
    card.sched = { ...card.sched, state: 'review', last, due: iso(c.at.ms + 3 * 86_400_000).slice(0, 10), reps: (card.sched?.reps ?? 0) + 1, grade: g, ivl: 3 };
  });
}
const srOf = (t: string, id: string): string | null => {
  const lines = t.split('\n');
  const i = lines.findIndex((l) => l.endsWith(`^${id}`));
  return i >= 0 && lines[i + 1]?.startsWith('<!-- sr') ? lines[i + 1]! : null;
};

const VOCAB = 'arabic/vocabulary.md';
const NOTE = 'fleeting/idea-for-honors-thesis.md';

/** Two copies of the sample: `a` imports it and makes the storage, `b` joins from the storage. */
async function pair(from = SAMPLE): Promise<{ a: Copy; b: Copy; storage: MemStorage }> {
  const storage = memStorage();
  const a = await copy('a', from);
  expect(await a.eng.connect(storage)).toBe('made');
  await a.eng.sync(storage);
  const b = await copy('b');
  expect(await b.eng.connect(storage)).toBe('joined');
  await b.eng.sync(storage);
  return { a, b, storage };
}

describe('the clock', () => {
  it('orders a device\'s own writes, and puts a write after any it has seen', () => {
    let t = 1000;
    const a = clock('aaaaaaaaaaaaaaaa', () => t);
    const s1 = a.tick();
    const s2 = a.tick();
    expect(s2 > s1).toBe(true);
    t = 2000;
    const s3 = a.tick();
    expect(s3 > s2 && msOf(s3) === 2000).toBe(true);
    // a device whose wall clock is behind still writes after what it has read
    const b = clock('bbbbbbbbbbbbbbbb', () => 500);
    b.see(s3);
    expect(b.tick() > s3).toBe(true);
    // and picks up where it left off
    const again = clock('bbbbbbbbbbbbbbbb', () => 100, b.last());
    expect(again.tick() > b.last()).toBe(true);
  });
});

describe('a collection and a storage', () => {
  it('a second copy made from the storage holds what the first holds', async () => {
    const { a, b, storage } = await pair();
    const fa = await a.files();
    const fb = await b.files();
    expect(fb.size).toBe(fa.size);
    // the order came in written by hand, one line an array; the copy writes it as the app does
    expect(JSON.parse(text(fb.get('.ilmi/order.json')))).toEqual(JSON.parse(text(fa.get('.ilmi/order.json'))));
    fa.delete('.ilmi/order.json');
    fb.delete('.ilmi/order.json');
    expect(differences(fa, fb)).toEqual([]);
    // the storage: what it is, each device's own files, the PDFs whole
    expect([...storage.files.keys()].some((p) => p === 'format')).toBe(true);
    expect([...storage.files.keys()].filter((p) => p.startsWith('devices/')).every((p) => p.startsWith(`devices/${a.eng.device()}/`))).toBe(true);
    expect([...storage.files.keys()].filter((p) => p.startsWith('blobs/')).length).toBe(a.store.blobs.size);
    // nothing more to say either way
    expect(await a.eng.sync(storage)).toMatchObject({ read: 0, wrote: 0 });
    expect(await b.eng.sync(storage)).toMatchObject({ read: 0, wrote: 0 });
    expect(await b.eng.waiting()).toBe(0);
  }, 60_000);

  it('a collection that does not sync records nothing', async () => {
    const a = await copy('a', CORPUS);
    await a.change('german.md', (doc) => { doc.blocks.push({ kind: 'paragraph', text: 'added' }); });
    expect(await a.eng.on()).toBe(false);
    expect(a.store.tables.regs.size + a.store.tables.outbox.size + a.store.tables.crdt.size + a.store.tables.meta.size).toBe(0);
  });

  it('a storage that holds another collection is refused, and a collection joins only empty', async () => {
    const storage = memStorage();
    const a = await copy('a', CORPUS);
    await a.eng.connect(storage);
    const other = await copy('other', CORPUS);
    await expect(other.eng.connect(storage)).rejects.toThrow('another collection');
    await expect(other.eng.sync(storage)).rejects.toThrow('no storage');
    expect(await a.eng.connect(storage)).toBe('connected');
    await a.eng.sync(storage);
    await expect(a.eng.connect(memStorage())).rejects.toThrow('another storage');
    // a copy restored from before its last sync does not write over what it sent
    await a.change('german.md', (doc) => { doc.blocks.push({ kind: 'paragraph', text: 'added' }); });
    await a.eng.sync(storage);
    const dev = a.eng.device()!;
    storage.files.set(`devices/${dev}/99`, new Uint8Array());
    await expect(a.eng.sync(storage)).rejects.toThrow('older than what it has sent');
  });

  it('a card with a schedule and no id is given one when the collection first syncs', async () => {
    const storage = memStorage();
    const a = await copy('a');
    await a.write('deck.md', 'q :: a\n<!-- sr due=2026-11-07 st=review last=2026-11-01T08:00:00Z -->\n\nplain :: card\n');
    await a.eng.connect(storage);
    const t = await a.read('deck.md');
    expect(t).toMatch(/^q :: a \^c[a-z0-9]{6}\n<!-- sr due=2026-11-07/);
    expect(t).toContain('\nplain :: card\n');
    await a.eng.sync(storage);
    const b = await copy('b');
    await b.eng.connect(storage);
    await b.eng.sync(storage);
    expect(await b.read('deck.md')).toBe(t);
  });
});

describe('two copies of the sample', () => {
  it('a grade on each lands in the other, and the log has both', async () => {
    const { a, b, storage } = await pair();
    a.at.ms += 60_000;
    await grade(a, VOCAB, 'voc-karam', 3);
    b.at.ms += 120_000;
    await grade(b, VOCAB, 'voc-dayf', 4);
    // a grade leaves the text alone: nothing of the document's text is a change
    expect(await a.eng.waiting()).toBe(1);
    await settle(storage, [a, b]);
    const ta = await a.read(VOCAB);
    expect(await b.read(VOCAB)).toBe(ta);
    expect(srOf(ta, 'voc-karam')).toContain(`last=${iso(T0 + 60_000)}`);
    expect(srOf(ta, 'voc-dayf')).toContain(`last=${iso(T0 + 120_000)}`);
    const log = await a.read('.ilmi/reviews/2026-11.jsonl');
    expect(log).toContain('"card":"voc-karam"');
    expect(log).toContain('"card":"voc-dayf"');
    expect((await b.read('.ilmi/reviews/2026-11.jsonl')).split('\n').sort()).toEqual(log.split('\n').sort());
    // the index follows a merge: the queue reads the grade without the document parsed again
    const digests = await b.fs.digests();
    expect(cardOf(digests.get(VOCAB)!, 'voc-karam').sched?.last).toBe(iso(T0 + 60_000));
  }, 60_000);

  it('the same card graded on both keeps the later review, whichever syncs first', async () => {
    for (const first of ['a', 'b'] as const) {
      const { a, b, storage } = await pair();
      a.at.ms += 60_000;
      await grade(a, VOCAB, 'voc-naqa', 2);
      b.at.ms += 3_600_000;
      await grade(b, VOCAB, 'voc-naqa', 4);
      await settle(storage, first === 'a' ? [a, b] : [b, a]);
      const ta = await a.read(VOCAB);
      expect(await b.read(VOCAB)).toBe(ta);
      expect(srOf(ta, 'voc-naqa')).toContain('g=4');
      expect(srOf(ta, 'voc-naqa')).toContain(`last=${iso(T0 + 3_600_000)}`);
    }
  }, 60_000);

  it('a review wins over a later change to the schedule that is not one (53\'s rule)', async () => {
    const { a, b, storage } = await pair();
    a.at.ms += 60_000;
    await grade(a, VOCAB, 'voc-naqa', 3);
    // an hour later, on the copy that has not seen the grade: the card's priority set
    b.at.ms += 3_600_000;
    await b.change(VOCAB, (doc) => { const c = cardOf(doc, 'voc-naqa'); c.sched = { ...c.sched, pri: 90 }; });
    await settle(storage, [b, a]);
    const line = srOf(await a.read(VOCAB), 'voc-naqa')!;
    expect(line).toContain(`last=${iso(T0 + 60_000)}`);
    expect(line).not.toContain('pri=90');
    expect(await b.read(VOCAB)).toBe(await a.read(VOCAB));
  }, 60_000);

  it('a card reworded on one and graded on the other is one card with both', async () => {
    const { a, b, storage } = await pair();
    const before = cardOf(parse(await a.read(VOCAB)).doc, 'voc-karam').text;
    a.at.ms += 60_000;
    await a.change(VOCAB, (doc) => { const c = cardOf(doc, 'voc-karam'); c.text = `${c.text} (reworded)`; });
    b.at.ms += 120_000;
    await grade(b, VOCAB, 'voc-karam', 3);
    await settle(storage, [a, b]);
    const ta = await a.read(VOCAB);
    expect(await b.read(VOCAB)).toBe(ta);
    const cards = parse(ta).doc.blocks.filter((x): x is Card => x.kind === 'card' && x.text.startsWith(before));
    expect(cards.length).toBe(1);
    expect(cards[0]!.text).toBe(`${before} (reworded)`);
    expect(cards[0]!.id).toBe('voc-karam');
    expect(cards[0]!.sched?.last).toBe(iso(T0 + 120_000));
  }, 60_000);

  it('one paragraph edited in two places merges by character, and is listed', async () => {
    const { a, b, storage } = await pair();
    await a.change(NOTE, (doc) => { for (const x of doc.blocks) if (x.kind === 'paragraph') x.text = x.text.replace('Ask both.', 'Ask both, soon.'); });
    await b.change(NOTE, (doc) => { for (const x of doc.blocks) if (x.kind === 'paragraph') x.text = x.text.replace('Deadline for the proposal is February.', 'Deadline for the proposal is February, firm.'); });
    const ra = await a.eng.sync(storage);
    expect(ra.kept).toEqual([]);
    const rb = await b.eng.sync(storage);
    expect(rb.kept).toEqual([{ path: NOTE, heading: 'idea for honors thesis' }]);
    expect(rb.changed).toEqual([NOTE]);
    const merged = await b.read(NOTE);
    expect(merged).toContain('Ask both, soon.');
    expect(merged).toContain('February, firm.');
    // one paragraph, not two versions of it
    expect(merged.split('\n').filter((l) => l.startsWith('Advisors:')).length).toBe(1);
    const back = await a.eng.sync(storage);
    expect(back.kept).toEqual([{ path: NOTE, heading: 'idea for honors thesis' }]);
    expect(await a.read(NOTE)).toBe(merged);
    // an edit made knowing of the other's is no conflict
    await a.change(NOTE, (doc) => { doc.blocks.push({ kind: 'paragraph', text: 'One more line.' }); });
    await a.eng.sync(storage);
    expect((await b.eng.sync(storage)).kept).toEqual([]);
    expect(await b.read(NOTE)).toBe(await a.read(NOTE));
  }, 60_000);

  it('edits to different paragraphs of one document both land, and nothing is listed', async () => {
    const { a, b, storage } = await pair();
    await a.change(NOTE, (doc) => { doc.blocks.unshift({ kind: 'paragraph', text: 'A line at the top.' }); });
    await b.change(NOTE, (doc) => { doc.blocks.push({ kind: 'paragraph', text: 'A line at the end.' }); });
    await a.eng.sync(storage);
    expect((await b.eng.sync(storage)).kept).toEqual([]);
    await a.eng.sync(storage);
    const t = await a.read(NOTE);
    expect(await b.read(NOTE)).toBe(t);
    expect(t).toContain('A line at the top.');
    expect(t).toContain('A line at the end.');
  }, 60_000);

  it('a field set on each: both when they differ, the later write when they are one', async () => {
    const { a, b, storage } = await pair();
    a.at.ms += 60_000;
    await a.change(NOTE, (doc) => setField(doc, 'pri', 80));
    b.at.ms += 120_000;
    await b.change(NOTE, (doc) => setField(doc, 'title', 'the thesis'));
    await settle(storage, [a, b]);
    let m = meta(parse(await a.read(NOTE)).doc);
    expect([m.pri, m.title]).toEqual([80, 'the thesis']);
    expect(await b.read(NOTE)).toBe(await a.read(NOTE));
    a.at.ms += 60_000;
    await a.change(NOTE, (doc) => setField(doc, 'pri', 10));
    b.at.ms += 60_000;
    await b.change(NOTE, (doc) => setField(doc, 'pri', 55));
    await settle(storage, [b, a]);
    m = meta(parse(await a.read(NOTE)).doc);
    expect(m.pri).toBe(55);
    expect(await b.read(NOTE)).toBe(await a.read(NOTE));
    // a field taken off on one, another put on by the other
    await a.change(NOTE, (doc) => setField(doc, 'pri', null));
    await b.change(NOTE, (doc) => setField(doc, 'frozen', true));
    await settle(storage, [a, b]);
    m = meta(parse(await b.read(NOTE)).doc);
    expect([m.pri, m.frozen]).toEqual([undefined, true]);
    expect(await b.read(NOTE)).toBe(await a.read(NOTE));
  }, 60_000);

  it('a pass on each lands in the other', async () => {
    const { a, b, storage } = await pair();
    const MERCHANT = 'library/classical-prose-reader/15-the-merchant-who-was-robbed.md';
    const QASIDA = 'courses/fall-2026/arab-455-abbasid-poetry/clipped-on-translating-the-qasida.md';
    await a.change(MERCHANT, (doc) => setField(doc, 'read', { ...meta(doc).read, due: '2026-11-09', pos: 3 }));
    await b.change(QASIDA, (doc) => setField(doc, 'read', { ...meta(doc).read, due: '2026-11-12', pos: 5 }));
    await settle(storage, [a, b]);
    expect(meta(parse(await b.read(MERCHANT)).doc).read).toMatchObject({ due: '2026-11-09', pos: 3 });
    expect(meta(parse(await a.read(QASIDA)).doc).read).toMatchObject({ due: '2026-11-12', pos: 5 });
    expect(differences(await a.files(), await b.files()).filter((d) => !d.startsWith('.ilmi/order.json'))).toEqual([]);
  }, 60_000);
});

describe('53\'s merge cases, for rows and text', () => {
  it('a document edited on one and deleted on the other keeps the edit, whoever deleted', async () => {
    const { a, b, storage } = await pair(CORPUS);
    await a.change('german.md', (doc) => { doc.blocks.push({ kind: 'paragraph', text: 'kept by the edit' }); });
    await b.fs.remove(join(ROOT, 'german.md'));
    await settle(storage, [a, b]);
    expect(await a.read('german.md')).toContain('kept by the edit');
    expect(await b.read('german.md')).toBe(await a.read('german.md'));
    // a grade is an edit too
    const { a: c, b: d, storage: s2 } = await pair(CORPUS);
    await d.change('german.md', (doc) => { const card = doc.blocks.find((x): x is Card => x.kind === 'card' && !!x.sched)!; card.sched = { ...card.sched, last: iso(T0 + 1000) }; });
    await c.fs.remove(join(ROOT, 'german.md'));
    await settle(s2, [c, d]);
    expect(await c.read('german.md')).toBe(await d.read('german.md'));
    expect(await c.read('german.md')).toContain(`last=${iso(T0 + 1000)}`);
    // a delete the other had nothing against is a delete on both
    await c.fs.remove(join(ROOT, 'german.md'));
    await settle(s2, [c, d]);
    expect(await d.fs.stat(join(ROOT, 'german.md'))).toBeNull();
    expect(differences(await c.files(), await d.files())).toEqual([]);
  });

  it('a folder deleted on one with a document changed under it on the other keeps the document and what it is under', async () => {
    const { a, b, storage } = await pair(CORPUS);
    const under = [...(await a.files()).keys()].filter((p) => p.startsWith('papers/') && p.endsWith('.md'));
    expect(under.length).toBeGreaterThan(1);
    const kept = under[0]!;
    await a.fs.remove(join(ROOT, 'papers'));
    await b.change(kept, (doc) => { doc.blocks.push({ kind: 'paragraph', text: 'still here' }); });
    await settle(storage, [a, b]);
    const fa = await a.files();
    expect(differences(fa, await b.files())).toEqual([]);
    expect(text(fa.get(kept))).toContain('still here');
    // the rest of the folder went, as it was deleted
    expect([...fa.keys()].filter((p) => p.startsWith('papers/') && p.endsWith('.md') && !kept.startsWith(`${p.replace(/\.md$/, '')}/`))).toEqual([kept]);
    // and once the document goes too, nothing holds its folder
    await b.fs.remove(join(ROOT, kept));
    await settle(storage, [b, a]);
    expect(await a.fs.stat(join(ROOT, 'papers'))).toBeNull();
    expect(await b.fs.stat(join(ROOT, 'papers'))).toBeNull();
  });

  it('a new document, a new folder, a rename and a move each land', async () => {
    const { a, b, storage } = await pair(CORPUS);
    await a.fs.mkdir(join(ROOT, 'new folder'));
    await a.write('new folder/first.md', '---\ntype: draft\n---\n\nA first line.\n');
    await b.fs.rename(join(ROOT, 'german.md'), join(ROOT, 'deutsch.md'));
    await settle(storage, [a, b]);
    expect(await b.read('new folder/first.md')).toBe('---\ntype: draft\n---\n\nA first line.\n');
    expect(await a.read('deutsch.md')).toBe(await b.read('deutsch.md'));
    expect(await a.fs.stat(join(ROOT, 'german.md'))).toBeNull();
    // a rename on one with an edit on the other: one document, renamed, with the edit
    await a.fs.rename(join(ROOT, 'deutsch.md'), join(ROOT, 'new folder/deutsch.md'));
    await b.change('deutsch.md', (doc) => { doc.blocks.push({ kind: 'paragraph', text: 'edited where it was' }); });
    await settle(storage, [a, b]);
    expect(await b.fs.stat(join(ROOT, 'deutsch.md'))).toBeNull();
    expect(await a.read('new folder/deutsch.md')).toContain('edited where it was');
    expect(differences(await a.files(), await b.files())).toEqual([]);
  });

  it('the order merges row by row, the pairs and the log are unioned, a file replaced on both is the later one', async () => {
    const { a, b, storage } = await pair(CORPUS);
    const order = (names: string[]) => `${JSON.stringify({ '': names }, null, 2)}\n`;
    // the top as it is shown with no order chosen: folders first, then documents
    const top = ['books/', 'courses/', 'essays/', 'fleeting/', 'papers/', 'german.md'];
    expect((await a.fs.readDir(ROOT)).filter((e) => !e.name.startsWith('.')).map((e) => (e.isDir ? `${e.name}/` : e.name)).sort()).toEqual([...top].sort());
    // one turns the whole directory round; the other, later, takes `papers/` to the front, which puts it before `books/`
    const fronted = ['papers/', ...top.filter((n) => n !== 'papers/')];
    a.at.ms += 60_000;
    await a.write('.ilmi/order.json', order([...top].reverse()));
    b.at.ms += 120_000;
    await b.write('.ilmi/order.json', order(fronted));
    // the row both moved is where the later put it, before `books/`; every other row is where the one that moved it put it
    const merged = ['german.md', 'fleeting/', 'essays/', 'courses/', 'papers/', 'books/'];
    await a.write('.ilmi/same.json', `${JSON.stringify({ not: ['a|b'] }, null, 2)}\n`);
    await b.write('.ilmi/same.json', `${JSON.stringify({ not: ['c|d'] }, null, 2)}\n`);
    const line = (card: string, at: string): string => formatReview({ at, doc: 'german.md', card, g: 3, st: 'review', elapsed: 1, ivl: 1, next: 2, s: 2, d: 5 } as Review);
    await a.fs.appendText!(join(ROOT, '.ilmi/reviews/2026-11.jsonl'), `${line('one', '2026-11-05T09:00:00Z')}\n`);
    await b.fs.appendText!(join(ROOT, '.ilmi/reviews/2026-11.jsonl'), `${line('two', '2026-11-05T09:00:01Z')}\n`);
    await a.fs.writeBytes(join(ROOT, 'papers/figure.png'), new Uint8Array([0, 255]));
    await settle(storage, [a, b]);
    expect([...(await b.fs.readBytes(join(ROOT, 'papers/figure.png')))]).toEqual([0, 255]);
    a.at.ms += 60_000;
    await a.fs.writeBytes(join(ROOT, 'papers/figure.png'), new Uint8Array([1, 2, 3, 255]));
    b.at.ms += 60_000;
    await b.fs.writeBytes(join(ROOT, 'papers/figure.png'), new Uint8Array([9, 8, 7, 255, 254]));
    await settle(storage, [a, b]);
    const fa = await a.files();
    expect(differences(fa, await b.files())).toEqual([]);
    expect((JSON.parse(text(fa.get('.ilmi/order.json'))) as Record<string, string[]>)['']).toEqual(merged);
    expect(JSON.parse(text(fa.get('.ilmi/same.json')))).toEqual({ not: ['a|b', 'c|d'] });
    const log = text(fa.get('.ilmi/reviews/2026-11.jsonl'));
    expect(log).toContain('"card":"one"');
    expect(log).toContain('"card":"two"');
    expect([...Buffer.from(fa.get('papers/figure.png')!, 'base64')]).toEqual([9, 8, 7, 255, 254]);
    // a pair taken back on one is taken back on both
    await a.write('.ilmi/same.json', `${JSON.stringify({ not: ['c|d'] }, null, 2)}\n`);
    await settle(storage, [a, b]);
    expect(JSON.parse(await b.read('.ilmi/same.json'))).toEqual({ not: ['c|d'] });
  });

  it('two devices that each make the same hidden file have made one', async () => {
    const { a, b, storage } = await pair(CORPUS);
    a.at.ms += 1000;
    await a.fs.mkdir(join(ROOT, '.ilmi/plugins/made-apart'));
    await a.write('.ilmi/plugins/made-apart/data.json', '{"from":"a"}\n');
    b.at.ms += 2000;
    await b.fs.mkdir(join(ROOT, '.ilmi/plugins/made-apart'));
    await b.write('.ilmi/plugins/made-apart/data.json', '{"from":"b"}\n');
    // the view state is each device's own
    await a.write('.ilmi/state.json', '{"tab":"a"}\n');
    await b.write('.ilmi/state.json', '{"tab":"b"}\n');
    await settle(storage, [a, b]);
    expect(await a.read('.ilmi/plugins/made-apart/data.json')).toBe('{"from":"b"}\n');
    expect(differences(await a.files(), await b.files())).toEqual([]);
    expect((await a.fs.readDir(join(ROOT, '.ilmi/plugins'))).map((e) => e.name).filter((n) => n === 'made-apart')).toEqual(['made-apart']);
    expect((await a.fs.readDir(join(ROOT, '.ilmi/plugins/made-apart'))).map((e) => e.name)).toEqual(['data.json']);
    expect(await a.read('.ilmi/state.json')).toBe('{"tab":"a"}\n');
    expect(await b.read('.ilmi/state.json')).toBe('{"tab":"b"}\n');
  });
});

describe('the tree (milestone 62)', () => {
  const LA = 'courses/linear-algebra';
  const under = (files: Map<string, string>, dir: string): string[] => [...files.keys()].filter((p) => p.startsWith(dir)).sort();
  /** A third copy made from the storage now: it reads every change at once, in the storage's order. */
  const joined = async (storage: MemStorage): Promise<Copy> => {
    const c = await copy('c');
    await c.eng.connect(storage);
    await c.eng.sync(storage);
    return c;
  };

  it('a rename on one with an edit and a new child on the other: one document, renamed, its children with it', async () => {
    const { a, b, storage } = await pair(CORPUS);
    await a.fs.rename(join(ROOT, `${LA}.md`), join(ROOT, 'courses/algebra.md'));
    await b.change(`${LA}.md`, (doc) => { doc.blocks.push({ kind: 'paragraph', text: 'edited under its old name' }); });
    await b.write(`${LA}/made on b.md`, 'Made under the old name.\n');
    const told: string[] = [];
    const stop = await b.fs.watch!(ROOT, (paths) => { told.push(...paths); });
    await settle(storage, [a, b]);
    const fa = await a.files();
    expect(differences(fa, await b.files())).toEqual([]);
    expect(text(fa.get('courses/algebra.md'))).toContain('edited under its old name');
    // whoever watches is told the order's file reads otherwise: it names rows by their paths (the window check found it stale)
    await new Promise((r) => setTimeout(r, 80));
    stop();
    expect(told).toContain(join(ROOT, '.ilmi/order.json'));
    expect(told).toContain(join(ROOT, 'courses/algebra.md'));
    expect(under(fa, 'courses/')).toEqual(['courses/algebra.md', 'courses/algebra/made on b.md', 'courses/algebra/problem-set-1.md', 'courses/algebra/unit-2/eigenvalues.md', 'courses/algebra/vectors.md']);
    expect(differences(fa, await (await joined(storage)).files())).toEqual([]);
  });

  it('a move on one with a new child and an edit on the other: one tree, in its new place, nothing twice and nothing lost', async () => {
    const { a, b, storage } = await pair(CORPUS);
    const before = (await a.files()).size;
    // a folder, and a document with a child, each moved on one copy
    await a.fs.rename(join(ROOT, 'papers/archive'), join(ROOT, 'essays/archive'));
    await a.fs.rename(join(ROOT, 'papers/wozniak-1990.md'), join(ROOT, 'books/wozniak-1990.md'));
    // and on the other, where they still are: a new child in each, and an edit under the folder
    await b.write('papers/archive/made on b.md', 'In the folder, where b has it.\n');
    await b.write('papers/wozniak-1990/second extract.md', 'Under the document, where b has it.\n');
    await b.change('papers/archive/sutton-2019.md', (doc) => { doc.blocks.push({ kind: 'paragraph', text: 'edited where it was' }); });
    await settle(storage, [b, a]);
    const fa = await a.files();
    expect(differences(fa, await b.files())).toEqual([]);
    expect(fa.size).toBe(before + 2);
    expect(under(fa, 'essays/archive')).toEqual(['essays/archive/made on b.md', 'essays/archive/sutton-2019.md']);
    expect(text(fa.get('essays/archive/sutton-2019.md'))).toContain('edited where it was');
    expect(under(fa, 'books/wozniak-1990')).toEqual(['books/wozniak-1990.md', 'books/wozniak-1990/second extract.md', 'books/wozniak-1990/woz-ex1.md']);
    expect(under(fa, 'papers/archive')).toEqual([]);
    expect(under(fa, 'papers/wozniak-1990')).toEqual([]);
    expect(differences(fa, await (await joined(storage)).files())).toEqual([]);
  });

  it('two reorderings of one directory merge move by move: the first each makes, and the ones after', async () => {
    const { a, b, storage } = await pair(CORPUS);
    // (the note with the corpus's page of ink, milestone 58, sorts last there and is never dragged: it is left out of the lists)
    const shown = async (c: Copy): Promise<string[]> => ((JSON.parse(await c.read('.ilmi/order.json')) as Record<string, string[]>)['fleeting'] ?? []).filter((n) => n !== 'worked-example.md');
    const drag = async (c: Copy, name: string, target: string, mode: 'before' | 'after'): Promise<void> => {
      const vault = await Vault.open(c.fs, ROOT);
      await vault.place(`fleeting/${name}.md`, `fleeting/${target}.md`, mode);
    };
    // the directory has no order yet: each copy drags one row, and each drag writes the whole list
    a.at.ms += 60_000;
    await drag(a, 'office-hours', '2026-05-26', 'before');
    b.at.ms += 120_000;
    await drag(b, '2026-05-26', 'lecture-9', 'after');
    expect(await shown(a)).toEqual(['office-hours.md', '2026-05-26.md', '2026-05-27.md', 'clipped-page.md', 'lecture-9.md', 'markdown-sampler.md']);
    expect(await shown(b)).toEqual(['2026-05-27.md', 'clipped-page.md', 'lecture-9.md', '2026-05-26.md', 'markdown-sampler.md', 'office-hours.md']);
    // a row a drag did not move is not a change another device's move of it loses to: one change a drag, beside the places the rest were shown at
    await settle(storage, [a, b]);
    const both = ['office-hours.md', '2026-05-27.md', 'clipped-page.md', 'lecture-9.md', '2026-05-26.md', 'markdown-sampler.md'];
    expect(await shown(a)).toEqual(both);
    expect(await shown(b)).toEqual(both);
    // again, now that every row has a place: a drag is one row's change
    a.at.ms += 60_000;
    const waiting = await a.eng.waiting();
    await drag(a, 'markdown-sampler', 'clipped-page', 'before');
    expect(await a.eng.waiting()).toBe(waiting + 1);
    const sent = [...a.store.tables.outbox.values()].pop()!;
    expect((JSON.parse(sent) as { ops: unknown[] }).ops.length).toBe(1);
    b.at.ms += 60_000;
    await drag(b, '2026-05-27', 'markdown-sampler', 'after');
    await settle(storage, [b, a]);
    const again = ['office-hours.md', 'markdown-sampler.md', 'clipped-page.md', 'lecture-9.md', '2026-05-26.md', '2026-05-27.md'];
    expect(await shown(a)).toEqual(again);
    expect(await shown(b)).toEqual(again);
    // one row dragged on both: where the later drag put it
    a.at.ms += 60_000;
    await drag(a, 'lecture-9', 'office-hours', 'before');
    b.at.ms += 120_000;
    await drag(b, 'lecture-9', '2026-05-27', 'after');
    await settle(storage, [a, b]);
    expect(await shown(a)).toEqual(['office-hours.md', 'markdown-sampler.md', 'clipped-page.md', '2026-05-26.md', '2026-05-27.md', 'lecture-9.md']);
    expect(differences(await a.files(), await b.files())).toEqual([]);
    const c = await joined(storage);
    expect(await shown(c)).toEqual(await shown(a));
    // a row moved out on one and dragged on the other: it is where it was moved to, with no place there
    a.at.ms += 60_000;
    await a.fs.rename(join(ROOT, 'fleeting/clipped-page.md'), join(ROOT, 'essays/clipped-page.md'));
    b.at.ms += 120_000;
    await drag(b, 'clipped-page', '2026-05-27', 'after');
    await settle(storage, [a, b, c]);
    for (const x of [a, b, c]) {
      expect(await shown(x), x.name).toEqual(['office-hours.md', 'markdown-sampler.md', '2026-05-26.md', '2026-05-27.md', 'lecture-9.md']);
      expect(JSON.parse(await x.read('.ilmi/order.json')), x.name).not.toHaveProperty('essays');
      expect(await x.fs.stat(join(ROOT, 'essays/clipped-page.md')), x.name).not.toBeNull();
    }
  });

  it('a move into its own descendant is dropped alike on every device, whichever syncs first', async () => {
    for (const first of ['a', 'b'] as const) {
      const { a, b, storage } = await pair(CORPUS);
      // each puts one folder inside the other; the later move is the one that would close the loop
      a.at.ms += 60_000;
      await a.fs.rename(join(ROOT, 'papers'), join(ROOT, 'essays/papers'));
      b.at.ms += 120_000;
      await b.fs.rename(join(ROOT, 'essays'), join(ROOT, 'papers/essays'));
      await settle(storage, first === 'a' ? [a, b] : [b, a]);
      const fa = await a.files();
      expect(differences(fa, await b.files())).toEqual([]);
      // a's stands; b's is dropped, and its folder is where it was moved from
      expect(fa.has('essays/papers/maxwell.md')).toBe(true);
      expect(fa.has('essays/marginalia.md')).toBe(true);
      expect(under(fa, 'papers/')).toEqual([]);
      const c = await joined(storage);
      expect(differences(fa, await c.files())).toEqual([]);
      // dropped is dropped: when the other folder is taken back out, the move does not come back
      await a.fs.rename(join(ROOT, 'essays/papers'), join(ROOT, 'papers'));
      await settle(storage, [a, b, c]);
      for (const x of [a, b, c]) {
        const f = await x.files();
        expect(f.has('papers/maxwell.md'), x.name).toBe(true);
        expect(f.has('essays/marginalia.md'), x.name).toBe(true);
      }
      expect(differences(await a.files(), await c.files())).toEqual([]);
    }
  });

  it('three moves round a ring: one is dropped, and a row moved from inside a folder goes back into it', async () => {
    const { a, b, storage } = await pair(CORPUS);
    const c = await joined(storage);
    // books → courses → essays → papers/archive → …, and papers/archive is moved under books on the third copy, last
    a.at.ms += 60_000;
    await a.fs.rename(join(ROOT, 'books'), join(ROOT, 'courses/books'));
    b.at.ms += 120_000;
    await b.fs.rename(join(ROOT, 'courses'), join(ROOT, 'papers/archive/courses'));
    c.at.ms += 180_000;
    await c.fs.rename(join(ROOT, 'papers/archive'), join(ROOT, 'books/archive'));
    await settle(storage, [c, a, b]);
    const fa = await a.files();
    expect(differences(fa, await b.files())).toEqual([]);
    expect(differences(fa, await c.files())).toEqual([]);
    // the last move is the one dropped: the archive is back in papers, with the other two inside it
    expect(fa.has('papers/archive/sutton-2019.md')).toBe(true);
    expect(fa.has('papers/archive/courses/books/james-pluralistic-ch4.md')).toBe(true);
    expect(fa.has(`papers/archive/${LA}.md`)).toBe(true);
    expect(differences(fa, await (await joined(storage)).files())).toEqual([]);
  });

  it('a ring of folders each deleted after its move comes back whole for a document edited under one, and is no ring', async () => {
    const { a, b, storage } = await pair(CORPUS);
    const c = await joined(storage);
    // on a third copy a document under one folder is edited, and that is in the storage before the others look
    await c.change('books/james-pluralistic-ch4.md', (doc) => { doc.blocks.push({ kind: 'paragraph', text: 'edited while its folder was deleted' }); });
    await c.eng.sync(storage);
    // each of the others puts one folder in the other and then deletes the one it moved: two deletes that had each
    // seen a move, and the moves make a ring of rows that are in no tree when the edit brings them back
    await a.fs.rename(join(ROOT, 'books'), join(ROOT, 'essays/books'));
    await a.fs.remove(join(ROOT, 'essays/books'));
    await b.fs.rename(join(ROOT, 'essays'), join(ROOT, 'books/essays'));
    await b.fs.remove(join(ROOT, 'books/essays'));
    await settle(storage, [a, b, c]);
    const fa = await a.files();
    expect(differences(fa, await b.files())).toEqual([]);
    expect(differences(fa, await c.files())).toEqual([]);
    const kept = [...fa.keys()].filter((p) => p.endsWith('james-pluralistic-ch4.md'));
    expect(kept.length).toBe(1);
    expect(kept[0]!.split('/').length).toBeLessThan(5);
    expect(text(fa.get(kept[0]!))).toContain('edited while its folder was deleted');
    expect(differences(fa, await (await joined(storage)).files())).toEqual([]);
  });

  it('two rows made with one name in one place are both shown, the same way on every device, until one is gone', async () => {
    const { a, b, storage } = await pair(CORPUS);
    await a.write('essays/notes.md', 'Made on a.\n');
    await b.write('essays/notes.md', 'Made on b.\n');
    await a.fs.mkdir(join(ROOT, 'inbox'));
    await a.write('inbox/from a.md', 'In a\'s inbox.\n');
    await b.fs.mkdir(join(ROOT, 'inbox'));
    await b.write('inbox/from b.md', 'In b\'s inbox.\n');
    await a.fs.writeBytes(join(ROOT, 'papers/figure.png'), new Uint8Array([1, 255]));
    await b.fs.writeBytes(join(ROOT, 'papers/figure.png'), new Uint8Array([2, 255]));
    await settle(storage, [a, b]);
    const fa = await a.files();
    expect(differences(fa, await b.files())).toEqual([]);
    expect([text(fa.get('essays/notes.md')), text(fa.get('essays/notes 2.md'))].sort()).toEqual(['Made on a.\n', 'Made on b.\n']);
    expect(under(fa, 'inbox')).toHaveLength(2);
    expect(under(fa, 'inbox').map((p) => p.split('/')[0]).sort()).toEqual(['inbox', 'inbox 2']);
    expect(fa.has('papers/figure.png') && fa.has('papers/figure 2.png')).toBe(true);
    const c = await joined(storage);
    expect(differences(fa, await c.files())).toEqual([]);
    // an edit to the one shown numbered is an edit, not a rename: it is still `notes` underneath
    const second = text(fa.get('essays/notes 2.md'));
    await b.change('essays/notes 2.md', (doc) => { doc.blocks.push({ kind: 'paragraph', text: 'More.' }); });
    await settle(storage, [a, b, c]);
    expect(await a.read('essays/notes 2.md')).toBe(`${second}\nMore.\n`);
    // the first renamed away, on a copy that then syncs: the other is shown by its own name again, everywhere
    await a.fs.rename(join(ROOT, 'essays/notes.md'), join(ROOT, 'essays/first notes.md'));
    await settle(storage, [a, b, c]);
    for (const x of [a, b, c]) {
      expect(await x.read('essays/notes.md'), x.name).toBe(`${second}\nMore.\n`);
      expect(await x.fs.stat(join(ROOT, 'essays/notes 2.md')), x.name).toBeNull();
    }
    expect(differences(await a.files(), await b.files())).toEqual([]);
    expect(differences(await a.files(), await c.files())).toEqual([]);
    // a row shown numbered that is moved keeps the name it was shown by
    const numberedInbox = under(await b.files(), 'inbox 2/')[0]!;
    await b.fs.rename(join(ROOT, 'inbox 2'), join(ROOT, 'essays/inbox 2'));
    await settle(storage, [b, a, c]);
    for (const x of [a, b, c]) expect((await x.files()).has(`essays/${numberedInbox}`), x.name).toBe(true);
    expect(differences(await a.files(), await c.files())).toEqual([]);
  });

  it('a rename on one and a new row of that name on the other: both shown', async () => {
    const { a, b, storage } = await pair(CORPUS);
    await a.fs.rename(join(ROOT, 'german.md'), join(ROOT, 'deutsch.md'));
    await b.write('deutsch.md', 'Made on b under the name a chose.\n');
    await settle(storage, [a, b]);
    const fa = await a.files();
    expect(differences(fa, await b.files())).toEqual([]);
    expect(fa.has('german.md')).toBe(false);
    const two = [text(fa.get('deutsch.md')), text(fa.get('deutsch 2.md'))];
    expect(two.some((t) => t === 'Made on b under the name a chose.\n')).toBe(true);
    expect(two.some((t) => t.includes('cv-wdh'))).toBe(true);
  });

  it('the longest run that rises stays', () => {
    expect([...rising([0, 1, 2, 3])].sort()).toEqual([0, 1, 2, 3]);
    expect([...rising([3, 0, 1, 2])].sort()).toEqual([1, 2, 3]);
    expect([...rising([1, 2, 0, 3])].sort()).toEqual([0, 1, 3]);
    expect(rising([2, 2, 2]).size).toBe(1);
    expect(rising([]).size).toBe(0);
  });
});

describe('the storage', () => {
  it('a folder on disk: each device\'s files written once, read by the other, and nothing half-written listed', async () => {
    const dir = await fsp.mkdtemp(joinPath(tmpdir(), 'ilmi-storage-'));
    try {
      const storage = folderStorage(nodeFs, dir);
      expect(await storage.list('devices/')).toEqual([]);
      expect(await storage.read('format')).toBeNull();
      const a = await copy('a', CORPUS);
      await a.eng.connect(storage);
      await a.eng.sync(storage);
      const b = await copy('b');
      expect(await b.eng.connect(storage)).toBe('joined');
      await b.eng.sync(storage);
      await grade(b, 'german.md', 'cv-wdh', 3);
      await b.eng.sync(storage);
      await a.eng.sync(storage);
      expect(await a.read('german.md')).toBe(await b.read('german.md'));
      expect((await fsp.readdir(dir)).sort()).toEqual(['blobs', 'devices', 'format']);
      expect((await fsp.readdir(joinPath(dir, 'devices'))).sort()).toEqual([a.eng.device()!, b.eng.device()!].sort());
      // a file still being written is not one yet
      await fsp.writeFile(joinPath(dir, 'devices', a.eng.device()!, '99.part'), 'half');
      expect((await storage.list('devices/')).some((p) => p.includes('99'))).toBe(false);
      await storage.remove(`devices/${b.eng.device()}/1`);
      expect(await storage.read(`devices/${b.eng.device()}/1`)).toBeNull();
    } finally {
      await fsp.rm(dir, { recursive: true, force: true });
    }
  });

  it('a write cut short is made again as the same file, and is merged once', async () => {
    const { a, b, storage } = await pair(CORPUS);
    await grade(a, 'german.md', 'cv-wdh', 3);
    // the file reaches the storage and the device never hears that it did
    const write = storage.write.bind(storage);
    let cut = true;
    storage.write = async (path, bytes) => {
      await write(path, bytes);
      if (cut && path.startsWith('devices/')) { cut = false; throw new Error('the line dropped'); }
    };
    await expect(a.eng.sync(storage)).rejects.toThrow('the line dropped');
    const path = [...storage.files.keys()].filter((p) => p.startsWith(`devices/${a.eng.device()}/`)).sort((x, y) => Number(x.split('/')[2]) - Number(y.split('/')[2])).pop()!;
    const first = Buffer.from(storage.files.get(path)!).toString();
    // more is written before the next sync: it goes into the file after, not into the one already out
    a.at.ms += 60_000;
    await grade(a, 'german.md', 'cv-vorsatz', 4);
    expect((await a.eng.sync(storage)).wrote).toBe(2);
    expect(Buffer.from(storage.files.get(path)!).toString()).toBe(first);
    await b.eng.sync(storage);
    expect(await b.read('german.md')).toBe(await a.read('german.md'));
    expect((await b.read('.ilmi/reviews/2026-11.jsonl')).split('\n').filter((l) => l.includes('"cv-wdh"')).length).toBe(1);
    expect(await a.eng.waiting()).toBe(0);
  });

  it('a file is merged only once everything its writer had read is here', async () => {
    const { a, b, storage } = await pair(CORPUS);
    const c = await copy('c');
    await c.eng.connect(storage);
    await c.eng.sync(storage);
    // a makes a folder; b, having read it, puts a document in it
    await a.fs.mkdir(join(ROOT, 'made by a'));
    await a.eng.sync(storage);
    await b.eng.sync(storage);
    await b.write('made by a/from b.md', 'In the folder a made.\n');
    await b.eng.sync(storage);
    // c's listing shows b's file and not yet a's (a storage that is slow to show a file)
    const hidden = [...storage.files.keys()].filter((p) => p.startsWith(`devices/${a.eng.device()}/`)).sort((x, y) => Number(x.split('/')[2]) - Number(y.split('/')[2])).pop()!;
    const list = storage.list.bind(storage);
    storage.list = async (prefix) => (await list(prefix)).filter((p) => p !== hidden);
    expect((await c.eng.sync(storage)).read).toBe(0);
    expect(await c.fs.stat(join(ROOT, 'made by a'))).toBeNull();
    storage.list = list;
    expect((await c.eng.sync(storage)).read).toBe(2);
    expect(await c.read('made by a/from b.md')).toBe('In the folder a made.\n');
  });
});

describe('the pieces', () => {
  it('a front matter block as lines, each found by its key', () => {
    expect(frontLines('---\ntype: source\ntitle: "a: b"\ntags:\n  - x\n  - x\n---\n')).toEqual([
      { lid: 'type', line: 'type: source' },
      { lid: 'title', line: 'title: "a: b"' },
      { lid: 'tags', line: 'tags:' },
      { lid: '#  - x', line: '  - x' },
      { lid: '#  - x\n2', line: '  - x' },
    ]);
    expect(frontLines('')).toEqual([]);
    expect(frontLines('---\n---\n')).toEqual([]);
  });

  it('the blocks both sides changed, by the heading above', () => {
    const base = '# one\n\nfirst\n\n## two\n\nsecond\n\nthird\n';
    expect(bothChanged(base, base.replace('second', 'second, ours'), base.replace('second', 'second, theirs'))).toEqual(['two']);
    expect(bothChanged(base, base.replace('first', 'first, ours'), base.replace('third', 'third, theirs'))).toEqual([]);
    expect(bothChanged('plain\n', 'plain ours\n', 'plain theirs\n')).toEqual([null]);
    expect(bothChanged(base, base.replace('second', 'same'), base.replace('second', 'same'))).toEqual([]);
  });
});

// ── copies making random edits, syncing in random orders ──────────

describe('ink (milestone 58)', () => {
  const PAGE = join(ROOT, 'german/ink-01.pkdrawing');
  const PICTURE = join(ROOT, 'german/ink-01.png');
  const stroke = (n: number): InkStroke => ({ stroke: `s${n}`, at: 1000 + n, data: Buffer.from(`stroke ${n}`).toString('base64') });
  const keys = async (c: Copy, page = PAGE): Promise<string[] | null> => (await c.fs.ink(page))?.map((x) => x.stroke) ?? null;

  it('strokes two copies add to one page are all kept, each by its name; one erased is gone on both', async () => {
    const { a, b, storage } = await pair(CORPUS);
    await a.fs.setInk(PAGE, [stroke(1), stroke(2)]);
    await settle(storage, [a, b]);
    expect(await keys(b)).toEqual(['s1', 's2']);
    expect(await b.fs.readBytes(PICTURE)).toEqual(memPicture([stroke(1), stroke(2)]));
    // each draws on it apart: the canvas gives back the strokes it was opened with and the new one
    a.at.ms += 60_000;
    await a.fs.setInk(PAGE, [...memSplit(await a.fs.readBytes(PAGE)), stroke(3)]);
    b.at.ms += 90_000;
    await b.fs.setInk(PAGE, [...memSplit(await b.fs.readBytes(PAGE)), stroke(4)]);
    await settle(storage, [b, a]);
    expect(await keys(a)).toEqual(['s1', 's2', 's3', 's4']);
    expect(differences(await a.files(), await b.files())).toEqual([]);
    // one erases a stroke while the other adds one: the erased one is gone on both and the new one is there
    a.at.ms += 60_000;
    await a.fs.setInk(PAGE, (await a.fs.ink(PAGE))!.filter((x) => x.stroke !== 's1'));
    b.at.ms += 60_000;
    await b.fs.setInk(PAGE, [...(await b.fs.ink(PAGE))!, stroke(5)]);
    await settle(storage, [a, b]);
    expect(await keys(a)).toEqual(['s2', 's3', 's4', 's5']);
    expect(await keys(b)).toEqual(['s2', 's3', 's4', 's5']);
    // both erase one: gone, once. Erased and drawn again (an undo after a save): there, by the later of the two
    a.at.ms += 60_000;
    b.at.ms += 60_000;
    await a.fs.setInk(PAGE, (await a.fs.ink(PAGE))!.filter((x) => x.stroke !== 's2'));
    await b.fs.setInk(PAGE, (await b.fs.ink(PAGE))!.filter((x) => x.stroke !== 's2' && x.stroke !== 's3'));
    b.at.ms += 60_000;
    await b.fs.setInk(PAGE, [...(await b.fs.ink(PAGE))!, stroke(3)]);
    await settle(storage, [a, b]);
    expect(await keys(a)).toEqual(['s3', 's4', 's5']);
    expect(differences(await a.files(), await b.files())).toEqual([]);
    // a stroke's bytes crossed whole
    expect((await a.fs.ink(PAGE))!.find((x) => x.stroke === 's5')).toEqual(stroke(5));
  });

  it('a page deleted on one copy and drawn on on the other keeps the drawing, whole; deleted on both it is gone', async () => {
    const { a, b, storage } = await pair(CORPUS);
    await a.fs.setInk(PAGE, [stroke(1), stroke(2)]);
    await settle(storage, [a, b]);
    await a.fs.remove(PAGE);
    expect(await keys(a)).toBeNull();
    b.at.ms += 60_000;
    await b.fs.setInk(PAGE, [...(await b.fs.ink(PAGE))!, stroke(3)]);
    await settle(storage, [a, b]);
    expect(await keys(a)).toEqual(['s1', 's2', 's3']);
    expect(differences(await a.files(), await b.files())).toEqual([]);
    await b.fs.remove(PAGE);
    await settle(storage, [a, b]);
    expect(await a.fs.stat(PAGE)).toBeNull();
    expect(await a.fs.stat(PICTURE)).toBeNull();
    expect(differences(await a.files(), await b.files())).toEqual([]);
  });

  it('a collection that holds pages takes them to its storage, a drawing kept as a file becomes strokes on both, and a copy made from a snapshot has them', async () => {
    const opts = { snapAfter: 3, snapWorth: 2 };
    const storage = memStorage();
    const a = await copy('a', CORPUS, opts);
    await a.fs.setInk(PAGE, [stroke(1), stroke(2)]);
    expect(await a.eng.connect(storage)).toBe('made');
    await a.eng.sync(storage);
    const b = await copy('b', undefined, opts);
    await b.eng.connect(storage);
    await b.eng.sync(storage);
    expect(await keys(b)).toEqual(['s1', 's2']);
    // the corpus's page came in as two files; drawn on, it is strokes, and its picture is no file on either
    const kept = join(ROOT, 'fleeting/worked-example/ink-01.pkdrawing');
    expect(await keys(a, kept)).toBeNull();
    for (let n = 10; n < 16; n++) {
      a.at.ms += 60_000;
      await a.fs.setInk(kept, [...((await a.fs.ink(kept)) ?? []), stroke(n)]);
      await a.eng.sync(storage);
    }
    await settle(storage, [a, b]);
    expect(await keys(b, kept)).toEqual(['s10', 's11', 's12', 's13', 's14', 's15']);
    expect(await b.fs.readBytes(join(ROOT, 'fleeting/worked-example/ink-01.png'))).toEqual(memPicture([10, 11, 12, 13, 14, 15].map(stroke)));
    expect(differences(await a.files(), await b.files())).toEqual([]);
    expect((await storage.list('snapshots/')).length).toBeGreaterThan(0);
    const c = await copy('c', undefined, opts);
    await c.eng.connect(storage);
    const got = await c.eng.sync(storage);
    expect(got.took).toBeGreaterThan(0);
    await settle(storage, [a, b, c]);
    expect(await keys(c)).toEqual(['s1', 's2']);
    expect(await keys(c, kept)).toEqual(['s10', 's11', 's12', 's13', 's14', 's15']);
    expect(differences(await a.files(), await c.files())).toEqual([]);
    // a collection that does not sync keeps strokes and records nothing
    const alone = await copy('alone', CORPUS);
    await alone.fs.setInk(PAGE, [stroke(1)]);
    expect(alone.store.tables.regs.size).toBe(0);
  });
});

function rng(seed: number): () => number {
  let s = seed >>> 0;
  return () => {
    s = (s + 0x6d2b79f5) >>> 0;
    let t = s;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

describe('big files and snapshots (milestone 63)', () => {
  const BOOK = 'library/classical-prose-reader.pdf';
  const OTHER = 'library/lindqvist-statistical-physics.pdf';
  /** What differs between two copies, the order's file read for what it says (the copy that imported it keeps it as it came, 60's rule). */
  const apart = async (x: Copy, y: Copy): Promise<string[]> => {
    const [fx, fy] = [await x.files(), await y.files()];
    const order = (f: Map<string, string>): string => JSON.stringify(Object.entries(JSON.parse(text(f.get('.ilmi/order.json')) || '{}') as Record<string, string[]>).sort(([p], [q]) => (p < q ? -1 : 1)));
    const out = order(fx) === order(fy) ? [] : [`.ilmi/order.json:\n${order(fx)}\n${order(fy)}`];
    fx.delete('.ilmi/order.json');
    fy.delete('.ilmi/order.json');
    return [...out, ...differences(fx, fy)];
  };
  const docsOf = async (c: Copy): Promise<Map<string, string>> => {
    const out = new Map<string, string>();
    for (const r of c.fs.door.rows()) if (r.kind === 'doc') out.set(c.fs.door.pathOf(r), await c.read(c.fs.door.pathOf(r)));
    return out;
  };

  it('a copy that keeps what it has opened holds no PDF until one is read', async () => {
    const storage = memStorage();
    const a = await copy('a', SAMPLE);
    await a.eng.connect(storage);
    await a.eng.sync(storage);
    const b = await copy('b', undefined, { keep: () => 'opened' });
    await b.eng.connect(storage);
    await b.eng.sync(storage);
    expect(b.store.blobs.size).toBe(0);
    expect(b.fs.away()).toEqual([BOOK, OTHER]);
    expect(b.fs.isAway(join(ROOT, BOOK))).toBe(true);
    expect(await b.eng.away()).toHaveLength(2);
    // the row is there, and says how big its file is
    expect((await b.fs.stat(join(ROOT, BOOK)))?.size).toBe((await a.fs.stat(join(ROOT, BOOK)))?.size);
    expect(await docsOf(b)).toEqual(await docsOf(a));
    // with no way to the storage a read says the file is not here
    await expect(b.fs.readBytes(join(ROOT, BOOK))).rejects.toThrow('not here');
    // with one, the read brings it, and only it
    const told: string[] = [];
    await b.fs.watch(ROOT, (paths) => told.push(...paths));
    b.fs.door.fetcher(async (hash) => { await b.eng.fetch(storage, hash); });
    const [one, two] = await Promise.all([b.fs.readBytes(join(ROOT, BOOK)), b.fs.readBytes(join(ROOT, BOOK))]);
    expect(Buffer.from(one!).equals(Buffer.from(await a.fs.readBytes(join(ROOT, BOOK))))).toBe(true);
    expect(two!.length).toBe(one!.length);
    expect(b.store.blobs.size).toBe(1);
    expect(b.fs.away()).toEqual([OTHER]);
    await new Promise((r) => setTimeout(r, 60));
    expect(told).toContain(join(ROOT, BOOK));
    // a sync fetches nothing more
    await b.eng.sync(storage);
    expect(b.store.blobs.size).toBe(1);
    // a copy that keeps every file has them after its sync
    const c = await copy('c');
    await c.eng.connect(storage);
    await c.eng.sync(storage);
    expect(c.store.blobs.size).toBe(2);
    expect(c.fs.away()).toEqual([]);
    expect(await apart(a, c)).toEqual([]);
  });

  it('a book whose PDF is not here is deleted, put back and copied without its bytes', async () => {
    const storage = memStorage();
    const a = await copy('a', SAMPLE);
    await a.eng.connect(storage);
    await a.eng.sync(storage);
    const b = await copy('b', undefined, { keep: () => 'opened' });
    await b.eng.connect(storage);
    await b.eng.sync(storage);
    let fetched = 0;
    b.fs.door.fetcher(async (hash) => { fetched += 1; await b.eng.fetch(storage, hash); });
    const vault = await Vault.open(b.fs, ROOT);
    const removed = await vault.remove('library/classical-prose-reader.md');
    expect(removed.files.find((f) => f.path === BOOK)?.ref).toMatch(/^[0-9a-f]{64}$/);
    expect(await b.fs.stat(join(ROOT, BOOK))).toBeNull();
    await vault.restore(removed);
    expect(b.fs.away()).toEqual([BOOK, OTHER]);
    const dup = await vault.duplicate('library/lindqvist-statistical-physics.md');
    expect(b.fs.away()).toEqual([BOOK, dup.replace(/\.md$/, '.pdf'), OTHER].sort());
    expect(fetched).toBe(0);
    expect(b.store.blobs.size).toBe(0);
    // and the other copy has the book again, and the copy of the other, with their pages
    await settle(storage, [b, a]);
    expect(Buffer.from(await a.fs.readBytes(join(ROOT, dup.replace(/\.md$/, '.pdf')))).equals(Buffer.from(await a.fs.readBytes(join(ROOT, OTHER))))).toBe(true);
    expect((await a.fs.stat(join(ROOT, BOOK)))?.size).toBeGreaterThan(1000);
  });

  it('a file whose bytes are not in the storage yet is named all the same, and comes when they are', async () => {
    const { a, b, storage } = await pair();
    const bytes = new Uint8Array(70_000).map((_, i) => (i * 31) % 251);
    await a.fs.writeBytes(join(ROOT, 'library/scan.pdf'), bytes);
    await a.eng.sync(storage);
    const path = [...storage.files.keys()].filter((p) => p.startsWith('blobs/')).find((p) => storage.files.get(p)!.length === bytes.length)!;
    const held = storage.files.get(path)!;
    storage.files.delete(path);
    const r = await b.eng.sync(storage);
    expect(r.read).toBe(1);
    expect(b.fs.away()).toEqual(['library/scan.pdf']);
    expect((await b.fs.stat(join(ROOT, 'library/scan.pdf')))?.size).toBe(bytes.length);
    expect(await b.eng.fetchAll(storage)).toEqual({ fetched: 0, left: 1 });
    // a file that is not what its name says is not kept
    storage.files.set(path, new Uint8Array([1, 2, 3]));
    await expect(b.eng.fetch(storage, path.slice('blobs/'.length))).rejects.toThrow('not what its name says');
    expect(b.fs.away()).toEqual(['library/scan.pdf']);
    storage.files.set(path, held);
    await b.eng.sync(storage);
    expect(b.fs.away()).toEqual([]);
    expect(Buffer.from(await b.fs.readBytes(join(ROOT, 'library/scan.pdf'))).equals(Buffer.from(bytes))).toBe(true);
  });

  it('a storage with its own way for files is given them by name, and the engine never holds their bytes', async () => {
    const storage = memStorage();
    const a = await copy('a', SAMPLE);
    const b = await copy('b');
    const ups: string[] = [];
    const downs: string[] = [];
    const wrote: string[] = [];
    const reads: string[] = [];
    const tracked: Storage = {
      list: (p) => storage.list(p),
      read: (p) => { reads.push(p); return storage.read(p); },
      write: (p, bytes) => { wrote.push(p); return storage.write(p, bytes); },
      remove: (p) => storage.remove(p),
    };
    const sa: Storage = { ...tracked, up: async (hash) => { ups.push(hash); storage.files.set(`blobs/${hash}`, a.store.blobs.get(hash)!); } };
    const sb: Storage = { ...tracked, down: async (hash) => { downs.push(hash); const bytes = storage.files.get(`blobs/${hash}`); if (!bytes) return false; await b.store.blobPut(bytes); return true; } };
    await a.eng.connect(sa);
    await a.eng.sync(sa);
    expect(ups).toHaveLength(2);
    expect(a.store.calls.blobGet).toBe(0);
    expect(wrote.filter((p) => p.startsWith('blobs/'))).toEqual([]);
    await b.eng.connect(sb);
    await b.eng.sync(sb);
    expect(downs.sort()).toEqual([...ups].sort());
    expect(reads.filter((p) => p.startsWith('blobs/'))).toEqual([]);
    expect(await apart(a, b)).toEqual([]);
  });

  it('the change files fold into a snapshot when they pass a count, and a new copy starts from it', async () => {
    const opts = { snapAfter: 6, snapWorth: 3 };
    const storage = memStorage();
    const a = await copy('a', SAMPLE, opts);
    await a.eng.connect(storage);
    await a.eng.sync(storage);
    const b = await copy('b', undefined, opts);
    await b.eng.connect(storage);
    await b.eng.sync(storage);
    const before = [...storage.files.keys()].filter((p) => p.startsWith('devices/')).length;
    let snapped = 0;
    for (let i = 0; i < 6 && !snapped; i++) {
      a.at.ms += 60_000;
      b.at.ms += 60_000;
      await grade(a, VOCAB, 'voc-karam', 3);
      await b.change('arabic/roots.md', (doc) => { doc.blocks.push({ kind: 'paragraph', text: `A thought b had, ${i}.` }); });
      // a folder moved into another and a document deleted: a snapshot carries the tree and what is gone from it
      if (i === 0) await a.fs.rename(join(ROOT, 'fleeting'), join(ROOT, 'physics/fleeting'));
      if (i === 1) await b.fs.remove(join(ROOT, 'physics/derivation-drills.md'));
      for (const c of [a, b, a]) if ((await c.eng.sync(storage)).snapped) snapped += 1;
    }
    expect(snapped).toBe(1);
    const heads = [...storage.files.keys()].filter((p) => /^snapshots\/[0-9a-f]+\/1\/head$/.test(p));
    expect(heads).toHaveLength(1);
    const head = JSON.parse(text(Buffer.from(storage.files.get(heads[0]!)!).toString('base64'))) as { covers: Record<string, number>; parts: number };
    const all = [...storage.files.keys()].filter((p) => p.startsWith('devices/'));
    expect(all.length).toBeGreaterThan(before);
    // it covers every file there was when it was written, which had passed the count
    const covered = Object.values(head.covers).reduce((x, y) => x + y, 0);
    expect(covered).toBeGreaterThanOrEqual(opts.snapAfter);
    expect(covered).toBeLessThanOrEqual(all.length);
    await settle(storage, [a, b]);
    // a new copy reads the snapshot and none of the files it covers, and has nothing of its own to say
    const reads: string[] = [];
    const tracked: Storage = { ...storage, list: (p) => storage.list(p), read: (p) => { reads.push(p); return storage.read(p); }, write: (p, x) => storage.write(p, x), remove: (p) => storage.remove(p) };
    const c = await copy('c', undefined, opts);
    c.at.ms = a.at.ms;
    await c.eng.connect(tracked);
    const r = await c.eng.sync(tracked);
    expect(r.took).toBe(1);
    expect(r.wrote).toBe(0);
    for (const p of reads.filter((x) => x.startsWith('devices/'))) {
      const [, dev, n] = p.split('/');
      expect(Number(n), p).toBeGreaterThan(head.covers[dev!] ?? 0);
    }
    expect(await apart(a, c)).toEqual([]);
    expect(await apart(a, b)).toEqual([]);
    expect([...(await c.files()).keys()].some((p) => p.startsWith('physics/fleeting/'))).toBe(true);
    expect(await c.fs.stat(join(ROOT, 'physics/derivation-drills.md'))).toBeNull();
    const paths = (x: Copy): string[] => x.fs.door.rows().map((r) => x.fs.door.pathOf(r)).filter((q) => q !== '.ilmi/state.json').sort();
    expect(paths(c)).toEqual(paths(a));
    // a copy that holds all a snapshot covers has no use for it
    expect((await a.eng.sync(storage)).took).toBe(0);
    // and what the new copy does from here on reaches the others
    await grade(c, VOCAB, 'voc-dayf', 4);
    await settle(storage, [c, a, b]);
    expect(srOf(await a.read(VOCAB), 'voc-dayf')).toBe(srOf(await c.read(VOCAB), 'voc-dayf'));
    expect(await apart(a, c)).toEqual([]);
  });

  it('what a snapshot covers is deleted thirty days on, and a copy that was away takes the snapshot with what it had not sent', async () => {
    const opts = { snapAfter: 5, snapWorth: 50 };
    const DAY = 86_400_000;
    const storage = memStorage();
    const a = await copy('a', SAMPLE, opts);
    await a.eng.connect(storage);
    await a.eng.sync(storage);
    const b = await copy('b', undefined, opts);
    const c = await copy('c', undefined, opts);
    for (const x of [b, c]) { await x.eng.connect(storage); await x.eng.sync(storage); }
    // c goes away with work it has not sent: a grade, a paragraph changed, a document made, a rename
    await grade(c, VOCAB, 'voc-dayf', 4);
    await c.change(NOTE, (doc) => { const p = doc.blocks.find((x) => x.kind === 'paragraph')!; (p as { text: string }).text += ' And c thought so too, while away.'; });
    await c.write('fleeting/written-away.md', '---\ntype: draft\n---\n\nWritten on a train.\n');
    await c.fs.rename(join(ROOT, 'physics/derivation-drills.md'), join(ROOT, 'physics/drills.md'));
    // meanwhile a and b work, and one of them writes a snapshot
    let snapped = 0;
    for (let i = 0; i < 8 && !snapped; i++) {
      a.at.ms += 60_000;
      b.at.ms += 60_000;
      await grade(a, VOCAB, 'voc-karam', 3);
      await b.change(NOTE, (doc) => { const p = doc.blocks.find((x) => x.kind === 'paragraph')!; (p as { text: string }).text = `Meanwhile b began it otherwise (${i}). ${(p as { text: string }).text}`; });
      await a.change('physics/derivation-drills.md', (doc) => { doc.blocks.push({ kind: 'paragraph', text: `a kept drilling, ${i}.` }); });
      for (const x of [a, b, a]) if ((await x.eng.sync(storage)).snapped) snapped += 1;
    }
    expect(snapped).toBe(1);
    const devices = (): string[] => [...storage.files.keys()].filter((p) => p.startsWith('devices/'));
    const had = devices().length;
    // twenty-nine days on, every file is still there
    for (const x of [a, b]) x.at.ms += 29 * DAY;
    expect((await a.eng.sync(storage)).dropped).toBe(0);
    expect(devices().length).toBe(had);
    // on the thirty-first, what the snapshot covers goes
    for (const x of [a, b]) x.at.ms += 2 * DAY;
    const tidied = await b.eng.sync(storage);
    expect(tidied.dropped).toBeGreaterThanOrEqual(had - 2);
    expect(devices().length).toBeLessThanOrEqual(2);
    await settle(storage, [a, b]);
    expect(await apart(a, b)).toEqual([]);
    // c comes back: the files it had not read are gone, the snapshot is there
    c.at.ms += 31 * DAY + 600_000;
    const back = await c.eng.sync(storage);
    expect(back.took).toBe(1);
    expect(back.wrote).toBeGreaterThanOrEqual(1);
    await settle(storage, [a, b, c]);
    expect(await apart(a, c)).toEqual([]);
    expect(await apart(a, b)).toEqual([]);
    // nothing of c's is lost and nothing of the others'
    const note = await a.read(NOTE);
    expect(note).toContain('And c thought so too, while away.');
    expect(note).toContain('Meanwhile b began it otherwise (0).');
    expect(await a.read('fleeting/written-away.md')).toContain('Written on a train.');
    expect(srOf(await a.read(VOCAB), 'voc-dayf')).toBe(srOf(await c.read(VOCAB), 'voc-dayf'));
    expect(srOf(await c.read(VOCAB), 'voc-karam')).toBe(srOf(await a.read(VOCAB), 'voc-karam'));
    // the rename c made and the paragraphs a added to the document are one document
    expect(await a.fs.stat(join(ROOT, 'physics/derivation-drills.md'))).toBeNull();
    expect(await b.read('physics/drills.md')).toContain('a kept drilling, 0.');
    // a later snapshot covers the first, which goes with what it covered thirty days after
    for (let i = 0; i < 8; i++) {
      for (const x of [a, b, c]) x.at.ms += 60_000;
      await grade(a, VOCAB, 'voc-naqa', 3);
      await grade(b, VOCAB, 'voc-akrama', 3);
      for (const x of [a, b, c, a]) await x.eng.sync(storage);
    }
    const snapshots = (): string[] => [...storage.files.keys()].filter((p) => /^snapshots\/.*\/head$/.test(p));
    expect(snapshots().length).toBeGreaterThanOrEqual(2);
    for (const x of [a, b, c]) x.at.ms += 31 * DAY;
    await settle(storage, [a, b, c]);
    await a.eng.sync(storage);
    expect(snapshots().length).toBeGreaterThanOrEqual(1);
    expect(snapshots().length).toBeLessThan(3);
    // a copy made now starts from what is left, and is the same collection
    const d = await copy('d', undefined, opts);
    d.at.ms = a.at.ms;
    await d.eng.connect(storage);
    await d.eng.sync(storage);
    await settle(storage, [a, b, c, d]);
    expect(await apart(a, d)).toEqual([]);
  });

  it('a file read while it is still being written is not taken for whole', async () => {
    const { a, b, storage } = await pair();
    await grade(a, VOCAB, 'voc-karam', 3);
    await a.change(NOTE, (doc) => { doc.blocks.push({ kind: 'paragraph', text: 'A second write, for a second line.' }); });
    await a.eng.sync(storage);
    const path = [...storage.files.keys()].filter((p) => p.startsWith('devices/')).sort().pop()!;
    const whole = storage.files.get(path)!;
    const lines = Buffer.from(whole).toString('utf8').split('\n');
    expect(lines.length).toBeGreaterThanOrEqual(4);
    // cut at the end of a line: every line of it reads, and it is one short
    storage.files.set(path, new Uint8Array(Buffer.from(`${lines.slice(0, 2).join('\n')}\n`)));
    expect((await b.eng.sync(storage)).read).toBe(0);
    expect(srOf(await b.read(VOCAB), 'voc-karam')).not.toBe(srOf(await a.read(VOCAB), 'voc-karam'));
    storage.files.set(path, whole);
    expect((await b.eng.sync(storage)).read).toBe(1);
    expect(await apart(a, b)).toEqual([]);
  });
});

describe('copies making random edits and syncing in random orders', () => {
  const random = { math: Math.random, crypto: globalThis.crypto.getRandomValues };
  afterEach(() => {
    Math.random = random.math;
    globalThis.crypto.getRandomValues = random.crypto;
  });
  /** Everything a copy shows: its directories, and its files with a document in the form the format writes (a file written by hand is kept as it came on the copy that took it in, which is 60's rule and not a difference). */
  const shown = async (c: Copy): Promise<Map<string, string>> => {
    const out = new Map<string, string>();
    for (const [path, b] of await c.files()) {
      if (path.endsWith('.md') && !path.startsWith('.')) out.set(path, Buffer.from(serialize(parse(text(b)).doc)).toString('base64'));
      // the order is kept as it was written too: its directories are compared in one order
      else if (path === '.ilmi/order.json') out.set(path, Buffer.from(JSON.stringify(Object.entries(JSON.parse(text(b)) as Record<string, string[]>).sort(([x], [y]) => (x < y ? -1 : 1)), null, 1)).toString('base64'));
      else out.set(path, b);
    }
    const visit = async (rel: string): Promise<void> => {
      for (const e of await c.fs.readDir(join(ROOT, rel))) {
        if (!e.isDir) continue;
        const path = rel ? `${rel}/${e.name}` : e.name;
        out.set(`${path}/`, '');
        await visit(path);
      }
    };
    await visit('');
    return out;
  };
  // `ILMI_SEEDS=n` runs n seeds, `ILMI_SEEDS=from-to` those: a wider look than the suite's
  const [from, to] = (process.env.ILMI_SEEDS ?? '1-24').includes('-') ? (process.env.ILMI_SEEDS ?? '1-24').split('-').map(Number) : [1, Number(process.env.ILMI_SEEDS)];
  for (const seed of Array.from({ length: to! - from! + 1 }, (_, i) => i + from!)) {
    it(`all end the same (seed ${seed})`, async () => {
      const rnd = rng(seed);
      // the devices are numbered from the seed, whatever ran before, and the ids rows and cards are given come from it too: a run that fails fails again, alone
      made = 100 + 3 * seed;
      const ids = rng(seed * 7919);
      Math.random = ids;
      globalThis.crypto.getRandomValues = ((b: Uint8Array) => { for (let i = 0; i < b.length; i++) b[i] = Math.floor(ids() * 256); return b; }) as typeof globalThis.crypto.getRandomValues;
      const pick = <T,>(list: readonly T[]): T => list[Math.floor(rnd() * list.length)]!;
      const inked = rng(seed * 104729);
      const storage = memStorage();
      // one seed in three (every one with `ILMI_SNAPS=1`) folds its change files into snapshots as it goes and deletes what they cover a
      // quarter of an hour on: copies read snapshots in place of files, and of files that are gone
      const snaps: Partial<EngineOptions> = seed % 3 === 0 || process.env.ILMI_SNAPS ? { snapAfter: 4, snapWorth: 3, snapKeepMs: 15 * 60_000 } : {};
      const first = await copy('a', CORPUS, snaps);
      await first.eng.connect(storage);
      await first.eng.sync(storage);
      const copies = [first];
      for (const name of ['b', 'c']) {
        const c = await copy(name, undefined, snaps);
        await c.eng.connect(storage);
        await c.eng.sync(storage);
        copies.push(c);
      }
      let wrote = 0;
      const WORDS = ['alpha', 'beta', 'gamma', 'delta', 'epsilon', 'zeta', 'eta', 'theta'];
      const dirOf = (rel: string): string => rel.slice(0, Math.max(0, rel.lastIndexOf('/')));
      const at = (dir: string, name: string): string => (dir ? `${dir}/${name}` : name);
      for (let step = 0; step < 120; step++) {
        const c = pick(copies);
        c.at.ms += Math.floor(rnd() * 90_000) + 1000;
        const all = await shown(c);
        const have = [...all.keys()].filter((p) => p.endsWith('.md') && !p.startsWith('.')).sort();
        /** Every directory that shows, the top first; and the ones that are folders, not a document's children. */
        const dirs = ['', ...[...all.keys()].filter((p) => p.endsWith('/') && !p.startsWith('.')).map((p) => p.slice(0, -1)).sort()];
        const folders = dirs.filter((d) => d !== '' && !all.has(`${d}.md`));
        const there = async (rel: string): Promise<boolean> => (await c.fs.stat(join(ROOT, rel))) !== null;
        const rel = have.length ? pick(have) : null;
        const k = rnd();
        if (k < 0.22 && rel) {
          // a word put into a block, or a block's words changed
          await c.change(rel, (doc) => {
            const blocks = doc.blocks.filter((b) => b.kind === 'paragraph' || b.kind === 'card');
            if (!blocks.length) { doc.blocks.push({ kind: 'paragraph', text: `${pick(WORDS)} ${step}` }); return; }
            const b = pick(blocks);
            const words = b.text.split(' ');
            const i = Math.floor(rnd() * (words.length + 1));
            // a word takes the place of one only where that one is a plain word: a card stays a card
            words.splice(i, rnd() < 0.3 && /^\p{L}+$/u.test(words[i] ?? '') ? 1 : 0, `${pick(WORDS)}${step}`);
            b.text = words.join(' ');
          });
        } else if (k < 0.3 && rel) {
          await c.change(rel, (doc) => { doc.blocks.splice(Math.floor(rnd() * (doc.blocks.length + 1)), 0, { kind: 'paragraph', text: `A paragraph ${c.name} added at step ${step}.` }); });
        } else if (k < 0.35 && rel) {
          await c.change(rel, (doc) => { const i = doc.blocks.findIndex((b) => b.kind === 'paragraph'); if (i >= 0 && doc.blocks.length > 2) doc.blocks.splice(i, 1); });
        } else if (k < 0.5 && rel) {
          // a grade: a card that has an id
          const cards = parse(await c.read(rel)).doc.blocks.filter((b): b is Card => b.kind === 'card' && !!b.id);
          if (cards.length) await grade(c, rel, pick(cards).id!, 1 + Math.floor(rnd() * 4));
        } else if (k < 0.57 && rel) {
          await c.change(rel, (doc) => {
            const which = rnd();
            if (which < 0.4) setField(doc, 'pri', Math.floor(rnd() * 100));
            else if (which < 0.7) setField(doc, 'title', `${pick(WORDS)} ${step}`);
            else if (which < 0.85) setField(doc, 'frozen', rnd() < 0.5);
            else setField(doc, 'pri', null);
          });
        } else if (k < 0.64) {
          // a new document: its own name, or one of a few any copy may pick, in any directory
          const name = rnd() < 0.4 ? `shared-${pick(WORDS.slice(0, 3))}.md` : `made-${c.name}-${++wrote}.md`;
          const to = at(pick(dirs), name);
          if (!(await there(to))) await c.write(to, `---\ntype: draft\n---\n\nMade by ${c.name} at step ${step}.\n`);
        } else if (k < 0.67) {
          const pairs = JSON.parse(await c.read('.ilmi/same.json').catch(() => '{"not":[]}')) as { not: string[] };
          await c.write('.ilmi/same.json', `${JSON.stringify({ not: [...new Set([...pairs.not, `${pick(WORDS)}|${pick(WORDS)}`])].sort() }, null, 2)}\n`);
        } else if (k < 0.75) {
          // a drag: one row of a directory taken to another place among the others, the whole list written as the app writes it
          const dir = pick(dirs);
          const order = JSON.parse(await c.read('.ilmi/order.json').catch(() => '{}')) as Record<string, string[]>;
          const names = (await c.fs.readDir(join(ROOT, dir))).filter((e) => !e.name.startsWith('.')).filter((e) => (e.isDir ? !all.has(`${at(dir, e.name)}.md`) : e.name.endsWith('.md'))).map((e) => (e.isDir ? `${e.name}/` : e.name)).sort();
          const list = [...(order[dir] ?? []).filter((n) => names.includes(n)), ...names.filter((n) => !(order[dir] ?? []).includes(n))];
          if (list.length > 1) {
            const [moved] = list.splice(Math.floor(rnd() * list.length), 1);
            list.splice(Math.floor(rnd() * (list.length + 1)), 0, moved!);
            await c.write('.ilmi/order.json', `${JSON.stringify({ ...order, [dir]: list }, null, 2)}\n`);
          }
        } else if (k < 0.83 && rel) {
          // a rename: a new name, or one of a few any copy may pick
          const to = at(dirOf(rel), rnd() < 0.3 ? `shared-${pick(WORDS.slice(0, 3))}.md` : `renamed-${step}.md`);
          if (!(await there(to)) && !(await there(to.slice(0, -3)))) await c.fs.rename(join(ROOT, rel), join(ROOT, to));
        } else if (k < 0.92) {
          // a move: a document (its children with it) or a folder, into another directory
          const from = rnd() < 0.5 && folders.length ? pick(folders) : rel;
          const dir = pick(dirs);
          if (from && dirOf(from) !== dir) {
            const to = at(dir, from.slice(from.lastIndexOf('/') + 1));
            const inside = from.endsWith('.md') ? from.slice(0, -3) : from;
            if (dir !== inside && !dir.startsWith(`${inside}/`) && !(await there(to)) && !(await there(to.replace(/\.md$/, '')))) await c.fs.rename(join(ROOT, from), join(ROOT, to));
          }
        } else if (rel) {
          // a delete: a document, or now and then a folder with all it holds
          if (rnd() < 0.2 && folders.length) await c.fs.remove(join(ROOT, pick(folders)));
          else await c.fs.remove(join(ROOT, rel));
        }
        // ink, from a draw of its own so the steps above are the ones they were: a stroke on one of two pages, one
        // erased, one erased and drawn again, a page thrown away
        if (inked() < 0.3) {
          const page = join(ROOT, `ink-0${1 + Math.floor(inked() * 2)}.pkdrawing`);
          const has = (await c.fs.ink(page)) ?? [];
          const j = inked();
          if (j < 0.55 || !has.length) await c.fs.setInk(page, [...has, { stroke: `s${step}${c.name}`, at: step, data: `d${step}` }]);
          else if (j < 0.8) await c.fs.setInk(page, has.filter((_, i) => i !== Math.floor(inked() * has.length)));
          else if (j < 0.9) { const back = has[Math.floor(inked() * has.length)]!; await c.fs.setInk(page, has.filter((x) => x !== back)); await c.fs.setInk(page, has); }
          else await c.fs.remove(page);
        }
        // a sync now and then, of whichever copy
        if (rnd() < 0.35) await pick(copies).eng.sync(storage);
      }
      await settle(storage, [...copies].sort(() => rnd() - 0.5));
      if (snaps.snapAfter) {
        // a copy made now, from whatever the storage still holds, is the same collection
        const late = await copy('d', undefined, snaps);
        late.at.ms = Math.max(...copies.map((c) => c.at.ms));
        await late.eng.connect(storage);
        await late.eng.sync(storage);
        copies.push(late);
        await settle(storage, copies);
      }
      const files = await Promise.all(copies.map((c) => shown(c)));
      expect(differences(files[0]!, files[1]!)).toEqual([]);
      expect(differences(files[0]!, files[2]!)).toEqual([]);
      if (files[3]) expect(differences(files[0]!, files[3])).toEqual([]);
      // and every document still reads as one: what a copy made from the storage holds is what the format writes
      for (const [path, b] of await copies[1]!.files()) if (path.endsWith('.md') && !path.startsWith('.')) expect(serialize(parse(text(b)).doc), path).toBe(text(b));
      // nothing is twice: no two rows of one copy are shown under one path
      for (const c of copies) {
        const paths = c.fs.door.rows().map((r) => c.fs.door.pathOf(r));
        expect(new Set(paths).size, c.name).toBe(paths.length);
      }
    }, 120_000);
  }
});
