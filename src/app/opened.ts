// A file handed to ilmi by the system: `open in ilmi` on a share sheet or a
// long press in Files (an iPad, an iPhone), a file dropped on the dock icon
// or `open with` (a Mac). The bundle says which kinds it takes
// (`Info.ios.plist`, `fileAssociations` in `tauri.conf.json`: what the
// intake takes); the system starts or wakes the app and gives the file's
// `file://` address, which arrives where an `ilmi://` link does
// (`clipper.ts`). The file then goes where a dropped or picked file goes
// (`landFiles`): it lands in the folder in front with the intake's
// defaults, opens, and a notice says where, with its undo; one that needs
// a choice waits on the intake. With no collection open it is kept, the
// welcome says so (`useOpenedWaiting`), and it lands when one opens.
//
// On a device the system hands over a copy, in the app's own `Inbox`
// (`LSSupportsOpeningDocumentsInPlace` is off): once the collection has the
// file that copy is forgotten (`inbox_forget`, which removes nothing but a
// file of that folder); a copy never taken in is swept a day on
// (`inbox_sweep`).

import { invoke } from '@tauri-apps/api/core';
import { fileName } from './fetch.js';
import { useSyncExternalStore } from 'react';
import { activeDir, landFiles, type Landed } from './land.js';
import { useApp } from './store.js';
import { vaultSettled } from './vault.js';

/** Whether what the system opened the app with is a file (not an `ilmi://` link). */
export const isFileUrl = (uri: string): boolean => /^file:\/\//i.test(uri.trim());

/** What taking a file in reaches for; the real ones unless a test hands in others. */
export interface OpenedFx {
  /** Whether a collection is open, its opening over (`vaultSettled`). */
  ready(): boolean;
  /** The folder in front. */
  dir(): string;
  land(paths: string[], dir: string): Promise<Landed[]>;
  /** The system's copy is no longer needed. */
  forget(path: string): Promise<unknown>;
}

const realFx: OpenedFx = {
  ready: vaultSettled,
  dir: activeDir,
  land: (paths, dir) => landFiles(paths, dir),
  forget: (path) => invoke('inbox_forget', { path }),
};

/** The words for files kept until a collection is open. */
export const waitingLine = (names: string[]): string =>
  names.length === 1 ? `${names[0]} is kept: it comes in once a collection is open` : `${names.length} files are kept: they come in once a collection is open`;

/** The files that came before any collection was open, in the order they came. */
let waiting: readonly string[] = [];
const watchers = new Set<() => void>();
const setWaiting = (next: readonly string[]): void => { waiting = next; for (const w of watchers) w(); };
const watch = (fn: () => void): (() => void) => { watchers.add(fn); return () => { watchers.delete(fn); }; };
/** One file after another: two shared at once land in their order. */
let line: Promise<void> = Promise.resolve();

export const openedWaiting = (): readonly string[] => waiting;

/** The welcome's line for the files kept until a collection is open; null when there are none. */
export function useOpenedWaiting(): string | null {
  const held = useSyncExternalStore(watch, openedWaiting);
  return held.length ? waitingLine(held.map(fileName)) : null;
}

async function take(uri: string, fx: OpenedFx): Promise<void> {
  const path = uri.trim();
  if (!fx.ready()) {
    if (!waiting.includes(path)) setWaiting([...waiting, path]);
    return;
  }
  // (a file that cannot be read is a notice of `landFiles`' own; one that needs a choice waits on the intake, which
  // reads it again: neither is forgotten here)
  const landed = await fx.land([path], fx.dir());
  if (landed.length) await Promise.resolve(fx.forget(path)).catch(() => { /* the sweep has it */ });
}

/**
 * Take in one file the system opened the app with. Resolves once it has landed, been refused with a notice, or been
 * kept for the collection to come; never rejects.
 */
export function takeOpened(uri: string, fx: OpenedFx = realFx): Promise<void> {
  line = line.then(() => take(uri, fx)).catch((e: unknown) => { console.error(e); });
  // (one that came while a collection was still opening: it is kept, and lands when the opening is over)
  if (fx === realFx) void line.then(arm);
  return line;
}

/** A collection is open now: what was kept for it comes in. */
export function takeWaiting(fx: OpenedFx = realFx): Promise<void> {
  if (!fx.ready() || !waiting.length) return line;
  const held = waiting;
  setWaiting([]);
  for (const p of held) void takeOpened(p, fx);
  return line;
}

/** For the tests: nothing kept. */
export function resetOpened(): void {
  setWaiting([]);
  line = Promise.resolve();
}

/** How long a collection's opening is waited for, ms. */
const SETTLE_MS = 60000;

let poll: ReturnType<typeof setInterval> | null = null;
/**
 * What is kept lands once the collection in the store has finished opening (the store has it before its tree, its
 * documents and its tabs are back). Nothing to wait for while no collection is in the store: one coming arms this.
 */
function arm(): void {
  if (poll || !waiting.length || !useApp.getState().vault) return;
  const t0 = Date.now();
  poll = setInterval(() => {
    const over = Date.now() - t0 > SETTLE_MS || !useApp.getState().vault;
    if (!vaultSettled() && !over) return;
    if (poll) clearInterval(poll);
    poll = null;
    if (vaultSettled()) void takeWaiting();
  }, 150);
}

let watching = false;
/** From now on a collection opening takes in what was kept for it, and the copies never taken in are swept. */
export function watchOpened(): void {
  if (watching) return;
  watching = true;
  invoke('inbox_sweep').catch(() => { /* not under Tauri */ });
  useApp.subscribe((s, prev) => {
    if (s.vault && s.vault !== prev.vault) arm();
  });
}
