import { create } from 'zustand';
import type { NodeType, ReadSchedule, WriteSchedule } from '../format/index.js';
import type { TreeNode } from '../vault/index.js';
import { emptyPanes, type Panes } from './panes.js';

// App state that is not on disk, plus a read-only mirror of what is. The
// vault (src/app/vault.ts) is the store of record for the tree and the
// documents and keeps this in step; nothing here writes a file.

export type Theme = 'light' | 'dark' | 'eink';
export const THEMES: readonly Theme[] = ['light', 'dark', 'eink'];

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
}

export interface Sidebar {
  width: number;
  hidden: boolean;
}

export const SIDE_MIN = 160;
export const SIDE_MAX = 440;
export const SIDE_DEFAULT = 220;

export interface AppState {
  theme: Theme;
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
  panes: Panes;
  setTheme(theme: Theme): void;
  cycleTheme(): void;
  setDensity(rho: number): void;
  setPanes(next: Panes | ((cur: Panes) => Panes)): void;
}

export const useApp = create<AppState>((set, get) => ({
  theme: 'light',
  density: 1,
  vault: null,
  files: [],
  tree: [],
  docs: {},
  open: { '': true },
  sidebar: { width: SIDE_DEFAULT, hidden: false },
  panes: emptyPanes(),
  setTheme: (theme) => set({ theme }),
  cycleTheme: () => {
    const i = THEMES.indexOf(get().theme);
    set({ theme: THEMES[(i + 1) % THEMES.length] ?? 'light' });
  },
  setDensity: (density) => set({ density }),
  setPanes: (next) => set({ panes: typeof next === 'function' ? next(get().panes) : next }),
}));

declare global {
  interface Window {
    ilmi: {
      theme(name?: Theme): Theme;
      cycleTheme(): Theme;
      density(rho?: number): number;
    };
  }
}

// `ilmi.theme('dark')` from the devtools console. Until the tweaks panel
// exists (milestone 9) this is the only theme toggle.
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
