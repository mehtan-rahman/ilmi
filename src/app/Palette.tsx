// ⌘K: open anything by name, or run a command. After the prototype's
// palette.jsx: mono input, serif results, ↑↓ or ⌃n ⌃p to move, ⏎ to open,
// esc to close.

import { useEffect, useMemo, useRef, useState } from 'react';
import { pluginCommands, runPluginCommand, usePlugins } from '../plugins/index.js';
import { overflow } from '../schedule/index.js';
import { ENTRY_GLYPH, buildIndex, rankHits, search, textEntry, withText, type Command, type Entry } from './chrome.js';
import { activeTab, closePane, splitPane } from './panes.js';
import { useApp } from './store.js';
import { MENU_ID, runMenu } from './menu.js';
import { hasCards, studyDeck } from './deckOps.js';
import { SESSION, folderPaths, slugName, titleOf } from './names.js';
import { nameOf, type TextHit } from '../vault/index.js';
import { attachCancelled, attachNewNote, attachNote, openNotes } from './book.js';
import { canMove, moveAction, moveSection, sectionActions, statusOf } from './sections.js';
import { plainMath } from './chromeText.js';
import type { CaretHeading } from './store.js';
import { MathText } from './MathText.js';
import { exportCollection } from './collections.js';
import { notify } from './land.js';
import { containerOf, currentVault, openBlock, openCard, openIntake, openNode, openVault, postponeRest, searchText, startSession, toggleInspector, toggleSidebar } from './vault.js';
import { appNow } from './clock.js';
import { Glyph } from './icons.js';

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
  { id: MENU_ID.open, title: 'import folder…' },
  { id: MENU_ID.new, title: 'new collection…' },
  { id: MENU_ID.close, title: 'close collection' },
  { id: MENU_ID.import, title: 'import…' },
  // the collection out as a vault again (milestone 59): a folder, or one zip
  { id: 'export-folder', title: 'export collection · folder' },
  { id: 'export-zip', title: 'export collection · zip' },
];

/** What an iPad's palette leaves out: a second pane, and what goes through a folder picker (a folder in, a new collection, an export). */
const DESKTOP_ONLY: ReadonlySet<string> = new Set(['split', 'close-pane', MENU_ID.open, MENU_ID.new, 'export-folder', 'export-zip']);

/** What a phone's leaves out beside those: the tree is behind the same button as the palette, and there is no inspector (milestone 56). */
const NOT_ON_A_PHONE: ReadonlySet<string> = new Set(['sidebar', 'inspector']);

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
  const act = sectionActions(statusOf(at.read), at, at.read)[0]!;
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
    else sectionActions(statusOf(at.read), at, at.read)[0]?.run?.();
    return;
  }
  switch (id) {
    case 'enter': startSession(); break;
    case 'postpone': void postponeRest().catch(console.error); break;
    case 'intake': openIntake(tab === undefined || tab.startsWith(':') ? '' : containerOf(tab)); break;
    case 'split': s.setPanes((p) => splitPane(p, p.active)); break;
    case 'close-pane': s.setPanes((p) => closePane(p, p.active)); break;
    case 'sidebar': toggleSidebar(); break;
    case 'inspector': toggleInspector(); break;
    case 'theme': s.cycleTheme(); break;
    case 'tweaks': useApp.setState({ tweaksOpen: true }); break;
    case 'export-folder':
    case 'export-zip': {
      const vault = currentVault();
      if (!vault) break;
      exportCollection(vault, id === 'export-zip' ? 'zip' : 'folder')
        .then((dest) => { if (dest) notify(`exported · ${dest}`); })
        .catch((e: unknown) => notify(`export · ${e instanceof Error ? e.message : String(e)}`));
      break;
    }
    case MENU_ID.open:
    case MENU_ID.new:
    case MENU_ID.close:
    case MENU_ID.import: void runMenu(id).catch(console.error); break;
    default: runPluginCommand(id);
  }
}

/** A row's name with what was found marked. */
function Marked({ title, mark }: { title: string; mark: [number, number] }) {
  return <span className="pt" dir="auto">{title.slice(0, mark[0])}<mark>{title.slice(mark[0], mark[1])}</mark>{title.slice(mark[1])}</span>;
}

export function Palette() {
  const tree = useApp((s) => s.tree);
  const docs = useApp((s) => s.docs);
  const queue = useApp((s) => s.queue);
  const plugins = usePlugins();
  const recents = useApp((s) => s.recents);
  const vault = useApp((s) => s.vault);
  const [q, setQ] = useState('');
  const [sel, setSel] = useState(0);
  // `study…` turns the list into the things that can be studied: a deck, a folder, a document with cards under it
  const [studying, setStudying] = useState(false);
  // `move to…` on a section (milestone 50): the list is the notes it can go to
  const moving = useApp((s) => s.sectionMove);
  // the note for a PDF on its own (milestone 70): one that is there, or a new one named as typed, then the folder it goes in
  const attaching = useApp((s) => s.noteAttach);
  const inputRef = useRef<HTMLInputElement>(null);
  const listRef = useRef<HTMLDivElement>(null);
  const close = () => useApp.setState({ paletteOpen: false, sectionMove: null, noteAttach: null });
  // closed with nothing picked: whoever asked for a note is told
  const dismiss = () => { if (attaching) attachCancelled(); close(); };

  // `postpone the rest` is offered only while there is a backlog (reading or writing due before today)
  // eslint-disable-next-line react-hooks/exhaustive-deps
  // the heading under the caret: come back, dismiss, or bring back its section
  const caret = useApp((s) => s.caretHeading);
  // an iPad has one pane and no folder to pick: its commands leave those out (`platform.ts`)
  const mobile = useApp((s) => s.mobile);
  const phone = useApp((s) => s.phone);
  const commands = useMemo(() => [...sectionCommand(), ...COMMANDS.filter((c) => (c.id !== 'postpone' || overflow(queue, appNow()).length > 0) && !(mobile && DESKTOP_ONLY.has(c.id)) && !(phone && NOT_ON_A_PHONE.has(c.id))), ...pluginCommands()], [queue, plugins?.version, caret, mobile, phone]);
  // the other vaults opened before, under `vaults`, so switching is two keys
  const vaults = useMemo(() => recents.filter((r) => r.path !== vault).map((r) => ({ path: r.path, name: r.name })), [recents, vault]);
  const index = useMemo(() => buildIndex(tree, docs, commands, vaults), [tree, docs, commands, vaults]);
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
  const attachIndex = useMemo((): Entry[] => {
    if (!attaching) return [];
    if (attaching.step === 'place') {
      return folderPaths(tree).map((f) => ({ key: `in:${f}`, title: f === '' ? titleOf('', docs, vault) : f, sub: '', tag: 'folder' as const, target: { command: `attach-in:${f}` } }));
    }
    // notes that are there and are no PDF's yet, nor a document with pages
    return Object.entries(docs)
      .filter(([path, info]) => info.type === 'note' && info.of === undefined && info.pdf === undefined && path.endsWith('.md'))
      .map(([path, info]) => ({ key: `at:${path}`, title: info.title ?? slugName(nameOf(path)), sub: path.replace(/\.md$/, ''), tag: 'note' as const, target: { command: `attach:${path}` } }));
  }, [attaching, tree, docs, vault]);
  /** The new note's name: as typed, else after the PDF. */
  const newName = attaching ? (attaching.step === 'place' ? attaching.name ?? '' : q.trim() || `${titleOf(attaching.pdf, docs, vault)} notes`) : '';
  // words in the documents and the cards, for the palette's own list; the last answer stays until the next, so the rows do not blink
  const asking = !attaching && !moving && !studying ? q.trim() : '';
  const [found, setFound] = useState<{ q: string; hits: TextHit[] } | null>(null);
  useEffect(() => {
    if (!asking) { setFound(null); return; }
    let live = true;
    void searchText(asking).then((hits) => { if (live) setFound({ q: asking, hits }); }).catch(console.error);
    return () => { live = false; };
  }, [asking, vault]);
  const texts = useMemo(() => (found ? rankHits(found.hits, found.q).map((h) => textEntry(h, found.q, docs)) : []), [found, docs]);
  const results = useMemo(() => {
    if (attaching?.step === 'pick') return [{ key: 'at:new', title: 'new note', sub: newName, tag: 'note' as const, target: { command: 'attach-new' } }, ...search(attachIndex, q)];
    const names = search(attaching ? attachIndex : moving ? moveIndex : studying ? studyIndex : index, q);
    return asking ? withText(names, texts, q) : names;
  }, [attaching, attachIndex, newName, moving, moveIndex, studying, studyIndex, index, q, asking, texts]);
  // `nothing` is said once the index has answered, and until it has been through every document it may yet
  const reading = useApp((s) => s.searchShare);

  useEffect(() => { inputRef.current?.focus(); }, []);
  // esc closes from anywhere, not only from the field
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') { e.preventDefault(); dismiss(); } };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [attaching]);
  useEffect(() => { setSel(0); }, [q, studying, moving, attaching]);
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
    if (attaching && 'command' in t) {
      const pdf = attaching.pdf;
      if (t.command === 'attach-new') { useApp.setState({ noteAttach: { pdf, step: 'place', name: newName } }); setQ(''); inputRef.current?.focus(); return; }
      if (t.command.startsWith('attach:')) { close(); void attachNote(pdf, t.command.slice(7)).catch(console.error); return; }
      if (t.command.startsWith('attach-in:')) { close(); void attachNewNote(pdf, newName, t.command.slice(10)).catch(console.error); return; }
    }
    close();
    if ('command' in t) runCommand(t.command);
    else if ('vault' in t) void openVault(t.vault).catch(console.error);
    else if (!currentVault()) return;
    else if ('block' in t || 'index' in t) {
      if ('block' in t) openBlock(t.open, t.block);
      else openCard(t.open, t.index, t.id);
      // a document with pages opens on its pages: what was found is in its text, beside them
      if (useApp.getState().docs[t.open]?.pdf !== undefined) void openNotes(t.open).catch(console.error);
    } else openNode(t.open);
  };

  const onKey = (e: React.KeyboardEvent) => {
    if (e.key === 'ArrowDown' || (e.ctrlKey && e.key === 'n')) { e.preventDefault(); setSel((s) => Math.min(results.length - 1, s + 1)); }
    else if (e.key === 'ArrowUp' || (e.ctrlKey && e.key === 'p')) { e.preventDefault(); setSel((s) => Math.max(0, s - 1)); }
    else if (e.key === 'Enter') { e.preventDefault(); run(results[sel]); }
  };

  return (
    <div className="palette-overlay" onMouseDown={dismiss}>
      <div className="palette-panel" onMouseDown={(e) => e.stopPropagation()}>
        <div className="palette-input">
          <span className="g"><Glyph g="⌕" /></span>
          <input dir="auto" ref={inputRef} value={q} onChange={(e) => setQ(e.target.value)} onKeyDown={onKey} placeholder={attaching?.step === 'place' ? `${newName} in…` : attaching ? `notes on ${titleOf(attaching.pdf, docs, vault).slice(0, 40)}` : moving ? `move § ${plainMath(moving.text).slice(0, 40)} to…` : studying ? 'study…' : 'open or run'} spellCheck={false} />
          <kbd>esc</kbd>
        </div>
        <div className="palette-list" ref={listRef} data-found={found?.q}>
          {results.length === 0 && (!asking || found?.q === asking) && <div className="palette-empty">{asking && reading < 1 ? 'nothing yet' : 'nothing'}</div>}
          {results.map((it, i) => (
            <div key={it.key} className="palette-row" data-sel={i === sel ? '1' : '0'} data-t={it.tag} onMouseEnter={() => setSel(i)} onClick={() => run(it)}>
              <span className="pg" data-t={it.tag}><Glyph g={ENTRY_GLYPH[it.tag]} /></span>
              {it.mark ? <Marked title={it.title} mark={it.mark} /> : <MathText className="pt" dir="auto" text={it.math ?? it.title} />}
              <MathText className="psub" dir="auto" text={it.sub} />
              <span className="ptag">{it.tag}</span>
            </div>
          ))}
        </div>
        <div className="palette-foot">
          <span className="hint"><kbd>↑↓</kbd> <span className="hw">move</span></span>
          <span className="hint"><kbd>↵</kbd> <span className="hw">open</span></span>
          <span className="hint"><kbd>esc</kbd> <span className="hw">close</span></span>
          <span className="grow" />
          {reading < 1 && <span>{Math.round(reading * 100)}% read</span>}
          <span>{results.length}</span>
        </div>
      </div>
    </div>
  );
}
