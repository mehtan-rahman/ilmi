// @vitest-environment jsdom
// Milestone 48 drawn: a document with pages has its body beside its pages as
// notes, in the full editor and never frozen. Under each section heading
// that comes back sits a chip (show in book, show boxes here, when it is
// next; a dismissed one says so); show boxes here draws the section's
// crops under its heading, page breaks marked; a clip line is drawn as the
// crop of its page; ⏎ after boxing puts the caret in a fresh line in the
// new section. The pages themselves need pdf.js and a canvas: the window
// smoke (`ILMI_SMOKE=book`) holds them.

import { promises as fsp } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { act, createElement } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';
import { meta as metaOf } from '../../format/index.js';
import { nodeFs } from '../../vault/node-fs.js';
import { Vault } from '../../vault/index.js';
import { setClockDay } from '../clock.js';
import { useApp, type DocInfo } from '../store.js';

const CH3 = 'library/lindqvist/ch-3.md';
const NOTES = [
  '---', 'type: source', 'frozen: true', 'pdf: ../lindqvist.pdf', 'pages: 41-44', 'read: due=2026-11-02 ivl=2 reps=1 pos=42 y=0.500', '---', '',
  '## 3.2 · the partition function (3.9)', '<!-- read made=2026-10-20 due=2026-11-02 ivl=3 boxes=41:0.120:0.122:0.770:0.145 -->', '',
  'Shifting every energy multiplies $Z$ by {{$e^{-\\beta E_0}$}}.', '<!-- sr -->', '',
  '## 3.3 · average values (3.12)', '<!-- read made=2026-10-24 due=2026-11-09 ivl=6 reps=1 boxes=41:0.120:0.860:0.770:0.075,42:0.100:0.097:0.770:0.040 -->', '',
  '## 3.3 · energy fluctuations (3.13–3.15)', '<!-- read made=2026-10-24 boxes=42:0.100:0.135:0.770:0.375 -->', '',
  'Done with it.', '',
  '## p. 43', '',
  '<!-- box 43:0.120:0.368:0.770:0.088 -->', '',
].join('\n');

let vault: Vault;
let dir: string;
const docs: Record<string, DocInfo> = {};

vi.mock('../vault.js', async (orig) => {
  const real = await orig<typeof import('../vault.js')>();
  return { ...real, currentVault: () => vault };
});
const drawn: string[] = [];
vi.mock('../bookPdf.js', () => ({
  fillCrops: (root: HTMLElement) => { for (const el of root.querySelectorAll<HTMLElement>('.crop[data-box]:not([data-drawn])')) { el.dataset.drawn = '1'; drawn.push(el.dataset.box!); } },
  acquirePdf: () => ({ promise: new Promise(() => {}), release() {} }),
  itemsOf: async () => [],
}));
const { Reader } = await import('../Reader.js');
const { chipWhen } = await import('../bookNotes.js');
(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
// jsdom lays nothing out: what the reader measures with is stood in for
globalThis.ResizeObserver ??= class { observe() {} unobserve() {} disconnect() {} } as unknown as typeof ResizeObserver;
Element.prototype.scrollIntoView ??= function () {};
Range.prototype.getBoundingClientRect ??= () => new DOMRect();
Range.prototype.getClientRects ??= () => ({ length: 0, item: () => null, [Symbol.iterator]: [][Symbol.iterator] }) as unknown as DOMRectList;
document.elementFromPoint ??= () => null;

let host: HTMLDivElement;
let root: Root;
async function mount(el: React.ReactElement) {
  host = document.body.appendChild(document.createElement('div'));
  root = createRoot(host);
  await act(async () => { root.render(el); });
  await act(async () => { await new Promise((r) => setTimeout(r, 30)); });
}
function unmount() { act(() => root.unmount()); host.remove(); }
const settle = () => act(async () => { await new Promise((r) => setTimeout(r, 30)); });

beforeAll(async () => {
  setClockDay('2026-11-02');
  dir = await fsp.mkdtemp(join(tmpdir(), 'ilmi-book-'));
  await fsp.mkdir(join(dir, 'library/lindqvist'), { recursive: true });
  await fsp.writeFile(join(dir, CH3), NOTES);
  await fsp.writeFile(join(dir, 'library/lindqvist.pdf'), '%PDF-1.7\n');
  vault = await Vault.open(nodeFs, dir);
  const doc = (await vault.read(CH3)).doc;
  const m = metaOf(doc);
  // as the app's `infoOf` has it: a document with pages is never frozen
  docs[CH3] = { type: m.type, frozen: false, cards: 1, due: 0, pdf: 'library/lindqvist.pdf', pages: { first: 41, last: 44 }, ...(m.read ? { read: m.read } : {}) };
  useApp.setState({ vault: dir, tree: vault.tree, files: vault.documents(), docs, inlineBoxes: {}, bookFocus: null, reveal: null });
});
afterAll(async () => {
  setClockDay(null);
  vault.close();
  await fsp.rm(dir, { recursive: true, force: true });
});

describe('a book\'s notes', () => {
  it('are the body in the editor, never frozen, no title or marker; the head counts passages and cards', async () => {
    await mount(createElement(Reader, { id: CH3, notes: true }));
    expect(host.querySelector('.draft-doc')?.getAttribute('contenteditable')).toBe('true');
    expect(host.querySelector('h1')).toBeNull();
    expect(host.querySelector('.read-rule')).toBeNull();
    expect(host.querySelector('.notes-meta')?.textContent).toBe('notes3 passages · 1 card');
    expect(host.querySelector('.reader-wrap')?.getAttribute('data-pdf')).toBe('library/lindqvist.pdf');
    unmount();
  });

  it('carry a chip under each section heading: show in book, show boxes here, when it is next', async () => {
    await mount(createElement(Reader, { id: CH3, notes: true }));
    const chips = Array.from(host.querySelectorAll<HTMLElement>('.dd-h .book-chip'));
    expect(chips.map((c) => c.textContent)).toEqual([
      'show in bookshow boxes heredue today',
      'show in bookshow boxes hereback in 7d',
      'show in bookshow boxes heredismissed',
    ]);
    // the chip is not the heading's text
    const h = host.querySelector('.dd-h')!.cloneNode(true) as HTMLElement;
    h.querySelectorAll('[contenteditable="false"]').forEach((e) => e.remove());
    expect(h.textContent).toBe('3.2 · the partition function (3.9)');
    unmount();
  });

  it('show boxes here draws the crops under the heading, a page break between pages; show in book asks the pages', async () => {
    await mount(createElement(Reader, { id: CH3, notes: true }));
    const chip = host.querySelectorAll<HTMLElement>('.dd-h .book-chip')[1]!;
    await act(async () => { chip.querySelector('[data-act="show-here"]')!.dispatchEvent(new MouseEvent('mousedown', { bubbles: true, cancelable: true })); });
    await settle();
    const inline = host.querySelector<HTMLElement>('.inline-boxes')!;
    expect(inline.dataset.for).toBe('3.3 · average values (3.12)');
    expect(Array.from(inline.children).map((c) => (c.classList.contains('pbreak') ? c.textContent : (c as HTMLElement).dataset.box))).toEqual([
      '41:0.120:0.860:0.770:0.075', 'p. 42', '42:0.100:0.097:0.770:0.040',
    ]);
    // it sits right under its heading, and the chip now offers to hide them
    expect(inline.previousElementSibling?.textContent).toContain('3.3 · average values (3.12)');
    expect(host.querySelectorAll<HTMLElement>('.dd-h .book-chip')[1]!.querySelector('[data-act="show-here"]')?.textContent).toBe('hide boxes');
    expect(drawn).toContain('42:0.100:0.097:0.770:0.040');
    const chip0 = host.querySelectorAll<HTMLElement>('.dd-h .book-chip')[0]!;
    chip0.querySelector('[data-act="show-in-book"]')!.dispatchEvent(new MouseEvent('mousedown', { bubbles: true, cancelable: true }));
    expect(useApp.getState().bookFocus).toMatchObject({ path: CH3, text: '3.2 · the partition function (3.9)' });
    unmount();
    useApp.setState({ inlineBoxes: {} });
  });

  it('draws a clip as the crop of its page', async () => {
    await mount(createElement(Reader, { id: CH3, notes: true }));
    const clip = host.querySelector<HTMLElement>('.raw.clip');
    expect(clip?.querySelector('.crop')?.getAttribute('data-box')).toBe('43:0.120:0.368:0.770:0.088');
    expect(clip?.querySelector('.clip-cap')?.textContent).toBe('p. 43');
    unmount();
  });

  it('a reveal to write puts the caret in a fresh line at the end of the section', async () => {
    await mount(createElement(Reader, { id: CH3, notes: true }));
    await act(async () => { useApp.setState({ reveal: { path: CH3, index: 3, heading: '3.3 · average values (3.12)', write: true } }); });
    await settle();
    expect(useApp.getState().reveal).toBeNull();
    const sel = window.getSelection();
    const p = (sel?.anchorNode instanceof Element ? sel.anchorNode : sel?.anchorNode?.parentElement)?.closest('p');
    expect(p?.textContent).toBe('');
    expect(p?.previousElementSibling?.textContent).toContain('3.3 · average values (3.12)');
    expect(p?.nextElementSibling?.textContent).toContain('3.3 · energy fluctuations');
    expect(useApp.getState().caretHeading?.text).toBe('3.3 · average values (3.12)');
    unmount();
  });

  it('a reveal for a section not on the page yet waits for it', async () => {
    await mount(createElement(Reader, { id: CH3, notes: true }));
    await act(async () => { useApp.setState({ reveal: { path: CH3, index: 0, heading: 'p. 44 · new', write: true } }); });
    await settle();
    expect(useApp.getState().reveal).not.toBeNull();
    await act(async () => { await vault.update(CH3, (d) => { d.blocks.unshift({ kind: 'heading', level: 2, text: 'p. 44 · new', read: { made: '2026-11-02', due: '2026-11-05', ivl: 3, boxes: '44:0.000:0.000:1.000:0.200' } }); }); });
    await settle();
    expect(useApp.getState().reveal).toBeNull();
    expect(useApp.getState().caretHeading?.text).toBe('p. 44 · new');
    unmount();
  });
});

describe('the chip\'s words', () => {
  it('due today (or overdue, or a bare line), back tomorrow, back in Nd, dismissed', () => {
    const now = new Date('2026-11-02T10:00:00');
    expect(chipWhen({ due: '2026-11-02' }, now)).toBe('due today');
    expect(chipWhen({ due: '2026-10-30' }, now)).toBe('due today');
    expect(chipWhen({}, now)).toBe('due today');
    expect(chipWhen({ due: '2026-11-03' }, now)).toBe('back tomorrow');
    expect(chipWhen({ due: '2026-11-09', boxes: '41:0.000:0.000:1.000:1.000' }, now)).toBe('back in 7d');
    expect(chipWhen({ made: '2026-10-20', boxes: '41:0.000:0.000:1.000:1.000' }, now)).toBe('dismissed');
  });
});
