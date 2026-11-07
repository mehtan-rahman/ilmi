// Ink (milestones 58, 69), the pure side: a page's name among a note's
// files, the line the note gets, the drawing an image names, the place a new
// area opens, where a picture lies, what a keep leaves after a merge, an
// area's decorations; and `draw` nowhere. The canvases are an iPad's
// (`ILMI_SMOKE=ink`).

import { EditorState } from 'prosemirror-state';
import { describe, expect, it } from 'vitest';
import { inkAreas, inkKey, inkLineSrc, inkLines } from '../../reader/inkArea.js';
import { schema } from '../../reader/schema.js';
import { slashItems } from '../../reader/slash.js';
import type { InkStroke } from '../../vault/index.js';
import { cropOf, inkLine, inkSrc, mergeStrokes, nearestEdge, nextPage, pageOf } from '../ink.js';

describe('a page of ink in a note', () => {
  it('is named one past the pages there are', () => {
    expect(nextPage([])).toBe('ink-01');
    expect(nextPage(['img-01.png', 'notes.md'])).toBe('ink-01');
    expect(nextPage(['ink-01.pkdrawing', 'ink-01.png'])).toBe('ink-02');
    // a page thrown away leaves its number: the next is past the highest, whichever file is left of it
    expect(nextPage(['ink-01.png', 'ink-07.pkdrawing'])).toBe('ink-08');
    expect(nextPage(['ink-99.png'])).toBe('ink-100');
  });

  it('is written as an image through the directory of the note\'s name', () => {
    expect(inkSrc('library/book/ch-3.md', 'ink-01')).toBe('ch-3/ink-01.png');
    expect(inkLine('fleeting/office hours.md', 'ink-02')).toBe('![working](office%20hours/ink-02.png)');
    // and the drawing is found again from what the note wrote
    expect(pageOf('library/book/ch-3.md', 'ch-3/ink-01.png')).toBe('library/book/ch-3/ink-01.pkdrawing');
    expect(pageOf('fleeting/office hours.md', 'office%20hours/ink-02.png')).toBe('fleeting/office hours/ink-02.pkdrawing');
    expect(pageOf('a.md', 'https://example.com/x.png')).toBeNull();
    expect(pageOf('a.md', 'a/figure.jpg')).toBeNull();
  });
});

const stroke = (name: string, at: number): InkStroke => ({ stroke: name, at, data: name });

describe('where the Pencil lands', () => {
  it('opens at the place between two blocks nearest it', () => {
    const edges = [100, 240, 300, 520];
    expect(nearestEdge(edges, 90)).toBe(0);
    expect(nearestEdge(edges, 180)).toBe(1);
    expect(nearestEdge(edges, 268)).toBe(1);
    expect(nearestEdge(edges, 275)).toBe(2);
    // under the last block: its foot
    expect(nearestEdge(edges, 2000)).toBe(3);
  });

  it('knows where a picture cut to its strokes lies', () => {
    // 12 points round them, in whole points, as the picture is cut
    expect(cropOf([40.5, 60.25, 100, 50])).toEqual({ x: 28, y: 48, w: 125, h: 75 });
  });

  it('keeps what the canvas made and dropped, and what a merge brought in meanwhile', () => {
    const had = [stroke('a', 1), stroke('b', 2), stroke('merged', 3)];
    const base = new Set(['a', 'b']);
    // the canvas erased `b` and wrote `c`; it never saw `merged`
    expect(mergeStrokes(had, base, [stroke('a', 1), stroke('c', 4)]).map((s) => s.stroke)).toEqual(['a', 'merged', 'c']);
    // every stroke it knew erased: what it never knew stays
    expect(mergeStrokes(had, base, []).map((s) => s.stroke)).toEqual(['merged']);
  });
});

describe('draw', () => {
  it('is nowhere in the insert menu', () => {
    expect(slashItems('', 'paragraph').some((i) => (i.id as string) === 'draw')).toBe(false);
    expect(slashItems('draw', 'paragraph')).toEqual([]);
    expect(slashItems('ink', 'heading')).toEqual([]);
  });
});

describe('an ink area in the flow', () => {
  const doc = (...texts: string[]) => schema.node('doc', null, texts.map((t) => schema.node('paragraph', null, t ? [schema.text(t)] : [])));
  const line = '![working](note/ink-01.png)';

  it('is a paragraph that is only a page of ink\'s line', () => {
    expect(inkLineSrc(line)).toBe('note/ink-01.png');
    expect(inkLineSrc(`see ${line}`)).toBeNull();
    expect(inkLineSrc('![figure](note/plot.png)')).toBeNull();
    expect(inkLines(doc('one', line, 'two')).map((l) => [l.src, l.pos])).toEqual([['note/ink-01.png', 5]]);
  });

  it('holds its height and lays its picture where it was written, and a gap goes with the text around it', () => {
    const boxes = new Map([['note/ink-01.png', { height: 240, left: 30, top: 12, width: 300, live: true }]]);
    let state = EditorState.create({ doc: doc('one', line, 'two'), plugins: [inkAreas(() => boxes)] });
    const decos = inkKey.getState(state)!.decos.find();
    expect(decos.length).toBe(1);
    const attrs = (decos[0] as unknown as { type: { attrs: Record<string, string> } }).type.attrs;
    expect(attrs.class).toBe('ink-area ink-live');
    expect(attrs.style).toContain('height:240px');
    expect(attrs.style).toContain('--ink-l:30px');
    // a gap held open before the last block: text typed above it moves it
    state = state.apply(state.tr.setMeta(inkKey, { gap: { id: 'new:1', pos: state.doc.content.size - 5, height: 180 } }));
    const pos = inkKey.getState(state)!.gap!.pos;
    state = state.apply(state.tr.insertText('xx', 1));
    expect(inkKey.getState(state)!.gap!.pos).toBe(pos + 2);
    expect(inkKey.getState(state)!.decos.find().length).toBe(2);
    state = state.apply(state.tr.setMeta(inkKey, { gap: null }));
    expect(inkKey.getState(state)!.gap).toBeNull();
    expect(inkKey.getState(state)!.decos.find().length).toBe(1);
  });
});
