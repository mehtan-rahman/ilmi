// Haptics (milestone 83): a tap under the finger for what a session does,
// on a device that has the hardware for it (an iPhone; no iPad has, and the
// native side says which). The answer shown is a light tap; a grade is felt
// by which it was (again a double knock, hard firm, good light, easy soft);
// the queue walked to its end is the system's success; and a tick goes with
// a blank made, a passage kept, a highlight, a menu opened by a long press,
// and next, later or dismiss on a topic.
//
// The page asks by name and the Rust side's `app_haptic` hands the name to
// the ink plugin's Swift (`haptic`: UIKit's feedback generators). Anywhere
// else the command answers null and nothing is asked again. `haptics` in the
// settings turns it off; it is kept with the other settings on the device.
// Nothing here throws: a tap that cannot be made is not made.

import { invoke } from '@tauri-apps/api/core';
import type { Grade } from '../schedule/index.js';
import { useApp } from './store.js';

/** What the native side can be asked for: three impacts, two notifications, the selection's tick. */
export type Haptic = 'light' | 'medium' | 'heavy' | 'rigid' | 'soft' | 'warning' | 'error' | 'success' | 'tick';

/** A grade's: again is the one that differs in kind, hard is firmer than good, easy is the gentlest. */
export const GRADE_HAPTIC: Record<Grade, Haptic> = { 1: 'error', 2: 'heavy', 3: 'rigid', 4: 'light' };
export const REVEAL_HAPTIC: Haptic = 'medium';
export const FINISHED_HAPTIC: Haptic = 'success';

type Send = (kind: Haptic | 'probe') => Promise<{ can?: boolean } | null>;
const native: Send = (kind) => invoke<{ can?: boolean } | null>('app_haptic', { kind });
let send: Send = native;

/** A test's: what stands in for the native side (none, the native side again). */
export function setHapticSender(fn: Send | null): void {
  send = fn ?? native;
}

/** Ask the device once whether it can: the settings show `haptics` only where it can. */
export async function loadHaptics(): Promise<boolean> {
  let can = false;
  try { can = (await send('probe'))?.can === true; } catch { can = false; }
  useApp.setState({ canHaptics: can });
  return can;
}

// what was asked for, newest last: a dev build's, for a smoke on a simulator, which does not shake
const asked: Haptic[] = [];
const ASKED_MAX = 64;

/** Dev only: the haptics asked for since the last `hapticsAskedClear`. Empty in a release. */
export const hapticsAsked = (): Haptic[] => [...asked];
export function hapticsAskedClear(): void {
  asked.length = 0;
}

function play(kind: Haptic): void {
  try {
    const s = useApp.getState();
    if (!s.canHaptics || !s.haptics) return;
    if (import.meta.env.DEV) {
      asked.push(kind);
      if (asked.length > ASKED_MAX) asked.shift();
    }
    void send(kind).catch(() => {});
  } catch { /* a tap is never worth a failure */ }
}

/** A card's answer shown. */
export const hapticReveal = (): void => play(REVEAL_HAPTIC);
/** A card graded. */
export const hapticGrade = (g: Grade): void => play(GRADE_HAPTIC[g]);
/** The queue walked to its end. */
export const hapticFinished = (): void => play(FINISHED_HAPTIC);
/** Something small done under the finger: a blank, a passage, a highlight, a menu from a long press, a topic's next, later or dismiss. */
export const hapticTick = (): void => play('tick');
