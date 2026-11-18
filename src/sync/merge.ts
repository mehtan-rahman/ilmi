// The merge of one file changed on both devices, by the format's rules
// (milestone 53). Pure: the Rust side (`src-tauri/src/sync.rs`) hands over
// a file's three texts, this decides the one text to keep, and the
// controller (`src/app/sync.ts`) writes it and commits. The rules:
//
// - A schedule line changed on both sides takes the later instant: `last`
//   on an `sr` line (then `due`, then `seen`: a card learnt and not yet
//   tested), `due` on a `read`/`write` field and a section's `read` line.
//   One review touches one line, so reviews of different cards in one file
//   never meet; two lines of one card (its two directions, two blanks of a
//   cloze), each written on one side, are both kept; a line one side took
//   away and the other changed stays; and a card given its id on each side
//   (its first line, written on both before they met) keeps one of them,
//   the same on every device.
// - A block reworded on one side, with only its schedule lines changed on
//   the other (a card graded or learnt there), takes the words of the one
//   and the lines of both.
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
  // a review, then a due, then a card learnt and not yet tested (`seen`): a line that has a review is later than one that has none
  for (const name of ['last', 'due', 'seen']) {
    const a = instant(attr(ours, name));
    const b = instant(attr(theirs, name));
    if (a !== null && b !== null && a !== b) return a > b ? 'ours' : 'theirs';
    if (a !== null && b === null) return 'ours';
    if (a === null && b !== null) return 'theirs';
  }
  return 'ours';
}

/** A schedule line in a document's body: a card's `sr` line or a section's `read` line (a field's line is the front matter's). */
const bodyKind = (line: string): string | null => { const k = scheduleKind(line); return k === 'read' || k === 'write' ? null : k; };

/** What a block says: its lines that are not schedule lines, a card's id aside. Two blocks that say the same differ only in what a review, a pass, or a first schedule line writes. */
const prose = (block: string[]): string => block.filter((l) => bodyKind(l) === null).map((l) => bare(l)[0]).join('\n');

/** A block as its lines that are not schedule lines, each with the schedule lines under it by kind (`null`: those before any). */
type Under = { line: string | null; sched: Map<string, string> }[];

function under(block: string[]): Under {
  const out: Under = [];
  for (const line of block) {
    const k = bodyKind(line);
    if (k === null) { out.push({ line, sched: new Map() }); continue; }
    if (!out.length) out.push({ line: null, sched: new Map() });
    out[out.length - 1]!.sched.set(k, line);
  }
  return out;
}

const ID_TAIL = /[ \t]+\^([A-Za-z0-9_-]+)[ \t]*$/;
/** A line without the block id at its end, and that id. */
const bare = (line: string | null): [string | null, string | null] => { const m = line === null ? null : ID_TAIL.exec(line); return m ? [line!.slice(0, m.index), m[1]!] : [line, null]; };

/** The latest review among schedule lines, as a sortable string; none, the empty one. */
const lastOf = (sched: Map<string, string>): string => [...sched.values()].map((l) => instant(attr(l, 'last')) ?? '').sort().pop() ?? '';

/** Where a schedule line of a kind goes under its card: the bare line, the reverse's, the groups' in order. */
const place = (kind: string): number => (kind === 'sr' || kind === 'section' ? 0 : kind === 'sr r' ? 1 : 2 + (Number(kind.slice(4)) || 0));

/**
 * Two versions of one block that differ only in their schedule lines, and
 * in an id given to a card on either side (its first schedule line, written
 * on each device before they met): merged line by line. Under each line
 * that is not a schedule line, the schedule lines of each kind: one side's
 * when the other left it as the base had it (written, changed or taken
 * away); of two that changed it the later (`later`); a line one side took
 * away and the other changed stays, changed. An id on one side only is
 * kept; of two, the one on the side with the later review there (the
 * smaller of the two when neither has one), so each device keeps the same.
 * Null when anything else differs: a real conflict.
 */
function bySchedule(b: string[] | null, o: string[], t: string[]): string[] | null {
  const [uo, ut] = [under(o), under(t)];
  if (uo.length !== ut.length) return null;
  const ub0 = b ? under(b) : null;
  // the base stands for what both had only when each of its lines is what one side still has (a card's id aside)
  const ub = ub0 && ub0.length === uo.length && ub0.every((g, i) => bare(g.line)[0] === bare(uo[i]!.line)[0] || bare(g.line)[0] === bare(ut[i]!.line)[0]) ? ub0 : null;
  const lines: string[] = [];
  for (let i = 0; i < uo.length; i++) {
    const [go, gt] = [uo[i]!, ut[i]!];
    let line = go.line;
    if (go.line !== gt.line) {
      const [[so, io], [st, it]] = [bare(go.line), bare(gt.line)];
      const [sb, ib] = ub ? bare(ub[i]!.line) : [undefined, null];
      // what the line says: the same on both, or one side's rewording of what the other left as it was
      const text = so === st ? so : so === sb ? st : st === sb ? so : undefined;
      if (text === undefined || text === null) return null;
      // its id: the base's when it had one (not one side's to change); else the one given on either side, of two the
      // one on the side with the later review there, the smaller when neither has one
      let id: string | null;
      if (ib !== null) { if ((io !== null && io !== ib) || (it !== null && it !== ib)) return null; id = ib; }
      else if (io === null || it === null || io === it) id = io ?? it;
      else { const [lo, lt] = [lastOf(go.sched), lastOf(gt.sched)]; id = lo !== lt ? (lo > lt ? io : it) : io < it ? io : it; }
      const whole = (x: string | null, xs: string | null, xi: string | null) => xs === text && xi === id ? x : null;
      line = whole(go.line, so, io) ?? whole(gt.line, st, it) ?? (id === null ? text : `${text} ^${id}`);
    }
    if (line !== null) lines.push(line);
    const kinds = [...new Set([...go.sched.keys(), ...gt.sched.keys()])].sort((x, y) => place(x) - place(y));
    for (const k of kinds) {
      const [vo, vt] = [go.sched.get(k), gt.sched.get(k)];
      const vb = ub ? ub[i]!.sched.get(k) : undefined;
      let keep: string | undefined;
      if (vo === vt) keep = vo;
      else if (ub && vo === vb) keep = vt;
      else if (ub && vt === vb) keep = vo;
      else if (vo !== undefined && vt !== undefined) keep = later(vo, vt) === 'ours' ? vo : vt;
      else keep = vo ?? vt;
      if (keep !== undefined) lines.push(keep);
    }
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
    // both changed these blocks. They are held against each other again by what they say (`prose`: a block without
    // its schedule lines and a card's id), so a block that says the same on both sides is merged by its schedule
    // lines wherever it falls among blocks one side added, took away or reworded
    const b = h.base.map((k) => byKey.get(k) ?? k.split('\n'));
    const top = lines.length === 0;
    const front = (x: string[][]): boolean => top && x[0]?.[0] === '---';
    const said = (x: string[][]): string[] => x.map((blk, i) => (i === 0 && front(x) ? '---' : prose(blk)));
    let [bi, oi, ti] = [0, 0, 0];
    // with nothing of the base here (histories that never met, blocks both made): what the two say alike stands in for it
    const none = b.length === 0;
    for (const g of diff3(none ? common(said(o), said(t)) : said(b), said(o), said(t))) {
      if ('stable' in g) {
        const [bb, ob, tb] = [none ? null : b[bi++]!, o[oi++]!, t[ti++]!];
        if ((bb && key(ob) === key(bb)) || key(ob) === key(tb)) { push(tb); continue; }
        if (bb && key(tb) === key(bb)) { push(ob); continue; }
        // front-matter on both sides: line by line, a schedule line's later version, anything else the pulled side's
        if (g.stable === '---') { push(mergeFrontMatter(bb ?? [], ob, tb)); continue; }
        const merged = bySchedule(bb, ob, tb);
        if (merged) { push(merged); continue; }
        kept.push({ path, heading: headingAbove(lines, lines.length, path) });
        push(closed(ob));
        push(tb);
        continue;
      }
      const [gb, go, gt] = [none ? [] : b.slice(bi, bi + g.base.length), o.slice(oi, oi + g.ours.length), t.slice(ti, ti + g.theirs.length)];
      bi += g.base.length; oi += g.ours.length; ti += g.theirs.length;
      const [kb, ko2, kt2] = [gb.map(key), go.map(key), gt.map(key)];
      if (same(ko2, kb) || same(ko2, kt2)) { gt.forEach(push); continue; }
      if (same(kt2, kb)) { go.forEach(push); continue; }
      // a block only one side has (added there, or taken away here with nothing put in its place) is that side's to say
      if (!gb.length && !gt.length) { go.forEach(push); continue; }
      if (!gb.length && !go.length) { gt.forEach(push); continue; }
      // front-matter one side made and the other changed, or both made
      if (go.length === 1 && gt.length === 1 && front(go) && front(gt) && lines.length === 0) { push(mergeFrontMatter(gb.length === 1 ? gb[0]! : [], go[0]!, gt[0]!)); continue; }
      // block for block, one side rewording what the other only wrote a schedule line under (a card graded or learnt
      // here, reworded there): the words of the one, the lines of both
      if (gb.length === go.length && gb.length === gt.length) {
        const each = gb.map((bb, i) => bySchedule(bb, go[i]!, gt[i]!));
        if (each.every((x) => x !== null)) { each.forEach((x) => push(x!)); continue; }
      }
      kept.push({ path, heading: headingAbove(lines, lines.length, path) });
      go.forEach((blk, i) => push(i === go.length - 1 ? closed(blk) : blk));
      gt.forEach(push);
    }
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
