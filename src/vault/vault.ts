// A vault: a directory of Markdown files, watched, read through `parse`, and
// written through `serialize`. The files are the store of record; this class
// is a cache with a conflict rule: never overwrite a file whose stamp moved
// since we read it.

import { meta, parse, serialize, setField, type Card, type Diagnostic, type Doc, type NodeType } from '../format/index.js';
import { join, relative, sameStamp, type Fs, type Stamp } from './fs.js';
import { ORDER_FILE, childrenAt, cleanOrder, entryOf, followMove, forget, ordered, placeEntry, pruneOrder, restoreOrder, type Order } from './order.js';
import { addToPage } from './pages.js';
import { baseOf, childDirOf, cleanName, dirOf, fileName, isDoc, joinRel, nameOf, pdfOf, rekey, within } from './paths.js';
import { documents, isDocPath, isHidden, isPdfPath, walk, type DocNode, type TreeNode } from './walk.js';

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
  | { kind: 'moved'; from: string; to: string }
  /** Paths under a dot-directory (`.ilmi/…`) that changed on disk, vault-relative: not documents, but the plugin runtime follows its own files this way. */
  | { kind: 'hidden'; paths: string[] }
  /** The order of the directories (`.ilmi/order.json`) changed, through this vault or on disk. */
  | { kind: 'order'; order: Order };

/** View state in `.ilmi/state.json`. Optional, never required. */
export interface VaultState {
  /** Open folder paths in the sidebar (a document with children counts as one). */
  folders?: string[];
  /** What was open last. */
  tab?: string;
  /** Sidebar width in px, and whether it is hidden. */
  sidebar?: { width?: number; hidden?: boolean };
  /** Inspector width in px, and whether it is open. */
  inspector?: { width?: number; open?: boolean };
  /** How many elements a day holds; the queue folds there. 0 or absent is no fold. */
  budget?: number;
  /** The folder an `ilmi://new` link lands in when it names none; `''` or absent is the root. */
  clippings?: string;
  /** Notebooks (documents with `tabs: true`) whose tab rail is folded to a strip. */
  rails?: string[];
  /** The tab rail's width in px. */
  railWidth?: number;
  /** The deck browser's filter chips and sort, per deck (a lens id: a document, a folder, `''` the root). */
  decks?: Record<string, unknown>;
}

/** What `Vault.remove` took, for `Vault.restore`: every file under it as bytes, its directories, and the order as it was. */
export interface Removed {
  path: string;
  files: { path: string; bytes: Uint8Array }[];
  dirs: string[];
  order: Order;
}

/** Default file names for new nodes, by type. */
export const NEW_NAMES: Record<NodeType | 'folder', string> = {
  folder: 'untitled folder',
  note: 'untitled',
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
  /**
   * The page of the parent's PDF the passage came from. The child carries it
   * on its `read` line, and the passage lands under `## p. <n>` in the parent
   * as the paragraph the backref hangs on; `blocks` is not used.
   */
  page?: number;
  today?: string;
}

/** A file name from a passage: its first five words, punctuation dropped. */
export function extractName(text: string): string {
  const words = text.replace(/[^\p{L}\p{N}\s'-]/gu, ' ').trim().split(/\s+/).filter(Boolean);
  return cleanName(words.slice(0, 5).join(' ')) ?? NEW_NAMES.extract;
}

/** What `Vault.importDoc` lands as a new source. */
export interface ImportSpec {
  /** Display name; also the file name, once it is one, unless `name` says otherwise. */
  title: string;
  /** The file name when it is not the title's: a chapter's `NN title`. */
  name?: string;
  /** The body, as pasted, dropped, or fetched. */
  text: string;
  /** A clipped page's address, author, and published date (FORMAT.md §3); each written when given. */
  url?: string;
  author?: string;
  published?: string;
  /** Text pasted rather than imported: a note, editable, with no `type`, `frozen`, or `imported`. */
  note?: boolean;
  today?: string;
}

/** What `Vault.attachImages` is given for one address: the bytes and the content type, or null when the fetch failed. */
export type ImageGet = (url: string) => Promise<{ bytes: Uint8Array; type: string } | null>;

/** The file extension for an image content type; null when it is not an image this keeps. */
export function imageExt(type: string): string | null {
  const t = type.split(';')[0]!.trim().toLowerCase();
  const ext: Record<string, string> = {
    'image/png': 'png', 'image/jpeg': 'jpg', 'image/jpg': 'jpg', 'image/gif': 'gif', 'image/webp': 'webp',
    'image/avif': 'avif', 'image/svg+xml': 'svg', 'image/bmp': 'bmp', 'image/tiff': 'tiff',
  };
  return ext[t] ?? null;
}

/** What `Vault.importDeck` lands as a new deck. */
export interface ImportDeckSpec {
  title: string;
  /** The deck as built (`type: deck`, the cards, what did not split); `imported` and `title` are set here. */
  doc: Doc;
  today?: string;
}

/** What `Vault.importPdf` lands as a new pair. */
export interface ImportPdfSpec {
  title: string;
  /** The PDF itself, copied beside the document. */
  bytes: Uint8Array;
  /** Its text, page after page, as the fallback body; may be empty for a scan. */
  text: string;
  today?: string;
}

const STATE_DIR = '.ilmi';
const STATE_FILE = `${STATE_DIR}/state.json`;
const TMP_SUFFIX = '.ilmi-tmp';
const MAX_RETRIES = 4;

const localDay = (d: Date): string =>
  `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;

// --- cards ------------------------------------------------------------------

const ID_CHARS = 'abcdefghijklmnopqrstuvwxyz0123456789';

/** A fresh block id, `c` and six random characters: the same shape the grader mints (schedule/queue.ts newId). */
function freshId(): string {
  let s = 'c';
  for (let i = 0; i < 6; i++) s += ID_CHARS[Math.floor(Math.random() * ID_CHARS.length)];
  return s;
}

/** Every `^id` a paragraph or card in `doc` carries. */
function usedIds(doc: Doc): Set<string> {
  const ids = new Set<string>();
  for (const b of doc.blocks) if ((b.kind === 'card' || b.kind === 'paragraph') && b.id) ids.add(b.id);
  return ids;
}

/**
 * The card at `index`, where it was last seen; when it has moved, its id finds
 * it, or its text when it has no id. A card at `index` that is not the one
 * named does not count. Throws when no such card is in `doc`.
 */
function cardIn(doc: Doc, path: string, index: number, id?: string, text?: string): Card {
  const same = (b: Card) => (id !== undefined ? b.id === id : text === undefined || b.text === text);
  const at = doc.blocks[index];
  if (at?.kind === 'card' && same(at)) return at;
  const hit = id === undefined && text === undefined ? undefined : doc.blocks.find((b): b is Card => b.kind === 'card' && same(b));
  if (!hit) throw new Error(`no such card in ${path}`);
  return hit;
}

export class VaultConflict extends Error {
  constructor(public readonly path: string) {
    super(`${path} changed on disk since it was read`);
  }
}

export class Vault {
  tree: TreeNode[] = [];
  /** The order chosen for each directory, as `.ilmi/order.json` holds it (`order.ts`). */
  order: Order = {};
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
    v.order = await v.loadOrder();
    return v;
  }

  abs(rel: string): string {
    return join(this.root, rel);
  }

  documents(): string[] {
    return documents(this.tree);
  }

  /** The tree node of a document, when it is in the tree. */
  private node(path: string): DocNode | undefined {
    const visit = (nodes: TreeNode[]): DocNode | undefined => {
      for (const n of nodes) {
        if (n.kind === 'doc' && n.path === path) return n;
        const hit = n.kind === 'folder' ? visit(n.children) : n.children ? visit(n.children) : undefined;
        if (hit) return hit;
      }
      return undefined;
    };
    return visit(this.tree);
  }

  /**
   * Where a document's pages are: the file its `pdf` field names, relative to
   * it, when that exists; else `name.pdf` beside it, when that exists; else
   * null. Vault-relative.
   */
  async pagesOf(path: string): Promise<string | null> {
    if (!isDoc(path)) return null;
    const named = meta((await this.read(path)).doc).pdf;
    if (named !== undefined) {
      const rel = joinRel(dirOf(path), named).split('/').filter((s) => s && s !== '.').join('/');
      if (!rel.split('/').includes('..') && (await this.fs.stat(this.abs(rel)))?.isDir === false) return rel;
    }
    return this.node(path)?.pdf ?? null;
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
  private atomicWrite(abs: string, text: string): Promise<void> {
    return this.viaTmp(abs, (tmp) => this.fs.writeText(tmp, text));
  }

  private atomicWriteBytes(abs: string, bytes: Uint8Array): Promise<void> {
    return this.viaTmp(abs, (tmp) => this.fs.writeBytes(tmp, bytes));
  }

  private async viaTmp(abs: string, write: (tmp: string) => Promise<void>): Promise<void> {
    const tmp = `${abs}${TMP_SUFFIX}`;
    await write(tmp);
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
    const hidden: string[] = [];
    for (const p of new Set(paths)) {
      const rel = p.startsWith('/') ? relative(this.root, p) : p;
      if (rel === null || rel === '' || rel.endsWith(TMP_SUFFIX)) continue;
      if (isHidden(rel)) {
        hidden.push(rel);
        continue;
      }
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
      } else if (!st || st.isDir || isPdfPath(rel)) {
        // a PDF that came or went is a document's pages coming or going
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
    if (hidden.includes(ORDER_FILE)) {
      const order = await this.loadOrder();
      if (JSON.stringify(order) !== JSON.stringify(this.order)) {
        this.order = order;
        this.emit({ kind: 'order', order });
      }
    }
    if (hidden.length) this.emit({ kind: 'hidden', paths: hidden });
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

  /** True when `dir/name`, `dir/name.md`, or `dir/name.pdf` exists: each would collide with, or be adopted by, a node of that name. */
  private async taken(dir: string, name: string): Promise<boolean> {
    for (const ext of ['', '.md', '.pdf']) if (await this.fs.stat(this.abs(joinRel(dir, name + ext)))) return true;
    return false;
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

  /** The folder `name` in `dir`, made when it is not there (an import's `Parent::Child`). Resolves to its path. */
  folderIn(dir: string, name: string): Promise<string> {
    return this.serial(async () => {
      const clean = cleanName(name);
      if (!clean) throw new Error(`"${name}" is not a folder name`);
      await this.ensureDir(dir);
      const path = joinRel(dir, clean);
      const st = await this.fs.stat(this.abs(path));
      if (st?.isDir) return path;
      if (st) throw new Error(`${path}: not a folder`);
      await this.fs.mkdir(this.abs(path));
      await this.rewalk();
      return path;
    });
  }

  /**
   * A new document of `type` in `dir`. Notes get no front-matter at all;
   * sources, decks, drafts, and extracts get `type:`; a draft also starts
   * today's writing schedule. Resolves to the document's path.
   */
  createDoc(dir: string, type: NodeType, name = NEW_NAMES[type], today?: string): Promise<string> {
    return this.serial(async () => {
      const clean = cleanName(name);
      if (!clean) throw new Error(`"${name}" is not a file name`);
      await this.ensureDir(dir);
      const path = `${joinRel(dir, await this.freeName(dir, clean))}.md`;
      const doc: Doc = { blocks: [] };
      if (type !== 'note') setField(doc, 'type', type);
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
   * A new source in `dir` from imported text: `type: source`, frozen,
   * `imported` today, not enrolled (no `read` or `write`); with `note`, a
   * note instead (no `type`, editable, no `imported`). The text is read as a body the same way a
   * file on disk is, so headings and cards in it are what they would be
   * there. Front-matter in the text is kept, except the fields this sets.
   * The file is named after the title; when the two differ (a numbered
   * name, a character a file name cannot hold, a `name` of its own) the
   * title is written as a field. Resolves to the document's path.
   */
  importDoc(dir: string, spec: ImportSpec): Promise<string> {
    return this.serial(async () => {
      const text = spec.text.trim();
      if (!text) throw new Error('nothing to import');
      const title = spec.title.trim() || NEW_NAMES.source;
      await this.ensureDir(dir);
      const name = await this.freeName(dir, fileName(spec.name ?? title));
      const path = `${joinRel(dir, name)}.md`;
      const { doc } = parse(`${text}\n`);
      if (spec.note) {
        setField(doc, 'type', null);
        setField(doc, 'frozen', null);
        setField(doc, 'imported', null);
      } else {
        setField(doc, 'type', 'source');
        setField(doc, 'frozen', true);
        setField(doc, 'imported', spec.today ?? localDay(new Date()));
      }
      setField(doc, 'read', null);
      setField(doc, 'write', null);
      if (spec.url?.trim()) setField(doc, 'url', spec.url.trim());
      if (spec.author?.trim()) setField(doc, 'author', spec.author.trim());
      if (spec.published?.trim()) setField(doc, 'published', spec.published.trim());
      if (title !== name || meta(doc).title !== undefined) setField(doc, 'title', title);
      await this.commit(path, serialize(doc));
      await this.rewalk();
      return path;
    });
  }

  /**
   * The images a clipped document refers to, downloaded into its own
   * folder (`name/img-01.png` …, where its extracts live; the extension
   * from the content type) and its `![alt](src)` links pointed at them,
   * relative to the document. `get` fetches one address; one that fails,
   * or answers with something that is not an image, leaves its absolute
   * address in place. One write of the document at the end, none when
   * nothing landed. Resolves to the files landed, vault-relative.
   */
  async attachImages(path: string, srcs: string[], get: ImageGet): Promise<string[]> {
    if (!isDoc(path) || !(await this.fs.stat(this.abs(path)))) throw new Error(`${path}: no such document`);
    const dir = childDirOf(path);
    const stem = baseOf(dir);
    const landed = new Map<string, string>();
    let n = 0;
    for (const src of [...new Set(srcs)]) {
      let got: Awaited<ReturnType<ImageGet>>;
      try {
        got = await get(src);
      } catch {
        got = null;
      }
      const ext = got && got.bytes.length ? imageExt(got.type) : null;
      if (!got || !ext) continue;
      n++;
      const file = `img-${String(n).padStart(2, '0')}.${ext}`;
      await this.serial(async () => {
        await this.ensureDir(dir);
        await this.atomicWriteBytes(this.abs(joinRel(dir, file)), got.bytes);
      });
      // the path as Markdown reads it: no bare spaces in a destination, so each segment is percent-encoded
      landed.set(src, `${stem.split('/').map(encodeURIComponent).join('/')}/${file}`);
    }
    if (landed.size) {
      await this.update(path, (doc) => {
        for (const b of doc.blocks) {
          for (const [src, rel] of landed) b.text = b.text.split(`](${src})`).join(`](${rel})`);
        }
      });
      await this.rewalk();
    }
    return [...landed.values()].map((rel) => joinRel(dirOf(path), rel));
  }

  /**
   * A new source with pages in `dir`: the PDF copied to `name.pdf`, and
   * `name.md` beside it, `type: source`, frozen, `imported` today, `pdf: name.pdf`, with the
   * extracted text as the body under a `## text` heading (nothing when the
   * PDF has no text). The title is written as a field when it differs from
   * the name, as `importDoc` does. Resolves to the document's path.
   */
  importPdf(dir: string, spec: ImportPdfSpec): Promise<string> {
    return this.serial(async () => {
      if (!spec.bytes.length) throw new Error('nothing to import');
      const title = spec.title.trim() || NEW_NAMES.source;
      await this.ensureDir(dir);
      const name = await this.freeName(dir, fileName(title));
      const path = `${joinRel(dir, name)}.md`;
      const pdf = `${joinRel(dir, name)}.pdf`;
      const text = spec.text.trim();
      const { doc } = parse(text ? `## text\n\n${text}\n` : '');
      setField(doc, 'type', 'source');
      setField(doc, 'frozen', true);
      setField(doc, 'imported', spec.today ?? localDay(new Date()));
      setField(doc, 'pdf', `${name}.pdf`);
      setField(doc, 'read', null);
      setField(doc, 'write', null);
      if (title !== name || meta(doc).title !== undefined) setField(doc, 'title', title);
      await this.atomicWriteBytes(this.abs(pdf), spec.bytes);
      await this.commit(path, serialize(doc));
      await this.rewalk();
      return path;
    });
  }

  /**
   * A new deck in `dir` from imported cards: `imported` today, named after
   * the title, the title written as a field when the two differ, as
   * `importDoc` does. Resolves to the document's path.
   */
  importDeck(dir: string, spec: ImportDeckSpec): Promise<string> {
    return this.serial(async () => {
      if (!spec.doc.blocks.length) throw new Error('nothing to import');
      const title = spec.title.trim() || NEW_NAMES.deck;
      await this.ensureDir(dir);
      const name = await this.freeName(dir, fileName(title));
      const path = `${joinRel(dir, name)}.md`;
      const doc = spec.doc;
      setField(doc, 'type', 'deck');
      setField(doc, 'imported', spec.today ?? localDay(new Date()));
      if (title !== name || meta(doc).title !== undefined) setField(doc, 'title', title);
      await this.commit(path, serialize(doc));
      await this.rewalk();
      return path;
    });
  }

  /**
   * Rename a folder or a document in place. A document's children directory
   * and its pages move with it (a `pdf` field naming the old stem follows),
   * and if the document is an extract its parent's backrefs follow. Resolves
   * to the new path; a no-op resolves to the old one.
   */
  rename(path: string, name: string): Promise<string> {
    return this.serial(async () => {
      const clean = cleanName(name);
      if (!clean) throw new Error(`"${name}" is not a name`);
      if (clean === nameOf(path)) return path;
      const dir = dirOf(path);
      const to = isDoc(path) ? `${joinRel(dir, clean)}.md` : joinRel(dir, clean);
      const pagesMoved = await this.relocate(path, to);
      if (isDoc(path)) {
        await this.retargetBackrefs(dir, nameOf(path), clean);
        if (pagesMoved && meta((await this.read(to)).doc).pdf === `${nameOf(path)}.pdf`) {
          await this.update(to, (doc) => setField(doc, 'pdf', `${clean}.pdf`));
        }
      }
      await this.rewalk();
      await this.writeOrder(followMove(this.order, path, to));
      return to;
    });
  }

  /**
   * Move a folder or a document into `dir` (`''` for the root, a folder, or a
   * document's children directory, made on demand). A document's children
   * directory and its pages go with it, and a sibling file its `pdf` field
   * names. A children directory the move leaves empty is removed. Refuses a
   * move into its own subtree or onto an existing name. Resolves to the new
   * path.
   */
  move(path: string, dir: string): Promise<string> {
    return this.serial(async () => {
      if (dirOf(path) === dir) return path;
      if (within(dir, childDirOf(path))) throw new Error(`cannot move ${path} into itself`);
      await this.ensureDir(dir);
      const to = joinRel(dir, baseOf(path));
      // a `pdf` field naming a sibling that is not the stem's pages: it goes along, so the name still resolves
      const named = isDoc(path) ? meta((await this.read(path)).doc).pdf : undefined;
      await this.relocate(path, to);
      if (named !== undefined && !named.includes('/') && named !== baseOf(pdfOf(path))) {
        const from = joinRel(dirOf(path), named);
        const dest = joinRel(dir, named);
        if ((await this.fs.stat(this.abs(from)))?.isDir === false && !(await this.fs.stat(this.abs(dest)))) await this.fs.rename(this.abs(from), this.abs(dest));
      }
      await this.dropIfEmpty(dirOf(path));
      await this.rewalk();
      await this.writeOrder(followMove(this.order, path, to));
      return to;
    });
  }

  /**
   * A drop on the row of `target`: `into` moves `path` inside it (a folder,
   * or a document's children directory, made on demand); `before` / `after`
   * move it to `target`'s directory and write that directory's order with it
   * beside `target`, every other entry in the order shown now. Resolves to
   * the node's new path.
   */
  async place(path: string, target: string, mode: 'into' | 'before' | 'after'): Promise<string> {
    if (mode === 'into') return this.move(path, childDirOf(target));
    if (path === target) return path;
    const dir = dirOf(target);
    const to = await this.move(path, dir);
    const shown = ordered(childrenAt(this.tree, dir) ?? [], this.order[dir]).map((n) => entryOf(n.path));
    await this.setOrder(dir, placeEntry(shown, entryOf(to), entryOf(target), mode));
    return to;
  }

  /** `dir`, when it is a document's children directory with nothing left in it, removed. A plain folder stays, empty or not. */
  private async dropIfEmpty(dir: string): Promise<void> {
    if (dir === '' || !(await this.fs.stat(this.abs(`${dir}.md`)))) return;
    const st = await this.fs.stat(this.abs(dir));
    if (!st?.isDir) return;
    const entries = await this.fs.readDir(this.abs(dir));
    if (entries.every((e) => e.name.startsWith('.'))) await this.fs.remove(this.abs(dir));
  }

  /**
   * Set the order of directory `dir` (`order.ts`): `names` its entries in
   * order, or null for none (sort by name). The file is written with every
   * stale name dropped.
   */
  setOrder(dir: string, names: string[] | null): Promise<Order> {
    return this.serial(async () => {
      const next = { ...this.order };
      if (names && names.length) next[dir] = [...new Set(names)];
      else delete next[dir];
      await this.writeOrder(next);
      return this.order;
    });
  }

  async loadOrder(): Promise<Order> {
    const abs = this.abs(ORDER_FILE);
    if (!(await this.fs.stat(abs))) return {};
    try {
      return cleanOrder(JSON.parse(await this.fs.readText(abs)));
    } catch {
      return {};
    }
  }

  /** Write `next`, pruned against the tree, when it differs from what is held (stale names held count as a difference); an order never set writes nothing. */
  private async writeOrder(next: Order): Promise<void> {
    const pruned = pruneOrder(next, this.tree);
    if (JSON.stringify(pruned) === JSON.stringify(this.order)) return;
    this.order = pruned;
    await this.fs.mkdir(this.abs(STATE_DIR));
    await this.atomicWrite(this.abs(ORDER_FILE), `${JSON.stringify(pruned, null, 2)}\n`);
    this.emit({ kind: 'order', order: pruned });
  }

  /**
   * Drop one card block from a document: the paragraph, its `^id`, and its
   * schedule lines. `index` is where the card was last seen; when it has moved,
   * its id finds it, or its text when it has no id. Throws when no such card is there.
   */
  removeCard(path: string, index: number, id?: string, text?: string): Promise<Loaded> {
    return this.update(path, (doc) => {
      doc.blocks.splice(doc.blocks.indexOf(cardIn(doc, path, index, id, text)), 1);
    });
  }

  /**
   * Forget a card's schedule so it reads as new again: its bare `sr` line and
   * its `sr cN` lines go; the text, id, extract backrefs, and its own priority
   * stay. Finds the card the way `removeCard` does. A card with no schedule
   * is left as it is.
   */
  resetCard(path: string, index: number, id?: string, text?: string): Promise<Loaded> {
    return this.update(path, (doc) => {
      const card = cardIn(doc, path, index, id, text);
      const pri = card.sched?.pri;
      delete card.sched;
      delete card.blanks;
      if (pri !== undefined) card.sched = { pri };
    });
  }

  /**
   * Cut a card out of `from` and append it to `to`, another document in the
   * vault. Text, id, and schedule travel with it; extract backrefs are dropped,
   * they point into the source's children and go with the card as they do on
   * delete. An id the destination already uses is replaced by a fresh one. The
   * destination is written first, so a crash between the two writes duplicates
   * the card rather than losing it; a card that changes under the move is
   * likewise left in the source, with a `VaultConflict`. Resolves to the
   * destination as written, the card its last block.
   */
  moveCard(from: string, index: number, to: string, id?: string, text?: string): Promise<Loaded> {
    return this.serial(async () => {
      if (from === to) throw new Error(`cannot move a card onto ${from}`);
      if (!isDoc(to) || !(await this.fs.stat(this.abs(to)))) throw new Error(`${to}: no such document`);
      // read fresh: the cache may trail an edit the watcher has not delivered yet
      const card = structuredClone(cardIn((await this.read(from, true)).doc, from, index, id, text));
      delete card.extracts;
      const dest = await this.update(to, (doc) => {
        const moved = structuredClone(card);
        const taken = usedIds(doc);
        if (moved.id !== undefined && taken.has(moved.id)) {
          do moved.id = freshId(); while (taken.has(moved.id));
        }
        doc.blocks.push(moved);
      });
      await this.update(from, (doc) => {
        const cur = cardIn(doc, from, index, id, text);
        const seen = { ...cur };
        delete seen.extracts;
        // not the card that was copied: keep it, a duplicate is visible and a loss is not
        if (JSON.stringify(seen) !== JSON.stringify(card)) throw new VaultConflict(from);
        doc.blocks.splice(doc.blocks.indexOf(cur), 1);
      });
      return dest;
    });
  }

  /**
   * Delete a folder, or a document with its children directory and its
   * pages. Resolves to what went (every file's bytes and the order as it
   * was), so `restore` can bring it back.
   */
  remove(path: string): Promise<Removed> {
    return this.serial(async () => {
      const files: { path: string; bytes: Uint8Array }[] = [];
      const dirs: string[] = [];
      const take = async (rel: string): Promise<void> => {
        const st = await this.fs.stat(this.abs(rel));
        if (!st) return;
        if (!st.isDir) {
          files.push({ path: rel, bytes: await this.fs.readBytes(this.abs(rel)) });
          return;
        }
        dirs.push(rel);
        for (const e of await this.fs.readDir(this.abs(rel))) await take(joinRel(rel, e.name));
      };
      await take(path);
      if (isDoc(path)) {
        await take(childDirOf(path));
        await take(pdfOf(path));
      }
      const removed: Removed = { path, files, dirs, order: structuredClone(this.order) };
      await this.fs.remove(this.abs(path));
      if (isDoc(path)) {
        await this.fs.remove(this.abs(childDirOf(path)));
        await this.fs.remove(this.abs(pdfOf(path)));
      }
      for (const key of [...this.cache.keys()]) {
        if (rekey(key, path, path) !== null) {
          this.cache.delete(key);
          this.emit({ kind: 'gone', path: key });
        }
      }
      await this.dropIfEmpty(dirOf(path));
      await this.rewalk();
      await this.writeOrder(forget(this.order, path));
      return removed;
    });
  }

  /**
   * Put back what `remove` took: its files as they were (a children
   * directory the delete left empty and removed is made again), and its
   * place in its directory's order. Refuses when its name was taken since.
   */
  restore(r: Removed): Promise<void> {
    return this.serial(async () => {
      if (await this.fs.stat(this.abs(r.path))) throw new Error(`${nameOf(r.path)} already exists`);
      const parent = dirOf(r.path);
      if (parent !== '' && !(await this.fs.stat(this.abs(parent)))) await this.fs.mkdir(this.abs(parent));
      for (const d of r.dirs) await this.fs.mkdir(this.abs(d));
      for (const f of r.files) {
        await this.fs.mkdir(this.abs(dirOf(f.path)));
        await this.atomicWriteBytes(this.abs(f.path), f.bytes);
        this.cache.delete(f.path);
      }
      await this.rewalk();
      await this.writeOrder(restoreOrder(this.order, r.order, r.path));
    });
  }

  /**
   * A copy of a document (its children directory and its pages with it) or a
   * folder, beside it as `name copy` (`name copy 2`, …), right after it in
   * its directory's order; a `title` gets ` copy` too. Resolves to the copy's path.
   */
  duplicate(path: string): Promise<string> {
    return this.serial(async () => {
      const dir = dirOf(path);
      const name = await this.freeName(dir, `${nameOf(path)} copy`);
      const to = isDoc(path) ? `${joinRel(dir, name)}.md` : joinRel(dir, name);
      const copy = async (from: string, dest: string): Promise<void> => {
        const st = await this.fs.stat(this.abs(from));
        if (!st) return;
        if (!st.isDir) {
          await this.atomicWriteBytes(this.abs(dest), await this.fs.readBytes(this.abs(from)));
          return;
        }
        await this.fs.mkdir(this.abs(dest));
        for (const e of await this.fs.readDir(this.abs(from))) await copy(joinRel(from, e.name), joinRel(dest, e.name));
      };
      if (!(await this.fs.stat(this.abs(path)))) throw new Error(`${path}: no such node`);
      await copy(path, to);
      if (isDoc(path)) {
        await copy(childDirOf(path), childDirOf(to));
        await copy(pdfOf(path), pdfOf(to));
        const t = meta((await this.read(to, true)).doc).title;
        if (t !== undefined) await this.update(to, (doc) => setField(doc, 'title', `${t} copy`));
      }
      await this.rewalk();
      const shown = ordered(childrenAt(this.tree, dir) ?? [], this.order[dir]).map((n) => entryOf(n.path));
      await this.writeOrder({ ...this.order, [dir]: placeEntry(shown, entryOf(to), entryOf(path), 'after') });
      return to;
    });
  }

  /**
   * Carve a passage of `parent` into a child extract (FORMAT.md §6.3): a new
   * file in the parent's children directory with `type: extract` and its own
   * reading schedule due today, a backref on each touched paragraph, and the
   * parent's marker moved past the last touched block. From a page
   * (`spec.page`), the child's line carries `page=<n>`, the passage lands as
   * a paragraph under `## p. <n>` in the parent with the backref on it, and
   * the marker stays where it is. Resolves to the child's path.
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
      const pm = meta((await this.read(parent)).doc);
      const doc: Doc = {
        blocks: text.split(/\n[ \t]*\n+/).map((t) => t.trim()).filter(Boolean).map((t) => ({ kind: 'paragraph', text: t })),
      };
      setField(doc, 'type', 'extract');
      setField(doc, 'imported', today);
      // the extract starts at the parent's priority (a `pri=` left on the parent's read line counts)
      const pri = pm.pri ?? pm.read?.pri;
      if (pri !== undefined) setField(doc, 'pri', pri);
      setField(doc, 'read', spec.page === undefined ? { due: today, ivl: 1, reps: 0, pos: 0 } : { due: today, ivl: 1, reps: 0, pos: 0, page: spec.page });
      await this.commit(path, serialize(doc));
      await this.update(parent, (d) => {
        if (spec.page !== undefined) {
          addToPage(d, spec.page, { kind: 'paragraph', text: text.replace(/\n[ \t]*\n+/g, '\n'), extracts: [name] });
          return;
        }
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
        // the marker moves past the passage; a note has no marker (FORMAT.md §3)
        const dm = meta(d);
        if (dm.read && dm.type !== 'note' && last >= 0) setField(d, 'read', { ...dm.read, pos: Math.max(dm.read.pos ?? 0, last + 1) });
      });
      await this.rewalk();
      return path;
    });
  }

  /**
   * Rename on disk (`from` → `to`, both vault-relative), children directory
   * and pages included, then re-key the cache. Resolves to whether pages moved.
   */
  private async relocate(from: string, to: string): Promise<boolean> {
    if (await this.taken(dirOf(to), nameOf(to))) throw new Error(`${nameOf(to)} already exists`);
    await this.fs.rename(this.abs(from), this.abs(to));
    let pages = false;
    if (isDoc(from)) {
      const kids = await this.fs.stat(this.abs(childDirOf(from)));
      if (kids?.isDir) await this.fs.rename(this.abs(childDirOf(from)), this.abs(childDirOf(to)));
      const pdf = await this.fs.stat(this.abs(pdfOf(from)));
      if (pdf && !pdf.isDir) {
        await this.fs.rename(this.abs(pdfOf(from)), this.abs(pdfOf(to)));
        pages = true;
      }
    }
    for (const [key, loaded] of [...this.cache]) {
      const next = rekey(key, from, to);
      if (next === null) continue;
      this.cache.delete(key);
      this.cache.set(next, { ...loaded, path: next });
    }
    this.emit({ kind: 'moved', from, to });
    return pages;
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
