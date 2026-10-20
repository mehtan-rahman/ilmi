// The workspace tree: the vault rendered as rows you can open, rename, move,
// and delete. Every edit goes to disk through src/app/vault.ts and comes
// back through the vault's events; this component keeps only what is
// mid-gesture (a rename in progress, a drag, the open menu).
//
//  · click            open the node as a lens; the chevron alone folds
//  · dbl-click / F2   inline rename
//  · right-click      the node's menu (`NodeMenu.tsx`, shared with the folder lens);
//                     anywhere else in the sidebar, the root's menu (new items land at the root)
//  · +                beside the vault's name: the same menu for the selected folder, else the root
//  · drag             drop between rows to move beside them, or onto a folder to move inside;
//                     a file from the OS lands in the row's folder (`land.ts`), the row lit meanwhile

import { Fragment, useEffect, useRef, useState, type DragEvent, type MouseEvent, type ReactNode } from 'react';
import { childDirOf, dirOf, within, type TreeNode } from '../vault/index.js';
import { GLYPH, findNode, kindOf, metaOf, titleOf, type NodeKind } from './names.js';
import { NodeMenu, menuAt, type MenuAt } from './NodeMenu.js';
import type { OpenOpts } from './panes.js';
import { useApp } from './store.js';
import { moveNode, renameNode, toggleOpen } from './vault.js';

export { MENU_W, placeMenu } from './NodeMenu.js';

interface Props {
  /** Path of the node the active tab shows. */
  activeId: string | undefined;
  onOpen(path: string, opts: OpenOpts): void;
}

interface Editing { id: string; value: string }
type DropMode = 'before' | 'after' | 'into';
interface Over { id: string; mode: DropMode }

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
  const [menu, setMenu] = useState<MenuAt | null>(null);
  const fileOver = useApp((s) => s.fileOver);
  const [drag, setDrag] = useState<string | null>(null);
  const [over, setOver] = useState<Over | null>(null);
  const [selected, setSelected] = useState<string | null>(null);
  const editRef = useRef<HTMLInputElement>(null);
  const boxRef = useRef<HTMLDivElement>(null);
  const now = new Date();

  const title = (path: string) => titleOf(path, docs, root);
  const fail = (e: unknown) => console.error(e);

  useEffect(() => {
    if (editing && editRef.current) {
      editRef.current.focus();
      editRef.current.select();
    }
  }, [editing?.id]);

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
    setMenu(menuAt(e, id));
  };

  // The sidebar's empty space and headings are outside this box (the box
  // ends at the last row), so the root's menu is opened from a listener on
  // the sidebar itself; a row's own menu is React's, and this one lets it be.
  useEffect(() => {
    const side = boxRef.current?.closest<HTMLElement>('.side') ?? boxRef.current;
    if (!side) return;
    const onMenu = (e: globalThis.MouseEvent) => {
      const t = e.target as HTMLElement | null;
      if (t?.closest('.trow, .ctx-menu')) return;
      e.preventDefault();
      setMenu(menuAt(e, ''));
    };
    side.addEventListener('contextmenu', onMenu);
    return () => side.removeEventListener('contextmenu', onMenu);
  }, []);

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
  const overCls = (id: string) => (over && over.id === id ? `drop-${over.mode}` : fileOver === id ? 'drop-into' : '');

  // the `+` in the root row opens the menu for the selected folder, else the root
  const plusDir = selected !== null && (selected === '' || findNode(tree, selected)?.kind === 'folder') ? selected : '';

  // ── one row ──────────────────────────────────────────────────
  const row = (id: string, depth: number, kind: NodeKind, chev: ReactNode, meta: string, due: boolean, onClick: (e: MouseEvent) => void) => {
    const editingThis = editing?.id === id;
    return (
      <div
        key={id}
        className={`row trow ${overCls(id)}`}
        style={{ paddingLeft: 6 + depth * 13 }}
        data-path={id}
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
        {id === '' && (
          <span
            className="side-add"
            title="new, import, or add"
            onMouseDown={(e) => e.stopPropagation()}
            onClick={(e) => { e.stopPropagation(); const r = e.currentTarget.getBoundingClientRect(); setMenu(menuAt({ clientX: r.left, clientY: r.bottom + 2 }, plusDir, true)); }}
          >+</span>
        )}
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

  return (
    <div className="tree edit-tree" ref={boxRef}>
      {rootRow}
      {open[''] && tree.map((n) => renderNode(n, 1))}

      {menu && <NodeMenu at={menu} set={setMenu} onCreated={(path) => setEditing({ id: path, value: title(path) })} onRename={beginRename} />}
    </div>
  );
}
