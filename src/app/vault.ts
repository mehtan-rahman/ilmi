// The one open vault, and how it gets opened. Kept outside the Zustand store
// because a Vault holds a watcher and a cache; the store gets plain data.

import { invoke } from '@tauri-apps/api/core';
import { open as pickDirectory } from '@tauri-apps/plugin-dialog';
import { info } from '@tauri-apps/plugin-log';
import { Vault } from '../vault/index.js';
import { tauriFs } from '../vault/tauri-fs.js';
import { useApp } from './store.js';

let current: Vault | null = null;

export function currentVault(): Vault | null {
  return current;
}

/** Open the directory at `path`, watch it, and publish its document list. */
export async function openVault(path: string): Promise<Vault> {
  current?.close();
  // The dialog widens the fs scope to what it picked; a path from anywhere
  // else (env var, a remembered vault later) is widened here.
  await invoke('allow_vault', { path });
  const vault = await Vault.open(tauriFs, path);
  current = vault;
  const publish = () => useApp.setState({ vault: path, files: vault.documents() });
  vault.subscribe((ev) => {
    if (ev.kind === 'tree') publish();
  });
  await vault.watch();
  publish();
  if (import.meta.env.DEV) void info(`vault ${path}: ${vault.documents().join(', ')}`);
  return vault;
}

/** Ask for a directory, then open it. Resolves to null if the dialog was dismissed. */
export async function pickVault(): Promise<Vault | null> {
  const dir = await pickDirectory({ directory: true, recursive: true, multiple: false });
  return dir ? openVault(dir) : null;
}

/** Dev only: `ILMI_VAULT=/path npm run tauri dev` opens that vault at launch. */
export async function openInitialVault(): Promise<void> {
  const path = await invoke<string | null>('initial_vault');
  if (path) await openVault(path);
}
