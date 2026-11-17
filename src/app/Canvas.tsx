// The canvas: up to three panes, each with a tab bar and the lens of its
// active tab. Pane state lives in the store as a `Panes` value; the pure
// operations are in panes.ts.

import { Lens } from './Lenses.js';
import { EL_GLYPH } from './items.js';
import { GLYPH, INTAKE, WRITTEN_GLYPH, tabKindOf } from './names.js';
import { activatePane, closePane, closeTab, selectTab, splitPane, type OpenOpts, type Pane } from './panes.js';
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

export function Canvas() {
  const panes = useApp((s) => s.panes);
  const setPanes = useApp((s) => s.setPanes);
  const covered = useApp((s) => s.paletteOpen || s.tweaksOpen || s.quickCard !== null);
  // an open context menu covers the page too: its keys are the menu's (`popMenu.ts`), not a session's grades or a deck's ⌫
  const menuOpen = useApp((s) => s.menuOpen);
  // a phone draws one page: no tabs (milestone 56)
  const phone = useApp((s) => s.phone);
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
            {!phone && <TabBar pane={pane} index={pi} canClosePane={panes.panes.length > 1} />}
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
