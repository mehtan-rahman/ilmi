// The shell's pure side: key hints per surface, card names, the palette's
// index and match, the tweaks' bounds.

import { describe, expect, it } from 'vitest';
import type { TreeNode } from '../../vault/index.js';
import { buildIndex, cardLabel, fuzzy, hintsFor, search } from '../chrome.js';
import { ACCENTS, THEMES, useApp } from '../store.js';

describe('key hints', () => {
  it('names only the keys bound on each surface', () => {
    const keys = (h: ReturnType<typeof hintsFor>) => h.map(([k]) => k);
    expect(keys(hintsFor({ kind: 'queue', el: null, scope: 'today', canEnrol: false }))).toEqual(['⏎', 'j k', 'o', '⌘k']);
    expect(keys(hintsFor({ kind: 'queue', el: null, scope: 'cards', canEnrol: false }))).toEqual(['⏎', 'j k', '⌘k']);
    expect(keys(hintsFor({ kind: 'session', el: 'card', scope: null, canEnrol: false }))).toEqual(['space', '1 2 3 4', '[ ]']);
    expect(hintsFor({ kind: 'session', el: 'read', scope: null, canEnrol: false })[0]).toEqual(['⏎', 'read on']);
    expect(hintsFor({ kind: 'session', el: 'write', scope: null, canEnrol: false })[0]).toEqual(['⏎', 'worked on it']);
    expect(keys(hintsFor({ kind: 'source', el: null, scope: null, canEnrol: true }))).toContain('r');
    expect(keys(hintsFor({ kind: 'source', el: null, scope: null, canEnrol: false }))).not.toContain('r');
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
  const cards = [{ path: 'german.md', index: 0, text: 'der Vorsatz ::: resolution' }];
  const index = buildIndex(tree, docs, cards, [{ id: 'split', title: 'split pane' }]);

  it('indexes queries, folders, documents by title, cards, and commands', () => {
    expect(index.map((e) => e.tag)).toEqual(['query', 'query', 'query', 'query', 'query', 'folder', 'source', 'extract', 'deck', 'card', 'command']);
    expect(index.find((e) => e.key === 'p:german.md')).toMatchObject({ title: 'german · A1', sub: 'deck', target: { open: 'german.md' } });
    expect(index.find((e) => e.tag === 'extract')).toMatchObject({ sub: 'wozniak-1990' });
    expect(index.find((e) => e.tag === 'card')).toMatchObject({ title: 'der Vorsatz ⇄ resolution', sub: 'german · A1', target: { open: 'german.md' } });
    expect(index.find((e) => e.tag === 'command')).toMatchObject({ target: { command: 'split' } });
  });

  it('matches in order, cheaper at word starts, and misses honestly', () => {
    expect(fuzzy('', 'anything')).toBe(0);
    expect(fuzzy('woz', 'wozniak-1990')!).toBeLessThan(fuzzy('woz', 'a wandering ox z')!);
    expect(fuzzy('zzz', 'wozniak')).toBeNull();
    expect(fuzzy('ge', 'german · A1')!).toBeLessThan(0);
  });

  it('searches titles and where they live', () => {
    expect(search(index, '').length).toBe(index.length);
    expect(search(index, 'woz').map((e) => e.key)).toEqual(['p:papers/wozniak-1990.md', 'p:papers/wozniak-1990/woz-ex1.md']);
    expect(search(index, 'split')[0]).toMatchObject({ tag: 'command' });
    expect(search(index, 'due')[0]).toMatchObject({ title: 'due today' });
    expect(search(index, 'qqq')).toEqual([]);
  });
});

describe('tweaks', () => {
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
