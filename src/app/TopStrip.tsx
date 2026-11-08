// The top strip: the vault's name, the palette, what is due, the day, where
// sync stands (`synced · 2 s ago`, `3 to push`, `pulling…`, `offline`,
// `2 conflicts`; nothing when the vault has no remote), and the inspector
// toggle. The age beside `synced` is how long since the remote was last
// reached, kept current by a tick: the nudge's latency, in view. After
// the prototype's chrome.jsx, with its counts trimmed to the one that
// matters: the day's work, above the fold. On an iPad (milestone 55) the
// sidebar has a toggle too, at the left end: there may be no keyboard for
// ⌃⌘S and no pointer for the handle.

import { useEffect, useState } from 'react';
import { baseOf } from '../vault/index.js';
import { dayLabel, dueToday } from './items.js';
import { useApp } from './store.js';
import { toggleInspector, toggleSidebar } from './vault.js';
import { shapeOf } from './platform.js';
import { inspectorShown } from './layout.js';
import { appNow } from './clock.js';
import { openConflicts, syncAge, syncWord } from './sync.js';
import { Glyph, Icon } from './icons.js';

/** A re-render each second while the age is in seconds, each half minute after. */
function useTick(at: number | null): number {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    if (at === null) return;
    setNow(Date.now());
    const fast = Date.now() - at < 60_000;
    const t = setInterval(() => setNow(Date.now()), fast ? 1000 : 30_000);
    return () => clearInterval(t);
  }, [at, now - (at ?? 0) < 60_000]);
  return now;
}

export function TopStrip() {
  const root = useApp((s) => s.vault);
  const queue = useApp((s) => s.queue);
  // drawn or not by the room rule (`layout.ts`); App draws this strip again on a resize
  const shown = useApp((s) => inspectorShown(s, window.innerWidth));
  const budget = useApp((s) => s.budget);
  const due = dueToday(queue, appNow(), budget).length;
  const sync = useApp((s) => s.sync);
  const word = syncWord(sync);
  const now = useTick(sync.at);
  const age = syncAge(sync, now);
  const mobile = useApp((s) => s.mobile);
  // a phone's strip names the collection and where sync stands; what the rest does is at its foot (`PhoneBar.tsx`)
  const phone = useApp((s) => s.phone);
  // lit while the sidebar is drawn: the column, or in portrait the sheet (App draws this strip again on a turn)
  const sideOn = useApp((s) => (shapeOf(s.mobile, window.innerWidth, window.innerHeight) === 'portrait' ? s.sideSheet : !s.sidebar.hidden));
  return (
    <div className="top">
      {mobile && !phone && (
        <button type="button" className="insp-toggle side-toggle" data-on={sideOn ? '1' : '0'} aria-pressed={sideOn} aria-label="sidebar" onClick={toggleSidebar}>
          <Icon name="panel-left" />
        </button>
      )}
      <div className="ws"><b>{baseOf(root ?? '') || 'collection'}</b></div>
      {!phone && (
        <button type="button" className="palette" onClick={() => useApp.setState({ paletteOpen: true })}>
          <span className="g"><Glyph g="⌕" /></span>
          <span className="ph">open or run</span>
          <kbd>⌘k</kbd>
        </button>
      )}
      <div className="right">
        <span data-due={due ? '1' : '0'}>{due} due</span>
        <span>{dayLabel(appNow())}</span>
        {word !== null && (sync.conflicts.length
          ? <button type="button" className="sync" data-sync="conflicts" onClick={openConflicts}>{word}</button>
          : <span className="sync" data-sync={sync.busy ?? (sync.offline ? 'offline' : sync.toPush ? 'pending' : 'synced')}>{word}</span>)}
        {age !== null && <span className="ago">{age}</span>}
      </div>
      {!phone && (
        <button type="button" className="insp-toggle" data-on={shown ? '1' : '0'} aria-pressed={shown} title="inspector ⌘⇧I" onClick={toggleInspector}>
          <Icon name="panel" />
        </button>
      )}
    </div>
  );
}
