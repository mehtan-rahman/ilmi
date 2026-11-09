// Every delete of a node (the tree's ⌘⌫, a menu's `delete`, the tab rail's)
// goes through here: the vault removes it and hands back what went, and the
// notice holds `undo`, which puts the files back and the node in its place
// in its directory's order (`Vault.restore`).

import { dirOf } from '../vault/index.js';
import { notify } from './land.js';
import { titleOf } from './names.js';
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
