// @vitest-environment jsdom
// An audit's findings over the shell (the welcome, the tree, tabs and panes,
// the palette, the tweaks, the global keys), each as a test that states the
// behaviour a person would expect. Every test here FAILS until its finding
// is fixed; the ones named `control` pass and show the harness is sound.

import { promises as fsp, readFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { act, createElement, useEffect } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { meta as metaOf } from '../../format/index.js';
import { nodeFs } from '../../vault/node-fs.js';
import { Vault } from '../../vault/index.js';
import { buildIndex, search, withText, type Entry } from '../chrome.js';
import { SESSION } from '../names.js';
import { closePane, closeTab, emptyPanes, openTab } from '../panes.js';
import type { DocInfo } from '../store.js';

const SAMPLE = join(import.meta.dirname, '../../../samples/double-major');
const ROOT = '/collections/sweep';
const BAD = '/collections/gone';

type StoreFs = import('../../vault/index.js').StoreFs;
let fs: StoreFs;
let crdtRunning = false;
const lensMounts: string[] = [];

vi.mock('../collections.js', async (orig) => ({
  ...(await orig<typeof import('../collections.js')>()),
  collectionFs: (path: string) => { if (path === BAD) throw new Error('unable to open database file'); return fs; },
}));
vi.mock('../crdt.js', async (orig) => ({
  ...(await orig<typeof import('../crdt.js')>()),
  startCrdt: async () => { crdtRunning = true; return true; },
  stopCrdt: () => { crdtRunning = false; },
}));
vi.mock('../keep.js', async (orig) => ({ ...(await orig<typeof import('../keep.js')>()), startMirror: async () => {}, stopMirror: () => {}, keepDatedSoon: () => {}, stopDated: () => {} }));
vi.mock('@tauri-apps/plugin-log', async (orig) => ({ ...(await orig<typeof import('@tauri-apps/plugin-log')>()), info: async () => {} }));
vi.mock('../../plugins/index.js', async (orig) => ({ ...(await orig<typeof import('../../plugins/index.js')>()), startPlugins: async () => ({}), stopPlugins: () => {} }));
// the plugins' rows ask for the webview: left out
vi.mock('../../plugins/PluginsSection.js', () => ({ PluginsSection: () => null }));
// the canvas's lens, as a stand-in that says when it is mounted: what a pane draws is not what is checked here
vi.mock('../Lenses.js', () => ({
  Lens: ({ id }: { id: string }) => {
    useEffect(() => { lensMounts.push(id); }, []);
    return createElement('div', { className: 'lens-stub' }, id);
  },
}));

const { memStore } = await import('../../vault/mem-store.js');
const { storeFs } = await import('../../vault/store.js');
const { closeTabs, closeVault, openNode, openVault, reopenClosed } = await import('../vault.js');
const { useApp } = await import('../store.js');
const { App } = await import('../App.js');
const { Tree } = await import('../Tree.js');
const { Tweaks } = await import('../Tweaks.js');
const { Welcome } = await import('../Welcome.js');
const { Canvas } = await import('../Canvas.js');

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
(globalThis as { ResizeObserver?: unknown }).ResizeObserver ??= class { observe() {} unobserve() {} disconnect() {} };

let host: HTMLElement;
let root: Root | null = null;
const draw = async (el: ReturnType<typeof createElement>) => {
  root = createRoot(host);
  await act(async () => { root!.render(el); });
};
const type = async (el: HTMLInputElement, text: string) => {
  await act(async () => {
    Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value')!.set!.call(el, text);
    el.dispatchEvent(new Event('input', { bubbles: true }));
  });
};
const keyOn = async (el: EventTarget, init: KeyboardEventInit) => {
  let ev!: KeyboardEvent;
  await act(async () => { ev = new KeyboardEvent('keydown', { bubbles: true, cancelable: true, ...init }); el.dispatchEvent(ev); });
  return ev;
};

async function world(): Promise<void> {
  fs = storeFs(memStore(), ROOT);
  await fs.mkdir(ROOT);
  await fs.mkdir(`${ROOT}/f`);
  await fs.writeText(`${ROOT}/f/a.md`, 'a note\n');
  await fs.writeText(`${ROOT}/b.md`, '---\ntype: deck\n---\nq :: a\n');
  await fs.writeText(`${ROOT}/c.md`, 'c note\n');
  await openVault(ROOT);
}

const initial = useApp.getState();

beforeEach(() => {
  lensMounts.length = 0;
  // outside Tauri every `invoke` fails and is logged (the collections listed on a close, the start): not what is checked here
  vi.spyOn(console, 'error').mockImplementation(() => {});
  host = document.createElement('div');
  document.body.appendChild(host);
});
afterEach(async () => {
  if (root) await act(async () => { root!.unmount(); });
  root = null;
  host.remove();
  closeVault();
  useApp.setState({ ...initial, panes: emptyPanes() });
});

// ── the palette's names, over the sample ──────────────────────────

describe('the palette by name, over samples/double-major', () => {
  let index: Entry[];
  beforeEach(async () => {
    const dir = await fsp.mkdtemp(join(tmpdir(), 'ilmi-sweep-'));
    await fsp.cp(SAMPLE, dir, { recursive: true });
    const vault = await Vault.open(nodeFs, dir);
    const docs: Record<string, DocInfo> = {};
    for (const p of vault.documents()) {
      const m = metaOf((await vault.read(p)).doc);
      docs[p] = { type: m.type, frozen: m.frozen, cards: 0, due: 0, ...(m.title !== undefined ? { title: m.title } : {}), ...(m.tabs ? { tabs: true } : {}) } as DocInfo;
    }
    index = buildIndex(vault.tree, docs, []);
    vault.close();
    await fsp.rm(dir, { recursive: true, force: true });
  });
  const rows = (q: string) => withText(search(index, q), [], q);
  const names = (q: string) => rows(q).map((e) => e.title);
  /** The rows that hold `q` nowhere, in the name or in where it is: letters of it, spread out. */
  const scattered = (q: string) => rows(q).filter((e) => !`${e.title} ${e.sub}`.toLowerCase().includes(q)).map((e) => e.title);

  it('control: a name typed in part finds it', () => {
    expect(names('vocab')[0]).toBe('arabic vocabulary');
  });

  it('a row named exactly what was typed comes first: `physics` is the folder physics, not a book with the word in its title and the chapters under it', () => {
    expect(names('physics')[0]).toBe('physics');
  });

  it('letters scattered across a long name are no match: `unit` lists nothing that has no `unit` in it', () => {
    // today sixteen rows come back, each with u, n, i, t somewhere in it, and four of them sit above the text that was found
    expect(scattered('unit')).toEqual([]);
  });

  it('`notes` lists the rows with the word, not more with n, o, t, e, s spread over them', () => {
    expect(scattered('notes')).toEqual([]);
  });
});

// ── the global keys (App.tsx) ─────────────────────────────────────

describe('the global keys', () => {
  it('⌘0 that a note took (a paragraph, the editor prevented its default) leaves the text size alone', async () => {
    useApp.setState({ started: true, zoom: 1.2 });
    await draw(createElement(App));
    // the editor: ProseMirror's key handler takes ⌘0 and prevents its default, as `formatKeys` does (`src/reader/plugins.ts`)
    const page = document.createElement('div');
    page.contentEditable = 'true';
    page.addEventListener('keydown', (e) => { if (e.metaKey && e.code === 'Digit0') e.preventDefault(); });
    host.appendChild(page);
    const ev = await keyOn(page, { key: '0', code: 'Digit0', metaKey: true });
    expect(ev.defaultPrevented).toBe(true);
    expect(useApp.getState().zoom).toBe(1.2);
  });

  it('control: ⌘0 that nothing took is the text size back at 100%', async () => {
    useApp.setState({ started: true, zoom: 1.2 });
    await draw(createElement(App));
    await keyOn(document.body, { key: '0', code: 'Digit0', metaKey: true });
    expect(useApp.getState().zoom).toBe(1);
  });

  it('⌘W closes the tab while the caret is in a field (a card\'s face, a title, a filter)', async () => {
    useApp.setState({ started: true, panes: openTab(openTab(emptyPanes(), 'a.md'), 'b.md', { newTab: true }) });
    await draw(createElement(App));
    const field = document.createElement('textarea');
    host.appendChild(field);
    field.focus();
    await keyOn(field, { key: 'w', code: 'KeyW', metaKey: true });
    expect(useApp.getState().panes.panes[0]!.tabs.map((t) => t.id)).toEqual(['a.md']);
  });
});

// ── the tree's keys against the page's ────────────────────────────

describe('the tree with the focus, a session in front', () => {
  it('a grade key (1–4) reaches the session: the tree\'s jump-to-a-name does not swallow it', async () => {
    await world();
    await draw(createElement(Tree, { activeId: SESSION, onOpen: () => {} }));
    const tree = host.querySelector<HTMLElement>('.tree')!;
    // a click on a row, or on `study` in its menu, leaves the focus here
    tree.focus();
    const heard: string[] = [];
    const onKey = (e: KeyboardEvent) => { heard.push(e.key); };
    window.addEventListener('keydown', onKey);
    try {
      await keyOn(tree, { key: ' ' });
      await keyOn(tree, { key: '3' });
    } finally {
      window.removeEventListener('keydown', onKey);
    }
    // space is heard today (the reveal works); the 3 after it is not
    expect(heard).toEqual([' ', '3']);
  });
});

// ── the tweaks ────────────────────────────────────────────────────

describe('the tweaks', () => {
  it('a remote typed makes `connect` pressable at once, not only after the field loses the focus', async () => {
    await world();
    await draw(createElement(Tweaks));
    const remote = host.querySelector<HTMLInputElement>('input.tw-text')!;
    const connect = Array.from(host.querySelectorAll<HTMLButtonElement>('button')).find((b) => b.textContent === 'connect')!;
    expect(connect.disabled).toBe(true);
    await type(remote, 'https://example.org/me/notes.git');
    // a press on a disabled button does not blur the field in WebKit, so the press does nothing and nothing says why
    expect(connect.disabled).toBe(false);
  });

  it('the panel fits a window: a collection open, it is more than twenty rows, and its box scrolls', async () => {
    await world();
    await draw(createElement(Tweaks));
    // each row is a label over a control (about 44px and a 12px gap): past twenty of them is past 1100px
    expect(host.querySelectorAll('.tweaks .tw-row').length).toBeGreaterThan(20);
    const css = readFileSync(join(import.meta.dirname, '../chrome.css'), 'utf8');
    const rule = /(?:^|\n)\.tweaks \{[^}]*\}/.exec(css)?.[0] ?? '';
    expect(rule).toMatch(/max-height/);
    expect(rule).toMatch(/overflow(-y)?:\s*auto/);
  });
});

// ── a collection that does not open ───────────────────────────────

describe('switching to a collection that fails to open', () => {
  it('leaves the open one as it was: still syncing, and the failure said', async () => {
    await world();
    expect(crdtRunning).toBe(true);
    // the palette's `collections` rows list every recent, a gone one too, and run this
    await openVault(BAD).catch(() => { /* the palette logs it to the console */ });
    expect(useApp.getState().vault).toBe(ROOT);
    // the window still shows the first collection; its sync, its storage, its mirror and its watcher were stopped before the other was tried
    expect(crdtRunning).toBe(true);
  });
});

// ── the welcome under the tweaks ──────────────────────────────────

describe('the welcome with the tweaks open over it', () => {
  it('n does not start a new collection behind the panel', async () => {
    useApp.setState({ started: true, tweaksOpen: true, recents: [{ path: ROOT, name: 'sweep', opened: new Date().toISOString() }] });
    await draw(createElement(Welcome));
    await keyOn(window, { key: 'n' });
    expect(useApp.getState().namingVault).toBe(false);
  });
});

// ── panes ─────────────────────────────────────────────────────────

describe('the canvas', () => {
  it('closing the left pane leaves the right pane\'s page as it is (not drawn again from nothing: its scroll, its caret, its find)', async () => {
    useApp.setState({ vault: ROOT, panes: openTab(openTab(emptyPanes(), 'a.md'), 'b.md', { cmdClick: true, shiftClick: true }) });
    await draw(createElement(Canvas));
    expect(lensMounts).toEqual(['a.md', 'b.md']);
    await act(async () => { useApp.getState().setPanes((s) => closePane(s, 0)); });
    expect(lensMounts.filter((id) => id === 'b.md')).toHaveLength(1);
  });

  it('a pane with no tab says what to do (⌘K, or a row in the sidebar), not a blank', async () => {
    useApp.setState({ vault: ROOT, panes: emptyPanes() });
    await draw(createElement(Canvas));
    expect(host.querySelector('.pane-body')!.textContent).not.toBe('');
  });
});

// ── the tabs between tabs, and between runs (added with the fixes) ─

describe('the tabs', () => {
  const tabs = () => useApp.getState().panes.panes.map((p) => p.tabs.map((t) => t.id));
  const front = () => { const s = useApp.getState().panes; const p = s.panes[s.active]!; return p.tabs[p.active]?.id; };

  it('⌃Tab and ⌘⇧] step to the next tab, ⌃⇧Tab and ⌘⇧[ to the one before; ⌘⇧T opens the tab closed last again', async () => {
    await world();
    openNode('f/a.md');
    openNode('b.md', { newTab: true });
    openNode('c.md', { newTab: true });
    await draw(createElement(App));
    await keyOn(document.body, { key: 'Tab', code: 'Tab', ctrlKey: true });
    expect(front()).toBe('f/a.md');
    await keyOn(document.body, { key: 'Tab', code: 'Tab', ctrlKey: true, shiftKey: true });
    expect(front()).toBe('c.md');
    await keyOn(document.body, { key: '{', code: 'BracketLeft', metaKey: true, shiftKey: true });
    expect(front()).toBe('b.md');
    await keyOn(document.body, { key: '}', code: 'BracketRight', metaKey: true, shiftKey: true });
    expect(front()).toBe('c.md');
    await keyOn(document.body, { key: 'w', code: 'KeyW', metaKey: true });
    await keyOn(document.body, { key: 'w', code: 'KeyW', metaKey: true });
    expect(tabs()).toEqual([['f/a.md']]);
    await keyOn(document.body, { key: 't', code: 'KeyT', metaKey: true, shiftKey: true });
    expect(tabs()).toEqual([['f/a.md', 'b.md']]);
    await keyOn(document.body, { key: 't', code: 'KeyT', metaKey: true, shiftKey: true });
    expect(tabs()).toEqual([['f/a.md', 'b.md', 'c.md']]);
    // nothing more was closed
    await keyOn(document.body, { key: 't', code: 'KeyT', metaKey: true, shiftKey: true });
    expect(tabs()).toEqual([['f/a.md', 'b.md', 'c.md']]);
  });

  it('a closed tab whose document went meanwhile is passed over', async () => {
    await world();
    openNode('f/a.md');
    openNode('b.md', { newTab: true });
    openNode('c.md', { newTab: true });
    closeTabs((s) => closeTab(s, 0, 1));
    closeTabs((s) => closeTab(s, 0, 1));
    useApp.setState((s) => ({ files: s.files.filter((f) => f !== 'c.md') }));
    reopenClosed();
    expect(tabs()).toEqual([['f/a.md', 'b.md']]);
  });

  it('every pane\'s tabs come back when the collection is opened again, a change made just before the close among them', async () => {
    await world();
    openNode('f/a.md');
    openNode('b.md', { newTab: true });
    openNode('c.md', { cmdClick: true, shiftClick: true });
    // closed at once: the save was still waiting
    closeVault();
    await new Promise((r) => setTimeout(r, 30));
    await openVault(ROOT);
    expect(tabs()).toEqual([['f/a.md', 'b.md'], ['c.md']]);
    expect(front()).toBe('c.md');
    // one that is gone by the next run is not back
    await fs.remove(`${ROOT}/c.md`);
    closeVault();
    await openVault(ROOT);
    expect(tabs()).toEqual([['f/a.md', 'b.md']]);
  });
});
