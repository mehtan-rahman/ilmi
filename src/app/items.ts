// What a queue row and a session say about an element: labels, snippets,
// the day, what a grade would schedule, and the order a session walks.
// Pure; the model is src/schedule, the views are Queue.tsx and Session.tsx.

import type { CardForm, CardSchedule, Exam } from '../format/index.js';
import { capForExam, dayOf, dayStart, fold, isDue, preview, sameItem, whenToDate, type CardItem, type Grade, type QueueItem } from '../schedule/index.js';
import { nameOf } from '../vault/index.js';
import type { QueueScope } from './names.js';
import type { DocInfo, El } from './store.js';

export const EL_GLYPH: Record<El, string> = { read: '“', write: '✎', card: '◆', section: '§' };
export const EL_WORD: Record<El, string> = { read: 'reading', write: 'writing', card: 'card', section: 'section' };

/**
 * A row's mark: `“` a book or source to read on in, `§` what comes back
 * until it is dismissed (a section, a note revisited, an extract), `◆` a
 * card, `✎` a draft.
 */
export function glyphOf(item: QueueItem): string {
  if (item.kind === 'read' && (item.note || item.extract)) return EL_GLYPH.section;
  return EL_GLYPH[item.kind];
}

/** What a row's mark is drawn as: a note revisited and an extract are drawn as sections are. */
export const markOf = (item: QueueItem): El => (item.kind === 'read' && (item.note || item.extract) ? 'section' : item.kind);

/** The queue's head, one line: what the marks mean, and that the order is priority's. */
export const QUEUE_LEGEND: [glyph: string, el: El, what: string][] = [
  ['“', 'read', 'read on in a book'],
  ['§', 'section', 'a passage or section, back until you dismiss it'],
  ['◆', 'card', 'a card'],
];

/** One quiet line when a saved query has nothing. */
export const QUEUE_EMPTY: Record<QueueScope, string> = {
  today: 'nothing due', upcoming: 'nothing ahead', reading: 'nothing enrolled', writing: 'no drafts', cards: 'no cards',
};

/** The forms in the user's words, everywhere they are named. */
export const FORM_LABEL: Record<CardForm, string> = { cloze: 'cloze', qa: 'q&a', bidir: 'both ways' };

const DAYS = ['sun', 'mon', 'tue', 'wed', 'thu', 'fri', 'sat'];
const MONTHS = ['jan', 'feb', 'mar', 'apr', 'may', 'jun', 'jul', 'aug', 'sep', 'oct', 'nov', 'dec'];

/** The day: `wed 27 may` (no middot since 40: one date, not a pile of qualifiers). */
export function dayLabel(now: Date): string {
  return `${DAYS[now.getDay()]} ${now.getDate()} ${MONTHS[now.getMonth()]}`;
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

/** The same, read as words where it stands alone in a row: `in 5mo`, `in 13d`, `overdue 3d`, `today`. */
export function dueWhen(due: string | undefined, now: Date): string {
  return dueLabel(due, now).replace(/^\+/, 'in ');
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

/** What each of the four grades would schedule, for the buttons; under an exam ahead, as the grade will write it (`capForExam`). */
export function gapLabels(sched: CardSchedule | undefined, now: Date, retention?: number, exam?: { exam: Exam; key: string }): Record<Grade, string> {
  const p = preview(sched, now, retention !== undefined ? { request_retention: retention } : undefined);
  const g = (n: Grade) => gapLabel(exam ? capForExam(p[n], now, exam.exam, exam.key) : p[n], now);
  return { 1: g(1), 2: g(2), 3: g(3), 4: g(4) };
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
  if (item.kind === 'section') return `${name} — ${item.heading}`;
  if (item.kind !== 'card' || !item.section) return name;
  return `${name} — ${item.section.replace(/^§\d+\s*—\s*/, '')}`;
}

const same = (a: string, b: string) => a.trim().toLocaleLowerCase() === b.trim().toLocaleLowerCase();

/**
 * Where a card sits, for the session's line above it: the document's name,
 * then the headings over the card, outermost first, `›` between
 * (`stat mech › canonical ensemble › the partition function`). A top
 * heading that only repeats the name is left out, and so is an empty one.
 */
export function trailParts(item: CardItem, docs: Record<string, DocInfo>): string[] {
  const name = docs[item.path]?.title ?? nameOf(item.path);
  const heads = (item.trail ?? (item.section ? [item.section] : []))
    .map((h) => h.replace(/^§\d+\s*—\s*/, '').trim())
    .filter(Boolean);
  if (heads.length && same(heads[0]!, name)) heads.shift();
  return [name, ...heads];
}

export const trailLabel = (item: CardItem, docs: Record<string, DocInfo>): string => trailParts(item, docs).join(' › ');

/** The first `n` words of a text, one line. */
export function firstWords(text: string, n: number): string {
  const words = text.replace(/\s+/g, ' ').trim().split(' ').filter(Boolean);
  return words.slice(0, n).join(' ');
}

/** Never scheduled before. */
export function isFresh(item: QueueItem): boolean {
  // what comes back until it is dismissed says how often in its own words (`standing`)
  if (item.kind === 'section' || (item.kind === 'read' && (item.note || item.extract))) return false;
  return item.kind === 'card' ? !item.sched || !item.sched.reps : !item.sched.reps;
}

/** The tag before the label in a row: `note` (a note revisited), `extract`, `section`, `read`, `write`, or the card's form. */
export function kindTag(item: QueueItem): string {
  if (item.kind === 'read' && item.note) return 'note';
  if (item.kind === 'read' && item.extract) return 'extract';
  return item.kind === 'card' ? FORM_LABEL[item.form] : item.kind;
}

/** The small second line of a row, or nothing. */
export function refLine(item: QueueItem): string {
  if (item.kind === 'read' && item.page) return `p. ${item.page}`;
  if (item.kind === 'read' && item.total > 0 && item.pos > 0) return `${Math.round((item.pos / item.total) * 100)}% read`;
  if (item.kind === 'write' && item.sched.reps) return `pass ${item.sched.reps + 1}`;
  return '';
}

/** `2nd`, `3rd`, `11th`, `21st`. */
export function nth(n: number): string {
  const t = n % 100;
  const s = t >= 11 && t <= 13 ? 'th' : n % 10 === 1 ? 'st' : n % 10 === 2 ? 'nd' : n % 10 === 3 ? 'rd' : 'th';
  return `${n}${s}`;
}

/** A day as a row names it in passing: `oct 29`. */
export function shortDay(day: string): string {
  const d = dayStart(day.slice(0, 10));
  return `${MONTHS[d.getMonth()]} ${d.getDate()}`;
}

/**
 * Where something that comes back stands, in the user's words: what is
 * under it (`boxed oct 29, nothing written yet` with boxes, `made oct 29,
 * …` without, `written, no cards yet`, `written, 3 cards`), then how
 * often it has been back (`first time back`, `back for the 2nd time`), or
 * `new` the day it was made.
 */
export function standsWords(s: { written: boolean; cards: number; made?: string; boxes?: string; reps?: number }, now: Date): string {
  const what = !s.written && !s.cards
    ? (s.made ? `${s.boxes !== undefined ? 'boxed' : 'made'} ${shortDay(s.made)}, nothing written yet` : 'nothing written yet')
    : !s.cards ? 'written, no cards yet' : `written, ${s.cards} card${s.cards === 1 ? '' : 's'}`;
  const back = s.reps ? `back for the ${nth(s.reps + 1)} time` : s.made === dayOf(now) ? 'new' : 'first time back';
  return `${what} · ${back}`;
}

/**
 * The one line under a row's title that says where the item stands: a
 * section, a note revisited, and an extract in `standsWords`; a book or
 * source the page or the share it reads on from; a draft its pass. A card
 * says nothing here: its due and interval say it.
 */
export function standing(item: QueueItem, now: Date, firstPage?: number): string {
  switch (item.kind) {
    case 'section':
      return standsWords({ written: item.written, cards: item.cards, reps: item.sched.reps ?? 0, ...(item.sched.made ? { made: item.sched.made } : {}), ...(item.sched.boxes !== undefined ? { boxes: item.sched.boxes } : {}) }, now);
    case 'read':
      if (item.note || item.extract) return standsWords({ written: !!item.written, cards: item.cards ?? 0, reps: item.sched.reps ?? 0 }, now);
      if (item.pdf) return `read on from p. ${item.page ?? firstPage ?? 1}`;
      if (item.total > 0 && item.pos > 0) return `read on, ${Math.round((item.pos / item.total) * 100)}% read`;
      return 'read from the start';
    case 'write':
      return item.sched.reps ? `pass ${item.sched.reps + 1}` : 'first pass';
    case 'card':
      return '';
  }
}

/** A scheduled card's interval, under its due; nothing for a new one. */
export function intervalLabel(item: CardItem): string {
  return item.sched?.ivl && item.sched.ivl >= 1 ? fmtDays(item.sched.ivl) : '';
}

/** The row's body for a read or write item: the next words, or nothing. */
export function snippetOf(item: QueueItem): string {
  if (item.kind === 'section') return item.heading;
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

/**
 * A done row in the queue's log: the element's mark, its name (a section's
 * heading, else its document's title, cut to fit one line), and what
 * became of it (`§ pset 4 #5 · next · back in 5d`).
 */
export function doneLine(glyph: string, name: string, word: string): string {
  const one = name.replace(/\s+/g, ' ').trim();
  const cut = one.length > 56 ? `${one.slice(0, 55).trimEnd()}…` : one;
  return cut ? `${glyph} ${cut} · ${word}` : `${glyph} ${word}`;
}

export const dueNow = (items: QueueItem[], now: Date): QueueItem[] => items.filter((i) => isDue(i, now));

/** The day's work: what is due, above the fold. With no budget, everything due. */
export const dueToday = (items: QueueItem[], now: Date, budget: number): QueueItem[] => fold(dueNow(items, now), budget).above;

/** A budget as stored: a whole number of elements, 0 for none. */
export function cleanBudget(n: unknown): number {
  return typeof n === 'number' && Number.isFinite(n) && n > 0 ? Math.floor(n) : 0;
}

// ── exams ────────────────────────────────────────────────────────

/** An exam's name: its label, else `exam`. */
export const examName = (e: { label?: string }): string => e.label ?? 'exam';

/**
 * What a row brought before an exam says, quietly: `for the midterm`, or
 * `for midterm 2` when the label is numbered or a name of its own.
 */
export function forExam(e: { label?: string }): string {
  const name = examName(e);
  return /\d$/.test(name) || /^\p{Lu}/u.test(name) ? `for ${name}` : `for the ${name}`;
}

/** How far off an exam's day is: `today`, `tomorrow`, `in 19d`. Always days: the count is what matters. */
export function examWhen(day: string, now: Date): string {
  const d = Math.round((dayStart(day).getTime() - dayStart(dayOf(now)).getTime()) / 86400000);
  return d <= 0 ? 'today' : d === 1 ? 'tomorrow' : `in ${d}d`;
}

/** An exam's day as the top strip writes a day: `wed 18 nov`. */
export const examDay = (day: string): string => dayLabel(dayStart(day));

/** What is left before an exam, in a line each: the cards, the reading. Empty lines left out. */
export function leftLines(left: { cards: number; unready: number; sources: number; blocks: number; passes: number }): { cards?: string; reading?: string } {
  const out: { cards?: string; reading?: string } = {};
  if (left.cards) out.cards = left.unready ? `${left.unready} of ${left.cards} not yet stable` : `all ${left.cards} stable past it`;
  const reading = [
    left.sources ? `${left.blocks} block${left.blocks === 1 ? '' : 's'} left in ${left.sources} source${left.sources === 1 ? '' : 's'}` : '',
    left.passes ? `${left.passes} to revisit` : '',
  ].filter(Boolean);
  if (reading.length) out.reading = reading.join(', ');
  return out;
}
