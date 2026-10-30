// Find in the page, and replace. Matching folds case and marks the way the
// deck search does (`fold` in src/app/deck.ts: NFKD, combining marks and
// the tatweel dropped, lower case), so an unvoweled Arabic word finds the
// voweled one and `Lucke` finds `Lücke`; the fold is taken a character at a
// time so every match maps back to the text it stands for, the marks after
// its last letter included. A textblock's matches are drawn as inline
// decorations; a card or a drawn atom (a table) that holds one is marked as
// a whole and counted once per match. Replace writes only into textblocks:
// a card's text is the inspector's, an atom's the file's.

import type { Node as PMNode } from 'prosemirror-model';
import { Plugin, PluginKey, TextSelection, type EditorState, type Transaction } from 'prosemirror-state';
import { Decoration, DecorationSet } from 'prosemirror-view';
import { flatText } from './commands.js';

/** One character folded: what it searches as (`''` for a mark). */
const foldChar = (c: string): string => c.normalize('NFKD').replace(/[\p{M}ـ]/gu, '').toLowerCase();

/** `s` folded as the deck search folds it. */
export const foldText = (s: string): string => Array.from(s, foldChar).join('');

/** `text` folded, with the offset in `text` of each folded character. */
export function foldMap(text: string): { folded: string; at: number[] } {
  let folded = '';
  const at: number[] = [];
  let off = 0;
  for (const c of text) {
    const f = foldChar(c);
    for (let k = 0; k < f.length; k++) at.push(off);
    folded += f;
    off += c.length;
  }
  return { folded, at };
}

const isMark = (c: string): boolean => /^[\p{M}ـ]$/u.test(c);

/** Every match of `query` in `text`, folded, as offsets into `text`; a match takes the marks right after it. */
export function findIn(text: string, query: string): { from: number; to: number }[] {
  const q = foldText(query);
  if (!q.trim()) return [];
  const { folded, at } = foldMap(text);
  const out: { from: number; to: number }[] = [];
  for (let i = folded.indexOf(q); i >= 0; i = folded.indexOf(q, i + q.length)) {
    const from = at[i]!;
    const last = at[i + q.length - 1]!;
    let to = last + (text.codePointAt(last)! > 0xffff ? 2 : 1);
    while (to < text.length && isMark(text[to]!)) to++;
    // a fold that spread one character over several (a ligature) can end a match inside it
    if (out.length && from < out[out.length - 1]!.to) continue;
    out.push({ from, to });
  }
  return out;
}

/** A match: its range in the document; `atom` when it is inside a card or a drawn block, which is marked whole. */
export interface Match {
  from: number;
  to: number;
  atom: boolean;
}

/** Every match of `query` in the document, in order. */
export function findMatches(doc: PMNode, query: string): Match[] {
  const out: Match[] = [];
  if (!foldText(query).trim()) return out;
  doc.descendants((node, pos) => {
    if (node.isTextblock) {
      for (const m of findIn(flatText(node), query)) out.push({ from: pos + 1 + m.from, to: pos + 1 + m.to, atom: false });
      return false;
    }
    if (node.isAtom && node.isBlock) {
      const text = node.type.spec.leafText?.(node) ?? '';
      for (let k = findIn(text, query).length; k > 0; k--) out.push({ from: pos, to: pos + node.nodeSize, atom: true });
      return false;
    }
    return true;
  });
  return out;
}

export interface FindState {
  query: string;
  matches: Match[];
  /** The current match, -1 when there is none. */
  index: number;
  /** The bar is open. */
  open: boolean;
}

export const findKey = new PluginKey<FindState>('find');

/** `tr.setMeta(findKey, …)`: open with a query, move by a step, or close. */
export type FindMeta = { query: string; from?: number } | { step: 1 | -1 } | { index: number } | 'close';

const CLOSED: FindState = { query: '', matches: [], index: -1, open: false };

/** The match at or after `pos`, wrapping to the first. */
const nearest = (matches: Match[], pos: number): number => {
  if (!matches.length) return -1;
  const i = matches.findIndex((m) => m.from >= pos);
  return i < 0 ? 0 : i;
};

export const findPlugin = new Plugin<FindState>({
  key: findKey,
  state: {
    init: () => CLOSED,
    apply(tr, cur, _old, state) {
      const meta = tr.getMeta(findKey) as FindMeta | undefined;
      if (meta === 'close') return CLOSED;
      if (meta && 'query' in meta) {
        const matches = findMatches(state.doc, meta.query);
        return { query: meta.query, matches, index: nearest(matches, meta.from ?? state.selection.from), open: true };
      }
      if (meta && 'step' in meta) {
        const n = cur.matches.length;
        return n ? { ...cur, index: (cur.index + meta.step + n) % n } : cur;
      }
      if (meta && 'index' in meta) return { ...cur, index: Math.min(meta.index, cur.matches.length - 1) };
      if (!cur.open || !tr.docChanged) return cur;
      // the text changed under an open bar: found again, staying near where the current match was
      const was = cur.index >= 0 ? tr.mapping.map(cur.matches[cur.index]!.from) : state.selection.from;
      const matches = findMatches(state.doc, cur.query);
      return { ...cur, matches, index: nearest(matches, was) };
    },
  },
  props: {
    decorations(state): DecorationSet | null {
      const f = findKey.getState(state);
      if (!f?.open || !f.matches.length) return null;
      const decos: Decoration[] = [];
      const atoms = new Map<number, Decoration>();
      f.matches.forEach((m, i) => {
        const cls = i === f.index ? 'find-hit find-current' : 'find-hit';
        if (!m.atom) { decos.push(Decoration.inline(m.from, m.to, { class: cls })); return; }
        // an atom holding several matches is drawn once, as current when one of them is
        if (!atoms.has(m.from) || i === f.index) atoms.set(m.from, Decoration.node(m.from, m.to, { class: cls.replace('find-hit', 'find-in') }));
      });
      return DecorationSet.create(state.doc, [...decos, ...atoms.values()]);
    },
  },
});

/** The current match, or null. */
export const currentMatch = (state: EditorState): Match | null => {
  const f = findKey.getState(state);
  return f && f.index >= 0 ? f.matches[f.index] ?? null : null;
};

/** The current match replaced by `text`, the next one current; null when it is not in a textblock. */
export function replaceMatch(state: EditorState, text: string): Transaction | null {
  const m = currentMatch(state);
  if (!m || m.atom) return null;
  const tr = state.tr;
  if (text) tr.insertText(text, m.from, m.to);
  else tr.delete(m.from, m.to);
  return tr.setMeta(findKey, { query: findKey.getState(state)!.query, from: tr.mapping.map(m.to) } satisfies FindMeta);
}

/** Every match in a textblock replaced by `text`, in one step of the history; how many were. */
export function replaceAll(state: EditorState, text: string): { tr: Transaction; count: number } | null {
  const f = findKey.getState(state);
  const ms = (f?.matches ?? []).filter((m) => !m.atom);
  if (!f || !ms.length) return null;
  const tr = state.tr;
  for (const m of [...ms].reverse()) {
    if (text) tr.insertText(text, m.from, m.to);
    else tr.delete(m.from, m.to);
  }
  tr.setMeta(findKey, { query: f.query, from: 0 } satisfies FindMeta);
  return { tr, count: ms.length };
}

/** The caret put at the end of the current match, as the bar closes. */
export function closeAtMatch(state: EditorState): Transaction {
  const m = currentMatch(state);
  const tr = state.tr.setMeta(findKey, 'close' satisfies FindMeta);
  if (m && !m.atom) tr.setSelection(TextSelection.create(state.doc, m.to));
  return tr;
}
