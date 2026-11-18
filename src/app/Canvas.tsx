// The canvas: up to three panes, each with a tab bar and the lens of its
// active tab. Pane state lives in the store as a `Panes` value; the pure
// operations are in panes.ts.

import { memo, useLayoutEffect, useRef, useState } from 'react';
import { Lens } from './Lenses.js';
import { backBusy, isPopping } from './edge.js';
import { quiet } from './motion.js';
import { EL_GLYPH } from './items.js';
import { GLYPH, INTAKE, SESSION, WRITTEN_GLYPH, queueId, tabKindOf } from './names.js';
import { UNDER } from './gesture.js';
import { activatePane, activeTab, closePane, closeTab, selectTab, splitPane, type OpenOpts, type Pane, type Tab } from './panes.js';
import { useApp } from './store.js';
import { notebookOf, tabLabel } from './tabs.js';
import { closeTabs, openNode, rememberTab } from './vault.js';
import { plainMath } from './chromeText.js';
import { Glyph } from './icons.js';

/**
 * A tab's title in the sans, one line. A notebook's page (`notebook ›
 * page`) gives way in the middle: the notebook's name shrinks first, the
 * page keeps what room there is; the whole title is the tooltip.
 */
function TabTitle({ title }: { title: string }) {
  const at = title.indexOf(' › ');
  if (at < 0) return <span className="title" title={title}><span className="tt-page">{title}</span></span>;
  return (
    <span className="title split" title={title}>
      <span className="tt-nb">{title.slice(0, at)}</span>
      <span className="tt-sep">{' › '}</span>
      <span className="tt-page">{title.slice(at + 3)}</span>
    </span>
  );
}

interface TabBarProps {
  pane: Pane;
  index: number;
  canClosePane: boolean;
}

function TabBar({ pane, index, canClosePane }: TabBarProps) {
  const docs = useApp((s) => s.docs);
  const root = useApp((s) => s.vault);
  const sessionEl = useApp((s) => s.sessionEl);
  const setPanes = useApp((s) => s.setPanes);
  // an iPad is one pane, but for a PDF's pages and its note (`notesPair`): no split to ask for
  const mobile = useApp((s) => s.mobile);
  const after = () => rememberTab();
  return (
    <div className="tabbar">
      {pane.tabs.map((tab, ti) => {
        // a notebook's page is one tab for the whole notebook: its glyph, `notebook › page`
        const nb = notebookOf(tab.id, docs);
        const kind = tabKindOf(nb ?? tab.id, docs);
        const session = kind === 'session' ? sessionEl : null;
        const glyph = session ? EL_GLYPH[session.kind] : docs[nb ?? tab.id]?.written ? WRITTEN_GLYPH : GLYPH[kind];
        const title = session ? session.label : tabLabel(tab.id, docs, root);
        return (
          <div
            key={tab.key}
            className="tab"
            data-active={ti === pane.active ? '1' : '0'}
            data-t={kind}
            data-nb={nb && nb !== tab.id ? '1' : undefined}
            onClick={() => { setPanes((s) => selectTab(s, index, ti)); after(); }}
            onAuxClick={(e) => { if (e.button === 1) closeTabs((s) => closeTab(s, index, ti)); }}
          >
            <span className="glyph" data-t={kind} data-el={session?.kind}><Glyph g={glyph} /></span>
            <TabTitle title={plainMath(title)} />
            {/* ⌘W closes the tab from the keys: the button is no Tab stop */}
            <button type="button" className="close" aria-label="close tab" tabIndex={-1} onClick={(e) => { e.stopPropagation(); closeTabs((s) => closeTab(s, index, ti)); }}><Glyph g="×" /></button>
          </div>
        );
      })}
      <div className="spacer" />
      {!mobile && <button type="button" className="ctl" onClick={() => { setPanes((s) => splitPane(s, index)); after(); }} title="split pane" aria-label="split pane"><Glyph g="⊟" /></button>}
      {canClosePane && <button type="button" className="ctl" onClick={() => closeTabs((s) => closePane(s, index))} title="close pane" aria-label="close pane"><Glyph g="×" /></button>}
    </div>
  );
}

const TODAY = queueId('today');
/** The day as a phone's page: no tab's, always there. */
const DAY: Tab = { key: 0, id: TODAY };
const openIn = (path: string, opts: OpenOpts) => openNode(path, opts);
/** How long a page takes to come in and to go out, and by what ease. */
const PUSH_MS = 300;
const PUSH_EASE = 'cubic-bezier(0.25, 0.6, 0.25, 1)';
const POP_MS = 280;

/** A phone's page. Drawn again only when what it shows changes, not when the canvas moves pages about. */
const Page = memo(function Page({ tab, active }: { tab: Tab; active: boolean }) {
  return (
    <div className="pane-body">
      <Lens key={tab.key} id={tab.id} active={active} onOpen={openIn} />
    </div>
  );
});

/**
 * A phone's canvas: the day is always there, and what is opened lies over
 * it, come in from the right; going back, it leaves to the right and the
 * day is as it was left (its scroll too). The page that goes out stays for
 * as long as that takes, and one page replaced by another stays under it
 * meanwhile: the pages themselves, never a likeness.
 *
 * Nothing is drawn or laid out while a page moves. A page that comes in is
 * drawn first, off to the right, and moves once that is on the glass; the
 * day under it is left exactly as it is (its queue keeps the list it had
 * while it is not in front, `Queue.tsx`), so it is there, already drawn,
 * when a finger pulls the page away (`edge.ts`); and a page that goes out
 * has left before the day is looked at again. Each is on its own layer for
 * as long as it moves, and for no longer.
 *
 * Where nothing moves (`quiet`) there is no day under a page at all, as
 * before: one page in the canvas.
 */
function PhoneCanvas() {
  const tab = useApp((s) => activeTab(s.panes));
  const none = useApp((s) => s.panes.panes.every((p) => p.tabs.length === 0));
  const covered = useApp((s) => s.paletteOpen || s.tweaksOpen || s.quickCard !== null);
  const menuOpen = useApp((s) => s.menuOpen);
  const top = tab && tab.id !== TODAY ? tab : null;
  const topKey = top?.key ?? null;
  const moving = !quiet();
  // what the canvas showed last: a page gone back from goes `out`, one replaced lies `under` its successor, the new one is `pushed`
  const [was, setWas] = useState<{ key: number | null; top: Tab | null; out: Tab | null; under: Tab | null; pushed: number | null }>({ key: topKey, top, out: null, under: null, pushed: null });
  if (was.key !== topKey) {
    const moves = moving && !isPopping();
    setWas({ key: topKey, top, out: moves && was.top && !top ? was.top : null, under: moves && was.top && top ? was.top : null, pushed: moves ? topKey : null });
  } else if (was.top !== top) {
    // the same tab showing another page of its notebook: in place
    setWas({ ...was, top });
  }
  const day = useRef<HTMLDivElement>(null);
  const front = useRef<HTMLDivElement>(null);
  const gone = useRef<HTMLDivElement>(null);
  // a page comes in
  useLayoutEffect(() => {
    const el = front.current;
    if (!moving || topKey === null || was.pushed !== topKey || !el) return;
    // the day gives way under it, when it is the day that is under it
    const d = was.under === null ? day.current : null;
    // drawn where it starts first (a page drawn while it was already moving lost the first of the way): off to the
    // right, on its own layer, and two frames on, in
    el.style.willChange = 'transform';
    el.style.transform = 'translate3d(100%,0,0)';
    if (d) d.style.willChange = 'transform';
    let second = 0;
    let fallback: ReturnType<typeof setTimeout> | undefined;
    let done = false;
    const clear = (): void => {
      el.style.transition = '';
      el.style.transform = '';
      el.style.willChange = '';
      if (d) { d.style.transition = ''; d.style.transform = ''; d.style.willChange = ''; }
    };
    const settle = (): void => {
      if (done) return;
      done = true;
      clearTimeout(fallback);
      el.removeEventListener('transitionend', ended);
      // (a finger that took it on its way has it now, and says where it and the day are)
      if (!backBusy()) clear();
      setWas((w) => (w.under ? { ...w, under: null } : w));
    };
    const ended = (e: TransitionEvent): void => { if (e.target === el && e.propertyName === 'transform') settle(); };
    const first = requestAnimationFrame(() => {
      second = requestAnimationFrame(() => {
        if (backBusy()) { settle(); return; }
        el.addEventListener('transitionend', ended);
        el.style.transition = `transform ${PUSH_MS}ms ${PUSH_EASE}`;
        el.style.transform = 'translate3d(0,0,0)';
        if (d) { d.style.transition = el.style.transition; d.style.transform = `translate3d(${-UNDER * 100}%,0,0)`; }
        // (should the end never be told: a page that could not be seen, say)
        fallback = setTimeout(settle, PUSH_MS + 900);
      });
    });
    return () => {
      cancelAnimationFrame(first);
      cancelAnimationFrame(second);
      clearTimeout(fallback);
      el.removeEventListener('transitionend', ended);
      done = true;
      if (!backBusy()) clear();
    };
  }, [topKey]);
  // a page goes out, by anything but the finger: it leaves as it came, and the day comes back to its place
  const outKey = was.out?.key ?? null;
  useLayoutEffect(() => {
    const o = gone.current;
    const d = day.current;
    if (outKey === null || !o) return;
    let fallback: ReturnType<typeof setTimeout> | undefined;
    let done = false;
    const end = (): void => {
      if (done) return;
      done = true;
      clearTimeout(fallback);
      if (d) { d.style.transition = ''; d.style.transform = ''; d.style.willChange = ''; }
      setWas((w) => (w.out ? { ...w, out: null } : w));
    };
    const ended = (e: TransitionEvent): void => { if (e.target === o && e.propertyName === 'transform') end(); };
    o.style.willChange = 'transform';
    o.style.transform = 'translate3d(0,0,0)';
    if (d) { d.style.willChange = 'transform'; d.style.transform = `translate3d(${-UNDER * 100}%,0,0)`; }
    void o.offsetWidth;
    const frame = requestAnimationFrame(() => {
      o.addEventListener('transitionend', ended);
      o.style.transition = `transform ${POP_MS}ms ${PUSH_EASE}`;
      o.style.transform = 'translate3d(100%,0,0)';
      if (d) { d.style.transition = o.style.transition; d.style.transform = 'translate3d(0,0,0)'; }
      fallback = setTimeout(end, POP_MS + 900);
    });
    return () => {
      cancelAnimationFrame(frame);
      clearTimeout(fallback);
      o.removeEventListener('transitionend', ended);
      done = true;
      if (d && !backBusy()) { d.style.transition = ''; d.style.transform = ''; d.style.willChange = ''; }
    };
  }, [outKey]);
  const lit = !covered;
  // a session is the whole screen: over the bar, which is there under it
  const full = (t: Tab) => (t.id === SESSION ? '1' : undefined);
  return (
    <div className="canvas">
      {(moving || (!top && !none)) && (
        <div ref={day} className="pane pane-day" data-active={top || none ? '0' : '1'} aria-hidden={top !== null || none ? true : undefined}>
          {/* in front again once the page over it has left: its list is looked at anew then, not under the page as it goes */}
          <Page tab={DAY} active={!top && !was.out && !none && lit && !menuOpen} />
        </div>
      )}
      {was.under && was.under.key !== topKey && (
        <div key={`t${was.under.key}`} className="pane pane-top" data-active="0" data-full={full(was.under)}>
          <Page tab={was.under} active={false} />
        </div>
      )}
      {top && (
        <div key={`t${top.key}`} ref={front} className="pane pane-top" data-active="1" data-full={full(top)}>
          <Page tab={top} active={lit && !(menuOpen && top.id !== INTAKE)} />
        </div>
      )}
      {was.out && was.out.key !== topKey && (
        <div key={`t${was.out.key}`} ref={gone} className="pane pane-top" data-active="0" data-pop="1" data-full={full(was.out)}>
          <Page tab={was.out} active={false} />
        </div>
      )}
      {none && (
        <div className="pane pane-top" data-active="1">
          <div className="pane-body"><div className="empty center pane-empty"><span>nothing open · press a row in the sidebar</span></div></div>
        </div>
      )}
    </div>
  );
}

export function Canvas() {
  const phone = useApp((s) => s.phone);
  return phone ? <PhoneCanvas /> : <Panes />;
}

function Panes() {
  const panes = useApp((s) => s.panes);
  const setPanes = useApp((s) => s.setPanes);
  const covered = useApp((s) => s.paletteOpen || s.tweaksOpen || s.quickCard !== null);
  // an open context menu covers the page too: its keys are the menu's (`popMenu.ts`), not a session's grades or a deck's ⌫
  const menuOpen = useApp((s) => s.menuOpen);
  const mobile = useApp((s) => s.mobile);
  const onOpen = (path: string, opts: OpenOpts) => openNode(path, opts);
  return (
    <div className="canvas">
      {panes.panes.map((pane, pi) => {
        const tab = pane.tabs[pane.active];
        return (
          <div
            // a pane is the page it shows: the pane beside one that closes keeps its page as it is (its scroll, its caret, its find),
            // where a key by position drew it again from nothing
            key={tab ? `t${tab.key}` : `e${pi}`}
            className="pane"
            data-active={pi === panes.active ? '1' : '0'}
            onMouseDown={() => { if (pi !== panes.active) { setPanes((s) => activatePane(s, pi)); rememberTab(); } }}
          >
            <TabBar pane={pane} index={pi} canClosePane={panes.panes.length > 1} />
            {/* the intake is not covered by a menu: uncovered again it takes the focus for its text, from the row a menu's rename has just begun; the menu has every key meanwhile */}
            <div className="pane-body">
              {tab
                ? <Lens key={tab.key} id={tab.id} active={pi === panes.active && !covered && !(menuOpen && tab.id !== INTAKE)} onOpen={onOpen} />
                : <div className="empty center pane-empty"><span>{mobile ? 'nothing open · press a row in the sidebar' : <><kbd>⌘k</kbd> to open · or press a row in the sidebar</>}</span></div>}
            </div>
          </div>
        );
      })}
    </div>
  );
}
