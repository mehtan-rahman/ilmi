// @vitest-environment jsdom
// The cards sweep (an audit, 2026-11-15): each test states what the deck
// browser, the new-card sheet and the composer should do, and fails while
// they do not. Over a copy of the corpus vault (german.md, seven cards),
// the browser drawn in jsdom, the writes real.

import { promises as fsp } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { act, createElement } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { meta as metaOf, type Doc } from '../../format/index.js';
import { nodeFs } from '../../vault/node-fs.js';
import { Vault } from '../../vault/index.js';
import { faceViews } from '../FaceField.js';
import { useApp, type DocInfo } from '../store.js';

const CORPUS = join(import.meta.dirname, '../../format/__tests__/corpus/vault');
const DECK = 'german.md';

// jsdom draws no boxes: ProseMirror's scroll to the caret asks a range for its rects
for (const proto of [Node.prototype, Range.prototype] as unknown as { getClientRects?: () => DOMRect[]; getBoundingClientRect?: () => DOMRect }[]) {
  proto.getClientRects ??= () => [];
  proto.getBoundingClientRect ??= () => new DOMRect();
}

let vault: Vault;
let dir: string;
const bodies = new Map<string, Doc>();

vi.mock('../vault.js', async (orig) => {
  const real = await orig<typeof import('../vault.js')>();
  return {
    ...real,
    currentVault: () => vault,
    allDocs: () => [...bodies],
    docsOf: (paths: readonly string[]) => paths.filter((p) => bodies.has(p)).map((p) => [p, bodies.get(p)!] as [string, Doc]),
    setDeckView: (id: string, v: unknown) => { useApp.setState((s) => ({ deckViews: { ...s.deckViews, [id]: v as never } })); },
    // vault.ts's removeCard, line for line, over this test's vault (the real one reads the module's own `current`)
    removeCard: async (path: string, index: number, id?: string, text?: string) => {
      await vault.removeCard(path, index, id, text);
      const sel = useApp.getState().selectedCard;
      if (sel && sel.path === path && sel.index === index) useApp.setState({ selectedCard: null });
      real.note('removed · card');
    },
  };
});
const { DeckBrowser, CardEditor } = await import('../DeckBrowser.js');
const { Composer } = await import('../Composer.js');
(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
(globalThis as { ResizeObserver?: unknown }).ResizeObserver ??= class { observe() {} unobserve() {} disconnect() {} };
const scrolled: Element[] = [];
Element.prototype.scrollIntoView = function scrollIntoView(this: Element) { scrolled.push(this); };

/** Read every file again, as the vault's events would, and publish the docs anew. */
async function refresh() {
  const docs: Record<string, DocInfo> = {};
  for (const p of vault.documents()) {
    const doc = (await vault.read(p, true)).doc;
    bodies.set(p, doc);
    const m = metaOf(doc);
    docs[p] = { type: m.type, frozen: m.frozen, cards: doc.blocks.filter((b) => b.kind === 'card').length, due: 0 };
  }
  await act(async () => { useApp.setState({ docs, files: vault.documents(), tree: vault.tree }); });
}

let host: HTMLDivElement;
let root: Root;
async function mount(el: React.ReactElement) {
  host = document.body.appendChild(document.createElement('div'));
  host.className = 'pane-body deck-view';
  root = createRoot(host);
  await act(async () => { root.render(el); });
}
function unmount() { act(() => root.unmount()); host.remove(); }

beforeEach(async () => {
  dir = await fsp.mkdtemp(join(tmpdir(), 'ilmi-sweep-cards-'));
  await fsp.cp(CORPUS, dir, { recursive: true });
  vault = await Vault.open(nodeFs, dir);
  useApp.setState({ vault: dir, order: vault.order, queue: [], lensViews: {}, deckViews: {}, selectedCard: null, reveal: null, notSame: [], notice: null, log: [] });
  await refresh();
  scrolled.length = 0;
});
afterEach(async () => {
  unmount();
  vault.close();
  bodies.clear();
  await fsp.rm(dir, { recursive: true, force: true });
});

const disk = () => fsp.readFile(join(dir, DECK), 'utf8');
const rowEls = () => Array.from(host.querySelectorAll<HTMLElement>('.deck-row'));
const front = (e: HTMLElement) => e.querySelector('.dr-front')?.textContent ?? '';
const selected = () => rowEls().filter((e) => e.classList.contains('selected')).map(front);
const click = (el: Element, init: MouseEventInit = {}) => act(async () => { el.dispatchEvent(new MouseEvent('click', { bubbles: true, cancelable: true, ...init })); });
const key = (k: string, init: KeyboardEventInit = {}, el: EventTarget = window) => act(async () => { el.dispatchEvent(new KeyboardEvent('keydown', { key: k, bubbles: true, cancelable: true, ...init })); });
/** Let a write land, then read the files again. */
const settle = async () => { await act(async () => { await new Promise((r) => setTimeout(r, 60)); }); await refresh(); };
const deck = () => mount(createElement(DeckBrowser, { home: DECK, active: true }));

describe('the deck: the selection and the cursor after a delete', () => {
  it('a row deleted by its × leaves the other rows selected on their own cards', async () => {
    await deck();
    await click(rowEls()[3]!);
    await click(rowEls()[5]!, { metaKey: true });
    const before = selected();
    expect(before).toEqual(['vergessen', 'spaced repetition is verteilte Wiederholung in German']);
    await click(rowEls()[0]!.querySelector('.cs-del')!);
    await settle();
    expect(rowEls()).toHaveLength(6);
    // the selection is held by `path#block`: with a card gone above, it now names the two cards after
    expect(selected()).toEqual(before);
  });

  it('⌫ with one row selected deletes that row, not a row ⌘-clicked off the selection', async () => {
    await deck();
    await click(rowEls()[1]!);
    await click(rowEls()[3]!, { metaKey: true });
    await click(rowEls()[3]!, { metaKey: true });
    expect(selected()).toEqual(['die Wiederholung']);
    expect(host.querySelector('.db-sel')?.textContent).toBe('1 selected');
    await key('Backspace');
    await settle();
    const text = await disk();
    // the bar says `1 selected` (die Wiederholung) and its delete button would take that one
    expect(text).toContain('vergessen ::: to forget');
    expect(text).not.toContain('die Wiederholung');
  });

  it('after ⌫ the cursor stays where the card was: j goes on from there, not from the top', async () => {
    await deck();
    await key('j'); await key('j'); await key('j'); await key('j');
    expect(useApp.getState().selectedCard).toEqual({ path: DECK, index: 3 });
    await key('Backspace');
    await settle();
    expect(rowEls()).toHaveLength(6);
    await key('j');
    expect(useApp.getState().selectedCard?.index).toBeGreaterThanOrEqual(3);
  });

  it('one card deleted (×, ⌫, the menu) can be undone, as two can', async () => {
    await deck();
    await click(rowEls()[0]!.querySelector('.cs-del')!);
    await settle();
    expect(await disk()).not.toContain('der Vorsatz');
    // a bulk delete's notice holds an undo (deckOps.bulkCards); one card's is a log line only
    expect(useApp.getState().notice?.undo).toBe(true);
  });
});

describe('the deck: the pairs', () => {
  it('⌘A while `similar` shows the pairs selects no row: no bulk bar over cards not on show', async () => {
    await deck();
    await click(host.querySelector('.chip[data-chip="similar"]')!);
    expect(rowEls()).toHaveLength(0);
    await key('a', { metaKey: true });
    expect(host.querySelector('.db-actions')).toBeNull();
  });
});

describe('the new card sheet', () => {
  const typeFront = async (text: string) => {
    const v = faceViews.get(host.querySelector('.card-sheet .face.front .face-host')!)!;
    await act(async () => { v.dispatch(v.state.tr.insertText(text, 1)); });
  };
  const typeBack = async (text: string) => {
    const v = faceViews.get(host.querySelector('.card-sheet .face.back .face-host')!)!;
    await act(async () => { v.dispatch(v.state.tr.insertText(text, 1)); });
  };

  it('a press outside a card with only its front written keeps the sheet and what was typed', async () => {
    await deck();
    await key('m');
    expect(host.querySelector('.card-sheet')).toBeTruthy();
    await typeFront('das Fenster');
    await act(async () => { host.querySelector('.card-sheet')!.dispatchEvent(new MouseEvent('mousedown', { bubbles: true, cancelable: true })); });
    await settle();
    // a front with no back is no card yet: the press lets the whole of it go, unasked
    expect(host.querySelector('.card-sheet .face.front')?.textContent).toBe('das Fenster');
  });

  it('a card saved from the sheet is brought into view', async () => {
    await deck();
    await key('m');
    await typeFront('das Fenster');
    await typeBack('window');
    scrolled.length = 0;
    await key('Enter', { metaKey: true }, host.querySelector('.card-sheet .ProseMirror')!);
    await settle();
    const row = rowEls().find((e) => front(e) === 'das Fenster');
    expect(row).toBeTruthy();
    expect(row!.classList.contains('cursor')).toBe(true);
    expect(scrolled).toContain(row);
  });
});

describe('the deck: what it remembers', () => {
  it('the search is still there when the deck\'s tab is left and come back to', async () => {
    await deck();
    await act(async () => {
      const input = host.querySelector<HTMLInputElement>('.db-search')!;
      Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value')!.set!.call(input, 'wieder');
      input.dispatchEvent(new Event('input', { bubbles: true }));
    });
    expect(rowEls()).toHaveLength(2);
    await click(rowEls()[1]!);
    // another tab in the pane: the lens is unmounted (Canvas.tsx draws the tab in front only), then drawn again
    unmount();
    await deck();
    expect(host.querySelector<HTMLInputElement>('.db-search')!.value).toBe('wieder');
    expect(rowEls()).toHaveLength(2);
  });
});

describe('the forms, one order everywhere', () => {
  it('⌘1 ⌘2 ⌘3 name the same forms in the composer (a card from a note) and the new card sheet', async () => {
    await mount(createElement('div', null,
      createElement('div', { id: 'a' }, createElement(Composer, { seed: '', pri: 50, onSave: () => {}, onClose: () => {} })),
      createElement('div', { id: 'b' }, createElement(CardEditor, { initial: { form: 'qa', front: '', back: '' }, pri: 50, onSave: () => {}, onCancel: () => {} })),
    ));
    const labels = (sel: string) => Array.from(host.querySelectorAll(`${sel} .type-toggle button`)).map((b) => b.firstChild?.textContent);
    expect(labels('#a')).toEqual(labels('#b'));
  });

  it('a question and its answer are written in the reader\'s editor, not a plain text box, and save as the card', async () => {
    const saved: string[] = [];
    await mount(createElement(Composer, { seed: 'what is it', form: 'qa', pri: 50, onSave: (t: string) => { saved.push(t); }, onClose: () => {} }));
    expect(host.querySelector('.composer textarea, .composer .qa-fields input')).toBeNull();
    const fields = Array.from(host.querySelectorAll<HTMLElement>('.composer .qa-fields .face-field'));
    expect(fields.map((f) => f.getAttribute('data-placeholder'))).toEqual(['question', 'answer']);
    expect(fields[0]!.textContent).toBe('what is it');
    const v = faceViews.get(fields[1]!.closest('.face-host')!)!;
    await act(async () => { v.dispatch(v.state.tr.insertText('this')); });
    await click(host.querySelector<HTMLElement>('.ft .act')!);
    expect(saved).toEqual(['what is it :: this']);
  });

  it('save and cancel are buttons, reached by Tab after the faces, and a click on one acts', async () => {
    const said: string[] = [];
    await mount(createElement('div', null,
      createElement('div', { id: 'a' }, createElement(Composer, { seed: 'a ::: b', pri: 50, onSave: () => { said.push('saved'); }, onClose: () => { said.push('closed'); } })),
      createElement('div', { id: 'b' }, createElement(CardEditor, { initial: { form: 'qa', front: '', back: '' }, pri: 50, onSave: () => {}, onCancel: () => { said.push('cancelled'); } })),
    ));
    const acts = (sel: string) => Array.from(host.querySelectorAll<HTMLElement>(`${sel} .ft .act`));
    for (const el of [...acts('#a'), ...acts('#b')]) expect([el.tagName, el.getAttribute('type'), el.tabIndex]).toEqual(['BUTTON', 'button', 0]);
    expect(acts('#a').map((e) => e.textContent)).toEqual(['⌘↵ save', '⇧⌘↵ save, another', 'esc cancel']);
    expect(acts('#b').map((e) => e.textContent)).toEqual(['⌘↵ save', 'esc cancel']);
    // nothing written: the sheet's save is shown as it was, dimmed by `data-able`, not disabled
    expect([acts('#b')[0]!.dataset.able, (acts('#b')[0] as HTMLButtonElement).disabled]).toEqual(['0', false]);
    await click(acts('#b')[1]!);
    await click(acts('#a')[2]!);
    expect(said).toEqual(['cancelled', 'closed']);
  });
});
