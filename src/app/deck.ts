// The deck browser's pure side: the rows a deck (or a folder, or a document
// with children) lists, the search, the filter chips, the sorts, the
// selection, and the bulk actions, each one write per file. The view is
// `DeckLens` in Lenses.tsx; the session over a deck is `study.ts`.

import { PRI_DEFAULT, cardFields, meta, type Card, type CardForm, type CardSchedule, type Doc } from '../format/index.js';
import { cardGroups, isSuspended, newId, whenToDate, type GroupKey } from '../schedule/index.js';
import { childDirOf, directories, ordered, type Order, type TreeNode } from '../vault/index.js';

// ── the rows ─────────────────────────────────────────────────────

/** What a row's state chip tests: `learning` holds relearning too; `due` and the three states leave suspended cards out. */
export type StateChip = 'new' | 'learning' | 'review' | 'due' | 'suspended';
export const STATE_CHIPS: readonly StateChip[] = ['new', 'learning', 'review', 'due', 'suspended'];
export const FORM_CHIPS: readonly [CardForm, string][] = [['qa', 'q&a'], ['cloze', 'cloze'], ['bidir', 'both ways']];

export type DeckSort = 'order' | 'due' | 'interval' | 'difficulty' | 'lapses' | 'last' | 'created';
export const SORTS: readonly [DeckSort, string][] = [
  ['order', 'deck order'], ['due', 'due'], ['interval', 'interval'], ['difficulty', 'difficulty'],
  ['lapses', 'lapses'], ['last', 'last reviewed'], ['created', 'created'],
];

/** A card where it was seen: the file, the block, and its id and text to find it again if the index has gone stale. */
export interface CardRef {
  path: string;
  block: number;
  id?: string;
  text: string;
}

export interface DeckRow extends CardRef {
  /** `path#block`: unique while the files are as they were read. */
  key: string;
  form: CardForm;
  /** Place among every row of the lens, in deck order (file by file, block by block). */
  pos: number;
  /** The schedule the row shows: the card's, or for a cloze of several blanks the soonest unsuspended blank's. */
  sched?: CardSchedule;
  state: 'new' | 'learning' | 'review';
  dueAt: Date;
  /** The whole card: its bare line, or every blank. */
  suspended: boolean;
  isDue: boolean;
  /** The card's own priority, else its document's. */
  pri: number;
  /** Front and back, folded, for the search. */
  hay: string;
}

/** Case and accents folded, so `Lucke` finds `Lücke` and Arabic without its vowel marks finds the voweled word. */
export function fold(s: string): string {
  return s.normalize('NFKD').replace(/[\p{M}ـ]/gu, '').toLowerCase();
}

/** The text a card's search looks through: both faces, a cloze's answers in place. */
export function faceText(text: string): string {
  const f = cardFields(text);
  if (!f) return text;
  if (f.form === 'cloze') return f.parts.map((p) => (typeof p === 'string' ? p : p.answer)).join('');
  return f.form === 'qa' ? `${f.front}\n${f.back}` : `${f.left}\n${f.right}`;
}

const groupSched = (card: Card, g: GroupKey): CardSchedule | undefined =>
  ('n' in g ? card.blanks?.[g.n] : undefined) ?? card.sched;

const dueOf = (s: CardSchedule | undefined, now: Date): Date => (s?.due ? whenToDate(s.due) : now);

/** The rows of one document's cards. `pos` counts on from `from`. */
export function docRows(path: string, doc: Doc, now: Date, from = 0): DeckRow[] {
  const docPri = meta(doc).pri ?? PRI_DEFAULT;
  const out: DeckRow[] = [];
  doc.blocks.forEach((b, block) => {
    if (b.kind !== 'card') return;
    const f = cardFields(b.text);
    if (!f) return;
    const groups = f.form === 'cloze' ? cardGroups(b.text) : [];
    const live = groups.filter((g) => !isSuspended(b, g));
    const suspended = groups.length ? live.length === 0 : isSuspended(b);
    // the soonest of the blanks still in the queue, else the soonest of all
    const pick = (gs: GroupKey[]) => gs.map((g) => groupSched(b, g)).sort((x, y) => dueOf(x, now).getTime() - dueOf(y, now).getTime())[0];
    const sched = groups.length ? pick(live.length ? live : groups) : b.sched;
    const st = sched?.state ?? 'new';
    const dueAt = dueOf(sched, now);
    const row: DeckRow = {
      key: `${path}#${block}`, path, block, text: b.text, form: f.form, pos: from + out.length,
      state: st === 'relearning' ? 'learning' : st, dueAt, suspended, isDue: !suspended && dueAt <= now,
      pri: b.sched?.pri ?? docPri, hay: fold(faceText(b.text)),
    };
    if (b.id !== undefined) row.id = b.id;
    if (sched) row.sched = sched;
    out.push(row);
  });
  return out;
}

/** Every row over a list of documents, in that order. */
export function deckRows(docs: Iterable<[string, Doc]>, now: Date): DeckRow[] {
  const out: DeckRow[] = [];
  for (const [path, doc] of docs) out.push(...docRows(path, doc, now, out.length));
  return out;
}

/**
 * The documents a lens over `id` holds, in the tree's order: a document and
 * everything under it (its children directory, all the way down); a folder,
 * or a document's children directory, everything under it, the document
 * itself first.
 */
export function docsUnder(tree: TreeNode[], id: string, order: Order, files: readonly string[]): string[] {
  const out: string[] = [];
  const dirs = directories(tree);
  const visit = (dir: string) => {
    for (const n of ordered(dirs.get(dir) ?? [], order[dir])) {
      if (n.kind === 'doc') out.push(n.path);
      visit(childDirOf(n.path));
    }
  };
  if (id.endsWith('.md')) out.push(id);
  else if (id !== '' && files.includes(`${id}.md`)) out.push(`${id}.md`);
  visit(childDirOf(id));
  return out;
}

/** Every document a card can move to, depth first in the tree's order, with how deep it sits (30's nested list, documents only). */
export function docTargets(tree: TreeNode[], order: Order): { path: string; depth: number }[] {
  const out: { path: string; depth: number }[] = [];
  const dirs = directories(tree);
  const visit = (dir: string, depth: number) => {
    for (const n of ordered(dirs.get(dir) ?? [], order[dir])) {
      if (n.kind === 'doc') out.push({ path: n.path, depth });
      visit(childDirOf(n.path), depth + 1);
    }
  };
  visit('', 0);
  return out;
}

// ── search, filter, sort ─────────────────────────────────────────

/** What the bar holds and what is remembered per deck (the search is not). */
export interface DeckView {
  forms: CardForm[];
  states: StateChip[];
  sort: DeckSort;
}

export const DEFAULT_VIEW: DeckView = { forms: [], states: [], sort: 'order' };

/** A remembered view as read from `.ilmi/state.json`: anything unknown dropped. */
export function cleanView(raw: unknown): DeckView {
  const o = raw && typeof raw === 'object' ? (raw as Record<string, unknown>) : {};
  const list = <T extends string>(v: unknown, ok: readonly T[]): T[] => (Array.isArray(v) ? v.filter((x): x is T => ok.includes(x as T)) : []);
  const sort = SORTS.some(([s]) => s === o.sort) ? (o.sort as DeckSort) : 'order';
  return { forms: list(o.forms, FORM_CHIPS.map(([f]) => f)), states: list(o.states, STATE_CHIPS), sort };
}

export function cleanViews(raw: unknown): Record<string, DeckView> {
  const out: Record<string, DeckView> = {};
  if (raw && typeof raw === 'object' && !Array.isArray(raw)) for (const [k, v] of Object.entries(raw)) out[k] = cleanView(v);
  return out;
}

const stateMatch = (r: DeckRow, s: StateChip): boolean =>
  s === 'suspended' ? r.suspended : !r.suspended && (s === 'due' ? r.isDue : r.state === s);

/** The rows the search and the chips let through: every word of the search in either face; any chip of a kind. */
export function filterRows(rows: DeckRow[], q: string, view: DeckView): DeckRow[] {
  const words = fold(q).split(/\s+/).filter(Boolean);
  return rows.filter((r) =>
    words.every((w) => r.hay.includes(w))
    && (!view.forms.length || view.forms.includes(r.form))
    && (!view.states.length || view.states.some((s) => stateMatch(r, s))));
}

const never = Number.POSITIVE_INFINITY;

/**
 * Sorted, a copy: deck order; soonest due; shortest interval (new first);
 * hardest first; most lapses first; most recently reviewed first; created,
 * newest first (the format keeps no date on a card, and a new card is
 * written at the end of its file, so this is deck order backwards). Ties
 * keep deck order.
 */
export function sortRows(rows: DeckRow[], sort: DeckSort): DeckRow[] {
  const key = (r: DeckRow): number => {
    const s = r.sched;
    switch (sort) {
      case 'order': return r.pos;
      case 'due': return r.dueAt.getTime();
      case 'interval': return s?.ivl ?? 0;
      case 'difficulty': return s?.difficulty !== undefined ? -s.difficulty : never;
      case 'lapses': return -(s?.lapses ?? 0);
      case 'last': return s?.last ? -whenToDate(s.last).getTime() : never;
      case 'created': return -r.pos;
    }
  };
  return [...rows].sort((a, b) => key(a) - key(b) || a.pos - b.pos);
}

/** `12 of 340`, or the one number when nothing is held back. */
export const countLabel = (shown: number, total: number): string => (shown === total ? `${total}` : `${shown} of ${total}`);

// ── selection ────────────────────────────────────────────────────

export interface Selection {
  keys: string[];
  /** Where a ⇧-click's range starts: the last plain or ⌘ click. */
  anchor: string | null;
}

export const NO_SELECTION: Selection = { keys: [], anchor: null };

/** A click on the row `key` with `shown` the rows in view, in view order: alone, a range (⇧), or toggled (⌘). */
export function clickSelect(sel: Selection, key: string, mods: { shift?: boolean; meta?: boolean }, shown: readonly string[]): Selection {
  if (mods.shift && sel.anchor !== null && shown.includes(sel.anchor)) {
    const a = shown.indexOf(sel.anchor);
    const b = shown.indexOf(key);
    const [lo, hi] = a < b ? [a, b] : [b, a];
    return { keys: shown.slice(lo, hi + 1), anchor: sel.anchor };
  }
  if (mods.meta) {
    const keys = sel.keys.includes(key) ? sel.keys.filter((k) => k !== key) : [...sel.keys, key];
    return { keys, anchor: key };
  }
  return { keys: [key], anchor: key };
}

/** ⌘A: every row shown. */
export const selectAll = (shown: readonly string[]): Selection => ({ keys: [...shown], anchor: shown[0] ?? null });

/** The selection kept to rows still shown, in view order. */
export function selectedRows(sel: Selection, shown: readonly DeckRow[]): DeckRow[] {
  const keys = new Set(sel.keys);
  return shown.filter((r) => keys.has(r.key));
}

// ── finding a card again ─────────────────────────────────────────

/** The card `ref` names in `doc`: at its block when it is still the same card there, else by id, else by text. */
export function findCard(doc: Doc, ref: CardRef): Card | null {
  const at = doc.blocks[ref.block];
  if (at?.kind === 'card' && (ref.id !== undefined ? at.id === ref.id : at.text === ref.text)) return at;
  if (ref.id !== undefined) return doc.blocks.find((b): b is Card => b.kind === 'card' && b.id === ref.id) ?? null;
  return doc.blocks.find((b): b is Card => b.kind === 'card' && b.text === ref.text) ?? null;
}

// ── bulk actions ─────────────────────────────────────────────────

export type BulkAction =
  | { kind: 'delete' }
  | { kind: 'suspend' }
  | { kind: 'unsuspend' }
  | { kind: 'reset' }
  /** A card's own priority; null goes back to the document's. */
  | { kind: 'pri'; pri: number | null }
  | { kind: 'move'; to: string };

/** What a bulk action needs of a vault: the cache's read and the one write. */
export interface CardStore {
  read(path: string, fresh?: boolean): Promise<{ doc: Doc }>;
  update(path: string, mutate: (doc: Doc) => void): Promise<unknown>;
}

/** A file as it was before an action, for its undo. */
export interface Snapshot {
  path: string;
  doc: Doc;
}

function tidy(card: Card): void {
  if (card.sched && !Object.keys(card.sched).length) delete card.sched;
  if (card.blanks && !Object.keys(card.blanks).length) delete card.blanks;
}

/** One card changed in place by `action` (not delete, not move). */
export function changeCard(card: Card, action: BulkAction): void {
  switch (action.kind) {
    case 'suspend':
      card.sched = { ...card.sched, suspended: true };
      break;
    case 'unsuspend':
      if (card.sched) delete card.sched.suspended;
      for (const s of Object.values(card.blanks ?? {})) delete s.suspended;
      break;
    case 'reset': {
      // the schedule goes; what is the card's and not the scheduler's stays
      const pri = card.sched?.pri;
      const sus = card.sched?.suspended;
      delete card.sched;
      delete card.blanks;
      if (pri !== undefined || sus) card.sched = { ...(pri !== undefined ? { pri } : {}), ...(sus ? { suspended: true as const } : {}) };
      break;
    }
    case 'pri':
      if (action.pri === null) { if (card.sched) delete card.sched.pri; }
      else card.sched = { ...card.sched, pri: action.pri };
      break;
    default:
      break;
  }
  tidy(card);
}

const byPath = (refs: readonly CardRef[]): Map<string, CardRef[]> => {
  const out = new Map<string, CardRef[]>();
  for (const r of refs) out.set(r.path, [...(out.get(r.path) ?? []), r]);
  return out;
};

const usedIds = (doc: Doc): Set<string> => {
  const ids = new Set<string>();
  for (const b of doc.blocks) if ((b.kind === 'card' || b.kind === 'paragraph') && b.id) ids.add(b.id);
  return ids;
};

/**
 * Apply `action` to the cards `refs` name: one `update` per file (a move
 * writes the destination once, first, then each source once, so a failure
 * between leaves a duplicate rather than a loss). Resolves to each file as
 * it was before, in the order written, for the undo.
 */
export async function applyBulk(store: CardStore, refs: readonly CardRef[], action: BulkAction): Promise<Snapshot[]> {
  const groups = byPath(refs);
  const snaps: Snapshot[] = [];
  const snap = async (path: string) => { snaps.push({ path, doc: structuredClone((await store.read(path, true)).doc) }); };
  if (action.kind === 'move') {
    groups.delete(action.to);
    if (!groups.size) return [];
    // the cards as they are on disk now, extract backrefs left behind as on delete
    const moving: Card[] = [];
    for (const [path, list] of groups) {
      const doc = (await store.read(path, true)).doc;
      for (const r of list) {
        const c = findCard(doc, r);
        if (!c) continue;
        const copy = structuredClone(c);
        delete copy.extracts;
        moving.push(copy);
      }
    }
    await snap(action.to);
    await store.update(action.to, (doc) => {
      const taken = usedIds(doc);
      for (const c of moving) {
        const card = structuredClone(c);
        if (card.id !== undefined && taken.has(card.id)) { do card.id = newId(); while (taken.has(card.id)); }
        if (card.id !== undefined) taken.add(card.id);
        doc.blocks.push(card);
      }
    });
  }
  for (const [path, list] of groups) {
    await snap(path);
    await store.update(path, (doc) => {
      const cards = list.map((r) => findCard(doc, r)).filter((c): c is Card => c !== null);
      if (action.kind === 'delete' || action.kind === 'move') {
        const gone = new Set<Card>(cards);
        doc.blocks = doc.blocks.filter((b) => !(b.kind === 'card' && gone.has(b)));
      } else {
        for (const c of cards) changeCard(c, action);
      }
    });
  }
  return snaps;
}

/** Put every file back as it was: one write per file. */
export async function restore(store: CardStore, snaps: readonly Snapshot[]): Promise<void> {
  for (const s of snaps) {
    await store.update(s.path, (doc) => {
      doc.blocks = structuredClone(s.doc.blocks);
      if (s.doc.frontmatter) doc.frontmatter = structuredClone(s.doc.frontmatter);
      else delete doc.frontmatter;
    });
  }
}

const VERB: Record<BulkAction['kind'], string> = {
  delete: 'deleted', suspend: 'suspended', unsuspend: 'unsuspended', reset: 'reset', pri: 'priority', move: 'moved',
};

/** The notice's line: `suspended · 3 cards`, `priority 20 · 2 cards`, `moved · 1 card to german · A1`. */
export function bulkLine(action: BulkAction, n: number, toTitle?: string): string {
  const what = `${n} card${n === 1 ? '' : 's'}`;
  if (action.kind === 'pri') return `${VERB.pri} ${action.pri ?? 'of the document'} · ${what}`;
  if (action.kind === 'move') return `${VERB.move} · ${what} to ${toTitle ?? action.to}`;
  return `${VERB[action.kind]} · ${what}`;
}
