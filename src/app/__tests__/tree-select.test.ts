// The tree's selection, pure (`treeSelect.ts`): one row, a range from the
// anchor, a row toggled, ⇧↑ ⇧↓, every row, back to one; the topmost of
// several; what an act is done to; following a move and letting go of what
// is no longer drawn.

import { describe, expect, it } from 'vitest';
import { NONE, actedOn, collapseSel, extendSel, followSel, inOrder, isSelected, pruneSel, rangeSel, refusedAny, selectAll, selectOne, several, toggleSel, topmost } from '../treeSelect.js';

// the rows drawn, top to bottom: a folder open over two notes, a note with a child, two loose notes
const ROWS = ['a', 'a/x.md', 'a/y.md', 'b.md', 'b/in.md', 'c.md', 'd.md'];

describe('one row', () => {
  it('is the selection, the anchor and the focus; none is none', () => {
    expect(selectOne('c.md')).toEqual({ paths: ['c.md'], anchor: 'c.md', focus: 'c.md' });
    expect(selectOne(null)).toBe(NONE);
    expect(several(selectOne('c.md'))).toBe(false);
    expect(isSelected(selectOne('c.md'), 'c.md')).toBe(true);
    expect(isSelected(selectOne('c.md'), 'd.md')).toBe(false);
  });
});

describe('⇧-click', () => {
  it('takes the rows from the anchor to the row, either way, and keeps the anchor', () => {
    const down = rangeSel(selectOne('a/y.md'), ROWS, 'c.md');
    expect(down).toEqual({ paths: ['a/y.md', 'b.md', 'b/in.md', 'c.md'], anchor: 'a/y.md', focus: 'c.md' });
    // a second ⇧-click is a new range from the same anchor, not one added to the first
    const up = rangeSel(down, ROWS, 'a');
    expect(up).toEqual({ paths: ['a', 'a/x.md', 'a/y.md'], anchor: 'a/y.md', focus: 'a' });
  });

  it('with no anchor among the rows (none yet, the root\'s row, a card\'s) is the one row', () => {
    expect(rangeSel(NONE, ROWS, 'c.md')).toEqual(selectOne('c.md'));
    expect(rangeSel(selectOne(''), ROWS, 'c.md')).toEqual(selectOne('c.md'));
    expect(rangeSel(selectOne(':cards/b.md#0'), ROWS, 'c.md')).toEqual(selectOne('c.md'));
  });

  it('on a row that cannot be picked selects that row alone', () => {
    expect(rangeSel(selectOne('c.md'), ROWS, '')).toEqual(selectOne(''));
  });
});

describe('⌘-click', () => {
  it('puts a row in, and it is the anchor of the next range', () => {
    const s = toggleSel(selectOne('a/x.md'), ROWS, 'c.md');
    expect(s).toEqual({ paths: ['a/x.md', 'c.md'], anchor: 'c.md', focus: 'c.md' });
    expect(rangeSel(s, ROWS, 'd.md').paths).toEqual(['c.md', 'd.md']);
  });

  it('takes a row out; the last one out leaves nothing', () => {
    const two = toggleSel(selectOne('a/x.md'), ROWS, 'c.md');
    const one = toggleSel(two, ROWS, 'c.md');
    expect(one).toEqual({ paths: ['a/x.md'], anchor: 'a/x.md', focus: 'a/x.md' });
    expect(toggleSel(one, ROWS, 'a/x.md')).toEqual(NONE);
  });

  it('lets go of a lone row that is no node (the root\'s) as a node joins, and of what is no longer drawn', () => {
    expect(toggleSel(selectOne(''), ROWS, 'c.md').paths).toEqual(['c.md']);
    expect(toggleSel({ paths: ['gone.md', 'd.md'], anchor: 'd.md', focus: 'd.md' }, ROWS, 'c.md').paths).toEqual(['d.md', 'c.md']);
    // on the root's row itself: that row alone
    expect(toggleSel(selectOne('c.md'), ROWS, '')).toEqual(selectOne(''));
  });
});

describe('⇧↑ ⇧↓', () => {
  it('grow the selection from the anchor a row at a time, and shrink it back', () => {
    let s = selectOne('b.md');
    s = extendSel(s, ROWS, 1)!;
    s = extendSel(s, ROWS, 1)!;
    expect(s).toEqual({ paths: ['b.md', 'b/in.md', 'c.md'], anchor: 'b.md', focus: 'c.md' });
    s = extendSel(s, ROWS, -1)!;
    expect(s.paths).toEqual(['b.md', 'b/in.md']);
    // back through the anchor, the range turns over
    s = extendSel(extendSel(extendSel(s, ROWS, -1)!, ROWS, -1)!, ROWS, -1)!;
    expect(s).toEqual({ paths: ['a/x.md', 'a/y.md', 'b.md'], anchor: 'b.md', focus: 'a/x.md' });
  });

  it('stop at the ends; from the root\'s row ⇧↓ is the first row', () => {
    expect(extendSel(selectOne('d.md'), ROWS, 1)).toBeNull();
    expect(extendSel(selectOne('a'), ROWS, -1)).toBeNull();
    expect(extendSel(selectOne(''), ROWS, 1)).toEqual(selectOne('a'));
    expect(extendSel(selectOne(''), ROWS, -1)).toBeNull();
    expect(extendSel(NONE, [], 1)).toBeNull();
  });
});

describe('⌘A and Esc', () => {
  it('⌘A is every row drawn, the focus where it was', () => {
    const s = selectAll(selectOne('c.md'), ROWS);
    expect(s.paths).toEqual(ROWS);
    expect(s.focus).toBe('c.md');
    expect(selectAll(selectOne(''), ROWS).focus).toBe('a');
    expect(selectAll(NONE, [])).toBe(NONE);
  });

  it('Esc is the one row the keys are on', () => {
    const s = rangeSel(selectOne('a/y.md'), ROWS, 'c.md');
    expect(collapseSel(s)).toEqual(selectOne('c.md'));
    expect(collapseSel(NONE)).toBe(NONE);
  });
});

describe('several as one', () => {
  it('the topmost: a row under another selected row goes with that one', () => {
    expect(topmost(['a/x.md', 'a', 'c.md'])).toEqual(['a', 'c.md']);
    // a document's children are under it
    expect(topmost(['b.md', 'b/in.md'])).toEqual(['b.md']);
    // a name that only begins the same is not under it
    expect(topmost(['a', 'ab.md', 'abc'])).toEqual(['a', 'ab.md', 'abc']);
    expect(topmost(['c.md', 'c.md'])).toEqual(['c.md']);
  });

  it('an act on a selected row is done to them all, in the order drawn; on another row, to that row', () => {
    const s = toggleSel(toggleSel(selectOne('d.md'), ROWS, 'a/x.md'), ROWS, 'a');
    expect(actedOn(s, ROWS, 'd.md')).toEqual(['a', 'd.md']);
    expect(actedOn(s, ROWS, 'c.md')).toEqual(['c.md']);
    expect(actedOn(selectOne('c.md'), ROWS, 'c.md')).toEqual(['c.md']);
    expect(inOrder(s.paths, ROWS)).toEqual(['a', 'a/x.md', 'd.md']);
  });

  it('no drop on any of them or under one', () => {
    expect(refusedAny(['a', 'c.md'], 'a/x.md')).toBe(true);
    expect(refusedAny(['a', 'c.md'], 'c.md')).toBe(true);
    expect(refusedAny(['b.md'], 'b/in.md')).toBe(true);
    expect(refusedAny(['a', 'c.md'], 'd.md')).toBe(false);
  });
});

describe('what moves and what goes', () => {
  it('follows a node moved or renamed: it, and the rows under it', () => {
    const s = { paths: ['a', 'a/x.md', 'd.md'], anchor: 'a/x.md', focus: 'd.md' };
    expect(followSel(s, 'a', 'z/a')).toEqual({ paths: ['z/a', 'z/a/x.md', 'd.md'], anchor: 'z/a/x.md', focus: 'd.md' });
    expect(followSel(s, 'd.md', 'e.md').paths).toEqual(['a', 'a/x.md', 'e.md']);
    // nothing of it moved: the same selection, not a new one
    expect(followSel(s, 'c.md', 'q.md')).toBe(s);
    expect(followSel(s, 'a', 'a')).toBe(s);
  });

  it('of several, lets go of a row no longer drawn; the anchor and the focus go to one that stayed', () => {
    const s = { paths: ['a/x.md', 'c.md', 'd.md'], anchor: 'a/x.md', focus: 'a/x.md' };
    expect(pruneSel(s, ROWS)).toBe(s);
    const folded = ROWS.filter((p) => !p.startsWith('a/'));
    expect(pruneSel(s, folded)).toEqual({ paths: ['c.md', 'd.md'], anchor: 'd.md', focus: 'd.md' });
    expect(pruneSel(s, [])).toBe(NONE);
  });

  it('one row is kept as it is, drawn or not', () => {
    const s = selectOne('gone.md');
    expect(pruneSel(s, ROWS)).toBe(s);
  });
});
