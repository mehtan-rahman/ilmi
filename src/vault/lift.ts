// State out of the text and back (milestone 60). A document's text in a
// collection is Markdown as FORMAT.md has it, without the lines that are
// state: a card's `sr` lines, a section's `read` line, the attributes of the
// front matter's `read` and `write`. Those are rows (`StateRow`), keyed by
// the card's `^id`, the heading, or the field. `decompose` is what a write
// does with a file's text; `compose` is what a read and an export give
// back, through the format's own parser and serializer.
//
// Three rules keep a file's bytes:
// - What comes back is the canonical form (`serialize(parse(x))`), which for
//   a file the app wrote is the file. `decompose` checks that its own rows
//   and text compose to exactly that, and when they do not it lifts
//   nothing: the text is kept whole, state lines and all, and still reads.
// - A file that was not canonical when it came in (written by hand) is kept
//   beside as it was (`original`), with a stamp of what it composed to
//   then. While the document composes to the same, a read gives the file
//   back byte for byte; the first change to its text or its state drops
//   it, which is the moment the app's first write normalized such a file
//   before (FORMAT.md §8).
// - Nothing is added to the text: a card without an `^id` is keyed by its
//   place among the document's cards until the app gives it one, at its
//   first grade, as FORMAT.md §6.1 has it.

import { searchRows, type SearchRow } from './search.js';
import { isField, parse, serialize, type Block, type Card, type CardSchedule, type Doc, type ReadSchedule, type SectionSchedule, type WriteSchedule } from '../format/index.js';

export type StateKind = 'card' | 'section' | 'read' | 'write';

/** One schedule as a row: whose it is, which line, and the line's attributes as the model holds them. */
export interface StateRow {
  kind: StateKind;
  /** A card's `^id`, or `#n` (its place among the cards) without one; a section's heading (`sectionKeys`); empty for the document's own. */
  item: string;
  /** A card's line: empty the bare one, `r` the reverse, `cN` a cloze group. Empty otherwise. */
  key: string;
  attrs: CardSchedule | SectionSchedule | ReadSchedule | WriteSchedule;
}

/** Each card's key in `blocks`, by block index: its id, else `#n`. */
export function cardKeys(blocks: readonly Block[]): Map<number, string> {
  const out = new Map<number, string>();
  let n = 0;
  blocks.forEach((b, i) => {
    if (b.kind !== 'card') return;
    out.set(i, b.id ?? `#${n}`);
    n++;
  });
  return out;
}

/** Each heading's key in `blocks`, by block index: its text, a repeat `text\n2`, `text\n3`. */
export function sectionKeys(blocks: readonly Block[]): Map<number, string> {
  const out = new Map<number, string>();
  const seen = new Map<string, number>();
  blocks.forEach((b, i) => {
    if (b.kind !== 'heading') return;
    const n = (seen.get(b.text) ?? 0) + 1;
    seen.set(b.text, n);
    out.set(i, n === 1 ? b.text : `${b.text}\n${n}`);
  });
  return out;
}

const empty = (o: object): boolean => Object.keys(o).length === 0;

/** The state `doc` carries, as rows, and `doc` itself without it (in place). */
export function lift(doc: Doc): StateRow[] {
  const rows: StateRow[] = [];
  for (const e of doc.frontmatter?.entries ?? []) {
    if (!isField(e) || (e.key !== 'read' && e.key !== 'write')) continue;
    // the key stays in the text, bare, where it was: enrolled is the text's to say
    if (!empty(e.value)) rows.push({ kind: e.key, item: '', key: '', attrs: e.value });
    e.value = {};
  }
  const cards = cardKeys(doc.blocks);
  const sections = sectionKeys(doc.blocks);
  doc.blocks.forEach((b, i) => {
    if (b.kind === 'heading' && b.read) {
      rows.push({ kind: 'section', item: sections.get(i)!, key: '', attrs: b.read });
      delete b.read;
    } else if (b.kind === 'card') {
      const item = cards.get(i)!;
      if (b.sched) rows.push({ kind: 'card', item, key: '', attrs: b.sched });
      if (b.reverse) rows.push({ kind: 'card', item, key: 'r', attrs: b.reverse });
      for (const n of Object.keys(b.blanks ?? {}).map(Number).sort((x, y) => x - y)) rows.push({ kind: 'card', item, key: `c${n}`, attrs: b.blanks![n]! });
      delete b.sched;
      delete b.reverse;
      delete b.blanks;
    }
  });
  return rows;
}

/** `doc` with `rows` put back where their keys say (in place); a row whose card or heading is not there is left out. */
export function attach(doc: Doc, rows: readonly StateRow[]): Doc {
  if (!rows.length) return doc;
  const cards = new Map<string, Card>();
  for (const [i, key] of cardKeys(doc.blocks)) if (!cards.has(key)) cards.set(key, doc.blocks[i] as Card);
  const sections = new Map<string, Block>();
  for (const [i, key] of sectionKeys(doc.blocks)) sections.set(key, doc.blocks[i]!);
  for (const r of rows) {
    if (r.kind === 'read' || r.kind === 'write') {
      const e = doc.frontmatter?.entries.find((x) => isField(x) && x.key === r.kind);
      if (e && isField(e)) e.value = r.attrs as ReadSchedule & WriteSchedule;
    } else if (r.kind === 'section') {
      const h = sections.get(r.item);
      if (h?.kind === 'heading') h.read = r.attrs as SectionSchedule;
    } else {
      const c = cards.get(r.item);
      if (!c) continue;
      const s = r.attrs as CardSchedule;
      if (r.key === '') c.sched = s;
      else if (r.key === 'r') c.reverse = s;
      else if (/^c\d+$/.test(r.key)) c.blanks = { ...c.blanks, [Number(r.key.slice(1))]: s };
    }
  }
  return doc;
}

/** How much the index keeps of a prose block a queue row quotes: enough for its words. */
export const DIGEST_PROSE = 200;
/** What stands for any other prose block that has something in it. */
export const DIGEST_MARK = '…';

function cut(text: string): string {
  if (text.length <= DIGEST_PROSE) return text;
  const end = /[\uD800-\uDBFF]/.test(text[DIGEST_PROSE - 1]!) ? DIGEST_PROSE - 1 : DIGEST_PROSE;
  return text.slice(0, end);
}

/**
 * What the index keeps of a document: its fields, its headings and its
 * cards whole (state with them), and every other block in its place
 * without its text: `…` where something is written, nothing where nothing
 * is. The three blocks a queue row quotes keep their opening words: the
 * one at the read point, the first, and the first paragraph. Block
 * indices, the prose count, a card's headings, and whether anything is
 * written are what they are in the document, so the queue, a deck's rows,
 * the counts and the numbers read a digest as they read a document. It is
 * never written back.
 */
export function digest(doc: Doc): Doc {
  const prose: number[] = [];
  doc.blocks.forEach((b, i) => { if (b.kind !== 'card') prose.push(i); });
  const keep = new Set<number>();
  if (prose.length) {
    const read = doc.frontmatter?.entries.find((e) => isField(e) && e.key === 'read');
    const pos = read && isField(read) && read.key === 'read' ? read.value.pos ?? 0 : 0;
    keep.add(prose[0]!);
    keep.add(prose[Math.max(0, Math.min(pos, prose.length - 1))]!);
    const written = (i: number) => doc.blocks[i]!.text.trim() !== '';
    const lead = prose.find((i) => doc.blocks[i]!.kind === 'paragraph' && written(i)) ?? prose.find(written);
    if (lead !== undefined) keep.add(lead);
  }
  const out: Doc = {
    blocks: doc.blocks.map((b, i): Block => {
      if (b.kind === 'heading' || b.kind === 'card') return b;
      return { ...b, text: keep.has(i) ? cut(b.text) : b.text.trim() ? DIGEST_MARK : '' };
    }),
  };
  const fields = (doc.frontmatter?.entries ?? []).filter(isField);
  if (fields.length) out.frontmatter = { entries: fields };
  return out;
}

/** A stamp of a text: two 53-bit hashes, enough that a changed text never passes for the same. */
export function stampOf(text: string): string {
  const h = (seed: number): number => {
    let a = 0xdeadbeef ^ seed;
    let b = 0x41c6ce57 ^ seed;
    for (let i = 0; i < text.length; i++) {
      const ch = text.charCodeAt(i);
      a = Math.imul(a ^ ch, 2654435761);
      b = Math.imul(b ^ ch, 1597334677);
    }
    a = Math.imul(a ^ (a >>> 16), 2246822507) ^ Math.imul(b ^ (b >>> 13), 3266489909);
    b = Math.imul(b ^ (b >>> 16), 2246822507) ^ Math.imul(a ^ (a >>> 13), 3266489909);
    return 4294967296 * (2097151 & b) + (a >>> 0);
  };
  return `${text.length.toString(36)}.${h(1).toString(36)}.${h(2).toString(36)}`;
}

/** A file kept as it came in, and the stamp of what the document composed to then. */
export interface Original {
  text: string;
  stamp: string;
}

export interface Decomposed {
  /** The document's text without its state: what the row holds. */
  bare: string;
  state: StateRow[];
  /** The index's view of the document, as JSON. */
  digest: string;
  /** The file as written, when it is not what the rows compose to. */
  original: Original | null;
  /** The parsed document, state and all: what a reader of the file gets. */
  doc: Doc;
  /** Its rows of the search index. */
  search: SearchRow[];
}

/** The text a document's row and state rows make: the file, in canonical form. */
export function compose(bare: string, state: readonly StateRow[]): string {
  if (!state.length) return bare;
  return serialize(attach(parse(bare).doc, state));
}

/** A file's text taken apart for the store. */
export function decompose(text: string): Decomposed {
  const { doc } = parse(text);
  const canon = serialize(doc);
  const stripped = structuredClone(doc);
  let state = lift(stripped);
  let bare = state.length ? serialize(stripped) : canon;
  // the rows and the text must make the file again; when they would not, nothing is lifted
  if (state.length && compose(bare, state) !== canon) {
    state = [];
    bare = canon;
  }
  return {
    bare,
    state,
    digest: JSON.stringify(digest(doc)),
    original: canon === text ? null : { text, stamp: stampOf(canon) },
    doc,
    search: searchRows(doc),
  };
}

/** What a read gives: the file as it came in while the document still composes to what it did then, else the composed text. */
export function recompose(bare: string, state: readonly StateRow[], original: Original | null): string {
  const text = compose(bare, state);
  return original && stampOf(text) === original.stamp ? original.text : text;
}
