// @vitest-environment jsdom
// The mouse's drag of a row (`drag.ts`): on the Mac the window's native drop
// target is Tauri's and a row's HTML drag never reaches the page, so a mouse
// drag is the pointer's own — press, move past the slop, the row under the
// pointer hit-tested, let go.

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const calls: string[] = [];
vi.mock('../vault.js', () => ({
  placeNode: vi.fn(async (path: string, target: string, mode: string) => { calls.push(`place ${path} ${mode} ${target}`); return path; }),
}));

const { SLOP, endDrag, rowDrag, useDrag } = await import('../drag.js');

const surf = { pad: 6, indent: 10 };
const H = 24;

/** Rows a.md, b.md, c.md at depth 1, 24 px tall from y = 0, as `data-drop-row` elements with a name. */
function rows() {
  document.body.innerHTML = '';
  const paths = ['a.md', 'b.md', 'c.md'];
  const els = paths.map((p, i) => {
    const el = document.createElement('div');
    el.dataset.dropRow = p;
    el.innerHTML = `<span class="name">${p.replace('.md', '')}</span>`;
    el.getBoundingClientRect = () => ({ top: i * H, height: H, left: 0, bottom: (i + 1) * H, right: 200, width: 200, x: 0, y: i * H, toJSON() {} });
    document.body.appendChild(el);
    return el;
  });
  const geoms = paths.map((p) => ({ path: p, depth: 1, nest: 'dwell' as const, tail: [p, ''] }));
  // each row rendered: its props, and its element handed to the props' ref as React does
  const props = geoms.map((g, i) => { const p = rowDrag(g, surf, { draggable: true }); p.ref(els[i]!); return p; });
  // the hit test: the row whose band holds y
  document.elementFromPoint = (_x: number, y: number) => els[Math.floor(y / H)] ?? null;
  return { els, props };
}

const down = (p: ReturnType<typeof rowDrag>, el: HTMLElement, x: number, y: number) =>
  p.onPointerDown({ button: 0, pointerType: 'mouse', target: el.firstChild, currentTarget: el, clientX: x, clientY: y } as never);
const ptr = (type: string, x: number, y: number) => window.dispatchEvent(Object.assign(new Event(type, { bubbles: true, cancelable: true }), { clientX: x, clientY: y }));

beforeEach(() => { calls.length = 0; });
afterEach(() => { ptr('pointercancel', 0, 0); endDrag(); vi.useRealTimers(); });

describe('a mouse drag of a row', () => {
  it('is not a drag until it moves past the slop: a press and a let-go is a click', () => {
    const { els, props } = rows();
    down(props[0]!, els[0]!, 50, 12);
    ptr('pointermove', 50 + SLOP - 2, 12);
    expect(useDrag.getState().dragging).toBeNull();
    ptr('pointerup', 50 + SLOP - 2, 12);
    expect(useDrag.getState().dragging).toBeNull();
    expect(calls).toEqual([]);
  });

  it('lands before the row whose top quarter it is let go on, the ghost carrying the name', async () => {
    const { els, props } = rows();
    down(props[0]!, els[0]!, 50, 12);
    ptr('pointermove', 50, 30);
    expect(useDrag.getState().dragging).toBe('a.md');
    expect(document.querySelector('.drag-ghost')?.textContent).toBe('a');
    ptr('pointermove', 50, 2 * H + 3);
    expect(useDrag.getState().drop).toMatchObject({ target: 'c.md', mode: 'before', draw: 'top' });
    ptr('pointerup', 50, 2 * H + 3);
    await vi.waitFor(() => expect(calls).toEqual(['place a.md before c.md']));
    expect(useDrag.getState().dragging).toBeNull();
    expect(document.querySelector('.drag-ghost')).toBeNull();
    expect(document.documentElement.dataset.nodeDrag).toBeUndefined();
  });

  it('nests after a rest on a bare document\'s middle, with no more moves', async () => {
    vi.useFakeTimers();
    const { els, props } = rows();
    down(props[0]!, els[0]!, 50, 12);
    ptr('pointermove', 50, H + 12);
    expect(useDrag.getState().drop).toMatchObject({ target: 'b.md', mode: 'after' });
    vi.advanceTimersByTime(450);
    expect(useDrag.getState().drop).toMatchObject({ target: 'b.md', mode: 'into', draw: 'box' });
    ptr('pointerup', 50, H + 12);
    await vi.waitFor(() => expect(calls).toEqual(['place a.md into b.md']));
  });

  it('refuses a drop on itself: nothing drawn, nothing placed, the cursor says no', () => {
    const { els, props } = rows();
    down(props[1]!, els[1]!, 50, H + 12);
    ptr('pointermove', 50, H + 4);
    expect(useDrag.getState().dragging).toBe('b.md');
    expect(useDrag.getState().drop).toBeNull();
    expect(document.documentElement.dataset.nodeDrag).toBe('none');
    ptr('pointerup', 50, H + 4);
    expect(calls).toEqual([]);
  });

  it('off every row draws nothing, and a let-go there places nothing', () => {
    const { els, props } = rows();
    down(props[0]!, els[0]!, 50, 12);
    ptr('pointermove', 50, 2 * H + 3);
    expect(useDrag.getState().drop).not.toBeNull();
    ptr('pointermove', 50, 10 * H);
    expect(useDrag.getState().drop).toBeNull();
    ptr('pointerup', 50, 10 * H);
    expect(calls).toEqual([]);
    expect(useDrag.getState().dragging).toBeNull();
  });

  it('Esc cancels: the let-go after it places nothing', () => {
    const { els, props } = rows();
    down(props[0]!, els[0]!, 50, 12);
    ptr('pointermove', 50, 2 * H + 3);
    window.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' }));
    expect(useDrag.getState().drop).toBeNull();
    ptr('pointerup', 50, 2 * H + 3);
    expect(calls).toEqual([]);
  });

  it('the click the let-go makes after a drag does not reach the row', () => {
    const { els, props } = rows();
    const clicked = vi.fn();
    els[2]!.addEventListener('click', clicked);
    down(props[0]!, els[0]!, 50, 12);
    ptr('pointermove', 50, 2 * H + 3);
    ptr('pointerup', 50, 2 * H + 3);
    els[2]!.dispatchEvent(new MouseEvent('click', { bubbles: true, cancelable: true }));
    expect(clicked).not.toHaveBeenCalled();
  });

  it('a finger leaves the press alone (a touch screen keeps the system\'s drag), and so does a press on the row\'s buttons', () => {
    const { els, props } = rows();
    props[0]!.onPointerDown({ button: 0, pointerType: 'touch', target: els[0], currentTarget: els[0], clientX: 50, clientY: 12 } as never);
    ptr('pointermove', 50, 40);
    expect(useDrag.getState().dragging).toBeNull();
    const acts = document.createElement('span');
    acts.className = 'row-acts';
    els[0]!.appendChild(acts);
    props[0]!.onPointerDown({ button: 0, pointerType: 'mouse', target: acts, currentTarget: els[0], clientX: 50, clientY: 12 } as never);
    ptr('pointermove', 50, 40);
    expect(useDrag.getState().dragging).toBeNull();
  });

  // found by the drag's statechart (`drag.model.test.ts`)
  it('a row drawn by two surfaces at once (the tree\'s and a notebook rail\'s, one key) is hit-tested as the one under the pointer', async () => {
    const { els, props } = rows();
    // the rail draws b.md too, deeper and nesting at once, rendered after the tree
    const rail = document.createElement('div');
    rail.dataset.dropRow = 'b.md';
    rail.getBoundingClientRect = () => ({ top: 5 * H, height: H, left: 0, bottom: 6 * H, right: 200, width: 200, x: 0, y: 5 * H, toJSON() {} });
    document.body.appendChild(rail);
    rowDrag({ path: 'b.md', depth: 3, nest: 'now', tail: ['b.md'] }, { pad: 20, indent: 14 }, { draggable: true }).ref(rail);
    down(props[0]!, els[0]!, 50, 12);
    ptr('pointermove', 50, H + 21);
    // the tree's b.md: after it at depth 1, not the rail's `into` at depth 4
    expect(useDrag.getState().drop).toMatchObject({ target: 'b.md', mode: 'after', depth: 1 });
    ptr('pointerup', 50, H + 21);
    await vi.waitFor(() => expect(calls).toEqual(['place a.md after b.md']));
  });

  it('a drop tells the surface where the node it moved went, and which node that was (the tree\'s selection follows it)', async () => {
    const { els, props } = rows();
    const landed = vi.fn();
    const props2 = rowDrag({ path: 'c.md', depth: 1, nest: 'dwell', tail: ['c.md'] }, { ...surf, landed }, { draggable: true });
    props2.ref(els[2]!);
    down(props[0]!, els[0]!, 50, 12);
    ptr('pointermove', 50, 2 * H + 3);
    ptr('pointerup', 50, 2 * H + 3);
    await vi.waitFor(() => expect(landed).toHaveBeenCalledWith(expect.objectContaining({ target: 'c.md', mode: 'before' }), 'a.md', 'a.md'));
  });

  it('Esc ends the drag at once (the row no longer dimmed, nothing ticking), and the let-go and its click after it do nothing', () => {
    vi.useFakeTimers();
    const { els, props } = rows();
    const clicked = vi.fn();
    els[2]!.addEventListener('click', clicked);
    down(props[0]!, els[0]!, 50, 12);
    ptr('pointermove', 50, 2 * H + 3);
    window.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' }));
    expect(useDrag.getState()).toEqual({ dragging: null, drop: null });
    expect(document.querySelector('.drag-ghost')).toBeNull();
    expect(vi.getTimerCount()).toBe(0);
    ptr('pointermove', 50, 2 * H + 12);
    expect(useDrag.getState().drop).toBeNull();
    ptr('pointerup', 50, 2 * H + 12);
    els[2]!.dispatchEvent(new MouseEvent('click', { bubbles: true, cancelable: true }));
    expect(clicked).not.toHaveBeenCalled();
    expect(calls).toEqual([]);
  });

  it('a move with no button down (the let-go missed, outside the window) ends the press: no drag starts, a drag under way lands nowhere', () => {
    const { els, props } = rows();
    down(props[0]!, els[0]!, 50, 12);
    window.dispatchEvent(Object.assign(new Event('pointermove'), { clientX: 50, clientY: 2 * H + 3, buttons: 0 }));
    expect(useDrag.getState().dragging).toBeNull();
    down(props[0]!, els[0]!, 50, 12);
    ptr('pointermove', 50, 2 * H + 3);
    expect(useDrag.getState().dragging).toBe('a.md');
    window.dispatchEvent(Object.assign(new Event('pointermove'), { clientX: 50, clientY: 2 * H + 3, buttons: 0 }));
    expect(useDrag.getState()).toEqual({ dragging: null, drop: null });
    expect(document.querySelector('.drag-ghost')).toBeNull();
    ptr('pointerup', 50, 2 * H + 3);
    expect(calls).toEqual([]);
  });

  it('the window losing focus mid-drag (⌘-tab) ends it, landing nowhere', () => {
    const { els, props } = rows();
    down(props[0]!, els[0]!, 50, 12);
    ptr('pointermove', 50, 2 * H + 3);
    // an element's blur is not the window's
    els[1]!.dispatchEvent(new FocusEvent('blur'));
    expect(useDrag.getState().dragging).toBe('a.md');
    window.dispatchEvent(new FocusEvent('blur'));
    expect(useDrag.getState()).toEqual({ dragging: null, drop: null });
    expect(document.querySelector('.drag-ghost')).toBeNull();
    expect(document.documentElement.dataset.nodeDrag).toBeUndefined();
    ptr('pointerup', 50, 2 * H + 3);
    expect(calls).toEqual([]);
  });

  it('a press while a drag is under way (its let-go missed) ends that drag first, so a click after it leaves nothing dragged', () => {
    const { els, props } = rows();
    down(props[0]!, els[0]!, 50, 12);
    ptr('pointermove', 50, 2 * H + 3);
    expect(useDrag.getState().dragging).toBe('a.md');
    down(props[1]!, els[1]!, 50, H + 12);
    expect(useDrag.getState()).toEqual({ dragging: null, drop: null });
    ptr('pointerup', 50, H + 12);
    expect(useDrag.getState().dragging).toBeNull();
    expect(calls).toEqual([]);
  });

  it('a row is not the system\'s draggable on a fine pointer (the Mac), so WebKit starts no drag of its own', () => {
    rows();
    expect(rowDrag({ path: 'a.md', depth: 1, nest: 'dwell', tail: ['a.md'] }, surf, { draggable: true }).draggable).toBe(false);
  });
});
