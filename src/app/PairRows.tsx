// Pairing in the settings (milestone 84; `pair.ts`). Beside a collection's
// sync, `pair a device` shows a QR code that holds what a new device needs
// to join it (`PairCode`); it is made when the panel opens, drawn here from
// squares, and gone when the panel closes. Where a collection does not sync
// yet, `pairing code` takes one: an iPhone or an iPad scans it, a Mac is
// given its text (`PairField`); either way the rows below are filled as if
// typed, and `connect`, `clone…` or `join…` is still the user's to press.

import { useMemo, useState } from 'react';
import { notify } from './land.js';
import { QR_QUIET, decodePairing, encodePairing, fillFromPairing, pairingOf, qrMatrix, qrPath, type Pairing } from './pair.js';
import { scanCode } from './scan.js';
import { useApp } from './store.js';

const said = (e: unknown): string => (e instanceof Error ? e.message : String(e));

/** What of a code must not be passed on: the word its kind has for it. None for a folder, which holds no secret. */
export function secretWord(kind: Pairing['kind']): string | null {
  return kind === 'git' ? 'access token' : kind === 's3' ? 'secret' : kind === 'webdav' ? 'password' : kind === 'dropbox' ? 'app key' : kind === 'drive' ? 'client secret' : null;
}

/** The line under the code: what to do with it, and why not to pass it on. */
export function pairLine(kind: Pairing['kind']): string {
  const word = secretWord(kind);
  const signs = kind === 'dropbox' || kind === 'drive' ? ' the other device signs in for itself.' : '';
  return `scan this with ilmi on the other device: scan a code, on its first screen.${signs} ${word ? `the code holds the ${word}, so do not share or photograph it.` : 'the code says where this collection is kept, so do not share it.'}`;
}

/**
 * The code for the open collection as it syncs now, drawn: black squares on
 * white in any theme (a camera reads it), with the margin a reader wants.
 * Nothing of it outlives this component.
 */
export function PairCode() {
  const vault = useApp((s) => s.vault);
  const git = useApp((s) => s.sync.on);
  const storage = useApp((s) => s.storage);
  const settings = useApp((s) => s.syncSettings);
  const mobile = useApp((s) => s.mobile);
  const made = useMemo(() => {
    const p = vault ? pairingOf(vault, { git }) : null;
    if (!p) return null;
    const code = encodePairing(p);
    const m = qrMatrix(code);
    return { kind: p.kind, code, side: m.size + 2 * QR_QUIET, d: qrPath(m) };
    // made again when what it holds changes
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [vault, git, storage, settings]);
  if (!made) return null;
  const copy = () => {
    void navigator.clipboard.writeText(made.code).then(
      () => notify('copied · paste it under pairing code in the other mac\'s settings'),
      () => notify('copy failed'),
    );
  };
  return (
    <div className="tw-pair" data-kind={made.kind}>
      <svg className="pair-qr" viewBox={`0 0 ${made.side} ${made.side}`} role="img" aria-label="pairing code" shapeRendering="crispEdges">
        <rect width={made.side} height={made.side} fill="#fff" />
        <path d={made.d} fill="#000" />
      </svg>
      <div className="pair-words">
        <span className="pair-line">{pairLine(made.kind)}</span>
        {!mobile && (
          <div className="tw-seg">
            <button type="button" data-act="pair-copy" onClick={copy}>copy as text</button>
          </div>
        )}
      </div>
    </div>
  );
}

/** `pair a device`, pressed again `hide code`: the button beside a sync that is on. */
export function PairButton({ open, onToggle }: { open: boolean; onToggle(): void }) {
  return <button type="button" data-act="pair" data-active={open ? '1' : '0'} onClick={onToggle}>{open ? 'hide code' : 'pair a device'}</button>;
}

/**
 * `pairing code`, where the open collection does not sync yet: `scan a
 * code` on an iPhone or an iPad, a field to paste into on a Mac. The code
 * fills the remote and token, or the storage's rows.
 */
export function PairField() {
  const mobile = useApp((s) => s.mobile);
  const [text, setText] = useState('');
  const [busy, setBusy] = useState(false);
  const take = async (code: string) => {
    try {
      notify(await fillFromPairing(decodePairing(code), mobile));
    } catch (e) {
      notify(said(e));
    }
  };
  const scan = () => {
    setBusy(true);
    scanCode().then((code) => (code === null ? undefined : take(code)), (e: unknown) => notify(said(e))).finally(() => setBusy(false));
  };
  // a paste is the whole code at once: it is taken as it lands and the field emptied; anything else waits for ⏎
  const typed = (v: string) => {
    let whole = false;
    try { decodePairing(v); whole = true; } catch { /* not yet a code */ }
    if (whole) { setText(''); void take(v); } else setText(v);
  };
  return (
    <div className="tw-row" data-tw="pair-code">
      <span className="tw-lbl">pairing code</span>
      {mobile ? (
        <div className="tw-seg">
          <button type="button" data-act="scan" disabled={busy} onClick={scan}>scan a code</button>
        </div>
      ) : (
        <input
          // not `tw-text`: the first of those in the settings is the remote's, and is looked for as such
          className="tw-code"
          type="password"
          placeholder="paste a code from another device"
          spellCheck={false}
          autoCapitalize="off"
          autoCorrect="off"
          autoComplete="off"
          value={text}
          onChange={(e) => typed(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter') { e.preventDefault(); const v = text; setText(''); if (v.trim()) void take(v); }
            else if (e.key === 'Escape') { e.preventDefault(); setText(''); e.currentTarget.blur(); }
            e.stopPropagation();
          }}
        />
      )}
    </div>
  );
}
