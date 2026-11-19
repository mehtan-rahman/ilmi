// FSRS-7 in the app: the scheduler the app carries in every collection's
// slot (`schedule/fsrs7.ts`), the weights it answers by, read from
// `.ilmi/scheduler.json` (`fsrs7`, FORMAT.md §1) so every device answers
// alike, and `fit to my reviews`, which fits them to the collection's own
// review log on the Rust side (`fit.rs`, the `fsrs` crate's optimiser) and
// keeps them there. A fit is asked for, never made by itself.

import { invoke } from '@tauri-apps/api/core';
import { appNow } from '../app/clock.js';
import { note, reviewLog } from '../app/vault.js';
import { FSRS7_ID, FSRS7_MIN_ITEMS, dayOf, fitCards, fitItems, fitReviews, fsrs7FitIn, fsrs7Scheduler, fsrs7Weights, type Fsrs7Fit } from '../schedule/index.js';
import { schedulerSlot, writeSchedulerFile } from './index.js';

let fit: Fsrs7Fit | null = null;

/** The one scheduler, over whatever weights the open collection has. */
export const fsrs7 = fsrs7Scheduler(() => fit?.w ?? null);

/** The open collection's fit; null while FSRS-7 runs on its defaults. */
export const fsrs7Fit = (): Fsrs7Fit | null => fit;

/** `.ilmi/scheduler.json` as it was read: the weights FSRS-7 answers by from here. True when they changed. */
export function readFsrs7(data: Record<string, unknown>): boolean {
  const next = fsrs7FitIn(data);
  const same = JSON.stringify(next?.w ?? null) === JSON.stringify(fit?.w ?? null);
  // the same weights are the same array: what was replayed with them stands
  fit = next && same && fit ? { ...next, w: fit.w } : next;
  return !same;
}

/** What a fit would be made from now: the items in the log, and whether they are enough for the optimiser to train. */
export function fitOffer(): { items: number; enough: boolean } {
  const log = reviewLog();
  if (offered?.log !== log) {
    const items = fitItems(fitCards(log));
    offered = { log, offer: { items, enough: items >= FSRS7_MIN_ITEMS } };
  }
  return offered.offer;
}
/** Counted once for the log as it is: a row and the palette ask on every draw. */
let offered: { log: readonly unknown[]; offer: { items: number; enough: boolean } } | null = null;

interface Fitted { w: number[]; items: number; fitted: boolean }
let fitting = false;
export const fsrs7Fitting = (): boolean => fitting;

/**
 * `fit to my reviews`: FSRS-7's weights fitted to the collection's review
 * log and kept in the collection, with how many reviews they came from and
 * the day. With too little to train from nothing is kept, and a line says
 * how far it is. Resolves to whether weights were kept.
 */
export async function fitToReviews(): Promise<boolean> {
  if (fitting) return false;
  const cards = fitCards(reviewLog());
  const items = fitItems(cards);
  if (items < FSRS7_MIN_ITEMS) {
    note(`fsrs-7 fits from ${FSRS7_MIN_ITEMS} reviews of cards seen before; ${items} so far`);
    return false;
  }
  fitting = true;
  schedulerSlot()?.restart(FSRS7_ID);
  try {
    const got = await invoke<Fitted | null>('fsrs_fit', { cards });
    const w = got?.fitted ? fsrs7Weights(got.w) : null;
    if (!got || !w) {
      note(got && !got.fitted ? 'too little to fit from yet; fsrs-7 keeps the weights it had' : 'the fit gave nothing fsrs-7 can run on; it keeps the weights it had');
      return false;
    }
    const kept: Fsrs7Fit = { w, reviews: fitReviews(cards), fitted: dayOf(appNow()) };
    let data: Record<string, unknown> = {};
    await writeSchedulerFile((d) => { data = { ...d, fsrs7: kept }; return data; });
    readFsrs7(data);
    note(`fsrs-7 fitted to ${kept.reviews} reviews`);
    return true;
  } catch (e) {
    note(`could not fit: ${e instanceof Error ? e.message : String(e)}`);
    return false;
  } finally {
    fitting = false;
    // from the top with the weights as they now are (and the row drawn again)
    schedulerSlot()?.restart(FSRS7_ID);
  }
}
