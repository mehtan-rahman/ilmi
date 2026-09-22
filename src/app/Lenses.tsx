// Lenses: what a tab renders for a folder or a document. Folders and decks
// are lists. Sources, extracts, and drafts get a read-only page until the
// reader (milestone 5) replaces it; nothing here edits a file.

import type { ReactNode } from 'react';
import { cardFields, type Block, type ClozePart } from '../format/index.js';
import type { TreeNode } from '../vault/index.js';
import { GLYPH, contentsOf, findNode, kindOf, titleOf, type NodeKind } from './names.js';
import type { OpenOpts } from './panes.js';
import { useApp } from './store.js';
import { useDoc } from './useDoc.js';
import { createNode } from './vault.js';

interface LensProps {
  id: string;
  onOpen(path: string, opts: OpenOpts): void;
}

const plural = (n: number, word: string) => `${n} ${word}${n === 1 ? '' : 's'}`;

export function Lens({ id, onOpen }: LensProps) {
  const docs = useApp((s) => s.docs);
  const kind = kindOf(id, docs);
  if (kind === 'folder') return <FolderLens id={id} onOpen={onOpen} />;
  if (kind === 'deck') return <DeckLens id={id} />;
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

function DeckLens({ id }: { id: string }) {
  const docs = useApp((s) => s.docs);
  const root = useApp((s) => s.vault);
  const loaded = useDoc(id);
  const info = docs[id];
  if (!loaded || !info) return <Gone />;
  const cards = loaded.doc.blocks.filter((b) => b.kind === 'card');
  return (
    <div className="reader-wrap">
      <div className="reader deck-view">
        <div className="meta">
          <span className="crumb">deck</span>
          <span className="right">{plural(cards.length, 'card')}{info.due ? ` · ${info.due} due` : ''}</span>
        </div>
        <h1>{titleOf(id, docs, root)}</h1>
        {cards.length === 0 ? <div className="empty">no cards</div> : cards.map((b, i) => (
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
  const docs = useApp((s) => s.docs);
  const root = useApp((s) => s.vault);
  const loaded = useDoc(id);
  const info = docs[id];
  if (!loaded || !info) return <Gone />;
  const crumb = [info.type, info.frozen ? 'frozen' : null].filter(Boolean).join(' · ');
  return (
    <div className="reader-wrap">
      <div className="reader doc-view">
        <div className="meta">
          <span className="crumb">{crumb}</span>
          <span className="right">{info.cards ? `${plural(info.cards, 'card')}${info.due ? ` · ${info.due} due` : ''}` : ''}</span>
        </div>
        <h1>{titleOf(id, docs, root)}</h1>
        {loaded.doc.blocks.map((b, i) => <BlockView key={i} block={b} />)}
      </div>
    </div>
  );
}

function BlockView({ block }: { block: Block }): ReactNode {
  switch (block.kind) {
    case 'heading': {
      const level = Math.min(6, Math.max(2, block.level + 1));
      const Tag = `h${level}` as 'h2' | 'h3' | 'h4' | 'h5' | 'h6';
      return <Tag>{block.text}</Tag>;
    }
    case 'paragraph':
      return <p className={block.extracts?.length ? 'extracted' : undefined}>{block.text}</p>;
    case 'card':
      return <div className="card-span"><CardText text={block.text} /></div>;
    case 'raw':
      return <pre className="raw">{block.text}</pre>;
  }
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
