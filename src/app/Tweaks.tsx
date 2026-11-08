// The tweaks panel: theme, accent, density, text size, whether the last
// vault reopens on start, whether a clipped page's images are downloaded,
// whether images from the web are shown, whether the queue names documents
// by title, whether the backlog is postponed when the day starts, the
// day's budget, and where clippings land. ⌘, opens it. The first nine live
// in the webview's storage, not in any vault; the budget and the clippings
// folder are the open vault's, in its `.ilmi/state.json`. Under the sync
// rows, the storage the collection syncs through (a folder, an S3 bucket, a
// WebDAV folder) and what this device keeps of its files (milestone 63).

import { useEffect, useState } from 'react';
import { PluginsSection } from '../plugins/PluginsSection.js';
import { folderPaths, titleOf } from './names.js';
import { ACCENTS, DENSITY_MAX, DENSITY_MIN, THEMES, useApp, type Accent, type Theme, ZOOM_MAX, ZOOM_MIN, ZOOM_STEP } from './store.js';
import { notify } from './land.js';
import { cloneCollection, connect, setNudgeServer, setRemote, syncWord } from './sync.js';
import { chooseMirror, mirrorOff } from './keep.js';
import { connectStorage, joinStorage, setStorage, signInStorage, signOutStorage, storageOff } from './crdt.js';
import { StorageFields, TextField } from './StorageFields.js';
import { keepOf, storageReady } from './storage.js';
import { open as pickDirectory } from '@tauri-apps/plugin-dialog';
import { currentVault, openVault, setBudget, setClipDir } from './vault.js';
import { Glyph } from './icons.js';

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

/**
 * Sync: where the vault stands, its remote and token, and `connect` (this
 * collection becomes a repository on that remote) or `clone…` (the remote
 * as a new collection under its own name, opened). A collection that is a repository with a
 * remote already shows its word and the fields alone. `nudge` is the ntfy
 * server a push is announced over (milestone 54); empty, the timer alone.
 */
function SyncRows() {
  const sync = useApp((s) => s.sync);
  const settings = useApp((s) => s.syncSettings);
  const [busy, setBusy] = useState(false);
  // an iPad's clone is the welcome's `connect`
  const mobile = useApp((s) => s.mobile);
  // a collection that syncs through a storage does not sync by git: the word is the storage's row's
  const stored = useApp((s) => s.storage.on);
  const word = stored ? null : syncWord(sync);
  const fail = (what: string) => (e: unknown) => { notify(`${what} · ${e instanceof Error ? e.message : String(e)}`); };
  const doConnect = () => {
    setBusy(true);
    connect(settings.url, settings.token).catch(fail('connect')).finally(() => setBusy(false));
  };
  const doClone = async () => {
    setBusy(true);
    try {
      const dest = await cloneCollection(settings.url, settings.token);
      useApp.setState({ tweaksOpen: false });
      await openVault(dest);
    } catch (e) {
      fail('clone')(e);
    } finally {
      setBusy(false);
    }
  };
  return (
    <>
      <div className="tw-row">
        <span className="tw-lbl">sync <span className="tw-val">{word ?? 'off'}</span></span>
        {(!sync.on || stored) && (
          <div className="tw-seg">
            <button type="button" disabled={busy || stored || !settings.url.trim()} onClick={doConnect}>connect</button>
            {!mobile && <button type="button" disabled={busy || !settings.url.trim()} onClick={() => void doClone()}>clone…</button>}
          </div>
        )}
      </div>
      <div className="tw-row">
        <span className="tw-lbl">remote</span>
        <TextField value={settings.url} onCommit={(url) => void setRemote(url, settings.token).catch(fail('remote'))} />
      </div>
      <div className="tw-row">
        <span className="tw-lbl">token</span>
        <TextField value={settings.token} type="password" onCommit={(token) => void setRemote(settings.url, token).catch(fail('token'))} />
      </div>
      <div className="tw-row">
        <span className="tw-lbl">nudge</span>
        <TextField value={settings.server} onCommit={(server) => setNudgeServer(server)} />
      </div>
    </>
  );
}

/**
 * Storage (milestone 63): where the collection's changes and files are
 * kept for its other devices. The kind, the fields that kind needs,
 * `connect` (this collection syncs through it from now on: an empty
 * storage takes it) or `join…` (what the storage holds as a new
 * collection, opened), and `off`. Dropbox and Google Drive (milestone 64)
 * are signed in to, in the browser, before either. Then what this device keeps of the
 * PDFs and images: every one, or the ones it has opened. The fields are
 * kept with the tweaks, as sync's remote and token are.
 */
function StorageRows() {
  const st = useApp((s) => s.storage);
  const sync = useApp((s) => s.sync);
  const mobile = useApp((s) => s.mobile);
  const [busy, setBusy] = useState(false);
  const [signing, setSigning] = useState(false);
  const fail = (what: string) => (e: unknown) => { notify(`${what} · ${e instanceof Error ? e.message : String(e)}`); };
  const ready = storageReady(st);
  const locked = st.on || busy;
  const doConnect = () => {
    setBusy(true);
    connectStorage().catch(fail('storage')).finally(() => setBusy(false));
  };
  const doJoin = async () => {
    setBusy(true);
    try {
      const dest = await joinStorage();
      useApp.setState({ tweaksOpen: false });
      await openVault(dest);
    } catch (e) {
      fail('storage')(e);
    } finally {
      setBusy(false);
    }
  };
  const choose = async () => {
    const dir = await pickDirectory({ directory: true, recursive: true, multiple: false });
    if (dir) setStorage({ folder: dir });
  };
  // a second press starts again: the browser may have been closed
  const doSignIn = () => {
    setSigning(true);
    signInStorage().catch(fail('storage')).finally(() => setSigning(false));
  };
  const keep = keepOf(st);
  return (
    <>
      <StorageFields st={st} word={st.on ? (syncWord(sync) ?? 'off') : 'off'} locked={locked} mobile={mobile} signing={signing} set={setStorage} onChoose={() => void choose()} onSignIn={doSignIn} onSignOut={() => { signOutStorage().catch(fail('storage')); }} />
      <div className="tw-row">
        <div className="tw-seg">
          {st.on
            ? <button type="button" disabled={busy} onClick={() => { setBusy(true); storageOff().catch(fail('storage')).finally(() => setBusy(false)); }}>off</button>
            : (
              <>
                <button type="button" disabled={busy || !ready} onClick={doConnect}>connect</button>
                <button type="button" disabled={busy || !ready} onClick={() => void doJoin()}>join…</button>
              </>
            )}
        </div>
      </div>
      <div className="tw-row">
        <span className="tw-lbl">keep files</span>
        <div className="tw-seg">
          <button type="button" data-active={keep === 'all' ? '1' : '0'} onClick={() => setStorage({ keep: 'all' })}>all</button>
          <button type="button" data-active={keep === 'opened' ? '1' : '0'} onClick={() => setStorage({ keep: 'opened' })}>opened</button>
        </div>
      </div>
    </>
  );
}

/**
 * Mirror: a folder kept as the collection is, one way, for other tools to
 * read (`keep.ts`). Off by default; `choose…` asks for a folder and the
 * mirror is a folder of the collection's name inside it.
 */
function MirrorRow() {
  const mirror = useApp((s) => s.mirror);
  const [busy, setBusy] = useState(false);
  const choose = () => {
    const vault = currentVault();
    if (!vault) return;
    setBusy(true);
    chooseMirror(vault).catch((e: unknown) => notify(`mirror · ${e instanceof Error ? e.message : String(e)}`)).finally(() => setBusy(false));
  };
  return (
    <div className="tw-row">
      <span className="tw-lbl">mirror <span className="tw-val" title={mirror || undefined}>{mirror ? mirror.slice(mirror.lastIndexOf('/', mirror.lastIndexOf('/') - 1) + 1) : 'off'}</span></span>
      <div className="tw-seg">
        <button type="button" disabled={busy} onClick={choose}>choose…</button>
        {mirror && <button type="button" disabled={busy} onClick={() => { const vault = currentVault(); if (vault) mirrorOff(vault); }}>off</button>}
      </div>
    </div>
  );
}

export function Tweaks() {
  const theme = useApp((s) => s.theme);
  const accent = useApp((s) => s.accent);
  const density = useApp((s) => s.density);
  const zoom = useApp((s) => s.zoom);
  const reopen = useApp((s) => s.reopen);
  const clipImages = useApp((s) => s.clipImages);
  const remoteImages = useApp((s) => s.remoteImages);
  const queueTitles = useApp((s) => s.queueTitles);
  const backlog = useApp((s) => s.backlog);
  const vault = useApp((s) => s.vault);
  const budget = useApp((s) => s.budget);
  const clipDir = useApp((s) => s.clipDir);
  const mobile = useApp((s) => s.mobile);
  const close = () => useApp.setState({ tweaksOpen: false });

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') { e.preventDefault(); close(); } };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);

  return (
    <div className="tweaks tw-rows">
      <div className="tw-hd">
        <span>tweaks</span>
        <button type="button" className="tw-x" onClick={close}><Glyph g="×" /></button>
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
        <span className="tw-lbl">text size <span className="tw-val">{Math.round(zoom * 100)}%</span></span>
        <input
          type="range"
          className="tw-slider"
          min={ZOOM_MIN}
          max={ZOOM_MAX}
          step={ZOOM_STEP}
          value={zoom}
          onChange={(e) => useApp.getState().setZoom(Number(e.target.value))}
          title="⌘= bigger, ⌘− smaller, ⌘0 back to 100%"
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
      <div className="tw-row">
        <span className="tw-lbl">postpone the backlog when the day starts</span>
        <div className="tw-seg">
          <button type="button" data-active={backlog ? '1' : '0'} onClick={() => useApp.getState().setBacklog(true)}>on</button>
          <button type="button" data-active={backlog ? '0' : '1'} onClick={() => useApp.getState().setBacklog(false)}>off</button>
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
      {vault !== null && !mobile && <MirrorRow />}
      {vault !== null && <SyncRows />}
      {vault !== null && <StorageRows />}
      {vault !== null && <PluginsSection />}
    </div>
  );
}
