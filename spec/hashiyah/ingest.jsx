// ingest.jsx — the source intake surface. (tab kind 'intake')
// How a raw article / PDF / paste enters the workspace and becomes a chunkable
// source. Deliberately no upload-chrome theater: no progress bars, no parsing
// spinner, no "drag files here" dropzone shouting for attention. You paste or
// drop, name it, choose where it lives, and it lands un-read. Nothing is
// scheduled, nothing is due. It waits until you open it.

function deriveTitle(text) {
  const line = (text || '').split('\n').map(s => s.trim()).find(Boolean) || '';
  return line.replace(/^#+\s*/, '').slice(0, 64);
}

function Intake({ onOpen, active }) {
  const store = useStore();
  const [raw, setRaw] = React.useState('');
  const [title, setTitle] = React.useState('');
  const [folder, setFolder] = React.useState('papers');
  const [drag, setDrag] = React.useState(false);
  const taRef = React.useRef(null);

  const trimmed = raw.trim();
  const words = trimmed ? trimmed.split(/\s+/).length : 0;
  const paras = trimmed ? trimmed.split(/\n{2,}/).filter(s => s.trim()).length : 0;
  const readMin = Math.max(1, Math.round(words / 220));
  const titleShown = title || deriveTitle(raw);
  const can = words > 0;

  const folders = (store.vault.children || []).filter(f => f.type === 'folder').map(f => f.name);

  React.useEffect(() => { if (active && taRef.current) taRef.current.focus(); }, [active]);

  const ingestText = (text, name) => {
    setRaw(text);
    if (!title) setTitle(name ? name.replace(/\.(txt|md|markdown|text|rtf)$/i, '') : deriveTitle(text));
  };

  const onDrop = async (e) => {
    e.preventDefault(); setDrag(false);
    const dt = e.dataTransfer;
    const file = dt && dt.files && dt.files[0];
    if (file) {
      try { ingestText(await file.text(), file.name); }
      catch { setTitle(file.name); setRaw(''); }
      return;
    }
    const t = dt && dt.getData && dt.getData('text');
    if (t) ingestText(t);
  };

  const place = (open) => {
    if (!can) return;
    const t = (titleShown || 'untitled source').trim();
    const id = store.ingestSource({ title: t, folder, raw });
    setRaw(''); setTitle('');
    if (open) onOpen({ kind: 'source', id, title: t }, {});
  };

  return (
    <div className={`intake-wrap ${drag ? 'dragging' : ''}`}
         onDragOver={(e) => { e.preventDefault(); if (!drag) setDrag(true); }}
         onDragLeave={(e) => { if (e.currentTarget === e.target) setDrag(false); }}
         onDrop={onDrop}>
      <div className="intake">
        <div className="meta">
          <span className="crumb">intake</span>
        </div>
        <h1>Add a source</h1>
        <p className="lede">Paste text or a link below, or drop a text file onto this panel.
          It stays unread until you open it.</p>

        <div className="paste-field">
          <textarea ref={taRef} value={raw} spellCheck="false"
                    onChange={(e) => setRaw(e.target.value)}
                    placeholder="paste here · ⌘V" />
          {!raw && (
            <div className="paste-hint">
              <span>nothing yet · paste, or drop a <span className="mono">.txt</span> / <span className="mono">.md</span> file</span>
              <button type="button" className="link" onClick={() => ingestText(INTAKE_SAMPLE)}>use a sample →</button>
            </div>
          )}
        </div>

        {can && (
          <div className="intake-detail">
            <div className="stats">
              <span><b>{words.toLocaleString()}</b> words</span>
              <span className="dot" />
              <span><b>{paras}</b> paragraph{paras === 1 ? '' : 's'}</span>
              <span className="dot" />
              <span>~{readMin} min to read</span>
              <span className="dot" />
              <span>unread</span>
            </div>

            <label className="field">
              <span className="flbl">title</span>
              <input value={titleShown} onChange={(e) => setTitle(e.target.value)} spellCheck="false" />
            </label>

            <div className="field">
              <span className="flbl">lives in</span>
              <div className="folder-pick">
                {folders.map(f => (
                  <button key={f} type="button" data-active={folder === f ? '1' : '0'}
                          onClick={() => setFolder(f)}>{f}</button>
                ))}
              </div>
            </div>

            <div className="place-row">
              <button type="button" className="place primary" onClick={() => place(true)}>
                place &amp; open <span className="sub">read now</span>
              </button>
              <button type="button" className="place" onClick={() => place(false)}>
                place &amp; leave it <span className="sub">save for later</span>
              </button>
            </div>
          </div>
        )}
      </div>

      {drag && <div className="drop-veil"><span>drop to bring it in</span></div>}
    </div>
  );
}