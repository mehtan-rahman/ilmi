// A list pulled down at its top: the queue and the tree, on
// a device. The pull itself is the system's own (the list's rubber band: a
// finger drags it past its top and it springs back), so nothing here moves
// the list. A word (`sync`) is shown in the gap the pull opens above it,
// fainter the less it is pulled; past the threshold it darkens, with a
// tick, and let go there the collection syncs, as the strip's word pressed
// does (`syncAsked`). Only where the collection syncs at all: elsewhere
// there is no word and a pull is only a pull. The word is one element of
// this file's own on the page, placed by its transform as the list scrolls.

import { PULL, pullArmed } from './gesture.js';
import { hapticTick } from './haptics.js';
import { useApp } from './store.js';
import { syncWord } from './sync.js';
import { syncAsked } from './TopStrip.js';

/** Whether `el` is a list that can be pulled: a pane showing a queue, the sidebar. */
const pulls = (el: HTMLElement): boolean => el.matches('.side') || (el.matches('.pane-body') && el.querySelector(':scope > .queue') !== null);

let word: HTMLElement | null = null;
/** The list being pulled, where its top is on the glass, and whether it is past the threshold. */
let pulled: { el: HTMLElement; top: number; armed: boolean } | null = null;

function hide(): void {
  pulled = null;
  if (!word) return;
  word.style.opacity = '0';
  delete word.dataset.armed;
}

function scrolled(e: Event): void {
  const el = e.target;
  if (!(el instanceof HTMLElement) || !word) return;
  if (pulled && pulled.el !== el) return;
  const over = -el.scrollTop;
  if (over <= 0) { if (pulled) hide(); return; }
  if (!pulled) {
    if (!pulls(el) || syncWord(useApp.getState().sync) === null) return;
    const r = el.getBoundingClientRect();
    pulled = { el, top: r.top, armed: false };
    word.style.width = `${r.width}px`;
    word.style.left = `${r.left}px`;
  }
  // in the middle of the gap, once the gap can hold it
  word.style.transform = `translate3d(0,${(pulled.top + Math.max(4, over / 2 - 10)).toFixed(1)}px,0)`;
  word.style.opacity = Math.min(1, Math.max(0, (over - 16) / (PULL - 16))).toFixed(2);
  const armed = pullArmed(over);
  if (armed !== pulled.armed) {
    pulled.armed = armed;
    if (armed) { word.dataset.armed = '1'; hapticTick(); } else delete word.dataset.armed;
  }
}

function letGo(e: TouchEvent): void {
  if (e.touches.length > 0 || !pulled) return;
  if (pullArmed(-pulled.el.scrollTop) && syncWord(useApp.getState().sync) !== null) syncAsked();
}

/** The lists' pulls are watched from now on. Resolves to a stop. */
export function installPull(): () => void {
  word = document.createElement('div');
  word.className = 'pull-word';
  word.setAttribute('aria-hidden', 'true');
  word.textContent = 'sync';
  document.body.append(word);
  document.addEventListener('scroll', scrolled, { capture: true, passive: true });
  window.addEventListener('touchend', letGo, { passive: true });
  window.addEventListener('touchcancel', letGo, { passive: true });
  return () => {
    document.removeEventListener('scroll', scrolled, true);
    window.removeEventListener('touchend', letGo);
    window.removeEventListener('touchcancel', letGo);
    word?.remove();
    word = null;
    pulled = null;
  };
}
