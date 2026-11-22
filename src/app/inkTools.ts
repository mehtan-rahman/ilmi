// The writing tools (milestones 82, 85). The row of tools over pages that can
// be written on is ours (`InkBar.tsx`); PencilKit's picker is gone. What is
// chosen is kept here, one state for the device: the tool, each tool's three
// sizes and which is in use, its colours and which, the colour last taken
// from the wheel and the last few used, the pen's ink, the highlighter's
// opacity, the eraser's way, whether a rested stroke becomes a shape, whether
// a finger draws, and whether the row is shown. It lies in the webview's
// storage, as the settings do (`ilmi.tweaks`, `store.ts`), so it is this
// device's and survives a restart.
//
// The canvases are told (`tauri-plugin-ink`): `ink_tool` whenever the tool in
// use changes, `ink_finger` whenever that does, and both once the canvases
// first exist (after the first scene, `ink.ts`), which is also what a web
// reload comes to. What can be undone is the canvases' to say: in the answer
// to `ink_undo` / `ink_redo`, and in `history` events meanwhile. The colour
// wheel is the system's, opened from a swatch; while it is up its colour is
// that swatch's, live. The Pencil's own double tap and squeeze come from the
// canvases too (`pencil`): a tap goes to the eraser and back, or to the tool
// before, as the system's settings say; a squeeze opens the held tool's
// settings.
//
// The transitions are pure and tested (`ink-bar.test.ts`).

import { invoke } from '@tauri-apps/api/core';
import { create } from 'zustand';
import { useApp } from './store.js';

export type ToolKind = 'pen' | 'highlighter' | 'eraser' | 'select';
/** A pen's ink, by PencilKit's: the pen, a line of one width, a fountain pen, a pencil. */
export type PenInk = 'pen' | 'monoline' | 'fountain' | 'pencil';
export type EraserMode = 'stroke' | 'part';
/**
 * What a canvas is told: `width` is the ink's in points, the eraser's radius
 * in screen points, nothing for select; `ink` a pen's ink; `opacity` how much
 * of a highlighter's colour shows; `mode` the eraser's way; `snap` whether a
 * stroke ended resting becomes a shape.
 */
export interface Tool { kind: ToolKind; color: string; width: number; ink?: PenInk; sense?: number; opacity?: number; mode?: EraserMode; snap?: boolean }

export const TOOLS: readonly ToolKind[] = ['pen', 'highlighter', 'eraser', 'select'];
/** A tool with sizes; and one with colours. */
export type Sized = 'pen' | 'highlighter' | 'eraser';
export type Inked = 'pen' | 'highlighter';
export const isSized = (t: ToolKind): t is Sized => t !== 'select';
export const isInked = (t: ToolKind): t is Inked => t === 'pen' || t === 'highlighter';

export type Three = readonly [number, number, number];
/** Three sizes each, thin to thick, as they start. A pen's and a highlighter's in points of the page; an eraser's radius in points of the screen. */
export const SIZES: Record<Sized, Three> = {
  pen: [1.2, 2.2, 3.6],
  highlighter: [10, 16, 24],
  eraser: [8, 16, 28],
};
export const SIZE_NAMES = ['thin', 'medium', 'thick'] as const;
/** How thin and how thick each can be made. */
export const WIDTHS: Record<Sized, readonly [number, number]> = {
  pen: [0.2, 8],
  highlighter: [6, 40],
  eraser: [4, 48],
};

/** The pen's inks, in the order they are offered, by the words they are offered under. */
export const INKS: readonly { ink: PenInk; name: string }[] = [
  { ink: 'pen', name: 'pen' },
  { ink: 'monoline', name: 'fine' },
  { ink: 'fountain', name: 'fountain' },
  { ink: 'pencil', name: 'pencil' },
];
const isInk = (v: unknown): v is PenInk => INKS.some((i) => i.ink === v);

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
/** How many colours lately used are remembered for each tool. */
export const RECENT = 8;
/** The least of a highlighter's colour that shows. */
export const OPACITY_MIN = 0.2;
/** The most a pen's line may follow pressure: twice what the ink does by itself. */
export const SENSE_MAX = 2;
/** The inks whose line changes with pressure: the ones `sensitivity` is offered for. */
export const SENSES: readonly PenInk[] = ['pen', 'fountain'];

/** What is kept. */
export interface Kept {
  tool: ToolKind;
  /** The tool held before this one: where the Pencil's double tap goes back to. */
  last: ToolKind;
  /** Which of its three sizes each tool is at. */
  size: Record<Sized, number>;
  /** Each tool's three sizes: as they start until one is changed. */
  widths: Record<Sized, Three>;
  /** Which swatch each is at: one of the presets, or `CUSTOM`. */
  swatch: Record<Inked, number>;
  /** Each tool's four swatches, `#rrggbb`: as they start until one is replaced. */
  colors: Record<Inked, readonly string[]>;
  /** The colour last chosen from the wheel for each, `#rrggbb`; null until one is. */
  custom: Record<Inked, string | null>;
  /** The colours lately taken from the wheel for each, the newest first. */
  recent: Record<Inked, readonly string[]>;
  /** The pen's ink. */
  ink: PenInk;
  /** How much a pen's line follows the hand's pressure, 0 (not at all: an even line) to `SENSE_MAX`; 1 is the ink's own. For the inks that follow it (`SENSES`). */
  sense: number;
  /** How much of a highlighter's colour shows, `OPACITY_MIN` to 1. */
  opacity: number;
  /** The eraser takes a whole stroke, or the part of it under it. */
  eraser: EraserMode;
  /** A stroke ended with the Pencil resting becomes a line, an arrow, a rectangle or an ellipse. */
  snap: boolean;
  /** A finger draws too. */
  finger: boolean;
  /** The row of tools is shown; tucked away, the Pencil still writes. */
  shown: boolean;
}

export const DEFAULTS: Kept = {
  tool: 'pen',
  last: 'pen',
  size: { pen: 1, highlighter: 1, eraser: 1 },
  widths: SIZES,
  swatch: { pen: 0, highlighter: 0 },
  colors: { pen: SWATCHES.pen.map((s) => s.color), highlighter: SWATCHES.highlighter.map((s) => s.color) },
  custom: { pen: null, highlighter: null },
  recent: { pen: [], highlighter: [] },
  ink: 'monoline',
  sense: 1,
  opacity: 1,
  eraser: 'stroke',
  snap: true,
  finger: false,
  shown: true,
};

const HEX = /^#[0-9a-f]{6}$/;
/** A colour as it is kept: `#rrggbb` in lowercase; null for anything else. */
export const hex = (c: unknown): string | null => (typeof c === 'string' && HEX.test(c.toLowerCase()) ? c.toLowerCase() : null);

const clamp = (v: number, lo: number, hi: number): number => Math.min(hi, Math.max(lo, v));
/** A width as it is kept: a tenth of a point at the finest. */
const tenth = (v: number): number => Math.round(v * 10) / 10;

// ── the transitions ──

export const withTool = (k: Kept, tool: ToolKind): Kept => (k.tool === tool ? k : { ...k, tool, last: k.tool });

export const withSize = (k: Kept, tool: Sized, size: number): Kept =>
  size === k.size[tool] || !(size >= 0 && size < 3) ? k : { ...k, size: { ...k.size, [tool]: size } };

/** The size in use made `width`, held to what the tool can be. */
export const withWidth = (k: Kept, tool: Sized, width: number): Kept => {
  if (!Number.isFinite(width)) return k;
  const w = tenth(clamp(width, WIDTHS[tool][0], WIDTHS[tool][1]));
  const at = k.size[tool];
  if (k.widths[tool][at] === w) return k;
  const three = k.widths[tool].map((v, i) => (i === at ? w : v)) as unknown as Three;
  return { ...k, widths: { ...k.widths, [tool]: three } };
};

/** The swatch a tool is at; the wheel's only once it has a colour. */
export const withSwatch = (k: Kept, tool: Inked, swatch: number): Kept => {
  const ok = swatch === CUSTOM ? k.custom[tool] !== null : Number.isInteger(swatch) && swatch >= 0 && swatch < SWATCHES[tool].length;
  return !ok || swatch === k.swatch[tool] ? k : { ...k, swatch: { ...k.swatch, [tool]: swatch } };
};

/** `color` among the colours lately used, the newest first, each once. */
const remembered = (list: readonly string[], color: string): readonly string[] => [color, ...list.filter((c) => c !== color)].slice(0, RECENT);

/** A colour from the wheel: that tool's own swatch, and the one in use. */
export const withCustom = (k: Kept, tool: Inked, color: string): Kept => {
  const c = hex(color);
  if (!c || (k.custom[tool] === c && k.swatch[tool] === CUSTOM)) return k;
  return { ...k, custom: { ...k.custom, [tool]: c }, swatch: { ...k.swatch, [tool]: CUSTOM } };
};

/** One of a tool's four swatches replaced by `color`, and in use. */
export const withColor = (k: Kept, tool: Inked, swatch: number, color: string): Kept => {
  const c = hex(color);
  if (!c || !Number.isInteger(swatch) || swatch < 0 || swatch >= SWATCHES[tool].length) return k;
  if (k.colors[tool][swatch] === c && k.swatch[tool] === swatch) return k;
  return { ...k, colors: { ...k.colors, [tool]: k.colors[tool].map((v, i) => (i === swatch ? c : v)) }, swatch: { ...k.swatch, [tool]: swatch } };
};

/** A colour the wheel closed on is among the tool's last few. */
export const withRecent = (k: Kept, tool: Inked, color: string): Kept => {
  const c = hex(color);
  return !c || k.recent[tool][0] === c ? k : { ...k, recent: { ...k.recent, [tool]: remembered(k.recent[tool], c) } };
};

export const withInk = (k: Kept, ink: PenInk): Kept => (k.ink === ink || !isInk(ink) ? k : { ...k, ink });
export const withSense = (k: Kept, sense: number): Kept => {
  if (!Number.isFinite(sense)) return k;
  const v = Math.round(clamp(sense, 0, SENSE_MAX) * 20) / 20;
  return v === k.sense ? k : { ...k, sense: v };
};
export const withOpacity = (k: Kept, opacity: number): Kept => {
  if (!Number.isFinite(opacity)) return k;
  const o = Math.round(clamp(opacity, OPACITY_MIN, 1) * 100) / 100;
  return o === k.opacity ? k : { ...k, opacity: o };
};
export const withEraser = (k: Kept, eraser: EraserMode): Kept => (k.eraser === eraser || (eraser !== 'stroke' && eraser !== 'part') ? k : { ...k, eraser });
export const withSnap = (k: Kept, snap: boolean): Kept => (k.snap === snap ? k : { ...k, snap });
export const withFinger = (k: Kept, finger: boolean): Kept => (k.finger === finger ? k : { ...k, finger });
export const withShown = (k: Kept, shown: boolean): Kept => (k.shown === shown ? k : { ...k, shown });

/**
 * The Pencil tapped twice: to the eraser, and from it back to the tool held
 * before; or, where the system's setting is the tool before, to that.
 * `ignore` does nothing.
 */
export const withPencilTap = (k: Kept, prefer: string): Kept => {
  if (prefer === 'ignore') return k;
  if (prefer === 'previous') return withTool(k, k.last);
  return withTool(k, k.tool === 'eraser' ? (k.last === 'eraser' ? 'pen' : k.last) : 'eraser');
};

/** The colour a tool writes in. */
export const colorOf = (k: Kept, tool: Inked): string =>
  (k.swatch[tool] === CUSTOM ? k.custom[tool] : null) ?? k.colors[tool][k.swatch[tool]] ?? SWATCHES[tool][0]!.color;

/** What a swatch is called: its colour's name while it is the one it started as, else its place. */
export const swatchName = (k: Kept, tool: Inked, i: number): string =>
  (k.colors[tool][i] === SWATCHES[tool][i]?.color ? SWATCHES[tool][i]!.name : `colour ${i + 1}`);

/** The widths an ink takes on this device (`ink_caps`), where known. */
export type Ranges = Partial<Record<string, readonly [number, number]>>;

/** How thin and how thick a tool can be made here: a pen's by its ink. */
export function rangeOf(k: Kept, tool: Sized, ranges?: Ranges | null): readonly [number, number] {
  const [lo, hi] = WIDTHS[tool];
  const own = tool === 'pen' ? ranges?.[k.ink] : tool === 'highlighter' ? ranges?.marker : undefined;
  if (!own) return [lo, hi];
  // (a pen may be thinner than PencilKit's thinnest: its strokes are thinned as they are handed over)
  const a = tool === 'pen' ? lo : Math.ceil(Math.max(lo, own[0]) * 10) / 10;
  const b = Math.floor(Math.min(hi, own[1]) * 10) / 10;
  return a < b ? [a, b] : [lo, hi];
}

/** The width a tool's size in use comes to here. */
export function widthOf(k: Kept, tool: Sized, ranges?: Ranges | null): number {
  const [lo, hi] = rangeOf(k, tool, ranges);
  return clamp(k.widths[tool][k.size[tool]] ?? SIZES[tool][1], lo, hi);
}

/** What the canvases are told for what is chosen. */
export function toolOf(k: Kept, ranges?: Ranges | null): Tool {
  const kind = k.tool;
  const t: Tool = { kind, color: isInked(kind) ? colorOf(k, kind) : '#000000', width: isSized(kind) ? widthOf(k, kind, ranges) : 0 };
  if (kind === 'pen') { t.ink = k.ink; t.snap = k.snap; if (SENSES.includes(k.ink) && k.sense !== 1) t.sense = k.sense; }
  if (kind === 'highlighter') { t.opacity = k.opacity; t.snap = k.snap; }
  if (kind === 'eraser') t.mode = k.eraser;
  return t;
}

/** What was kept, read back: anything it does not say, or says wrongly, is as it starts. */
export function parse(raw: string | null | undefined): Kept {
  if (!raw) return DEFAULTS;
  try {
    const t = JSON.parse(raw) as Partial<Kept> | null;
    if (!t || typeof t !== 'object') return DEFAULTS;
    const size = (tool: Sized): number => { const n = t.size?.[tool]; return n === 0 || n === 1 || n === 2 ? n : DEFAULTS.size[tool]; };
    const widths = (tool: Sized): Three => {
      const w = t.widths?.[tool];
      if (!Array.isArray(w) || w.length !== 3 || !w.every((v) => typeof v === 'number' && Number.isFinite(v))) return SIZES[tool];
      return w.map((v) => tenth(clamp(v as number, WIDTHS[tool][0], WIDTHS[tool][1]))) as unknown as Three;
    };
    const custom = (tool: Inked): string | null => hex(t.custom?.[tool]);
    const swatch = (tool: Inked): number => {
      const n = t.swatch?.[tool];
      if (n === CUSTOM) return custom(tool) ? CUSTOM : DEFAULTS.swatch[tool];
      return typeof n === 'number' && Number.isInteger(n) && n >= 0 && n < SWATCHES[tool].length ? n : DEFAULTS.swatch[tool];
    };
    const colors = (tool: Inked): readonly string[] => {
      const c = t.colors?.[tool];
      return SWATCHES[tool].map((s, i) => (Array.isArray(c) ? hex(c[i]) : null) ?? s.color);
    };
    const recent = (tool: Inked): readonly string[] => {
      const c = t.recent?.[tool];
      return Array.isArray(c) ? [...new Set(c.map(hex).filter((v): v is string => v !== null))].slice(0, RECENT) : [];
    };
    const tool = TOOLS.includes(t.tool as ToolKind) ? (t.tool as ToolKind) : DEFAULTS.tool;
    return {
      tool,
      last: TOOLS.includes(t.last as ToolKind) ? (t.last as ToolKind) : tool,
      size: { pen: size('pen'), highlighter: size('highlighter'), eraser: size('eraser') },
      widths: { pen: widths('pen'), highlighter: widths('highlighter'), eraser: widths('eraser') },
      swatch: { pen: swatch('pen'), highlighter: swatch('highlighter') },
      colors: { pen: colors('pen'), highlighter: colors('highlighter') },
      custom: { pen: custom('pen'), highlighter: custom('highlighter') },
      recent: { pen: recent('pen'), highlighter: recent('highlighter') },
      // (what was kept before 86 had the soft pen as it started, never chosen: it starts as the even line now)
      ink: isInk(t.ink) && ((t as { v?: number }).v === KEPT_V || t.ink !== 'pen') ? t.ink : DEFAULTS.ink,
      sense: typeof t.sense === 'number' && Number.isFinite(t.sense) ? Math.round(clamp(t.sense, 0, SENSE_MAX) * 20) / 20 : DEFAULTS.sense,
      opacity: typeof t.opacity === 'number' && Number.isFinite(t.opacity) ? Math.round(clamp(t.opacity, OPACITY_MIN, 1) * 100) / 100 : DEFAULTS.opacity,
      eraser: t.eraser === 'part' || t.eraser === 'stroke' ? t.eraser : DEFAULTS.eraser,
      snap: typeof t.snap === 'boolean' ? t.snap : DEFAULTS.snap,
      finger: typeof t.finger === 'boolean' ? t.finger : DEFAULTS.finger,
      shown: typeof t.shown === 'boolean' ? t.shown : DEFAULTS.shown,
    };
  } catch {
    return DEFAULTS;
  }
}

// ── kept per device, and the canvases told ──

export const INK_KEY = 'ilmi.ink';
/** What is kept says which shape of it this is: 2 since the pen starts as the even line (86). */
const KEPT_V = 2;

function load(): Kept {
  try { return parse(globalThis.localStorage?.getItem(INK_KEY)); } catch { return DEFAULTS; }
}
function save(k: Kept): void {
  try { globalThis.localStorage?.setItem(INK_KEY, JSON.stringify({ ...k, v: KEPT_V })); } catch { /* no storage: the session keeps them */ }
}

/** The wheel is up for one of a tool's swatches (`slot` a preset's place), or for its own (`CUSTOM`). */
export interface Picking { tool: Inked; slot: number }

export interface InkTools {
  kept: Kept;
  /** What the canvases can take back and put back. */
  undo: boolean;
  redo: boolean;
  /** The colour wheel is up. */
  picking: Picking | null;
  /** The tool whose settings are open under the row. */
  open: ToolKind | null;
  /** The tool whose size in use is being set: its preset pressed again (2026-11-25), its width under it. */
  sizing: Sized | null;
  /** What this device's PencilKit takes (`ink_caps`): the inks there are and their widths. Null until asked, and where there is no canvas. */
  caps: { inks: Ranges; squeeze: boolean } | null;
}

export const useInkTools = create<InkTools>(() => ({ kept: load(), undo: false, redo: false, picking: null, open: null, sizing: null, caps: null }));

/** Whether there is a canvas to tell: an iPad's (`hasCanvas`, `ink.ts`). */
const canvas = (): boolean => useApp.getState().mobile;
const ranges = (): Ranges | null => useInkTools.getState().caps?.inks ?? null;

/** The pen's inks there are on this device: all of them until it has said. */
export const inksHere = (caps: InkTools['caps']): readonly { ink: PenInk; name: string }[] => (caps ? INKS.filter((i) => caps.inks[i.ink]) : INKS);

/** A finger draws only while the row is shown: tucked away for reading, a finger scrolls. */
const fingerOn = (k: Kept): boolean => k.finger && k.shown;

/** Each telling is numbered: two changes made in one turn are two calls that may arrive either way round, and the canvases keep the later-numbered (found by a check on a simulated iPad, 87). */
let tellings = 0;
const tellTool = (k: Kept): void => { if (canvas()) void invoke<void>('ink_tool', { tool: toolOf(k, ranges()), seq: ++tellings }).catch(console.error); };
const tellFinger = (k: Kept): void => { if (canvas()) void invoke<void>('ink_finger', { on: fingerOn(k) }).catch(console.error); };

const sameTool = (a: Tool, b: Tool): boolean =>
  a.kind === b.kind && a.color === b.color && a.width === b.width && a.ink === b.ink && a.sense === b.sense && a.opacity === b.opacity && a.mode === b.mode && a.snap === b.snap;

/** `next` is what is chosen: kept, and the canvases told what of it changed for them. */
function put(next: Kept): void {
  const was = useInkTools.getState().kept;
  if (next === was) return;
  useInkTools.setState({ kept: next });
  save(next);
  if (!sameTool(toolOf(was, ranges()), toolOf(next, ranges()))) tellTool(next);
  if (fingerOn(was) !== fingerOn(next)) tellFinger(next);
}

const kept = (): Kept => useInkTools.getState().kept;

export const setTool = (tool: ToolKind): void => put(withTool(kept(), tool));
export const setSize = (tool: Sized, size: number): void => put(withSize(kept(), tool, size));
export const setWidth = (tool: Sized, width: number): void => put(withWidth(kept(), tool, width));
export const setSwatch = (tool: Inked, swatch: number): void => put(withSwatch(kept(), tool, swatch));
/** One of the colours lately used, in use again: the tool's own swatch. */
export const setRecent = (tool: Inked, color: string): void => put(withCustom(kept(), tool, color));
export const setInk = (ink: PenInk): void => put(withInk(kept(), ink));
export const setSense = (sense: number): void => put(withSense(kept(), sense));
export const setOpacity = (opacity: number): void => put(withOpacity(kept(), opacity));
export const setEraser = (mode: EraserMode): void => put(withEraser(kept(), mode));
export const setSnap = (on: boolean): void => put(withSnap(kept(), on));
export const setFinger = (on: boolean): void => put(withFinger(kept(), on));
/** The row shown, or tucked away; tucked, its settings close. */
export const setShown = (on: boolean): void => { if (!on) { setOpen(null); setSizing(null); } put(withShown(kept(), on)); };
/** A tool's settings opened under the row, or (null) closed. */
export const setOpen = (tool: ToolKind | null): void => { if (useInkTools.getState().open !== tool) useInkTools.setState({ open: tool }); };
/** A tool's size in use being set (its preset pressed again), or (null) not. */
export const setSizing = (tool: Sized | null): void => { if (useInkTools.getState().sizing !== tool) useInkTools.setState({ sizing: tool }); };
/**
 * A tool's preset pressed (2026-11-25): another is chosen, and the width it holds is the tool's; the one in use,
 * pressed again, has its width set under it (the slider), and what is set is kept in that preset. Pressed again
 * while it is being set, it is put away.
 */
export const pressSize = (tool: Sized, size: number): void => {
  if (kept().size[tool] !== size) { setSizing(null); setSize(tool, size); return; }
  setSizing(useInkTools.getState().sizing === tool ? null : tool);
};

let told = false;
/** The canvases exist (the first scene reached them, `ink.ts`): they are told the tool and the finger, once, and asked what inks they have. */
export function canvasesReady(): void {
  if (told || !canvas()) return;
  told = true;
  tellTool(kept());
  tellFinger(kept());
  void invoke<{ inks?: Record<string, number[]>; squeeze?: boolean } | null>('ink_caps', {}).then((c) => {
    if (!c?.inks) return;
    const inks: Ranges = {};
    for (const [name, r] of Object.entries(c.inks)) if (Array.isArray(r) && r.length === 2 && r[0]! < r[1]!) inks[name] = [r[0]!, r[1]!];
    useInkTools.setState({ caps: { inks, squeeze: !!c.squeeze } });
    // an ink this device has not is the pen; a width it does not take is the nearest it does
    if (!inks[kept().ink]) put(withInk(kept(), 'pen'));
    tellTool(kept());
  }, () => {});
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

/** The colour a slot shows: one of the four, or the tool's own. */
const slotColor = (k: Kept, tool: Inked, slot: number): string | null => (slot === CUSTOM ? k.custom[tool] : k.colors[tool][slot] ?? null);
const withSlot = (k: Kept, tool: Inked, slot: number, color: string): Kept => (slot === CUSTOM ? withCustom(k, tool, color) : withColor(k, tool, slot, color));

/**
 * The colour wheel, from `at` (a swatch): the colour it shows is that
 * swatch's while it is up, and the one chosen when it closes: the tool's own
 * swatch (`slot` left out), or one of its four replaced. Closed with none
 * chosen, everything is as it was.
 */
export async function pickColor(tool: Inked, at: At, slot: number = CUSTOM): Promise<void> {
  if (!canvas() || useInkTools.getState().picking) return;
  const was = kept();
  useInkTools.setState({ picking: { tool, slot } });
  /** As it was for this tool's colours, whatever else was chosen meanwhile. */
  const back = (): Kept => ({ ...kept(), custom: { ...kept().custom, [tool]: was.custom[tool] }, colors: { ...kept().colors, [tool]: was.colors[tool] }, swatch: { ...kept().swatch, [tool]: was.swatch[tool] } });
  try {
    const got = await invoke<{ color: string | null }>('ink_color', { color: slotColor(was, tool, slot) ?? colorOf(was, tool), at });
    const color = hex(got?.color);
    // none chosen: what the wheel showed meanwhile goes
    if (color) put(withRecent(withSlot(kept(), tool, slot, color), tool, color));
    else put(back());
  } catch (e) {
    console.error(e);
    put(back());
  } finally {
    useInkTools.setState({ picking: null });
  }
}

/** What the canvases say of the tools (`window.__ink`, `ink.ts`): what can be undone, the wheel's colour as it turns, the Pencil tapped or squeezed. */
export function toolsHeard(e: { kind: 'history'; undo?: boolean; redo?: boolean } | { kind: 'color'; color?: string } | { kind: 'pencil'; what?: string; prefer?: string }): void {
  if (e.kind === 'history') { took({ undo: !!e.undo, redo: !!e.redo }); return; }
  if (e.kind === 'pencil') {
    if (e.what === 'squeeze') {
      // the held tool's settings, the row brought back for them; squeezed again they close
      const k = kept();
      if (!k.shown) put(withShown(k, true));
      setOpen(useInkTools.getState().open === k.tool || k.tool === 'select' ? null : k.tool);
      return;
    }
    put(withPencilTap(kept(), e.prefer ?? 'eraser'));
    return;
  }
  const at = useInkTools.getState().picking;
  if (at && e.color) put(withSlot(kept(), at.tool, at.slot, e.color));
}
