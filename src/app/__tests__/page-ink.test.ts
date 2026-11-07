// @vitest-environment jsdom
// Milestones 67 and 69 on a book's pages, drawn in jsdom over a stand-in for
// the PDF and a store in memory: where there is a canvas the pages are told
// to it as sheets, each lying where its page lies; a press that says `pen`
// and reaches the page boxes nothing; what a canvas gives when the writing
// goes quiet is that page's strokes, found by the PDF's hash and the page's
// number, the page's picture standing aside while the canvas is over it. A
// finger and a mouse still box. Every device lays a picture of the strokes
// over the page, the Mac too, made again when they change by a write here or
// a merge. The canvases themselves are an iPad's (`ILMI_SMOKE=pageink`).

import { act, createElement } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { Vault, storeFs, type InkStroke, type StoreFs } from '../../vault/index.js';
import { memDrawing, memPagePicture, memSplit, memStore } from '../../vault/mem-store.js';
import { useApp, type DocInfo } from '../store.js';
import { HOLD_MS } from '../touch.js';

const ROOT = '/collections/book';
const CH3 = 'library/lindqvist/ch-3.md';
const PDF = 'library/lindqvist.pdf';
const NOTES = ['---', 'type: source', 'pdf: ../lindqvist.pdf', 'pages: 41-42', '---', '', 'Notes.', ''].join('\n');
const W = 600;
const H = 800;
const stroke = (n: number): InkStroke => ({ stroke: `s${n}`, at: 1000 + n, data: btoa(`stroke ${n}`) });
const b64 = (bytes: Uint8Array): string => btoa(String.fromCharCode(...bytes));

let vault: Vault;
let fs: StoreFs;
let hash: string;

/** What the canvases were told, and what a sheet gives when asked. */
const scenes: { hosts: { id: string; port: { h: number }; open: unknown; sheets: { id: string; frame: { y: number; h: number }; hit: { y: number }; zoom: number }[] }[] }[] = [];
const filled: { sheet: string; drawing: string | null }[] = [];
const rested: string[] = [];
let drawn: InkStroke[] | null = null;
/** A canvas being written on keeps what it has. */
let writing = false;
vi.mock('@tauri-apps/api/core', () => ({
  invoke: async (cmd: string, args: Record<string, unknown>) => {
    if (cmd === 'dev_env') return null;
    if (cmd === 'ink_scene') { scenes.push(args.scene as (typeof scenes)[number]); return null; }
    if (cmd === 'ink_fill') { filled.push(args as (typeof filled)[number]); return { took: !writing }; }
    if (cmd === 'ink_rest') { rested.push(args.sheet as string); return null; }
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
const page = { getViewport: ({ scale }: { scale: number }) => ({ width: W * scale, height: H * scale }), render: () => ({ promise: Promise.resolve() }), streamTextContent: () => null };
vi.mock('../bookPdf.js', () => ({
  fillCrops: () => {},
  acquirePdf: () => ({ promise: Promise.resolve({ numPages: 44, getPage: async () => page }), release() {} }),
  itemsOf: async () => [],
}));
vi.mock('../pdfjs.js', () => ({ TextLayer: class { render() { return Promise.resolve(); } }, pageBits: async () => [{ str: 'text' }] }));
const { Pdf } = await import('../Pdf.js');
(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
globalThis.ResizeObserver ??= class { observe() {} unobserve() {} disconnect() {} } as unknown as typeof ResizeObserver;
globalThis.IntersectionObserver ??= class { observe() {} unobserve() {} disconnect() {} } as unknown as typeof IntersectionObserver;
Element.prototype.scrollIntoView ??= function () {};
// jsdom has no object URLs: a picture is known by what it was made from
const pictures = new Map<string, string>();
let urls = 0;
URL.createObjectURL = ((b: Blob) => { const u = `blob:ink/${++urls}`; void b.text().then((t) => pictures.set(u, t)); return u; }) as typeof URL.createObjectURL;
URL.revokeObjectURL = () => {};
const rectOf = HTMLElement.prototype.getBoundingClientRect;
HTMLElement.prototype.getBoundingClientRect = function (this: HTMLElement) {
  if (this.classList.contains('pdf-page')) return new DOMRect(0, (Number(this.dataset.page) - 41) * (H + 18), W, H);
  if (this.classList.contains('book-pages')) return new DOMRect(0, 0, W, 900);
  return rectOf.call(this);
};
HTMLElement.prototype.getClientRects = function (this: HTMLElement) { return [this.getBoundingClientRect()] as unknown as DOMRectList; };

let host: HTMLDivElement;
let root: Root;
const wait = (ms: number) => act(async () => { await new Promise((r) => setTimeout(r, ms)); });
const q = <T extends Element>(sel: string) => host.querySelector<T>(sel);
const qa = <T extends Element>(sel: string) => Array.from(host.querySelectorAll<T>(sel));
const pending = () => qa('.pbox.pending:not(.ghost)').length;
const ptr = (type: string, pointerType: string, x: number, y: number) =>
  new PointerEvent(type, { bubbles: true, cancelable: true, pointerId: 3, pointerType, isPrimary: true, button: 0, clientX: x, clientY: y });
const fire = async (target: EventTarget, e: Event) => { await act(async () => { target.dispatchEvent(e); }); return e; };
const pageEl = (n: number) => q<HTMLElement>(`.pdf-page[data-page="${n}"]`)!;
const inkOn = (n: number) => q<HTMLImageElement>(`img.page-ink[data-page="${n}"]`);

beforeAll(async () => {
  fs = storeFs(memStore(), ROOT);
  await fs.mkdir(`${ROOT}/library/lindqvist`);
  await fs.writeText(`${ROOT}/${CH3}`, NOTES);
  await fs.writeBytes(`${ROOT}/${PDF}`, new Uint8Array([0x25, 0x50, 0x44, 0x46, 0xff, 0xfe]));
  vault = await Vault.open(fs, ROOT);
  hash = fs.blobAt(`${ROOT}/${PDF}`)!;
  const docs: Record<string, DocInfo> = { [CH3]: { type: 'source', frozen: false, cards: 0, due: 0, pdf: PDF, pages: { first: 41, last: 42 } } };
  useApp.setState({ vault: ROOT, tree: vault.tree, files: vault.documents(), docs, inlineBoxes: {}, bookFocus: null, reveal: null });
});
beforeEach(async () => {
  scenes.length = 0;
  filled.length = 0;
  rested.length = 0;
  drawn = null;
  writing = false;
  await fs.setPageInk(hash, 41, []);
  await fs.setPageInk(hash, 42, []);
  useApp.setState({ mobile: true });
  host = document.body.appendChild(document.createElement('div'));
  root = createRoot(host);
  await act(async () => { root.render(createElement(Pdf, { id: CH3 })); });
  await wait(40);
  expect(qa<HTMLElement>('.pdf-page').map((p) => p.dataset.page)).toEqual(['41', '42']);
});
afterEach(() => {
  act(() => root.unmount());
  host.remove();
});

describe('a book\'s page under the Pencil', () => {
  /** The native side says the Pencil did this. */
  const pencil = (e: Record<string, unknown>) => act(async () => { (window as unknown as { __ink(e: unknown): void }).__ink(e); });
  const sheet = (n: number) => `p.${hash}.${n}`;
  const lastHost = () => scenes.at(-1)!.hosts[0]!;
  /** Until page `n`'s canvas has been given what the store holds. */
  const told = async (n: number) => { for (let i = 0; i < 40 && !filled.some((f) => f.sheet === sheet(n) && f.drawing); i++) await wait(20); await wait(20); };
  /** A picture's load, which jsdom never fires. */
  const loaded = async (n: number) => { await wait(30); const i = inkOn(n); if (i) await act(async () => { i.dispatchEvent(new Event('load')); }); await wait(60); };

  it('the pages are told to the canvases where they lie, and nothing is there to open', async () => {
    await wait(20);
    const host = lastHost();
    expect(host.id).toBe(`pages:${CH3}`);
    expect(host.open).toBeNull();
    expect(host.sheets.map((s) => s.id)).toEqual([sheet(41), sheet(42)]);
    expect(host.sheets[1]!.frame.y).toBe(H + 18);
    expect(host.sheets[1]!.hit.y).toBe(H + 18);
    expect(host.sheets[1]!.frame.h).toBe(H);
  });

  it('a press that says pen and reaches the page boxes nothing', async () => {
    await fire(pageEl(42), ptr('pointerdown', 'pen', 60, H + 18 + 80));
    await fire(window, ptr('pointermove', 'pen', 200, H + 18 + 200));
    expect(q('.pbox.ghost')).toBeNull();
    await fire(window, ptr('pointerup', 'pen', 360, H + 18 + 320));
    await wait(30);
    expect(pending()).toBe(0);
    expect(await fs.inkedPages(hash)).toEqual([]);
  });

  it('what the Pencil wrote is the page\'s strokes, kept when it goes quiet, and the picture takes over from the canvas', async () => {
    expect(hash).toMatch(/^[0-9a-f]{64}$/);
    await wait(20);
    await pencil({ kind: 'begin', sheet: sheet(42), host: `pages:${CH3}`, fresh: false, x: 60, y: 100 });
    await pencil({ kind: 'end', sheet: sheet(42) });
    drawn = [stroke(1), stroke(2)];
    await pencil({ kind: 'quiet', sheet: sheet(42) });
    await wait(30);
    // that page's, by the file's hash; the other page has none
    expect(await fs.pageInk(hash, 42)).toEqual([stroke(1), stroke(2)]);
    expect(await fs.pageInk(hash, 41)).toEqual([]);
    // nothing went into the PDF, and the notes say nothing of it
    expect(fs.blobAt(`${ROOT}/${PDF}`)).toBe(hash);
    expect(await fs.readText(`${ROOT}/${CH3}`)).toBe(NOTES);
    // the picture is made, under the canvas, and stands aside until it is shown; then the canvas goes
    await wait(40);
    const img = inkOn(42)!;
    expect(img).not.toBeNull();
    expect(img.dataset.live).toBe('1');
    expect(rested).toEqual([]);
    await loaded(42);
    expect(inkOn(42)!.dataset.live).toBeUndefined();
    expect(rested).toEqual([sheet(42)]);
    expect(inkOn(41)).toBeNull();
    expect(pictures.get(inkOn(42)!.src)).toBe(new TextDecoder().decode(memPagePicture([stroke(1), stroke(2)], W, H)));
    const at = pageEl(42).style;
    expect([inkOn(42)!.style.top, inkOn(42)!.style.width, inkOn(42)!.style.height]).toEqual([at.top, at.width, at.height]);
    // its own strokes are not handed back to the canvas that wrote them
    expect(filled).toEqual([]);
    // one stroke more is one row more; nothing asked for, nothing written
    drawn = [stroke(1), stroke(2), stroke(3)];
    await pencil({ kind: 'quiet', sheet: sheet(42) });
    await wait(40);
    expect((await fs.pageInk(hash, 42)).map((x) => x.stroke)).toEqual(['s1', 's2', 's3']);
    await pencil({ kind: 'quiet', sheet: sheet(42) });
    await wait(30);
    expect((await fs.pageInk(hash, 42)).length).toBe(3);
  });

  it('a page written on is given to its canvas, and strokes a merge brought in meanwhile stay', async () => {
    await fs.setPageInk(hash, 41, [stroke(1)]);
    await told(41);
    const fill = filled.find((f) => f.sheet === sheet(41) && f.drawing)!;
    expect(memSplit(Uint8Array.from(atob(fill.drawing!), (c) => c.charCodeAt(0))).map((x) => x.stroke)).toEqual(['s1']);
    // a merge writes s9 while the canvas, which knows s1, writes s2
    writing = true;
    await act(async () => { await fs.door.run(() => fs.door.apply({ puts: [], removes: [], reviews: [], pairs: null, ink: [{ page: `p.${hash}.41`, add: [stroke(9)], remove: [] }] }, [])); });
    drawn = [stroke(1), stroke(2)];
    await pencil({ kind: 'quiet', sheet: sheet(41) });
    await wait(40);
    expect((await fs.pageInk(hash, 41)).map((x) => x.stroke).sort()).toEqual(['s1', 's2', 's9']);
  });

  it('every stroke erased, the page is the page again and the canvas goes', async () => {
    await fs.setPageInk(hash, 41, [stroke(1)]);
    await told(41);
    drawn = [];
    await pencil({ kind: 'quiet', sheet: sheet(41) });
    await wait(120);
    expect(await fs.inkedPages(hash)).toEqual([]);
    expect(inkOn(41)).toBeNull();
    expect(rested).toContain(sheet(41));
  });

  it('a finger still boxes after its hold and a mouse at once', async () => {
    await fire(pageEl(41), ptr('pointerdown', 'touch', 60, 80));
    await wait(HOLD_MS + 60);
    await fire(window, ptr('pointermove', 'touch', 200, 200));
    await fire(window, ptr('pointerup', 'touch', 360, 320));
    expect(pending()).toBe(1);
    await fire(pageEl(41), ptr('pointerdown', 'mouse', 60, 400));
    await fire(window, ptr('pointermove', 'mouse', 200, 500));
    await fire(window, ptr('pointerup', 'mouse', 360, 600));
    expect(pending()).toBe(2);
  });

  it('with no canvas (the Mac) a pen boxes as it did, and the page shows what was written elsewhere as a picture', async () => {
    useApp.setState({ mobile: false });
    await fire(pageEl(41), ptr('pointerdown', 'pen', 60, 80));
    await fire(window, ptr('pointermove', 'pen', 200, 200));
    await fire(window, ptr('pointerup', 'pen', 360, 320));
    expect(pending()).toBe(1);
    // strokes that come by a merge are written through the store's door: the page shows them without being asked
    await act(async () => { await fs.door.run(() => fs.door.apply({ puts: [], removes: [], reviews: [], pairs: null, ink: [{ page: `p.${hash}.41`, add: [stroke(5)], remove: [] }] }, [])); });
    await wait(40);
    const first = inkOn(41)!;
    expect(first).not.toBeNull();
    const was = first.src;
    expect(pictures.get(was)).toContain('s5');
    await act(async () => { await fs.door.run(() => fs.door.apply({ puts: [], removes: [], reviews: [], pairs: null, ink: [{ page: `p.${hash}.41`, add: [stroke(6)], remove: [] }] }, [])); });
    await wait(40);
    expect(inkOn(41)!.src).not.toBe(was);
    expect(pictures.get(inkOn(41)!.src)).toContain('s5 s6');
    // all of it erased elsewhere: the page is the page again
    await act(async () => { await fs.door.run(() => fs.door.apply({ puts: [], removes: [], reviews: [], pairs: null, ink: [{ page: `p.${hash}.41`, add: [], remove: ['s5', 's6'] }] }, [])); });
    await wait(40);
    expect(inkOn(41)).toBeNull();
  });
});
