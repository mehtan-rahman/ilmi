// Collections (milestone 59): each is a database under the app's data
// directory (`src-tauri/src/store.rs`), named by its folder there, and that
// folder's path is the vault's root. A folder of Markdown files is what
// goes in (`import folder`) and what comes out (`export collection`, as a
// folder or a zip): FORMAT.md is the contract for both, and the copy is
// `src/vault/transfer.ts`'s, the same one the tests hold to the corpus.

import { invoke } from '@tauri-apps/api/core';
import { open as pickDirectory, save as pickSave } from '@tauri-apps/plugin-dialog';
import { baseOf, exportFolder, fileName, importFolder, storeFs, type Fs, type StoreFs, type Vault } from '../vault/index.js';
import { tauriFs } from '../vault/tauri-fs.js';
import { collectionHeld, createCollection, deleteCollection, listCollections, renameCollection, tauriStore } from '../vault/tauri-store.js';
import { engineFor } from './crdt.js';
import { vaultKey } from './platform.js';
import { forgetStorage } from './storage.js';
import { vaultName } from './recents.js';

/** The `Fs` over the collection whose folder is `root`, its engine told of every write (`crdt.ts`; it records nothing for a collection that does not sync). */
export function collectionFs(root: string): StoreFs {
  const fs = storeFs(tauriStore(root), root);
  engineFor(fs, root);
  return fs;
}

const isHidden = (path: string): boolean => baseOf(path).startsWith('.');
const allowHidden = (path: string): Promise<void> => invoke<void>('allow_hidden', { path });

/**
 * A folder on disk for an import or an export. The fs scope reaches a
 * dot-name only when it is granted by name (`lib.rs`), so each hidden
 * entry is granted as it is met: `.ilmi/` and whatever else a vault holds.
 */
export const diskFs: Fs = {
  ...tauriFs,
  async readDir(path) {
    const entries = await tauriFs.readDir(path);
    for (const e of entries) if (e.name.startsWith('.')) await allowHidden(`${path}/${e.name}`);
    return entries;
  },
  async mkdir(path) {
    if (isHidden(path)) await allowHidden(path);
    await tauriFs.mkdir(path);
  },
  async writeBytes(path, bytes) {
    if (isHidden(path)) await allowHidden(path);
    await tauriFs.writeBytes(path, bytes);
  },
  async writeText(path, text) {
    if (isHidden(path)) await allowHidden(path);
    await tauriFs.writeText(path, text);
  },
};

/** `name`, else `name 2`, `name 3`, … the first not in `taken`. */
export function freeName(name: string, taken: readonly string[]): string {
  if (!taken.includes(name)) return name;
  for (let n = 2; ; n++) if (!taken.includes(`${name} ${n}`)) return `${name} ${n}`;
}

/**
 * The folder at `dir`, a vault as FORMAT.md describes it, as a new
 * collection named after it (`name 2` when the name is taken; with
 * `replace`, the collection of that name is deleted first: a dev run's
 * fresh copy). Resolves to the collection's root. A collection whose
 * import fails is removed again.
 */
export async function importCollection(dir: string, opts: { name?: string; replace?: boolean } = {}): Promise<string> {
  const from = dir.replace(/\/+$/, '');
  await invoke('allow_vault', { path: from });
  if (!(await tauriFs.stat(from))?.isDir) throw new Error('not a folder');
  const { home, names } = await listCollections();
  const base = fileName(opts.name ?? baseOf(from));
  if (opts.replace && names.includes(base)) await deleteCollection(`${home}/${base}`);
  const root = await createCollection(opts.replace ? base : freeName(base, names));
  forgetStorage(root);
  try {
    await importFolder(diskFs, from, collectionFs(root), root, true);
  } catch (e) {
    await deleteCollection(root).catch(() => { /* the import's error is the one to show */ });
    throw e;
  }
  return root;
}

/** The collection `fs` holds at `root`, written to the folder `dest` as a vault again; how many files. */
export async function exportToFolder(fs: Fs, root: string, dest: string): Promise<number> {
  await invoke('allow_vault', { path: dest });
  return exportFolder(fs, root, diskFs, dest);
}

/**
 * The same as one zip at `dest`, its files under a folder named `name`:
 * written out beside the database first, zipped by the Rust side, and the
 * folder removed. `leave` names files not written, and `also` gives files
 * written beside the rest once it is out (the dated export's, `keep.ts`).
 */
export async function exportToZip(fs: Fs, root: string, name: string, dest: string, opts: { leave?: (path: string) => boolean; also?: () => Record<string, string> } = {}): Promise<number> {
  const tmp = `${root}/export`;
  await invoke('allow_vault', { path: tmp });
  await tauriFs.remove(tmp);
  try {
    await exportFolder(fs, root, diskFs, tmp, opts.leave);
    // files written beside what was exported: the dated export's list of the PDFs it left out
    for (const [path, text] of Object.entries(opts.also?.() ?? {})) {
      await diskFs.mkdir(`${tmp}/${path.slice(0, Math.max(0, path.lastIndexOf('/')))}`.replace(/\/$/, ''));
      await diskFs.writeText(`${tmp}/${path}`, text);
    }
    return await invoke<number>('zip_folder', { dir: tmp, top: name, dest });
  } finally {
    await tauriFs.remove(tmp).catch(() => { /* a leftover is removed by the next export */ });
  }
}

/**
 * `export collection`: as a folder, the picker asks where and the vault
 * lands there under the collection's name (`name 2` when that is taken);
 * as a zip, the picker asks for the file. Resolves to the path written, or
 * null when the picker was dismissed.
 */
export async function exportCollection(vault: Vault, kind: 'folder' | 'zip'): Promise<string | null> {
  const name = vaultName(vault.root);
  if (kind === 'zip') {
    const dest = await pickSave({ defaultPath: `${name}.zip`, filters: [{ name: 'zip', extensions: ['zip'] }] });
    if (!dest) return null;
    await exportToZip(vault.fs, vault.root, name, dest);
    return dest;
  }
  const parent = await pickDirectory({ directory: true, recursive: true, multiple: false });
  if (!parent) return null;
  const into = parent.replace(/\/+$/, '');
  let dest = `${into}/${name}`;
  for (let n = 2; await tauriFs.stat(dest); n++) dest = `${into}/${name} ${n}`;
  await exportToFolder(vault.fs, vault.root, dest);
  return dest;
}

// ── rename and delete, from the welcome ──────────────────────────

/** What is refused while a window has the collection open. */
export const CLOSE_FIRST = 'close it first';

/**
 * Why `name` cannot be a collection's (`not a name`: empty, hidden, or with
 * a separator, as `clean_name` in `store.rs` has it; `already there`: one
 * of `taken`, whatever its case, since the Mac's disk folds case), or null.
 */
export function nameProblem(name: string, taken: readonly string[]): string | null {
  const s = name.trim();
  if (!s || s.startsWith('.') || /[/\\:\u0000-\u001f\u007f]/.test(s)) return 'not a name';
  if (taken.some((t) => t.toLowerCase() === s.toLowerCase())) return 'already there';
  return null;
}

/**
 * What is kept of a collection outside it, in the webview's storage, each a
 * map by `vaultKey` (the collection's name): its storage (`storage.ts`),
 * its remote and token (`sync.ts`), its mirror's folder (`keep.ts`).
 * Everything else a sync needs is in the collection's folder and moves with
 * it: the engine's device and its record in the database, the repository in
 * `repo/`.
 */
const KEPT_OUTSIDE = ['ilmi.storage', 'ilmi.sync', 'ilmi.mirror'] as const;

/** The settings kept for `from` are `to`'s now (with no `to`, forgotten); whatever a collection once called `to` left behind goes. */
function moveSettings(from: string, to: string | null): void {
  const a = vaultKey(from);
  const b = to === null ? null : vaultKey(to);
  if (a === b) return;
  for (const key of KEPT_OUTSIDE) {
    try {
      const raw = globalThis.localStorage?.getItem(key);
      const all: unknown = raw ? JSON.parse(raw) : null;
      if (!all || typeof all !== 'object') continue;
      const map = all as Record<string, unknown>;
      if (!(a in map) && (b === null || !(b in map))) continue;
      if (b !== null) { if (a in map) map[b] = map[a]; else delete map[b]; }
      delete map[a];
      globalThis.localStorage?.setItem(key, JSON.stringify(map));
    } catch { /* nothing kept, nothing to move */ }
  }
}

/**
 * The collection at `root` called `name` from now on: its folder moved, and
 * what is kept outside it (its storage, its remote, its mirror) moved to
 * the new name, so a collection that syncs goes on as the same device with
 * the same storage. Resolves to the new root. Rejects with `not a name`,
 * `already there`, or `close it first` while a window has it open.
 */
export async function renameCollectionTo(root: string, name: string): Promise<string> {
  const to = await renameCollection(root, name.trim());
  moveSettings(root, to);
  return to;
}

/** The collection at `root` deleted from this device with what is kept outside it; `close it first` while a window has it open. What a storage or a remote holds of it stays there. */
export async function removeCollection(root: string): Promise<void> {
  if (await collectionHeld(root)) throw new Error(CLOSE_FIRST);
  await deleteCollection(root);
  moveSettings(root, null);
}
