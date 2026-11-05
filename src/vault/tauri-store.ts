// `Store` over the Rust side's SQLite (`src-tauri/src/store.rs`), for the
// app, and the collections under the app's data directory. A collection is
// named by its folder there; that path is the vault's root, and nothing
// under it is read through the file system.

import { invoke } from '@tauri-apps/api/core';
import type { Doc } from '../format/index.js';
import type { Original } from './lift.js';
import type { DocContent, Row, Store } from './store.js';

export function tauriStore(root: string): Store {
  return {
    version: () => invoke<number>('store_version', { root }),
    setVersion: (version) => invoke<void>('store_set_version', { root, version }),
    rows: () => invoke<Row[]>('store_rows', { root }),
    text: (id) => invoke<string>('store_text', { root, id }),
    doc: (id) => invoke<DocContent>('store_doc', { root, id }),
    put: (at, content, lift) => invoke<Row>('store_put', { root, at, content: content ?? null, lift: lift ?? null }),
    remove: (ids) => invoke<void>('store_remove', { root, ids }),
    places: (set) => invoke<void>('store_places', { root, set }),
    digests: (after, limit) => invoke<[string, Doc][]>('store_digests', { root, after, limit }),
    reviewFiles: () => invoke<[string, number][]>('store_review_files', { root }),
    reviews: (file) => invoke<string[]>('store_reviews', { root, file }),
    reviewsPut: (file, rows, replace) => invoke<void>('store_reviews_put', { root, file, rows, replace }),
    same: () => invoke<string[]>('store_same', { root }),
    samePut: (pairs) => invoke<void>('store_same_put', { root, pairs }),
    originals: () => invoke<[string, Original][]>('store_originals', { root }),
    originalPut: (key, original) => invoke<void>('store_original_put', { root, key, original }),
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
