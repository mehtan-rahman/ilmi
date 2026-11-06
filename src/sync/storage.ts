// Where a collection's changes are kept for its other devices (milestone
// 61). A storage needs four verbs and nothing else: list, read, write a
// file that is not there yet, delete. Nobody overwrites: each device
// writes its own files, once each, and reads everyone else's, so there is
// no "only if unchanged" to ask of a storage, which is what lets a folder
// the OS syncs, and later Google Drive, be one.
//
// The shape inside:
//   format                 what this is, and which collection: written once
//   devices/<device>/<n>   a device's changes, numbered from 1, each written once
//   blobs/<sha256>         a PDF or an image, whole, written before the change that names it
//   snapshots/<device>/<n>/1…k, head
//                          everything a device held when the change files had passed a
//                          count (milestone 63): its parts, then the head that says how many
//                          files of each device it covers. What it covers is deleted thirty
//                          days on, which is the one use `remove` has.
//
// A device's file says in its first line how many lines it has, so one
// read while it is still being written is not taken for whole, whatever
// the storage.
//
// `folderStorage` is a directory, over an `Fs`; `memStorage` is the
// tests'. The app's storages (`src/app/storage.ts`) are a folder, an
// S3-compatible bucket and a WebDAV folder; theirs are the two optional
// verbs, by which a PDF goes between the collection and the storage on the
// Rust side and never through the engine's memory.

import type { Fs } from '../vault/fs.js';

export interface Storage {
  /** The files under `prefix` (`devices/`, `blobs/`), by their path from the storage's top. */
  list(prefix: string): Promise<string[]>;
  /** A file's bytes; null when it is not there. */
  read(path: string): Promise<Uint8Array | null>;
  /** A file that is not there yet. Whole or not at all: a reader never sees half of one. */
  write(path: string, bytes: Uint8Array): Promise<void>;
  remove(path: string): Promise<void>;
  /** The collection's blob `hash` written as `blobs/<hash>`, without passing through here. Optional: without it the engine reads the blob and writes it. */
  up?(hash: string): Promise<void>;
  /** `blobs/<hash>` into the collection's blobs, checked against its name; false when the storage does not hold it. `size` is what the row that names it says, for a progress. */
  down?(hash: string, size: number): Promise<boolean>;
}

/** A name a write goes under until it is whole; a listing leaves these out. */
const PART = '.part';

/** A storage that is a directory at `root`, over `fs`. */
export function folderStorage(fs: Fs, root: string): Storage {
  const at = (path: string): string => `${root.replace(/\/+$/, '')}/${path}`;
  const walk = async (rel: string, out: string[]): Promise<void> => {
    const dir = at(rel.replace(/\/+$/, ''));
    if (!(await fs.stat(dir))?.isDir) return;
    for (const e of await fs.readDir(dir)) {
      if (e.name.startsWith('.') || e.name.endsWith(PART)) continue;
      const path = `${rel.replace(/\/+$/, '')}/${e.name}`.replace(/^\//, '');
      if (e.isDir) await walk(path, out);
      else out.push(path);
    }
  };
  return {
    async list(prefix) {
      const out: string[] = [];
      await walk(prefix, out);
      return out.sort();
    },
    async read(path) {
      if (!(await fs.stat(at(path)))) return null;
      return fs.readBytes(at(path));
    },
    async write(path, bytes) {
      const dir = path.includes('/') ? path.slice(0, path.lastIndexOf('/')) : '';
      await fs.mkdir(at(dir).replace(/\/+$/, ''));
      await fs.writeBytes(at(path) + PART, bytes);
      await fs.rename(at(path) + PART, at(path));
    },
    async remove(path) {
      await fs.remove(at(path));
    },
  };
}

export interface MemStorage extends Storage {
  readonly files: Map<string, Uint8Array>;
}

/** A storage in memory. */
export function memStorage(): MemStorage {
  const files = new Map<string, Uint8Array>();
  return {
    files,
    async list(prefix) { return [...files.keys()].filter((p) => p.startsWith(prefix)).sort(); },
    async read(path) { const b = files.get(path); return b ? new Uint8Array(b) : null; },
    async write(path, bytes) { files.set(path, new Uint8Array(bytes)); },
    async remove(path) { files.delete(path); },
  };
}
