// `Store` in memory, for tests and tools: the same rules as
// `src-tauri/src/store.rs` (a `rev` that moves on a content write and not
// on a move, sizes in bytes, a delete taking what is under it, blobs by
// their SHA-256, a document's schedules, index and original written with
// its text). Not imported by the app.

import { createHash } from 'node:crypto';
import type { Doc } from '../format/index.js';
import type { Original } from './lift.js';
import { STORE_VERSION, type Content, type DocContent, type Lift, type Place, type ReviewRow, type Row, type Sched, type Store } from './store.js';

type Call = 'rows' | 'text' | 'doc' | 'put' | 'remove' | 'places' | 'digests' | 'reviews' | 'reviewsPut' | 'blobPut' | 'blobGet';

export interface MemStore extends Store {
  /** How many times each call was made: a test can say nothing was read twice. */
  readonly calls: Record<Call, number>;
  /** The blobs held, by hash. */
  readonly blobs: Map<string, Uint8Array>;
  /** What the tables hold, for a test to look at: a document's text as stored, its schedules, its digest; the log; the transactions that wrote text. */
  readonly tables: {
    texts: Map<string, { front: string; text: string }>;
    state: Map<string, Sched[]>;
    digests: Map<string, string>;
    originals: Map<string, Original>;
    reviews: ReviewRow[];
    /** How many times a row's text was written with different text. */
    textWrites: number;
  };
}

/** A collection in memory; `version` is the schema it claims to have been written by (a test of the upgrade starts below the present one). */
export function memStore(version = STORE_VERSION): MemStore {
  const rows = new Map<string, Row>();
  const texts = new Map<string, { front: string; text: string }>();
  const state = new Map<string, Sched[]>();
  const digests = new Map<string, string>();
  const originals = new Map<string, Original>();
  const reviews: ReviewRow[] = [];
  let same: string[] = [];
  const blobs = new Map<string, Uint8Array>();
  const calls: Record<Call, number> = { rows: 0, text: 0, doc: 0, put: 0, remove: 0, places: 0, digests: 0, reviews: 0, reviewsPut: 0, blobPut: 0, blobGet: 0 };
  const tables = { texts, state, digests, originals, reviews, textWrites: 0 };
  let rev = 0;
  let schema = version;
  const bytes = (s: string): number => Buffer.byteLength(s, 'utf8');
  const forget = (id: string): void => {
    state.delete(id);
    digests.delete(id);
    originals.delete(id);
  };
  const removeOne = (id: string): void => {
    for (const r of [...rows.values()]) if (r.parent === id) removeOne(r.id);
    rows.delete(id);
    texts.delete(id);
    forget(id);
  };
  return {
    calls,
    blobs,
    tables,
    async version() { return schema; },
    async setVersion(n) { schema = n; },
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
    async doc(id): Promise<DocContent> {
      calls.doc++;
      if (!rows.has(id)) throw new Error(`${id}: no such row`);
      const t = texts.get(id) ?? { front: '', text: '' };
      return { front: t.front, text: t.text, state: (state.get(id) ?? []).map((s) => ({ ...s })), original: originals.get(id) ?? null };
    },
    async put(at: Place, content?: Content, lift?: Lift) {
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
          const was = texts.get(at.id);
          if (!was || was.front !== t.front || was.text !== t.text) {
            texts.set(at.id, t);
            tables.textWrites++;
          }
          row.size = lift ? lift.size : bytes(t.front) + bytes(t.text);
        }
        row.blob = blob;
        row.rev = ++rev;
        forget(at.id);
        if (lift) {
          if (lift.state.length) state.set(at.id, lift.state.map((s) => ({ ...s })));
          digests.set(at.id, lift.digest);
          if (lift.original) originals.set(at.id, { ...lift.original });
          for (const r of lift.reviews ?? []) reviews.push({ ...r });
        }
      }
      rows.set(at.id, row);
      return { ...row };
    },
    async remove(ids) {
      calls.remove++;
      for (const id of ids) removeOne(id);
    },
    async places(set) {
      calls.places++;
      const want = new Map(set);
      for (const r of rows.values()) r.place = want.get(r.id) ?? null;
    },
    async digests(after, limit) {
      calls.digests++;
      return [...digests.keys()].sort().filter((id) => after === null || id > after).slice(0, limit).map((id): [string, Doc] => [id, JSON.parse(digests.get(id)!) as Doc]);
    },
    async reviewFiles() {
      const n = new Map<string, number>();
      for (const r of reviews) n.set(r.file, (n.get(r.file) ?? 0) + 1);
      return [...n];
    },
    async reviews(file) {
      calls.reviews++;
      return reviews.filter((r) => file === null || r.file === file).map((r) => r.line);
    },
    async reviewsPut(file, list, replace) {
      calls.reviewsPut++;
      if (replace) for (let i = reviews.length - 1; i >= 0; i--) if (reviews[i]!.file === file) reviews.splice(i, 1);
      for (const r of list) reviews.push({ ...r, file });
    },
    async same() { return [...same]; },
    async samePut(pairs) { same = [...new Set(pairs)]; },
    async originals() {
      return [...originals].filter(([k]) => !rows.has(k)).map(([k, o]): [string, Original] => [k, { ...o }]);
    },
    async originalPut(k, original) {
      if (original) originals.set(k, { ...original });
      else originals.delete(k);
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
