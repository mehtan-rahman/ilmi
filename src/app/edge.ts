// What follows a finger sideways (`gesture.ts` has the numbers): the
// sidebar's sheet, pulled in from the left edge and pushed back out, and on
// a phone the page in front, pulled off to the right to go back to the day
// under it. Each is moved by its transform alone, written here as the
// finger moves (never through React, and nothing of the app's state changes
// until it has landed), settles open or shut by where it was let go and how
// fast, and can be caught again on its way. The sheet opened or shut by
// anything else (its button, a row, its scrim: `sheetTo`) moves the same
// way, from rest.
//
// A phone's left edge is one gesture with two ends: on a page opened from
// the day (a row of the queue, a session) or from anywhere but the tree it
// goes back to the day; on a page opened from the tree, and on the day
// itself, it brings the tree in, which is where that page came from. An
// iPad upright has only the sheet. Over something moved along sideways (a
// book's page zoomed in) the finger pans that, and under the Pencil nothing
// here moves at all.
//
// Nothing here runs under a smoke, in a test, on e-ink, or where the system
// asks for less motion (`quiet`): there the sheet is in the page only while
// it is open, and the old swipe in `App.tsx` opens and closes it at once.

import { flushSync } from 'react-dom';
import { EDGE, UNDER, axisOf, edgeMeans, scrolledSideways, settleEase, settleMs, settlesOpen, velocityOf, type Sample } from './gesture.js';
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

// the sheet kept in the page, shut off its edge (`App.tsx` keeps it there where things move): `data-on` says it is
// anywhere but shut (`moving`, placed by what is written here, or `open`, at rest)
const sheetEl = (): HTMLElement | null => document.querySelector<HTMLElement>('.shell > .side[data-sheet="1"][data-kept]');
const scrimEl = (): HTMLElement | null => document.querySelector<HTMLElement>('.shell > .side-scrim[data-kept]');

function sheetSlide(): Slide | null {
  const el = sheetEl();
  if (!el) return null;
  const w = el.offsetWidth;
  if (w <= 0) return null;
  return {
    kind: 'sheet',
    w,
    read: () => (el.dataset.on === 'open' ? w : el.dataset.on ? Math.min(w, Math.max(0, w + xOf(el))) : 0),
    paint(x) {
      const s = scrimEl();
      el.dataset.on = 'moving';
      el.style.willChange = 'transform';
      el.style.transform = `translate3d(${(x - w).toFixed(1)}px,0,0)`;
      if (s) {
        s.dataset.on = 'moving';
        s.style.willChange = 'opacity';
        s.style.opacity = (x / w).toFixed(3);
      }
    },
    ease(ms, curve = 'ease-out') {
      const t = ms > 0 ? `${ms}ms ${curve}` : '';
      el.style.transition = t ? `transform ${t}` : 'none';
      const s = scrimEl();
      if (s) s.style.transition = t ? `opacity ${t}` : 'none';
    },
    land(open) {
      for (const n of [el, scrimEl()]) {
        if (!n) continue;
        n.style.transition = '';
        n.style.willChange = '';
        n.style.transform = '';
        n.style.opacity = '';
        if (open) n.dataset.on = 'open'; else delete n.dataset.on;
      }
      if (useApp.getState().sideSheet !== open) useApp.setState({ sideSheet: open });
    },
  };
}

// a page pulled off by the finger is gone when it lands: the canvas does not slide it out again (`Canvas.tsx`)
let popping = false;
export const isPopping = (): boolean => popping;

const topEl = (): HTMLElement | null => document.querySelector<HTMLElement>('.canvas > .pane-top[data-active="1"]');
const dayEl = (): HTMLElement | null => document.querySelector<HTMLElement>('.canvas > .pane-day');

function backSlide(): Slide | null {
  const top = topEl();
  const day = dayEl();
  if (!top || !day) return null;
  const w = top.offsetWidth;
  if (w <= 0) return null;
  return {
    kind: 'back',
    w,
    read: () => Math.min(w, Math.max(0, xOf(top))),
    paint(x) {
      top.style.willChange = 'transform';
      day.style.willChange = 'transform';
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
      } else {
        top.style.transform = '';
        top.style.willChange = '';
      }
      day.style.transform = '';
      day.style.willChange = '';
    },
  };
}

// where a phone's page was opened from: the tree's (the edge brings the tree back), or anywhere else (the edge goes
// back to the day). The tab the tree opened is remembered, not that the tree opened something: what is opened next
// from the palette, a link or a row is another tab, and not the tree's
let treeTab: number | null = null;
/** A phone's page opened from the tree (`App.tsx`), once it is the page in front. */
export function openedFromTree(): void {
  treeTab = activeTab(useApp.getState().panes)?.key ?? null;
}
const fromTree = (): boolean => treeTab !== null && activeTab(useApp.getState().panes)?.key === treeTab;

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

interface Flight {
  slide: Slide;
  open: boolean;
  timer: ReturnType<typeof setTimeout> | undefined;
  /** Waiting to start (what was just drawn is on the glass first), a frame's id. */
  wait: number;
}

let cand: { x: number; y: number; edge: boolean } | null = null;
let drag: Drag | null = null;
let flight: Flight | null = null;
let raf = 0;

/** A page is being pulled back, or is on its way: the canvas leaves it and the day under it alone. */
export const backBusy = (): boolean => drag?.slide.kind === 'back' || flight?.slide.kind === 'back';

const paintSoon = (): void => {
  if (raf) return;
  raf = requestAnimationFrame(() => {
    raf = 0;
    if (drag) drag.slide.paint(drag.x);
  });
};

function drop(): void {
  if (!flight) return;
  clearTimeout(flight.timer);
  if (flight.wait) cancelAnimationFrame(flight.wait);
  flight = null;
}

function land(): void {
  if (!flight) return;
  const f = flight;
  drop();
  f.slide.land(f.open);
}

/**
 * `slide` from `from` to open or shut, let go at `v`. With `wait` it starts two frames on: what the same change
 * of state drew (a page opened by the row that shut the sheet) is on the glass before anything moves, so the
 * movement is not what pays for drawing it.
 */
function fly(slide: Slide, from: number, open: boolean, v: number, wait = false): void {
  drop();
  const to = open ? slide.w : 0;
  const ms = settleMs(to - from, v);
  slide.ease(0);
  slide.paint(from);
  if (ms === 0) { slide.paint(to); slide.land(open); return; }
  const f: Flight = { slide, open, timer: undefined, wait: 0 };
  flight = f;
  const go = (): void => {
    f.wait = 0;
    // what is drawn now is where it leaves from
    void slide.read();
    slide.ease(ms, settleEase(to - from, v, ms));
    slide.paint(to);
    f.timer = setTimeout(land, ms + 30);
  };
  if (wait) f.wait = requestAnimationFrame(() => { f.wait = requestAnimationFrame(go); });
  else go();
}

/**
 * The sheet opened or shut by something other than the finger (`App.tsx`, as its state says): it goes there from
 * where it is, by the movement a finger's settle has. Nothing where it is there already, or where the finger has it.
 */
export function sheetTo(open: boolean): void {
  const slide = sheetSlide();
  if (!slide || drag?.slide.kind === 'sheet') return;
  if (flight?.slide.kind === 'sheet') {
    if (flight.open === open) return;
    drop();
  }
  const at = slide.read();
  if (Math.abs(at - (open ? slide.w : 0)) < 1) { slide.land(open); return; }
  fly(slide, at, open, 0, true);
}

const stylus = (t: Touch): boolean => (t as Touch & { touchType?: string }).touchType === 'stylus';
const sheetShape = (): boolean => { const s = document.documentElement.dataset.shape; return s === 'phone' || s === 'portrait'; };

function start(e: TouchEvent): void {
  const t = e.touches[0];
  if (!t || e.touches.length !== 1 || stylus(t)) { if (drag) end(); cand = null; return; }
  cand = null;
  if (quiet() || !sheetShape() || useApp.getState().vault === null) return;
  // on its way: caught where it is, if the finger lands on it
  if (flight) {
    const moving = flight.slide;
    const x = moving.read();
    const on = moving.kind === 'sheet' ? t.clientX <= x : t.clientX >= x;
    if (x > 1 && x < moving.w - 1 && on) {
      const toward = flight.open;
      drop();
      moving.ease(0);
      moving.paint(x);
      drag = { slide: moving, grab: t.clientX - x, x, samples: [{ t: e.timeStamp, at: x }], moved: false, toward };
      return;
    }
    // not caught: one that has all but arrived lands now, and this touch is a touch like any other; one still on
    // its way is left to arrive, and this touch moves nothing
    if (Math.abs(x - (flight.open ? moving.w : 0)) >= 2) return;
    land();
  }
  // at the edge, over something moved along sideways (a page zoomed in, a wide table): the finger pans it back, and
  // the edge's swipe is for when it stands at its left end
  const on = e.target instanceof Element ? e.target : null;
  const edge = t.clientX <= EDGE && !scrolledSideways(on, on?.closest('.pane, .side') ?? null);
  cand = { x: t.clientX, y: t.clientY, edge };
}

function begin(e: TouchEvent, t: Touch, dx: number): void {
  const s = useApp.getState();
  let slide: Slide | null = null;
  let x = 0;
  if (sheetEl()?.dataset.on === 'open') {
    if (dx < 0) { slide = sheetSlide(); x = slide?.w ?? 0; }
  } else if (cand?.edge && dx > 0 && !s.sideSheet && !s.paletteOpen && !s.tweaksOpen && s.quickCard === null) {
    const tab = activeTab(s.panes)?.id;
    if (edgeMeans(s.phone, tab !== undefined && tab !== TODAY, fromTree()) === 'back') {
      slide = backSlide();
      // a page still on its way in is taken from where it is, not from where it was going
      x = slide?.read() ?? 0;
      if (slide && x >= slide.w - 1) slide = null;
    } else slide = sheetSlide();
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
    if (axis === 'y') { cand = null; return; }
    begin(e, t, dx);
    if (!drag) return;
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
  if (!drag) return;
  const d = drag;
  drag = null;
  const v = d.moved ? velocityOf(d.samples, e?.timeStamp ?? d.samples[d.samples.length - 1]!.t) : 0;
  const open = !d.moved && d.toward !== null ? d.toward : settlesOpen(d.x / d.slide.w, v);
  fly(d.slide, d.x, open, v);
}

/** The sheet and a phone's page follow the finger from now on. Resolves to a stop. */
export function installEdge(): () => void {
  const onEnd = (e: TouchEvent) => { if (e.touches.length === 0) end(e); };
  window.addEventListener('touchstart', start, { passive: true });
  window.addEventListener('touchmove', move, { passive: false });
  window.addEventListener('touchend', onEnd, { passive: true });
  window.addEventListener('touchcancel', onEnd, { passive: true });
  const unsub = useApp.subscribe((s) => {
    // the day in front again: the next page starts from it
    if (treeTab !== null && activeTab(s.panes)?.id === TODAY) treeTab = null;
  });
  return () => {
    window.removeEventListener('touchstart', start);
    window.removeEventListener('touchmove', move);
    window.removeEventListener('touchend', onEnd);
    window.removeEventListener('touchcancel', onEnd);
    unsub();
    cand = null;
    drag = null;
    drop();
  };
}
