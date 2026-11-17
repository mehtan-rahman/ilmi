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
//                     a letter jumps to the next name starting with it (`treeModel.ts`); a
//                     letter no name starts with is left to the page (unless it follows a
//                     jump at once: the name going on), and so is every letter while a
//                     session is in front (its 1–4, its p and d); ⇧F10 or the Menu key
//                     opens the selected row's menu at the row
//  · the page's keys  a click that opens a row gives the focus back to the page: its
//                     bare keys (a deck's j k, a reader's r) are the page's again;
//                     the row stays selected, and a press on the tree's own keys
//                     (↑↓, F2) wants the focus here first (Tab, or a press on a
//                     chevron or the sidebar)
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
import { GLYPH, SESSION, WRITTEN_GLYPH, descendants, findNode, kindOf, rowCounts, titleOf, type NodeKind } from './names.js';
import { MathText } from './MathText.js';
import { NodeMenu, menuAt, menuAtRow, type MenuAt } from './NodeMenu.js';
import type { OpenOpts } from './panes.js';
import { failed } from './land.js';
import { useApp } from './store.js';
import { TREE_INDENT, TREE_PAD, afterDelete, followMove, isMenuKey, isNodeRow, keyPlace, revealRows, treeKey, treeRows, typeahead, type TreeCards, type TreeRow } from './treeModel.js';
import { cardSet, frontLine } from './cardSet.js';
import { deleteNode } from './remove.js';
import { docsOf, placeNode, renameNode, toggleOpen } from './vault.js';
import { cardsPath, cardsId } from './names.js';
import { appNow } from './clock.js';
import { Glyph, Icon } from './icons.js';

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
  // the files that are not on this device (milestone 63): a book whose PDF is one of them says so
  const awayList = useApp((s) => s.away);
  const away = useMemo(() => new Set(awayList), [awayList]);
  const drag = useDrag();
  const [editing, setEditingState] = useState<Editing | null>(null);
  // the rename as of now: Enter (or Escape) and the blur that moving the focus
  // off the field then makes are one end of it, not two (the blur's handler is
  // the last render's, which still has the rename)
  const editNow = useRef<Editing | null>(null);
  const setEditing = (e: Editing | null) => { editNow.current = e; setEditingState(e); };
  const [menu, setMenu] = useState<MenuAt | null>(null);
  const [selected, setSelectedState] = useState<string | null>(null);
  // the selection as of now, not as of the last render: a key pressed right
  // after the press that selected a row (as a smoke dispatches them) reads it
  const selRef = useRef<string | null>(null);
  const setSelected = (p: string | null) => { selRef.current = p; setSelectedState(p); };
  const [hoist, setHoist] = useState<string | null>(null);
  const [asking, setAsking] = useState<string | null>(null);
  // a row asked about that is gone (moved or deleted meanwhile) is asked about no more: a node later at its path is not
  useEffect(() => { if (asking !== null && !findNode(tree, asking)) setAsking(null); }, [tree, asking]);
  /** The selected row follows a node moved or renamed (it, or a row under it). */
  const follow = (from: string, to: string) => { const s = followMove(selRef.current, from, to); if (s !== selRef.current) setSelected(s); };
  // the drag's surface: a drop that moves the selected row takes the selection with it
  const surf = useMemo<Surface>(() => ({ ...SURF, landed: (_d, to, from) => follow(from, to) }), []);
  const typed = useRef({ buf: '', at: 0 });
  const editRef = useRef<HTMLInputElement>(null);
  const boxRef = useRef<HTMLDivElement>(null);
  const now = appNow();

  const title = (path: string) => titleOf(path, docs, root);
  const fail = failed('that');
  const hoisted = hoist !== null && findNode(tree, hoist) ? hoist : null;
  // a document's cards, listed under its row once it is open; read again with every write the vault reports (`docs`)
  const cardsOf = useMemo<TreeCards>(() => {
    const memo = new Map<string, ReturnType<TreeCards>>();
    return (doc) => {
      if (!docs[doc]?.cards) return [];
      let got = memo.get(doc);
      if (!got) { got = cardSet(docsOf([doc])[0]?.[1]); memo.set(doc, got); }
      return got;
    };
  }, [docs]);
  const rows = useMemo(() => treeRows(tree, open, order, hoisted ?? undefined, cardsOf), [tree, open, order, hoisted, cardsOf]);
  // the drag's geometry is the nodes' alone: a card's row takes no drop and moves nothing
  const geoms = useMemo(() => {
    const nodes = rows.filter((r) => !r.card && !r.cards);
    const g = geometry(nodes, 1);
    const by = new Map<TreeRow, (typeof g)[number]>();
    nodes.forEach((r, k) => by.set(r, g[k]!));
    return by;
  }, [rows]);
  const cardAt = useApp((s) => s.cardAt);
  /** A row's name: a node's title, a card's front, a document's cards counted. */
  const rowName = (path: string) => {
    const r = rows.find((x) => x.path === path);
    if (r?.card) return frontLine(r.card.text);
    if (r?.cards) return `${r.cards.n} card${r.cards.n === 1 ? '' : 's'}`;
    return title(path);
  };

  useEffect(() => {
    if (editing && editRef.current) {
      editRef.current.focus();
      editRef.current.select();
    }
  }, [editing?.id]);

  // a rename whose node goes away (moved or deleted meanwhile) ends, renaming nothing, and the keys are the
  // tree's again; one for a node not in the tree yet (just made, its row still to come) waits for it
  const editSeen = useRef<string | null>(null);
  useEffect(() => {
    if (!editing) { editSeen.current = null; return; }
    if (findNode(tree, editing.id)) editSeen.current = editing.id;
    else if (editSeen.current === editing.id) setEditing(null);
  }, [tree, editing?.id]);

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
    const at = editNow.current;
    if (!at) return;
    const { id, value } = at;
    setEditing(null);
    // a node moved or deleted while its name was being edited is not renamed (its path is another's now, or nothing's)
    const here = findNode(useApp.getState().tree, id);
    if (here && value.trim() && value.trim() !== title(id)) renameNode(id, value).then((to) => follow(id, to)).catch(failed('rename'));
    boxRef.current?.focus();
  };

  const del = (id: string) => {
    const node = findNode(tree, id);
    if (!node) return;
    if (descendants(node) > 0 && asking !== id) { setAsking(id); return; }
    setAsking(null);
    // the next row not under it: not its cards' rows either, which go with it
    setSelected(afterDelete(rows, id));
    deleteNode(id).catch(failed('delete'));
  };

  // the tree's keys, while it has focus (`treeModel.ts`); in the page they are the page's
  const onKey = (e: KeyboardEvent<HTMLDivElement>) => {
    if (editing || inField(e.target)) return;
    const cur = selRef.current;
    const focus = cur !== null && rows.some((r) => r.path === cur) ? cur : activeId && rows.some((r) => r.path === activeId) ? activeId : null;
    // ⇧F10 or the Menu key: the row's menu, at the row (a card's row has none)
    if (isMenuKey(e)) {
      e.preventDefault();
      e.stopPropagation();
      const at = focus === null ? undefined : rows.find((r) => r.path === focus);
      const el = at && isNodeRow(at) ? boxRef.current?.querySelector(sel(at.path)) : null;
      if (at && el) { setSelected(at.path); setAsking(null); setMenu(menuAtRow(el, at.path)); }
      return;
    }
    const act = treeKey(rows, focus, e);
    if (asking !== null && act?.kind !== 'delete') setAsking(null);
    if (!act) {
      // F2 on a tab whose row is folded away still renames it
      if (e.key === 'F2' && activeId && findNode(tree, activeId)) { e.preventDefault(); beginRename(activeId); }
      return;
    }
    // a letter is the tree's only when a name starts with what was typed: any other is the page's (a deck's j k m,
    // a reader's r), and with a session in front every one is (its grades, p, d, o)
    let typedHit: string | null = null;
    if (act.kind === 'type') {
      if (activeId === SESSION) return;
      const t = Date.now();
      // letters typed quickly are one word: one that follows a jump is the name going on, and the tree's whether or not a name goes on so
      const going = t - typed.current.at < 700;
      const buf = going ? typed.current.buf + act.char : act.char;
      typedHit = typeahead(rows, focus, buf, rowName);
      if (typedHit === null && !going) return;
      typed.current = { buf, at: t };
    }
    e.preventDefault();
    e.stopPropagation();
    switch (act.kind) {
      case 'focus': setSelected(act.path); break;
      case 'fold': toggleOpen(act.path, act.open); break;
      case 'activate': {
        const r = rows.find((x) => x.path === act.path);
        if (r?.card) { openCardRow(r, {}); break; }
        if (r?.cards) { toggleOpen(act.path); break; }
        const node = findNode(tree, act.path);
        if (node?.kind === 'folder' || act.path === '') toggleOpen(act.path, true);
        onOpen(act.path, {});
        break;
      }
      case 'rename': beginRename(act.path); break;
      case 'delete': del(act.path); break;
      case 'move': {
        const to = keyPlace(rows, act.path, act.to);
        if (to) placeNode(act.path, to.target, to.mode).then(setSelected).catch(failed('move'));
        break;
      }
      case 'type': if (typedHit !== null) setSelected(typedHit); break;
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

  /** A press that opened something gives the keys back to the page: the tree keeps its selection, not the focus. */
  const toPage = () => { if (document.activeElement === boxRef.current) boxRef.current?.blur(); };

  /** A card's row: the card view on its document's cards, at this one. */
  const openCardRow = (r: TreeRow, opts: OpenOpts) => {
    if (!r.card) return;
    const { doc, block, id } = r.card;
    useApp.setState((st) => ({ cardAt: { ...st.cardAt, [doc]: id === undefined ? { block } : { block, id } } }));
    onOpen(cardsId(doc), opts);
  };

  // ── one row ──────────────────────────────────────────────────
  const guides = (depth: number) =>
    Array.from({ length: Math.max(0, depth - 1) }, (_, l) => <span key={l} className="guide" style={{ left: PAD + (l + 1) * INDENT + 4 }} />);

  const placeholder = (r: TreeRow, i: number) => {
    const key = r.key ?? r.path;
    const m = rowMark(drag, key, r.path, surf);
    return (
      <div
        key={key}
        className={`row trow placeholder ${m.className}`}
        style={{ paddingLeft: PAD + r.depth * INDENT + 16, ...m.style }}
        data-path={r.path}
        data-kind={r.path === '' ? 'folder' : kindOf(r.path, docs)}
        role="none"
        {...rowDrag(geoms.get(r)!, surf, { draggable: false })}
      >
        {guides(r.depth)}
        <span className="name">empty</span>
      </div>
    );
  };

  /** A card under its document: its front on one line, quiet; the card view's card lit while it is on show. */
  const cardRow = (r: TreeRow) => {
    const c = r.card!;
    const at = cardAt[c.doc];
    const on = activeId !== undefined && cardsPath(activeId) === c.doc && (at?.id !== undefined ? at.id === c.id : at?.block === c.block);
    return (
      <div
        key={r.path}
        className="row trow card-row"
        style={{ paddingLeft: PAD + r.depth * INDENT }}
        data-path={r.path}
        data-kind="card"
        data-doc={c.doc}
        data-block={c.block}
        data-active={on ? '1' : '0'}
        data-selected={selected === r.path ? '1' : '0'}
        role="treeitem"
        aria-level={r.depth + 1}
        aria-selected={selected === r.path}
        title={frontLine(c.text, 400)}
        onMouseDown={() => { setSelected(r.path); setAsking(null); }}
        onClick={(e) => { openCardRow(r, clickOpts(e)); toPage(); }}
      >
        {guides(r.depth)}
        <span className="chev" />
        <span className="glyph card"><Icon name="card" /></span>
        <MathText className="name" dir="auto" text={frontLine(c.text)} />
      </div>
    );
  };

  /** Under a document with children: `n cards`, which opens to list them. */
  const cardsRow = (r: TreeRow) => (
    <div
      key={r.path}
      className="row trow cards-row"
      style={{ paddingLeft: PAD + r.depth * INDENT }}
      data-path={r.path}
      data-kind="cards"
      data-selected={selected === r.path ? '1' : '0'}
      role="treeitem"
      aria-level={r.depth + 1}
      aria-expanded={r.open}
      onMouseDown={() => { setSelected(r.path); setAsking(null); }}
      onClick={() => toggleOpen(r.path)}
    >
      {guides(r.depth)}
      <span className="chev"><Glyph g={r.open ? '▾' : '▸'} /></span>
      <span className="glyph card"><Icon name="card" /></span>
      <span className="name">{r.cards!.n} card{r.cards!.n === 1 ? '' : 's'}</span>
    </div>
  );

  const row = (r: TreeRow, i: number) => {
    const id = r.path;
    const node = r.node;
    const isRoot = id === '' || (hoisted !== null && id === hoisted && r.depth === 0);
    const kind: NodeKind = id === '' || node?.kind === 'folder' ? 'folder' : kindOf(id, docs);
    const editingThis = editing?.id === id;
    const counts = node ? rowCounts(node, docs[id], now) : { due: 0, full: '' };
    const m = rowMark(drag, id, id, surf);
    // a drag resting on a closed row opens it only for nodes under it: a deck's card list would push the rows under the pointer away
    const springs = r.has && !r.open && (kind === 'folder' || (node?.kind === 'doc' && (node.children?.length ?? 0) > 0));
    const cls = ['row', 'trow', m.className, fileOver === id && !m.className.includes('drop-') ? 'drop-into' : '', isRoot ? 'root-row' : ''].filter(Boolean).join(' ');
    const asked = asking === id && node ? descendants(node) : 0;
    const notHere = node?.kind === 'doc' && node.pdf !== undefined && away.has(node.pdf);
    const onClick = (e: MouseEvent) => {
      if (editingThis) return;
      if (e.altKey && !isRoot && r.has) { setHoist(id); setSelected(id); return; }
      if (kind === 'folder') toggleOpen(id, true);
      onOpen(id, clickOpts(e));
      toPage();
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
        {...rowDrag(geoms.get(r)!, surf, { draggable: !isRoot && !editingThis, folded: springs })}
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
          {r.has ? <Glyph g={r.open ? '▾' : '▸'} /> : ''}
        </span>
        <span className={`glyph ${kind}${id === '' ? ' root' : ''}`}><Glyph g={docs[id]?.written ? WRITTEN_GLYPH : GLYPH[kind]} /></span>
        {editingThis ? (
          <input
            className="rename"
            dir="auto"
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
          <MathText className="name" dir="auto" text={title(id)} />
        )}
        {asked > 0 && <span className="asking">delete with {asked} inside? ⌘⌫</span>}
        {!asked && notHere && <span className="away">not here</span>}
        {!asked && counts.due > 0 && <span className="due">{counts.due}</span>}
        {id === '' && (
          <span className="side-add" title="new, import, or add" onMouseDown={(e) => e.stopPropagation()} onClick={(e) => menuFrom(e, plusDir, true)}><Glyph g="+" /></span>
        )}
        {!isRoot && !editingThis && (
          <span className="row-acts" onMouseDown={(e) => e.stopPropagation()} onDoubleClick={(e) => e.stopPropagation()}>
            {/* the tree is the one Tab stop: from the keys the row's menu is ⇧F10 */}
            <button type="button" className="ra add" title="new inside" aria-label={`add under ${title(id)}`} tabIndex={-1} onClick={(e) => { setSelected(id); menuFrom(e, id, true); }}><Glyph g="+" /></button>
            <button type="button" className="ra more" title="more" aria-label="more" aria-haspopup="menu" tabIndex={-1} onClick={(e) => { setSelected(id); menuFrom(e, id, false); }}><Icon name="more" /><span className="gch">···</span></button>
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
      {rows.map((r, i) => (r.card ? cardRow(r) : r.cards ? cardsRow(r) : r.placeholder ? placeholder(r, i) : row(r, i)))}

      {menu && <NodeMenu at={menu} set={setMenu} onCreated={(path) => setEditing({ id: path, value: title(path) })} onRename={beginRename} onMoved={follow} />}
    </div>
  );
}

