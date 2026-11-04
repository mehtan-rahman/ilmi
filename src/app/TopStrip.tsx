// The top strip: the vault's name, the palette, what is due, the day, where
// sync stands (`synced`, `3 to push`, `pulling…`, `offline`, `2 conflicts`;
// nothing when the vault has no remote), and the inspector toggle. After
// the prototype's chrome.jsx, with its counts trimmed to the one that
// matters: the day's work, above the fold.

import { baseOf } from '../vault/index.js';
import { dayLabel, dueToday } from './items.js';
import { useApp } from './store.js';
import { toggleInspector } from './vault.js';
import { inspectorShown } from './layout.js';
import { appNow } from './clock.js';
import { openConflicts, syncWord } from './sync.js';

export function TopStrip() {
  const root = useApp((s) => s.vault);
  const queue = useApp((s) => s.queue);
  // drawn or not by the room rule (`layout.ts`); App draws this strip again on a resize
  const shown = useApp((s) => inspectorShown(s, window.innerWidth));
  const budget = useApp((s) => s.budget);
  const due = dueToday(queue, appNow(), budget).length;
  const sync = useApp((s) => s.sync);
  const word = syncWord(sync);
  return (
    <div className="top">
      <div className="ws"><b>{baseOf(root ?? '') || 'collection'}</b></div>
      <button type="button" className="palette" onClick={() => useApp.setState({ paletteOpen: true })}>
        <span className="g">⌕</span>
        <kbd>⌘k</kbd>
      </button>
      <div className="right">
        <span data-due={due ? '1' : '0'}>{due} due</span>
        <span>{dayLabel(appNow())}</span>
        {word !== null && (sync.conflicts.length
          ? <button type="button" className="sync" data-sync="conflicts" onClick={openConflicts}>{word}</button>
          : <span className="sync" data-sync={sync.busy ?? (sync.offline ? 'offline' : sync.toPush ? 'pending' : 'synced')}>{word}</span>)}
      </div>
      <button type="button" className="insp-toggle" data-on={shown ? '1' : '0'} aria-pressed={shown} title="inspector ⌘⇧I" onClick={toggleInspector}>
        <span className="panel-ico" />
      </button>
    </div>
  );
}
