// Doc → text, in canonical form. FORMAT.md §8.

import { formatAttrs, writeAttrs } from './attrs.js';
import { formatFrontmatter } from './frontmatter.js';
import type { Block, Card, CardSchedule, Doc } from './model.js';
import { SR_SPECS } from './parse.js';

export function formatSchedule(s: CardSchedule, group?: number): string {
  const head = group === undefined ? 'sr' : `sr c${group}`;
  const attrs = formatAttrs(writeAttrs(s, SR_SPECS));
  return `<!-- ${head}${attrs ? ' ' + attrs : ''} -->`;
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
  for (const n of Object.keys(c.blanks ?? {}).map(Number).sort((a, b) => a - b)) {
    out.push(formatSchedule(c.blanks![n]!, n));
  }
  return out;
}

export function formatBlock(b: Block): string {
  switch (b.kind) {
    case 'heading': {
      if (b.setext) return `${b.text}\n${b.level === 1 ? '===' : '---'}`;
      if (!b.text) return '#'.repeat(b.level);
      // text that is all hashes, or ends in space + hashes, would be read as
      // a closing sequence; an explicit closing ` #` protects it
      const guard = /(^|[ \t])#+$/.test(b.text) ? ' #' : '';
      return `${'#'.repeat(b.level)} ${b.text}${guard}`;
    }
    case 'paragraph':
      return [withId(b.text, b.id), ...(b.extracts ?? []).map((n) => `<!-- extract ${n} -->`)].join('\n');
    case 'card':
      return [...cardLines(b), ...(b.extracts ?? []).map((n) => `<!-- extract ${n} -->`)].join('\n');
    case 'raw':
      return b.text;
  }
}

export function serialize(doc: Doc): string {
  const parts: string[] = [];
  if (doc.frontmatter) parts.push(formatFrontmatter(doc.frontmatter));
  for (const b of doc.blocks) parts.push(formatBlock(b));
  if (!parts.length) return '';
  // a body that opens with a `---` thematic break (and has no front-matter)
  // or with a stray U+FEFF gets a leading blank line, so it is not read back
  // as front-matter or as a byte-order mark
  const lead = !doc.frontmatter && /^(---[ \t]*(\n|$)|\uFEFF)/.test(parts[0]!) ? '\n' : '';
  return lead + parts.join('\n\n') + '\n';
}
