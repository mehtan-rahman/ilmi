// The workspace tree: the vault rendered as rows you can open, rename, move,
// and delete. Every edit goes to disk through src/app/vault.ts and comes
// back through the vault's events; this component keeps only what is
// mid-gesture (a rename in progress, the open menu, the selected row, a
// hoist, a delete being asked). The rows and keys are `treeModel.ts`, the
// drag `drag.ts` / `dnd.ts` (shared with the tab rail and the folder lens).
//
//  · click            open the node as a lens; the chevron alone folds
//  · ⌥-click          hoist the row: the tree shows only what is under it, a crumb to go back
//  · dbl-click / F2   inline rename; F2 only while the tree has focus (a click on a row gives it)
//  · keys             ↑↓ → ← ⏎, ⌘⌫ delete, ⌥⌘↑↓ move among siblings, ⌥⌘← → outdent / nest,
//                     a letter jumps to the next name starting with it (`treeModel.ts`)
//  · hover            `+` (the new menu, inside the row) and `···` (the row's menu) at its end;
//                     the selected row shows them too, for the keyboard and the eye
//  · right-click      the node's menu (`NodeMenu.tsx`, shared with the folder lens);
//                     anywhere else in the sidebar, the root's menu (new items land at the root)
//  · +                beside the vault's name: the same menu for the selected folder, else the root
//  · drag             25 / 50 / 25 over a row (`dnd.ts`), a line indented to where it lands or a
//                     box around the row it goes into; a file from the OS lands in the row's
//                     folder (`land.ts`), the row lit meanwhile
//  · ⌥-click ▸        on a document with children: its children in a folder lens
//
// The open document's row is revealed: its rows above opened and it
// scrolled into view when the tab changes, the focus left where it was.

import { useEffect, useMemo, useRef, useState, type KeyboardEvent, type MouseEvent } from 'react';
import { childDirOf } from '../vault/index.js';
import { geometry } from './dnd.js';
import { rowDrag, rowMark, useDrag, type Surface } from './drag.js';
import { GLYPH, descendants, findNode, kindOf, rowCounts, titleOf, type NodeKind } from './names.js';
import { NodeMenu, menuAt, type MenuAt } from './NodeMenu.js';
import type { OpenOpts } from './panes.js';
import { useApp } from './store.js';
import { TREE_INDENT, TREE_PAD, keyPlace, revealRows, treeKey, treeRows, typeahead, type TreeRow } from './treeModel.js';
import { deleteNode } from './remove.js';
import { placeNode, renameNode, toggleOpen } from './vault.js';

export { MENU_W, placeMenu } from './NodeMenu.js';

interface Props {
  /** Path of the node the active tab shows. */
  activeId: string | undefined;
  onOpen(path: string, opts: OpenOpts): void;
}

interface Editing { id: string; value: string }

/** The tree's indent (`treeModel.ts`; the smokes read depth back from it). */
const PAD = TREE_PAD;
const INDENT = TREE_INDENT;
const SURF: Surface = { pad: PAD, indent: INDENT, scroller: '.side', spring: (p) => toggleOpen(p, true) };

const clickOpts = (e: MouseEvent): OpenOpts => ({ cmdClick: e.metaKey || e.ctrlKey, shiftClick: e.shiftKey });
const inField = (t: EventTarget | null) => {
  const tag = (t as HTMLElement | null)?.tagName?.toLowerCase();
  return tag === 'input' || tag === 'textarea';
};
const sel = (path: string) => `.trow[data-path="${CSS.escape(path)}"]:not(.placeholder)`;

export function Tree({ activeId, onOpen }: Props) {
  const tree = useApp((s) => s.tree);
  const docs = useApp((s) => s.docs);
  const open = useApp((s) => s.open);
  const order = useApp((s) => s.order);
  const root = useApp((s) => s.vault);
  const fileOver = useApp((s) => s.fileOver);
  const drag = useDrag();
  const [editing, setEditing] = useState<Editing | null>(null);
  const [menu, setMenu] = useState<MenuAt | null>(null);
  const [selected, setSelectedState] = useState<string | null>(null);
  // the selection as of now, not as of the last render: a key pressed right
  // after the press that selected a row (as a smoke dispatches them) reads it
  const selRef = useRef<string | null>(null);
  const setSelected = (p: string | null) => { selRef.current = p; setSelectedState(p); };
  const [hoist, setHoist] = useState<string | null>(null);
  const [asking, setAsking] = useState<string | null>(null);
  const typed = useRef({ buf: '', at: 0 });
  const editRef = useRef<HTMLInputElement>(null);
  const boxRef = useRef<HTMLDivElement>(null);
  const now = new Date();

  const title = (path: string) => titleOf(path, docs, root);
  const fail = (e: unknown) => console.error(e);
  const hoisted = hoist !== null && findNode(tree, hoist) ? hoist : null;
  const rows = useMemo(() => treeRows(tree, open, order, hoisted ?? undefined), [tree, open, order, hoisted]);
  const geoms = useMemo(() => geometry(rows, 1), [rows]);

  useEffect(() => {
    if (editing && editRef.current) {
      editRef.current.focus();
      editRef.current.select();
    }
  }, [editing?.id]);

  // the open document revealed: the rows above it opened, its row scrolled into view (not focused)
  const ready = tree.length > 0;
  useEffect(() => {
    if (!activeId || !findNode(tree, activeId)) return;
    if (hoisted !== null && !(activeId === hoisted || activeId.startsWith(`${childDirOf(hoisted)}/`))) return;
    const st = useApp.getState().open;
    for (const p of revealRows(tree, activeId)) if (!st[p] && p !== activeId && p !== hoisted) toggleOpen(p, true);
    setTimeout(() => boxRef.current?.querySelector<HTMLElement>(sel(activeId))?.scrollIntoView?.({ block: 'nearest' }), 0);
  }, [activeId, ready]);

  // the selected row kept in view as the keys move it
  useEffect(() => {
    if (selected !== null) boxRef.current?.querySelector<HTMLElement>(sel(selected))?.scrollIntoView?.({ block: 'nearest' });
  }, [selected]);

  const beginRename = (id: string) => {
    if (id === '') return;
    // a row folded away is opened to first, so its field is drawn
    const st = useApp.getState().open;
    for (const p of revealRows(tree, id)) if (!st[p] && p !== id) toggleOpen(p, true);
    setEditing({ id, value: title(id) });
  };

  const commitRename = () => {
    if (!editing) return;
    const { id, value } = editing;
    setEditing(null);
    if (value.trim() && value.trim() !== title(id)) renameNode(id, value).then((to) => { if (selected === id) setSelected(to); }).catch(fail);
    boxRef.current?.focus();
  };

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

  // the tree's keys, while it has focus (`treeModel.ts`); in the page they are the page's
  const onKey = (e: KeyboardEvent<HTMLDivElement>) => {
    if (editing || inField(e.target)) return;
    const cur = selRef.current;
    const focus = cur !== null && rows.some((r) => r.path === cur) ? cur : activeId && rows.some((r) => r.path === activeId) ? activeId : null;
    const act = treeKey(rows, focus, e);
    if (asking !== null && act?.kind !== 'delete') setAsking(null);
    if (!act) {
      // F2 on a tab whose row is folded away still renames it
      if (e.key === 'F2' && activeId && findNode(tree, activeId)) { e.preventDefault(); beginRename(activeId); }
      return;
    }
    e.preventDefault();
    e.stopPropagation();
    switch (act.kind) {
      case 'focus': setSelected(act.path); break;
      case 'fold': toggleOpen(act.path, act.open); break;
      case 'activate': {
        const node = findNode(tree, act.path);
        if (node?.kind === 'folder' || act.path === '') toggleOpen(act.path, true);
        onOpen(act.path, {});
        break;
      }
      case 'rename': beginRename(act.path); break;
      case 'delete': del(act.path); break;
      case 'move': {
        const to = keyPlace(rows, act.path, act.to);
        if (to) placeNode(act.path, to.target, to.mode).then(setSelected).catch(fail);
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

  // the `+` in the root row opens the menu for the selected folder, else the root
  const plusDir = selected !== null && (selected === '' || findNode(tree, selected)?.kind === 'folder') ? selected : '';
  const menuFrom = (e: MouseEvent, id: string, plus: boolean) => {
    e.stopPropagation();
    const r = e.currentTarget.getBoundingClientRect();
    setMenu(menuAt({ clientX: r.left, clientY: r.bottom + 2 }, id, plus));
  };

  // ── one row ──────────────────────────────────────────────────
  const guides = (depth: number) =>
    Array.from({ length: Math.max(0, depth - 1) }, (_, l) => <span key={l} className="guide" style={{ left: PAD + (l + 1) * INDENT + 4 }} />);

  const placeholder = (r: TreeRow, i: number) => {
    const key = r.key ?? r.path;
    const m = rowMark(drag, key, r.path, SURF);
    return (
      <div
        key={key}
        className={`row trow placeholder ${m.className}`}
        style={{ paddingLeft: PAD + r.depth * INDENT + 16, ...m.style }}
        data-path={r.path}
        data-kind={r.path === '' ? 'folder' : kindOf(r.path, docs)}
        role="none"
        {...rowDrag(geoms[i]!, SURF, { draggable: false })}
      >
        {guides(r.depth)}
        <span className="name">empty</span>
      </div>
    );
  };

  const row = (r: TreeRow, i: number) => {
    const id = r.path;
    const node = r.node;
    const isRoot = id === '' || (hoisted !== null && id === hoisted && r.depth === 0);
    const kind: NodeKind = id === '' || node?.kind === 'folder' ? 'folder' : kindOf(id, docs);
    const editingThis = editing?.id === id;
    const counts = node ? rowCounts(node, docs[id], now) : { due: 0, full: '' };
    const m = rowMark(drag, id, id, SURF);
    const cls = ['row', 'trow', m.className, fileOver === id && !m.className.includes('drop-') ? 'drop-into' : '', isRoot ? 'root-row' : ''].filter(Boolean).join(' ');
    const asked = asking === id && node ? descendants(node) : 0;
    const onClick = (e: MouseEvent) => {
      if (editingThis) return;
      if (e.altKey && !isRoot && r.has) { setHoist(id); setSelected(id); return; }
      if (kind === 'folder') toggleOpen(id, true);
      onOpen(id, clickOpts(e));
    };
    return (
      <div
        key={id}
        className={cls}
        style={{ paddingLeft: PAD + r.depth * INDENT, ...m.style }}
        data-path={id}
        data-kind={kind}
        data-active={activeId === id ? '1' : '0'}
        data-selected={selected === id ? '1' : '0'}
        role="treeitem"
        aria-level={r.depth + 1}
        aria-selected={selected === id}
        aria-expanded={r.has ? r.open : undefined}
        title={counts.full || undefined}
        {...rowDrag(geoms[i]!, SURF, { draggable: !isRoot && !editingThis, folded: r.has && !r.open })}
        onContextMenu={(e) => openMenu(e, id)}
        onMouseDown={() => { setSelected(id); setAsking(null); }}
        onDoubleClick={(e) => { e.stopPropagation(); beginRename(id); }}
        onClick={onClick}
      >
        {guides(r.depth)}
        <span
          className="chev"
          title={r.has && id.endsWith('.md') ? '⌥-click: open the children as a folder' : undefined}
          onClick={(e) => {
            e.stopPropagation();
            if (r.has && e.altKey && id.endsWith('.md')) onOpen(childDirOf(id), clickOpts(e));
            else if (r.has && !(isRoot && hoisted !== null)) toggleOpen(id);
          }}
        >
          {r.has ? (r.open ? '▾' : '▸') : ''}
        </span>
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
              else if (e.key === 'Escape') { e.preventDefault(); setEditing(null); boxRef.current?.focus(); }
            }}
          />
        ) : (
          <span className="name">{title(id)}</span>
        )}
        {asked > 0 && <span className="asking">delete with {asked} inside? ⌘⌫</span>}
        {!asked && counts.due > 0 && <span className="due">{counts.due}</span>}
        {id === '' && (
          <span className="side-add" title="new, import, or add" onMouseDown={(e) => e.stopPropagation()} onClick={(e) => menuFrom(e, plusDir, true)}>+</span>
        )}
        {!isRoot && !editingThis && (
          <span className="row-acts" onMouseDown={(e) => e.stopPropagation()} onDoubleClick={(e) => e.stopPropagation()}>
            <span className="ra add" title="new inside" onClick={(e) => { setSelected(id); menuFrom(e, id, true); }}>+</span>
            <span className="ra more" title="more" onClick={(e) => { setSelected(id); menuFrom(e, id, false); }}>···</span>
          </span>
        )}
      </div>
    );
  };

  // while hoisted: a crumb back out, each level a link
  const crumb = hoisted !== null && (
    <div className="hoist-crumb">
      {revealRows(tree, hoisted).map((p) => (
        <span key={p || '/'} className="hc" onClick={() => setHoist(p === '' ? null : p)}>{p === '' ? title('') : title(p)}</span>
      ))}
      <span className="hc here">{title(hoisted)}</span>
    </div>
  );

  return (
    <div
      className="tree edit-tree"
      ref={boxRef}
      tabIndex={0}
      role="tree"
      aria-label="collection"
      data-hoist={hoisted ?? undefined}
      onKeyDown={onKey}
    >
      {crumb}
      {rows.map((r, i) => (r.placeholder ? placeholder(r, i) : row(r, i)))}

      {menu && <NodeMenu at={menu} set={setMenu} onCreated={(path) => setEditing({ id: path, value: title(path) })} onRename={beginRename} />}
    </div>
  );
}

