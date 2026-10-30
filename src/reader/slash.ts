// The slash menu: `/` typed at a block's start or after a space opens a
// list of what can go in there, filtered as more is typed; ↑↓ move, ⏎ or
// Tab picks, Esc leaves the `/` as typed. Each row names its Markdown and
// its key, so the menu teaches the rules and keys it stands for. Picking
// takes the `/query` out and does the row's work in the same step, so one
// ⌘Z puts the typed text back. Block rows turn the block the caret is in
// (headings, lists, a quote: the commands the keys run); insert rows put a
// block in (code, a display formula, a rule, a table, an image); the card
// rows turn the paragraph into a card's shape.

import type { Node as PMNode } from 'prosemirror-model';
import { EditorState, Plugin, PluginKey, Selection, TextSelection, type Command, type Transaction } from 'prosemirror-state';
import { closeHistory } from 'prosemirror-history';
import type { EditorView } from 'prosemirror-view';
import { nextGroup } from '../format/index.js';
import { flatText, setHeading, toggleList, toggleQuote } from './commands.js';
import { flatRanges, inlineRanges } from './inline.js';
import { caretInto, insertBlocks } from './insert.js';
import { rawToNode } from './raw.js';
import { schema } from './schema.js';

const { paragraph, heading, code_block, raw, math, list_item, quote_line } = schema.nodes;

/** Where the caret is, as the menu cares: what the rows may do there. */
export type SlashContext = 'paragraph' | 'heading' | 'item' | 'quote' | 'other';

export interface SlashItem {
  id: string;
  label: string;
  /** The Markdown it writes, shown on its row. */
  md: string;
  /** Its key, when it has one. */
  key?: string;
  aliases: string[];
  /** Where it is offered. */
  where: SlashContext[];
}

const ALL: SlashContext[] = ['paragraph', 'heading', 'item', 'quote', 'other'];
const TEXT: SlashContext[] = ['paragraph', 'heading', 'item', 'quote'];

export const SLASH_ITEMS: SlashItem[] = [
  { id: 'h1', label: 'heading 1', md: '#', key: '⌘1', aliases: ['h1', 'title'], where: TEXT },
  { id: 'h2', label: 'heading 2', md: '##', key: '⌘2', aliases: ['h2', 'subtitle'], where: TEXT },
  { id: 'h3', label: 'heading 3', md: '###', key: '⌘3', aliases: ['h3'], where: TEXT },
  { id: 'bullet', label: 'bullet list', md: '-', key: '⌘⇧8', aliases: ['ul', 'list', 'bullets', 'unordered'], where: ['paragraph', 'item'] },
  { id: 'ordered', label: 'numbered list', md: '1.', key: '⌘⇧7', aliases: ['ol', 'numbers', 'ordered'], where: ['paragraph', 'item'] },
  { id: 'task', label: 'task list', md: '[ ]', key: '⌘⇧9', aliases: ['todo', 'checkbox', 'tasks'], where: ['paragraph', 'item'] },
  { id: 'quote', label: 'quote', md: '>', key: '⌘⇧.', aliases: ['blockquote'], where: ['paragraph', 'quote'] },
  { id: 'code', label: 'code', md: '```', aliases: ['fence', 'pre', 'snippet'], where: ALL },
  { id: 'math', label: 'math block', md: '$$', aliases: ['formula', 'equation', 'latex', 'tex', 'display'], where: ALL },
  { id: 'rule', label: 'divider', md: '---', aliases: ['rule', 'hr', 'line', 'separator'], where: ALL },
  { id: 'table', label: 'table', md: '| |', aliases: ['grid', 'columns'], where: ALL },
  { id: 'image', label: 'image', md: '![]()', aliases: ['picture', 'img', 'figure', 'photo'], where: ALL },
  { id: 'cloze', label: 'cloze', md: '{{c1::}}', aliases: ['blank', 'card', 'gap'], where: ['paragraph'] },
  { id: 'qa', label: 'q&a', md: '::', aliases: ['question', 'answer', 'card', 'qa', 'front', 'back'], where: ['paragraph'] },
  { id: 'both', label: 'both ways', md: ':::', aliases: ['reverse', 'bidirectional', 'card', 'two ways'], where: ['paragraph'] },
];

/** How well `q` names `item`: lower is better, null when it does not. */
function rank(item: SlashItem, q: string): number | null {
  if (!q) return 0;
  const label = item.label;
  if (label.startsWith(q)) return 0;
  if (item.aliases.some((a) => a.startsWith(q))) return 1;
  if (label.split(/\s+/).some((w) => w.startsWith(q))) return 1;
  if (label.includes(q) || item.md === q) return 2;
  // the letters in order, as an abbreviation types them
  let i = 0;
  for (const c of label) if (c === q[i]) i++;
  return i === q.length ? 3 : null;
}

/** The rows for `query` where the caret is, best first, the menu's order kept among equals. */
export function slashItems(query: string, where: SlashContext): SlashItem[] {
  const q = query.toLowerCase().trim();
  return SLASH_ITEMS
    .filter((it) => it.where.includes(where))
    .map((it, i) => ({ it, i, r: rank(it, q) }))
    .filter((x): x is { it: SlashItem; i: number; r: number } => x.r !== null)
    .sort((a, b) => a.r - b.r || a.i - b.i)
    .map((x) => x.it);
}

/** What the caret's block is to the menu. */
export function slashContext(state: EditorState): SlashContext {
  const { $from } = state.selection;
  const p = $from.parent;
  if (p.type === paragraph) return $from.depth === 1 ? 'paragraph' : 'other';
  if (p.type === heading) return 'heading';
  if (p.type === list_item) return 'item';
  if (p.type === quote_line) return 'quote';
  return 'other';
}

// ── the plugin: open, the query, the row ─────────────────────────

/** The menu while it is open: where its `/` is, what follows it, which row is lit. */
export interface SlashState {
  from: number;
  query: string;
  index: number;
}

export const slashKey = new PluginKey<SlashState | null>('slash');

/** `tr.setMeta(slashKey, …)`: open at a `/`, move the lit row, or close. */
export type SlashMeta = { open: number } | { move: 1 | -1 } | 'close';

/** Can a `/` typed at `pos` open the menu: in prose, at its block's start or after whitespace, not in inline code? */
export function opensAt(state: EditorState, pos: number): boolean {
  const $pos = state.doc.resolve(pos);
  const block = $pos.parent;
  if (!block.isTextblock || block.type.spec.code === true) return false;
  const text = flatText(block);
  const off = $pos.parentOffset;
  if (off > 0 && !/\s/.test(text[off - 1]!)) return false;
  return !flatRanges(inlineRanges(text)).some((r) => r.kind === 'code' && r.from < off && off < r.to);
}

/** The menu's state after `tr`, read off the document: closed when its `/` is gone or the caret has left the query. */
function follow(cur: SlashState, tr: Transaction, state: EditorState): SlashState | null {
  const mapped = tr.mapping.mapResult(cur.from, 1);
  if (mapped.deleted) return null;
  const from = mapped.pos;
  const sel = state.selection;
  if (!sel.empty || from >= state.doc.content.size) return null;
  const $from = state.doc.resolve(from);
  if (!$from.parent.isTextblock || sel.from <= from || sel.$from.parent !== $from.parent) return null;
  if (state.doc.textBetween(from, from + 1) !== '/') return null;
  const query = state.doc.textBetween(from + 1, sel.from, '\n', '\n');
  if (query.includes('\n') || query.length > 24) return null;
  const items = slashItems(query, slashContext(state));
  // a space after a query nothing answers to: the `/` was only a slash
  if (!items.length && /\s/.test(query)) return null;
  return { from, query, index: query === cur.query ? Math.min(cur.index, Math.max(0, items.length - 1)) : 0 };
}

/** The `/` and the query typed after it are taken out, then the row does its work; one step of the history. */
export function pickSlash(item: SlashItem, opts: SlashOptions = {}): Command {
  return (state, dispatch) => {
    const s = slashKey.getState(state);
    if (!s) return false;
    if (!dispatch) return true;
    // a step of its own in the history: ⌘Z after a pick puts back the `/query` as typed
    const tr = closeHistory(state.tr).delete(s.from, state.selection.from).setMeta(slashKey, 'close' satisfies SlashMeta);
    run(item, tr, opts);
    dispatch(tr.scrollIntoView());
    return true;
  };
}

/** A block command run on the transaction's document as it stands, its steps added to `tr`. */
function through(tr: Transaction, cmd: Command): void {
  const s = EditorState.create({ doc: tr.doc, selection: tr.selection });
  let out: Transaction | null = null;
  cmd(s, (t) => { out = t; });
  const done = out as Transaction | null;
  if (!done) return;
  for (const step of done.steps) tr.step(step);
  tr.setSelection(Selection.fromJSON(tr.doc, done.selection.toJSON()));
}

export interface SlashOptions {
  /** A display formula put in: its editor opened (the chip at `pos`). */
  openMath?: (tr: Transaction, pos: number) => void;
}

/** An empty GFM table of two columns and one row: a table the file reads back as one. */
export const TABLE_SKELETON = '|  |  |\n| --- | --- |\n|  |  |';

/** Set on the transaction when the image row was picked: the reader asks for the file and puts it in at the caret. */
export const askImageKey = new PluginKey('askImage');

function run(item: SlashItem, tr: Transaction, opts: SlashOptions): void {
  switch (item.id) {
    case 'h1': case 'h2': case 'h3':
      through(tr, setHeading(Number(item.id[1])));
      return;
    case 'bullet': case 'ordered': case 'task':
      through(tr, toggleList(item.id === 'bullet' ? 'bullet' : item.id === 'ordered' ? 'ordered' : 'task'));
      return;
    case 'quote':
      through(tr, toggleQuote);
      return;
    case 'code': {
      const at = insertBlocks(tr, [code_block!.create({ fence: '```', close: '```' })]);
      caretInto(tr, at);
      return;
    }
    case 'math': {
      const at = insertBlocks(tr, [paragraph!.create(null, math!.create({ raw: '$$ $$' }))]);
      tr.setSelection(TextSelection.create(tr.doc, at + 2));
      opts.openMath?.(tr, at + 1);
      return;
    }
    case 'rule': {
      const block = raw!.create({ text: '---' });
      const at = insertBlocks(tr, [block, paragraph!.create()]);
      caretInto(tr, at + block.nodeSize);
      return;
    }
    case 'table': {
      // edited as a table: the caret in the header's first cell
      const block = rawToNode(TABLE_SKELETON)!;
      const at = insertBlocks(tr, [block, paragraph!.create()]);
      tr.setSelection(TextSelection.create(tr.doc, at + 3));
      return;
    }
    case 'image':
      tr.setMeta(askImageKey, true);
      return;
    case 'cloze': {
      const { $from } = tr.selection;
      const n = nextGroup(flatText($from.parent));
      const open = `{{c${n}::`;
      tr.insertText(`${open}}}`, $from.pos);
      tr.setSelection(TextSelection.create(tr.doc, $from.pos + open.length));
      return;
    }
    case 'qa': case 'both': {
      const { $from } = tr.selection;
      const node: PMNode = $from.parent;
      const sep = item.id === 'qa' ? ' :: ' : ' ::: ';
      const start = $from.start();
      const text = flatText(node);
      if (!text.trim()) {
        // nothing to ask yet: the front typed first, the separator waiting after it
        tr.insertText(sep, start, start + node.content.size);
        tr.setSelection(TextSelection.create(tr.doc, start));
        return;
      }
      // the paragraph is the front; the caret after the separator, for the back
      const keep = text.replace(/\s+$/, '').length;
      tr.insertText(sep, start + keep, start + node.content.size);
      tr.setSelection(TextSelection.create(tr.doc, start + keep + sep.length));
      return;
    }
  }
}

/** The lit row of the open menu, or null. */
export function litItem(state: EditorState): SlashItem | null {
  const s = slashKey.getState(state);
  if (!s) return null;
  return slashItems(s.query, slashContext(state))[s.index] ?? null;
}

export const slashPlugin = (opts: SlashOptions = {}): Plugin<SlashState | null> =>
  new Plugin<SlashState | null>({
    key: slashKey,
    state: {
      init: () => null,
      apply(tr, cur, _old, state) {
        const meta = tr.getMeta(slashKey) as SlashMeta | undefined;
        if (meta === 'close') return null;
        if (meta && 'open' in meta) return { from: meta.open, query: '', index: 0 };
        if (!cur) return null;
        if (meta && 'move' in meta) {
          const n = slashItems(cur.query, slashContext(state)).length;
          return n ? { ...cur, index: (cur.index + meta.move + n) % n } : cur;
        }
        if (!tr.docChanged && !tr.selectionSet) return cur;
        return follow(cur, tr, state);
      },
    },
    props: {
      handleTextInput(view: EditorView, from: number, to: number, text: string) {
        if (text !== '/' || !view.editable || view.composing || from !== to || !opensAt(view.state, from)) return false;
        view.dispatch(view.state.tr.insertText('/', from, to).setMeta(slashKey, { open: from } satisfies SlashMeta));
        return true;
      },
      handleKeyDown(view: EditorView, event: KeyboardEvent) {
        const s = slashKey.getState(view.state);
        if (!s || event.metaKey || event.ctrlKey || event.altKey) return false;
        if (event.key === 'ArrowDown' || event.key === 'ArrowUp') {
          view.dispatch(view.state.tr.setMeta(slashKey, { move: event.key === 'ArrowDown' ? 1 : -1 } satisfies SlashMeta));
          return true;
        }
        if (event.key === 'Escape') {
          view.dispatch(view.state.tr.setMeta(slashKey, 'close' satisfies SlashMeta));
          return true;
        }
        if ((event.key === 'Enter' || event.key === 'Tab') && !event.shiftKey) {
          const item = litItem(view.state);
          if (!item) {
            // nothing answers: ⏎ is ⏎ again
            view.dispatch(view.state.tr.setMeta(slashKey, 'close' satisfies SlashMeta));
            return false;
          }
          return pickSlash(item, opts)(view.state, view.dispatch);
        }
        return false;
      },
      handleDOMEvents: {
        blur(view) {
          if (slashKey.getState(view.state)) view.dispatch(view.state.tr.setMeta(slashKey, 'close' satisfies SlashMeta));
          return false;
        },
      },
    },
  });
