// Editor behaviour: `# ` makes a heading, a finished `$…$` becomes a chip,
// chips re-form when the caret leaves a block, a chip's editor opens on ⏎,
// editorial marks and inline Markdown are decorated (the markers shown only
// around the caret, a backspace into a hidden one revealing it first),
// images are drawn as widgets over their source, a frozen document refuses
// changes, and the marker's settled blocks are dimmed. All state-level; the
// view adds node views on top.

import { baseKeymap } from 'prosemirror-commands';
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

const INNER_CLASS: Record<InlineRange['kind'], string> = { em: 'md-em', strong: 'md-strong', code: 'md-code', link: 'md-link', image: 'md-alt' };

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
    if (state === 'broken') attrs.class += ' broken';
    decos.push(Decoration.inline(base + r.inner.from, base + r.inner.to, attrs));
  }
  return ranges;
}

function markDecorations(doc: PMNode, known: Map<string, ImageState>, shown: Shown): DecorationSet {
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
    if (!node) continue;
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
  Enter: openMath,
  Backspace: revealBackward,
  Delete: revealForward,
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
    plugins: [frozenPlugin(opts.frozen), rules, keys, keymap(baseKeymap), history(), gapCursor(), mathReform, mathEdit, images(opts.images), marks, marker],
  });
  return opts.pos === null ? state : state.apply(state.tr.setMeta(markerKey, opts.pos));
}
