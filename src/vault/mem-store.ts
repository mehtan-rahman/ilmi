// `Store` in memory, for tests and tools: the same rules as
// `src-tauri/src/store.rs` (a `rev` that moves on a content write and not
// on a move, sizes in bytes, a delete taking what is under it, blobs by
// their SHA-256). Not imported by the app.

import { createHash } from 'node:crypto';
import type { Content, Place, Row, Store } from './store.js';

export interface MemStore extends Store {
  /** How many times each call was made: a test can say nothing was read twice. */
  readonly calls: Record<'rows' | 'text' | 'put' | 'remove' | 'blobPut' | 'blobGet', number>;
  /** The blobs held, by hash. */
  readonly blobs: Map<string, Uint8Array>;
}

export function memStore(): MemStore {
  const rows = new Map<string, Row>();
  const texts = new Map<string, { front: string; text: string }>();
  const blobs = new Map<string, Uint8Array>();
  const calls = { rows: 0, text: 0, put: 0, remove: 0, blobPut: 0, blobGet: 0 };
  let rev = 0;
  const bytes = (s: string): number => Buffer.byteLength(s, 'utf8');
  const removeOne = (id: string): void => {
    for (const r of [...rows.values()]) if (r.parent === id) removeOne(r.id);
    rows.delete(id);
    texts.delete(id);
  };
  return {
    calls,
    blobs,
    async rows() {
      calls.rows++;
      return [...rows.values()].map((r) => ({ ...r }));
    },
    async text(id) {
      calls.text++;
      if (!rows.has(id)) throw new Error(`${id}: no such row`);
      const t = texts.get(id);
      return t ? t.front + t.text : '';
    },
    async put(at: Place, content?: Content) {
      calls.put++;
      if (at.parent !== null && !rows.has(at.parent)) throw new Error(`${at.parent}: no such row`);
      const old = rows.get(at.id);
      const row: Row = old
        ? { ...old, parent: at.parent, name: at.name, place: at.place, kind: at.kind }
        : { id: at.id, parent: at.parent, name: at.name, place: at.place, kind: at.kind, size: 0, rev: ++rev, blob: null };
      if (content) {
        const blob = content.blob ?? null;
        if (blob !== null) {
          const b = blobs.get(blob);
          if (!b) throw new Error(`${blob}: no such blob`);
          texts.delete(at.id);
          row.size = b.length;
        } else {
          const t = { front: content.front ?? '', text: content.text ?? '' };
          texts.set(at.id, t);
          row.size = bytes(t.front) + bytes(t.text);
        }
        row.blob = blob;
        row.rev = ++rev;
      }
      rows.set(at.id, row);
      return { ...row };
    },
    async remove(ids) {
      calls.remove++;
      for (const id of ids) removeOne(id);
    },
    async blobPut(data) {
      calls.blobPut++;
      const hash = createHash('sha256').update(data).digest('hex');
      if (!blobs.has(hash)) blobs.set(hash, new Uint8Array(data));
      return { hash, size: data.length };
    },
    async blobGet(hash) {
      calls.blobGet++;
      const b = blobs.get(hash);
      if (!b) throw new Error(`${hash}: no such blob`);
      return new Uint8Array(b);
    },
  };
}
