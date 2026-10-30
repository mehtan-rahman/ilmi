// A small menu at a point, drawn as the context menu is (`.ctx-menu`), for
// what a node view offers: a table cell's rows and columns, a code block's
// language. Plain DOM, since the node views are not React; one open at a
// time, closed by a pick, Escape, or a press anywhere else.

export interface PopItem {
  /** `'-'` draws a divider. */
  label: string;
  glyph?: string;
  /** Lit as the current choice. */
  on?: boolean;
  danger?: boolean;
  /** Its `data-act`, for a smoke to find it by. */
  act?: string;
  run?: () => void;
}

let open: { el: HTMLElement; close: () => void } | null = null;

/** Close the open menu, if any. */
export function closePopMenu(): void {
  open?.close();
}

/** Is a menu open now? */
export const popMenuOpen = (): HTMLElement | null => open?.el ?? null;

/** Open a menu of `items` under the box `at` (a button's rect), kept inside the window. */
export function popMenu(at: { left: number; bottom: number; top: number }, items: PopItem[], cls = ''): HTMLElement {
  closePopMenu();
  const el = document.createElement('div');
  el.className = `ctx-menu pop-menu${cls ? ` ${cls}` : ''}`;
  el.setAttribute('role', 'menu');
  for (const it of items) {
    if (it.label === '-') {
      const d = document.createElement('div');
      d.className = 'cd';
      el.append(d);
      continue;
    }
    const row = document.createElement('div');
    row.className = `ci${it.danger ? ' danger' : ''}${it.on ? ' on' : ''}`;
    row.setAttribute('role', 'menuitem');
    if (it.act) row.dataset.act = it.act;
    const g = document.createElement('span');
    g.className = 'cg';
    g.textContent = it.glyph ?? (it.on ? '✓' : '');
    row.append(g, document.createTextNode(it.label));
    row.addEventListener('mousedown', (e) => { e.preventDefault(); e.stopPropagation(); });
    row.addEventListener('click', (e) => {
      e.stopPropagation();
      close();
      it.run?.();
    });
    el.append(row);
  }
  el.style.left = `${Math.round(at.left)}px`;
  el.style.top = `${Math.round(at.bottom + 4)}px`;
  document.body.append(el);
  // inside the window: above the button when there is no room below, never past the right edge
  const r = el.getBoundingClientRect();
  if (r.bottom > window.innerHeight - 4 && at.top - r.height - 4 > 0) el.style.top = `${Math.round(at.top - r.height - 4)}px`;
  if (r.right > window.innerWidth - 4) el.style.left = `${Math.max(4, Math.round(window.innerWidth - r.width - 4))}px`;
  const outside = (e: MouseEvent) => { if (!el.contains(e.target as Node)) close(); };
  const key = (e: KeyboardEvent) => { if (e.key === 'Escape') { e.preventDefault(); e.stopPropagation(); close(); } };
  function close() {
    document.removeEventListener('mousedown', outside, true);
    window.removeEventListener('keydown', key, true);
    el.remove();
    if (open?.el === el) open = null;
  }
  // the press that opened it is over by the time this listens
  setTimeout(() => document.addEventListener('mousedown', outside, true), 0);
  window.addEventListener('keydown', key, true);
  open = { el, close };
  return el;
}
