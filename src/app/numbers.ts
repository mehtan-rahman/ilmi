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
/** The year of days the heatmap shows, in weeks, this week last. */
export const HEAT_WEEKS = 53;
/** The days ahead the forecast shows, in weeks, this week first. */
export const FORECAST_WEEKS = 26;
/** An interval from which a card counts as matured, in days (Anki's line). */
export const MATURE_DAYS = 21;

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
  /** The year of days behind, shaded by reviews done; absent without a log. */
  heat?: Heat;
  /** The days ahead, shaded by what comes due; what is overdue counts today. */
  forecast: Heat;
  /** The year in lines; absent without a log. */
  summary?: Summary;
  /** What is coming, in lines. */
  coming: Coming;
  /** The log counted by day, once: each day's figures, and the day of each of the log's lines. */
  counted: { byDay: ReadonlyMap<string, DayAgg>; days: readonly string[] };
}

/** One day of the log, counted. */
export interface DayAgg {
  n: number;
  /** The time on its reviews that the log has, in ms. */
  ms: number;
  /** again, hard, good, easy. */
  grades: [number, number, number, number];
  /** Reviews of cards in review, and how many of them passed. */
  due: number;
  passed: number;
  /** Lines graded for the first time. */
  started: number;
  /** Lines whose interval crossed `MATURE_DAYS`. */
  matured: number;
  /** Where its reviews lie in the log: from `from` up to `to`. */
  from: number;
  to: number;
}

export interface Cell {
  day: string;
  n: number;
  /** 0 for nothing, 1–4 by how much against the busiest days. */
  level: 0 | 1 | 2 | 3 | 4;
}

export interface Heat {
  /** Weeks, oldest first, seven days Monday first; null for a day outside the span. */
  weeks: { start: string; days: (Cell | null)[] }[];
  /** The count a day needs for each level, 1–4. */
  steps: [number, number, number, number];
  /** Where a month begins: the week's index and the month's short name. */
  months: { week: number; label: string }[];
}

export interface Period {
  label: string;
  from: string;
  reviews: number;
  ms: number;
  started: number;
  matured: number;
  rate: Rate;
}

export interface Summary {
  /** The days counted: the year shown, or from the log's first day when that is later. */
  from: string;
  to: string;
  days: number;
  studied: number;
  reviews: number;
  ms: number;
  best: { day: string; n: number } | null;
  /** Days in a row with a review, up to today (or yesterday while today has none yet); the longest over the whole log. */
  run: number;
  longest: number;
  /** True retention over the range. */
  rate: Rate;
  /** again, hard, good, easy over the range. */
  mix: [number, number, number, number];
  periods: Period[];
  /** Retention by the time of day, over the range. */
  byHour: Rate[];
}

export interface Coming {
  /** Due today, with how many of them were due before today. */
  today: number;
  overdue: number;
  tomorrow: number;
  week: number;
  month: number;
  heaviest: { day: string; n: number } | null;
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

/** The day's parts retention is told by: a label and the hour it ends before. */
const PARTS: [string, number][] = [['night', 5], ['morning', 12], ['afternoon', 17], ['evening', 22], ['night', 24]];

const noDay = (at: number): DayAgg => ({ n: 0, ms: 0, grades: [0, 0, 0, 0], due: 0, passed: 0, started: 0, matured: 0, from: at, to: at });

/**
 * The log counted by day, in one pass: every figure of the heatmap and the
 * lines beside it is read from this, never from the log again. The day is
 * the scheduler's (`dayOf`: the local calendar day). `days[i]` is the day
 * of `log[i]`.
 */
export function daysOf(log: readonly Review[]): { byDay: Map<string, DayAgg>; days: string[]; hours: number[] } {
  const byDay = new Map<string, DayAgg>();
  const days: string[] = new Array(log.length);
  const hours: number[] = new Array(log.length);
  for (let i = 0; i < log.length; i++) {
    const r = log[i]!;
    const at = whenToDate(r.at);
    const day = dayOf(at);
    days[i] = day;
    hours[i] = at.getHours();
    let a = byDay.get(day);
    if (!a) { a = noDay(i); byDay.set(day, a); }
    a.n++;
    a.to = i + 1;
    if (i < a.from) a.from = i;
    if (r.ms !== undefined) a.ms += r.ms;
    a.grades[r.g - 1]!++;
    if (r.st === 'review') { a.due++; if (r.g > 1) a.passed++; }
    if (r.st === 'new') a.started++;
    if (r.ivl < MATURE_DAYS && r.next >= MATURE_DAYS) a.matured++;
  }
  return { byDay, days, hours };
}

/** `nov`: a month's short name. */
const monthLabel = (day: string): string => dayStart(day).toLocaleString('en', { month: 'short' }).toLowerCase();

/**
 * `weeks` weeks of days from the Monday `start`, each day's count from
 * `count` (null: outside the span, no cell). The levels are set against the
 * busy days, not the busiest: a day at the ninth decile of the days with
 * anything is the top level, so one outlier does not wash the rest out.
 */
export function heatOf(count: (day: string) => number | null, start: string, weeks: number): Heat {
  const raw: { start: string; days: (number | null)[] }[] = [];
  const some: number[] = [];
  const months: Heat['months'] = [];
  let day = start;
  let month = '';
  for (let w = 0; w < weeks; w++) {
    const days: (number | null)[] = [];
    const m = day.slice(0, 7);
    if (m !== month) { if (w > 0 || dayStart(day).getDate() <= 7) months.push({ week: w, label: monthLabel(day) }); month = m; }
    const first = day;
    for (let i = 0; i < 7; i++) {
      const n = count(day);
      if (n) some.push(n);
      days.push(n);
      day = addDays(day, 1);
    }
    raw.push({ start: first, days });
  }
  some.sort((a, b) => a - b);
  const top = some.length ? some[Math.ceil(some.length * 0.9) - 1]! : 0;
  const levelOf = (n: number): Cell['level'] => (n <= 0 ? 0 : (Math.min(4, Math.max(1, Math.ceil((4 * n) / top))) as Cell['level']));
  const step = (l: number) => Math.max(1, Math.floor((top * (l - 1)) / 4) + 1);
  return {
    weeks: raw.map((w) => ({ start: w.start, days: w.days.map((n, i) => (n === null ? null : { day: addDays(w.start, i), n, level: levelOf(n) })) })),
    steps: [1, step(2), step(3), step(4)],
    months,
  };
}

/** The lines beside the year: what was done from `from` to `today`, and the runs over the whole log. */
export function summaryOf(log: readonly Review[], counted: ReturnType<typeof daysOf>, from: string, today: string): Summary {
  const { byDay, days, hours } = counted;
  const sum = (lo: string, label: string): Period => {
    const p: Period = { label, from: lo, reviews: 0, ms: 0, started: 0, matured: 0, rate: { label, passed: 0, due: 0 } };
    for (let d = lo; d <= today; d = addDays(d, 1)) {
      const a = byDay.get(d);
      if (!a) continue;
      p.reviews += a.n; p.ms += a.ms; p.started += a.started; p.matured += a.matured;
      p.rate.due += a.due; p.rate.passed += a.passed;
    }
    return p;
  };
  const all = sum(from, 'range');
  let studied = 0;
  let best: Summary['best'] = null;
  const mix: Summary['mix'] = [0, 0, 0, 0];
  let span = 0;
  for (let d = from; d <= today; d = addDays(d, 1)) {
    span++;
    const a = byDay.get(d);
    if (!a?.n) continue;
    studied++;
    if (!best || a.n > best.n) best = { day: d, n: a.n };
    a.grades.forEach((k, i) => { mix[i]! += k; });
  }
  // the runs: days in a row over every day the log has
  const sorted = [...byDay.keys()].sort();
  let longest = 0;
  let len = 0;
  let prev = '';
  for (const d of sorted) {
    len = prev && addDays(prev, 1) === d ? len + 1 : 1;
    if (len > longest) longest = len;
    prev = d;
  }
  let run = 0;
  for (let d = byDay.has(today) ? today : addDays(today, -1); byDay.has(d); d = addDays(d, -1)) run++;
  const byHour: Rate[] = [...new Set(PARTS.map(([l]) => l))].map((label) => ({ label, passed: 0, due: 0 }));
  for (let i = 0; i < log.length; i++) {
    if (days[i]! < from || log[i]!.st !== 'review') continue;
    const part = byHour.find((p) => p.label === PARTS.find(([, end]) => hours[i]! < end)![0])!;
    part.due++;
    if (log[i]!.g > 1) part.passed++;
  }
  const year = `${today.slice(0, 4)}-01-01`;
  const month = `${today.slice(0, 7)}-01`;
  return {
    from, to: today, days: span, studied, reviews: all.reviews, ms: all.ms, best, run, longest, rate: { ...all.rate, label: 'range' }, mix,
    periods: [sum(mondayOf(today), 'this week'), sum(month, 'this month'), sum(year, 'this year')],
    // morning first, as a day goes
    byHour: ['morning', 'afternoon', 'evening', 'night'].map((l) => byHour.find((p) => p.label === l)!).filter((p) => p.due > 0),
  };
}

/** The reviews of `day`, oldest first, read from where the day's count says they lie. */
export function reviewsOn(log: readonly Review[], counted: { byDay: ReadonlyMap<string, DayAgg>; days: readonly string[] }, day: string): Review[] {
  const a = counted.byDay.get(day);
  if (!a) return [];
  const out: Review[] = [];
  for (let i = a.from; i < a.to; i++) if (counted.days[i] === day) out.push(log[i]!);
  return out;
}

/** The day a line comes due as the forecast counts it: its due day, today when that has passed; null for a line that is new or suspended. */
export function dueDay(l: Line, today: string): string | null {
  if (l.suspended || !l.sched?.reps || !l.sched.due) return null;
  const d = l.sched.due.length === 10 ? l.sched.due : dayOf(whenToDate(l.sched.due));
  return d < today ? today : d;
}

/** The lines that come due on `day`, in the lens's order. */
export const linesDue = (lines: readonly Line[], day: string, today: string): Line[] => lines.filter((l) => dueDay(l, today) === day);

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

  // the log by day, once: everything below that asks about a day reads this
  const counted = daysOf(log);
  const perDay = { get: (d: string) => counted.byDay.get(d)?.n };
  // reviews a day, the past weeks: a day before the log began is no day
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
  let overdue = 0;
  for (const l of lines) {
    const at = dueDay(l, today);
    if (at === null) continue;
    if (at === today && (l.sched!.due!.length === 10 ? l.sched!.due! : dayOf(whenToDate(l.sched!.due!))) < today) overdue++;
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
  const stamp = (r: Review) => Date.parse(r.at);
  for (const r of log) { const k = `${r.card} ${r.key ?? ''}`; if (!first.has(k)) first.set(k, stamp(r)); }
  const byWeek: Rate[] = Array.from({ length: RETENTION_WEEKS }, (_, i) => ({ label: addDays(thisWeek, -7 * (RETENTION_WEEKS - 1 - i)), passed: 0, due: 0 }));
  const byAge: Rate[] = AGES.map(([label]) => ({ label, passed: 0, due: 0 }));
  const oldest = byWeek[0]!.label;
  for (let i = 0; i < log.length; i++) {
    const r = log[i]!;
    if (r.st !== 'review') continue;
    const day = counted.days[i]!;
    const pass = r.g > 1 ? 1 : 0;
    if (day >= oldest) {
      const w = byWeek.find((x, i) => day >= x.label && (i === byWeek.length - 1 || day < byWeek[i + 1]!.label));
      if (w) { w.due++; w.passed += pass; }
    }
    const age = (stamp(r) - (first.get(`${r.card} ${r.key ?? ''}`) ?? 0)) / 86_400_000;
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
  const recent = since === undefined ? [] : log.filter((r, i) => r.ms !== undefined && counted.days[i]! >= past[0]!.start);
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
    forecast: heatOf((d) => (d < today ? null : dueOn.get(d) ?? 0), thisWeek, FORECAST_WEEKS),
    coming: comingOf(dueOn, overdue, today),
    counted,
  };
  if (since !== undefined) {
    out.since = since;
    const start = addDays(thisWeek, -7 * (HEAT_WEEKS - 1));
    out.heat = heatOf((d) => (d > today || d < since ? null : counted.byDay.get(d)?.n ?? 0), start, HEAT_WEEKS);
    // the year: 365 days up to today, or from the log's first day when that is later
    const yearAgo = addDays(today, -364);
    out.summary = summaryOf(log, counted, since > yearAgo ? since : yearAgo, today);
  }
  return out;
}

function comingOf(dueOn: ReadonlyMap<string, number>, overdue: number, today: string): Coming {
  let week = 0;
  let month = 0;
  let heaviest: Coming['heaviest'] = null;
  for (const [d, n] of dueOn) {
    if (d <= addDays(today, 6)) week += n;
    if (d <= addDays(today, 29)) month += n;
    // today holds the backlog: the heaviest day is one still ahead
    if (d > today && (!heaviest || n > heaviest.n || (n === heaviest.n && d < heaviest.day))) heaviest = { day: d, n };
  }
  return { today: dueOn.get(today) ?? 0, overdue, tomorrow: dueOn.get(addDays(today, 1)) ?? 0, week, month, heaviest };
}

/** `nov 12`: a day as a month and a date; with `weekday`, `thu, nov 12`. */
export function dayLabel(day: string, weekday = false): string {
  const d = dayStart(day);
  const md = `${d.toLocaleString('en', { month: 'short' }).toLowerCase()} ${d.getDate()}`;
  return weekday ? `${d.toLocaleString('en', { weekday: 'short' }).toLowerCase()}, ${md}` : md;
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
