import { useCallback, useEffect } from 'react';
import { BottomStrip } from './BottomStrip.js';
import { Canvas } from './Canvas.js';
import { listenForClips } from './clipper.js';
import { Inspector } from './Inspector.js';
import { listenForDrops, listenForPaste } from './land.js';
import { listenForMenu } from './menu.js';
import { Notice } from './Notice.js';
import { Palette } from './Palette.js';
import { SavedQueries } from './Queue.js';
import { TopStrip } from './TopStrip.js';
import { Tree } from './Tree.js';
import { Tweaks } from './Tweaks.js';
import { Welcome } from './Welcome.js';
import { activeTab, closeTab, splitPane } from './panes.js';
import { ACCENTS, INSP_MAX, INSP_MIN, SIDE_MAX, SIDE_MIN, useApp } from './store.js';
import { openInitialVault, openNode, rememberTab, setInspector, setSidebar } from './vault.js';
import './app.css';
import './chrome.css';

/** Narrower than this and a drag on the handle hides the sidebar. */
const SIDE_COLLAPSE = 80;
/** Narrower than this and a drag on the handle closes the inspector. */
const INSP_COLLAPSE = 120;

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
  const vault = useApp((s) => s.vault);
  const sidebar = useApp((s) => s.sidebar);
  const inspector = useApp((s) => s.inspector);
  const panes = useApp((s) => s.panes);
  const paletteOpen = useApp((s) => s.paletteOpen);
  const tweaksOpen = useApp((s) => s.tweaksOpen);
  const started = useApp((s) => s.started);
  const setPanes = useApp((s) => s.setPanes);

  // the tweaks, as CSS
  useEffect(() => {
    const root = document.documentElement;
    root.setAttribute('data-theme', theme);
    root.style.setProperty('--rho', String(rho));
    const a = ACCENTS[accent];
    root.style.setProperty('--accent-h', String(a.h));
    root.style.setProperty('--accent-c', String(a.c));
    root.style.setProperty('--accent-l-light', String(a.light));
    root.style.setProperty('--accent-l-dark', String(a.dark));
  }, [theme, accent, rho]);

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
    if (w < INSP_COLLAPSE) setInspector({ open: false });
    else setInspector({ open: true, width: Math.min(INSP_MAX, Math.max(INSP_MIN, w)) });
  }), []);

  // the global keys: ⌘K palette, ⌘\ split, ⌘W close tab, ⌃⌘S sidebar (macOS's own; ⌘⇧E is the
  // reader's extract), ⌘⇧I inspector, ⌘, tweaks
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (!(e.metaKey || e.ctrlKey)) return;
      const k = e.key.toLowerCase();
      if (k === 'k') {
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
      if (inField(e.target)) return;
      if (e.key === '\\') {
        e.preventDefault();
        setPanes((s) => splitPane(s, s.active));
      } else if (k === 'w' && !e.shiftKey) {
        // ⌘⇧W is the File menu's Close Collection
        e.preventDefault();
        setPanes((s) => closeTab(s, s.active, s.panes[s.active]?.active ?? 0));
        rememberTab();
      } else if (e.metaKey && e.ctrlKey && !e.shiftKey && k === 's') {
        e.preventDefault();
        setSidebar({ hidden: !useApp.getState().sidebar.hidden });
      } else if (e.shiftKey && k === 'i') {
        e.preventDefault();
        setInspector({ open: !useApp.getState().inspector.open });
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

  const sideW = sidebar.hidden ? 0 : sidebar.width;
  const inspW = inspector.open ? inspector.width : 0;
  const active = activeTab(panes)?.id;
  return (
    <>
      <div className="shell" style={{ '--side-w': `${sideW}px`, '--insp-w': `${inspW}px` } as React.CSSProperties}>
        <TopStrip />
        {!sidebar.hidden && (
          <div className="side">
            <h6>workspace</h6>
            <Tree activeId={active} onOpen={openNode} />
            <SavedQueries activeId={active} />
          </div>
        )}
        <div className="side-resize" data-hidden={sidebar.hidden ? '1' : '0'} onMouseDown={startSideResize} />
        <Canvas />
        {inspector.open && <Inspector />}
        {inspector.open && <div className="insp-resize" onMouseDown={startInspResize} />}
        <BottomStrip />
        <Notice />
      </div>
      {paletteOpen && <Palette />}
      {tweaksOpen && <Tweaks />}
    </>
  );
}
