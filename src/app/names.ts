// Display names and glyphs for tree nodes and tabs. One place, so the
// sidebar, the tab bar, and the lenses agree.

import type { NodeType } from '../format/index.js';
import { whenToDate } from '../schedule/index.js';
import { baseOf, isDoc, nameOf, type TreeNode } from '../vault/index.js';
import type { DocInfo } from './store.js';

export type NodeKind = 'folder' | NodeType;
/** What a tab can show: a node, or the intake. */
export type TabKind = NodeKind | 'intake';

/** The intake tab's id. A colon is not a character a file name can hold, so it is never a vault path. */
export const INTAKE = ':intake';

export const GLYPH: Record<TabKind, string> = {
  folder: '/',
  source: '¶',
  extract: '↳',
  deck: '◫',
  draft: '✎',
  intake: '＋',
};

export function kindOf(path: string, docs: Record<string, DocInfo>): NodeKind {
  return isDoc(path) ? docs[path]?.type ?? 'source' : 'folder';
}

export function tabKindOf(id: string, docs: Record<string, DocInfo>): TabKind {
  return id === INTAKE ? 'intake' : kindOf(id, docs);
}

/** A document's `title`, else its file name; the root is the vault directory's name. */
export function titleOf(path: string, docs: Record<string, DocInfo>, vaultRoot: string | null): string {
  if (path === '') return baseOf(vaultRoot ?? '') || 'vault';
  if (path === INTAKE) return 'intake';
  return docs[path]?.title ?? nameOf(path);
}

export function findNode(nodes: TreeNode[], path: string): TreeNode | undefined {
  for (const n of nodes) {
    if (n.path === path) return n;
    const kids = n.kind === 'folder' ? n.children : n.children;
    if (kids) {
      const hit = findNode(kids, path);
      if (hit) return hit;
    }
  }
  return undefined;
}

/** Every folder path, depth first, root first. */
export function folderPaths(nodes: TreeNode[]): string[] {
  const out: string[] = [''];
  const visit = (list: TreeNode[]) => {
    for (const n of list) {
      if (n.kind === 'folder') {
        out.push(n.path);
        visit(n.children);
      } else if (n.children) visit(n.children);
    }
  };
  visit(nodes);
  return out;
}

const plural = (n: number, word: string) => `${n} ${word}${n === 1 ? '' : 's'}`;

/** The quiet note at the end of a row: counts, or a state word. */
export function metaOf(node: TreeNode, info: DocInfo | undefined, now: Date): string {
  if (node.kind === 'folder') return node.children.length ? String(node.children.length) : '';
  if (!info) return '';
  switch (info.type) {
    case 'deck':
      return info.due ? `${info.cards} · ${info.due} due` : String(info.cards);
    case 'draft': {
      const w = info.write;
      if (!w) return 'draft';
      if (w.done) return 'done';
      return !w.due || whenToDate(w.due) <= now ? 'due' : 'draft';
    }
    default:
      return info.cards ? `${plural(info.cards, 'card')}${info.due ? ` · ${info.due} due` : ''}` : '';
  }
}

/** Contents note for a folder lens row. */
export function contentsOf(node: TreeNode, info: DocInfo | undefined): string {
  if (node.kind === 'folder') return node.children.length ? plural(node.children.length, 'item') : 'empty';
  if (!info) return '';
  if (info.type === 'draft') return info.write?.done ? 'done' : 'draft';
  if (info.type === 'deck') return plural(info.cards, 'card');
  if (info.cards) return plural(info.cards, 'card');
  return info.type;
}
