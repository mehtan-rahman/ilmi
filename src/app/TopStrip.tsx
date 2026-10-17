// The top strip: the vault's name, the palette, what is due, the day, and
// the inspector toggle. After the prototype's chrome.jsx, with its counts
// trimmed to the one that matters: the day's work, above the fold.

import { baseOf } from '../vault/index.js';
import { dayLabel, dueToday } from './items.js';
import { useApp } from './store.js';
import { setInspector } from './vault.js';

export function TopStrip() {
  const root = useApp((s) => s.vault);
  const queue = useApp((s) => s.queue);
  const inspector = useApp((s) => s.inspector);
  const budget = useApp((s) => s.budget);
  const due = dueToday(queue, new Date(), budget).length;
  return (
    <div className="top">
      <div className="ws"><b>{baseOf(root ?? '') || 'vault'}</b></div>
      <button type="button" className="palette" onClick={() => useApp.setState({ paletteOpen: true })}>
        <span className="g">⌕</span>
        <kbd>⌘k</kbd>
      </button>
      <div className="right">
        <span data-due={due ? '1' : '0'}>{due} due</span>
        <span>{dayLabel(new Date())}</span>
      </div>
      <button type="button" className="insp-toggle" data-on={inspector.open ? '1' : '0'} aria-pressed={inspector.open} onClick={() => setInspector({ open: !inspector.open })}>
        <span className="panel-ico" />
      </button>
    </div>
  );
}
