// The same fact twice (milestone 45): cards across the collection that test
// one fact, found by comparing their text, and what a pair can become: one
// card (merge), two cards on one schedule (link, FORMAT.md §6.2), or not the
// same (remembered in `.ilmi/same.json`). The view is the deck browser's
// `similar` chip and the inspector's `also in` line (DeckBrowser.tsx,
// Inspector.tsx); the notices and the store are sameOps.ts.
//
// The method. Each card is read as two faces (a q&a's front and back, a
// both-ways card's sides, a cloze's text with its blanks taken out and its
// answers) and the whole (both faces; a cloze's answers in context). Text
// is folded as the search folds it (case, accents, Arabic marks, tatweel),
// prose split into words (stopwords out, a light English stem, a lone
// Arabic letter kept since roots are written `ك-ر-م`) and pairs of
// neighbouring words; math normalized (no `$`, TeX spacing and sizing
// commands gone, `\dfrac` and `\tfrac` as `\frac`, `\frac{a}{b}` and
// `\frac12` as `a/b`, groupings dropped, `\le` as `\leq`, Unicode `≈ ∂ ħ`
// as TeX) and read as tokens and their runs of two and three. Every feature
// is weighted by how rare it is in the collection (idf) and weighed down by
// how many cards of its own document share it (a deck's template, `what
// does … give in forms …`, `derive …`, says nothing about the fact). Two
// cards score the mean of the cosine of their wholes and the better of their
// faces' (front with front and back with back, or crossed, each pairing the
// mean of its two cosines); two questions in the same words (neither a
// cloze) score at least the square of their fronts' cosine, when their
// answers share anything at all. Pairs are only scored when they share a
// feature rare enough to mean something (the token index), so a thousand
// cards take a few tens of milliseconds.

import { cardFields, mathSpanEnd, type Blank, type Card, type CardSchedule, type Doc } from '../format/index.js';
import { bareLined, newId, stronger, withState } from '../schedule/index.js';
import { findCard, fold, type CardRef, type CardStore, type Snapshot } from './deck.js';

// ── text ─────────────────────────────────────────────────────────

const STOP = new Set((
  'a an the of in on at to for from by with without and or not no is are was were be been being it its this that these those ' +
  'as if then than so such what which who whom whose why how when where does do did done has have had can could would should ' +
  'will shall may might must one two any all each every some into onto over under about between there their they them we you ' +
  'your our us he she his her i me my also only just very more most less least too both either neither nor but up out off ' +
  'own same other another per via vs e g ie eg s t'
).split(' '));

/** A light English stem: enough that `oscillators` meets `oscillator` and `derived` meets `derive`. */
function stem(w: string): string {
  if (w.length <= 4 || !/^[a-z]+$/.test(w)) return w;
  for (const [suf, rep] of [['ically', 'ical'], ['ally', 'al'], ['ies', 'y'], ['sses', 'ss'], ['ing', ''], ['edly', ''], ['ed', ''], ['es', ''], ['s', '']] as const) {
    if (w.endsWith(suf) && w.length - suf.length >= 3) {
      const base = w.slice(0, w.length - suf.length) + rep;
      if (suf === 's' && (w.endsWith('ss') || w.endsWith('us') || w.endsWith('is'))) return w;
      return base;
    }
  }
  return w;
}

/** TeX commands that only space, size, or style: dropped, their argument (if any) kept. */
const DROP_CMDS = new Set([
  ',', ';', ':', '!', ' ', 'quad', 'qquad', 'left', 'right', 'big', 'Big', 'bigg', 'Bigg', 'bigl', 'bigr', 'Bigl', 'Bigr',
  'displaystyle', 'textstyle', 'scriptstyle', 'limits', 'nolimits', 'mathrm', 'mathit', 'mathbf', 'mathsf', 'mathcal', 'boldsymbol',
  'bm', 'text', 'textrm', 'textit', 'textbf', 'operatorname', 'mbox', 'rm', 'it', 'bf', 'hspace', 'vspace', 'phantom', 'cdot',
]);
/** The same symbol by another name. */
const SAME_CMD: Record<string, string> = {
  dfrac: 'frac', tfrac: 'frac', le: 'leq', ge: 'geq', ne: 'neq', to: 'rightarrow', gets: 'leftarrow',
  varepsilon: 'epsilon', varphi: 'phi', vartheta: 'theta', lbrace: '{', rbrace: '}', lvert: '|', rvert: '|',
  langle: '<', rangle: '>', times: '*', approx: '~', sim: '~', simeq: '~', lesssim: '<', gtrsim: '>', ll: '<<', gg: '>>',
};
/** Unicode a person types where TeX would be. */
const UNI: Record<string, string> = {
  '−': '-', '–': '-', '—': '-', '×': '*', '·': '*', '≈': '~', '∼': '~', '≤': '\\leq', '≥': '\\geq', '≠': '\\neq',
  '→': '\\rightarrow', '⟨': '<', '⟩': '>', 'ℏ': '\\hbar', 'ħ': '\\hbar', '∂': '\\partial', '∞': '\\infty', '½': '1/2',
  'α': '\\alpha', 'β': '\\beta', 'γ': '\\gamma', 'δ': '\\delta', 'ε': '\\epsilon', 'ϵ': '\\epsilon', 'λ': '\\lambda',
  'μ': '\\mu', 'π': '\\pi', 'σ': '\\sigma', 'τ': '\\tau', 'ω': '\\omega', 'Ω': '\\Omega', 'Δ': '\\Delta', 'θ': '\\theta',
};

/** Read `{…}` at `i` (after spaces); the inside and the index past it, or null. */
function group(s: string, i: number): { inner: string; end: number } | null {
  while (s[i] === ' ') i++;
  if (s[i] !== '{') return null;
  let depth = 0;
  for (let j = i; j < s.length; j++) {
    if (s[j] === '\\') { j++; continue; }
    if (s[j] === '{') depth++;
    else if (s[j] === '}' && --depth === 0) return { inner: s.slice(i + 1, j), end: j + 1 };
  }
  return null;
}

/** A command's argument at `i`: a `{…}` group, a command, or one character (`\\frac12`). */
function arg(s: string, i: number): { inner: string; end: number } | null {
  while (s[i] === ' ') i++;
  if (i >= s.length) return null;
  if (s[i] === '{') return group(s, i);
  if (s[i] === '\\') {
    const m = /^\\([A-Za-z]+|.)/.exec(s.slice(i));
    return m ? { inner: m[0], end: i + m[0].length } : null;
  }
  return /[}\]&^_]/.test(s[i]!) ? null : { inner: s[i]!, end: i + 1 };
}

/**
 * A formula in a canonical form: `$` gone, spacing and sizing commands
 * dropped, synonyms one name, `\frac{a}{b}` as `a/b`, braces and parentheses
 * dropped, no whitespace. Two ways of writing one formula meet here more
 * often than not: `\left(\frac{\partial S}{\partial U}\right)_{N,V}` and
 * `(\partial S/\partial U)_{N,V}` are the same string.
 */
export function normalizeMath(tex: string): string {
  let s = tex.replace(/\$/g, ' ');
  for (const [u, t] of Object.entries(UNI)) s = s.split(u).join(` ${t} `);
  const out: string[] = [];
  let i = 0;
  while (i < s.length) {
    const c = s[i]!;
    if (c === '\\') {
      const m = /^\\([A-Za-z]+|.)/.exec(s.slice(i));
      const name = m ? m[1]! : '';
      i += 1 + name.length;
      if (DROP_CMDS.has(name)) continue;
      const cmd = SAME_CMD[name] ?? name;
      if (cmd === 'frac') {
        const a = arg(s, i);
        const b = a && arg(s, a.end);
        if (a && b) { out.push(`${normalizeMath(a.inner)}/${normalizeMath(b.inner)}`); i = b.end; continue; }
      }
      if (cmd === 'sqrt') { out.push('\\sqrt'); continue; }
      out.push(cmd.length === 1 && !/[A-Za-z]/.test(cmd) ? cmd : `\\${cmd}`);
      // a command name ends at the next non-letter: keep it apart from what follows
      out.push(' ');
      continue;
    }
    if (c === '{' || c === '}' || c === '(' || c === ')' || c === '[' || c === ']' || c === '&') { i++; continue; }
    out.push(c);
    i++;
  }
  return out.join('').replace(/\s+/g, '').replace(/\\(?=[^A-Za-z])/g, '');
}

/** Split a canonical formula into tokens: commands, numbers, single letters and symbols. */
function mathTokens(norm: string): string[] {
  return norm.match(/\\[A-Za-z]+|\d+(?:\.\d+)?|[A-Za-z]|[^\sA-Za-z\d]/g) ?? [];
}

/** The text's prose words and its formulas' tokens, folded. Math is read inside `$…$` and `$$…$$`, and in a bare TeX-looking run. */
export function features(text: string): Map<string, number> {
  const f = new Map<string, number>();
  const add = (k: string, w = 1) => f.set(k, (f.get(k) ?? 0) + w);
  const prose: string[] = [];
  const maths: string[] = [];
  let last = 0;
  for (let i = 0; i < text.length; i++) {
    if (text[i] !== '$') continue;
    const e = mathSpanEnd(text, i);
    if (e < 0) continue;
    prose.push(text.slice(last, i));
    maths.push(text.slice(i, e));
    last = e;
    i = e - 1;
  }
  prose.push(text.slice(last));
  // prose: words, then pairs of neighbouring words
  const words: string[] = [];
  for (const chunk of prose) {
    const folded = fold(chunk);
    // Unicode math typed as prose (`3N − k`, `ħω`) reads as a formula too
    if (/[=^_\\]|[−×·≈≤≥→∂ℏħ∞]/.test(chunk)) maths.push(chunk.replace(/[A-Za-z]{3,}/g, ' '));
    for (const w of folded.split(/[^\p{L}\p{N}]+/u)) {
      // a lone Latin letter is noise; a lone Arabic letter is a radical (`ك-ر-م`)
      if (!w || STOP.has(w) || (w.length < 2 && /^[a-z]$/.test(w))) continue;
      words.push(stem(w));
    }
  }
  for (const w of words) add(`w:${w}`);
  for (let i = 1; i < words.length; i++) add(`w2:${words[i - 1]} ${words[i]}`, 0.5);
  // math: tokens, and runs of two and three
  for (const m of maths) {
    const t = mathTokens(normalizeMath(m));
    for (const x of t) if (x.length > 1 || /[A-Za-z\d]/.test(x)) add(`m:${x}`, 0.5);
    for (let i = 1; i < t.length; i++) add(`m2:${t[i - 1]}${t[i]}`);
    for (let i = 2; i < t.length; i++) add(`m3:${t[i - 2]}${t[i - 1]}${t[i]}`);
  }
  return f;
}

// ── cards ────────────────────────────────────────────────────────

/** A card as the finder sees it: where it is, and its text as written. */
export interface SameCard {
  /** Unique over the collection: the card's id, or `path#id` when two files share it, or `path#` and a hash of its text when it has none (`sameCards`). */
  key: string;
  path: string;
  block: number;
  id?: string;
  text: string;
  /** The id its bare line is linked to (`link=`), when it is. */
  link?: string;
}

/** A short stable hash of a text (FNV-1a, base 36): a card with no id is remembered by it. */
function hash(s: string): string {
  let h = 0x811c9dc5;
  for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 0x01000193); }
  return (h >>> 0).toString(36);
}

/**
 * Every card over `docs`, keyed for the finder and for `not the same`: by
 * its id, which a move keeps (FORMAT.md §6.1), unless another file holds the
 * same id (a duplicated document), then by path and id; a card with no id by
 * path and a hash of its text, so an edit makes it a card to compare again.
 */
export function sameCards(docs: Iterable<[string, Doc]>): SameCard[] {
  const list = [...docs];
  const count = new Map<string, number>();
  for (const [, doc] of list) for (const b of doc.blocks) if (b.kind === 'card' && b.id !== undefined) count.set(b.id, (count.get(b.id) ?? 0) + 1);
  const out: SameCard[] = [];
  for (const [path, doc] of list) {
    doc.blocks.forEach((b, block) => {
      if (b.kind !== 'card') return;
      const key = b.id === undefined ? `${path}#${hash(b.text)}` : count.get(b.id)! > 1 ? `${path}#${b.id}` : b.id;
      const c: SameCard = { key, path, block, text: b.text };
      if (b.id !== undefined) c.id = b.id;
      if (b.sched?.link !== undefined) c.link = b.sched.link;
      out.push(c);
    });
  }
  return out;
}

/** A card's two faces and its whole, as the comparison reads them. A cloze's front is its text without the answers. */
export function cardFaces(text: string): { front: string; back: string; whole: string; cloze: boolean } | null {
  const f = cardFields(text);
  if (!f) return null;
  if (f.form === 'cloze') {
    const front = f.parts.map((p) => (typeof p === 'string' ? p : ' ')).join('');
    // an answer inside a formula is TeX: read as math
    const back = f.parts.filter((p): p is Blank => typeof p !== 'string').map((p) => (p.math ? `$${p.answer}$` : p.answer)).join(' ; ');
    const whole = f.parts.map((p) => (typeof p === 'string' ? p : p.answer)).join('');
    return { front, back, whole, cloze: true };
  }
  const [front, back] = f.form === 'qa' ? [f.front, f.back] : [f.left, f.right];
  return { front, back, whole: `${front}\n${back}`, cloze: false };
}

type Vec = Map<string, number>;

const norm = (v: Vec): number => Math.sqrt([...v.values()].reduce((s, x) => s + x * x, 0));

function cosine(a: Vec, an: number, b: Vec, bn: number): number {
  if (!an || !bn) return 0;
  const [small, big] = a.size <= b.size ? [a, b] : [b, a];
  let dot = 0;
  for (const [k, x] of small) { const y = big.get(k); if (y !== undefined) dot += x * y; }
  return dot / (an * bn);
}

interface Prepared {
  card: SameCard;
  cloze: boolean;
  whole: Vec; wn: number;
  front: Vec; fn: number;
  back: Vec; bn: number;
}

/** A pair the finder ranks, `a` before `b` in the order they were given. */
export interface SamePair {
  a: SameCard;
  b: SameCard;
  score: number;
}

/**
 * How alike two cards must score to be listed. Chosen on the sample
 * collection (PLAN 45's notes): at 0.35 eight of the nine stat-mech pairs
 * are listed, and every pair listed is the same fact or an overlapping one
 * (a formula and its derivation); below it pairs that only share a topic
 * come in.
 */
export const SAME_THRESHOLD = 0.35;

/** `a|b` with the two keys in a fixed order: how a pair is remembered (`not the same`). */
export const pairKey = (a: string, b: string): string => (a < b ? `${a}|${b}` : `${b}|${a}`);

/**
 * Score two cards: the mean of the whole's cosine and the better of the
 * faces' (front with front and back with back, or crossed). Each face
 * pairing is the mean of its two cosines.
 */
function score(x: Prepared, y: Prepared): number {
  const whole = cosine(x.whole, x.wn, y.whole, y.wn);
  const ff = cosine(x.front, x.fn, y.front, y.fn);
  const bb = cosine(x.back, x.bn, y.back, y.bn);
  const fb = cosine(x.front, x.fn, y.back, y.bn);
  const bf = cosine(x.back, x.bn, y.front, y.fn);
  const blend = (whole + Math.max((ff + bb) / 2, (fb + bf) / 2)) / 2;
  // two questions asked in the same words ask the same thing, however the answers are worded
  // (when the answers share something: `form VI` and `form VII` are asked alike and answered apart)
  return x.cloze || y.cloze ? blend : Math.max(blend, ff * ff * Math.min(1, bb / 0.08));
}

/**
 * Every pair of cards that seem to test the same fact, best first. Only
 * pairs that share a feature found in at most a tenth of the cards (eight
 * at least) are scored; a pair in `skip` (`pairKey`) is left out, as is a
 * card paired with itself.
 */
export function findSame(cards: readonly SameCard[], opts: { threshold?: number; skip?: ReadonlySet<string> } = {}): SamePair[] {
  const threshold = opts.threshold ?? SAME_THRESHOLD;
  const raw: { card: SameCard; cloze: boolean; whole: Vec; front: Vec; back: Vec }[] = [];
  for (const card of cards) {
    const f = cardFaces(card.text);
    if (!f) continue;
    raw.push({ card, cloze: f.cloze, whole: features(f.whole), front: features(f.front), back: features(f.back) });
  }
  const n = raw.length;
  const df = new Map<string, number>();
  for (const r of raw) for (const k of r.whole.keys()) df.set(k, (df.get(k) ?? 0) + 1);
  // a feature most cards of one document share is that document's template
  // (`what does … give in forms …`, `derive …`), not the fact: weighed down there
  const local = new Map<string, number>();
  for (const r of raw) {
    for (const k of r.whole.keys()) local.set(`${r.card.path}\u0000${k}`, (local.get(`${r.card.path}\u0000${k}`) ?? 0) + 1);
  }
  const idf = (k: string) => Math.log((n + 1) / ((df.get(k) ?? 0) + 1)) + 0.1;
  const weigh = (v: Vec, path: string): Vec => {
    const out: Vec = new Map();
    for (const [k, x] of v) {
      const here = local.get(`${path}\u0000${k}`) ?? 1;
      out.set(k, (1 + Math.log(x)) * idf(k) * (k.startsWith('w2:') ? 0.7 : 1) / (1 + Math.log(here)));
    }
    return out;
  };
  const prep: Prepared[] = raw.map((r) => {
    const p = r.card.path;
    const whole = weigh(r.whole, p), front = weigh(r.front, p), back = weigh(r.back, p);
    return { card: r.card, cloze: r.cloze, whole, wn: norm(whole), front, fn: norm(front), back, bn: norm(back) };
  });
  // the token index: candidates share a feature that is rare enough
  const cap = Math.max(8, Math.floor(n / 10));
  const index = new Map<string, number[]>();
  prep.forEach((p, i) => {
    for (const k of p.whole.keys()) {
      if ((df.get(k) ?? 0) > cap || (df.get(k) ?? 0) < 2) continue;
      let list = index.get(k);
      if (!list) index.set(k, (list = []));
      list.push(i);
    }
  });
  const seen = new Set<number>();
  const out: SamePair[] = [];
  for (const list of index.values()) {
    for (let x = 0; x < list.length; x++) {
      for (let y = x + 1; y < list.length; y++) {
        const i = list[x]!, j = list[y]!;
        const id = i * n + j;
        if (seen.has(id)) continue;
        seen.add(id);
        const a = prep[i]!, b = prep[j]!;
        if (a.card.key === b.card.key) continue;
        if (opts.skip?.has(pairKey(a.card.key, b.card.key))) continue;
        const s = score(a, b);
        if (s >= threshold) out.push({ a: a.card, b: b.card, score: s });
      }
    }
  }
  return out.sort((p, q) => q.score - p.score);
}

/** The pairs to list: what `findSame` finds, less the pairs said not the same and the pairs already linked to each other. */
export function similarPairs(cards: readonly SameCard[], notSame: Iterable<string>, threshold = SAME_THRESHOLD): SamePair[] {
  const skip = new Set(notSame);
  return findSame(cards, { threshold, skip }).filter(({ a, b }) => !(a.id !== undefined && b.id !== undefined && (a.link === b.id || b.link === a.id)));
}

// ── the writes ───────────────────────────────────────────────────

/** Whether two cards can be linked: each scheduled by its bare line (`bareLined`), and not the same card. */
export function canLink(a: Card, b: Card): boolean {
  return a !== b && bareLined(a) && bareLined(b);
}

/** A card's schedule at its strongest: its bare line, or the strongest of its blanks' lines (what a merge weighs). */
function mainSchedule(card: Card): CardSchedule | undefined {
  let best = card.sched;
  for (const s of Object.values(card.blanks ?? {})) best = stronger(best, s);
  return best;
}

async function snapshots(store: CardStore, paths: readonly string[]): Promise<Snapshot[]> {
  const out: Snapshot[] = [];
  for (const path of new Set(paths)) out.push({ path, doc: structuredClone((await store.read(path, true)).doc) });
  return out;
}

function idsIn(doc: Doc): Set<string> {
  const ids = new Set<string>();
  for (const b of doc.blocks) if ((b.kind === 'card' || b.kind === 'paragraph') && b.id) ids.add(b.id);
  return ids;
}

/**
 * Link two cards (FORMAT.md §6.2, links): each bare line names the other
 * (`link=`), and both take the stronger of the two schedules, each keeping
 * its own priority and suspension. A card with no id is given one (`taken`
 * holds every id in the collection, so it is new everywhere). One write per
 * file. Resolves to each file as it was, for the undo.
 */
export async function linkPair(store: CardStore, a: CardRef, b: CardRef, taken: Set<string>, gen: () => string = newId): Promise<Snapshot[]> {
  const ca = findCard((await store.read(a.path, true)).doc, a);
  const cb = findCard((await store.read(b.path, true)).doc, b);
  if (!ca || !cb) throw new Error('no such card');
  if (!canLink(ca, cb)) throw new Error('these cards cannot be linked');
  const fresh = () => { let id = gen(); while (taken.has(id)) id = gen(); taken.add(id); return id; };
  const ia = ca.id ?? fresh();
  const ib = cb.id ?? fresh();
  const state = structuredClone(stronger(ca.sched, cb.sched));
  const snaps = await snapshots(store, [a.path, b.path]);
  const set = (doc: Doc, ref: CardRef, id: string, other: string) => {
    const card = findCard(doc, ref);
    if (!card) throw new Error('no such card');
    card.id = id;
    card.sched = withState(state, { ...card.sched, link: other })!;
  };
  if (a.path === b.path) {
    await store.update(a.path, (doc) => { set(doc, a, ia, ib); set(doc, b, ib, ia); });
  } else {
    await store.update(a.path, (doc) => { set(doc, a, ia, ib); });
    await store.update(b.path, (doc) => { set(doc, b, ib, ia); });
  }
  return snaps;
}

/** Take a card's link off, and its partner's when it points back. One write per file. */
export async function unlinkPair(store: CardStore, a: CardRef, b: CardRef): Promise<Snapshot[]> {
  const snaps = await snapshots(store, [a.path, b.path]);
  const off = (doc: Doc, ref: CardRef) => {
    const card = findCard(doc, ref);
    if (!card?.sched?.link) return;
    delete card.sched.link;
    if (!Object.keys(card.sched).length) delete card.sched;
  };
  if (a.path === b.path) await store.update(a.path, (doc) => { off(doc, a); off(doc, b); });
  else {
    await store.update(a.path, (doc) => { off(doc, a); });
    await store.update(b.path, (doc) => { off(doc, b); });
  }
  return snaps;
}

/**
 * Merge two cards into one: `keep` stays where it is, with the stronger
 * schedule of the two (the other's state when it is further along and
 * `keep` is scheduled by one line; its own priority and suspension kept),
 * and `drop` is removed. A link between the two goes with it. One write per
 * file. Resolves to each file as it was, for the undo.
 */
export async function mergePair(store: CardStore, keep: CardRef, drop: CardRef): Promise<Snapshot[]> {
  const ck = findCard((await store.read(keep.path, true)).doc, keep);
  const cd = findCard((await store.read(drop.path, true)).doc, drop);
  if (!ck || !cd) throw new Error('no such card');
  const theirs = structuredClone(mainSchedule(cd));
  const carry = bareLined(ck) && stronger(ck.sched, theirs) !== ck.sched ? theirs : undefined;
  const dropId = cd.id;
  const snaps = await snapshots(store, [keep.path, drop.path]);
  const onKeep = (doc: Doc) => {
    const card = findCard(doc, keep);
    if (!card) throw new Error('no such card');
    if (carry) {
      const s = withState(carry, card.sched);
      if (s) card.sched = s;
    }
    if (dropId !== undefined && card.sched?.link === dropId) {
      delete card.sched.link;
      if (!Object.keys(card.sched).length) delete card.sched;
    }
  };
  const onDrop = (doc: Doc) => {
    const card = findCard(doc, drop);
    if (card) doc.blocks = doc.blocks.filter((b) => b !== card);
  };
  if (keep.path === drop.path) await store.update(keep.path, (doc) => { onKeep(doc); onDrop(doc); });
  else {
    await store.update(keep.path, onKeep);
    await store.update(drop.path, onDrop);
  }
  return snaps;
}

/** Every id in the collection: what a new one must not be. */
export function takenIds(docs: Iterable<[string, Doc]>): Set<string> {
  const out = new Set<string>();
  for (const [, doc] of docs) for (const id of idsIn(doc)) out.add(id);
  return out;
}
