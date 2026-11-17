// @vitest-environment jsdom
// The writing tools (milestone 82): what is chosen and how it changes, that
// it is the device's and survives a reload, exactly what the canvases are
// told and when (the tool on the first scene and on each change, the finger,
// undo and redo and what they answer, the colour wheel and its closing with
// none chosen, nothing at all without a canvas), and the row itself: an
// iPad's only, the chosen tool lit, its sizes and colours, what can be
// taken back. The canvases themselves are an iPad's (`ILMI_SMOKE=written`).

import { act, createElement } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { CUSTOM, DEFAULTS, SIZES, SWATCHES, colorOf, hex, parse, toolOf, withCustom, withFinger, withSize, withSwatch, withTool, type Kept } from '../inkTools.js';

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

const calls: { cmd: string; args: Record<string, unknown> }[] = [];
/** What the canvases answer, by command. */
let answers: Record<string, (args: Record<string, unknown>) => unknown> = {};
vi.mock('@tauri-apps/api/core', () => ({
  invoke: async (cmd: string, args: Record<string, unknown>) => {
    // (a module's own question at launch, none of the canvases')
    if (cmd === 'dev_env') return null;
    calls.push({ cmd, args });
    if (cmd in answers) return answers[cmd]!(args);
    if (cmd === 'ink_scene') return { made: [] };
    if (cmd === 'ink_undo' || cmd === 'ink_redo') return { undo: false, redo: false };
    if (cmd === 'ink_color') return { color: null };
    return null;
  },
}));

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
  const { InkBar } = await import('../InkBar.js');
  /** A surface with nothing on it: the first scene goes out, and the canvases exist. */
  const scene = async () => { ink.addSurface({ host: () => null, paper: () => null, kept: async () => {} }); await wait(); };
  return { ...store, tools, ink, InkBar, scene };
}

beforeEach(() => {
  localStorage.clear();
  calls.length = 0;
  answers = {};
});

describe('what is chosen', () => {
  it('starts at a medium black pen, a finger not drawing', () => {
    expect(toolOf(DEFAULTS)).toEqual({ kind: 'pen', color: '#1c1c1e', width: 2.2 });
    expect(DEFAULTS.finger).toBe(false);
    expect(DEFAULTS.custom).toEqual({ pen: null, highlighter: null });
  });

  it('each tool has three sizes and remembers its own', () => {
    expect(SIZES).toEqual({ pen: [1.2, 2.2, 3.6], highlighter: [10, 16, 24], eraser: [8, 16, 28] });
    let k = withSize(DEFAULTS, 'pen', 2);
    k = withSize(withTool(k, 'highlighter'), 'highlighter', 0);
    k = withSize(withTool(k, 'eraser'), 'eraser', 2);
    expect(toolOf(k)).toEqual({ kind: 'eraser', color: '#000000', width: 28 });
    expect(toolOf(withTool(k, 'highlighter'))).toMatchObject({ kind: 'highlighter', width: 10 });
    expect(toolOf(withTool(k, 'pen'))).toMatchObject({ kind: 'pen', width: 3.6 });
    // select has none
    expect(toolOf(withTool(k, 'select'))).toEqual({ kind: 'select', color: '#000000', width: 0 });
    // a size there is not changes nothing
    expect(withSize(k, 'pen', 3)).toBe(k);
    expect(withSize(k, 'pen', 2)).toBe(k);
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

  it('what was kept is read back, and what it says wrongly is as it starts', () => {
    const k: Kept = { tool: 'highlighter', size: { pen: 0, highlighter: 2, eraser: 1 }, swatch: { pen: CUSTOM, highlighter: 1 }, custom: { pen: '#123456', highlighter: null }, finger: true };
    expect(parse(JSON.stringify(k))).toEqual(k);
    expect(parse(null)).toBe(DEFAULTS);
    expect(parse('not json')).toBe(DEFAULTS);
    expect(parse(JSON.stringify({ tool: 'brush', size: { pen: 7 }, swatch: { pen: CUSTOM, highlighter: 12 }, custom: { pen: 'blue' }, finger: 'yes' }))).toEqual(DEFAULTS);
    expect(withFinger(k, true)).toBe(k);
    expect(withFinger(k, false).finger).toBe(false);
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
    expect(JSON.parse(localStorage.getItem('ilmi.ink')!)).toEqual(was);

    const b = await launch();
    expect(b.tools.useInkTools).not.toBe(a.tools.useInkTools);
    expect(b.tools.useInkTools.getState().kept).toEqual(was);
    expect(b.tools.toolOf(b.tools.useInkTools.getState().kept)).toEqual({ kind: 'highlighter', color: '#0a7f6b', width: 24 });
    // and nothing of what can be undone is carried over: that is the canvases' to say
    expect(b.tools.useInkTools.getState()).toMatchObject({ undo: false, redo: false, picking: null });
  });
});

describe('what the canvases are told', () => {
  it('the tool and the finger once the canvases first exist, and not again for a later scene', async () => {
    const a = await launch();
    expect(calls).toEqual([]);
    await a.scene();
    expect(calls.map((c) => c.cmd)).toEqual(['ink_scene', 'ink_tool', 'ink_finger']);
    expect(said('ink_tool')).toEqual([{ tool: { kind: 'pen', color: '#1c1c1e', width: 2.2 } }]);
    expect(said('ink_finger')).toEqual([{ on: false }]);
    await a.scene();
    a.ink.sceneSoon();
    await wait();
    expect(said('ink_tool').length).toBe(1);
    expect(said('ink_finger').length).toBe(1);
  });

  it('after a web reload, what was chosen before it', async () => {
    const a = await launch();
    a.tools.setTool('eraser');
    a.tools.setSize('eraser', 0);
    a.tools.setFinger(true);
    calls.length = 0;
    const b = await launch();
    await b.scene();
    expect(said('ink_tool')).toEqual([{ tool: { kind: 'eraser', color: '#000000', width: 8 } }]);
    expect(said('ink_finger')).toEqual([{ on: true }]);
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
      { cmd: 'ink_tool', args: { tool: { kind: 'highlighter', color: '#ffe03a', width: 16 } } },
      { cmd: 'ink_tool', args: { tool: { kind: 'highlighter', color: '#ffe03a', width: 10 } } },
      { cmd: 'ink_tool', args: { tool: { kind: 'highlighter', color: '#ff8fc0', width: 10 } } },
      { cmd: 'ink_tool', args: { tool: { kind: 'select', color: '#000000', width: 0 } } },
      { cmd: 'ink_tool', args: { tool: { kind: 'pen', color: '#1c1c1e', width: 2.2 } } },
      { cmd: 'ink_tool', args: { tool: { kind: 'pen', color: '#1d4fb8', width: 2.2 } } },
    ]);
    calls.length = 0;
    // the same again, and another tool's size: the tool in use is as it was
    a.tools.setTool('pen');
    a.tools.setSwatch('pen', 1);
    a.tools.setSize('eraser', 2);
    a.tools.setSwatch('highlighter', 0);
    expect(calls).toEqual([]);
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
    expect(a.tools.useInkTools.getState().picking).toBe('pen');
    // a second wheel is not opened over the first
    await a.tools.pickColor('pen', at);
    expect(said('ink_color').length).toBe(1);
    pencil({ kind: 'color', color: '#336699' });
    expect(a.tools.useInkTools.getState().kept.custom.pen).toBe('#336699');
    expect(a.tools.useInkTools.getState().kept.swatch.pen).toBe(CUSTOM);
    expect(said('ink_tool').at(-1)).toEqual({ tool: { kind: 'pen', color: '#336699', width: 2.2 } });
    pencil({ kind: 'color', color: '#3366aa' });
    close({ color: '#3366AB' });
    await done;
    const k = a.tools.useInkTools.getState().kept;
    expect(k.custom).toEqual({ pen: '#3366ab', highlighter: null });
    expect(k.swatch.pen).toBe(CUSTOM);
    expect(a.tools.useInkTools.getState().picking).toBeNull();
    expect(said('ink_tool').map((t) => (t.tool as { color: string }).color)).toEqual(['#336699', '#3366aa', '#3366ab']);
    expect(JSON.parse(localStorage.getItem('ilmi.ink')!).custom.pen).toBe('#3366ab');
    // a colour said with no wheel up is no one's
    pencil({ kind: 'color', color: '#000001' });
    expect(a.tools.useInkTools.getState().kept).toBe(k);
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
    expect(JSON.parse(localStorage.getItem('ilmi.ink')!)).toEqual(was);
    // and the canvases have the colour that was in use again
    expect(said('ink_tool').at(-1)).toEqual({ tool: { kind: 'pen', color: '#1e7a46', width: 2.2 } });
    // one chosen before stays that tool's own when a later wheel is closed with none
    answers.ink_color = () => ({ color: '#101010' });
    await a.tools.pickColor('pen', { x: 0, y: 0, w: 40, h: 44 });
    answers.ink_color = () => ({ color: null });
    await a.tools.pickColor('pen', { x: 0, y: 0, w: 40, h: 44 });
    expect(a.tools.useInkTools.getState().kept.custom.pen).toBe('#101010');
    expect(a.tools.useInkTools.getState().kept.swatch.pen).toBe(CUSTOM);
  });

  it('nothing at all where there is no canvas', async () => {
    const a = await launch({ mobile: false });
    await a.scene();
    a.tools.setTool('highlighter');
    a.tools.setSize('highlighter', 2);
    a.tools.setSwatch('highlighter', 1);
    a.tools.setFinger(true);
    await a.tools.undo();
    await a.tools.redo();
    await a.tools.pickColor('highlighter', { x: 0, y: 0, w: 40, h: 44 });
    a.tools.canvasesReady();
    await wait();
    expect(calls).toEqual([]);
    // what was chosen is still chosen, and kept
    expect(a.tools.useInkTools.getState().kept).toMatchObject({ tool: 'highlighter', finger: true });
    expect(JSON.parse(localStorage.getItem('ilmi.ink')!).tool).toBe('highlighter');
  });
});

describe('the row of tools', () => {
  let host: HTMLDivElement;
  let root: Root | null = null;
  const show = async (a: Awaited<ReturnType<typeof launch>>) => {
    host = document.body.appendChild(document.createElement('div'));
    root = createRoot(host);
    await act(async () => { root!.render(createElement(a.InkBar, { id: 'library/book.pdf' })); });
  };
  const press = (sel: string) => act(async () => { host.querySelector<HTMLElement>(sel)!.click(); await wait(); });
  const labels = (sel: string) => Array.from(host.querySelectorAll<HTMLElement>(sel)).map((b) => b.getAttribute('aria-label'));
  const lit = (sel: string) => Array.from(host.querySelectorAll<HTMLElement>(`${sel}[aria-pressed="true"]`)).map((b) => b.getAttribute('aria-label'));
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
    expect(labels('.ib-history button')).toEqual(['undo', 'redo', 'draw with finger']);
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
    expect(a.tools.toolOf(a.tools.useInkTools.getState().kept)).toEqual({ kind: 'highlighter', color: '#ff8fc0', width: 24 });
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
    expect(said('ink_tool')).toEqual([{ tool: { kind: 'pen', color: '#7a3fd1', width: 2.2 } }]);
    // pressed while it is the one in use: the wheel, from its colour
    answers.ink_color = () => ({ color: null });
    await press('[aria-label="colours"]');
    expect(said('ink_color').map((c) => c.color)).toEqual(['#7a3fd1']);
    expect(wheel().dataset.color).toBe('#7a3fd1');
    // the highlighter's wheel has no colour of its own yet
    await press('[aria-label="highlighter"]');
    expect(wheel().dataset.color).toBeUndefined();
  });
});
