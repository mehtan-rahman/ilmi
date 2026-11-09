// @vitest-environment jsdom
// The mouse's drag of a row (`drag.ts`) as a statechart, and the real module
// checked against it over every reachable state.
//
// The chart (`CHART`, data): idle → armed (a press on a row that drags) →
// dragging (past `SLOP`; over a row, a zone, resting or not) → idle on the
// let-go (one `placeNode` when the mark said where) or on a cancel (the
// pointer's, the window's blur, a move with no button down: the let-go was
// missed); Esc takes dragging to cancelled, where nothing is drawn and the
// let-go, when it comes, does nothing and its click is swallowed. A press
// while one is under way (its let-go missed) ends that one first.
//
// The world: a tree of four rows (a folded folder `f` that springs open, bare
// documents `a`, `b`, `c`) and a notebook rail's row `R` for `b.md` too (the
// same `data-drop-row` as the tree's, drawn after it, with its own geometry),
// hit-tested by a stubbed `elementFromPoint`; time on fake timers. Every
// event is sent to both; after each step the real state must be the model's:
// `useDrag`, the ghost, `data-node-drag`, the timers, the window's listeners,
// `placeNode`'s calls, the springs, whether the let-go's click reached the row.
//
// The exploration is a breadth-first search over the model's states (time
// kept as the rest's and the hover's ages in 50 ms steps, capped past the
// thresholds, so the space is finite) to its closure: every reachable state
// is entered and every event tried from it, replayed on the real module from
// a clean start. Random long walks then cross many drags in one run, for state
// one drag leaves to the next.

import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';
import { INTO_DWELL, SPRING_MS, dropAt, type Drop, type RowGeom } from '../dnd.js';

const placed: string[] = [];
vi.mock('../vault.js', () => ({
  placeNode: vi.fn(async (path: string, target: string, mode: string) => { placed.push(`${path} ${mode} ${target}`); return path; }),
}));

// the window's listeners that `drag.ts` adds, by type (jsdom's selector engine adds its own)
const reg = new Set<string>();
const fromDrag = () => /\/src\/app\/drag\.ts/.test(new Error().stack ?? '');
const ids = new WeakMap<object, number>();
let nid = 0;
const idOf = (fn: object) => { let k = ids.get(fn); if (k === undefined) { k = ++nid; ids.set(fn, k); } return k; };
const regKey = (type: string, fn: unknown, opts: unknown) =>
  `${type}|${typeof opts === 'boolean' ? opts : !!(opts as AddEventListenerOptions | undefined)?.capture}|${idOf(fn as object)}`;
const add0 = window.addEventListener.bind(window);
const rem0 = window.removeEventListener.bind(window);
window.addEventListener = ((type: string, fn: EventListenerOrEventListenerObject | null, opts?: boolean | AddEventListenerOptions) => {
  if (fn && fromDrag()) reg.add(regKey(type, fn, opts));
  if (fn) add0(type, fn, opts);
}) as typeof window.addEventListener;
window.removeEventListener = ((type: string, fn: EventListenerOrEventListenerObject | null, opts?: boolean | EventListenerOptions) => {
  if (fn) reg.delete(regKey(type, fn, opts));
  if (fn) rem0(type, fn, opts);
}) as typeof window.removeEventListener;
const listens = (type: string) => [...reg].some((k) => k.startsWith(`${type}|`));

const { SLOP, endDrag, rowDrag, useDrag } = await import('../drag.js');
type Surface = Parameters<typeof rowDrag>[1];

// ── the world ───────────────────────────────────────────────────

type El = 'f' | 'a' | 'b' | 'c' | 'R';
type Zone = 'top' | 'mid' | 'bot';
type Pos = `${El}.${Zone}` | 'off' | 'near';
const H = 24;
const ELS: El[] = ['f', 'a', 'b', 'c', 'R'];
/** Each row's band (its top is `band * H`); band 4 is empty, off every row. */
const BAND: Record<El, number> = { f: 0, a: 1, b: 2, c: 3, R: 5 };
const ZY: Record<Zone, number> = { top: 3, mid: 12, bot: 21 };
const POS: Pos[] = ['f.top', 'f.mid', 'f.bot', 'a.mid', 'b.top', 'b.mid', 'b.bot', 'c.bot', 'R.mid', 'off', 'near'];
const LABEL: Record<El, string> = { f: 'f', a: 'a', b: 'b', c: 'c', R: 'b' };

let world: World | null = null;
const TREE: Surface = { pad: 6, indent: 10, spring: (p) => world?.sprang(p) };
const RAIL: Surface = { pad: 20, indent: 14 };

/** How row `el` is drawn: the tree's four rows (`f` folded until it springs), the rail's row for `b.md`, deeper and nesting at once. */
function geom(el: El, fOpen: boolean): { g: RowGeom; s: Surface; folded: boolean } {
  switch (el) {
    case 'f': return { g: { path: 'f', depth: 1, nest: 'now', tail: ['f'], ...(fOpen ? { firstChild: 'f/z.md' } : {}) }, s: TREE, folded: !fOpen };
    case 'a': return { g: { path: 'a.md', depth: 1, nest: 'dwell', tail: ['a.md'] }, s: TREE, folded: false };
    case 'b': return { g: { path: 'b.md', depth: 1, nest: 'dwell', tail: ['b.md'] }, s: TREE, folded: false };
    case 'c': return { g: { path: 'c.md', depth: 1, nest: 'dwell', tail: ['c.md'] }, s: TREE, folded: false };
    case 'R': return { g: { path: 'b.md', depth: 3, nest: 'now', tail: ['b.md'] }, s: RAIL, folded: false };
  }
}

/** The real rows: elements, rendered (as React would, on every change of the drag) through `rowDrag`. */
class World {
  els = {} as Record<El, HTMLElement>;
  props = {} as Partial<Record<El, ReturnType<typeof rowDrag>>>;
  fOpen = false;
  bGone = false;
  springs: string[] = [];
  tree = document.createElement('div');
  rail = document.createElement('div');
  constructor() {
    document.body.innerHTML = '';
    document.body.append(this.tree, this.rail);
    for (const el of ELS) {
      const e = document.createElement('div');
      e.dataset.dropRow = geom(el, false).g.key ?? geom(el, false).g.path;
      e.innerHTML = `<span class="name">${LABEL[el]}</span>`;
      const band = BAND[el];
      e.getBoundingClientRect = () => ({ top: band * H, height: H, left: 0, bottom: (band + 1) * H, right: 200, width: 200, x: 0, y: band * H, toJSON() {} });
      (el === 'R' ? this.rail : this.tree).appendChild(e);
      this.els[el] = e;
    }
    this.render();
  }
  render(): void {
    for (const el of ELS) {
      if (el === 'b' && this.bGone) continue;
      const { g, s, folded } = geom(el, this.fOpen);
      const p = rowDrag(g, s, { draggable: el !== 'R', folded });
      (p as { ref?: (e: HTMLElement | null) => void }).ref?.(this.els[el]);
      this.props[el] = p;
    }
  }
  sprang(p: string): void {
    this.springs.push(p);
    this.fOpen = true;
    this.render();
  }
  at(x: number, y: number): Element | null {
    const band = Math.floor(y / H);
    const el = ELS.find((e) => BAND[e] === band && this.els[e].isConnected);
    return el ? this.els[el].firstElementChild : document.body;
  }
}

let reached = 0;
document.addEventListener('click', () => { reached++; });
useDrag.subscribe(() => world?.render());

// ── the model ───────────────────────────────────────────────────

type Phase = 'idle' | 'armed' | 'dragging' | 'cancelled';
type Ev = 'downA' | 'downB' | `mv ${Pos}` | 'lost' | 't200' | 't400' | 'esc' | 'up' | 'pcancel' | 'blur' | 'rmB' | 'backB' | 'foldF';
const EVENTS: Ev[] = ['downA', 'downB', ...POS.map((p) => `mv ${p}` as Ev), 'lost', 't200', 't400', 'esc', 'up', 'pcancel', 'blur', 'rmB', 'backB', 'foldF'];

interface M {
  phase: Phase;
  /** The node pressed (and dragged). */
  src: 'a.md' | 'b.md' | null;
  /** The row last pressed: `near` is 2 px from its middle. */
  pressAt: 'a' | 'b';
  pos: Pos;
  /** The row the drag last read under the pointer, how long it has been on it, and on its middle (ms, capped). */
  hover: { el: El; age: number; mid: number | null } | null;
  drop: Drop | null;
  /** The cursor: the last read found a drop. */
  ok: boolean;
  sprung: boolean;
  fOpen: boolean;
  bGone: boolean;
}
interface Out { placed: string[]; springs: string[]; click: boolean | null }

const init = (): M => ({ phase: 'idle', src: null, pressAt: 'a', pos: 'off', hover: null, drop: null, ok: false, sprung: false, fOpen: false, bGone: false });

function xy(m: M, pos: Pos): [number, number] {
  if (pos === 'off') return [50, 4 * H + 12];
  if (pos === 'near') return [52, BAND[m.pressAt] * H + 12];
  const [el, z] = pos.split('.') as [El, Zone];
  return [50, BAND[el] * H + ZY[z]];
}
const hitAt = (m: M, pos: Pos): El | null => {
  const el: El | null = pos === 'off' ? null : pos === 'near' ? m.pressAt : (pos.split('.')[0] as El);
  return el === 'b' && m.bGone ? null : el;
};
const inSlop = (m: M, pos: Pos): boolean => {
  const [x, y] = xy(m, pos);
  return Math.hypot(x - 50, y - (BAND[m.pressAt] * H + 12)) < SLOP;
};

/** The drag reads the row under the pointer (a move, a tick, the let-go): the hover kept or begun, the drop drawn, a folded row rested on long enough sprung (after the read, which drew with the row as it was). */
function read(m: M, out: Out): void {
  const el = hitAt(m, m.pos);
  if (!el) { m.hover = null; m.drop = null; m.ok = false; return; }
  const { g, s, folded } = geom(el, m.fOpen);
  const [x, y0] = xy(m, m.pos);
  const y = y0 - BAND[el] * H;
  const inMid = y >= H / 4 && y < (H * 3) / 4;
  if (!m.hover || m.hover.el !== el) m.hover = { el, age: 0, mid: inMid ? 0 : null };
  else if (!inMid) m.hover.mid = null;
  else if (m.hover.mid === null) m.hover.mid = 0;
  const rested = m.hover.mid !== null && m.hover.mid >= INTO_DWELL;
  const spring = folded && !!s.spring && !m.sprung && m.hover.age >= SPRING_MS;
  m.drop = dropAt(g, { x, y, h: H, pad: s.pad, indent: s.indent }, m.src!, rested);
  m.ok = m.drop !== null;
  if (spring) { m.sprung = true; m.fOpen = true; out.springs.push(g.path); }
}

/** Time passes: the ticker reads the still pointer every 50 ms while dragging. */
function advance(m: M, ms: number, out: Out): void {
  for (let t = 0; t < ms; t += 50) {
    if (m.phase !== 'dragging') continue;
    if (m.hover) {
      m.hover.age = Math.min(SPRING_MS + 100, m.hover.age + 50);
      if (m.hover.mid !== null) m.hover.mid = Math.min(INTO_DWELL, m.hover.mid + 50);
    }
    read(m, out);
  }
}

const isMove = (e: Ev) => e.startsWith('mv ');
const posOf = (e: Ev) => e.slice(3) as Pos;
const isDown = (e: Ev) => e === 'downA' || e === 'downB';
const is = (...es: Ev[]) => (e: Ev) => es.includes(e);
const cancels = is('lost', 'pcancel', 'blur');

const arm = (m: M, e: Ev) => {
  m.pressAt = e === 'downA' ? 'a' : 'b';
  m.src = e === 'downA' ? 'a.md' : 'b.md';
  m.pos = `${m.pressAt}.mid`;
};
const clear = (m: M) => { m.hover = null; m.drop = null; m.ok = false; };
/** The let-go reads the row under it as a move does (a folded row rested on springs there too), and lands where that drew: the `placeNode` it asks, or null. */
const landing = (m: M, out: Out = { placed: [], springs: [], click: null }): string | null => {
  read(m, out);
  return hitAt(m, m.pos) && m.drop ? `${m.src} ${m.drop.mode} ${m.drop.target}` : null;
};
const lands = (m: M) => landing(structuredClone(m)) !== null;
const letGo = (m: M, _e: Ev, out: Out) => { const to = landing(m, out); if (to) out.placed.push(to); out.click = false; };

/** One transition: from a state, on an event, when its guard holds; `to` 'same' stays. */
interface Tr { from: Phase | '*'; on: (e: Ev) => boolean; ev: string; guard?: [string, (m: M, e: Ev) => boolean]; to: Phase | 'same'; act?: (m: M, e: Ev, out: Out) => void }

export const CHART: Tr[] = [
  // the world changes under any state; time passes in any state (only a drag reads it)
  { from: '*', ev: 'row removed', on: is('rmB'), to: 'same', act: (m) => { m.bGone = true; } },
  { from: '*', ev: 'row drawn again', on: is('backB'), to: 'same', act: (m) => { m.bGone = false; } },
  { from: '*', ev: 'folder folded', on: is('foldF'), to: 'same', act: (m) => { m.fOpen = false; } },
  { from: '*', ev: 'time', on: is('t200', 't400'), to: 'same', act: (m, e, out) => advance(m, e === 't200' ? 200 : 400, out) },

  { from: 'idle', ev: 'pointerdown', on: isDown, to: 'armed', act: arm },
  { from: 'idle', ev: 'move', on: isMove, to: 'idle', act: (m, e) => { m.pos = posOf(e); } },
  { from: 'idle', ev: 'pointerup', on: is('up'), to: 'idle', act: (_m, _e, out) => { out.click = true; } },
  { from: 'idle', ev: 'esc | lost | pointercancel | blur', on: is('esc', 'lost', 'pcancel', 'blur'), to: 'idle' },

  { from: 'armed', ev: 'move', on: isMove, guard: ['within slop', (m, e) => inSlop(m, posOf(e))], to: 'armed', act: (m, e) => { m.pos = posOf(e); } },
  { from: 'armed', ev: 'move', on: isMove, guard: ['past slop', (m, e) => !inSlop(m, posOf(e))], to: 'dragging', act: (m, e, out) => { m.pos = posOf(e); m.sprung = false; clear(m); read(m, out); } },
  { from: 'armed', ev: 'pointerup', on: is('up'), to: 'idle', act: (_m, _e, out) => { out.click = true; } },
  { from: 'armed', ev: 'lost | pointercancel | blur', on: cancels, to: 'idle' },
  { from: 'armed', ev: 'esc', on: is('esc'), to: 'armed' },
  { from: 'armed', ev: 'pointerdown', on: isDown, to: 'armed', act: arm },

  { from: 'dragging', ev: 'move', on: isMove, to: 'dragging', act: (m, e, out) => { m.pos = posOf(e); read(m, out); } },
  { from: 'dragging', ev: 'esc', on: is('esc'), to: 'cancelled', act: clear },
  { from: 'dragging', ev: 'pointerup', on: is('up'), guard: ['on a row with a drop', lands], to: 'idle', act: letGo },
  { from: 'dragging', ev: 'pointerup', on: is('up'), guard: ['off rows or refused', (m) => !lands(m)], to: 'idle', act: letGo },
  { from: 'dragging', ev: 'lost | pointercancel | blur', on: cancels, to: 'idle' },
  { from: 'dragging', ev: 'pointerdown', on: isDown, to: 'armed', act: arm },

  { from: 'cancelled', ev: 'move', on: isMove, to: 'cancelled', act: (m, e) => { m.pos = posOf(e); } },
  { from: 'cancelled', ev: 'esc', on: is('esc'), to: 'cancelled' },
  { from: 'cancelled', ev: 'pointerup', on: is('up'), to: 'idle', act: (_m, _e, out) => { out.click = false; } },
  { from: 'cancelled', ev: 'lost | pointercancel | blur', on: cancels, to: 'idle' },
  { from: 'cancelled', ev: 'pointerdown', on: isDown, to: 'armed', act: arm },
];

/** Whether event `e` can happen in `m`: a removed row is not pressed, nor drawn again twice; `near` is near a press. */
const enabled = (m: M, e: Ev): boolean => {
  if (e === 'downB') return !m.bGone;
  if (e === 'rmB') return !m.bGone;
  if (e === 'backB') return m.bGone;
  if (e === 'foldF') return m.fOpen;
  return true;
};

function step(m0: M, e: Ev): { m: M; out: Out } {
  const m = structuredClone(m0);
  const out: Out = { placed: [], springs: [], click: null };
  const hits = CHART.filter((t) => (t.from === '*' || t.from === m.phase) && t.on(e) && (!t.guard || t.guard[1](m, e)));
  if (hits.length !== 1) throw new Error(`the chart has ${hits.length} transitions for ${m.phase} --${e}-->`);
  const t = hits[0]!;
  t.act?.(m, e, out);
  if (t.to !== 'same') m.phase = t.to;
  if (m.phase !== 'dragging') { clear(m); m.sprung = false; }
  return { m, out };
}

/** The state, with what can no longer matter forgotten: the hover's age off a folded row that may spring, the rest off a document's middle. */
function key(m: M): string {
  const c = structuredClone(m);
  if (c.hover) {
    if (!(c.hover.el === 'f' && !c.sprung)) c.hover.age = 0;
    if (c.hover.el === 'f' || c.hover.el === 'R') c.hover.mid = null;
  }
  if (c.phase === 'idle') c.src = null;
  return JSON.stringify(c);
}

// ── the real module, driven ─────────────────────────────────────

const ptr = (type: string, x: number, y: number, buttons: number) =>
  window.dispatchEvent(Object.assign(new Event(type, { bubbles: true, cancelable: true }), { clientX: x, clientY: y, buttons, button: 0 }));

/** A clean start: the module is idle and the world drawn fresh. */
function fresh(): World {
  ptr('pointercancel', 0, 0, 0);
  endDrag();
  vi.clearAllTimers();
  world = new World();
  placed.length = 0;
  document.elementFromPoint = (x: number, y: number) => world!.at(x, y);
  return world;
}

function drive(w: World, m: M, e: Ev): Out {
  const out: Out = { placed: [], springs: [], click: null };
  const p0 = placed.length;
  const s0 = w.springs.length;
  if (isDown(e)) {
    const el = e === 'downA' ? 'a' : 'b';
    const [x, y] = [50, BAND[el] * H + 12];
    w.props[el]!.onPointerDown({ button: 0, pointerType: 'mouse', target: w.els[el].firstChild, currentTarget: w.els[el], clientX: x, clientY: y } as never);
  } else if (isMove(e)) {
    const [x, y] = xy({ ...m, pos: posOf(e) }, posOf(e));
    ptr('pointermove', x, y, 1);
  } else if (e === 'lost') {
    const [x, y] = xy(m, m.pos);
    ptr('pointermove', x, y, 0);
  } else if (e === 't200' || e === 't400') {
    vi.advanceTimersByTime(e === 't200' ? 200 : 400);
  } else if (e === 'esc') {
    window.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true, cancelable: true }));
  } else if (e === 'up') {
    const [x, y] = xy(m, m.pos);
    ptr('pointerup', x, y, 0);
    const r0 = reached;
    (document.elementFromPoint(x, y) ?? document.body).dispatchEvent(new MouseEvent('click', { bubbles: true, cancelable: true }));
    out.click = reached > r0;
    vi.advanceTimersByTime(0);
  } else if (e === 'pcancel') {
    ptr('pointercancel', 0, 0, 0);
  } else if (e === 'blur') {
    window.dispatchEvent(new FocusEvent('blur'));
  } else if (e === 'rmB') {
    w.els.b.remove();
    w.bGone = true;
    w.render();
  } else if (e === 'backB') {
    w.tree.insertBefore(w.els.b, w.els.c);
    w.bGone = false;
    w.render();
  } else if (e === 'foldF') {
    w.fOpen = false;
    w.render();
  }
  out.placed = placed.slice(p0);
  out.springs = w.springs.slice(s0);
  return out;
}

/** The real state against the model's, after a step: what is wrong, or null. */
function differs(m: M, want: Out, got: Out, w: World): string | null {
  const st = useDrag.getState();
  const ghost = document.querySelectorAll('.drag-ghost');
  const attr = document.documentElement.dataset.nodeDrag;
  const timers = vi.getTimerCount();
  const bad: string[] = [];
  const eq = (what: string, a: unknown, b: unknown) => { if (JSON.stringify(a) !== JSON.stringify(b)) bad.push(`${what}: real ${JSON.stringify(a)}, model ${JSON.stringify(b)}`); };
  eq('placeNode', got.placed, want.placed);
  eq('springs', got.springs, want.springs);
  if (want.click !== null) eq('the let-go\'s click reached the row', got.click, want.click);
  eq('the world', { fOpen: w.fOpen, bGone: w.bGone }, { fOpen: m.fOpen, bGone: m.bGone });
  if (m.phase === 'dragging') {
    eq('dragging', st.dragging, m.src);
    eq('drop', st.drop, m.drop);
    eq('ghost', [...ghost].map((g) => g.textContent), [m.pressAt]);
    eq('data-node-drag', attr, m.ok ? 'move' : 'none');
    if (timers < 1 || timers > 3) bad.push(`timers: ${timers} while dragging (the ticker, and at most the rest's and the spring's)`);
    if (!listens('pointermove') || !listens('pointerup') || !listens('keydown')) bad.push('listeners: a drag listens for moves, the let-go, and Esc');
  } else {
    eq('dragging', st.dragging, null);
    eq('drop', st.drop, null);
    eq('ghost', ghost.length, 0);
    eq('data-node-drag', attr, undefined);
    eq('timers', timers, 0);
    if (listens('keydown')) bad.push('listeners: Esc still listened for with no drag');
    const pressing = m.phase === 'armed' || m.phase === 'cancelled';
    if (listens('pointermove') !== pressing || listens('pointerup') !== pressing) bad.push(`listeners: pointer listened for ${listens('pointermove')}, a press under way ${pressing}`);
  }
  return bad.length ? bad.join('; ') : null;
}

/** Replay `path` on the model and the real module from a clean start; the first step where they part, or null. */
function replay(path: Ev[]): string | null {
  const w = fresh();
  const bad0 = differs(init(), { placed: [], springs: [], click: null }, { placed: [], springs: [], click: null }, w);
  if (bad0) return `not clean at the start: ${bad0}`;
  let m = init();
  for (let i = 0; i < path.length; i++) {
    const e = path[i]!;
    const real = drive(w, m, e);
    const next = step(m, e);
    m = next.m;
    const bad = differs(m, next.out, real, w);
    if (bad) return `${path.slice(0, i + 1).join(', ')}\n  → ${m.phase}: ${bad}`;
  }
  return null;
}

// ── the checks ──────────────────────────────────────────────────

beforeAll(() => { vi.useFakeTimers(); });
afterAll(() => { fresh(); vi.useRealTimers(); world = null; });

describe('the mouse\'s drag, as a statechart', () => {
  it('the chart is deterministic and total: every state and event has exactly one transition', () => {
    for (const phase of ['idle', 'armed', 'dragging', 'cancelled'] as Phase[]) {
      for (const e of EVENTS) {
        for (const pos of POS) {
          const m = { ...init(), phase, pos, src: 'a.md' as const };
          expect(() => step(m, e), `${phase} --${e}--> at ${pos}`).not.toThrow();
        }
      }
    }
  });

  it('every reachable state, every event from it: the real module does what the chart says', () => {
    // breadth first from idle; each state is entered once (by its shortest path) and every
    // event is tried from it, also those that lead back into a known state, each replayed
    // on the real module from a clean start and checked after every step
    const seen = new Set<string>([key(init())]);
    let frontier: { m: M; path: Ev[] }[] = [{ m: init(), path: [] }];
    const fails: string[] = [];
    let depth = 0;
    let tried = 0;
    while (frontier.length && depth < 24 && fails.length < 5) {
      const next: typeof frontier = [];
      for (const { m, path } of frontier) {
        for (const e of EVENTS) {
          if (!enabled(m, e)) continue;
          const to = step(m, e).m;
          const p = [...path, e];
          tried++;
          const bad = replay(p);
          if (bad) { fails.push(bad); continue; }
          const k = key(to);
          if (!seen.has(k)) { seen.add(k); next.push({ m: to, path: p }); }
        }
      }
      frontier = next;
      depth++;
    }
    expect(fails, `${fails.length} of ${tried} transitions part from the chart`).toEqual([]);
    // closed: nothing new is reachable, the search did not stop at its cap (660 states, 12 deep, some 14 000 transitions)
    expect(frontier.length).toBe(0);
    expect(seen.size).toBeGreaterThan(600);
  }, 120_000);

  it('long walks across many drags: nothing one drag leaves changes the next', () => {
    let seed = 72;
    const rnd = () => { seed = (seed * 1103515245 + 12345) % 2147483648; return seed / 2147483648; };
    const fails: string[] = [];
    for (let walk = 0; walk < 300 && fails.length < 3; walk++) {
      let m = init();
      const path: Ev[] = [];
      for (let i = 0; i < 60; i++) {
        const can = EVENTS.filter((e) => enabled(m, e));
        const e = can[Math.floor(rnd() * can.length)]!;
        path.push(e);
        m = step(m, e).m;
      }
      const bad = replay(path);
      if (bad) fails.push(bad);
    }
    expect(fails).toEqual([]);
  }, 60_000);
});
