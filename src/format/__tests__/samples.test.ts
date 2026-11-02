// Every file of the sample collections under `samples/` parses with no
// diagnostics and holds the round-trip fixed point, as the corpus does. The
// double major's collection is also held to milestone 33's migration: what
// was typed up is a note, a note keeps no reading `pos`, the books are
// sources, and only the term paper and its outline are drafts.

import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join, relative } from 'node:path';
import { describe, expect, it } from 'vitest';
import { meta, parse, serialize } from '../index.js';

const SAMPLES = join(import.meta.dirname, '../../../samples');

function walk(dir: string): string[] {
  const out: string[] = [];
  for (const name of readdirSync(dir).sort()) {
    if (name.startsWith('.')) continue;
    const p = join(dir, name);
    if (statSync(p).isDirectory()) out.push(...walk(p));
    else if (name.endsWith('.md')) out.push(p);
  }
  return out;
}

const files = walk(SAMPLES).map((p) => ({ name: relative(SAMPLES, p), text: readFileSync(p, 'utf8') }));

describe('samples', () => {
  it('has the double major\'s collection', () => {
    expect(files.filter((f) => f.name.startsWith('double-major/'))).toHaveLength(66);
  });

  for (const f of files) {
    it(`${f.name} parses clean and is a fixed point`, () => {
      const first = parse(f.text);
      expect(first.diagnostics).toEqual([]);
      const out = serialize(first.doc);
      expect(parse(out).doc).toEqual(first.doc);
      expect(serialize(parse(out).doc)).toBe(out);
    });
  }

  it('the double major\'s class notes hold cards in list items (milestone 37)', () => {
    const items: string[] = [];
    for (const f of files.filter((x) => x.name.startsWith('double-major/courses/'))) {
      for (const b of parse(f.text).doc.blocks) if (b.kind === 'card' && b.item !== undefined) items.push(b.id ?? b.text);
    }
    expect(items).toEqual([
      'cm-pb-evol', 'cm-pb-L', 'cm-pb-xL', 'cm-poisson-thm',
      'dof :: 3N − k', 'holonomic :: constraint is f(q,t) = 0', 'scleronomic :: no explicit t',
      'sm-ZN-identical',
    ]);
  });

  it('the double major\'s collection is migrated to notes and sources', () => {
    const types: Record<string, string[]> = {};
    for (const f of files.filter((x) => x.name.startsWith('double-major/'))) {
      const m = meta(parse(f.text).doc);
      (types[m.type] ??= []).push(f.name.slice('double-major/'.length));
      if (m.type === 'note') expect(m.read?.pos, f.name).toBeUndefined();
    }
    expect(types.draft?.sort()).toEqual([
      'courses/fall-2026/arab-455-abbasid-poetry/term-paper.md',
      'courses/fall-2026/arab-455-abbasid-poetry/term-paper/outline-v1.md',
    ]);
    // typed-up lectures, the course notebooks, and the fleeting notes are notes
    expect(types.note).toContain('courses/fall-2026/arab-401-advanced-grammar/conditional-sentences.md');
    expect(types.note).toContain('courses/fall-2026/phys-412-quantum-ii.md');
    expect(types.note).toContain('fleeting/2026-10-30.md');
    expect(types.note?.every((p) => p.startsWith('courses/') || p.startsWith('fleeting/'))).toBe(true);
    // every book chapter and the books themselves stay sources
    for (const p of files.filter((x) => x.name.startsWith('double-major/library/')).map((x) => x.name.slice('double-major/'.length))) {
      expect(types.source?.includes(p) || types.extract?.includes(p), p).toBe(true);
    }
    expect(types).toMatchObject({ note: expect.any(Array), source: expect.any(Array), extract: expect.any(Array), deck: expect.any(Array) });
    expect(Object.keys(types).sort()).toEqual(['deck', 'draft', 'extract', 'note', 'source']);
  });
});
