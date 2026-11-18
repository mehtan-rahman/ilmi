// The phone's foot (milestone 56), under the thumb: the one button with the
// tree and the palette behind it, the day, and `+` for a quick card. On the
// day the middle button enters the queue (what it shows: the focus, when
// one is on); anywhere else it comes back to it.

import { appNow } from './clock.js';
import { dueToday, walkOf } from './items.js';
import { queueId } from './names.js';
import { activeTab } from './panes.js';
import { openQuickCard } from './quick.js';
import { useApp } from './store.js';
import { openNode, startSession, toggleSidebar } from './vault.js';
import { Glyph, Icon } from './icons.js';

const TODAY = queueId('today');

export function PhoneBar({ under = false }: { under?: boolean }) {
  const tab = useApp((s) => activeTab(s.panes)?.id);
  const sheet = useApp((s) => s.sideSheet);
  const due = useApp((s) => dueToday(s.queue, appNow(), s.budget).length);
  const focus = useApp((s) => s.queueFocus);
  // where sync stands is in the sheet (a phone has no strip): what wants looking at there is marked on the button to it
  const alert = useApp((s) => s.sync.on && (s.sync.conflicts.length > 0 || !!s.sync.gone));
  // what entering would walk: the day, or the one thing to do it is narrowed to
  const walk = useApp((s) => walkOf(s.queue, appNow(), s.budget, null, s.queueFocus, s.focusBudget).length);
  const home = tab === TODAY && !sheet;
  const go = home && walk > 0;
  const day = () => {
    useApp.setState({ sideSheet: false });
    if (!go) openNode(TODAY);
    else startSession({}, null, focus);
  };
  return (
    <nav className="phone-bar" aria-hidden={under ? true : undefined}>
      <button type="button" className="pb-more" data-on={sheet ? '1' : '0'} data-alert={alert ? '1' : undefined} aria-pressed={sheet} aria-label="everything" onClick={toggleSidebar}><Icon name="menu" /><span className="gch">≡</span></button>
      <button type="button" className="pb-day" data-go={go ? '1' : '0'} onClick={day}>
        <span className="pb-w">{go ? 'enter queue' : 'today'}</span>{(go ? walk : due) > 0 && <span className="pb-n">{go ? walk : due}</span>}
      </button>
      <button type="button" className="pb-add" aria-label="new card" onClick={openQuickCard}><Glyph g="+" /></button>
    </nav>
  );
}
