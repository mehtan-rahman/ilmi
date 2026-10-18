// A plugin's two surfaces: a popover under a rectangle and a modal over the
// canvas, both styled as the palette (`plugins.css`). Plain DOM, one of
// each at a time; esc, a press outside, or `close()` ends it. No React, so
// the runtime's tests can open them in jsdom.

import type { Popover, Rect } from './api.js';

const GAP = 8;
const MARGIN = 8;

let openPopover: Popover | null = null;
let openModal: Popover | null = null;

function place(pop: HTMLElement, rect: Rect): void {
  const w = pop.offsetWidth || 320;
  const h = pop.offsetHeight || 160;
  const vw = window.innerWidth;
  const vh = window.innerHeight;
  let top = rect.bottom + GAP;
  if (top + h > vh - MARGIN) top = Math.max(MARGIN, rect.top - GAP - h);
  const left = Math.max(MARGIN, Math.min(rect.left, vw - w - MARGIN));
  pop.style.top = `${Math.round(top)}px`;
  pop.style.left = `${Math.round(left)}px`;
}

function surface(cls: string, el: HTMLElement, mount: (box: HTMLElement) => HTMLElement, onClose: () => void): Popover {
  const box = document.createElement('div');
  box.className = cls;
  box.tabIndex = -1;
  box.appendChild(el);
  const root = mount(box);
  let open = true;
  const close = () => {
    if (!open) return;
    open = false;
    window.removeEventListener('keydown', onKey, true);
    window.removeEventListener('mousedown', onDown, true);
    root.remove();
    onClose();
  };
  const onKey = (e: KeyboardEvent) => {
    if (e.key === 'Escape') {
      e.preventDefault();
      e.stopPropagation();
      close();
    }
  };
  const onDown = (e: MouseEvent) => {
    if (!box.contains(e.target as Node)) close();
  };
  // keys pressed inside stay inside: the plugin's own listeners on the box still run, the app's bare keys do not
  box.addEventListener('keydown', (e) => {
    if (!e.metaKey && !e.ctrlKey) e.stopPropagation();
  });
  // after this click settles, so the press that opened it does not close it
  setTimeout(() => {
    if (!open) return;
    window.addEventListener('keydown', onKey, true);
    window.addEventListener('mousedown', onDown, true);
  }, 0);
  box.focus({ preventScroll: true });
  return { el: box, close };
}

/** `el` under `rect`; the one before it closes. Placed again as its content grows, so a box filled later stays on screen. */
export function showPopover(rect: Rect, el: HTMLElement): Popover {
  openPopover?.close();
  let ro: ResizeObserver | null = null;
  const pop = surface('plug-pop', el, (box) => { document.body.appendChild(box); return box; }, () => {
    ro?.disconnect();
    if (openPopover === pop) openPopover = null;
  });
  place(pop.el, rect);
  if (typeof ResizeObserver !== 'undefined') {
    ro = new ResizeObserver(() => place(pop.el, rect));
    ro.observe(pop.el);
  }
  openPopover = pop;
  return pop;
}

/** `el` centered over a dimmed canvas; the one before it closes. */
export function showModal(el: HTMLElement): Popover {
  openModal?.close();
  const pop = surface('plug-modal', el, (box) => {
    const overlay = document.createElement('div');
    overlay.className = 'plug-overlay';
    overlay.appendChild(box);
    document.body.appendChild(overlay);
    return overlay;
  }, () => { if (openModal === pop) openModal = null; });
  openModal = pop;
  return pop;
}

/** Both surfaces, if open. */
export function closeSurfaces(): void {
  openPopover?.close();
  openModal?.close();
}

/** A plugin's `style.css` on the page, as one `<style>`; the disposer takes it off. */
export function addStyle(id: string, css: string): () => void {
  const el = document.createElement('style');
  el.dataset.plugin = id;
  el.textContent = css;
  document.head.appendChild(el);
  return () => el.remove();
}
