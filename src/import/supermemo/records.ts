// The fixed-size records of a SuperMemo collection, read exactly as
// LAYOUT.md documents them and no further: a field the notes do not cover is
// not read, and a record that does not fit is a diagnostic, never a guess.

import { f64, i16, i32, real48, u16, u8 } from './bytes.js';

export interface ImportDiagnostic {
  /** The collection file, relative to the collection folder. */
  file: string;
  message: string;
}

export type Diags = ImportDiagnostic[];

export const CONTENTS_SIZE = 37;
export const INFO_SIZE = 118;
export const MEM_SIZE = 30;
export const HISTORY_SIZE = 39;
export const RTX_TRAILER = 6;
export const GROUP_MAGIC: readonly [number, number] = [0x31, 0xd4];

/** LAYOUT.md §3. Element N is record N-1. */
export interface ContentsRecord {
  id: number;
  deleted: boolean;
  parent: number;
  firstChild: number;
  nextSibling: number;
  descendants: number;
  children: number;
}

/** LAYOUT.md §4. */
export interface InfoRecord {
  id: number;
  typeByte: number;
  titleId: number;
  componPos: number;
  interval: number;
  lastRepDay: number;
  lastTouch: number;
  af: number;
  firstRep: number;
}

/** LAYOUT.md §6. Member N is record N-1. */
export interface MemRecord {
  id: number;
  useCount: number;
  linkType: number;
  rtxOffset: number;
  rtxLength: number;
  slot: number;
}

/** LAYOUT.md §8. */
export interface HistoryRecord {
  elementId: number;
  ordinal: number;
  /** A TDateTime; below `TD_NEVER` is a placeholder row. */
  when: number;
}

export type ComponentKind = 'html' | 'text' | 'rtf' | 'spelling' | 'image' | 'sound' | 'video' | 'shape' | 'unknown';

/** LAYOUT.md §5. */
export interface Component {
  kindByte: number;
  kind: ComponentKind;
  /** Absent for shapes and unknown kinds. */
  registryId?: number;
}

/** Kind byte → component, LAYOUT.md §5. */
const KINDS: Record<number, ComponentKind> = {
  0x0d: 'html', 0x10: 'html', 0x00: 'text', 0x0c: 'rtf', 0x01: 'spelling',
  0x02: 'image', 0x03: 'sound', 0x04: 'video', 0x05: 'shape', 0x06: 'shape', 0x07: 'shape',
};

export const TEXTUAL: ReadonlySet<ComponentKind> = new Set(['html', 'text', 'rtf']);
export const MEDIA: ReadonlySet<ComponentKind> = new Set(['image', 'sound', 'video', 'spelling']);

/** Link types of a registry member, LAYOUT.md §6. */
export const LINK_DELETED = 0;

/** How many whole records `b` holds; a remainder is reported. */
function recordCount(b: Uint8Array, size: number, file: string, diags: Diags): number {
  if (b.length % size !== 0) diags.push({ file, message: `${b.length} bytes is not a whole number of ${size}-byte records; the tail is ignored` });
  return Math.floor(b.length / size);
}

export function readContents(b: Uint8Array, diags: Diags, file = 'info/contents.dat'): ContentsRecord[] {
  const out: ContentsRecord[] = [];
  const n = recordCount(b, CONTENTS_SIZE, file, diags);
  for (let i = 0; i < n; i++) {
    const o = i * CONTENTS_SIZE;
    out.push({
      id: i + 1,
      deleted: u8(b, o) !== 0,
      parent: i32(b, o + 1),
      firstChild: i32(b, o + 5),
      nextSibling: i32(b, o + 17),
      descendants: i32(b, o + 21),
      children: i32(b, o + 25),
    });
  }
  return out;
}

export function readInfo(b: Uint8Array, diags: Diags, file = 'info/ElementInfo.dat'): InfoRecord[] {
  const out: InfoRecord[] = [];
  const n = recordCount(b, INFO_SIZE, file, diags);
  for (let i = 0; i < n; i++) {
    const o = i * INFO_SIZE;
    out.push({
      id: i + 1,
      typeByte: u8(b, o),
      titleId: i32(b, o + 2),
      componPos: i32(b, o + 6),
      interval: u16(b, o + 16),
      lastRepDay: i16(b, o + 18),
      lastTouch: f64(b, o + 20),
      af: real48(b, o + 28),
      firstRep: f64(b, o + 77),
    });
  }
  return out;
}

export function readMem(b: Uint8Array, diags: Diags, file: string): MemRecord[] {
  const out: MemRecord[] = [];
  const n = recordCount(b, MEM_SIZE, file, diags);
  for (let i = 0; i < n; i++) {
    const o = i * MEM_SIZE;
    out.push({
      id: i + 1,
      useCount: i32(b, o),
      linkType: u8(b, o + 4),
      rtxOffset: i32(b, o + 10),
      rtxLength: i32(b, o + 14),
      slot: i32(b, o + 22),
    });
  }
  return out;
}

export function readHistory(b: Uint8Array, diags: Diags, file = 'info/RepetitionHistory.dat'): HistoryRecord[] {
  const out: HistoryRecord[] = [];
  const n = recordCount(b, HISTORY_SIZE, file, diags);
  for (let i = 0; i < n; i++) {
    const o = i * HISTORY_SIZE;
    out.push({ elementId: i32(b, o), ordinal: u16(b, o + 4), when: f64(b, o + 10) });
  }
  return out;
}

/** An i32 array: `priority.sub`, `Outstanding.sub`, `repetitions.dat`. */
export function readInts(b: Uint8Array, diags: Diags, file: string): number[] {
  const out: number[] = [];
  const n = recordCount(b, 4, file, diags);
  for (let i = 0; i < n; i++) out.push(i32(b, i * 4));
  return out;
}

let strict: TextDecoder | null = null;
let loose: TextDecoder | null = null;

/** UTF-8, else windows-1252 (LAYOUT.md §6). Never throws. */
export function decodeText(b: Uint8Array): string {
  try {
    strict ??= new TextDecoder('utf-8', { fatal: true });
    return strict.decode(b);
  } catch {
    try {
      loose ??= new TextDecoder('windows-1252');
      return loose.decode(b);
    } catch {
      return Array.from(b, (c) => String.fromCharCode(c)).join('');
    }
  }
}

/**
 * The text of member `m` in `rtx`: the bytes at its 1-based offset, less the
 * six-byte trailer (NUL, the member id, a flag). `null` when the member has
 * no text, lies outside the file, or its trailer names another member.
 */
export function rtxText(rtx: Uint8Array, m: MemRecord, diags: Diags, file: string): string | null {
  if (m.rtxOffset <= 0 || m.rtxLength < RTX_TRAILER) return null;
  const from = m.rtxOffset - 1;
  const end = from + m.rtxLength;
  if (end > rtx.length) {
    diags.push({ file, message: `member ${m.id}: text at ${m.rtxOffset} runs past the end of the file` });
    return null;
  }
  const trailerId = i32(rtx, end - 5);
  if (trailerId !== m.id) {
    diags.push({ file, message: `member ${m.id}: trailer names member ${trailerId}; text not used` });
    return null;
  }
  return decodeText(rtx.subarray(from, end - RTX_TRAILER));
}

/**
 * The components of the group at `pos` for element `elementId` (LAYOUT.md
 * §5). Each component is skipped by the size its own header carries, so an
 * unknown kind costs one diagnostic, not the rest of the group. `null` when
 * there is no readable group at `pos`.
 */
export function readGroup(b: Uint8Array, pos: number, elementId: number, diags: Diags, file = 'info/compon.dat'): Component[] | null {
  const who = `element ${elementId}`;
  if (pos < 0 || pos + 11 > b.length || u8(b, pos) !== GROUP_MAGIC[0] || u8(b, pos + 1) !== GROUP_MAGIC[1]) {
    diags.push({ file, message: `${who}: no component group at ${pos}` });
    return null;
  }
  const owner = i32(b, pos + 4);
  if (owner !== elementId) {
    diags.push({ file, message: `${who}: the group at ${pos} belongs to element ${owner}` });
    return null;
  }
  const count = u8(b, pos + 8);
  let p = pos + 11 + u16(b, pos + 9);
  const out: Component[] = [];
  for (let i = 0; i < count; i++) {
    if (p + 2 > b.length) {
      diags.push({ file, message: `${who}: group truncated after ${out.length} of ${count} components` });
      break;
    }
    const header = u16(b, p);
    const kindByte = header & 0xff;
    const size = (header >> 8) + 1;
    if (size < 2) {
      diags.push({ file, message: `${who}: component ${i + 1} has no size; the rest of the group is not read` });
      break;
    }
    const kind = KINDS[kindByte] ?? 'unknown';
    const c: Component = { kindByte, kind };
    if (kind === 'unknown') diags.push({ file, message: `${who}: component kind 0x${kindByte.toString(16).padStart(2, '0')} unknown, skipped` });
    else if (kind !== 'shape' && p + 2 + 22 <= b.length) c.registryId = i32(b, p + 2 + 18);
    out.push(c);
    p += 2 + size;
  }
  return out;
}
