// The shell's pure side: what the bottom strip says for each surface, what
// a card is called in a list, the palette's index and its fuzzy match.
// The components are TopStrip, BottomStrip, Inspector, Palette, Tweaks.

import { cardFields, type Block, type CardForm } from '../format/index.js';
import { nameOf, type TreeNode } from '../vault/index.js';
import { FORM_LABEL } from './items.js';
import { GLYPH, QUEUE_TITLE, slugName, SCOPES, queueId, type QueueScope, type TabKind } from './names.js';
import type { DocInfo, El } from './store.js';
import { notebookTrail } from './tabs.js';

// ── key hints ────────────────────────────────────────────────────

export type Hint = [keys: string, what: string];

export interface HintContext {
  kind: TabKind | undefined;
  /** What the session is on, when the tab is the session. */
  el: El | null;
  /** The saved query's scope, when the tab is one. */
  scope: QueueScope | null;
  /** A note, source, or extract not yet enrolled in reading. */
  canEnrol: boolean;
  /** A source open as pages: the PDF lens's own keys apply. */
  pages?: boolean;
  /** The document's prose is locked: bare `e` and `m` act, since nothing is typed there. */
  frozen?: boolean;
  /** The document (or the session's element) is a note. */
  note?: boolean;
}

const PALETTE: Hint = ['⌘k', 'palette'];
const NAV: Hint = ['[ ]', 'prev / next'];

/** Extract and card: bare letters in a frozen page, ⌘⇧ in editable text, where the letters type. */
const selKeys = (frozen: boolean | undefined, extract = true): Hint[] => [
  ...(extract ? [[frozen ? 'e' : '⌘⇧E', 'extract'] as Hint] : []),
  [frozen ? 'm' : '⌘⇧M', 'card'],
];

/** Only keys that are bound on that surface. */
export function hintsFor(c: HintContext): Hint[] {
  switch (c.kind) {
    case 'queue':
      return c.scope === 'today'
        ? [['⏎', 'enter queue'], ['j k', 'move'], ['o', 'open one'], PALETTE]
        : [['⏎', 'open'], ['j k', 'move'], PALETTE];
    case 'session':
      if (c.el === 'read') return [['⏎', c.note ? 'went over it' : 'read on'], ['p', 'postpone'], ['d', 'done'], ...selKeys(c.frozen || c.pages), NAV];
      if (c.el === 'write') return [['⏎', 'worked on it'], ['p', 'postpone'], ['d', 'done'], ...selKeys(c.frozen, false), NAV];
      return [['space', 'reveal'], ['1 2 3 4', 'grade'], NAV];
    case 'note':
    case 'source':
    case 'extract': {
      const enrol: Hint[] = c.canEnrol ? [['r', c.kind === 'note' ? 'revisit' : 'start reading']] : [];
      if (c.pages) return [['e', 'extract'], ['m', 'card'], ['⏎', 'jump'], ...enrol, ['/', 'search'], ['g', 'page'], ['[ ]', 'pages']];
      return [...selKeys(c.frozen), ...enrol, ['⌘F', 'find'], ['⌘\\', 'split pane']];
    }
    case 'draft':
      return [...selKeys(c.frozen, false), ['⌘F', 'find'], ['esc', 'leave the text']];
    case 'deck':
      return [['j k', 'move'], ['⏎', 'edit'], ['/', 'search'], ['⌫', 'delete'], ['m', 'card'], PALETTE];
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

export type EntryTag = 'query' | 'folder' | 'note' | 'source' | 'extract' | 'deck' | 'draft' | 'card' | 'command' | 'vault';

export interface Entry {
  key: string;
  title: string;
  /** Where it lives, in small type. */
  sub: string;
  tag: EntryTag;
  /** A vault path or special tab id to open, a card in a document, a command id, or another vault to switch to. */
  target: { open: string } | { open: string; index: number; id?: string } | { command: string } | { vault: string };
}

export interface Command {
  id: string;
  title: string;
}

/** Another vault the palette can switch to: a recent one, by its directory. */
export interface VaultRef {
  path: string;
  name: string;
}

export const ENTRY_GLYPH: Record<EntryTag, string> = {
  // the kinds' marks are the tree's (`GLYPH`), so the palette and the sidebar agree
  query: '≡', folder: GLYPH.folder, note: GLYPH.note, source: GLYPH.source, extract: GLYPH.extract, deck: GLYPH.deck, draft: GLYPH.draft, card: '◆', command: '›', vault: '⌂',
};

/** A card the palette can name, from any document's blocks. */
export interface CardRef {
  path: string;
  index: number;
  id?: string;
  text: string;
}

/** Everything the palette can open: saved queries, folders, documents, cards, commands, and the other vaults under `vaults`. */
export function buildIndex(tree: TreeNode[], docs: Record<string, DocInfo>, cards: CardRef[], commands: Command[], vaults: VaultRef[] = []): Entry[] {
  const out: Entry[] = [];
  for (const scope of SCOPES) out.push({ key: `q:${scope}`, title: QUEUE_TITLE[scope], sub: 'saved query', tag: 'query', target: { open: queueId(scope) } });
  const title = (path: string) => docs[path]?.title ?? slugName(nameOf(path));
  const visit = (nodes: TreeNode[], parent: string) => {
    for (const n of nodes) {
      if (n.kind === 'folder') {
        out.push({ key: `p:${n.path}`, title: n.name, sub: notebookTrail(tree, n.path, docs, null) ?? (parent || 'folder'), tag: 'folder', target: { open: n.path } });
        visit(n.children, n.name);
      } else {
        const tag = docs[n.path]?.type ?? 'note';
        // a tab is indexed under its notebook: `linear algebra › unit-2`
        out.push({ key: `p:${n.path}`, title: title(n.path), sub: notebookTrail(tree, n.path, docs, null) ?? (parent || tag), tag, target: { open: n.path } });
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
  for (const v of vaults) out.push({ key: `v:${v.path}`, title: v.name, sub: 'collections', tag: 'vault', target: { vault: v.path } });
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
