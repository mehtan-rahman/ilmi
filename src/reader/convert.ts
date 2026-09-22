// Block[] ↔ ProseMirror document. `toDoc` builds the editor's document from
// a parsed file; `fromDoc` reads the blocks back so `serialize` can write
// them. Prose text is verbatim in both directions, math chips included.

import { Fragment, type Node as PMNode } from 'prosemirror-model';
import { mathSpanEnd, type Block, type Card, type Heading, type Paragraph } from '../format/index.js';
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
      return schema.nodes.heading!.create({ level: b.level, setext: b.setext === true }, inline(b.text));
    case 'paragraph':
      return schema.nodes.paragraph!.create({ id: b.id ?? null, extracts: b.extracts ? [...b.extracts] : null }, inline(b.text));
    case 'card':
      return schema.nodes.card!.create({ card: structuredClone(b) });
    case 'raw':
      return schema.nodes.raw!.create({ text: b.text });
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
  doc.forEach((node) => {
    switch (node.type.name) {
      case 'heading': {
        const text = textOf(node);
        if (!text.trim()) return;
        const h: Heading = { kind: 'heading', level: node.attrs.level as number, text };
        if (node.attrs.setext === true) h.setext = true;
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
        out.push({ kind: 'raw', text: node.attrs.text as string });
        return;
    }
  });
  return out;
}

export const blocksEqual = (a: Block[], b: Block[]): boolean => JSON.stringify(a) === JSON.stringify(b);

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
  }
  if (dues.some((d) => d === undefined)) return undefined;
  return (dues as string[]).sort()[0];
}
