// @vitest-environment jsdom
// The phone's side of the shell (milestone 56), drawn in jsdom: the bar at
// its foot, a topic's row with ⏎ `p` `d` as buttons, a card's one button
// before the answer and its four after it, the way out of a session, the
// quick card and the deck it lands in, `notes` with no second pane, and what
// its palette leaves out.

import { act, createElement } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { parse } from '../../format/index.js';
import { docItems, type CardItem, type ReadItem } from '../../schedule/index.js';
import type { TreeNode } from '../../vault/index.js';
import { SESSION, notesId, queueId } from '../names.js';
import { activeTab, emptyPanes, openTab } from '../panes.js';
import { deckFor, deckPaths } from '../quick.js';
import { useApp } from '../store.js';

const calls: string[] = [];
const DECK = 'arabic/vocabulary.md';
const OTHER = 'arabic/roots.md';
const NOTE = 'notes/stat-mech.md';
const PDF = 'library/alone.pdf';
const FILE = '---\ntitle: stat mech\nread: due=2026-10-30 ivl=3\n---\n\n# stat mech\n\nA line to read.\n\n- $Z$ :: $\\sum_s e^{-\\beta E_s}$\n';

vi.mock('../useDoc.js', () => ({ useDoc: (path: string | null) => (path === NOTE ? { text: FILE, doc: parse(FILE).doc } : null) }));
vi.mock('../Pdf.js', () => ({ Pdf: () => null, pointInView: () => null }));
vi.mock('../Reader.js', async (orig) => ({ ...(await orig<typeof import('../Reader.js')>()), Reader: () => null }));
vi.mock('../deckOps.js', async (orig) => ({
  ...(await orig<typeof import('../deckOps.js')>()),
  newCardAt: vi.fn(async (path: string, _after: unknown, text: string) => { calls.push(`card ${path}: ${text}`); return 0; }),
}));
vi.mock('../sections.js', async (orig) => ({
  ...(await orig<typeof import('../sections.js')>()),
  writeDoc: vi.fn(async (path: string) => { calls.push(`write ${path}`); }),
}));
vi.mock('../vault.js', async (orig) => {
  const real = await orig<typeof import('../vault.js')>();
  return {
    ...real,
    currentVault: () => ({ read: async () => ({ doc: parse(FILE).doc }), update: async (p: string) => { calls.push(`update ${p}`); } }),
    docsOf: () => [],
    startSession: vi.fn(() => { calls.push('enter'); }),
    openNode: vi.fn((id: string) => { calls.push(`open ${id}`); }),
    refreshQueue: vi.fn(),
  };
});

const { PhoneBar } = await import('../PhoneBar.js');
const { QuickCard } = await import('../QuickCard.js');
const { Queue } = await import('../Queue.js');
const { Session } = await import('../Session.js');
const { Canvas } = await import('../Canvas.js');
const { Palette } = await import('../Palette.js');
const { TopStrip } = await import('../TopStrip.js');
const { openQuickCard } = await import('../quick.js');
const { openNotes, openPagesBeside, toggleNotes } = await import('../book.js');
const { rememberDeck } = await import('../vault.js');

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

let root: Root;
let host: HTMLDivElement;
const draw = async (el: ReturnType<typeof createElement>) => {
  host = document.body.appendChild(document.createElement('div'));
  root = createRoot(host);
  await act(async () => { root.render(el); });
};
const q = <T extends Element>(sel: string) => document.querySelector<T>(sel);
const qa = <T extends Element>(sel: string) => Array.from(document.querySelectorAll<T>(sel));
const click = async (el: Element | null) => { await act(async () => { (el as HTMLElement).click(); }); };
const fill = async (el: HTMLTextAreaElement, text: string) => {
  await act(async () => {
    Object.getOwnPropertyDescriptor(HTMLTextAreaElement.prototype, 'value')!.set!.call(el, text);
    el.dispatchEvent(new Event('input', { bubbles: true }));
  });
};

const NOW = new Date('2026-10-30T12:00:00');
const initial = useApp.getState();
const onDay = () => openTab(emptyPanes(), queueId('today'));
const items = () => docItems(NOTE, parse(FILE).doc, NOW);
const card = () => items().find((i): i is CardItem => i.kind === 'card')!;
const read = () => items().find((i): i is ReadItem => i.kind === 'read')!;

beforeEach(() => {
  calls.length = 0;
  vi.useFakeTimers({ now: NOW, toFake: ['Date'] });
  const tree: TreeNode[] = [
    { kind: 'folder', name: 'arabic', path: 'arabic', children: [{ kind: 'doc', name: 'roots.md', path: OTHER }, { kind: 'doc', name: 'vocabulary.md', path: DECK }] },
    { kind: 'folder', name: 'notes', path: 'notes', children: [{ kind: 'doc', name: 'stat-mech.md', path: NOTE }] },
  ];
  useApp.setState({
    ...initial,
    learnNew: false,
    vault: '/collections/double-major',
    mobile: true,
    phone: true,
    tree,
    files: [DECK, OTHER, NOTE],
    order: {},
    docs: {
      [DECK]: { type: 'deck', title: 'vocabulary', frozen: false, cards: 4, due: 1 },
      [OTHER]: { type: 'deck', title: 'roots', frozen: false, cards: 2, due: 0 },
      [NOTE]: { type: 'note', title: 'stat mech', frozen: false, cards: 1, due: 1 },
    },
    panes: onDay(),
    queue: [],
  });
});

afterEach(async () => {
  await act(async () => { root?.unmount(); });
  host?.remove();
  vi.useRealTimers();
  useApp.setState({ ...initial });
});

describe('the bar', () => {
  it('enters the queue on the day, with what is due, and comes back to the day from anywhere else', async () => {
    useApp.setState({ queue: items() });
    await draw(createElement(PhoneBar));
    expect(qa('.phone-bar button')).toHaveLength(3);
    expect(q('.pb-day')?.textContent).toBe('enter queue2');
    await click(q('.pb-day'));
    expect(calls).toEqual(['enter']);
    calls.length = 0;
    await act(async () => { useApp.setState({ panes: openTab(emptyPanes(), NOTE) }); });
    expect(q('.pb-day')?.textContent).toBe('today2');
    await click(q('.pb-day'));
    expect(calls).toEqual([`open ${queueId('today')}`]);
  });

  it('with nothing due is the day and nothing to enter', async () => {
    await draw(createElement(PhoneBar));
    expect(q('.pb-day')?.textContent).toBe('today');
    expect(q('.pb-day')?.getAttribute('data-go')).toBe('0');
  });

  it('has the tree and the palette behind one button, and the sheet closes for the day', async () => {
    await draw(createElement(PhoneBar));
    await click(q('.pb-more'));
    expect(useApp.getState().sideSheet).toBe(true);
    expect(q('.pb-more')?.getAttribute('data-on')).toBe('1');
    await click(q('.pb-day'));
    expect(useApp.getState().sideSheet).toBe(false);
  });
});

describe('the strips', () => {
  it('leaves the top strip the name and sync, and the canvas one page with no tabs', async () => {
    await draw(createElement('div', null, createElement(TopStrip), createElement(Canvas)));
    expect(q('.top .ws')).not.toBeNull();
    expect(q('.top .palette')).toBeNull();
    expect(q('.top .insp-toggle')).toBeNull();
    expect(q('.tabbar')).toBeNull();
  });

  it('leaves the palette no command for what a phone has not got', async () => {
    useApp.setState({ paletteOpen: true });
    await draw(createElement(Palette));
    const titles = qa('.palette-row .pt').map((e) => e.textContent);
    expect(titles).toContain('tweaks');
    for (const gone of ['inspector', 'sidebar', 'split pane', 'export collection · zip']) expect(titles).not.toContain(gone);
  });
});

describe('a topic on the day', () => {
  it('has ⏎ p d as buttons, and a card has none', async () => {
    useApp.setState({ queue: items() });
    await draw(createElement(Queue, { scope: 'today', active: true }));
    const row = q('.qlist li[data-el="read"]')!;
    expect(Array.from(row.querySelectorAll('.topic-acts button')).map((b) => (b as HTMLElement).dataset.act)).toEqual(['on', 'postpone', 'done']);
    expect(row.querySelector('[data-act="postpone"]')?.textContent).toBe('later');
    expect(row.querySelector('[data-act="done"]')?.textContent).toBe('dismiss');
    expect(q('.qlist li[data-el="card"] .topic-acts')).toBeNull();
  });

  it('acts from the row: written, nothing opened, and the notice can take it back', async () => {
    useApp.setState({ queue: items() });
    await draw(createElement(Queue, { scope: 'today', active: true }));
    await act(async () => { q<HTMLElement>('.qlist li[data-el="read"] [data-act="postpone"]')!.click(); await Promise.resolve(); });
    await act(async () => { await new Promise((r) => setTimeout(r, 0)); });
    expect(calls).toEqual([`write ${NOTE}`]);
    expect(useApp.getState().notice?.undo).toBe(true);
    expect(useApp.getState().notice?.line).toContain('later');
    expect(activeTab(useApp.getState().panes)?.id).toBe(queueId('today'));
  });

  it('on the Mac and the iPad stays a row', async () => {
    useApp.setState({ queue: items(), phone: false });
    await draw(createElement(Queue, { scope: 'today', active: true }));
    expect(q('.topic-acts')).toBeNull();
  });
});

describe('a session', () => {
  const session = async (phone = true) => {
    useApp.setState({ phone, session: { seq: 1, items: [card()] }, panes: openTab(emptyPanes(), SESSION) });
    await draw(createElement(Session, { active: true, onOpen: () => {} }));
  };

  it('offers one button before the answer, and the four grades after it', async () => {
    await session();
    expect(q('.grades')).toBeNull();
    await click(q('.reveal-all'));
    expect(q('.reveal-all')).toBeNull();
    expect(qa('.grades button').map((b) => b.querySelector('.label')?.firstChild?.textContent)).toEqual(['again', 'hard', 'good', 'easy']);
  });

  it('has a way back to the day, the tab it would close being out of sight', async () => {
    await session();
    await click(q('.sn-out'));
    expect(calls).toEqual([`open ${queueId('today')}`]);
  });

  it('on the Mac has the grades from the start and no such button', async () => {
    await session(false);
    expect(q('.reveal-all')).toBeNull();
    expect(q('.grades')).not.toBeNull();
    expect(q('.sn-out')).toBeNull();
  });
});

describe('a quick card', () => {
  const decks = [OTHER, DECK];

  it('starts on the deck in front, else the one chosen last, else the first there is', () => {
    expect(deckPaths([OTHER, NOTE, DECK], useApp.getState().docs)).toEqual(decks);
    expect(deckFor(decks, DECK, OTHER)).toBe(DECK);
    expect(deckFor(decks, NOTE, DECK)).toBe(DECK);
    expect(deckFor(decks, undefined, 'gone.md')).toBe(OTHER);
    expect(deckFor([], undefined, null)).toBeNull();
  });

  it('opens with front and back and lands in the deck chosen, which the next starts on', async () => {
    await draw(createElement(QuickCard));
    expect(q('.quick')).toBeNull();
    await act(async () => { openQuickCard(); });
    expect(q('.qd-t')?.textContent).toBe('roots');
    const [front, back] = qa<HTMLTextAreaElement>('.quick textarea');
    expect([front!.placeholder, back!.placeholder]).toEqual(['front', 'back']);
    expect(q('.quick .pri-pick')).toBeNull();
    expect(q('.quick kbd')).toBeNull();
    expect(q<HTMLButtonElement>('[data-act="save"]')!.disabled).toBe(true);
    await click(q('.quick-deck'));
    expect(qa('.qd-row').map((r) => r.getAttribute('data-path'))).toEqual(decks);
    await click(q(`.qd-row[data-path="${DECK}"]`));
    expect(q('.quick-decks')).toBeNull();
    expect(q('.qd-t')?.textContent).toBe('vocabulary');
    await fill(front!, 'kataba');
    await fill(back!, 'he wrote');
    await click(q('[data-act="save"]'));
    expect(q('.quick')).toBeNull();
    expect(calls).toEqual([`card ${DECK}: kataba :: he wrote`]);
    expect(useApp.getState().lastDeck).toBe(DECK);
    await act(async () => { openQuickCard(); });
    expect(q('.qd-t')?.textContent).toBe('vocabulary');
  });

  it('keeps the composer and the deck on save, another, and writes nothing on cancel', async () => {
    rememberDeck(DECK);
    await draw(createElement(QuickCard));
    await act(async () => { openQuickCard(); });
    let [front, back] = qa<HTMLTextAreaElement>('.quick textarea');
    await fill(front!, 'one');
    await fill(back!, 'two');
    await click(q('[data-act="again"]'));
    expect(calls).toHaveLength(1);
    [front, back] = qa<HTMLTextAreaElement>('.quick textarea');
    expect(front!.value).toBe('');
    await fill(front!, 'three');
    await click(q('[data-act="cancel"]'));
    expect(q('.quick')).toBeNull();
    expect(calls).toHaveLength(1);
  });

  it('starts on the deck in front', async () => {
    useApp.setState({ panes: openTab(emptyPanes(), DECK), lastDeck: OTHER });
    await draw(createElement(QuickCard));
    await act(async () => { openQuickCard(); });
    expect(q('.qd-t')?.textContent).toBe('vocabulary');
  });

  it('with no deck in the collection says so, and opens nothing', async () => {
    useApp.setState({ docs: { [NOTE]: useApp.getState().docs[NOTE]! } });
    await draw(createElement(QuickCard));
    await act(async () => { openQuickCard(); });
    expect(q('.quick')).toBeNull();
    expect(useApp.getState().notice?.line).toBe('no deck yet');
  });
});

describe('notes with no second pane', () => {
  const CH = 'library/book/ch-1.md';
  beforeEach(() => {
    useApp.setState({
      docs: {
        [CH]: { type: 'source', title: 'ch 1', frozen: true, cards: 0, due: 0, pdf: 'library/book.pdf' },
        [PDF]: { type: 'source', title: 'alone', frozen: true, cards: 0, due: 0, pdf: PDF, note: NOTE },
        [NOTE]: { type: 'note', title: 'on alone', frozen: false, cards: 0, due: 0, of: PDF },
      },
    });
  });

  it('puts the note in the pages\' place, and pages comes back', async () => {
    useApp.setState({ panes: openTab(emptyPanes(), PDF) });
    await act(async () => { await openNotes(PDF); });
    const s = useApp.getState();
    expect(s.panes.panes).toHaveLength(1);
    expect(s.panes.panes[0]!.tabs).toHaveLength(1);
    expect(activeTab(s.panes)?.id).toBe(NOTE);
    act(() => { openPagesBeside(NOTE); });
    expect(activeTab(useApp.getState().panes)?.id).toBe(PDF);
    expect(useApp.getState().panes.panes[0]!.tabs).toHaveLength(1);
  });

  it('a chapter whose body is its notes is the same, by its notes tab', async () => {
    useApp.setState({ panes: openTab(emptyPanes(), CH) });
    await act(async () => { toggleNotes(CH); await Promise.resolve(); });
    expect(activeTab(useApp.getState().panes)?.id).toBe(notesId(CH));
    expect(useApp.getState().panes.panes).toHaveLength(1);
  });

  it('over a session goes on top, the session kept behind', async () => {
    useApp.setState({ panes: openTab(emptyPanes(), SESSION) });
    await act(async () => { await openNotes(PDF); });
    const p = useApp.getState().panes.panes[0]!;
    expect(p.tabs.map((t) => t.id)).toEqual([SESSION, NOTE]);
  });
});
