// The queue: a query over a vault for what is due. Cards (one item per cloze
// group, everything else one item), reading topics (documents with `read:`),
// sections that come back (a heading's `<!-- read … -->` line), and
// writing drafts (documents with `write:` not done). What is due sorts by
// the day's key (a draw around its priority, seeded by the item and the
// day, `growth.ts`), then stored due, then document order, so the top holds
// and the middle mixes, reshuffled each day; what is not due yet sorts by
// due, then priority. Nothing here is stored; `gradeItem` is the one
// mutation, and it rewrites one schedule line.

import {
  PRI_DEFAULT, blanks, cardForm, clozeParts, meta, nextGroup,
  type Card, type CardForm, type CardSchedule, type Doc, type ReadSchedule, type SectionSchedule, type WriteSchedule,
} from '../format/index.js';
import type { Vault } from '../vault/index.js';
import { grade, type Grade } from './card.js';
import { becomesLeech } from './options.js';
import { capForExam, lineKey, type ExamAt } from './exams.js';
import type { Exam, LeechAction } from '../format/index.js';
import { addDays, dayOf, dayStart, whenToDate } from './dates.js';
import { sampleKey } from './growth.js';
import { advanceRead } from './read.js';
import { advanceWrite } from './write.js';
import { advanceSection, sectionInQueue, sectionState } from './section.js';
import { buryLinked, cardsById } from './links.js';

/** A numbered cloze group, or the index of an unnumbered blank in `blanks(text)` order. */
export type GroupKey = { n: number } | { blank: number };

/** A both-ways card's direction: `f` front to back (its bare line), `r` back to front (its `sr r` line). FORMAT.md §6.2. */
export type Dir = 'f' | 'r';

interface ItemBase {
  path: string;
  /** The stored due, day or instant; absent means due now. */
  due?: string;
  dueAt: Date;
  /** 0–100, lower first: the document's `pri` field, a card's own `pri`, else 50. */
  pri: number;
  /** The exam ahead it is studied toward (`exams.ts`), when it sits under one. */
  exam?: ExamAt;
  /**
   * Brought before the exam: a review FSRS put after it, or a reading paced
   * to be finished in time; `dueAt` is the day it is brought to, this the
   * stored due. Nothing on disk says so.
   */
  pulled?: string;
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
  /** On a both-ways card: the direction this item asks. */
  dir?: Dir;
  /**
   * Its sibling (the other direction) is shown today, or was reviewed today:
   * held back until the next day (`dueAt` is then the next day's start).
   * Nothing on disk says so (FORMAT.md §6.2, siblings).
   */
  buried?: true;
  /**
   * Over the day's allowance (`options.ts`): a new card past `new-per-day`,
   * a review past `reviews-per-day`. Held until the next day as `buried` is;
   * nothing on disk says so.
   */
  held?: 'new' | 'reviews';
  /**
   * The id of the card this one is linked to (`link=` on the bare line,
   * FORMAT.md §6.2), on the item that asks the bare line: one of the two is
   * shown a day (`buryLinked`), and a grade is written to both.
   */
  link?: string;
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
  /** A document read by its pages: `pos` is a page, and what is left is not counted. */
  pdf?: true;
  /** An extract: it comes back as a section does, and says where it stands in the same words. */
  extract?: true;
  /** On a note revisited or an extract: anything written in it, and its cards. */
  written?: boolean;
  cards?: number;
}

export interface WriteItem extends ItemBase {
  kind: 'write';
  sched: WriteSchedule;
  /** Text of the first paragraph, for a row to show. */
  lead?: string;
}

/**
 * A section that comes back (FORMAT.md §6.5): the heading at `block` and
 * what is under it, to the next heading of its level or higher.
 */
export interface SectionItem extends ItemBase {
  kind: 'section';
  /** Index of its heading in `doc.blocks` when the queue was built. */
  block: number;
  heading: string;
  level: number;
  /** The headings over it, outermost first, its own last. */
  trail: string[];
  sched: SectionSchedule;
  /** Anything written under the heading, and its cards: where it stands. */
  written: boolean;
  cards: number;
}

export type QueueItem = CardItem | ReadItem | WriteItem | SectionItem;

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

/**
 * The schedule that applies to a group: its own line, else the card's bare
 * line; to a both-ways card's reverse its `sr r` line alone (absent: new).
 */
export function scheduleOf(card: Card, group: GroupKey | undefined, dir?: Dir): CardSchedule | undefined {
  if (dir === 'r') return card.reverse;
  if (group && 'n' in group && card.blanks?.[group.n]) return card.blanks[group.n];
  return card.sched;
}

/**
 * Whether a group (or the whole card, with no group) is suspended: `sus=1`
 * on the card's bare line suspends every group and both directions, on a
 * group's line that group alone, on the `sr r` line the reverse alone
 * (FORMAT.md §6.2).
 */
export function isSuspended(card: Card, group?: GroupKey, dir?: Dir): boolean {
  if (card.sched?.suspended) return true;
  if (dir === 'r') return !!card.reverse?.suspended;
  return !!(group && 'n' in group && card.blanks?.[group.n]?.suspended);
}

/** The directions a card is asked in: both for a both-ways card, else none. */
export const cardDirs = (form: CardForm | null): Dir[] => (form === 'bidir' ? ['f', 'r'] : []);

/** The priority a direction is studied at: the reverse's own, else the card's (its bare line), else the document's. */
export function dirPri(card: Card, dir: Dir | undefined, docPri: number): number {
  return (dir === 'r' ? card.reverse?.pri : undefined) ?? card.sched?.pri ?? docPri;
}

/** Was this schedule last graded on `now`'s local day? */
const seenToday = (s: CardSchedule | undefined, now: Date): boolean =>
  !!s?.last && dayOf(whenToDate(s.last)) === dayOf(now);

/**
 * The two directions of one both-ways card, siblings: not both on one day.
 * When both are due, the one due first (the forward on a tie) stays and the
 * other is buried until the next day; when one was reviewed today, the
 * other is buried. In place.
 */
export function burySiblings(pair: CardItem[], now: Date): void {
  const due = pair.filter((i) => i.dueAt <= now);
  if (!due.length) return;
  const tomorrow = dayStart(addDays(dayOf(now), 1));
  const bury = (i: CardItem) => { i.buried = true; i.dueAt = tomorrow; };
  const [f, r] = [pair.find((i) => i.dir === 'f'), pair.find((i) => i.dir === 'r')];
  if (!f || !r) return;
  const fSeen = seenToday(f.sched, now);
  const rSeen = seenToday(r.sched, now);
  if (fSeen !== rSeen) {
    const other = fSeen ? r : f;
    if (other.dueAt <= now) bury(other);
    return;
  }
  if (fSeen) return;              // both reviewed today: asked for, nothing held back
  if (due.length === 2) bury(r.dueAt < f.dueAt ? f : r);
}

function withDue(sched: { due?: string } | undefined, now: Date): { due?: string; dueAt: Date } {
  return sched?.due ? { due: sched.due, dueAt: whenToDate(sched.due) } : { dueAt: now };
}

function cardItems(path: string, block: number, card: Card, trail: readonly string[], docPri: number, now: Date): CardItem[] {
  const section = trail[trail.length - 1];
  const form = cardForm(card.text);
  if (!form) return [];
  const groups = form === 'cloze' ? cardGroups(card.text) : [];
  const one = (group: GroupKey | undefined, dir?: Dir): CardItem => {
    const sched = scheduleOf(card, group, dir);
    const when = withDue(sched, now);
    const item: CardItem = {
      kind: 'card', path, block, form, text: card.text, groups: Math.max(groups.length, 1),
      // the card's own priority sits on its bare line, whichever group is up; a reverse may carry its own
      ...when, pri: dirPri(card, dir, docPri),
    };
    if (card.id !== undefined) item.id = card.id;
    if (section !== undefined) { item.section = section; item.trail = [...trail]; }
    if (sched) item.sched = sched;
    if (group) item.group = group;
    if (dir) item.dir = dir;
    // a link joins bare lines: the item that asks this card's bare line carries it
    const bare = dir === 'f' || (!dir && (!group || (groups.length === 1 && !('n' in group && card.blanks?.[group.n]))));
    if (bare && card.sched?.link !== undefined && card.id !== undefined) item.link = card.sched.link;
    return item;
  };
  // a both-ways card is two items, one per direction, siblings
  const dirs = cardDirs(form);
  if (dirs.length) {
    const pair = dirs.map((d) => one(undefined, d));
    burySiblings(pair, now);
    return pair.filter((i) => !isSuspended(card, undefined, i.dir));
  }
  // a suspended card, or blank, keeps its schedule and leaves the queue, the session, and the counts
  return (groups.length ? groups : [undefined]).filter((g) => !isSuspended(card, g)).map((g) => one(g));
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
    if (m.pdf !== undefined) item.pdf = true;
    if (m.type === 'extract') item.extract = true;
    if (note || m.type === 'extract') {
      item.written = prose.some((b) => b.kind !== 'heading' && b.text.trim() !== '');
      item.cards = doc.blocks.length - prose.length;
    }
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
      // a section enrolled: its own priority, else the document's
      if (sectionInQueue(b.read)) {
        out.push({
          kind: 'section', path, block: i, heading: b.text, level: b.level, trail: open.map((h) => h.text), sched: b.read,
          ...sectionState(doc.blocks, i), ...withDue(b.read, now), pri: b.read.pri ?? docPri,
        });
      }
    } else if (b.kind === 'card') out.push(...cardItems(path, i, b, open.map((h) => h.text), docPri, now));
  });
  return out;
}

/** What seeds an item's draw beside the day: its path and its heading, card id (else its block, group and direction), or kind. */
export function itemSeed(item: QueueItem): string {
  if (item.kind === 'section') return `${item.path}\n${item.heading}`;
  if (item.kind === 'card') return `${item.path}\n${item.id ?? `#${item.block}`}${item.group ? `/${'n' in item.group ? `c${item.group.n}` : `b${item.group.blank}`}` : ''}${item.dir === 'r' ? '/r' : ''}`;
  return `${item.path}\n${item.kind}`;
}

/** The day's key of a due item: a draw around `pri/100`, the same all day for the same item (`sampleKey`). Lower comes first. */
export const itemKey = (item: QueueItem, day: string): number => sampleKey(`${itemSeed(item)}\n${day}`, item.pri);

/**
 * In place. What is due comes first, by the day's key, then stored due
 * (oldest first); what is not due yet follows, by due, then priority. A
 * stable sort keeps document order after that.
 */
export function sortQueue(items: QueueItem[], now: Date): QueueItem[] {
  const day = dayOf(now);
  const keys = new Map<QueueItem, number>();
  const keyOf = (i: QueueItem) => { let k = keys.get(i); if (k === undefined) { k = itemKey(i, day); keys.set(i, k); } return k; };
  return items.sort((a, b) => {
    const da = isDue(a, now);
    const db = isDue(b, now);
    if (da !== db) return da ? -1 : 1;
    const due = a.dueAt.getTime() - b.dueAt.getTime();
    return da ? keyOf(a) - keyOf(b) || due : due || a.pri - b.pri;
  });
}

/** All items over a set of documents, sorted; of two linked cards, one a day (`buryLinked`). */
export function queueItems(docs: Iterable<[string, Doc]>, now: Date): QueueItem[] {
  const list = [...docs];
  const out: QueueItem[] = [];
  for (const [path, doc] of list) out.push(...docItems(path, doc, now));
  buryLinked(out, cardsById(list), now);
  return sortQueue(out, now);
}

/** The same element: one card group, or one document's reading or writing. */
export function sameItem(a: QueueItem, b: QueueItem): boolean {
  if (a.kind !== b.kind || a.path !== b.path) return false;
  if (a.kind === 'section' && b.kind === 'section') return a.heading === b.heading && (a.block === b.block || a.trail.join('\n') === b.trail.join('\n'));
  if (a.kind !== 'card' || b.kind !== 'card') return true;
  const same = a.id !== undefined && b.id !== undefined ? a.id === b.id : a.block === b.block && a.text === b.text;
  return same && JSON.stringify(a.group ?? null) === JSON.stringify(b.group ?? null) && (a.dir ?? 'f') === (b.dir ?? 'f');
}

export function inScope(item: QueueItem, scope: Scope, now: Date): boolean {
  switch (scope) {
    case 'all': return true;
    case 'today': return isDue(item, now);
    case 'upcoming': return !isDue(item, now);
    // a section comes back as reading does
    case 'reading': return item.kind === 'read' || item.kind === 'section';
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

/** Was the item's stored due before `now`'s day: the backlog, as against what is first due today. */
export const isBacklog = (item: QueueItem, now: Date): boolean => item.due !== undefined && dayOf(whenToDate(item.due)) < dayOf(now);

/**
 * The backlog: the reading and writing due before today, lowest key first;
 * what is first due today is left alone, whatever the fold. Cards are never
 * here: FSRS folds their lateness into the next grade, so the app only
 * orders them.
 */
export function overflow(items: QueueItem[], now: Date): (ReadItem | WriteItem | SectionItem)[] {
  const due = sortQueue(items.filter((i) => isDue(i, now)), now);
  return due.filter((i): i is ReadItem | WriteItem | SectionItem => i.kind !== 'card' && isBacklog(i, now));
}

/**
 * Postpone the backlog `overflow` names, one file at a time, each through
 * `vault.update`, so each rewrites its own `read` or `write` line (or a
 * section's heading line) and nothing else. Resolves to what was postponed.
 */
export async function postponeOverflow(vault: Vault, items: QueueItem[], now: Date): Promise<(ReadItem | WriteItem | SectionItem)[]> {
  const rest = overflow(items, now);
  for (const item of rest) {
    await vault.update(item.path, (doc) => {
      if (item.kind === 'read') advanceRead(doc, 'backlog', now);
      else if (item.kind === 'section') advanceSection(doc, item.block, item.heading, 'postpone', now);
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
  /** FSRS's request retention (`options.ts`); absent, its default 0.9. */
  retention?: number;
  /** The leech rule: lapses that make a leech, and what it does; `suspend` writes `sus=1` on the line graded. */
  leech?: { threshold: number; action: LeechAction };
  /** The exam ahead the card is studied toward: an interval past its last week is cut into it (`capForExam`). */
  exam?: Exam;
  /** Told what was graded: the card's id (minted when it had none), the line's key (`cN`, `r`, or none for the bare line), the schedule before and after. For the review log. */
  report?: (r: { id: string; key?: string; prev?: CardSchedule; next: CardSchedule }) => void;
}

/** A grade's leech: whether the schedule just reached the threshold (`becomesLeech`). */
export function wasLeeched(before: CardSchedule | undefined, after: CardSchedule, threshold: number): boolean {
  return becomesLeech(before?.lapses ?? 0, after.lapses ?? 0, threshold);
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
  const params = opts.retention !== undefined ? { request_retention: opts.retention } : undefined;
  // a leech set to suspend carries `sus=1` on the line it was graded on
  const leeched = (prev: CardSchedule | undefined, next: CardSchedule): CardSchedule => {
    if (opts.leech?.action === 'suspend' && wasLeeched(prev, next, opts.leech.threshold)) next.suspended = true;
    return next;
  };
  // a both-ways card's reverse rewrites its `sr r` line, and only that one
  const capped = (next: CardSchedule, g: CardItem['group'], dir?: Dir): CardSchedule =>
    (opts.exam ? capForExam(next, now, opts.exam, lineKey(card.id, card.text, g, dir)) : next);
  if (item.dir === 'r') {
    const prev = card.reverse;
    const next = leeched(prev, capped(grade(prev, rating, now, params), undefined, 'r'));
    card.reverse = next;
    opts.report?.({ id: card.id, key: 'r', ...(prev ? { prev } : {}), next });
    return next;
  }
  const own = group && 'n' in group && (item.groups > 1 || card.blanks?.[group.n] !== undefined) ? group.n : null;
  const prev = own === null ? card.sched : card.blanks?.[own] ?? card.sched;
  const next = leeched(prev, capped(grade(prev, rating, now, params), group));
  if (own === null) card.sched = next;
  else card.blanks = { ...card.blanks, [own]: next };
  opts.report?.({ id: card.id, ...(own === null ? {} : { key: `c${own}` }), ...(prev ? { prev } : {}), next });
  return next;
}
