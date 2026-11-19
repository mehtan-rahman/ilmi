// The scheduler slot's runtime, beside the plugin runtime: the schedulers
// registered (a plugin's through `ilmi.scheduler.register`, the app's own
// the same way), the one a collection has chosen, the review log handed to
// it (`prepare` whole, `observe` a review at a time), and the scores it
// gives the queue's cards, asked for a little after the queue is built and
// kept until newer ones come. Nothing here blocks a grade or the queue: a
// score that is not in yet, or is from before a card's last review, is no
// score, and the built in's day stands. A scheduler that throws, answers
// with something else than it was asked, or takes too long is off for the
// session, with one notice, and the built in schedules. Pure over a
// `SlotBridge`, so it runs in vitest without the app.
//
// The choice is the collection's: `.ilmi/scheduler.json` (FORMAT.md §1),
// synced as any file under `.ilmi/`, so every device means the same one. A
// device where that scheduler is not registered says so once and uses the
// built in.

import type { Review } from '../format/index.js';
import {
  CURVE_GRID, addDays, between, canonicalLog, crossing, dayOf, dueOf, indexLog, recallOf, scoreKey,
  type Grade, type SchedCard, type SchedContext, type Scheduler, type Score,
} from '../schedule/index.js';

export const SCHEDULER_FILE = '.ilmi/scheduler.json';
/** What the tweaks row calls no choice. */
export const BUILT_IN = 'built in';
const ID_RE = /^[a-z0-9][a-z0-9-]*$/;
/** How long after the queue asks before a scheduler is run: a burst of queue builds is one asking. */
const DEBOUNCE = 80;
/** How long one answer may take. */
const TIMEOUT = 10_000;
/** How long `prepare` may take: the whole log, once. */
const PREPARE_TIMEOUT = 120_000;
/** A date-less scheduler is asked again this often while a collection is open: recall falls as the day goes. */
export const RESCORE_MS = 10 * 60_000;
/** Cards scored between two breaths, so a long pass does not hold the page. */
const CHUNK = 400;
/** A curve that never reaches its target within the grid: this far ahead. */
const NEVER = 3650;

export interface SlotBridge {
  notice(text: string): void;
  /** What the queue reads changed (scores, the scheduler in use): it is built again. */
  changed(): void;
  now(): Date;
  /** A plugin's scheduler failed: the plugin's failure, said and handled by its host (which turns it off). */
  fail?(owner: string, e: unknown): void;
}

export interface SlotOptions {
  debounce?: number;
  timeout?: number;
  prepareTimeout?: number;
  rescore?: number;
}

/** One row of the tweaks choice. */
export interface SchedulerRow {
  id: string;
  name: string;
  /** The plugin it came from; null for one the app carries. */
  owner: string | null;
}

interface Reg {
  owner: string | null;
  spec: Scheduler;
}

interface Job {
  cards: readonly SchedCard[];
  sig: string;
}

const message = (e: unknown): string => (e instanceof Error ? e.message : String(e));
const FAILED = Symbol('failed');
const breath = (): Promise<void> => new Promise((r) => setTimeout(r, 0));

/** `.ilmi/scheduler.json` as an object; anything else reads as an empty one. */
export function parseSchedulerFile(text: string | null): Record<string, unknown> {
  if (text === null) return {};
  try {
    const raw: unknown = JSON.parse(text);
    return raw && typeof raw === 'object' && !Array.isArray(raw) ? (raw as Record<string, unknown>) : {};
  } catch {
    return {};
  }
}

/** The file's bytes: keys sorted at the top, two spaces, a newline at the end, so the same choice is the same file. */
export function formatSchedulerFile(data: Record<string, unknown>): string {
  const out: Record<string, unknown> = {};
  for (const k of Object.keys(data).sort()) if (data[k] !== undefined) out[k] = data[k];
  return `${JSON.stringify(out, null, 2)}\n`;
}

/** The scheduler a file names; null for none (the built in). */
export function chosenIn(data: Record<string, unknown>): string | null {
  return typeof data.scheduler === 'string' && ID_RE.test(data.scheduler) ? data.scheduler : null;
}

export class SchedulerSlot {
  private regs = new Map<string, Reg>();
  private chosen: string | null = null;
  private failed = new Set<string>();
  private told = new Set<string>();
  private scores = new Map<string, Score>();
  private dueNow = new Map<string, boolean>();
  /** A date worked out from a line's last review (`next`), by line and that review's instant. */
  private dates = new Map<string, { at: string; due: string | null }>();
  private log: readonly Review[] = [];
  private index = new Map<string, Review[]>();
  /** The log moved on while no scheduler was in use: its index is made when one is. */
  private stale = false;
  private ready: Promise<unknown> = Promise.resolve();
  private gen = 0;
  private asked: Job | null = null;
  private last: Job | null = null;
  private doneSig = '';
  private runningSig = '';
  private running: Promise<void> | null = null;
  private timer: ReturnType<typeof setTimeout> | null = null;
  private again: ReturnType<typeof setTimeout> | null = null;
  private listeners = new Set<() => void>();
  private readonly debounce: number;
  private readonly timeout: number;
  private readonly prepareTimeout: number;
  private readonly rescore: number;
  /** Bumped on any change the tweaks row should draw. */
  version = 0;

  constructor(private readonly bridge: SlotBridge, opts: SlotOptions = {}) {
    this.debounce = opts.debounce ?? DEBOUNCE;
    this.timeout = opts.timeout ?? TIMEOUT;
    this.prepareTimeout = opts.prepareTimeout ?? PREPARE_TIMEOUT;
    this.rescore = opts.rescore ?? RESCORE_MS;
  }

  // ── who is here, who is chosen ──────────────────────────────────

  subscribe(fn: () => void): () => void {
    this.listeners.add(fn);
    return () => { this.listeners.delete(fn); };
  }

  private bump(): void {
    this.version++;
    for (const fn of [...this.listeners]) fn();
  }

  /** A scheduler added; `owner` is the plugin it is from, null for the app's own. Throws on one that is not one. */
  register(owner: string | null, spec: Scheduler): () => void {
    if (!spec || typeof spec.id !== 'string' || !ID_RE.test(spec.id) || spec.id === 'built-in') throw new Error('a scheduler needs an id of lowercase letters, digits, and hyphens');
    if (typeof spec.name !== 'string' || !spec.name.trim()) throw new Error('a scheduler needs a name');
    if (typeof spec.recall !== 'function' && typeof spec.next !== 'function') throw new Error('a scheduler needs recall or next');
    if (this.regs.has(spec.id)) throw new Error(`a scheduler called ${spec.id} is already here`);
    const reg: Reg = { owner, spec };
    this.regs.set(spec.id, reg);
    if (spec.id === this.chosen) this.start();
    this.bump();
    return () => {
      if (this.regs.get(spec.id) !== reg) return;
      this.regs.delete(spec.id);
      if (spec.id === this.chosen) this.start();
      this.bump();
    };
  }

  rows(): SchedulerRow[] {
    return [...this.regs.values()].map((r) => ({ id: r.spec.id, name: r.spec.name, owner: r.owner }));
  }

  /** The collection's choice, whether or not it is here; null, the built in. */
  choice(): string | null {
    return this.chosen;
  }

  /** The collection's choice is not on this device, or failed this session: the built in is scheduling in its place. */
  standingIn(): boolean {
    return this.chosen !== null && !this.activeReg();
  }

  /** The collection's choice, as it was read or made. A scheduler chosen again after it failed is tried again. */
  choose(id: string | null, again = false): void {
    if (again && id !== null) this.failed.delete(id);
    if (id === this.chosen && !again) return;
    this.chosen = id;
    this.start();
    this.bump();
  }

  /** Said once a collection's plugins have started: a choice that is not here is told, once. */
  settle(): void {
    const id = this.chosen;
    if (id === null || this.regs.has(id) || this.failed.has(id) || this.told.has(id)) return;
    this.told.add(id);
    this.bridge.notice(`scheduler ${id} is not on this device; built in schedules here`);
  }

  private activeReg(): Reg | null {
    if (this.chosen === null || this.failed.has(this.chosen)) return null;
    return this.regs.get(this.chosen) ?? null;
  }

  /** The scheduler in use; null while the built in is. */
  active(): Scheduler | null {
    return this.activeReg()?.spec ?? null;
  }

  /** From the top with whichever is in use now: no scores, its `prepare` over the log. */
  private start(): void {
    this.gen++;
    this.scores = new Map();
    this.dueNow = new Map();
    this.dates = new Map();
    this.asked = null;
    this.last = null;
    this.doneSig = '';
    if (this.again) clearTimeout(this.again);
    this.again = null;
    const reg = this.activeReg();
    if (reg) this.told.delete(reg.spec.id);
    if (reg && this.stale) {
      this.index = indexLog(this.log);
      this.stale = false;
    }
    this.ready = reg?.spec.prepare ? this.guard(reg, this.gen, this.prepareTimeout, () => reg.spec.prepare!(canonicalLog(this.log), this.ctx())) : Promise.resolve();
    this.bridge.changed();
  }

  /** The collection closes. */
  stop(): void {
    this.gen++;
    if (this.timer) clearTimeout(this.timer);
    if (this.again) clearTimeout(this.again);
    this.timer = null;
    this.again = null;
    this.asked = null;
    this.regs.clear();
    this.scores = new Map();
    this.listeners.clear();
  }

  private ctx(): SchedContext {
    return { now: this.bridge.now() };
  }

  // ── a scheduler's own code, guarded ─────────────────────────────

  /** Run a scheduler's function: what it gave, or `FAILED` when it threw or took too long (it is then off) or is no longer the one in use. */
  private async guard<T>(reg: Reg, gen: number, ms: number, fn: () => T | Promise<T>): Promise<T | typeof FAILED> {
    let timer: ReturnType<typeof setTimeout> | null = null;
    try {
      const out = await Promise.race([
        Promise.resolve().then(fn),
        new Promise<never>((_, no) => { timer = setTimeout(() => no(new Error(`took over ${Math.round(ms / 1000)}s`)), ms); }),
      ]);
      return gen === this.gen ? out : FAILED;
    } catch (e) {
      if (gen === this.gen) this.fail(reg, e);
      return FAILED;
    } finally {
      if (timer) clearTimeout(timer);
    }
  }

  /** `reg` is off for the session: one notice naming it, and the built in schedules. */
  private fail(reg: Reg, e: unknown): void {
    const id = reg.spec.id;
    if (this.regs.get(id) !== reg || this.failed.has(id)) return;
    console.error(`scheduler ${id}:`, e);
    this.failed.add(id);
    const said = `${message(e)}; built in schedules for now`;
    if (reg.owner !== null && this.bridge.fail) {
      // the plugin's host says it and turns the plugin off, which takes the scheduler out
      this.bridge.fail(reg.owner, new Error(`scheduler ${reg.spec.name}: ${said}`));
    } else this.bridge.notice(`${reg.spec.name}: ${said}`);
    // (a plugin turned off has taken its scheduler out, and that began again already)
    if (this.regs.get(id) === reg && id === this.chosen) this.start();
    this.bump();
  }

  // ── the log ─────────────────────────────────────────────────────

  /** The review log as the app holds it now. Reviews added at its end are observed; anything else is prepared again. */
  setLog(log: readonly Review[]): void {
    if (log === this.log) return;
    const old = this.log;
    this.log = log;
    // with the built in in use nothing reads it: kept, and indexed when a scheduler is
    if (!this.activeReg()) {
      this.stale = true;
      return;
    }
    let appended = log.length >= old.length;
    for (let i = 0; appended && i < old.length; i++) if (log[i] !== old[i]) appended = false;
    const reg = this.activeReg();
    const gen = this.gen;
    if (appended) {
      const added = log.slice(old.length);
      for (const r of added) {
        const k = scoreKey(r.card, r.key);
        const list = this.index.get(k) ?? [];
        // a list a card was handed is never changed under it
        this.index.set(k, list.length && list[list.length - 1]!.at > r.at ? [...list, r].sort((a, b) => (a.at < b.at ? -1 : a.at > b.at ? 1 : 0)) : [...list, r]);
      }
      if (reg?.spec.observe && added.length) {
        this.ready = this.ready.then(() => this.guard(reg, gen, this.timeout, async () => { for (const r of added) await reg.spec.observe!(r, this.ctx()); }));
      }
      return;
    }
    this.index = indexLog(log);
    this.dates = new Map();
    if (reg?.spec.prepare) this.ready = this.ready.then(() => this.guard(reg, gen, this.prepareTimeout, () => reg.spec.prepare!(canonicalLog(log), this.ctx())));
  }

  /** Each line's reviews (`scoreKey`), for `schedCardOf`. */
  histories(): ReadonlyMap<string, readonly Review[]> {
    return this.index;
  }

  // ── scores ──────────────────────────────────────────────────────

  /** What the scheduler in use said of a line, when it said it of the line as it is now (`last`, its last review). */
  scoreOf(id: string, key: string | undefined, last: string | undefined): Score | undefined {
    const s = this.scores.get(scoreKey(id, key));
    return s && s.last === last ? s : undefined;
  }

  /** Whether any score is held: the queue lays them over its cards only then. */
  scored(): boolean {
    return this.scores.size > 0;
  }

  /**
   * The queue was built over these cards: the scheduler in use is asked
   * about them, a little later, unless it already was (the same cards, the
   * same reviews, within the same ten minutes). The scores held stay until
   * the new ones are in.
   */
  request(cards: readonly SchedCard[]): void {
    const reg = this.activeReg();
    if (!reg) return;
    const sig = this.sigOf(cards);
    if (sig === this.doneSig || sig === this.runningSig || sig === this.asked?.sig) return;
    this.asked = { cards, sig };
    if (this.timer) clearTimeout(this.timer);
    this.timer = setTimeout(() => { this.timer = null; this.pump(); }, this.debounce);
  }

  private sigOf(cards: readonly SchedCard[]): string {
    // FNV-1a over what a score depends on
    let h = 0x811c9dc5;
    const eat = (s: string) => { for (let i = 0; i < s.length; i++) h = Math.imul(h ^ s.charCodeAt(i), 0x01000193); };
    for (const c of cards) eat(`${c.id}/${c.key ?? ''}/${c.fsrs?.last ?? ''}/${c.retention}/${c.history.length};`);
    return `${this.gen}:${Math.floor(this.bridge.now().getTime() / this.rescore)}:${cards.length}:${h >>> 0}`;
  }

  private pump(): void {
    if (this.running) return;
    this.running = (async () => {
      while (this.asked) {
        const job = this.asked;
        this.asked = null;
        this.runningSig = job.sig;
        try {
          await this.score(job);
        } catch (e) {
          console.error('scheduler', e);
        }
        this.runningSig = '';
      }
    })().finally(() => { this.running = null; });
  }

  /** Everything asked for is in (for tests, and for whoever must read scores now). */
  async idle(): Promise<void> {
    for (;;) {
      if (this.timer) { clearTimeout(this.timer); this.timer = null; this.pump(); }
      await this.ready;
      if (this.running) { await this.running; continue; }
      if (!this.timer && !this.asked) return;
      if (!this.timer) this.pump();
    }
  }

  private async score(job: Job): Promise<void> {
    const reg = this.activeReg();
    const gen = this.gen;
    if (!reg) return;
    await this.ready;
    if (gen !== this.gen || this.activeReg() !== reg) return;
    const { spec } = reg;
    const { cards } = job;
    const ctx = this.ctx();
    const today = dayOf(ctx.now);
    let recall: (number | null)[] | null = null;
    if (spec.recall) {
      const out = cards.length ? await this.guard(reg, gen, this.timeout, () => spec.recall!(cards, ctx)) : [];
      if (out === FAILED) return;
      if (!Array.isArray(out) || out.length !== cards.length) {
        this.fail(reg, new Error(`recall answered ${Array.isArray(out) ? out.length : 'nothing'} for ${cards.length} cards`));
        return;
      }
      recall = out.map(recallOf);
    }
    const next = new Map<string, Score>();
    const due = new Map<string, boolean>();
    // the dates and the curves, a card at a time, under one clock
    const rest = await this.guard(reg, gen, this.timeout * 3, async () => {
      for (let i = 0; i < cards.length; i++) {
        if (i && i % CHUNK === 0) await breath();
        const c = cards[i]!;
        const k = scoreKey(c.id, c.key);
        const s: Score = { last: c.fsrs?.last };
        if (recall) {
          const r = recall[i]!;
          if (r === null) continue;
          s.recall = r;
          due.set(k, r <= c.retention);
          if (spec.curve && r > c.retention) s.due = addDays(today, await this.reaches(spec, c, ctx));
        } else {
          const d = await this.dateOf(spec, c);
          if (d === null) continue;
          s.due = d;
        }
        next.set(k, s);
      }
    });
    if (rest === FAILED) return;
    const first = this.doneSig === '';
    const same = !first && next.size === this.scores.size && [...next].every(([k, s]) => {
      const was = this.scores.get(k);
      return !!was && was.last === s.last && was.due === s.due && (was.recall === undefined) === (s.recall === undefined) && this.dueNow.get(k) === due.get(k);
    });
    this.scores = next;
    this.dueNow = due;
    this.doneSig = job.sig;
    this.last = job;
    if (!same) {
      this.bump();
      this.bridge.changed();
    }
    // recall falls as the day goes: asked again in a while, of the same cards, until the queue asks of others
    if (this.again) clearTimeout(this.again);
    this.again = spec.recall ? setTimeout(() => {
      this.again = null;
      if (gen !== this.gen || !this.last || this.asked) return;
      this.asked = { cards: this.last.cards, sig: this.sigOf(this.last.cards) };
      this.pump();
    }, this.rescore) : null;
  }

  /** The first whole day ahead a card's curve is at or under its target. */
  private async reaches(spec: Scheduler, c: SchedCard, ctx: SchedContext): Promise<number> {
    const coarse = await spec.curve!(c, CURVE_GRID, ctx);
    const span = crossing(CURVE_GRID, coarse, c.retention);
    if (!span) return NEVER;
    const [a, b] = span;
    const days = between(a, b);
    if (!days.length) return b;
    const fine = await spec.curve!(c, days, ctx);
    return crossing(days, fine, c.retention)?.[1] ?? b;
  }

  /** An interval scheduler's date for a line: `next` as of its last review, worked out once per review. */
  private async dateOf(spec: Scheduler, c: SchedCard): Promise<string | null> {
    const lastReview = c.history[c.history.length - 1];
    if (!spec.next || !lastReview) return null;
    const k = scoreKey(c.id, c.key);
    const held = this.dates.get(k);
    if (held && held.at === lastReview.at) return held.due;
    const { fsrs: _, ...before } = c;
    const out = await spec.next({ ...before, history: c.history.slice(0, -1) }, lastReview.g, { now: new Date(lastReview.at) });
    const due = out ? dueOf(out.due) : null;
    this.dates.set(k, { at: lastReview.at, due });
    return due;
  }

  /**
   * What each grade would do to a card now, by the scheduler in use, as
   * dues the format writes; null when it has no `preview` or no word on
   * the card. Never throws.
   */
  async preview(card: SchedCard): Promise<Record<Grade, string> | null> {
    const reg = this.activeReg();
    if (!reg?.spec.preview) return null;
    await this.ready;
    if (this.activeReg() !== reg) return null;
    const out = await this.guard(reg, this.gen, this.timeout, () => reg.spec.preview!(card, this.ctx()));
    if (out === FAILED || !out) return null;
    const dues = {} as Record<Grade, string>;
    for (const g of [1, 2, 3, 4] as const) {
      const d = dueOf(out[g]?.due);
      if (d === null) return null;
      dues[g] = d;
    }
    return dues;
  }
}
