// @vitest-environment jsdom
// The card view's editor as a statechart (`CardPane.tsx` over `CardFaces.tsx`),
// checked exhaustively against the drawn view. Two cards of a deck: `w0`,
// both ways with a reviewed reverse (`sr r`, two reviews), so its switch to
// q&a drops a reviewed schedule and asks; `w1`, both ways, no id, nothing to
// drop. The view's state, per the card on show:
//
//   clean  --type|form≠--> dirty
//   dirty  --⌘⏎|outside|]|[ [no reviewed schedule dropped]--> clean (written; ] [ move on)
//   dirty  --⌘⏎|outside|]|[ [drops one]--> asking        (] [ stay)
//   asking --⌘⏎|save anyway--> clean (written, the reverse dropped)
//   asking --esc|back|type|form--> dirty (the question let go)
//   dirty  --esc--> clean (put back: the one way an edit goes unwritten)
//   any    --pick (the tree's row)|away (another tab) [savable]--> written, the other card / gone
//   any    --pick|away [drops one]--> kept, and on the card's return dirty again, asking
//   gone   --open--> the card on show as it was left
//
// The walk is every road of up to DEPTH events (justified below); each road
// is played on the view from the start, a fresh collection in memory, the
// writes let land after each event, and after each the view (which card,
// its form, what is typed, dirty, asking) and the file (each card's text,
// its id, its `sr` lines) are compared with the model. Invariants: an edit
// is written, held in the boxes, or kept for the card's return, unless put
// back with esc; a reviewed schedule is dropped only after the question was
// asked and answered `save anyway`; the card's id and its bare line stay.

import { act, createElement } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';
import { parse, type Card, type Doc } from '../../format/index.js';
import { Vault, storeFs } from '../../vault/index.js';
import { memStore } from '../../vault/mem-store.js';
import { faceViews } from '../FaceField.js';
import { useApp } from '../store.js';
import { leaves, transitions, type Machine } from './explore.js';

for (const proto of [Node.prototype, Range.prototype] as unknown as { getClientRects?: () => DOMRect[]; getBoundingClientRect?: () => DOMRect }[]) {
  proto.getClientRects ??= () => [];
  proto.getBoundingClientRect ??= () => new DOMRect();
}

const DECK = 'deck.md';
const BARE = '<!-- sr due=2026-05-27 st=review s=3 d=5 r=4 l=1 ivl=3 last=2026-05-24T07:30:00Z g=2 -->';
const REV = '<!-- sr r due=2026-05-29 st=review s=2.4 d=6.1 r=2 l=0 ivl=3 last=2026-05-26T07:30:00Z g=3 -->';
const FILE = `---\ntype: deck\n---\n\nw0 ::: v0 ^k0\n${BARE}\n${REV}\n\nw1 ::: v1\n`;
const ORIG = parse(FILE).doc.blocks.filter((b): b is Card => b.kind === 'card');

let vault: Vault;
const bodies = new Map<string, Doc>();

vi.mock('../vault.js', async (orig) => {
  const real = await orig<typeof import('../vault.js')>();
  return {
    ...real,
    currentVault: () => vault,
    docsOf: (paths: readonly string[]) => paths.filter((p) => bodies.has(p)).map((p) => [p, bodies.get(p)!] as [string, Doc]),
    note: () => {},
  };
});
const { CardPane } = await import('../CardPane.js');
const faces = await import('../CardFaces.js');
(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

// ── the model ────────────────────────────────────────────────────

type Form = 'bidir' | 'qa';
interface Faces { form: Form; n: number }
interface S {
  /** The view is drawn (its tab is the one on show). */
  on: boolean;
  at: 0 | 1;
  /** What the file holds of each card: its form, whether a `+` is typed after its back. */
  disk: [Faces, Faces];
  /** The reviewed reverse of `w0` is still in the file. */
  rev: boolean;
  /** The boxes of the card on show, while drawn. */
  ed: (Faces & { asking: boolean }) | null;
  /** An edit held for a card's return. */
  kept: [Faces | null, Faces | null];
}

const EVENTS = ['type', 'qa', 'bidir', 'save', 'esc', 'anyway', 'back', 'outside', 'next', 'prev', 'pick', 'away', 'open'] as const;
type E = (typeof EVENTS)[number];

const same = (a: Faces, b: Faces) => a.form === b.form && a.n === b.n;
const other = (at: 0 | 1): 0 | 1 => (at === 0 ? 1 : 0);
const faces0 = (f: Faces): Faces => ({ form: f.form, n: f.n });
const dirty = (s: S) => !!s.ed && !same(s.ed, s.disk[s.at]);
/** Saving `f` as card `c` would drop a reviewed schedule: `w0`'s reverse, while there. */
const drops = (s: S, c: 0 | 1, f: Faces) => c === 0 && s.rev && f.form === 'qa';

function write(s: S, c: 0 | 1, f: Faces, sure: boolean): void {
  if (drops(s, c, f)) {
    if (!sure) throw new Error('the model drops a reviewed schedule unasked');
    s.rev = false;
  }
  s.disk[c] = faces0(f);
}

/** Save what is unsaved; false when the editor asks first (`flush`). */
function flush(s: S, sure: boolean): boolean {
  const ed = s.ed!;
  if (!dirty(s)) return true;
  if (drops(s, s.at, ed) && !sure) { ed.asking = true; return false; }
  write(s, s.at, ed, sure);
  ed.asking = false;
  return true;
}

/** The boxes of card `c` drawn: an edit kept for it comes back, asking again when it drops a schedule. */
function open(s: S, c: 0 | 1): void {
  s.at = c;
  const k = s.kept[c];
  s.kept[c] = null;
  const f = k ?? s.disk[c];
  s.ed = { ...faces0(f), asking: !!k && !same(f, s.disk[c]) && drops(s, c, f) };
}

/** The boxes let go without a save asked for: written when they can be, else kept. */
function leave(s: S): void {
  if (dirty(s)) {
    const ed = s.ed!;
    if (drops(s, s.at, ed)) s.kept[s.at] = faces0(ed);
    else write(s, s.at, ed, false);
  }
  s.ed = null;
}

const clone = (s: S): S => structuredClone(s);

const model: Machine<S, E> = {
  init: { on: true, at: 0, disk: [{ form: 'bidir', n: 0 }, { form: 'bidir', n: 0 }], rev: true, ed: { form: 'bidir', n: 0, asking: false }, kept: [null, null] },
  events: EVENTS,
  key: (s) => JSON.stringify(s),
  step(s0, e) {
    const s = clone(s0);
    if (e === 'open') { if (s.on) return null; s.on = true; open(s, s.at); return s; }
    if (!s.on) return null;
    const ed = s.ed!;
    switch (e) {
      case 'type': ed.n = 1 - ed.n; ed.asking = false; return s;
      case 'qa': case 'bidir': ed.form = e; ed.asking = false; return s;
      case 'save': flush(s, ed.asking); return s;
      case 'esc':
        if (ed.asking) ed.asking = false;
        else s.ed = { ...faces0(s.disk[s.at]), asking: false };
        return s;
      case 'anyway': if (!ed.asking) return null; flush(s, true); return s;
      case 'back': if (!ed.asking) return null; ed.asking = false; return s;
      case 'outside': if (!ed.asking && dirty(s)) flush(s, false); return s;
      case 'next': case 'prev':
        if ((e === 'next') !== (s.at === 0)) return null;
        if (flush(s, false)) open(s, other(s.at));
        return s;
      case 'pick': leave(s); open(s, other(s.at)); return s;
      case 'away': leave(s); s.on = false; return s;
    }
    return null;
  },
  invariant(s) {
    if (s.ed?.asking && !(dirty(s) && drops(s, s.at, s.ed))) return 'asking with nothing to ask about';
    if (s.on !== !!s.ed) return 'boxes without a view';
    return null;
  },
};

// ── the view, driven ─────────────────────────────────────────────

const textOf = (f: Faces, c: 0 | 1) => `w${c} ${f.form === 'qa' ? '::' : ':::'} v${c}${'+'.repeat(f.n)}`;

interface Seen {
  on: boolean;
  at?: number;
  form?: string | null;
  front?: string;
  back?: string;
  dirty?: string | null;
  asking?: boolean;
  file: unknown;
}

/** What the file holds of the two cards: text, id, lines. */
function fileOf(doc: Doc): unknown {
  return doc.blocks.filter((b): b is Card => b.kind === 'card').map((c) => ({ text: c.text, id: c.id, sched: c.sched, reverse: c.reverse }));
}

function expected(s: S): Seen {
  const file = [
    { text: textOf(s.disk[0], 0), id: 'k0', sched: ORIG[0]!.sched, reverse: s.rev ? ORIG[0]!.reverse : undefined },
    { text: textOf(s.disk[1], 1), id: undefined, sched: undefined, reverse: undefined },
  ];
  if (!s.ed) return { on: false, file };
  return { on: true, at: s.at, form: s.ed.form, front: `w${s.at}`, back: `v${s.at}${'+'.repeat(s.ed.n)}`, dirty: dirty(s) ? '1' : '0', asking: s.ed.asking, file };
}

let host: HTMLDivElement;
let root: Root | null = null;
let off: (() => void) | null = null;

const draw = () => act(() => { root = createRoot(host); root.render(createElement(CardPane, { path: DECK, active: true, onOpen: () => {} })); });
const unmount = () => act(() => { root?.unmount(); root = null; });
/** The writes let land, and the view told, as the app's events do. */
const settle = () => act(async () => { await new Promise((r) => setTimeout(r, 0)); });

async function start(): Promise<void> {
  faces.keptEdits.clear();
  const fs = storeFs(memStore(), '/v');
  await fs.mkdir('/v');
  await fs.writeText(`/v/${DECK}`, FILE);
  vault = await Vault.open(fs, '/v');
  bodies.set(DECK, (await vault.read(DECK)).doc);
  off = vault.subscribe((ev) => {
    if (ev.kind !== 'doc' || ev.path !== DECK) return;
    bodies.set(DECK, ev.loaded.doc);
    useApp.setState((s) => ({ docs: { ...s.docs } }));
  });
  useApp.setState({ docs: { [DECK]: { type: 'deck', frozen: false, cards: 2, due: 0 } }, files: [DECK], vault: '/v', cardAt: { [DECK]: { block: 0, id: 'k0' } }, selectedCard: null, reveal: null });
  await draw();
}

async function stop(): Promise<void> {
  await unmount();
  off?.();
  vault.close();
  bodies.clear();
}

const boxes = () => Array.from(host.querySelectorAll<HTMLElement>('.card-view .card .face'));
const pm = (i: number) => boxes()[i]!.querySelector<HTMLElement>('.ProseMirror')!;
const key = (k: string, el: EventTarget, init: KeyboardEventInit = {}) => act(() => { el.dispatchEvent(new KeyboardEvent('keydown', { key: k, bubbles: true, cancelable: true, ...init })); });
const button = (words: string) => Array.from(host.querySelectorAll<HTMLButtonElement>('.card-edit button')).find((b) => b.textContent?.includes(words))!;

async function fire(e: E, s: S): Promise<void> {
  switch (e) {
    case 'type': {
      const v = faceViews.get(boxes()[1]!.querySelector('.face-host')!)!;
      // a `+` typed after the back, or the one there taken out
      const end = v.state.doc.content.size - 1;
      await act(() => { v.dispatch(s.ed!.n === 0 ? v.state.tr.insertText('+', end) : v.state.tr.delete(end - 1, end)); });
      break;
    }
    case 'qa': await act(() => { button('q&a').click(); }); break;
    case 'bidir': await act(() => { button('bidir').click(); }); break;
    case 'save': await key('Enter', pm(0), { metaKey: true }); break;
    case 'esc': await key('Escape', pm(0)); break;
    case 'anyway': await act(() => { button('save anyway').click(); }); break;
    case 'back': await act(() => { button('back').click(); }); break;
    case 'outside': await act(() => { document.body.dispatchEvent(new MouseEvent('mousedown', { bubbles: true })); }); break;
    case 'next': await key(']', window); break;
    case 'prev': await key('[', window); break;
    case 'pick': {
      // the tree's row of the other card: the view stands there, nothing asked of the boxes
      const cards = bodies.get(DECK)!.blocks.flatMap((b, block) => (b.kind === 'card' ? [{ block, id: b.id }] : []));
      const to = cards[other(s.at)]!;
      await act(() => { useApp.setState((st) => ({ cardAt: { ...st.cardAt, [DECK]: to.id === undefined ? { block: to.block } : { block: to.block, id: to.id } } })); });
      break;
    }
    case 'away': await unmount(); break;
    case 'open': await draw(); break;
  }
  await settle();
}

function seen(): Seen {
  const file = fileOf(bodies.get(DECK)!);
  const edit = host.querySelector<HTMLElement>('.card-edit');
  if (!edit) return { on: false, file };
  const count = host.querySelector('.cv-count')?.textContent ?? '';
  return {
    on: true,
    at: Number(count.split(' / ')[0]) - 1,
    form: edit.querySelector('.cm-forms [data-active="1"]')?.getAttribute('data-form') ?? null,
    front: boxes()[0]!.textContent ?? '',
    back: boxes()[1]?.textContent ?? '',
    dirty: edit.getAttribute('data-dirty'),
    asking: !!edit.querySelector('.cm-ask'),
    file,
  };
}

/** Play `road` on the view from the start, comparing it with the model after every event; how many events. */
async function play(road: readonly E[]): Promise<number> {
  await start();
  let s = model.init;
  try {
    expect(seen(), 'the start').toEqual(expected(s));
    for (let i = 0; i < road.length; i++) {
      const e = road[i]!;
      if (model.step(s, e) === null) throw new Error(`${road.slice(0, i + 1).join(' ')}: not enabled`);
      await fire(e, s);
      s = model.step(s, e)!;
      expect(seen(), road.slice(0, i + 1).join(' ')).toEqual(expected(s));
    }
  } finally {
    await stop();
  }
  return road.length;
}

// Depth 11: the model's whole state space (352 states) is reached within
// eleven events (a twelfth reaches none new), so every transition of every
// reachable state is played. MODEL_DEPTH plays fewer, for a quick run.
const DEPTH = Number(process.env.MODEL_DEPTH ?? 11);

describe('the card view, every transition of every reachable state', () => {
  beforeAll(() => { host = document.body.appendChild(document.createElement('div')); });
  afterAll(() => { host.remove(); });

  // what the walk found: the q&a switch's question pending, the boxes let go
  // (the tree's row of another card, another tab), and the edit was gone on the
  // card's return, unwritten and unasked
  it.each([
    ['qa', 'pick', 'prev'],
    ['qa', 'away', 'open'],
    ['qa', 'save', 'pick', 'pick', 'anyway'],
  ].map((r) => [r.join(' '), r as E[]] as const))('an edit that asks, let go, comes back asking: %s', async (_, road) => {
    await play(road);
  });

  it('the view and the file are what the model says after every event', async () => {
    const { all, states } = transitions(model, DEPTH);
    const roads = leaves(all);
    let steps = 0;
    for (const t of roads) steps += await play(t.path);
    if (DEPTH >= 11) expect(states).toBe(352);
    process.stdout.write(`card view: ${states} states, ${all.length} transitions, ${roads.length} roads, ${steps} steps played\n`);
  }, 600_000);
});
