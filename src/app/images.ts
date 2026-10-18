// Images the reader draws: a relative source is a file in the vault, read
// through the fs adapter as a blob URL and released when the reader goes;
// an absolute one is left to the webview, and only while the `show remote
// images` tweak is on. The resolution is pure; the loading is not.

import { dirOf, type Vault } from '../vault/index.js';
import type { ImageLoader, ImageState } from '../reader/index.js';

const SCHEME = /^[a-z][a-z0-9+.-]*:/i;

/** True for a source the web (or a `data:` URL) serves, false for a path in the vault. */
export const isRemote = (src: string): boolean => SCHEME.test(src) || src.startsWith('//');

/**
 * The vault-relative path an image `src` names from the document at
 * `doc`: relative to the document's folder, `/` from the vault root,
 * percent escapes decoded, `.` and `..` folded; null when it climbs out of
 * the vault or names nothing.
 */
export function imagePath(doc: string, src: string): string | null {
  let s = src.split(/[?#]/)[0] ?? '';
  try { s = decodeURIComponent(s); } catch { /* as written */ }
  if (!s) return null;
  const base = s.startsWith('/') ? [] : dirOf(doc).split('/').filter(Boolean);
  for (const seg of s.split('/')) {
    if (!seg || seg === '.') continue;
    if (seg === '..') { if (!base.length) return null; base.pop(); continue; }
    base.push(seg);
  }
  return base.length ? base.join('/') : null;
}

const MIME: Record<string, string> = {
  png: 'image/png', jpg: 'image/jpeg', jpeg: 'image/jpeg', gif: 'image/gif', webp: 'image/webp', svg: 'image/svg+xml', avif: 'image/avif', bmp: 'image/bmp',
};

export const mimeOf = (path: string): string => MIME[path.slice(path.lastIndexOf('.') + 1).toLowerCase()] ?? 'application/octet-stream';

export interface Images {
  load: ImageLoader;
  /** Let go of every blob URL made so far. */
  release(): void;
}

/**
 * The loader for the document at `doc`: vault files become blob URLs,
 * remote addresses pass through while `remote()` says so, else `'hidden'`;
 * a file that is not there is `'broken'`.
 */
export function imageLoader(vault: Vault, doc: string, remote: () => boolean): Images {
  const urls: string[] = [];
  const load: ImageLoader = async (src): Promise<Exclude<ImageState, 'pending'>> => {
    if (isRemote(src)) return remote() ? { url: src } : 'hidden';
    const rel = imagePath(doc, src);
    if (rel === null) return 'broken';
    try {
      const bytes = await vault.fs.readBytes(vault.abs(rel));
      const url = URL.createObjectURL(new Blob([bytes as BlobPart], { type: mimeOf(rel) }));
      urls.push(url);
      return { url };
    } catch {
      return 'broken';
    }
  };
  return {
    load,
    release() {
      for (const u of urls.splice(0)) URL.revokeObjectURL(u);
    },
  };
}
