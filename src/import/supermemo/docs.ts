// From a SuperMemo element to vault documents and cards (LAYOUT.md §13).
// Pure: the only input is the collection in memory and the import day; HTML
// becomes text through the intake's `readable` / `textOf`, so a topic lands
// the way a dropped page does.

import {
  PRI_DEFAULT, AF_MIN, parse, setField,
  type Card, type CardSchedule, type Doc, type ReadSchedule,
} from '../../format/index.js';
import { addDays } from '../../schedule/dates.js';
import { readable, textOf } from '../readable.js';
import { cleanText } from '../text.js';
import { fileName } from '../../vault/paths.js';
import { TD_NEVER, dayOfTd } from './bytes.js';
import type { Epoch, SmCollection, SmElement, SmText } from './collection.js';

/** `pri` from a rank in the priority queue: 0 first, 100 last. */
export function priOf(el: SmElement, ranked: number): number | undefined {
  if (el.rank === undefined) return undefined;
  if (ranked <= 1) return 0;
  return Math.round((100 * el.rank) / (ranked - 1));
}

/** Scheduled means an interval and a last repetition day are both recorded. */
export const isScheduled = (el: SmElement): boolean => el.interval >= 1 && el.lastRepDay >= 1;

/** The last repetition as a day, from the epoch when it is known, else from the last touch. */
export function lastRepOf(el: SmElement, epoch: Epoch | null): string | null {
  if (!isScheduled(el)) return null;
  if (epoch) return dayOfTd(epoch.day + el.lastRepDay);
  return el.lastTouch >= TD_NEVER ? dayOfTd(el.lastTouch) : null;
}

/** A topic's `read` line, or `null` when it is not scheduled. */
export function readOf(el: SmElement, c: Pick<SmCollection, 'epoch' | 'hasHistory'>): ReadSchedule | null {
  const last = lastRepOf(el, c.epoch);
  if (last === null) return null;
  const r: ReadSchedule = { due: addDays(last, el.interval), ivl: el.interval, pos: 0 };
  if (c.hasHistory) r.reps = el.reps ?? 0;
  if (el.af >= AF_MIN) r.af = el.af;
  return r;
}

/** An item's seeded `sr` line (the plan's seed; grades are not readable), or `null` when it is new. */
export function seedOf(el: SmElement, c: Pick<SmCollection, 'epoch' | 'hasHistory'>): CardSchedule | null {
  const last = lastRepOf(el, c.epoch);
  if (last === null) return null;
  const s: CardSchedule = {
    due: addDays(last, el.interval),
    state: 'review',
    stability: el.interval,
    difficulty: 5,
    ivl: el.interval,
    last,
  };
  if (c.hasHistory) s.reps = el.reps ?? 0;
  return s;
}

const dom = (html: string) => new DOMParser().parseFromString(html, 'text/html');

/** One paragraph's worth of plain text from a component: lines, no blank lines. */
export function plainOf(t: SmText): string {
  const text = t.kind === 'html' ? textOf(dom(t.body).body) : cleanText(t.body);
  return text.split('\n').map((l) => l.trim()).filter(Boolean).join('\n');
}

/** A topic's body: each HTML component as the intake would read it, plain texts as they are, blank-line separated. */
export function bodyOf(texts: SmText[]): string {
  const parts: string[] = [];
  for (const t of texts) {
    const text = t.kind === 'html' ? readable(t.body)?.text ?? '' : cleanText(t.body);
    if (text) parts.push(text);
  }
  return parts.join('\n\n');
}

export const CLOZE_MARK = '[...]';

export type CardText = { kind: 'card'; text: string } | { kind: 'prose'; text: string; why: string };

/** The card an item becomes: a cloze when its question holds `[...]`, else q&a; prose when there is no answer. */
export function cardTextOf(texts: SmText[]): CardText | null {
  const q = texts[0] ? plainOf(texts[0]) : '';
  const a = texts[1] ? plainOf(texts[1]) : '';
  if (!q && !a) return null;
  if (!a) return { kind: 'prose', text: q, why: 'item without an answer; kept as prose' };
  if (!q) return { kind: 'prose', text: a, why: 'item without a question; kept as prose' };
  if (q.includes(CLOZE_MARK)) {
    const blank = '{{c1::' + a.split('}}').join('} }') + '}}';
    return { kind: 'card', text: q.split(CLOZE_MARK).join(blank) };
  }
  const inline = !q.includes('\n') && !a.includes('\n') && !q.includes('::') && !a.includes('::');
  return { kind: 'card', text: inline ? `${q} :: ${a}` : `${q}\n?\n${a}` };
}

/** The file name a title gets. */
export const nameOf = (el: SmElement): string => fileName(el.title);

export interface DocSpec {
  type: 'source' | 'extract' | 'deck' | 'draft';
  name: string;
  today: string;
}

/** The empty document of `type`, front-matter set, body to be filled by the caller. */
function shell(spec: DocSpec, body: string): Doc {
  const { doc } = parse(body ? `${body}\n` : '');
  if (spec.type !== 'source') setField(doc, 'type', spec.type);
  return doc;
}

/** A topic as a source (frozen, imported) or an extract, enrolled when scheduled. */
export function topicDoc(el: SmElement, c: SmCollection, spec: DocSpec): Doc {
  const doc = shell(spec, bodyOf(el.texts));
  if (spec.type === 'source') setField(doc, 'frozen', true);
  setField(doc, 'imported', spec.today);
  if (el.title && el.title !== spec.name) setField(doc, 'title', el.title);
  const pri = priOf(el, c.ranked);
  if (pri !== undefined) setField(doc, 'pri', pri);
  const read = readOf(el, c);
  if (read) setField(doc, 'read', read);
  return doc;
}

/** A task as a draft due on the import day. */
export function taskDoc(el: SmElement, c: SmCollection, spec: DocSpec): Doc {
  const doc = shell(spec, bodyOf(el.texts));
  setField(doc, 'started', spec.today);
  if (el.title && el.title !== spec.name) setField(doc, 'title', el.title);
  const pri = priOf(el, c.ranked);
  if (pri !== undefined) setField(doc, 'pri', pri);
  setField(doc, 'write', { due: spec.today, ivl: 1, reps: 0, done: false });
  return doc;
}

/** A deck for the items under a folder. */
export function deckDoc(spec: DocSpec): Doc {
  return shell(spec, '');
}

/**
 * An item as a card block for the document that hosts it: `^smN` as its id,
 * the seeded schedule when scheduled, and its own `pri` when it differs
 * from the host document's. `null` with a reason when it cannot be a card.
 */
export function cardOf(el: SmElement, c: SmCollection, hostPri: number | undefined): { card: Card } | { prose: string; why: string } | null {
  const t = cardTextOf(el.texts);
  if (!t) return null;
  if (t.kind === 'prose') return { prose: t.text, why: t.why };
  const card: Card = { kind: 'card', text: t.text, id: `sm${el.id}` };
  const seed = seedOf(el, c);
  const pri = priOf(el, c.ranked);
  const own = pri !== undefined && pri !== (hostPri ?? PRI_DEFAULT) ? pri : undefined;
  if (seed || own !== undefined) {
    card.sched = seed ?? {};
    if (own !== undefined) card.sched.pri = own;
  }
  return { card };
}
