// A raw block as an editable node and back: fenced code, a list, a block
// quote. The format keeps these verbatim (FORMAT.md §4) and does not
// change; the pair here is lossless by construction — `rawToNode` reads the
// text into a node and hands it back only when `nodeToRaw` returns the text
// byte for byte, so a block the pair cannot round trip stays a raw atom.

import type { Node as PMNode } from 'prosemirror-model';
import { inline, textOf } from './convert.js';
import { schema } from './schema.js';

const FENCE = /^ {0,3}(`{3,}|~{3,})(.*)$/;
const THEMATIC = /^ {0,3}([-*_])[ \t]*(?:\1[ \t]*){2,}$/;
const QUOTE_LINE = /^( {0,3}> ?)?(.*)$/;
const QUOTE = /^ {0,3}>/;
/** An item line: indent, marker, the whitespace after it (or the end), the text. */
const ITEM = /^( *)([-*+]|\d{1,9}[.)])([ \t]+|$)(.*)$/;
const ORDERED = /^(\d{1,9})([.)])([ \t]*)$/;
const TASK = /^\[([ xX])\] /;

// ── reading ──────────────────────────────────────────────────────

function codeNode(lines: string[]): PMNode | null {
  const m = FENCE.exec(lines[0]!);
  if (!m) return null;
  const mark = m[1]!;
  // a backtick fence's info string may not hold a backtick
  if (mark[0] === '`' && m[2]!.includes('`')) return null;
  const closes = new RegExp(`^ {0,3}${mark[0]}{${mark.length},}[ \\t]*$`);
  const body = lines.slice(1);
  let close: string | null = null;
  if (body.length && closes.test(body[body.length - 1]!)) close = body.pop()!;
  // nothing between the fences: nothing to edit, and no way to tell no line from one empty line
  if (!body.length) return null;
  const text = body.join('\n');
  return schema.nodes.code_block!.create({ fence: lines[0], close }, text ? schema.text(text) : null);
}

function quoteNode(lines: string[]): PMNode | null {
  if (!QUOTE.test(lines[0]!)) return null;
  const nodes = lines.map((line) => {
    const m = QUOTE_LINE.exec(line)!;
    return schema.nodes.quote_line!.create({ prefix: m[1] ?? '' }, inline(m[2]!));
  });
  return schema.nodes.quote!.create(null, nodes);
}

interface Item {
  indent: string;
  marker: string;
  task: string | null;
  lines: string[];
}

/**
 * Every item line is an item of its own, nested or not; a line that is not
 * one continues the item before it and must begin at that item's content
 * column, in spaces, so the column can be put back.
 */
function listNode(lines: string[]): PMNode | null {
  if (!ITEM.test(lines[0]!)) return null;
  const items: Item[] = [];
  for (const line of lines) {
    const m = ITEM.exec(line);
    if (m) {
      const task = TASK.exec(m[4]!);
      items.push({ indent: m[1]!, marker: m[2]! + m[3]!, task: task?.[1] ?? null, lines: [task ? m[4]!.slice(task[0].length) : m[4]!] });
      continue;
    }
    const cur = items[items.length - 1]!;
    const col = cur.indent.length + cur.marker.length;
    if (!line.startsWith(' '.repeat(col))) return null;
    cur.lines.push(line.slice(col));
  }
  return schema.nodes.list!.create(null, items.map((it) => schema.nodes.list_item!.create({ indent: it.indent, marker: it.marker, task: it.task }, inline(it.lines.join('\n')))));
}

/** The node a raw block's text is edited as, or null when it stays a raw atom (a table, a rule, HTML, a shape the pair cannot put back). */
export function rawToNode(text: string): PMNode | null {
  const lines = text.split('\n');
  if (!lines[0]) return null;
  if (lines.length === 1 && THEMATIC.test(lines[0])) return null;
  const node = codeNode(lines) ?? quoteNode(lines) ?? listNode(lines);
  return node && nodeToRaw(node) === text ? node : null;
}

// ── writing ──────────────────────────────────────────────────────

/** An item's lines as the file has them: the first after its marker, the rest at the content column. */
export function itemLines(item: PMNode): string {
  const indent = item.attrs.indent as string;
  const marker = item.attrs.marker as string;
  const task = item.attrs.task as string | null;
  const col = ' '.repeat(indent.length + marker.length);
  return indent + marker + (task === null ? '' : `[${task}] `) + textOf(item).split('\n').map((l, i) => (i ? col + l : l)).join('\n');
}

/** The raw block a code, list, or quote node writes back as. */
export function nodeToRaw(node: PMNode): string {
  switch (node.type.name) {
    case 'code_block': {
      const close = node.attrs.close as string | null;
      return `${node.attrs.fence as string}\n${node.textContent}${close === null ? '' : `\n${close}`}`;
    }
    case 'list': {
      const lines: string[] = [];
      node.forEach((item) => lines.push(itemLines(item)));
      return lines.join('\n');
    }
    case 'quote': {
      const lines: string[] = [];
      node.forEach((line) => lines.push((line.attrs.prefix as string) + textOf(line)));
      return lines.join('\n');
    }
    default:
      throw new Error(`not a raw node: ${node.type.name}`);
  }
}

/** Is this a node the pair writes back as a raw block? */
export const isRawNode = (node: PMNode): boolean => node.type === schema.nodes.code_block || node.type === schema.nodes.list || node.type === schema.nodes.quote;

// ── markers ──────────────────────────────────────────────────────

/** The marker's number, or null on a bullet. */
export function markerNumber(marker: string): number | null {
  const m = ORDERED.exec(marker);
  return m ? Number.parseInt(m[1]!, 10) : null;
}

/** The same marker with another number: `2. ` after `1. `; a bullet as it is. */
export function numbered(marker: string, n: number): string {
  const m = ORDERED.exec(marker);
  return m ? `${n}${m[2]}${m[3]}` : marker;
}

/** The marker for the item after one marked `marker`: a bullet as it is, a number one up. */
export const nextMarker = (marker: string): string => {
  const n = markerNumber(marker);
  return n === null ? marker : numbered(marker, n + 1);
};
