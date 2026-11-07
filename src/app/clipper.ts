// What an `ilmi://` link does once it arrives: `handleUri` is a plain
// function the OS listener, the smoke, and anything else can call with the
// link's text. A `new` link lands a frozen source through the intake's own
// import path (the page fetched and read the way a pasted address is), opens
// it, and leaves a notice; an `open` link opens a document. A link for
// another vault, or one that asks for nothing, is a notice, never a throw.
// A `new` link with an address writes what the intake writes for a pasted
// one: `url`, `author`, `published`, and the images beside the file; with a
// selection as the content the address is still kept as `url`.

import { invoke } from '@tauri-apps/api/core';
import { getCurrentWindow } from '@tauri-apps/api/window';
import { getCurrent, onOpenUrl } from '@tauri-apps/plugin-deep-link';
import { cleanText } from '../import/index.js';
import type { ImportSpec } from '../vault/index.js';
import { type ClipNew, clipTitle, isSignInBack, openCandidates, parseClipUri, vaultMatches } from './clip.js';
import { importClipNode } from './clipping.js';
import { fetchReadable, type PageInfo } from './fetch.js';
import { folderPaths } from './names.js';
import { useApp } from './store.js';
import { currentVault, note, openNode } from './vault.js';

/** A link that came before any vault was open; it lands when one opens. */
let pending: string | null = null;

/** The folder `dir` names, made along the way when missing; `''` is the root. Resolves to its path. */
async function ensureFolder(dir: string): Promise<string> {
  const vault = currentVault();
  if (!vault || dir === '') return '';
  if (folderPaths(useApp.getState().tree).includes(dir)) return dir;
  let at = '';
  for (const seg of dir.split('/')) at = await vault.folderIn(at, seg);
  return at;
}

async function clipNew(a: ClipNew): Promise<void> {
  let text = a.content ?? '';
  let fetchedTitle = '';
  let page: PageInfo | null = null;
  if (!text && a.url) {
    try {
      const r = await fetchReadable(a.url);
      text = r.text;
      fetchedTitle = r.title;
      page = r.page ?? null;
    } catch {
      note('nothing readable at that link');
      return;
    }
  }
  text = cleanText(text);
  if (!text) {
    note('nothing to clip');
    return;
  }
  const title = clipTitle(a, fetchedTitle, text);
  let dir: string;
  try {
    dir = await ensureFolder(a.folder ?? useApp.getState().clipDir);
  } catch {
    dir = '';
  }
  const spec: ImportSpec = { title, text };
  if (a.url) spec.url = a.url;
  if (page?.author) spec.author = page.author;
  if (page?.published) spec.published = page.published;
  const { path } = await importClipNode(dir, spec, page?.images ?? []);
  openNode(path);
  note(`clipped · ${title}`);
}

function clipOpen(path: string): void {
  const s = useApp.getState();
  const hit = openCandidates(path).find((p) => s.files.includes(p) || (p === path && folderPaths(s.tree).includes(p)));
  if (!hit) {
    note(`nothing at ${path}`);
    return;
  }
  openNode(hit);
}

/** Bring the window forward; a link usually arrives from the browser. */
function toFront(): void {
  try {
    getCurrentWindow().setFocus().catch(() => { /* not allowed: the link still landed */ });
  } catch { /* not under Tauri */ }
}

/**
 * Do what one `ilmi://` link asks. Resolves once the document is written or
 * the refusal noted; never rejects. With no vault open the link is held and
 * lands when one opens.
 */
export async function handleUri(uri: string): Promise<void> {
  if (isSignInBack(uri)) {
    // the sign-in waiting for it takes it, by its state; a second window's copy finds nothing waiting
    if (await invoke<boolean>('oauth_back', { url: uri.trim() }).catch(() => false)) toFront();
    return;
  }
  const a = parseClipUri(uri);
  if (a.kind === 'refused') {
    note(a.reason);
    return;
  }
  const vault = currentVault();
  if (!vault) {
    pending = uri;
    return;
  }
  if (a.vault !== undefined && !vaultMatches(a.vault, vault.root)) {
    note(`that link is for the collection ${a.vault}`);
    return;
  }
  try {
    if (a.kind === 'new') await clipNew(a);
    else clipOpen(a.path);
  } catch (e) {
    note(a.kind === 'new' ? 'could not write the file' : `nothing at ${a.path}`);
    console.error(e);
  }
  toFront();
}

let listening = false;

/**
 * Listen for links from the OS: the one the app was launched with, then each
 * that arrives while it runs. One listener for the app's life, however many
 * times the effect that calls this mounts. Outside Tauri there is nothing to
 * listen to and this is a no-op.
 */
export function listenForClips(): void {
  if (listening) return;
  listening = true;
  // the same link twice within a moment is one link: a launch link can
  // arrive as the current one and as an event
  let last = '';
  let lastAt = 0;
  const take = (urls: string[] | null) => {
    for (const u of urls ?? []) {
      const now = Date.now();
      if (u === last && now - lastAt < 2000) continue;
      last = u;
      lastAt = now;
      void handleUri(u);
    }
  };
  getCurrent().then(take, () => { /* not under Tauri */ });
  onOpenUrl(take).catch(() => { /* not under Tauri */ });
  useApp.subscribe((s, prev) => {
    if (pending && s.vault && s.vault !== prev.vault) {
      const u = pending;
      pending = null;
      void handleUri(u);
    }
  });
}
