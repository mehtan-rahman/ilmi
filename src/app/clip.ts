// `ilmi://` links, the door a bookmarklet or a web clipper uses: the grammar
// of Obsidian's `obsidian://new` and `obsidian://open` under this app's
// scheme. This file is the pure side, parsing a link into what it asks for
// or the one line that refuses it; `clipper.ts` acts on the result against
// the open vault. Nothing here touches the store or the disk.

import { deriveTitle, isUrl } from '../import/index.js';
import { baseOf } from '../vault/index.js';

/** `ilmi://new?name=&content=&folder=&url=&vault=`: a frozen source from `content`, else from the page at `url`. */
export interface ClipNew {
  kind: 'new';
  name?: string;
  content?: string;
  folder?: string;
  url?: string;
  vault?: string;
}

/** `ilmi://open?path=&vault=`: a document (or a folder) of the vault, with or without `.md`. */
export interface ClipOpen {
  kind: 'open';
  path: string;
  vault?: string;
}

/** What a link asked for. */
export type ClipAction = ClipNew | ClipOpen;

/** A link that asks for nothing this app does; `reason` is the notice. */
export interface ClipRefusal {
  kind: 'refused';
  reason: string;
}

export const SCHEME = 'ilmi';

/** A query value, trimmed; an absent or blank one is `undefined`. */
function param(q: URLSearchParams, ...names: string[]): string | undefined {
  for (const n of names) {
    const v = q.get(n)?.trim();
    if (v) return v;
  }
  return undefined;
}

/** A folder named in a link: slashes at either end dropped, `.` and empty segments too; `''` is the root. */
export function cleanClipDir(s: unknown): string {
  if (typeof s !== 'string') return '';
  return s
    .split(/[\\/]+/)
    .map((seg) => seg.trim())
    .filter((seg) => seg && seg !== '.' && seg !== '..')
    .join('/');
}

/** A sign-in coming back (milestone 64): `ilmi://auth?…`, or Google's client id turned round, the one scheme it allows on a device. */
export const isSignInBack = (uri: string): boolean => /^ilmi:\/\/auth\b/i.test(uri.trim()) || uri.trim().startsWith('com.googleusercontent.apps.');

/**
 * Parse one link. Accepts `ilmi://new?…`, `ilmi:new?…`, and `ilmi:///new?…`
 * alike (the verb is the host, else the first path segment). Anything that
 * is not this app's scheme, names no verb this app has, or asks for nothing
 * is a refusal with the line to show.
 */
export function parseClipUri(uri: string): ClipAction | ClipRefusal {
  const refuse = (reason: string): ClipRefusal => ({ kind: 'refused', reason });
  let u: URL;
  try {
    u = new URL(uri.trim());
  } catch {
    return refuse('not an ilmi link');
  }
  if (u.protocol !== `${SCHEME}:`) return refuse('not an ilmi link');
  const verb = (u.hostname || u.pathname.replace(/^\/+/, '').split('/')[0] || '').toLowerCase();
  const q = u.searchParams;
  const vault = param(q, 'vault');
  if (verb === 'new') {
    const content = param(q, 'content');
    const url = param(q, 'url');
    if (!content && !url) return refuse('nothing to clip');
    if (!content && url && !isUrl(url)) return refuse('not a web address');
    const a: ClipNew = { kind: 'new' };
    const name = param(q, 'name');
    if (name) a.name = name;
    if (content) a.content = content;
    if (url && isUrl(url)) a.url = url;
    const folder = cleanClipDir(param(q, 'folder'));
    if (folder) a.folder = folder;
    if (vault) a.vault = vault;
    return a;
  }
  if (verb === 'open') {
    const path = cleanClipDir(param(q, 'path', 'file'));
    if (!path) return refuse('nothing to open');
    const a: ClipOpen = { kind: 'open', path };
    if (vault) a.vault = vault;
    return a;
  }
  return refuse(verb ? `no such link: ${verb}` : 'not an ilmi link');
}

/** True when a link's `vault=` names the open vault: its directory's name, or its whole path. */
export function vaultMatches(named: string, root: string): boolean {
  const n = named.trim().replace(/\/+$/, '');
  const r = root.replace(/\/+$/, '');
  return n === r || n === baseOf(r);
}

/** The title a clipping lands under: the link's name, else the page's title, else the text's first line, else the page's host. */
export function clipTitle(a: { name?: string; url?: string }, fetchedTitle: string, text: string): string {
  if (a.name) return a.name;
  if (fetchedTitle.trim()) return fetchedTitle.trim();
  const first = deriveTitle(text);
  if (first) return first;
  if (a.url) {
    try {
      return new URL(a.url).hostname;
    } catch { /* not a URL after all; fall through */ }
  }
  return 'clipping';
}

/** The paths an `open` link may mean, in the order to try: as given, then with `.md`. */
export function openCandidates(path: string): string[] {
  return path.endsWith('.md') ? [path] : [path, `${path}.md`];
}
