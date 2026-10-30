// Folding: a heading hides the blocks under it, down to the next heading
// of its level or above. A fold is view state (the app keeps it in
// `.ilmi/state.json` per document, by the heading's key), never written to
// the file. A chevron in the margin folds and opens; a folded heading says
// what it holds; the caret, a card landed on, or a find match arriving
// inside a folded section opens it.

import type { Node as PMNode } from 'prosemirror-model';
import { NodeSelection, Plugin, PluginKey, type EditorState, type Transaction } from 'prosemirror-state';
import { Decoration, DecorationSet, type EditorView } from 'prosemirror-view';
import { textOf } from './convert.js';
import { findKey } from './find.js';
import { schema } from './schema.js';

/** A top-level heading and what it would fold: the blocks after it down to the next heading of its level or above. */
export interface Section {
  /** The heading's position. */
  pos: number;
  level: number;
  /** Its key among the page's headings: the level and text, a repeat numbered (`2 results (2)`). */
  key: string;
  /** Where the section's content starts (right after the heading) and ends. */
  from: number;
  to: number;
  /** The blocks under it, and how many of them are cards. */
  blocks: number;
  cards: number;
}

/** Every top-level heading's section, in order. */
export function sections(doc: PMNode): Section[] {
  const heads: { pos: number; level: number; text: string; index: number; size: number }[] = [];
  const starts: number[] = [];
  doc.forEach((node, pos, i) => {
    starts.push(pos);
    if (node.type === schema.nodes.heading) heads.push({ pos, level: node.attrs.level as number, text: textOf(node).trim(), index: i, size: node.nodeSize });
  });
  const seen = new Map<string, number>();
  return heads.map((h, k) => {
    let end = doc.childCount;
    for (let m = k + 1; m < heads.length; m++) if (heads[m]!.level <= h.level) { end = heads[m]!.index; break; }
    let cards = 0;
    for (let i = h.index + 1; i < end; i++) if (doc.child(i).type === schema.nodes.card) cards++;
    const base = `${h.level} ${h.text}`;
    const n = (seen.get(base) ?? 0) + 1;
    seen.set(base, n);
    return {
      pos: h.pos,
      level: h.level,
      key: n === 1 ? base : `${base} (${n})`,
      from: h.pos + h.size,
      to: end < doc.childCount ? starts[end]! : doc.content.size,
      blocks: end - h.index - 1,
      cards,
    };
  });
}

export interface FoldState {
  /** The folded headings' positions, in order. */
  folded: number[];
  decos: DecorationSet;
}

/** `tr.setMeta(foldKey, …)`: fold exactly the headings with these keys, fold or open the heading at `toggle`, or open the ones at these positions. */
export type FoldMeta = { keys: readonly string[] } | { toggle: number } | { open: readonly number[] };

export const foldKey = new PluginKey<FoldState>('fold');

/** The folded headings' keys, in order: what the app remembers. */
export function foldedKeys(state: EditorState): string[] {
  const f = foldKey.getState(state);
  if (!f?.folded.length) return [];
  const set = new Set(f.folded);
  return sections(state.doc).filter((s) => set.has(s.pos)).map((s) => s.key);
}

/** The folded sections that hide `pos` (the outermost first). */
export function foldsHiding(state: EditorState, pos: number): Section[] {
  const f = foldKey.getState(state);
  if (!f?.folded.length) return [];
  const set = new Set(f.folded);
  return sections(state.doc).filter((s) => set.has(s.pos) && pos >= s.from && pos < s.to);
}

/** Is the top-level block at `pos` hidden by a fold? */
export const isFoldedAway = (state: EditorState, pos: number): boolean => foldsHiding(state, pos).length > 0;

const plural = (n: number, w: string) => `${n} ${w}${n === 1 ? '' : 's'}`;

function chevron(folded: boolean) {
  return (view: EditorView, getPos: () => number | undefined): HTMLElement => {
    const el = document.createElement('span');
    el.className = 'fold-chev';
    el.dataset.folded = folded ? '1' : '0';
    el.setAttribute('contenteditable', 'false');
    el.setAttribute('role', 'button');
    el.setAttribute('aria-label', folded ? 'open' : 'fold');
    // drawn by CSS (`::before`), so the heading's text stays its own
    el.addEventListener('mousedown', (e) => {
      e.preventDefault();
      e.stopPropagation();
      const at = getPos();
      if (at !== undefined) view.dispatch(view.state.tr.setMeta(foldKey, { toggle: at - 1 } satisfies FoldMeta));
    });
    return el;
  };
}

/** What a folded heading holds, after its text: `…`, and the cards when there are any. */
function more(s: Section) {
  return (view: EditorView, getPos: () => number | undefined): HTMLElement => {
    const el = document.createElement('span');
    el.className = 'fold-more';
    el.setAttribute('contenteditable', 'false');
    el.dataset.label = s.cards ? `… ${plural(s.cards, 'card')}` : '…';
    el.title = plural(s.blocks, 'block');
    el.addEventListener('mousedown', (e) => {
      e.preventDefault();
      e.stopPropagation();
      const at = getPos();
      if (at === undefined) return;
      // the heading it ends: the top-level block around it
      const head = view.state.doc.resolve(at).before(1);
      view.dispatch(view.state.tr.setMeta(foldKey, { open: [head] } satisfies FoldMeta));
    });
    return el;
  };
}

function decorate(doc: PMNode, folded: number[]): DecorationSet {
  const decos: Decoration[] = [];
  const set = new Set(folded);
  const hidden: { from: number; to: number }[] = [];
  for (const s of sections(doc)) {
    if (!s.blocks) continue;
    const on = set.has(s.pos);
    const node = doc.nodeAt(s.pos)!;
    decos.push(Decoration.widget(s.pos + 1, chevron(on), { side: -1, key: `fold-chev|${on ? 1 : 0}`, ignoreSelection: true }));
    if (!on) continue;
    decos.push(Decoration.node(s.pos, s.pos + node.nodeSize, { class: 'fold-head' }));
    decos.push(Decoration.widget(s.pos + node.nodeSize - 1, more(s), { side: 1, key: `fold-more|${s.cards}|${s.blocks}`, ignoreSelection: true }));
    hidden.push({ from: s.from, to: s.to });
  }
  if (hidden.length) {
    doc.forEach((node, pos) => {
      if (hidden.some((h) => pos >= h.from && pos < h.to)) decos.push(Decoration.node(pos, pos + node.nodeSize, { class: 'fold-hidden' }));
    });
  }
  return DecorationSet.create(doc, decos);
}

const sameList = (a: readonly number[], b: readonly number[]) => a.length === b.length && a.every((x, i) => x === b[i]);

/** The positions still folded after `tr`: each mapped, kept while a heading with something under it is still there. */
function mapFolded(tr: Transaction, folded: number[]): number[] {
  const out: number[] = [];
  const valid = new Set(sections(tr.doc).filter((s) => s.blocks > 0).map((s) => s.pos));
  for (const p of folded) {
    const m = tr.mapping.mapResult(p, 1);
    if (!m.deleted && valid.has(m.pos) && !out.includes(m.pos)) out.push(m.pos);
  }
  return out.sort((a, b) => a - b);
}

/** Where a caret, a landed node, or the current match would be hidden: the folds to open for it to be seen. */
function wantsOpen(state: EditorState): number[] {
  const out = new Set<number>();
  const sel = state.selection;
  if (sel.empty || sel instanceof NodeSelection) for (const s of foldsHiding(state, sel.from)) out.add(s.pos);
  const f = findKey.getState(state);
  const m = f?.open && f.index >= 0 ? f.matches[f.index] : undefined;
  if (m) for (const s of foldsHiding(state, m.from)) out.add(s.pos);
  return [...out];
}

export const foldPlugin = new Plugin<FoldState>({
  key: foldKey,
  state: {
    init: (_c, state) => ({ folded: [], decos: decorate(state.doc, []) }),
    apply(tr, cur, _old, state) {
      const meta = tr.getMeta(foldKey) as FoldMeta | undefined;
      let folded = tr.docChanged ? mapFolded(tr, cur.folded) : cur.folded;
      if (meta && 'keys' in meta) {
        const want = new Set(meta.keys);
        folded = sections(state.doc).filter((s) => s.blocks > 0 && want.has(s.key)).map((s) => s.pos);
      } else if (meta && 'toggle' in meta) {
        const ok = sections(state.doc).some((s) => s.pos === meta.toggle && s.blocks > 0);
        folded = folded.includes(meta.toggle) ? folded.filter((p) => p !== meta.toggle) : ok ? [...folded, meta.toggle].sort((a, b) => a - b) : folded;
      } else if (meta && 'open' in meta) {
        folded = folded.filter((p) => !meta.open.includes(p));
      }
      if (!tr.docChanged && sameList(folded, cur.folded)) return cur;
      return { folded, decos: decorate(state.doc, folded) };
    },
  },
  appendTransaction(trs, _old, state) {
    if (!trs.some((tr) => tr.docChanged || tr.selectionSet || tr.getMeta(findKey) !== undefined)) return null;
    const open = wantsOpen(state);
    return open.length ? state.tr.setMeta(foldKey, { open } satisfies FoldMeta) : null;
  },
  props: { decorations: (state): DecorationSet | null => foldKey.getState(state)?.decos ?? null },
});
