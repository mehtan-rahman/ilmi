// The reader: one document as one continuous surface. Prose is editable
// ProseMirror, cards and raw blocks sit in the flow as atoms, math renders
// as KaTeX chips edited in a field under the chip, and the reading marker
// runs down the left margin. Every change goes through the vault as blocks;
// nothing here string-edits a file.

import katex from 'katex';
import type { Node as PMNode } from 'prosemirror-model';
import { NodeSelection, Selection, TextSelection, type EditorState, type Transaction } from 'prosemirror-state';
import { EditorView, type Decoration, type NodeView } from 'prosemirror-view';
import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { PRI_DEFAULT, cardFields, clozeSegments, mathSpanEnd, meta, serialize, setField, type Blank, type Block, type Card, type Doc, type MathSeg } from '../format/index.js';
import {
  blockAt, blocksEqual, cardDue, classifyRaw, cursorIndex, editorialRanges, flatRanges, fromDoc, frozenKey, imagesKey, inlineRanges, insertCard, isMathEdit,
  literalSpans, makeState, markerKey, markerPos, markerRanges, mathEditKey, mathSplit, passage, pickPos, proseIndices, schema, setReadPos, splitBlocks,
  type Band, type InlineRange, type Passage, type RawShape,
} from '../reader/index.js';
import { advanceWrite, whenToDate } from '../schedule/index.js';
import { dirOf, nameOf, type Loaded, type Vault } from '../vault/index.js';
import { CueActions } from '../plugins/CueActions.js';
import { onPluginAction, publishSelection as publishPluginSelection, runBlockHooks, toPluginSelection, usePlugins, wantsBlocks, type PluginSelection } from '../plugins/index.js';
import { Composer } from './Composer.js';
import { imageLoader } from './images.js';
import { dueLabel } from './items.js';
import { titleOf } from './names.js';
import { useApp, type DocInfo } from './store.js';
import { currentVault, enrolReading, extractNode } from './vault.js';
import 'katex/dist/katex.min.css';
import 'prosemirror-gapcursor/style/gapcursor.css';
import './reader.css';

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
  return `<span class="math${display ? ' display' : ''}" data-tex="${escapeHtml(raw)}">${inner}</span>`;
}

const INLINE_CLASS: Record<InlineRange['kind'], string> = { em: 'md-em', strong: 'md-strong', code: 'md-code', link: 'md-link', image: 'md-alt' };

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
    const attrs = r.kind === 'link' && r.href ? ` data-href="${escapeHtml(r.href)}"` : '';
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
    if (h) return `<h${h[1]!.length}>${richHTML((h[2] ?? '').replace(/[ \t]+#+$/, '').trim())}</h${h[1]!.length}>`;
    return bare ? richHTML(c) : `<p>${richHTML(c)}</p>`;
  }).join('');
}

/** The element a raw block's shape stands for; `null` for a shape that stays as source. */
function shapeHTML(shape: RawShape, text: string): string {
  switch (shape.kind) {
    case 'code':
      return `<pre><code${shape.lang ? ` class="language-${escapeHtml(shape.lang)}"` : ''}>${escapeHtml(shape.code)}</code></pre>`;
    case 'list': {
      const tag = shape.ordered ? 'ol' : 'ul';
      const start = shape.ordered && shape.start !== 1 ? ` start="${shape.start}"` : '';
      return `<${tag}${start}>${shape.items.map((it) => `<li>${blocksHTML(it.text, true)}</li>`).join('')}</${tag}>`;
    }
    case 'quote':
      return `<blockquote>${blocksHTML(shape.text, false)}</blockquote>`;
    case 'table': {
      const head = shape.head.map((h, i) => `<th${ALIGN_ATTR(shape.align[i] ?? null)}>${richHTML(h)}</th>`).join('');
      const rows = shape.rows.map((r) => `<tr>${r.map((c, i) => `<td${ALIGN_ATTR(shape.align[i] ?? null)}>${richHTML(c)}</td>`).join('')}</tr>`).join('');
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
  return clozeSegments(text).map((seg) => {
    if (typeof seg === 'string') return richHTML(seg);
    if ('span' in seg) return mathBlanksHTML(seg, (b) => stateOf(b, ++index), cls);
    return `<span class="${cls(stateOf(seg, ++index))}">${richHTML(seg.answer)}</span>`;
  }).join('');
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
      return `<span class="cs-q">${richHTML(f.front)}</span><span class="cs-a">${richHTML(f.back)}</span>`;
    case 'bidir':
      return `<span>${richHTML(f.left)} <span class="cs-arrow">⇄</span> ${richHTML(f.right)}</span>`;
  }
}

// ── node views ───────────────────────────────────────────────────

class CardView implements NodeView {
  dom: HTMLElement;

  constructor(node: PMNode) {
    this.dom = document.createElement('div');
    this.dom.setAttribute('contenteditable', 'false');
    this.render(node);
  }

  render(node: PMNode): void {
    const card = node.attrs.card as Card;
    const now = new Date();
    const due = cardDue(card);
    const isDue = due === undefined || whenToDate(due) <= now;
    this.dom.className = `card-span${isDue ? ' due' : ''}`;
    this.dom.innerHTML =
      `<div class="cs-body">${cardHTML(card)}</div>` +
      `<div class="cs-foot"><span class="cs-state" data-due="${isDue ? '1' : '0'}">${escapeHtml(dueLabel(due, now))}</span></div>`;
  }

  update(node: PMNode): boolean {
    if (node.type !== schema.nodes.card) return false;
    this.render(node);
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
    field.value = this.display ? raw.slice(2, -2) : raw.slice(1, -1);
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
    const raw = was.startsWith('$$') ? `$$${tex}$$` : `$${tex}$`;
    const pos = this.getPos();
    if (pos === undefined) return;
    const { view } = this;
    const tr = view.state.tr.setMeta(mathEditKey, null);
    let end = pos + 1;
    if (commit && raw !== was) {
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
 * A raw block: a list, a quote, code, a table, or a rule drawn as that
 * element, with its source behind it for while the block is selected; any
 * other raw text (an HTML block, a comment) as mono source, as before.
 */
class RawView implements NodeView {
  dom: HTMLElement;
  /** Drawn as an element, or kept as mono source; a change between the two makes a new view. */
  private readonly drawn: boolean;

  constructor(node: PMNode) {
    const text = node.attrs.text as string;
    this.drawn = rawHTML(text) !== null;
    this.dom = document.createElement(this.drawn ? 'div' : 'pre');
    this.dom.setAttribute('contenteditable', 'false');
    this.render(node);
  }

  render(node: PMNode): void {
    const text = node.attrs.text as string;
    const selected = this.dom.classList.contains('selected') ? ' selected' : '';
    const drawn = rawHTML(text);
    if (!drawn) {
      this.dom.className = `raw${selected}`;
      this.dom.textContent = text;
      return;
    }
    this.dom.className = `raw rendered${selected}`;
    this.dom.dataset.kind = drawn.kind;
    this.dom.innerHTML = `<div class="raw-view">${drawn.html}</div><pre class="raw-src">${escapeHtml(text)}</pre>`;
  }

  update(node: PMNode): boolean {
    if (node.type !== schema.nodes.raw || (rawHTML(node.attrs.text as string) !== null) !== this.drawn) return false;
    this.render(node);
    return true;
  }

  selectNode(): void { this.dom.classList.add('selected'); }
  deselectNode(): void { this.dom.classList.remove('selected'); }
  ignoreMutation(): boolean { return true; }
}

export const nodeViews = {
  card: (node: PMNode) => new CardView(node),
  math: (node: PMNode, view: EditorView, getPos: () => number | undefined, decorations: readonly Decoration[]) => new MathView(node, view, getPos, decorations),
  raw: (node: PMNode) => new RawView(node),
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
  const selRef = useRef<Sel | null>(null);
  selRef.current = sel;
  const composerRef = useRef<Compose | null>(null);
  composerRef.current = composer;
  // extracts come out of sources and extracts; drafts only make cards
  const canExtract = info?.type === 'source' || info?.type === 'extract';
  const canExtractRef = useRef(false);
  canExtractRef.current = canExtract;
  const actRef = useRef<(key: string) => boolean>(() => false);
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
    const idx = cursorIndex(proseIndices(doc), pos);
    const wr = wrap.getBoundingClientRect();
    const fr = first.getBoundingClientRect();
    if (idx < 0) { setRule({ top: fr.top - wr.top, height: 0 }); return; }
    let at = 0;
    for (let i = 0; i < idx; i++) at += doc.child(i).nodeSize;
    const boundary = view.nodeDOM(at) as HTMLElement | null;
    if (!boundary) { setRule(null); return; }
    const br = boundary.getBoundingClientRect();
    setRule({ top: fr.top - wr.top, height: Math.max(0, br.bottom - fr.top) });
  }, []);

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
      const state = makeState(loaded.doc.blocks, { frozen: () => frozenRef.current, pos: meta(loaded.doc).read?.pos ?? null, images: images.load });
      const view = viewRef.current;
      if (view) view.updateState(withSelectionOf(view.state, state));
      else {
        viewRef.current = new EditorView(mount, {
          state,
          nodeViews,
          editable: () => !frozenRef.current,
          attributes: { class: 'draft-doc', spellcheck: 'true' },
          dispatchTransaction(this: EditorView, tr: Transaction) {
            const next = this.state.apply(tr);
            this.updateState(next);
            if (tr.docChanged) {
              writer.version++;
              writer.schedule(() => fromDoc(this.state.doc));
            }
            if (tr.docChanged || tr.getMeta(markerKey) !== undefined) measure();
            if (tr.docChanged) hookBlocks();
            if (tr.selectionSet || tr.docChanged) publishSelection(next);
          },
          handleClickOn,
          handleClick,
          handleKeyDown(view, event) {
            if (event.key === 'Escape') {
              view.dom.blur();
              return true;
            }
            if (!event.metaKey && !event.ctrlKey && !event.altKey && actRef.current(event.key)) {
              event.preventDefault();
              return true;
            }
            return false;
          },
          handleDOMEvents: {
            blur: () => { writer.flush(); return false; },
          },
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
        viewRef.current?.destroy();
        viewRef.current = null;
        setStatus('gone');
      }
    });
    return () => {
      live = false;
      off();
      writer.flush();
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
      (view.nodeDOM(pos) as HTMLElement | null)?.scrollIntoView({ block: 'center' });
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
            if (p.text) next = { ...p, end: Math.max(a, b), rect: range.getBoundingClientRect() };
          } catch { /* not in the document */ }
        }
      }
      setSel((cur) => (sameSel(cur, next) ? cur : next));
    };
    document.addEventListener('selectionchange', capture);
    return () => document.removeEventListener('selectionchange', capture);
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

  const startReading = () => { if (canExtractRef.current && !readingRef.current) enrolReading(id).catch(console.error); };

  actRef.current = (key) => {
    if (composerRef.current) return false;
    if (key === 'r' && activeRef.current && canExtractRef.current && !readingRef.current) { startReading(); return true; }
    if (!selRef.current) return false;
    if (key === 'e' && canExtractRef.current) { doExtract(); return true; }
    if (key === 'm') { openComposer(); return true; }
    return false;
  };

  // `e` and `m` when the surface is not focused (a frozen document)
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.metaKey || e.ctrlKey || e.altKey || inField(e.target)) return;
      if (actRef.current(e.key)) e.preventDefault();
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
    doc.forEach((node) => {
      const el = view.nodeDOM(at) as HTMLElement | null;
      at += node.nodeSize;
      if (node.type.name === 'card' || !el) return;
      const r = el.getBoundingClientRect();
      bands.push({ top: r.top, height: r.height });
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
    return <div className="reader-wrap"><div className="reader"><div className="empty">no longer in the vault</div></div></div>;
  }

  const reading = !!info?.read;
  const cards = info?.cards ?? 0;
  const due = info?.due ?? 0;
  const counts = cards ? `${plural(cards, 'card')}${due ? `, ${due} due` : ''}` : '';
  const right = info?.type === 'draft' ? [plural(words(blocks), 'word'), counts].filter(Boolean).join(', ') : counts;

  return (
    <div className="reader-wrap">
      <div className={`reader doc-view${reading ? ' reading' : ''}`}>
        <div className="meta">
          <span className="crumb">{crumbOf(id, docs)}</span>
          {onPages && <button type="button" className="frozen-tag" onClick={onPages}>pages</button>}
          {info && info.type !== 'draft' && (
            <button type="button" className="frozen-tag" data-frozen={info.frozen ? '1' : '0'} onClick={toggleFrozen}>
              {info.frozen ? 'frozen' : 'editable'}
            </button>
          )}
          {info && canExtract && !reading && (
            <button type="button" className="frozen-tag enrol" onClick={startReading}>start reading <span className="kbd">r</span></button>
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
          {sel && !composer && (
            <div className="sel-cue" style={{ top: sel.rect.bottom + 8, left: sel.rect.left }}>
              {canExtract && (
                <button type="button" className="cue-act" onMouseDown={(e) => { e.preventDefault(); doExtract(); }}>
                  extract <span className="kbd">e</span>
                </button>
              )}
              <button type="button" className="cue-act" onMouseDown={(e) => { e.preventDefault(); openComposer(); }}>
                make a card <span className="kbd">m</span>
              </button>
              {plugSel && <CueActions sel={plugSel} onRun={() => setSel(null)} />}
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
