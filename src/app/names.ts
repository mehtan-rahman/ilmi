// Display names and glyphs for tree nodes and tabs. One place, so the
// sidebar, the tab bar, and the lenses agree.

import type { NodeType } from '../format/index.js';
import { whenToDate } from '../schedule/index.js';
import { baseOf, childDirOf, dirOf, isDoc, nameOf, ordered, within, type Order, type TreeNode } from '../vault/index.js';
import type { DocInfo } from './store.js';

export type NodeKind = 'folder' | NodeType;
/** What a tab can show: a node, the intake, a saved query, or the session. */
export type TabKind = NodeKind | 'intake' | 'queue' | 'session';

/** Every scope a saved query can have. */
export type QueueScope = 'today' | 'upcoming' | 'reading' | 'writing' | 'cards';
export const SCOPES: readonly QueueScope[] = ['today', 'upcoming', 'reading', 'writing', 'cards'];

// Tab ids that are not vault paths. A colon is not a character a file name
// can hold, so none of these can collide with one.
/** The intake tab's id. */
export const INTAKE = ':intake';
/** The session tab's id: one session at a time. */
export const SESSION = ':session';
const QUEUE = ':queue/';

export const queueId = (scope: QueueScope): string => QUEUE + scope;
/** The scope of a saved-query tab id, or null for anything else. */
export function queueScope(id: string): QueueScope | null {
  if (!id.startsWith(QUEUE)) return null;
  const s = id.slice(QUEUE.length) as QueueScope;
  return SCOPES.includes(s) ? s : null;
}

export const QUEUE_TITLE: Record<QueueScope, string> = {
  today: 'due today', upcoming: 'upcoming', reading: 'reading', writing: 'writing', cards: 'all cards',
};

export const GLYPH: Record<TabKind, string> = {
  folder: '/',
  source: '¶',
  extract: '↳',
  deck: '◫',
  draft: '✎',
  intake: '＋',
  queue: '≡',
  session: '◆',
};

export function kindOf(path: string, docs: Record<string, DocInfo>): NodeKind {
  return isDoc(path) ? docs[path]?.type ?? 'source' : 'folder';
}

export function tabKindOf(id: string, docs: Record<string, DocInfo>): TabKind {
  if (id === INTAKE) return 'intake';
  if (id === SESSION) return 'session';
  if (queueScope(id)) return 'queue';
  return kindOf(id, docs);
}

/** A document's `title`, else its file name; the root is the vault directory's name; a document's children directory is named for the document. */
export function titleOf(path: string, docs: Record<string, DocInfo>, vaultRoot: string | null): string {
  if (path === '') return baseOf(vaultRoot ?? '') || 'collection';
  if (path === INTAKE) return 'intake';
  if (path === SESSION) return 'session';
  const scope = queueScope(path);
  if (scope) return QUEUE_TITLE[scope];
  if (!isDoc(path) && docs[`${path}.md`]) return docs[`${path}.md`]?.title ?? nameOf(path);
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

/** A place `move to…` offers: a folder or a document (`path`, `''` the root), the directory a move there lands in, and how deep it sits. */
export interface MoveTarget {
  path: string;
  dir: string;
  depth: number;
}

/**
 * Everywhere `id` can move to, depth first in the tree's order (`order`
 * applied): the root, every folder, every document (into its children
 * directory); `id` itself, what is under it, and the directory it is in
 * already left out.
 */
export function moveTargets(nodes: TreeNode[], id: string, order: Order = {}): MoveTarget[] {
  const out: MoveTarget[] = [];
  const own = childDirOf(id);
  const add = (path: string, dir: string, depth: number) => {
    if (path === id || (id !== '' && within(path, own)) || dir === dirOf(id)) return;
    out.push({ path, dir, depth });
  };
  add('', '', 0);
  const visit = (list: TreeNode[], dir: string, depth: number) => {
    for (const n of ordered(list, order[dir])) {
      // a node's own subtree is no place to move it to
      if (n.path === id) continue;
      const kids = n.kind === 'folder' ? n.children : n.children;
      add(n.path, childDirOf(n.path), depth);
      if (kids) visit(kids, childDirOf(n.path), depth + 1);
    }
  };
  visit(nodes, '', 1);
  return out;
}

/** How many nodes are under `node`, all the way down. */
export function descendants(node: TreeNode): number {
  const kids = node.kind === 'folder' ? node.children : node.children ?? [];
  return kids.reduce((n, k) => n + 1 + descendants(k), 0);
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
