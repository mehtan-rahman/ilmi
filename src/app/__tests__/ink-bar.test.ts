// @vitest-environment jsdom
// The writing tools (milestone 82): what is chosen and how it changes, that
// it is the device's and survives a reload, exactly what the canvases are
// told and when (the tool on the first scene and on each change, the finger,
// undo and redo and what they answer, the colour wheel and its closing with
// none chosen, nothing at all without a canvas), and the row itself: an
// iPad's only, the chosen tool lit, its sizes and colours, what can be
// taken back. Milestone 85: each size and each swatch can be changed, the
// pen has inks, the highlighter an opacity, the eraser two ways, a stroke
// ended resting can become a shape; the tool in use pressed again opens its
// settings under the row; the row fits a narrow pane by dropping its sizes
// and then its colours, and can be tucked away; the Pencil's double tap and
// squeeze. The canvases themselves are an iPad's (`ILMI_SMOKE=written`).

import { Fragment, act, createElement } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  CUSTOM, DEFAULTS, INKS, OPACITY_MIN, RECENT, SIZES, SWATCHES, WIDTHS, colorOf, hex, inksHere, parse, rangeOf, swatchName, toolOf, widthOf, withColor, withCustom,
  withEraser, withFinger, withInk, withOpacity, withPencilTap, withSense, withRecent, withShown, withSize, withSnap, withSwatch, withTool, withWidth, type Kept,
} from '../inkTools.js';
import { ROW_FULL, ROW_MID, rowFit } from '../InkBar.js';

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

const calls: { cmd: string; args: Record<string, unknown> }[] = [];
/** The number each telling of the tool carried, in the order they were sent. */
const seqs: number[] = [];
/** What the canvases answer, by command. */
let answers: Record<string, (args: Record<string, unknown>) => unknown> = {};
vi.mock('@tauri-apps/api/core', () => ({
  invoke: async (cmd: string, args: Record<string, unknown>) => {
    // (a module's own question at launch, none of the canvases')
    if (cmd === 'dev_env') return null;
    // (a telling of the tool is numbered, so that one arrived late is let go: the number is kept apart from what was said)
    if (cmd === 'ink_tool' && args && typeof args.seq === 'number') { const { seq, ...rest } = args; seqs.push(seq as number); calls.push({ cmd, args: rest }); }
    else calls.push({ cmd, args });
    if (cmd in answers) return answers[cmd]!(args);
    if (cmd === 'ink_scene') return { made: [] };
    if (cmd === 'ink_undo' || cmd === 'ink_redo') return { undo: false, redo: false };
    if (cmd === 'ink_color') return { color: null };
    return null;
  },
}));

/** The pen as it starts, as the canvases are told it: the even line (86; the soft pen before). */
const PEN = { kind: 'pen', color: '#1c1c1e', width: 2.2, ink: 'monoline', snap: true };

// jsdom lays nothing out: the row's width is given, a tool's settings lie where they are said to, and what watches the row's size is told by hand
let barW = 0;
Object.defineProperty(HTMLElement.prototype, 'clientWidth', { configurable: true, get(this: HTMLElement) { return this.classList.contains('inkbar') ? barW : 0; } });
const POP = { x: 20, y: 100, w: 296, h: 240 };
const rectOf = HTMLElement.prototype.getBoundingClientRect;
HTMLElement.prototype.getBoundingClientRect = function (this: HTMLElement) {
  if (this.classList.contains('ink-pop') || this.classList.contains('pop-menu')) return new DOMRect(POP.x, POP.y, POP.w, POP.h);
  return rectOf.call(this);
};
HTMLElement.prototype.getClientRects = function (this: HTMLElement) { return [this.getBoundingClientRect()] as unknown as DOMRectList; };
const watchers = new Set<() => void>();
globalThis.ResizeObserver = class { constructor(private cb: () => void) {} observe() { watchers.add(this.cb); } unobserve() {} disconnect() { watchers.delete(this.cb); } } as unknown as typeof ResizeObserver;

const wait = (ms = 5) => new Promise((r) => setTimeout(r, ms));
const said = (cmd: string) => calls.filter((c) => c.cmd === cmd).map((c) => c.args);
const pencil = (e: Record<string, unknown>) => (window as unknown as { __ink(e: unknown): void }).__ink(e);

/** The app as it is after a launch or a web reload: every module anew, over the same storage. */
async function launch(shape: { mobile: boolean; phone?: boolean } = { mobile: true }) {
  vi.resetModules();
  const store = await import('../store.js');
  store.useApp.setState({ mobile: shape.mobile, phone: shape.phone ?? false });
  const tools = await import('../inkTools.js');
  const ink = await import('../ink.js');
  const { InkBar, InkToggle } = await import('../InkBar.js');
  /** A surface with nothing on it: the first scene goes out, and the canvases exist. */
  const scene = async () => { ink.addSurface({ host: () => null, paper: () => null, kept: async () => {} }); await wait(); };
  return { ...store, tools, ink, InkBar, InkToggle, scene };
}

beforeEach(() => {
  localStorage.clear();
  calls.length = 0;
  answers = {};
  barW = 0;
});

describe('what is chosen', () => {
  it('starts at a medium black pen of an even line, a finger not drawing, the row shown', () => {
    expect(toolOf(DEFAULTS)).toEqual(PEN);
    expect(DEFAULTS.finger).toBe(false);
    expect(DEFAULTS.custom).toEqual({ pen: null, highlighter: null });
    expect(DEFAULTS).toMatchObject({ last: 'pen', ink: 'monoline', opacity: 1, eraser: 'stroke', snap: true, shown: true, recent: { pen: [], highlighter: [] } });
    expect(DEFAULTS.widths).toEqual(SIZES);
    expect(DEFAULTS.colors).toEqual({ pen: SWATCHES.pen.map((s) => s.color), highlighter: SWATCHES.highlighter.map((s) => s.color) });
  });

  it('each tool has three sizes and remembers its own', () => {
    expect(SIZES).toEqual({ pen: [1.2, 2.2, 3.6], highlighter: [10, 16, 24], eraser: [8, 16, 28] });
    let k = withSize(DEFAULTS, 'pen', 2);
    k = withSize(withTool(k, 'highlighter'), 'highlighter', 0);
    k = withSize(withTool(k, 'eraser'), 'eraser', 2);
    expect(toolOf(k)).toEqual({ kind: 'eraser', color: '#000000', width: 28, mode: 'stroke' });
    expect(toolOf(withTool(k, 'highlighter'))).toMatchObject({ kind: 'highlighter', width: 10 });
    expect(toolOf(withTool(k, 'pen'))).toMatchObject({ kind: 'pen', width: 3.6 });
    // select has none
    expect(toolOf(withTool(k, 'select'))).toEqual({ kind: 'select', color: '#000000', width: 0 });
    // a size there is not changes nothing
    expect(withSize(k, 'pen', 3)).toBe(k);
    expect(withSize(k, 'pen', 2)).toBe(k);
  });

  it('the size in use can be made thinner or thicker, between what the tool can be, to a tenth of a point', () => {
    expect(WIDTHS).toEqual({ pen: [0.5, 8], highlighter: [6, 40], eraser: [4, 48] });
    let k = withWidth(DEFAULTS, 'pen', 5.04);
    expect(k.widths.pen).toEqual([1.2, 5, 3.6]);
    expect(toolOf(k).width).toBe(5);
    // the other sizes and the other tools are as they were, and so is what they start as
    expect(k.widths.highlighter).toBe(SIZES.highlighter);
    expect(SIZES.pen).toEqual([1.2, 2.2, 3.6]);
    k = withWidth(withSize(k, 'pen', 0), 'pen', 0.1);
    expect(k.widths.pen).toEqual([0.5, 5, 3.6]);
    k = withWidth(withSize(k, 'pen', 2), 'pen', 99);
    expect(k.widths.pen).toEqual([0.5, 5, 8]);
    expect(withWidth(DEFAULTS, 'highlighter', 2).widths.highlighter).toEqual([10, 6, 24]);
    expect(withWidth(DEFAULTS, 'eraser', 33.33).widths.eraser).toEqual([8, 33.3, 28]);
    // the same again, and what is no number: nothing
    expect(withWidth(k, 'pen', 8)).toBe(k);
    expect(withWidth(k, 'pen', 12)).toBe(k);
    expect(withWidth(k, 'pen', Number.NaN)).toBe(k);
    expect(withWidth(k, 'pen', Infinity)).toBe(k);
  });

  it('a width is held to what the ink takes on this device, where that is known; what is kept is not changed by it', () => {
    const caps = { pen: [0.88, 25.66], monoline: [0.5, 2.85], pencil: [2.4, 16], marker: [9.64, 60] } as const;
    expect(rangeOf(DEFAULTS, 'pen')).toEqual([0.5, 8]);
    expect(rangeOf(DEFAULTS, 'pen', null)).toEqual([0.5, 8]);
    // inside both, in tenths
    expect(rangeOf(withInk(DEFAULTS, 'pen'), 'pen', caps)).toEqual([0.9, 8]);
    expect(rangeOf(DEFAULTS, 'pen', caps)).toEqual([0.5, 2.8]);
    expect(rangeOf(withInk(DEFAULTS, 'pencil'), 'pen', caps)).toEqual([2.4, 8]);
    // an ink the device said nothing of, and the eraser, which is ours: as wide as the tool can be
    expect(rangeOf(withInk(DEFAULTS, 'fountain'), 'pen', caps)).toEqual([0.5, 8]);
    expect(rangeOf(DEFAULTS, 'eraser', caps)).toEqual([4, 48]);
    // the highlighter's is the marker's
    expect(rangeOf(DEFAULTS, 'highlighter', caps)).toEqual([9.7, 40]);
    // a range that leaves nothing is not believed
    expect(rangeOf(withInk(DEFAULTS, 'pen'), 'pen', { pen: [9, 12] })).toEqual([0.5, 8]);
    const k = withInk(withSize(DEFAULTS, 'pen', 2), 'monoline');
    expect(widthOf(k, 'pen')).toBe(3.6);
    expect(widthOf(k, 'pen', caps)).toBe(2.8);
    expect(toolOf(k, caps)).toEqual({ kind: 'pen', color: '#1c1c1e', width: 2.8, ink: 'monoline', snap: true });
    expect(toolOf(withInk(DEFAULTS, 'pencil'), caps).width).toBe(2.4);
    expect(widthOf(withSize(DEFAULTS, 'highlighter', 0), 'highlighter', caps)).toBe(10);
    expect(widthOf(withWidth(DEFAULTS, 'highlighter', 6), 'highlighter', caps)).toBe(9.7);
    expect(k.widths.pen).toEqual([1.2, 2.2, 3.6]);
    // the pen's inks there are: all of them until the device has said, then the ones it named
    expect(inksHere(null)).toBe(INKS);
    expect(INKS.map((i) => [i.ink, i.name])).toEqual([['pen', 'pen'], ['monoline', 'fine'], ['fountain', 'fountain'], ['pencil', 'pencil']]);
    expect(inksHere({ inks: caps, squeeze: false }).map((i) => i.ink)).toEqual(['pen', 'monoline', 'pencil']);
  });

  it('a pen and a highlighter each have four colours and remember their own', () => {
    expect(SWATCHES.pen.map((s) => s.name)).toEqual(['black', 'blue', 'red', 'green']);
    expect(SWATCHES.highlighter.map((s) => s.name)).toEqual(['yellow', 'green', 'pink', 'blue']);
    for (const s of [...SWATCHES.pen, ...SWATCHES.highlighter]) expect(hex(s.color)).toBe(s.color);
    let k = withSwatch(DEFAULTS, 'pen', 2);
    k = withSwatch(k, 'highlighter', 3);
    expect(colorOf(k, 'pen')).toBe(SWATCHES.pen[2]!.color);
    expect(colorOf(k, 'highlighter')).toBe(SWATCHES.highlighter[3]!.color);
    expect(toolOf(withTool(k, 'highlighter')).color).toBe(SWATCHES.highlighter[3]!.color);
    expect(withSwatch(k, 'pen', 9)).toBe(k);
  });

  it('one of the four can be replaced: it is the one in use, and is called by its place from then on', () => {
    const k = withColor(DEFAULTS, 'pen', 1, '#AA3377');
    expect(k.colors.pen).toEqual(['#1c1c1e', '#aa3377', '#c5281c', '#1e7a46']);
    expect(k.swatch.pen).toBe(1);
    expect(colorOf(k, 'pen')).toBe('#aa3377');
    expect([0, 1, 2, 3].map((i) => swatchName(k, 'pen', i))).toEqual(['black', 'colour 2', 'red', 'green']);
    expect([0, 1, 2, 3].map((i) => swatchName(k, 'highlighter', i))).toEqual(['yellow', 'green', 'pink', 'blue']);
    // the highlighter's are its own, the wheel's own swatch is not touched, and what they start as is as it was
    expect(k.colors.highlighter).toBe(DEFAULTS.colors.highlighter);
    expect(k.custom).toEqual({ pen: null, highlighter: null });
    expect(DEFAULTS.colors.pen[1]).toBe('#1d4fb8');
    // made what it started as again, it has its name again
    expect(swatchName(withColor(k, 'pen', 1, '#1d4fb8'), 'pen', 1)).toBe('blue');
    // the same colour on another swatch in use: that swatch is the one in use
    const other = withSwatch(k, 'pen', 0);
    expect(withColor(other, 'pen', 1, '#aa3377').swatch.pen).toBe(1);
    // the same again, a place there is not, what is no colour: nothing
    expect(withColor(k, 'pen', 1, '#aa3377')).toBe(k);
    for (const at of [CUSTOM, -1, 1.5, 9]) expect(withColor(k, 'pen', at, '#000000')).toBe(k);
    expect(withColor(k, 'pen', 0, 'red')).toBe(k);
    expect(withColor(k, 'pen', 0, '#fff')).toBe(k);
  });

  it('the wheel\'s colour is a tool\'s own swatch: absent until one is chosen, then the one in use', () => {
    // not to be chosen before it has a colour
    expect(withSwatch(DEFAULTS, 'pen', CUSTOM)).toBe(DEFAULTS);
    const k = withCustom(DEFAULTS, 'pen', '#AA3377');
    expect(k.custom).toEqual({ pen: '#aa3377', highlighter: null });
    expect(k.swatch.pen).toBe(CUSTOM);
    expect(colorOf(k, 'pen')).toBe('#aa3377');
    // a preset again, and back to it: it is still there
    const back = withSwatch(k, 'pen', 0);
    expect(colorOf(back, 'pen')).toBe('#1c1c1e');
    expect(colorOf(withSwatch(back, 'pen', CUSTOM), 'pen')).toBe('#aa3377');
    // the highlighter's is its own
    expect(colorOf(k, 'highlighter')).toBe(SWATCHES.highlighter[0]!.color);
    // what is no colour is not taken
    expect(withCustom(DEFAULTS, 'pen', 'red')).toBe(DEFAULTS);
  });

  it('the colours lately taken from the wheel are remembered for each tool: the newest first, each once, the last few', () => {
    let k = withRecent(DEFAULTS, 'pen', '#111111');
    k = withRecent(k, 'pen', '#222222');
    k = withRecent(k, 'pen', '#333333');
    expect(k.recent).toEqual({ pen: ['#333333', '#222222', '#111111'], highlighter: [] });
    // one taken again moves to the front
    k = withRecent(k, 'pen', '#111111');
    expect(k.recent.pen).toEqual(['#111111', '#333333', '#222222']);
    expect(withRecent(k, 'pen', '#111111')).toBe(k);
    expect(withRecent(k, 'pen', 'blue')).toBe(k);
    expect(withRecent(k, 'highlighter', '#ABCDEF').recent).toEqual({ pen: k.recent.pen, highlighter: ['#abcdef'] });
    expect(RECENT).toBe(8);
    for (let i = 0; i < 12; i++) k = withRecent(k, 'pen', `#0000${String(i).padStart(2, '0')}`);
    expect(k.recent.pen).toEqual(['#000011', '#000010', '#000009', '#000008', '#000007', '#000006', '#000005', '#000004']);
    // remembering one chooses nothing
    expect(colorOf(k, 'pen')).toBe('#1c1c1e');
  });

  it('the pen has its inks, the highlighter its opacity, the eraser its two ways, and a rested stroke becomes a shape or does not', () => {
    for (const ink of ['pen', 'fountain', 'pencil'] as const) expect(toolOf(withInk(DEFAULTS, ink))).toEqual({ ...PEN, ink });
    expect(withInk(DEFAULTS, 'monoline')).toBe(DEFAULTS);
    expect(withInk(DEFAULTS, 'brush' as never)).toBe(DEFAULTS);
    // the opacity: to a hundredth, never less than can be seen
    expect(OPACITY_MIN).toBe(0.2);
    const hl = withTool(DEFAULTS, 'highlighter');
    expect(toolOf(hl)).toEqual({ kind: 'highlighter', color: '#ffe03a', width: 16, opacity: 1, snap: true });
    expect(toolOf(withOpacity(hl, 0.456)).opacity).toBe(0.46);
    expect(withOpacity(hl, 0).opacity).toBe(0.2);
    expect(withOpacity(withOpacity(hl, 0.5), 7).opacity).toBe(1);
    expect(withOpacity(hl, 1)).toBe(hl);
    expect(withOpacity(hl, 3)).toBe(hl);
    expect(withOpacity(hl, Number.NaN)).toBe(hl);
    // the eraser
    const er = withTool(DEFAULTS, 'eraser');
    expect(toolOf(withEraser(er, 'part'))).toEqual({ kind: 'eraser', color: '#000000', width: 16, mode: 'part' });
    expect(withEraser(er, 'stroke')).toBe(er);
    expect(withEraser(er, 'all' as never)).toBe(er);
    expect(withEraser(withEraser(er, 'part'), 'stroke').eraser).toBe('stroke');
    // a shape: the pen's and the highlighter's, said to the canvases with the tool; not the eraser's, not select's
    const plain = withSnap(DEFAULTS, false);
    expect(toolOf(plain)).toEqual({ ...PEN, snap: false });
    expect(toolOf(withTool(plain, 'highlighter')).snap).toBe(false);
    expect('snap' in toolOf(withTool(plain, 'eraser'))).toBe(false);
    expect('snap' in toolOf(withTool(plain, 'select'))).toBe(false);
    expect(withSnap(plain, false)).toBe(plain);
    expect(withSnap(plain, true).snap).toBe(true);
    // each tool is told only what is its own
    expect(Object.keys(toolOf(DEFAULTS)).sort()).toEqual(['color', 'ink', 'kind', 'snap', 'width']);
    expect(Object.keys(toolOf(hl)).sort()).toEqual(['color', 'kind', 'opacity', 'snap', 'width']);
    expect(Object.keys(toolOf(er)).sort()).toEqual(['color', 'kind', 'mode', 'width']);
    // the row shown or tucked away
    expect(withShown(DEFAULTS, true)).toBe(DEFAULTS);
    expect(withShown(DEFAULTS, false).shown).toBe(false);
    expect(toolOf(withShown(DEFAULTS, false))).toEqual(PEN);
  });

  it('the tool held before is remembered, and the Pencil tapped twice goes to the eraser and back, or to the tool before', () => {
    const hl = withTool(DEFAULTS, 'highlighter');
    expect([hl.tool, hl.last]).toEqual(['highlighter', 'pen']);
    expect(withTool(hl, 'highlighter')).toBe(hl);
    // to the eraser, and from it back to what was held
    const er = withPencilTap(hl, 'eraser');
    expect([er.tool, er.last]).toEqual(['eraser', 'highlighter']);
    const back = withPencilTap(er, 'eraser');
    expect([back.tool, back.last]).toEqual(['highlighter', 'eraser']);
    expect(withPencilTap(withTool(DEFAULTS, 'select'), 'eraser').tool).toBe('eraser');
    // the eraser with nothing held before it: the pen
    expect(withPencilTap(parse(JSON.stringify({ tool: 'eraser' })), 'eraser').tool).toBe('pen');
    // a setting this does not know is the eraser's
    expect(withPencilTap(hl, 'showColorPalette').tool).toBe('eraser');
    // the tool before: there and back
    const prev = withPencilTap(hl, 'previous');
    expect([prev.tool, prev.last]).toEqual(['pen', 'highlighter']);
    expect(withPencilTap(prev, 'previous').tool).toBe('highlighter');
    expect(withPencilTap(DEFAULTS, 'previous')).toBe(DEFAULTS);
    // and nothing at all
    expect(withPencilTap(hl, 'ignore')).toBe(hl);
    expect(withPencilTap(er, 'ignore')).toBe(er);
  });

  it('what was kept is read back, and what it says wrongly is as it starts', () => {
    const k: Kept = {
      tool: 'highlighter', last: 'eraser', size: { pen: 0, highlighter: 2, eraser: 1 }, widths: { pen: [0.8, 2.2, 6.5], highlighter: [10, 16, 30], eraser: [8, 16, 28] },
      swatch: { pen: CUSTOM, highlighter: 1 }, colors: { pen: ['#1c1c1e', '#aa3377', '#c5281c', '#1e7a46'], highlighter: SWATCHES.highlighter.map((s) => s.color) },
      custom: { pen: '#123456', highlighter: null }, recent: { pen: ['#123456', '#aa3377'], highlighter: [] },
      ink: 'fountain', sense: 1.5, opacity: 0.6, eraser: 'part', snap: false, finger: true, shown: false,
    };
    expect(parse(JSON.stringify(k))).toEqual(k);
    // a pen's pressure: told to the canvases for the inks that follow it, and only when it is not the ink's own
    expect(toolOf({ ...k, tool: 'pen' }).sense).toBe(1.5);
    expect(toolOf({ ...k, tool: 'pen', sense: 1 }).sense).toBeUndefined();
    expect(toolOf({ ...k, tool: 'pen', ink: 'monoline' }).sense).toBeUndefined();
    expect(withSense(k, 9).sense).toBe(2);
    expect(withSense(k, -1).sense).toBe(0);
    expect(parse(null)).toBe(DEFAULTS);
    expect(parse('')).toBe(DEFAULTS);
    expect(parse('not json')).toBe(DEFAULTS);
    expect(parse('null')).toBe(DEFAULTS);
    expect(parse('7')).toBe(DEFAULTS);
    expect(parse(JSON.stringify({ tool: 'brush', size: { pen: 7 }, swatch: { pen: CUSTOM, highlighter: 12 }, custom: { pen: 'blue' }, finger: 'yes' }))).toEqual(DEFAULTS);
    expect(parse(JSON.stringify({
      last: 'brush', widths: { pen: [1, 2], highlighter: [1, 'wide', 3], eraser: 'big' }, colors: { pen: 'black', highlighter: ['red'] }, recent: { pen: 'none', highlighter: 4 },
      ink: 'brush', opacity: 'half', eraser: 'all', snap: 'no', shown: 0,
    }))).toEqual(DEFAULTS);
    expect(withFinger(k, true)).toBe(k);
    expect(withFinger(k, false).finger).toBe(false);
  });

  it('what a device kept before there was more to keep is read with the rest as it starts', () => {
    const old = { tool: 'highlighter', size: { pen: 0, highlighter: 2, eraser: 1 }, swatch: { pen: CUSTOM, highlighter: 1 }, custom: { pen: '#123456', highlighter: null }, finger: true };
    const k = parse(JSON.stringify(old));
    expect(k).toEqual({ ...DEFAULTS, ...old, last: 'highlighter' });
    expect(toolOf(k)).toEqual({ kind: 'highlighter', color: '#86e08a', width: 24, opacity: 1, snap: true });
    expect(toolOf(withTool(k, 'pen'))).toEqual({ kind: 'pen', color: '#123456', width: 1.2, ink: 'monoline', snap: true });
    expect(k.shown).toBe(true);
  });

  it('a soft pen kept before the pen started as the even line was never chosen, and is the even line; one kept since is the pen', () => {
    // before 86 what was kept said nothing of its shape, and `pen` was only how it started
    expect(parse(JSON.stringify({ ...DEFAULTS, ink: 'pen' })).ink).toBe('monoline');
    expect(parse(JSON.stringify({ ink: 'pen' }))).toEqual(DEFAULTS);
    expect(parse(JSON.stringify({ ink: 'pen', v: 1 })).ink).toBe('monoline');
    expect(parse(JSON.stringify({ ink: 'pen', v: '2' })).ink).toBe('monoline');
    // any other ink was chosen, and is kept whatever the shape
    for (const ink of ['monoline', 'fountain', 'pencil'] as const) {
      expect(parse(JSON.stringify({ ink })).ink).toBe(ink);
      expect(parse(JSON.stringify({ ink, v: 2 })).ink).toBe(ink);
    }
    // since 86 the pen is one chosen
    expect(parse(JSON.stringify({ ink: 'pen', v: 2 })).ink).toBe('pen');
    expect(parse(JSON.stringify({ ink: 'brush', v: 2 })).ink).toBe('monoline');
    // the shape is the store's, none of what is chosen
    expect('v' in parse(JSON.stringify({ ...DEFAULTS, v: 2 }))).toBe(false);
    expect(parse(JSON.stringify({ ...DEFAULTS, v: 2 }))).toEqual(DEFAULTS);
  });

  it('read back, each thing is held to what it can be: a width, an opacity, a colour among good ones, the last few colours', () => {
    const k = parse(JSON.stringify({
      tool: 'eraser', last: 'select',
      widths: { pen: [0.01, 2.26, 40], highlighter: [1, 16, 99], eraser: [8, 16, 28] },
      colors: { pen: ['#ABCDEF', 'navy', null, '#010203'], highlighter: ['#111111'] },
      recent: { pen: ['#AAAAAA', 'x', '#aaaaaa', '#bbbbbb', 3], highlighter: Array.from({ length: 12 }, (_, i) => `#0000${String(i).padStart(2, '0')}`) },
      opacity: 0.01, eraser: 'part', snap: false, shown: false,
    }));
    expect([k.tool, k.last]).toEqual(['eraser', 'select']);
    expect(k.widths).toEqual({ pen: [0.5, 2.3, 8], highlighter: [6, 16, 40], eraser: [8, 16, 28] });
    expect(k.colors.pen).toEqual(['#abcdef', '#1d4fb8', '#c5281c', '#010203']);
    expect(k.colors.highlighter).toEqual(['#111111', '#86e08a', '#ff8fc0', '#7cc4ff']);
    expect(k.recent.pen).toEqual(['#aaaaaa', '#bbbbbb']);
    expect(k.recent.highlighter).toHaveLength(RECENT);
    expect(k.recent.highlighter[0]).toBe('#000000');
    expect(k.opacity).toBe(0.2);
    expect(parse(JSON.stringify({ opacity: 4 })).opacity).toBe(1);
    expect(parse(JSON.stringify({ opacity: 0.333 })).opacity).toBe(0.33);
    expect([k.eraser, k.snap, k.shown]).toEqual(['part', false, false]);
    // the wheel's swatch in use with no colour kept for it is the first again
    expect(parse(JSON.stringify({ swatch: { pen: CUSTOM } })).swatch.pen).toBe(0);
  });
});

describe('kept per device', () => {
  it('survives a reload: the tool, each size and colour, the wheel\'s colours, the finger', async () => {
    const a = await launch();
    a.tools.setTool('highlighter');
    a.tools.setSize('highlighter', 2);
    a.tools.setSwatch('highlighter', 2);
    a.tools.setSize('pen', 0);
    a.tools.setSwatch('pen', 1);
    a.tools.setSize('eraser', 2);
    a.tools.setFinger(true);
    answers.ink_color = () => ({ color: '#0a7f6b' });
    await a.tools.pickColor('highlighter', { x: 0, y: 0, w: 40, h: 44 });
    const was = a.tools.useInkTools.getState().kept;
    expect(JSON.parse(localStorage.getItem('ilmi.ink')!)).toEqual({ ...was, v: 2 });

    const b = await launch();
    expect(b.tools.useInkTools).not.toBe(a.tools.useInkTools);
    expect(b.tools.useInkTools.getState().kept).toEqual(was);
    expect(b.tools.toolOf(b.tools.useInkTools.getState().kept)).toEqual({ kind: 'highlighter', color: '#0a7f6b', width: 24, opacity: 1, snap: true });
    // and nothing of what can be undone is carried over: that is the canvases' to say
    expect(b.tools.useInkTools.getState()).toMatchObject({ undo: false, redo: false, picking: null, open: null, caps: null });
  });

  it('and so do a size made thicker, a swatch replaced, the ink, the opacity, the eraser\'s way, the shape and the row tucked away; settings left open do not', async () => {
    const a = await launch();
    a.tools.setWidth('pen', 4.4);
    a.tools.setInk('pencil');
    a.tools.setOpacity(0.45);
    a.tools.setEraser('part');
    a.tools.setSnap(false);
    answers.ink_color = () => ({ color: '#884422' });
    await a.tools.pickColor('pen', { x: 0, y: 0, w: 40, h: 44 }, 3);
    a.tools.setTool('eraser');
    a.tools.setOpen('eraser');
    a.tools.setShown(false);
    const was = a.tools.useInkTools.getState().kept;
    expect(was).toMatchObject({ tool: 'eraser', last: 'pen', ink: 'pencil', opacity: 0.45, eraser: 'part', snap: false, shown: false, recent: { pen: ['#884422'] } });
    expect(was.widths.pen).toEqual([1.2, 4.4, 3.6]);
    expect(was.colors.pen).toEqual(['#1c1c1e', '#1d4fb8', '#c5281c', '#884422']);
    expect(JSON.parse(localStorage.getItem('ilmi.ink')!)).toEqual({ ...was, v: 2 });

    const b = await launch();
    expect(b.tools.useInkTools.getState().kept).toEqual(was);
    expect(b.tools.useInkTools.getState().open).toBeNull();
    expect(b.tools.toolOf(b.tools.withTool(b.tools.useInkTools.getState().kept, 'pen'))).toEqual({ kind: 'pen', color: '#884422', width: 4.4, ink: 'pencil', snap: false });
  });
  it('what is kept says its shape, so the soft pen chosen stays the pen; kept before that, it is the even line, and says so once anything is chosen', async () => {
    const a = await launch();
    expect(a.tools.useInkTools.getState().kept.ink).toBe('monoline');
    // nothing is kept until something is chosen
    expect(localStorage.getItem('ilmi.ink')).toBeNull();
    a.tools.setInk('pen');
    expect(JSON.parse(localStorage.getItem('ilmi.ink')!)).toMatchObject({ ink: 'pen', v: 2 });
    const b = await launch();
    expect(b.tools.useInkTools.getState().kept.ink).toBe('pen');
    expect(b.tools.toolOf(b.tools.useInkTools.getState().kept)).toEqual({ ...PEN, ink: 'pen' });

    // a device's from before: the rest of it as it was, the pen the even line
    const { v: _v, ...old } = JSON.parse(localStorage.getItem('ilmi.ink')!) as Record<string, unknown>;
    localStorage.setItem('ilmi.ink', JSON.stringify({ ...old, tool: 'highlighter', finger: true }));
    const c = await launch();
    expect(c.tools.useInkTools.getState().kept).toMatchObject({ tool: 'highlighter', finger: true, ink: 'monoline' });
    // read alone it is not written back; the next thing chosen is
    expect('v' in JSON.parse(localStorage.getItem('ilmi.ink')!)).toBe(false);
    c.tools.setTool('pen');
    expect(JSON.parse(localStorage.getItem('ilmi.ink')!)).toMatchObject({ tool: 'pen', ink: 'monoline', v: 2 });
    // and from then on the soft pen can be chosen and stays
    c.tools.setInk('pen');
    const d = await launch();
    expect(d.tools.useInkTools.getState().kept.ink).toBe('pen');
  });
});

describe('what the canvases are told', () => {
  it('the tool and the finger once the canvases first exist, and not again for a later scene', async () => {
    const a = await launch();
    expect(calls).toEqual([]);
    await a.scene();
    expect(calls.map((c) => c.cmd)).toEqual(['ink_scene', 'ink_tool', 'ink_finger', 'ink_caps']);
    expect(said('ink_tool')).toEqual([{ tool: PEN }]);
    expect(said('ink_finger')).toEqual([{ on: false }]);
    await a.scene();
    a.ink.sceneSoon();
    await wait();
    expect(said('ink_tool').length).toBe(1);
    expect(said('ink_finger').length).toBe(1);
    expect(said('ink_caps')).toEqual([{}]);
  });

  it('after a web reload, what was chosen before it', async () => {
    const a = await launch();
    a.tools.setTool('eraser');
    a.tools.setSize('eraser', 0);
    a.tools.setFinger(true);
    calls.length = 0;
    const b = await launch();
    await b.scene();
    expect(said('ink_tool')).toEqual([{ tool: { kind: 'eraser', color: '#000000', width: 8, mode: 'stroke' } }]);
    expect(said('ink_finger')).toEqual([{ on: true }]);
  });

  it('each telling of the tool is numbered after the one before, so that one arrived late can be told from the last', async () => {
    const a = await launch();
    await a.scene();
    const from = seqs.length;
    a.tools.setTool('highlighter');
    a.tools.setSize('highlighter', 0);
    a.tools.setTool('pen');
    await wait();
    const mine = seqs.slice(from);
    expect(mine.length).toBeGreaterThanOrEqual(3);
    expect(mine.every((n, i) => i === 0 || n === mine[i - 1]! + 1)).toBe(true);
  });

  it('the tool on each change of it, its size or its colour, and only then', async () => {
    const a = await launch();
    await a.scene();
    calls.length = 0;
    a.tools.setTool('highlighter');
    a.tools.setSize('highlighter', 0);
    a.tools.setSwatch('highlighter', 2);
    a.tools.setTool('select');
    a.tools.setTool('pen');
    a.tools.setSwatch('pen', 1);
    expect(calls).toEqual([
      { cmd: 'ink_tool', args: { tool: { kind: 'highlighter', color: '#ffe03a', width: 16, opacity: 1, snap: true } } },
      { cmd: 'ink_tool', args: { tool: { kind: 'highlighter', color: '#ffe03a', width: 10, opacity: 1, snap: true } } },
      { cmd: 'ink_tool', args: { tool: { kind: 'highlighter', color: '#ff8fc0', width: 10, opacity: 1, snap: true } } },
      { cmd: 'ink_tool', args: { tool: { kind: 'select', color: '#000000', width: 0 } } },
      { cmd: 'ink_tool', args: { tool: PEN } },
      { cmd: 'ink_tool', args: { tool: { ...PEN, color: '#1d4fb8' } } },
    ]);
    calls.length = 0;
    // the same again, and another tool's size: the tool in use is as it was
    a.tools.setTool('pen');
    a.tools.setSwatch('pen', 1);
    a.tools.setSize('eraser', 2);
    a.tools.setSwatch('highlighter', 0);
    expect(calls).toEqual([]);
  });

  it('the pen\'s ink and width, the highlighter\'s opacity, the eraser\'s way, the shape: each with the tool it is of, and not while another is held', async () => {
    const a = await launch();
    await a.scene();
    calls.length = 0;
    const tools = () => said('ink_tool').map((t) => t.tool);
    a.tools.setInk('fountain');
    a.tools.setSnap(false);
    a.tools.setWidth('pen', 5.04);
    expect(tools()).toEqual([{ ...PEN, ink: 'fountain' }, { ...PEN, ink: 'fountain', snap: false }, { ...PEN, ink: 'fountain', snap: false, width: 5 }]);
    calls.length = 0;
    // another tool's: kept, and nothing said
    a.tools.setOpacity(0.5);
    a.tools.setEraser('part');
    a.tools.setWidth('eraser', 20);
    expect(calls).toEqual([]);
    a.tools.setTool('highlighter');
    a.tools.setInk('pencil');
    a.tools.setOpacity(0.8);
    expect(tools()).toEqual([{ kind: 'highlighter', color: '#ffe03a', width: 16, opacity: 0.5, snap: false }, { kind: 'highlighter', color: '#ffe03a', width: 16, opacity: 0.8, snap: false }]);
    calls.length = 0;
    a.tools.setTool('eraser');
    a.tools.setSnap(true);
    a.tools.setEraser('stroke');
    expect(tools()).toEqual([{ kind: 'eraser', color: '#000000', width: 20, mode: 'part' }, { kind: 'eraser', color: '#000000', width: 20, mode: 'stroke' }]);
    calls.length = 0;
    a.tools.setTool('pen');
    // the same again: nothing
    a.tools.setInk('pencil');
    a.tools.setWidth('pen', 5);
    a.tools.setSnap(true);
    // thicker than a pen can be: as thick as it can
    a.tools.setWidth('pen', 99);
    expect(tools()).toEqual([{ ...PEN, ink: 'pencil', width: 5 }, { ...PEN, ink: 'pencil', width: 8 }]);
    expect(calls.every((c) => c.cmd === 'ink_tool')).toBe(true);
  });

  it('the finger when it is turned on and off', async () => {
    const a = await launch();
    await a.scene();
    calls.length = 0;
    a.tools.setFinger(true);
    a.tools.setFinger(true);
    a.tools.setFinger(false);
    expect(calls).toEqual([{ cmd: 'ink_finger', args: { on: true } }, { cmd: 'ink_finger', args: { on: false } }]);
  });

  it('a finger draws only while the row is shown: tucked away it scrolls, and draws again when the row is back', async () => {
    const a = await launch();
    await a.scene();
    a.tools.setFinger(true);
    calls.length = 0;
    a.tools.setShown(false);
    expect(calls).toEqual([{ cmd: 'ink_finger', args: { on: false } }]);
    // turned off and on while tucked: kept, and nothing to say
    a.tools.setFinger(false);
    a.tools.setFinger(true);
    a.tools.setShown(false);
    expect(calls.length).toBe(1);
    expect(a.tools.useInkTools.getState().kept).toMatchObject({ finger: true, shown: false });
    a.tools.setShown(true);
    expect(calls).toEqual([{ cmd: 'ink_finger', args: { on: false } }, { cmd: 'ink_finger', args: { on: true } }]);
    // with no finger drawing, tucking says nothing at all: the Pencil writes as it did
    a.tools.setFinger(false);
    calls.length = 0;
    a.tools.setShown(false);
    a.tools.setShown(true);
    expect(calls).toEqual([]);
    // launched tucked with a finger kept on: the canvases are told it is off
    a.tools.setFinger(true);
    a.tools.setShown(false);
    calls.length = 0;
    const b = await launch();
    await b.scene();
    expect(said('ink_finger')).toEqual([{ on: false }]);
    expect(said('ink_tool')).toEqual([{ tool: PEN }]);
  });

  it('what inks the device has is asked once, and the tool said again by it: a width it does not take is the nearest it does', async () => {
    const a = await launch();
    a.tools.setSize('pen', 2);
    a.tools.setWidth('pen', 8);
    calls.length = 0;
    answers.ink_caps = () => ({ inks: { pen: [0.88, 5.04], monoline: [0.5, 2.85], pencil: [2.4, 16], marker: [9.64, 60], fountain: [3, 3], crayon: 'wide' }, squeeze: true });
    const b = await launch();
    await b.scene();
    expect(calls.map((c) => c.cmd)).toEqual(['ink_scene', 'ink_tool', 'ink_finger', 'ink_caps', 'ink_tool']);
    // (the even line the pen starts as takes 0.5 to 2.85 here)
    expect(said('ink_tool').map((t) => (t.tool as { width: number }).width)).toEqual([8, 2.8]);
    // what it said that is no range is left out
    expect(b.tools.useInkTools.getState().caps).toEqual({ inks: { pen: [0.88, 5.04], monoline: [0.5, 2.85], pencil: [2.4, 16], marker: [9.64, 60] }, squeeze: true });
    expect(b.tools.inksHere(b.tools.useInkTools.getState().caps).map((i) => i.ink)).toEqual(['pen', 'monoline', 'pencil']);
    // what is kept is the width that was chosen
    expect(b.tools.useInkTools.getState().kept.widths.pen).toEqual([1.2, 2.2, 8]);
    calls.length = 0;
    b.tools.setInk('pencil');
    b.tools.setSize('pen', 0);
    b.tools.setInk('monoline');
    b.tools.setSize('pen', 2);
    b.tools.setTool('highlighter');
    b.tools.setWidth('highlighter', 6);
    expect(said('ink_tool').map((t) => { const tool = t.tool as { ink?: string; width: number }; return [tool.ink, tool.width]; })).toEqual([['pencil', 8], ['pencil', 2.4], ['monoline', 1.2], ['monoline', 2.8], [undefined, 16], [undefined, 9.7]]);
    // not asked again, by a later scene or anything else
    await b.scene();
    b.tools.canvasesReady();
    await wait();
    expect(said('ink_caps')).toEqual([]);
  });

  it('an ink kept that this device has not is the pen, once it has said so', async () => {
    const a = await launch();
    a.tools.setInk('fountain');
    calls.length = 0;
    answers.ink_caps = () => ({ inks: { pen: [0.5, 25], pencil: [1, 16], marker: [5, 60] } });
    const b = await launch();
    expect(b.tools.useInkTools.getState().kept.ink).toBe('fountain');
    await b.scene();
    expect(said('ink_tool').map((t) => (t.tool as { ink: string }).ink)).toEqual(['fountain', 'pen', 'pen']);
    expect(b.tools.useInkTools.getState().kept.ink).toBe('pen');
    expect(JSON.parse(localStorage.getItem('ilmi.ink')!).ink).toBe('pen');
    expect(b.tools.useInkTools.getState().caps).toEqual({ inks: { pen: [0.5, 25], pencil: [1, 16], marker: [5, 60] }, squeeze: false });
  });

  it('a device that says nothing of its inks, or fails to, leaves every ink there and the tool as it was', async () => {
    const a = await launch();
    a.tools.setInk('fountain');
    calls.length = 0;
    answers.ink_caps = () => { throw new Error('no such command'); };
    const b = await launch();
    await b.scene();
    expect(b.tools.useInkTools.getState().caps).toBeNull();
    expect(b.tools.useInkTools.getState().kept.ink).toBe('fountain');
    expect(said('ink_tool')).toEqual([{ tool: { ...PEN, ink: 'fountain' } }]);
    answers.ink_caps = () => ({ squeeze: true });
    calls.length = 0;
    const c = await launch();
    await c.scene();
    expect(c.tools.useInkTools.getState().caps).toBeNull();
    expect(said('ink_tool').length).toBe(1);
    expect(c.tools.inksHere(c.tools.useInkTools.getState().caps)).toHaveLength(4);
  });

  it('the Pencil tapped twice: to the eraser and back, or as the system\'s setting says', async () => {
    const a = await launch();
    await a.scene();
    a.tools.setTool('highlighter');
    calls.length = 0;
    const tool = () => a.tools.useInkTools.getState().kept.tool;
    pencil({ kind: 'pencil', what: 'tap', prefer: 'eraser' });
    expect(tool()).toBe('eraser');
    pencil({ kind: 'pencil', what: 'tap', prefer: 'eraser' });
    expect(tool()).toBe('highlighter');
    // with no setting said, the same
    pencil({ kind: 'pencil', what: 'tap' });
    expect(tool()).toBe('eraser');
    pencil({ kind: 'pencil', what: 'tap', prefer: 'previous' });
    expect(tool()).toBe('highlighter');
    pencil({ kind: 'pencil', what: 'tap', prefer: 'previous' });
    expect(tool()).toBe('eraser');
    expect(said('ink_tool').map((t) => (t.tool as { kind: string }).kind)).toEqual(['eraser', 'highlighter', 'eraser', 'highlighter', 'eraser']);
    expect(JSON.parse(localStorage.getItem('ilmi.ink')!)).toMatchObject({ tool: 'eraser', last: 'highlighter' });
    calls.length = 0;
    pencil({ kind: 'pencil', what: 'tap', prefer: 'ignore' });
    expect(tool()).toBe('eraser');
    expect(calls).toEqual([]);
  });

  it('the Pencil squeezed opens the held tool\'s settings and closes them again, the row brought back for them; select has none', async () => {
    const a = await launch();
    await a.scene();
    a.tools.setFinger(true);
    const now = () => { const s = a.tools.useInkTools.getState(); return [s.open, s.kept.shown]; };
    pencil({ kind: 'pencil', what: 'squeeze', prefer: 'eraser' });
    expect(now()).toEqual(['pen', true]);
    // the tool is the one held: a squeeze is no tap
    expect(a.tools.useInkTools.getState().kept.tool).toBe('pen');
    pencil({ kind: 'pencil', what: 'squeeze' });
    expect(now()).toEqual([null, true]);
    // tucked away: the row is shown again, and a finger draws again with it
    a.tools.setShown(false);
    calls.length = 0;
    pencil({ kind: 'pencil', what: 'squeeze' });
    expect(now()).toEqual(['pen', true]);
    expect(calls).toEqual([{ cmd: 'ink_finger', args: { on: true } }]);
    expect(JSON.parse(localStorage.getItem('ilmi.ink')!).shown).toBe(true);
    // tucked away again, its settings close
    a.tools.setShown(false);
    expect(now()).toEqual([null, false]);
    a.tools.setTool('select');
    pencil({ kind: 'pencil', what: 'squeeze' });
    expect(now()).toEqual([null, true]);
    a.tools.setTool('eraser');
    pencil({ kind: 'pencil', what: 'squeeze' });
    expect(now()).toEqual(['eraser', true]);
    // the Pencil writing closes them
    pencil({ kind: 'begin', sheet: 'p.x.1', host: 'pages:x' });
    expect(now()).toEqual([null, true]);
  });

  it('undo and redo, and what can be taken back is what they answer and what the canvases say meanwhile', async () => {
    const a = await launch();
    await a.scene();
    calls.length = 0;
    const now = () => { const s = a.tools.useInkTools.getState(); return [s.undo, s.redo]; };
    expect(now()).toEqual([false, false]);
    // a stroke was written
    pencil({ kind: 'history', undo: true, redo: false });
    expect(now()).toEqual([true, false]);
    answers.ink_undo = () => ({ undo: false, redo: true });
    await a.tools.undo();
    expect(now()).toEqual([false, true]);
    answers.ink_redo = () => ({ undo: true, redo: false });
    await a.tools.redo();
    expect(now()).toEqual([true, false]);
    expect(calls).toEqual([{ cmd: 'ink_undo', args: {} }, { cmd: 'ink_redo', args: {} }]);
    // a failure leaves it as it was
    answers.ink_undo = () => { throw new Error('no canvas'); };
    const err = vi.spyOn(console, 'error').mockImplementation(() => {});
    await a.tools.undo();
    err.mockRestore();
    expect(now()).toEqual([true, false]);
    pencil({ kind: 'history', undo: false, redo: false });
    expect(now()).toEqual([false, false]);
  });

  it('the colour wheel: asked from its swatch with the colour in use, live while it turns, and kept when it closes', async () => {
    const a = await launch();
    await a.scene();
    a.tools.setSwatch('pen', 2);
    calls.length = 0;
    let close: (v: { color: string | null }) => void = () => {};
    answers.ink_color = () => new Promise((r) => { close = r; });
    const at = { x: 300, y: 50, w: 40, h: 44 };
    const done = a.tools.pickColor('pen', at);
    await wait();
    expect(calls).toEqual([{ cmd: 'ink_color', args: { color: '#c5281c', at } }]);
    expect(a.tools.useInkTools.getState().picking).toEqual({ tool: 'pen', slot: CUSTOM });
    // a second wheel is not opened over the first
    await a.tools.pickColor('pen', at);
    await a.tools.pickColor('highlighter', at, 0);
    expect(said('ink_color').length).toBe(1);
    pencil({ kind: 'color', color: '#336699' });
    expect(a.tools.useInkTools.getState().kept.custom.pen).toBe('#336699');
    expect(a.tools.useInkTools.getState().kept.swatch.pen).toBe(CUSTOM);
    expect(said('ink_tool').at(-1)).toEqual({ tool: { ...PEN, color: '#336699' } });
    pencil({ kind: 'color', color: '#3366aa' });
    // a colour passed over as the wheel turns is not one lately used
    expect(a.tools.useInkTools.getState().kept.recent.pen).toEqual([]);
    close({ color: '#3366AB' });
    await done;
    const k = a.tools.useInkTools.getState().kept;
    expect(k.custom).toEqual({ pen: '#3366ab', highlighter: null });
    expect(k.swatch.pen).toBe(CUSTOM);
    expect(k.recent).toEqual({ pen: ['#3366ab'], highlighter: [] });
    // the four are as they were
    expect(k.colors).toEqual(DEFAULTS.colors);
    expect(a.tools.useInkTools.getState().picking).toBeNull();
    expect(said('ink_tool').map((t) => (t.tool as { color: string }).color)).toEqual(['#336699', '#3366aa', '#3366ab']);
    expect(JSON.parse(localStorage.getItem('ilmi.ink')!).custom.pen).toBe('#3366ab');
    // a colour said with no wheel up is no one's
    pencil({ kind: 'color', color: '#000001' });
    expect(a.tools.useInkTools.getState().kept).toBe(k);
  });

  it('the colour wheel for one of the four: asked with that swatch\'s colour, which it replaces, live and when it closes', async () => {
    const a = await launch();
    await a.scene();
    calls.length = 0;
    let close: (v: { color: string | null }) => void = () => {};
    answers.ink_color = () => new Promise((r) => { close = r; });
    const at = { x: 120, y: 50, w: 40, h: 44 };
    // the blue one, while black is in use
    const done = a.tools.pickColor('pen', at, 1);
    await wait();
    expect(calls).toEqual([{ cmd: 'ink_color', args: { color: '#1d4fb8', at } }]);
    expect(a.tools.useInkTools.getState().picking).toEqual({ tool: 'pen', slot: 1 });
    pencil({ kind: 'color', color: '#336699' });
    expect(a.tools.useInkTools.getState().kept.colors.pen).toEqual(['#1c1c1e', '#336699', '#c5281c', '#1e7a46']);
    expect(a.tools.useInkTools.getState().kept.swatch.pen).toBe(1);
    expect(said('ink_tool').at(-1)).toEqual({ tool: { ...PEN, color: '#336699' } });
    close({ color: '#884422' });
    await done;
    const k = a.tools.useInkTools.getState().kept;
    expect(k.colors.pen).toEqual(['#1c1c1e', '#884422', '#c5281c', '#1e7a46']);
    expect(k.swatch.pen).toBe(1);
    expect(k.custom.pen).toBeNull();
    expect(k.recent.pen).toEqual(['#884422']);
    expect(k.colors.highlighter).toEqual(DEFAULTS.colors.highlighter);
    expect(JSON.parse(localStorage.getItem('ilmi.ink')!).colors.pen[1]).toBe('#884422');
    // closed with none chosen: the swatch, and the one in use, are as they were before it opened
    a.tools.setSwatch('pen', 0);
    const was = a.tools.useInkTools.getState().kept;
    answers.ink_color = () => new Promise((r) => { close = r; });
    const again = a.tools.pickColor('pen', at, 2);
    await wait();
    pencil({ kind: 'color', color: '#00ff00' });
    expect(colorOf(a.tools.useInkTools.getState().kept, 'pen')).toBe('#00ff00');
    close({ color: null });
    await again;
    expect(a.tools.useInkTools.getState().kept).toEqual(was);
    expect(said('ink_tool').at(-1)).toEqual({ tool: PEN });
    // one of the colours lately used, taken again: the tool's own swatch, with no wheel
    calls.length = 0;
    a.tools.setRecent('pen', '#884422');
    expect(a.tools.useInkTools.getState().kept).toMatchObject({ custom: { pen: '#884422' }, swatch: { pen: CUSTOM } });
    expect(calls).toEqual([{ cmd: 'ink_tool', args: { tool: { ...PEN, color: '#884422' } } }]);
  });

  it('the colour wheel closed with none chosen leaves everything as it was', async () => {
    const a = await launch();
    await a.scene();
    a.tools.setSwatch('pen', 3);
    const was = a.tools.useInkTools.getState().kept;
    let close: (v: { color: string | null }) => void = () => {};
    answers.ink_color = () => new Promise((r) => { close = r; });
    const done = a.tools.pickColor('pen', { x: 0, y: 0, w: 40, h: 44 });
    await wait();
    pencil({ kind: 'color', color: '#336699' });
    expect(a.tools.useInkTools.getState().kept.custom.pen).toBe('#336699');
    close({ color: null });
    await done;
    expect(a.tools.useInkTools.getState().kept).toEqual(was);
    expect(a.tools.useInkTools.getState().picking).toBeNull();
    expect(JSON.parse(localStorage.getItem('ilmi.ink')!)).toEqual({ ...was, v: 2 });
    // and the canvases have the colour that was in use again
    expect(said('ink_tool').at(-1)).toEqual({ tool: { ...PEN, color: '#1e7a46' } });
    // one chosen before stays that tool's own when a later wheel is closed with none
    answers.ink_color = () => ({ color: '#101010' });
    await a.tools.pickColor('pen', { x: 0, y: 0, w: 40, h: 44 });
    answers.ink_color = () => ({ color: null });
    await a.tools.pickColor('pen', { x: 0, y: 0, w: 40, h: 44 });
    expect(a.tools.useInkTools.getState().kept.custom.pen).toBe('#101010');
    expect(a.tools.useInkTools.getState().kept.swatch.pen).toBe(CUSTOM);
    // a wheel that fails is one closed with none
    answers.ink_color = () => { throw new Error('no wheel'); };
    const err = vi.spyOn(console, 'error').mockImplementation(() => {});
    await a.tools.pickColor('pen', { x: 0, y: 0, w: 40, h: 44 }, 0);
    err.mockRestore();
    expect(a.tools.useInkTools.getState().picking).toBeNull();
    expect(a.tools.useInkTools.getState().kept.colors.pen).toEqual(DEFAULTS.colors.pen);
    expect(a.tools.useInkTools.getState().kept.swatch.pen).toBe(CUSTOM);
  });

  it('nothing at all where there is no canvas', async () => {
    const a = await launch({ mobile: false });
    await a.scene();
    a.tools.setTool('highlighter');
    a.tools.setSize('highlighter', 2);
    a.tools.setSwatch('highlighter', 1);
    a.tools.setFinger(true);
    a.tools.setWidth('highlighter', 30);
    a.tools.setOpacity(0.5);
    a.tools.setInk('pencil');
    a.tools.setEraser('part');
    a.tools.setSnap(false);
    a.tools.setShown(false);
    await a.tools.undo();
    await a.tools.redo();
    await a.tools.pickColor('highlighter', { x: 0, y: 0, w: 40, h: 44 });
    await a.tools.pickColor('highlighter', { x: 0, y: 0, w: 40, h: 44 }, 1);
    a.tools.canvasesReady();
    await wait();
    expect(calls).toEqual([]);
    expect(a.tools.useInkTools.getState().caps).toBeNull();
    // what was chosen is still chosen, and kept
    expect(a.tools.useInkTools.getState().kept).toMatchObject({ tool: 'highlighter', finger: true, opacity: 0.5, ink: 'pencil', eraser: 'part', snap: false, shown: false });
    expect(JSON.parse(localStorage.getItem('ilmi.ink')!).tool).toBe('highlighter');
  });

  it('where a tool\'s settings lie, and a menu, is no place to write: the scene says them, and that they are gone', async () => {
    const a = await launch();
    await a.scene();
    const holes = () => (said('ink_scene').at(-1)!.scene as { holes: unknown[] }).holes;
    expect(holes()).toEqual([]);
    const over = document.body.appendChild(document.createElement('div'));
    over.className = 'ink-pop';
    over.setAttribute('data-ink-over', '');
    // something laid over that has no size is no hole
    const bare = document.body.appendChild(document.createElement('div'));
    bare.setAttribute('data-ink-over', '');
    a.ink.sceneSoon();
    await wait();
    expect(holes()).toEqual([POP]);
    const menu = document.body.appendChild(document.createElement('div'));
    menu.className = 'pop-menu';
    a.ink.sceneSoon();
    await wait();
    expect(holes()).toEqual([POP, POP]);
    over.remove();
    bare.remove();
    menu.remove();
    const scenes = said('ink_scene').length;
    a.ink.sceneSoon();
    await wait();
    expect(holes()).toEqual([]);
    expect(said('ink_scene').length).toBe(scenes + 1);
    // nothing changed: nothing said
    a.ink.sceneSoon();
    await wait();
    expect(said('ink_scene').length).toBe(scenes + 1);
  });
});

describe('the row of tools', () => {
  let host: HTMLDivElement;
  let root: Root | null = null;
  const show = async (a: Awaited<ReturnType<typeof launch>>, fixed = false) => {
    host = document.body.appendChild(document.createElement('div'));
    root = createRoot(host);
    await act(async () => { root!.render(createElement(Fragment, null, createElement(a.InkToggle), createElement(a.InkBar, { id: 'library/book.pdf', fixed }))); });
  };
  const press = (sel: string) => act(async () => { host.querySelector<HTMLElement>(sel)!.click(); await wait(); });
  const labels = (sel: string) => Array.from(host.querySelectorAll<HTMLElement>(sel)).map((b) => b.getAttribute('aria-label'));
  const lit = (sel: string) => Array.from(host.querySelectorAll<HTMLElement>(`${sel}[aria-pressed="true"]`)).map((b) => b.getAttribute('aria-label'));
  /** The settings open under the row (drawn in the body, not in the row). */
  const pop = () => document.querySelector<HTMLElement>('.ink-pop');
  const inPop = <T extends HTMLElement>(sel: string) => Array.from(document.querySelectorAll<T>(`.ink-pop ${sel}`));
  const pressPop = (sel: string) => act(async () => { inPop(sel)[0]!.click(); await wait(); });
  const slide = (which: 'width' | 'opacity', v: number) => act(async () => {
    const el = inPop<HTMLInputElement>(`[data-ink-range="${which}"]`)[0]!;
    Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value')!.set!.call(el, String(v));
    el.dispatchEvent(new Event('input', { bubbles: true }));
    await wait();
  });
  const down = (el: Element) => act(async () => { el.dispatchEvent(new PointerEvent('pointerdown', { bubbles: true, cancelable: true })); await wait(); });
  const resized = (w: number) => act(async () => { barW = w; for (const f of [...watchers]) f(); });
  const fit = () => host.querySelector<HTMLElement>('.inkbar')!.dataset.fit;
  afterEach(() => { if (root) act(() => root!.unmount()); root = null; host?.remove(); });

  it('is an iPad\'s: not a Mac\'s, not a phone\'s', async () => {
    await show(await launch({ mobile: false }));
    expect(host.querySelector('.inkbar')).toBeNull();
    act(() => root!.unmount());
    host.remove();
    await show(await launch({ mobile: true, phone: true }));
    expect(host.querySelector('.inkbar')).toBeNull();
    act(() => root!.unmount());
    host.remove();
    await show(await launch({ mobile: true }));
    expect(host.querySelector('.inkbar')).not.toBeNull();
    expect(host.querySelector('.inkbar')!.getAttribute('role')).toBe('toolbar');
  });

  it('has the four tools with the chosen one lit, the pen\'s sizes and colours, and nothing to take back yet', async () => {
    await show(await launch());
    expect(labels('.ib-tools button')).toEqual(['pen', 'highlighter', 'eraser', 'select']);
    expect(lit('.ib-tools button')).toEqual(['pen']);
    expect(labels('.ib-sizes button')).toEqual(['thin', 'medium', 'thick']);
    expect(lit('.ib-sizes button')).toEqual(['medium']);
    expect(labels('.ib-swatches button')).toEqual(['black', 'blue', 'red', 'green', 'colours']);
    expect(lit('.ib-swatches button')).toEqual(['black']);
    expect(labels('.ib-history button')).toEqual(['undo', 'redo']);
    expect(labels('.ib-ends button')).toEqual(['draw with finger', 'hide tools']);
    expect(host.querySelector<HTMLButtonElement>('[aria-label="undo"]')!.disabled).toBe(true);
    expect(host.querySelector<HTMLButtonElement>('[aria-label="redo"]')!.disabled).toBe(true);
    expect(host.querySelector('[aria-label="draw with finger"]')!.getAttribute('aria-pressed')).toBe('false');
    // every target says what it is in plain lowercase words, as its title too; no key caps, no characters for icons
    for (const b of Array.from(host.querySelectorAll('button'))) {
      const label = b.getAttribute('aria-label')!;
      expect(label).toMatch(/^[a-z ]+$/);
      expect(b.getAttribute('title')).toBe(label);
      expect(b.textContent).toBe('');
    }
    expect(host.querySelector('kbd, .kbd')).toBeNull();
    // a colour is itself whatever the theme
    expect(host.querySelector<HTMLElement>('[aria-label="blue"] .ib-dot')!.style.background).toBe('rgb(29, 79, 184)');
    // a tool with settings says so; select has none; nothing is open
    expect(Array.from(host.querySelectorAll('.ib-tools button')).map((b) => [b.getAttribute('aria-haspopup'), b.getAttribute('aria-expanded')])).toEqual([['dialog', 'false'], ['dialog', 'false'], ['dialog', 'false'], [null, null]]);
    expect(pop()).toBeNull();
    // and while the row is shown there is no button to show it
    expect(host.querySelector('[data-tool="ink-tools"]')).toBeNull();
  });

  it('shows the chosen tool\'s own sizes and colours: none of either for select, no colours for the eraser', async () => {
    const a = await launch();
    await show(a);
    await press('[aria-label="highlighter"]');
    expect(lit('.ib-tools button')).toEqual(['highlighter']);
    expect(labels('.ib-sizes button')).toEqual(['thin', 'medium', 'thick']);
    expect(labels('.ib-swatches button')).toEqual(['yellow', 'green', 'pink', 'blue', 'colours']);
    await press('[aria-label="thick"]');
    await press('[aria-label="pink"]');
    expect(lit('.ib-sizes button')).toEqual(['thick']);
    expect(lit('.ib-swatches button')).toEqual(['pink']);
    expect(a.tools.toolOf(a.tools.useInkTools.getState().kept)).toEqual({ kind: 'highlighter', color: '#ff8fc0', width: 24, opacity: 1, snap: true });
    await press('[aria-label="eraser"]');
    expect(labels('.ib-sizes button')).toEqual(['thin', 'medium', 'thick']);
    expect(host.querySelector('.ib-swatches')).toBeNull();
    await press('[aria-label="select"]');
    expect(lit('.ib-tools button')).toEqual(['select']);
    expect(host.querySelector('.ib-sizes')).toBeNull();
    expect(host.querySelector('.ib-swatches')).toBeNull();
    // the pen is as it was left
    await press('[aria-label="pen"]');
    expect(lit('.ib-sizes button')).toEqual(['medium']);
    expect(lit('.ib-swatches button')).toEqual(['black']);
    // each tool was pressed once: no settings opened
    expect(a.tools.useInkTools.getState().open).toBeNull();
  });

  it('undo and redo are there to press when there is something, and the finger lights when on', async () => {
    const a = await launch();
    await a.scene();
    await show(a);
    await act(async () => { pencil({ kind: 'history', undo: true, redo: false }); });
    const undo = host.querySelector<HTMLButtonElement>('[aria-label="undo"]')!;
    const redo = host.querySelector<HTMLButtonElement>('[aria-label="redo"]')!;
    expect([undo.disabled, redo.disabled]).toEqual([false, true]);
    answers.ink_undo = () => ({ undo: false, redo: true });
    calls.length = 0;
    await press('[aria-label="undo"]');
    expect(calls.map((c) => c.cmd)).toEqual(['ink_undo']);
    expect([undo.disabled, redo.disabled]).toEqual([true, false]);
    answers.ink_redo = () => ({ undo: true, redo: false });
    await press('[aria-label="redo"]');
    expect([undo.disabled, redo.disabled]).toEqual([false, true]);
    await press('[aria-label="draw with finger"]');
    expect(host.querySelector('[aria-label="draw with finger"]')!.getAttribute('aria-pressed')).toBe('true');
    expect(said('ink_finger')).toEqual([{ on: true }]);
  });

  it('the wheel\'s swatch opens the wheel from where it is, becomes the colour chosen, and is pressed again to change it', async () => {
    const a = await launch();
    await a.scene();
    await show(a);
    const wheel = () => host.querySelector<HTMLElement>('[aria-label="colours"]')!;
    wheel().getBoundingClientRect = () => new DOMRect(412, 52, 40, 44);
    expect(wheel().dataset.color).toBeUndefined();
    answers.ink_color = () => ({ color: '#7a3fd1' });
    calls.length = 0;
    await press('[aria-label="colours"]');
    expect(said('ink_color')).toEqual([{ color: '#1c1c1e', at: { x: 412, y: 52, w: 40, h: 44 } }]);
    expect(wheel().dataset.color).toBe('#7a3fd1');
    expect(wheel().querySelector<HTMLElement>('.ib-core')!.style.background).toBe('rgb(122, 63, 209)');
    expect(lit('.ib-swatches button')).toEqual(['colours']);
    // a preset, then the wheel's swatch: its colour is in use again, and the wheel is not opened
    await press('[aria-label="red"]');
    expect(lit('.ib-swatches button')).toEqual(['red']);
    calls.length = 0;
    await press('[aria-label="colours"]');
    expect(lit('.ib-swatches button')).toEqual(['colours']);
    expect(said('ink_color')).toEqual([]);
    expect(said('ink_tool')).toEqual([{ tool: { ...PEN, color: '#7a3fd1' } }]);
    // pressed while it is the one in use: the wheel, from its colour
    answers.ink_color = () => ({ color: null });
    await press('[aria-label="colours"]');
    expect(said('ink_color').map((c) => c.color)).toEqual(['#7a3fd1']);
    expect(wheel().dataset.color).toBe('#7a3fd1');
    // the highlighter's wheel has no colour of its own yet
    await press('[aria-label="highlighter"]');
    expect(wheel().dataset.color).toBeUndefined();
  });

  it('one of the four pressed while it is the one in use is replaced from the wheel; another is only chosen', async () => {
    const a = await launch();
    await a.scene();
    await show(a);
    const sw = (i: number) => host.querySelector<HTMLElement>(`[data-ink-swatch="${i}"]`)!;
    sw(0).getBoundingClientRect = () => new DOMRect(212, 52, 40, 44);
    calls.length = 0;
    // blue is not in use: chosen, and no wheel
    await press('[aria-label="blue"]');
    expect(said('ink_color')).toEqual([]);
    expect(lit('.ib-swatches button')).toEqual(['blue']);
    await press('[aria-label="black"]');
    expect(said('ink_color')).toEqual([]);
    // black, in use, pressed again: the wheel from it, showing its colour, the swatch said to be open meanwhile
    let close: (v: { color: string | null }) => void = () => {};
    answers.ink_color = () => new Promise((r) => { close = r; });
    await press('[aria-label="black"]');
    expect(said('ink_color')).toEqual([{ color: '#1c1c1e', at: { x: 212, y: 52, w: 40, h: 44 } }]);
    expect(sw(0).getAttribute('aria-expanded')).toBe('true');
    expect(sw(1).getAttribute('aria-expanded')).toBeNull();
    await act(async () => { close({ color: '#884422' }); await wait(); });
    expect(sw(0).getAttribute('aria-expanded')).toBeNull();
    expect(sw(0).dataset.color).toBe('#884422');
    expect(sw(0).querySelector<HTMLElement>('.ib-dot')!.style.background).toBe('rgb(136, 68, 34)');
    // it is no longer black: it is called by its place, and the rest by their names
    expect(labels('.ib-swatches button')).toEqual(['colour 1', 'blue', 'red', 'green', 'colours']);
    expect(lit('.ib-swatches button')).toEqual(['colour 1']);
    expect(sw(0).title).toBe('colour 1');
    // the wheel's own swatch has no colour from it, and the pen's mark on its tool is the new colour
    expect(host.querySelector<HTMLElement>('[aria-label="colours"]')!.dataset.color).toBeUndefined();
    expect(host.querySelector<HTMLElement>('[data-ink-tool="pen"] .ib-ink')!.style.background).toBe('rgb(136, 68, 34)');
    expect(said('ink_tool').at(-1)).toEqual({ tool: { ...PEN, color: '#884422' } });
    expect(a.tools.useInkTools.getState().kept.colors.pen).toEqual(['#884422', '#1d4fb8', '#c5281c', '#1e7a46']);
  });

  it('a swatch held is replaced from the wheel though another is in use, and the press that ends the hold does nothing more', async () => {
    const a = await launch();
    await a.scene();
    await show(a);
    const red = () => host.querySelector<HTMLElement>('[data-ink-swatch="2"]')!;
    answers.ink_color = () => ({ color: '#aa00aa' });
    calls.length = 0;
    // a short press: down, up, the click: chosen, no wheel
    await down(red());
    await act(async () => { red().dispatchEvent(new PointerEvent('pointerup', { bubbles: true })); });
    await press('[data-ink-swatch="2"]');
    await act(async () => { await wait(460); });
    expect(said('ink_color')).toEqual([]);
    expect(lit('.ib-swatches button')).toEqual(['red']);
    // green held: the wheel, for green
    const green = () => host.querySelector<HTMLElement>('[data-ink-swatch="3"]')!;
    await down(green());
    await act(async () => { await wait(300); });
    expect(said('ink_color')).toEqual([]);
    await act(async () => { await wait(180); });
    expect(said('ink_color').map((c) => c.color)).toEqual(['#1e7a46']);
    expect(green().dataset.color).toBe('#aa00aa');
    expect(lit('.ib-swatches button')).toEqual(['colour 4']);
    // the finger lifted: the click it makes opens no second wheel
    await act(async () => { green().dispatchEvent(new PointerEvent('pointerup', { bubbles: true })); });
    await press('[data-ink-swatch="3"]');
    expect(said('ink_color').length).toBe(1);
    // a hold let go early, or slid off, is no hold
    await down(red());
    await act(async () => { red().dispatchEvent(new PointerEvent('pointercancel', { bubbles: true })); await wait(460); });
    expect(said('ink_color').length).toBe(1);
  });

  it('fits the pane it is in and never scrolls: the sizes go first, then the colours but for the one in use', async () => {
    expect([ROW_FULL, ROW_MID]).toEqual([748, 626]);
    expect([0, -1, 2000, 748].map((w) => rowFit(w))).toEqual(['full', 'full', 'full', 'full']);
    expect([747, 700, 626].map((w) => rowFit(w))).toEqual(['mid', 'mid', 'mid']);
    expect([625, 400, 1].map((w) => rowFit(w))).toEqual(['compact', 'compact', 'compact']);
    // a tool with no colours keeps its sizes in the room they would have taken; the lasso has neither to lose
    expect([748, 534, 533, 300].map((w) => rowFit(w, 'eraser'))).toEqual(['full', 'full', 'mid', 'mid']);
    expect([748, 300].map((w) => rowFit(w, 'select'))).toEqual(['full', 'full']);
    expect([747, 625].map((w) => rowFit(w, 'highlighter'))).toEqual(['mid', 'compact']);
    const a = await launch();
    barW = 900;
    await show(a);
    expect(fit()).toBe('full');
    expect(labels('.ib-sizes button')).toEqual(['thin', 'medium', 'thick']);
    expect(labels('.ib-swatches button')).toEqual(['black', 'blue', 'red', 'green', 'colours']);
    // a note opened beside: narrower
    await resized(700);
    expect(fit()).toBe('mid');
    expect(host.querySelector('.ib-sizes')).toBeNull();
    expect(labels('.ib-swatches button')).toEqual(['black', 'blue', 'red', 'green', 'colours']);
    await resized(500);
    expect(fit()).toBe('compact');
    expect(host.querySelector('.ib-sizes')).toBeNull();
    expect(labels('.ib-swatches button')).toEqual(['colour']);
    const one = host.querySelector<HTMLElement>('[data-ink-swatch="current"]')!;
    expect([one.getAttribute('aria-pressed'), one.getAttribute('aria-haspopup')]).toEqual(['true', 'dialog']);
    expect(one.querySelector<HTMLElement>('.ib-dot')!.style.background).toBe('rgb(28, 28, 30)');
    // the tools, undo and redo, the finger and the tuck are always there
    expect(labels('.ib-tools button, .ib-history button, .ib-ends button')).toEqual(['pen', 'highlighter', 'eraser', 'select', 'undo', 'redo', 'draw with finger', 'hide tools']);
    // the one colour opens the tool's settings, where the sizes and the colours are; pressed again it closes them
    await press('[data-ink-swatch="current"]');
    expect(pop()!.dataset.inkPop).toBe('pen');
    expect(inPop('[data-ink-size]').map((b) => b.getAttribute('aria-label'))).toEqual(['thin', 'medium', 'thick']);
    expect(inPop('[data-ink-swatch]').map((b) => b.getAttribute('aria-label'))).toEqual(['black', 'blue', 'red', 'green', 'colours']);
    await pressPop('[data-ink-swatch="2"]');
    expect(one.querySelector<HTMLElement>('.ib-dot')!.style.background).toBe('rgb(197, 40, 28)');
    await press('[data-ink-swatch="current"]');
    expect(pop()).toBeNull();
    // the eraser has no colour, narrow or not
    await press('[aria-label="eraser"]');
    expect(host.querySelector('.ib-swatches')).toBeNull();
    // wide again, all of it is back
    await resized(748);
    expect(fit()).toBe('full');
    expect(labels('.ib-sizes button')).toEqual(['thin', 'medium', 'thick']);
  });

  it('the tool in use pressed again opens its settings under the row, and they close by a second press, a press elsewhere, esc, another tool, or the Pencil writing', async () => {
    const a = await launch();
    await a.scene();
    await show(a);
    const pen = () => host.querySelector<HTMLElement>('[data-ink-tool="pen"]')!;
    const open = () => a.tools.useInkTools.getState().open;
    await press('[aria-label="pen"]');
    expect(open()).toBe('pen');
    const p = pop()!;
    // drawn in the body, a dialog named for the tool, and no place for the Pencil
    expect(p.parentElement).toBe(document.body);
    expect([p.getAttribute('role'), p.getAttribute('aria-label'), p.dataset.inkPop]).toEqual(['dialog', 'pen settings', 'pen']);
    expect(p.hasAttribute('data-ink-over')).toBe(true);
    expect(pen().getAttribute('aria-expanded')).toBe('true');
    expect(lit('.ib-tools button')).toEqual(['pen']);
    // the canvases are told where it lies
    await act(async () => { await wait(); });
    expect((said('ink_scene').at(-1)!.scene as { holes: unknown[] }).holes).toEqual([POP]);
    // pressed again: gone
    await press('[aria-label="pen"]');
    expect([open(), pop()]).toEqual([null, null]);
    expect(pen().getAttribute('aria-expanded')).toBe('false');
    await act(async () => { await wait(); });
    expect((said('ink_scene').at(-1)!.scene as { holes: unknown[] }).holes).toEqual([]);
    // a press in it, or on the row, leaves it; a press anywhere else closes it
    await press('[aria-label="pen"]');
    await down(pop()!.querySelector('[data-ink-size="0"]')!);
    await down(host.querySelector('[aria-label="undo"]')!);
    expect(pop()).not.toBeNull();
    await down(document.body);
    expect([open(), pop()]).toEqual([null, null]);
    // esc
    await press('[aria-label="pen"]');
    await act(async () => { document.dispatchEvent(new KeyboardEvent('keydown', { key: 'a', bubbles: true })); });
    expect(pop()).not.toBeNull();
    await act(async () => { document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true })); });
    expect([open(), pop()]).toEqual([null, null]);
    // another tool: the pen's close, and that tool's are not opened by the one press
    await press('[aria-label="pen"]');
    await press('[aria-label="highlighter"]');
    expect([open(), pop()]).toEqual([null, null]);
    await press('[aria-label="highlighter"]');
    expect(pop()!.dataset.inkPop).toBe('highlighter');
    // the Pencil's double tap changes the tool: closed
    await act(async () => { pencil({ kind: 'pencil', what: 'tap', prefer: 'eraser' }); await wait(); });
    expect([open(), pop()]).toEqual([null, null]);
    await press('[aria-label="eraser"]');
    expect(pop()!.dataset.inkPop).toBe('eraser');
    // the Pencil writing
    await act(async () => { pencil({ kind: 'begin', sheet: 'p.x.1', host: 'pages:x' }); await wait(); });
    expect([open(), pop()]).toEqual([null, null]);
    // select has none, however often it is pressed
    await press('[aria-label="select"]');
    await press('[aria-label="select"]');
    expect([open(), pop()]).toEqual([null, null]);
    // a squeeze opens the held tool's
    await press('[aria-label="pen"]');
    await act(async () => { pencil({ kind: 'pencil', what: 'squeeze' }); await wait(); });
    expect(pop()!.dataset.inkPop).toBe('pen');
  });

  it('the pen\'s settings: its inks, the size in use made thinner or thicker with a stroke that shows it, its sizes and colours, and the shape', async () => {
    const a = await launch();
    await a.scene();
    await show(a);
    await press('[aria-label="pen"]');
    const kept = () => a.tools.useInkTools.getState().kept;
    expect(inPop('[data-ink-ink]').map((b) => [b.dataset.inkInk, b.textContent, b.getAttribute('aria-pressed')])).toEqual([['pen', 'pen', 'false'], ['monoline', 'fine', 'true'], ['fountain', 'fountain', 'false'], ['pencil', 'pencil', 'false']]);
    expect(inPop('[data-ink-eraser], [data-ink-range="opacity"]')).toEqual([]);
    calls.length = 0;
    await pressPop('[data-ink-ink="fountain"]');
    expect(kept().ink).toBe('fountain');
    expect(inPop('[data-ink-ink][aria-pressed="true"]').map((b) => b.dataset.inkInk)).toEqual(['fountain']);
    expect(said('ink_tool')).toEqual([{ tool: { ...PEN, ink: 'fountain' } }]);
    // the size: between what a pen can be, at the width of the size in use
    const range = () => inPop<HTMLInputElement>('[data-ink-range="width"]')[0]!;
    expect([range().min, range().max, range().step, range().value, range().getAttribute('aria-label')]).toEqual(['0.5', '8', '0.1', '2.2', 'size']);
    expect(inPop('[data-ink-preview]')[0]!.dataset).toMatchObject({ inkPreview: 'pen', width: '2.2' });
    expect(inPop('.ip-v')[0]!.textContent).toBe('2.2');
    calls.length = 0;
    await slide('width', 5);
    expect(kept().widths.pen).toEqual([1.2, 5, 3.6]);
    expect(said('ink_tool')).toEqual([{ tool: { ...PEN, ink: 'fountain', width: 5 } }]);
    expect(range().value).toBe('5');
    expect(inPop('.ip-v')[0]!.textContent).toBe('5.0');
    expect(inPop('[data-ink-preview]')[0]!.dataset.width).toBe('5');
    // its three sizes: another chosen, the slider is at that one's width, and changes that one
    expect(inPop('[data-ink-size][aria-pressed="true"]').map((b) => b.getAttribute('aria-label'))).toEqual(['medium']);
    await pressPop('[data-ink-size="0"]');
    expect(range().value).toBe('1.2');
    await slide('width', 0.7);
    expect(kept().widths.pen).toEqual([0.7, 5, 3.6]);
    expect(kept().size.pen).toBe(0);
    // the row shows the same
    expect(lit('.ib-sizes button')).toEqual(['thin']);
    // its colours, as on the row
    expect(inPop('[data-ink-swatch]').map((b) => b.getAttribute('aria-label'))).toEqual(['black', 'blue', 'red', 'green', 'colours']);
    await pressPop('[data-ink-swatch="1"]');
    expect(lit('.ib-swatches button')).toEqual(['blue']);
    // a stroke ended resting becomes a shape, or not
    const snap = () => inPop('[data-ink-snap]')[0]!;
    expect([snap().getAttribute('role'), snap().getAttribute('aria-checked'), snap().textContent]).toEqual(['switch', 'true', 'hold to make a shape']);
    calls.length = 0;
    await pressPop('[data-ink-snap]');
    expect(snap().getAttribute('aria-checked')).toBe('false');
    expect(kept().snap).toBe(false);
    expect(said('ink_tool')).toEqual([{ tool: { kind: 'pen', color: '#1d4fb8', width: 0.7, ink: 'fountain', snap: false } }]);
    await pressPop('[data-ink-snap]');
    expect(kept().snap).toBe(true);
    // none of it closed the settings
    expect(pop()!.dataset.inkPop).toBe('pen');
  });

  it('the pen\'s inks and how thin and thick it goes are this device\'s, once it has said', async () => {
    answers.ink_caps = () => ({ inks: { pen: [0.88, 25], pencil: [2.4, 16], marker: [9.64, 30] } });
    const a = await launch();
    await a.scene();
    await show(a);
    await press('[aria-label="pen"]');
    expect(inPop('[data-ink-ink]').map((b) => b.dataset.inkInk)).toEqual(['pen', 'pencil']);
    const range = () => inPop<HTMLInputElement>('[data-ink-range="width"]')[0]!;
    expect([range().min, range().max, range().value]).toEqual(['0.9', '8', '2.2']);
    await pressPop('[data-ink-ink="pencil"]');
    expect([range().min, range().max, range().value]).toEqual(['2.4', '8', '2.4']);
    await press('[aria-label="highlighter"]');
    await press('[aria-label="highlighter"]');
    expect([range().min, range().max, range().value]).toEqual(['9.7', '30', '16']);
    // a device with the one pen has no inks to choose among
    act(() => root!.unmount());
    host.remove();
    answers.ink_caps = () => ({ inks: { pen: [0.5, 25], marker: [5, 60] } });
    const b = await launch();
    await b.scene();
    await show(b);
    // (the highlighter was the tool held: the pen is taken up, then pressed again)
    await press('[aria-label="pen"]');
    await press('[aria-label="pen"]');
    expect(pop()!.dataset.inkPop).toBe('pen');
    expect(inPop('[data-ink-ink]')).toEqual([]);
  });

  it('the highlighter\'s settings have its opacity and no inks; the eraser\'s its two ways and its size, and no colours', async () => {
    const a = await launch();
    await a.scene();
    await show(a);
    const kept = () => a.tools.useInkTools.getState().kept;
    await press('[aria-label="highlighter"]');
    await press('[aria-label="highlighter"]');
    expect(pop()!.getAttribute('aria-label')).toBe('highlighter settings');
    expect(inPop('[data-ink-ink], [data-ink-eraser]')).toEqual([]);
    const width = () => inPop<HTMLInputElement>('[data-ink-range="width"]')[0]!;
    const opacity = () => inPop<HTMLInputElement>('[data-ink-range="opacity"]')[0]!;
    expect([width().min, width().max, width().value]).toEqual(['6', '40', '16']);
    expect([opacity().min, opacity().max, opacity().step, opacity().value, opacity().getAttribute('aria-label')]).toEqual(['0.2', '1', '0.05', '1', 'opacity']);
    expect(inPop('.ip-v').map((v) => v.textContent)).toEqual(['16.0', '100%']);
    calls.length = 0;
    await slide('opacity', 0.5);
    expect(kept().opacity).toBe(0.5);
    expect(inPop('.ip-v').map((v) => v.textContent)).toEqual(['16.0', '50%']);
    expect(said('ink_tool')).toEqual([{ tool: { kind: 'highlighter', color: '#ffe03a', width: 16, opacity: 0.5, snap: true } }]);
    await slide('width', 30);
    expect(kept().widths.highlighter).toEqual([10, 30, 24]);
    expect(inPop('[data-ink-preview]')[0]!.dataset).toMatchObject({ inkPreview: 'highlighter', width: '30' });
    expect(inPop('[data-ink-swatch]').map((b) => b.getAttribute('aria-label'))).toEqual(['yellow', 'green', 'pink', 'blue', 'colours']);
    expect(inPop('[data-ink-snap]')[0]!.textContent).toBe('hold for a straight line');
    // the eraser
    await press('[aria-label="eraser"]');
    await press('[aria-label="eraser"]');
    expect(pop()!.getAttribute('aria-label')).toBe('eraser settings');
    expect(inPop('[data-ink-eraser]').map((b) => [b.dataset.inkEraser, b.textContent, b.getAttribute('aria-pressed')])).toEqual([['stroke', 'whole stroke', 'true'], ['part', 'part of a stroke', 'false']]);
    expect(inPop('[data-ink-ink], [data-ink-range="opacity"], [data-ink-swatch], [data-ink-snap], [data-ink-recent]')).toEqual([]);
    expect([width().min, width().max, width().value]).toEqual(['4', '48', '16']);
    expect(inPop('[data-ink-size]').length).toBe(3);
    calls.length = 0;
    await pressPop('[data-ink-eraser="part"]');
    expect(kept().eraser).toBe('part');
    expect(inPop('[data-ink-eraser][aria-pressed="true"]').map((b) => b.dataset.inkEraser)).toEqual(['part']);
    await slide('width', 40);
    expect(said('ink_tool').map((t) => t.tool)).toEqual([{ kind: 'eraser', color: '#000000', width: 16, mode: 'part' }, { kind: 'eraser', color: '#000000', width: 40, mode: 'part' }]);
    await pressPop('[data-ink-eraser="stroke"]');
    expect(kept().eraser).toBe('stroke');
  });

  it('the colours lately taken from the wheel are in the settings once there are some, and one pressed is in use again', async () => {
    const a = await launch();
    await a.scene();
    await show(a);
    await press('[aria-label="pen"]');
    expect(inPop('.ip-recent, [data-ink-recent]')).toEqual([]);
    answers.ink_color = () => ({ color: '#884422' });
    await pressPop('[data-ink-swatch="wheel"]');
    answers.ink_color = () => ({ color: '#226688' });
    await pressPop('[data-ink-swatch="wheel"]');
    const recents = () => inPop('[data-ink-recent]').map((b) => [b.dataset.inkRecent, b.getAttribute('aria-label'), b.getAttribute('aria-pressed')]);
    // the newest first, the one in use lit
    expect(recents()).toEqual([['#226688', 'recent colour #226688', 'true'], ['#884422', 'recent colour #884422', 'false']]);
    expect(inPop('.ip-recent')[0]!.getAttribute('aria-label')).toBe('recent colours');
    expect(inPop<HTMLElement>('[data-ink-recent="#884422"] span')[0]!.style.background).toBe('rgb(136, 68, 34)');
    calls.length = 0;
    await pressPop('[data-ink-recent="#884422"]');
    expect(said('ink_color')).toEqual([]);
    expect(said('ink_tool')).toEqual([{ tool: { ...PEN, color: '#884422' } }]);
    expect(recents().map((r) => r[2])).toEqual(['false', 'true']);
    expect(a.tools.useInkTools.getState().kept).toMatchObject({ custom: { pen: '#884422' }, swatch: { pen: CUSTOM }, recent: { pen: ['#226688', '#884422'] } });
    expect(lit('.ib-swatches button')).toEqual(['colours']);
    // they are the pen's: the highlighter has none yet
    await press('[aria-label="highlighter"]');
    await press('[aria-label="highlighter"]');
    expect(inPop('[data-ink-recent]')).toEqual([]);
  });

  it('with a pane beside, the settings hang from the row of the pane in front alone', async () => {
    const a = await launch();
    await show(a);
    host.className = 'pane';
    host.dataset.active = '0';
    await press('[aria-label="pen"]');
    expect(a.tools.useInkTools.getState().open).toBe('pen');
    expect(pop()).toBeNull();
    expect(host.querySelector('[data-ink-tool="pen"]')!.getAttribute('aria-expanded')).toBe('true');
  });

  it('is tucked away by its last button and brought back by the bar\'s; tucked, nothing of it is there', async () => {
    const a = await launch();
    await a.scene();
    await show(a);
    await press('[aria-label="draw with finger"]');
    await press('[aria-label="pen"]');
    expect(pop()).not.toBeNull();
    const tuck = host.querySelector<HTMLElement>('[data-ink-do="tuck"]')!;
    expect([tuck.getAttribute('aria-label'), tuck.title]).toEqual(['hide tools', 'hide tools']);
    calls.length = 0;
    await press('[data-ink-do="tuck"]');
    expect(host.querySelector('.inkbar')).toBeNull();
    expect(pop()).toBeNull();
    expect(a.tools.useInkTools.getState()).toMatchObject({ open: null, kept: { shown: false, tool: 'pen', finger: true } });
    expect(JSON.parse(localStorage.getItem('ilmi.ink')!).shown).toBe(false);
    // a finger scrolls while it is away; the tool is as it was
    expect(calls.filter((c) => c.cmd !== 'ink_scene')).toEqual([{ cmd: 'ink_finger', args: { on: false } }]);
    const toggle = host.querySelector<HTMLElement>('[data-tool="ink-tools"]')!;
    expect([toggle.getAttribute('aria-label'), toggle.title, toggle.getAttribute('aria-pressed'), toggle.textContent]).toEqual(['show tools', 'show tools', 'false', '']);
    await press('[data-tool="ink-tools"]');
    expect(host.querySelector('.inkbar')).not.toBeNull();
    expect(host.querySelector('[data-tool="ink-tools"]')).toBeNull();
    expect(a.tools.useInkTools.getState().kept.shown).toBe(true);
    expect(said('ink_finger').at(-1)).toEqual({ on: true });
    // its settings are not opened by its coming back
    expect(pop()).toBeNull();
  });

  it('tucked away, the button that brings the row back is the tool in use: the Pencil\'s double tap to the eraser and back shows on it', async () => {
    const a = await launch();
    await show(a);
    await press('[data-ink-do="tuck"]');
    const toggle = () => host.querySelector<HTMLElement>('[data-tool="ink-tools"]')!;
    const icon = () => toggle().querySelector('svg')!.outerHTML;
    const mark = () => toggle().querySelector<HTMLElement>('.ib-ink')?.dataset.color ?? null;
    // the icons the row itself has for its tools
    await press('[data-tool="ink-tools"]');
    const row = (t: string) => host.querySelector(`[data-ink-tool="${t}"] svg`)!.outerHTML;
    const icons = { pen: row('pen'), highlighter: row('highlighter'), eraser: row('eraser'), select: row('select') };
    expect(new Set(Object.values(icons)).size).toBe(4);
    await press('[data-ink-do="tuck"]');
    expect([toggle().dataset.kind, icon(), mark(), toggle().getAttribute('aria-label')]).toEqual(['pen', icons.pen, '#1c1c1e', 'show tools']);
    // the Pencil tapped twice: the eraser, which has no colour
    await act(async () => { a.tools.toolsHeard({ kind: 'pencil', what: 'tap', prefer: 'eraser' }); });
    expect([toggle().dataset.kind, icon(), mark()]).toEqual(['eraser', icons.eraser, null]);
    // and back
    await act(async () => { a.tools.toolsHeard({ kind: 'pencil', what: 'tap', prefer: 'eraser' }); });
    expect([toggle().dataset.kind, icon(), mark()]).toEqual(['pen', icons.pen, '#1c1c1e']);
    // a highlighter carries its colour, and the one it is changed to
    await act(async () => { a.tools.setTool('highlighter'); });
    expect([toggle().dataset.kind, icon(), mark()]).toEqual(['highlighter', icons.highlighter, '#ffe03a']);
    await act(async () => { a.tools.setSwatch('highlighter', 2); });
    expect(mark()).toBe('#ff8fc0');
    expect(toggle().querySelector<HTMLElement>('.ib-ink')!.style.background).not.toBe('');
    await act(async () => { a.tools.setTool('select'); });
    expect([toggle().dataset.kind, icon(), mark()]).toEqual(['select', icons.select, null]);
    // the row stays away through all of it, and comes back at a press
    expect(host.querySelector('.inkbar')).toBeNull();
    await press('[data-tool="ink-tools"]');
    expect(host.querySelector('.inkbar')!.getAttribute('data-tool')).toBe('select');
  });

  it('stays tucked after a reload; a row that is fixed is always there and has nothing to tuck it with', async () => {
    const a = await launch();
    a.tools.setShown(false);
    const b = await launch();
    await show(b);
    expect(host.querySelector('.inkbar')).toBeNull();
    expect(host.querySelector('[data-tool="ink-tools"]')).not.toBeNull();
    act(() => root!.unmount());
    host.remove();
    await show(b, true);
    expect(host.querySelector('.inkbar')).not.toBeNull();
    expect(host.querySelector('[data-ink-do="tuck"]')).toBeNull();
    expect(labels('.ib-ends button')).toEqual(['draw with finger']);
    expect(labels('.ib-tools button')).toEqual(['pen', 'highlighter', 'eraser', 'select']);
  });

  it('the button that brings the row back is an iPad\'s, as the row is', async () => {
    const a = await launch({ mobile: false });
    a.tools.setShown(false);
    await show(a);
    expect(host.querySelector('[data-tool="ink-tools"], .inkbar')).toBeNull();
    act(() => root!.unmount());
    host.remove();
    await show(await launch({ mobile: true, phone: true }));
    expect(host.querySelector('[data-tool="ink-tools"], .inkbar')).toBeNull();
  });
});
