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
import { createCollection, deleteCollection, listCollections, tauriStore } from '../vault/tauri-store.js';
import { engineFor } from './crdt.js';
import { vaultName } from './recents.js';

/** The `Fs` over the collection whose folder is `root`, its engine told of every write (`crdt.ts`; it records nothing for a collection that does not sync). */
export function collectionFs(root: string): StoreFs {
  const fs = storeFs(tauriStore(root), root);
  engineFor(fs);
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
  try {
    await importFolder(diskFs, from, collectionFs(root), root);
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
 * folder removed.
 */
export async function exportToZip(fs: Fs, root: string, name: string, dest: string): Promise<number> {
  const tmp = `${root}/export`;
  await invoke('allow_vault', { path: tmp });
  await tauriFs.remove(tmp);
  try {
    await exportFolder(fs, root, diskFs, tmp);
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
