// What the plugin tests share: an in-memory fs seeded from the corpus
// vault (`.ilmi/plugins/` included), a bridge that remembers its notices,
// and the small helpers that put another plugin in the fs and turn
// plugins on. `plugins.test.ts` and the shipped plugins' own tests use it.

import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join, relative } from 'node:path';
import { Vault, type Fs, type FsEntry, type FsStat } from '../../vault/index.js';
import type { Bridge } from '../runtime.js';
import { showModal, showPopover } from '../surfaces.js';

// jsdom gives `import.meta.url` an http scheme, so the paths come from this file's directory
export const CORPUS = join(import.meta.dirname, '../../format/__tests__/corpus/vault/');
export const REPO = join(import.meta.dirname, '../../../');
export const ROOT = '/v';

export interface MemFs extends Fs {
  files: Map<string, string | Uint8Array>;
  dirs: Set<string>;
}

export function memFs(): MemFs {
  const files = new Map<string, string | Uint8Array>();
  const dirs = new Set<string>();
  const stamps = new Map<string, number>();
  let clock = 1;
  const parent = (p: string) => p.slice(0, p.lastIndexOf('/'));
  const mkdirp = (p: string) => { for (let d = p; d && d !== '/'; d = parent(d)) dirs.add(d); };
  const touch = (p: string) => stamps.set(p, clock++);
  const size = (v: string | Uint8Array) => (typeof v === 'string' ? Buffer.byteLength(v) : v.length);
  const fs: MemFs = {
    files,
    dirs,
    async readDir(path): Promise<FsEntry[]> {
      if (!dirs.has(path)) throw new Error(`${path}: no such directory`);
      const out = new Map<string, FsEntry>();
      const pre = `${path}/`;
      for (const f of files.keys()) if (f.startsWith(pre) && !f.slice(pre.length).includes('/')) out.set(f, { name: f.slice(pre.length), isDir: false, isFile: true });
      for (const d of dirs) if (d.startsWith(pre) && !d.slice(pre.length).includes('/')) out.set(d, { name: d.slice(pre.length), isDir: true, isFile: false });
      return [...out.values()];
    },
    async stat(path): Promise<FsStat | null> {
      const v = files.get(path);
      if (v !== undefined) return { mtimeMs: stamps.get(path) ?? 0, size: size(v), isDir: false };
      if (dirs.has(path)) return { mtimeMs: 0, size: 0, isDir: true };
      return null;
    },
    async readText(path) {
      const v = files.get(path);
      if (v === undefined) throw new Error(`${path}: no such file`);
      return typeof v === 'string' ? v : new TextDecoder().decode(v);
    },
    async writeText(path, text) {
      if (!dirs.has(parent(path))) throw new Error(`${parent(path)}: no such directory`);
      files.set(path, text);
      touch(path);
    },
    async readBytes(path) {
      const v = files.get(path);
      if (v === undefined) throw new Error(`${path}: no such file`);
      return typeof v === 'string' ? new TextEncoder().encode(v) : v;
    },
    async writeBytes(path, bytes) {
      files.set(path, bytes);
      touch(path);
    },
    async rename(from, to) {
      const v = files.get(from);
      if (v !== undefined) {
        files.delete(from);
        files.set(to, v);
        touch(to);
        return;
      }
      if (!dirs.has(from)) throw new Error(`${from}: no such file`);
      for (const d of [...dirs]) if (d === from || d.startsWith(`${from}/`)) { dirs.delete(d); dirs.add(to + d.slice(from.length)); }
      for (const [f, val] of [...files]) if (f.startsWith(`${from}/`)) { files.delete(f); files.set(to + f.slice(from.length), val); }
    },
    async mkdir(path) { mkdirp(path); },
    async remove(path) {
      files.delete(path);
      for (const d of [...dirs]) if (d === path || d.startsWith(`${path}/`)) dirs.delete(d);
      for (const f of [...files.keys()]) if (f.startsWith(`${path}/`)) files.delete(f);
    },
    async watch() { return () => {}; },
  };
  mkdirp(ROOT);
  return fs;
}

/**
 * The corpus vault, `.ilmi/plugins/` included, copied into the fs. The
 * runtime's tests look at the sample alone, so the other shipped plugins
 * are left out unless `plugins` names them.
 */
export function seed(fs: MemFs, plugins: string[] = ['hello']): void {
  const visit = (dir: string) => {
    for (const name of readdirSync(dir)) {
      const p = join(dir, name);
      const rel = relative(CORPUS, p).split('\\').join('/');
      const m = /^\.ilmi\/plugins\/([^/]+)/.exec(rel);
      if (m && !plugins.includes(m[1]!)) continue;
      if (statSync(p).isDirectory()) {
        fs.dirs.add(`${ROOT}/${rel}`);
        visit(p);
      } else {
        fs.files.set(`${ROOT}/${rel}`, readFileSync(p, 'utf8'));
      }
    }
  };
  visit(CORPUS);
}

/** Another plugin in the fs, as a folder; `code` is the bundle. */
export function addPlugin(fs: MemFs, id: string, code: string, manifest: Record<string, unknown> = {}): void {
  const dir = `${ROOT}/.ilmi/plugins/${id}`;
  fs.dirs.add(dir);
  fs.files.set(`${dir}/plugin.json`, JSON.stringify({ id, name: id, version: '1.0.0', api: 1, ...manifest }));
  fs.files.set(`${dir}/main.js`, code);
}

export function enable(fs: MemFs, ids: string[]): void {
  fs.files.set(`${ROOT}/.ilmi/plugins.json`, JSON.stringify(ids));
}

export interface FakeBridge extends Bridge {
  notices: string[];
  opened: string[];
  /** Every URL `fetch` was asked for. */
  fetched: string[];
}

/** A bridge that remembers; `fetch` answers `ok` unless `answer` says otherwise. */
export function fakeBridge(answer?: (url: string) => Response | Promise<Response>): FakeBridge {
  const notices: string[] = [];
  const bridge: FakeBridge = {
    notices,
    opened: [],
    fetched: [],
    version: '0.1.0',
    notice: (t) => notices.push(t),
    fetch: async (url) => {
      bridge.fetched.push(url);
      return answer ? answer(url) : new Response('ok');
    },
    today: () => [{ kind: 'card', path: 'german.md', block: 3, text: 'x', due: '2026-10-18T12:00:00.000Z', pri: 50 }],
    onQueue: () => () => {},
    current: () => null,
    activeLens: () => ({ path: 'german.md', kind: 'deck' }),
    openLens: (p) => bridge.opened.push(p),
    popover: showPopover,
    modal: showModal,
    addStyle: (id, css) => {
      const el = document.createElement('style');
      el.dataset.plugin = id;
      el.textContent = css;
      document.head.appendChild(el);
      return () => el.remove();
    },
  };
  return bridge;
}

export const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

export { Vault };
