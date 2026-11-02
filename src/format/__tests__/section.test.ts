// Milestone 47: the heading's `<!-- read … -->` line (FORMAT.md §6.5). It
// sits directly under a heading, reads and writes in its own key order,
// and is an orphan anywhere else; a heading carries no other annotation.

import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { parse, sectionDismissed, serialize, type Heading } from '../index.js';

const heads = (text: string) => parse(text).doc.blocks.filter((b): b is Heading => b.kind === 'heading');

describe('the section line', () => {
  it('attaches to an ATX heading and comes back byte for byte', () => {
    const text = '## a derivation\n<!-- read made=2026-10-30 due=2026-11-02 ivl=3 -->\n\nTyped up.\n';
    const { doc, diagnostics } = parse(text);
    expect(diagnostics).toEqual([]);
    expect(doc.blocks[0]).toEqual({ kind: 'heading', level: 2, text: 'a derivation', read: { made: '2026-10-30', due: '2026-11-02', ivl: 3 } });
    expect(serialize(doc)).toBe(text);
  });

  it('attaches to a setext heading, under its underline', () => {
    const text = 'dismissed\n---\n<!-- read made=2026-10-20 boxes=41:0.120:0.122:0.770:0.145 -->\n';
    const h = heads(text)[0]!;
    expect(h.setext).toBe(true);
    expect(h.read).toEqual({ made: '2026-10-20', boxes: '41:0.120:0.122:0.770:0.145' });
    expect(serialize(parse(text).doc)).toBe(text);
  });

  it('writes made, due, ivl, reps, af, pri, boxes in that order, unknown keys after; af at its default dropped', () => {
    const text = '## x\n<!--   read   boxes=1:0:0:1:1 later=yes pri=30 reps=2 ivl=8 af=1.6 due=2026-11-09 made=2026-10-19   -->\n';
    expect(serialize(parse(text).doc)).toBe('## x\n<!-- read made=2026-10-19 due=2026-11-09 ivl=8 reps=2 pri=30 boxes=1:0:0:1:1 later=yes -->\n');
    expect(serialize(parse('## x\n<!-- read due=2026-11-09 af=2 -->\n').doc)).toBe('## x\n<!-- read due=2026-11-09 af=2 -->\n');
  });

  it('drops a value that does not parse, with a diagnostic, and keeps the rest', () => {
    const { doc, diagnostics } = parse('## x\n<!-- read due=tomorrow ivl=-3 af=1.0 pri=200 made=oct reps=1 -->\n');
    expect((doc.blocks[0] as Heading).read).toEqual({ reps: 1 });
    expect(diagnostics.map((d) => d.message)).toEqual([
      'bad value for "due": tomorrow', 'bad value for "ivl": -3', 'bad value for "af": 1.0', 'bad value for "pri": 200', 'bad value for "made": oct',
    ]);
  });

  it('a bare line is enrolled; a line with boxes and no due is dismissed', () => {
    const [bare] = heads('## x\n<!-- read -->\n');
    expect(bare!.read).toEqual({});
    expect(sectionDismissed(bare!.read!)).toBe(false);
    expect(serialize(parse('## x\n<!-- read -->\n').doc)).toBe('## x\n<!-- read -->\n');
    expect(sectionDismissed({ made: '2026-10-20', boxes: '41:0:0:1:1' })).toBe(true);
    expect(sectionDismissed({ due: '2026-11-02', boxes: '41:0:0:1:1' })).toBe(false);
  });

  it('two lines under one heading: the later wins, said so', () => {
    const { doc, diagnostics } = parse('## x\n<!-- read due=2026-11-01 -->\n<!-- read due=2026-11-03 -->\n');
    expect((doc.blocks[0] as Heading).read).toEqual({ due: '2026-11-03' });
    expect(diagnostics.map((d) => d.message)).toEqual(['heading has two read lines; later wins']);
  });

  it('after anything but a heading it is an orphan raw block, kept verbatim', () => {
    for (const text of [
      'A paragraph.\n<!-- read due=2026-11-04 -->\n',
      'term :: def\n<!-- read due=2026-11-04 -->\n',
      '## after a blank line\n\n<!-- read due=2026-11-04 -->\n',
      '<!-- read due=2026-11-04 -->\n',
      '- an item\n  <!-- read due=2026-11-04 -->\n',
    ]) {
      const { doc, diagnostics } = parse(text);
      expect(diagnostics.map((d) => d.message), text).toEqual(['orphan read line']);
      expect(doc.blocks.some((b) => b.kind === 'raw' && b.text.includes('<!-- read due=2026-11-04 -->')), text).toBe(true);
      expect(doc.blocks.some((b) => b.kind === 'heading' && b.read), text).toBe(false);
    }
  });

  it('a heading carries no card schedule or extract backref: those stay orphans', () => {
    const { doc, diagnostics } = parse('## x\n<!-- sr due=2026-11-04 -->\n<!-- extract child -->\n');
    expect(diagnostics.map((d) => d.message)).toEqual(['orphan sr line', 'orphan extract line']);
    expect((doc.blocks[0] as Heading).read).toBeUndefined();
  });

  it('dismissed by the serializer\'s rules: a line keeping only its boxes stays, an emptied one goes', () => {
    const { doc } = parse('## kept\n<!-- read made=2026-10-20 boxes=41:0:0:1:1 -->\n\n## gone\n');
    expect(serialize(doc)).toBe('## kept\n<!-- read made=2026-10-20 boxes=41:0:0:1:1 -->\n\n## gone\n');
    delete (doc.blocks[0] as Heading).read;
    expect(serialize(doc)).toBe('## kept\n\n## gone\n');
  });

  it('the corpus file reads every case', () => {
    const text = readFileSync(join(import.meta.dirname, 'corpus/mangled/sections.md'), 'utf8');
    const { doc, diagnostics } = parse(text);
    const read = doc.blocks.filter((b): b is Heading => b.kind === 'heading').map((h) => [h.text, h.read]);
    expect(read).toEqual([
      ['a note with sections that come back', undefined],
      ['enrolled, written by the app', { made: '2026-10-30', due: '2026-11-02', ivl: 3 }],
      ['spaced oddly, attributes out of order', { made: '2026-10-19', due: '2026-11-09', ivl: 8, reps: 2, extra: [['later', 'yes']] }],
      ['dismissed, its boxes kept', { made: '2026-10-20', pri: 30, boxes: '41:0.120:0.122:0.770:0.145' }],
      ['bad values', {}],
      ['a bare line, written by hand', {}],
      ['twice', { due: '2026-11-03' }],
      ['after a blank line', undefined],
      ['a heading carries no card schedule', undefined],
    ]);
    expect(diagnostics.filter((d) => d.message.startsWith('orphan')).map((d) => d.message)).toEqual([
      'orphan read line', 'orphan read line', 'orphan sr line', 'orphan extract line', 'orphan read line',
    ]);
  });
});
