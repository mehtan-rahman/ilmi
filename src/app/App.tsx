import { useCallback, useEffect } from 'react';
import { Canvas } from './Canvas.js';
import { SavedQueries } from './Queue.js';
import { Tree } from './Tree.js';
import { activeTab, closeTab, splitPane } from './panes.js';
import { SIDE_MAX, SIDE_MIN, useApp } from './store.js';
import { openInitialVault, openNode, pickVault, rememberTab, setSidebar } from './vault.js';
import './app.css';

/** Narrower than this and a drag on the handle hides the sidebar. */
const SIDE_COLLAPSE = 80;

const inField = (t: EventTarget | null) => {
  const tag = (t as HTMLElement | null)?.tagName?.toLowerCase();
  return tag === 'input' || tag === 'textarea';
};

export function App() {
  const theme = useApp((s) => s.theme);
  const rho = useApp((s) => s.density);
  const vault = useApp((s) => s.vault);
  const sidebar = useApp((s) => s.sidebar);
  const panes = useApp((s) => s.panes);
  const setPanes = useApp((s) => s.setPanes);

  useEffect(() => {
    const root = document.documentElement;
    root.setAttribute('data-theme', theme);
    root.style.setProperty('--rho', String(rho));
  }, [theme, rho]);

  useEffect(() => {
    openInitialVault().catch((e: unknown) => console.error(e));
  }, []);

  // the sidebar handle: drag to resize; drag it to the edge to hide, out again to show
  const startSideResize = useCallback((e: React.MouseEvent) => {
    e.preventDefault();
    const onMove = (ev: globalThis.MouseEvent) => {
      if (ev.clientX < SIDE_COLLAPSE) setSidebar({ hidden: true });
      else setSidebar({ hidden: false, width: Math.min(SIDE_MAX, Math.max(SIDE_MIN, ev.clientX)) });
    };
    const onUp = () => {
      window.removeEventListener('mousemove', onMove);
      window.removeEventListener('mouseup', onUp);
      document.body.style.cursor = '';
      document.body.style.userSelect = '';
    };
    document.body.style.cursor = 'col-resize';
    document.body.style.userSelect = 'none';
    window.addEventListener('mousemove', onMove);
    window.addEventListener('mouseup', onUp);
  }, []);

  // pane keys: ⌘\ split, ⌘W close tab, ⌘⇧E sidebar
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (!(e.metaKey || e.ctrlKey) || inField(e.target)) return;
      if (e.key === '\\') {
        e.preventDefault();
        setPanes((s) => splitPane(s, s.active));
      } else if (e.key === 'w' || e.key === 'W') {
        e.preventDefault();
        setPanes((s) => closeTab(s, s.active, s.panes[s.active]?.active ?? 0));
        rememberTab();
      } else if (e.shiftKey && (e.key === 'e' || e.key === 'E')) {
        e.preventDefault();
        setSidebar({ hidden: !useApp.getState().sidebar.hidden });
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [setPanes]);

  if (vault === null) {
    return (
      <div className="shell">
        <main className="welcome">
          <button className="open" type="button" onClick={() => void pickVault().catch(console.error)}>
            open vault
          </button>
        </main>
      </div>
    );
  }

  const sideW = sidebar.hidden ? 0 : sidebar.width;
  return (
    <div className="shell" style={{ '--side-w': `${sideW}px`, '--insp-w': '0px' } as React.CSSProperties}>
      {!sidebar.hidden && (
        <div className="side">
          <h6>workspace</h6>
          <Tree activeId={activeTab(panes)?.id} onOpen={openNode} />
          <SavedQueries activeId={activeTab(panes)?.id} />
        </div>
      )}
      <div className="side-resize" data-hidden={sidebar.hidden ? '1' : '0'} onMouseDown={startSideResize} />
      <Canvas />
    </div>
  );
}
