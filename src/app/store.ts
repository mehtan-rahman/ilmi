import { create } from 'zustand';
import type { NodeType, ReadSchedule, Review, SectionSchedule, WriteSchedule } from '../format/index.js';
import type { QueueItem } from '../schedule/index.js';
import type { Order, TreeNode } from '../vault/index.js';
import type { DeckView } from './deck.js';
import { notesPair } from './names.js';
import { emptyPanes, type Panes } from './panes.js';
import { onePane } from './platform.js';
import { cleanRecents, type Recent } from './recents.js';
import { NUDGE_SERVER } from './nudge.js';
import type { SyncSettings, SyncState } from './sync.js';
import type { StorageSettings } from './storage.js';

// App state that is not on disk, plus a read-only mirror of what is. The
// vault (src/app/vault.ts) is the store of record for the tree and the
// documents and keeps this in step; nothing here writes a file.

export type Theme = 'light' | 'dark' | 'eink';

/** A folder lens: its items, its cards, its numbers; a deck's lens: its cards or its numbers. */
export type LensView = 'items' | 'cards' | 'numbers';
export const THEMES: readonly Theme[] = ['light', 'dark', 'eink'];

/** The accent presets from the prototype: one hue, one chroma; gold sets its own lightness. */
export type Accent = 'gold' | 'ink' | 'blue' | 'red' | 'sage' | 'graphite';
export interface AccentPreset { label: string; h: number; c: number; light: number; dark: number }
export const ACCENTS: Record<Accent, AccentPreset> = {
  gold: { label: 'gold', h: 86, c: 0.135, light: 0.62, dark: 0.8 },
  ink: { label: 'ink', h: 256, c: 0.085, light: 0.52, dark: 0.74 },
  blue: { label: 'pen blue', h: 248, c: 0.115, light: 0.52, dark: 0.74 },
  red: { label: 'proof red', h: 25, c: 0.15, light: 0.52, dark: 0.74 },
  sage: { label: 'sage', h: 150, c: 0.06, light: 0.52, dark: 0.74 },
  graphite: { label: 'graphite', h: 256, c: 0, light: 0.52, dark: 0.74 },
};

/** What the tweaks panel sets. Kept outside the vault, in the webview's storage. */
export interface Tweaks {
  theme: Theme;
  accent: Accent;
  density: number;
  /** The page's text size as a factor of 18px (⌘= ⌘− ⌘0). */
  zoom: number;
  /** Reopen the last vault on start, without a click. */
  reopen: boolean;
  /** Download a clipped page's images into the document's folder. */
  clipImages: boolean;
  /** Draw images the text names by an absolute address; off, their alt stands in. */
  remoteImages: boolean;
  /** The queue row names its document by its title; off, by its path. */
  queueTitles: boolean;
  /** Postpone the backlog (reading and writing due before today, below the fold) when the day starts. Off by default. */
  backlog: boolean;
}
export const DENSITY_MIN = 0.6;
export const DENSITY_MAX = 1.6;
export const ZOOM_MIN = 0.7;
export const ZOOM_MAX = 1.8;
export const ZOOM_STEP = 0.1;
const TWEAKS_KEY = 'ilmi.tweaks';
const DEFAULT_TWEAKS: Tweaks = { theme: 'light', accent: 'gold', density: 1, zoom: 1, reopen: true, clipImages: true, remoteImages: true, queueTitles: false, backlog: false };

function loadTweaks(): Tweaks {
  try {
    const raw = globalThis.localStorage?.getItem(TWEAKS_KEY);
    if (!raw) return DEFAULT_TWEAKS;
    const t = JSON.parse(raw) as Partial<Tweaks>;
    return {
      theme: THEMES.includes(t.theme as Theme) ? (t.theme as Theme) : DEFAULT_TWEAKS.theme,
      accent: t.accent !== undefined && t.accent in ACCENTS ? t.accent : DEFAULT_TWEAKS.accent,
      density: typeof t.density === 'number' && t.density >= DENSITY_MIN && t.density <= DENSITY_MAX ? t.density : DEFAULT_TWEAKS.density,
      zoom: typeof t.zoom === 'number' && t.zoom >= ZOOM_MIN && t.zoom <= ZOOM_MAX ? t.zoom : DEFAULT_TWEAKS.zoom,
      reopen: typeof t.reopen === 'boolean' ? t.reopen : DEFAULT_TWEAKS.reopen,
      clipImages: typeof t.clipImages === 'boolean' ? t.clipImages : DEFAULT_TWEAKS.clipImages,
      remoteImages: typeof t.remoteImages === 'boolean' ? t.remoteImages : DEFAULT_TWEAKS.remoteImages,
      queueTitles: typeof t.queueTitles === 'boolean' ? t.queueTitles : DEFAULT_TWEAKS.queueTitles,
      backlog: typeof t.backlog === 'boolean' ? t.backlog : DEFAULT_TWEAKS.backlog,
    };
  } catch {
    return DEFAULT_TWEAKS;
  }
}

function saveTweaks(t: Tweaks): void {
  try {
    globalThis.localStorage?.setItem(TWEAKS_KEY, JSON.stringify(t));
  } catch { /* private window, or no storage: the session keeps them */ }
}

// The vaults opened before, the same way: outside any vault, in the webview's storage.
const RECENTS_KEY = 'ilmi.recents';

function loadRecents(): Recent[] {
  try {
    const raw = globalThis.localStorage?.getItem(RECENTS_KEY);
    return raw ? cleanRecents(JSON.parse(raw)) : [];
  } catch {
    return [];
  }
}

function saveRecents(list: Recent[]): void {
  try {
    globalThis.localStorage?.setItem(RECENTS_KEY, JSON.stringify(list));
  } catch { /* as the tweaks: the session keeps them */ }
}

/** What the sidebar and the lenses need to know about a document without opening it. */
export interface DocInfo {
  type: NodeType;
  title?: string;
  frozen: boolean;
  /** Card blocks, and how many of them have something due. */
  cards: number;
  due: number;
  /** Sections that come back (FORMAT.md §6.5) due now; absent for none. */
  sections?: number;
  read?: ReadSchedule;
  write?: WriteSchedule;
  /** The `pri` field; absent means the default. */
  pri?: number;
  /**
   * Vault-relative path of the document's pages, when it opens as them: a
   * PDF beside it (or one it names, when that PDF is not a document of its
   * own), or, for a PDF on its own, itself (milestone 70).
   */
  pdf?: string;
  /** A note attached to a PDF on its own (its `pdf` field names one): that PDF's path. The note opens as itself and is the PDF's notes. */
  of?: string;
  /** A PDF on its own: the note that is its notes (the first in path order naming it), when one does. */
  note?: string;
  /** `tabs: true`: its children are tabs in a rail beside its page (`tabs.ts`). */
  tabs?: true;
  /** The `pages` field: which pages of its PDF it is (a chapter of a book that landed as a notebook). */
  pages?: { first: number; last: number };
}

export interface Sidebar {
  width: number;
  hidden: boolean;
}

export interface Inspector {
  width: number;
  open: boolean;
}

/** A card selected in a reader or a deck, for the inspector's card editor. */
export interface SelectedCard {
  path: string;
  /** Child index in the document's blocks. */
  index: number;
}

/**
 * A card to land on once its document is showing: opened from the palette
 * or a query. The lens for `path` selects it, scrolls to it, and clears
 * this. Transient; never saved.
 */
export interface Reveal {
  path: string;
  /** The block index when it was named; `id` finds the card if that has moved. */
  index: number;
  id?: string;
  /** A section's heading, not a card (a section opened from the queue): its text finds it if it has moved. */
  heading?: string;
  /** The caret in a fresh line after it (a heading: after its section) instead of on it, to write there: a passage just boxed, a clip. */
  write?: true;
}

/** A book's note asked to show a section on the pages (`path` the pages'): its boxes lit and scrolled to, flashed (`seq` changes each time). Transient. */
export interface BookFocus {
  path: string;
  text: string;
  seq: number;
}

/**
 * The heading the caret is under in a reader, for the inspector's section
 * part, the palette and the heading's menu: the page, the heading's place
 * among the page's headings (the outline's count, empty ones left out), and
 * its text. Transient; never saved.
 */
export interface CaretHeading {
  path: string;
  nth: number;
  text: string;
  /** Its section's line as the page holds it now, when it has one. */
  read?: SectionSchedule;
}

export const INSP_MIN = 220;
export const INSP_MAX = 520;
export const INSP_DEFAULT = 280;

/** The kinds of element a session walks. */
export type El = 'card' | 'read' | 'write' | 'section';

/** A review session: the elements, in order, and a number that changes each time one starts. */
export interface Session {
  seq: number;
  items: QueueItem[];
  /** Studying one deck (`study`): the lens it came from and its title; the header names it and the end goes back to it. */
  deck?: { id: string; title: string };
}

export const SIDE_MIN = 160;
export const SIDE_MAX = 440;
export const SIDE_DEFAULT = 232;

/** A notice over the canvas. `seq` tells one from the next; `undo` says one is held for it (`src/app/land.ts`). */
export interface Notice {
  seq: number;
  line: string;
  /** The document `open` opens, or null for none. */
  open: string | null;
  undo: boolean;
}

export interface AppState {
  theme: Theme;
  accent: Accent;
  density: number; // --rho: 1 regular, <1 compact, >1 airy
  /** The page's text size, `--zoom`: 1 is 18px. A tweak, kept with the others. */
  zoom: number;
  /** Reopen the last vault on start. A tweak, kept with the others. */
  reopen: boolean;
  /** Download a clipped page's images. A tweak, kept with the others. */
  clipImages: boolean;
  /** Show images from the web in the reader. A tweak, kept with the others. */
  remoteImages: boolean;
  /** The queue row shows the document's title rather than its path. A tweak, kept with the others. */
  queueTitles: boolean;
  /** Postpone the backlog when the day starts (`vault.ts`'s `dayStarted`). A tweak, kept with the others, off by default. */
  backlog: boolean;
  /** The collections there are, the last opened first (the welcome's rows, Open Recent); in the webview's storage. */
  recents: Recent[];
  /** Collections that did not open when last tried. */
  gone: string[];
  /** False until the start decision is made, so the welcome does not flash before a vault reopens itself. */
  started: boolean;
  /** On an iPad (`platform.ts`): the welcome is `connect` and the clones, the shell one pane. Set once at launch. */
  mobile: boolean;
  /** The shell is a phone's (milestone 56, `platform.ts`): set by App from the window. */
  phone: boolean;
  /** The quick card's composer, open on the deck it will land in (`quick.ts`). */
  quickCard: { deck: string } | null;
  /** The deck the last quick card went to, on this device. */
  lastDeck: string | null;
  /** The sidebar drawn as a sheet over the page (an iPad in portrait), open. Not saved. */
  sideSheet: boolean;
  /** A new collection is being named, on the welcome. */
  namingVault: boolean;
  /** Absolute path of the open vault, or null before one is picked. */
  vault: string | null;
  /** Vault-relative document paths, tree order. */
  files: string[];
  tree: TreeNode[];
  docs: Record<string, DocInfo>;
  /** Open folders (and documents with children) in the sidebar, by path; `''` is the root. */
  open: Record<string, true>;
  sidebar: Sidebar;
  inspector: Inspector;
  /** The inspector asked for (⌘⇧I, the toggle) while the window has no room for it: shown anyway (`layout.ts`). Not saved. */
  inspForced: boolean;
  /** The inspector asked for over a book, which opens without it (milestone 70); closed again when a book next opens. Not saved. */
  bookInsp: boolean;
  panes: Panes;
  paletteOpen: boolean;
  /** The palette is choosing a note to move this section to (milestone 50); null otherwise. */
  sectionMove: CaretHeading | null;
  /**
   * The palette is choosing the note for a PDF on its own (milestone 70): a
   * note that is there, or a new one, named as typed, in a folder picked
   * next (`place`, the name chosen). `book.ts` holds who asked. Null otherwise.
   */
  noteAttach: { pdf: string; step: 'pick' | 'place'; name?: string } | null;
  tweaksOpen: boolean;
  selectedCard: SelectedCard | null;
  reveal: Reveal | null;
  /** Moves when a page of ink changes (milestone 58): a reader showing its picture reads it again. */
  inkRev: number;
  caretHeading: CaretHeading | null;
  /** The sections whose boxes are drawn inline in a book's notes (`show boxes here`), by document, by heading text. Not saved. */
  inlineBoxes: Record<string, string[]>;
  bookFocus: BookFocus | null;
  /** Where the intake places its next source: the folder it was opened from. */
  intakeDir: string;
  /** Every element over the vault, sorted, as of `queueAt`; the saved queries filter it. */
  queue: QueueItem[];
  queueAt: Date;
  /** How many elements the day holds; the day's queue folds there. 0 is no fold. Per vault, in `.ilmi/state.json`. */
  budget: number;
  /** Where an `ilmi://new` link lands a clipping when it names no folder; `''` is the root. Per vault, in `.ilmi/state.json`. */
  clipDir: string;
  /** The last few things done in a session, newest first. */
  log: string[];
  /** The one notice over the canvas: what just landed, with `undo` and `open`; null when there is none. */
  notice: Notice | null;
  /** The row an OS file drag is over (a tree or folder-lens row, by path), lit as a drop target; null when none. */
  fileOver: string | null;
  /** Dropped or picked files that need a choice, waiting on the intake, oldest first. */
  intakeFiles: string[];
  /** The order chosen for each directory (`.ilmi/order.json`, `vault/order.ts`); the tree and the folder lens list by it. */
  order: Order;
  /** Notebooks (documents with `tabs: true`) whose tab rail is folded to a strip, by path. Per vault, in `.ilmi/state.json`. */
  railFolded: Record<string, true>;
  /** The tab rail's width in px, one for every notebook (`tabs.ts`'s `clampRail`). Per vault, in `.ilmi/state.json`. */
  railWidth: number;
  /** The deck browser's chips and sort, per lens id (`.ilmi/state.json`'s `decks`). */
  deckViews: Record<string, DeckView>;
  /** The headings folded in the reader, by document path: the keys `fold.ts` gives them. Per vault, in `.ilmi/state.json`'s `folds`. */
  folds: Record<string, string[]>;
  /** Every review logged (`.ilmi/reviews/`), oldest first, for the numbers. Empty without a log. */
  reviews: Review[];
  /** Pairs of cards said not to be the same fact (`.ilmi/same.json`, `same.ts`'s `pairKey`): never listed again. */
  notSame: string[];
  /** What a folder's or a deck's lens shows: its items, its cards, or its numbers. Not remembered. */
  lensViews: Record<string, LensView>;
  /** The queue shown for one exam only (`examKey`); null, everything. Not remembered. */
  examFilter: string | null;
  /** Sync by git (`sync.ts`): where the open vault stands with its remote. */
  sync: SyncState;
  /** The open vault's remote and token, kept with the tweaks (`sync.ts`); empty when none. */
  syncSettings: SyncSettings;
  /** The folder the open collection is mirrored to (`keep.ts`); empty, none. */
  mirror: string;
  /** The storage the open collection syncs through and what this device keeps of its files (`storage.ts`, milestone 63). */
  storage: StorageSettings;
  /** The files of the open collection whose bytes are not on this device, by path: a book's row says so. */
  away: string[];
  session: Session | null;
  /** What the session is on now, for its tab and the inspector. */
  sessionEl: { kind: El; label: string; item: QueueItem } | null;
  setTheme(theme: Theme): void;
  cycleTheme(): void;
  setAccent(accent: Accent): void;
  setDensity(rho: number): void;
  setZoom(zoom: number): void;
  setReopen(on: boolean): void;
  setClipImages(on: boolean): void;
  setRemoteImages(on: boolean): void;
  setQueueTitles(on: boolean): void;
  setBacklog(on: boolean): void;
  /** Replace the recents list; it is saved as the tweaks are. */
  setRecents(list: Recent[]): void;
  setPanes(next: Panes | ((cur: Panes) => Panes)): void;
}

const tweaks = loadTweaks();

/**
 * The theme on the page at once, not only from App's effect: a covered
 * WebKit window throttles the timers React's effects wait on, and the page
 * kept the theme before last for a while (41's window run 3).
 */
function showTheme(theme: Theme): void {
  if (typeof document !== 'undefined') document.documentElement.setAttribute('data-theme', theme);
}

export const useApp = create<AppState>((set, get) => ({
  theme: tweaks.theme,
  accent: tweaks.accent,
  density: tweaks.density,
  zoom: tweaks.zoom,
  reopen: tweaks.reopen,
  clipImages: tweaks.clipImages,
  remoteImages: tweaks.remoteImages,
  queueTitles: tweaks.queueTitles,
  backlog: tweaks.backlog,
  recents: loadRecents(),
  gone: [],
  started: false,
  mobile: false,
  phone: false,
  quickCard: null,
  lastDeck: null,
  sideSheet: false,
  namingVault: false,
  vault: null,
  files: [],
  tree: [],
  docs: {},
  open: { '': true },
  sidebar: { width: SIDE_DEFAULT, hidden: false },
  inspector: { width: INSP_DEFAULT, open: true },
  inspForced: false,
  bookInsp: false,
  panes: emptyPanes(),
  paletteOpen: false,
  sectionMove: null,
  noteAttach: null,
  tweaksOpen: false,
  selectedCard: null,
  reveal: null,
  inkRev: 0,
  caretHeading: null,
  inlineBoxes: {},
  bookFocus: null,
  intakeDir: '',
  queue: [],
  queueAt: new Date(0),
  budget: 0,
  clipDir: '',
  log: [],
  notice: null,
  fileOver: null,
  intakeFiles: [],
  order: {},
  railFolded: {},
  railWidth: 200,
  deckViews: {},
  folds: {},
  reviews: [],
  examFilter: null,
  notSame: [],
  lensViews: {},
  sync: { on: false, repo: false, busy: null, offline: false, toPush: 0, conflicts: [], at: null },
  syncSettings: { url: '', token: '', server: NUDGE_SERVER },
  mirror: '',
  storage: { on: false, kind: 'folder', folder: '', endpoint: '', bucket: '', key: '', secret: '', address: '', user: '', password: '', appKey: '', clientId: '', clientSecret: '', place: '', account: '', dev: '', keep: null },
  away: [],
  session: null,
  sessionEl: null,
  setTheme: (theme) => { set({ theme }); showTheme(theme); persist(get()); },
  cycleTheme: () => {
    const i = THEMES.indexOf(get().theme);
    const theme = THEMES[(i + 1) % THEMES.length] ?? 'light';
    set({ theme });
    showTheme(theme);
    persist(get());
  },
  setAccent: (accent) => { set({ accent }); persist(get()); },
  setDensity: (density) => { set({ density: Math.min(DENSITY_MAX, Math.max(DENSITY_MIN, density)) }); persist(get()); },
  setZoom: (zoom) => { set({ zoom: Math.round(Math.min(ZOOM_MAX, Math.max(ZOOM_MIN, zoom)) * 100) / 100 }); persist(get()); },
  setReopen: (reopen) => { set({ reopen }); persist(get()); },
  setClipImages: (clipImages) => { set({ clipImages }); persist(get()); },
  setRemoteImages: (remoteImages) => { set({ remoteImages }); persist(get()); },
  setQueueTitles: (queueTitles) => { set({ queueTitles }); persist(get()); },
  setBacklog: (backlog) => { set({ backlog }); persist(get()); },
  setRecents: (recents) => { set({ recents }); saveRecents(recents); },
  setPanes: (next) => set({ panes: typeof next === 'function' ? next(get().panes) : next }),
}));

// an iPad shows one pane: whatever asks for a second (a split, ⌘⇧-click) is folded back into the first;
// but for a PDF's pages and the note on them, which are the split `notes` asks for (milestone 70, `book.ts`)
useApp.subscribe((s) => {
  if (s.mobile && s.panes.panes.length > 1 && (s.phone || !notesPair(s.panes, s.docs, s.sessionEl?.item.path))) useApp.setState({ panes: onePane(s.panes) });
});

const persist = (s: AppState) => saveTweaks({ theme: s.theme, accent: s.accent, density: s.density, zoom: s.zoom, reopen: s.reopen, clipImages: s.clipImages, remoteImages: s.remoteImages, queueTitles: s.queueTitles, backlog: s.backlog });

declare global {
  interface Window {
    ilmi: {
      theme(name?: Theme): Theme;
      cycleTheme(): Theme;
      density(rho?: number): number;
    };
  }
}

// `ilmi.theme('dark')` from the devtools console; the tweaks panel (⌘,) is
// the same knobs with a face.
export function exposeConsole(): void {
  window.ilmi = {
    theme(name) {
      if (name !== undefined) {
        if (!THEMES.includes(name)) throw new Error(`theme: one of ${THEMES.join(', ')}`);
        useApp.getState().setTheme(name);
      }
      return useApp.getState().theme;
    },
    cycleTheme() {
      useApp.getState().cycleTheme();
      return useApp.getState().theme;
    },
    density(rho) {
      if (rho !== undefined) useApp.getState().setDensity(rho);
      return useApp.getState().density;
    },
  };
}
