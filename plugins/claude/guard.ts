// What an edit by Claude may not do to a document: the lines the app owns
// stay as they were. A card's schedule lines (`<!-- sr … -->`) are written
// by grading and nothing else; a card keeps its `^id` while it keeps its
// schedule; a cloze group with a schedule keeps its blank; and an edit
// leaves no parse diagnostic the document did not already have. A card
// taken away goes with its schedule, which is allowed (its review history
// stays in the log). Pure over the format's parser.

import type { Card, Doc, Format } from '../ilmi.js';

const short = (t: string) => {
  const one = t.replace(/\s+/g, ' ').trim();
  return one.length > 50 ? `${one.slice(0, 47)}…` : one;
};

/** Each schedule line of a document, keyed by its card (`^id`, else its text) and its key (`''`, `r`, `cN`). */
function schedules(doc: Doc): Map<string, { card: Card; line: string }> {
  const out = new Map<string, { card: Card; line: string }>();
  for (const b of doc.blocks) {
    if (b.kind !== 'card') continue;
    const who = b.id ?? `text:${b.text}`;
    if (b.sched) out.set(`${who}|`, { card: b, line: JSON.stringify(b.sched) });
    if (b.reverse) out.set(`${who}|r`, { card: b, line: JSON.stringify(b.reverse) });
    for (const [n, s] of Object.entries(b.blanks ?? {})) out.set(`${who}|c${n}`, { card: b, line: JSON.stringify(s) });
  }
  return out;
}

const cards = (doc: Doc) => doc.blocks.filter((b): b is Card => b.kind === 'card');
/** The cloze groups a card's text numbers (`{{c2::…}}`, `{{2::…}}`). */
const groups = (text: string) => new Set([...text.matchAll(/\{\{c?(\d+)::/g)].map((m) => Number(m[1])));
const scheduled = (c: Card) => !!(c.sched || c.reverse || c.blanks);
const keyName = (k: string) => (k ? `sr ${k}` : 'sr');

/**
 * What is wrong with `after` as an edit of `before` (null: a new document),
 * as sentences Claude can act on; empty when the edit may be written.
 */
export function editProblems(format: Format, before: string | null, after: string): string[] {
  const out: string[] = [];
  const b = before === null ? null : format.parse(before);
  const a = format.parse(after);
  const old = b ? b.diagnostics.map((d) => d.message) : [];
  for (const d of a.diagnostics) {
    const i = old.indexOf(d.message);
    if (i >= 0) old.splice(i, 1);
    else out.push(`line ${d.line}: ${d.message}`);
  }
  const was = b ? schedules(b.doc) : new Map<string, { card: Card; line: string }>();
  const is = schedules(a.doc);
  const wasCards = new Map(b ? cards(b.doc).filter((c) => c.id).map((c) => [c.id!, c] as const) : []);
  const isCards = new Map(cards(a.doc).filter((c) => c.id).map((c) => [c.id!, c] as const));
  const isTexts = new Set(cards(a.doc).map((c) => c.text));

  // a card that kept its words but lost its ^id
  const dropped = new Set<string>();
  for (const [id, c] of wasCards) {
    if (isCards.has(id) || !isTexts.has(c.text) || !scheduled(c)) continue;
    dropped.add(`text:${c.text}`);
    out.push(`"${short(c.text)}" lost its ^${id}: keep the id at the end of the card's last line and its sr lines right under it`);
  }
  const by = new Map<string, { text: string; keys: string[] }>();
  const note = (kind: string, who: string, text: string, key: string) => {
    const k = `${kind}|${who}`;
    const v = by.get(k);
    if (v) v.keys.push(key); else by.set(k, { text, keys: [key] });
  };
  const keyOf = (k: string) => k.slice(k.lastIndexOf('|') + 1);
  const whoOf = (k: string) => k.slice(0, k.lastIndexOf('|'));
  for (const [k, w] of was) {
    const n = is.get(k);
    if (n && n.line !== w.line) note('changed', whoOf(k), w.card.text, keyOf(k));
    if (!n && !whoOf(k).startsWith('text:') && isCards.has(whoOf(k))) note('lost', whoOf(k), w.card.text, keyOf(k));
  }
  for (const [k, n] of is) if (!was.has(k) && !dropped.has(whoOf(k))) note('new', whoOf(k), n.card.text, keyOf(k));
  for (const [k, { text, keys }] of by) {
    const lines = keys.map(keyName).join(', ');
    if (k.startsWith('changed|')) out.push(`"${short(text)}": its ${lines} line changed; schedule lines are the app's, leave them exactly as they are`);
    else if (k.startsWith('lost|')) out.push(`"${short(text)}": its ${lines} line is gone; keep a card's sr lines right under it`);
    else out.push(`"${short(text)}" has a ${lines} line it did not have; write no sr lines, the app writes a new card's at its first review`);
  }
  for (const [id, c] of isCards) {
    const w = wasCards.get(id);
    if (w && w.text === c.text) continue;
    const has = groups(c.text);
    const orphan = Object.keys(c.blanks ?? {}).filter((n) => !has.has(Number(n)));
    if (orphan.length) out.push(`"${short(c.text)}" has a schedule for ${orphan.map((n) => `c${n}`).join(', ')} but no blank with that number; a blank keeps its number when reworded`);
  }
  return out;
}

/** The cards an edit takes away that had a schedule: said in the edit's result, so the conversation knows. */
export function removedCards(format: Format, before: string, after: string): string[] {
  const a = new Set(cards(format.parse(after).doc).map((c) => c.id ?? c.text));
  return cards(format.parse(before).doc).filter((c) => scheduled(c) && !a.has(c.id ?? c.text)).map((c) => short(c.text));
}
