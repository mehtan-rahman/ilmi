// The tweaks panel: theme, accent, density, and the day's budget. ⌘, opens
// it. The first three live in the webview's storage, not in any vault; the
// budget is the open vault's, in its `.ilmi/state.json`.

import { useEffect, useState } from 'react';
import { ACCENTS, DENSITY_MAX, DENSITY_MIN, THEMES, useApp, type Accent, type Theme } from './store.js';
import { setBudget } from './vault.js';

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

export function Tweaks() {
  const theme = useApp((s) => s.theme);
  const accent = useApp((s) => s.accent);
  const density = useApp((s) => s.density);
  const vault = useApp((s) => s.vault);
  const budget = useApp((s) => s.budget);
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
      {vault !== null && (
        <div className="tw-row">
          <span className="tw-lbl">budget <span className="tw-val">a day</span></span>
          <BudgetField value={budget} />
        </div>
      )}
    </div>
  );
}
