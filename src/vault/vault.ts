// A vault: a directory of Markdown files, watched, read through `parse`, and
// written through `serialize`. The files are the store of record; this class
// is a cache with a conflict rule: never overwrite a file whose stamp moved
// since we read it.

import { meta, parse, serialize, setField, type Diagnostic, type Doc, type NodeType, type ReadSchedule } from '../format/index.js';
import { join, relative, sameStamp, type Fs, type Stamp } from './fs.js';
import { baseOf, childDirOf, cleanName, dirOf, isDoc, joinRel, nameOf, rekey, within } from './paths.js';
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
  | { kind: 'gone'; path: string }
  /** A rename or move done through this vault; `from` and `to` are the node's paths, children followed. */
  | { kind: 'moved'; from: string; to: string };

/** View state in `.ilmi/state.json`. Optional, never required. */
export interface VaultState {
  /** Open folder paths in the sidebar (a document with children counts as one). */
  folders?: string[];
  /** What was open last. */
  tab?: string;
  /** Sidebar width in px, and whether it is hidden. */
  sidebar?: { width?: number; hidden?: boolean };
}

/** Default file names for new nodes, by type. */
export const NEW_NAMES: Record<NodeType | 'folder', string> = {
  folder: 'untitled folder',
  source: 'untitled',
  deck: 'untitled deck',
  draft: 'untitled draft',
  extract: 'untitled extract',
};

/** What `Vault.extract` carves out of a document. */
export interface ExtractSpec {
  /** The passage, paragraphs separated by blank lines. */
  text: string;
  /**
   * Indices into the parent's blocks the passage touches. Paragraphs and
   * cards among them get a backref; the marker moves past the last one.
   */
  blocks: number[];
  /** File name; by default the passage's first words. */
  name?: string;
  today?: string;
}

/** A file name from a passage: its first five words, punctuation dropped. */
export function extractName(text: string): string {
  const words = text.replace(/[^\p{L}\p{N}\s'-]/gu, ' ').trim().split(/\s+/).filter(Boolean);
  return cleanName(words.slice(0, 5).join(' ')) ?? NEW_NAMES.extract;
}

const STATE_DIR = '.ilmi';

const localDay = (d: Date): string =>
  `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
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
    // our own write is a change too: a lens showing this file in another
    // pane, and the sidebar's counts, follow it the same way as an external one
    this.emit({ kind: 'doc', path, loaded });
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


  // --- tree ---------------------------------------------------------------
  //
  // Every operation goes to disk through `fs`, then re-walks the tree and
  // re-keys the cache, so the UI only ever sees what the directory holds.
  // Names are file names: a folder's, or a document's without `.md`.

  /** Run `fn` after any pending watcher work, and let nothing interleave with it. */
  private serial<T>(fn: () => Promise<T>): Promise<T> {
    const run = this.pending.then(fn);
    this.pending = run.then(() => {}, () => {});
    return run;
  }

  /** True when `dir/name` or `dir/name.md` exists: both would collide with a doc or a folder of that name. */
  private async taken(dir: string, name: string): Promise<boolean> {
    return !!(await this.fs.stat(this.abs(joinRel(dir, name)))) || !!(await this.fs.stat(this.abs(joinRel(dir, `${name}.md`))));
  }

  /** `name`, else `name 2`, `name 3`, … the first free one in `dir`. */
  private async freeName(dir: string, name: string): Promise<string> {
    if (!(await this.taken(dir, name))) return name;
    for (let n = 2; ; n++) {
      const cand = `${name} ${n}`;
      if (!(await this.taken(dir, cand))) return cand;
    }
  }

  /** `dir` must be the root, an existing folder, or the children directory of an existing document (made on demand). */
  private async ensureDir(dir: string): Promise<void> {
    if (dir === '') return;
    const st = await this.fs.stat(this.abs(dir));
    if (st?.isDir) return;
    if (st) throw new Error(`${dir}: not a folder`);
    if (!(await this.fs.stat(this.abs(`${dir}.md`)))) throw new Error(`${dir}: no such folder`);
    await this.fs.mkdir(this.abs(dir));
  }

  private async rewalk(): Promise<void> {
    this.tree = await walk(this.fs, this.root);
    this.emit({ kind: 'tree', tree: this.tree });
  }

  /** A new folder in `dir` (`''` for the root, or a document's children directory). Resolves to its path. */
  createFolder(dir: string, name = NEW_NAMES.folder): Promise<string> {
    return this.serial(async () => {
      const clean = cleanName(name);
      if (!clean) throw new Error(`"${name}" is not a folder name`);
      await this.ensureDir(dir);
      const path = joinRel(dir, await this.freeName(dir, clean));
      await this.fs.mkdir(this.abs(path));
      await this.rewalk();
      return path;
    });
  }

  /**
   * A new document of `type` in `dir`. Sources get no front-matter at all;
   * decks, drafts, and extracts get `type:`; a draft also starts today's
   * writing schedule. Resolves to the document's path.
   */
  createDoc(dir: string, type: NodeType, name = NEW_NAMES[type], today?: string): Promise<string> {
    return this.serial(async () => {
      const clean = cleanName(name);
      if (!clean) throw new Error(`"${name}" is not a file name`);
      await this.ensureDir(dir);
      const path = `${joinRel(dir, await this.freeName(dir, clean))}.md`;
      const doc: Doc = { blocks: [] };
      if (type !== 'source') setField(doc, 'type', type);
      if (type === 'draft') {
        const day = today ?? localDay(new Date());
        setField(doc, 'started', day);
        setField(doc, 'write', { due: day, ivl: 1, reps: 0 });
      }
      await this.commit(path, serialize(doc));
      await this.rewalk();
      return path;
    });
  }

  /**
   * Rename a folder or a document in place. A document's children directory
   * moves with it, and if the document is an extract its parent's backrefs
   * follow. Resolves to the new path; a no-op resolves to the old one.
   */
  rename(path: string, name: string): Promise<string> {
    return this.serial(async () => {
      const clean = cleanName(name);
      if (!clean) throw new Error(`"${name}" is not a name`);
      if (clean === nameOf(path)) return path;
      const dir = dirOf(path);
      const to = isDoc(path) ? `${joinRel(dir, clean)}.md` : joinRel(dir, clean);
      await this.relocate(path, to);
      if (isDoc(path)) await this.retargetBackrefs(dir, nameOf(path), clean);
      await this.rewalk();
      return to;
    });
  }

  /**
   * Move a folder or a document into `dir` (`''` for the root, a folder, or a
   * document's children directory). Refuses a move into its own subtree or
   * onto an existing name. Resolves to the new path.
   */
  move(path: string, dir: string): Promise<string> {
    return this.serial(async () => {
      if (dirOf(path) === dir) return path;
      if (within(dir, childDirOf(path))) throw new Error(`cannot move ${path} into itself`);
      await this.ensureDir(dir);
      const to = joinRel(dir, baseOf(path));
      await this.relocate(path, to);
      await this.rewalk();
      return to;
    });
  }

  /** Delete a folder, or a document and its children directory. */
  remove(path: string): Promise<void> {
    return this.serial(async () => {
      await this.fs.remove(this.abs(path));
      if (isDoc(path)) await this.fs.remove(this.abs(childDirOf(path)));
      for (const key of [...this.cache.keys()]) {
        if (rekey(key, path, path) !== null) {
          this.cache.delete(key);
          this.emit({ kind: 'gone', path: key });
        }
      }
      await this.rewalk();
    });
  }

  /**
   * Carve a passage of `parent` into a child extract (FORMAT.md §6.3): a new
   * file in the parent's children directory with `type: extract` and its own
   * reading schedule due today, a backref on each touched paragraph, and the
   * parent's marker moved past the last touched block. Resolves to the
   * child's path.
   */
  extract(parent: string, spec: ExtractSpec): Promise<string> {
    return this.serial(async () => {
      if (!isDoc(parent) || !(await this.fs.stat(this.abs(parent)))) throw new Error(`${parent}: no such document`);
      const text = spec.text.trim();
      if (!text) throw new Error('nothing to extract');
      const clean = spec.name === undefined ? extractName(text) : cleanName(spec.name);
      if (!clean) throw new Error(`"${spec.name}" is not a file name`);
      const dir = childDirOf(parent);
      await this.ensureDir(dir);
      const name = await this.freeName(dir, clean);
      const path = `${joinRel(dir, name)}.md`;
      const today = spec.today ?? localDay(new Date());
      const parentRead = meta((await this.read(parent)).doc).read;
      const doc: Doc = {
        blocks: text.split(/\n[ \t]*\n+/).map((t) => t.trim()).filter(Boolean).map((t) => ({ kind: 'paragraph', text: t })),
      };
      setField(doc, 'type', 'extract');
      setField(doc, 'imported', today);
      const read: ReadSchedule = { due: today, ivl: 1, reps: 0, pos: 0 };
      if (parentRead?.pri !== undefined) read.pri = parentRead.pri;
      setField(doc, 'read', read);
      await this.commit(path, serialize(doc));
      await this.update(parent, (d) => {
        let last = -1;
        let prose = 0;
        d.blocks.forEach((b, i) => {
          const isProse = b.kind !== 'card';
          if (spec.blocks.includes(i)) {
            if (b.kind === 'paragraph' || b.kind === 'card') b.extracts = [...(b.extracts ?? []).filter((n) => n !== name), name];
            if (isProse) last = prose;
          }
          if (isProse) prose++;
        });
        const r = meta(d).read;
        if (r && last >= 0) setField(d, 'read', { ...r, pos: Math.max(r.pos ?? 0, last + 1) });
      });
      await this.rewalk();
      return path;
    });
  }

  /** Rename on disk (`from` → `to`, both vault-relative), children directory included, then re-key the cache. */
  private async relocate(from: string, to: string): Promise<void> {
    if (await this.taken(dirOf(to), nameOf(to))) throw new Error(`${nameOf(to)} already exists`);
    await this.fs.rename(this.abs(from), this.abs(to));
    if (isDoc(from)) {
      const kids = await this.fs.stat(this.abs(childDirOf(from)));
      if (kids?.isDir) await this.fs.rename(this.abs(childDirOf(from)), this.abs(childDirOf(to)));
    }
    for (const [key, loaded] of [...this.cache]) {
      const next = rekey(key, from, to);
      if (next === null) continue;
      this.cache.delete(key);
      this.cache.set(next, { ...loaded, path: next });
    }
    this.emit({ kind: 'moved', from, to });
  }

  /** If `dir` is a document's children directory, point that document's `<!-- extract old -->` lines at `next`. */
  private async retargetBackrefs(dir: string, old: string, next: string): Promise<void> {
    if (dir === '') return;
    const parent = `${dir}.md`;
    if (!(await this.fs.stat(this.abs(parent)))) return;
    const cur = await this.read(parent);
    if (!cur.doc.blocks.some((b) => 'extracts' in b && b.extracts?.includes(old))) return;
    await this.update(parent, (doc) => {
      for (const b of doc.blocks) {
        if ('extracts' in b && b.extracts) b.extracts = b.extracts.map((n) => (n === old ? next : n));
      }
    });
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
