import { afterEach, describe, expect, it, vi } from 'vitest';
import { emptyPanes, openTab, splitPane } from '../panes.js';
import { DESKTOP, NEVER, clonedVaults, cloneDest, documentsDir, isMobile, nameFromRemote, onePane, press, setPlatform, shapeOf, vaultKey } from '../platform.js';
import type { Recent } from '../recents.js';

const DOCS = '/var/mobile/Containers/Data/Application/AAAA-1111/Documents';

afterEach(() => setPlatform(DESKTOP));

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

describe('a vault on iOS', () => {
  it('is known by its place in Documents, since the container moves between installs', () => {
    expect(vaultKey(`${DOCS}/double-major`, DOCS)).toBe('documents:double-major');
    expect(vaultKey('/var/mobile/Containers/Data/Application/BBBB-2222/Documents/double-major/', '/var/mobile/Containers/Data/Application/BBBB-2222/Documents')).toBe('documents:double-major');
    // the desktop keeps the path, and so does anything outside Documents
    expect(vaultKey('/Users/me/notes/', null)).toBe('/Users/me/notes');
    expect(vaultKey('/elsewhere/notes', DOCS)).toBe('/elsewhere/notes');
    setPlatform({ mobile: true, documents: DOCS });
    expect(vaultKey(`${DOCS}/notes`)).toBe('documents:notes');
  });

  it('is cloned under the name its remote ends in', () => {
    expect(nameFromRemote('https://github.com/me/notes.git')).toBe('notes');
    expect(nameFromRemote('https://github.com/me/notes/')).toBe('notes');
    expect(nameFromRemote('git@example.org:me/study vault.git')).toBe('study vault');
    expect(nameFromRemote('/tmp/check/double-major.git')).toBe('double-major');
    expect(nameFromRemote('https://host/x/y.git?ref=main')).toBe('y');
    expect(nameFromRemote('  ')).toBe('collection');
    expect(nameFromRemote('https://host/..')).toBe('collection');
    expect(cloneDest(`${DOCS}/`, 'https://github.com/me/notes.git')).toBe(`${DOCS}/notes`);
  });

  it('lists the vaults in Documents at the paths they have now, the last opened first', () => {
    const recents: Recent[] = [
      // remembered under a container that is gone
      { path: '/var/mobile/Containers/Data/Application/OLD-0000/Documents/physics', name: 'physics', opened: '2026-11-03T10:00:00.000Z' },
      { path: `${DOCS}/arabic`, name: 'arabic', opened: '2026-11-04T09:00:00.000Z' },
      { path: `${DOCS}/deleted`, name: 'deleted', opened: '2026-11-04T12:00:00.000Z' },
    ];
    const rows = clonedVaults(DOCS, ['arabic', 'new-one', 'physics', 'another'], recents);
    expect(rows.map((r) => r.name)).toEqual(['arabic', 'physics', 'another', 'new-one']);
    expect(rows.map((r) => r.path)).toEqual([`${DOCS}/arabic`, `${DOCS}/physics`, `${DOCS}/another`, `${DOCS}/new-one`]);
    expect(rows[0]!.opened).toBe('2026-11-04T09:00:00.000Z');
    expect(rows[2]!.opened).toBe(NEVER);
    expect(clonedVaults(DOCS, [], recents)).toEqual([]);
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
