// The canvas: up to three panes, each with a tab bar and the lens of its
// active tab. Pane state lives in the store as a `Panes` value; the pure
// operations are in panes.ts.

import { Suspense, memo, useEffect, useLayoutEffect, useRef, useState, type ReactNode } from 'react';
import { flushSync } from 'react-dom';
import { Lens } from './Lenses.js';
import { backBusy, isPopping, onPeek } from './edge.js';
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
/** How long a page takes to come in, and by what ease; and to go out (`motion.css`), and a little more. */
const PUSH_MS = 300;
const PUSH_EASE = 'cubic-bezier(0.25, 0.6, 0.25, 1)';
const POP_MS = 320;

/** A phone's page. Drawn again only when what it shows changes, not when the canvas moves pages about. */
const Page = memo(function Page({ tab, active }: { tab: Tab; active: boolean }) {
  return (
    <div className="pane-body">
      <Lens key={tab.key} id={tab.id} active={active} onOpen={openIn} />
    </div>
  );
});

/** What is inside is kept as it is, and not drawn again, while `on`: its state stays, React takes it out of view. */
function Still({ on, children }: { on: boolean; children: ReactNode }) {
  return <Suspense fallback={null}><Held on={on}>{children}</Held></Suspense>;
}
const NEVER = new Promise<void>(() => {});
function Held({ on, children }: { on: boolean; children: ReactNode }) {
  // (held by a promise that never ends: it is let go by being drawn again with `on` off)
  if (on) throw NEVER;
  return <>{children}</>;
}

/**
 * A phone's canvas: the day is always there, and what is
 * opened lies over it, come in from the right; going back, it leaves to
 * the right and the day is as it was left (its scroll too). The page that
 * goes out stays for as long as that takes, and one page replaced by
 * another stays under it meanwhile: the pages themselves, never a likeness.
 * The day under a page that has settled is kept but not drawn, and not
 * worked out again as the queue changes (a session's every grade would
 * have drawn its whole list); a finger at the left edge wakes it
 * (`edge.ts`), so it is there under the page as the page is pulled away.
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
  // the day under a settled page: kept, not drawn
  const [asleep, setAsleep] = useState(top !== null);
  if (was.key !== topKey) {
    const moves = moving && !isPopping();
    setWas({ key: topKey, top, out: moves && was.top && !top ? was.top : null, under: moves && was.top && top ? was.top : null, pushed: moves ? topKey : null });
    if (!top) setAsleep(false);
    else if (!moves) setAsleep(true);
  } else if (was.top !== top) {
    // the same tab showing another page of its notebook: in place
    setWas({ ...was, top });
  }
  const day = useRef<HTMLDivElement>(null);
  const front = useRef<HTMLDivElement>(null);
  // where the day's list stood when it was put away, for when it is back
  const stood = useRef(0);
  const sleep = (): void => {
    const d = day.current;
    if (!d) return;
    stood.current = d.querySelector('.pane-body')?.scrollTop ?? 0;
    d.dataset.covered = '1';
    setAsleep(true);
  };
  useLayoutEffect(() => {
    const body = day.current?.querySelector('.pane-body');
    if (!asleep && body && stood.current > 0) body.scrollTop = stood.current;
  }, [asleep]);
  // a finger at the left edge (`edge.ts`): the day is wanted under the page; let go without a pull, it is put away again
  useEffect(() => onPeek((on) => {
    if (on) flushSync(() => setAsleep(false));
    else if (front.current && !backBusy()) sleep();
  }), []);
  useLayoutEffect(() => {
    const d = day.current;
    if (!d) return;
    if (topKey === null) { delete d.dataset.covered; return; }
    const el = front.current;
    if (!moving || was.pushed === null || !el) { d.dataset.covered = '1'; return; }
    // the page comes in once it has been drawn where it starts (a page drawn while it was already moving lost the
    // first of the way): off to the right, and two frames on, in; the day, when it is the day under it, gives way
    const under = !d.dataset.covered;
    el.style.transform = 'translate3d(100%,0,0)';
    let second = 0;
    let fallback: ReturnType<typeof setTimeout> | undefined;
    let done = false;
    const settle = (): void => {
      if (done) return;
      done = true;
      clearTimeout(fallback);
      el.removeEventListener('transitionend', ended);
      if (!backBusy()) {
        el.style.transition = '';
        el.style.transform = '';
        d.style.transition = '';
        d.style.transform = '';
        sleep();
      }
      setWas((w) => (w.under ? { ...w, under: null } : w));
    };
    const ended = (e: TransitionEvent): void => { if (e.target === el && e.propertyName === 'transform') settle(); };
    const first = requestAnimationFrame(() => {
      second = requestAnimationFrame(() => {
        if (backBusy()) { settle(); return; }
        el.addEventListener('transitionend', ended);
        el.style.transition = `transform ${PUSH_MS}ms ${PUSH_EASE}`;
        el.style.transform = '';
        if (under) { d.style.transition = el.style.transition; d.style.transform = `translate3d(${-UNDER * 100}%,0,0)`; }
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
      el.style.transition = '';
      el.style.transform = '';
      if (!backBusy()) { d.style.transition = ''; d.style.transform = ''; }
    };
  }, [topKey]);
  // a page gone out is taken away when it has left
  useLayoutEffect(() => {
    if (!was.out) return;
    const t = setTimeout(() => setWas((w) => (w.out ? { ...w, out: null } : w)), POP_MS);
    return () => clearTimeout(t);
  }, [was.out]);
  const lit = !covered;
  // a session is the whole screen: over the strip and the bar, which are there under it while it comes and goes
  const full = (t: Tab) => (t.id === SESSION ? '1' : undefined);
  return (
    <div className="canvas">
      {(moving || (!top && !none)) && (
        <div ref={day} className="pane pane-day" data-active={top || none ? '0' : '1'} data-back={was.out ? '1' : undefined}>
          <Still on={asleep && top !== null}>
            <Page tab={DAY} active={!top && !none && lit && !menuOpen} />
          </Still>
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
        <div key={`t${was.out.key}`} className="pane pane-top" data-active="0" data-pop="1" data-full={full(was.out)}>
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
