// draft.jsx — incremental writing. A DRAFT is your own document enrolled in
// spaced composition: it resurfaces in the queue (never graded) until you mark
// it done. It uses the same DocEditor as everything else (see reader.jsx); the
// only thing reading adds on top is the left-margin marker.
//
//  · DraftView — a draft opened as a full lens

// a draft opened as a full lens — write freely, mark it done when you're finished
function DraftView({ draftId, active, onOpen, focus }) {
  const store = useStore();
  const draft = findNode(store.vault, draftId);

  if (!draft) return <div className="reader-wrap"><div className="reader"><div className="empty">This draft is no longer in the vault.</div></div></div>;

  const r = draft.write || {};
  const words = writableWords(draft);
  const cards = (draft.body || []).filter(b => b.kind === 'card');
  const due = cards.filter(c => isDue(c.sched.due)).length;
  const state = r.done ? 'done' : (r.reps ? 'pass ' + (r.reps + 1) : 'first pass') + (r.due ? ', ' + dueLabel(r.due) : '');

  return (
    <div className="reader-wrap">
      <div className="reader draft-view">
        <div className="meta">
          <span className="crumb">draft</span>
          <span style={{ marginLeft: 'auto' }}>{words} words{cards.length ? `, ${cards.length} cards, ${due} due` : ''}</span>
        </div>
        <h1>{draft.name}</h1>

        <div className="draft-sched" data-done={r.done ? '1' : '0'}>
          <span className="ds-state">{state}</span>
          <button type="button" className="ds-toggle" onClick={() => store.writeAdvance(draftId, r.done ? 'next' : 'done')}>
            {r.done ? 'reopen' : 'done'}
          </button>
        </div>

        <DocEditor nodeId={draftId} editable={true} onOpen={onOpen} focus={focus} active={active} canCard={true} />
      </div>
    </div>
  );
}
