// Putting blocks into the page: what the slash menu inserts, an image that
// landed beside the note, and pasted text. Pasted text is Markdown by the
// format's own reading (`parse`), so a list pasted is a list and a heading
// a heading, exactly as the file would read it; HTML is reduced to that
// Markdown first (`pasteMarkdown`, src/import/paste.ts). Copying writes
// the Markdown source as the plain text, so a copy from one page pasted in
// another lands as the same blocks.

import { Fragment, Slice, type Node as PMNode, type NodeType } from 'prosemirror-model';
import { Selection, TextSelection, type EditorState, type Transaction } from 'prosemirror-state';
import { formatBody, parse, type Block } from '../format/index.js';
import { fromDoc, toDoc } from './convert.js';
import { htmlMarkdown } from '../import/paste.js';
import { schema } from './schema.js';

const { paragraph, list, list_item, quote, quote_line, doc: docType } = schema.nodes as Record<'paragraph' | 'list' | 'list_item' | 'quote' | 'quote_line' | 'doc', NodeType>;

/**
 * `nodes` put into the page at the selection: in place of an empty
 * paragraph; before or after a paragraph when the caret is at its start or
 * end; between its halves when the caret is inside it; after the block
 * the caret is in otherwise (a heading, an item, a quote line). Resolves to
 * where the first node starts.
 */
export function insertBlocks(tr: Transaction, nodes: PMNode[]): number {
  const { $from } = tr.selection;
  const top = $from.depth >= 1 ? $from.node(1) : null;
  if ($from.depth === 1 && top?.type === paragraph) {
    const pos = $from.before(1);
    if (top.content.size === 0) {
      tr.replaceWith(pos, pos + top.nodeSize, nodes);
      return pos;
    }
    if ($from.parentOffset === 0) {
      tr.insert(pos, nodes);
      return pos;
    }
    if ($from.parentOffset === top.content.size) {
      tr.insert(pos + top.nodeSize, nodes);
      return pos + top.nodeSize;
    }
    tr.split($from.pos);
    const at = $from.pos + 1;
    tr.insert(at, nodes);
    return at;
  }
  const after = $from.depth >= 1 ? $from.after(1) : tr.doc.content.size;
  tr.insert(after, nodes);
  return after;
}

/** The caret into the textblock that starts at `pos` (or the nearest one after it), at `offset`. */
export function caretInto(tr: Transaction, pos: number, offset = 0): Transaction {
  const $pos = tr.doc.resolve(Math.min(pos + 1 + offset, tr.doc.content.size));
  return tr.setSelection($pos.parent.isTextblock ? TextSelection.create(tr.doc, $pos.pos) : Selection.near($pos));
}

/** An image alone in a paragraph: drawn as a figure. `src` is written as given (encoded already). */
export const imageParagraph = (src: string, alt = ''): PMNode => paragraph.create(null, schema.text(`![${alt.replace(/[[\]]/g, '')}](${src})`));

/**
 * The images at `srcs` (relative to the document, encoded) put in as
 * paragraphs of their own at the selection, an empty paragraph after them
 * to go on in. The caret goes there.
 */
export function insertImages(state: EditorState, srcs: string[]): Transaction {
  const tr = state.tr;
  const nodes = [...srcs.map((s) => imageParagraph(s)), paragraph.create()];
  const at = insertBlocks(tr, nodes);
  const end = at + nodes.slice(0, -1).reduce((n, x) => n + x.nodeSize, 0);
  return caretInto(tr, end).scrollIntoView();
}

/** The blocks Markdown text reads as, by the format's own parser; never front-matter, whatever its first line. */
export function markdownBlocks(md: string): Block[] {
  return parse(`\n${md.replace(/\r\n?/g, '\n')}`).doc.blocks;
}

/**
 * Markdown pasted at the selection. In code it is the text as it is. Read
 * as a single paragraph, it is typed in where the caret is; otherwise its
 * blocks go in, a paragraph at either end running into the text around
 * the caret. Null when there is nothing to paste.
 */
export function pasteMarkdown(state: EditorState, md: string): Transaction | null {
  const sel = state.selection;
  if (sel.$from.parent.type.spec.code === true) return md ? state.tr.insertText(md).scrollIntoView() : null;
  const blocks = markdownBlocks(md);
  if (!blocks.length) return null;
  const one = blocks.length === 1 ? blocks[0]! : null;
  if (one?.kind === 'paragraph' && one.id === undefined && !one.extracts?.length) return state.tr.insertText(one.text).scrollIntoView();
  const content = toDoc(blocks).content;
  const open = (n: PMNode | null) => (n?.type === paragraph ? 1 : 0);
  const slice = new Slice(content, open(content.firstChild), open(content.lastChild));
  return state.tr.replaceSelection(slice).scrollIntoView();
}

/**
 * What a copy puts on the clipboard as text: the Markdown the selected
 * blocks are written as (a card with its schedule lines, a list with its
 * markers, a formula as typed); part of one block is that part's text.
 */
export function clipboardText(slice: Slice): string {
  let content = slice.content;
  let open = Math.min(slice.openStart, slice.openEnd);
  // a selection inside one block comes wrapped in its parents: down to the block it is in
  while (open > 0 && content.childCount === 1 && !content.firstChild!.isTextblock && !content.firstChild!.isLeaf) {
    content = content.firstChild!.content;
    open--;
  }
  const first = content.firstChild;
  if (!first) return '';
  if (content.childCount === 1 && first.isTextblock && open > 0) return textOfInline(first);
  let blocks: Fragment;
  if (first.type === list_item) blocks = Fragment.from(list.create(null, content));
  else if (first.type === quote_line) blocks = Fragment.from(quote.create(null, content));
  else if (first.isInline) blocks = Fragment.from(paragraph.create(null, content));
  else blocks = content;
  let doc: PMNode;
  try {
    doc = docType.create(null, blocks);
    doc.check();
  } catch {
    return slice.content.textBetween(0, slice.content.size, '\n\n', (n) => n.type.spec.leafText?.(n) ?? '');
  }
  return formatBody(fromDoc(doc));
}

/** A textblock's text as written: chips as their source. */
function textOfInline(node: PMNode): string {
  let out = '';
  node.forEach((c) => { out += c.isText ? c.text ?? '' : c.type.spec.leafText?.(c) ?? ''; });
  return out;
}

const IMAGES_ONLY = /^(?:!\[[^\]]*\]\([^)\s]*\)\s*)+$/;

/**
 * Whether a paste that carries image files is the images: its text says
 * nothing else (none at all, an address, or HTML that is only the images);
 * a page fragment with a picture in it pastes as its text instead.
 */
export function htmlPasteImages(html: string, text: string): boolean {
  const md = html ? htmlMarkdown(html) : '';
  if (md) return IMAGES_ONLY.test(md.trim());
  const t = text.trim();
  return !t || /^(?:https?|file):\/\/\S+$/i.test(t);
}
