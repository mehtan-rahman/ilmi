import { afterEach, describe, expect, it, vi } from 'vitest';
import { emptyPanes, openTab, splitPane } from '../panes.js';
import { DESKTOP, NEVER, collectionRows, collectionsHome, documentsDir, isMobile, nameFromRemote, onePane, press, setCollectionsHome, setPlatform, shapeOf, vaultKey } from '../platform.js';
import type { Recent } from '../recents.js';

const DOCS = '/var/mobile/Containers/Data/Application/AAAA-1111/Documents';
// where the collections are: under the app's data directory, which moves between installs as Documents does
const HOME = '/var/mobile/Containers/Data/Application/AAAA-1111/Library/Application Support/dev.ilmi.app/collections';

afterEach(() => { setPlatform(DESKTOP); setCollectionsHome(null); });

describe('the platform', () => {
  it('is the desktop until told otherwise', () => {
    expect(isMobile()).toBe(false);
    expect(documentsDir()).toBeNull();
    setPlatform({ mobile: true, documents: `${DOCS}/` });
    expect(isMobile()).toBe(true);
    expect(documentsDir()).toBe(DOCS);
  });

  it('gives the shell a shape: the Mac at any size, an iPad by which way it is held', () => {
    expect(shapeOf(false, 800, 1200)).toBe('desktop');
    expect(shapeOf(true, 1180, 820)).toBe('landscape');
    expect(shapeOf(true, 820, 1180)).toBe('portrait');
    // half the screen in landscape is taller than wide: the sheet again
    expect(shapeOf(true, 590, 820)).toBe('portrait');
  });
});

describe('a collection', () => {
  it('is known by its name among the collections, since the container moves between installs', () => {
    expect(vaultKey(`${HOME}/double-major`, HOME)).toBe('collection:double-major');
    expect(vaultKey('/var/mobile/Containers/Data/Application/BBBB-2222/Library/Application Support/dev.ilmi.app/collections/double-major/', '/var/mobile/Containers/Data/Application/BBBB-2222/Library/Application Support/dev.ilmi.app/collections')).toBe('collection:double-major');
    // a path elsewhere is itself, and so is any path before the collections' place is known
    expect(vaultKey('/Users/me/notes/', null)).toBe('/Users/me/notes');
    expect(vaultKey('/elsewhere/notes', HOME)).toBe('/elsewhere/notes');
    expect(collectionsHome()).toBeNull();
    setCollectionsHome(`${HOME}/`);
    expect(collectionsHome()).toBe(HOME);
    expect(vaultKey(`${HOME}/notes`)).toBe('collection:notes');
  });

  it('is cloned under the name its remote ends in', () => {
    expect(nameFromRemote('https://github.com/me/notes.git')).toBe('notes');
    expect(nameFromRemote('https://github.com/me/notes/')).toBe('notes');
    expect(nameFromRemote('git@example.org:me/study vault.git')).toBe('study vault');
    expect(nameFromRemote('/tmp/check/double-major.git')).toBe('double-major');
    expect(nameFromRemote('https://host/x/y.git?ref=main')).toBe('y');
    expect(nameFromRemote('  ')).toBe('collection');
    expect(nameFromRemote('https://host/..')).toBe('collection');
  });

  it('is listed at the path it has now, the last opened first', () => {
    const recents: Recent[] = [
      // remembered under a container that is gone
      { path: '/var/mobile/Containers/Data/Application/OLD-0000/Library/Application Support/dev.ilmi.app/collections/physics', name: 'physics', opened: '2026-11-03T10:00:00.000Z' },
      { path: `${HOME}/arabic`, name: 'arabic', opened: '2026-11-04T09:00:00.000Z' },
      { path: `${HOME}/deleted`, name: 'deleted', opened: '2026-11-04T12:00:00.000Z' },
      // a folder opened as a vault before milestone 59: not a collection, not listed
      { path: '/Users/me/notes', name: 'notes', opened: '2026-11-04T13:00:00.000Z' },
    ];
    const rows = collectionRows(HOME, ['arabic', 'new-one', 'physics', 'another'], recents);
    expect(rows.map((r) => r.name)).toEqual(['arabic', 'physics', 'another', 'new-one']);
    expect(rows.map((r) => r.path)).toEqual([`${HOME}/arabic`, `${HOME}/physics`, `${HOME}/another`, `${HOME}/new-one`]);
    expect(rows[0]!.opened).toBe('2026-11-04T09:00:00.000Z');
    expect(rows[2]!.opened).toBe(NEVER);
    expect(collectionRows(HOME, [], recents)).toEqual([]);
  });
});

describe('one pane', () => {
  it('folds a split back into the first pane, the tab in front kept in front', () => {
    let p = openTab(emptyPanes(), 'a.md');
    p = openTab(p, 'b.md', { newTab: true });
    expect(onePane(p)).toBe(p);
    p = splitPane(p, 0);
    p = openTab(p, 'c.md');
    expect(p.panes).toHaveLength(2);
    const one = onePane(p);
    expect(one.panes).toHaveLength(1);
    expect(one.active).toBe(0);
    expect(one.panes[0]!.tabs.map((t) => t.id)).toEqual(['a.md', 'b.md', 'c.md']);
    expect(one.panes[0]!.tabs[one.panes[0]!.active]!.id).toBe('c.md');
  });

  it('keeps a split made with nothing in it from losing the tab in front', () => {
    let p = openTab(emptyPanes(), 'a.md');
    p = splitPane(p, 0);
    const one = onePane(p);
    expect(one.panes[0]!.tabs.map((t) => t.id)).toEqual(['a.md']);
    expect(one.panes[0]!.active).toBe(0);
  });
});

describe('a press under a finger or a mouse', () => {
  it('acts once for a tap, whose mouse press follows the touch', () => {
    vi.useFakeTimers();
    try {
      const act = vi.fn();
      const prevent = vi.fn();
      // a re-render between the two hands out new handlers: the touch is still remembered
      press(act).onTouchStart();
      press(act).onMouseDown({ preventDefault: prevent });
      expect(act).toHaveBeenCalledTimes(1);
      expect(prevent).toHaveBeenCalledTimes(1);
      // a mouse on its own, later
      vi.advanceTimersByTime(2000);
      press(act).onMouseDown({ preventDefault: prevent });
      expect(act).toHaveBeenCalledTimes(2);
    } finally {
      vi.useRealTimers();
    }
  });
});
