// Lenses: what a tab renders for a folder or a document, or the intake.
// Folders and decks are lists; sources, extracts, and drafts open in the reader.

import { useEffect, useState } from 'react';
import { cardFields, meta, type ClozePart } from '../format/index.js';
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
import { createNode, currentVault } from './vault.js';

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
  return <DocLens id={id} />;
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

function DeckLens({ id, active }: { id: string; active: boolean }) {
  const docs = useApp((s) => s.docs);
  const root = useApp((s) => s.vault);
  const loaded = useDoc(id);
  const info = docs[id];
  const [composer, setComposer] = useState(false);

  // `m` opens the composer; a deck has no prose to select first
  useEffect(() => {
    if (!active || composer) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.metaKey || e.ctrlKey || e.altKey || inField(e.target)) return;
      if (e.key === 'm') { e.preventDefault(); setComposer(true); }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [active, composer]);

  if (!loaded || !info) return <Gone />;
  const cards = loaded.doc.blocks.filter((b) => b.kind === 'card');
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
        {cards.length === 0 ? (!composer && <div className="empty">no cards</div>) : cards.map((b, i) => (
          <div key={b.kind === 'card' && b.id ? b.id : i} className="card-span">
            <CardText text={b.text} />
          </div>
        ))}
      </div>
    </div>
  );
}

// ── document ─────────────────────────────────────────────────────

function DocLens({ id }: { id: string }) {
  return <Reader key={id} id={id} />;
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
