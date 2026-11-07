// Lenses: what a tab renders for a folder or a document, or the intake.
// Folders and decks are lists; notes, sources, extracts, and drafts open in the reader.

import { useEffect, useMemo, useRef, useState } from 'react';
import { childrenAt, ordered, type TreeNode } from '../vault/index.js';
import { geometry, type FlatRow } from './dnd.js';
import { rowDrag, rowMark, useDrag, type Surface } from './drag.js';
import { nestOf } from './treeModel.js';
import { DeckBrowser } from './DeckBrowser.js';
import { NumbersView } from './NumbersLens.js';
import { Intake } from './Intake.js';
import { GLYPH, INTAKE, SESSION, findNode, kindOf, notesPath, queueScope, titleOf, type NodeKind } from './names.js';
import { countWords, countsUnder } from './chromeText.js';
import type { OpenOpts } from './panes.js';
import { Pdf } from './Pdf.js';
import { Queue } from './Queue.js';
import { Notebook } from './Rail.js';
import { Reader } from './Reader.js';
import { Session } from './Session.js';
import { useApp, type DocInfo, type LensView } from './store.js';
import { NodeMenu, menuAt, type MenuAt } from './NodeMenu.js';
import { createNode, openIntake, renameNode } from './vault.js';
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
  // the notes on a document's pages (milestone 70): its body in the reader, in the pane beside the pages
  const notes = notesPath(id);
  if (notes !== null) return <Reader key={id} id={notes} active={active} notes />;
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
  // a source whose pages exist opens as pages; a PDF on its own is its pages (milestone 70)
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

/** The folder lens's rows for the shared drag (`drag.ts`): one level, no indent. */
const LENS: Surface = { pad: 0, indent: 1, scroller: '.pane-body' };

/**
 * A folder, or a document's children (`id` its children directory): its
 * rows in the directory's order, each with the node's menu and the drag the
 * tree and the tab rail share (`drag.ts`), so a row dragged from the
 * sidebar lands here and back; empty, one quiet row takes the drop.
 */
function FolderLens({ id, active, onOpen }: LensProps) {
  const tree = useApp((s) => s.tree);
  const docs = useApp((s) => s.docs);
  const root = useApp((s) => s.vault);
  const order = useApp((s) => s.order);
  const fileOver = useApp((s) => s.fileOver);
  const [menu, setMenu] = useState<MenuAt | null>(null);
  const drag = useDrag();
  const [editing, setEditing] = useState<{ id: string; value: string } | null>(null);
  // the folder's items, every card under it in the deck browser, or their numbers
  const view = useApp((s) => s.lensViews[id]) ?? 'items';
  const cards = view === 'cards';
  const editRef = useRef<HTMLInputElement>(null);
  useEffect(() => {
    if (editing && editRef.current) {
      editRef.current.focus();
      editRef.current.select();
    }
  }, [editing?.id]);
  const found = childrenAt(tree, id);
  // a document's children: the document's own menu is this lens's, as its row's is in the tree
  const owner = id !== '' && findNode(tree, `${id}.md`)?.kind === 'doc' ? `${id}.md` : id;
  const children: TreeNode[] = useMemo(() => ordered(found ?? [], order[id]), [found, order, id]);
  // one level: each row before, into (a bare document after a rest), or after; empty, the placeholder into the folder
  const geoms = useMemo(() => geometry(children.length
    ? children.map((n): FlatRow => ({ path: n.path, depth: 0, nest: nestOf(n) }))
    : [{ path: owner, key: `${owner}\u0000empty`, depth: 0, nest: 'only', placeholder: true }], 0), [children, owner]);
  if (!found) return <Gone />;
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
      <div className={`reader folder-view${view !== 'items' ? ' deck-view' : ''}`}>
        <div className="meta">
          <span className="crumb">{folderLabel(owner, id, children, docs, root)}</span>
          <span className="right">{children.length ? plural(children.length, 'item') : ''}</span>
        </div>
        <h1>{title(id)}</h1>
        <ViewSwitch id={id} view={view} views={['items', 'cards', 'numbers']} />
        {cards ? <DeckBrowser home={id} active={active} /> : view === 'numbers' ? <NumbersView home={id} /> : <>
        <div className="fv-new">
          {NEW.map(([kind, label]) => (
            <button key={kind} type="button" onClick={() => add(kind)}>{label}</button>
          ))}
        </div>
        {children.length > 0 ? (
          <ul className="fv-contents">
            {children.map((n, i) => {
              const kind: NodeKind = n.kind === 'folder' ? 'folder' : kindOf(n.path, docs);
              const editingThis = editing?.id === n.path;
              const m = rowMark(drag, n.path, n.path, LENS);
              return (
                <li
                  key={n.path}
                  className={`fv-row${m.className ? ` ${m.className}` : fileOver === n.path ? ' drop-into' : ''}`}
                  style={m.style}
                  data-path={n.path}
                  data-kind={kind}
                  {...rowDrag(geoms[i]!, LENS, { draggable: !editingThis })}
                  onClick={(e) => { if (!editingThis) onOpen(n.path, { cmdClick: e.metaKey || e.ctrlKey, shiftClick: e.shiftKey }); }}
                  onContextMenu={(e) => { e.preventDefault(); e.stopPropagation(); setMenu(menuAt(e, n.path)); }}
                >
                  <span className="fv-g" data-t={kind}>{GLYPH[kind]}</span>
                  {editingThis ? (
                    <input
                      className="rename fv-rename"
                      dir="auto"
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
                    <span className="fv-name" dir="auto">{title(n.path)}</span>
                  )}
                  <RowCounts node={n} />
                </li>
              );
            })}
          </ul>
        ) : (
          <div
            className={`empty fv-empty ${rowMark(drag, `${owner}\u0000empty`, owner, LENS).className}`}
            data-path={owner}
            {...rowDrag(geoms[0]!, LENS, { draggable: false })}
          >empty</div>
        )}
        </>}
      </div>
      {menu && <NodeMenu at={menu} set={setMenu} onCreated={beginRename} onRename={beginRename} />}
    </div>
  );
}

/**
 * The folder lens's top line in plain words: `folder`, or for a document's
 * children `extracts of <title>` when they are all extracts, else
 * `under <title>`.
 */
export function folderLabel(owner: string, id: string, children: readonly TreeNode[], docs: Record<string, DocInfo>, root: string | null): string {
  if (owner === id) return 'folder';
  const all = children.length > 0 && children.every((c) => c.kind === 'doc' && docs[c.path]?.type === 'extract');
  return `${all ? 'extracts of' : 'under'} ${titleOf(owner, docs, root)}`;
}

/** A row's counts: the cards under it, all the way down, and how many are due; nothing when there are none. */
function RowCounts({ node }: { node: TreeNode }) {
  const docs = useApp((s) => s.docs);
  const w = countWords(countsUnder(node, docs));
  if (!w.cards) return <span className="fv-meta" />;
  return <span className="fv-meta">{w.cards}{w.due && <span className="fv-due">{w.due}</span>}</span>;
}

/** `items · cards · numbers` over a lens: what it shows, kept in the store per lens id. */
export function setLensView(id: string, view: LensView): void {
  useApp.setState((s) => ({ lensViews: { ...s.lensViews, [id]: view } }));
}

function ViewSwitch({ id, view, views }: { id: string; view: LensView; views: LensView[] }) {
  return (
    <div className="fv-view">
      {views.map((v) => <button key={v} type="button" data-view={v} data-on={view === v ? '1' : '0'} onClick={() => setLensView(id, v)}>{v}</button>)}
    </div>
  );
}

// ── deck ─────────────────────────────────────────────────────────

/** A deck, or any document opened as its cards: the browser over it and everything under it. */
function DeckLens({ id, active }: { id: string; active: boolean }) {
  const docs = useApp((s) => s.docs);
  const root = useApp((s) => s.vault);
  const info = docs[id];
  const shown = useApp((s) => s.lensViews[id]);
  const view: LensView = shown === 'numbers' ? 'numbers' : 'cards';
  if (!info) return <Gone />;
  return (
    <div className="reader-wrap">
      <div className="reader deck-view folder-view">
        <div className="meta">
          <span className="crumb">{info.type}</span>
          <span className="right" title={`${plural(info.cards, 'card')}${info.due ? `, ${info.due} due` : ''}`}>{info.due ? `${info.due} due` : plural(info.cards, 'card')}</span>
        </div>
        <h1>{titleOf(id, docs, root)}</h1>
        <ViewSwitch id={id} view={view} views={['cards', 'numbers']} />
        {view === 'numbers' ? <NumbersView home={id} /> : <DeckBrowser home={id} active={active} />}
      </div>
    </div>
  );
}

function Gone() {
  return <div className="reader-wrap"><div className="reader"><div className="empty">no longer in the collection</div></div></div>;
}
