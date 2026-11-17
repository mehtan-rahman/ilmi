// @vitest-environment jsdom
// Ink in a typed note (milestones 69, 82), over a real editor and a store in
// memory. A typed note takes no new handwriting: its host opens nothing, and
// a Pencil's touch on its text inserts no line and keeps no page. A note
// that already holds an ink line still shows it as an area, a sheet told to
// the canvases where it lies; strokes written into it are kept, it grows at
// its foot, and with every stroke erased its line and its page go. The
// canvases themselves are an iPad's (`ILMI_SMOKE=ink`).

import { EditorView } from 'prosemirror-view';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { fromDoc, makeState } from '../../reader/index.js';
import { inkLines } from '../../reader/inkArea.js';
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
    if (cmd === 'ink_tool' || cmd === 'ink_finger') return null;
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
let held: boolean[] = [];

const PAGE = `${ROOT}/fleeting/working/ink-01.pkdrawing`;
const SHEET = 'fleeting/working/ink-01.pkdrawing';
const LINE = '![working](working/ink-01.png)';

/** The note open with `body`, an iPad's. */
async function openNote(body: string, before?: () => Promise<void>): Promise<void> {
  fs = storeFs(memStore(), ROOT);
  await fs.mkdir(`${ROOT}/fleeting`);
  await fs.writeText(`${ROOT}/${NOTE}`, body);
  await before?.();
  vault = await Vault.open(fs, ROOT);
  useApp.setState({ mobile: true });
  scenes.length = 0;
  rested.length = 0;
  drawn = null;
  held = [];
  pane = document.body.appendChild(document.createElement('div'));
  pane.className = 'pane-body';
  ink = noteInk(NOTE, addSurface, (has) => held.push(has));
  const loaded = await vault.read(NOTE);
  view = new EditorView(pane, { state: makeState(loaded.doc.blocks, { frozen: () => false, pos: null, ink: () => ink.boxes }), attributes: { class: 'draft-doc' } });
  ink.attach(view);
  await wait(20);
}
afterEach(() => {
  ink.destroy();
  view.destroy();
  pane.remove();
  useApp.setState({ mobile: false });
});

const host = () => scenes.at(-1)!.hosts[0]!;

describe('the Pencil on a typed note', () => {
  beforeEach(() => openNote('one\n\ntwo\n\nthree\n'));

  it('opens no writing: the host says nowhere, and there is no sheet', () => {
    expect(host().open).toBeNull();
    expect(host().sheets).toEqual([]);
    expect(held).toEqual([]);
  });

  it('a touch on its text inserts no line, holds no gap open and keeps no page', async () => {
    // what the canvases said of a new area before milestone 82
    pencil({ kind: 'begin', sheet: 'new:1', host: host().id, fresh: true, x: 100, y: 110, top: 82 });
    pencil({ kind: 'grow', sheet: 'new:1', y: 200 });
    await wait(10);
    expect(view.dom.querySelector('.ink-gap')).toBeNull();
    expect(host().open).toBeNull();
    expect(host().sheets).toEqual([]);
    drawn = [stroke(1), stroke(2)];
    pencil({ kind: 'quiet', sheet: 'new:1' });
    await wait(40);
    expect(text()).toEqual(['one', 'two', 'three']);
    expect(inkLines(view.state.doc)).toEqual([]);
    expect(await fs.stat(PAGE)).toBeNull();
    // the drawing was never asked for
    expect(drawn).not.toBeNull();
    ink.destroy();
    await wait(40);
    expect((await vault.read(NOTE)).doc.blocks.map((b) => b.text)).toEqual(['one', 'two', 'three']);
  });
});

describe('a note that already holds ink', () => {
  beforeEach(() => openNote(`one\n\n${LINE}\n\ntwo\n`, async () => {
    await fs.mkdir(`${ROOT}/fleeting/working`);
    await fs.setInk(PAGE, [stroke(1), stroke(2)]);
  }));

  it('shows it as an area and a sheet where its line lies, and still opens nothing', () => {
    expect(held).toEqual([true]);
    expect(ink.boxes.get('working/ink-01.png')).toMatchObject({ live: false });
    expect(view.dom.querySelector('p.ink-area')).not.toBeNull();
    expect(host().open).toBeNull();
    expect(host().sheets.map((s) => s.id)).toEqual([SHEET]);
    // the second block: its line's paragraph
    expect(host().sheets[0]!.hit.y).toBe(120);
  });

  it('keeps strokes written into it, grows at its foot, and its line is written once', async () => {
    pencil({ kind: 'begin', sheet: SHEET, host: host().id, x: 100, y: 150 });
    expect(view.dom.querySelector('p.ink-area.ink-live')).not.toBeNull();
    const was = ink.boxes.get('working/ink-01.png')!.height;
    pencil({ kind: 'grow', sheet: SHEET, y: 200 });
    expect(ink.boxes.get('working/ink-01.png')!.height).toBeGreaterThan(was);
    drawn = [stroke(1), stroke(2), stroke(3)];
    pencil({ kind: 'quiet', sheet: SHEET });
    await wait(40);
    expect((await fs.ink(PAGE))?.map((s) => s.stroke)).toEqual(['s1', 's2', 's3']);
    // one erased with the eraser, in place
    drawn = [stroke(1), stroke(3)];
    pencil({ kind: 'quiet', sheet: SHEET });
    await wait(40);
    expect((await fs.ink(PAGE))?.map((s) => s.stroke)).toEqual(['s1', 's3']);
    expect(text()).toEqual(['one', LINE, 'two']);
  });

  it('loses its line and its page when every stroke is erased, and is a note with no ink from then on', async () => {
    pencil({ kind: 'begin', sheet: SHEET, host: host().id, x: 100, y: 150 });
    drawn = [];
    pencil({ kind: 'quiet', sheet: SHEET });
    await wait(40);
    expect(text()).toEqual(['one', 'two']);
    expect(await fs.stat(PAGE)).toBeNull();
    expect(rested).toContain(SHEET);
    ink.changed();
    await wait(10);
    expect(held).toEqual([true, false]);
    expect(host().sheets).toEqual([]);
    expect(host().open).toBeNull();
  });
});
