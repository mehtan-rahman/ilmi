// `Fs` over @tauri-apps/plugin-fs, for the app. The picked vault directory is
// added to the fs scope by the dialog plugin when it is chosen (recursive), so
// nothing here needs a base directory.

import {
  exists, mkdir, readDir, readTextFile, remove, rename, stat, watch, writeTextFile,
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
