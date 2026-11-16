// A small menu at a point, drawn as the context menu is (`.ctx-menu`), for
// what a node view offers: a table cell's rows and columns, a code block's
// language. Plain DOM, since the node views are not React; one open at a
// time, closed by a pick, Escape, or a press anywhere else.
//
// And the keys every menu takes (`menuKeys`), this one and the React ones
// (`NodeMenu.tsx`, the tab rail's `+`, a deck row's): the menu takes the
// focus when it opens and gives it back when it closes; ↓ ↑ move (round the
// ends), Home and End, ⏎ or space runs the item, → opens a list (`move to…`),
// ← or Escape leaves it for the row it came from, Escape closes, a letter
// jumps to the next item starting with it. While one is open every key is
// the menu's: none reaches the page behind it (`menuOpen` in the store, which
// the canvas counts as covered). One exception, as it was: a text field being
// typed in when the menu opens over it (a row's rename) keeps the focus and
// its keys, and Escape ends both.

import { useApp } from './store.js';

export interface PopItem {
  /** `'-'` draws a divider. */
  label: string;
  glyph?: string;
  /** Lit as the current choice. */
  on?: boolean;
  danger?: boolean;
  /** Its `data-act`, for a smoke to find it by. */
  act?: string;
  run?: () => void;
}

// ── a menu's keys ──────────────────────────────────────────────

export interface MenuKeys {
  /** It was opened from the keyboard (⇧F10, the Menu key): its first item has the focus. */
  byKey: boolean;
  /** The menu is closing: the keys are let go, and the focus goes back to what had it unless something else took it. */
  dispose(): void;
}

interface Wired {
  el: HTMLElement;
  /** Closes the menu; without one (a menu found in the page, not handed over) Escape is left to its owner's listener. */
  close: (() => void) | undefined;
  /** What had the focus when it opened. */
  prev: HTMLElement | null;
  /** The focus was moved into it (not under a finger: that would put the keyboard away). */
  took: boolean;
  /** A list (`move to…`) was showing at the last look. */
  wasSub: boolean;
  /** Found in the page by its class, so its going is looked for too. */
  found: boolean;
  off(): void;
}

/** The open menus, the last opened last: it has the keys. */
const stack: Wired[] = [];
const wired = new WeakMap<HTMLElement, Wired>();
/** The last press was a key, not a pointer: a menu opened now lights its first item. */
let byKey = false;
let touchAt = 0;

const MODS = new Set(['Shift', 'Meta', 'Control', 'Alt', 'AltGraph', 'CapsLock', 'Fn', 'Dead', 'Process']);
const isField = (t: Element | null): boolean =>
  t instanceof HTMLElement && (t.tagName === 'INPUT' || t.tagName === 'TEXTAREA' || t.tagName === 'SELECT' || t.isContentEditable);
/** Marks and case off, as the tree's jump-to-a-name has them. */
const fold = (s: string) => s.normalize('NFD').replace(/[\p{M}ʻʼʾʿ']/gu, '').toLowerCase();

/** An item's words: not its glyph, its key, or the place a `move to…` row is in. */
function words(item: HTMLElement): string {
  let s = '';
  for (const n of Array.from(item.childNodes)) {
    if (n.nodeType === 3) s += n.textContent ?? '';
    else if (n instanceof HTMLElement && !n.matches('.cg, .ck, .mv-where')) s += n.textContent ?? '';
  }
  return fold(s.trim());
}

const off = (i: Element) => i.classList.contains('none') || i.classList.contains('disabled') || i.getAttribute('aria-disabled') === 'true';
/** The stops: every item that can be run. A divider is none, and nor is an item that is off. */
export const menuItems = (el: HTMLElement): HTMLElement[] => Array.from(el.querySelectorAll<HTMLElement>('.ci')).filter((i) => !off(i));

/** The roles a screen reader goes by, and each item reachable by `focus()` but not by Tab. */
function dress(el: HTMLElement): void {
  if (!el.hasAttribute('role')) el.setAttribute('role', 'menu');
  if (!el.hasAttribute('tabindex')) el.tabIndex = -1;
  for (const i of Array.from(el.querySelectorAll<HTMLElement>('.ci'))) {
    if (!i.hasAttribute('role')) i.setAttribute('role', 'menuitem');
    if (!i.hasAttribute('tabindex')) i.tabIndex = -1;
    if (i.classList.contains('none')) i.setAttribute('aria-disabled', 'true');
    if (i.classList.contains('has-sub')) i.setAttribute('aria-haspopup', 'menu');
  }
  for (const d of Array.from(el.querySelectorAll<HTMLElement>('.cd'))) if (!d.hasAttribute('role')) d.setAttribute('role', 'separator');
}

const lit = (el: HTMLElement): HTMLElement | null => {
  const a = document.activeElement;
  return a instanceof HTMLElement && el.contains(a) ? a.closest<HTMLElement>('.ci') : null;
};
const nowhere = () => { const a = document.activeElement; return !a || a === document.body; };
/** A text field outside the menu has the focus (a rename under way): the keys are its, not the menu's. */
const typing = (el: HTMLElement): boolean => {
  const a = document.activeElement;
  return a instanceof HTMLElement && (a.tagName === 'INPUT' || a.tagName === 'TEXTAREA' || a.tagName === 'SELECT') && !el.contains(a);
};

function setFlag(): void {
  const on = stack.length > 0;
  if (useApp.getState().menuOpen !== on) useApp.setState({ menuOpen: on });
}

/** Its rows changed (a list opened or left, an item gone): the focus, lost with the row that had it, is put back in the menu. */
function refocus(m: Wired): void {
  const sub = !!m.el.querySelector('.ci.back');
  const was = m.wasSub;
  m.wasSub = sub;
  if (!m.took || !nowhere()) return;
  const its = menuItems(m.el);
  // by the keys: into a list at its first row, out of one on the row that opened it; by the pointer nothing is lit
  const to = !byKey ? m.el : sub ? its.find((i) => !i.classList.contains('back')) ?? its[0] : was ? m.el.querySelector<HTMLElement>('.ci.has-sub') ?? its[0] : its[0];
  (to ?? m.el).focus({ preventScroll: true });
}

/**
 * Give a menu its keys. `el` is the `.ctx-menu`, in the page already; `close`
 * closes it (Escape, Tab). Call `dispose` as it closes, while it is still in the page.
 */
export function menuKeys(el: HTMLElement | null, opts: { close?: () => void } = {}, found = false): MenuKeys {
  if (!el) return { byKey: false, dispose() { /* nothing was open */ } };
  wired.get(el)?.off();
  const key = byKey;
  const touch = Date.now() - touchAt < 1500;
  const had = document.activeElement;
  const inside = had instanceof HTMLElement && el.contains(had);
  dress(el);
  let done = false;
  const m: Wired = {
    el,
    close: opts.close,
    prev: had instanceof HTMLElement && had !== document.body && !inside ? had : null,
    took: !touch && !typing(el),
    wasSub: !!el.querySelector('.ci.back'),
    found,
    off() {
      if (done) return;
      done = true;
      mo?.disconnect();
      el.removeEventListener('mousemove', onMove);
      el.removeEventListener('mouseleave', onLeave);
      const at = stack.indexOf(m);
      if (at >= 0) stack.splice(at, 1);
      wired.delete(el);
      setFlag();
      // back to what had the focus, unless the item's action (or a press elsewhere) has put it somewhere
      const a = document.activeElement;
      if (m.took && m.prev?.isConnected && (nowhere() || (a !== null && el.contains(a)))) m.prev.focus({ preventScroll: true });
    },
  };
  // the pointer and the keys light one row between them: the row under the pointer has the focus
  const onMove = (e: MouseEvent) => {
    const it = (e.target as HTMLElement | null)?.closest?.<HTMLElement>('.ci') ?? null;
    if (!m.took || !it || !el.contains(it) || off(it) || document.activeElement === it || isField(document.activeElement)) return;
    it.focus({ preventScroll: true });
  };
  const onLeave = () => { if (m.took && lit(el) && !isField(document.activeElement)) el.focus({ preventScroll: true }); };
  el.addEventListener('mousemove', onMove);
  el.addEventListener('mouseleave', onLeave);
  const mo = typeof MutationObserver === 'undefined' ? null : new MutationObserver(() => {
    if (!el.isConnected || done) return;
    dress(el);
    refocus(m);
  });
  mo?.observe(el, { childList: true, subtree: true });
  stack.push(m);
  wired.set(el, m);
  setFlag();
  // a field of its own that took the focus as it was drawn (`move to…`'s filter) keeps it
  if (m.took && !inside) (key ? menuItems(el)[0] ?? el : el).focus({ preventScroll: true });
  return { byKey: key, dispose: m.off };
}

/** One key, for the menu in front. */
function menuKey(m: Wired, e: KeyboardEvent): void {
  if (e.isComposing || MODS.has(e.key)) return;
  const { el } = m;
  // a rename under way keeps its keys; Escape, which ends it, closes the menu too
  if (typing(el)) { if (e.key === 'Escape') m.close?.(); return; }
  const stop = (prevent = true) => { if (prevent) e.preventDefault(); e.stopImmediatePropagation(); };
  const back = el.querySelector<HTMLElement>('.ci.back');
  // as it is when the key is pressed: what the key changes is looked at after (`refocus`)
  m.wasSub = back !== null;
  const leave = (): boolean => {
    if (back) { stop(); back.click(); return true; }
    if (m.close) { stop(); m.close(); return true; }
    // a menu found in the page: its owner's own Escape closes it
    return false;
  };
  const t = e.target instanceof HTMLElement ? e.target : null;
  // a field of the menu's own (`move to…`'s filter) keeps its keys: Escape, and ← with nothing typed, leave the list
  if (t && el.contains(t) && isField(t)) {
    if (e.key === 'Escape' || (e.key === 'ArrowLeft' && back !== null && (t as HTMLInputElement).value === '')) leave();
    else if (e.key === 'Tab') stop();
    return;
  }
  // every other key is the menu's while it is open; a chord does nothing, and is not the page's either
  if (e.metaKey || e.ctrlKey || e.altKey) { stop(false); return; }
  if (e.key === 'Escape') { leave(); return; }
  stop();
  dress(el);
  const its = menuItems(el);
  const cur = lit(el);
  const i = cur ? its.indexOf(cur) : -1;
  const go = (to: HTMLElement | undefined) => { to?.focus(); };
  switch (e.key) {
    case 'ArrowDown': go(its[(i + 1) % Math.max(1, its.length)]); break;
    case 'ArrowUp': go(its[i <= 0 ? its.length - 1 : i - 1]); break;
    case 'Home': case 'PageUp': go(its[0]); break;
    case 'End': case 'PageDown': go(its[its.length - 1]); break;
    case 'Enter': case ' ': cur?.click(); break;
    case 'ArrowRight': if (cur?.classList.contains('has-sub')) cur.click(); break;
    case 'ArrowLeft': back?.click(); break;
    case 'Tab': m.close?.(); break;
    default: {
      if (e.key.length !== 1 || !/\S/u.test(e.key)) break;
      const want = fold(e.key);
      for (let k = 1; k <= its.length; k++) {
        const it = its[(Math.max(i, -1) + k) % its.length]!;
        if (words(it).startsWith(want)) { go(it); break; }
      }
    }
  }
}

/** Every `.ctx-menu` in the page, as it is now (a live list). */
const drawn = typeof document === 'undefined' ? null : document.getElementsByClassName('ctx-menu');

/** A menu drawn by someone who did not hand it over gets the keys all the same; one that has gone lets them go. */
function look(): void {
  for (const m of [...stack]) if (!m.el.isConnected) m.off();
  if (!drawn) return;
  for (const el of Array.from(drawn)) if (el instanceof HTMLElement && !wired.has(el)) menuKeys(el, {}, true);
}
let looking = false;
const lookSoon = () => {
  // after the press has done what it does (opened a menu, or closed one behind this file's back)
  if (looking) return;
  looking = true;
  setTimeout(() => { looking = false; look(); }, 0);
};

if (typeof window !== 'undefined') {
  // first in line, before any page's own listener: a key with a menu open is the menu's
  window.addEventListener('keydown', (e) => {
    byKey = true;
    look();
    const m = stack[stack.length - 1];
    if (m) { menuKey(m, e); lookSoon(); }
  }, true);
  const pointer = () => { byKey = false; lookSoon(); };
  window.addEventListener('mousedown', pointer, true);
  window.addEventListener('contextmenu', pointer, true);
  window.addEventListener('click', lookSoon, true);
  window.addEventListener('touchstart', () => { byKey = false; touchAt = Date.now(); lookSoon(); }, { capture: true, passive: true });
  window.addEventListener('touchend', lookSoon, { capture: true, passive: true });
}

// ── the menu at a point ────────────────────────────────────────

let open: { el: HTMLElement; close: () => void } | null = null;

/** Close the open menu, if any. */
export function closePopMenu(): void {
  open?.close();
}

/** Is a menu open now? */
export const popMenuOpen = (): HTMLElement | null => open?.el ?? null;

/** Open a menu of `items` under the box `at` (a button's rect), kept inside the window. */
export function popMenu(at: { left: number; bottom: number; top: number }, items: PopItem[], cls = ''): HTMLElement {
  closePopMenu();
  const el = document.createElement('div');
  el.className = `ctx-menu pop-menu${cls ? ` ${cls}` : ''}`;
  el.setAttribute('role', 'menu');
  for (const it of items) {
    if (it.label === '-') {
      const d = document.createElement('div');
      d.className = 'cd';
      d.setAttribute('role', 'separator');
      el.append(d);
      continue;
    }
    const row = document.createElement('div');
    row.className = `ci${it.danger ? ' danger' : ''}${it.on ? ' on' : ''}`;
    row.setAttribute('role', 'menuitem');
    row.tabIndex = -1;
    if (it.act) row.dataset.act = it.act;
    const g = document.createElement('span');
    g.className = 'cg';
    g.textContent = it.glyph ?? (it.on ? '✓' : '');
    row.append(g, document.createTextNode(it.label));
    row.addEventListener('mousedown', (e) => { e.preventDefault(); e.stopPropagation(); });
    row.addEventListener('click', (e) => {
      e.stopPropagation();
      // closed first: the focus is back where it was (the editor) by the time the item runs
      close();
      it.run?.();
    });
    el.append(row);
  }
  el.style.left = `${Math.round(at.left)}px`;
  el.style.top = `${Math.round(at.bottom + 4)}px`;
  document.body.append(el);
  // inside the window: above the button when there is no room below, never past the right edge
  const r = el.getBoundingClientRect();
  if (r.bottom > window.innerHeight - 4 && at.top - r.height - 4 > 0) el.style.top = `${Math.round(at.top - r.height - 4)}px`;
  if (r.right > window.innerWidth - 4) el.style.left = `${Math.max(4, Math.round(window.innerWidth - r.width - 4))}px`;
  const outside = (e: MouseEvent) => { if (!el.contains(e.target as Node)) close(); };
  function close() {
    document.removeEventListener('mousedown', outside, true);
    keys.dispose();
    el.remove();
    if (open?.el === el) open = null;
  }
  // the press that opened it is over by the time this listens
  setTimeout(() => document.addEventListener('mousedown', outside, true), 0);
  const keys = menuKeys(el, { close });
  open = { el, close };
  return el;
}
