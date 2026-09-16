// views.jsx — the outstanding queue + saved queries. Every list is a QUERY over
// the vault (store.query(scope)). The queue interleaves TOPICS (reading) and
// ITEMS (cards) — incremental everything — sorted by priority then due. Entering
// the queue starts a session that walks reading and review in one stream.

function renderClozeBody(parts) {
  return parts.map((p, i) => typeof p === 'string'
    ? <React.Fragment key={i}>{p}</React.Fragment>
    : <span key={i} className="cloze">{p.cloze}</span>);
}
function renderItemBody(item) {
  if (item.el === 'read') return <span className="read-snip">{item.snippet}<span className="read-ell"> …</span></span>;
  if (item.el === 'write') return <span className="read-snip">{item.snippet || 'a blank draft — open it and write'}<span className="read-ell"> …</span></span>;
  if (item.sub === 'cloze' && Array.isArray(item.body)) return renderClozeBody(item.body);
  if (item.sub === 'qa') return <span>{item.body.q}</span>;
  if (item.sub === 'bidir') return (
    <span>{item.body.l} <span style={{ color: 'var(--fg-4)', fontFamily: 'var(--mono)', fontSize: 11 }}>⇄</span> {item.body.r}</span>
  );
  return <span>{item.title || '—'}</span>;
}

const TITLE_MAP = { today: 'due today', upcoming: 'upcoming', reading: 'reading', writing: 'writing', cards: 'all cards' };
const PREDICATE = {
  today: 'due ≤ ' + TODAY, upcoming: 'due > ' + TODAY,
  reading: 'el = topic', writing: 'el = draft', cards: 'el = card',
};
const EMPTY_COPY = {
  today:    'Nothing is due. The day is open — read something, write a little, or carve a card from a passage you liked.',
  upcoming: 'Nothing scheduled ahead. Every element is either due now or freshly made.',
  reading:  'No sources enrolled in incremental reading. Open a source and press r to enroll it.',
  writing:  'No drafts in spaced composition. Make a draft and it resurfaces here until you call it done.',
  cards:    'No cards in the vault yet. Open a source, select a passage, and press m.',
};

function Queue({ onOpen, scope = 'today', active }) {
  const store = useStore();
  const items = store.query(scope);
  const [cursor, setCursor] = React.useState(0);

  React.useEffect(() => { if (cursor > items.length - 1) setCursor(Math.max(0, items.length - 1)); }, [items.length]);

  React.useEffect(() => {
    if (!active) return;
    const onKey = (e) => {
      const tag = (e.target.tagName || '').toLowerCase();
      if (tag === 'input' || tag === 'textarea' || e.metaKey || e.ctrlKey) return;
      const it = items[cursor];
      if (e.key === 'j' || e.key === 'ArrowDown') { e.preventDefault(); setCursor(c => Math.min(items.length - 1, c + 1)); }
      else if (e.key === 'k' || e.key === 'ArrowUp') { e.preventDefault(); setCursor(c => Math.max(0, c - 1)); }
      else if (e.key === 'Enter') { e.preventDefault(); if (items.length) onOpen(items[scope === 'today' ? 0 : cursor], {}); }
      else if (e.key === 'o' && it) { e.preventDefault(); onOpen(it, {}); }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [active, items, cursor, scope]);

  const recent = store.log.slice(0, 2);
  const reading = items.filter(i => i.el === 'read').length;
  const writing = items.filter(i => i.el === 'write').length;
  const cards = items.filter(i => i.el === 'card').length;
  const mins = Math.max(1, Math.round(reading * 1.5 + writing * 2 + cards * 0.25));

  return (
    <div className="queue">
      <header>
        <h1>{TITLE_MAP[scope] || scope}
          <span className="day">{scope === 'today' ? TODAY_LABEL : `${items.length} element${items.length === 1 ? '' : 's'}`}</span>
        </h1>
        <div className="summary">
          {scope === 'today' && <>
            <span><b>{reading}</b> to read</span>
            <span><b>{writing}</b> to write</span>
            <span><b>{cards}</b> to review</span>
          </>}
        </div>

        {scope === 'today' && items.length > 0 && (
          <button type="button" className="enter-queue" onClick={() => onOpen(items[0], {})}>
            <span className="eq-main">enter queue</span>
            <kbd>⏎</kbd>
          </button>
        )}
        {scope === 'today' && recent.length > 0 && (
          <div className="qlog">{recent.map((l, i) => <div key={i} className="qlog-line">{l.label}</div>)}</div>
        )}
      </header>

      {items.length === 0 ? (
        <div className="empty">{EMPTY_COPY[scope] || 'Nothing here.'}</div>
      ) : (
        <ol className="qlist">
          {items.map((item, i) => (
            <li key={item.id} data-active={i === cursor ? '1' : '0'} data-el={item.el}
                data-fresh={item.fresh || (item.sched && item.sched.reps === 0) ? '1' : '0'}
                onMouseEnter={() => setCursor(i)}
                onClick={(e) => onOpen(item, { cmdClick: e.metaKey || e.ctrlKey, shiftClick: e.shiftKey })}>
              <span className="mark" data-el={item.el}>{item.el === 'read' ? '▤' : item.el === 'write' ? '✎' : '◆'}</span>
              <span className="body">
                <span className="src">
                  <span className="kindtag" data-el={item.el}>
                    {item.el === 'read' ? 'read' : item.el === 'write' ? 'write' : item.sub}
                  </span>
                  {item.sourceLabel}
                </span>
                {renderItemBody(item)}
                {item.el === 'read' && item.progress > 0
                  && <span className="ref-line">{item.progress}% read</span>}
                {item.el === 'write' && !item.fresh
                  && <span className="ref-line">pass {(item.sched.reps || 0) + 1}</span>}
              </span>
              <span className="pri"><b>p{item.pri}</b></span>
              <span className="due">
                {item.due}
                {item.interval && item.el === 'card' && <div style={{ color: 'var(--fg-5)', marginTop: 1 }}>{item.interval}</div>}
              </span>
            </li>
          ))}
        </ol>
      )}
    </div>
  );
}

function SavedView({ scope, onOpen, active }) {
  return <Queue scope={scope} onOpen={onOpen} active={active} />;
}

// ── DeckView: a deck of loose cards (no source). Review them, add more. ──
function DeckView({ deckId, active, onOpen }) {
  const store = useStore();
  const deck = findNode(store.vault, deckId);
  const [composer, setComposer] = React.useState(false);

  React.useEffect(() => {
    if (!active) return;
    const onKey = (e) => {
      const tag = (e.target.tagName || '').toLowerCase();
      if (tag === 'input' || tag === 'textarea' || e.metaKey || e.ctrlKey) return;
      if (e.key === 'm' && !composer) { e.preventDefault(); setComposer(true); }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [active, composer, deckId]);

  if (!deck) return <div className="reader-wrap"><div className="reader"><div className="empty">This deck is no longer in the vault.</div></div></div>;
  const cards = (deck.body || []).filter(b => b.kind === 'card');
  const due = cards.filter(c => isDue(c.sched.due)).length;

  return (
    <div className="reader-wrap">
      <div className="reader deck-view">
        <div className="meta">
          <span className="crumb">deck</span>
          <span style={{ marginLeft: 'auto' }}>{cards.length} card{cards.length === 1 ? '' : 's'} · {due} due</span>
        </div>
        <h1>{deck.name}</h1>

        {!composer && (
          <button type="button" className="deck-add" onClick={() => setComposer(true)}>
            <span className="lbl">+ card</span><kbd>m</kbd>
          </button>
        )}
        {composer && (
          <MakeCard seed="" initialType={deck.defaultCard} onClose={() => setComposer(false)}
                    onSave={(card, again) => { store.addCard({ deckId, ...card }); if (!again) setComposer(false); }} />
        )}

        {cards.length === 0 && !composer ? (
          <div className="empty">no cards</div>
        ) : cards.map(card => (
          <CardSpan key={card.id} card={card} onOpen={(spec) => onOpen && onOpen(spec, {})} />
        ))}
      </div>
    </div>
  );
}

// ── FolderView: a folder opened as a lens. The tree IS the model, so a folder
//    is a real container — it can hold any mix of nodes (sources, decks, sub-
//    folders) AND its own loose cards. This view lists the contents, lets you
//    create more of any type, and carves loose cards straight into the folder. ──
function FolderView({ folderId, active, onOpen, focus }) {
  const store = useStore();
  const folder = findNode(store.vault, folderId);
  const [composer, setComposer] = React.useState(focus === 'compose');

  React.useEffect(() => {
    if (!active) return;
    const onKey = (e) => {
      const tag = (e.target.tagName || '').toLowerCase();
      if (tag === 'input' || tag === 'textarea' || e.metaKey || e.ctrlKey) return;
      if (e.key === 'm' && !composer) { e.preventDefault(); setComposer(true); }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [active, composer, folderId]);

  if (!folder) return <div className="reader-wrap"><div className="reader"><div className="empty">This folder is no longer in the vault.</div></div></div>;

  const children = folder.children || [];
  const looseCards = (folder.body || []).filter(b => b.kind === 'card');
  const due = looseCards.filter(c => isDue(c.sched.due)).length;

  const GLYPH = { folder: '/', source: '⊞', deck: '◫', draft: '✎' };
  const childMeta = (n) => {
    if (n.type === 'folder') {
      const items = (n.children || []).length + (n.body || []).filter(b => b.kind === 'card').length;
      return items ? items + ' item' + (items === 1 ? '' : 's') : 'empty';
    }
    if (n.type === 'draft') {
      if (n.write && n.write.done) return 'done';
      const ex = (n.body || []).filter(b => b.kind === 'extract');
      return ex.length ? ex.length + ' extract' + (ex.length === 1 ? '' : 's') : 'draft';
    }
    const cs = (n.body || []).filter(b => b.kind === 'card');
    if (n.type === 'deck') return cs.length + ' card' + (cs.length === 1 ? '' : 's');
    return cs.length ? cs.length + ' card' + (cs.length === 1 ? '' : 's') : 'source';
  };
  const openChild = (n) => onOpen && onOpen({ kind: n.type === 'folder' ? 'folder' : n.type, id: n.id, title: n.name }, {});

  const itemLine = children.length + ' item' + (children.length === 1 ? '' : 's')
    + (looseCards.length ? ' · ' + looseCards.length + ' card' + (looseCards.length === 1 ? '' : 's') + (due ? ' · ' + due + ' due' : '') : '');

  return (
    <div className="reader-wrap">
      <div className="reader folder-view">
        <div className="meta">
          <span className="crumb">folder</span>
          <span style={{ marginLeft: 'auto' }}>{itemLine}</span>
        </div>
        <h1>{folder.name}</h1>

        <div className="fv-new">
          <button type="button" onClick={() => store.createSource(folderId, 'untitled')}>+ source</button>
          <button type="button" onClick={() => store.createDeck(folderId, 'untitled deck')}>+ deck</button>
          <button type="button" onClick={() => store.createDraft(folderId, 'untitled draft')}>+ draft</button>
          <button type="button" onClick={() => store.createFolder(folderId, 'untitled folder')}>+ folder</button>
          <button type="button" onClick={() => setComposer(true)}>+ card</button>
        </div>

        {children.length > 0 && (
          <ul className="fv-contents">
            {children.map(n => (
              <li key={n.id} className="fv-row" onClick={() => openChild(n)}>
                <span className="fv-g" data-t={n.type}>{GLYPH[n.type] || '≡'}</span>
                <span className="fv-name">{n.name}</span>
                <span className="fv-meta">{childMeta(n)}</span>
              </li>
            ))}
          </ul>
        )}

        {composer && (
          <MakeCard seed="" initialType={folder.defaultCard || 'cloze'} onClose={() => setComposer(false)}
                    onSave={(card, again) => { store.addCard({ containerId: folderId, ...card }); if (!again) setComposer(false); }} />
        )}

        {looseCards.length > 0 && (
          <div className="fv-cards">
            <div className="fv-section">loose cards</div>
            {looseCards.map(card => (
              <CardSpan key={card.id} card={card} onOpen={(spec) => onOpen && onOpen(spec, {})} />
            ))}
          </div>
        )}

        {children.length === 0 && looseCards.length === 0 && !composer && (
          <div className="empty">Empty folder.</div>
        )}
      </div>
    </div>
  );
}
