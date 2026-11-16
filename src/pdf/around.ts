// Getting around a book (milestone 76, after sioyek's reader; read, not
// copied): the places a jump left, to go back to and forward again; the
// letters put on what can be followed; the addresses a selection is looked
// up at. Pure; the lens (`src/app/Pdf.tsx`) holds the trail by the book's id.

/** A place in a book: the page, how far down it (0 the top, 1 the bottom) is under the top of the view, and how far across the pages the middle of the view is when they are zoomed wide. */
export interface Place {
  page: number;
  y: number;
  x: number | null;
}

/** Where the jumps left from (`back`, the last one last), and where going back left from (`forward`, the nearest last). */
export interface Trail {
  back: Place[];
  forward: Place[];
}

/** The most places a trail keeps: the oldest go. */
export const TRAIL_MAX = 100;

export const emptyTrail = (): Trail => ({ back: [], forward: [] });

const same = (a: Place | undefined, b: Place): boolean => !!a && a.page === b.page && Math.abs(a.y - b.y) < 0.002 && (a.x ?? 0.5) === (b.x ?? 0.5);

/** A jump made from `from`: it is where ⌫ goes, and there is no forward any more. The same place twice running is kept once. */
export function pushPlace(t: Trail, from: Place): Trail {
  const back = same(t.back[t.back.length - 1], from) ? t.back : [...t.back, from].slice(-TRAIL_MAX);
  return { back, forward: [] };
}

/** ⌫ at `here`: the place to go to and the trail after, or null with nowhere to go back to. `here` is where ⇧⌫ comes back to, wherever the pages were scrolled since. */
export function stepBack(t: Trail, here: Place): { trail: Trail; to: Place } | null {
  const to = t.back[t.back.length - 1];
  if (!to) return null;
  return { trail: { back: t.back.slice(0, -1), forward: [...t.forward, here].slice(-TRAIL_MAX) }, to };
}

/** ⇧⌫ at `here`: forward again, `here` a place to go back to. */
export function stepForward(t: Trail, here: Place): { trail: Trail; to: Place } | null {
  const to = t.forward[t.forward.length - 1];
  if (!to) return null;
  return { trail: { back: [...t.back, here].slice(-TRAIL_MAX), forward: t.forward.slice(0, -1) }, to };
}

// ── link hints ──

/** The letters a label is made of: the home row first, then the row above, then the one below. */
export const HINT_KEYS = 'asdfghjklqwertyuiopzxcvbnm';

/**
 * A label for each of `n` targets: one letter while the alphabet has one
 * for each, else every label two letters (three past 676), all of a length,
 * so no label begins another. The first targets get the home row.
 */
export function hintLabels(n: number): string[] {
  const k = HINT_KEYS.length;
  let len = 1;
  for (let room = k; room < n; room *= k) len++;
  const out: string[] = [];
  for (let i = 0; i < n; i++) {
    let s = '';
    let v = i;
    for (let j = 0; j < len; j++) { s = HINT_KEYS[v % k]! + s; v = Math.floor(v / k); }
    out.push(s);
  }
  return out;
}

/** What the letters typed so far say: the one target they name, the targets still possible, or none. */
export function hintStep(labels: readonly string[], typed: string): { hit: number } | { left: number[] } | null {
  const t = typed.toLowerCase();
  const left: number[] = [];
  for (let i = 0; i < labels.length; i++) {
    if (labels[i] === t) return { hit: i };
    if (labels[i]!.startsWith(t)) left.push(i);
  }
  return left.length ? { left } : null;
}

// ── look it up ──

/** The address a selection is looked up at, in the system's browser: the web (DuckDuckGo) or Google Scholar. Nothing is fetched by the app. */
export function lookupUrl(where: 'web' | 'scholar', text: string): string {
  const q = encodeURIComponent(text.replace(/\s+/g, ' ').trim());
  return where === 'scholar' ? `https://scholar.google.com/scholar?q=${q}` : `https://duckduckgo.com/?q=${q}`;
}
