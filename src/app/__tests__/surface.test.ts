// @vitest-environment jsdom
// A notebook's surface (milestone 87), the page's side of it (`surface.ts`):
// it is told where it lies and what it holds only when that is not what it
// was last told; asked to go to a place or a zoom; its paper is the sheet's
// measures and nothing of where the sheet lies or its colours; whatever the
// page lays over the place it lies is a hole in it; a colour of the page's
// styles is read through a canvas, or is the one given where there is none.
// The surface itself is an iPad's, and is checked there.

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { PaperSpec } from '../paper.js';

/** What was asked of the native side. */
const calls: { cmd: string; args: Record<string, unknown> }[] = [];
/** How many of the next asks are refused. */
let refuse = 0;
vi.mock('@tauri-apps/api/core', () => ({
  invoke: async (cmd: string, args: Record<string, unknown>) => {
    calls.push({ cmd, args });
    if (refuse > 0) { refuse -= 1; throw new Error('no surface here'); }
    return null;
  },
}));
// (jsdom has no canvas to read a colour through)
const noContext = vi.fn(() => null);
HTMLCanvasElement.prototype.getContext = noContext as unknown as HTMLCanvasElement['getContext'];

const { dropSurface, hexOf, holesOver, paperArgs, sendSurface, surfaceGo, surfaceSettle, surfaceZoom } = await import('../surface.js');
type Spec = Parameters<typeof sendSurface>[0];

const tick = () => new Promise((r) => setTimeout(r, 0));
const LOOK = { paper: '#ffffff', rule: '#c3cfdd', margin: '#e3b3b3', dot: '#a9b6c6', dark: false, desk: '#e9e9e9', accent: '#b58a2a', fg: '#333333', line: '#cccccc', tag: '#ffffff' } as unknown as Spec['look'];
const specOf = (id: string, more: Partial<Spec> = {}): Spec => ({
  id, at: { x: 0, y: 60, w: 700, h: 840 }, key: 'k', sheets: [1, 2, 3],
  paper: { kind: 'ruled', w: 612, h: 792, rule: 24, margin: null, marginRight: null, top: 72, bottom: null, run: false },
  look: LOOK, pad: { top: 18, side: 30, bottom: 80 }, zoom: 1, open: null, marks: [], holes: [], add: true, tagRoom: 210, ...more,
});
const sent = () => calls.filter((c) => c.cmd === 'ink_surface').map((c) => c.args.surface);
const asked = () => calls.filter((c) => c.cmd === 'ink_surface_do').map((c) => c.args.ask);

beforeEach(() => { calls.length = 0; refuse = 0; });

describe('a surface told where it lies and what it holds', () => {
  it('is told once: the same again is not sent, and what differs in anything is', async () => {
    sendSurface(specOf('s:1'));
    sendSurface(specOf('s:1'));
    expect(sent()).toEqual([specOf('s:1')]);
    expect(calls[0]!.args).toEqual({ surface: specOf('s:1') });
    // a sheet more, a zoom, a hole, a box: each is told
    sendSurface(specOf('s:1', { sheets: [1, 2, 3, 4] }));
    sendSurface(specOf('s:1', { sheets: [1, 2, 3, 4], zoom: 1.5 }));
    sendSurface(specOf('s:1', { sheets: [1, 2, 3, 4], zoom: 1.5, holes: [{ x: 10, y: 70, w: 100, h: 40 }] }));
    sendSurface(specOf('s:1', { sheets: [1, 2, 3, 4], zoom: 1.5, holes: [{ x: 10, y: 70, w: 100, h: 40 }] }));
    sendSurface(specOf('s:1', { sheets: [1, 2, 3, 4], zoom: 1.5, marks: [{ key: 'pending:0', page: 1, x: 0.1, y: 0.1, w: 0.5, h: 0.3, pending: true }] }));
    expect(sent().length).toBe(5);
    // back to what it was told before the last: told, since it is not what it holds now
    sendSurface(specOf('s:1'));
    expect(sent().length).toBe(6);
    await tick();
  });

  it('each surface is remembered by its own name', () => {
    sendSurface(specOf('s:2'));
    sendSurface(specOf('s:3'));
    sendSurface(specOf('s:2'));
    sendSurface(specOf('s:3'));
    expect(sent().map((s) => (s as Spec).id)).toEqual(['s:2', 's:3']);
  });

  it('gone, it is told by its name alone, and what it was told is forgotten: the same is sent again', () => {
    sendSurface(specOf('s:4'));
    dropSurface('s:4');
    expect(sent()).toEqual([specOf('s:4'), { id: 's:4' }]);
    sendSurface(specOf('s:4'));
    expect(sent().length).toBe(3);
    expect(sent()[2]).toEqual(specOf('s:4'));
    // one that was never told can be told to go, and that is not an error
    refuse = 1;
    expect(() => dropSurface('s:never')).not.toThrow();
  });

  it('what could not be told is told again when it is next said', async () => {
    const err = vi.spyOn(console, 'error').mockImplementation(() => {});
    try {
      refuse = 1;
      sendSurface(specOf('s:5'));
      await tick();
      expect(err).toHaveBeenCalledTimes(1);
      sendSurface(specOf('s:5'));
      await tick();
      sendSurface(specOf('s:5'));
      expect(sent().length).toBe(2);
    } finally {
      err.mockRestore();
    }
  });
});

describe('a surface asked to go somewhere', () => {
  it('goes to a page and how far down it, across it only where that is said; at once unless asked otherwise', async () => {
    await surfaceGo('s:1', { page: 3, y: 0 });
    await surfaceGo('s:1', { page: 2, y: 0.25, x: null });
    await surfaceGo('s:1', { page: 2, y: 0.25, x: 0.5 }, true);
    // the left edge is a place across like any other
    await surfaceGo('s:1', { page: 1, y: 0.5, x: 0 });
    expect(asked()).toEqual([
      { id: 's:1', op: 'go', place: { page: 3, y: 0 }, animated: false },
      { id: 's:1', op: 'go', place: { page: 2, y: 0.25 }, animated: false },
      { id: 's:1', op: 'go', place: { page: 2, y: 0.25, x: 0.5 }, animated: true },
      { id: 's:1', op: 'go', place: { page: 1, y: 0.5, x: 0 }, animated: false },
    ]);
    expect('x' in (asked()[1] as { place: object }).place).toBe(false);
  });

  it('goes to a zoom, eased unless asked otherwise; a dev run waits for its pictures', async () => {
    await surfaceZoom('s:1', 1.5);
    await surfaceZoom('s:1', 1, false);
    await surfaceSettle('s:1');
    expect(asked()).toEqual([{ id: 's:1', op: 'zoom', zoom: 1.5, animated: true }, { id: 's:1', op: 'zoom', zoom: 1, animated: false }, { id: 's:1', op: 'settle' }]);
  });

  it('a surface that is not there is no error of the page\'s', async () => {
    const err = vi.spyOn(console, 'error').mockImplementation(() => {});
    try {
      refuse = 3;
      await expect(surfaceGo('s:gone', { page: 1, y: 0 })).resolves.toBeUndefined();
      await expect(surfaceZoom('s:gone', 2)).resolves.toBeUndefined();
      await expect(surfaceSettle('s:gone')).resolves.toBeUndefined();
    } finally {
      err.mockRestore();
    }
  });
});

describe('the paper a surface is told', () => {
  it('is the sheet\'s kind, size and ruling, its margins and the room at its foot, and whether the sheets run on; not where this sheet begins, nor its colours', () => {
    const p: PaperSpec = { kind: 'ruled', w: 595, h: 842, rule: 18, margin: 90, marginRight: 72, top: 60, bottom: null, run: true, at: 1684, color: '#fbf6e9', line: '#bcdcc0' };
    expect(paperArgs(p)).toEqual({ kind: 'ruled', w: 595, h: 842, rule: 18, margin: 90, marginRight: 72, top: 60, bottom: null, run: true });
    expect(Object.keys(paperArgs(p))).toEqual(['kind', 'w', 'h', 'rule', 'margin', 'marginRight', 'top', 'bottom', 'run']);
    expect(paperArgs({ ...p, kind: 'dotted', margin: null, marginRight: null, bottom: 30, run: false })).toEqual({ kind: 'dotted', w: 595, h: 842, rule: 18, margin: null, marginRight: null, top: 60, bottom: 30, run: false });
  });
});

describe('what the page lays over a surface', () => {
  /** Where each thing lies: jsdom lays nothing out. */
  const rects = new Map<Element, DOMRect>();
  const rectOf = HTMLElement.prototype.getBoundingClientRect;
  /** What is at a place on the screen, which jsdom cannot say. */
  let under: (x: number, y: number) => Element | null;
  let el: HTMLElement;
  const add = (into: Element, cls: string, at?: [number, number, number, number], attrs: Record<string, string> = {}): HTMLElement => {
    const k = into.appendChild(document.createElement('div'));
    if (cls) k.className = cls;
    for (const [a, v] of Object.entries(attrs)) k.setAttribute(a, v);
    if (at) rects.set(k, new DOMRect(...at));
    return k;
  };
  const within = (k: Element, x: number, y: number) => { const r = rects.get(k)!; return x >= r.left && x < r.right && y >= r.top && y < r.bottom; };

  beforeEach(() => {
    HTMLElement.prototype.getBoundingClientRect = function (this: HTMLElement) { return rects.get(this) ?? new DOMRect(0, 0, 0, 0); };
    // the app fills a window 1000 by 900; the surface's place is 600 by 800 of it, at (100, 50)
    const app = add(document.body, 'app', [0, 0, 1000, 900]);
    const book = add(app, 'book', [100, 0, 600, 900]);
    el = add(book, 'note-surface', [100, 50, 600, 800]);
    under = () => el;
    document.elementFromPoint = (x: number, y: number) => under(x, y);
  });
  afterEach(() => {
    HTMLElement.prototype.getBoundingClientRect = rectOf;
    delete (document as { elementFromPoint?: unknown }).elementFromPoint;
    rects.clear();
    document.body.replaceChildren();
  });

  it('with nothing over it there is no hole, whatever lies inside it or beside it', () => {
    const page = add(el, 'pdf-page sheet-place', [130, 68, 540, 700]);
    add(document.querySelector('.app')!, 'tree', [0, 0, 100, 900]);
    under = (x, y) => (within(page, x, y) ? page : el);
    expect(holesOver(el)).toEqual([]);
  });

  it('a thing over it that is no part of it is a hole, as much of it as lies over the place', () => {
    // the tree's sheet slid in over the left of the pages: a layer of the window's, what is pressed a row deep in it
    const layer = add(document.body, 'sheet-layer', [0, 0, 300, 900]);
    const row = add(add(layer, 'tree-sheet', [0, 0, 300, 900]), 'row', [0, 100, 300, 30]);
    under = (x, y) => (x < 300 ? row : el);
    expect(holesOver(el)).toEqual([{ x: 100, y: 50, w: 200, h: 800, wide: true }]);
    // the same thing found at every place asked is one hole
    under = () => row;
    expect(holesOver(el)).toEqual([{ x: 100, y: 50, w: 200, h: 800, wide: true }]);
  });

  it('a menu, a notice, the go-to field: each is its own hole, not the whole of what holds it', () => {
    // a menu in a backdrop as large as the window: the surface stands aside for the menu alone
    const backdrop = add(document.body, 'backdrop', [0, 0, 1000, 900]);
    const menu = add(backdrop, 'pop-menu', [400, 300, 180, 120]);
    const row = add(menu, 'ci', [400, 300, 180, 30]);
    under = (x, y) => (within(row, x, y) || within(menu, x, y) ? row : el);
    expect(holesOver(el)).toEqual([{ x: 400, y: 300, w: 180, h: 120 }]);
    // one so small it falls between the places asked is a hole all the same; one off the place is none
    under = () => el;
    add(document.body, 'notice', [640, 820, 300, 40]);
    add(document.body, 'ctx-menu', [720, 100, 200, 200]);
    expect(holesOver(el)).toEqual([{ x: 400, y: 300, w: 180, h: 120 }, { x: 640, y: 820, w: 60, h: 30 }]);
  });

  it('what holds the place itself is no hole in it', () => {
    const outer = add(document.body, '', [0, 0, 1000, 900], { 'data-ink-over': '' });
    outer.appendChild(document.querySelector('.app')!);
    expect(holesOver(el)).toEqual([]);
  });

  it('what stands inside it and is marked is a hole; the lasso\'s menu and a box\'s bar ride on the pages', () => {
    add(el, 'page-setup', [400, 50, 300, 400], { 'data-ink-over': '' });
    add(el, 'ink-menu', [150, 500, 200, 44]);
    add(el, 'pend', [150, 200, 240, 46], { 'data-ink-over': '', 'data-hit': '1' });
    // (not on the screen: none)
    add(el, 'page-grid', undefined, { 'data-ink-over': '' });
    add(el, 'pdf-page sheet-place', [130, 68, 540, 700]);
    // in the order they lie down the place, then across it
    expect(holesOver(el)).toEqual([
      { x: 400, y: 50, w: 300, h: 400 },
      { x: 150, y: 200, w: 240, h: 46, rides: true },
      { x: 150, y: 500, w: 200, h: 44, rides: true },
    ]);
  });

  it('a hole has its thing\'s rounded corner, to 24 at most, and its edges to a hundredth', () => {
    const menu = add(document.body, 'pop-menu', [400.123, 300.456, 180.004, 120]);
    menu.style.borderTopLeftRadius = '8px';
    const panel = add(el, 'page-setup', [100, 400, 600, 450], { 'data-ink-over': '' });
    panel.style.borderTopLeftRadius = '40px';
    expect(holesOver(el)).toEqual([{ x: 400.12, y: 300.46, w: 180, h: 120, r: 8 }, { x: 100, y: 400, w: 600, h: 450, r: 24 }]);
  });

  it('a place that is not on the screen has none, and neither has one where nothing can be asked what is at a place', () => {
    add(document.body, 'pop-menu', [400, 300, 180, 120]);
    expect(holesOver(el).length).toBe(1);
    rects.set(el, new DOMRect(100, 50, 0, 0));
    expect(holesOver(el)).toEqual([]);
    rects.set(el, new DOMRect(100, 50, 600, 800));
    delete (document as { elementFromPoint?: unknown }).elementFromPoint;
    expect(holesOver(el)).toEqual([]);
  });
});

describe('a colour of the page\'s styles', () => {
  it('where there is no canvas to read it through is the one given, and the canvas is asked for once', () => {
    expect(hexOf('rgb(26, 43, 60)', '#e9e9e9')).toBe('#e9e9e9');
    expect(hexOf('', '#b58a2a')).toBe('#b58a2a');
    expect(hexOf('var(--none)', '#333333')).toBe('#333333');
    expect(noContext).toHaveBeenCalledTimes(1);
  });

  it('where there is one is what a pixel filled with it holds, as #rrggbb; nothing said, or a canvas that cannot be read, is the one given', async () => {
    const was = HTMLCanvasElement.prototype.getContext;
    const filled: string[] = [];
    let fail = false;
    const ctx = {
      clearRect() {},
      set fillStyle(v: string) { filled.push(v); },
      fillRect() {},
      getImageData() { if (fail) throw new Error('tainted'); return { data: new Uint8ClampedArray([26, 43, 5, 255]) }; },
    };
    HTMLCanvasElement.prototype.getContext = (() => ctx) as unknown as HTMLCanvasElement['getContext'];
    try {
      vi.resetModules();
      const fresh = await import('../surface.js');
      expect(fresh.hexOf('rgb(26, 43, 5)', '#e9e9e9')).toBe('#1a2b05');
      // black first, so a colour the canvas does not know leaves that and not the last one read
      expect(filled).toEqual(['#000', 'rgb(26, 43, 5)']);
      expect(fresh.hexOf('', '#b58a2a')).toBe('#b58a2a');
      fail = true;
      expect(fresh.hexOf('red', '#cccccc')).toBe('#cccccc');
    } finally {
      HTMLCanvasElement.prototype.getContext = was;
    }
  });
});
