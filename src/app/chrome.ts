// The shell's pure side: what the bottom strip says for each surface, what
// a card is called in a list, the palette's index and its fuzzy match.
// The components are TopStrip, BottomStrip, Inspector, Palette, Tweaks.

import { cardFields, type Block, type CardForm } from '../format/index.js';
import { nameOf, type TreeNode } from '../vault/index.js';
import { FORM_LABEL } from './items.js';
import { QUEUE_TITLE, SCOPES, queueId, type QueueScope, type TabKind } from './names.js';
import type { DocInfo, El } from './store.js';

// ── key hints ────────────────────────────────────────────────────

export type Hint = [keys: string, what: string];

export interface HintContext {
  kind: TabKind | undefined;
  /** What the session is on, when the tab is the session. */
  el: El | null;
  /** The saved query's scope, when the tab is one. */
  scope: QueueScope | null;
  /** A source or extract not yet enrolled in reading. */
  canEnrol: boolean;
  /** A source open as pages: the PDF lens's own keys apply. */
  pages?: boolean;
}

const PALETTE: Hint = ['⌘k', 'palette'];
const NAV: Hint = ['[ ]', 'prev / next'];

/** Only keys that are bound on that surface. */
export function hintsFor(c: HintContext): Hint[] {
  switch (c.kind) {
    case 'queue':
      return c.scope === 'today'
        ? [['⏎', 'enter queue'], ['j k', 'move'], ['o', 'open one'], PALETTE]
        : [['⏎', 'open'], ['j k', 'move'], PALETTE];
    case 'session':
      if (c.el === 'read') return [['⏎', 'read on'], ['p', 'postpone'], ['d', 'done'], ['e', 'extract'], ['m', 'card'], NAV];
      if (c.el === 'write') return [['⏎', 'worked on it'], ['p', 'postpone'], ['d', 'done'], ['m', 'card'], NAV];
      return [['space', 'reveal'], ['1 2 3 4', 'grade'], NAV];
    case 'source':
    case 'extract':
      if (c.pages) return [['e', 'extract'], ['m', 'card'], ['⏎', 'jump'], ...(c.canEnrol ? [['r', 'start reading'] as Hint] : []), ['/', 'search'], ['g', 'page'], ['[ ]', 'pages']];
      return [['e', 'extract'], ['m', 'card'], ...(c.canEnrol ? [['r', 'start reading'] as Hint] : []), ['⌘\\', 'split pane']];
    case 'draft':
      return [['m', 'card'], ['esc', 'leave the text']];
    case 'deck':
      return [['j k', 'move'], ['⌫', 'delete'], ['m', 'card'], PALETTE];
    case 'intake':
      return [['⌘v', 'paste']];
    case 'folder':
    default:
      return [PALETTE, ['⌘\\', 'split pane']];
  }
}

// ── a card's name in a list ──────────────────────────────────────

const clip = (s: string, n: number) => (s.length > n ? `${s.slice(0, n - 1)}…` : s);

/** The first blank's answer, a question, or `a ⇄ b`; the text when it is not a card. */
export function cardLabel(text: string): string {
  const f = cardFields(text);
  const flat = (s: string) => s.replace(/\s+/g, ' ').trim();
  if (!f) return clip(flat(text), 46) || 'card';
  if (f.form === 'cloze') {
    const first = f.parts.find((p) => typeof p !== 'string');
    if (first && typeof first !== 'string' && first.answer.trim()) return clip(flat(first.answer), 46);
    return clip(flat(f.parts.map((p) => (typeof p === 'string' ? p : p.answer)).join('')), 46) || 'cloze';
  }
  if (f.form === 'qa') return clip(flat(f.front), 50) || 'q&a';
  return clip(`${flat(f.left)} ⇄ ${flat(f.right)}`, 46);
}

export const formOf = (text: string): CardForm | null => cardFields(text)?.form ?? null;
export const formLabel = (text: string): string => { const f = formOf(text); return f ? FORM_LABEL[f] : 'card'; };

// ── the palette ──────────────────────────────────────────────────

/**
 * The prototype's fuzzy match: every character of `query` in order in
 * `text`; lower is better, gaps cost, a match at a word start is cheaper,
 * null when it does not match. Empty query matches everything at 0. (The
 * prototype returned -1 for a miss and then kept only scores ≥ 0, which
 * dropped its best matches; a miss is null here.)
 */
export function fuzzy(query: string, text: string): number | null {
  query = query.toLowerCase();
  text = text.toLowerCase();
  if (!query) return 0;
  let qi = 0;
  let score = 0;
  let prev = -2;
  let run = 0;
  for (let ti = 0; ti < text.length && qi < query.length; ti++) {
    if (text[ti] === query[qi]) {
      if (prev >= 0) score += ti - prev === 1 ? 0 : ti - prev;
      if (ti === 0 || /[\s\-·/.]/.test(text[ti - 1]!)) score -= 2;
      prev = ti;
      qi++;
      run++;
    }
  }
  return qi === query.length ? score - run * 0.2 : null;
}

export type EntryTag = 'query' | 'folder' | 'source' | 'extract' | 'deck' | 'draft' | 'card' | 'command';

export interface Entry {
  key: string;
  title: string;
  /** Where it lives, in small type. */
  sub: string;
  tag: EntryTag;
  /** A vault path or special tab id to open, a card in a document, or a command id. */
  target: { open: string } | { open: string; index: number; id?: string } | { command: string };
}

export interface Command {
  id: string;
  title: string;
}

export const ENTRY_GLYPH: Record<EntryTag, string> = {
  query: '≡', folder: '/', source: '¶', extract: '↳', deck: '◫', draft: '✎', card: '◆', command: '›',
};

/** A card the palette can name, from any document's blocks. */
export interface CardRef {
  path: string;
  index: number;
  id?: string;
  text: string;
}

/** Everything the palette can open: saved queries, folders, documents, cards, commands. */
export function buildIndex(tree: TreeNode[], docs: Record<string, DocInfo>, cards: CardRef[], commands: Command[]): Entry[] {
  const out: Entry[] = [];
  for (const scope of SCOPES) out.push({ key: `q:${scope}`, title: QUEUE_TITLE[scope], sub: 'saved query', tag: 'query', target: { open: queueId(scope) } });
  const title = (path: string) => docs[path]?.title ?? nameOf(path);
  const visit = (nodes: TreeNode[], parent: string) => {
    for (const n of nodes) {
      if (n.kind === 'folder') {
        out.push({ key: `p:${n.path}`, title: n.name, sub: parent || 'folder', tag: 'folder', target: { open: n.path } });
        visit(n.children, n.name);
      } else {
        const tag = docs[n.path]?.type ?? 'source';
        out.push({ key: `p:${n.path}`, title: title(n.path), sub: parent || tag, tag, target: { open: n.path } });
        if (n.children) visit(n.children, title(n.path));
      }
    }
  };
  visit(tree, '');
  for (const c of cards) {
    const target: Entry['target'] = c.id === undefined ? { open: c.path, index: c.index } : { open: c.path, index: c.index, id: c.id };
    out.push({ key: `c:${c.path}:${c.index}`, title: cardLabel(c.text), sub: title(c.path), tag: 'card', target });
  }
  for (const c of commands) out.push({ key: `x:${c.id}`, title: c.title, sub: '', tag: 'command', target: { command: c.id } });
  return out;
}

/** The best forty for a query; the first forty when there is none. */
export function search(index: Entry[], q: string): Entry[] {
  if (!q.trim()) return index.slice(0, 40);
  return index
    .map((it) => ({ it, score: fuzzy(q.trim(), `${it.title} ${it.sub}`) }))
    .filter((r): r is { it: Entry; score: number } => r.score !== null)
    .sort((a, b) => a.score - b.score)
    .slice(0, 40)
    .map((r) => r.it);
}

// ── landing on a card ────────────────────────────────────────────

/**
 * Where a named card is now: its index when that card is still there, else
 * wherever its id went, else -1. A document can change between the naming
 * and the landing.
 */
export function revealIndex(blocks: Block[], at: { index: number; id?: string }): number {
  const b = blocks[at.index];
  if (b?.kind === 'card' && (at.id === undefined || b.id === at.id)) return at.index;
  return at.id === undefined ? -1 : blocks.findIndex((x) => x.kind === 'card' && x.id === at.id);
}
