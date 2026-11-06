// The filesystem the vault layer runs over. Two adapters: `node-fs.ts` for
// tests and tools, `tauri-fs.ts` for the app. Paths are absolute strings with
// `/` separators; the vault joins them itself.

export interface FsEntry {
  name: string;
  isDir: boolean;
  isFile: boolean;
}

/** Enough of a stat to tell whether a file changed under us. */
export interface Stamp {
  mtimeMs: number;
  size: number;
}

export interface FsStat extends Stamp {
  isDir: boolean;
}

export interface Fs {
  /**
   * A write lands whole or not at all (a store, `store.ts`): the vault
   * writes in place, with no temp file and rename.
   */
  readonly atomic?: boolean;
  readDir(path: string): Promise<FsEntry[]>;
  /** `null` when the path does not exist. */
  stat(path: string): Promise<FsStat | null>;
  readText(path: string): Promise<string>;
  /** Creates or truncates. Not atomic; the vault writes a temp file and renames. */
  writeText(path: string, text: string): Promise<void>;
  /**
   * Add `text` to the end of the file, creating it when missing. Optional:
   * without it the vault reads the file and writes it back whole. Only the
   * review log (`.ilmi/reviews/`) appends.
   */
  appendText?(path: string, text: string): Promise<void>;
  /** The whole file as bytes: a document's pages. */
  readBytes(path: string): Promise<Uint8Array>;
  /** Creates or truncates, like `writeText`. */
  writeBytes(path: string, bytes: Uint8Array): Promise<void>;
  /** Replaces the destination if it exists. */
  rename(from: string, to: string): Promise<void>;
  /** Recursive; succeeds if the directory exists. */
  mkdir(path: string): Promise<void>;
  /** File or directory, recursive. */
  remove(path: string): Promise<void>;
  /**
   * A name for what the file at `path` holds, when it can be written
   * elsewhere by that name alone (`writeRef`) without its bytes being
   * read: a store's PDF or image, by its hash. Null for any other file.
   * Optional: a directory has none.
   */
  ref?(path: string): Promise<string | null>;
  /** The file at `path` holds what `ref` names. */
  writeRef?(path: string, ref: string): Promise<void>;
  /**
   * Watch a directory recursively. `onChange` gets absolute paths of entries
   * that may have changed; the vault stats them to find out what happened.
   */
  watch(path: string, onChange: (paths: string[]) => void): Promise<() => void>;
}

export function join(root: string, rel: string): string {
  if (!rel) return root;
  return root.endsWith('/') ? root + rel : `${root}/${rel}`;
}

/** Vault-relative path for an absolute one, or `null` when it is outside. */
export function relative(root: string, abs: string): string | null {
  const base = root.endsWith('/') ? root : `${root}/`;
  if (abs === root || abs === base) return '';
  if (!abs.startsWith(base)) return null;
  return abs.slice(base.length);
}

export function sameStamp(a: Stamp | null, b: Stamp | null): boolean {
  if (!a || !b) return a === b;
  return a.mtimeMs === b.mtimeMs && a.size === b.size;
}
