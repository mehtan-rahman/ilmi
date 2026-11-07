// What the queue and the session say and do, without a window: labels,
// the session's order, and a whole session over the sample vault written
// to disk until nothing is due.

import { promises as fsp } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { meta, parse } from '../../format/index.js';
import { advanceRead, advanceWrite, gradeItem, queue, sameItem, type CardItem, type QueueItem, type ReadItem } from '../../schedule/index.js';
import { nodeFs } from '../../vault/node-fs.js';
import { Vault } from '../../vault/index.js';
import {
  cleanBudget, dayLabel, dueLabel, dueToday, firstWords, gapLabels, intervalLabel, isFresh, kindTag, ownBlank, paceWords, pathLabel, refLine, sessionItems, snippetOf, sourceLabel, doneLine,
} from '../items.js';
import { INTAKE, SESSION, queueId, queueScope, tabKindOf, titleOf } from '../names.js';

const CORPUS = fileURLToPath(new URL('../../format/__tests__/corpus/vault/', import.meta.url));
const NOW = new Date('2026-05-27T12:00:00Z');

const card = (over: Partial<CardItem> = {}): CardItem => ({
  kind: 'card', path: 'a.md', block: 0, form: 'cloze', text: 'x {{c1::y}} z', groups: 1, dueAt: NOW, pri: 2, ...over,
});

describe('names', () => {
  it('gives saved queries and the session ids that are not paths', () => {
    expect(queueId('today')).toBe(':queue/today');
    expect(queueScope(':queue/cards')).toBe('cards');
    expect(queueScope(':queue/other')).toBeNull();
    expect(queueScope('papers/x.md')).toBeNull();
    expect(tabKindOf(':queue/today', {})).toBe('queue');
    expect(tabKindOf(SESSION, {})).toBe('session');
    expect(tabKindOf(INTAKE, {})).toBe('intake');
    expect(titleOf(':queue/today', {}, null)).toBe('due today');
    expect(titleOf(':queue/cards', {}, null)).toBe('all cards');
  });
});

describe('labels', () => {
  it('names the day and the due', () => {
    expect(dayLabel(new Date(2026, 4, 27, 12))).toBe('wed 27 may');
    expect(dueLabel(undefined, NOW)).toBe('new');
    expect(dueLabel('2026-05-27', NOW)).toBe('today');
    expect(dueLabel('2026-05-25', NOW)).toBe('overdue 2d');
  });

  it('describes a row', () => {
    const docs = { 'papers/wozniak-1990.md': { type: 'source' as const, frozen: true, cards: 1, due: 0 } };
    expect(sourceLabel(card({ path: 'papers/wozniak-1990.md', section: '§2 — twenty rules' }), docs)).toBe('wozniak-1990 — twenty rules');
    expect(sourceLabel(card({ path: 'papers/wozniak-1990.md' }), docs)).toBe('wozniak-1990');
    expect(sourceLabel(card({ path: 'x.md' }), { 'x.md': { type: 'deck', frozen: false, cards: 0, due: 0, title: 'german · A1' } })).toBe('german · A1');
    // the queue names the file: its path without `.md`, the folders kept, the title left aside
    expect(pathLabel('sources/attention.md')).toBe('sources/attention');
    expect(pathLabel('a/b/c.md')).toBe('a/b/c');
    expect(pathLabel('notes.markdown')).toBe('notes.markdown');
    const titled = { 'sources/attention.md': { type: 'source' as const, frozen: true, cards: 0, due: 0, title: 'Attention Is All You Need' } };
    expect(sourceLabel({ kind: 'read', path: 'sources/attention.md', sched: {}, pos: 0, total: 3, dueAt: NOW, pri: 2 }, titled, 'path')).toBe('sources/attention');
    expect(sourceLabel({ kind: 'read', path: 'sources/attention.md', sched: {}, pos: 0, total: 3, dueAt: NOW, pri: 2 }, titled, 'title')).toBe('Attention Is All You Need');
    expect(sourceLabel({ kind: 'read', path: 'sources/attention.md', sched: {}, pos: 0, total: 3, dueAt: NOW, pri: 2 }, titled)).toBe('Attention Is All You Need');
    expect(sourceLabel(card({ path: 'papers/wozniak-1990.md', section: '§2 — twenty rules' }), docs, 'path')).toBe('papers/wozniak-1990 — twenty rules');
    expect(sourceLabel(card({ path: 'papers/wozniak-1990.md' }), docs, 'path')).toBe('papers/wozniak-1990');
    expect(kindTag(card({ form: 'qa' }))).toBe('q&a');
    expect(kindTag({ kind: 'read', path: 'a.md', sched: {}, pos: 0, total: 3, dueAt: NOW, pri: 2 })).toBe('read');
    expect(isFresh(card())).toBe(true);
    expect(isFresh(card({ sched: { reps: 3 } }))).toBe(false);
    expect(intervalLabel(card({ sched: { ivl: 12 } }))).toBe('12d');
    expect(intervalLabel(card({ sched: { ivl: 0 } }))).toBe('');
    expect(intervalLabel(card({ sched: { ivl: 400 } }))).toBe('1y');
    expect(refLine({ kind: 'read', path: 'a.md', sched: {}, pos: 3, total: 12, dueAt: NOW, pri: 2 })).toBe('25% read');
    expect(refLine({ kind: 'write', path: 'a.md', sched: { reps: 1 }, dueAt: NOW, pri: 2 })).toBe('pass 2');
    expect(refLine(card())).toBe('');
    expect(firstWords('  one two\nthree four five ', 3)).toBe('one two three');
    expect(snippetOf({ kind: 'read', path: 'a.md', sched: {}, pos: 0, total: 1, dueAt: NOW, pri: 2, next: 'a b c' })).toBe('a b c');
    expect(snippetOf({ kind: 'write', path: 'a.md', sched: {}, dueAt: NOW, pri: 2 })).toBe('');
    expect(doneLine('§', 'pset 4 #5, typed up from paper', 'next · back in 5d')).toBe('§ pset 4 #5, typed up from paper · next · back in 5d');
    expect(doneLine('§', `a ${'very '.repeat(20)}long heading`, 'dismissed')).toMatch(/^§ a very .{40,}… · dismissed$/);
    expect(doneLine('“', '', 'done for today · back in 2d')).toBe('“ done for today · back in 2d');
  });

  it('says what each grade would schedule', () => {
    const fresh = gapLabels(undefined, NOW);
    expect(fresh[1]).toBe('1m');
    expect(fresh[3]).toBe('10m');
    expect(fresh[4]).toMatch(/^\d+d$/);
    const seasoned = gapLabels({ due: '2026-05-27', state: 'review', stability: 22, difficulty: 3.8, reps: 9, lapses: 0, ivl: 22, last: '2026-05-05T08:00:00Z' }, NOW);
    expect(seasoned[1]).toMatch(/m$/);
    expect(seasoned[2]).toMatch(/d$/);
    expect(seasoned[4]).toMatch(/d|mo$/);
  });

  it('knows which blanks an item tests', () => {
    const one = card({ text: 'a {{b}} c {{d}}', groups: 1 });
    expect(ownBlank(one, null, 0)).toBe(true);
    expect(ownBlank(one, null, 1)).toBe(true);
    const c2 = card({ text: 'a {{c1::b}} c {{c2::d}}', groups: 2, group: { n: 2 } });
    expect(ownBlank(c2, 1, 0)).toBe(false);
    expect(ownBlank(c2, 2, 1)).toBe(true);
    const lone = card({ text: 'a {{b}} c {{d}}', groups: 2, group: { blank: 1 } });
    expect(ownBlank(lone, null, 0)).toBe(false);
    expect(ownBlank(lone, null, 1)).toBe(true);
  });
});

describe('the session order', () => {
  const a = card({ id: 'a' });
  const b = card({ id: 'b', block: 1 });
  const r: QueueItem = { kind: 'read', path: 'r.md', sched: {}, pos: 0, total: 1, dueAt: NOW, pri: 2 };

  it('rotates the day to start where you entered', () => {
    expect(sessionItems([a, b, r], b)).toEqual([b, r, a]);
    expect(sessionItems([a, b, r], a)).toEqual([a, b, r]);
  });

  it('is one element when it is not due', () => {
    const later = card({ id: 'z', dueAt: new Date('2026-06-01') });
    expect(sessionItems([a, b, r], later)).toEqual([later]);
  });

  it('tells elements apart by id, else by place, and by group', () => {
    expect(sameItem(a, { ...a, block: 5 })).toBe(true);
    expect(sameItem(card(), card())).toBe(true);
    expect(sameItem(card(), card({ block: 1 }))).toBe(false);
    expect(sameItem(card({ group: { n: 1 } }), card({ group: { n: 2 } }))).toBe(false);
    expect(sameItem(r, { ...r, kind: 'write' } as QueueItem)).toBe(false);
  });

  it('the day is what is due, above the fold; a session over budget starts within it', () => {
    const later = card({ id: 'z', dueAt: new Date('2026-06-01') });
    expect(dueToday([a, b, r, later], NOW, 0)).toEqual([a, b, r]);
    expect(dueToday([a, b, r, later], NOW, 2)).toEqual([a, b]);
    expect(sessionItems(dueToday([a, b, r], NOW, 2), b)).toEqual([b, a]);
    expect(sessionItems(dueToday([a, b, r], NOW, 2), r)).toEqual([r]);
  });

  it('keeps a budget whole and never negative', () => {
    expect(cleanBudget(12)).toBe(12);
    expect(cleanBudget(7.9)).toBe(7);
    expect(cleanBudget(0)).toBe(0);
    expect(cleanBudget(-3)).toBe(0);
    expect(cleanBudget(undefined)).toBe(0);
    expect(cleanBudget('5')).toBe(0);
    expect(cleanBudget(Number.NaN)).toBe(0);
  });
});

describe('a session over the sample vault', () => {
  let root: string;
  let vault: Vault;

  beforeEach(async () => {
    root = await fsp.mkdtemp(join(tmpdir(), 'ilmi-session-'));
    await fsp.cp(CORPUS, root, { recursive: true });
    vault = await Vault.open(nodeFs, root);
  });

  afterEach(async () => {
    vault.close();
    await fsp.rm(root, { recursive: true, force: true });
  });

  it('writes every result to disk and leaves nothing due', async () => {
    const before = await queue(vault, NOW, 'today');
    expect(before).toHaveLength(19);
    const touched = new Set<string>();
    let ids = 0;
    for (const item of before) {
      touched.add(item.path);
      if (item.kind === 'card') {
        await vault.update(item.path, (doc) => { gradeItem(doc, item, 3, NOW, { newId: () => `cnew${ids++}` }); });
      } else if (item.kind === 'read') {
        await vault.update(item.path, (doc) => { advanceRead(doc, 'on', NOW, item.pos + 1); });
      } else {
        await vault.update(item.path, (doc) => { advanceWrite(doc, 'on', NOW); });
      }
    }
    expect(await queue(vault, NOW, 'today')).toEqual([]);
    // each file on disk parses clean and carries the new schedule
    for (const path of touched) {
      const text = await fsp.readFile(join(root, path), 'utf8');
      const { doc, diagnostics } = parse(text);
      expect(diagnostics, path).toEqual([]);
      const m = meta(doc);
      if (m.read) expect(m.read.due! > '2026-05-27').toBe(true);
      if (m.write && !m.write.done) expect(m.write.due! > '2026-05-27').toBe(true);
    }
    const woz = parse(await fsp.readFile(join(root, 'papers/wozniak-1990.md'), 'utf8')).doc;
    const leech = woz.blocks.find((b) => b.kind === 'card' && b.id === 'cw3-leech');
    expect(leech?.kind === 'card' && leech.sched?.last).toBe('2026-05-27T12:00:00Z');
    // the fresh card in german.md got an id and a line
    const german = parse(await fsp.readFile(join(root, 'german.md'), 'utf8')).doc;
    const wort = german.blocks.find((b) => b.kind === 'card' && b.text.startsWith('ein Wort'));
    expect(wort?.kind === 'card' && wort.id).toBe('cnew0');
    // the upcoming count grew by what was done, less the cards still in learning steps
    const all = await queue(vault, NOW);
    expect(all.filter((i) => i.dueAt > NOW)).toHaveLength(all.length);
  });

  it('a reading pass with the marker moves it forward, never back', async () => {
    const item = (await queue(vault, NOW, 'reading')).find((i) => i.path === 'papers/crick-1995.md');
    if (!item || item.kind !== 'read') throw new Error('no crick');
    expect(item.pos).toBe(2);
    await vault.update(item.path, (doc) => { advanceRead(doc, 'on', NOW, 1); });
    expect(meta((await vault.read(item.path)).doc).read?.pos).toBe(2);
    await vault.update(item.path, (doc) => { advanceRead(doc, 'on', NOW, 5); });
    expect(meta((await vault.read(item.path)).doc).read).toMatchObject({ pos: 5, reps: (item.sched.reps ?? 0) + 2 });
  });
});

describe('a source with a finish day (milestone 52)', () => {
  const at = new Date('2026-11-03T12:00:00');
  const read = (finish: { day: string; left: number; perPass: number; read?: number } | undefined, dueAt = at): ReadItem => ({ kind: 'read', path: 'a.md', sched: {}, pos: 6, total: 40, dueAt, pri: 50, ...(finish ? { finish: { read: 6, ...finish } } : {}) } as ReadItem);

  it('on pace while a pass a day from its next would finish by the day, behind once it would not; nothing else says anything', () => {
    expect(paceWords(read({ day: '2026-11-24', left: 27, perPass: 3 }), at)).toBe('on pace · 9 passes left');
    expect(paceWords(read({ day: '2026-11-10', left: 42, perPass: 3 }), at)).toBe('behind · 14 passes left');
    // eight days, the 3rd to the 10th, hold eight passes and no more
    expect(paceWords(read({ day: '2026-11-10', left: 8, perPass: 1 }), at)).toBe('on pace · 8 passes left');
    expect(paceWords(read({ day: '2026-11-10', left: 9, perPass: 1 }), at)).toBe('behind · 9 passes left');
    // a next pass further off has fewer days left to it
    expect(paceWords(read({ day: '2026-11-10', left: 8, perPass: 1 }, new Date('2026-11-05T00:00:00')), at)).toBe('behind · 8 passes left');
    expect(paceWords(read({ day: '2026-11-03', left: 1, perPass: 2 }), at)).toBe('on pace · 1 pass left');
    expect(paceWords(read(undefined), at)).toBe('');
    expect(paceWords(read({ day: '2026-11-02', left: 8, perPass: 1 }), at)).toBe('');
    expect(paceWords(read({ day: '2026-11-24', left: 0, perPass: 1 }), at)).toBe('');
    expect(paceWords(card({ sched: { ivl: 12 } }), at)).toBe('');
  });
});
