// In and out as files (milestone 59). A collection is a database; a vault
// as FORMAT.md describes it is what goes in (`importFolder`) and what
// comes out (`exportFolder`), file for file and byte for byte. Both are a
// copy of a tree from one `Fs` to another: the folder's through
// `tauri-fs.ts` or `node-fs.ts`, the collection's through `storeFs`.

import type { Fs } from './fs.js';
import { join } from './fs.js';
import { stampOf } from './lift.js';

/** What never goes in or out: a repository's own folder, the Finder's file, a half-written file. */
export const skipped = (name: string): boolean => name === '.git' || name === '.DS_Store' || name.endsWith('.ilmi-tmp');

async function copyTree(from: Fs, fromRoot: string, to: Fs, toRoot: string, rel: string, leave?: (path: string) => boolean): Promise<number> {
  let files = 0;
  const entries = (await from.readDir(join(fromRoot, rel))).filter((e) => !skipped(e.name)).sort((a, b) => (a.name < b.name ? -1 : a.name > b.name ? 1 : 0));
  for (const e of entries) {
    const path = rel ? `${rel}/${e.name}` : e.name;
    if (e.isDir) {
      await to.mkdir(join(toRoot, path));
      files += await copyTree(from, fromRoot, to, toRoot, path, leave);
    } else if (e.isFile) {
      if (leave?.(path)) continue;
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
 * how many files were written. `leave` names files that are not written
 * (by vault-relative path): the dated export's PDFs, which are kept once,
 * beside the database.
 */
export async function exportFolder(from: Fs, root: string, to: Fs, dir: string, leave?: (path: string) => boolean): Promise<number> {
  await to.mkdir(dir);
  return copyTree(from, root, to, dir, '', leave);
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

// ── the mirror (milestone 60) ────────────────────────────────────
//
// A folder kept as the collection is, one way, for other tools to read.
// Unlike `mirrorFolder` (the git sync's, over a folder that is the app's
// own), it may sit among a person's files: it removes only what it wrote.

/** What the mirror wrote, in its folder: each file's path and the stamp it was written at. */
export const MIRROR_LIST = '.ilmi-mirror.json';

type Listed = Record<string, string>;

async function readList(to: Fs, dir: string): Promise<Listed | null> {
  if (!(await to.stat(join(dir, MIRROR_LIST)))) return null;
  try {
    const o = JSON.parse(await to.readText(join(dir, MIRROR_LIST))) as { files?: unknown };
    const out: Listed = {};
    if (o.files && typeof o.files === 'object') for (const [k, v] of Object.entries(o.files as Record<string, unknown>)) if (typeof v === 'string') out[k] = v;
    return out;
  } catch {
    return {};
  }
}

/**
 * One pass: every file of the collection `from` (rooted at `root`) that
 * the folder `dir` on `to` does not hold as the list says is written, and
 * every file the list names that the collection no longer has is removed
 * (a directory that leaves empty with it). A row's stamp says whether it
 * changed, so a file that did not is not read; a view under `.ilmi/` has
 * none and is compared by what it holds. Resolves to the paths written or
 * removed. `leave` names files the pass takes no notice of: the ones whose
 * bytes are not on this device (milestone 63), which the mirror gets when
 * they come.
 */
export async function mirrorPass(from: Fs, root: string, to: Fs, dir: string, leave?: (path: string) => boolean): Promise<string[]> {
  const was = (await readList(to, dir)) ?? {};
  const now: Listed = {};
  const changed: string[] = [];
  await to.mkdir(dir);
  const visit = async (rel: string): Promise<void> => {
    for (const e of (await from.readDir(join(root, rel))).filter((x) => !skipped(x.name))) {
      const path = rel ? `${rel}/${e.name}` : e.name;
      if (e.isDir) { await visit(path); continue; }
      if (!e.isFile || leave?.(path)) continue;
      const st = await from.stat(join(root, path));
      let bytes: Uint8Array | null = null;
      let stamp = st && st.mtimeMs ? `${st.mtimeMs}.${st.size}` : '';
      if (!stamp) {
        bytes = await from.readBytes(join(root, path));
        stamp = `=${stampOf(new TextDecoder().decode(bytes))}`;
      }
      now[path] = stamp;
      if (was[path] === stamp) continue;
      const at = path.lastIndexOf('/');
      if (at > 0) await to.mkdir(join(dir, path.slice(0, at)));
      await to.writeBytes(join(dir, path), bytes ?? (await from.readBytes(join(root, path))));
      changed.push(path);
    }
  };
  await visit('');
  for (const path of Object.keys(was)) {
    if (path in now) continue;
    await to.remove(join(dir, path));
    changed.push(path);
    // the directories it leaves empty go with it, up to the mirror's own
    for (let at = path.lastIndexOf('/'); at > 0; at = path.lastIndexOf('/', at - 1)) {
      const parent = join(dir, path.slice(0, at));
      if (!(await to.stat(parent))?.isDir || (await to.readDir(parent)).length) break;
      await to.remove(parent);
    }
  }
  if (changed.length || JSON.stringify(was) !== JSON.stringify(now)) await to.writeText(join(dir, MIRROR_LIST), `${JSON.stringify({ files: now }, null, 2)}\n`);
  return changed;
}

/**
 * Where the collection `name` is mirrored inside the folder `parent`: the
 * folder of its name when that is not there, is empty, or is a mirror
 * already; else `name 2`, `name 3`. A folder that holds something the
 * mirror did not write is never taken.
 */
export async function mirrorDirIn(to: Fs, parent: string, name: string): Promise<string> {
  for (let n = 1; ; n++) {
    const dir = join(parent.replace(/\/+$/, ''), n === 1 ? name : `${name} ${n}`);
    const st = await to.stat(dir);
    if (!st) return dir;
    if (!st.isDir) continue;
    if ((await readList(to, dir)) !== null || !(await to.readDir(dir)).filter((e) => e.name !== '.DS_Store').length) return dir;
  }
}

