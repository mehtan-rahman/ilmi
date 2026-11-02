// Block[] ↔ ProseMirror document. `toDoc` builds the editor's document from
// a parsed file; `fromDoc` reads the blocks back so `serialize` can write
// them. Prose text is verbatim in both directions, math chips included.

import { Fragment, type Node as PMNode } from 'prosemirror-model';
import { cardForm, mathSpanEnd, type Block, type Card, type Heading, type Paragraph, type Raw, type SectionSchedule } from '../format/index.js';
import { nodeToRaw, rawToNode } from './raw.js';
import { schema } from './schema.js';

export type MathPart = string | { math: string };

/** Split text into literal runs and math spans, by the format's own rules. */
export function mathSplit(text: string): MathPart[] {
  const out: MathPart[] = [];
  let lit = '';
  let i = 0;
  while (i < text.length) {
    if (text[i] === '$') {
      const e = mathSpanEnd(text, i);
      if (e > 0) {
        if (lit) { out.push(lit); lit = ''; }
        out.push({ math: text.slice(i, e) });
        i = e;
        continue;
      }
    }
    lit += text[i];
    i++;
  }
  if (lit) out.push(lit);
  return out;
}

/** The inline content for a run of text. */
export function inline(text: string): Fragment {
  const nodes: PMNode[] = [];
  for (const part of mathSplit(text)) {
    if (typeof part === 'string') nodes.push(schema.text(part));
    else nodes.push(schema.nodes.math!.create({ raw: part.math }));
  }
  return Fragment.from(nodes);
}

function blockNode(b: Block): PMNode {
  switch (b.kind) {
    case 'heading':
      return schema.nodes.heading!.create({ level: b.level, setext: b.setext === true, read: b.read ? structuredClone(b.read) : null }, inline(b.text));
    case 'paragraph':
      return schema.nodes.paragraph!.create({ id: b.id ?? null, extracts: b.extracts ? [...b.extracts] : null }, inline(b.text));
    case 'card':
      return schema.nodes.card!.create({ card: structuredClone(b) });
    case 'raw': {
      // code, a list, or a quote is edited as itself; anything else stays an atom
      const node = rawToNode(b.text) ?? schema.nodes.raw!.create({ text: b.text });
      // the rest of a list a card item split keeps its place directly under it (FORMAT.md §5.2)
      return b.joined ? node.type.create({ ...node.attrs, joined: true }, node.content) : node;
    }
  }
}

/** An empty body is one empty paragraph, so there is somewhere to type. */
export function toDoc(blocks: Block[]): PMNode {
  const nodes = blocks.length ? blocks.map(blockNode) : [schema.nodes.paragraph!.create()];
  return schema.nodes.doc!.create(null, nodes);
}

/** The verbatim text of a textblock: text nodes as they are, math as written. */
export function textOf(node: PMNode): string {
  let out = '';
  node.forEach((child) => {
    if (child.isText) out += child.text ?? '';
    else if (child.type === schema.nodes.math) out += child.attrs.raw as string;
  });
  return out;
}

/**
 * Blocks from the editor's document. Empty prose is dropped (a blank line
 * is a separator, not a block). A paragraph split in two by Enter carries
 * its id to both halves; the first keeps it, later ones lose it, since an
 * id names one block.
 */
export function fromDoc(doc: PMNode): Block[] {
  const out: Block[] = [];
  const ids = new Set<string>();
  // a heading split in two carries its section's line to both halves: the first keeps it
  let lastRead: SectionSchedule | null = null;
  doc.forEach((node) => {
    switch (node.type.name) {
      case 'heading': {
        const text = textOf(node);
        if (!text.trim()) return;
        const h: Heading = { kind: 'heading', level: node.attrs.level as number, text };
        if (node.attrs.setext === true) h.setext = true;
        const read = node.attrs.read as SectionSchedule | null;
        if (read && read !== lastRead) h.read = structuredClone(read);
        lastRead = read;
        out.push(h);
        return;
      }
      case 'paragraph': {
        const text = textOf(node);
        if (!text.trim()) return;
        const p: Paragraph = { kind: 'paragraph', text };
        const id = node.attrs.id as string | null;
        if (id !== null && !ids.has(id)) { p.id = id; ids.add(id); }
        const extracts = node.attrs.extracts as string[] | null;
        if (extracts?.length) p.extracts = [...extracts];
        out.push(p);
        return;
      }
      case 'card': {
        const card = structuredClone(node.attrs.card as Card);
        if (card.id !== undefined) {
          if (ids.has(card.id)) delete card.id;
          else ids.add(card.id);
        }
        out.push(card);
        return;
      }
      case 'raw':
      case 'code_block':
      case 'list':
      case 'quote':
      case 'table': {
        const raw: Raw = { kind: 'raw', text: node.type.name === 'raw' ? node.attrs.text as string : nodeToRaw(node) };
        if (node.attrs.joined === true) raw.joined = true;
        out.push(raw);
        return;
      }
    }
  });
  return out;
}

/** JSON with every object's keys in order: two blocks equal however their fields were set (a card's `joined` added after a move, the parser's own order). */
const stable = (v: unknown): string => JSON.stringify(v, (_k, x: unknown) => (x && typeof x === 'object' && !Array.isArray(x) ? Object.fromEntries(Object.entries(x).sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0))) : x));

export const blocksEqual = (a: Block[], b: Block[]): boolean => stable(a) === stable(b);

// ── cards ────────────────────────────────────────────────────────

/**
 * When the card next comes up: the earliest due over its schedules. A cloze
 * group with no line of its own and no bare line is new, so due now, which
 * `undefined` means.
 */
export function cardDue(card: Card): string | undefined {
  const dues: (string | undefined)[] = [];
  const groups = Object.keys(card.blanks ?? {});
  if (groups.length) {
    for (const n of groups) dues.push(card.blanks![Number(n)]!.due ?? card.sched?.due);
  } else {
    dues.push(card.sched?.due);
    // a both-ways card's reverse is new, so due now, until it has a line of its own
    if (cardForm(card.text) === 'bidir') dues.push(card.reverse?.due);
  }
  if (dues.some((d) => d === undefined)) return undefined;
  return (dues as string[]).sort()[0];
}
