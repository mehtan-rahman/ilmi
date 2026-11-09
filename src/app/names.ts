// Display names and glyphs for tree nodes and tabs. One place, so the
// sidebar, the tab bar, and the lenses agree.

import type { NodeType } from '../format/index.js';
import { whenToDate } from '../schedule/index.js';
import { baseOf, childDirOf, dirOf, isDoc, isPdfPath, nameOf, ordered, within, type Order, type TreeNode } from '../vault/index.js';
import type { Panes } from './panes.js';
import type { DocInfo } from './store.js';

export type NodeKind = 'folder' | NodeType;
/** What a tab can show: a node, the intake, a saved query, or the session. */
export type TabKind = NodeKind | 'intake' | 'queue' | 'session' | 'cards';

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
/**
 * The body of a document with pages, shown as the notes on them (milestone
 * 70): the tab the other pane holds while the pages are open. A note of its
 * own attached to a PDF on its own needs no such id; it is the ordinary tab
 * it is.
 */
const NOTES = ':notes/';

/**
 * A document's cards one at a time (the card view, `CardPane.tsx`): one tab
 * per document, at the card `cardAt` names.
 */
const CARDS = ':cards/';

export const cardsId = (path: string): string => CARDS + path;
/** The document a `:cards/` tab shows, or null for any other id. */
export const cardsPath = (id: string): string | null => (id.startsWith(CARDS) ? id.slice(CARDS.length) : null);

export const notesId = (path: string): string => NOTES + path;
/** The document a `:notes/` tab shows, or null for any other id. */
export const notesPath = (id: string): string | null => (id.startsWith(NOTES) ? id.slice(NOTES.length) : null);

/**
 * The pages a node is read by: a document with pages, or a PDF on its own,
 * is its own; a note attached to a PDF on its own (`of`) is read by that
 * PDF; anything else by none.
 */
export function pagesOf(path: string, docs: Record<string, DocInfo>): string | null {
  const info = docs[path];
  if (!info) return null;
  return info.pdf !== undefined ? path : info.of ?? null;
}

/**
 * The note on a node's pages: a document with pages is its own notes; a PDF
 * on its own shows the first note that names it (`note`), or none yet.
 */
export function noteOf(path: string, docs: Record<string, DocInfo>): string | null {
  const info = docs[path];
  if (!info) return null;
  if (isPdfPath(path)) return info.note ?? null;
  if (info.pdf !== undefined) return path;
  return info.of !== undefined ? path : null;
}

/** The tab that shows the note on the pages at `path`: a note of its own as itself, a document with pages as its `:notes/` tab; null with no note. */
export function notesTabOf(path: string, docs: Record<string, DocInfo>): string | null {
  const note = noteOf(path, docs);
  if (note === null) return null;
  return docs[note]?.pdf !== undefined ? notesId(note) : note;
}

/**
 * Whether two panes are a PDF's pages and the note on them, either way
 * round (a session's pages counted by what it is on, `sessionPath`): the one
 * second pane an iPad keeps (milestone 70).
 */
export function notesPair(panes: Panes, docs: Record<string, DocInfo>, sessionPath?: string): boolean {
  if (panes.panes.length !== 2) return false;
  const [a, b] = panes.panes.map((p) => p.tabs[p.active]?.id);
  const pairs = (x: string | undefined, y: string | undefined): boolean => {
    const at = x === SESSION ? sessionPath : x;
    const pages = at === undefined ? null : pagesOf(at, docs);
    return pages !== null && y !== undefined && notesTabOf(pages, docs) === y;
  };
  return pairs(a, b) || pairs(b, a);
}

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

/**
 * One mark per kind, all in the bundled IBM Plex Mono (its Latin subset, so
 * every one is drawn in the same face and weight at 13px, none left to a
 * system fallback): a folder is a path's `/`; a note your own paragraphs
 * `¶`; a source someone else's words `“`; an extract a section carried out
 * of one `§`; a deck a front equal to its back `=`; a draft writing still
 * rough `~`. A folder's name is also set apart by weight, not by its mark
 * alone (`app.css`).
 */
export const GLYPH: Record<TabKind, string> = {
  folder: '/',
  note: '¶',
  source: '“',
  extract: '§',
  deck: '=',
  draft: '~',
  intake: '＋',
  queue: '≡',
  session: '◆',
  cards: '◆',
};

export function kindOf(path: string, docs: Record<string, DocInfo>): NodeKind {
  // a PDF on its own is a source: someone else's pages (milestone 70)
  if (isPdfPath(path)) return docs[path]?.type ?? 'source';
  return isDoc(path) ? docs[path]?.type ?? 'note' : 'folder';
}

export function tabKindOf(id: string, docs: Record<string, DocInfo>): TabKind {
  if (id === INTAKE) return 'intake';
  if (id === SESSION) return 'session';
  if (queueScope(id)) return 'queue';
  if (cardsPath(id) !== null) return 'cards';
  // the notes on a document's pages are the person's own
  if (notesPath(id) !== null) return 'note';
  return kindOf(id, docs);
}

/** A document's `title`, else its file name; the root is the vault directory's name; a document's children directory is named for the document. */
export function titleOf(path: string, docs: Record<string, DocInfo>, vaultRoot: string | null): string {
  if (path === '') return baseOf(vaultRoot ?? '') || 'collection';
  if (path === INTAKE) return 'intake';
  if (path === SESSION) return 'session';
  const scope = queueScope(path);
  if (scope) return QUEUE_TITLE[scope];
  const notes = notesPath(path);
  if (notes !== null) return titleOf(notes, docs, vaultRoot);
  const cards = cardsPath(path);
  if (cards !== null) return `${titleOf(cards, docs, vaultRoot)} › cards`;
  if (!isDoc(path) && !isPdfPath(path) && docs[`${path}.md`]) return docs[`${path}.md`]?.title ?? slugName(nameOf(path));
  return docs[path]?.title ?? slugName(nameOf(path));
}

/**
 * A file name as a name: a slug's hyphens and underscores read as spaces
 * (`unit-2` → `unit 2`, `ch-3_the-canonical-ensemble` → `ch 3 the canonical
 * ensemble`), except between two digits (`2026-10-30` stays a date). Only
 * for showing; the file keeps its name.
 */
export function slugName(name: string): string {
  return name.replace(/[-_]+/g, (run, at: number, all: string) => (/\d/.test(all[at - 1] ?? '') && /\d/.test(all[at + run.length] ?? '') ? run : ' ')).replace(/\s{2,}/g, ' ').trim() || name;
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
      // a node's own subtree is no place to move it to; a PDF on its own holds nothing
      if (n.path === id || (n.kind === 'doc' && n.bare)) continue;
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

/**
 * What a tree row shows at its end: one number, how much is due in the
 * document (its cards due, its sections that come back, and one for a
 * reading or writing pass due today), 0 when nothing is (drawn as nothing); and the full counts, for
 * the row's tooltip.
 */
export function rowCounts(node: TreeNode, info: DocInfo | undefined, now: Date): { due: number; full: string } {
  if (node.kind === 'folder') return { due: 0, full: node.children.length ? plural(node.children.length, 'item') : 'empty' };
  if (!info) return { due: 0, full: '' };
  const parts: string[] = [];
  if (info.cards || info.type === 'deck') parts.push(`${plural(info.cards, 'card')}${info.due ? `, ${info.due} due` : ''}`);
  const read = !!info.read && (!info.read.due || whenToDate(info.read.due) <= now);
  const w = info.write;
  const write = !!w && !w.done && (!w.due || whenToDate(w.due) <= now);
  if (read) parts.push(info.type === 'note' ? 'revisit due' : 'reading due');
  const sections = info.sections ?? 0;
  if (sections) parts.push(`${plural(sections, 'section')} due`);
  if (write) parts.push('writing due');
  else if (w?.done) parts.push('done');
  const kids = node.children?.length ?? 0;
  if (kids) parts.push(plural(kids, 'item'));
  return { due: info.due + sections + (read ? 1 : 0) + (write ? 1 : 0), full: parts.join('; ') };
}

/** The quiet note at the end of a row: counts, or a state word. */
export function metaOf(node: TreeNode, info: DocInfo | undefined, now: Date): string {
  if (node.kind === 'folder') return node.children.length ? String(node.children.length) : '';
  if (!info) return '';
  switch (info.type) {
    case 'deck':
      return info.due ? `${info.due} due` : String(info.cards);
    case 'draft': {
      const w = info.write;
      if (!w) return 'draft';
      if (w.done) return 'done';
      return !w.due || whenToDate(w.due) <= now ? 'due' : 'draft';
    }
    default:
      return info.due ? `${info.due} due` : info.cards ? plural(info.cards, 'card') : '';
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
