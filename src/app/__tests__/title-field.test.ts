// @vitest-environment jsdom
// A note's title edited where it stands, at the top of the note (`TitleField`
// in Reader.tsx): ⏎ or leaving it renames as the tree's rename does, Escape
// puts it back, an empty or unchanged title renames nothing.

import { promises as fsp } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { act, createElement } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterAll, afterEach, beforeAll, describe, expect, it, vi } from 'vitest';
import { nodeFs } from '../../vault/node-fs.js';
import { Vault } from '../../vault/index.js';
import { useApp, type DocInfo } from '../store.js';

const NOTE = 'notes/kana.md';
let vault: Vault;
let dir: string;
const renames: string[] = [];

vi.mock('../vault.js', async (orig) => {
  const real = await orig<typeof import('../vault.js')>();
  return {
    ...real,
    currentVault: () => vault,
    renameNode: vi.fn(async (path: string, name: string) => { renames.push(`${path} → ${name}`); return path; }),
  };
});
vi.mock('../bookPdf.js', () => ({ fillCrops() {}, acquirePdf: () => ({ promise: new Promise(() => {}), release() {} }), itemsOf: async () => [] }));
const { Reader } = await import('../Reader.js');
(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
globalThis.ResizeObserver ??= class { observe() {} unobserve() {} disconnect() {} } as unknown as typeof ResizeObserver;
Element.prototype.scrollIntoView ??= function () {};
Range.prototype.getBoundingClientRect ??= () => new DOMRect();
Range.prototype.getClientRects ??= () => ({ length: 0, item: () => null, [Symbol.iterator]: [][Symbol.iterator] }) as unknown as DOMRectList;
document.elementFromPoint ??= () => null;

let host: HTMLDivElement;
let root: Root;
beforeAll(async () => {
  dir = await fsp.mkdtemp(join(tmpdir(), 'ilmi-title-'));
  await fsp.mkdir(join(dir, 'notes'), { recursive: true });
  await fsp.writeFile(join(dir, NOTE), 'kāna and its sisters take the subject in the nominative.\n');
  vault = await Vault.open(nodeFs, dir);
  const docs: Record<string, DocInfo> = { [NOTE]: { type: 'note', frozen: false, cards: 0, due: 0, title: 'kāna and its sisters' } as DocInfo };
  useApp.setState({ vault: dir, tree: vault.tree, files: vault.documents(), docs, reveal: null });
});
afterAll(async () => { vault.close(); await fsp.rm(dir, { recursive: true, force: true }); });
afterEach(() => { act(() => root.unmount()); host.remove(); renames.length = 0; });

async function mount() {
  host = document.body.appendChild(document.createElement('div'));
  root = createRoot(host);
  await act(async () => { root.render(createElement(Reader, { id: NOTE })); });
  await act(async () => { await new Promise((r) => setTimeout(r, 30)); });
  return host.querySelector<HTMLElement>('h1.doc-title')!;
}
const typeAs = (h: HTMLElement, t: string) => act(() => { h.focus(); h.textContent = t; });
const key = (h: HTMLElement, k: string) => act(() => { h.dispatchEvent(new KeyboardEvent('keydown', { key: k, bubbles: true, cancelable: true })); });

describe('the title at the top of a note', () => {
  it('is editable where it stands, showing the title', async () => {
    const h = await mount();
    expect(h.getAttribute('contenteditable')).toBe('plaintext-only');
    expect(h.textContent).toBe('kāna and its sisters');
  });

  it('⏎ renames it as the tree does, once, with the spaces tidied', async () => {
    const h = await mount();
    typeAs(h, '  kāna  and her sisters ');
    key(h, 'Enter');
    act(() => { h.blur(); });
    await act(async () => { await Promise.resolve(); });
    expect(renames).toEqual([`${NOTE} → kāna and her sisters`]);
  });

  it('leaving it renames too', async () => {
    const h = await mount();
    typeAs(h, 'the sisters of kāna');
    act(() => { h.blur(); });
    expect(renames).toEqual([`${NOTE} → the sisters of kāna`]);
  });

  it('Escape puts the title back and renames nothing', async () => {
    const h = await mount();
    typeAs(h, 'something else');
    key(h, 'Escape');
    act(() => { h.blur(); });
    expect(renames).toEqual([]);
    expect(h.textContent).toBe('kāna and its sisters');
  });

  it('an empty or unchanged title renames nothing, the title kept', async () => {
    const h = await mount();
    typeAs(h, '   ');
    act(() => { h.blur(); });
    expect(h.textContent).toBe('kāna and its sisters');
    typeAs(h, 'kāna and its sisters');
    act(() => { h.blur(); });
    expect(renames).toEqual([]);
  });
});
