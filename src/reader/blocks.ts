// What a raw block is, so the reader can draw it as that element: fenced or
// indented code, a list, a block quote, a table, a thematic break. The
// format keeps these verbatim (FORMAT.md §4); nothing here changes a byte.
// Anything else (an HTML block, a comment) stays mono.

export interface CodeBlock {
  kind: 'code';
  /** The first word of the info string, `''` when none. */
  lang: string;
  /** The lines between the fences, or the indented lines with their indent removed. */
  code: string;
}

export interface ListItem {
  /** The item's own text, continuation and nested lines dedented, blank-line separated as it stood. */
  text: string;
}

export interface ListBlock {
  kind: 'list';
  ordered: boolean;
  /** The first item's number, on an ordered list. */
  start: number;
  items: ListItem[];
}

export interface QuoteBlock {
  kind: 'quote';
  /** The quoted text with its `>` marks removed; blank lines separate paragraphs. */
  text: string;
}

export type Align = 'left' | 'center' | 'right' | null;

export interface TableBlock {
  kind: 'table';
  align: Align[];
  head: string[];
  rows: string[][];
}

export interface RuleBlock {
  kind: 'rule';
}

export interface OtherBlock {
  kind: 'other';
}

export type RawShape = CodeBlock | ListBlock | QuoteBlock | TableBlock | RuleBlock | OtherBlock;

const FENCE = /^ {0,3}(`{3,}|~{3,})(.*)$/;
const THEMATIC = /^ {0,3}([-*_])[ \t]*(?:\1[ \t]*){2,}$/;
const QUOTE = /^ {0,3}>/;
const ITEM = /^( *)([-*+]|\d{1,9}[.)])([ \t]+|$)(.*)$/;
const INDENTED = /^( {4}|\t)/;
const TABLE = /^ {0,3}\|/;
const DELIM_CELL = /^:?-+:?$/;

/** Fenced code: the fence's own line gives the language; the closing fence, when there is one, is dropped. */
function fenced(lines: string[]): CodeBlock | null {
  const m = FENCE.exec(lines[0]!);
  if (!m) return null;
  const mark = m[1]!;
  // a backtick fence's info string may not hold a backtick
  if (mark[0] === '`' && m[2]!.includes('`')) return null;
  const lang = m[2]!.trim().split(/\s+/)[0] ?? '';
  const close = new RegExp(`^ {0,3}${mark[0]}{${mark.length},}[ \\t]*$`);
  const body = lines.slice(1);
  if (body.length && close.test(body[body.length - 1]!)) body.pop();
  return { kind: 'code', lang, code: body.join('\n') };
}

function indented(lines: string[]): CodeBlock | null {
  if (!lines.every((l) => INDENTED.test(l))) return null;
  return { kind: 'code', lang: '', code: lines.map((l) => l.replace(INDENTED, '')).join('\n') };
}

/** The `>` mark and one space after it off each line; a lazy continuation line stays as it is. */
function quoted(lines: string[]): QuoteBlock | null {
  if (!QUOTE.test(lines[0]!)) return null;
  return { kind: 'quote', text: lines.map((l) => l.replace(/^ {0,3}> ?/, '')).join('\n') };
}

/**
 * A list: items start at lines marked at the first item's indent (one
 * space of slack); every other line belongs to the item before it, its
 * indent reduced by the item's content offset, so a nested list or a
 * continuation paragraph reads as the item's own text.
 */
function listed(lines: string[]): ListBlock | null {
  const first = ITEM.exec(lines[0]!);
  if (!first) return null;
  const ordered = /\d/.test(first[2]!);
  const base = first[1]!.length;
  const items: { lines: string[]; offset: number }[] = [];
  for (const line of lines) {
    const m = ITEM.exec(line);
    const indent = m ? m[1]!.length : -1;
    if (m && indent >= base && indent <= base + 1 && /\d/.test(m[2]!) === ordered) {
      items.push({ lines: [m[4]!], offset: indent + m[2]!.length + Math.max(1, m[3]!.length) });
      continue;
    }
    const cur = items[items.length - 1];
    if (!cur) return null;
    const lead = /^[ \t]*/.exec(line)![0].length;
    cur.lines.push(line.slice(Math.min(lead, cur.offset)));
  }
  return { kind: 'list', ordered, start: ordered ? Number.parseInt(first[2]!, 10) : 1, items: items.map((it) => ({ text: it.lines.join('\n') })) };
}

/** A row's cells: the outer pipes off, split on pipes that are not escaped, each trimmed. */
function cells(line: string): string[] {
  let s = line.trim();
  if (s.startsWith('|')) s = s.slice(1);
  if (s.endsWith('|') && !s.endsWith('\\|')) s = s.slice(0, -1);
  const out: string[] = [];
  let cur = '';
  for (let i = 0; i < s.length; i++) {
    const c = s[i]!;
    if (c === '\\' && s[i + 1] === '|') { cur += '|'; i++; continue; }
    if (c === '|') { out.push(cur.trim()); cur = ''; continue; }
    cur += c;
  }
  out.push(cur.trim());
  return out;
}

/** A GFM table: a header row, a delimiter row of dashes with optional colons, then rows; short rows are padded, long ones cut. */
function tabled(lines: string[]): TableBlock | null {
  if (lines.length && !TABLE.test(lines[0]!)) return null;
  if (lines.length < 2) return null;
  const head = cells(lines[0]!);
  const delim = cells(lines[1]!);
  if (delim.length !== head.length || !delim.every((d) => DELIM_CELL.test(d))) return null;
  const align: Align[] = delim.map((d) => {
    const l = d.startsWith(':');
    const r = d.endsWith(':');
    return l && r ? 'center' : r ? 'right' : l ? 'left' : null;
  });
  const rows = lines.slice(2).map((l) => {
    const c = cells(l).slice(0, head.length);
    while (c.length < head.length) c.push('');
    return c;
  });
  return { kind: 'table', align, head, rows };
}

/** The shape of a raw block's text. */
export function classifyRaw(text: string): RawShape {
  const lines = text.split('\n');
  if (!lines.length || !lines[0]) return { kind: 'other' };
  if (lines.length === 1 && THEMATIC.test(lines[0])) return { kind: 'rule' };
  return fenced(lines) ?? quoted(lines) ?? listed(lines) ?? tabled(lines) ?? indented(lines) ?? { kind: 'other' };
}

const ATX = /^ {0,3}#{1,6}(?:[ \t]|$)/;
const ORDERED_ONE = /^ {0,3}1[.)][ \t]/;
const BULLET = /^ {0,3}[-*+][ \t]/;

/** Does this line end a paragraph without a blank line? The format's own rule (`interrupts` in parse.ts), without the comment and HTML cases. */
const interrupts = (line: string) => ATX.test(line) || FENCE.test(line) || THEMATIC.test(line) || QUOTE.test(line) || BULLET.test(line) || ORDERED_ONE.test(line);

/** Does a block that is not a paragraph start here? */
const startsRaw = (line: string) => FENCE.test(line) || THEMATIC.test(line) || QUOTE.test(line) || ITEM.test(line) || INDENTED.test(line) || TABLE.test(line);

/**
 * `text` split into blocks as the format splits a body: at blank lines, a
 * fence running to its close, a list or a quote to the blank line, and a
 * paragraph also ending where a list, a quote, a fence, or a heading
 * begins. For the text inside a quote or a list item.
 */
export function splitBlocks(text: string): string[] {
  const lines = text.split('\n');
  const out: string[] = [];
  let i = 0;
  while (i < lines.length) {
    if (!lines[i]!.trim()) { i++; continue; }
    const fence = FENCE.exec(lines[i]!);
    let j = i;
    if (fence) {
      const close = new RegExp(`^ {0,3}${fence[1]![0]}{${fence[1]!.length},}[ \\t]*$`);
      j = i + 1;
      while (j < lines.length && !close.test(lines[j]!)) j++;
      j = Math.min(j, lines.length - 1);
    } else if (ATX.test(lines[i]!)) {
      // a heading is its own line
    } else if (startsRaw(lines[i]!)) {
      while (j + 1 < lines.length && lines[j + 1]!.trim()) j++;
    } else {
      while (j + 1 < lines.length && lines[j + 1]!.trim() && !interrupts(lines[j + 1]!)) j++;
    }
    out.push(lines.slice(i, j + 1).join('\n'));
    i = j + 1;
  }
  return out;
}

/** A raw block's text as a pipe table, or null when it is not one (it must begin with a pipe). */
export const readTable = (text: string): TableBlock | null => tabled(text.split('\n'));

/** A line break inside a cell as GFM writes one: `<br>` (`<br/>`, `<br />` read too). */
export const CELL_BR = /<br[ \t]*\/?>/gi;

/** A cell's text with its `<br>`s as line breaks: how the editor holds it. */
export const cellLines = (s: string): string => s.replace(CELL_BR, '\n');

/** A cell's text as the file writes it: one line, trimmed, a line break as `<br>`, its pipes escaped. */
const cellText = (s: string): string => s.trim().replace(/[ \t]*\n[ \t]*/g, '<br>').replace(/\|/g, '\\|');

const DELIM: Record<string, string> = { left: ':---', center: ':---:', right: '---:' };

/**
 * A table written as the normalized pipe table: `| a | b |`, the delimiter
 * row `---` with the alignment's colons, every row as wide as the header,
 * no padding (an edit changes only the lines it touches). `readTable` reads
 * it back to the same cells.
 */
export function writeTable(t: Pick<TableBlock, 'align' | 'head' | 'rows'>): string {
  const n = t.head.length;
  const row = (cs: string[]) => `| ${Array.from({ length: n }, (_, i) => cellText(cs[i] ?? '')).join(' | ')} |`;
  const delim = `| ${Array.from({ length: n }, (_, i) => DELIM[t.align[i] ?? ''] ?? '---').join(' | ')} |`;
  return [row(t.head), delim, ...t.rows.map(row)].join('\n');
}
