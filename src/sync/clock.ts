// The clock that orders writes across devices (milestone 61): a hybrid
// logical clock. A stamp is the wall time in milliseconds, a counter for
// writes within one millisecond, and the device, as one string that sorts
// as the three do. A device's stamps only go up, and after it has seen
// another device's stamp its own are later than that one, so a write made
// knowing of another always sorts after it; between writes that did not
// know of each other the wall clocks decide, and the device breaks a tie.

const MS = 9;
const CTR = 3;
const CTR_MAX = 36 ** CTR;
const pad = (n: number, w: number): string => n.toString(36).padStart(w, '0');

/** The wall time a stamp carries, in milliseconds. */
export const msOf = (stamp: string): number => parseInt(stamp.slice(0, MS), 36);

/** A time as the first part of a stamp is written. */
export const msPart = (ms: number): string => pad(Math.max(0, Math.floor(ms)), MS);

export interface Clock {
  /** A stamp for a write made now: later than every stamp made or seen here. */
  tick(): string;
  /** A stamp another device made was read. */
  see(stamp: string): void;
  /** The latest stamp made or seen, for keeping. */
  last(): string;
}

export function clock(device: string, now: () => number, from = ''): Clock {
  let ms = from ? msOf(from) : 0;
  let ctr = from ? parseInt(from.slice(MS, MS + CTR), 36) : 0;
  if (!Number.isFinite(ms)) ms = 0;
  if (!Number.isFinite(ctr)) ctr = 0;
  const fmt = (): string => pad(ms, MS) + pad(ctr, CTR) + device;
  return {
    tick() {
      const t = Math.floor(now());
      if (t > ms) { ms = t; ctr = 0; }
      else if (ctr + 1 < CTR_MAX) ctr += 1;
      else { ms += 1; ctr = 0; }
      return fmt();
    },
    see(stamp) {
      const m = msOf(stamp);
      const c = parseInt(stamp.slice(MS, MS + CTR), 36);
      if (!Number.isFinite(m) || !Number.isFinite(c)) return;
      if (m > ms || (m === ms && c > ctr)) { ms = m; ctr = c; }
    },
    last: fmt,
  };
}
