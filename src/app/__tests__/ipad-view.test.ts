// @vitest-environment jsdom
// The iPad's side of the shell (milestone 55), drawn in jsdom: the welcome
// is `connect` and the collections there are, with no folder to pick or drop;
// `connect` takes a remote and a token and hands them to the clone, whose
// words show when it fails; the top strip has a toggle for the sidebar; the
// tab bar offers no split; the palette leaves out what needs a second pane
// or a folder picker. The Mac's welcome is drawn beside it: a new
// collection named, a folder imported (milestone 59).

import { act, createElement } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { emptyPanes, openBeside, openTab, splitPane } from '../panes.js';
import { SESSION, notesId } from '../names.js';
import { DESKTOP, NEVER, setPlatform } from '../platform.js';
import { useApp } from '../store.js';

const calls: string[] = [];
let cloneFails: string | null = null;

vi.mock('../vault.js', async (orig) => {
  const real = await orig<typeof import('../vault.js')>();
  return {
    ...real,
    connectClone: vi.fn(async (url: string, token: string) => {
      calls.push(`clone ${url}|${token}`);
      if (cloneFails) throw new Error(cloneFails);
      return null;
    }),
    openVault: vi.fn(async (path: string) => { calls.push(`open ${path}`); return null; }),
    importVault: vi.fn(async () => { calls.push('import'); return null; }),
    importVaultFrom: vi.fn(async (dir: string) => { calls.push(`import ${dir}`); return null; }),
  };
});

vi.mock('../crdt.js', async (orig) => {
  const real = await orig<typeof import('../crdt.js')>();
  return {
    ...real,
    joinCollection: vi.fn(async (s: { kind: string; address: string }, name: string) => {
      calls.push(`join ${s.kind} ${s.address} as ${name}`);
      if (cloneFails) throw new Error(cloneFails);
      return `${DOCS}/${name}`;
    }),
  };
});

const { Welcome } = await import('../Welcome.js');
const { TopStrip } = await import('../TopStrip.js');
const { Canvas } = await import('../Canvas.js');
const { dropRoutes } = await import('../land.js');

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

const DOCS = '/var/mobile/Containers/Data/Application/AAAA/Documents';
let host: HTMLElement;
let root: Root;

const draw = async (el: ReturnType<typeof createElement>) => {
  root = createRoot(host);
  await act(async () => { root.render(el); });
};
const q = <T extends Element>(sel: string) => host.querySelector<T>(sel);
const qa = <T extends Element>(sel: string) => Array.from(host.querySelectorAll<T>(sel));
const type = async (el: HTMLInputElement, text: string) => {
  await act(async () => {
    Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value')!.set!.call(el, text);
    el.dispatchEvent(new Event('input', { bubbles: true }));
  });
};
const click = async (el: Element | null) => { await act(async () => { (el as HTMLElement).click(); }); };
const key = async (k: string) => { await act(async () => { window.dispatchEvent(new KeyboardEvent('keydown', { key: k, bubbles: true, cancelable: true })); }); };

const initial = useApp.getState();

beforeEach(() => {
  calls.length = 0;
  cloneFails = null;
  host = document.createElement('div');
  document.body.appendChild(host);
  setPlatform({ mobile: true, documents: DOCS });
  useApp.setState({
    ...initial,
    mobile: true,
    started: true,
    recents: [
      { path: `${DOCS}/double-major`, name: 'double-major', opened: new Date().toISOString() },
      { path: `${DOCS}/by-hand`, name: 'by-hand', opened: NEVER },
    ],
    gone: [],
  });
});

afterEach(async () => {
  await act(async () => { root?.unmount(); });
  host.remove();
  setPlatform(DESKTOP);
  useApp.setState({ ...initial, mobile: false });
});

describe("joining a storage from the welcome (milestone 71)", () => {
  const seg = (word: string) => qa<HTMLButtonElement>('.welcome-join .tw-seg button').find((b) => b.textContent === word)!;
  const go = () => q<HTMLButtonElement>('.welcome-join .welcome-go')!;
  const fill = async (label: string, text: string) => {
    const row = qa<HTMLElement>('.welcome-join .tw-row').find((r) => r.querySelector('.tw-lbl')?.textContent === label)!;
    const el = row.querySelector<HTMLInputElement>('input')!;
    await type(el, text);
    await act(async () => { el.dispatchEvent(new FocusEvent('focusout', { bubbles: true })); });
  };
  const openJoin = async () => {
    await draw(createElement(Welcome));
    await click(qa('.welcome-acts button').find((b) => b.textContent === 'join')!);
  };

  it('offers Tweaks\' kinds with no folder to pick and no icloud without its container, the fields each wants, and joins when they are filled', async () => {
    await openJoin();
    expect(qa('.welcome-join .tw-seg.wrap button').map((b) => b.textContent)).toEqual(['s3', 'webdav', 'dropbox', 'google drive']);
    expect(go().disabled).toBe(true);
    await click(seg('webdav'));
    await fill('address', 'https://dav.example.org/notes/');
    expect(go().disabled).toBe(false);
    await click(go());
    expect(calls).toEqual(['join webdav https://dav.example.org/notes/ as notes', `open ${DOCS}/notes`]);
  });

  it('a join that fails says why and stays', async () => {
    await openJoin();
    await click(seg('webdav'));
    await fill('address', 'https://dav.example.org/notes');
    cloneFails = 'the storage holds nothing to join';
    await click(go());
    expect(q('.welcome-join .welcome-problem')?.textContent).toBe('the storage holds nothing to join');
    expect(calls).toEqual(['join webdav https://dav.example.org/notes as notes']);
  });

  it('a service asks for a sign-in before it can join', async () => {
    await openJoin();
    await click(seg('dropbox'));
    await fill('app key', 'k');
    await fill('folder', 'notes');
    expect(go().disabled).toBe(true);
    expect(qa('.welcome-join .tw-row').some((r) => r.textContent?.includes('sign in'))).toBe(true);
    expect(qa('.welcome-join button').some((b) => b.textContent === 'sign out')).toBe(false);
  });
});

describe("the iPad's welcome", () => {
  it('offers connect and join, and lists the collections by name', async () => {
    await draw(createElement(Welcome));
    expect(qa('.welcome-acts button').map((b) => b.textContent)).toEqual(['connect', 'join']);
    expect(q('.palette-foot')?.textContent).toContain('connect');
    expect(q('.palette-foot')?.textContent).not.toContain('new collection');
    const rows = qa('.welcome-row');
    expect(rows.map((r) => r.querySelector('.pt')?.textContent)).toEqual(['double-major', 'by-hand']);
    // no path on a row (it is the app's container), and no time for a vault never opened here
    expect(rows.map((r) => r.querySelector('.psub')?.textContent)).toEqual(['', '']);
    expect(rows[0]!.querySelector('.ptag')?.textContent).toMatch(/^opened /);
    expect(rows[1]!.querySelector('.ptag')?.textContent).toBe('');
    // nothing takes a dropped folder
    expect(dropRoutes.welcome).toBeUndefined();
    await click(rows[0]!);
    expect(calls).toEqual([`open ${DOCS}/double-major`]);
  });

  it('clones what connect is given, and says why when it cannot', async () => {
    await draw(createElement(Welcome));
    expect(q('.welcome-connect')).toBeNull();
    await click(q('.welcome-acts button'));
    const [remote, token] = qa<HTMLInputElement>('.welcome-connect input');
    expect(token!.type).toBe('password');
    const go = q<HTMLButtonElement>('.welcome-go')!;
    expect(go.disabled).toBe(true);
    await type(remote!, 'https://github.com/me/notes.git');
    await type(token!, 'secret');
    expect(go.disabled).toBe(false);
    cloneFails = 'not an empty folder';
    await click(go);
    expect(calls).toEqual(['clone https://github.com/me/notes.git|secret']);
    expect(q('.welcome-problem')?.textContent).toBe('not an empty folder');
    // the fields stay for another try; ⏎ in a field is the button
    cloneFails = null;
    await type(remote!, 'https://github.com/me/other.git');
    expect(q('.welcome-problem')?.textContent).toBe('');
    await act(async () => { remote!.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', bubbles: true, cancelable: true })); });
    expect(calls.at(-1)).toBe('clone https://github.com/me/other.git|secret');
    expect(q('.welcome-problem')?.textContent).toBe('cloning…');
  });

  it('takes c for connect and leaves o and n alone', async () => {
    await draw(createElement(Welcome));
    await key('o');
    await key('n');
    expect(calls).toEqual([]);
    await key('c');
    expect(q('.welcome-connect')).not.toBeNull();
  });
});

describe("the Mac's welcome", () => {
  it('names a new collection or imports a folder, picked or dropped; a row carries no path', async () => {
    setPlatform(DESKTOP);
    useApp.setState({ mobile: false, recents: [{ path: '/data/collections/notes', name: 'notes', opened: new Date().toISOString() }] });
    await draw(createElement(Welcome));
    expect(qa('.welcome-acts button').map((b) => b.textContent)).toEqual(['new collection', 'import folder']);
    expect(q('.welcome-line')?.textContent).toContain('A collection is a database on this device');
    expect(q('.palette-foot')?.textContent).toContain('import folder');
    // the path is the app's own folder: the name says which
    expect(q('.welcome-row .pt')?.textContent).toBe('notes');
    expect(q('.welcome-row .psub')?.textContent).toBe('');
    expect(dropRoutes.welcome).toBeDefined();
    await key('c');
    expect(q('.welcome-connect')).toBeNull();
    // o opened a folder as a vault once: nothing now
    await key('o');
    expect(calls).toEqual([]);
    await key('i');
    expect(calls).toEqual(['import']);
    // a folder dropped on the window is imported
    await act(async () => { dropRoutes.welcome!({ type: 'drop', paths: ['/Users/me/old notes/'], position: { x: 0, y: 0 } } as never); });
    expect(calls).toEqual(['import', 'import /Users/me/old notes']);
    // n asks for the name here, with no folder to pick first
    expect(q('.welcome-name input')).toBeNull();
    await key('n');
    expect(q('.welcome-name input')).not.toBeNull();
    expect(q('.welcome-name .psub')?.textContent).toBe('new collection');
  });
});

describe("the iPad's shell", () => {
  it('has a toggle for the sidebar in the top strip, the Mac none', async () => {
    useApp.setState({ vault: `${DOCS}/double-major`, sidebar: { width: 240, hidden: true } });
    await draw(createElement(TopStrip));
    const toggle = q<HTMLElement>('.top .side-toggle');
    expect(toggle).not.toBeNull();
    expect(toggle!.dataset.on).toBe('0');
    expect(qa('.top .insp-toggle')).toHaveLength(2);
    await act(async () => { root.unmount(); });
    useApp.setState({ mobile: false });
    await draw(createElement(TopStrip));
    expect(q('.top .side-toggle')).toBeNull();
    expect(qa('.top .insp-toggle')).toHaveLength(1);
  });

  it('is one pane: no split in the tab bar, and a split asked for folds back', async () => {
    useApp.setState({ vault: `${DOCS}/double-major`, panes: openTab(emptyPanes(), ':queue:today') });
    await draw(createElement(Canvas));
    expect(qa('.pane')).toHaveLength(1);
    expect(q('.tabbar .ctl')).toBeNull();
    await act(async () => { useApp.getState().setPanes((p) => openTab(splitPane(p, 0), ':queue:upcoming')); });
    expect(useApp.getState().panes.panes).toHaveLength(1);
    expect(useApp.getState().panes.panes[0]!.tabs).toHaveLength(2);
    expect(qa('.pane')).toHaveLength(1);
  });

  it('keeps a second pane for a PDF\'s pages and the note on them, and for nothing else (milestone 70)', async () => {
    const CH = 'library/ch-3.md';
    const P = 'library/alone.pdf';
    const N = 'fleeting/on-alone.md';
    const OTHER = 'fleeting/other.md';
    const info = { type: 'note' as const, frozen: false, cards: 0, due: 0 };
    const docs = { [CH]: { ...info, type: 'source' as const, pdf: 'library/book.pdf' }, [P]: { ...info, type: 'source' as const, pdf: P, note: N }, [N]: { ...info, of: P }, [OTHER]: info };
    const two = (a: string, b: string) => openBeside(openTab(emptyPanes(), a), b);
    const held = async (panes: ReturnType<typeof two>) => {
      await act(async () => { useApp.setState({ docs, panes }); });
      return useApp.getState().panes.panes.length;
    };
    // a document with pages and its `:notes/` tab; a PDF on its own and its note, either way round
    expect(await held(two(CH, notesId(CH)))).toBe(2);
    expect(await held(two(P, N))).toBe(2);
    expect(await held(two(N, P))).toBe(2);
    // a session on the pages counts as them
    await act(async () => { useApp.setState({ sessionEl: { kind: 'section', label: '', item: { path: N, kind: 'section' } as never } }); });
    expect(await held(two(SESSION, N))).toBe(2);
    await act(async () => { useApp.setState({ sessionEl: null }); });
    expect(useApp.getState().panes.panes).toHaveLength(1);
    // anything else folds, and the pair folds when the pages' tab moves on; the note is then a tab, which `notes` moves beside again
    expect(await held(two(CH, OTHER))).toBe(1);
    expect(await held(two(P, notesId(CH)))).toBe(1);
    await held(two(P, N));
    await act(async () => { useApp.getState().setPanes((s) => openTab(s, OTHER)); });
    expect(useApp.getState().panes.panes).toHaveLength(1);
    expect(useApp.getState().panes.panes[0]!.tabs.map((t) => t.id)).toEqual([OTHER, N]);
    await act(async () => { useApp.getState().setPanes((s) => openBeside(openTab(s, P), N)); });
    expect(useApp.getState().panes.panes.map((p) => p.tabs.map((t) => t.id))).toEqual([[P], [N]]);
  });
});
