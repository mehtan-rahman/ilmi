// The same fact twice, in the app: the pairs over the open collection
// (computed once per change of its files), and what a pair becomes: merged,
// linked, or not the same, each with its notice and undo. The model is
// same.ts; the views are the deck browser's `similar` chip and the
// inspector's `also in` line.

import { restore, type CardRef } from './deck.js';
import { notify } from './land.js';
import { linkPair, mergePair, pairKey, sameCards, similarPairs, takenIds, unlinkPair, type SameCard, type SamePair } from './same.js';
import { useApp } from './store.js';
import { allDocs, currentVault } from './vault.js';

function need() {
  const v = currentVault();
  if (!v) throw new Error('no vault open');
  return v;
}

let memo: { docs: unknown; notSame: unknown; cards: SameCard[]; pairs: SamePair[] } | null = null;

/** Whether two card lists are the same cards, in place, with the same text and links: a grade changes neither. */
const sameList = (a: readonly SameCard[], b: readonly SameCard[]): boolean =>
  a.length === b.length && a.every((x, i) => { const y = b[i]!; return x.key === y.key && x.path === y.path && x.block === y.block && x.text === y.text && x.link === y.link; });

/**
 * The collection's pairs, best first, as of its files now. Found again only
 * when a card's text, place or link changes, or the pairs said not the same
 * do: a grade rewrites an sr line and leaves the pairs as they were.
 */
export function currentPairs(): SamePair[] {
  const s = useApp.getState();
  if (memo && memo.docs === s.docs && memo.notSame === s.notSame) return memo.pairs;
  const cards = sameCards(allDocs());
  if (memo && memo.notSame === s.notSame && sameList(memo.cards, cards)) {
    memo = { ...memo, docs: s.docs, cards };
    return memo.pairs;
  }
  memo = { docs: s.docs, notSame: s.notSame, cards, pairs: similarPairs(cards, s.notSame) };
  return memo.pairs;
}

/** The collection's cards as the finder keyed them. */
export function currentCards(): SameCard[] {
  currentPairs();
  return memo?.cards ?? [];
}

/** The pairs a card is in, best first, with the other card on the right. */
export function pairsOf(path: string, block: number): { pair: SamePair; other: SameCard }[] {
  const out: { pair: SamePair; other: SameCard }[] = [];
  for (const p of currentPairs()) {
    if (p.a.path === path && p.a.block === block) out.push({ pair: p, other: p.b });
    else if (p.b.path === path && p.b.block === block) out.push({ pair: p, other: p.a });
  }
  return out;
}

/** The card a link names, where it is now: by id over the collection. */
export function linkedTo(id: string): SameCard | undefined {
  return currentCards().find((c) => c.id === id);
}

export const refOf = (c: SameCard): CardRef => (c.id === undefined ? { path: c.path, block: c.block, text: c.text } : { path: c.path, block: c.block, id: c.id, text: c.text });

/** Link the two cards of a pair: one schedule, the stronger; one of them a day. Its notice holds the undo. */
export async function linkCards(a: SameCard, b: SameCard): Promise<void> {
  const vault = need();
  const snaps = await linkPair(vault, refOf(a), refOf(b), takenIds(allDocs()));
  notify('linked · 2 cards', null, () => restore(vault, snaps));
}

/** Take a link off both cards. Its notice holds the undo. */
export async function unlinkCards(a: SameCard, b: SameCard): Promise<void> {
  const vault = need();
  const snaps = await unlinkPair(vault, refOf(a), refOf(b));
  notify('unlinked · 2 cards', null, () => restore(vault, snaps));
}

/** Merge a pair into `keep`, where it is, with the stronger schedule; `drop` removed. Its notice holds the undo. */
export async function mergeCards(keep: SameCard, drop: SameCard): Promise<void> {
  const vault = need();
  const snaps = await mergePair(vault, refOf(keep), refOf(drop));
  const s = useApp.getState();
  if (s.selectedCard && s.selectedCard.path === drop.path && s.selectedCard.index === drop.block) useApp.setState({ selectedCard: null });
  notify('merged · 2 cards into 1', null, () => restore(vault, snaps));
}

async function saveNotSame(keys: string[]): Promise<void> {
  useApp.setState({ notSame: keys });
  await need().saveNotSame(keys);
}

/** Remember that two cards are not the same fact (`.ilmi/same.json`): the pair is never listed again. Its notice holds the undo. */
export async function notTheSame(a: SameCard, b: SameCard): Promise<void> {
  const key = pairKey(a.key, b.key);
  const was = useApp.getState().notSame;
  if (was.includes(key)) return;
  await saveNotSame([...was, key]);
  notify('not the same · 2 cards', null, () => saveNotSame(useApp.getState().notSame.filter((k) => k !== key)));
}
