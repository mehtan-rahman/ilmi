// Editing commands that write Markdown: the format keeps inline Markdown
// as literal text (FORMAT.md §4), so bold is two asterisks put in on each
// side and taken out again, never a mark. Block commands turn paragraphs
// into headings, lists, and quotes and back. Block rules do the same as
// the Markdown is typed (`- `, `1. `, `[ ] `, `> `, `---`; a fence line or
// `$$` then ⏎), and a Backspace right after one puts the typed text back.

import { Fragment, type Node as PMNode, type NodeType } from 'prosemirror-model';
import { InputRule, undoInputRule } from 'prosemirror-inputrules';
import { Plugin, PluginKey, TextSelection, type Command, type EditorState, type Transaction } from 'prosemirror-state';
import { flatRanges, inlineRanges, markerRanges, type InlineKind } from './inline.js';
import { joinLists, leaveBlock, lineBlock, list, list_item, quote, quote_line, renumberList } from './lists.js';
import { markerNumber } from './raw.js';
import { schema } from './schema.js';

const { paragraph, heading, code_block, raw, math } = schema.nodes as Record<'paragraph' | 'heading' | 'code_block' | 'raw' | 'math', NodeType>;

/** A placeholder for an inline atom, so a textblock's text has one character per position. */
const ATOM = '￼';

/** A textblock's text with each chip as one character: offsets are positions from the block's start. */
export function flatText(node: PMNode): string {
  let s = '';
  node.forEach((child) => { s += child.isText ? child.text ?? '' : ATOM; });
  return s;
}

const isCode = (node: PMNode): boolean => node.type.spec.code === true;

/** A paragraph that names itself (`^id`) or holds extracts: turned into anything else it would lose them. */
const anchored = (node: PMNode): boolean => node.type === paragraph && (node.attrs.id !== null || !!(node.attrs.extracts as string[] | null)?.length);

// ── inline: markers in and out ───────────────────────────────────

export type InlineToggle = Extract<InlineKind, 'strong' | 'em' | 'code' | 'strike'>;

const MARKERS: Record<InlineToggle, string> = { strong: '**', em: '*', code: '`', strike: '~~' };

/** The markers to wrap `text` in: a code span's backtick run is one longer than any inside, padded when the text starts or ends with one. */
function wrapFor(kind: InlineToggle, text: string): [string, string] {
  if (kind !== 'code') return [MARKERS[kind], MARKERS[kind]];
  const longest = Math.max(0, ...Array.from(text.matchAll(/`+/g), (m) => m[0].length));
  const run = '`'.repeat(longest + 1);
  const pad = text.startsWith('`') || text.endsWith('`') ? ' ' : '';
  return [run + pad, pad + run];
}

interface Edit {
  at: number;
  del: number;
  ins: string;
}

/**
 * What toggling `kind` over `a`..`b` of a textblock's text does: the
 * innermost range of that kind around the selection loses its markers
 * (for a caret, the range whose text it is in); otherwise the selection,
 * its outer spaces left out, is wrapped, and ranges of the kind inside it
 * lose theirs first; a caret outside any gets an empty pair.
 */
function planInline(text: string, a: number, b: number, kind: InlineToggle): { edits: Edit[]; off: boolean } {
  const ranges = flatRanges(inlineRanges(text)).filter((r) => r.kind === kind);
  const around = ranges
    .filter((r) => (a === b ? r.inner.from <= a && a <= r.inner.to : r.from <= a && b <= r.to && (a < r.inner.to && b > r.inner.from)))
    .sort((x, y) => (x.to - x.from) - (y.to - y.from))[0];
  if (around) return { edits: markerRanges(around).map((m) => ({ at: m.from, del: m.to - m.from, ins: '' })), off: true };
  let s = a;
  let e = b;
  while (s < e && /\s/.test(text[s]!)) s++;
  while (e > s && /\s/.test(text[e - 1]!)) e--;
  const edits: Edit[] = [];
  for (const r of ranges) if (r.from >= s && r.to <= e) for (const m of markerRanges(r)) edits.push({ at: m.from, del: m.to - m.from, ins: '' });
  const [open, close] = wrapFor(kind, text.slice(s, e));
  edits.push({ at: s, del: 0, ins: open }, { at: e, del: 0, ins: close });
  return { edits, off: false };
}

/** The textblocks a selection covers, with the part of each it covers, code left out. */
function segments(state: EditorState): { start: number; node: PMNode; a: number; b: number }[] {
  const { from, to } = state.selection;
  const out: { start: number; node: PMNode; a: number; b: number }[] = [];
  state.doc.nodesBetween(from, to, (node, pos) => {
    if (!node.isTextblock) return true;
    if (!isCode(node)) {
      const start = pos + 1;
      out.push({ start, node, a: Math.max(from, start) - start, b: Math.min(to, start + node.content.size) - start });
    }
    return false;
  });
  return out;
}

/**
 * ⌘B, ⌘I, ⌘E, ⌘⇧X: `**`, `*`, a backtick, `~~` put around the selection,
 * or taken away when the selection is already inside them. Across blocks,
 * each block's part is wrapped; when every part is already wrapped, the
 * markers go. In code nothing changes, and the key is still taken.
 */
export function toggleInline(kind: InlineToggle): Command {
  return (state, dispatch) => {
    if (!(state.selection instanceof TextSelection)) return false;
    const segs = segments(state);
    if (!segs.length) return true;
    const plans = segs.map((s) => ({ ...s, plan: planInline(flatText(s.node), s.a, s.b, kind) }));
    // across blocks: off only when every part is in a range of the kind; else the parts not yet wrapped are
    const off = plans.every((p) => p.plan.off);
    if (!dispatch) return true;
    const tr = state.tr;
    const { anchor, head, empty } = state.selection;
    for (const p of [...plans].reverse()) {
      if (p.plan.off !== off) continue;
      for (const e of [...p.plan.edits].sort((x, y) => y.at - x.at)) {
        const at = p.start + e.at;
        if (e.del) tr.delete(at, at + e.del);
        if (e.ins) tr.insertText(e.ins, at);
      }
    }
    const one = plans.length === 1 ? plans[0]! : null;
    if (one && !off) {
      const open = one.plan.edits[one.plan.edits.length - 2]!;
      const close = one.plan.edits[one.plan.edits.length - 1]!;
      if (empty || open.at === close.at) {
        // a caret between an empty pair, to type into
        tr.setSelection(TextSelection.create(tr.doc, tr.mapping.map(one.start + open.at, -1) + open.ins.length));
      } else {
        // the text that was selected stays selected, its markers outside it
        const inner = tr.mapping.map(one.start + open.at, 1);
        const end = tr.mapping.map(one.start + close.at, -1);
        tr.setSelection(TextSelection.create(tr.doc, anchor <= head ? inner : end, anchor <= head ? end : inner));
      }
    } else {
      tr.setSelection(TextSelection.create(tr.doc, tr.mapping.map(anchor), tr.mapping.map(head)));
    }
    dispatch(tr.scrollIntoView());
    return true;
  };
}

// ── links ────────────────────────────────────────────────────────

/** A link the selection is in or covers, by absolute positions, or the selection to make one of; null for a bare caret outside any link. */
export interface LinkTarget {
  from: number;
  to: number;
  /** The address when the selection is in a link already. */
  href: string | null;
}

/** Where ⌘K acts: the link around the selection, else a selection inside one textblock; null for a caret in no link, or in code. */
export function linkTarget(state: EditorState): LinkTarget | null {
  const sel = state.selection;
  if (!(sel instanceof TextSelection) || !sel.$from.sameParent(sel.$to)) return null;
  const node = sel.$from.parent;
  if (!node.isTextblock || isCode(node)) return null;
  const start = sel.$from.start();
  const a = sel.from - start;
  const b = sel.to - start;
  const link = flatRanges(inlineRanges(flatText(node))).filter((r) => r.kind === 'link').find((r) => r.from <= a && b <= r.to && (a < r.to || a === b));
  if (link && (a !== b || (a > link.from && a < link.to))) return { from: start + link.from, to: start + link.to, href: link.href ?? '' };
  if (sel.empty) return null;
  return { from: sel.from, to: sel.to, href: null };
}

/**
 * The link at `target` given `href`: a selection becomes `[text](href)`,
 * a link has its address replaced; an empty address takes the link away
 * and leaves its text. The text stays selected.
 */
export function setLink(state: EditorState, target: LinkTarget, href: string): Transaction | null {
  const tr = state.tr;
  const dest = href.trim().replace(/\s/g, '%20');
  if (target.href === null) {
    if (!dest) return null;
    tr.insertText(`](${dest})`, target.to).insertText('[', target.from);
    return tr.setSelection(TextSelection.create(tr.doc, target.from + 1, target.to + 1));
  }
  const $start = state.doc.resolve(target.from);
  const start = $start.start();
  const node = $start.parent;
  const link = flatRanges(inlineRanges(flatText(node))).find((r) => r.kind === 'link' && start + r.from === target.from && start + r.to === target.to);
  if (!link) return null;
  if (!dest) {
    tr.delete(start + link.inner.to, start + link.to).delete(start + link.from, start + link.inner.from);
    return tr.setSelection(TextSelection.create(tr.doc, start + link.from, start + link.inner.to - 1));
  }
  // `](` + href + `)`: only the address changes
  tr.insertText(dest, start + link.inner.to + 2, start + link.to - 1);
  return tr.setSelection(TextSelection.create(tr.doc, start + link.inner.from, start + link.inner.to));
}

const URL_ONLY = /^(?:https?:\/\/|mailto:)[^\s<>]+$/i;

/** A pasted address over a selection in prose links the selection; anything else is pasted as it would be. */
export function pasteLink(state: EditorState, text: string): Transaction | null {
  const url = text.trim();
  if (!URL_ONLY.test(url)) return null;
  const target = linkTarget(state);
  if (!target || state.selection.empty) return null;
  return setLink(state, target, url);
}

// ── blocks: headings, lists, quotes ──────────────────────────────

/** The top-level blocks a selection touches, by index. */
function topBlocks(state: EditorState): { index: number; pos: number; node: PMNode }[] {
  const { $from, $to } = state.selection;
  const out: { index: number; pos: number; node: PMNode }[] = [];
  state.doc.forEach((node, off, i) => {
    if (i >= $from.index(0) && i <= $to.index(0)) out.push({ index: i, pos: off, node });
  });
  return out;
}

/**
 * ⌘1–⌘6 a heading of that level, ⌘0 a paragraph: over the paragraphs and
 * headings the selection touches; when they are all headings of that
 * level already, they go back to paragraphs. A list item or quote line
 * leaves its block first. A paragraph with an id or extracts stays.
 */
export function setHeading(level: number): Command {
  return (state, dispatch) => {
    if (lineBlock(state.selection)) {
      if (!dispatch) return true;
      let left: Transaction | null = null;
      leaveBlock(state, (t) => { left = t; });
      const tr = left as Transaction | null;
      if (!tr) return true;
      if (level > 0) tr.setNodeMarkup(tr.selection.$from.before(), heading, { level, setext: false });
      dispatch(tr);
      return true;
    }
    const blocks = topBlocks(state).filter((b) => b.node.type === paragraph || b.node.type === heading);
    if (!blocks.length) return true;
    const off = level === 0 || blocks.every((b) => b.node.type === heading && b.node.attrs.level === level);
    if (!dispatch) return true;
    const tr = state.tr;
    for (const b of blocks) {
      if (off) {
        if (b.node.type === heading) tr.setNodeMarkup(b.pos, paragraph, { id: null, extracts: null });
      } else if (!anchored(b.node)) {
        const setext = b.node.type === heading && b.node.attrs.setext === true && level <= 2;
        tr.setNodeMarkup(b.pos, heading, { level, setext });
      }
    }
    if (tr.docChanged) dispatch(tr.scrollIntoView());
    return true;
  };
}

export type ListKind = 'bullet' | 'ordered' | 'task';

const kindOf = (item: PMNode): ListKind => (item.attrs.task !== null ? 'task' : markerNumber(item.attrs.marker as string) !== null ? 'ordered' : 'bullet');

const itemAttrs = (kind: ListKind, n: number) => ({
  indent: '',
  marker: kind === 'ordered' ? `${n}. ` : '- ',
  task: kind === 'task' ? ' ' : null,
});

/**
 * The paragraphs at `blocks` (top-level, in order, next to each other)
 * replaced by one list of `kind`, one item each, joined onto a list just
 * before or after; the selection kept on the same text.
 */
function paragraphsToList(state: EditorState, blocks: { pos: number; node: PMNode }[], kind: ListKind): Transaction {
  const tr = state.tr;
  const first = blocks[0]!.pos;
  const last = blocks[blocks.length - 1]!;
  const items = blocks.map((b, k) => list_item.create(itemAttrs(kind, k + 1), b.node.content));
  tr.replaceWith(first, last.pos + last.node.nodeSize, list.create(null, items));
  // an item is the size of its paragraph: what was inside moves one in, past the list's start
  const { anchor, head } = state.selection;
  tr.setSelection(TextSelection.create(tr.doc, anchor + 1, head + 1));
  joinLists(tr, first);
  const listPos = tr.selection.$from.before(1);
  if (kind === 'ordered') renumberList(tr, listPos);
  return tr;
}

/**
 * ⌘⇧8 bullets, ⌘⇧7 numbers, ⌘⇧9 tasks. Over paragraphs: a list, one item
 * each. Over items: they take the kind, or, when they are all of it
 * already, become paragraphs again.
 */
export function toggleList(kind: ListKind): Command {
  return (state, dispatch) => {
    const { $from, $to } = state.selection;
    if ($from.parent.type === list_item && $to.parent.type === list_item && $from.before(1) === $to.before(1)) {
      const l = $from.node(1);
      const listPos = $from.before(1);
      const from = $from.index(1);
      const to = $to.index(1);
      const all = Array.from({ length: to - from + 1 }, (_, k) => l.child(from + k));
      if (!dispatch) return true;
      if (all.every((it) => kindOf(it) === kind)) {
        dispatch(itemsToParagraphs(state, listPos, from, to).scrollIntoView());
        return true;
      }
      const tr = state.tr;
      let pos = listPos + 1;
      l.forEach((item, _off, i) => {
        if (i >= from && i <= to) {
          const attrs = { ...item.attrs };
          const n = markerNumber(item.attrs.marker as string);
          if (kind === 'bullet') { attrs.task = null; if (n !== null) attrs.marker = '- '; }
          else if (kind === 'ordered') { attrs.task = null; if (n === null) attrs.marker = '1. '; }
          else if (item.attrs.task === null) attrs.task = ' ';
          tr.setNodeMarkup(pos, undefined, attrs);
        }
        pos += item.nodeSize;
      });
      renumberList(tr, listPos);
      dispatch(tr.scrollIntoView());
      return true;
    }
    const blocks = topBlocks(state);
    if (!blocks.length || !blocks.every((b) => b.node.type === paragraph && !anchored(b.node))) return true;
    dispatch?.(paragraphsToList(state, blocks, kind).scrollIntoView());
    return true;
  };
}

/** Items `from`..`to` of the list at `listPos` as paragraphs where they stood, the list split around them. */
function itemsToParagraphs(state: EditorState, listPos: number, from: number, to: number): Transaction {
  const l = state.doc.nodeAt(listPos)!;
  const before: PMNode[] = [];
  const mid: PMNode[] = [];
  const after: PMNode[] = [];
  l.forEach((item, _o, i) => (i < from ? before : i > to ? after : mid).push(item));
  const nodes: PMNode[] = [];
  if (before.length) nodes.push(list.create(null, before));
  for (const it of mid) nodes.push(paragraph.create(null, it.content));
  if (after.length) nodes.push(list.create(null, after));
  const tr = state.tr.replaceWith(listPos, listPos + l.nodeSize, nodes);
  // the selected items' text: past the list's start gone (-1), and a closed list before them (+2) when there is one
  const shift = before.length ? 1 : -1;
  const { anchor, head } = state.selection;
  tr.setSelection(TextSelection.create(tr.doc, anchor + shift, head + shift));
  if (after.length) renumberList(tr, listPos + nodes.slice(0, nodes.length - 1).reduce((n, x) => n + x.nodeSize, 0));
  return tr;
}

/** Map a position inside paragraph `k` of `paras` at offset `o` to its place among `lines`, which split them at each newline, with a `>` line between paragraphs. */
function quoteLines(paras: PMNode[]): { lines: PMNode[]; place: (k: number, o: number) => number } {
  const lines: PMNode[] = [];
  /** For each paragraph, each line's starting offset in it and its index among `lines`. */
  const starts: { at: number; line: number }[][] = [];
  paras.forEach((p, k) => {
    if (k > 0) lines.push(quote_line.create({ prefix: '>' }));
    const text = flatText(p);
    const mine: { at: number; line: number }[] = [];
    let at = 0;
    for (const part of text.split('\n')) {
      mine.push({ at, line: lines.length });
      lines.push(quote_line.create({ prefix: '> ' }, p.content.cut(at, at + part.length)));
      at += part.length + 1;
    }
    starts.push(mine);
  });
  const place = (k: number, o: number) => {
    const mine = starts[k]!;
    let s = mine[0]!;
    for (const x of mine) if (x.at <= o) s = x;
    let pos = 1; // inside the quote
    for (let i = 0; i < s.line; i++) pos += lines[i]!.nodeSize;
    return pos + 1 + (o - s.at);
  };
  return { lines, place };
}

/**
 * ⌘⇧.: paragraphs become a quote (a line per line, a `>` line between
 * paragraphs); in a quote, the quote becomes paragraphs again, a run of
 * lines one paragraph.
 */
export const toggleQuote: Command = (state, dispatch) => {
  const { $from } = state.selection;
  if ($from.depth >= 2 && $from.node(1).type === quote) {
    if (!dispatch) return true;
    const q = $from.node(1);
    const qPos = $from.before(1);
    const paras: PMNode[] = [];
    let run: PMNode[] = [];
    /** For each line, the paragraph it lands in and its offset there. */
    const where: { para: number; at: number }[] = [];
    const flush = () => {
      if (!run.length) return;
      const parts: Fragment[] = [];
      run.forEach((line, i) => { if (i) parts.push(Fragment.from(schema.text('\n'))); parts.push(line.content); });
      paras.push(paragraph.create(null, parts.reduce((a, b) => a.append(b), Fragment.empty)));
      run = [];
    };
    let at = 0;
    q.forEach((line) => {
      if (line.content.size === 0) { where.push({ para: paras.length + (run.length ? 1 : 0), at: 0 }); flush(); at = 0; return; }
      where.push({ para: paras.length, at });
      run.push(line);
      at += line.content.size + 1;
    });
    flush();
    if (!paras.length) paras.push(paragraph.create());
    const tr = state.tr.replaceWith(qPos, qPos + q.nodeSize, paras);
    const w = where[$from.index(1)] ?? { para: 0, at: 0 };
    let pos = qPos;
    for (let i = 0; i < Math.min(w.para, paras.length - 1); i++) pos += paras[i]!.nodeSize;
    const para = paras[Math.min(w.para, paras.length - 1)]!;
    tr.setSelection(TextSelection.create(tr.doc, Math.min(pos + 1 + w.at + $from.parentOffset, pos + 1 + para.content.size)));
    dispatch(tr.scrollIntoView());
    return true;
  }
  const blocks = topBlocks(state);
  if (!blocks.length || !blocks.every((b) => b.node.type === paragraph && !anchored(b.node))) return true;
  if (!dispatch) return true;
  const { lines, place } = quoteLines(blocks.map((b) => b.node));
  const first = blocks[0]!.pos;
  const last = blocks[blocks.length - 1]!;
  const tr = state.tr.replaceWith(first, last.pos + last.node.nodeSize, quote.create(null, lines));
  const mapIn = (pos: number) => {
    const k = blocks.findIndex((b) => pos >= b.pos && pos <= b.pos + b.node.nodeSize);
    const b = blocks[Math.max(0, k)]!;
    return first + place(Math.max(0, k), Math.max(0, Math.min(pos - b.pos - 1, b.node.content.size)));
  };
  tr.setSelection(TextSelection.create(tr.doc, mapIn(state.selection.anchor), mapIn(state.selection.head)));
  dispatch(tr.scrollIntoView());
  return true;
};

// ── block rules, as the Markdown is typed ────────────────────────

/** The top-level paragraph a rule's match starts at the beginning of, or null (in a list, a quote, or after other text). */
function ruleParagraph(state: EditorState, start: number): { pos: number; node: PMNode } | null {
  const $start = state.doc.resolve(start);
  if ($start.depth !== 1 || $start.parent.type !== paragraph || $start.parentOffset !== 0 || anchored($start.parent)) return null;
  return { pos: $start.before(), node: $start.parent };
}

/** `- `, `* `, `+ `, `1. `, `1) `, `[ ] `, `[x] ` at a paragraph's start: the paragraph becomes a list item, joined onto a list next to it. */
function listRule(re: RegExp, attrs: (m: RegExpMatchArray) => Record<string, unknown>): InputRule {
  return new InputRule(re, (state, match, start, end) => {
    const p = ruleParagraph(state, start);
    if (!p) return null;
    const rest = p.node.content.cut(end - start);
    const tr = state.tr.replaceWith(p.pos, p.pos + p.node.nodeSize, list.create(null, list_item.create(attrs(match), rest)));
    tr.setSelection(TextSelection.create(tr.doc, p.pos + 2));
    joinLists(tr, p.pos);
    return tr;
  });
}

const bulletRule = listRule(/^([-*+]) $/, (m) => ({ indent: '', marker: `${m[1]} `, task: null }));
const orderedRule = listRule(/^(\d{1,9})([.)]) $/, (m) => ({ indent: '', marker: `${m[1]}${m[2]} `, task: null }));
const taskParaRule = listRule(/^\[([ xX])\] $/, (m) => ({ indent: '', marker: '- ', task: m[1] }));

/** `> ` at a paragraph's start: a quote, its one line the paragraph's text. */
const quoteRule = new InputRule(/^> $/, (state, _m, start, end) => {
  const p = ruleParagraph(state, start);
  if (!p) return null;
  const { lines } = quoteLines([paragraph.create(null, p.node.content.cut(end - start))]);
  const tr = state.tr.replaceWith(p.pos, p.pos + p.node.nodeSize, quote.create(null, lines));
  return tr.setSelection(TextSelection.create(tr.doc, p.pos + 2));
});

/** `---` alone in a paragraph: a rule, and a paragraph after it to go on in. */
const ruleRule = new InputRule(/^---$/, (state, _m, start, end) => {
  const p = ruleParagraph(state, start);
  if (!p || p.node.content.size !== end - start) return null;
  const tr = state.tr.replaceWith(p.pos, p.pos + p.node.nodeSize, [raw.create({ text: '---' }), paragraph.create()]);
  return tr.setSelection(TextSelection.create(tr.doc, p.pos + 2));
});

export const blockRules: InputRule[] = [bulletRule, orderedRule, taskParaRule, quoteRule, ruleRule];

/**
 * Rules that fire on ⏎, kept where `undoInputRule` finds them (the plugin
 * says `isInputRules`), so a Backspace right after puts the typed line back
 * as it was.
 */
export const enterRulesKey = new PluginKey('enterRules');

export const enterRules = new Plugin({
  key: enterRulesKey,
  isInputRules: true,
  state: {
    init: () => null,
    apply(tr, prev) {
      const stored = tr.getMeta(enterRulesKey) as unknown;
      if (stored) return stored;
      return tr.selectionSet || tr.docChanged ? null : prev;
    },
  },
} as ConstructorParameters<typeof Plugin>[0] & { isInputRules: true });

const FENCE_LINE = /^(`{3,}|~{3,})([^`\n]*)$/;

/** A fence line (```` ``` ```` or `~~~`, with a language or not) alone in a paragraph, then ⏎ at its end: an empty code block, the caret in it. */
export const fenceRule: Command = (state, dispatch) => {
  const sel = state.selection;
  if (!sel.empty) return false;
  const { $from } = sel;
  if ($from.depth !== 1 || $from.parent.type !== paragraph || anchored($from.parent)) return false;
  const para = $from.parent;
  const text = flatText(para);
  if ($from.parentOffset !== text.length) return false;
  const pos = $from.before();
  const fence = FENCE_LINE.exec(text);
  if (fence) {
    if (!dispatch) return true;
    const tr = state.tr.replaceWith(pos, pos + para.nodeSize, code_block.create({ fence: text, close: fence[1] }));
    tr.setSelection(TextSelection.create(tr.doc, pos + 1));
    tr.setMeta(enterRulesKey, { transform: tr, from: $from.pos, to: $from.pos, text: '' });
    dispatch(tr.scrollIntoView());
    return true;
  }
  return false;
};

/** `$$` alone in a paragraph, then ⏎: an empty display formula with its editor open. */
export function displayMathRule(open: (tr: Transaction, pos: number) => void): Command {
  return (state, dispatch) => {
    const sel = state.selection;
    if (!sel.empty) return false;
    const { $from } = sel;
    if ($from.depth !== 1 || $from.parent.type !== paragraph || anchored($from.parent)) return false;
    if (flatText($from.parent) !== '$$' || $from.parentOffset !== 2) return false;
    if (!dispatch) return true;
    const start = $from.start();
    const tr = state.tr.replaceWith(start, start + 2, math.create({ raw: '$$ $$' }));
    tr.setSelection(TextSelection.create(tr.doc, start + 1));
    tr.setMeta(enterRulesKey, { transform: tr, from: $from.pos, to: $from.pos, text: '' });
    open(tr, start);
    dispatch(tr.scrollIntoView());
    return true;
  };
}

/**
 * Backspace right after a rule fired (typed or on ⏎): the block goes back
 * to the text as it was typed, the caret after it.
 */
export const undoRule: Command = (state, dispatch) => {
  for (const p of state.plugins) {
    if (!(p.spec as { isInputRules?: boolean }).isInputRules) continue;
    const u = p.getState(state) as { from: number; text: string } | null | undefined;
    if (!u) continue;
    return undoInputRule(state, dispatch && ((tr) => dispatch(tr.setSelection(TextSelection.create(tr.doc, u.from + u.text.length)).scrollIntoView())));
  }
  return false;
};

// ── keys by where they are on the keyboard ───────────────────────

const MAC = typeof navigator !== 'undefined' && /Mac|iP(hone|[oa]d)/.test(navigator.platform);

/** The editing keys, by `event.code` so they work under an Arabic layout too, each with the modifiers it wants. */
export interface KeySpec {
  code: string;
  mod?: boolean;
  shift?: boolean;
  alt?: boolean;
}

/** Does `e` press `k` exactly: ⌘ (⌃ off a Mac), ⇧, ⌥ as asked and no other? */
export function pressed(e: Pick<KeyboardEvent, 'code' | 'metaKey' | 'ctrlKey' | 'shiftKey' | 'altKey'>, k: KeySpec): boolean {
  const mod = MAC ? e.metaKey && !e.ctrlKey : e.ctrlKey && !e.metaKey;
  const none = !e.metaKey && !e.ctrlKey;
  return e.code === k.code && (k.mod ? mod : none) && !!k.shift === e.shiftKey && !!k.alt === e.altKey;
}
