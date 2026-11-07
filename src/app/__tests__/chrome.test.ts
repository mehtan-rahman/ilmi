// The shell's pure side: key hints per surface, card names, the palette's
// index and match, the tweaks' bounds.

import { describe, expect, it } from 'vitest';
import type { TreeNode } from '../../vault/index.js';
import type { Block } from '../../format/index.js';
import { buildIndex, cardLabel, fuzzy, hintsFor, rankHits, revealIndex, search, textEntry, textLine, withText, type Entry } from '../chrome.js';
import { queueId } from '../names.js';
import { ACCENTS, THEMES, useApp, ZOOM_MAX, ZOOM_MIN } from '../store.js';

describe('key hints', () => {
  it('names only the keys bound on each surface', () => {
    const keys = (h: ReturnType<typeof hintsFor>) => h.map(([k]) => k);
    expect(keys(hintsFor({ kind: 'queue', el: null, scope: 'today', canEnrol: false }))).toEqual(['⏎', 'j k', 'o', '⌘k']);
    expect(keys(hintsFor({ kind: 'queue', el: null, scope: 'cards', canEnrol: false }))).toEqual(['⏎', 'j k', '⌘k']);
    expect(keys(hintsFor({ kind: 'session', el: 'card', scope: null, canEnrol: false }))).toEqual(['space', '1 2 3 4', 'o', '[ ]']);
    expect(hintsFor({ kind: 'session', el: 'read', scope: null, canEnrol: false })[0]).toEqual(['⏎', 'done for today']);
    expect(hintsFor({ kind: 'session', el: 'write', scope: null, canEnrol: false })[0]).toEqual(['⏎', 'next']);
    expect(keys(hintsFor({ kind: 'source', el: null, scope: null, canEnrol: true }))).toContain('r');
    expect(keys(hintsFor({ kind: 'source', el: null, scope: null, canEnrol: false }))).not.toContain('r');
    expect(keys(hintsFor({ kind: 'deck', el: null, scope: null, canEnrol: false }))).toEqual(['j k', '⏎', '/', '⌫', 'm', '⌘k']);
    // a book: box, section, card; the sections stepped; ⌘\ brings its notes in over the pages and folds them, one word for both (milestone 70)
    expect(hintsFor({ kind: 'source', el: null, scope: null, canEnrol: false, pages: true })).toEqual([['drag', 'box a passage'], ['e', 'section'], ['m', 'card'], ['[ ]', 'sections'], ['/', 'search'], ['⌘\\', 'notes']]);
    // on an iPad a finger's drag is the scroll: the box comes after a hold
    expect(hintsFor({ kind: 'source', el: null, scope: null, canEnrol: false, pages: true, touch: true })[0]).toEqual(['hold, drag', 'box a passage']);
    expect(hintsFor({ kind: 'session', el: 'read', scope: null, canEnrol: false, pages: true })).toContainEqual(['⌘\\', 'notes']);
    expect(keys(hintsFor({ kind: 'session', el: 'section', scope: null, canEnrol: false, pages: true }))).toEqual(['⏎', 'p', 'd', 'drag', 'e', 'm', '⌘\\', '[ ]']);
    expect(keys(hintsFor({ kind: 'intake', el: null, scope: null, canEnrol: false }))).toEqual(['⌘v']);
    expect(keys(hintsFor({ kind: undefined, el: null, scope: null, canEnrol: false }))).toEqual(['⌘k', '⌘\\']);
  });
});

describe('card names', () => {
  it('uses the first blank, the question, or both sides', () => {
    expect(cardLabel('the {{c1::minimum information principle}} is the {{c2::discipline}}')).toBe('minimum information principle');
    expect(cardLabel('what is memory? :: a forest')).toBe('what is memory?');
    expect(cardLabel('der Vorsatz ::: resolution')).toBe('der Vorsatz ⇄ resolution');
    expect(cardLabel('why?\n?\nbecause of a very long answer')).toBe('why?');
    expect(cardLabel('x'.repeat(60) + ' :: y')).toHaveLength(50);
    expect(cardLabel('plain text')).toBe('plain text');
  });
});

describe('the palette', () => {
  const tree: TreeNode[] = [
    { kind: 'folder', name: 'papers', path: 'papers', children: [
      { kind: 'doc', name: 'wozniak-1990', path: 'papers/wozniak-1990.md', children: [
        { kind: 'doc', name: 'woz-ex1', path: 'papers/wozniak-1990/woz-ex1.md' },
      ] },
    ] },
    { kind: 'doc', name: 'german', path: 'german.md' },
  ];
  const docs = {
    'papers/wozniak-1990.md': { type: 'source' as const, frozen: true, cards: 2, due: 1 },
    'papers/wozniak-1990/woz-ex1.md': { type: 'extract' as const, frozen: false, cards: 0, due: 0 },
    'german.md': { type: 'deck' as const, frozen: false, cards: 7, due: 3, title: 'german · A1' },
  };
  const index = buildIndex(tree, docs, [{ id: 'split', title: 'split pane' }]);

  it('indexes queries, folders, documents by title, and commands; cards come through the search index', () => {
    expect(index.map((e) => e.tag)).toEqual(['query', 'query', 'query', 'query', 'query', 'folder', 'source', 'extract', 'deck', 'command']);
    expect(index.find((e) => e.key === 'p:german.md')).toMatchObject({ title: 'german · A1', sub: 'deck', target: { open: 'german.md' } });
    expect(index.find((e) => e.tag === 'extract')).toMatchObject({ sub: 'wozniak 1990' });
    expect(index.find((e) => e.tag === 'command')).toMatchObject({ target: { command: 'split' } });
  });

  it('names a card by its document, block index, and id, so opening lands on it', () => {
    const card = (path: string, block: number, id: string | null, text: string) => textEntry({ path, block, kind: 'card', card: id, text }, 'x', docs);
    expect(card('german.md', 3, 'cv-vorsatz', 'der Vorsatz ::: resolution')).toMatchObject({ key: 'c:german.md:3', title: 'der Vorsatz ⇄ resolution', sub: 'german · A1', tag: 'card', target: { open: 'german.md', index: 3, id: 'cv-vorsatz' } });
    expect(card('papers/wozniak-1990.md', 5, null, 'what is memory? :: a forest').target).toEqual({ open: 'papers/wozniak-1990.md', index: 5 });
    // documents and queries still open by path alone
    expect(index.find((e) => e.key === 'p:german.md')!.target).toEqual({ open: 'german.md' });
    expect(index.find((e) => e.key === 'q:today')!.target).toEqual({ open: queueId('today') });
  });

  it('matches in order, cheaper at word starts, and misses honestly', () => {
    expect(fuzzy('', 'anything')).toBe(0);
    expect(fuzzy('woz', 'wozniak-1990')!).toBeLessThan(fuzzy('woz', 'a wandering ox z')!);
    expect(fuzzy('zzz', 'wozniak')).toBeNull();
    expect(fuzzy('ge', 'german · A1')!).toBeLessThan(0);
  });

  it('searches titles and where they live', () => {
    expect(search(index, '').length).toBe(index.length);
    // the source and its extract
    expect(search(index, 'woz').map((e) => e.key)).toEqual(['p:papers/wozniak-1990.md', 'p:papers/wozniak-1990/woz-ex1.md']);
    expect(search(index, 'split')[0]).toMatchObject({ tag: 'command' });
    expect(search(index, 'due')[0]).toMatchObject({ title: 'due today' });
    expect(search(index, 'qqq')).toEqual([]);
  });
});

describe('text found, in the palette (milestone 68)', () => {
  const row = (key: string, title: string): Entry => ({ key, title, sub: '', tag: 'note', target: { open: key } });
  const hit = (kind: 'heading' | 'card' | 'text', text: string, block = 0) => ({ path: 'a.md', block, kind, card: null, text });

  it('a name folds as text does: an unvoweled query finds a voweled title', () => {
    const named = buildIndex([{ kind: 'doc', name: 'x', path: 'x.md' }], { 'x.md': { type: 'note' as const, frozen: false, cards: 0, due: 0, title: 'الكَرَم وَالجُود' } }, []);
    expect(search(named, 'الكرم')[0]?.key).toBe('p:x.md');
    expect(search(named, 'الكرم')).toHaveLength(1);
  });

  it('says the line it was found in, the whole word marked, the voweled text as written', () => {
    const { line, mark } = textLine('وَالكَرَمُ فِي العَرَبِ كَثِيرٌ', 'كرم');
    expect(line.slice(mark![0], mark![1])).toBe('وَالكَرَمُ');
    const long = `${'lead '.repeat(40)}the action integral ${'tail '.repeat(40)}`;
    const far = textLine(long, 'action');
    expect(far.line.startsWith('…')).toBe(true);
    expect(far.line.endsWith('…')).toBe(true);
    expect(far.line.slice(far.mark![0], far.mark![1])).toBe('action');
    expect(far.line.length).toBeLessThan(130);
    // a word typed inside a longer one marks the word
    const part = textLine('Hamiltonians are nice', 'ilton');
    expect(part.line.slice(part.mark![0], part.mark![1])).toBe('Hamiltonians');
  });

  it('reads a formula as characters, and when the find is in the TeX looks there', () => {
    expect(textLine('so $\\alpha = 1$ holds', 'holds').line).toBe('so α = 1 holds');
    const tex = textLine('so $\\alpha = 1$ holds', 'alpha');
    expect(tex.line.slice(tex.mark![0], tex.mark![1])).toBe('alpha');
  });

  it('a block with no match to mark is said plainly', () => {
    expect(textLine('nothing here', 'other').mark).toBeUndefined();
  });

  it('opens at its block', () => {
    expect(textEntry(hit('text', 'a line of prose', 7), 'prose', {})).toMatchObject({ key: 't:a.md:7', tag: 'text', sub: 'a', target: { open: 'a.md', block: 7 } });
    expect(textEntry(hit('heading', 'a heading', 2), 'head', {}).target).toEqual({ open: 'a.md', block: 2 });
  });

  it('puts the phrase before the words apart, the word before a longer one, a heading before prose', () => {
    const texts = (q: string, ...hits: ReturnType<typeof hit>[]) => rankHits(hits, q).map((h) => h.text);
    expect(texts('red fox', hit('heading', 'fox and red'), hit('text', 'the red fox'))).toEqual(['the red fox', 'fox and red']);
    expect(texts('كرم', hit('heading', 'بالكرم'), hit('text', 'كَرَم الضيف'))).toEqual(['كَرَم الضيف', 'بالكرم']);
    expect(texts('fox', hit('text', 'a fox'), hit('card', 'fox :: x'), hit('heading', 'the fox'))).toEqual(['the fox', 'fox :: x', 'a fox']);
  });

  it('keeps names that hold the query above the text, loose ones after a few', () => {
    const names = ['energy', 'a-b-c1', 'a-b-c2', 'a-b-c3', 'a-b-c4', 'a-b-c5'].map((k) => row(k, k === 'energy' ? 'on energy' : `e n e r g y ${k}`));
    const out = withText(names, [row('t', 'text')], 'energy').map((e) => e.key);
    expect(out[0]).toBe('energy');
    expect(out.indexOf('t')).toBe(5);
    expect(out[out.length - 1]).toBe('a-b-c5');
  });
});

describe('landing on a card', () => {
  const blocks: Block[] = [
    { kind: 'paragraph', text: 'p' },
    { kind: 'card', text: 'a ::: b', id: 'c-aaaaaa' },
    { kind: 'card', text: 'c ::: d', id: 'c-bbbbbb' },
    { kind: 'card', text: 'e ::: f' },
  ];
  it('takes the index while the card is still there, else follows the id, else gives up', () => {
    expect(revealIndex(blocks, { index: 1, id: 'c-aaaaaa' })).toBe(1);
    expect(revealIndex(blocks, { index: 3 })).toBe(3);
    // the card slid down one after a delete above it
    expect(revealIndex(blocks, { index: 1, id: 'c-bbbbbb' })).toBe(2);
    expect(revealIndex(blocks, { index: 0, id: 'c-bbbbbb' })).toBe(2);
    // a different card sits at the index and the named one is gone
    expect(revealIndex(blocks, { index: 1, id: 'c-zzzzzz' })).toBe(-1);
    expect(revealIndex(blocks, { index: 0 })).toBe(-1);
    expect(revealIndex(blocks, { index: 9 })).toBe(-1);
  });
});

describe('tweaks', () => {
  it('keeps the text size inside its range, in hundredths', () => {
    useApp.getState().setZoom(1.1);
    expect(useApp.getState().zoom).toBe(1.1);
    useApp.getState().setZoom(9);
    expect(useApp.getState().zoom).toBe(ZOOM_MAX);
    useApp.getState().setZoom(0.1);
    expect(useApp.getState().zoom).toBe(ZOOM_MIN);
    useApp.getState().setZoom(1.2000000001);
    expect(useApp.getState().zoom).toBe(1.2);
    useApp.getState().setZoom(1);
  });

  it('keeps density inside its range and knows every accent', () => {
    useApp.getState().setDensity(9);
    expect(useApp.getState().density).toBe(1.6);
    useApp.getState().setDensity(0.1);
    expect(useApp.getState().density).toBe(0.6);
    useApp.getState().setDensity(1);
    expect(Object.keys(ACCENTS)).toEqual(['gold', 'ink', 'blue', 'red', 'sage', 'graphite']);
    expect(THEMES).toEqual(['light', 'dark', 'eink']);
    useApp.getState().setAccent('sage');
    expect(useApp.getState().accent).toBe('sage');
    useApp.getState().setAccent('gold');
  });
});
