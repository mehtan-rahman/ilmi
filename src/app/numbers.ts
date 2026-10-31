// A lens's numbers: what its cards have done and will do, set as type
// (`NumbersLens.tsx`). Pure. Two sources: the `sr` lines, which hold each card's
// latest state (the forecast, the leeches, the spread of stability and
// difficulty), and the review log in `.ilmi/reviews/`, which holds the
// history (reviews a day, true retention, time a review). Without a log
// the history is simply not there, and what needs it says since when it
// has been kept.

import { cardForm, type Card, type CardSchedule, type Doc, type Review } from '../format/index.js';
import { addDays, cardGroups, dayOf, dayStart, isSuspended, whenToDate, type Resolved } from '../schedule/index.js';

export const PAST_WEEKS = 4;
export const AHEAD_WEEKS = 4;
export const RETENTION_WEEKS = 8;
/** The most cards the failed-most list shows. */
export const LEECH_ROWS = 12;

export interface Line {
  path: string;
  block: number;
  card: Card;
  /** `cN`, `r`, or absent: which of the card's lines. */
  key?: string;
  sched?: CardSchedule;
  suspended: boolean;
}

/** Every schedule under a lens, one per line a review would rewrite: a card's, each blank's, each direction's. */
export function linesOf(docs: Iterable<[string, Doc]>): Line[] {
  const out: Line[] = [];
  for (const [path, doc] of docs) {
    doc.blocks.forEach((b, block) => {
      if (b.kind !== 'card') return;
      const form = cardForm(b.text);
      if (!form) return;
      const groups = form === 'cloze' ? cardGroups(b.text) : [];
      if (groups.length > 1) {
        for (const g of groups) {
          const n = 'n' in g ? g.n : null;
          const sched = n !== null ? b.blanks?.[n] ?? b.sched : b.sched;
          const line: Line = { path, block, card: b, suspended: isSuspended(b, g), ...(n !== null ? { key: `c${n}` } : {}) };
          if (sched) line.sched = sched;
          out.push(line);
        }
        return;
      }
      const one = groups[0];
      const own = one && 'n' in one && b.blanks?.[one.n] ? b.blanks[one.n] : b.sched;
      const f: Line = { path, block, card: b, suspended: isSuspended(b, one) };
      if (own) f.sched = own;
      out.push(f);
      if (form === 'bidir') {
        const r: Line = { path, block, card: b, key: 'r', suspended: isSuspended(b, undefined, 'r') };
        if (b.reverse) r.sched = b.reverse;
        out.push(r);
      }
    });
  }
  return out;
}

/** The reviews of the lens's cards: logged under one of its documents, or under a document that is gone, of a card it holds by id (a card moved or renamed with its file). */
export function reviewsUnder(log: readonly Review[], lines: readonly Line[], known: ReadonlySet<string>): Review[] {
  const paths = new Set(lines.map((l) => l.path));
  const ids = new Set(lines.map((l) => l.card.id).filter((x): x is string => !!x));
  return log.filter((r) => paths.has(r.doc) || (!known.has(r.doc) && ids.has(r.card)));
}

export interface Week {
  /** The Monday the week starts on. */
  start: string;
  /** Seven days' counts, Monday first; null for a day outside the span (before the log, or not yet). */
  days: (number | null)[];
  total: number;
}

export interface Rate { label: string; passed: number; due: number }

export interface Spread {
  /** 10%, 25%, the median, 75%, 90%. */
  at: [number, number, number, number, number];
  n: number;
}

export interface Leech {
  path: string;
  block: number;
  id?: string;
  text: string;
  key?: string;
  lapses: number;
  /** At or past its leech threshold. */
  leech: boolean;
  suspended: boolean;
}

export interface Numbers {
  cards: number;
  /** Cards none of whose lines (directions, blanks) was ever graded. */
  fresh: number;
  /** Cards every line of which is suspended. */
  suspended: number;
  /** The first day the log has for the lens; absent without a log. */
  since?: string;
  /** Reviews done a day, the last weeks, this week last. */
  past: Week[];
  /** Reviews coming due a day, this week first; what is overdue counts today. */
  ahead: Week[];
  /** Today's place: the week and the day (0 Monday). */
  today: { day: string; weekday: number };
  /** Passed over reviews of cards in review, by week, the latest last. */
  byWeek: Rate[];
  /** The same by how long the card had been studied when it came up. */
  byAge: Rate[];
  leeches: Leech[];
  stability: Spread | null;
  difficulty: Spread | null;
  /** The time a review took, when the log has it: the median and the total over the past weeks, in ms. */
  time: { median: number; total: number; n: number } | null;
}

/** Monday on or before `day`. */
export function mondayOf(day: string): string {
  const wd = (dayStart(day).getDay() + 6) % 7;
  return addDays(day, -wd);
}

function quantiles(values: number[]): Spread | null {
  if (!values.length) return null;
  const v = [...values].sort((a, b) => a - b);
  const q = (p: number) => {
    const at = (v.length - 1) * p;
    const lo = Math.floor(at);
    const hi = Math.ceil(at);
    return v[lo]! + (v[hi]! - v[lo]!) * (at - lo);
  };
  return { at: [q(0.1), q(0.25), q(0.5), q(0.75), q(0.9)], n: v.length };
}

const AGES: [string, number][] = [['first month', 30], ['one to three months', 91], ['three to six months', 182], ['six months on', Infinity]];

/**
 * The numbers over a lens: its lines (`linesOf`), the log's reviews of
 * them (`reviewsUnder`), and the options at each document (for the leech
 * threshold), at `now`. `logStart` is the day the whole log begins, when
 * there is one: before it the history is unknown, not zero.
 */
export function numbersOf(lines: readonly Line[], log: readonly Review[], now: Date, optionsOf: (path: string) => Resolved, logStart?: string): Numbers {
  const today = dayOf(now);
  const weekday = (dayStart(today).getDay() + 6) % 7;
  const thisWeek = mondayOf(today);
  const since = logStart;

  // reviews a day, the past weeks: a day before the log began is no day
  const perDay = new Map<string, number>();
  for (const r of log) { const d = dayOf(whenToDate(r.at)); perDay.set(d, (perDay.get(d) ?? 0) + 1); }
  const past: Week[] = [];
  for (let w = PAST_WEEKS - 1; w >= 0; w--) {
    const start = addDays(thisWeek, -7 * w);
    const days = Array.from({ length: 7 }, (_, i) => {
      const d = addDays(start, i);
      if (d > today || since === undefined || d < since) return null;
      return perDay.get(d) ?? 0;
    });
    past.push({ start, days, total: days.reduce<number>((n, x) => n + (x ?? 0), 0) });
  }

  // coming due: each live line that has been graded, at its due day; overdue counts today
  const dueOn = new Map<string, number>();
  for (const l of lines) {
    if (l.suspended || !l.sched?.reps || !l.sched.due) continue;
    const d = l.sched.due.length === 10 ? l.sched.due : dayOf(whenToDate(l.sched.due));
    const at = d < today ? today : d;
    dueOn.set(at, (dueOn.get(at) ?? 0) + 1);
  }
  const ahead: Week[] = [];
  for (let w = 0; w < AHEAD_WEEKS; w++) {
    const start = addDays(thisWeek, 7 * w);
    const days = Array.from({ length: 7 }, (_, i) => {
      const d = addDays(start, i);
      return d < today ? null : dueOn.get(d) ?? 0;
    });
    ahead.push({ start, days, total: days.reduce<number>((n, x) => n + (x ?? 0), 0) });
  }

  // true retention: of the reviews of cards in review, how many passed (anything but again)
  const first = new Map<string, number>();
  for (const r of log) { const k = `${r.card} ${r.key ?? ''}`; if (!first.has(k)) first.set(k, whenToDate(r.at).getTime()); }
  const byWeek: Rate[] = Array.from({ length: RETENTION_WEEKS }, (_, i) => ({ label: addDays(thisWeek, -7 * (RETENTION_WEEKS - 1 - i)), passed: 0, due: 0 }));
  const byAge: Rate[] = AGES.map(([label]) => ({ label, passed: 0, due: 0 }));
  const oldest = byWeek[0]!.label;
  for (const r of log) {
    if (r.st !== 'review') continue;
    const day = dayOf(whenToDate(r.at));
    const pass = r.g > 1 ? 1 : 0;
    if (day >= oldest) {
      const w = byWeek.find((x, i) => day >= x.label && (i === byWeek.length - 1 || day < byWeek[i + 1]!.label));
      if (w) { w.due++; w.passed += pass; }
    }
    const age = (whenToDate(r.at).getTime() - (first.get(`${r.card} ${r.key ?? ''}`) ?? 0)) / 86_400_000;
    const a = byAge[AGES.findIndex(([, max]) => age < max)]!;
    a.due++;
    a.passed += pass;
  }

  // failed most: the lines with the most lapses, from half the threshold up
  const leeches: Leech[] = [];
  for (const l of lines) {
    const lapses = l.sched?.lapses ?? 0;
    if (!lapses) continue;
    const threshold = optionsOf(l.path).opts.leech;
    if (lapses < Math.max(2, Math.ceil(threshold / 2))) continue;
    const row: Leech = { path: l.path, block: l.block, text: l.card.text, lapses, leech: lapses >= threshold, suspended: l.suspended };
    if (l.card.id !== undefined) row.id = l.card.id;
    if (l.key !== undefined) row.key = l.key;
    leeches.push(row);
  }
  leeches.sort((a, b) => b.lapses - a.lapses);

  const graded = lines.filter((l) => !l.suspended && l.sched?.reps);
  const recent = since === undefined ? [] : log.filter((r) => r.ms !== undefined && dayOf(whenToDate(r.at)) >= past[0]!.start);
  const ms = recent.map((r) => r.ms!).sort((a, b) => a - b);

  // the counts are of cards, so they add up: a both-ways card or a cloze of several blanks is one card however many lines it has
  const byCard = new Map<string, Line[]>();
  for (const l of lines) { const k = `${l.path}#${l.block}`; byCard.set(k, [...(byCard.get(k) ?? []), l]); }
  const cardList = [...byCard.values()];
  const out: Numbers = {
    cards: cardList.length,
    fresh: cardList.filter((ls) => ls.every((l) => !l.sched?.reps)).length,
    suspended: cardList.filter((ls) => ls.every((l) => l.suspended)).length,
    past, ahead, today: { day: today, weekday },
    byWeek, byAge: byAge.filter((a) => a.due > 0),
    leeches: leeches.slice(0, LEECH_ROWS),
    stability: quantiles(graded.map((l) => l.sched!.stability).filter((x): x is number => x !== undefined)),
    difficulty: quantiles(graded.map((l) => l.sched!.difficulty).filter((x): x is number => x !== undefined)),
    time: ms.length ? { median: ms[Math.floor((ms.length - 1) / 2)]!, total: ms.reduce((a, b) => a + b, 0), n: ms.length } : null,
  };
  if (since !== undefined) out.since = since;
  return out;
}

/** A rate as type: `91%`, or a dash when nothing was due. */
export const rateLabel = (r: Rate): string => (r.due ? `${Math.round((100 * r.passed) / r.due)}%` : '–');

/** A span of milliseconds in the largest unit that reads: `7 s`, `12 min`, `3.2 h`. */
export function spanLabel(ms: number): string {
  const s = ms / 1000;
  if (s < 90) return `${Math.round(s)} s`;
  if (s < 5400) return `${Math.round(s / 60)} min`;
  return `${(s / 3600).toFixed(1)} h`;
}

/** `oct 5`: a week's Monday as its row label. */
export function weekLabel(day: string): string {
  const d = dayStart(day);
  return `${d.toLocaleString('en', { month: 'short' }).toLowerCase()} ${d.getDate()}`;
}
