// The shell's pure side: what the bottom strip says for each surface, what
// a card is called in a list, the palette's index and how near a name is to what was typed, and
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
  /** A book whose jumps left somewhere to go back to (milestone 76): `⌫ back` is said only then. */
  back?: boolean;
}

const PALETTE: Hint = ['⌘k', 'palette'];
/** A book's pages: drag a box (again for another), then `e` a passage of the notes or `m` a card or a clip. On an iPad a finger's plain drag is the scroll: it boxes after a hold (`touch.ts`). */
const book = (c: HintContext): Hint[] => [[c.touch ? 'hold, drag' : 'drag', 'box'], ['e', 'passage'], ['m', 'card']];
/** A book's notes come in over its pages and fold away again: the word over the pages, and this key. */
const NOTES: Hint = ['⌘\\', 'notes'];
/** Getting around a book and what is left on its pages (milestones 76, 77). */
const MARKS: Hint[] = [['t', 'contents'], ['f', 'links'], ['b', 'bookmark'], ['h', 'highlight'], ['v', 'ruler']];
const NAV: Hint = ['[ ]', 'prev / next'];
/** A book with somewhere to go back to. */
const back = (c: HintContext): Hint[] => (c.back ? [['⌫', 'back']] : []);

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
        ? [['⏎', 'enter queue'], ['j k', 'move'], ['o', 'open one'], ['f', 'focus'], PALETTE]
        : [['⏎', 'open'], ['j k', 'move'], PALETTE];
    case 'session':
      // the same three everywhere: a book's ⏎ is done for today, everything else's next
      if (c.el === 'read' && c.pages) return [['⏎', c.note ? 'next' : 'done for today'], ['p', 'later'], ['d', 'dismiss'], ...book(c), ...back(c), NOTES, NAV];
      if (c.el === 'read') return [['⏎', c.note ? 'next' : 'done for today'], ['p', 'later'], ['d', 'dismiss'], ...selKeys(c.frozen, true, word), NAV];
      if (c.el === 'section' && c.pages) return [['⏎', 'next'], ['p', 'later'], ['d', 'dismiss'], ...book(c), ...back(c), NOTES, NAV];
      if (c.el === 'section') return [['⏎', 'next'], ['p', 'later'], ['d', 'dismiss'], ...selKeys(c.frozen), NAV];
      if (c.el === 'write') return [['⏎', 'next'], ['p', 'later'], ['d', 'dismiss'], ...selKeys(c.frozen, false), NAV];
      return [['space', 'reveal'], ['1 2 3 4', 'grade'], ['s', 'suspend'], ['o', 'go to source'], NAV];
    case 'note':
    case 'source':
    case 'extract': {
      const enrol: Hint[] = c.canEnrol ? [['r', c.kind === 'note' ? 'revisit' : 'start reading']] : [];
      // the rest of a book's keys after the ones it had: a narrow window cuts them off, `docs/keys.md` has them all
      if (c.pages) return [...book(c), ...enrol, ['[ ]', 'passages'], ['/', 'search'], ...back(c), NOTES, ...(c.touch ? [] : MARKS)];
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

/** Where a word starts: the start, or after a space or a mark that parts names (`a-b`, `a · b`, `a/b`, `a.b`, `a › b`). */
const SEP = /[\s\-·/._›:,()]/;
/** The letters a loose match may pass over between two it takes, inside a word. */
const GAP_MAX = 2;

/**
 * A loose match, for a name typed short or with a letter missing: every
 * character of `query` in order in `text`, each one right after the one
 * before it, at the start of a word (`qm` is `quantum mechanics`, `linalg`
 * `linear algebra`), or a letter or two further on (`quntum`). Lower is
 * better: a word jumped to costs 1, a letter passed over 2, a start inside
 * a word 2. Null when it does not match, or matches only by more of that
 * than half its length allows, unless every letter starts a word: letters
 * spread over a long name are no match (`unit` in `quantum … integrals`).
 * Empty query matches everything at 0.
 */
export function fuzzy(query: string, text: string): number | null {
  query = query.toLowerCase();
  text = text.toLowerCase();
  if (!query) return 0;
  const n = text.length;
  // most names do not hold the letters in order at all: said by one pass, before anything is weighed (a palette over
  // ten thousand names asks this of each at every key)
  let from = 0;
  for (let qi = 0; qi < query.length; qi++) {
    from = text.indexOf(query[qi]!, from) + 1;
    if (from === 0) return null;
  }
  const starts = Array.from({ length: n }, (_, i) => i === 0 || SEP.test(text[i - 1]!));
  // the cheapest way to have taken the query so far with its last character at each place, and whether every one began a word
  let cost: number[] = new Array<number>(n).fill(Infinity);
  let initials: boolean[] = new Array<boolean>(n).fill(false);
  for (let i = 0; i < n; i++) if (text[i] === query[0]) { cost[i] = starts[i] ? 0 : 2; initials[i] = starts[i]!; }
  for (let qi = 1; qi < query.length; qi++) {
    const next: number[] = new Array<number>(n).fill(Infinity);
    const nextInit: boolean[] = new Array<boolean>(n).fill(false);
    // the cheapest place before each one, for a jump to a word's start
    let best = Infinity;
    let bestInit = false;
    for (let i = 0; i < n; i++) {
      if (text[i] === query[qi]) {
        const take = (c: number, init: boolean) => { if (c < next[i]! || (c === next[i] && init && !nextInit[i])) { next[i] = c; nextInit[i] = init; } };
        if (i > 0 && cost[i - 1]! < Infinity) take(cost[i - 1]!, false);
        if (starts[i] && best < Infinity) take(best + 1, bestInit);
        for (let g = 1; g <= GAP_MAX && i - 1 - g >= 0; g++) if (cost[i - 1 - g]! < Infinity) take(cost[i - 1 - g]! + 2 * g, false);
      }
      if (cost[i]! < best || (cost[i] === best && initials[i] && !bestInit)) { best = cost[i]!; bestInit = initials[i]!; }
    }
    cost = next;
    initials = nextInit;
  }
  const bound = Math.max(1, Math.floor(query.length / 2));
  let found: number | null = null;
  for (let i = 0; i < n; i++) {
    const c = cost[i]!;
    if (c === Infinity || (c > bound && !initials[i])) continue;
    if (found === null || c < found) found = c;
  }
  return found === null ? null : found - query.length * 0.2;
}

export type EntryTag = 'query' | 'folder' | 'note' | 'source' | 'extract' | 'deck' | 'draft' | 'card' | 'text' | 'command' | 'vault' | 'place';

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
  /** A place in a book (its contents): how deep in the outline, its page, and whether it holds the place in view. */
  depth?: number;
  page?: number;
  here?: boolean;
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
  query: '≡', folder: GLYPH.folder, note: GLYPH.note, source: GLYPH.source, extract: GLYPH.extract, deck: GLYPH.deck, draft: GLYPH.draft, card: '◆', text: '⌕', command: '›', vault: '⌂', place: '§',
};

/** A book's contents as the palette's rows (milestone 76): each entry a place, in the outline's order, the one that holds the place in view said so. `⏎` on one is the command `toc:<its index>`. */
export function contentsRows(entries: readonly { title: string; depth: number; page: number }[], here: number): Entry[] {
  return entries.map((e, i) => ({ key: `toc:${i}`, title: e.title, sub: '', tag: 'place' as const, depth: e.depth, page: e.page, ...(i === here ? { here: true } : {}), target: { command: `toc:${i}` } }));
}

/** The contents narrowed by what was typed, by the palette's own ranking; with nothing typed, every entry in the book's order (not the first forty). */
/** Places left in books as the palette's rows (milestone 77: bookmarks, highlights, marks): each its name, where it is in small type, its page at the right. `⏎` on one is the command `mk:<its index>`. */
export function placeRows(places: readonly { title: string; sub: string; page: number }[]): Entry[] {
  return places.map((p, i) => ({ key: `mk:${i}`, title: p.title, sub: p.sub, tag: 'place' as const, page: p.page, target: { command: `mk:${i}` } }));
}
export function searchContents(rows: Entry[], q: string): Entry[] {
  return q.trim() ? search(rows, q) : rows;
}

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

/** What a row is matched by, folded once: an index is built when the tree changes, not at each key. */
interface Hay { title: string; sub: string; all: string }
const hays = new WeakMap<Entry, Hay>();
const hayOfEntry = (it: Entry): Hay => {
  let hay = hays.get(it);
  if (hay === undefined) {
    const title = fold(it.title);
    const sub = fold(it.sub);
    hays.set(it, (hay = { title, sub, all: `${title} ${sub}` }));
  }
  return hay;
};

/** `query` begins a word of `text`. */
function startsWord(text: string, query: string): boolean {
  for (let at = text.indexOf(query); at >= 0; at = text.indexOf(query, at + 1)) if (at === 0 || SEP.test(text[at - 1]!)) return true;
  return false;
}

/**
 * How near a row is to what was typed, lower nearer, null when it is not
 * it: named exactly that; its name begins with it; a word of its name
 * does; its name holds it; where it lives does; the words typed are all
 * there, apart; then a loose match of its name (`fuzzy`).
 */
function nearness(hay: Hay, query: string, words: string[]): [tier: number, cost: number] | null {
  if (hay.title === query) return [0, 0];
  if (hay.title.startsWith(query)) return [1, 0];
  if (startsWord(hay.title, query)) return [2, 0];
  if (hay.title.includes(query)) return [3, 0];
  if (hay.all.includes(query)) return [4, 0];
  if (words.length > 1 && words.every((w) => hay.all.includes(w))) return [5, 0];
  const loose = fuzzy(query, hay.title);
  return loose === null ? null : [6, loose];
}

/** The best forty for a query, nearest first (`nearness`), rows as near as each other in the index's order; the first forty when there is none. */
export function search(index: Entry[], q: string): Entry[] {
  const query = fold(q.trim());
  if (!query) return index.slice(0, 40);
  const words = query.split(/\s+/).filter(Boolean);
  return index
    .map((it, at) => ({ it, at, near: nearness(hayOfEntry(it), query, words) }))
    .filter((r): r is { it: Entry; at: number; near: [number, number] } => r.near !== null)
    .sort((a, b) => a.near[0] - b.near[0] || a.near[1] - b.near[1] || a.at - b.at)
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
  const close = names.filter((it) => hayOfEntry(it).all.includes(query));
  const loose = names.filter((it) => !hayOfEntry(it).all.includes(query));
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
