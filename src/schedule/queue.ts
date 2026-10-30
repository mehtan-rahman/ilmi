// The queue: a query over a vault for what is due. Cards (one item per cloze
// group, everything else one item), reading topics (documents with `read:`),
// and writing drafts (documents with `write:` not done). What is due sorts by
// priority, then due, then document order, the way SuperMemo sorts its
// outstanding queue; what is not due yet sorts by due, then priority. Nothing
// here is stored; `gradeItem` is the one mutation, and it rewrites one
// schedule line.

import {
  PRI_DEFAULT, blanks, cardForm, clozeParts, meta, nextGroup,
  type Card, type CardForm, type CardSchedule, type Doc, type ReadSchedule, type WriteSchedule,
} from '../format/index.js';
import type { Vault } from '../vault/index.js';
import { grade, type Grade } from './card.js';
import { whenToDate } from './dates.js';
import { advanceRead } from './read.js';
import { advanceWrite } from './write.js';

/** A numbered cloze group, or the index of an unnumbered blank in `blanks(text)` order. */
export type GroupKey = { n: number } | { blank: number };

interface ItemBase {
  path: string;
  /** The stored due, day or instant; absent means due now. */
  due?: string;
  dueAt: Date;
  /** 0–100, lower first: the document's `pri` field, a card's own `pri`, else 50. */
  pri: number;
}

export interface CardItem extends ItemBase {
  kind: 'card';
  /** Index into `doc.blocks` when the queue was built. */
  block: number;
  id?: string;
  form: CardForm;
  text: string;
  /** Nearest heading above the card. */
  section?: string;
  /** The headings the card sits under, outermost first: `section` is the last. */
  trail?: string[];
  /** The schedule that applies to this item; absent for a new card. */
  sched?: CardSchedule;
  /** Present on cloze cards. */
  group?: GroupKey;
  /** How many groups the card has; more than one means this item is one blank of several. */
  groups: number;
}

export interface ReadItem extends ItemBase {
  kind: 'read';
  sched: ReadSchedule;
  pos: number;
  total: number;
  /** Text of the next unread prose block, for a row to show. */
  next?: string;
  /** On a document with pages: the page the ruler is on (`pos`), when it is on one. */
  page?: number;
  /** A note revisited: no marker, each pass from the top. */
  note?: true;
}

export interface WriteItem extends ItemBase {
  kind: 'write';
  sched: WriteSchedule;
  /** Text of the first paragraph, for a row to show. */
  lead?: string;
}

export type QueueItem = CardItem | ReadItem | WriteItem;

export type Scope = 'all' | 'today' | 'upcoming' | 'reading' | 'writing' | 'cards';

export const isDue = (item: QueueItem, now: Date): boolean => item.dueAt <= now;

// ── cards ────────────────────────────────────────────────────────

/** The groups a card tests, in order of first appearance. Non-cloze cards have none. */
export function cardGroups(text: string): GroupKey[] {
  const out: GroupKey[] = [];
  const seen = new Set<number>();
  blanks(text).forEach((b, i) => {
    if (b.n === null) out.push({ blank: i });
    else if (!seen.has(b.n)) { seen.add(b.n); out.push({ n: b.n }); }
  });
  return out;
}

/** The schedule that applies to a group: its own line, else the card's bare line. */
function groupSchedule(card: Card, group: GroupKey | undefined): CardSchedule | undefined {
  if (group && 'n' in group && card.blanks?.[group.n]) return card.blanks[group.n];
  return card.sched;
}

/**
 * Whether a group (or the whole card, with no group) is suspended: `sus=1`
 * on the card's bare line suspends every group, on a group's line that
 * group alone (FORMAT.md §6.2).
 */
export function isSuspended(card: Card, group?: GroupKey): boolean {
  if (card.sched?.suspended) return true;
  return !!(group && 'n' in group && card.blanks?.[group.n]?.suspended);
}

function withDue(sched: { due?: string } | undefined, now: Date): { due?: string; dueAt: Date } {
  return sched?.due ? { due: sched.due, dueAt: whenToDate(sched.due) } : { dueAt: now };
}

function cardItems(path: string, block: number, card: Card, trail: readonly string[], docPri: number, now: Date): CardItem[] {
  const section = trail[trail.length - 1];
  const form = cardForm(card.text);
  if (!form) return [];
  const groups = form === 'cloze' ? cardGroups(card.text) : [];
  // the card's own priority sits on its bare line, whichever group is up
  const pri = card.sched?.pri ?? docPri;
  const one = (group: GroupKey | undefined): CardItem => {
    const sched = groupSchedule(card, group);
    const when = withDue(sched, now);
    const item: CardItem = {
      kind: 'card', path, block, form, text: card.text, groups: Math.max(groups.length, 1),
      ...when, pri,
    };
    if (card.id !== undefined) item.id = card.id;
    if (section !== undefined) { item.section = section; item.trail = [...trail]; }
    if (sched) item.sched = sched;
    if (group) item.group = group;
    return item;
  };
  // a suspended card, or blank, keeps its schedule and leaves the queue, the session, and the counts
  return (groups.length ? groups : [undefined]).filter((g) => !isSuspended(card, g)).map(one);
}

// ── documents ────────────────────────────────────────────────────

/** Every item one document contributes, in document order. */
export function docItems(path: string, doc: Doc, now: Date): QueueItem[] {
  const out: QueueItem[] = [];
  const m = meta(doc);
  const prose = doc.blocks.filter((b) => b.kind !== 'card');
  // a `pri=` left on a read / write line stands in for that loop until the field exists
  const docPri = m.pri ?? PRI_DEFAULT;
  if (m.read) {
    const total = prose.length;
    // on a document with pages, `pos` is a page and is not held to the prose count; a note has none
    const note = m.type === 'note';
    const pos = note ? 0 : m.pdf !== undefined ? m.read.pos ?? 0 : Math.min(m.read.pos ?? 0, total);
    const item: ReadItem = { kind: 'read', path, sched: m.read, pos, total, ...withDue(m.read, now), pri: m.pri ?? m.read.pri ?? PRI_DEFAULT };
    const next = prose[Math.min(pos, total - 1)];
    if (next && next.text.trim()) item.next = next.text;
    if (m.pdf !== undefined && pos > 0) item.page = pos;
    if (note) item.note = true;
    out.push(item);
  }
  if (m.write && !m.write.done) {
    const item: WriteItem = { kind: 'write', path, sched: m.write, ...withDue(m.write, now), pri: m.pri ?? m.write.pri ?? PRI_DEFAULT };
    const lead = prose.find((b) => b.kind === 'paragraph' && b.text.trim()) ?? prose.find((b) => b.text.trim());
    if (lead) item.lead = lead.text;
    out.push(item);
  }
  // the headings over each card, by level: a heading closes every one at its level or deeper
  const open: { level: number; text: string }[] = [];
  doc.blocks.forEach((b, i) => {
    if (b.kind === 'heading') {
      while (open.length && open[open.length - 1]!.level >= b.level) open.pop();
      open.push({ level: b.level, text: b.text });
    } else if (b.kind === 'card') out.push(...cardItems(path, i, b, open.map((h) => h.text), docPri, now));
  });
  return out;
}

/**
 * In place. What is due comes first, by priority, then due; what is not due
 * yet follows, by due, then priority. A stable sort keeps document order
 * after that.
 */
export function sortQueue(items: QueueItem[], now: Date): QueueItem[] {
  return items.sort((a, b) => {
    const da = isDue(a, now);
    const db = isDue(b, now);
    if (da !== db) return da ? -1 : 1;
    const due = a.dueAt.getTime() - b.dueAt.getTime();
    return da ? a.pri - b.pri || due : due || a.pri - b.pri;
  });
}

/** All items over a set of documents, sorted. */
export function queueItems(docs: Iterable<[string, Doc]>, now: Date): QueueItem[] {
  const out: QueueItem[] = [];
  for (const [path, doc] of docs) out.push(...docItems(path, doc, now));
  return sortQueue(out, now);
}

/** The same element: one card group, or one document's reading or writing. */
export function sameItem(a: QueueItem, b: QueueItem): boolean {
  if (a.kind !== b.kind || a.path !== b.path) return false;
  if (a.kind !== 'card' || b.kind !== 'card') return true;
  const same = a.id !== undefined && b.id !== undefined ? a.id === b.id : a.block === b.block && a.text === b.text;
  return same && JSON.stringify(a.group ?? null) === JSON.stringify(b.group ?? null);
}

export function inScope(item: QueueItem, scope: Scope, now: Date): boolean {
  switch (scope) {
    case 'all': return true;
    case 'today': return isDue(item, now);
    case 'upcoming': return !isDue(item, now);
    case 'reading': return item.kind === 'read';
    case 'writing': return item.kind === 'write';
    case 'cards': return item.kind === 'card';
  }
}

/** The queue over a whole vault. Reads every document through the vault's cache. */
export async function queue(vault: Vault, now: Date, scope: Scope = 'all'): Promise<QueueItem[]> {
  const docs: [string, Doc][] = [];
  for (const path of vault.documents()) docs.push([path, (await vault.read(path)).doc]);
  return queueItems(docs, now).filter((i) => inScope(i, scope, now));
}

// ── the fold ─────────────────────────────────────────────────────

export interface Fold { above: QueueItem[]; below: QueueItem[] }

/**
 * A day's sorted queue split at the budget: the first `n` items and the
 * rest. A budget of 0 (or less) is no budget: everything is above.
 */
export function fold(items: QueueItem[], n: number): Fold {
  if (n <= 0 || items.length <= n) return { above: items, below: [] };
  return { above: items.slice(0, n), below: items.slice(n) };
}

/**
 * The reading and writing due now that fall below the fold, lowest priority
 * first. Cards are never here: FSRS folds their lateness into the next
 * grade, so the app only orders them.
 */
export function overflow(items: QueueItem[], now: Date, budget: number): (ReadItem | WriteItem)[] {
  const due = sortQueue(items.filter((i) => isDue(i, now)), now);
  return fold(due, budget).below
    .filter((i): i is ReadItem | WriteItem => i.kind !== 'card')
    .sort((a, b) => b.pri - a.pri);
}

/**
 * Postpone everything `overflow` names, one file at a time, each through
 * `vault.update`, so each rewrites its own `read` or `write` line and
 * nothing else. Resolves to what was postponed.
 */
export async function postponeOverflow(vault: Vault, items: QueueItem[], now: Date, budget: number): Promise<(ReadItem | WriteItem)[]> {
  const rest = overflow(items, now, budget);
  for (const item of rest) {
    await vault.update(item.path, (doc) => {
      if (item.kind === 'read') advanceRead(doc, 'postpone', now);
      else advanceWrite(doc, 'postpone', now);
    });
  }
  return rest;
}

export interface Counts { today: number; upcoming: number; cards: number; reading: number; writing: number }

export function counts(items: QueueItem[], now: Date): Counts {
  const n = (scope: Scope) => items.filter((i) => inScope(i, scope, now)).length;
  return { today: n('today'), upcoming: n('upcoming'), cards: n('cards'), reading: n('reading'), writing: n('writing') };
}

// ── grading ──────────────────────────────────────────────────────

const ID_CHARS = 'abcdefghijklmnopqrstuvwxyz0123456789';

/** A fresh block id: `c` and six random characters. */
export function newId(): string {
  let s = 'c';
  for (let i = 0; i < 6; i++) s += ID_CHARS[Math.floor(Math.random() * ID_CHARS.length)];
  return s;
}

function usedIds(doc: Doc): Set<string> {
  const ids = new Set<string>();
  for (const b of doc.blocks) if ((b.kind === 'card' || b.kind === 'paragraph') && b.id) ids.add(b.id);
  return ids;
}

/** The item's card in `doc`: by id when it has one, else by position and text. */
function locate(doc: Doc, item: CardItem): Card {
  const at = doc.blocks[item.block];
  if (at?.kind === 'card' && (item.id !== undefined ? at.id === item.id : at.text === item.text)) return at;
  if (item.id !== undefined) {
    const hit = doc.blocks.find((b): b is Card => b.kind === 'card' && b.id === item.id);
    if (hit) return hit;
  }
  throw new Error(`${item.path}: card ${item.id ?? `#${item.block}`} not found`);
}

/** `{{x}}` → `{{cN::x}}` for the blank at `index` in `blanks(text)` order. */
export function numberBlank(text: string, index: number, n: number): string {
  let i = 0;
  return clozeParts(text)
    .map((p) => (typeof p === 'string' ? p : i++ === index ? `{{c${n}::${p.answer}}}` : p.raw))
    .join('');
}

export interface GradeOptions {
  /** Id generator, for tests. */
  newId?: () => string;
}

/**
 * Grade a queue item in place. Assigns the card an id if it has none, numbers
 * an unnumbered blank on a multi-blank card, and rewrites exactly one
 * schedule line: the group's `sr cN` line, or the bare `sr` line for a
 * single-item card. Meant to run inside `vault.update`.
 */
export function gradeItem(doc: Doc, item: CardItem, rating: Grade, now: Date, opts: GradeOptions = {}): CardSchedule {
  const card = locate(doc, item);
  if (card.id === undefined) {
    const taken = usedIds(doc);
    const gen = opts.newId ?? newId;
    let id = gen();
    while (taken.has(id)) id = gen();
    card.id = id;
  }
  let group = item.group;
  if (group && 'blank' in group && item.groups > 1) {
    const n = nextGroup(card.text);
    card.text = numberBlank(card.text, group.blank, n);
    group = { n };
  }
  const own = group && 'n' in group && (item.groups > 1 || card.blanks?.[group.n] !== undefined) ? group.n : null;
  const next = grade(own === null ? card.sched : card.blanks?.[own] ?? card.sched, rating, now);
  if (own === null) card.sched = next;
  else card.blanks = { ...card.blanks, [own]: next };
  return next;
}
