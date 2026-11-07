// Milestone 52: a finish day on a source paces its reading as an exam does,
// with the day itself as the target and no lead; the interval written is
// the shorter of the cadence and the pacing, and the queue does the same for
// a line written before the day was set, writing nothing.

import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { meta, parse, serialize, setField, type Doc } from '../../format/index.js';
import { addDays, advanceRead, dayOf, docItems, examQueue, finishOf, leftToFinish, pacedInterval, perPassOf, readTarget, type ExamAt, type ReadItem } from '../index.js';

const NOW = new Date('2026-11-03T12:00:00Z');
const CORPUS = join(import.meta.dirname, '../../format/__tests__/corpus');
const text = () => readFileSync(join(CORPUS, 'mangled/finish.md'), 'utf8');
const dayAt = (d: string) => new Date(`${d}T12:00:00Z`);

const source = (front: string, paras = 40) => parse(`---\n${front}\n---\n\n${Array.from({ length: paras }, (_, i) => `Paragraph ${i + 1}.`).join('\n\n')}\n`).doc;
const item = (doc: Doc, now = NOW, exams: ExamAt[] = []): ReadItem => {
  const i = docItems('a.md', doc, now).find((x): x is ReadItem => x.kind === 'read')!;
  examQueue([i], now, () => exams);
  return i;
};

describe('a pass under a finish day', () => {
  it('the corpus source: the pass lands no later than the pacing says, sooner than its cadence', () => {
    const { doc } = parse(text());
    // ten paragraphs left at one a pass, three weeks: two days, the cadence at priority 70 is three
    expect(pacedInterval('2026-11-03', { day: '2026-11-24' }, 10, 1, 0)).toBe(2);
    expect(advanceRead(doc, 'on', NOW, 4)).toEqual({ due: '2026-11-05', ivl: 2, reps: 4, pos: 4 });
    expect(serialize(doc)).toContain('\nread: due=2026-11-05 ivl=2 reps=4 pos=4\n');
    // cleared, the next pass is back on the cadence
    const cleared = parse(text()).doc;
    setField(cleared, 'finish', null);
    expect(advanceRead(cleared, 'on', NOW, 4)).toEqual({ due: '2026-11-06', ivl: 3, reps: 4, pos: 4 });
  });

  it('keeps the cadence when the pacing would be longer', () => {
    const doc = source('type: source\npri: 70\nread: due=2026-11-03 ivl=3 reps=2 pos=30\nfinish: 2026-12-20');
    expect(advanceRead(doc, 'on', NOW, 33)?.ivl).toBe(3);
  });

  it('a pace of no lead: the last pass lands by the day itself, walked day by day', () => {
    const doc = source('type: source\npri: 70\nread: due=2026-11-03 ivl=3 reps=2 pos=6\nfinish: 2026-11-24');
    let today = '2026-11-03';
    let passes = 0;
    while ((meta(doc).read?.pos ?? 0) < 40 && today <= '2026-11-24') {
      const r = meta(doc).read!;
      if (r.due! <= today) { advanceRead(doc, 'on', dayAt(today), (r.pos ?? 0) + 3); passes++; }
      today = addDays(today, 1);
    }
    expect(meta(doc).read?.pos).toBeGreaterThanOrEqual(40);
    expect(today <= addDays('2026-11-24', 1)).toBe(true);
    expect(passes).toBe(12);
  });

  it('the day itself and after: nothing paced, left as written', () => {
    for (const on of ['2026-11-24', '2026-11-25', '2027-02-01']) {
      const doc = parse(text()).doc;
      expect(advanceRead(doc, 'on', dayAt(on), 4)?.ivl).toBe(3);
      expect(meta(doc).finish).toBe('2026-11-24');
      expect(serialize(doc)).toContain('finish: 2026-11-24\n');
    }
  });

  it('means nothing on a note, a draft, a deck, an extract, or a whole PDF', () => {
    for (const type of ['note', 'draft', 'deck', 'extract']) expect(finishOf(meta(source(`type: ${type}\nfinish: 2026-11-24`)))).toBeUndefined();
    expect(finishOf(meta(source('finish: 2026-11-24')))).toBeUndefined();
    expect(finishOf(meta(source('type: source\npdf: a.pdf\nfinish: 2026-11-24')))).toBeUndefined();
    const note = source('read: due=2026-11-03 ivl=12 reps=2\nfinish: 2026-11-05');
    expect(advanceRead(note, 'on', NOW)?.ivl).toBe(19);
    const book = source('type: source\npdf: a.pdf\npri: 70\nread: due=2026-11-03 ivl=3 reps=3 pos=10\nfinish: 2026-11-05');
    expect(advanceRead(book, 'on', NOW, 12, undefined, 0.5)?.ivl).toBe(3);
    expect(item(source('type: source\npdf: a.pdf\nread: due=2026-11-03\nfinish: 2026-11-05')).finish).toBeUndefined();
  });

  it('a chapter counts its pages: what is left of `pages`, what a pass has read of them', () => {
    const m = { pdf: 'b.pdf', pages: { first: 21, last: 60 } };
    expect(leftToFinish(m, 0, 3, undefined)).toEqual({ left: 40, read: 0, perPass: perPassOf(0, undefined) });
    expect(leftToFinish(m, 30, 3, 2)).toEqual({ left: 30, read: 10, perPass: 5 });
    expect(leftToFinish(m, 70, 3, 2).left).toBe(0);
    const doc = source('type: source\npdf: b.pdf\npages: 21-60\npri: 70\nread: due=2026-11-03 ivl=3 reps=1 pos=22 y=0.500\nfinish: 2026-11-24', 2);
    // to p. 24 in two passes: two pages a pass, 36 left, eighteen passes in three weeks
    const next = advanceRead(doc, 'on', NOW, 24, undefined, 0.5);
    expect(next).toMatchObject({ ivl: 1, due: '2026-11-04', reps: 2, pos: 24, y: 0.5 });
    expect(item(doc).finish).toEqual({ day: '2026-11-24', left: 36, read: 4, perPass: 2 });
  });

  it('the backlog holds it over to tomorrow as any book; a pass postponed is not counted', () => {
    const doc = parse(text()).doc;
    expect(advanceRead(doc, 'backlog', NOW)).toMatchObject({ due: '2026-11-04', ivl: 3, reps: 3 });
    const put = parse(text()).doc;
    expect(advanceRead(put, 'postpone', NOW)).toMatchObject({ reps: 3, ivl: 4 });
  });

  it('an exam ahead that is nearer wins, an exam further off does not', () => {
    const today = '2026-11-03';
    expect(readTarget(undefined, undefined, today)).toBeUndefined();
    expect(readTarget(undefined, '2026-11-03', today)).toBeUndefined();
    expect(readTarget({ day: '2026-11-20' }, undefined, today)).toEqual({ exam: { day: '2026-11-20' }, lead: 3 });
    expect(readTarget({ day: '2026-11-20' }, '2026-11-24', today)).toEqual({ exam: { day: '2026-11-20' }, lead: 3 });
    expect(readTarget({ day: '2026-12-20' }, '2026-11-24', today)).toEqual({ exam: { day: '2026-11-24' }, lead: 0 });
    // the exam's own target is three days before it, so that is the day compared
    expect(readTarget({ day: '2026-11-25' }, '2026-11-24', today)?.lead).toBe(3);
    expect(readTarget({ day: '2026-11-28' }, '2026-11-24', today)?.lead).toBe(0);
    const near = parse(text()).doc;
    expect(advanceRead(near, 'on', NOW, 4, { day: '2026-11-10' })?.ivl).toBe(pacedInterval('2026-11-03', { day: '2026-11-10' }, 10, 1));
    const far = parse(text()).doc;
    expect(advanceRead(far, 'on', NOW, 4, { day: '2027-01-10' })?.ivl).toBe(2);
  });
});

describe('the queue under a finish day', () => {
  it('a line written before the day was set is brought to the pacing, nothing written', () => {
    const doc = source('type: source\npri: 70\nread: due=2026-11-06 ivl=3 reps=2 pos=6');
    expect(item(doc).pulled).toBeUndefined();
    setField(doc, 'finish', '2026-11-24');
    const before = serialize(doc);
    const i = item(doc);
    // 34 left at three a pass, twelve passes in 21 days from the pass on the 3rd: every day
    expect(i).toMatchObject({ pulled: '2026-11-06', byFinish: true, finish: { day: '2026-11-24', left: 34, read: 6, perPass: 3 } });
    expect(dayOf(i.dueAt)).toBe('2026-11-04');
    expect(serialize(doc)).toBe(before);
    setField(doc, 'finish', null);
    expect(item(doc).pulled).toBeUndefined();
  });

  it('a paced line is the line: the queue moves nothing it wrote, pass after pass', () => {
    const doc = parse(text()).doc;
    let today = '2026-11-03';
    for (let n = 0; n < 8; n++) {
      const r = advanceRead(doc, 'on', dayAt(today), (meta(doc).read?.pos ?? 0) + 1)!;
      const i = item(doc, dayAt(today));
      expect(i.pulled).toBeUndefined();
      today = r.due!;
    }
  });

  it('past the day nothing is brought forward; an exam nearer brings it as `pulled` for the exam', () => {
    const doc = source('type: source\npri: 70\nread: due=2026-11-06 ivl=3 reps=2 pos=6\nfinish: 2026-11-24');
    expect(item(doc, dayAt('2026-11-25')).pulled).toBeUndefined();
    const i = item(doc, NOW, [{ day: '2026-11-12', label: 'midterm', from: 'a.md' }]);
    expect(i.pulled).toBe('2026-11-06');
    expect(i.byFinish).toBeUndefined();
    expect(i.exam?.label).toBe('midterm');
  });
});
