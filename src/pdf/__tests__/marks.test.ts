// What is left on a book's pages (milestone 77): the file a PDF's marks are
// kept in (`src/vault/marks.ts`: read, written, byte-stable, an entry it
// does not know carried), and the pure side of the five features
// (`src/pdf/marks.ts`): the lists, a selection's rectangles as a highlight's
// quads, the highlight under a point, the portal read past, a page's lines
// as the ruler's bands and the step from one to the next.

import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import { entryText, markOf, marksDiff, marksHashOf, marksMap, marksMerged, marksPath, marksText, parseMarks, passageId, serializeMarks, type Marks } from '../../vault/marks.js';
import {
  bandNear, bookmarksOf, collectionMark, collectionMarks, headingAbove, highlightAt, highlightHolding, highlightOf, highlightsOf, isCollectionMark, letterId, lettersOf, lineBands, lineQuads,
  linesOf, newMarkId, passageMarksOf, placeOf, portalAbove, portalsOf, quadBoxes, stepLine, type PageItem,
} from '../index.js';

const HASH = 'e62fd1f4eb0a178c36c48f6bd48151a80de36f4a29eb880195aa9e58a61e61d1';
const CORPUS = fileURLToPath(new URL(`../../format/__tests__/corpus/vault/.ilmi/marks/${HASH}.json`, import.meta.url));
const corpus = readFileSync(CORPUS, 'utf8');

describe('the file', () => {
  it('is found by the pdf\'s hash, and only a file of that name is one', () => {
    expect(marksPath(HASH)).toBe(`.ilmi/marks/${HASH}.json`);
    expect(marksHashOf(marksPath(HASH))).toBe(HASH);
    expect(marksHashOf(`${HASH}.json`)).toBe(HASH);
    expect(marksHashOf(`.ilmi/plugins/${HASH}.json`)).toBeNull();
    expect(marksHashOf('.ilmi/marks/notes.json')).toBeNull();
    expect(marksHashOf(`.ilmi/marks/${HASH.toUpperCase()}.json`)).toBeNull();
  });

  it('the corpus\'s file reads as its four kinds and is written back byte for byte, the entry it does not know with them', () => {
    const marks = parseMarks(corpus);
    expect(Object.keys(marks)).toEqual(['b-41c07e9a52d3', 'h-0d9b6f3e1a77', 'm-A', 'm-a', 'p-7e2c15b8a904']);
    expect(marks['b-41c07e9a52d3']).toEqual({ kind: 'bookmark', name: '3.3 · average values', page: 2, y: 0.3142, at: 1794787200000 });
    expect(marks['h-0d9b6f3e1a77']).toMatchObject({ kind: 'highlight', ink: 2, page: 1, quads: [[1, 0.1176, 0.2203, 0.7647, 0.0152], [1, 0.1176, 0.2386, 0.4118, 0.0152]] });
    expect(marks['p-7e2c15b8a904']).toMatchObject({ kind: 'portal', page: 1, y: 0.6, to: { page: 2, y: 0.25 } });
    const all = marksMap(corpus)!;
    const rest = Object.fromEntries(Object.entries(all).filter(([k]) => !(k in marks)));
    expect(Object.keys(rest)).toEqual(['x-from-a-later-version']);
    expect(serializeMarks(marks, rest)).toBe(corpus);
    expect(marksText(all)).toBe(corpus);
  });

  it('is the same bytes whatever order the entries and their fields were given in', () => {
    const a = marksText({ 'b-2': { page: 3, kind: 'bookmark', y: 0.5, name: 'two', at: 2 }, 'b-1': { kind: 'bookmark', name: 'one', at: 1, y: 0.25, page: 1 } });
    const b = marksText({ 'b-1': { at: 1, kind: 'bookmark', name: 'one', page: 1, y: 0.25 }, 'b-2': { at: 2, kind: 'bookmark', name: 'two', page: 3, y: 0.5 } });
    expect(a).toBe(b);
    expect(a.endsWith('}\n')).toBe(true);
    expect(a.indexOf('"b-1"')).toBeLessThan(a.indexOf('"b-2"'));
  });

  it('an entry that does not read is in no list; a file that is not one holds none', () => {
    expect(markOf({ kind: 'bookmark', page: 0, y: 0.5, name: 'x' })).toBeNull();
    expect(markOf({ kind: 'bookmark', page: 1, y: 0.5 })).toBeNull();
    expect(markOf({ kind: 'mark', page: 1, y: 0.5, letter: 'ab' })).toBeNull();
    expect(markOf({ kind: 'highlight', page: 1, y: 0.5, text: 'x', quads: [] })).toBeNull();
    expect(markOf({ kind: 'highlight', page: 1, y: 0.5, text: 'x', quads: [[1, 0.1, 0.2, 0.3]] })).toBeNull();
    expect(markOf({ kind: 'portal', page: 1, y: 0.5, to: { page: 2 } })).toBeNull();
    // a place is a page and a fraction of it, to four decimals; an ink out of range is the first
    expect(markOf({ kind: 'highlight', page: 1, y: 0.123456, text: 'x', quads: [[1, 0.1, 0.2, 0.3, 0.01]], ink: 9, at: 5 })).toMatchObject({ y: 0.1235, ink: 1 });
    expect(markOf({ kind: 'portal', page: 1, y: 0.5, to: { page: 2, y: 0.1, pdf: 'nope' }, at: 1 })).toEqual({ kind: 'portal', page: 1, y: 0.5, to: { page: 2, y: 0.1 }, at: 1 });
    expect(parseMarks('not json')).toEqual({});
    expect(parseMarks('[1, 2]')).toEqual({});
    expect(marksMap('{"a": 1}')).toBeNull();
    expect(parseMarks(null)).toEqual({});
  });

  it('what changed between two files is an entry each, and the registers laid over a file give it back', () => {
    const was = { a: { kind: 'bookmark', name: 'a', page: 1, y: 0, at: 1 }, b: { kind: 'bookmark', name: 'b', page: 2, y: 0, at: 2 } };
    const now = { b: { at: 2, y: 0, page: 2, name: 'b', kind: 'bookmark' }, c: { kind: 'bookmark', name: 'c', page: 3, y: 0, at: 3 }, a: { kind: 'bookmark', name: 'A', page: 1, y: 0, at: 1 } };
    const diff = marksDiff(was, now);
    // the same entry with its fields in another order is no change
    expect(diff.map(([id, v]) => [id, v === null ? null : 'set'])).toEqual([['a', 'set'], ['c', 'set']]);
    expect(marksDiff(now, was).map(([id, v]) => [id, v === null ? null : 'set'])).toEqual([['a', 'set'], ['c', null]]);
    expect(marksMerged(was, diff)).toEqual(now);
    expect(marksMerged(now, [['c', null], ['zz', 'not json'], ['a', entryText(was.a)]])).toEqual(was);
  });
});

const bm = (name: string, page: number, y: number, at = 0) => ({ kind: 'bookmark' as const, name, page, y, at });
const hl = (page: number, y: number, at = 0, w = 0.5) => ({ kind: 'highlight' as const, text: `p${page}`, page, y, quads: [[page, 0.1, y, w, 0.02] as [number, number, number, number, number]], ink: 1, at });
const portal = (page: number, y: number, to: number) => ({ kind: 'portal' as const, page, y, to: { page: to, y: 0.5 }, at: 0 });
const letter = (l: string, page: number, at: number) => ({ kind: 'mark' as const, letter: l, page, y: 0.5, at });

describe('a passage', () => {
  const BOXES = '41:0.120:0.860:0.770:0.075,42:0.100:0.097:0.770:0.040';
  const entry = { kind: 'passage', page: 41, y: 0.86, at: 1794787200000, boxes: BOXES, made: '2026-10-30', due: '2026-11-02', ivl: 3, reps: 1, pri: 30 };

  it('is an entry keyed by its boxes, read and written back byte for byte', () => {
    expect(passageId(BOXES)).toBe(`s-${BOXES}`);
    const text = marksText({ [passageId(BOXES)]: entry });
    expect(text).toBe(`{\n  "s-${BOXES}": {\n    "at": 1794787200000,\n    "boxes": "${BOXES}",\n    "due": "2026-11-02",\n    "ivl": 3,\n    "kind": "passage",\n    "made": "2026-10-30",\n    "page": 41,\n    "pri": 30,\n    "reps": 1,\n    "y": 0.86\n  }\n}\n`);
    const marks = parseMarks(text);
    expect(marks[passageId(BOXES)]).toEqual(entry);
    expect(serializeMarks(marks)).toBe(text);
    expect(passageMarksOf(marks).map(([k]) => k)).toEqual([passageId(BOXES)]);
  });

  it('with no due is one dismissed: its boxes and the day it was made kept', () => {
    const m = markOf({ kind: 'passage', page: 41, y: 0.86, at: 1, boxes: BOXES, made: '2026-10-30' });
    expect(m).toEqual({ kind: 'passage', page: 41, y: 0.86, at: 1, boxes: BOXES, made: '2026-10-30' });
  });

  it('boxes written otherwise are read canonically; boxes not in the grammar make it no passage, kept in the file all the same', () => {
    expect(markOf({ kind: 'passage', page: 41, y: 0.86, at: 1, boxes: '41:0.12:0.86:0.77:0.075' })).toMatchObject({ boxes: '41:0.120:0.860:0.770:0.075' });
    expect(markOf({ kind: 'passage', page: 41, y: 0.86, at: 1, boxes: 'somewhere' })).toBeNull();
    expect(markOf({ kind: 'passage', page: 41, y: 0.86, at: 1 })).toBeNull();
    // a value that does not read is left out, the rest of the line kept
    expect(markOf({ kind: 'passage', page: 41, y: 0.86, at: 1, boxes: BOXES, due: 'soon', ivl: -2, af: 1, pri: 400 })).toEqual({ kind: 'passage', page: 41, y: 0.86, at: 1, boxes: BOXES });
  });

  it('is listed in the book\'s order beside the other kinds, and two devices\' passages merge entry by entry', () => {
    const a = { ...entry, page: 43, y: 0.1, boxes: '43:0.100:0.100:0.500:0.100' };
    const marks = parseMarks(marksText({ 'b-1': { kind: 'bookmark', name: 'x', page: 1, y: 0, at: 1 }, [passageId(a.boxes)]: a, [passageId(BOXES)]: entry }));
    expect(passageMarksOf(marks).map(([, m]) => m.page)).toEqual([41, 43]);
    expect(bookmarksOf(marks).length).toBe(1);
    // one device passed the first, the other boxed a third: both stand
    const passed = { ...entry, due: '2026-11-09', ivl: 7, reps: 2 };
    const third = { ...entry, page: 44, y: 0.5, boxes: '44:0.100:0.500:0.500:0.100' };
    const base = { [passageId(BOXES)]: entry };
    const merged = marksMerged(base, [...marksDiff(base, { [passageId(BOXES)]: passed }), ...marksDiff(base, { ...base, [passageId(third.boxes)]: third })]);
    expect(parseMarks(marksText(merged))).toEqual({ [passageId(BOXES)]: passed, [passageId(third.boxes)]: third });
  });
});

describe('the lists', () => {
  const marks: Marks = { 'b-2': bm('later', 7, 0.2), 'b-1': bm('first', 2, 0.9), 'b-3': bm('same page, above', 7, 0.1), 'h-1': hl(4, 0.3), 'p-1': portal(3, 0.5, 9), 'm-b': letter('b', 5, 1), 'm-a': letter('a', 6, 2), 'm-A': letter('A', 1, 3) };
  it('are each kind\'s, in the book\'s order; the letters in theirs', () => {
    expect(bookmarksOf(marks).map(([k]) => k)).toEqual(['b-1', 'b-3', 'b-2']);
    expect(highlightsOf(marks).map(([k]) => k)).toEqual(['h-1']);
    expect(portalsOf(marks).map(([k]) => k)).toEqual(['p-1']);
    expect(lettersOf(marks).map(([, m]) => m.letter)).toEqual(['A', 'a', 'b']);
  });
  it('a letter\'s key is the letter, so a mark set again moves; a capital is the collection\'s', () => {
    expect(letterId('a')).toBe('m-a');
    expect(letterId('A')).not.toBe(letterId('a'));
    expect(isCollectionMark('A')).toBe(true);
    expect(isCollectionMark('a')).toBe(false);
    expect(newMarkId('b', () => 0.5)).toBe('b-888888888888');
    expect(placeOf(3, 0.123456)).toEqual({ page: 3, y: 0.1235 });
    expect(placeOf(3, -0.2)).toEqual({ page: 3, y: 0 });
  });
  it('of two books\' marks of one capital the one set last is the collection\'s', () => {
    const all: [string, Marks][] = [['h1', { 'm-A': letter('A', 3, 10), 'm-B': letter('B', 1, 1) }], ['h2', { 'm-A': letter('A', 8, 20), 'm-a': letter('a', 2, 99) }]];
    expect(collectionMark(all, 'A')).toMatchObject({ hash: 'h2', mark: { page: 8 } });
    expect(collectionMark(all, 'C')).toBeNull();
    expect(collectionMarks(all).map((m) => `${m.mark.letter}:${m.hash}`)).toEqual(['A:h2', 'B:h1']);
  });
});

describe('a highlight', () => {
  it('a selection\'s rectangles are a quad a line: runs on one line joined, one given twice once', () => {
    const quads = lineQuads(3, [
      { x: 0.5, y: 0.2, w: 0.3, h: 0.02 }, { x: 0.1, y: 0.201, w: 0.4, h: 0.019 }, { x: 0.1, y: 0.201, w: 0.4, h: 0.019 },
      { x: 0.1, y: 0.23, w: 0.2, h: 0.02 }, { x: 0, y: 0, w: 0, h: 0.02 },
    ]);
    expect(quads).toEqual([[3, 0.1, 0.2, 0.7, 0.02], [3, 0.1, 0.23, 0.2, 0.02]]);
  });
  it('is found under a point, the later of two that overlap; a selection inside one is in it', () => {
    const marks: Marks = { old: hl(2, 0.3, 1), young: hl(2, 0.31, 2, 0.2), other: hl(5, 0.3, 3) };
    expect(highlightAt(marks, 2, 0.2, 0.315)).toBe('young');
    expect(highlightAt(marks, 2, 0.5, 0.305)).toBe('old');
    expect(highlightAt(marks, 2, 0.5, 0.6)).toBeNull();
    expect(highlightAt(marks, 3, 0.2, 0.31)).toBeNull();
    expect(highlightHolding(marks, [[2, 0.4, 0.3, 0.1, 0.02]])).toBe('old');
    expect(highlightHolding(marks, [[2, 0.4, 0.3, 0.1, 0.02], [2, 0.1, 0.5, 0.1, 0.02]])).toBeNull();
    expect(highlightHolding(marks, [])).toBeNull();
  });
  it('is made at its first line; its quads are a section\'s boxes, one a page', () => {
    const h = highlightOf([[4, 0.1, 0.05, 0.3, 0.02], [3, 0.1, 0.9, 0.8, 0.02], [3, 0.1, 0.93, 0.2, 0.02]], '  two\n pages ', 2, 7)!;
    expect(h).toMatchObject({ kind: 'highlight', page: 3, y: 0.9, text: 'two pages', ink: 2, at: 7 });
    expect(h.quads.map((q) => q[0])).toEqual([3, 3, 4]);
    const boxes = quadBoxes(h.quads);
    expect(boxes.map((b) => b.page)).toEqual([3, 4]);
    expect(boxes[0]!.y).toBeCloseTo(0.896, 3);
    expect(boxes[0]!.h).toBeCloseTo(0.058, 3);
    expect(highlightOf([], 'x', 1, 0)).toBeNull();
  });
});

describe('a portal', () => {
  it('is followed from its source on: the nearest source at or above the place read', () => {
    const list = portalsOf({ a: portal(2, 0.5, 9), b: portal(4, 0.2, 10), c: portal(4, 0.8, 11) });
    expect(portalAbove(list, { page: 1, y: 0.9 })).toBeNull();
    expect(portalAbove(list, { page: 2, y: 0.4 })).toBeNull();
    expect(portalAbove(list, { page: 2, y: 0.5 })?.[0]).toBe('a');
    expect(portalAbove(list, { page: 3, y: 0 })?.[0]).toBe('a');
    expect(portalAbove(list, { page: 4, y: 0.5 })?.[0]).toBe('b');
    expect(portalAbove(list, { page: 9, y: 0 })?.[0]).toBe('c');
  });
});

describe('the ruler', () => {
  const bits = [
    { str: 'A heading', eol: true, y: 700, height: 20 },
    { str: 'first line', eol: true, y: 660, height: 10 },
    { str: 'left column', eol: true, y: 640, height: 10 },
    { str: 'right column', eol: true, y: 640.5, height: 10 },
    { str: '', eol: true, y: 620, height: 0 },
    { str: 'last', eol: true, y: 100, height: 10 },
  ];
  it('a page\'s lines are bands down the page, top to bottom, runs on one baseline one band', () => {
    const bands = lineBands(linesOf(bits), 800);
    expect(bands).toHaveLength(4);
    // a 20pt line whose baseline is 700 up an 800pt page: from its ascent to its descent
    expect(bands[0]!.top).toBeCloseTo(0.105, 4);
    expect(bands[0]!.bottom).toBeCloseTo(0.1313, 3);
    expect(bands[1]!.top).toBeCloseTo(0.165, 4);
    expect(bands[1]!.bottom).toBeCloseTo(0.1781, 3);
    expect(bands.every((b, i) => i === 0 || b.top >= bands[i - 1]!.bottom)).toBe(true);
    expect(lineBands(linesOf(bits), 0)).toEqual([]);
  });
  it('the band nearest a place is the one it is in, else the one whose middle is closest', () => {
    const bands = lineBands(linesOf(bits), 800);
    expect(bandNear(bands, 0.11)).toBe(0);
    expect(bandNear(bands, 0.15)).toBe(1);
    expect(bandNear(bands, 0.6)).toBe(3);
    expect(bandNear([], 0.5)).toBe(-1);
  });
  it('steps a line at a time, over a page\'s end onto the next page with lines, and stops at the book\'s ends', async () => {
    const counts: Record<number, number> = { 3: 2, 4: 0, 5: 3 };
    const on = async (n: number) => counts[n] ?? 0;
    expect(await stepLine({ page: 3, line: 0 }, 1, on, 3, 5)).toEqual({ page: 3, line: 1 });
    expect(await stepLine({ page: 3, line: 1 }, 1, on, 3, 5)).toEqual({ page: 5, line: 0 });
    expect(await stepLine({ page: 5, line: 0 }, -1, on, 3, 5)).toEqual({ page: 3, line: 1 });
    expect(await stepLine({ page: 5, line: 2 }, 1, on, 3, 5)).toBeNull();
    expect(await stepLine({ page: 3, line: 0 }, -1, on, 3, 5)).toBeNull();
    // a page with no lines of its own: from before its first, the next page's first
    expect(await stepLine({ page: 4, line: -1 }, 1, on, 3, 5)).toEqual({ page: 5, line: 0 });
  });
});

describe('a bookmark\'s name', () => {
  const item = (s: string, x: number, y: number, h = 10): PageItem => ({ s, x, y, h });
  const pages: Record<number, PageItem[]> = {
    1: [item('3.2', 0.1, 0.2, 14), item('Entropy', 0.2, 0.2, 14), item('body text of the page that sets the size', 0.1, 0.3)],
    2: [item('more body text, a long line of it', 0.1, 0.2), item('3.3', 0.1, 0.6, 14), item('Average values', 0.2, 0.6, 14), item('and body under the heading here', 0.1, 0.7)],
  };
  const itemsOf = (n: number) => pages[n];
  it('is the nearest numbered heading at or above the place, read back over the pages before', () => {
    expect(headingAbove(itemsOf, 1, 2, 0.8)).toBe('3.3 · average values');
    expect(headingAbove(itemsOf, 1, 2, 0.4)).toBe('3.2 · entropy');
    expect(headingAbove(itemsOf, 2, 2, 0.4)).toBeNull();
    expect(headingAbove(itemsOf, 1, 1, 0.1)).toBeNull();
  });
});
