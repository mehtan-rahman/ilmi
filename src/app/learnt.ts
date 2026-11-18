// Cards learnt today (the `learnNew` tweak): a card never tested comes up
// answered, to learn, and its test is at the session's end. A session left
// before that end has written nothing of them, so the next one would show
// them to learn again, as if never seen. What was learnt is therefore kept
// past the session, for the day, on this device: come back to, such a card
// is asked as a test, not shown to learn a second time. Once it is graded
// its own schedule says it has been tested, and this is not asked again.

import { appNow } from './clock.js';
import { useApp } from './store.js';

const KEY = 'ilmi.learnt';
const MAX = 2000;

interface Kept { day: string; keys: string[] }

const today = (): string => { const d = appNow(); return `${d.getFullYear()}-${d.getMonth() + 1}-${d.getDate()}`; };
/** A card's key in its collection: the same path in another collection is another card. */
const scoped = (k: string): string => `${useApp.getState().vault ?? ''}|${k}`;

let kept: { day: string; keys: Set<string> } | null = null;

function load(): Set<string> {
  const day = today();
  if (kept?.day === day) return kept.keys;
  let keys: string[] = [];
  try {
    const raw = globalThis.localStorage?.getItem(KEY);
    const was = raw ? (JSON.parse(raw) as Partial<Kept>) : null;
    if (was && was.day === day && Array.isArray(was.keys)) keys = was.keys.filter((k): k is string => typeof k === 'string');
  } catch { /* nothing kept */ }
  kept = { day, keys: new Set(keys) };
  return kept.keys;
}

/** Whether the card was learnt earlier today, in this session or one before it. */
export const learntToday = (k: string): boolean => load().has(scoped(k));

/** The card was learnt: kept for the day. */
export function markLearnt(k: string): void {
  const keys = load();
  keys.add(scoped(k));
  if (keys.size > MAX) keys.delete(keys.values().next().value as string);
  try { globalThis.localStorage?.setItem(KEY, JSON.stringify({ day: kept!.day, keys: [...keys] } satisfies Kept)); } catch { /* the session keeps them */ }
}

/** A test's: nothing learnt. */
export function forgetLearnt(): void {
  kept = null;
  try { globalThis.localStorage?.removeItem(KEY); } catch { /* nothing kept */ }
}
