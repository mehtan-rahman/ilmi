// chrome.jsx — workbench shell parts: TopStrip, BottomStrip, Sidebar, Inspector,
// TabBar, Spark. Presentational; App owns pane state. The Sidebar now hosts the
// fully-editable WorkspaceTree (tree.jsx) and a set of SAVED QUERIES; the
// Inspector reads whatever node the active tab points at, straight from the vault.

function TopStrip({ onPalette, inspOpen, onToggleInsp }) {
  const store = useStore();
  let sources = 0; walk(store.vault, (n) => { if (n.type === 'source') sources++; });
  const c = store.counts;
  return (
    <div className="top">
      <div className="ws">
        <b>vault</b> <span style={{ color: 'var(--fg-5)' }}>·</span>{' '}
        <span style={{ color: 'var(--fg-4)' }}>{sources} sources · {c.cards} cards · {c.today} due</span>
      </div>
      <button type="button" className="palette" onClick={onPalette}>
        <span style={{ color: 'var(--fg-5)' }}>⌕</span>
        <span className="ph">open source, card, or query…</span>
        <kbd>⌘ k</kbd>
      </button>
      <div className="right">
        <span>{TODAY}</span>
      </div>
      <button type="button" className="insp-toggle" data-on={inspOpen ? '1' : '0'}
              onClick={onToggleInsp} title="inspector"
              aria-pressed={inspOpen}>
        <span className="panel-ico" />
      </button>
    </div>
  );
}

function BottomStrip({ activeKind }) {
  const HINTS = {
    queue: [['⏎', 'enter queue'], ['j k', 'navigate'], ['o', 'open one'], ['p', 'postpone'], ['x', 'done'], ['⌘k', 'palette']],
    source: [['m', 'card'], ['⌘\\', 'split pane']],
    card: [['space', 'reveal'], ['1 2 3 4', 'grade'], ['[ ]', 'prev / next']],
    read: [['⏎', 'read on'], ['p', 'postpone'], ['d', 'done'], ['e', 'extract'], ['m', 'card']],
    write: [['⏎', 'worked on it'], ['p', 'postpone'], ['d', 'done'], ['m', 'card']],
    draft: [['m', 'card'], ['esc', 'leave the text']],
    view: [['⏎', 'open'], ['j k', 'navigate'], ['/', 'filter']],
    intake: [['⌘v', 'paste']],
  };
  const hints = HINTS[activeKind] || HINTS.queue;
  return (
    <div className="bot">
      {hints.map((h, i) => (
        <React.Fragment key={i}>
          <span><kbd>{h[0]}</kbd> {h[1]}</span>
          {i < hints.length - 1 && <span className="dot" />}
        </React.Fragment>
      ))}
      <span className="grow" />
    </div>
  );
}

// ── Sidebar: editable tree + saved queries ──────────────────────
function Sidebar({ activeKey, onOpen }) {
  const store = useStore();
  const c = store.counts;
  const view = (kind, id, label, n) => (
    <div className="row" data-active={activeKey === `${kind}:${id}` ? '1' : '0'}
         onClick={(e) => onOpen({ kind, id, title: label }, { newTab: !(e.metaKey || e.ctrlKey), cmdClick: e.metaKey || e.ctrlKey, shiftClick: e.shiftKey })}>
      <span className="chev"> </span><span className="glyph">≡</span>
      <span className="name">{label}</span><span className="meta">{n}</span>
    </div>
  );
  return (
    <div className="side">
      <h6>workspace</h6>
      <WorkspaceTree activeKey={activeKey} onOpen={onOpen} />

      <h6>saved queries</h6>
      <div className="tree">
        {view('queue', 'today', 'due today', c.today)}
        {view('queue', 'upcoming', 'upcoming', c.upcoming)}
        {view('view', 'reading', 'reading', c.reading)}
        {view('view', 'writing', 'writing', c.writing)}
        {view('view', 'cards', 'all cards', c.cards)}
      </div>

    </div>
  );
}

// ── TabBar ──────────────────────────────────────────────────────
function TabBar({ pane, paneIdx, isActive, onSelect, onClose, onSplit, onClosePane, canClosePane }) {
  return (
    <div className="tabbar">
      {pane.tabs.map((tab, ti) => {
        const glyph = tab.kind === 'source' ? '¶'
                    : tab.kind === 'card' ? '◆'
                    : tab.kind === 'deck' ? '◫'
                    : tab.kind === 'folder' ? '/'
                    : tab.kind === 'draft' ? '✎'
                    : tab.kind === 'intake' ? '＋'
                    : '≡';
        return (
          <div key={tab.key} className="tab"
               data-active={ti === pane.activeIdx ? '1' : '0'} data-t={tab.kind}
               onClick={() => onSelect(paneIdx, ti)}>
            <span className="glyph" data-t={tab.kind}>{glyph}</span>
            <span className="title">{tab.title}</span>
            <span className="close" onClick={(e) => { e.stopPropagation(); onClose(paneIdx, ti); }}>×</span>
          </div>
        );
      })}
      <div className="spacer" />
      <div className="ctl" title="Split right" onClick={() => onSplit(paneIdx)}>⊟</div>
      {canClosePane && <div className="ctl" title="Close pane" onClick={() => onClosePane(paneIdx)}>×</div>}
    </div>
  );
}

function Spark({ data }) {
  const W = 240, H = 36, PAD = 2;
  const xs = data.map((_, i) => PAD + (i * (W - 2 * PAD)) / (data.length - 1));
  const ys = data.map(v => H - PAD - v * (H - 2 * PAD));
  const path = xs.map((x, i) => `${i === 0 ? 'M' : 'L'} ${x.toFixed(1)} ${ys[i].toFixed(1)}`).join(' ');
  const fill = path + ` L ${xs[xs.length - 1].toFixed(1)} ${H - PAD} L ${xs[0].toFixed(1)} ${H - PAD} Z`;
  return (
    <svg className="spark" viewBox={`0 0 ${W} ${H}`} preserveAspectRatio="none">
      <path d={fill} fill="currentColor" opacity="0.15" />
      <path d={path} fill="none" stroke="currentColor" strokeWidth="1" />
      <line x1={PAD} y1={H - PAD - 0.9 * (H - 2 * PAD)} x2={W - PAD}
            y2={H - PAD - 0.9 * (H - 2 * PAD)} stroke="currentColor" strokeDasharray="2 3" opacity="0.3" />
    </svg>
  );
}

const RETAIN = [0.86,0.88,0.84,0.89,0.91,0.90,0.92,0.88,0.91,0.93,0.92,0.91,0.92,0.94,0.92,0.91,0.93,0.93,0.92,0.91,0.94,0.93,0.92,0.93,0.91,0.92,0.93,0.92,0.91,0.91];

// ── CardEditor — live, in-place editing of a card's content (shown in the
//    inspector while the card is under review). A card IS a block in its
// ── Inspector — adapts to the active node, read from the vault ──
function Inspector({ activeTab }) {
  const store = useStore();
  const kind = activeTab && activeTab.kind;

  if (kind === 'intake') {
    return (
      <div className="insp">
        <div className="block">
          <h6>intake</h6>
          <dl className="kv">
            <dt>becomes</dt><dd>a file in the tree</dd>
            <dt>cards</dt><dd>0</dd>
            <dt>due</dt><dd>nothing, until you annotate</dd>
          </dl>
        </div>
        <div className="block">
          <h6>accepts</h6>
          <dl className="kv">
            <dt>paste</dt><dd>⌘V into the field</dd>
            <dt>drop</dt><dd>.txt · .md · text</dd>
          </dl>
        </div>
      </div>
    );
  }

  if (kind === 'source') {
    const src = findNode(store.vault, activeTab.id);
    if (!src) return <div className="insp"><div className="block"><h6>source</h6><p className="insp-prose">no longer in the vault.</p></div></div>;
    const cards = (src.body || []).filter(b => b.kind === 'card');
    const due = cards.filter(card => isDue(card.sched.due));
    const extracts = (src.children || []).filter(c => c.type === 'source' && c.extract);
    const parent = src.extract ? findParent(store.vault, src.id) : null;
    return (
      <div className="insp">
        <div className="block">
          <h6>{src.extract ? 'extract' : 'source'}</h6>
          <dl className="kv">
            {src.extract && parent ? <React.Fragment><dt>of</dt><dd>{parent.name}</dd></React.Fragment> : null}
            <dt>path</dt><dd style={{ fontFamily: 'var(--mono)', fontSize: 10.5 }}>{src.meta ? src.meta.path : src.name + '.md'}</dd>
            <dt>imported</dt><dd>{src.meta ? src.meta.imported : '—'}</dd>
            <dt>length</dt><dd>{((src.meta && src.meta.words) || 0).toLocaleString()} words</dd>
            <dt>cards</dt><dd>{cards.length} · {due.length} due</dd>
          </dl>
          <div className="frozen-row">
            <span className="fr-state">{src.frozen ? 'frozen' : 'editable'}</span>
            <button type="button" className="fr-toggle" onClick={() => store.toggleFrozen(src.id)}>{src.frozen ? 'thaw' : 'freeze'}</button>
          </div>
        </div>
        {extracts.length > 0 && (
          <div className="block">
            <h6>extracts</h6>
            <ul className="insp-cards">
              {extracts.map(ex => (
                <li key={ex.id} data-due={ex.read && isDue(ex.read.due) ? '1' : '0'}>
                  <span className="cl-t">{ex.name}</span>
                  <span className="cl-due">{ex.read ? dueLabel(ex.read.due) : '—'}</span>
                </li>
              ))}
            </ul>
          </div>
        )}
        <div className="block">
          <h6>cards</h6>
          {cards.length === 0
            ? null
            : <ul className="insp-cards">
                {cards.map(card => (
                  <li key={card.id} data-due={isDue(card.sched.due) ? '1' : '0'}>
                    <span className="cl-t">{cardLabel(card)}</span>
                    <span className="cl-due">{dueLabel(card.sched.due)}</span>
                  </li>
                ))}
              </ul>}
        </div>
      </div>
    );
  }

  if (kind === 'card') {
    const fc = findCard(store.vault, activeTab.id);
    if (!fc) {
      const asSrc = findNode(store.vault, activeTab.id);
      if (asSrc && asSrc.type === 'source') return <Inspector activeTab={{ ...activeTab, kind: 'source' }} />;
      if (asSrc && asSrc.type === 'draft') return <Inspector activeTab={{ ...activeTab, kind: 'draft' }} />;
      const w = findWritable(store.vault, activeTab.id);
      if (w) {
        const r = w.write || {};
        return (
          <div className="insp">
            <div className="block">
              <h6>{w.kind === 'extract' ? 'extract' : 'draft'}</h6>
              <dl className="kv">
                <dt>in</dt><dd>{w.draft.name}</dd>
                <dt>length</dt><dd>{writableWords(w.node)} words</dd>
              </dl>
            </div>
            <div className="block">
              <h6>spaced composition</h6>
              <dl className="kv">
                <dt>passes</dt><dd>{r.reps || 0}</dd>
                <dt>interval</dt><dd>{r.ivl || 1} d</dd>
                <dt>due</dt><dd>{r.done ? 'done' : dueLabel(r.due)}</dd>
              </dl>
                          </div>
          </div>
        );
      }
    }
    const s = fc ? fc.card.sched : (store.lastGraded ? store.lastGraded.sched : { reps: 0, lapses: 0, stab: 1, diff: 0.3, due: TODAY, last: 'new' });
    const src = fc && fc.source;
    return (
      <div className="insp">
        <div className="block">
          <h6>card</h6>
          <dl className="kv">
            <dt>type</dt><dd>{fc ? (fc.card.type === 'qa' ? 'q&a' : fc.card.type) : '—'}</dd>
            <dt>in</dt><dd>{src ? src.name : '—'}</dd>
            {src && src.frozen ? <React.Fragment><dt>source</dt><dd>frozen</dd></React.Fragment> : null}
          </dl>
        </div>
        <div className="block">
          <h6>schedule</h6>
          <dl className="kv">
            <dt>reviews</dt><dd>{s.reps}</dd>
            <dt>lapses</dt><dd>{s.lapses}</dd>
            <dt>stability</dt><dd>{s.stab} d</dd>
            <dt>difficulty</dt><dd>{s.diff}</dd>
            <dt>due</dt><dd>{dueLabel(s.due)} <span style={{ color: 'var(--fg-5)' }}>({s.due})</span></dd>
            <dt>last</dt><dd>{s.last}</dd>
          </dl>
        </div>
      </div>
    );
  }

  if (kind === 'deck') {
    const deck = findNode(store.vault, activeTab.id);
    if (!deck) return <div className="insp"><div className="block"><h6>deck</h6><p className="insp-prose">no longer in the vault.</p></div></div>;
    const cards = (deck.body || []).filter(b => b.kind === 'card');
    const due = cards.filter(c => isDue(c.sched.due));
    return (
      <div className="insp">
        <div className="block">
          <h6>deck</h6>
          <dl className="kv">
            <dt>cards</dt><dd>{cards.length}</dd>
            <dt>due</dt><dd>{due.length}</dd>
          </dl>
          <div className="frozen-row">
            <span className="fr-state">default type</span>
            <div className="deck-default">
              {['cloze', 'qa', 'bidir'].map(tp => (
                <button key={tp} type="button" data-active={(deck.defaultCard || 'cloze') === tp ? '1' : '0'}
                        onClick={() => store.setDeckDefault(deck.id, tp)}>{tp === 'qa' ? 'q&a' : tp}</button>
              ))}
            </div>
          </div>
        </div>
        <div className="block">
          <h6>cards</h6>
          {cards.length === 0
            ? <p className="insp-prose">Empty.</p>
            : <ul className="insp-cards">
                {cards.map(card => (
                  <li key={card.id} data-due={isDue(card.sched.due) ? '1' : '0'}>
                    <span className="cl-t">{cardLabel(card)}</span>
                    <span className="cl-due">{dueLabel(card.sched.due)}</span>
                  </li>
                ))}
              </ul>}
        </div>
      </div>
    );
  }

  if (kind === 'folder') {
    const folder = findNode(store.vault, activeTab.id);
    if (!folder) return <div className="insp"><div className="block"><h6>folder</h6><p className="insp-prose">no longer in the vault.</p></div></div>;
    const children = folder.children || [];
    const looseCards = (folder.body || []).filter(b => b.kind === 'card');
    const due = looseCards.filter(card => isDue(card.sched.due));
    const byType = {};
    children.forEach(n => { byType[n.type] = (byType[n.type] || 0) + 1; });
    return (
      <div className="insp">
        <div className="block">
          <h6>folder</h6>
          <dl className="kv">
            <dt>items</dt><dd>{children.length}</dd>
            {looseCards.length ? <React.Fragment><dt>cards</dt><dd>{looseCards.length}{due.length ? ' · ' + due.length + ' due' : ''}</dd></React.Fragment> : null}
          </dl>
        </div>
        {looseCards.length > 0 && (
          <div className="block">
            <h6>loose cards</h6>
            <ul className="insp-cards">
              {looseCards.map(card => (
                <li key={card.id} data-due={isDue(card.sched.due) ? '1' : '0'}>
                  <span className="cl-t">{cardLabel(card)}</span>
                  <span className="cl-due">{dueLabel(card.sched.due)}</span>
                </li>
              ))}
            </ul>
          </div>
        )}
      </div>
    );
  }

  if (kind === 'draft') {
    const d = findNode(store.vault, activeTab.id);
    if (!d) return <div className="insp"><div className="block"><h6>draft</h6><p className="insp-prose">no longer in the vault.</p></div></div>;
    const r = d.write || {};
    const words = writableWords(d);
    const dCards = (d.body || []).filter(b => b.kind === 'card');
    const dDue = dCards.filter(card => isDue(card.sched.due));
    return (
      <div className="insp">
        <div className="block">
          <h6>draft</h6>
          <dl className="kv">
            <dt>path</dt><dd style={{ fontFamily: 'var(--mono)', fontSize: 10.5 }}>{d.meta ? d.meta.path : d.name + '.md'}</dd>
            <dt>length</dt><dd>{words.toLocaleString()} words</dd>
            {dCards.length > 0 && <React.Fragment><dt>cards</dt><dd>{dCards.length} · {dDue.length} due</dd></React.Fragment>}
          </dl>
          <div className="frozen-row">
            <span className="fr-state">{r.done ? 'done' : (r.reps ? 'pass ' + (r.reps + 1) : 'first pass')}</span>
            <button type="button" className="fr-toggle" onClick={() => store.writeAdvance(d.id, r.done ? 'next' : 'done')}>{r.done ? 'reopen' : 'done'}</button>
          </div>
        </div>
        <div className="block">
          <h6>spaced composition</h6>
          <dl className="kv">
            <dt>passes</dt><dd>{r.reps || 0}</dd>
            <dt>interval</dt><dd>{r.ivl || 1} d</dd>
            <dt>{r.done ? 'status' : 'due'}</dt><dd>{r.done ? 'done' : dueLabel(r.due)}</dd>
          </dl>
        </div>
        {dCards.length > 0 && (
          <div className="block">
            <h6>cards</h6>
            <ul className="insp-cards">
              {dCards.map(card => (
                <li key={card.id} data-due={isDue(card.sched.due) ? '1' : '0'}>
                  <span className="cl-t">{cardLabel(card)}</span>
                  <span className="cl-due">{dueLabel(card.sched.due)}</span>
                </li>
              ))}
            </ul>
          </div>
        )}
      </div>
    );
  }

  // default: queue / saved-query summary
  const c = store.counts;
  return (
    <div className="insp">
      <div className="block">
        <h6>retention</h6>
        <dl className="kv">
          <dt>true</dt><dd>0.913</dd>
          <dt>target</dt><dd>0.90</dd>
        </dl>
      </div>
      <div className="block">
        <h6>recent</h6>
        <dl className="kv">
          <dt>today</dt><dd>2026-05-27.md</dd>
          <dt>9 days ago</dt><dd>marginalia.md</dd>
          <dt>last week</dt><dd>crick-1995.md</dd>
        </dl>
      </div>
    </div>
  );
}
