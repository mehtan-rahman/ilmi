// Cards from text: a pasted or dropped list split by two delimiters, one
// between a card's front and back, one between cards, written as the card
// paragraphs of FORMAT.md §5 into a deck. Pure; the intake shows the choice
// and `Vault.importDeck` lands the file. An Anki text export is recognised
// by its header lines and read by them. Milestone 17 reuses the pieces: the
// HTML reduction (`reduceCell`), the card writer (`cardText`), and the deck
// writer (`deckDoc`).

import { blanks, cardFields, parse, setField, type Card, type Doc } from '../format/index.js';
import { textOf } from './readable.js';
import { cleanText } from './text.js';

// ── delimiters ───────────────────────────────────────────────────

/** Between front and back, in detection order. */
export const SIDE_KINDS = ['prefix', 'tab', 'colons', 'dash', 'comma'] as const;
export type SideKind = (typeof SIDE_KINDS)[number];
export type SideDelim = SideKind | { custom: string };

/** Between cards, in detection order. */
export const CARD_KINDS = ['blank', 'newline', 'semicolon'] as const;
export type CardKind = (typeof CARD_KINDS)[number];
export type CardDelim = CardKind | { custom: string };

export interface Delims {
  side: SideDelim;
  card: CardDelim;
}

/** What the row's buttons say. */
export const SIDE_LABEL: Record<SideKind, string> = { prefix: 'Q: A:', tab: 'tab', colons: '::', dash: '–', comma: ',' };
export const CARD_LABEL: Record<CardKind, string> = { blank: 'blank line', newline: 'newline', semicolon: ';' };

const Q_LINE = /^\s*(?:q|question)\s*:\s*(.*)$/i;
const A_LINE = /^\s*(?:a|answer)\s*:\s*(.*)$/i;

/** The regexp a side delimiter splits a line by; the prefix pair has none. */
function sideRegex(d: SideDelim): RegExp | null {
  if (typeof d === 'object') return d.custom ? new RegExp(escapeRe(d.custom)) : null;
  switch (d) {
    case 'prefix': return null;
    case 'tab': return /\t/;
    case 'colons': return /(?<=\S)[ \t]+::[ \t]+(?=\S)/;
    case 'dash': return /(?<=\S)[ \t]+[-–—][ \t]+(?=\S)/;
    case 'comma': return /,/;
  }
}

const escapeRe = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

/** The chunks of `text`, one per card, by the delimiter between cards; blank chunks dropped. */
export function chunksOf(text: string, d: CardDelim): string[] {
  let parts: string[];
  if (typeof d === 'object') parts = d.custom ? text.split(d.custom) : [text];
  else if (d === 'blank') parts = text.split(/\n(?:[ \t]*\n)+/);
  else if (d === 'newline') parts = text.split('\n');
  else parts = text.split(';');
  return parts.map((p) => p.replace(/[ \t]+$/gm, '').replace(/^\n+|\n+$/g, '')).filter((p) => p.trim());
}

// ── what the split finds ─────────────────────────────────────────

export type Found =
  | { kind: 'pair'; front: string; back: string }
  | { kind: 'cloze'; text: string };

/** What Anki has that the format lacks, dropped and counted. */
export interface Dropped {
  /** `{{c1::answer::hint}}` written without its hint. */
  hints: number;
  /** `[sound:…]` references. */
  sounds: number;
  /** `<img>` tags. */
  images: number;
  /** Non-empty cells beside a cloze cell. */
  extra: number;
}

export const noDropped = (): Dropped => ({ hints: 0, sounds: 0, images: 0, extra: 0 });

export interface Split {
  found: Found[];
  /** Chunks that did not split, verbatim. */
  leftovers: string[];
  dropped: Dropped;
  /** The header of an Anki text export, when the text is one. */
  anki: AnkiHeader | null;
}

const SOUND = /\[sound:[^\]]*\]/g;
const IMG = /<img\b[^>]*>/gi;
const HINT = /\{\{(c?\d+::)((?:(?!\}\}).)*?)::((?:(?!\}\}).)*?)\}\}/g;

/**
 * One cell as plain text: sounds and images out, hints stripped from
 * blanks, HTML reduced to text through the intake's walker when `html`,
 * lines trimmed and blank lines dropped. Counts into `dropped`.
 */
export function reduceCell(cell: string, html: boolean, dropped: Dropped): string {
  let s = cell;
  s = s.replace(SOUND, () => { dropped.sounds++; return ' '; });
  s = s.replace(IMG, () => { dropped.images++; return ' '; });
  s = s.replace(HINT, (_m, g: string, answer: string) => { dropped.hints++; return `{{${g}${answer}}}`; });
  if (html && /[<&]/.test(s)) s = textOf(new DOMParser().parseFromString(s, 'text/html').body);
  return s.split('\n').map((l) => l.replace(/[ \t]+/g, ' ').trim()).filter(Boolean).join('\n');
}

/** Cells to what they make: a cloze from the first cell, else a pair, else nothing. Empty cells are dropped first. */
function foundOf(cells: string[], dropped: Dropped): Found | null {
  const full = cells.map((c) => c.trim()).filter(Boolean);
  const first = full[0];
  if (!first) return null;
  if (blanks(first).length) {
    dropped.extra += full.length - 1;
    return { kind: 'cloze', text: first };
  }
  if (full.length < 2) return null;
  return { kind: 'pair', front: first, back: full.slice(1).join(' / ') };
}

/** `Q:` / `A:` lines over `lines`: a card runs from a Q line to the next; `blankEnds` makes a blank line end one too. */
function splitPrefix(lines: string[], blankEnds: boolean, dropped: Dropped): { found: Found[]; leftovers: string[] } {
  const found: Found[] = [];
  const leftovers: string[] = [];
  let cur: { raw: string[]; front: string[]; back: string[] | null } | null = null;
  const close = () => {
    if (!cur) return;
    const front = cur.front.join(' ').trim();
    const back = cur.back?.join(' ').trim() ?? '';
    if (front && back) found.push({ kind: 'pair', front, back });
    else leftovers.push(cur.raw.join('\n'));
    cur = null;
  };
  for (const line of lines) {
    if (!line.trim()) { if (blankEnds) close(); continue; }
    const q = Q_LINE.exec(line);
    if (q) { close(); cur = { raw: [line], front: [q[1]!], back: null }; continue; }
    const a = cur && cur.back === null ? A_LINE.exec(line) : null;
    if (a && cur) { cur.raw.push(line); cur.back = [a[1]!]; continue; }
    if (cur) { cur.raw.push(line); (cur.back ?? cur.front).push(line.trim()); continue; }
    const lone = foundOf([line], dropped);
    if (lone) found.push(lone); else leftovers.push(line);
  }
  close();
  return { found, leftovers };
}

/** Prose does not become cards by its commas and dashes: a front from one of those is short and not a sentence. */
function plausible(d: SideDelim, f: Found): boolean {
  if (f.kind !== 'pair' || (d !== 'comma' && d !== 'dash')) return true;
  return f.front.length <= 80 && !/[.!?] /.test(f.front) && !/\t| :: /.test(f.front) && !Q_LINE.test(f.front) && !A_LINE.test(f.front);
}

/** Split `text` by the two delimiters. An Anki export is read by its header instead, whatever `d` says. */
export function splitCards(text: string, d: Delims): Split {
  const anki = ankiHeader(text);
  if (anki) return splitAnki(text, anki);
  const dropped = noDropped();
  if (d.side === 'prefix') {
    const lines = (typeof d.card === 'string' && d.card === 'semicolon' ? text.replace(/;/g, '\n') : text).split('\n');
    const blankEnds = d.card !== 'newline';
    return { ...splitPrefix(lines, blankEnds, dropped), dropped, anki: null };
  }
  const re = sideRegex(d.side);
  const found: Found[] = [];
  const leftovers: string[] = [];
  for (const chunk of chunksOf(text, d.card)) {
    const f = foundOf(re ? chunk.split(re) : [chunk], dropped);
    if (f && plausible(d.side, f)) found.push(f);
    else leftovers.push(chunk);
  }
  return { found, leftovers, dropped, anki: null };
}

// ── anki text exports ────────────────────────────────────────────

export interface AnkiHeader {
  /** The separator character, as the header gives it. */
  separator: string;
  html: boolean;
  /** 1-based columns the header names as not fields: guid, notetype, deck, tags. */
  skip: Set<number>;
  /** Lines the header took. */
  lines: number;
}

const SEP_NAMES: Record<string, string> = { tab: '\t', comma: ',', semicolon: ';', space: ' ', pipe: '|', colon: ':' };

/** The header of an Anki text export, read from its leading `#key:value` lines, or `null`. */
export function ankiHeader(text: string): AnkiHeader | null {
  const h: AnkiHeader = { separator: '\t', html: false, skip: new Set(), lines: 0 };
  let seen = false;
  for (const line of text.split('\n')) {
    const m = /^#([a-z]+(?: column)?):(.*)$/i.exec(line.trim());
    if (!m) break;
    h.lines++;
    const key = m[1]!.toLowerCase();
    const value = m[2]!.trim();
    if (key === 'separator') { seen = true; h.separator = SEP_NAMES[value.toLowerCase()] ?? value; }
    else if (key === 'html') { seen = true; h.html = /^true$/i.test(value); }
    else if (/^(guid|notetype|deck|tags) column$/.test(key)) { const n = Number(value); if (n >= 1) h.skip.add(n); }
  }
  return seen ? h : null;
}

/** Records of `text` by `sep`, quoted fields read as Anki writes them (`"` around, `""` inside, newlines kept). */
export function records(text: string, sep: string): string[][] {
  const out: string[][] = [];
  let row: string[] = [];
  let cell = '';
  let quoted = false;
  let i = 0;
  const end = () => { row.push(cell); cell = ''; if (row.some((c) => c.trim())) out.push(row); row = []; };
  while (i < text.length) {
    const c = text[i]!;
    if (quoted) {
      if (c === '"') { if (text[i + 1] === '"') { cell += '"'; i += 2; continue; } quoted = false; i++; continue; }
      cell += c; i++; continue;
    }
    if (c === '"' && cell === '') { quoted = true; i++; continue; }
    if (text.startsWith(sep, i)) { row.push(cell); cell = ''; i += sep.length; continue; }
    if (c === '\n') { end(); i++; continue; }
    cell += c; i++;
  }
  if (cell || row.length) end();
  return out;
}

function splitAnki(text: string, h: AnkiHeader): Split {
  const dropped = noDropped();
  const body = text.split('\n').slice(h.lines).join('\n');
  const found: Found[] = [];
  const leftovers: string[] = [];
  for (const row of records(body, h.separator)) {
    const cells = row.filter((_c, i) => !h.skip.has(i + 1)).map((c) => reduceCell(c, h.html, dropped));
    const f = foundOf(cells, dropped);
    if (f) found.push(f); else leftovers.push(row.join(h.separator));
  }
  return { found, leftovers, dropped, anki: h };
}

// ── detection ────────────────────────────────────────────────────

export interface Detected {
  delims: Delims;
  /** Cards the best pair found. */
  cards: number;
  anki: AnkiHeader | null;
}

/** Lines in `leftovers`. */
export const leftoverLines = (leftovers: string[]): number => leftovers.reduce((n, l) => n + l.split('\n').length, 0);

/**
 * The pair of delimiters that yields the most cards, then the fewest
 * leftover lines, then the earliest in detection order. An Anki header
 * decides by itself.
 */
export function detect(text: string): Detected {
  const anki = ankiHeader(text);
  if (anki) {
    const side: SideDelim = anki.separator === '\t' ? 'tab' : anki.separator === ',' ? 'comma' : { custom: anki.separator };
    return { delims: { side, card: 'newline' }, cards: splitAnki(text, anki).found.length, anki };
  }
  let best: Detected = { delims: { side: 'tab', card: 'newline' }, cards: 0, anki: null };
  let bestLeft = Infinity;
  // a text without a blank line is not split by blank lines, whatever a tie says
  const cardKinds: readonly CardKind[] = /\n[ \t]*\n/.test(text) ? CARD_KINDS : ['newline', 'blank', 'semicolon'];
  for (const side of SIDE_KINDS) {
    for (const card of cardKinds) {
      const s = splitCards(text, { side, card });
      const left = leftoverLines(s.leftovers);
      if (s.found.length > best.cards || (s.found.length === best.cards && s.found.length > 0 && left < bestLeft)) {
        best = { delims: { side, card }, cards: s.found.length, anki: null };
        bestLeft = left;
      }
    }
  }
  return best;
}

// ── writing ──────────────────────────────────────────────────────

/** `front :: back`, or `front ::: back` for both directions; the `?` / `??` form when a side has a line break. Null when the text would not read back as that card. */
export function cardText(front: string, back: string, both: boolean): string | null {
  const f = front.trim();
  const b = back.trim();
  if (!f || !b) return null;
  const want = both ? 'bidir' : 'qa';
  const inline = !f.includes('\n') && !b.includes('\n') ? `${f} ${both ? ':::' : '::'} ${b}` : null;
  for (const text of [inline, `${f}\n${both ? '??' : '?'}\n${b}`]) {
    if (text === null) continue;
    const got = cardFields(text);
    if (!got || got.form !== want) continue;
    const [l, r] = got.form === 'qa' ? [got.front, got.back] : [got.left, got.right];
    if (l === f && r === b) return text;
  }
  return null;
}

/** Cards from what the split found; a pair that cannot be written becomes a leftover. */
export function toCards(split: Split, both: boolean): { cards: Card[]; leftovers: string[] } {
  const cards: Card[] = [];
  const leftovers = [...split.leftovers];
  for (const f of split.found) {
    const text = f.kind === 'cloze' ? f.text : cardText(f.front, f.back, both);
    if (text !== null) cards.push({ kind: 'card', text });
    else leftovers.push(f.kind === 'cloze' ? f.text : `${f.front}\n${f.back}`);
  }
  return { cards, leftovers };
}

export const NOT_CARDS = 'not cards';

/**
 * A deck: `type: deck`, the cards as paragraphs, then what did not split
 * under `## not cards`, so nothing pasted is lost. Built as text and parsed,
 * so the blocks are what the file will read back as.
 */
export function deckDoc(cards: Card[], leftovers: string[]): Doc {
  const parts = cards.map((c) => c.text);
  if (leftovers.length) parts.push(`## ${NOT_CARDS}`, ...leftovers.map((l) => cleanText(l)).filter(Boolean));
  const { doc } = parse(parts.length ? `${parts.join('\n\n')}\n` : '');
  setField(doc, 'type', 'deck');
  return doc;
}

/** The dropped counts as one quiet phrase, or `''`. */
export function droppedLabel(d: Dropped): string {
  const parts: string[] = [];
  const add = (n: number, one: string, many = `${one}s`) => { if (n) parts.push(`${n} ${n === 1 ? one : many}`); };
  add(d.hints, 'hint');
  add(d.sounds, 'sound');
  add(d.images, 'image');
  add(d.extra, 'extra field');
  return parts.length ? `${parts.join(', ')} dropped` : '';
}
