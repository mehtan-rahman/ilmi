import { create } from 'zustand';

// App state that is not on disk. The vault (milestone 2) stays the store of
// record for everything that is.

export type Theme = 'light' | 'dark' | 'eink';
export const THEMES: readonly Theme[] = ['light', 'dark', 'eink'];

export interface AppState {
  theme: Theme;
  density: number; // --rho: 1 regular, <1 compact, >1 airy
  /** Absolute path of the open vault, or null before one is picked. */
  vault: string | null;
  /** Vault-relative document paths, tree order. Kept in step by `src/app/vault.ts`. */
  files: string[];
  setTheme(theme: Theme): void;
  cycleTheme(): void;
  setDensity(rho: number): void;
}

export const useApp = create<AppState>((set, get) => ({
  theme: 'light',
  density: 1,
  vault: null,
  files: [],
  setTheme: (theme) => set({ theme }),
  cycleTheme: () => {
    const i = THEMES.indexOf(get().theme);
    set({ theme: THEMES[(i + 1) % THEMES.length] ?? 'light' });
  },
  setDensity: (density) => set({ density }),
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
