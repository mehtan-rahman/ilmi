// The writing tools (milestone 82). The row of tools over pages that can be
// written on is ours (`InkBar.tsx`); PencilKit's picker is gone. What is
// chosen is kept here, one state for the device: the tool, each tool's size
// and colour, the colour last taken from the wheel for each, and whether a
// finger draws. It lies in the webview's storage, as the settings do
// (`ilmi.tweaks`, `store.ts`), so it is this device's and survives a restart.
//
// The canvases are told (`tauri-plugin-ink`): `ink_tool` whenever the tool in
// use changes, `ink_finger` whenever that does, and both once the canvases
// first exist (after the first scene, `ink.ts`), which is also what a web
// reload comes to. What can be undone is the canvases' to say: in the answer
// to `ink_undo` / `ink_redo`, and in `history` events meanwhile. The colour
// wheel is the system's, opened from its swatch; while it is up its colour is
// that tool's own swatch, live.
//
// The transitions are pure and tested (`ink-bar.test.ts`).

import { invoke } from '@tauri-apps/api/core';
import { create } from 'zustand';
import { useApp } from './store.js';

export type ToolKind = 'pen' | 'highlighter' | 'eraser' | 'select';
/** What a canvas is told: `width` is the ink's in points, the eraser's radius in screen points, nothing for select. */
export interface Tool { kind: ToolKind; color: string; width: number }

export const TOOLS: readonly ToolKind[] = ['pen', 'highlighter', 'eraser', 'select'];
/** A tool with sizes; and one with colours. */
export type Sized = 'pen' | 'highlighter' | 'eraser';
export type Inked = 'pen' | 'highlighter';
export const isSized = (t: ToolKind): t is Sized => t !== 'select';
export const isInked = (t: ToolKind): t is Inked => t === 'pen' || t === 'highlighter';

/** Three sizes each, thin to thick. A pen's and a highlighter's in points of the page; an eraser's radius in points of the screen. */
export const SIZES: Record<Sized, readonly [number, number, number]> = {
  pen: [1.2, 2.2, 3.6],
  highlighter: [10, 16, 24],
  eraser: [8, 16, 28],
};
export const SIZE_NAMES = ['thin', 'medium', 'thick'] as const;

export interface Swatch { name: string; color: string }
/** The colours each tool starts with: inks that read on white paper, markers that text shows through. */
export const SWATCHES: Record<Inked, readonly Swatch[]> = {
  pen: [
    { name: 'black', color: '#1c1c1e' },
    { name: 'blue', color: '#1d4fb8' },
    { name: 'red', color: '#c5281c' },
    { name: 'green', color: '#1e7a46' },
  ],
  highlighter: [
    { name: 'yellow', color: '#ffe03a' },
    { name: 'green', color: '#86e08a' },
    { name: 'pink', color: '#ff8fc0' },
    { name: 'blue', color: '#7cc4ff' },
  ],
};
/** The swatch that is the wheel's colour: one past the presets. */
export const CUSTOM = 4;

/** What is kept. */
export interface Kept {
  tool: ToolKind;
  /** Which of its three sizes each tool is at. */
  size: Record<Sized, number>;
  /** Which swatch each is at: one of the presets, or `CUSTOM`. */
  swatch: Record<Inked, number>;
  /** The colour last chosen from the wheel for each, `#rrggbb`; null until one is. */
  custom: Record<Inked, string | null>;
  /** A finger draws too. */
  finger: boolean;
}

export const DEFAULTS: Kept = {
  tool: 'pen',
  size: { pen: 1, highlighter: 1, eraser: 1 },
  swatch: { pen: 0, highlighter: 0 },
  custom: { pen: null, highlighter: null },
  finger: false,
};

const HEX = /^#[0-9a-f]{6}$/;
/** A colour as it is kept: `#rrggbb` in lowercase; null for anything else. */
export const hex = (c: unknown): string | null => (typeof c === 'string' && HEX.test(c.toLowerCase()) ? c.toLowerCase() : null);

// ── the transitions ──

export const withTool = (k: Kept, tool: ToolKind): Kept => (k.tool === tool ? k : { ...k, tool });

export const withSize = (k: Kept, tool: Sized, size: number): Kept =>
  size === k.size[tool] || !(size >= 0 && size < 3) ? k : { ...k, size: { ...k.size, [tool]: size } };

/** The swatch a tool is at; the wheel's only once it has a colour. */
export const withSwatch = (k: Kept, tool: Inked, swatch: number): Kept => {
  const ok = swatch === CUSTOM ? k.custom[tool] !== null : Number.isInteger(swatch) && swatch >= 0 && swatch < SWATCHES[tool].length;
  return !ok || swatch === k.swatch[tool] ? k : { ...k, swatch: { ...k.swatch, [tool]: swatch } };
};

/** A colour from the wheel: that tool's own swatch, and the one in use. */
export const withCustom = (k: Kept, tool: Inked, color: string): Kept => {
  const c = hex(color);
  if (!c || (k.custom[tool] === c && k.swatch[tool] === CUSTOM)) return k;
  return { ...k, custom: { ...k.custom, [tool]: c }, swatch: { ...k.swatch, [tool]: CUSTOM } };
};

export const withFinger = (k: Kept, finger: boolean): Kept => (k.finger === finger ? k : { ...k, finger });

/** The colour a tool writes in. */
export const colorOf = (k: Kept, tool: Inked): string =>
  (k.swatch[tool] === CUSTOM ? k.custom[tool] : null) ?? SWATCHES[tool][k.swatch[tool]]?.color ?? SWATCHES[tool][0]!.color;

/** What the canvases are told for what is chosen. */
export function toolOf(k: Kept): Tool {
  const kind = k.tool;
  return { kind, color: isInked(kind) ? colorOf(k, kind) : '#000000', width: isSized(kind) ? SIZES[kind][k.size[kind]]! : 0 };
}

/** What was kept, read back: anything it does not say, or says wrongly, is as it starts. */
export function parse(raw: string | null | undefined): Kept {
  if (!raw) return DEFAULTS;
  try {
    const t = JSON.parse(raw) as Partial<Kept> | null;
    if (!t || typeof t !== 'object') return DEFAULTS;
    const size = (tool: Sized): number => { const n = t.size?.[tool]; return n === 0 || n === 1 || n === 2 ? n : DEFAULTS.size[tool]; };
    const custom = (tool: Inked): string | null => hex(t.custom?.[tool]);
    const swatch = (tool: Inked): number => {
      const n = t.swatch?.[tool];
      if (n === CUSTOM) return custom(tool) ? CUSTOM : DEFAULTS.swatch[tool];
      return typeof n === 'number' && Number.isInteger(n) && n >= 0 && n < SWATCHES[tool].length ? n : DEFAULTS.swatch[tool];
    };
    return {
      tool: TOOLS.includes(t.tool as ToolKind) ? (t.tool as ToolKind) : DEFAULTS.tool,
      size: { pen: size('pen'), highlighter: size('highlighter'), eraser: size('eraser') },
      swatch: { pen: swatch('pen'), highlighter: swatch('highlighter') },
      custom: { pen: custom('pen'), highlighter: custom('highlighter') },
      finger: typeof t.finger === 'boolean' ? t.finger : DEFAULTS.finger,
    };
  } catch {
    return DEFAULTS;
  }
}

// ── kept per device, and the canvases told ──

export const INK_KEY = 'ilmi.ink';

function load(): Kept {
  try { return parse(globalThis.localStorage?.getItem(INK_KEY)); } catch { return DEFAULTS; }
}
function save(k: Kept): void {
  try { globalThis.localStorage?.setItem(INK_KEY, JSON.stringify(k)); } catch { /* no storage: the session keeps them */ }
}

export interface InkTools {
  kept: Kept;
  /** What the canvases can take back and put back. */
  undo: boolean;
  redo: boolean;
  /** The colour wheel is up for this tool. */
  picking: Inked | null;
}

export const useInkTools = create<InkTools>(() => ({ kept: load(), undo: false, redo: false, picking: null }));

/** Whether there is a canvas to tell: an iPad's (`hasCanvas`, `ink.ts`). */
const canvas = (): boolean => useApp.getState().mobile;

const tellTool = (k: Kept): void => { if (canvas()) void invoke<void>('ink_tool', { tool: toolOf(k) }).catch(console.error); };
const tellFinger = (k: Kept): void => { if (canvas()) void invoke<void>('ink_finger', { on: k.finger }).catch(console.error); };

/** `next` is what is chosen: kept, and the canvases told what of it changed for them. */
function put(next: Kept): void {
  const was = useInkTools.getState().kept;
  if (next === was) return;
  useInkTools.setState({ kept: next });
  save(next);
  const a = toolOf(was);
  const b = toolOf(next);
  if (a.kind !== b.kind || a.color !== b.color || a.width !== b.width) tellTool(next);
  if (was.finger !== next.finger) tellFinger(next);
}

const kept = (): Kept => useInkTools.getState().kept;

export const setTool = (tool: ToolKind): void => put(withTool(kept(), tool));
export const setSize = (tool: Sized, size: number): void => put(withSize(kept(), tool, size));
export const setSwatch = (tool: Inked, swatch: number): void => put(withSwatch(kept(), tool, swatch));
export const setFinger = (on: boolean): void => put(withFinger(kept(), on));

let told = false;
/** The canvases exist (the first scene reached them, `ink.ts`): they are told the tool and the finger, once. */
export function canvasesReady(): void {
  if (told || !canvas()) return;
  told = true;
  tellTool(kept());
  tellFinger(kept());
}

interface History { undo: boolean; redo: boolean }
const took = (h: History | null | undefined): void => { if (h) useInkTools.setState({ undo: !!h.undo, redo: !!h.redo }); };

/** The last thing written or erased is taken back; and put back. What is possible afterwards is in the answer. */
export async function undo(): Promise<void> {
  if (!canvas()) return;
  took(await invoke<History>('ink_undo', {}).catch((e: unknown) => { console.error(e); return null; }));
}
export async function redo(): Promise<void> {
  if (!canvas()) return;
  took(await invoke<History>('ink_redo', {}).catch((e: unknown) => { console.error(e); return null; }));
}

/** A rectangle on the page, in the web view's points. */
export interface At { x: number; y: number; w: number; h: number }

/**
 * The colour wheel, from `at` (its swatch): the colour it shows is `tool`'s
 * own swatch while it is up, and the one chosen when it closes. Closed with
 * none chosen, everything is as it was.
 */
export async function pickColor(tool: Inked, at: At): Promise<void> {
  if (!canvas() || useInkTools.getState().picking) return;
  const was = kept();
  useInkTools.setState({ picking: tool });
  try {
    const got = await invoke<{ color: string | null }>('ink_color', { color: colorOf(was, tool), at });
    const color = hex(got?.color);
    // none chosen: what the wheel showed meanwhile goes, and whatever else was chosen meanwhile stays
    if (color) put(withCustom(kept(), tool, color));
    else put({ ...kept(), custom: { ...kept().custom, [tool]: was.custom[tool] }, swatch: { ...kept().swatch, [tool]: was.swatch[tool] } });
  } catch (e) {
    console.error(e);
    put({ ...kept(), custom: { ...kept().custom, [tool]: was.custom[tool] }, swatch: { ...kept().swatch, [tool]: was.swatch[tool] } });
  } finally {
    useInkTools.setState({ picking: null });
  }
}

/** What the canvases say of the tools (`window.__ink`, `ink.ts`): what can be undone, and the wheel's colour as it turns. */
export function toolsHeard(e: { kind: 'history'; undo?: boolean; redo?: boolean } | { kind: 'color'; color?: string }): void {
  if (e.kind === 'history') { took({ undo: !!e.undo, redo: !!e.redo }); return; }
  const tool = useInkTools.getState().picking;
  if (tool && e.color) put(withCustom(kept(), tool, e.color));
}
