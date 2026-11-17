// ⌘K: open anything by name, or run a command. After the prototype's
// palette.jsx: mono input, serif results, ↑↓ or ⌃n ⌃p to move, ⏎ to open,
// esc to close.

import { useEffect, useMemo, useRef, useState } from 'react';
import { pluginCommands, runPluginCommand, usePlugins } from '../plugins/index.js';
import { overflow } from '../schedule/index.js';
import { ENTRY_GLYPH, buildIndex, contentsRows, placeRows, rankHits, search, searchContents, textEntry, withText, type Command, type Entry } from './chrome.js';
import { activeTab, closePane, splitPane } from './panes.js';
import { useApp } from './store.js';
import { MENU_ID, runMenu } from './menu.js';
import { hasCards, studyDeck } from './deckOps.js';
import { SESSION, WRITTEN_GLYPH, folderPaths, slugName, titleOf } from './names.js';
import { createWritten, whenKnown } from './written.js';
import { NEW_NAMES, nameOf, type TextHit } from '../vault/index.js';
import { MARK_LIST_EMPTY, attachCancelled, attachNewNote, attachNote, bookInFront, followed, lensOf, markList, openNotes, pdfHashOf, takeContents, togglePortalsBeside, type BookContents, type MarkList, type PlaceRow } from './book.js';
import { canMove, moveAction, moveSection, sectionActions, statusOf } from './sections.js';
import { plainMath } from './chromeText.js';
import type { CaretHeading } from './store.js';
import { MathText } from './MathText.js';
import { exportCollection } from './collections.js';
import { notify, failed } from './land.js';
import { closeTabs, containerOf, createNode, currentVault, openBlock, openCard, openDir, openIntake, openNode, openVault, postponeRest, rememberTab, searchText, startSession, toggleInspector, toggleSidebar } from './vault.js';
import { appNow } from './clock.js';
import { openCollectionNumbers } from './NumbersLens.js';
import { Glyph } from './icons.js';

const COMMANDS: Command[] = [
  { id: 'enter', title: 'enter queue' },
  { id: 'study', title: 'study…' },
  { id: 'postpone', title: 'postpone the rest' },
  // the whole collection's year of days and what is coming (`NumbersLens.tsx`)
  { id: 'numbers', title: 'numbers · the whole collection' },
  { id: 'intake', title: 'add from text or a link' },
  // a note, or written notes (milestone 82), beside what is in front; it opens
  { id: 'new-note', title: 'new note' },
  { id: 'new-written', title: 'new written notes' },
  { id: 'split', title: 'split pane' },
  { id: 'close-pane', title: 'close pane' },
  { id: 'sidebar', title: 'sidebar' },
  { id: 'inspector', title: 'inspector' },
  { id: 'theme', title: 'next theme' },
  { id: 'tweaks', title: 'settings' },
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

/** `contents · <book>`, while a book's pages are in the pane in front (milestone 76): its outline as a list, as `t` there opens it. */
function contentsCommand(): Command[] {
  const book = bookInFront();
  const s = useApp.getState();
  // a written notebook has no outline and no text to make one from
  if (book === null || s.docs[book]?.written) return [];
  return [{ id: 'contents', title: `contents · ${titleOf(book, s.docs, s.vault)}` }];
}

/** The lists of what is left in books (milestone 77): the book in front's bookmarks and highlights, and its portals shown beside; every book's bookmarks; the marks by a letter. */
const MARK_LISTS: Record<string, MarkList> = { 'bookmarks-here': 'bookmarks', 'highlights-here': 'highlights', 'passages-here': 'passages', 'bookmarks-all': 'all-bookmarks', marks: 'marks' };
const MARK_LIST_NAME: Record<MarkList, string> = { bookmarks: 'bookmarks', highlights: 'highlights', passages: 'passages', 'all-bookmarks': 'bookmarks', marks: 'marks' };
function marksCommands(): Command[] {
  const s = useApp.getState();
  if (!s.vault) return [];
  const book = bookInFront();
  const here = book !== null && pdfHashOf(book) !== null ? titleOf(book, s.docs, s.vault) : null;
  return [
    // a written notebook's sheets hold passages, and nothing a PDF's text gives
    ...(here !== null && s.docs[book!]?.written ? [{ id: 'passages-here', title: `passages · ${here}` }] : here !== null ? [
      { id: 'bookmarks-here', title: `bookmarks · ${here}` },
      { id: 'highlights-here', title: `highlights · ${here}` },
      { id: 'passages-here', title: `passages · ${here}` },
      // a second pane: not on an iPad or a phone, where a portal's mark peeks
      ...(s.mobile ? [] : [{ id: 'portals-beside', title: followed(book!) ? `portals beside · close · ${here}` : `portals beside · ${here}` }]),
    ] : []),
    { id: 'bookmarks-all', title: 'bookmarks' },
    { id: 'marks', title: 'marks' },
  ];
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
    case 'enter': startSession({}, null, useApp.getState().queueFocus); break;
    case 'postpone': void postponeRest().catch(failed('that')); break;
    case 'intake': openIntake(tab === undefined || tab.startsWith(':') ? '' : containerOf(tab)); break;
    case 'new-note':
    case 'new-written': {
      const dir = tab === undefined || tab.startsWith(':') ? '' : containerOf(tab);
      void (id === 'new-note' ? createNode(dir, 'note') : createWritten(dir, NEW_NAMES.note).then(whenKnown)).then((path) => { openDir(dir); openNode(path); }).catch(failed('that'));
      break;
    }
    case 'split': s.setPanes((p) => splitPane(p, p.active)); rememberTab(); break;
    case 'close-pane': closeTabs((p) => closePane(p, p.active)); break;
    case 'sidebar': toggleSidebar(); break;
    case 'inspector': toggleInspector(); break;
    case 'theme': s.cycleTheme(); break;
    case 'tweaks': useApp.setState({ tweaksOpen: true }); break;
    case 'numbers': openCollectionNumbers(); break;
    case 'portals-beside': { const book = bookInFront(); if (book !== null) togglePortalsBeside(book); break; }
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
    case MENU_ID.import: void runMenu(id).catch(failed('that')); break;
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
  const gone = useApp((s) => s.gone);
  const vault = useApp((s) => s.vault);
  const [q, setQ] = useState('');
  const [sel, setSel] = useState(0);
  // `study…` turns the list into the things that can be studied: a deck, a folder, a document with cards under it
  const [studying, setStudying] = useState(false);
  // `move to…` on a section (milestone 50): the list is the notes it can go to
  const moving = useApp((s) => s.sectionMove);
  // the note for a PDF on its own (milestone 70): one that is there, or a new one named as typed, then the folder it goes in
  const attaching = useApp((s) => s.noteAttach);
  // a book's contents (milestone 76): opened here by `t` over its pages, or by the command; the list is the PDF's outline
  const [contents, setContents] = useState<string | null>(() => (useApp.getState().noteAttach || useApp.getState().sectionMove ? null : takeContents()));
  const [toc, setToc] = useState<BookContents | null>(null);
  useEffect(() => {
    setToc(null);
    if (contents === null) return;
    let live = true;
    const lens = lensOf(contents);
    const none: BookContents = { entries: [], here: -1, from: 'none' };
    void (lens ? lens.contents() : Promise.resolve(none)).then((c) => {
      if (!live) return;
      setToc(c);
      // the entry that holds the place in view is the one picked as the list opens
      if (c.here >= 0) setSel(c.here);
    }, () => { if (live) setToc(none); });
    return () => { live = false; };
  }, [contents]);
  const contentsIndex = useMemo(() => (toc ? contentsRows(toc.entries, toc.here) : []), [toc]);
  // what is left in books (milestone 77): a book's bookmarks or highlights, every book's bookmarks, the marks by a letter
  const [listing, setListing] = useState<{ kind: MarkList; book: string | null } | null>(null);
  const [places, setPlaces] = useState<PlaceRow[] | null>(null);
  useEffect(() => {
    setPlaces(null);
    if (!listing) return;
    let live = true;
    void markList(listing.kind, listing.book).then((rows) => { if (live) setPlaces(rows); }, () => { if (live) setPlaces([]); });
    return () => { live = false; };
  }, [listing]);
  const placeIndex = useMemo(() => placeRows(places ?? []), [places]);
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
  const commands = useMemo(() => [...sectionCommand(), ...contentsCommand(), ...marksCommands(), ...COMMANDS.filter((c) => (c.id !== 'postpone' || overflow(queue, appNow()).length > 0) && !(mobile && DESKTOP_ONLY.has(c.id)) && !(phone && NOT_ON_A_PHONE.has(c.id))), ...pluginCommands()], [queue, plugins?.version, caret, mobile, phone]);
  // the other vaults opened before, under `vaults`, so switching is two keys
  // (one that is not where it was is the welcome's to show, with its `forget`)
  const vaults = useMemo(() => recents.filter((r) => r.path !== vault && !gone.includes(r.path)).map((r) => ({ path: r.path, name: r.name })), [recents, gone, vault]);
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
    // a written notebook is made, never picked: nothing that is there is offered
    if (attaching.kind === 'written') return [];
    // notes that are there and are no PDF's yet, nor a document with pages (a written notebook's pages are its own: it may be a PDF's note, not another notebook's)
    return Object.entries(docs)
      .filter(([path, info]) => info.type === 'note' && info.of === undefined && (info.pdf === undefined || (info.written !== undefined && !docs[attaching.pdf]?.written)) && path.endsWith('.md'))
      .map(([path, info]) => ({ key: `at:${path}`, title: info.title ?? slugName(nameOf(path)), sub: path.replace(/\.md$/, ''), tag: 'note' as const, target: { command: `attach:${path}` } }));
  }, [attaching, tree, docs, vault]);
  /** The new note's name: as typed, else after the PDF. */
  const newName = attaching ? (attaching.step === 'place' ? attaching.name ?? '' : q.trim() || `${titleOf(attaching.pdf, docs, vault)} ${attaching.kind === 'written' ? 'written notes' : 'notes'}`) : '';
  // words in the documents and the cards, for the palette's own list; the last answer stays until the next, so the rows do not blink
  const asking = !attaching && !moving && !studying && contents === null && !listing ? q.trim() : '';
  const [found, setFound] = useState<{ q: string; hits: TextHit[] } | null>(null);
  useEffect(() => {
    if (!asking) { setFound(null); return; }
    let live = true;
    void searchText(asking).then((hits) => { if (live) setFound({ q: asking, hits }); }).catch(failed('that'));
    return () => { live = false; };
  }, [asking, vault]);
  const texts = useMemo(() => (found ? rankHits(found.hits, found.q).map((h) => textEntry(h, found.q, docs)) : []), [found, docs]);
  const results = useMemo(() => {
    if (attaching?.step === 'pick') return [{ key: 'at:new', title: attaching.kind === 'written' ? 'new written notes' : 'new note', sub: newName, tag: 'note' as const, target: { command: 'attach-new' } }, ...search(attachIndex, q)];
    if (!attaching && !moving && listing) return searchContents(placeIndex, q);
    if (!attaching && !moving && contents !== null) return searchContents(contentsIndex, q);
    const names = search(attaching ? attachIndex : moving ? moveIndex : studying ? studyIndex : index, q);
    return asking ? withText(names, texts, q) : names;
  }, [attaching, attachIndex, newName, moving, moveIndex, studying, studyIndex, contents, contentsIndex, listing, placeIndex, index, q, asking, texts]);
  // `nothing` is said once the index has answered, and until it has been through every document it may yet
  const reading = useApp((s) => s.searchShare);

  useEffect(() => { inputRef.current?.focus(); }, []);
  // esc closes from anywhere, not only from the field
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') { e.preventDefault(); dismiss(); } };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [attaching]);
  useEffect(() => { setSel(0); }, [q, studying, moving, attaching, contents, listing]);
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
    if ('command' in t && t.command === 'contents') { setContents(bookInFront()); setQ(''); inputRef.current?.focus(); return; }
    if ('command' in t && MARK_LISTS[t.command]) { setListing({ kind: MARK_LISTS[t.command]!, book: bookInFront() }); setQ(''); inputRef.current?.focus(); return; }
    if ('command' in t && t.command.startsWith('mk:') && listing) {
      const row = places?.[Number(t.command.slice(3))];
      close();
      row?.go();
      return;
    }
    if ('command' in t && t.command.startsWith('toc:')) {
      const entry = toc?.entries[Number(t.command.slice(4))];
      close();
      if (entry && contents !== null) lensOf(contents)?.go(entry);
      return;
    }
    if ('command' in t && t.command.startsWith('move:') && moving) { close(); void moveSection(moving, t.command.slice(5)).catch(failed('that')); return; }
    if (attaching && 'command' in t) {
      const pdf = attaching.pdf;
      const kind = attaching.kind;
      if (t.command === 'attach-new') { useApp.setState({ noteAttach: { pdf, step: 'place', name: newName, ...(kind ? { kind } : {}) } }); setQ(''); inputRef.current?.focus(); return; }
      if (t.command.startsWith('attach:')) { close(); void attachNote(pdf, t.command.slice(7)).catch(failed('that')); return; }
      if (t.command.startsWith('attach-in:')) { close(); void attachNewNote(pdf, newName, t.command.slice(10), kind).catch(failed('that')); return; }
    }
    close();
    if ('command' in t) runCommand(t.command);
    // one that does not open leaves this one open (`openVault`), and says why
    else if ('vault' in t) void openVault(t.vault).catch(failed('open'));
    else if (!currentVault()) return;
    else if ('block' in t || 'index' in t) {
      if ('block' in t) openBlock(t.open, t.block);
      else openCard(t.open, t.index, t.id);
      // a document with pages opens on its pages: what was found is in its text, beside them
      if (useApp.getState().docs[t.open]?.pdf !== undefined) void openNotes(t.open, t.open).catch(failed('that'));
    } else openNode(t.open);
  };

  /** The list is a book's contents. */
  const inContents = !attaching && !moving && contents !== null && !listing;
  /** The list is places left in books. */
  const inPlaces = !attaching && !moving && listing !== null;

  const onKey = (e: React.KeyboardEvent) => {
    if (e.key === 'ArrowDown' || (e.ctrlKey && e.key === 'n')) { e.preventDefault(); setSel((s) => Math.min(results.length - 1, s + 1)); }
    else if (e.key === 'ArrowUp' || (e.ctrlKey && e.key === 'p')) { e.preventDefault(); setSel((s) => Math.max(0, s - 1)); }
    else if (e.key === 'Enter') {
      e.preventDefault();
      const it = results[sel];
      // a row of text found for what was typed before (it stays until the next answer, so the rows do not blink) is not what ⏎ asks for
      if (it && (it.tag === 'text' || it.tag === 'card') && asking && found?.q !== asking) return;
      run(it);
    }
    // ⌫ in an empty field of a list within the list (`study…`, `move to…`, the folder for a new note): back a step
    else if (e.key === 'Backspace' && q === '' && (studying || moving || attaching?.step === 'place' || contents !== null || listing)) {
      e.preventDefault();
      if (!attaching && !moving && listing) setListing(null);
      else if (!attaching && !moving && contents !== null) setContents(null);
      else if (attaching?.step === 'place') useApp.setState({ noteAttach: { pdf: attaching.pdf, step: 'pick', ...(attaching.kind ? { kind: attaching.kind } : {}) } });
      else if (moving) useApp.setState({ sectionMove: null });
      else setStudying(false);
    }
    // the field is the palette's one stop: Tab walks the results, never out to the page behind
    else if (e.key === 'Tab') { e.preventDefault(); setSel((s) => (e.shiftKey ? Math.max(0, s - 1) : Math.min(results.length - 1, s + 1))); }
  };

  return (
    <div className="palette-overlay" onMouseDown={dismiss}>
      <div className="palette-panel" onMouseDown={(e) => e.stopPropagation()}>
        <div className="palette-input">
          <span className="g"><Glyph g="⌕" /></span>
          <input dir="auto" ref={inputRef} value={q} onChange={(e) => setQ(e.target.value)} onKeyDown={onKey} placeholder={attaching?.step === 'place' ? `${newName} in…` : attaching ? `${attaching.kind === 'written' ? 'written notes' : 'notes'} on ${titleOf(attaching.pdf, docs, vault).slice(0, 40)}` : moving ? `move § ${plainMath(moving.text).slice(0, 40)} to…` : listing ? `${MARK_LIST_NAME[listing.kind]}${listing.book !== null && listing.kind !== 'all-bookmarks' && listing.kind !== 'marks' ? ` · ${titleOf(listing.book, docs, vault).slice(0, 40)}` : ''}` : contents !== null ? `contents · ${titleOf(contents, docs, vault).slice(0, 40)}` : studying ? 'study…' : 'open or run'} spellCheck={false} />
          <kbd>esc</kbd>
        </div>
        <div className="palette-list" ref={listRef} data-found={found?.q} data-places={inPlaces && places !== null ? listing.kind : undefined}>
          {inContents && toc && toc.from !== 'outline' && <div className="palette-empty palette-note" data-contents={toc.from}>this pdf has no contents{toc.from === 'sections' ? ' · its sections' : ''}</div>}
          {inPlaces && places !== null && places.length === 0 && <div className="palette-empty palette-note" data-places={listing.kind}>{MARK_LIST_EMPTY[listing.kind]}</div>}
          {results.length === 0 && !(inContents && (!toc || (toc.from === 'none' && !q.trim()))) && !(inPlaces && (places === null || places.length === 0)) && (!asking || found?.q === asking) && <div className="palette-empty">{asking && reading < 1 ? 'nothing yet' : 'nothing'}</div>}
          {results.map((it, i) => (
            <div key={it.key} className="palette-row" data-sel={i === sel ? '1' : '0'} data-t={it.tag} data-here={it.here ? '1' : undefined} data-depth={it.depth} style={it.depth ? { '--depth': it.depth } as React.CSSProperties : undefined} onMouseEnter={() => setSel(i)} onClick={() => run(it)}>
              {/* a place in a book: no mark of a kind, only the one that holds the place in view is marked */}
              <span className="pg" data-t={it.tag}>{it.tag === 'place' ? (it.here ? '▸' : '') : <Glyph g={('open' in it.target && docs[it.target.open]?.written) || (it.key === 'at:new' && attaching?.kind === 'written') || it.key === 'x:new-written' ? WRITTEN_GLYPH : ENTRY_GLYPH[it.tag]} />}</span>
              {it.mark ? <Marked title={it.title} mark={it.mark} /> : <MathText className="pt" dir="auto" text={it.math ?? it.title} />}
              <MathText className="psub" dir="auto" text={it.sub} />
              <span className="ptag">{it.page !== undefined ? `p. ${it.page}` : it.tag}</span>
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
