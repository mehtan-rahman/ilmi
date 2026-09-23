// The bottom strip: the keys that work on the surface in the active pane,
// and nothing else. After the prototype's BottomStrip.

import { Fragment } from 'react';
import { hintsFor } from './chrome.js';
import { queueScope, tabKindOf } from './names.js';
import { activeTab } from './panes.js';
import { useApp } from './store.js';

export function BottomStrip() {
  const panes = useApp((s) => s.panes);
  const docs = useApp((s) => s.docs);
  const sessionEl = useApp((s) => s.sessionEl);
  const id = activeTab(panes)?.id;
  const kind = id === undefined ? undefined : tabKindOf(id, docs);
  const info = id === undefined ? undefined : docs[id];
  const hints = hintsFor({
    kind,
    el: kind === 'session' ? sessionEl?.kind ?? 'card' : null,
    scope: id === undefined ? null : queueScope(id),
    canEnrol: !!info && (info.type === 'source' || info.type === 'extract') && !info.read,
  });
  return (
    <div className="bot">
      {hints.map(([keys, what], i) => (
        <Fragment key={keys}>
          <span><kbd>{keys}</kbd> {what}</span>
          {i < hints.length - 1 && <span className="dot" />}
        </Fragment>
      ))}
      <span className="grow" />
    </div>
  );
}
