// The canvas: up to three panes, each with a tab bar and the lens of its
// active tab. Pane state lives in the store as a `Panes` value; the pure
// operations are in panes.ts.

import { Lens } from './Lenses.js';
import { EL_GLYPH } from './items.js';
import { GLYPH, tabKindOf } from './names.js';
import { activatePane, closePane, closeTab, selectTab, splitPane, type OpenOpts, type Pane } from './panes.js';
import { useApp } from './store.js';
import { notebookOf, tabLabel } from './tabs.js';
import { openNode, rememberTab } from './vault.js';
import { plainMath } from './chromeText.js';

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
  const after = () => rememberTab();
  return (
    <div className="tabbar">
      {pane.tabs.map((tab, ti) => {
        // a notebook's page is one tab for the whole notebook: its glyph, `notebook › page`
        const nb = notebookOf(tab.id, docs);
        const kind = tabKindOf(nb ?? tab.id, docs);
        const session = kind === 'session' ? sessionEl : null;
        const glyph = session ? EL_GLYPH[session.kind] : GLYPH[kind];
        const title = session ? session.label : tabLabel(tab.id, docs, root);
        return (
          <div
            key={tab.key}
            className="tab"
            data-active={ti === pane.active ? '1' : '0'}
            data-t={kind}
            data-nb={nb && nb !== tab.id ? '1' : undefined}
            onClick={() => { setPanes((s) => selectTab(s, index, ti)); after(); }}
            onAuxClick={(e) => { if (e.button === 1) { setPanes((s) => closeTab(s, index, ti)); after(); } }}
          >
            <span className="glyph" data-t={kind} data-el={session?.kind}>{glyph}</span>
            <TabTitle title={plainMath(title)} />
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
  const covered = useApp((s) => s.paletteOpen || s.tweaksOpen);
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
              {tab && <Lens key={tab.key} id={tab.id} active={pi === panes.active && !covered} onOpen={onOpen} />}
            </div>
          </div>
        );
      })}
    </div>
  );
}
