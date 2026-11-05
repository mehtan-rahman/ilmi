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
import { emptyPanes, openTab, splitPane } from '../panes.js';
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

describe("the iPad's welcome", () => {
  it('offers connect alone, and lists the collections by name', async () => {
    await draw(createElement(Welcome));
    expect(qa('.welcome-acts button').map((b) => b.textContent)).toEqual(['connect']);
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
});
