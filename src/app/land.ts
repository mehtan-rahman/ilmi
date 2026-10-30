// A file lands where you drop it. One Tauri drag-drop subscriber for the
// whole window routes every OS file drag: on the welcome, to the welcome
// (a folder opens as a vault); over the intake tab, to the intake; anywhere
// else, here, where the files land in the folder under the pointer (a tree
// or folder-lens row; a document row means its folder) or in the active
// tab's folder, the root when there is none.
//
// What needs no choice lands straight away with the intake's defaults and
// opens: a PDF, a book (its chapters in a folder named for it), a text or
// HTML file that does not read as cards, an Anki package with one deck. A
// notice says what landed and where, with `undo` (removes what was written,
// a folder made for it too) and `open`. What needs a choice (text that
// reads as cards, a package with several decks) goes to the intake,
// pre-filled. File → Import… and the menus' `import a file…` take the same
// path from the picker, and an address pasted with nothing focused is
// clipped (24's path) into the active tab's folder.
//
// `fileKind`, `decide`, `dropTarget`, and `newFolders` are pure; `landFile`
// and `clipLink` take their readers and writers as `LandFx`, so a test can
// stub the disk.

import { getCurrentWebview, type DragDropEvent } from '@tauri-apps/api/webview';
import { open as pickFile } from '@tauri-apps/plugin-dialog';
import { HTML_EXT, TEXT_EXT, deriveTitle, detect, isUrl, mapBook, mapPackage, stats, type Chapter, type ClipImage, type Mapped, type MappedBook, type MappedDeck } from '../import/index.js';
import { NEW_NAMES, dirOf, isDoc, within, type ImportPdfSpec, type ImportSpec, type TreeNode } from '../vault/index.js';
import { importClipNode } from './clipping.js';
import { APKG_EXT, EPUB_EXT, PDF_EXT, fetchReadable, readAnkiPackage, readDropped, readDroppedPdf, readEpub, type Fetched, type FetchedPdf } from './fetch.js';
import { folderPaths } from './names.js';
import { pageDropAt } from './pageImages.js';
import { activeTab } from './panes.js';
import { useApp } from './store.js';
import { currentVault, importAnkiNode, importBookNode, importNode, importPdfNode, note, openIntake, openNode, removeNode } from './vault.js';

// ── pure ─────────────────────────────────────────────────────────

export type FileKind = 'pdf' | 'epub' | 'apkg' | 'text' | 'html' | 'other';

/** What a file is, by its name. */
export function fileKind(path: string): FileKind {
  const name = path.slice(path.lastIndexOf('/') + 1);
  if (PDF_EXT.test(name)) return 'pdf';
  if (EPUB_EXT.test(name)) return 'epub';
  if (APKG_EXT.test(name)) return 'apkg';
  if (TEXT_EXT.test(name)) return 'text';
  if (HTML_EXT.test(name)) return 'html';
  return 'other';
}

/** What the file was found to hold, once read: an Anki package's decks, the cards a text reads as. */
export interface Parsed {
  decks?: number;
  cards?: number;
}

/**
 * Land it, or ask: a package with several decks and a text that reads as
 * two or more cards need the intake's choices (which decks, the
 * delimiters); everything else lands with the defaults. A page from HTML is
 * prose by nature, as a fetched page is.
 */
export function decide(kind: FileKind, parsed: Parsed = {}): 'land' | 'ask' {
  if (kind === 'apkg') return (parsed.decks ?? 0) === 1 ? 'land' : 'ask';
  if (kind === 'text') return (parsed.cards ?? 0) >= 2 ? 'ask' : 'land';
  return 'land';
}

/** A row under the pointer: its path (`''` the root) and whether it is a folder. */
export interface DropHit {
  path: string;
  folder: boolean;
}

/**
 * The folder a drop lands in: a folder row's own, a document row's folder;
 * elsewhere the active tab's folder (a folder tab itself, a document's
 * folder); the root for a tab that is not a vault path (the queue, the
 * intake, a session) or when there is no tab.
 */
export function dropTarget(hit: DropHit | null, tab: string | undefined): string {
  if (hit) return hit.folder ? hit.path : dirOf(hit.path);
  if (tab === undefined || tab.startsWith(':')) return '';
  return isDoc(tab) ? dirOf(tab) : tab;
}

/** The row an element is part of: the nearest `[data-path]`, a folder when its `data-kind` says so. */
export function hitAt(el: Element | null): DropHit | null {
  const row = el?.closest<HTMLElement>('[data-path]');
  if (!row) return null;
  return { path: row.dataset.path ?? '', folder: row.dataset.kind === 'folder' };
}

/**
 * The folders a landing made: for each written path, the topmost folder
 * between it and `dir` that was not there `before`. Undo removes these
 * whole, and the files outside them one by one.
 */
export function newFolders(written: string[], dir: string, before: Set<string>): string[] {
  const out: string[] = [];
  for (const p of written) {
    let top: string | null = null;
    for (let d = dirOf(p); d !== dir && d !== '' && within(d, dir); d = dirOf(d)) if (!before.has(d)) top = d;
    if (top !== null && !out.includes(top)) out.push(top);
  }
  return out;
}

/** `in books/`, `in the root`. */
export const whereLabel = (dir: string): string => (dir ? `in ${dir}/` : 'in the root');

const plural = (n: number, word: string) => `${n.toLocaleString()} ${word}${n === 1 ? '' : 's'}`;

// ── landing ──────────────────────────────────────────────────────

/** What a landing wrote, for its notice and its undo. */
export interface Landed {
  /** `placed · Muqaddimah · 12 chapters in books/` */
  line: string;
  /** What opens: the document, or a book's first chapter. */
  open: string;
  /** The documents written, vault-relative. */
  written: string[];
  /** The folders made for them (`newFolders`), removed whole on undo. */
  folders: string[];
}

export type Outcome = { kind: 'landed'; landed: Landed } | { kind: 'ask'; path: string };

/** The readers and writers a landing reaches for; the real ones unless a test hands in others. */
export interface LandFx {
  readText(path: string): Promise<Fetched>;
  readPdf(path: string): Promise<FetchedPdf>;
  readBook(path: string): Promise<MappedBook>;
  readAnki(path: string): Promise<Mapped>;
  fetchPage(url: string): Promise<Fetched>;
  importText(dir: string, spec: ImportSpec): Promise<string>;
  importPdf(dir: string, spec: ImportPdfSpec): Promise<string>;
  importBook(dir: string, book: { title: string; chapters: Chapter[] }): Promise<{ book: string; folder: string; paths: string[] }>;
  importAnki(dir: string, decks: MappedDeck[]): Promise<string[]>;
  importClip(dir: string, spec: ImportSpec, images: ClipImage[]): Promise<{ path: string }>;
  /** The vault's folders now, for `newFolders`. */
  folders(): Set<string>;
  remove(path: string): Promise<void>;
}

export const realFx: LandFx = {
  readText: readDropped,
  readPdf: readDroppedPdf,
  readBook: async (path) => mapBook(await readEpub(path)),
  readAnki: async (path) => mapPackage(await readAnkiPackage(path)),
  fetchPage: fetchReadable,
  importText: importNode,
  importPdf: importPdfNode,
  importBook: importBookNode,
  importAnki: importAnkiNode,
  importClip: importClipNode,
  folders: () => new Set(folderPaths((currentVault()?.tree ?? []) as TreeNode[])),
  remove: removeNode,
};

/** The default name of a book whose package has no title, as the intake has it. */
const BOOK_NAME = 'book';

/**
 * Read one file and land it in `dir` with the intake's defaults, or say it
 * needs the intake. Rejects with the intake's words for a file it cannot
 * read (`not a text file`, `no chapters in that book`, …).
 */
export async function landFile(path: string, dir: string, fx: LandFx = realFx): Promise<Outcome> {
  const kind = fileKind(path);
  const before = fx.folders();
  const done = (label: string, written: string[], open: string): Outcome => ({
    kind: 'landed',
    landed: { line: `placed · ${label} ${whereLabel(dir)}`, open, written, folders: newFolders(written, dir, before) },
  });
  switch (kind) {
    case 'pdf': {
      const r = await fx.readPdf(path);
      const title = r.title.trim() || NEW_NAMES.source;
      const doc = await fx.importPdf(dir, { title, bytes: r.bytes, text: r.text });
      return done(`${title} · ${plural(r.pages, 'page')}`, [doc], doc);
    }
    case 'epub': {
      const b = await fx.readBook(path);
      if (!b.chapters.length) throw new Error('no chapters in that book');
      const title = (b.title || BOOK_NAME).trim();
      // a notebook: the book's document with its chapters as tabs
      const { book, paths } = await fx.importBook(dir, { title, chapters: b.chapters });
      return done(`${title} · ${plural(b.chapters.length, 'chapter')}`, [book, ...paths], paths[0]!);
    }
    case 'apkg': {
      const m = await fx.readAnki(path);
      if (!m.decks.length) throw new Error('no cards in that package');
      if (decide(kind, { decks: m.decks.length }) === 'ask') return { kind: 'ask', path };
      const paths = await fx.importAnki(dir, m.decks);
      const d = m.decks[0]!;
      return done(`${d.title} · ${plural(d.cards, 'card')}`, paths, paths[0]!);
    }
    case 'text':
    case 'html': {
      const r = await fx.readText(path);
      if (decide(kind, { cards: kind === 'text' ? detect(r.text).cards : 0 }) === 'ask') return { kind: 'ask', path };
      const title = (r.title || deriveTitle(r.text) || NEW_NAMES.source).trim();
      const doc = await fx.importText(dir, { title, text: r.text });
      return done(`${title} · ${plural(stats(r.text).words, 'word')}`, [doc], doc);
    }
    default:
      throw new Error('not a file ilmi reads');
  }
}

/** Take back what a landing wrote: the folders it made, whole, then the files outside them. */
export async function undoLanded(l: Landed, remove: (path: string) => Promise<void> = realFx.remove): Promise<void> {
  for (const f of l.folders) await remove(f);
  for (const p of l.written) if (!l.folders.some((f) => within(p, f))) await remove(p);
}

/** A page by address, clipped into `dir` as the intake and `ilmi://new` would write it. */
export async function clipLink(url: string, dir: string, fx: LandFx = realFx): Promise<Landed> {
  const before = fx.folders();
  const r = await fx.fetchPage(url.trim());
  const title = (r.title || deriveTitle(r.text) || NEW_NAMES.source).trim();
  const path = r.page
    ? (await fx.importClip(dir, { title, text: r.text, url: r.page.url, author: r.page.author, published: r.page.published }, r.page.images)).path
    : await fx.importText(dir, { title, text: r.text });
  return { line: `clipped · ${title} · ${plural(stats(r.text).words, 'word')} ${whereLabel(dir)}`, open: path, written: [path], folders: newFolders([path], dir, before) };
}

// ── the notice ───────────────────────────────────────────────────

let seq = 0;
const undos = new Map<number, () => Promise<void>>();

/** Show one notice (and log its line); `undo` is held for it until the next. */
export function notify(line: string, open: string | null = null, undo?: () => Promise<void>): void {
  seq += 1;
  undos.clear();
  if (undo) undos.set(seq, undo);
  note(line);
  useApp.setState({ notice: { seq, line, open, undo: !!undo } });
}

export function dismissNotice(at?: number): void {
  const n = useApp.getState().notice;
  if (n && (at === undefined || n.seq === at)) useApp.setState({ notice: null });
}

/** The notice's `undo`: what it landed is removed, and a line says so. */
export async function undoNotice(): Promise<void> {
  const n = useApp.getState().notice;
  const fn = n ? undos.get(n.seq) : undefined;
  if (!n || !fn) return;
  undos.delete(n.seq);
  useApp.setState({ notice: null });
  await fn();
  note(`undone · ${n.line.replace(/^\w+ · /, '')}`);
}

const shown = (l: Landed, fx: LandFx) => {
  notify(l.line, l.open, () => undoLanded(l, fx.remove));
  openNode(l.open);
};

/**
 * Land each file in `dir`, one after another, each opening as it lands
 * with its notice. The ones that need a choice wait on the intake, which
 * opens for `dir`. Resolves to what landed.
 */
export async function landFiles(paths: string[], dir: string, fx: LandFx = realFx): Promise<Landed[]> {
  if (!currentVault() && fx === realFx) return [];
  const out: Landed[] = [];
  const asks: string[] = [];
  for (const p of paths) {
    const name = p.slice(p.lastIndexOf('/') + 1);
    try {
      const r = await landFile(p, dir, fx);
      if (r.kind === 'ask') asks.push(r.path);
      else { out.push(r.landed); shown(r.landed, fx); }
    } catch (e) {
      console.error(p, e);
      notify(`${name} · ${e instanceof Error ? e.message : String(e)}`);
    }
  }
  if (asks.length) {
    useApp.setState((s) => ({ intakeFiles: [...s.intakeFiles, ...asks] }));
    openIntake(dir);
  }
  return out;
}

/** The folder of the active tab, the root when there is none. */
export function activeDir(): string {
  return dropTarget(null, activeTab(useApp.getState().panes)?.id);
}

/** Extensions the picker offers: what a drop would take. The intake's picker uses the same. */
export const PICK_EXT = ['txt', 'md', 'markdown', 'text', 'csv', 'tsv', 'html', 'htm', 'pdf', 'apkg', 'epub'];

/** The native file picker over what a drop would take, several files allowed; null when dismissed. */
const pickMany = (): Promise<string | string[] | null> =>
  pickFile({ multiple: true, directory: false, filters: [{ name: 'text, pdf, anki, or epub', extensions: PICK_EXT }] });

/** The picker (stubbed by the smoke), several files allowed; each lands in `dir` (the active tab's folder by default) as a drop does. */
export async function importFiles(dir: string = activeDir(), pick: () => Promise<string | string[] | null> = pickMany): Promise<Landed[]> {
  if (!currentVault()) return [];
  const picked = await pick();
  const paths = picked === null ? [] : Array.isArray(picked) ? picked : [picked];
  return paths.length ? landFiles(paths, dir) : [];
}

// ── the drop router ──────────────────────────────────────────────

/** The surfaces that take a drop themselves: the welcome (the whole window) and the intake (its panel). */
export const dropRoutes: {
  welcome?: (ev: DragDropEvent) => void;
  intake?: { wrap(): HTMLElement | null; on(ev: DragDropEvent, here: boolean): void };
} = {};

/** The element under a drag's position, which Tauri gives in physical pixels. */
export function elementAt(pos: { x: number; y: number }): Element | null {
  const k = window.devicePixelRatio || 1;
  return document.elementFromPoint(pos.x / k, pos.y / k);
}

const over = (path: string | null) => { if (useApp.getState().fileOver !== path) useApp.setState({ fileOver: path }); };

/**
 * One drag-drop event, to the one surface that takes it: the welcome while
 * no vault is open; the intake when the pointer is over its panel (it hears
 * every event, so it can put its veil away when the pointer leaves); else
 * the row under the pointer is lit, and a drop lands there.
 */
export function routeDrop(ev: DragDropEvent): Promise<Landed[]> | void {
  if (useApp.getState().vault === null) {
    dropRoutes.welcome?.(ev);
    return;
  }
  const el = ev.type === 'leave' ? null : elementAt(ev.position);
  const intake = dropRoutes.intake;
  const here = !!el && !!intake?.wrap()?.contains(el);
  intake?.on(ev, here);
  if (ev.type === 'leave' || here) { over(null); return; }
  // images over an editable page go into the page, beside the note, not into the folder as documents
  const page = ev.type === 'drop' ? pageDropAt(el, ev.paths) : null;
  if (page && ev.type === 'drop') {
    over(null);
    const k = window.devicePixelRatio || 1;
    page(ev.paths, ev.position.x / k, ev.position.y / k);
    return;
  }
  const hit = hitAt(el);
  if (ev.type !== 'drop') { over(hit?.path ?? null); return; }
  over(null);
  // a drag with no files (nothing the OS handed over) lands nothing
  if (!ev.paths.length) return;
  return landFiles(ev.paths, dropTarget(hit, activeTab(useApp.getState().panes)?.id));
}

/** Dev and smoke: a drop of `paths` at a point in CSS pixels, through the router. */
export function dropAt(paths: string[], x: number, y: number): Promise<Landed[]> | void {
  const k = window.devicePixelRatio || 1;
  const position = { x: x * k, y: y * k };
  routeDrop({ type: 'over', position } as unknown as DragDropEvent);
  return routeDrop({ type: 'drop', paths, position } as unknown as DragDropEvent);
}

let dropping = false;

/** Subscribe the router, once for the app's life. Outside Tauri there is no OS drop and this is a no-op. */
export function listenForDrops(): void {
  if (dropping) return;
  dropping = true;
  try {
    getCurrentWebview().onDragDropEvent((e) => { void routeDrop(e.payload); }).catch(() => { /* not under Tauri */ });
  } catch { /* not under Tauri */ }
}

// ── paste a link ─────────────────────────────────────────────────

/** A text field or an editor: a paste there is theirs. */
export function inEditable(t: EventTarget | null): boolean {
  const el = t as HTMLElement | null;
  if (!el || typeof el.closest !== 'function') return false;
  return el.isContentEditable || !!el.closest('input, textarea, select, [contenteditable]:not([contenteditable="false"]), .ProseMirror');
}

/**
 * A paste with nothing focused: an address is clipped into the active
 * tab's folder and opened, with the notice; anything else is let be.
 */
export function onPaste(e: ClipboardEvent, fx: LandFx = realFx): Promise<Landed | null> | void {
  const st = useApp.getState();
  if (st.vault === null || st.paletteOpen || inEditable(e.target) || inEditable(document.activeElement)) return;
  const text = e.clipboardData?.getData('text/plain').trim() ?? '';
  if (!isUrl(text)) return;
  e.preventDefault();
  const dir = activeDir();
  notify(`fetching · ${text}`);
  return clipLink(text, dir, fx).then(
    (l) => { shown(l, fx); return l; },
    (err: unknown) => { console.error(err); notify('nothing readable at that link'); return null; },
  );
}

let pasting = false;

/** Listen for pastes on the document, once for the app's life. */
export function listenForPaste(): void {
  if (pasting) return;
  pasting = true;
  document.addEventListener('paste', (e) => { void onPaste(e); });
}
