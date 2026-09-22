// The canvas: up to three panes, each with a tab bar and the lens of its
// active tab. Pane state lives in the store as a `Panes` value; the pure
// operations are in panes.ts.

import { Lens } from './Lenses.js';
import { GLYPH, kindOf, titleOf } from './names.js';
import { activatePane, closePane, closeTab, selectTab, splitPane, type OpenOpts, type Pane } from './panes.js';
import { useApp } from './store.js';
import { openNode, rememberTab } from './vault.js';

interface TabBarProps {
  pane: Pane;
  index: number;
  canClosePane: boolean;
}

function TabBar({ pane, index, canClosePane }: TabBarProps) {
  const docs = useApp((s) => s.docs);
  const root = useApp((s) => s.vault);
  const setPanes = useApp((s) => s.setPanes);
  const after = () => rememberTab();
  return (
    <div className="tabbar">
      {pane.tabs.map((tab, ti) => {
        const kind = kindOf(tab.id, docs);
        return (
          <div
            key={tab.key}
            className="tab"
            data-active={ti === pane.active ? '1' : '0'}
            data-t={kind}
            onClick={() => { setPanes((s) => selectTab(s, index, ti)); after(); }}
            onAuxClick={(e) => { if (e.button === 1) { setPanes((s) => closeTab(s, index, ti)); after(); } }}
          >
            <span className="glyph" data-t={kind}>{GLYPH[kind]}</span>
            <span className="title">{titleOf(tab.id, docs, root)}</span>
            <span className="close" onClick={(e) => { e.stopPropagation(); setPanes((s) => closeTab(s, index, ti)); after(); }}>×</span>
          </div>
        );
      })}
      <div className="spacer" />
      <div className="ctl" onClick={() => setPanes((s) => splitPane(s, index))}>⊟</div>
      {canClosePane && <div className="ctl" onClick={() => { setPanes((s) => closePane(s, index)); after(); }}>×</div>}
    </div>
  );
}

export function Canvas() {
  const panes = useApp((s) => s.panes);
  const setPanes = useApp((s) => s.setPanes);
  const onOpen = (path: string, opts: OpenOpts) => openNode(path, opts);
  return (
    <div className="canvas">
      {panes.panes.map((pane, pi) => {
        const tab = pane.tabs[pane.active];
        return (
          <div
            key={pi}
            className="pane"
            data-active={pi === panes.active ? '1' : '0'}
            onMouseDown={() => { if (pi !== panes.active) { setPanes((s) => activatePane(s, pi)); rememberTab(); } }}
          >
            <TabBar pane={pane} index={pi} canClosePane={panes.panes.length > 1} />
            <div className="pane-body">
              {tab && <Lens key={tab.key} id={tab.id} active={pi === panes.active} onOpen={onOpen} />}
            </div>
          </div>
        );
      })}
    </div>
  );
}
