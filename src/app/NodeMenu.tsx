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
// Opened on one of several rows selected in the tree (`many`, `treeSelect.ts`) it is the
// menu of them all, and holds only what several can take: open in new tabs, study,
// duplicate, move to…, delete n items (asked once, undone once). Under a finger the
// tree's menu has `select`, which is how several are picked there.
// Escape and a press outside close it; it stays inside the window at the
// right (`MENU_W`) and the bottom (`placeMenu`). Its keys are every menu's
// (`menuKeys` in `popMenu.ts`): it takes the focus, ↓ ↑ Home End move, ⏎ or
// space runs, → opens `move to…` and ← or Escape leaves it; ⇧F10 or the Menu
// key on a row opens it there (`menuAtRow`).

import { visibleBottom } from './viewport.js';
import { Fragment, useEffect, useLayoutEffect, useRef, useState, type Dispatch, type MouseEvent, type ReactElement, type ReactNode, type SetStateAction } from 'react';
import type { NodeType } from '../format/index.js';
import { NEW_NAMES, childDirOf, dirOf, isDoc, isPdfPath } from '../vault/index.js';
import { hasCards, studyDeck, studyNodes } from './deckOps.js';
import { importFiles, failed } from './land.js';
import { GLYPH, WRITTEN_GLYPH, descendants, findNode, glyphOf, itemsLabel, kindOf, moveTargets, titleOf, type MoveTarget, type NodeKind } from './names.js';
import { createWritten } from './written.js';
import { useApp } from './store.js';
import { deleteNode, deleteNodes } from './remove.js';
import { createNode, duplicateNode, enrolReading, moveNode, openDir, openIntake, openNode, openNodeBeside, setTabs, sortByName } from './vault.js';
import { Glyph } from './icons.js';
import { menuKeys } from './popMenu.js';
import { createPortal } from 'react-dom';

export const MENU_W = 190;

/**
 * A menu as the page's own under a finger, not its pane's or its sidebar's: a sheet moved by its transform, and a
 * pane that lays its lens out by its own width, hold what is fixed inside them and cut it off at their edge.
 */
export const onPage = (menu: ReactElement): ReactNode => (document.documentElement.dataset.mobile === '1' ? createPortal(menu, document.body) : menu);

/** Keep a context menu inside the window at the bottom edge, as `MENU_W` keeps it at the right. */
export function placeMenu(el: HTMLElement | null): void {
  if (!el) return;
  const r = el.getBoundingClientRect();
  // (on a device the foot of the glass is the home bar's: the menu ends above it)
  const foot = document.documentElement.dataset.mobile === '1' ? 26 : 6;
  if (r.bottom > visibleBottom() - foot + 6) el.style.top = `${Math.max(0, visibleBottom() - r.height - foot)}px`;
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
  /**
   * The row is one of several selected (the tree's): what the menu acts on, the topmost of them in the order drawn,
   * `id` or a row above it among them. `all` is every row selected, for `open in new tabs`.
   */
  many?: readonly string[];
  all?: readonly string[];
}

/** A menu for `id` at the pointer, kept off the right edge. */
export const menuAt = (e: { clientX: number; clientY: number }, id: string, plus = false): MenuAt =>
  ({ id, x: Math.min(e.clientX, window.innerWidth - MENU_W), y: e.clientY, sub: false, ...(plus ? { plus } : {}) });

/** A menu for `id` under its row `el`, as the keyboard opens it (⇧F10, the Menu key): just inside the row's start, at its foot. */
export const menuAtRow = (el: Element, id: string): MenuAt => {
  const r = el.getBoundingClientRect();
  return menuAt({ clientX: r.left + 24, clientY: r.bottom - 2 }, id);
};

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
  /** ⌘-click on this surface's rows selects (the tree): `open in new tab` is the only way to one, and names no click. */
  selects?: boolean;
  /** Under a finger: `select` was chosen on the row (the tree picks several by taps from there). */
  onSelect?(id: string): void;
  /** Something the menu began on the nodes (a move of several) ends with `work`. */
  onWork?(work: Promise<unknown>): void;
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
          return (
            <div
              key={t.path}
              className={`ci${i === k ? ' picked' : ''}`}
              data-path={t.path}
              style={{ paddingLeft: want ? 10 : 10 + t.depth * 12 }}
              onMouseEnter={() => setPick(i)}
              onClick={(e) => { e.stopPropagation(); move(t.dir); }}
            >
              <span className="cg"><Glyph g={glyphOf(t.path, docs)} /></span>
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

export function NodeMenu({ at, set, onCreated, onRename, onSubtab, onMoved, selects, onSelect, onWork }: Props) {
  const tree = useApp((s) => s.tree);
  const docs = useApp((s) => s.docs);
  const root = useApp((s) => s.vault);
  const order = useApp((s) => s.order);
  const [asking, setAsking] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  const fail = failed('that');

  // an item was run (not Escape, not a press outside)
  const ran = useRef(false);

  // the menu closes on any outside press
  useEffect(() => {
    const close = () => set(null);
    window.addEventListener('mousedown', close);
    return () => window.removeEventListener('mousedown', close);
  }, [set]);

  // its keys (`menuKeys`): the focus is the menu's while it is open, Escape closes it, and the focus goes back as it
  // closes. An item run from a menu the pointer opened gives the keys to the page instead: the press that opened the
  // menu left the focus on the tree, whose jump-to-a-name would take the page's bare keys (a session's grades after
  // `study`); a rename's field takes it after. One the keyboard opened leaves the focus on the tree, where it was.
  useLayoutEffect(() => {
    const keys = menuKeys(ref.current, { close: () => set(null) });
    return () => {
      keys.dispose();
      const on = document.activeElement;
      if (ran.current && !keys.byKey && on instanceof HTMLElement && on.matches('.tree')) on.blur();
    };
  }, [set]);

  // the menu stays inside the window at the bottom edge, with the list open or not
  const phone = useApp((s) => s.phone);
  const mobile = useApp((s) => s.mobile);
  useLayoutEffect(() => { placeMenu(ref.current); }, [at]);

  const found = at.id === '' ? undefined : findNode(tree, at.id);
  // several: every one of them still there, or the menu is of something else than it said
  const many = at.many && at.many.length > 1 ? at.many : null;
  const lost = (at.id !== '' && !found) || (many !== null && many.some((p) => !findNode(tree, p)));
  // its node moved or deleted meanwhile: the menu is closed, not only hidden (a node later at that path would bring it back)
  useEffect(() => { if (lost) set(null); }, [lost, set]);
  if (lost) return null;
  const kind: NodeKind = at.id === '' ? 'folder' : kindOf(at.id, docs);
  const pdfAlone = isPdfPath(at.id);
  // new items, imports, and the intake land in the folder, or inside the document (its children directory)
  const dir = childDirOf(at.id);
  const act = (fn: () => void) => (e: MouseEvent) => { e.stopPropagation(); ran.current = true; fn(); set(null); };
  const create = (k: NodeKind) => { createNode(dir, k as NodeType | 'folder').then(onCreated).catch(fail); };
  // written notes (milestone 82): made where a note would be, named the same way
  const createPaper = () => { createWritten(dir, NEW_NAMES.note).then((p) => { openDir(dir); onCreated(p); }).catch(fail); };
  const sub = (on: boolean) => (e: MouseEvent) => { e.stopPropagation(); set((m) => (m ? { ...m, sub: on } : m)); };
  const targets = moveTargets(tree, many ?? at.id, order);
  const node = at.id !== '' && !at.plus;
  const under = many ? many.reduce((n, p) => n + descendants(findNode(tree, p)!), 0) : found ? descendants(found) : 0;
  // a node with something under it asks before it goes, and says how much; several are asked about once
  const del = (e: MouseEvent) => {
    e.stopPropagation();
    if (under > 0 && !asking) { setAsking(true); return; }
    if (many) deleteNodes(many).catch(failed('delete'));
    else deleteNode(at.id).catch(failed('delete'));
    ran.current = true;
    set(null);
  };
  /** `move to…`: the node, or each of several in their order, into `dir`; the host hears where each went. */
  const moveTo = (dir: string) => {
    ran.current = true;
    const work = (async () => {
      for (const from of many ?? [at.id]) onMoved?.(from, await moveNode(from, dir));
    })().catch(failed('move'));
    onWork?.(work);
    set(null);
  };
  const duplicateAll = async (paths: readonly string[]) => { for (const p of paths) await duplicateNode(p); };

  // under a finger there is no ⌘-click: `select` begins a selection of several with this row (the tree's)
  const pick = node && mobile && onSelect ? (
    <div className="ci" data-act="select" onClick={act(() => onSelect(at.id))}>
      <span className="cg"><Glyph g="✓" /></span>select
    </div>
  ) : null;

  // a row opened in a tab of its own, or in the pane beside (a pane made when there is one): what ⌘-click and
  // ⌘⇧-click do, for a hand with no ⌘. Not on a phone, which shows one thing
  const opens = node && !phone ? (
    <>
      <div className="ci" data-act="open-tab" onClick={act(() => openNode(at.id, { newTab: true }))}>
        <span className="cg"><Glyph g="+" /></span>open in new tab{!selects && <span className="ck long">⌘ click</span>}
      </div>
      <div className="ci" data-act="open-beside" onClick={act(() => openNodeBeside(at.id))}>
        <span className="cg"><Glyph g="⊟" /></span>open beside<span className="ck long">⇧⌘ click</span>
      </div>
      {pick}
      <div className="cd" />
    </>
  ) : pick ? <>{pick}<div className="cd" /></> : null;

  // several rows as one: only what several can take
  const cards = many ? many.filter((p) => hasCards(p)) : [];
  const several = many && (
    <>
      {!phone && (
        <div className="ci" data-act="open-tabs" onClick={act(() => { for (const p of at.all ?? many) openNode(p, { newTab: true }); })}>
          <span className="cg"><Glyph g="+" /></span>open in new tabs
        </div>
      )}
      {cards.length > 0 && (
        <div className="ci" data-act="study" onClick={act(() => { studyNodes(many, at.id); })}>
          <span className="cg"><Glyph g={GLYPH.session} /></span>study
        </div>
      )}
      {(!phone || cards.length > 0) && <div className="cd" />}
      <div className="ci" data-act="duplicate" onClick={act(() => { duplicateAll(many).catch(failed('duplicate')); })}>
        <span className="cg"><Glyph g="⧉" /></span>duplicate
      </div>
      <div className="ci has-sub" data-act="move" onClick={sub(true)}>
        <span className="cg"><Glyph g="→" /></span>move to…<span className="ck"><Glyph g="▸" /></span>
      </div>
      <div className="cd" />
      <div className={`ci danger${asking ? ' asking' : ''}`} data-act="delete" onClick={del}>
        <span className="cg"><Glyph g="⌫" /></span>{asking ? `delete ${itemsLabel(many.length)} with ${under} inside?` : `delete ${itemsLabel(many.length)}`}
      </div>
    </>
  );

  const menu = (
    <div
      className="ctx-menu"
      ref={ref}
      style={{ left: at.x, top: at.y }}
      onMouseDown={(e) => e.stopPropagation()}
      onContextMenu={(e) => { e.preventDefault(); e.stopPropagation(); }}
    >
      {!at.sub && several ? several : !at.sub && at.tab ? (
        <>
          {opens}
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
          <div className="ci" data-act="duplicate" onClick={act(() => { duplicateNode(at.id).catch(failed('duplicate')); })}>
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
          {opens}
          {/* a PDF on its own holds nothing (milestone 70): nothing is made under it */}
          {!pdfAlone && NEW_KINDS.map(([k, label]) => (
            <Fragment key={k}>
              <div className="ci" onClick={act(() => create(k))}>
                <span className="cg"><Glyph g={GLYPH[k]} /></span>{label}
              </div>
              {k === 'note' && (
                <div className="ci" data-act="new-written" onClick={act(createPaper)}>
                  <span className="cg"><Glyph g={WRITTEN_GLYPH} /></span>new written notes
                </div>
              )}
            </Fragment>
          ))}
          {!pdfAlone && <div className="cd" />}
          {!pdfAlone && (
            <div className="ci" onClick={act(() => { void importFiles(dir).catch(failed('import')); })}>
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
              <div className="ci" data-act="duplicate" onClick={act(() => { duplicateNode(at.id).catch(failed('duplicate')); })}>
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
        <MoveList targets={targets} back={sub(false)} move={moveTo} />
      )}
    </div>
  );
  // under a finger the menu is the page's, not the sidebar's: a sheet that is moved by its transform, and a list
  // that scrolls on an iPad, cut what is fixed inside them off at their own edge
  return onPage(menu);
}
