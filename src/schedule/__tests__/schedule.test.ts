import { promises as fsp } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { meta, parse, serialize, setField, type Card, type CardSchedule } from '../../format/index.js';
import { nodeFs } from '../../vault/node-fs.js';
import { Vault } from '../../vault/index.js';
import {
  addDays, advanceRead, advanceWrite, cardGroups, counts, dayOf, daysBetween, fold, fromFsrs, grade, gradeItem,
  instantOf, nextIntervals, numberBlank, overflow, postponeOverflow, postponed, preview, queue, queueItems, reading, toFsrs, whenToDate, writing,
  type CardItem, type QueueItem,
} from '../index.js';

const CORPUS = fileURLToPath(new URL('../../format/__tests__/corpus/vault/', import.meta.url));
const WOZ = 'papers/wozniak-1990.md';
const MARG = 'essays/marginalia.md';

// Noon UTC on the prototype's "today": the same local day from UTC-12 to UTC+11.
const NOW = new Date('2026-05-27T12:00:00Z');
const TODAY = dayOf(NOW);

const review: CardSchedule = {
  due: '2026-06-04', state: 'review', stability: 22, difficulty: 3.8, reps: 9, lapses: 0, ivl: 22,
  last: '2026-05-19T08:00:00Z', grade: 3,
};

describe('dates', () => {
  it('adds days across month ends', () => {
    expect(addDays('2026-05-31', 1)).toBe('2026-06-01');
    expect(addDays('2026-12-31', 1)).toBe('2027-01-01');
    expect(addDays('2026-03-01', -1)).toBe('2026-02-28');
  });

  it('reads a day as local midnight and an instant as itself', () => {
    expect(whenToDate('2026-05-27').getHours()).toBe(0);
    expect(dayOf(whenToDate('2026-05-27'))).toBe('2026-05-27');
    expect(whenToDate('2026-05-27T12:00:00Z').getTime()).toBe(NOW.getTime());
  });

  it('formats instants in UTC to the second', () => {
    expect(instantOf(new Date('2026-05-27T09:05:07.900Z'))).toBe('2026-05-27T09:05:07Z');
  });

  it('counts elapsed days by UTC date', () => {
    expect(daysBetween(new Date('2026-05-19T08:00:00Z'), NOW)).toBe(8);
    expect(daysBetween(new Date('2026-05-27T23:59:00Z'), new Date('2026-05-28T00:01:00Z'))).toBe(1);
  });
});

describe('grade', () => {
  it('maps a schedule onto a ts-fsrs card and back', () => {
    const card = toFsrs(review, NOW);
    expect(card).toMatchObject({ state: 2, stability: 22, difficulty: 3.8, reps: 9, lapses: 0, scheduled_days: 22, learning_steps: 0, elapsed_days: 8 });
    expect(card.due.getTime()).toBe(whenToDate('2026-06-04').getTime());
    expect(card.last_review?.toISOString()).toBe('2026-05-19T08:00:00.000Z');
    expect(fromFsrs(card, 3)).toEqual({ ...review });
  });

  it('treats no schedule as a new card due now', () => {
    expect(toFsrs(undefined, NOW)).toMatchObject({ state: 0, due: NOW, reps: 0, stability: 0, difficulty: 0 });
    expect('last_review' in toFsrs(undefined, NOW)).toBe(false);
  });

  it('grades a review card good: one day-due line, full precision, last set to now', () => {
    const next = grade(review, 3, NOW);
    expect(next).toEqual({
      due: '2026-07-11', state: 'review', stability: expect.closeTo(44.92, 2), difficulty: expect.closeTo(3.79, 2), reps: 10, lapses: 0, ivl: 45,
      last: '2026-05-27T12:00:00Z', grade: 3,
    });
    // stored as written: the shortest decimal that reads back to the same number
    expect(Number(String(next.stability))).toBe(next.stability);
  });

  it('grades a review card again: relearning, a lapse, due in minutes as an instant', () => {
    const next = grade(review, 1, NOW);
    expect(next).toMatchObject({ state: 'relearning', lapses: 1, reps: 10, ivl: 0, grade: 1, due: '2026-05-27T12:10:00Z' });
    expect(next.steps).toBeUndefined();
  });

  it('grades a new card through the learning steps', () => {
    const good = grade(undefined, 3, NOW);
    expect(good).toMatchObject({ state: 'learning', steps: 1, ivl: 0, reps: 1, due: '2026-05-27T12:10:00Z', stability: expect.closeTo(2.31, 2), difficulty: expect.closeTo(2.12, 2) });
    const easy = grade(undefined, 4, NOW);
    expect(easy).toMatchObject({ state: 'review', ivl: 8, due: addDays(TODAY, 8) });
    expect(easy.steps).toBeUndefined();
  });

  it('keeps unknown attributes and is deterministic', () => {
    const withExtra: CardSchedule = { ...review, extra: [['tag', 'x']] };
    expect(grade(withExtra, 2, NOW).extra).toEqual([['tag', 'x']]);
    expect(grade(review, 3, NOW)).toEqual(grade(review, 3, NOW));
  });

  it('carries the card\'s own priority through a grade and a preview', () => {
    const own: CardSchedule = { ...review, pri: 10 };
    expect(grade(own, 3, NOW).pri).toBe(10);
    expect(grade({ pri: 0 }, 1, NOW)).toMatchObject({ state: 'learning', pri: 0 });
    expect(preview(own, NOW)[4].pri).toBe(10);
    expect('pri' in grade(review, 3, NOW)).toBe(false);
  });

  it('previews all four grades', () => {
    const p = preview(review, NOW);
    expect(p[3]).toEqual(grade(review, 3, NOW));
    expect([p[1], p[2], p[3], p[4]].map((s) => s.ivl)).toEqual([0, 36, 45, 65]);
  });
});

describe('reading', () => {
  const r = { due: '2026-05-27', ivl: 9, reps: 4, pos: 12, pri: 3 };

  it('read on: interval grows by 1.6, marker only moves forward', () => {
    expect(reading.readOn(r, NOW, 15)).toEqual({ due: addDays(TODAY, 14), ivl: 14, reps: 5, pos: 15, pri: 3 });
    expect(reading.readOn(r, NOW, 3).pos).toBe(12);
    expect(reading.readOn(r, NOW).pos).toBe(12);
    expect(reading.readOn({}, NOW)).toEqual({ due: addDays(TODAY, 2), ivl: 2, reps: 1 });
  });

  it('read on: the line\'s own factor', () => {
    expect(reading.readOn({ ...r, af: 2 }, NOW)).toEqual({ due: addDays(TODAY, 18), ivl: 18, reps: 5, pos: 12, pri: 3, af: 2 });
    expect(reading.readOn({ ivl: 1, af: 1.1 }, NOW)).toEqual({ due: addDays(TODAY, 1), ivl: 1, reps: 1, af: 1.1 });
    expect(reading.readOn({ ivl: 5, af: 1.1 }, NOW).ivl).toBe(6);
  });

  it('postpone: the interval grows by 1.2, at least a day more, never a pass', () => {
    expect(reading.postpone(r, NOW)).toEqual({ ...r, due: addDays(TODAY, 11), ivl: 11 });
    expect(reading.postpone({ ivl: 1 }, NOW)).toEqual({ due: addDays(TODAY, 2), ivl: 2 });
    expect(reading.postpone({}, NOW)).toEqual({ due: addDays(TODAY, 2), ivl: 2 });
    expect(reading.postpone(r, NOW, 2)).toEqual({ ...r, due: addDays(TODAY, 18), ivl: 18 });
    expect(reading.postpone({ ivl: 9 }, NOW, 1.0)).toEqual({ due: addDays(TODAY, 10), ivl: 10 });
    // never earlier than tomorrow, whatever the interval and factor
    for (const ivl of [0, 1, 2, 3, 7, 30, 365]) for (const f of [0.5, 1, 1.05, 1.2, 2]) {
      expect(postponed(ivl, f)).toBeGreaterThanOrEqual(Math.max(1, ivl + 1));
      expect(reading.postpone({ ivl }, NOW, f).due! > TODAY).toBe(true);
    }
  });

  it('previews the next intervals', () => {
    expect(nextIntervals(2, 1.6)).toEqual([3, 5, 8]);
    expect(nextIntervals(undefined, 1.5)).toEqual([2, 3, 5]);
    expect(nextIntervals(1, 1.1, 4)).toEqual([1, 1, 1, 1]);
  });

  it('a pass over the corpus\'s reading topics with af=2 lands where the formula says', async () => {
    const root = await fsp.mkdtemp(join(tmpdir(), 'ilmi-af-'));
    await fsp.cp(CORPUS, root, { recursive: true });
    const vault = await Vault.open(nodeFs, root);
    try {
      const topics = (await queue(vault, NOW, 'reading')).map((i) => i.path).sort();
      // milestone 15 added the PDF pair and its extract to the corpus
      expect(topics).toEqual([
        'papers/archive/sutton-2019.md', 'papers/crick-1995.md', 'papers/two-pages.md', 'papers/two-pages/the ruler in the margin.md',
        'papers/wozniak-1990.md', 'papers/wozniak-1990/woz-ex1.md',
      ]);
      for (const path of topics) {
        const before = meta((await vault.read(path)).doc).read!;
        const loaded = await vault.update(path, (doc) => {
          const r = meta(doc).read!;
          setField(doc, 'read', { ...r, af: 2 });
          advanceRead(doc, 'on', NOW);
        });
        const after = meta(loaded.doc).read!;
        const ivl = Math.max(1, Math.round((before.ivl ?? 1) * 2));
        expect(after, path).toMatchObject({ ivl, due: addDays(TODAY, ivl), reps: (before.reps ?? 0) + 1, af: 2 });
        const page = before.page === undefined ? '' : ` page=${before.page}`;
        expect((await fsp.readFile(join(root, path), 'utf8'))).toContain(`read: due=${addDays(TODAY, ivl)} ivl=${ivl} reps=${(before.reps ?? 0) + 1} pos=${before.pos ?? 0}${page} af=2\n`);
      }
      // crick's factor is the corpus's own, and a postpone keeps it
      const crick = await vault.update('papers/crick-1995.md', (doc) => { advanceRead(doc, 'postpone', NOW); });
      expect(meta(crick.doc).read).toEqual({ due: addDays(TODAY, 5), ivl: 5, reps: 4, pos: 2, af: 2 });
    } finally {
      vault.close();
      await fsp.rm(root, { recursive: true, force: true });
    }
  });

  it('done drops the field from the document', () => {
    const { doc } = parse('---\ntype: source\nread: due=2026-05-27 ivl=2 reps=3 pos=2 pri=2\n---\n\nprose\n');
    expect(advanceRead(doc, 'done', NOW)).toBeNull();
    expect(meta(doc).read).toBeUndefined();
    expect(serialize(doc)).toBe('---\ntype: source\n---\n\nprose\n');
    expect(() => advanceRead(doc, 'on', NOW)).toThrow(/not enrolled/);
  });

  it('read on through the document changes the read line only', () => {
    const text = '---\ntitle: t\nread: due=2026-05-27 ivl=2 reps=3 pos=2 pri=2\n---\n\nprose\n';
    const { doc } = parse(text);
    advanceRead(doc, 'on', NOW, 4);
    expect(serialize(doc)).toBe(`---\ntitle: t\nread: due=${addDays(TODAY, 3)} ivl=3 reps=4 pos=4 pri=2\n---\n\nprose\n`);
  });
});

describe('writing', () => {
  const w = { due: '2026-05-27', ivl: 2, reps: 1, pri: 2, done: false };

  it('worked on it: interval grows by 1.5', () => {
    expect(writing.workedOn(w, NOW)).toEqual({ due: addDays(TODAY, 3), ivl: 3, reps: 2, pri: 2, done: false });
    expect(writing.workedOn({ due: '2026-05-27', ivl: 3, done: true }, NOW)).toEqual({ due: addDays(TODAY, 5), ivl: 5, reps: 1, done: false });
  });

  it('worked on it: the line\'s own factor', () => {
    expect(writing.workedOn({ ...w, af: 1.2 }, NOW)).toEqual({ due: addDays(TODAY, 2), ivl: 2, reps: 2, pri: 2, done: false, af: 1.2 });
    expect(writing.workedOn({ ivl: 10, af: 3 }, NOW)).toMatchObject({ ivl: 30, due: addDays(TODAY, 30) });
  });

  it('postpone: the interval grows by 1.2, at least a day more; done: keeps the line', () => {
    expect(writing.postpone(w, NOW)).toEqual({ ...w, due: addDays(TODAY, 3), ivl: 3 });
    expect(writing.postpone({ ivl: 20 }, NOW)).toEqual({ due: addDays(TODAY, 24), ivl: 24 });
    expect(writing.postpone({}, NOW, 1.5)).toEqual({ due: addDays(TODAY, 2), ivl: 2 });
    expect(writing.done(w)).toEqual({ ...w, done: true });
  });

  it('done through the document keeps the write line', () => {
    const { doc } = parse('---\ntype: draft\nwrite: due=2026-05-27 ivl=2 reps=1 pri=2 done=false\n---\n\nprose\n');
    advanceWrite(doc, 'done', NOW);
    expect(serialize(doc)).toBe('---\ntype: draft\nwrite: due=2026-05-27 ivl=2 reps=1 pri=2 done=true\n---\n\nprose\n');
    expect(queueItems([['d.md', doc]], NOW)).toEqual([]);
  });
});

describe('cloze groups', () => {
  it('numbers groups once and unnumbered blanks each', () => {
    expect(cardGroups('{{c1::a}} {{c2::b}} {{c1::c}}')).toEqual([{ n: 1 }, { n: 2 }]);
    expect(cardGroups('{{a}} and {{b}}')).toEqual([{ blank: 0 }, { blank: 1 }]);
    expect(cardGroups('{{a}} and {{c1::b}} and {{c}}')).toEqual([{ blank: 0 }, { n: 1 }, { blank: 2 }]);
    expect(cardGroups('q :: a')).toEqual([]);
  });

  it('numbers one blank, leaving math and the rest alone', () => {
    expect(numberBlank('{{a}} and {{b}}', 1, 3)).toBe('{{a}} and {{c3::b}}');
    expect(numberBlank('{{$x^{a}$}} {{b}}', 0, 1)).toBe('{{c1::$x^{a}$}} {{b}}');
  });
});

describe('queue over the sample vault', () => {
  let root: string;
  let vault: Vault;

  beforeEach(async () => {
    root = await fsp.mkdtemp(join(tmpdir(), 'ilmi-sched-'));
    await fsp.cp(CORPUS, root, { recursive: true });
    vault = await Vault.open(nodeFs, root);
  });

  afterEach(async () => {
    vault.close();
    await fsp.rm(root, { recursive: true, force: true });
  });

  const readDisk = (rel: string) => fsp.readFile(join(root, rel), 'utf8');

  const cardItem = (items: QueueItem[], id: string, group?: CardItem['group']): CardItem => {
    const hit = items.find((i): i is CardItem => i.kind === 'card' && i.id === id && JSON.stringify(i.group) === JSON.stringify(group));
    if (!hit) throw new Error(`no item ${id} ${JSON.stringify(group)}`);
    return hit;
  };

  it('matches the counts for 2026-05-27', async () => {
    const all = await queue(vault, NOW);
    // milestone 15's PDF pair adds, all after the day: its reading, its extract's reading, and a two-blank cloze;
    // milestone 18's maxwell adds three blanks inside math, all after the day too (upcoming 17 → 20, cards 26 → 29);
    // milestone 30's course adds a problem set of two cards due in September (upcoming 20 → 22, cards 29 → 31)
    expect(counts(all, NOW)).toEqual({ today: 17, upcoming: 22, cards: 31, reading: 6, writing: 2 });
    const today = await queue(vault, NOW, 'today');
    expect(today.filter((i) => i.kind === 'card')).toHaveLength(13);
    expect(today.filter((i) => i.kind === 'read').map((i) => i.path)).toEqual([
      'papers/archive/sutton-2019.md', 'papers/crick-1995.md', 'papers/wozniak-1990/woz-ex1.md',
    ]);
    expect(today.filter((i) => i.kind === 'write').map((i) => i.path)).toEqual(['essays/spaced-composition.md']);
    expect(await queue(vault, NOW, 'upcoming')).toHaveLength(22);
  });

  it('expands a multi-blank cloze into one item per group with its own schedule', async () => {
    const all = await queue(vault, NOW);
    const c1 = cardItem(all, 'cw2-min', { n: 1 });
    const c2 = cardItem(all, 'cw2-min', { n: 2 });
    expect(c1).toMatchObject({ groups: 2, due: '2026-05-27', pri: 80, section: '§2 — twenty rules of formulating knowledge' });
    expect(c2).toMatchObject({ groups: 2, due: '2026-06-01', pri: 80 });
    expect(c1.sched?.stability).toBe(11.8);
    expect(c2.sched?.stability).toBe(3);
    // unnumbered blanks fall back to the bare line
    const p0 = cardItem(all, 'cmar-pleasure', { blank: 0 });
    const p1 = cardItem(all, 'cmar-pleasure', { blank: 1 });
    expect(p0.sched).toBe(p1.sched);
    expect(p0.due).toBe('2026-06-12');
    // a single group with only an `sr c1` line uses that line
    expect(cardItem(all, 'cprag-rel', { n: 1 })).toMatchObject({ groups: 1, due: '2026-06-08' });
    // a card with no schedule is new, due now
    const bare = all.find((i): i is CardItem => i.kind === 'card' && i.path === 'german.md' && i.id === undefined);
    expect(bare).toMatchObject({ form: 'bidir', dueAt: NOW, pri: 50 });
    expect(bare?.sched).toBeUndefined();
    expect(bare?.due).toBeUndefined();
  });

  const key = (i: QueueItem) => `${i.kind}:${i.kind === 'card' ? `${i.id ?? '?'}${i.group ? `/${'n' in i.group ? `c${i.group.n}` : `b${i.group.blank}`}` : ''}` : i.path}`;

  it('sorts what is due by priority, then due, then document order', async () => {
    const today = await queue(vault, NOW, 'today');
    // the corpus's old scale, 1 → 10, 2 → 50, 3 → 80, keeps the day's topics and drafts in their order
    expect(today.filter((i) => i.kind !== 'card').map(key)).toEqual([
      'write:essays/spaced-composition.md', 'read:papers/archive/sutton-2019.md', 'read:papers/crick-1995.md', 'read:papers/wozniak-1990/woz-ex1.md',
    ]);
    // cards sit with their document now: wozniak-1990's at 80, after everything at 50
    expect(today.map(key)).toEqual([
      'card:cv-luecke', 'card:cmar-drive', 'write:essays/spaced-composition.md', 'card:cd-resurface/c1', 'card:cd-resurface/c2',
      'read:papers/archive/sutton-2019.md', 'read:papers/crick-1995.md', 'card:cck-ncc', 'card:cv-vorsatz', 'card:cv-wdh', 'card:?',
      'card:cw3-leech', 'card:cw2-retr/b0', 'card:cw2-min/c1', 'read:papers/wozniak-1990/woz-ex1.md', 'card:cw2-integ/c1', 'card:cw2-integ/c2',
    ]);
    const pris = today.map((i) => i.pri);
    expect(pris).toEqual([...pris].sort((a, b) => a - b));
    for (const p of [50, 80]) {
      const dues = today.filter((i) => i.pri === p).map((i) => i.dueAt.getTime());
      expect(dues).toEqual([...dues].sort((a, b) => a - b));
    }
  });

  it('sorts what is not due yet by due, then priority, after everything due', async () => {
    const all = await queue(vault, NOW);
    const today = await queue(vault, NOW, 'today');
    const upcoming = await queue(vault, NOW, 'upcoming');
    expect(all.map(key)).toEqual([...today, ...upcoming].map(key));
    expect(upcoming.slice(0, 3).map(key)).toEqual(['write:essays/talk-incremental.md', 'read:papers/wozniak-1990.md', 'card:cw2-min/c2']);
    const dues = upcoming.map((i) => i.dueAt.getTime());
    expect(dues).toEqual([...dues].sort((a, b) => a - b));
  });

  it('a card\'s own priority overrides the document\'s; a line priority stands in for a missing field', () => {
    const { doc } = parse('---\npri: 20\nread: due=2026-05-27 pri=1\n---\n\nq :: a\n\nq2 :: a2 ^c2\n<!-- sr pri=70 -->\n\n{{a}} {{b}} ^c3\n<!-- sr pri=5 -->\n<!-- sr c1 due=2026-05-27 -->\n');
    const items = queueItems([['x.md', doc]], NOW);
    expect(items.map((i) => [key(i), i.pri])).toEqual([
      ['card:c3/b0', 5], ['card:c3/b1', 5], ['read:x.md', 20], ['card:?', 20], ['card:c2', 70],
    ]);
    const legacy = parse('---\nread: due=2026-05-27 pri=1\nwrite: due=2026-05-27\n---\n\nq :: a\n').doc;
    expect(queueItems([['y.md', legacy]], NOW).map((i) => [i.kind, i.pri])).toEqual([['read', 1], ['write', 50], ['card', 50]]);
  });

  it('describes reading progress', async () => {
    const all = await queue(vault, NOW, 'reading');
    expect(all.find((i) => i.path === 'papers/crick-1995.md')).toMatchObject({ pos: 2, total: 7, pri: 50 });
    expect(all.find((i) => i.path === WOZ)).toMatchObject({ pos: 12, total: 12, pri: 80 });
  });

  it('grading a card changes one line on disk', async () => {
    const before = await readDisk(WOZ);
    const item = cardItem(await queue(vault, NOW), 'cw1-paths');
    await vault.update(WOZ, (doc) => { gradeItem(doc, item, 3, NOW); });
    const after = await readDisk(WOZ);
    const la = before.split('\n');
    const lb = after.split('\n');
    expect(lb.length).toBe(la.length);
    const changed = la.flatMap((line, i) => (line === lb[i] ? [] : [i + 1]));
    expect(changed).toEqual([16]);
    expect(lb[15]).toMatch(/^<!-- sr due=2026-07-11 st=review s=44\.9\d* d=3\.79\d* r=10 l=0 ivl=45 last=2026-05-27T12:00:00Z g=3 -->$/);
  });

  it('grading one blank of a multi-blank cloze rewrites only its line', async () => {
    const before = await readDisk(WOZ);
    const item = cardItem(await queue(vault, NOW), 'cw2-min', { n: 1 });
    await vault.update(WOZ, (doc) => { gradeItem(doc, item, 1, NOW); });
    const after = await readDisk(WOZ);
    const la = before.split('\n');
    const lb = after.split('\n');
    const changed = la.flatMap((line, i) => (line === lb[i] ? [] : [i + 1]));
    expect(changed).toEqual([25]);
    expect(lb[24]).toMatch(/^<!-- sr c1 due=2026-05-27T12:10:00Z st=relearning s=[\d.]+ d=[\d.]+ r=15 l=3 ivl=0 last=2026-05-27T12:00:00Z g=1 -->$/);
    expect(lb[25]).toBe(la[25]);
    const again = cardItem(await queue(vault, NOW), 'cw2-min', { n: 1 });
    expect(again.due).toBe('2026-05-27T12:10:00Z');
    expect(again.dueAt > NOW).toBe(true);
  });

  it('numbers an unnumbered blank the first time it is graded', async () => {
    const before = await readDisk(MARG);
    const item = cardItem(await queue(vault, NOW), 'cmar-pleasure', { blank: 1 });
    await vault.update(MARG, (doc) => { gradeItem(doc, item, 3, NOW); });
    const after = await readDisk(MARG);
    const la = before.split('\n');
    const lb = after.split('\n');
    expect(lb.length).toBe(la.length + 1);
    expect(lb[11]).toBe('where there is no {{pleasure}} in the reading there is, reliably, no {{c1::learning}} either ^cmar-pleasure');
    expect(lb[12]).toBe(la[12]);
    expect(lb[13]).toMatch(/^<!-- sr c1 due=2026-06-29 st=review s=32\.\d+ d=3\.5\d* r=7 l=0 ivl=33 last=2026-05-27T12:00:00Z g=3 -->$/);
    expect(lb.slice(14)).toEqual(la.slice(13));
    const all = await queue(vault, NOW);
    expect(cardItem(all, 'cmar-pleasure', { blank: 0 }).due).toBe('2026-06-12');
    expect(cardItem(all, 'cmar-pleasure', { n: 1 }).sched?.grade).toBe(3);
  });

  it('gives an unscheduled card an id and a bare line', async () => {
    const before = await readDisk('german.md');
    const item = (await queue(vault, NOW)).find((i): i is CardItem => i.kind === 'card' && i.path === 'german.md' && i.id === undefined)!;
    await vault.update('german.md', (doc) => { gradeItem(doc, item, 4, NOW, { newId: () => 'cv-wort' }); });
    const after = await readDisk('german.md');
    expect(after.split('\n').length).toBe(before.split('\n').length + 1);
    expect(after).toContain(`ein Wort ohne Karte ::: a word without a card ^cv-wort\n<!-- sr due=${addDays(TODAY, 8)} st=review `);
    expect(after.slice(0, before.lastIndexOf('ein Wort'))).toBe(before.slice(0, before.lastIndexOf('ein Wort')));
  });

  it('avoids an id already used in the document', () => {
    const { doc } = parse('a ^c1\n\nq :: a\n');
    const item = queueItems([['x.md', doc]], NOW).find((i): i is CardItem => i.kind === 'card')!;
    const ids = ['c1', 'c2'];
    gradeItem(doc, item, 3, NOW, { newId: () => ids.shift()! });
    expect((doc.blocks[1] as Card).id).toBe('c2');
  });

  it('finds the card by id when the document shifted under it', async () => {
    const item = cardItem(await queue(vault, NOW), 'cw1-paths');
    await vault.update(WOZ, (doc) => { doc.blocks.unshift({ kind: 'paragraph', text: 'inserted above' }); });
    await vault.update(WOZ, (doc) => { gradeItem(doc, item, 3, NOW); });
    const card = (await vault.read(WOZ)).doc.blocks.find((b): b is Card => b.kind === 'card' && b.id === 'cw1-paths')!;
    expect(card.sched?.due).toBe('2026-07-11');
    const gone = { ...item, id: 'nope' };
    await expect(vault.update(WOZ, (doc) => { gradeItem(doc, gone, 3, NOW); })).rejects.toThrow(/not found/);
  });
});

describe('the fold', () => {
  let root: string;
  let vault: Vault;

  beforeEach(async () => {
    root = await fsp.mkdtemp(join(tmpdir(), 'ilmi-fold-'));
    await fsp.cp(CORPUS, root, { recursive: true });
    vault = await Vault.open(nodeFs, root);
  });

  afterEach(async () => {
    vault.close();
    await fsp.rm(root, { recursive: true, force: true });
  });

  const readDisk = (rel: string) => fsp.readFile(join(root, rel), 'utf8');

  const doc = (kind: 'read' | 'write', pri: number, ivl = 1) =>
    parse(`---\npri: ${pri}\n${kind}: due=2026-05-27 ivl=${ivl} reps=1${kind === 'write' ? ' done=false' : ''}\n---\n\nprose\n`).doc;
  const key = (i: QueueItem) => `${i.kind}:${i.kind === 'card' ? i.id ?? '?' : i.path}`;

  it('splits a sorted day at the budget; no budget is no fold', () => {
    const items = queueItems([['a.md', doc('read', 10)], ['b.md', doc('read', 20)], ['c.md', doc('write', 30)]], NOW);
    expect(fold(items, 2).above.map(key)).toEqual(['read:a.md', 'read:b.md']);
    expect(fold(items, 2).below.map(key)).toEqual(['write:c.md']);
    expect(fold(items, 3)).toEqual({ above: items, below: [] });
    expect(fold(items, 0)).toEqual({ above: items, below: [] });
    expect(fold(items, -1)).toEqual({ above: items, below: [] });
    expect(fold([], 2)).toEqual({ above: [], below: [] });
  });

  it('the overflow is the reading and writing below the fold, lowest priority first, never a card', () => {
    const docs: [string, ReturnType<typeof parse>['doc']][] = [
      ['a.md', doc('read', 10)], ['b.md', doc('write', 90)], ['c.md', doc('read', 60)],
      ['d.md', parse('---\npri: 95\n---\n\nq :: a ^c1\n<!-- sr due=2026-05-27 -->\n').doc],
      ['e.md', parse('---\npri: 70\nread: due=2026-06-01 ivl=3\n---\n\nprose\n').doc],
    ];
    const items = queueItems(docs, NOW);
    expect(items.map(key)).toEqual(['read:a.md', 'read:c.md', 'write:b.md', 'card:c1', 'read:e.md']);
    expect(overflow(items, NOW, 1).map(key)).toEqual(['write:b.md', 'read:c.md']);
    expect(overflow(items, NOW, 3).map(key)).toEqual([]);
    expect(overflow(items, NOW, 0)).toEqual([]);
    // the whole queue can be handed in unsorted: what is not due is not overflow
    expect(overflow([...items].reverse(), NOW, 1).map(key)).toEqual(['write:b.md', 'read:c.md']);
  });

  it('postponing the overflow of the corpus day rewrites one line per topic and touches no card', async () => {
    const before = new Map<string, string>();
    for (const path of vault.documents()) before.set(path, await readDisk(path));
    const all = await queue(vault, NOW);
    const today = all.filter((i) => i.dueAt <= NOW);
    expect(today).toHaveLength(17);
    // budget 5: one draft above the fold, the three reading topics below it, with nine cards
    const rest = overflow(all, NOW, 5);
    expect(rest.map((i) => `${i.kind}:${i.path}:${i.pri}`)).toEqual([
      'read:papers/wozniak-1990/woz-ex1.md:80', 'read:papers/archive/sutton-2019.md:50', 'read:papers/crick-1995.md:50',
    ]);
    const done = await postponeOverflow(vault, all, NOW, 5);
    expect(done).toEqual(rest);
    for (const path of vault.documents()) {
      const was = before.get(path)!.split('\n');
      const now = (await readDisk(path)).split('\n');
      const changed = was.flatMap((l, i) => (l === now[i] ? [] : [i + 1]));
      if (!rest.some((i) => i.path === path)) {
        expect(now, path).toEqual(was);
      } else {
        expect(changed, path).toHaveLength(1);
        expect(was[changed[0]! - 1]).toMatch(/^read: /);
        expect(now[changed[0]! - 1]).toMatch(/^read: /);
      }
    }
    expect(await readDisk('papers/crick-1995.md')).toContain('\nread: due=2026-05-30 ivl=3 reps=3 pos=2 af=2\n');
    expect(await readDisk('papers/archive/sutton-2019.md')).toContain('\nread: due=2026-05-29 ivl=2 reps=0 pos=0\n');
    expect(await readDisk('papers/wozniak-1990/woz-ex1.md')).toContain('\nread: due=2026-05-29 ivl=2 reps=1 pos=0\n');
    // tomorrow: the topics are gone, the cards below the fold are still there
    const tomorrow = new Date(NOW.getTime() + 86400000);
    const next = await queue(vault, tomorrow, 'today');
    expect(next.filter((i) => i.kind === 'read')).toEqual([]);
    expect(next).toHaveLength(17 - 3);
    expect(overflow(await queue(vault, tomorrow), tomorrow, 5)).toEqual([]);
  });

  it('a day of topics over budget opens within budget the next day', async () => {
    const root2 = await fsp.mkdtemp(join(tmpdir(), 'ilmi-fold2-'));
    try {
      const pris = [10, 20, 30, 40, 50, 60];
      for (const p of pris) await fsp.writeFile(join(root2, `t${p}.md`), `---\npri: ${p}\n${p % 20 === 0 ? 'write' : 'read'}: due=2026-05-27 ivl=${p / 10} reps=1\n---\n\nprose\n`);
      const v = await Vault.open(nodeFs, root2);
      try {
        const all = await queue(v, NOW);
        expect(all.filter((i) => i.dueAt <= NOW)).toHaveLength(6);
        const done = await postponeOverflow(v, all, NOW, 3);
        expect(done.map((i) => i.pri)).toEqual([60, 50, 40]);
        const tomorrow = new Date(NOW.getTime() + 86400000);
        const next = await queue(v, tomorrow, 'today');
        expect(next.map((i) => i.pri)).toEqual([10, 20, 30]);
        // each interval grew by 1.2, at least a day: 4 → 5, 5 → 6, 6 → 7
        expect(await fsp.readFile(join(root2, 't40.md'), 'utf8')).toContain('write: due=2026-06-01 ivl=5 reps=1\n');
        expect(await fsp.readFile(join(root2, 't50.md'), 'utf8')).toContain('read: due=2026-06-02 ivl=6 reps=1\n');
        expect(await fsp.readFile(join(root2, 't60.md'), 'utf8')).toContain('write: due=2026-06-03 ivl=7 reps=1\n');
      } finally {
        v.close();
      }
    } finally {
      await fsp.rm(root2, { recursive: true, force: true });
    }
  });
});

