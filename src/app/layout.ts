// Room for the page (milestone 40). Four columns can sit side by side: the
// sidebar, a notebook's tab rail, the page, the inspector. The rule: the
// reading measure never goes below MEASURE_MIN; when the window cannot give
// every pane that much beside the sidebar, its rail, and the inspector, the
// inspector yields first. It stays open in the saved state and comes back
// when the window widens or the rail folds; ⌘⇧I (or the top strip's toggle)
// shows it anyway, until it is closed again. The sidebar and the rail are
// the user's own, and never close by themselves.

import type { Panes } from './panes.js';
import type { DocInfo } from './store.js';
import { notebookOf } from './tabs.js';

/** The narrowest reading measure a pane keeps before the inspector yields. */
export const MEASURE_MIN = 560;
/** The page's side padding in its pane (`.reader-wrap`, 24 px each side). */
export const PAGE_PAD = 48;

/** The rail's width beside each pane's page: 0 where its active tab is no notebook page or the rail is folded. */
export function railsOf(panes: Panes, docs: Record<string, DocInfo>, folded: Record<string, true>, railWidth: number): number[] {
  return panes.panes.map((p) => {
    const id = p.tabs[p.active]?.id;
    if (id === undefined || id.startsWith(':')) return 0;
    const nb = notebookOf(id, docs);
    return nb !== null && !folded[nb] ? railWidth : 0;
  });
}

/** Whether every pane keeps its measure with the inspector beside them. */
export function inspectorFits(win: number, side: number, insp: number, rails: readonly number[]): boolean {
  const n = Math.max(1, rails.length);
  const each = (win - side - insp) / n;
  return (rails.length ? rails : [0]).every((r) => each - r - PAGE_PAD >= MEASURE_MIN);
}

interface LayoutState {
  sidebar: { width: number; hidden: boolean };
  inspector: { width: number; open: boolean };
  inspForced: boolean;
  panes: Panes;
  docs: Record<string, DocInfo>;
  railFolded: Record<string, true>;
  railWidth: number;
}

/** Whether the inspector is drawn: open, and it fits or was asked for. */
export function inspectorShown(s: LayoutState, win: number): boolean {
  if (!s.inspector.open) return false;
  if (s.inspForced) return true;
  const side = s.sidebar.hidden ? 0 : s.sidebar.width;
  return inspectorFits(win, side, s.inspector.width, railsOf(s.panes, s.docs, s.railFolded, s.railWidth));
}
