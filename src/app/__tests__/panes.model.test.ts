// @vitest-environment jsdom
// Tabs and panes as a statechart, checked against the code by exhaustive
// exploration. Two parts:
//
// 1. `panes.ts` on its own: every state reachable from one empty pane by
//    the tab rail's, the panes', and the tree's events over a small tree
//    (a folder with a document in it, two documents at the root, their
//    `:cards/` tabs), every reachable state visited once (a state is the
//    tabs' ids and the actives, keys aside; ids never repeat, so the set
//    is finite and the search ends on its own). After every event the
//    invariants are checked, and the shape change against the chart.
// 2. The app's wiring (`vault.ts`'s `onEvent`): a collection opened as
//    the app opens one (over a store in memory), tabs open on every kind
//    of node, then every sequence of two tree operations among rename,
//    move, delete, undo of the delete, and a delete from outside: every
//    tab names a node the tree has, after each.

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cardsId, cardsPath, notesId, notesPath } from '../names.js';
import {
  MAX_PANES, activatePane, closeBeside, closePane, closeTab, dropTabs, emptyPanes, openBeside, openTab, retarget, selectTab, splitPane, type Panes,
} from '../panes.js';

// ── the statechart ────────────────────────────────────────────────

/** The panes as the chart sees them: how many, and whether the active one shows a tab. */
export type PState = `${1 | 2 | 3}:${'empty' | 'showing'}`;
export type PEvent = 'open' | 'open-new' | 'open-next' | 'beside' | 'close-beside' | 'select' | 'activate' | 'close' | 'split' | 'close-pane' | 'moved' | 'gone';

export const PANES = {
  states: ['1:empty', '1:showing', '2:empty', '2:showing', '3:empty', '3:showing'] as PState[],
  events: ['open', 'open-new', 'open-next', 'beside', 'close-beside', 'select', 'activate', 'close', 'split', 'close-pane', 'moved', 'gone'] as PEvent[],
  transitions: [
    // the tab rail and the tree: an open shows the node in the active pane (or focuses it where it is open)
    ...[1, 2, 3].flatMap((n) => [
      `${n}:empty --open--> ${n}:showing`, `${n}:showing --open--> ${n}:showing`,
      `${n}:empty --open-new--> ${n}:showing`, `${n}:showing --open-new--> ${n}:showing`,
    ]),
    // ⌘⇧-click: a new tab in the next pane, split while there are fewer than three
    '1:empty --open-next--> 2:showing', '1:showing --open-next--> 2:showing',
    '2:empty --open-next[already open]--> 2:showing', '2:empty --open-next--> 3:showing', '2:showing --open-next--> 3:showing', '2:showing --open-next[already open]--> 2:showing',
    '3:empty --open-next--> 3:showing', '3:showing --open-next--> 3:showing',
    '1:showing --open-next[already open]--> 1:showing',
    // the notes beside the pages: the active pane kept, a pane made beside when there is one
    '1:showing --beside--> 2:showing', '1:empty --beside--> 2:empty', '1:showing --beside[shown here]--> 1:showing',
    ...[2, 3].flatMap((n) => [`${n}:showing --beside--> ${n}:showing`, `${n}:empty --beside--> ${n}:empty`]),
    // closing the notes beside: their pane goes with its last tab, the active pane kept
    ...[1, 2, 3].flatMap((n) => [`${n}:showing --close-beside[not beside]--> ${n}:showing`, `${n}:empty --close-beside[not beside]--> ${n}:empty`]),
    '2:showing --close-beside[last tab of its pane]--> 1:showing', '3:showing --close-beside[last tab of its pane]--> 2:showing',
    '2:empty --close-beside[last tab of its pane]--> 1:empty', '3:empty --close-beside[last tab of its pane]--> 2:empty',
    '2:showing --close-beside--> 2:showing', '3:showing --close-beside--> 3:showing', '2:empty --close-beside--> 2:empty', '3:empty --close-beside--> 3:empty',
    // a tab or a pane picked
    ...[1, 2, 3].flatMap((n) => [`${n}:showing --select--> ${n}:showing`]),
    '2:empty --select[a tab in another pane]--> 2:showing', '3:empty --select[a tab in another pane]--> 3:showing',
    '1:showing --activate[the active one]--> 1:showing', '1:empty --activate[the active one]--> 1:empty',
    ...[2, 3].flatMap((n) => [`${n}:showing --activate--> ${n}:showing`, `${n}:showing --activate--> ${n}:empty`, `${n}:empty --activate--> ${n}:showing`, `${n}:empty --activate--> ${n}:empty`]),
    // a tab closed: a pane left empty closes with it, unless it is the last
    '1:showing --close[last tab]--> 1:empty', '1:showing --close--> 1:showing',
    '2:showing --close--> 2:showing', '2:showing --close[last tab of its pane]--> 1:showing', '2:showing --close[last tab of its pane]--> 1:empty',
    '3:showing --close--> 3:showing', '3:showing --close[last tab of its pane]--> 2:showing', '3:showing --close[last tab of its pane]--> 2:empty',
    '2:empty --close--> 2:empty', '3:empty --close--> 3:empty', '2:empty --close[last tab of its pane]--> 1:empty', '3:empty --close[last tab of its pane]--> 2:empty',
    // split: a new empty pane, active, up to three
    '1:showing --split--> 2:empty', '1:empty --split--> 2:empty', '2:showing --split--> 3:empty', '2:empty --split--> 3:empty',
    '3:showing --split[three already]--> 3:showing', '3:empty --split[three already]--> 3:empty',
    // a pane closed, never the last
    '2:showing --close-pane--> 1:showing', '2:showing --close-pane--> 1:empty', '2:empty --close-pane--> 1:showing', '2:empty --close-pane--> 1:empty',
    '3:showing --close-pane--> 2:showing', '3:showing --close-pane--> 2:empty', '3:empty --close-pane--> 2:showing', '3:empty --close-pane--> 2:empty',
    '1:showing --close-pane[the last]--> 1:showing', '1:empty --close-pane[the last]--> 1:empty',
    // a rename or a move: every tab on it, or under it, follows; nothing opens or closes
    ...[1, 2, 3].flatMap((n) => [`${n}:showing --moved--> ${n}:showing`, `${n}:empty --moved--> ${n}:empty`]),
    // a delete: every tab on it, or under it, closes as a click on its × would
    ...[1, 2, 3].flatMap((n) => [`${n}:showing --gone--> ${n}:showing`, `${n}:empty --gone--> ${n}:empty`]),
    '1:showing --gone--> 1:empty', '2:showing --gone--> 1:showing', '2:showing --gone--> 1:empty', '3:showing --gone--> 2:showing', '3:showing --gone--> 1:showing',
    '3:showing --gone--> 2:empty', '3:showing --gone--> 1:empty',
    '2:empty --gone--> 1:empty', '3:empty --gone--> 2:empty', '3:empty --gone--> 1:empty',
  ],
  invariants: [
    'one to three panes',
    'the active pane is one of them',
    'each pane\'s active tab is one of its tabs (0 when it has none)',
    'no id is open twice, no key either',
    'a close or a delete leaves no pane empty but the only one (an empty pane is made by a split, a ⌘⇧-click, or the notes beside)',
    'every tab names a node the tree has, or a lens of the app\'s own',
    'a rename or a move opens and closes nothing',
  ],
};

const chart = new Set(PANES.transitions.map((t) => t.replace(/\[[^\]]*\]/, '')));
const allowedP = (from: PState, ev: PEvent, to: PState) => chart.has(`${from} --${ev}--> ${to}`);

const shape = (s: Panes): PState => `${s.panes.length as 1 | 2 | 3}:${s.panes[s.active]?.tabs.length ? 'showing' : 'empty'}`;

// ── part 1: `panes.ts` over a small tree ──────────────────────────

/** The tree as paths: folder `f` with `f/a.md`, and `b.md` at the root. */
type Tree = readonly string[];
const TREE0: Tree = ['f', 'f/a.md', 'b.md'];

/**
 * At most three tabs open at once: enough for a tab in each of three panes, for a pane with two
 * and one beside, and for a delete or a move under a folder to reach a tab inside it and one on it;
 * more tabs only repeat those shapes in more orders.
 */
const MAX_TABS = 3;

/** The node a tab shows: its own path, or the document its cards or notes are of. */
const nodeOf = (id: string): string => cardsPath(id) ?? notesPath(id) ?? id;

interface PS { panes: Panes; tree: Tree }

type Step = { ev: PEvent; label: string; run: (s: PS) => PS };

function steps(s: PS): Step[] {
  const docs = s.tree.filter((p) => p.endsWith('.md'));
  const ids = [...s.tree, ...docs.slice(0, 1).map(cardsId), ...docs.slice(1, 2).map(notesId)];
  const out: Step[] = [];
  const ui = (ev: PEvent, label: string, f: (p: Panes) => Panes) => out.push({ ev, label, run: (x) => ({ ...x, panes: f(x.panes) }) });
  const open = new Set(s.panes.panes.flatMap((p) => p.tabs.map((t) => t.id)));
  for (const id of ids) {
    if (!open.has(id) && open.size >= MAX_TABS) continue;
    ui('open', `open ${id}`, (p) => openTab(p, id));
    ui('open-new', `⌘-click ${id}`, (p) => openTab(p, id, { cmdClick: true }));
    ui('open-next', `⌘⇧-click ${id}`, (p) => openTab(p, id, { cmdClick: true, shiftClick: true }));
    if (notesPath(id) !== null) {
      ui('beside', `beside ${id}`, (p) => openBeside(p, id));
      ui('close-beside', `close beside ${id}`, (p) => closeBeside(p, id));
    }
  }
  s.panes.panes.forEach((pane, pi) => {
    pane.tabs.forEach((_, ti) => {
      ui('select', `select ${pi}.${ti}`, (p) => selectTab(p, pi, ti));
      ui('close', `close ${pi}.${ti}`, (p) => closeTab(p, pi, ti));
    });
    ui('activate', `activate ${pi}`, (p) => activatePane(p, pi));
    ui('split', `split ${pi}`, (p) => splitPane(p, pi));
    ui('close-pane', `close pane ${pi}`, (p) => closePane(p, pi));
  });
  // the tree's events, as the vault reports them and `onEvent` takes them
  const move = (from: string, to: string): Step => ({
    ev: 'moved', label: `${from} → ${to}`,
    run: (x) => ({ panes: retarget(x.panes, from, to), tree: x.tree.map((p) => (p === from ? to : p.startsWith(`${from}/`) ? to + p.slice(from.length) : p)) }),
  });
  const del = (path: string): Step => ({
    ev: 'gone', label: `delete ${path}`,
    run: (x) => ({ panes: dropTabs(x.panes, path), tree: x.tree.filter((p) => p !== path && !p.startsWith(`${path}/`)) }),
  });
  if (s.tree.includes('f')) out.push(move('f', 'g'), del('f'));
  if (s.tree.includes('b.md')) out.push(move('b.md', s.tree.includes('f') ? 'f/b.md' : 'g/b.md'), del('b.md'));
  return out;
}

function invariants(before: PS, step: Step, after: PS): string[] {
  const s = after.panes;
  const bad: string[] = [];
  if (s.panes.length < 1 || s.panes.length > MAX_PANES) bad.push(`${s.panes.length} panes`);
  if (s.active < 0 || s.active >= s.panes.length) bad.push(`the active pane is ${s.active} of ${s.panes.length}`);
  s.panes.forEach((p, i) => {
    if (p.tabs.length ? p.active < 0 || p.active >= p.tabs.length : p.active !== 0) bad.push(`pane ${i}'s active tab is ${p.active} of ${p.tabs.length}`);
  });
  const ids = s.panes.flatMap((p) => p.tabs.map((t) => t.id));
  if (new Set(ids).size !== ids.length) bad.push(`an id open twice: ${ids.join(', ')}`);
  const keys = s.panes.flatMap((p) => p.tabs.map((t) => t.key));
  if (new Set(keys).size !== keys.length) bad.push('a key used twice');
  if (step.ev === 'close' || step.ev === 'gone' || step.ev === 'close-beside') {
    const emptyBefore = new Set(before.panes.panes.filter((p) => !p.tabs.length));
    s.panes.forEach((p, i) => {
      if (!p.tabs.length && s.panes.length > 1 && !emptyBefore.has(before.panes.panes.find((q) => q === p) ?? p) && !before.panes.panes.some((q) => !q.tabs.length)) bad.push(`pane ${i} left empty`);
    });
  }
  for (const id of ids) if (!after.tree.includes(nodeOf(id))) bad.push(`a tab on ${id}, which the tree does not have`);
  if (step.ev === 'moved' && ids.length !== before.panes.panes.flatMap((p) => p.tabs).length) bad.push('a move opened or closed a tab');
  const from = shape(before.panes);
  const to = shape(s);
  if (!allowedP(from, step.ev, to)) bad.push(`${from} --${step.ev}--> ${to} is not in the chart`);
  return bad;
}

const key = (x: PS) => JSON.stringify([x.panes.active, x.panes.panes.map((p) => [p.active, p.tabs.map((t) => t.id)]), x.tree]);

describe('tabs and panes, against their statechart', () => {
  it('every transition of the chart is between its states', () => {
    for (const t of PANES.transitions) {
      const m = /^(\S+) --([a-z-]+)(\[[^\]]*\])?--> (\S+)$/.exec(t);
      expect(m, t).not.toBeNull();
      expect(PANES.states).toContain(m![1]);
      expect(PANES.events).toContain(m![2]);
      expect(PANES.states).toContain(m![4]);
    }
  });

  it('every reachable state keeps the invariants', () => {
    const start: PS = { panes: emptyPanes(), tree: TREE0 };
    const seen = new Map<string, string[]>([[key(start), []]]);
    let frontier: [PS, string[]][] = [[start, []]];
    const failures = new Map<string, string>();
    const used = new Set<string>();
    while (frontier.length) {
      const next: [PS, string[]][] = [];
      for (const [s, path] of frontier) {
        for (const step of steps(s)) {
          const after = step.run(s);
          used.add(`${shape(s.panes)} --${step.ev}--> ${shape(after.panes)}`);
          for (const b of invariants(s, step, after)) {
            const kind = b.replace(/[0-9]+|[a-z]\.md|:cards\/\S+|:notes\/\S+/g, '_');
            if (!failures.has(kind)) failures.set(kind, `${b}\n  after: ${[...path, step.label].join(', ')}`);
          }
          const k = key(after);
          if (seen.has(k)) continue;
          seen.set(k, [...path, step.label]);
          next.push([after, [...path, step.label]]);
        }
      }
      frontier = next;
    }
    if (process.env.MODEL_LOG) process.stdout.write(`panes: ${seen.size} states, ${used.size} of ${chart.size} transitions taken\n`);
    expect(seen.size).toBeGreaterThan(500);
    expect([...failures.values()]).toEqual([]);
    // the chart has nothing the code never does
    expect([...chart].filter((t) => !used.has(t))).toEqual([]);
  }, 60_000);
});

// ── part 2: the app's wiring, over a collection ───────────────────

const ROOT = '/collections/panes';
let fs: StoreFs;
vi.mock('../collections.js', async (orig) => ({ ...(await orig<typeof import('../collections.js')>()), collectionFs: () => fs }));
const stopCrdt = vi.fn();
vi.mock('../crdt.js', async (orig) => ({ ...(await orig<typeof import('../crdt.js')>()), startCrdt: async () => true, stopCrdt: () => stopCrdt() }));
vi.mock('../keep.js', async (orig) => ({ ...(await orig<typeof import('../keep.js')>()), startMirror: async () => {}, stopMirror: () => {}, keepDatedSoon: () => {}, stopDated: () => {} }));
vi.mock('@tauri-apps/plugin-log', async (orig) => ({ ...(await orig<typeof import('@tauri-apps/plugin-log')>()), info: async () => {} }));
vi.mock('../../plugins/index.js', async (orig) => ({ ...(await orig<typeof import('../../plugins/index.js')>()), startPlugins: async () => ({}), stopPlugins: () => {} }));

const { memStore } = await import('../../vault/mem-store.js');
const { storeFs } = await import('../../vault/store.js');
const { closeVault, currentVault, moveNode, openNode, openVault, renameNode } = await import('../vault.js');
const { deleteNode } = await import('../remove.js');
const { undoNotice } = await import('../land.js');
const { useApp } = await import('../store.js');
type StoreFs = import('../../vault/index.js').StoreFs;

/** The tabs a person has open: every kind of node, in two panes, none of them read by a page (only the active tabs are drawn). */
const TABS: [string, OpenOptsT][] = [
  ['f', {}], ['f/a.md', { cmdClick: true }], [cardsId('b.md'), { cmdClick: true }], ['b.md', { cmdClick: true, shiftClick: true }], ['c.md', { cmdClick: true }],
];
type OpenOptsT = import('../panes.js').OpenOpts;

type Op = 'rename f' | 'move c into f' | 'delete f' | 'delete b' | 'undo' | 'outside delete c';

async function world(): Promise<void> {
  fs = storeFs(memStore(), ROOT);
  await fs.mkdir(ROOT);
  await fs.mkdir(`${ROOT}/f`);
  await fs.writeText(`${ROOT}/f/a.md`, 'a note\n');
  await fs.writeText(`${ROOT}/b.md`, '---\ntype: deck\n---\nq :: a\n');
  await fs.writeText(`${ROOT}/c.md`, 'c note\n');
  await openVault(ROOT);
  for (const [id, opts] of TABS) openNode(id, opts);
}

const has = (path: string) => (fs.stat(`${ROOT}/${path}`)).then((s) => s !== null);

function enabledOps(done: Op[], tree: Set<string>): Op[] {
  const out: Op[] = [];
  if (tree.has('f')) out.push('rename f', 'delete f');
  if (tree.has('c.md') && (tree.has('f') || tree.has('g'))) out.push('move c into f');
  if (tree.has('b.md')) out.push('delete b');
  if (tree.has('c.md')) out.push('outside delete c');
  if (done.some((d) => d.startsWith('delete')) && !done.includes('undo')) out.push('undo');
  return out;
}

async function runOp(op: Op): Promise<void> {
  const v = currentVault()!;
  switch (op) {
    case 'rename f': await renameNode('f', 'g'); break;
    case 'move c into f': await moveNode('c.md', (await has('f')) ? 'f' : 'g'); break;
    case 'delete f': await deleteNode('f'); break;
    case 'delete b': await deleteNode('b.md'); break;
    case 'undo': await undoNotice(); break;
    case 'outside delete c':
      // a sync, or another window, takes the file away; the watcher says so
      await fs.remove(`${ROOT}/c.md`);
      await v.changed([`${ROOT}/c.md`]);
      break;
  }
}

function treePaths(): Set<string> {
  const out = new Set<string>(['']);
  const visit = (nodes: import('../../vault/index.js').TreeNode[]) => {
    for (const n of nodes) {
      out.add(n.path);
      if (n.kind === 'folder') visit(n.children);
      else if (n.children) visit(n.children);
    }
  };
  visit(useApp.getState().tree);
  return out;
}

function wiringBad(): string[] {
  const s = useApp.getState().panes;
  const tree = treePaths();
  const bad: string[] = [];
  for (const p of s.panes) for (const t of p.tabs) if (!t.id.startsWith(':') || cardsPath(t.id) !== null || notesPath(t.id) !== null) {
    if (!tree.has(nodeOf(t.id))) bad.push(`a tab on ${t.id}, which the tree does not have`);
  }
  if (s.active < 0 || s.active >= s.panes.length) bad.push(`the active pane is ${s.active} of ${s.panes.length}`);
  s.panes.forEach((p, i) => { if (p.tabs.length ? p.active >= p.tabs.length : p.active !== 0) bad.push(`pane ${i}'s active tab is ${p.active} of ${p.tabs.length}`); });
  return bad;
}

describe('tabs and panes, through the app\'s wiring', () => {
  beforeEach(() => {
    vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout', 'setInterval', 'clearInterval'] });
    vi.spyOn(console, 'error').mockImplementation(() => {});
  });
  afterEach(() => {
    closeVault();
    vi.useRealTimers();
    vi.restoreAllMocks();
  });

  it('every sequence of two tree operations leaves every tab on a node the tree has', async () => {
    const failures: string[] = [];
    let runs = 0;
    const explore = async (done: Op[]) => {
      await world();
      for (const op of done) await runOp(op);
      runs++;
      for (const b of wiringBad()) failures.push(`${b}\n  after: ${done.join(', ')}`);
      const tree = treePaths();
      closeVault();
      if (done.length >= 2) return;
      for (const op of enabledOps(done, tree)) await explore([...done, op]);
    };
    await explore([]);
    expect(runs).toBeGreaterThan(20);
    expect(failures).toEqual([]);
  }, 120_000);

  // what the exploration found: over a collection nothing reads a deck, a document's cards, a folder, or a tab
  // behind another, so its delete was never reported as `gone`, and its tabs stayed on a node that was not there
  it('a deck deleted with its tabs open closes them', async () => {
    await world();
    await runOp('delete b');
    expect(useApp.getState().panes.panes.flatMap((p) => p.tabs.map((t) => t.id))).toEqual(['f', 'f/a.md', 'c.md']);
    expect(wiringBad()).toEqual([]);
  });

  it('a folder deleted closes its tab and the tabs of what was in it; undo leaves them closed', async () => {
    await world();
    await runOp('delete f');
    expect(useApp.getState().panes.panes.flatMap((p) => p.tabs.map((t) => t.id))).toEqual([cardsId('b.md'), 'b.md', 'c.md']);
    await runOp('undo');
    expect(treePaths().has('f/a.md')).toBe(true);
    expect(wiringBad()).toEqual([]);
  });

  it('a document taken away from outside closes its tab', async () => {
    await world();
    await runOp('outside delete c');
    expect(useApp.getState().panes.panes.flatMap((p) => p.tabs.map((t) => t.id))).not.toContain('c.md');
    expect(wiringBad()).toEqual([]);
  });
});

describe('opening another collection', () => {
  it('stops the one before syncing to its storage, as closing it does', async () => {
    await world();
    stopCrdt.mockClear();
    await openVault(ROOT);
    expect(stopCrdt).toHaveBeenCalledTimes(1);
    closeVault();
  });
});
