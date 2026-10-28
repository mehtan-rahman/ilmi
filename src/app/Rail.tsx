// A notebook: a document with `tabs: true` (`tabs.ts`) drawn with its tab
// rail on the left of the page, as Google Docs draws a document's tabs.
//
//  · the rail        the notebook first (its overview), then its children in
//                    their order (`.ilmi/order.json`), each a row with its
//                    glyph and title; a child's own children are subtabs,
//                    indented under it and folded by its chevron
//  · click           shows that page in the same pane, the rail kept
//  · ⌘⌥↑ / ⌘⌥↓       the page before / after, subtabs counted
//  · ⌘⇧[ or «        folds the rail to a strip, » opens it; per notebook
//  · + tab           a new draft, `untitled`, last, renamed in place; `+`
//                    beside it: source, deck, draft, import a file…
//  · right-click     the node's menu (`NodeMenu.tsx`), with `add subtab`
//  · drag            the middle of a row nests inside it, its thirds place
//                    before and after (30's `place`); the overview takes into

import { useEffect, useLayoutEffect, useRef, useState, type DragEvent, type MouseEvent, type ReactNode } from 'react';
import type { NodeType } from '../format/index.js';
import { childDirOf, within } from '../vault/index.js';
import { importFiles } from './land.js';
import { GLYPH, findNode, kindOf, titleOf, type NodeKind } from './names.js';
import { NodeMenu, dropMode, menuAt, placeMenu, type DropMode, type MenuAt } from './NodeMenu.js';
import type { OpenOpts } from './panes.js';
import { useApp } from './store.js';
import { notebookPages, railRows, stepPage, tabAncestors } from './tabs.js';
import { createTab, placeNode, renameNode, setRailFolded } from './vault.js';

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

const ADD: [NodeType, string][] = [['source', 'source'], ['deck', 'deck'], ['draft', 'draft']];

export function Notebook({ nb, page, active, onOpen, children }: Props) {
  const tree = useApp((s) => s.tree);
  const docs = useApp((s) => s.docs);
  const order = useApp((s) => s.order);
  const root = useApp((s) => s.vault);
  const folded = useApp((s) => !!s.railFolded[nb]);
  const [open, setOpen] = useState<Record<string, true>>({});
  const [menu, setMenu] = useState<MenuAt | null>(null);
  const [plus, setPlus] = useState<{ x: number; y: number } | null>(null);
  const [editing, setEditing] = useState<{ id: string; value: string } | null>(null);
  const [drag, setDrag] = useState<string | null>(null);
  const [over, setOver] = useState<{ id: string; mode: DropMode } | null>(null);
  const editRef = useRef<HTMLInputElement>(null);
  const plusRef = useRef<HTMLDivElement>(null);
  const fail = (e: unknown) => console.error(e);
  const title = (path: string) => titleOf(path, docs, root);

  // the page's own tabs above it open, so the row that is showing is in view
  useEffect(() => {
    const up = tabAncestors(tree, nb, page);
    if (up.some((p) => !open[p])) setOpen((o) => { const n = { ...o }; for (const p of up) n[p] = true; return n; });
  }, [page, nb, tree]);

  useEffect(() => {
    if (editing && editRef.current) {
      editRef.current.focus();
      editRef.current.select();
    }
  }, [editing?.id]);

  // keys: ⌘⌥↑ ⌘⌥↓ step through the pages, ⌘⇧[ folds the rail
  useEffect(() => {
    if (!active) return;
    const onKey = (e: KeyboardEvent) => {
      if (!(e.metaKey || e.ctrlKey)) return;
      if (e.altKey && (e.key === 'ArrowUp' || e.key === 'ArrowDown')) {
        e.preventDefault();
        const to = stepPage(notebookPages(tree, nb, order), page, e.key === 'ArrowUp' ? -1 : 1);
        if (to) onOpen(to, {});
      } else if (e.shiftKey && !e.altKey && (e.code === 'BracketLeft' || e.key === '[' || e.key === '{')) {
        e.preventDefault();
        setRailFolded(nb, !useApp.getState().railFolded[nb]);
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [active, tree, nb, order, page, onOpen]);

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

  const beginRename = (path: string) => setEditing({ id: path, value: title(path) });
  const commitRename = () => {
    if (!editing) return;
    const { id, value } = editing;
    setEditing(null);
    if (value.trim() && value.trim() !== title(id)) renameNode(id, value).catch(fail);
  };
  const add = (dir: string, type: NodeType, name?: string) => { createTab(dir, type, name).then(beginRename).catch(fail); };
  const subtab = (id: string) => {
    setOpen((o) => ({ ...o, [id]: true }));
    add(childDirOf(id), 'draft', 'untitled');
  };

  const onDragOverRow = (e: DragEvent, id: string, overview: boolean) => {
    if (drag === null || drag === id || within(id, childDirOf(drag))) return;
    e.preventDefault();
    const r = e.currentTarget.getBoundingClientRect();
    const mode = dropMode(e.clientY - r.top, r.height, overview);
    if (!over || over.id !== id || over.mode !== mode) setOver({ id, mode });
  };
  const endDrag = () => { setDrag(null); setOver(null); };
  const onDrop = (e: DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (drag !== null && over) {
      if (over.mode === 'into' && over.id !== nb) setOpen((o) => ({ ...o, [over.id]: true }));
      placeNode(drag, over.id, over.mode).catch(fail);
    }
    endDrag();
  };

  if (!findNode(tree, nb)) return <>{children}</>;
  const rows = railRows(tree, nb, order, open);
  const kindAt = (path: string): NodeKind => (findNode(tree, path)?.kind === 'folder' ? 'folder' : kindOf(path, docs));

  return (
    <div className="notebook" data-folded={folded ? '1' : '0'}>
      {folded ? (
        <nav className="tab-rail folded" aria-label="tabs">
          <button type="button" className="rail-fold" title="show the tabs ⌘⇧[" onClick={() => setRailFolded(nb, false)}>»</button>
          <span className="rail-count" title={`${rows.length - 1} tabs`}>{rows.length - 1}</span>
        </nav>
      ) : (
        <nav className="tab-rail" aria-label="tabs">
          <div className="rail-head">
            <span>tabs</span>
            <button type="button" className="rail-fold" title="fold the tabs ⌘⇧[" onClick={() => setRailFolded(nb, true)}>«</button>
          </div>
          <div className="rail-rows">
            {rows.map((r) => {
              const kind = kindAt(r.path);
              const editingThis = editing?.id === r.path;
              return (
                <div
                  key={r.path}
                  className={`rail-row${r.overview ? ' overview' : ''}${over?.id === r.path ? ` drop-${over.mode}` : ''}`}
                  style={{ paddingLeft: 6 + r.depth * 14 }}
                  data-path={r.path}
                  data-kind={kind}
                  data-active={r.path === page ? '1' : '0'}
                  draggable={!r.overview && !editingThis}
                  onDragStart={(e) => { setDrag(r.path); e.dataTransfer.effectAllowed = 'move'; try { e.dataTransfer.setData('text/plain', r.path); } catch { /* not every host allows it */ } }}
                  onDragOver={(e) => onDragOverRow(e, r.path, r.overview)}
                  onDragLeave={() => { if (over?.id === r.path) setOver(null); }}
                  onDrop={onDrop}
                  onDragEnd={endDrag}
                  onClick={(e: MouseEvent) => { if (!editingThis) onOpen(r.path, { cmdClick: e.metaKey || e.ctrlKey, shiftClick: e.shiftKey }); }}
                  onDoubleClick={(e) => { e.stopPropagation(); if (!r.overview) beginRename(r.path); }}
                  onContextMenu={(e) => { e.preventDefault(); e.stopPropagation(); setMenu(menuAt(e, r.path)); }}
                >
                  <span
                    className="chev"
                    onClick={(e) => {
                      e.stopPropagation();
                      if (r.has) setOpen((o) => { const n = { ...o }; if (n[r.path]) delete n[r.path]; else n[r.path] = true; return n; });
                    }}
                  >
                    {r.has ? (open[r.path] ? '▾' : '▸') : ''}
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
                        else if (e.key === 'Escape') { e.preventDefault(); setEditing(null); }
                      }}
                    />
                  ) : (
                    <span className="name">{title(r.path)}</span>
                  )}
                </div>
              );
            })}
          </div>
          <div className="rail-foot">
            <button type="button" className="rail-add" onClick={() => add(childDirOf(nb), 'draft', 'untitled')}>+ tab</button>
            <button
              type="button"
              className="rail-more"
              title="a source, a deck, a draft, or a file"
              onMouseDown={(e) => e.stopPropagation()}
              onClick={(e) => { const r = e.currentTarget.getBoundingClientRect(); setPlus(plus ? null : { x: r.left, y: r.bottom + 2 }); }}
            >+</button>
          </div>
        </nav>
      )}
      <div className="pane-body nb-page" key={page}>{children}</div>
      {menu && <NodeMenu at={menu} set={setMenu} onCreated={beginRename} onRename={beginRename} onSubtab={subtab} />}
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
