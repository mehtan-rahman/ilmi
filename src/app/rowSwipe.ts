// A queue's row under the finger: a topic's row on a phone
// swiped left shows `dismiss` and `later` at its right end, the buttons the
// row has already (`Queue.tsx` draws them there, `.swipe-acts`); let go
// part of the way it rests open on them, swiped most of the way across it
// is `later` at once, with a tick as that threshold is crossed. The row is
// moved by its transform alone, written here as the finger moves. A touch
// anywhere else shuts a row left open. Not where nothing moves (`quiet`):
// there the row's buttons are all there is, as before.

import { EDGE, axisOf, rowAt, rowCommits, rowEnds, settleEase, settleMs, velocityOf, type Sample } from './gesture.js';
import { hapticTick } from './haptics.js';
import { quiet } from './motion.js';

const ROW = '.qlist li[data-swipe="1"]';
/** How far a row rests open: its two actions and the page's margin beside them, px. */
export const ROW_OPEN = 184;

interface Drag {
  li: HTMLElement;
  /** Where the row was, and the finger's x, when the drag was told. */
  base: number;
  from: number;
  w: number;
  x: number;
  armed: boolean;
  samples: Sample[];
}

let cand: { li: HTMLElement; x: number; y: number; base: number } | null = null;
let drag: Drag | null = null;
let rested: HTMLElement | null = null;
let raf = 0;

const xOf = (el: HTMLElement): number => {
  const m = /translate3d\((-?[\d.]+)px/.exec(el.style.transform);
  return m ? Number(m[1]) : 0;
};

const put = (li: HTMLElement, x: number): void => { li.style.transform = x === 0 ? '' : `translate3d(${x.toFixed(1)}px,0,0)`; };

function go(li: HTMLElement, from: number, to: number, v: number, then?: () => void): void {
  const ms = settleMs(to - from, v);
  li.style.transition = ms ? `transform ${ms}ms ${settleEase(to - from, v, ms)}` : '';
  put(li, to);
  setTimeout(() => {
    li.style.transition = '';
    then?.();
  }, ms + 20);
}

function shut(li: HTMLElement, v = 0): void {
  if (rested === li) rested = null;
  delete li.dataset.armed;
  go(li, xOf(li), 0, v, () => { if (xOf(li) === 0 && drag?.li !== li) { delete li.dataset.swiping; li.style.willChange = ''; } });
}

function start(e: TouchEvent): void {
  cand = null;
  const t = e.touches[0];
  if (!t || e.touches.length !== 1 || drag) return;
  const li = (e.target as Element | null)?.closest?.<HTMLElement>(ROW) ?? null;
  if (rested && rested !== li) shut(rested);
  if (!li || quiet() || t.clientX <= EDGE) return;
  cand = { li, x: t.clientX, y: t.clientY, base: xOf(li) };
}

function move(e: TouchEvent): void {
  const t = e.touches[0];
  if (!t) return;
  if (!drag) {
    if (!cand) return;
    const dx = t.clientX - cand.x;
    const axis = axisOf(dx, t.clientY - cand.y);
    if (axis === null) return;
    const c = cand;
    cand = null;
    // down the list, or rightward on a row at rest: not a swipe
    if (axis === 'y' || (dx > 0 && c.base === 0)) return;
    c.li.style.transition = '';
    c.li.style.willChange = 'transform';
    c.li.dataset.swiping = '1';
    // from where the finger is now: the row does not jump the slop it took to tell
    drag = { li: c.li, base: c.base, from: t.clientX, w: c.li.offsetWidth, x: c.base, armed: false, samples: [] };
  }
  if (e.cancelable) e.preventDefault();
  const d = drag;
  d.x = rowAt(d.base, t.clientX - d.from);
  d.samples.push({ t: e.timeStamp, at: d.x });
  if (d.samples.length > 12) d.samples.shift();
  const armed = rowCommits(d.x, d.w);
  if (armed !== d.armed) {
    d.armed = armed;
    if (armed) d.li.dataset.armed = '1'; else delete d.li.dataset.armed;
    hapticTick();
  }
  if (!raf) raf = requestAnimationFrame(() => { raf = 0; if (drag) put(drag.li, drag.x); });
}

function end(e: TouchEvent): void {
  cand = null;
  if (!drag || e.touches.length > 0) return;
  const d = drag;
  drag = null;
  const v = velocityOf(d.samples, e.timeStamp);
  const how = rowEnds(d.x, v, d.w, ROW_OPEN);
  if (how === 'shut') { shut(d.li, v); return; }
  if (how === 'open') { rested = d.li; go(d.li, d.x, -ROW_OPEN, v); return; }
  // across: the row goes off, and `later` is pressed for it; a row still there after (it could not be done) comes back
  const li = d.li;
  go(li, d.x, -(d.w + 40), v, () => {
    li.querySelector<HTMLElement>('.swipe-acts [data-act="postpone"]')?.click();
    setTimeout(() => { if (li.isConnected) shut(li); }, 1500);
  });
}

// a tap on a row resting open shuts it, and is not the row's own press; one of its actions is
function click(e: MouseEvent): void {
  if (!rested) return;
  const li = rested;
  const on = e.target as Element | null;
  if (on?.closest('.swipe-acts')) { rested = null; setTimeout(() => { if (li.isConnected) shut(li); }, 1500); return; }
  if (li.contains(on)) { e.preventDefault(); e.stopPropagation(); }
  shut(li);
}

/** A queue's rows follow a sideways finger from now on. Resolves to a stop. */
export function installRowSwipe(): () => void {
  window.addEventListener('touchstart', start, { passive: true });
  window.addEventListener('touchmove', move, { passive: false });
  window.addEventListener('touchend', end, { passive: true });
  window.addEventListener('touchcancel', end, { passive: true });
  window.addEventListener('click', click, true);
  return () => {
    window.removeEventListener('touchstart', start);
    window.removeEventListener('touchmove', move);
    window.removeEventListener('touchend', end);
    window.removeEventListener('touchcancel', end);
    window.removeEventListener('click', click, true);
    cand = null;
    drag = null;
    rested = null;
  };
}
