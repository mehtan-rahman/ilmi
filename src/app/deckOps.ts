// What the deck browser writes and opens: a bulk action with its notice and
// undo, a card edited or made in place, and a session over one deck. The
// model is deck.ts, cardEdit.ts, and study.ts; the view is DeckBrowser.tsx.

import { PRI_DEFAULT, meta } from '../format/index.js';
import { applyEdit, insertCard } from './cardEdit.js';
import { applyBulk, bulkLine, docsUnder, restore, type BulkAction, type CardRef } from './deck.js';
import { notify } from './land.js';
import { SESSION, titleOf } from './names.js';
import type { OpenOpts } from './panes.js';
import { useApp } from './store.js';
import { studyItems, type StudyOptions } from './study.js';
import { currentVault, docsOf, note, openNode } from './vault.js';

function need() {
  const v = currentVault();
  if (!v) throw new Error('no vault open');
  return v;
}

/** A bulk action over the cards `refs` name, one write per file; its notice holds the undo (every file put back). */
export async function bulkCards(refs: readonly CardRef[], action: BulkAction): Promise<void> {
  if (!refs.length) return;
  const vault = need();
  const snaps = await applyBulk(vault, refs, action);
  const s = useApp.getState();
  // the inspector's card may be one that went
  if ((action.kind === 'delete' || action.kind === 'move') && s.selectedCard && refs.some((r) => r.path === s.selectedCard!.path)) useApp.setState({ selectedCard: null });
  const to = action.kind === 'move' ? titleOf(action.to, s.docs, s.vault) : undefined;
  const n = action.kind === 'move' ? refs.filter((r) => r.path !== action.to).length : refs.length;
  notify(bulkLine(action, n, to), null, () => restore(vault, snaps));
}

/** The document's priority, the default when it has none. */
async function docPriOf(path: string): Promise<number> {
  return meta((await need().read(path)).doc).pri ?? PRI_DEFAULT;
}

/** Save an edit made in place: the card's lines, its id and bare line kept (cardEdit.ts). One write. */
export async function saveCardEdit(ref: CardRef, text: string, pri: number | null): Promise<void> {
  const docPri = await docPriOf(ref.path);
  await need().update(ref.path, (doc) => { applyEdit(doc, ref, text, pri, docPri); });
  note('edited · card');
}

/** A new card in `path`, after the card `after` names, or at the end. Resolves to its block index. */
export async function newCardAt(path: string, after: CardRef | null, text: string, pri: number | null): Promise<number> {
  const docPri = await docPriOf(path);
  let at = -1;
  await need().update(path, (doc) => { at = insertCard(doc, after, text, pri === null || pri === docPri ? undefined : pri); });
  note('added · card');
  return at;
}

/**
 * Study the lens `id` (a deck, a folder, a document with children, `''` the
 * root): a session over its cards as `opts` says, the header naming it and
 * the end returning to it. Resolves to how many cards; with none, a notice
 * says so and nothing opens.
 */
export function studyDeck(id: string, opts: StudyOptions = {}, openOpts: OpenOpts = {}): number {
  const s = useApp.getState();
  const items = studyItems(docsOf(docsUnder(s.tree, id, s.order, s.files)), new Date(), opts);
  const title = titleOf(id, s.docs, s.vault);
  if (!items.length) {
    notify(`${opts.cram ? 'no cards' : 'nothing due'} · ${title}`);
    return 0;
  }
  useApp.setState({ session: { seq: (s.session?.seq ?? 0) + 1, items, deck: { id, title } } });
  openNode(SESSION, openOpts);
  return items.length;
}

/** Whether there is anything under `id` to study at all: a card, due or not. */
export function hasCards(id: string): boolean {
  const s = useApp.getState();
  return docsUnder(s.tree, id, s.order, s.files).some((p) => (s.docs[p]?.cards ?? 0) > 0);
}
