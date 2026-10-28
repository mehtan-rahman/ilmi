// Document tabs (milestone 31), the pure side. A notebook is a document whose
// front-matter says `tabs: true`; its children (FORMAT.md §1, its children
// directory, in the order of `.ilmi/order.json`) are its tabs, and a child's
// own children are subtabs under it. A pane tab on a notebook holds the path
// of the page it shows: the notebook itself (its overview) or any node under
// it, so a tab is opened from anywhere (the tree, the queue, the palette, a
// session) by its own path and lands in its notebook with the rail beside it.
// The rail is `Rail.tsx`.

import type { NodeType } from '../format/index.js';
import { childDirOf, childrenAt, dirOf, entryOf, isDoc, ordered, within, type Order, type TreeNode, type Vault } from '../vault/index.js';
import { findNode, titleOf } from './names.js';
import type { DocInfo } from './store.js';

/**
 * The notebook `path` is a page of: the outermost document above it (or it
 * itself) with `tabs: true`, or null. A document's children directory as a
 * folder lens (30's) is not a page; the nodes in it are.
 */
export function notebookOf(path: string, docs: Record<string, DocInfo>): string | null {
  let found: string | null = isDoc(path) && docs[path]?.tabs ? path : null;
  for (let dir = dirOf(path); dir !== ''; dir = dirOf(dir)) {
    if (docs[`${dir}.md`]?.tabs) found = `${dir}.md`;
  }
  return found;
}

/** The pages of notebook `nb` in the rail's order, depth first: the notebook first, then each tab and its subtabs. */
export function notebookPages(tree: TreeNode[], nb: string, order: Order): string[] {
  const out = [nb];
  const visit = (dir: string) => {
    for (const n of ordered(childrenAt(tree, dir) ?? [], order[dir])) {
      out.push(n.path);
      visit(childDirOf(n.path));
    }
  };
  visit(childDirOf(nb));
  return out;
}

/** One row of the rail: the page, how deep it sits (the notebook and its tabs at 0), and whether it has subtabs. */
export interface RailRow {
  path: string;
  depth: number;
  /** It has subtabs (its own children); they show when it is open. */
  has: boolean;
  /** The notebook's own row, its overview. */
  overview: boolean;
}

/** The rail's rows: the notebook, then its tabs in their order, each open one's subtabs indented under it. */
export function railRows(tree: TreeNode[], nb: string, order: Order, open: Record<string, true>): RailRow[] {
  const out: RailRow[] = [{ path: nb, depth: 0, has: false, overview: true }];
  const visit = (dir: string, depth: number) => {
    for (const n of ordered(childrenAt(tree, dir) ?? [], order[dir])) {
      const kids = childrenAt(tree, childDirOf(n.path)) ?? [];
      out.push({ path: n.path, depth, has: kids.length > 0, overview: false });
      if (kids.length && open[n.path]) visit(childDirOf(n.path), depth + 1);
    }
  };
  visit(childDirOf(nb), 0);
  return out;
}

/** The tabs above `page` in notebook `nb`, outermost first: the rows that must be open for it to show. */
export function tabAncestors(tree: TreeNode[], nb: string, page: string): string[] {
  const out: string[] = [];
  const top = childDirOf(nb);
  for (let dir = dirOf(page); dir !== top && dir !== '' && within(dir, top); dir = dirOf(dir)) {
    // a directory under the notebook is a folder tab, or a document tab's children
    out.unshift(findNode(tree, `${dir}.md`) ? `${dir}.md` : dir);
  }
  return out;
}

/**
 * The page before (`-1`) or after (`+1`) `page` in the rail's order, all
 * subtabs counted whether folded or not; null at either end.
 */
export function stepPage(pages: string[], page: string, by: 1 | -1): string | null {
  const at = pages.indexOf(page);
  if (at < 0) return pages[0] ?? null;
  return pages[at + by] ?? null;
}

/** The pane tab's label: a notebook's page reads `notebook › page`, the notebook alone its own title. */
export function tabLabel(id: string, docs: Record<string, DocInfo>, root: string | null): string {
  const nb = notebookOf(id, docs);
  if (!nb || nb === id) return titleOf(id, docs, root);
  return `${titleOf(nb, docs, root)} › ${titleOf(id, docs, root)}`;
}

/**
 * Where a page sits under its notebook, for the palette: the notebook and
 * each tab above the page, `linear algebra › unit-2`; null off a notebook.
 */
export function notebookTrail(tree: TreeNode[], path: string, docs: Record<string, DocInfo>, root: string | null): string | null {
  const nb = notebookOf(path, docs);
  if (!nb || nb === path) return null;
  const parts = [titleOf(nb, docs, root)];
  for (const tab of tabAncestors(tree, nb, path)) parts.push(titleOf(tab, docs, root));
  return parts.join(' › ');
}

/**
 * A new tab: a document of `type` in directory `dir` (a notebook's or a
 * tab's children directory, made on demand), put last in that directory's
 * order, the whole list written as shown. Resolves to its path.
 */
export async function addTab(vault: Vault, dir: string, type: NodeType, name?: string): Promise<string> {
  const path = await vault.createDoc(dir, type, name);
  const shown = ordered(childrenAt(vault.tree, dir) ?? [], vault.order[dir]).map((n) => entryOf(n.path)).filter((e) => e !== entryOf(path));
  await vault.setOrder(dir, [...shown, entryOf(path)]);
  return path;
}
