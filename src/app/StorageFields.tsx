// A storage's rows, as Tweaks shows them for the open collection and the
// welcome of an iPad or a phone for one to join (milestone 71): which kind,
// that kind's fields, and the account of one that is signed in to. Whose
// settings they are, and what is done with them, are the caller's.

import { useEffect, useState } from 'react';
import { KIND_WORD, clientOf, icloudFolder, kindsHere, signsIn, type StorageSettings } from './storage.js';

/** A text field that commits on blur or ⏎; escape restores. */
export function TextField({ value, type = 'text', disabled = false, onCommit }: { value: string; type?: 'text' | 'password'; disabled?: boolean; onCommit: (v: string) => void }) {
  const [text, setText] = useState(value);
  useEffect(() => { setText(value); }, [value]);
  const commit = () => { if (text !== value) onCommit(text); };
  return (
    <input
      className="tw-text"
      type={type}
      spellCheck={false}
      autoCapitalize="off"
      autoCorrect="off"
      disabled={disabled}
      value={text}
      onChange={(e) => setText(e.target.value)}
      onBlur={commit}
      onKeyDown={(e) => {
        if (e.key === 'Enter') { e.preventDefault(); commit(); e.currentTarget.blur(); }
        else if (e.key === 'Escape') { e.preventDefault(); setText(value); e.currentTarget.blur(); }
        e.stopPropagation();
      }}
    />
  );
}

type Key = 'endpoint' | 'bucket' | 'key' | 'secret' | 'address' | 'user' | 'password' | 'appKey' | 'clientId' | 'clientSecret' | 'place';

export function StorageFields({ st, word, locked, mobile, signing, set, onChoose, onSignIn, onSignOut }: {
  st: StorageSettings;
  /** Where the storage stands, beside its label. */
  word?: string;
  locked: boolean;
  mobile: boolean;
  signing: boolean;
  set(p: Partial<StorageSettings>): void;
  onChoose?(): void;
  onSignIn(): void;
  onSignOut(): void;
}) {
  const [icloud, setIcloud] = useState(false);
  useEffect(() => { void icloudFolder().then((at) => setIcloud(at !== null)); }, []);
  const field = (label: string, key: Key, secret = false) => (
    <div className="tw-row" key={key}>
      <span className="tw-lbl">{label}</span>
      <TextField value={st[key]} type={secret ? 'password' : 'text'} disabled={locked} onCommit={(v) => set({ [key]: v })} />
    </div>
  );
  return (
    <>
      <div className="tw-row">
        <span className="tw-lbl">storage {word !== undefined && <span className="tw-val">{word}</span>}</span>
        <div className="tw-seg wrap">
          {kindsHere(mobile, icloud).map((k) => (
            <button key={k} type="button" data-active={st.kind === k ? '1' : '0'} disabled={locked} onClick={() => set({ kind: k })}>{KIND_WORD[k] ?? k}</button>
          ))}
        </div>
      </div>
      {st.kind === 'folder' && (
        <div className="tw-row">
          <span className="tw-lbl">folder <span className="tw-val" title={st.folder || undefined}>{st.folder ? st.folder.slice(st.folder.lastIndexOf('/', st.folder.lastIndexOf('/') - 1) + 1) : ''}</span></span>
          <div className="tw-seg">
            <button type="button" disabled={locked} onClick={onChoose}>choose…</button>
          </div>
        </div>
      )}
      {st.kind === 's3' && [field('endpoint', 'endpoint'), field('bucket', 'bucket'), field('key', 'key'), field('secret', 'secret', true)]}
      {st.kind === 'webdav' && [field('address', 'address'), field('user', 'user'), field('password', 'password', true)]}
      {st.kind === 'dropbox' && [field('app key', 'appKey'), field('folder', 'place')]}
      {st.kind === 'drive' && [field('client id', 'clientId'), field('client secret', 'clientSecret', true), field('folder', 'place')]}
      {st.kind === 'icloud' && field('folder', 'place')}
      {signsIn(st.kind) && (
        <div className="tw-row">
          <span className="tw-lbl">account <span className="tw-val">{signing ? 'waiting' : st.account ? 'signed in' : ''}</span></span>
          <div className="tw-seg">
            <button type="button" disabled={clientOf(st) === ''} onClick={onSignIn}>sign in</button>
            {st.account !== '' && <button type="button" disabled={signing} onClick={onSignOut}>sign out</button>}
          </div>
        </div>
      )}
    </>
  );
}
