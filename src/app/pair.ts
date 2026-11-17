// Pairing a device by a code (milestone 84). A device whose collection
// already syncs shows a QR code; a new device scans it (an iPhone or an iPad,
// `scan.ts`) or is given its text (a Mac), and has what it would otherwise
// have been typed: the remote and its token, or the storage's kind and
// fields, and the collection's name.
//
// The code is a line of text, `ilmi-pair:` and then a JSON object in
// base64url: `{ v: 1, kind, name, … }` with the fields its kind needs and
// nothing else. `kind` is `git` (`url`, `token`, and `nudge` when it is not
// the usual server) or a storage's kind with that storage's fields. Dropbox
// and Google Drive carry the app's own key or client and the folder, never a
// sign-in: each device signs in for itself. What a device keeps of the files
// is its own choice and is not in the code.
//
// The code holds the token or the secret, so it is made when the panel that
// shows it opens and is held nowhere else: not in the store, not in the
// webview's storage, not in a log. Nothing here logs, and no error here
// repeats what it was given.

import qrcode from 'qrcode-generator';
import { NUDGE_SERVER } from './nudge.js';
import { vaultName } from './recents.js';
import { joinCollection, setStorage } from './crdt.js';
import { NO_STORAGE, signsIn, storageOf, type StorageKind, type StorageSettings } from './storage.js';
import { cloneCollection, saveSettings, setNudgeServer, setRemote, settingsOf } from './sync.js';

export const PAIR_PREFIX = 'ilmi-pair:';
export const PAIR_VERSION = 1;
/** A code longer than this is not read: a QR code holds under three thousand bytes, and nothing asks for more. */
export const PAIR_MAX = 4096;

/** The fields a storage's kind carries, in the settings' own names. */
const STORAGE_FIELDS = {
  folder: ['folder'],
  s3: ['endpoint', 'bucket', 'key', 'secret'],
  webdav: ['address', 'user', 'password'],
  dropbox: ['appKey', 'place'],
  drive: ['clientId', 'clientSecret', 'place'],
  icloud: ['place'],
} as const satisfies Record<StorageKind, readonly (keyof StorageSettings)[]>;
/** Those of them that may be empty: a WebDAV folder open to anyone on its network. */
const MAY_BE_EMPTY: readonly string[] = ['user', 'password'];

export interface GitPairing {
  kind: 'git';
  /** The collection's name on the device that made the code: the new one is named for it. */
  name: string;
  url: string;
  token: string;
  /** The nudge's server. */
  nudge: string;
}
export interface StoragePairing {
  kind: StorageKind;
  name: string;
  /** That kind's fields, as the settings name them. */
  fields: Record<string, string>;
}
export type Pairing = GitPairing | StoragePairing;

export const NOT_A_CODE = 'not an ilmi pairing code';
export const NEWER_CODE = 'this code was made by a newer ilmi · update ilmi on this device';
export const BROKEN_CODE = 'the pairing code is incomplete · make a new one';

const b64url = (bytes: Uint8Array): string => {
  let s = '';
  for (const b of bytes) s += String.fromCharCode(b);
  return btoa(s).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
};
const unb64url = (text: string): Uint8Array | null => {
  if (!/^[A-Za-z0-9_-]+$/.test(text)) return null;
  try {
    const s = atob(text.replace(/-/g, '+').replace(/_/g, '/') + '='.repeat((4 - (text.length % 4)) % 4));
    return Uint8Array.from(s, (c) => c.charCodeAt(0));
  } catch {
    return null;
  }
};

/** The code's text for `p`. */
export function encodePairing(p: Pairing): string {
  const o: Record<string, unknown> = { v: PAIR_VERSION, kind: p.kind, name: p.name };
  if (p.kind === 'git') {
    const g = p as GitPairing;
    o.url = g.url;
    o.token = g.token;
    if (g.nudge !== NUDGE_SERVER) o.nudge = g.nudge;
  } else {
    for (const f of STORAGE_FIELDS[p.kind]) o[f] = (p as StoragePairing).fields[f] ?? '';
  }
  return PAIR_PREFIX + b64url(new TextEncoder().encode(JSON.stringify(o)));
}

/**
 * What a code's text says, or why it is not one: `NOT_A_CODE` for anything
 * that is not ilmi's, `NEWER_CODE` for a version this build does not know,
 * `BROKEN_CODE` for one of ilmi's with a field missing. The error never
 * holds the text it was given: it may be shown, and a notice is logged.
 */
export function decodePairing(text: string): Pairing {
  const t = typeof text === 'string' ? text.trim() : '';
  if (!t.startsWith(PAIR_PREFIX) || t.length > PAIR_MAX) throw new Error(NOT_A_CODE);
  const bytes = unb64url(t.slice(PAIR_PREFIX.length));
  if (!bytes) throw new Error(NOT_A_CODE);
  let o: Record<string, unknown>;
  try {
    const parsed: unknown = JSON.parse(new TextDecoder('utf-8', { fatal: true }).decode(bytes));
    if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) throw new Error('shape');
    o = parsed as Record<string, unknown>;
  } catch {
    throw new Error(NOT_A_CODE);
  }
  if (typeof o.v !== 'number' || !Number.isInteger(o.v) || o.v < 1) throw new Error(NOT_A_CODE);
  if (o.v > PAIR_VERSION) throw new Error(NEWER_CODE);
  const text1 = (k: string, empty = false): string => {
    const v = o[k];
    if (typeof v !== 'string' || (!empty && v.trim() === '')) throw new Error(BROKEN_CODE);
    return v;
  };
  const name = typeof o.name === 'string' && o.name.trim() !== '' ? o.name.trim() : 'collection';
  if (o.kind === 'git') {
    const nudge = o.nudge === undefined ? NUDGE_SERVER : text1('nudge', true);
    return { kind: 'git', name, url: text1('url').trim(), token: text1('token', true), nudge };
  }
  if (typeof o.kind !== 'string' || !Object.hasOwn(STORAGE_FIELDS, o.kind)) throw new Error(o.kind === undefined ? BROKEN_CODE : NOT_A_CODE);
  const kind = o.kind as StorageKind;
  const fields: Record<string, string> = {};
  for (const f of STORAGE_FIELDS[kind]) fields[f] = text1(f, MAY_BE_EMPTY.includes(f));
  return { kind, name, fields };
}

/** Whether `text` looks like a code at all: what a field that takes either a code or something typed asks. */
export const looksLikePairing = (text: string): boolean => text.trim().startsWith(PAIR_PREFIX);

/** What a new device needs to join the collection at `root` as it syncs now: through its storage, else by its remote; null when it does neither. */
export function pairingOf(root: string, syncs: { git: boolean }): Pairing | null {
  const name = vaultName(root);
  const st = storageOf(root);
  if (st.on) {
    const fields: Record<string, string> = {};
    for (const f of STORAGE_FIELDS[st.kind]) fields[f] = String(st[f] ?? '').trim();
    return { kind: st.kind, name, fields };
  }
  const s = settingsOf(root);
  if (syncs.git && s.url.trim()) return { kind: 'git', name, url: s.url.trim(), token: s.token, nudge: s.server };
  return null;
}

/** A storage pairing as settings, to join with or to fill the settings' rows: not yet on, not signed in to. */
export function storageOfPairing(p: StoragePairing): StorageSettings {
  const s: StorageSettings = { ...NO_STORAGE, kind: p.kind };
  for (const f of STORAGE_FIELDS[p.kind]) s[f] = p.fields[f] ?? '';
  return s;
}

/** A code as squares: `size` a side, `dark(row, col)`. Medium error correction, the smallest code that holds the text. */
export interface QrMatrix {
  size: number;
  dark(row: number, col: number): boolean;
}

export function qrMatrix(text: string): QrMatrix {
  const qr = qrcode(0, 'M');
  qr.addData(text, 'Byte');
  qr.make();
  return { size: qr.getModuleCount(), dark: (r, c) => qr.isDark(r, c) };
}

/** The quiet margin a QR code is read with, in squares. */
export const QR_QUIET = 4;

/** The dark squares as one SVG path in a box of `size + 2 × QR_QUIET` a side: each a unit square, a row's run drawn as one. */
export function qrPath(m: QrMatrix): string {
  let d = '';
  for (let r = 0; r < m.size; r++) {
    for (let c = 0; c < m.size; c++) {
      if (!m.dark(r, c)) continue;
      let run = 1;
      while (c + run < m.size && m.dark(r, c + run)) run++;
      d += `M${c + QR_QUIET} ${r + QR_QUIET}h${run}v1h-${run}z`;
      c += run - 1;
    }
  }
  return d;
}

/** A folder is a place on the device that made the code: a phone or an iPad cannot reach it (a dev run's simulator reads the Mac's disk, and can). */
export const FOLDER_ELSEWHERE = 'this code is for a folder on the other device, which this one cannot reach';
const reachable = (p: Pairing, mobile: boolean): void => {
  if (p.kind === 'folder' && mobile && !import.meta.env.DEV) throw new Error(FOLDER_ELSEWHERE);
};

/** Whether the code's storage still wants a sign-in on this device before it can be joined: Dropbox and Google Drive. */
export const needsSignIn = (p: Pairing): p is StoragePairing => p.kind !== 'git' && signsIn(p.kind);

/**
 * A new device's side, from its welcome: the collection the code names made
 * here from the remote or the storage, exactly as `connect` and `join` make
 * one from typed fields, its settings kept with it. Resolves to its root, to
 * open; it syncs once open. Not for a storage that is signed in to
 * (`needsSignIn`): its fields are filled and the sign-in is the user's.
 */
export async function joinFromPairing(p: Pairing, mobile: boolean): Promise<string> {
  reachable(p, mobile);
  if (p.kind === 'git') {
    const g = p as GitPairing;
    const dest = await cloneCollection(g.url, g.token, g.name);
    if (g.nudge !== NUDGE_SERVER) saveSettings(dest, { ...settingsOf(dest), server: g.nudge });
    return dest;
  }
  return joinCollection(storageOfPairing(p as StoragePairing), p.name);
}

/**
 * In the settings of an open collection that does not sync yet: the code's
 * fields put in the rows as if typed (the remote, token and nudge, or the
 * storage's kind and fields), nothing connected. What to say: which button
 * is next.
 */
export async function fillFromPairing(p: Pairing, mobile: boolean): Promise<string> {
  reachable(p, mobile);
  if (p.kind === 'git') {
    const g = p as GitPairing;
    await setRemote(g.url, g.token);
    setNudgeServer(g.nudge);
    return mobile ? 'code read · press connect' : 'code read · connect, or clone… for a new collection';
  }
  // the kind and that kind's fields alone: what the device keeps, and a sign-in it has, stay as they are
  const part: Partial<StorageSettings> = { kind: p.kind };
  for (const f of STORAGE_FIELDS[p.kind]) part[f] = (p as StoragePairing).fields[f] ?? '';
  setStorage(part);
  return needsSignIn(p) ? 'code read · sign in, then connect or join…' : 'code read · connect, or join… for a new collection';
}
