// The native File menu's other half: what each item does once its id arrives
// from the Rust side (`src-tauri/src/lib.rs` builds the menu and emits every
// item's id as one `menu` event), and the Open Recent submenu kept in step
// with the recents. `menuAction` is pure; `runMenu` does it with the pickers
// and the vault, so a test can hand it stubs and the palette can share it.

import { invoke } from '@tauri-apps/api/core';
import { listen } from '@tauri-apps/api/event';
import { importFiles } from './land.js';
import type { Recent } from './recents.js';
import { useApp } from './store.js';
import { closeVault, openVault, pickVault, pickVaultParent } from './vault.js';

/** The ids the Rust side gives the File menu's items; a recent vault is `recent:<path>`. */
export const MENU_ID = { new: 'new', open: 'open', close: 'close', recent: 'recent', import: 'import' } as const;

export type MenuAction = { kind: 'new' } | { kind: 'open' } | { kind: 'close' } | { kind: 'import' } | { kind: 'recent'; path: string } | null;

/** What a menu item's id asks for; null for an id that is not the File menu's. */
export function menuAction(id: string): MenuAction {
  if (id === MENU_ID.new) return { kind: 'new' };
  if (id === MENU_ID.open) return { kind: 'open' };
  if (id === MENU_ID.close) return { kind: 'close' };
  if (id === MENU_ID.import) return { kind: 'import' };
  const prefix = `${MENU_ID.recent}:`;
  if (id.startsWith(prefix) && id.length > prefix.length) return { kind: 'recent', path: id.slice(prefix.length) };
  return null;
}

/** What `runMenu` reaches for; the real ones unless a test hands in others. */
export interface MenuFx {
  pickVault(): Promise<unknown>;
  pickVaultParent(): Promise<string | null>;
  closeVault(): void;
  openVault(path: string): Promise<unknown>;
  /** File → Import…: the picker, each file landing in the active tab's folder (`land.ts`). */
  importFiles(): Promise<unknown>;
}

const real: MenuFx = { pickVault, pickVaultParent, closeVault, openVault, importFiles: () => importFiles() };

/**
 * Do what one item asks. Open: the folder picker, then the vault. New: the
 * parent picker first, so a dismissed dialog leaves the vault open; then the
 * open vault closes with its tabs and the welcome takes the name. Close: to
 * the welcome. Recent: that vault. Import: the file picker, the files
 * landing as a drop does. Resolves to the action taken, or null.
 */
export async function runMenu(id: string, fx: MenuFx = real): Promise<MenuAction> {
  const a = menuAction(id);
  if (!a) return null;
  switch (a.kind) {
    case 'open': await fx.pickVault(); break;
    case 'new': { const dir = await fx.pickVaultParent(); if (dir) fx.closeVault(); break; }
    case 'close': fx.closeVault(); break;
    case 'recent': await fx.openVault(a.path); break;
    case 'import': await fx.importFiles(); break;
  }
  return a;
}

/** The Open Recent submenu's rows, newest first, as the Rust side takes them. */
export const recentRows = (recents: Recent[]): { path: string; name: string }[] => recents.map((r) => ({ path: r.path, name: r.name }));

/** Rebuild File → Open Recent from the recents. Nothing to rebuild outside Tauri. */
export function syncRecentMenu(recents: Recent[]): void {
  try {
    invoke('set_recent_vaults', { items: recentRows(recents) }).catch(() => { /* not under Tauri */ });
  } catch { /* not under Tauri */ }
}

let listening = false;

/**
 * Listen for the menu's items, once for the app's life, and keep Open Recent
 * in step with the recents from the first moment on. Outside Tauri there is
 * no menu and this is a no-op.
 */
export function listenForMenu(): void {
  if (listening) return;
  listening = true;
  try {
    listen<string>('menu', (e) => { void runMenu(e.payload).catch(console.error); }).catch(() => { /* not under Tauri */ });
  } catch { /* not under Tauri */ }
  syncRecentMenu(useApp.getState().recents);
  useApp.subscribe((s, prev) => { if (s.recents !== prev.recents) syncRecentMenu(s.recents); });
}
