// @vitest-environment jsdom
// Cards from text: each delimiter, the prefix pair over blank- and
// newline-separated lists, auto-detection on a Quizlet tab export and an
// Anki text export, cloze cells, three-cell lines, prose that is not cards,
// and the deck the vault writes from them.

import { promises as fsp } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';
import { cardForm, meta, parse, serialize } from '../../format/index.js';
import { Vault } from '../../vault/index.js';
import { nodeFs } from '../../vault/node-fs.js';
import {
  ankiHeader, cardText, chunksOf, deckDoc, detect, droppedLabel, leftoverLines, records, reduceCell, noDropped,
  splitCards, toCards, type Delims,
} from '../cards.js';

const QA_BLANK = `Q: what is the capital of France?
A: Paris

Q: and of Spain?
A: Madrid

Question: what does FSRS stand for
Answer: free spaced repetition scheduler`;

const QA_LINES = `Q: what is the capital of France?
A: Paris
Q: and of Spain?
A: Madrid
Q: and of Portugal?
A: Lisbon`;

const QUIZLET = `der Vorsatz\tresolution, intention
die Gelassenheit\tcomposure, serenity
der Zufall\tchance, coincidence
die Sehnsucht\tlonging`;

const PROSE = `Spaced repetition and the economics of attention

Every review you schedule is a small wager against forgetting. The wager has a cost — the minutes spent — and a payoff that compounds: each successful recall pushes the next due date further out, so a few well-timed reviews buy years of retention for the price of an afternoon.

The mistake most learners make is to treat the wager as free. They review everything, constantly, and confuse the warm feeling of familiarity with the harder fact of retrieval.

A good system spends your attention the way a careful gardener spends water: not evenly, but where the curve is about to cross the floor.`;

const ANKI = `#separator:tab
#html:true
#guid column:1
#notetype column:2
#deck column:3
#tags column:6
k8s;Q2	Basic	German::Nouns	der <b>Vorsatz</b>	resolution; intention<br>a firm one	german
p0.xY	Basic	German::Nouns	"die Gelassenheit<img src=""calm.jpg"">"	composure [sound:gelassenheit.mp3]	german
zz9.a	Cloze	German::Nouns	the {{c1::Sehnsucht::noun}} is a {{c2::longing}}		german
qq1.b	Basic	German::Nouns	"a line
broken in two"	and back	german`;

const found = (text: string, d: Delims) => splitCards(text, d).found.map((f) => (f.kind === 'pair' ? [f.front, f.back] : f.text));

/** Every card in the written deck reads back as a card; the file parses clean. */
function checkDeck(text: string, delims: Delims, both = false) {
  const { cards, leftovers } = toCards(splitCards(text, delims), both);
  const doc = deckDoc(cards, leftovers);
  const out = serialize(doc);
  const back = parse(out);
  expect(back.diagnostics).toEqual([]);
  expect(meta(back.doc).type).toBe('deck');
  const written = back.doc.blocks.filter((b) => b.kind === 'card');
  expect(written).toHaveLength(cards.length);
  for (const c of written) expect(cardForm(c.text)).not.toBeNull();
  return { out, doc: back.doc, cards, leftovers };
}

describe('delimiters', () => {
  it('splits a line at a tab, at ::, at a dash, at a comma', () => {
    expect(found('a\tb', { side: 'tab', card: 'newline' })).toEqual([['a', 'b']]);
    expect(found('a :: b', { side: 'colons', card: 'newline' })).toEqual([['a', 'b']]);
    expect(found('a ::: b', { side: 'colons', card: 'newline' })).toEqual([]);
    expect(found('a - b\nc – d\ne—f', { side: 'dash', card: 'newline' })).toEqual([['a', 'b'], ['c', 'd']]);
    expect(found('a, b', { side: 'comma', card: 'newline' })).toEqual([['a', 'b']]);
    expect(found('a | b', { side: { custom: '|' }, card: 'newline' })).toEqual([['a', 'b']]);
  });

  it('splits cards at a blank line, a newline, a semicolon, or a custom string', () => {
    expect(chunksOf('a\tb\n\nc\td', 'blank')).toEqual(['a\tb', 'c\td']);
    expect(chunksOf('a\tb\n\n\n  \nc\td\n', 'blank')).toEqual(['a\tb', 'c\td']);
    expect(chunksOf('a\tb\nc\td\n\n', 'newline')).toEqual(['a\tb', 'c\td']);
    expect(chunksOf('a\tb;c\td;', 'semicolon')).toEqual(['a\tb', 'c\td']);
    expect(chunksOf('a\tb###c\td', { custom: '###' })).toEqual(['a\tb', 'c\td']);
  });

  it('keeps the first of many cells as the front and joins the rest', () => {
    expect(found('front\tback\textra\t', { side: 'tab', card: 'newline' })).toEqual([['front', 'back / extra']]);
    expect(found('a, b, c', { side: 'comma', card: 'newline' })).toEqual([['a', 'b / c']]);
  });

  it('leaves a line that does not split, and one with an empty side', () => {
    const s = splitCards('a\tb\nno tab here\n\tc', { side: 'tab', card: 'newline' });
    expect(s.found).toHaveLength(1);
    expect(s.leftovers).toEqual(['no tab here', '\tc']);
    expect(leftoverLines(s.leftovers)).toBe(2);
  });
});

describe('the prefix pair', () => {
  it('reads Q:/A: over blank-separated input, Question:/Answer: too, case-insensitively', () => {
    expect(found(QA_BLANK, { side: 'prefix', card: 'blank' })).toEqual([
      ['what is the capital of France?', 'Paris'],
      ['and of Spain?', 'Madrid'],
      ['what does FSRS stand for', 'free spaced repetition scheduler'],
    ]);
    expect(found('q: one\na: two', { side: 'prefix', card: 'newline' })).toEqual([['one', 'two']]);
  });

  it('reads Q:/A: over newline-separated input, a card running to the next Q', () => {
    expect(found(QA_LINES, { side: 'prefix', card: 'newline' })).toEqual([
      ['what is the capital of France?', 'Paris'],
      ['and of Spain?', 'Madrid'],
      ['and of Portugal?', 'Lisbon'],
    ]);
    // the blank-separated list reads the same either way
    expect(found(QA_BLANK, { side: 'prefix', card: 'newline' })).toEqual(found(QA_BLANK, { side: 'prefix', card: 'blank' }));
  });

  it('joins a side that runs over lines with a space, and leaves a Q without an A', () => {
    const s = splitCards('Q: a long\nquestion\nA: an\nanswer\n\nQ: alone\n\nstray line', { side: 'prefix', card: 'blank' });
    expect(s.found).toEqual([{ kind: 'pair', front: 'a long question', back: 'an answer' }]);
    expect(s.leftovers).toEqual(['Q: alone', 'stray line']);
  });
});

describe('detection', () => {
  it('picks the prefix pair for a Q:/A: list, however it is separated', () => {
    expect(detect(QA_BLANK)).toMatchObject({ delims: { side: 'prefix', card: 'blank' }, cards: 3 });
    expect(detect(QA_LINES)).toMatchObject({ delims: { side: 'prefix', card: 'newline' }, cards: 3 });
  });

  it('picks tab and newline for a Quizlet export, not the commas inside the definitions', () => {
    expect(detect(QUIZLET)).toMatchObject({ delims: { side: 'tab', card: 'newline' }, cards: 4 });
    expect(found(QUIZLET, { side: 'tab', card: 'newline' })[0]).toEqual(['der Vorsatz', 'resolution, intention']);
  });

  it('prefers the pair with the fewest leftover lines when the counts tie', () => {
    const text = 'a :: b\nc :: d\n\nnot a card\nnor this';
    // blank: two chunks, the second one leftover paragraph of two lines; newline: two leftover lines; same count, tie to blank by order
    const d = detect(text);
    expect(d.cards).toBe(2);
    expect(d.delims.side).toBe('colons');
  });

  it('finds no cards in prose, so the intake stays a source', () => {
    const d = detect(PROSE);
    expect(d.cards).toBeLessThan(2);
    expect(detect('').cards).toBe(0);
    expect(detect('one line, with a comma').cards).toBe(1);
  });

  it('does not read dashes and commas in sentences as cards', () => {
    const s = splitCards(PROSE, { side: 'dash', card: 'newline' });
    expect(s.found).toEqual([]);
    expect(splitCards(PROSE, { side: 'comma', card: 'blank' }).found).toEqual([]);
    expect(splitCards('Q: what, exactly?\nA: this, that', { side: 'comma', card: 'newline' }).found).toEqual([]);
  });
});

describe('an Anki text export', () => {
  it('reads the header', () => {
    const h = ankiHeader(ANKI)!;
    expect(h.separator).toBe('\t');
    expect(h.html).toBe(true);
    expect([...h.skip].sort()).toEqual([1, 2, 3, 6]);
    expect(h.lines).toBe(6);
    expect(ankiHeader('#separator:Comma\nx,y')!.separator).toBe(',');
    expect(ankiHeader('#separator:|\nx|y')!.separator).toBe('|');
    expect(ankiHeader('# a heading\nx')).toBeNull();
    expect(ankiHeader(QUIZLET)).toBeNull();
  });

  it('reads quoted cells with quotes and newlines inside them', () => {
    expect(records('a\t"b ""q"" c"\td\n"x\ny"\tz', '\t')).toEqual([['a', 'b "q" c', 'd'], ['x\ny', 'z']]);
    expect(records('a,b\n\n,\nc,d\n', ',')).toEqual([['a', 'b'], ['c', 'd']]);
  });

  it('takes the separator from the header, drops the named columns, reduces HTML, and counts what the format lacks', () => {
    const d = detect(ANKI);
    expect(d.anki).not.toBeNull();
    expect(d.delims).toEqual({ side: 'tab', card: 'newline' });
    expect(d.cards).toBe(4);
    const s = splitCards(ANKI, { side: 'comma', card: 'blank' });
    expect(s.found).toEqual([
      { kind: 'pair', front: 'der Vorsatz', back: 'resolution; intention\na firm one' },
      { kind: 'pair', front: 'die Gelassenheit', back: 'composure' },
      { kind: 'cloze', text: 'the {{c1::Sehnsucht}} is a {{c2::longing}}' },
      { kind: 'pair', front: 'a line\nbroken in two', back: 'and back' },
    ]);
    expect(s.leftovers).toEqual([]);
    expect(s.dropped).toEqual({ hints: 1, sounds: 1, images: 1, extra: 0 });
    expect(droppedLabel(s.dropped)).toBe('1 hint, 1 sound, 1 image dropped');
    expect(droppedLabel(noDropped())).toBe('');
  });

  it('writes the deck with the multi-line forms where a side has a line break', () => {
    const { out, cards } = checkDeck(ANKI, { side: 'tab', card: 'newline' });
    expect(cards.map((c) => c.text)).toEqual([
      'der Vorsatz\n?\nresolution; intention\na firm one',
      'die Gelassenheit :: composure',
      'the {{c1::Sehnsucht}} is a {{c2::longing}}',
      'a line\nbroken in two\n?\nand back',
    ]);
    expect(out.startsWith('---\ntype: deck\n---\n\n')).toBe(true);
    expect(out).not.toContain('not cards');
  });

  it('reduces one cell on its own', () => {
    const d = noDropped();
    expect(reduceCell('<div>one</div><div>two&nbsp;<i>three</i></div>', true, d)).toBe('one\ntwo three');
    expect(reduceCell('plain <b>kept</b>', false, d)).toBe('plain <b>kept</b>');
    expect(reduceCell('[sound:a.mp3] word <img src="x.png"> {{c1::x::h}}', false, d)).toBe('word {{c1::x}}');
    expect(d).toEqual({ hints: 1, sounds: 1, images: 1, extra: 0 });
  });
});

describe('cloze cells', () => {
  it('writes a cloze cell whole and drops a filled cell beside it, counted', () => {
    const s = splitCards('the {{c1::answer}} here\tback extra\nplain {{blank}}\n', { side: 'tab', card: 'newline' });
    expect(s.found).toEqual([{ kind: 'cloze', text: 'the {{c1::answer}} here' }, { kind: 'cloze', text: 'plain {{blank}}' }]);
    expect(s.dropped.extra).toBe(1);
  });

  it('counts cloze lines as cards in detection', () => {
    const d = detect('the {{c1::first}} one\nthe {{c1::second}} one\nthe {{c1::third}} one');
    expect(d.cards).toBe(3);
  });
});

describe('writing', () => {
  it('writes one direction with :: and both with :::, the ? forms for line breaks', () => {
    expect(cardText('a', 'b', false)).toBe('a :: b');
    expect(cardText('a', 'b', true)).toBe('a ::: b');
    expect(cardText('a\nb', 'c', false)).toBe('a\nb\n?\nc');
    expect(cardText('a', 'b\nc', true)).toBe('a\n??\nb\nc');
    expect(cardText(' a ', '', false)).toBeNull();
  });

  it('refuses a card that would not read back as itself, after trying the ? form', () => {
    expect(cardText('a :: b', 'c', false)).toBe('a :: b\n?\nc');
    expect(cardText('a', 'b ::: c', true)).toBe('a ::: b ::: c');
    expect(cardText('x', '{{c1::y}}', false)).toBeNull();
    expect(cardText('a\nb', '{{c1::y}}', true)).toBeNull();
    expect(cardText('a', '?', false)).toBe('a :: ?');
  });

  it('keeps what did not split under a heading at the end, and checks every card', () => {
    const { out, doc, leftovers } = checkDeck('a\tb\nc\td\nloose line\n\ne\tf', { side: 'tab', card: 'newline' });
    expect(leftovers).toEqual(['loose line']);
    expect(out).toBe('---\ntype: deck\n---\n\na :: b\n\nc :: d\n\ne :: f\n\n## not cards\n\nloose line\n');
    expect(doc.blocks.map((b) => b.kind)).toEqual(['card', 'card', 'card', 'heading', 'paragraph']);
    const both = checkDeck(QUIZLET, { side: 'tab', card: 'newline' }, true);
    expect(both.cards.every((c) => cardForm(c.text) === 'bidir')).toBe(true);
    checkDeck(QA_BLANK, { side: 'prefix', card: 'blank' });
    checkDeck(QA_LINES, { side: 'prefix', card: 'newline' });
    expect(deckDoc([], []).blocks).toEqual([]);
  });
});

describe('the vault', () => {
  const scratch: string[] = [];
  afterEach(async () => { for (const d of scratch.splice(0)) await fsp.rm(d, { recursive: true, force: true }); });

  it('lands a deck named after the title, with imported and a title field when they differ', async () => {
    const dir = await fsp.mkdtemp(join(tmpdir(), 'ilmi-cards-'));
    scratch.push(dir);
    const vault = await Vault.open(nodeFs, dir);
    const { cards, leftovers } = toCards(splitCards(QUIZLET, detect(QUIZLET).delims), false);
    const path = await vault.importDeck('', { title: 'cards', doc: deckDoc(cards, leftovers), today: '2026-10-18' });
    expect(path).toBe('cards.md');
    const text = await fsp.readFile(join(dir, path), 'utf8');
    expect(text.startsWith('---\ntype: deck\nimported: 2026-10-18\n---\n\nder Vorsatz :: resolution, intention\n')).toBe(true);
    const loaded = await vault.read(path);
    expect(loaded.diagnostics).toEqual([]);
    expect(loaded.doc.blocks.filter((b) => b.kind === 'card')).toHaveLength(4);
    // a second one takes the next free name and keeps the title as a field
    const again = await vault.importDeck('', { title: 'cards', doc: deckDoc(cards, []), today: '2026-10-18' });
    expect(again).toBe('cards 2.md');
    expect(meta((await vault.read(again)).doc).title).toBe('cards');
    const titled = await vault.importDeck('', { title: 'German: nouns', doc: deckDoc(cards, []), today: '2026-10-18' });
    expect(titled).toBe('German nouns.md');
    expect(meta((await vault.read(titled)).doc).title).toBe('German: nouns');
    await expect(vault.importDeck('', { title: 'x', doc: deckDoc([], []) })).rejects.toThrow('nothing to import');
  });
});
