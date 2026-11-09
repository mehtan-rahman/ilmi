// What the model tests share (`*.model.test.ts`): a statechart as data, its
// states walked breadth first, and a file system whose answers can be held
// back, as a slow disk's are.
//
// The walk: from the start, every event whose guard holds is fired in every
// state reached, to `depth` events; a state is known by its key, so each is
// expanded once, by its shortest road. Every transition taken is returned
// with that road, for the test to play on the real thing from the start and
// compare, step by step, with the model.

export interface Machine<S, E extends string> {
  init: S;
  events: readonly E[];
  /** The state after `e`, or null when `e` is not enabled in `s` (its guard fails). */
  step(s: S, e: E): S | null;
  /** What makes two states the same state. */
  key(s: S): string;
  /** What must hold in every state; a broken one's words, else null. */
  invariant?(s: S): string | null;
}

export interface Transition<S, E extends string> {
  /** The road from the start: the shortest to `from`, then the event. */
  path: E[];
  from: S;
  to: S;
}

/** Every transition of `m` within `depth` events of the start, each once. */
export function transitions<S, E extends string>(m: Machine<S, E>, depth: number): { all: Transition<S, E>[]; states: number } {
  const seen = new Map<string, E[]>([[m.key(m.init), []]]);
  let frontier: [S, E[]][] = [[m.init, []]];
  const all: Transition<S, E>[] = [];
  for (let d = 0; d < depth && frontier.length; d++) {
    const next: [S, E[]][] = [];
    for (const [s, path] of frontier) {
      for (const e of m.events) {
        const to = m.step(s, e);
        if (to === null) continue;
        const p = [...path, e];
        const bad = m.invariant?.(to);
        if (bad) throw new Error(`the model breaks its own invariant after ${p.join(' ')}: ${bad}`);
        all.push({ path: p, from: s, to });
        const k = m.key(to);
        if (seen.has(k)) continue;
        seen.set(k, p);
        next.push([to, p]);
      }
    }
    frontier = next;
  }
  return { all, states: seen.size };
}

/**
 * Only the transitions whose road is not the start of another's: playing
 * those covers every transition (each step is compared on the way).
 */
export function leaves<S, E extends string>(all: Transition<S, E>[]): Transition<S, E>[] {
  const prefixes = new Set<string>();
  for (const t of all) for (let i = 1; i < t.path.length; i++) prefixes.add(t.path.slice(0, i).join(' '));
  return all.filter((t) => !prefixes.has(t.path.join(' ')));
}

/**
 * A file system whose answers wait while `hold` is on: each call runs, its
 * result kept until `release`, the way a slow disk answers late. Calls that
 * answer at once (not a promise) are not held.
 */
export function gated<F extends object>(fs: F): { fs: F; hold(on: boolean): void; release(): void; waiting(): number } {
  let held = false;
  let queue: (() => void)[] = [];
  const wrapped = new Proxy(fs, {
    get(t, k) {
      const v = Reflect.get(t, k) as unknown;
      if (typeof v !== 'function') return v;
      return (...a: unknown[]) => {
        const r = (v as (...a: unknown[]) => unknown).apply(t, a);
        if (!held || !(r instanceof Promise)) return r;
        return new Promise((res, rej) => { queue.push(() => { r.then(res, rej); }); });
      };
    },
  });
  return {
    fs: wrapped,
    hold: (on) => { held = on; },
    release: () => { const q = queue; queue = []; for (const go of q) go(); },
    waiting: () => queue.length,
  };
}
