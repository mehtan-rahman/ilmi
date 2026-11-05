// The store under a vault (milestone 59). A collection is a database, not a
// directory: every folder, document and file is a row with an id, its
// parent's id and its name (`src-tauri/src/store.rs` holds the tables). A
// document's text is Markdown as FORMAT.md has it; PDFs and images are
// files beside the database, named by their SHA-256.
//
// `Vault` stays pure over `Fs`, and `storeFs` is the `Fs` a store gives it:
// paths are made from names and parents, so `papers/maxwell.md` is the row
// named `maxwell` whose parent is the row named `papers`, and
// `papers/maxwell/` is what has that document for a parent. The app above
// (`vault.fs.readBytes(vault.abs(rel))`, the plugins' files under
// `.ilmi/`) does not change, and nothing reads a Markdown file from disk.
//
// What differs from a directory, said once:
// - A document and its children are one row and the rows under it. They
//   move together: renaming `a.md` takes `a/` with it. A children
//   directory exists (to `stat`) while it holds something.
// - A folder made where a document of that name then lands (`a/` before
//   `a.md`, as a restore writes them) becomes that document; a document
//   removed while it has children leaves them as a folder.
// - Writes are whole (`atomic`), so the vault writes in place.
// - `watch` reports this `Fs`'s own writes, a moment later, as a directory
//   watcher reports an app's own; nothing else writes a collection yet.

import type { Fs, FsEntry, FsStat } from './fs.js';
import { relative } from './fs.js';

export type RowKind = 'folder' | 'doc' | 'file';

/** A row of the tree, without its text. */
export interface Row {
  id: string;
  /** null at the top. */
  parent: string | null;
  /** A folder's name, a document's without `.md`, a file's whole. */
  name: string;
  /** Its position among its siblings; not used until the order leaves `.ilmi/order.json` (milestone 60). */
  place: number | null;
  kind: RowKind;
  /** Bytes of what it holds: its text, or its blob. */
  size: number;
  /** Moves when its content is written; never on a rename or a move. */
  rev: number;
  /** The SHA-256 of the file it is, when it is kept beside the database. */
  blob: string | null;
}

export type Place = Pick<Row, 'id' | 'parent' | 'name' | 'place' | 'kind'>;

/** What a row holds: text (a document's front matter block and the rest), or a blob; `{}` is nothing. */
export interface Content {
  front?: string | null;
  text?: string | null;
  blob?: string | null;
}

/** The rows and blobs of one collection. `tauri-store.ts` is the app's, `mem-store.ts` the tests'. */
export interface Store {
  /** Every row, without text. */
  rows(): Promise<Row[]>;
  /** A row's text: front matter block, then the rest. */
  text(id: string): Promise<string>;
  /** Write a row's place in the tree and, with `content`, what it holds. Without it an existing row keeps its content and its `rev`. */
  put(at: Place, content?: Content): Promise<Row>;
  /** Delete rows; what is under a deleted row goes with it. */
  remove(ids: string[]): Promise<void>;
  blobPut(bytes: Uint8Array): Promise<{ hash: string; size: number }>;
  blobGet(hash: string): Promise<Uint8Array>;
}

/** A fresh row id: 128 random bits in hex. */
export function newId(): string {
  const b = new Uint8Array(16);
  if (globalThis.crypto?.getRandomValues) globalThis.crypto.getRandomValues(b);
  else for (let i = 0; i < b.length; i++) b[i] = Math.floor(Math.random() * 256);
  return [...b].map((x) => x.toString(16).padStart(2, '0')).join('');
}

/**
 * A document's text in two: its front matter block as written (the `---`
 * lines included, by the parser's rule for where it ends) and the rest.
 * `front + text` is the input, byte for byte.
 */
export function splitFront(input: string): { front: string; text: string } {
  const none = { front: '', text: input };
  const start = input.charCodeAt(0) === 0xfeff ? 1 : 0;
  const eol = (from: number): number => {
    const n = input.indexOf('\n', from);
    const r = input.indexOf('\r', from);
    if (r >= 0 && (n < 0 || r < n)) return r;
    return n;
  };
  const after = (at: number): number => (input[at] === '\r' && input[at + 1] === '\n' ? at + 2 : at + 1);
  let end = eol(start);
  if (end < 0 || !/^---[ \t]*$/.test(input.slice(start, end))) return none;
  for (let from = after(end); from <= input.length; ) {
    end = eol(from);
    const line = input.slice(from, end < 0 ? input.length : end);
    if (/^(---|\.\.\.)[ \t]*$/.test(line)) {
      const cut = end < 0 ? input.length : after(end);
      return { front: input.slice(0, cut), text: input.slice(cut) };
    }
    if (end < 0) break;
    from = after(end);
  }
  return none;
}

const docName = (seg: string): string | null => (seg.endsWith('.md') && seg.length > 3 ? seg.slice(0, -3) : null);
const fsName = (r: Row): string => (r.kind === 'doc' ? `${r.name}.md` : r.name);
const hidden = (rel: string): boolean => rel.split('/').some((s) => s.startsWith('.'));
/** The vault's temp name for a file being written (`vault.ts`): it is the file it will be. */
const TMP = '.ilmi-tmp';
const settled = (seg: string): string => (seg.endsWith(TMP) ? seg.slice(0, -TMP.length) : seg);

const encoder = new TextEncoder();
/** Strict: bytes that are not UTF-8 are not text, and a BOM is kept. */
const strict = new TextDecoder('utf-8', { fatal: true, ignoreBOM: true });
const lossy = new TextDecoder('utf-8', { ignoreBOM: true });

type At =
  | { kind: 'root' }
  /** The entry itself: a folder, a document (`x.md`), a file. */
  | { kind: 'row'; row: Row }
  /** A document's children directory (`x` for `x.md`). */
  | { kind: 'kids'; row: Row }
  /** Nothing there; `parent` is the row of the directory it would be in (null the top), undefined when that is missing too. */
  | { kind: 'none'; parent: Row | null | undefined; name: string };

export interface StoreFs extends Fs {
  readonly store: Store;
  readonly atomic: true;
  /** The row a path names, when it names one: a folder, a document, a file. */
  rowAt(path: string): Promise<Row | null>;
}

const WATCH_DEBOUNCE_MS = 30;

/** The `Fs` over `store` for the vault whose root path is `root` (the collection's own folder; nothing under it is read from disk). */
export function storeFs(store: Store, root: string): StoreFs {
  const rows = new Map<string, Row>();
  /** Children by parent id; the top's under `''`. */
  const kids = new Map<string, Set<string>>();
  const key = (parent: string | null): string => parent ?? '';

  const link = (r: Row): void => {
    const old = rows.get(r.id);
    if (old) kids.get(key(old.parent))?.delete(old.id);
    rows.set(r.id, r);
    let set = kids.get(key(r.parent));
    if (!set) kids.set(key(r.parent), (set = new Set()));
    set.add(r.id);
  };
  const unlink = (id: string): void => {
    const r = rows.get(id);
    if (!r) return;
    for (const c of [...(kids.get(id) ?? [])]) unlink(c);
    kids.delete(id);
    kids.get(key(r.parent))?.delete(id);
    rows.delete(id);
  };
  const childrenOf = (parent: string | null): Row[] => [...(kids.get(key(parent)) ?? [])].map((id) => rows.get(id)!);
  const hasKids = (r: Row): boolean => (kids.get(r.id)?.size ?? 0) > 0;
  const find = (parent: string | null, name: string): Row | undefined => childrenOf(parent).find((r) => fsName(r) === name);
  /** The row a path segment descends into: a folder of that name, or the document of that name (its children). */
  const dirRow = (parent: string | null, seg: string): Row | undefined =>
    childrenOf(parent).find((r) => r.name === seg && r.kind !== 'file');
  const under = (id: string | null, top: string): boolean => {
    for (let at = id; at !== null; at = rows.get(at)?.parent ?? null) if (at === top) return true;
    return false;
  };

  const ready: Promise<void> = store.rows().then((all) => { for (const r of all) link(r); });

  const segsOf = (abs: string): string[] | null => {
    const rel = relative(root, abs);
    return rel === null ? null : rel.split('/').filter(Boolean);
  };

  const locate = (abs: string): At => {
    const segs = segsOf(abs);
    if (segs === null) return { kind: 'none', parent: undefined, name: abs };
    if (!segs.length) return { kind: 'root' };
    let cur: Row | null = null;
    for (const seg of segs.slice(0, -1)) {
      const next = dirRow(cur?.id ?? null, seg);
      if (!next) return { kind: 'none', parent: undefined, name: seg };
      cur = next;
    }
    const last = segs[segs.length - 1]!;
    const row = find(cur?.id ?? null, last);
    if (row) return { kind: 'row', row };
    const doc = childrenOf(cur?.id ?? null).find((r) => r.kind === 'doc' && r.name === last);
    if (doc) return { kind: 'kids', row: doc };
    return { kind: 'none', parent: cur, name: last };
  };

  // ── the watcher ────────────────────────────────────────────────
  const watchers = new Set<(paths: string[]) => void>();
  let queued = new Set<string>();
  let timer: ReturnType<typeof setTimeout> | null = null;
  const touched = (...paths: string[]): void => {
    if (!watchers.size) return;
    for (const p of paths) queued.add(p);
    timer ??= setTimeout(() => {
      timer = null;
      const out = [...queued];
      queued = new Set();
      for (const fn of [...watchers]) fn(out);
    }, WATCH_DEBOUNCE_MS);
  };

  // ── writes, one at a time ──────────────────────────────────────
  let chain: Promise<unknown> = ready;
  const serial = <T>(fn: () => Promise<T>): Promise<T> => {
    const run = chain.then(fn, fn);
    chain = run.catch(() => {});
    return run;
  };

  const put = async (at: Place, content?: Content): Promise<Row> => {
    const row = await store.put(at, content);
    link(row);
    return row;
  };
  const drop = async (ids: string[]): Promise<void> => {
    if (!ids.length) return;
    await store.remove(ids);
    for (const id of ids) unlink(id);
  };
  const placeOf = (r: Row, patch: Partial<Place> = {}): Place => ({ id: r.id, parent: r.parent, name: r.name, place: r.place, kind: r.kind, ...patch });

  /** What `data` is stored as at vault-relative `rel`: a document's and a hidden file's text in the row, anything else a blob. */
  const contentFor = async (rel: string, isDoc: boolean, data: string | Uint8Array): Promise<Content> => {
    if (isDoc || hidden(rel)) {
      let text: string | null = null;
      if (typeof data === 'string') text = data;
      else {
        try { text = strict.decode(data); } catch { text = null; }
      }
      if (text !== null) return isDoc ? splitFront(text) : { front: null, text };
    }
    const bytes = typeof data === 'string' ? encoder.encode(data) : data;
    return { blob: (await store.blobPut(bytes)).hash };
  };
  const bytesOf = async (r: Row): Promise<Uint8Array> => (r.blob !== null ? store.blobGet(r.blob) : encoder.encode(await store.text(r.id)));

  /** The row at (`parent`, `seg`) holding `content`, new or taking the place of a folder of the document's name. */
  const create = async (parent: Row | null, seg: string, content: Content): Promise<Row> => {
    const doc = docName(seg);
    const pid = parent?.id ?? null;
    if (doc !== null) {
      const folder = dirRow(pid, doc);
      // `a/` was there first: it is this document now, its children the document's
      if (folder?.kind === 'folder') return put(placeOf(folder, { kind: 'doc' }), content);
    }
    return put({ id: newId(), parent: pid, name: doc ?? seg, place: null, kind: doc !== null ? 'doc' : 'file' }, content);
  };

  const write = (abs: string, data: string | Uint8Array): Promise<void> =>
    serial(async () => {
      const at = locate(abs);
      if (at.kind === 'root' || at.kind === 'kids' || (at.kind === 'row' && at.row.kind === 'folder')) throw new Error(`${abs}: is a directory`);
      const rel = relative(root, abs) ?? '';
      if (at.kind === 'row') {
        await put(placeOf(at.row), await contentFor(rel, at.row.kind === 'doc', data));
      } else {
        if (at.parent === undefined) throw new Error(`${abs}: no such directory`);
        const seg = settled(at.name);
        const content = await contentFor(rel, docName(seg) !== null, data);
        // a temp name keeps its own name; it becomes the file on the rename
        if (seg === at.name) await create(at.parent, seg, content);
        else await put({ id: newId(), parent: at.parent?.id ?? null, name: at.name, place: null, kind: 'file' }, content);
      }
      touched(abs);
    });

  /** A document's row gone: with children it stays as their folder. */
  const dropDoc = async (r: Row): Promise<void> => {
    if (hasKids(r)) await put(placeOf(r, { kind: 'folder' }), {});
    else await drop([r.id]);
  };

  return {
    store,
    atomic: true,

    async rowAt(path) {
      await ready;
      const at = locate(path);
      return at.kind === 'row' ? at.row : null;
    },

    async readDir(path): Promise<FsEntry[]> {
      await ready;
      const at = locate(path);
      const parent = at.kind === 'root' ? null : at.kind === 'kids' ? at.row.id : at.kind === 'row' && at.row.kind === 'folder' ? at.row.id : undefined;
      if (parent === undefined) throw new Error(`${path}: no such directory`);
      const out: FsEntry[] = [];
      for (const r of childrenOf(parent)) {
        out.push({ name: fsName(r), isDir: r.kind === 'folder', isFile: r.kind !== 'folder' });
        if (r.kind === 'doc' && hasKids(r)) out.push({ name: r.name, isDir: true, isFile: false });
      }
      return out;
    },

    async stat(path): Promise<FsStat | null> {
      await ready;
      const at = locate(path);
      if (at.kind === 'root') return { mtimeMs: 0, size: 0, isDir: true };
      if (at.kind === 'kids') return hasKids(at.row) ? { mtimeMs: 0, size: 0, isDir: true } : null;
      if (at.kind === 'none') return null;
      if (at.row.kind === 'folder') return { mtimeMs: 0, size: 0, isDir: true };
      return { mtimeMs: at.row.rev, size: at.row.size, isDir: false };
    },

    async readText(path) {
      await ready;
      const at = locate(path);
      if (at.kind !== 'row' || at.row.kind === 'folder') throw new Error(`${path}: no such file`);
      return at.row.blob !== null ? lossy.decode(await store.blobGet(at.row.blob)) : store.text(at.row.id);
    },

    async readBytes(path) {
      await ready;
      const at = locate(path);
      if (at.kind !== 'row' || at.row.kind === 'folder') throw new Error(`${path}: no such file`);
      return bytesOf(at.row);
    },

    writeText: (path, text) => write(path, text),
    writeBytes: (path, bytes) => write(path, bytes),

    mkdir: (path) =>
      serial(async () => {
        const segs = segsOf(path);
        if (segs === null) throw new Error(`${path}: outside the collection`);
        let cur: Row | null = null;
        let made = false;
        for (const seg of segs) {
          const next: Row | undefined = dirRow(cur?.id ?? null, seg);
          if (next) { cur = next; continue; }
          if (find(cur?.id ?? null, seg)) throw new Error(`${path}: not a directory`);
          cur = await put({ id: newId(), parent: cur?.id ?? null, name: seg, place: null, kind: 'folder' });
          made = true;
        }
        if (made) touched(path);
      }),

    remove: (path) =>
      serial(async () => {
        const at = locate(path);
        if (at.kind === 'none') return;
        if (at.kind === 'root') throw new Error(`${path}: the collection itself`);
        if (at.kind === 'kids') await drop(childrenOf(at.row.id).map((r) => r.id));
        else if (at.row.kind === 'doc') await dropDoc(at.row);
        else await drop([at.row.id]);
        touched(path);
      }),

    rename: (from, to) =>
      serial(async () => {
        if (from === to) return;
        const a = locate(from);
        if (a.kind === 'root' || a.kind === 'none') throw new Error(`${from}: no such file`);
        let b = locate(to);
        if (b.kind === 'root') throw new Error(`${to}: the collection itself`);
        if (b.kind === 'none' && b.parent === undefined) throw new Error(`${to}: no such directory`);
        const toSegs = segsOf(to)!;
        const seg = toSegs[toSegs.length - 1]!;
        // a document without children has no children directory: the name is free
        if (b.kind === 'kids' && !hasKids(b.row) && a.kind === 'row' && a.row.kind !== 'folder') b = { kind: 'none', parent: b.row.parent === null ? null : rows.get(b.row.parent)!, name: seg };

        /** Everything under `src` moved under `dest`. */
        const adopt = async (src: Row, dest: Row): Promise<void> => {
          if (under(dest.id, src.id)) throw new Error(`${to}: inside ${from}`);
          for (const c of childrenOf(src.id)) await put(placeOf(c, { parent: dest.id }));
        };

        if (a.kind === 'kids' || a.row.kind === 'folder') {
          // a directory: a folder's row, or what a document has under it
          const src = a.row;
          if (b.kind === 'row' && b.row.kind !== 'folder') throw new Error(`${to}: not a directory`);
          if ((b.kind === 'row' || b.kind === 'kids') && hasKids(b.row)) throw new Error(`${to}: already exists`);
          if (b.kind === 'none') {
            if (under(b.parent?.id ?? null, src.id)) throw new Error(`${to}: inside ${from}`);
            if (a.kind === 'row') await put(placeOf(src, { parent: b.parent?.id ?? null, name: seg }));
            else await adopt(src, await put({ id: newId(), parent: b.parent?.id ?? null, name: seg, place: null, kind: 'folder' }));
          } else {
            await adopt(src, b.row);
            if (a.kind === 'row') await drop([src.id]);
          }
        } else {
          const src = a.row;
          const rel = relative(root, to) ?? '';
          if (b.kind === 'row' && b.row.kind === 'folder') throw new Error(`${to}: is a directory`);
          if (b.kind === 'kids') throw new Error(`${to}: already exists`);
          if (b.kind === 'row') {
            // onto a file that is there: it holds what the source held, under its own id
            if (b.row.id === src.id) return;
            await put(placeOf(b.row), await contentFor(rel, b.row.kind === 'doc', await bytesOf(src)));
            if (src.kind === 'doc') await dropDoc(src); else await drop([src.id]);
          } else {
            const parent = b.parent ?? null;
            if (under(parent?.id ?? null, src.id)) throw new Error(`${to}: inside ${from}`);
            const doc = docName(seg);
            const kind: RowKind = doc !== null ? 'doc' : 'file';
            const name = doc ?? seg;
            const folder = doc !== null ? dirRow(parent?.id ?? null, doc) : undefined;
            // the content changes shape only when the kind or the place asks: a move keeps the row's `rev`
            const reshape = src.kind !== kind || (src.blob === null && kind === 'file' && !hidden(rel));
            const content = reshape ? await contentFor(rel, kind === 'doc', await bytesOf(src)) : undefined;
            if (src.kind === 'doc' && kind === 'file' && hasKids(src)) {
              // the children stay where they were, as a folder
              await put({ id: newId(), parent: parent?.id ?? null, name, place: null, kind }, content);
              await dropDoc(src);
            } else {
              const moved = await put(placeOf(src, { parent: parent?.id ?? null, name, kind }), content);
              // a folder of the document's name where it lands is the document's from now on
              if (folder?.kind === 'folder' && folder.id !== moved.id) {
                await adopt(folder, moved);
                await drop([folder.id]);
              }
            }
          }
        }
        touched(from, to);
      }),

    async watch(_path, onChange) {
      await ready;
      watchers.add(onChange);
      return () => {
        watchers.delete(onChange);
        if (!watchers.size && timer) { clearTimeout(timer); timer = null; queued = new Set(); }
      };
    },
  };
}
