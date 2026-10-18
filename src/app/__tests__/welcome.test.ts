import { describe, expect, it } from 'vitest';
import { parse } from '../../format/index.js';
import { ENTRY_GLYPH, buildIndex } from '../chrome.js';
import { agoLabel } from '../items.js';
import { GONE, RECENTS_MAX, addRecent, cleanRecents, decideStart, forgetRecent, openedLabel, vaultName, type Recent } from '../recents.js';
import { STARTER_TEXT, STARTER_TITLE } from '../starter.js';

const at = (iso: string) => new Date(iso);
const NOW = at('2026-10-18T12:00:00Z');

describe('recents', () => {
  it('adds the newest first, named for its directory', () => {
    const list = addRecent([], '/home/me/notes', NOW);
    expect(list).toEqual([{ path: '/home/me/notes', name: 'notes', opened: NOW.toISOString() }]);
    const next = addRecent(list, '/home/me/papers', at('2026-10-18T13:00:00Z'));
    expect(next.map((r) => r.name)).toEqual(['papers', 'notes']);
  });

  it('de-duplicates by path, moving the vault to the top with the new time', () => {
    let list = addRecent([], '/a', at('2026-10-01T00:00:00Z'));
    list = addRecent(list, '/b', at('2026-10-02T00:00:00Z'));
    list = addRecent(list, '/a', at('2026-10-03T00:00:00Z'));
    expect(list.map((r) => r.path)).toEqual(['/a', '/b']);
    expect(list[0]!.opened).toBe('2026-10-03T00:00:00.000Z');
  });

  it('keeps eight at most, dropping the oldest', () => {
    let list: Recent[] = [];
    for (let i = 0; i < 12; i++) list = addRecent(list, `/v${i}`, at(`2026-10-${String(i + 1).padStart(2, '0')}T00:00:00Z`));
    expect(list).toHaveLength(RECENTS_MAX);
    expect(list[0]!.path).toBe('/v11');
    expect(list[RECENTS_MAX - 1]!.path).toBe('/v4');
  });

  it('removes one by path and leaves the rest in order', () => {
    let list = addRecent([], '/a', at('2026-10-01T00:00:00Z'));
    list = addRecent(list, '/b', at('2026-10-02T00:00:00Z'));
    list = addRecent(list, '/c', at('2026-10-03T00:00:00Z'));
    expect(forgetRecent(list, '/b').map((r) => r.path)).toEqual(['/c', '/a']);
    expect(forgetRecent(list, '/nowhere')).toEqual(list);
  });

  it('cleans what storage held: bad rows out, newest first, one per path, capped', () => {
    const raw = [
      { path: '/old', name: 'old', opened: '2026-09-01T00:00:00Z' },
      { path: '/new', opened: '2026-10-01T00:00:00Z' },
      { path: '/old', name: 'old again', opened: '2026-08-01T00:00:00Z' },
      { path: '', name: 'blank', opened: '2026-10-01T00:00:00Z' },
      { path: '/bad-date', name: 'x', opened: 'yesterday' },
      'junk',
      null,
    ];
    const list = cleanRecents(raw);
    expect(list.map((r) => r.path)).toEqual(['/new', '/old']);
    expect(list[0]!.name).toBe('new');
    expect(cleanRecents('nope')).toEqual([]);
    expect(cleanRecents(Array.from({ length: 20 }, (_, i) => ({ path: `/v${i}`, name: 'v', opened: `2026-01-${String(i + 1).padStart(2, '0')}T00:00:00Z` })))).toHaveLength(RECENTS_MAX);
  });

  it('names a vault for its directory, a trailing slash ignored', () => {
    expect(vaultName('/home/me/notes/')).toBe('notes');
    expect(vaultName('/notes')).toBe('notes');
  });
});

describe('the opened words', () => {
  it('reads as the queue does, looking back', () => {
    expect(agoLabel('2026-10-18T09:00:00Z', NOW)).toBe('today');
    expect(agoLabel('2026-10-17T23:00:00Z', NOW)).toBe('yesterday');
    expect(agoLabel('2026-10-15T12:00:00Z', NOW)).toBe('3d ago');
    expect(agoLabel('2026-08-18T12:00:00Z', NOW)).toBe('2mo ago');
    expect(agoLabel('2024-10-18T12:00:00Z', NOW)).toBe('2y ago');
    expect(openedLabel('2026-10-18T09:00:00Z', NOW)).toBe('opened today');
    expect(openedLabel('2026-10-15T12:00:00Z', NOW)).toBe('opened 3d ago');
  });

  it('has a word for a folder that is gone', () => {
    expect(GONE).toBe('not where it was');
  });
});

describe('the start decision', () => {
  const list: Recent[] = [
    { path: '/newest', name: 'newest', opened: '2026-10-18T00:00:00Z' },
    { path: '/older', name: 'older', opened: '2026-10-17T00:00:00Z' },
  ];

  it('reopens the newest when the toggle is on and its folder is there', () => {
    expect(decideStart(list, true, new Set(['/newest', '/older']))).toEqual({ kind: 'reopen', path: '/newest' });
  });

  it('shows the welcome when the toggle is off', () => {
    expect(decideStart(list, false, new Set(['/newest', '/older']))).toEqual({ kind: 'welcome' });
  });

  it('shows the welcome when the newest folder is gone, even with another present', () => {
    expect(decideStart(list, true, new Set(['/older']))).toEqual({ kind: 'welcome' });
  });

  it('shows the welcome with nothing remembered', () => {
    expect(decideStart([], true, new Set())).toEqual({ kind: 'welcome' });
  });
});

describe('the starter', () => {
  it('parses clean with one card, a q&a', () => {
    const { doc, diagnostics } = parse(STARTER_TEXT);
    expect(diagnostics).toEqual([]);
    const cards = doc.blocks.filter((b) => b.kind === 'card');
    expect(cards).toHaveLength(1);
    expect(cards[0]!.text).toContain(' :: ');
    expect(doc.blocks.filter((b) => b.kind === 'heading').map((b) => b.text)).toEqual(['reading', 'cards', 'writing']);
    expect(STARTER_TITLE).toBe('start here');
  });
});

describe('the palette and the other vaults', () => {
  it('lists recents under vaults, after the commands, with their own glyph', () => {
    const index = buildIndex([], {}, [], [{ id: 'close-vault', title: 'close vault' }], [{ path: '/home/me/notes', name: 'notes' }]);
    const v = index.find((e) => e.tag === 'vault');
    expect(v).toEqual({ key: 'v:/home/me/notes', title: 'notes', sub: 'vaults', tag: 'vault', target: { vault: '/home/me/notes' } });
    expect(index.indexOf(v!)).toBeGreaterThan(index.findIndex((e) => e.tag === 'command'));
    expect(ENTRY_GLYPH.vault).toBeTruthy();
  });
});
