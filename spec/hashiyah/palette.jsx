// palette.jsx — ⌘K command palette. The keyboard spine.
// Fuzzy-open any source / card / saved view by name, plus run commands.
// Mono input, serif results. ↑↓ / ⌃n⌃p navigate, ⏎ run, esc close.

const SAVED_VIEWS = [
  { kind: 'queue', id: 'today',    title: 'due today',  tag: 'query' },
  { kind: 'queue', id: 'upcoming', title: 'upcoming',   tag: 'query' },
  { kind: 'view',  id: 'reading',  title: 'reading',    tag: 'query' },
  { kind: 'view',  id: 'writing',  title: 'writing',    tag: 'query' },
  { kind: 'view',  id: 'cards',    title: 'all cards',  tag: 'query' },
];

function buildIndex(store, commands) {
  const items = [];
  SAVED_VIEWS.forEach(v => items.push({ ...v, sub: 'saved query' }));
  walk(store.vault, (n, parent) => {
    if (n.type === 'folder' && !n.root) items.push({ kind: 'folder', id: n.id, title: n.name, tag: 'folder', sub: 'folder' });
    if (n.type === 'source') {
      items.push({ kind: 'source', id: n.id, title: n.name, tag: 'source', sub: parent ? parent.name : '' });
      (n.body || []).forEach(blk => {
        if (blk.kind === 'card') items.push({ kind: 'card', id: blk.id, title: cardLabel(blk), tag: 'card', sub: n.name });
      });
    }
    if (n.type === 'deck') {
      items.push({ kind: 'deck', id: n.id, title: n.name, tag: 'deck', sub: 'deck' });
      (n.body || []).forEach(blk => {
        if (blk.kind === 'card') items.push({ kind: 'card', id: blk.id, title: cardLabel(blk), tag: 'card', sub: n.name });
      });
    }
    if (n.type === 'draft') {
      items.push({ kind: 'draft', id: n.id, title: n.name, tag: 'draft', sub: parent ? parent.name : 'draft' });
      (n.body || []).forEach(blk => {
        if (blk.kind === 'extract') items.push({ kind: 'draft', id: n.id, focus: blk.id, title: blk.title || 'extract', tag: 'extract', sub: n.name });
      });
    }
  });
  commands.forEach(cmd => items.push({ ...cmd, isCommand: true, tag: 'command' }));
  return items;
}

function CommandPalette({ open, onClose, onOpen, commands }) {
  const store = useStore();
  const [q, setQ] = React.useState('');
  const [sel, setSel] = React.useState(0);
  const inputRef = React.useRef(null);
  const listRef = React.useRef(null);

  React.useEffect(() => {
    if (open) { setQ(''); setSel(0); setTimeout(() => inputRef.current && inputRef.current.focus(), 10); }
  }, [open]);

  const index = React.useMemo(() => open ? buildIndex(store, commands) : [], [open, store.vault]);

  const results = React.useMemo(() => {
    if (!q) return index.slice(0, 40);
    return index
      .map(it => ({ it, score: fuzzy(q, it.title + ' ' + (it.sub || '')) }))
      .filter(r => r.score >= 0)
      .sort((a, b) => a.score - b.score)
      .slice(0, 40)
      .map(r => r.it);
  }, [q, index]);

  React.useEffect(() => { setSel(0); }, [q]);
  React.useEffect(() => {
    if (listRef.current) {
      const el = listRef.current.querySelector('[data-sel="1"]');
      if (el && listRef.current.scrollTo) {
        const r = el.offsetTop, h = listRef.current.clientHeight, st = listRef.current.scrollTop;
        if (r < st) listRef.current.scrollTop = r;
        else if (r + el.offsetHeight > st + h) listRef.current.scrollTop = r + el.offsetHeight - h;
      }
    }
  }, [sel]);

  if (!open) return null;

  const run = (it) => {
    if (!it) return;
    onClose();
    if (it.isCommand) it.run();
    else onOpen({ kind: it.kind, id: it.id, title: it.title, focus: it.focus }, {});
  };

  const onKey = (e) => {
    if (e.key === 'Escape') { e.preventDefault(); onClose(); }
    else if (e.key === 'ArrowDown' || (e.ctrlKey && e.key === 'n')) { e.preventDefault(); setSel(s => Math.min(results.length - 1, s + 1)); }
    else if (e.key === 'ArrowUp' || (e.ctrlKey && e.key === 'p')) { e.preventDefault(); setSel(s => Math.max(0, s - 1)); }
    else if (e.key === 'Enter') { e.preventDefault(); run(results[sel]); }
  };

  return (
    <div className="palette-overlay" onMouseDown={onClose}>
      <div className="palette-panel" onMouseDown={(e) => e.stopPropagation()}>
        <div className="palette-input">
          <span className="g">⌕</span>
          <input ref={inputRef} value={q} onChange={(e) => setQ(e.target.value)} onKeyDown={onKey}
                 placeholder="open a source, card, view — or run a command…" spellCheck="false" />
          <kbd>esc</kbd>
        </div>
        <div className="palette-list" ref={listRef}>
          {results.length === 0 && <div className="palette-empty">nothing</div>}
          {results.map((it, i) => (
            <div key={it.kind + ':' + it.id + ':' + i} className="palette-row" data-sel={i === sel ? '1' : '0'}
                 data-t={it.tag}
                 onMouseEnter={() => setSel(i)} onClick={() => run(it)}>
              <span className="pg" data-t={it.tag}>
                {it.tag === 'command' ? '›' : it.tag === 'card' ? '◆' : it.tag === 'source' ? '⊞' : it.tag === 'deck' ? '◫' : it.tag === 'draft' ? '✎' : it.tag === 'extract' ? '❡' : it.tag === 'folder' ? '/' : '≡'}
              </span>
              <span className="pt">{it.title}</span>
              <span className="ptag">{it.tag}</span>
            </div>
          ))}
        </div>
        <div className="palette-foot">
          <span><kbd>↑↓</kbd> move</span><span className="dot" />
          <span><kbd>↵</kbd> open</span><span className="dot" />
          <span><kbd>esc</kbd> close</span>
          <span className="grow" />
          <span>{results.length} result{results.length === 1 ? '' : 's'}</span>
        </div>
      </div>
    </div>
  );
}
