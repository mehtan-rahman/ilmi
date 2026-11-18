// @vitest-environment jsdom
// A card never tested comes up to learn first (the `learnNew` tweak, on by
// default; `Session.tsx`): its answer up, one action, got it (space, ⏎),
// which writes that it was learnt on its line (`seen`, FORMAT.md §6.2) and
// tests it once more at the session's end. A grade key grades it at once. A card reviewed before is tested as always, and
// with the tweak off a new card is too.

import { promises as fsp } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { act, createElement } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterAll, afterEach, beforeAll, describe, expect, it, vi } from 'vitest';
import { parse } from '../../format/index.js';
import { docItems, type CardItem } from '../../schedule/index.js';
import { nodeFs } from '../../vault/node-fs.js';
import { Vault } from '../../vault/index.js';
import { emptyPanes, openTab } from '../panes.js';
import { useApp } from '../store.js';

const SAMPLE = join(import.meta.dirname, '../../../samples/double-major');
const clock = vi.hoisted(() => ({ t: new Date('2026-10-30T09:00:00').getTime() }));
const NOW = new Date(clock.t);
let vault: Vault;
let dir: string;
let items: CardItem[] = [];

vi.mock('../vault.js', async (orig) => {
  const real = await orig<typeof import('../vault.js')>();
  return { ...real, currentVault: () => vault, recordReview: async () => {}, note: () => {} };
});
vi.mock('../clock.js', () => ({ appNow: () => new Date(clock.t) }));
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
afterEach(() => { act(() => root.unmount()); host.remove(); clock.t = NOW.getTime(); });
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
  it('comes up answered, to learn; got it says so on its line, a new card still, and tests it at the end', async () => {
    const fresh = items.filter((i) => neverTested(i.sched) && i.dir !== 'r');
    const [a, b] = [fresh[0]!, fresh[1]!];
    const before = await fsp.readFile(join(dir, a.path), 'utf8');
    useApp.setState({ learnNew: true, session: { seq: 10, items: [a, b] } });
    await mount();
    expect(count()).toBe('1 / 4');
    expect(card().dataset.revealed).toBe('1');
    expect(card().querySelector('.face.back')).not.toBeNull();
    expect(learnBar()).not.toBeNull();
    expect(host.querySelectorAll('.grades button')).toHaveLength(1);
    expect(host.querySelector('.cm-learn')?.textContent).toBe('first time · learn it');
    await press(' ');
    // the walk counts both cards' tests from the start (`1 / 4`): the total does not grow as they are learnt
    expect(count()).toBe('2 / 4');
    expect(useApp.getState().session!.items).toHaveLength(3);
    // its line says it was learnt, and nothing else: no review, no due, the card given an id as a grade gives one
    const learnt = await changed(a.path, before);
    const line = /<!-- sr ([^>]*)-->/.exec(learnt.slice(learnt.indexOf(a.text)))![1]!.trim().split(' ').filter((x) => !x.startsWith('pri='));
    expect(line).toEqual([expect.stringMatching(/^seen=\d{4}-\d\d-\d\dT\d\d:\d\d:\d\dZ$/)]);
    expect(docItems(a.path, parse(learnt).doc, NOW).filter((i) => i.kind === 'card' && i.text === a.text && neverTested(i.sched))).toHaveLength(1);
    // the second is new too: learnt, and tested after the first
    await press('Enter');
    expect(count()).toBe('3 / 4');
    // the test: the question alone, the four grades
    expect(card().dataset.revealed).toBe('0');
    expect(learnBar()).toBeNull();
    await press(' ');
    expect(card().dataset.revealed).toBe('1');
    await press('3');
    const after = await changed(a.path, await fsp.readFile(join(dir, a.path), 'utf8'));
    expect(after).not.toBe(before);
    // good on a new card leaves it in its steps, due ten minutes on: it comes back before the end, one more to the total
    expect(count()).toBe('4 / 5');
    expect(after).toMatch(/<!-- sr [^>]*st=learning[^>]*r=1/);
    // a line with a review does not say it was learnt
    expect(/<!-- sr ([^>]*)-->/.exec(after.slice(after.indexOf(a.text)))![1]).not.toContain('seen=');
    expect(useApp.getState().session!.items).toHaveLength(5);
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

  it('learnt, the session left before its end and another begun, that day or the next, the app opened anew: it is tested, not shown to learn a second time', async () => {
    const fresh = items.filter((i) => neverTested(i.sched) && i.dir !== 'r');
    const c = fresh[fresh.length - 1]!;
    const before = await fsp.readFile(join(dir, c.path), 'utf8');
    useApp.setState({ learnNew: true, session: { seq: 40, items: [c] } });
    await mount();
    expect(learnBar()).not.toBeNull();
    await press(' ');
    const learnt = await changed(c.path, before);
    // left here. The next session's walk is made from the file, which says the card was learnt; nothing else is kept of it
    act(() => root.unmount());
    host.remove();
    for (const day of [0, 1, 9]) {
      clock.t = NOW.getTime() + day * 86_400_000;
      const again = docItems(c.path, parse(learnt).doc, new Date(clock.t)).filter((i): i is CardItem => i.kind === 'card' && i.text.startsWith(c.text) && (i.group ? JSON.stringify(i.group) : '') === (c.group ? JSON.stringify(c.group) : ''));
      expect(again).toHaveLength(1);
      // still a new card, due now
      expect(neverTested(again[0]!.sched)).toBe(true);
      expect(again[0]!.dueAt.getTime()).toBeLessThanOrEqual(clock.t);
      useApp.setState({ session: { seq: 41 + day, items: again } });
      await mount();
      expect(learnBar(), `day ${day}`).toBeNull();
      expect(host.querySelector('.cm-learn')).toBeNull();
      expect(card().dataset.revealed).toBe('0');
      expect(count()).toBe('1 / 1');
      act(() => root.unmount());
      host.remove();
    }
    await mount();
  });
});
