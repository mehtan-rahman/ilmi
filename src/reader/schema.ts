// The ProseMirror schema for a document body. One node kind per block kind
// in FORMAT.md §4, plus an inline math atom. Cards are atoms: they travel
// through the editor untouched and come back out verbatim. A raw block that
// is fenced code, a list, a block quote, or a pipe table is edited as
// itself (`raw.ts` holds the lossless pair); any other raw block stays an
// atom.

import { Schema } from 'prosemirror-model';
import type { Card } from '../format/index.js';

/** The first word of a fence line's info string, `''` when none. */
export const langOf = (fence: string): string => (/^ {0,3}(?:`{3,}|~{3,})(.*)$/.exec(fence)?.[1] ?? '').trim().split(/\s+/)[0] ?? '';

/** How wide an item's indentation reads, a tab as four. */
export const indentWidth = (indent: string): number => indent.replace(/\t/g, '    ').length;

export const schema = new Schema({
  nodes: {
    doc: { content: 'block+' },
    // first in the group, so Enter at the end of a heading makes a paragraph
    // Every textblock a soft line break can live in is `whitespace: 'pre'`:
    // when the browser types into a line after one, ProseMirror reads the
    // block back from the DOM and would otherwise turn the newline into a
    // space, joining the file's lines (milestone 46). The surface is
    // `pre-wrap` already, so the break is drawn as it always was.
    paragraph: {
      group: 'block',
      content: 'inline*',
      whitespace: 'pre',
      attrs: { id: { default: null }, extracts: { default: null } },
      toDOM(n) {
        const extracts = n.attrs.extracts as string[] | null;
        return ['p', { class: 'dd-p' + (extracts?.length ? ' extracted' : '') }, 0];
      },
    },
    // a setext heading may run over lines
    heading: {
      group: 'block',
      content: 'inline*',
      whitespace: 'pre',
      defining: true,
      attrs: { level: { default: 2 }, setext: { default: false } },
      toDOM(n) { return [`h${n.attrs.level as number}`, { class: 'dd-h' }, 0]; },
    },
    card: {
      group: 'block',
      atom: true,
      selectable: true,
      draggable: false,
      /** The format's Card block, verbatim. */
      attrs: { card: {} },
      leafText: (n) => (n.attrs.card as Card).text,
      toDOM(n) { return ['div', { class: 'card-span', contenteditable: 'false' }, (n.attrs.card as Card).text]; },
    },
    raw: {
      group: 'block',
      atom: true,
      selectable: true,
      draggable: false,
      /** `joined`: a piece of a list a card item split, written directly under the block before (FORMAT.md §5.2). */
      attrs: { text: {}, joined: { default: false } },
      leafText: (n) => n.attrs.text as string,
      toDOM(n) { return ['pre', { class: 'raw', contenteditable: 'false' }, n.attrs.text as string]; },
    },
    /** Fenced code: the lines between the fences as its text, the fence lines kept as they were written. */
    code_block: {
      group: 'block',
      content: 'text*',
      marks: '',
      code: true,
      defining: true,
      /** `fence`: the opening line verbatim; `close`: the closing line verbatim, null when the fence never closed. */
      attrs: { fence: {}, close: { default: null }, joined: { default: false } },
      toDOM(n) {
        const lang = langOf(n.attrs.fence as string);
        return ['pre', { class: 'dd-code', 'data-lang': lang }, ['code', { class: lang ? `language-${lang}` : null }, 0]];
      },
    },
    /** A list: its items in file order, each with its own indentation and marker, nesting read from the indentation. */
    list: {
      group: 'block',
      content: 'list_item+',
      /** As on `raw`: the rest of a list after a card item, written directly under it. */
      attrs: { joined: { default: false } },
      toDOM() { return ['div', { class: 'dd-list' }, 0]; },
    },
    list_item: {
      content: 'inline*',
      defining: true,
      whitespace: 'pre',
      /** `indent`: the whitespace before the marker; `marker`: `- `, `1. `, as written, with the whitespace after it; `task`: the box's character, null when the item has none. */
      attrs: { indent: { default: '' }, marker: { default: '- ' }, task: { default: null } },
      toDOM(n) {
        const marker = n.attrs.marker as string;
        const task = n.attrs.task as string | null;
        return ['div', { class: 'dd-li', 'data-marker': marker.trim(), 'data-task': task, style: `--indent:${indentWidth(n.attrs.indent as string)}` }, 0];
      },
    },
    /** A block quote: one node per line, the `> ` kept per line. */
    quote: {
      group: 'block',
      content: 'quote_line+',
      attrs: { joined: { default: false } },
      toDOM() { return ['blockquote', { class: 'dd-quote' }, 0]; },
    },
    quote_line: {
      content: 'inline*',
      defining: true,
      whitespace: 'pre',
      /** The line's `> ` as written; `''` on a lazy continuation line. */
      attrs: { prefix: { default: '> ' } },
      toDOM() { return ['div', { class: 'dd-ql' }, 0]; },
    },
    /**
     * A GFM pipe table edited as itself: rows of cells, the first row the
     * header. `src`: the table's text as read, written back unchanged while
     * no cell, alignment, row or column has changed (raw.ts).
     */
    table: {
      group: 'block',
      content: 'table_row+',
      isolating: true,
      attrs: { src: { default: null }, joined: { default: false } },
      toDOM() { return ['div', { class: 'dd-table' }, ['table', ['tbody', 0]]]; },
    },
    table_row: {
      content: 'table_cell+',
      toDOM() { return ['tr', 0]; },
    },
    /** One cell: its text inline, the column's alignment kept on every cell of the column. */
    table_cell: {
      content: 'inline*',
      isolating: true,
      // a cell's line break (⇧⏎, `<br>` in the file) is a newline in its text: read back from the DOM as one, not as a space
      whitespace: 'pre',
      attrs: { align: { default: null } },
      toDOM(n) {
        const align = n.attrs.align as string | null;
        return ['td', align ? { style: `text-align:${align}` } : {}, 0];
      },
    },
    text: { group: 'inline' },
    math: {
      group: 'inline',
      inline: true,
      atom: true,
      selectable: true,
      draggable: false,
      /** As written: `$…$` or `$$…$$`. */
      attrs: { raw: {} },
      leafText: (n) => n.attrs.raw as string,
      toDOM(n) { return ['span', { class: 'math', contenteditable: 'false' }, n.attrs.raw as string]; },
    },
  },
});

export type NodeName = keyof typeof schema.nodes;
