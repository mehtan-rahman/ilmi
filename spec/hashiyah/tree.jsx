// tree.jsx — the editable workspace tree. The vault rendered as a folder tree;
// every row is a real node you can rename, move, delete, or nest.
//
//  · dbl-click / F2     inline rename
//  · right-click        context menu (new source · new folder · rename · delete · move to)
//  · drag               reorder among siblings, or drop INTO a folder to nest
//  · folders nest folders; sources hold cards; cards are span-pointers
//
// All edits go through the store, which mutates the one vault tree in place.

function collectFolders(vault) {
  const out = [];
  walk(vault, (n) => { if (n.type === 'folder') out.push(n); });
  return out;
}

// glyph for a card leaf, by its inline schedule
function cardLeafState(card) {
  return isDue(card.sched.due) ? 'due' : 'scheduled';
}

function WorkspaceTree({ activeKey, onOpen }) {
  const store = useStore();
  const vault = store.vault;
  const [editing, setEditing] = React.useState(null);   // { id, value }
  const [menu, setMenu] = React.useState(null);         // { id, node, x, y, sub }
  const [drag, setDrag] = React.useState(null);         // dragged id
  const [over, setOver] = React.useState(null);         // { id, mode }
  const [selected, setSelected] = React.useState(null); // id, for F2
  const editRef = React.useRef(null);
  const treeRef = React.useRef(null);
  const treeWidth = useWidth(treeRef);                   // pretext-style measurement
  const fonts = useResolvedFonts(treeRef);

  React.useEffect(() => {
    if (editing && editRef.current) { editRef.current.focus(); editRef.current.select(); }
  }, [editing && editing.id]);

  // close menu on any outside interaction / escape
  React.useEffect(() => {
    if (!menu) return;
    const close = () => setMenu(null);
    const onKey = (e) => { if (e.key === 'Escape') setMenu(null); };
    window.addEventListener('mousedown', close);
    window.addEventListener('keydown', onKey);
    return () => { window.removeEventListener('mousedown', close); window.removeEventListener('keydown', onKey); };
  }, [menu]);

  const isActive = (kind, id) => activeKey === `${kind}:${id}`;

  // F2 renames the selected (or active-tab) node
  React.useEffect(() => {
    const onKey = (e) => {
      if (e.key !== 'F2' || editing) return;
      const tag = (e.target.tagName || '').toLowerCase();
      if (tag === 'input' || tag === 'textarea') return;
      let id = selected;
      if (!id && activeKey) id = activeKey.split(':')[1];
      if (!id) return;
      const node = findNode(vault, id) || (findCard(vault, id) && findCard(vault, id).card);
      if (node) { e.preventDefault(); beginRename(node); }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [selected, activeKey, editing, vault]);

  const beginRename = (node) => setEditing({ id: node.id, value: node.name || cardLabel(node) });
  const commitRename = () => {
    if (editing) { store.renameNode(editing.id, editing.value); setEditing(null); }
  };

  const openMenu = (e, node) => {
    e.preventDefault(); e.stopPropagation();
    setMenu({ id: node.id, node, x: Math.min(e.clientX, window.innerWidth - 190), y: e.clientY, sub: false });
  };

  // ── drag + drop ──────────────────────────────────────────────
  const onDragStart = (e, node) => { setDrag(node.id); e.dataTransfer.effectAllowed = 'move'; try { e.dataTransfer.setData('text/plain', node.id); } catch (x) {} };
  const onDragOverRow = (e, node, isFolder) => {
    if (!drag || drag === node.id) return;
    e.preventDefault();
    const r = e.currentTarget.getBoundingClientRect();
    const y = e.clientY - r.top;
    let mode;
    if (isFolder) mode = y < r.height * 0.32 ? 'before' : y > r.height * 0.68 ? 'after' : 'into';
    else mode = y < r.height * 0.5 ? 'before' : 'after';
    if (!over || over.id !== node.id || over.mode !== mode) setOver({ id: node.id, mode });
  };
  const onDropRow = (e, node) => {
    e.preventDefault(); e.stopPropagation();
    if (drag && over) store.moveNode(drag, over.id, over.mode);
    setDrag(null); setOver(null);
  };
  const endDrag = () => { setDrag(null); setOver(null); };

  const overCls = (id) => (over && over.id === id) ? ('drop-' + over.mode) : '';

  // ── render one row (folder / source / card) ──────────────────
  // pretext-style fit: the name is identity (full whenever possible); the
  // card-info meta degrades to the richest variant that still fits the row.
  const renderRow = (node, depth, kind, meta) => {
    const editingThis = editing && editing.id === node.id;
    const pad = 6 + depth * 13;
    const labelStr = typeof meta.label === 'string' ? meta.label : '';
    const nameFont = kind === 'card' ? fonts.serif : fonts.name;
    const avail = (treeWidth || 240) - pad - 10 /*chev*/ - 12 /*glyph*/ - 18 /*gaps*/ - 14 /*pad-right + safety*/;
    const fitted = editingThis ? '' : fitMeta(meta.cands || [], labelStr, avail, fonts, nameFont);
    return (
      <div key={node.id} className={`row trow ${overCls(node.id)}`}
           style={{ paddingLeft: pad }}
           data-kind={kind}
           data-active={isActive(kind === 'folder' ? 'folder' : kind, node.id) ? '1' : '0'}
           data-graded={node.justGraded ? '1' : '0'}
           draggable={kind !== 'card' && !node.root && !editingThis}
           onDragStart={(e) => onDragStart(e, node)}
           onDragOver={(e) => onDragOverRow(e, node, kind === 'folder')}
           onDragLeave={() => { if (over && over.id === node.id) setOver(null); }}
           onDrop={(e) => onDropRow(e, node)}
           onDragEnd={endDrag}
           onContextMenu={(e) => openMenu(e, node)}
           onMouseDown={() => setSelected(node.id)}
           onDoubleClick={(e) => { e.stopPropagation(); beginRename(node); }}
           onClick={meta.onClick}>
        {meta.chev}
        <span className={`glyph ${meta.glyphCls || ''}`}>{meta.glyph}</span>
        {editingThis ? (
          <input className="rename" ref={editRef} value={editing.value}
                 onChange={(e) => setEditing({ ...editing, value: e.target.value })}
                 onMouseDown={(e) => e.stopPropagation()}
                 onClick={(e) => e.stopPropagation()}
                 onBlur={commitRename}
                 onKeyDown={(e) => {
                   if (e.key === 'Enter') { e.preventDefault(); commitRename(); }
                   else if (e.key === 'Escape') { e.preventDefault(); setEditing(null); }
                 }} />
        ) : (
          <span className="name" title={typeof meta.label === 'string' ? meta.label : undefined}>{meta.label}</span>
        )}
        {fitted && <span className={`meta ${meta.metaCls || ''}`} data-due={meta.dueCount ? '1' : '0'}>{fitted}</span>}
      </div>
    );
  };

  // ── generic node dispatch — one place every object type routes through.
  //    Adding a new type (a draft, say) is a single branch here. ──────────
  const renderNode = (node, depth) =>
    node.type === 'folder' ? renderFolder(node, depth)
      : node.type === 'deck' ? renderDeck(node, depth)
      : node.type === 'draft' ? renderDraft(node, depth)
      : renderSource(node, depth);

  // a card leaf — a marked span living inside ANY container (source, deck, or
  // a folder holding loose cards). The leaf is a pointer to that span.
  const renderCardLeaf = (card, container, depth) => {
    const st = cardLeafState(card);
    return renderRow(card, depth, 'card', {
      chev: <span className="chev" />,
      glyph: st === 'scheduled' ? '◇' : '◆', glyphCls: `card cd-${st}`,
      label: cardLabel(card),
      cands: [''], metaCls: 'ref',
      onClick: (e) => onOpen({ kind: 'card', id: card.id, title: cardLabel(card), source: container.id, browse: true }, { cmdClick: e.metaKey || e.ctrlKey, shiftClick: e.shiftKey }),
    });
  };

  // a folder holds any mix of nodes AND its own loose cards. Clicking the row
  // opens the folder as a lens (and reveals it); the chevron alone collapses.
  const renderFolder = (folder, depth) => {
    const open = folder.open;
    const children = folder.children || [];
    const looseCards = (folder.body || []).filter(b => b.kind === 'card');
    const looseDue = looseCards.filter(c => isDue(c.sched.due)).length;
    const count = children.length + looseCards.length;
    const hasContents = count > 0;
    const node = renderRow(folder, depth, 'folder', {
      chev: <span className="chev" onClick={(e) => { e.stopPropagation(); if (hasContents) store.toggleOpen(folder.id); }}>{hasContents ? (open ? '▾' : '▸') : ''}</span>,
      glyph: '/', glyphCls: folder.root ? 'fold root' : 'fold',
      label: folder.name,
      cands: looseDue ? [`${count} · ${looseDue} due`, `${count}`, ''] : [folder.root ? 'vault' : String(count || ''), ''],
      dueCount: looseDue,
      onClick: () => { store.toggleOpen(folder.id, true); onOpen({ kind: 'folder', id: folder.id, title: folder.name }, {}); },
    });
    return (
      <React.Fragment key={folder.id}>
        {node}
        {open && children.map(child => renderNode(child, depth + 1))}
        {open && looseCards.map(card => renderCardLeaf(card, folder, depth + 1))}
      </React.Fragment>
    );
  };

  const renderSource = (src, depth) => {
    const cards = (src.body || []).filter(b => b.kind === 'card');
    const kids = src.children || [];
    const hasContents = cards.length > 0 || kids.length > 0;
    const open = src.open && hasContents;
    const sm = sourceMetaCands(src);
    const node = renderRow(src, depth, 'source', {
      chev: <span className="chev" onClick={(e) => { e.stopPropagation(); if (hasContents) store.toggleOpen(src.id); }}>
              {hasContents ? (open ? '▾' : '▸') : ''}</span>,
      glyph: src.extract ? '↳' : '¶', glyphCls: src.extract ? 'file extract' : 'file',
      label: src.name,
      cands: sm.cands, dueCount: sm.due,
      onClick: () => onOpen({ kind: 'source', id: src.id, title: src.name }, {}),
    });
    return (
      <React.Fragment key={src.id}>
        {node}
        {open && kids.map(child => renderNode(child, depth + 1))}
        {open && cards.map(card => renderCardLeaf(card, src, depth + 1))}
      </React.Fragment>
    );
  };

  // a deck: loose cards, no prose. Renders like a source but its leaves are vocab/facts.
  const renderDeck = (deck, depth) => {
    const cards = (deck.body || []).filter(b => b.kind === 'card');
    const due = cards.filter(c => isDue(c.sched.due)).length;
    const open = deck.open && cards.length > 0;
    const node = renderRow(deck, depth, 'deck', {
      chev: <span className="chev" onClick={(e) => { e.stopPropagation(); if (cards.length) store.toggleOpen(deck.id); }}>
              {cards.length ? (open ? '▾' : '▸') : ''}</span>,
      glyph: '◫', glyphCls: 'file deck',
      label: deck.name,
      cands: [due ? `${cards.length} · ${due} due` : `${cards.length}`, `${cards.length}`, ''], dueCount: due,
      onClick: () => onOpen({ kind: 'deck', id: deck.id, title: deck.name }, {}),
    });
    return (
      <React.Fragment key={deck.id}>
        {node}
        {open && cards.map(card => renderCardLeaf(card, deck, depth + 1))}
      </React.Fragment>
    );
  };

  // a draft: your own document in spaced composition. A leaf — open it to write.
  const renderDraft = (draft, depth) => {
    const r = draft.write || {};
    const due = r && !r.done && isDue(r.due);
    const node = renderRow(draft, depth, 'draft', {
      chev: <span className="chev" />,
      glyph: '✎', glyphCls: 'file draft',
      label: draft.name,
      cands: r.done ? ['done', ''] : (due ? ['due', ''] : ['draft', '']),
      dueCount: due ? 1 : 0,
      onClick: () => onOpen({ kind: 'draft', id: draft.id, title: draft.name }, {}),
    });
    return <React.Fragment key={draft.id}>{node}</React.Fragment>;
  };

  // ── context menu ─────────────────────────────────────────────
  const menuNode = menu && menu.node;
  const parentFolderId = menu && (() => {
    if (menuNode.type === 'folder') return menuNode.id;
    if (menuNode.kind === 'card') {           // parent = the card's source's folder
      const fc = findCard(vault, menuNode.id);
      const p = fc && findParent(vault, fc.source.id);
      return (p && p.id) || vault.id;
    }
    if (menuNode.kind === 'extract') {        // parent = the extract's draft's folder
      const w = findWritable(vault, menuNode.id);
      const p = w && findParent(vault, w.draft.id);
      return (p && p.id) || vault.id;
    }
    const p = findParent(vault, menuNode.id);
    return (p && p.id) || vault.id;
  })();
  const isCardNode = menuNode && (menuNode.kind === 'card' || menuNode.kind === 'extract');

  const act = (fn) => (e) => { e.stopPropagation(); fn(); setMenu(null); };

  return (
    <div className="tree edit-tree" ref={treeRef} onContextMenu={(e) => { if (e.target.closest('.trow')) return; e.preventDefault(); openMenu(e, vault); }}>
      {renderFolder(vault, 0)}

      {menu && (
        <div className="ctx-menu" style={{ left: menu.x, top: menu.y }}
             onMouseDown={(e) => e.stopPropagation()} onContextMenu={(e) => e.preventDefault()}>
          {!menu.sub ? (
            <>
              <div className="ci" onClick={act(() => { const id = store.createSource(parentFolderId, 'untitled'); setTimeout(() => setEditing({ id, value: 'untitled' }), 0); })}>
                <span className="cg">⊞</span>new source</div>
              <div className="ci" onClick={act(() => { const id = store.createFolder(parentFolderId, 'untitled folder'); setTimeout(() => setEditing({ id, value: 'untitled folder' }), 0); })}>
                <span className="cg">/</span>new folder</div>
              <div className="ci" onClick={act(() => { const id = store.createDeck(parentFolderId, 'untitled deck'); setTimeout(() => setEditing({ id, value: 'untitled deck' }), 0); })}>
                <span className="cg">◫</span>new deck</div>
              <div className="ci" onClick={act(() => { const id = store.createDraft(parentFolderId, 'untitled draft'); setTimeout(() => setEditing({ id, value: 'untitled draft' }), 0); })}>
                <span className="cg">✎</span>new draft</div>
              <div className="ci" onClick={act(() => onOpen({ kind: 'folder', id: parentFolderId, title: (findNode(vault, parentFolderId) || vault).name, focus: 'compose' }, {}))}>
                <span className="cg">◆</span>new card</div>
              <div className="cd" />
              <div className="ci" onClick={act(() => beginRename(menuNode))}>
                <span className="cg">✎</span>rename<span className="ck">F2</span></div>
              {!isCardNode && (
                <div className="ci has-sub" onMouseEnter={() => setMenu(m => ({ ...m, sub: true }))}>
                  <span className="cg">→</span>move to…<span className="ck">▸</span></div>
              )}
              <div className="cd" />
              <div className="ci danger" onClick={act(() => store.deleteNode(menuNode.id))}>
                <span className="cg">⌫</span>{menuNode.type === 'folder' ? 'delete folder' : menuNode.type === 'source' ? 'delete source' : menuNode.type === 'deck' ? 'delete deck' : menuNode.type === 'draft' ? 'delete draft' : menuNode.kind === 'extract' ? 'delete extract' : (() => { const fc = findCard(vault, menuNode.id); return (fc && fc.source.type === 'source') ? 'remove annotation' : 'delete card'; })()}</div>
            </>
          ) : (
            <div className="sub-wrap" onMouseLeave={() => setMenu(m => ({ ...m, sub: false }))}>
              <div className="ci back" onClick={(e) => { e.stopPropagation(); setMenu(m => ({ ...m, sub: false })); }}>
                <span className="cg">◂</span>move to…</div>
              <div className="cd" />
              <div className="sub-scroll">
                {collectFolders(vault).filter(f => f.id !== menuNode.id && !isDescendant(menuNode, f.id)).map(f => (
                  <div key={f.id} className="ci" onClick={act(() => store.moveNode(menuNode.id, f.id, 'into'))}>
                    <span className="cg">/</span>{f.root ? 'notes (root)' : f.name}</div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
