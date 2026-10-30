// Lists and quotes edited as themselves. A list is flat (FORMAT keeps it
// as a raw block, `raw.ts` reads it as one item per line); nesting is read
// from each item's indentation: an item's children are the items after it
// set in further, up to the next one that is not. Tab and ⇧Tab move an
// item with its children, ⌥⇧↑/↓ move them among the item's siblings, ⏎
// continues an item or a quote line, ⏎ on an empty one outdents it and
// then leaves, Backspace at an item's start takes its box and then makes
// it a paragraph, and Backspace at the start of the paragraph after a list
// puts its text back on the last item.

import { Fragment, type Node as PMNode, type NodeType, type ResolvedPos } from 'prosemirror-model';
import { Selection, TextSelection, type Command, type EditorState, type Transaction } from 'prosemirror-state';
import type { Card } from '../format/index.js';
import { markerNumber, nextMarker, numbered } from './raw.js';
import { indentWidth, schema } from './schema.js';

const { list, list_item, quote, quote_line, paragraph } = schema.nodes as Record<'list' | 'list_item' | 'quote' | 'quote_line' | 'paragraph', NodeType>;

const isCode = (node: PMNode): boolean => node.type.spec.code === true;

/** Is the collapsed caret, or a selection within one block, inside a list item or a quote line? */
export function lineBlock(sel: Selection): { node: PMNode; $from: ResolvedPos } | null {
  if (!(sel instanceof TextSelection) || !sel.$from.sameParent(sel.$to)) return null;
  const node = sel.$from.parent;
  return node.type === list_item || node.type === quote_line ? { node, $from: sel.$from } : null;
}

// ── the tree inside a flat list ──────────────────────────────────

const width = (item: PMNode): number => indentWidth(item.attrs.indent as string);

/** The index just past item `i`'s children. */
export function subtreeEnd(l: PMNode, i: number): number {
  const w = width(l.child(i));
  let j = i + 1;
  while (j < l.childCount && width(l.child(j)) > w) j++;
  return j;
}

/** The item before `i` at its own depth, under the same parent; null when `i` is its parent's first. */
export function prevSibling(l: PMNode, i: number): number | null {
  const w = width(l.child(i));
  for (let k = i - 1; k >= 0; k--) {
    const wk = width(l.child(k));
    if (wk === w) return k;
    if (wk < w) return null;
  }
  return null;
}

/** The item `i` sits under: the nearest before it set in less. */
export function parentItem(l: PMNode, i: number): number | null {
  const w = width(l.child(i));
  for (let k = i - 1; k >= 0; k--) if (width(l.child(k)) < w) return k;
  return null;
}

/** The item after `i`'s children at `i`'s depth, or null. */
export function nextSibling(l: PMNode, i: number): number | null {
  const j = subtreeEnd(l, i);
  return j < l.childCount && width(l.child(j)) === width(l.child(i)) ? j : null;
}

/** Where item `i` of the list at `listPos` begins. */
function itemAt(l: PMNode, listPos: number, i: number): number {
  let pos = listPos + 1;
  for (let k = 0; k < i; k++) pos += l.child(k).nodeSize;
  return pos;
}

/**
 * Ordered items numbered on from the sibling before them: each follows
 * its sibling's number, and an item with no ordered sibling before it
 * keeps its own number, or the one `starts` gives it (an item that has
 * just arrived where it is). Bullets are left as they are.
 */
export function renumberList(tr: Transaction, listPos: number, starts: ReadonlyMap<number, number> = new Map()): void {
  const l = tr.doc.nodeAt(listPos);
  if (!l || l.type !== list) return;
  const nums: (number | null)[] = [];
  const edits: { pos: number; attrs: Record<string, unknown> }[] = [];
  l.forEach((item, off, i) => {
    const marker = item.attrs.marker as string;
    const own = markerNumber(marker);
    if (own === null) { nums.push(null); return; }
    const ps = prevSibling(l, i);
    const before = ps === null ? null : nums[ps];
    const n = before !== null && before !== undefined ? before + 1 : starts.get(i) ?? own;
    nums.push(n);
    if (n !== own) edits.push({ pos: listPos + 1 + off, attrs: { ...item.attrs, marker: numbered(marker, n) } });
  });
  for (const e of edits) tr.setNodeMarkup(e.pos, undefined, e.attrs);
}

/**
 * Ordered items after `pos` in the list at `listPos` numbered on from the
 * one before them at the same indentation, where they had fallen behind:
 * `1. 2. [3.] 3.` reads `1. 2. 3. 4.` once the third is put in.
 */
function renumber(tr: Transaction, listPos: number): void {
  const l = tr.doc.nodeAt(listPos);
  if (!l) return;
  const last = new Map<string, number>();
  const edits: { pos: number; attrs: Record<string, unknown> }[] = [];
  const step = (indent: string, n: number): number => {
    const prev = last.get(indent);
    const next = prev !== undefined && n <= prev ? prev + 1 : n;
    last.set(indent, next);
    return next;
  };
  const items = (node: PMNode, at: number) => node.forEach((item, off) => {
    const marker = item.attrs.marker as string;
    const n = markerNumber(marker);
    if (n === null) return;
    const next = step(item.attrs.indent as string, n);
    if (next !== n) edits.push({ pos: at + 1 + off, attrs: { ...item.attrs, marker: numbered(marker, next) } });
  });
  items(l, listPos);
  // the list goes on past a card item and the pieces joined after it (FORMAT.md §5.2): their numbers follow too
  for (let pos = listPos + l.nodeSize; pos < tr.doc.content.size;) {
    const node = tr.doc.nodeAt(pos);
    if (!node) break;
    if (node.type === list && node.attrs.joined === true) items(node, pos);
    else if (node.type === schema.nodes.card && (node.attrs.card as Card).joined && (node.attrs.card as Card).item !== undefined) {
      const card = node.attrs.card as Card;
      const m = ITEM_NUMBER.exec(card.item!);
      if (m) {
        const n = Number.parseInt(m[2]!, 10);
        const next = step(m[1]!, n);
        if (next !== n) edits.push({ pos, attrs: { card: { ...structuredClone(card), item: `${m[1]}${next}${m[3]}` } } });
      }
    } else break;
    pos += node.nodeSize;
  }
  for (const e of edits) tr.setNodeMarkup(e.pos, undefined, e.attrs);
}

/** A card item's numbered prefix: indentation, number, and the rest (`.` or `)` and the spaces). */
const ITEM_NUMBER = /^( *)(\d{1,9})([.)] +)$/;

/** The items a selection touches, by index into their list, with the list; null when the selection is not inside one list. */
function selectedItems(state: EditorState): { list: PMNode; listPos: number; from: number; to: number } | null {
  const { $from, $to } = state.selection;
  if ($from.depth < 2 || $to.depth < 2) return null;
  if ($from.parent.type !== list_item || $to.parent.type !== list_item) return null;
  const listPos = $from.before(1);
  if ($to.before(1) !== listPos) return null;
  return { list: $from.node(1), listPos, from: $from.index(1), to: $to.index(1) };
}

/** The selected items that are not under another selected item: the ones a move or an indent acts on, each taking its children. */
function roots(l: PMNode, from: number, to: number): number[] {
  const out: number[] = [];
  let i = from;
  while (i <= to) {
    out.push(i);
    i = subtreeEnd(l, i);
  }
  return out;
}

/** Items `from`..`to` (exclusive) set in or out by `delta` columns, in spaces. */
function shift(tr: Transaction, l: PMNode, listPos: number, from: number, to: number, delta: number): void {
  for (let k = from; k < to; k++) {
    const item = l.child(k);
    const w = Math.max(0, width(item) + delta);
    tr.setNodeMarkup(itemAt(l, listPos, k), undefined, { ...item.attrs, indent: ' '.repeat(w) });
  }
}

/**
 * Tab in a list: each selected item, with its children, goes under the
 * sibling before it, at that sibling's text column (`- ` two in, `10. `
 * four). An item with no sibling before it stays. Tab in code is two
 * spaces. Taken in any list item, so the focus never leaves the page.
 */
export const indentBlock: Command = (state, dispatch) => {
  if (isCode(state.selection.$from.parent) && state.selection.$from.sameParent(state.selection.$to)) {
    dispatch?.(state.tr.insertText('  ').scrollIntoView());
    return true;
  }
  const at = selectedItems(state);
  if (!at) return false;
  const { list: l, listPos } = at;
  const tr = state.tr;
  // an item arriving first under its new parent starts at 1
  const moved = new Map<number, number>();
  for (const i of roots(l, at.from, at.to)) {
    const ps = prevSibling(l, i);
    if (ps === null) continue;
    const sib = l.child(ps);
    const target = width(sib) + (sib.attrs.marker as string).length;
    shift(tr, l, listPos, i, subtreeEnd(l, i), target - width(l.child(i)));
    moved.set(i, 1);
  }
  if (moved.size && dispatch) {
    renumberList(tr, listPos, moved);
    dispatch(tr.scrollIntoView());
  }
  return true;
};

/** ⇧Tab in a list: each selected item, with its children, out to its parent's column; an item at the top stays. */
export const outdentBlock: Command = (state, dispatch) => {
  const at = selectedItems(state);
  if (!at) return false;
  const { list: l, listPos } = at;
  const tr = state.tr;
  const moved = new Map<number, number>();
  for (const i of roots(l, at.from, at.to)) {
    const w = width(l.child(i));
    if (w === 0) continue;
    const p = parentItem(l, i);
    const target = p === null ? 0 : width(l.child(p));
    shift(tr, l, listPos, i, subtreeEnd(l, i), target - w);
    moved.set(i, 1);
  }
  if (moved.size && dispatch) {
    renumberList(tr, listPos, moved);
    dispatch(tr.scrollIntoView());
  }
  return true;
};

/**
 * ⌥⇧↑ (`dir` -1) or ⌥⇧↓ (1): the item the caret is in, with its children,
 * changes places with the sibling before or after it (and that sibling's
 * children); the caret goes with it. At the first or last sibling it
 * stays, the key still taken inside a list.
 */
export function moveItem(dir: -1 | 1): Command {
  return (state, dispatch) => {
    const at = selectedItems(state);
    if (!at) return false;
    const { list: l, listPos } = at;
    const i = at.from;
    let a: number;
    let b: number;
    let c: number;
    if (dir < 0) {
      const ps = prevSibling(l, i);
      if (ps === null) return true;
      [a, b, c] = [ps, i, subtreeEnd(l, i)];
    } else {
      const ns = nextSibling(l, i);
      if (ns === null) return true;
      [a, b, c] = [i, ns, subtreeEnd(l, ns)];
    }
    if (!dispatch) return true;
    // [a, b) and [b, c) trade places
    const items: PMNode[] = [];
    l.forEach((n) => items.push(n));
    const size = (from: number, to: number) => items.slice(from, to).reduce((n, it) => n + it.nodeSize, 0);
    const tr = state.tr.replaceWith(itemAt(l, listPos, a), itemAt(l, listPos, c), Fragment.from([...items.slice(b, c), ...items.slice(a, b)]));
    // the selection moves by the size of what went past it
    const delta = dir < 0 ? -size(a, b) : size(b, c);
    tr.setSelection(TextSelection.create(tr.doc, state.selection.anchor + delta, state.selection.head + delta));
    // the pair's first place keeps the number it had
    const n = markerNumber(items[a]!.attrs.marker as string);
    renumberList(tr, listPos, n === null ? new Map() : new Map([[a, n]]));
    dispatch(tr.scrollIntoView());
    return true;
  };
}

/** The prefix a new quote line takes: the line's own, or the nearest one before it when the line was lazy. */
function quotePrefix($from: ResolvedPos): string {
  const own = $from.parent.attrs.prefix as string;
  if (own) return own;
  const q = $from.node(-1);
  for (let i = $from.index(-1) - 1; i >= 0; i--) {
    const p = q.child(i).attrs.prefix as string;
    if (p) return p;
  }
  return '> ';
}

/**
 * ⏎ in a list item or a quote line continues it: the text after the caret
 * goes to a new item with the next marker (a bullet as it is, a number one
 * up, a task box unchecked) or a new line with the same prefix. On an empty
 * item set in, ⏎ outdents it; on an empty item at the top or an empty
 * line, ⏎ leaves (`leaveBlock`).
 */
export const continueBlock: Command = (state, dispatch) => {
  const at = lineBlock(state.selection);
  if (!at) return false;
  const { node, $from } = at;
  if (node.content.size === 0) {
    if (node.type === list_item && width(node) > 0) return outdentBlock(state, dispatch);
    return leaveBlock(state, dispatch);
  }
  if (!dispatch) return true;
  const tr = state.tr.deleteSelection();
  const attrs = node.type === list_item
    ? { indent: node.attrs.indent, marker: nextMarker(node.attrs.marker as string), task: node.attrs.task === null ? null : ' ' }
    : { prefix: quotePrefix($from) };
  tr.split(tr.mapping.map($from.pos), 1, [{ type: node.type, attrs }]);
  if (node.type === list_item) renumber(tr, $from.before(-1));
  dispatch(tr.scrollIntoView());
  return true;
};

/**
 * Leave a list or a quote from the item or line the caret is in: the item
 * becomes a paragraph after the block when it is last, before it when
 * first, and between the two halves otherwise. The item's text goes with
 * it; its marker does not.
 */
export const leaveBlock: Command = (state, dispatch) => {
  const at = lineBlock(state.selection);
  if (!at) return false;
  const { node, $from } = at;
  if (!dispatch) return true;
  const block = $from.node(-1);
  const blockPos = $from.before(-1);
  const itemPos = $from.before();
  const index = $from.index(-1);
  const para = paragraph.create(null, node.content);
  const tr = state.tr;
  let caret: number;
  if (block.childCount === 1) {
    tr.replaceWith(blockPos, blockPos + block.nodeSize, para);
    caret = blockPos + 1;
  } else if (index === 0) {
    tr.delete(itemPos, itemPos + node.nodeSize).insert(blockPos, para);
    caret = blockPos + 1;
  } else if (index === block.childCount - 1) {
    tr.delete(itemPos, itemPos + node.nodeSize);
    const after = blockPos + block.nodeSize - node.nodeSize;
    tr.insert(after, para);
    caret = after + 1;
  } else {
    tr.delete(itemPos, itemPos + node.nodeSize).split(itemPos).insert(itemPos + 1, para);
    caret = itemPos + 2;
  }
  tr.setSelection(TextSelection.create(tr.doc, caret + $from.parentOffset));
  // the items after it are numbered on in their own list
  const rest = tr.doc.nodeAt(tr.selection.$from.after(1));
  if (node.type === list_item && rest?.type === list) renumberList(tr, tr.selection.$from.after(1));
  dispatch(tr.scrollIntoView());
  return true;
};

/**
 * Backspace at the start of an item or a line: a task box goes first;
 * then an item becomes a paragraph where it stood (the list split around
 * it), a quote line joins the one before it, and a quote's first line
 * becomes a paragraph before the quote.
 */
export const joinBlock: Command = (state, dispatch) => {
  const sel = state.selection;
  if (!sel.empty) return false;
  const at = lineBlock(sel);
  if (!at || at.$from.parentOffset !== 0) return false;
  const { node, $from } = at;
  if (node.attrs.task !== null && node.attrs.task !== undefined) {
    dispatch?.(state.tr.setNodeMarkup($from.before(), undefined, { ...node.attrs, task: null }));
    return true;
  }
  if (node.type === list_item || $from.index(-1) === 0) return leaveBlock(state, dispatch);
  dispatch?.(state.tr.join($from.before()).scrollIntoView());
  return true;
};

/**
 * Backspace at the start of a paragraph right after a list: its text goes
 * onto the end of the list's last item, and a list after it joins on, so
 * a Backspace that made an item a paragraph is undone by the next. A
 * paragraph that carries an id or extracts is left to the default.
 */
export const joinIntoList: Command = (state, dispatch) => {
  const sel = state.selection;
  if (!sel.empty || !(sel instanceof TextSelection)) return false;
  const { $from } = sel;
  if ($from.depth !== 1 || $from.parent.type !== paragraph || $from.parentOffset !== 0) return false;
  const para = $from.parent;
  if (para.attrs.id !== null || (para.attrs.extracts as string[] | null)?.length) return false;
  const index = $from.index(0);
  if (index === 0) return false;
  const before = state.doc.child(index - 1);
  if (before.type !== list) return false;
  if (!dispatch) return true;
  const paraPos = $from.before(1);
  const listPos = paraPos - before.nodeSize;
  const caret = paraPos - 2; // the end of the last item's text
  const tr = state.tr.delete(paraPos, paraPos + para.nodeSize).insert(caret, para.content);
  tr.setSelection(TextSelection.create(tr.doc, caret));
  // past the text put on, the item's end, and the list's end
  const boundary = caret + para.content.size + 2;
  if (tr.doc.resolve(boundary).nodeAfter?.type === list) tr.join(boundary);
  renumberList(tr, listPos);
  dispatch(tr.scrollIntoView());
  return true;
};

/** The task box at the item at `pos` ticked or cleared; false when the item has none. */
export function toggleTask(state: EditorState, dispatch: ((tr: Transaction) => void) | undefined, pos: number): boolean {
  const item = state.doc.nodeAt(pos);
  if (!item || item.type !== list_item || item.attrs.task === null) return false;
  dispatch?.(state.tr.setNodeMarkup(pos, undefined, { ...item.attrs, task: item.attrs.task === ' ' ? 'x' : ' ' }));
  return true;
}

/** ⌘⏎: the task boxes of the items the selection touches ticked (or all cleared when all were ticked); false when none has a box. */
export const toggleTasks: Command = (state, dispatch) => {
  const at = selectedItems(state);
  if (!at) return false;
  const boxes: number[] = [];
  for (let i = at.from; i <= at.to; i++) if (at.list.child(i).attrs.task !== null) boxes.push(i);
  if (!boxes.length) return false;
  const tick = boxes.some((i) => at.list.child(i).attrs.task === ' ');
  if (dispatch) {
    const tr = state.tr;
    for (const i of boxes) {
      const item = at.list.child(i);
      tr.setNodeMarkup(itemAt(at.list, at.listPos, i), undefined, { ...item.attrs, task: tick ? 'x' : ' ' });
    }
    dispatch(tr);
  }
  return true;
};

/** Numbered or not: a numbered list beside a bulleted one is another list (CommonMark starts a new one), so the two are not joined. */
const ordered = (item: PMNode | null | undefined): boolean => !!item && markerNumber(item.attrs.marker as string) !== null;

/** The list at `pos` joined with a list of its kind just before or after it; positions after it shift as `tr.mapping` says. */
export function joinLists(tr: Transaction, pos: number): void {
  const $pos = tr.doc.resolve(pos);
  const node = $pos.nodeAfter;
  if (!node || node.type !== list) return;
  const after = pos + node.nodeSize;
  const next = tr.doc.resolve(after).nodeAfter;
  if (next?.type === list && ordered(node.lastChild) === ordered(next.firstChild)) tr.join(after);
  const prev = $pos.nodeBefore;
  if (prev?.type === list && ordered(prev.lastChild) === ordered(node.firstChild)) tr.join(pos);
}

export { list, list_item, quote, quote_line };
