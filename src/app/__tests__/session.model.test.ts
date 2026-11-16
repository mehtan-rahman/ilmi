// @vitest-environment jsdom
// The session's card as a statechart (`Session.tsx`: `Session` over
// `CardElement`, which turns into `CardFaces` on `e`), checked exhaustively
// against the drawn session over a collection whose writes answer late, as
// a slow disk's do. Two cards of a deck, three items: `q0 :: a0` (no id,
// never graded), and `w1 ::: v1` (an id, its bare line and its reverse
// reviewed) asked both ways. Per item shown:
//
//   question --space|1|a grade's button|a press on the hint--> answer
//   question|answer --e--> editing (the boxes; an edit kept from before comes back, asking)
//   answer   --space|1|a grade's button--> graded: the next item (after the last, the end)
//   graded   (an item graded in this session, come back to): its answer, the grade given marked
//   graded   --space|1|a grade's button--> given again: the line as the grade before left it
//            goes back to before it and is graded from there, its log line in that one's place
//   editing  --space|1--> editing (the keys are the boxes')
//   editing  --⌘⏎ [clean|written]--> answer          --⌘⏎ [drops a reviewed schedule]--> asking
//   asking   --⌘⏎|save anyway--> answer (written)     --esc--> editing
//   editing  --esc--> answer (put back)
//   editing  --a grade's button--> the press outside saves (or asks), then the grade: graded
//   any      --‹|›--> the item before or after, its question or, graded, its answer (the boxes let go: written, or kept)
//   gone     (the card, or the line the item asks, is no longer in the file): no grades, a skip
//   gone     --space|skip|›--> the next item, or from the last the end   --1--> gone (nothing)
//   any      --away (its tab left for another and come back to: the lens drawn anew)--> the same item, as ‹ › come to it:
//            its question or, graded, its answer and grade (where it is and what was given are the session's, in the store);
//            played on the roads named below, not in the walk
//
// The walk grows. A grade that leaves its line in its steps (a new card
// again or good, one in learning again, or good before its last step, a
// reviewed one again: due at an instant, minutes on) appends an element
// that asks the line again, after what is left:
//
//   answer   --a grade [the line stays in its steps]--> graded, and its return appended: the total one more
//   return   an element as any other: its question, graded from the line as it is then, a review and a log line of its own;
//            a grade there may bring another
//   graded   --a grade given again [out of its steps]--> its return, not yet graded, is not asked: out of the walk and the count
//   graded   --a grade given again [into its steps]--> its return appended, or put back
//   graded   [its return graded since: asked again] the grade stands: no grades, space is on to the next
//   return   [its line no longer in the file] gone, as any item
//
// Whether a card comes back is told at the grade, before anything is
// written, from the schedule the view has and the grades still in flight;
// the model tells it the same way and checks it against what the file then
// holds. `again` is given to a line at most `AGAINS` times here (the app has
// no such bound), so the walk with returns is finite: `every road on
// reaches the end` explores all of it, without the boxes.
//
// and the writes: `settle` lets every write sent land. Between, the user
// may go on (grade the next card, go back) with writes in flight; `e` only
// once they have landed (the boxes open on the file as it is). After each
// event the view (which item, question, answer, the boxes: form, what is
// typed, dirty, asking; or gone, or the end) is compared with the model,
// and once the writes land, the file: each card's text, its id, the reviews
// on each of its lines, each line's schedule, the review log's lines. Invariants,
// by the comparison: every grade given is written, once, to the line the
// item asks, and only to a card whose answer was up; a card is counted and
// logged once in a session however often it is graded again, the line's
// schedule the one grading it once with the last grade, from the schedule it
// had before the session (none, for a line made since); no grade reaches an
// item that is gone; an edit is written, held, or kept, unless put back
// with esc; a reviewed schedule goes only when asked and answered; no
// reverse line on a card that is not both ways. An asking counts once
// however often its grade is given again; each return is one review more.
// And the loop is closed: at the end no line is in its steps unless an
// element that asks it was stepped past with ›.

import { act, createElement } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';
import { parse, type Card, type CardSchedule, type Doc, type Review } from '../../format/index.js';
import { docItems, grade as fsrsGrade, type CardItem } from '../../schedule/index.js';
import { Vault, storeFs } from '../../vault/index.js';
import { memStore } from '../../vault/mem-store.js';
import { faceViews } from '../FaceField.js';
import { useApp } from '../store.js';
import { gated, leaves, transitions, type Machine } from './explore.js';

for (const proto of [Node.prototype, Range.prototype] as unknown as { getClientRects?: () => DOMRect[]; getBoundingClientRect?: () => DOMRect }[]) {
  proto.getClientRects ??= () => [];
  proto.getBoundingClientRect ??= () => new DOMRect();
}

const DECK = 'deck.md';
const FILE = '---\ntype: deck\n---\n\nq0 :: a0\n\nw1 ::: v1 ^k1\n'
  + '<!-- sr due=2026-05-27 st=review s=3 d=5 r=4 l=1 ivl=3 last=2026-05-24T07:30:00Z g=2 -->\n'
  + '<!-- sr r due=2026-05-29 st=review s=2.4 d=6.1 r=2 l=0 ivl=3 last=2026-05-26T07:30:00Z g=3 -->\n';

let vault: Vault;

vi.mock('../vault.js', async (orig) => {
  const real = await orig<typeof import('../vault.js')>();
  return { ...real, currentVault: () => vault, note: () => {}, openNode: () => {} };
});
vi.mock('../Pdf.js', () => ({ Pdf: () => null, pointInView: () => null }));
const { Session } = await import('../Session.js');
const faces = await import('../CardFaces.js');
(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

// ── the model ────────────────────────────────────────────────────

type Form = 'qa' | 'bidir';
interface Faces { form: Form; n: number }
/** What a line was graded from before the session: the file's schedule, or none (a new card, a reverse dropped since and made again). */
type Pre = 'file' | 'none';
/** The grades the events give: space good, 1 again, the easy button. */
type G = 1 | 3 | 4;
type Three<T> = [T, T, T];
/** The lines: `q0`'s, `w1`'s bare line, `w1`'s reverse. */
type Line = 0 | 1 | 2;
interface Disk {
  cards: [Faces, Faces];
  pre: Three<Pre>;
  /** The reviews each line's schedule holds from this session, in order: the element graded, and its grade in effect. */
  chain: Three<{ p: number; g: G }[]>;
}
type Show = 'Q' | 'A' | 'E';
/** Where a schedule stands, as far as says whether its card comes back: new, learning's first step and its second, reviewed, relearning. */
type Stage = 'N' | 'L0' | 'L1' | 'R' | 'X';
/** FSRS's steps (1m 10m; relearning 10m), checked against the scheduler below (`the model's steps are the scheduler's`). */
const AFTER: Record<Stage, Record<G, Stage>> = {
  N: { 1: 'L0', 3: 'L1', 4: 'R' },
  L0: { 1: 'L0', 3: 'L1', 4: 'R' },
  L1: { 1: 'L0', 3: 'R', 4: 'R' },
  R: { 1: 'X', 3: 'R', 4: 'R' },
  X: { 1: 'X', 3: 'R', 4: 'R' },
};
const inSteps = (st: Stage) => st === 'L0' || st === 'L1' || st === 'X';
/** `again` is given to a line at most this often: the bound that makes the walk finite. */
const AGAINS = 2;

interface S {
  /** The element on show; `walk.length` is the end. */
  idx: number;
  show: Show;
  ed: (Faces & { asking: boolean }) | null;
  /** The file once every write sent has landed. */
  disk: Disk;
  /** The file as the view last heard of it. */
  seen: Disk;
  kept: [Faces | null, Faces | null];
  pending: boolean;
  /** The line each element asks: the three items, then the returns as grades append them. */
  walk: Line[];
  /** The grade each element was given in this session, as ‹ back to it shows it. */
  given: (G | null)[];
  /** The grade in effect in the log for each element. */
  landed: (G | null)[];
  /** Whether the grade last given to each element reached the file (not one given to a line no longer there). */
  hit: boolean[];
  /** A grade sent and not yet landed: the view has not heard of it. */
  flying: boolean[];
  /** The element each element's grade brought back, and whether it is out of the walk after all. */
  ret: (number | null)[];
  out: boolean[];
  /** What each grade was told at the grade: the stage it was given from, and the one it leaves. */
  from: (Stage | null)[];
  told: (Stage | null)[];
  /**
   * How often each element was given again, to two: a grade given again reaches
   * the state its first grade did, and the walk, knowing it, would not go on
   * from it (to the writes landing, to a third grade).
   */
  again: number[];
  /** How often each line was given `again`, to `AGAINS`. */
  agains: Three<number>;
}

const EVENTS = ['space', 'again', 'e', 'type', 'form', 'save', 'esc', 'anyway', 'easy', 'next', 'prev', 'settle'] as const;
/** `away`: the session's tab left and come back to. On named roads only: in the walk it would double it. */
type E = (typeof EVENTS)[number] | 'away';

/** Each line's reviews before the session: the file's, or none. */
const PRE_REPS: Record<Pre, number[]> = { file: [0, 4, 2], none: [0, 0, 0] };

const cardOf = (line: number): 0 | 1 => (line === 0 ? 0 : 1);
const same = (a: Faces, b: Faces) => a.form === b.form && a.n === b.n;
const faces0 = (f: Faces): Faces => ({ form: f.form, n: f.n });
const atEnd = (s: S) => s.idx >= s.walk.length;
const lineAt = (s: S): Line => s.walk[s.idx]!;
/** The reviews on a line; null, a reverse with no line. */
const repsOf = (d: Disk, l: Line): number | null => (l === 2 && d.pre[2] === 'none' && !d.chain[2].length ? null : PRE_REPS[d.pre[l]][l]! + d.chain[l].length);
const stageOf = (pre: Pre, grades: readonly { g: G }[]): Stage => grades.reduce<Stage>((st, x) => AFTER[st][x.g], pre === 'file' ? 'R' : 'N');
/** The item's card, or the line it asks, is no longer in the file the view has. */
const gone = (s: S) => !atEnd(s) && lineAt(s) === 2 && s.seen.cards[1].form !== 'bidir';
/** Graded, and asked again since (its return graded): the grade stands. */
const locked = (s: S) => { const r = atEnd(s) ? null : s.ret[s.idx]!; return r !== null && s.given[r] !== null; };
const dirty = (s: S) => !!s.ed && !same(s.ed, s.disk.cards[cardOf(lineAt(s))]);
const drops = (d: Disk, c: 0 | 1, f: Faces) => c === 1 && f.form !== 'bidir' && (repsOf(d, 2) ?? 0) > 0;
/** The first element at or after `i` that is asked (none: the end), and the last at or before it (none: -1). */
const onFrom = (s: S, i: number) => { while (i < s.walk.length && s.out[i]) i++; return Math.min(i, s.walk.length); };
const backFrom = (s: S, i: number) => { while (i >= 0 && s.out[i]) i--; return i; };

function write(s: S, c: 0 | 1, f: Faces, sure: boolean): void {
  if (drops(s.disk, c, f) && !sure) throw new Error('the model drops a reviewed schedule unasked');
  s.disk.cards[c] = faces0(f);
  // a card no longer both ways has no reverse; one made again is new
  if (c === 1 && f.form !== 'bidir') { s.disk.pre[2] = 'none'; s.disk.chain[2] = []; }
  s.pending = true;
}

function flush(s: S, sure: boolean): boolean {
  const ed = s.ed!;
  if (!dirty(s)) return true;
  if (drops(s.disk, cardOf(lineAt(s)), ed) && !sure) { ed.asking = true; return false; }
  write(s, cardOf(lineAt(s)), ed, sure);
  ed.asking = false;
  return true;
}

/**
 * A grade sent. Told at once whether its line stays in its steps, and its
 * return appended, put back, or taken out; then written to the line the
 * item asks, once the writes before it have landed; a reverse of a card no
 * longer both ways is not there.
 */
function grade(s: S, g: G): void {
  if (gone(s)) throw new Error('a grade reached an item that is gone');
  if (locked(s)) throw new Error('a grade reached an asking asked again since');
  const p = s.idx;
  const l = lineAt(s);
  const was = s.given[p] !== null;
  if (was) s.again[p] = Math.min(2, s.again[p]! + 1);
  if (g === 1) s.agains[l]++;
  // the schedule the view has: a grade given again is given from before the one it replaces, while the line holds it
  const live = (): Stage => {
    const c = s.seen.chain[l];
    return stageOf(s.seen.pre[l], was && !s.flying[p] && s.hit[p] && c[c.length - 1]?.p === p ? c.slice(0, -1) : c);
  };
  // a grade still in flight (the one this replaces, the asking that brought the card back) is counted from what it was told
  const o = s.ret.indexOf(p);
  const base = was ? (s.flying[p] ? s.from[p]! : live()) : o >= 0 && s.flying[o] ? s.told[o]! : live();
  const told = AFTER[base][g];
  s.from[p] = base;
  s.told[p] = told;
  const r = s.ret[p]!;
  if (r === null) {
    if (inSteps(told)) {
      s.ret[p] = s.walk.length;
      s.walk.push(l);
      for (const list of [s.given, s.landed, s.ret, s.from, s.told]) (list as unknown[]).push(null);
      for (const list of [s.hit, s.flying, s.out]) list.push(false);
      s.again.push(0);
    }
  } else if (s.given[r] === null) s.out[r] = !inSteps(told);
  s.given[p] = g;
  s.flying[p] = true;
  s.pending = true;
  if (l === 2 && s.disk.cards[1].form !== 'bidir') { s.hit[p] = false; return; }
  // given again while the line holds what the grade before wrote: that grade's place, not one more review
  const c = s.disk.chain[l];
  if (s.landed[p] !== null && c[c.length - 1]?.p === p) c[c.length - 1] = { p, g };
  else c.push({ p, g });
  s.landed[p] = g;
  s.hit[p] = true;
  if (inSteps(stageOf(s.disk.pre[l], c)) !== inSteps(told)) throw new Error(`element ${p}: told ${told} at the grade, written ${stageOf(s.disk.pre[l], c)}`);
}

/** The boxes let go: written when they can be, else kept for the card's return. */
function leave(s: S): void {
  if (s.show === 'E' && dirty(s)) {
    const c = cardOf(lineAt(s));
    if (drops(s.disk, c, s.ed!)) s.kept[c] = faces0(s.ed!);
    else write(s, c, s.ed!, false);
  }
  s.ed = null;
}

function goTo(s: S, idx: number): void {
  leave(s);
  s.idx = idx;
  s.show = idx < s.walk.length && s.given[idx] !== null ? 'A' : 'Q';
}

/** A press outside the boxes (a grade's button, ‹ ›): what is unsaved is saved, or the question asked. */
function pressOutside(s: S): void {
  if (s.show !== 'E' || s.ed!.asking || !dirty(s)) return;
  if (flush(s, false)) { s.show = 'A'; s.ed = null; }
}

const model: Machine<S, E> = {
  init: (() => {
    const d: Disk = { cards: [{ form: 'qa', n: 0 }, { form: 'bidir', n: 0 }], pre: ['none', 'file', 'file'], chain: [[], [], []] };
    return {
      idx: 0, show: 'Q', ed: null, disk: d, seen: structuredClone(d), kept: [null, null], pending: false,
      walk: [0, 1, 2], given: [null, null, null], landed: [null, null, null], hit: [false, false, false], flying: [false, false, false],
      ret: [null, null, null], out: [false, false, false], from: [null, null, null], told: [null, null, null], again: [0, 0, 0], agains: [0, 0, 0],
    };
  })(),
  events: EVENTS,
  key: (s) => JSON.stringify(s),
  step(s0, e) {
    const s = structuredClone(s0);
    if (e === 'settle') { if (!s.pending) return null; s.pending = false; s.seen = structuredClone(s.disk); s.flying = s.flying.map(() => false); return s; }
    // the lens drawn anew: the end stays the end, an item is come to as ‹ › come to it
    if (e === 'away') { if (!atEnd(s)) goTo(s, s.idx); return s; }
    if (atEnd(s)) return null;
    const ed = s.ed;
    switch (e) {
      case 'space': case 'again':
        // an item that is gone: space skips it, a grade's key does nothing
        if (gone(s)) { if (e === 'space') goTo(s, onFrom(s, s.idx + 1)); return s; }
        if (s.show === 'Q') s.show = 'A';
        else if (s.show === 'A') {
          // asked again since: the grade stands, space is on to the next
          if (locked(s)) { if (e === 'space') goTo(s, onFrom(s, s.idx + 1)); return s; }
          if (e === 'again' && s.agains[lineAt(s)] >= AGAINS) return null;
          grade(s, e === 'space' ? 3 : 1);
          goTo(s, onFrom(s, s.idx + 1));
        }
        return s;
      case 'easy':
        // no grades on a card that is gone, or asked again since
        if (gone(s) || locked(s)) return null;
        pressOutside(s);
        if (s.show === 'Q') s.show = 'A';
        else { grade(s, 4); goTo(s, onFrom(s, s.idx + 1)); }
        return s;
      case 'e': {
        // the boxes open on the file as it is
        if (s.pending) return null;
        if (s.show === 'E' || gone(s)) return s;
        const c = cardOf(lineAt(s));
        const k = s.kept[c];
        s.kept[c] = null;
        const f = k ?? s.disk.cards[c];
        s.show = 'E';
        s.ed = { ...faces0(f), asking: !!k && !same(f, s.disk.cards[c]) && drops(s.disk, c, f) };
        return s;
      }
      case 'type': if (!ed) return null; ed.n = 1 - ed.n; ed.asking = false; return s;
      case 'form': if (!ed) return null; ed.form = ed.form === 'qa' ? 'bidir' : 'qa'; ed.asking = false; return s;
      case 'save': if (!ed) return null; if (flush(s, ed.asking)) { s.show = 'A'; s.ed = null; } return s;
      case 'esc':
        if (!ed) return null;
        if (ed.asking) ed.asking = false;
        else { s.show = 'A'; s.ed = null; }
        return s;
      case 'anyway': if (!ed?.asking) return null; flush(s, true); s.show = 'A'; s.ed = null; return s;
      // › on the last element asked only when it is gone: nothing else moves on from it
      case 'next': { const to = onFrom(s, s.idx + 1); if (to >= s.walk.length && !gone(s)) return null; pressOutside(s); goTo(s, to); return s; }
      case 'prev': { const to = backFrom(s, s.idx - 1); if (to < 0) return null; pressOutside(s); goTo(s, to); return s; }
    }
    return null;
  },
  invariant(s) {
    if (s.ed?.asking && !(dirty(s) && drops(s.disk, cardOf(lineAt(s)), s.ed))) return 'asking with nothing to ask about';
    if ((s.show === 'E') !== !!s.ed) return 'boxes without editing';
    if (s.disk.cards[1].form !== 'bidir' && repsOf(s.disk, 2) !== null) return 'a reverse line on a card not both ways';
    if (!atEnd(s) && s.out[s.idx]) return 'on an element that is not asked';
    for (let p = 0; p < s.walk.length; p++) if (s.out[p] && s.given[p] !== null) return `element ${p} graded and out of the walk`;
    // counted once: a line holds one review for each element of it graded, each after the one before
    for (const l of [0, 1, 2] as const) {
      const c = s.disk.chain[l];
      for (let i = 0; i < c.length; i++) {
        if (s.walk[c[i]!.p] !== l || s.landed[c[i]!.p] !== c[i]!.g) return `line ${l} holds a grade that is not its element's`;
        if (i && c[i - 1]!.p >= c[i]!.p) return `line ${l} counts an element twice`;
      }
    }
    // the loop closed: the end leaves no line in its steps, unless an element that asks it was stepped past
    if (atEnd(s)) {
      for (const l of [0, 1, 2] as const) {
        if (repsOf(s.disk, l) === null || !inSteps(stageOf(s.disk.pre[l], s.disk.chain[l]))) continue;
        if (!s.walk.some((x, p) => x === l && !s.out[p] && s.given[p] === null)) return `the end, with line ${l} in its steps and never asked again`;
      }
    }
    return null;
  },
};

// ── the session, driven ──────────────────────────────────────────

const textOf = (f: Faces, c: 0 | 1) => `${c ? 'w1' : 'q0'} ${f.form === 'qa' ? '::' : ':::'} ${c ? 'v1' : 'a0'}${'+'.repeat(f.n)}`;

interface Seen {
  idx: number;
  view: string;
  /** The counter's total: the elements asked. */
  of?: number;
  /** An item graded in this session: the quiet line, and the grade button lit. */
  given?: string | null;
  lit?: number | null;
  form?: string | null;
  back?: string;
  dirty?: string | null;
  asking?: boolean;
  file?: unknown;
  /** Each line's schedule, and the grades the log holds for each item. */
  lines?: (CardSchedule | null)[];
  log?: number[][];
}

/** A line's schedule as the scheduler writes it. */
const schedOf = (c: CardSchedule | undefined): CardSchedule | null => {
  if (!c) return null;
  const { pri: _p, suspended: _s, link: _l, extra: _x, ...rest } = c;
  return rest;
};
const linesOf = (doc: Doc): (CardSchedule | null)[] => {
  const [a, b] = doc.blocks.filter((x): x is Card => x.kind === 'card');
  return [schedOf(a?.sched), schedOf(b?.sched), schedOf(b?.reverse)];
};
/** The file's lines before the session. */
const PRE_LINES = linesOf(parse(FILE).doc);
const GRADE_WORD: Record<G, string> = { 1: 'again', 3: 'good', 4: 'easy' };

/** The log's lines, by the item they grade: `k1`'s bare line, its reverse, else `q0` (its id minted when first graded). */
const logOf = (log: readonly Review[]): number[][] => {
  const out: number[][] = [[], [], []];
  for (const r of log) out[r.card !== 'k1' ? 0 : r.key === 'r' ? 2 : 1]!.push(r.g);
  return out;
};

function fileOf(doc: Doc): unknown {
  const [a, b] = doc.blocks.filter((x): x is Card => x.kind === 'card');
  return [
    { text: a?.text, id: a?.id !== undefined, reps: a?.sched?.reps ?? 0, reverse: a?.reverse?.reps ?? null },
    { text: b?.text, id: b?.id, reps: b?.sched?.reps ?? 0, reverse: b?.reverse?.reps ?? null },
  ];
}

function expected(s: S): Seen {
  const out: Seen = { idx: -1, view: atEnd(s) ? 'end' : gone(s) ? 'gone' : s.show };
  // the counter: the elements asked before this one, and all of them; those out of the walk are not counted
  if (!atEnd(s)) Object.assign(out, { idx: s.out.slice(0, s.idx).filter((x) => !x).length, of: s.out.filter((x) => !x).length });
  if (!atEnd(s) && !gone(s)) {
    const g = s.given[s.idx] ?? null;
    // asked again since: its grade is said, and no grade is offered
    Object.assign(out, { given: g === null ? null : `graded ${GRADE_WORD[g]}`, lit: locked(s) ? null : g });
  }
  if (s.ed && !gone(s)) {
    const c = cardOf(lineAt(s));
    Object.assign(out, { form: s.ed.form, back: `${c ? 'v1' : 'a0'}${'+'.repeat(s.ed.n)}`, dirty: dirty(s) ? '1' : '0', asking: s.ed.asking });
  }
  if (!s.pending) {
    const reps = ([0, 1, 2] as const).map((l) => repsOf(s.disk, l));
    out.file = [
      { text: textOf(s.disk.cards[0], 0), id: reps[0]! > 0, reps: reps[0], reverse: null },
      { text: textOf(s.disk.cards[1], 1), id: 'k1', reps: reps[1], reverse: reps[2] },
    ];
    // a line graded in the session: graded once for each element of it, with the grade in effect, from what it had
    // before (at the instant the file says it last was: the session is one day's, and the scheduler counts in days)
    const now = linesOf(parse(fileText).doc);
    out.lines = ([0, 1, 2] as const).map((l) => {
      const pre = s.disk.pre[l] === 'file' ? PRE_LINES[l] ?? undefined : undefined;
      if (reps[l] === null || (l === 0 && reps[0] === 0)) return null;
      if (!s.disk.chain[l].length) return pre ?? null;
      const at = now[l]?.last;
      return at ? schedOf(s.disk.chain[l].reduce<CardSchedule | undefined>((line, x) => fsrsGrade(line, x.g, new Date(at)), pre) ?? undefined) : null;
    });
    // the log: a line for each element graded, its grade in effect, a line's in the order they were asked
    out.log = ([0, 1, 2] as const).map((l) => s.walk.flatMap((x, p) => (x === l && s.landed[p] !== null ? [s.landed[p]!] : [])));
  }
  return out;
}

let host: HTMLDivElement;
let root: Root | null = null;
let gate: ReturnType<typeof gated<ReturnType<typeof storeFs>>>;

/** Every write sent let land, and what follows them. */
const settle = () => act(async () => {
  gate.hold(false);
  for (let i = 0; i < 3; i++) { gate.release(); await new Promise((r) => setTimeout(r, 0)); }
  gate.hold(true);
});

async function start(): Promise<void> {
  faces.keptEdits.clear();
  const fs = storeFs(memStore(), '/v');
  await fs.mkdir('/v');
  await fs.writeText(`/v/${DECK}`, FILE);
  gate = gated(fs);
  vault = await Vault.open(gate.fs, '/v');
  const doc = (await vault.read(DECK)).doc;
  const items = docItems(DECK, doc, new Date()).filter((i): i is CardItem => i.kind === 'card');
  const order = [items.find((i) => i.id === undefined), items.find((i) => i.id === 'k1' && i.dir !== 'r'), items.find((i) => i.id === 'k1' && i.dir === 'r')];
  if (order.some((i) => !i)) throw new Error(`the deck's items: ${JSON.stringify(items)}`);
  useApp.setState({ learnNew: false, docs: { [DECK]: { type: 'deck', frozen: false, cards: 2, due: 3 } }, files: [DECK], vault: '/v', phone: false, reveal: null, session: { seq: 1, items: order as CardItem[] } });
  root = createRoot(host);
  await act(async () => { root!.render(createElement(Session, { active: true, onOpen: () => {} })); });
  await settle();
}

async function stop(): Promise<void> {
  // what is in flight lands in this road's collection, not the next one's
  await settle();
  await act(async () => { root?.unmount(); root = null; });
  await settle();
  gate.hold(false);
  vault.close();
}

const boxes = () => Array.from(host.querySelectorAll<HTMLElement>('.card-edit .card .face'));
const key = (k: string, el: EventTarget = window, init: KeyboardEventInit = {}) => act(async () => { el.dispatchEvent(new KeyboardEvent('keydown', { key: k, bubbles: true, cancelable: true, ...init })); });
/** A press on `el` as a pointer makes it: its mousedown, then (a task on) its click. */
const press = async (el: HTMLElement) => {
  await act(async () => { el.dispatchEvent(new MouseEvent('mousedown', { bubbles: true, cancelable: true })); });
  await act(async () => { el.click(); });
};

async function fire(e: E): Promise<void> {
  switch (e) {
    case 'space': await key(' '); break;
    case 'again': await key('1'); break;
    case 'e': await key('e'); break;
    case 'type': {
      const v = faceViews.get(boxes()[1]!.querySelector('.face-host')!)!;
      const end = v.state.doc.content.size - 1;
      const typed = v.state.doc.textContent.endsWith('+');
      await act(async () => { v.dispatch(typed ? v.state.tr.delete(end - 1, end) : v.state.tr.insertText('+', end)); });
      break;
    }
    case 'form': {
      const off = host.querySelector<HTMLButtonElement>('.cm-forms button[data-active="0"][data-form="qa"], .cm-forms button[data-active="0"][data-form="bidir"]')!;
      await act(async () => { off.click(); });
      break;
    }
    case 'save': await key('Enter', boxes()[0]!.querySelector('.ProseMirror')!, { metaKey: true }); break;
    case 'esc': await key('Escape', boxes()[0]!.querySelector('.ProseMirror')!); break;
    case 'anyway': await act(async () => { Array.from(host.querySelectorAll<HTMLButtonElement>('.cm-act')).find((b) => b.textContent?.includes('save anyway'))!.click(); }); break;
    case 'easy': await press(host.querySelectorAll<HTMLButtonElement>('.grades button')[3]!); break;
    case 'next': {
      const next = host.querySelectorAll<HTMLButtonElement>('.sess-nav .sn-btn')[1]!;
      if (next.disabled) throw new Error('› is disabled');
      await press(next);
      break;
    }
    case 'prev': await press(host.querySelectorAll<HTMLButtonElement>('.sess-nav .sn-btn')[0]!); break;
    case 'settle': await settle(); break;
    case 'away':
      await act(async () => { root!.unmount(); });
      root = createRoot(host);
      await act(async () => { root!.render(createElement(Session, { active: true, onOpen: () => {} })); });
      break;
  }
}

function seen(s: S): Seen {
  const count = host.querySelector('.sess-count')?.textContent;
  const out: Seen = { idx: count ? Number(count.split(' / ')[0]) - 1 : -1, view: '' };
  if (count) out.of = Number(count.split(' / ')[1]);
  const edit = host.querySelector<HTMLElement>('.card-edit');
  const card = host.querySelector<HTMLElement>('.recall-wrap .card');
  if (host.querySelector('.session-end')) out.view = 'end';
  else if (host.querySelector('.recall-wrap > .empty')?.textContent === 'no longer in the collection') out.view = 'gone';
  else if (edit) out.view = 'E';
  else if (card) out.view = card.dataset.revealed === '1' ? 'A' : 'Q';
  if (out.view !== 'end' && out.view !== 'gone') {
    const lit = Array.from(host.querySelectorAll<HTMLElement>('.grades button')).findIndex((b) => b.dataset.given === '1');
    Object.assign(out, { given: host.querySelector('.cm-given')?.textContent ?? null, lit: lit < 0 ? null : ([1, 2, 3, 4] as const)[lit]! });
  }
  if (edit) {
    Object.assign(out, {
      form: edit.querySelector('.cm-forms [data-active="1"]')?.getAttribute('data-form') ?? null,
      back: boxes()[1]?.textContent ?? '',
      dirty: edit.getAttribute('data-dirty'),
      asking: !!edit.querySelector('.cm-ask'),
    });
  }
  // the file, once the model says every write has landed
  if (!s.pending) {
    out.file = fileOf(parse(fileText).doc);
    out.lines = linesOf(parse(fileText).doc);
    out.log = logOf(logLines);
  }
  return out;
}

let fileText = '';
let logLines: Review[] = [];
async function readFile(): Promise<void> {
  gate.hold(false);
  fileText = (await vault.read(DECK)).text;
  logLines = await vault.loadReviews();
  gate.hold(true);
}

/** Play `road` on the session from the start, comparing it with the model after every event; how many events. */
async function play(road: readonly E[]): Promise<number> {
  await start();
  let s = model.init;
  try {
    await readFile();
    expect(seen(s), 'the start').toEqual(expected(s));
    for (let i = 0; i < road.length; i++) {
      const e = road[i]!;
      if (model.step(s, e) === null) throw new Error(`${road.slice(0, i + 1).join(' ')}: not enabled`);
      await fire(e);
      s = model.step(s, e)!;
      if (!s.pending) await readFile();
      expect(seen(s), road.slice(0, i + 1).join(' ')).toEqual(expected(s));
    }
  } finally {
    await stop();
  }
  return road.length;
}

// Depth 7. The grades' counts make the state space unbounded, so the walk
// is cut by length. Every road that broke is seven events or fewer but one
// (the reverse graded back onto a card made q&a, eight, played on its own
// below); seven plays every mix of the others: 2834 states, 4916 roads,
// about a minute and a half (with the returns: a grade that leaves a line in
// its steps appends one, six events in at the soonest). Each event more
// about doubles it. An item is gone seven
// events in at the soonest (the reverse dropped is asked about, then
// written), so what follows it is walked from there, three events more.
const DEPTH = Number(process.env.MODEL_DEPTH ?? 7);
const TO_GONE: E[] = ['next', 'e', 'form', 'next', 'e', 'save', 'settle'];

describe('the session, every road of up to seven events', () => {
  beforeAll(() => { host = document.body.appendChild(document.createElement('div')); });
  afterAll(() => { host.remove(); });

  // what the walk found, each the shortest road to it
  it.each([
    // two grades in one deck a keypress apart, the first not yet written: the second wrote over it
    ['two grades in flight in one file both land', ['space', 'space', 'space', 'space', 'settle']],
    // a card with no id edited, then graded in one press (the save, then the grade): the grade looked for the old text
    ['an edit and a grade in one press both land', ['e', 'type', 'easy', 'settle']],
    // the reverse of a card saved as q&a, graded while the save was in flight: an `sr r` line came back on a q&a card
    ['no reverse graded onto a card no longer both ways', ['next', 'e', 'form', 'next', 'e', 'save', 'space', 'settle']],
    // the q&a switch's question pending and the session moved on: the edit was gone when the card came back
    ['an edit that asks, let go, comes back asking', ['next', 'e', 'form', 'next', 'space', 'e']],
    // ‹ to a card graded: its question again, and a second grade on top of the first, counted and logged twice
    ['a card graded again counts once, graded from before', ['space', 'space', 'prev', 'again', 'settle']],
    ['a card graded again once its grade has landed', ['next', 'space', 'space', 'settle', 'prev', 'easy', 'settle']],
    ['a card graded three times counts once, with the last', ['space', 'space', 'prev', 'again', 'prev', 'space', 'settle']],
    // a gone item: space and 1 reached the hidden card and tried a grade; › was off on the last item
    ['a gone item: 1 does nothing, space skips it', [...TO_GONE, 'again', 'space']],
    ['a gone last item: › ends the session', [...TO_GONE, 'next']],
    // the session's tab left and come back to: it began again at its first item, and a card graded was asked again
    ['left and come back to, it goes on from where it was', ['space', 'space', 'away', 'space', 'easy', 'settle']],
    ['left and come back to, a card graded shows its grade and is graded again in its place', ['space', 'space', 'away', 'prev', 'again', 'settle']],
    ['left with the boxes open, the edit is written', ['e', 'type', 'away', 'settle']],
    // (`q0`, new and graded good, is in its steps: it comes back, and good there ends the walk)
    ['left at its end, it is at its end', ['space', 'space', 'space', 'space', 'space', 'space', 'space', 'space', 'away', 'settle']],
    // a card graded again was minutes from due when the session said all done: it comes back before the end
    ['again: the card comes back once the rest has had its turn, and good there ends it', ['next', 'again', 'again', 'space', 'space', 'space', 'space', 'settle']],
    ['again, and again on its return: it comes back once more, and good ends it', ['next', 'again', 'again', 'next', 'again', 'again', 'space', 'space', 'settle']],
    ['a new card graded good is in its steps: it comes back, each asking a review', ['space', 'space', 'next', 'next', 'space', 'space', 'settle']],
    ['two grades of one line in flight both land, the second from the first', ['again', 'again', 'next', 'next', 'space', 'space', 'space', 'space', 'settle']],
    ['a return come back to with ‹ and graded again: one review, and the return it brought is not asked', ['next', 'again', 'again', 'next', 'space', 'again', 'prev', 'easy', 'settle']],
    ['a grade given again out of its steps takes its return out of the walk', ['next', 'again', 'again', 'prev', 'space', 'space', 'space', 'settle']],
    ['a grade given again into its steps brings the card back', ['next', 'space', 'space', 'prev', 'again', 'space', 'space', 'space', 'space', 'settle']],
    ['a return taken out is put back when the grade is given again into its steps', ['next', 'again', 'again', 'prev', 'space', 'prev', 'again', 'settle', 'space', 'space', 'space', 'space']],
    ['an asking whose return was graded keeps its grade: no grades, space is on', ['again', 'again', 'next', 'next', 'space', 'space', 'prev', 'prev', 'prev', 'prev', 'again', 'space', 'settle']],
    ['left and come back to, a return is still to come, and is asked', ['next', 'again', 'again', 'away', 'space', 'space', 'away', 'space', 'space', 'settle']],
    ['left and come back to on a return graded, it shows its grade', ['next', 'again', 'again', 'next', 'space', 'again', 'away', 'prev', 'away', 'space', 'settle']],
    ['a return whose line is gone meanwhile is skipped', ['next', 'next', 'again', 'again', 'settle', 'prev', 'prev', 'e', 'form', 'save', 'anyway', 'settle', 'next', 'next', 'again', 'space']],
  ] as [string, E[]][])('%s', async (_, road) => {
    await play(road);
  });

  it('from an item gone, every road of three events more', async () => {
    let init = model.init;
    for (const e of TO_GONE) init = model.step(init, e)!;
    if (!gone(init)) throw new Error('the road does not reach a gone item');
    const roads = leaves(transitions({ ...model, init }, 3).all);
    for (const t of roads) await play([...TO_GONE, ...t.path]);
  }, 120_000);

  it("the model's steps are the scheduler's", () => {
    const now = new Date();
    const GS: G[] = [1, 3, 4];
    const seqs = (n: number): G[][] => (n === 0 ? [[]] : seqs(n - 1).flatMap((q) => GS.map((g) => [...q, g])));
    for (const [pre, line] of [['none', undefined], ['file', PRE_LINES[1] ?? undefined]] as [Pre, CardSchedule | undefined][]) {
      for (const road of [1, 2, 3, 4, 5].flatMap(seqs)) {
        const sched = road.reduce<CardSchedule | undefined>((x, g) => fsrsGrade(x, g, now), line)!;
        const stage = stageOf(pre, road.map((g) => ({ g })));
        // in its steps: due at an instant, not on a day
        expect(sched.due!.length > 10, `${pre} ${road.join('')}: ${stage}, due ${sched.due}`).toBe(inSteps(stage));
      }
    }
  });

  // The whole walk with returns, in the model alone (no boxes; each write lands before the next event: grades in
  // flight are the walk's below, and the named roads'). `again` bounded, it is finite; every state in it keeps the
  // invariants (the end leaves no line in its steps); and a road that only goes on (a grade, a reveal, a skip: never
  // ‹) cannot go round, and stops nowhere but at the end. Twice: going on only, `again` to each line twice; and with
  // ‹ › too (grades given again, returns taken out and put back, askings that keep their grade), `again` once.
  it.each([
    ['going on', ['space', 'again', 'easy'], AGAINS, 5],
    ['going on and back', ['space', 'again', 'easy', 'next', 'prev'], 1, 3],
  ] as [string, E[], number, number][])('every road on reaches the end: %s', (name, all, cap, most) => {
    const ON: E[] = ['space', 'again', 'easy'];
    const step = (s: S, e: E): S | null => {
      if (e === 'again' && s.show === 'A' && !atEnd(s) && !gone(s) && !locked(s) && s.agains[lineAt(s)] >= cap) return null;
      const to = model.step(s, e);
      return to?.pending ? model.step(to, 'settle') : to;
    };
    // what only the walk below needs to tell states apart is left out: a state here is where the session is and what the file holds
    const keyOf = (s: S) => JSON.stringify([s.idx, s.show, s.walk, s.given, s.landed, s.hit, s.ret, s.out, s.agains, s.disk.pre, s.disk.chain]);
    const states = new Map<string, S>([[keyOf(model.init), model.init]]);
    const on = new Map<string, string[]>();
    let frontier = [model.init];
    while (frontier.length) {
      const next: S[] = [];
      for (const s of frontier) {
        const k = keyOf(s);
        const steps: string[] = [];
        for (const e of all) {
          const to = step(s, e);
          if (to === null) continue;
          const bad = model.invariant!(to);
          if (bad) throw new Error(`${bad}: ${k} then ${e}`);
          const tk = keyOf(to);
          // an event that changes nothing is not a step
          if (ON.includes(e) && tk !== k) steps.push(tk);
          if (states.has(tk)) continue;
          states.set(tk, to);
          next.push(to);
        }
        on.set(k, steps);
        if (states.size > Number(process.env.MODEL_STATES ?? 400_000)) throw new Error(`the walk does not close in ${states.size} states`);
      }
      frontier = next;
    }
    // the longest road on from each state: a state met again on its own road is a round trip
    const longest = new Map<string, number>();
    const open = new Set<string>();
    const far = (k: string): number => {
      const known = longest.get(k);
      if (known !== undefined) return known;
      if (open.has(k)) throw new Error(`a road on comes round to ${k}`);
      open.add(k);
      const steps = on.get(k)!;
      if (!steps.length && !atEnd(states.get(k)!)) throw new Error(`a road on stops short of the end at ${k}`);
      let n = 0;
      for (const to of steps) n = Math.max(n, 1 + far(to));
      open.delete(k);
      longest.set(k, n);
      return n;
    };
    const long = far(keyOf(model.init));
    let ends = 0;
    let returns = 0;
    for (const s of states.values()) { if (atEnd(s)) ends++; returns = Math.max(returns, s.walk.length - 3); }
    process.stdout.write(`session: ${name}, the walk with returns closes at ${states.size} states, ${ends} of them the end; the longest road on is ${long} events, with ${returns} returns\n`);
    expect(ends).toBeGreaterThan(0);
    expect(returns).toBeGreaterThanOrEqual(most);
  }, 120_000);

  it('the view and the file are what the model says after every event', async () => {
    const { all, states } = transitions(model, DEPTH);
    const roads = leaves(all);
    let steps = 0;
    for (const t of roads) steps += await play(t.path);
    process.stdout.write(`session: ${states} states, ${all.length} transitions, ${roads.length} roads, ${steps} steps played\n`);
  }, 900_000);
});
