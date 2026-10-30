// A notebook: a document with `tabs: true` (`tabs.ts`) drawn with its tab
// rail on the left of the page, as Google Docs draws a document's tabs.
//
//  · the rail        about 200 px, its right edge dragged to resize (one width,
//                    remembered); the notebook first (its overview), then its
//                    children in their order (`.ilmi/order.json`), each a row
//                    with its glyph and title; a child's own children are
//                    subtabs, indented under it and folded by its chevron,
//                    three levels at most; extracts are never tabs: a tab's
//                    are one `n extracts` row under it, opening their folder lens
//  · outline         the active tab's headings (levels 1–3) under it, indented;
//                    a click scrolls the page to one; a click on the active tab
//                    hides or shows them
//  · click           shows that page in the same pane, the rail kept
//  · hover           `+` (a new note right after the row) and `···` (add
//                    subtab, rename, duplicate, move to…, delete); the
//                    selected row shows them too
//  · keys            the rail takes focus (a click on a row gives it): ↑↓ Home
//                    End → ← ⏎ F2 ⌘⌫ ⌥⌘↑↓ ⌥⌘← → and a letter, as the tree's
//                    (`treeModel.ts`); from the page ⌘⌥↑ / ⌘⌥↓ step to the
//                    page before / after (subtabs counted, extracts not)
//  · ⌃⌘T or «        folds the rail to a strip, » opens it; per notebook. Not
//                    ⌘⇧[, which is macOS's previous tab; ⌃⌘T is nothing in
//                    macOS, the native menu, or the app (⌃⌘S is the sidebar)
//  · + add tab       at the top: a new note, `untitled`, last, renamed in
//                    place; `▾` beside it: note, source, deck, draft, a file
//  · right-click     the node's menu (`NodeMenu.tsx`), with `add subtab`
//  · drag            the one drag model (`drag.ts`, `dnd.ts`), shared with the
//                    sidebar's tree and the folder lens, so a row crosses between
//                    them: 25 / 50 / 25, a line indented to where it lands; the
//                    overview takes only into, the deepest level never

import { Fragment, useEffect, useLayoutEffect, useMemo, useRef, useState, type KeyboardEvent as ReactKeyboardEvent, type MouseEvent, type PointerEvent as ReactPointerEvent, type ReactNode } from 'react';
import type { NodeType } from '../format/index.js';
import { childDirOf, isDoc } from '../vault/index.js';
import { geometry } from './dnd.js';
import { rowDrag, rowMark, useDrag, type Surface } from './drag.js';
import { importFiles } from './land.js';
import { GLYPH, descendants, findNode, kindOf, titleOf, type NodeKind } from './names.js';
import { NodeMenu, menuAt, placeMenu, type MenuAt } from './NodeMenu.js';
import type { OpenOpts } from './panes.js';
import { deleteNode } from './remove.js';
import { useApp } from './store.js';
import { RAIL_INDENT, RAIL_PAD, TAB_DEPTH, notebookPages, outline, railKeyPlace, railPad, railRows, stepPage, tabAncestors, type RailRow } from './tabs.js';
import { treeKey, typeahead } from './treeModel.js';
import { useDoc } from './useDoc.js';
import { createTab, noteAfter, placeNode, renameNode, setRailFolded, setRailWidth } from './vault.js';

interface Props {
  /** The notebook's path. */
  nb: string;
  /** The page shown: the notebook itself or a node under it. */
  page: string;
  /** In the active pane: the rail's keys apply. */
  active: boolean;
  onOpen(path: string, opts: OpenOpts): void;
  /** The page's lens. */
  children: ReactNode;
}

const ADD: [NodeType, string][] = [['note', 'note'], ['source', 'source'], ['deck', 'deck'], ['draft', 'draft']];
const inField = (t: EventTarget | null) => {
  const tag = (t as HTMLElement | null)?.tagName?.toLowerCase();
  return tag === 'input' || tag === 'textarea';
};
const plural = (n: number, word: string) => `${n} ${word}${n === 1 ? '' : 's'}`;

/** The fold key: ⌃⌘T, by the key's place (an Arabic layout presses the same key). */
export const isFoldKey = (e: { metaKey: boolean; ctrlKey: boolean; altKey: boolean; shiftKey: boolean; code?: string; key: string }): boolean =>
  e.metaKey && e.ctrlKey && !e.altKey && !e.shiftKey && (e.code === 'KeyT' || e.key.toLowerCase() === 't');

export function Notebook({ nb, page, active, onOpen, children }: Props) {
  const tree = useApp((s) => s.tree);
  const docs = useApp((s) => s.docs);
  const order = useApp((s) => s.order);
  const root = useApp((s) => s.vault);
  const folded = useApp((s) => !!s.railFolded[nb]);
  const width = useApp((s) => s.railWidth);
  const [open, setOpen] = useState<Record<string, true>>({});
  const [menu, setMenu] = useState<MenuAt | null>(null);
  const [plus, setPlus] = useState<{ x: number; y: number } | null>(null);
  const [editing, setEditing] = useState<{ id: string; value: string } | null>(null);
  const [selected, setSelectedState] = useState<string | null>(null);
  const selRef = useRef<string | null>(null);
  const setSelected = (p: string | null) => { selRef.current = p; setSelectedState(p); };
  const [asking, setAsking] = useState<string | null>(null);
  const [outlineOn, setOutlineOn] = useState(true);
  const typed = useRef({ buf: '', at: 0 });
  const drag = useDrag();
  const editRef = useRef<HTMLInputElement>(null);
  const plusRef = useRef<HTMLDivElement>(null);
  const boxRef = useRef<HTMLDivElement>(null);
  const navRef = useRef<HTMLElement>(null);
  const fail = (e: unknown) => console.error(e);
  const title = (path: string) => titleOf(path, docs, root);

  // the page's own tabs above it open, so the row that is showing is in view
  useEffect(() => {
    const up = tabAncestors(tree, nb, page);
    if (up.some((p) => !open[p])) setOpen((o) => { const n = { ...o }; for (const p of up) n[p] = true; return n; });
  }, [page, nb, tree]);
  // and scrolled into view, the focus left where it is
  useEffect(() => {
    setTimeout(() => boxRef.current?.querySelector<HTMLElement>(`.rail-row[data-path="${CSS.escape(page)}"]`)?.scrollIntoView?.({ block: 'nearest' }), 0);
  }, [page]);

  useEffect(() => {
    if (editing && editRef.current) {
      editRef.current.focus();
      editRef.current.select();
    }
  }, [editing?.id]);

  // keys from the page: ⌘⌥↑ ⌘⌥↓ step through the pages, ⌃⌘T folds the rail
  useEffect(() => {
    if (!active) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.defaultPrevented) return;
      if (isFoldKey(e)) {
        e.preventDefault();
        setRailFolded(nb, !useApp.getState().railFolded[nb]);
        return;
      }
      if ((e.metaKey || e.ctrlKey) && e.altKey && !e.shiftKey && (e.key === 'ArrowUp' || e.key === 'ArrowDown')) {
        e.preventDefault();
        const to = stepPage(notebookPages(tree, nb, order, docs), page, e.key === 'ArrowUp' ? -1 : 1);
        if (to) onOpen(to, {});
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [active, tree, nb, order, docs, page, onOpen]);

  // the `+` menu closes on any outside press or escape, and stays inside the window
  useEffect(() => {
    if (!plus) return;
    const close = () => setPlus(null);
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') setPlus(null); };
    window.addEventListener('mousedown', close);
    window.addEventListener('keydown', onKey);
    return () => {
      window.removeEventListener('mousedown', close);
      window.removeEventListener('keydown', onKey);
    };
  }, [plus]);
  useLayoutEffect(() => { placeMenu(plusRef.current); }, [plus]);

  const beginRename = (path: string) => {
    if (path === nb) return;
    setEditing({ id: path, value: title(path) });
  };
  const commitRename = () => {
    if (!editing) return;
    const { id, value } = editing;
    setEditing(null);
    if (value.trim() && value.trim() !== title(id)) renameNode(id, value).then((to) => { if (selRef.current === id) setSelected(to); }).catch(fail);
    boxRef.current?.focus();
  };
  const add = (dir: string, type: NodeType, name?: string) => { createTab(dir, type, name).then((p) => { setSelected(p); beginRename(p); }).catch(fail); };
  const subtab = (id: string) => {
    setOpen((o) => ({ ...o, [id]: true }));
    add(childDirOf(id), 'note', 'untitled');
  };
  const after = (id: string) => { noteAfter(id).then((p) => { setSelected(p); beginRename(p); }).catch(fail); };

  // the shared drag (`drag.ts`): a rested folded tab opens, a drop into a tab opens it
  const surf: Surface = useMemo(() => ({
    pad: RAIL_PAD - RAIL_INDENT,
    indent: RAIL_INDENT,
    scroller: '.rail-rows',
    spring: (p: string) => setOpen((o) => ({ ...o, [p]: true })),
    landed: (d) => { if (d.mode === 'into' && d.target !== nb && isDoc(d.target)) setOpen((o) => ({ ...o, [d.target]: true })); },
  }), [nb]);
  const rows = useMemo(() => railRows(tree, nb, order, open, docs), [tree, nb, order, open, docs]);
  const geoms = useMemo(() => geometry(rows, 1), [rows]);
  const kindAt = (path: string): NodeKind => (findNode(tree, path)?.kind === 'folder' ? 'folder' : kindOf(path, docs));

  // the active page's outline: its headings, when the page is read in the reader
  const pageKind = kindAt(page);
  const readerPage = isDoc(page) && pageKind !== 'deck' && !docs[page]?.pdf;
  const loaded = useDoc(readerPage ? page : null);
  const heads = useMemo(() => (readerPage && loaded?.path === page ? outline(loaded.doc.blocks) : []), [readerPage, loaded, page]);
  const scrollTo = (index: number) => {
    const hs = navRef.current?.parentElement?.querySelectorAll<HTMLElement>('.nb-page .dd-h');
    hs?.[index]?.scrollIntoView?.({ block: 'start' });
  };

  // ── keys, while the rail has focus ───────────────────────────
  const del = (id: string) => {
    const node = findNode(tree, id);
    if (!node) return;
    if (descendants(node) > 0 && asking !== id) { setAsking(id); return; }
    setAsking(null);
    const real = rows.filter((r) => !r.placeholder);
    const i = real.findIndex((r) => r.path === id);
    const next = real.slice(i + 1).find((r) => !r.path.startsWith(`${childDirOf(id)}/`)) ?? real[i - 1];
    setSelected(next?.path ?? null);
    deleteNode(id).catch(fail);
  };
  const onKey = (e: ReactKeyboardEvent<HTMLDivElement>) => {
    if (editing || inField(e.target)) return;
    const cur = selRef.current;
    const focus = cur !== null && rows.some((r) => r.path === cur && !r.placeholder) ? cur : rows.some((r) => r.path === page && !r.placeholder) ? page : null;
    const act = treeKey(rows, focus, e);
    if (asking !== null && act?.kind !== 'delete') setAsking(null);
    if (!act) return;
    e.preventDefault();
    e.stopPropagation();
    switch (act.kind) {
      case 'focus': setSelected(act.path); break;
      case 'fold': setOpen((o) => { const n = { ...o }; if (act.open) n[act.path] = true; else delete n[act.path]; return n; }); break;
      case 'activate': onOpen(act.path, {}); break;
      case 'rename': beginRename(act.path); break;
      case 'delete': del(act.path); break;
      case 'move': {
        const to = railKeyPlace(rows, act.path, act.to);
        if (to) {
          if (to.mode === 'into') setOpen((o) => ({ ...o, [to.target]: true }));
          placeNode(act.path, to.target, to.mode).then(setSelected).catch(fail);
        }
        break;
      }
      case 'type': {
        const t = Date.now();
        typed.current = { buf: t - typed.current.at < 700 ? typed.current.buf + act.char : act.char, at: t };
        const hit = typeahead(rows, focus, typed.current.buf, title);
        if (hit !== null) setSelected(hit);
        break;
      }
    }
  };

  // ── the edge: drag to resize ─────────────────────────────────
  const startResize = (e: ReactPointerEvent<HTMLDivElement>) => {
    e.preventDefault();
    const x0 = e.clientX;
    const w0 = width;
    const move = (ev: globalThis.PointerEvent) => setRailWidth(w0 + ev.clientX - x0);
    const up = () => {
      window.removeEventListener('pointermove', move);
      window.removeEventListener('pointerup', up);
      document.body.classList.remove('resizing');
    };
    document.body.classList.add('resizing');
    window.addEventListener('pointermove', move);
    window.addEventListener('pointerup', up);
  };

  if (!findNode(tree, nb)) return <>{children}</>;

  const rowMenu = (e: MouseEvent, id: string, tab: boolean) => {
    e.stopPropagation();
    setSelected(id);
    const r = e.currentTarget.getBoundingClientRect();
    setMenu({ ...menuAt({ clientX: r.left, clientY: r.bottom + 2 }, id), ...(tab ? { tab } : {}) });
  };
  const menuDepth = menu ? rows.find((r) => r.path === menu.id && !r.placeholder)?.depth ?? 0 : 0;

  const extractsRow = (r: RailRow, i: number) => {
    const key = r.key ?? r.path;
    const m = rowMark(drag, key, r.path, surf);
    const lit = page === r.path || (isDoc(page) && docs[page]?.type === 'extract' && page.startsWith(`${r.path}/`));
    return (
      <div
        key={key}
        className={`rail-row extracts${m.className ? ` ${m.className}` : ''}`}
        style={{ paddingLeft: railPad(r.depth) + 10, ...m.style }}
        data-path={r.path}
        data-active={lit ? '1' : '0'}
        role="treeitem"
        aria-level={r.depth}
        title="open them as a folder"
        {...rowDrag(geoms[i]!, surf, { draggable: false })}
        onClick={(e: MouseEvent) => onOpen(r.path, { cmdClick: e.metaKey || e.ctrlKey, shiftClick: e.shiftKey })}
      >
        <span className="glyph" data-t="extract">{GLYPH.extract}</span>
        <span className="name">{plural(r.extracts ?? 0, 'extract')}</span>
      </div>
    );
  };

  const tabRow = (r: RailRow, i: number) => {
    const kind = kindAt(r.path);
    const editingThis = editing?.id === r.path;
    const m = rowMark(drag, r.path, r.path, surf);
    const here = r.path === page;
    const node = findNode(tree, r.path);
    const asked = asking === r.path && node ? descendants(node) : 0;
    return (
      <div
        key={r.path}
        className={`rail-row${r.overview ? ' overview' : ''}${m.className ? ` ${m.className}` : ''}`}
        style={{ paddingLeft: railPad(r.depth), ...m.style }}
        data-path={r.path}
        data-kind={kind}
        data-active={here ? '1' : '0'}
        data-selected={selected === r.path ? '1' : '0'}
        role="treeitem"
        aria-level={r.depth + 1}
        aria-selected={selected === r.path}
        aria-expanded={r.has && !r.overview ? r.open : undefined}
        {...rowDrag(geoms[i]!, surf, { draggable: !r.overview && !editingThis, folded: r.has && !r.open })}
        onMouseDown={() => { setSelected(r.path); setAsking(null); }}
        onClick={(e: MouseEvent) => {
          if (editingThis) return;
          // the active tab clicked again hides or shows its outline, as Docs does
          if (here && heads.length) { setOutlineOn((v) => !v); return; }
          onOpen(r.path, { cmdClick: e.metaKey || e.ctrlKey, shiftClick: e.shiftKey });
        }}
        onDoubleClick={(e) => { e.stopPropagation(); beginRename(r.path); }}
        onContextMenu={(e) => { e.preventDefault(); e.stopPropagation(); setSelected(r.path); setMenu(menuAt(e, r.path)); }}
      >
        <span
          className="chev"
          onClick={(e) => {
            e.stopPropagation();
            if (r.has && !r.overview) setOpen((o) => { const n = { ...o }; if (n[r.path]) delete n[r.path]; else n[r.path] = true; return n; });
          }}
        >
          {r.has && !r.overview ? (r.open ? '▾' : '▸') : ''}
        </span>
        <span className="glyph" data-t={kind}>{GLYPH[kind]}</span>
        {editingThis ? (
          <input
            className="rename"
            ref={editRef}
            value={editing.value}
            spellCheck={false}
            onChange={(e) => setEditing({ id: r.path, value: e.target.value })}
            onMouseDown={(e) => e.stopPropagation()}
            onClick={(e) => e.stopPropagation()}
            onBlur={commitRename}
            onKeyDown={(e) => {
              if (e.key === 'Enter') { e.preventDefault(); commitRename(); }
              else if (e.key === 'Escape') { e.preventDefault(); setEditing(null); boxRef.current?.focus(); }
            }}
          />
        ) : (
          <span className="name">{title(r.path)}</span>
        )}
        {asked > 0 && <span className="asking">delete with {asked} inside? ⌘⌫</span>}
        {!r.overview && !editingThis && !asked && (
          <span className="row-acts" onMouseDown={(e) => e.stopPropagation()} onDoubleClick={(e) => e.stopPropagation()} onClick={(e) => e.stopPropagation()}>
            <span className="ra add" title="a note after this one" onClick={(e) => { e.stopPropagation(); after(r.path); }}>+</span>
            <span className="ra more" title="more" onClick={(e) => rowMenu(e, r.path, true)}>···</span>
          </span>
        )}
      </div>
    );
  };

  const outlineRows = (r: RailRow) => {
    if (!outlineOn || r.path !== page || !heads.length) return null;
    const top = Math.min(...heads.map((h) => h.level));
    return heads.map((h) => (
      <div
        key={`${r.path}\u0000h${h.index}`}
        className="rail-row heading"
        data-of={r.path}
        style={{ paddingLeft: railPad(r.depth) + 22 + (h.level - top) * RAIL_INDENT }}
        data-heading={h.index}
        data-level={h.level}
        title={h.text}
        onClick={() => scrollTo(h.index)}
      >
        <span className="name">{h.text}</span>
      </div>
    ));
  };

  return (
    <div className="notebook" data-folded={folded ? '1' : '0'}>
      {folded ? (
        <nav className="tab-rail folded" aria-label="tabs">
          <button type="button" className="rail-fold" title="show the tabs ⌃⌘T" onClick={() => setRailFolded(nb, false)}>»</button>
          <span className="rail-count" title={plural(rows.filter((r) => !r.overview && !r.placeholder).length, 'tab')}>{rows.filter((r) => !r.overview && !r.placeholder).length}</span>
        </nav>
      ) : (
        <nav className="tab-rail" aria-label="tabs" ref={navRef} style={{ width }}>
          <div className="rail-head">
            <button type="button" className="rail-add" title="a new note as a tab" onClick={() => add(childDirOf(nb), 'note', 'untitled')}>+ add tab</button>
            <button
              type="button"
              className="rail-more"
              title="a note, a source, a deck, a draft, or a file"
              onMouseDown={(e) => e.stopPropagation()}
              onClick={(e) => { const r = e.currentTarget.getBoundingClientRect(); setPlus(plus ? null : { x: r.left, y: r.bottom + 2 }); }}
            >▾</button>
            <button type="button" className="rail-fold" title="fold the tabs ⌃⌘T" onClick={() => setRailFolded(nb, true)}>«</button>
          </div>
          <div className="rail-rows" ref={boxRef} tabIndex={0} role="tree" aria-label="tabs" onKeyDown={onKey}>
            {rows.map((r, i) => (r.extracts !== undefined ? extractsRow(r, i) : <Fragment key={r.path}>{tabRow(r, i)}{outlineRows(r)}</Fragment>))}
          </div>
          <div className="rail-resize" title="drag to resize" onPointerDown={startResize} />
        </nav>
      )}
      <div className="pane-body nb-page" key={page}>{children}</div>
      {menu && (
        <NodeMenu
          at={menu}
          set={setMenu}
          onCreated={beginRename}
          onRename={beginRename}
          {...(menuDepth < TAB_DEPTH ? { onSubtab: subtab } : {})}
        />
      )}
      {plus && (
        <div className="ctx-menu rail-menu" ref={plusRef} style={{ left: plus.x, top: plus.y }} onMouseDown={(e) => e.stopPropagation()} onContextMenu={(e) => e.preventDefault()}>
          {ADD.map(([type, label]) => (
            <div key={type} className="ci" onClick={() => { setPlus(null); add(childDirOf(nb), type); }}>
              <span className="cg">{GLYPH[type]}</span>{label}
            </div>
          ))}
          <div className="cd" />
          <div className="ci" onClick={() => { setPlus(null); void importFiles(childDirOf(nb)).catch(fail); }}>
            <span className="cg">↧</span>import a file…
          </div>
        </div>
      )}
    </div>
  );
}
