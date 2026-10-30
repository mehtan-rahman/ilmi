// Text → Doc. FORMAT.md §2–§6.
//
// The parser interprets only what the app needs (headings, paragraphs, card
// syntax, the annotations it owns, known front-matter keys) and keeps
// everything else verbatim as raw blocks or raw lines.

import { parseAttrs, parseBool, readAttrs, specWhen, specNum, specInt, specEnum, specIntRange, type AttrSpec, type Warn } from './attrs.js';
import { cardForm } from './cloze.js';
import { parseFrontmatter } from './frontmatter.js';
import type { Block, Card, CardSchedule, Diagnostic, Doc, Heading, Paragraph, Raw, SrState } from './model.js';

export const SR_SPECS: AttrSpec<CardSchedule>[] = [
  specWhen('due', 'due'),
  specEnum('st', 'state', ['new', 'learning', 'review', 'relearning'] satisfies SrState[]),
  specNum('s', 'stability'),
  specNum('d', 'difficulty'),
  specInt('r', 'reps'),
  specInt('l', 'lapses'),
  specInt('steps', 'steps'),
  specInt('ivl', 'ivl'),
  specWhen('last', 'last'),
  specIntRange('g', 'grade', 1, 4),
  specIntRange('pri', 'pri', 0, 100),
  // `sus=1` suspends; read as a bool, written only when true (a `sus=0` is dropped on the next write)
  { key: 'sus', prop: 'suspended', parse: (v) => parseBool(v), format: () => '1' },
];

// ── line classifiers ─────────────────────────────────────────────

const BLANK = /^[ \t]*$/;
const FENCE = /^ {0,3}(`{3,}|~{3,})/;
const ATX = /^ {0,3}(#{1,6})(?:[ \t]+(.*?))?[ \t]*$/s;
const ATX_CLOSE = /[ \t]+#+[ \t]*$/s;
const COMMENT_OPEN = /^[ \t]*<!--/;
const ANNOTATION = /^[ \t]*<!--\s*(sr|extract)(?:\s+(.*?))?\s*-->[ \t]*$/s;
const THEMATIC = /^ {0,3}([-*_])[ \t]*(?:\1[ \t]*){2,}$/;
const QUOTE = /^ {0,3}>/;
const BULLET = /^ {0,3}[-*+][ \t]/;
const ORDERED = /^ {0,3}\d{1,9}[.)][ \t]/;
const ORDERED_ONE = /^ {0,3}1[.)][ \t]/;
const INDENTED = /^( {4}|\t)/;
const TABLE = /^ {0,3}\|/;
const HTML_BLOCK = /^ {0,3}<\/?(address|article|aside|audio|blockquote|body|canvas|center|dd|details|dialog|div|dl|dt|fieldset|figcaption|figure|footer|form|frame|h[1-6]|head|header|hr|html|iframe|img|legend|li|main|menu|nav|ol|optgroup|option|p|pre|script|section|source|style|summary|table|tbody|td|textarea|tfoot|th|thead|title|tr|track|ul|video)(\s|\/?>|$)/i;
const SETEXT_1 = /^ {0,3}=+[ \t]*$/;
const SETEXT_2 = /^ {0,3}-+[ \t]*$/;
const ID_TAIL = /^(.*?)[ \t]+\^([A-Za-z0-9_-]+)[ \t]*$/s;
const ID_ALONE = /^\^([A-Za-z0-9_-]+)[ \t]*$/;
const GROUP_KEY = /^c?(\d+)$/;
/** Any item line, nested or not: where one item ends and the next begins. */
const ITEM_START = /^ *(?:[-*+]|\d{1,9}[.)])(?:[ \t]|$)/;
/** An item line that can be a card (§5.2): spaces, a marker, one to four spaces, then text. */
const ITEM_CARD = /^( *(?:[-*+]|\d{1,9}[.)]) {1,4})(\S.*)$/s;
const TASK = /^\[[ xX]\][ \t]/;
/** The multi-line q&a and bidirectional separators. */
const isSep = (l: string) => l.trim() === '?' || l.trim() === '??';
const FENCE_IN = /^ *(`{3,}|~{3,})/;

const isBlank = (l: string) => BLANK.test(l);

/** Does this line end a paragraph without a blank line? */
function interrupts(line: string): boolean {
  return ATX.test(line) || FENCE.test(line) || COMMENT_OPEN.test(line) || THEMATIC.test(line)
    || QUOTE.test(line) || BULLET.test(line) || ORDERED_ONE.test(line) || HTML_BLOCK.test(line);
}

/** Does a raw block start here? */
function startsRaw(line: string): boolean {
  return FENCE.test(line) || THEMATIC.test(line) || QUOTE.test(line) || BULLET.test(line)
    || ORDERED.test(line) || INDENTED.test(line) || TABLE.test(line) || HTML_BLOCK.test(line);
}

// ── parse ────────────────────────────────────────────────────────

export interface ParseResult {
  doc: Doc;
  diagnostics: Diagnostic[];
}

export function parse(input: string): ParseResult {
  let text = input.charCodeAt(0) === 0xfeff ? input.slice(1) : input;
  text = text.replace(/\r\n?/g, '\n');
  const lines = text.split('\n');
  if (lines.length && lines[lines.length - 1] === '') lines.pop();

  const diagnostics: Diagnostic[] = [];
  const doc: Doc = { blocks: [] };
  let i = 0;

  // front-matter
  if (lines[0] !== undefined && /^---[ \t]*$/.test(lines[0])) {
    let j = 1;
    while (j < lines.length && !/^(---|\.\.\.)[ \t]*$/.test(lines[j]!)) j++;
    if (j < lines.length) {
      doc.frontmatter = parseFrontmatter(lines.slice(1, j), 2, diagnostics);
      i = j + 1;
    }
  }

  // body
  let lastEnd = -2;            // index of the last line of the previous block
  const blocks = doc.blocks;
  const last = (): Block | undefined => blocks[blocks.length - 1];

  while (i < lines.length) {
    const line = lines[i]!;
    if (isBlank(line)) { i++; continue; }

    // fenced code: verbatim to the closing fence
    const fence = FENCE.exec(line);
    if (fence) {
      const mark = fence[1]!;
      const close = new RegExp(`^ {0,3}${mark[0]}{${mark.length},}[ \\t]*$`);
      let j = i + 1;
      while (j < lines.length && !close.test(lines[j]!)) j++;
      const terminated = j < lines.length;
      let end = terminated ? j : lines.length - 1;
      if (!terminated) while (end > i && isBlank(lines[end]!)) end--;
      blocks.push({ kind: 'raw', text: lines.slice(i, end + 1).join('\n') });
      lastEnd = end;
      i = end + 1;
      continue;
    }

    // ATX heading
    const atx = ATX.exec(line);
    if (atx) {
      const textPart = (atx[2] ?? '').replace(ATX_CLOSE, '').trim();
      const h: Heading = { kind: 'heading', level: atx[1]!.length, text: /^#+$/.test(atx[2] ?? '') ? '' : textPart };
      blocks.push(h);
      lastEnd = i;
      i++;
      continue;
    }

    // HTML comment: one of our annotations, or raw
    if (COMMENT_OPEN.test(line)) {
      let j = i;
      while (j < lines.length && !lines[j]!.includes('-->')) j++;
      let end = Math.min(j, lines.length - 1);
      if (j >= lines.length) while (end > i && isBlank(lines[end]!)) end--;
      const single = end === i;
      const ann = single ? ANNOTATION.exec(line) : null;
      if (ann) {
        const attached = attach(last(), lastEnd === i - 1, ann[1]!, ann[2] ?? '', i + 1, diagnostics);
        if (attached) { lastEnd = i; i++; continue; }
      }
      blocks.push({ kind: 'raw', text: lines.slice(i, end + 1).join('\n') });
      lastEnd = end;
      i = end + 1;
      continue;
    }

    // other raw blocks: to the next blank line; a list's card items are cut out of it (§5.2)
    if (startsRaw(line)) {
      let j = i;
      while (j + 1 < lines.length && !isBlank(lines[j + 1]!)) j++;
      if ((BULLET.test(line) || ORDERED.test(line)) && !THEMATIC.test(line)) blocks.push(...listBlocks(lines.slice(i, j + 1), i + 1, diagnostics));
      else blocks.push({ kind: 'raw', text: lines.slice(i, j + 1).join('\n') });
      lastEnd = j;
      i = j + 1;
      continue;
    }

    // paragraph (or setext heading, or card)
    let j = i;
    let setext: 1 | 2 | 0 = 0;
    // after a `?` or `??` line, list lines are the card's back: steps of a derivation (§5)
    let sep = false;
    while (j + 1 < lines.length) {
      const next = lines[j + 1]!;
      if (isBlank(next)) break;
      if (SETEXT_1.test(next)) { setext = 1; break; }
      if (SETEXT_2.test(next)) { setext = 2; break; }
      if (interrupts(next) && !(sep && (BULLET.test(next) || ORDERED.test(next)) && !THEMATIC.test(next))) break;
      j++;
      if (isSep(next)) sep = true;
    }
    const body = lines.slice(i, j + 1);
    if (setext) {
      blocks.push({ kind: 'heading', level: setext, text: body.join('\n'), setext: true });
      lastEnd = j + 1;
      i = j + 2;
      continue;
    }
    blocks.push(paragraphOrCard(body));
    lastEnd = j;
    i = j + 1;
  }

  return { doc, diagnostics };
}

/**
 * A list's lines (one raw run, to the next blank line) as blocks: each item
 * whose own text is a card becomes a card block carrying its prefix, its
 * annotation lines read under it; every other line stays raw, verbatim,
 * in pieces between the cards. Every block after the first is `joined`, so
 * the list is written back as one. FORMAT.md §5.2.
 */
function listBlocks(run: string[], firstLine: number, diags: Diagnostic[]): Block[] {
  const out: Block[] = [];
  let raw: string[] = [];
  const push = (b: Raw | Card) => { if (out.length) b.joined = true; out.push(b); };
  const flush = () => { if (raw.length) { push({ kind: 'raw', text: raw.join('\n') }); raw = []; } };
  let fence: RegExp | null = null;
  let k = 0;
  while (k < run.length) {
    const line = run[k]!;
    // a fence inside an item is code to its closing fence: nothing in it is a card
    if (fence) {
      if (fence.test(line)) fence = null;
      raw.push(line);
      k++;
      continue;
    }
    const got = itemCard(run, k);
    if (got) {
      flush();
      push(got.card);
      k = got.end;
      // its annotations, at any indentation, written back at its content column
      while (k < run.length) {
        const ann = ANNOTATION.exec(run[k]!);
        if (!ann) break;
        if (!attach(got.card, true, ann[1]!, ann[2] ?? '', firstLine + k, diags)) { raw.push(run[k]!); k++; break; }
        k++;
      }
      continue;
    }
    const ann = ANNOTATION.exec(line);
    // an annotation under an item that is no card: kept as text, said so
    if (ann) diags.push({ line: firstLine + k, message: `orphan ${ann[1]!} line` });
    const f = FENCE_IN.exec(line);
    if (f) fence = new RegExp(`^ *${f[1]![0]}{${f[1]!.length},}[ \\t]*$`);
    raw.push(line);
    k++;
  }
  flush();
  return out;
}

/**
 * The card item starting at `run[k]`, and the line after its text; null
 * when the item is no card. Its text is the first line after the prefix
 * and the lines after it set in to the content column, in spaces; it ends
 * at an annotation, at another item (a nested one included, except after a
 * `?` or `??` line, where items are the back's steps), or at a line that
 * would end a paragraph. A lazy line (not set in, not ending a paragraph)
 * makes the item no card: its text could not be put back as written.
 */
function itemCard(run: string[], k: number): { card: Card; end: number } | null {
  const m = ITEM_CARD.exec(run[k]!);
  if (!m || TASK.test(m[2]!)) return null;
  const prefix = m[1]!;
  const pad = ' '.repeat(prefix.length);
  const body = [m[2]!];
  let sep = false;
  let e = k + 1;
  for (; e < run.length; e++) {
    const line = run[e]!;
    if (ANNOTATION.test(line) || !line.startsWith(pad)) break;
    const rest = line.slice(pad.length);
    if (!sep && (ITEM_START.test(line) || interrupts(rest))) break;
    if (sep && interrupts(rest) && !ITEM_START.test(rest)) break;
    body.push(rest);
    if (isSep(rest)) sep = true;
  }
  const next = run[e];
  if (next !== undefined && !ANNOTATION.test(next) && !ITEM_START.test(next) && !interrupts(next.startsWith(pad) ? next.slice(pad.length) : next)) return null;
  const block = paragraphOrCard(body);
  if (block.kind !== 'card') return null;
  block.item = prefix;
  return { card: block, end: e };
}

/** Strip a trailing `^id`, then decide prose vs card. */
function paragraphOrCard(body: string[]): Paragraph | Card {
  let id: string | undefined;
  const lastLine = body[body.length - 1]!;
  const alone = ID_ALONE.exec(lastLine);
  const tail = alone ? null : ID_TAIL.exec(lastLine);
  if (alone) { id = alone[1]!; body = body.slice(0, -1); }
  else if (tail) { id = tail[2]!; body = [...body.slice(0, -1), tail[1]!]; }
  const text = body.join('\n');
  const block: Paragraph | Card = cardForm(text) ? { kind: 'card', text } : { kind: 'paragraph', text };
  if (id !== undefined) block.id = id;
  return block;
}

/** Attach an annotation to the block before it. Returns false for orphans. */
function attach(prev: Block | undefined, adjacent: boolean, tag: string, rest: string, lineNo: number, diags: Diagnostic[]): boolean {
  const warn: Warn = (message) => diags.push({ line: lineNo, message });
  // every failure to attach reads the same, so a file that is written back
  // (orphans kept verbatim, now separated by a blank line) reports no new problems
  const orphan = () => { warn(`orphan ${tag} line`); return false; };
  if (!prev || !adjacent || (prev.kind !== 'paragraph' && prev.kind !== 'card')) return orphan();
  if (tag === 'extract') {
    const name = rest.trim();
    if (!name) return orphan();
    const list = prev.extracts ?? [];
    if (list.includes(name)) warn(`duplicate extract "${name}"`);
    else list.push(name);
    prev.extracts = list;
    return true;
  }
  // sr
  if (prev.kind !== 'card') return orphan();
  const attrs = parseAttrs(rest, warn);
  let group: number | undefined;
  for (const b of attrs.bare) {
    const m = GROUP_KEY.exec(b);
    if (m && group === undefined) group = Number(m[1]);
    else warn(`unexpected token "${b}"`);
  }
  const sched = readAttrs(attrs.pairs, SR_SPECS, warn);
  // `sus=0` says what absence says
  if ((sched.suspended as boolean | undefined) === false) delete sched.suspended;
  if (group === undefined) {
    if (prev.sched) warn('card has two schedules; later wins');
    prev.sched = sched;
  } else {
    // a priority belongs to the card, on its bare line
    if (sched.pri !== undefined) { warn(`"pri" on a group line is ignored`); delete sched.pri; }
    const blanks = prev.blanks ?? {};
    if (blanks[group]) warn(`group c${group} has two schedules; later wins`);
    blanks[group] = sched;
    prev.blanks = blanks;
  }
  return true;
}
