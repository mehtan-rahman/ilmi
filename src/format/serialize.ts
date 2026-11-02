// Doc → text, in canonical form. FORMAT.md §8.

import { formatAttrs, writeAttrs } from './attrs.js';
import { SECTION_SPECS, formatFrontmatter } from './frontmatter.js';
import type { Block, Card, CardSchedule, Doc, SectionSchedule } from './model.js';
import { SR_SPECS } from './parse.js';

/** One `sr` line: bare, a cloze group's (`sr cN`), or a both-ways card's reverse (`sr r`). */
export function formatSchedule(s: CardSchedule, group?: number | 'r'): string {
  const head = group === undefined ? 'sr' : group === 'r' ? 'sr r' : `sr c${group}`;
  const attrs = formatAttrs(writeAttrs(s, SR_SPECS));
  return `<!-- ${head}${attrs ? ' ' + attrs : ''} -->`;
}

/** A section's line, under its heading (§6.5). */
export function formatSection(s: SectionSchedule): string {
  const attrs = formatAttrs(writeAttrs(s, SECTION_SPECS));
  return `<!-- read${attrs ? ' ' + attrs : ''} -->`;
}

function withId(text: string, id: string | undefined): string {
  if (id === undefined) return text;
  // the id goes on its own line when the last text line is empty or ends in
  // whitespace, so that whitespace survives the round trip
  return text && !/[ \t]$/.test(text) ? `${text} ^${id}` : `${text}\n^${id}`.replace(/^\n/, '');
}

function cardLines(c: Card): string[] {
  const out = [withId(c.text, c.id)];
  if (c.sched) out.push(formatSchedule(c.sched));
  if (c.reverse) out.push(formatSchedule(c.reverse, 'r'));
  for (const n of Object.keys(c.blanks ?? {}).map(Number).sort((a, b) => a - b)) {
    out.push(formatSchedule(c.blanks![n]!, n));
  }
  return out;
}

export function formatBlock(b: Block): string {
  switch (b.kind) {
    case 'heading': {
      const read = b.read ? `\n${formatSection(b.read)}` : '';
      if (b.setext) return `${b.text}\n${b.level === 1 ? '===' : '---'}${read}`;
      if (!b.text) return '#'.repeat(b.level) + read;
      // text that is all hashes, or ends in space + hashes, would be read as
      // a closing sequence; an explicit closing ` #` protects it
      const guard = /(^|[ \t])#+$/.test(b.text) ? ' #' : '';
      return `${'#'.repeat(b.level)} ${b.text}${guard}${read}`;
    }
    case 'paragraph':
      return [withId(b.text, b.id), ...(b.extracts ?? []).map((n) => `<!-- extract ${n} -->`)].join('\n');
    case 'card': {
      const out = [...cardLines(b), ...(b.extracts ?? []).map((n) => `<!-- extract ${n} -->`)].join('\n');
      if (b.item === undefined) return out;
      // a list item: the prefix on its first line, every other line (text and annotations) at its content column
      const pad = ' '.repeat(b.item.length);
      return out.split('\n').map((l, i) => (i ? pad + l : b.item + l)).join('\n');
    }
    case 'raw':
      return b.text;
  }
}

const LIST_START = /^ {0,3}(?:[-*+]|\d{1,9}[.)])[ \t]/;
const THEMATIC = /^ {0,3}([-*_])[ \t]*(?:\1[ \t]*){2,}$/;

/** Would a list start here when read back: a raw block whose first line is an item, or a card item set in no more than three spaces. */
function startsList(b: Block): boolean {
  if (b.kind === 'card') return b.item !== undefined && LIST_START.test(b.item);
  if (b.kind !== 'raw') return false;
  const first = b.text.split('\n', 1)[0]!;
  return LIST_START.test(first) && !THEMATIC.test(first);
}

/**
 * Which blocks go directly under the one before (FORMAT.md §5.2): a
 * `joined` card item or raw piece, inside a list that is still one when
 * read back. A join the edits around it have broken (a paragraph now
 * before it, or the list's start gone) is written with a blank line.
 */
function joins(blocks: readonly Block[]): boolean[] {
  const out: boolean[] = [];
  let inList = false;
  blocks.forEach((b, i) => {
    const piece = b.kind === 'raw' || (b.kind === 'card' && b.item !== undefined);
    const join = i > 0 && inList && piece && (b.kind === 'raw' || b.kind === 'card') && b.joined === true;
    out.push(join);
    inList = join ? true : startsList(b);
  });
  return out;
}

/** Blocks as the body writes them: a blank line between two, a list's pieces directly under each other. */
export function formatBody(blocks: readonly Block[]): string {
  const joined = joins(blocks);
  let body = '';
  blocks.forEach((b, i) => { body += (i === 0 ? '' : joined[i] ? '\n' : '\n\n') + formatBlock(b); });
  return body;
}

export function serialize(doc: Doc): string {
  const parts: string[] = [];
  if (doc.frontmatter) parts.push(formatFrontmatter(doc.frontmatter));
  if (doc.blocks.length) parts.push(formatBody(doc.blocks));
  if (!parts.length) return '';
  // a body that opens with a `---` thematic break (and has no front-matter)
  // or with a stray U+FEFF gets a leading blank line, so it is not read back
  // as front-matter or as a byte-order mark
  const lead = !doc.frontmatter && /^(---[ \t]*(\n|$)|\uFEFF)/.test(parts[0]!) ? '\n' : '';
  return lead + parts.join('\n\n') + '\n';
}
