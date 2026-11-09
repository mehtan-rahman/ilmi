// The one context menu for a node, shared by the sidebar's tree and the
// folder lens: new note / source / deck / draft / folder (into the folder, or into
// the document, its children directory made on demand), import a file…, add
// from text or a link (the intake), `sort by name` when the directory has an
// order of its own, and for a node rename, move to… (a list of folders and
// documents opened on a click, filtered as you type), `study` on anything with cards under it
// (a session over them, deckOps.ts), `revisit` on a note not yet enrolled
// (its reading line, no marker), and delete (asking first when there is
// something under it). A document's menu has `show as tabs` / `show as
// tree` (its `tabs` field, `tabs.ts`), and on a tab rail's row `add subtab`; a node's has
// `duplicate` (a copy right after it). A rail row's `···` (`tab`) is the short one: add
// subtab, rename, duplicate, move to…, delete. Every delete has the notice's undo
// (`remove.ts`). The `+` in the sidebar's root row opens the same menu
// without the node's half.
// Escape and a press outside close it; it stays inside the window at the
// right (`MENU_W`) and the bottom (`placeMenu`).

import { useEffect, useLayoutEffect, useRef, useState, type Dispatch, type MouseEvent, type SetStateAction } from 'react';
import type { NodeType } from '../format/index.js';
import { childDirOf, dirOf, isDoc, isPdfPath } from '../vault/index.js';
import { hasCards, studyDeck } from './deckOps.js';
import { importFiles } from './land.js';
import { GLYPH, descendants, findNode, kindOf, moveTargets, titleOf, type MoveTarget, type NodeKind } from './names.js';
import { useApp } from './store.js';
import { deleteNode } from './remove.js';
import { createNode, duplicateNode, enrolReading, moveNode, openIntake, setTabs, sortByName } from './vault.js';
import { Glyph } from './icons.js';

export const MENU_W = 190;

/** Keep a context menu inside the window at the bottom edge, as `MENU_W` keeps it at the right. */
export function placeMenu(el: HTMLElement | null): void {
  if (!el) return;
  const r = el.getBoundingClientRect();
  if (r.bottom > window.innerHeight) el.style.top = `${Math.max(0, window.innerHeight - r.height - 6)}px`;
}

/** An open menu: the node it is for (`''` the root), where, whether `move to…` is showing, and whether it is the `+` menu. */
export interface MenuAt {
  id: string;
  x: number;
  y: number;
  sub: boolean;
  plus?: boolean;
  /** A tab rail row's `···`: only add subtab, rename, duplicate, move to…, delete (Google Docs' tab menu). */
  tab?: boolean;
}

/** A menu for `id` at the pointer, kept off the right edge. */
export const menuAt = (e: { clientX: number; clientY: number }, id: string, plus = false): MenuAt =>
  ({ id, x: Math.min(e.clientX, window.innerWidth - MENU_W), y: e.clientY, sub: false, ...(plus ? { plus } : {}) });

/** One order for every menu (right-click and the sidebar's `+`): a note first, the other documents, the folder last. */
const NEW_KINDS: [NodeKind, string][] = [
  ['note', 'new note'],
  ['source', 'new source'],
  ['deck', 'new deck'],
  ['draft', 'new draft'],
  ['folder', 'new folder'],
];

interface Props {
  at: MenuAt;
  set: Dispatch<SetStateAction<MenuAt | null>>;
  /** A new node was made: the host starts its inline rename. */
  onCreated(path: string): void;
  /** `rename` was chosen: the host starts its inline rename. */
  onRename(id: string): void;
  /** On a tab rail's row (`Rail.tsx`): `add subtab` shows, and makes one under the row. */
  onSubtab?(id: string): void;
  /** `move to…` moved the node: it is at `to` now. */
  onMoved?(from: string, to: string): void;
}

/** Marks and case off, so `arabi` finds `ʿarabī`. */
const fold = (s: string) => s.normalize('NFD').replace(/[\p{M}ʻʼʾʿ']/gu, '').toLowerCase();

/**
 * `move to…`'s list: a field that filters it as you type (the whole
 * collection's folders and documents can be hundreds of rows), ↑ ↓ to pick,
 * ⏎ to move. Unfiltered it is the tree, indented; filtered, the matches flat,
 * each with the place it is in.
 */
function MoveList({ targets, back, move }: { targets: MoveTarget[]; back(e: MouseEvent): void; move(dir: string): void }) {
  const docs = useApp((s) => s.docs);
  const root = useApp((s) => s.vault);
  const [q, setQ] = useState('');
  const [pick, setPick] = useState(0);
  const listRef = useRef<HTMLDivElement>(null);
  const name = (p: string) => titleOf(p, docs, root);
  const want = fold(q.trim());
  const shown = want ? targets.filter((t) => fold(name(t.path)).includes(want)) : targets;
  const k = Math.min(pick, Math.max(0, shown.length - 1));
  // the picked row kept in view as the keys move it
  useEffect(() => { listRef.current?.querySelector<HTMLElement>('.ci.picked')?.scrollIntoView?.({ block: 'nearest' }); }, [k, want]);
  const where = (p: string) => {
    const d = dirOf(p);
    if (d === '') return '';
    const up = findNode(useApp.getState().tree, d) ? d : `${d}.md`;
    return name(up);
  };
  return (
    <div className="sub-wrap">
      <div className="ci back" onClick={back}>
        <span className="cg"><Glyph g="◂" /></span>move to…
      </div>
      <input
        className="move-filter"
        placeholder="find a folder or note"
        value={q}
        autoFocus
        spellCheck={false}
        onChange={(e) => { setQ(e.target.value); setPick(0); }}
        onKeyDown={(e) => {
          if (e.key === 'ArrowDown') { e.preventDefault(); setPick(Math.min(shown.length - 1, k + 1)); }
          else if (e.key === 'ArrowUp') { e.preventDefault(); setPick(Math.max(0, k - 1)); }
          else if (e.key === 'Enter') { e.preventDefault(); const t = shown[k]; if (t) move(t.dir); }
        }}
      />
      <div className="cd" />
      <div className="sub-scroll" ref={listRef}>
        {shown.map((t, i) => {
          const kind: NodeKind = t.path === '' ? 'folder' : kindOf(t.path, docs);
          return (
            <div
              key={t.path}
              className={`ci${i === k ? ' picked' : ''}`}
              data-path={t.path}
              style={{ paddingLeft: want ? 10 : 10 + t.depth * 12 }}
              onMouseEnter={() => setPick(i)}
              onClick={(e) => { e.stopPropagation(); move(t.dir); }}
            >
              <span className="cg"><Glyph g={GLYPH[kind]} /></span>
              <span className="mv-name">{name(t.path)}</span>
              {want && where(t.path) && <span className="mv-where">{where(t.path)}</span>}
            </div>
          );
        })}
        {shown.length === 0 && <div className="ci none">nothing called that</div>}
      </div>
    </div>
  );
}

export function NodeMenu({ at, set, onCreated, onRename, onSubtab, onMoved }: Props) {
  const tree = useApp((s) => s.tree);
  const docs = useApp((s) => s.docs);
  const root = useApp((s) => s.vault);
  const order = useApp((s) => s.order);
  const [asking, setAsking] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  const fail = (e: unknown) => console.error(e);

  // the menu closes on any outside press or escape
  useEffect(() => {
    const close = () => set(null);
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') set(null); };
    window.addEventListener('mousedown', close);
    window.addEventListener('keydown', onKey);
    return () => {
      window.removeEventListener('mousedown', close);
      window.removeEventListener('keydown', onKey);
    };
  }, [set]);

  // the menu stays inside the window at the bottom edge, with the list open or not
  useLayoutEffect(() => { placeMenu(ref.current); }, [at]);

  const found = at.id === '' ? undefined : findNode(tree, at.id);
  // its node moved or deleted meanwhile: the menu is closed, not only hidden (a node later at that path would bring it back)
  useEffect(() => { if (at.id !== '' && !found) set(null); }, [at.id, found, set]);
  if (at.id !== '' && !found) return null;
  const kind: NodeKind = at.id === '' ? 'folder' : kindOf(at.id, docs);
  const pdfAlone = isPdfPath(at.id);
  // new items, imports, and the intake land in the folder, or inside the document (its children directory)
  const dir = childDirOf(at.id);
  const act = (fn: () => void) => (e: MouseEvent) => { e.stopPropagation(); fn(); set(null); };
  const create = (k: NodeKind) => { createNode(dir, k as NodeType | 'folder').then(onCreated).catch(fail); };
  const sub = (on: boolean) => (e: MouseEvent) => { e.stopPropagation(); set((m) => (m ? { ...m, sub: on } : m)); };
  const targets = moveTargets(tree, at.id, order);
  const node = at.id !== '' && !at.plus;
  const under = found ? descendants(found) : 0;
  // a node with something under it asks before it goes, and says how much
  const del = (e: MouseEvent) => {
    e.stopPropagation();
    if (under > 0 && !asking) { setAsking(true); return; }
    deleteNode(at.id).catch(fail);
    set(null);
  };

  return (
    <div
      className="ctx-menu"
      ref={ref}
      style={{ left: at.x, top: at.y }}
      onMouseDown={(e) => e.stopPropagation()}
      onContextMenu={(e) => { e.preventDefault(); e.stopPropagation(); }}
    >
      {!at.sub && at.tab ? (
        <>
          {onSubtab && (
            <div className="ci" data-act="subtab" onClick={act(() => onSubtab(at.id))}>
              <span className="cg"><Glyph g="+" /></span>add subtab
            </div>
          )}
          {hasCards(at.id) && (
            <div className="ci" data-act="study" onClick={act(() => { studyDeck(at.id); })}>
              <span className="cg"><Glyph g={GLYPH.session} /></span>study
            </div>
          )}
          <div className="ci" data-act="rename" onClick={act(() => onRename(at.id))}>
            <span className="cg"><Glyph g="✎" /></span>rename<span className="ck">F2</span>
          </div>
          <div className="ci" data-act="duplicate" onClick={act(() => { duplicateNode(at.id).catch(fail); })}>
            <span className="cg"><Glyph g="⧉" /></span>duplicate
          </div>
          <div className="ci has-sub" data-act="move" onClick={sub(true)}>
            <span className="cg"><Glyph g="→" /></span>move to…<span className="ck"><Glyph g="▸" /></span>
          </div>
          <div className="cd" />
          <div className={`ci danger${asking ? ' asking' : ''}`} data-act="delete" onClick={del}>
            <span className="cg"><Glyph g="⌫" /></span>{asking ? `delete with ${under} inside?` : 'delete'}
          </div>
        </>
      ) : !at.sub ? (
        <>
          {/* a PDF on its own holds nothing (milestone 70): nothing is made under it */}
          {!pdfAlone && NEW_KINDS.map(([k, label]) => (
            <div key={k} className="ci" onClick={act(() => create(k))}>
              <span className="cg"><Glyph g={GLYPH[k]} /></span>{label}
            </div>
          ))}
          {!pdfAlone && <div className="cd" />}
          {!pdfAlone && (
            <div className="ci" onClick={act(() => { void importFiles(dir).catch(fail); })}>
              <span className="cg"><Glyph g="↧" /></span>import a file…
            </div>
          )}
          {!pdfAlone && (
            <div className="ci" onClick={act(() => openIntake(dir))}>
              <span className="cg"><Glyph g={GLYPH.intake} /></span>add from text or a link
            </div>
          )}
          {node && kind === 'note' && !docs[at.id]?.read && (
            <div className="ci" data-act="revisit" onClick={act(() => { enrolReading(at.id).catch(fail); })}>
              <span className="cg"><Glyph g="▤" /></span>revisit
            </div>
          )}
          {!at.plus && hasCards(at.id) && (
            <div className="ci" data-act="study" onClick={act(() => { studyDeck(at.id); })}>
              <span className="cg"><Glyph g={GLYPH.session} /></span>study
            </div>
          )}
          {order[dir] && (
            <>
              <div className="cd" />
              <div className="ci" onClick={act(() => { sortByName(dir).catch(fail); })}>
                <span className="cg"><Glyph g="↕" /></span>sort by name
              </div>
            </>
          )}
          {node && isDoc(at.id) && (
            <>
              <div className="cd" />
              {onSubtab && (
                <div className="ci" onClick={act(() => onSubtab(at.id))}>
                  <span className="cg"><Glyph g="+" /></span>add subtab
                </div>
              )}
              <div className="ci" onClick={act(() => { setTabs(at.id, !docs[at.id]?.tabs).catch(fail); })}>
                <span className="cg"><Glyph g={docs[at.id]?.tabs ? '⋮' : '⊞'} /></span>{docs[at.id]?.tabs ? 'show as tree' : 'show as tabs'}
              </div>
            </>
          )}
          {node && !isDoc(at.id) && !pdfAlone && onSubtab && (
            <>
              <div className="cd" />
              <div className="ci" onClick={act(() => onSubtab(at.id))}>
                <span className="cg"><Glyph g="+" /></span>add subtab
              </div>
            </>
          )}
          {node && (
            <>
              {!pdfAlone && <div className="cd" />}
              <div className="ci" onClick={act(() => onRename(at.id))}>
                <span className="cg"><Glyph g="✎" /></span>rename<span className="ck">F2</span>
              </div>
              <div className="ci" data-act="duplicate" onClick={act(() => { duplicateNode(at.id).catch(fail); })}>
                <span className="cg"><Glyph g="⧉" /></span>duplicate
              </div>
              <div className="ci has-sub" onClick={sub(true)}>
                <span className="cg"><Glyph g="→" /></span>move to…<span className="ck"><Glyph g="▸" /></span>
              </div>
              <div className="cd" />
              <div className={`ci danger${asking ? ' asking' : ''}`} onClick={del}>
                <span className="cg"><Glyph g="⌫" /></span>{asking ? `delete with ${under} inside?` : `delete ${kind}`}
              </div>
            </>
          )}
        </>
      ) : (
        <MoveList targets={targets} back={sub(false)} move={(dir) => { const from = at.id; moveNode(from, dir).then((to) => onMoved?.(from, to)).catch(fail); set(null); }} />
      )}
    </div>
  );
}
