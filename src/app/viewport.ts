// What of the glass can be seen: the window, less the keyboard on it. A
// popover placed against `window.innerHeight` opens under the keyboard on a
// phone and an iPad; these say where the visible part ends, and move a
// thing that was placed into it.

/** The y the visible part of the window ends at: the keyboard's top edge when it is up, else the window's foot. */
export function visibleBottom(): number {
  const vv = typeof window !== 'undefined' ? window.visualViewport : null;
  return vv ? Math.min(window.innerHeight, vv.offsetTop + vv.height) : window.innerHeight;
}

/**
 * How far a box must move to lie inside a view `w` wide that ends at `bottom`, `pad` kept clear at each edge: right
 * and bottom first, then left and top (a box larger than the view starts at its left and its top).
 */
export function intoView(r: { left: number; top: number; right: number; bottom: number }, w: number, bottom: number, pad = 6): { dx: number; dy: number } {
  let dx = 0;
  let dy = 0;
  if (r.right > w - pad) dx = w - pad - r.right;
  if (r.left + dx < pad) dx = pad - r.left;
  if (r.bottom > bottom - pad) dy = bottom - pad - r.bottom;
  if (r.top + dy < pad) dy = pad - r.top;
  return { dx, dy };
}

/** A thing placed by its `left` and `top` (fixed, in px) moved to lie in what can be seen, where it does not already. */
export function keepInView(el: HTMLElement, pad = 6): void {
  const r = el.getBoundingClientRect();
  if (r.width === 0 && r.height === 0) return;
  const { dx, dy } = intoView(r, window.innerWidth, visibleBottom(), pad);
  if (dx !== 0) el.style.left = `${Math.round((parseFloat(el.style.left) || 0) + dx)}px`;
  if (dy !== 0) el.style.top = `${Math.round((parseFloat(el.style.top) || 0) + dy)}px`;
}
