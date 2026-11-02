// A book's notes (milestone 48): under each section heading that comes back
// (FORMAT.md §6.5), a chip drawn at the heading's end — show in book, show
// boxes here, and when it is next — and, while asked for, the section's
// boxed crops drawn under the heading. Widgets only: the file holds the
// heading and its line, nothing of this. The app builds the DOM (it has the
// PDF and the store); this plugin places it and redraws on a change.

import { Plugin, PluginKey, type EditorState, type Transaction } from 'prosemirror-state';
import { Decoration, DecorationSet } from 'prosemirror-view';
import type { Node as PMNode } from 'prosemirror-model';
import type { SectionSchedule } from '../format/index.js';

export interface BookOptions {
  /** The chip at a heading's end, for a heading whose section comes back (or was dismissed with its boxes). */
  chip(read: SectionSchedule, text: string): HTMLElement;
  /** What makes a chip's DOM stale: its words and its buttons' state. */
  chipKey(read: SectionSchedule, text: string): string;
  /** Whether the section's boxes are drawn under its heading. */
  shown(text: string): boolean;
  /** The section's crops, page breaks marked, drawn under its heading. */
  crops(read: SectionSchedule, text: string): HTMLElement;
}

/** Dispatch `tr.setMeta(bookKey, 'redraw')` when what the chips say has changed outside the document (the day, `show boxes here`). */
export const bookKey = new PluginKey<DecorationSet>('book');

function build(doc: PMNode, o: BookOptions): DecorationSet {
  const decos: Decoration[] = [];
  doc.forEach((node, off) => {
    if (node.type.name !== 'heading') return;
    const read = node.attrs.read as SectionSchedule | null;
    const text = node.textContent;
    if (!read || !text.trim()) return;
    const key = o.chipKey(read, text);
    decos.push(Decoration.widget(off + node.nodeSize - 1, () => o.chip(read, text), { side: 1, key: `chip\u0000${text}\u0000${key}`, ignoreSelection: true, stopEvent: () => true }));
    if (read.boxes !== undefined && o.shown(text)) {
      decos.push(Decoration.widget(off + node.nodeSize, () => o.crops(read, text), { side: -1, key: `crops\u0000${text}\u0000${read.boxes}`, ignoreSelection: true, stopEvent: () => true }));
    }
  });
  return DecorationSet.create(doc, decos);
}

export function bookPlugin(o: BookOptions): Plugin<DecorationSet> {
  return new Plugin<DecorationSet>({
    key: bookKey,
    state: {
      init: (_config, state: EditorState) => build(state.doc, o),
      apply: (tr: Transaction, set: DecorationSet, _old: EditorState, state: EditorState) => (tr.docChanged || tr.getMeta(bookKey) === 'redraw' ? build(state.doc, o) : set),
    },
    props: { decorations: (state) => bookKey.getState(state) },
  });
}
