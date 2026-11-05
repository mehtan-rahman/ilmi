// The File menu's dispatch: an item's id to the handler, with the pickers
// and the vault stubbed; the palette's three commands take the same path.

import { describe, expect, it } from 'vitest';
import { MENU_ID, menuAction, recentRows, runMenu, type MenuFx } from '../menu.js';

/** Stubs that record what was reached for. */
function fx() {
  const calls: string[] = [];
  const f: MenuFx = {
    importVault: async () => { calls.push('importVault'); return null; },
    nameNewVault: () => { calls.push('nameNewVault'); },
    closeVault: () => { calls.push('closeVault'); },
    openVault: async (path) => { calls.push(`openVault ${path}`); return null; },
    importFiles: async () => { calls.push('importFiles'); return []; },
  };
  return { f, calls };
}

describe('the menu ids', () => {
  it('read as the File menu\'s items, a recent vault by its path', () => {
    expect(menuAction('new')).toEqual({ kind: 'new' });
    expect(menuAction('open')).toEqual({ kind: 'open' });
    expect(menuAction('close')).toEqual({ kind: 'close' });
    expect(menuAction('import')).toEqual({ kind: 'import' });
    expect(menuAction('recent:/home/me/notes')).toEqual({ kind: 'recent', path: '/home/me/notes' });
    expect(menuAction('recent:/with:colon/x')).toEqual({ kind: 'recent', path: '/with:colon/x' });
    expect(menuAction('recent:')).toBeNull();
    expect(menuAction('recent')).toBeNull();
    expect(menuAction('')).toBeNull();
    expect(menuAction('quit')).toBeNull();
    expect(MENU_ID).toEqual({ new: 'new', open: 'open', close: 'close', recent: 'recent', import: 'import' });
  });
});

describe('the dispatch', () => {
  it('Open runs the folder picker, which imports the folder as a collection and opens it itself', async () => {
    const { f, calls } = fx();
    expect(await runMenu('open', f)).toEqual({ kind: 'open' });
    expect(calls).toEqual(['importVault']);
  });

  it('New closes the open collection for the welcome to take the name', async () => {
    const { f, calls } = fx();
    expect(await runMenu('new', f)).toEqual({ kind: 'new' });
    expect(calls).toEqual(['closeVault', 'nameNewVault']);
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

  it('Import… runs the file picker, the files landing as a drop does', async () => {
    const { f, calls } = fx();
    expect(await runMenu('import', f)).toEqual({ kind: 'import' });
    expect(calls).toEqual(['importFiles']);
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

  it('leaves the open collection out of Open Recent', () => {
    const list = [
      { path: '/home/me/papers', name: 'papers', opened: '2026-10-18T13:00:00.000Z' },
      { path: '/home/me/notes', name: 'notes', opened: '2026-10-18T12:00:00.000Z' },
    ];
    expect(recentRows(list, '/home/me/papers')).toEqual([{ path: '/home/me/notes', name: 'notes' }]);
  });
});
