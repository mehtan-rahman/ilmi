// The vaults opened before, kept outside any vault, and what the app does
// with them on start. Pure; the store loads and saves the list, vault.ts
// probes the folders and opens one, Welcome.tsx shows the rows.

import { baseOf } from '../vault/index.js';
import { agoLabel } from './items.js';

/** One vault opened before: its directory, the name shown, and when (an ISO instant). */
export interface Recent {
  path: string;
  name: string;
  opened: string;
}

/** How many the list keeps. */
export const RECENTS_MAX = 8;

/** The name a vault shows: its directory's last segment. */
export const vaultName = (path: string): string => baseOf(path.replace(/\/+$/, '')) || path;

/** `path` moved to the top with `now` as its time; the rest in order, one entry per path, the oldest beyond the cap dropped. */
export function addRecent(list: Recent[], path: string, now: Date): Recent[] {
  const entry: Recent = { path, name: vaultName(path), opened: now.toISOString() };
  return [entry, ...list.filter((r) => r.path !== path)].slice(0, RECENTS_MAX);
}

export function forgetRecent(list: Recent[], path: string): Recent[] {
  return list.filter((r) => r.path !== path);
}

/** What storage held, as a list: only well-formed rows, newest first, one per path, capped. */
export function cleanRecents(raw: unknown): Recent[] {
  if (!Array.isArray(raw)) return [];
  const out: Recent[] = [];
  const seen = new Set<string>();
  for (const r of raw as unknown[]) {
    if (!r || typeof r !== 'object') continue;
    const { path, name, opened } = r as Partial<Recent>;
    if (typeof path !== 'string' || !path || typeof opened !== 'string' || Number.isNaN(Date.parse(opened))) continue;
    if (seen.has(path)) continue;
    seen.add(path);
    out.push({ path, name: typeof name === 'string' && name ? name : vaultName(path), opened });
  }
  out.sort((a, b) => Date.parse(b.opened) - Date.parse(a.opened));
  return out.slice(0, RECENTS_MAX);
}

/** The row's note: `opened today`, `opened yesterday`, `opened 3d ago`, in the queue's words. */
export function openedLabel(opened: string, now: Date): string {
  return `opened ${agoLabel(opened, now)}`;
}

/** What a vault whose folder is gone reads on its row. */
export const GONE = 'not where it was';

export type Start = { kind: 'reopen'; path: string } | { kind: 'welcome' };

/**
 * What happens on start: the newest vault reopens when the toggle is on and
 * its folder is still there (`present` holds the paths that were found);
 * otherwise the welcome shows.
 */
export function decideStart(list: Recent[], reopen: boolean, present: ReadonlySet<string>): Start {
  const top = list[0];
  if (reopen && top && present.has(top.path)) return { kind: 'reopen', path: top.path };
  return { kind: 'welcome' };
}
