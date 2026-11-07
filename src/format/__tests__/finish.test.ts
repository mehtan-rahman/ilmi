// FORMAT.md §3 `finish` (milestone 52): the day a source's reading is paced
// to finish by. A day, plain or quoted like a title; anything else is a raw
// line with a diagnostic. The corpus file `mangled/finish.md` shows each case.

import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { meta, parse, serialize, setField } from '../index.js';

const CORPUS = join(import.meta.dirname, 'corpus');

describe('finish', () => {
  it('the corpus file: the day read, the bad lines kept raw with a diagnostic each, written back plain', () => {
    const text = readFileSync(join(CORPUS, 'mangled/finish.md'), 'utf8');
    const { doc, diagnostics } = parse(text);
    expect(meta(doc).finish).toBe('2026-11-24');
    expect(diagnostics.map((d) => d.message)).toEqual(['bad value for "finish"', 'bad value for "finish"', '"finish" needs a value']);
    const out = serialize(doc);
    expect(out).toContain('read: due=2026-11-03 ivl=3 reps=3 pos=3\nfinish: 2026-11-24\nfinish: next friday\nfinish: 2026-13-01\nfinish:\nsource: the reading group\n---\n');
    expect(serialize(parse(out).doc)).toBe(out);
    expect(out).toContain('finish: 2026-11-24 in the body is prose.');
  });

  it('the corpus vault\'s source keeps its day to the byte', () => {
    const text = readFileSync(join(CORPUS, 'vault/papers/crick-1995.md'), 'utf8');
    const { doc, diagnostics } = parse(text);
    expect(diagnostics).toEqual([]);
    expect(meta(doc).finish).toBe('2026-07-01');
    expect(serialize(doc)).toBe(text);
  });

  it('set where it is, appended when new, gone when cleared; a day past is left as written', () => {
    const { doc } = parse('---\ntype: source\nfinish: 2020-01-01\nread: due=2026-11-03\n---\n\nbody\n');
    expect(serialize(doc)).toContain('finish: 2020-01-01\nread:');
    setField(doc, 'finish', '2026-11-28');
    expect(serialize(doc)).toContain('finish: 2026-11-28\nread:');
    setField(doc, 'finish', null);
    expect(serialize(doc)).toBe('---\ntype: source\nread: due=2026-11-03\n---\n\nbody\n');
    setField(doc, 'finish', '2026-11-28');
    expect(serialize(doc)).toBe('---\ntype: source\nread: due=2026-11-03\nfinish: 2026-11-28\n---\n\nbody\n');
  });
});
