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
//   answer   --space|1|a grade's button--> graded: the next item's question (after the last, the end)
//   editing  --space|1--> editing (the keys are the boxes')
//   editing  --⌘⏎ [clean|written]--> answer          --⌘⏎ [drops a reviewed schedule]--> asking
//   asking   --⌘⏎|save anyway--> answer (written)     --esc--> editing
//   editing  --esc--> answer (put back)
//   editing  --a grade's button--> the press outside saves (or asks), then the grade: graded
//   any      --‹|›--> the item before or after, its question (the boxes let go: written, or kept)
//   gone     (the card, or the line the item asks, is no longer in the file): no grades, ‹ › only
//
// and the writes: `settle` lets every write sent land. Between, the user
// may go on (grade the next card, go back) with writes in flight; `e` only
// once they have landed (the boxes open on the file as it is). After each
// event the view (which item, question, answer, the boxes: form, what is
// typed, dirty, asking; or gone, or the end) is compared with the model,
// and once the writes land, the file: each card's text, its id, the reviews
// on each of its lines. Invariants, by the comparison: every grade given
// is written, once, to the line the item asks, and only to a card whose
// answer was up; an edit is written, held, or kept, unless put back with
// esc; a reviewed schedule goes only when asked and answered; no reverse
// line on a card that is not both ways.

import { act, createElement } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';
import { parse, type Card, type Doc } from '../../format/index.js';
import { docItems, type CardItem } from '../../schedule/index.js';
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
interface Disk {
  cards: [Faces, Faces];
  /** Reviews on `q0`'s line, `w1`'s bare line, `w1`'s reverse (null: no reverse line). */
  reps: [number, number, number | null];
}
type Show = 'Q' | 'A' | 'E';
interface S {
  /** The item on show; 3 is the end. */
  idx: number;
  show: Show;
  ed: (Faces & { asking: boolean }) | null;
  /** The file once every write sent has landed. */
  disk: Disk;
  /** The file as the view last heard of it. */
  seen: Disk;
  kept: [Faces | null, Faces | null];
  pending: boolean;
}

const EVENTS = ['space', 'again', 'e', 'type', 'form', 'save', 'esc', 'anyway', 'easy', 'next', 'prev', 'settle'] as const;
type E = (typeof EVENTS)[number];
const TOTAL = 3;

const cardOf = (idx: number): 0 | 1 => (idx === 0 ? 0 : 1);
const same = (a: Faces, b: Faces) => a.form === b.form && a.n === b.n;
const faces0 = (f: Faces): Faces => ({ form: f.form, n: f.n });
/** The item's card, or the line it asks, is no longer in the file the view has. */
const gone = (s: S) => s.idx === 2 && s.seen.cards[1].form !== 'bidir';
const dirty = (s: S) => !!s.ed && !same(s.ed, s.disk.cards[cardOf(s.idx)]);
const drops = (d: Disk, c: 0 | 1, f: Faces) => c === 1 && f.form !== 'bidir' && (d.reps[2] ?? 0) > 0;

function write(s: S, c: 0 | 1, f: Faces, sure: boolean): void {
  if (drops(s.disk, c, f) && !sure) throw new Error('the model drops a reviewed schedule unasked');
  s.disk.cards[c] = faces0(f);
  // a card no longer both ways has no reverse
  if (c === 1 && f.form !== 'bidir') s.disk.reps[2] = null;
  s.pending = true;
}

function flush(s: S, sure: boolean): boolean {
  const ed = s.ed!;
  if (!dirty(s)) return true;
  if (drops(s.disk, cardOf(s.idx), ed) && !sure) { ed.asking = true; return false; }
  write(s, cardOf(s.idx), ed, sure);
  ed.asking = false;
  return true;
}

/** A grade sent: written to the line the item asks, once the writes before it have landed; a reverse of a card no longer both ways is not there. */
function grade(s: S): void {
  const line = s.idx;
  if (!(line === 2 && s.disk.cards[1].form !== 'bidir')) s.disk.reps[line] = (s.disk.reps[line] ?? 0) + 1;
  s.pending = true;
}

/** The boxes let go: written when they can be, else kept for the card's return. */
function leave(s: S): void {
  if (s.show === 'E' && dirty(s)) {
    const c = cardOf(s.idx);
    if (drops(s.disk, c, s.ed!)) s.kept[c] = faces0(s.ed!);
    else write(s, c, s.ed!, false);
  }
  s.ed = null;
}

function goTo(s: S, idx: number): void {
  leave(s);
  s.idx = idx;
  s.show = 'Q';
}

/** A press outside the boxes (a grade's button, ‹ ›): what is unsaved is saved, or the question asked. */
function pressOutside(s: S): void {
  if (s.show !== 'E' || s.ed!.asking || !dirty(s)) return;
  if (flush(s, false)) { s.show = 'A'; s.ed = null; }
}

const model: Machine<S, E> = {
  init: (() => {
    const d: Disk = { cards: [{ form: 'qa', n: 0 }, { form: 'bidir', n: 0 }], reps: [0, 4, 2] };
    return { idx: 0, show: 'Q', ed: null, disk: d, seen: structuredClone(d), kept: [null, null], pending: false };
  })(),
  events: EVENTS,
  key: (s) => JSON.stringify(s),
  step(s0, e) {
    const s = structuredClone(s0);
    if (e === 'settle') { if (!s.pending) return null; s.pending = false; s.seen = structuredClone(s.disk); return s; }
    if (s.idx >= TOTAL) return null;
    const ed = s.ed;
    switch (e) {
      case 'space': case 'again':
        if (s.show === 'Q') s.show = 'A';
        else if (s.show === 'A') { grade(s); goTo(s, s.idx + 1); }
        return s;
      case 'easy':
        // no grades on a card that is gone
        if (gone(s)) return null;
        pressOutside(s);
        if (s.show === 'Q') s.show = 'A';
        else { grade(s); goTo(s, s.idx + 1); }
        return s;
      case 'e': {
        // the boxes open on the file as it is
        if (s.pending) return null;
        if (s.show === 'E' || gone(s)) return s;
        const c = cardOf(s.idx);
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
      case 'next': if (s.idx >= TOTAL - 1) return null; pressOutside(s); goTo(s, s.idx + 1); return s;
      case 'prev': if (s.idx === 0) return null; pressOutside(s); goTo(s, s.idx - 1); return s;
    }
    return null;
  },
  invariant(s) {
    if (s.ed?.asking && !(dirty(s) && drops(s.disk, cardOf(s.idx), s.ed))) return 'asking with nothing to ask about';
    if ((s.show === 'E') !== !!s.ed) return 'boxes without editing';
    if (s.disk.cards[1].form !== 'bidir' && s.disk.reps[2] !== null) return 'a reverse line on a card not both ways';
    return null;
  },
};

// ── the session, driven ──────────────────────────────────────────

const textOf = (f: Faces, c: 0 | 1) => `${c ? 'w1' : 'q0'} ${f.form === 'qa' ? '::' : ':::'} ${c ? 'v1' : 'a0'}${'+'.repeat(f.n)}`;

interface Seen {
  idx: number;
  view: string;
  form?: string | null;
  back?: string;
  dirty?: string | null;
  asking?: boolean;
  file?: unknown;
}

function fileOf(doc: Doc): unknown {
  const [a, b] = doc.blocks.filter((x): x is Card => x.kind === 'card');
  return [
    { text: a?.text, id: a?.id !== undefined, reps: a?.sched?.reps ?? 0, reverse: a?.reverse?.reps ?? null },
    { text: b?.text, id: b?.id, reps: b?.sched?.reps ?? 0, reverse: b?.reverse?.reps ?? null },
  ];
}

function expected(s: S): Seen {
  const out: Seen = { idx: Math.min(s.idx, TOTAL - 1), view: s.idx >= TOTAL ? 'end' : gone(s) ? 'gone' : s.show };
  if (s.idx >= TOTAL) out.idx = -1;
  if (s.ed && !gone(s)) {
    const c = cardOf(s.idx);
    Object.assign(out, { form: s.ed.form, back: `${c ? 'v1' : 'a0'}${'+'.repeat(s.ed.n)}`, dirty: dirty(s) ? '1' : '0', asking: s.ed.asking });
  }
  if (!s.pending) {
    out.file = [
      { text: textOf(s.disk.cards[0], 0), id: s.disk.reps[0] > 0, reps: s.disk.reps[0], reverse: null },
      { text: textOf(s.disk.cards[1], 1), id: 'k1', reps: s.disk.reps[1], reverse: s.disk.reps[2] },
    ];
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
  useApp.setState({ docs: { [DECK]: { type: 'deck', frozen: false, cards: 2, due: 3 } }, files: [DECK], vault: '/v', phone: false, reveal: null, session: { seq: 1, items: order as CardItem[] } });
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
    case 'next': await press(host.querySelectorAll<HTMLButtonElement>('.sess-nav .sn-btn')[1]!); break;
    case 'prev': await press(host.querySelectorAll<HTMLButtonElement>('.sess-nav .sn-btn')[0]!); break;
    case 'settle': await settle(); break;
  }
}

function seen(s: S): Seen {
  const count = host.querySelector('.sess-count')?.textContent;
  const out: Seen = { idx: count ? Number(count.split(' / ')[0]) - 1 : -1, view: '' };
  const edit = host.querySelector<HTMLElement>('.card-edit');
  const card = host.querySelector<HTMLElement>('.recall-wrap .card');
  if (host.querySelector('.session-end')) out.view = 'end';
  else if (host.querySelector('.recall-wrap > .empty')?.textContent === 'no longer in the collection') out.view = 'gone';
  else if (edit) out.view = 'E';
  else if (card) out.view = card.dataset.revealed === '1' ? 'A' : 'Q';
  if (edit) {
    Object.assign(out, {
      form: edit.querySelector('.cm-forms [data-active="1"]')?.getAttribute('data-form') ?? null,
      back: boxes()[1]?.textContent ?? '',
      dirty: edit.getAttribute('data-dirty'),
      asking: !!edit.querySelector('.cm-ask'),
    });
  }
  // the file, once the model says every write has landed
  if (!s.pending) out.file = fileOf(parse(fileText).doc);
  return out;
}

let fileText = '';
async function readFile(): Promise<void> {
  gate.hold(false);
  fileText = (await vault.read(DECK)).text;
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
// below); seven plays every mix of the others: 575 states, 1487 roads,
// about half a minute. Each event more about doubles it; MODEL_DEPTH=8
// (1075 states, 2833 roads) passes too.
const DEPTH = Number(process.env.MODEL_DEPTH ?? 7);

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
  ] as [string, E[]][])('%s', async (_, road) => {
    await play(road);
  });

  it('the view and the file are what the model says after every event', async () => {
    const { all, states } = transitions(model, DEPTH);
    const roads = leaves(all);
    let steps = 0;
    for (const t of roads) steps += await play(t.path);
    process.stdout.write(`session: ${states} states, ${all.length} transitions, ${roads.length} roads, ${steps} steps played\n`);
  }, 900_000);
});
