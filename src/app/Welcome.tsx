// Before a collection is open: the wordmark, two lines, `new collection`
// and `import folder`, and the collections there are as rows (milestone
// 59: each is a database under the app's data directory). The palette's
// panel, in the canvas. ⏎ opens the selected row, j k move, n and i are
// the buttons; a folder dropped on it is imported as a collection and
// opened. A new collection is named here, in a field.
//
// On an iPad (milestone 55) there is no folder to pick or drop: the one
// button is `connect`, which takes a remote and a token and clones it as
// a collection (53's clone, imported), and the rows are the collections
// there. c is the button.

import type { DragDropEvent } from '@tauri-apps/api/webview';
import { useEffect, useRef, useState } from 'react';
import { ENTRY_GLYPH } from './chrome.js';
import { dropRoutes } from './land.js';
import { NEVER } from './platform.js';
import { GONE, openedLabel } from './recents.js';
import { useApp } from './store.js';
import { joinCollection } from './crdt.js';
import { NO_STORAGE, signIn, signOut, storageName, storageReady, type StorageSettings } from './storage.js';
import { StorageFields } from './StorageFields.js';
import { connectClone, forgetVault, importVault, importVaultFrom, nameNewVault, newVault, openVault } from './vault.js';

/** The README's first two sentences: what the app is, and what a collection is. */
const LINE = 'incremental reading, spaced-repetition cards, and incremental writing over notes in Markdown. A collection is a database on this device; a folder of plain Markdown files is what goes in and what comes out.';

export function Welcome() {
  const recents = useApp((s) => s.recents);
  const gone = useApp((s) => s.gone);
  const naming = useApp((s) => s.namingVault);
  const mobile = useApp((s) => s.mobile);
  const [sel, setSel] = useState(0);
  const [name, setName] = useState('');
  const [problem, setProblem] = useState<string | null>(null);
  const [drag, setDrag] = useState(false);
  // the iPad's `connect`: its two fields shown, what they hold, and a clone under way
  const [connecting, setConnecting] = useState(false);
  // `join`: a storage's fields, as Tweaks has them, kept here until a collection holds them
  const [joining, setJoining] = useState(false);
  const [storage, setJoinStorage] = useState<StorageSettings>({ ...NO_STORAGE, kind: 's3' });
  const [joinBusy, setJoinBusy] = useState(false);
  const [signing, setSigning] = useState(false);
  const [remote, setRemote] = useState('');
  const [token, setToken] = useState('');
  const [cloning, setCloning] = useState(false);
  // a folder on its way in
  const [importing, setImporting] = useState(false);
  const busy = useRef(false);
  const field = useRef<HTMLInputElement>(null);
  const remoteField = useRef<HTMLInputElement>(null);
  const now = new Date();

  // a collection that fails to open joins the dimmed rows
  const open = (path: string) => {
    if (busy.current) return;
    busy.current = true;
    openVault(path).catch((e: unknown) => {
      console.error(e);
      busy.current = false;
      useApp.setState((s) => ({ gone: s.gone.includes(path) ? s.gone : [...s.gone, path] }));
    });
  };

  // a folder picked or dropped: imported as a collection, then opened; what goes wrong is said under the buttons
  const bring = (run: () => Promise<unknown>) => {
    if (busy.current) return;
    busy.current = true;
    setProblem(null);
    setImporting(true);
    run().then(() => { busy.current = false; setImporting(false); }, (e: unknown) => {
      busy.current = false;
      setImporting(false);
      setProblem(e instanceof Error ? e.message : String(e));
    });
  };

  const create = () => {
    if (!naming || busy.current) return;
    busy.current = true;
    newVault(name).catch((e: unknown) => {
      busy.current = false;
      setProblem(e instanceof Error ? e.message : String(e));
    });
  };
  const cancel = () => {
    useApp.setState({ namingVault: false });
    setName('');
    setProblem(null);
  };

  const clone = () => {
    if (busy.current || !remote.trim()) return;
    busy.current = true;
    setCloning(true);
    setProblem(null);
    connectClone(remote, token).catch((e: unknown) => {
      busy.current = false;
      setCloning(false);
      setProblem(e instanceof Error ? e.message : String(e));
    });
  };
  const fail = (e: unknown) => { setProblem(e instanceof Error ? e.message : String(e)); };
  // what a storage holds, as a collection here, opened: the same as Tweaks' `join…`, with nothing open to hold the settings
  const join = () => {
    setJoinBusy(true);
    setProblem(null);
    void joinCollection(storage, storageName(storage)).then(openVault).catch(fail).finally(() => setJoinBusy(false));
  };
  const signInHere = () => {
    setSigning(true);
    signIn(storage).then((account) => setJoinStorage((was) => ({ ...was, account }))).catch(fail).finally(() => setSigning(false));
  };
  const signOutHere = () => { signOut(storage).then(() => setJoinStorage((was) => ({ ...was, account: '' }))).catch(fail); };
  const cancelConnect = () => {
    if (cloning) return;
    setConnecting(false);
    setProblem(null);
  };

  useEffect(() => { if (naming) field.current?.focus(); }, [naming]);
  useEffect(() => { if (connecting) remoteField.current?.focus(); }, [connecting]);
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
      else if (mobile) { if (e.key === 'c') { e.preventDefault(); setConnecting(true); } }
      else if (e.key === 'i') { e.preventDefault(); bring(importVault); }
      else if (e.key === 'n') { e.preventDefault(); nameNewVault(); }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [recents, sel, mobile]);

  // a folder dropped anywhere on the window: the whole window is the welcome
  // (the window's one drag-drop router, `land.ts`, hands it every event while no vault is open)
  useEffect(() => {
    if (mobile) return;
    const on = (ev: DragDropEvent) => {
      if (ev.type === 'leave') setDrag(false);
      else if (ev.type === 'drop') {
        setDrag(false);
        const p = ev.paths[0];
        if (p) bring(() => importVaultFrom(p.replace(/\/+$/, '')));
      } else setDrag(true);
    };
    dropRoutes.welcome = on;
    return () => { if (dropRoutes.welcome === on) delete dropRoutes.welcome; };
  }, [mobile]);

  const connectKeys = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') { e.preventDefault(); clone(); }
    else if (e.key === 'Escape') { e.preventDefault(); cancelConnect(); }
    e.stopPropagation();
  };

  return (
    <main className="welcome" data-drag={drag ? '1' : '0'}>
      <div className="welcome-panel">
        <div className="welcome-hd">
          <span className="welcome-mark">ilmi</span>
          <span className="welcome-line">{LINE}</span>
        </div>
        {mobile ? (
          <div className="welcome-acts">
            <button type="button" onClick={() => { setJoining(false); setConnecting(true); }}>connect</button>
            <button type="button" onClick={() => { setConnecting(false); setJoining(true); setProblem(null); }}>join</button>
          </div>
        ) : (
          <div className="welcome-acts">
            <button type="button" onClick={nameNewVault}>new collection</button>
            <button type="button" disabled={importing} onClick={() => bring(importVault)}>import folder</button>
            {!naming && <span className="welcome-problem">{importing ? 'importing…' : problem ?? ''}</span>}
          </div>
        )}
        {mobile && connecting && (
          <div className="welcome-connect">
            <label className="welcome-name">
              <span className="psub">remote</span>
              <input
                ref={remoteField}
                value={remote}
                spellCheck={false}
                autoCapitalize="off"
                autoCorrect="off"
                inputMode="url"
                disabled={cloning}
                onChange={(e) => { setRemote(e.target.value); setProblem(null); }}
                onKeyDown={connectKeys}
              />
            </label>
            <label className="welcome-name">
              <span className="psub">token</span>
              <input
                type="password"
                value={token}
                disabled={cloning}
                onChange={(e) => { setToken(e.target.value); setProblem(null); }}
                onKeyDown={connectKeys}
              />
              <span className="welcome-problem">{cloning ? 'cloning…' : problem ?? ''}</span>
              <button type="button" className="welcome-go" disabled={cloning || !remote.trim()} onClick={clone}>clone</button>
            </label>
          </div>
        )}
        {mobile && joining && (
          <div className="welcome-join tw-rows">
            <StorageFields st={storage} locked={joinBusy} mobile signing={signing} set={(p) => { setJoinStorage((was) => ({ ...was, ...p })); setProblem(null); }} onSignIn={signInHere} onSignOut={signOutHere} />
            <div className="welcome-name">
              <span className="welcome-problem">{joinBusy ? 'joining…' : problem ?? ''}</span>
              <button type="button" className="welcome-go" disabled={joinBusy || !storageReady(storage)} onClick={join}>join</button>
            </div>
          </div>
        )}
        {naming && (
          <div className="welcome-name">
            <span className="psub">new collection</span>
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
                  <span className="psub" />
                  <span className="ptag">{missing ? GONE : r.opened === NEVER ? '' : openedLabel(r.opened, now)}</span>
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
          {mobile ? <span><kbd>c</kbd> connect</span> : (
            <>
              <span><kbd>n</kbd> new collection</span><span className="dot" />
              <span><kbd>i</kbd> import folder</span>
            </>
          )}
        </div>
      </div>
    </main>
  );
}
