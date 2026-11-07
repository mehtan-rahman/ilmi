// The search index (milestone 68), over a store in memory: what it holds of
// a document, that the fold is one rule, and that it follows a write, a
// rename, a delete and a grade. `src/sync/__tests__/engine.test.ts` follows
// it through merges and snapshots; `src-tauri/src/store.rs` tests what SQLite
// does with the rows, and `ILMI_SMOKE=search` the whole of it in the window.

import { promises as fsp } from 'node:fs';
import { join as joinPath } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import { faceText, findIn, fold, foldMap, parse, serialize, type Doc } from '../../format/index.js';
import { decompose } from '../lift.js';
import { memStore } from '../mem-store.js';
import { nodeFs } from '../node-fs.js';
import { hayOf, plainLines, plainText, searchQuery, searchRows } from '../search.js';
import { STORE_VERSION, storeFs } from '../store.js';
import { importFolder } from '../transfer.js';
import { filterRows, deckRows, DEFAULT_VIEW } from '../../app/deck.js';
import { landKey, makeState } from '../../reader/index.js';

const SAMPLE = fileURLToPath(new URL('../../../samples/double-major', import.meta.url));
const CORPUS = fileURLToPath(new URL('../../format/__tests__/corpus/vault', import.meta.url));
const ROOT = '/collections/test';

/** Every Markdown file under `dir`, by path. */
async function texts(dir: string): Promise<[string, string][]> {
  const out: [string, string][] = [];
  const visit = async (d: string): Promise<void> => {
    for (const e of await fsp.readdir(d, { withFileTypes: true })) {
      const p = joinPath(d, e.name);
      if (e.isDirectory()) await visit(p);
      else if (p.endsWith('.md')) out.push([p, await fsp.readFile(p, 'utf8')]);
    }
  };
  await visit(dir);
  return out;
}

async function sample() {
  const store = memStore();
  const fs = storeFs(store, ROOT);
  await importFolder(nodeFs, SAMPLE, fs, ROOT);
  return { store, fs };
}

const paths = (hits: { path: string }[]): string[] => [...new Set(hits.map((h) => h.path))].sort();

describe('the fold is one rule', () => {
  it('a text folded whole and a character at a time are the same, over the corpus and the sample, so a match in the index maps back to its text', async () => {
    let chars = 0;
    for (const dir of [CORPUS, SAMPLE]) {
      for (const [path, text] of await texts(dir)) {
        const { folded, at } = foldMap(text);
        expect(folded, path).toBe(fold(text));
        expect(at).toHaveLength(folded.length);
        chars += text.length;
      }
    }
    expect(chars).toBeGreaterThan(300_000);
  });

  it('holds where a rule could look at a neighbour: a final sigma, marks in another order, a ligature, a surrogate pair', () => {
    for (const s of ['ΣΑΣ σας', 'ạ̇', 'ạ̇', 'ﷺ ﻻ ﬁ', 'İstanbul', '𝐀𝐛𝐜 😀', 'حـــســـن', '각']) {
      expect(foldMap(s).folded, s).toBe(fold(s));
    }
    expect(fold('كَرَمٌ')).toBe('كرم');
    expect(fold('حَسَـــن')).toBe('حسن');
    expect(fold('Lücke')).toBe('lucke');
    expect(fold('أكرم إكرام آكل')).toBe('اكرم اكرام اكل');
    expect(fold('ΣΑΣ')).toBe('σασ');
  });

  it('finds what the deck search finds in every card of the sample, by the same words', async () => {
    const docs: [string, Doc][] = (await texts(SAMPLE)).map(([p, t]) => [p, parse(t).doc]);
    const rows = deckRows(docs, new Date('2026-11-07T12:00:00Z'));
    const cards = docs.flatMap(([, d]) => searchRows(d).filter((r) => r.kind === 'card'));
    expect(cards).toHaveLength(rows.length);
    for (const q of ['كرم', 'Lagrangian', 'energy', 'الكتاب', 'مُبْتَدَأ', 'nächste', 'of', 'ab']) {
      const { words } = searchQuery(q);
      const inDeck = filterRows(rows, q, DEFAULT_VIEW).length;
      expect(cards.filter((r) => words.every((w) => r.hay.includes(w))).length, q).toBe(inDeck);
    }
  });
});

describe("a document's rows", () => {
  it('are a block each: where it is, what is shown, that folded; a card with its id', () => {
    const { doc } = parse('# الكَرَمُ\n\nThe **generous** host and [his guest](x.md).\n\n<!-- box 1:0:0:1:1 -->\n\nFront?\n?\nBack ^c1\n\n- one\n- two\n');
    const rows = searchRows(doc);
    expect(rows.map((r) => [r.block, r.kind, r.card])).toEqual(doc.blocks.flatMap((b, i) => (b.kind === 'raw' && b.text.startsWith('<!--') ? [] : [[i, b.kind === 'heading' ? 'heading' : b.kind === 'card' ? 'card' : 'text', b.kind === 'card' ? 'c1' : null]])));
    expect(rows[0]).toMatchObject({ kind: 'heading', hay: 'الكرم', text: 'الكَرَمُ' });
    expect(rows[1]).toMatchObject({ hay: 'the generous host and his guest.', text: 'The generous host and his guest.' });
    expect(rows.find((r) => r.kind === 'card')).toMatchObject({ hay: 'front? back', text: 'Front?\n?\nBack' });
  });

  it('are the same made from the file and from what the store holds of it, over the corpus and the sample: a walk finds what a write wrote', async () => {
    for (const dir of [CORPUS, SAMPLE]) {
      for (const [path, text] of await texts(dir)) {
        const d = decompose(text);
        expect(searchRows(parse(d.bare).doc), path).toEqual(d.search);
      }
    }
  });

  it('take a text as the page shows it: a mark gone, a run of white space one space', () => {
    expect(plainText('a **b** *c* `d` ~~e~~ [f](g) x_y_z')).toBe('a b c d e f x_y_z');
    expect(hayOf(' A\n  b\t')).toBe('a b');
    expect(faceText('a :: b')).toBe('a\nb');
    expect(plainLines('| a | b |\n| --- | --- |\n| c | d |')).toBe('a · b\nc · d');
    expect(plainLines('- one\n  - two\n1. three\n> four')).toBe('one\ntwo\nthree\nfour');
  });
});

describe('search', () => {
  it('finds the five files of the sample that hold كرم, in every way it is written', async () => {
    const { fs } = await sample();
    const want = (await texts(SAMPLE)).filter(([, t]) => fold(t).includes('كرم')).map(([p]) => p.slice(SAMPLE.length + 1)).sort();
    expect(want).toHaveLength(5);
    expect(paths(await fs.search('كرم', 1000))).toEqual(want);
    for (const q of ['كَرَم', 'كَرَمٌ', 'كـــرم']) expect(paths(await fs.search(q, 1000))).toEqual(want);
  });

  it('finds a word with its prefixes and suffixes on, and shows the text as written', async () => {
    const { fs } = await sample();
    const hits = await fs.search('كرم', 1000);
    expect(hits.some((h) => findIn(h.text, 'بالكرم').length > 0 || findIn(h.text, 'الكرم').length > 0)).toBe(true);
    expect(hits.every((h) => findIn(h.kind === 'card' ? faceText(h.text) : h.text, 'كرم').length > 0)).toBe(true);
    expect(hits.some((h) => /[ً-ْ]/.test(h.text))).toBe(true);
  });

  it('finds a phrase as written first, then the words apart', async () => {
    const store = memStore();
    const fs = storeFs(store, ROOT);
    await fs.writeText(`${ROOT}/a.md`, 'the energy of the **conserved** quantity\n\nconserved is the energy\n\nnothing\n');
    expect((await fs.search('energy of the conserved')).map((h) => h.block)).toEqual([0]);
    expect((await fs.search('conserved energy')).map((h) => h.block)).toEqual([0, 1]);
    expect((await fs.search('is energy')).map((h) => h.block)).toEqual([1]);
    expect(await fs.search('  ')).toEqual([]);
  });

  it('leaves out what is under a dot-directory', async () => {
    const fs = storeFs(memStore(), ROOT);
    await fs.mkdir(`${ROOT}/.ilmi`);
    await fs.writeText(`${ROOT}/.ilmi/x.md`, 'plainly hidden\n');
    await fs.writeText(`${ROOT}/x.md`, 'plainly shown\n');
    expect(paths(await fs.search('plainly'))).toEqual(['x.md']);
  });
});

describe('the index follows the text', () => {
  const setup = async () => {
    const store = memStore();
    const fs = storeFs(store, ROOT);
    await fs.mkdir(`${ROOT}/box`);
    await fs.writeText(`${ROOT}/box/a.md`, 'first words\n\nquestion?\n?\nanswer ^c1\n');
    return { store, fs };
  };

  it('a write: the new words are found and the old are not', async () => {
    const { fs } = await setup();
    await fs.writeText(`${ROOT}/box/a.md`, 'second thoughts\n');
    expect(await fs.search('first')).toEqual([]);
    expect(paths(await fs.search('thoughts'))).toEqual(['box/a.md']);
  });

  it('a rename or a move: found at the new path, and nothing written', async () => {
    const { store, fs } = await setup();
    const n = store.tables.searchWrites;
    await fs.rename(`${ROOT}/box/a.md`, `${ROOT}/box/b.md`);
    expect(paths(await fs.search('first'))).toEqual(['box/b.md']);
    await fs.rename(`${ROOT}/box`, `${ROOT}/crate`);
    expect(paths(await fs.search('first'))).toEqual(['crate/b.md']);
    expect(store.tables.searchWrites).toBe(n);
  });

  it('a delete, of the document or of what holds it', async () => {
    const { store, fs } = await setup();
    await fs.writeText(`${ROOT}/box/c.md`, 'other words\n');
    await fs.remove(`${ROOT}/box/a.md`);
    expect(await fs.search('first')).toEqual([]);
    await fs.remove(`${ROOT}/box`);
    expect(await fs.search('words')).toEqual([]);
    expect(store.tables.search.size).toBe(0);
  });

  it('a document with children removed leaves a folder, and no text', async () => {
    const { fs } = await setup();
    await fs.mkdir(`${ROOT}/box/a`);
    await fs.writeText(`${ROOT}/box/a/kid.md`, 'kid words\n');
    await fs.remove(`${ROOT}/box/a.md`);
    expect(await fs.search('first')).toEqual([]);
    expect(paths(await fs.search('kid'))).toEqual(['box/a/kid.md']);
  });

  it('a grade: the text is the same, so no row is written', async () => {
    const { store, fs } = await setup();
    const n = store.tables.searchWrites;
    await fs.writeText(`${ROOT}/box/a.md`, 'first words\n\nquestion?\n?\nanswer ^c1\n<!-- sr due=2026-12-01 st=review s=4 d=5 r=1 l=0 ivl=3 last=2026-11-07T10:00:00Z g=3 -->\n');
    expect(store.tables.searchWrites).toBe(n);
    expect((await fs.search('answer'))[0]).toMatchObject({ kind: 'card', card: 'c1', path: 'box/a.md' });
  });

  it('a file renamed into a document brings its rows, and a document renamed out of one takes them', async () => {
    const { fs } = await setup();
    await fs.rename(`${ROOT}/box/a.md`, `${ROOT}/box/a.txt`);
    expect(await fs.search('first')).toEqual([]);
    await fs.rename(`${ROOT}/box/a.txt`, `${ROOT}/box/a.md`);
    expect(paths(await fs.search('first'))).toEqual(['box/a.md']);
  });
});

describe('a collection from before the index', () => {
  /** The sample with no rows, as a collection of the schema before them: `store` is reopened over `fresh`. */
  const old = async () => {
    const { store } = await sample();
    const rows = new Map(store.tables.search);
    store.tables.search.clear();
    await store.batch([{ op: 'searchWalked', after: '' }]);
    await store.setVersion(STORE_VERSION - 1);
    return { store, rows };
  };
  const walk = (fs: ReturnType<typeof storeFs>): Promise<number[]> => new Promise((done) => {
    const heard: number[] = [];
    fs.searchBuild((s) => { heard.push(s); if (s === 1) done(heard); });
  });

  it('opens, is brought up, and its walk makes the rows a write would have', async () => {
    const { store, rows } = await old();
    const fs = storeFs(store, ROOT);
    expect(await fs.search('كرم')).toEqual([]);
    const heard = await walk(fs);
    expect(await store.version()).toBe(STORE_VERSION);
    expect(heard[heard.length - 1]).toBe(1);
    expect(heard.length).toBeGreaterThan(2);
    expect(heard.every((s, i) => i === 0 || s >= heard[i - 1]!)).toBe(true);
    expect(new Map(store.tables.search)).toEqual(rows);
    expect(await store.searchState()).toEqual({ done: true, after: null });
  });

  it('a walk stopped goes on from there at the next open', async () => {
    const { store, rows } = await old();
    const first = storeFs(store, ROOT);
    await new Promise<void>((done) => {
      let n = 0;
      const stop = first.searchBuild(() => { if (++n === 2) { stop(); done(); } });
    });
    await new Promise((r) => setTimeout(r, 20));
    const part = store.tables.search.size;
    expect(part).toBeGreaterThan(0);
    expect(part).toBeLessThan(rows.size);
    expect((await store.searchState()).done).toBe(false);
    const heard = await walk(storeFs(store, ROOT));
    expect(heard[0]).toBeGreaterThan(0);
    expect(new Map(store.tables.search)).toEqual(rows);
  });

  it('a write during the walk is found, before and after the walk reaches it', async () => {
    const { store } = await old();
    const fs = storeFs(store, ROOT);
    const going = walk(fs);
    await fs.writeText(`${ROOT}/arabic/roots.md`, 'nothing but a quokka\n');
    await fs.writeText(`${ROOT}/late.md`, 'a late numbat\n');
    await going;
    expect(paths(await fs.search('quokka'))).toEqual(['arabic/roots.md']);
    expect(paths(await fs.search('numbat'))).toEqual(['late.md']);
    expect(await fs.search('generous host of the roots')).toEqual([]);
  });

  it('one already through says so at once and writes nothing', async () => {
    const { store, fs } = await sample();
    const n = store.tables.searchWrites;
    expect(await walk(fs)).toEqual([1]);
    expect(store.tables.searchWrites).toBe(n);
  });
});

describe('an index is not a change', () => {
  it('nothing of it is in what the file says', async () => {
    const { fs } = await sample();
    const text = await fs.readText(`${ROOT}/arabic/roots.md`);
    expect(serialize(parse(text).doc)).toBe(text);
    expect(text).not.toContain('hay');
  });
});

describe('landing on a block', () => {
  it('is a decoration, kept while the document changes around it, and gone when told', () => {
    const blocks = parse('# one\n\ntwo\n\nthree\n').doc.blocks;
    let state = makeState(blocks, { frozen: () => false, pos: null });
    const at = state.doc.child(0).nodeSize;
    state = state.apply(state.tr.setMeta(landKey, at));
    const marked = () => landKey.getState(state)!.find().map((d) => [d.from, d.to]);
    expect(marked()).toEqual([[at, at + state.doc.child(1).nodeSize]]);
    state = state.apply(state.tr.insertText('new ', 1));
    expect(marked()).toEqual([[at + 4, at + 4 + state.doc.child(1).nodeSize]]);
    state = state.apply(state.tr.setMeta(landKey, null));
    expect(marked()).toEqual([]);
  });
});
