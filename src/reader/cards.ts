// Making cards from the reader: the text a composed card is written as, the
// passage a selection covers, and the transactions that put a card into the
// document or change one in place. FORMAT.md §5 decides what is a card; a
// text the format would not read back as the intended card is refused here.

import type { Node as PMNode } from 'prosemirror-model';
import type { EditorState, Transaction } from 'prosemirror-state';
import { cardFields, parse, type Card, type CardForm } from '../format/index.js';
import { cardsKey } from './plugins.js';
import { schema } from './schema.js';

export type CardSpec =
  | { form: 'cloze'; text: string }
  | { form: 'qa'; front: string; back: string }
  | { form: 'bidir'; left: string; right: string };

/** Blank-line runs inside a card would split it into blocks; fold them to one line break. */
const oneBlock = (s: string) => s.trim().replace(/\n[ \t]*\n+/g, '\n');

/** True when the format reads `text` as exactly one card of `form`, verbatim. */
function readsAs(text: string, form: CardForm): boolean {
  const { doc } = parse(text);
  const b = doc.blocks[0];
  return doc.blocks.length === 1 && b?.kind === 'card' && b.text === text && cardFields(text)?.form === form;
}

/** Both sides of a two-sided card come back as typed. */
function sides(text: string, form: 'qa' | 'bidir', a: string, b: string): boolean {
  const f = cardFields(text);
  if (!f || f.form !== form) return false;
  return f.form === 'qa' ? f.front === a && f.back === b : f.left === a && f.right === b;
}

/**
 * The paragraph a composed card is written as, or null when the format would
 * not read it back as that card. A two-sided card goes inline (` :: `,
 * ` ::: `) when both sides fit on a line and survive the split, else on
 * lines around `?` / `??`.
 */
export function cardText(spec: CardSpec): string | null {
  if (spec.form === 'cloze') {
    const text = oneBlock(spec.text);
    return text && readsAs(text, 'cloze') ? text : null;
  }
  const [a, b] = spec.form === 'qa' ? [spec.front, spec.back] : [spec.left, spec.right];
  const l = oneBlock(a);
  const r = oneBlock(b);
  if (!l || !r) return null;
  const sep = spec.form === 'qa' ? '::' : ':::';
  const line = spec.form === 'qa' ? '?' : '??';
  const forms = [`${l}\n${line}\n${r}`];
  if (!l.includes('\n') && !r.includes('\n')) forms.unshift(`${l} ${sep} ${r}`);
  for (const text of forms) {
    if (readsAs(text, spec.form) && sides(text, spec.form, l, r)) return text;
  }
  return null;
}

// ── the selected passage ─────────────────────────────────────────

export interface Passage {
  /** The selected text, one paragraph per textblock touched (a list item, a quote line), blank lines between. */
  text: string;
  /** Child indices (of the document) of the blocks the selection touches, in order. */
  blocks: number[];
}

/**
 * What a selection from `from` to `to` covers: the text of the textblocks
 * it touches, cards and raw atoms skipped. An item's or a line's text is
 * taken without its marker, which is an attribute, not text.
 */
export function passage(doc: PMNode, from: number, to: number): Passage {
  const parts: string[] = [];
  const blocks: number[] = [];
  doc.nodesBetween(from, to, (node, pos) => {
    if (!node.isTextblock) return true;
    const start = pos + 1;
    const end = pos + node.nodeSize - 1;
    const a = Math.max(from, start);
    const b = Math.min(to, end);
    if (a >= b) return false;
    const text = node.textBetween(a - start, b - start).trim();
    if (!text) return false;
    parts.push(text);
    const i = doc.resolve(pos).index(0);
    if (blocks[blocks.length - 1] !== i) blocks.push(i);
    return false;
  });
  return { text: parts.join('\n\n'), blocks };
}

/** The child index of the block a position sits in, or of the block before a position between blocks. */
export function blockAt(doc: PMNode, pos: number): number {
  const $p = doc.resolve(pos);
  return $p.depth >= 1 ? $p.index(0) : Math.max(0, $p.index(0) - 1);
}

// ── transactions ─────────────────────────────────────────────────

/** Put `card` after the block at `index`, or at the end when `index` is null. Allowed on a frozen document. */
export function insertCard(state: EditorState, card: Card, index: number | null): Transaction {
  const doc = state.doc;
  let at = doc.content.size;
  if (index !== null) {
    at = 0;
    for (let i = 0; i <= Math.min(index, doc.childCount - 1); i++) at += doc.child(i).nodeSize;
  }
  return state.tr.insert(at, schema.nodes.card!.create({ card })).setMeta(cardsKey, true);
}

/** Give the card at child `index` a new text, keeping its id and schedules. Allowed on a frozen document. */
export function setCardText(state: EditorState, index: number, text: string): Transaction | null {
  const node = state.doc.maybeChild(index);
  if (!node || node.type !== schema.nodes.card) return null;
  const card = structuredClone(node.attrs.card as Card);
  card.text = text;
  let at = 0;
  for (let i = 0; i < index; i++) at += state.doc.child(i).nodeSize;
  return state.tr.replaceWith(at, at + node.nodeSize, schema.nodes.card!.create({ card })).setMeta(cardsKey, true);
}
