// `Fs` over node:fs, for tests and command-line tools. Not imported by the app.

import { promises as fsp, watch as fsWatch } from 'node:fs';
import type { Fs } from './fs.js';

const WATCH_DEBOUNCE_MS = 50;

export const nodeFs: Fs = {
  async readDir(path) {
    const entries = await fsp.readdir(path, { withFileTypes: true });
    return entries.map((e) => ({ name: e.name, isDir: e.isDirectory(), isFile: e.isFile() }));
  },
  async stat(path) {
    try {
      const s = await fsp.stat(path);
      return { mtimeMs: s.mtimeMs, size: s.size, isDir: s.isDirectory() };
    } catch (e) {
      if ((e as NodeJS.ErrnoException).code === 'ENOENT') return null;
      throw e;
    }
  },
  readText: (path) => fsp.readFile(path, 'utf8'),
  writeText: (path, text) => fsp.writeFile(path, text, 'utf8'),
  appendText: (path, text) => fsp.appendFile(path, text, 'utf8'),
  readBytes: async (path) => new Uint8Array(await fsp.readFile(path)),
  writeBytes: (path, bytes) => fsp.writeFile(path, bytes),
  rename: (from, to) => fsp.rename(from, to),
  mkdir: async (path) => {
    await fsp.mkdir(path, { recursive: true });
  },
  remove: (path) => fsp.rm(path, { recursive: true, force: true }),
  async watch(path, onChange) {
    let queued = new Set<string>();
    let timer: ReturnType<typeof setTimeout> | null = null;
    const flush = () => {
      timer = null;
      const paths = [...queued];
      queued = new Set();
      onChange(paths);
    };
    const watcher = fsWatch(path, { recursive: true }, (_event, filename) => {
      if (filename === null) return;
      queued.add(`${path}/${filename.toString().split('\\').join('/')}`);
      if (!timer) timer = setTimeout(flush, WATCH_DEBOUNCE_MS);
    });
    return () => {
      if (timer) clearTimeout(timer);
      watcher.close();
    };
  },
};
