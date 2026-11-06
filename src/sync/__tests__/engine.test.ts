// The engine (milestone 61): collections over stores in memory, a storage
// in memory between them. Two copies made from the sample sync; a grade on
// each lands in the other; a card reworded on one and graded on the other
// is one card with both; one paragraph edited in two places merges by
// character and is listed; 53's merge cases restated for rows and text;
// and copies making random edits and syncing in random orders all end the
// same.

import { promises as fsp } from 'node:fs';
import { tmpdir } from 'node:os';
import { join as joinPath } from 'node:path';
import { fileURLToPath } from 'node:url';
import { afterEach, describe, expect, it } from 'vitest';
import { formatReview, meta, parse, serialize, setField, type Card, type Doc, type Review } from '../../format/index.js';
import { importFolder, join, storeFs, type StoreFs } from '../../vault/index.js';
import { memStore, type MemStore } from '../../vault/mem-store.js';
import { nodeFs } from '../../vault/node-fs.js';
import { bothChanged, engine, frontLines, type Engine } from '../engine.js';
import { clock, msOf } from '../clock.js';
import { folderStorage, memStorage, type MemStorage } from '../storage.js';

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

async function copy(name: string, from?: string): Promise<Copy> {
  const store = memStore();
  const fs = storeFs(store, ROOT);
  if (from) await importFolder(nodeFs, from, fs, ROOT);
  const at = { ms: T0 };
  const n = ++made;
  const eng = engine(fs, { loro, now: () => at.ms, newDevice: () => n.toString(16).padStart(16, '0') });
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
      moved += r.read + r.wrote;
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

  it('the order takes the later drag, the pairs and the log are unioned, a file replaced on both is the later one', async () => {
    const { a, b, storage } = await pair(CORPUS);
    const order = (names: string[]) => `${JSON.stringify({ '': names }, null, 2)}\n`;
    const top = (await a.fs.readDir(ROOT)).filter((e) => !e.name.startsWith('.') && (e.isDir || e.name.endsWith('.md'))).map((e) => (e.isDir ? `${e.name}/` : e.name)).filter((n, i, all) => !(n.endsWith('/') && all.includes(`${n.slice(0, -1)}.md`))).sort();
    expect(top.length).toBeGreaterThan(2);
    // the later drag stands whole, though it moved only two of the rows the earlier one moved
    const swapped = [top[1]!, top[0]!, ...top.slice(2)];
    a.at.ms += 60_000;
    await a.write('.ilmi/order.json', order([...top].reverse()));
    b.at.ms += 120_000;
    await b.write('.ilmi/order.json', order(swapped));
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
    expect((JSON.parse(text(fa.get('.ilmi/order.json'))) as Record<string, string[]>)['']).toEqual(swapped);
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

describe('copies making random edits and syncing in random orders', () => {
  const random = { math: Math.random, crypto: globalThis.crypto.getRandomValues };
  afterEach(() => {
    Math.random = random.math;
    globalThis.crypto.getRandomValues = random.crypto;
  });
  for (const seed of Array.from({ length: 24 }, (_, i) => i + 1)) {
    it(`all end the same (seed ${seed})`, async () => {
      const rnd = rng(seed);
      // the ids rows and cards are given come from the seed too, so a run that fails fails again
      const ids = rng(seed * 7919);
      Math.random = ids;
      globalThis.crypto.getRandomValues = ((b: Uint8Array) => { for (let i = 0; i < b.length; i++) b[i] = Math.floor(ids() * 256); return b; }) as typeof globalThis.crypto.getRandomValues;
      const pick = <T,>(list: readonly T[]): T => list[Math.floor(rnd() * list.length)]!;
      const storage = memStorage();
      const first = await copy('a', CORPUS);
      await first.eng.connect(storage);
      await first.eng.sync(storage);
      const copies = [first];
      for (const name of ['b', 'c']) {
        const c = await copy(name);
        await c.eng.connect(storage);
        await c.eng.sync(storage);
        copies.push(c);
      }
      const docs = [...(await first.files()).keys()].filter((p) => p.endsWith('.md') && !p.startsWith('.'));
      let made = 0;
      const WORDS = ['alpha', 'beta', 'gamma', 'delta', 'epsilon', 'zeta', 'eta', 'theta'];
      for (let step = 0; step < 120; step++) {
        const c = pick(copies);
        c.at.ms += Math.floor(rnd() * 90_000) + 1000;
        const have = [...(await c.files()).keys()].filter((p) => p.endsWith('.md') && !p.startsWith('.'));
        const rel = have.length ? pick(have) : null;
        const k = rnd();
        if (k < 0.3 && rel) {
          // a word put into a block, or a block's words changed
          await c.change(rel, (doc) => {
            const blocks = doc.blocks.filter((b) => b.kind === 'paragraph' || b.kind === 'card');
            if (!blocks.length) { doc.blocks.push({ kind: 'paragraph', text: `${pick(WORDS)} ${step}` }); return; }
            const b = pick(blocks);
            const words = b.text.split(' ');
            const at = Math.floor(rnd() * (words.length + 1));
            // a word takes the place of one only where that one is a plain word: a card stays a card
            words.splice(at, rnd() < 0.3 && /^\p{L}+$/u.test(words[at] ?? '') ? 1 : 0, `${pick(WORDS)}${step}`);
            b.text = words.join(' ');
          });
        } else if (k < 0.42 && rel) {
          await c.change(rel, (doc) => { doc.blocks.splice(Math.floor(rnd() * (doc.blocks.length + 1)), 0, { kind: 'paragraph', text: `A paragraph ${c.name} added at step ${step}.` }); });
        } else if (k < 0.5 && rel) {
          await c.change(rel, (doc) => { const i = doc.blocks.findIndex((b) => b.kind === 'paragraph'); if (i >= 0 && doc.blocks.length > 2) doc.blocks.splice(i, 1); });
        } else if (k < 0.72 && rel) {
          // a grade: a card that has an id
          const cards = parse(await c.read(rel)).doc.blocks.filter((b): b is Card => b.kind === 'card' && !!b.id);
          if (cards.length) await grade(c, rel, pick(cards).id!, 1 + Math.floor(rnd() * 4));
        } else if (k < 0.82 && rel) {
          await c.change(rel, (doc) => {
            const which = rnd();
            if (which < 0.4) setField(doc, 'pri', Math.floor(rnd() * 100));
            else if (which < 0.7) setField(doc, 'title', `${pick(WORDS)} ${step}`);
            else if (which < 0.85) setField(doc, 'frozen', rnd() < 0.5);
            else setField(doc, 'pri', null);
          });
        } else if (k < 0.9) {
          await c.write(`made-${c.name}-${++made}.md`, `---\ntype: draft\n---\n\nMade by ${c.name} at step ${step}.\n`);
        } else if (k < 0.95) {
          const pairs = JSON.parse(await c.read('.ilmi/same.json').catch(() => '{"not":[]}')) as { not: string[] };
          await c.write('.ilmi/same.json', `${JSON.stringify({ not: [...new Set([...pairs.not, `${pick(WORDS)}|${pick(WORDS)}`])].sort() }, null, 2)}\n`);
        } else if (docs.length) {
          await c.write('.ilmi/order.json', `${JSON.stringify({ '': [pick(docs.filter((d) => !d.includes('/')))] }, null, 2)}\n`);
        }
        // a sync now and then, of whichever copy
        if (rnd() < 0.35) await pick(copies).eng.sync(storage);
      }
      await settle(storage, [...copies].sort(() => rnd() - 0.5));
      const files = await Promise.all(copies.map((c) => c.files()));
      expect(differences(files[0]!, files[1]!)).toEqual([]);
      expect(differences(files[0]!, files[2]!)).toEqual([]);
      // and every document still reads as one: what a copy holds is what the format writes
      for (const [path, b] of files[0]!) if (path.endsWith('.md')) expect(serialize(parse(text(b)).doc), path).toBe(text(b));
    }, 120_000);
  }
});
