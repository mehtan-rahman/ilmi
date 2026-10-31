// @vitest-environment jsdom
// Milestone 46, after the window's run 2: a soft line break inside a
// paragraph, a list item, or a quote survives typing. The browser types
// into a text node and ProseMirror reads the block back from the DOM; the
// textblocks are `whitespace: 'pre'`, so the newline comes back as itself,
// not as a space that joins the file's lines. Every case goes through that
// DOM path: a text node changed behind ProseMirror, its observer flushed.
// Over every multi-line block of the sample collection too.

import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join, relative } from 'node:path';
import { TextSelection } from 'prosemirror-state';
import { EditorView } from 'prosemirror-view';
import { describe, expect, it } from 'vitest';
import { parse, serialize, type Doc } from '../../format/index.js';
import { fromDoc, makeState, pasteInto, schema, textOf } from '../../reader/index.js';
import { handleClickOn, nodeViews } from '../Reader.js';

const SAMPLES = join(import.meta.dirname, '../../../samples');

function mount(md: string): { view: EditorView; doc: Doc } {
  const { doc } = parse(md);
  const state = makeState(doc.blocks, { frozen: () => false, pos: null });
  const view = new EditorView(document.body.appendChild(document.createElement('div')), { state, nodeViews, editable: () => true, attributes: { class: 'draft-doc' }, handleClickOn });
  return { view, doc };
}

const flush = (view: EditorView) => (view as unknown as { domObserver: { flush(): void } }).domObserver.flush();
const written = (view: EditorView, doc: Doc) => serialize({ ...doc, blocks: fromDoc(view.state.doc) });

/** The text nodes of an element, in order. */
function texts(el: Element): Text[] {
  const out: Text[] = [];
  const w = document.createTreeWalker(el, NodeFilter.SHOW_TEXT);
  for (let n = w.nextNode(); n; n = w.nextNode()) out.push(n as Text);
  return out;
}

/** "Type" into the text node holding `needle`: the browser's edit, read back by ProseMirror. */
function typeInto(view: EditorView, needle: string, edit: (s: string) => string): void {
  const node = texts(view.dom).find((t) => t.data.includes(needle));
  if (!node) throw new Error(`no text node with "${needle}"`);
  node.data = edit(node.data);
  flush(view);
}

describe('a soft line break survives typing on the line after it', () => {
  it('in a paragraph: a hemistich typed on, the lines kept', () => {
    const src = 'قِفَا نَبْكِ مِنْ ذِكْرَى حَبِيبٍ وَمَنْزِلِ\nبِسِقْطِ اللِّوَى بَيْنَ الدَّخُولِ فَحَوْمَلِ\n';
    const { view, doc } = mount(src);
    typeInto(view, 'فَحَوْمَلِ', (s) => `${s} *`);
    expect(written(view, doc)).toBe('قِفَا نَبْكِ مِنْ ذِكْرَى حَبِيبٍ وَمَنْزِلِ\nبِسِقْطِ اللِّوَى بَيْنَ الدَّخُولِ فَحَوْمَلِ *\n');
    view.destroy();
  });

  it('in a list item\'s continuation line, and in a quote', () => {
    const li = mount('- an address\n  12 Garden Row\n');
    typeInto(li.view, 'Garden Row', (s) => `${s}, flat 3`);
    expect(written(li.view, li.doc)).toBe('- an address\n  12 Garden Row, flat 3\n');
    li.view.destroy();
    const qt = mount('> first line\n> second line\n');
    typeInto(qt.view, 'second', (s) => s.replace('second', 'the second'));
    expect(written(qt.view, qt.doc)).toBe('> first line\n> the second line\n');
    qt.view.destroy();
  });

  it('a typed double space and a trailing space stay as typed, nothing else moves', () => {
    const { view, doc } = mount('one\ntwo\n');
    typeInto(view, 'two', (s) => s.replace('two', 'tw  o '));
    expect(written(view, doc)).toBe('one\ntw  o \n');
    view.destroy();
  });

  it('beside a formula: the break after a math chip, a line typed after it', () => {
    const { view, doc } = mount('the action $J = \\oint p\\,dq$\nis an adiabatic invariant\n');
    typeInto(view, 'adiabatic', (s) => `${s}, for slow changes`);
    expect(written(view, doc)).toBe('the action $J = \\oint p\\,dq$\nis an adiabatic invariant, for slow changes\n');
    expect(view.dom.querySelectorAll('.math')).toHaveLength(1);
    view.destroy();
  });

  it('a pasted paragraph of HTML still reads as prose: its source\'s line breaks and indentation are not kept', () => {
    const { view } = mount('before\n');
    const end = view.state.doc.content.size - 1;
    const state = view.state.apply(view.state.tr.setSelection(TextSelection.create(view.state.doc, end)));
    const tr = pasteInto(state, { html: '<p>one\n      two</p>', text: 'one two', plain: false })!;
    const after = state.apply(tr);
    const all: string[] = [];
    after.doc.forEach((n) => { if (n.isTextblock) all.push(textOf(n)); });
    expect(all.join('|')).not.toMatch(/\n {2,}/);
    view.destroy();
  });
});

describe('every multi-line block of the samples and the corpus', () => {
  const files: string[] = [];
  const walk = (dir: string) => {
    for (const name of readdirSync(dir).sort()) {
      const p = join(dir, name);
      if (statSync(p).isDirectory()) { if (name !== '.ilmi') walk(p); } else if (name.endsWith('.md')) files.push(p);
    }
  };
  walk(SAMPLES);
  walk(join(import.meta.dirname, '../../format/__tests__/corpus'));

  it('keeps its lines when its last line is typed into through the DOM', () => {
    let blocks = 0;
    for (const file of files) {
      const src = readFileSync(file, 'utf8');
      // only files with a block over lines are drawn: the rest have nothing to check
      if (!parse(src).doc.blocks.some((b) => b.kind !== 'card' && b.text.includes('\n'))) continue;
      const { view } = mount(src);
      const targets: { pos: number; text: string }[] = [];
      view.state.doc.descendants((n, pos) => {
        if (!n.isTextblock || n.type === schema.nodes.code_block) return true;
        const t = textOf(n);
        if (t.includes('\n')) targets.push({ pos, text: t });
        return false;
      });
      // from the last, so a letter typed never moves a block still to come
      for (const { pos, text } of targets.reverse()) {
        const dom = view.nodeDOM(pos) as HTMLElement | null;
        const last = dom ? texts(dom).filter((t) => !t.parentElement?.closest('.math')).pop() : undefined;
        if (!last) continue;
        last.data += 'Z';
        flush(view);
        const now = textOf(view.state.doc.nodeAt(pos)!);
        expect(now.replace('Z', ''), `${relative(SAMPLES, file)}: "${text.slice(0, 40)}"`).toBe(text);
        expect(now.split('\n').length).toBe(text.split('\n').length);
        blocks++;
      }
      view.destroy();
    }
    console.log(`multi-line blocks typed into: ${blocks}`);
    expect(blocks).toBeGreaterThan(10);
  }, 30000);
});
