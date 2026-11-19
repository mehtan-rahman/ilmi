// The `scheduler` row of tweaks: `built in`, and each scheduler registered
// in the slot (`scheduler.ts`), one in use. The choice is the collection's
// (`.ilmi/scheduler.json`), so it reads the same on every device; where the
// one chosen is not on this device, or failed this session, the row says
// so beside its name and the built in is what schedules.

import { BUILT_IN, chooseScheduler, useScheduler } from './index.js';

export function SchedulerRow() {
  const slot = useScheduler();
  if (!slot) return null;
  const rows = slot.rows();
  const chosen = slot.choice();
  const here = chosen === null || rows.some((r) => r.id === chosen);
  return (
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
  );
}
