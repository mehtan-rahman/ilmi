// `Fs` over @tauri-apps/plugin-fs: a directory on disk. Since milestone 59
// the open collection is not one (`store.ts`); this is the folder an import
// reads, the folder an export writes, and the repository the git sync keeps
// beside a collection (`src/app/collections.ts`). A picked directory is
// added to the fs scope by the dialog plugin when it is chosen (recursive),
// so nothing here needs a base directory.

import {
  exists, mkdir, readDir, readFile, readTextFile, remove, rename, stat, watch, writeFile, writeTextFile,
} from '@tauri-apps/plugin-fs';
import type { Fs } from './fs.js';

const WATCH_DEBOUNCE_MS = 100;

export const tauriFs: Fs = {
  async readDir(path) {
    const entries = await readDir(path);
    return entries.map((e) => ({ name: e.name, isDir: e.isDirectory, isFile: e.isFile }));
  },
  async stat(path) {
    try {
      const s = await stat(path);
      return { mtimeMs: s.mtime?.getTime() ?? 0, size: s.size, isDir: s.isDirectory };
    } catch (e) {
      if (await exists(path)) throw e;
      return null;
    }
  },
  readText: (path) => readTextFile(path),
  writeText: (path, text) => writeTextFile(path, text),
  appendText: (path, text) => writeTextFile(path, text, { append: true, create: true }),
  readBytes: (path) => readFile(path),
  writeBytes: (path, bytes) => writeFile(path, bytes),
  rename: (from, to) => rename(from, to),
  mkdir: async (path) => {
    if (!(await exists(path))) await mkdir(path, { recursive: true });
  },
  remove: async (path) => {
    if (await exists(path)) await remove(path, { recursive: true });
  },
  watch: (path, onChange) =>
    watch(path, (ev) => onChange(ev.paths), { recursive: true, delayMs: WATCH_DEBOUNCE_MS }),
};
