// Primitive readers and writers for SuperMemo's data files: little-endian
// integers, IEEE doubles, Borland real48, Delphi TDateTime (LAYOUT.md §12).
// The writers exist for the fixture collection, which is built from the
// documented layout and read back by the same readers.

export const u8 = (b: Uint8Array, o: number): number => b[o] ?? 0;

export const u16 = (b: Uint8Array, o: number): number => u8(b, o) | (u8(b, o + 1) << 8);

export function i16(b: Uint8Array, o: number): number {
  const v = u16(b, o);
  return v >= 0x8000 ? v - 0x10000 : v;
}

/** The `<< 24` makes the result signed. */
export const i32 = (b: Uint8Array, o: number): number =>
  (u8(b, o) | (u8(b, o + 1) << 8) | (u8(b, o + 2) << 16) | (u8(b, o + 3) << 24)) | 0;

export function f64(b: Uint8Array, o: number): number {
  if (o + 8 > b.length) return 0;
  return new DataView(b.buffer, b.byteOffset, b.byteLength).getFloat64(o, true);
}

/**
 * Borland real48: byte 0 the exponent biased by 129 (0 means zero), bytes
 * 1–5 the mantissa low to high with the sign in bit 7 of byte 5 and an
 * implicit leading 1.
 */
export function real48(b: Uint8Array, o: number): number {
  const ex = u8(b, o);
  if (ex === 0) return 0;
  const b5 = u8(b, o + 5);
  const mant = (b5 & 0x7f) * 2 ** 32 + u8(b, o + 4) * 2 ** 24 + u8(b, o + 3) * 2 ** 16 + u8(b, o + 2) * 2 ** 8 + u8(b, o + 1);
  return (b5 >> 7 ? -1 : 1) * (1 + mant / 2 ** 39) * 2 ** (ex - 129);
}

// ── writers ──────────────────────────────────────────────────────

export const le16 = (n: number): Uint8Array => Uint8Array.of(n & 0xff, (n >>> 8) & 0xff);

export const le32 = (n: number): Uint8Array => Uint8Array.of(n & 0xff, (n >>> 8) & 0xff, (n >>> 16) & 0xff, (n >>> 24) & 0xff);

export function f64le(v: number): Uint8Array {
  const out = new Uint8Array(8);
  new DataView(out.buffer).setFloat64(0, v, true);
  return out;
}

export function real48le(v: number): Uint8Array {
  const out = new Uint8Array(6);
  if (v === 0) return out;
  const a = Math.abs(v);
  let e = Math.floor(Math.log2(a));
  let mant = Math.round((a / 2 ** e - 1) * 2 ** 39);
  if (mant >= 2 ** 39) { mant = 0; e += 1; }
  out[0] = e + 129;
  out[1] = mant % 256;
  out[2] = Math.floor(mant / 2 ** 8) % 256;
  out[3] = Math.floor(mant / 2 ** 16) % 256;
  out[4] = Math.floor(mant / 2 ** 24) % 256;
  out[5] = ((v < 0 ? 1 : 0) << 7) | (Math.floor(mant / 2 ** 32) & 0x7f);
  return out;
}

export function concat(parts: Uint8Array[]): Uint8Array {
  const out = new Uint8Array(parts.reduce((n, p) => n + p.length, 0));
  let at = 0;
  for (const p of parts) { out.set(p, at); at += p.length; }
  return out;
}

// ── dates ────────────────────────────────────────────────────────

const TD_EPOCH_MS = Date.UTC(1899, 11, 30);
const DAY_MS = 86_400_000;

/** A TDateTime below this is SuperMemo's "never". */
export const TD_NEVER = 1000;

const pad = (n: number) => String(n).padStart(2, '0');

/** Whole days from 1899-12-30 to `day` (`YYYY-MM-DD`). */
export function tdDay(day: string): number {
  const [y, m, d] = day.split('-').map(Number) as [number, number, number];
  return Math.round((Date.UTC(y, m - 1, d) - TD_EPOCH_MS) / DAY_MS);
}

/** The calendar day `days` after 1899-12-30. */
export function dayOfTd(days: number): string {
  const d = new Date(TD_EPOCH_MS + Math.floor(days) * DAY_MS);
  return `${d.getUTCFullYear()}-${pad(d.getUTCMonth() + 1)}-${pad(d.getUTCDate())}`;
}

/** The day a TDateTime names, or `null` for "never". */
export function tdWhen(v: number): string | null {
  return Number.isFinite(v) && v >= TD_NEVER ? dayOfTd(v) : null;
}
