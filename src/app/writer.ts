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
    if (version === undefined) {
      if (this.pending) this.told(DROPPED);
      this.epoch++;
      this.cancel();
      return true;
    }
    return version === this.version && !blocksEqual(shown(), loaded.doc.blocks);
  }

  update(mutate: (doc: Doc) => void): Promise<Loaded | null> {
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
        });
        for (const t of tried) if (t !== loaded.text) this.own.delete(t);
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
    });
  }

  /** Run `fn` once everything scheduled so far has been written. */
  run<T>(fn: () => Promise<T>): Promise<T> {
    this.flush();
    const run = this.chain.then(fn);
    this.chain = run.catch((e: unknown) => console.error(this.path, e));
    return run;
  }

  /** Drop what has not been written yet: the file changed under us and wins. */
  cancel(): void {
    if (this.timer) clearTimeout(this.timer);
    this.timer = null;
    this.pending = null;
  }
}
