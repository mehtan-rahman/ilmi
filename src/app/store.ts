import { create } from 'zustand';
import type { NodeType, ReadSchedule, WriteSchedule } from '../format/index.js';
import type { QueueItem } from '../schedule/index.js';
import type { TreeNode } from '../vault/index.js';
import { emptyPanes, type Panes } from './panes.js';

// App state that is not on disk, plus a read-only mirror of what is. The
// vault (src/app/vault.ts) is the store of record for the tree and the
// documents and keeps this in step; nothing here writes a file.

export type Theme = 'light' | 'dark' | 'eink';
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
}
export const DENSITY_MIN = 0.6;
export const DENSITY_MAX = 1.6;
const TWEAKS_KEY = 'ilmi.tweaks';
const DEFAULT_TWEAKS: Tweaks = { theme: 'light', accent: 'gold', density: 1 };

function loadTweaks(): Tweaks {
  try {
    const raw = globalThis.localStorage?.getItem(TWEAKS_KEY);
    if (!raw) return DEFAULT_TWEAKS;
    const t = JSON.parse(raw) as Partial<Tweaks>;
    return {
      theme: THEMES.includes(t.theme as Theme) ? (t.theme as Theme) : DEFAULT_TWEAKS.theme,
      accent: t.accent !== undefined && t.accent in ACCENTS ? t.accent : DEFAULT_TWEAKS.accent,
      density: typeof t.density === 'number' && t.density >= DENSITY_MIN && t.density <= DENSITY_MAX ? t.density : DEFAULT_TWEAKS.density,
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

/** What the sidebar and the lenses need to know about a document without opening it. */
export interface DocInfo {
  type: NodeType;
  title?: string;
  frozen: boolean;
  /** Card blocks, and how many of them have something due. */
  cards: number;
  due: number;
  read?: ReadSchedule;
  write?: WriteSchedule;
  /** The `pri` field; absent means the default. */
  pri?: number;
  /** Vault-relative path of the document's pages, when it has a PDF beside it (or names one). */
  pdf?: string;
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
}

export const INSP_MIN = 220;
export const INSP_MAX = 520;
export const INSP_DEFAULT = 280;

/** The kinds of element a session walks. */
export type El = 'card' | 'read' | 'write';

/** A review session: the elements, in order, and a number that changes each time one starts. */
export interface Session {
  seq: number;
  items: QueueItem[];
}

export const SIDE_MIN = 160;
export const SIDE_MAX = 440;
export const SIDE_DEFAULT = 220;

export interface AppState {
  theme: Theme;
  accent: Accent;
  density: number; // --rho: 1 regular, <1 compact, >1 airy
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
  panes: Panes;
  paletteOpen: boolean;
  tweaksOpen: boolean;
  selectedCard: SelectedCard | null;
  reveal: Reveal | null;
  /** Where the intake places its next source: the folder it was opened from. */
  intakeDir: string;
  /** Every element over the vault, sorted, as of `queueAt`; the saved queries filter it. */
  queue: QueueItem[];
  queueAt: Date;
  /** How many elements the day holds; the day's queue folds there. 0 is no fold. Per vault, in `.ilmi/state.json`. */
  budget: number;
  /** The last few things done in a session, newest first. */
  log: string[];
  session: Session | null;
  /** What the session is on now, for its tab and the inspector. */
  sessionEl: { kind: El; label: string; item: QueueItem } | null;
  setTheme(theme: Theme): void;
  cycleTheme(): void;
  setAccent(accent: Accent): void;
  setDensity(rho: number): void;
  setPanes(next: Panes | ((cur: Panes) => Panes)): void;
}

const tweaks = loadTweaks();

export const useApp = create<AppState>((set, get) => ({
  theme: tweaks.theme,
  accent: tweaks.accent,
  density: tweaks.density,
  vault: null,
  files: [],
  tree: [],
  docs: {},
  open: { '': true },
  sidebar: { width: SIDE_DEFAULT, hidden: false },
  inspector: { width: INSP_DEFAULT, open: true },
  panes: emptyPanes(),
  paletteOpen: false,
  tweaksOpen: false,
  selectedCard: null,
  reveal: null,
  intakeDir: '',
  queue: [],
  queueAt: new Date(0),
  budget: 0,
  log: [],
  session: null,
  sessionEl: null,
  setTheme: (theme) => { set({ theme }); persist(get()); },
  cycleTheme: () => {
    const i = THEMES.indexOf(get().theme);
    set({ theme: THEMES[(i + 1) % THEMES.length] ?? 'light' });
    persist(get());
  },
  setAccent: (accent) => { set({ accent }); persist(get()); },
  setDensity: (density) => { set({ density: Math.min(DENSITY_MAX, Math.max(DENSITY_MIN, density)) }); persist(get()); },
  setPanes: (next) => set({ panes: typeof next === 'function' ? next(get().panes) : next }),
}));

const persist = (s: AppState) => saveTweaks({ theme: s.theme, accent: s.accent, density: s.density });

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
