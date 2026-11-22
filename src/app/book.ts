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
// makes a new one, named as typed, in a folder picked next. A PDF may have
// several (milestone 81): `+` beside the notes' word picks or makes one
// more, each is a tab of the pane beside, the one used last in front, and a
// clip goes into the one in front there, else the one used last.
//
// A phone has no second pane (milestone 56): the note is the page, in place of
// the pages, and `pages` over it comes back. Over a session it goes on top, so
// the session is still there.

import { useSyncExternalStore } from 'react';
import { openUrl } from '@tauri-apps/plugin-opener';
import { parseBoxes, setField } from '../format/index.js';
import { dayOf, dayStart, whenToDate } from '../schedule/index.js';
import { appNow } from './clock.js';
import { bookmarksOf, collectionMark, collectionMarks, emptyTrail, highlightsOf, passageMarksOf, isCollectionMark, letterId, lettersOf, type ContentsEntry, type Trail } from '../pdf/index.js';
import { MARKS_DIR, dirOf, join, marksHashOf, marksMap, marksPath, parseMarks, relFrom, serializeMarks, type Mark, type Marks, type PassageMark, type StoreFs } from '../vault/index.js';
import { noteTabOf, notesPath, notesTabsOf, pagesOf, pdfForNotes, SESSION, titleOf } from './names.js';
import { boxesLabel, createWritten, placeOfSheet } from './written.js';
import { activeTab, besideAt, closeBeside, openBeside, openTab, openTwin, openWhereBeside } from './panes.js';
import { useApp, type DocInfo } from './store.js';
import { notify } from './land.js';
import { currentVault, onHiddenChange, openNode } from './vault.js';

// the note used last: every tab stamped as it comes to the front of a pane, so of a PDF's notes the one with the latest stamp is the one last looked at (for as long as the app runs)
let usedSeq = 0;
const usedAt = new Map<string, number>();
useApp.subscribe((s, prev) => {
  if (s.panes === prev.panes) return;
  const were = new Set(prev.panes.panes.map((p) => p.tabs[p.active]?.id));
  s.panes.panes.forEach((p, pi) => {
    const id = p.tabs[p.active]?.id;
    if (id !== undefined && (!were.has(id) || (pi === s.panes.active && pi !== prev.panes.active))) usedAt.set(id, ++usedSeq);
  });
});

/**
 * Of the tabs of the notes on the pages at `pagesId`, the one to have in
 * front: the note asked for (`want`, a note's path), else the one in front
 * of a pane now, else the one used last, else the first. Null with no note.
 */
function frontTab(pagesId: string, want?: string | null, typed = false): string | null {
  const s = useApp.getState();
  // (`typed`: written notebooks among a PDF's notes are left out, for what only a typed note takes)
  const tabs = notesTabsOf(pagesId, s.docs).filter((t) => !typed || !s.docs[notesPath(t) ?? t]?.written);
  if (!tabs.length) return null;
  if (want != null) {
    const t = noteTabOf(want, s.docs);
    if (tabs.includes(t)) return t;
  }
  const shown = s.panes.panes.map((p, pi) => ({ id: p.tabs[p.active]?.id, pi })).filter((x): x is { id: string; pi: number } => x.id !== undefined && tabs.includes(x.id));
  const beside = shown.find((x) => x.pi !== s.panes.active) ?? shown[0];
  if (beside) return beside.id;
  let best = tabs[0]!;
  for (const t of tabs) if ((usedAt.get(t) ?? 0) > (usedAt.get(best) ?? 0)) best = t;
  return best;
}

/** The note that takes what is kept from the pages at `pagesId` (a clip, `m`): the one in front beside them, else the one used last, else the first; null with none. */
export function noteFor(pagesId: string, typed = false): string | null {
  const tab = frontTab(pagesId, null, typed);
  return tab === null ? null : notesPath(tab) ?? tab;
}

/** A note's tab beside the pages at `pagesId` is open. */
export function notesOpen(pagesId: string): boolean {
  const s = useApp.getState();
  return notesTabsOf(pagesId, s.docs).some((tab) => besideAt(s.panes, tab) !== null);
}

/**
 * Open the notes on the pages at `pagesId` beside them (the pane made when
 * there is one): every note of theirs a tab of that pane, `want` (a note's
 * path) in front, else the one used last; with no note yet, the picker
 * first. Resolves to the tab in front, or null when nothing was picked. A
 * phone has one page: the one note, in place of the pages.
 */
export async function openNotes(pagesId: string, want?: string | null): Promise<string | null> {
  // asked for on pages said to want none (`create notes`, ⌘\): they want them again
  if (useApp.getState().docs[pagesId]?.noNotes) await setNoNotes(pagesId, false);
  const note = await ensureNote(pagesId);
  if (note === null) return null;
  const s = useApp.getState();
  const front = frontTab(pagesId, want);
  if (front === null) return null;
  if (s.phone) {
    useApp.setState({ panes: openTab(s.panes, front, { newTab: activeTab(s.panes)?.id === SESSION }) });
    return front;
  }
  let panes = s.panes;
  // each a tab there in the notes' order, where it is not open beside already; then the one asked for in front
  for (const tab of notesTabsOf(pagesId, s.docs)) if (besideAt(panes, tab) === null) panes = openBeside(panes, tab);
  useApp.setState({ panes: openBeside(panes, front) });
  return front;
}

/**
 * The pages want no notes, or want them again (2026-11-22): `notes: none` in the document's front matter, for a PDF
 * on its own in its `reading.json` entry (FORMAT.md §1, §3), so it goes where the document goes. Said, its bar has
 * neither `create notes` nor its `+`, and its ⋯ has `create notes`.
 */
export async function setNoNotes(pagesId: string, none: boolean): Promise<void> {
  const vault = currentVault();
  if (!vault) return;
  await vault.update(pagesId, (doc) => setField(doc, 'notes', none ? 'none' : null));
}

/** Close the notes' tabs beside the pages, where they are open there. */
export function closeNotes(pagesId: string): void {
  const s = useApp.getState();
  let panes = s.panes;
  for (const tab of notesTabsOf(pagesId, s.docs)) panes = closeBeside(panes, tab);
  if (panes !== s.panes) useApp.setState({ panes });
}

/** `notes` over the pages, or ⌘\ there: the notes beside the pages, or closed again. */
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
 * The note on the pages at `pagesId` (of several, the one `noteFor` says),
 * or, for a PDF with none yet, the one the palette picks or makes: the picker opens and the promise waits for it.
 * Null when the picker is closed with nothing picked. `typed`: a typed note
 * is wanted (a clip is a line of one), so a PDF whose only notes are written
 * notebooks asks as one with none does.
 */
export function ensureNote(pagesId: string, typed = false): Promise<string | null> {
  const s = useApp.getState();
  const note = noteFor(pagesId, typed);
  if (note !== null) return Promise.resolve(note);
  if (!s.docs[pagesId] || s.docs[pagesId].pdf !== pagesId) return Promise.resolve(null);
  asking?.resolve(null);
  return new Promise((resolve) => {
    asking = { pdf: pagesId, resolve };
    useApp.setState({ paletteOpen: true, noteAttach: { pdf: pagesId, step: 'pick' } });
  });
}

/**
 * `+` beside the notes' word (milestone 81): a further note for the PDF of
 * the pages at `pagesId`, picked or made as the first was, then open beside
 * the pages as one more tab, in front. Null when the picker is closed with
 * nothing picked, or the pages' PDF is not a document of its own.
 */
export async function addNote(pagesId: string): Promise<string | null> {
  const pdf = pdfForNotes(pagesId, useApp.getState().docs);
  if (pdf === null) return null;
  const note = await askNote(pdf);
  if (note === null) return null;
  await openNotes(pagesId, note);
  return note;
}

/**
 * The palette asked for a note for `pdf`: one picked or made, or, with
 * `kind` `written`, a written notebook made (named as typed, in a folder
 * picked next). Resolves to it once it is the PDF's, null when the palette
 * is closed with nothing picked.
 */
export function askNote(pdf: string, kind?: 'written'): Promise<string | null> {
  asking?.resolve(null);
  return new Promise<string | null>((resolve) => {
    asking = { pdf, resolve };
    useApp.setState({ paletteOpen: true, noteAttach: { pdf, step: 'pick', ...(kind ? { kind } : {}) } });
  });
}

/** The picker closed with nothing picked. */
export function attachCancelled(): void {
  const a = asking;
  asking = null;
  a?.resolve(null);
}

/** A note that is there, picked: it names the PDF from now on (`pdf`, relative to the note), and is one of its notes. */
export async function attachNote(pdf: string, note: string): Promise<void> {
  const vault = currentVault();
  if (!vault) return;
  await vault.update(note, (doc) => setField(doc, 'pdf', relFrom(dirOf(note), pdf)));
  await settled(pdf, note);
  const a = asking;
  asking = null;
  a?.resolve(note);
}

/** A new note for the PDF, named as typed, in `dir`: made, attached, and the pick. With `kind` `written`, a written notebook, which names the PDF from the start. */
export async function attachNewNote(pdf: string, name: string, dir: string, kind?: 'written'): Promise<void> {
  const vault = currentVault();
  if (!vault) return;
  if (kind === 'written') {
    const note = await createWritten(dir, name, pdf);
    await settled(pdf, note);
    const a = asking;
    asking = null;
    a?.resolve(note);
    return;
  }
  const note = await vault.createDoc(dir, 'note', name);
  await attachNote(pdf, note);
}

/** Until the app's docs show the note as the PDF's: the tree walked, the index told. */
function settled(pdf: string, note: string): Promise<void> {
  return new Promise((resolve) => {
    const done = () => { off(); clearTimeout(t); resolve(); };
    const t = setTimeout(done, 3000);
    const there = (s: { docs: Record<string, DocInfo> }) => !!s.docs[pdf]?.notes?.includes(note) && s.docs[note]?.of === pdf;
    const off = useApp.subscribe((s) => { if (there(s)) done(); });
    if (there(useApp.getState())) done();
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
  /** Go to a place (an entry of the contents, a bookmark, a highlight): a jump, with the way back; one outside the pages shown is said. */
  go(place: { page: number; y: number }, exact?: boolean): void;
  /** Shown beside the page being read: moved to a portal's destination, no jump (milestone 77). */
  show?(place: { page: number; y: number }, portal: string): void;
}

const lenses = new Map<string, BookLens[]>();

/** A lens over the book at `id` is there; the undoing takes it away again. */
export function addLens(id: string, lens: BookLens): () => void {
  lenses.set(id, [...(lenses.get(id) ?? []), lens]);
  tell();
  return () => {
    const rest = (lenses.get(id) ?? []).filter((l) => l !== lens);
    if (rest.length) lenses.set(id, rest); else lenses.delete(id);
    // the pane beside closed, or the one it followed: nothing follows any more. Looked at a moment later, since a lens
    // taken down and put straight back (a pane drawn again, a development build's second mount) has closed nothing
    // (nor has one whose pane shows another book for a while: a portal into it, `away`)
    if (rest.length < 2) setTimeout(() => { if ((lenses.get(id)?.length ?? 0) < 2 && !stillAway(id) && following.delete(id)) { sentTo.delete(id); away.delete(id); tell(); } }, 0);
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
  // under the palette (or the tweaks) no lens is active: the book is the one in the tab in front
  const st = useApp.getState();
  const front = st.panes.panes[st.panes.active]?.tabs[st.panes.panes[st.panes.active]?.active ?? 0]?.id;
  return front !== undefined && lenses.has(front) && (lenses.get(front)?.length ?? 0) > 0 ? front : null;
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

// ── what is left on the pages (milestone 77) ──
// A PDF's marks (bookmarks, marks by a letter, highlights, portals), by its
// SHA-256: read once from `.ilmi/marks/<sha256>.json` (`src/vault/marks.ts`)
// and kept here for as long as the collection is open; a change is the file
// written again, which the engine records as one register (the entry that
// changed). A file that changed under us (a sync) is read again.

interface Held { marks: Marks; rest: Record<string, unknown> }
const NO_MARKS: Marks = Object.freeze({}) as Marks;
let heldFor: unknown = null;
const held = new Map<string, Held>();
const loading = new Map<string, Promise<Marks>>();
/** Writes of a PDF's file not yet landed: none is read over. */
const writing = new Map<string, { n: number; chain: Promise<void> }>();
let allRead: Promise<void> | null = null;

/** The marks are one collection's: another one open, and nothing held is its. */
function fresh(): void {
  const vault = currentVault();
  if (vault === heldFor) return;
  heldFor = vault;
  held.clear();
  loading.clear();
  writing.clear();
  allRead = null;
}

async function readMarks(hash: string): Promise<Held> {
  const vault = currentVault();
  if (!vault) return { marks: {}, rest: {} };
  const abs = vault.abs(marksPath(hash));
  const text = (await vault.fs.stat(abs)) ? await vault.fs.readText(abs).catch(() => null) : null;
  const all = marksMap(text) ?? {};
  const marks = parseMarks(text);
  return { marks, rest: Object.fromEntries(Object.entries(all).filter(([k]) => !(k in marks))) };
}

/** A PDF's marks, read once. */
export function loadMarks(hash: string): Promise<Marks> {
  fresh();
  const have = held.get(hash);
  if (have) return Promise.resolve(have.marks);
  let p = loading.get(hash);
  if (!p) {
    const vault = heldFor;
    p = readMarks(hash).then((h) => {
      loading.delete(hash);
      if (vault !== currentVault()) return h.marks;
      // a mark made while the file was being read stands
      if (!held.has(hash)) { held.set(hash, h); tell(); }
      return held.get(hash)!.marks;
    });
    loading.set(hash, p);
  }
  return p;
}

/** A PDF's marks as they are held: none until they are read (asked for here). */
export function marksOf(hash: string | null): Marks {
  if (hash === null) return NO_MARKS;
  fresh();
  const have = held.get(hash);
  if (have) return have.marks;
  void loadMarks(hash).catch(console.error);
  return NO_MARKS;
}
/** A PDF's marks, as they change. */
export const useMarks = (hash: string | null): Marks => useSyncExternalStore(subscribe, () => marksOf(hash));

/** One entry set, or (null) taken away: held at once, the file written behind it. */
export async function setMark(hash: string, id: string, mark: Mark | null): Promise<void> {
  await loadMarks(hash);
  const vault = currentVault();
  const was = held.get(hash) ?? { marks: {}, rest: {} };
  const { [id]: _gone, ...others } = was.marks;
  const next: Held = { marks: mark ? { ...others, [id]: mark } : others, rest: was.rest };
  held.set(hash, next);
  tell();
  if (!vault) return;
  const w = writing.get(hash) ?? { n: 0, chain: Promise.resolve() };
  writing.set(hash, w);
  w.n += 1;
  const text = serializeMarks(next.marks, next.rest);
  w.chain = w.chain.then(async () => {
    await vault.fs.mkdir(vault.abs(MARKS_DIR));
    await vault.fs.writeText(vault.abs(marksPath(hash)), text);
  }).catch(console.error).finally(() => { w.n -= 1; });
  await w.chain;
}

onHiddenChange((paths) => {
  fresh();
  for (const path of paths) {
    const hash = marksHashOf(path);
    if (hash === null) continue;
    allRead = null;
    // our own write, or one behind it: what is held is the later
    if (!held.has(hash) || (writing.get(hash)?.n ?? 0) > 0) continue;
    const vault = heldFor;
    void readMarks(hash).then((h) => {
      if (vault !== currentVault() || (writing.get(hash)?.n ?? 0) > 0) return;
      if (serializeMarks(h.marks, h.rest) === serializeMarks(held.get(hash)?.marks ?? {}, held.get(hash)?.rest)) return;
      held.set(hash, h);
      tell();
    }).catch(console.error);
  }
});

/** Told when any PDF's marks change (the queue reads the passages among them). */
export const onMarks = subscribe;

/** Every PDF's marks as they are held now, by its hash: what has been read, nothing asked for. */
export function heldMarks(): Map<string, Marks> {
  fresh();
  return new Map([...held].map(([h, v]) => [h, v.marks]));
}

/** Every PDF's marks, by its hash: each file under `.ilmi/marks/` read once (the palette's `bookmarks` and `marks`, a capital mark gone to). */
export async function allMarks(): Promise<Map<string, Marks>> {
  fresh();
  const vault = currentVault();
  if (vault) {
    allRead ??= (async () => {
      const dir = vault.abs(MARKS_DIR);
      const names = (await vault.fs.stat(dir)) ? (await vault.fs.readDir(dir)).map((e) => e.name) : [];
      await Promise.all(names.map((n) => marksHashOf(n)).filter((h): h is string => h !== null).map((h) => loadMarks(h)));
    })().catch(console.error);
    await allRead;
  }
  return new Map([...held].map(([h, v]) => [h, v.marks]));
}

/** The SHA-256 of the PDF whose pages the document at `id` is; a written notebook's own id, which stands where a PDF's hash does (milestone 82); null when it has none, or the collection is no store. */
export function pdfHashOf(id: string): string | null {
  const vault = currentVault();
  const info = useApp.getState().docs[id];
  if (info?.written) return info.written.id;
  const rel = info?.pdf;
  if (!vault || rel === undefined || !('blobAt' in vault.fs)) return null;
  return (vault.fs as StoreFs).blobAt(join(vault.root, rel));
}

/** The document to open for a place in the PDF `hash`: the whole book before a chapter of it, a chapter that holds the page before one that does not; null when no document of the collection has those pages any more. */
export function bookFor(hash: string, page: number): string | null {
  const docs = useApp.getState().docs;
  let best: { id: string; rank: number } | null = null;
  for (const [id, info] of Object.entries(docs)) {
    if (info.pdf === undefined || pdfHashOf(id) !== hash) continue;
    const r = info.pages;
    const rank = !r ? 0 : page >= r.first && page <= r.last ? 1 : 2;
    if (!best || rank < best.rank || (rank === best.rank && id < best.id)) best = { id, rank };
  }
  return best?.id ?? null;
}

const wantedPlace = new Map<string, { page: number; y: number }>();
/** Open the book at `id` at a place: its lens goes there as a jump once its pages are there. */
export function openBookAt(id: string, place: { page: number; y: number }): void {
  wantedPlace.set(id, { page: place.page, y: place.y });
  openNode(id);
  tell();
}
/** Whether a place waits for the book at `id` (a count that moves, for the lens to see). */
export const usePlaceWanted = (id: string): { page: number; y: number } | null => useSyncExternalStore(subscribe, () => wantedPlace.get(id) ?? null);
export function takePlace(id: string): { page: number; y: number } | null {
  const p = wantedPlace.get(id) ?? null;
  wantedPlace.delete(id);
  return p;
}

/** Go to a place in the PDF `hash` from anywhere: in the book in front when it has those pages, else the document that has them opened there. */
export function goToMark(hash: string, place: { page: number; y: number }, from?: string): void {
  const front = from ?? bookInFront();
  if (front !== null && pdfHashOf(front) === hash) {
    const at = lensPlace(front, place);
    if (at) lensOf(front)?.go(at, true);
    return;
  }
  const id = bookFor(hash, place.page);
  if (id === null) { notify('that pdf is no longer in the collection · its marks are kept'); return; }
  const at = lensPlace(id, place);
  if (at) openBookAt(id, at);
}

/**
 * A place as a mark holds it, as the lens over the document at `id` counts
 * pages: a PDF's the same; a written notebook's mark names the sheet's own
 * number, and the lens counts its sheets 1..N as they lie (milestone 82).
 * Null when the notebook has that sheet no longer.
 */
function lensPlace(id: string, place: { page: number; y: number }): { page: number; y: number } | null {
  const w = useApp.getState().docs[id]?.written;
  if (!w) return place;
  const at = placeOfSheet(w.sheets, place.page);
  return at === null ? null : { ...place, page: at };
}

/** A capital mark set in the PDF `hash`: the collection has one of a letter, so every other book's goes. */
export async function setCollectionMark(hash: string, letter: string, mark: Mark): Promise<void> {
  const id = letterId(letter);
  for (const [h, marks] of await allMarks()) if (h !== hash && marks[id]) await setMark(h, id, null);
  await setMark(hash, id, mark);
}
/** Where the collection's mark `letter` is: the PDF and the place; null when no book has it. */
export async function findCollectionMark(letter: string): Promise<{ hash: string; page: number; y: number } | null> {
  const m = collectionMark(await allMarks(), letter);
  return m && { hash: m.hash, page: m.mark.page, y: m.mark.y };
}

// a portal being made (⇧P … ⇧P): its source waits here, since the destination may be in another book
let portalFrom: { hash: string; page: number; y: number } | null = null;
export const portalPending = (): typeof portalFrom => portalFrom;
export const usePortalPending = (): typeof portalFrom => useSyncExternalStore(subscribe, portalPending);
export function setPortalPending(from: typeof portalFrom): void {
  portalFrom = from;
  tell();
}

// the pane beside that follows the portals of the page being read: of two lenses over one book, the one made last
const following = new Set<string>();
/** Whether `lens` is the one that follows: shown beside the book at `id`, moved to each portal's destination as its source is read past. */
export const isFollower = (id: string, lens: BookLens): boolean => {
  const list = lenses.get(id) ?? [];
  return following.has(id) && list.length > 1 && list[list.length - 1] === lens;
};
export const useFollower = (id: string, lens: BookLens): boolean => useSyncExternalStore(subscribe, () => isFollower(id, lens));
/** Whether a pane beside follows the book at `id`. */
export const followed = (id: string): boolean => following.has(id) && ((lenses.get(id)?.length ?? 0) > 1 || stillAway(id));
export const useFollowed = (id: string): boolean => useSyncExternalStore(subscribe, () => followed(id));
/** What the pane that follows was last sent to: it goes there once its pages are there. */
const sentTo = new Map<string, { portal: string; to: { page: number; y: number } }>();
export const followingAt = (id: string): { portal: string; to: { page: number; y: number } } | null => (following.has(id) ? sentTo.get(id) ?? null : null);
/** The other book the pane beside shows for now: the last portal passed led into it. The book's own tab waits behind it there. */
const away = new Map<string, string>();
/** Whether the pane beside still shows that other book: its tab in front there, the book's own behind it. */
function stillAway(id: string): boolean {
  const other = away.get(id);
  if (other === undefined) return false;
  const panes = useApp.getState().panes;
  const at = besideAt(panes, id);
  return at !== null && panes.panes[at.pane]!.tabs[panes.panes[at.pane]!.active]?.id === other;
}
const besidePlace = new Map<string, { place: { page: number; y: number }; portal: string }>();
/** A place the book at `id` is to show beside (a portal of another book's led into it); its lens there takes it. */
export const useBesidePlace = (id: string): { place: { page: number; y: number }; portal: string } | null => useSyncExternalStore(subscribe, () => besidePlace.get(id) ?? null);
export function takeBesidePlace(id: string): { place: { page: number; y: number }; portal: string } | null {
  const p = besidePlace.get(id) ?? null;
  besidePlace.delete(id);
  return p;
}
/** `portals beside`: the book in the pane beside too, following; asked again, that pane's tab closes. A phone has no pane beside. */
export function togglePortalsBeside(id: string): void {
  const s = useApp.getState();
  if (s.phone) return;
  if (followed(id)) {
    following.delete(id);
    sentTo.delete(id);
    away.delete(id);
    useApp.setState({ panes: closeBeside(s.panes, id) });
    tell();
    return;
  }
  following.add(id);
  sentTo.delete(id);
  useApp.setState({ panes: openTwin(s.panes, id) });
  tell();
}
/** The page being read passed a portal's source: the pane that follows shows its destination, in another book when the portal leads into one. */
export function followTo(id: string, from: BookLens, portal: string, to: { page: number; y: number; pdf?: string }): void {
  if (!following.has(id)) return;
  const s = useApp.getState();
  if (to.pdf !== undefined) {
    const other = bookFor(to.pdf, to.page);
    if (other === null || other === id || !besideAt(s.panes, id)) return;
    sentTo.delete(id);
    away.set(id, other);
    besidePlace.set(other, { place: { page: to.page, y: to.y }, portal });
    useApp.setState({ panes: openWhereBeside(s.panes, id, other) });
    tell();
    return;
  }
  sentTo.set(id, { portal, to: { page: to.page, y: to.y } });
  if (away.delete(id)) {
    // back in the book itself: its own tab in front again beside, which goes there as its pages come
    useApp.setState({ panes: openWhereBeside(s.panes, id, id) });
    tell();
    return;
  }
  for (const l of lenses.get(id) ?? []) if (l !== from && isFollower(id, l)) l.show?.(to, portal);
}

/** When a passage is next, in a list's words: `due today`, `back in 4d`, `dismissed`. */
export function passageWhen(m: PassageMark, now: Date): string {
  if (m.due === undefined) return 'dismissed';
  const d = Math.round((dayStart(dayOf(whenToDate(m.due))).getTime() - dayStart(dayOf(now)).getTime()) / 86400000);
  return d <= 0 ? 'due today' : d === 1 ? 'back tomorrow' : `back in ${d}d`;
}

let passageSeq = 1_000_000;
/** Go to a passage on its pages: there as a jump, its boxes lit and flashed. */
export function goToPassage(hash: string, m: PassageMark, from?: string): void {
  goToMark(hash, m, from);
  const id = from ?? bookInFront() ?? bookFor(hash, m.page);
  if (id !== null) useApp.setState({ bookFocus: { path: id, text: m.boxes, seq: ++passageSeq } });
}

/** The palette's lists of what is left in books: a book's bookmarks, highlights or passages, every book's bookmarks, the marks by a letter. */
export type MarkList = 'bookmarks' | 'highlights' | 'passages' | 'all-bookmarks' | 'marks';
/** A row of such a list: its name, where it is, its page, and going there. */
export interface PlaceRow { title: string; sub: string; page: number; go(): void }
/** What a list says when it is empty: how one is made. */
export const MARK_LIST_EMPTY: Record<MarkList, string> = {
  bookmarks: 'no bookmarks in this pdf · b names the place in view',
  highlights: 'no highlights in this pdf · h on a selection makes one',
  passages: 'no passages here · drag a box on a page, then e',
  'all-bookmarks': 'no bookmarks yet · b in a book names the place in view',
  marks: 'no marks yet · ⇧M and a letter in a book sets one',
};

/** The rows of a list: `book` the book in front, for the lists that are one book's. */
export async function markList(kind: MarkList, book: string | null): Promise<PlaceRow[]> {
  const s = useApp.getState();
  const hash = book !== null ? pdfHashOf(book) : null;
  const nameOf = (h: string, page: number): string => { const id = bookFor(h, page); return id === null ? 'no longer in the collection' : titleOf(id, s.docs, s.vault); };
  if (kind === 'bookmarks' || kind === 'highlights' || kind === 'passages') {
    if (hash === null) return [];
    const marks = await loadMarks(hash);
    const go = (m: { page: number; y: number }) => () => goToMark(hash, m, book ?? undefined);
    // a passage by its pages and when it is next; gone to, its boxes are lit
    // (a notebook's by where its sheet lies)
    const sheets = book !== null ? s.docs[book]?.written?.sheets : undefined;
    if (kind === 'passages') return passageMarksOf(marks).map(([, m]) => ({ title: boxesLabel(book !== null ? s.docs[book] : undefined, parseBoxes(m.boxes) ?? []), sub: passageWhen(m, appNow()), page: sheets ? placeOfSheet(sheets, m.page) ?? m.page : m.page, go: () => goToPassage(hash, m, book ?? undefined) }));
    if (kind === 'bookmarks') return bookmarksOf(marks).map(([, m]) => ({ title: m.name, sub: '', page: m.page, go: go(m) }));
    return highlightsOf(marks).map(([, m]) => ({ title: m.text || `p. ${m.page}`, sub: '', page: m.page, go: go(m) }));
  }
  const all = await allMarks();
  if (kind === 'all-bookmarks') {
    const rows: PlaceRow[] = [];
    for (const [h, marks] of all) for (const [, m] of bookmarksOf(marks)) rows.push({ title: m.name, sub: nameOf(h, m.page), page: m.page, go: () => goToMark(h, m) });
    return rows.sort((a, b) => (a.sub < b.sub ? -1 : a.sub > b.sub ? 1 : a.page - b.page));
  }
  // the marks by a letter: the book in front's own, then the collection's
  const own = hash !== null ? lettersOf(all.get(hash) ?? {}).filter(([, m]) => !isCollectionMark(m.letter)).map(([, m]): PlaceRow => ({ title: m.letter, sub: '', page: m.page, go: () => goToMark(hash, m, book ?? undefined) })) : [];
  return [...own, ...collectionMarks(all).map(({ hash: h, mark: m }): PlaceRow => ({ title: m.letter, sub: nameOf(h, m.page), page: m.page, go: () => goToMark(h, m) }))];
}
