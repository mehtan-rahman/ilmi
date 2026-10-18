// Front-matter: known fields are typed, everything else is a verbatim line.
// FORMAT.md §3.

import {
  parseAttrs, formatAttrs, parseDay, parseWhen, parseBool, parseInt_, parseNumber, readAttrs, writeAttrs,
  specWhen, specInt, specIntMin, specIntRange, specNumMin, specBool, type AttrSpec, type Warn,
} from './attrs.js';
import {
  isField, type CardForm, type Diagnostic, type Doc, type Field, type FieldKey, type FmEntry,
  type Frontmatter, type NodeType, type ReadSchedule, type WriteSchedule,
} from './model.js';

const NODE_TYPES: readonly NodeType[] = ['source', 'deck', 'draft', 'extract'];
const CARD_FORMS: readonly CardForm[] = ['cloze', 'qa', 'bidir'];

/** Priority: 0–100, lower first. The `pri` field, the fallback on a `read` / `write` line, and a card's override. */
export const PRI_MIN = 0;
export const PRI_MAX = 100;
export const PRI_DEFAULT = 50;

/** Growth: the factor an interval grows by on each pass. Written only when it is not the loop's default. */
export const AF_MIN = 1.1;
export const READ_AF = 1.6;
export const WRITE_AF = 1.5;

export const READ_SPECS: AttrSpec<ReadSchedule>[] = [
  specWhen('due', 'due'), specInt('ivl', 'ivl'), specInt('reps', 'reps'), specInt('pos', 'pos'), specIntMin('page', 'page', 1), specNumMin('af', 'af', AF_MIN), specIntRange('pri', 'pri', PRI_MIN, PRI_MAX),
];
export const WRITE_SPECS: AttrSpec<WriteSchedule>[] = [
  specWhen('due', 'due'), specInt('ivl', 'ivl'), specInt('reps', 'reps'), specNumMin('af', 'af', AF_MIN), specIntRange('pri', 'pri', PRI_MIN, PRI_MAX), specBool('done', 'done'),
];

/** `pri` as a number in range, or null. */
export function parsePri(v: string): number | null {
  const n = parseInt_(v);
  return n !== null && n >= PRI_MIN && n <= PRI_MAX ? n : null;
}

/** `af` as a number at or above `AF_MIN`, or null. */
export function parseAf(v: string): number | null {
  const n = parseNumber(v);
  return n !== null && n >= AF_MIN ? n : null;
}

/** The schedule without an `af` that only says the default. In place when `into` is given, else a copy. */
function withoutDefaultAf<T extends ReadSchedule | WriteSchedule>(s: T, def: number): T {
  if (s.af !== def) return s;
  const { af: _, ...rest } = s;
  return rest as T;
}

const FIELD_LINE = /^([A-Za-z0-9_-]+):(?:[ \t]+(.*))?$/;

/** Strip a trailing YAML comment (` # …`) from a scalar. */
function stripComment(v: string): string {
  const m = /\s#/.exec(v);
  return (m ? v.slice(0, m.index) : v).trim();
}

// ── title quoting ────────────────────────────────────────────────

function parseTitle(v: string, warn: Warn): string | null {
  if (v.length >= 2 && v.startsWith('"') && v.endsWith('"')) {
    try { const s: unknown = JSON.parse(v); if (typeof s === 'string') return s; } catch { /* fall through */ }
    warn('bad quoted title');
    return null;
  }
  if (v.length >= 2 && v.startsWith("'") && v.endsWith("'")) return v.slice(1, -1).replace(/''/g, "'");
  return stripComment(v);
}

const PLAIN_UNSAFE_START = /^[\s"'\[\]{}&*!|>%@#`,?:-]/;

export function formatTitle(s: string): string {
  const plain = s.length > 0
    && !PLAIN_UNSAFE_START.test(s)
    && s.trim() === s
    && !s.includes(': ') && !s.includes(' #') && !s.includes('\n')
    && !(s.endsWith(':'));
  return plain ? s : JSON.stringify(s);
}

// ── parse ────────────────────────────────────────────────────────

function parseValue(key: FieldKey, raw: string, warn: Warn): Field | null {
  switch (key) {
    case 'type': {
      const v = stripComment(raw) as NodeType;
      return NODE_TYPES.includes(v) ? { key, value: v } : null;
    }
    case 'default-card': {
      const v = stripComment(raw) as CardForm;
      return CARD_FORMS.includes(v) ? { key, value: v } : null;
    }
    case 'title': {
      const v = parseTitle(raw.trim(), warn);
      return v === null ? null : { key, value: v };
    }
    case 'frozen': {
      const v = parseBool(stripComment(raw));
      return v === null ? null : { key, value: v };
    }
    case 'imported':
    case 'started': {
      const v = parseDay(stripComment(raw));
      return v === null ? null : { key, value: v };
    }
    case 'read':
      return { key, value: withoutDefaultAf(readTyped(raw, READ_SPECS, warn), READ_AF) };
    case 'write':
      return { key, value: withoutDefaultAf(readTyped(raw, WRITE_SPECS, warn), WRITE_AF) };
    case 'pri': {
      const v = parsePri(stripComment(raw));
      return v === null ? null : { key, value: v };
    }
    case 'pdf':
    case 'url':
    case 'author': {
      // a file name relative to the document, a page's address, a name: quoted like a title when it must be
      const v = parseTitle(raw.trim(), warn);
      return v === null || !v.trim() ? null : { key, value: v };
    }
    case 'published': {
      const v = parseWhen(stripComment(raw));
      return v === null ? null : { key, value: v };
    }
  }
}

function readTyped<T extends { extra?: [string, string][] }>(raw: string, specs: AttrSpec<T>[], warn: Warn): T {
  const attrs = parseAttrs(stripComment(raw), warn);
  for (const b of attrs.bare) warn(`unexpected token "${b}"`);
  return readAttrs(attrs.pairs, specs, warn);
}

/** `lines` are the lines between the `---` fences; `firstLine` is the 1-based line number of the first. */
export function parseFrontmatter(lines: string[], firstLine: number, diags: Diagnostic[]): Frontmatter {
  const entries: FmEntry[] = [];
  const lineOf: number[] = [];
  const push = (e: FmEntry, lineNo: number) => { entries.push(e); lineOf.push(lineNo); };
  lines.forEach((line, i) => {
    const lineNo = firstLine + i;
    const warn: Warn = (message) => diags.push({ line: lineNo, message });
    const m = FIELD_LINE.exec(line);
    const key = m?.[1] as FieldKey | undefined;
    if (!m || !key || !isKnown(key)) { push({ raw: line }, lineNo); return; }
    const raw = m[2] ?? '';
    let field: Field | null;
    if (!raw.trim()) {
      // `read:` / `write:` alone means enrolled, nothing recorded yet
      if (key !== 'read' && key !== 'write') {
        warn(`"${key}" needs a value`);
        push({ raw: line }, lineNo);
        return;
      }
      field = { key, value: {} };
    } else {
      field = parseValue(key, raw, warn);
    }
    if (!field) {
      warn(`bad value for "${key}"`);
      push({ raw: line }, lineNo);
      return;
    }
    const prior = entries.findIndex((e) => isField(e) && e.key === key);
    if (prior >= 0) {
      warn(`"${key}" given twice; later wins`);
      entries[prior] = field;
      return;
    }
    push(field, lineNo);
  });
  // a read/write field followed by an indented line looks like YAML nesting,
  // which is not read. Judged on the final entry list, so the same file
  // written back reports the same thing.
  entries.forEach((e, i) => {
    const next = entries[i + 1];
    if (isField(e) && (e.key === 'read' || e.key === 'write') && next && !isField(next) && /^[ \t]+\S/.test(next.raw)) {
      diags.push({ line: lineOf[i]!, message: `nested values under "${e.key}" are ignored; use inline attributes` });
    }
  });
  // the `pri` field supersedes a `pri=` on the read / write lines, which only
  // stands in while there is no field (§8: dropped on the first write)
  if (hasPriField(entries)) for (const e of entries) if (isField(e)) withoutLinePri(e, entries);
  return { entries };
}

const hasPriField = (entries: FmEntry[]) => entries.some((e) => isField(e) && e.key === 'pri');

/** The field without a `pri` on a read / write line; in place when `into` is given, else a copy. */
function withoutLinePri(f: Field, into?: FmEntry[]): Field {
  if ((f.key !== 'read' && f.key !== 'write') || f.value.pri === undefined) return f;
  const { pri: _, ...rest } = f.value;
  const out = { key: f.key, value: rest } as Field;
  if (into) into[into.indexOf(f)] = out;
  return out;
}

const KNOWN = new Set<string>(['type', 'title', 'frozen', 'imported', 'started', 'read', 'write', 'default-card', 'pri', 'pdf', 'url', 'author', 'published']);
function isKnown(k: string): k is FieldKey { return KNOWN.has(k); }

// ── serialize ────────────────────────────────────────────────────

export function formatField(f: Field): string {
  switch (f.key) {
    case 'type': case 'default-card': return `${f.key}: ${f.value}`;
    case 'title': return `title: ${formatTitle(f.value)}`;
    case 'frozen': return `frozen: ${f.value ? 'true' : 'false'}`;
    case 'imported': case 'started': return `${f.key}: ${f.value}`;
    case 'read': return attrLine('read', formatAttrs(writeAttrs(withoutDefaultAf(f.value, READ_AF), READ_SPECS)));
    case 'write': return attrLine('write', formatAttrs(writeAttrs(withoutDefaultAf(f.value, WRITE_AF), WRITE_SPECS)));
    case 'pri': return `pri: ${f.value}`;
    case 'pdf': case 'url': case 'author': return `${f.key}: ${formatTitle(f.value)}`;
    case 'published': return `published: ${f.value}`;
  }
}

const attrLine = (key: string, attrs: string) => (attrs ? `${key}: ${attrs}` : `${key}:`);

export function formatFrontmatter(fm: Frontmatter): string {
  // a document that gained the field in memory writes its lines without the fallback
  const drop = hasPriField(fm.entries);
  const lines = fm.entries.map((e) => (isField(e) ? formatField(drop ? withoutLinePri(e) : e) : e.raw));
  return ['---', ...lines, '---'].join('\n');
}

// ── typed access ─────────────────────────────────────────────────

export interface Meta {
  type: NodeType;
  title?: string;
  frozen: boolean;
  imported?: string;
  started?: string;
  read?: ReadSchedule;
  write?: WriteSchedule;
  defaultCard?: CardForm;
  /** The `pri` field; absent means `PRI_DEFAULT`, unless a `read` / `write` line carries a fallback. */
  pri?: number;
  /** The `pdf` field: the document's pages, a file relative to the document. */
  pdf?: string;
  /** A clipped page's address, who wrote it, and when it was published (a day or a UTC instant). */
  url?: string;
  author?: string;
  published?: string;
}

/** The document's front-matter as a plain object, defaults applied. */
export function meta(doc: Doc): Meta {
  const out: Meta = { type: 'source', frozen: false };
  for (const e of doc.frontmatter?.entries ?? []) {
    if (!isField(e)) continue;
    switch (e.key) {
      case 'type': out.type = e.value; break;
      case 'title': out.title = e.value; break;
      case 'frozen': out.frozen = e.value; break;
      case 'imported': out.imported = e.value; break;
      case 'started': out.started = e.value; break;
      case 'read': out.read = e.value; break;
      case 'write': out.write = e.value; break;
      case 'default-card': out.defaultCard = e.value; break;
      case 'pri': out.pri = e.value; break;
      case 'pdf': out.pdf = e.value; break;
      case 'url': out.url = e.value; break;
      case 'author': out.author = e.value; break;
      case 'published': out.published = e.value; break;
    }
  }
  return out;
}

/** The priority that applies to a document's reading, writing, and cards: the field, else `PRI_DEFAULT`. */
export function docPri(m: Meta): number {
  return m.pri ?? PRI_DEFAULT;
}

type ValueOf<K extends FieldKey> = Extract<Field, { key: K }>['value'];

/**
 * Set or clear one front-matter field in place. An existing line keeps its
 * position; a new one is appended; `null` removes it. Creates the front-matter
 * block if the document has none.
 */
export function setField<K extends FieldKey>(doc: Doc, key: K, value: ValueOf<K> | null): void {
  const fm = doc.frontmatter ?? { entries: [] };
  const at = fm.entries.findIndex((e) => isField(e) && e.key === key);
  if (value === null) {
    if (at >= 0) fm.entries.splice(at, 1);
  } else {
    const field = (key === 'read' ? { key, value: withoutDefaultAf(value as ReadSchedule, READ_AF) }
      : key === 'write' ? { key, value: withoutDefaultAf(value as WriteSchedule, WRITE_AF) }
      : { key, value }) as Field;
    if (at >= 0) fm.entries[at] = field; else fm.entries.push(field);
    // the field supersedes a `pri=` on the read / write lines, for good
    if (key === 'pri') for (const e of fm.entries) if (isField(e)) withoutLinePri(e, fm.entries);
  }
  if (fm.entries.length) doc.frontmatter = fm;
  else delete doc.frontmatter;
}
