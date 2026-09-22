// The one open vault, and how it gets opened. Kept outside the Zustand store
// because a Vault holds a watcher and a cache; the store gets plain data.
// Every tree operation here goes to disk through the vault and comes back
// through its events; nothing edits the store's tree directly.

import { invoke } from '@tauri-apps/api/core';
import { open as pickDirectory } from '@tauri-apps/plugin-dialog';
import { info } from '@tauri-apps/plugin-log';
import { meta, setField, type Doc, type NodeType } from '../format/index.js';
import { docItems, isDue } from '../schedule/index.js';
import { Vault, childDirOf, dirOf, isDoc, rekey, type ExtractSpec, type TreeNode, type VaultEvent, type VaultState } from '../vault/index.js';
import { tauriFs } from '../vault/tauri-fs.js';
import { activeTab, dropTabs, emptyPanes, openTab, retarget, type OpenOpts } from './panes.js';
import { SIDE_DEFAULT, SIDE_MAX, SIDE_MIN, useApp, type DocInfo, type Sidebar } from './store.js';

let current: Vault | null = null;

export function currentVault(): Vault | null {
  return current;
}

// ── document info ────────────────────────────────────────────────

function infoOf(path: string, doc: Doc, now: Date): DocInfo {
  const m = meta(doc);
  const due = new Set<number>();
  for (const item of docItems(path, doc, now)) if (item.kind === 'card' && isDue(item, now)) due.add(item.block);
  const out: DocInfo = {
    type: m.type,
    frozen: m.frozen,
    cards: doc.blocks.filter((b) => b.kind === 'card').length,
    due: due.size,
  };
  if (m.title !== undefined) out.title = m.title;
  if (m.read) out.read = m.read;
  if (m.write) out.write = m.write;
  return out;
}

async function publishDocs(vault: Vault): Promise<void> {
  const now = new Date();
  const docs: Record<string, DocInfo> = {};
  for (const path of vault.documents()) {
    try {
      docs[path] = infoOf(path, (await vault.read(path)).doc, now);
    } catch (e) {
      console.error(path, e);
    }
  }
  if (current === vault) useApp.setState({ docs });
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
    case 'doc':
      useApp.setState({ docs: { ...s.docs, [ev.path]: infoOf(ev.path, ev.loaded.doc, new Date()) } });
      break;
    case 'gone': {
      const docs = { ...s.docs };
      delete docs[ev.path];
      useApp.setState({ docs, panes: dropTabs(s.panes, ev.path) });
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
  let panes = emptyPanes();
  if (state.tab && (state.tab === '' || vault.documents().includes(state.tab) || (await vault.fs.stat(vault.abs(state.tab)))?.isDir)) {
    panes = openTab(panes, state.tab);
  }
  useApp.setState({ open, sidebar, panes, docs: {} });
  publishTree(vault);
  vault.subscribe((ev) => onEvent(vault, ev));
  await vault.watch();
  await publishDocs(vault);
  if (import.meta.env.DEV) void info(`vault ${path}: ${vault.documents().join(', ')}`);
  return vault;
}

/** Ask for a directory, then open it. Resolves to null if the dialog was dismissed. */
export async function pickVault(): Promise<Vault | null> {
  const dir = await pickDirectory({ directory: true, recursive: true, multiple: false });
  return dir ? openVault(dir) : null;
}

let initial: Promise<void> | null = null;

/**
 * Dev only: `ILMI_VAULT=/path npm run tauri dev` opens that vault at launch;
 * `ILMI_SMOKE=1` then runs `smoke.ts`. Runs once, however many times React's
 * StrictMode mounts the effect.
 */
export function openInitialVault(): Promise<void> {
  if (!import.meta.env.DEV) return Promise.resolve();
  initial ??= (async () => {
    const path = await invoke<string | null>('dev_env', { name: 'ILMI_VAULT' });
    if (!path) return;
    const vault = await openVault(path);
    const mode = await invoke<string | null>('dev_env', { name: 'ILMI_SMOKE' });
    if (mode) {
      const { smoke, smokeReader, smokeCards } = await import('./smoke.js');
      await (mode === 'reader' ? smokeReader(vault) : mode === 'cards' ? smokeCards(vault) : smoke(vault));
    }
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

/** Carve a passage of `parent` into a child extract; the parent's row opens so the child is visible. */
export async function extractNode(parent: string, spec: ExtractSpec): Promise<string> {
  const path = await need().extract(parent, spec);
  toggleOpen(parent, true);
  return path;
}

/** Where a new sibling of `path` goes: a folder itself, else its directory. */
export function containerOf(path: string): string {
  return isDoc(path) ? dirOf(path) : childDirOf(path);
}
