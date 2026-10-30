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

/** `papers/crick-1995.md` → `papers/crick-1995.pdf`: where a document's pages sit by default. */
export function pdfOf(path: string): string {
  return `${childDirOf(path)}.pdf`;
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

/** Re-key a path under a moved node (a document's children directory included), or `null` if it is not under it. */
export function rekey(path: string, from: string, to: string): string | null {
  if (path === from) return to;
  const fromDir = childDirOf(from);
  const toDir = childDirOf(to);
  if (path === fromDir) return toDir;
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

/**
 * A file name from free text, for an imported title: separators and control
 * characters become spaces, runs of whitespace collapse, a leading dot and a
 * `.md` tail go, and the rest is capped at 80 characters. `untitled` when
 * nothing usable is left.
 */
export function fileName(text: string): string {
  const s = text
    .replace(/[/\\:\x00-\x1f]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .replace(/^\.+/, '')
    .slice(0, 80)
    .replace(/\.md$/i, '')
    .trim();
  return cleanName(s) ?? 'untitled';
}

/** A vault-relative path with its `.` and `..` segments resolved; null when it climbs out of the vault. */
export function normRel(path: string): string | null {
  const out: string[] = [];
  for (const seg of path.split('/')) {
    if (!seg || seg === '.') continue;
    if (seg === '..') {
      if (!out.length) return null;
      out.pop();
    } else out.push(seg);
  }
  return out.join('/');
}

/** `target` relative to the directory `dir` (both vault-relative): `../book.pdf` from `book` to `book.pdf`. */
export function relFrom(dir: string, target: string): string {
  const a = dir ? dir.split('/') : [];
  const b = target.split('/');
  let k = 0;
  while (k < a.length && k < b.length - 1 && a[k] === b[k]) k++;
  return [...Array.from({ length: a.length - k }, () => '..'), ...b.slice(k)].join('/');
}
