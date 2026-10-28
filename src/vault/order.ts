// The order of a directory, chosen by hand: view state in `.ilmi/order.json`
// (FORMAT.md §1), `{ "<dir>": ["name.md", "sub/", …] }`. A directory is
// `''` for the root, a folder's path, or a document's children directory
// (`courses/linear-algebra` for `courses/linear-algebra.md`). An entry is a
// document's file name (`name.md`, its children directory going with it) or
// a folder's name with a slash (`sub/`). Names not listed follow in the
// walk's order; listed names that are no longer there are dropped on the
// next write. Pure: the vault reads and writes the file.

import { baseOf, childDirOf, dirOf, isDoc, rekey, within } from './paths.js';
import type { TreeNode } from './walk.js';

export type Order = Record<string, string[]>;

export const ORDER_FILE = '.ilmi/order.json';

/** A node's entry in its directory's order: `name.md` for a document, `name/` for a folder. */
export function entryOf(path: string): string {
  return isDoc(path) ? baseOf(path) : `${baseOf(path)}/`;
}

/** `nodes` (one directory's children, in the walk's order) in the order `list` gives: listed first, the rest after as they were. */
export function ordered<T extends TreeNode>(nodes: T[], list: readonly string[] | undefined): T[] {
  if (!list?.length) return nodes;
  const at = new Map(list.map((e, i) => [e, i]));
  const listed = nodes.filter((n) => at.has(entryOf(n.path))).sort((a, b) => at.get(entryOf(a.path))! - at.get(entryOf(b.path))!);
  return [...listed, ...nodes.filter((n) => !at.has(entryOf(n.path)))];
}

/** Every directory in the tree with its children: the root, each folder, each document that has children. */
export function directories(tree: TreeNode[]): Map<string, TreeNode[]> {
  const out = new Map<string, TreeNode[]>([['', tree]]);
  const visit = (nodes: TreeNode[]) => {
    for (const n of nodes) {
      if (n.kind === 'folder') {
        out.set(n.path, n.children);
        visit(n.children);
      } else if (n.children) {
        out.set(childDirOf(n.path), n.children);
        visit(n.children);
      }
    }
  };
  visit(tree);
  return out;
}

/** The children of directory `dir`, or undefined when the tree has no such directory. */
export function childrenAt(tree: TreeNode[], dir: string): TreeNode[] | undefined {
  return directories(tree).get(dir);
}

/** What a file holds, made safe: an object of string arrays, nothing else. */
export function cleanOrder(raw: unknown): Order {
  const out: Order = {};
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return out;
  for (const [dir, list] of Object.entries(raw as Record<string, unknown>)) {
    if (!Array.isArray(list)) continue;
    const names = [...new Set(list.filter((e): e is string => typeof e === 'string' && e !== ''))];
    if (names.length) out[dir] = names;
  }
  return out;
}

/** The order with its stale names dropped: directories no longer in the tree go, names no longer in their directory go, empty lists go. */
export function pruneOrder(order: Order, tree: TreeNode[]): Order {
  const dirs = directories(tree);
  const out: Order = {};
  for (const [dir, list] of Object.entries(order)) {
    const kids = dirs.get(dir);
    if (!kids) continue;
    const here = new Set(kids.map((k) => entryOf(k.path)));
    const kept = list.filter((e) => here.has(e));
    if (kept.length) out[dir] = kept;
  }
  return out;
}

/**
 * The order after a rename or a move of `from` to `to`: in place under its
 * new name when it stayed in its directory, out of the old directory's list
 * when it left (it follows unlisted in the new one), and the orders of its
 * own children directory and everything under it re-keyed.
 */
export function followMove(order: Order, from: string, to: string): Order {
  const out: Order = {};
  const fromDir = dirOf(from);
  const toDir = dirOf(to);
  for (const [dir, list] of Object.entries(order)) {
    const moved = rekey(dir, from, to);
    if (moved !== null) {
      out[moved] = list;
      continue;
    }
    if (dir !== fromDir) {
      out[dir] = list;
      continue;
    }
    const next = fromDir === toDir ? list.map((e) => (e === entryOf(from) ? entryOf(to) : e)) : list.filter((e) => e !== entryOf(from));
    if (next.length) out[dir] = next;
  }
  return out;
}

/** The order with `path` gone: out of its directory's list, its own directories' orders dropped. */
export function forget(order: Order, path: string): Order {
  const out: Order = {};
  const own = childDirOf(path);
  for (const [dir, list] of Object.entries(order)) {
    if (within(dir, own) && own !== '') continue;
    const next = dir === dirOf(path) ? list.filter((e) => e !== entryOf(path)) : list;
    if (next.length) out[dir] = next;
  }
  return out;
}

/**
 * A directory's full list with `entry` placed before or after `target`:
 * `current` is the directory's entries as shown now (its order applied),
 * `entry` taken out of it first, and put at the end when `target` is not there.
 */
export function placeEntry(current: string[], entry: string, target: string, mode: 'before' | 'after'): string[] {
  const list = current.filter((e) => e !== entry);
  const at = list.indexOf(target);
  if (at < 0) return [...list, entry];
  list.splice(mode === 'before' ? at : at + 1, 0, entry);
  return list;
}
