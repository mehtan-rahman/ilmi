// A vault: a directory of Markdown files, watched, read through `parse`, and
// written through `serialize`. The files are the store of record; this class
// is a cache with a conflict rule: never overwrite a file whose stamp moved
// since we read it.

import { parse, serialize, type Diagnostic, type Doc } from '../format/index.js';
import { join, relative, sameStamp, type Fs, type Stamp } from './fs.js';
import { documents, isDocPath, isHidden, walk, type TreeNode } from './walk.js';

export interface Loaded {
  path: string;
  text: string;
  /** Owned by the cache. Change a file through `update`, not by mutating this. */
  doc: Doc;
  diagnostics: Diagnostic[];
  stamp: Stamp | null;
}

export type VaultEvent =
  | { kind: 'tree'; tree: TreeNode[] }
  | { kind: 'doc'; path: string; loaded: Loaded }
  | { kind: 'gone'; path: string };

/** View state in `.ilmi/state.json`. Optional, never required. */
export interface VaultState {
  /** Open folder paths in the sidebar. */
  folders?: string[];
  /** What was open last. */
  tab?: string;
}

const STATE_DIR = '.ilmi';
const STATE_FILE = `${STATE_DIR}/state.json`;
const TMP_SUFFIX = '.ilmi-tmp';
const MAX_RETRIES = 4;

export class VaultConflict extends Error {
  constructor(public readonly path: string) {
    super(`${path} changed on disk since it was read`);
  }
}

export class Vault {
  tree: TreeNode[] = [];
  private cache = new Map<string, Loaded>();
  private listeners = new Set<(ev: VaultEvent) => void>();
  private pending: Promise<void> = Promise.resolve();
  private unwatch: (() => void) | null = null;

  private constructor(readonly fs: Fs, readonly root: string) {}

  static async open(fs: Fs, root: string): Promise<Vault> {
    const st = await fs.stat(root);
    if (!st) throw new Error(`${root}: no such directory`);
    if (!st.isDir) throw new Error(`${root}: not a directory`);
    const v = new Vault(fs, root);
    v.tree = await walk(fs, root);
    return v;
  }

  abs(rel: string): string {
    return join(this.root, rel);
  }

  documents(): string[] {
    return documents(this.tree);
  }

  subscribe(fn: (ev: VaultEvent) => void): () => void {
    this.listeners.add(fn);
    return () => this.listeners.delete(fn);
  }

  private emit(ev: VaultEvent): void {
    for (const fn of this.listeners) fn(ev);
  }

  // --- read ---------------------------------------------------------------

  /** Cached unless `fresh`. Stat before read so a write in between is noticed. */
  async read(path: string, fresh = false): Promise<Loaded> {
    const hit = this.cache.get(path);
    if (hit && !fresh) return hit;
    const abs = this.abs(path);
    const stamp = await this.fs.stat(abs);
    const text = await this.fs.readText(abs);
    const { doc, diagnostics } = parse(text);
    const loaded: Loaded = { path, text, doc, diagnostics, stamp };
    this.cache.set(path, loaded);
    return loaded;
  }

  diagnostics(path: string): Diagnostic[] {
    return this.cache.get(path)?.diagnostics ?? [];
  }

  // --- write --------------------------------------------------------------

  /**
   * Change a file. `mutate` runs on a copy of the current doc; if the file
   * moved on disk since it was read, it is re-read and `mutate` runs again on
   * the fresh copy, so an external edit and this one both land.
   */
  async update(path: string, mutate: (doc: Doc) => void): Promise<Loaded> {
    let cur = await this.read(path);
    for (let attempt = 0; ; attempt++) {
      const doc = structuredClone(cur.doc);
      mutate(doc);
      const text = serialize(doc);
      const now = await this.fs.stat(this.abs(path));
      if (sameStamp(now, cur.stamp)) return this.commit(path, text);
      if (attempt >= MAX_RETRIES) throw new VaultConflict(path);
      cur = await this.read(path, true);
    }
  }

  /** Overwrite with `doc`. Throws `VaultConflict` if the file moved since it was read. */
  async write(path: string, doc: Doc): Promise<Loaded> {
    const cur = await this.read(path);
    const now = await this.fs.stat(this.abs(path));
    if (!sameStamp(now, cur.stamp)) throw new VaultConflict(path);
    return this.commit(path, serialize(doc));
  }

  private async commit(path: string, text: string): Promise<Loaded> {
    const abs = this.abs(path);
    await this.atomicWrite(abs, text);
    const stamp = await this.fs.stat(abs);
    const { doc, diagnostics } = parse(text);
    const loaded: Loaded = { path, text, doc, diagnostics, stamp };
    this.cache.set(path, loaded);
    return loaded;
  }

  /** Temp file next to the target, then rename, so a reader never sees a half-written file. */
  private async atomicWrite(abs: string, text: string): Promise<void> {
    const tmp = `${abs}${TMP_SUFFIX}`;
    await this.fs.writeText(tmp, text);
    try {
      await this.fs.rename(tmp, abs);
    } catch (e) {
      await this.fs.remove(tmp).catch(() => {});
      throw e;
    }
  }

  // --- watch --------------------------------------------------------------

  async watch(): Promise<() => void> {
    if (!this.unwatch) {
      this.unwatch = await this.fs.watch(this.root, (paths) => {
        void this.changed(paths);
      });
    }
    return () => this.close();
  }

  close(): void {
    this.unwatch?.();
    this.unwatch = null;
  }

  /**
   * Something outside us touched these paths (absolute or vault-relative).
   * Cached files that moved are re-read; anything structural re-walks the
   * tree. Calls are serialized so overlapping bursts do not interleave.
   */
  changed(paths: string[]): Promise<void> {
    const run = this.pending.then(() => this.apply(paths));
    this.pending = run.catch(() => {});
    return run;
  }

  private async apply(paths: string[]): Promise<void> {
    let rewalk = false;
    for (const p of new Set(paths)) {
      const rel = p.startsWith('/') ? relative(this.root, p) : p;
      if (rel === null || rel === '' || isHidden(rel) || rel.endsWith(TMP_SUFFIX)) continue;
      const st = await this.fs.stat(this.abs(rel));
      if (isDocPath(rel)) {
        const hit = this.cache.get(rel);
        if (!st) {
          if (hit) {
            this.cache.delete(rel);
            this.emit({ kind: 'gone', path: rel });
          }
          rewalk = true;
        } else if (st.isDir) {
          rewalk = true;
        } else if (!hit) {
          rewalk = true;
        } else if (!sameStamp(st, hit.stamp)) {
          const loaded = await this.read(rel, true);
          this.emit({ kind: 'doc', path: rel, loaded });
        }
      } else if (!st || st.isDir) {
        rewalk = true;
      }
    }
    if (rewalk) {
      const tree = await walk(this.fs, this.root);
      if (JSON.stringify(tree) !== JSON.stringify(this.tree)) {
        this.tree = tree;
        this.emit({ kind: 'tree', tree });
      }
    }
  }

  // --- state --------------------------------------------------------------

  async loadState(): Promise<VaultState> {
    const abs = this.abs(STATE_FILE);
    if (!(await this.fs.stat(abs))) return {};
    try {
      const parsed: unknown = JSON.parse(await this.fs.readText(abs));
      return parsed && typeof parsed === 'object' && !Array.isArray(parsed) ? (parsed as VaultState) : {};
    } catch {
      return {};
    }
  }

  async saveState(patch: VaultState): Promise<VaultState> {
    const next = { ...(await this.loadState()), ...patch };
    await this.fs.mkdir(this.abs(STATE_DIR));
    await this.atomicWrite(this.abs(STATE_FILE), `${JSON.stringify(next, null, 2)}\n`);
    return next;
  }
}
