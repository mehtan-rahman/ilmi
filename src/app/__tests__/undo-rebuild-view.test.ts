// @vitest-environment jsdom
// ⌘Z across a page built again from its file (`build` in Reader.tsx): the
// Reader mounted over a real vault, something typed, the write read back
// as something else (a line that became a card), then undo: the text in
// the editor and the file after it. And which changes start the history
// anew: someone else's, and a grade written through.

import { promises as fsp } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { redoDepth, undoDepth } from 'prosemirror-history';
import { NodeSelection, TextSelection } from 'prosemirror-state';
import type { EditorView } from 'prosemirror-view';
import { act, createElement } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { parse, setField } from '../../format/index.js';
import { nodeFs } from '../../vault/node-fs.js';
import { Vault } from '../../vault/index.js';
import { findKey, foldKey, foldedKeys, fromDoc, schema, type FindMeta, type FoldMeta } from '../../reader/index.js';
import { useApp, type DocInfo } from '../store.js';

const NOTE = 'notes/words.md';
const START = 'first line\n\n## a heading\n\nunder it\n\nkept :: card ^k1\n<!-- sr due=2026-01-01 r=2 -->\n\nlast line\n';
let vault: Vault;
let dir: string;

vi.mock('../vault.js', async (orig) => {
  const real = await orig<typeof import('../vault.js')>();
  return { ...real, currentVault: () => vault };
});
vi.mock('../bookPdf.js', () => ({ fillCrops() {}, acquirePdf: () => ({ promise: new Promise(() => {}), release() {} }), itemsOf: async () => [] }));
const { Reader, pageViews } = await import('../Reader.js');
const { writeDoc } = await import('../sections.js');
const { WRITE_DELAY } = await import('../writer.js');
(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
globalThis.ResizeObserver ??= class { observe() {} unobserve() {} disconnect() {} } as unknown as typeof ResizeObserver;
Element.prototype.scrollIntoView ??= function () {};
Range.prototype.getBoundingClientRect ??= () => new DOMRect();
Range.prototype.getClientRects ??= () => ({ length: 0, item: () => null, [Symbol.iterator]: [][Symbol.iterator] }) as unknown as DOMRectList;
document.elementFromPoint ??= () => null;

let host: HTMLDivElement;
let root: Root;
let view: EditorView;
beforeAll(async () => {
  dir = await fsp.mkdtemp(join(tmpdir(), 'ilmi-undo-'));
  await fsp.mkdir(join(dir, 'notes'), { recursive: true });
  await fsp.writeFile(join(dir, NOTE), START);
  vault = await Vault.open(nodeFs, dir);
  const docs: Record<string, DocInfo> = { [NOTE]: { type: 'note', frozen: false, cards: 1, due: 0, title: 'words' } as DocInfo };
  useApp.setState({ vault: dir, tree: vault.tree, files: vault.documents(), docs, reveal: null });
});
afterAll(async () => { vault.close(); await fsp.rm(dir, { recursive: true, force: true }); });

const wait = (ms: number) => act(async () => { await new Promise((r) => setTimeout(r, ms)); });
/** The pause after which what was typed is written, and the vault's report of it heard. */
const settle = () => wait(WRITE_DELAY + 150);
const disk = () => fsp.readFile(join(dir, NOTE), 'utf8');
const kinds = () => { const out: string[] = []; view.state.doc.forEach((n) => out.push(n.type.name)); return out; };
const endOf = (i: number): number => {
  let at = 0;
  for (let k = 0; k <= i; k++) at += view.state.doc.child(k).nodeSize;
  return at - 1;
};
const type = (text: string, pos: number) => act(() => {
  const tr = view.state.tr.insertText(text, pos);
  view.dispatch(tr.setSelection(TextSelection.create(tr.doc, pos + text.length)));
});
/** A new line after the `i`-th block, `text` typed in it, the caret at its end. */
const line = (text: string, i: number) => act(() => {
  const at = endOf(i) + 1;
  const tr = view.state.tr.insert(at, schema.nodes.paragraph!.create(null, schema.text(text)));
  view.dispatch(tr.setSelection(TextSelection.create(tr.doc, at + 1 + text.length)));
});
/** ⌘Z (Ctrl-Z off the Mac, as jsdom is), or with ⇧ its redo, pressed on the page. */
const press = (shift = false) => act(() => {
  view.dom.dispatchEvent(new KeyboardEvent('keydown', { key: 'z', code: 'KeyZ', ctrlKey: true, shiftKey: shift, bubbles: true, cancelable: true }));
});

beforeEach(async () => {
  await vault.update(NOTE, (d) => { d.blocks = parse(START).doc.blocks; delete d.frontmatter; });
  expect(await disk()).toBe(START);
  useApp.setState({ folds: {} });
  host = document.body.appendChild(document.createElement('div'));
  root = createRoot(host);
  await act(async () => { root.render(createElement(Reader, { id: NOTE })); });
  await wait(30);
  view = pageViews.get(host.querySelector('.draft-doc')!)!;
});
afterEach(async () => { act(() => root.unmount()); host.remove(); await wait(20); });

describe('⌘Z across a page built again from its own write', () => {
  it('typing, a line that became a card, then ⌘Z twice: the card and its line, then the typing before; each written; ⇧⌘Z brings them back', async () => {
    expect(kinds()).toEqual(['paragraph', 'heading', 'paragraph', 'card', 'paragraph']);
    await type(' typed', endOf(0));
    await settle();
    expect(await disk()).toBe(START.replace('first line', 'first line typed'));
    const state = view.state;
    await line('word :: def', 2);
    expect(kinds()[3]).toBe('paragraph');
    await settle();
    // read back as a card: the page built again, in the state it had (the plugins the same ones), the card selected
    expect(kinds()).toEqual(['paragraph', 'heading', 'paragraph', 'card', 'card', 'paragraph']);
    expect(view.state.plugins).toBe(state.plugins);
    expect(view.state.selection instanceof NodeSelection && (view.state.selection.node.attrs.card as { text: string }).text).toBe('word :: def');
    expect(host.querySelectorAll('.card-span')).toHaveLength(2);
    const withCard = START.replace('first line', 'first line typed').replace('under it\n', 'under it\n\nword :: def\n');
    expect(await disk()).toBe(withCard);
    expect(undoDepth(view.state)).toBe(2);

    await press();
    expect(kinds()).toEqual(['paragraph', 'heading', 'paragraph', 'card', 'paragraph']);
    expect(view.state.doc.child(0).textContent).toBe('first line typed');
    await settle();
    expect(await disk()).toBe(START.replace('first line', 'first line typed'));
    // nothing made the card again
    expect(kinds()).toEqual(['paragraph', 'heading', 'paragraph', 'card', 'paragraph']);

    await press();
    expect(view.state.doc.child(0).textContent).toBe('first line');
    await settle();
    expect(await disk()).toBe(START);
    expect(undoDepth(view.state)).toBe(0);

    await press(true);
    await press(true);
    expect(redoDepth(view.state)).toBe(0);
    expect(kinds()).toEqual(['paragraph', 'heading', 'paragraph', 'card', 'card', 'paragraph']);
    await settle();
    expect(await disk()).toBe(withCard);
  });

  it('the find bar and a fold stay as they were through it', async () => {
    await act(() => { view.dispatch(view.state.tr.setMeta(foldKey, { toggle: view.state.doc.child(0).nodeSize } satisfies FoldMeta)); });
    const folded = foldedKeys(view.state);
    expect(folded).toHaveLength(1);
    await act(() => { view.dispatch(view.state.tr.setMeta(findKey, { query: 'first' } satisfies FindMeta)); });
    await type(' :: now a card', endOf(0));
    await settle();
    expect(kinds()[0]).toBe('card');
    expect(foldedKeys(view.state)).toEqual(folded);
    expect(findKey.getState(view.state)?.open).toBe(true);
    expect(findKey.getState(view.state)?.query).toBe('first');
    expect(findKey.getState(view.state)?.matches).toHaveLength(1);
    expect(host.querySelector('.find-bar')).not.toBeNull();
    await press();
    expect(kinds()[0]).toBe('paragraph');
    expect(view.state.doc.child(0).textContent).toBe('first line');
    expect(foldedKeys(view.state)).toEqual(folded);
    await settle();
    expect(await disk()).toBe(START);
  });

  it('a change this page made to the file itself (a passage marked as taken): it stays, and ⌘Z takes back the typing before it', async () => {
    await type(' typed', endOf(0));
    await settle();
    await act(async () => { await writeDoc(NOTE, (d) => { const b = d.blocks[2]!; if (b.kind === 'paragraph') b.extracts = ['under']; }); });
    await wait(50);
    expect(fromView(2)).toMatchObject({ extracts: ['under'] });
    expect(undoDepth(view.state)).toBe(1);
    await press();
    expect(view.state.doc.child(0).textContent).toBe('first line');
    expect(fromView(2)).toMatchObject({ extracts: ['under'] });
    await settle();
    const text = await disk();
    expect(text.startsWith('first line\n')).toBe(true);
    expect(parse(text).doc.blocks[2]).toMatchObject({ kind: 'paragraph', text: 'under it', extracts: ['under'] });
  });
});

/** The `i`-th block as the editor would write it. */
const fromView = (i: number) => fromDoc(view.state.doc)[i];

describe('the history starts anew', () => {
  it('a grade written through the page: ⌘Z cannot bring the old schedule back', async () => {
    await type(' typed', endOf(0));
    await settle();
    expect(undoDepth(view.state)).toBe(1);
    await act(async () => { await writeDoc(NOTE, (d) => { const c = d.blocks[3]!; if (c.kind === 'card') c.sched = { ...c.sched, due: '2026-02-02', reps: 3 }; }); });
    await wait(50);
    expect(fromView(3)).toMatchObject({ sched: { reps: 3 } });
    expect(undoDepth(view.state)).toBe(0);
    await press();
    await settle();
    expect(await disk()).toContain('first line typed\n');
    expect(await disk()).toContain('due=2026-02-02 r=3');
  });

  it('someone else\'s change to the text: built as before, the caret kept in its line', async () => {
    await type(' typed', endOf(0));
    await settle();
    await act(() => { view.dispatch(view.state.tr.setSelection(TextSelection.create(view.state.doc, endOf(4) - 2))); });
    await act(async () => { await vault.update(NOTE, (d) => { d.blocks.splice(1, 0, { kind: 'paragraph', text: 'from elsewhere' }); }); });
    await wait(50);
    expect(view.state.doc.child(1).textContent).toBe('from elsewhere');
    expect(undoDepth(view.state)).toBe(0);
    const $h = view.state.selection.$head;
    expect($h.parent.textContent).toBe('last line');
    expect($h.parentOffset).toBe('last line'.length - 2);
  });

  it('but not when someone else changed only what is above the text (the document the same): the history stays', async () => {
    await type(' typed', endOf(0));
    await settle();
    await act(async () => { await vault.update(NOTE, (d) => { setField(d, 'pri', 3); }); });
    await wait(50);
    expect(undoDepth(view.state)).toBe(1);
    await press();
    await settle();
    const text = await disk();
    expect(text).toContain('pri: 3');
    expect(text).toContain('\nfirst line\n');
  });
});
