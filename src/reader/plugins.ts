// Editor behaviour: `# ` makes a heading, a finished `$…$` becomes a chip,
// chips re-form when the caret leaves a block, editorial marks and inline
// Markdown are decorated (the markers dimmed, hidden when frozen), images
// are drawn as widgets over their source, a frozen document refuses
// changes, and the marker's settled blocks are dimmed. All state-level;
// the view adds node views on top.

import { baseKeymap } from 'prosemirror-commands';
import { gapCursor } from 'prosemirror-gapcursor';
import { history, redo, undo } from 'prosemirror-history';
import { InputRule, inputRules, textblockTypeInputRule } from 'prosemirror-inputrules';
import { keymap } from 'prosemirror-keymap';
import type { Node as PMNode } from 'prosemirror-model';
import { EditorState, Plugin, PluginKey, TextSelection, type Command, type Transaction } from 'prosemirror-state';
import { Decoration, DecorationSet } from 'prosemirror-view';
import { mathSpanEnd, type Block } from '../format/index.js';
import { mathSplit, toDoc } from './convert.js';
import { flatRanges, imageOnly, inlineRanges, literalSpans, markerRanges, type InlineRange } from './inline.js';
import { editorialRanges } from './marks.js';
import { cursorIndex, proseIndices } from './marker.js';
import { schema } from './schema.js';

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

const rules = inputRules({
  rules: [headingRule, mathRule(/\$\$[^$]+\$\$$/), mathRule(/(?<!\$)\$[^$\n]+\$$/)],
});

// ── math re-forms when the caret leaves a block ──────────────────

/** Replace literal math in every textblock the selection is not in. */
function reformMath(tr: Transaction, state: EditorState): boolean {
  const { from, to } = state.selection;
  const edits: { from: number; to: number; raw: string }[] = [];
  state.doc.descendants((node, pos) => {
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

/** Turn the chip at `pos` back into its source and put the caret after it. */
export const editMath: Command = (state, dispatch) => {
  const { node, from } = state.selection as { node?: PMNode; from: number };
  if (!node || node.type !== schema.nodes.math) return false;
  const raw = node.attrs.raw as string;
  if (dispatch) {
    const tr = state.tr.replaceWith(from, from + 1, schema.text(raw));
    dispatch(tr.setSelection(TextSelection.create(tr.doc, from + raw.length)));
  }
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

/** Set on a transaction when the document froze or thawed, so the markers hide or show. */
export const frozenKey = new PluginKey('frozen');

const INNER_CLASS: Record<InlineRange['kind'], string> = { em: 'md-em', strong: 'md-strong', code: 'md-code', link: 'md-link', image: 'md-alt' };

/** Decorations for the inline Markdown of one text node at `base`, nested ranges included. */
function inlineDecorations(text: string, base: number, hidden: boolean, known: Map<string, ImageState>, decos: Decoration[]): InlineRange[] {
  const ranges = inlineRanges(text);
  const mark = hidden ? 'md-mark hidden' : 'md-mark';
  for (const r of flatRanges(ranges)) {
    for (const m of markerRanges(r)) decos.push(Decoration.inline(base + m.from, base + m.to, { class: mark }));
    if (r.inner.to <= r.inner.from) continue;
    const attrs: Record<string, string> = { class: INNER_CLASS[r.kind] };
    if (r.kind === 'link' && r.href) attrs['data-href'] = r.href;
    if (r.kind === 'image') {
      const state = known.get(r.href ?? '') ?? 'pending';
      if (state === 'broken') attrs.class += ' broken';
      decos.push(Decoration.widget(base + r.from, imageWidget(r.href ?? '', text.slice(r.inner.from, r.inner.to), state), { side: -1, key: `img|${r.href}|${typeof state === 'object' ? state.url : state}`, ignoreSelection: true }));
    }
    decos.push(Decoration.inline(base + r.inner.from, base + r.inner.to, attrs));
  }
  return ranges;
}

function markDecorations(doc: PMNode, hidden: boolean, known: Map<string, ImageState>): DecorationSet {
  const decos: Decoration[] = [];
  doc.descendants((node, pos) => {
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
    const ranges = inlineDecorations(node.text, pos, hidden, known, decos);
    const literal = literalSpans(ranges);
    for (const r of editorialRanges(node.text)) {
      if (literal.some((l) => r.from < l.to && l.from < r.to)) continue;
      decos.push(Decoration.inline(pos + r.from, pos + r.to, { class: `ed-mark ${r.kind}` }));
    }
    return false;
  });
  return DecorationSet.create(doc, decos);
}

const marksKey = new PluginKey<DecorationSet>('marks');
const marks = (isFrozen: () => boolean) =>
  new Plugin<DecorationSet>({
    key: marksKey,
    state: {
      init: (_c, state) => markDecorations(state.doc, isFrozen(), imagesKey.getState(state) ?? new Map()),
      apply: (tr, set, _old, state) => (tr.docChanged || tr.getMeta(frozenKey) !== undefined || tr.getMeta(imagesKey) !== undefined
        ? markDecorations(tr.doc, isFrozen(), imagesKey.getState(state) ?? new Map())
        : set.map(tr.mapping, tr.doc)),
    },
    props: { decorations: (state): DecorationSet | null => marksKey.getState(state) ?? null },
  });

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
  'Shift-Enter': lineBreak,
});

// ── state ────────────────────────────────────────────────────────

export interface StateOptions {
  frozen: () => boolean;
  /** `read.pos`, or null when not enrolled. */
  pos: number | null;
  /** Resolves the images the text names; none, and they stay unlooked-up. */
  images?: ImageLoader;
}

export function makeState(blocks: Block[], opts: StateOptions): EditorState {
  const state = EditorState.create({
    doc: toDoc(blocks),
    // images before marks: the marks read the images' state as it is after the same transaction
    plugins: [frozenPlugin(opts.frozen), rules, keys, keymap(baseKeymap), history(), gapCursor(), mathReform, images(opts.images), marks(opts.frozen), marker],
  });
  return opts.pos === null ? state : state.apply(state.tr.setMeta(markerKey, opts.pos));
}
