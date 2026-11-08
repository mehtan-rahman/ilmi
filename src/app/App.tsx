import { useCallback, useEffect, useLayoutEffect, useState } from 'react';
import { BottomStrip } from './BottomStrip.js';
import { Canvas } from './Canvas.js';
import { listenForClips } from './clipper.js';
import { Inspector } from './Inspector.js';
import { listenForDrops, listenForPaste } from './land.js';
import { listenForMenu } from './menu.js';
import { Notice } from './Notice.js';
import { Palette } from './Palette.js';
import { PhoneBar } from './PhoneBar.js';
import { QuickCard } from './QuickCard.js';
import { SavedQueries } from './Queue.js';
import { TopStrip } from './TopStrip.js';
import { Tree } from './Tree.js';
import { Tweaks } from './Tweaks.js';
import { Welcome } from './Welcome.js';
import { activeTab, closeTab, splitPane } from './panes.js';
import { SESSION } from './names.js';
import { ACCENTS, INSP_MAX, INSP_MIN, SIDE_MAX, SIDE_MIN, useApp, ZOOM_STEP } from './store.js';
import { openInitialVault, openNode, rememberTab, setInspector, setSidebar, toggleInspector, toggleSidebar } from './vault.js';
import { bookShown, inspectorShown } from './layout.js';
import { shapeOf } from './platform.js';
import { installLongPress } from './touch.js';
import { watchInk, watchLayout } from './ink.js';
import './app.css';
import './chrome.css';
import './phone.css';
import { Glyph } from './icons.js';

/** Narrower than this and a drag on the handle hides the sidebar. */
const SIDE_COLLAPSE = 80;
/** Narrower than this and a drag on the handle closes the inspector. */
const INSP_COLLAPSE = 120;
/** A touch that starts this near the left edge can pull the sidebar's sheet in (an iPad in portrait). */
const EDGE = 24;
/** How far a finger travels sideways before it is a swipe. */
const SWIPE = 36;
/** A visual viewport this much shorter than the window has the keyboard up. */
const KEYBOARD = 120;

const inField = (t: EventTarget | null) => {
  const tag = (t as HTMLElement | null)?.tagName?.toLowerCase();
  return tag === 'input' || tag === 'textarea';
};

/** A drag on a vertical handle; `onMove` gets the pointer's x. */
function dragHandle(onMove: (x: number) => void): (e: React.MouseEvent) => void {
  return (e) => {
    e.preventDefault();
    const move = (ev: globalThis.MouseEvent) => onMove(ev.clientX);
    const up = () => {
      window.removeEventListener('mousemove', move);
      window.removeEventListener('mouseup', up);
      document.body.style.cursor = '';
      document.body.style.userSelect = '';
    };
    document.body.style.cursor = 'col-resize';
    document.body.style.userSelect = 'none';
    window.addEventListener('mousemove', move);
    window.addEventListener('mouseup', up);
  };
}

export function App() {
  const theme = useApp((s) => s.theme);
  const accent = useApp((s) => s.accent);
  const rho = useApp((s) => s.density);
  const zoom = useApp((s) => s.zoom);
  const vault = useApp((s) => s.vault);
  const sidebar = useApp((s) => s.sidebar);
  const inspector = useApp((s) => s.inspector);
  const panes = useApp((s) => s.panes);
  const paletteOpen = useApp((s) => s.paletteOpen);
  const tweaksOpen = useApp((s) => s.tweaksOpen);
  const started = useApp((s) => s.started);
  const setPanes = useApp((s) => s.setPanes);
  const inspForced = useApp((s) => s.inspForced);
  const bookInsp = useApp((s) => s.bookInsp);
  const sessionEl = useApp((s) => s.sessionEl);
  const docs = useApp((s) => s.docs);
  const railFolded = useApp((s) => s.railFolded);
  const railWidth = useApp((s) => s.railWidth);
  const mobile = useApp((s) => s.mobile);
  const sideSheet = useApp((s) => s.sideSheet);
  // the window's width, for the room rule (`layout.ts`): the inspector yields before the page's measure does
  const [win, setWin] = useState(() => window.innerWidth);
  const [winH, setWinH] = useState(() => window.innerHeight);
  useEffect(() => {
    const onResize = () => { setWin(window.innerWidth); setWinH(window.innerHeight); };
    window.addEventListener('resize', onResize);
    return () => window.removeEventListener('resize', onResize);
  }, []);
  // an iPad's shape (`platform.ts`): landscape is a narrow Mac, portrait draws the sidebar as a sheet
  const shape = shapeOf(mobile, win, winH);
  // a phone's (milestone 56): the day its face, one page, the bar at the foot, and the tree and the palette behind one of its buttons
  const phone = shape === 'phone';
  const sheet = shape === 'portrait' || phone;
  const activeId = activeTab(panes)?.id;
  // the sheet is for one choice: it closes once something opens, and when the iPad turns
  useEffect(() => { useApp.setState({ sideSheet: false }); }, [activeId, shape]);
  useLayoutEffect(() => {
    document.documentElement.dataset.shape = shape;
    useApp.setState({ phone });
  }, [shape, phone]);
  // the keyboard on the glass covers the bottom of the page: the shell is as tall as what is left
  useEffect(() => {
    const vv = window.visualViewport;
    if (!mobile || !vv) return;
    const fit = () => {
      document.documentElement.style.setProperty('--shell-h', `${Math.round(vv.height)}px`);
      // the keyboard up: what sits at the foot of a phone gives it the room
      document.documentElement.toggleAttribute('data-keyboard', window.innerHeight - vv.height > KEYBOARD);
      if (window.scrollY !== 0) window.scrollTo(0, 0);
    };
    fit();
    vv.addEventListener('resize', fit);
    vv.addEventListener('scroll', fit);
    return () => {
      vv.removeEventListener('resize', fit);
      vv.removeEventListener('scroll', fit);
      document.documentElement.style.removeProperty('--shell-h');
      document.documentElement.removeAttribute('data-keyboard');
    };
  }, [mobile]);
  // portrait: a swipe in from the left edge opens the sheet, a swipe left on it closes it
  useEffect(() => {
    if (!sheet || vault === null) return;
    let from: { x: number; y: number; edge: boolean } | null = null;
    const start = (e: TouchEvent) => {
      const t = e.touches[0];
      if (!t || e.touches.length !== 1) { from = null; return; }
      from = { x: t.clientX, y: t.clientY, edge: t.clientX <= EDGE };
    };
    const move = (e: TouchEvent) => {
      const t = e.touches[0];
      if (!from || !t) return;
      const dx = t.clientX - from.x;
      const dy = Math.abs(t.clientY - from.y);
      if (Math.abs(dx) < SWIPE || dy > Math.abs(dx)) return;
      const open = useApp.getState().sideSheet;
      if (dx > 0 && from.edge && !open) useApp.setState({ sideSheet: true });
      else if (dx < 0 && open) useApp.setState({ sideSheet: false });
      from = null;
    };
    window.addEventListener('touchstart', start, { passive: true });
    window.addEventListener('touchmove', move, { passive: true });
    return () => {
      window.removeEventListener('touchstart', start);
      window.removeEventListener('touchmove', move);
    };
  }, [sheet, vault]);

  // a touch held and let go is a right-click where it rests (`touch.ts`)
  useEffect(() => installLongPress(), []);

  // a page of ink changed in the open collection: the readers showing its picture look again (`ink.ts`)
  useEffect(() => { void watchInk(); }, [vault]);
  useEffect(() => (mobile ? watchLayout() : undefined), [mobile]);

  // the tweaks, as CSS
  useEffect(() => {
    const root = document.documentElement;
    root.setAttribute('data-theme', theme);
    root.style.setProperty('--rho', String(rho));
    root.style.setProperty('--zoom', String(zoom));
    const a = ACCENTS[accent];
    root.style.setProperty('--accent-h', String(a.h));
    root.style.setProperty('--accent-c', String(a.c));
    root.style.setProperty('--accent-l-light', String(a.light));
    root.style.setProperty('--accent-l-dark', String(a.dark));
  }, [theme, accent, rho, zoom]);

  useEffect(() => {
    openInitialVault().catch((e: unknown) => console.error(e));
    listenForClips();
    listenForMenu();
    listenForDrops();
    listenForPaste();
  }, []);

  // the handles: drag to resize; drag to the edge to hide, out again to show
  const startSideResize = useCallback(dragHandle((x) => {
    if (x < SIDE_COLLAPSE) setSidebar({ hidden: true });
    else setSidebar({ hidden: false, width: Math.min(SIDE_MAX, Math.max(SIDE_MIN, x)) });
  }), []);
  const startInspResize = useCallback(dragHandle((x) => {
    const w = window.innerWidth - x;
    const width = Math.min(INSP_MAX, Math.max(INSP_MIN, w));
    // over a book the inspector is that book's to show (`layout.ts`): the saved state keeps only the width
    if (bookShown(useApp.getState())) {
      useApp.setState({ bookInsp: w >= INSP_COLLAPSE });
      if (w >= INSP_COLLAPSE) setInspector({ width });
    } else if (w < INSP_COLLAPSE) setInspector({ open: false });
    else setInspector({ open: true, width });
  }), []);

  // the global keys: ⌘K palette, ⌘\ split, ⌘W close tab, ⌃⌘S sidebar (macOS's own; ⌘⇧E is the
  // reader's extract), ⌘⇧I inspector, ⌘, tweaks
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (!(e.metaKey || e.ctrlKey)) return;
      const k = e.key.toLowerCase();
      if (k === 'k') {
        // ⌘K over a selection in an editable page is the link field (the reader took it)
        if (e.defaultPrevented) return;
        e.preventDefault();
        // the palette is the open vault's; the welcome has its own keys
        if (useApp.getState().vault !== null) useApp.setState((s) => ({ paletteOpen: !s.paletteOpen }));
        return;
      }
      if (k === ',') {
        e.preventDefault();
        useApp.setState((s) => ({ tweaksOpen: !s.tweaksOpen }));
        return;
      }
      // ⌘= ⌘− ⌘0: the page's text size, from anywhere, the editor included
      if (!e.shiftKey && !e.altKey && (e.key === '=' || e.key === '+' || e.key === '-' || e.key === '0')) {
        e.preventDefault();
        const s = useApp.getState();
        s.setZoom(e.key === '0' ? 1 : s.zoom + (e.key === '-' ? -ZOOM_STEP : ZOOM_STEP));
        return;
      }
      if (inField(e.target)) return;
      if (e.key === '\\') {
        // a book's ⌘\ hides its notes (`Pdf.tsx`)
        if (e.defaultPrevented) return;
        e.preventDefault();
        setPanes((s) => splitPane(s, s.active));
      } else if (k === 'w' && !e.shiftKey) {
        // ⌘⇧W is the File menu's Close Collection
        e.preventDefault();
        setPanes((s) => closeTab(s, s.active, s.panes[s.active]?.active ?? 0));
        rememberTab();
      } else if (e.metaKey && e.ctrlKey && !e.shiftKey && k === 's') {
        e.preventDefault();
        toggleSidebar();
      } else if (e.shiftKey && k === 'i') {
        e.preventDefault();
        toggleInspector();
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [setPanes]);

  // before a vault is open: the welcome, once the start decision is made (a reopening vault shows no welcome first)
  if (vault === null) {
    return (
      <div className="shell" style={{ '--side-w': '0px', '--insp-w': '0px' } as React.CSSProperties}>
        {started && <Welcome />}
        {tweaksOpen && <Tweaks />}
      </div>
    );
  }

  // the sidebar is a column beside the page, or in portrait a sheet over it that takes no room
  const sideOn = sheet ? sideSheet : !sidebar.hidden;
  const sideW = sideOn && !sheet ? sidebar.width : 0;
  const inspOn = !phone && inspectorShown({ sidebar: sheet ? { ...sidebar, hidden: true } : sidebar, inspector, inspForced, bookInsp, sessionEl, panes, docs, railFolded, railWidth }, win);
  const inspW = inspOn ? inspector.width : 0;
  const active = activeId;
  // on a phone a tree row tapped goes to the page, the one in front too
  const onTreeOpen: typeof openNode = (path, opts) => { openNode(path, opts); if (phone) useApp.setState({ sideSheet: false }); };
  return (
    <>
      <div className="shell" data-session={phone && activeId === SESSION ? '1' : undefined} style={{ '--side-w': `${sideW}px`, '--insp-w': `${inspW}px` } as React.CSSProperties}>
        <TopStrip />
        {sheet && sideOn && <div className="side-scrim" onClick={() => useApp.setState({ sideSheet: false })} />}
        {sideOn && (
          <div className="side" data-sheet={sheet ? '1' : undefined} style={sheet ? ({ '--sheet-w': `${Math.min(sidebar.width, Math.round(win * 0.84))}px` } as React.CSSProperties) : undefined}>
            <h6>workspace</h6>
            <Tree activeId={active} onOpen={onTreeOpen} />
            <SavedQueries activeId={active} />
            {phone && <button type="button" className="side-find" onClick={() => useApp.setState({ paletteOpen: true, sideSheet: false })}><span className="g"><Glyph g="⌕" /></span><span className="lbl">open or run</span></button>}
          </div>
        )}
        {!mobile && <div className="side-resize" data-hidden={sidebar.hidden ? '1' : '0'} onMouseDown={startSideResize} />}
        <Canvas />
        {inspOn && <Inspector />}
        {inspOn && !mobile && <div className="insp-resize" onMouseDown={startInspResize} />}
        {phone ? activeId !== SESSION && <PhoneBar /> : <BottomStrip />}
        <Notice />
      </div>
      {paletteOpen && <Palette />}
      {tweaksOpen && <Tweaks />}
      {phone && <QuickCard />}
    </>
  );
}
