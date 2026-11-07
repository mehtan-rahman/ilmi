// A quick card (milestone 56): `+` at the foot of the phone opens the composer
// with front and back, and the card lands in a deck: the one in front when a
// deck is, else the one chosen last on this device (`lastDeck`, in the
// collection's view state, which never syncs), else the first in the tree.

import { docTargets } from './deck.js';
import { activeTab } from './panes.js';
import { notify } from './land.js';
import { useApp, type DocInfo } from './store.js';

/** The decks of the collection, in the tree's order. */
export function deckPaths(paths: readonly string[], docs: Record<string, DocInfo>): string[] {
  return paths.filter((p) => docs[p]?.type === 'deck');
}

/** Where a new quick card starts: the deck in front, else the last chosen while it is there, else the first. */
export function deckFor(decks: readonly string[], front: string | undefined, last: string | null): string | null {
  if (front !== undefined && decks.includes(front)) return front;
  if (last !== null && decks.includes(last)) return last;
  return decks[0] ?? null;
}

/** The decks as the app has them now. */
export function decksNow(): string[] {
  const s = useApp.getState();
  return deckPaths(docTargets(s.tree, s.order).map((t) => t.path), s.docs);
}

/** `+`: the composer over whatever is in front. A collection with no deck has nowhere to put a card. */
export function openQuickCard(): void {
  const s = useApp.getState();
  const deck = deckFor(decksNow(), activeTab(s.panes)?.id, s.lastDeck);
  if (deck === null) { notify('no deck yet'); return; }
  useApp.setState({ quickCard: { deck }, sideSheet: false });
}
