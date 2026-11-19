// The sidebar tree's selection, pure. One row is selected as it always was
// (any row: the root's, a card's); several are a set of nodes, picked from
// the rows drawn and acted on as one thing (`Tree.tsx` holds it and draws it).
//
//  · click        one row: it is the selection, the anchor, and where the keys start
//  · ⇧-click      the rows drawn from the anchor to the row, both ends in
//  · ⌘-click      the row in or out of the selection; it is the anchor now
//  · ⇧↑ ⇧↓        the range from the anchor grown or shrunk by a row
//  · ⌘A           every row drawn
//  · Esc          back to the one row the keys are on
//
// What is done to several is done to the topmost of them (`topmost`): a
// folder and something inside it both selected are the folder. The selection
// follows a node moved or renamed (`followSel`) and lets go of what is no
// longer drawn (`pruneSel`).

import { childDirOf, within } from '../vault/index.js';
import { followMove } from './treeModel.js';

/** The tree's selection: the rows selected in the order they were picked, the row a range starts from, the row the keys are on. */
export interface Sel {
  paths: readonly string[];
  anchor: string | null;
  focus: string | null;
}

export const NONE: Sel = { paths: [], anchor: null, focus: null };

/** One row selected (null: none): the selection, the anchor and the focus at once. */
export const selectOne = (path: string | null): Sel => (path === null ? NONE : { paths: [path], anchor: path, focus: path });

/** More than one row is selected. */
export const several = (s: Sel): boolean => s.paths.length > 1;

export const isSelected = (s: Sel, path: string): boolean => s.paths.includes(path);

/** `paths` in the order the rows are drawn (`rows`: the paths that can be picked, top to bottom); what is not drawn is left out. */
export const inOrder = (paths: readonly string[], rows: readonly string[]): string[] => {
  const set = new Set(paths);
  return rows.filter((p) => set.has(p));
};

/**
 * ⌘-click on `path`: in or out of the selection, and the anchor of the next
 * range. A lone row that is not one of `rows` (the root's, a card's) is let
 * go as a node joins; the last row toggled out leaves nothing selected.
 */
export function toggleSel(s: Sel, rows: readonly string[], path: string): Sel {
  if (!rows.includes(path)) return selectOne(path);
  const kept = s.paths.filter((p) => rows.includes(p));
  if (kept.includes(path)) {
    const paths = kept.filter((p) => p !== path);
    const focus = paths.length ? paths[paths.length - 1]! : null;
    return { paths, anchor: focus, focus };
  }
  return { paths: [...kept, path], anchor: path, focus: path };
}

/** ⇧-click on `path`: the rows from the anchor to it, the anchor kept; with no anchor among `rows`, the one row. */
export function rangeSel(s: Sel, rows: readonly string[], path: string): Sel {
  const to = rows.indexOf(path);
  if (to < 0) return selectOne(path);
  const from = s.anchor === null ? -1 : rows.indexOf(s.anchor);
  if (from < 0) return selectOne(path);
  return { paths: rows.slice(Math.min(from, to), Math.max(from, to) + 1), anchor: s.anchor, focus: path };
}

/** ⇧↑ (`by` -1) or ⇧↓ (1): the focus a row on, the selection the range from the anchor to it. Null at the list's end, or with nothing to start from. */
export function extendSel(s: Sel, rows: readonly string[], by: -1 | 1): Sel | null {
  if (!rows.length) return null;
  const at = s.focus === null ? -1 : rows.indexOf(s.focus);
  if (at < 0) {
    // from a row that cannot be picked (the root's): the first that can
    return by === 1 ? selectOne(rows[0]!) : null;
  }
  const to = at + by;
  if (to < 0 || to >= rows.length) return null;
  const anchor = s.anchor !== null && rows.includes(s.anchor) ? s.anchor : s.focus;
  return rangeSel({ ...s, anchor }, rows, rows[to]!);
}

/** ⌘A: every row drawn, the anchor and the focus where they were when they are among them. */
export function selectAll(s: Sel, rows: readonly string[]): Sel {
  if (!rows.length) return s;
  const keep = (p: string | null) => (p !== null && rows.includes(p) ? p : rows[0]!);
  return { paths: [...rows], anchor: keep(s.anchor), focus: keep(s.focus) };
}

/** Esc, or a plain arrow: the one row the keys are on. */
export const collapseSel = (s: Sel): Sel => selectOne(s.focus ?? s.paths[0] ?? null);

/** `path` is `top` or under it (a document's children are under it). */
const under = (path: string, top: string): boolean => path === top || within(path, childDirOf(top));

/** The topmost of `paths`: one that is under another of them goes with that one. The order is kept. */
export function topmost(paths: readonly string[]): string[] {
  return paths.filter((p, i) => paths.indexOf(p) === i && !paths.some((q) => q !== p && under(p, q)));
}

/** A drop of `paths` on `target` (into it, or beside it) is refused: it is one of them, or under one. */
export const refusedAny = (paths: readonly string[], target: string): boolean => paths.some((p) => under(target, p));

/**
 * What an act on the row `path` is done to: the whole selection when it is
 * several and the row is one of them (the topmost, in the order drawn), else
 * that row alone.
 */
export function actedOn(s: Sel, rows: readonly string[], path: string): string[] {
  if (!several(s) || !isSelected(s, path)) return [path];
  const list = topmost(inOrder(s.paths, rows));
  return list.length ? list : [path];
}

/** The selection once node `from` is moved or renamed to `to`: every row of it that is the node or under it follows. */
export function followSel(s: Sel, from: string, to: string): Sel {
  if (from === to) return s;
  const f = (p: string | null) => followMove(p, from, to);
  const paths = s.paths.map((p) => f(p)!);
  const anchor = f(s.anchor);
  const focus = f(s.focus);
  return anchor === s.anchor && focus === s.focus && paths.every((p, i) => p === s.paths[i]) ? s : { paths, anchor, focus };
}

/**
 * The selection without what is gone. Of several only rows still drawn stay
 * (`rows`; one deleted, here or by a pull, or folded away is let go), and the
 * anchor and the focus move to a row that stayed. One row is kept as it is:
 * a row not drawn is not drawn selected, and the keys start from the open
 * document's row instead (`Tree.tsx`), as they always did.
 */
export function pruneSel(s: Sel, rows: readonly string[]): Sel {
  if (!several(s)) return s;
  const paths = s.paths.filter((p) => rows.includes(p));
  if (paths.length === s.paths.length) return s;
  if (!paths.length) return NONE;
  const keep = (p: string | null) => (p !== null && paths.includes(p) ? p : paths[paths.length - 1]!);
  return { paths, anchor: keep(s.anchor), focus: keep(s.focus) };
}
