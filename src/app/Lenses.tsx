// Lenses: what a tab renders for a folder or a document, or the intake.
// Folders and decks are lists; sources, extracts, and drafts open in the reader.

import { useEffect, useLayoutEffect, useMemo, useRef, useState, type DragEvent } from 'react';
import { PRI_DEFAULT, meta, type Card, type Doc } from '../format/index.js';
import { childDirOf, childrenAt, ordered, within, type TreeNode } from '../vault/index.js';
import { revealIndex } from './chrome.js';
import { CardText } from './CardText.js';
import { Composer } from './Composer.js';
import { Intake } from './Intake.js';
import { GLYPH, INTAKE, SESSION, contentsOf, findNode, kindOf, queueScope, titleOf, type NodeKind } from './names.js';
import type { OpenOpts } from './panes.js';
import { Pdf } from './Pdf.js';
import { Queue } from './Queue.js';
import { Reader } from './Reader.js';
import { Session } from './Session.js';
import { useApp, type DocInfo } from './store.js';
import { runBlockHooks, usePlugins } from '../plugins/index.js';
import { MENU_W, NodeMenu, dropMode, menuAt, placeMenu, type DropMode, type MenuAt } from './NodeMenu.js';
import { useDoc } from './useDoc.js';
import { createNode, currentVault, moveCard, openIntake, placeNode, removeCard, renameNode } from './vault.js';

interface LensProps {
  id: string;
  /** In the active pane: keys reach this lens. */
  active: boolean;
  onOpen(path: string, opts: OpenOpts): void;
}

const plural = (n: number, word: string) => `${n} ${word}${n === 1 ? '' : 's'}`;

const inField = (t: EventTarget | null) => {
  const el = t as HTMLElement | null;
  const tag = el?.tagName?.toLowerCase();
  return tag === 'input' || tag === 'textarea' || !!el?.isContentEditable;
};

export function Lens({ id, active, onOpen }: LensProps) {
  const docs = useApp((s) => s.docs);
  if (id === INTAKE) return <Intake active={active} onOpen={onOpen} />;
  if (id === SESSION) return <Session active={active} onOpen={onOpen} />;
  const scope = queueScope(id);
  if (scope) return <Queue scope={scope} active={active} />;
  const kind = kindOf(id, docs);
  if (kind === 'folder') return <FolderLens id={id} active={active} onOpen={onOpen} />;
  if (kind === 'deck') return <DeckLens id={id} active={active} />;
  // a source whose pages exist opens as pages
  if (docs[id]?.pdf) return <Pdf key={id} id={id} active={active} />;
  return <Reader key={id} id={id} active={active} />;
}

// ── folder ───────────────────────────────────────────────────────

const NEW: [NodeKind, string][] = [
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
function FolderLens({ id, onOpen }: LensProps) {
  const tree = useApp((s) => s.tree);
  const docs = useApp((s) => s.docs);
  const root = useApp((s) => s.vault);
  const order = useApp((s) => s.order);
  const fileOver = useApp((s) => s.fileOver);
  const [menu, setMenu] = useState<MenuAt | null>(null);
  const [drag, setDrag] = useState<string | null>(null);
  const [over, setOver] = useState<{ id: string; mode: DropMode } | null>(null);
  const [editing, setEditing] = useState<{ id: string; value: string } | null>(null);
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
      <div className="reader folder-view">
        <div className="meta">
          <span className="crumb">{owner === id ? 'folder' : `inside ${kindOf(owner, docs)}`}</span>
          <span className="right">{children.length ? plural(children.length, 'item') : ''}</span>
        </div>
        <h1>{title(id)}</h1>
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
      </div>
      {menu && <NodeMenu at={menu} set={setMenu} onCreated={beginRename} onRename={beginRename} />}
    </div>
  );
}

// ── deck ─────────────────────────────────────────────────────────

/** A right-click on a card row: where, which block (its id and text name it if the index goes stale), and whether the "move to…" list is showing. */
interface CardMenu { x: number; y: number; index: number; id: string | undefined; text: string; sub: boolean }

/** Every other deck a card could move to, by title. */
function otherDecks(docs: Record<string, DocInfo>, self: string, root: string | null): string[] {
  return Object.keys(docs)
    .filter((p) => p !== self && docs[p]?.type === 'deck')
    .sort((a, b) => titleOf(a, docs, root).localeCompare(titleOf(b, docs, root)));
}

/** The card blocks of a document, each with its index among the blocks. */
function cardsOf(doc: Doc | undefined): [Card, number][] {
  const out: [Card, number][] = [];
  doc?.blocks.forEach((b, i) => { if (b.kind === 'card') out.push([b, i]); });
  return out;
}

function DeckLens({ id, active }: { id: string; active: boolean }) {
  const docs = useApp((s) => s.docs);
  const root = useApp((s) => s.vault);
  const selected = useApp((s) => s.selectedCard);
  const reveal = useApp((s) => s.reveal);
  const loaded = useDoc(id);
  const info = docs[id];
  const [composer, setComposer] = useState(false);
  const [menu, setMenu] = useState<CardMenu | null>(null);
  const rows = useRef(new Map<number, HTMLDivElement>());
  const byKey = useRef(false);
  const cards = useMemo(() => cardsOf(loaded?.doc), [loaded]);
  const plugins = usePlugins();

  // the rows, drawn: every plugin's block hook sees each
  useEffect(() => {
    for (const [i, el] of rows.current) runBlockHooks(el, { path: id, block: i, where: 'deck' });
  }, [cards, id, plugins?.version]);

  // the selected row, by block index, when the selection is this deck's;
  // the inspector shows its editor and schedule
  const sel = selected?.path === id ? selected.index : null;
  const select = (index: number | null) => useApp.setState({ selectedCard: index === null ? null : { path: id, index } });

  // the selection goes with the lens, or when the document changes so that
  // the index no longer names a card; a rewrite that keeps a card there keeps it
  useEffect(() => () => {
    if (useApp.getState().selectedCard?.path === id) useApp.setState({ selectedCard: null });
  }, [id]);
  useEffect(() => {
    const cur = useApp.getState().selectedCard;
    if (cur?.path === id && loaded && loaded.doc.blocks[cur.index]?.kind !== 'card') useApp.setState({ selectedCard: null });
  }, [loaded, id]);

  // a row moved to by key comes into view
  useEffect(() => {
    if (!byKey.current || sel === null) return;
    byKey.current = false;
    rows.current.get(sel)?.scrollIntoView({ block: 'nearest' });
  }, [sel]);

  // a card opened from the palette or a query: once the deck is loaded, its
  // row is selected and brought into view; a card that is gone is let go
  useEffect(() => {
    if (!reveal || reveal.path !== id || !loaded) return;
    const i = revealIndex(loaded.doc.blocks, reveal);
    if (i >= 0) {
      select(i);
      rows.current.get(i)?.scrollIntoView({ block: 'center' });
    }
    useApp.setState({ reveal: null });
  }, [reveal, loaded, id]);

  // `op` takes the card at `index` out of this deck; when it was the selected
  // one, the row that takes its place is selected next, and a selection below
  // it follows its card up one block
  const takeOut = async (index: number, op: () => Promise<void>) => {
    setMenu(null);
    const pos = cards.findIndex(([, i]) => i === index);
    const was = sel === index;
    const below = sel !== null && sel > index;
    try {
      await op();
      if (below) select(sel - 1);
      if (!was) return;
      const after = cardsOf((await currentVault()?.read(id))?.doc);
      const row = after[Math.min(pos, after.length - 1)];
      select(row ? row[1] : null);
    } catch (e) {
      console.error(e);
    }
  };
  const remove = (index: number, b: { id?: string | undefined; text: string }) => takeOut(index, () => removeCard(id, index, b.id, b.text));
  const move = (index: number, b: { id?: string | undefined; text: string }, to: string) => takeOut(index, () => moveCard(id, index, to, b.id, b.text));
  const targets = menu ? otherDecks(docs, id, root) : [];
  const showSub = (sub: boolean) => setMenu((m) => (m ? { ...m, sub } : m));
  const menuRef = useRef<HTMLDivElement>(null);
  useLayoutEffect(() => { placeMenu(menuRef.current); }, [menu]);

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

  // keys: j k move through the rows, backspace deletes the selected one,
  // escape clears; `m` opens the composer, a deck has no prose to select first
  useEffect(() => {
    if (!active || composer) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.metaKey || e.ctrlKey || e.altKey || inField(e.target)) return;
      const at = sel === null ? -1 : cards.findIndex(([, i]) => i === sel);
      const to = (pos: number) => { const row = cards[pos]; if (row) { byKey.current = true; select(row[1]); } };
      if (e.key === 'm') { e.preventDefault(); setComposer(true); }
      else if (e.key === 'j' || e.key === 'ArrowDown') { e.preventDefault(); to(at < 0 ? 0 : Math.min(cards.length - 1, at + 1)); }
      else if (e.key === 'k' || e.key === 'ArrowUp') { e.preventDefault(); to(at < 0 ? 0 : Math.max(0, at - 1)); }
      else if ((e.key === 'Backspace' || e.key === 'Delete') && at >= 0) { e.preventDefault(); const [b, i] = cards[at]!; void remove(i, b); }
      else if (e.key === 'Escape' && sel !== null && !menu) { e.preventDefault(); select(null); }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [active, composer, cards, sel, menu]);

  if (!loaded || !info) return <Gone />;
  const save = (text: string, again: boolean, pri?: number) => {
    currentVault()?.update(id, (doc) => { doc.blocks.push(pri === undefined ? { kind: 'card', text } : { kind: 'card', text, sched: { pri } }); }).catch(console.error);
    if (!again) setComposer(false);
  };
  return (
    <div className="reader-wrap">
      <div className="reader deck-view">
        <div className="meta">
          <span className="crumb">deck</span>
          <span className="right">{plural(cards.length, 'card')}{info.due ? ` · ${info.due} due` : ''}</span>
        </div>
        <h1>{titleOf(id, docs, root)}</h1>
        {composer ? (
          <Composer seed="" form={meta(loaded.doc).defaultCard} pri={info.pri ?? PRI_DEFAULT} onSave={save} onClose={() => setComposer(false)} />
        ) : (
          <button type="button" className="deck-add" onClick={() => setComposer(true)}>+ card <kbd className="kbd">m</kbd></button>
        )}
        {cards.length === 0 ? (!composer && <div className="empty">no cards</div>) : cards.map(([b, i]) => (
          <div
            key={b.id ?? i}
            ref={(el) => { if (el) rows.current.set(i, el); else rows.current.delete(i); }}
            className={sel === i ? 'card-span selected' : 'card-span'}
            data-menu={menu?.index === i ? '1' : '0'}
            onClick={() => select(i)}
            onContextMenu={(e) => { e.preventDefault(); select(i); setMenu({ x: Math.min(e.clientX, window.innerWidth - MENU_W), y: e.clientY, index: i, id: b.id, text: b.text, sub: false }); }}
          >
            <CardText text={b.text} />
            <button type="button" className="cs-del" title="delete card" aria-label="delete card" onClick={(e) => { e.stopPropagation(); void remove(i, b); }}>×</button>
          </div>
        ))}
        {menu && (
          <div
            className="ctx-menu"
            ref={menuRef}
            style={{ left: menu.x, top: menu.y }}
            onMouseDown={(e) => e.stopPropagation()}
            onContextMenu={(e) => e.preventDefault()}
          >
            {!menu.sub ? (
              <>
                {targets.length > 0 && (
                  <>
                    <div className="ci has-sub" onClick={(e) => { e.stopPropagation(); showSub(true); }}>
                      <span className="cg">→</span>move to…<span className="ck">▸</span>
                    </div>
                    <div className="cd" />
                  </>
                )}
                <div className="ci danger" onClick={() => void remove(menu.index, menu)}>
                  <span className="cg">⌫</span>delete card
                </div>
              </>
            ) : (
              <div className="sub-wrap">
                <div className="ci back" onClick={(e) => { e.stopPropagation(); showSub(false); }}>
                  <span className="cg">◂</span>move to…
                </div>
                <div className="cd" />
                <div className="sub-scroll">
                  {targets.map((p) => (
                    <div key={p} className="ci" onClick={() => void move(menu.index, menu, p)}>
                      <span className="cg">{GLYPH.deck}</span>{titleOf(p, docs, root)}
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

function Gone() {
  return <div className="reader-wrap"><div className="reader"><div className="empty">no longer in the collection</div></div></div>;
}
