// What follows a finger sideways (`gesture.ts` has the numbers): the
// sidebar's sheet, pulled in from the left edge and pushed back out, and on
// a phone the page in front, pulled off to the right to go back to the day
// under it. Each is moved by its transform alone, written here as the
// finger moves (never through React), settles open or shut by where it was
// let go and how fast, and can be caught again on its way.
//
// A phone's left edge is one gesture with two ends: on a page opened from
// the day (a row of the queue, a session) it goes back to the day; on a
// page opened from the tree, and on the day itself, it brings the tree in,
// which is where that page came from. An iPad upright has only the sheet.
//
// Nothing here runs under a smoke, in a test, on e-ink, or where the system
// asks for less motion (`quiet`): there the old swipe in `App.tsx` opens and
// closes the sheet at once.

import { flushSync } from 'react-dom';
import { EDGE, UNDER, axisOf, edgeMeans, settleEase, settleMs, settlesOpen, velocityOf, type Sample } from './gesture.js';
import { quiet } from './motion.js';
import { queueId } from './names.js';
import { activeTab } from './panes.js';
import { useApp } from './store.js';
import { openNode } from './vault.js';

const TODAY = queueId('today');

/** What a finger slides: `w` its travel, `x` in 0…w how far open it is. */
interface Slide {
  kind: 'sheet' | 'back';
  w: number;
  /** Where it is now, as drawn. */
  read(): number;
  paint(x: number): void;
  /** The rest of the way in `ms` by `curve`, or with 0 no transition at all. */
  ease(ms: number, curve?: string): void;
  land(open: boolean): void;
}

const xOf = (el: Element): number => {
  const t = getComputedStyle(el).transform;
  if (!t || t === 'none') return 0;
  const m = /matrix(3d)?\(([^)]+)\)/.exec(t);
  if (!m) return 0;
  const n = m[2]!.split(',').map(Number);
  return (m[1] ? n[12] : n[4]) ?? 0;
};

const sheetEl = (): HTMLElement | null => document.querySelector<HTMLElement>('.shell > .side[data-sheet="1"]');
const scrimEl = (): HTMLElement | null => document.querySelector<HTMLElement>('.shell > .side-scrim:not([data-ghost])');

// the sheet's state set from here: the store's watcher below leaves it alone
let ours = false;
const setSheet = (on: boolean): void => {
  ours = true;
  try { flushSync(() => useApp.setState({ sideSheet: on })); } finally { ours = false; }
};

function sheetSlide(): Slide | null {
  const el = sheetEl();
  if (!el) return null;
  const w = el.offsetWidth;
  if (w <= 0) return null;
  const hold = () => { el.dataset.held = '1'; const s = scrimEl(); if (s) s.dataset.held = '1'; };
  return {
    kind: 'sheet',
    w,
    read: () => Math.min(w, Math.max(0, w + xOf(el))),
    paint(x) {
      hold();
      el.style.transform = `translate3d(${(x - w).toFixed(1)}px,0,0)`;
      const s = scrimEl();
      if (s) s.style.opacity = (x / w).toFixed(3);
    },
    ease(ms, curve = 'ease-out') {
      const t = ms > 0 ? `${ms}ms ${curve}` : '';
      el.style.transition = t ? `transform ${t}` : 'none';
      const s = scrimEl();
      if (s) s.style.transition = t ? `opacity ${t}` : 'none';
    },
    land(open) {
      const s = scrimEl();
      el.style.transition = '';
      if (s) s.style.transition = '';
      if (open) {
        el.style.transform = '';
        if (s) s.style.opacity = '';
        if (!useApp.getState().sideSheet) setSheet(true);
      } else if (useApp.getState().sideSheet) {
        // shut where it stands (off the edge): what React keeps of it for a moment has nothing left to show
        setSheet(false);
      }
    },
  };
}

// a page pulled off by the finger is gone when it lands: the canvas does not slide it out again (`Canvas.tsx`)
let popping = false;
export const isPopping = (): boolean => popping;

// a finger at a phone's left edge that may pull the page back: the day under the page is wanted (it is kept there not
// drawn, `Canvas.tsx`), and under a session the strip and the bar (`App.tsx`). Told again, off, when nothing came of it
const peeks = new Set<(on: boolean) => void>();
let peeking = false;
/** What hears that the day under a phone's page is about to be seen (`on`), or is not after all. */
export function onPeek(fn: (on: boolean) => void): () => void {
  peeks.add(fn);
  return () => { peeks.delete(fn); };
}
function peek(on: boolean): void {
  if (peeking === on) return;
  peeking = on;
  for (const fn of peeks) fn(on);
}

const topEl = (): HTMLElement | null => document.querySelector<HTMLElement>('.canvas > .pane-top[data-active="1"]');
const dayEl = (): HTMLElement | null => document.querySelector<HTMLElement>('.canvas > .pane-day');

function backSlide(): Slide | null {
  const top = topEl();
  const day = dayEl();
  if (!top || !day) return null;
  const w = top.offsetWidth;
  if (w <= 0) return null;
  peek(true);
  return {
    kind: 'back',
    w,
    read: () => Math.min(w, Math.max(0, xOf(top))),
    paint(x) {
      top.dataset.held = '1';
      day.dataset.held = '1';
      delete day.dataset.covered;
      top.style.transform = `translate3d(${x.toFixed(1)}px,0,0)`;
      day.style.transform = `translate3d(${(-UNDER * (w - x)).toFixed(1)}px,0,0)`;
    },
    ease(ms, curve = 'ease-out') {
      const t = ms > 0 ? `transform ${ms}ms ${curve}` : 'none';
      top.style.transition = t;
      day.style.transition = t;
    },
    land(open) {
      top.style.transition = '';
      day.style.transition = '';
      if (open) {
        popping = true;
        try { flushSync(() => openNode(TODAY)); } finally { popping = false; }
        peeking = false;
      } else {
        top.style.transform = '';
        day.dataset.covered = '1';
      }
      day.style.transform = '';
      delete day.dataset.held;
      if (!open) peek(false);
    },
  };
}

// where a phone's page was opened from: the tree's (the edge brings the tree back), or the day's (the edge goes back to it)
let fromTree = false;
/** A phone's page opened from the tree (`App.tsx`). */
export function openedFromTree(): void {
  fromTree = true;
}

interface Drag {
  slide: Slide;
  /** The finger's x less the slide's, kept while it is held. */
  grab: number;
  x: number;
  samples: Sample[];
  moved: boolean;
  /** Where it was headed when caught: a catch let go without a move goes on there. */
  toward: boolean | null;
}

let cand: { x: number; y: number; edge: boolean } | null = null;
let drag: Drag | null = null;
let flight: { slide: Slide; open: boolean; timer: ReturnType<typeof setTimeout> } | null = null;
let raf = 0;

/** A page is being pulled back, or is on its way: the canvas leaves the day under it in view. */
export const backBusy = (): boolean => drag?.slide.kind === 'back' || flight?.slide.kind === 'back';

const paintSoon = (): void => {
  if (raf) return;
  raf = requestAnimationFrame(() => {
    raf = 0;
    if (drag) drag.slide.paint(drag.x);
  });
};

function land(): void {
  if (!flight) return;
  const f = flight;
  clearTimeout(f.timer);
  flight = null;
  f.slide.land(f.open);
}

function fly(slide: Slide, from: number, open: boolean, v: number): void {
  const to = open ? slide.w : 0;
  const ms = settleMs(to - from, v);
  slide.paint(from);
  if (ms === 0) { slide.ease(0); slide.paint(to); slide.land(open); return; }
  // what is drawn now is where it leaves from
  void slide.read();
  slide.ease(ms, settleEase(to - from, v, ms));
  slide.paint(to);
  flight = { slide, open, timer: setTimeout(land, ms + 30) };
}

const stylus = (t: Touch): boolean => (t as Touch & { touchType?: string }).touchType === 'stylus';
const sheetShape = (): boolean => { const s = document.documentElement.dataset.shape; return s === 'phone' || s === 'portrait'; };

function start(e: TouchEvent): void {
  const t = e.touches[0];
  if (!t || e.touches.length !== 1 || stylus(t)) { if (drag) end(); cand = null; return; }
  cand = null;
  if (quiet() || !sheetShape() || useApp.getState().vault === null) return;
  // on its way: caught where it is, if the finger lands on it
  const moving = flight?.slide ?? sheetSlide();
  if (moving) {
    const x = moving.read();
    const on = moving.kind === 'sheet' ? t.clientX <= x : t.clientX >= x;
    if (x > 1 && x < moving.w - 1 && on) {
      const toward = flight ? flight.open : useApp.getState().sideSheet;
      if (flight) { clearTimeout(flight.timer); flight = null; }
      // (one that was leaving is the open sheet again first, so its scrim is there to be held with it)
      if (moving.kind === 'sheet' && !useApp.getState().sideSheet) { sheetEl()!.dataset.held = '1'; sheetEl()!.style.transform = `translate3d(${(x - moving.w).toFixed(1)}px,0,0)`; setSheet(true); }
      moving.ease(0);
      moving.paint(x);
      drag = { slide: moving, grab: t.clientX - x, x, samples: [{ t: e.timeStamp, at: x }], moved: false, toward };
      return;
    }
    if (flight) return;
  }
  cand = { x: t.clientX, y: t.clientY, edge: t.clientX <= EDGE };
  // a touch at the edge of a page that goes back: the day is woken now, before the finger has moved far enough to tell
  const s = useApp.getState();
  const tab = activeTab(s.panes)?.id;
  if (cand.edge && !s.sideSheet && edgeMeans(s.phone, tab !== undefined && tab !== TODAY, fromTree) === 'back' && topEl()) peek(true);
}

function begin(e: TouchEvent, t: Touch, dx: number): void {
  const s = useApp.getState();
  let slide: Slide | null = null;
  let x = 0;
  if (s.sideSheet) {
    if (dx < 0) { slide = sheetSlide(); x = slide?.w ?? 0; }
  } else if (cand?.edge && dx > 0 && !s.paletteOpen && !s.tweaksOpen && s.quickCard === null) {
    const tab = activeTab(s.panes)?.id;
    if (edgeMeans(s.phone, tab !== undefined && tab !== TODAY, fromTree) === 'back') slide = backSlide();
    else {
      setSheet(true);
      slide = sheetSlide();
      if (!slide) setSheet(false);
    }
  }
  cand = null;
  if (!slide) return;
  slide.ease(0);
  slide.paint(x);
  drag = { slide, grab: t.clientX - x, x, samples: [{ t: e.timeStamp, at: x }], moved: false, toward: null };
}

function move(e: TouchEvent): void {
  const t = e.touches[0];
  if (!t) return;
  if (!drag) {
    if (!cand) return;
    const dx = t.clientX - cand.x;
    const axis = axisOf(dx, t.clientY - cand.y);
    if (axis === null) return;
    if (axis === 'y') { cand = null; peek(false); return; }
    begin(e, t, dx);
    if (!drag) { peek(false); return; }
  }
  if (e.cancelable) e.preventDefault();
  const d = drag as Drag;
  d.x = Math.min(d.slide.w, Math.max(0, t.clientX - d.grab));
  d.moved = true;
  d.samples.push({ t: e.timeStamp, at: d.x });
  if (d.samples.length > 12) d.samples.shift();
  paintSoon();
}

function end(e?: TouchEvent): void {
  cand = null;
  if (!drag) { if (!flight) peek(false); return; }
  const d = drag;
  drag = null;
  const v = d.moved ? velocityOf(d.samples, e?.timeStamp ?? d.samples[d.samples.length - 1]!.t) : 0;
  const open = !d.moved && d.toward !== null ? d.toward : settlesOpen(d.x / d.slide.w, v);
  fly(d.slide, d.x, open, v);
}

/**
 * The sheet and a phone's page follow the finger from now on. Resolves to a
 * stop. The sheet opened or closed by anything else (its button, a row, the
 * scrim) is let go of here, so its own motion (`motion.css`) plays.
 */
export function installEdge(): () => void {
  const onEnd = (e: TouchEvent) => { if (e.touches.length === 0) end(e); };
  window.addEventListener('touchstart', start, { passive: true });
  window.addEventListener('touchmove', move, { passive: false });
  window.addEventListener('touchend', onEnd, { passive: true });
  window.addEventListener('touchcancel', onEnd, { passive: true });
  const unsub = useApp.subscribe((s, was) => {
    // the day in front again: the next page starts from it
    if (activeTab(s.panes)?.id === TODAY) fromTree = false;
    if (s.sideSheet === was.sideSheet || ours) return;
    if (drag?.slide.kind === 'sheet') drag = null;
    if (flight?.slide.kind === 'sheet') { clearTimeout(flight.timer); flight = null; }
    const el = sheetEl();
    const scrim = scrimEl();
    for (const n of [el, scrim]) {
      if (!n) continue;
      n.style.transition = '';
      n.style.transform = '';
      n.style.opacity = '';
      // opened again while what was dragged shut is still leaving: it comes in as any sheet does
      if (s.sideSheet) delete n.dataset.held;
    }
  });
  return () => {
    window.removeEventListener('touchstart', start);
    window.removeEventListener('touchmove', move);
    window.removeEventListener('touchend', onEnd);
    window.removeEventListener('touchcancel', onEnd);
    unsub();
    cand = null;
    drag = null;
    if (flight) { clearTimeout(flight.timer); flight = null; }
  };
}
