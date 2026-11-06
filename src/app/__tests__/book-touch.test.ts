// @vitest-environment jsdom
// Milestone 57 on a book's pages, drawn in jsdom over a stand-in for the
// PDF: the pages take pointer events. A mouse's drag boxes at once and its
// press stops the selection it would begin, a double click is left to
// select; a finger's drag before its hold is up is the scroll and draws
// nothing, after it a box, and while one is drawn the touch's own scroll is
// held; the Pencil's drag boxes with no hold; a second drag is a second
// box, numbered; a tap under a finger or the Pencil clears them and a
// mouse's click does not; the bar under the last box offers section and
// card, with `esc` only where there is a keyboard to have it.

import { promises as fsp } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { act, createElement } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { nodeFs } from '../../vault/node-fs.js';
import { Vault } from '../../vault/index.js';
import { useApp, type DocInfo } from '../store.js';
import { HOLD_MS } from '../touch.js';

const CH3 = 'library/lindqvist/ch-3.md';
const NOTES = ['---', 'type: source', 'pdf: ../lindqvist.pdf', 'pages: 41-42', '---', '', 'Notes.', ''].join('\n');
const W = 600;
const H = 800;

let vault: Vault;
let dir: string;

vi.mock('../vault.js', async (orig) => {
  const real = await orig<typeof import('../vault.js')>();
  return { ...real, currentVault: () => vault };
});
// the file: 44 pages of 600 × 800, nothing to draw
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
// jsdom lays nothing out: a page is where the column would put it, 600 × 800 with 18 between
const rectOf = HTMLElement.prototype.getBoundingClientRect;
HTMLElement.prototype.getBoundingClientRect = function (this: HTMLElement) {
  if (this.classList.contains('pdf-page')) return new DOMRect(0, (Number(this.dataset.page) - 41) * (H + 18), W, H);
  return rectOf.call(this);
};

let host: HTMLDivElement;
let root: Root;
const wait = (ms: number) => act(async () => { await new Promise((r) => setTimeout(r, ms)); });
const q = <T extends Element>(sel: string) => host.querySelector<T>(sel);
const qa = <T extends Element>(sel: string) => Array.from(host.querySelectorAll<T>(sel));
const pending = () => qa('.pbox.pending:not(.ghost)').length;
const ptr = (type: string, pointerType: string, x: number, y: number, more: PointerEventInit = {}) =>
  new PointerEvent(type, { bubbles: true, cancelable: true, pointerId: 3, pointerType, isPrimary: true, button: 0, clientX: x, clientY: y, ...more });
const fire = async (target: EventTarget, e: Event) => { await act(async () => { target.dispatchEvent(e); }); return e; };
const p41 = () => q<HTMLElement>('.pdf-page[data-page="41"]')!;
/** A drag on p. 41 from one corner to the other, as that kind of pointer sends it; `hold` waits first. */
const drag = async (pointerType: string, from: [number, number], to: [number, number], hold = 0) => {
  await fire(p41(), ptr('pointerdown', pointerType, ...from));
  if (pointerType === 'mouse') await fire(p41(), new MouseEvent('mousedown', { bubbles: true, cancelable: true, button: 0, detail: 1, clientX: from[0], clientY: from[1] }));
  if (hold) await wait(hold);
  await fire(window, ptr('pointermove', pointerType, (from[0] + to[0]) / 2, (from[1] + to[1]) / 2));
  await fire(window, ptr('pointerup', pointerType, ...to));
};

beforeAll(async () => {
  dir = await fsp.mkdtemp(join(tmpdir(), 'ilmi-book-touch-'));
  await fsp.mkdir(join(dir, 'library/lindqvist'), { recursive: true });
  await fsp.writeFile(join(dir, CH3), NOTES);
  await fsp.writeFile(join(dir, 'library/lindqvist.pdf'), '%PDF-1.7\n');
  vault = await Vault.open(nodeFs, dir);
  const docs: Record<string, DocInfo> = { [CH3]: { type: 'source', frozen: false, cards: 0, due: 0, pdf: 'library/lindqvist.pdf', pages: { first: 41, last: 42 } } };
  useApp.setState({ vault: dir, tree: vault.tree, files: vault.documents(), docs, inlineBoxes: {}, bookFocus: null, reveal: null, notesHidden: true });
});
afterAll(async () => {
  vault.close();
  await fsp.rm(dir, { recursive: true, force: true });
});
beforeEach(async () => {
  useApp.setState({ mobile: false, notesHidden: true });
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

describe('a book\'s pages under a pointer', () => {
  it('a mouse\'s drag boxes at once, and its press stops the selection it would begin', async () => {
    await fire(p41(), ptr('pointerdown', 'mouse', 60, 80));
    const press = await fire(p41(), new MouseEvent('mousedown', { bubbles: true, cancelable: true, button: 0, detail: 1, clientX: 60, clientY: 80 }));
    expect(press.defaultPrevented).toBe(true);
    await fire(window, ptr('pointermove', 'mouse', 200, 200));
    expect(q('.pbox.ghost')).not.toBeNull();
    await fire(window, ptr('pointerup', 'mouse', 360, 320));
    expect(pending()).toBe(1);
    expect(q('.pbox.ghost')).toBeNull();
    // 60..360 of 600 across, 80..320 of 800 down, on p. 41
    const box = q<HTMLElement>('.pbox.pending')!;
    expect([box.style.left, box.style.top, box.style.width, box.style.height].map((v) => Math.round(parseFloat(v)))).toEqual([60, 80, 300, 240]);
    expect(qa<HTMLElement>('.pend button').map((b) => b.dataset.k)).toEqual(['e', 'm', 'esc']);
    // a click elsewhere leaves it: the mouse has esc
    await fire(p41(), ptr('pointerdown', 'mouse', 500, 600));
    await fire(window, ptr('pointerup', 'mouse', 500, 600));
    expect(pending()).toBe(1);
  });

  it('a double click is left to select its word, and ⌥ its lines', async () => {
    await fire(p41(), ptr('pointerdown', 'mouse', 60, 80));
    const second = await fire(p41(), new MouseEvent('mousedown', { bubbles: true, cancelable: true, button: 0, detail: 2, clientX: 60, clientY: 80 }));
    expect(second.defaultPrevented).toBe(false);
    await fire(window, ptr('pointermove', 'mouse', 200, 200));
    await fire(window, ptr('pointerup', 'mouse', 360, 320));
    expect(pending()).toBe(0);
    await fire(p41(), ptr('pointerdown', 'mouse', 60, 80, { altKey: true }));
    const alt = await fire(p41(), new MouseEvent('mousedown', { bubbles: true, cancelable: true, button: 0, detail: 1, altKey: true }));
    expect(alt.defaultPrevented).toBe(false);
    await fire(window, ptr('pointerup', 'mouse', 360, 320));
    expect(pending()).toBe(0);
  });

  it('a finger\'s drag is the scroll until it has rested, then a box', async () => {
    const pages = q<HTMLElement>('.pdf-pages')!;
    const scrolls = () => { const e = new Event('touchmove', { bubbles: true, cancelable: true }); pages.dispatchEvent(e); return !e.defaultPrevented; };
    // moved at once: the scroll's, and nothing is drawn
    await fire(p41(), ptr('pointerdown', 'touch', 60, 80));
    expect(scrolls()).toBe(true);
    await fire(window, ptr('pointermove', 'touch', 60, 140));
    await wait(HOLD_MS + 60);
    expect(q('.pbox.ghost')).toBeNull();
    await fire(window, ptr('pointerup', 'touch', 360, 320));
    expect(pending()).toBe(0);
    // rested, then moved: a mark where it rested, a box where it went, the page held still under it
    await fire(p41(), ptr('pointerdown', 'touch', 60, 80));
    await wait(HOLD_MS + 60);
    expect(q('.pbox.ghost')).not.toBeNull();
    expect(scrolls()).toBe(false);
    await fire(window, ptr('pointermove', 'touch', 200, 200));
    await fire(window, ptr('pointerup', 'touch', 360, 320));
    expect(pending()).toBe(1);
    expect(scrolls()).toBe(true);
    // the system took the touch back (its own scroll, a second finger): nothing more
    await fire(p41(), ptr('pointerdown', 'touch', 60, 400));
    await wait(HOLD_MS + 60);
    await fire(window, ptr('pointercancel', 'touch', 60, 400));
    await fire(window, ptr('pointerup', 'touch', 360, 600));
    expect(pending()).toBe(1);
  });

  it('a second drag is a second box, numbered, and a tap clears them', async () => {
    useApp.setState({ mobile: true });
    await drag('touch', [60, 80], [360, 320], HOLD_MS + 60);
    await drag('touch', [60, 400], [360, 600], HOLD_MS + 60);
    expect(pending()).toBe(2);
    expect(qa('.pbox.pending .pb-no').map((n) => n.textContent)).toEqual(['1', '2']);
    // under a finger the bar offers section and card: a tap is the esc
    expect(qa<HTMLElement>('.pend button').map((b) => b.dataset.k)).toEqual(['e', 'm']);
    expect(q('.pend button[data-k="e"]')!.textContent).toContain('section');
    expect(q('.pend button[data-k="m"]')!.textContent).toContain('card');
    await fire(p41(), ptr('pointerdown', 'touch', 500, 700));
    await fire(window, ptr('pointerup', 'touch', 501, 701));
    expect(pending()).toBe(0);
  });

  it('the Pencil\'s drag boxes with no hold, and its tap clears', async () => {
    await fire(p41(), ptr('pointerdown', 'pen', 60, 80));
    await fire(window, ptr('pointermove', 'pen', 200, 200));
    expect(q('.pbox.ghost')).not.toBeNull();
    await fire(window, ptr('pointerup', 'pen', 360, 320));
    expect(pending()).toBe(1);
    // a box on the second page as well: the page under the press is the box's
    const p42 = q<HTMLElement>('.pdf-page[data-page="42"]')!;
    await fire(p42, ptr('pointerdown', 'pen', 60, H + 18 + 80));
    await fire(window, ptr('pointermove', 'pen', 200, H + 18 + 200));
    await fire(window, ptr('pointerup', 'pen', 360, H + 18 + 320));
    expect(pending()).toBe(2);
    await fire(p41(), ptr('pointerdown', 'pen', 500, 700));
    await fire(window, ptr('pointerup', 'pen', 500, 700));
    expect(pending()).toBe(0);
  });

  it('a press on the bar or a section\'s tag is not a box', async () => {
    await drag('mouse', [60, 80], [360, 320]);
    const bar = q<HTMLElement>('.pend')!;
    await fire(bar, ptr('pointerdown', 'touch', 80, 340));
    await wait(HOLD_MS + 60);
    await fire(window, ptr('pointermove', 'touch', 200, 500));
    await fire(window, ptr('pointerup', 'touch', 300, 600));
    expect(pending()).toBe(1);
  });
});
