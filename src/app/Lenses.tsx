// Lenses: what a tab renders for a folder or a document, or the intake.
// Folders and decks are lists; sources, extracts, and drafts open in the reader.

import { useEffect, useMemo, useRef, useState } from 'react';
import { cardFields, meta, type Card, type ClozePart, type Doc } from '../format/index.js';
import type { TreeNode } from '../vault/index.js';
import { Composer } from './Composer.js';
import { Intake } from './Intake.js';
import { GLYPH, INTAKE, SESSION, contentsOf, findNode, kindOf, queueScope, titleOf, type NodeKind } from './names.js';
import type { OpenOpts } from './panes.js';
import { Queue } from './Queue.js';
import { Reader } from './Reader.js';
import { Session } from './Session.js';
import { useApp } from './store.js';
import { useDoc } from './useDoc.js';
import { createNode, currentVault, removeCard } from './vault.js';

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
  return <Reader key={id} id={id} active={active} />;
}

// ── folder ───────────────────────────────────────────────────────

const NEW: [NodeKind, string][] = [
  ['source', '+ source'],
  ['deck', '+ deck'],
  ['draft', '+ draft'],
  ['folder', '+ folder'],
];

function FolderLens({ id, onOpen }: LensProps) {
  const tree = useApp((s) => s.tree);
  const docs = useApp((s) => s.docs);
  const root = useApp((s) => s.vault);
  const node = id === '' ? undefined : findNode(tree, id);
  if (id !== '' && node?.kind !== 'folder') return <Gone />;
  const children: TreeNode[] = node?.kind === 'folder' ? node.children : tree;
  return (
    <div className="reader-wrap">
      <div className="reader folder-view">
        <div className="meta">
          <span className="crumb">folder</span>
          <span className="right">{children.length ? plural(children.length, 'item') : ''}</span>
        </div>
        <h1>{titleOf(id, docs, root)}</h1>
        <div className="fv-new">
          {NEW.map(([kind, label]) => (
            <button key={kind} type="button" onClick={() => void createNode(id, kind).catch(console.error)}>{label}</button>
          ))}
        </div>
        {children.length > 0 ? (
          <ul className="fv-contents">
            {children.map((n) => {
              const kind: NodeKind = n.kind === 'folder' ? 'folder' : kindOf(n.path, docs);
              return (
                <li key={n.path} className="fv-row" onClick={(e) => onOpen(n.path, { cmdClick: e.metaKey || e.ctrlKey, shiftClick: e.shiftKey })}>
                  <span className="fv-g" data-t={kind}>{GLYPH[kind]}</span>
                  <span className="fv-name">{titleOf(n.path, docs, root)}</span>
                  <span className="fv-meta">{contentsOf(n, docs[n.path])}</span>
                </li>
              );
            })}
          </ul>
        ) : (
          <div className="empty">empty</div>
        )}
      </div>
    </div>
  );
}

// ── deck ─────────────────────────────────────────────────────────

/** A right-click on a card row: where, and which block (its id and text name it if the index goes stale). */
interface CardMenu { x: number; y: number; index: number; id: string | undefined; text: string }

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
  const loaded = useDoc(id);
  const info = docs[id];
  const [composer, setComposer] = useState(false);
  const [menu, setMenu] = useState<CardMenu | null>(null);
  const rows = useRef(new Map<number, HTMLDivElement>());
  const byKey = useRef(false);
  const cards = useMemo(() => cardsOf(loaded?.doc), [loaded]);

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
  const save = (text: string, again: boolean) => {
    currentVault()?.update(id, (doc) => { doc.blocks.push({ kind: 'card', text }); }).catch(console.error);
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
          <Composer seed="" form={meta(loaded.doc).defaultCard} onSave={save} onClose={() => setComposer(false)} />
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
            onContextMenu={(e) => { e.preventDefault(); select(i); setMenu({ x: e.clientX, y: e.clientY, index: i, id: b.id, text: b.text }); }}
          >
            <CardText text={b.text} />
            <button type="button" className="cs-del" title="delete card" aria-label="delete card" onClick={(e) => { e.stopPropagation(); void remove(i, b); }}>×</button>
          </div>
        ))}
        {menu && (
          <div
            className="ctx-menu"
            style={{ left: menu.x, top: menu.y }}
            onMouseDown={(e) => e.stopPropagation()}
            onContextMenu={(e) => e.preventDefault()}
          >
            <div className="ci danger" onClick={() => void remove(menu.index, menu)}>
              <span className="cg">⌫</span>delete card
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

function CardText({ text }: { text: string }) {
  const f = cardFields(text);
  if (!f) return <span>{text}</span>;
  if (f.form === 'cloze') return <span className="cs-body">{f.parts.map((p, i) => <Part key={i} part={p} />)}</span>;
  if (f.form === 'qa') return <span className="cs-body"><span className="cs-q">{f.front}</span><span className="cs-a">{f.back}</span></span>;
  return <span className="cs-body">{f.left} <span className="cs-arrow">⇄</span> {f.right}</span>;
}

function Part({ part }: { part: ClozePart }) {
  return typeof part === 'string' ? <>{part}</> : <span className="cz">{part.answer}</span>;
}

function Gone() {
  return <div className="reader-wrap"><div className="reader"><div className="empty">no longer in the vault</div></div></div>;
}
