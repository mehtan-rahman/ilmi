// The shell's pure side: what the bottom strip says for each surface, what
// a card is called in a list, the palette's index and its fuzzy match, and
// what it makes of the search index's hits (milestone 68).
// The components are TopStrip, BottomStrip, Inspector, Palette, Tweaks.

import { cardFields, faceText, findIn, fold, type Block, type CardForm } from '../format/index.js';
import { hayOf, nameOf, searchQuery, type TextHit, type TreeNode } from '../vault/index.js';
import { hasMath, plainMath } from './chromeText.js';
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
  /** A document with pages, open as its pages: the book's own keys apply. */
  pages?: boolean;
  /** The document's prose is locked: bare `e` and `m` act, since nothing is typed there. */
  frozen?: boolean;
  /** The document (or the session's element) is a note, or an extract: what comes back until dismissed, not a book. */
  note?: boolean;
  /** A text source (a clipping, a chapter): `e` marks a section of its note, not an extract (milestone 50). */
  marks?: boolean;
  /** On an iPad: what the mouse does by a drag a finger does after a hold. */
  touch?: boolean;
}

const PALETTE: Hint = ['⌘k', 'palette'];
/** A book's pages: drag a box (again for another), then `e` a section of the notes or `m` a card or a clip. On an iPad a finger's plain drag is the scroll: it boxes after a hold (`touch.ts`). */
const book = (c: HintContext): Hint[] => [[c.touch ? 'hold, drag' : 'drag', 'box a passage'], ['e', 'section'], ['m', 'card']];
/** A book's notes come in over its pages and fold away again: the word over the pages, and this key. */
const NOTES: Hint = ['⌘\\', 'notes'];
const NAV: Hint = ['[ ]', 'prev / next'];

/** Extract and card: bare letters in a frozen page, ⌘⇧ in editable text, where the letters type. */
const selKeys = (frozen: boolean | undefined, extract = true, word = 'extract'): Hint[] => [
  ...(extract ? [[frozen ? 'e' : '⌘⇧E', word] as Hint] : []),
  [frozen ? 'm' : '⌘⇧M', 'card'],
];

/** Only keys that are bound on that surface. */
export function hintsFor(c: HintContext): Hint[] {
  const word = c.marks ? 'section' : 'extract';
  switch (c.kind) {
    case 'queue':
      return c.scope === 'today'
        ? [['⏎', 'enter queue'], ['j k', 'move'], ['o', 'open one'], PALETTE]
        : [['⏎', 'open'], ['j k', 'move'], PALETTE];
    case 'session':
      // the same three everywhere: a book's ⏎ is done for today, everything else's next
      if (c.el === 'read' && c.pages) return [['⏎', c.note ? 'next' : 'done for today'], ['p', 'later'], ['d', 'dismiss'], ...book(c), NOTES, NAV];
      if (c.el === 'read') return [['⏎', c.note ? 'next' : 'done for today'], ['p', 'later'], ['d', 'dismiss'], ...selKeys(c.frozen, true, word), NAV];
      if (c.el === 'section' && c.pages) return [['⏎', 'next'], ['p', 'later'], ['d', 'dismiss'], ...book(c), NOTES, NAV];
      if (c.el === 'section') return [['⏎', 'next'], ['p', 'later'], ['d', 'dismiss'], ...selKeys(c.frozen), NAV];
      if (c.el === 'write') return [['⏎', 'next'], ['p', 'later'], ['d', 'dismiss'], ...selKeys(c.frozen, false), NAV];
      return [['space', 'reveal'], ['1 2 3 4', 'grade'], ['o', 'go to source'], NAV];
    case 'note':
    case 'source':
    case 'extract': {
      const enrol: Hint[] = c.canEnrol ? [['r', c.kind === 'note' ? 'revisit' : 'start reading']] : [];
      if (c.pages) return [...book(c), ...enrol, ['[ ]', 'sections'], ['/', 'search'], NOTES];
      return [...selKeys(c.frozen, true, word), ...enrol, ['⌘F', 'find'], ['⌘\\', 'split pane']];
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

/**
 * A card's name as written: the first blank's answer, a question, or `a ⇄
 * b`; the text when it is not a card. A blank inside a formula (milestone
 * 18) is TeX, so its answer comes back wrapped as `$…$`, to be drawn as math
 * or read as plain text like any other formula in the name (40's window
 * run: `\langle n^0 | H' | n^0 \rangle` showed raw in the inspector).
 */
function rawCardLabel(text: string): string {
  const f = cardFields(text);
  const flat = (s: string) => s.replace(/\s+/g, ' ').trim();
  const answerOf = (b: { answer: string; math?: true }) => (b.math ? (flat(b.answer) ? `$${flat(b.answer)}$` : '') : b.answer);
  if (!f) return flat(text) || 'card';
  if (f.form === 'cloze') {
    const first = f.parts.find((p) => typeof p !== 'string');
    if (first && typeof first !== 'string' && first.answer.trim()) return flat(answerOf(first));
    return flat(f.parts.map((p) => (typeof p === 'string' ? p : p.answer)).join('')) || 'cloze';
  }
  if (f.form === 'qa') return flat(f.front) || 'q&a';
  return `${flat(f.left)} ⇄ ${flat(f.right)}`;
}

/** A card's name as plain text, its formulas read as characters (`⟨n^0 | H' | n^0⟩`), cut at `max`: the palette, the PDF lens's list. */
export function cardLabel(text: string, max = 46): string {
  const f = cardFields(text);
  return clip(plainMath(rawCardLabel(text)), f?.form === 'qa' ? max + 4 : max);
}

/** The name whole with its formulas as `$…$`, for a row that draws them (`MathText`) and cuts by its width. */
export const cardName = (text: string): string => rawCardLabel(text);

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

export type EntryTag = 'query' | 'folder' | 'note' | 'source' | 'extract' | 'deck' | 'draft' | 'card' | 'text' | 'command' | 'vault';

export interface Entry {
  key: string;
  title: string;
  /** Where it lives, in small type. */
  sub: string;
  tag: EntryTag;
  /** The row's name with its formulas as `$…$`, drawn by KaTeX (a card's whole name, cut by the row's width); `title` stays what search reads. */
  math?: string;
  /** Where in `title` what was found is, for a row of text. */
  mark?: [from: number, to: number];
  /** A vault path or special tab id to open, a card in a document, a block of a document, a command id, or another vault to switch to. */
  target: { open: string } | { open: string; index: number; id?: string } | { open: string; block: number } | { command: string } | { vault: string };
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
  query: '≡', folder: GLYPH.folder, note: GLYPH.note, source: GLYPH.source, extract: GLYPH.extract, deck: GLYPH.deck, draft: GLYPH.draft, card: '◆', text: '⌕', command: '›', vault: '⌂',
};

/** Everything the palette can open by name: saved queries, folders, documents, commands, and the other vaults under `vaults`. Cards are found by their words, through the search index. */
export function buildIndex(tree: TreeNode[], docs: Record<string, DocInfo>, commands: Command[], vaults: VaultRef[] = []): Entry[] {
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
  for (const c of commands) out.push({ key: `x:${c.id}`, title: c.title, sub: '', tag: 'command', target: { command: c.id } });
  for (const v of vaults) out.push({ key: `v:${v.path}`, title: v.name, sub: 'collections', tag: 'vault', target: { vault: v.path } });
  return out;
}

/** What a row's name is matched by, folded once: an index is built when the tree changes, not at each key. */
const hays = new WeakMap<Entry, string>();
const hayOfEntry = (it: Entry): string => {
  let hay = hays.get(it);
  if (hay === undefined) hays.set(it, (hay = fold(`${it.title} ${it.sub}`)));
  return hay;
};

/** The best forty for a query; the first forty when there is none. */
export function search(index: Entry[], q: string): Entry[] {
  const query = fold(q.trim());
  if (!query) return index.slice(0, 40);
  return index
    .map((it) => ({ it, score: fuzzy(query, hayOfEntry(it)) }))
    .filter((r): r is { it: Entry; score: number } => r.score !== null)
    .sort((a, b) => a.score - b.score)
    .slice(0, 40)
    .map((r) => r.it);
}

// ── text found ───────────────────────────────────────────────────

const WORD = /[\p{L}\p{N}\p{M}ـ]/u;
/** How much of a row comes before what was found, and in all. */
const LEAD = 18;
const LINE = 120;
/** Rows of text a palette shows, and the loose matches by name that stay above them. */
const TEXT_ROWS = 40;
const LOOSE_FIRST = 4;

/**
 * Text found, best first: the phrase as written before the words apart, a
 * whole word before one inside a longer word (Arabic's prefixes and
 * suffixes are found, but the word itself comes first), then a heading
 * before a card before the rest.
 */
export function rankHits(hits: TextHit[], q: string): TextHit[] {
  const { phrase, words } = searchQuery(q);
  const score = (h: TextHit): number => {
    const hay = hayOf(h.kind === 'card' ? faceText(h.text) : h.text);
    const at = hay.indexOf(phrase);
    const whole = at >= 0 && !WORD.test(hay[at - 1] ?? '') && !WORD.test(hay[at + phrase.length] ?? '');
    return (at >= 0 ? 0 : words.length > 1 ? 8 : 0) + (whole ? 0 : 4) + (h.kind === 'heading' ? 0 : h.kind === 'card' ? 1 : 2);
  };
  return hits.map((h) => ({ h, s: score(h) })).sort((a, b) => a.s - b.s).map((r) => r.h);
}

/**
 * A line of `text` around what was found, and where in it to mark. The
 * mark takes the whole word: a mark that begins inside an Arabic word cuts
 * the word's letters apart when it is drawn. Formulas read as characters;
 * what is found only in a formula's TeX is looked for in the TeX.
 */
export function textLine(text: string, q: string): { line: string; mark?: [number, number] } {
  const { phrase, words } = searchQuery(q);
  const longest = [...words].sort((a, b) => b.length - a.length)[0] ?? '';
  const flat = (s: string): string => s.replace(/\s+/g, ' ').trim();
  const at = (s: string) => findIn(s, phrase)[0] ?? findIn(s, longest)[0];
  let line = flat(plainMath(text));
  let hit = at(line);
  if (!hit) {
    const raw = flat(text);
    const there = at(raw);
    if (there) { line = raw; hit = there; }
  }
  if (!hit) return { line: line.length > LINE ? `${line.slice(0, LINE - 1)}…` : line };
  let { from, to } = hit;
  while (from > 0 && WORD.test(line[from - 1]!)) from--;
  while (to < line.length && WORD.test(line[to]!)) to++;
  let start = Math.max(0, from - LEAD);
  // from the start of a word, when there is one close by
  if (start > 0) { const sp = line.indexOf(' ', start); if (sp >= 0 && sp < from) start = sp + 1; }
  const end = Math.min(line.length, Math.max(start + LINE, to));
  const pre = start > 0 ? '…' : '';
  return { line: `${pre}${line.slice(start, end)}${end < line.length ? '…' : ''}`, mark: [pre.length + from - start, pre.length + to - start] };
}

/** A palette's row for a block found. A card is named as a card is; prose is the line it was found in. */
export function textEntry(h: TextHit, q: string, docs: Record<string, DocInfo>): Entry {
  const sub = docs[h.path]?.title ?? slugName(nameOf(h.path));
  if (h.kind === 'card') {
    const name = cardName(h.text);
    return { key: `c:${h.path}:${h.block}`, title: cardLabel(h.text), ...(hasMath(name) ? { math: name } : {}), sub, tag: 'card', target: h.card === null ? { open: h.path, index: h.block } : { open: h.path, index: h.block, id: h.card } };
  }
  const { line, mark } = textLine(h.text, q);
  return { key: `t:${h.path}:${h.block}`, title: line, ...(mark ? { mark } : {}), sub, tag: 'text', target: { open: h.path, block: h.block } };
}

/** Names that hold the query as typed, a few looser ones, the text found, then the rest of the names. */
export function withText(names: Entry[], text: Entry[], q: string): Entry[] {
  const query = fold(q.trim());
  const close = names.filter((it) => hayOfEntry(it).includes(query));
  const loose = names.filter((it) => !hayOfEntry(it).includes(query));
  return [...close, ...loose.slice(0, LOOSE_FIRST), ...text.slice(0, TEXT_ROWS), ...loose.slice(LOOSE_FIRST)];
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
