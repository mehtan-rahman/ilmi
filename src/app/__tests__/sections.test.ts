// @vitest-environment jsdom
// Milestone 47: every item says where it stands. The row's line for a
// section, a note revisited, an extract, a book and a draft; the marks and
// the queue's legend; the session's three actions in the same words
// everywhere; the bottom strip; the editor keeping a heading's line; the
// tree's due counts.

import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { formatBody, parse, type Heading } from '../../format/index.js';
import { docItems, type ReadItem, type SectionItem } from '../../schedule/index.js';
import { fromDoc, schema, toDoc } from '../../reader/index.js';
import { hintsFor } from '../chrome.js';
import { headingAtPos } from '../Reader.js';
import { QUEUE_LEGEND, glyphOf, isFresh, kindTag, nth, shortDay, standing, standsWords } from '../items.js';
import { rowCounts } from '../names.js';
import { actionWords, isBook } from '../Session.js';
import { headingOf, sectionActions, statusOf } from '../sections.js';

const NOW = new Date('2026-11-02T12:00:00Z');
const SAMPLE = join(import.meta.dirname, '../../../samples/double-major');
const CANON = 'courses/fall-2026/phys-415-stat-mech/canonical-ensemble.md';

const section = (over: Partial<SectionItem> = {}): SectionItem => ({
  kind: 'section', path: 'n.md', block: 0, heading: 'h', level: 2, trail: ['h'], sched: { made: '2026-10-29', due: '2026-11-02', ivl: 3 },
  written: false, cards: 0, dueAt: NOW, pri: 50, ...over,
});
const read = (over: Partial<ReadItem> = {}): ReadItem => ({ kind: 'read', path: 'b.md', sched: { ivl: 2, reps: 1 }, pos: 0, total: 10, dueAt: NOW, pri: 50, ...over });

describe('where it stands', () => {
  it('a section: what is under it, then how often it has been back', () => {
    expect(standing(section(), NOW)).toBe('made oct 29, nothing written yet · first time back');
    expect(standing(section({ sched: { made: '2026-10-29', due: '2026-11-02', boxes: '41:0:0:1:1' } }), NOW)).toBe('boxed oct 29, nothing written yet · first time back');
    expect(standing(section({ written: true }), NOW)).toBe('written, no cards yet · first time back');
    expect(standing(section({ written: true, cards: 3, sched: { made: '2026-10-19', reps: 1 } }), NOW)).toBe('written, 3 cards · back for the 2nd time');
    expect(standing(section({ cards: 1, sched: { reps: 2 } }), NOW)).toBe('written, 1 card · back for the 3rd time');
    expect(standing(section({ sched: { made: '2026-11-02', due: '2026-11-02' } }), NOW)).toBe('made nov 2, nothing written yet · new');
  });

  it('a note revisited and an extract say it in the same words; a book reads on from its page', () => {
    expect(standing(read({ note: true, written: true, cards: 2, sched: { reps: 3 } }), NOW)).toBe('written, 2 cards · back for the 4th time');
    expect(standing(read({ extract: true, written: true, cards: 0, sched: {} }), NOW)).toBe('written, no cards yet · first time back');
    expect(standing(read({ pdf: true, page: 42 }), NOW)).toBe('read on from p. 42');
    expect(standing(read({ pdf: true }), NOW, 41)).toBe('read on from p. 41');
    expect(standing(read({ pos: 3 }), NOW)).toBe('read on, 30% read');
    expect(standing(read(), NOW)).toBe('read from the start');
    expect(standing({ kind: 'write', path: 'd.md', sched: { reps: 1 }, dueAt: NOW, pri: 50 }, NOW)).toBe('pass 2');
  });

  it('counts in English', () => {
    expect([1, 2, 3, 4, 11, 12, 13, 21, 22, 101].map(nth)).toEqual(['1st', '2nd', '3rd', '4th', '11th', '12th', '13th', '21st', '22nd', '101st']);
    expect(shortDay('2026-10-29')).toBe('oct 29');
    expect(standsWords({ written: false, cards: 0 }, NOW)).toBe('nothing written yet · first time back');
  });

  it('the sample\'s two sections say where they stand', () => {
    const doc = parse(readFileSync(join(SAMPLE, CANON), 'utf8')).doc;
    const s = docItems(CANON, doc, NOW).filter((i) => i.kind === 'section');
    expect(s.map((i) => standing(i, NOW))).toEqual(['written, no cards yet · first time back', 'written, 4 cards · back for the 3rd time']);
  });
});

describe('the marks', () => {
  it('“ a book, § what comes back until dismissed, ◆ a card, ✎ a draft', () => {
    expect(glyphOf(read())).toBe('“');
    expect(glyphOf(read({ note: true }))).toBe('§');
    expect(glyphOf(read({ extract: true }))).toBe('§');
    expect(glyphOf(section())).toBe('§');
    expect(glyphOf({ kind: 'write', path: 'd.md', sched: {}, dueAt: NOW, pri: 50 })).toBe('✎');
    expect(kindTag(section())).toBe('section');
    expect(kindTag(read({ extract: true }))).toBe('extract');
    expect(isFresh(section())).toBe(false);
  });

  it('the queue\'s head in one line', () => {
    expect(['in priority order', ...QUEUE_LEGEND.map(([g, , w]) => `${g} ${w}`)].join(' · '))
      .toBe('in priority order · “ read on in a book · § a passage or section, back until you dismiss it · ◆ a card');
  });
});

describe('the three actions', () => {
  it('next · back in Nd, later, dismiss; a book\'s ⏎ is done for today', () => {
    expect(actionWords(section(), NOW)).toEqual({ on: 'next · back in 5d', postpone: 'later', done: 'dismiss' });
    expect(actionWords(read({ note: true, sched: { ivl: 5 } }), NOW).on).toBe('next · back in 8d');
    // a source with reading left comes back on the cadence of its priority, whatever its interval
    expect(actionWords(read(), NOW).on).toBe('done for today · back in 2d');
    expect(actionWords(read({ pri: 20 }), NOW).on).toBe('done for today · back in 1d');
    expect(actionWords(read({ pri: 70, sched: { ivl: 30 } }), NOW).on).toBe('done for today · back in 3d');
    // read to its end, it grows; and ⏎ at the end reads dismiss
    expect(actionWords(read({ pos: 3, total: 3 }), NOW).on).toBe('done for today · back in 3d');
    expect(actionWords(read({ pos: 3, total: 3 }), NOW, true).on).toBe('dismiss');
    // a section sixty days late grows from the time elapsed
    expect(actionWords(section(), new Date('2027-01-01T12:00:00Z')).on).toBe('next · back in 101d');
    expect(actionWords({ kind: 'write', path: 'd.md', sched: { ivl: 2 }, dueAt: NOW, pri: 50 }, NOW).on).toBe('next · back in 3d');
    expect(isBook(read({ extract: true }))).toBe(false);
  });

  it('the bottom strip says the same', () => {
    const keys = (el: 'read' | 'write' | 'section', note = false) => hintsFor({ kind: 'session', el, scope: null, canEnrol: false, note }).slice(0, 3).map(([k, w]) => `${k} ${w}`);
    expect(keys('section')).toEqual(['⏎ next', 'p later', 'd dismiss']);
    expect(keys('read')).toEqual(['⏎ done for today', 'p later', 'd dismiss']);
    expect(keys('read', true)).toEqual(['⏎ next', 'p later', 'd dismiss']);
    expect(keys('write')).toEqual(['⏎ next', 'p later', 'd dismiss']);
  });

  it('a heading offers one thing by its state: come back, dismiss, bring back', () => {
    const at = { path: 'n.md', nth: 0, text: 'h' };
    expect(sectionActions(statusOf(undefined), at).map((a) => a.label)).toEqual(['come back']);
    expect(sectionActions(statusOf({ due: '2026-11-02' }), at).map((a) => a.label)).toEqual(['dismiss']);
    expect(sectionActions(statusOf({ made: '2026-10-20', boxes: '41:0:0:1:1' }), at).map((a) => a.label)).toEqual(['bring back']);
  });

  it('finds the caret\'s heading among the page\'s headings, by place, else by its text', () => {
    const doc = parse('# a\n\n## b\n\ntext\n\n## c\n').doc;
    expect(headingOf(doc, { nth: 2, text: 'c' })?.index).toBe(3);
    expect(headingOf(doc, { nth: 0, text: 'c' })?.index).toBe(3);
    expect(headingOf(doc, { nth: 0, text: 'gone' })).toBeNull();
  });
});

describe('the editor', () => {
  it('keeps a heading\'s line through the editor, byte for byte', () => {
    const text = '## a\n<!-- read made=2026-10-30 due=2026-11-02 ivl=3 -->\n\nText.\n\nb\n---\n<!-- read made=2026-10-20 boxes=41:0.000:0.000:1.000:1.000 -->';
    const blocks = parse(text).doc.blocks;
    expect(formatBody(fromDoc(toDoc(blocks)))).toBe(text);
  });

  it('a heading split in two leaves the line on the first half', () => {
    const blocks = parse('## ab\n<!-- read due=2026-11-02 -->\n').doc.blocks;
    const h = toDoc(blocks).child(0);
    // ProseMirror's split gives both halves the one line it held
    const both = schema.nodes.doc!.create(null, [schema.nodes.heading!.create(h.attrs, schema.text('a')), schema.nodes.heading!.create(h.attrs, schema.text('b'))]);
    const out = fromDoc(both) as Heading[];
    expect(out[0]!.read).toEqual({ due: '2026-11-02' });
    expect(out[1]!.read).toBeUndefined();
  });

  it('the caret\'s heading: the block the caret is in, not its place among the inline children', () => {
    const pm = toDoc(parse('## a\n\none\n\n## b\n<!-- read due=2026-11-02 -->\n\ntwo $x$ three\n').doc.blocks);
    let posB = -1;
    let posTwo = -1;
    pm.forEach((n, off) => { if (n.textContent === 'b') posB = off; if (n.textContent.startsWith('two')) posTwo = off; });
    // at the end of heading b, and at the end of the paragraph under it (past the math chip)
    expect(headingAtPos(pm, posB + 2)?.text).toBe('b');
    expect(headingAtPos(pm, posTwo + pm.nodeAt(posTwo)!.content.size)?.text).toBe('b');
    expect(headingAtPos(pm, 2)?.text).toBe('a');
    expect(headingAtPos(pm, posB + 2)?.nth).toBe(1);
  });

  it('marks an enrolled heading, and a dismissed one', () => {
    const pm = toDoc(parse('## a\n<!-- read due=2026-11-02 -->\n\n## b\n<!-- read boxes=1:0:0:1:1 -->\n\n## c\n').doc.blocks);
    const attrs = [0, 1, 2].map((i) => (schema.nodes.heading!.spec.toDOM!(pm.child(i)) as [string, Record<string, string>])[1]['data-read']);
    expect(attrs).toEqual(['on', 'dismissed', undefined]);
  });
});

describe('the tree', () => {
  it('a document\'s due count includes its sections', () => {
    const node = { kind: 'doc' as const, path: 'n.md', name: 'n' };
    const r = rowCounts(node, { type: 'note', frozen: false, cards: 4, due: 2, sections: 1 }, NOW);
    expect(r.due).toBe(3);
    expect(r.full).toBe('4 cards, 2 due; 1 section due');
  });
});

