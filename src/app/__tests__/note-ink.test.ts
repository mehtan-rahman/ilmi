// @vitest-environment jsdom
// Milestone 69 in a note, over a real editor and a store in memory: the
// Pencil's first stroke opens a gap at the place between two blocks nearest
// it; left alone, the page is a row and its line is in the note where the gap
// was, in one step; a stroke erased before that leaves nothing; an area with
// every stroke erased leaves no line; the areas are told to the canvases
// where they lie. The canvases themselves are an iPad's (`ILMI_SMOKE=ink`).

import { EditorView } from 'prosemirror-view';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { fromDoc, makeState } from '../../reader/index.js';
import { inkKey, inkLines } from '../../reader/inkArea.js';
import { Vault, storeFs, type InkStroke, type StoreFs } from '../../vault/index.js';
import { memDrawing, memSplit, memStore } from '../../vault/mem-store.js';
import { useApp } from '../store.js';

const ROOT = '/collections/note';
const NOTE = 'fleeting/working.md';
const stroke = (n: number): InkStroke => ({ stroke: `s${n}`, at: 1000 + n, data: btoa(`stroke ${n}`) });
const b64 = (bytes: Uint8Array): string => btoa(String.fromCharCode(...bytes));

let vault: Vault;
let fs: StoreFs;
const scenes: { hosts: { id: string; open: unknown; sheets: { id: string; frame: { y: number }; hit: { y: number; h: number } }[] }[] }[] = [];
const rested: string[] = [];
let drawn: InkStroke[] | null = null;
vi.mock('@tauri-apps/api/core', () => ({
  invoke: async (cmd: string, args: Record<string, unknown>) => {
    if (cmd === 'dev_env') return null;
    if (cmd === 'ink_scene') { scenes.push(args.scene as (typeof scenes)[number]); return { made: [] }; }
    if (cmd === 'ink_fill') return { took: true };
    if (cmd === 'ink_rest') { rested.push(args.sheet as string); return null; }
    if (cmd === 'ink_bounds') return memSplit(Uint8Array.from(atob(args.drawing as string), (c) => c.charCodeAt(0))).length ? [40, 30, 200, 60] : null;
    if (cmd === 'ink_take') { const d = drawn; drawn = null; return { strokes: d?.length ?? 0, drawing: d ? b64(memDrawing(d)) : null }; }
    if (cmd === 'ink_split') return memSplit(Uint8Array.from(atob(args.drawing as string), (c) => c.charCodeAt(0)));
    throw new Error(`no ${cmd} here`);
  },
}));
vi.mock('../vault.js', async (orig) => {
  const real = await orig<typeof import('../vault.js')>();
  return { ...real, currentVault: () => vault };
});
vi.mock('../crdt.js', () => ({ crdtWrote: () => {} }));
const { addSurface } = await import('../ink.js');
const { noteInk } = await import('../noteInk.js');
globalThis.ResizeObserver ??= class { observe() {} unobserve() {} disconnect() {} } as unknown as typeof ResizeObserver;

/** Each block 100 px tall, one under another, by its place among its siblings; the scroller a screen tall. */
const rectOf = HTMLElement.prototype.getBoundingClientRect;
HTMLElement.prototype.getBoundingClientRect = function (this: HTMLElement) {
  if (this.classList.contains('pane-body')) return new DOMRect(0, 0, 700, 900);
  if (this.classList.contains('draft-doc')) return new DOMRect(50, 0, 600, 800);
  const parent = this.parentElement;
  if (parent?.classList.contains('draft-doc')) {
    const i = Array.from(parent.children).filter((c) => c.tagName === 'P').indexOf(this);
    return new DOMRect(50, i * 120, 600, 100);
  }
  return rectOf.call(this);
};
HTMLElement.prototype.getClientRects = function (this: HTMLElement) { return [this.getBoundingClientRect()] as unknown as DOMRectList; };

const wait = (ms: number) => new Promise((r) => setTimeout(r, ms));
const pencil = (e: Record<string, unknown>) => (window as unknown as { __ink(e: unknown): void }).__ink(e);
const text = () => fromDoc(view.state.doc).map((b) => b.text);

let view: EditorView;
let ink: ReturnType<typeof noteInk>;
let pane: HTMLDivElement;

beforeEach(async () => {
  fs = storeFs(memStore(), ROOT);
  await fs.mkdir(`${ROOT}/fleeting`);
  await fs.writeText(`${ROOT}/${NOTE}`, 'one\n\ntwo\n\nthree\n');
  vault = await Vault.open(fs, ROOT);
  useApp.setState({ mobile: true });
  scenes.length = 0;
  rested.length = 0;
  drawn = null;
  pane = document.body.appendChild(document.createElement('div'));
  pane.className = 'pane-body';
  ink = noteInk(NOTE, addSurface);
  const loaded = await vault.read(NOTE);
  view = new EditorView(pane, { state: makeState(loaded.doc.blocks, { frozen: () => false, pos: null, ink: () => ink.boxes }), attributes: { class: 'draft-doc' } });
  ink.attach(view);
  await wait(10);
});
afterEach(() => {
  ink.destroy();
  view.destroy();
  pane.remove();
  useApp.setState({ mobile: false });
});

const hostId = () => scenes.at(-1)!.hosts[0]!.id;
const begin = (y: number) => pencil({ kind: 'begin', sheet: 'new:1', host: hostId(), fresh: true, x: 100, y, top: y - 28 });

describe('the Pencil on a note', () => {
  it('the column is where a new area opens, with nothing asked', () => {
    expect(scenes.at(-1)!.hosts[0]!.open).toMatchObject({ x: 50, w: 600 });
    expect(scenes.at(-1)!.hosts[0]!.sheets).toEqual([]);
  });

  it('a stroke between two blocks opens a gap there, and left alone it is a page and a line in the note', async () => {
    begin(110);
    const gap = inkKey.getState(view.state)!.gap!;
    expect(gap.id).toBe('new:1');
    // between `one` and `two`
    expect(view.state.doc.resolve(gap.pos).nodeBefore?.textContent).toBe('one');
    await wait(10);
    expect(scenes.at(-1)!.hosts[0]!.sheets.map((s) => s.id)).toEqual(['new:1']);
    // grows with the writing
    const was = gap.height;
    pencil({ kind: 'grow', sheet: 'new:1', y: 200 });
    expect(inkKey.getState(view.state)!.gap!.height).toBeGreaterThan(was);
    // nothing is kept until it is quiet
    expect(text()).toEqual(['one', 'two', 'three']);
    drawn = [stroke(1), stroke(2)];
    pencil({ kind: 'quiet', sheet: 'new:1' });
    await wait(40);
    const line = '![working](working/ink-01.png)';
    expect(text()).toEqual(['one', line, 'two', 'three']);
    expect(inkKey.getState(view.state)!.gap).toBeNull();
    expect((await fs.ink(`${ROOT}/fleeting/working/ink-01.pkdrawing`))?.map((s) => s.stroke)).toEqual(['s1', 's2']);
    expect(inkLines(view.state.doc).map((l) => l.src)).toEqual(['working/ink-01.png']);
    // the canvas is that area's from here on: more strokes are its strokes, and the line is not written again
    drawn = [stroke(1), stroke(2), stroke(3)];
    pencil({ kind: 'quiet', sheet: 'new:1' });
    await wait(40);
    expect((await fs.ink(`${ROOT}/fleeting/working/ink-01.pkdrawing`))?.length).toBe(3);
    expect(text().filter((t) => t === line).length).toBe(1);
  });

  it('a stroke taken back before it is kept leaves nothing', async () => {
    begin(110);
    drawn = [];
    pencil({ kind: 'quiet', sheet: 'new:1' });
    await wait(30);
    expect(inkKey.getState(view.state)!.gap).toBeNull();
    expect(text()).toEqual(['one', 'two', 'three']);
    expect(rested).toEqual(['new:1']);
    expect(await fs.stat(`${ROOT}/fleeting/working/ink-01.pkdrawing`)).toBeNull();
  });

  it('an area with every stroke erased leaves no line', async () => {
    begin(110);
    drawn = [stroke(1)];
    pencil({ kind: 'quiet', sheet: 'new:1' });
    await wait(40);
    drawn = [];
    pencil({ kind: 'quiet', sheet: 'new:1' });
    await wait(40);
    expect(text()).toEqual(['one', 'two', 'three']);
    // and no page: the next one takes its name
    expect(await fs.stat(`${ROOT}/fleeting/working/ink-01.pkdrawing`)).toBeNull();
  });

  it('left with the writing not kept, the line goes in through the vault where the gap was', async () => {
    begin(110);
    await wait(10);
    drawn = [stroke(1)];
    ink.destroy();
    await wait(60);
    expect((await vault.read(NOTE)).doc.blocks.map((b) => b.text)).toEqual(['one', '![working](working/ink-01.png)', 'two', 'three']);
  });
});
