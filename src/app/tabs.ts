// Document tabs (milestones 31 and 39), the pure side. A notebook is a
// document whose front-matter says `tabs: true`; its children (FORMAT.md §1,
// its children directory, in the order of `.ilmi/order.json`) are its tabs,
// and a child's own children are subtabs under it, three levels at most. A
// pane tab on a notebook holds the path of the page it shows: the notebook
// itself (its overview) or any node under it, so a tab is opened from
// anywhere (the tree, the queue, the palette, a session) by its own path and
// lands in its notebook with the rail beside it. The rail is `Rail.tsx`.
//
// Extracts are never tabs: they are what reading carved out of a page, not
// the author's structure. A tab's extracts are one `n extracts` row under it
// that opens the folder lens of its children; the step keys skip them.
//
// The rail's rows are the tree's (`treeModel.ts`'s `TreeRow`), so its keys
// and drags are the tree's too: the overview at depth 0 (as the tree's root
// row, it takes only `into`), tabs at 1, subtabs at 2 and 3.

import type { Block, NodeType } from '../format/index.js';
import { childDirOf, childrenAt, dirOf, entryOf, isDoc, ordered, within, type Order, type TreeNode, type Vault } from '../vault/index.js';
import type { Mode } from './dnd.js';
import { findNode, titleOf } from './names.js';
import type { DocInfo } from './store.js';
import { keyPlace, type TreeRow } from './treeModel.js';

/** How deep tabs go: tabs, their subtabs, and theirs (Google Docs' three levels). */
export const TAB_DEPTH = 3;

/** The rail's width: about 200 px, resizable by its edge between these, one width for every notebook in `.ilmi/state.json`. */
export const RAIL_MIN = 150;
export const RAIL_MAX = 360;
export const RAIL_DEFAULT = 200;
export const clampRail = (w: number): number => Math.round(Math.min(RAIL_MAX, Math.max(RAIL_MIN, Number.isFinite(w) ? w : RAIL_DEFAULT)));

/** The rail's indent: 6 px to a tab's content, 12 a level below it. */
export const RAIL_PAD = 6;
export const RAIL_INDENT = 12;
/** The left padding of a rail row at `depth` (the overview and the tabs share the left edge). */
export const railPad = (depth: number): number => RAIL_PAD + Math.max(0, depth - 1) * RAIL_INDENT;

/**
 * The notebook `path` is a page of: the outermost document above it (or it
 * itself) with `tabs: true`, or null. A notebook's own children directory
 * is a page of it too (the folder lens its `n extracts` row opens).
 */
export function notebookOf(path: string, docs: Record<string, DocInfo>): string | null {
  let found: string | null = isDoc(path) && docs[path]?.tabs ? path : !isDoc(path) && path !== '' && docs[`${path}.md`]?.tabs ? `${path}.md` : null;
  for (let dir = dirOf(path); dir !== ''; dir = dirOf(dir)) {
    if (docs[`${dir}.md`]?.tabs) found = `${dir}.md`;
  }
  return found;
}

const isExtract = (n: TreeNode, docs: Record<string, DocInfo>) => n.kind === 'doc' && docs[n.path]?.type === 'extract';
const kidsOf = (n: TreeNode): TreeNode[] => (n.kind === 'folder' ? n.children : n.children ?? []);

/** The pages of notebook `nb` in the rail's order, depth first: the notebook first, then each tab and its subtabs; extracts left out. */
export function notebookPages(tree: TreeNode[], nb: string, order: Order, docs: Record<string, DocInfo> = {}): string[] {
  const out = [nb];
  const visit = (dir: string, depth: number) => {
    for (const n of ordered(childrenAt(tree, dir) ?? [], order[dir])) {
      if (isExtract(n, docs)) continue;
      out.push(n.path);
      if (depth < TAB_DEPTH) visit(childDirOf(n.path), depth + 1);
    }
  };
  visit(childDirOf(nb), 1);
  return out;
}

/** One row of the rail: a tree row, and which of the rail's own kinds it is. */
export interface RailRow extends TreeRow {
  /** The notebook's own row, its overview. */
  overview?: boolean;
  /**
   * The `n extracts` row: `path` is the children directory it opens as a
   * folder lens, `parent` the tab whose extracts they are. It takes a drop
   * into that tab, and the keys pass over it (it is a placeholder to them).
   */
  extracts?: number;
}

/**
 * The rail's rows: the notebook, then its tabs in their order, each open
 * one's subtabs indented under it (to `TAB_DEPTH`), and under an open tab
 * with extracts one `n extracts` row after its subtabs; the notebook's own
 * extracts last.
 */
export function railRows(tree: TreeNode[], nb: string, order: Order, open: Record<string, true>, docs: Record<string, DocInfo> = {}): RailRow[] {
  const out: RailRow[] = [];
  const extractsRow = (owner: string, n: number, depth: number): RailRow => ({
    path: childDirOf(owner), key: `${childDirOf(owner)}\u0000extracts`, depth, nest: 'only', parent: owner, has: false, open: false, placeholder: true, extracts: n,
  });
  const visit = (dir: string, depth: number, parent: string) => {
    for (const n of ordered(childrenAt(tree, dir) ?? [], order[dir])) {
      if (isExtract(n, docs)) continue;
      const kids = kidsOf(n);
      const tabs = depth < TAB_DEPTH ? kids.filter((k) => !isExtract(k, docs)) : [];
      const ex = kids.filter((k) => isExtract(k, docs)).length;
      const has = tabs.length > 0 || ex > 0;
      const shown = has && !!open[n.path];
      out.push({
        path: n.path, depth, parent, has, open: shown, node: n,
        nest: depth >= TAB_DEPTH ? 'never' : n.kind === 'folder' || tabs.length > 0 ? 'now' : 'dwell',
      });
      if (!shown) continue;
      if (tabs.length) visit(childDirOf(n.path), depth + 1, n.path);
      if (ex) out.push(extractsRow(n.path, ex, depth + 1));
    }
  };
  const top = findNode(tree, nb);
  out.push({ path: nb, depth: 0, nest: 'only', parent: null, has: true, open: true, overview: true, ...(top ? { node: top } : {}) });
  visit(childDirOf(nb), 1, nb);
  const own = (childrenAt(tree, childDirOf(nb)) ?? []).filter((k) => isExtract(k, docs)).length;
  if (own) out.push(extractsRow(nb, own, 1));
  return out;
}

/**
 * A keyboard move on the rail, as the tree's (`keyPlace`) with the rail's
 * limits: never into a row at the deepest level, never out of the notebook,
 * and the `n extracts` rows not counted as siblings.
 */
export function railKeyPlace(rows: readonly RailRow[], path: string, to: 'up' | 'down' | 'out' | 'in'): { target: string; mode: Mode } | null {
  const tabs = rows.filter((r) => !r.extracts);
  const p = keyPlace(tabs, path, to);
  if (!p) return null;
  if (p.mode === 'into' && (tabs.find((r) => r.path === p.target)?.depth ?? TAB_DEPTH) >= TAB_DEPTH) return null;
  return p;
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

/** One heading of a page, for the rail's outline under the active tab. */
export interface OutlineEntry {
  /** Its place among every heading of the page, of any level, as the reader draws them (`.dd-h`). */
  index: number;
  level: number;
  text: string;
}

/** A heading's text as the outline shows it: emphasis and code markers off, math kept. */
const plainHeading = (s: string): string => s.replace(/\*\*|__|`/g, '').replace(/(^|\s)[*_](\S[^*_]*\S|\S)[*_](?=\s|$)/g, '$1$2').replace(/\s+/g, ' ').trim();

/** Each heading's fold key, by its index among the page's headings: the level and text, a repeat numbered, as `fold.ts` keys them. */
export function headingKeys(blocks: readonly Block[]): string[] {
  const seen = new Map<string, number>();
  const out: string[] = [];
  for (const b of blocks) {
    if (b.kind !== 'heading') continue;
    const base = `${b.level} ${b.text.trim()}`;
    const n = (seen.get(base) ?? 0) + 1;
    seen.set(base, n);
    out.push(n === 1 ? base : `${base} (${n})`);
  }
  return out;
}

/** The headings folded in the reader (milestone 46: the outline marks them), by index among the page's headings. */
export function foldedHeadings(blocks: readonly Block[], keys: readonly string[] | undefined): Set<number> {
  const out = new Set<number>();
  if (!keys?.length) return out;
  const want = new Set(keys);
  headingKeys(blocks).forEach((k, i) => { if (want.has(k)) out.add(i); });
  return out;
}

/** The headings a page's outline lists: levels 1 to 3, in order, each with its index among all the page's headings. */
export function outline(blocks: readonly Block[]): OutlineEntry[] {
  const out: OutlineEntry[] = [];
  let n = 0;
  for (const b of blocks) {
    if (b.kind !== 'heading') continue;
    const text = plainHeading(b.text);
    if (b.level <= 3 && text) out.push({ index: n, level: b.level, text });
    n++;
  }
  return out;
}

/**
 * Whether a document shows the `tabs` toggle in its top row: it has
 * children, and it is not a page inside another notebook (only the
 * outermost notebook draws a rail).
 */
export function showsTabsToggle(path: string, tree: TreeNode[], docs: Record<string, DocInfo>): boolean {
  if (!isDoc(path)) return false;
  const n = findNode(tree, path);
  if (!n || !kidsOf(n).length) return false;
  const nb = notebookOf(path, docs);
  return nb === null || nb === path;
}

/** The pane tab's label: a notebook's page reads `notebook › page`, the notebook alone its own title. */
export function tabLabel(id: string, docs: Record<string, DocInfo>, root: string | null): string {
  const nb = notebookOf(id, docs);
  if (!nb || nb === id) return titleOf(id, docs, root);
  if (id === childDirOf(nb)) return `${titleOf(nb, docs, root)} › extracts`;
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
