// @vitest-environment jsdom
// The deck browser over 100,000 cards: only the rows near the view are in
// the DOM, in a box padded to the whole list's height; ⌘A, the cursor by
// `j`, a search, a reveal of a far card and the deck's memory of its scroll
// all go by a row's place in the list, not by its being drawn.
//
// jsdom lays nothing out (every height and offset in it is 0, nothing
// scrolls), so the page is stood in for through windowed.ts's `probe`: a
// view 800 px tall with 120 px of bar above the rows, each row as tall as
// its block says (40 to 88 px), and a scroll offset that is a number here.
// What this shows is the script: which rows are drawn, the padding, the
// offset asked for, and the script's time. It cannot show paint, real
// wrapping, or WebKit's own scrolling.

import { appendFileSync } from 'node:fs';
import { act, createElement } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';
import { parse, type Doc } from '../../format/index.js';
import { useApp } from '../store.js';
import { MAX_DRAWN, probe } from '../windowed.js';

const BIG = 'big.md';
const N = 100_000;
const VIEW = 800;
const ABOVE = 120;
/** A row's height here: by its block, 40 to 88 px, 64 on average. */
const tall = (block: number) => 40 + (block % 5) * 12;
const TOTAL = N * 64;

const bodies = new Map<string, Doc>();
vi.mock('../vault.js', async (orig) => {
  const real = await orig<typeof import('../vault.js')>();
  return {
    ...real,
    docsOf: (paths: readonly string[]) => paths.filter((p) => bodies.has(p)).map((p) => [p, bodies.get(p)!] as [string, Doc]),
    setDeckView: (id: string, v: unknown) => { useApp.setState((s) => ({ deckViews: { ...s.deckViews, [id]: v as never } })); },
  };
});
const { DeckBrowser } = await import('../DeckBrowser.js');
(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
const scrolled: { key: string; block: string }[] = [];

// the page, stood in for
let scroll = 0;
const real = { ...probe };
beforeAll(() => {
  probe.viewport = () => VIEW;
  probe.width = () => 700;
  probe.listTop = () => ABOVE;
  probe.scrollTop = () => scroll;
  probe.scrollTo = (_pane, y) => { scroll = Math.max(0, y); };
  // a row's box is the plain div around it
  probe.height = (el) => tall(Number((el.firstElementChild as HTMLElement).dataset.block));
  // a drawn row scrolled to: as the browser would, by the least move or to the middle
  Element.prototype.scrollIntoView = function scrollIntoView(this: HTMLElement, o?: boolean | ScrollIntoViewOptions) {
    const block = typeof o === 'object' ? o.block ?? 'start' : 'start';
    scrolled.push({ key: this.dataset.key!, block });
    const { top, height } = place(this);
    if (block === 'center') scroll = ABOVE + top + height / 2 - VIEW / 2;
    else if (ABOVE + top < scroll) scroll = ABOVE + top;
    else if (ABOVE + top + height > scroll + VIEW) scroll = ABOVE + top + height - VIEW;
  };
});
afterAll(() => { Object.assign(probe, real); });

let host: HTMLDivElement;
let root: Root;
const ms = (t0: number) => Math.round((performance.now() - t0) * 10) / 10;
// the lines go to the console, and to `ILMI_PERF_OUT` when set (a passing test's console is not shown)
const log = (what: string, n: number) => {
  console.log(`perf: ${what} ${n} ms`);
  if (process.env.ILMI_PERF_OUT) appendFileSync(process.env.ILMI_PERF_OUT, `${what}: ${n} ms\n`);
  return n;
};
const rowEls = () => Array.from(host.querySelectorAll<HTMLElement>('.deck-row'));
const blocks = () => rowEls().map((e) => Number(e.dataset.block));
const box = () => host.querySelector<HTMLElement>('.deck-rows')!;
const pad = () => ({ top: parseFloat(box().style.paddingTop) || 0, bottom: parseFloat(box().style.paddingBottom) || 0 });
/** Where a drawn row is from the list's top, as a layout would have it: the padding, then the rows drawn before it. */
function place(el: HTMLElement): { top: number; height: number } {
  let top = pad().top;
  for (const e of rowEls()) {
    if (e === el) break;
    top += tall(Number(e.dataset.block));
  }
  return { top, height: tall(Number(el.dataset.block)) };
}
const drawnHeight = () => blocks().reduce((n, b) => n + tall(b), 0);
/** The list as tall as the page would make it. */
const listHeight = () => pad().top + drawnHeight() + pad().bottom;
/** The view is inside the rows drawn: nothing blank in it. */
const covered = () => {
  const top = scroll - ABOVE;
  const from = pad().top;
  const to = from + drawnHeight();
  return from <= Math.max(0, top) && to >= Math.min(listHeight(), top + VIEW);
};
/** The block of the row under the top of the view, and how far the view's top is into it. */
const under = () => {
  let y = pad().top;
  for (const b of blocks()) {
    if (y + tall(b) > scroll - ABOVE) return { block: b, into: scroll - ABOVE - y };
    y += tall(b);
  }
  return null;
};
const key = (k: string, init: KeyboardEventInit = {}) => act(async () => { window.dispatchEvent(new KeyboardEvent('keydown', { key: k, bubbles: true, cancelable: true, ...init })); });
const scrollTo = (y: number) => act(async () => { scroll = y; host.dispatchEvent(new Event('scroll')); });
const type = (text: string) => act(async () => {
  const input = host.querySelector<HTMLInputElement>('.db-search')!;
  Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value')!.set!.call(input, text);
  input.dispatchEvent(new Event('input', { bubbles: true }));
});
async function mount() {
  host = document.body.appendChild(document.createElement('div'));
  host.className = 'pane-body deck-view';
  root = createRoot(host);
  await act(async () => { root.render(createElement(DeckBrowser, { home: BIG, active: true })); });
}
const unmount = () => { act(() => root.unmount()); host.remove(); };

// The budgets are for the development machine (an Apple Silicon Mac) with the
// rest of the suite running beside it. Alone, 2026-11-15: opened 170 to 200 ms
// (the rows read, filtered, sorted and indexed; some 26 rows drawn), ⌘A 19 ms,
// a `j` 3 ms, a search keystroke 9 ms. Each bound is some eight times that or more.
describe.skipIf(!!process.env.CI)('a deck of 100,000 cards', () => {
  beforeAll(() => {
    const lines: string[] = [];
    for (let i = 0; i < N; i++) lines.push(`front ${i} word${i % 97} ::: back ${i}\n`);
    const t0 = performance.now();
    bodies.set(BIG, parse(lines.join('\n')).doc);
    log(`parse ${N} cards`, ms(t0));
    useApp.setState({ vault: '/big', tree: [], files: [BIG], docs: { [BIG]: { type: 'source', frozen: false, cards: N, due: 0 } }, order: {}, deckViews: {}, selectedCard: null, reveal: null });
  });
  afterAll(() => { unmount(); bodies.clear(); });

  it('opens with the rows near the view, in a box as tall as the whole list', async () => {
    const t0 = performance.now();
    await mount();
    const took = log(`deck browser, ${N} cards, opened`, ms(t0));
    expect(host.querySelector('.db-count')?.textContent).toBe(String(N));
    // the view (800 px of rows 64 px tall on average) and a screen below it: about 26 rows
    expect(rowEls().length).toBeGreaterThan(12);
    expect(rowEls().length).toBeLessThan(60);
    expect(blocks()[0]).toBe(0);
    expect(pad().top).toBe(0);
    // the rest stand at the average of those measured: within a tenth of the true height
    expect(Math.abs(listHeight() - TOTAL) / TOTAL).toBeLessThan(0.1);
    expect(covered()).toBe(true);
    expect(took).toBeLessThan(1500);
  });

  it('⌘A selects every card, by the list and not by what is drawn', async () => {
    const t0 = performance.now();
    await key('a', { metaKey: true });
    const took = log(`deck browser, ${N} cards, ⌘A`, ms(t0));
    expect(host.querySelector('.db-sel')?.textContent).toBe(`${N} selected`);
    expect(rowEls().every((e) => e.classList.contains('selected'))).toBe(true);
    expect(rowEls().length).toBeLessThan(60);
    expect(took).toBeLessThan(400);
    await key('Escape');
    expect(host.querySelector('.db-sel')).toBeNull();
  });

  it('j twenty times: the cursor walks down, its row drawn and in view at each step', async () => {
    const steps: number[] = [];
    for (let k = 0; k < 20; k++) {
      const t0 = performance.now();
      await key('j');
      steps.push(performance.now() - t0);
      const cur = host.querySelector<HTMLElement>('.deck-row.cursor');
      expect(cur?.dataset.block).toBe(String(k));
      const at = place(cur!);
      expect(at.top + ABOVE).toBeGreaterThanOrEqual(scroll);
      expect(at.top + at.height + ABOVE).toBeLessThanOrEqual(scroll + VIEW);
    }
    const each = log(`deck browser, ${N} cards, j (average of 20)`, Math.round((steps.reduce((a, b) => a + b, 0) / steps.length) * 10) / 10);
    expect(scroll).toBeGreaterThan(0);
    expect(rowEls().length).toBeLessThan(80);
    expect(covered()).toBe(true);
    // a key a person holds down
    expect(each).toBeLessThan(50);
  });

  it('j past the rows drawn: the row is drawn by its place in the list and brought into view', async () => {
    // the view put back at the top, the cursor left on row 19: the next rows down are no longer near the view
    await scrollTo(0);
    for (let k = 0; k < 70; k++) await key('j');
    const cur = host.querySelector<HTMLElement>('.deck-row.cursor')!;
    expect(cur.dataset.block).toBe('89');
    const at = place(cur);
    expect(at.top + at.height + ABOVE).toBeLessThanOrEqual(scroll + VIEW + 0.5);
    expect(at.top + ABOVE).toBeGreaterThanOrEqual(scroll - 0.5);
    expect(rowEls().length).toBeLessThan(80);
    expect(covered()).toBe(true);
  });

  it('scrolled far down: other rows, as few; the row under the top of the view held as heights are measured', async () => {
    // the bar dragged to the middle: rows never measured, placed by the average
    await scrollTo(ABOVE + TOTAL / 2);
    expect(rowEls().length).toBeGreaterThan(12);
    expect(rowEls().length).toBeLessThan(80);
    expect(Math.abs(blocks()[0]! - N / 2)).toBeLessThan(N / 10);
    expect(pad().top).toBeGreaterThan(TOTAL / 3);
    expect(Math.abs(listHeight() - TOTAL) / TOTAL).toBeLessThan(0.1);
    expect(covered()).toBe(true);
    // up by half a screen at a time: rows above the view come in at their own heights, not the average's,
    // and the row that was under the top of the view is still the one a half screen down
    for (let k = 0; k < 12; k++) {
      const was = under()!;
      const before = scroll;
      await scrollTo(scroll - VIEW / 2);
      expect(covered()).toBe(true);
      // where that row is now, against where it was in the view
      const el = rowEls().find((e) => Number(e.dataset.block) === was.block)!;
      expect(el).toBeDefined();
      const inView = ABOVE + place(el).top - scroll;
      expect(Math.abs(inView - (VIEW / 2 - was.into))).toBeLessThan(1.5);
      // the scroll was moved only by what the rows that came in above differ from the estimate: a few rows' worth
      expect(Math.abs(scroll - (before - VIEW / 2))).toBeLessThan(VIEW);
    }
    expect(rowEls().length).toBeLessThan(80);
  });

  it('a card far away revealed: selected, drawn, in the middle of the view', async () => {
    scrolled.length = 0;
    await act(async () => { useApp.setState({ reveal: { path: BIG, index: 87_654 } }); });
    const k = `${BIG}#${87_654}`;
    const el = host.querySelector<HTMLElement>(`.deck-row[data-key="${CSS.escape(k)}"]`)!;
    expect(el).not.toBeNull();
    expect(el.classList.contains('selected') && el.classList.contains('cursor')).toBe(true);
    expect(scrolled.at(-1)).toEqual({ key: k, block: 'center' });
    const at = place(el);
    expect(Math.abs(ABOVE + at.top + at.height / 2 - (scroll + VIEW / 2))).toBeLessThan(1);
    expect(host.querySelector('.db-sel')?.textContent).toBe('1 selected');
    expect(useApp.getState().reveal).toBeNull();
    expect(rowEls().length).toBeLessThan(80);
    expect(covered()).toBe(true);
  });

  it('⇧-click takes the range by the list, over rows that are not drawn', async () => {
    // the anchor is the revealed card; a row at the top of the list is clicked with ⇧
    await scrollTo(0);
    const first = rowEls()[0]!;
    expect(first.dataset.block).toBe('0');
    await act(async () => { first.dispatchEvent(new MouseEvent('click', { bubbles: true, cancelable: true, shiftKey: true })); });
    expect(host.querySelector('.db-sel')?.textContent).toBe(`${87_654 + 1} selected`);
    await key('Escape');
  });

  it('a search keystroke: the list cut down, the rows drawn still few', async () => {
    const t0 = performance.now();
    await type('word7');
    const took = log(`deck browser, ${N} cards, a search keystroke`, ms(t0));
    // word7, and word70 to word79: eleven of every 97
    const hits = Array.from({ length: N }, (_, i) => i % 97).filter((m) => m === 7 || (m >= 70 && m <= 79)).length;
    expect(host.querySelector('.db-count')?.textContent).toBe(`${hits} of ${N}`);
    expect(rowEls().length).toBeGreaterThan(0);
    expect(rowEls().length).toBeLessThan(80);
    expect(covered()).toBe(true);
    // the filter over 100,000 rows is most of it
    expect(took).toBeLessThan(500);
    await type('');
    expect(host.querySelector('.db-count')?.textContent).toBe(String(N));
  });

  it('a list short enough is drawn whole', async () => {
    await type('front 4321');
    // 4321, 43210 to 43219, and the backs of 14321 to 94321
    expect(host.querySelector('.db-count')?.textContent).toBe(`20 of ${N}`);
    expect(rowEls()).toHaveLength(20);
    expect(pad()).toEqual({ top: 0, bottom: 0 });
    await type('');
  });

  it('away and back: the same row under the top of the view, without the rows before it drawn', async () => {
    await scrollTo(ABOVE + 1_234_567);
    const was = under()!;
    const top = scroll;
    unmount();
    scroll = 0;
    await mount();
    expect(scroll).toBeGreaterThan(0);
    const now = under()!;
    expect(now.block).toBe(was.block);
    expect(Math.abs(now.into - was.into)).toBeLessThan(1.5);
    // the offset itself only nearly: the rows never measured stand at the average as it is now
    expect(Math.abs(scroll - top) / TOTAL).toBeLessThan(0.01);
    expect(blocks()[0]).toBeGreaterThan(0);
    expect(rowEls().length).toBeLessThan(80);
    expect(rowEls().length).toBeLessThanOrEqual(MAX_DRAWN);
    expect(covered()).toBe(true);
  });
});
