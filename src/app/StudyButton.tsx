// `study` in the reader's top row (milestone 37): on any note or source
// with cards in it or under it, a session over those that are due, as the
// node menu's `study` and the deck lens's button run it (32's `studyDeck`):
// its header names the document, its end comes back here.

import { docsUnder } from './deck.js';
import { studyDeck } from './deckOps.js';
import { useApp } from './store.js';

export function StudyButton({ path }: { path: string }) {
  const tree = useApp((s) => s.tree);
  const order = useApp((s) => s.order);
  const files = useApp((s) => s.files);
  const docs = useApp((s) => s.docs);
  const type = docs[path]?.type;
  // a deck has its own browser and button
  if (!type || type === 'deck') return null;
  const n = docsUnder(tree, path, order, files).reduce((sum, p) => sum + (docs[p]?.cards ?? 0), 0);
  if (!n) return null;
  return (
    <button type="button" className="frozen-tag study-btn" title="the cards here that are due" onClick={() => { studyDeck(path); }}>
      study
    </button>
  );
}
