// @vitest-environment jsdom
// Insert, paste, find (milestone 35): the slash menu puts in every block
// kind and the card forms, pasted HTML lands as the Markdown it stands
// for, an image lands beside the note, and find walks every match with
// marks folded. Every edit checks the Markdown written, and that the file
// read again is what the editor holds.

import { promises as fsp, readFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { Slice } from 'prosemirror-model';
import { EditorState, TextSelection } from 'prosemirror-state';
import { EditorView } from 'prosemirror-view';
import { describe, expect, it } from 'vitest';
import { parse, serialize, type Block } from '../../format/index.js';
import { htmlMarkdown } from '../../import/paste.js';
import { nodeFs } from '../../vault/node-fs.js';
import { Vault } from '../../vault/vault.js';
import { undo } from 'prosemirror-history';
import {
  SLASH_ITEMS, TABLE_SKELETON, askImageKey, clipboardText, currentMatch, findIn, findKey, findMatches, flatText, foldText, fromDoc, htmlPasteImages,
  insertImages, makeState, mathEditKey, opensAt, pasteInto, pickSlash, replaceAll, replaceMatch, slashItems, slashKey, toDoc, type FindMeta,
} from '../index.js';

const live = { frozen: () => false, pos: null };
const ed = (md: string): EditorState => makeState(parse(md).doc.blocks, live);

/** The body the editor writes back; and the file read again is what the editor holds. */
function md(state: EditorState): string {
  const blocks = fromDoc(state.doc);
  const r = parse('');
  r.doc.blocks = blocks;
  const out = serialize(r.doc);
  expect(parse(out).doc.blocks).toEqual(blocks);
  expect(fromDoc(toDoc(parse(out).doc.blocks))).toEqual(blocks);
  return out.replace(/\n$/, '');
}

/** The body as the file would be written, for text the file reads as a card (the editor turns it into one when it reads the write back). */
function written(state: EditorState): string {
  const r = parse('');
  r.doc.blocks = fromDoc(state.doc);
  return serialize(r.doc).replace(/\n$/, '');
}

function at(state: EditorState, needle: string, offset = 0): number {
  let found = -1;
  state.doc.descendants((node, pos) => {
    if (found >= 0) return false;
    if (!node.isTextblock) return true;
    const i = flatText(node).indexOf(needle);
    if (i >= 0) found = pos + 1 + i + offset;
    return false;
  });
  if (found < 0) throw new Error(`no "${needle}"`);
  return found;
}

/** A view over `md0` with the caret at the end of `needle` (or the end of the document). */
function typer(md0: string | Block[], needle?: string) {
  const state = typeof md0 === 'string' ? ed(md0) : makeState(md0, live);
  const view = new EditorView(document.body.appendChild(document.createElement('div')), { state });
  const end = needle === undefined ? EditorStateEnd(view.state) : at(view.state, needle, needle.length);
  view.dispatch(view.state.tr.setSelection(TextSelection.create(view.state.doc, end)));
  const type = (text: string) => {
    for (const ch of text) {
      const { from, to } = view.state.selection;
      const handled = view.someProp('handleTextInput', (f) => f(view, from, to, ch, () => view.state.tr.insertText(ch, from, to)));
      if (!handled) view.dispatch(view.state.tr.insertText(ch, from, to));
    }
  };
  const key = (k: string, init: KeyboardEventInit = {}) => {
    const ev = new KeyboardEvent('keydown', { key: k, bubbles: true, cancelable: true, ...init });
    view.dom.dispatchEvent(ev);
    return ev.defaultPrevented;
  };
  return { view, type, key };
}

/** The end of the last textblock. */
const EditorStateEnd = (state: EditorState): number => state.doc.content.size - 1;

describe('the slash menu', () => {
  it('opens on `/` at a block\'s start or after a space, not inside a word, a code span, or code', () => {
    const t = typer('one two');
    t.type('/');
    expect(slashKey.getState(t.view.state)).toBeNull();
    t.type(' /');
    expect(slashKey.getState(t.view.state)).toMatchObject({ query: '' });
    t.key('Escape');
    expect(slashKey.getState(t.view.state)).toBeNull();
    expect(md(t.view.state)).toBe('one two/ /');
    const s = ed('and/or `a b` x');
    expect(opensAt(s, at(s, 'and', 3))).toBe(false);
    expect(opensAt(s, at(s, 'a b', 2))).toBe(false);
    expect(opensAt(s, at(s, ' x', 1))).toBe(true);
    const c = ed('```\ncode\n```');
    expect(opensAt(c, 1)).toBe(false);
    t.view.destroy();
  });

  it('filters as you type, ↑↓ move and wrap, a space after no match closes it', () => {
    expect(slashItems('h', 'paragraph').map((i) => i.id).slice(0, 3)).toEqual(['h1', 'h2', 'h3']);
    expect(slashItems('bul', 'paragraph').map((i) => i.id)[0]).toBe('bullet');
    expect(slashItems('hr', 'paragraph').map((i) => i.id)[0]).toBe('rule');
    expect(slashItems('card', 'paragraph').map((i) => i.id)).toEqual(['cloze', 'qa', 'both']);
    expect(slashItems('card', 'item')).toEqual([]);
    // every row shows its Markdown; the keyed ones their key
    for (const it of SLASH_ITEMS) expect(it.md).toBeTruthy();
    expect(SLASH_ITEMS.find((i) => i.id === 'bullet')!.key).toBe('⌘⇧8');
    const t = typer('x');
    t.type(' /');
    t.key('ArrowUp');
    expect(slashKey.getState(t.view.state)!.index).toBe(SLASH_ITEMS.length - 1);
    t.key('ArrowDown');
    expect(slashKey.getState(t.view.state)!.index).toBe(0);
    t.type('zzz ');
    expect(slashKey.getState(t.view.state)).toBeNull();
    t.view.destroy();
  });

  /** Type `/query` in a fresh paragraph after `body`, pick with ⏎, return the view. */
  const slash = (body: string, query: string) => {
    const t = typer(body);
    t.view.dispatch(t.view.state.tr.split(t.view.state.selection.from));
    t.type(`/${query}`);
    expect(t.key('Enter')).toBe(true);
    return t;
  };

  it('puts in every block kind, the `/query` gone', () => {
    const cases: [string, string][] = [
      ['heading 1', '# Title'], ['heading 2', '## Title'], ['heading 3', '### Title'],
      ['bullet', '- Title'], ['numbered', '1. Title'], ['task', '- [ ] Title'], ['quote', '> Title'],
    ];
    for (const [q, want] of cases) {
      const t = typer('Title');
      t.view.dispatch(t.view.state.tr.setSelection(TextSelection.create(t.view.state.doc, 1)));
      t.type(`/${q}`);
      t.key('Enter');
      expect(md(t.view.state)).toBe(want);
      t.view.destroy();
    }
    let t = slash('Above', 'code');
    t.type('x = 1');
    expect(md(t.view.state)).toBe('Above\n\n```\nx = 1\n```');
    t.view.destroy();
    t = slash('Above', 'divider');
    t.type('after');
    expect(md(t.view.state)).toBe('Above\n\n---\n\nafter');
    t.view.destroy();
    t = slash('Above', 'table');
    expect(md(t.view.state)).toBe(`Above\n\n${TABLE_SKELETON}`);
    expect(parse(md(t.view.state)).doc.blocks[1]).toEqual({ kind: 'raw', text: TABLE_SKELETON });
    t.view.destroy();
    t = slash('Above', 'math');
    expect(mathEditKey.getState(t.view.state)).not.toBeNull();
    expect(md(t.view.state)).toBe('Above\n\n$$ $$');
    t.view.destroy();
    t = slash('Above', 'image');
    // the reader asks for the file; the `/image` is gone either way
    expect(md(t.view.state)).toBe('Above');
    t.view.destroy();
  });

  it('asks for an image with a meta the reader hears', () => {
    const t = typer('x');
    t.type(' /');
    let asked = false;
    pickSlash(SLASH_ITEMS.find((i) => i.id === 'image')!)(t.view.state, (tr) => { asked = tr.getMeta(askImageKey) === true; t.view.dispatch(tr); });
    expect(asked).toBe(true);
    t.view.destroy();
  });

  it('puts an insert row between the halves of a paragraph when the caret is inside it', () => {
    const t = typer('left right');
    t.view.dispatch(t.view.state.tr.setSelection(TextSelection.create(t.view.state.doc, at(t.view.state, 'right'))));
    t.type('/divider');
    t.key('Enter');
    expect(md(t.view.state)).toBe('left \n\n---\n\nright');
    t.view.destroy();
  });

  it('the card forms turn the paragraph into a card\'s shape', () => {
    let t = typer('c is the speed of light');
    t.type(' /q&a');
    t.key('Enter');
    t.type('299 792 458 m/s');
    expect(written(t.view.state)).toBe('c is the speed of light :: 299 792 458 m/s');
    expect(parse(written(t.view.state)).doc.blocks[0]!.kind).toBe('card');
    t.view.destroy();
    t = typer('kitāb');
    t.type(' /both');
    t.key('Enter');
    t.type('book');
    expect(written(t.view.state)).toBe('kitāb ::: book');
    t.view.destroy();
    t = typer('the plural of kitāb is');
    t.type(' /cloze');
    t.key('Enter');
    t.type('kutub');
    expect(written(t.view.state)).toBe('the plural of kitāb is {{c1::kutub}}');
    t.view.dispatch(t.view.state.tr.setSelection(TextSelection.create(t.view.state.doc, t.view.state.doc.child(0).nodeSize - 1)));
    t.type(', of qalam /cloze');
    t.key('Enter');
    t.type('aqlām');
    expect(written(t.view.state)).toBe('the plural of kitāb is {{c1::kutub}}, of qalam {{c2::aqlām}}');
    t.view.destroy();
  });

  it('one ⌘Z after a pick puts the typed `/query` back', () => {
    const t = typer('Title');
    t.view.dispatch(t.view.state.tr.setSelection(TextSelection.create(t.view.state.doc, 1)));
    t.type('/h2');
    t.key('Enter');
    expect(md(t.view.state)).toBe('## Title');
    undo(t.view.state, t.view.dispatch);
    expect(md(t.view.state)).toBe('/h2Title');
    t.view.destroy();
  });
});

describe('paste', () => {
  const FRAGMENT = `<meta charset="utf-8"><h2 style="font-size:1.4em">The canonical ensemble</h2>
<p>A system in contact with a <em>heat bath</em> at temperature <strong>T</strong>; see <a href="https://en.wikipedia.org/wiki/Canonical_ensemble">the article</a>.</p>
<ul><li>fixed <code>N</code>, <code>V</code></li><li>energy fluctuates<ul><li>as $\\sqrt{N}$</li></ul></li></ul>
<ol><li>write Z</li><li>take the log</li></ol>`;

  it('a web fragment lands as its Markdown: heading, emphasis, link, lists', () => {
    expect(htmlMarkdown(FRAGMENT)).toBe([
      '## The canonical ensemble',
      'A system in contact with a *heat bath* at temperature **T**; see [the article](https://en.wikipedia.org/wiki/Canonical_ensemble).',
      '- fixed `N`, `V`\n- energy fluctuates\n  - as $\\sqrt{N}$',
      '1. write Z\n2. take the log',
    ].join('\n\n'));
    const s = ed('Before');
    const tr = pasteInto(s.apply(s.tr.setSelection(TextSelection.create(s.doc, s.doc.content.size - 1))), { html: FRAGMENT, text: 'plain', plain: false })!;
    const out = md(s.apply(tr));
    expect(out).toContain('Before## The canonical ensemble'.replace('Before## ', 'Before\n\n## '));
    expect(out).toContain('- energy fluctuates\n  - as $\\sqrt{N}$');
  });

  it('Google Docs bold and italic in style; its wrapper is not bold', () => {
    const gd = '<b style="font-weight:normal;" id="docs-internal-guid-abc"><p><span style="font-weight:700">bold</span> and <span style="font-style:italic">slanted</span> words</p></b>';
    expect(htmlMarkdown(gd)).toBe('**bold** and *slanted* words');
  });

  it('⌘⇧V and a copy from a page here paste the plain text, which is read as Markdown', () => {
    const s = ed('x');
    const caret = s.apply(s.tr.setSelection(TextSelection.create(s.doc, 2)));
    expect(md(caret.apply(pasteInto(caret, { html: '<b>bold</b>', text: 'bold', plain: true })!))).toBe('xbold');
    expect(md(caret.apply(pasteInto(caret, { html: '<p data-pm-slice="1 1 []">- a</p>', text: '- a\n- b', plain: false })!))).toBe('x\n\n- a\n- b');
  });

  it('pasted text in a paragraph is typed in; in code it is code', () => {
    const s = ed('one three');
    const c = s.apply(s.tr.setSelection(TextSelection.create(s.doc, at(s, 'three'))));
    expect(md(c.apply(pasteInto(c, { html: '', text: 'two ', plain: false })!))).toBe('one two three');
    const k = ed('```\na\n```');
    const kc = k.apply(k.tr.setSelection(TextSelection.create(k.doc, 2)));
    expect(md(kc.apply(pasteInto(kc, { html: '<em>x</em>', text: '- y', plain: true })!))).toBe('```\na- y\n```');
  });

  it('a copy writes the Markdown source: a list with its markers, a formula as typed, a card with its schedule', () => {
    const body = 'the area $\\pi r^2$ here\n\n- one\n- two\n\nq :: a ^c1\n<!-- sr due=2026-11-01 st=review s=3 d=5 r=2 l=0 ivl=3 last=2026-10-29T10:00:00Z g=3 -->';
    const s = ed(body);
    const cut = (from: number, to: number) => clipboardText(s.doc.slice(from, to, true));
    const p = s.doc.child(0);
    expect(cut(1, p.nodeSize - 1)).toBe('the area $\\pi r^2$ here');
    expect(cut(0, s.doc.content.size)).toBe(body);
    const list = p.nodeSize;
    expect(cut(list + 2, list + 5)).toBe('one');
    expect(cut(list + 1, list + s.doc.child(1).nodeSize - 1)).toBe('- one\n- two');
    // what a copy wrote pastes back as the same blocks
    const empty = ed('');
    expect(md(empty.apply(pasteInto(empty, { html: '', text: cut(0, s.doc.content.size), plain: false })!))).toBe(body);
  });

  it('through the page: a paste event with HTML lands its Markdown; after ⌘⇧V the same paste is its plain text', () => {
    const paste = (t: ReturnType<typeof typer>, html: string, text: string) => {
      const ev = new Event('paste', { bubbles: true, cancelable: true }) as Event & { clipboardData: unknown };
      ev.clipboardData = { getData: (type: string) => (type === 'text/html' ? html : type === 'text/plain' ? text : ''), types: ['text/html', 'text/plain'], files: [], items: [] };
      t.view.dom.dispatchEvent(ev);
    };
    let t = typer('see ');
    paste(t, '<a href="https://example.org/x">the page</a>', 'the page');
    expect(md(t.view.state)).toBe('see [the page](https://example.org/x)');
    t.view.destroy();
    t = typer('see ');
    const mod = /Mac/.test(navigator.platform) ? { metaKey: true } : { ctrlKey: true };
    t.key('V', { code: 'KeyV', shiftKey: true, ...mod });
    paste(t, '<a href="https://example.org/x">the page</a>', 'the page');
    expect(md(t.view.state)).toBe('see the page');
    t.view.destroy();
  });

  it('images on the clipboard are the paste when nothing else is said', () => {
    expect(htmlPasteImages('', '')).toBe(true);
    expect(htmlPasteImages('<img src="https://a.b/c.png">', 'https://a.b/c.png')).toBe(true);
    expect(htmlPasteImages('<p>a paragraph <img src="https://a.b/c.png"></p>', 'a paragraph')).toBe(false);
  });
});

describe('an image beside the note', () => {
  it('lands as the next img-NN in the document\'s folder and is linked there', async () => {
    const root = await fsp.mkdtemp(join(tmpdir(), 'ilmi-img-'));
    await fsp.mkdir(join(root, 'fleeting'));
    await fsp.writeFile(join(root, 'fleeting', '2026 10 30.md'), 'Friday.\n');
    const vault = await Vault.open(nodeFs, root);
    const png = new Uint8Array([0x89, 0x50, 0x4e, 0x47, 1, 2, 3]);
    const a = await vault.addImage('fleeting/2026 10 30.md', png, 'image/png', 'Screenshot.png');
    const b = await vault.addImage('fleeting/2026 10 30.md', png, '', 'photo.JPEG');
    expect(a).toBe('2026%2010%2030/img-01.png');
    expect(b).toBe('2026%2010%2030/img-02.jpg');
    expect(Array.from(await fsp.readFile(join(root, 'fleeting', '2026 10 30', 'img-01.png')))).toEqual(Array.from(png));
    await expect(vault.addImage('fleeting/2026 10 30.md', png, 'text/plain', 'a.txt')).rejects.toThrow();
    const s = ed('Friday.');
    const tr = insertImages(s.apply(s.tr.setSelection(TextSelection.create(s.doc, 8))), [a]);
    const after = s.apply(s.tr.setSelection(TextSelection.create(s.doc, 8))).apply(tr);
    expect(md(after)).toBe('Friday.\n\n![](2026%2010%2030/img-01.png)');
    expect(after.selection.$from.parent.content.size).toBe(0);
    await fsp.rm(root, { recursive: true });
  });
});

describe('find in the page', () => {
  const step = (s: EditorState, meta: FindMeta) => s.apply(s.tr.setMeta(findKey, meta));

  it('folds case, accents, and ḥarakāt: an unvoweled word finds the voweled one, the marks after it included', () => {
    expect(foldText('كَانَ')).toBe('كان');
    expect(findIn('كَانَ الجَوُّ بَارِدًا', 'كان')).toEqual([{ from: 0, to: 5 }]);
    expect(findIn('Lücke, LUCKE', 'lucke')).toHaveLength(2);
    expect(findIn('al-afʿāl al-nāqiṣa', 'naqisa')).toHaveLength(1);
    expect(findIn('nothing', ' ')).toEqual([]);
  });

  it('walks every match with ⏎ and wraps; cards and tables count; replace writes into text only', () => {
    let s = ed('كَانَ here, كان there\n\n| a |\n| --- |\n| كَانَ |\n\nq :: كَانَ');
    s = step(s, { query: 'كان', from: 0 });
    const f = findKey.getState(s)!;
    expect(f.matches.map((m) => m.atom)).toEqual([false, false, true, true]);
    const seen: number[] = [];
    for (let i = 0; i < 5; i++) { seen.push(findKey.getState(s)!.index); s = step(s, { step: 1 }); }
    expect(seen).toEqual([0, 1, 2, 3, 0]);
    s = step(s, { index: 0 });
    s = step(s, { step: -1 });
    expect(findKey.getState(s)!.index).toBe(3);
    s = step(s, { index: 0 });
    s = s.apply(replaceMatch(s, 'صار')!);
    expect(md(s).split('\n')[0]).toBe('صار here, كان there');
    expect(currentMatch(s)!.from).toBe(at(s, 'كان'));
    s = s.apply(replaceAll(s, 'ليس')!.tr);
    expect(md(s).split('\n')[0]).toBe('صار here, ليس there');
    expect(findKey.getState(s)!.matches.every((m) => m.atom)).toBe(true);
  });

  it('every كان in the sample\'s kāna note, unvoweled, is found', () => {
    const text = readFileSync(join(process.cwd(), 'samples/double-major/courses/fall-2026/arab-401-advanced-grammar/kana-and-its-sisters.md'), 'utf8');
    const blocks = parse(text).doc.blocks;
    const s = makeState(blocks, live);
    const ms = findMatches(s.doc, 'كان');
    // the same count over the file's own text, outside formulas
    const want = blocks.reduce((n, b) => n + findIn(b.text.replace(/\$[^$]*\$/g, ''), 'كان').length, 0);
    expect(ms.length).toBe(want);
    expect(ms.length).toBeGreaterThan(20);
  });
});

describe('clipboardText on a bare slice', () => {
  it('inline content alone is its text', () => {
    const s = ed('a *b* c');
    expect(clipboardText(new Slice(s.doc.child(0).content, 0, 0))).toBe('a *b* c');
  });
});
