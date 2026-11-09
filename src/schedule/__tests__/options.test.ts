// Milestone 42 in the scheduler: options set on a notebook apply to
// everything under it unless set lower, the day's allowance of new cards and
// reviews meters the queue (counted where the option is set, today's log
// spending it), retention reaches FSRS, and a leech is suspended or only
// marked at its threshold. The tests walk days.

import { describe, expect, it } from 'vitest';
import { meta, parse, type Card, type CardSchedule, type Doc, type Meta } from '../../format/index.js';
import {
  OPTION_DEFAULTS, addDays, becomesLeech, dayOf, docItems, gradeItem, isDue, meterQueue, ownersOf, resolveOptions, sortQueue, spentToday,
  type CardItem, type QueueItem, type Resolved,
} from '../index.js';

const at = (day: string, hour = 12) => new Date(`${day}T${String(hour).padStart(2, '0')}:00:00`);

const news = (n: number, prefix: string) => Array.from({ length: n }, (_, i) => `${prefix}${i} :: back ${i}`).join('\n\n');
const reviewed = (n: number, prefix: string, due: string) =>
  Array.from({ length: n }, (_, i) => `${prefix}${i} :: back ^${prefix}${i}\n<!-- sr due=${due} st=review s=20 d=5 r=5 l=0 ivl=20 last=${addDays(due, -20)}T09:00:00Z -->`).join('\n\n');

/** A small collection: a notebook with options and two decks under it, a deck under that with its own, and a deck elsewhere with none. */
function collection(): Map<string, Doc> {
  const files: Record<string, string> = {
    'courses/quantum.md': '---\ntitle: quantum\ntabs: true\nnew-per-day: 3\nreviews-per-day: 4\nretention: 0.8\n---\n\nthe course\n',
    'courses/quantum/ps-5.md': `---\ntype: deck\n---\n\n${news(5, 'p')}\n\n${reviewed(4, 'q', '2026-10-28')}\n`,
    'courses/quantum/notes.md': `${news(4, 'n')}\n`,
    'courses/quantum/drill.md': `---\ntype: deck\nnew-per-day: 1\n---\n\n${news(3, 'd')}\n`,
    'courses/quantum/sets/ps-6.md': `---\ntype: deck\n---\n\n${news(2, 's')}\n`,
    'arabic/vocabulary.md': `---\ntype: deck\n---\n\n${news(30, 'v')}\n\n${reviewed(10, 'w', '2026-10-29')}\n`,
  };
  return new Map(Object.entries(files).map(([p, t]) => [p, parse(t).doc]));
}

const metaOf = (docs: Map<string, Doc>) => (p: string): Meta | undefined => { const d = docs.get(p); return d ? meta(d) : undefined; };

function dayQueue(docs: Map<string, Doc>, now: Date, log: Parameters<typeof spentToday>[0] = []): QueueItem[] {
  const out: QueueItem[] = [];
  for (const [p, d] of docs) out.push(...docItems(p, d, now));
  const optionsOf = (p: string): Resolved => resolveOptions(p, metaOf(docs));
  return meterQueue(out, now, { optionsOf, spent: spentToday(log, now, optionsOf) });
}

const dueCards = (q: QueueItem[], now: Date) => q.filter((i): i is CardItem => i.kind === 'card' && isDue(i, now));
const byDoc = (items: CardItem[]) => {
  const out: Record<string, number> = {};
  for (const i of items) out[i.path] = (out[i.path] ?? 0) + 1;
  return out;
};

describe('options', () => {
  it('a node is under the documents that own its directories, nearest first', () => {
    const docs = new Set(['courses/quantum.md', 'courses/quantum/sets.md']);
    const isDoc = (p: string) => docs.has(p);
    expect(ownersOf('courses/quantum/sets/ps-6.md', isDoc)).toEqual(['courses/quantum/sets/ps-6.md', 'courses/quantum/sets.md', 'courses/quantum.md']);
    expect(ownersOf('courses/quantum/sets', isDoc)).toEqual(['courses/quantum/sets.md', 'courses/quantum.md']);
    expect(ownersOf('courses/quantum', isDoc)).toEqual(['courses/quantum.md']);
    expect(ownersOf('top.md', isDoc)).toEqual(['top.md']);
    expect(ownersOf('', isDoc)).toEqual([]);
  });

  it('set on a notebook, inherited all the way down unless set lower; the default where nothing sets one', () => {
    const docs = collection();
    const r = (p: string) => resolveOptions(p, metaOf(docs));
    expect(r('courses/quantum/ps-5.md')).toEqual({
      opts: { ...OPTION_DEFAULTS, newPerDay: 3, reviewsPerDay: 4, retention: 0.8 },
      from: { newPerDay: 'courses/quantum.md', reviewsPerDay: 'courses/quantum.md', retention: 'courses/quantum.md' },
    });
    // a deck that sets its own keeps the rest inherited
    expect(r('courses/quantum/drill.md').opts.newPerDay).toBe(1);
    expect(r('courses/quantum/drill.md').from).toMatchObject({ newPerDay: 'courses/quantum/drill.md', retention: 'courses/quantum.md' });
    // through a plain folder under the notebook
    expect(r('courses/quantum/sets/ps-6.md').from.newPerDay).toBe('courses/quantum.md');
    expect(r('courses/quantum/sets').from.newPerDay).toBe('courses/quantum.md');
    expect(r('arabic/vocabulary.md')).toEqual({ opts: OPTION_DEFAULTS, from: {} });
  });
});

describe('the day\'s allowance', () => {
  const now = at('2026-10-30');

  it('new cards a day: one allowance where the option is set, a lower setting its own, the default per deck', () => {
    const q = dayQueue(collection(), now);
    const fresh = dueCards(q, now).filter((i) => !i.sched);
    // the notebook's three across ps-5, notes, and sets/ps-6 (in queue order); drill its own one; vocab the default twenty
    expect(fresh.filter((i) => i.path.startsWith('courses/quantum/') && !i.path.endsWith('drill.md'))).toHaveLength(3);
    expect(byDoc(fresh)['courses/quantum/drill.md']).toBe(1);
    expect(byDoc(fresh)['arabic/vocabulary.md']).toBe(20);
    // what is held is due tomorrow, marked, and sorted after the day
    const held = q.filter((i): i is CardItem => i.kind === 'card' && !!i.held);
    expect(held.length).toBe((5 + 4 + 2 - 3) + (3 - 1) + (30 - 20));
    expect(held.every((i) => i.held === 'new' && dayOf(i.dueAt) === '2026-10-31')).toBe(true);
    expect(q.findIndex((i) => i.kind === 'card' && i.held)).toBeGreaterThan(q.map((i) => isDue(i, now)).lastIndexOf(true));
  });

  it('reviews a day: capped where set, never elsewhere; learning cards are not capped', () => {
    const docs = collection();
    docs.set('courses/quantum/ps-5.md', parse(`---\ntype: deck\n---\n\n${reviewed(6, 'q', '2026-10-28')}\n\nl :: m ^l1\n<!-- sr due=2026-10-30T08:00:00Z st=relearning s=1 r=4 l=1 ivl=0 last=2026-10-30T07:50:00Z g=1 -->\n`).doc);
    const due = dueCards(dayQueue(docs, now), now);
    const ps5 = due.filter((i) => i.path === 'courses/quantum/ps-5.md');
    expect(ps5.filter((i) => i.sched?.state === 'review')).toHaveLength(4);
    expect(ps5.filter((i) => i.sched?.state === 'relearning')).toHaveLength(1);
    expect(due.filter((i) => i.path === 'arabic/vocabulary.md' && i.sched)).toHaveLength(10);
  });

  it('today\'s log spends the allowance: new cards graded earlier count, a card in learning does not', () => {
    const log = [
      { doc: 'courses/quantum/notes.md', at: '2026-10-30T07:00:00Z', st: 'new' },
      { doc: 'courses/quantum/ps-5.md', at: '2026-10-30T07:01:00Z', st: 'new' },
      { doc: 'courses/quantum/ps-5.md', at: '2026-10-30T07:02:00Z', st: 'learning' },
      // yesterday's spends nothing today
      { doc: 'arabic/vocabulary.md', at: '2026-10-29T07:00:00Z', st: 'new' },
      { doc: 'arabic/vocabulary.md', at: '2026-10-30T07:00:00Z', st: 'new' },
    ].map((r) => ({ ...r, at: new Date(new Date(`${dayOf(new Date(r.at))}T07:00:00`).getTime()).toISOString() }));
    const fresh = dueCards(dayQueue(collection(), now, log), now).filter((i) => !i.sched);
    expect(fresh.filter((i) => i.path.startsWith('courses/quantum/') && !i.path.endsWith('drill.md'))).toHaveLength(1);
    expect(byDoc(fresh)['arabic/vocabulary.md']).toBe(19);
  });

  it('a hundred and ten new reverses come in twenty a day, the forwards untouched, day after day', () => {
    // the sample's vocab deck in small: forwards reviewed long ago, reverses never
    const cards = Array.from({ length: 110 }, (_, i) => `w${i} ::: m${i} ^w${i}\n<!-- sr due=2027-03-01 st=review s=120 d=3 r=9 l=0 ivl=120 last=2026-11-01T09:00:00Z g=3 -->`).join('\n\n');
    const docs = new Map([['arabic/vocabulary.md', parse(`---\ntype: deck\n---\n\n${cards}\n`).doc]]);
    const log: { doc: string; at: string; st: string }[] = [];
    const seen: number[] = [];
    let day = '2026-11-02';
    for (let k = 0; k < 7; k++, day = addDays(day, 1)) {
      const t = at(day, 8);
      const up = dueCards(dayQueue(docs, t, log), t);
      // the reverses met before come back on their own schedule; the new ones are metered
      seen.push(up.filter((i) => !i.sched?.reps).length);
      expect(up.every((i) => i.dir === 'r')).toBe(true);
      const doc = docs.get('arabic/vocabulary.md')!;
      for (const i of up) {
        gradeItem(doc, i, 3, t);
        log.push({ doc: i.path, at: t.toISOString(), st: i.sched?.state ?? 'new' });
      }
      // graded today, the day's allowance is spent: nothing new comes up later the same day
      const later = at(day, 20);
      expect(dueCards(dayQueue(docs, later, log), later).filter((i) => !i.sched?.reps)).toEqual([]);
    }
    expect(seen).toEqual([20, 20, 20, 20, 20, 10, 0]);
    const blocks = docs.get('arabic/vocabulary.md')!.blocks.filter((b): b is Card => b.kind === 'card');
    expect(blocks.filter((b) => b.reverse).length).toBe(110);
    expect(blocks.every((b) => b.sched?.reps === 9)).toBe(true);
  });

  it('nothing held stays as the queue sorted it', () => {
    const { doc } = parse('a :: b\n\nc :: d\n');
    const items = docItems('x.md', doc, now);
    const before = sortQueue([...items], now).map((i) => i.kind === 'card' && i.text);
    expect(meterQueue(items, now, { optionsOf: () => ({ opts: OPTION_DEFAULTS, from: {} }) }).map((i) => i.kind === 'card' && i.text)).toEqual(before);
  });
});

describe('grading under the options', () => {
  const REVIEW = 'a :: b ^a1\n<!-- sr due=2026-10-30 st=review s=10 d=5 r=6 l=3 ivl=10 last=2026-10-20T09:00:00Z -->\n';
  const now = at('2026-10-30');
  const item = (doc: Doc) => docItems('x.md', doc, now).find((i): i is CardItem => i.kind === 'card')!;

  it('retention reaches FSRS: a lower one schedules further out', () => {
    const ivl = (r: number) => { const { doc } = parse(REVIEW); return gradeItem(doc, item(doc), 3, now, { retention: r }).ivl!; };
    expect(ivl(0.8)).toBeGreaterThan(ivl(0.9));
    expect(ivl(0.9)).toBeGreaterThan(ivl(0.97));
  });

  it('a leech is suspended at its threshold when the options say so, its schedule kept; marked otherwise', () => {
    const { doc } = parse(REVIEW);
    const next = gradeItem(doc, item(doc), 1, now, { leech: { threshold: 4, action: 'suspend' } });
    expect(next).toMatchObject({ lapses: 4, suspended: true });
    expect((doc.blocks[0] as Card).sched!.suspended).toBe(true);
    // out of the queue and the counts from then on
    expect(docItems('x.md', doc, at('2026-11-05')).filter((i) => i.kind === 'card')).toEqual([]);
    const tagged = parse(REVIEW).doc;
    expect(gradeItem(tagged, item(tagged), 1, now, { leech: { threshold: 4, action: 'tag' } }).suspended).toBeUndefined();
    // a pass does not make a leech, nor a lapse below the threshold
    const passed = parse(REVIEW).doc;
    expect(gradeItem(passed, item(passed), 3, now, { leech: { threshold: 4, action: 'suspend' } }).suspended).toBeUndefined();
    const below = parse(REVIEW).doc;
    expect(gradeItem(below, item(below), 1, now, { leech: { threshold: 5, action: 'suspend' } }).suspended).toBeUndefined();
  });

  it('the leech rule: at the threshold, then every half of it', () => {
    expect([3, 4, 5, 6, 7, 8].map((n) => becomesLeech(n - 1, n, 4))).toEqual([false, true, false, true, false, true]);
    expect(becomesLeech(4, 4, 4)).toBe(false);
    expect([8, 9, 12, 13].map((n) => becomesLeech(n - 1, n, 8))).toEqual([true, false, true, false]);
  });

  it('report tells the log what was graded: the id minted, the line\'s key, before and after', () => {
    const { doc } = parse('{{c1::x}} and {{c2::y}}\n\nf ::: g ^fg\n');
    const got: { id: string; key?: string; prev?: unknown }[] = [];
    const items = docItems('x.md', doc, now).filter((i): i is CardItem => i.kind === 'card');
    gradeItem(doc, items[1]!, 3, now, { newId: () => 'cz1', report: (r) => got.push(r) });
    gradeItem(doc, items.find((i) => i.dir === 'f')!, 3, now, { report: (r) => got.push(r) });
    const rev = docItems('x.md', doc, at('2026-11-02')).find((i): i is CardItem => i.kind === 'card' && i.dir === 'r')!;
    gradeItem(doc, rev, 3, at('2026-11-02'), { report: (r) => got.push(r) });
    expect(got.map((r) => [r.id, r.key ?? null, r.prev === undefined])).toEqual([['cz1', 'c2', true], ['fg', null, true], ['fg', 'r', true]]);
  });
  // ‹ back to a card graded in the session, and graded again: once, from before the grade it replaces
  it('a grade given again: the line goes back to before the one it replaces, unless the line has changed since', () => {
    const text = 'f ::: g ^fg\n<!-- sr due=2026-10-28 st=review s=20 d=5 r=5 l=1 ivl=20 last=2026-10-08T09:00:00Z -->\n';
    const once = (g: 1 | 3 | 4, d: Doc, when: Date, over?: { prev?: CardSchedule; next: CardSchedule }) => {
      let r: { prev?: CardSchedule; next: CardSchedule } | null = null;
      for (const item of docItems('x.md', d, when).filter((i): i is CardItem => i.kind === 'card' && i.dir !== 'r')) gradeItem(d, item, g, when, { ...(over ? { over } : {}), report: (x) => { r = x; } });
      return r!;
    };
    const card = (d: Doc) => d.blocks.find((b): b is Card => b.kind === 'card')!;
    const { doc } = parse(text);
    const first = once(3, doc, now);
    const later = new Date(now.getTime() + 40_000);
    const again = once(1, doc, later, first);
    const { doc: fresh } = parse(text);
    once(1, fresh, later);
    expect(card(doc).sched).toEqual(card(fresh).sched);
    expect([again.prev?.reps, card(doc).sched?.reps, card(doc).sched?.lapses]).toEqual([5, 6, 2]);
    // three times: still from before the first
    once(4, doc, new Date(later.getTime() + 40_000), again);
    expect(card(doc).sched?.reps).toBe(6);
    // a line changed since (another device's grade synced in): graded as it is
    const { doc: synced } = parse(text);
    const mine = once(3, synced, now);
    card(synced).sched = { ...card(synced).sched!, last: '2026-10-29T08:00:00Z', reps: 7 };
    once(1, synced, later, mine);
    expect(card(synced).sched?.reps).toBe(8);
  });
});
