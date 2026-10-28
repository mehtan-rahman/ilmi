// A card edited in place in the deck lens: its two faces, the form switch,
// and what an edit does to the schedule. Pure; the view is `CardEditor` in
// CardEditor.tsx, and the write is one `vault.update` of the card's file.
//
// The rules (PLAN 32): the card's lines change and its `sr` line and id
// stay; a form change keeps the bare line and drops group lines whose blank
// is gone, asking first when one carries reviews. When the card had no bare
// line and the new form has no blanks to hold a group line, the lowest
// group's line becomes the bare one, so a one-blank cloze from Anki turned
// into a q&a keeps its history.

import { blanks, cardFields, clozeGroups, clozeParts, type Card, type CardForm, type CardSchedule, type Doc } from '../format/index.js';
import { cardText } from '../reader/index.js';
import { findCard, type CardRef } from './deck.js';

/** The two faces as the editor holds them; a cloze has one, its text. */
export interface Faces {
  form: CardForm;
  front: string;
  back: string;
}

export function facesOf(text: string): Faces | null {
  const f = cardFields(text);
  if (!f) return null;
  if (f.form === 'cloze') return { form: 'cloze', front: text, back: '' };
  return f.form === 'qa' ? { form: 'qa', front: f.front, back: f.back } : { form: 'bidir', front: f.left, back: f.right };
}

/** The paragraph the faces are written as, or null when the format would not read it back as that card. */
export function facesText(f: Faces): string | null {
  if (f.form === 'cloze') return cardText({ form: 'cloze', text: f.front });
  if (f.form === 'qa') return cardText({ form: 'qa', front: f.front, back: f.back });
  return cardText({ form: 'bidir', left: f.front, right: f.back });
}

/** What a cloze's first blank stands for on a two-sided card's front. */
export const BLANK_MARK = '[…]';

/**
 * The faces in another form. q&a ⇄ both ways keep both faces (the
 * separator changes); a two-sided card to cloze puts the back after the
 * front as `{{c1::…}}`; a cloze to a two-sided card takes the first blank's
 * answer as the back and the text, that blank shown as `[…]` and the
 * others filled in, as the front.
 */
export function switchForm(f: Faces, to: CardForm): Faces {
  if (f.form === to) return f;
  if (to === 'cloze') {
    if (f.form === 'cloze') return f;
    const front = f.front.trim();
    const back = f.back.trim();
    return { form: 'cloze', front: back ? `${front} {{c1::${back}}}` : front, back: '' };
  }
  if (f.form !== 'cloze') return { form: to, front: f.front, back: f.back };
  let first: string | null = null;
  const front = clozeParts(f.front).map((p) => {
    if (typeof p === 'string') return p;
    if (first === null) { first = p.answer; return BLANK_MARK; }
    return p.answer;
  }).join('');
  return { form: to, front, back: first ?? '' };
}

/** A group line that an edit would drop: its number, and how many reviews it carries. */
export interface Dropped {
  n: number;
  reps: number;
}

export interface Plan {
  card: Card;
  /** Group lines dropped; any with reviews means the editor asks first. */
  dropped: Dropped[];
}

/**
 * The card after its text becomes `text`: id, bare line, and extract
 * backrefs kept; a group line kept while its numbered blank is still in
 * the text; the rest dropped, the lowest becoming the bare line when the
 * card had none and nothing else would hold it.
 */
export function planEdit(card: Card, text: string): Plan {
  const next: Card = structuredClone(card);
  next.text = text;
  const keep = new Set(blanks(text).length ? clozeGroups(text) : []);
  const lines = Object.entries(card.blanks ?? {}).map(([n, s]) => [Number(n), s] as [number, CardSchedule]).sort((a, b) => a[0] - b[0]);
  const kept: Record<number, CardSchedule> = {};
  const gone: [number, CardSchedule][] = [];
  for (const [n, s] of lines) (keep.has(n) ? (kept[n] = structuredClone(s)) : gone.push([n, s]));
  // a two-sided card, or a cloze with no numbered blank, is graded on the bare line: the lowest old group line can become it
  const own = card.sched ?? {};
  const hasBare = Object.keys(own).some((k) => k !== 'pri' && k !== 'suspended');
  if (!hasBare && keep.size === 0 && gone.length) {
    const [, s] = gone.shift()!;
    const bare: CardSchedule = { ...structuredClone(s) };
    delete bare.suspended;
    if (own.pri !== undefined) bare.pri = own.pri;
    if (own.suspended || s.suspended) bare.suspended = true;
    next.sched = bare;
  }
  if (Object.keys(kept).length) next.blanks = kept;
  else delete next.blanks;
  return { card: next, dropped: gone.map(([n, s]) => ({ n, reps: s.reps ?? 0 })) };
}

/** True when the plan would drop a schedule that has been reviewed: ask first. */
export const asks = (p: Plan): boolean => p.dropped.some((d) => d.reps > 0);

/** The card's own priority after the editor's field: absent when it says what the document says. */
export function withPri(card: Card, pri: number | null, docPri: number): void {
  const own = pri === null || pri === docPri ? undefined : pri;
  if (own === undefined) {
    if (card.sched) delete card.sched.pri;
  } else {
    card.sched = { ...card.sched, pri: own };
  }
  if (card.sched && !Object.keys(card.sched).length) delete card.sched;
}

/**
 * Apply an edit inside `vault.update`: the card `ref` names gets `text`
 * (by `planEdit`) and the priority. Throws when the card is no longer there.
 */
export function applyEdit(doc: Doc, ref: CardRef, text: string, pri: number | null, docPri: number): Card {
  const card = findCard(doc, ref);
  if (!card) throw new Error(`${ref.path}: card ${ref.id ?? `#${ref.block}`} not found`);
  const { card: next } = planEdit(card, text);
  withPri(next, pri, docPri);
  doc.blocks[doc.blocks.indexOf(card)] = next;
  return next;
}

/**
 * A new card in `doc` after the card `after` names (the cursor's row), or
 * at the end when there is none or it is gone. Resolves to its block index.
 */
export function insertCard(doc: Doc, after: CardRef | null, text: string, pri?: number): number {
  const card: Card = pri === undefined ? { kind: 'card', text } : { kind: 'card', text, sched: { pri } };
  const at = after ? findCard(doc, after) : null;
  const i = at ? doc.blocks.indexOf(at) + 1 : doc.blocks.length;
  doc.blocks.splice(i, 0, card);
  return i;
}
