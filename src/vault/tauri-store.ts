// `Store` over the Rust side's SQLite (`src-tauri/src/store.rs`), for the
// app, and the collections under the app's data directory. A collection is
// named by its folder there; that path is the vault's root, and nothing
// under it is read through the file system.

import { invoke } from '@tauri-apps/api/core';
import type { Doc } from '../format/index.js';
import type { Original } from './lift.js';
import type { DocContent, InkStroke, Reg, Row, SearchHit, Store } from './store.js';

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
    search: (phrase, words, limit) => invoke<SearchHit[]>('store_search', { root, phrase, words, limit }),
    searchState: () => invoke<{ done: boolean; after: string | null }>('store_search_state', { root }),
    searchWalk: (after, limit) => invoke<[string, string][]>('store_search_walk', { root, after, limit }),
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
    blobHas: (hash) => invoke<boolean>('store_blob_has', { root, hash }),
    blobsAway: () => invoke<[string, number][]>('store_blobs_away', { root }),
    ink: (page) => invoke<InkStroke[]>('store_ink', { root, page }),
    inkFile: async (page, what) => new Uint8Array(await invoke<ArrayBuffer>('store_ink_file', { root, page, what })),
    inkSplit: (drawing) => invoke<InkStroke[]>('ink_split', { drawing: btoa(Array.from(drawing, (b) => String.fromCharCode(b)).join('')) }),
    inkPages: (prefix) => invoke<string[]>('store_ink_pages', { root, prefix }),
    inkPage: async (page, what, w, h) => new Uint8Array(await invoke<ArrayBuffer>('store_ink_page', { root, page, what, w, h })),
    blobTake: (path) => invoke<{ hash: string; size: number }>('store_blob_take', { root, path }),
    blobRange: async (hash, begin, end) => new Uint8Array(await invoke<ArrayBuffer>('store_blob_range', { root, hash, begin, end })),
    batch: (ops) => invoke<Row[]>('store_batch', { root, ops }),
    meta: () => invoke<[string, string][]>('store_meta', { root }),
    regs: (keys) => invoke<Reg[]>('store_regs', { root, keys }),
    regsUnder: (prefixes) => invoke<Reg[]>('store_regs_under', { root, prefixes }),
    regsPage: (after, limit) => invoke<Reg[]>('store_regs_page', { root, after, limit }),
    crdt: (doc) => invoke<string | null>('store_crdt', { root, doc }),
    outbox: (after, bytes) => invoke<[number, string][]>('store_outbox', { root, after, bytes }),
    outboxCount: () => invoke<number>('store_outbox_count', { root }),
  };
}

/** Where the collections live, and the ones there, by name. */
export const listCollections = (): Promise<{ home: string; names: string[] }> => invoke('store_list');

/** A new, empty collection; resolves to its folder, the root to open. Rejects with `already there` when the name is taken. */
export const createCollection = (name: string): Promise<string> => invoke<string>('store_create', { name });

/** A collection closed and deleted with everything in it. */
export const deleteCollection = (root: string): Promise<void> => invoke<void>('store_delete', { root });
