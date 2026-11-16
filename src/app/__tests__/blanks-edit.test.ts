// @vitest-environment jsdom
// A cloze's blanks where they are written (`reader/blanksDeco.ts`): made
// from a selection, one inside another, taken away again; and a nested
// blank as a card draws it (`clozeHTML`).
import { describe, expect, it } from 'vitest';
import { AllSelection, TextSelection, type EditorState } from 'prosemirror-state';
import { blankAround, blanksOf, faceText, flatText, makeBlank, makeState, regroupBlank, removeBlank } from '../../reader/index.js';
import { blankAnswers, clozeHTML } from '../Reader.js';
import { blanks } from '../../format/index.js';
import { cardGroups, numberBlank } from '../../schedule/index.js';

const stateOf = (text: string): EditorState => makeState([{ kind: 'paragraph', text }], { frozen: () => false, pos: null, blanks: true });
const textOf = (s: EditorState) => flatText(s.doc.firstChild!);
/** Select `word` (its first appearance), run a command, give the state after. */
const on = (s: EditorState, word: string | [number, number], cmd: ReturnType<typeof makeBlank>): EditorState => {
  const t = textOf(s);
  const [a, b] = typeof word === 'string' ? [t.indexOf(word), t.indexOf(word) + word.length] : word;
  let next = s.apply(s.tr.setSelection(TextSelection.create(s.doc, 1 + a, 1 + b)));
  expect(cmd(next, (tr) => { next = next.apply(tr); })).toBe(true);
  return next;
};

describe('a blank is made from a selection, not typed', () => {
  it('⌘B numbers each blank with a group of its own; the caret stays inside it', () => {
    let s = stateOf('the amr is unsur and the nahy is la tansur');
    s = on(s, 'unsur', makeBlank());
    expect(textOf(s)).toBe('the amr is {{c1::unsur}} and the nahy is la tansur');
    expect(blankAround(s)?.n).toBe(1);
    s = on(s, 'la tansur', makeBlank());
    expect(textOf(s)).toBe('the amr is {{c1::unsur}} and the nahy is {{c2::la tansur}}');
    expect(blanksOf(s).map((b) => [b.n, b.depth])).toEqual([[1, 0], [2, 0]]);
  });
  it('with nothing selected the word at the caret is the blank', () => {
    let s = stateOf('one two three');
    s = on(s, [5, 5], makeBlank());
    expect(textOf(s)).toBe('one {{c1::two}} three');
  });
  it('a selection around blanks makes a blank that holds them; one that cuts a blank is widened to hold it', () => {
    let s = stateOf('a {{c1::b}} c {{c2::d}} e');
    s = on(s, [0, textOf(s).length], makeBlank());
    expect(textOf(s)).toBe('{{c3::a {{c1::b}} c {{c2::d}} e}}');
    expect(blanksOf(s).map((b) => [b.n, b.depth])).toEqual([[3, 0], [1, 1], [2, 1]]);
    let t = stateOf('a {{c1::bcd}} e');
    // from `a` to the middle of the blank's answer
    t = on(t, [0, 9], makeBlank());
    expect(textOf(t)).toBe('{{c2::a {{c1::bcd}}}} e');
  });
  it('a blank joins a group there is, moves to another, and is taken away with its words left', () => {
    let s = stateOf('x {{c1::y}} z w');
    s = on(s, 'w', makeBlank(1));
    expect(textOf(s)).toBe('x {{c1::y}} z {{c1::w}}');
    s = on(s, [textOf(s).length - 3, textOf(s).length - 3], regroupBlank(4));
    expect(textOf(s)).toBe('x {{c1::y}} z {{c4::w}}');
    s = on(s, [8, 8], removeBlank);
    expect(textOf(s)).toBe('x y z {{c4::w}}');
  });
  it('the innermost blank at the caret is the one taken away', () => {
    let s = stateOf('{{c2::a {{c1::b}} c}}');
    s = on(s, [14, 14], removeBlank);
    expect(textOf(s)).toBe('{{c2::a b c}}');
  });
});

describe('a card of several lines is one text', () => {
  const lines = (...ls: string[]): EditorState => makeState(ls.map((text) => ({ kind: 'paragraph' as const, text })), { frozen: () => false, pos: null, blanks: true });
  const whole = (s: EditorState) => faceText(s.doc).text;
  it('a blank made over lines opens on the first and closes on the last, and is read as one', () => {
    let s = lines('nasara {{c1::yansuru}}', 'wa nusira {{c2::yunsaru}}', 'al-amr {{c3::unsur}}');
    // everything selected, as ⌘A selects it
    s = s.apply(s.tr.setSelection(new AllSelection(s.doc)));
    let next = s;
    expect(makeBlank()(s, (tr) => { next = s.apply(tr); })).toBe(true);
    expect(whole(next)).toBe('{{c4::nasara {{c1::yansuru}}\nwa nusira {{c2::yunsaru}}\nal-amr {{c3::unsur}}}}');
    expect(blanksOf(next).map((b) => [b.n, b.depth])).toEqual([[4, 0], [1, 1], [2, 1], [3, 1]]);
    // its opening is on the first line, its closing on the last
    const outer = blanksOf(next)[0]!;
    expect(next.doc.resolve(outer.from).index(0)).toBe(0);
    expect(next.doc.resolve(outer.to).index(0)).toBe(2);
    // and taken away again, the lines are as they were
    next = next.apply(next.tr.setSelection(TextSelection.create(next.doc, outer.inner)));
    let back = next;
    expect(removeBlank(next, (tr) => { back = next.apply(tr); })).toBe(true);
    expect(whole(back)).toBe('nasara {{c1::yansuru}}\nwa nusira {{c2::yunsaru}}\nal-amr {{c3::unsur}}');
  });
  it('a selection from the middle of one line to the middle of the next is one blank; the groups are counted over all the lines', () => {
    let s = lines('one two', 'three {{c1::four}}');
    s = s.apply(s.tr.setSelection(TextSelection.create(s.doc, 5, 15)));
    let next = s;
    expect(makeBlank()(s, (tr) => { next = s.apply(tr); })).toBe(true);
    expect(whole(next)).toBe('one {{c2::two\nthree}} {{c1::four}}');
    expect(blanksOf(next).length).toBe(2);
  });
});

describe('a blank inside a blank, asked', () => {
  const text = '{{c9::nasara {{c1::yansuru}} wa {{c2::nusira}}}} end';
  const cls = (s: string) => s;
  it('the whole asked: one hidden run, nothing inside it asked apart', () => {
    const html = clozeHTML(text, (_b, i) => (i === 0 ? 'hidden' : 'plain'), cls);
    expect(html).toBe('<span class="hidden">nasara yansuru wa nusira</span> end');
  });
  it('a part asked: the whole is shown around it, the part hidden, the other part plain', () => {
    const mine = blanks(text).map((b) => b.n === 1);
    const html = clozeHTML(text, (_b, i) => (mine[i] ? 'hidden' : 'plain'), cls);
    expect(html).toBe('<span class="plain">nasara <span class="hidden">yansuru</span> wa <span class="plain">nusira</span></span> end');
  });
  it('its groups are scheduled apart, the outer first; the answer of each is its own', () => {
    expect(cardGroups(text)).toEqual([{ n: 9 }, { n: 1 }, { n: 2 }]);
    expect(blankAnswers(text, (i) => i === 0)).toEqual(['nasara yansuru wa nusira']);
    expect(blankAnswers(text, (i) => i === 2)).toEqual(['nusira']);
  });
  it('an unnumbered blank inside another is numbered where it stands', () => {
    expect(numberBlank('{{c1::a {{b}} c}}', 1, 2)).toBe('{{c1::a {{c2::b}} c}}');
    expect(numberBlank('{{a {{b}}}}', 0, 3)).toBe('{{c3::a {{b}}}}');
  });
});
