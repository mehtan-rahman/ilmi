// Vault-relative path arithmetic for tree operations. `''` is the vault root;
// a document path ends in `.md`; its children live in the same path without
// the extension (FORMAT.md §1).

export function dirOf(path: string): string {
  const i = path.lastIndexOf('/');
  return i < 0 ? '' : path.slice(0, i);
}

export function baseOf(path: string): string {
  const i = path.lastIndexOf('/');
  return i < 0 ? path : path.slice(i + 1);
}

export function joinRel(dir: string, name: string): string {
  return dir ? `${dir}/${name}` : name;
}

export function isDoc(path: string): boolean {
  return path.endsWith('.md');
}

/** `papers/wozniak-1990.md` → `papers/wozniak-1990`; a folder path is its own children directory. */
export function childDirOf(path: string): string {
  return isDoc(path) ? path.slice(0, -3) : path;
}

/** Display name: the file name without `.md`. */
export function nameOf(path: string): string {
  const base = baseOf(path);
  return base.endsWith('.md') ? base.slice(0, -3) : base;
}

/** True when `path` is `dir` itself or inside it. `dir` may be `''`. */
export function within(path: string, dir: string): boolean {
  return dir === '' || path === dir || path.startsWith(`${dir}/`);
}

/** Re-key a path under a moved node, or `null` if it is not under it. */
export function rekey(path: string, from: string, to: string): string | null {
  if (path === from) return to;
  const fromDir = childDirOf(from);
  const toDir = childDirOf(to);
  if (path.startsWith(`${fromDir}/`)) return `${toDir}/${path.slice(fromDir.length + 1)}`;
  return null;
}

// eslint-disable-next-line no-control-regex
const BAD_NAME = /[/\\:\x00-\x1f]/;

/** A file name the tree accepts: trimmed, no separators, not hidden, no extension. */
export function cleanName(name: string): string | null {
  const s = name.trim();
  if (!s || s === '.' || s === '..' || s.startsWith('.') || BAD_NAME.test(s) || s.endsWith('.md')) return null;
  return s;
}
