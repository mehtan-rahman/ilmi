// The remote's code on the Mac (milestone 90): a card at the foot, over the
// page, with the QR code of the remote's address, what to do with it, how
// many phones are on, and `stop`. `hide` keeps the remote on; the strip's
// `remote` chip brings the card back.

import { useMemo } from 'react';
import { QR_QUIET, qrMatrix, qrPath } from './pair.js';
import { stopRemote, useRemote } from './remote.js';
import { failed } from './land.js';

const phones = (n: number) => (n === 0 ? 'no phone connected yet' : n === 1 ? '1 phone connected' : `${n} phones connected`);

export function RemotePanel() {
  const url = useRemote((s) => s.url);
  const panel = useRemote((s) => s.panel);
  const clients = useRemote((s) => s.clients);
  const made = useMemo(() => {
    if (!url) return null;
    const m = qrMatrix(url);
    return { side: m.size + 2 * QR_QUIET, d: qrPath(m) };
  }, [url]);
  if (!url || !panel || !made) return null;
  const loopback = url.startsWith('http://127.');
  return (
    <div className="remote-panel" role="dialog" aria-label="phone as a remote">
      <svg className="remote-qr" viewBox={`0 0 ${made.side} ${made.side}`} role="img" aria-label="the remote's code" shapeRendering="crispEdges">
        <rect width={made.side} height={made.side} fill="#fff" />
        <path d={made.d} fill="#000" />
      </svg>
      <div className="remote-words">
        <span className="remote-title">phone as a remote</span>
        <span className="remote-line">
          {loopback
            ? 'this mac is on no network a phone could reach · join a wi-fi network and open this again'
            : 'point the phone\'s camera at the code, or ilmi\'s scan a code on the phone. the phone must be on this wi-fi. the session\'s buttons are on the phone while this is on.'}
        </span>
        <span className="remote-url">{url.replace(/\/[^/]+$/, '/…')}</span>
        <span className="remote-n" data-on={clients > 0 ? '1' : '0'}>{phones(clients)}</span>
        <div className="remote-acts">
          <button type="button" data-act="hide" onClick={() => useRemote.setState({ panel: false })}>hide</button>
          <button type="button" data-act="stop" onClick={() => { void stopRemote().catch(failed('stop the remote')); }}>stop</button>
        </div>
      </div>
    </div>
  );
}

/** In the strip while the remote is on and its card is hidden: the card back. */
export function RemoteChip() {
  const url = useRemote((s) => s.url);
  const panel = useRemote((s) => s.panel);
  const clients = useRemote((s) => s.clients);
  if (!url || panel) return null;
  return (
    <button type="button" className="remote-chip" data-on={clients > 0 ? '1' : '0'} onClick={() => useRemote.setState({ panel: true })}>
      remote{clients > 0 ? ` · ${clients === 1 ? 'phone on' : `${clients} phones`}` : ''}
    </button>
  );
}
