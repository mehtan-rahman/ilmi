// Milestone 53: the merge of one file changed on both devices, by the
// format's rules (`src/sync/merge.ts`). The Rust side hands over three
// texts; this is what comes back.

import { readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { blocks, describeChanges, diff3, later, mergeFile, mergeMarkdown, scheduleKind } from '../merge.js';

const CORPUS = join(import.meta.dirname, '../../format/__tests__/corpus');

const DECK = `---
type: deck
title: german
---

der Vorsatz :: resolution ^cv-vorsatz
<!-- sr due=2026-11-04 st=review s=4 d=5 r=2 l=0 ivl=4 last=2026-10-31T08:00:00Z g=3 -->

der Mut :: courage ^cv-mut
<!-- sr due=2026-11-04 st=review s=4 d=5 r=2 l=0 ivl=4 last=2026-10-31T08:00:00Z g=3 -->

- dof :: 3N − k ^cm-dof
  <!-- sr due=2026-11-04 st=review s=4 d=5 r=2 l=0 ivl=4 last=2026-10-31T08:00:00Z g=3 -->
- holonomic :: $f(q,t) = 0$ ^cm-holo
  <!-- sr due=2026-11-04 st=review s=4 d=5 r=2 l=0 ivl=4 last=2026-10-31T08:00:00Z g=3 -->
`;

const graded = (text: string, id: string, at: string, g: number) =>
  text.replace(new RegExp(`(\\^${id}\\n\\s*<!-- sr .*?)last=\\S+ g=\\d`), `$1last=${at} g=${g}`);

describe('blocks', () => {
  it('splits a file into front-matter and runs of lines, and joins back byte for byte', () => {
    const b = blocks(DECK);
    expect(b[0]).toEqual(['---', 'type: deck', 'title: german', '---', '']);
    expect(b.length).toBe(4);
    expect(b.flat().join('\n')).toBe(DECK);
    for (const f of readdirSync(CORPUS).filter((n) => n.endsWith('.md'))) {
      const text = readFileSync(join(CORPUS, f), 'utf8');
      expect(blocks(text).flat().join('\n'), f).toBe(text);
    }
    expect(blocks('')).toEqual([['']]);
    expect(blocks('a\n\n\nb')).toEqual([['a', '', ''], ['b']]);
    // an unclosed front-matter is body
    expect(blocks('---\nx\n')[0]).toEqual(['---', 'x', '']);
  });
});

describe('diff3', () => {
  it('aligns on what both sides kept and tells the hunks apart', () => {
    const h = diff3(['a', 'b', 'c', 'd'], ['a', 'B', 'c', 'd'], ['a', 'b', 'c', 'D', 'e']);
    expect(h).toEqual([
      { stable: 'a' },
      { base: ['b'], ours: ['B'], theirs: ['b'] },
      { stable: 'c' },
      { base: ['d'], ours: ['d'], theirs: ['D', 'e'] },
    ]);
    expect(diff3([], ['x'], ['y'])).toEqual([{ base: [], ours: ['x'], theirs: ['y'] }]);
    expect(diff3(['a'], ['a'], ['a'])).toEqual([{ stable: 'a' }]);
  });
});

describe('schedule lines', () => {
  it('knows the kinds and picks the later instant', () => {
    expect(scheduleKind('<!-- sr due=2026-11-04 -->')).toBe('sr');
    expect(scheduleKind('  <!-- sr c2 due=2026-11-04 -->')).toBe('sr c2');
    expect(scheduleKind('<!-- sr 2 due=2026-11-04 -->')).toBe('sr c2');
    expect(scheduleKind('<!-- sr r due=2026-11-04 -->')).toBe('sr r');
    expect(scheduleKind('<!-- sr f due=2026-11-04 -->')).toBe('sr');
    expect(scheduleKind('<!-- read made=2026-10-30 due=2026-11-02 ivl=3 -->')).toBe('section');
    expect(scheduleKind('read: due=2026-06-01 ivl=9 reps=4 pos=12')).toBe('read');
    expect(scheduleKind('write: due=2026-06-01')).toBe('write');
    expect(scheduleKind('<!-- srx -->')).toBeNull();
    expect(scheduleKind('<!--SR:!2026-01-01,4,270-->')).toBeNull();
    expect(scheduleKind('prose')).toBeNull();
    expect(later('<!-- sr last=2026-11-04T09:00:00Z -->', '<!-- sr last=2026-11-04T09:00:01Z -->')).toBe('theirs');
    expect(later('<!-- sr last=2026-11-05T09:00:00Z -->', '<!-- sr last=2026-11-04T09:00:01Z -->')).toBe('ours');
    expect(later('<!-- sr due=2026-11-04 -->', '<!-- sr due=2026-11-04T10:00:00Z -->')).toBe('theirs');
    expect(later('read: due=2026-11-07 ivl=3', 'read: due=2026-11-06 ivl=2')).toBe('ours');
    expect(later('<!-- sr -->', '<!-- sr -->')).toBe('ours');
    expect(later('<!-- sr pri=20 -->', '<!-- sr last=2026-11-04T09:00:00Z -->')).toBe('theirs');
  });
});

describe('mergeMarkdown', () => {
  it('lands reviews of different cards from both sides', () => {
    const ours = graded(DECK, 'cv-vorsatz', '2026-11-04T09:00:00Z', 4);
    const theirs = graded(DECK, 'cv-mut', '2026-11-04T09:30:00Z', 1);
    const m = mergeMarkdown('german.md', DECK, ours, theirs);
    expect(m.kept).toEqual([]);
    expect(m.text).toBe(graded(ours, 'cv-mut', '2026-11-04T09:30:00Z', 1));
  });

  it('keeps the later grade of the same card', () => {
    const ours = graded(DECK, 'cv-mut', '2026-11-04T09:00:00Z', 4);
    const theirs = graded(DECK, 'cv-mut', '2026-11-04T09:30:00Z', 1);
    expect(mergeMarkdown('german.md', DECK, ours, theirs)).toEqual({ text: theirs, kept: [] });
    expect(mergeMarkdown('german.md', DECK, theirs, ours)).toEqual({ text: theirs, kept: [] });
  });

  it('takes the later line of each pair when two list cards were graded, one a side', () => {
    const ours = graded(DECK, 'cm-dof', '2026-11-04T09:00:00Z', 3);
    const theirs = graded(DECK, 'cm-holo', '2026-11-04T09:30:00Z', 2);
    const m = mergeMarkdown('german.md', DECK, ours, theirs);
    expect(m.text).toBe(graded(ours, 'cm-holo', '2026-11-04T09:30:00Z', 2));
    expect(m.kept).toEqual([]);
  });

  it('keeps both versions of a paragraph edited on both sides, under its heading', () => {
    const base = '# essay\n\nfirst thoughts.\n\n## later\n\nsecond thoughts.\n\nthird.\n';
    const ours = base.replace('second thoughts.', 'second thoughts, sharpened.');
    const theirs = base.replace('second thoughts.', 'second thoughts, in other words.');
    const m = mergeMarkdown('notes/essay.md', base, ours, theirs);
    expect(m.text).toBe('# essay\n\nfirst thoughts.\n\n## later\n\nsecond thoughts, sharpened.\n\nsecond thoughts, in other words.\n\nthird.\n');
    expect(m.kept).toEqual([{ path: 'notes/essay.md', heading: 'later' }]);
    expect(m.text).not.toMatch(/<<<<|>>>>|====/);
    // the heading is the front-matter's title when no heading is above, else the file's name
    const fm = '---\ntitle: "the: essay"\n---\n\nfirst.\n';
    expect(mergeMarkdown('a/b.md', fm, fm.replace('first.', 'first, ours.'), fm.replace('first.', 'first, theirs.')).kept).toEqual([{ path: 'a/b.md', heading: 'the: essay' }]);
    expect(mergeMarkdown('a/b.md', 'x\n', 'y\n', 'z\n').kept).toEqual([{ path: 'a/b.md', heading: 'b' }]);
    // the last block of a file, without its trailing newline: the two still stand apart
    expect(mergeMarkdown('a.md', 'x', 'y', 'z').text).toBe('y\n\nz\n');
  });

  // (until 2026-11-18 both versions were kept, the card twice; a card learnt writes a line too, so that met far more often)
  it('a card graded here and reworded there is one card: the words of the one, the grade of the other', () => {
    const ours = graded(DECK, 'cv-mut', '2026-11-04T09:00:00Z', 4);
    const theirs = DECK.replace('der Mut :: courage', 'der Mut :: courage, nerve');
    const want = ours.replace('der Mut :: courage', 'der Mut :: courage, nerve');
    expect(mergeMarkdown('german.md', DECK, ours, theirs)).toEqual({ text: want, kept: [] });
    expect(mergeMarkdown('german.md', DECK, theirs, ours)).toEqual({ text: want, kept: [] });
  });

  it('a card reworded on both sides is kept both ways: damage stays local', () => {
    const ours = DECK.replace('der Mut :: courage', 'der Mut :: courage, pluck');
    const theirs = DECK.replace('der Mut :: courage', 'der Mut :: courage, nerve');
    const m = mergeMarkdown('german.md', DECK, ours, theirs);
    expect(m.kept).toEqual([{ path: 'german.md', heading: 'german' }]);
    expect(m.text).toContain('der Mut :: courage, pluck ^cv-mut\n<!-- sr due=2026-11-04 st=review s=4 d=5 r=2 l=0 ivl=4 last=2026-10-31T08:00:00Z g=3 -->\n\nder Mut :: courage, nerve ^cv-mut\n');
    // the other cards are untouched
    expect(m.text).toContain('der Vorsatz :: resolution ^cv-vorsatz\n<!-- sr due=2026-11-04 st=review s=4 d=5 r=2 l=0 ivl=4 last=2026-10-31T08:00:00Z g=3 -->');
  });

  it('merges front-matter line by line: a pass on both takes the later due, anything else the pulled side', () => {
    const base = '---\ntype: source\npri: 50\nread: due=2026-11-04 ivl=2 reps=3 pos=6\n---\n\ntext.\n';
    const ours = base.replace('due=2026-11-04 ivl=2 reps=3 pos=6', 'due=2026-11-06 ivl=2 reps=4 pos=8');
    const theirs = base.replace('due=2026-11-04 ivl=2 reps=3 pos=6', 'due=2026-11-07 ivl=3 reps=4 pos=7');
    expect(mergeMarkdown('s.md', base, ours, theirs).text).toBe(theirs);
    expect(mergeMarkdown('s.md', base, theirs, ours).text).toBe(theirs);
    const pri = mergeMarkdown('s.md', base, base.replace('pri: 50', 'pri: 20'), base.replace('pri: 50', 'pri: 80'));
    expect(pri.text).toBe(base.replace('pri: 50', 'pri: 80'));
    expect(pri.kept).toEqual([]);
    // one side's pass and the other's priority both land
    const both = mergeMarkdown('s.md', base, base.replace('pri: 50', 'pri: 20'), theirs);
    expect(both.text).toBe(theirs.replace('pri: 50', 'pri: 20'));
  });

  it("a section's line passed on both sides takes the later due; its prose edited on one lands too", () => {
    const base = '## pset 4 #5\n<!-- read made=2026-10-30 due=2026-11-02 ivl=3 -->\n\nthe working.\n';
    const ours = base.replace('due=2026-11-02 ivl=3', 'due=2026-11-07 ivl=5 reps=1');
    const theirs = base.replace('due=2026-11-02 ivl=3', 'due=2026-11-09 ivl=7 reps=1').replace('the working.', 'the working, typed up.');
    expect(mergeMarkdown('n.md', base, ours, theirs).text).toBe(theirs);
  });

  it('one side alone changing a file gives that side byte for byte, over the corpus', () => {
    for (const f of readdirSync(CORPUS).filter((n) => n.endsWith('.md'))) {
      const text = readFileSync(join(CORPUS, f), 'utf8');
      const changed = `${text}\nanother paragraph at the end.\n`;
      expect(mergeMarkdown(f, text, text, changed).text, f).toBe(changed);
      expect(mergeMarkdown(f, text, changed, text).text, f).toBe(changed);
      expect(mergeMarkdown(f, text, changed, changed).text, f).toBe(changed);
      const cut = text.split('\n').slice(0, Math.max(1, Math.floor(text.split('\n').length / 2))).join('\n');
      expect(mergeMarkdown(f, text, text, cut).text.replace(/\n+$/, '\n'), f).toBe(`${cut.replace(/\n+$/, '')}\n`);
    }
  });
});

// What the queue-and-session model found (`src/app/__tests__/queue-session.model.test.ts`, 2026-11-18): two devices
// each writing a card's first schedule line, or different lines of one card, before they met.
describe('mergeMarkdown, one card written on both sides', () => {
  const NEW = '---\ntype: deck\n---\n\nq :: a\n\nhin ::: her ^kb\n<!-- sr due=2026-11-04 st=review s=4 d=5 r=2 l=0 ivl=4 last=2026-10-31T08:00:00Z g=3 -->\n\nthe {{c1::one}} and the {{c2::two}} ^kc\n\n## a section\n<!-- read made=2026-11-01 due=2026-11-10 ivl=3 reps=1 -->\n\nwords\n';
  const G = (at: string, g = 3) => `due=2026-11-20 st=review s=4 d=5 r=1 l=0 ivl=2 last=${at} g=${g}`;
  const both = (ours: string, theirs: string) => {
    const [a, b] = [mergeMarkdown('d.md', NEW, ours, theirs), mergeMarkdown('d.md', NEW, theirs, ours)];
    // whichever device merges, the same file
    expect(b.text).toBe(a.text);
    expect(a.kept).toEqual([]);
    return a.text;
  };

  it('a card learnt on both (`seen`), each giving it an id: one card, one id, learnt', () => {
    const ours = NEW.replace('q :: a\n', 'q :: a ^caaaaaa\n<!-- sr seen=2026-11-18T09:00:00Z -->\n');
    const theirs = NEW.replace('q :: a\n', 'q :: a ^cbbbbbb\n<!-- sr seen=2026-11-18T09:05:00Z -->\n');
    expect(both(ours, theirs)).toBe(theirs.replace('^cbbbbbb', '^caaaaaa'));
  });

  it('a card learnt here and graded there: the grade stands, with the id it was graded under', () => {
    const ours = NEW.replace('q :: a\n', 'q :: a ^caaaaaa\n<!-- sr seen=2026-11-18T09:30:00Z -->\n');
    const theirs = NEW.replace('q :: a\n', `q :: a ^cbbbbbb\n<!-- sr ${G('2026-11-18T09:05:00Z')} -->\n`);
    expect(both(ours, theirs)).toBe(theirs);
  });

  it('a new card graded on both: one card, the later grade and its id', () => {
    const ours = NEW.replace('q :: a\n', `q :: a ^caaaaaa\n<!-- sr ${G('2026-11-18T09:00:00Z', 1)} -->\n`);
    const theirs = NEW.replace('q :: a\n', `q :: a ^cbbbbbb\n<!-- sr ${G('2026-11-18T09:05:00Z', 4)} -->\n`);
    expect(both(ours, theirs)).toBe(theirs);
  });

  it('a card learnt here, untouched there: learnt; and a later grade there is not undone by it', () => {
    const learnt = NEW.replace('q :: a\n', 'q :: a ^caaaaaa\n<!-- sr seen=2026-11-18T09:00:00Z -->\n');
    expect(both(learnt, NEW)).toBe(learnt);
    const gradedOn = learnt.replace('seen=2026-11-18T09:00:00Z', G('2026-11-18T10:00:00Z'));
    expect(mergeMarkdown('d.md', learnt, learnt, gradedOn).text).toBe(gradedOn);
    expect(later('<!-- sr seen=2026-11-19T09:00:00Z -->', `<!-- sr ${G('2026-11-18T10:00:00Z')} -->`)).toBe('theirs');
  });

  it('a both-ways card: its forward graded here, its reverse first graded there: one card with both lines', () => {
    const ours = NEW.replace('last=2026-10-31T08:00:00Z g=3', 'last=2026-11-18T09:00:00Z g=4');
    const theirs = NEW.replace('g=3 -->\n\nthe', `g=3 -->\n<!-- sr r ${G('2026-11-18T09:05:00Z')} -->\n\nthe`);
    expect(both(ours, theirs)).toBe(theirs.replace('last=2026-10-31T08:00:00Z g=3', 'last=2026-11-18T09:00:00Z g=4'));
  });

  it('a cloze: one blank learnt here, the other graded there: one card with both lines, in their order', () => {
    const ours = NEW.replace('^kc\n', '^kc\n<!-- sr c2 seen=2026-11-18T09:00:00Z -->\n');
    const theirs = NEW.replace('^kc\n', `^kc\n<!-- sr c1 ${G('2026-11-18T09:05:00Z')} -->\n`);
    expect(both(ours, theirs)).toBe(NEW.replace('^kc\n', `^kc\n<!-- sr c1 ${G('2026-11-18T09:05:00Z')} -->\n<!-- sr c2 seen=2026-11-18T09:00:00Z -->\n`));
  });

  it('a section passed here and dismissed there (its line taken away): the heading once, the line that changed kept', () => {
    const ours = NEW.replace('due=2026-11-10 ivl=3 reps=1', 'due=2026-11-24 ivl=6 reps=2');
    const theirs = NEW.replace('<!-- read made=2026-11-01 due=2026-11-10 ivl=3 reps=1 -->\n', '');
    expect(both(ours, theirs)).toBe(ours);
  });

  it('a card graded on both and a card added after it on one: the grade merged, the new card once', () => {
    const ours = NEW.replace('last=2026-10-31T08:00:00Z g=3', 'last=2026-11-18T09:00:00Z g=4');
    const theirs = NEW.replace('last=2026-10-31T08:00:00Z g=3 -->\n', 'last=2026-11-18T09:05:00Z g=1 -->\n\nnew :: card\n');
    expect(both(ours, theirs)).toBe(theirs);
  });

  it('a card learnt here (given its id) and reworded there: one card, reworded, learnt, with the id', () => {
    const ours = NEW.replace('q :: a\n', 'q :: a ^caaaaaa\n<!-- sr seen=2026-11-18T09:00:00Z -->\n');
    const theirs = NEW.replace('q :: a\n', 'q :: a, more\n');
    expect(both(ours, theirs)).toBe(ours.replace('q :: a ^', 'q :: a, more ^'));
  });

  it('a prose line that begins `read:` is prose: changed on both, both are kept', () => {
    const base = 'a\n\nread: chapter 3\n';
    const m = mergeMarkdown('n.md', base, 'a\n\nread: chapter 4\n', 'a\n\nread: chapter 5\n');
    expect(m.text).toBe('a\n\nread: chapter 4\n\nread: chapter 5\n');
    expect(m.kept).toHaveLength(1);
  });
});

describe('mergeFile', () => {
  it('keeps the edit over the delete, ours over a binary, nothing over the same', () => {
    expect(mergeFile('a.md', { base: 'x\n', ours: 'x, edited\n', theirs: null })).toEqual({ action: 'keep', kept: [] });
    expect(mergeFile('a.md', { base: 'x\n', ours: null, theirs: 'x, edited\n' })).toEqual({ action: 'write', text: 'x, edited\n', kept: [] });
    expect(mergeFile('a.md', { base: 'x\n', ours: null, theirs: null })).toEqual({ action: 'remove', kept: [] });
    expect(mergeFile('a.pdf', { base: null, ours: null, theirs: null, binary: true })).toEqual({ action: 'keep', kept: [] });
    expect(mergeFile('a.md', { base: 'x\n', ours: 'y\n', theirs: 'y\n' })).toEqual({ action: 'keep', kept: [] });
  });

  it('takes the pulled order, unions the log and the pairs', () => {
    expect(mergeFile('.ilmi/order.json', { base: '{}', ours: '{"":["a.md"]}\n', theirs: '{"":["b.md"]}\n' })).toEqual({ action: 'write', text: '{"":["b.md"]}\n', kept: [] });
    expect(mergeFile('.ilmi/plugins/hello/data.json', { base: '{}', ours: '{"a":1}\n', theirs: '{"a":2}\n' })).toEqual({ action: 'write', text: '{"a":2}\n', kept: [] });
    const l1 = '{"at":"2026-11-01T08:00:00Z","doc":"a.md","card":"x","g":3,"st":"review","elapsed":4,"ivl":4,"next":9}';
    const l2 = l1.replace('08:00:00', '09:00:00');
    const l3 = l1.replace('08:00:00', '10:00:00');
    expect(mergeFile('.ilmi/reviews/2026-11.jsonl', { base: `${l1}\n`, ours: `${l1}\n${l2}\n`, theirs: `${l1}\n${l3}\n` })).toEqual({ action: 'write', text: `${l1}\n${l2}\n${l3}\n`, kept: [] });
    expect(mergeFile('.ilmi/reviews/2026-11.jsonl', { base: '', ours: `${l1}`, theirs: `${l1}\n${l3}\n` })).toEqual({ action: 'write', text: `${l1}\n${l3}\n`, kept: [] });
    const same = mergeFile('.ilmi/same.json', { base: '{"not":[]}\n', ours: '{\n  "not": [\n    "a|b"\n  ]\n}\n', theirs: '{\n  "not": [\n    "a|c"\n  ]\n}\n' });
    expect(same).toEqual({ action: 'write', text: '{\n  "not": [\n    "a|b",\n    "a|c"\n  ]\n}\n', kept: [] });
  });

  it('merges a Markdown file and says when ours already is the merge', () => {
    const ours = graded(DECK, 'cv-mut', '2026-11-04T09:30:00Z', 4);
    const theirs = graded(DECK, 'cv-mut', '2026-11-04T09:00:00Z', 1);
    expect(mergeFile('german.md', { base: DECK, ours, theirs })).toEqual({ action: 'keep', kept: [] });
    expect(mergeFile('german.md', { base: DECK, ours: theirs, theirs: ours })).toEqual({ action: 'write', text: ours, kept: [] });
    // no base (unrelated histories): the common blocks are common, the rest is kept both ways
    const m = mergeFile('x.md', { base: null, ours: '# a\n\none.\n\ntwo.\n', theirs: '# a\n\none.\n\ntwo, other.\n' });
    expect(m).toEqual({ action: 'write', text: '# a\n\none.\n\ntwo.\n\ntwo, other.\n', kept: [{ path: 'x.md', heading: 'a' }] });
  });
});

describe('describeChanges', () => {
  it('names what a commit carries', () => {
    const ch = (path: string, before: string | null, after: string | null, binary = false) => ({ path, before, after, binary });
    expect(describeChanges([])).toBe('changes');
    const reviewed = graded(graded(DECK, 'cv-mut', '2026-11-04T09:30:00Z', 4), 'cm-dof', '2026-11-04T09:31:00Z', 3);
    expect(describeChanges([ch('german.md', DECK, reviewed), ch('.ilmi/reviews/2026-11.jsonl', '', 'x\n')])).toBe('2 reviews');
    const src = '---\ntitle: ch. 3\nread: due=2026-11-04 ivl=2 reps=3 pos=6\n---\n\ntext.\n';
    expect(describeChanges([ch('b/ch3.md', src, src.replace('due=2026-11-04 ivl=2 reps=3 pos=6', 'due=2026-11-06 ivl=2 reps=4 pos=9'))])).toBe('ch. 3 read on');
    expect(describeChanges([ch('essays/term paper.md', 'a\n', 'a\n\nb\n')])).toBe('term paper edited');
    expect(describeChanges([ch('n.md', '## s\n<!-- read due=2026-11-02 ivl=3 -->\n', '## s\n<!-- read due=2026-11-07 ivl=5 reps=1 -->\n')])).toBe('n read on');
    expect(describeChanges([
      ch('german.md', DECK, graded(DECK, 'cv-mut', '2026-11-04T09:30:00Z', 4)),
      ch('b/ch3.md', src, src.replace('reps=3', 'reps=4')),
      ch('essays/term paper.md', 'a\n', 'a\n\nb\n'),
      ch('new.md', null, 'x\n'),
      ch('old.md', 'x\n', null),
      ch('.ilmi/order.json', '{}', '{"":[]}'),
      ch('.ilmi/same.json', '{}', '{"not":[]}'),
      ch('pages.pdf', null, null, true),
    ])).toBe('1 review, ch. 3 read on, term paper edited, new added, old removed, and 3 more');
    // a graded card that was also reworded is an edit as well as a review
    expect(describeChanges([ch('german.md', DECK, graded(DECK, 'cv-mut', '2026-11-04T09:30:00Z', 4).replace('courage', 'courage, nerve'))])).toBe('1 review, german edited');
  });
});
