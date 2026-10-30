// @vitest-environment jsdom
// Cards from an Anki package: the fixture `two-decks.json` (what the Rust
// side reads out of `two-decks.apkg`, both written by `npm run fixture:anki`)
// mapped to deck documents that parse with no diagnostics, the seeded `sr`
// lines checked against the arithmetic, the notetype kinds, what is dropped
// and counted, and the files a vault writes from them.

import { promises as fsp } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';
import { cardForm, formatSchedule, meta, parse, serialize, type Card } from '../../format/index.js';
import { addDays } from '../../schedule/dates.js';
import { Vault } from '../../vault/index.js';
import { nodeFs } from '../../vault/node-fs.js';
import {
  cardOf, creationDay, deckLabel, difficultyOf, kindOf, mapPackage, seedOf,
  type AnkiCard, type AnkiDropped, type AnkiNote, type AnkiNotetype, type AnkiPackage,
} from '../anki.js';
import { droppedLabel, noDropped } from '../cards.js';

const FIXTURES = join(import.meta.dirname, 'anki');
const pkg: AnkiPackage = JSON.parse(await fsp.readFile(join(FIXTURES, 'two-decks.json'), 'utf8')) as AnkiPackage;
const DAY0 = creationDay(pkg.crt);

const fresh = (): AnkiDropped => ({ ...noDropped(), schedules: 0, notes: 0 });
const card = (over: Partial<AnkiCard>): AnkiCard => ({ id: 1, note: 1, ord: 0, deck: 1, type: 0, queue: 0, ivl: 0, due: 0, factor: 0, reps: 0, lapses: 0, ...over });
const review = (over: Partial<AnkiCard>): AnkiCard => card({ type: 2, queue: 2, due: 100, ivl: 10, factor: 2500, reps: 3, lapses: 0, ...over });
const notetype = (over: Partial<AnkiNotetype>): AnkiNotetype => ({ id: 1, name: 'Basic', fields: ['Front', 'Back'], cloze: false, templates: [{ name: 'Card 1', front: '{{Front}}' }], ...over });
const note = (fields: string[], nt = 1): AnkiNote => ({ id: 1, notetype: nt, fields, tags: [] });

const cardsOf = (text: string): Card[] => parse(text).doc.blocks.filter((b): b is Card => b.kind === 'card');

describe('the fixture', () => {
  it('is the two-deck package the Rust test builds, beside its JSON', async () => {
    const bytes = await fsp.readFile(join(FIXTURES, 'two-decks.apkg'));
    expect(bytes.subarray(0, 2).toString('latin1')).toBe('PK');
    expect(pkg.schema).toBe(11);
    expect(pkg.media).toBe('json');
    expect(pkg.decks.map((d) => d.name)).toEqual(['Default', 'Languages::German', 'Science']);
    expect(pkg.notes).toHaveLength(5);
    expect(pkg.cards).toHaveLength(7);
  });
});

describe('progress', () => {
  it('reads the creation day at noon, so it holds in any zone', () => {
    expect(creationDay(1_767_225_600)).toBe('2026-01-01');
    expect(DAY0).toBe('2026-01-01');
  });

  it('maps ease to difficulty on a straight line, clamped', () => {
    expect(difficultyOf(2500)).toBe(5);
    expect(difficultyOf(1300)).toBe(8);
    expect(difficultyOf(2100)).toBe(6);
    expect(difficultyOf(4100)).toBe(1);
    expect(difficultyOf(5000)).toBe(1);
    expect(difficultyOf(100)).toBe(10);
    expect(difficultyOf(2460)).toBe(5.1);
  });

  it('seeds a review card from the creation day plus its due days', () => {
    const s = seedOf(review({ due: 200, ivl: 30, factor: 2500, reps: 7, lapses: 1 }), DAY0);
    const due = addDays(DAY0, 200);
    expect(s).toEqual({ due, state: 'review', stability: 30, difficulty: 5, reps: 7, lapses: 1, ivl: 30, last: addDays(due, -30) });
    expect(formatSchedule(s!)).toBe(`<!-- sr due=${due} st=review s=30 d=5 r=7 l=1 ivl=30 last=${addDays(due, -30)} -->`);
  });

  it('gives new, learning, and relearning cards no line', () => {
    expect(seedOf(card({ type: 0, due: 3 }), DAY0)).toBeNull();
    expect(seedOf(card({ type: 1, due: 1_767_300_000, factor: 2500 }), DAY0)).toBeNull();
    expect(seedOf(card({ type: 3, due: 1_767_300_000, ivl: 5, factor: 2500 }), DAY0)).toBeNull();
  });
});

describe('notetypes', () => {
  it('tells basic, reversed, cloze, and other apart by their templates', () => {
    expect(kindOf(notetype({}))).toBe('basic');
    expect(kindOf(notetype({ templates: [{ name: 'Card 1', front: '{{Front}}' }, { name: 'Card 2', front: '{{Back}}' }] }))).toBe('reversed');
    expect(kindOf(notetype({ templates: [{ name: 'Card 1', front: '{{Front}}' }, { name: 'Card 2', front: '{{#Add Reverse}}{{text:Back}}{{/Add Reverse}}' }] }))).toBe('reversed');
    expect(kindOf(notetype({ templates: [{ name: 'Card 1', front: '{{Front}}' }, { name: 'Card 2', front: '{{Front}} again' }] }))).toBe('other');
    expect(kindOf(notetype({ templates: [{ name: 'Card 1', front: '{{Front}}' }, { name: 'Card 2', front: '{{Back}} and {{Front}}' }] }))).toBe('other');
    expect(kindOf(notetype({ templates: [{ name: 'a', front: '{{Front}}' }, { name: 'b', front: '{{Back}}' }, { name: 'c', front: '{{Front}}' }] }))).toBe('other');
    expect(kindOf(notetype({ cloze: true, fields: ['Text', 'Back Extra'], templates: [{ name: 'Cloze', front: '{{cloze:Text}}' }] }))).toBe('cloze');
  });
});

describe('cardOf', () => {
  it('writes a basic note as front :: back, more fields joined with /', () => {
    const d = fresh();
    const r = cardOf(note(['a', 'b', 'c']), notetype({ fields: ['Front', 'Back', 'Extra'] }), [card({})], DAY0, d);
    expect(r).toEqual({ card: { kind: 'card', text: 'a :: b / c' }, other: false });
  });

  it('writes a reversed note as ::: only when its reverse card is there, each card\'s schedule on its direction\'s line', () => {
    const nt = notetype({ templates: [{ name: 'Card 1', front: '{{Front}}' }, { name: 'Card 2', front: '{{Back}}' }] });
    const d = fresh();
    const fwd = review({ ord: 0, due: 150, ivl: 45, factor: 2100, reps: 9 });
    const back = review({ id: 2, ord: 1, due: 160, ivl: 20, factor: 1300 });
    const r = cardOf(note(['der Vorsatz', 'resolution; intention']), nt, [back, fwd], DAY0, d);
    expect(r!.card.text).toBe('der Vorsatz ::: resolution; intention');
    expect(r!.card.sched).toEqual(seedOf(fwd, DAY0));
    expect(r!.card.sched?.difficulty).toBe(6);
    // the reverse card's progress lands on `sr r`, nothing dropped
    expect(r!.card.reverse).toEqual(seedOf(back, DAY0));
    expect(r!.card.reverse?.difficulty).toBe(8);
    expect(d.schedules).toBe(0);
    // the optional reverse not made: one direction, nothing dropped
    const d2 = fresh();
    const one = cardOf(note(['x', 'y']), nt, [fwd], DAY0, d2);
    expect(one!.card.text).toBe('x :: y');
    expect(d2.schedules).toBe(0);
    // a reverse card that is new drops no schedule
    const d3 = fresh();
    const newBack = cardOf(note(['x', 'y']), nt, [fwd, card({ ord: 1 })], DAY0, d3);
    expect(d3.schedules).toBe(0);
    expect(newBack!.card.reverse).toBeUndefined();
  });

  it('writes a cloze note whole, hints out, extra fields counted, one sr cN line per group', () => {
    const nt = notetype({ cloze: true, fields: ['Text', 'Back Extra'], templates: [{ name: 'Cloze', front: '{{cloze:Text}}' }] });
    const d = fresh();
    const c1 = review({ ord: 0, due: 100, ivl: 10, factor: 1300, reps: 3, lapses: 2 });
    const c2 = review({ id: 2, ord: 1, due: 120, ivl: 25, factor: 2500, reps: 4 });
    const r = cardOf(note(['The {{c1::mitochondrion::organelle}} is the {{c2::powerhouse}} of the cell.', 'a note', '']), nt, [c1, c2], DAY0, d);
    expect(r!.card.text).toBe('The {{c1::mitochondrion}} is the {{c2::powerhouse}} of the cell.');
    expect(r!.card.sched).toBeUndefined();
    expect(r!.card.blanks).toEqual({ 1: seedOf(c1, DAY0), 2: seedOf(c2, DAY0) });
    expect(r!.card.blanks![1]!.difficulty).toBe(8);
    expect(d.hints).toBe(1);
    expect(d.extra).toBe(1);
  });

  it('puts a single-group cloze schedule on the bare line', () => {
    const nt = notetype({ cloze: true, fields: ['Text'], templates: [{ name: 'Cloze', front: '{{cloze:Text}}' }] });
    const c1 = review({ ord: 0 });
    const r = cardOf(note(['{{c1::one}} and {{c1::two}}']), nt, [c1], DAY0, fresh());
    expect(r!.card.sched).toEqual(seedOf(c1, DAY0));
    expect(r!.card.blanks).toBeUndefined();
    // a card for a group the text does not hold loses its schedule, counted
    const d = fresh();
    cardOf(note(['{{c1::one}}']), nt, [c1, review({ id: 2, ord: 1 })], DAY0, d);
    expect(d.schedules).toBe(1);
  });

  it('writes other notetypes as first field :: the rest and says so', () => {
    const nt = notetype({ fields: ['A', 'B', 'C'], templates: [{ name: 'a', front: '{{A}}' }, { name: 'b', front: '{{B}}' }, { name: 'c', front: '{{C}}' }] });
    const d = fresh();
    const r = cardOf(note(['a', 'b', 'c']), nt, [review({ ord: 0 }), review({ id: 2, ord: 1 }), card({ id: 3, ord: 2 })], DAY0, d);
    expect(r).toMatchObject({ card: { text: 'a :: b / c' }, other: true });
    expect(d.schedules).toBe(1);
  });

  it('reduces field HTML, sounds, and images as the text export does', () => {
    const d = fresh();
    const r = cardOf(note(['What is the capital of <b>France</b>?', 'Paris [sound:paris.mp3]<br><img src="x.png">']), notetype({}), [card({})], DAY0, d);
    expect(r!.card.text).toBe('What is the capital of France? :: Paris');
    expect([d.sounds, d.images]).toEqual([1, 1]);
    // a line break in a field makes the multi-line form
    const two = cardOf(note(['one<br>two', 'three']), notetype({}), [card({})], DAY0, fresh());
    expect(two!.card.text).toBe('one\ntwo\n?\nthree');
  });

  it('makes no card from a note empty after reduction, or one no form reads back', () => {
    expect(cardOf(note(['Only a front', '']), notetype({}), [card({})], DAY0, fresh())).toBeNull();
    expect(cardOf(note(['<img src="a.png">', 'back']), notetype({}), [card({})], DAY0, fresh())).toBeNull();
    expect(cardOf(note(['a {{c1::blank}} on a basic note', 'back']), notetype({}), [card({})], DAY0, fresh())).toBeNull();
    const nt = notetype({ cloze: true, fields: ['Text'], templates: [{ name: 'Cloze', front: '{{cloze:Text}}' }] });
    expect(cardOf(note(['no blank here']), nt, [card({})], DAY0, fresh())).toBeNull();
  });
});

describe('mapPackage', () => {
  const m = mapPackage(pkg);

  it('lands each deck with cards as a deck document, in name order, nested by ::', () => {
    expect(m.decks.map((d) => [d.name, d.dir, d.title, d.cards, d.scheduled])).toEqual([
      ['Languages::German', ['Languages'], 'German', 2, 2],
      ['Science', [], 'Science', 2, 1],
    ]);
    expect(m.decks.map(deckLabel)).toEqual(['Languages / German', 'Science']);
    expect(m.empty).toBe(1);
    expect(m.other).toBe(0);
    expect(m.media).toBe('json');
  });

  it('counts what was dropped', () => {
    // the reversed note's second card lands on `sr r` since 44: no schedule dropped
    expect(m.dropped).toEqual({ hints: 1, sounds: 1, images: 1, extra: 0, schedules: 0, notes: 1 });
    expect(droppedLabel(m.dropped, [[m.dropped.schedules, 'schedule'], [m.dropped.notes, 'empty note']])).toBe('1 hint, 1 sound, 1 image, 1 empty note dropped');
  });

  it('writes the German deck with its schedules checked against the arithmetic, the reverse on sr r', () => {
    const doc = m.decks[0]!.doc;
    expect(meta(doc).type).toBe('deck');
    const text = serialize(doc);
    const due1 = addDays(DAY0, 200);
    const due2 = addDays(DAY0, 150);
    const due3 = addDays(DAY0, 160);
    expect(text).toBe([
      '---', 'type: deck', '---', '',
      'What is the capital of France? :: Paris',
      `<!-- sr due=${due1} st=review s=30 d=5 r=7 l=1 ivl=30 last=${addDays(due1, -30)} -->`, '',
      'der Vorsatz ::: resolution; intention',
      `<!-- sr due=${due2} st=review s=45 d=6 r=9 l=0 ivl=45 last=${addDays(due2, -45)} -->`,
      `<!-- sr r due=${due3} st=review s=20 d=8 r=4 l=3 ivl=20 last=${addDays(due3, -20)} -->`, '',
    ].join('\n'));
    const back = parse(text);
    expect(back.diagnostics).toEqual([]);
    expect(cardsOf(text).map((c) => cardForm(c.text))).toEqual(['qa', 'bidir']);
  });

  it('writes the Science deck: the cloze with its c1 line only, the learning card bare', () => {
    const doc = m.decks[1]!.doc;
    const text = serialize(doc);
    const due = addDays(DAY0, 100);
    expect(text).toBe([
      '---', 'type: deck', '---', '',
      'The {{c1::mitochondrion}} is the {{c2::powerhouse}} of the cell.',
      `<!-- sr c1 due=${due} st=review s=10 d=8 r=3 l=2 ivl=10 last=${addDays(due, -10)} -->`, '',
      'Which planet is nearest the sun? :: Mercury', '',
    ].join('\n'));
    const back = parse(text);
    expect(back.diagnostics).toEqual([]);
    const cards = cardsOf(text);
    expect(cards.map((c) => cardForm(c.text))).toEqual(['cloze', 'qa']);
    expect(Object.keys(cards[0]!.blanks ?? {})).toEqual(['1']);
    expect(cards[1]!.sched).toBeUndefined();
  });

  it('skips a deck whose notes all made no card, and a card whose note is missing', () => {
    const lone: AnkiPackage = {
      ...pkg,
      decks: [{ id: 5, name: 'Lone' }, { id: 6, name: 'Gone' }],
      notes: [note(['Only a front', ''], pkg.notetypes[0]!.id)],
      cards: [card({ deck: 5, note: 1 }), card({ id: 2, deck: 6, note: 99 })],
    };
    const r = mapPackage(lone);
    expect(r.decks).toEqual([]);
    expect(r.empty).toBe(2);
    expect(r.dropped.notes).toBe(2);
  });
});

describe('into a vault', () => {
  const scratch: string[] = [];
  afterEach(async () => {
    for (const d of scratch.splice(0)) await fsp.rm(d, { recursive: true, force: true });
  });

  it('lands Parent::Child as Parent/Child.md, the folder made once', async () => {
    const dir = await fsp.mkdtemp(join(tmpdir(), 'ilmi-anki-'));
    scratch.push(dir);
    const vault = await Vault.open(nodeFs, dir);
    const m = mapPackage(pkg);
    const paths: string[] = [];
    for (const d of m.decks) {
      let at = '';
      for (const seg of d.dir) at = await vault.folderIn(at, seg);
      paths.push(await vault.importDeck(at, { title: d.title, doc: d.doc, today: '2026-10-18' }));
    }
    expect(paths).toEqual(['Languages/German.md', 'Science.md']);
    expect(await vault.folderIn('', 'Languages')).toBe('Languages');
    const german = await vault.read('Languages/German.md', true);
    expect(german.diagnostics).toEqual([]);
    expect(german.text.split('\n').slice(0, 4)).toEqual(['---', 'type: deck', 'imported: 2026-10-18', '---']);
    expect(german.doc.blocks.map((b) => b.kind)).toEqual(['card', 'card']);
    expect((german.doc.blocks[0] as Card).sched?.state).toBe('review');
    // a document's name: the folder is its children directory, made on demand as elsewhere
    expect(await vault.folderIn('', 'Science')).toBe('Science');
    await expect(vault.folderIn('', 'Science.md')).rejects.toThrow('not a folder');
  });
});
