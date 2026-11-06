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
//
// `folderStorage` is the one storage of this milestone: a directory, over
// an `Fs`. `memStorage` is the tests'.

import type { Fs } from '../vault/fs.js';

export interface Storage {
  /** The files under `prefix` (`devices/`, `blobs/`), by their path from the storage's top. */
  list(prefix: string): Promise<string[]>;
  /** A file's bytes; null when it is not there. */
  read(path: string): Promise<Uint8Array | null>;
  /** A file that is not there yet. Whole or not at all: a reader never sees half of one. */
  write(path: string, bytes: Uint8Array): Promise<void>;
  remove(path: string): Promise<void>;
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
