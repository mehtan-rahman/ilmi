import { describe, expect, it } from 'vitest';
import { intoView } from '../viewport.js';

describe('a thing placed at a selection is moved into what can be seen', () => {
  const W = 402;
  const BOTTOM = 546;
  it('is left where it is when it fits', () => {
    expect(intoView({ left: 40, top: 100, right: 300, bottom: 140 }, W, BOTTOM)).toEqual({ dx: 0, dy: 0 });
  });
  it('comes back from past the right edge, and from the left of the page', () => {
    // the selection cue at the end of a line on a phone
    expect(intoView({ left: 240, top: 382, right: 541, bottom: 416 }, W, BOTTOM)).toEqual({ dx: -145, dy: 0 });
    expect(intoView({ left: -38, top: 100, right: 200, bottom: 300 }, W, BOTTOM)).toEqual({ dx: 44, dy: 0 });
  });
  it('comes up from under the keyboard', () => {
    expect(intoView({ left: 20, top: 500, right: 280, bottom: 820 }, W, BOTTOM)).toEqual({ dx: 0, dy: -280 });
  });
  it('wider or taller than the view, it starts at the left and the top', () => {
    expect(intoView({ left: 100, top: 300, right: 600, bottom: 900 }, W, BOTTOM)).toEqual({ dx: -94, dy: -294 });
  });
});
