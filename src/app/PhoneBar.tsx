// The phone's foot (milestone 56), under the thumb: the one button with the
// tree and the palette behind it, the day, and `+` for a quick card. On the
// day the middle button enters the queue; anywhere else it comes back to it.

import { appNow } from './clock.js';
import { dueToday } from './items.js';
import { queueId } from './names.js';
import { activeTab } from './panes.js';
import { openQuickCard } from './quick.js';
import { useApp } from './store.js';
import { openNode, startSession, toggleSidebar } from './vault.js';

const TODAY = queueId('today');

export function PhoneBar() {
  const tab = useApp((s) => activeTab(s.panes)?.id);
  const sheet = useApp((s) => s.sideSheet);
  const due = useApp((s) => dueToday(s.queue, appNow(), s.budget).length);
  const home = tab === TODAY && !sheet;
  const day = () => {
    useApp.setState({ sideSheet: false });
    if (!home || !due) openNode(TODAY);
    else startSession();
  };
  return (
    <nav className="phone-bar">
      <button type="button" className="pb-more" data-on={sheet ? '1' : '0'} aria-pressed={sheet} aria-label="everything" onClick={toggleSidebar}>≡</button>
      <button type="button" className="pb-day" data-go={home && due ? '1' : '0'} onClick={day}>
        {home && due ? 'enter queue' : 'today'}{due > 0 && <span className="pb-n">{due}</span>}
      </button>
      <button type="button" className="pb-add" aria-label="new card" onClick={openQuickCard}>+</button>
    </nav>
  );
}
