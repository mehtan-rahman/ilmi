// What the plugin tests share: a collection in memory (a `storeFs` over
// `mem-store.ts`, milestone 59) seeded from the corpus vault
// (`.ilmi/plugins/` included), a bridge that remembers its notices, and
// the small helpers that put another plugin in it and turn plugins on.
// `plugins.test.ts` and the shipped plugins' own tests use it. Until 59
// this was an in-memory file system, hence the name.

import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join, relative } from 'node:path';
import { Vault, storeFs, type StoreFs } from '../../vault/index.js';
import { memStore } from '../../vault/mem-store.js';
import type { Bridge } from '../runtime.js';
import { showModal, showPopover } from '../surfaces.js';

// jsdom gives `import.meta.url` an http scheme, so the paths come from this file's directory
export const CORPUS = join(import.meta.dirname, '../../format/__tests__/corpus/vault/');
export const REPO = join(import.meta.dirname, '../../../');
export const ROOT = '/v';

/** The collection's `Fs`, and a test's own hands on its files, behind the vault's back. */
export interface MemFs extends StoreFs {
  /** Write a file, the folders on the way made. */
  put(path: string, text: string): Promise<void>;
  /** A file's text; undefined when it is not there. */
  get(path: string): Promise<string | undefined>;
  has(path: string): Promise<boolean>;
}

export function memFs(): MemFs {
  const fs = storeFs(memStore(), ROOT);
  return {
    ...fs,
    async put(path, text) {
      await fs.mkdir(path.slice(0, path.lastIndexOf('/')));
      await fs.writeText(path, text);
    },
    async get(path) {
      const st = await fs.stat(path);
      return st && !st.isDir ? fs.readText(path) : undefined;
    },
    has: async (path) => !!(await fs.stat(path)),
  };
}

/**
 * The corpus vault, `.ilmi/plugins/` included, copied into the collection.
 * The runtime's tests look at the sample alone, so the other shipped
 * plugins are left out unless `plugins` names them.
 */
export async function seed(fs: MemFs, plugins: string[] = ['hello']): Promise<void> {
  const visit = async (dir: string): Promise<void> => {
    for (const name of readdirSync(dir)) {
      const p = join(dir, name);
      const rel = relative(CORPUS, p).split('\\').join('/');
      const m = /^\.ilmi\/plugins\/([^/]+)/.exec(rel);
      if (m && !plugins.includes(m[1]!)) continue;
      if (statSync(p).isDirectory()) {
        await fs.mkdir(`${ROOT}/${rel}`);
        await visit(p);
      } else {
        await fs.writeBytes(`${ROOT}/${rel}`, new Uint8Array(readFileSync(p)));
      }
    }
  };
  await visit(CORPUS);
}

/** Another plugin in the collection, as a folder; `code` is the bundle. */
export async function addPlugin(fs: MemFs, id: string, code: string, manifest: Record<string, unknown> = {}): Promise<void> {
  const dir = `${ROOT}/.ilmi/plugins/${id}`;
  await fs.put(`${dir}/plugin.json`, JSON.stringify({ id, name: id, version: '1.0.0', api: 1, ...manifest }));
  await fs.put(`${dir}/main.js`, code);
}

export function enable(fs: MemFs, ids: string[]): Promise<void> {
  return fs.put(`${ROOT}/.ilmi/plugins.json`, JSON.stringify(ids));
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
