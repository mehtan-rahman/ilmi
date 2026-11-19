// What the page says of a PDF that did not open (`pdfFail.ts`):
// in plain lowercase words, by what went wrong: its bytes not on this device
// (still arriving, or not fetched), no such file in the collection, a
// password, a file that does not read as a PDF, or anything else with what
// was said underneath.

import { describe, expect, it } from 'vitest';
import { pdfFail } from '../pdfFail.js';

const named = (name: string, message: string): Error => { const e = new Error(message); e.name = name; return e; };

describe('why a pdf did not open', () => {
  it('bytes that are not on this device: still arriving, or not fetched, and why', () => {
    expect(pdfFail(new Error('this file is not in the storage yet'), true, true, 50_000_000)).toEqual({ kind: 'away', said: 'not on this device yet', detail: 'still arriving from the device it was added on' });
    expect(pdfFail(new Error('error sending request for url'), true, true, 50_000_000)).toEqual({ kind: 'away', said: 'not on this device yet', detail: 'could not be fetched: error sending request for url' });
    expect(pdfFail(new Error('this file is not here'), true, true, 1)).toMatchObject({ kind: 'away', detail: 'this collection has no storage to fetch it from' });
  });

  it('no such file in the collection: said so, and that it may be on its way', () => {
    expect(pdfFail(new Error('ENOENT'), false, false, 0)).toEqual({ kind: 'absent', said: 'its pdf is not in the collection', detail: 'if it was added on another device it may still be arriving' });
  });

  it('a password, a file that is no pdf, a file too large, and the rest with what was said', () => {
    expect(pdfFail(named('PasswordException', 'No password given'), true, false, 1000)).toEqual({ kind: 'locked', said: 'this pdf is locked with a password', detail: '' });
    expect(pdfFail(named('InvalidPDFException', 'Invalid PDF structure.'), true, false, 49_760_519)).toEqual({ kind: 'broken', said: 'this file does not read as a pdf', detail: '47 mb here · it may have been cut short on its way' });
    expect(pdfFail(named('RangeError', 'Array buffer allocation failed'), true, false, 49_760_519)).toMatchObject({ kind: 'other', said: 'too large to read on this device' });
    expect(pdfFail(new Error('Worker was terminated'), true, false, 2_500_000)).toEqual({ kind: 'other', said: 'could not open this pdf', detail: '2.4 mb here · worker was terminated' });
    // every word of it lowercase
    for (const f of [pdfFail(named('InvalidPDFException', 'Invalid PDF'), true, false, 1), pdfFail(new Error('X Y Z'), true, true, 1)]) expect(`${f.said}${f.detail}`).toBe(`${f.said}${f.detail}`.toLowerCase());
  });
});
