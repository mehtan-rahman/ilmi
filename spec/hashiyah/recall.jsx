// recall.jsx — the SESSION surface (a 'card' tab renders this).
// The session is the outstanding queue, query('today'), rotated to start at the
// element you entered on. It walks both kinds of element:
//   · card  → reveal + grade; grading rewrites the span's inline schedule
//   · read  → an incremental-reading pane: read the next portion, extract a span
//             (carve a card), then reschedule the topic back into the queue
// Incremental everything: reading and review share one stream.

function SessionShell({ idx, total, sub, label, children, progress, onSource, onPrev, onNext }) {
  return (
    <div className="recall-wrap">
      <div className="recall-meta">
        <span className="sess-nav">
          <button type="button" className="sn-btn" onClick={onPrev} disabled={idx === 0}>‹</button>
          <button type="button" className="sn-btn" onClick={onNext} disabled={idx >= total - 1}>›</button>
        </span>
        <span className="sess-count">{idx + 1} / {total}</span>
        <span className="el-tag" data-el={sub === 'read' ? 'read' : sub === 'write' ? 'write' : 'card'}>{sub === 'read' ? 'reading' : sub === 'write' ? 'writing' : sub}</span>
        {onSource
          ? <button type="button" className="meta-srclink" onClick={onSource}>{label} <span className="ms-arrow">↗</span></button>
          : <span>{label}</span>}
      </div>
      {children}
    </div>);

}

// ── the session control bar: floats at the foot of the pane while you read or
//    write the actual note above it. Carries the progress + the soft actions. ──
function SessionBar({ idx, total, kind, progress, children, onPrev, onNext }) {
  return (
    <div className="session-bar">
      <div className="sb-inner">
        <div className="sb-meta">
          <span className="sess-nav">
            <button type="button" className="sn-btn" onClick={onPrev} disabled={idx === 0}>‹</button>
            <button type="button" className="sn-btn" onClick={onNext} disabled={idx >= total - 1}>›</button>
          </span>
          <span className="sb-count">{idx + 1} / {total}</span>
          <span className="sb-kind" data-el={kind}>{kind === 'read' ? 'reading' : kind === 'write' ? 'writing' : kind}</span>
        </div>
        <div className="sb-actions">{children}</div>
      </div>
    </div>
  );
}

// ── a reading element, IN CONTEXT: the whole source opens at your reading
//    position (already-read prose settles back), and you read on / extract a
//    card right where it sits. The soft actions live in the floating bar. ──
function ReadingSession({ item, idx, total, progress, onAdvance, onOpen, onPrev, onNext }) {
  const store = useStore();
  const src = findSource(store.vault, item.source);
  const prose = (src ? src.body : []).filter((b) => b.kind !== 'card');
  const livePos = src && src.read ? (src.read.pos || 0) : item.pos;
  const posBlock = prose[Math.min(livePos, Math.max(0, prose.length - 1))];
  const cursorId = posBlock ? posBlock.id : null;

  React.useEffect(() => {
    const onKey = (e) => {
      const tag = (e.target.tagName || '').toLowerCase();
      if (tag === 'input' || tag === 'textarea' || e.target.isContentEditable || e.metaKey || e.ctrlKey) return;
      if (e.key === 'Enter') { e.preventDefault(); onAdvance('next'); }
      else if (e.key === 'p') { e.preventDefault(); onAdvance('postpone'); }
      else if (e.key === 'd') { e.preventDefault(); onAdvance('done'); }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [item.id]);

  if (!src) return <div className="recall-wrap"><div className="empty center">This source is no longer in the vault.</div></div>;

  // “read on” remembers the block at the top of the view, so you resume there
  const readOn = (e) => {
    let topId = null;
    const scroller = e && e.currentTarget && e.currentTarget.closest('.pane-body');
    if (scroller) {
      const sr = scroller.getBoundingClientRect();
      const blocks = scroller.querySelectorAll('.reader [data-bid]');
      for (let i = 0; i < blocks.length; i++) { if (blocks[i].getBoundingClientRect().bottom >= sr.top + 70) { topId = blocks[i].dataset.bid; break; } }
    }
    onAdvance('next', topId);
  };

  return (
    <>
      <Reader sourceId={item.source} active onOpen={onOpen} focus={cursorId} readCursor={cursorId}
              onSetCursor={(bid) => store.setReadPos(item.source, bid)}
              onExtract={(payload) => store.extractReading(item.source, payload)} />
      <SessionBar idx={idx} total={total} kind="read" progress={progress} onPrev={onPrev} onNext={onNext}>
        <button onClick={readOn}><span className="ra-l">read on</span><kbd>⏎</kbd></button>
        <button onClick={() => onAdvance('postpone')}><span className="ra-l">postpone</span><kbd>p</kbd></button>
        <button onClick={() => onAdvance('done')}><span className="ra-l">done</span><kbd>d</kbd></button>
      </SessionBar>
    </>
  );
}

// ── a writing element, IN CONTEXT: the whole draft opens. Write anywhere, then
//    choose what happens. “worked on it” brings it back on schedule; “postpone”
//    defers to tomorrow; “done” graduates it. Never graded. ──
function WritingSession({ item, idx, total, progress, onAdvance, onOpen, onPrev, onNext }) {
  React.useEffect(() => {
    const onKey = (e) => {
      const tag = (e.target.tagName || '').toLowerCase();
      if (tag === 'input' || tag === 'textarea' || e.target.isContentEditable || e.metaKey || e.ctrlKey) return;
      if (e.key === 'Enter') { e.preventDefault(); onAdvance('next'); }
      else if (e.key === 'p') { e.preventDefault(); onAdvance('postpone'); }
      else if (e.key === 'd') { e.preventDefault(); onAdvance('done'); }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [item.id]);

  return (
    <>
      <DraftView draftId={item.draft} active onOpen={onOpen} />
      <SessionBar idx={idx} total={total} kind="write" progress={progress} onPrev={onPrev} onNext={onNext}>
        <button onClick={() => onAdvance('next')}><span className="ra-l">worked on it</span><kbd>⏎</kbd></button>
        <button onClick={() => onAdvance('postpone')}><span className="ra-l">postpone</span><kbd>p</kbd></button>
        <button onClick={() => onAdvance('done')}><span className="ra-l">done</span><kbd>d</kbd></button>
      </SessionBar>
    </>
  );
}

// ── a card element: reveal + grade · every visible part edits in place ──
// group each cloze part by its number (c1/c2…); lone {{blanks}} are each their
// own group. Returns parts tagged with a group index + the total group count,
// so a multi-cloze card reveals one blank at a time.
function clozeParts(text) {
  const order = []; let lone = 0;
  const enriched = parseCloze(text).map((p) => {
    if (typeof p === 'string') return { str: p };
    const key = p.n == null ? 'l' + (lone++) : 'g' + p.n;
    let gi = order.indexOf(key);
    if (gi === -1) { gi = order.length; order.push(key); }
    return { cloze: p.cloze, gi };
  });
  return { enriched, groupCount: order.length };
}

function CardElement({ item, onGrade, startRevealed, onOpen }) {
  const store = useStore();
  const live = findCard(store.vault, item.cardId || item.id);
  const sub = live ? live.card.type : item.sub;
  const rawCloze = live && sub === 'cloze' ? live.card.text : '';
  const { enriched: clozeEnriched, groupCount } = sub === 'cloze' ? clozeParts(rawCloze) : { enriched: [], groupCount: 1 };
  const body = live ? (sub === 'cloze' ? null : live.card.body) : item.body;
  // a separated multi-cloze item tests exactly ONE blank (item.gi); other blanks
  // stay shown as context. A plain card reveals its blank(s) / answer in order.
  const maskGi = (sub === 'cloze' && typeof item.gi === 'number') ? item.gi : null;
  const needReveals = maskGi != null ? 1 : groupCount;
  const [reveal, setReveal] = React.useState(startRevealed ? 999 : 0);
  const fully = reveal >= needReveals;
  const intervals = previewIntervals(item.stab || 1);

  // editing is live by default: visible text is contentEditable and writes
  // straight to the card (and its source block) on blur. Cloze raw text is
  // reconstructed from the DOM so masked answers survive an edit to the prose.
  const editField = (field) => (e) => {if (live) store.editCard(item.cardId || item.id, { [field]: e.currentTarget.textContent });};
  const onClozeBlur = (e) => {
    if (!live) return;
    let raw = '';
    e.currentTarget.childNodes.forEach((n) => {
      if (n.nodeType === 3) raw += n.textContent;else
      if (n.classList && n.classList.contains('cloze')) raw += '{{' + n.textContent + '}}';else
      raw += n.textContent;
    });
    store.editCard(item.cardId || item.id, { text: raw });
  };

  React.useEffect(() => {
    const onKey = (e) => {
      const tag = (e.target.tagName || '').toLowerCase();
      if (tag === 'input' || tag === 'textarea' || e.target.isContentEditable || e.metaKey || e.ctrlKey) return;
      if (e.key === ' ') { e.preventDefault(); if (!fully) setReveal((r) => r + 1); else onGrade(3); }
      else if (e.key >= '1' && e.key <= '4') { e.preventDefault(); if (fully) onGrade(Number(e.key)); else setReveal((r) => r + 1); }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [fully, item.id]);

  return (
    <>
      <div className="card">
        {sub === 'cloze' && Array.isArray(clozeEnriched) &&
        <div className="cloze-text" contentEditable suppressContentEditableWarning onBlur={onClozeBlur}>{clozeEnriched.map((p, i) => p.str !== undefined ?
          <React.Fragment key={i}>{p.str}</React.Fragment> :
          (() => {
            const hidden = maskGi != null ? (p.gi === maskGi && reveal < 1) : (p.gi >= reveal);
            const isMine = maskGi == null || p.gi === maskGi;
            return <span key={i} className={`cloze ${hidden ? '' : 'revealed'} ${isMine ? '' : 'ctx'}`}
              onClick={() => { if (isMine) setReveal((r) => Math.max(r, maskGi != null ? 1 : p.gi + 1)); }}>{p.cloze}</span>;
          })())}</div>
        }
        {sub === 'qa' &&
        <div>
            <div className="qa-q" contentEditable suppressContentEditableWarning onBlur={editField('q')}>{body.q}</div>
            {reveal > 0 ?
          <div className="qa-a" contentEditable suppressContentEditableWarning onBlur={editField('a')}>{body.a}</div> :
          <div className="qa-a hint" onClick={() => setReveal(1)}>press <kbd className="kbd">space</kbd> to reveal</div>}
          </div>
        }
        {sub === 'bidir' &&
        <div className="bidir">
            <div><span className="lbl">a</span><span contentEditable suppressContentEditableWarning onBlur={editField('l')}>{body.l}</span></div>
            <div style={{ alignItems: 'center', color: 'var(--fg-4)', fontFamily: 'var(--mono)', fontSize: 14 }}><span className="lbl"> </span>⇄</div>
            <div><span className="lbl">b</span>
              {reveal > 0 ?
            <span className="bidir-b revealed" contentEditable suppressContentEditableWarning onBlur={editField('r')}>{body.r}</span> :
            <span className="bidir-b" onClick={() => setReveal(1)}>{body.r}</span>}
            </div>
          </div>
        }
      </div>
      {(() => {
        const sc = live ? live.card.sched : item.sched;
        if (!sc) return null;
        return (
          <div className="card-meta">
            <span className="cm-type">{sub === 'qa' ? 'q&a' : sub}</span>
            {maskGi != null && <span>blank {item.blank} of {item.groupCount}</span>}
            {maskGi == null && sub === 'cloze' && groupCount > 1 && <span>{fully ? groupCount : reveal} / {groupCount} blanks</span>}
            <span>{sc.reps || 0} review{(sc.reps || 0) === 1 ? '' : 's'}</span>
            <span>stability {sc.stab || 1}d</span>
            <span className="cm-due" data-due={isDue(sc.due) ? '1' : '0'}>due {dueLabel(sc.due)}</span>
          </div>
        );
      })()}
      <div className="grades">
        {['again', 'hard', 'good', 'easy'].map((g, i) =>
        <button key={g} onClick={() => fully ? onGrade(i + 1) : setReveal((r) => r + 1)}
        disabled={!fully} style={{ opacity: fully ? 1 : 0.4 }}>
            <span className="label">{g}<kbd>{i + 1}</kbd></span>
            <span className="gap">{intervals[i]}</span>
          </button>
        )}
      </div>
    </>);

}

function Recall({ cardId, active, onOpen, browse, onEl }) {
  const store = useStore();
  const [session] = React.useState(() => {
    if (browse) {
      const fc = findCard(store.vault, cardId);
      if (fc) return [cardToItem(fc.card, fc.source, '')];
      const w = findWritable(store.vault, cardId);
      if (w) return [writableToItem(w)];
      const bsrc = findSource(store.vault, cardId);
      if (bsrc && bsrc.read) return [topicToItem(bsrc)];
      return [];
    }
    const q = store.query('today');
    const start = q.findIndex((e) => e.id === cardId);
    if (start >= 0) return q.slice(start).concat(q.slice(0, start));
    const fc = findCard(store.vault, cardId);
    if (fc) return [cardToItem(fc.card, fc.source, '')];
    const w = findWritable(store.vault, cardId);
    if (w) return [writableToItem(w)];
    const src = findSource(store.vault, cardId);
    if (src && src.read) return [topicToItem(src)];
    return q;
  });
  const [idx, setIdx] = React.useState(0);
  const total = session.length;
  const el = session[idx];
  const progress = session.map((e) => e.el);

  const advance = () => setIdx((i) => i + 1);
  const goPrev = () => setIdx((i) => Math.max(0, i - 1));
  const goNext = () => setIdx((i) => Math.min(total - 1, i + 1));
  const onGrade = (g) => {store.gradeCard(el.id, g);advance();};
  const onRead = (mode, posId) => {store.readAdvance(el.source, mode, posId);advance();};
  const onWrite = (mode) => {store.writeAdvance(el.id, mode);advance();};

  React.useEffect(() => {
    if (!onEl || !el) return;
    const title = el.sourceLabel || 'card';
    onEl({ kind: el.el, title });
  }, [el && el.id, active]);

  React.useEffect(() => {
    if (!active) return;
    const onKey = (e) => {
      const tag = (e.target.tagName || '').toLowerCase();
      if (tag === 'input' || tag === 'textarea' || e.target.isContentEditable || e.metaKey || e.ctrlKey) return;
      if (e.key === '[') { e.preventDefault(); goPrev(); }
      else if (e.key === ']') { e.preventDefault(); goNext(); }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [active, total]);

  if (!el) {
    return (
      <div className="recall-wrap">
        <div className="empty center">
          {total === 0 ?
          'Nothing due. The outstanding queue is empty for today.' :
          `Session complete. ${total} element${total === 1 ? '' : 's'} reviewed.`}
        </div>
      </div>);

  }

  // reading + writing happen IN the note, with its context around them
  if (el.el === 'read')
    return <ReadingSession key={el.id} item={el} idx={idx} total={total} progress={progress} onAdvance={onRead} onOpen={onOpen} onPrev={goPrev} onNext={goNext} />;
  if (el.el === 'write')
    return <WritingSession key={el.id} item={el} idx={idx} total={total} progress={progress} onAdvance={onWrite} onOpen={onOpen} onPrev={goPrev} onNext={goNext} />;

  // a card is atomic recall — the source it came from is one click away
  return (
    <SessionShell idx={idx} total={total} sub={el.sub} label={el.sourceLabel} progress={progress}
      onPrev={goPrev} onNext={goNext}
      onSource={onOpen && el.source ? () => {
        const c = findNode(store.vault, el.source);
        if (!c) return;
        const kind = c.type === 'deck' ? 'deck' : c.type === 'folder' ? 'folder' : c.type === 'draft' ? 'draft' : 'source';
        const focus = el.el === 'card' ? el.id : undefined;
        onOpen({ kind, id: c.id, title: c.name, focus }, {});
      } : undefined}>
      <CardElement key={el.id} item={el} onGrade={onGrade} startRevealed={browse} onOpen={onOpen} />
    </SessionShell>);

}