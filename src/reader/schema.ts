// The ProseMirror schema for a document body. One node kind per block kind
// in FORMAT.md §4, plus an inline math atom. Cards are atoms: they travel
// through the editor untouched and come back out verbatim. A raw block that
// is fenced code, a list, or a block quote is edited as itself (`raw.ts`
// holds the lossless pair); any other raw block stays an atom.

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
    paragraph: {
      group: 'block',
      content: 'inline*',
      attrs: { id: { default: null }, extracts: { default: null } },
      toDOM(n) {
        const extracts = n.attrs.extracts as string[] | null;
        return ['p', { class: 'dd-p' + (extracts?.length ? ' extracted' : '') }, 0];
      },
    },
    heading: {
      group: 'block',
      content: 'inline*',
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
      attrs: { text: {} },
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
      attrs: { fence: {}, close: { default: null } },
      toDOM(n) {
        const lang = langOf(n.attrs.fence as string);
        return ['pre', { class: 'dd-code', 'data-lang': lang }, ['code', { class: lang ? `language-${lang}` : null }, 0]];
      },
    },
    /** A list: its items in file order, each with its own indentation and marker, nesting read from the indentation. */
    list: {
      group: 'block',
      content: 'list_item+',
      toDOM() { return ['div', { class: 'dd-list' }, 0]; },
    },
    list_item: {
      content: 'inline*',
      defining: true,
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
      toDOM() { return ['blockquote', { class: 'dd-quote' }, 0]; },
    },
    quote_line: {
      content: 'inline*',
      defining: true,
      /** The line's `> ` as written; `''` on a lazy continuation line. */
      attrs: { prefix: { default: '> ' } },
      toDOM() { return ['div', { class: 'dd-ql' }, 0]; },
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
