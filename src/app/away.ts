// Leaving the app: what was written goes out at once, not on its timer.
//
// A grade made on the phone is sent three seconds after it (the storage's
// sync) or up to a minute after (git's push). Left in that time, the app is
// suspended by iOS and the grade waits on the phone until it is next opened.
// So when the page is hidden (the app sent to the background, the window
// minimised) each sync that has something to send sends it now, and on iOS
// the app is held awake for it (`app_hold`, the ink plugin's `hold`) for as
// long as the system gives an app in the background, half a minute or so.
// The check is `ILMI_SMOKE=away` on a simulated iPad (docs/development.md).

import { invoke } from '@tauri-apps/api/core';

type Leaving = () => Promise<unknown>;

const leaving: Leaving[] = [];
let listening = false;
let forced = false;

/** What the last leave did, for the check: when it started and ended, and what the system said of the time left. */
export const lastLeave: { started: number; ended: number; sent: number; left: number | null; failed: string | null } = {
  started: 0, ended: 0, sent: 0, left: null, failed: null,
};

/** A sync's send for when the page is hidden: it decides itself whether it has anything to send. */
export function onLeave(send: Leaving): void {
  if (!leaving.includes(send)) leaving.push(send);
  if (listening) return;
  listening = true;
  document.addEventListener('visibilitychange', () => { if (document.visibilityState === 'hidden') void leave(); });
}

/** Dev only (the away smoke): leaving sends even where the smoke has stopped the timers. */
export function forceLeave(on: boolean): void {
  forced = on;
}

/** Whether a sync whose timers a smoke stopped still sends on leaving. */
export const leaveForced = (): boolean => forced;

async function leave(): Promise<void> {
  lastLeave.started = Date.now();
  lastLeave.ended = 0;
  lastLeave.sent = 0;
  lastLeave.failed = null;
  const held = await invoke<{ held: boolean; left: number } | null>('app_hold', { on: true }).catch(() => null);
  lastLeave.left = held?.left ?? null;
  try {
    const r = await Promise.allSettled(leaving.map((send) => send()));
    lastLeave.sent = r.filter((x) => x.status === 'fulfilled' && x.value).length;
    const bad = r.find((x): x is PromiseRejectedResult => x.status === 'rejected');
    if (bad) lastLeave.failed = bad.reason instanceof Error ? bad.reason.message : String(bad.reason);
  } finally {
    lastLeave.ended = Date.now();
    await invoke('app_hold', { on: false }).catch(() => {});
  }
}
