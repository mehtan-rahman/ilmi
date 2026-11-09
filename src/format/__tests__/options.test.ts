// Milestone 42 in the format: the study options as front-matter fields
// (FORMAT.md §3, *options*) on the corpus's deck and notebook and on a
// mangled file, and the review log's line (`reviews.ts`, FORMAT.md §1) read
// the way sync leaves it: interleaved devices, duplicates, torn lines, and
// grades given again in their session (`over`, the corpus's month).

import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { formatReview, meta, mergeReviews, overAt, parse, parseReviews, reviewFile, serialize, setField, type Review } from '../index.js';

const CORPUS = join(import.meta.dirname, 'corpus');
const read = (rel: string) => readFileSync(join(CORPUS, rel), 'utf8');

describe('options', () => {
  it('the corpus deck sets new cards a day and its leech rule; the notebook its retention and reviews cap', () => {
    const deck = parse(read('vault/german.md'));
    expect(deck.diagnostics).toEqual([]);
    const m = meta(deck.doc);
    expect([m.newPerDay, m.leech, m.leechAction, m.retention, m.reviewsPerDay]).toEqual([10, 6, 'suspend', undefined, undefined]);
    const nb = meta(parse(read('vault/courses/linear-algebra.md')).doc);
    expect([nb.retention, nb.reviewsPerDay, nb.newPerDay]).toEqual([0.85, 40, undefined]);
  });

  it('a bad value is a raw line with a diagnostic, a later good one wins, a comment is dropped on write', () => {
    const text = read('mangled/options.md');
    const { doc, diagnostics } = parse(text);
    const m = meta(doc);
    // -3, 0, 1.2, delete, and the empty one are not values; 0.880 is, and is written 0.88
    expect([m.newPerDay, m.reviewsPerDay, m.retention, m.leech, m.leechAction]).toEqual([undefined, undefined, 0.88, 8, undefined]);
    expect(diagnostics.map((d) => d.line)).toEqual([3, 4, 5, 7, 9]);
    const out = serialize(doc);
    expect(out.split('\n').slice(0, 11)).toEqual([
      '---', 'type: deck', 'new-per-day: -3', 'reviews-per-day: 0', 'retention: 1.2', 'leech: 8', 'leech-action: delete', 'retention: 0.88', 'new-per-day:', 'title: options, mangled', '---',
    ]);
    expect(parse(out).doc).toEqual(doc);
  });

  it('setField writes each canonically, appended, and clears it', () => {
    const { doc } = parse('---\ntype: deck\n---\n\na :: b\n');
    setField(doc, 'new-per-day', 0);
    setField(doc, 'reviews-per-day', 150);
    setField(doc, 'retention', 0.925);
    setField(doc, 'leech', 4);
    setField(doc, 'leech-action', 'suspend');
    expect(serialize(doc)).toBe('---\ntype: deck\nnew-per-day: 0\nreviews-per-day: 150\nretention: 0.925\nleech: 4\nleech-action: suspend\n---\n\na :: b\n');
    expect(meta(doc)).toMatchObject({ newPerDay: 0, reviewsPerDay: 150, retention: 0.925, leech: 4, leechAction: 'suspend' });
    for (const k of ['new-per-day', 'reviews-per-day', 'retention', 'leech', 'leech-action'] as const) setField(doc, k, null);
    expect(serialize(doc)).toBe('---\ntype: deck\n---\n\na :: b\n');
  });
});

const R = (over: Partial<Review> = {}): Review => ({ at: '2026-10-30T08:15:02Z', doc: 'arabic/vocabulary.md', card: 'voc-karam', g: 3, st: 'review', elapsed: 12, ivl: 10, next: 26, ...over });

describe('the review log', () => {
  it('one line per grade, keys in a fixed order, optional ones only when there', () => {
    expect(formatReview(R())).toBe('{"at":"2026-10-30T08:15:02Z","doc":"arabic/vocabulary.md","card":"voc-karam","g":3,"st":"review","elapsed":12,"ivl":10,"next":26}');
    expect(formatReview(R({ key: 'r', s: 25.31, d: 4.2, ms: 6400 }))).toBe('{"at":"2026-10-30T08:15:02Z","doc":"arabic/vocabulary.md","card":"voc-karam","key":"r","g":3,"st":"review","elapsed":12,"ivl":10,"next":26,"s":25.31,"d":4.2,"ms":6400}');
    expect(reviewFile('2026-10-30T08:15:02Z')).toBe('.ilmi/reviews/2026-10.jsonl');
  });

  it('reads back what it wrote, skipping a torn line, junk, and a line it does not know', () => {
    const a = R();
    const b = R({ at: '2026-10-30T08:16:00Z', card: 'voc-dayf', key: 'c2', g: 1, st: 'relearning', s: 1.2 });
    const text = [formatReview(a), '', 'not json', '{"at":"2026-10-30T08:17:00Z","doc":"x.md","card":"c","g":5,"st":"review","elapsed":0,"ivl":0,"next":0}', `${formatReview(b)}`, formatReview(a).slice(0, 40)].join('\n');
    expect(parseReviews(text)).toEqual([a, b]);
    // a newer app's extra keys are ignored, not fatal
    expect(parseReviews(JSON.stringify({ ...a, device: 'phone' }))).toEqual([a]);
    expect(parseReviews('\r\n')).toEqual([]);
  });

  it('merges two devices\' files and a conflict copy: duplicates once, oldest first', () => {
    const laptop = [R({ at: '2026-10-30T08:00:00Z' }), R({ at: '2026-10-30T09:00:00Z', card: 'b' })];
    const phone = [R({ at: '2026-10-30T08:30:00Z', card: 'c' }), R({ at: '2026-10-30T09:00:00Z', card: 'b' })];
    const conflict = [R({ at: '2026-10-30T08:00:00Z' })];
    const log = mergeReviews([laptop, phone, conflict]);
    expect(log.map((r) => `${r.at.slice(11, 16)} ${r.card}`)).toEqual(['08:00 voc-karam', '08:30 c', '09:00 b']);
  });

  // a card graded, gone back to, and graded again, twice (cv-wort); a reverse given again names
  // an instant only the bare line has (cv-haus); an `over` not before its own line's instant (cv-tag)
  it('a grade given again in its session replaces the line it names, in whatever order the lines are read', () => {
    const month = read('reviews/2026-11.jsonl');
    const lines = parseReviews(month);
    expect(lines.map((r) => r.over ?? null)).toEqual([null, null, '2026-11-09T08:00:00Z', '2026-11-09T08:00:40Z', '2026-11-09T08:00:10Z', null]);
    const counted = (log: Review[]) => log.map((r) => `${r.at.slice(11, 19)} ${r.card}${r.key ? ` ${r.key}` : ''} ${r.g}`);
    const want = ['08:00:10 cv-haus 1', '08:00:41 cv-wort 2', '08:02:00 cv-haus r 3', '08:03:00 cv-tag 4'];
    expect(counted(mergeReviews([lines]))).toEqual(want);
    // read backwards (a store orders a second's lines by their text), and with a conflict copy holding the first grade read last
    expect(counted(mergeReviews([[...lines].reverse(), lines.slice(0, 1)]))).toEqual(want);
    expect(counted(mergeReviews([lines.slice(3), lines.slice(0, 3)]))).toEqual(want);
    // written back as read, `over` last
    expect(lines.slice(0, 5).map(formatReview).join('\n')).toBe(month.split('\n').slice(0, 5).join('\n'));
    // a grade given again within the second of the one it replaces is logged a second after it
    expect(overAt('2026-11-09T08:00:00Z', '2026-11-09T08:00:00Z')).toBe('2026-11-09T08:00:01Z');
    expect(overAt('2026-11-09T08:00:05Z', '2026-11-09T08:00:00Z')).toBe('2026-11-09T08:00:05Z');
  });
});
