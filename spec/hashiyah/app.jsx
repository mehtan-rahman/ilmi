// app.jsx — root, pane/tab model, tweaks wiring, global keyboard router.
// Architecture: state = panes[]. Each pane has { tabs[], activeIdx }.
// A tab is { key, kind, id, title }. Kinds: 'queue' | 'view' | 'source' | 'card'.
// Recall isn't a mode — it's just what a 'card' tab renders.
// The live model lives in store.jsx (StoreProvider); Workbench reads it.

const TWEAK_DEFAULTS = /*EDITMODE-BEGIN*/{
  "theme": "light",
  "density": 1.0,
  "chrome": 1.0,
  "palette": "gold",
  "contrast": 1.0,
  "readingWidth": 600,
  "serifSize": 18,
  "serifWeight": 420,
  "showHints": true
}/*EDITMODE-END*/;

const PALETTE_PRESETS = {
  gold:     { hue: 86,  sat: 0.135, lLight: 0.62, lDark: 0.80 },
  ink:      { hue: 256, sat: 0.085 },
  blue:     { hue: 248, sat: 0.115 },
  red:      { hue: 25,  sat: 0.15 },
  sage:     { hue: 150, sat: 0.06 },
  graphite: { hue: 256, sat: 0 },
};

// ── helpers ─────────────────────────────────────────────────────
let _keyCounter = 1;
function tabKey() { return 't' + (_keyCounter++); }
function makeTab(spec) { return { key: tabKey(), ...spec }; }

// ── Workbench (everything inside the store) ─────────────────────
function Workbench() {
  const [t, setTweak] = useTweaks(TWEAK_DEFAULTS);

  const [panes, setPanes] = React.useState(() => ([
    { tabs: [ makeTab({ kind: 'queue', id: 'today', title: 'due today' }),
              makeTab({ kind: 'view', id: 'reading', title: 'reading' }) ], activeIdx: 0 },
    { tabs: [ makeTab({ kind: 'source', id: 'wozniak-1990', title: 'wozniak-1990' }),
              makeTab({ kind: 'card', id: 'cw2-min', title: 'card' }) ], activeIdx: 0 },
  ]));
  const [activePaneIdx, setActivePaneIdx] = React.useState(1);
  const [paletteOpen, setPaletteOpen] = React.useState(false);
  const [sessionEl, setSessionEl] = React.useState(null);   // current session element kind (card/read/write)

  // inspector: hideable + drag-resizable, persisted across reloads
  // (keys stay `hashiyah.*` on purpose — see HANDOFF; the real build owns its own persistence)
  const [inspOpen, setInspOpen] = React.useState(() => {
    try { const v = localStorage.getItem('hashiyah.inspOpen'); if (v !== null) return v === '1'; } catch (e) {}
    return window.innerWidth > 1180;
  });
  const [inspW, setInspW] = React.useState(() => {
    try { const v = parseInt(localStorage.getItem('hashiyah.inspW') || '', 10); if (v) return Math.min(520, Math.max(220, v)); } catch (e) {}
    return 280;
  });
  React.useEffect(() => { try { localStorage.setItem('hashiyah.inspOpen', inspOpen ? '1' : '0'); } catch (e) {} }, [inspOpen]);
  React.useEffect(() => { try { localStorage.setItem('hashiyah.inspW', String(inspW)); } catch (e) {} }, [inspW]);

  // sidebar (tree): drag-resizable, persisted
  const [sideW, setSideW] = React.useState(() => {
    try { const v = parseInt(localStorage.getItem('hashiyah.sideW') || '', 10); if (v) return Math.min(440, Math.max(160, v)); } catch (e) {}
    return 220;
  });
  React.useEffect(() => { try { localStorage.setItem('hashiyah.sideW', String(sideW)); } catch (e) {} }, [sideW]);
  const startSideResize = React.useCallback((e) => {
    e.preventDefault();
    const onMove = (ev) => setSideW(Math.min(440, Math.max(160, ev.clientX)));
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

  const startInspResize = React.useCallback((e) => {
    e.preventDefault();
    const onMove = (ev) => setInspW(Math.min(520, Math.max(220, window.innerWidth - ev.clientX)));
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

  const activePane = panes[activePaneIdx];
  const activeTab = activePane && activePane.tabs[activePane.activeIdx];

  // tweaks → CSS vars
  React.useEffect(() => {
    const root = document.documentElement;
    root.setAttribute('data-theme', t.theme);
    root.style.setProperty('--rho', t.density);
    root.style.setProperty('--chrome', t.chrome);
    root.style.setProperty('--contrast', t.contrast);
    root.style.setProperty('--reading-width', t.readingWidth + 'px');
    root.style.setProperty('--serif-size', t.serifSize + 'px');
    root.style.setProperty('--serif-weight', t.serifWeight);
    const preset = PALETTE_PRESETS[t.palette] || PALETTE_PRESETS.gold;
    root.style.setProperty('--accent-h', preset.hue);
    root.style.setProperty('--accent-c', preset.sat);
    root.style.setProperty('--accent-l-light', preset.lLight != null ? preset.lLight : 0.52);
    root.style.setProperty('--accent-l-dark', preset.lDark != null ? preset.lDark : 0.74);
  }, [t]);

  // ── pane operations ───────────────────────────────────────────
  const openTab = React.useCallback((spec, opts = {}) => {
    setPanes(prev => {
      const next = prev.map(p => ({ ...p, tabs: [...p.tabs] }));
      for (let pi = 0; pi < next.length; pi++) {
        const ti = next[pi].tabs.findIndex(tb => tb.kind === spec.kind && tb.id === spec.id);
        if (ti >= 0) {
          if (spec.focus) next[pi].tabs[ti] = { ...next[pi].tabs[ti], focus: spec.focus, key: tabKey() };
          next[pi].activeIdx = ti; setActivePaneIdx(pi); return next;
        }
      }
      if (opts.cmdClick && opts.shiftClick) {
        let targetIdx = activePaneIdx + 1;
        if (next.length < 3) next.splice(targetIdx, 0, { tabs: [], activeIdx: 0 });
        else targetIdx = (activePaneIdx + 1) % next.length;
        next[targetIdx].tabs.push(makeTab(spec));
        next[targetIdx].activeIdx = next[targetIdx].tabs.length - 1;
        setActivePaneIdx(targetIdx);
        return next;
      }
      if (opts.cmdClick) {
        next[activePaneIdx].tabs.push(makeTab(spec));
        next[activePaneIdx].activeIdx = next[activePaneIdx].tabs.length - 1;
        return next;
      }
      if (opts.newTab) {
        next[activePaneIdx].tabs.push(makeTab(spec));
        next[activePaneIdx].activeIdx = next[activePaneIdx].tabs.length - 1;
        return next;
      }
      const pane = next[activePaneIdx];
      if (pane.tabs.length === 0) { pane.tabs.push(makeTab(spec)); pane.activeIdx = 0; }
      else pane.tabs[pane.activeIdx] = makeTab(spec);
      return next;
    });
  }, [activePaneIdx]);

  const selectTab = (paneIdx, tabIdx) => {
    setPanes(prev => prev.map((p, i) => i === paneIdx ? { ...p, activeIdx: tabIdx } : p));
    setActivePaneIdx(paneIdx);
  };

  // session elements update the tab title as you move through the queue
  const setActiveTabTitle = React.useCallback((title) => {
    setPanes(prev => prev.map((p, pi) => pi === activePaneIdx
      ? { ...p, tabs: p.tabs.map((tb, ti) => ti === p.activeIdx && tb.title !== title ? { ...tb, title } : tb) }
      : p));
  }, [activePaneIdx]);
  const onSessionEl = React.useCallback((info) => {
    setSessionEl(info ? info.kind : null);
    if (info && info.title) setActiveTabTitle(info.title);
  }, [setActiveTabTitle]);

  const closeTab = (paneIdx, tabIdx) => {
    setPanes(prev => {
      const next = prev.map(p => ({ ...p, tabs: [...p.tabs] }));
      next[paneIdx].tabs.splice(tabIdx, 1);
      if (next[paneIdx].tabs.length === 0) {
        if (next.length > 1) { next.splice(paneIdx, 1); return next; }
        next[paneIdx].tabs.push(makeTab({ kind: 'queue', id: 'today', title: 'today' }));
        next[paneIdx].activeIdx = 0;
        return next;
      }
      if (next[paneIdx].activeIdx >= next[paneIdx].tabs.length) next[paneIdx].activeIdx = next[paneIdx].tabs.length - 1;
      else if (next[paneIdx].activeIdx > tabIdx) next[paneIdx].activeIdx -= 1;
      return next;
    });
  };

  const splitPane = (paneIdx) => {
    setPanes(prev => {
      if (prev.length >= 3) return prev;
      const next = prev.map(p => ({ ...p, tabs: [...p.tabs] }));
      next.splice(paneIdx + 1, 0, { tabs: [makeTab({ kind: 'queue', id: 'today', title: 'today' })], activeIdx: 0 });
      setActivePaneIdx(paneIdx + 1);
      return next;
    });
  };

  const closePane = (paneIdx) => {
    setPanes(prev => {
      if (prev.length <= 1) return prev;
      const next = prev.filter((_, i) => i !== paneIdx);
      setActivePaneIdx(Math.min(activePaneIdx, next.length - 1));
      return next;
    });
  };

  // ── click handler shared by sidebar + queue + palette ─────────
  const onOpenItem = (spec, opts) => {
    let tab;
    const isRead = spec.el === 'read' || spec.kind === 'read';
    const isWrite = spec.el === 'write';
    if (isRead || isWrite) {
      // a reading topic or a writing draft enters the same session surface
      tab = { kind: 'card', id: spec.id, title: spec.sourceLabel || spec.title || spec.id };
    } else if (spec.kind === 'card') {
      tab = { kind: 'card', id: spec.id, title: spec.title || 'card', browse: spec.browse };
    } else {
      tab = { kind: spec.kind, id: spec.id, title: spec.title, focus: spec.focus };
    }
    openTab(tab, opts || {});
  };

  // ── commands for the palette ──────────────────────────────────
  const commands = React.useMemo(() => ([
    { id: 'cmd-split',  title: 'split pane right',        run: () => splitPane(activePaneIdx) },
    { id: 'cmd-theme',  title: 'cycle theme', run: () => setTweak('theme', t.theme === 'light' ? 'dark' : t.theme === 'dark' ? 'eink' : 'light') },
    { id: 'cmd-today',  title: 'due today',       run: () => onOpenItem({ kind: 'queue', id: 'today', title: 'due today' }) },
    { id: 'cmd-up',     title: 'upcoming',        run: () => onOpenItem({ kind: 'queue', id: 'upcoming', title: 'upcoming' }) },
    { id: 'cmd-read',   title: 'reading (topics)', run: () => onOpenItem({ kind: 'view', id: 'reading', title: 'reading' }) },
    { id: 'cmd-writing', title: 'writing (drafts)', run: () => onOpenItem({ kind: 'view', id: 'writing', title: 'writing' }) },
    { id: 'cmd-cards',  title: 'all cards',       run: () => onOpenItem({ kind: 'view', id: 'cards', title: 'all cards' }) },
    { id: 'cmd-woz',    title: 'open wozniak-1990', run: () => onOpenItem({ kind: 'source', id: 'wozniak-1990', title: 'wozniak-1990' }) },
    { id: 'cmd-intake', title: 'add a source', run: () => onOpenItem({ kind: 'intake', id: 'intake', title: 'intake' }) },
    { id: 'cmd-deck',   title: 'open deck · german · A1', run: () => onOpenItem({ kind: 'deck', id: 'german', title: 'german · A1' }) },
    { id: 'cmd-draft',  title: 'open draft · spaced composition', run: () => onOpenItem({ kind: 'draft', id: 'draft-sc', title: 'spaced composition' }) },
    { id: 'cmd-hints',  title: 'toggle keyboard hint strip', run: () => setTweak('showHints', !t.showHints) },
    { id: 'cmd-insp',   title: 'toggle inspector panel',   run: () => setInspOpen(o => !o) },
    { id: 'cmd-closepane', title: 'close active pane',    run: () => closePane(activePaneIdx) },
  ]), [activePaneIdx, t.theme, t.showHints]);

  // ── global keyboard (palette + pane ops only) ─────────────────
  React.useEffect(() => {
    const onKey = (e) => {
      if ((e.metaKey || e.ctrlKey) && (e.key === 'k' || e.key === 'K')) { e.preventDefault(); setPaletteOpen(o => !o); return; }
      const tag = (e.target.tagName || '').toLowerCase();
      if (tag === 'input' || tag === 'textarea') return;
      if ((e.metaKey || e.ctrlKey) && e.key === '\\') { e.preventDefault(); splitPane(activePaneIdx); return; }
      if ((e.metaKey || e.ctrlKey) && e.key === 'w') { e.preventDefault(); if (activePane) closeTab(activePaneIdx, activePane.activeIdx); return; }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [activePaneIdx, activePane]);

  // ── render one tab body ───────────────────────────────────────
  const renderBody = (tab, paneActive) => {
    if (!tab) return null;
    if (tab.kind === 'queue' || tab.kind === 'view') return <SavedView key={tab.key} scope={tab.id} onOpen={onOpenItem} active={paneActive} />;
    if (tab.kind === 'source') return <Reader key={tab.key} sourceId={tab.id} active={paneActive} onOpen={onOpenItem} focus={tab.focus} />;
    if (tab.kind === 'card') return <Recall key={tab.key} cardId={tab.id} active={paneActive} browse={tab.browse} onOpen={onOpenItem} onEl={paneActive ? onSessionEl : undefined} />;
    if (tab.kind === 'deck') return <DeckView key={tab.key} deckId={tab.id} active={paneActive} onOpen={onOpenItem} focus={tab.focus} />;
    if (tab.kind === 'folder') return <FolderView key={tab.key} folderId={tab.id} active={paneActive} onOpen={onOpenItem} focus={tab.focus} />;
    if (tab.kind === 'draft') return <DraftView key={tab.key} draftId={tab.id} active={paneActive} onOpen={onOpenItem} focus={tab.focus} />;
    if (tab.kind === 'intake') return <Intake key={tab.key} onOpen={onOpenItem} active={paneActive} />;
    return null;
  };

  return (
    <>
      <div className="shell" style={{ '--side-w': sideW + 'px', '--insp-w': inspOpen ? inspW + 'px' : '0px' }}>
        <TopStrip onPalette={() => setPaletteOpen(true)} inspOpen={inspOpen} onToggleInsp={() => setInspOpen(o => !o)} />
        <Sidebar activeKey={activeTab ? `${activeTab.kind}:${activeTab.id}` : ''} onOpen={onOpenItem} />
        <div className="side-resize" onMouseDown={startSideResize} title="Drag to resize" />
        <div className="canvas">
          {panes.map((pane, pi) => (
            <div key={pi} className="pane" data-active={pi === activePaneIdx ? '1' : '0'}
                 onMouseDown={() => setActivePaneIdx(pi)}>
              <TabBar pane={pane} paneIdx={pi} isActive={pi === activePaneIdx}
                      onSelect={selectTab} onClose={closeTab} onSplit={splitPane}
                      onClosePane={closePane} canClosePane={panes.length > 1} />
              <div className="pane-body">
                {renderBody(pane.tabs[pane.activeIdx], pi === activePaneIdx && !paletteOpen)}
              </div>
            </div>
          ))}
        </div>
        {inspOpen && <Inspector activeTab={activeTab} />}
        {inspOpen && <div className="insp-resize" onMouseDown={startInspResize} title="Drag to resize" />}
        {t.showHints
          ? <BottomStrip activeKind={activeTab && activeTab.kind === 'card' ? (sessionEl || 'card') : (activeTab && activeTab.kind)} />
          : <div className="bot" style={{ visibility: 'hidden' }} />}
      </div>

      <CommandPalette open={paletteOpen} onClose={() => setPaletteOpen(false)} onOpen={onOpenItem} commands={commands} />

      <TweaksPanel title="ilmi — register">
        <TweakSection label="register" />
        <TweakRadio label="theme" value={t.theme}
                    options={[{ value: 'light', label: 'light' }, { value: 'dark', label: 'dark' }, { value: 'eink', label: 'e-ink' }]}
                    onChange={(v) => setTweak('theme', v)} />
        <TweakSelect label="accent" value={t.palette}
                     options={[
                       { value: 'gold', label: 'gold' },
                       { value: 'ink', label: 'ink' },
                       { value: 'blue', label: 'pen blue' },
                       { value: 'red', label: 'proof red' },
                       { value: 'sage', label: 'sage' },
                       { value: 'graphite', label: 'graphite' },
                     ]}
                     onChange={(v) => setTweak('palette', v)} />
        <TweakSection label="density & weight" />
        <TweakSlider label="row rhythm" value={Number(t.density.toFixed(2))} min={0.6} max={1.6} step={0.05} onChange={(v) => setTweak('density', v)} />
        <TweakSlider label="chrome visibility" value={Number(t.chrome.toFixed(2))} min={0.2} max={1.8} step={0.05} onChange={(v) => setTweak('chrome', v)} />
        <TweakSlider label="type contrast" value={Number(t.contrast.toFixed(2))} min={0.6} max={1.4} step={0.05} onChange={(v) => setTweak('contrast', v)} />
        <TweakSection label="reading" />
        <TweakSlider label="reading width" value={t.readingWidth} min={460} max={780} step={20} unit="px" onChange={(v) => setTweak('readingWidth', v)} />
        <TweakSlider label="body size" value={t.serifSize} min={15} max={24} step={1} unit="px" onChange={(v) => setTweak('serifSize', v)} />
        <TweakSlider label="body weight" value={t.serifWeight} min={380} max={520} step={10} onChange={(v) => setTweak('serifWeight', v)} />
        <TweakSection label="affordances" />
        <TweakToggle label="kbd hint strip" value={t.showHints} onChange={(v) => setTweak('showHints', v)} />
      </TweaksPanel>
    </>
  );
}

function App() {
  return (
    <StoreProvider>
      <Workbench />
    </StoreProvider>
  );
}

ReactDOM.createRoot(document.getElementById('root')).render(<App />);
