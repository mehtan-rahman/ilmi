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
import { runAt } from './lists.js';
import { indentWidth, schema } from './schema.js';

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

/** A list item whose text is an ATX heading (`- ## mechanics`): its level and text. */
const ITEM_HEADING = /^(#{1,6})[ \t]+(.*)$/;

/**
 * Every heading inside a list item (milestone 46) and what it folds: the
 * items after it set in further, its children, through the card items and
 * the pieces a list with card items in it is split into (FORMAT.md §5.2).
 * `pos` is the item's, `from`..`to` its children's span; keyed `- level
 * text`, a repeat numbered.
 */
export function itemSections(doc: PMNode): Section[] {
  const out: Section[] = [];
  const seen = new Map<string, number>();
  let i = 0;
  while (i < doc.childCount) {
    const run = runAt(doc, i);
    if (!run) { i++; continue; }
    // each entry's position and size, as the run's blocks hold them
    const at: { pos: number; size: number; width: number; card: boolean; text: string | null }[] = [];
    let pos = run.pos;
    for (let c = run.start; c < run.end; c++) {
      const n = doc.child(c);
      if (n.type === schema.nodes.list) {
        let p = pos + 1;
        n.forEach((item) => {
          at.push({ pos: p, size: item.nodeSize, width: indentWidth(item.attrs.indent as string), card: false, text: textOf(item) });
          p += item.nodeSize;
        });
      } else {
        const prefix = /^( *)/.exec((n.attrs.card as { item?: string }).item ?? '')![1]!;
        at.push({ pos, size: n.nodeSize, width: indentWidth(prefix), card: true, text: null });
      }
      pos += n.nodeSize;
    }
    at.forEach((e, k) => {
      const m = e.text === null ? null : ITEM_HEADING.exec(e.text);
      if (!m) return;
      let end = k + 1;
      while (end < at.length && at[end]!.width > e.width) end++;
      const last = at[end - 1]!;
      const base = `- ${m[1]!.length} ${m[2]!.trim()}`;
      const n = (seen.get(base) ?? 0) + 1;
      seen.set(base, n);
      out.push({
        pos: e.pos,
        level: m[1]!.length,
        key: n === 1 ? base : `${base} (${n})`,
        from: e.pos + e.size,
        to: last.pos + last.size,
        blocks: end - k - 1,
        cards: at.slice(k + 1, end).filter((x) => x.card).length,
      });
    });
    i = run.end;
  }
  return out;
}

/** The headings' sections and the list items' heading sections, in document order. */
export const allSections = (doc: PMNode): Section[] => [...sections(doc), ...itemSections(doc)].sort((a, b) => a.pos - b.pos);

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
  return allSections(state.doc).filter((s) => set.has(s.pos)).map((s) => s.key);
}

/** The folded sections that hide `pos` (the outermost first). */
export function foldsHiding(state: EditorState, pos: number): Section[] {
  const f = foldKey.getState(state);
  if (!f?.folded.length) return [];
  const set = new Set(f.folded);
  return allSections(state.doc).filter((s) => set.has(s.pos) && pos >= s.from && pos < s.to);
}

/**
 * The child index of the block the read rule is drawn down to for `read.pos`
 * = `pos` (the pos-th prose block, cards skipped, as `cursorIndex` counts),
 * walked back past any block a fold hides: a marker inside a folded section
 * ends under its folded heading. -1 when nothing is read.
 */
export function ruleEndIndex(state: EditorState, pos: number): number {
  const doc = state.doc;
  let n = 0;
  let idx = -1;
  doc.forEach((node, _o, i) => { if (node.type !== schema.nodes.card && n < pos) { n++; idx = i; } });
  if (idx < 0) return -1;
  const f = foldKey.getState(state);
  if (!f?.folded.length) return idx;
  const hidden = allSections(doc).filter((s) => f.folded.includes(s.pos));
  let at = 0;
  const starts: number[] = [];
  doc.forEach((node) => { starts.push(at); at += node.nodeSize; });
  while (idx > 0 && hidden.some((s) => starts[idx]! >= s.from && starts[idx]! < s.to)) idx--;
  return idx;
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
      // the heading it ends: the textblock around it, a top-level heading or a list item
      const $a = view.state.doc.resolve(at);
      const head = $a.depth >= 1 ? $a.before($a.depth) : at;
      view.dispatch(view.state.tr.setMeta(foldKey, { open: [head] } satisfies FoldMeta));
    });
    return el;
  };
}

function decorate(doc: PMNode, folded: number[]): DecorationSet {
  const decos: Decoration[] = [];
  const set = new Set(folded);
  const hidden: { from: number; to: number }[] = [];
  // a heading in a list item hides its children: each item and card item in its span
  const hiddenItems: { from: number; to: number }[] = [];
  for (const s of itemSections(doc)) {
    const on = set.has(s.pos);
    const node = doc.nodeAt(s.pos)!;
    decos.push(Decoration.widget(s.pos + 1, chevron(on), { side: -1, key: `fold-chev|${on ? 1 : 0}`, ignoreSelection: true }));
    decos.push(Decoration.node(s.pos, s.pos + node.nodeSize, { class: on ? 'li-h fold-head' : 'li-h' }));
    if (!on) continue;
    decos.push(Decoration.widget(s.pos + node.nodeSize - 1, more(s), { side: 1, key: `fold-more|${s.cards}|${s.blocks}`, ignoreSelection: true }));
    hiddenItems.push({ from: s.from, to: s.to });
  }
  if (hiddenItems.length) {
    const inside = (p: number) => hiddenItems.some((h) => p >= h.from && p < h.to);
    doc.forEach((node, pos) => {
      if (node.type === schema.nodes.list) {
        node.forEach((item, off) => { const p = pos + 1 + off; if (inside(p)) decos.push(Decoration.node(p, p + item.nodeSize, { class: 'fold-hidden' })); });
      } else if (node.type === schema.nodes.card && inside(pos)) decos.push(Decoration.node(pos, pos + node.nodeSize, { class: 'fold-hidden' }));
    });
  }
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
  const valid = new Set(allSections(tr.doc).filter((s) => s.blocks > 0).map((s) => s.pos));
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
        folded = allSections(state.doc).filter((s) => s.blocks > 0 && want.has(s.key)).map((s) => s.pos);
      } else if (meta && 'toggle' in meta) {
        const ok = allSections(state.doc).some((s) => s.pos === meta.toggle && s.blocks > 0);
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
