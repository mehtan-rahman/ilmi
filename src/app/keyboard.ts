// The keyboard on the glass put away by the finger. There is no bar over
// it (the web view's `previous · next · done` is taken off, `InkPlugin`'s
// `load`: it lay over what the app puts on the keyboard), and a phone's
// keyboard has no key that hides it; so, as in the system's own apps, a
// finger drawn down the page and on onto the keyboard takes it away. The
// field it was typing in is let go of, which is all it takes. A drag that
// stays on the page is the page's scroll and changes nothing.

import { keyboardDismissed } from './gesture.js';

let from: number | null = null;

function start(e: TouchEvent): void {
  const t = e.touches[0];
  from = t && e.touches.length === 1 && document.documentElement.hasAttribute('data-keyboard') ? t.clientY : null;
}

function move(e: TouchEvent): void {
  const t = e.touches[0];
  const vv = window.visualViewport;
  if (from === null || !t || !vv) return;
  if (!keyboardDismissed(from, t.clientY, vv.offsetTop + vv.height)) return;
  from = null;
  const on = document.activeElement;
  if (on instanceof HTMLElement && on !== document.body) on.blur();
}

// the settings are as tall as what the keyboard leaves (`phone.css`): the field that brought the keyboard up is
// brought into what is left, once the panel has its new height
function shown(): void {
  requestAnimationFrame(() => {
    const on = document.activeElement;
    if (document.documentElement.hasAttribute('data-keyboard') && on instanceof HTMLElement && on.closest('.tweaks')) on.scrollIntoView({ block: 'center' });
  });
}

/** The keyboard follows a finger drawn down onto it from now on. Resolves to a stop. */
export function installKeyboardDrag(): () => void {
  const end = () => { from = null; };
  window.visualViewport?.addEventListener('resize', shown);
  window.addEventListener('touchstart', start, { passive: true });
  window.addEventListener('touchmove', move, { passive: true });
  window.addEventListener('touchend', end, { passive: true });
  window.addEventListener('touchcancel', end, { passive: true });
  return () => {
    window.removeEventListener('touchstart', start);
    window.removeEventListener('touchmove', move);
    window.removeEventListener('touchend', end);
    window.removeEventListener('touchcancel', end);
    window.visualViewport?.removeEventListener('resize', shown);
    from = null;
  };
}
