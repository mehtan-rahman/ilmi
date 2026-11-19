// Every delete of a node (the tree's ⌘⌫, a menu's `delete`, the tab rail's)
// goes through here: the vault removes it and hands back what went, and the
// notice holds `undo`, which puts the files back and the node in its place
// in its directory's order (`Vault.restore`). Several deleted at once (the
// tree's selection) are one notice and one undo, which puts them all back.

import { dirOf, type Removed } from '../vault/index.js';
import { notify } from './land.js';
import { itemsLabel, titleOf } from './names.js';
import { useApp } from './store.js';
import { currentVault, openDir } from './vault.js';
import { written } from './writer.js';

/** Delete `path` with the notice's undo: `deleted · quantum II`. */
export async function deleteNode(path: string): Promise<void> {
  const vault = currentVault();
  if (!vault) return;
  const s = useApp.getState();
  const name = titleOf(path, s.docs, s.vault);
  // what was typed on its pages is written first, so the undo puts back the last of it
  await written(path);
  const removed = await vault.remove(path);
  notify(`deleted · ${name}`, null, async () => {
    await vault.restore(removed);
    openDir(dirOf(path));
  });
}

/**
 * Delete every one of `paths` (none under another: `topmost`) with one notice and one undo: `deleted · 3 items`.
 * One that cannot go stops it there: the notice says how many went, and its undo puts those back.
 */
export async function deleteNodes(paths: readonly string[]): Promise<void> {
  if (paths.length === 1) return deleteNode(paths[0]!);
  const vault = currentVault();
  if (!vault || !paths.length) return;
  const went: Removed[] = [];
  let failed: unknown = null;
  for (const path of paths) {
    try {
      await written(path);
      went.push(await vault.remove(path));
    } catch (e) {
      failed = e;
      break;
    }
  }
  if (failed !== null) console.error(failed);
  if (!went.length) throw failed;
  const all = went.length === paths.length;
  // put back last out first in: each finds its directory's order as it left it
  notify(`deleted · ${all ? itemsLabel(went.length) : `${went.length} of ${itemsLabel(paths.length)}`}`, null, async () => {
    for (const r of [...went].reverse()) {
      await vault.restore(r);
      openDir(dirOf(r.path));
    }
  });
}
