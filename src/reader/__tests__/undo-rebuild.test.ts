// The page built again from its file with its history kept (`rebuild.ts`):
// the document replaced over the least that changed, ⌘Z still taking back
// what was typed before, and what a fresh state sets anew set the same.

import { promises as fsp } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { redo, undo, undoDepth } from 'prosemirror-history';
import { NodeSelection, TextSelection, type EditorState, type Transaction } from 'prosemirror-state';
import { describe, expect, it } from 'vitest';
import { parse, serialize, type Block } from '../../format/index.js';
import {
  fileKey, findKey, foldKey, foldedKeys, fromDoc, makeState, markerPos, mathEditKey, refit, replaceDoc, schedulesKept, toDoc, type FindMeta,
} from '../index.js';

const CORPUS = join(dirname(fileURLToPath(import.meta.url)), '../../format/__tests__/corpus/vault');
const live = { frozen: () => false, pos: null };
const ed = (md: string): EditorState => makeState(parse(md).doc.blocks, live);
const md = (state: EditorState): string => { const d = parse('').doc; d.blocks = fromDoc(state.doc); return serialize(d); };
/** The file as the editor would write it, read back. */
const readBack = (state: EditorState): Block[] => parse(md(state)).doc.blocks;
/** One thing done, a second apart from the last (its own group in the history). */
let clock = 1_000_000;
const act = (state: EditorState, make: (tr: Transaction) => Transaction): EditorState => state.apply(make(state.tr).setTime((clock += 1000)));
const typeAt = (state: EditorState, text: string, pos: number): EditorState => act(state, (tr) => tr.insertText(text, pos).setSelection(TextSelection.create(tr.doc, pos + text.length)));
/** The page built again from `blocks`, a moment after the last thing done. */
const rebuilt = (state: EditorState, blocks: Block[], undoable: boolean): EditorState => {
  const tr = refit(state, toDoc(blocks), { undoable, pos: null });
  expect(tr).not.toBeNull();
  return state.apply(tr!.setTime((clock += 600)));
};
const run = (state: EditorState, cmd: typeof undo): EditorState => {
  let next = state;
  expect(cmd(state, (tr) => { next = state.apply(tr); })).toBe(true);
  return next;
};
const endOf = (state: EditorState, i: number): number => {
  let at = 0;
  for (let k = 0; k <= i; k++) at += state.doc.child(k).nodeSize;
  return at - 1;
};

describe('the least of a document replaced', () => {
  it('the same document: no step', () => {
    const s = ed('one\n\ntwo\n');
    const tr = replaceDoc(s, toDoc(parse('one\n\ntwo\n').doc.blocks));
    expect(tr?.docChanged).toBe(false);
  });

  it('a word in a paragraph: one step inside it, the positions before it where they were', () => {
    const s = ed('one\n\ntwo words here\n\nthree\n');
    const tr = replaceDoc(s, toDoc(parse('one\n\ntwo other words here\n\nthree\n').doc.blocks))!;
    expect(tr.steps).toHaveLength(1);
    expect(md(s.apply(tr))).toBe('one\n\ntwo other words here\n\nthree\n');
    const map = tr.mapping;
    expect(map.map(3)).toBe(3);
    expect(map.map(5 + 'two '.length)).toBe(5 + 'two '.length);
    expect(map.map(endOf(s, 2))).toBe(endOf(s, 2) + 'other '.length);
  });

  it('a repeat at the seam, a block gone, a block made, a line that became a card', () => {
    for (const [a, b] of [
      ['aa\n', 'aaa\n'], ['aaa\n', 'aa\n'], ['x\n\nx\n', 'x\n\nx\n\nx\n'], ['x\n\nx\n\nx\n', 'x\n'],
      ['one\n\ntwo\n\nthree\n', 'one\n\nthree\n'], ['one\n\nthree\n', 'one\n\ntwo\n\nthree\n'],
      ['one\n\nword :: def\n\nthree\n', 'one\n\nword\n\nthree\n'], ['# h\n\ntext\n', 'text\n\n# h\n'],
      ['- a\n- b\n', '- a\n- b :: c\n'], ['so $x$ here\n', 'so $x+1$ here and $y$\n'], ['', 'a\n'], ['a\n', ''],
    ] as const) {
      const s = ed(a);
      const want = toDoc(parse(b).doc.blocks);
      const tr = replaceDoc(s, want);
      expect(tr, `${JSON.stringify(a)} → ${JSON.stringify(b)}`).not.toBeNull();
      expect(tr!.doc.eq(want)).toBe(true);
    }
  });

  it('every corpus file into every other, exactly', async () => {
    const files: string[] = [];
    const walk = async (dir: string): Promise<void> => {
      for (const e of await fsp.readdir(dir, { withFileTypes: true })) {
        if (e.isDirectory()) await walk(join(dir, e.name));
        else if (e.name.endsWith('.md')) files.push(join(dir, e.name));
      }
    };
    await walk(CORPUS);
    const docs = (await Promise.all(files.slice(0, 14).map((f) => fsp.readFile(f, 'utf8')))).map((t) => parse(t).doc.blocks);
    expect(docs.length).toBeGreaterThan(3);
    for (const a of docs) {
      const s = makeState(a, live);
      for (const b of docs) {
        const want = toDoc(b);
        const tr = replaceDoc(s, want);
        expect(tr && tr.doc.eq(want)).toBe(true);
      }
    }
  });
});

describe('⌘Z over a page built again from its own write', () => {
  it('a line typed that the file reads back as a card: undone with its typing, then the typing before it, and done again', () => {
    let s = ed('one\n\n\\\n\nthree\n');
    s = typeAt(s, ' more', endOf(s, 0));
    // the second block's `\` typed over: a line that is a card once read back
    s = act(s, (tr) => tr.insertText('word :: def', endOf(s, 1) - 1, endOf(s, 1)));
    expect(s.doc.child(1).type.name).toBe('paragraph');
    const typed = s;
    s = rebuilt(s, readBack(s), true);
    expect(s.doc.child(1).type.name).toBe('card');
    expect(md(s)).toBe(md(typed));
    // one ⌘Z: the card and the line's typing, as one thing done
    s = run(s, undo);
    expect(md(s)).toBe('one more\n\n\\\n\nthree\n');
    s = run(s, undo);
    expect(md(s)).toBe('one\n\n\\\n\nthree\n');
    expect(undoDepth(s)).toBe(0);
    s = run(run(s, redo), redo);
    expect(s.doc.child(1).type.name).toBe('card');
    expect(md(s)).toBe(md(typed));
  });

  it('the rebuild marks itself as the file\'s, and passes a frozen page', () => {
    let frozen = false;
    let s = makeState(parse('one\n\ntwo\n').doc.blocks, { frozen: () => frozen, pos: null });
    frozen = true;
    const tr = refit(s, toDoc(parse('one\n\ntwo :: card\n').doc.blocks), { undoable: false, pos: null })!;
    expect(tr.getMeta(fileKey)).toBe(true);
    s = s.apply(tr);
    expect(s.doc.child(1).type.name).toBe('card');
  });

  it('not undoable: the change stays, and ⌘Z takes back what was typed before it', () => {
    let s = ed('one\n\ntwo\n\nthree\n');
    s = typeAt(s, ' first', endOf(s, 0));
    s = typeAt(s, ' last', endOf(s, 2));
    // the file's own change in between (an extract taken from the second block)
    const blocks = fromDoc(s.doc);
    blocks[1] = { kind: 'paragraph', text: 'two', extracts: ['two'] };
    blocks.splice(1, 0, { kind: 'paragraph', text: 'put in by the file' });
    s = rebuilt(s, blocks, false);
    expect(undoDepth(s)).toBe(2);
    s = run(s, undo);
    expect(fromDoc(s.doc).map((b) => b.text)).toEqual(['one first', 'put in by the file', 'two', 'three']);
    s = run(s, undo);
    expect(fromDoc(s.doc).map((b) => b.text)).toEqual(['one', 'put in by the file', 'two', 'three']);
    expect((fromDoc(s.doc)[2] as { extracts?: string[] }).extracts).toEqual(['two']);
    s = run(s, redo);
    expect(fromDoc(s.doc).map((b) => b.text)).toEqual(['one first', 'put in by the file', 'two', 'three']);
  });

  it('after ⌘Z the card made again is not undoable: the next ⌘Z goes on back, never round again', () => {
    let s = ed('one\n\n\\\n');
    s = typeAt(s, ' more', endOf(s, 0));
    s = act(s, (tr) => tr.insertText('word :: def', endOf(s, 1) - 1, endOf(s, 1)));
    // no pause before the next thing done elsewhere: the line is still a paragraph when both are written
    s = typeAt(s, '!', endOf(s, 0));
    s = rebuilt(s, readBack(s), true);
    expect(s.doc.child(1).type.name).toBe('card');
    // ⌘Z: the `!` and the card with it; the line is `word :: def` again, written, and read back as a card
    s = run(s, undo);
    expect(md(s)).toBe('one more\n\nword :: def\n');
    expect(s.doc.child(1).type.name).toBe('paragraph');
    s = rebuilt(s, readBack(s), false);
    expect(s.doc.child(1).type.name).toBe('card');
    // each ⌘Z from here goes back (the line's own typing is under the card and stays); none makes the paragraph again
    const seen: string[] = [];
    while (undoDepth(s) > 0) { s = run(s, undo); seen.push(md(s)); }
    expect(seen.length).toBeLessThanOrEqual(2);
    expect(seen[seen.length - 1]).toBe('one\n\nword :: def\n');
    expect(s.doc.child(1).type.name).toBe('card');
  });
});

describe('what a fresh state sets, set by the rebuild', () => {
  it('the marker, the folds, an open find bar found again, an open formula closed', () => {
    const src = '# a\n\nfind me\n\n# b\n\nand here $x$\n';
    let s = makeState(parse(src).doc.blocks, { frozen: () => false, pos: 1, folds: [] });
    s = s.apply(s.tr.setMeta(findKey, { query: 'find me' } satisfies FindMeta));
    let chip = -1;
    s.doc.descendants((n, p) => { if (n.type.name === 'math') chip = p; });
    s = s.apply(s.tr.setMeta(mathEditKey, chip));
    expect(findKey.getState(s)?.matches).toHaveLength(1);
    const next = parse(src.replace('find me\n\n# b', 'find me, and find me\n\n# b')).doc.blocks;
    const fresh = makeState(next, { frozen: () => false, pos: 2, folds: [] });
    const keys = foldedKeys(fresh.apply(fresh.tr.setMeta(foldKey, { toggle: fresh.doc.child(0).nodeSize + fresh.doc.child(1).nodeSize })));
    expect(keys).toHaveLength(1);
    s = s.apply(refit(s, toDoc(next), { undoable: false, pos: 2, folds: keys, select: (d) => TextSelection.create(d, endOf(fresh, 1)) })!);
    expect(markerPos(s)).toBe(2);
    expect(foldedKeys(s)).toEqual(keys);
    expect(findKey.getState(s)?.open).toBe(true);
    expect(findKey.getState(s)?.matches).toHaveLength(2);
    expect(mathEditKey.getState(s)).toBeNull();
    expect(s.selection.head).toBe(endOf(fresh, 1));
  });

  it('the same document: nothing changed but the marker, a selection of several blocks kept', () => {
    let s = makeState(parse('one\n\ntwo :: card\n\nthree\n').doc.blocks, { frozen: () => false, pos: 0 });
    s = typeAt(s, '!', endOf(s, 0));
    s = s.apply(s.tr.setSelection(NodeSelection.create(s.doc, s.doc.child(0).nodeSize)));
    const tr = refit(s, toDoc(fromDoc(s.doc)), { undoable: false, pos: 2, select: () => { throw new Error('not asked'); } })!;
    expect(tr.docChanged).toBe(false);
    const next = s.apply(tr);
    expect(next.selection.eq(s.selection)).toBe(true);
    expect(markerPos(next)).toBe(2);
    expect(undoDepth(next)).toBe(1);
  });
});

describe('the schedules a change left as they were', () => {
  const card = (sched?: object): Block => ({ kind: 'card', text: 'a :: b', id: 'c1', ...(sched ? { sched } : {}) }) as Block;
  it('text changed, blocks made, a passage marked as taken: kept', () => {
    const old: Block[] = [{ kind: 'paragraph', text: 'p' }, card({ due: '2026-01-01', reps: 2 }), { kind: 'heading', level: 2, text: 'h', read: { due: '2026-02-01' } }];
    expect(schedulesKept(old, [{ kind: 'paragraph', text: 'p', extracts: ['p'] }, { kind: 'card', text: 'new :: one' }, ...old.slice(1)])).toBe(true);
    // key order aside
    expect(schedulesKept(old, [old[0]!, card({ reps: 2, due: '2026-01-01' }), old[2]!])).toBe(true);
  });
  it('a card graded (even its first time), a section passed or enrolled: not kept', () => {
    const h = (read?: object): Block => ({ kind: 'heading', level: 2, text: 'h', ...(read ? { read } : {}) }) as Block;
    expect(schedulesKept([card({ due: '2026-01-01' })], [card({ due: '2026-01-09' })])).toBe(false);
    expect(schedulesKept([card()], [card({ due: '2026-01-09' })])).toBe(false);
    expect(schedulesKept([h({ due: '2026-01-01' })], [h({ due: '2026-03-01' })])).toBe(false);
    expect(schedulesKept([h()], [h({ due: '2026-03-01' })])).toBe(false);
  });
});
