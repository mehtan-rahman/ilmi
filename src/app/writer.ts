// The reader's writes for one document (`Reader.tsx`): one at a time, a
// little after the last change, each remembered by the text it will
// produce, so the vault's report of it can be told from an external change.
// Out of the reader so its tests (`writes.model.test.ts`) drive it as it is.

import { serialize, type Block, type Doc } from '../format/index.js';
import { blocksEqual } from '../reader/index.js';
import { rekey, type Loaded, type Vault } from '../vault/index.js';

/** How long after the last keystroke the file is written. */
export const WRITE_DELAY = 500;

/** What the person is told when what they typed gives way to someone else's change. */
export const DROPPED = 'changed elsewhere · the last edit here was not kept';

/** A body write made from a body the file no longer has: someone else's change came first and wins. */
class Superseded extends Error {}

/** Whose text a report of the file is (`Writer.how`). */
export type Heard = 'typed' | 'ours' | 'theirs';

/** Every page's writer, from its page's mount until it is closed and its last write is done. */
const writers = new Set<Writer>();

/**
 * What was typed on the pages of `path`, or of anything under it, written:
 * a delete then takes what the file holds after it, and its undo puts that back.
 */
export async function written(path: string): Promise<void> {
  await Promise.all([...writers].filter((w) => w.under(path)).map((w) => w.run(async () => {})));
}

/**
 * Writes for one document, one at a time, a little after the last change.
 * Remembers the text each write will produce, so the vault's report of it
 * can be told from an external change.
 */
export class Writer {
  private own = new Map<string, number>();
  /** The texts of `own` that a write of the editor's body made (`flush`): the rest are changes made to the file itself. */
  private typed = new Set<string>();
  /** The page's own vault operations under way (`op`): what the vault reports meanwhile is theirs. */
  private ops = 0;
  /**
   * Whose text `heard` last heard: the editor's body written and read back
   * (`typed`), a change this page made to the file itself (`ours`: a grade
   * written through, an extract taken), or someone else's (`theirs`).
   */
  how: Heard = 'theirs';
  private chain: Promise<unknown> = Promise.resolve();
  private timer: ReturnType<typeof setTimeout> | null = null;
  private pending: (() => Block[]) | null = null;
  /** The body as the file had it when the page last heard of it: what a write of the editor's body is an edit of. */
  private base: Block[] | null = null;
  /** Bumped when someone else's change is heard: a body write asked for before it gives way. */
  private epoch = 0;
  /** Bumped by the caller on every document change; each write records the value it saw. */
  version = 0;

  /** `told` hears a line when what was typed is dropped for someone else's change. */
  constructor(private readonly vault: Vault, private path: string, private readonly told: (line: string) => void = () => {}) {
    writers.add(this);
  }

  /** The page went: once what it had on its way is written, the writer is let go. */
  close(): void {
    void this.chain.then(() => writers.delete(this));
  }

  /** Whether this writer's file is `path`, or under it. */
  under(path: string): boolean {
    return rekey(this.path, path, path) !== null;
  }

  /** The page was built from `loaded`. */
  saw(loaded: Loaded): void {
    this.base = loaded.doc.blocks;
  }

  /** A rename or a move took the file from `from` to `to`: what is still to be written goes where it went. */
  follow(from: string, to: string): void {
    this.path = rekey(this.path, from, to) ?? this.path;
  }

  /** The version a write of `text` saw, if `text` is ours; the entry is consumed. */
  claim(text: string): number | undefined {
    const v = this.own.get(text);
    if (v !== undefined) this.own.delete(text);
    return v;
  }

  /**
   * The vault reports the file as `loaded`, the editor holding `shown`:
   * whether the editor is built again from it. Someone else's change wins
   * over anything unwritten; our own write read back is built only when
   * nothing was typed since and the file says something other than what
   * the editor holds (a line that became a card, a heading).
   */
  heard(loaded: Loaded, shown: () => Block[]): boolean {
    const version = this.claim(loaded.text);
    const typed = this.typed.delete(loaded.text);
    this.how = version === undefined ? (this.ops > 0 ? 'ours' : 'theirs') : typed ? 'typed' : 'ours';
    if (version === undefined) {
      if (this.pending) this.told(DROPPED);
      this.epoch++;
      this.cancel();
      return true;
    }
    return version === this.version && !blocksEqual(shown(), loaded.doc.blocks);
  }

  /** `body`: the write is the editor's body (`flush`), not a change made to the file itself. */
  update(mutate: (doc: Doc) => void, body = false): Promise<Loaded | null> {
    const version = this.version;
    const run = this.chain.then(async () => {
      try {
        const cur = await this.vault.read(this.path);
        const next = structuredClone(cur.doc);
        mutate(next);
        if (serialize(next) === cur.text) return null;
        // each text the vault may write is ours before it lands, so its report is known (a front-matter
        // change found under the write makes another); the ones it did not write are let go after
        const tried: string[] = [];
        const loaded = await this.vault.update(this.path, (doc) => {
          mutate(doc);
          const text = serialize(doc);
          tried.push(text);
          this.own.set(text, version);
          if (body) this.typed.add(text); else this.typed.delete(text);
        });
        for (const t of tried) if (t !== loaded.text) { this.own.delete(t); this.typed.delete(t); }
        this.base = loaded.doc.blocks;
        return loaded;
      } catch (e) {
        if (!(e instanceof Superseded)) throw e;
        this.told(DROPPED);
        return null;
      }
    });
    this.chain = run.catch((e: unknown) => console.error(this.path, e));
    return run;
  }

  /** Write the body `blocks()` gives, after a pause; the latest call wins. */
  schedule(blocks: () => Block[]): void {
    this.pending = blocks;
    if (this.timer) clearTimeout(this.timer);
    this.timer = setTimeout(() => this.flush(), WRITE_DELAY);
  }

  flush(): void {
    if (this.timer) clearTimeout(this.timer);
    this.timer = null;
    const pending = this.pending;
    this.pending = null;
    if (!pending) return;
    const blocks = pending();
    const epoch = this.epoch;
    void this.update((doc) => {
      // someone else's change came after these blocks were taken, heard or found under the write: theirs stands
      // (`heard` builds the page from it; one found under the write is reported by the vault)
      if (this.epoch !== epoch || (this.base && !blocksEqual(doc.blocks, this.base))) throw new Superseded();
      doc.blocks = blocks;
    }, true);
  }

  /** Run `fn` once everything scheduled so far has been written. */
  run<T>(fn: () => Promise<T>): Promise<T> {
    this.flush();
    const run = this.chain.then(fn);
    this.chain = run.catch((e: unknown) => console.error(this.path, e));
    return run;
  }

  /**
   * `run` for an operation of the vault's that writes this page's file
   * itself (an extract, a section taken from a selection): what the vault
   * reports while it runs is heard as the page's own change (`how`), and
   * otherwise as any change from elsewhere is.
   */
  op<T>(fn: () => Promise<T>): Promise<T> {
    return this.run(async () => {
      this.ops++;
      try { return await fn(); } finally { this.ops--; }
    });
  }

  /** Drop what has not been written yet: the file changed under us and wins. */
  cancel(): void {
    if (this.timer) clearTimeout(this.timer);
    this.timer = null;
    this.pending = null;
  }
}
