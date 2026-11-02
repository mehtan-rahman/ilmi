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
import { hasCards, studyDeck } from './deckOps.js';
import { SESSION, folderPaths } from './names.js';
import { canMove, moveAction, moveSection, sectionActions, statusOf } from './sections.js';
import { plainMath } from './chromeText.js';
import type { CaretHeading } from './store.js';
import { MathText } from './MathText.js';
import { containerOf, currentVault, openCard, openIntake, openNode, openVault, postponeRest, setSidebar, startSession, toggleInspector } from './vault.js';
import { appNow } from './clock.js';

const COMMANDS: Command[] = [
  { id: 'enter', title: 'enter queue' },
  { id: 'study', title: 'study…' },
  { id: 'postpone', title: 'postpone the rest' },
  { id: 'intake', title: 'add from text or a link' },
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

/** The heading the caret is under on the page in front (a tab, or the session's element), when there is one. */
function caretHere(): CaretHeading | null {
  const s = useApp.getState();
  const tab = activeTab(s.panes)?.id;
  const path = tab === SESSION ? s.sessionEl?.item.path : tab;
  return s.caretHeading && s.caretHeading.path === path ? s.caretHeading : null;
}

/** The section command the caret's heading offers, named as the inspector and its menu name it. */
function sectionCommand(): Command[] {
  const at = caretHere();
  if (!at) return [];
  const act = sectionActions(statusOf(at.read), at)[0]!;
  const mv = moveAction(at);
  return [{ id: `section:${act.act}`, title: `${act.label} · ${plainMath(at.text)}` }, ...(canMove(at.path) ? [{ id: `section:${mv.act}`, title: `${mv.label} · ${plainMath(at.text)}` }] : [])];
}

function runCommand(id: string): void {
  const s = useApp.getState();
  const tab = activeTab(s.panes)?.id;
  if (id.startsWith('section:')) {
    const at = caretHere();
    if (!at) return;
    if (id === 'section:move-to') moveAction(at).run?.();
    else sectionActions(statusOf(at.read), at)[0]?.run?.();
    return;
  }
  switch (id) {
    case 'enter': startSession(); break;
    case 'postpone': void postponeRest().catch(console.error); break;
    case 'intake': openIntake(tab === undefined || tab.startsWith(':') ? '' : containerOf(tab)); break;
    case 'split': s.setPanes((p) => splitPane(p, p.active)); break;
    case 'close-pane': s.setPanes((p) => closePane(p, p.active)); break;
    case 'sidebar': setSidebar({ hidden: !s.sidebar.hidden }); break;
    case 'inspector': toggleInspector(); break;
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
  // `study…` turns the list into the things that can be studied: a deck, a folder, a document with cards under it
  const [studying, setStudying] = useState(false);
  // `move to…` on a section (milestone 50): the list is the notes it can go to
  const moving = useApp((s) => s.sectionMove);
  const inputRef = useRef<HTMLInputElement>(null);
  const listRef = useRef<HTMLDivElement>(null);
  const close = () => useApp.setState({ paletteOpen: false, sectionMove: null });

  // `postpone the rest` is offered only while something sits below the fold
  // eslint-disable-next-line react-hooks/exhaustive-deps
  // the heading under the caret: come back, dismiss, or bring back its section
  const caret = useApp((s) => s.caretHeading);
  const commands = useMemo(() => [...sectionCommand(), ...(overflow(queue, appNow(), budget).length ? COMMANDS : COMMANDS.filter((c) => c.id !== 'postpone')), ...pluginCommands()], [queue, budget, plugins?.version, caret]);
  // the other vaults opened before, under `vaults`, so switching is two keys
  const vaults = useMemo(() => recents.filter((r) => r.path !== vault).map((r) => ({ path: r.path, name: r.name })), [recents, vault]);
  const index = useMemo(() => buildIndex(tree, docs, cardRefs(), commands, vaults), [tree, docs, commands, vaults]);
  const studyIndex = useMemo((): Entry[] => {
    if (!studying) return [];
    const out: Entry[] = [];
    const add = (path: string, tag: Entry['tag'], title: string) => {
      if (hasCards(path)) out.push({ key: `s:${path}`, title, sub: 'study', tag, target: { command: `study:${path}` } });
    };
    for (const f of folderPaths(tree)) add(f, 'folder', f === '' ? 'the whole collection' : f);
    for (const [path, info] of Object.entries(docs)) add(path, info.type, info.title ?? path.replace(/\.md$/, ''));
    return out;
  }, [studying, tree, docs]);
  const moveIndex = useMemo((): Entry[] => {
    if (!moving) return [];
    return Object.entries(docs)
      .filter(([path, info]) => info.type === 'note' && path !== moving.path)
      .map(([path, info]) => ({ key: `mv:${path}`, title: info.title ?? path.replace(/\.md$/, '').split('/').pop() ?? path, sub: path.replace(/\.md$/, ''), tag: 'note' as const, target: { command: `move:${path}` } }));
  }, [moving, docs]);
  const results = useMemo(() => search(moving ? moveIndex : studying ? studyIndex : index, q), [moving, moveIndex, studying, studyIndex, index, q]);

  useEffect(() => { inputRef.current?.focus(); }, []);
  // esc closes from anywhere, not only from the field
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') { e.preventDefault(); close(); } };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);
  useEffect(() => { setSel(0); }, [q, studying, moving]);
  useEffect(() => {
    const list = listRef.current;
    const el = list?.querySelector<HTMLElement>('[data-sel="1"]');
    if (!list || !el) return;
    if (el.offsetTop < list.scrollTop) list.scrollTop = el.offsetTop;
    else if (el.offsetTop + el.offsetHeight > list.scrollTop + list.clientHeight) list.scrollTop = el.offsetTop + el.offsetHeight - list.clientHeight;
  }, [sel]);

  const run = (it: Entry | undefined) => {
    if (!it) return;
    const t = it.target;
    if ('command' in t && t.command === 'study') { setStudying(true); setQ(''); inputRef.current?.focus(); return; }
    if ('command' in t && t.command.startsWith('study:')) { close(); studyDeck(t.command.slice(6)); return; }
    if ('command' in t && t.command.startsWith('move:') && moving) { close(); void moveSection(moving, t.command.slice(5)).catch(console.error); return; }
    close();
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
          <input dir="auto" ref={inputRef} value={q} onChange={(e) => setQ(e.target.value)} onKeyDown={onKey} placeholder={moving ? `move § ${plainMath(moving.text).slice(0, 40)} to…` : studying ? 'study…' : 'open or run'} spellCheck={false} />
          <kbd>esc</kbd>
        </div>
        <div className="palette-list" ref={listRef}>
          {results.length === 0 && <div className="palette-empty">nothing</div>}
          {results.map((it, i) => (
            <div key={it.key} className="palette-row" data-sel={i === sel ? '1' : '0'} data-t={it.tag} onMouseEnter={() => setSel(i)} onClick={() => run(it)}>
              <span className="pg" data-t={it.tag}>{ENTRY_GLYPH[it.tag]}</span>
              <MathText className="pt" dir="auto" text={it.math ?? it.title} />
              <MathText className="psub" dir="auto" text={it.sub} />
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
