// The attribute grammar shared by `<!-- sr … -->` and the read/write fields.
// FORMAT.md §7.

import type { Extra } from './model.js';

export interface AttrList {
  bare: string[];
  pairs: [string, string][];
}

const KEY = /^[A-Za-z_][A-Za-z0-9_-]*$/;

export type Warn = (message: string) => void;

export function parseAttrs(s: string, warn: Warn): AttrList {
  const out: AttrList = { bare: [], pairs: [] };
  for (const tok of s.split(/\s+/)) {
    if (!tok) continue;
    const eq = tok.indexOf('=');
    if (eq < 0) { out.bare.push(tok); continue; }
    const key = tok.slice(0, eq);
    const value = tok.slice(eq + 1);
    if (!KEY.test(key)) { warn(`bad attribute name "${key}"`); continue; }
    if (!value) { warn(`empty value for "${key}"`); continue; }
    out.pairs.push([key, value]);
  }
  return out;
}

export function formatAttrs(pairs: [string, string][]): string {
  return pairs.map(([k, v]) => `${k}=${v}`).join(' ');
}

// ── value types ──────────────────────────────────────────────────

const NUMBER = /^-?\d+(\.\d+)?([eE][-+]?\d+)?$/;
const DAY = /^(\d{4})-(\d{2})-(\d{2})$/;
const INSTANT = /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})(?::(\d{2}))?Z$/;

export function parseNumber(v: string): number | null {
  if (!NUMBER.test(v)) return null;
  const n = Number(v);
  return Number.isFinite(n) ? n : null;
}

export function parseInt_(v: string): number | null {
  const n = parseNumber(v);
  return n !== null && Number.isInteger(n) && n >= 0 ? n : null;
}

export function parseNonNeg(v: string): number | null {
  const n = parseNumber(v);
  return n !== null && n >= 0 ? n : null;
}

function inRange(n: string, lo: number, hi: number): boolean {
  const x = Number(n);
  return x >= lo && x <= hi;
}

/** A day `YYYY-MM-DD`; returned canonical or null. */
export function parseDay(v: string): string | null {
  const m = DAY.exec(v);
  if (!m || !inRange(m[2]!, 1, 12) || !inRange(m[3]!, 1, 31)) return null;
  return v;
}

/** A day or a UTC instant; instants are normalized to include seconds. */
export function parseWhen(v: string): string | null {
  const day = parseDay(v);
  if (day) return day;
  const m = INSTANT.exec(v);
  if (!m) return null;
  if (!inRange(m[2]!, 1, 12) || !inRange(m[3]!, 1, 31)) return null;
  if (!inRange(m[4]!, 0, 23) || !inRange(m[5]!, 0, 59)) return null;
  if (m[6] !== undefined && !inRange(m[6], 0, 60)) return null;
  return `${m[1]}-${m[2]}-${m[3]}T${m[4]}:${m[5]}:${m[6] ?? '00'}Z`;
}

export function parseBool(v: string): boolean | null {
  switch (v.toLowerCase()) {
    case 'true': case 'yes': case '1': return true;
    case 'false': case 'no': case '0': return false;
    default: return null;
  }
}

export function formatNumber(n: number): string {
  return String(n);
}

// ── typed attribute objects ──────────────────────────────────────
// A spec maps an on-disk key to a property name and a value parser. Reading
// fills the typed object and collects unknown keys into `extra`; writing
// emits known keys in spec order, then `extra`.

export interface AttrSpec<T> {
  key: string;
  prop: keyof T & string;
  parse: (v: string) => unknown;
  format: (x: unknown) => string;
}

const asStr = (x: unknown) => String(x);

export const specWhen = <T>(key: string, prop: keyof T & string): AttrSpec<T> =>
  ({ key, prop, parse: parseWhen, format: asStr });
export const specNum = <T>(key: string, prop: keyof T & string): AttrSpec<T> =>
  ({ key, prop, parse: parseNonNeg, format: (x) => formatNumber(x as number) });
export const specInt = <T>(key: string, prop: keyof T & string): AttrSpec<T> =>
  ({ key, prop, parse: parseInt_, format: (x) => formatNumber(x as number) });
export const specBool = <T>(key: string, prop: keyof T & string): AttrSpec<T> =>
  ({ key, prop, parse: parseBool, format: (x) => (x ? 'true' : 'false') });
export const specEnum = <T>(key: string, prop: keyof T & string, values: readonly string[]): AttrSpec<T> =>
  ({ key, prop, parse: (v) => (values.includes(v) ? v : null), format: asStr });
export const specIntRange = <T>(key: string, prop: keyof T & string, lo: number, hi: number): AttrSpec<T> =>
  ({ key, prop, parse: (v) => { const n = parseInt_(v); return n !== null && n >= lo && n <= hi ? n : null; }, format: asStr });

export function readAttrs<T extends { extra?: Extra }>(pairs: [string, string][], specs: AttrSpec<T>[], warn: Warn): T {
  const out = {} as T;
  const extra: Extra = [];
  for (const [k, v] of pairs) {
    const spec = specs.find((s) => s.key === k);
    if (!spec) { extra.push([k, v]); continue; }
    const parsed = spec.parse(v);
    if (parsed === null) { warn(`bad value for "${k}": ${v}`); continue; }
    (out as Record<string, unknown>)[spec.prop] = parsed;
  }
  if (extra.length) out.extra = extra;
  return out;
}

export function writeAttrs<T extends { extra?: Extra }>(obj: T, specs: AttrSpec<T>[]): [string, string][] {
  const pairs: [string, string][] = [];
  for (const spec of specs) {
    const v = (obj as Record<string, unknown>)[spec.prop];
    if (v === undefined) continue;
    pairs.push([spec.key, spec.format(v)]);
  }
  for (const [k, v] of obj.extra ?? []) pairs.push([k, v]);
  return pairs;
}
