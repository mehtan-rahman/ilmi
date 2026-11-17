// @vitest-environment jsdom
// Haptics (milestone 83; `haptics.ts`): which tap each thing asks for, that
// nothing is asked where the device cannot or the setting is off, that a
// native side that fails is never heard of, and that a session asks for
// them where it reveals, grades and ends (`Session.tsx`), with the setting's
// row in the settings only where the device can.

import { promises as fsp } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { act, createElement } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { docItems, type CardItem } from '../../schedule/index.js';
import { nodeFs } from '../../vault/node-fs.js';
import { Vault } from '../../vault/index.js';
import { FINISHED_HAPTIC, GRADE_HAPTIC, REVEAL_HAPTIC, hapticFinished, hapticGrade, hapticReveal, hapticTick, hapticsAsked, hapticsAskedClear, loadHaptics, setHapticSender } from '../haptics.js';
import { emptyPanes, openTab } from '../panes.js';
import { useApp } from '../store.js';

const SAMPLE = join(import.meta.dirname, '../../../samples/double-major');
const NOW = new Date('2026-10-30T09:00:00');
let vault: Vault;
let dir: string;
const items: CardItem[] = [];

vi.mock('../vault.js', async (orig) => {
  const real = await orig<typeof import('../vault.js')>();
  return { ...real, currentVault: () => vault, recordReview: async () => {}, note: () => {} };
});
vi.mock('../clock.js', () => ({ appNow: () => NOW }));
const { Session, neverTested } = await import('../Session.js');
const { Tweaks } = await import('../Tweaks.js');
(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
(globalThis as { ResizeObserver?: unknown }).ResizeObserver ??= class { observe() {} unobserve() {} disconnect() {} };

/** What the native side was asked for, in order. */
let sent: string[] = [];
beforeEach(() => {
  sent = [];
  hapticsAskedClear();
  setHapticSender(async (kind) => { sent.push(kind); return { can: true }; });
  useApp.setState({ canHaptics: true, haptics: true });
});
afterAll(() => setHapticSender(null));

describe('which tap', () => {
  it('a grade is felt by which it was: again differs in kind, hard is firmer than good, easy the gentlest', () => {
    expect(GRADE_HAPTIC).toEqual({ 1: 'warning', 2: 'medium', 3: 'light', 4: 'soft' });
    for (const g of [1, 2, 3, 4] as const) hapticGrade(g);
    expect(sent).toEqual(['warning', 'medium', 'light', 'soft']);
  });

  it('the answer shown is a light tap, the queue\'s end the success, the small things a tick', () => {
    hapticReveal();
    hapticFinished();
    hapticTick();
    expect([REVEAL_HAPTIC, FINISHED_HAPTIC]).toEqual(['light', 'success']);
    expect(sent).toEqual(['light', 'success', 'tick']);
    // a dev build keeps what was asked, for a smoke on a simulator
    expect(hapticsAsked()).toEqual(['light', 'success', 'tick']);
  });
});

describe('when nothing is asked', () => {
  it('the setting off', () => {
    useApp.getState().setHaptics(false);
    hapticReveal();
    hapticGrade(1);
    hapticFinished();
    hapticTick();
    expect(sent).toEqual([]);
    expect(hapticsAsked()).toEqual([]);
    useApp.getState().setHaptics(true);
    hapticTick();
    expect(sent).toEqual(['tick']);
  });

  it('the setting is kept on the device, with the other settings, and is on until it is turned off', () => {
    useApp.getState().setHaptics(false);
    expect(JSON.parse(localStorage.getItem('ilmi.tweaks')!).haptics).toBe(false);
    useApp.getState().setHaptics(true);
    expect(JSON.parse(localStorage.getItem('ilmi.tweaks')!).haptics).toBe(true);
  });

  it('a device that cannot: a Mac and an iPad answer no, and are not asked again', async () => {
    setHapticSender(async (kind) => { sent.push(kind); return null; });
    expect(await loadHaptics()).toBe(false);
    expect(useApp.getState().canHaptics).toBe(false);
    expect(sent).toEqual(['probe']);
    hapticGrade(3);
    hapticTick();
    expect(sent).toEqual(['probe']);
    setHapticSender(async () => ({ can: false }));
    expect(await loadHaptics()).toBe(false);
    setHapticSender(async () => ({ can: true }));
    expect(await loadHaptics()).toBe(true);
    expect(useApp.getState().canHaptics).toBe(true);
  });

  it('a native side that fails is not heard of', async () => {
    setHapticSender(() => Promise.reject(new Error('no such command')));
    expect(await loadHaptics()).toBe(false);
    useApp.setState({ canHaptics: true });
    expect(() => { hapticReveal(); hapticGrade(2); hapticFinished(); hapticTick(); }).not.toThrow();
    setHapticSender(() => { throw new Error('thrown at once'); });
    expect(() => hapticTick()).not.toThrow();
    await new Promise((r) => setTimeout(r, 0));
  });
});

describe('in the app', () => {
  beforeAll(async () => {
    dir = await fsp.mkdtemp(join(tmpdir(), 'ilmi-haptics-'));
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
  const mount = async (what: ReturnType<typeof createElement>) => {
    host = document.body.appendChild(document.createElement('div'));
    host.className = 'pane-body';
    root = createRoot(host);
    await act(async () => { root.render(what); });
  };
  afterEach(() => { act(() => root.unmount()); host.remove(); });
  const press = (key: string) => act(async () => { window.dispatchEvent(new KeyboardEvent('keydown', { key, bubbles: true, cancelable: true })); });
  const settle = () => act(async () => { await new Promise((r) => setTimeout(r, 30)); });

  it('a session asks for the reveal\'s, then each grade\'s, then the end\'s, once', async () => {
    const seen = items.filter((i) => !neverTested(i.sched) && i.dir !== 'r').slice(0, 4);
    expect(seen.length).toBe(4);
    useApp.setState({ learnNew: false, phone: true, session: { seq: 8301, items: seen, cram: true } });
    await mount(createElement(Session, { active: true, onOpen: () => {} }));
    for (const g of [1, 2, 3, 4] as const) {
      const before = sent.length;
      // a phone's one button, under the thumb
      await act(async () => { host.querySelector<HTMLElement>('.reveal-all')!.click(); });
      expect(sent.slice(before)).toEqual(['light']);
      await act(async () => { host.querySelectorAll<HTMLElement>('.grades button')[g - 1]!.click(); });
      expect(sent[before + 1]).toBe(GRADE_HAPTIC[g]);
      await settle();
    }
    expect(host.querySelector('.session-end')).not.toBeNull();
    expect(sent).toEqual(['light', 'warning', 'light', 'medium', 'light', 'light', 'light', 'soft', 'success']);
    // drawn again at its end (its tab come back to): the end is not felt twice
    act(() => root.unmount());
    host.remove();
    await mount(createElement(Session, { active: true, onOpen: () => {} }));
    expect(sent.filter((k) => k === 'success')).toEqual(['success']);
    useApp.setState({ phone: false, session: null });
  });

  it('with the setting off a session asks for none', async () => {
    const seen = items.filter((i) => !neverTested(i.sched) && i.dir !== 'r').slice(4, 5);
    useApp.setState({ haptics: false, learnNew: false, session: { seq: 8302, items: seen, cram: true } });
    await mount(createElement(Session, { active: true, onOpen: () => {} }));
    await press(' ');
    await press('3');
    await settle();
    expect(host.querySelector('.session-end')).not.toBeNull();
    expect(sent).toEqual([]);
    useApp.setState({ session: null });
  });

  it('the settings have `haptics` only where the device can, and it turns them off', async () => {
    // no collection open: the rows that are a collection's are not drawn
    useApp.setState({ canHaptics: false, vault: null });
    await mount(createElement(Tweaks));
    expect(host.querySelector('[data-tw="haptics"]')).toBeNull();
    act(() => root.unmount());
    host.remove();
    useApp.setState({ canHaptics: true });
    await mount(createElement(Tweaks));
    const row = host.querySelector<HTMLElement>('[data-tw="haptics"]')!;
    expect(row.querySelector('.tw-lbl')!.textContent).toBe('haptics');
    const [on, off] = Array.from(row.querySelectorAll<HTMLElement>('button'));
    expect([on!.textContent, off!.textContent, on!.dataset.active]).toEqual(['on', 'off', '1']);
    await act(async () => { off!.click(); });
    expect(useApp.getState().haptics).toBe(false);
    expect(row.querySelectorAll<HTMLElement>('button')[1]!.dataset.active).toBe('1');
    // turned on again, it is felt once
    await act(async () => { on!.click(); });
    expect(useApp.getState().haptics).toBe(true);
    expect(sent).toEqual(['tick']);
  });
});
