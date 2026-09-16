// reader.jsx — Reader + MakeCard composer.
// The reader is a LENS over a source file in the vault. It renders the file's
// body block-by-block: prose as prose, and cards as what they are — marked spans
// living inside the text, each showing its block-ref ^id and inline SR schedule.
// Select a passage and press `m` to carve a new card; it is inserted into the
// file's body right after the block you selected. Nothing here is a side store.

function renderClozeMarks(text) {
  return parseCloze(text).map((p, i) => typeof p === 'string'
    ? <React.Fragment key={i}>{p}</React.Fragment>
    : <span key={i} className="cz">{p.cloze}</span>);
}

function CardSpan({ card, onOpen }) {
  const s = card.sched;
  const due = isDue(s.due);
  return (
    <div className={`card-span ${due ? 'due' : ''} ${card.isNew ? 'fresh' : ''}`}
         data-bid={card.id}
         onClick={() => onOpen({ kind: 'card', id: card.id, title: cardLabel(card), source: null }, {})}>
      <div className="cs-body">
        {card.type === 'cloze' && renderClozeMarks(card.text)}
        {card.type === 'qa' && <><span className="cs-q">{card.body.q}</span><span className="cs-a">{card.body.a}</span></>}
        {card.type === 'bidir' && <span>{card.body.l} <span className="cs-arrow">⇄</span> {card.body.r}</span>}
      </div>
      <div className="cs-foot">
        <span className="cs-state" data-due={due ? '1' : '0'}>{dueLabel(s.due)}</span>
      </div>
    </div>
  );
}

// ── an editable prose block — double-click to edit (only on un-frozen sources) ──
// a live-editable prose block — click in and type, like a notebook page. No mode,
// no double-click: the paragraph IS the editor. Writes to the store on blur.
// Headings and paragraphs both; a frozen source renders read-only.
//
// Editorial notes written inline — [like this] or #TODO: — highlight themselves.
// They live in the text (file-over-app). To stay robust inside contentEditable,
// the block is UNcontrolled: React renders an empty node and we set its HTML
// imperatively, so re-renders never clobber an in-progress edit.
function escapeHtml(s) { return (s || '').replace(/[&<>]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;' }[c])); }
function escapeAttr(s) { return (s || '').replace(/[&"<>]/g, (c) => ({ '&': '&amp;', '"': '&quot;', '<': '&lt;', '>': '&gt;' }[c])); }
function annotateHTML(text) {
  if (!text) return '';
  let html = '', last = 0, m;
  const re = /(\[[^\]\n]*\]|#[A-Za-z][\w-]*:?)/g;
  while ((m = re.exec(text))) {
    if (m.index > last) html += escapeHtml(text.slice(last, m.index));
    const tok = m[0];
    html += '<span class="ed-mark ' + (tok[0] === '#' ? 'tag' : 'note') + '">' + escapeHtml(tok) + '</span>';
    last = m.index + tok.length;
  }
  if (last < text.length) html += escapeHtml(text.slice(last));
  return html;
}

// rich inline HTML: LaTeX math ($…$ / $$…$$) becomes atomic KaTeX chips
// (contenteditable=false, with the source kept in data-tex so it round-trips);
// everything else flows through annotateHTML for editorial marks.
function renderTeX(tex, display, raw) {
  let inner;
  try { inner = (window.katex) ? katex.renderToString(tex, { throwOnError: false, displayMode: display }) : escapeHtml(raw); }
  catch (e) { inner = escapeHtml(raw); }
  return '<span class="math' + (display ? ' display' : '') + '" contenteditable="false" data-tex="' + escapeAttr(raw) + '">' + inner + '</span>';
}
function richHTML(text) {
  if (!text) return '';
  const re = /\$\$([^$]+)\$\$|\$([^$\n]+)\$/g;
  let out = '', last = 0, m;
  while ((m = re.exec(text))) {
    if (m.index > last) out += annotateHTML(text.slice(last, m.index));
    const display = m[1] != null;
    out += renderTeX(display ? m[1] : m[2], display, m[0]);
    last = m.index + m[0].length;
  }
  if (last < text.length) out += annotateHTML(text.slice(last));
  return out;
}
// recover a block's markdown source from the DOM, turning KaTeX chips back into
// their $…$ source and reading editorial marks as their literal text.
function blockSource(el) {
  let out = '';
  el.childNodes.forEach((n) => {
    if (n.nodeType === 3) out += n.textContent;
    else if (n.classList && n.classList.contains('ex-tag')) { /* processed-marker, not text */ }
    else if (n.classList && n.classList.contains('math')) out += (n.getAttribute('data-tex') || '');
    else out += blockSource(n);
  });
  return out;
}

// ── WYSIWYG math, inside a contenteditable ───────────────────────
// When you finish typing a $…$ (or $$…$$), it renders right then. Click a
// rendered chip to turn it back into its $…$ source for editing; it re-renders
// when you complete it again or on blur. The source lives in data-tex so the
// document round-trips as plain markdown+LaTeX.
function liveRenderMathAtCaret(root) {
  const sel = window.getSelection();
  if (!sel || !sel.rangeCount) return false;
  const node = sel.anchorNode;
  if (!node || node.nodeType !== 3) return false;
  const offset = sel.anchorOffset;
  const before = node.textContent.slice(0, offset);
  const m = /\$\$([^$]+)\$\$$|\$([^$\n]+)\$$/.exec(before);
  if (!m) return false;
  const display = m[1] != null;
  const raw = m[0];
  const start = offset - raw.length;
  const head = node.textContent.slice(0, start);
  const tail = node.textContent.slice(offset);
  const frag = document.createDocumentFragment();
  if (head) frag.appendChild(document.createTextNode(head));
  const tmp = document.createElement('div');
  tmp.innerHTML = renderTeX(display ? m[1] : m[2], display, raw);
  const chip = tmp.firstChild;
  frag.appendChild(chip);
  const caretText = document.createTextNode('\u200B' + tail);
  frag.appendChild(caretText);
  node.parentNode.replaceChild(frag, node);
  const r = document.createRange();
  r.setStart(caretText, 1); r.collapse(true);
  sel.removeAllRanges(); sel.addRange(r);
  return true;
}
function editMathChip(chip) {
  const raw = chip.getAttribute('data-tex') || '';
  const t = document.createTextNode(raw);
  chip.parentNode.replaceChild(t, chip);
  const r = document.createRange();
  r.setStart(t, raw.length); r.collapse(true);
  const s = window.getSelection(); s.removeAllRanges(); s.addRange(r);
}

// a card as an atomic, non-editable widget embedded in the document flow
function cardChipHTML(card) {
  const due = isDue(card.sched.due);
  let body = '';
  if (card.type === 'cloze') {
    body = parseCloze(card.text).map((p) => typeof p === 'string'
      ? richHTML(p) : '<span class="cz">' + richHTML(p.cloze) + '</span>').join('');
  } else if (card.type === 'qa') {
    body = '<span class="cs-q">' + richHTML(card.body.q) + '</span><span class="cs-a">' + richHTML(card.body.a) + '</span>';
  } else {
    body = '<span>' + richHTML(card.body.l) + ' <span class="cs-arrow">⇄</span> ' + richHTML(card.body.r) + '</span>';
  }
  return '<div class="card-span' + (due ? ' due' : '') + (card.isNew ? ' fresh' : '')
    + '" contenteditable="false" data-bid="' + card.id + '" data-card="1">'
    + '<div class="cs-body">' + body + '</div>'
    + '<div class="cs-foot"><span class="cs-state" data-due="' + (due ? '1' : '0') + '">'
    + escapeHtml(dueLabel(card.sched.due)) + '</span></div></div>';
}
function docInnerHTML(body) {
  const out = (body || []).map((b) => {
    if (b.kind === 'card') return cardChipHTML(b);
    if (b.kind === 'h') {
      const lvl = b.lvl || 2; const tag = lvl === 1 ? 'h1' : lvl === 3 ? 'h3' : 'h2';
      return '<' + tag + ' class="dd-h" data-lvl="' + lvl + '" data-bid="' + b.id + '">' + (richHTML(b.text) || '<br>') + '</' + tag + '>';
    }
    const ex = b.exrefs && b.exrefs.length;
    return '<p class="dd-p' + (ex ? ' extracted' : '') + '" data-bid="' + b.id + '">'
      + (ex ? '<span class="ex-tag" contenteditable="false">extract</span>' : '')
      + (richHTML(b.text) || '<br>') + '</p>';
  });
  return out.length ? out.join('') : '<p class="dd-p"><br></p>';
}

// ── DocEditor — the one editor used everywhere. A node's body rendered as a
//    single continuous surface: prose flows like a page, cards sit inline as
//    atomic widgets, math renders live. The ONLY thing layered on top is the
//    reading marker (the left-margin rule), shown when readCursor is set. ──
function DocEditor({ nodeId, editable, readCursor, onSetCursor, onOpen, focus, active, canCard, onExtract }) {
  const store = useStore();
  const node = findNode(store.vault, nodeId);
  const wrapRef = React.useRef(null);
  const ref = React.useRef(null);
  const [rule, setRule] = React.useState(null);
  const [sel, setSel] = React.useState(null);
  const [composer, setComposer] = React.useState(null);
  const dragRef = React.useRef(false);

  const body = (node && node.body) || [];
  const sig = body.map((b) => b.id + ':' + b.kind + (b.lvl || '') + ':' +
    (b.kind === 'card' ? b.type + JSON.stringify(b.body || b.text) + b.sched.due : b.text)).join('\u0001');

  // paint from the model — never while the caret is inside the surface
  React.useEffect(() => {
    const el = ref.current; if (!el) return;
    if (document.activeElement === el || el.contains(document.activeElement)) return;
    el.innerHTML = docInnerHTML(body);
    measureRule();
  }, [sig, editable]);

  // the block element the caret sits in (a direct child of the surface)
  const caretBlock = () => {
    const s = window.getSelection();
    if (!s || !s.rangeCount) return null;
    let n = s.anchorNode; const root = ref.current;
    while (n && n.parentNode !== root) n = n.parentNode;
    return n && n.parentNode === root ? n : null;
  };

  const onInput = (e) => {
    const root = ref.current; if (!root) return;
    if (e && e.nativeEvent && e.nativeEvent.data === '$') { if (liveRenderMathAtCaret(root)) return; }
    const blk = caretBlock();
    if (!blk || /^H[1-3]$/.test(blk.tagName)) return;
    const m = /^(#{1,3})\s/.exec(blk.textContent);
    if (!m) return;
    const lvl = m[1].length;
    const rest = blk.textContent.slice(m[0].length);
    const h = document.createElement(lvl === 1 ? 'h1' : lvl === 3 ? 'h3' : 'h2');
    h.className = 'dd-h'; h.setAttribute('data-lvl', lvl);
    if (rest) h.textContent = rest; else h.innerHTML = '<br>';
    root.replaceChild(h, blk);
    const r = document.createRange(); r.selectNodeContents(h); r.collapse(false);
    const s = window.getSelection(); s.removeAllRanges(); s.addRange(r);
  };

  const onKeyDown = (e) => {
    if (e.key === 'Escape') { e.preventDefault(); e.currentTarget.blur(); return; }
    if (e.key === 'e' && onExtract && sel && !composer) { e.preventDefault(); doExtract(); return; }
    if (e.key === 'm' && canCard && sel && !composer) { e.preventDefault(); openComposer(); return; }
    if (e.key !== 'Enter' || e.shiftKey) return;
    const blk = caretBlock();
    if (!blk || !/^H[1-3]$/.test(blk.tagName)) return;
    const s = window.getSelection();
    const atEnd = s && s.anchorOffset >= (s.anchorNode.textContent || '').length;
    if (!atEnd) return;
    e.preventDefault();
    const p = document.createElement('p'); p.className = 'dd-p'; p.innerHTML = '<br>';
    blk.after(p);
    const r = document.createRange(); r.selectNodeContents(p); r.collapse(true);
    s.removeAllRanges(); s.addRange(r);
  };

  const onClick = (e) => {
    const chip = e.target.closest && e.target.closest('.math');
    if (chip && editable && ref.current.contains(chip)) { e.preventDefault(); editMathChip(chip); return; }
    const card = e.target.closest && e.target.closest('[data-card]');
    if (card && onOpen) { e.preventDefault(); onOpen({ kind: 'card', id: card.dataset.bid, title: '', source: nodeId, browse: true }, {}); }
  };

  const commit = () => {
    const el = ref.current; if (!el) return;
    const out = []; const seen = {};
    [...el.children].forEach((ch) => {
      if (ch.getAttribute && ch.getAttribute('data-card')) {
        const orig = body.find((b) => b.id === ch.dataset.bid);
        if (orig) out.push(orig);
        return;
      }
      const text = blockSource(ch).replace(/\u200B/g, '').replace(/\u00A0/g, ' ').replace(/\n+/g, ' ').trim();
      if (!text) return;
      const isH = /^H[1-3]$/.test(ch.tagName);
      let id = (ch.dataset && ch.dataset.bid) || uid('b');
      if (seen[id]) id = uid('b'); seen[id] = 1;
      if (isH) out.push({ id, kind: 'h', lvl: (ch.dataset && +ch.dataset.lvl) || +ch.tagName[1] || 2, text });
      else out.push({ id, kind: 'p', text });
    });
    store.setDocBody(nodeId, out);
    if (ref.current) ref.current.innerHTML = docInnerHTML(out);
    measureRule();
  };

  // ── selection → make a card and/or carve an extract ──
  const captureSelection = () => {
    if (!canCard && !onExtract) return;
    const s = window.getSelection();
    const txt = s ? s.toString().trim() : '';
    if (txt && ref.current && s.anchorNode && ref.current.contains(s.anchorNode)) {
      let n = s.focusNode; while (n && !(n.dataset && n.dataset.bid)) n = n.parentNode;
      const range = s.getRangeAt(0);
      const blockIds = [...ref.current.children]
        .filter((ch) => ch.dataset && ch.dataset.bid && !ch.classList.contains('card-span') && range.intersectsNode(ch))
        .map((ch) => ch.dataset.bid);
      const rect = range.getBoundingClientRect();
      setSel({ text: txt, words: txt.split(/\s+/).filter(Boolean).length, afterBlockId: n ? n.dataset.bid : null, blockIds, rect });
    } else setSel(null);
  };
  const openComposer = () => { setComposer({ seed: sel ? sel.text : '', afterBlockId: sel ? sel.afterBlockId : null, rect: sel ? sel.rect : null }); setSel(null); };
  const doExtract = () => { if (!onExtract || !sel) return; onExtract({ text: sel.text, blockIds: sel.blockIds || [] }); setSel(null); window.getSelection().removeAllRanges(); };

  // keyboard for the selection cue when the surface is NOT focused (a frozen
  // reading source isn't contentEditable, so onKeyDown never fires there)
  React.useEffect(() => {
    if (!sel || composer) return;
    const onKey = (e) => {
      const tag = (e.target.tagName || '').toLowerCase();
      if (tag === 'input' || tag === 'textarea' || e.target.isContentEditable || e.metaKey || e.ctrlKey) return;
      if (e.key === 'e' && onExtract) { e.preventDefault(); doExtract(); }
      else if (e.key === 'm' && canCard) { e.preventDefault(); openComposer(); }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [sel, composer, onExtract, canCard]);
  const onSaveCard = (card, again) => {
    store.addCard({ sourceId: nodeId, afterBlockId: composer.afterBlockId, ...card });
    if (!again) setComposer(null);
  };

  // ── reading marker: a continuous left-margin rule down to the read point ──
  const measureRule = React.useCallback(() => {
    const root = ref.current, wrap = wrapRef.current;
    if (!root || !wrap || !readCursor) { setRule(null); return; }
    const boundary = root.querySelector('[data-bid="' + readCursor + '"]');
    const first = root.querySelector('[data-bid]');
    if (!boundary || !first) { setRule(null); return; }
    const wr = wrap.getBoundingClientRect();
    const fr = first.getBoundingClientRect(), br = boundary.getBoundingClientRect();
    setRule({ top: fr.top - wr.top, height: Math.max(0, br.bottom - fr.top) });
  }, [readCursor]);
  React.useLayoutEffect(() => { measureRule(); }, [measureRule, sig]);
  React.useEffect(() => {
    const wrap = wrapRef.current; if (!wrap) return;
    const ro = new ResizeObserver(() => measureRule());
    ro.observe(wrap); window.addEventListener('resize', measureRule);
    return () => { ro.disconnect(); window.removeEventListener('resize', measureRule); };
  }, [measureRule]);
  const setFromY = (clientY) => {
    const root = ref.current; if (!root || !onSetCursor) return;
    const blocks = [...root.querySelectorAll('[data-bid]')].filter((e) => !e.classList.contains('card-span'));
    if (!blocks.length) return;
    let chosen = blocks[0];
    for (const e of blocks) {
      const r = e.getBoundingClientRect();
      if (clientY >= r.top + Math.min(22, r.height * 0.5)) chosen = e; else break;
    }
    if (chosen) onSetCursor(chosen.dataset.bid);
  };
  const gutterDown = (e) => { dragRef.current = true; e.currentTarget.setPointerCapture(e.pointerId); setFromY(e.clientY); };
  const gutterMove = (e) => { if (dragRef.current) setFromY(e.clientY); };
  const gutterUp = (e) => { dragRef.current = false; try { e.currentTarget.releasePointerCapture(e.pointerId); } catch (_) {} };

  // dim prose above the read point — applied to painted children after each paint
  React.useEffect(() => {
    const root = ref.current; if (!root) return;
    const kids = [...root.children];
    let reached = !readCursor;
    kids.forEach((k) => {
      const isCur = readCursor && k.dataset && k.dataset.bid === readCursor;
      k.classList.toggle('settled', !!(readCursor && !reached && !isCur && !k.classList.contains('card-span')));
      if (isCur) reached = true;
    });
  }, [sig, readCursor]);

  // scroll a focused block into view (go-to-source / queue resume)
  React.useEffect(() => {
    if (!focus || !ref.current) return;
    const el = ref.current.querySelector('[data-bid="' + focus + '"]');
    if (!el) return;
    const scroller = el.closest('.pane-body');
    if (scroller) { const er = el.getBoundingClientRect(), sr = scroller.getBoundingClientRect(); scroller.scrollTop += (er.top - sr.top) - 90; }
    el.classList.add('flash-target');
    const tm = setTimeout(() => { if (el) el.classList.remove('flash-target'); }, 1700);
    return () => clearTimeout(tm);
  }, [focus, nodeId]);

  // re-render math + editorial marks the moment the caret LEAVES a block: clicking
  // off an edited $…$ or [note] renders it, without waiting for a full blur.
  const lastBlk = React.useRef(null);
  React.useEffect(() => {
    if (!editable) return;
    const onSel = () => {
      const root = ref.current; if (!root) return;
      const cur = caretBlock();
      const prev = lastBlk.current;
      if (prev && prev !== cur && root.contains(prev) && !(prev.getAttribute && prev.getAttribute('data-card'))) {
        const html = (richHTML(blockSource(prev).replace(/\u200B/g, '')) || '<br>');
        if (prev.innerHTML !== html) prev.innerHTML = html;
      }
      lastBlk.current = (cur && root.contains(cur)) ? cur : null;
    };
    document.addEventListener('selectionchange', onSel);
    return () => document.removeEventListener('selectionchange', onSel);
  }, [editable]);

  if (!node) return <div className="empty">This file is no longer in the vault.</div>;

  return (
    <div className={'doc-wrap' + (readCursor ? ' reading' : '')} ref={wrapRef}>
      {readCursor && <div className="read-gutter" onPointerDown={gutterDown} onPointerMove={gutterMove} onPointerUp={gutterUp} />}
      {rule && (<><div className="read-rule" style={{ top: rule.top, height: rule.height }} /><div className="read-edge" style={{ top: rule.top + rule.height }}><span className="read-knob" /></div></>)}
      <div className="draft-doc" ref={ref}
           contentEditable={!!editable} suppressContentEditableWarning spellCheck={true}
           data-ph="Write…"
           onInput={onInput} onKeyDown={onKeyDown} onBlur={editable ? commit : undefined}
           onClick={onClick} onMouseUp={captureSelection} />
      {sel && !composer && (
        <div className="sel-cue" style={{ position: 'fixed', top: sel.rect.bottom + 8, left: sel.rect.left }}>
          {onExtract && <button type="button" className="cue-act" onMouseDown={(e) => { e.preventDefault(); doExtract(); }}>extract <span className="kbd">e</span></button>}
          {canCard && <button type="button" className="cue-act" onMouseDown={(e) => { e.preventDefault(); openComposer(); }}>make a card <span className="kbd">m</span></button>}
        </div>
      )}
      {composer && (
        <div className="card-pop" style={composer.rect ? { position: 'fixed', top: Math.min(composer.rect.bottom + 8, window.innerHeight - 280), left: Math.min(composer.rect.left, window.innerWidth - 440) } : {}}>
          <MakeCard seed={composer.seed} onClose={() => setComposer(null)} onSave={onSaveCard} />
        </div>
      )}
    </div>
  );
}

function Reader({ sourceId, active, onOpen, focus, readCursor, onSetCursor, onExtract }) {
  const store = useStore();
  const src = findNode(store.vault, sourceId);
  if (!src) {
    return <div className="reader-wrap"><div className="reader"><div className="empty">This file is no longer in the vault.</div></div></div>;
  }
  const body = src.body || [];
  const cards = body.filter(b => b.kind === 'card');
  const due = cards.filter(card => isDue(card.sched.due)).length;
  const crumb = (src.meta && src.meta.path) ? src.meta.path.split('/') : [src.name];
  const editable = !src.frozen;
  const canCard = editable || !!onExtract;   // making cards while reading is fine even on frozen papers

  return (
    <div className="reader-wrap">
      <div className={'reader' + (readCursor ? ' reading' : '')}>
        <div className="meta">
          <span className="crumb">{crumb.join('  /  ')}</span>
          <button type="button" className="frozen-tag" data-frozen={src.frozen ? '1' : '0'}
                  onClick={() => store.toggleFrozen(sourceId)}
>
            {src.frozen ? 'frozen' : 'editable'}
          </button>
          <span style={{ marginLeft: 'auto' }}>{cards.length} cards, {due} due</span>
        </div>
        <h1>{src.name}</h1>
        <DocEditor nodeId={sourceId} editable={editable} readCursor={readCursor} onSetCursor={onSetCursor}
                   onOpen={onOpen} focus={focus} active={active} canCard={canCard} onExtract={onExtract} />
      </div>
    </div>
  );
}

// ── MakeCard composer ────────────────────────────────────────────
function MakeCard({ seed, onClose, onSave, initialType }) {
  const [type, setType] = React.useState(initialType || 'cloze');
  const [text, setText] = React.useState(seed || '');
  const [front, setFront] = React.useState(seed || '');
  const [back, setBack] = React.useState('');
  const [a, setA] = React.useState(seed || '');
  const [b, setB] = React.useState('');
  const [pri, setPri] = React.useState(2);
  const ref = React.useRef(null);

  React.useEffect(() => { if (ref.current) ref.current.focus(); }, [type]);

  const clear = () => { setText(''); setFront(''); setBack(''); setA(''); setB(''); };
  const collect = () => ({ type, text, front, back, a, b, pri });
  const canSave = type === 'cloze' ? /\{\{[^}]+\}\}/.test(text)
                : type === 'qa'   ? front.trim() && back.trim()
                : a.trim() && b.trim();

  const save = (again) => {
    if (!canSave) return;
    onSave(collect(), again);
    if (again) { clear(); if (ref.current) ref.current.focus(); }
  };

  // wrap the current selection (or caret) in {{ }} — ⌘B, keyboard-first
  const wrapCloze = () => {
    const el = ref.current; if (!el) return;
    const s = el.selectionStart, en = el.selectionEnd;
    const next = text.slice(0, s) + '{{' + text.slice(s, en) + '}}' + text.slice(en);
    setText(next);
    requestAnimationFrame(() => { if (ref.current) { ref.current.focus(); ref.current.selectionStart = s + 2; ref.current.selectionEnd = en + 2; } });
  };

  React.useEffect(() => {
    const onKey = (e) => {
      if (e.key === 'Escape') { e.preventDefault(); onClose(); }
      else if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) { e.preventDefault(); save(e.shiftKey); }
      else if (type === 'cloze' && (e.metaKey || e.ctrlKey) && (e.key === 'b' || e.key === 'B')) { e.preventDefault(); wrapCloze(); }
      else if ((e.metaKey || e.ctrlKey) && (e.key === '1' || e.key === '2' || e.key === '3')) { e.preventDefault(); setType(['cloze', 'qa', 'bidir'][+e.key - 1]); }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  });

  const rendered = (text || '').split(/(\{\{[^}]+\}\})/g).map((part, i) =>
    (part.startsWith('{{') && part.endsWith('}}'))
      ? <span key={i} className="cloze-mark">{part.slice(2, -2)}</span>
      : <React.Fragment key={i}>{part}</React.Fragment>);

  return (
    <div className="composer">
      <div className="hd">
        <span>new card</span>
        <div className="type-toggle">
          {[['cloze', 'cloze'], ['q&a', 'qa'], ['bidir', 'bidir']].map(([label, key], i) => (
            <button key={key} data-active={type === key ? '1' : '0'} title={`⌘${i + 1}`} onClick={() => setType(key)}>{label}<sup className="tt-num">{i + 1}</sup></button>
          ))}
        </div>
      </div>

      {type === 'cloze' && (
        <>
          <textarea ref={ref} value={text} onChange={(e) => setText(e.target.value)}
                    placeholder="passage" />
          <div className="preview"><span className="preview-tag">preview</span>
            {/\{\{[^}]+\}\}/.test(text) ? rendered : <span style={{ color: 'var(--fg-5)' }}><kbd className="kbd">⌘B</kbd> blank</span>}
          </div>
        </>
      )}
      {type === 'qa' && (
        <div className="qa-fields">
          <textarea ref={ref} value={front} onChange={(e) => setFront(e.target.value)} placeholder="question" />
          <textarea value={back} onChange={(e) => setBack(e.target.value)} placeholder="answer" />
        </div>
      )}
      {type === 'bidir' && (
        <div className="qa-fields">
          <input ref={ref} value={a} onChange={(e) => setA(e.target.value)} placeholder="term a" />
          <input value={b} onChange={(e) => setB(e.target.value)} placeholder="term b" />
        </div>
      )}

      <div className="ft">
        <span className="pri-pick">priority
          {[1, 2, 3].map(p => (
            <i key={p} data-on={p <= (4 - pri) ? '1' : '0'} onClick={() => setPri(4 - p)} />
          ))}
        </span>
        <span className="grow" />
        <span className="act" data-able={canSave ? '1' : '0'} onClick={() => save(false)}><kbd>⌘↵</kbd> save</span>
        <span>·</span>
        <span className="act" data-able={canSave ? '1' : '0'} onClick={() => save(true)}><kbd>⇧⌘↵</kbd> save, another</span>
        <span>·</span>
        <span className="act" onClick={onClose}><kbd>esc</kbd> cancel</span>
      </div>
    </div>
  );
}
