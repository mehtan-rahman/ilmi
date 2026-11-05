// The nudge (milestone 54): after every push, ilmi publishes "changed" to a
// topic named by a hash of the remote URL, and every open ilmi on that
// vault, subscribed to the topic, pulls at once. The topic carries no
// content: the message is the word and which window sent it, so the sender
// leaves its own alone. The transport is ntfy over the server in the tweaks
// (`https://ntfy.sh` until changed): a POST to publish, server-sent events
// through the http plugin to listen, reconnecting quietly with a growing
// wait. `src/app/sync.ts` wires this to its push and pull.

import { fetch as httpFetch } from '@tauri-apps/plugin-http';

export const NUDGE_SERVER = 'https://ntfy.sh';

/** The word on the wire; the window's id follows it. */
const WORD = 'changed';

/** This window, told apart from the other subscribers of the topic. */
export const DEVICE = Math.random().toString(16).slice(2, 10).padEnd(8, '0');

type Fetch = (url: string, init?: RequestInit) => Promise<Response>;

// ── the topic ────────────────────────────────────────────────────

/** A remote's URL as two devices would agree on it: trimmed, without a trailing slash or `.git`. */
export function normalizeRemote(url: string): string {
  return url.trim().replace(/\/+$/, '').replace(/\.git$/, '').replace(/\/+$/, '');
}

const K = new Uint32Array([
  0x428a2f98, 0x71374491, 0xb5c0fbcf, 0xe9b5dba5, 0x3956c25b, 0x59f111f1, 0x923f82a4, 0xab1c5ed5, 0xd807aa98, 0x12835b01, 0x243185be, 0x550c7dc3, 0x72be5d74, 0x80deb1fe, 0x9bdc06a7, 0xc19bf174,
  0xe49b69c1, 0xefbe4786, 0x0fc19dc6, 0x240ca1cc, 0x2de92c6f, 0x4a7484aa, 0x5cb0a9dc, 0x76f988da, 0x983e5152, 0xa831c66d, 0xb00327c8, 0xbf597fc7, 0xc6e00bf3, 0xd5a79147, 0x06ca6351, 0x14292967,
  0x27b70a85, 0x2e1b2138, 0x4d2c6dfc, 0x53380d13, 0x650a7354, 0x766a0abb, 0x81c2c92e, 0x92722c85, 0xa2bfe8a1, 0xa81a664b, 0xc24b8b70, 0xc76c51a3, 0xd192e819, 0xd6990624, 0xf40e3585, 0x106aa070,
  0x19a4c116, 0x1e376c08, 0x2748774c, 0x34b0bcb5, 0x391c0cb3, 0x4ed8aa4a, 0x5b9cca4f, 0x682e6ff3, 0x748f82ee, 0x78a5636f, 0x84c87814, 0x8cc70208, 0x90befffa, 0xa4506ceb, 0xbef9a3f7, 0xc67178f2,
]);

/** SHA-256 of a string, as hex: synchronous, so the topic is known the moment the remote is. */
export function sha256(text: string): string {
  const bytes = new TextEncoder().encode(text);
  const len = bytes.length;
  const padded = new Uint8Array(((len + 9 + 63) >> 6) << 6);
  padded.set(bytes);
  padded[len] = 0x80;
  const view = new DataView(padded.buffer);
  view.setUint32(padded.length - 4, len << 3, false);
  view.setUint32(padded.length - 8, Math.floor(len / 0x20000000), false);
  const h = new Uint32Array([0x6a09e667, 0xbb67ae85, 0x3c6ef372, 0xa54ff53a, 0x510e527f, 0x9b05688c, 0x1f83d9ab, 0x5be0cd19]);
  const w = new Uint32Array(64);
  const rotr = (x: number, n: number) => (x >>> n) | (x << (32 - n));
  for (let off = 0; off < padded.length; off += 64) {
    for (let i = 0; i < 16; i++) w[i] = view.getUint32(off + i * 4, false);
    for (let i = 16; i < 64; i++) {
      const s0 = rotr(w[i - 15]!, 7) ^ rotr(w[i - 15]!, 18) ^ (w[i - 15]! >>> 3);
      const s1 = rotr(w[i - 2]!, 17) ^ rotr(w[i - 2]!, 19) ^ (w[i - 2]! >>> 10);
      w[i] = (w[i - 16]! + s0 + w[i - 7]! + s1) >>> 0;
    }
    let [a, b, c, d, e, f, g, hh] = h as unknown as [number, number, number, number, number, number, number, number];
    for (let i = 0; i < 64; i++) {
      const S1 = rotr(e, 6) ^ rotr(e, 11) ^ rotr(e, 25);
      const ch = (e & f) ^ (~e & g);
      const t1 = (hh + S1 + ch + K[i]! + w[i]!) >>> 0;
      const S0 = rotr(a, 2) ^ rotr(a, 13) ^ rotr(a, 22);
      const maj = (a & b) ^ (a & c) ^ (b & c);
      const t2 = (S0 + maj) >>> 0;
      hh = g; g = f; f = e; e = (d + t1) >>> 0; d = c; c = b; b = a; a = (t1 + t2) >>> 0;
    }
    h[0] = (h[0]! + a) >>> 0; h[1] = (h[1]! + b) >>> 0; h[2] = (h[2]! + c) >>> 0; h[3] = (h[3]! + d) >>> 0;
    h[4] = (h[4]! + e) >>> 0; h[5] = (h[5]! + f) >>> 0; h[6] = (h[6]! + g) >>> 0; h[7] = (h[7]! + hh) >>> 0;
  }
  return Array.from(h, (x) => x.toString(16).padStart(8, '0')).join('');
}

/** The topic for a remote: `ilmi-` and the first 32 hex digits of the URL's hash; nothing of the URL itself reaches the server. */
export function topicOf(remote: string): string {
  return `ilmi-${sha256(normalizeRemote(remote)).slice(0, 32)}`;
}

/** The server's address as the requests use it: trimmed, no trailing slash. */
const serverOf = (server: string) => server.trim().replace(/\/+$/, '');

// ── the wire ─────────────────────────────────────────────────────

/** One server-sent event, as ntfy writes its JSON. */
export interface NudgeEvent {
  event: string;
  message?: string;
}

/**
 * Server-sent events out of a stream of text: each event ends at a blank
 * line; its `data:` lines, joined, are ntfy's JSON. What is not an event
 * yet stays in `rest` for the next chunk.
 */
export function parseSse(text: string): { events: NudgeEvent[]; rest: string } {
  const events: NudgeEvent[] = [];
  const chunks = text.split(/\r?\n\r?\n/);
  const rest = chunks.pop() ?? '';
  for (const chunk of chunks) {
    const data = chunk.split(/\r?\n/).filter((l) => l.startsWith('data:')).map((l) => l.slice(5).trim()).join('\n');
    if (!data) continue;
    try {
      const o = JSON.parse(data) as unknown;
      if (o && typeof o === 'object' && typeof (o as NudgeEvent).event === 'string') events.push(o as NudgeEvent);
    } catch { /* not ntfy's: skipped */ }
  }
  return { events, rest };
}

/** The message a window publishes. */
export const nudgeMessage = (device = DEVICE): string => `${WORD} from ${device}`;

/** A message from another window on the topic: a nudge. Ours, a keepalive, or anything else: no. */
export function isNudge(ev: NudgeEvent, device = DEVICE): boolean {
  return ev.event === 'message' && typeof ev.message === 'string' && ev.message.startsWith(WORD) && ev.message !== nudgeMessage(device);
}

/** Publish "changed" on the remote's topic. Quiet on failure: the timer is the fallback. */
export async function publishNudge(server: string, remote: string, fetch: Fetch = httpFetch, device = DEVICE): Promise<boolean> {
  const base = serverOf(server);
  if (!base || !remote.trim()) return false;
  try {
    const res = await fetch(`${base}/${topicOf(remote)}`, { method: 'POST', body: nudgeMessage(device), headers: { 'content-type': 'text/plain' } });
    return res.ok;
  } catch {
    return false;
  }
}

export interface Subscription {
  /** Close the stream; nothing more arrives. */
  stop(): void;
}

/** The waits between reconnects, in ms: a second, doubling, a minute at most. */
export const RECONNECT_MIN_MS = 1_000;
export const RECONNECT_MAX_MS = 60_000;
/** A connection that held this long resets the wait. */
const HELD_MS = 10_000;

/**
 * Listen on the remote's topic. `onNudge` runs for each message from
 * another window (`'nudge'`), and once after a lost connection comes back
 * (`'reconnect'`), since a nudge could have gone by in between. The
 * stream reconnects on its own, waiting longer each time it fails at once.
 */
export function subscribeNudge(
  server: string,
  remote: string,
  onNudge: (why: 'nudge' | 'reconnect') => void,
  opts: { fetch?: Fetch; device?: string; setTimeout?: typeof globalThis.setTimeout; onError?: (e: unknown) => void } = {},
): Subscription {
  const fetch = opts.fetch ?? httpFetch;
  const device = opts.device ?? DEVICE;
  const later = opts.setTimeout ?? globalThis.setTimeout;
  const base = serverOf(server);
  const topic = topicOf(remote);
  let stopped = false;
  let controller: AbortController | null = null;
  let wait = RECONNECT_MIN_MS;
  let connected = 0;
  const decoder = new TextDecoder();

  const once = async (): Promise<void> => {
    controller = new AbortController();
    const res = await fetch(`${base}/${topic}/sse`, { headers: { accept: 'text/event-stream' }, signal: controller.signal });
    if (!res.ok || !res.body) throw new Error(`nudge: ${res.status}`);
    const opened = Date.now();
    if (connected++) onNudge('reconnect');
    const reader = res.body.getReader();
    let rest = '';
    for (;;) {
      const { value, done } = await reader.read();
      if (done) break;
      if (Date.now() - opened > HELD_MS) wait = RECONNECT_MIN_MS;
      const parsed = parseSse(rest + decoder.decode(value, { stream: true }));
      rest = parsed.rest;
      for (const ev of parsed.events) if (isNudge(ev, device)) onNudge('nudge');
    }
  };

  const loop = async (): Promise<void> => {
    while (!stopped) {
      const started = Date.now();
      try {
        await once();
      } catch (e) {
        // quiet: the wait, then again
        if (!stopped) opts.onError?.(e);
      }
      if (stopped) return;
      if (Date.now() - started > HELD_MS) wait = RECONNECT_MIN_MS;
      await new Promise<void>((r) => later(r, wait));
      wait = Math.min(wait * 2, RECONNECT_MAX_MS);
    }
  };

  if (base && remote.trim()) void loop();
  return {
    stop() {
      stopped = true;
      controller?.abort();
      controller = null;
    },
  };
}

/** How long ago, for the strip: `just now`, `2 s ago`, `3 min ago`, `2 h ago`, `3 d ago`. */
export function ago(ms: number): string {
  const s = Math.floor(Math.max(0, ms) / 1000);
  if (s < 1) return 'just now';
  if (s < 60) return `${s} s ago`;
  const m = Math.floor(s / 60);
  if (m < 60) return `${m} min ago`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h} h ago`;
  return `${Math.floor(h / 24)} d ago`;
}
