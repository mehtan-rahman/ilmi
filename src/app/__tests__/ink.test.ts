// Ink (milestones 58, 69, 82), the pure side: the drawing an image names,
// where a picture lies, what a keep leaves after a merge, an area's
// decorations; `draw` nowhere, and nothing left that opened a new area at
// the Pencil's touch. The canvases are an iPad's (`ILMI_SMOKE=ink`).

import { EditorState } from 'prosemirror-state';
import { describe, expect, it } from 'vitest';
import { inkAreas, inkKey, inkLineSrc, inkLines } from '../../reader/inkArea.js';
import { schema } from '../../reader/schema.js';
import { slashItems } from '../../reader/slash.js';
import type { InkStroke } from '../../vault/index.js';
import * as inkApi from '../ink.js';
import * as areaApi from '../../reader/inkArea.js';
import { cropOf, mergeStrokes, pageOf } from '../ink.js';

describe('a page of ink in a note', () => {
  it('is found from the line the note has for it', () => {
    expect(pageOf('library/book/ch-3.md', 'ch-3/ink-01.png')).toBe('library/book/ch-3/ink-01.pkdrawing');
    expect(pageOf('fleeting/office hours.md', 'office%20hours/ink-02.png')).toBe('fleeting/office hours/ink-02.pkdrawing');
    expect(pageOf('a.md', 'https://example.com/x.png')).toBeNull();
    expect(pageOf('a.md', 'a/figure.jpg')).toBeNull();
  });

  it('is not made by the Pencil\'s touch on a typed note: nothing names a new page, writes its line or finds a place for it', () => {
    for (const gone of ['nextPage', 'inkLine', 'inkSrc', 'nearestEdge', 'filesDir']) expect(gone in inkApi).toBe(false);
    expect('InkGap' in areaApi).toBe(false);
  });
});

const stroke = (name: string, at: number): InkStroke => ({ stroke: name, at, data: name });

describe('what is written', () => {
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

  it('holds its height and lays its picture where it was written, and no gap is held open for a new one', () => {
    const boxes = new Map([['note/ink-01.png', { height: 240, left: 30, top: 12, width: 300, live: true }]]);
    let state = EditorState.create({ doc: doc('one', line, 'two'), plugins: [inkAreas(() => boxes)] });
    const decos = inkKey.getState(state)!.decos.find();
    expect(decos.length).toBe(1);
    const attrs = (decos[0] as unknown as { type: { attrs: Record<string, string> } }).type.attrs;
    expect(attrs.class).toBe('ink-area ink-live');
    expect(attrs.style).toContain('height:240px');
    expect(attrs.style).toContain('--ink-l:30px');
    // the area goes with the text typed above it, and is said anew when asked
    state = state.apply(state.tr.insertText('xx', 1));
    expect(inkKey.getState(state)!.decos.find().map((d) => d.from)).toEqual([7]);
    boxes.set('note/ink-01.png', { height: 400, left: 30, top: 12, width: 300, live: false });
    state = state.apply(state.tr.setMeta(inkKey, 'redraw'));
    const again = (inkKey.getState(state)!.decos.find()[0] as unknown as { type: { attrs: Record<string, string> } }).type.attrs;
    expect(again.class).toBe('ink-area');
    expect(again.style).toContain('height:400px');
    // what opened a gap before milestone 82 opens nothing
    state = state.apply(state.tr.setMeta(inkKey, { gap: { id: 'new:1', pos: 1, height: 180 } }));
    expect(inkKey.getState(state)!.decos.find().length).toBe(1);
    expect('gap' in inkKey.getState(state)!).toBe(false);
  });
});
