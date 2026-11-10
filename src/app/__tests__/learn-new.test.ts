// @vitest-environment jsdom
// A card never tested comes up to learn first (the `learnNew` tweak, on by
// default; `Session.tsx`): its answer up, one action, got it (space, ⏎),
// which writes nothing and tests it once more at the session's end. A grade
// key grades it at once. A card reviewed before is tested as always, and
// with the tweak off a new card is too.

import { promises as fsp } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { act, createElement } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterAll, afterEach, beforeAll, describe, expect, it, vi } from 'vitest';
import { docItems, type CardItem } from '../../schedule/index.js';
import { nodeFs } from '../../vault/node-fs.js';
import { Vault } from '../../vault/index.js';
import { emptyPanes, openTab } from '../panes.js';
import { useApp } from '../store.js';

const SAMPLE = join(import.meta.dirname, '../../../samples/double-major');
const NOW = new Date('2026-10-30T09:00:00');
let vault: Vault;
let dir: string;
let items: CardItem[] = [];

vi.mock('../vault.js', async (orig) => {
  const real = await orig<typeof import('../vault.js')>();
  return { ...real, currentVault: () => vault, recordReview: async () => {}, note: () => {} };
});
vi.mock('../clock.js', () => ({ appNow: () => NOW }));
const { Session, neverTested } = await import('../Session.js');
(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
(globalThis as { ResizeObserver?: unknown }).ResizeObserver ??= class { observe() {} unobserve() {} disconnect() {} };

beforeAll(async () => {
  dir = await fsp.mkdtemp(join(tmpdir(), 'ilmi-learn-'));
  await fsp.cp(SAMPLE, dir, { recursive: true });
  vault = await Vault.open(nodeFs, dir);
  for (const p of vault.documents()) {
    const own = docItems(p, (await vault.read(p)).doc, NOW);
    items.push(...own.filter((i): i is CardItem => i.kind === 'card' && i.form === 'qa'));
  }
  useApp.setState({ vault: dir, tree: vault.tree, files: vault.documents(), docs: {}, reveal: null, panes: openTab(emptyPanes(), ':session') });
});
afterAll(async () => { vault.close(); await fsp.rm(dir, { recursive: true, force: true }); });

let host: HTMLDivElement;
let root: Root;
async function mount() {
  host = document.body.appendChild(document.createElement('div'));
  host.className = 'pane-body';
  root = createRoot(host);
  await act(async () => { root.render(createElement(Session, { active: true, onOpen: () => {} })); });
}
afterEach(() => { act(() => root.unmount()); host.remove(); });
const press = (key: string) => act(async () => { window.dispatchEvent(new KeyboardEvent('keydown', { key, bubbles: true, cancelable: true })); });
/** Until the file at `path` is no longer `was`: what it is then. */
const changed = async (path: string, was: string) => {
  for (let k = 0; k < 200; k++) {
    const now = await fsp.readFile(join(dir, path), 'utf8');
    if (now !== was) return now;
    await act(async () => { await new Promise((r) => setTimeout(r, 5)); });
  }
  return was;
};
const card = () => host.querySelector<HTMLElement>('.recall-wrap .card')!;
const learnBar = () => host.querySelector('.grades[data-learn="1"]');
const count = () => host.querySelector('.sess-count')?.textContent;

describe('a card never tested', () => {
  it('comes up answered, to learn; got it writes nothing and tests it at the end', async () => {
    const fresh = items.filter((i) => neverTested(i.sched) && i.dir !== 'r');
    const [a, b] = [fresh[0]!, fresh[1]!];
    const before = await fsp.readFile(join(dir, a.path), 'utf8');
    useApp.setState({ learnNew: true, session: { seq: 10, items: [a, b] } });
    await mount();
    expect(card().dataset.revealed).toBe('1');
    expect(card().querySelector('.face.back')).not.toBeNull();
    expect(learnBar()).not.toBeNull();
    expect(host.querySelectorAll('.grades button')).toHaveLength(1);
    expect(host.querySelector('.cm-learn')?.textContent).toBe('first time · learn it');
    await press(' ');
    // the second, then the first again at the end: one more in the session
    expect(count()).toBe('2 / 3');
    expect(useApp.getState().session!.items[2]).toBe(a);
    expect(await fsp.readFile(join(dir, a.path), 'utf8')).toBe(before);
    // the second is new too: learnt, and tested after the first
    await press('Enter');
    expect(count()).toBe('3 / 4');
    // the test: the question alone, the four grades
    expect(card().dataset.revealed).toBe('0');
    expect(learnBar()).toBeNull();
    await press(' ');
    expect(card().dataset.revealed).toBe('1');
    await press('3');
    const after = await changed(a.path, before);
    expect(after).not.toBe(before);
    expect(count()).toBe('4 / 4');
    expect(after).toMatch(/<!-- sr [^>]*st=learning[^>]*r=1/);
  });

  it('‹ back to where it was learnt shows it to learn again, its test still once at the end', async () => {
    const fresh = items.filter((i) => neverTested(i.sched) && i.dir !== 'r');
    const [a, b] = [fresh[2]!, fresh[3]!];
    useApp.setState({ learnNew: true, session: { seq: 11, items: [a, b] } });
    await mount();
    await press(' ');
    await press('[');
    expect(learnBar()).not.toBeNull();
    await press(' ');
    expect(useApp.getState().session!.items).toHaveLength(3);
  });

  it('a grade key grades it at once, nothing added', async () => {
    const a = items.filter((i) => neverTested(i.sched) && i.dir !== 'r')[4]!;
    const before = await fsp.readFile(join(dir, a.path), 'utf8');
    useApp.setState({ learnNew: true, session: { seq: 12, items: [a] } });
    await mount();
    await press('4');
    expect(await changed(a.path, before)).toMatch(/<!-- sr [^>]*r=1[^>]*g=4/);
    expect(useApp.getState().session!.items).toHaveLength(1);
  });

  it('with the tweak off, it is tested at once', async () => {
    const a = items.filter((i) => neverTested(i.sched) && i.dir !== 'r')[5]!;
    useApp.setState({ learnNew: false, session: { seq: 13, items: [a] } });
    await mount();
    expect(card().dataset.revealed).toBe('0');
    expect(learnBar()).toBeNull();
  });
});

describe('a card reviewed before', () => {
  it('is tested as always', async () => {
    const seen = items.find((i) => !neverTested(i.sched))!;
    useApp.setState({ learnNew: true, session: { seq: 14, items: [seen] } });
    await mount();
    expect(card().dataset.revealed).toBe('0');
    expect(learnBar()).toBeNull();
  });
});
