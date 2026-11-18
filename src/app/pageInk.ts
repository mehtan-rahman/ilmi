// What is written on a PDF's page, drawn by the page itself (milestone 89).
//
// Ink on a book's page is an annotation of the page, and is drawn like one:
// an SVG in the pages' own column, lying where the page lies as a highlight
// does, a path a stroke. So whatever moves the page moves its ink, by
// construction: a scroll, the stretch under two fingers, a layout at another
// zoom. There is no second renderer to keep in step with the first, and no
// picture to make again when the zoom settles: a path is drawn anew at any
// size, as the page's letters are.
//
// A stroke's outline is made where the stroke is read (`native/stroke.m`:
// the discs and bands PencilKit's nib sweeps, as an SVG path filled by the
// nonzero rule; a highlighter's bar swept and laid on once; a fountain pen's
// and a pencil's as PencilKit's own picture of that stroke). It comes two
// ways, each by the stroke's name, which is the same on both:
//
// - from the store (`ink_shapes`, the strokes a page holds): on every device,
//   and whenever a page's strokes change there (a merge, another device);
// - from the canvases' side on an iPad, the moment something is done with the
//   Pencil (`{ kind: 'ink' }` through `window.__ink`): the names a sheet holds
//   now, in order, and the outline of each the page has not been told of. A
//   stroke handed over by PencilKit is in the page at once, long before it is
//   kept, but unseen (`hide`) while PencilKit's canvas still shows it: it is
//   on the glass once. When the writing pauses a telling without `hide` shows
//   it, and the canvas is emptied when the page says it has. The eraser takes
//   a path away; what the lasso carries is moved by a transform (`carry`) and
//   is strokes anew where it is put down.
//
// What a sheet shows is what the canvases' side last said (`live`) until
// that has been kept (`inkKept`) and the store has been read since; then
// what the store holds. (What was said is shown until the store's strokes
// and their outlines are in hand, and the two change places in one step:
// nothing is taken away to be put back.) When the page has drawn a telling it says so
// (`ink_shown`), and only then does PencilKit's own copy of the stroke leave
// the glass: there is never a frame with neither.

import { invoke } from '@tauri-apps/api/core';
import type { InkStroke } from '../vault/index.js';

/** A stroke as the page draws it (`ilmi_stroke_shape`). */
export interface Shape {
  /** Its name, as the store has it. */
  n: string;
  /** `p` a pen's outline, `m` a highlighter's, `i` a picture PencilKit made of it. */
  k: 'p' | 'm' | 'i';
  d?: string;
  /** Its colour, `#rrggbb`, and how much of it shows (none said is all). */
  c?: string;
  o?: number;
  /** A highlighter's: how wide its outline is stroked, round at the joins. */
  r?: number;
  /** A path it is cut to. */
  clip?: string;
  /** A picture's: where it lies (left, top, width, height, the page's points) and what it is. */
  box?: number[];
  src?: string;
}

/** What the canvases' side says of a sheet the page draws. */
export interface InkEvent {
  kind: 'ink';
  sheet: string;
  seq?: number;
  names?: string[];
  add?: Shape[];
  /** Those of `names` PencilKit's canvas still shows: the page holds them unseen until a telling without them. */
  hide?: string[];
  /** What the lasso holds, carried: those strokes shown moved by `m` (a matrix's six numbers), until the next telling. */
  carry?: { names: string[]; m: number[] } | null;
}

/** What a sheet holds as the canvases' side last said it. */
export interface Live {
  seq: number;
  names: string[];
  /** Those held unseen: PencilKit's canvas shows them. */
  hide: readonly string[];
  /** It has been kept: the store holds this, and is what is shown once it has been read again. */
  kept: boolean;
  /** When it was said or kept, by a count that only grows. */
  at: number;
}

const SHAPES_MOST = 40_000;
const shapes = new Map<string, Shape>();
const lives = new Map<string, Live>();
/** What the lasso carries on a sheet just now: those strokes are shown moved. */
export interface Carry { names: Set<string>; m: number[] }
const carries = new Map<string, Carry>();
const ears = new Map<string, Set<() => void>>();
const newEars = new Set<(sheet: string) => void>();
let clock = 0;

/** A count that only grows: what was read from the store after a telling was kept is newer than it. */
export const inkNow = (): number => ++clock;

export const shapeOf = (name: string): Shape | undefined => shapes.get(name);

function learn(list: readonly Shape[]): void {
  if (shapes.size + list.length > SHAPES_MOST) shapes.clear();
  for (const s of list) if (s && typeof s.n === 'string') shapes.set(s.n, s);
}

/** The outlines of `strokes`, asked of the native side for those not known yet. Resolves when all that can be known are. */
export async function learnShapes(strokes: readonly InkStroke[]): Promise<void> {
  const missing = strokes.filter((s) => !shapes.has(s.stroke));
  if (!missing.length) return;
  const json = await invoke<string>('ink_shapes', { strokes: missing.map((s) => s.data) });
  const got = JSON.parse(json) as Shape[];
  // (by the store's own names, in the order asked: the two agree, and the store's is the one a sheet is drawn by)
  learn(got.map((g, i) => ({ ...g, n: missing[i]?.stroke ?? g.n })));
}

/** What the canvases' side last said `sheet` holds; undefined when the store's word is the last. */
export const liveOf = (sheet: string): Live | undefined => lives.get(sheet);

function changed(sheet: string): void {
  for (const f of ears.get(sheet) ?? []) f();
}

/** `f` whenever what `sheet` shows may have changed. Returns the undoing. */
export function onLive(sheet: string, f: () => void): () => void {
  let set = ears.get(sheet);
  if (!set) { set = new Set(); ears.set(sheet, set); }
  set.add(f);
  return () => { set.delete(f); if (!set.size) ears.delete(sheet); };
}

/** `f` when a sheet is first said to hold something by the canvases' side: the page gives it a place to be drawn. Returns the undoing. */
export function onLiveSheet(f: (sheet: string) => void): () => void {
  newEars.add(f);
  return () => { newEars.delete(f); };
}

/** What a telling makes of what was known (pure: the state after `e`). */
export function heardLive(was: Live | undefined, e: InkEvent, at: number): Live | undefined {
  if (!e.names || typeof e.seq !== 'number') return was;
  // (a telling older than the last heard arrived late)
  if (was && !was.kept && e.seq < was.seq) return was;
  return { seq: e.seq, names: e.names, hide: e.hide ?? [], kept: false, at };
}

/** What the lasso carries on `sheet` just now. */
export const carryOf = (sheet: string): Carry | null => carries.get(sheet) ?? null;

/** The canvases' side said something of a sheet. */
export function inkHeard(e: InkEvent): void {
  if (e.add?.length) learn(e.add);
  const was = lives.get(e.sheet);
  const now = heardLive(was, e, inkNow());
  let moved = false;
  // what the lasso carries is shown moved until the next telling says where it was put down
  if (e.names) moved = carries.delete(e.sheet);
  else if (e.carry !== undefined) {
    moved = true;
    if (e.carry) carries.set(e.sheet, { names: new Set(e.carry.names), m: e.carry.m }); else carries.delete(e.sheet);
  }
  if (now === was && !moved) return;
  if (now) lives.set(e.sheet, now);
  if (!was && now) for (const f of newEars) f(e.sheet);
  changed(e.sheet);
}

/**
 * A sheet's strokes were kept. What the canvases' side said up to the telling `seq` is what was kept: it is shown
 * still, and gives way to the store once the store has been read again (`storeRead`); a later telling stays.
 */
export function inkKept(sheet: string, seq: number): void {
  const was = lives.get(sheet);
  if (!was || was.kept || was.seq > seq) return;
  lives.set(sheet, { ...was, kept: true, at: inkNow() });
}

/** The store was read for `sheet`, the reading begun at `began` (`inkNow`): what was kept before that is the store's to show. */
export function storeRead(sheet: string, began: number): void {
  const was = lives.get(sheet);
  if (was && was.kept && was.at < began) { lives.delete(sheet); changed(sheet); }
}

/** A sheet's canvas is gone or holds what the store does: nothing said of it stands. */
export function forgetLive(sheet: string): void {
  told.delete(sheet);
  carries.delete(sheet);
  if (lives.delete(sheet)) changed(sheet);
}

/** The names a sheet shows: what the canvases' side last said, else what the store holds. */
export function shownNames(live: Live | undefined, store: readonly string[] | null): readonly string[] {
  return live ? live.names : store ?? [];
}

const SVG = 'http://www.w3.org/2000/svg';
const made = new WeakMap<SVGSVGElement, { under: SVGGElement; over: SVGGElement; els: Map<string, SVGElement>; drawn: string }>();

function element(s: Shape): SVGElement {
  let el: SVGElement;
  if (s.k === 'i') {
    el = document.createElementNS(SVG, 'image');
    const [x, y, w, h] = s.box ?? [0, 0, 0, 0];
    el.setAttribute('x', String(x)); el.setAttribute('y', String(y)); el.setAttribute('width', String(w)); el.setAttribute('height', String(h));
    el.setAttribute('preserveAspectRatio', 'none');
    el.setAttribute('href', s.src ?? '');
  } else {
    el = document.createElementNS(SVG, 'path');
    el.setAttribute('d', s.d ?? '');
    el.setAttribute('fill', s.c ?? '#000000');
    if (s.k === 'm') {
      // a highlighter: what its nib swept and its thickness round that, one flat tint laid on at once
      el.setAttribute('stroke', s.c ?? '#000000');
      el.setAttribute('stroke-width', String(s.r ?? 0));
      el.setAttribute('stroke-linejoin', 'round');
      el.setAttribute('stroke-linecap', 'round');
      if (s.o !== undefined) el.setAttribute('opacity', String(s.o));
    } else if (s.o !== undefined) el.setAttribute('fill-opacity', String(s.o));
  }
  if (s.clip) {
    const g = document.createElementNS(SVG, 'g');
    const cp = document.createElementNS(SVG, 'clipPath');
    cp.id = `ink-clip-${s.n}`;
    const p = document.createElementNS(SVG, 'path');
    p.setAttribute('d', s.clip);
    cp.append(p);
    g.append(cp, el);
    el.setAttribute('clip-path', `url(#${cp.id})`);
    el = g;
  }
  el.dataset.n = s.n;
  el.dataset.k = s.k;
  return el;
}

/**
 * `svg` holds exactly the strokes `names`, in that order, a highlighter's under the rest; those `carry` names are
 * shown moved. Only what differs from what it holds is touched. Returns how many of `names` had no outline known
 * (they are not drawn yet).
 */
export function drawInk(svg: SVGSVGElement, names: readonly string[], carry: Carry | null = null, hide: readonly string[] = []): number {
  let m = made.get(svg);
  if (!m) {
    const under = document.createElementNS(SVG, 'g');
    const over = document.createElementNS(SVG, 'g');
    under.dataset.layer = 'under';
    over.dataset.layer = 'over';
    svg.replaceChildren(under, over);
    m = { under, over, els: new Map(), drawn: '' };
    made.set(svg, m);
  }
  let missing = 0;
  const key = names.join(' ');
  if (key !== m.drawn || names.some((n) => !m.els.has(n))) {
    const want = new Set(names);
    for (const [n, el] of m.els) if (!want.has(n)) { el.remove(); m.els.delete(n); }
    const at = { under: m.under.firstChild as ChildNode | null, over: m.over.firstChild as ChildNode | null };
    for (const n of names) {
      const s = shapes.get(n);
      if (!s) { missing += 1; continue; }
      let el = m.els.get(n);
      if (!el) { el = element(s); m.els.set(n, el); }
      const layer = s.k === 'm' ? 'under' : 'over';
      const parent = m[layer];
      if (at[layer] === el) at[layer] = el.nextSibling;
      else parent.insertBefore(el, at[layer]);
    }
    m.drawn = missing ? '' : key;
  }
  const unseen = hide.length ? new Set(hide) : null;
  for (const [n, el] of m.els) {
    if (unseen?.has(n)) { if (el.getAttribute('visibility') !== 'hidden') el.setAttribute('visibility', 'hidden'); } else if (el.hasAttribute('visibility')) el.removeAttribute('visibility');
    const t = carry?.names.has(n) ? `matrix(${carry.m.join(' ')})` : null;
    if (t) { if (el.getAttribute('transform') !== t) el.setAttribute('transform', t); } else if (el.hasAttribute('transform')) el.removeAttribute('transform');
  }
  svg.dataset.strokes = String(m.els.size);
  return missing;
}

const asked = new Set<string>();
/**
 * Strokes a sheet was said to hold whose outlines the page has not: asked of the canvases' side, once a name. (It
 * says the outline of each stroke once; a page loaded anew, or one that let its outlines go, has to ask.)
 */
export function askOutlines(sheet: string, names: readonly string[]): void {
  const want = names.filter((n) => !shapes.has(n) && !asked.has(`${sheet} ${n}`));
  if (!want.length) return;
  for (const n of want) asked.add(`${sheet} ${n}`);
  void invoke<{ shapes: Shape[] }>('ink_outlines', { sheet, names: want }).then((got) => {
    if (!got?.shapes?.length) return;
    learn(got.shapes);
    changed(sheet);
  }, () => {});
}

const told = new Map<string, number>();
/** How long the canvases' side waits to hear a telling is on the glass where no frame comes (a page not shown), ms: PencilKit's copy stays on it meanwhile. */
export const SHOWN_LATEST = 1500;

/**
 * The page has drawn a sheet's telling `seq`: the canvases' side is told once it is on the glass, which is two
 * frames on (the first frame after this draws it, and by the second that one has gone to the screen). Not by
 * a clock: a frame held back is a path not yet on the glass, and PencilKit's copy must not go before it.
 */
export function shownSoon(sheet: string, seq: number): void {
  if (told.get(sheet) === seq) return;
  told.set(sheet, seq);
  let done = false;
  const say = (): void => {
    if (done) return;
    done = true;
    void invoke('ink_shown', { sheet, seq }).catch(() => {});
  };
  if (typeof requestAnimationFrame === 'function') requestAnimationFrame(() => requestAnimationFrame(say));
  setTimeout(say, typeof requestAnimationFrame === 'function' ? SHOWN_LATEST : 0);
}

/** For the tests: nothing known. */
export function resetInk(): void {
  shapes.clear();
  lives.clear();
  asked.clear();
  carries.clear();
  told.clear();
  clock = 0;
}

/** For the tests and the checks: outlines given as if the native side had made them. */
export const learnInk = (list: readonly Shape[]): void => learn(list);
