// The one context menu for a node, shared by the sidebar's tree and the
// folder lens: new source / folder / deck / draft (into the folder, or the
// document's folder), import a file…, add from text or a link (the intake), and for a
// node rename, move to… (a list opened on a click), and delete. The `+` in
// the sidebar's root row opens the same menu without the node's half.
// Escape and a press outside close it; it stays inside the window at the
// right (`MENU_W`) and the bottom (`placeMenu`).

import { useEffect, useLayoutEffect, useRef, type Dispatch, type MouseEvent, type SetStateAction } from 'react';
import type { NodeType } from '../format/index.js';
import { childDirOf, dirOf, within } from '../vault/index.js';
import { importFiles } from './land.js';
import { GLYPH, findNode, folderPaths, kindOf, titleOf, type NodeKind } from './names.js';
import { useApp } from './store.js';
import { containerOf, createNode, moveNode, openIntake, removeNode } from './vault.js';

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
}

/** A menu for `id` at the pointer, kept off the right edge. */
export const menuAt = (e: { clientX: number; clientY: number }, id: string, plus = false): MenuAt =>
  ({ id, x: Math.min(e.clientX, window.innerWidth - MENU_W), y: e.clientY, sub: false, ...(plus ? { plus } : {}) });

/** One order for every menu (right-click and the sidebar's `+`): the documents first, the folder last. */
const NEW_KINDS: [NodeKind, string][] = [
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
}

export function NodeMenu({ at, set, onCreated, onRename }: Props) {
  const tree = useApp((s) => s.tree);
  const docs = useApp((s) => s.docs);
  const root = useApp((s) => s.vault);
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

  if (at.id !== '' && !findNode(tree, at.id)) return null;
  const kind: NodeKind = at.id === '' ? 'folder' : kindOf(at.id, docs);
  // new items, imports, and the intake land in the folder, or the one holding the document
  const into = containerOf(at.id);
  const dir = kind === 'folder' ? at.id : dirOf(at.id);
  const act = (fn: () => void) => (e: MouseEvent) => { e.stopPropagation(); fn(); set(null); };
  const create = (k: NodeKind) => { createNode(into, k as NodeType | 'folder').then(onCreated).catch(fail); };
  const sub = (on: boolean) => (e: MouseEvent) => { e.stopPropagation(); set((m) => (m ? { ...m, sub: on } : m)); };
  const targets = folderPaths(tree).filter((f) => f !== at.id && f !== dirOf(at.id) && !within(f, childDirOf(at.id)));
  const node = at.id !== '' && !at.plus;

  return (
    <div
      className="ctx-menu"
      ref={ref}
      style={{ left: at.x, top: at.y }}
      onMouseDown={(e) => e.stopPropagation()}
      onContextMenu={(e) => { e.preventDefault(); e.stopPropagation(); }}
    >
      {!at.sub ? (
        <>
          {NEW_KINDS.map(([k, label]) => (
            <div key={k} className="ci" onClick={act(() => create(k))}>
              <span className="cg">{GLYPH[k]}</span>{label}
            </div>
          ))}
          <div className="cd" />
          <div className="ci" onClick={act(() => { void importFiles(dir).catch(fail); })}>
            <span className="cg">↧</span>import a file…
          </div>
          <div className="ci" onClick={act(() => openIntake(dir))}>
            <span className="cg">{GLYPH.intake}</span>add from text or a link
          </div>
          {node && (
            <>
              <div className="cd" />
              <div className="ci" onClick={act(() => onRename(at.id))}>
                <span className="cg">✎</span>rename<span className="ck">F2</span>
              </div>
              <div className="ci has-sub" onClick={sub(true)}>
                <span className="cg">→</span>move to…<span className="ck">▸</span>
              </div>
              <div className="cd" />
              <div className="ci danger" onClick={act(() => { removeNode(at.id).catch(fail); })}>
                <span className="cg">⌫</span>delete {kind}
              </div>
            </>
          )}
        </>
      ) : (
        <div className="sub-wrap">
          <div className="ci back" onClick={sub(false)}>
            <span className="cg">◂</span>move to…
          </div>
          <div className="cd" />
          <div className="sub-scroll">
            {targets.map((f) => (
              <div key={f} className="ci" onClick={act(() => { moveNode(at.id, f).catch(fail); })}>
                <span className="cg">/</span>{titleOf(f, docs, root)}
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
