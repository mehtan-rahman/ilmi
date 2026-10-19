// The File menu's dispatch: an item's id to the handler, with the pickers
// and the vault stubbed; the palette's three commands take the same path.

import { describe, expect, it } from 'vitest';
import { MENU_ID, menuAction, recentRows, runMenu, type MenuFx } from '../menu.js';

/** Stubs that record what was reached for; the parent picker answers `dir`. */
function fx(dir: string | null = '/home/me') {
  const calls: string[] = [];
  const f: MenuFx = {
    pickVault: async () => { calls.push('pickVault'); return null; },
    pickVaultParent: async () => { calls.push('pickVaultParent'); return dir; },
    closeVault: () => { calls.push('closeVault'); },
    openVault: async (path) => { calls.push(`openVault ${path}`); return null; },
  };
  return { f, calls };
}

describe('the menu ids', () => {
  it('read as the File menu\'s items, a recent vault by its path', () => {
    expect(menuAction('new')).toEqual({ kind: 'new' });
    expect(menuAction('open')).toEqual({ kind: 'open' });
    expect(menuAction('close')).toEqual({ kind: 'close' });
    expect(menuAction('recent:/home/me/notes')).toEqual({ kind: 'recent', path: '/home/me/notes' });
    expect(menuAction('recent:/with:colon/x')).toEqual({ kind: 'recent', path: '/with:colon/x' });
    expect(menuAction('recent:')).toBeNull();
    expect(menuAction('recent')).toBeNull();
    expect(menuAction('')).toBeNull();
    expect(menuAction('quit')).toBeNull();
    expect(MENU_ID).toEqual({ new: 'new', open: 'open', close: 'close', recent: 'recent' });
  });
});

describe('the dispatch', () => {
  it('Open runs the folder picker, which opens the vault itself', async () => {
    const { f, calls } = fx();
    expect(await runMenu('open', f)).toEqual({ kind: 'open' });
    expect(calls).toEqual(['pickVault']);
  });

  it('New picks the parent first, then closes the open vault for the welcome to take the name', async () => {
    const { f, calls } = fx('/home/me/vaults');
    expect(await runMenu('new', f)).toEqual({ kind: 'new' });
    expect(calls).toEqual(['pickVaultParent', 'closeVault']);
  });

  it('a dismissed parent picker leaves the vault open', async () => {
    const { f, calls } = fx(null);
    await runMenu('new', f);
    expect(calls).toEqual(['pickVaultParent']);
  });

  it('Close closes to the welcome', async () => {
    const { f, calls } = fx();
    expect(await runMenu('close', f)).toEqual({ kind: 'close' });
    expect(calls).toEqual(['closeVault']);
  });

  it('a recent opens that vault', async () => {
    const { f, calls } = fx();
    expect(await runMenu('recent:/home/me/notes', f)).toEqual({ kind: 'recent', path: '/home/me/notes' });
    expect(calls).toEqual(['openVault /home/me/notes']);
  });

  it('an id that is not the File menu\'s does nothing', async () => {
    const { f, calls } = fx();
    expect(await runMenu('quit', f)).toBeNull();
    expect(await runMenu('recent:', f)).toBeNull();
    expect(calls).toEqual([]);
  });

  it('hands the Rust side the recents as rows, newest first, by name', () => {
    expect(recentRows([
      { path: '/home/me/papers', name: 'papers', opened: '2026-10-18T13:00:00.000Z' },
      { path: '/home/me/notes', name: 'notes', opened: '2026-10-18T12:00:00.000Z' },
    ])).toEqual([{ path: '/home/me/papers', name: 'papers' }, { path: '/home/me/notes', name: 'notes' }]);
    expect(recentRows([])).toEqual([]);
  });
});
