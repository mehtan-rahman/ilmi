// ⌘K: open anything by name, or run a command. After the prototype's
// palette.jsx: mono input, serif results, ↑↓ or ⌃n ⌃p to move, ⏎ to open,
// esc to close.

import { useEffect, useMemo, useRef, useState } from 'react';
import { pluginCommands, runPluginCommand, usePlugins } from '../plugins/index.js';
import { overflow } from '../schedule/index.js';
import { ENTRY_GLYPH, buildIndex, search, type CardRef, type Command, type Entry } from './chrome.js';
import { activeTab, closePane, splitPane } from './panes.js';
import { useApp } from './store.js';
import { MENU_ID, runMenu } from './menu.js';
import { containerOf, currentVault, openCard, openIntake, openNode, openVault, postponeRest, setInspector, setSidebar, startSession } from './vault.js';

const COMMANDS: Command[] = [
  { id: 'enter', title: 'enter queue' },
  { id: 'postpone', title: 'postpone the rest' },
  { id: 'intake', title: 'add a source' },
  { id: 'split', title: 'split pane' },
  { id: 'close-pane', title: 'close pane' },
  { id: 'sidebar', title: 'sidebar' },
  { id: 'inspector', title: 'inspector' },
  { id: 'theme', title: 'next theme' },
  { id: 'tweaks', title: 'tweaks' },
  // the File menu's four, by the same ids, so there is a path without the native menu
  { id: MENU_ID.open, title: 'open collection…' },
  { id: MENU_ID.new, title: 'new collection…' },
  { id: MENU_ID.close, title: 'close collection' },
  { id: MENU_ID.import, title: 'import…' },
];

function runCommand(id: string): void {
  const s = useApp.getState();
  const tab = activeTab(s.panes)?.id;
  switch (id) {
    case 'enter': startSession(); break;
    case 'postpone': void postponeRest().catch(console.error); break;
    case 'intake': openIntake(tab === undefined || tab.startsWith(':') ? '' : containerOf(tab)); break;
    case 'split': s.setPanes((p) => splitPane(p, p.active)); break;
    case 'close-pane': s.setPanes((p) => closePane(p, p.active)); break;
    case 'sidebar': setSidebar({ hidden: !s.sidebar.hidden }); break;
    case 'inspector': setInspector({ open: !s.inspector.open }); break;
    case 'theme': s.cycleTheme(); break;
    case 'tweaks': useApp.setState({ tweaksOpen: true }); break;
    case MENU_ID.open:
    case MENU_ID.new:
    case MENU_ID.close:
    case MENU_ID.import: void runMenu(id).catch(console.error); break;
    default: runPluginCommand(id);
  }
}

/** Every card in the vault, from the queue's view of it (one entry per card, not per blank). */
function cardRefs(): CardRef[] {
  const seen = new Set<string>();
  const out: CardRef[] = [];
  for (const i of useApp.getState().queue) {
    if (i.kind !== 'card') continue;
    const k = `${i.path}:${i.block}`;
    if (seen.has(k)) continue;
    seen.add(k);
    out.push(i.id === undefined ? { path: i.path, index: i.block, text: i.text } : { path: i.path, index: i.block, id: i.id, text: i.text });
  }
  return out;
}

export function Palette() {
  const tree = useApp((s) => s.tree);
  const docs = useApp((s) => s.docs);
  const queue = useApp((s) => s.queue);
  const budget = useApp((s) => s.budget);
  const plugins = usePlugins();
  const recents = useApp((s) => s.recents);
  const vault = useApp((s) => s.vault);
  const [q, setQ] = useState('');
  const [sel, setSel] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);
  const listRef = useRef<HTMLDivElement>(null);
  const close = () => useApp.setState({ paletteOpen: false });

  // `postpone the rest` is offered only while something sits below the fold
  // eslint-disable-next-line react-hooks/exhaustive-deps
  const commands = useMemo(() => [...(overflow(queue, new Date(), budget).length ? COMMANDS : COMMANDS.filter((c) => c.id !== 'postpone')), ...pluginCommands()], [queue, budget, plugins?.version]);
  // the other vaults opened before, under `vaults`, so switching is two keys
  const vaults = useMemo(() => recents.filter((r) => r.path !== vault).map((r) => ({ path: r.path, name: r.name })), [recents, vault]);
  const index = useMemo(() => buildIndex(tree, docs, cardRefs(), commands, vaults), [tree, docs, commands, vaults]);
  const results = useMemo(() => search(index, q), [index, q]);

  useEffect(() => { inputRef.current?.focus(); }, []);
  // esc closes from anywhere, not only from the field
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') { e.preventDefault(); close(); } };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);
  useEffect(() => { setSel(0); }, [q]);
  useEffect(() => {
    const list = listRef.current;
    const el = list?.querySelector<HTMLElement>('[data-sel="1"]');
    if (!list || !el) return;
    if (el.offsetTop < list.scrollTop) list.scrollTop = el.offsetTop;
    else if (el.offsetTop + el.offsetHeight > list.scrollTop + list.clientHeight) list.scrollTop = el.offsetTop + el.offsetHeight - list.clientHeight;
  }, [sel]);

  const run = (it: Entry | undefined) => {
    if (!it) return;
    close();
    const t = it.target;
    if ('command' in t) runCommand(t.command);
    else if ('vault' in t) void openVault(t.vault).catch(console.error);
    else if (!currentVault()) return;
    else if ('index' in t) openCard(t.open, t.index, t.id);
    else openNode(t.open);
  };

  const onKey = (e: React.KeyboardEvent) => {
    if (e.key === 'ArrowDown' || (e.ctrlKey && e.key === 'n')) { e.preventDefault(); setSel((s) => Math.min(results.length - 1, s + 1)); }
    else if (e.key === 'ArrowUp' || (e.ctrlKey && e.key === 'p')) { e.preventDefault(); setSel((s) => Math.max(0, s - 1)); }
    else if (e.key === 'Enter') { e.preventDefault(); run(results[sel]); }
  };

  return (
    <div className="palette-overlay" onMouseDown={close}>
      <div className="palette-panel" onMouseDown={(e) => e.stopPropagation()}>
        <div className="palette-input">
          <span className="g">⌕</span>
          <input ref={inputRef} value={q} onChange={(e) => setQ(e.target.value)} onKeyDown={onKey} placeholder="open or run" spellCheck={false} />
          <kbd>esc</kbd>
        </div>
        <div className="palette-list" ref={listRef}>
          {results.length === 0 && <div className="palette-empty">nothing</div>}
          {results.map((it, i) => (
            <div key={it.key} className="palette-row" data-sel={i === sel ? '1' : '0'} data-t={it.tag} onMouseEnter={() => setSel(i)} onClick={() => run(it)}>
              <span className="pg" data-t={it.tag}>{ENTRY_GLYPH[it.tag]}</span>
              <span className="pt">{it.title}</span>
              <span className="psub">{it.sub}</span>
              <span className="ptag">{it.tag}</span>
            </div>
          ))}
        </div>
        <div className="palette-foot">
          <span><kbd>↑↓</kbd> move</span><span className="dot" />
          <span><kbd>↵</kbd> open</span><span className="dot" />
          <span><kbd>esc</kbd> close</span>
          <span className="grow" />
          <span>{results.length}</span>
        </div>
      </div>
    </div>
  );
}
