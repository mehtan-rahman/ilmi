// A cloze's blanks as the editor shows them (FORMAT.md §5.1): the text
// keeps `{{c1::…}}` as the file has it, and the page shows the answer
// marked, a small number where the blank opens, and no braces. A blank is
// made from a selection (⌘B, or the menu), never typed brace by brace
// unless you want to: typed braces become a blank as soon as they close.
//
// The braces are text the caret cannot rest in: a caret that lands inside
// a hidden run is moved to its far end, and a backspace against a blank's
// opening takes the blank away (the words stay), not one brace of it.

import { Plugin, PluginKey, TextSelection, type Command, type EditorState, type Transaction } from 'prosemirror-state';
import { Decoration, DecorationSet } from 'prosemirror-view';
import type { Node as PMNode } from 'prosemirror-model';
import { blanks, clozeGroups, nextGroup } from '../format/index.js';
import { flatText } from './commands.js';

/** A blank in the page: where its opening, its answer and its closing lie (document positions), its group, how deep it is nested. */
export interface BlankSpan {
  from: number;
  /** The end of the opening (`{{c1::`): where the answer starts. */
  inner: number;
  /** The start of the closing `}}`: where the answer ends. */
  close: number;
  to: number;
  n: number | null;
  depth: number;
}

/**
 * A face's text as the card holds it: its lines (each a textblock) joined
 * by a line break, and where each line starts in the page. A card is one
 * text, so a blank may open on one line and close on another.
 */
export function faceText(doc: PMNode): { text: string; lines: { at: number; pos: number; len: number }[] } {
  const lines: { at: number; pos: number; len: number }[] = [];
  let text = '';
  doc.descendants((node, pos) => {
    if (!node.isTextblock) return true;
    if (node.type.spec.code === true) return false;
    if (lines.length) text += '\n';
    const t = flatText(node);
    lines.push({ at: text.length, pos: pos + 1, len: t.length });
    text += t;
    return false;
  });
  return { text, lines };
}

/** Every blank of the document, outer before inner: read over the whole text, so one may run over several lines. */
export function blankSpans(doc: PMNode): BlankSpan[] {
  const { text, lines } = faceText(doc);
  if (!text.includes('{{')) return [];
  // an offset of the text as a place in the page (a line break has none: nothing of a blank's braces lies on one)
  const posOf = (offset: number): number => {
    let line = lines[0]!;
    for (const l of lines) if (l.at <= offset) line = l;
    return line.pos + Math.min(line.len, offset - line.at);
  };
  const out: BlankSpan[] = [];
  for (const b of blanks(text)) {
    const end = b.at + b.raw.length;
    const from = posOf(b.at);
    const to = posOf(end);
    out.push({ from, inner: posOf(b.at + b.open), close: posOf(end - 2), to, n: b.n, depth: out.filter((o) => o.from < from && o.to >= to).length });
  }
  return out;
}

const allSpans = blankSpans;

/** The runs the caret cannot rest in: every opening and closing. */
const hiddenOf = (spans: readonly BlankSpan[]): { from: number; to: number }[] => spans.flatMap((s) => [{ from: s.from, to: s.inner }, { from: s.close, to: s.to }]);

interface DecoState { spans: BlankSpan[]; set: DecorationSet }

function build(doc: PMNode): DecoState {
  const spans = allSpans(doc);
  const decos: Decoration[] = [];
  for (const s of spans) {
    decos.push(Decoration.inline(s.from, s.inner, { class: 'bl-open', 'data-n': s.n === null ? '' : String(s.n) }));
    if (s.close > s.inner) decos.push(Decoration.inline(s.inner, s.close, { class: `bl bl-d${Math.min(s.depth, 3)}` }));
    decos.push(Decoration.inline(s.close, s.to, { class: 'bl-close' }));
  }
  return { spans, set: DecorationSet.create(doc, decos) };
}

export const blanksKey = new PluginKey<DecoState>('blanks');

/** The blanks of the page as the plugin last read them. */
export const blanksOf = (state: EditorState): BlankSpan[] => blanksKey.getState(state)?.spans ?? [];

/** The innermost blank holding `from`–`to` (its answer, edges included); null when none does. */
export function blankAround(state: EditorState, from = state.selection.from, to = state.selection.to): BlankSpan | null {
  let best: BlankSpan | null = null;
  for (const s of blanksOf(state)) if (s.inner <= from && to <= s.close && (!best || s.depth >= best.depth)) best = s;
  return best;
}

/** The groups the caret's block already has, in order. */
export function groupsHere(state: EditorState): number[] {
  return clozeGroups(faceText(state.doc).text);
}

/**
 * The selection made a blank: of the group `n`, or of a new one (the lowest
 * number the block does not use). With nothing selected, the word at the
 * caret. The selection may run over lines. The caret ends after the
 * blank's last word, inside it.
 */
export function makeBlank(n?: number): Command {
  return (state, dispatch) => {
    // the selection may run over several lines (the card is one text); all of it selected is from the first letter to the last
    const sel = state.selection.empty ? state.selection : TextSelection.between(state.selection.$from, state.selection.$to);
    const { $from, $to } = sel;
    if (!$from.parent.isTextblock || !$to.parent.isTextblock || $from.parent.type.spec.code === true || $to.parent.type.spec.code === true) return false;
    let from = sel.from;
    let to = sel.to;
    // a selection that ends before a line's first letter ends with the line above
    if (to > from && $to.parentOffset === 0 && $to.depth > 0) {
      const before = state.doc.resolve($to.before()).nodeBefore;
      if (before?.isTextblock) to = $to.before() - 1;
    }
    if (from === to) {
      // the word at the caret
      const text = flatText($from.parent);
      const start = $from.start();
      let a = from - start;
      let b = a;
      const word = (c: string | undefined) => c !== undefined && /[^\s{}]/.test(c);
      while (word(text[a - 1])) a--;
      while (word(text[b])) b++;
      if (a === b) return false;
      from = start + a;
      to = start + b;
    }
    // a selection never cuts through a blank's braces: it is widened to hold a blank it half holds
    for (const s of blanksOf(state)) {
      const cuts = (p: number) => p > s.from && p < s.to && !(p >= s.inner && p <= s.close);
      if (cuts(from) || (from >= s.inner && from <= s.close && to > s.close)) from = Math.min(from, s.from);
      if (cuts(to) || (to >= s.inner && to <= s.close && from < s.inner)) to = Math.max(to, s.to);
    }
    if (!dispatch) return true;
    const group = n ?? nextGroup(faceText(state.doc).text);
    const open = `{{c${group}::`;
    const tr = state.tr.insertText('}}', to).insertText(open, from);
    tr.setSelection(TextSelection.create(tr.doc, to + open.length));
    dispatch(tr.scrollIntoView());
    return true;
  };
}

/** A blank taken away, its words left: its opening and its closing deleted. */
function unwrap(tr: Transaction, s: BlankSpan): Transaction {
  return tr.delete(s.close, s.to).delete(s.from, s.inner);
}

/** The blank at the caret (the innermost) is no blank any more; its words stay. */
export const removeBlank: Command = (state, dispatch) => {
  const s = blankAround(state);
  if (!s) return false;
  if (dispatch) dispatch(unwrap(state.tr, s).scrollIntoView());
  return true;
};

/** The blank at the caret put in the group `n`. */
export function regroupBlank(n: number): Command {
  return (state, dispatch) => {
    const s = blankAround(state);
    if (!s) return false;
    if (dispatch) dispatch(state.tr.insertText(`{{c${n}::`, s.from, s.inner));
    return true;
  };
}

/**
 * Backspace and delete at a blank's edges. Against its opening, from
 * inside (the caret before the answer's first letter), backspace takes the
 * blank away. Elsewhere the hidden braces are stepped over, so the key
 * deletes the letter you can see next to the caret.
 */
function edgeDelete(dir: -1 | 1): Command {
  return (state, dispatch) => {
    const sel = state.selection;
    if (!sel.empty) return false;
    const p = sel.from;
    const spans = blanksOf(state);
    if (dir < 0) {
      const opened = spans.find((s) => s.inner === p);
      if (opened) { if (dispatch) dispatch(unwrap(state.tr, opened).scrollIntoView()); return true; }
      // just after a blank: the letter before its closing goes (an empty blank goes whole)
      let at = p;
      for (let moved = true; moved;) { moved = false; for (const s of spans) if (s.to === at) { at = s.close; moved = true; } }
      if (at === p) return false;
      const empty = spans.find((s) => s.close === at && s.inner === at);
      if (dispatch) dispatch((empty ? unwrap(state.tr, empty) : state.tr.delete(at - 1, at)).scrollIntoView());
      return true;
    }
    // forward: from before a blank, or from its answer's end, over the braces to the next letter
    let at = p;
    for (let moved = true; moved;) {
      moved = false;
      for (const s of spans) {
        if (s.from === at) { at = s.inner; moved = true; }
        else if (s.close === at) { at = s.to; moved = true; }
      }
    }
    if (at === p) return false;
    const $at = state.doc.resolve(at);
    if (at >= $at.end()) return true;
    if (dispatch) { const tr = state.tr.delete(at, at + 1); dispatch(tr.setSelection(TextSelection.create(tr.doc, p)).scrollIntoView()); }
    return true;
  };
}

/** A caret inside a hidden run is moved out of it, the way it was going; from a run's near edge it goes a letter further, so every press moves it. */
function settle(old: EditorState, state: EditorState): Transaction | null {
  const sel = state.selection;
  if (!sel.empty) return null;
  const hidden = hiddenOf(blanksOf(state));
  const p = sel.from;
  const inside = hidden.find((h) => h.from < p && p < h.to);
  if (!inside) return null;
  const was = old.selection.empty ? old.selection.from : p;
  const $p = state.doc.resolve(p);
  const lo = $p.start();
  const hi = $p.end();
  let to: number;
  if (was <= p) {
    to = inside.to;
    if (was === inside.from) {
      for (let h = hidden.find((x) => x.from === to); h; h = hidden.find((x) => x.from === to)) to = h.to;
      to = Math.min(hi, to + 1);
      const again = hidden.find((h) => h.from < to && to < h.to);
      if (again) to = again.to;
    }
  } else {
    to = inside.from;
    if (was === inside.to) {
      for (let h = hidden.find((x) => x.to === to); h; h = hidden.find((x) => x.to === to)) to = h.from;
      to = Math.max(lo, to - 1);
      const again = hidden.find((h) => h.from < to && to < h.to);
      if (again) to = again.from;
    }
  }
  return to === p ? null : state.tr.setSelection(TextSelection.create(state.doc, to));
}

/** The plugin: the blanks' marks, the caret kept out of the braces, the two deleting keys at a blank's edges. */
export const blanksPlugin = new Plugin<DecoState>({
  key: blanksKey,
  state: {
    init: (_c, state) => build(state.doc),
    apply: (tr, cur) => (tr.docChanged ? build(tr.doc) : cur),
  },
  props: {
    decorations: (state): DecorationSet | null => blanksKey.getState(state)?.set ?? null,
    handleKeyDown(view, e) {
      // ⌘B in a cloze is a blank, never bold: taken here, before the keys that format
      if ((e.metaKey || e.ctrlKey) && !e.altKey && !e.shiftKey && (e.key === 'b' || e.key === 'B')) { makeBlank()(view.state, view.dispatch.bind(view)); return true; }
      if (e.metaKey || e.ctrlKey || e.altKey) return false;
      if (e.key === 'Backspace') return edgeDelete(-1)(view.state, view.dispatch.bind(view));
      if (e.key === 'Delete') return edgeDelete(1)(view.state, view.dispatch.bind(view));
      return false;
    },
  },
  appendTransaction(trs, old, state) {
    if (!trs.some((t) => t.selectionSet || t.docChanged)) return null;
    return settle(old, state);
  },
});
