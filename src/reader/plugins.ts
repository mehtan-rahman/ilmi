// Editor behaviour: `# ` makes a heading and the other block rules
// (commands.ts) a list, a quote, a rule, code, or display math; the
// formatting keys write Markdown markers; a finished `$…$` becomes a chip,
// chips re-form when the caret leaves a block, a chip's editor opens on ⏎,
// editorial marks and inline Markdown are decorated (the markers shown only
// around the caret, a backspace into a hidden one revealing it first; a
// code block is left alone), images are drawn as widgets over their source,
// lists and quotes continue on ⏎ and are left from an empty item or line,
// Tab indents an item with its children (two spaces in code; lists.ts),
// a pasted address over a selection links it, a frozen document refuses
// changes, and the marker's settled blocks are dimmed. All state-level; the
// view adds node views on top.

import { bookPlugin, type BookOptions } from './book.js';
import { baseKeymap, chainCommands, exitCode } from 'prosemirror-commands';
import { gapCursor } from 'prosemirror-gapcursor';
import { history, redo, undo } from 'prosemirror-history';
import { InputRule, inputRules, textblockTypeInputRule } from 'prosemirror-inputrules';
import { keymap } from 'prosemirror-keymap';
import type { Node as PMNode } from 'prosemirror-model';
import { EditorState, NodeSelection, Plugin, PluginKey, Selection, TextSelection, type Command, type Transaction } from 'prosemirror-state';
import { Decoration, DecorationSet } from 'prosemirror-view';
import { mathSpanEnd, type Block } from '../format/index.js';
import { mathSplit, toDoc } from './convert.js';
import { flatRanges, imageOnly, inlineRanges, literalSpans, markerRanges, type InlineRange } from './inline.js';
import { editorialRanges } from './marks.js';
import { cursorIndex, proseIndices } from './marker.js';
import { blockRules, displayMathRule, enterRules, fenceRule, pasteLink, pressed, setHeading, toggleInline, toggleList, toggleQuote, undoRule, type KeySpec } from './commands.js';
import { continueBlock, indentBlock, joinBlock, joinIntoList, moveItem, outdentBlock, toggleTasks } from './lists.js';
import { schema } from './schema.js';
import { findPlugin } from './find.js';
import { clipboardText, pasteMarkdown } from './insert.js';
import { slashPlugin } from './slash.js';
import { markupSpans, strongDir, type Dir } from './direction.js';
import { htmlMarkdown } from '../import/paste.js';
import { codeTokens } from './highlight.js';
import { foldKey, foldPlugin, type FoldMeta } from './fold.js';
import { cellAt, cellBreak, cellDown, nextCell, prevCell, rowBelow, tablePlugin } from './table.js';
import { langOf } from './schema.js';

/** A code block's text is code: no chips, no markers, no marks. */
const isCode = (node: PMNode): boolean => node.type.spec.code === true;

// ── input rules ──────────────────────────────────────────────────

const headingRule = textblockTypeInputRule(/^(#{1,6})\s$/, schema.nodes.heading!, (m) => ({ level: m[1]!.length }));

/** Typing the closing `$` of a valid span turns it into a chip. */
function mathRule(re: RegExp): InputRule {
  return new InputRule(re, (state, match, start, end) => {
    const raw = match[0];
    if (mathSpanEnd(raw, 0) !== raw.length) return null;
    return state.tr.replaceWith(start, end, schema.nodes.math!.create({ raw }));
  });
}

/** `[ ] ` or `[x] ` typed at the start of a list item becomes its box. */
const taskRule = new InputRule(/^\[([ xX])\] $/, (state, match, start, end) => {
  const $start = state.doc.resolve(start);
  const item = $start.parent;
  if (item.type !== schema.nodes.list_item || $start.parentOffset !== 0 || item.attrs.task !== null) return null;
  return state.tr.delete(start, end).setNodeMarkup($start.before(), undefined, { ...item.attrs, task: match[1] });
});

const rules = inputRules({
  rules: [headingRule, taskRule, ...blockRules, mathRule(/\$\$[^$]+\$\$$/), mathRule(/(?<!\$)\$[^$\n]+\$$/)],
});

// ── math re-forms when the caret leaves a block ──────────────────

/** Replace literal math in every textblock the selection is not in. */
function reformMath(tr: Transaction, state: EditorState): boolean {
  const { from, to } = state.selection;
  const edits: { from: number; to: number; raw: string }[] = [];
  state.doc.descendants((node, pos) => {
    if (isCode(node)) return false;
    if (!node.isTextblock) return true;
    if (pos <= to && pos + node.nodeSize >= from) return false;
    node.forEach((child, off) => {
      if (!child.isText || !child.text) return;
      let at = pos + 1 + off;
      for (const part of mathSplit(child.text)) {
        if (typeof part === 'string') { at += part.length; continue; }
        edits.push({ from: at, to: at + part.math.length, raw: part.math });
        at += part.math.length;
      }
    });
    return false;
  });
  for (const e of edits.reverse()) tr.replaceWith(e.from, e.to, schema.nodes.math!.create({ raw: e.raw }));
  return edits.length > 0;
}

const mathReform = new Plugin({
  appendTransaction(trs, _old, state) {
    if (!trs.some((tr) => tr.docChanged || tr.selectionSet)) return null;
    const tr = state.tr;
    return reformMath(tr, state) ? tr : null;
  },
});

// ── a formula edited in place ────────────────────────────────────

/**
 * The position of the chip whose editor is open, or null. `tr.setMeta(
 * mathEditKey, pos | null)` opens or closes it; the plugin marks the chip
 * with a node decoration whose spec says `mathEdit`, and the chip's node
 * view draws the editor when it sees it. A doc change moves the position
 * along; the chip gone, the editor is closed.
 */
export const mathEditKey = new PluginKey<number | null>('mathEdit');

const mathEdit = new Plugin<number | null>({
  key: mathEditKey,
  state: {
    init: () => null,
    apply(tr, cur) {
      const meta = tr.getMeta(mathEditKey) as number | null | undefined;
      if (meta !== undefined) return meta;
      if (cur === null || !tr.docChanged) return cur;
      const mapped = tr.mapping.mapResult(cur);
      return !mapped.deleted && tr.doc.nodeAt(mapped.pos)?.type === schema.nodes.math ? mapped.pos : null;
    },
  },
  props: {
    decorations(state): DecorationSet | null {
      const pos = mathEditKey.getState(state);
      return pos === null || pos === undefined ? null : DecorationSet.create(state.doc, [Decoration.node(pos, pos + 1, {}, { mathEdit: true })]);
    },
  },
});

/** Is the chip these decorations were handed to the one being edited? */
export const isMathEdit = (decorations: readonly Decoration[]): boolean => decorations.some((d) => d.spec.mathEdit === true);

/** ⏎ with a chip selected opens its editor. */
export const openMath: Command = (state, dispatch) => {
  const sel = state.selection;
  if (!(sel instanceof NodeSelection) || sel.node.type !== schema.nodes.math) return false;
  dispatch?.(state.tr.setMeta(mathEditKey, sel.from));
  return true;
};

// ── images ───────────────────────────────────────────────────────

/** What is known of an image's source: a URL to draw, broken, kept from the web by the toggle, or not looked up yet. */
export type ImageState = { url: string } | 'broken' | 'hidden' | 'pending';

/** Resolves an image's `src` as written to something the view can draw. The app's reads the vault; a test's can answer anything. */
export type ImageLoader = (src: string) => Promise<Exclude<ImageState, 'pending'>>;

export const imagesKey = new PluginKey<Map<string, ImageState>>('images');

/** `tr.setMeta(imagesKey, …)`: one source's state, or `'reset'` to forget them all and look again. */
export type ImagesMeta = { src: string; state: ImageState } | 'reset';

/** Every image source in the document, with its range and the text node's position. */
function imagesIn(doc: PMNode): { src: string; alt: string }[] {
  const out: { src: string; alt: string }[] = [];
  doc.descendants((node) => {
    if (isCode(node)) return false;
    if (!node.isText || !node.text) return true;
    for (const r of flatRanges(inlineRanges(node.text))) {
      if (r.kind === 'image' && r.href) out.push({ src: r.href, alt: node.text.slice(r.inner.from, r.inner.to) });
    }
    return false;
  });
  return out;
}

/** Holds what each image source resolved to; the view part asks `load` for the ones not yet known. */
const images = (load: ImageLoader | undefined): Plugin<Map<string, ImageState>> =>
  new Plugin<Map<string, ImageState>>({
    key: imagesKey,
    state: {
      init: () => new Map(),
      apply(tr, cur) {
        const meta = tr.getMeta(imagesKey) as ImagesMeta | undefined;
        if (meta === undefined) return cur;
        if (meta === 'reset') return new Map();
        const next = new Map(cur);
        next.set(meta.src, meta.state);
        return next;
      },
    },
    view(view) {
      let live = true;
      /** Sources asked for already; cleared when the map is reset so they are asked again. */
      let asked = new Set<string>();
      let was = imagesKey.getState(view.state) ?? new Map<string, ImageState>();
      const ask = () => {
        if (!load) return;
        const known = imagesKey.getState(view.state) ?? new Map<string, ImageState>();
        if (known.size === 0 && was.size > 0) asked = new Set();
        was = known;
        for (const { src } of imagesIn(view.state.doc)) {
          if (known.has(src) || asked.has(src)) continue;
          asked.add(src);
          // resolved later, never in this call: a dispatch here would re-enter the view being built
          load(src).then(
            (state) => { if (live) view.dispatch(view.state.tr.setMeta(imagesKey, { src, state } satisfies ImagesMeta)); },
            () => { if (live) view.dispatch(view.state.tr.setMeta(imagesKey, { src, state: 'broken' } satisfies ImagesMeta)); },
          );
        }
      };
      ask();
      return { update: ask, destroy: () => { live = false; } };
    },
  });

/** The image an `![alt](src)` stands for, drawn before its source text; nothing is drawn while it loads or when the toggle keeps it. */
function imageWidget(src: string, alt: string, state: ImageState): (view: { dispatch(tr: Transaction): void; state: EditorState }) => HTMLElement {
  return (view) => {
    if (typeof state === 'object') {
      const img = document.createElement('img');
      img.className = 'md-img';
      img.src = state.url;
      img.alt = alt;
      img.draggable = false;
      // what it was written as: a tap on a page of ink finds its drawing by it, and its strokes are drawn for the theme
      img.dataset.src = src;
      if (/(^|\/)ink-\d+\.png$/i.test(src.split(/[?#]/)[0] ?? '')) {
        img.dataset.ink = '1';
        // a page of ink is drawn at two pixels a point: shown at the size it was written, where the page is wide enough
        img.onload = () => { if (img.naturalWidth) img.style.width = `${img.naturalWidth / 2}px`; };
      }
      img.onerror = () => { view.dispatch(view.state.tr.setMeta(imagesKey, { src, state: 'broken' } satisfies ImagesMeta)); };
      return img;
    }
    const slot = document.createElement('span');
    slot.className = 'md-img-slot';
    slot.dataset.state = state;
    return slot;
  };
}

// ── editorial marks and inline Markdown ──────────────────────────

/** Set on a transaction when the document froze or thawed; the decorations are drawn again. */
export const frozenKey = new PluginKey('frozen');

/** A range, by absolute positions, whose markers stay shown while the caret sits at one of its edges. */
export interface Edge {
  from: number;
  to: number;
}

/** The edge kept, with the caret position that earned it: the range just typed closed, or the one a backspace revealed. */
interface Kept extends Edge {
  at: number;
}

/**
 * `tr.setMeta(revealKey, edge)`: show the markers of the range at `edge`
 * though the caret only touches it, as a backspace into a hidden marker
 * does; `null` lets go of the edge kept.
 */
export const revealKey = new PluginKey('reveal');

const INNER_CLASS: Record<InlineRange['kind'], string> = { em: 'md-em', strong: 'md-strong', strike: 'md-strike', code: 'md-code', link: 'md-link', image: 'md-alt' };

/** The spec every marker decoration carries, so a block's markers can be found and replaced on their own. */
const MARKER = { marker: true };

/** Whether the markers of the range at `from`..`to` show. */
type Shown = (from: number, to: number) => boolean;

/**
 * Markers follow the caret: a range's show while the selection overlaps it
 * (the caret inside it, or a selection across it), and while a collapsed
 * caret sits at the edge the plugin keeps, the range just typed closed or
 * the one a backspace revealed. Everywhere else they are hidden, on
 * editable and frozen documents alike.
 */
function shownBy(sel: Selection, kept: Kept | null): Shown {
  return (from, to) => (sel.from < to && sel.to > from) || (kept !== null && kept.from === from && kept.to === to && sel.empty && sel.from === kept.at);
}

/** The marker decorations of the ranges of one text node at `base`. */
function markerDecorations(flat: InlineRange[], base: number, shown: Shown, decos: Decoration[]): void {
  for (const r of flat) {
    const cls = shown(base + r.from, base + r.to) ? 'md-mark' : 'md-mark hidden';
    for (const m of markerRanges(r)) decos.push(Decoration.inline(base + m.from, base + m.to, { class: cls }, MARKER));
  }
}

/** Decorations for the inline Markdown of one text node at `base`, nested ranges included. */
function inlineDecorations(text: string, base: number, known: Map<string, ImageState>, shown: Shown, decos: Decoration[]): InlineRange[] {
  const ranges = inlineRanges(text);
  const flat = flatRanges(ranges);
  markerDecorations(flat, base, shown, decos);
  for (const r of flat) {
    // the picture is drawn whether or not the image has an alt
    const state: ImageState | null = r.kind === 'image' ? known.get(r.href ?? '') ?? 'pending' : null;
    if (state !== null) {
      decos.push(Decoration.widget(base + r.from, imageWidget(r.href ?? '', text.slice(r.inner.from, r.inner.to), state), { side: -1, key: `img|${r.href}|${typeof state === 'object' ? state.url : state}` }));
    }
    if (r.inner.to <= r.inner.from) continue;
    const attrs: Record<string, string> = { class: INNER_CLASS[r.kind] };
    if (r.kind === 'link' && r.href) attrs['data-href'] = r.href;
    // code reads left to right on its own inside a right-to-left line
    if (r.kind === 'code') attrs.dir = 'ltr';
    if (state === 'broken') attrs.class += ' broken';
    decos.push(Decoration.inline(base + r.inner.from, base + r.inner.to, attrs));
  }
  return ranges;
}

function markDecorations(doc: PMNode, known: Map<string, ImageState>, shown: Shown): DecorationSet {
  const decos: Decoration[] = [];
  doc.descendants((node, pos) => {
    if (isCode(node)) return false;
    if (node.isTextblock) {
      // an image alone in a paragraph: the paragraph is a figure, its alt the caption
      const only = node.childCount === 1 && node.firstChild?.isText ? imageOnly(node.firstChild.text ?? '') : null;
      if (only) {
        const state = known.get(only.href ?? '') ?? 'pending';
        decos.push(Decoration.node(pos, pos + node.nodeSize, { class: `dd-img${state === 'hidden' ? ' kept' : state === 'broken' ? ' broken' : ''}` }));
      }
      return true;
    }
    if (!node.isText || !node.text) return true;
    const ranges = inlineDecorations(node.text, pos, known, shown, decos);
    const literal = literalSpans(ranges);
    for (const r of editorialRanges(node.text)) {
      if (literal.some((l) => r.from < l.to && l.from < r.to)) continue;
      decos.push(Decoration.inline(pos + r.from, pos + r.to, { class: `ed-mark ${r.kind}` }));
    }
    return false;
  });
  return DecorationSet.create(doc, decos);
}

/** Every textblock the selection touches, by position. */
function touched(state: EditorState): number[] {
  const out: number[] = [];
  state.doc.nodesBetween(state.selection.from, state.selection.to, (node, pos) => {
    if (!node.isTextblock) return true;
    out.push(pos);
    return false;
  });
  return out;
}

/** The markers of the blocks at `blocks` drawn again for `shown`; the rest of the set stands. */
function redrawMarkers(set: DecorationSet, doc: PMNode, blocks: Iterable<number>, shown: Shown): DecorationSet {
  for (const pos of blocks) {
    const node = doc.nodeAt(pos);
    if (!node || isCode(node)) continue;
    set = set.remove(set.find(pos, pos + node.nodeSize, (spec) => spec.marker === true));
    const decos: Decoration[] = [];
    node.forEach((child, off) => {
      if (child.isText && child.text) markerDecorations(flatRanges(inlineRanges(child.text)), pos + 1 + off, shown, decos);
    });
    set = set.add(doc, decos);
  }
  return set;
}

/** The ranges of the textblock around a collapsed caret, with their absolute positions. */
function rangesAround(sel: Selection): Edge[] {
  if (!sel.empty || !(sel instanceof TextSelection)) return [];
  const $from = sel.$from;
  if (isCode($from.parent)) return [];
  const out: Edge[] = [];
  $from.parent.forEach((child, off) => {
    if (!child.isText || !child.text) return;
    const base = $from.start() + off;
    for (const r of flatRanges(inlineRanges(child.text))) out.push({ from: base + r.from, to: base + r.to });
  });
  return out;
}

/** The range that ends where a collapsed caret sits: the one just typed closed, or just backspaced up to. */
function closedAt(sel: Selection): Kept | null {
  const e = rangesAround(sel).find((r) => r.to === sel.from);
  return e ? { ...e, at: sel.from } : null;
}

interface MarksState {
  set: DecorationSet;
  edge: Kept | null;
}

const marksKey = new PluginKey<MarksState>('marks');
const marks = new Plugin<MarksState>({
  key: marksKey,
  state: {
    init: (_c, state) => ({ set: markDecorations(state.doc, imagesKey.getState(state) ?? new Map(), shownBy(state.selection, null)), edge: null }),
    apply(tr, cur, old, state) {
      const known = imagesKey.getState(state) ?? new Map<string, ImageState>();
      const sel = state.selection;
      const meta = tr.getMeta(revealKey) as Edge | null | undefined;
      const asked = meta === undefined ? undefined : meta === null ? null : { ...meta, at: sel.from };
      if (tr.docChanged) {
        const edge = asked !== undefined ? asked : closedAt(sel);
        return { set: markDecorations(tr.doc, known, shownBy(sel, edge)), edge };
      }
      let edge = asked !== undefined ? asked : cur.edge;
      if (edge && !(sel.empty && sel.from === edge.at)) edge = null;
      if (tr.getMeta(frozenKey) !== undefined || tr.getMeta(imagesKey) !== undefined) {
        return { set: markDecorations(tr.doc, known, shownBy(sel, edge)), edge };
      }
      const moved = tr.selectionSet && !old.selection.eq(sel);
      if (!moved && edge === cur.edge) return cur;
      // only the blocks that lost the caret and the ones that gained it are drawn again
      const blocks = new Set([...touched(old), ...touched(state)]);
      return { set: redrawMarkers(cur.set, tr.doc, blocks, shownBy(sel, edge)), edge };
    },
  },
  props: { decorations: (state): DecorationSet | null => marksKey.getState(state)?.set ?? null },
});

/**
 * A backspace (`dir` -1) or a forward delete (1) that would take a hidden
 * marker reveals it instead: the caret stays, the markers show, and the
 * next press deletes a character the user can see.
 */
function revealMarker(dir: -1 | 1): Command {
  return (state, dispatch) => {
    const sel = state.selection;
    if (!sel.empty) return false;
    const cur = marksKey.getState(state);
    const shown = shownBy(sel, cur?.edge ?? null);
    const edge = rangesAround(sel).find((e) => (dir < 0 ? e.to === sel.from : e.from === sel.from) && !shown(e.from, e.to));
    if (!edge) return false;
    dispatch?.(state.tr.setMeta(revealKey, edge));
    return true;
  };
}

export const revealBackward = revealMarker(-1);
export const revealForward = revealMarker(1);

// ── frozen ───────────────────────────────────────────────────────

/** Set on a transaction that only adds or changes a card; cards stay editable when the prose is frozen. */
export const cardsKey = new PluginKey('cards');

/** A frozen document's prose is locked: transactions that change it are refused, unless they carry `cardsKey`. */
export const frozenPlugin = (isFrozen: () => boolean): Plugin =>
  new Plugin({ filterTransaction: (tr) => !tr.docChanged || !isFrozen() || tr.getMeta(cardsKey) === true });

// ── the reading marker ───────────────────────────────────────────

export const markerKey = new PluginKey<{ pos: number | null; decos: DecorationSet }>('marker');

function settled(doc: PMNode, pos: number | null): DecorationSet {
  if (pos === null) return DecorationSet.empty;
  const cur = cursorIndex(proseIndices(doc), pos);
  const decos: Decoration[] = [];
  doc.forEach((node, off, i) => {
    if (i < cur && node.type.name !== 'card') decos.push(Decoration.node(off, off + node.nodeSize, { class: 'settled' }));
  });
  return DecorationSet.create(doc, decos);
}

/** Holds `read.pos`, or null when the document is not enrolled. Set it with `tr.setMeta(markerKey, pos)`. */
const marker = new Plugin<{ pos: number | null; decos: DecorationSet }>({
  key: markerKey,
  state: {
    init: () => ({ pos: null, decos: DecorationSet.empty }),
    apply(tr, cur) {
      const next = tr.getMeta(markerKey) as number | null | undefined;
      if (next !== undefined && next !== cur.pos) return { pos: next, decos: settled(tr.doc, next) };
      if (tr.docChanged) return { pos: cur.pos, decos: settled(tr.doc, cur.pos) };
      return cur;
    },
  },
  props: { decorations: (state): DecorationSet | null => markerKey.getState(state)?.decos ?? null },
});

export const markerPos = (state: EditorState): number | null => markerKey.getState(state)?.pos ?? null;

// ── direction ────────────────────────────────────────────────────

/** A block's own direction, null when it has no strong character; `'iso'` for one set left to right on its own (code, an HTML block). */
function ownDir(node: PMNode): Dir | null | 'iso' {
  if (isCode(node)) return 'iso';
  if (node.type === schema.nodes.card) return strongDir((node.attrs.card as { text: string }).text);
  if (node.type === schema.nodes.raw) {
    const text = node.attrs.text as string;
    // fenced code the pair could not read, an HTML block, a comment
    return /^\s*(?:```|~~~|<)/.test(text) ? 'iso' : strongDir(text);
  }
  return strongDir(node.textContent);
}

/**
 * Every block's direction as a node decoration (`dir`), by the rule in
 * direction.ts: its first strong character, else the block before it's.
 * A list or a quote takes its first item's or line's; each item and line
 * has its own. Card markup and `^id` in a textblock are isolated left to
 * right so they read in order in an Arabic line.
 */
export function directionDecorations(doc: PMNode): DecorationSet {
  const decos: Decoration[] = [];
  let cur: Dir = 'ltr';
  const take = (node: PMNode): Dir => {
    const own = ownDir(node);
    if (own === 'iso') return 'ltr';
    cur = own ?? cur;
    return cur;
  };
  const markup = (node: PMNode, pos: number) => {
    if (isCode(node)) return;
    node.forEach((child, off) => {
      if (!child.isText || !child.text) return;
      for (const s of markupSpans(child.text)) decos.push(Decoration.inline(pos + 1 + off + s.from, pos + 1 + off + s.to, { class: 'bidi-iso', dir: 'ltr' }));
    });
  };
  doc.forEach((node, pos) => {
    if (node.type === schema.nodes.list || node.type === schema.nodes.quote) {
      let first: Dir | null = null;
      node.forEach((child, off) => {
        const at = pos + 1 + off;
        const d = take(child);
        first ??= d;
        decos.push(Decoration.node(at, at + child.nodeSize, { dir: d }));
        markup(child, at);
      });
      decos.push(Decoration.node(pos, pos + node.nodeSize, { dir: first ?? cur }));
      return;
    }
    if (node.type === schema.nodes.table) {
      // the table reads its first letter's way; each cell with a letter its own, the rest the table's
      const d = take(node);
      decos.push(Decoration.node(pos, pos + node.nodeSize, { dir: d }));
      node.forEach((row, ro) => {
        row.forEach((cell, co) => {
          const at = pos + 1 + ro + 1 + co;
          decos.push(Decoration.node(at, at + cell.nodeSize, { dir: strongDir(cell.textContent) ?? d }));
        });
      });
      return;
    }
    decos.push(Decoration.node(pos, pos + node.nodeSize, { dir: take(node) }));
    if (node.isTextblock) markup(node, pos);
  });
  return DecorationSet.create(doc, decos);
}

export const directionKey = new PluginKey<DecorationSet>('direction');

const direction = new Plugin<DecorationSet>({
  key: directionKey,
  state: {
    init: (_c, state) => directionDecorations(state.doc),
    apply: (tr, cur) => (tr.docChanged ? directionDecorations(tr.doc) : cur),
  },
  props: { decorations: (state): DecorationSet | null => directionKey.getState(state) ?? null },
});

// ── code coloured by its language ────────────────────────────────

/** Every code block's runs as inline decorations, by the language its fence names (highlight.ts; cached per block's text). */
export function codeDecorations(doc: PMNode): DecorationSet {
  const decos: Decoration[] = [];
  doc.descendants((node, pos) => {
    if (node.type !== schema.nodes.code_block) return !node.isTextblock;
    for (const t of codeTokens(node.textContent, langOf(node.attrs.fence as string))) {
      decos.push(Decoration.inline(pos + 1 + t.from, pos + 1 + t.to, { class: t.cls }));
    }
    return false;
  });
  return DecorationSet.create(doc, decos);
}

export const codeKey = new PluginKey<DecorationSet>('code');

const codeColours = new Plugin<DecorationSet>({
  key: codeKey,
  state: {
    init: (_c, state) => codeDecorations(state.doc),
    apply: (tr, cur) => (tr.docChanged ? codeDecorations(tr.doc) : cur),
  },
  props: { decorations: (state): DecorationSet | null => codeKey.getState(state) ?? null },
});

// ── keys ─────────────────────────────────────────────────────────

const lineBreak: Command = (state, dispatch) => {
  const { $from } = state.selection;
  if (!$from.parent.isTextblock) return false;
  dispatch?.(state.tr.insertText('\n').scrollIntoView());
  return true;
};

const keys = keymap({
  'Mod-z': undo,
  'Shift-Mod-z': redo,
  'Mod-y': redo,
  'Shift-Enter': chainCommands(cellBreak, lineBreak),
  Enter: chainCommands(cellDown, openMath, fenceRule, displayMathRule((tr, pos) => tr.setMeta(mathEditKey, pos)), continueBlock),
  'Mod-Enter': chainCommands(rowBelow, toggleTasks, exitCode),
  // a rule just fired: Backspace puts the typed text back
  Backspace: chainCommands(undoRule, revealBackward, joinBlock, joinIntoList),
  Delete: revealForward,
  Tab: chainCommands(nextCell, indentBlock),
  'Shift-Tab': chainCommands(prevCell, outdentBlock),
});

/**
 * The formatting keys, matched on `event.code` (where the key is, so an
 * Arabic layout presses the same ones): ⌘B ⌘I ⌘E ⌘⇧X, ⌘1–⌘6 and ⌘0,
 * ⌘⇧7 ⌘⇧8 ⌘⇧9 ⌘⇧., and ⌥⇧↑/↓ in a list. Taken whenever the page is
 * editable, even when nothing changes, so the webview never applies its
 * own bold to the contenteditable.
 */
export const FORMAT_KEYS: { key: KeySpec; run: Command }[] = [
  { key: { code: 'KeyB', mod: true }, run: toggleInline('strong') },
  { key: { code: 'KeyI', mod: true }, run: toggleInline('em') },
  { key: { code: 'KeyE', mod: true }, run: toggleInline('code') },
  { key: { code: 'KeyX', mod: true, shift: true }, run: toggleInline('strike') },
  ...[0, 1, 2, 3, 4, 5, 6].map((n) => ({ key: { code: `Digit${n}`, mod: true }, run: setHeading(n) })),
  { key: { code: 'Digit7', mod: true, shift: true }, run: toggleList('ordered') },
  { key: { code: 'Digit8', mod: true, shift: true }, run: toggleList('bullet') },
  { key: { code: 'Digit9', mod: true, shift: true }, run: toggleList('task') },
  { key: { code: 'Period', mod: true, shift: true }, run: toggleQuote },
  { key: { code: 'ArrowUp', alt: true, shift: true }, run: moveItem(-1) },
  { key: { code: 'ArrowDown', alt: true, shift: true }, run: moveItem(1) },
];

/** When ⌘⇧V was last pressed on a page: the paste it brings is the clipboard's plain text, its HTML set aside. */
const plainAt = new WeakMap<object, number>();
const PLAIN_KEY: KeySpec = { code: 'KeyV', mod: true, shift: true };

/**
 * A paste, as Markdown: an address over a selection links it; HTML is
 * reduced to the Markdown it stands for (unless ⌘⇧V asked for the plain
 * text, or the HTML is a copy from a page here, whose plain text is its
 * Markdown already); the result goes in as the blocks the file would read.
 */
export function pasteInto(state: EditorState, data: { html: string; text: string; plain: boolean }): Transaction | null {
  if (data.text) {
    const tr = pasteLink(state, data.text);
    if (tr) return tr.scrollIntoView();
  }
  // a table's cell is one line: the text goes in as it is, its breaks as spaces
  if (cellAt(state)) return data.text ? state.tr.insertText(data.text.replace(/\s*\n\s*/g, ' ').trim()).scrollIntoView() : null;
  const html = data.plain || data.html.includes('data-pm-slice') ? '' : data.html;
  const md = (html && htmlMarkdown(html)) || data.text;
  return md ? pasteMarkdown(state, md) : null;
}

const formatKeys = new Plugin({
  props: {
    clipboardTextSerializer: (slice) => clipboardText(slice),
    handleKeyDown(view, event) {
      if (!view.editable) return false;
      if (pressed(event, PLAIN_KEY)) { plainAt.set(view, Date.now()); return false; }
      const hit = FORMAT_KEYS.find((k) => pressed(event, k.key));
      if (!hit) return false;
      // ⌥⇧↑/↓ outside a list is the system's: extend the selection by a paragraph
      const took = hit.run(view.state, view.dispatch);
      return took || !hit.key.code.startsWith('Arrow');
    },
    handlePaste(view, event) {
      const data = event.clipboardData;
      if (!data || !view.editable) return false;
      const plain = Date.now() - (plainAt.get(view) ?? 0) < 1500;
      plainAt.delete(view);
      const tr = pasteInto(view.state, { html: data.getData('text/html'), text: data.getData('text/plain'), plain });
      if (!tr) return false;
      view.dispatch(tr);
      return true;
    },
  },
});

// ── state ────────────────────────────────────────────────────────

export interface StateOptions {
  frozen: () => boolean;
  /** `read.pos`, or null when not enrolled. */
  pos: number | null;
  /** Resolves the images the text names; none, and they stay unlooked-up. */
  images?: ImageLoader;
  /** The keys of the headings folded when the page was last seen (fold.ts); view state, never in the file. */
  folds?: readonly string[];
  /** A book's notes: the chips under its sections' headings and their inline crops (`book.ts`). */
  book?: BookOptions;
}

export function makeState(blocks: Block[], opts: StateOptions): EditorState {
  const folds = opts.folds ?? [];
  const state = EditorState.create({
    doc: toDoc(blocks),
    // images before marks: the marks read the images' state as it is after the same transaction
    plugins: [frozenPlugin(opts.frozen), slashPlugin({ openMath: (tr, pos) => tr.setMeta(mathEditKey, pos) }), findPlugin, rules, enterRules, formatKeys, keys, keymap(baseKeymap), history(), gapCursor(), mathReform, mathEdit, images(opts.images), marks, marker, direction, codeColours, foldPlugin, tablePlugin, ...(opts.book ? [bookPlugin(opts.book)] : [])],
  });
  const read = opts.pos === null ? state : state.apply(state.tr.setMeta(markerKey, opts.pos));
  return folds.length ? read.apply(read.tr.setMeta(foldKey, { keys: folds } satisfies FoldMeta)) : read;
}
