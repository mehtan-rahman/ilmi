// Front-matter: known fields are typed, everything else is a verbatim line.
// FORMAT.md §3.

import {
  parseAttrs, formatAttrs, parseDay, parseBool, readAttrs, writeAttrs,
  specWhen, specInt, specBool, type AttrSpec, type Warn,
} from './attrs.js';
import {
  isField, type CardForm, type Diagnostic, type Doc, type Field, type FieldKey, type FmEntry,
  type Frontmatter, type NodeType, type ReadSchedule, type WriteSchedule,
} from './model.js';

const NODE_TYPES: readonly NodeType[] = ['source', 'deck', 'draft', 'extract'];
const CARD_FORMS: readonly CardForm[] = ['cloze', 'qa', 'bidir'];

export const READ_SPECS: AttrSpec<ReadSchedule>[] = [
  specWhen('due', 'due'), specInt('ivl', 'ivl'), specInt('reps', 'reps'), specInt('pos', 'pos'), specInt('pri', 'pri'),
];
export const WRITE_SPECS: AttrSpec<WriteSchedule>[] = [
  specWhen('due', 'due'), specInt('ivl', 'ivl'), specInt('reps', 'reps'), specInt('pri', 'pri'), specBool('done', 'done'),
];

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
      return { key, value: readTyped(raw, READ_SPECS, warn) };
    case 'write':
      return { key, value: readTyped(raw, WRITE_SPECS, warn) };
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
  return { entries };
}

const KNOWN = new Set<string>(['type', 'title', 'frozen', 'imported', 'started', 'read', 'write', 'default-card']);
function isKnown(k: string): k is FieldKey { return KNOWN.has(k); }

// ── serialize ────────────────────────────────────────────────────

export function formatField(f: Field): string {
  switch (f.key) {
    case 'type': case 'default-card': return `${f.key}: ${f.value}`;
    case 'title': return `title: ${formatTitle(f.value)}`;
    case 'frozen': return `frozen: ${f.value ? 'true' : 'false'}`;
    case 'imported': case 'started': return `${f.key}: ${f.value}`;
    case 'read': return attrLine('read', formatAttrs(writeAttrs(f.value, READ_SPECS)));
    case 'write': return attrLine('write', formatAttrs(writeAttrs(f.value, WRITE_SPECS)));
  }
}

const attrLine = (key: string, attrs: string) => (attrs ? `${key}: ${attrs}` : `${key}:`);

export function formatFrontmatter(fm: Frontmatter): string {
  const lines = fm.entries.map((e) => (isField(e) ? formatField(e) : e.raw));
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
    }
  }
  return out;
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
    const field = { key, value } as Field;
    if (at >= 0) fm.entries[at] = field; else fm.entries.push(field);
  }
  if (fm.entries.length) doc.frontmatter = fm;
  else delete doc.frontmatter;
}
