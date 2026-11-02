// Text the chrome shows about the collection (milestone 40): formulas in
// names and headings drawn as math or read as plain text, a title folded
// for comparing with a body's first heading, the queue row's path of
// titles, the day's breakdown for the queue's inspector, and the counts
// under a row. Pure, beside the views that draw them.

import katex from 'katex';
import type { Block } from '../format/index.js';
import { mathSplit } from '../reader/convert.js';
import { isDue, type QueueItem } from '../schedule/index.js';
import { dirOf, isDoc, nameOf, type TreeNode } from '../vault/index.js';
import { slugName } from './names.js';
import type { DocInfo } from './store.js';

const escapeHtml = (s: string) => s.replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c]!);

/** The TeX inside a `$…$` or `$$…$$` span. */
const texOf = (raw: string): string => (raw.startsWith('$$') ? raw.slice(2, -2) : raw.slice(1, -1)).trim();

/**
 * A line of chrome text as HTML: the words escaped, each `$…$` (and
 * `$$…$$`, drawn inline too) set by KaTeX at the line's size, a formula
 * KaTeX cannot read left as its TeX. For a row, a heading in the outline,
 * a crumb: never a block.
 */
export function inlineMathHTML(text: string): string {
  return mathSplit(text).map((p) => {
    if (typeof p === 'string') return escapeHtml(p);
    const tex = texOf(p.math);
    let inner: string;
    try {
      inner = katex.renderToString(tex, { throwOnError: false, displayMode: false, output: 'html' });
    } catch {
      inner = escapeHtml(tex);
    }
    return `<span class="math chrome-math" dir="ltr">${inner}</span>`;
  }).join('');
}

/** True when the text holds a formula the format reads as one. */
export const hasMath = (text: string): boolean => mathSplit(text).some((p) => typeof p !== 'string');

/** A few TeX commands read as the characters they draw, for plain text. */
const TEX_CHARS: Record<string, string> = {
  alpha: 'α', beta: 'β', gamma: 'γ', delta: 'δ', epsilon: 'ε', varepsilon: 'ε', zeta: 'ζ', eta: 'η', theta: 'θ', kappa: 'κ', lambda: 'λ', mu: 'μ', nu: 'ν',
  xi: 'ξ', pi: 'π', rho: 'ρ', sigma: 'σ', tau: 'τ', phi: 'φ', varphi: 'φ', chi: 'χ', psi: 'ψ', omega: 'ω', Gamma: 'Γ', Delta: 'Δ', Theta: 'Θ', Lambda: 'Λ',
  Sigma: 'Σ', Phi: 'Φ', Psi: 'Ψ', Omega: 'Ω', hbar: 'ħ', langle: '⟨', rangle: '⟩', infty: '∞', partial: '∂', nabla: '∇', cdot: '·', times: '×', pm: '±',
  to: '→', rightarrow: '→', leftarrow: '←', leq: '≤', le: '≤', geq: '≥', ge: '≥', neq: '≠', approx: '≈', sim: '∼', ll: '≪', gg: '≫', sum: 'Σ', int: '∫',
  dagger: '†', ldots: '…', dots: '…', quad: ' ', qquad: ' ',
};

/**
 * A line with its formulas as plain text, for a `title` or an `<option>`:
 * the dollars gone, the common commands as their characters, the rest of
 * the TeX left as written (`$|n^0\rangle$` → `|n^0⟩`).
 */
export function plainMath(text: string): string {
  return mathSplit(text).map((p) => {
    if (typeof p === 'string') return p;
    return texOf(p.math)
      .replace(/\\(left|right|big|Big|bigg|Bigg)\b/g, '')
      .replace(/\\([A-Za-z]+)/g, (all, name: string) => TEX_CHARS[name] ?? all)
      .replace(/\\[,;:! ]/g, ' ')
      .replace(/\{([^{}]*)\}/g, '$1')
      .replace(/\s+/g, ' ')
      .trim();
  }).join('');
}

// ── a title and the body's first heading ─────────────────────────

/**
 * A title folded for comparing: lower case, marks and punctuation gone, a
 * chapter's number read one way (`ch. 3`, `Chapter 3`, `chap 3` → `ch 3`).
 */
export function foldTitle(text: string): string {
  return plainMath(text)
    .normalize('NFKD')
    .replace(/\p{M}/gu, '')
    .toLocaleLowerCase()
    .replace(/\b(?:chapter|chap|ch)\.?\s*(\d+)/g, 'ch $1')
    .replace(/[^\p{L}\p{N}]+/gu, ' ')
    .trim();
}

/** The same title, the number in front (`ch 3`, `3`, `§3`, `lecture 9`) left out too. */
const bare = (folded: string): string => folded.replace(/^(?:ch|lecture|unit|part|section)?\s*\d+\s+/, '');

/**
 * Whether a body opening with `blocks[0]` repeats the page's title: a
 * heading of level 1 or 2 whose text is the title, loosely (case,
 * punctuation, and a chapter's numbering folded; the number may be on one
 * side only). The reader then draws no separate title.
 */
export function bodyRepeatsTitle(title: string, blocks: readonly Block[]): boolean {
  const first = blocks[0];
  if (first?.kind !== 'heading' || first.level > 2) return false;
  const a = foldTitle(title);
  const b = foldTitle(first.text);
  if (!a || !b) return false;
  return a === b || bare(a) === bare(b);
}

// ── the queue's row: a path of titles ───────────────────────────

/**
 * A parent's name made short for a path: the part before ` · ` or ` — `
 * when one is there (`arab 401 · advanced grammar` → `arab 401`,
 * `Lindqvist — Statistical Physics` → `Lindqvist`).
 */
export function shortTitle(title: string): string {
  const m = /^(.{3,}?)\s+(?:·|—|–|:)\s+\S/.exec(title);
  return m ? m[1]!.trim() : title;
}

const docTitle = (path: string, docs: Record<string, DocInfo>): string => docs[path]?.title ?? slugName(nameOf(path));

/** What the row's path holds: its parent (a document, else a folder), the document, and a card's section. */
export interface PathParts {
  parent?: string;
  doc: string;
  section?: string;
}

/**
 * Where a queue item lives, by titles, not slugs: the document it sits
 * under (shortened), else its folder; the document; and for a card the
 * heading it sits under (`arab 401 › kāna and its sisters › order: when the
 * kabar comes first`). A heading that only repeats the document's name is
 * left out.
 */
export function pathParts(item: QueueItem, docs: Record<string, DocInfo>): PathParts {
  const dir = dirOf(item.path);
  const out: PathParts = { doc: docTitle(item.path, docs) };
  if (dir) {
    const owner = `${dir}.md`;
    out.parent = docs[owner] ? shortTitle(docTitle(owner, docs)) : slugName(nameOf(dir));
  }
  // a card's heading, and a section's own
  const heading = item.kind === 'card' ? item.section : item.kind === 'section' ? item.heading : undefined;
  if (heading) {
    const sec = heading.replace(/^§\d+\s*—\s*/, '').trim();
    if (sec && foldTitle(sec) !== foldTitle(out.doc)) out.section = sec;
  }
  return out;
}

// ── the queue's inspector: the day by course ─────────────────────

/**
 * The group a queue item counts under in the day's breakdown: the
 * outermost document it sits under (a course, a book), else the document
 * itself when it has children, else its top folder; a file at the top, the
 * collection.
 */
export function groupOf(path: string, docs: Record<string, DocInfo>): string {
  const segs = dirOf(path) ? dirOf(path).split('/') : [];
  let at = '';
  for (const seg of segs) {
    at = at ? `${at}/${seg}` : seg;
    if (docs[`${at}.md`]) return `${at}.md`;
  }
  return segs[0] ?? '';
}

/** The day's items counted by `groupOf`, the most first, a tie by name: `[group path, n]`. */
export function breakdown(items: readonly QueueItem[], docs: Record<string, DocInfo>, name: (path: string) => string): [string, number][] {
  const by = new Map<string, number>();
  for (const i of items) {
    const g = groupOf(i.path, docs);
    by.set(g, (by.get(g) ?? 0) + 1);
  }
  return [...by].sort((a, b) => b[1] - a[1] || name(a[0]).localeCompare(name(b[0])));
}

// ── the counts under a row ───────────────────────────────────────

/** The cards and cards due in a node and everything under it. */
export function countsUnder(node: TreeNode, docs: Record<string, DocInfo>): { cards: number; due: number } {
  let cards = 0;
  let due = 0;
  const visit = (n: TreeNode) => {
    if (n.kind === 'doc' || isDoc(n.path)) {
      const info = docs[n.path];
      if (info) { cards += info.cards; due += info.due; }
    }
    for (const k of n.children ?? []) visit(k);
  };
  visit(node);
  return { cards, due };
}

/** What a row says of them: `40 cards` and `8 due`, each only when nonzero. */
export function countWords(c: { cards: number; due: number }): { cards: string; due: string } {
  return { cards: c.cards ? `${c.cards} card${c.cards === 1 ? '' : 's'}` : '', due: c.due ? `${c.due} due` : '' };
}

/** Today's items of a scope, for the breakdown: what is due now. */
export const dueItems = (items: readonly QueueItem[], now: Date): QueueItem[] => items.filter((i) => isDue(i, now));
