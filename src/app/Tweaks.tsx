// The tweaks panel: theme, accent, density, whether the last vault reopens
// on start, whether a clipped page's images are downloaded, whether images
// from the web are shown, whether the queue names documents by title, the
// day's budget, and where clippings land. ⌘, opens it. The first seven live
// in the webview's storage, not in any vault;
// the budget and the clippings folder are the open vault's, in its
// `.ilmi/state.json`.

import { useEffect, useState } from 'react';
import { PluginsSection } from '../plugins/PluginsSection.js';
import { folderPaths, titleOf } from './names.js';
import { ACCENTS, DENSITY_MAX, DENSITY_MIN, THEMES, useApp, type Accent, type Theme } from './store.js';
import { setBudget, setClipDir } from './vault.js';

const THEME_LABEL: Record<Theme, string> = { light: 'light', dark: 'dark', eink: 'e-ink' };

/** The budget as a number field: empty is none; commits on blur or ⏎, escape restores. */
function BudgetField({ value }: { value: number }) {
  const shown = value ? String(value) : '';
  const [text, setText] = useState(shown);
  useEffect(() => { setText(shown); }, [shown]);
  const commit = () => {
    const n = text.trim() === '' ? 0 : Math.floor(Number(text));
    if (!Number.isFinite(n) || n < 0) { setText(shown); return; }
    setBudget(n);
    setText(n ? String(n) : '');
  };
  return (
    <input
      className="tw-num"
      type="number"
      inputMode="numeric"
      min={0}
      step={1}
      value={text}
      onChange={(e) => setText(e.target.value)}
      onBlur={commit}
      onKeyDown={(e) => {
        if (e.key === 'Enter') { e.preventDefault(); commit(); e.currentTarget.blur(); }
        else if (e.key === 'Escape') { e.preventDefault(); setText(shown); e.currentTarget.blur(); }
        e.stopPropagation();
      }}
    />
  );
}

/** The folder an `ilmi://new` link lands in: every folder of the vault, the root as the vault's name. A folder set but gone reads as the root. */
function ClipDirPick({ value }: { value: string }) {
  const tree = useApp((s) => s.tree);
  const docs = useApp((s) => s.docs);
  const vault = useApp((s) => s.vault);
  const folders = folderPaths(tree);
  return (
    <select
      className="tw-sel"
      value={folders.includes(value) ? value : ''}
      onChange={(e) => setClipDir(e.target.value)}
      onKeyDown={(e) => e.stopPropagation()}
    >
      {folders.map((f) => (
        <option key={f} value={f}>{f === '' ? titleOf('', docs, vault) : f}</option>
      ))}
    </select>
  );
}

export function Tweaks() {
  const theme = useApp((s) => s.theme);
  const accent = useApp((s) => s.accent);
  const density = useApp((s) => s.density);
  const reopen = useApp((s) => s.reopen);
  const clipImages = useApp((s) => s.clipImages);
  const remoteImages = useApp((s) => s.remoteImages);
  const queueTitles = useApp((s) => s.queueTitles);
  const vault = useApp((s) => s.vault);
  const budget = useApp((s) => s.budget);
  const clipDir = useApp((s) => s.clipDir);
  const close = () => useApp.setState({ tweaksOpen: false });

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') { e.preventDefault(); close(); } };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);

  return (
    <div className="tweaks">
      <div className="tw-hd">
        <span>tweaks</span>
        <button type="button" className="tw-x" onClick={close}>×</button>
      </div>
      <div className="tw-row">
        <span className="tw-lbl">theme</span>
        <div className="tw-seg">
          {THEMES.map((t) => (
            <button key={t} type="button" data-active={theme === t ? '1' : '0'} onClick={() => useApp.getState().setTheme(t)}>{THEME_LABEL[t]}</button>
          ))}
        </div>
      </div>
      <div className="tw-row">
        <span className="tw-lbl">accent</span>
        <div className="tw-seg wrap">
          {(Object.keys(ACCENTS) as Accent[]).map((a) => (
            <button key={a} type="button" data-active={accent === a ? '1' : '0'} onClick={() => useApp.getState().setAccent(a)}>
              <i className="tw-dot" style={{ background: `oklch(${ACCENTS[a].light} ${ACCENTS[a].c} ${ACCENTS[a].h})` }} />
              {ACCENTS[a].label}
            </button>
          ))}
        </div>
      </div>
      <div className="tw-row">
        <span className="tw-lbl">density <span className="tw-val">{density.toFixed(2)}</span></span>
        <input
          type="range"
          className="tw-slider"
          min={DENSITY_MIN}
          max={DENSITY_MAX}
          step={0.05}
          value={density}
          onChange={(e) => useApp.getState().setDensity(Number(e.target.value))}
        />
      </div>
      <div className="tw-row">
        <span className="tw-lbl">reopen the last collection on start</span>
        <div className="tw-seg">
          <button type="button" data-active={reopen ? '1' : '0'} onClick={() => useApp.getState().setReopen(true)}>on</button>
          <button type="button" data-active={reopen ? '0' : '1'} onClick={() => useApp.getState().setReopen(false)}>off</button>
        </div>
      </div>
      <div className="tw-row">
        <span className="tw-lbl">download images when clipping</span>
        <div className="tw-seg">
          <button type="button" data-active={clipImages ? '1' : '0'} onClick={() => useApp.getState().setClipImages(true)}>on</button>
          <button type="button" data-active={clipImages ? '0' : '1'} onClick={() => useApp.getState().setClipImages(false)}>off</button>
        </div>
      </div>
      <div className="tw-row">
        <span className="tw-lbl">show remote images</span>
        <div className="tw-seg">
          <button type="button" data-active={remoteImages ? '1' : '0'} onClick={() => useApp.getState().setRemoteImages(true)}>on</button>
          <button type="button" data-active={remoteImages ? '0' : '1'} onClick={() => useApp.getState().setRemoteImages(false)}>off</button>
        </div>
      </div>
      <div className="tw-row">
        <span className="tw-lbl">queue shows titles</span>
        <div className="tw-seg">
          <button type="button" data-active={queueTitles ? '1' : '0'} onClick={() => useApp.getState().setQueueTitles(true)}>on</button>
          <button type="button" data-active={queueTitles ? '0' : '1'} onClick={() => useApp.getState().setQueueTitles(false)}>off</button>
        </div>
      </div>
      {vault !== null && (
        <div className="tw-row">
          <span className="tw-lbl">budget <span className="tw-val">a day</span></span>
          <BudgetField value={budget} />
        </div>
      )}
      {vault !== null && (
        <div className="tw-row">
          <span className="tw-lbl">clippings go to</span>
          <ClipDirPick value={clipDir} />
        </div>
      )}
      {vault !== null && <PluginsSection />}
    </div>
  );
}
