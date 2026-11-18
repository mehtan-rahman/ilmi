// @vitest-environment jsdom
// What is written on a PDF's page, drawn by the page itself (milestone 89, `pageInk.ts`): what a sheet shows as the
// canvases' side tells of it, is kept, and the store is read; and the paths the page then holds.

import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('@tauri-apps/api/core', () => ({ invoke: vi.fn(async () => '[]') }));

import { invoke } from '@tauri-apps/api/core';
import { askOutlines, carryOf, drawInk, forgetLive, heardLive, inkHeard, inkKept, inkNow, learnInk, learnShapes, liveOf, onLive, onLiveSheet, resetInk, shapeOf, shownNames, shownSoon, storeRead, type Shape } from '../pageInk.js';

const pen = (n: string, c = '#112233'): Shape => ({ n, k: 'p', d: `M0 0L1 1L1 0z`, c });
const marker = (n: string): Shape => ({ n, k: 'm', d: 'M0 0L4 0L4 2L0 2z', c: '#ffee00', r: 1.2, o: 0.75 });
const svg = () => document.createElementNS('http://www.w3.org/2000/svg', 'svg') as SVGSVGElement;
const drawn = (el: SVGSVGElement) => Array.from(el.querySelectorAll<SVGElement>('[data-n]')).map((x) => `${x.parentElement?.dataset.layer}:${x.dataset.n}`);

beforeEach(() => { resetInk(); vi.mocked(invoke).mockClear(); });

describe('what a sheet shows', () => {
  it('is the store\'s strokes until the canvases\' side says otherwise', () => {
    expect(shownNames(undefined, null)).toEqual([]);
    expect(shownNames(undefined, ['a', 'b'])).toEqual(['a', 'b']);
    inkHeard({ kind: 'ink', sheet: 's', seq: 1, names: ['a', 'b', 'c'], add: [pen('c')] });
    expect(shownNames(liveOf('s'), ['a', 'b'])).toEqual(['a', 'b', 'c']);
    expect(shapeOf('c')?.d).toBe('M0 0L1 1L1 0z');
  });

  it('a stroke erased is gone at once, before anything is kept', () => {
    inkHeard({ kind: 'ink', sheet: 's', seq: 1, names: ['a', 'b'] });
    inkHeard({ kind: 'ink', sheet: 's', seq: 2, names: ['b'] });
    expect(shownNames(liveOf('s'), ['a', 'b'])).toEqual(['b']);
  });

  it('a telling that arrives after a later one is let go', () => {
    const one = heardLive(undefined, { kind: 'ink', sheet: 's', seq: 5, names: ['a', 'b'] }, 1)!;
    expect(heardLive(one, { kind: 'ink', sheet: 's', seq: 4, names: ['a'] }, 2)).toBe(one);
    expect(heardLive(one, { kind: 'ink', sheet: 's', seq: 6, names: ['a'] }, 3)!.names).toEqual(['a']);
  });

  it('once kept, it is what was kept until the store has been read again, then the store\'s', () => {
    inkHeard({ kind: 'ink', sheet: 's', seq: 3, names: ['a', 'b'] });
    // a reading of the store begun before the keep says nothing of what was kept
    const early = inkNow();
    inkKept('s', 3);
    expect(liveOf('s')).toMatchObject({ kept: true, names: ['a', 'b'] });
    storeRead('s', early);
    expect(liveOf('s')?.names).toEqual(['a', 'b']);
    storeRead('s', inkNow());
    expect(liveOf('s')).toBeUndefined();
  });

  it('a stroke written while the last were being kept stays', () => {
    inkHeard({ kind: 'ink', sheet: 's', seq: 3, names: ['a'] });
    inkHeard({ kind: 'ink', sheet: 's', seq: 4, names: ['a', 'b'] });
    inkKept('s', 3);
    expect(liveOf('s')).toMatchObject({ kept: false, seq: 4, names: ['a', 'b'] });
    storeRead('s', inkNow());
    expect(liveOf('s')?.names).toEqual(['a', 'b']);
    // an undo after a keep: said again, kept again
    inkKept('s', 4);
    inkHeard({ kind: 'ink', sheet: 's', seq: 5, names: ['a'] });
    expect(liveOf('s')).toMatchObject({ kept: false, names: ['a'] });
    storeRead('s', inkNow());
    expect(shownNames(liveOf('s'), ['a', 'b'])).toEqual(['a']);
  });

  it('whoever draws a sheet hears of it; a sheet first said to hold something is announced once', () => {
    const heard = vi.fn();
    const fresh = vi.fn();
    const off = onLive('s', heard);
    const offNew = onLiveSheet(fresh);
    inkHeard({ kind: 'ink', sheet: 's', seq: 1, names: ['a'] });
    inkHeard({ kind: 'ink', sheet: 's', seq: 2, names: ['a', 'b'] });
    inkHeard({ kind: 'ink', sheet: 'other', seq: 1, names: [] });
    expect(heard).toHaveBeenCalledTimes(2);
    expect(fresh.mock.calls.map((c) => c[0])).toEqual(['s', 'other']);
    forgetLive('s');
    expect(heard).toHaveBeenCalledTimes(3);
    expect(liveOf('s')).toBeUndefined();
    off(); offNew();
    inkHeard({ kind: 'ink', sheet: 's', seq: 1, names: ['a'] });
    expect(heard).toHaveBeenCalledTimes(3);
  });

  it('what the lasso carries is shown moved until the next telling', () => {
    inkHeard({ kind: 'ink', sheet: 's', carry: { names: ['a'], m: [1, 0, 0, 1, 12, -3] } });
    expect(liveOf('s')).toBeUndefined();
    expect(carryOf('s')?.m).toEqual([1, 0, 0, 1, 12, -3]);
    inkHeard({ kind: 'ink', sheet: 's', seq: 1, names: ['a2'], add: [pen('a2')] });
    expect(carryOf('s')).toBeNull();
  });
});

describe('the outlines', () => {
  it('are asked of the native side once a stroke, by the store\'s names', async () => {
    vi.mocked(invoke).mockResolvedValueOnce(JSON.stringify([pen('x'), marker('y')]));
    await learnShapes([{ stroke: 'x', at: 1, data: 'AAA' }, { stroke: 'y', at: 2, data: 'BBB' }]);
    expect(vi.mocked(invoke)).toHaveBeenCalledWith('ink_shapes', { strokes: ['AAA', 'BBB'] });
    expect(shapeOf('y')?.k).toBe('m');
    await learnShapes([{ stroke: 'x', at: 1, data: 'AAA' }]);
    expect(vi.mocked(invoke)).toHaveBeenCalledTimes(1);
  });
});

describe('a stroke told of whose outline is not here', () => {
  it('is asked of the canvases\' side, once', async () => {
    learnInk([pen('a')]);
    vi.mocked(invoke).mockResolvedValueOnce({ shapes: [pen('b')] });
    const heard = vi.fn();
    onLive('s', heard);
    askOutlines('s', ['a', 'b']);
    askOutlines('s', ['a', 'b']);
    expect(vi.mocked(invoke).mock.calls).toEqual([['ink_outlines', { sheet: 's', names: ['b'] }]]);
    await Promise.resolve(); await Promise.resolve();
    expect(shapeOf('b')?.k).toBe('p');
    expect(heard).toHaveBeenCalledTimes(1);
  });
});

describe('the paths the page holds', () => {
  it('a path a stroke, in order, a highlighter\'s under the rest', () => {
    learnInk([pen('a'), marker('h'), pen('b', '#ff0000')]);
    const el = svg();
    expect(drawInk(el, ['a', 'h', 'b'])).toBe(0);
    expect(drawn(el)).toEqual(['under:h', 'over:a', 'over:b']);
    const b = el.querySelector<SVGElement>('[data-n="b"]')!;
    expect(b.getAttribute('fill')).toBe('#ff0000');
    const h = el.querySelector<SVGElement>('[data-n="h"]')!;
    expect([h.getAttribute('stroke-width'), h.getAttribute('stroke-linejoin'), h.getAttribute('opacity')]).toEqual(['1.2', 'round', '0.75']);
  });

  it('only what changed is touched: a stroke added is one more path, one erased one fewer', () => {
    learnInk([pen('a'), pen('b'), pen('c')]);
    const el = svg();
    drawInk(el, ['a', 'b']);
    const a = el.querySelector('[data-n="a"]');
    drawInk(el, ['a', 'b', 'c']);
    expect(drawn(el)).toEqual(['over:a', 'over:b', 'over:c']);
    expect(el.querySelector('[data-n="a"]')).toBe(a);
    drawInk(el, ['a', 'c']);
    expect(drawn(el)).toEqual(['over:a', 'over:c']);
    expect(el.querySelector('[data-n="a"]')).toBe(a);
    // and the order is the one said
    drawInk(el, ['c', 'a']);
    expect(drawn(el)).toEqual(['over:c', 'over:a']);
  });

  it('a stroke whose outline is not known yet is counted, and drawn when it is', () => {
    learnInk([pen('a')]);
    const el = svg();
    expect(drawInk(el, ['a', 'late'])).toBe(1);
    expect(drawn(el)).toEqual(['over:a']);
    learnInk([pen('late')]);
    expect(drawInk(el, ['a', 'late'])).toBe(0);
    expect(drawn(el)).toEqual(['over:a', 'over:late']);
  });

  it('what the lasso carries is moved by a transform, and stands still again after', () => {
    learnInk([pen('a'), pen('b')]);
    const el = svg();
    drawInk(el, ['a', 'b'], { names: new Set(['b']), m: [1, 0, 0, 1, 10, 20] });
    expect(el.querySelector('[data-n="b"]')!.getAttribute('transform')).toBe('matrix(1 0 0 1 10 20)');
    expect(el.querySelector('[data-n="a"]')!.hasAttribute('transform')).toBe(false);
    drawInk(el, ['a', 'b'], null);
    expect(el.querySelector('[data-n="b"]')!.hasAttribute('transform')).toBe(false);
  });

  it('a stroke PencilKit\'s canvas still shows is in the page unseen, and seen once a telling says so', () => {
    learnInk([pen('a'), pen('b')]);
    inkHeard({ kind: 'ink', sheet: 's', seq: 1, names: ['a', 'b'], hide: ['b'] });
    const el = svg();
    drawInk(el, liveOf('s')!.names, null, liveOf('s')!.hide);
    expect(el.querySelector('[data-n="b"]')!.getAttribute('visibility')).toBe('hidden');
    expect(el.querySelector('[data-n="a"]')!.hasAttribute('visibility')).toBe(false);
    inkHeard({ kind: 'ink', sheet: 's', seq: 2, names: ['a', 'b'] });
    drawInk(el, liveOf('s')!.names, null, liveOf('s')!.hide);
    expect(el.querySelector('[data-n="b"]')!.hasAttribute('visibility')).toBe(false);
  });

  it('a picture PencilKit made of a stroke is an image where the stroke lies; a cut stroke is clipped', () => {
    learnInk([{ n: 'f', k: 'i', box: [10, 20, 30, 40], src: 'data:image/png;base64,AAAA' }, { ...pen('m'), clip: 'M0 0L5 0L5 5z' }]);
    const el = svg();
    drawInk(el, ['f', 'm']);
    const f = el.querySelector<SVGElement>('[data-n="f"]')!;
    expect([f.tagName, f.getAttribute('x'), f.getAttribute('y'), f.getAttribute('width'), f.getAttribute('height')]).toEqual(['image', '10', '20', '30', '40']);
    const m = el.querySelector<SVGElement>('[data-n="m"]')!;
    expect(m.tagName).toBe('g');
    expect(m.querySelector('clipPath path')!.getAttribute('d')).toBe('M0 0L5 0L5 5z');
  });
});

describe('telling the canvases\' side what is drawn', () => {
  it('once a telling, after it is on the glass', async () => {
    vi.useFakeTimers();
    shownSoon('s', 4);
    shownSoon('s', 4);
    expect(vi.mocked(invoke)).not.toHaveBeenCalled();
    vi.advanceTimersByTime(2000);
    expect(vi.mocked(invoke).mock.calls).toEqual([['ink_shown', { sheet: 's', seq: 4 }]]);
    shownSoon('s', 5);
    vi.advanceTimersByTime(2000);
    expect(vi.mocked(invoke)).toHaveBeenCalledTimes(2);
    vi.useRealTimers();
  });
});
