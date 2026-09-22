// The workspace tree: the vault rendered as rows you can open, rename, move,
// and delete. Every edit goes to disk through src/app/vault.ts and comes
// back through the vault's events; this component keeps only what is
// mid-gesture (a rename in progress, a drag, the open menu).
//
//  · click            open the node as a lens; the chevron alone folds
//  · dbl-click / F2   inline rename
//  · right-click      new source / folder / deck / draft, rename, move to…, delete
//  · drag             drop between rows to move beside them, or onto a folder to move inside

import { Fragment, useEffect, useRef, useState, type DragEvent, type MouseEvent, type ReactNode } from 'react';
import type { NodeType } from '../format/index.js';
import { childDirOf, dirOf, within, type TreeNode } from '../vault/index.js';
import { GLYPH, findNode, folderPaths, kindOf, metaOf, titleOf, type NodeKind } from './names.js';
import type { OpenOpts } from './panes.js';
import { useApp } from './store.js';
import { containerOf, createNode, moveNode, removeNode, renameNode, toggleOpen } from './vault.js';

interface Props {
  /** Path of the node the active tab shows. */
  activeId: string | undefined;
  onOpen(path: string, opts: OpenOpts): void;
}

interface Editing { id: string; value: string }
interface Menu { id: string; x: number; y: number; sub: boolean }
type DropMode = 'before' | 'after' | 'into';
interface Over { id: string; mode: DropMode }

const NEW_KINDS: [NodeKind, string][] = [
  ['source', 'new source'],
  ['folder', 'new folder'],
  ['deck', 'new deck'],
  ['draft', 'new draft'],
];

const MENU_W = 190;

const clickOpts = (e: MouseEvent): OpenOpts => ({ cmdClick: e.metaKey || e.ctrlKey, shiftClick: e.shiftKey });
const inField = (t: EventTarget | null) => {
  const tag = (t as HTMLElement | null)?.tagName?.toLowerCase();
  return tag === 'input' || tag === 'textarea';
};

export function Tree({ activeId, onOpen }: Props) {
  const tree = useApp((s) => s.tree);
  const docs = useApp((s) => s.docs);
  const open = useApp((s) => s.open);
  const root = useApp((s) => s.vault);
  const [editing, setEditing] = useState<Editing | null>(null);
  const [menu, setMenu] = useState<Menu | null>(null);
  const [drag, setDrag] = useState<string | null>(null);
  const [over, setOver] = useState<Over | null>(null);
  const [selected, setSelected] = useState<string | null>(null);
  const editRef = useRef<HTMLInputElement>(null);
  const now = new Date();

  const title = (path: string) => titleOf(path, docs, root);
  const fail = (e: unknown) => console.error(e);

  useEffect(() => {
    if (editing && editRef.current) {
      editRef.current.focus();
      editRef.current.select();
    }
  }, [editing?.id]);

  // the menu closes on any outside press or escape
  useEffect(() => {
    if (!menu) return;
    const close = () => setMenu(null);
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') setMenu(null); };
    window.addEventListener('mousedown', close);
    window.addEventListener('keydown', onKey);
    return () => {
      window.removeEventListener('mousedown', close);
      window.removeEventListener('keydown', onKey);
    };
  }, [menu]);

  const beginRename = (id: string) => {
    if (id === '') return;
    setEditing({ id, value: title(id) });
  };

  // F2 renames the selected row, else the active tab's node
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== 'F2' || editing || inField(e.target)) return;
      const id = selected ?? activeId;
      if (id === undefined || id === '' || !findNode(tree, id)) return;
      e.preventDefault();
      beginRename(id);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [selected, activeId, editing, tree]);

  const commitRename = () => {
    if (!editing) return;
    const { id, value } = editing;
    setEditing(null);
    if (value.trim() && value.trim() !== title(id)) renameNode(id, value).catch(fail);
  };

  const openMenu = (e: MouseEvent, id: string) => {
    e.preventDefault();
    e.stopPropagation();
    setMenu({ id, x: Math.min(e.clientX, window.innerWidth - MENU_W), y: e.clientY, sub: false });
  };

  // ── drag + drop ──────────────────────────────────────────────
  const onDragStart = (e: DragEvent, id: string) => {
    setDrag(id);
    e.dataTransfer.effectAllowed = 'move';
    try { e.dataTransfer.setData('text/plain', id); } catch { /* not every host allows it */ }
  };
  const onDragOverRow = (e: DragEvent, id: string, folder: boolean) => {
    if (drag === null || drag === id || within(id, childDirOf(drag))) return;
    e.preventDefault();
    const r = e.currentTarget.getBoundingClientRect();
    const y = e.clientY - r.top;
    let mode: DropMode;
    if (id === '') mode = 'into';
    else if (folder) mode = y < r.height * 0.32 ? 'before' : y > r.height * 0.68 ? 'after' : 'into';
    else mode = y < r.height * 0.5 ? 'before' : 'after';
    if (!over || over.id !== id || over.mode !== mode) setOver({ id, mode });
  };
  const onDropRow = (e: DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (drag !== null && over) moveNode(drag, over.mode === 'into' ? over.id : dirOf(over.id)).catch(fail);
    setDrag(null);
    setOver(null);
  };
  const endDrag = () => { setDrag(null); setOver(null); };
  const overCls = (id: string) => (over && over.id === id ? `drop-${over.mode}` : '');

  // ── one row ──────────────────────────────────────────────────
  const row = (id: string, depth: number, kind: NodeKind, chev: ReactNode, meta: string, due: boolean, onClick: (e: MouseEvent) => void) => {
    const editingThis = editing?.id === id;
    return (
      <div
        key={id}
        className={`row trow ${overCls(id)}`}
        style={{ paddingLeft: 6 + depth * 13 }}
        data-kind={kind}
        data-active={activeId === id ? '1' : '0'}
        draggable={id !== '' && !editingThis}
        onDragStart={(e) => onDragStart(e, id)}
        onDragOver={(e) => onDragOverRow(e, id, kind === 'folder')}
        onDragLeave={() => { if (over?.id === id) setOver(null); }}
        onDrop={onDropRow}
        onDragEnd={endDrag}
        onContextMenu={(e) => openMenu(e, id)}
        onMouseDown={() => setSelected(id)}
        onDoubleClick={(e) => { e.stopPropagation(); beginRename(id); }}
        onClick={onClick}
      >
        {chev}
        <span className={`glyph ${kind}${id === '' ? ' root' : ''}`}>{GLYPH[kind]}</span>
        {editingThis ? (
          <input
            className="rename"
            ref={editRef}
            value={editing.value}
            onChange={(e) => setEditing({ id, value: e.target.value })}
            onMouseDown={(e) => e.stopPropagation()}
            onClick={(e) => e.stopPropagation()}
            onBlur={commitRename}
            onKeyDown={(e) => {
              if (e.key === 'Enter') { e.preventDefault(); commitRename(); }
              else if (e.key === 'Escape') { e.preventDefault(); setEditing(null); }
            }}
          />
        ) : (
          <span className="name">{title(id)}</span>
        )}
        {meta && <span className="meta" data-due={due ? '1' : '0'}>{meta}</span>}
      </div>
    );
  };

  const chevron = (id: string, has: boolean) => (
    <span className="chev" onClick={(e) => { e.stopPropagation(); if (has) toggleOpen(id); }}>
      {has ? (open[id] ? '▾' : '▸') : ''}
    </span>
  );

  const renderNode = (node: TreeNode, depth: number): ReactNode => {
    const id = node.path;
    const kids = node.kind === 'folder' ? node.children : node.children ?? [];
    const has = kids.length > 0;
    const shown = has && open[id];
    const info = docs[id];
    const kind = node.kind === 'folder' ? 'folder' : kindOf(id, docs);
    const meta = metaOf(node, info, now);
    const due = node.kind === 'doc' && (info ? info.due > 0 || meta === 'due' : false);
    const onClick = (e: MouseEvent) => {
      if (node.kind === 'folder') toggleOpen(id, true);
      onOpen(id, clickOpts(e));
    };
    return (
      <Fragment key={id}>
        {row(id, depth, kind, chevron(id, has), meta, due, onClick)}
        {shown && kids.map((k) => renderNode(k, depth + 1))}
      </Fragment>
    );
  };

  const rootRow = row('', 0, 'folder', chevron('', tree.length > 0), 'vault', false, (e) => {
    toggleOpen('', true);
    onOpen('', clickOpts(e));
  });

  // ── context menu ─────────────────────────────────────────────
  const menuNode = menu ? (menu.id === '' ? null : findNode(tree, menu.id)) : undefined;
  const menuKind: NodeKind = menu ? (menu.id === '' ? 'folder' : kindOf(menu.id, docs)) : 'folder';
  const into = menu ? containerOf(menu.id) : '';
  const act = (fn: () => void) => (e: MouseEvent) => { e.stopPropagation(); fn(); setMenu(null); };
  const create = (kind: NodeKind) => {
    createNode(into, kind as NodeType | 'folder')
      .then((path) => setEditing({ id: path, value: title(path) }))
      .catch(fail);
  };
  const targets = menu
    ? folderPaths(tree).filter((f) => f !== menu.id && f !== dirOf(menu.id) && !within(f, childDirOf(menu.id)))
    : [];

  return (
    <div
      className="tree edit-tree"
      onContextMenu={(e) => { if ((e.target as HTMLElement).closest('.trow')) return; openMenu(e, ''); }}
    >
      {rootRow}
      {open[''] && tree.map((n) => renderNode(n, 1))}

      {menu && (menu.id === '' || menuNode) && (
        <div
          className="ctx-menu"
          style={{ left: menu.x, top: menu.y }}
          onMouseDown={(e) => e.stopPropagation()}
          onContextMenu={(e) => e.preventDefault()}
        >
          {!menu.sub ? (
            <>
              {NEW_KINDS.map(([kind, label]) => (
                <div key={kind} className="ci" onClick={act(() => create(kind))}>
                  <span className="cg">{GLYPH[kind]}</span>{label}
                </div>
              ))}
              {menu.id !== '' && (
                <>
                  <div className="cd" />
                  <div className="ci" onClick={act(() => beginRename(menu.id))}>
                    <span className="cg">✎</span>rename<span className="ck">F2</span>
                  </div>
                  <div className="ci has-sub" onMouseEnter={() => setMenu((m) => (m ? { ...m, sub: true } : m))}>
                    <span className="cg">→</span>move to…<span className="ck">▸</span>
                  </div>
                  <div className="cd" />
                  <div className="ci danger" onClick={act(() => removeNode(menu.id).catch(fail))}>
                    <span className="cg">⌫</span>delete {menuKind}
                  </div>
                </>
              )}
            </>
          ) : (
            <div className="sub-wrap" onMouseLeave={() => setMenu((m) => (m ? { ...m, sub: false } : m))}>
              <div className="ci back" onClick={(e) => { e.stopPropagation(); setMenu((m) => (m ? { ...m, sub: false } : m)); }}>
                <span className="cg">◂</span>move to…
              </div>
              <div className="cd" />
              <div className="sub-scroll">
                {targets.map((f) => (
                  <div key={f} className="ci" onClick={act(() => moveNode(menu.id, f).catch(fail))}>
                    <span className="cg">/</span>{title(f)}
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
