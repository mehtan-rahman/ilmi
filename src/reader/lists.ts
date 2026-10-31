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
import { NodeSelection, Selection, TextSelection, type Command, type EditorState, type Transaction } from 'prosemirror-state';
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
  if (shiftRun(1)(state, dispatch)) return true;
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
  if (shiftRun(-1)(state, dispatch)) return true;
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
    if (moveInRun(dir)(state, dispatch)) return true;
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

// ── a list split by card items (FORMAT.md §5.2) ─────────────────
//
// A list with card items in it is several top-level blocks: list pieces
// and card atoms, every one after the first `joined`. To the keys it is
// one list: its entries (the pieces' items and the card items) in order,
// nesting read from each one's indentation, so Tab, ⇧Tab and ⌥⇧↑↓ move a
// card item, or an item with card items among its children, as any item.
// The run is rebuilt from its entries after the move: the items regrouped
// into pieces between the card items, the joins set again.

/** One entry of a run: a plain item, or a card item (its prefix in `card.item`). */
export type RunEntry = { kind: 'item'; node: PMNode } | { kind: 'card'; card: Card };

/** The list a run of joined pieces makes: where it starts, its child indices, its entries. */
export interface ListRun {
  /** The document position of the run's first block. */
  pos: number;
  /** Child indices of the document, `[start, end)`. */
  start: number;
  end: number;
  /** Whether the first block was itself joined (to a block before the run that is not part of it). */
  firstJoined: boolean;
  entries: RunEntry[];
}

const isCardItem = (n: PMNode | null | undefined): boolean => !!n && n.type === schema.nodes.card && (n.attrs.card as Card).item !== undefined;
const isPiece = (n: PMNode | null | undefined): boolean => !!n && (n.type === list || isCardItem(n));
const joinedOf = (n: PMNode): boolean => (n.type === list ? n.attrs.joined === true : (n.attrs.card as Card).joined === true);

const CARD_PREFIX = /^( *)(.*)$/;
/** An entry's indentation and its marker with the spaces after it. */
export function entryParts(e: RunEntry): { indent: string; marker: string } {
  if (e.kind === 'item') return { indent: e.node.attrs.indent as string, marker: e.node.attrs.marker as string };
  const m = CARD_PREFIX.exec(e.card.item!)!;
  return { indent: m[1]!, marker: m[2]! };
}
const entryWidth = (e: RunEntry): number => indentWidth(entryParts(e).indent);

/** The run of list pieces and card items around top-level child `index`; null when that child is neither. */
export function runAt(doc: PMNode, index: number): ListRun | null {
  if (!isPiece(doc.maybeChild(index))) return null;
  let start = index;
  while (start > 0 && joinedOf(doc.child(start)) && isPiece(doc.child(start - 1))) start--;
  let end = index + 1;
  while (end < doc.childCount && isPiece(doc.child(end)) && joinedOf(doc.child(end))) end++;
  let pos = 0;
  for (let i = 0; i < start; i++) pos += doc.child(i).nodeSize;
  const entries: RunEntry[] = [];
  for (let i = start; i < end; i++) {
    const n = doc.child(i);
    if (n.type === list) n.forEach((item) => entries.push({ kind: 'item', node: item }));
    else entries.push({ kind: 'card', card: n.attrs.card as Card });
  }
  return { pos, start, end, firstJoined: joinedOf(doc.child(start)), entries };
}

/** The blocks a run's entries make: items grouped into pieces between card items, every block after the first joined. */
export function runNodes(entries: readonly RunEntry[], firstJoined: boolean): PMNode[] {
  const out: PMNode[] = [];
  let items: PMNode[] = [];
  const flush = () => {
    if (!items.length) return;
    out.push(list.create(out.length || firstJoined ? { joined: true } : null, items));
    items = [];
  };
  for (const e of entries) {
    if (e.kind === 'item') { items.push(e.node); continue; }
    flush();
    const card = structuredClone(e.card);
    if (out.length || firstJoined) card.joined = true;
    else delete card.joined;
    out.push(schema.nodes.card!.create({ card }));
  }
  flush();
  return out;
}

/** The entry with a new indentation or marker. */
function withParts(e: RunEntry, indent: string, marker: string): RunEntry {
  if (e.kind === 'item') return { kind: 'item', node: e.node.type.create({ ...e.node.attrs, indent, marker }, e.node.content, e.node.marks) };
  return { kind: 'card', card: { ...structuredClone(e.card), item: indent + marker } };
}

const widthsOf = (es: readonly RunEntry[]) => es.map(entryWidth);
function wSubtreeEnd(ws: readonly number[], i: number): number {
  let j = i + 1;
  while (j < ws.length && ws[j]! > ws[i]!) j++;
  return j;
}
function wPrevSibling(ws: readonly number[], i: number): number | null {
  for (let k = i - 1; k >= 0; k--) {
    if (ws[k] === ws[i]) return k;
    if (ws[k]! < ws[i]!) return null;
  }
  return null;
}
function wParent(ws: readonly number[], i: number): number | null {
  for (let k = i - 1; k >= 0; k--) if (ws[k]! < ws[i]!) return k;
  return null;
}
function wNextSibling(ws: readonly number[], i: number): number | null {
  const j = wSubtreeEnd(ws, i);
  return j < ws.length && ws[j] === ws[i] ? j : null;
}

/** The run's ordered entries numbered on from the sibling before them, as `renumberList` numbers a list's items. */
function renumberEntries(es: RunEntry[], starts: ReadonlyMap<number, number>): void {
  const ws = widthsOf(es);
  const nums: (number | null)[] = [];
  es.forEach((e, i) => {
    const { indent, marker } = entryParts(e);
    const own = markerNumber(marker);
    if (own === null) { nums.push(null); return; }
    const ps = wPrevSibling(ws, i);
    const before = ps === null ? null : nums[ps];
    const n = before !== null && before !== undefined ? before + 1 : starts.get(i) ?? own;
    nums.push(n);
    if (n !== own) es[i] = withParts(e, indent, numbered(marker, n));
  });
}

/** Where the selection sits in a run: an entry and an offset in an item's text, or a selected card item. */
type RunPoint = { entry: number; offset: number } | { entry: number; card: true };

/** The run the selection is in, and its two ends as entries; null when the selection is not in one run that holds a card item. */
function runSelection(state: EditorState): { run: ListRun; anchor: RunPoint; head: RunPoint; from: number; to: number } | null {
  const sel = state.selection;
  const doc = state.doc;
  if (sel instanceof NodeSelection) {
    if (!isCardItem(sel.node) || sel.$from.depth !== 0) return null;
    const index = sel.$from.index(0);
    const run = runAt(doc, index);
    if (!run) return null;
    const entry = entryIndex(doc, run, index, -1);
    const p: RunPoint = { entry, card: true };
    return { run, anchor: p, head: p, from: entry, to: entry };
  }
  const point = (pos: number): { index: number; p: RunPoint } | null => {
    const $p = doc.resolve(pos);
    if ($p.depth !== 2 || $p.parent.type !== list_item) return null;
    return { index: $p.index(0), p: { entry: -1, offset: $p.parentOffset } };
  };
  const a = point(sel.anchor);
  const h = point(sel.head);
  if (!a || !h) return null;
  const run = runAt(doc, a.index);
  if (!run || h.index < run.start || h.index >= run.end) return null;
  if (!run.entries.some((e) => e.kind === 'card')) return null;
  const ae = entryIndex(doc, run, a.index, doc.resolve(sel.anchor).index(1));
  const he = entryIndex(doc, run, h.index, doc.resolve(sel.head).index(1));
  const anchor = { entry: ae, offset: (a.p as { offset: number }).offset };
  const head = { entry: he, offset: (h.p as { offset: number }).offset };
  return { run, anchor, head, from: Math.min(ae, he), to: Math.max(ae, he) };
}

/** The entry index of top-level child `index` (a card item, `item` -1) or of item `item` of the piece there. */
function entryIndex(doc: PMNode, run: ListRun, index: number, item: number): number {
  let k = 0;
  for (let i = run.start; i < index; i++) {
    const n = doc.child(i);
    k += n.type === list ? n.childCount : 1;
  }
  return k + Math.max(0, item);
}

/** Where entry `k` starts in the rebuilt run: an item's position, or the card's. */
function entryPos(nodes: readonly PMNode[], runPos: number, k: number): number {
  let pos = runPos;
  let left = k;
  for (const n of nodes) {
    if (n.type === list) {
      if (left < n.childCount) {
        let at = pos + 1;
        for (let i = 0; i < left; i++) at += n.child(i).nodeSize;
        return at;
      }
      left -= n.childCount;
    } else {
      if (left === 0) return pos;
      left--;
    }
    pos += n.nodeSize;
  }
  return pos;
}

/** The run rebuilt from `entries`, the selection put back on the entries it was on (their new indices given by `moved`). */
function rebuildRun(state: EditorState, run: ListRun, entries: RunEntry[], anchor: RunPoint, head: RunPoint, moved: (k: number) => number): Transaction {
  const nodes = runNodes(entries, run.firstJoined);
  let end = run.pos;
  for (let i = run.start; i < run.end; i++) end += state.doc.child(i).nodeSize;
  const tr = state.tr.replaceWith(run.pos, end, nodes);
  const at = (p: RunPoint) => {
    const pos = entryPos(nodes, run.pos, moved(p.entry));
    return 'card' in p ? pos : pos + 1 + p.offset;
  };
  if ('card' in anchor) tr.setSelection(NodeSelection.create(tr.doc, at(anchor)));
  else tr.setSelection(TextSelection.create(tr.doc, at(anchor), at(head)));
  return tr;
}

/** Tab, ⇧Tab over a run with card items: each selected root entry, with its children, in under the sibling before it or out to its parent's column. */
function shiftRun(dir: 1 | -1): Command {
  return (state, dispatch) => {
    const at = runSelection(state);
    if (!at) return false;
    const es = [...at.run.entries];
    const ws = widthsOf(es);
    const starts = new Map<number, number>();
    for (let i = at.from; i <= at.to; i = wSubtreeEnd(ws, i)) {
      let target: number;
      if (dir > 0) {
        const ps = wPrevSibling(ws, i);
        if (ps === null) continue;
        target = ws[ps]! + entryParts(es[ps]!).marker.length;
      } else {
        if (ws[i] === 0) continue;
        const p = wParent(ws, i);
        target = p === null ? 0 : ws[p]!;
      }
      const delta = target - ws[i]!;
      for (let k = i; k < wSubtreeEnd(ws, i); k++) {
        const { marker } = entryParts(es[k]!);
        es[k] = withParts(es[k]!, ' '.repeat(Math.max(0, ws[k]! + delta)), marker);
      }
      starts.set(i, 1);
    }
    if (starts.size && dispatch) {
      renumberEntries(es, starts);
      dispatch(rebuildRun(state, at.run, es, at.anchor, at.head, (k) => k).scrollIntoView());
    }
    return true;
  };
}

/** ⌥⇧↑ / ⌥⇧↓ over a run with card items: the entry the selection is on, with its children, trades places with its sibling. */
function moveInRun(dir: -1 | 1): Command {
  return (state, dispatch) => {
    const at = runSelection(state);
    if (!at) return false;
    const es = at.run.entries;
    const ws = widthsOf(es);
    const i = at.from;
    let a: number;
    let b: number;
    let c: number;
    if (dir < 0) {
      const ps = wPrevSibling(ws, i);
      if (ps === null) return true;
      [a, b, c] = [ps, i, wSubtreeEnd(ws, i)];
    } else {
      const ns = wNextSibling(ws, i);
      if (ns === null) return true;
      [a, b, c] = [i, ns, wSubtreeEnd(ws, ns)];
    }
    if (!dispatch) return true;
    const next = [...es.slice(0, a), ...es.slice(b, c), ...es.slice(a, b), ...es.slice(c)];
    const n = markerNumber(entryParts(es[a]!).marker);
    renumberEntries(next, n === null ? new Map() : new Map([[a, n]]));
    // [a, b) went to a + (c - b); [b, c) to a
    const moved = (k: number) => (k >= a && k < b ? k + (c - b) : k >= b && k < c ? k - (b - a) : k);
    dispatch(rebuildRun(state, at.run, next, at.anchor, at.head, moved).scrollIntoView());
    return true;
  };
}

/**
 * A card put into a list as an item (a card made from a selection inside
 * one): after the entry at `pos` (an item, or a card item) and its
 * children, at its indentation, with the next marker; the numbers after it
 * move on. Null when `pos` is in no list.
 */
export function insertCardItem(state: EditorState, pos: number, card: Card): { tr: Transaction; pos: number } | null {
  const doc = state.doc;
  const $p = doc.resolve(Math.min(pos, doc.content.size));
  let index: number;
  let item = -1;
  const node = doc.nodeAt(pos);
  if (node && isCardItem(node) && $p.depth === 0) index = $p.index(0);
  else if ($p.depth >= 1 && $p.node(1).type === list) { index = $p.index(0); item = $p.depth >= 2 ? $p.index(1) : Math.min($p.index(1), $p.node(1).childCount - 1); }
  else return null;
  const run = runAt(doc, index);
  if (!run) return null;
  const es = [...run.entries];
  const k = entryIndex(doc, run, index, item);
  const ws = widthsOf(es);
  const end = wSubtreeEnd(ws, k);
  const { indent, marker } = entryParts(es[k]!);
  const made: RunEntry = { kind: 'card', card: { ...structuredClone(card), item: indent + nextMarker(marker) } };
  es.splice(end, 0, made);
  renumberEntries(es, new Map());
  const nodes = runNodes(es, run.firstJoined);
  let to = run.pos;
  for (let i = run.start; i < run.end; i++) to += doc.child(i).nodeSize;
  const tr = state.tr.replaceWith(run.pos, to, nodes);
  return { tr, pos: entryPos(nodes, run.pos, end) };
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
