// Editor behaviour: `# ` makes a heading, a finished `$…$` becomes a chip,
// chips re-form when the caret leaves a block, editorial marks are
// decorated, a frozen document refuses changes, and the marker's settled
// blocks are dimmed. All state-level; the view adds node views on top.

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

// ── editorial marks ──────────────────────────────────────────────

function markDecorations(doc: PMNode): DecorationSet {
  const decos: Decoration[] = [];
  doc.descendants((node, pos) => {
    if (!node.isText || !node.text) return true;
    for (const r of editorialRanges(node.text)) {
      decos.push(Decoration.inline(pos + r.from, pos + r.to, { class: `ed-mark ${r.kind}` }));
    }
    return false;
  });
  return DecorationSet.create(doc, decos);
}

const marksKey = new PluginKey<DecorationSet>('marks');
const marks = new Plugin<DecorationSet>({
  key: marksKey,
  state: {
    init: (_c, state) => markDecorations(state.doc),
    apply: (tr, set) => (tr.docChanged ? markDecorations(tr.doc) : set.map(tr.mapping, tr.doc)),
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
}

export function makeState(blocks: Block[], opts: StateOptions): EditorState {
  const state = EditorState.create({
    doc: toDoc(blocks),
    plugins: [frozenPlugin(opts.frozen), rules, keys, keymap(baseKeymap), history(), gapCursor(), mathReform, marks, marker],
  });
  return opts.pos === null ? state : state.apply(state.tr.setMeta(markerKey, opts.pos));
}
