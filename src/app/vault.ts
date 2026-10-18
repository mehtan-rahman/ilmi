// The one open vault, and how it gets opened. Kept outside the Zustand store
// because a Vault holds a watcher and a cache; the store gets plain data.
// Every tree operation here goes to disk through the vault and comes back
// through its events; nothing edits the store's tree directly.

import { invoke } from '@tauri-apps/api/core';
import { getCurrentWindow } from '@tauri-apps/api/window';
import { open as pickDirectory } from '@tauri-apps/plugin-dialog';
import { info } from '@tauri-apps/plugin-log';
import { meta, setField, type Doc, type NodeType } from '../format/index.js';
import type { Chapter, MappedDeck } from '../import/index.js';
import { dayOf, docItems, isDue, postponeOverflow, sortQueue, type QueueItem } from '../schedule/index.js';
import { Vault, childDirOf, cleanName, dirOf, fileName, isDoc, rekey, type ExtractSpec, type ImportDeckSpec, type ImportPdfSpec, type ImportSpec, type TreeNode, type VaultEvent, type VaultState } from '../vault/index.js';
import { tauriFs } from '../vault/tauri-fs.js';
import { startPlugins, stopPlugins } from '../plugins/index.js';
import { cleanClipDir } from './clip.js';
import { cleanBudget, dueToday, sessionItems } from './items.js';
import { INTAKE, SESSION, queueId, queueScope } from './names.js';
import { activeTab, dropTabs, emptyPanes, openTab, retarget, type OpenOpts } from './panes.js';
import { addRecent, decideStart, forgetRecent, vaultName } from './recents.js';
import { STARTER_TEXT, STARTER_TITLE } from './starter.js';
import { INSP_DEFAULT, INSP_MAX, INSP_MIN, SIDE_DEFAULT, SIDE_MAX, SIDE_MIN, useApp, type DocInfo, type Inspector, type Sidebar } from './store.js';

let current: Vault | null = null;

export function currentVault(): Vault | null {
  return current;
}

// ── document info and the queue ──────────────────────────────────

/** Every document's parsed form, by path, as last reported by the vault; the queue is built from it. */
const bodies = new Map<string, Doc>();

function infoOf(doc: Doc, items: QueueItem[], now: Date, pdf: string | null): DocInfo {
  const m = meta(doc);
  const due = new Set<number>();
  for (const item of items) if (item.kind === 'card' && isDue(item, now)) due.add(item.block);
  const out: DocInfo = {
    type: m.type,
    frozen: m.frozen,
    cards: doc.blocks.filter((b) => b.kind === 'card').length,
    due: due.size,
  };
  if (m.title !== undefined) out.title = m.title;
  if (m.read) out.read = m.read;
  if (m.write) out.write = m.write;
  if (m.pri !== undefined) out.pri = m.pri;
  if (pdf !== null) out.pdf = pdf;
  return out;
}

/** The queue over every known document, at `now`. */
function buildQueue(now: Date): QueueItem[] {
  const out: QueueItem[] = [];
  for (const [path, doc] of bodies) out.push(...docItems(path, doc, now));
  return sortQueue(out, now);
}

/** Rebuild the queue for the present moment: a card in learning steps may have come due. */
export function refreshQueue(): void {
  const now = new Date();
  useApp.setState({ queue: buildQueue(now), queueAt: now });
}

async function publishDocs(vault: Vault): Promise<void> {
  const now = new Date();
  const docs: Record<string, DocInfo> = {};
  const seen = new Set<string>();
  for (const path of vault.documents()) {
    try {
      const doc = (await vault.read(path)).doc;
      bodies.set(path, doc);
      seen.add(path);
      docs[path] = infoOf(doc, docItems(path, doc, now), now, await vault.pagesOf(path));
    } catch (e) {
      console.error(path, e);
    }
  }
  for (const path of [...bodies.keys()]) if (!seen.has(path)) bodies.delete(path);
  if (current === vault) useApp.setState({ docs, queue: buildQueue(now), queueAt: now });
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

function onEvent(vault: Vault, ev: VaultEvent): void {
  if (current !== vault) return;
  const s = useApp.getState();
  switch (ev.kind) {
    case 'tree':
      publishTree(vault);
      void publishDocs(vault);
      break;
    case 'doc': {
      const now = new Date();
      const items = docItems(ev.path, ev.loaded.doc, now);
      bodies.set(ev.path, ev.loaded.doc);
      // the pages stay what they were until the vault has looked: a changed `pdf` field lands a moment later
      useApp.setState({ docs: { ...s.docs, [ev.path]: infoOf(ev.loaded.doc, items, now, s.docs[ev.path]?.pdf ?? null) }, queue: buildQueue(now), queueAt: now });
      void vault.pagesOf(ev.path).then((pdf) => {
        const cur = useApp.getState().docs[ev.path];
        if (current !== vault || !cur || (cur.pdf ?? null) === pdf) return;
        const next = { ...cur };
        if (pdf === null) delete next.pdf; else next.pdf = pdf;
        useApp.setState((st) => ({ docs: { ...st.docs, [ev.path]: next } }));
      });
      break;
    }
    case 'gone': {
      const docs = { ...s.docs };
      delete docs[ev.path];
      bodies.delete(ev.path);
      const now = new Date();
      useApp.setState({ docs, panes: dropTabs(s.panes, ev.path), queue: buildQueue(now), queueAt: now });
      break;
    }
    case 'moved': {
      const docs: Record<string, DocInfo> = {};
      for (const [k, v] of Object.entries(s.docs)) docs[rekey(k, ev.from, ev.to) ?? k] = v;
      useApp.setState({ docs, open: rekeyOpen(s.open, ev.from, ev.to), panes: retarget(s.panes, ev.from, ev.to) });
      break;
    }
  }
}

// ── open ─────────────────────────────────────────────────────────

/** Open the directory at `path`, watch it, and publish its tree. */
export async function openVault(path: string): Promise<Vault> {
  stopPlugins();
  current?.close();
  // The dialog widens the fs scope to what it picked; a path from anywhere
  // else (env var, a remembered vault later) is widened here.
  await invoke('allow_vault', { path });
  const vault = await Vault.open(tauriFs, path);
  current = vault;
  const state = await vault.loadState();
  const open: Record<string, true> = { '': true };
  for (const f of state.folders ?? []) open[f] = true;
  const sidebar: Sidebar = {
    width: Math.min(SIDE_MAX, Math.max(SIDE_MIN, state.sidebar?.width ?? SIDE_DEFAULT)),
    hidden: state.sidebar?.hidden ?? false,
  };
  const inspector: Inspector = {
    width: Math.min(INSP_MAX, Math.max(INSP_MIN, state.inspector?.width ?? INSP_DEFAULT)),
    open: state.inspector?.open ?? window.innerWidth > 1180,
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
  const s0 = useApp.getState();
  useApp.setState({
    open, sidebar, inspector, panes, docs: {}, queue: [], budget: cleanBudget(state.budget), clipDir: cleanClipDir(state.clippings), log: [], session: null, sessionEl: null, selectedCard: null, reveal: null,
    started: true, newVaultIn: null, gone: s0.gone.filter((p) => p !== path),
  });
  s0.setRecents(addRecent(s0.recents, path, new Date()));
  setWindowTitle(vaultName(path));
  publishTree(vault);
  vault.subscribe((ev) => onEvent(vault, ev));
  await vault.watch();
  await publishDocs(vault);
  // the plugins the vault has on; a failure there is theirs, not the vault's
  await startPlugins(vault).catch((e: unknown) => console.error('plugins', e));
  if (import.meta.env.DEV) void info(`vault ${path}: ${vault.documents().join(', ')}`);
  return vault;
}

/** Back to the welcome: the watcher stops, the store forgets the vault's data; the recents keep it. */
export function closeVault(): void {
  current?.close();
  current = null;
  bodies.clear();
  if (saveTimer) { clearTimeout(saveTimer); saveTimer = null; savePatch = {}; }
  useApp.setState({ vault: null, files: [], tree: [], docs: {}, open: { '': true }, panes: emptyPanes(), queue: [], log: [], session: null, sessionEl: null, selectedCard: null, reveal: null, paletteOpen: false, intakeDir: '' });
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

/** Ask for a directory, then open it. Resolves to null if the dialog was dismissed. */
export async function pickVault(): Promise<Vault | null> {
  const dir = await pickDirectory({ directory: true, recursive: true, multiple: false });
  return dir ? openVault(dir) : null;
}

/** Ask for the folder a new vault goes in; the welcome then takes its name. Resolves to the folder, or null if dismissed. */
export async function pickVaultParent(): Promise<string | null> {
  const dir = await pickDirectory({ directory: true, recursive: true, multiple: false });
  if (dir) useApp.setState({ newVaultIn: dir });
  return dir;
}

/**
 * A new vault: the folder `name` in `parent`, with `start here.md` in it (a
 * frozen source on the three loops with one card, enrolled for reading), then
 * opened. Rejects with `already there` when the folder exists.
 */
export async function newVault(parent: string, name: string): Promise<Vault> {
  const clean = cleanName(name);
  if (!clean) throw new Error('not a folder name');
  const root = parent.replace(/\/+$/, '');
  const path = `${root}/${clean}`;
  await invoke('allow_vault', { path: root });
  if (await tauriFs.stat(path)) throw new Error('already there');
  await tauriFs.mkdir(path);
  const vault = await openVault(path);
  const doc = await vault.importDoc('', { title: STARTER_TITLE, text: STARTER_TEXT });
  await vault.update(doc, (d) => setField(d, 'read', { due: dayOf(new Date()), ivl: 1, reps: 0, pos: 0 }));
  openNode(doc);
  return vault;
}

/** Which of `paths` are directories now. Each is let into the fs scope first; they were vaults once. */
async function probeVaults(paths: string[]): Promise<Set<string>> {
  const present = new Set<string>();
  for (const p of paths) {
    try {
      await invoke('allow_vault', { path: p });
      if ((await tauriFs.stat(p))?.isDir) present.add(p);
    } catch (e) {
      console.error(p, e);
    }
  }
  return present;
}

/**
 * The start decision: the folders of the remembered vaults looked for, the
 * missing ones marked, and the newest reopened when the toggle is on and it
 * is there; otherwise the welcome shows.
 */
export async function startFromRecents(): Promise<void> {
  const s = useApp.getState();
  const present = await probeVaults(s.recents.map((r) => r.path));
  useApp.setState({ gone: s.recents.map((r) => r.path).filter((p) => !present.has(p)) });
  const start = decideStart(s.recents, s.reopen, present);
  if (start.kind === 'reopen') {
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

let initial: Promise<void> | null = null;

/**
 * What opens at launch. In dev, `ILMI_VAULT=/path npm run tauri dev` opens
 * that vault and `ILMI_SMOKE=…` then runs `smoke.ts`; `ILMI_SMOKE=welcome`
 * runs its smoke before any vault opens, with `ILMI_VAULT` as the vault it
 * seeds. Otherwise the recents decide (`startFromRecents`). Runs once,
 * however many times React's StrictMode mounts the effect.
 */
export function openInitialVault(): Promise<void> {
  initial ??= (async () => {
    if (import.meta.env.DEV) {
      const path = await invoke<string | null>('dev_env', { name: 'ILMI_VAULT' });
      const mode = await invoke<string | null>('dev_env', { name: 'ILMI_SMOKE' });
      if (mode === 'welcome') {
        const { smokeWelcome } = await import('./smoke.js');
        await smokeWelcome(path);
        return;
      }
      if (path) {
        const vault = await openVault(path);
        if (mode) {
          const { smoke, smokeReader, smokeCards, smokeIntake, smokeQueue, smokeLoop, smokeShots, smokeDeck, smokePri, smokeGrowth, smokeOverload, smokePdf, smokeFaces, smokeCardsText, smokeAnki, smokeMath, smokeEpub, smokeClip, smokePlugins, smokeRender } = await import('./smoke.js');
          const run = { reader: smokeReader, cards: smokeCards, intake: smokeIntake, queue: smokeQueue, loop: smokeLoop, shots: smokeShots, deck: smokeDeck, pri: smokePri, growth: smokeGrowth, overload: smokeOverload, pdf: smokePdf, faces: smokeFaces, 'cards-text': smokeCardsText, anki: smokeAnki, math: smokeMath, epub: smokeEpub, clip: smokeClip, plugins: smokePlugins, render: smokeRender }[mode] ?? smoke;
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

export function openNode(path: string, opts: OpenOpts = {}): void {
  const s = useApp.getState();
  const panes = openTab(s.panes, path, opts);
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
  const items = sessionItems(dueToday(s.queue, new Date(), s.budget), item);
  useApp.setState({ session: { seq: (s.session?.seq ?? 0) + 1, items } });
  openNode(SESSION, opts);
}

/** Enter the queue: a session over everything due, from the top. */
export function startSession(opts: OpenOpts = {}): void {
  const s = useApp.getState();
  const first = dueToday(s.queue, new Date(), s.budget)[0];
  if (first) openSession(first, opts);
}

/**
 * Postpone every reading and writing element below today's fold, lowest
 * priority first; one line per file, cards untouched. Resolves to how many.
 */
export async function postponeRest(): Promise<number> {
  const s = useApp.getState();
  const done = await postponeOverflow(need(), s.queue, new Date(), s.budget);
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

export function setInspector(patch: Partial<Inspector>): void {
  const inspector = { ...useApp.getState().inspector, ...patch };
  useApp.setState({ inspector });
  queueSave({ inspector });
}

/** The day's budget, 0 for none; kept with the vault's other view state. */
export function setBudget(n: number): void {
  const budget = cleanBudget(n);
  useApp.setState({ budget });
  queueSave({ budget });
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
  if (dir !== '' || !useApp.getState().open['']) toggleOpen(dir, true);
  return path;
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

export async function moveNode(path: string, dir: string): Promise<string> {
  const to = await need().move(path, dir);
  if (to !== path) toggleOpen(dir, true);
  return to;
}

export function removeNode(path: string): Promise<void> {
  return need().remove(path);
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
  if (dir !== '' || !useApp.getState().open['']) toggleOpen(dir, true);
  return path;
}

/** A frozen source with pages: the PDF copied beside its Markdown in `dir`; the folder opens. Resolves to the document's path. */
export async function importPdfNode(dir: string, spec: ImportPdfSpec): Promise<string> {
  const path = await need().importPdf(dir, spec);
  if (dir !== '' || !useApp.getState().open['']) toggleOpen(dir, true);
  return path;
}

/** A deck from imported cards in `dir`; the folder opens so the new row is visible. Resolves to its path. */
export async function importDeckNode(dir: string, spec: ImportDeckSpec): Promise<string> {
  const path = await need().importDeck(dir, spec);
  if (dir !== '' || !useApp.getState().open['']) toggleOpen(dir, true);
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
    paths.push(await vault.importDeck(at, { title: d.title, doc: d.doc }));
  }
  if (dir !== '' || !useApp.getState().open['']) toggleOpen(dir, true);
  return paths;
}

/**
 * A book's chapters as frozen sources in a new folder named for it under
 * `dir`, one file per chapter in reading order (`NN title.md`, the title as
 * a field); the folder and the one above it open. Resolves to the folder
 * and the documents' paths.
 */
export async function importBookNode(dir: string, book: { title: string; chapters: Chapter[] }): Promise<{ folder: string; paths: string[] }> {
  const vault = need();
  const folder = await vault.createFolder(dir, fileName(book.title));
  const paths: string[] = [];
  for (const c of book.chapters) paths.push(await vault.importDoc(folder, { title: c.title, name: c.name, text: c.text }));
  if (dir !== '' || !useApp.getState().open['']) toggleOpen(dir, true);
  toggleOpen(folder, true);
  return { folder, paths };
}

/** Carve a passage of `parent` into a child extract; the parent's row opens so the child is visible. */
export async function extractNode(parent: string, spec: ExtractSpec): Promise<string> {
  const path = await need().extract(parent, spec);
  toggleOpen(parent, true);
  return path;
}

/** Enrol a source or extract in incremental reading: due today, from the top. A no-op when it already is. */
export async function enrolReading(path: string): Promise<void> {
  await need().update(path, (doc) => {
    if (!meta(doc).read) setField(doc, 'read', { due: dayOf(new Date()), ivl: 1, reps: 0, pos: 0 });
  });
}

/** Where a new sibling of `path` goes: a folder itself, else its directory. */
export function containerOf(path: string): string {
  return isDoc(path) ? dirOf(path) : childDirOf(path);
}
