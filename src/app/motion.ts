// What closes leaves, as what opens arrives (`motion.css`). A menu, the
// palette, the settings and a notice are taken out of
// the page by React the moment their state says so; this watches the page
// and, for those few small things, puts a likeness back where the thing was
// for the tenth of a second it takes to fade. The likeness is not the
// thing: it takes no press, has no path or id, and is gone when its
// animation ends. Nothing of the app's own state knows of it.
//
// Only small overlays: the sidebar's sheet and a folder's rows close at
// once (a likeness of a whole tree, or a row's height folding, made the
// page stutter). Not under a smoke (`data-still`), on e-ink, or where the
// system asks for less motion.

import { useEffect, useState } from 'react';

/** What leaves with a likeness, and the longest it may stay (ms; its animation's end removes it sooner). */
const LEAVING: readonly [selector: string, ms: number][] = [
  ['.ctx-menu', 120],
  ['.palette-overlay', 120],
  ['.tweaks', 180],
  ['.notice', 140],
  ['.ink-pop', 120],
  ['.page-setup', 120],
];

export const still = (): boolean => {
  const root = document.documentElement;
  return root.dataset.still === '1' || root.dataset.theme === 'eink' || (typeof matchMedia === 'function' && matchMedia('(prefers-reduced-motion: reduce)').matches);
};

/** Nothing follows a finger or settles: a smoke, a test, e-ink, or less motion asked for. What would have moved is where it ends at once. */
export const quiet = (): boolean => import.meta.env.MODE === 'test' || still();

/**
 * True while `on` is, and for `ms` after: what closes stays in the page that long, to leave (the sidebar's sheet,
 * which is too large for a likeness). At once under a smoke, on e-ink, in a test, or where less motion is asked.
 */
export function useLinger(on: boolean, ms: number): boolean {
  const [held, setHeld] = useState(on);
  useEffect(() => {
    if (on) { setHeld(true); return; }
    const t = setTimeout(() => setHeld(false), ms);
    return () => clearTimeout(t);
  }, [on, ms]);
  return on || (held && import.meta.env.MODE !== 'test' && !still());
}

function likeness(of: Element): HTMLElement {
  const g = of.cloneNode(true) as HTMLElement;
  g.dataset.ghost = '1';
  g.setAttribute('aria-hidden', 'true');
  g.setAttribute('inert', '');
  for (const el of [g, ...Array.from(g.querySelectorAll<HTMLElement>('[id], [data-path]'))]) {
    el.removeAttribute('id');
    el.removeAttribute('data-path');
  }
  return g;
}

function leave(g: HTMLElement, ms: number): void {
  let gone = false;
  const go = () => { if (!gone) { gone = true; g.remove(); } };
  g.addEventListener('animationend', (e) => { if (e.target === g) go(); });
  setTimeout(go, ms + 80);
}

/** The page watched from now on. Resolves to a stop. */
export function startMotion(): () => void {
  if (typeof MutationObserver !== 'function') return () => {};
  const seen = new MutationObserver((records) => {
    for (const r of records) {
      if (r.removedNodes.length === 0) continue;
      const parent = r.target;
      if (!(parent instanceof Element) || !parent.isConnected) continue;
      for (const node of Array.from(r.removedNodes)) {
        if (!(node instanceof HTMLElement) || node.isConnected || node.dataset.ghost) continue;
        const kind = LEAVING.find(([sel]) => node.matches(sel));
        if (!kind || still() || parent.closest('[data-ghost]')) continue;
        const g = likeness(node);
        const next = r.nextSibling;
        if (next && next.isConnected && next.parentNode === parent) (next as ChildNode).before(g);
        else parent.append(g);
        g.classList.add('m-out');
        leave(g, kind[1]);
      }
    }
  });
  // direct children of the shell and the body are where these overlays live; the subtree is watched because menus open inside panes
  seen.observe(document.body, { childList: true, subtree: true });
  return () => seen.disconnect();
}
