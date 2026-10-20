// @vitest-environment jsdom
// A file lands where you drop it: the folder a drop lands in, whether a
// file lands or asks, what a landing writes and how undo takes it back, and
// the one router handing each drag event to the welcome, the intake, or the
// rows. The disk is stubbed: the readers answer canned results and the
// writers record what they were asked.

import type { DragDropEvent } from '@tauri-apps/api/webview';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import type { Mapped, MappedBook } from '../../import/index.js';
import { INTAKE, queueId } from '../names.js';
import { activeTab, emptyPanes, openTab } from '../panes.js';
import { useApp } from '../store.js';
import {
  clipLink, decide, dropRoutes, dropTarget, fileKind, hitAt, inEditable, landFile, landFiles, newFolders, onPaste, routeDrop, undoLanded, undoNotice, type LandFx,
} from '../land.js';

/** Stubs that record every write; the readers answer what the test says. */
function stubs(opts: { text?: string; title?: string; decks?: number; chapters?: number; folders?: string[] } = {}) {
  const calls: string[] = [];
  const removed: string[] = [];
  const decks = Array.from({ length: opts.decks ?? 1 }, (_, i) => ({ name: `d${i}`, title: `Deck ${i + 1}`, dir: [] as string[], cards: 3, scheduled: 0, doc: { blocks: [] } }));
  const chapters = Array.from({ length: opts.chapters ?? 3 }, (_, i) => ({ n: i + 1, name: `0${i + 1} Chapter ${i + 1}`, title: `Chapter ${i + 1}`, text: 'words words', words: 2 }));
  const fx: LandFx = {
    readText: async (path) => ({ title: opts.title ?? path.slice(path.lastIndexOf('/') + 1).replace(/\.[^.]+$/, ''), text: opts.text ?? 'A paragraph of prose, nothing like a card.\n\nAnother one after it.' }),
    readPdf: async () => ({ title: 'Two Pages', text: 'page one\n\npage two', bytes: new Uint8Array([37, 80, 68, 70]), pages: 2 }),
    readBook: async () => ({ title: 'Muqaddimah', creators: ['Ibn Khaldun'], chapters, words: 6, minutes: 1, dropped: { short: 0, images: 0 } }) as unknown as MappedBook,
    readAnki: async () => ({ decks, empty: 0, other: 0, dropped: {}, media: {} }) as unknown as Mapped,
    fetchPage: async (url) => ({ title: 'A Page', text: 'some words here', page: { url, site: 'example.org', author: 'Someone', published: '2026-01-01', images: [], via: 'defuddle', description: '', words: 3 } }) as Awaited<ReturnType<LandFx['fetchPage']>>,
    importText: async (dir, spec) => { calls.push(`text ${dir}|${spec.title}`); return `${dir ? `${dir}/` : ''}${spec.title}.md`; },
    importPdf: async (dir, spec) => { calls.push(`pdf ${dir}|${spec.title}|${spec.bytes.length}`); return `${dir ? `${dir}/` : ''}${spec.title}.md`; },
    importBook: async (dir, book) => {
      calls.push(`book ${dir}|${book.title}|${book.chapters.length}`);
      const folder = `${dir ? `${dir}/` : ''}${book.title}`;
      return { folder, paths: book.chapters.map((c) => `${folder}/${c.name}.md`) };
    },
    importAnki: async (dir, ds) => { calls.push(`anki ${dir}|${ds.map((d) => d.title).join(',')}`); return ds.map((d) => `${dir ? `${dir}/` : ''}${d.title}.md`); },
    importClip: async (dir, spec) => { calls.push(`clip ${dir}|${spec.title}|${spec.url}`); return { path: `${dir ? `${dir}/` : ''}${spec.title}.md` }; },
    folders: () => new Set(['', 'books', 'papers', ...(opts.folders ?? [])]),
    remove: async (path) => { removed.push(path); },
  };
  return { fx, calls, removed };
}

describe('where a drop lands', () => {
  it('a folder row: that folder; the root row: the root', () => {
    expect(dropTarget({ path: 'papers', folder: true }, undefined)).toBe('papers');
    expect(dropTarget({ path: 'books/islam', folder: true }, 'notes.md')).toBe('books/islam');
    expect(dropTarget({ path: '', folder: true }, 'papers/x.md')).toBe('');
  });

  it('a document row: its folder', () => {
    expect(dropTarget({ path: 'papers/wozniak-1990.md', folder: false }, undefined)).toBe('papers');
    expect(dropTarget({ path: 'notes.md', folder: false }, 'papers')).toBe('');
  });

  it('elsewhere: the active tab\'s folder, the root when there is none', () => {
    expect(dropTarget(null, 'papers/wozniak-1990.md')).toBe('papers');
    expect(dropTarget(null, 'books')).toBe('books');
    expect(dropTarget(null, '')).toBe('');
    expect(dropTarget(null, undefined)).toBe('');
    expect(dropTarget(null, queueId('today'))).toBe('');
    expect(dropTarget(null, INTAKE)).toBe('');
  });

  it('reads the row under the pointer from its data-path and data-kind', () => {
    document.body.innerHTML = '<div class="tree"><div class="trow" data-path="" data-kind="folder"><span class="name">v</span></div><div class="trow" data-path="papers/x.md" data-kind="source"><span class="name">x</span></div><li class="fv-row" data-path="books" data-kind="folder"><span>b</span></li></div><main><p>reader</p></main>';
    const at = (sel: string) => hitAt(document.querySelector(sel));
    expect(at('.trow[data-path=""] .name')).toEqual({ path: '', folder: true });
    expect(at('.trow[data-path="papers/x.md"] .name')).toEqual({ path: 'papers/x.md', folder: false });
    expect(at('.fv-row span')).toEqual({ path: 'books', folder: true });
    expect(at('main p')).toBeNull();
    expect(hitAt(null)).toBeNull();
    document.body.innerHTML = '';
  });
});

describe('land or ask', () => {
  it('by kind, without reading', () => {
    expect(fileKind('/x/a.pdf')).toBe('pdf');
    expect(fileKind('/x/A.EPUB')).toBe('epub');
    expect(fileKind('/x/a.apkg')).toBe('apkg');
    expect(fileKind('/x/a.md')).toBe('text');
    expect(fileKind('/x/a.txt')).toBe('text');
    expect(fileKind('/x/a.html')).toBe('html');
    expect(fileKind('/x/a.docx')).toBe('other');
    expect(decide('pdf')).toBe('land');
    expect(decide('epub')).toBe('land');
    expect(decide('apkg', { decks: 1 })).toBe('land');
    expect(decide('apkg', { decks: 2 })).toBe('ask');
    expect(decide('text', { cards: 0 })).toBe('land');
    expect(decide('text', { cards: 1 })).toBe('land');
    expect(decide('text', { cards: 2 })).toBe('ask');
    expect(decide('html', { cards: 9 })).toBe('land');
  });

  it('a pdf lands as the pair, its pages counted', async () => {
    const { fx, calls } = stubs();
    const r = await landFile('/Downloads/two-pages.pdf', 'papers', fx);
    expect(r).toEqual({ kind: 'landed', landed: { line: 'placed · Two Pages · 2 pages in papers/', open: 'papers/Two Pages.md', written: ['papers/Two Pages.md'], folders: [] } });
    expect(calls).toEqual(['pdf papers|Two Pages|4']);
  });

  it('an epub lands its chapters in a folder named for the book, opening the first', async () => {
    const { fx, calls } = stubs({ chapters: 12 });
    const r = await landFile('/Downloads/muqaddimah.epub', 'books', fx);
    if (r.kind !== 'landed') throw new Error('asked');
    expect(r.landed.line).toBe('placed · Muqaddimah · 12 chapters in books/');
    expect(r.landed.open).toBe('books/Muqaddimah/01 Chapter 1.md');
    expect(r.landed.written).toHaveLength(12);
    expect(r.landed.folders).toEqual(['books/Muqaddimah']);
    expect(calls).toEqual(['book books|Muqaddimah|12']);
  });

  it('a .md and a .txt of prose land as sources, in the root too', async () => {
    const { fx, calls } = stubs();
    const md = await landFile('/notes/attention.md', '', fx);
    const txt = await landFile('/notes/plain.txt', 'papers', fx);
    expect(md.kind === 'landed' && md.landed.line).toBe('placed · attention · 12 words in the root');
    expect(txt.kind === 'landed' && txt.landed.open).toBe('papers/plain.md');
    expect(calls).toEqual(['text |attention', 'text papers|plain']);
  });

  it('text that reads as cards asks, and nothing is written', async () => {
    const { fx, calls } = stubs({ text: 'mitochondria\tthe powerhouse\nribosome\tmakes proteins\nnucleus\tholds the DNA' });
    expect(await landFile('/x/bio.txt', '', fx)).toEqual({ kind: 'ask', path: '/x/bio.txt' });
    expect(await landFile('/x/bio.md', '', fx)).toEqual({ kind: 'ask', path: '/x/bio.md' });
    expect(calls).toEqual([]);
  });

  it('an apkg with one deck lands; with two it asks', async () => {
    const one = stubs({ decks: 1 });
    const r = await landFile('/x/one.apkg', 'papers', one.fx);
    expect(r.kind === 'landed' && r.landed.line).toBe('placed · Deck 1 · 3 cards in papers/');
    expect(one.calls).toEqual(['anki papers|Deck 1']);
    const two = stubs({ decks: 2 });
    expect(await landFile('/x/two.apkg', 'papers', two.fx)).toEqual({ kind: 'ask', path: '/x/two.apkg' });
    expect(two.calls).toEqual([]);
  });

  it('refuses what it cannot read in the intake\'s words', async () => {
    await expect(landFile('/x/a.docx', '', stubs().fx)).rejects.toThrow('not a file ilmi reads');
    await expect(landFile('/x/empty.epub', '', stubs({ chapters: 0 }).fx)).rejects.toThrow('no chapters in that book');
    await expect(landFile('/x/empty.apkg', '', stubs({ decks: 0 }).fx)).rejects.toThrow('no cards in that package');
  });
});

describe('undo', () => {
  it('finds the folders a landing made, the topmost new one per file', () => {
    const before = new Set(['', 'books', 'papers']);
    expect(newFolders(['books/M/01 a.md', 'books/M/02 b.md'], 'books', before)).toEqual(['books/M']);
    expect(newFolders(['A/B/C.md'], '', before)).toEqual(['A']);
    expect(newFolders(['papers/x.md'], 'papers', before)).toEqual([]);
    expect(newFolders(['x.md'], '', before)).toEqual([]);
  });

  it('removes a landed epub\'s folder whole, not chapter by chapter', async () => {
    const { fx, removed } = stubs({ chapters: 3 });
    const r = await landFile('/Downloads/muqaddimah.epub', 'books', fx);
    if (r.kind !== 'landed') throw new Error('asked');
    await undoLanded(r.landed, fx.remove);
    expect(removed).toEqual(['books/Muqaddimah']);
  });

  it('removes a landed file by itself, its pages going with it', async () => {
    const { fx, removed } = stubs();
    const r = await landFile('/Downloads/two-pages.pdf', 'papers', fx);
    if (r.kind !== 'landed') throw new Error('asked');
    await undoLanded(r.landed, fx.remove);
    expect(removed).toEqual(['papers/Two Pages.md']);
  });
});

describe('several files, the notice, and the intake', () => {
  beforeEach(() => {
    useApp.setState({ vault: '/v', panes: emptyPanes(), notice: null, intakeFiles: [], log: [], intakeDir: '' });
  });

  it('lands one after another, opens each, and holds an undo for the last; the ones that ask wait on the intake', async () => {
    const s = stubs({ text: 'a\tb\nc\td\ne\tf' });
    const landed = await landFiles(['/x/two-pages.pdf', '/x/cards.txt', '/x/muqaddimah.epub'], 'papers', s.fx);
    expect(landed.map((l) => l.open)).toEqual(['papers/Two Pages.md', 'papers/Muqaddimah/01 Chapter 1.md']);
    const st = useApp.getState();
    expect(st.intakeFiles).toEqual(['/x/cards.txt']);
    expect(st.intakeDir).toBe('papers');
    expect(activeTab(st.panes)?.id).toBe(INTAKE);
    expect(st.notice).toMatchObject({ line: 'placed · Muqaddimah · 3 chapters in papers/', open: 'papers/Muqaddimah/01 Chapter 1.md', undo: true });
    expect(st.log.slice(0, 2)).toEqual(['placed · Muqaddimah · 3 chapters in papers/', 'placed · Two Pages · 2 pages in papers/']);
    await undoNotice();
    expect(s.removed).toEqual(['papers/Muqaddimah']);
    expect(useApp.getState().notice).toBeNull();
    expect(useApp.getState().log[0]).toBe('undone · Muqaddimah · 3 chapters in papers/');
  });

  it('a file it cannot read is a notice, and the rest still land', async () => {
    const s = stubs();
    const landed = await landFiles(['/x/a.docx', '/x/note.md'], '', s.fx);
    expect(landed).toHaveLength(1);
    expect(useApp.getState().log).toContain('a.docx · not a file ilmi reads');
  });
});

describe('the router', () => {
  const ev = (type: string, extra: object = {}) => ({ type, position: { x: 20, y: 20 }, paths: ['/x/a.pdf'], ...extra }) as unknown as DragDropEvent;
  let seen: string[];
  beforeEach(() => {
    seen = [];
    document.body.innerHTML = '<div class="intake-wrap"><textarea></textarea></div><div class="tree"><div class="trow" data-path="papers" data-kind="folder">papers</div></div>';
    useApp.setState({ vault: '/v', fileOver: null, panes: openTab(emptyPanes(), 'papers') });
  });
  afterEach(() => {
    delete dropRoutes.welcome;
    delete dropRoutes.intake;
    document.body.innerHTML = '';
  });
  const pointAt = (sel: string) => { document.elementFromPoint = () => document.querySelector(sel); };

  it('hands everything to the welcome while no vault is open', () => {
    dropRoutes.welcome = (e) => seen.push(`welcome ${e.type}`);
    dropRoutes.intake = { wrap: () => document.querySelector('.intake-wrap'), on: (e) => seen.push(`intake ${e.type}`) };
    useApp.setState({ vault: null });
    pointAt('.trow');
    routeDrop(ev('over'));
    routeDrop(ev('drop'));
    expect(seen).toEqual(['welcome over', 'welcome drop']);
  });

  it('hands a drop over the intake to the intake, and lights no row', () => {
    dropRoutes.intake = { wrap: () => document.querySelector('.intake-wrap'), on: (e, here) => seen.push(`intake ${e.type} ${here}`) };
    pointAt('.intake-wrap textarea');
    routeDrop(ev('over'));
    expect(routeDrop(ev('drop'))).toBeUndefined();
    expect(seen).toEqual(['intake over true', 'intake drop true']);
    expect(useApp.getState().fileOver).toBeNull();
  });

  it('lights the row under the pointer while dragging, and clears it on leave', () => {
    dropRoutes.intake = { wrap: () => document.querySelector('.intake-wrap'), on: (e, here) => seen.push(`intake ${e.type} ${here}`) };
    pointAt('.trow');
    routeDrop(ev('enter'));
    expect(useApp.getState().fileOver).toBe('papers');
    routeDrop(ev('leave'));
    expect(useApp.getState().fileOver).toBeNull();
    // the intake heard both, not over it, so its veil stays down
    expect(seen).toEqual(['intake enter false', 'intake leave false']);
  });
});

describe('paste a link', () => {
  const paste = (target: Element, text: string) => {
    const e = new Event('paste', { bubbles: true, cancelable: true }) as ClipboardEvent;
    Object.defineProperty(e, 'clipboardData', { value: { getData: () => text } });
    Object.defineProperty(e, 'target', { value: target });
    return e;
  };

  it('knows a field and an editor from the page', () => {
    document.body.innerHTML = '<input id="i"><textarea id="t"></textarea><div class="ProseMirror" contenteditable="true"><p id="p">x</p></div><div id="d">plain</div>';
    expect(inEditable(document.getElementById('i'))).toBe(true);
    expect(inEditable(document.getElementById('t'))).toBe(true);
    expect(inEditable(document.getElementById('p'))).toBe(true);
    expect(inEditable(document.getElementById('d'))).toBe(false);
    expect(inEditable(document.body)).toBe(false);
    document.body.innerHTML = '';
  });

  it('clips an address into the given folder as the clipper would', async () => {
    const { fx, calls } = stubs();
    const l = await clipLink('https://example.org/a', 'papers', fx);
    expect(l).toEqual({ line: 'clipped · A Page · 3 words in papers/', open: 'papers/A Page.md', written: ['papers/A Page.md'], folders: [] });
    expect(calls).toEqual(['clip papers|A Page|https://example.org/a']);
  });

  it('leaves a paste into an editor alone, and does nothing with no vault', () => {
    document.body.innerHTML = '<div class="ProseMirror" contenteditable="true"><p id="p">x</p></div>';
    const { fx, calls } = stubs();
    const e = paste(document.getElementById('p')!, 'https://example.org/a');
    expect(onPaste(e, fx)).toBeUndefined();
    expect(e.defaultPrevented).toBe(false);
    useApp.setState({ vault: null });
    expect(onPaste(paste(document.body, 'https://example.org/a'), fx)).toBeUndefined();
    expect(calls).toEqual([]);
    document.body.innerHTML = '';
  });

  it('with nothing focused, clips the address into the active tab\'s folder and opens it; text is let be', async () => {
    useApp.setState({ vault: '/v', paletteOpen: false, notice: null, panes: openTab(emptyPanes(), 'papers/wozniak-1990.md') });
    const { fx, calls } = stubs();
    expect(onPaste(paste(document.body, 'just some words'), fx)).toBeUndefined();
    const e = paste(document.body, 'https://example.org/a');
    const p = onPaste(e, fx);
    expect(e.defaultPrevented).toBe(true);
    expect(useApp.getState().notice?.line).toBe('fetching · https://example.org/a');
    expect((await p)?.open).toBe('papers/A Page.md');
    expect(calls).toEqual(['clip papers|A Page|https://example.org/a']);
    expect(useApp.getState().notice).toMatchObject({ line: 'clipped · A Page · 3 words in papers/', open: 'papers/A Page.md', undo: true });
    expect(activeTab(useApp.getState().panes)?.id).toBe('papers/A Page.md');
  });

  it('offline: a notice, nothing written', async () => {
    useApp.setState({ vault: '/v', notice: null, panes: emptyPanes() });
    const { fx, calls } = stubs();
    fx.fetchPage = async () => { throw new Error('offline'); };
    expect(await onPaste(paste(document.body, 'https://example.org/a'), fx)).toBeNull();
    expect(useApp.getState().notice).toMatchObject({ line: 'nothing readable at that link', undo: false });
    expect(calls).toEqual([]);
  });
});
