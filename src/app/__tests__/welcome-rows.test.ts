// @vitest-environment jsdom
// The welcome's rows: a collection renamed in place and deleted after an ask
// on its row, from the row's menu (right-click, a long press, `···`) and by
// the tree's keys (F2, ⌘⌫). The Rust side is stood in for by a list of names
// here; `store.rs`'s own test moves the folder.

import { act, createElement } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const HOME = '/data/collections';
const at = (name: string) => `${HOME}/${name}`;

/** The collections there are, which of them a window has open, and what each holds. */
const there = new Set<string>();
const held = new Set<string>();
const holds = new Map<string, { cards: number; documents: number }>();
const calls: string[] = [];

vi.mock('../../vault/tauri-store.js', async (orig) => ({
  ...(await orig<typeof import('../../vault/tauri-store.js')>()),
  listCollections: async () => ({ home: HOME, names: [...there].sort() }),
  collectionHeld: async (root: string) => held.has(root.slice(HOME.length + 1)),
  collectionCounts: async (root: string) => {
    const n = holds.get(root.slice(HOME.length + 1));
    if (!n) throw new Error('unable to open database file');
    return n;
  },
  renameCollection: async (root: string, name: string) => {
    const from = root.slice(HOME.length + 1);
    calls.push(`rename ${from} -> ${name}`);
    if (held.has(from)) throw 'close it first';
    if ([...there].some((n) => n !== from && n.toLowerCase() === name.toLowerCase())) throw 'already there';
    there.delete(from);
    there.add(name);
    return at(name);
  },
  deleteCollection: async (root: string) => {
    calls.push(`delete ${root.slice(HOME.length + 1)}`);
    there.delete(root.slice(HOME.length + 1));
  },
}));
vi.mock('@tauri-apps/plugin-log', async (orig) => ({ ...(await orig<typeof import('@tauri-apps/plugin-log')>()), info: async () => {} }));

const { useApp } = await import('../store.js');
const { Welcome, deleteAsk } = await import('../Welcome.js');
const { nameProblem } = await import('../collections.js');
const { setCollectionsHome, NEVER } = await import('../platform.js');
const { decideStart, renameRecent } = await import('../recents.js');
const { NO_STORAGE, saveStorage, storageOf } = await import('../storage.js');
const { saveSettings, settingsOf } = await import('../sync.js');
const { mirrorOf } = await import('../keep.js');

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

let host: HTMLElement;
let root: Root | null = null;
const q = <T extends Element>(sel: string) => document.querySelector<T>(sel);
const qa = <T extends Element>(sel: string) => Array.from(document.querySelectorAll<T>(sel));
const names = () => qa('.welcome-row .pt').map((e) => e.textContent);
const rowOf = (name: string) => qa<HTMLElement>('.welcome-row').find((r) => r.querySelector('.pt')?.textContent === name)!;
const settle = async () => { await act(async () => { for (let i = 0; i < 6; i++) await Promise.resolve(); await new Promise((r) => setTimeout(r, 0)); }); };
const type = async (el: HTMLInputElement, text: string) => {
  await act(async () => {
    Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value')!.set!.call(el, text);
    el.dispatchEvent(new Event('input', { bubbles: true }));
  });
};
const key = async (el: EventTarget, init: KeyboardEventInit) => {
  await act(async () => { el.dispatchEvent(new KeyboardEvent('keydown', { bubbles: true, cancelable: true, ...init })); });
  await settle();
};
const click = async (el: Element | null | undefined) => {
  expect(el).toBeTruthy();
  await act(async () => { el!.dispatchEvent(new MouseEvent('click', { bubbles: true, cancelable: true })); });
  await settle();
};
const rightClick = async (el: Element) => {
  await act(async () => { el.dispatchEvent(new MouseEvent('contextmenu', { bubbles: true, cancelable: true, button: 2, clientX: 40, clientY: 60 })); });
};
const menuItems = () => qa('.ctx-menu .ci').map((e) => (e as HTMLElement).dataset.act);

const T1 = '2026-11-14T10:00:00.000Z';
const T2 = '2026-11-12T10:00:00.000Z';
const initial = useApp.getState();

async function welcome(opts: { mobile?: boolean } = {}): Promise<void> {
  useApp.setState({
    started: true,
    mobile: opts.mobile ?? false,
    recents: [
      { path: at('arabic'), name: 'arabic', opened: T1 },
      { path: at('fiqh'), name: 'fiqh', opened: T2 },
      { path: at('new'), name: 'new', opened: NEVER },
    ],
  });
  root = createRoot(host);
  await act(async () => { root!.render(createElement(Welcome)); });
}

beforeEach(() => {
  vi.spyOn(console, 'error').mockImplementation(() => {});
  localStorage.clear();
  there.clear();
  held.clear();
  holds.clear();
  calls.length = 0;
  for (const n of ['arabic', 'fiqh', 'new']) there.add(n);
  holds.set('arabic', { cards: 758, documents: 66 });
  holds.set('fiqh', { cards: 1, documents: 1 });
  setCollectionsHome(HOME);
  host = document.createElement('div');
  document.body.appendChild(host);
});
afterEach(async () => {
  if (root) await act(async () => { root!.unmount(); });
  root = null;
  host.remove();
  setCollectionsHome(null);
  useApp.setState({ ...initial });
});

describe('a row\'s menu', () => {
  it('a right-click on a row offers rename… and delete…, and Esc lets it go', async () => {
    await welcome();
    await rightClick(rowOf('fiqh'));
    expect(q('.ctx-menu')).toBeTruthy();
    expect(menuItems()).toEqual(['rename', 'delete']);
    expect(q('.ctx-menu')!.textContent).toContain('rename…');
    expect(q('.ctx-menu')!.textContent).toContain('delete…');
    // the row it is for is the selected one
    expect(rowOf('fiqh').dataset.sel).toBe('1');
    await key(window, { key: 'Escape' });
    expect(q('.ctx-menu')).toBeNull();
    // and nothing opened under it
    expect(useApp.getState().vault).toBeNull();
  });

  it('the row\'s ··· opens the same menu, and does not open the collection', async () => {
    await welcome();
    await click(rowOf('arabic').querySelector('.welcome-more'));
    expect(menuItems()).toEqual(['rename', 'delete']);
    expect(useApp.getState().vault).toBeNull();
    // a press elsewhere closes it
    await act(async () => { document.body.dispatchEvent(new MouseEvent('mousedown', { bubbles: true })); });
    expect(q('.ctx-menu')).toBeNull();
  });

  it('on an iPad a long press (a contextmenu event) is the menu', async () => {
    await welcome({ mobile: true });
    await rightClick(rowOf('arabic').querySelector('.pt')!);
    expect(menuItems()).toEqual(['rename', 'delete']);
  });

  it('a row that is not where it was has forget, and no menu', async () => {
    await welcome();
    await act(async () => { useApp.setState({ gone: [at('fiqh')] }); });
    await rightClick(rowOf('fiqh'));
    expect(q('.ctx-menu')).toBeNull();
    expect(rowOf('fiqh').querySelector('.welcome-more')).toBeNull();
    expect(rowOf('fiqh').querySelector('.welcome-forget')).toBeTruthy();
  });
});

describe('rename', () => {
  it('F2 makes the selected row\'s name a field; ⏎ moves the collection, and the row, its time and what is kept outside it follow', async () => {
    saveStorage(at('arabic'), { ...NO_STORAGE, on: true, kind: 's3', bucket: 'b', dev: 'd1' });
    saveSettings(at('arabic'), { url: 'https://host/arabic.git', token: 't', server: '' });
    localStorage.setItem('ilmi.mirror', JSON.stringify({ 'collection:arabic': '/Volumes/disk/arabic' }));
    // what a collection once called `lugha` left behind is not this one's
    localStorage.setItem('ilmi.sync', JSON.stringify({ ...JSON.parse(localStorage.getItem('ilmi.sync')!), 'collection:lugha': { url: 'https://host/old.git', token: '', server: '' } }));
    await welcome();
    await key(window, { key: 'F2' });
    const field = q<HTMLInputElement>('.welcome-row .welcome-rename')!;
    expect(field).toBeTruthy();
    expect(field.value).toBe('arabic');
    expect(document.activeElement).toBe(field);
    await type(field, ' lugha ');
    await key(field, { key: 'Enter' });
    expect(calls).toEqual(['rename arabic -> lugha']);
    expect(q('.welcome-rename')).toBeNull();
    expect(names()).toEqual(['lugha', 'fiqh', 'new']);
    const s = useApp.getState();
    expect(s.recents[0]).toEqual({ path: at('lugha'), name: 'lugha', opened: T1 });
    expect(JSON.parse(localStorage.getItem('ilmi.recents')!)[0].path).toBe(at('lugha'));
    // the one reopened on start is still this one
    expect(decideStart(s.recents, true, new Set(s.recents.map((r) => r.path)))).toEqual({ kind: 'reopen', path: at('lugha') });
    // its storage, its remote and its mirror are the renamed collection's, and nothing is left under the old name
    expect(storageOf(at('lugha'))).toMatchObject({ on: true, kind: 's3', bucket: 'b', dev: 'd1' });
    expect(settingsOf(at('lugha'))).toEqual({ url: 'https://host/arabic.git', token: 't', server: '' });
    expect(mirrorOf(at('lugha'))).toBe('/Volumes/disk/arabic');
    expect(storageOf(at('arabic')).on).toBe(false);
    expect(settingsOf(at('arabic')).url).toBe('');
    expect(mirrorOf(at('arabic'))).toBe('');
    expect(rowOf('lugha').dataset.sel).toBe('1');
    // ⏎ in the field did not open the collection
    expect(s.vault).toBeNull();
  });

  it('a name already taken is refused on the row and the field stays; Esc cancels', async () => {
    await welcome();
    await rightClick(rowOf('fiqh'));
    await click(q('.ctx-menu [data-act="rename"]'));
    expect(q('.ctx-menu')).toBeNull();
    const field = q<HTMLInputElement>('.welcome-rename')!;
    await type(field, 'Arabic');
    await key(field, { key: 'Enter' });
    expect(calls).toEqual([]);
    expect(q('.welcome-rename')).toBeTruthy();
    expect(q('.welcome-row[data-sel="1"] .psub')!.textContent).toBe('already there');
    await type(q<HTMLInputElement>('.welcome-rename')!, 'a/b');
    expect(q('.welcome-row[data-sel="1"] .psub')!.textContent).toBe('');
    await key(q('.welcome-rename')!, { key: 'Enter' });
    expect(q('.welcome-row[data-sel="1"] .psub')!.textContent).toBe('not a name');
    await key(q('.welcome-rename')!, { key: 'Escape' });
    expect(q('.welcome-rename')).toBeNull();
    expect(names()).toEqual(['arabic', 'fiqh', 'new']);
    expect(rowOf('fiqh').querySelector('.psub')!.textContent).toBe('');
    expect(calls).toEqual([]);
  });

  it('a blur commits; the same name, or none, changes nothing', async () => {
    await welcome();
    await key(window, { key: 'F2' });
    await type(q<HTMLInputElement>('.welcome-rename')!, 'nahw');
    await act(async () => { q<HTMLInputElement>('.welcome-rename')!.blur(); });
    await settle();
    expect(calls).toEqual(['rename arabic -> nahw']);
    expect(names()).toEqual(['nahw', 'fiqh', 'new']);
    await key(window, { key: 'F2' });
    await type(q<HTMLInputElement>('.welcome-rename')!, '  ');
    await key(q('.welcome-rename')!, { key: 'Enter' });
    await key(window, { key: 'F2' });
    await key(q('.welcome-rename')!, { key: 'Enter' });
    expect(q('.welcome-rename')).toBeNull();
    expect(calls).toEqual(['rename arabic -> nahw']);
  });

  it('a collection a window has open is not renamed: close it first', async () => {
    held.add('arabic');
    await welcome();
    await key(window, { key: 'F2' });
    await type(q<HTMLInputElement>('.welcome-rename')!, 'lugha');
    await key(q('.welcome-rename')!, { key: 'Enter' });
    expect(names()).toEqual(['arabic', 'fiqh', 'new']);
    expect(rowOf('arabic').querySelector('.psub')!.textContent).toBe('close it first');
    expect(useApp.getState().recents[0]!.path).toBe(at('arabic'));
  });

  it('the names it refuses are the ones the Rust side would', () => {
    expect(nameProblem('  ', [])).toBe('not a name');
    expect(nameProblem('.hidden', [])).toBe('not a name');
    expect(nameProblem('a/b', [])).toBe('not a name');
    expect(nameProblem('a\\b', [])).toBe('not a name');
    expect(nameProblem('a:b', [])).toBe('not a name');
    expect(nameProblem('Notes', ['notes'])).toBe('already there');
    expect(nameProblem('double major 2', ['notes'])).toBeNull();
    expect(renameRecent([{ path: '/c/a', name: 'a', opened: T1 }, { path: '/c/b', name: 'b', opened: T2 }], '/c/b', '/c/z')).toEqual([{ path: '/c/a', name: 'a', opened: T1 }, { path: '/c/z', name: 'z', opened: T2 }]);
  });
});

describe('delete', () => {
  it('⌘⌫ asks on the row, naming what goes, the focus on keep; Esc keeps', async () => {
    saveStorage(at('arabic'), { ...NO_STORAGE, on: true, kind: 'folder', folder: '/Volumes/disk/sync' });
    await welcome();
    await key(window, { key: 'Backspace', metaKey: true });
    const row = q<HTMLElement>('.welcome-row[data-ask="1"]')!;
    expect(row).toBeTruthy();
    expect(row.querySelector('.welcome-ask')!.textContent).toBe('delete arabic? its 758 cards and 66 documents are removed from this device. its storage keeps what was sent. this cannot be undone.');
    expect(Array.from(row.querySelectorAll('button')).map((b) => b.textContent)).toEqual(['delete', 'keep']);
    expect(document.activeElement).toBe(row.querySelector('.welcome-keep'));
    // ⏎ is the focused button's, not the list's: nothing opens
    await key(row.querySelector('.welcome-keep')!, { key: 'Enter' });
    expect(useApp.getState().vault).toBeNull();
    await key(window, { key: 'Escape' });
    expect(q('.welcome-row[data-ask="1"]')).toBeNull();
    expect(names()).toEqual(['arabic', 'fiqh', 'new']);
    expect(calls).toEqual([]);
    expect([...there]).toContain('arabic');
  });

  it('delete removes the collection, its row, and what the recents and the settings kept of it', async () => {
    saveStorage(at('fiqh'), { ...NO_STORAGE, on: true, kind: 'folder', folder: '/Volumes/disk/sync' });
    saveSettings(at('fiqh'), { url: 'https://host/fiqh.git', token: 't', server: '' });
    await welcome();
    await rightClick(rowOf('fiqh'));
    await click(q('.ctx-menu [data-act="delete"]'));
    expect(q('.ctx-menu')).toBeNull();
    expect(q('.welcome-ask')!.textContent).toContain('delete fiqh? its 1 card and 1 document are removed');
    await click(q('.welcome-row[data-ask="1"] .welcome-keep'));
    expect(calls).toEqual([]);
    await key(window, { key: 'Backspace', metaKey: true });
    await click(q('.welcome-row[data-ask="1"] .welcome-del'));
    expect(calls).toEqual(['delete fiqh']);
    expect(names()).toEqual(['arabic', 'new']);
    expect(useApp.getState().recents.map((r) => r.name)).toEqual(['arabic', 'new']);
    expect(JSON.parse(localStorage.getItem('ilmi.recents')!).map((r: { name: string }) => r.name)).toEqual(['arabic', 'new']);
    // a collection named fiqh later does not find a storage waiting for it
    expect(storageOf(at('fiqh')).on).toBe(false);
    expect(settingsOf(at('fiqh')).url).toBe('');
    expect(useApp.getState().vault).toBeNull();
  });

  it('a collection a window has open is not asked about: close it first', async () => {
    held.add('arabic');
    await welcome();
    await key(window, { key: 'Backspace', metaKey: true });
    expect(q('.welcome-row[data-ask="1"]')).toBeNull();
    expect(rowOf('arabic').querySelector('.psub')!.textContent).toBe('close it first');
    expect(calls).toEqual([]);
  });

  it('a collection whose tables cannot be read is asked about by its name alone', async () => {
    await welcome();
    await rightClick(rowOf('new'));
    await click(q('.ctx-menu [data-act="delete"]'));
    expect(q('.welcome-ask')!.textContent).toBe('delete new? it is removed from this device. this cannot be undone.');
  });

  it('the ask says where what was synced stays, and this mac on a Mac', () => {
    expect(deleteAsk('a', null, 'remote', true)).toBe('delete a? it is removed from this device. its remote keeps what was pushed. this cannot be undone.');
    const ua = vi.spyOn(navigator, 'userAgent', 'get').mockReturnValue('Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7)');
    expect(deleteAsk('a', { cards: 2, documents: 0 }, null, false)).toBe('delete a? its 2 cards and 0 documents are removed from this mac. this cannot be undone.');
    expect(deleteAsk('a', null, null, true)).toContain('this device');
    ua.mockRestore();
  });
});
