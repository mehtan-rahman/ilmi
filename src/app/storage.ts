// The storages a collection can sync through (milestone 63), and which one
// the open collection uses: a folder (a disk, a NAS, a folder another
// program syncs), an S3-compatible bucket (Cloudflare R2, MinIO, AWS), a
// WebDAV folder (Nextcloud, a Synology), Dropbox, Google Drive (milestone
// 64: signed in to, not typed). `src/sync/storage.ts` says what a
// storage is and `src/sync/engine.ts` what goes through it; this is the
// app's side: the settings, kept with the tweaks in the webview's storage
// as sync's remote and token are (per collection, per device), and the
// `Storage` each makes.
//
// The small files cross to the engine here. A folder's go through the fs
// plugin as an import's do; a bucket's and a WebDAV folder's are fetched
// and sent by the Rust side (`src-tauri/src/storage.rs`), which signs for
// S3. A PDF or an image goes between the collection's `blobs/` and the
// storage on the Rust side, a piece at a time, whatever the kind: it never
// passes through the web view.
//
// A service's tokens are not here: `account` names a sign-in the Rust side
// keeps (`src-tauri/src/oauth.rs`), and no token reaches the web view. What
// is here, in the clear with the other settings: the app key, Google's
// client id and its client secret, which Google says of a desktop client is
// not a secret.

import { invoke } from '@tauri-apps/api/core';
import { folderStorage, type Storage } from '../sync/index.js';
import { diskFs } from './collections.js';
import { vaultKey } from './platform.js';
import { useApp } from './store.js';

export type StorageKind = 'folder' | 's3' | 'webdav' | 'dropbox' | 'drive' | 'icloud';
export type Keep = 'all' | 'opened';

export interface StorageSettings {
  /** The collection syncs through the storage these name. */
  on: boolean;
  kind: StorageKind;
  folder: string;
  endpoint: string;
  /** The bucket, and after a `/` a prefix inside it. */
  bucket: string;
  key: string;
  secret: string;
  /** The WebDAV folder's own address. */
  address: string;
  user: string;
  password: string;
  /** Dropbox's: the app's key. */
  appKey: string;
  /** Google's: the OAuth client. */
  clientId: string;
  clientSecret: string;
  /** Dropbox's and Google Drive's: the collection's folder, in the app's own. */
  place: string;
  /** Which sign-in; empty until there is one. */
  account: string;
  /** Dev only: the loopback server a sign-in goes to in place of the service. A release takes no notice. */
  dev: string;
  /** What this device keeps of the PDFs and images: every one, or the ones it has opened. Null until it is chosen: every one on a desk, the opened on a phone or an iPad. */
  keep: Keep | null;
}

export const NO_STORAGE: StorageSettings = { on: false, kind: 'folder', folder: '', endpoint: '', bucket: '', key: '', secret: '', address: '', user: '', password: '', appKey: '', clientId: '', clientSecret: '', place: '', account: '', dev: '', keep: null };

const KEY = 'ilmi.storage';
const TEXTS = ['folder', 'endpoint', 'bucket', 'key', 'secret', 'address', 'user', 'password', 'appKey', 'clientId', 'clientSecret', 'place', 'account', 'dev'] as const;
export const KINDS: readonly StorageKind[] = ['folder', 's3', 'webdav', 'dropbox', 'drive', 'icloud'];
/** A kind's word where it is not its name. */
export const KIND_WORD: Partial<Record<StorageKind, string>> = { drive: 'google drive', icloud: 'icloud drive' };

let icloudAt: Promise<string | null> | null = null;
/** The app's iCloud folder (milestone 65): null where the app has no iCloud container, which is everywhere until it is signed with one. */
export const icloudFolder = (): Promise<string | null> => (icloudAt ??= invoke<string | null>('icloud_folder').catch(() => null));

/** The kinds to offer: no folder to pick on an iPad or a phone, and iCloud only where the app has it. */
export const kindsHere = (mobile: boolean, icloud: boolean): StorageKind[] => KINDS.filter((k) => !(mobile && k === 'folder') && (icloud || k !== 'icloud'));

function loadAll(): Record<string, StorageSettings> {
  try {
    const raw = globalThis.localStorage?.getItem(KEY);
    const o: unknown = raw ? JSON.parse(raw) : {};
    const out: Record<string, StorageSettings> = {};
    if (!o || typeof o !== 'object') return out;
    for (const [k, v] of Object.entries(o as Record<string, Partial<StorageSettings> | null>)) {
      if (!v || typeof v !== 'object') continue;
      const s: StorageSettings = { ...NO_STORAGE, on: v.on === true, kind: KINDS.includes(v.kind as StorageKind) ? (v.kind as StorageKind) : 'folder', keep: v.keep === 'all' || v.keep === 'opened' ? v.keep : null };
      for (const f of TEXTS) if (typeof v[f] === 'string') s[f] = v[f];
      out[k] = s;
    }
    return out;
  } catch {
    return {};
  }
}

/** The settings of the collection at `root`; none set, a folder not yet chosen. */
export function storageOf(root: string): StorageSettings {
  return loadAll()[vaultKey(root)] ?? { ...NO_STORAGE };
}

/** Remember them (the open collection's reach the store). */
export function saveStorage(root: string, s: StorageSettings): void {
  const all = loadAll();
  all[vaultKey(root)] = s;
  try { globalThis.localStorage?.setItem(KEY, JSON.stringify(all)); } catch { /* the session keeps them */ }
  if (useApp.getState().vault === root) useApp.setState({ storage: s });
}

/** A collection made anew under a name has no storage, whatever one of that name had before it. */
export function forgetStorage(root: string): void {
  const all = loadAll();
  if (!(vaultKey(root) in all)) return;
  delete all[vaultKey(root)];
  try { globalThis.localStorage?.setItem(KEY, JSON.stringify(all)); } catch { /* the session keeps them */ }
}

/** What a device keeps when it was never said: every file on a desk, the opened ones on a phone or an iPad. */
export const keepOf = (s: StorageSettings): Keep => s.keep ?? (useApp.getState().mobile ? 'opened' : 'all');

/** Whether a kind is signed in to, not typed. */
export const signsIn = (k: StorageKind): k is 'dropbox' | 'drive' => k === 'dropbox' || k === 'drive';

/** The client a sign-in is for. */
export const clientOf = (s: StorageSettings): string => (s.kind === 'dropbox' ? s.appKey : s.clientId).trim();

/** Whether the fields its kind needs are filled, and it is signed in to if it is that kind. */
export function storageReady(s: StorageSettings): boolean {
  if (s.kind === 'folder') return s.folder.trim() !== '';
  if (s.kind === 's3') return [s.endpoint, s.bucket, s.key, s.secret].every((v) => v.trim() !== '');
  if (signsIn(s.kind)) return s.account !== '' && s.place.trim() !== '';
  if (s.kind === 'icloud') return s.place.trim() !== '';
  return s.address.trim() !== '';
}

/** A name for the collection a storage holds, when one is made from it: the folder's, the bucket's (its prefix's), the address's last part, the service's folder. */
export function storageName(s: StorageSettings): string {
  const last = (v: string): string => v.trim().replace(/\/+$/, '').split('/').pop() ?? '';
  const name = s.kind === 'folder' ? last(s.folder) : s.kind === 's3' ? last(s.bucket) : signsIn(s.kind) || s.kind === 'icloud' ? last(s.place) : decodeURIComponent(last(s.address.replace(/^[a-z]+:\/\//i, '')));
  return name || 'collection';
}

/** What the Rust side is told of a storage: its kind and that kind's fields, trimmed. */
export function configOf(s: StorageSettings): Record<string, string> {
  if (s.kind === 'folder') return { kind: 'folder', folder: s.folder.trim().replace(/\/+$/, '') };
  if (s.kind === 's3') return { kind: 's3', endpoint: s.endpoint.trim(), bucket: s.bucket.trim(), key: s.key.trim(), secret: s.secret.trim() };
  if (signsIn(s.kind)) return { kind: s.kind, account: s.account, folder: s.place.trim().replace(/^\/+|\/+$/g, '') };
  return { kind: 'webdav', address: s.address.trim(), user: s.user.trim(), password: s.password };
}

/**
 * Sign in to the service `s` names, in the system browser; the sign-in's
 * name, to keep in the settings. It comes back to the loopback on a desk and
 * by a link on a device, or by a link when `link` says so (the smoke).
 */
export function signIn(s: StorageSettings, link = useApp.getState().mobile): Promise<string> {
  return invoke<string>('oauth_sign_in', { request: { service: s.kind, client: clientOf(s), secret: s.kind === 'drive' ? s.clientSecret.trim() : '', account: s.account || null, link, dev: s.dev || null } });
}

/** Forget the tokens of the sign-in `s` names. Nothing is said to the service; it is let go there from its own account page. */
export const signOut = (s: StorageSettings): Promise<void> => invoke<void>('oauth_sign_out', { account: s.account });

/**
 * The storage `s` names, for the collection whose folder is `root`: its
 * four verbs, and the two by which that collection's files go up and come
 * down without passing through here.
 */
export async function storageFor(s: StorageSettings, root: string): Promise<Storage> {
  if (s.kind === 'icloud') {
    const base = await icloudFolder();
    if (!base) throw new Error('icloud drive is not here');
    return icloudStorage(await storageFor({ ...s, kind: 'folder', folder: `${base}/${s.place.trim().replace(/^\/+|\/+$/g, '')}` }, root), `${base}/${s.place.trim().replace(/^\/+|\/+$/g, '')}`, (path) => invoke<boolean>('icloud_down', { path }));
  }
  const config = configOf(s);
  const files: Pick<Storage, 'up' | 'down'> = {
    up: (hash) => invoke<void>('storage_blob_up', { root, config, hash }),
    down: (hash, size) => invoke<boolean>('storage_blob_down', { root, config, hash, size }),
  };
  if (s.kind === 'folder') {
    const dir = config.folder!;
    await invoke('allow_vault', { path: dir });
    await diskFs.mkdir(dir);
    return { ...folderStorage(diskFs, dir), ...files };
  }
  // a header is ASCII: the storage and the path are percent-encoded beside the raw bytes
  const header = encodeURIComponent(JSON.stringify(config));
  return {
    list: (prefix) => invoke<string[]>('storage_list', { config, prefix }),
    read: async (path) => {
      const got = await invoke<ArrayBuffer | null>('storage_read', { config, path });
      return got === null ? null : new Uint8Array(got);
    },
    write: (path, bytes) => invoke<void>('storage_write', bytes, { headers: { config: header, path: encodeURIComponent(path) } }),
    remove: (path) => invoke<void>('storage_remove', { config, path }),
    ...files,
  };
}

/**
 * A folder iCloud keeps (milestone 65): the OS carries the files, and no
 * device overwrites another's, so nothing is a conflict copy. What is new
 * here is that a file may be named and not here: it is listed under a
 * `.name.icloud` stand-in, and is asked down before it is read.
 */
export function icloudStorage(folder: Storage, dir: string, down: (path: string) => Promise<boolean>): Storage {
  const fetched = (path: string): Promise<boolean> => down(`${dir}/${path}`);
  return {
    ...folder,
    async list(prefix) {
      const here = new Set(await folder.list(prefix));
      const entries = await diskFs.readDir(`${dir}/${prefix.replace(/\/+$/, '')}`).catch(() => []);
      for (const e of entries) {
        const away = /^\.(.+)\.icloud$/.exec(e.name);
        if (away) here.add(`${prefix.replace(/\/+$/, '')}/${away[1]}`);
      }
      return [...here].sort();
    },
    async read(path) {
      await fetched(path);
      return folder.read(path);
    },
    ...(folder.down ? { down: async (hash: string, size: number) => { await fetched(`blobs/${hash}`); return folder.down!(hash, size); } } : {}),
  };
}

/** Dev only: the loopback servers shaped like a bucket, a WebDAV folder, Dropbox and Google Drive (`src-tauri/src/devstore.rs`, `devcloud.rs`), as settings that reach them; the last two still to be signed in to. */
export async function devStorages(): Promise<Record<'s3' | 'webdav' | 'dropbox' | 'drive', StorageSettings>> {
  const got = await invoke<Record<'s3' | 'webdav' | 'dropbox' | 'drive', Partial<StorageSettings>>>('dev_storage_serve');
  const of = (p: Partial<StorageSettings>): StorageSettings => ({ ...NO_STORAGE, ...p, on: true });
  return { s3: of(got.s3), webdav: of(got.webdav), dropbox: of(got.dropbox), drive: of(got.drive) };
}
