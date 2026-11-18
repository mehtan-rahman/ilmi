// What closes leaves, as what opens arrives (`motion.css`). A menu, the
// palette, the settings, a notice, the sidebar's sheet and a folder's rows
// are taken out of the page by React the moment their state says so; this
// watches the page and, for those, puts a likeness back where the thing was
// for the fifth of a second it takes to go: faded, slid to its edge, or (a
// row) folded shut. The likeness is not the thing: it takes no press, has
// no path or id, and is gone when its animation ends. Nothing of the app's
// own state knows of it.
//
// Not under a smoke (`data-still`), on e-ink, or where the system asks for
// less motion.

/** What leaves with a likeness, and the longest it may stay (ms; its animation's end removes it sooner). */
const LEAVING: readonly [selector: string, ms: number][] = [
  ['.ctx-menu', 160],
  ['.palette-overlay', 160],
  ['.tweaks', 220],
  ['.notice', 220],
  ['.side[data-sheet="1"]', 300],
  ['.side-scrim', 300],
  ['.ink-pop', 160],
  ['.page-setup', 200],
];
const ROWS = '.trow, .rail-row';
const ROW_MS = 220;
/** More rows than this drawn at once are not a folder opened: they do not each unfold. */
const ROWS_IN_MAX = 40;
/** How long what was only just drawn keeps its rows still (ms). */
const FRESH_MS = 420;

/** `el` only just drawn: its rows do not unfold under it (`[data-fresh]` in `motion.css`). */
function fresh(el: HTMLElement): void {
  el.dataset.fresh = '1';
  setTimeout(() => { delete el.dataset.fresh; }, FRESH_MS);
}
/** More rows than this gone at once is not a folder closed: a collection changed, a filter typed. */
const ROWS_MAX = 80;
const ROW_H = 28;

const still = (): boolean => {
  const root = document.documentElement;
  return root.dataset.still === '1' || root.dataset.theme === 'eink' || (typeof matchMedia === 'function' && matchMedia('(prefers-reduced-motion: reduce)').matches);
};

/** Where each scroller stood, kept as it scrolls: an element out of the page no longer says. */
const scrolled = new WeakMap<Element, number>();

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

/** The scroll of the thing given to its likeness, once it is in the page. */
function scrollAs(of: Element, g: Element): void {
  const a = [of, ...Array.from(of.querySelectorAll('*'))];
  const b = [g, ...Array.from(g.querySelectorAll('*'))];
  for (let i = 0; i < a.length && i < b.length; i++) {
    const top = scrolled.get(a[i]!);
    if (top) b[i]!.scrollTop = top;
  }
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
  const onScroll = (e: Event) => { const t = e.target; if (t instanceof Element) scrolled.set(t, t.scrollTop); };
  document.addEventListener('scroll', onScroll, true);
  // the page at the open: its tree is drawn, not unfolded
  fresh(document.documentElement);
  const seen = new MutationObserver((records) => {
    if (still()) return;
    // what arrives whole (the sidebar's sheet, a tree of another collection, a filter's rows) keeps its rows still
    let rowsIn = 0;
    for (const r of records) {
      for (const node of Array.from(r.addedNodes)) {
        if (!(node instanceof HTMLElement) || node.dataset.ghost) continue;
        if (node.matches('.side, .tree, .tab-rail') || node.querySelector('.tree, .tab-rail')) fresh(node);
        else if (node.matches(ROWS)) rowsIn += 1;
      }
    }
    if (rowsIn > ROWS_IN_MAX) for (const t of Array.from(document.querySelectorAll<HTMLElement>('.tree, .tab-rail'))) fresh(t);
    // what stands for a thing that went, and the last likeness put after a thing that stayed: rows go one by one, in order
    const ghostOf = new Map<Node, HTMLElement>();
    const lastAfter = new Map<Node, HTMLElement>();
    const rows = records.reduce((n, r) => n + Array.from(r.removedNodes).filter((x) => x instanceof HTMLElement && x.matches(ROWS)).length, 0);
    for (const r of records) {
      const parent = r.target;
      if (!(parent instanceof Element) || !parent.isConnected || parent.closest('[data-ghost]')) continue;
      for (const node of Array.from(r.removedNodes)) {
        if (!(node instanceof HTMLElement) || node.isConnected || node.dataset.ghost) continue;
        const row = node.matches(ROWS);
        const kind = row ? null : LEAVING.find(([sel]) => node.matches(sel));
        if (!row && !kind) continue;
        if (row) {
          if (rows > ROWS_MAX) continue;
          // a row drawn again elsewhere (renamed, moved, sorted) has not gone
          const path = node.dataset.path;
          if (path && parent.querySelector(`[data-path="${CSS.escape(path)}"]`)) continue;
        }
        const g = likeness(node);
        const prev = r.previousSibling;
        const next = r.nextSibling;
        const after = prev ? (prev.isConnected ? prev : ghostOf.get(prev)) : null;
        if (prev === null) {
          const last = lastAfter.get(parent);
          if (last?.isConnected) last.after(g); else parent.prepend(g);
          lastAfter.set(parent, g);
        } else if (after?.isConnected && after.parentNode === parent) {
          const last = lastAfter.get(after);
          (last?.isConnected ? last : (after as ChildNode)).after(g);
          lastAfter.set(after, g);
        } else {
          const before = next ? (next.isConnected ? next : ghostOf.get(next)) : null;
          if (before?.isConnected && before.parentNode === parent) (before as ChildNode).before(g);
          else if (!row) parent.append(g);
          else continue;
        }
        ghostOf.set(node, g);
        scrollAs(node, g);
        if (row) {
          const live = Array.from(parent.children).find((c): c is HTMLElement => c instanceof HTMLElement && c.matches(ROWS) && !c.dataset.ghost);
          g.style.setProperty('--row-h', `${live?.offsetHeight || ROW_H}px`);
          g.classList.add('m-row-out');
          leave(g, ROW_MS);
        } else {
          g.classList.add('m-out');
          leave(g, kind![1]);
        }
      }
    }
  });
  seen.observe(document.body, { childList: true, subtree: true });
  return () => { seen.disconnect(); document.removeEventListener('scroll', onScroll, true); };
}
