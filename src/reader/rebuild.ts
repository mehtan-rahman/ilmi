// The page built again from its file without a new state: the document is
// replaced by a transaction over the least that changed, so the positions
// before it stay where they were and the history's earlier steps still hold
// (⌘Z after a line became a card still takes back what was typed before).
// What a fresh `makeState` would set anew is set on the same transaction.

import type { Node as PMNode } from 'prosemirror-model';
import { PluginKey, type EditorState, type Selection, type Transaction } from 'prosemirror-state';
import { ReplaceStep } from 'prosemirror-transform';
import type { Block } from '../format/index.js';
import { findKey, type FindMeta } from './find.js';
import { foldKey, type FoldMeta } from './fold.js';
import { cardsKey, markerKey, mathEditKey } from './plugins.js';
import { slashKey, type SlashMeta } from './slash.js';

/** Set on the transaction that brings the file's document into the editor: it is what the file says, so nothing is written for it. */
export const fileKey = new PluginKey('file');

/**
 * `state`'s document replaced by `doc` over the least that differs: from
 * the first difference to the last, at whatever depth they are (a word in
 * a paragraph), else the run of top-level blocks that differ. Null when
 * neither gives `doc` exactly; a transaction without steps when the two
 * are the same.
 */
export function replaceDoc(state: EditorState, doc: PMNode): Transaction | null {
  const old = state.doc;
  const start = old.content.findDiffStart(doc.content);
  if (start === null) return state.tr;
  const end = old.content.findDiffEnd(doc.content);
  if (end) {
    let { a, b } = end;
    // a repeat at the seam (`aa` grown to `aaa`): the ends are found before the start, and moved past it
    const over = start - Math.min(a, b);
    if (over > 0) { a += over; b += over; }
    try {
      const tr = state.tr.step(new ReplaceStep(start, a, doc.slice(start, b)));
      if (tr.doc.eq(doc)) return tr;
    } catch { /* the slice does not close there: the blocks whole, below */ }
  }
  // the first and the last top-level block that differ, replaced whole
  let from = 0;
  let head = 0;
  while (head < old.childCount && head < doc.childCount && old.child(head).eq(doc.child(head))) from += old.child(head++).nodeSize;
  let toOld = old.content.size;
  let toNew = doc.content.size;
  let tailOld = old.childCount;
  let tailNew = doc.childCount;
  while (tailOld > head && tailNew > head && old.child(tailOld - 1).eq(doc.child(tailNew - 1))) {
    toOld -= old.child(--tailOld).nodeSize;
    toNew -= doc.child(--tailNew).nodeSize;
  }
  try {
    const tr = state.tr.step(new ReplaceStep(from, toOld, doc.slice(from, toNew)));
    return tr.doc.eq(doc) ? tr : null;
  } catch {
    return null;
  }
}

export interface Refit {
  /**
   * Whether ⌘Z takes the change back: as part of what was last done (a
   * line typed, then read back as a card, is one thing to undo), or not at
   * all, the earlier steps carried over it.
   */
  undoable: boolean;
  /** `read.pos`, as `makeState` takes it. */
  pos: number | null;
  /** The folded headings' keys, as `makeState` takes them. */
  folds?: readonly string[];
  /** The selection in the new document; none, and the old one is carried by the change. */
  select?: (doc: PMNode) => Selection;
}

/**
 * The transaction that makes `state` what `makeState(blocks)` would be,
 * its history kept: the document replaced over the least that changed
 * (`replaceDoc`), the marker and the folds set as a fresh state has them,
 * an open formula and the slash menu closed, an open find bar found again
 * from the caret. It passes a frozen page (the file is what it is). Null
 * when the document cannot be reached that way: a fresh state is made.
 */
export function refit(state: EditorState, doc: PMNode, opts: Refit): Transaction | null {
  const tr = replaceDoc(state, doc);
  if (!tr) return null;
  if (tr.docChanged) {
    tr.setMeta(fileKey, true).setMeta(cardsKey, true);
    // with what was last done, never a group of its own (prosemirror-history reads this as an appended transaction)
    if (opts.undoable) tr.setMeta('appendedTransaction', tr);
    else tr.setMeta('addToHistory', false);
    if (opts.select) tr.setSelection(opts.select(tr.doc));
    tr.setMeta(mathEditKey, null);
    if (slashKey.getState(state)) tr.setMeta(slashKey, 'close' satisfies SlashMeta);
    const find = findKey.getState(state);
    if (find?.open) tr.setMeta(findKey, { query: find.query } satisfies FindMeta);
  }
  tr.setMeta(markerKey, opts.pos);
  tr.setMeta(foldKey, { keys: opts.folds ?? [] } satisfies FoldMeta);
  return tr;
}

/** A block's schedule as one string, key order aside; '' for none. */
const sig = (v: unknown): string => JSON.stringify(v ?? null, (_k, x: unknown) => (x && typeof x === 'object' && !Array.isArray(x) ? Object.fromEntries(Object.entries(x).sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0))) : x));

/** Each card and heading of `blocks` with the schedule it holds, counted. */
function schedules(blocks: Block[]): Map<string, number> {
  const out = new Map<string, number>();
  for (const b of blocks) {
    const key = b.kind === 'card' ? `c ${b.id ?? b.text} ${sig([b.sched, b.reverse, b.blanks])}` : b.kind === 'heading' ? `h ${b.text} ${sig(b.read)}` : null;
    if (key !== null) out.set(key, (out.get(key) ?? 0) + 1);
  }
  return out;
}

/**
 * Whether every card and section of `old` is in `next` with the schedule
 * it had. When one is not (a card graded, a section passed or enrolled),
 * the history is not carried over the change: an earlier step put back
 * could bring the old schedule with it, and the file would be written
 * with a review taken away.
 */
export function schedulesKept(old: Block[], next: Block[]): boolean {
  const have = schedules(next);
  for (const [key, n] of schedules(old)) if ((have.get(key) ?? 0) < n) return false;
  return true;
}
