// The one drag model (milestone 38), pure: the zones of a row, an open
// parent's first child, how far out a drop below a last child lands by the
// pointer's x, the rest before `into` on a bare document, refusals, and the
// edge scroll.

import { describe, expect, it } from 'vitest';
import { INTO_DWELL, SPRING_MS, dropAt, edgeScroll, geometry, refused, sameDrop, zoneAt, type FlatRow, type Pointer } from '../dnd.js';

// A tree as the sidebar draws it (the root row at 0, rows from depth 1):
//   ''                     root
//     courses/             open
//       fall/              open
//         qm.md            open, a document with children
//           pt.md
//           wkb.md         last under qm, qm last under fall
//       spring/            folded
//     notes.md             bare document
const ROWS: FlatRow[] = [
  { path: '', depth: 0, nest: 'only' },
  { path: 'courses', depth: 1, nest: 'now' },
  { path: 'courses/fall', depth: 2, nest: 'now' },
  { path: 'courses/fall/qm.md', depth: 3, nest: 'now' },
  { path: 'courses/fall/qm/pt.md', depth: 4, nest: 'dwell' },
  { path: 'courses/fall/qm/wkb.md', depth: 4, nest: 'dwell' },
  { path: 'courses/spring', depth: 2, nest: 'now' },
  { path: 'notes.md', depth: 1, nest: 'dwell' },
];
const G = geometry(ROWS, 1);
const at = (path: string) => G.find((g) => g.path === path)!;
/** A pointer on a 24 px row, the tree's 6 px pad and 13 px indent. */
const P = (y: number, x = 200): Pointer => ({ x, y, h: 24, pad: 6, indent: 13 });

describe('zones', () => {
  it('splits a row 25 / 50 / 25', () => {
    expect([0, 5, 6, 12, 17, 18, 23].map((y) => zoneAt(y, 24))).toEqual(['before', 'before', 'into', 'into', 'into', 'after', 'after']);
  });

  it('places before on the top quarter and nests in the middle of a folder at once', () => {
    expect(dropAt(at('courses/spring'), P(2), 'notes.md')).toEqual({ target: 'courses/spring', mode: 'before', row: 'courses/spring', draw: 'top', depth: 2 });
    expect(dropAt(at('courses/spring'), P(12), 'notes.md')).toEqual({ target: 'courses/spring', mode: 'into', row: 'courses/spring', draw: 'box', depth: 3 });
  });

  it('nests in a bare document only after the pointer rests; until then its middle is before / after by the half', () => {
    const pt = at('courses/fall/qm/pt.md');
    expect(dropAt(pt, P(10), 'notes.md')?.mode).toBe('before');
    expect(dropAt(pt, P(14), 'notes.md')?.mode).toBe('after');
    expect(dropAt(pt, P(12), 'notes.md', true)).toMatchObject({ target: 'courses/fall/qm/pt.md', mode: 'into', draw: 'box' });
    expect(INTO_DWELL).toBeLessThan(SPRING_MS);
  });

  it('the root row takes only into, whatever the zone', () => {
    for (const y of [1, 12, 23]) expect(dropAt(at(''), P(y), 'notes.md')).toMatchObject({ target: '', mode: 'into', draw: 'box' });
  });
});

describe('open parents and last children', () => {
  it('an open parent has no "after": its bottom quarter is its first child, the line one level in', () => {
    expect(at('courses/fall/qm.md').firstChild).toBe('courses/fall/qm/pt.md');
    expect(dropAt(at('courses/fall/qm.md'), P(22), 'notes.md')).toEqual({ target: 'courses/fall/qm/pt.md', mode: 'before', row: 'courses/fall/qm.md', draw: 'bottom', depth: 4 });
  });

  it('a row in the middle of its group lands after itself only', () => {
    expect(at('courses/fall/qm/pt.md').tail).toEqual(['courses/fall/qm/pt.md']);
    expect(dropAt(at('courses/fall/qm/pt.md'), P(22, 0), 'notes.md')).toMatchObject({ target: 'courses/fall/qm/pt.md', mode: 'after', depth: 4 });
  });

  it('below the last child, the pointer\'s x picks how far out it lands', () => {
    const wkb = at('courses/fall/qm/wkb.md');
    // wkb closes qm and fall (fall's next sibling, spring, sits at depth 2)
    expect(wkb.tail).toEqual(['courses/fall/qm/wkb.md', 'courses/fall/qm.md', 'courses/fall']);
    const land = (x: number) => { const d = dropAt(wkb, P(22, x), 'notes.md')!; return `${d.mode} ${d.target} @${d.depth}`; };
    // at its own indent (6 + 4·13 = 58) and right of it: after wkb
    expect(land(200)).toBe('after courses/fall/qm/wkb.md @4');
    expect(land(58)).toBe('after courses/fall/qm/wkb.md @4');
    // one indent left: after qm; two: after fall; further left stops at fall
    expect(land(50)).toBe('after courses/fall/qm.md @3');
    expect(land(36)).toBe('after courses/fall @2');
    expect(land(0)).toBe('after courses/fall @2');
  });

  it('the last row of the tree can land as far out as the top level, never beside the root', () => {
    const rows: FlatRow[] = [
      { path: '', depth: 0, nest: 'only' },
      { path: 'a', depth: 1, nest: 'now' },
      { path: 'a/b', depth: 2, nest: 'now' },
      { path: 'a/b/c.md', depth: 3, nest: 'dwell' },
    ];
    const c = geometry(rows, 1)[3]!;
    expect(c.tail).toEqual(['a/b/c.md', 'a/b', 'a']);
    expect(dropAt(c, P(22, 0), 'x.md')).toMatchObject({ target: 'a', mode: 'after', depth: 1 });
  });

  it('an open parent with only its placeholder takes the node inside from its bottom quarter and from the placeholder', () => {
    const rows: FlatRow[] = [
      { path: '', depth: 0, nest: 'only' },
      { path: 'empty', depth: 1, nest: 'now' },
      { path: 'empty', key: 'empty\u0000empty', depth: 2, nest: 'only', placeholder: true },
      { path: 'n.md', depth: 1, nest: 'dwell' },
    ];
    const g = geometry(rows, 1);
    expect(g[1]!.intoBelow).toBe(true);
    expect(dropAt(g[1]!, P(22), 'n.md')).toMatchObject({ target: 'empty', mode: 'into', draw: 'box' });
    expect(dropAt(g[2]!, P(12), 'n.md')).toEqual({ target: 'empty', mode: 'into', row: 'empty\u0000empty', draw: 'box', depth: 3 });
  });

  it('with no pointer x (a host that gives none) a drop below a last child stays at its depth', () => {
    expect(dropAt(at('courses/fall/qm/wkb.md'), { ...P(22), x: Number.NaN }, 'notes.md')).toMatchObject({ target: 'courses/fall/qm/wkb.md', mode: 'after' });
  });
});

describe('refusals', () => {
  it('no drop of a node onto itself or anywhere under it', () => {
    expect(refused('courses', 'courses')).toBe(true);
    expect(refused('courses', 'courses/fall/qm.md')).toBe(true);
    expect(refused('courses/fall/qm.md', 'courses/fall/qm/pt.md')).toBe(true);
    expect(refused('courses/fall/qm.md', 'courses/fall')).toBe(false);
    expect(dropAt(at('courses/fall/qm/pt.md'), P(2), 'courses/fall')).toBeNull();
    expect(dropAt(at('courses/fall'), P(12), 'courses/fall')).toBeNull();
  });

  it('below a last child, a level that would put the node beside itself inside itself is refused', () => {
    // dragging qm: landing after qm (one out from wkb) is under qm's own row; after fall is fine
    expect(dropAt(at('courses/fall/qm/wkb.md'), P(22, 200), 'courses/fall/qm.md')).toBeNull();
    expect(dropAt(at('courses/fall/qm/wkb.md'), P(22, 36), 'courses/fall/qm.md')).toMatchObject({ target: 'courses/fall', mode: 'after' });
  });
});

describe('a flat list (the folder lens, one level)', () => {
  it('every row before / into / after, the last no further out', () => {
    const g = geometry([{ path: 'a.md', depth: 0, nest: 'dwell' }, { path: 'b', depth: 0, nest: 'now' }], 0);
    expect(g.map((r) => r.tail)).toEqual([['a.md'], ['b']]);
    const lens = (y: number): Pointer => ({ x: 0, y, h: 30, pad: 0, indent: 1 });
    expect(dropAt(g[1]!, lens(28), 'a.md')).toMatchObject({ target: 'b', mode: 'after', depth: 0 });
    expect(dropAt(g[1]!, lens(15), 'a.md')).toMatchObject({ target: 'b', mode: 'into' });
  });
});

describe('edge scroll and redraws', () => {
  it('scrolls up near the top edge, down near the bottom, faster nearer, not in the middle', () => {
    expect(edgeScroll(300, 0, 600)).toBe(0);
    expect(edgeScroll(2, 0, 600)).toBeLessThan(edgeScroll(30, 0, 600));
    expect(edgeScroll(30, 0, 600)).toBeLessThan(0);
    expect(edgeScroll(598, 0, 600)).toBeGreaterThan(edgeScroll(570, 0, 600));
    expect(edgeScroll(570, 0, 600)).toBeGreaterThan(0);
    // a scroller too short to have edges does not scroll
    expect(edgeScroll(2, 0, 100)).toBe(0);
  });

  it('the same drop is the same', () => {
    const a = dropAt(at('courses/spring'), P(2), 'notes.md');
    expect(sameDrop(a, dropAt(at('courses/spring'), P(3), 'notes.md'))).toBe(true);
    expect(sameDrop(a, dropAt(at('courses/spring'), P(12), 'notes.md'))).toBe(false);
    expect(sameDrop(null, null)).toBe(true);
  });
});
