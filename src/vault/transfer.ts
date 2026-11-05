// In and out as files (milestone 59). A collection is a database; a vault
// as FORMAT.md describes it is what goes in (`importFolder`) and what
// comes out (`exportFolder`), file for file and byte for byte. Both are a
// copy of a tree from one `Fs` to another: the folder's through
// `tauri-fs.ts` or `node-fs.ts`, the collection's through `storeFs`.

import type { Fs } from './fs.js';
import { join } from './fs.js';

/** What never goes in or out: a repository's own folder, the Finder's file, a half-written file. */
export const skipped = (name: string): boolean => name === '.git' || name === '.DS_Store' || name.endsWith('.ilmi-tmp');

async function copyTree(from: Fs, fromRoot: string, to: Fs, toRoot: string, rel: string): Promise<number> {
  let files = 0;
  const entries = (await from.readDir(join(fromRoot, rel))).filter((e) => !skipped(e.name)).sort((a, b) => (a.name < b.name ? -1 : a.name > b.name ? 1 : 0));
  for (const e of entries) {
    const path = rel ? `${rel}/${e.name}` : e.name;
    if (e.isDir) {
      await to.mkdir(join(toRoot, path));
      files += await copyTree(from, fromRoot, to, toRoot, path);
    } else if (e.isFile) {
      await to.writeBytes(join(toRoot, path), await from.readBytes(join(fromRoot, path)));
      files++;
    }
  }
  return files;
}

/**
 * A vault as FORMAT.md describes it, at `dir` on `from`, into the
 * collection `to` (a `storeFs`) rooted at `root`: every file, `.ilmi/`
 * included. Resolves to how many files went in.
 */
export function importFolder(from: Fs, dir: string, to: Fs, root: string): Promise<number> {
  return copyTree(from, dir, to, root, '');
}

/**
 * The collection `from` rooted at `root`, written to `dir` on `to` as a
 * vault again: each document at the path its names and parents make, the
 * schedule lines in its text, `.ilmi/` in its place, PDFs and images under
 * their names. `dir` is made; what is in it already is left. Resolves to
 * how many files were written.
 */
export async function exportFolder(from: Fs, root: string, to: Fs, dir: string): Promise<number> {
  await to.mkdir(dir);
  return copyTree(from, root, to, dir, '');
}

const same = (a: Uint8Array, b: Uint8Array): boolean => {
  if (a.length !== b.length) return false;
  for (let i = 0; i < a.length; i++) if (a[i] !== b[i]) return false;
  return true;
};

/**
 * `dir` on `to` made to hold exactly what the collection holds: files that
 * differ are written, files and folders the collection does not have are
 * removed, and what `skipped` names (`.git/`) is left alone. The git sync
 * (milestone 53) runs over a folder kept this way. Resolves to the
 * vault-relative paths written or removed.
 */
export async function mirrorFolder(from: Fs, root: string, to: Fs, dir: string): Promise<string[]> {
  const changed: string[] = [];
  const visit = async (rel: string): Promise<void> => {
    await to.mkdir(join(dir, rel));
    const src = (await from.readDir(join(root, rel))).filter((e) => !skipped(e.name));
    const names = new Set(src.map((e) => e.name));
    for (const e of await to.readDir(join(dir, rel))) {
      if (skipped(e.name) || names.has(e.name)) continue;
      await to.remove(join(dir, rel ? `${rel}/${e.name}` : e.name));
      changed.push(rel ? `${rel}/${e.name}` : e.name);
    }
    for (const e of src) {
      const path = rel ? `${rel}/${e.name}` : e.name;
      if (e.isDir) {
        const st = await to.stat(join(dir, path));
        if (st && !st.isDir) await to.remove(join(dir, path));
        await visit(path);
      } else if (e.isFile) {
        const bytes = await from.readBytes(join(root, path));
        const st = await to.stat(join(dir, path));
        if (st?.isDir) await to.remove(join(dir, path));
        if (st && !st.isDir && st.size === bytes.length && same(await to.readBytes(join(dir, path)), bytes)) continue;
        await to.writeBytes(join(dir, path), bytes);
        changed.push(path);
      }
    }
  };
  await visit('');
  return changed;
}

/**
 * The other way, for the files a pull changed: each of `paths` read from
 * `dir` on `from` into the collection (`to`, rooted at `root`), or removed
 * from it when the folder no longer has it.
 */
export async function takeFiles(from: Fs, dir: string, to: Fs, root: string, paths: readonly string[]): Promise<void> {
  for (const path of paths) {
    if (path.split('/').some(skipped)) continue;
    const st = await from.stat(join(dir, path));
    if (!st) await to.remove(join(root, path));
    else if (!st.isDir) {
      const at = path.lastIndexOf('/');
      if (at > 0) await to.mkdir(join(root, path.slice(0, at)));
      await to.writeBytes(join(root, path), await from.readBytes(join(dir, path)));
    }
  }
}
