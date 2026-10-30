// Lenses: what a tab renders for a folder or a document, or the intake.
// Folders and decks are lists; notes, sources, extracts, and drafts open in the reader.

import { useEffect, useRef, useState, type DragEvent } from 'react';
import { childDirOf, childrenAt, ordered, within, type TreeNode } from '../vault/index.js';
import { DeckBrowser } from './DeckBrowser.js';
import { Intake } from './Intake.js';
import { GLYPH, INTAKE, SESSION, contentsOf, findNode, kindOf, queueScope, titleOf, type NodeKind } from './names.js';
import type { OpenOpts } from './panes.js';
import { Pdf } from './Pdf.js';
import { Queue } from './Queue.js';
import { Notebook } from './Rail.js';
import { Reader } from './Reader.js';
import { Session } from './Session.js';
import { useApp } from './store.js';
import { NodeMenu, dropMode, menuAt, type DropMode, type MenuAt } from './NodeMenu.js';
import { createNode, openIntake, placeNode, renameNode } from './vault.js';
import { notebookOf } from './tabs.js';

interface LensProps {
  id: string;
  /** In the active pane: keys reach this lens. */
  active: boolean;
  onOpen(path: string, opts: OpenOpts): void;
}

const plural = (n: number, word: string) => `${n} ${word}${n === 1 ? '' : 's'}`;

export function Lens({ id, active, onOpen }: LensProps) {
  const docs = useApp((s) => s.docs);
  if (id === INTAKE) return <Intake active={active} onOpen={onOpen} />;
  if (id === SESSION) return <Session active={active} onOpen={onOpen} />;
  const scope = queueScope(id);
  if (scope) return <Queue scope={scope} active={active} />;
  // a notebook's page: its tab rail beside it (`Rail.tsx`)
  const nb = notebookOf(id, docs);
  if (nb) return <Notebook nb={nb} page={id} active={active} onOpen={onOpen}><PageLens id={id} active={active} onOpen={onOpen} /></Notebook>;
  return <PageLens id={id} active={active} onOpen={onOpen} />;
}

/** A node's own lens: a folder, a deck, pages, or the reader. */
function PageLens({ id, active, onOpen }: LensProps) {
  const docs = useApp((s) => s.docs);
  const kind = kindOf(id, docs);
  if (kind === 'folder') return <FolderLens id={id} active={active} onOpen={onOpen} />;
  if (kind === 'deck') return <DeckLens id={id} active={active} />;
  // a source whose pages exist opens as pages
  if (docs[id]?.pdf) return <Pdf key={id} id={id} active={active} />;
  return <Reader key={id} id={id} active={active} />;
}

// ── folder ───────────────────────────────────────────────────────

const NEW: [NodeKind, string][] = [
  ['note', '+ note'],
  ['source', '+ source'],
  ['deck', '+ deck'],
  ['draft', '+ draft'],
  ['folder', '+ folder'],
];

/**
 * A folder, or a document's children (`id` its children directory): its
 * rows in the directory's order, each with the node's menu and the tree's
 * drags (the middle of a row inside it, its thirds before and after).
 */
function FolderLens({ id, active, onOpen }: LensProps) {
  const tree = useApp((s) => s.tree);
  const docs = useApp((s) => s.docs);
  const root = useApp((s) => s.vault);
  const order = useApp((s) => s.order);
  const fileOver = useApp((s) => s.fileOver);
  const [menu, setMenu] = useState<MenuAt | null>(null);
  const [drag, setDrag] = useState<string | null>(null);
  const [over, setOver] = useState<{ id: string; mode: DropMode } | null>(null);
  const [editing, setEditing] = useState<{ id: string; value: string } | null>(null);
  // the folder's items, or every card under it in the deck browser
  const [cards, setCards] = useState(false);
  const editRef = useRef<HTMLInputElement>(null);
  useEffect(() => {
    if (editing && editRef.current) {
      editRef.current.focus();
      editRef.current.select();
    }
  }, [editing?.id]);
  const found = childrenAt(tree, id);
  if (!found) return <Gone />;
  // a document's children: the document's own menu is this lens's, as its row's is in the tree
  const owner = id !== '' && findNode(tree, `${id}.md`)?.kind === 'doc' ? `${id}.md` : id;
  const children: TreeNode[] = ordered(found, order[id]);
  const onDragOverRow = (e: DragEvent, at: string) => {
    if (drag === null || drag === at || within(at, childDirOf(drag))) return;
    e.preventDefault();
    const r = e.currentTarget.getBoundingClientRect();
    const mode = dropMode(e.clientY - r.top, r.height);
    if (!over || over.id !== at || over.mode !== mode) setOver({ id: at, mode });
  };
  const endDrag = () => { setDrag(null); setOver(null); };
  const title = (path: string) => titleOf(path, docs, root);
  const beginRename = (path: string) => { if (path !== '') setEditing({ id: path, value: title(path) }); };
  const commitRename = () => {
    if (!editing) return;
    const { id: at, value } = editing;
    setEditing(null);
    if (value.trim() && value.trim() !== title(at)) renameNode(at, value).catch(console.error);
  };
  // `+ source` opens the intake for this folder (paste, a link, a drop, a pick); `new source` on the menu makes an empty one
  const add = (kind: NodeKind) => {
    if (kind === 'source') openIntake(id);
    else void createNode(id, kind).then(beginRename).catch(console.error);
  };
  return (
    <div
      className="reader-wrap"
      // the empty space: the folder's own menu, new items landing in it
      onContextMenu={(e) => { e.preventDefault(); setMenu(menuAt(e, owner)); }}
    >
      <div className={`reader folder-view${cards ? ' deck-view' : ''}`}>
        <div className="meta">
          <span className="crumb">{owner === id ? 'folder' : `inside ${kindOf(owner, docs)}`}</span>
          <span className="right">{children.length ? plural(children.length, 'item') : ''}</span>
        </div>
        <h1>{title(id)}</h1>
        <div className="fv-view">
          <button type="button" data-on={cards ? '0' : '1'} onClick={() => setCards(false)}>items</button>
          <button type="button" data-on={cards ? '1' : '0'} onClick={() => setCards(true)}>cards</button>
        </div>
        {cards ? <DeckBrowser home={id} active={active} /> : <>
        <div className="fv-new">
          {NEW.map(([kind, label]) => (
            <button key={kind} type="button" onClick={() => add(kind)}>{label}</button>
          ))}
        </div>
        {children.length > 0 ? (
          <ul className="fv-contents">
            {children.map((n) => {
              const kind: NodeKind = n.kind === 'folder' ? 'folder' : kindOf(n.path, docs);
              const editingThis = editing?.id === n.path;
              return (
                <li
                  key={n.path}
                  className={`fv-row${over?.id === n.path ? ` drop-${over.mode}` : fileOver === n.path ? ' drop-into' : ''}`}
                  data-path={n.path}
                  data-kind={kind}
                  draggable={!editingThis}
                  onDragStart={(e) => { setDrag(n.path); e.dataTransfer.effectAllowed = 'move'; try { e.dataTransfer.setData('text/plain', n.path); } catch { /* not every host allows it */ } }}
                  onDragOver={(e) => onDragOverRow(e, n.path)}
                  onDragLeave={() => { if (over?.id === n.path) setOver(null); }}
                  onDrop={(e) => { e.preventDefault(); e.stopPropagation(); if (drag !== null && over) placeNode(drag, over.id, over.mode).catch(console.error); endDrag(); }}
                  onDragEnd={endDrag}
                  onClick={(e) => { if (!editingThis) onOpen(n.path, { cmdClick: e.metaKey || e.ctrlKey, shiftClick: e.shiftKey }); }}
                  onContextMenu={(e) => { e.preventDefault(); e.stopPropagation(); setMenu(menuAt(e, n.path)); }}
                >
                  <span className="fv-g" data-t={kind}>{GLYPH[kind]}</span>
                  {editingThis ? (
                    <input
                      className="rename fv-rename"
                      ref={editRef}
                      value={editing.value}
                      spellCheck={false}
                      onChange={(e) => setEditing({ id: n.path, value: e.target.value })}
                      onMouseDown={(e) => e.stopPropagation()}
                      onClick={(e) => e.stopPropagation()}
                      onBlur={commitRename}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter') { e.preventDefault(); commitRename(); }
                        else if (e.key === 'Escape') { e.preventDefault(); setEditing(null); }
                      }}
                    />
                  ) : (
                    <span className="fv-name">{title(n.path)}</span>
                  )}
                  <span className="fv-meta">{contentsOf(n, docs[n.path])}</span>
                </li>
              );
            })}
          </ul>
        ) : (
          <div className="empty">empty</div>
        )}
        </>}
      </div>
      {menu && <NodeMenu at={menu} set={setMenu} onCreated={beginRename} onRename={beginRename} />}
    </div>
  );
}

// ── deck ─────────────────────────────────────────────────────────

/** A deck, or any document opened as its cards: the browser over it and everything under it. */
function DeckLens({ id, active }: { id: string; active: boolean }) {
  const docs = useApp((s) => s.docs);
  const root = useApp((s) => s.vault);
  const info = docs[id];
  if (!info) return <Gone />;
  return (
    <div className="reader-wrap">
      <div className="reader deck-view">
        <div className="meta">
          <span className="crumb">{info.type}</span>
          <span className="right">{plural(info.cards, 'card')}{info.due ? ` · ${info.due} due` : ''}</span>
        </div>
        <h1>{titleOf(id, docs, root)}</h1>
        <DeckBrowser home={id} active={active} />
      </div>
    </div>
  );
}

function Gone() {
  return <div className="reader-wrap"><div className="reader"><div className="empty">no longer in the collection</div></div></div>;
}
