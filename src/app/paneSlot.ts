// A pane's own rows, outside what scrolls in it. On a device a scroller pulled past its edge takes everything in
// it along, a bar that sticks to that edge too (the system's rubber band moves the scroller's whole content). A bar
// that is the pane's, not the page's, is therefore drawn outside the scroller there: over it (`pane-over`) or under
// it (`pane-under`), two rows `Canvas.tsx` gives every pane on a device. Anywhere else there are no such rows and
// the bar is drawn where it always was, sticking. (A book's rows over its pages are the same thing, `book-head`.)

import { useLayoutEffect, useState, type RefObject } from 'react';

/**
 * The row over or under the scroller of the pane `within` is in, once it is known; null where there is none (not a
 * device), or where `within` scrolls in something of its own inside the pane (a book's notes).
 */
export function usePaneSlot(within: RefObject<Element | null>, which: 'over' | 'under'): HTMLElement | null {
  const [slot, setSlot] = useState<HTMLElement | null>(null);
  useLayoutEffect(() => {
    const el = within.current;
    const pane = el && !el.closest('.book') ? el.closest('.pane') : null;
    setSlot(pane?.querySelector<HTMLElement>(`:scope > .pane-${which}`) ?? null);
  });
  return slot;
}
