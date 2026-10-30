// Cards from an Anki package: the plain data `read_anki_package` returns on
// the Rust side (`src-tauri/src/anki.rs`) mapped to one deck document per
// Anki deck, after `supermemo/docs.ts`. Pure. Fields go through the same
// reduction as an Anki text export (`reduceCell`), cards are written with
// `cardText` and `deckDoc`, and a review card's progress seeds an `sr` line
// the way `seedOf` does for SuperMemo. What the format lacks is dropped and
// counted, never guessed at.

import { blanks, type Card, type CardSchedule, type Doc } from '../format/index.js';
import { addDays, dayOf } from '../schedule/dates.js';
import { fileName } from '../vault/paths.js';
import { cardText, deckDoc, noDropped, reduceCell, type Dropped } from './cards.js';

// ── what the Rust side returns ───────────────────────────────────

export interface AnkiPackage {
  /** The collection's creation time, an epoch in seconds at local midnight; a review card's `due` counts days from it. */
  crt: number;
  schema: number;
  /** The form of the package's `media` entry; nothing is read from it yet. */
  media: 'json' | 'zstd' | 'other' | 'none';
  decks: AnkiDeck[];
  notetypes: AnkiNotetype[];
  notes: AnkiNote[];
  cards: AnkiCard[];
}

export interface AnkiDeck {
  id: number;
  /** `Parent::Child`. */
  name: string;
}

export interface AnkiNotetype {
  id: number;
  name: string;
  fields: string[];
  cloze: boolean;
  templates: { name: string; front: string }[];
}

export interface AnkiNote {
  id: number;
  notetype: number;
  fields: string[];
  tags: string[];
}

export interface AnkiCard {
  id: number;
  note: number;
  /** The template index, or the cloze group minus one. */
  ord: number;
  deck: number;
  /** 0 new, 1 learning, 2 review, 3 relearning. */
  type: number;
  queue: number;
  ivl: number;
  /** Days since `crt` for a review card. */
  due: number;
  /** Ease × 1000. */
  factor: number;
  reps: number;
  lapses: number;
}

// ── what the mapping makes ───────────────────────────────────────

export interface AnkiDropped extends Dropped {
  /** Schedules beyond the one a card keeps: a reversed note's second card, the rest of a many-template note's. */
  schedules: number;
  /** Notes that made no card: cells empty after reduction, or a text no card form reads back as itself. */
  notes: number;
}

export interface MappedDeck {
  /** The Anki name, `Parent::Child`. */
  name: string;
  /** Folders above the file, one per segment but the last. */
  dir: string[];
  /** The last segment: the deck's own name, the document's title. */
  title: string;
  doc: Doc;
  cards: number;
  /** Cards that carry a seeded schedule. */
  scheduled: number;
}

export interface Mapped {
  decks: MappedDeck[];
  /** Decks with no cards, skipped. */
  empty: number;
  /** Notes from notetypes that are neither basic, reversed, nor cloze, written as `first field :: the rest`. */
  other: number;
  dropped: AnkiDropped;
  media: AnkiPackage['media'];
}

// ── progress ─────────────────────────────────────────────────────

/** The collection's first day. `crt` is midnight where the collection was made; read at noon so the day holds in any zone within twelve hours. */
export const creationDay = (crt: number): string => dayOf(new Date((crt + 43_200) * 1000));

/** FSRS difficulty from Anki's ease on a straight line, 2500 → 5 and 1300 → 8, clamped to 1–10, to one decimal. */
export function difficultyOf(factor: number): number {
  const d = 5 + (2500 - factor) * 0.0025;
  return Math.min(10, Math.max(1, Math.round(d * 10) / 10));
}

/** A review card's seeded `sr` line, as `seedOf` makes SuperMemo's; `null` for a new, learning, or relearning card. */
export function seedOf(card: AnkiCard, day0: string): CardSchedule | null {
  if (card.type !== 2) return null;
  const due = addDays(day0, card.due);
  return {
    due,
    state: 'review',
    stability: card.ivl,
    difficulty: difficultyOf(card.factor),
    reps: card.reps,
    lapses: card.lapses,
    ivl: card.ivl,
    last: addDays(due, -card.ivl),
  };
}

// ── notetypes ────────────────────────────────────────────────────

export type NotetypeKind = 'basic' | 'reversed' | 'cloze' | 'other';

const refs = (front: string, field: string | undefined): boolean =>
  field !== undefined && new RegExp(`\\{\\{(?:[\\w-]+:)*${field.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\}\\}`).test(front);

/** Basic: one template. Reversed: two, the second's front showing the second field and not the first. Cloze by its flag. */
export function kindOf(nt: AnkiNotetype): NotetypeKind {
  if (nt.cloze) return 'cloze';
  if (nt.templates.length === 1) return 'basic';
  const second = nt.templates[1]?.front ?? '';
  if (nt.templates.length === 2 && refs(second, nt.fields[1]) && !refs(second, nt.fields[0])) return 'reversed';
  return 'other';
}

// ── notes ────────────────────────────────────────────────────────

/**
 * The card a note becomes, with its cards' progress: a cloze from the first
 * field written whole, `sr cN` per group (the bare line when there is one
 * group); a pair from the first field and the rest, `:::` on a reversed
 * note that has its reverse card, the forward card's schedule on the bare
 * line and the reverse card's on `sr r` (FORMAT.md §6.2), any other
 * card's counted. `null` when the note makes no card.
 */
export function cardOf(note: AnkiNote, nt: AnkiNotetype, cards: AnkiCard[], day0: string, dropped: AnkiDropped): { card: Card; other: boolean } | null {
  const cells = note.fields.map((f) => reduceCell(f, true, dropped));
  const kind = kindOf(nt);
  const sorted = [...cards].sort((a, b) => a.ord - b.ord);
  if (kind === 'cloze') {
    const text = cells[0] ?? '';
    const groups = new Set(blanks(text).map((b) => b.n));
    if (!text || !groups.size) return null;
    dropped.extra += cells.slice(1).filter(Boolean).length;
    const card: Card = { kind: 'card', text };
    for (const c of sorted) {
      const s = seedOf(c, day0);
      if (!s) continue;
      const n = c.ord + 1;
      if (!groups.has(n)) { dropped.schedules++; continue; }
      if (groups.size === 1) card.sched = s;
      else (card.blanks ??= {})[n] = s;
    }
    return { card, other: false };
  }
  const full = cells.filter(Boolean);
  if (full.length < 2) return null;
  const both = kind === 'reversed' && sorted.some((c) => c.ord === 1);
  const text = cardText(full[0]!, full.slice(1).join(' / '), both);
  if (text === null) return null;
  const card: Card = { kind: 'card', text };
  const [first, ...rest] = sorted;
  const s = first ? seedOf(first, day0) : null;
  if (s) card.sched = s;
  // both ways: the reverse card's progress lands on the card's `sr r` line
  const back = both && first?.ord === 0 ? rest.find((c) => c.ord === 1) : undefined;
  const r = back ? seedOf(back, day0) : null;
  if (r) card.reverse = r;
  dropped.schedules += rest.filter((c) => c !== back && c.type === 2).length;
  return { card, other: kind === 'other' };
}

// ── the package ──────────────────────────────────────────────────

const hasProgress = (c: Card): boolean => !!c.sched || !!c.reverse || !!c.blanks;

/** Every deck with cards as a deck document, in name order; what was dropped, counted. */
export function mapPackage(pkg: AnkiPackage): Mapped {
  const day0 = creationDay(pkg.crt);
  const dropped: AnkiDropped = { ...noDropped(), schedules: 0, notes: 0 };
  let other = 0;
  let empty = 0;
  const notetypes = new Map(pkg.notetypes.map((n) => [n.id, n]));
  const notes = new Map(pkg.notes.map((n) => [n.id, n]));
  // a deck's cards by note, in the order the cards were made
  const byDeck = new Map<number, Map<number, AnkiCard[]>>();
  for (const c of [...pkg.cards].sort((a, b) => a.id - b.id)) {
    const deck = byDeck.get(c.deck) ?? new Map<number, AnkiCard[]>();
    byDeck.set(c.deck, deck);
    deck.set(c.note, [...(deck.get(c.note) ?? []), c]);
  }
  const decks: MappedDeck[] = [];
  for (const d of [...pkg.decks].sort((a, b) => a.name.localeCompare(b.name))) {
    const group = byDeck.get(d.id);
    const cards: Card[] = [];
    for (const [nid, cs] of group ?? []) {
      const note = notes.get(nid);
      const nt = note && notetypes.get(note.notetype);
      const r = note && nt ? cardOf(note, nt, cs, day0, dropped) : null;
      if (!r) { dropped.notes++; continue; }
      if (r.other) other++;
      cards.push(r.card);
    }
    if (!cards.length) { empty++; continue; }
    const segments = d.name.split('::').map((s) => s.trim()).filter(Boolean);
    const title = segments.pop() ?? d.name;
    decks.push({ name: d.name, dir: segments.map(fileName), title, doc: deckDoc(cards, []), cards: cards.length, scheduled: cards.filter(hasProgress).length });
  }
  return { decks, empty, other, dropped, media: pkg.media };
}

/** The deck's name as it will land: `Parent / Child`. */
export const deckLabel = (d: MappedDeck): string => [...d.dir, d.title].join(' / ');
