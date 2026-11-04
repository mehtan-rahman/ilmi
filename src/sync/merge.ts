// The merge of one file changed on both devices, by the format's rules
// (milestone 53). Pure: the Rust side (`src-tauri/src/sync.rs`) hands over
// a file's three texts, this decides the one text to keep, and the
// controller (`src/app/sync.ts`) writes it and commits. The rules:
//
// - A schedule line changed on both sides takes the later instant: `last`
//   on an `sr` line (then `due`), `due` on a `read`/`write` field and a
//   section's `read` line. One review touches one line, so reviews of
//   different cards in one file never meet.
// - Prose changed on both sides in one block keeps both versions, one
//   block after the other, and says where (the file and the heading above);
//   never conflict markers in the file.
// - A file edited on one side and deleted on the other keeps the edit.
// - `.ilmi/order.json`, and any other app-private JSON, takes the pulled
//   side; `.ilmi/same.json` unions its pairs; the review log is unioned,
//   line by line.
// - A binary file (a PDF, never written by the app) keeps ours.
//
// The three-way merge runs over blocks (front-matter as one, then runs of
// lines each with the blank lines after it), so a conflict is a block, and
// a block put back is a block.

export interface Sides {
  base: string | null;
  ours: string | null;
  theirs: string | null;
  binary?: boolean;
}

/** A block whose two versions were both kept: the file and the heading above it. */
export interface Kept {
  path: string;
  heading: string;
}

export type Merged =
  | { action: 'write'; text: string; kept: Kept[] }
  | { action: 'remove'; kept: Kept[] }
  | { action: 'keep'; kept: Kept[] };

const BLANK = /^\s*$/;

/**
 * The file as blocks: the front-matter (its `---` to its closing line) as
 * one, then each run of non-blank lines with the blank lines after it.
 * Joining the blocks' lines with `\n` gives the text back byte for byte.
 */
export function blocks(text: string): string[][] {
  const lines = text.split('\n');
  const out: string[][] = [];
  let i = 0;
  if (lines[0] === '---') {
    let k = 1;
    while (k < lines.length && lines[k] !== '---' && lines[k] !== '...') k++;
    if (k < lines.length) {
      let e = k + 1;
      while (e < lines.length && BLANK.test(lines[e]!)) e++;
      out.push(lines.slice(0, e));
      i = e;
    }
  }
  while (i < lines.length) {
    let e = i;
    while (e < lines.length && !BLANK.test(lines[e]!)) e++;
    while (e < lines.length && BLANK.test(lines[e]!)) e++;
    if (e === i) e = i + 1;
    out.push(lines.slice(i, e));
    i = e;
  }
  return out;
}

const key = (b: string[]): string => b.join('\n');

/** Matches of `a` into `b` by a longest common subsequence: `m[i]` is `j` or -1. The common head and tail are matched first, so an edit in one place costs little. */
function lcs(a: string[], b: string[]): Int32Array {
  const m = new Int32Array(a.length).fill(-1);
  let head = 0;
  while (head < a.length && head < b.length && a[head] === b[head]) { m[head] = head; head++; }
  let tail = 0;
  while (head + tail < a.length && head + tail < b.length && a[a.length - 1 - tail] === b[b.length - 1 - tail]) { m[a.length - 1 - tail] = b.length - 1 - tail; tail++; }
  const n = a.length - head - tail;
  const k = b.length - head - tail;
  if (n === 0 || k === 0) return m;
  // the classic table, bottom-up, over the middle
  const w = k + 1;
  const t = new Int32Array((n + 1) * w);
  for (let i = n - 1; i >= 0; i--) {
    for (let j = k - 1; j >= 0; j--) {
      t[i * w + j] = a[head + i] === b[head + j] ? t[(i + 1) * w + j + 1]! + 1 : Math.max(t[(i + 1) * w + j]!, t[i * w + j + 1]!);
    }
  }
  let i = 0;
  let j = 0;
  while (i < n && j < k) {
    if (a[head + i] === b[head + j]) { m[head + i] = head + j; i++; j++; }
    else if (t[(i + 1) * w + j]! >= t[i * w + j + 1]!) i++;
    else j++;
  }
  return m;
}

/** One region of a three-way diff: the same in all three (`stable`), or each side's own slice. */
export type Hunk = { stable: string } | { base: string[]; ours: string[]; theirs: string[] };

/** A three-way diff over sequences, aligned on what both sides kept from the base. */
export function diff3(base: string[], ours: string[], theirs: string[]): Hunk[] {
  const mo = lcs(base, ours);
  const mt = lcs(base, theirs);
  const out: Hunk[] = [];
  let i = 0;
  let j = 0;
  let k = 0;
  for (;;) {
    let s = i;
    while (s < base.length && !(mo[s]! >= 0 && mt[s]! >= 0)) s++;
    const je = s < base.length ? mo[s]! : ours.length;
    const ke = s < base.length ? mt[s]! : theirs.length;
    if (i < s || j < je || k < ke) out.push({ base: base.slice(i, s), ours: ours.slice(j, je), theirs: theirs.slice(k, ke) });
    if (s >= base.length) break;
    out.push({ stable: base[s]! });
    i = s + 1;
    j = je + 1;
    k = ke + 1;
  }
  return out;
}

/** The elements of `a` that `b` has too, in order (a longest common subsequence). */
function common(a: string[], b: string[]): string[] {
  const m = lcs(a, b);
  return a.filter((_, i) => m[i]! >= 0);
}

const same = (a: string[], b: string[]): boolean => a.length === b.length && a.every((x, i) => x === b[i]);

// ── schedule lines ───────────────────────────────────────────────

const SR = /^\s*<!--\s*sr(?:\s+(c?\d+|r|f))?(?=\s|-->)/;
const SECTION = /^\s*<!--\s*read(?=\s|-->)/;
const FIELD = /^(read|write):/;

/** The kind of schedule line this is (`sr` with its key, `section`, or the field's name), or null for anything else. */
export function scheduleKind(line: string): string | null {
  const sr = SR.exec(line);
  if (sr) {
    const k = sr[1] ?? '';
    return `sr ${k === 'f' ? '' : k === 'r' || k.startsWith('c') ? k : k ? `c${k}` : ''}`.trim();
  }
  if (SECTION.test(line)) return 'section';
  const f = FIELD.exec(line);
  return f ? f[1]! : null;
}

function attr(line: string, name: string): string | null {
  const m = new RegExp(`(?:^|\\s)${name}=(\\S+)`).exec(line);
  return m ? m[1]! : null;
}

/** A day or an instant as a sortable string (a day is its start). */
const instant = (v: string | null): string | null => (v === null ? null : v.length === 10 ? `${v}T00:00:00Z` : v);

/**
 * Which of two schedule lines of one kind is the later: by `last`, then by
 * `due` (a pass or a postpone moves it), ours on a tie or when neither says.
 */
export function later(ours: string, theirs: string): 'ours' | 'theirs' {
  for (const name of ['last', 'due']) {
    const a = instant(attr(ours, name));
    const b = instant(attr(theirs, name));
    if (a !== null && b !== null && a !== b) return a > b ? 'ours' : 'theirs';
    if (a !== null && b === null) return 'ours';
    if (a === null && b !== null) return 'theirs';
  }
  return 'ours';
}

/**
 * A conflict's two sides, block by block when they have the same number
 * of blocks: a block one side left as the base takes the other side's; a
 * block changed on both takes, line by line, the later of two schedule
 * lines of one kind (the same line counts, every differing line such a
 * pair). Null when any block differs in anything else: a real conflict.
 */
function byBlocks(base: string[][] | null, ours: string[][], theirs: string[][]): string[][] | null {
  if (ours.length !== theirs.length) return null;
  const b3 = base && base.length === ours.length ? base : null;
  const out: string[][] = [];
  for (let b = 0; b < ours.length; b++) {
    const o = ours[b]!;
    const t = theirs[b]!;
    if (b3) {
      const k = key(b3[b]!);
      if (key(o) === k) { out.push(t); continue; }
      if (key(t) === k) { out.push(o); continue; }
    }
    const lines = bySchedule(o, t);
    if (!lines) return null;
    out.push(lines);
  }
  return out;
}

/** Two versions of one block that differ only in schedule lines of one kind, pair by pair: the later of each; else null. */
function bySchedule(o: string[], t: string[]): string[] | null {
  if (o.length !== t.length) return null;
  const lines: string[] = [];
  for (let i = 0; i < o.length; i++) {
    const a = o[i]!;
    const c = t[i]!;
    if (a === c) { lines.push(a); continue; }
    const ka = scheduleKind(a);
    if (ka === null || ka !== scheduleKind(c)) return null;
    lines.push(later(a, c) === 'ours' ? a : c);
  }
  return lines;
}

/** Ends with a blank line, so the block after it stands apart. */
function closed(block: string[]): string[] {
  return block.length && BLANK.test(block[block.length - 1]!) ? block : [...block, ''];
}

const HEADING = /^#{1,6}\s+(.*?)\s*(?:\s#+)?\s*$/;
const TITLE = /^title:\s*(.*?)\s*$/;

/** The heading above `at` in `lines`, else the front-matter's title, else the file's name. */
function headingAbove(lines: readonly string[], at: number, path: string): string {
  for (let i = at - 1; i >= 0; i--) {
    const m = HEADING.exec(lines[i]!);
    if (m && m[1]) return m[1];
  }
  for (const l of lines) {
    const t = TITLE.exec(l);
    if (t && t[1]) {
      const v = t[1];
      if (v.startsWith('"')) { try { return String(JSON.parse(v)); } catch { /* as written */ } }
      return v.replace(/^'(.*)'$/, '$1');
    }
    if (l === '---' && lines[0] !== '---') break;
  }
  return path.replace(/^.*\//, '').replace(/\.md$/, '');
}

/** Two texts as the one merged text of a Markdown file, and the blocks kept both ways. */
export function mergeMarkdown(path: string, base: string | null, ours: string, theirs: string): { text: string; kept: Kept[] } {
  const ho = blocks(ours);
  const ht = blocks(theirs);
  const ko = ho.map(key);
  const kt = ht.map(key);
  // no base (histories that never met): what the two share stands in for it
  const hb = base === null ? common(ko, kt) : blocks(base).map(key);
  const byKey = new Map<string, string[]>();
  for (const b of [...ho, ...ht]) byKey.set(key(b), b);
  const lines: string[] = [];
  const kept: Kept[] = [];
  const push = (b: string[]) => lines.push(...b);
  for (const h of diff3(hb, ko, kt)) {
    if ('stable' in h) { push(byKey.get(h.stable) ?? h.stable.split('\n')); continue; }
    const o = h.ours.map((k) => byKey.get(k)!);
    const t = h.theirs.map((k) => byKey.get(k)!);
    if (same(h.ours, h.base) || same(h.ours, h.theirs)) { t.forEach(push); continue; }
    if (same(h.theirs, h.base)) { o.forEach(push); continue; }
    const sched = byBlocks(h.base.map((k) => byKey.get(k) ?? k.split('\n')), o, t);
    if (sched) { sched.forEach(push); continue; }
    // front-matter on both sides: line by line, a schedule line's later version, anything else the pulled side's
    if (o.length === 1 && t.length === 1 && o[0]![0] === '---' && t[0]![0] === '---' && lines.length === 0) {
      push(mergeFrontMatter(h.base.length === 1 ? h.base[0]!.split('\n') : [], o[0]!, t[0]!));
      continue;
    }
    kept.push({ path, heading: headingAbove(lines, lines.length, path) });
    o.forEach((b, i) => push(i === o.length - 1 ? closed(b) : b));
    t.forEach(push);
  }
  let text = lines.join('\n');
  if (!text.endsWith('\n')) text += '\n';
  return { text, kept };
}

function mergeFrontMatter(base: string[], ours: string[], theirs: string[]): string[] {
  const out: string[] = [];
  for (const h of diff3(base, ours, theirs)) {
    if ('stable' in h) { out.push(h.stable); continue; }
    if (same(h.ours, h.base) || same(h.ours, h.theirs)) { out.push(...h.theirs); continue; }
    if (same(h.theirs, h.base)) { out.push(...h.ours); continue; }
    if (h.ours.length !== h.theirs.length) { out.push(...h.theirs); continue; }
    for (let i = 0; i < h.ours.length; i++) {
      const o = h.ours[i]!;
      const t = h.theirs[i]!;
      const b = h.base.length === h.ours.length ? h.base[i] : undefined;
      if (o === t || o === b) out.push(t);
      else if (t === b) out.push(o);
      else {
        const k = scheduleKind(o);
        out.push(k !== null && k === scheduleKind(t) && later(o, t) === 'ours' ? o : t);
      }
    }
  }
  return out;
}

const isLog = (path: string) => path.startsWith('.ilmi/reviews/') && path.endsWith('.jsonl');

/** The review log unioned: ours, then the lines of theirs not in ours. */
function unionLines(ours: string, theirs: string): string {
  const have = new Set(ours.split('\n').filter((l) => l.trim()));
  const extra = theirs.split('\n').filter((l) => l.trim() && !have.has(l));
  const head = ours.endsWith('\n') || ours === '' ? ours : `${ours}\n`;
  return extra.length ? `${head}${extra.join('\n')}\n` : head;
}

/** `.ilmi/same.json` unioned: the pairs of both, sorted, as the app writes it. */
function unionSame(ours: string, theirs: string): string {
  const pairs = new Set<string>();
  for (const text of [ours, theirs]) {
    try {
      const o = JSON.parse(text) as { not?: unknown };
      if (Array.isArray(o.not)) for (const p of o.not) if (typeof p === 'string') pairs.add(p);
    } catch { /* not ours to read: the other side's stands */ }
  }
  return `${JSON.stringify({ not: [...pairs].sort() }, null, 2)}\n`;
}

/** One file changed on both sides, merged. */
export function mergeFile(path: string, s: Sides): Merged {
  if (s.binary) return { action: 'keep', kept: [] };
  if (s.ours === null && s.theirs === null) return { action: 'remove', kept: [] };
  // edited on one side, deleted on the other: the edit stays
  if (s.ours === null) return { action: 'write', text: s.theirs!, kept: [] };
  if (s.theirs === null) return { action: 'keep', kept: [] };
  if (s.ours === s.theirs) return { action: 'keep', kept: [] };
  if (isLog(path)) return { action: 'write', text: unionLines(s.ours, s.theirs), kept: [] };
  if (path === '.ilmi/same.json') return { action: 'write', text: unionSame(s.ours, s.theirs), kept: [] };
  if (path.endsWith('.md')) {
    const m = mergeMarkdown(path, s.base, s.ours, s.theirs);
    return m.text === s.ours ? { action: 'keep', kept: m.kept } : { action: 'write', text: m.text, kept: m.kept };
  }
  // `.ilmi/order.json` and anything else app-private: the pulled side wins
  return { action: 'write', text: s.theirs, kept: [] };
}

// ── the commit message ───────────────────────────────────────────

export interface Change {
  path: string;
  before: string | null;
  after: string | null;
  binary: boolean;
}

/** A document's name for a message: its `title`, else its file name. */
function nameOf(path: string, text: string | null): string {
  if (text?.startsWith('---\n')) {
    for (const l of text.split('\n').slice(1)) {
      if (l === '---' || l === '...') break;
      const t = TITLE.exec(l);
      if (t && t[1]) {
        const v = t[1];
        if (v.startsWith('"')) { try { return String(JSON.parse(v)); } catch { /* as written */ } }
        return v.replace(/^'(.*)'$/, '$1');
      }
    }
  }
  return path.replace(/^.*\//, '').replace(/\.md$/, '');
}

const isSr = (l: string) => SR.test(l);

/**
 * What a commit carries, in a line: `3 reviews, ch. 3 read on, term paper
 * edited`. Reviews are counted by the `sr` lines that changed; a document
 * whose `read`/`write` field or a section's line moved is `read on`; any
 * other change to it is `edited`; files that came and went say so; the
 * order and the pairs by name; the review log by its reviews.
 */
export function describeChanges(changes: readonly Change[]): string {
  let reviews = 0;
  const parts: string[] = [];
  for (const c of changes) {
    if (isLog(c.path) || c.path === '.gitignore') continue;
    if (c.path === '.ilmi/order.json') { parts.push('order changed'); continue; }
    if (c.path === '.ilmi/same.json') { parts.push('pairs noted'); continue; }
    const name = nameOf(c.path, c.after ?? c.before);
    if (c.before === null && c.after !== null) { parts.push(`${name} added`); continue; }
    if (c.after === null && c.before !== null) { parts.push(`${name} removed`); continue; }
    if (c.binary || c.before === null || c.after === null) { parts.push(`${name} ${c.after === null && !c.binary ? 'removed' : 'changed'}`); continue; }
    const before = c.before.split('\n');
    const after = c.after.split('\n');
    const had = new Set(before);
    const now = new Set(after);
    const gone = before.filter((l) => !now.has(l));
    const came = after.filter((l) => !had.has(l));
    const srs = came.filter(isSr).length;
    reviews += srs;
    const rest = [...gone, ...came].filter((l) => !isSr(l));
    if (rest.length === 0) continue;
    const readOn = rest.every((l) => scheduleKind(l) !== null);
    parts.push(`${name} ${readOn ? 'read on' : 'edited'}`);
  }
  const head = reviews ? [`${reviews} review${reviews === 1 ? '' : 's'}`] : [];
  const shown = parts.slice(0, 4);
  const more = parts.length - shown.length;
  const all = [...head, ...shown, ...(more > 0 ? [`and ${more} more`] : [])];
  return all.length ? all.join(', ') : 'changes';
}
