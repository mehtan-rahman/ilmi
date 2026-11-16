// A document's pages and the note on them (milestone 70). A PDF is a thing of
// its own: it opens as its pages across the pane, and a note is attached to
// it by naming the file in its `pdf` field (FORMAT.md §3). The note opens in
// the pane beside the pages when asked (`notes` among the words over the
// pages, ⌘\), as the ordinary tab it is: a note of its own as itself, a
// document with pages (a chapter of the sample's book, whose body is the
// notes) as its `:notes/` tab. Closed, the pages are alone again. Nothing
// slides over the pages.
//
// Attaching happens the first time something is kept from a PDF that has no
// note, or from `notes` there: the palette picks a note that is there, or
// makes a new one, named as typed, in a folder picked next. From then on
// everything kept from that PDF goes into it.
//
// A phone has no second pane (milestone 56): the note is the page, in place of
// the pages, and `pages` over it comes back. Over a session it goes on top, so
// the session is still there.

import { useSyncExternalStore } from 'react';
import { openUrl } from '@tauri-apps/plugin-opener';
import { setField } from '../format/index.js';
import { emptyTrail, type ContentsEntry, type Trail } from '../pdf/index.js';
import { dirOf, relFrom } from '../vault/index.js';
import { noteOf, notesTabOf, pagesOf, SESSION } from './names.js';
import { activeTab, besideAt, closeBeside, openBeside, openTab } from './panes.js';
import { useApp } from './store.js';
import { currentVault } from './vault.js';

/** The note's tab beside the pages at `pagesId` is open. */
export function notesOpen(pagesId: string): boolean {
  const s = useApp.getState();
  const tab = notesTabOf(pagesId, s.docs);
  return tab !== null && besideAt(s.panes, tab) !== null;
}

/** Open the note on the pages at `pagesId` beside them (the pane made when there is one); with no note yet, the picker first. Resolves to the note's tab, or null when nothing was picked. */
export async function openNotes(pagesId: string): Promise<string | null> {
  const note = await ensureNote(pagesId);
  if (note === null) return null;
  const s = useApp.getState();
  const tab = notesTabOf(pagesId, s.docs);
  if (tab === null) return null;
  useApp.setState({ panes: s.phone ? openTab(s.panes, tab, { newTab: activeTab(s.panes)?.id === SESSION }) : openBeside(s.panes, tab) });
  return tab;
}

/** Close the note's tab beside the pages, when it is open there. */
export function closeNotes(pagesId: string): void {
  const s = useApp.getState();
  const tab = notesTabOf(pagesId, s.docs);
  if (tab !== null) useApp.setState({ panes: closeBeside(s.panes, tab) });
}

/** `notes` over the pages, or ⌘\ there: the note beside the pages, or closed again. */
export function toggleNotes(pagesId: string): void {
  if (notesOpen(pagesId)) closeNotes(pagesId);
  else void openNotes(pagesId).catch(console.error);
}

/**
 * From the note's side (`show in book`, a section's chip): the pages the
 * note is on, open beside it when they are not, so what goes to the pages
 * has pages to go to. The tab showing the note may be the note's own or
 * its document's `:notes/` tab.
 */
export function openPagesBeside(note: string): string | null {
  const s = useApp.getState();
  const pages = pagesOf(note, s.docs);
  if (pages === null) return null;
  if (activeTab(s.panes)?.id !== pages) useApp.setState({ panes: s.phone ? openTab(s.panes, pages) : openBeside(s.panes, pages) });
  return pages;
}

// ── attaching ──

let asking: { pdf: string; resolve: (note: string | null) => void } | null = null;

/**
 * The note on the pages at `pagesId`, or, for a PDF with none yet, the one
 * the palette picks or makes: the picker opens and the promise waits for it.
 * Null when the picker is closed with nothing picked.
 */
export function ensureNote(pagesId: string): Promise<string | null> {
  const s = useApp.getState();
  const note = noteOf(pagesId, s.docs);
  if (note !== null) return Promise.resolve(note);
  if (!s.docs[pagesId] || s.docs[pagesId].pdf !== pagesId) return Promise.resolve(null);
  asking?.resolve(null);
  return new Promise((resolve) => {
    asking = { pdf: pagesId, resolve };
    useApp.setState({ paletteOpen: true, noteAttach: { pdf: pagesId, step: 'pick' } });
  });
}

/** The picker closed with nothing picked. */
export function attachCancelled(): void {
  const a = asking;
  asking = null;
  a?.resolve(null);
}

/** A note that is there, picked: it names the PDF from now on (`pdf`, relative to the note), and is its notes. */
export async function attachNote(pdf: string, note: string): Promise<void> {
  const vault = currentVault();
  if (!vault) return;
  await vault.update(note, (doc) => setField(doc, 'pdf', relFrom(dirOf(note), pdf)));
  await settled(pdf, note);
  const a = asking;
  asking = null;
  a?.resolve(note);
}

/** A new note for the PDF, named as typed, in `dir`: made, attached, and the pick. */
export async function attachNewNote(pdf: string, name: string, dir: string): Promise<void> {
  const vault = currentVault();
  if (!vault) return;
  const note = await vault.createDoc(dir, 'note', name);
  await attachNote(pdf, note);
}

/** Until the app's docs show the note as the PDF's: the tree walked, the index told. */
function settled(pdf: string, note: string): Promise<void> {
  return new Promise((resolve) => {
    const done = () => { off(); clearTimeout(t); resolve(); };
    const t = setTimeout(done, 3000);
    const off = useApp.subscribe((s) => { if (s.docs[pdf]?.note === note && s.docs[note]?.of === pdf) done(); });
    const s = useApp.getState();
    if (s.docs[pdf]?.note === note && s.docs[note]?.of === pdf) done();
  });
}

// ── getting around (milestone 76) ──
// What the lens over a book's pages shares with the rest of the shell: the
// trail of places its jumps left (⌫ back, ⇧⌫ forward; kept by the book's id
// for as long as the app runs, as its place and its zoom are), and the lens
// itself, for the palette's `contents` list to ask and to send a place to.

const trails = new Map<string, Trail>();
const subs = new Set<() => void>();
const tell = () => { for (const f of [...subs]) f(); };
const subscribe = (f: () => void) => { subs.add(f); return () => { subs.delete(f); }; };
const NONE = emptyTrail();

/** The places a book's jumps left. */
export const trailOf = (id: string): Trail => trails.get(id) ?? NONE;
export function setTrail(id: string, t: Trail): void {
  trails.set(id, t);
  tell();
}
/** A book's trail, as it changes. */
export const useTrail = (id: string): Trail => useSyncExternalStore(subscribe, () => trailOf(id));

/** A book's contents as the palette lists them: the PDF's outline, else the sections boxed on its pages, and the entry that holds the place in view. */
export interface BookContents {
  entries: ContentsEntry[];
  here: number;
  from: 'outline' | 'sections' | 'none';
}

/** The lens over a book's pages, as the palette reaches it. */
export interface BookLens {
  /** In the pane in front. */
  active(): boolean;
  contents(): Promise<BookContents>;
  /** Go to an entry's place: a jump, with the way back. */
  go(entry: ContentsEntry): void;
}

const lenses = new Map<string, BookLens[]>();

/** A lens over the book at `id` is there; the undoing takes it away again. */
export function addLens(id: string, lens: BookLens): () => void {
  lenses.set(id, [...(lenses.get(id) ?? []), lens]);
  tell();
  return () => {
    const rest = (lenses.get(id) ?? []).filter((l) => l !== lens);
    if (rest.length) lenses.set(id, rest); else lenses.delete(id);
    tell();
  };
}

/** A lens moved to the pane in front, or out of it. */
export const lensChanged = (): void => tell();

/** The lens over the book at `id`: the one in the pane in front when two show it. */
export function lensOf(id: string): BookLens | null {
  const list = lenses.get(id) ?? [];
  return list.find((l) => l.active()) ?? list[list.length - 1] ?? null;
}

/** The book whose pages are in the pane in front, when a book is. */
export function bookInFront(): string | null {
  for (const [id, list] of lenses) if (list.some((l) => l.active())) return id;
  return null;
}

/** Whether the book in front has somewhere to go back to: the bottom strip says `⌫ back` only then. */
export const useBackInFront = (): boolean => useSyncExternalStore(subscribe, () => {
  const id = bookInFront();
  return id !== null && trailOf(id).back.length > 0;
});

let wanted: string | null = null;

/** `t` over a book's pages: the palette opens on that book's contents. */
export function openContents(id: string): void {
  wanted = id;
  useApp.setState({ paletteOpen: true });
}
/** The book whose contents the palette was opened for, once. */
export function takeContents(): string | null {
  const id = wanted;
  wanted = null;
  return id;
}

/** A web address in the system's browser; outside Tauri, in a new tab. Nothing is fetched by the app. */
export function openWeb(url: string): void {
  if (!/^(?:https?:|mailto:)/i.test(url)) return;
  openUrl(url).catch(() => { window.open(url, '_blank', 'noopener'); });
}
