// What the parser sees in specific files, and what the serializer promises.

import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import {
  parse, serialize, meta, setField, docPri, parseAf, cardForm, cardFields, clozeParts, clozeSegments, blanks, clozeGroups, nextGroup, mathSpanEnd,
  type Card, type Paragraph, type Heading, type Raw,
} from '../index.js';

const read = (rel: string) => readFileSync(join(import.meta.dirname, 'corpus', rel), 'utf8');
const cards = (text: string) => parse(text).doc.blocks.filter((b): b is Card => b.kind === 'card');
const kinds = (text: string) => parse(text).doc.blocks.map((b) => b.kind);

describe('front-matter', () => {
  it('reads the known fields with defaults', () => {
    const { doc } = parse(read('vault/papers/wozniak-1990.md'));
    expect(meta(doc)).toEqual({
      type: 'source', frozen: true, imported: '2026-04-18', pri: 80,
      read: { due: '2026-06-01', ivl: 9, reps: 4, pos: 12 },
    });
    expect(meta(parse('just a note\n').doc)).toEqual({ type: 'source', frozen: false });
  });

  it('growth: af is read, dropped when it is the default or below the floor, and written back otherwise', () => {
    const { doc, diagnostics } = parse(read('mangled/growth.md'));
    const m = meta(doc);
    expect(m.read).toEqual({ due: '2026-05-27', ivl: 4, reps: 2, pos: 1 });          // af=1.6 is the default
    expect(m.write).toEqual({ due: '2026-05-27', ivl: 2 });                           // af=1 is below the floor
    expect(diagnostics.map((d) => `${d.line}: ${d.message}`)).toEqual(['4: bad value for "af": 1']);
    expect(serialize(doc).split('\n').slice(0, 5)).toEqual([
      '---', 'type: source', 'read: due=2026-05-27 ivl=4 reps=2 pos=1', 'write: due=2026-05-27 ivl=2', '---',
    ]);
    // the corpus carries one of each, in its place on the line
    expect(meta(parse(read('vault/papers/crick-1995.md')).doc).read?.af).toBe(2);
    expect(meta(parse(read('vault/essays/talk-incremental.md')).doc).write).toEqual({ due: '2026-05-30', ivl: 3, reps: 0, af: 1.2, done: false });
    // the default set in memory is not written; the write loop has its own default
    const d = parse('---\nread: ivl=2\nwrite: ivl=2\n---\n\nx\n').doc;
    setField(d, 'read', { ivl: 2, af: 1.6 });
    setField(d, 'write', { ivl: 2, af: 1.6 });
    expect(meta(d).read?.af).toBeUndefined();
    expect(serialize(d)).toBe('---\nread: ivl=2\nwrite: ivl=2 af=1.6\n---\n\nx\n');
    setField(d, 'write', { ivl: 2, af: 1.5 });
    expect(serialize(d)).toBe('---\nread: ivl=2\nwrite: ivl=2\n---\n\nx\n');
    expect([parseAf('1.1'), parseAf('2'), parseAf('1.09'), parseAf('x'), parseAf('-2')]).toEqual([1.1, 2, null, null, null]);
  });

  it('suspended: `sus=1` on a bare line and on a group line, kept with the schedule; `sus=0` dropped', () => {
    const bare = parse('a :: b ^x\n<!-- sr due=2026-05-27 st=review r=2 pri=10 sus=1 -->\n');
    expect(bare.diagnostics).toEqual([]);
    expect(bare.doc.blocks[0]).toEqual({ kind: 'card', text: 'a :: b', id: 'x', sched: { due: '2026-05-27', state: 'review', reps: 2, pri: 10, suspended: true } });
    expect(serialize(bare.doc)).toBe('a :: b ^x\n<!-- sr due=2026-05-27 st=review r=2 pri=10 sus=1 -->\n');
    // any order is read, the canonical order written; `sus=true` is read as 1
    expect(serialize(parse('a :: b\n<!-- sr sus=true due=2026-05-27 -->\n').doc)).toBe('a :: b\n<!-- sr due=2026-05-27 sus=1 -->\n');
    const group = parse('{{c1::x}} and {{c2::y}}\n<!-- sr c1 due=2026-06-01 -->\n<!-- sr c2 due=2026-06-02 sus=1 -->\n');
    expect(group.diagnostics).toEqual([]);
    const card = group.doc.blocks[0] as Card;
    expect(card.blanks).toEqual({ 1: { due: '2026-06-01' }, 2: { due: '2026-06-02', suspended: true } });
    expect(serialize(group.doc)).toBe('{{c1::x}} and {{c2::y}}\n<!-- sr c1 due=2026-06-01 -->\n<!-- sr c2 due=2026-06-02 sus=1 -->\n');
    const off = parse('a :: b\n<!-- sr due=2026-05-27 sus=0 -->\n');
    expect((off.doc.blocks[0] as Card).sched).toEqual({ due: '2026-05-27' });
    expect(serialize(off.doc)).toBe('a :: b\n<!-- sr due=2026-05-27 -->\n');
    expect(parse('a :: b\n<!-- sr sus=maybe -->\n').diagnostics.map((d) => d.message)).toEqual(['bad value for "sus": maybe']);
    // the corpus: a suspended q&a and a cloze with one blank suspended
    const ps = parse(read('vault/courses/linear-algebra/problem-set-1.md')).doc.blocks.filter((b): b is Card => b.kind === 'card');
    expect(ps.find((c) => c.id === 'la-eigvec')?.sched?.suspended).toBe(true);
    const rank = ps.find((c) => c.id === 'la-rank')!;
    expect([rank.sched, rank.blanks?.[1]?.suspended, rank.blanks?.[2]?.suspended]).toEqual([undefined, undefined, true]);
  });

  it('priority: the field wins over a line, a card carries its own, a group line never does', () => {
    const { doc, diagnostics } = parse(read('mangled/priority.md'));
    const m = meta(doc);
    expect(m.pri).toBe(30);
    expect(docPri(m)).toBe(30);
    expect(m.read).toEqual({ due: '2026-05-27', ivl: 2, reps: 1, pos: 0 });        // pri=2 superseded by the field
    expect(m.write).toEqual({ due: '2026-05-27', done: false });                     // pri=200 is out of range
    const cards = doc.blocks.filter((b): b is Card => b.kind === 'card');
    expect(cards.map((c) => c.sched?.pri)).toEqual([10, 40, 0]);
    expect(cards[1]?.blanks?.[1]).toEqual({ due: '2026-06-01', state: 'review', stability: 3, difficulty: 5, reps: 1, lapses: 0 });
    const out = serialize(doc);
    expect(out.split('\n').slice(0, 7)).toEqual([
      '---', 'type: source', 'pri: high', 'pri: 30', 'read: due=2026-05-27 ivl=2 reps=1 pos=0', 'write: due=2026-05-27 done=false', '---',
    ]);
    expect(out).toContain('<!-- sr due=2026-05-27 st=review s=4 d=5 r=2 l=0 pri=10 -->');
    expect(out).toContain('<!-- sr pri=40 -->\n<!-- sr c1 due=2026-06-01 st=review s=3 d=5 r=1 l=0 -->');
    expect(out).toContain('<!-- sr pri=0 -->');
    const messages = diagnostics.map((d) => `${d.line}: ${d.message}`);
    expect(messages).toEqual([
      '3: bad value for "pri"', '6: bad value for "pri": 200', '18: "pri" on a group line is ignored',
    ]);
    // without the field, the line's value stands and is written back
    const legacy = parse('---\nread: due=2026-05-27 pri=2\n---\n\nx\n').doc;
    expect(meta(legacy)).toMatchObject({ read: { due: '2026-05-27', pri: 2 } });
    expect(meta(legacy).pri).toBeUndefined();
    expect(docPri(meta(legacy))).toBe(50);
    expect(serialize(legacy)).toContain('read: due=2026-05-27 pri=2\n');
    // the field, once set, takes the line's value off on the next write
    setField(legacy, 'pri', 10);
    expect(serialize(legacy)).toBe('---\nread: due=2026-05-27\npri: 10\n---\n\nx\n');
    setField(legacy, 'pri', null);
    expect(serialize(legacy)).toBe('---\nread: due=2026-05-27\n---\n\nx\n');
    for (const bad of ['pri: -1', 'pri: 101', 'pri: 1.5', 'pri:'])
      expect(meta(parse(`---\n${bad}\n---\n\nx\n`).doc).pri).toBeUndefined();
  });

  it('pages: the pdf field names the file, page sits on an extract\'s read line, and bad values degrade', () => {
    const { doc } = parse(read('vault/papers/two-pages.md'));
    expect(meta(doc)).toEqual({
      type: 'source', frozen: true, imported: '2026-05-25', pri: 50, pdf: 'two-pages.pdf',
      read: { due: '2026-06-10', ivl: 3, reps: 2, pos: 1 },
    });
    expect(doc.blocks.map((b) => b.kind)).toEqual(['heading', 'paragraph', 'heading', 'card']);
    expect(doc.blocks.filter((b): b is Heading => b.kind === 'heading').map((b) => b.text)).toEqual(['p. 1', 'p. 2']);
    expect((doc.blocks[1] as Paragraph).extracts).toEqual(['the ruler in the margin']);
    const child = parse(read('vault/papers/two-pages/the ruler in the margin.md'));
    expect(meta(child.doc).read).toEqual({ due: '2026-06-11', ivl: 2, reps: 1, pos: 0, page: 1 });
    // the mangled one: an empty field is a raw line, page=0 is dropped, the missing file is not the parser's business
    const bad = parse(read('mangled/pdf-missing.md'));
    expect(meta(bad.doc).pdf).toBe('nowhere.pdf');
    expect(meta(bad.doc).read).toEqual({ due: '2026-05-27', pos: 3 });
    expect(bad.diagnostics.map((d) => `${d.line}: ${d.message}`)).toEqual(['3: "pdf" needs a value', '5: bad value for "page": 0']);
    expect(serialize(bad.doc).split('\n').slice(0, 6)).toEqual(['---', 'type: source', 'pdf:', 'pdf: nowhere.pdf', 'read: due=2026-05-27 pos=3', '---']);
    // written plain, quoted when it must be, and set and cleared like any field
    const d = parse('x\n').doc;
    setField(d, 'pdf', 'paper.pdf');
    expect(serialize(d)).toBe('---\npdf: paper.pdf\n---\n\nx\n');
    setField(d, 'pdf', 'a: b.pdf');
    expect(meta(parse(serialize(d)).doc).pdf).toBe('a: b.pdf');
    setField(d, 'pdf', null);
    expect(serialize(d)).toBe('x\n');
    expect(meta(parse('---\npdf: "quoted name.pdf"\n---\n\nx\n').doc).pdf).toBe('quoted name.pdf');
  });

  it('keeps unknown lines verbatim and degrades bad values with diagnostics', () => {
    const { doc, diagnostics } = parse(read('mangled/frontmatter-ugly.md'));
    const m = meta(doc);
    expect(m.type).toBe('source');                    // bogus → default
    expect(m.title).toBe('quoted: yes');
    expect(m.frozen).toBe(true);                      // yes # comment
    expect(m.imported).toBeUndefined();               // 2026-4-18 is not a day
    expect(m.started).toBe('2026-05-22');
    expect(m.read).toEqual({});                       // bare `read:` is enrolled with defaults; the nested map is ignored
    expect(m.write).toEqual({ due: '2026-05-27', ivl: 2, pri: 1, done: false, extra: [['extra-key', '7']] });
    expect(m.defaultCard).toBe('qa');
    const out = serialize(doc);
    for (const line of ['# a yaml comment', 'tags:', '  - reading', 'aliases: [one, two]', 'type: bogus',
      'imported: 2026-4-18', 'read:', '  due: 2026-06-01', 'custom: anything goes', "title2: 'not a title'", ''])
      expect(out.split('\n')).toContain(line);
    expect(out).toContain('title: "quoted: yes"');
    expect(out).toContain('frozen: true\n');
    expect(out).toContain('write: due=2026-05-27 ivl=2 pri=1 done=false extra-key=7');
    expect(out).toContain('\n---\n\nbody after');
    const messages = diagnostics.map((d) => `${d.line}: ${d.message}`);
    expect(messages).toContain('9: bad value for "type"');
    expect(messages).toContain('12: nested values under "read" are ignored; use inline attributes');
    expect(messages).toContain('15: unexpected token "wobble"');
  });

  it('later duplicate wins, once', () => {
    const { doc, diagnostics } = parse(read('mangled/duplicates.md'));
    expect(meta(doc)).toMatchObject({ type: 'draft', frozen: false, read: { due: '2026-02-02', pos: 3 } });
    expect(serialize(doc).split('\n').slice(0, 8)).toEqual(['---', 'type: draft', 'frozen: false', 'read: due=2026-02-02 pos=3', 'write:', '  nested: under-write', 'imported: 2026-01-02', '---']);
    expect(diagnostics.filter((d) => d.message.includes('twice')).length).toBe(4);
    expect(diagnostics.filter((d) => d.message.includes('nested')).map((d) => d.line)).toEqual([8]);
  });

  it('quotes titles only when it must', () => {
    expect(meta(parse(read('mangled/frontmatter-quotes.md')).doc).title).toBe("it's single-quoted");
    const t = (s: string) => { const d = parse('x\n').doc; setField(d, 'title', s); return serialize(d).split('\n')[1]; };
    expect(t('plain title')).toBe('title: plain title');
    expect(t("it's fine")).toBe("title: it's fine");
    expect(t('- looks like a list')).toBe('title: "- looks like a list"');
    expect(t('a: b')).toBe('title: "a: b"');
    expect(t(' padded')).toBe('title: " padded"');
    expect(t('#tag')).toBe('title: "#tag"');
    for (const s of ['plain', "it's", '- x', 'a: b', ' p ', '#t', '"q"', "'s'", 'x"y', '2026', 'ends:'])
      expect(meta(parse(serialize((() => { const d = parse('').doc; setField(d, 'title', s); return d; })())).doc).title).toBe(s);
  });

  it('treats an unclosed --- as body', () => {
    const { doc } = parse(read('mangled/frontmatter-unterminated.md'));
    expect(doc.frontmatter).toBeUndefined();
    expect(doc.blocks[0]).toEqual({ kind: 'raw', text: '---\ntype: deck\nfrozen: true' });
    expect(doc.blocks.map((b) => b.kind)).toEqual(['raw', 'paragraph']);
  });

  it('clippings: url, author, and published round-trip; the first two quoted as a title is, the third a day or an instant', () => {
    const { doc, diagnostics } = parse(read('vault/fleeting/clipped-page.md'));
    expect(diagnostics).toEqual([]);
    expect(meta(doc)).toMatchObject({ url: 'https://example.org/notes/spaced-repetition', author: 'Jane Doe', published: '2026-05-20' });
    expect(doc.blocks.some((b) => b.kind === 'card')).toBe(false);
    const d = parse('x\n').doc;
    setField(d, 'url', 'https://example.org/a?b=1#c');
    setField(d, 'author', 'Doe, Jane: editor');
    setField(d, 'published', '2026-05-20T09:15:00Z');
    expect(serialize(d).split('\n').slice(0, 5)).toEqual(['---', 'url: https://example.org/a?b=1#c', 'author: "Doe, Jane: editor"', 'published: 2026-05-20T09:15:00Z', '---']);
    expect(meta(parse(serialize(d)).doc)).toMatchObject({ url: 'https://example.org/a?b=1#c', author: 'Doe, Jane: editor', published: '2026-05-20T09:15:00Z' });
    setField(d, 'url', null);
    setField(d, 'author', null);
    setField(d, 'published', null);
    expect(serialize(d)).toBe('x\n');
    // an instant without seconds is read and written with them; bad values stay as raw lines with a diagnostic
    expect(meta(parse('---\npublished: 2026-05-20T09:15Z\n---\n\nx\n').doc).published).toBe('2026-05-20T09:15:00Z');
    const bad = parse('---\npublished: yesterday\nurl:\nauthor: "bad \\q"\n---\n\nx\n');
    expect(bad.diagnostics.map((x) => `${x.line}: ${x.message}`)).toEqual(['2: bad value for "published"', '3: "url" needs a value', '4: bad quoted title', '4: bad value for "author"']);
    expect(meta(bad.doc)).not.toHaveProperty('published');
    expect(serialize(bad.doc)).toBe('---\npublished: yesterday\nurl:\nauthor: "bad \\q"\n---\n\nx\n');
  });

  it('setField keeps position, appends, removes, creates', () => {
    const { doc } = parse('---\ntype: deck\nfoo: bar\nfrozen: true\n---\n\nx\n');
    setField(doc, 'type', 'draft');
    setField(doc, 'read', { due: '2026-01-01', pos: 2 });
    setField(doc, 'frozen', null);
    expect(serialize(doc)).toBe('---\ntype: draft\nfoo: bar\nread: due=2026-01-01 pos=2\n---\n\nx\n');
    const bare = parse('x\n').doc;
    setField(bare, 'write', { due: '2026-01-01', done: true });
    expect(serialize(bare)).toBe('---\nwrite: due=2026-01-01 done=true\n---\n\nx\n');
    setField(bare, 'write', null);
    expect(serialize(bare)).toBe('x\n');
  });
});

describe('cards', () => {
  it('finds every card in the paper with its ids and schedules', () => {
    const cs = cards(read('vault/papers/wozniak-1990.md'));
    expect(cs.map((c) => c.id)).toEqual(['cw1-paths', 'cw2-min', 'cw2-retr', 'cw2-atom', 'cw2-integ', 'cw3-leech', 'cw3-prereq']);
    expect(cs.map((c) => cardForm(c.text))).toEqual(['qa', 'cloze', 'cloze', 'qa', 'cloze', 'qa', 'qa']);
    const min = cs[1]!;
    expect(min.sched).toBeUndefined();
    expect(min.blanks).toEqual({
      1: { due: '2026-05-27', state: 'review', stability: 11.8, difficulty: 4.2, reps: 14, lapses: 2, ivl: 12, last: '2026-05-15T08:00:00Z', grade: 3 },
      2: { due: '2026-06-01', state: 'review', stability: 3, difficulty: 5.1, reps: 2, lapses: 0, ivl: 3, last: '2026-05-29T08:00:00Z', grade: 3 },
    });
    expect(cs[4]!.sched).toBeUndefined();            // hand-written card, never reviewed
    expect(cs[4]!.blanks).toBeUndefined();
    expect(cs[5]!.sched).toMatchObject({ state: 'relearning', steps: 1, lapses: 4, grade: 1 });
    expect(cardFields(cs[3]!.text)).toEqual({
      form: 'qa',
      front: 'why is bundling several facts on one card a false economy?',
      back: 'a card with three facts has roughly the failure probability of three cards, but only one of them can be marked good',
    });
  });

  it('attaches extract backrefs to prose', () => {
    const { doc } = parse(read('vault/papers/wozniak-1990.md'));
    const p = doc.blocks.find((b): b is Paragraph => b.kind === 'paragraph' && b.text.startsWith('Atomicity sounds easy'));
    expect(p?.extracts).toEqual(['woz-ex1']);
  });

  it('recognizes every form and leaves prose alone', () => {
    const text = read('mangled/forms.md');
    const cs = cards(text);
    expect(cs.map((c) => [c.id, cardForm(c.text)])).toEqual([
      ['inline-qa', 'qa'], ['inline-bidir', 'bidir'], ['multi-qa', 'qa'], ['multi-bidir', 'bidir'],
      ['own-line-id', 'qa'], ['second', 'qa'], ['cloze-wins', 'cloze'], ['empty-answer', 'cloze'],
    ]);
    expect(cardFields(cs[2]!.text)).toEqual({ form: 'qa', front: 'a question that wraps\nonto a second line', back: 'an answer that also\nwraps' });
    expect(cardFields(cs[3]!.text)).toEqual({ form: 'bidir', left: 'Begriff', right: 'concept' });
    expect(cs[4]!.text).toBe('a card whose second line\n\tis tab-indented, lazy, and stays in the card :: with an answer   ');
    expect(serialize({ blocks: [cs[4]!] })).toBe('a card whose second line\n\tis tab-indented, lazy, and stays in the card :: with an answer   \n^own-line-id\n<!-- sr due=2026-01-01 -->\n');
    expect(cs[5]!.text).toBe('a q :: a ^first');
    const prose = parse(text).doc.blocks.filter((b): b is Paragraph => b.kind === 'paragraph').map((b) => b.text.split('\n')[0]);
    expect(prose).toEqual([
      'std::vector is prose because the separator has no spaces around it',
      ':: empty front makes prose', 'empty back makes prose too ::', '?',
      'a paragraph with an ^id-in-the-middle of a line and one at the end',
    ]);
    const h = parse(text).doc.blocks.find((b): b is Heading => b.kind === 'heading');
    expect(h?.text).toBe('a heading keeps its ^literal');
    expect(parse(text).doc.blocks.find((b): b is Paragraph => b.kind === 'paragraph' && b.id === 'prose-id')).toBeDefined();
  });

  it('serializes annotations in canonical order', () => {
    const [c] = cards('x {{c2::b}} {{c1::a}} ^z\n<!-- extract e2 -->\n<!-- sr c2 due=2026-01-02 -->\n<!-- extract e1 -->\n<!--sr   c1   due=2026-01-01   -->\n<!-- sr   s=1.50 due=2026-01-03 -->\n');
    expect(serialize({ blocks: [c!] })).toBe(
      'x {{c2::b}} {{c1::a}} ^z\n<!-- sr due=2026-01-03 s=1.5 -->\n<!-- sr c1 due=2026-01-01 -->\n<!-- sr c2 due=2026-01-02 -->\n<!-- extract e2 -->\n<!-- extract e1 -->\n',
    );
  });

  it('keeps unknown attributes and drops bad ones with diagnostics', () => {
    const { doc, diagnostics } = parse(read('mangled/sr-attrs-bad.md'));
    const cs = doc.blocks.filter((b): b is Card => b.kind === 'card');
    expect(cs[0]!.sched).toEqual({ stability: 11.8, last: '2026-05-01T09:15:00Z', ivl: 1000, extra: [['custom', 'kept'], ['another', 'one']] });
    expect(serialize(doc)).toContain('<!-- sr s=11.8 ivl=1000 last=2026-05-01T09:15:00Z custom=kept another=one -->');
    expect(cs[1]!.sched).toEqual({ due: '2026-01-01' });
    expect(cs[2]!.blanks).toEqual({ 1: { due: '2026-01-01' }, 2: { due: '2026-02-02' } });
    expect(cs[3]!.sched).toEqual({});
    expect(cs[3]!.extracts).toEqual(['spaced name with words']);
    expect(meta(doc).read).toEqual({ pri: 1, extra: [['weird', 'ok']] });
    expect(meta(doc).write).toEqual({ due: '2026-05-27T09:15:00Z' });
    const messages = diagnostics.map((d) => d.message);
    for (const m of ['bad value for "due": 2026-13-40', 'bad value for "st": Review', 'bad value for "s": abc', 'bad value for "g": 7',
      'empty value for "steps"', 'bad attribute name ""', 'unexpected token "junk"', 'unexpected token "c3"', 'bad value for "done": maybe'])
      expect(messages).toContain(m);
  });

  it('orphan annotations stay as raw text', () => {
    const { doc, diagnostics } = parse(read('mangled/orphans.md'));
    expect(doc.blocks.map((b) => b.kind)).toEqual([
      'raw', 'heading', 'raw', 'raw', 'paragraph', 'raw', 'card', 'raw', 'card', 'raw', 'raw', 'raw', 'raw', 'paragraph', 'raw',
    ]);
    const drift = doc.blocks[6] as Card;
    expect(drift.blanks).toBeUndefined();
    const keeper = doc.blocks[8] as Card;
    expect(keeper.blanks).toEqual({ 1: { due: '2026-02-02', state: 'review', stability: 9 } });
    expect(keeper.extracts).toBeUndefined();          // the nameless line broke the chain; keep-me is an orphan too
    expect((doc.blocks[7] as Raw).text).toBe('<!-- sr c1 due=2026-01-01 st=review s=9 -->');
    expect((doc.blocks[10] as Raw).text).toBe('<!-- extract keep-me -->');
    expect((doc.blocks[11] as Raw).text).toBe('<!-- SR:!2026-01-01,4,270 -->');
    expect((doc.blocks[14] as Raw).text).toBe('<!-- sr unterminated');
    expect(diagnostics.map((d) => d.line)).toEqual([1, 4, 5, 8, 12, 16, 17]);
    expect(new Set(diagnostics.map((d) => d.message))).toEqual(new Set(['orphan sr line', 'orphan extract line']));
  });

  it('grading rewrites exactly one line', () => {
    const text = read('vault/papers/wozniak-1990.md');
    const { doc } = parse(text);
    const c = doc.blocks.find((b): b is Card => b.kind === 'card' && b.id === 'cw2-min')!;
    c.blanks![2] = { ...c.blanks![2]!, due: '2026-06-09', stability: 7.2, reps: 3, last: '2026-06-01T08:00:00Z' };
    const before = text.split('\n'), after = serialize(doc).split('\n');
    expect(after.length).toBe(before.length);
    const changed = before.map((l, i) => (l === after[i] ? null : i)).filter((i) => i !== null);
    expect(changed.length).toBe(1);
    expect(after[changed[0]!]).toBe('<!-- sr c2 due=2026-06-09 st=review s=7.2 d=5.1 r=3 l=0 ivl=3 last=2026-06-01T08:00:00Z g=3 -->');
  });
});

describe('cloze', () => {
  it('splits blanks and numbers groups', () => {
    expect(clozeParts('the {{c1::a}} and {{2::b}} and {{c}} end')).toEqual([
      'the ', { n: 1, answer: 'a', raw: '{{c1::a}}' }, ' and ', { n: 2, answer: 'b', raw: '{{2::b}}' }, ' and ', { n: null, answer: 'c', raw: '{{c}}' }, ' end',
    ]);
    expect(clozeGroups('{{c3::x}} {{c1::y}} {{c3::z}} {{w}}')).toEqual([3, 1]);
    expect(nextGroup('{{c1::a}} {{c3::b}}')).toBe(2);
    expect(clozeParts('{{std::vector}}')).toEqual([{ n: null, answer: 'std::vector', raw: '{{std::vector}}' }]);
    expect(clozeParts('{{}} {{ }} {{c1::}}')).toEqual(['{{}} {{ }} ', { n: 1, answer: '', raw: '{{c1::}}' }]);
  });

  it('sees math spans, and outside them the first }} closes a blank', () => {
    expect(mathSpanEnd('$x$', 0)).toBe(3);
    expect(mathSpanEnd('$5 and $10', 0)).toBe(-1);
    expect(mathSpanEnd('$ x$', 0)).toBe(-1);
    expect(mathSpanEnd('$$a\nb$$', 0)).toBe(7);
    expect(mathSpanEnd('$a\nb$', 0)).toBe(-1);
    expect(clozeParts('{{c1::$x^{a^{b}}$}}')).toEqual([{ n: 1, answer: '$x^{a^{b}}$', raw: '{{c1::$x^{a^{b}}$}}' }]);
    expect(clozeParts('nested {{c1::{{x}}}} braces')).toEqual(['nested ', { n: 1, answer: '{{x', raw: '{{c1::{{x}}' }, '}} braces']);
    expect(clozeParts('{{c2::a} }} then {{c3::open')).toEqual([{ n: 2, answer: 'a} ', raw: '{{c2::a} }}' }, ' then {{c3::open']);
  });

  it('inside math a numbered blank closes at the balanced }}; the unnumbered and the unbalanced stay TeX', () => {
    // the balanced close: the answer keeps its own braces
    expect(clozeParts('so $y = {{c1::x^{2}}}$ holds')).toEqual(['so $y = ', { n: 1, answer: 'x^{2}', raw: '{{c1::x^{2}}}', math: true }, '$ holds']);
    expect(blanks('$$ {{c1::\\frac{a}{b}}} $$')).toEqual([{ n: 1, answer: '\\frac{a}{b}', raw: '{{c1::\\frac{a}{b}}}', math: true }]);
    expect(blanks('${{2::\\{a\\}}}$')).toEqual([{ n: 2, answer: '\\{a\\}', raw: '{{2::\\{a\\}}}', math: true }]);
    // the unnumbered form is TeX
    expect(clozeParts('$\\{\\{x\\}\\}$ and $$\\binom{n}{{k}}$$ and $x^{{a}}$')).toEqual(['$\\{\\{x\\}\\}$ and $$\\binom{n}{{k}}$$ and $x^{{a}}$']);
    // unbalanced: a brace too many, a close never reached, an answer that closes the math early
    expect(clozeParts('$a = {{c1::\\frac{1}{2}}$ half')).toEqual(['$a = {{c1::\\frac{1}{2}}$ half']);
    expect(clozeParts('$a {{c1::b$ and {{c2::c}}')).toEqual(['$a {{c1::b$ and ', { n: 2, answer: 'c', raw: '{{c2::c}}' }]);
    expect(clozeParts('$E = {{c1::m$ c^2}}$')).toEqual(['$E = {{c1::m$ c^2}}$']);
    // a blank spanning an align line, alignment mark and all
    const align = '$$\\begin{align}\na &= {{c1::b}} \\\\\n{{c2::c &= d}}\n\\end{align}$$';
    expect(cardForm(align)).toBe('cloze');
    expect(blanks(align)).toEqual([{ n: 1, answer: 'b', raw: '{{c1::b}}', math: true }, { n: 2, answer: 'c &= d', raw: '{{c2::c &= d}}', math: true }]);
    // segments: a formula holding blanks is one piece, a formula without is text
    expect(clozeSegments('so $y = {{c1::x^{2}}}$ is $1/3$, {{c2::t}}')).toEqual([
      'so ', { span: '$y = {{c1::x^{2}}}$', display: false, parts: ['y = ', { n: 1, answer: 'x^{2}', raw: '{{c1::x^{2}}}', math: true }] }, ' is $1/3$, ', { n: 2, answer: 't', raw: '{{c2::t}}' },
    ]);
    // the corpus files
    const mx = parse(read('vault/papers/maxwell.md'));
    expect(mx.diagnostics).toEqual([]);
    expect(mx.doc.blocks.map((b) => b.kind)).toEqual(['heading', 'paragraph', 'card', 'card', 'paragraph', 'paragraph']);
    expect(cards(read('vault/papers/maxwell.md')).map((c) => [c.id, blanks(c.text).map((b) => `c${b.n}: ${b.answer}`), Object.keys(c.blanks ?? {})])).toEqual([
      ['cmx-field', ['c1: \\frac{\\rho}{\\epsilon_0}', 'c2: \\nabla \\times \\mathbf{E} &= -\\frac{\\partial \\mathbf{B}}{\\partial t}'], ['1', '2']],
      ['cmx-area', ['c1: x^{2}'], ['1']],
    ]);
    const mb = parse(read('mangled/math-blanks.md'));
    expect(mb.diagnostics).toEqual([]);
    expect(mb.doc.blocks.map((b) => b.kind)).toEqual(['paragraph', 'paragraph', 'paragraph', 'paragraph', 'card']);
  });

  it('never sees cards in code, lists, quotes, tables, or headings', () => {
    // the $$ block is one display-math span; since milestone 18 its numbered {{c1::x_i}} is a blank, so it is a card
    expect(kinds(read('mangled/code-and-math.md'))).toEqual(['raw', 'raw', 'card', 'card', 'card', 'card', 'card', 'paragraph', 'raw']);
    expect(kinds(read('mangled/lists-quotes-tables.md'))).toEqual(['raw', 'raw', 'raw', 'raw', 'raw', 'raw', 'raw', 'raw', 'raw', 'raw', 'raw', 'paragraph', 'raw']);
    expect(cards(read('mangled/headings.md'))).toEqual([]);
  });
});

describe('blocks', () => {
  it('reads headings in both styles', () => {
    const hs = parse(read('mangled/headings.md')).doc.blocks.filter((b): b is Heading => b.kind === 'heading');
    expect(hs.map((h) => [h.level, h.text, h.setext ?? false])).toEqual([
      [1, 'Setext one', true], [2, 'Setext two, which wraps\nonto a second line', true], [2, 'spaced   heading with closing hashes', false],
      [1, '', false], [1, '', false], [1, 'heading with a {{c1::blank}} is not a card', false], [1, 'heading followed by an extract', false],
      [2, 'single dash under text', true], [1, '##', false], [1, '#', false], [2, 'ends in a hash', false], [2, 'ends in hashes ##', false], [2, 'keeps#', false], [1, 'indented heading', false],
    ]);
    for (const t of ['##', '#', 'x #', 'x ##', 'x\t#', '#x', 'x#'])
      expect((parse(serialize({ blocks: [{ kind: 'heading', level: 2, text: t }] })).doc.blocks[0] as Heading).text).toBe(t);
    expect(serialize({ blocks: [{ kind: 'heading', level: 1, text: '##' }] })).toBe('# ## #\n');
    const ps = parse(read('mangled/headings.md')).doc.blocks.filter((b): b is Paragraph => b.kind === 'paragraph').map((b) => b.text);
    expect(ps).toEqual(['#TODO: no space after the hash, so this is a paragraph', '####### seven hashes is a paragraph']);
    expect(serialize(parse('##   spaced   ###\n').doc)).toBe('## spaced\n');
  });

  it('normalizes whitespace between blocks and keeps it inside them', () => {
    const text = read('mangled/whitespace.md');
    const { doc } = parse(text);
    expect(doc.blocks).toEqual([
      { kind: 'paragraph', text: 'first paragraph' },
      { kind: 'paragraph', text: 'second paragraph after junk blank lines\n    a lazily continued line with four spaces' },
      { kind: 'raw', text: '    an indented code block\n    second line' },
      { kind: 'paragraph', text: 'third paragraph with trailing spaces   \nand tabs\tinside' },
    ]);
    expect(serialize(doc)).toBe('first paragraph\n\nsecond paragraph after junk blank lines\n    a lazily continued line with four spaces\n\n    an indented code block\n    second line\n\nthird paragraph with trailing spaces   \nand tabs\tinside\n');
  });

  it('handles CRLF, BOM, and missing final newline', () => {
    const { doc, diagnostics } = parse(read('mangled/crlf-bom-no-newline.md'));
    expect(diagnostics).toEqual([]);
    expect(meta(doc)).toEqual({ type: 'source', frozen: true });
    expect(doc.blocks).toEqual([{ kind: 'heading', level: 1, text: 'crlf' }, { kind: 'card', text: 'a {{c1::card}}', id: 'crlf', sched: { due: '2026-01-01', state: 'new' } }]);
    expect(serialize(doc)).toBe('---\ntype: source\nfrozen: true\n---\n\n# crlf\n\na {{c1::card}} ^crlf\n<!-- sr due=2026-01-01 st=new -->\n');
    expect(serialize(parse(read('mangled/no-trailing-newline.md')).doc)).toBe('no newline at end :: of file ^eof\n');
  });

  it('handles the degenerate files', () => {
    expect(parse('').doc).toEqual({ blocks: [] });
    expect(serialize(parse('').doc)).toBe('');
    expect(serialize(parse(read('mangled/only-blank-lines.md')).doc)).toBe('');
    expect(serialize(parse(read('mangled/only-frontmatter.md')).doc)).toBe('---\ntype: deck\n---\n');
    expect(serialize(parse(read('mangled/empty-frontmatter.md')).doc)).toBe('---\n---\n');
  });
});
