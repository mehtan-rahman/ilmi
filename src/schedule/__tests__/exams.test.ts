// Milestone 43 in the scheduler: an exam on a notebook, and everything under
// it studied toward the day. The sample's quantum notebook, with a midterm
// three weeks out, walked a day at a time by a student who does what is due:
// reviews FSRS would put after the exam are brought into its last week and
// spread over it, stability and difficulty FSRS's own; the textbook chapter
// is paced to be finished three days before; a note revisited comes back in
// the last week; the day after the exam nothing is capped and intervals grow
// as before. Beside it the stat-mech notebook, which sets no exam, is
// scheduled as FSRS has it throughout.

import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join, relative } from 'node:path';
import { describe, expect, it } from 'vitest';
import { meta, parse, setField, type CardSchedule, type Doc, type Meta } from '../../format/index.js';
import {
  EXAM_WINDOW, NEW_LEAD, READ_LEAD, activeExam, addDays, advanceRead, capForExam, dayOf, docItems, examLeft, examNewQuota, examQueue, examsAt,
  grade, gradeItem, isDue, meterQueue, pacedInterval, resolveOptions, spentToday, upcomingExam, whenToDate, windowDay,
  type CardItem, type ExamAt, type QueueItem, type ReadItem, type Resolved,
} from '../index.js';

const at = (day: string, hour = 12) => new Date(`${day}T${String(hour).padStart(2, '0')}:00:00`);

const SAMPLE = join(import.meta.dirname, '../../../samples/double-major');
const F26 = 'courses/fall-2026';
const QM = `${F26}/phys-412-quantum-ii`;
const SM = `${F26}/phys-415-stat-mech`;
const BOOK = `${QM}/halvorsen-ch-9-wkb.md`;
const NOTE = `${QM}/nondegenerate-perturbation-theory.md`;

function walk(dir: string): string[] {
  const out: string[] = [];
  for (const name of readdirSync(dir).sort()) {
    const p = join(dir, name);
    if (statSync(p).isDirectory()) out.push(...walk(p));
    else if (name.endsWith('.md')) out.push(p);
  }
  return out;
}

/** The two physics notebooks of the sample, as parsed. */
function load(): Map<string, Doc> {
  const docs = new Map<string, Doc>();
  for (const root of [QM, SM]) {
    for (const p of [join(SAMPLE, `${root}.md`), ...walk(join(SAMPLE, root))]) docs.set(relative(SAMPLE, p), parse(readFileSync(p, 'utf8')).doc);
  }
  return docs;
}

const metaOf = (docs: Map<string, Doc>) => (p: string): Meta | undefined => { const d = docs.get(p); return d ? meta(d) : undefined; };

interface Logged { doc: string; at: string; st: string }

/** The day's queue as the app builds it: every item, exams applied, then metered. */
function dayQueue(docs: Map<string, Doc>, now: Date, log: Logged[] = []): QueueItem[] {
  const m = metaOf(docs);
  const items: QueueItem[] = [];
  for (const [p, d] of docs) items.push(...docItems(p, d, now));
  const examsOf = (p: string) => examsAt(p, m);
  examQueue(items, now, examsOf);
  const optionsOf = (p: string): Resolved => resolveOptions(p, m);
  const examOf = (p: string) => activeExam(examsOf(p), now);
  return meterQueue(items, now, { optionsOf, spent: spentToday(log, now, optionsOf, examOf), examOf });
}

const under = (p: string, root: string) => p === `${root}.md` || p.startsWith(`${root}/`);

interface Grade { path: string; day: string; prev?: CardSchedule; next: CardSchedule; plain: CardSchedule }
interface Pass { path: string; day: string; reps: number; pos?: number; ivl: number; due: string }

/** A student who does everything due each day at noon: every card good, every reading two blocks further. */
function simulate(docs: Map<string, Doc>, from: string, to: string, onDay?: (day: string, q: QueueItem[]) => void) {
  const grades: Grade[] = [];
  const passes: Pass[] = [];
  const log: Logged[] = [];
  for (let day = from; day <= to; day = addDays(day, 1)) {
    const now = at(day);
    const q = dayQueue(docs, now, log);
    onDay?.(day, q);
    const exams = (p: string) => activeExam(examsAt(p, metaOf(docs)), now);
    for (const i of q) {
      if (!isDue(i, now)) continue;
      const doc = docs.get(i.path)!;
      const exam = exams(i.path);
      if (i.kind === 'card') {
        gradeItem(doc, i, 3, now, {
          ...(exam ? { exam } : {}),
          report: (r) => {
            grades.push({ path: i.path, day, ...(r.prev ? { prev: r.prev } : {}), next: r.next, plain: grade(r.prev, 3, now) });
            log.push({ doc: i.path, at: now.toISOString(), st: r.prev?.state ?? 'new' });
          },
        });
      } else if (i.kind === 'read') {
        const r = advanceRead(doc, 'on', now, i.note ? undefined : i.pos + 2, exam)!;
        passes.push({ path: i.path, day, reps: r.reps!, ...(r.pos !== undefined ? { pos: r.pos } : {}), ivl: r.ivl!, due: r.due! });
        // the line just written is the pacing the queue derives: not brought forward again
        const again = dayQueue(docs, now, log).find((x): x is ReadItem => x.kind === 'read' && x.path === i.path);
        if (again) expect(again.pulled, `${i.path} on ${day}`).toBeUndefined();
      }
    }
  }
  return { grades, passes };
}

const sameMemory = (a: CardSchedule, b: CardSchedule) => a.stability === b.stability && a.difficulty === b.difficulty && a.state === b.state && a.reps === b.reps && a.lapses === b.lapses;

describe('exams: the format read where it applies', () => {
  it('the sample\'s quantum notebook sets midterm 2 and the final; everything under it studies toward them, the review deck its own past midterm too', () => {
    const docs = load();
    const m = metaOf(docs);
    expect(m(`${QM}.md`)?.exams).toEqual([{ day: '2026-11-18', label: 'midterm 2' }, { day: '2026-12-14', label: 'final' }]);
    const deck = examsAt(`${QM}/problem-sets/midterm-1-review.md`, m);
    expect(deck.map((e) => `${e.day} ${e.label ?? ''} ${e.from}`)).toEqual([
      `2026-10-21  ${QM}/problem-sets/midterm-1-review.md`, `2026-11-18 midterm 2 ${QM}.md`, `2026-12-14 final ${QM}.md`,
    ]);
    // through the plain folder, and on the notebook's folder lens
    expect(examsAt(`${QM}/problem-sets`, m).map((e) => e.day)).toEqual(['2026-11-18', '2026-12-14']);
    expect(examsAt(`${SM}/canonical-ensemble.md`, m)).toEqual([]);
    const now = at('2026-10-30');
    expect(activeExam(deck, now)?.label).toBe('midterm 2');
    expect(upcomingExam(deck, at('2026-11-18'))?.label).toBe('midterm 2');
    expect(activeExam(deck, at('2026-11-18'))?.label).toBe('final');
    expect(activeExam(deck, at('2026-12-14'))).toBeUndefined();
  });
});

describe('exams: the cap', () => {
  const exam = { day: '2026-11-20', label: 'midterm' };
  const s: CardSchedule = { due: '2026-10-30', state: 'review', stability: 30, difficulty: 5, reps: 6, lapses: 0, ivl: 25, last: '2026-10-05T09:00:00Z', grade: 3 };

  it('a grade FSRS puts past the exam is due in its last week, stability and difficulty FSRS\'s own', () => {
    const now = at('2026-10-30');
    const plain = grade(s, 3, now);
    expect(plain.due! > '2026-11-19').toBe(true);
    const capped = capForExam(plain, now, exam, 'q1');
    expect(capped.due! >= '2026-11-13' && capped.due! <= '2026-11-19').toBe(true);
    expect(capped.due).toBe(windowDay(exam, 'q1'));
    expect(capped.ivl).toBe(Math.round((whenToDate(capped.due!).getTime() - whenToDate('2026-10-30').getTime()) / 86400000));
    expect({ ...capped, due: plain.due, ivl: plain.ivl }).toEqual(plain);
  });

  it('left alone: due before the exam anyway, in learning steps, seen in the last week, or the exam past', () => {
    const early = grade({ ...s, stability: 1, difficulty: 8, ivl: 2, last: '2026-10-28T09:00:00Z' }, 3, at('2026-10-30'));
    expect(early.due! <= '2026-11-19').toBe(true);
    expect(capForExam(early, at('2026-10-30'), exam, 'q1')).toBe(early);
    const learning = grade(undefined, 3, at('2026-10-30'));
    expect(capForExam(learning, at('2026-10-30'), exam, 'q1')).toBe(learning);
    const inWeek = grade(s, 3, at('2026-11-14'));
    expect(capForExam(inWeek, at('2026-11-14'), exam, 'q1')).toBe(inWeek);
  });

  it('cards spread over the week by their keys, the same day every time', () => {
    const days = new Map<string, number>();
    for (let k = 0; k < 700; k++) { const d = windowDay(exam, `c${k}`); days.set(d, (days.get(d) ?? 0) + 1); }
    expect([...days.keys()].sort()).toEqual(Array.from({ length: EXAM_WINDOW }, (_, i) => addDays('2026-11-13', i)));
    for (const n of days.values()) expect(n).toBeGreaterThan(70);
    expect(windowDay(exam, 'c5')).toBe(windowDay(exam, 'c5'));
  });

  it('pacing: passes left spread to the finish, a day at a time past it, none when nothing is left', () => {
    // twenty blocks left at two a pass, eighteen days to the finish: ten passes, one every day
    expect(pacedInterval('2026-10-30', exam, 20, 2)).toBe(1);
    // six left at two a pass: three passes over eighteen days
    expect(pacedInterval('2026-10-30', exam, 6, 2)).toBe(6);
    expect(pacedInterval('2026-11-18', exam, 6, 2)).toBe(1);
    expect(pacedInterval('2026-11-19', exam, 6, 2)).toBeNull();
    expect(pacedInterval('2026-10-30', exam, 0, 2)).toBeNull();
    // a note: brought to the finish unless passed over in the last week
    expect(pacedInterval('2026-11-04', exam, null, 1)).toBe(13);
    expect(pacedInterval('2026-11-13', exam, null, 1)).toBeNull();
  });
});

describe('exams: the quantum notebook with a midterm three weeks out', () => {
  const E = '2026-11-20';
  const START = addDays(E, -EXAM_WINDOW);
  const LAST = addDays(E, -1);
  const FINISH = addDays(E, -READ_LEAD);
  const withMidterm = () => {
    const docs = load();
    setField(docs.get(`${QM}.md`)!, 'exam', [{ day: E, label: 'midterm' }]);
    return docs;
  };

  it('the first day: its reviews past the exam brought into the last week, its textbook brought forward, the queue saying for which', () => {
    const docs = withMidterm();
    const now = at('2026-10-30');
    const q = dayQueue(docs, now);
    const cards = q.filter((i): i is CardItem => i.kind === 'card');
    const pulled = cards.filter((i) => i.pulled);
    expect(pulled.length).toBeGreaterThan(10);
    for (const i of pulled) {
      expect(under(i.path, QM)).toBe(true);
      expect(i.pulled! > LAST && dayOf(i.dueAt) >= START && dayOf(i.dueAt) <= LAST).toBe(true);
      expect(i.exam?.label).toBe('midterm');
    }
    // every review past the exam is among them; the stat-mech notebook is untouched
    const past = cards.filter((i) => under(i.path, QM) && i.sched?.state === 'review' && i.sched.due! > LAST);
    expect(past.every((i) => i.pulled)).toBe(true);
    expect(cards.filter((i) => under(i.path, SM)).every((i) => !i.pulled && !i.exam)).toBe(true);
    // the chapter, due on the 21st after a pass on the 28th, comes back paced: its pulled due before the finish
    const book = q.find((i): i is ReadItem => i.kind === 'read' && i.path === BOOK)!;
    expect(book.sched.due).toBe('2026-11-21');
    expect(book.pulled).toBe('2026-11-21');
    expect(dayOf(book.dueAt) <= FINISH).toBe(true);
    // paced from its pass on the 28th it would have been due on the 29th: brought forward is today at the earliest
    expect(dayOf(book.dueAt)).toBe('2026-10-30');
    for (const i of q) if (i.pulled) expect(dayOf(i.dueAt) >= '2026-10-30', `${i.path}`).toBe(true);
    // what is left: most cards not yet stable past the 20th, the chapter's blocks
    const left = examLeft(q, book.exam!, (p) => under(p, QM), () => 0.9);
    expect(left.cards).toBe(cards.filter((i) => under(i.path, QM)).length);
    expect(left.unready).toBeGreaterThan(0);
    expect(left.unready).toBeLessThan(left.cards);
    expect(left.sources).toBe(1);
    expect(left.blocks).toBe(book.total - book.pos);
  });

  it('walked a day at a time: capped before the week, seen in it, spread, the chapter finished three days before, and free the day after', () => {
    const docs = withMidterm();
    const firstWeek: Record<string, number> = {};
    let afterExam: QueueItem[] = [];
    const { grades, passes } = simulate(docs, '2026-10-30', '2026-12-10', (day, q) => {
      if (day === addDays(E, 1)) afterExam = q;
    });
    const qm = grades.filter((g) => under(g.path, QM));
    const sm = grades.filter((g) => under(g.path, SM));

    // before the week: no grade lands a card past the exam's last day, and the memory is FSRS's own
    const before = qm.filter((g) => g.day < START);
    let capped = 0;
    for (const g of before) {
      expect(sameMemory(g.next, g.plain), `${g.path} ${g.day}`).toBe(true);
      if ((g.next.ivl ?? 0) >= 1) expect(g.next.due! <= LAST, `${g.path} ${g.day}: ${g.next.due}`).toBe(true);
      if (g.next.due !== g.plain.due) { capped++; expect(g.plain.due! > LAST).toBe(true); }
      else expect(g.next).toEqual(g.plain);
    }
    expect(capped).toBeGreaterThan(5);

    // in the week: every card under the notebook is seen, and no day carries a wall
    for (const g of qm.filter((x) => x.day >= START && x.day <= LAST)) firstWeek[g.day] = (firstWeek[g.day] ?? 0) + 1;
    const counts = Object.values(firstWeek);
    const mean = counts.reduce((a, b) => a + b, 0) / EXAM_WINDOW;
    expect(Object.keys(firstWeek).length).toBe(EXAM_WINDOW);
    expect(Math.max(...counts)).toBeLessThanOrEqual(2 * mean);
    for (const [p, d] of docs) {
      if (!under(p, QM)) continue;
      for (const i of docItems(p, d, at(E))) {
        if (i.kind !== 'card') continue;
        expect(i.sched?.last && dayOf(whenToDate(i.sched.last)) >= START, `${p} #${i.block} last seen ${i.sched?.last}`).toBe(true);
      }
    }

    // the chapter: passes only advance, and it is finished by the finish day
    const book = passes.filter((x) => x.path === BOOK);
    expect(book.length).toBeGreaterThan(3);
    for (let k = 1; k < book.length; k++) {
      expect(book[k]!.reps).toBe(book[k - 1]!.reps + 1);
      expect(book[k]!.pos!).toBeGreaterThanOrEqual(book[k - 1]!.pos!);
    }
    const total = docs.get(BOOK)!.blocks.filter((b) => b.kind !== 'card').length;
    const done = book.find((x) => x.pos! >= total);
    expect(done && done.day <= FINISH, `finished on ${done?.day}`).toBe(true);
    // the note revisited comes round in the last week
    expect(passes.some((x) => x.path === NOTE && x.day >= START && x.day <= LAST)).toBe(true);

    // the day after: nothing is for the exam, nothing pulled, every grade FSRS's own, and intervals grow past the week again
    expect(afterExam.some((i) => i.exam || i.pulled)).toBe(false);
    const after = qm.filter((g) => g.day > E);
    expect(after.length).toBeGreaterThan(0);
    for (const g of after) expect(g.next).toEqual(g.plain);
    expect(after.some((g) => (g.next.ivl ?? 0) > EXAM_WINDOW + 7)).toBe(true);

    // the notebook beside it: FSRS's own throughout
    expect(sm.length).toBeGreaterThan(20);
    for (const g of sm) expect(g.next).toEqual(g.plain);
  });

  it('the sample as it ships: midterm 2 on the 18th, then the final; after the midterm the cap moves to the final', () => {
    const docs = load();
    const { grades } = simulate(docs, '2026-10-30', '2026-12-13');
    const qm = grades.filter((g) => under(g.path, QM) && (g.next.ivl ?? 0) >= 1);
    for (const g of qm.filter((x) => x.day < '2026-11-11')) expect(g.next.due! <= '2026-11-17').toBe(true);
    for (const g of qm.filter((x) => x.day > '2026-11-18' && x.day < '2026-12-07')) expect(g.next.due! <= '2026-12-13').toBe(true);
  });
});

describe('exams: new cards in time to be reviewed a few times', () => {
  const E = '2026-11-20';
  const news = (n: number) => Array.from({ length: n }, (_, i) => `n${i} :: back ${i}`).join('\n\n');
  const course = (deckFront = '') => new Map<string, Doc>([
    ['courses/quantum.md', parse(`---\ntitle: quantum\nexam: ${E} midterm\n---\n\nthe course\n`).doc],
    ['courses/quantum/drill.md', parse(`---\ntype: deck\n${deckFront}---\n\n${news(400)}\n`).doc],
    ['arabic/vocabulary.md', parse(`---\ntype: deck\n---\n\n${news(60)}\n`).doc],
  ]);

  function introduced(docs: Map<string, Doc>, from: string, to: string): Record<string, Record<string, number>> {
    const out: Record<string, Record<string, number>> = {};
    simulate(docs, from, to).grades.filter((g) => !g.prev?.reps).forEach((g) => { ((out[g.path] ??= {})[g.day] = (out[g.path]![g.day] ?? 0) + 1); });
    return out;
  }

  it('four hundred new under the exam come in by a week before it, not twenty a day; elsewhere twenty a day', () => {
    const days = introduced(course(), '2026-10-30', E);
    const drill = days['courses/quantum/drill.md']!;
    const cutoff = addDays(E, -NEW_LEAD);
    expect(Object.values(drill).reduce((a, b) => a + b, 0)).toBe(400);
    expect(Object.keys(drill).every((d) => d <= cutoff)).toBe(true);
    expect(drill['2026-10-30']).toBe(examNewQuota(400, { day: E, from: 'courses/quantum.md' } as ExamAt, at('2026-10-30')));
    expect(drill['2026-10-30']).toBeGreaterThan(20);
    expect(Object.values(days['arabic/vocabulary.md']!).every((n) => n <= 20)).toBe(true);
  });

  it('a new-per-day someone set is kept as set', () => {
    const days = introduced(course('new-per-day: 15\n'), '2026-10-30', '2026-11-05');
    expect(Object.values(days['courses/quantum/drill.md']!).every((n) => n === 15)).toBe(true);
  });
});
