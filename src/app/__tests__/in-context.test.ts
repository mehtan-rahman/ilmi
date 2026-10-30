// @vitest-environment jsdom
// Milestone 37's views: the session's line above a card (the document and
// the headings over it), `o` and a click on it going to the source with the
// card named for the reader to land on, and `study` in the reader's top row
// on a note or source with cards (not on a deck, not with none).

import { act, createElement } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { parse } from '../../format/index.js';
import { docItems, type CardItem } from '../../schedule/index.js';
import type { TreeNode } from '../../vault/index.js';
import { useApp } from '../store.js';

const calls: string[] = [];
const NOTE = 'courses/stat-mech.md';
const FILE = '---\ntitle: stat mech\n---\n\n# stat mech\n\n## canonical ensemble\n\n- $Z$ :: $\\sum_s e^{-\\beta E_s}$\n- free energy :: $F = -kT \\ln Z$ ^c-free\n';

vi.mock('../useDoc.js', () => ({ useDoc: (path: string | null) => (path === NOTE ? { text: FILE, doc: parse(FILE).doc } : null) }));
vi.mock('../Pdf.js', () => ({ Pdf: () => null }));
vi.mock('../deckOps.js', async (orig) => ({
  ...(await orig<typeof import('../deckOps.js')>()),
  studyDeck: vi.fn((id: string) => { calls.push(`study ${id}`); return 1; }),
}));

const { Session } = await import('../Session.js');
const { StudyButton } = await import('../StudyButton.js');

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

let root: Root;
let host: HTMLDivElement;
const mount = (el: React.ReactElement) => {
  host = document.body.appendChild(document.createElement('div'));
  root = createRoot(host);
  act(() => { root.render(el); });
};

const items = () => docItems(NOTE, parse(FILE).doc, new Date('2026-10-30T12:00:00')).filter((i): i is CardItem => i.kind === 'card');

beforeEach(() => {
  calls.length = 0;
  const tree: TreeNode[] = [{ kind: 'folder', name: 'courses', path: 'courses', children: [{ kind: 'doc', name: 'stat-mech.md', path: NOTE }, { kind: 'doc', name: 'empty.md', path: 'courses/empty.md' }, { kind: 'doc', name: 'german.md', path: 'courses/german.md' }] }];
  useApp.setState({
    tree, files: [NOTE, 'courses/empty.md', 'courses/german.md'], order: {}, reveal: null,
    docs: {
      [NOTE]: { type: 'note', title: 'stat mech', frozen: false, cards: 2, due: 2 },
      'courses/empty.md': { type: 'note', frozen: false, cards: 0, due: 0 },
      'courses/german.md': { type: 'deck', frozen: false, cards: 4, due: 1 },
    },
    session: { seq: 1, items: items() },
  });
});

afterEach(() => {
  act(() => root.unmount());
  host.remove();
});

describe('the session\'s line above a card', () => {
  it('names the document and the heading over the card, the top heading that repeats the name left out', () => {
    mount(createElement(Session, { active: true, onOpen: (p: string) => { calls.push(`open ${p}`); } }));
    const trail = host.querySelector('.recall-meta .card-trail')!;
    expect(Array.from(trail.querySelectorAll('.ct-doc, .ct-h')).map((s) => s.textContent)).toEqual(['stat mech', 'canonical ensemble']);
    expect(trail.getAttribute('title')).toBe('go to source  o');
  });

  it('o goes to the source with the card named, so the reader lands on it; a click does the same', () => {
    mount(createElement(Session, { active: true, onOpen: (p: string) => { calls.push(`open ${p}`); } }));
    act(() => { window.dispatchEvent(new KeyboardEvent('keydown', { key: 'o', bubbles: true, cancelable: true })); });
    expect(calls).toEqual([`open ${NOTE}`]);
    expect(useApp.getState().reveal).toEqual({ path: NOTE, index: 2 });
    // the second card has an id: the reveal carries it, so a card that moved is still found
    act(() => { window.dispatchEvent(new KeyboardEvent('keydown', { key: ']', bubbles: true, cancelable: true })); });
    act(() => { host.querySelector<HTMLElement>('.card-trail')!.click(); });
    expect(useApp.getState().reveal).toEqual({ path: NOTE, index: 3, id: 'c-free' });
    expect(calls).toEqual([`open ${NOTE}`, `open ${NOTE}`]);
  });
});

describe('study in the reader\'s top row', () => {
  it('shows on a note with cards and studies it; not on one with none, not on a deck', () => {
    mount(createElement('div', null, createElement(StudyButton, { path: NOTE }), createElement(StudyButton, { path: 'courses/empty.md' }), createElement(StudyButton, { path: 'courses/german.md' })));
    const buttons = host.querySelectorAll<HTMLButtonElement>('.study-btn');
    expect(buttons).toHaveLength(1);
    expect(buttons[0]!.textContent).toBe('study');
    act(() => { buttons[0]!.click(); });
    expect(calls).toEqual([`study ${NOTE}`]);
  });
});
