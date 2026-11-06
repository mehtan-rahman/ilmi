// The bottom strip: the keys that work on the surface in the active pane,
// and nothing else. After the prototype's BottomStrip.

import { Fragment } from 'react';
import { hintsFor } from './chrome.js';
import { queueScope, tabKindOf } from './names.js';
import { activeTab } from './panes.js';
import { useApp } from './store.js';
import { notebookOf } from './tabs.js';

export function BottomStrip() {
  const panes = useApp((s) => s.panes);
  const docs = useApp((s) => s.docs);
  const sessionEl = useApp((s) => s.sessionEl);
  const notesHidden = useApp((s) => s.notesHidden);
  const id = activeTab(panes)?.id;
  const kind = id === undefined ? undefined : tabKindOf(id, docs);
  // the session's element is in a document of its own
  const info = id === undefined ? undefined : kind === 'session' && sessionEl ? docs[sessionEl.item.path] : docs[id];
  const mobile = useApp((s) => s.mobile);
  const base = hintsFor({
    kind,
    el: kind === 'session' ? sessionEl?.kind ?? 'card' : null,
    scope: id === undefined ? null : queueScope(id),
    canEnrol: kind !== 'session' && !!info && (info.type === 'note' || info.type === 'source' || info.type === 'extract') && !info.read,
    pages: !!info?.pdf,
    notesHidden,
    frozen: !!info?.frozen,
    note: info?.type === 'note' || (kind === 'session' && info?.type === 'extract'),
    marks: info?.type === 'source' && !info.pdf,
    touch: mobile,
  });
  // a notebook's page: the step keys, ahead of the page's own
  const all = id !== undefined && notebookOf(id, docs) ? [['⌘⌥↑↓', 'tabs'] as const, ...base] : base;
  // an iPad is one pane: ⌘\ splits nothing there
  const hints = mobile ? all.filter(([, what]) => what !== 'split pane') : all;
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
