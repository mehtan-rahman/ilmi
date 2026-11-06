// The storages a collection can sync through (milestone 63), and which one
// the open collection uses: a folder (a disk, a NAS, a folder another
// program syncs), an S3-compatible bucket (Cloudflare R2, MinIO, AWS), a
// WebDAV folder (Nextcloud, a Synology). `src/sync/storage.ts` says what a
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

import { invoke } from '@tauri-apps/api/core';
import { folderStorage, type Storage } from '../sync/index.js';
import { diskFs } from './collections.js';
import { vaultKey } from './platform.js';
import { useApp } from './store.js';

export type StorageKind = 'folder' | 's3' | 'webdav';
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
  /** What this device keeps of the PDFs and images: every one, or the ones it has opened. Null until it is chosen: every one on a desk, the opened on a phone or an iPad. */
  keep: Keep | null;
}

export const NO_STORAGE: StorageSettings = { on: false, kind: 'folder', folder: '', endpoint: '', bucket: '', key: '', secret: '', address: '', user: '', password: '', keep: null };

const KEY = 'ilmi.storage';
const TEXTS = ['folder', 'endpoint', 'bucket', 'key', 'secret', 'address', 'user', 'password'] as const;

function loadAll(): Record<string, StorageSettings> {
  try {
    const raw = globalThis.localStorage?.getItem(KEY);
    const o: unknown = raw ? JSON.parse(raw) : {};
    const out: Record<string, StorageSettings> = {};
    if (!o || typeof o !== 'object') return out;
    for (const [k, v] of Object.entries(o as Record<string, Partial<StorageSettings> | null>)) {
      if (!v || typeof v !== 'object') continue;
      const s: StorageSettings = { ...NO_STORAGE, on: v.on === true, kind: v.kind === 's3' || v.kind === 'webdav' ? v.kind : 'folder', keep: v.keep === 'all' || v.keep === 'opened' ? v.keep : null };
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

/** Whether the fields its kind needs are filled. */
export function storageReady(s: StorageSettings): boolean {
  if (s.kind === 'folder') return s.folder.trim() !== '';
  if (s.kind === 's3') return [s.endpoint, s.bucket, s.key, s.secret].every((v) => v.trim() !== '');
  return s.address.trim() !== '';
}

/** A name for the collection a storage holds, when one is made from it: the folder's, the bucket's (its prefix's), the address's last part. */
export function storageName(s: StorageSettings): string {
  const last = (v: string): string => v.trim().replace(/\/+$/, '').split('/').pop() ?? '';
  const name = s.kind === 'folder' ? last(s.folder) : s.kind === 's3' ? last(s.bucket) : decodeURIComponent(last(s.address.replace(/^[a-z]+:\/\//i, '')));
  return name || 'collection';
}

/** What the Rust side is told of a storage: its kind and that kind's fields, trimmed. */
function configOf(s: StorageSettings): Record<string, string> {
  if (s.kind === 'folder') return { kind: 'folder', folder: s.folder.trim().replace(/\/+$/, '') };
  if (s.kind === 's3') return { kind: 's3', endpoint: s.endpoint.trim(), bucket: s.bucket.trim(), key: s.key.trim(), secret: s.secret.trim() };
  return { kind: 'webdav', address: s.address.trim(), user: s.user.trim(), password: s.password };
}

/**
 * The storage `s` names, for the collection whose folder is `root`: its
 * four verbs, and the two by which that collection's files go up and come
 * down without passing through here.
 */
export async function storageFor(s: StorageSettings, root: string): Promise<Storage> {
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

/** Dev only: the loopback servers shaped like a bucket and a WebDAV folder (`src-tauri/src/devstore.rs`), as settings that reach them. */
export async function devStorages(): Promise<{ s3: StorageSettings; webdav: StorageSettings }> {
  const got = await invoke<{ s3: Partial<StorageSettings>; webdav: Partial<StorageSettings> }>('dev_storage_serve');
  return { s3: { ...NO_STORAGE, ...got.s3, on: true }, webdav: { ...NO_STORAGE, ...got.webdav, on: true } };
}
