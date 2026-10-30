// What a queue row and a session say about an element: labels, snippets,
// the day, what a grade would schedule, and the order a session walks.
// Pure; the model is src/schedule, the views are Queue.tsx and Session.tsx.

import type { CardForm, CardSchedule } from '../format/index.js';
import { dayOf, dayStart, fold, isDue, preview, sameItem, whenToDate, type CardItem, type Grade, type QueueItem } from '../schedule/index.js';
import { nameOf } from '../vault/index.js';
import type { QueueScope } from './names.js';
import type { DocInfo, El } from './store.js';

export const EL_GLYPH: Record<El, string> = { read: '▤', write: '✎', card: '◆' };
export const EL_WORD: Record<El, string> = { read: 'reading', write: 'writing', card: 'card' };

/** One quiet line when a saved query has nothing. */
export const QUEUE_EMPTY: Record<QueueScope, string> = {
  today: 'nothing due', upcoming: 'nothing ahead', reading: 'nothing enrolled', writing: 'no drafts', cards: 'no cards',
};

export const FORM_LABEL: Record<CardForm, string> = { cloze: 'cloze', qa: 'q&a', bidir: 'bidir' };

const DAYS = ['sun', 'mon', 'tue', 'wed', 'thu', 'fri', 'sat'];
const MONTHS = ['jan', 'feb', 'mar', 'apr', 'may', 'jun', 'jul', 'aug', 'sep', 'oct', 'nov', 'dec'];

/** The day, as the prototype wrote it: `wed · 27 may`. */
export function dayLabel(now: Date): string {
  return `${DAYS[now.getDay()]} · ${now.getDate()} ${MONTHS[now.getMonth()]}`;
}

/** When something comes up, in the prototype's words. */
export function dueLabel(due: string | undefined, now: Date): string {
  if (due === undefined) return 'new';
  const d = Math.round((dayStart(dayOf(whenToDate(due))).getTime() - dayStart(dayOf(now)).getTime()) / 86400000);
  if (d < 0) return `overdue ${-d}d`;
  if (d === 0) return 'today';
  if (d === 1) return 'tomorrow';
  if (d < 30) return `+${d}d`;
  return `+${Math.round(d / 30)}mo`;
}

/** How long ago a day or instant was, in the same words looking back: `today`, `yesterday`, `3d ago`, `2mo ago`. */
export function agoLabel(when: string, now: Date): string {
  const d = Math.round((dayStart(dayOf(now)).getTime() - dayStart(dayOf(whenToDate(when))).getTime()) / 86400000);
  if (d <= 0) return 'today';
  if (d === 1) return 'yesterday';
  if (d < 30) return `${d}d ago`;
  if (d < 365) return `${Math.round(d / 30)}mo ago`;
  return `${Math.round(d / 365)}y ago`;
}

/** A span of days, short. */
export function fmtDays(d: number): string {
  if (d < 60) return `${Math.round(d)}d`;
  if (d < 365) return `${Math.round(d / 30)}mo`;
  return `${Math.round(d / 365)}y`;
}

/** How far out a schedule puts the card: minutes while in learning steps, else days. */
export function gapLabel(next: CardSchedule, now: Date): string {
  if (next.ivl && next.ivl >= 1) return fmtDays(next.ivl);
  const ms = next.due ? whenToDate(next.due).getTime() - now.getTime() : 0;
  return `${Math.max(1, Math.round(ms / 60000))}m`;
}

/** What each of the four grades would schedule, for the buttons. */
export function gapLabels(sched: CardSchedule | undefined, now: Date): Record<Grade, string> {
  const p = preview(sched, now);
  return { 1: gapLabel(p[1], now), 2: gapLabel(p[2], now), 3: gapLabel(p[3], now), 4: gapLabel(p[4], now) };
}

/** The vault-relative path without its `.md`, the folders kept: `papers/wozniak-1990`. */
export const pathLabel = (path: string): string => path.replace(/\.md$/, '');

/**
 * The document, and for a card the section it sits in: `wozniak-1990 — the
 * premise`. By `title` (the session, the inspector, the deck) the document's
 * name; by `path` (the queue, a list of files) its path without `.md`.
 */
export function sourceLabel(item: QueueItem, docs: Record<string, DocInfo>, by: 'title' | 'path' = 'title'): string {
  const name = by === 'path' ? pathLabel(item.path) : docs[item.path]?.title ?? nameOf(item.path);
  if (item.kind !== 'card' || !item.section) return name;
  return `${name} — ${item.section.replace(/^§\d+\s*—\s*/, '')}`;
}

/** The first `n` words of a text, one line. */
export function firstWords(text: string, n: number): string {
  const words = text.replace(/\s+/g, ' ').trim().split(' ').filter(Boolean);
  return words.slice(0, n).join(' ');
}

/** Never scheduled before. */
export function isFresh(item: QueueItem): boolean {
  return item.kind === 'card' ? !item.sched || !item.sched.reps : !item.sched.reps;
}

/** The tag before the label in a row: `note` (a note revisited), `read`, `write`, or the card's form. */
export function kindTag(item: QueueItem): string {
  if (item.kind === 'read' && item.note) return 'note';
  return item.kind === 'card' ? FORM_LABEL[item.form] : item.kind;
}

/** The small second line of a row, or nothing. */
export function refLine(item: QueueItem): string {
  if (item.kind === 'read' && item.page) return `p. ${item.page}`;
  if (item.kind === 'read' && item.total > 0 && item.pos > 0) return `${Math.round((item.pos / item.total) * 100)}% read`;
  if (item.kind === 'write' && item.sched.reps) return `pass ${item.sched.reps + 1}`;
  return '';
}

/** A scheduled card's interval, under its due; nothing for a new one. */
export function intervalLabel(item: CardItem): string {
  return item.sched?.ivl && item.sched.ivl >= 1 ? fmtDays(item.sched.ivl) : '';
}

/** The row's body for a read or write item: the next words, or nothing. */
export function snippetOf(item: QueueItem): string {
  if (item.kind === 'read') return item.next ? firstWords(item.next, 15) : '';
  if (item.kind === 'write') return item.lead ? firstWords(item.lead, 16) : '';
  return '';
}

/**
 * Whether the blank at `index` (in `blanks(text)` order, numbered `n` or
 * not) is one this item tests. An item of a single-group card tests every
 * blank; an item of a multi-group card tests its group, and the other
 * groups' blanks are shown as context.
 */
export function ownBlank(item: CardItem, n: number | null, index: number): boolean {
  if (item.groups <= 1 || !item.group) return true;
  return 'n' in item.group ? n === item.group.n : n === null && index === item.group.blank;
}

/**
 * The order a session walks: today's queue rotated to start at `start`, or
 * `start` alone when it is not in the queue (an upcoming card opened from
 * a saved query).
 */
export function sessionItems(today: QueueItem[], start: QueueItem): QueueItem[] {
  const at = today.findIndex((i) => sameItem(i, start));
  return at < 0 ? [start] : [...today.slice(at), ...today.slice(0, at)];
}

/** The header's counts for the day: to read, to write, to review. */
export function summary(items: QueueItem[]): { read: number; write: number; card: number } {
  const out = { read: 0, write: 0, card: 0 };
  for (const i of items) out[i.kind]++;
  return out;
}

export const dueNow = (items: QueueItem[], now: Date): QueueItem[] => items.filter((i) => isDue(i, now));

/** The day's work: what is due, above the fold. With no budget, everything due. */
export const dueToday = (items: QueueItem[], now: Date, budget: number): QueueItem[] => fold(dueNow(items, now), budget).above;

/** A budget as stored: a whole number of elements, 0 for none. */
export function cleanBudget(n: unknown): number {
  return typeof n === 'number' && Number.isFinite(n) && n > 0 ? Math.floor(n) : 0;
}
