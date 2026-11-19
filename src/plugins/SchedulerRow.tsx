// The `scheduler` row of tweaks: `built in`, and each scheduler registered
// in the slot (`scheduler.ts`), one in use. The choice is the collection's
// (`.ilmi/scheduler.json`), so it reads the same on every device; where the
// one chosen is not on this device, or failed this session, the row says
// so beside its name and the built in is what schedules. With FSRS-7
// chosen a second row says what its weights are (the model's defaults, or
// fitted to how many reviews and when) and offers `fit to my reviews` once
// the log has enough to fit from.

import { useState } from 'react';
import { appNow } from '../app/clock.js';
import { agoLabel } from '../app/items.js';
import { FSRS7_ID, FSRS7_MIN_ITEMS } from '../schedule/index.js';
import { BUILT_IN, chooseScheduler, fitOffer, fitToReviews, fsrs7Fit, fsrs7Fitting, useScheduler } from './index.js';

/** FSRS-7's weights: where they are from, and the fit. */
function Fsrs7Row() {
  const [busy, setBusy] = useState(false);
  const fit = fsrs7Fit();
  const offer = fitOffer();
  const going = busy || fsrs7Fitting();
  const run = () => {
    setBusy(true);
    void fitToReviews().finally(() => setBusy(false));
  };
  const from = fit ? `fitted to ${fit.reviews} reviews${fit.fitted ? `, ${agoLabel(fit.fitted, appNow())}` : ''}` : 'defaults';
  return (
    <div className="tw-row" data-tw="fsrs7">
      <span className="tw-lbl">fsrs-7 weights <span className="tw-val">{from}</span></span>
      {offer.enough
        ? <div className="tw-seg"><button type="button" disabled={going} onClick={run}>{going ? 'fitting…' : 'fit to my reviews'}</button></div>
        : <span className="tw-lbl"><span className="tw-val">a fit needs {FSRS7_MIN_ITEMS} reviews of cards seen before, {offer.items} so far</span></span>}
    </div>
  );
}

export function SchedulerRow() {
  const slot = useScheduler();
  if (!slot) return null;
  const rows = slot.rows();
  const chosen = slot.choice();
  const here = chosen === null || rows.some((r) => r.id === chosen);
  return (
    <>
    <div className="tw-row" data-tw="scheduler">
      <span className="tw-lbl">
        scheduler
        {slot.standingIn() && <span className="tw-val">{here ? 'off for now, built in schedules' : 'not on this device, built in schedules'}</span>}
      </span>
      <div className="tw-seg">
        <button type="button" data-active={chosen === null ? '1' : '0'} onClick={() => void chooseScheduler(null)}>{BUILT_IN}</button>
        {rows.map((r) => (
          <button key={r.id} type="button" data-active={chosen === r.id ? '1' : '0'} onClick={() => void chooseScheduler(r.id)}>{r.name}</button>
        ))}
        {!here && <button type="button" data-active="1" disabled>{chosen}</button>}
      </div>
    </div>
    {chosen === FSRS7_ID && here && <Fsrs7Row />}
    </>
  );
}
