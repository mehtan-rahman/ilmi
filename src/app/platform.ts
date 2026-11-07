// Where the app runs (milestone 55). On the Mac nothing here changes
// anything. On an iPad the Rust side says `mobile` and names the app's
// Documents folder (the Files app shows it; since milestone 59 the
// collections are databases under the app's data directory there as on the
// Mac, and Documents holds only a dev run's `smoke.json`),
// the welcome is `connect` and the collections, and the shell is one pane, a
// landscape iPad a narrow Mac with the sidebar and the inspector hidden,
// portrait the same with the sidebar a sheet from the left edge and a
// book's notes folded. Under 600 px the shell is a phone's (milestone 56): the
// day is its face, one page at a time, a bar at the foot. The pure parts are
// here; `vault.ts` asks the Rust side once at launch, `App.tsx` draws by the
// shape.

import { invoke } from '@tauri-apps/api/core';
import type { Panes } from './panes.js';
import { vaultName, type Recent } from './recents.js';

export interface Platform {
  mobile: boolean;
  /** The app's Documents on iOS; null on the desktop. */
  documents: string | null;
}

export const DESKTOP: Platform = { mobile: false, documents: null };

let platform: Platform = DESKTOP;

export const isMobile = (): boolean => platform.mobile;
export const documentsDir = (): string | null => platform.documents;

/** Take the platform as given (the launch, a test); the page carries `data-mobile` for the styles. */
export function setPlatform(p: Platform): void {
  platform = { mobile: p.mobile, documents: p.documents ? p.documents.replace(/\/+$/, '') : null };
  if (typeof document !== 'undefined') {
    if (platform.mobile) document.documentElement.setAttribute('data-mobile', '1');
    else document.documentElement.removeAttribute('data-mobile');
  }
}

/** Ask the Rust side where the app runs. Outside Tauri it is the desktop. */
export async function loadPlatform(): Promise<Platform> {
  try {
    const p = await invoke<Platform>('platform');
    setPlatform({ mobile: !!p?.mobile, documents: typeof p?.documents === 'string' ? p.documents : null });
  } catch {
    setPlatform(DESKTOP);
  }
  return platform;
}

/** The shell's shape: the Mac's; on an iPad the window wider than tall or not; a phone's. */
export type Shape = 'desktop' | 'landscape' | 'portrait' | 'phone';

/** Under this a window is a phone's, either way up: a phone on its side is still a phone, and no narrow Mac. */
export const PHONE_MAX = 600;

export function shapeOf(mobile: boolean, width: number, height: number): Shape {
  if (!mobile) return 'desktop';
  if (Math.min(width, height) < PHONE_MAX) return 'phone';
  return width > height ? 'landscape' : 'portrait';
}

/** Whether the shell is a phone's now. What draws reads `phone` in the store; this is for the launch, before anything has. */
export const isPhone = (): boolean => platform.mobile && shapeOf(true, window.innerWidth, window.innerHeight) === 'phone';

/** Where the collections live (`collections/` under the app's data directory); null until the Rust side has said. */
let home: string | null = null;

export const collectionsHome = (): string | null => home;

export function setCollectionsHome(path: string | null): void {
  home = path ? path.replace(/\/+$/, '') : null;
}

/**
 * The key a collection's settings are kept under, outside it. The app's
 * data directory moves between installs on iOS, so a collection is known
 * by its name there (`collection:name`); a path elsewhere is itself.
 */
export function vaultKey(root: string, collections: string | null = home): string {
  const r = root.replace(/\/+$/, '');
  if (collections) {
    const d = collections.replace(/\/+$/, '');
    if (r.startsWith(`${d}/`)) return `collection:${r.slice(d.length + 1)}`;
  }
  return r;
}

/** The folder a clone of `url` is named for: its last segment, `.git` and a trailing slash off; `collection` when there is none. */
export function nameFromRemote(url: string): string {
  const clean = url.trim().replace(/[?#].*$/, '').replace(/\/+$/, '').replace(/\.git$/i, '');
  const last = clean.split(/[/:\\]/).filter(Boolean).pop() ?? '';
  const name = last.replace(/[^\p{L}\p{N}._ -]+/gu, '-').replace(/^[.\s-]+|[.\s-]+$/g, '');
  return name || 'collection';
}

/** A row's time for a vault never opened here: before anything was. */
export const NEVER = new Date(0).toISOString();

/**
 * The welcome's rows: every collection there is (`names`, the folders
 * under `collections`), at the path it has now, with the time it was last
 * opened when the recents remember one of that name; the last opened
 * first, then by name. Nothing outside `collections` is listed.
 */
export function collectionRows(collections: string, names: readonly string[], recents: readonly Recent[]): Recent[] {
  const d = collections.replace(/\/+$/, '');
  const opened = new Map<string, string>();
  for (const r of recents) {
    const n = vaultName(r.path);
    if (!opened.has(n) || Date.parse(r.opened) > Date.parse(opened.get(n)!)) opened.set(n, r.opened);
  }
  return names
    .map((name) => ({ path: `${d}/${name}`, name, opened: opened.get(name) ?? NEVER }))
    .sort((a, b) => Date.parse(b.opened) - Date.parse(a.opened) || a.name.localeCompare(b.name));
}

/** One pane: every tab in the first, the active pane's tab on top. Unchanged when there is one already. */
export function onePane(s: Panes): Panes {
  if (s.panes.length <= 1) return s;
  const tabs = s.panes.flatMap((p) => p.tabs);
  const cur = s.panes[s.active]?.tabs[s.panes[s.active]?.active ?? 0];
  const active = Math.max(0, cur ? tabs.indexOf(cur) : 0);
  return { ...s, panes: [{ tabs, active }], active: 0 };
}

/**
 * A press that works under a finger as under a mouse, for a control that
 * acts on the selection: a tap can clear the selection before its click
 * arrives, so the touch acts at once and the mouse press that follows it
 * is let go.
 */
export function press(act: () => void): { onMouseDown(e: { preventDefault(): void }): void; onTouchStart(): void } {
  return {
    onTouchStart() { touched = Date.now(); act(); },
    onMouseDown(e) {
      e.preventDefault();
      if (Date.now() - touched < TOUCH_MOUSE_MS) return;
      act();
    },
  };
}

/** When a finger last pressed such a control; the mouse events a tap sends after itself come within this. */
let touched = 0;
const TOUCH_MOUSE_MS = 800;
