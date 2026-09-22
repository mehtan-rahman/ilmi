// The ProseMirror schema for a document body. One node kind per block kind
// in FORMAT.md §4, plus an inline math atom. Cards and raw blocks are atoms:
// they travel through the editor untouched and come back out verbatim.

import { Schema } from 'prosemirror-model';
import type { Card } from '../format/index.js';

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
