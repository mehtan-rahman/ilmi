// Tables edited as tables: each cell is a line of inline text with the
// live inline rules; Tab and ⇧Tab step between cells, ⏎ moves down (out
// of the table from the last row), ⌘⏎ adds a row under the caret's;
// rows and columns are added at the edges and anywhere from the cell's
// menu, deleted from it, and a column aligned. The table is written back
// as the normalized pipe table (raw.ts `nodeToRaw`, blocks.ts `writeTable`).

import type { NodeType, Node as PMNode } from 'prosemirror-model';
import { Plugin, PluginKey, TextSelection, type Command, type EditorState, type Transaction } from 'prosemirror-state';
import { Decoration, DecorationSet } from 'prosemirror-view';
import type { Align } from './blocks.js';
import { schema } from './schema.js';

const { table, table_row: tableRow, table_cell: tableCell, paragraph } = schema.nodes as Record<'table' | 'table_row' | 'table_cell' | 'paragraph', NodeType>;

/** Where the caret is in a table: the table and its position, the cell's row and column, the table's size. */
export interface CellAt {
  table: PMNode;
  tablePos: number;
  row: number;
  col: number;
  rows: number;
  cols: number;
}

/** The cell the selection's start is in, or null outside a table. */
export function cellAt(state: EditorState, pos = state.selection.from): CellAt | null {
  const $p = state.doc.resolve(pos);
  for (let d = $p.depth; d >= 2; d--) {
    if ($p.node(d).type !== tableCell) continue;
    const t = $p.node(d - 2);
    return { table: t, tablePos: $p.before(d - 2), row: $p.index(d - 2), col: $p.index(d - 1), rows: t.childCount, cols: t.firstChild!.childCount };
  }
  return null;
}

/** The position of the start of cell (`row`, `col`)'s text, in a table at `tablePos`. */
export function cellStart(t: PMNode, tablePos: number, row: number, col: number): number {
  let pos = tablePos + 1;
  for (let r = 0; r < row; r++) pos += t.child(r).nodeSize;
  pos += 1;
  const tr = t.child(row);
  for (let c = 0; c < col; c++) pos += tr.child(c).nodeSize;
  return pos + 1;
}

/** The caret at the end of a cell's text. */
const cellEnd = (t: PMNode, tablePos: number, row: number, col: number): number => cellStart(t, tablePos, row, col) + t.child(row).child(col).content.size;

/** A table's cells as a grid of nodes. */
const grid = (t: PMNode): PMNode[][] => {
  const out: PMNode[][] = [];
  t.forEach((r) => { const row: PMNode[] = []; r.forEach((c) => row.push(c)); out.push(row); });
  return out;
};

/** The table at `tablePos` replaced by one with `cells`, the caret put in (`row`, `col`), at its start or its end. */
function rebuild(state: EditorState, tablePos: number, cells: PMNode[][], row: number, col: number, end = false): Transaction {
  const old = state.doc.nodeAt(tablePos)!;
  const next = table.create(old.attrs, cells.map((r) => tableRow.create(null, r)));
  const tr = state.tr.replaceWith(tablePos, tablePos + old.nodeSize, next);
  const r = Math.max(0, Math.min(row, cells.length - 1));
  const c = Math.max(0, Math.min(col, cells[0]!.length - 1));
  const at = end ? cellEnd(next, tablePos, r, c) : cellStart(next, tablePos, r, c);
  return tr.setSelection(TextSelection.create(tr.doc, at)).scrollIntoView();
}

const emptyCell = (align: Align) => tableCell.create({ align });

/** A row of empty cells, each with its column's alignment. */
const emptyRow = (cells: PMNode[][]) => cells[0]!.map((c) => emptyCell((c.attrs.align as Align) ?? null));

/** Put the caret in cell (`row`, `col`) of the table at `tablePos`, its text selected end to end as Tab does in a grid. */
function goTo(state: EditorState, at: CellAt, row: number, col: number): Transaction {
  const from = cellStart(at.table, at.tablePos, row, col);
  const to = cellEnd(at.table, at.tablePos, row, col);
  return state.tr.setSelection(TextSelection.create(state.doc, from, to)).scrollIntoView();
}

/** Tab: the next cell, its text selected; from the last cell, a new row and its first cell. */
export const nextCell: Command = (state, dispatch) => {
  const at = cellAt(state);
  if (!at) return false;
  if (!dispatch) return true;
  if (at.col + 1 < at.cols) dispatch(goTo(state, at, at.row, at.col + 1));
  else if (at.row + 1 < at.rows) dispatch(goTo(state, at, at.row + 1, 0));
  else {
    const cells = grid(at.table);
    cells.push(emptyRow(cells));
    dispatch(rebuild(state, at.tablePos, cells, at.row + 1, 0));
  }
  return true;
};

/** ⇧Tab: the cell before, its text selected; the first cell stays. */
export const prevCell: Command = (state, dispatch) => {
  const at = cellAt(state);
  if (!at) return false;
  if (!dispatch) return true;
  if (at.col > 0) dispatch(goTo(state, at, at.row, at.col - 1));
  else if (at.row > 0) dispatch(goTo(state, at, at.row - 1, at.cols - 1));
  return true;
};

/** ⏎: the cell below, the caret at its end; from the last row, out to the paragraph after the table (made when there is none). */
export const cellDown: Command = (state, dispatch) => {
  const at = cellAt(state);
  if (!at) return false;
  if (!dispatch) return true;
  if (at.row + 1 < at.rows) {
    const pos = cellEnd(at.table, at.tablePos, at.row + 1, at.col);
    dispatch(state.tr.setSelection(TextSelection.create(state.doc, pos)).scrollIntoView());
    return true;
  }
  const after = at.tablePos + at.table.nodeSize;
  const next = state.doc.nodeAt(after);
  const tr = state.tr;
  if (!next || next.type !== paragraph) tr.insert(after, paragraph.create());
  dispatch(tr.setSelection(TextSelection.create(tr.doc, after + 1)).scrollIntoView());
  return true;
};

/** ⇧⏎ in a cell: a line break, which the pipe table writes as `<br>` (its cells are one line each). */
export const cellBreak: Command = (state, dispatch) => {
  if (cellAt(state) === null) return false;
  dispatch?.(state.tr.insertText('\n').scrollIntoView());
  return true;
};

/** A row of empty cells put in at index `row` of the table at `tablePos`; the caret in it, in column `col`. */
export function addRow(tablePos: number, row: number, col = 0): Command {
  return (state, dispatch) => {
    const t = state.doc.nodeAt(tablePos);
    if (t?.type !== table) return false;
    const cells = grid(t);
    const at = Math.max(0, Math.min(row, cells.length));
    // a row put above the header becomes the header; the old one its first row
    cells.splice(at, 0, emptyRow(cells));
    dispatch?.(rebuild(state, tablePos, cells, at, col));
    return true;
  };
}

/** A column of empty cells put in at index `col` of the table at `tablePos`, unaligned; the caret in it, in row `row`. */
export function addColumn(tablePos: number, col: number, row = 0): Command {
  return (state, dispatch) => {
    const t = state.doc.nodeAt(tablePos);
    if (t?.type !== table) return false;
    const cells = grid(t);
    const at = Math.max(0, Math.min(col, cells[0]!.length));
    for (const r of cells) r.splice(at, 0, emptyCell(null));
    dispatch?.(rebuild(state, tablePos, cells, row, at));
    return true;
  };
}

/** The table at `tablePos` taken out, an empty paragraph in its place with the caret. */
function dropTable(state: EditorState, tablePos: number, dispatch?: (tr: Transaction) => void): boolean {
  const t = state.doc.nodeAt(tablePos)!;
  const tr = state.tr.replaceWith(tablePos, tablePos + t.nodeSize, paragraph.create());
  dispatch?.(tr.setSelection(TextSelection.create(tr.doc, tablePos + 1)).scrollIntoView());
  return true;
}

/** Row `row` taken out (the header too: the row under it becomes the header); the only row takes the table with it. */
export function deleteRow(tablePos: number, row: number): Command {
  return (state, dispatch) => {
    const t = state.doc.nodeAt(tablePos);
    if (t?.type !== table) return false;
    const cells = grid(t);
    if (cells.length <= 1) return dropTable(state, tablePos, dispatch);
    // the header's alignment stays with the columns
    const align = cells[0]!.map((c) => c.attrs.align as Align);
    cells.splice(row, 1);
    cells[0] = cells[0]!.map((c, i) => (c.attrs.align === align[i] ? c : tableCell.create({ align: align[i] ?? null }, c.content)));
    dispatch?.(rebuild(state, tablePos, cells, Math.min(row, cells.length - 1), 0, true));
    return true;
  };
}

/** Column `col` taken out; the only column takes the table with it. */
export function deleteColumn(tablePos: number, col: number): Command {
  return (state, dispatch) => {
    const t = state.doc.nodeAt(tablePos);
    if (t?.type !== table) return false;
    const cells = grid(t);
    if (cells[0]!.length <= 1) return dropTable(state, tablePos, dispatch);
    for (const r of cells) r.splice(col, 1);
    dispatch?.(rebuild(state, tablePos, cells, 0, Math.min(col, cells[0]!.length - 1), true));
    return true;
  };
}

/** Column `col` aligned (`null` for none); the delimiter row writes it. */
export function alignColumn(tablePos: number, col: number, align: Align): Command {
  return (state, dispatch) => {
    const t = state.doc.nodeAt(tablePos);
    if (t?.type !== table) return false;
    if (dispatch) {
      const tr = state.tr;
      t.forEach((_r, _o, r) => {
        const pos = cellStart(t, tablePos, r, col) - 1;
        tr.setNodeMarkup(pos, undefined, { align });
      });
      dispatch(tr);
    }
    return true;
  };
}

/** ⌘⏎ in a cell: a row under the caret's, the caret in it. */
export const rowBelow: Command = (state, dispatch) => {
  const at = cellAt(state);
  if (!at) return false;
  return addRow(at.tablePos, at.row + 1, at.col)(state, dispatch);
};

// ── the cell the caret is in: lit, with its menu ─────────────────

export const tableKey = new PluginKey<DecorationSet>('table');

/**
 * The current cell's mark (`tb-cur`), drawn while the caret is in a table.
 * Its menu's handle is the table view's own, outside the cells: a widget
 * inside an empty cell took WebKit's typed text (41's window run 4).
 */
function cellDecorations(state: EditorState): DecorationSet {
  const at = cellAt(state);
  if (!at || !state.selection.$from.sameParent(state.selection.$to)) return DecorationSet.empty;
  const start = cellStart(at.table, at.tablePos, at.row, at.col);
  const cell = at.table.child(at.row).child(at.col);
  return DecorationSet.create(state.doc, [Decoration.node(start - 1, start - 1 + cell.nodeSize, { class: 'tb-cur' })]);
}

export const tablePlugin = new Plugin<DecorationSet>({
  key: tableKey,
  state: {
    init: (_c, state) => cellDecorations(state),
    apply: (tr, cur, _old, state) => (tr.docChanged || tr.selectionSet ? cellDecorations(state) : cur),
  },
  props: {
    decorations(state) {
      return tableKey.getState(state) ?? null;
    },
  },
});

/** The table at `tablePos` taken out, an empty paragraph with the caret where it was (the menu's `delete table`). */
export function deleteTable(tablePos: number): Command {
  return (state, dispatch) => {
    if (state.doc.nodeAt(tablePos)?.type !== table) return false;
    return dropTable(state, tablePos, dispatch);
  };
}

/**
 * A `rows` × `cols` table (its first row the header), empty, the caret in
 * its first cell: in place of the caret's paragraph when that is empty,
 * else as a block of its own after the top-level block the caret is in.
 * False inside a table (a table holds no table) or where no block goes.
 */
export function insertTable(rows = 2, cols = 2): Command {
  return (state, dispatch) => {
    if (cellAt(state) !== null) return false;
    const $from = state.selection.$from;
    const cells = Array.from({ length: Math.max(1, rows) }, () => Array.from({ length: Math.max(1, cols) }, () => emptyCell(null)));
    const t = table.create({ src: null }, cells.map((r) => tableRow.create(null, r)));
    const top = $from.depth >= 1 ? $from.node(1) : null;
    let at: number;
    let tr: Transaction;
    if (top && top.type === paragraph && top.content.size === 0) {
      at = $from.before(1);
      tr = state.tr.replaceWith(at, at + top.nodeSize, t);
    } else {
      at = $from.depth >= 1 ? $from.after(1) : state.doc.content.size;
      tr = state.tr.insert(at, t);
    }
    if (!dispatch) return true;
    dispatch(tr.setSelection(TextSelection.create(tr.doc, cellStart(t, at, 0, 0))).scrollIntoView());
    return true;
  };
}
