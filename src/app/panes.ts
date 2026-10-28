// Panes and tabs, as in the prototype's app.jsx: up to three panes side by
// side, each a row of tabs. A tab points at one vault path (a folder or a
// document); what it renders is decided at render time from the tree, so a
// rename or a type change on disk never leaves a tab stale. Pure functions;
// the store holds the value.

import { rekey } from '../vault/index.js';

export interface Tab {
  /** React key; survives re-targeting. */
  key: number;
  /** Vault-relative path. */
  id: string;
}

export interface Pane {
  tabs: Tab[];
  active: number;
}

export interface Panes {
  panes: Pane[];
  active: number;
}

export interface OpenOpts {
  /** Add a tab instead of replacing the active one. */
  newTab?: boolean;
  /** ⌘-click: a new tab in the active pane. */
  cmdClick?: boolean;
  /** ⌘⇧-click: a new tab in the next pane, split if there is none. */
  shiftClick?: boolean;
}

export const MAX_PANES = 3;

let nextKey = 1;
const tab = (id: string): Tab => ({ key: nextKey++, id });

export const emptyPanes = (): Panes => ({ panes: [{ tabs: [], active: 0 }], active: 0 });

const clone = (s: Panes): Panes => ({ panes: s.panes.map((p) => ({ tabs: [...p.tabs], active: p.active })), active: s.active });

export function activeTab(s: Panes): Tab | undefined {
  const pane = s.panes[s.active];
  return pane?.tabs[pane.active];
}

/**
 * Open `id`: focus it where it is already open, else replace the active tab,
 * or add one per `opts`. `same` names the tabs that are one tab with `id`
 * (the pages of one notebook, `tabs.ts`): the first of them, the active
 * pane's first, shows `id` in place, its key kept.
 */
export function openTab(s: Panes, id: string, opts: OpenOpts = {}, same?: (tabId: string) => boolean): Panes {
  const next = clone(s);
  for (let pi = 0; pi < next.panes.length; pi++) {
    const ti = next.panes[pi]!.tabs.findIndex((t) => t.id === id);
    if (ti >= 0) {
      next.panes[pi]!.active = ti;
      next.active = pi;
      return next;
    }
  }
  if (same) {
    const order = [next.active, ...next.panes.map((_, i) => i).filter((i) => i !== next.active)];
    for (const pi of order) {
      const p = next.panes[pi]!;
      const ti = p.tabs.findIndex((t) => same(t.id));
      if (ti >= 0) {
        p.tabs[ti] = { ...p.tabs[ti]!, id };
        p.active = ti;
        next.active = pi;
        return next;
      }
    }
  }
  if (opts.cmdClick && opts.shiftClick) {
    let target = next.active + 1;
    if (next.panes.length < MAX_PANES) next.panes.splice(target, 0, { tabs: [], active: 0 });
    else target %= next.panes.length;
    const pane = next.panes[target]!;
    pane.tabs.push(tab(id));
    pane.active = pane.tabs.length - 1;
    next.active = target;
    return next;
  }
  const pane = next.panes[next.active]!;
  if (opts.cmdClick || opts.newTab || pane.tabs.length === 0) {
    pane.tabs.push(tab(id));
    pane.active = pane.tabs.length - 1;
  } else {
    pane.tabs[pane.active] = tab(id);
  }
  return next;
}

export function selectTab(s: Panes, pane: number, index: number): Panes {
  const next = clone(s);
  const p = next.panes[pane];
  if (!p || index < 0 || index >= p.tabs.length) return s;
  p.active = index;
  next.active = pane;
  return next;
}

export function activatePane(s: Panes, pane: number): Panes {
  if (pane === s.active || pane < 0 || pane >= s.panes.length) return s;
  return { ...s, active: pane };
}

/** Close one tab. A pane left empty closes too, unless it is the last one. */
export function closeTab(s: Panes, pane: number, index: number): Panes {
  const next = clone(s);
  const p = next.panes[pane];
  if (!p || index < 0 || index >= p.tabs.length) return s;
  p.tabs.splice(index, 1);
  if (p.tabs.length === 0 && next.panes.length > 1) return closePane(next, pane);
  if (p.active >= p.tabs.length) p.active = Math.max(0, p.tabs.length - 1);
  else if (p.active > index) p.active -= 1;
  return next;
}

/** A new empty pane to the right of `pane`, up to three. */
export function splitPane(s: Panes, pane: number): Panes {
  if (s.panes.length >= MAX_PANES) return s;
  const next = clone(s);
  next.panes.splice(pane + 1, 0, { tabs: [], active: 0 });
  next.active = pane + 1;
  return next;
}

export function closePane(s: Panes, pane: number): Panes {
  if (s.panes.length <= 1 || pane < 0 || pane >= s.panes.length) return s;
  const panes = s.panes.filter((_, i) => i !== pane);
  return { panes, active: Math.min(s.active > pane ? s.active - 1 : s.active, panes.length - 1) };
}

/** After a rename or move on disk: tabs on the old path, or under it, follow. */
export function retarget(s: Panes, from: string, to: string): Panes {
  let touched = false;
  const panes = s.panes.map((p) => ({
    ...p,
    tabs: p.tabs.map((t) => {
      const id = rekey(t.id, from, to);
      if (id === null) return t;
      touched = true;
      return { ...t, id };
    }),
  }));
  return touched ? { ...s, panes } : s;
}

/** After a delete on disk: tabs on the path, or under it, close. */
export function dropTabs(s: Panes, path: string): Panes {
  let next = s;
  for (let pi = next.panes.length - 1; pi >= 0; pi--) {
    const p = next.panes[pi]!;
    for (let ti = p.tabs.length - 1; ti >= 0; ti--) {
      if (rekey(p.tabs[ti]!.id, path, path) !== null) next = closeTab(next, pi, ti);
    }
  }
  return next;
}
