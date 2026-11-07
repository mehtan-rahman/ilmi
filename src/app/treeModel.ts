// The sidebar tree's rows and keys, pure. `Tree.tsx` draws the rows this
// returns and asks `treeKey` what a key press means; `keyPlace` turns a
// keyboard move into the drop the vault takes, as a drag would.
//
// Keys (the WAI-ARIA tree, and a sidebar's moves where Tab must stay Tab):
//  · ↑ ↓            the previous / next row; Home / End the first / last
//  · →              opens a closed row; on an open one, its first child
//  · ←              closes an open row; on a closed one, its parent
//  · ⏎              opens the row's node in the pane
//  · F2             renames
//  · ⌘⌫             deletes (asking first when something is under it)
//  · ⌥⌘↑ ⌥⌘↓        moves the row before / after its neighbour
//  · ⌥⌘← ⌥⌘→        outdents it (after its parent) / nests it (into the row above)
//  · a letter       the next row whose name starts with what was typed

import { childDirOf, dirOf, ordered, within, type Order, type TreeNode } from '../vault/index.js';
import type { FlatRow, Mode, Nest } from './dnd.js';
import { findNode } from './names.js';

/**
 * The tree's indent: 6 px to depth 0's content, 10 a level. 10, not 13 (39,
 * from 38's window check: four levels down, `variational met…` was cut by
 * the indent at the default width); the guides still sit under each level's
 * chevron, 10 px apart.
 */
export const TREE_PAD = 6;
export const TREE_INDENT = 10;

/** One drawn row of the tree. */
export interface TreeRow extends FlatRow {
  /** The row it sits under (`''` the root row), null for the top row. */
  parent: string | null;
  /** It can open: a folder, or a document with something under it. */
  has: boolean;
  open: boolean;
  /** The node; a placeholder row has none. */
  node?: TreeNode;
}

const kidsOf = (n: TreeNode): TreeNode[] => (n.kind === 'folder' ? n.children : n.children ?? []);

/** How a node takes a drop in its middle: a folder or a document with something under it at once, a bare document after a rest; a PDF on its own holds nothing, and never. */
export const nestOf = (n: TreeNode): Nest => (n.kind === 'doc' && n.bare ? 'never' : n.kind === 'folder' || kidsOf(n).length > 0 ? 'now' : 'dwell');

/**
 * The rows drawn: the root row (or the hoisted node's), then every open
 * row's children in their order, depth first; an open folder or document
 * with nothing in it shows one placeholder row under it.
 */
export function treeRows(tree: TreeNode[], open: Record<string, true>, order: Order, hoist?: string): TreeRow[] {
  const out: TreeRow[] = [];
  const visit = (list: TreeNode[], dir: string, depth: number, parent: string) => {
    for (const n of ordered(list, order[dir])) {
      const kids = kidsOf(n);
      const has = n.kind === 'folder' || kids.length > 0;
      const shown = has && !!open[n.path];
      out.push({ path: n.path, depth, nest: nestOf(n), parent, has, open: shown, node: n });
      if (shown) {
        if (kids.length) visit(kids, childDirOf(n.path), depth + 1, n.path);
        else out.push({ path: n.path, key: `${n.path}\u0000empty`, depth: depth + 1, nest: 'only', parent: n.path, has: false, open: false, placeholder: true });
      }
    }
  };
  const top = hoist ? findNode(tree, hoist) : undefined;
  if (top) {
    out.push({ path: top.path, depth: 0, nest: 'only', parent: null, has: true, open: true, node: top });
    const kids = kidsOf(top);
    if (kids.length) visit(kids, childDirOf(top.path), 1, top.path);
    else out.push({ path: top.path, key: `${top.path}\u0000empty`, depth: 1, nest: 'only', parent: top.path, has: false, open: false, placeholder: true });
    return out;
  }
  out.push({ path: '', depth: 0, nest: 'only', parent: null, has: true, open: !!open[''] });
  if (open['']) {
    if (tree.length) visit(tree, '', 1, '');
    else out.push({ path: '', key: '\u0000empty', depth: 1, nest: 'only', parent: '', has: false, open: false, placeholder: true });
  }
  return out;
}

/** The rows that must be open for `path` to be drawn: the root, and each folder or document above it, outermost first. */
export function revealRows(tree: TreeNode[], path: string): string[] {
  const out: string[] = [''];
  const chain: string[] = [];
  for (let dir = dirOf(path); dir !== ''; dir = dirOf(dir)) chain.unshift(dir);
  for (const dir of chain) {
    const row = findNode(tree, dir)?.kind === 'folder' ? dir : `${dir}.md`;
    if (findNode(tree, row)) out.push(row);
  }
  return out;
}

/** What a key press on the tree means. */
export type TreeAction =
  | { kind: 'focus'; path: string }
  | { kind: 'fold'; path: string; open: boolean }
  | { kind: 'activate'; path: string }
  | { kind: 'rename'; path: string }
  | { kind: 'delete'; path: string }
  | { kind: 'move'; path: string; to: 'up' | 'down' | 'out' | 'in' }
  | { kind: 'type'; char: string };

export interface KeyLike {
  key: string;
  metaKey?: boolean;
  ctrlKey?: boolean;
  altKey?: boolean;
  shiftKey?: boolean;
}

const MOVES: Record<string, 'up' | 'down' | 'out' | 'in'> = { ArrowUp: 'up', ArrowDown: 'down', ArrowLeft: 'out', ArrowRight: 'in' };

/** What key `e` does with `focus` the selected row (null: no row yet); null when the key is not the tree's. */
export function treeKey(rows: readonly TreeRow[], focus: string | null, e: KeyLike): TreeAction | null {
  const real = rows.filter((r) => !r.placeholder);
  if (!real.length) return null;
  const i = focus === null ? -1 : real.findIndex((r) => r.path === focus);
  const at = i < 0 ? undefined : real[i];
  const cmd = !!(e.metaKey || e.ctrlKey);
  if (cmd && e.altKey && MOVES[e.key]) return at && at.depth > 0 && at.parent !== null ? { kind: 'move', path: at.path, to: MOVES[e.key]! } : null;
  if (cmd && (e.key === 'Backspace' || e.key === 'Delete')) return at && at.depth > 0 ? { kind: 'delete', path: at.path } : null;
  if (cmd || e.altKey) return null;
  switch (e.key) {
    case 'ArrowDown':
      return { kind: 'focus', path: real[Math.min(real.length - 1, i + 1)]!.path };
    case 'ArrowUp':
      return { kind: 'focus', path: real[Math.max(0, i < 0 ? 0 : i - 1)]!.path };
    case 'Home':
      return { kind: 'focus', path: real[0]!.path };
    case 'End':
      return { kind: 'focus', path: real[real.length - 1]!.path };
    case 'ArrowRight': {
      if (!at) return { kind: 'focus', path: real[0]!.path };
      if (!at.has) return null;
      if (!at.open) return { kind: 'fold', path: at.path, open: true };
      const child = real[i + 1];
      return child && child.parent === at.path ? { kind: 'focus', path: child.path } : null;
    }
    case 'ArrowLeft': {
      if (!at) return { kind: 'focus', path: real[0]!.path };
      // a hoisted row stays open: it is the tree while hoisted
      if (at.has && at.open && (at.depth > 0 || at.path === '')) return { kind: 'fold', path: at.path, open: false };
      return at.parent !== null ? { kind: 'focus', path: at.parent } : null;
    }
    case 'Enter':
      return at ? { kind: 'activate', path: at.path } : null;
    case 'F2':
      return at && at.depth > 0 ? { kind: 'rename', path: at.path } : null;
    default:
      if (e.key.length === 1 && /\S/.test(e.key)) return { kind: 'type', char: e.key };
      return null;
  }
}

/**
 * The next row after `from` (wrapping) whose name starts with `typed`,
 * ignoring case and marks (and a transliteration's ʿ ʾ); a run of one letter (`aaa`) steps through the
 * names starting with it. Null when none does.
 */
export function typeahead(rows: readonly TreeRow[], from: string | null, typed: string, name: (path: string) => string): string | null {
  const real = rows.filter((r) => !r.placeholder);
  if (!real.length || !typed) return null;
  // marks off, and the transliteration's ʿayn and hamza (`ʿarabī` under a)
  const fold = (s: string) => s.normalize('NFD').replace(/[\p{M}\u02BB\u02BC\u02BE\u02BF']/gu, '').toLowerCase();
  const same = [...typed].every((c) => c === typed[0]);
  const want = fold(same ? typed[0]! : typed);
  const i = real.findIndex((r) => r.path === from);
  // a longer word keeps the row it is on when that one still matches
  const start = same ? i + 1 : Math.max(0, i);
  for (let k = 0; k < real.length; k++) {
    const r = real[(start + k) % real.length]!;
    if (fold(name(r.path)).startsWith(want)) return r.path;
  }
  return null;
}

/**
 * A keyboard move as the drop the vault takes, over the drawn rows: up
 * before the sibling above, down after the sibling below, out after its
 * parent, in into the sibling above (last among its children). Null when
 * there is nowhere to go (the first sibling up, a top row out).
 */
export function keyPlace(rows: readonly TreeRow[], path: string, to: 'up' | 'down' | 'out' | 'in'): { target: string; mode: Mode } | null {
  const real = rows.filter((r) => !r.placeholder);
  const at = real.find((r) => r.path === path);
  if (!at || at.parent === null) return null;
  const sibs = real.filter((r) => r.parent === at.parent && r.depth === at.depth);
  const k = sibs.findIndex((r) => r.path === path);
  switch (to) {
    case 'up':
      return k > 0 ? { target: sibs[k - 1]!.path, mode: 'before' } : null;
    case 'down':
      return k < sibs.length - 1 ? { target: sibs[k + 1]!.path, mode: 'after' } : null;
    case 'out': {
      const parent = real.find((r) => r.path === at.parent);
      return parent && parent.depth > 0 && parent.parent !== null ? { target: parent.path, mode: 'after' } : null;
    }
    case 'in': {
      const above = sibs[k - 1];
      return above && !within(above.path, childDirOf(path)) ? { target: above.path, mode: 'into' } : null;
    }
  }
}
