// Before a vault is open: the wordmark, one line, `open vault` and `new
// vault`, and the vaults opened before as rows. The palette's panel, in the
// canvas. ⏎ opens the selected row, j k move, o and n are the buttons; a
// folder dropped on it opens as a vault. A new vault is named here, in a
// field, once its parent folder is picked.

import type { DragDropEvent } from '@tauri-apps/api/webview';
import { useEffect, useRef, useState } from 'react';
import { ENTRY_GLYPH } from './chrome.js';
import { dropRoutes } from './land.js';
import { GONE, openedLabel } from './recents.js';
import { useApp } from './store.js';
import { forgetVault, newVault, openVault, pickVault, pickVaultParent } from './vault.js';

/** The README's first sentence. */
const LINE = 'incremental reading, spaced-repetition cards, and incremental writing over a directory of plain Markdown files.';

export function Welcome() {
  const recents = useApp((s) => s.recents);
  const gone = useApp((s) => s.gone);
  const parent = useApp((s) => s.newVaultIn);
  const [sel, setSel] = useState(0);
  const [name, setName] = useState('');
  const [problem, setProblem] = useState<string | null>(null);
  const [drag, setDrag] = useState(false);
  const busy = useRef(false);
  const field = useRef<HTMLInputElement>(null);
  const now = new Date();

  // a vault that fails to open (its folder went since the start) joins the dimmed rows
  const open = (path: string) => {
    if (busy.current) return;
    busy.current = true;
    openVault(path).catch((e: unknown) => {
      console.error(e);
      busy.current = false;
      useApp.setState((s) => ({ gone: s.gone.includes(path) ? s.gone : [...s.gone, path] }));
    });
  };

  const create = () => {
    if (parent === null || busy.current) return;
    busy.current = true;
    newVault(parent, name).catch((e: unknown) => {
      busy.current = false;
      setProblem(e instanceof Error ? e.message : String(e));
    });
  };
  const cancel = () => {
    useApp.setState({ newVaultIn: null });
    setName('');
    setProblem(null);
  };

  useEffect(() => { if (parent !== null) field.current?.focus(); }, [parent]);
  useEffect(() => { setSel((s) => Math.min(s, Math.max(0, recents.length - 1))); }, [recents.length]);

  // the keys, except while the name field has them
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.metaKey || e.ctrlKey || e.altKey) return;
      const tag = (e.target as HTMLElement | null)?.tagName?.toLowerCase();
      if (tag === 'input' || tag === 'textarea' || tag === 'select') return;
      if (e.key === 'j' || e.key === 'ArrowDown') { e.preventDefault(); setSel((s) => Math.min(recents.length - 1, s + 1)); }
      else if (e.key === 'k' || e.key === 'ArrowUp') { e.preventDefault(); setSel((s) => Math.max(0, s - 1)); }
      else if (e.key === 'Enter') { const r = recents[sel]; if (r) { e.preventDefault(); open(r.path); } }
      else if (e.key === 'o') { e.preventDefault(); void pickVault().catch(console.error); }
      else if (e.key === 'n') { e.preventDefault(); void pickVaultParent().catch(console.error); }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [recents, sel]);

  // a folder dropped anywhere on the window: the whole window is the welcome
  // (the window's one drag-drop router, `land.ts`, hands it every event while no vault is open)
  useEffect(() => {
    const on = (ev: DragDropEvent) => {
      if (ev.type === 'leave') setDrag(false);
      else if (ev.type === 'drop') {
        setDrag(false);
        const p = ev.paths[0];
        if (p) open(p.replace(/\/+$/, ''));
      } else setDrag(true);
    };
    dropRoutes.welcome = on;
    return () => { if (dropRoutes.welcome === on) delete dropRoutes.welcome; };
  }, []);

  return (
    <main className="welcome" data-drag={drag ? '1' : '0'}>
      <div className="welcome-panel">
        <div className="welcome-hd">
          <span className="welcome-mark">ilmi</span>
          <span className="welcome-line">{LINE}</span>
        </div>
        <div className="welcome-acts">
          <button type="button" onClick={() => void pickVault().catch(console.error)}>open collection</button>
          <button type="button" onClick={() => void pickVaultParent().catch(console.error)}>new collection</button>
        </div>
        {parent !== null && (
          <div className="welcome-name">
            <span className="psub">{parent}/</span>
            <input
              ref={field}
              value={name}
              placeholder="name"
              spellCheck={false}
              onChange={(e) => { setName(e.target.value); setProblem(null); }}
              onKeyDown={(e) => {
                if (e.key === 'Enter') { e.preventDefault(); create(); }
                else if (e.key === 'Escape') { e.preventDefault(); cancel(); }
                e.stopPropagation();
              }}
            />
            <span className="welcome-problem">{problem ?? ''}</span>
            <kbd>↵</kbd>
          </div>
        )}
        {recents.length > 0 && (
          <div className="welcome-list">
            {recents.map((r, i) => {
              const missing = gone.includes(r.path);
              return (
                <div
                  key={r.path}
                  className="palette-row welcome-row"
                  data-sel={i === sel ? '1' : '0'}
                  data-gone={missing ? '1' : '0'}
                  onMouseEnter={() => setSel(i)}
                  onClick={() => open(r.path)}
                >
                  <span className="pg">{ENTRY_GLYPH.vault}</span>
                  <span className="pt">{r.name}</span>
                  <span className="psub">{r.path}</span>
                  <span className="ptag">{missing ? GONE : openedLabel(r.opened, now)}</span>
                  {missing && (
                    <button type="button" className="welcome-forget" onClick={(e) => { e.stopPropagation(); forgetVault(r.path); }}>forget</button>
                  )}
                </div>
              );
            })}
          </div>
        )}
        <div className="palette-foot">
          {recents.length > 0 && (
            <>
              <span><kbd>↵</kbd> open</span><span className="dot" />
              <span><kbd>j k</kbd> move</span><span className="dot" />
            </>
          )}
          <span><kbd>o</kbd> open collection</span><span className="dot" />
          <span><kbd>n</kbd> new collection</span>
        </div>
      </div>
    </main>
  );
}
