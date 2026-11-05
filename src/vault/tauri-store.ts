// `Store` over the Rust side's SQLite (`src-tauri/src/store.rs`), for the
// app, and the collections under the app's data directory. A collection is
// named by its folder there; that path is the vault's root, and nothing
// under it is read through the file system.

import { invoke } from '@tauri-apps/api/core';
import type { Row, Store } from './store.js';

export function tauriStore(root: string): Store {
  return {
    rows: () => invoke<Row[]>('store_rows', { root }),
    text: (id) => invoke<string>('store_text', { root, id }),
    put: (at, content) => invoke<Row>('store_put', { root, at, content: content ?? null }),
    remove: (ids) => invoke<void>('store_remove', { root, ids }),
    // the bytes go raw as the request's body; a header is ASCII, so the collection's path is percent-encoded
    blobPut: (bytes) => invoke<{ hash: string; size: number }>('store_blob_put', bytes, { headers: { root: encodeURIComponent(root) } }),
    blobGet: async (hash) => new Uint8Array(await invoke<ArrayBuffer>('store_blob_get', { root, hash })),
  };
}

/** Where the collections live, and the ones there, by name. */
export const listCollections = (): Promise<{ home: string; names: string[] }> => invoke('store_list');

/** A new, empty collection; resolves to its folder, the root to open. Rejects with `already there` when the name is taken. */
export const createCollection = (name: string): Promise<string> => invoke<string>('store_create', { name });

/** A collection closed and deleted with everything in it. */
export const deleteCollection = (root: string): Promise<void> => invoke<void>('store_delete', { root });
