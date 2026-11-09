// The tree's rows and keys (milestone 38), pure: the rows drawn with the
// placeholder and a hoist, the rows a reveal opens, every key, type-ahead,
// and a keyboard move as the drop the vault takes; and the names a row
// shows: slugs read as names, one due number with the full counts behind
// it, and the kinds' marks all drawn by the bundled face.

import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { inflateSync } from 'node:zlib';
import { describe, expect, it } from 'vitest';
import type { TreeNode } from '../../vault/index.js';
import { GLYPH, rowCounts, slugName } from '../names.js';
import type { DocInfo } from '../store.js';
import { afterDelete, followMove, keyPlace, revealRows, treeKey, treeRows, typeahead, type TreeRow } from '../treeModel.js';

const TREE: TreeNode[] = [
  { kind: 'folder', name: 'courses', path: 'courses', children: [
    { kind: 'doc', name: 'qm.md', path: 'courses/qm.md', children: [
      { kind: 'doc', name: 'pt.md', path: 'courses/qm/pt.md' },
      { kind: 'doc', name: 'wkb.md', path: 'courses/qm/wkb.md' },
      { kind: 'folder', name: 'sets', path: 'courses/qm/sets', children: [] },
    ] },
    { kind: 'doc', name: 'arabic.md', path: 'courses/arabic.md' },
  ] },
  { kind: 'folder', name: 'empty', path: 'empty', children: [] },
  { kind: 'doc', name: 'notes.md', path: 'notes.md' },
];
const OPEN = { '': true, courses: true, 'courses/qm.md': true } as Record<string, true>;
const rows = (open = OPEN, order = {}, hoist?: string) => treeRows(TREE, open, order, hoist);
const show = (rs: TreeRow[]) => rs.map((r) => `${'  '.repeat(r.depth)}${r.placeholder ? '(empty)' : r.path || '/'}${r.has ? (r.open ? ' ▾' : ' ▸') : ''}`);

describe('rows', () => {
  it('draws the root, then each open row\'s children in their order, depth first', () => {
    expect(show(rows(OPEN, { courses: ['arabic.md', 'qm.md'] }))).toEqual([
      '/ ▾', '  courses ▾', '    courses/arabic.md', '    courses/qm.md ▾', '      courses/qm/pt.md', '      courses/qm/wkb.md', '      courses/qm/sets ▸', '  empty ▸', '  notes.md',
    ]);
  });

  it('an open empty folder shows one placeholder row under it, its parent\'s path, taking only into', () => {
    const rs = rows({ ...OPEN, empty: true });
    const ph = rs.find((r) => r.placeholder)!;
    expect(ph).toMatchObject({ path: 'empty', depth: 2, nest: 'only', parent: 'empty' });
    expect(show(rs).slice(-3)).toEqual(['  empty ▾', '    (empty)', '  notes.md']);
  });

  it('a hoisted row is the top of the tree, open, with only what is under it', () => {
    expect(show(rows({ '': true }, {}, 'courses/qm.md'))).toEqual(['courses/qm.md ▾', '  courses/qm/pt.md', '  courses/qm/wkb.md', '  courses/qm/sets ▸']);
    expect(rows({}, {}, 'courses/qm.md')[0]).toMatchObject({ nest: 'only', parent: null });
  });

  it('a bare document nests only after a rest; a folder or a document with children at once', () => {
    const by = Object.fromEntries(rows().map((r) => [r.path, r.nest]));
    expect([by['courses'], by['courses/qm.md'], by['courses/qm/pt.md'], by['']]).toEqual(['now', 'now', 'dwell', 'only']);
  });

  it('reveal opens the root and every folder or document above a path, outermost first', () => {
    expect(revealRows(TREE, 'courses/qm/pt.md')).toEqual(['', 'courses', 'courses/qm.md']);
    expect(revealRows(TREE, 'notes.md')).toEqual(['']);
  });
});

describe('keys', () => {
  const rs = rows();
  const k = (focus: string | null, key: string, mods: Record<string, boolean> = {}) => treeKey(rs, focus, { key, ...mods });

  it('↑ ↓ Home End move through the drawn rows', () => {
    expect(k('courses/qm.md', 'ArrowDown')).toEqual({ kind: 'focus', path: 'courses/qm/pt.md' });
    expect(k('courses/qm.md', 'ArrowUp')).toEqual({ kind: 'focus', path: 'courses' });
    expect(k('notes.md', 'ArrowDown')).toEqual({ kind: 'focus', path: 'notes.md' });
    expect(k(null, 'ArrowDown')).toEqual({ kind: 'focus', path: '' });
    expect(k('courses', 'End')).toEqual({ kind: 'focus', path: 'notes.md' });
    expect(k('courses', 'Home')).toEqual({ kind: 'focus', path: '' });
  });

  it('→ opens a closed row, then goes to its first child; ← closes, then goes to the parent', () => {
    expect(k('courses/qm/sets', 'ArrowRight')).toEqual({ kind: 'fold', path: 'courses/qm/sets', open: true });
    expect(k('courses/qm.md', 'ArrowRight')).toEqual({ kind: 'focus', path: 'courses/qm/pt.md' });
    expect(k('courses/qm/pt.md', 'ArrowRight')).toBeNull();
    expect(k('courses/qm.md', 'ArrowLeft')).toEqual({ kind: 'fold', path: 'courses/qm.md', open: false });
    expect(k('courses/qm/pt.md', 'ArrowLeft')).toEqual({ kind: 'focus', path: 'courses/qm.md' });
    expect(k('courses', 'ArrowLeft')).toEqual({ kind: 'fold', path: 'courses', open: false });
    expect(k('notes.md', 'ArrowLeft')).toEqual({ kind: 'focus', path: '' });
  });

  it('⏎ opens, F2 renames, ⌘⌫ deletes; the root neither renames nor deletes', () => {
    expect(k('notes.md', 'Enter')).toEqual({ kind: 'activate', path: 'notes.md' });
    expect(k('notes.md', 'F2')).toEqual({ kind: 'rename', path: 'notes.md' });
    expect(k('notes.md', 'Backspace', { metaKey: true })).toEqual({ kind: 'delete', path: 'notes.md' });
    expect(k('', 'F2')).toBeNull();
    expect(k('', 'Backspace', { metaKey: true })).toBeNull();
    // a bare Backspace is not a delete
    expect(k('notes.md', 'Backspace')).toBeNull();
  });

  it('⌥⌘ arrows move the row; a letter types ahead; other chords are not the tree\'s', () => {
    expect(k('courses/qm/wkb.md', 'ArrowUp', { metaKey: true, altKey: true })).toEqual({ kind: 'move', path: 'courses/qm/wkb.md', to: 'up' });
    expect(k('courses/qm/wkb.md', 'ArrowLeft', { metaKey: true, altKey: true })).toEqual({ kind: 'move', path: 'courses/qm/wkb.md', to: 'out' });
    expect(k('', 'ArrowUp', { metaKey: true, altKey: true })).toBeNull();
    expect(k('courses', 'w')).toEqual({ kind: 'type', char: 'w' });
    expect(k('courses', 'w', { metaKey: true })).toBeNull();
    expect(k('courses', 'ArrowDown', { altKey: true })).toBeNull();
    expect(k('courses', 'Tab')).toBeNull();
  });
});

describe('type-ahead', () => {
  const rs = rows();
  const name = (p: string) => ({ '': 'collection', courses: 'courses', 'courses/qm.md': 'quantum II', 'courses/qm/pt.md': 'perturbation', 'courses/qm/wkb.md': 'WKB', 'courses/qm/sets': 'problem sets', 'courses/arabic.md': 'ʿarabī', empty: 'empty', 'notes.md': 'notes' } as Record<string, string>)[p] ?? p;

  it('jumps to the next name starting with the letter, wrapping, ignoring case and marks', () => {
    expect(typeahead(rs, '', 'w', name)).toBe('courses/qm/wkb.md');
    expect(typeahead(rs, 'courses/qm/pt.md', 'p', name)).toBe('courses/qm/sets');
    expect(typeahead(rs, 'courses/qm/sets', 'p', name)).toBe('courses/qm/pt.md');
    expect(typeahead(rs, '', 'a', name)).toBe('courses/arabic.md');
    expect(typeahead(rs, '', 'z', name)).toBeNull();
  });

  it('a word typed quickly stays on a row that still matches; a run of one letter steps', () => {
    expect(typeahead(rs, 'courses/qm/pt.md', 'pr', name)).toBe('courses/qm/sets');
    expect(typeahead(rs, 'courses/qm/pt.md', 'pe', name)).toBe('courses/qm/pt.md');
    expect(typeahead(rs, 'courses/qm/pt.md', 'pp', name)).toBe('courses/qm/sets');
  });
});

describe('keyboard moves', () => {
  const rs = rows();
  it('up before the sibling above, down after the one below, none past the ends', () => {
    expect(keyPlace(rs, 'courses/qm/wkb.md', 'up')).toEqual({ target: 'courses/qm/pt.md', mode: 'before' });
    expect(keyPlace(rs, 'courses/qm/wkb.md', 'down')).toEqual({ target: 'courses/qm/sets', mode: 'after' });
    expect(keyPlace(rs, 'courses/qm/pt.md', 'up')).toBeNull();
    expect(keyPlace(rs, 'courses/qm/sets', 'down')).toBeNull();
  });

  it('out after its parent, never beside the root; in into the sibling above', () => {
    expect(keyPlace(rs, 'courses/qm/wkb.md', 'out')).toEqual({ target: 'courses/qm.md', mode: 'after' });
    expect(keyPlace(rs, 'courses', 'out')).toBeNull();
    expect(keyPlace(rs, 'courses/qm/wkb.md', 'in')).toEqual({ target: 'courses/qm/pt.md', mode: 'into' });
    expect(keyPlace(rs, 'courses/qm/pt.md', 'in')).toBeNull();
    expect(keyPlace(rs, 'notes.md', 'in')).toEqual({ target: 'empty', mode: 'into' });
  });

  it('a hoisted top row has no outside to move to', () => {
    const h = rows({ '': true }, {}, 'courses/qm.md');
    expect(keyPlace(h, 'courses/qm/pt.md', 'out')).toBeNull();
  });
});

describe('names on a row', () => {
  it('a slug reads as a name; a date stays a date; the file is not touched', () => {
    expect(slugName('unit-2')).toBe('unit 2');
    expect(slugName('ch-3_the-canonical-ensemble')).toBe('ch 3 the canonical ensemble');
    expect(slugName('phys-412-quantum-ii')).toBe('phys 412 quantum ii');
    expect(slugName('2026-10-30')).toBe('2026-10-30');
    expect(slugName('idea for honors thesis')).toBe('idea for honors thesis');
    expect(slugName('---')).toBe('---');
  });

  it('one due number (cards due, and a reading or writing pass due today), the full counts behind it', () => {
    const now = new Date('2026-10-30T12:00:00');
    const doc = (path: string, children?: TreeNode[]): TreeNode => ({ kind: 'doc', name: path, path, ...(children ? { children } : {}) });
    const info = (extra: Partial<DocInfo>): DocInfo => ({ type: 'note', frozen: false, cards: 0, due: 0, ...extra });
    expect(rowCounts(doc('a.md'), info({ type: 'deck', cards: 120, due: 14 }), now)).toEqual({ due: 14, full: '120 cards, 14 due' });
    expect(rowCounts(doc('a.md'), info({ type: 'deck', cards: 120 }), now)).toEqual({ due: 0, full: '120 cards' });
    expect(rowCounts(doc('a.md'), info({ cards: 3, due: 1, read: { due: '2026-10-29', ivl: 2, reps: 1 } }), now)).toEqual({ due: 2, full: '3 cards, 1 due; revisit due' });
    expect(rowCounts(doc('a.md'), info({ type: 'source', read: { due: '2026-11-04', ivl: 6, reps: 2, pos: 3 } }), now)).toEqual({ due: 0, full: '' });
    expect(rowCounts(doc('a.md'), info({ type: 'draft', write: { due: '2026-10-30' } }), now)).toEqual({ due: 1, full: 'writing due' });
    expect(rowCounts(doc('a.md', [doc('a/b.md'), doc('a/c.md')]), info({}), now)).toEqual({ due: 0, full: '2 items' });
    expect(rowCounts({ kind: 'folder', name: 'f', path: 'f', children: [] }, undefined, now)).toEqual({ due: 0, full: 'empty' });
  });
});

/** The code points a WOFF (1.0) font maps, from its `cmap` (formats 4 and 12). */
function cmapOf(file: string): Set<number> {
  const b = readFileSync(file);
  let cmap: Buffer | undefined;
  for (let i = 0; i < b.readUInt16BE(12); i++) {
    const o = 44 + i * 20;
    if (b.toString('latin1', o, o + 4) !== 'cmap') continue;
    const off = b.readUInt32BE(o + 4);
    const comp = b.readUInt32BE(o + 8);
    const raw = b.subarray(off, off + comp);
    cmap = comp === b.readUInt32BE(o + 12) ? raw : inflateSync(raw);
  }
  const out = new Set<number>();
  if (!cmap) return out;
  for (let i = 0; i < cmap.readUInt16BE(2); i++) {
    const so = cmap.readUInt32BE(4 + i * 8 + 4);
    const fmt = cmap.readUInt16BE(so);
    if (fmt === 4) {
      const seg = cmap.readUInt16BE(so + 6) / 2;
      for (let s = 0; s < seg; s++) {
        const end = cmap.readUInt16BE(so + 14 + s * 2);
        const start = cmap.readUInt16BE(so + 16 + seg * 2 + s * 2);
        for (let c = start; c <= end && c !== 0xffff; c++) out.add(c);
      }
    } else if (fmt === 12) {
      for (let g = 0; g < cmap.readUInt32BE(so + 12); g++) {
        for (let c = cmap.readUInt32BE(so + 16 + g * 12); c <= cmap.readUInt32BE(so + 20 + g * 12); c++) out.add(c);
      }
    }
  }
  return out;
}

describe('the kinds\' marks', () => {
  it('are six different marks, each drawn by the bundled IBM Plex Mono (no system fallback at 13px)', () => {
    const kinds = ['folder', 'note', 'source', 'extract', 'deck', 'draft'] as const;
    const marks = kinds.map((k) => GLYPH[k]);
    expect(new Set(marks).size).toBe(6);
    const face = cmapOf(join(import.meta.dirname, '../../../node_modules/@fontsource/ibm-plex-mono/files/ibm-plex-mono-latin-400-normal.woff'));
    expect(face.size).toBeGreaterThan(100);
    expect(marks.filter((m) => !face.has(m.codePointAt(0)!))).toEqual([]);
  });
});

describe('the selection after a delete or a move', () => {
  const tree: TreeNode[] = [
    { kind: 'doc', name: 'd.md', path: 'd.md' },
    { kind: 'doc', name: 'n.md', path: 'n.md' },
  ];
  const rows = treeRows(tree, { '': true, 'd.md': true }, {}, undefined, (doc) => (doc === 'd.md' ? [{ block: 0, text: 'q' }, { block: 1, text: 'r' }] : []));

  it('a deleted document\'s cards go with it: the next row is past them', () => {
    expect(rows.map((r) => r.path)).toEqual(['', 'd.md', ':cards/d.md#0', ':cards/d.md#1', 'n.md']);
    expect(afterDelete(rows, 'd.md')).toBe('n.md');
    expect(afterDelete(rows, 'n.md')).toBe(':cards/d.md#1');
  });

  it('the selection follows a node moved or renamed, anything under it, and their cards\' rows', () => {
    expect(followMove('a/b.md', 'a/b.md', 'c/b.md')).toBe('c/b.md');
    expect(followMove('a/b/x.md', 'a/b.md', 'c/b.md')).toBe('c/b/x.md');
    expect(followMove(':cards/a/b.md#3', 'a/b.md', 'c/b.md')).toBe(':cards/c/b.md#3');
    expect(followMove(':cards/a/b/x.md', 'a/b.md', 'c/b.md')).toBe(':cards/c/b/x.md');
    expect(followMove('a/bb.md', 'a/b.md', 'c/b.md')).toBe('a/bb.md');
    expect(followMove(null, 'a/b.md', 'c/b.md')).toBeNull();
  });
});
