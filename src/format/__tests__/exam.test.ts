// FORMAT.md §3 `exam` (milestone 43): the exams a document and everything
// under it are studied toward. One line, `day label` entries with a comma
// between; read, written canonically, kept raw with a diagnostic when an
// entry is not one. The corpus file `mangled/exam.md` shows each case.

import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { formatExams, meta, parse, parseExams, serialize, setField } from '../index.js';

const CORPUS = join(import.meta.dirname, 'corpus');

describe('exam', () => {
  it('reads one exam, a label, several; refuses what is not one', () => {
    expect(parseExams('2026-11-18')).toEqual([{ day: '2026-11-18' }]);
    expect(parseExams('2026-11-18 midterm 2')).toEqual([{ day: '2026-11-18', label: 'midterm 2' }]);
    expect(parseExams(' 2026-11-18  midterm   2 ,2026-12-14 final')).toEqual([{ day: '2026-11-18', label: 'midterm 2' }, { day: '2026-12-14', label: 'final' }]);
    for (const bad of ['', 'friday', '2026-13-01', '2026-11-18,', ', 2026-11-18', '2026-11-18 a,,2026-12-01', '18-11-2026 midterm', '2026-11-18midterm']) expect(parseExams(bad), bad).toBeNull();
    expect(formatExams([{ day: '2026-11-18', label: 'midterm 2' }, { day: '2026-12-14' }])).toBe('2026-11-18 midterm 2, 2026-12-14');
    expect(formatExams([{ day: '2026-12-14', label: 'final: cumulative' }])).toBe('"2026-12-14 final: cumulative"');
  });

  it('the corpus file: the field read, the bad lines kept raw with a diagnostic each, written back canonically', () => {
    const text = readFileSync(join(CORPUS, 'mangled/exam.md'), 'utf8');
    const { doc, diagnostics } = parse(text);
    expect(meta(doc).exams).toEqual([{ day: '2026-12-14', label: 'final: cumulative' }]);
    expect(diagnostics.map((d) => d.message)).toEqual([
      'bad value for "exam"', 'bad value for "exam"', '"exam" needs a value', 'bad value for "exam"', '"exam" given twice; later wins',
    ]);
    const out = serialize(doc);
    expect(out).toContain('tabs: true\nexam: "2026-12-14 final: cumulative"\nexam: 2026-13-01 midterm\nexam: 2026-11-18 midterm, , 2026-12-14\nexam:\nexam: next friday\ncourse: PHYS 412\n---\n');
    expect(serialize(parse(out).doc)).toBe(out);
    expect(out).toContain('exam: 2026-11-18 in the body is prose.');
  });

  it('the first line alone, canonical; set, changed, cleared in place', () => {
    const { doc } = parse('---\ntitle: q\nexam:   2026-11-18   midterm 2 ,2026-12-14 final   # dates\nx: 1\n---\n\nbody\n');
    expect(serialize(doc)).toBe('---\ntitle: q\nexam: 2026-11-18 midterm 2, 2026-12-14 final\nx: 1\n---\n\nbody\n');
    setField(doc, 'exam', [{ day: '2026-11-20', label: 'midterm' }]);
    expect(serialize(doc)).toContain('exam: 2026-11-20 midterm\nx: 1\n');
    setField(doc, 'exam', null);
    expect(serialize(doc)).toBe('---\ntitle: q\nx: 1\n---\n\nbody\n');
    setField(doc, 'exam', [{ day: '2026-11-20' }]);
    expect(serialize(doc)).toBe('---\ntitle: q\nx: 1\nexam: 2026-11-20\n---\n\nbody\n');
  });
});
