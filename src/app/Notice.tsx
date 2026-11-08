// The one notice over the canvas: what just landed and where, with `undo`
// (what it wrote goes) and `open`. It goes on its own after a while, when
// the next one comes, or when the tab it came up on changes (a notice is
// about the document in front of you; it must not outlive it and cover the
// next one's session bar). `src/app/land.ts` holds the undo.

import { useEffect, useRef } from 'react';
import { dismissNotice, undoNotice } from './land.js';
import { activeTab } from './panes.js';
import { useApp } from './store.js';
import { openNode } from './vault.js';
import { Glyph } from './icons.js';

/** How long a notice stays, unless the pointer is on it. */
const NOTICE_MS = 12000;

export function Notice() {
  const n = useApp((s) => s.notice);
  const tab = useApp((s) => activeTab(s.panes)?.id ?? '');
  const inSession = useApp((s) => s.sessionEl !== null);
  // the tab the notice came up on; a different one closes it
  const on = useRef<{ seq: number; tab: string } | null>(null);
  useEffect(() => {
    if (!n) { on.current = null; return; }
    if (on.current?.seq !== n.seq) { on.current = { seq: n.seq, tab }; return; }
    if (on.current.tab !== tab) dismissNotice(n.seq);
  }, [n?.seq, tab]);
  useEffect(() => {
    if (!n) return;
    const t = setTimeout(() => dismissNotice(n.seq), NOTICE_MS);
    return () => clearTimeout(t);
  }, [n?.seq]);
  if (!n) return null;
  const open = n.open;
  return (
    <div className="notice" role="status" data-seq={n.seq} data-session={inSession ? '1' : '0'}>
      <span className="nl">{n.line}</span>
      {n.undo && <button type="button" className="na" onClick={() => void undoNotice().catch(console.error)}>undo</button>}
      {open !== null && <button type="button" className="na" onClick={() => { openNode(open); dismissNotice(n.seq); }}>open</button>}
      <button type="button" className="na nx" aria-label="dismiss" onClick={() => dismissNotice(n.seq)}><Glyph g="×" /></button>
    </div>
  );
}
