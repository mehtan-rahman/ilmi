// The app's clock: what everything that schedules, counts or draws a day
// reads (the queue, grading, passes, the inspector, the top strip). A
// test-only hook moves it by whole days (`setClockDay`), so a smoke can walk
// the days to an exam and past it; the app never sets it.

import { dayOf, dayStart } from '../schedule/index.js';

let shift = 0;

/** Now, as the app schedules it. */
export const appNow = (): Date => new Date(Date.now() + shift);

/** Test-only: the clock on `day` at the present time of day; null, the real day again. */
export function setClockDay(day: string | null): void {
  shift = day === null ? 0 : dayStart(day).getTime() - dayStart(dayOf(new Date())).getTime();
}
