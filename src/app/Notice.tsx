// The one notice over the canvas: what just landed and where, with `undo`
// (what it wrote goes) and `open`. It goes on its own after a while, or
// when the next one comes. `src/app/land.ts` holds the undo.

import { useEffect } from 'react';
import { dismissNotice, undoNotice } from './land.js';
import { useApp } from './store.js';
import { openNode } from './vault.js';

/** How long a notice stays, unless the pointer is on it. */
const NOTICE_MS = 12000;

export function Notice() {
  const n = useApp((s) => s.notice);
  useEffect(() => {
    if (!n) return;
    const t = setTimeout(() => dismissNotice(n.seq), NOTICE_MS);
    return () => clearTimeout(t);
  }, [n?.seq]);
  if (!n) return null;
  const open = n.open;
  return (
    <div className="notice" role="status" data-seq={n.seq}>
      <span className="nl">{n.line}</span>
      {n.undo && <button type="button" className="na" onClick={() => void undoNotice().catch(console.error)}>undo</button>}
      {open !== null && <button type="button" className="na" onClick={() => { openNode(open); dismissNotice(n.seq); }}>open</button>}
      <button type="button" className="na nx" aria-label="dismiss" onClick={() => dismissNotice(n.seq)}>×</button>
    </div>
  );
}
