// The phone as a remote (milestone 90), the Mac's side. `phone as a remote`
// starts a server on the local network (`src-tauri/src/remote.rs`) and shows
// its address as a QR code (`RemotePanel.tsx`); a phone's camera opens it in
// the phone's browser, or ilmi's `scan a code` opens it in the app.
//
// What a phone shows is what the session shows here: the buttons in front of
// the session (the grades with their intervals, reveal, got it, next, the
// reading's three, ‹ ›) are read off the page as it is drawn, and a press
// from the phone clicks the same button. So there is one source of what can
// be done, the session's own buttons, and nothing to keep in step with them.
// Outside a session the phone offers `enter queue`.

import { invoke } from '@tauri-apps/api/core';
import { listen, type UnlistenFn } from '@tauri-apps/api/event';
import { create } from 'zustand';
import { remotePage, type RemoteButton, type RemoteView } from '../remote/controller.js';
import { appNow } from './clock.js';
import { walkOf } from './items.js';
import { failed } from './land.js';
import { useApp } from './store.js';
import { startSession } from './vault.js';

export interface RemoteState {
  /** The address the code holds, while the server runs. */
  url: string | null;
  /** Phones with the remote open. */
  clients: number;
  /** The panel with the code is up. */
  panel: boolean;
}

export const useRemote = create<RemoteState>(() => ({ url: null, clients: 0, panel: false }));

/** A button's words: its text without the key written in it, nor what only a keyboard is told. */
function wordsOf(el: Element | null): string {
  if (!el) return '';
  const c = el.cloneNode(true) as Element;
  for (const k of Array.from(c.querySelectorAll('kbd, .keys-only, .gch'))) k.remove();
  return (c.textContent ?? '').replace(/\s+/g, ' ').trim();
}

const visible = (el: Element): boolean => (el as HTMLElement).offsetParent !== null || (el as HTMLElement).getClientRects?.().length > 0;

/** What the phone shows, read off the page, and the elements a press clicks, by the buttons' ids. */
export function readView(doc: Document = document): { view: Omit<RemoteView, 'v'>; els: Map<string, HTMLElement> } {
  const els = new Map<string, HTMLElement>();
  const main: RemoteButton[] = [];
  const nav: RemoteButton[] = [];
  const s = useApp.getState();
  const add = (into: RemoteButton[], el: HTMLElement, b: RemoteButton) => {
    if (els.has(b.id)) return;
    els.set(b.id, el);
    into.push(b);
  };
  const root = Array.from(doc.querySelectorAll<HTMLElement>('.recall-wrap, .doc-session')).find(visible);
  if (!root) {
    const walk = walkOf(s.queue, appNow(), s.budget, null, s.queueFocus, s.focusBudget).length;
    const view = { title: s.vault ? '' : 'no collection open', count: '', kind: 'none', note: walk ? '' : s.vault ? 'nothing to do today' : '', main, nav };
    if (walk && s.vault) {
      const btn = doc.createElement('button');
      els.set('enter', btn);
      main.push({ id: 'enter', label: 'enter queue', sub: `${walk} to do` });
    }
    return { view, els };
  }
  const end = root.querySelector('.session-end');
  if (end) return { view: { title: '', count: '', kind: 'none', note: wordsOf(end), main, nav }, els };

  const kind = s.sessionEl?.kind ?? (root.classList.contains('doc-session') ? root.dataset.el ?? 'read' : 'card');
  const title = s.sessionEl?.label ?? '';
  const count = (root.querySelector('.sess-count, .sb-count')?.textContent ?? '').trim();
  let note = '';
  if (root.classList.contains('recall-wrap')) {
    const grades = root.querySelector<HTMLElement>('.grades');
    const revealed = root.querySelector('.card')?.getAttribute('data-revealed') === '1';
    const hint = root.querySelector<HTMLElement>('.face-hint, .reveal-all');
    if (!revealed && hint) add(main, hint, { id: 'reveal', label: 'reveal' });
    else if (!revealed && grades?.dataset.revealed === '0') {
      // the card's answer is down and its grades are up only to be pressed (a grade there reveals): reveal is the one
      const first = grades.querySelector<HTMLElement>('button');
      if (first) add(main, first, { id: 'reveal', label: 'reveal' });
    }
    if (grades && (revealed || grades.dataset.revealed === '1')) {
      for (const b of Array.from(grades.querySelectorAll<HTMLElement>('button'))) {
        const g = b.dataset.grade;
        const sub = wordsOf(b.querySelector('.gap'));
        add(main, b, { id: g ? `g${g}` : b.dataset.act ?? 'next', label: wordsOf(b.querySelector('.label')) || wordsOf(b), ...(sub ? { sub } : {}), ...(b.dataset.given === '1' ? { on: true } : {}) });
      }
    }
  } else {
    const bar = root.querySelector('.session-bar') ?? doc.querySelector('.session-bar');
    note = wordsOf(bar?.querySelector('.sb-done') ?? null);
    for (const b of Array.from(bar?.querySelectorAll<HTMLElement>('.sb-actions button[data-act]') ?? [])) {
      add(main, b, { id: b.dataset.act!, label: wordsOf(b.querySelector('.ra-l')) || wordsOf(b) });
    }
  }
  const arrows = Array.from((root.querySelector('.sess-nav') ?? doc.querySelector('.session-bar .sess-nav'))?.querySelectorAll<HTMLButtonElement>('.sn-btn:not(.sn-out)') ?? []);
  if (arrows[0]) add(nav, arrows[0], { id: 'prev', label: '‹', ...(arrows[0].disabled ? { off: true } : {}) });
  if (arrows[1]) add(nav, arrows[1], { id: 'next', label: '›', ...(arrows[1].disabled ? { off: true } : {}) });
  return { view: { title, count, kind, note, main, nav }, els };
}

// ── the running remote ───────────────────────────────────────────

let version = 0;
let last = '';
let els = new Map<string, HTMLElement>();
let observer: MutationObserver | null = null;
let unstore: (() => void) | null = null;
let unlisten: UnlistenFn[] = [];
let timer: ReturnType<typeof setTimeout> | undefined;

/** The page read again a moment after it changes: when it says something new, every phone is sent it. */
function send(): void {
  timer = undefined;
  const { view, els: now } = readView();
  els = now;
  const text = JSON.stringify(view);
  if (text === last) return;
  last = text;
  version++;
  void invoke('remote_state', { state: JSON.stringify({ v: version, ...view }) }).catch(() => {});
}

const soon = (): void => { if (timer === undefined) timer = setTimeout(send, 40); };

/** A press from a phone: the button it names clicked, when it was pressed on what is shown now. */
export function pressed(p: { v?: unknown; id?: unknown }): boolean {
  if (typeof p.id !== 'string' || p.v !== version) return false;
  if (p.id === 'enter') {
    startSession({}, null, useApp.getState().queueFocus);
    return true;
  }
  const el = els.get(p.id);
  if (!el || !el.isConnected || (el as HTMLButtonElement).disabled) return false;
  el.click();
  return true;
}

/** Start the remote (or show the one running): the server up with the phone's page, the page watched, the panel up. */
export async function startRemote(): Promise<void> {
  if (useRemote.getState().url) { useRemote.setState({ panel: true }); return; }
  const got = await invoke<{ url: string }>('remote_start', { page: remotePage() });
  last = '';
  observer = new MutationObserver(soon);
  observer.observe(document.body, { subtree: true, childList: true, characterData: true, attributes: true, attributeFilter: ['data-revealed', 'data-given', 'disabled', 'class'] });
  unstore = useApp.subscribe(soon);
  unlisten = await Promise.all([
    listen<{ v?: unknown; id?: unknown }>('remote-press', (e) => { pressed(e.payload); soon(); }),
    listen<number>('remote-clients', (e) => useRemote.setState({ clients: e.payload })),
  ]);
  useRemote.setState({ url: got.url, panel: true, clients: 0 });
  send();
}

/** The remote stopped: the server down, every phone told, nothing watched. */
export async function stopRemote(): Promise<void> {
  observer?.disconnect();
  observer = null;
  unstore?.();
  unstore = null;
  for (const u of unlisten) u();
  unlisten = [];
  clearTimeout(timer);
  timer = undefined;
  els = new Map();
  useRemote.setState({ url: null, clients: 0, panel: false });
  await invoke('remote_stop').catch(() => {});
}

/** The palette's `phone as a remote`. */
export function openRemote(): void {
  void startRemote().catch(failed('start the remote'));
}
