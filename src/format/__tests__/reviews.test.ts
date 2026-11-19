// A grade's line in the review log (FORMAT.md §1): what only the moment of
// the grade knew is written after the rest, each key absent when not known;
// a line without them reads as it always did, a key this app does not know
// is kept and written back, and all of it survives a merge.

import { describe, expect, it } from 'vitest';
import { formatLogLine, formatReview, mergeReviews, parseLog, parseReviews, type Review } from '../index.js';
import { lineRow, reviewRow } from '../../vault/store.js';

const OLD = '{"at":"2026-10-30T08:15:02Z","doc":"arabic/vocabulary.md","card":"voc-karam","key":"r","g":3,"st":"review","elapsed":12,"ivl":10,"next":26,"s":25.31,"d":4.2,"ms":6400}';
const NEW = '{"at":"2026-11-20T21:40:11Z","doc":"arabic/vocabulary.md","card":"voc-karam","key":"r","g":1,"st":"review","elapsed":21,"ivl":26,"next":0,"s":4.1,"d":5.3,"ms":60000,"tz":60,"time":94210,"form":"bidir","did":"3fa9c0d17b2e","n":14,"ret":0.85,"by":"fsrs-7"}';

describe('a grade\'s line', () => {
  it('a line from before the moment was kept reads and writes as it did, byte for byte', () => {
    const [r] = parseReviews(OLD);
    expect(r).toEqual({ at: '2026-10-30T08:15:02Z', doc: 'arabic/vocabulary.md', card: 'voc-karam', key: 'r', g: 3, st: 'review', elapsed: 12, ivl: 10, next: 26, s: 25.31, d: 4.2, ms: 6400 });
    expect(formatReview(r!)).toBe(OLD);
  });

  it('what the moment knew is read and written back in its order, after the rest', () => {
    const [r] = parseReviews(NEW);
    expect(r).toMatchObject({ ms: 60000, tz: 60, time: 94210, form: 'bidir', did: '3fa9c0d17b2e', n: 14, ret: 0.85, by: 'fsrs-7' });
    expect(r).not.toHaveProperty('step');
    expect(r).not.toHaveProperty('extra');
    expect(formatReview(r!)).toBe(NEW);
    // west of UTC, at UTC, in its steps
    const west = parseReviews(NEW.replace('"tz":60', '"tz":-300').replace('"by":"fsrs-7"', '"step":1'))[0]!;
    expect([west.tz, west.step, west.by]).toEqual([-300, 1, undefined]);
    expect(parseReviews(NEW.replace('"tz":60', '"tz":0'))[0]!.tz).toBe(0);
  });

  it('one of them that is not what it should be is left out, and the line still counts', () => {
    const bad = NEW.replace('"tz":60', '"tz":"paris"').replace('"time":94210', '"time":-1').replace('"form":"bidir"', '"form":"essay"').replace('"n":14', '"n":0').replace('"ret":0.85', '"ret":2').replace('"by":"fsrs-7"', '"by":"Not An Id"').replace('"did":"3fa9c0d17b2e"', '"did":7');
    const [r] = parseReviews(bad);
    expect(r).toMatchObject({ card: 'voc-karam', g: 1, ms: 60000 });
    for (const k of ['tz', 'time', 'form', 'did', 'n', 'ret', 'by', 'step']) expect(r).not.toHaveProperty(k);
  });

  it('a key this app does not know is kept as it was and written after the known ones; it cannot stand in for a known one', () => {
    const newer = `${NEW.slice(0, -1)},"mood":"tired","dev":{"k":1}}`;
    const [r] = parseReviews(newer);
    expect(r!.extra).toEqual({ mood: 'tired', dev: { k: 1 } });
    expect(formatReview(r!)).toBe(newer);
    expect(formatReview({ ...r!, extra: { g: 4, read: 'pass', at: 'x', mood: 'fine' } })).toBe(`${NEW.slice(0, -1)},"mood":"fine"}`);
    // and a line stays a grade's, never a reading's
    expect(parseLog(newer).map((x) => 'card' in x)).toEqual([true]);
    expect(formatLogLine(parseLog(newer)[0]!)).toBe(newer);
  });

  it('survives a merge: seen twice it counts once with everything it had, and a line given again replaces its line', () => {
    const [old] = parseReviews(OLD);
    const [now] = parseReviews(NEW);
    const again: Review = { ...now!, at: '2026-11-20T21:40:30Z', g: 3, over: now!.at, n: 14 };
    const merged = mergeReviews([[now!, old!], parseReviews(`${NEW}\n${formatReview(again)}\n`), [old!]]);
    expect(merged.map((r) => r.at)).toEqual([old!.at, again.at]);
    expect(merged[1]).toMatchObject({ tz: 60, time: 94210, form: 'bidir', did: '3fa9c0d17b2e', n: 14, ret: 0.85, by: 'fsrs-7', over: now!.at });
    expect(formatReview(merged[0]!)).toBe(OLD);
  });

  it('a collection keeps the line as it is written, and a line from another device as it came', () => {
    const [r] = parseReviews(NEW);
    expect(reviewRow('2026-11.jsonl', r!)).toEqual({ file: '2026-11.jsonl', at: r!.at, doc: r!.doc, card: 'voc-karam', key: 'r', g: 1, line: NEW });
    const newer = `${NEW.slice(0, -1)},"mood":"tired"}`;
    expect(lineRow('2026-11.jsonl', newer)?.line).toBe(newer);
  });
});
