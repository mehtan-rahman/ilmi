// The one open vault, and how it gets opened. Kept outside the Zustand store
// because a Vault holds a watcher and a cache; the store gets plain data.
// Every tree operation here goes to the collection's database through the
// vault (`collections.ts`, milestone 59) and comes back through its
// events; nothing edits the store's tree directly.

import { invoke } from '@tauri-apps/api/core';
import { getCurrentWindow } from '@tauri-apps/api/window';
import { open as pickDirectory } from '@tauri-apps/plugin-dialog';
import { info } from '@tauri-apps/plugin-log';
import { REVIEWS_DIR, meta, setField, type Doc, type Meta, type NodeType, type Review } from '../format/index.js';
import type { Chapter, MappedDeck } from '../import/index.js';
import { activeExam, addDays, buryLinked, cadence, cardsById, dayOf, dayStart, docItems, examQueue, examsAt, isDue, itemKey, meterQueue, postponeOverflow, readPri, resolveOptions, spentToday, whenToDate, type ExamAt, type QueueItem, type Resolved } from '../schedule/index.js';
import { SAME_FILE, Vault, childDirOf, childrenAt, cleanName, dirOf, entryOf, fileName, isDoc, joinRel, normRel, ordered, placeEntry, rekey, type DocNode, type ExtractSpec, type SectionSpec, type ImportDeckSpec, type ImportPdfSpec, type ImportSpec, type PdfChapterSpec, type StoreFs, type TreeNode, type VaultEvent, type VaultState } from '../vault/index.js';
import { createCollection, listCollections } from '../vault/tauri-store.js';
import { startPlugins, stopPlugins } from '../plugins/index.js';
import { cleanClipDir } from './clip.js';
import { collectionFs, importCollection } from './collections.js';
import { cleanViews, type DeckView } from './deck.js';
import { cleanBudget, dueToday, sessionItems } from './items.js';
import { INTAKE, SESSION, queueId, queueScope } from './names.js';
import { inspectorShown } from './layout.js';
import { activeTab, dropTabs, emptyPanes, openTab, retarget, type OpenOpts, type Panes } from './panes.js';
import { NEVER, collectionRows, collectionsHome, isMobile, loadPlatform, setCollectionsHome } from './platform.js';
import { addRecent, decideStart, forgetRecent, vaultName } from './recents.js';
import { STARTER_TEXT, STARTER_TITLE } from './starter.js';
import { RAIL_DEFAULT, addTab, clampRail, notebookOf } from './tabs.js';
import { INSP_DEFAULT, INSP_MAX, INSP_MIN, SIDE_DEFAULT, SIDE_MAX, SIDE_MIN, useApp, type DocInfo, type Inspector, type Sidebar } from './store.js';
import { appNow } from './clock.js';
import { devStorage, joinCollection, startCrdt, stopCrdt } from './crdt.js';
import { forgetStorage } from './storage.js';
import { cloneCollection, startSync, stopSync } from './sync.js';
import { keepDatedSoon, startMirror, stopDated, stopMirror } from './keep.js';

let current: Vault | null = null;

export function currentVault(): Vault | null {
  return current;
}

// ── document info and the queue ──────────────────────────────────

/**
 * Every document, by path, as the queue, a deck's rows, the counts and the
 * numbers read it. When a collection opens these are the index's digests
 * (`vault/lift.ts`: fields, headings and cards whole, prose as marks), so
 * nothing is parsed; a document written since is its digest as the store
 * made it then. Never written back: the vault holds the documents.
 */
const bodies = new Map<string, Doc>();

/** The store under the open vault, when it is one (`vault/store.ts`): it keeps the index. */
const storeOf = (vault: Vault): StoreFs | null => ('digests' in vault.fs ? (vault.fs as StoreFs) : null);

/** The front matter of each known document, read once. */
const metas = new Map<string, Meta>();

/**
 * One document's queue items as `docItems` makes them, kept until the
 * document changes or the clock makes them stale: the day turns, or a
 * both-ways card's direction comes due (its sibling may then be held
 * back). `links` is how many of its items are one side of a link. The
 * items are never changed once made: a queue holds them as they are, or
 * a copy where a step of the day's order marks one.
 */
interface Derived {
  items: QueueItem[];
  day: string;
  /** Made at, and good until: a clock set back (a test's) makes them again too. */
  at: number;
  until: number;
  links: number;
}
const derived = new Map<string, Derived>();

/** Each kept item's draw for the day (`sortQueue`), made when first asked for: the same all day, and not cheap. */
let dayKeys: { day: string; keys: WeakMap<QueueItem, number> } = { day: '', keys: new WeakMap() };

/** Whether any card known is one side of a link (FORMAT.md §6.2): without one, a grade has no other side to look for. */
export function anyLinks(): boolean {
  // nothing made yet says nothing either way
  if (!derived.size) return true;
  for (const d of derived.values()) if (d.links) return true;
  return false;
}

/** The options and the exams that apply at a path, kept until a document's front matter or the tree changes. */
const optionsCache = new Map<string, Resolved>();
const examsCache = new Map<string, ExamAt[]>();

function forgetInherited(): void {
  optionsCache.clear();
  examsCache.clear();
}

/** Take a document's digest (or its parsed form) as what is known of it. */
function setBody(path: string, doc: Doc): void {
  const m = meta(doc);
  const was = metas.get(path);
  bodies.set(path, doc);
  metas.set(path, m);
  derived.delete(path);
  // options and exams are inherited down the tree: a front matter that changed may change them anywhere under it
  if (!was || JSON.stringify(inherited(was)) !== JSON.stringify(inherited(m))) forgetInherited();
}

function dropBody(path: string): void {
  if (!bodies.delete(path)) return;
  metas.delete(path);
  derived.delete(path);
  forgetInherited();
}

/** What of a front matter reaches the documents under it. */
const inherited = (m: Meta) => [m.newPerDay, m.reviewsPerDay, m.retention, m.leech, m.leechAction, m.exams];

function derivedOf(path: string, now: Date): Derived {
  const day = dayOf(now);
  const t = now.getTime();
  const hit = derived.get(path);
  if (hit && hit.day === day && t >= hit.at && t < hit.until) return hit;
  const items = docItems(path, bodies.get(path)!, now);
  let until = dayStart(addDays(day, 1)).getTime();
  let links = 0;
  for (const i of items) {
    if (i.kind !== 'card') continue;
    if (i.link !== undefined) links++;
    if (i.dir && i.due) {
      const due = whenToDate(i.due).getTime();
      if (due > t && due < until) until = due;
    }
  }
  const made: Derived = { items, day, at: t, until, links };
  derived.set(path, made);
  return made;
}

function infoOf(doc: Doc, items: QueueItem[], now: Date, pdf: string | null): DocInfo {
  const m = meta(doc);
  const due = new Set<number>();
  for (const item of items) if (item.kind === 'card' && isDue(item, now)) due.add(item.block);
  const out: DocInfo = {
    type: m.type,
    // the body of a document with pages is its notes, never frozen: `frozen` keeps only a text source's text (FORMAT.md §3)
    frozen: m.frozen && pdf === null,
    cards: doc.blocks.filter((b) => b.kind === 'card').length,
    due: due.size,
  };
  if (m.title !== undefined) out.title = m.title;
  if (m.read) out.read = m.read;
  if (m.write) out.write = m.write;
  if (m.pri !== undefined) out.pri = m.pri;
  if (pdf !== null) out.pdf = pdf;
  if (m.tabs) out.tabs = true;
  if (m.pages) out.pages = { ...m.pages };
  const sections = items.filter((i) => i.kind === 'section' && isDue(i, now)).length;
  if (sections) out.sections = sections;
  return out;
}

/** Every review logged in the open vault (`.ilmi/reviews/`), oldest first; empty without a log. */
let reviews: Review[] = [];

/** The reviews of `now`'s local day: the log is in order, so they are its tail. */
function reviewsToday(now: Date): Review[] {
  const from = dayStart(dayOf(now)).toISOString().slice(0, 19) + 'Z';
  let lo = 0;
  let hi = reviews.length;
  while (lo < hi) {
    const mid = (lo + hi) >> 1;
    if (reviews[mid]!.at < from) lo = mid + 1; else hi = mid;
  }
  return lo === 0 ? reviews : reviews.slice(lo);
}

/** The front-matter of a known document, for the options (`schedule/options.ts`). */
const metaOf = (path: string): Meta | undefined => metas.get(path);

/** The study options that apply at a document or folder, and where each comes from. */
export function optionsAt(path: string): Resolved {
  let r = optionsCache.get(path);
  if (!r) { r = resolveOptions(path, metaOf); optionsCache.set(path, r); }
  return r;
}

/** Every exam that applies at a document or folder (`schedule/exams.ts`), by day. */
export function examsAtPath(path: string): ExamAt[] {
  let e = examsCache.get(path);
  if (!e) { e = examsAt(path, metaOf); examsCache.set(path, e); }
  return e;
}

/** The exam ahead a document is studied toward at `now`, if any. */
export const activeExamAt = (path: string, now: Date): ExamAt | undefined => activeExam(examsAtPath(path), now);

/**
 * The queue over every known document, at `now`: what is under an exam
 * brought before it (`examQueue`), then the day's allowances metered (new
 * cards a day, the reviews cap, an exam's new cards). Each document's
 * items are kept between builds (`derivedOf`), so a change re-derives one
 * document; what is done over all of them is the day's order.
 */
function buildQueue(now: Date): QueueItem[] {
  const day = dayOf(now);
  const t = now.getTime();
  if (dayKeys.day !== day) dayKeys = { day, keys: new WeakMap() };
  const all: Derived[] = [];
  let links = 0;
  for (const path of bodies.keys()) {
    const d = derivedOf(path, now);
    links += d.links;
    all.push(d);
  }
  const out: QueueItem[] = [];
  // the steps below mark items in place, so what one may mark is a copy: an item under an exam ahead (tagged, brought
  // forward), a card due that an allowance may hold, and with a link anywhere any card (its twin may be buried)
  const from = new Map<QueueItem, QueueItem>();
  const examOf = (p: string) => activeExam(examsAtPath(p), now);
  for (const d of all) {
    if (!d.items.length) continue;
    const under = examOf(d.items[0]!.path) !== undefined;
    for (const base of d.items) {
      const marked = under || (base.kind === 'card' && (links > 0 || base.dueAt.getTime() <= t));
      if (!marked) { out.push(base); continue; }
      const item = { ...base };
      from.set(item, base);
      out.push(item);
    }
  }
  const keys = dayKeys.keys;
  const keyOf = (item: QueueItem, on: string): number => {
    if (on !== day) return itemKey(item, on);
    const base = from.get(item) ?? item;
    let k = keys.get(base);
    if (k === undefined) { k = itemKey(base, on); keys.set(base, k); }
    return k;
  };
  examQueue(out, now, examsAtPath);
  // of two linked cards, one a day (after the exams have brought theirs forward)
  if (links) buryLinked(out, cardsById(bodies), now);
  return meterQueue(out, now, { optionsOf: optionsAt, spent: spentToday(reviewsToday(now), now, optionsAt, examOf), examOf, keyOf });
}

/** Each document's `due` as the metered queue has it: a card held for tomorrow is not due today. */
function withDue(docs: Record<string, DocInfo>, queue: QueueItem[], now: Date): Record<string, DocInfo> {
  const due = new Map<string, Set<number>>();
  const sections = new Map<string, number>();
  for (const i of queue) {
    if (i.kind === 'card' && isDue(i, now)) { const s = due.get(i.path) ?? new Set<number>(); s.add(i.block); due.set(i.path, s); }
    else if (i.kind === 'section' && isDue(i, now)) sections.set(i.path, (sections.get(i.path) ?? 0) + 1);
  }
  let out = docs;
  for (const [path, info] of Object.entries(docs)) {
    const n = due.get(path)?.size ?? 0;
    const k = sections.get(path) ?? 0;
    if (info.due === n && (info.sections ?? 0) === k) continue;
    if (out === docs) out = { ...docs };
    const { sections: _, ...rest } = info;
    out[path] = { ...rest, due: n, ...(k ? { sections: k } : {}) };
  }
  return out;
}

/** The queue for the present moment (a card in learning steps may have come due), and each document's due count with it. */
function publishQueue(docs: Record<string, DocInfo>, now: Date): { queue: QueueItem[]; queueAt: Date; docs: Record<string, DocInfo> } {
  const queue = buildQueue(now);
  return { queue, queueAt: now, docs: withDue(docs, queue, now) };
}

/** Rebuild the queue for the present moment: a card in learning steps may have come due. */
export function refreshQueue(): void {
  useApp.setState((s) => publishQueue(s.docs, appNow()));
  dayStarted();
}

/** The last day the queue was built on, from `.ilmi/state.json`; null until the vault says. */
let lastDay: string | null = null;

/**
 * The first queue build of a day: the day is recorded (`VaultState.lastDay`),
 * and with the `postpone the backlog when the day starts` tweak on, what was
 * due before today is postponed (`postponeRest`). Nothing on the day the
 * vault is first opened, which has no day before it.
 */
function dayStarted(): void {
  if (!current) return;
  const day = dayOf(appNow());
  if (lastDay === day) return;
  const first = lastDay === null;
  lastDay = day;
  queueSave({ lastDay: day });
  // the day turned with the collection open: its export for the new day
  const vault = current;
  if (!first) void keepsDated().then((on) => { if (on && current === vault) keepDatedSoon(vault, currentVault); });
  if (!first && useApp.getState().backlog) void postponeRest().catch((e: unknown) => console.error('backlog', e));
}

/** The review log as the app holds it. */
export const reviewLog = (): readonly Review[] => reviews;

/**
 * A grade's line taken into the log the app holds before its write lands,
 * so the queue built as the write is reported already counts it (a new
 * card graded spends the day's allowance). `dropReview` takes it out again
 * when the write did not happen.
 */
export function stageReview(r: Review): void {
  reviews = [...reviews, r];
}

export function dropReview(r: Review): void {
  reviews = reviews.filter((x) => x !== r);
}

/**
 * Log one grade: the log the numbers read updated and the queue metered
 * again. Its line is appended to its month's file in `.ilmi/reviews/`
 * here, unless it went in with the grade's own write (`logged`: over a
 * store the two are one transaction, `grading.ts`).
 */
export async function recordReview(r: Review, logged = false): Promise<void> {
  const vault = current;
  if (!vault) return;
  if (!reviews.includes(r)) reviews = [...reviews, r];
  if (logged) {
    // the write that carried it rebuilt the queue with it counted
    useApp.setState({ reviews });
    return;
  }
  useApp.setState((s) => ({ reviews, ...publishQueue(s.docs, appNow()) }));
  await vault.appendReviews([r]);
}

/** Read the log again: another device's lines synced in. Our own appends come back the same. */
let reloadTimer: ReturnType<typeof setTimeout> | null = null;
function reloadReviews(vault: Vault): void {
  if (reloadTimer) clearTimeout(reloadTimer);
  reloadTimer = setTimeout(() => {
    reloadTimer = null;
    void (async () => {
      // over a store the count says whether anything came in, without reading a line
      const store = storeOf(vault);
      if (store && (await store.reviewCount()) === reviews.length) return;
      const log = await vault.loadReviews();
      if (current !== vault || log.length === reviews.length) return;
      reviews = log;
      useApp.setState((s) => ({ reviews, ...publishQueue(s.docs, appNow()) }));
    })().catch((e: unknown) => console.error('reviews', e));
  }, 500);
}

/** Each document's node in the tree, by path. */
function nodesByPath(tree: TreeNode[]): Map<string, DocNode> {
  const out = new Map<string, DocNode>();
  const visit = (nodes: TreeNode[]) => {
    for (const n of nodes) {
      if (n.kind === 'doc') out.set(n.path, n);
      if (n.kind === 'folder') visit(n.children);
      else if (n.children) visit(n.children);
    }
  };
  visit(tree);
  return out;
}

/** Where a document's pages are, as `Vault.pagesOf` finds them, from what is known of it: no document is read. */
async function pagesFor(vault: Vault, path: string, node: DocNode | undefined): Promise<string | null> {
  const named = metas.get(path)?.pdf;
  if (named !== undefined) {
    const rel = normRel(joinRel(dirOf(path), named));
    if (rel && (await vault.fs.stat(vault.abs(rel)))?.isDir === false) return rel;
  }
  return node?.pdf ?? null;
}

/** The vault whose index has been read into `bodies`. */
let indexed: Vault | null = null;

/**
 * What is known of every document, published: from the index when the
 * collection opens (one read of the digests, nothing parsed), and after
 * that kept in step by the store's own word of each write (`onIndexed`);
 * a document the tree has that is not known yet is read.
 */
async function publishDocs(vault: Vault): Promise<void> {
  const now = appNow();
  const paths = vault.documents();
  if (indexed !== vault) {
    bodies.clear();
    metas.clear();
    derived.clear();
    forgetInherited();
    const index = await storeOf(vault)?.digests();
    if (current !== vault) return;
    if (index) for (const path of paths) { const doc = index.get(path); if (doc) setBody(path, doc); }
    indexed = vault;
  }
  const seen = new Set(paths);
  for (const path of [...bodies.keys()]) if (!seen.has(path)) dropBody(path);
  for (const path of paths) {
    if (bodies.has(path)) continue;
    try {
      setBody(path, (await vault.read(path)).doc);
    } catch (e) {
      console.error(path, e);
    }
  }
  if (current !== vault) return;
  const nodes = nodesByPath(vault.tree);
  const docs: Record<string, DocInfo> = {};
  for (const path of paths) {
    const doc = bodies.get(path);
    if (doc) docs[path] = infoOf(doc, derivedOf(path, now).items, now, await pagesFor(vault, path, nodes.get(path)));
  }
  if (current !== vault) return;
  useApp.setState(publishQueue(docs, now));
  dayStarted();
}

/** A document as last written or reported: what is known of it replaced, its row's numbers and the queue with it. */
function publishDoc(vault: Vault, path: string, doc: Doc): void {
  const s = useApp.getState();
  const now = appNow();
  setBody(path, doc);
  // the pages stay what they were until the vault has looked: a changed `pdf` field lands a moment later
  useApp.setState(publishQueue({ ...s.docs, [path]: infoOf(doc, derivedOf(path, now).items, now, s.docs[path]?.pdf ?? null) }, now));
  void pagesFor(vault, path, nodesByPath(vault.tree).get(path)).then((pdf) => {
    const cur = useApp.getState().docs[path];
    if (current !== vault || !cur || (cur.pdf ?? null) === pdf) return;
    const next = { ...cur };
    if (pdf === null) delete next.pdf; else next.pdf = pdf;
    useApp.setState((st) => ({ docs: { ...st.docs, [path]: next } }));
  });
}

/** The store's word of a document it has just written: its digest is what is known of it from now. */
function onIndexed(vault: Vault, path: string, doc: Doc | null): void {
  if (current !== vault || indexed !== vault || !doc) return;
  // a document the tree does not have yet is published when the tree is (`publishDocs` reads what it is missing)
  if (!useApp.getState().docs[path] && !bodies.has(path)) { setBody(path, doc); return; }
  publishDoc(vault, path, doc);
}

/** Publish the tree, and forget open state for anything no longer in it. */
function publishTree(vault: Vault): void {
  const present = new Set<string>(['']);
  const visit = (nodes: TreeNode[]) => {
    for (const n of nodes) {
      present.add(n.path);
      if (n.kind === 'folder') visit(n.children);
      else if (n.children) visit(n.children);
    }
  };
  visit(vault.tree);
  const was = useApp.getState().open;
  const open: Record<string, true> = {};
  for (const k of Object.keys(was)) if (present.has(k)) open[k] = true;
  useApp.setState({ vault: vault.root, files: vault.documents(), tree: vault.tree, open });
  if (Object.keys(open).length !== Object.keys(was).length) queueSave({ folders: Object.keys(open) });
}

// ── view state on disk ───────────────────────────────────────────

let saveTimer: ReturnType<typeof setTimeout> | null = null;
let savePatch: VaultState = {};

/** Merge `patch` into `.ilmi/state.json`, a little later, so a drag does not write on every pixel. */
function queueSave(patch: VaultState): void {
  savePatch = { ...savePatch, ...patch };
  if (saveTimer) clearTimeout(saveTimer);
  saveTimer = setTimeout(() => {
    saveTimer = null;
    const vault = current;
    const p = savePatch;
    savePatch = {};
    if (vault) vault.saveState(p).catch((e: unknown) => console.error(e));
  }, 300);
}

const rekeyOpen = (open: Record<string, true>, from: string, to: string): Record<string, true> => {
  const out: Record<string, true> = {};
  for (const k of Object.keys(open)) out[rekey(k, from, to) ?? k] = true;
  return out;
};

/** A notebook's page deleted under a tab that shows it: the tab goes back to the notebook's overview, when the notebook is still there. */
function pagesToNotebook(panes: Panes, gone: string, docs: Record<string, DocInfo>): Panes {
  let touched = false;
  const next = panes.panes.map((p) => ({
    ...p,
    tabs: p.tabs.map((t) => {
      if (rekey(t.id, gone, gone) === null) return t;
      const nb = notebookOf(t.id, docs);
      if (!nb || rekey(nb, gone, gone) !== null) return t;
      touched = true;
      return { ...t, id: nb };
    }),
  }));
  return touched ? { ...panes, panes: next } : panes;
}

function onEvent(vault: Vault, ev: VaultEvent): void {
  if (current !== vault) return;
  const s = useApp.getState();
  switch (ev.kind) {
    case 'tree':
      publishTree(vault);
      void publishDocs(vault);
      break;
    case 'doc':
      // over a store the write itself was reported with the document's digest (`onIndexed`); a directory has only this
      if (!storeOf(vault)) publishDoc(vault, ev.path, ev.loaded.doc);
      break;
    case 'gone': {
      const docs = { ...s.docs };
      delete docs[ev.path];
      dropBody(ev.path);
      const now = appNow();
      useApp.setState({ panes: dropTabs(pagesToNotebook(s.panes, ev.path, s.docs), ev.path), ...publishQueue(docs, now) });
      break;
    }
    case 'moved': {
      const docs: Record<string, DocInfo> = {};
      for (const [k, v] of Object.entries(s.docs)) docs[rekey(k, ev.from, ev.to) ?? k] = v;
      // what is known of each document goes with it; its items name its path, so they are made again
      for (const [k, doc] of [...bodies]) {
        const to = rekey(k, ev.from, ev.to);
        if (to === null || to === k) continue;
        dropBody(k);
        setBody(to, doc);
      }
      const railFolded = rekeyOpen(s.railFolded, ev.from, ev.to);
      const views: Record<string, DeckView> = {};
      for (const [k, v] of Object.entries(s.deckViews)) views[rekey(k, ev.from, ev.to) ?? k] = v;
      const folds: Record<string, string[]> = {};
      for (const [k, v] of Object.entries(s.folds)) folds[rekey(k, ev.from, ev.to) ?? k] = v;
      useApp.setState({ docs, open: rekeyOpen(s.open, ev.from, ev.to), panes: retarget(s.panes, ev.from, ev.to), railFolded, deckViews: views, folds });
      if (Object.keys(s.folds).some((k) => rekey(k, ev.from, ev.to) !== null)) queueSave({ folds });
      if (Object.keys(s.railFolded).some((k) => rekey(k, ev.from, ev.to) !== null)) queueSave({ rails: Object.keys(railFolded) });
      break;
    }
    case 'order':
      useApp.setState({ order: ev.order });
      break;
    case 'hidden':
      if (ev.paths.some((p) => p.startsWith(`${REVIEWS_DIR}/`))) reloadReviews(vault);
      // the pairs said not the same, written here or synced in
      if (ev.paths.includes(SAME_FILE)) void vault.loadNotSame().then((notSame) => { if (current === vault) useApp.setState({ notSame }); });
      break;
  }
}

// ── open ─────────────────────────────────────────────────────────

/** Open the collection whose folder is `path` (its database read through the store), watch it, and publish its tree. */
export async function openVault(path: string): Promise<Vault> {
  stopPlugins();
  stopSync();
  stopMirror();
  stopDated();
  current?.close();
  const vault = await Vault.open(collectionFs(path), path);
  current = vault;
  const state = await vault.loadState();
  const open: Record<string, true> = { '': true };
  for (const f of state.folders ?? []) open[f] = true;
  const railFolded: Record<string, true> = {};
  for (const f of Array.isArray(state.rails) ? state.rails : []) if (typeof f === 'string') railFolded[f] = true;
  // an iPad is a narrow Mac: the sidebar and the inspector start hidden there (`platform.ts`)
  const mobile = isMobile();
  const sidebar: Sidebar = {
    width: Math.min(SIDE_MAX, Math.max(SIDE_MIN, state.sidebar?.width ?? SIDE_DEFAULT)),
    hidden: state.sidebar?.hidden ?? mobile,
  };
  const inspector: Inspector = {
    width: Math.min(INSP_MAX, Math.max(INSP_MIN, state.inspector?.width ?? INSP_DEFAULT)),
    open: state.inspector?.open ?? (!mobile && window.innerWidth > 1180),
  };
  // the last tab comes back, except a session; nothing remembered opens the day
  let panes = emptyPanes();
  const tab = state.tab;
  if (tab !== undefined && tab !== SESSION && (tab === '' || tab === INTAKE || queueScope(tab) || vault.documents().includes(tab) || (await vault.fs.stat(vault.abs(tab)))?.isDir)) {
    panes = openTab(panes, tab);
  } else {
    panes = openTab(panes, queueId('today'));
  }
  bodies.clear();
  metas.clear();
  derived.clear();
  forgetInherited();
  indexed = null;
  lastDay = typeof state.lastDay === 'string' ? state.lastDay : null;
  reviews = await vault.loadReviews().catch((e: unknown) => { console.error('reviews', e); return []; });
  const s0 = useApp.getState();
  useApp.setState({
    open, sidebar, inspector, panes, docs: {}, queue: [], budget: cleanBudget(state.budget), clipDir: cleanClipDir(state.clippings), log: [], session: null, sessionEl: null, selectedCard: null, reveal: null,
    started: true, sideSheet: false, namingVault: false, gone: s0.gone.filter((p) => p !== path), notice: null, fileOver: null, intakeFiles: [], order: vault.order, railFolded, railWidth: clampRail(state.railWidth ?? RAIL_DEFAULT), deckViews: cleanViews(state.decks),
    folds: cleanFolds(state.folds), reviews, lensViews: {}, examFilter: null,
    notSame: await vault.loadNotSame().catch(() => []),
  });
  s0.setRecents(addRecent(s0.recents, path, new Date()));
  setWindowTitle(vaultName(path));
  publishTree(vault);
  vault.subscribe((ev) => onEvent(vault, ev));
  storeOf(vault)?.onIndex((p, doc) => onIndexed(vault, p, doc));
  await vault.watch();
  await publishDocs(vault);
  // the plugins the vault has on; a failure there is theirs, not the vault's
  await startPlugins(vault).catch((e: unknown) => console.error('plugins', e));
  // sync: through a storage when the run names one (`crdt.ts`, milestone 61); else by git, when the
  // vault is a repository with a remote: a pull now, then the timers (`sync.ts`)
  void startCrdt(vault)
    .then((on) => (on || current !== vault ? undefined : startSync(vault)))
    .catch((e: unknown) => console.error('sync', e));
  // the copies kept outside the database (`keep.ts`): the mirror, when one is set, and the day's export
  void startMirror(vault).catch((e: unknown) => console.error('mirror', e));
  void keepsDated().then((on) => { if (on && current === vault) keepDatedSoon(vault, currentVault); });
  if (import.meta.env.DEV) void info(`vault ${path}: ${vault.documents().join(', ')}`);
  return vault;
}

/** Whether the day's export is made on its own: always, but for a dev run of a smoke, which makes its own when it checks them. */
async function keepsDated(): Promise<boolean> {
  if (!import.meta.env.DEV) return true;
  try {
    return !(await invoke<string | null>('dev_env', { name: 'ILMI_SMOKE' }));
  } catch {
    return false;
  }
}

/** Back to the welcome: the watcher stops, the store forgets the vault's data; the recents keep it. */
export function closeVault(): void {
  stopCrdt();
  stopSync();
  stopMirror();
  stopDated();
  current?.close();
  current = null;
  bodies.clear();
  metas.clear();
  derived.clear();
  forgetInherited();
  indexed = null;
  lastDay = null;
  reviews = [];
  if (saveTimer) { clearTimeout(saveTimer); saveTimer = null; savePatch = {}; }
  void listVaults().catch(console.error);
  useApp.setState({ vault: null, sideSheet: false, files: [], tree: [], docs: {}, open: { '': true }, panes: emptyPanes(), queue: [], log: [], session: null, sessionEl: null, selectedCard: null, reveal: null, paletteOpen: false, intakeDir: '', notice: null, fileOver: null, intakeFiles: [], order: {}, railFolded: {}, deckViews: {}, folds: {}, reviews: [], lensViews: {}, examFilter: null });
  setWindowTitle(null);
}

/** Drop one vault from the recents; nothing on disk changes. */
export function forgetVault(path: string): void {
  const s = useApp.getState();
  s.setRecents(forgetRecent(s.recents, path));
  useApp.setState({ gone: s.gone.filter((p) => p !== path) });
}

/** `<name> · ilmi` while a vault is open, `ilmi` otherwise. Nothing to set outside Tauri. */
function setWindowTitle(name: string | null): void {
  try {
    getCurrentWindow().setTitle(name ? `${name} · ilmi` : 'ilmi').catch(() => { /* not under Tauri */ });
  } catch { /* not under Tauri */ }
}

/** `import folder`: ask for a folder; it becomes a collection named after it, and opens. Resolves to null if the dialog was dismissed. */
export async function importVault(): Promise<Vault | null> {
  const dir = await pickDirectory({ directory: true, recursive: true, multiple: false });
  return dir ? importVaultFrom(dir) : null;
}

/** The folder at `dir` (picked, or dropped on the welcome) imported as a collection and opened. */
export async function importVaultFrom(dir: string): Promise<Vault> {
  return openVault(await importCollection(dir));
}

/** `new collection`: the welcome takes its name. */
export function nameNewVault(): void {
  useApp.setState({ namingVault: true });
}

/**
 * A new collection called `name`, with `start here.md` in it (a frozen
 * source on the three loops with one card, enrolled for reading), then
 * opened. Rejects with `already there` when the name is taken.
 */
export async function newVault(name: string): Promise<Vault> {
  const clean = cleanName(name);
  if (!clean) throw new Error('not a name');
  const made = await createCollection(clean);
  forgetStorage(made);
  const vault = await openVault(made);
  const doc = await vault.importDoc('', { title: STARTER_TITLE, text: STARTER_TEXT });
  await vault.update(doc, (d) => setField(d, 'read', { due: dayOf(appNow()), ivl: 1, reps: 0, pos: 0 }));
  openNode(doc);
  return vault;
}

/**
 * The welcome's rows are the collections there are, at the paths they have
 * now (the app's data directory moves between installs on iOS, so a path
 * remembered is not one to trust): the recents are rewritten from them,
 * each with the time it was last opened when one is known.
 */
export async function listVaults(): Promise<void> {
  const { home, names } = await listCollections();
  setCollectionsHome(home);
  const s = useApp.getState();
  s.setRecents(collectionRows(home, names, s.recents));
  useApp.setState({ gone: [] });
}

/**
 * The welcome's `connect` on iOS: the remote cloned as a collection under
 * its own name (53's clone into the folder the sync keeps, then imported;
 * the remote and token kept with it), then opened. Rejects with libgit2's
 * words, or `already there` when a collection of that name is.
 */
export async function connectClone(url: string, token: string): Promise<Vault> {
  if (!url.trim()) throw new Error('no remote');
  return openVault(await cloneCollection(url, token));
}

/**
 * The start decision: the collections listed, and the last opened one
 * reopened when the toggle is on; otherwise the welcome shows. Outside
 * Tauri there is nothing to list and the welcome shows.
 */
export async function startFromRecents(): Promise<void> {
  await listVaults().catch(console.error);
  const s = useApp.getState();
  const present = new Set(collectionsHome() ? s.recents.map((r) => r.path) : []);
  const start = decideStart(s.recents, s.reopen, present);
  // a collection never opened here is listed, not reopened
  if (start.kind === 'reopen' && s.recents[0]?.opened !== NEVER) {
    try {
      await openVault(start.path);
      return;
    } catch (e) {
      console.error(start.path, e);
      useApp.setState((st) => ({ gone: [...st.gone, start.path] }));
    }
  }
  useApp.setState({ started: true });
}

/**
 * Dev only: what `ILMI_VAULT` names, as a collection to open. A folder of
 * files is imported afresh under its own name, the last import of that
 * name replaced, so a smoke always starts from the files; a collection's
 * own folder is opened as it is.
 */
export async function devCollection(path: string): Promise<string> {
  const { home } = await listCollections();
  setCollectionsHome(home);
  const clean = path.replace(/\/+$/, '');
  if (clean.startsWith(`${home.replace(/\/+$/, '')}/`)) return clean;
  return importCollection(clean, { replace: true });
}

let initial: Promise<void> | null = null;

/**
 * What opens at launch. In dev, `ILMI_VAULT=/path npm run tauri dev` imports
 * the folder at that path as a collection (`devCollection`) and opens it,
 * and `ILMI_SMOKE=…` then runs `smoke.ts`; `ILMI_SMOKE=welcome` runs its
 * smoke before any collection opens, with `ILMI_VAULT`'s as the one it
 * expects on the welcome. Otherwise the recents decide
 * (`startFromRecents`). Runs once, however many times React's StrictMode
 * mounts the effect.
 */
export function openInitialVault(): Promise<void> {
  initial ??= (async () => {
    // where the app runs, before anything is drawn by it (`platform.ts`)
    useApp.setState({ mobile: (await loadPlatform()).mobile });
    if (import.meta.env.DEV) {
      const path = await invoke<string | null>('dev_env', { name: 'ILMI_VAULT' });
      const mode = await invoke<string | null>('dev_env', { name: 'ILMI_SMOKE' });
      // the second window (`ILMI_VAULT2`, the sync smoke's other device): its own vault, or the smoke's steps
      if (getCurrentWindow().label === 'second') {
        const path2 = await invoke<string | null>('dev_env', { name: 'ILMI_VAULT2' });
        const storage = await devStorage();
        if (mode === 'sync' || mode === 'nudge' || mode === 'crdt' || mode === 'storage') {
          const { smokeSyncSecond } = await import('./smoke.js');
          await smokeSyncSecond(path2, mode);
        } else if (path2 && storage) {
          // a second copy of what the first window's collection put in the storage, under the name `ILMI_VAULT2` ends in
          await openVault(await joinCollection(storage, vaultName(path2), true));
        } else if (path2) {
          await openVault(await devCollection(path2));
        }
        return;
      }
      if (mode === 'welcome') {
        const { smokeWelcome } = await import('./smoke.js');
        await smokeWelcome(path ? await devCollection(path) : null);
        return;
      }
      // the size smoke makes its own collections from the folder, and opens each
      if (mode === 'size') {
        const { smokeSize } = await import('./smoke.js');
        await smokeSize(path);
        return;
      }
      // the iPad's own smoke starts at its welcome: the clone is its first step
      if (mode === 'ipad') {
        const { smokeIpad } = await import('./smoke.js');
        await smokeIpad();
        return;
      }
      if (path) {
        const vault = await openVault(await devCollection(path));
        if (mode) {
          const { smoke, smokeReader, smokeCards, smokeIntake, smokeQueue, smokeLoop, smokeShots, smokeDeck, smokePri, smokeGrowth, smokeOverload, smokeFaces, smokeCardsText, smokeAnki, smokeMath, smokeEpub, smokeClip, smokeClipping, smokePlugins, smokeDictionary, smokeRender, smokeLive, smokeBlocks, smokeUse, smokeLand, smokeNest, smokeTabs, smokeDecks, smokeTour, smokeNotes, smokeEditing, smokeTree, smokeInsert, smokeTabs2, smokeListCards, smokeArabic, smokeRest, smokeBothWays, smokeNumbers, smokeOpen, smokeExam, smokeSame, smokeSections, smokeBook, smokeBooks, smokeTextSections, smokeZoom, smokeCadence, smokeReadme, smokeSync, smokeNudge, smokeStore, smokeCrdt, smokeStorage } = await import('./smoke.js');
          const run = { reader: smokeReader, cards: smokeCards, intake: smokeIntake, queue: smokeQueue, loop: smokeLoop, shots: smokeShots, deck: smokeDeck, pri: smokePri, growth: smokeGrowth, overload: smokeOverload, faces: smokeFaces, 'cards-text': smokeCardsText, anki: smokeAnki, math: smokeMath, epub: smokeEpub, clip: smokeClip, clipping: smokeClipping, plugins: smokePlugins, dictionary: smokeDictionary, render: smokeRender, live: smokeLive, blocks: smokeBlocks, use: smokeUse, land: smokeLand, nest: smokeNest, tabs: smokeTabs, decks: smokeDecks, tour: smokeTour, notes: smokeNotes, editing: smokeEditing, tree: smokeTree, insert: smokeInsert, tabs2: smokeTabs2, listcards: smokeListCards, arabic: smokeArabic, rest: smokeRest, bothways: smokeBothWays, numbers: smokeNumbers, open: smokeOpen, exam: smokeExam, same: smokeSame, sections: smokeSections, book: smokeBook, books: smokeBooks, textsections: smokeTextSections, zoom: smokeZoom, cadence: smokeCadence, readme: smokeReadme, sync: smokeSync, nudge: smokeNudge, store: smokeStore, crdt: smokeCrdt, storage: smokeStorage }[mode] ?? smoke;
          // the smokes before 40 expect the inspector wherever they open it: the room rule is the tour's to check
          if (mode !== 'tour') useApp.setState({ inspForced: true });
          await run(vault);
        }
        return;
      }
    }
    await startFromRecents();
  })();
  return initial;
}

// ── view ─────────────────────────────────────────────────────────

/** Open `path` in a tab; a notebook's page (`tabs.ts`) shows in the tab its notebook already has, the rail kept. */
export function openNode(path: string, opts: OpenOpts = {}): void {
  const s = useApp.getState();
  const nb = notebookOf(path, s.docs);
  const panes = openTab(s.panes, path, opts, nb ? (id) => notebookOf(id, s.docs) === nb : undefined);
  useApp.setState({ panes });
  queueSave({ tab: activeTab(panes)?.id ?? '' });
}

/**
 * Open the document and land on one of its cards: the deck selects the row,
 * the reader selects the node, and either scrolls to it. The lens clears
 * `reveal` once it has, or when the card is not there any more.
 */
export function openCard(path: string, index: number, id?: string, opts: OpenOpts = {}): void {
  useApp.setState({ reveal: id === undefined ? { path, index } : { path, index, id } });
  openNode(path, opts);
}

/** The intake, placing into `dir` (a folder path; `''` for the root). One tab, wherever it is. */
export function openIntake(dir = '', opts: OpenOpts = {}): void {
  useApp.setState({ intakeDir: dir });
  openNode(INTAKE, opts);
}

/**
 * Start a session at `item`: today's queue rotated to begin there, or the
 * item alone when it is not due. The one session tab opens, or comes to
 * the front and starts over.
 */
export function openSession(item: QueueItem, opts: OpenOpts = {}): void {
  const s = useApp.getState();
  const items = sessionItems(dueToday(s.queue, appNow(), s.budget), item);
  useApp.setState({ session: { seq: (s.session?.seq ?? 0) + 1, items } });
  openNode(SESSION, opts);
}

/** Enter the queue: a session over everything due, from the top. */
export function startSession(opts: OpenOpts = {}): void {
  const s = useApp.getState();
  const first = dueToday(s.queue, appNow(), s.budget)[0];
  if (first) openSession(first, opts);
}

/**
 * Postpone the backlog: the reading and writing due before today, lowest
 * key first; what is first due today is left alone, cards untouched; one
 * line per file. Resolves to how many.
 */
export async function postponeRest(): Promise<number> {
  const s = useApp.getState();
  const done = await postponeOverflow(need(), s.queue, appNow());
  if (done.length) note(`postponed · ${done.length} element${done.length === 1 ? '' : 's'}`);
  return done.length;
}

/** One line for the queue's recent log, newest first, six kept. */
export function note(line: string): void {
  useApp.setState((s) => ({ log: [line, ...s.log].slice(0, 6) }));
}

export function rememberTab(): void {
  queueSave({ tab: activeTab(useApp.getState().panes)?.id ?? '' });
}

export function toggleOpen(path: string, force?: boolean): void {
  const open = { ...useApp.getState().open };
  const next = force ?? !open[path];
  if (next) open[path] = true;
  else delete open[path];
  useApp.setState({ open });
  queueSave({ folders: Object.keys(open) });
}

export function setSidebar(patch: Partial<Sidebar>): void {
  const sidebar = { ...useApp.getState().sidebar, ...patch };
  useApp.setState({ sidebar });
  queueSave({ sidebar });
}

/**
 * ⌃⌘S and the iPad's toggle in the top strip: the sidebar shown or hidden.
 * On an iPad in portrait it is a sheet over the page, open or not, and the
 * saved state (the column's) is left as it is.
 */
export function toggleSidebar(): void {
  const s = useApp.getState();
  if (s.mobile && window.innerWidth <= window.innerHeight) useApp.setState({ sideSheet: !s.sideSheet });
  else setSidebar({ hidden: !s.sidebar.hidden });
}

export function setInspector(patch: Partial<Inspector>): void {
  const inspector = { ...useApp.getState().inspector, ...patch };
  useApp.setState({ inspector });
  queueSave({ inspector });
}

/**
 * ⌘⇧I, the top strip's toggle, the palette: hide the inspector when it is
 * drawn, else show it, past the room rule (`layout.ts`) when the window is
 * narrow; closed, it is closed in the saved state too.
 */
export function toggleInspector(): void {
  const s = useApp.getState();
  if (inspectorShown(s, window.innerWidth)) {
    useApp.setState({ inspForced: false });
    setInspector({ open: false });
  } else {
    useApp.setState({ inspForced: true });
    setInspector({ open: true });
  }
}

/** The tab rail's width, dragged by its edge; one for every notebook, remembered in `.ilmi/state.json`. */
export function setRailWidth(w: number): void {
  const railWidth = clampRail(w);
  if (railWidth === useApp.getState().railWidth) return;
  useApp.setState({ railWidth });
  queueSave({ railWidth });
}

/** Fold notebook `nb`'s tab rail to a strip, or open it; remembered per document in `.ilmi/state.json`. */
export function setRailFolded(nb: string, folded: boolean): void {
  const railFolded = { ...useApp.getState().railFolded };
  if (folded) railFolded[nb] = true;
  else delete railFolded[nb];
  useApp.setState({ railFolded });
  queueSave({ rails: Object.keys(railFolded) });
}

/** The day's budget, 0 for none; kept with the vault's other view state. */
export function setBudget(n: number): void {
  const budget = cleanBudget(n);
  useApp.setState({ budget });
  queueSave({ budget });
}

/** Folds as read from `.ilmi/state.json`: a list of strings per path, anything else dropped. */
export function cleanFolds(raw: unknown): Record<string, string[]> {
  const out: Record<string, string[]> = {};
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return out;
  for (const [k, v] of Object.entries(raw as Record<string, unknown>)) {
    if (!Array.isArray(v)) continue;
    const keys = v.filter((x): x is string => typeof x === 'string');
    if (keys.length) out[k] = keys;
  }
  return out;
}

/** The headings folded in document `path`'s reader, by key; kept with the vault's other view state, never in the file. */
export function setFolds(path: string, keys: readonly string[]): void {
  const cur = useApp.getState().folds;
  const was = cur[path] ?? [];
  if (was.length === keys.length && was.every((k, i) => k === keys[i])) return;
  const folds = { ...cur };
  if (keys.length) folds[path] = [...keys];
  else delete folds[path];
  useApp.setState({ folds });
  queueSave({ folds });
}

/** The deck browser's chips and sort for the lens `id`; kept with the vault's other view state. */
export function setDeckView(id: string, view: DeckView): void {
  const deckViews = { ...useApp.getState().deckViews, [id]: view };
  useApp.setState({ deckViews });
  queueSave({ decks: deckViews });
}

/** Every document the vault last reported, by path: what the finder of the same fact (same.ts) and a link's other side are read from. */
export function allDocs(): [string, Doc][] {
  return [...bodies];
}

/** The parsed documents among `paths`, as the vault last reported them, in that order. */
export function docsOf(paths: readonly string[]): [string, Doc][] {
  const out: [string, Doc][] = [];
  for (const p of paths) {
    const doc = bodies.get(p);
    if (doc) out.push([p, doc]);
  }
  return out;
}

/** Where clippings land when the link names no folder; `''` is the root. Kept with the vault's other view state. */
export function setClipDir(dir: string): void {
  const clipDir = cleanClipDir(dir);
  useApp.setState({ clipDir });
  queueSave({ clippings: clipDir });
}

// ── tree operations ──────────────────────────────────────────────

function need(): Vault {
  if (!current) throw new Error('no vault open');
  return current;
}

/** A new folder or document in `dir`; the folder opens so the new row is visible. Resolves to its path. */
export async function createNode(dir: string, type: NodeType | 'folder'): Promise<string> {
  const vault = need();
  const path = type === 'folder' ? await vault.createFolder(dir) : await vault.createDoc(dir, type);
  openDir(dir);
  return path;
}

/**
 * A new tab in `dir` (a notebook's or a tab's children directory, made on
 * demand): a document of `type`, last in the directory's order, opened in
 * the notebook. Resolves to its path.
 */
export async function createTab(dir: string, type: NodeType, name?: string): Promise<string> {
  const path = await addTab(need(), dir, type, name);
  openNode(path);
  return path;
}

/** `show as tabs` / `show as tree`: set or clear the document's `tabs` field. */
export async function setTabs(path: string, on: boolean): Promise<void> {
  await need().update(path, (doc) => setField(doc, 'tabs', on ? true : null));
}

/** Rename the file; a document that carries a `title` gets the same name there. */
export async function renameNode(path: string, name: string): Promise<string> {
  const vault = need();
  const to = await vault.rename(path, name);
  if (isDoc(to) && to !== path && meta((await vault.read(to)).doc).title !== undefined) {
    await vault.update(to, (doc) => setField(doc, 'title', name.trim()));
  }
  return to;
}

/**
 * The row that shows directory `dir`, opened so a new or moved node in it is
 * visible: a folder's own row, or the document whose children directory it is.
 */
export function openDir(dir: string): void {
  const s = useApp.getState();
  if (dir === '' && s.open['']) return;
  toggleOpen(dir !== '' && s.files.includes(`${dir}.md`) ? `${dir}.md` : dir, true);
}

/** Move into `dir`: the root, a folder, or a document's children directory (made on demand); the row holding it opens. */
export async function moveNode(path: string, dir: string): Promise<string> {
  const to = await need().move(path, dir);
  if (to !== path) openDir(dir);
  return to;
}

/**
 * A drop on the row of `target`: `into` moves `path` inside it (a folder, or
 * a document's children); `before` / `after` move it to `target`'s directory
 * and write that directory's order with it beside `target`. Resolves to the
 * node's new path.
 */
export async function placeNode(path: string, target: string, mode: 'into' | 'before' | 'after'): Promise<string> {
  const to = await need().place(path, target, mode);
  if (to !== path) openDir(dirOf(to));
  return to;
}

/** Forget the order chosen for directory `dir`: its children list by name again. */
export async function sortByName(dir: string): Promise<void> {
  await need().setOrder(dir, null);
}

/** Delete without a notice (a landing's undo); a person's delete is `deleteNode` (`remove.ts`), with one. */
export async function removeNode(path: string): Promise<void> {
  await need().remove(path);
}

/** `duplicate`: a copy beside the node, right after it (`Vault.duplicate`). Resolves to the copy's path. */
export async function duplicateNode(path: string): Promise<string> {
  return need().duplicate(path);
}

/** A new note right after `path` in its directory (a tab rail row's `+`). Resolves to its path. */
export async function noteAfter(path: string): Promise<string> {
  const vault = need();
  const dir = dirOf(path);
  const to = await vault.createDoc(dir, 'note', 'untitled');
  const shown = ordered(childrenAt(vault.tree, dir) ?? [], vault.order[dir]).map((n) => entryOf(n.path));
  await vault.setOrder(dir, placeEntry(shown, entryOf(to), entryOf(path), 'after'));
  openNode(to);
  return to;
}

/** Delete one card from its document; the schedule goes with it. */
export async function removeCard(path: string, index: number, id?: string, text?: string): Promise<void> {
  await need().removeCard(path, index, id, text);
  const sel = useApp.getState().selectedCard;
  if (sel && sel.path === path && sel.index === index) useApp.setState({ selectedCard: null });
  note('removed · card');
}

/** Forget one card's schedule so it comes up as new again; the card and its selection stay. */
export async function resetCard(path: string, index: number, id?: string, text?: string): Promise<void> {
  await need().resetCard(path, index, id, text);
  note('reset · card');
}

/** Move one card to another document; its schedule goes with it, and a selection on it clears. */
export async function moveCard(from: string, index: number, to: string, id?: string, text?: string): Promise<void> {
  await need().moveCard(from, index, to, id, text);
  const sel = useApp.getState().selectedCard;
  if (sel && sel.path === from && sel.index === index) useApp.setState({ selectedCard: null });
  note('moved · card');
}

/** A frozen, unread source from imported text in `dir`; the folder opens so the new row is visible. Resolves to its path. */
export async function importNode(dir: string, spec: ImportSpec): Promise<string> {
  const path = await need().importDoc(dir, spec);
  openDir(dir);
  return path;
}

/** A frozen source with pages: the PDF copied beside its Markdown in `dir`; the folder opens. Resolves to the document's path. */
export async function importPdfNode(dir: string, spec: ImportPdfSpec): Promise<string> {
  const path = await need().importPdf(dir, spec);
  openDir(dir);
  return path;
}

/**
 * A PDF book as a notebook (milestone 46): the pair with `tabs: true`, its
 * chapters as sources in its children directory, each its own pages of the
 * one PDF; the book's row opens. Resolves to the book's document and the
 * chapters' paths.
 */
export async function importPdfBookNode(dir: string, spec: ImportPdfSpec & { chapters: PdfChapterSpec[] }): Promise<{ book: string; paths: string[] }> {
  const r = await need().importPdfBook(dir, spec);
  openDir(dir);
  toggleOpen(r.book, true);
  return r;
}

/** A deck from imported cards in `dir`; the folder opens so the new row is visible. Resolves to its path. */
export async function importDeckNode(dir: string, spec: ImportDeckSpec): Promise<string> {
  const path = await need().importDeck(dir, spec);
  openDir(dir);
  return path;
}

/**
 * The decks of an Anki package as deck files in `dir`: `Parent::Child` lands
 * as `Parent/Child.md`, the folders made as needed; the folder opens.
 * Resolves to the documents' paths, in the decks' order.
 */
export async function importAnkiNode(dir: string, decks: MappedDeck[]): Promise<string[]> {
  const vault = need();
  const paths: string[] = [];
  for (const d of decks) {
    let at = dir;
    for (const seg of d.dir) at = await vault.folderIn(at, seg);
    const path = await vault.importDeck(at, { title: d.title, doc: d.doc });
    paths.push(path);
    // the deck's Anki history, into the review log under its new path
    if (d.reviews.length) {
      const lines = d.reviews.map((r) => ({ ...r, doc: path }));
      await vault.appendReviews(lines);
      reviews = [...reviews, ...lines].sort((a, b) => (a.at < b.at ? -1 : a.at > b.at ? 1 : 0));
      useApp.setState((s) => ({ reviews, ...publishQueue(s.docs, appNow()) }));
    }
  }
  openDir(dir);
  return paths;
}

/**
 * A book as a notebook (milestone 39): a frozen source named for it under
 * `dir` with `tabs: true`, its body the chapters' titles, and its chapters
 * as frozen sources in its children directory, one file per chapter in
 * reading order (`NN title.md`, the title as a field), so they are its
 * tabs; the book's row opens. Resolves to the book's document (`folder`,
 * the directory its chapters are in, for the landing's undo) and the
 * chapters' paths.
 */
export async function importBookNode(dir: string, book: { title: string; chapters: Chapter[] }): Promise<{ book: string; folder: string; paths: string[] }> {
  const vault = need();
  const contents = book.chapters.map((c, i) => `${i + 1}. ${c.title.replace(/\s+/g, ' ').trim() || c.name}`).join('\n');
  const nb = await vault.importDoc(dir, { title: book.title, text: contents });
  await vault.update(nb, (doc) => setField(doc, 'tabs', true));
  const folder = childDirOf(nb);
  const paths: string[] = [];
  for (const c of book.chapters) paths.push(await vault.importDoc(folder, { title: c.title, name: c.name, text: c.text }));
  openDir(dir);
  toggleOpen(nb, true);
  return { book: nb, folder, paths };
}

/** Mark a passage of a text source: a section of the source's note (milestone 50); the source's row opens so the note is visible. */
export async function sectionNode(source: string, spec: SectionSpec): Promise<{ note: string; index: number; text: string; ivl: number }> {
  const made = await need().section(source, spec);
  toggleOpen(source, true);
  return made;
}

/** Fold an extract document into its source's note as a section (milestone 50). */
export async function absorbExtractNode(extract: string): Promise<{ note: string; index: number; text: string }> {
  const made = await need().absorbExtract(extract);
  toggleOpen(`${dirOf(extract)}.md`, true);
  return made;
}

/** Carve a passage of `parent` into a child extract; the parent's row opens so the child is visible. */
export async function extractNode(parent: string, spec: ExtractSpec): Promise<string> {
  const path = await need().extract(parent, spec);
  toggleOpen(parent, true);
  return path;
}

/**
 * Enrol a source or extract in incremental reading, due today, from the
 * top, its interval the cadence of its priority; a note is revisited: the
 * same line without `pos` (FORMAT.md §3). A no-op when it already is.
 */
export async function enrolReading(path: string): Promise<void> {
  await need().update(path, (doc) => {
    const m = meta(doc);
    if (m.read) return;
    const day = dayOf(appNow());
    const ivl = cadence(readPri(m));
    setField(doc, 'read', m.type === 'note' ? { due: day, ivl, reps: 0 } : { due: day, ivl, reps: 0, pos: 0 });
  });
}

/** Where a new sibling of `path` goes: a folder itself, else its directory. */
export function containerOf(path: string): string {
  return isDoc(path) ? dirOf(path) : childDirOf(path);
}
