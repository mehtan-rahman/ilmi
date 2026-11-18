// @vitest-environment jsdom
// The day's queue and the session as one machine, over two devices: the whole
// app (`App.tsx`, the real `vault.ts`, the queue, the session, the phone's
// bar, the strip) drawn over a small collection in memory, driven by
// generated sequences of what a person does, and after every event held
// against what must be true whatever was done before.
//
// The collection (`world`): a deck of new cards (three q&a with no id, the
// two blanks of a cloze, the reverse of a both-ways card whose forward is
// reviewed), reviews due, a card in its learning steps, one not due, with
// `new-per-day: 4` so the allowance holds some back; a note with two
// sections that come back and a card under one; a source to read; a draft.
//
// Two devices hold it, each its own store and its own `localStorage`; the
// app is open on one at a time, in that device's shell (a phone, an iPad, a
// Mac). They meet by a sync, either way the app syncs: the files merged by
// the format's rules (`src/sync/merge.ts`, as git's pull does it: base, ours,
// theirs), or the collections merged by CRDT through a storage
// (`src/sync/engine.ts`). The clock is the test's.
//
// The events (`Ev`): open the day; enter the queue (the phone's bar, the
// day's button); a row pressed (a session from that element); a topic's
// three from its row (a phone); study the deck, or cram it; reveal, got it,
// a grade (its button, or its key on a card up to learn), › and ‹, suspend,
// a card reworded from outside the session; next, later, dismiss on a topic,
// and the pass on one come back to; the notice's undo; and the ways out:
// the phone's ×, another document opened, the session's tab closed and come
// back to, the app sent to the background, the app closed and opened again
// (a fresh store over what was kept), the other device taken up, a sync,
// the clock moved by minutes or past midnight, a wait. A way out may come
// `fast`: before the writes of the event before it have landed.
//
// What must hold (`check`), after every event once its writes have landed:
// - nothing threw, and nothing was said to have failed;
// - `learn`: a card got (`got it`) is never up to learn again, on either
//   device, on any day, save where it was learnt when ‹ comes back to it in
//   that session; nor is a card that has a review;
// - `frame`: an event changes only the schedule lines it is about, as it
//   should (a grade: its line graded once, at that instant, one line more in
//   the log, or the same line replaced when given again; a topic's action:
//   its line, one reading logged; an undo: the line as it was; anything
//   else, a way out most of all: nothing), and nothing on the other device;
// - `sync`: after one both devices hold the same, each line the one side's
//   that changed it, or of two that did the later review; the log the union;
//   no card twice;
// - `queue`: the queue the app holds is the one made afresh from the files
//   (what is due, in its order; what is held or buried);
// - `counts`: the strip, the phone's bar, the day's legend and its rows say
//   that queue's number;
// - `walk`: a session begun walks what is due, nothing twice, and with it
//   the cards in their steps due later today;
// - `counter`: `n / total` never has n over total, and the total grows only
//   by a card graded into its steps;
// - `steps`: a session walked to its end (no ›, no suspend) leaves no card
//   it graded in its steps.
//
// A sequence that breaks one is cut down to the fewest events that still
// break the same one (`shrink`), and the failure says those.

import { act, createElement } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';
import { meta as metaOf, mergeReadings, mergeReviews, parse, parseLog, serialize, type Card, type CardSchedule, type Doc, type Meta, type Review } from '../../format/index.js';
import { docItems, grade as fsrsGrade, isDue, meterQueue, mulberry32, resolveOptions, spentToday, type CardItem, type QueueItem } from '../../schedule/index.js';
import { mergeFile } from '../../sync/merge.js';
import { engine, type Engine } from '../../sync/engine.js';
import { memStorage, type MemStorage } from '../../sync/storage.js';
import { join, type StoreFs } from '../../vault/index.js';

const clock = vi.hoisted(() => ({ t: 0, mobile: false }));
const T0 = new Date('2026-11-18T09:00:00').getTime();
let fs: StoreFs;

vi.mock('../clock.js', () => ({ appNow: () => new Date(clock.t), setClockDay: () => {} }));
// the Rust side: it says where the app runs, and nothing else
vi.mock('@tauri-apps/api/core', () => ({ invoke: async (cmd: string) => (cmd === 'platform' ? { mobile: clock.mobile, documents: null } : null) }));
vi.mock('../collections.js', async (orig) => ({ ...(await orig<typeof import('../collections.js')>()), collectionFs: () => fs }));
vi.mock('../crdt.js', async (orig) => ({ ...(await orig<typeof import('../crdt.js')>()), startCrdt: async () => true, stopCrdt: () => {} }));
vi.mock('../keep.js', async (orig) => ({ ...(await orig<typeof import('../keep.js')>()), startMirror: async () => {}, stopMirror: () => {}, keepDatedSoon: () => {}, stopDated: () => {} }));
vi.mock('@tauri-apps/plugin-log', async (orig) => ({ ...(await orig<typeof import('@tauri-apps/plugin-log')>()), info: async () => {} }));
vi.mock('../../plugins/index.js', async (orig) => ({ ...(await orig<typeof import('../../plugins/index.js')>()), startPlugins: async () => ({}), stopPlugins: () => {} }));
vi.mock('../../plugins/PluginsSection.js', () => ({ PluginsSection: () => null }));
vi.mock('../Pdf.js', () => ({ Pdf: () => null, pointInView: () => null }));

const { memStore } = await import('../../vault/mem-store.js');
const { storeFs } = await import('../../vault/store.js');
const { closeVault, currentVault, openNode, openVault } = await import('../vault.js');
const { saveCardEdit, studyDeck } = await import('../deckOps.js');
const { useApp } = await import('../store.js');
const { App } = await import('../App.js');
const { setPlatform } = await import('../platform.js');
const { SESSION, queueId } = await import('../names.js');
const { activeTab, closeTab, emptyPanes } = await import('../panes.js');
const { closeTabs } = await import('../vault.js');

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
(globalThis as { ResizeObserver?: unknown }).ResizeObserver ??= class { observe() {} unobserve() {} disconnect() {} };
(Element.prototype as { scrollIntoView?: unknown }).scrollIntoView = function () {};
for (const proto of [Node.prototype, Range.prototype] as unknown as { getClientRects?: () => DOMRect[]; getBoundingClientRect?: () => DOMRect }[]) {
  proto.getClientRects ??= () => [];
  proto.getBoundingClientRect ??= () => new DOMRect();
}

// ── the world ────────────────────────────────────────────────────

const ROOT = '/collections/model';
const TODAY = queueId('today');
const DECK = 'deck.md';
const NOTE = 'note.md';
const SRC = 'src.md';
const DRAFT = 'draft.md';
const iso = (ms: number) => `${new Date(ms).toISOString().slice(0, 19)}Z`;

function files(): Record<string, string> {
  // a card graded `again` five minutes before the start: in its steps, due by now
  const learning = fsrsGrade(undefined, 1, new Date(T0 - 5 * 60_000));
  const { doc } = parse([
    '---', 'type: deck', 'new-per-day: 4', '---', '',
    'n1 :: a1', '', 'n2 :: a2', '', 'n3 :: a3', '',
    'bw ::: vb ^kb', '<!-- sr due=2026-11-12 st=review s=3 d=5 r=4 l=1 ivl=3 last=2026-11-09T07:30:00Z g=3 -->', '',
    'the {{c1::first}} and the {{c2::second}} ^kc', '',
    'r1 :: ra ^kr', '<!-- sr due=2026-11-10 st=review s=3 d=5 r=4 l=1 ivl=3 last=2026-11-07T07:30:00Z g=3 -->', '',
    'r2 :: rb ^ks', '<!-- sr due=2026-11-17 st=review s=8 d=5 r=6 l=0 ivl=8 last=2026-11-09T07:30:00Z g=3 -->', '',
    'l1 :: la ^kl', '',
    'f1 :: fa ^kf', '<!-- sr due=2026-12-20 st=review s=30 d=5 r=6 l=0 ivl=30 last=2026-11-10T07:30:00Z g=3 -->', '',
  ].join('\n'));
  (doc.blocks.find((b) => b.kind === 'card' && b.id === 'kl') as Card).sched = learning;
  return {
    [DECK]: serialize(doc),
    [NOTE]: '---\ntype: note\ntitle: a note\n---\n\n## one\n<!-- read made=2026-11-01 due=2026-11-10 ivl=3 reps=1 -->\n\nwords of one\n\nsc :: sa\n\n## two\n<!-- read made=2026-11-01 due=2026-11-12 ivl=5 reps=2 -->\n\nwords of two\n',
    [SRC]: '---\ntype: source\ntitle: a source\nread: due=2026-11-10 ivl=3 reps=1\n---\n\npara one\n\npara two\n\npara three\n',
    [DRAFT]: '---\ntype: draft\ntitle: a draft\nwrite: due=2026-11-10 ivl=2 reps=1\n---\n\ndraft text\n',
  };
}

type Shape = 'phone' | 'ipad' | 'mac';
type Way = 'git' | 'crdt';
interface Device { name: 'A' | 'B'; shape: Shape; fs: StoreFs; eng: Engine | null; kept: Map<string, string> }

let devices: [Device, Device];
let cur: Device;
let storage: MemStorage;
let way: Way;
/** Git's way: what both held at the last sync, by path. */
let base: Map<string, string>;
let host: HTMLDivElement;
let root: Root | null = null;
let errors: string[] = [];
const initial = useApp.getState();
const loro = () => import('loro-crdt');

const flush = async (ms = 30) => {
  for (let i = 0; i < 3; i++) {
    await act(async () => { await vi.advanceTimersByTimeAsync(ms / 3); });
    await act(async () => { await new Promise((r) => setImmediate(r)); });
  }
};

/** Time passes: the app's clock and its timers move together. */
const pass = async (ms: number) => {
  clock.t += ms;
  // (and a moment more: the app looks at the queue again 50 ms after an element comes due)
  await act(async () => { await vi.advanceTimersByTimeAsync(ms + 100); });
};

/** Every file of a device that syncs, by path. */
async function filesOf(d: Device): Promise<Map<string, string>> {
  const out = new Map<string, string>();
  const visit = async (rel: string): Promise<void> => {
    for (const e of await d.fs.readDir(join(ROOT, rel))) {
      const path = rel ? `${rel}/${e.name}` : e.name;
      if (e.isDir) { await visit(path); continue; }
      if (path.endsWith('.md') || (path.startsWith('.ilmi/reviews/') && path.endsWith('.jsonl'))) out.set(path, await d.fs.readText(join(ROOT, path)));
    }
  };
  await visit('');
  return out;
}

async function openApp(d: Device): Promise<void> {
  cur = d;
  fs = d.fs;
  // a device's own storage: what the app keeps outside the collection
  localStorage.clear();
  for (const [k, v] of d.kept) localStorage.setItem(k, v);
  const mobile = d.shape !== 'mac';
  Object.defineProperty(window, 'innerWidth', { value: d.shape === 'phone' ? 390 : 1180, configurable: true });
  Object.defineProperty(window, 'innerHeight', { value: d.shape === 'phone' ? 844 : 820, configurable: true });
  clock.mobile = mobile;
  setPlatform({ mobile, documents: null });
  useApp.setState({ ...initial, panes: emptyPanes(), mobile, started: true, learnNew: true });
  await openVault(ROOT);
  useApp.setState({ mobile });
  root = createRoot(host);
  await act(async () => { root!.render(createElement(App)); });
  await flush();
}

async function closeApp(): Promise<void> {
  if (root) await act(async () => { root!.unmount(); });
  root = null;
  closeVault();
  cur.kept = new Map(Object.keys(localStorage).map((k) => [k, localStorage.getItem(k)!]));
  useApp.setState({ ...initial, panes: emptyPanes() });
}

async function world(shapes: [Shape, Shape], how: Way, seed: number): Promise<void> {
  clock.t = T0;
  run = 0;
  way = how;
  errors = [];
  const rnd = mulberry32(seed ^ 0x51ed);
  vi.spyOn(Math, 'random').mockImplementation(() => rnd());
  storage = memStorage();
  const make = (name: 'A' | 'B', shape: Shape, n: number): Device => {
    const f = storeFs(memStore(), ROOT);
    return { name, shape, fs: f, eng: how === 'crdt' ? engine(f, { loro, now: () => clock.t, newDevice: () => n.toString(16).padStart(16, '0') }) : null, kept: new Map() };
  };
  devices = [make('A', shapes[0], 1), make('B', shapes[1], 2)];
  const [a, b] = devices;
  await a.fs.mkdir(ROOT);
  await b.fs.mkdir(ROOT);
  for (const [p, text] of Object.entries(files())) await a.fs.writeText(join(ROOT, p), text);
  if (how === 'crdt') {
    await a.eng!.connect(storage);
    await a.eng!.sync(storage);
    await b.eng!.connect(storage);
    await b.eng!.sync(storage);
  } else {
    for (const [p, text] of await filesOf(a)) await b.fs.writeText(join(ROOT, p), text);
  }
  base = await filesOf(a);
  await openApp(a);
}

async function endWorld(): Promise<void> {
  await flush(100);
  await closeApp();
  await flush(100);
  vi.mocked(Math.random).mockRestore();
}

// ── what the files say ───────────────────────────────────────────

const front = (text: string): string => (text.includes('{{') ? 'cloze' : text.split(/\s:::?\s/)[0]!.trim());
const cardLine = (path: string, text: string, key: string) => `card|${path}|${front(text)}|${key}`;
const lineOf = (i: CardItem): string => cardLine(i.path, i.text, i.dir === 'r' ? 'r' : i.group && 'n' in i.group && i.groups > 1 ? `c${i.group.n}` : '');
const itemId = (i: QueueItem): string => (i.kind === 'card' ? lineOf(i) : i.kind === 'section' ? `section|${i.path}|${i.heading}` : `${i.kind}|${i.path}`);

interface Snap {
  /** Each schedule line, by what it is of: its attributes as JSON; none, a line not there. */
  lines: Map<string, string>;
  /** Each card's text, by its front; a front held twice is in `twice`. */
  texts: Map<string, string>;
  twice: string[];
  /** The reviews in effect, each `line g at`, and how many readings. */
  reviews: string[];
  readings: number;
  docs: [string, Doc][];
  log: Review[];
  /** The log's review lines as written. */
  raw: Review[];
}

async function snap(d: Device): Promise<Snap> {
  const out: Snap = { lines: new Map(), texts: new Map(), twice: [], reviews: [], readings: 0, docs: [], log: [], raw: [] };
  const ids = new Map<string, { path: string; text: string }>();
  const logs: string[] = [];
  for (const [path, text] of await filesOf(d)) {
    if (!path.endsWith('.md')) { logs.push(text); continue; }
    const { doc } = parse(text);
    out.docs.push([path, doc]);
    for (const e of doc.frontmatter?.entries ?? []) {
      const f = e as { key?: string; value?: unknown };
      if (f.key === 'read' || f.key === 'write') out.lines.set(`${f.key}|${path}`, JSON.stringify(f.value));
    }
    for (const b of doc.blocks) {
      if (b.kind === 'heading' && b.read) out.lines.set(`section|${path}|${b.text}`, JSON.stringify(b.read));
      if (b.kind !== 'card') continue;
      const k = `${path}|${front(b.text)}`;
      if (out.texts.has(k)) out.twice.push(k);
      out.texts.set(k, b.text);
      if (b.id !== undefined) ids.set(b.id, { path, text: b.text });
      if (b.sched) out.lines.set(cardLine(path, b.text, ''), JSON.stringify(b.sched));
      if (b.reverse) out.lines.set(cardLine(path, b.text, 'r'), JSON.stringify(b.reverse));
      for (const [n, s] of Object.entries(b.blanks ?? {})) out.lines.set(cardLine(path, b.text, `c${n}`), JSON.stringify(s));
    }
  }
  const all = logs.flatMap((t) => parseLog(t));
  out.raw = all.filter((l): l is Review => 'card' in l);
  out.log = mergeReviews([out.raw]);
  out.readings = mergeReadings([all.filter((l) => !('card' in l)) as never]).length;
  out.reviews = out.log.map((r) => { const c = ids.get(r.card); return `${c ? cardLine(c.path, c.text, r.key ?? '') : `?${r.card}`} g${r.g} ${r.at}`; }).sort();
  return out;
}

const sched = (s: Snap, id: string): CardSchedule | undefined => { const v = s.lines.get(id); return v === undefined ? undefined : JSON.parse(v) as CardSchedule; };
const inSteps = (s: CardSchedule | undefined): boolean => !!s?.due && s.due.length > 10 && !s.suspended;

/** The queue made afresh from a device's files at `now`: every element's id, in the queue's order, and whether it is due. */
function freshQueue(s: Snap, now: Date): { id: string; due: boolean; fresh: boolean; item: QueueItem }[] {
  const metas = new Map<string, Meta>(s.docs.map(([p, d]) => [p, metaOf(d)]));
  const optionsOf = (p: string) => resolveOptions(p, (x) => metas.get(x));
  const items: QueueItem[] = [];
  for (const [p, d] of s.docs) items.push(...docItems(p, d, now));
  const q = meterQueue(items, now, { optionsOf, spent: spentToday(s.log, now, optionsOf) });
  return q.map((i) => ({ id: itemId(i), due: isDue(i, now), fresh: i.kind === 'card' ? !i.sched?.reps : !i.sched.reps, item: i }));
}

// ── the events ───────────────────────────────────────────────────

type G = 1 | 2 | 3 | 4;
type Act = 'on' | 'postpone' | 'done';
type Ev = (
  | { t: 'today' | 'enter' | 'reveal' | 'gotit' | 'next' | 'prev' | 'suspend' | 'edit' | 'pass' | 'undo' | 'out' | 'opendoc' | 'closetab' | 'tosession' | 'background' | 'restart' | 'switch' | 'sync' | 'wait' }
  | { t: 'row'; k: number }
  | { t: 'rowact'; k: number; a: Act }
  | { t: 'deck'; cram: boolean }
  | { t: 'grade' | 'gradekey'; g: G }
  | { t: 'act'; a: Act }
  | { t: 'clock'; ms: number }
) & { fast?: true };

const say = (e: Ev): string => {
  const more = 'k' in e ? ` ${e.k}${'a' in e ? ` ${e.a}` : ''}` : 'g' in e ? ` ${e.g}` : 'a' in e ? ` ${e.a}` : 'cram' in e ? (e.cram ? ' cram' : '') : 'ms' in e ? ` ${e.ms >= 3_600_000 ? `${e.ms / 3_600_000}h` : `${e.ms / 60_000}m`}` : '';
  return `${e.fast ? 'fast ' : ''}${e.t}${more}`;
};

const q = <T extends HTMLElement = HTMLElement>(sel: string) => host.querySelector<T>(sel);
const click = (el: HTMLElement) => act(async () => { el.click(); });
const key = (k: string, more: KeyboardEventInit = {}) => act(async () => { window.dispatchEvent(new KeyboardEvent('keydown', { key: k, bubbles: true, cancelable: true, ...more })); });

interface View {
  tab: string | undefined;
  kind: 'queue' | 'card' | 'doc' | 'end' | 'other';
  /** The session, by this run of the app and its number; where it is; the element up. */
  sid: string | null;
  idx: number;
  item: QueueItem | undefined;
  learn: boolean;
  revealed: boolean;
  count: [number, number] | null;
}

/** Counts each opening of the app: a session's number starts again with each. */
let run = 0;

function view(): View {
  const st = useApp.getState();
  const tab = activeTab(st.panes)?.id;
  const s = st.session;
  let idx = s?.at ?? 0;
  while (s && idx < s.items.length && s.marks?.dropped.has(idx)) idx++;
  const out: View = { tab, kind: 'other', sid: s ? `${run}:${s.seq}` : null, idx, item: s?.items[idx], learn: false, revealed: false, count: null };
  if (tab === TODAY) out.kind = 'queue';
  else if (tab === SESSION) {
    if (q('.session-end')) out.kind = 'end';
    else if (q('.doc-session')) out.kind = 'doc';
    else if (q('.recall-wrap')) out.kind = 'card';
    out.learn = !!q('.grades[data-learn="1"]');
    out.revealed = q('.recall-wrap .card')?.dataset.revealed === '1';
    const c = /^(\d+) \/ (\d+)$/.exec(q('.sess-count, .sb-count')?.textContent ?? '');
    if (c) out.count = [Number(c[1]), Number(c[2])];
  }
  return out;
}

/** What an event may change, and must. */
interface Expect {
  ev: string;
  /** The lines it may change (`text|<path>|<front>`: a card's text). */
  allow: string[];
  /** How many reviews and readings more the log may hold after it, least and most. */
  reviews?: [number, number];
  readings?: [number, number];
  must?(before: Snap, after: Snap): string | null;
}

/** What the test keeps of what was done, beside the app. */
interface Oracle {
  /** Cards got, by line: the session and the element it was got at, and the devices that have heard (the one it was got on; after a sync, both). */
  ack: Map<string, { at: Map<string, { sid: string; idx: number }>; knows: Set<string> }>;
  /** Askings graded, by session and element. */
  graded: Map<string, string>;
  /** Topics acted on, by session and element. */
  acted: Set<string>;
  /** What the notice's undo would put back: the lines, as they were; and the asking it frees. */
  undo: { ids: string[]; was: Map<string, string | undefined>; ask?: string } | null;
  /** Each session's total as last seen, and how many grades were given since. */
  totals: Map<string, number>;
  grades: number;
  /** Sessions in which something was stepped past, suspended, reworded, or synced under: their end is not held to `steps`. */
  loose: Set<string>;
  /** The session begun by the last event, and how. */
  begun: { sid: string; how: 'enter' | 'row' | 'deck' | 'cram' } | null;
}

const newOracle = (): Oracle => ({ ack: new Map(), graded: new Map(), acted: new Set(), undo: null, totals: new Map(), grades: 0, loose: new Set(), begun: null });

const cardLines = (s: Snap, path: string, text: string): string[] => ['', 'r', 'c1', 'c2'].map((k) => cardLine(path, text, k));
const textId = (path: string, text: string) => `text|${path}|${front(text)}`;

/**
 * Fire `e` on the app as it stands. False when there is nothing for it to
 * act on (it is passed over); else what it may change is added to `exp`.
 */
async function fire(e: Ev, o: Oracle, before: Snap, exp: Expect[]): Promise<boolean> {
  const v = view();
  const st = useApp.getState();
  const phone = cur.shape === 'phone';
  const none = (): true => { exp.push({ ev: say(e), allow: [] }); return true; };
  const begin = (how: NonNullable<Oracle['begun']>['how']) => { const s = useApp.getState().session; if (s && `${run}:${s.seq}` !== v.sid) o.begun = { sid: `${run}:${s.seq}`, how }; };
  switch (e.t) {
    case 'today': await act(async () => { openNode(TODAY); }); return none();
    case 'enter': {
      const b = phone ? q<HTMLButtonElement>('.pb-day') : q<HTMLButtonElement>('.enter-queue');
      if (!b) return false;
      await click(b);
      begin('enter');
      return none();
    }
    case 'row': {
      if (v.kind !== 'queue') return false;
      const rows = host.querySelectorAll<HTMLElement>('.qlist > li:not(.fold)');
      if (!rows.length) return false;
      await click(rows[e.k % rows.length]!);
      begin('row');
      return none();
    }
    case 'rowact': {
      if (v.kind !== 'queue') return false;
      const rows = Array.from(host.querySelectorAll<HTMLElement>('.qlist > li:not(.fold)')).filter((li) => li.querySelector(`[data-act="${e.a}"]`));
      if (!rows.length) return false;
      const due = freshQueue(before, new Date(clock.t)).filter((x) => x.due && x.item.kind !== 'card');
      const li = rows[e.k % rows.length]!;
      const it = due[e.k % rows.length];
      if (!it || rows.length !== due.length) return false;
      await click(li.querySelector<HTMLElement>(`[data-act="${e.a}"]`)!);
      const was = before.lines.get(it.id);
      o.undo = { ids: [it.id], was: new Map([[it.id, was]]) };
      exp.push({ ev: say(e), allow: [it.id], readings: [1, 1], must: (_, a) => (a.lines.get(it.id) === was ? `${it.id} is as it was` : null) });
      return true;
    }
    case 'deck': {
      let n = 0;
      await act(async () => { n = studyDeck(DECK, e.cram ? { cram: true } : {}); });
      if (!n) return none();
      begin(e.cram ? 'cram' : 'deck');
      return none();
    }
    case 'reveal': {
      if (v.kind !== 'card' || v.revealed) return false;
      const b = q<HTMLButtonElement>('.reveal-all') ?? q<HTMLButtonElement>('.face-hint');
      if (!b) return false;
      await click(b);
      return none();
    }
    case 'gotit': {
      const b = q<HTMLButtonElement>('.grades [data-act="learnt"]');
      if (v.kind !== 'card' || !b || v.item?.kind !== 'card') return false;
      const line = lineOf(v.item);
      await click(b);
      const got = o.ack.get(line) ?? { at: new Map<string, { sid: string; idx: number }>(), knows: new Set<string>() };
      o.ack.set(line, got);
      got.knows.add(cur.name);
      if (!got.at.has(cur.name)) got.at.set(cur.name, { sid: v.sid!, idx: v.idx });
      exp.push({ ev: say(e), allow: [line, textId(v.item.path, v.item.text)], must: (b, a) => ((sched(a, line)?.reps ?? 0) !== (sched(b, line)?.reps ?? 0) ? `${line} was graded by got it` : null) });
      return true;
    }
    case 'grade': case 'gradekey': {
      if (v.kind !== 'card' || v.item?.kind !== 'card') return false;
      const item = v.item;
      const line = lineOf(item);
      const ask = `${v.sid}:${v.idx}`;
      if (e.t === 'gradekey') {
        // the key grades a card up to learn at once; on any other it is the button's
        if (!v.learn || q('.grades[data-gone]')) return false;
        await key(String(e.g));
      } else {
        if (v.learn) return false;
        if (!v.revealed && !q('.reveal-all') && !q('.face-hint')) return false;
        if (!v.revealed) await click((q<HTMLButtonElement>('.reveal-all') ?? q<HTMLButtonElement>('.face-hint'))!);
        const b = q<HTMLButtonElement>(`.grades button[data-grade="${e.g}"]`);
        // (the answer is up now, with no grade to give: a card suspended, or asked again since)
        if (!b) return none();
        await click(b);
      }
      const first = !o.graded.has(ask);
      o.graded.set(ask, line);
      o.grades++;
      const at = iso(clock.t);
      const was = sched(before, line);
      exp.push({
        ev: say(e), allow: [line, textId(item.path, item.text)], reviews: first ? [1, 1] : [0, 1],
        must: (_, a) => {
          const now = sched(a, line);
          if (!now) return `${line}: no line after the grade`;
          if (now.grade !== e.g || now.last !== at) return `${line}: graded ${e.g} at ${at}, the line says g=${now.grade} last=${now.last}`;
          const reps = (was?.reps ?? 0) + 1;
          if (first ? now.reps !== reps : now.reps !== reps && now.reps !== reps - 1) return `${line}: ${was?.reps ?? 0} reviews before the grade, ${now.reps} after`;
          return null;
        },
      });
      return true;
    }
    case 'next': case 'prev': {
      if (v.kind !== 'card' && v.kind !== 'doc') return false;
      const b = host.querySelectorAll<HTMLButtonElement>('.sess-nav .sn-btn:not(.sn-out)')[e.t === 'prev' ? 0 : 1];
      if (!b || b.disabled) return false;
      await click(b);
      if (v.sid) o.loose.add(v.sid);
      return none();
    }
    case 'suspend': {
      if (v.kind !== 'card' || v.item?.kind !== 'card' || q('.grades[data-gone]:not([data-suspended])')) return false;
      const item = v.item;
      await key('s');
      if (v.sid) o.loose.add(v.sid);
      const ids = cardLines(before, item.path, item.text);
      o.undo = { ids, was: new Map(ids.map((id) => [id, before.lines.get(id)])) };
      exp.push({ ev: say(e), allow: [...ids, textId(item.path, item.text)] });
      return true;
    }
    case 'edit': {
      // a card reworded from outside the session (its deck, the inspector): `n2`'s answer a character longer
      const vault = currentVault();
      if (!vault) return false;
      const doc = (await vault.read(DECK)).doc;
      const at = doc.blocks.findIndex((b) => b.kind === 'card' && front(b.text) === 'n2');
      const card = doc.blocks[at] as Card | undefined;
      if (!card) return false;
      await act(async () => { await saveCardEdit({ path: DECK, block: at, text: card.text, ...(card.id !== undefined ? { id: card.id } : {}) }, `${card.text}+`, null); });
      for (const sid of o.totals.keys()) o.loose.add(sid);
      if (v.sid) o.loose.add(v.sid);
      exp.push({ ev: say(e), allow: [textId(DECK, card.text)] });
      return true;
    }
    case 'act': {
      if (v.kind !== 'doc' || !v.item || v.item.kind === 'card') return false;
      const b = q<HTMLButtonElement>(`.session-bar [data-act="${e.a}"]`);
      if (!b) return false;
      const id = itemId(v.item);
      const ask = `${v.sid}:${v.idx}`;
      const was = before.lines.get(id);
      // an element the files no longer hold as due (a sync took it on, or away, under the session): what the action finds is not what it shows
      const live = freshQueue(before, new Date(clock.t)).some((x) => x.id === id && x.due);
      const done = o.acted.has(ask);
      await click(b);
      o.acted.add(ask);
      if (e.a !== 'on' && !done) o.undo = { ids: [id], was: new Map([[id, was]]), ask };
      if (done) return none();
      exp.push({ ev: say(e), allow: [id], readings: live ? [1, 1] : [0, 1], ...(live ? { must: (_: Snap, a: Snap) => (a.lines.get(id) === was ? `${id} is as it was` : null) } : {}) });
      return true;
    }
    case 'pass': {
      const b = q<HTMLButtonElement>('.session-bar [data-act="pass"], .grades [data-act="pass"], .grades [data-act="skip"]');
      if (!b) return false;
      await click(b);
      if (v.sid && v.kind === 'card') o.loose.add(v.sid);
      return none();
    }
    case 'undo': {
      const b = Array.from(host.querySelectorAll<HTMLButtonElement>('.notice .na')).find((x) => x.textContent === 'undo');
      if (!b || !o.undo) return false;
      const u = o.undo;
      await click(b);
      o.undo = null;
      if (u.ask) o.acted.delete(u.ask);
      exp.push({ ev: say(e), allow: u.ids, readings: [-1, 0], must: (_, a) => { const bad = u.ids.find((id) => a.lines.get(id) !== u.was.get(id)); return bad ? `${bad} is not as it was before what was undone` : null; } });
      return true;
    }
    case 'out': {
      const b = q<HTMLButtonElement>('.sess-nav .sn-out');
      if (!b) return false;
      await click(b);
      return none();
    }
    case 'opendoc': await act(async () => { openNode(SRC); }); return none();
    case 'closetab': {
      if (phone || v.tab !== SESSION) return false;
      const p = st.panes;
      await act(async () => { closeTabs((x) => closeTab(x, p.active, p.panes[p.active]!.active)); });
      return none();
    }
    case 'tosession': {
      if (phone || v.tab === SESSION || !st.panes.panes.some((p) => p.tabs.some((t) => t.id === SESSION))) return false;
      await act(async () => { openNode(SESSION); });
      return none();
    }
    case 'background': {
      const vis = (s: string) => { Object.defineProperty(document, 'visibilityState', { value: s, configurable: true }); document.dispatchEvent(new Event('visibilitychange')); };
      await act(async () => { vis('hidden'); });
      await flush(0);
      await act(async () => { vis('visible'); window.dispatchEvent(new Event('focus')); });
      return none();
    }
    case 'restart': case 'switch': {
      const to = e.t === 'switch' ? devices.find((d) => d !== cur)! : cur;
      await closeApp();
      run++;
      await openApp(to);
      return none();
    }
    case 'sync': return true;
    case 'clock': {
      // the time passes with the app open: its timers run
      await pass(e.ms);
      return none();
    }
    case 'wait': await pass(2000); return none();
  }
}

/**
 * Which of two versions of one schedule line a merge keeps: the later review, then the later due; either when neither
 * says, or when one side took the line away (a dismissal, which has no instant of its own: the files' way keeps the
 * line that changed, the collections' way the later write).
 */
function laterOf(a: string | undefined, b: string | undefined): (string | undefined)[] {
  if (a === undefined || b === undefined) return [a, b];
  const at = (v: string | undefined, k: 'last' | 'due'): string | null => { const s = v === undefined ? undefined : (JSON.parse(v) as Record<string, unknown>)[k]; return typeof s === 'string' ? (s.length === 10 ? `${s}T00:00:00Z` : s) : null; };
  for (const k of ['last', 'due'] as const) {
    const [x, y] = [at(a, k), at(b, k)];
    if (x !== null && y !== null && x !== y) return [x > y ? a : b];
    if (x !== null && y === null) return [a];
    if (x === null && y !== null) return [b];
  }
  return [a, b];
}

async function sync(): Promise<void> {
  const [a, b] = devices;
  if (way === 'crdt') {
    for (let i = 0; i < 6; i++) {
      let moved = 0;
      for (const d of [a, b]) { await act(async () => { const r = await d.eng!.sync(storage); moved += r.read + r.wrote + r.took; }); }
      await flush();
      if (!moved) break;
    }
  } else {
    // as a pull does it: this device's files against the other's, from what both held last
    const [ours, theirs] = [await filesOf(cur), await filesOf(devices.find((d) => d !== cur)!)];
    const changed: string[] = [];
    for (const path of new Set([...ours.keys(), ...theirs.keys()])) {
      const m = mergeFile(path, { base: base.get(path) ?? null, ours: ours.get(path) ?? null, theirs: theirs.get(path) ?? null });
      const text = m.action === 'write' ? m.text : ours.get(path) ?? theirs.get(path)!;
      for (const d of devices) {
        if ((d === cur ? ours : theirs).get(path) === text) continue;
        const dir = path.lastIndexOf('/');
        await act(async () => {
          if (dir > 0) await d.fs.mkdir(join(ROOT, path.slice(0, dir)));
          await d.fs.writeText(join(ROOT, path), text);
        });
        if (d === cur) changed.push(path);
      }
    }
    if (changed.length) await act(async () => { await currentVault()?.changed(changed); });
    base = await filesOf(cur);
  }
  await flush(600);
}

// ── what must hold ───────────────────────────────────────────────

/** `MODEL_SKIP=walk,clock`: findings not looked for, to see past them. */
const SKIP = new Set((process.env.MODEL_SKIP ?? '').split(',').filter(Boolean));

class Broken extends Error {
  constructor(readonly what: string, detail: string) { super(`${what}: ${detail}`); }
}
/** Throw it, unless it is one not looked for. */
const broken = (what: string, detail: string): void => { if (!SKIP.has(what)) throw new Broken(what, detail); };

function frame(o: Oracle, exp: Expect[], before: Snap, after: Snap, other: [Snap, Snap]): void {
  const allow = new Set(exp.flatMap((x) => x.allow));
  const evs = exp.map((x) => x.ev).join(', ');
  for (const id of new Set([...before.lines.keys(), ...after.lines.keys()])) {
    if (before.lines.get(id) !== after.lines.get(id) && !allow.has(id)) broken('frame', `${evs} changed ${id}: ${before.lines.get(id) ?? '(none)'} → ${after.lines.get(id) ?? '(none)'}`);
  }
  for (const k of new Set([...before.texts.keys(), ...after.texts.keys()])) {
    if (before.texts.get(k)?.replace(/ \^\S+$/, '') !== after.texts.get(k)?.replace(/ \^\S+$/, '') && !allow.has(`text|${k}`)) broken('frame', `${evs} changed the card ${k}: ${before.texts.get(k)} → ${after.texts.get(k)}`);
  }
  if (after.twice.length) broken('frame', `${evs} left a card twice: ${after.twice.join(', ')}`);
  const span = (k: 'reviews' | 'readings'): [number, number] => exp.reduce<[number, number]>((s, x) => [s[0] + (x[k]?.[0] ?? 0), s[1] + (x[k]?.[1] ?? 0)], [0, 0]);
  const dr = after.reviews.length - before.reviews.length;
  const [r0, r1] = span('reviews');
  if (dr < r0 || dr > r1) broken('frame', `${evs}: ${dr} reviews more in the log, for ${r0}${r1 !== r0 ? ` to ${r1}` : ''}; now ${after.reviews.join(' · ')}`);
  const dn = after.readings - before.readings;
  const [n0, n1] = span('readings');
  if (dn < n0 || dn > n1) broken('frame', `${evs}: ${dn} readings more in the log, for ${n0}${n1 !== n0 ? ` to ${n1}` : ''}`);
  for (const x of exp) { const bad = x.must?.(before, after); if (bad) broken('frame', `${x.ev}: ${bad}`); }
  if (JSON.stringify([...other[0].lines]) !== JSON.stringify([...other[1].lines]) || other[0].reviews.join() !== other[1].reviews.join()) broken('frame', `${evs} changed the other device`);
}

function synced(a0: Snap, b0: Snap, was: Map<string, string>, a: Snap, b: Snap): void {
  const bs: Snap = { lines: new Map(), texts: new Map(), twice: [], reviews: [], readings: 0, docs: [], log: [], raw: [] };
  for (const [path, text] of was) {
    if (!path.endsWith('.md')) continue;
    const { doc } = parse(text);
    for (const e of doc.frontmatter?.entries ?? []) { const f = e as { key?: string; value?: unknown }; if (f.key === 'read' || f.key === 'write') bs.lines.set(`${f.key}|${path}`, JSON.stringify(f.value)); }
    for (const blk of doc.blocks) {
      if (blk.kind === 'heading' && blk.read) bs.lines.set(`section|${path}|${blk.text}`, JSON.stringify(blk.read));
      if (blk.kind !== 'card') continue;
      if (blk.sched) bs.lines.set(cardLine(path, blk.text, ''), JSON.stringify(blk.sched));
      if (blk.reverse) bs.lines.set(cardLine(path, blk.text, 'r'), JSON.stringify(blk.reverse));
      for (const [n, s] of Object.entries(blk.blanks ?? {})) bs.lines.set(cardLine(path, blk.text, `c${n}`), JSON.stringify(s));
    }
  }
  if (a.twice.length || b.twice.length) broken('sync', `a card is there twice after the sync: ${[...a.twice, ...b.twice].join(', ')}`);
  for (const id of new Set([...a0.lines.keys(), ...b0.lines.keys(), ...a.lines.keys(), ...b.lines.keys()])) {
    const [x, y, z] = [a0.lines.get(id), b0.lines.get(id), bs.lines.get(id)];
    if (a.lines.get(id) !== b.lines.get(id)) broken('sync', `${id} differs after the sync: ${a.lines.get(id) ?? '(none)'} on A, ${b.lines.get(id) ?? '(none)'} on B`);
    // of two that changed it: a card's line the later review; a topic's the later due by the files' way, the later write by the collections'
    const want = x === y ? [x] : x === z ? [y] : y === z ? [x] : way === 'crdt' && !id.startsWith('card|') ? [x, y] : laterOf(x, y);
    if (!want.includes(a.lines.get(id))) broken('sync', `${id}: A had ${x ?? '(none)'}, B had ${y ?? '(none)'}, both had ${z ?? '(none)'}; after the sync ${a.lines.get(id) ?? '(none)'}`);
  }
  for (const k of new Set([...a.texts.keys(), ...b.texts.keys(), ...a0.texts.keys(), ...b0.texts.keys()])) {
    if (!a.texts.has(k) || !b.texts.has(k)) broken('sync', `the card ${k} is gone after the sync`);
  }
  // the log is the union of the two, a grade given again in the place of the one it replaces
  const union = mergeReviews([a0.raw, b0.raw]).map((r) => `${r.at} ${r.card} ${r.key ?? ''} ${r.g}`).sort().join('\n');
  for (const [n, s] of [['A', a], ['B', b]] as const) {
    if (s.log.map((r) => `${r.at} ${r.card} ${r.key ?? ''} ${r.g}`).sort().join('\n') !== union) broken('sync', `${n}'s log after the sync is not the two logs together: ${s.reviews.join(' · ')}; they held ${union.replace(/\n/g, ' · ')}`);
  }
}

function check(o: Oracle, v: View, s: Snap, evs: string): void {
  const now = new Date(clock.t);
  if (errors.length) broken('threw', `${evs}: ${errors.join(' ‖ ')}`);
  const notice = useApp.getState().notice?.line ?? '';
  if (/^could not|failed/.test(notice)) broken('threw', `${evs}: the notice says ${notice}`);

  // a card got, or reviewed, is not up to learn
  if (v.learn && v.item?.kind === 'card') {
    const line = lineOf(v.item);
    const got = o.ack.get(line);
    const here = got?.at.get(cur.name);
    if (got && got.knows.has(cur.name) && !(here && here.sid === v.sid && here.idx === v.idx)) broken('learn', `${line} was got (on ${[...got.at.keys()].join(' and ')}) and is up to learn again on ${cur.name} (${cur.shape}), session ${v.sid}, element ${v.idx}`);
    if (sched(s, line)?.reps) broken('learn', `${line} has ${sched(s, line)!.reps} reviews and is up to learn`);
  }

  // the queue held is the queue made afresh from the files, as of when it was made; and nothing has come due, or
  // gone to another day, since: the app looks again when it does (`clock`)
  const builtAt = useApp.getState().queueAt ?? now;
  const held = useApp.getState().queue;
  const words = (list: { id: string; due: boolean }[]) => list.map((x) => `${x.id}${x.due ? ' due' : ''}`);
  const mine = words(held.map((i) => ({ id: itemId(i), due: isDue(i, builtAt) })));
  const then = words(freshQueue(s, builtAt));
  const dueOf = (w: string[]) => w.filter((x) => x.endsWith(' due'));
  if (dueOf(mine).join('\n') !== dueOf(then).join('\n') || [...mine].sort().join('\n') !== [...then].sort().join('\n')) {
    broken('queue', `${evs}: the app holds [${dueOf(mine).join(', ')}] due of ${mine.length}; the files make [${dueOf(then).join(', ')}] of ${then.length}`);
  }
  const fresh = freshQueue(s, now);
  const due = fresh.filter((x) => x.due);
  const stale = dueOf(words(fresh)).join('\n') !== dueOf(then).join('\n');
  if (stale) broken('clock', `${evs}: the queue was made at ${builtAt.toTimeString().slice(0, 8)} and it is ${now.toTimeString().slice(0, 8)} on ${now.toDateString().slice(0, 10)}: it holds [${dueOf(then).join(', ')}] due, and due now are [${dueOf(words(fresh)).join(', ')}]`);

  // every count shown is that queue's
  const said: string[] = [];
  const top = /(\d+) due/.exec(q('.top')?.textContent ?? '');
  if (top && Number(top[1]) !== due.length) said.push(`the strip ${top[1]}`);
  const bar = q('.pb-day');
  if (bar && Number(bar.querySelector('.pb-n')?.textContent ?? 0) !== due.length) said.push(`the bar ${bar.textContent}`);
  if (v.kind === 'queue' && q('.queue')) {
    const legend = q('.legend b')?.textContent;
    if (legend !== undefined && Number(legend) !== due.length) said.push(`the legend ${legend}`);
    const rows = Array.from(host.querySelectorAll<HTMLElement>('.qlist > li:not(.fold)'));
    if (rows.length !== due.length) said.push(`${rows.length} rows`);
    else if (rows.map((r) => `${r.dataset.el}${r.dataset.fresh}`).join() !== due.map((x) => `${x.item.kind}${x.fresh ? 1 : 0}`).join()) said.push(`the rows ${rows.map((r) => `${r.dataset.el}${r.dataset.fresh === '1' ? ' new' : ''}`).join(',')}`);
  }
  if (said.length && !stale) broken('counts', `${evs}: ${due.length} due (${due.filter((x) => x.fresh).length} new) by the files; ${said.join('; ')}`);

  // a session begun walks what is due, nothing twice, and the cards in their steps due later today
  const sess = useApp.getState().session;
  if (o.begun && sess && o.begun.sid === v.sid) {
    const ids = sess.items.map(itemId);
    const twice = ids.find((id, i) => ids.indexOf(id) !== i);
    if (twice) broken('walk', `${evs}: the session begun holds ${twice} twice: ${ids.join(', ')}`);
    if (o.begun.how !== 'cram') {
      const tomorrow = new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1);
      const ahead = fresh.filter((x) => !x.due && x.item.kind === 'card' && inSteps(x.item.sched) && x.item.dueAt < tomorrow);
      const ok = new Set([...due, ...ahead].map((x) => x.id));
      const stray = ids.find((id) => !ok.has(id));
      if (stray && ids.length > 1) broken('walk', `${evs}: the session begun asks ${stray}, which is not due: ${ids.join(', ')}`);
      if (o.begun.how === 'enter') {
        const missed = due.map((x) => x.id).filter((id) => !ids.includes(id));
        if (missed.length) broken('walk', `${evs}: entering the queue walks [${ids.join(', ')}] and not ${missed.join(', ')}, which ${missed.length > 1 ? 'are' : 'is'} due`);
        const later = ahead.map((x) => x.id).filter((id) => !ids.includes(id));
        if (later.length) broken('ahead', `${evs}: ${later.join(', ')} ${later.length > 1 ? 'are' : 'is'} in ${later.length > 1 ? 'their' : 'its'} steps, due later today (${ahead.map((x) => x.item.due).join(', ')}), and the session begun does not ask ${later.length > 1 ? 'them' : 'it'}: [${ids.join(', ')}]`);
      }
    }
  }
  o.begun = null;

  // the counter
  if (v.count) {
    const [n, total] = v.count;
    if (n > total) broken('counter', `${evs}: the session says ${n} / ${total}`);
    const was = v.sid ? o.totals.get(v.sid) : undefined;
    if (was !== undefined && total > was + o.grades) broken('counter', `${evs}: the session's total went from ${was} to ${total} with ${o.grades} graded since`);
    if (v.sid) o.totals.set(v.sid, total);
  }
  o.grades = 0;

  // a topic acted on in this session, come back to, is shown done
  if (v.kind === 'doc' && o.acted.has(`${v.sid}:${v.idx}`) && !q('.session-bar .sb-done')) broken('acted', `${evs}: ${v.item ? itemId(v.item) : ''} was acted on in this session and is offered again`);

  // the end of a session walked straight through leaves nothing it graded in its steps
  if (v.kind === 'end' && v.sid && !o.loose.has(v.sid) && !sess?.cram) {
    for (const [ask, line] of o.graded) {
      if (!ask.startsWith(`${v.sid}:`)) continue;
      if (inSteps(sched(s, line))) broken('steps', `${evs}: the session is at its end and ${line}, graded in it, is in its steps (due ${sched(s, line)!.due})`);
    }
  }
}

// ── a run ────────────────────────────────────────────────────────

const QUICK = new Set<Ev['t']>(['next', 'prev', 'reveal', 'pass', 'gotit', 'undo']);
const LEAVES = new Set<Ev['t']>(['today', 'out', 'opendoc', 'closetab', 'background', 'restart', 'switch']);
const WRITES = new Set<Ev['t']>(['grade', 'gradekey', 'gotit', 'act', 'suspend']);

/** The next event for a generated run: by where the app is, mostly what a person would do there. */
function pick(rnd: () => number, v: View, last: Ev | null): Ev {
  const phone = cur.shape === 'phone';
  const g = (): G => ([3, 3, 3, 1, 1, 2, 4] as G[])[Math.floor(rnd() * 7)]!;
  const a = (): Act => (['on', 'on', 'postpone', 'done'] as Act[])[Math.floor(rnd() * 4)]!;
  const k = () => Math.floor(rnd() * 12);
  const bag: [number, () => Ev][] = [
    [0.6, () => ({ t: 'restart' })], [0.7, () => ({ t: 'switch' })], [0.8, () => ({ t: 'sync' })], [0.5, () => ({ t: 'background' })],
    [0.5, () => ({ t: 'clock', ms: ([2, 11, 30] as number[])[Math.floor(rnd() * 3)]! * 60_000 })], [0.25, () => ({ t: 'clock', ms: 16 * 3_600_000 })],
    [0.3, () => ({ t: 'wait' })], [0.4, () => ({ t: 'undo' })], [0.2, () => ({ t: 'edit' })], [0.3, () => ({ t: 'opendoc' })],
  ];
  if (v.kind === 'queue') bag.push([6, () => ({ t: 'enter' })], [2, () => ({ t: 'row', k: k() })], [phone ? 2 : 0, () => ({ t: 'rowact', k: k(), a: a() })], [0.8, () => ({ t: 'deck', cram: false })], [0.3, () => ({ t: 'deck', cram: true })]);
  else if (v.kind === 'card') {
    bag.push([v.learn ? 8 : 0, () => ({ t: 'gotit' })], [v.learn ? 1.5 : 0, () => ({ t: 'gradekey', g: g() })], [v.learn ? 0 : 9, () => ({ t: 'grade', g: g() })], [v.revealed ? 0 : 1, () => ({ t: 'reveal' })]);
    bag.push([0.8, () => ({ t: 'next' })], [1, () => ({ t: 'prev' })], [0.4, () => ({ t: 'suspend' })], [0.6, () => ({ t: 'pass' })], [phone ? 2 : 0, () => ({ t: 'out' })], [phone ? 0 : 1, () => ({ t: 'closetab' })], [1, () => ({ t: 'today' })]);
  } else if (v.kind === 'doc') {
    bag.push([8, () => ({ t: 'act', a: a() })], [1, () => ({ t: 'pass' })], [0.8, () => ({ t: 'next' })], [1, () => ({ t: 'prev' })], [phone ? 2 : 0, () => ({ t: 'out' })], [phone ? 0 : 1, () => ({ t: 'closetab' })], [1, () => ({ t: 'today' })]);
  } else if (v.kind === 'end') bag.push([3, () => ({ t: 'wait' })], [2, () => ({ t: 'today' })], [1, () => ({ t: 'prev' })]);
  else bag.push([5, () => ({ t: 'today' })], [phone ? 3 : 0, () => ({ t: 'enter' })], [phone ? 0 : 3, () => ({ t: 'tosession' })], [0.5, () => ({ t: 'deck', cram: false })]);
  let at = rnd() * bag.reduce((s, [w]) => s + w, 0);
  let e: Ev = { t: 'wait' };
  for (const [w, make] of bag) { at -= w; if (at <= 0) { e = make(); break; } }
  // a way out taken before what was just done has been written
  if (last && WRITES.has(last.t) && LEAVES.has(e.t) && rnd() < 0.5) e.fast = true;
  return e;
}

interface Setup { shapes: [Shape, Shape]; way: Way; seed: number }

/** Play events on a fresh world: those given, or `n` picked as it goes. What broke, and the events that were not passed over. */
async function play(setup: Setup, given: readonly Ev[] | null, n = 0): Promise<{ broke: Broken | null; road: Ev[] }> {
  await world(setup.shapes, setup.way, setup.seed);
  const rnd = mulberry32(setup.seed);
  const o = newOracle();
  const road: Ev[] = [];
  let broke: Broken | null = null;
  try {
    let before = await snap(cur);
    let exp: Expect[] = [];
    let last: Ev | null = null;
    /** The device the events not yet looked at were fired on, and the other as it was before them. */
    let dev = cur;
    let otherWas = await snap(devices.find((d) => d !== cur)!);
    /** Picked already, to know whether it comes in a hurry. */
    let queued: Ev | null = null;
    check(o, view(), before, 'the start');
    /** What was fired has landed: the files and the view are looked at. */
    const look = async (): Promise<void> => {
      await flush();
      const other = devices.find((d) => d !== dev)!;
      const after = await snap(dev);
      const evs = exp.map((x) => x.ev).join(', ');
      frame(o, exp, before, after, [otherWas, await snap(other)]);
      exp = [];
      dev = cur;
      before = await snap(cur);
      otherWas = await snap(devices.find((d) => d !== cur)!);
      if (process.env.MODEL_TRACE) { const w = view(); process.stdout.write(`  ${evs} → ${cur.name} ${w.kind} ${w.sid ?? ''} #${w.idx} ${w.item ? itemId(w.item) : ''}${w.learn ? ' learn' : ''}${w.revealed ? ' revealed' : ''} ${w.count?.join('/') ?? ''} | ${host.querySelector('.grades, .session-bar .sb-actions')?.textContent ?? ''}\n`); }
      check(o, view(), before, evs);
    };
    const count = given ? given.length : n;
    for (let i = 0; i < count; i++) {
      const e: Ev = given ? given[i]! : queued ?? pick(rnd, view(), last);
      queued = null;
      if (e.t === 'sync') {
        if (exp.length) await look();
        await flush();
        const [a, b] = devices;
        const [a0, b0] = [await snap(a), await snap(b)];
        const was = base;
        await sync();
        road.push(e);
        await pass(5_000);
        for (const sid of o.totals.keys()) o.loose.add(sid);
        for (const got of o.ack.values()) { got.knows.add('A'); got.knows.add('B'); }
        const [a1, b1] = [await snap(a), await snap(b)];
        synced(a0, b0, was, a1, b1);
        if (way === 'crdt') base = await filesOf(cur);
        before = cur === a ? a1 : b1;
        otherWas = cur === a ? b1 : a1;
        last = e;
        if (process.env.MODEL_TRACE) process.stdout.write('  sync\n');
        check(o, view(), before, say(e));
        continue;
      }
      // a way out is fired on the device the event before it was; what is looked at after is that device's files
      const fired = await fire(e, o, before, exp);
      // five seconds an event; one for a step on or back, a reveal, got it: a person does those as fast as they come
      if (fired) { road.push(e); last = e; await pass(QUICK.has(e.t) ? 1_000 : 5_000); }
      if (!exp.length) continue;
      // a way out taken at once: what the event before it wrote is looked at after both
      let hurry = false;
      if (given) hurry = !!given[i + 1]?.fast;
      else if (fired && WRITES.has(e.t) && i + 1 < count) { queued = pick(rnd, view(), e); hurry = !!queued.fast; }
      if (hurry) continue;
      await look();
    }
    if (exp.length) await look();
  } catch (err) {
    broke = err instanceof Broken ? err : new Broken('threw', err instanceof Error ? `${err.message}\n${err.stack ?? ''}` : String(err));
  }
  await endWorld();
  return { broke, road };
}

/** The fewest of `road`'s events that still break the same thing. */
async function shrink(setup: Setup, road: Ev[], what: string): Promise<{ road: Ev[]; broke: Broken }> {
  let best = road;
  let found = (await play(setup, best)).broke;
  if (!found || found.what !== what) throw new Error(`the road does not break ${what} when played again: ${road.map(say).join(' · ')} (${found?.message ?? 'held'})`);
  for (let size = Math.max(1, Math.floor(best.length / 2)); size >= 1; size = Math.floor(size / 2)) {
    for (let at = 0; at + size <= best.length;) {
      const cut = [...best.slice(0, at), ...best.slice(at + size)];
      const r = await play(setup, cut);
      if (r.broke && r.broke.what === what) { best = r.road; found = r.broke; } else at += size;
    }
  }
  return { road: best, broke: found };
}

/** `MODEL_ROAD='enter · grade 3 · out'`: one road played, traced. */
const parseRoad = (text: string): Ev[] => text.split('·').map((w) => {
  const p = w.trim().split(/\s+/);
  const fast = p[0] === 'fast' ? (p.shift(), { fast: true as const }) : {};
  const t = p[0] as Ev['t'];
  if (t === 'row') return { t, k: Number(p[1]), ...fast };
  if (t === 'rowact') return { t, k: Number(p[1]), a: p[2] as Act, ...fast };
  if (t === 'deck') return { t, cram: p[1] === 'cram', ...fast };
  if (t === 'grade' || t === 'gradekey') return { t, g: Number(p[1]) as G, ...fast };
  if (t === 'act') return { t, a: p[1] as Act, ...fast };
  if (t === 'clock') return { t, ms: p[1]!.endsWith('h') ? Number(p[1]!.slice(0, -1)) * 3_600_000 : Number(p[1]!.slice(0, -1)) * 60_000, ...fast };
  return { t, ...fast } as Ev;
});
const SETUPS: [Shape, Shape, Way][] = [
  ['phone', 'ipad', 'git'], ['phone', 'ipad', 'crdt'], ['phone', 'mac', 'crdt'],
  ['ipad', 'phone', 'git'], ['ipad', 'phone', 'crdt'],
  ['mac', 'phone', 'git'], ['mac', 'phone', 'crdt'],
];
const SEEDS = Number(process.env.MODEL_SEEDS ?? 8);
const LENGTH = Number(process.env.MODEL_LEN ?? 40);
const ONLY = process.env.MODEL_SEED !== undefined ? Number(process.env.MODEL_SEED) : null;

/** A named road: what it pins, where, and the events. */
const pinned = (name: string, where: string, text: string) => it(name, async () => {
  const [a, b, how] = where.split('/') as [Shape, Shape, Way];
  const road = parseRoad(text);
  const r = await play({ shapes: [a, b], way: how, seed: 1 }, road);
  expect(r.road.map(say).join(' · '), 'every event of the road acts on something').toBe(road.map(say).join(' · '));
  expect(r.broke?.message ?? null).toBeNull();
});

describe('the queue and the session, over two devices', () => {
  beforeAll(() => {
    host = document.body.appendChild(document.createElement('div'));
    vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout', 'setInterval', 'clearInterval'] });
    // outside Tauri what asks for the window or the webview fails and is logged: not what is checked here
    vi.spyOn(console, 'error').mockImplementation((...a: unknown[]) => {
      const line = a.map((x) => (x instanceof Error ? x.message : String(x))).join(' ');
      // (and an open page's writer logs a write that did not happen, which the session answers itself: a topic dismissed on the other device under it)
      if (!/reading '(metadata|invoke|transformCallback)'|__TAURI|property 'home'|not enrolled/.test(line)) errors.push(line);
    });
  });
  afterAll(() => { vi.useRealTimers(); vi.restoreAllMocks(); host.remove(); });

  describe('what the walk found, each the fewest events to it', () => {
    pinned('control: a card up to learn graded by its key is written once and logged once', 'phone/ipad/git', 'enter · gradekey 3');
    // the report (an iPhone): a card seen for the first time, the queue left, and come back to as if never seen. `got it`
    // wrote nothing until the card's test at the session's end; then (25b65c0) it was kept for the day, on the device
    // (the next day, when the stopgap forgot: `learn-new.test.ts`, where the walk's order is the test's)
    pinned('a card got, the queue left, the app closed and opened: it is asked, not shown to learn again', 'phone/ipad/git', 'enter · gotit · fast out · restart · enter');
    pinned('a card got on the phone, synced: the iPad asks it, and does not show it to learn (the files\' way)', 'phone/ipad/git', 'enter · gotit · sync · switch · enter');
    pinned('a card got on the phone, synced: the Mac asks it, and does not show it to learn (the collections\' way)', 'phone/mac/crdt', 'enter · gotit · fast out · sync · switch · enter');
    pinned('a card got on an iPad, its tab closed at once, the app opened again: asked', 'ipad/phone/crdt', 'enter · gotit · fast closetab · restart · today · enter');
    // graded on the other device since the walk was made: the card up to learn there is asked instead, its answer down
    pinned('a card graded on one device is not up to learn on the other once a sync has said so, under its session', 'phone/ipad/crdt', 'enter · gradekey 4 · switch · enter · sync · wait');
    // a card graded into its steps (due in a minute, in ten) came back in its session only: left, the next session ended with it minutes from due
    pinned('a card in its steps, the session left: the next session asks it at its end', 'phone/ipad/git', 'enter · gradekey 1 · out · enter');
    pinned('a card in its steps, the app closed at once and opened: the next session asks it', 'mac/phone/crdt', 'enter · gradekey 3 · fast restart · enter');
    // a new card's grade given again was counted twice against the day's new cards until the queue was next made: one new card too many held for tomorrow
    pinned('a new card graded, and graded again with ‹: one of the day\'s new cards spent, not two', 'ipad/phone/git', 'enter · gradekey 1 · prev · grade 3');
    // the queue was looked at again only while the day's list was in front: the strip and the phone's bar kept yesterday's count, or missed a card come due
    pinned('past midnight in a session: the strip\'s count is the new day\'s', 'mac/phone/git', 'enter · clock 16h');
    pinned('a card comes due while a document is in front: the phone\'s bar counts it', 'phone/ipad/crdt', 'enter · gradekey 1 · fast opendoc · clock 2m');
    // a schedule line written for a card with no id by anything but a grade (a suspension) gave it none, and a collection syncs a card's lines by its id
    pinned('a new card suspended in its session is suspended on the other device', 'phone/ipad/crdt', 'deck · next · next · suspend · sync');
    // two devices each writing the first schedule line of one card before they met: each gave it an id of its own
    pinned('a new card graded on both devices before they met is one card after (the files\' way)', 'phone/ipad/git', 'deck · next · next · gradekey 3 · switch · deck · next · next · gradekey 4 · sync');
    pinned('a new card graded on both devices before they met keeps the later grade (the collections\' way)', 'phone/ipad/crdt', 'deck · next · next · gradekey 3 · switch · deck · next · next · gradekey 4 · sync');
    pinned('a new card graded here and got there, later, before they met: the grade stands', 'phone/mac/crdt', 'deck · next · next · gradekey 3 · switch · deck · next · next · gotit · sync');
    pinned('a new card graded here and got there (the files\' way)', 'mac/phone/git', 'deck · next · next · gradekey 3 · switch · deck · next · next · gotit · sync');
    pinned('the two blanks of a cloze, one got on each device: one card after', 'ipad/phone/git', 'deck · gotit · switch · deck · next · gotit · sync');
    pinned('a card got here and reworded there: one card after', 'mac/phone/git', 'deck cram · grade 3 · suspend · grade 1 · grade 4 · grade 3 · gotit · gotit · switch · edit · sync');
    // an undo put the whole file back as it was before what it takes back: anything written to the file since went with it
    pinned('later on a section, a card under it got, then undo: the card is still got', 'phone/ipad/git', 'row 5 · act postpone · next · next · gotit · undo');
    pinned('a card suspended, the next card of its deck graded, then undo: the grade stands', 'mac/phone/crdt', 'deck · next · next · suspend · grade 3 · undo');
    // a topic dismissed on the other device under a session that still shows it: its action said `dismiss failed`
    pinned('a section dismissed on the other device, acted on in a session that still has it: nothing fails', 'phone/mac/crdt', 'row 4 · grade 1 · act done · fast switch · clock 16h · enter · grade 2 · next · sync · act done');
    pinned('a section passed here and dismissed there: its heading once after', 'phone/ipad/git', 'rowact 8 postpone · clock 16h · switch · row 3 · act done · sync');
  });

  it.runIf(process.env.MODEL_ROAD)('a road from the environment', async () => {
    const [x, y, how] = (process.env.MODEL_SETUP ?? 'phone,ipad,git').split(',') as [Shape, Shape, Way];
    const r = await play({ shapes: [x, y], way: how, seed: 1 }, parseRoad(process.env.MODEL_ROAD!));
    process.stdout.write(`played: ${r.road.map(say).join(' · ')}\n${r.broke?.message ?? 'held'}\n`);
  });

  it.skipIf(process.env.MODEL_ROAD).each(SETUPS)('generated: on a %s, the other device a %s, synced by %s', async (a: Shape, b: Shape, how: Way) => {
    const found: string[] = [];
    let events = 0;
    for (let i = 0; i < SEEDS; i++) {
      const seed = ONLY ?? (i + 1) * 7919 + SETUPS.findIndex((s) => s[0] === a && s[1] === b && s[2] === how) * 104729;
      const setup: Setup = { shapes: [a, b], way: how, seed };
      const r = await play(setup, null, LENGTH);
      events += r.road.length;
      if (!r.broke) { if (ONLY !== null) break; continue; }
      const small = await shrink(setup, r.road, r.broke.what);
      found.push(`seed ${seed}, ${small.road.length} events: ${small.road.map(say).join(' · ')}\n    ${small.broke.message}`);
      if (ONLY !== null || found.length >= Number(process.env.MODEL_FINDS ?? 3)) break;
    }
    process.stdout.write(`queue-session: ${a}/${b}/${how}: ${events} events played over ${SEEDS} sequences, ${found.length} broke\n`);
    expect(found.join('\n\n')).toBe('');
  }, 1_200_000);
});
