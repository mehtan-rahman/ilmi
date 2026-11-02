// The direction rule (direction.ts): a block's majority script, the first
// strong character on a tie, a neutral block inheriting the one before it,
// math, code and card markup isolated and never counted; and the blank that
// is only a case ending.

import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { blanks, clozeSegments, parse } from '../../format/index.js';
import {
  baseSplit, blockDirs, charDir, dirAttr, directionDecorations, isolatedSpans, markupSpans, marksOnly, schema, strongDir, textDir, toDoc, withBases,
} from '../index.js';

const SAMPLE = join(import.meta.dirname, '../../../samples/double-major');
const read = (p: string) => readFileSync(join(SAMPLE, p), 'utf8');

describe('the majority script', () => {
  it('reads a letter of either script, and nothing else', () => {
    expect(charDir('ك')).toBe('rtl');
    expect(charDir('ـ')).toBe('rtl'); // the tatweel is a letter of the script
    expect(charDir('ש')).toBe('rtl');
    expect(charDir('a')).toBe('ltr');
    expect(charDir('ḥ')).toBe('ltr');
    expect(charDir('٣')).toBeNull(); // Arabic-Indic digits are weak
    expect(charDir('َ')).toBeNull(); // a fatḥa is a mark
    expect(charDir('،')).toBeNull();
    expect(charDir(' ')).toBeNull();
  });

  it('is the script with more letters, whichever comes first', () => {
    expect(strongDir('كَانَ وَأَخَوَاتُهَا')).toBe('rtl');
    expect(strongDir('kāna and its sisters: كان')).toBe('ltr');
    // a glossed example and a glossary item open in Arabic and read in English
    expect(strongDir('إِنْ تَدْرُسْ تَنْجَحْ, "if you study, you\'ll succeed", in tadrus tanjaḥ.')).toBe('ltr');
    expect(strongDir('نَحْوِيّ *naḥwī* — grammarian (nisba of نَحْو, grammar)')).toBe('ltr');
    // mostly Arabic with a word of English in it
    expect(strongDir('قَالَ النَّحْوِيُّ: «فَمَا لَكَ لَا تَقُولُ» (the five nouns)')).toBe('rtl');
    expect(strongDir('3. «كَيْفَ تَقُولُ؟»')).toBe('rtl');
    // marks are not letters: four Arabic letters, three Latin
    expect(strongDir('كَتَبَتْ abc')).toBe('rtl');
    expect(strongDir('كتب abcd')).toBe('ltr');
    expect(strongDir('')).toBeNull();
    expect(strongDir('12, 34 — (5)')).toBeNull();
    expect(strongDir('ًٌٍ')).toBeNull();
  });

  it('on a tie, the first letter decides', () => {
    expect(strongDir('كتب abc')).toBe('rtl');
    expect(strongDir('abc كتب')).toBe('ltr');
    expect(strongDir('بَيْت :: house')).toBe('ltr'); // 3 against 5
    expect(strongDir('بَيْتٌ كَبِير :: big home')).toBe('rtl'); // 7 against 7, Arabic first
  });

  it('skips math, code, a link address, card markup, an anchor, a comment, a bare address', () => {
    expect(strongDir('$x^2$ يُسَاوِي أَرْبَعَة')).toBe('rtl');
    expect(strongDir('$$E = mc^2$$')).toBeNull();
    expect(strongDir('`git` ثُمَّ')).toBe('rtl');
    expect(strongDir('[النَّحْو](https://example.org/grammar)')).toBe('rtl');
    expect(strongDir('{{c1::كَانَ}} تَرْفَعُ')).toBe('rtl');
    expect(strongDir('{{c2::fiʿl al-šarṭ}} and')).toBe('ltr');
    // the markup's `c1` is not counted: three Arabic letters against none
    expect(strongDir('{{c1::كَانَ}}')).toBe('rtl');
    expect(strongDir('كتب `const x = foo(bar)` [هنا](https://example.org/a-long-english-path) $\\alpha + beta$')).toBe('rtl');
    expect(strongDir('1 ^nh-hal-def')).toBeNull();
    expect(strongDir('<!-- sr c1 st=new --> كَرَمٌ')).toBe('rtl');
    expect(strongDir('https://example.org ثُمَّ')).toBe('rtl');
  });

  it('falls back, and says so in HTML only when it knows', () => {
    expect(textDir('42', 'rtl')).toBe('rtl');
    expect(textDir('42')).toBe('ltr');
    expect(dirAttr('كتاب')).toBe(' dir="rtl"');
    expect(dirAttr('book')).toBe(' dir="ltr"');
    expect(dirAttr('42')).toBe('');
  });
});

describe('blocks in order', () => {
  it('a neutral block inherits the one before it, an isolated one leaves the run alone', () => {
    expect(blockDirs(['kāna', 'كَانَ', '', '42', '$x$', 'and back'])).toEqual(['ltr', 'rtl', 'rtl', 'rtl', 'rtl', 'ltr']);
    expect(blockDirs(['', 'كَانَ'])).toEqual(['ltr', 'rtl']);
    expect(blockDirs(['', 'x'], 'rtl')).toEqual(['rtl', 'ltr']);
    // fenced code between two Arabic paragraphs: LTR itself, the paragraph after it inherits Arabic
    expect(blockDirs(['كَانَ', null, ''])).toEqual(['rtl', 'ltr', 'rtl']);
  });
});

describe('isolation', () => {
  it('finds math, inline code and a link address, in order', () => {
    const t = 'إِذَا كَانَ $x>0$ فَإِنَّ `f(x)` [هُنَا](a/b.md)';
    const spans = isolatedSpans(t).map((s) => t.slice(s.from, s.to));
    expect(spans).toEqual(['$x>0$', '`f(x)`', '](a/b.md)']);
    // a `$` that opens nothing is text
    expect(isolatedSpans('٥ $ فقط')).toEqual([]);
  });

  it('finds card markup and an anchor, not a bare `{{`', () => {
    const t = 'جَاءَتِ الطَّالِبَاتُ مُسْرِعَات{{c1::ٍ}} ^nh-hal-fpl';
    expect(markupSpans(t).map((s) => t.slice(s.from, s.to))).toEqual(['{{c1::', '}}', '^nh-hal-fpl']);
    const q = 'كَرَمٌ ::: generosity';
    expect(markupSpans(q).map((s) => q.slice(s.from, s.to))).toEqual([':::']);
    expect(markupSpans('\\binom{n}{{k}}')).toHaveLength(1); // only the `}}`
  });
});

describe('the editor decorates every block', () => {
  const dirs = (md: string) => {
    const doc = toDoc(parse(md).doc.blocks);
    const set = directionDecorations(doc);
    const out: { node: string; dir: string; text: string }[] = [];
    doc.descendants((node, pos) => {
      if (node.isText) return false;
      const d = set.find(pos, pos + node.nodeSize).find((x) => x.from === pos && x.to === pos + node.nodeSize && (x as unknown as { type: { attrs: Record<string, string> } }).type.attrs.dir);
      if (d) out.push({ node: node.type.name, dir: (d as unknown as { type: { attrs: Record<string, string> } }).type.attrs.dir!, text: node.textContent.slice(0, 12) });
      return true;
    });
    return out;
  };

  it('paragraphs, a list by its first item, a neutral item inheriting, code left to right', () => {
    const got = dirs('the rule\n\nكَانَ وَأَخَوَاتُهَا\n\n- رَاكِبًا\n- 2\n- riding\n- رَاكِبٌ *rākib* — riding, a rider\n\n```\nx = 1\n```\n\n$$a+b$$\n');
    expect(got.map((g) => `${g.node}:${g.dir}`)).toEqual([
      'paragraph:ltr', 'paragraph:rtl', 'list:rtl', 'list_item:rtl', 'list_item:rtl', 'list_item:ltr', 'list_item:ltr', 'code_block:ltr', 'paragraph:ltr',
    ]);
  });

  it('the sample glossary: each item mostly English, so left to right', () => {
    const doc = toDoc(parse(read('library/classical-prose-reader/11-the-judge-and-the-two-litigants.md')).doc.blocks);
    const set = directionDecorations(doc);
    const items: string[] = [];
    doc.descendants((node, pos) => {
      if (node.type.name !== 'list_item' || !/^\p{Script=Arabic}/u.test(node.textContent)) return true;
      const d = set.find(pos, pos + node.nodeSize).find((x) => x.from === pos && x.to === pos + node.nodeSize);
      items.push((d as unknown as { type: { attrs: { dir?: string } } } | undefined)?.type.attrs.dir ?? 'none');
      return false;
    });
    expect(items.length).toBeGreaterThan(15);
    expect(new Set(items)).toEqual(new Set(['ltr']));
  });

  it('a card by its text, markup aside; the display formula after it inherits', () => {
    const got = dirs('لَيْسَتِ الطَّالِبَاتُ غَائِبَات{{c1::ٍ}} ^nh-fpl-kasra\n<!-- sr c1 st=new -->\n\n$$x$$\n');
    expect(got.map((g) => `${g.node}:${g.dir}`)).toEqual(['card:rtl', 'paragraph:rtl']);
  });

  it('the sample grammar note: Arabic examples right to left, the English around them left to right', () => {
    const doc = toDoc(parse(read('courses/fall-2026/arab-401-advanced-grammar/conditional-sentences.md')).doc.blocks);
    const set = directionDecorations(doc);
    const of = (prefix: string) => {
      let dir: string | undefined;
      doc.forEach((node, pos) => {
        if (dir === undefined && node.textContent.startsWith(prefix)) {
          dir = (set.find(pos, pos + node.nodeSize).find((x) => x.from === pos) as unknown as { type: { attrs: { dir?: string } } } | undefined)?.type.attrs.dir;
        }
      });
      return dir;
    };
    // glossed in English, so left to right; the verse alone right to left
    expect(of('إِنْ تَدْرُسْ تَنْجَحْ')).toBe('ltr');
    expect(of('اسْمِيَّةٌ طَلَبِيَّةٌ')).toBe('rtl');
    expect(of('A conditional sentence')).toBe('ltr');
    expect(of('the three parts')).toBe('ltr');
    // every top-level block got one
    let n = 0;
    doc.forEach((node, pos) => { if (set.find(pos, pos + node.nodeSize).some((x) => x.from === pos && x.to === pos + node.nodeSize)) n++; });
    expect(n).toBe(doc.childCount);
  });

  it('marks card markup in a paragraph being typed as left to right', () => {
    const doc = schema.node('doc', null, [schema.node('paragraph', null, [schema.text('كَانَ {{c1::')])]);
    const iso = directionDecorations(doc).find().filter((d) => d.from !== 0);
    expect(iso).toHaveLength(1);
    expect(doc.textBetween(iso[0]!.from, iso[0]!.to)).toBe('{{c1::');
  });
});

describe('a blank that is only a case ending', () => {
  it('knows marks from letters', () => {
    expect(marksOnly('ٍ')).toBe(true);
    expect(marksOnly('ُّ')).toBe(true);
    expect(marksOnly('ينَ')).toBe(false);
    expect(marksOnly('')).toBe(false);
  });

  it('splits off the last letter with its marks', () => {
    expect(baseSplit('غَائِبَات')).toEqual(['غَائِبَا', 'ت']);
    expect(baseSplit('قَفْزَتَيْن')).toEqual(['قَفْزَتَيْ', 'ن']);
    expect(baseSplit('كَتَبَ')).toEqual(['كَتَ', 'بَ']);
    expect(baseSplit('word ')).toEqual(['word ', '']);
    expect(baseSplit('')).toEqual(['', '']);
  });

  it('sits each marks-only blank on its letter, in the sample cards', () => {
    for (const [file, prefix] of [
      ['courses/fall-2026/arab-401-advanced-grammar/kana-and-its-sisters.md', 'لَيْسَتِ الطَّالِبَاتُ غَائِبَات'],
      ['courses/fall-2026/arab-401-advanced-grammar/hal-and-tamyiz.md', 'جَاءَتِ الطَّالِبَاتُ مُسْرِعَات'],
      ['courses/fall-2026/arab-401-advanced-grammar/mafuul-mutlaq.md', 'قَفَزَ الوَلَدُ قَفْزَتَيْن'],
    ] as const) {
      const card = parse(read(file)).doc.blocks.find((b) => b.kind === 'card' && b.text.startsWith(prefix));
      expect(card, file).toBeDefined();
      const text = (card as { text: string }).text;
      const segs = withBases(clozeSegments(text));
      const blank = segs.find((s) => typeof s !== 'string' && !('span' in s));
      expect(blank && typeof blank !== 'string' && 'base' in blank ? blank.base : null, file).toBe(prefix.slice(-1));
      // nothing lost: the pieces put back are the card's letters
      const back = segs.map((s) => (typeof s === 'string' ? s : 'span' in s ? s.span : (s.base ?? '') + s.answer)).join('');
      expect(back).toBe(clozeSegments(text).map((s) => (typeof s === 'string' ? s : 'span' in s ? s.span : s.answer)).join(''));
      expect(blanks(text)).toHaveLength(1);
    }
  });

  it('leaves a letter answer, a blank at the start, and a math blank alone', () => {
    const plain = withBases(clozeSegments('حَاضِرِ{{c1::ينَ}}'));
    expect(plain).toEqual(clozeSegments('حَاضِرِ{{c1::ينَ}}'));
    expect(withBases(clozeSegments('{{c1::ٍ}} alone'))).toEqual(clozeSegments('{{c1::ٍ}} alone'));
  });
});
