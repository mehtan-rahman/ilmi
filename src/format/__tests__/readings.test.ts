// What was read, logged beside the grades (`reviews.ts`, FORMAT.md §1, *a
// reading line*): the corpus month holds both kinds mixed, as a store
// writes a month out. Why the format has the line: nothing else says that
// a source was read on, or when an extract was made; a pass writes its
// `read` line over the last one.

import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { formatLogLine, formatReading, isReading, mergeReadings, mergeReviews, parseLog, parseReadings, parseReviews, type Reading, type ReadingLine } from '../index.js';

const month = readFileSync(join(import.meta.dirname, 'corpus/reviews/2026-12.jsonl'), 'utf8');

describe('reading lines in the review log', () => {
  it('one line per thing read, keys in a fixed order, optional ones only when there', () => {
    expect(formatReading({ at: '2026-12-01T08:05:00Z', doc: 'papers/wozniak-1990.md', read: 'pass' })).toBe('{"at":"2026-12-01T08:05:00Z","doc":"papers/wozniak-1990.md","read":"pass"}');
    expect(formatReading({ at: '2026-12-01T08:05:00Z', doc: 'a.md', read: 'pass', ms: 9, to: 14, sec: 'one' })).toBe('{"at":"2026-12-01T08:05:00Z","doc":"a.md","read":"pass","sec":"one","to":14,"ms":9}');
    expect(formatReading({ at: '2026-12-01T08:06:00Z', doc: 'a.md', read: 'undo', of: '2026-12-01T08:05:00Z', sec: 'one' })).toBe('{"at":"2026-12-01T08:06:00Z","doc":"a.md","read":"undo","sec":"one","of":"2026-12-01T08:05:00Z"}');
  });

  it('a reader of reviews skips them: the month\'s grades are its two, whatever lies between', () => {
    expect(parseReviews(month).map((r) => r.card)).toEqual(['cv-wort', 'cv-haus']);
    expect(mergeReviews([parseReviews(month)]).length).toBe(2);
    // and a reader of readings skips the grades, a `read` word it does not know, and the torn line
    const lines = parseReadings(month);
    expect(lines.map((r) => r.read)).toEqual(['pass', 'extract', 'section', 'pass', 'later', 'undo', 'pass', 'pass', 'done', 'undo', 'done']);
    expect(lines.every(isReading)).toBe(true);
  });

  it('reads back what it wrote: every line of the month it knows, written again, is the line', () => {
    const known = month.split('\n').filter((l) => l && !l.includes('"skim"') && !l.includes('"device"') && l.endsWith('}'));
    expect(parseLog(month).length).toBe(known.length + 1);
    expect(parseLog(known.join('\n')).map(formatLogLine)).toEqual(known);
    // a newer app's extra key is ignored, not fatal; a number that is not one is left out
    expect(parseReadings('{"at":"2026-12-02T09:41:00Z","doc":"papers/maxwell.md","read":"done","device":"phone"}')).toEqual([{ at: '2026-12-02T09:41:00Z', doc: 'papers/maxwell.md', read: 'done' }]);
    expect(parseReadings('{"at":"2026-12-02T09:41:00Z","doc":"a.md","read":"pass","to":null,"ms":-4}')).toEqual([{ at: '2026-12-02T09:41:00Z', doc: 'a.md', read: 'pass' }]);
    // a section that is not text is not a line (as a grade's `key` that is not one)
    expect(parseReadings('{"at":"2026-12-02T09:41:00Z","doc":"a.md","read":"pass","sec":null}')).toEqual([]);
    expect(parseReadings('{"at":"2026-12-02","doc":"a.md","read":"pass"}\n{"at":"2026-12-02T09:41:00Z","read":"pass"}\n{"at":"2026-12-02T09:41:00Z","doc":"a.md","read":"undo"}')).toEqual([]);
  });

  it('merged: a line seen twice once, a line taken back left out with the line that took it back, oldest first', () => {
    const say = (log: Reading[]) => log.map((r) => `${r.at.slice(8, 16)} ${r.read} ${r.doc.split('/').pop()}${r.sec ? ` § ${r.sec}` : ''}`);
    const want = [
      '01T08:05 pass wozniak-1990.md', '01T08:06 extract wozniak-1990.md', '01T08:07 section notes-on-alone.md § the first night', '01T08:09 pass notes-on-alone.md § the first night',
      '02T09:00 pass marginalia.md', '02T09:41 done maxwell.md',
    ];
    const lines = parseReadings(month);
    expect(say(mergeReadings([lines]))).toEqual(want);
    // in whatever order the lines are read, and with a conflict copy holding some of them again
    expect(say(mergeReadings([[...lines].reverse(), lines.slice(0, 4)]))).toEqual(want);
    // an undo names its document and its section: the document's own line at that instant stays
    const at = '2026-12-03T10:00:00Z';
    const both: ReadingLine[] = [{ at, doc: 'a.md', read: 'done' }, { at, doc: 'a.md', read: 'done', sec: 'one' }, { at: '2026-12-03T10:00:09Z', doc: 'a.md', read: 'undo', sec: 'one', of: at }];
    expect(mergeReadings([both])).toEqual([{ at, doc: 'a.md', read: 'done' }]);
  });
});
