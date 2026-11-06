// Copies kept outside the database (milestone 60), both made by the same
// export a person asks for (`collections.ts`), so each is a vault as
// FORMAT.md describes it.
//
// The mirror: a folder kept up to date one way, for reading by other tools
// (Tweaks › mirror, off by default, the desktop's). It is a folder of the
// collection's name inside the one picked, never one that was there before
// and is not a mirror. What the mirror wrote is listed in `.ilmi-mirror.json`
// there, each file with the stamp it was written at: a pass
// (`vault/transfer.ts`, `mirrorPass`) writes what has changed since and
// removes what the collection no longer has, and touches nothing it did
// not write. Nothing is read back from it.
//
// The dated exports: `<collection>/exports/<day>.zip`, the collection as
// `export collection · zip` writes it but for its PDFs and images, made
// once a day when the collection opens or the day turns, the last seven
// kept. One file holds every document now; these are what is left if it is
// damaged. The PDFs and images are not in that file: each is a file of its
// own under `<collection>/blobs/`, named by its SHA-256 and never
// rewritten, so a zip does not hold them again (milestone 63; seven copies
// of every book, and on a device that keeps only what it has opened a
// fetch of every one, each day). The zip's `.ilmi/blobs.json` says which
// path is which file.

import { invoke } from '@tauri-apps/api/core';
import { open as pickDirectory } from '@tauri-apps/plugin-dialog';
import { dayOf } from '../schedule/index.js';
import { join, mirrorDirIn, mirrorPass, type StoreFs, type Vault } from '../vault/index.js';
import { tauriFs } from '../vault/tauri-fs.js';
import { appNow } from './clock.js';
import { diskFs, exportToZip } from './collections.js';
import { vaultKey } from './platform.js';
import { vaultName } from './recents.js';
import { useApp } from './store.js';

// ── the mirror ───────────────────────────────────────────────────

const MIRROR_KEY = 'ilmi.mirror';
/** How long after a write the mirror follows. */
export const MIRROR_AFTER_MS = 2_000;

function loadMirrors(): Record<string, string> {
  try {
    const raw = globalThis.localStorage?.getItem(MIRROR_KEY);
    const o: unknown = raw ? JSON.parse(raw) : {};
    const out: Record<string, string> = {};
    if (o && typeof o === 'object') for (const [k, v] of Object.entries(o as Record<string, unknown>)) if (typeof v === 'string' && v) out[k] = v;
    return out;
  } catch {
    return {};
  }
}

/** The folder the collection at `root` is mirrored to; empty, none. */
export const mirrorOf = (root: string): string => loadMirrors()[vaultKey(root)] ?? '';

function saveMirror(root: string, dir: string): void {
  const all = loadMirrors();
  if (dir) all[vaultKey(root)] = dir; else delete all[vaultKey(root)];
  try { globalThis.localStorage?.setItem(MIRROR_KEY, JSON.stringify(all)); } catch { /* the session keeps it */ }
  if (useApp.getState().vault === root) useApp.setState({ mirror: dir });
}

let mirrored: { vault: Vault; dir: string; unwatch: (() => void) | null } | null = null;
let mirrorTimer: ReturnType<typeof setTimeout> | null = null;
let mirrorRun: Promise<unknown> = Promise.resolve();

/** A pass now, after any one under way; a failure is said once in the console and the next write tries again. */
export function mirrorNow(): Promise<string[]> {
  const m = mirrored;
  if (!m) return Promise.resolve([]);
  const run = mirrorRun.then(async () => {
    if (mirrored !== m) return [];
    await invoke('allow_vault', { path: m.dir });
    // a file that is not on this device is not fetched for the mirror: it is written there when it comes
    const fs = m.vault.fs as Partial<StoreFs>;
    return mirrorPass(m.vault.fs, m.vault.root, diskFs, m.dir, fs.isAway ? (path) => fs.isAway!(join(m.vault.root, path)) : undefined);
  });
  mirrorRun = run.catch((e: unknown) => console.error('mirror', e));
  return run;
}

function mirrorSoon(): void {
  if (mirrorTimer) clearTimeout(mirrorTimer);
  mirrorTimer = setTimeout(() => { mirrorTimer = null; void mirrorNow().catch(() => { /* said by the run */ }); }, MIRROR_AFTER_MS);
}

/** The collection opened: its mirror, when it has one, brought up to date and kept so. */
export async function startMirror(vault: Vault): Promise<void> {
  stopMirror();
  const dir = mirrorOf(vault.root);
  useApp.setState({ mirror: dir });
  if (!dir) return;
  mirrored = { vault, dir, unwatch: null };
  const m = mirrored;
  m.unwatch = await vault.fs.watch(vault.root, () => { if (mirrored === m) mirrorSoon(); });
  if (mirrored !== m) { m.unwatch(); return; }
  await mirrorNow();
}

export function stopMirror(): void {
  if (mirrorTimer) { clearTimeout(mirrorTimer); mirrorTimer = null; }
  mirrored?.unwatch?.();
  mirrored = null;
  useApp.setState({ mirror: '' });
}

/** Mirror the open collection into `parent` (a folder of its name there, `mirrorDirIn`), from now on. Resolves to the mirror's folder. */
export async function mirrorTo(vault: Vault, parent: string): Promise<string> {
  await invoke('allow_vault', { path: parent });
  const dir = await mirrorDirIn(diskFs, parent, vaultName(vault.root));
  saveMirror(vault.root, dir);
  await startMirror(vault);
  return dir;
}

/** Tweaks › mirror › `choose…`: ask for a folder, and mirror into it. Null when the picker was dismissed. */
export async function chooseMirror(vault: Vault): Promise<string | null> {
  const parent = await pickDirectory({ directory: true, recursive: true, multiple: false });
  return parent ? mirrorTo(vault, parent) : null;
}

/** Tweaks › mirror › `off`: the folder is left as it is, and no longer followed. */
export function mirrorOff(vault: Vault): void {
  saveMirror(vault.root, '');
  stopMirror();
}

// ── the dated exports ────────────────────────────────────────────

/** How many days' exports are kept. */
export const EXPORTS_KEPT = 7;
/** In a dated export: the PDFs and images it leaves out, each path with the SHA-256 its file is kept under in `<collection>/blobs/`. */
export const BLOBS_LIST = '.ilmi/blobs.json';
export const exportsDir = (root: string): string => `${root.replace(/\/+$/, '')}/exports`;

let exporting: Promise<string | null> | null = null;

/**
 * Today's export of the collection, when there is none yet:
 * `<collection>/exports/<day>.zip`, then the oldest beyond `EXPORTS_KEPT`
 * removed. Resolves to the zip written, or null when today's was there.
 */
export function keepDated(vault: Vault, day = dayOf(appNow())): Promise<string | null> {
  exporting ??= (async () => {
    const dir = exportsDir(vault.root);
    await invoke('allow_vault', { path: dir });
    await tauriFs.mkdir(dir);
    const dest = `${dir}/${day}.zip`;
    if (await tauriFs.stat(dest)) return null;
    // written under another name first, so a zip cut short is never taken for a day's
    const part = `${dest}.part`;
    // the PDFs and images are left where they are kept once, and listed
    const fs = vault.fs as Partial<StoreFs>;
    const blobs: Record<string, string> = {};
    const leave = fs.blobAt ? (path: string): boolean => {
      const hash = fs.blobAt!(join(vault.root, path));
      if (hash === null) return false;
      blobs[path] = hash;
      return true;
    } : undefined;
    const also = (): Record<string, string> => (Object.keys(blobs).length ? { [BLOBS_LIST]: `${JSON.stringify(blobs, Object.keys(blobs).sort(), 2)}\n` } : {});
    await exportToZip(vault.fs, vault.root, vaultName(vault.root), part, leave ? { leave, also } : {});
    await tauriFs.rename(part, dest);
    const zips = (await tauriFs.readDir(dir)).map((e) => e.name).filter((n) => /^\d{4}-\d{2}-\d{2}\.zip$/.test(n)).sort();
    for (const old of zips.slice(0, Math.max(0, zips.length - EXPORTS_KEPT))) await tauriFs.remove(`${dir}/${old}`);
    return dest;
  })().finally(() => { exporting = null; });
  return exporting;
}

let datedTimer: ReturnType<typeof setTimeout> | null = null;

/** A little after the collection opens or the day turns, so the open is not slowed by it: today's export, if it is still to make. */
export function keepDatedSoon(vault: Vault, current: () => Vault | null, ms = 20_000): void {
  if (datedTimer) clearTimeout(datedTimer);
  datedTimer = setTimeout(() => {
    datedTimer = null;
    if (current() === vault) void keepDated(vault).catch((e: unknown) => console.error('dated export', e));
  }, ms);
}

export function stopDated(): void {
  if (datedTimer) { clearTimeout(datedTimer); datedTimer = null; }
}
