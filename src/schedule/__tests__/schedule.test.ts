import { promises as fsp } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { meta, parse, serialize, type Card, type CardSchedule } from '../../format/index.js';
import { nodeFs } from '../../vault/node-fs.js';
import { Vault } from '../../vault/index.js';
import {
  addDays, advanceRead, advanceWrite, cardGroups, counts, dayOf, daysBetween, fromFsrs, grade, gradeItem,
  instantOf, numberBlank, preview, queue, queueItems, reading, toFsrs, whenToDate, writing,
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

  it('postpone: tomorrow, nothing else', () => {
    expect(reading.postpone(r, NOW)).toEqual({ ...r, due: addDays(TODAY, 1) });
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

  it('postpone: tomorrow; done: keeps the line', () => {
    expect(writing.postpone(w, NOW)).toEqual({ ...w, due: addDays(TODAY, 1) });
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
    expect(counts(all, NOW)).toEqual({ today: 17, upcoming: 13, cards: 24, reading: 4, writing: 2 });
    const today = await queue(vault, NOW, 'today');
    expect(today.filter((i) => i.kind === 'card')).toHaveLength(13);
    expect(today.filter((i) => i.kind === 'read').map((i) => i.path)).toEqual([
      'papers/archive/sutton-2019.md', 'papers/crick-1995.md', 'papers/wozniak-1990/woz-ex1.md',
    ]);
    expect(today.filter((i) => i.kind === 'write').map((i) => i.path)).toEqual(['essays/spaced-composition.md']);
    expect(await queue(vault, NOW, 'upcoming')).toHaveLength(13);
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
