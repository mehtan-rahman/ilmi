// The reader: one document as one continuous surface. Prose is editable
// ProseMirror, cards sit in the flow as atoms, fenced code, lists, and
// quotes are edited as themselves (a table or an HTML block stays a drawn
// atom), math renders as KaTeX chips edited in a field under the chip, and
// the reading marker runs down the left margin. Every change goes through
// the vault as blocks; nothing here string-edits a file.

import katex from 'katex';
import type { Node as PMNode } from 'prosemirror-model';
import { NodeSelection, Selection, TextSelection, type EditorState, type Transaction } from 'prosemirror-state';
import { EditorView, type Decoration, type NodeView } from 'prosemirror-view';
import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { PRI_DEFAULT, cardFields, clozeSegments, mathSpanEnd, meta, serialize, setField, type Blank, type Block, type Card, type Doc, type MathSeg } from '../format/index.js';
import {
  blockAt, blocksEqual, cardDue, classifyRaw, editorialRanges, flatRanges, fromDoc, frozenKey, imagesKey, indentWidth, inlineRanges, insertCard, isMathEdit,
  linkTarget, literalSpans, makeState, markerKey, markerNumber, markerPos, markerRanges, mathEditKey, mathSplit, passage, pickPos, pressed, schema, setLink,
  setReadPos, splitBlocks, atomFind, markFinds, toggleInline, toggleTask, type Band, type InlineRange, type InlineToggle, type LinkTarget, type Passage, type RawShape,
  askImageKey, closeAtMatch, dirAttr, strongDir, withBases, type Dir, findKey, insertImages, pickSlash, replaceAll, replaceMatch, slashContext, slashItems, slashKey, htmlPasteImages,
  type FindMeta, type FindState, type SlashItem, type SlashState,
  CODE_LANGS, addColumn, addRow, alignColumn, codeHTML, codeLang, deleteColumn, deleteRow, foldKey, foldedKeys, foldsHiding, ruleEndIndex, langOf, setCodeLang, type Align, type FoldMeta,
} from '../reader/index.js';
import { advanceWrite, whenToDate } from '../schedule/index.js';
import { dirOf, nameOf, type Loaded, type Vault } from '../vault/index.js';
import { CueActions } from '../plugins/CueActions.js';
import { onPluginAction, publishSelection as publishPluginSelection, runBlockHooks, toPluginSelection, usePlugins, wantsBlocks, type PluginSelection } from '../plugins/index.js';
import { Composer } from './Composer.js';
import { imageLoader } from './images.js';
import { imagePicker, pageDrops, readImagePath, type ImageFile } from './pageImages.js';
import { dueLabel } from './items.js';
import { titleOf } from './names.js';
import { useApp, type DocInfo } from './store.js';
import { currentVault, enrolReading, extractNode, setFolds } from './vault.js';
import { popMenu, type PopItem } from './popMenu.js';
import { registerHeadings } from './headings.js';
import 'katex/dist/katex.min.css';
import 'prosemirror-gapcursor/style/gapcursor.css';
import './reader.css';
import './incontext.css';
import { Crumbs } from './Crumbs.js';
import { TabsToggle } from './TabsToggle.js';
import { StudyButton } from './StudyButton.js';

/** How long after the last keystroke the file is written. */
const WRITE_DELAY = 500;

// ── writing ──────────────────────────────────────────────────────

/**
 * Writes for one document, one at a time, a little after the last change.
 * Remembers the text each write will produce, so the vault's report of it
 * can be told from an external change.
 */
class Writer {
  private own = new Map<string, number>();
  private chain: Promise<unknown> = Promise.resolve();
  private timer: ReturnType<typeof setTimeout> | null = null;
  private pending: (() => Block[]) | null = null;
  /** Bumped by the caller on every document change; each write records the value it saw. */
  version = 0;

  constructor(private readonly vault: Vault, private readonly path: string) {}

  /** The version a write of `text` saw, if `text` is ours; the entry is consumed. */
  claim(text: string): number | undefined {
    const v = this.own.get(text);
    if (v !== undefined) this.own.delete(text);
    return v;
  }

  update(mutate: (doc: Doc) => void): Promise<Loaded | null> {
    const version = this.version;
    const run = this.chain.then(async () => {
      const cur = await this.vault.read(this.path);
      const next = structuredClone(cur.doc);
      mutate(next);
      const text = serialize(next);
      if (text === cur.text) return null;
      this.own.set(text, version);
      return this.vault.update(this.path, mutate);
    });
    this.chain = run.catch((e: unknown) => console.error(this.path, e));
    return run;
  }

  /** Write the body `blocks()` gives, after a pause; the latest call wins. */
  schedule(blocks: () => Block[]): void {
    this.pending = blocks;
    if (this.timer) clearTimeout(this.timer);
    this.timer = setTimeout(() => this.flush(), WRITE_DELAY);
  }

  flush(): void {
    if (this.timer) clearTimeout(this.timer);
    this.timer = null;
    const pending = this.pending;
    this.pending = null;
    if (!pending) return;
    const blocks = pending();
    void this.update((doc) => { doc.blocks = blocks; });
  }

  /** Run `fn` once everything scheduled so far has been written. */
  run<T>(fn: () => Promise<T>): Promise<T> {
    this.flush();
    const run = this.chain.then(fn);
    this.chain = run.catch((e: unknown) => console.error(this.path, e));
    return run;
  }

  /** Drop what has not been written yet: the file changed under us and wins. */
  cancel(): void {
    if (this.timer) clearTimeout(this.timer);
    this.timer = null;
    this.pending = null;
  }
}

// ── rendering pieces shared by node views ────────────────────────

const escapeHtml = (s: string) => s.replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c]!);

function mathHTML(raw: string): string {
  const display = raw.startsWith('$$');
  const tex = display ? raw.slice(2, -2) : raw.slice(1, -1);
  let inner: string;
  try {
    inner = katex.renderToString(tex, { throwOnError: false, displayMode: display });
  } catch {
    inner = escapeHtml(raw);
  }
  // a formula reads left to right on its own, in an Arabic sentence too
  return `<span class="math${display ? ' display' : ''}" dir="ltr" data-tex="${escapeHtml(raw)}">${inner}</span>`;
}

const INLINE_CLASS: Record<InlineRange['kind'], string> = { em: 'md-em', strong: 'md-strong', strike: 'md-strike', code: 'md-code', link: 'md-link', image: 'md-alt' };

/**
 * One run of text with its inline Markdown drawn as itself and its
 * editorial marks lit. The markers stay in the markup, hidden: the
 * read-only parts have nothing to type into, so nothing to dim them for.
 */
function inlineHTML(text: string, ranges: InlineRange[], from: number, to: number, literal: { from: number; to: number }[]): string {
  let out = '';
  let at = from;
  const plain = (a: number, b: number) => {
    if (b <= a) return '';
    let s = '';
    let last = a;
    for (const r of editorialRanges(text.slice(a, b))) {
      const rf = a + r.from;
      const rt = a + r.to;
      if (literal.some((l) => rf < l.to && l.from < rt)) continue;
      s += escapeHtml(text.slice(last, rf)) + `<span class="ed-mark ${r.kind}">${escapeHtml(text.slice(rf, rt))}</span>`;
      last = rt;
    }
    return s + escapeHtml(text.slice(last, b));
  };
  for (const r of ranges) {
    out += plain(at, r.from);
    const [open, close] = markerRanges(r);
    const marker = (m: { from: number; to: number } | undefined) => (m ? `<span class="md-mark hidden">${escapeHtml(text.slice(m.from, m.to))}</span>` : '');
    const inner = r.kind === 'code' || r.kind === 'image' ? escapeHtml(text.slice(r.inner.from, r.inner.to)) : inlineHTML(text, r.children, r.inner.from, r.inner.to, literal);
    const attrs = r.kind === 'link' && r.href ? ` data-href="${escapeHtml(r.href)}"` : r.kind === 'code' ? ' dir="ltr"' : '';
    out += `${marker(open)}<span class="${INLINE_CLASS[r.kind]}"${attrs}>${inner}</span>${marker(close)}`;
    at = r.to;
  }
  return out + plain(at, to);
}

function markedHTML(text: string): string {
  const ranges = inlineRanges(text);
  return inlineHTML(text, ranges, 0, text.length, literalSpans(ranges));
}

/** Text with math as chips, inline Markdown as itself, and editorial marks lit, for the read-only parts. */
export function richHTML(text: string): string {
  return mathSplit(text).map((p) => (typeof p === 'string' ? markedHTML(p) : mathHTML(p.math))).join('');
}

// ── raw blocks drawn as what they are ────────────────────────────

const ALIGN_ATTR = (a: 'left' | 'center' | 'right' | null) => (a ? ` style="text-align:${a}"` : '');

/**
 * A run of text as blocks: a list, a quote, code, or a table by its shape, a
 * heading, else a paragraph. In a `tight` list item (no blank line in it)
 * the paragraphs stay bare, so the item reads on one line with any nested
 * list under it.
 */
function blocksHTML(text: string, tight: boolean): string {
  const bare = tight && !/\n[ \t]*\n/.test(text);
  return splitBlocks(text).map((c) => {
    const shape = classifyRaw(c);
    if (shape.kind !== 'other') return shapeHTML(shape, c);
    const h = /^ {0,3}(#{1,6})(?:[ \t]+(.*?))?[ \t]*$/s.exec(c);
    if (h) return `<h${h[1]!.length}${dirAttr(h[2] ?? '')}>${richHTML((h[2] ?? '').replace(/[ \t]+#+$/, '').trim())}</h${h[1]!.length}>`;
    return bare ? richHTML(c) : `<p${dirAttr(c)}>${richHTML(c)}</p>`;
  }).join('');
}

/** The element a raw block's shape stands for; `null` for a shape that stays as source. */
function shapeHTML(shape: RawShape, text: string): string {
  switch (shape.kind) {
    case 'code':
      return `<pre><code${shape.lang ? ` class="language-${escapeHtml(shape.lang)}"` : ''}>${codeHTML(shape.code, shape.lang) ?? escapeHtml(shape.code)}</code></pre>`;
    case 'list': {
      const tag = shape.ordered ? 'ol' : 'ul';
      const start = shape.ordered && shape.start !== 1 ? ` start="${shape.start}"` : '';
      // each item its own way by the rule, one with no letter the item before's;
      // the list reads its first decided item's way
      let cur: Dir | null = null;
      const dirs = shape.items.map((it) => (cur = strongDir(it.text) ?? cur));
      const attr = (d: Dir | null) => (d ? ` dir="${d}"` : '');
      return `<${tag}${start}${attr(dirs.find((d) => d) ?? null)}>${shape.items.map((it, i) => `<li${attr(dirs[i] ?? null)}>${blocksHTML(it.text, true)}</li>`).join('')}</${tag}>`;
    }
    case 'quote':
      return `<blockquote${dirAttr(shape.text)}>${blocksHTML(shape.text, false)}</blockquote>`;
    case 'table': {
      // a cell with no letters in it (a number) reads the table's way
      const head = shape.head.map((h, i) => `<th${ALIGN_ATTR(shape.align[i] ?? null)}${dirAttr(h)}>${richHTML(h)}</th>`).join('');
      const rows = shape.rows.map((r) => `<tr>${r.map((c, i) => `<td${ALIGN_ATTR(shape.align[i] ?? null)}${dirAttr(c)}>${richHTML(c)}</td>`).join('')}</tr>`).join('');
      return `<table><thead><tr>${head}</tr></thead>${rows ? `<tbody>${rows}</tbody>` : ''}</table>`;
    }
    case 'rule':
      return '<hr>';
    case 'other':
      return escapeHtml(text);
  }
}

/** A raw block as its element, or null when it is one the reader keeps as mono source (an HTML block, a comment). */
export function rawHTML(text: string): { kind: Exclude<RawShape['kind'], 'other'>; html: string } | null {
  const shape = classifyRaw(text);
  return shape.kind === 'other' ? null : { kind: shape.kind, html: shapeHTML(shape, text) };
}

// A formula holding blanks (FORMAT.md §5.1) is rendered by KaTeX once per
// state: a hidden blank is a box over a phantom of its answer, a revealed
// one its answer on the accent, another group's blank plain. KaTeX takes a
// colour, not a class, and `trust` stays off, so two sentinel colours go in
// and the theme's variables come out.

export type BlankState = 'hidden' | 'revealed' | 'plain';

const HIDE = '#010203';
const SHOW = '#040506';

/** An answer split at its top-level `&` and `\\`, the separators kept at the odd indices. */
function alignPieces(tex: string): string[] {
  const out: string[] = [];
  let depth = 0;
  let cur = '';
  for (let j = 0; j < tex.length; j++) {
    const c = tex[j]!;
    if (c === '\\') {
      if (tex[j + 1] === '\\' && depth === 0) { out.push(cur, '\\\\'); cur = ''; j++; continue; }
      cur += c + (tex[j + 1] ?? '');
      j++;
      continue;
    }
    if (c === '{') depth++;
    else if (c === '}') depth--;
    if (c === '&' && depth === 0) { out.push(cur, '&'); cur = ''; continue; }
    cur += c;
  }
  out.push(cur);
  return out;
}

/** The answer boxed, piece by piece so an alignment mark stays outside the box. */
function boxed(answer: string, state: 'hidden' | 'revealed', display: boolean): string {
  return alignPieces(answer).map((p, i) => {
    if (i % 2 === 1 || !p.trim()) return p;
    const inner = state === 'hidden' ? `\\phantom{${p}}` : p;
    return `\\colorbox{${state === 'hidden' ? HIDE : SHOW}}{$${display ? '\\displaystyle ' : ''}${inner}$}`;
  }).join('');
}

/**
 * A formula holding blanks, rendered once with each blank in its state. The
 * chip says how many blanks are the card's own (`data-blanks`) and whether
 * they all show (`data-revealed`); its source is kept only while nothing is
 * hidden. TeX that KaTeX refuses falls back to the source as text, its
 * blanks as text blanks of `cls(state)`.
 */
export function mathBlanksHTML(seg: MathSeg, stateOf: (b: Blank) => BlankState, cls: (s: BlankState) => string): string {
  const states: BlankState[] = [];
  const tex = seg.parts.map((p) => {
    if (typeof p === 'string') return p;
    const s = stateOf(p);
    states.push(s);
    return s === 'plain' ? p.answer : boxed(p.answer, s, seg.display);
  }).join('');
  const own = states.filter((s) => s !== 'plain');
  const hidden = own.includes('hidden');
  const attrs = `class="math${seg.display ? ' display' : ''} blanks" data-blanks="${own.length}" data-revealed="${own.length && !hidden ? '1' : '0'}"${hidden ? '' : ` data-tex="${escapeHtml(seg.span)}"`}`;
  try {
    const html = katex.renderToString(tex, { throwOnError: true, displayMode: seg.display, output: 'html' });
    return `<span ${attrs}>${html.split(HIDE).join('var(--fg-5)').split(SHOW).join('var(--accent-soft)')}</span>`;
  } catch {
    let k = 0;
    const body = seg.parts.map((p) => (typeof p === 'string' ? escapeHtml(p) : `<span class="${cls(states[k++]!)}">${escapeHtml(p.answer)}</span>`)).join('');
    return `<span ${attrs}><code class="tex">${body}</code></span>`;
  }
}

/** A cloze card's text: blanks in text as spans of `cls(state)`, formulas holding blanks through KaTeX. */
export function clozeHTML(text: string, stateOf: (b: Blank, index: number) => BlankState, cls: (s: BlankState) => string): string {
  let index = -1;
  return withBases(clozeSegments(text)).map((seg) => {
    if (typeof seg === 'string') return richHTML(seg);
    if ('span' in seg) return mathBlanksHTML(seg, (b) => stateOf(b, ++index), cls);
    const state = stateOf(seg, ++index);
    if (seg.base === undefined) return `<span class="${cls(state)}">${richHTML(seg.answer)}</span>`;
    // a case ending: the blank is its letter, the mark shown only once revealed
    return `<span class="${cls(state)} on-letter">${escapeHtml(seg.base)}${state === 'hidden' ? '' : escapeHtml(seg.answer)}</span>`;
  }).join('');
}

/** A face's `dir` for React: its majority script's way (`strongDir`), undefined (inherit) when it has no letter. */
export const faceDir = (text: string): Dir | undefined => strongDir(text) ?? undefined;

/** A blank's answer as the answer face shows it: a case ending on its letter, else the answer alone. */
export function blankAnswers(text: string, keep: (index: number) => boolean): string[] {
  const out: string[] = [];
  let k = 0;
  for (const seg of withBases(clozeSegments(text))) {
    if (typeof seg === 'string') continue;
    if ('span' in seg) { for (const p of seg.parts) if (typeof p !== 'string' && keep(k++)) out.push(answerHTML(p, seg.display)); }
    else if (keep(k++)) out.push(seg.base === undefined ? answerHTML(seg) : `<span class="on-letter">${escapeHtml(seg.base + seg.answer)}</span>`);
  }
  return out;
}

/** A blank's answer on its own: TeX as math, an align line through `aligned`. */
export function answerHTML(b: Blank, display = false): string {
  if (!b.math) return richHTML(b.answer);
  const tex = /&|\\\\/.test(b.answer) ? `\\begin{aligned}${b.answer}\\end{aligned}` : b.answer;
  let inner: string;
  try {
    inner = katex.renderToString(`${display ? '\\displaystyle ' : ''}${tex}`, { throwOnError: false, output: 'html' });
  } catch {
    inner = escapeHtml(b.answer);
  }
  return `<span class="math">${inner}</span>`;
}

export function cardHTML(card: Card): string {
  const f = cardFields(card.text);
  if (!f) return richHTML(card.text);
  switch (f.form) {
    case 'cloze':
      return clozeHTML(card.text, () => 'revealed', () => 'cz');
    case 'qa':
      return `<span class="cs-q"${dirAttr(f.front)}>${richHTML(f.front)}</span><span class="cs-a"${dirAttr(f.back)}>${richHTML(f.back)}</span>`;
    case 'bidir':
      // each face isolated its own way, the arrow between them
      return `<span><bdi${dirAttr(f.left)}>${richHTML(f.left)}</bdi> <span class="cs-arrow">⇄</span> <bdi${dirAttr(f.right)}>${richHTML(f.right)}</bdi></span>`;
  }
}

// ── node views ───────────────────────────────────────────────────

/**
 * A view's own classes set, the ones ProseMirror put there from a
 * decoration (`find-in`, `find-current`) and the selection kept: a redraw
 * must not take them off, since ProseMirror only adds and removes what
 * changed between two decorations.
 */
function ownClasses(dom: HTMLElement, own: string): void {
  const kept = Array.from(dom.classList).filter((c) => c === 'selected' || c === 'landed' || c.startsWith('find-') || c.startsWith('fold-'));
  dom.className = [own, ...kept].join(' ');
}

class CardView implements NodeView {
  dom: HTMLElement;

  constructor(node: PMNode, decorations: readonly Decoration[] = []) {
    this.dom = document.createElement('div');
    this.dom.setAttribute('contenteditable', 'false');
    this.render(node, decorations);
  }

  render(node: PMNode, decorations: readonly Decoration[]): void {
    const card = node.attrs.card as Card;
    const now = new Date();
    const due = cardDue(card);
    const isDue = due === undefined || whenToDate(due) <= now;
    const inner =
      `<div class="cs-body">${cardHTML(card)}</div>` +
      `<div class="cs-foot"><span class="cs-state" data-due="${isDue ? '1' : '0'}">${escapeHtml(dueLabel(due, now))}</span></div>`;
    if (card.item === undefined) {
      ownClasses(this.dom, `card-span${isDue ? ' due' : ''}`);
      this.dom.style.removeProperty('--indent');
      this.dom.innerHTML = inner;
    } else {
      // a list item (FORMAT.md §5.2): its marker in the list's column, set in as the item is
      const m = /^( *)(\S+)/.exec(card.item)!;
      const n = markerNumber(`${m[2]} `);
      ownClasses(this.dom, `card-span in-item${isDue ? ' due' : ''}`);
      this.dom.style.setProperty('--indent', String(indentWidth(m[1]!)));
      this.dom.innerHTML = `<span class="li-mark${n === null ? '' : ' num'}">${n === null ? '•' : escapeHtml(m[2]!)}</span><div class="cs-item">${inner}</div>`;
    }
    markFinds(this.dom.querySelector('.cs-body')!, atomFind(decorations));
  }

  update(node: PMNode, decorations: readonly Decoration[]): boolean {
    if (node.type !== schema.nodes.card) return false;
    this.render(node, decorations);
    return true;
  }

  selectNode(): void { this.dom.classList.add('selected'); }
  deselectNode(): void { this.dom.classList.remove('selected'); }
  ignoreMutation(): boolean { return true; }
}

/** KaTeX's message without its prefix and the echo of the source after the position. */
function texError(e: unknown): string {
  const msg = e instanceof Error ? e.message : String(e);
  return msg.replace(/^KaTeX parse error: /, '').replace(/(at (?:position \d+|end of input)):[\s\S]*$/, '$1');
}

/**
 * A formula chip: KaTeX over its source. Its editor opens under it when the
 * `mathEdit` plugin says so (a click, or ⏎ with the chip selected): the TeX
 * between the dollars in a mono field that grows with its content, the chip
 * drawn again on every keystroke that parses and the error under the field
 * when one does not. ⏎ or a click outside writes the text once, Escape puts
 * the chip back as it was, an arrow at the field's end leaves to the side it
 * points to; ⇧⏎ breaks a line in display math. `$$` stays `$$`.
 */
class MathView implements NodeView {
  dom: HTMLElement;
  private node: PMNode;
  private editor: HTMLElement | null = null;
  private field: HTMLTextAreaElement | null = null;
  private err: HTMLElement | null = null;
  /** A press outside the chip and its editor closes the editor and writes. */
  private readonly outside = (e: MouseEvent) => {
    if (this.editor && !this.dom.contains(e.target as Node)) this.close(true, null);
  };

  constructor(node: PMNode, private readonly view: EditorView, private readonly getPos: () => number | undefined, decorations: readonly Decoration[]) {
    this.node = node;
    this.dom = document.createElement('span');
    this.dom.setAttribute('contenteditable', 'false');
    this.dom.dir = 'ltr';
    this.draw(node.attrs.raw as string);
    if (isMathEdit(decorations)) this.open();
  }

  /** The chip as its source says, the editor (if open) kept as the last child. */
  private draw(raw: string): void {
    const tmp = document.createElement('div');
    tmp.innerHTML = mathHTML(raw);
    const next = tmp.firstElementChild as HTMLElement;
    this.dom.className = `${next.className}${this.dom.classList.contains('selected') ? ' selected' : ''}${this.editor ? ' editing' : ''}`;
    this.dom.dataset.tex = next.dataset.tex ?? '';
    this.body(Array.from(next.childNodes));
  }

  /** Replace what the chip shows, leaving the editor in place. */
  private body(nodes: ChildNode[]): void {
    for (const child of Array.from(this.dom.childNodes)) if (child !== this.editor) child.remove();
    this.dom.prepend(...nodes);
  }

  private get display(): boolean {
    return (this.node.attrs.raw as string).startsWith('$$');
  }

  /** The chip drawn from `tex` as typed; TeX that does not parse leaves the chip and says why under the field. */
  private preview(tex: string): void {
    if (!this.err) return;
    try {
      const html = katex.renderToString(tex, { throwOnError: true, displayMode: this.display });
      const tmp = document.createElement('div');
      tmp.innerHTML = html;
      this.body(Array.from(tmp.childNodes));
      this.err.textContent = '';
    } catch (e) {
      this.err.textContent = texError(e);
    }
  }

  private grow(): void {
    const f = this.field;
    if (!f) return;
    f.style.height = 'auto';
    if (f.scrollHeight > 0) f.style.height = `${f.scrollHeight}px`;
  }

  /** Keep the editor inside the surface's width. */
  private place(): void {
    const ed = this.editor;
    if (!ed) return;
    ed.style.marginLeft = '';
    const r = ed.getBoundingClientRect();
    const s = this.view.dom.getBoundingClientRect();
    if (r.width === 0) return;
    if (r.right > s.right) ed.style.marginLeft = `${s.right - r.right}px`;
    else if (r.left < s.left) ed.style.marginLeft = `${s.left - r.left}px`;
  }

  open(): void {
    if (this.editor || !this.view.editable) return;
    const raw = this.node.attrs.raw as string;
    const editor = document.createElement('span');
    editor.className = 'math-edit';
    editor.setAttribute('contenteditable', 'false');
    const field = document.createElement('textarea');
    field.className = 'field';
    field.rows = 1;
    field.spellcheck = false;
    field.setAttribute('aria-label', 'formula');
    const tex = this.display ? raw.slice(2, -2) : raw.slice(1, -1);
    // a blank formula (`$$` then ⏎) opens empty
    field.value = tex.trim() ? tex : '';
    const err = document.createElement('span');
    err.className = 'err';
    editor.append(field, err);
    this.dom.append(editor);
    this.dom.classList.add('editing');
    this.editor = editor;
    this.field = field;
    this.err = err;
    field.addEventListener('input', () => { this.grow(); this.preview(field.value); });
    field.addEventListener('keydown', (e) => this.key(e));
    document.addEventListener('mousedown', this.outside, true);
    this.grow();
    this.place();
    field.focus();
    field.setSelectionRange(field.value.length, field.value.length);
  }

  private key(e: KeyboardEvent): void {
    const f = this.field;
    if (!f) return;
    const atStart = f.selectionStart === 0 && f.selectionEnd === 0;
    const atEnd = f.selectionStart === f.value.length && f.selectionEnd === f.value.length;
    let handled = true;
    if (e.key === 'Enter' && e.shiftKey) handled = !this.display; // a line break only where the span can hold one
    else if (e.key === 'Enter') this.close(true, 'after');
    else if (e.key === 'Escape') this.close(false, null);
    else if ((e.key === 'ArrowLeft' || e.key === 'ArrowUp') && atStart) this.close(true, 'before');
    else if ((e.key === 'ArrowRight' || e.key === 'ArrowDown') && atEnd) this.close(true, 'after');
    else handled = false;
    if (handled) {
      e.preventDefault();
      e.stopPropagation();
    }
  }

  /** Take the editor down without a transaction; the chip back as its source says. */
  private teardown(): string {
    const tex = this.field?.value ?? '';
    this.editor?.remove();
    this.editor = null;
    this.field = null;
    this.err = null;
    this.dom.classList.remove('editing');
    document.removeEventListener('mousedown', this.outside, true);
    return tex;
  }

  /**
   * Close the editor. With `commit`, the text is written in one transaction:
   * a span the format reads as math keeps the chip, an empty one removes it,
   * one it cannot read becomes plain text. The caret goes `before` or
   * `after` the chip when asked, and the surface takes the focus back.
   */
  private close(commit: boolean, caret: 'before' | 'after' | null): void {
    if (!this.editor) return;
    const tex = this.teardown();
    const was = this.node.attrs.raw as string;
    // a blank formula left with Escape goes, as one left empty does
    if (!commit && !(was.startsWith('$$') ? was.slice(2, -2) : was.slice(1, -1)).trim()) commit = true;
    const raw = was.startsWith('$$') ? `$$${tex}$$` : `$${tex}$`;
    const pos = this.getPos();
    if (pos === undefined) return;
    const { view } = this;
    const tr = view.state.tr.setMeta(mathEditKey, null);
    let end = pos + 1;
    if (commit && (raw !== was || !tex.trim())) {
      if (!tex.trim()) { tr.delete(pos, pos + 1); end = pos; }
      else if (mathSpanEnd(raw, 0) === raw.length) tr.setNodeMarkup(pos, undefined, { raw });
      else { tr.replaceWith(pos, pos + 1, schema.text(raw)); end = pos + raw.length; }
    } else this.draw(was);
    if (caret) tr.setSelection(TextSelection.create(tr.doc, caret === 'before' ? pos : end));
    view.dispatch(tr);
    if (caret) view.focus();
  }

  update(node: PMNode, decorations: readonly Decoration[]): boolean {
    if (node.type !== schema.nodes.math) return false;
    const changed = node.attrs.raw !== this.node.attrs.raw;
    this.node = node;
    if (changed) this.draw(node.attrs.raw as string);
    if (isMathEdit(decorations)) this.open();
    else if (this.editor) { this.teardown(); this.draw(node.attrs.raw as string); }
    return true;
  }

  selectNode(): void { this.dom.classList.add('selected'); }
  deselectNode(): void { this.dom.classList.remove('selected'); }
  stopEvent(e: Event): boolean { return !!this.editor && this.editor.contains(e.target as Node); }
  ignoreMutation(): boolean { return true; }
  destroy(): void { document.removeEventListener('mousedown', this.outside, true); }
}

/**
 * A list item: its marker drawn beside the text (a bullet, or the number
 * as written), a task's box before it, ticked or cleared on a click, the
 * text itself editable. The indentation sets how far in the item sits.
 */
class ListItemView implements NodeView {
  dom: HTMLElement;
  contentDOM: HTMLElement;
  private readonly mark: HTMLElement;
  private box: HTMLElement | null = null;

  constructor(node: PMNode, private readonly view: EditorView, private readonly getPos: () => number | undefined) {
    this.dom = document.createElement('div');
    this.mark = document.createElement('span');
    this.mark.setAttribute('contenteditable', 'false');
    this.contentDOM = document.createElement('div');
    this.contentDOM.className = 'li-text';
    this.dom.append(this.mark, this.contentDOM);
    this.render(node);
  }

  private render(node: PMNode): void {
    const marker = node.attrs.marker as string;
    const task = node.attrs.task as string | null;
    const n = markerNumber(marker);
    this.dom.className = 'dd-li';
    this.dom.dataset.marker = marker.trim();
    this.dom.style.setProperty('--indent', String(indentWidth(node.attrs.indent as string)));
    this.mark.className = `li-mark${n === null ? '' : ' num'}`;
    this.mark.textContent = n === null ? '•' : marker.trim();
    if (task === null) {
      this.box?.remove();
      this.box = null;
      return;
    }
    if (!this.box) {
      this.box = document.createElement('span');
      this.box.className = 'li-task';
      this.box.setAttribute('role', 'checkbox');
      this.box.setAttribute('contenteditable', 'false');
      this.box.addEventListener('mousedown', (e) => {
        e.preventDefault();
        const pos = this.getPos();
        if (pos !== undefined && this.view.editable) toggleTask(this.view.state, this.view.dispatch.bind(this.view), pos);
      });
      this.mark.after(this.box);
    }
    this.box.dataset.checked = task === ' ' ? '0' : '1';
    this.box.setAttribute('aria-checked', task === ' ' ? 'false' : 'true');
  }

  update(node: PMNode): boolean {
    if (node.type !== schema.nodes.list_item) return false;
    this.render(node);
    return true;
  }

  stopEvent(e: Event): boolean { return !!this.box && this.box.contains(e.target as Node); }
  ignoreMutation(m: MutationRecord | { type: 'selection'; target: Node }): boolean {
    return m.type !== 'selection' && !this.contentDOM.contains(m.target);
  }
}

/**
 * A raw block: a table or a rule drawn as that element, with its source
 * behind it for while the block is selected (a list, a quote, or code the
 * pair could not read stays here too); any other raw text (an HTML block,
 * a comment) as mono source, as before.
 */
class RawView implements NodeView {
  dom: HTMLElement;
  /** Drawn as an element, or kept as mono source; a change between the two makes a new view. */
  private readonly drawn: boolean;

  constructor(node: PMNode, decorations: readonly Decoration[] = []) {
    const text = node.attrs.text as string;
    this.drawn = rawHTML(text) !== null;
    this.dom = document.createElement(this.drawn ? 'div' : 'pre');
    this.dom.setAttribute('contenteditable', 'false');
    this.render(node, decorations);
  }

  render(node: PMNode, decorations: readonly Decoration[]): void {
    const text = node.attrs.text as string;
    const drawn = rawHTML(text);
    if (!drawn) {
      ownClasses(this.dom, 'raw');
      this.dom.textContent = text;
      markFinds(this.dom, atomFind(decorations));
      return;
    }
    ownClasses(this.dom, 'raw rendered');
    this.dom.dataset.kind = drawn.kind;
    this.dom.innerHTML = `<div class="raw-view">${drawn.html}</div><pre class="raw-src">${escapeHtml(text)}</pre>`;
    // the drawn table's cells are lit; the source shown on select is left as written
    markFinds(this.dom.querySelector('.raw-view')!, atomFind(decorations));
  }

  update(node: PMNode, decorations: readonly Decoration[]): boolean {
    if (node.type !== schema.nodes.raw || (rawHTML(node.attrs.text as string) !== null) !== this.drawn) return false;
    this.render(node, decorations);
    return true;
  }

  selectNode(): void { this.dom.classList.add('selected'); }
  deselectNode(): void { this.dom.classList.remove('selected'); }
  ignoreMutation(): boolean { return true; }
}


/**
 * Fenced code: the text edited in place, coloured by the plugin's
 * decorations; the language named in the corner, a click there (on an
 * editable page) opening the picker, which writes the word on the fence.
 */
class CodeView implements NodeView {
  dom: HTMLElement;
  contentDOM: HTMLElement;
  private readonly label: HTMLElement;
  private lang = '';

  constructor(node: PMNode, private readonly view: EditorView, private readonly getPos: () => number | undefined) {
    this.dom = document.createElement('pre');
    this.dom.className = 'dd-code';
    this.contentDOM = document.createElement('code');
    this.label = document.createElement('span');
    this.label.className = 'code-lang';
    this.label.setAttribute('contenteditable', 'false');
    this.label.setAttribute('role', 'button');
    this.label.addEventListener('mousedown', (e) => {
      e.preventDefault();
      e.stopPropagation();
      this.pick();
    });
    this.dom.append(this.contentDOM, this.label);
    this.render(node);
  }

  private render(node: PMNode): void {
    this.lang = langOf(node.attrs.fence as string);
    this.dom.dataset.lang = this.lang;
    this.contentDOM.className = this.lang ? `language-${this.lang}` : '';
    // the word drawn by CSS from the attribute, so the block's text stays the code
    this.label.dataset.label = this.lang || 'plain';
    this.label.dataset.empty = this.lang ? '0' : '1';
    this.label.title = this.view.editable ? 'language' : '';
  }

  private pick(): void {
    if (!this.view.editable) return;
    const cur = codeLang(this.lang);
    const set = (word: string) => {
      const pos = this.getPos();
      if (pos === undefined) return;
      setCodeLang(pos, word)(this.view.state, this.view.dispatch.bind(this.view));
      this.view.focus();
    };
    const items: PopItem[] = CODE_LANGS.map((l) => ({ label: l.label, on: cur === l.id, act: `lang-${l.id}`, run: () => { if (cur !== l.id) set(l.id); } }));
    items.push({ label: '-' }, { label: 'plain', on: !this.lang, act: 'lang-plain', run: () => set('') });
    popMenu(this.label.getBoundingClientRect(), items, 'code-langs');
  }

  update(node: PMNode): boolean {
    if (node.type !== schema.nodes.code_block) return false;
    this.render(node);
    return true;
  }

  stopEvent(e: Event): boolean { return this.label.contains(e.target as Node); }
  ignoreMutation(m: MutationRecord | { type: 'selection'; target: Node }): boolean {
    return !this.contentDOM.contains(m.target);
  }
}

const ALIGNS: [Align, string][] = [['left', 'align left'], ['center', 'align center'], ['right', 'align right']];

/**
 * A table edited as a table: the cells are the editor's own (text with the
 * live inline rules); a row and a column are added at the edges, and the
 * caret's cell has a menu (`···`, the table plugin's widget) for rows and
 * columns anywhere, their deletion, and the column's alignment.
 */
class TableView implements NodeView {
  dom: HTMLElement;
  contentDOM: HTMLElement;
  private readonly controls: HTMLElement[];
  private node: PMNode;

  constructor(node: PMNode, private readonly view: EditorView, private readonly getPos: () => number | undefined) {
    this.node = node;
    this.dom = document.createElement('div');
    this.dom.className = 'dd-table';
    const table = document.createElement('table');
    this.contentDOM = document.createElement('tbody');
    table.append(this.contentDOM);
    const button = (cls: string, title: string, run: () => void) => {
      const b = document.createElement('span');
      b.className = `tb-add ${cls}`;
      b.title = title;
      b.setAttribute('contenteditable', 'false');
      b.setAttribute('role', 'button');
      b.addEventListener('mousedown', (e) => { e.preventDefault(); e.stopPropagation(); run(); });
      return b;
    };
    const row = button('tb-add-row', 'add a row', () => this.run((pos) => addRow(pos, this.node.childCount)));
    const col = button('tb-add-col', 'add a column', () => this.run((pos) => addColumn(pos, this.node.firstChild!.childCount)));
    this.controls = [row, col];
    this.dom.append(table, row, col);
    // the caret's cell's `···`: a widget inside the cell, its press caught here
    this.dom.addEventListener('mousedown', (e) => {
      const more = (e.target as HTMLElement | null)?.closest<HTMLElement>('.tb-more');
      if (!more || !this.dom.contains(more)) return;
      e.preventDefault();
      e.stopPropagation();
      this.menu(more, Number(more.dataset.row), Number(more.dataset.col));
    });
  }

  private run(cmd: (pos: number) => (state: EditorState, dispatch?: (tr: Transaction) => void) => boolean): void {
    const pos = this.getPos();
    if (pos === undefined || !this.view.editable) return;
    cmd(pos)(this.view.state, this.view.dispatch.bind(this.view));
    this.view.focus();
  }

  private menu(anchor: HTMLElement, row: number, col: number): void {
    if (!this.view.editable) return;
    const align = (this.node.child(0).maybeChild(col)?.attrs.align as Align) ?? null;
    const items: PopItem[] = [
      { label: 'row above', glyph: '+', act: 'row-above', run: () => this.run((p) => addRow(p, row, col)) },
      { label: 'row below', glyph: '+', act: 'row-below', run: () => this.run((p) => addRow(p, row + 1, col)) },
      { label: 'column before', glyph: '+', act: 'col-before', run: () => this.run((p) => addColumn(p, col, row)) },
      { label: 'column after', glyph: '+', act: 'col-after', run: () => this.run((p) => addColumn(p, col + 1, row)) },
      { label: '-' },
      ...ALIGNS.map(([a, label]): PopItem => ({ label, on: align === a, act: `align-${a}`, run: () => this.run((p) => alignColumn(p, col, align === a ? null : a)) })),
      { label: '-' },
      { label: 'delete row', glyph: '⌫', danger: true, act: 'delete-row', run: () => this.run((p) => deleteRow(p, row)) },
      { label: 'delete column', glyph: '⌫', danger: true, act: 'delete-col', run: () => this.run((p) => deleteColumn(p, col)) },
    ];
    popMenu(anchor.getBoundingClientRect(), items, 'table-menu');
  }

  update(node: PMNode): boolean {
    if (node.type !== schema.nodes.table) return false;
    this.node = node;
    return true;
  }

  stopEvent(e: Event): boolean {
    const t = e.target as Node;
    return this.controls.some((c) => c.contains(t)) || !!(t as HTMLElement).closest?.('.tb-more');
  }
  ignoreMutation(m: MutationRecord | { type: 'selection'; target: Node }): boolean {
    return !this.contentDOM.contains(m.target);
  }
}

export const nodeViews = {
  card: (node: PMNode, _view: EditorView, _getPos: () => number | undefined, decorations: readonly Decoration[]) => new CardView(node, decorations),
  math: (node: PMNode, view: EditorView, getPos: () => number | undefined, decorations: readonly Decoration[]) => new MathView(node, view, getPos, decorations),
  raw: (node: PMNode, _view: EditorView, _getPos: () => number | undefined, decorations: readonly Decoration[]) => new RawView(node, decorations),
  list_item: (node: PMNode, view: EditorView, getPos: () => number | undefined) => new ListItemView(node, view, getPos),
  code_block: (node: PMNode, view: EditorView, getPos: () => number | undefined) => new CodeView(node, view, getPos),
  table: (node: PMNode, view: EditorView, getPos: () => number | undefined) => new TableView(node, view, getPos),
};

/** Where a ⌘-click on a link goes: the webview hands an outside address to the system. */
export function openLink(href: string): void {
  window.open(href, '_blank', 'noopener');
}

/** A click on a card selects it on any document, frozen too, so the inspector can edit it; a click on a chip selects it and opens its editor. */
export function handleClickOn(view: EditorView, _pos: number, node: PMNode, nodePos: number, _event: MouseEvent, direct: boolean): boolean {
  if (!direct) return false;
  if (node.type === schema.nodes.card) {
    view.dispatch(view.state.tr.setSelection(NodeSelection.create(view.state.doc, nodePos)));
    return true;
  }
  if (node.type !== schema.nodes.math || !view.editable) return false;
  view.dispatch(view.state.tr.setSelection(NodeSelection.create(view.state.doc, nodePos)).setMeta(mathEditKey, nodePos));
  return true;
}

/** ⌘-click on a link opens it; a plain click puts the caret, as anywhere. */
export function handleClick(_view: EditorView, _pos: number, event: MouseEvent): boolean {
  if (!event.metaKey && !event.ctrlKey) return false;
  const href = (event.target as HTMLElement | null)?.closest<HTMLElement>('.md-link')?.dataset.href;
  if (!href) return false;
  event.preventDefault();
  openLink(href);
  return true;
}

// ── the component ────────────────────────────────────────────────

interface Rule {
  top: number;
  height: number;
}

const plural = (n: number, word: string) => `${n} ${word}${n === 1 ? '' : 's'}`;

const inField = (t: EventTarget | null) => {
  const el = t as HTMLElement | null;
  const tag = el?.tagName?.toLowerCase();
  return tag === 'input' || tag === 'textarea' || !!el?.isContentEditable;
};

/** What a key asks of the reader: carve the selection out, make a card of it, or enrol the document. */
export type ReaderAction = 'extract' | 'card' | 'enrol';

type Keys = Pick<KeyboardEvent, 'key' | 'metaKey' | 'ctrlKey' | 'altKey' | 'shiftKey'>;

/**
 * The reader's keys. Bare `e`, `m`, `r` act only where the text is not
 * being edited (a frozen page, or the surface not focused); in editable
 * text they type. ⌘⇧E and ⌘⇧M act anywhere (with a selection, which the
 * caller checks). No ⌥-letter keys: on a Mac keyboard they are dead keys.
 */
export function readerAction(e: Keys, editing: boolean): ReaderAction | null {
  const k = e.key.toLowerCase();
  if ((e.metaKey || e.ctrlKey) && e.shiftKey && !e.altKey) return k === 'e' ? 'extract' : k === 'm' ? 'card' : null;
  if (editing || e.metaKey || e.ctrlKey || e.altKey || e.shiftKey) return null;
  return e.key === 'e' ? 'extract' : e.key === 'm' ? 'card' : e.key === 'r' ? 'enrol' : null;
}

/** The link field: what it acts on, the address as typed, where it sits. */
interface LinkField {
  target: LinkTarget;
  value: string;
  at: { left: number; top: number; bottom: number };
}

/** The toolbar's formatting buttons: letters, each with its key in the tooltip. */
const FORMATS: [InlineToggle, string, string][] = [['strong', 'b', '⌘B'], ['em', 'i', '⌘I'], ['code', 'code', '⌘E']];

/**
 * Where a selection sits: from its first line's top to its last line's
 * bottom, starting where its first line starts. `getBoundingClientRect`
 * on the range can take in a line box the selection only touches (an
 * empty rect at a text node's end), which put the toolbar over the text.
 */
export function selectionBox(range: Range): DOMRect {
  const rects = Array.from(range.getClientRects()).filter((r) => r.width > 0 && r.height > 0);
  if (!rects.length) return range.getBoundingClientRect();
  const top = Math.min(...rects.map((r) => r.top));
  const bottom = Math.max(...rects.map((r) => r.bottom));
  const first = rects.find((r) => r.top === top) ?? rects[0]!;
  const right = Math.max(...rects.map((r) => r.right));
  return new DOMRect(first.left, top, right - first.left, bottom - top);
}

/** The slash menu as drawn: its state, its rows, and where its `/` is on screen. */
interface SlashUi {
  state: SlashState;
  items: SlashItem[];
  at: { left: number; top: number; bottom: number };
}

/** The find bar's replace row: shown or not, and what replaces. */
interface FindUi {
  replace: boolean;
  with: string;
}

/** The image files on a clipboard. */
function pastedImages(data: DataTransfer | null): File[] {
  if (!data) return [];
  const out: File[] = [];
  for (const item of Array.from(data.items ?? [])) {
    if (item.kind !== 'file' || !item.type.startsWith('image/')) continue;
    const f = item.getAsFile();
    if (f) out.push(f);
  }
  if (!out.length) for (const f of Array.from(data.files ?? [])) if (f.type.startsWith('image/')) out.push(f);
  return out;
}

/** How tall the slash menu may grow; nearer the bottom than this it opens above its `/`. */
const SLASH_ROOM = 320;

/** Room the toolbar wants above a selection; nearer the top it sits below. */
const CUE_ROOM = 56;

/** The selection, as a passage plus where it ends and where it sits on screen. */
interface Sel extends Passage {
  end: number;
  rect: DOMRect;
}

/** An open composer: what it starts with, the block its card goes after, and where it sits. */
interface Compose {
  seed: string;
  index: number | null;
  rect: DOMRect | null;
}

const sameSel = (a: Sel | null, b: Sel | null): boolean =>
  a === b || (!!a && !!b && a.text === b.text && a.end === b.end && a.rect.top === b.rect.top && a.rect.left === b.rect.left && a.rect.bottom === b.rect.bottom);

const words = (blocks: Block[]) =>
  blocks.reduce((n, b) => (b.kind === 'card' ? n : n + b.text.split(/\s+/).filter(Boolean).length), 0);

/** Where the document sits: its folders, and its parent when it is an extract. */
export function crumbOf(path: string, docs: Record<string, DocInfo>): string {
  const dir = dirOf(path);
  if (!dir) return '';
  const parts: string[] = [];
  let at = '';
  for (const seg of dir.split('/')) {
    at = at ? `${at}/${seg}` : seg;
    parts.push(docs[`${at}.md`] ? titleOf(`${at}.md`, docs, null) : nameOf(at));
  }
  return parts.join('  /  ');
}

/** Where the card at child `index` is, or the card with `id` when that one has moved; null when neither is there. */
function cardPos(doc: PMNode, at: { index: number; id?: string }): number | null {
  let byId: number | null = null;
  let off = 0;
  for (let i = 0; i < doc.childCount; i++) {
    const node = doc.child(i);
    const here = off;
    off += node.nodeSize;
    if (node.type !== schema.nodes.card) continue;
    const id = (node.attrs.card as Card).id;
    if (i === at.index && (at.id === undefined || id === at.id)) return here;
    if (at.id !== undefined && id === at.id && byId === null) byId = here;
  }
  return byId;
}

/** Keep the caret where it was, as far as the new document allows. */
function withSelectionOf(prev: EditorState | null, state: EditorState): EditorState {
  if (!prev) return state;
  const head = Math.min(prev.selection.head, state.doc.content.size);
  return state.apply(state.tr.setSelection(Selection.near(state.doc.resolve(head))));
}

interface ReaderProps {
  id: string;
  /** In the active pane: keys that need no selection (`r`) reach this document. */
  active?: boolean;
  /** Set when this is the text of a document with pages: the meta row offers the pages back. */
  onPages?: () => void;
}

export function Reader({ id, active = true, onPages }: ReaderProps) {
  const docs = useApp((s) => s.docs);
  const root = useApp((s) => s.vault);
  const info = docs[id];
  const reveal = useApp((s) => s.reveal);
  const [status, setStatus] = useState<'loading' | 'ok' | 'gone'>('loading');
  const [rule, setRule] = useState<Rule | null>(null);
  const [blocks, setBlocks] = useState<Block[]>([]);
  const wrapRef = useRef<HTMLDivElement>(null);
  const mountRef = useRef<HTMLDivElement>(null);
  const viewRef = useRef<EditorView | null>(null);
  const writerRef = useRef<Writer | null>(null);
  const frozenRef = useRef(false);
  const dragRef = useRef(false);
  frozenRef.current = info?.frozen ?? false;
  const [sel, setSel] = useState<Sel | null>(null);
  const [composer, setComposer] = useState<Compose | null>(null);
  const [link, setLinkField] = useState<LinkField | null>(null);
  const [slash, setSlash] = useState<SlashUi | null>(null);
  const [find, setFind] = useState<FindState | null>(null);
  const [findUi, setFindUi] = useState<FindUi>({ replace: false, with: '' });
  const findRef = useRef<HTMLInputElement>(null);
  const rootRef = useRef<HTMLDivElement>(null);
  const landRef = useRef<(files: ImageFile[], at?: { x: number; y: number }) => void>(() => {});
  const askImageRef = useRef<() => void>(() => {});
  const openLinkRef = useRef<(target: LinkTarget) => void>(() => {});
  const selRef = useRef<Sel | null>(null);
  selRef.current = sel;
  const composerRef = useRef<Compose | null>(null);
  composerRef.current = composer;
  // extracts come out of notes, sources, and extracts; drafts only make cards
  const canExtract = info?.type === 'note' || info?.type === 'source' || info?.type === 'extract';
  const canExtractRef = useRef(false);
  canExtractRef.current = canExtract;
  // a note revisited has no marker: each pass starts at the top, or at a heading picked here
  const isNote = info?.type === 'note';
  const actRef = useRef<(action: ReaderAction) => boolean>(() => false);
  const activeRef = useRef(active);
  activeRef.current = active;
  const readingRef = useRef(false);
  readingRef.current = !!info?.read;

  /** The inspector edits the card node that is selected here. */
  const publishSelection = (state: EditorState) => {
    const sel = state.selection;
    const idx = sel instanceof NodeSelection && sel.node.type === schema.nodes.card ? state.doc.resolve(sel.from).index() : null;
    const cur = useApp.getState().selectedCard;
    if (idx === null ? cur !== null && cur.path === id : cur?.path !== id || cur.index !== idx) {
      useApp.setState({ selectedCard: idx === null ? null : { path: id, index: idx } });
    }
  };

  // ── the plugins' block hooks, after the surface is drawn ──
  const plugins = usePlugins();
  const hookFrame = useRef<number | null>(null);
  const hookBlocks = useCallback(() => {
    if (hookFrame.current !== null) return;
    hookFrame.current = requestAnimationFrame(() => {
      hookFrame.current = null;
      const view = viewRef.current;
      if (!view || !wantsBlocks()) return;
      // a hook's change to a block's DOM must not reach ProseMirror's observer,
      // which would mark the block dirty and draw it again without the change
      const observer = (view as unknown as { domObserver?: { stop(): void; start(): void } }).domObserver;
      observer?.stop();
      try {
        view.state.doc.forEach((_node, off, i) => {
          const el = view.nodeDOM(off) as HTMLElement | null;
          if (el) runBlockHooks(el, { path: id, block: i, where: 'reader' });
        });
      } finally {
        observer?.start();
      }
    });
  }, [id]);
  useEffect(() => { hookBlocks(); }, [plugins?.version, hookBlocks]);
  useEffect(() => () => {
    // StrictMode mounts twice: the frame is cancelled and the slot freed, so the next build schedules a new one
    if (hookFrame.current !== null) cancelAnimationFrame(hookFrame.current);
    hookFrame.current = null;
  }, []);

  // ── the marker's geometry, from the blocks' boxes ──
  const measure = useCallback(() => {
    const view = viewRef.current;
    const wrap = wrapRef.current;
    const pos = view ? markerPos(view.state) : null;
    if (!view || !wrap || pos === null) { setRule(null); return; }
    const doc = view.state.doc;
    const first = view.nodeDOM(0) as HTMLElement | null;
    if (!first) { setRule(null); return; }
    const wr = wrap.getBoundingClientRect();
    const fr = first.getBoundingClientRect();
    // the pos-th prose block, or, inside a folded section, the folded heading above it (fold.ts)
    const idx = ruleEndIndex(view.state, pos);
    if (idx < 0) { setRule({ top: fr.top - wr.top, height: 0 }); return; }
    let at = 0;
    for (let i = 0; i < idx; i++) at += doc.child(i).nodeSize;
    const boundary = view.nodeDOM(at) as HTMLElement | null;
    if (!boundary) { setRule(null); return; }
    const br = boundary.getBoundingClientRect();
    setRule({ top: fr.top - wr.top, height: Math.max(0, br.bottom - fr.top) });
  }, []);

  // ── the slash menu and the find bar follow their plugins' state ──
  const followSlash = (view: EditorView, state: EditorState) => {
    const s = slashKey.getState(state) ?? null;
    if (!s) { setSlash((cur) => (cur ? null : cur)); return; }
    const items = slashItems(s.query, slashContext(state));
    let at = { left: 0, top: 0, bottom: 0 };
    try { const c = view.coordsAtPos(s.from); at = { left: c.left, top: c.top, bottom: c.bottom }; } catch { /* not drawn yet */ }
    setSlash({ state: s, items, at });
  };
  const findWas = useRef<FindState | null>(null);
  const followFind = (view: EditorView, state: EditorState) => {
    const f = findKey.getState(state);
    const next = f?.open ? f : null;
    const cur = findWas.current;
    if (cur === next) return;
    findWas.current = next;
    setFind(next);
    if (next && next.index >= 0 && (cur?.index !== next.index || cur?.query !== next.query)) {
      // the current match brought into view once it is drawn (a timer: WebKit holds frames back in a covered window)
      // the innermost current: a lit cell inside a table rather than the table
      setTimeout(() => { const all = view.dom.querySelectorAll('.find-current'); all[all.length - 1]?.scrollIntoView({ block: 'center' }); }, 0);
    }
  };

  // ── the editor over the file, following the vault ──
  useEffect(() => {
    const vault = currentVault();
    const mount = mountRef.current;
    if (!vault || !mount) return;
    const writer = new Writer(vault, id);
    writerRef.current = writer;
    let live = true;
    // the images the text names, from the vault as blob URLs, let go with the view
    const images = imageLoader(vault, id, () => useApp.getState().remoteImages);

    const build = (loaded: Loaded) => {
      const m = meta(loaded.doc);
      // the folds the page had when it was last seen (view state, never the file's)
      const state = makeState(loaded.doc.blocks, { frozen: () => frozenRef.current, pos: m.type === 'note' ? null : m.read?.pos ?? null, images: images.load, folds: useApp.getState().folds[id] ?? [] });
      const view = viewRef.current;
      if (view) {
        // an open find bar stays open over the new text
        const was = findKey.getState(view.state);
        let next = withSelectionOf(view.state, state);
        if (was?.open) next = next.apply(next.tr.setMeta(findKey, { query: was.query, from: next.selection.from } satisfies FindMeta));
        view.updateState(next);
        followSlash(view, next);
        followFind(view, next);
      } else {
        viewRef.current = new EditorView(mount, {
          state,
          nodeViews,
          editable: () => !frozenRef.current,
          attributes: { class: 'draft-doc', spellcheck: 'true' },
          dispatchTransaction(this: EditorView, tr: Transaction) {
            const prev = this.state;
            const next = this.state.apply(tr);
            this.updateState(next);
            // a fold made or opened, or a folded heading's text changed: remembered by key
            const fp = foldKey.getState(prev);
            const fn = foldKey.getState(next);
            if (fp !== fn && (fp?.folded.length || fn?.folded.length)) {
              setFolds(id, foldedKeys(next));
              measure();
              // and again once the page has laid out without the hidden blocks (a timer: WebKit holds frames back when covered)
              setTimeout(measure, 0);
            }
            if (tr.docChanged) {
              writer.version++;
              writer.schedule(() => fromDoc(this.state.doc));
            }
            if (tr.docChanged || tr.getMeta(markerKey) !== undefined) measure();
            if (tr.docChanged) hookBlocks();
            if (tr.selectionSet || tr.docChanged) publishSelection(next);
            followSlash(this, next);
            followFind(this, next);
            if (tr.getMeta(askImageKey)) askImageRef.current();
          },
          handleClickOn,
          handleClick,
          handleKeyDown(view, event) {
            // the slash menu's own Esc leaves the `/`; the plugin has it
            if (event.key === 'Escape' && slashKey.getState(view.state)) return false;
            if (event.key === 'Escape') {
              view.dom.blur();
              return true;
            }
            // ⌘K over a selection or in a link: the address field; with a bare caret it is the palette's
            if (view.editable && pressed(event, { code: 'KeyK', mod: true })) {
              const target = linkTarget(view.state);
              if (target) { openLinkRef.current(target); return true; }
              return false;
            }
            // the surface has focus: bare letters type unless the page is frozen
            const action = readerAction(event, view.editable);
            if (action && actRef.current(action)) {
              event.preventDefault();
              return true;
            }
            return false;
          },
          handlePaste(view, event) {
            // images on the clipboard (and no text beside them but their own address) land beside the note
            const files = pastedImages(event.clipboardData);
            if (!files.length || !view.editable || !htmlPasteImages(event.clipboardData?.getData('text/html') ?? '', event.clipboardData?.getData('text/plain') ?? '')) return false;
            event.preventDefault();
            void Promise.all(files.map(async (f) => ({ bytes: new Uint8Array(await f.arrayBuffer()), type: f.type, name: f.name }))).then((got) => landRef.current(got));
            return true;
          },
          handleDrop(view, event, _slice, moved) {
            if (moved || !view.editable) return false;
            const files = Array.from(event.dataTransfer?.files ?? []).filter((f) => f.type.startsWith('image/'));
            if (!files.length) return false;
            event.preventDefault();
            const at = { x: event.clientX, y: event.clientY };
            void Promise.all(files.map(async (f) => ({ bytes: new Uint8Array(await f.arrayBuffer()), type: f.type, name: f.name }))).then((got) => landRef.current(got, at));
            return true;
          },
          handleDOMEvents: {
            blur: () => { writer.flush(); return false; },
          },
        });
        // an image dropped from the Finder over this page comes through the window's drop router
        const dom = viewRef.current.dom;
        pageDrops.set(dom, (paths, x, y) => {
          void Promise.all(paths.map(readImagePath)).then((got) => landRef.current(got, { x, y }), (e: unknown) => console.error(e));
        });
      }
      setBlocks(loaded.doc.blocks);
      measure();
      hookBlocks();
      if (viewRef.current) publishSelection(viewRef.current.state);
    };

    const onDoc = (loaded: Loaded) => {
      const view = viewRef.current;
      if (!view) { build(loaded); return; }
      const version = writer.claim(loaded.text);
      if (version === undefined) {
        // someone else changed the file: it wins over anything unwritten
        writer.cancel();
        build(loaded);
        return;
      }
      // our own write, read back. If nothing was typed since and the file
      // says something other than what the editor holds (a line that became
      // a card, a heading), the file is right.
      if (version === writer.version && !blocksEqual(fromDoc(view.state.doc), loaded.doc.blocks)) build(loaded);
      else setBlocks(loaded.doc.blocks);
    };

    vault.read(id).then(
      (loaded) => { if (live) { build(loaded); setStatus('ok'); } },
      () => { if (live) setStatus('gone'); },
    );
    const off = vault.subscribe((ev) => {
      if (!live) return;
      if (ev.kind === 'doc' && ev.path === id) onDoc(ev.loaded);
      else if (ev.kind === 'gone' && ev.path === id) {
        writer.cancel();
        if (viewRef.current) pageDrops.delete(viewRef.current.dom);
        viewRef.current?.destroy();
        viewRef.current = null;
        setStatus('gone');
      }
    });
    return () => {
      live = false;
      off();
      writer.flush();
      if (viewRef.current) pageDrops.delete(viewRef.current.dom);
      viewRef.current?.destroy();
      viewRef.current = null;
      writerRef.current = null;
      images.release();
      if (useApp.getState().selectedCard?.path === id) useApp.setState({ selectedCard: null });
    };
  }, [id, measure, hookBlocks]);

  // frozen or thawed: the view re-reads `editable`, and the decorations are drawn again
  useEffect(() => {
    const view = viewRef.current;
    if (!view) return;
    view.setProps({ editable: () => !frozenRef.current });
    view.dispatch(view.state.tr.setMeta(frozenKey, frozenRef.current));
  }, [info?.frozen]);

  // the remote-images tweak flipped: forget what was resolved and look again
  const remoteImages = useApp((s) => s.remoteImages);
  const remoteWas = useRef(remoteImages);
  useEffect(() => {
    if (remoteWas.current === remoteImages) return;
    remoteWas.current = remoteImages;
    const view = viewRef.current;
    if (view) view.dispatch(view.state.tr.setMeta(imagesKey, 'reset'));
  }, [remoteImages]);

  // a card opened from the palette or a query: once the document is built,
  // its node is selected (the inspector follows) and scrolled to; a card
  // that is gone is let go
  useEffect(() => {
    const view = viewRef.current;
    if (!reveal || reveal.path !== id || status !== 'ok' || !view) return;
    const pos = cardPos(view.state.doc, reveal);
    if (pos !== null) {
      view.dispatch(view.state.tr.setSelection(NodeSelection.create(view.state.doc, pos)));
      const dom = view.nodeDOM(pos) as HTMLElement | null;
      dom?.scrollIntoView({ block: 'center' });
      // marked where it landed (go to source, the palette): a quiet fill that fades, the selection kept
      if (dom) {
        dom.classList.add('landed');
        setTimeout(() => dom.classList.remove('landed'), 2400);
      }
    }
    useApp.setState({ reveal: null });
  }, [reveal, status, id]);

  // ── the selection: a passage to extract or make a card from ──
  // Read from the DOM, not the editor state, because a frozen document's
  // surface is not editable and never focused, yet its text still selects.
  useEffect(() => {
    const capture = () => {
      const view = viewRef.current;
      if (!view || composerRef.current) return;
      let next: Sel | null = null;
      const s = window.getSelection();
      if (s && s.rangeCount > 0 && !s.isCollapsed) {
        const range = s.getRangeAt(0);
        if (view.dom.contains(range.commonAncestorContainer)) {
          try {
            const a = view.posAtDOM(range.startContainer, range.startOffset);
            const b = view.posAtDOM(range.endContainer, range.endOffset);
            const p = passage(view.state.doc, Math.min(a, b), Math.max(a, b));
            if (p.text) next = { ...p, end: Math.max(a, b), rect: selectionBox(range) };
          } catch { /* not in the document */ }
        }
      }
      setSel((cur) => (sameSel(cur, next) ? cur : next));
    };
    // measured once the editor has handled the same event (its listener comes after this one, and
    // redraws the markers the selection reveals, which move the text). A timer, not a frame: WebKit
    // holds animation frames back in a window that is covered or not on screen.
    let timer: ReturnType<typeof setTimeout> | null = null;
    const later = () => {
      if (timer !== null) clearTimeout(timer);
      timer = setTimeout(() => { timer = null; capture(); }, 0);
    };
    document.addEventListener('selectionchange', later);
    return () => {
      document.removeEventListener('selectionchange', later);
      if (timer !== null) clearTimeout(timer);
    };
  }, []);

  // the selection as plugins see it: the block it ends in gives the sentence around it
  const plugSel = useMemo((): PluginSelection | null => {
    const view = viewRef.current;
    if (!sel || !view || composer) return null;
    const block = blockAt(view.state.doc, sel.end);
    const node = view.state.doc.maybeChild(block);
    return toPluginSelection({ path: id, text: sel.text, rect: sel.rect, block, blockText: node?.textContent ?? '' });
  }, [sel, composer, id]);
  useEffect(() => {
    publishPluginSelection(plugSel);
    return () => publishPluginSelection(null);
  }, [plugSel]);
  // a plugin's verb run from its key puts the cue away, as a click on the verb does
  useEffect(() => onPluginAction(() => setSel(null)), []);

  const openComposer = () => {
    const view = viewRef.current;
    const s = selRef.current;
    if (!view || !s) return;
    setComposer({ seed: s.text, index: blockAt(view.state.doc, s.end), rect: s.rect });
    setSel(null);
  };

  const doExtract = () => {
    const s = selRef.current;
    const writer = writerRef.current;
    if (!s || !writer || !canExtractRef.current) return;
    setSel(null);
    window.getSelection()?.removeAllRanges();
    writer.run(() => extractNode(id, { text: s.text, blocks: s.blocks })).catch(console.error);
  };

  // ── formatting from the toolbar, and the link field ──
  const format = (kind: InlineToggle) => {
    const view = viewRef.current;
    if (!view || !view.editable) return;
    toggleInline(kind)(view.state, view.dispatch);
    view.focus();
  };
  openLinkRef.current = (target) => {
    const view = viewRef.current;
    if (!view) return;
    const c = view.coordsAtPos(target.from);
    setSel(null);
    setLinkField({ target, value: target.href ?? '', at: { left: c.left, top: c.top, bottom: c.bottom } });
  };
  const linkFromCue = () => {
    const view = viewRef.current;
    const target = view ? linkTarget(view.state) : null;
    if (target) openLinkRef.current(target);
  };
  const closeLink = (write: boolean) => {
    const view = viewRef.current;
    const l = link;
    setLinkField(null);
    if (!view || !l) return;
    if (write) {
      const tr = setLink(view.state, l.target, l.value);
      if (tr) view.dispatch(tr.scrollIntoView());
    }
    view.focus();
  };

  // ── images put in: pasted, dropped, or picked from the slash menu ──
  landRef.current = (files, at) => {
    const vault = currentVault();
    const view = viewRef.current;
    if (!vault || !view || !view.editable || !files.length) return;
    void (async () => {
      const srcs: string[] = [];
      for (const f of files) {
        try { srcs.push(await vault.addImage(id, f.bytes, f.type, f.name)); } catch (e) { console.error(e); }
      }
      const v = viewRef.current;
      if (!srcs.length || !v) return;
      let state = v.state;
      if (at) {
        const hit = v.posAtCoords({ left: at.x, top: at.y });
        if (hit) state = state.apply(state.tr.setSelection(Selection.near(state.doc.resolve(hit.pos))));
      }
      const tr = insertImages(state, srcs);
      // the drop's caret and the images in one step, onto the state the view holds
      const out = v.state.tr;
      if (at) out.setSelection(Selection.fromJSON(out.doc, state.selection.toJSON()));
      for (const step of tr.steps) out.step(step);
      out.setSelection(Selection.fromJSON(out.doc, tr.selection.toJSON()));
      v.dispatch(out.scrollIntoView());
      v.focus();
    })();
  };
  askImageRef.current = () => {
    void imagePicker.pick().then(
      (paths) => Promise.all(paths.map(readImagePath)).then((got) => landRef.current(got)),
      (e: unknown) => console.error(e),
    );
  };
  const pickRow = (item: SlashItem) => {
    const view = viewRef.current;
    if (!view) return;
    pickSlash(item, { openMath: (tr, pos) => tr.setMeta(mathEditKey, pos) })(view.state, view.dispatch);
    view.focus();
  };

  const findMeta = (meta: FindMeta) => {
    const view = viewRef.current;
    if (view) view.dispatch(view.state.tr.setMeta(findKey, meta));
  };
  const openFind = (replace: boolean) => {
    const view = viewRef.current;
    if (!view) return;
    const cur = findKey.getState(view.state);
    // a selection within a line seeds the field, as a browser's find does
    const { from, to, $from } = view.state.selection;
    const seed = from < to && $from.sameParent(view.state.doc.resolve(to)) ? view.state.doc.textBetween(from, to) : null;
    if (!cur?.open || seed) findMeta({ query: seed ?? cur?.query ?? '', from });
    setFindUi((u) => ({ ...u, replace: replace && view.editable ? true : u.replace && view.editable }));
    setTimeout(() => { findRef.current?.focus(); findRef.current?.select(); }, 0);
  };
  const closeFind = () => {
    const view = viewRef.current;
    if (!view) return;
    if (view.editable) {
      view.dispatch(closeAtMatch(view.state));
      view.focus();
    } else findMeta('close');
    setFindUi((u) => ({ ...u, replace: false }));
  };
  const replaceOne = () => {
    const view = viewRef.current;
    if (!view?.editable) return;
    const tr = replaceMatch(view.state, findUi.with);
    if (tr) view.dispatch(tr);
  };
  const replaceEvery = () => {
    const view = viewRef.current;
    if (!view?.editable) return;
    const r = replaceAll(view.state, findUi.with);
    if (r) view.dispatch(r.tr);
  };
  const findRefs = useRef({ openFind, closeFind });
  findRefs.current = { openFind, closeFind };

  const startReading = () => { if (canExtractRef.current && !readingRef.current) enrolReading(id).catch(console.error); };

  actRef.current = (action) => {
    if (composerRef.current) return false;
    if (action === 'enrol') {
      if (!activeRef.current || !canExtractRef.current || readingRef.current) return false;
      startReading();
      return true;
    }
    if (!selRef.current) return false;
    if (action === 'extract' && canExtractRef.current) { doExtract(); return true; }
    if (action === 'card') { openComposer(); return true; }
    return false;
  };

  // the keys when the surface is not focused (a frozen document, or the page not clicked into);
  // a focused surface has them through `handleKeyDown`
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      // ⌘F find, ⌥⌘F replace, ⌘G / ⇧⌘G the next and the one before: in the active page, from the page or its bar or nothing focused
      const t = e.target as Node | null;
      const mine = !inField(e.target) || (!!t && !!rootRef.current?.contains(t));
      if (activeRef.current && mine && viewRef.current) {
        if (pressed(e, { code: 'KeyF', mod: true }) || pressed(e, { code: 'KeyF', mod: true, alt: true })) {
          e.preventDefault();
          findRefs.current.openFind(e.altKey);
          return;
        }
        const g = pressed(e, { code: 'KeyG', mod: true }) ? 1 : pressed(e, { code: 'KeyG', mod: true, shift: true }) ? -1 : 0;
        if (g && findKey.getState(viewRef.current.state)?.open) {
          e.preventDefault();
          viewRef.current.dispatch(viewRef.current.state.tr.setMeta(findKey, { step: g } satisfies FindMeta));
          return;
        }
      }
      if (inField(e.target)) return;
      const action = readerAction(e, false);
      if (action && actRef.current(action)) e.preventDefault();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);

  const saveCard = (text: string, again: boolean, pri?: number) => {
    const view = viewRef.current;
    const c = composerRef.current;
    const writer = writerRef.current;
    if (!view || !c || !writer) return;
    const card: Card = { kind: 'card', text };
    if (pri !== undefined) card.sched = { pri };
    view.dispatch(insertCard(view.state, card, c.index));
    writer.flush();
    setComposer(again ? { ...c, index: c.index === null ? null : c.index + 1 } : null);
  };

  // the marker follows the text as it reflows
  useLayoutEffect(() => {
    const wrap = wrapRef.current;
    if (!wrap) return;
    const ro = new ResizeObserver(() => measure());
    ro.observe(wrap);
    void document.fonts?.ready.then(measure);
    return () => ro.disconnect();
  }, [measure]);

  // ── the gutter: click or drag to set how far you have read ──
  const setFromY = (clientY: number) => {
    const view = viewRef.current;
    if (!view) return;
    const doc = view.state.doc;
    const bands: Band[] = [];
    let at = 0;
    // a folded section's blocks take its heading's band: a press on the folded heading reads the whole section
    let shown: Band | null = null;
    doc.forEach((node) => {
      const el = view.nodeDOM(at) as HTMLElement | null;
      at += node.nodeSize;
      if (!el) return;
      const hidden = el.classList.contains('fold-hidden');
      if (!hidden) { const r = el.getBoundingClientRect(); shown = { top: r.top, height: r.height }; }
      if (node.type.name === 'card') return;
      if (hidden && shown) bands.push(shown);
      else if (!hidden) bands.push(shown!);
    });
    const pos = pickPos(bands, clientY);
    if (pos !== markerPos(view.state)) view.dispatch(view.state.tr.setMeta(markerKey, pos));
  };
  const gutterDown = (e: React.PointerEvent<HTMLDivElement>) => {
    dragRef.current = true;
    e.currentTarget.setPointerCapture(e.pointerId);
    setFromY(e.clientY);
  };
  const gutterMove = (e: React.PointerEvent<HTMLDivElement>) => { if (dragRef.current) setFromY(e.clientY); };
  const gutterUp = (e: React.PointerEvent<HTMLDivElement>) => {
    dragRef.current = false;
    try { e.currentTarget.releasePointerCapture(e.pointerId); } catch { /* already released */ }
    const view = viewRef.current;
    const pos = view ? markerPos(view.state) : null;
    if (pos !== null) void writerRef.current?.update((doc) => setReadPos(doc, pos));
  };

  // a revisited note's pass: from the top, or from a heading the user picks; nothing is written
  const headings = useMemo(() => {
    // `index` counts headings of every level, as the surface has them
    const out: { index: number; level: number; text: string }[] = [];
    let n = 0;
    for (const b of blocks) {
      if (b.kind !== 'heading') continue;
      if (b.level <= 3) out.push({ index: n, level: b.level, text: b.text });
      n++;
    }
    return out;
  }, [blocks]);
  const fromHeading = (index: number): boolean => {
    const view = viewRef.current;
    if (!view) return false;
    if (index < 0) { wrapRef.current?.closest('.pane-body, .nb-page')?.scrollTo({ top: 0 }); return true; }
    let n = 0;
    let at: number | null = null;
    view.state.doc.forEach((node, off) => {
      if (node.type !== schema.nodes.heading) return;
      if (n++ === index && at === null) at = off;
    });
    if (at === null) return false;
    // a heading inside a folded section: the folds around it open first
    const hiding = foldsHiding(view.state, at).map((f) => f.pos);
    if (hiding.length) view.dispatch(view.state.tr.setMeta(foldKey, { open: hiding } satisfies FoldMeta));
    (view.nodeDOM(at) as HTMLElement | null)?.scrollIntoView({ block: 'start' });
    return true;
  };
  const fromHeadingRef = useRef(fromHeading);
  fromHeadingRef.current = fromHeading;
  // the outline's click (the rail's, the inspector's) comes here
  useEffect(() => registerHeadings(id, (i) => fromHeadingRef.current(i), () => activeRef.current), [id]);

  const toggleFrozen = () => {
    const next = !frozenRef.current;
    void writerRef.current?.update((doc) => setField(doc, 'frozen', next));
  };

  // a draft's row: where it is in spaced composition, and done / reopen
  const w = info?.type === 'draft' ? info.write : undefined;
  const writeState = w
    ? w.done ? 'done' : `${w.reps ? `pass ${w.reps + 1}` : 'first pass'}, ${dueLabel(w.due, new Date())}`
    : '';
  const toggleDone = () => {
    if (!w) return;
    const action = w.done ? 'on' : 'done';
    void writerRef.current?.update((doc) => { advanceWrite(doc, action, new Date()); });
  };

  if (status === 'gone' || (status === 'ok' && !info)) {
    return <div className="reader-wrap"><div className="reader"><div className="empty">no longer in the collection</div></div></div>;
  }

  // the marker is a source's or an extract's; a revisited note is read from the top or a heading
  const enrolled = !!info?.read;
  const reading = enrolled && !isNote;
  const frozen = info?.frozen ?? false;
  const cards = info?.cards ?? 0;
  const due = info?.due ?? 0;
  const counts = cards ? `${plural(cards, 'card')}${due ? `, ${due} due` : ''}` : '';
  const right = info?.type === 'draft' ? [plural(words(blocks), 'word'), counts].filter(Boolean).join(', ') : counts;

  return (
    <div className="reader-wrap" ref={rootRef}>
      <div className={`reader doc-view${reading ? ' reading' : ''}`}>
        {find && (
          <div className="find-bar">
            <input
              ref={findRef}
              className="fb-q"
              dir="auto"
              aria-label="find"
              placeholder="find"
              spellCheck={false}
              value={find.query}
              onChange={(e) => findMeta({ query: e.target.value, from: viewRef.current?.state.selection.from ?? 0 })}
              onKeyDown={(e) => {
                if (e.key === 'Enter') { e.preventDefault(); findMeta({ step: e.shiftKey ? -1 : 1 }); }
                else if (e.key === 'Escape') { e.preventDefault(); e.stopPropagation(); closeFind(); }
              }}
            />
            <span className="fb-n">{find.matches.length ? `${find.index + 1}/${find.matches.length}` : find.query.trim() ? 'none' : ''}</span>
            {findUi.replace && !frozen && (
              <>
                <input
                  className="fb-r"
                  dir="auto"
                  aria-label="replace with"
                  placeholder="replace with"
                  spellCheck={false}
                  value={findUi.with}
                  onChange={(e) => setFindUi({ ...findUi, with: e.target.value })}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') { e.preventDefault(); if (e.metaKey || e.ctrlKey) replaceEvery(); else replaceOne(); }
                    else if (e.key === 'Escape') { e.preventDefault(); e.stopPropagation(); closeFind(); }
                  }}
                />
                <button type="button" className="fb-b" onClick={replaceOne} title="⏎">replace</button>
                <button type="button" className="fb-b" onClick={replaceEvery} title="⌘⏎">all</button>
              </>
            )}
            <span className="fb-keys"><span className="kbd">⏎</span> <span className="kbd">⇧⏎</span> <span className="kbd">esc</span></span>
          </div>
        )}
        <div className="meta">
          <Crumbs path={id} />
          <TabsToggle path={id} />
          <StudyButton path={id} />
          {onPages && <button type="button" className="frozen-tag" onClick={onPages}>pages</button>}
          {info && info.type !== 'draft' && (
            <button type="button" className="frozen-tag" data-frozen={info.frozen ? '1' : '0'} onClick={toggleFrozen}>
              {info.frozen ? 'frozen' : 'editable'}
            </button>
          )}
          {info && canExtract && !enrolled && (
            <button type="button" className="frozen-tag enrol" onClick={startReading}>{isNote ? 'revisit' : 'start reading'} <span className="kbd">r</span></button>
          )}
          {isNote && enrolled && headings.length > 0 && (
            <select className="frozen-tag from-heading" value="" onChange={(e) => fromHeading(Number(e.target.value))} title="start the pass at a heading">
              <option value="" disabled>from…</option>
              <option value={-1}>the top</option>
              {headings.map((h) => <option key={h.index} value={h.index}>{'\u2002'.repeat(Math.max(0, h.level - 1))}{h.text}</option>)}
            </select>
          )}
          <span className="right">{right}</span>
        </div>
        <h1>{titleOf(id, docs, root)}</h1>
        {w && (
          <div className="draft-sched" data-done={w.done ? '1' : '0'}>
            <span className="ds-state">{writeState}</span>
            <button type="button" className="ds-toggle" onClick={toggleDone}>{w.done ? 'reopen' : 'done'}</button>
          </div>
        )}
        <div className={`doc-wrap${reading ? ' reading' : ''}`} ref={wrapRef}>
          {reading && <div className="read-gutter" onPointerDown={gutterDown} onPointerMove={gutterMove} onPointerUp={gutterUp} />}
          {reading && rule && (
            <>
              <div className="read-rule" style={{ top: rule.top, height: rule.height }} />
              <div className="read-edge" style={{ top: rule.top + rule.height }}><span className="read-knob" /></div>
            </>
          )}
          <div className="doc-mount" ref={mountRef} />
          {sel && !composer && !link && (
            <div className="sel-cue" data-place={sel.rect.top < CUE_ROOM ? 'below' : 'above'} style={{ top: sel.rect.top < CUE_ROOM ? sel.rect.bottom + 8 : sel.rect.top - 8, left: sel.rect.left }}>
              {!frozen && (
                <>
                  {FORMATS.map(([kind, label, keys]) => (
                    <button key={kind} type="button" className="cue-fmt" data-fmt={kind} title={keys} onMouseDown={(e) => { e.preventDefault(); format(kind); }}>{label}</button>
                  ))}
                  <button type="button" className="cue-fmt" data-fmt="link" title="⌘K" onMouseDown={(e) => { e.preventDefault(); linkFromCue(); }}>link</button>
                  <span className="cue-sep" />
                </>
              )}
              <button type="button" className="cue-act" onMouseDown={(e) => { e.preventDefault(); openComposer(); }}>
                card <span className="kbd">{frozen ? 'm' : '⌘⇧M'}</span>
              </button>
              {canExtract && (
                <button type="button" className="cue-act" onMouseDown={(e) => { e.preventDefault(); doExtract(); }}>
                  extract <span className="kbd">{frozen ? 'e' : '⌘⇧E'}</span>
                </button>
              )}
              {plugSel && <CueActions sel={plugSel} onRun={() => setSel(null)} />}
            </div>
          )}
          {link && (
            <div className="link-pop" style={{ top: link.at.bottom + 6, left: link.at.left }}>
              <input
                className="field"
                aria-label="address"
                placeholder="address"
                autoFocus
                value={link.value}
                onChange={(e) => setLinkField({ ...link, value: e.target.value })}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') { e.preventDefault(); closeLink(true); }
                  else if (e.key === 'Escape') { e.preventDefault(); e.stopPropagation(); closeLink(false); }
                }}
                onBlur={() => setLinkField(null)}
              />
              <span className="kbd">⏎</span>
            </div>
          )}
          {slash && slash.items.length > 0 && (
            <div
              className="slash-menu"
              role="listbox"
              data-place={slash.at.bottom + SLASH_ROOM > window.innerHeight && slash.at.top > SLASH_ROOM ? 'above' : 'below'}
              style={slash.at.bottom + SLASH_ROOM > window.innerHeight && slash.at.top > SLASH_ROOM ? { top: slash.at.top - 4, left: slash.at.left } : { top: slash.at.bottom + 4, left: slash.at.left }}
            >
              {slash.items.map((it, i) => (
                <div
                  key={it.id}
                  role="option"
                  aria-selected={i === slash.state.index}
                  className={`sm-row${i === slash.state.index ? ' on' : ''}`}
                  data-id={it.id}
                  ref={i === slash.state.index ? (el) => el?.scrollIntoView({ block: 'nearest' }) : undefined}
                  onMouseDown={(e) => { e.preventDefault(); pickRow(it); }}
                >
                  <span className="sm-label">{it.label}</span>
                  <span className="sm-md">{it.md}</span>
                  <span className="sm-key">{it.key ?? ''}</span>
                </div>
              ))}
            </div>
          )}
          {composer && (
            <div
              className="card-pop"
              style={composer.rect ? { top: Math.min(composer.rect.bottom + 8, window.innerHeight - 280), left: Math.min(composer.rect.left, window.innerWidth - 440) } : undefined}
            >
              <Composer seed={composer.seed} pri={info?.pri ?? PRI_DEFAULT} onSave={saveCard} onClose={() => setComposer(null)} />
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
