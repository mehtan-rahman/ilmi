// Before a collection is open: the wordmark, two lines, `new collection`
// and `import folder`, and the collections there are as rows (milestone
// 59: each is a database under the app's data directory). The palette's
// panel, in the canvas. ⏎ opens the selected row, j k move, n and i are
// the buttons; a folder dropped on it is imported as a collection and
// opened. A new collection is named here, in a field.
//
// A row has the app's row menu (right-click, a long press, or its `···`):
// `rename…` makes the name a field in place (F2; ⏎ commits, Esc cancels, a
// blur commits) and `delete…` asks on the row, naming what goes (⌘⌫; the
// focus on `keep`, Esc keeps). Neither is done to a collection a window has
// open. `export` is not here: an export reads through an open collection
// (its bring-up, its files fetched from a storage), so it stays the open
// collection's command.
//
// On an iPad (milestone 55) there is no folder to pick or drop: the one
// button is `connect`, which takes a remote and a token and clones it as
// a collection (53's clone, imported), and the rows are the collections
// there. c is the button. Beside it and `join`, `scan a code` (milestone
// 84): the camera reads a pairing code off a device that already syncs the
// collection (`pair.ts`, `scan.ts`), and the collection is made here from
// the remote or the storage the code names, as if its fields had been typed.

import { useOpenedWaiting } from './opened.js';
import type { DragDropEvent } from '@tauri-apps/api/webview';
import { useEffect, useLayoutEffect, useRef, useState } from 'react';
import { ENTRY_GLYPH } from './chrome.js';
import { CLOSE_FIRST, nameProblem, removeCollection, renameCollectionTo } from './collections.js';
import { dropRoutes } from './land.js';
import { NEVER } from './platform.js';
import { GONE, openedLabel, renameRecent, type Recent } from './recents.js';
import { useApp } from './store.js';
import { settingsOf } from './sync.js';
import { collectionCounts, collectionHeld, listCollections } from '../vault/tauri-store.js';
import { joinCollection } from './crdt.js';
import { NO_STORAGE, signIn, signOut, storageName, storageOf, storageReady, type StorageSettings } from './storage.js';
import { decodePairing, joinFromPairing, needsSignIn, storageOfPairing } from './pair.js';
import { scanCode } from './scan.js';
import { StorageFields } from './StorageFields.js';
import { connectClone, forgetVault, importVault, importVaultFrom, listVaults, nameNewVault, newVault, openVault } from './vault.js';
import { Glyph, Icon } from './icons.js';

/** The README's first two sentences: what the app is, and what a collection is. */
const LINE = 'incremental reading, spaced-repetition cards, and incremental writing over notes in Markdown. A collection is a database on this device; a folder of plain Markdown files is what goes in and what comes out.';

const said = (e: unknown): string => (e instanceof Error ? e.message : String(e));
const count = (n: number, word: string): string => `${n} ${word}${n === 1 ? '' : 's'}`;

/** What a row's `delete…` asks: what goes, where what was synced stays, and that there is no way back. */
export function deleteAsk(name: string, holds: { cards: number; documents: number } | null, syncs: 'storage' | 'remote' | null, mobile: boolean): string {
  const here = !mobile && /Mac/.test(globalThis.navigator?.userAgent ?? '') ? 'this mac' : 'this device';
  const goes = holds ? `its ${count(holds.cards, 'card')} and ${count(holds.documents, 'document')} are removed from ${here}.` : `it is removed from ${here}.`;
  const stays = syncs === 'storage' ? ' its storage keeps what was sent.' : syncs === 'remote' ? ' its remote keeps what was pushed.' : '';
  return `delete ${name}? ${goes}${stays} this cannot be undone.`;
}

export function Welcome() {
  const recents = useApp((s) => s.recents);
  const gone = useApp((s) => s.gone);
  const naming = useApp((s) => s.namingVault);
  const mobile = useApp((s) => s.mobile);
  const [sel, setSel] = useState(0);
  const [name, setName] = useState('');
  const [problem, setProblem] = useState<string | null>(null);
  // the collections that are there and did not open, each with what the failure said
  const [unopened, setUnopened] = useState<Record<string, string>>({});
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
  // `scan a code`: a collection on its way from what the code named
  const [pairing, setPairing] = useState(false);
  // a folder on its way in
  const [importing, setImporting] = useState(false);
  // a row's menu, at a point; the row whose name is a field; the row that asks before it is deleted; what a row was refused, said on it
  const [menu, setMenu] = useState<{ path: string; x: number; y: number } | null>(null);
  const [editing, setEditing] = useState<{ path: string; value: string } | null>(null);
  const [asking, setAsking] = useState<{ path: string; line: string } | null>(null);
  const [refused, setRefused] = useState<{ path: string; why: string } | null>(null);
  // the rename as of now: ⏎ and the blur that follows it commit once
  const editingNow = useRef(editing);
  editingNow.current = editing;
  const asked = useRef(0);
  const menuEl = useRef<HTMLDivElement>(null);
  const renameField = useRef<HTMLInputElement>(null);
  const keepButton = useRef<HTMLButtonElement>(null);
  const busy = useRef(false);
  const field = useRef<HTMLInputElement>(null);
  const remoteField = useRef<HTMLInputElement>(null);
  const now = new Date();

  // a collection that does not open says why on its row; one that is not there any more joins the dimmed rows, with `forget`
  const open = (path: string) => {
    if (busy.current) return;
    busy.current = true;
    setRefused(null);
    setUnopened((u) => { const { [path]: _, ...rest } = u; return rest; });
    openVault(path).catch(async (e: unknown) => {
      console.error(e);
      busy.current = false;
      // there or not is asked of the collections there are, not read off the failure: a database that is locked or damaged is still there
      const there = await listCollections().then(({ home, names }) => names.some((n) => `${home.replace(/\/+$/, '')}/${n}` === path), () => true);
      if (there) setUnopened((u) => ({ ...u, [path]: e instanceof Error ? e.message : String(e) }));
      else useApp.setState((s) => ({ gone: s.gone.includes(path) ? s.gone : [...s.gone, path] }));
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
  // `scan a code`: the camera's code read, and the collection it names made here and opened; a storage that is
  // signed in to has its fields filled, and the sign-in and `join` are left to press
  const scan = () => {
    if (busy.current || pairing) return;
    setProblem(null);
    void scanCode().then(async (text) => {
      if (text === null) return;
      const p = decodePairing(text);
      if (needsSignIn(p)) {
        setJoinStorage(storageOfPairing(p));
        setConnecting(false);
        setJoining(true);
        setProblem('sign in to finish, then join');
        return;
      }
      busy.current = true;
      setConnecting(false);
      setJoining(false);
      setPairing(true);
      try {
        await openVault(await joinFromPairing(p, mobile));
      } finally {
        busy.current = false;
        setPairing(false);
      }
    }).catch(fail);
  };
  const cancelConnect = () => {
    if (cloning) return;
    setConnecting(false);
    setProblem(null);
  };

  // `rename…`: the row's name as a field, all of it selected. A row that is not where it was has `forget` and nothing else.
  const beginRename = (r: Recent | undefined) => {
    if (!r || gone.includes(r.path)) return;
    asked.current++;
    setMenu(null);
    setAsking(null);
    setRefused(null);
    setEditing({ path: r.path, value: r.name });
  };
  // ⏎ keeps the field when the name is refused, so it can be mended; a blur lets the field go and the row says why
  const commitRename = (stay: boolean) => {
    const e = editingNow.current;
    if (!e) return;
    const r = recents.find((x) => x.path === e.path);
    const name = e.value.trim();
    const end = () => { editingNow.current = null; setEditing(null); };
    if (!r || !name || name === r.name) { end(); return; }
    const problem = nameProblem(name, recents.filter((x) => x.path !== r.path).map((x) => x.name));
    if (problem) {
      setRefused({ path: r.path, why: problem });
      if (!stay) end();
      return;
    }
    end();
    setRefused(null);
    renameCollectionTo(r.path, name).then(async (to) => {
      // the row keeps its time, so the collection reopened on start is still this one
      const s = useApp.getState();
      s.setRecents(renameRecent(s.recents, r.path, to));
      setUnopened((u) => { const { [r.path]: _, ...rest } = u; return rest; });
      await listVaults().catch(console.error);
      const at = useApp.getState().recents.findIndex((x) => x.path === to);
      if (at >= 0) setSel(at);
    }, (err: unknown) => setRefused({ path: r.path, why: said(err) }));
  };

  // `delete…`: asked on the row, with what the collection holds when its tables say; one a window has open is not asked about
  const askDelete = (r: Recent | undefined) => {
    if (!r || gone.includes(r.path)) return;
    const mine = ++asked.current;
    setMenu(null);
    setEditing(null);
    setRefused(null);
    void Promise.all([collectionHeld(r.path).catch(() => false), collectionCounts(r.path).catch(() => null)]).then(([held, holds]) => {
      if (mine !== asked.current) return;
      if (held) { setRefused({ path: r.path, why: CLOSE_FIRST }); return; }
      const syncs = storageOf(r.path).on ? 'storage' : settingsOf(r.path).url ? 'remote' : null;
      setAsking({ path: r.path, line: deleteAsk(r.name, holds, syncs, mobile) });
    });
  };
  const keep = () => { asked.current++; setAsking(null); };
  const remove = (path: string) => {
    asked.current++;
    setAsking(null);
    removeCollection(path).then(async () => {
      forgetVault(path);
      setUnopened((u) => { const { [path]: _, ...rest } = u; return rest; });
      await listVaults().catch(console.error);
    }, (err: unknown) => setRefused({ path, why: said(err) }));
  };

  useEffect(() => { if (naming) field.current?.focus(); }, [naming]);
  useEffect(() => { if (editing) { renameField.current?.focus(); renameField.current?.select(); } }, [editing?.path]);
  useEffect(() => { if (asking) keepButton.current?.focus(); }, [asking]);
  // the menu stays inside the window, and a press anywhere else closes it
  useLayoutEffect(() => {
    const el = menuEl.current;
    if (!menu || !el) return;
    const r = el.getBoundingClientRect();
    if (r.right > window.innerWidth - 4) el.style.left = `${Math.max(4, Math.round(window.innerWidth - r.width - 4))}px`;
    if (r.bottom > window.innerHeight - 4) el.style.top = `${Math.max(4, Math.round(window.innerHeight - r.height - 4))}px`;
    const outside = (e: MouseEvent) => { if (!el.contains(e.target as Node)) setMenu(null); };
    document.addEventListener('mousedown', outside, true);
    return () => document.removeEventListener('mousedown', outside, true);
  }, [menu]);
  useEffect(() => { if (connecting) remoteField.current?.focus(); }, [connecting]);
  useEffect(() => { setSel((s) => Math.min(s, Math.max(0, recents.length - 1))); }, [recents.length]);

  // the keys, except while the name field has them
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      // the tweaks are over it: its keys are not the welcome's
      if (useApp.getState().tweaksOpen) return;
      // a menu, or a row that asks: Esc lets it go, and no other key is the list's (⏎ is the focused button's)
      if (menu || asking) {
        if (e.key === 'Escape') { e.preventDefault(); setMenu(null); keep(); }
        return;
      }
      const tag = (e.target as HTMLElement | null)?.tagName?.toLowerCase();
      if (tag === 'input' || tag === 'textarea' || tag === 'select') return;
      // the tree's keys: F2 renames the selected row, ⌘⌫ asks to delete it
      if (e.key === 'F2' && !e.metaKey && !e.ctrlKey && !e.altKey) { e.preventDefault(); beginRename(recents[sel]); return; }
      if (e.key === 'Backspace' && (e.metaKey || e.ctrlKey) && !e.altKey && !e.shiftKey) { e.preventDefault(); askDelete(recents[sel]); return; }
      if (e.metaKey || e.ctrlKey || e.altKey) return;
      if (e.key === 'j' || e.key === 'ArrowDown') { e.preventDefault(); setSel((s) => Math.min(recents.length - 1, s + 1)); }
      else if (e.key === 'k' || e.key === 'ArrowUp') { e.preventDefault(); setSel((s) => Math.max(0, s - 1)); }
      else if (e.key === 'Enter') { const r = recents[sel]; if (r) { e.preventDefault(); open(r.path); } }
      else if (mobile) { if (e.key === 'c') { e.preventDefault(); setConnecting(true); } }
      else if (e.key === 'i') { e.preventDefault(); bring(importVault); }
      else if (e.key === 'n') { e.preventDefault(); nameNewVault(); }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [recents, sel, mobile, menu, asking, gone]);

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

  const kept = useOpenedWaiting();
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
            <button type="button" data-act="scan" disabled={pairing} onClick={scan}>scan a code</button>
          </div>
        ) : (
          <div className="welcome-acts">
            <button type="button" onClick={nameNewVault}>new collection</button>
            <button type="button" disabled={importing} onClick={() => bring(importVault)}>import folder</button>
            {!naming && <span className="welcome-problem">{importing ? 'importing…' : problem ?? ''}</span>}
          </div>
        )}
        {/* a file the system handed over before any collection is open (`opened.ts`) */}
        {kept && <div className="welcome-said" data-kept="1" role="status">{kept}</div>}
        {mobile && !connecting && !joining && (pairing || problem) && (
          <div className="welcome-said">{pairing ? 'connecting…' : problem}</div>
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
            <StorageFields st={storage} locked={joinBusy} mobile signing={signing} set={(p) => { setJoinStorage((was) => ({ ...was, ...p })); setProblem(null); }} onType={(p) => setJoinStorage((was) => ({ ...was, ...p }))} onSignIn={signInHere} onSignOut={signOutHere} />
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
              const why = missing ? undefined : unopened[r.path];
              const no = refused?.path === r.path ? refused.why : undefined;
              const renaming = editing?.path === r.path;
              const ask = asking?.path === r.path ? asking.line : undefined;
              return (
                <div
                  key={r.path}
                  className="palette-row welcome-row"
                  data-sel={i === sel ? '1' : '0'}
                  data-gone={missing ? '1' : '0'}
                  data-ask={ask !== undefined ? '1' : '0'}
                  onMouseEnter={() => { if (!menu && !asking && !editing) setSel(i); }}
                  onClick={() => { if (!renaming && ask === undefined) open(r.path); }}
                  onContextMenu={(e) => {
                    e.preventDefault();
                    if (missing) return;
                    setSel(i);
                    setMenu({ path: r.path, x: e.clientX, y: e.clientY });
                  }}
                >
                  <span className="pg"><Glyph g={ENTRY_GLYPH.vault} /></span>
                  {ask !== undefined ? (
                    <>
                      <span className="welcome-ask">{ask}</span>
                      <button type="button" className="welcome-del" data-act="delete" onClick={(e) => { e.stopPropagation(); remove(r.path); }}>delete</button>
                      <button type="button" className="welcome-keep" data-act="keep" ref={keepButton} onClick={(e) => { e.stopPropagation(); keep(); }}>keep</button>
                    </>
                  ) : (
                    <>
                      {renaming ? (
                        <input
                          ref={renameField}
                          className="welcome-rename"
                          dir="auto"
                          value={editing.value}
                          spellCheck={false}
                          autoCapitalize="off"
                          autoCorrect="off"
                          onChange={(e) => { setEditing({ path: r.path, value: e.target.value }); setRefused(null); }}
                          onMouseDown={(e) => e.stopPropagation()}
                          onClick={(e) => e.stopPropagation()}
                          onBlur={() => commitRename(false)}
                          onKeyDown={(e) => {
                            if (e.key === 'Enter') { e.preventDefault(); commitRename(true); }
                            else if (e.key === 'Escape') { e.preventDefault(); editingNow.current = null; setEditing(null); setRefused(null); }
                            e.stopPropagation();
                          }}
                        />
                      ) : (
                        <span className="pt">{r.name}</span>
                      )}
                      <span className="psub" title={no ?? why}>{no !== undefined ? no : why !== undefined ? `did not open · ${why}` : ''}</span>
                      <span className="ptag">{missing ? GONE : r.opened === NEVER ? '' : openedLabel(r.opened, now)}</span>
                      {missing && (
                        <button type="button" className="welcome-forget" onClick={(e) => { e.stopPropagation(); forgetVault(r.path); }}>forget</button>
                      )}
                      {!missing && !renaming && (
                        <button
                          type="button"
                          className="welcome-more"
                          title="more"
                          aria-label="more"
                          onClick={(e) => {
                            e.stopPropagation();
                            const b = e.currentTarget.getBoundingClientRect();
                            setSel(i);
                            setMenu({ path: r.path, x: b.left, y: b.bottom + 4 });
                          }}
                        >
                          <Icon name="more" />
                        </button>
                      )}
                    </>
                  )}
                </div>
              );
            })}
          </div>
        )}
        <div className="palette-foot">
          {recents.length > 0 && (
            <>
              <span className="hint"><kbd>↵</kbd> <span className="hw">open</span></span>
              <span className="hint"><kbd>j k</kbd> <span className="hw">move</span></span>
            </>
          )}
          {mobile ? <span className="hint"><kbd>c</kbd> <span className="hw">connect</span></span> : (
            <>
              <span className="hint"><kbd>n</kbd> <span className="hw">new collection</span></span>
              <span className="hint"><kbd>i</kbd> <span className="hw">import folder</span></span>
            </>
          )}
        </div>
      </div>
      {menu && (
        <div
          className="ctx-menu"
          role="menu"
          ref={menuEl}
          style={{ left: menu.x, top: menu.y }}
          onMouseDown={(e) => e.stopPropagation()}
          onContextMenu={(e) => { e.preventDefault(); e.stopPropagation(); }}
        >
          <div className="ci" role="menuitem" data-act="rename" onClick={() => beginRename(recents.find((r) => r.path === menu.path))}>
            <span className="cg"><Glyph g="✎" /></span>rename…<span className="ck">F2</span>
          </div>
          <div className="cd" />
          <div className="ci danger" role="menuitem" data-act="delete" onClick={() => askDelete(recents.find((r) => r.path === menu.path))}>
            <span className="cg"><Glyph g="⌫" /></span>delete…<span className="ck">⌘⌫</span>
          </div>
        </div>
      )}
    </main>
  );
}
